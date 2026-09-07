import React, { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  cancelBooking,
  formatPrice,
  listMyBookings,
  signin,
  signup,
  useAuth,
  type AuthResponse,
  type ClientBooking,
  type UseAuth,
} from "../lib/client";

export const Route = createFileRoute("/my/bookings")({
  head: () => ({
    meta: [{ title: "My Bookings | Supertalks" }],
  }),
  component: MyBookings,
});

const CANCELLABLE = ["PendingPayment", "Confirmed", "Rescheduled"];

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
    return <AuthPanel onAuthenticated={auth.applyAuth} />;
  }

  return <BookingsHome auth={auth} />;
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: (res: AuthResponse) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res =
        mode === "signin"
          ? await signin(identifier.trim(), password)
          : await signup({
              name: name.trim(),
              email: email.trim().toLowerCase(),
              username: username.trim().toLowerCase(),
              mobile: mobile.trim() || undefined,
              password,
            });
      setPassword("");
      onAuthenticated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <h1>My Bookings</h1>
        <p className="wx-book-note">Sign in (or create a free account) to view all your sessions.</p>
        <div className="wx-question-tabs" role="tablist">
          <button
            type="button"
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => setMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>
        <form className="wx-auth-form wx-my-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label>
                Your name
                <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                Username
                <input
                  type="text"
                  required
                  minLength={3}
                  pattern="[a-z0-9_]{3,30}"
                  title="3-30 chars: lowercase letters, numbers, underscore"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                Mobile (optional, E.164)
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Email or username
              <input
                type="text"
                required
                minLength={3}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
            </label>
          )}
          <label>
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === "signup" ? (
            <p className="wx-auth-hint">Password needs 8+ characters, an uppercase letter, and a number.</p>
          ) : null}
          {error ? <p className="wx-auth-error">{error}</p> : null}
          <button type="submit" className="wx-btn wx-btn-primary wx-auth-submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </main>
  );
}

function BookingsHome({ auth }: { auth: UseAuth }) {
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    listMyBookings()
      .then(({ bookings }) => setBookings(bookings))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Could not load your bookings.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      load();
    } catch (err) {
      setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not cancel the booking." });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <header className="wx-my-head">
          <div>
            <h1>My Bookings</h1>
            <p className="wx-book-note">Signed in as {auth.user!.email}.</p>
            <p className="wx-book-note">
              <Link className="wx-linkbtn" to="/my/questions">
                View your question chats →
              </Link>
            </p>
          </div>
          <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
            Sign out
          </button>
        </header>

        <p className="wx-book-note">
          <Link className="wx-linkbtn" to="/">
            ← Back to browsing
          </Link>
        </p>

        {loading ? (
          <p className="wx-book-note">Loading your bookings…</p>
        ) : loadError ? (
          <p className="wx-book-danger">{loadError}</p>
        ) : bookings.length === 0 ? (
          <p className="wx-book-note">You haven't booked any sessions yet.</p>
        ) : (
          <div className="wx-my-bookings">
            {bookings.map((b) => {
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

        {banner ? (
          <p className={banner.ok ? "wx-book-ok" : "wx-book-danger"}>{banner.message}</p>
        ) : null}
      </div>
    </main>
  );
}