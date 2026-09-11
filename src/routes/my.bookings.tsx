import React, { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs } from "../lib/breadcrumbs";
import {
  cancelBooking,
  formatPrice,
  type ClientBooking,
} from "../lib/client";
import { useAuth, type UseAuth } from "../lib/useAuth";
import { AuthPanel } from "../lib/AuthPanel";
import { useStore } from "../lib/store";

export const Route = createFileRoute("/my/bookings")({
  head: () => ({
    meta: [{ title: "My Bookings | Supertalks" }],
  }),
  component: MyBookings,
});

const CANCELLABLE = ["PendingPayment", "Confirmed", "Rescheduled"];

const OPEN_STATUSES = new Set(["PendingPayment", "Confirmed", "Rescheduled"]);
const CANCELLED_STATUSES = new Set(["CancelledByClient", "CancelledByAstrologer"]);

type BookingFilter = "all" | "open" | "cancelled";

const STATUS_LABEL: Record<string, string> = {
  PendingPayment: "Payment pending",
  Confirmed: "Confirmed",
  Rescheduled: "Rescheduled",
  Completed: "Completed",
  CancelledByClient: "Cancelled by you",
  CancelledByAstrologer: "Cancelled by astrologer",
  NoShowClient: "Missed (client)",
  NoShowAstrologer: "Missed (astrologer)",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function MyBookings() {
  const auth = useAuth();

  if (!auth.user) {
    return (
      <AuthPanel
        title="My Bookings"
        note="Sign in (or create a free account) to view all your sessions."
        onAuthenticated={auth.applyAuth}
      />
    );
  }

  return <BookingsHome auth={auth} />;
}

function BookingsHome({ auth }: { auth: UseAuth }) {
  const bookings = useStore((s) => s.bookings);
  const loading = useStore((s) => s.bookingsLoading && !s.bookingsLoaded);
  const loadError = useStore((s) => s.bookingsError);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [filter, setFilter] = useState<BookingFilter>("all");

  const filteredBookings = bookings.filter((b) =>
    filter === "all"
      ? true
      : filter === "open"
        ? OPEN_STATUSES.has(b.status)
        : CANCELLED_STATUSES.has(b.status)
  );

  useEffect(() => {
    void useStore.getState().loadBookings();
  }, []);

  const handleCancel = async (booking: ClientBooking) => {
    if (!CANCELLABLE.includes(booking.status)) return;
    const ok = window.confirm("Cancel this booking? You can book another slot anytime.");
    if (!ok) return;
    setCancellingId(booking.id);
    setBanner(null);
    try {
      await cancelBooking(booking.id);
      setBanner({ ok: true, message: "Booking cancelled." });
      await useStore.getState().loadBookings(true);
    } catch (err) {
      setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not cancel the booking." });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <Breadcrumbs />
        <header className="wx-my-head">
          <div>
            <h1>My Bookings</h1>
            <p className="wx-book-note">Signed in as {auth.user!.email}.</p>
            {/* <p className="wx-book-note">
              <Link className="wx-linkbtn" to="/my/questions" search={{ thread: undefined }}>
                View your question chats →
              </Link>
            </p> */}
          </div>
          <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
            Sign out
          </button>
        </header>

        {loading ? (
          <p className="wx-book-note">Loading your bookings…</p>
        ) : loadError ? (
          <p className="wx-book-danger">{loadError}</p>
        ) : bookings.length === 0 ? (
          <p className="wx-book-note">You haven't booked any sessions yet.</p>
        ) : (
          <>
            <div className="wx-question-tabs" role="tablist" aria-label="Filter bookings">
              <button
                type="button"
                className={filter === "all" ? "is-active" : ""}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={filter === "open" ? "is-active" : ""}
                onClick={() => setFilter("open")}
              >
                Open
              </button>
              <button
                type="button"
                className={filter === "cancelled" ? "is-active" : ""}
                onClick={() => setFilter("cancelled")}
              >
                Cancelled
              </button>
            </div>
            {filteredBookings.length === 0 ? (
              <p className="wx-book-note">
                {filter === "open"
                  ? "You don't have any open bookings."
                  : "You don't have any cancelled bookings."}
              </p>
            ) : (
              <div className="wx-my-bookings">
            {filteredBookings.map((b) => {
              const cancellable = CANCELLABLE.includes(b.status);
              const isMeetingRelevant = b.status === "Confirmed" || b.status === "Rescheduled";
              return (
                <div key={b.id} className="wx-my-booking">
                  <div className="wx-my-booking-row">
                    <p className="wx-my-booking-when">
                      {new Date(b.startAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <span className={`wx-my-booking-status is-${b.status.toLowerCase()}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <p className="wx-my-booking-meta">
                    {b.astrologer?.user.name ? `With ${b.astrologer.user.name}` : "Astrologer"}
                    {formatPrice(b.pricePaise) ? ` · ${formatPrice(b.pricePaise)}` : ""}
                  </p>
                  {isMeetingRelevant && b.meetingLink ? (
                    <p className="wx-my-booking-meta">
                      <a className="wx-linkbtn" href={b.meetingLink} target="_blank" rel="noreferrer">
                        Join meeting
                      </a>
                    </p>
                  ) : null}
                  {b.cancellationReason ? (
                    <p className="wx-book-note">Reason: {b.cancellationReason}</p>
                  ) : null}
                  <div className="wx-my-booking-actions">
                    {b.astrologer?.slug ? (
                      <Link className="wx-linkbtn" to={`/$slug`} params={{ slug: b.astrologer.slug }}>
                        View astrologer
                      </Link>
                    ) : null}
                    {cancellable ? (
                      <button
                        type="button"
                        className="wx-linkbtn"
                        disabled={cancellingId === b.id}
                        onClick={() => void handleCancel(b)}
                      >
                        {cancellingId === b.id ? "Cancelling…" : "Cancel booking"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </>
        )}

        {banner ? (
          <p className={banner.ok ? "wx-book-ok" : "wx-book-danger"}>{banner.message}</p>
        ) : null}
      </div>
    </main>
  );
}