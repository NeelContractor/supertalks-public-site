import React, { useEffect, useRef, useState } from "react";
import {
  createBooking,
  fetchOpenSlots,
  formatPrice,
  orderQuestions,
  type OpenSlot,
  type QuestionOrderClientDetails,
} from "./client";
import type { UseAuth } from "./useAuth";
import { runCheckout, useGatewayReturn } from "./pay";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PickedService, SiteClientInfo } from "./site-render";

const PAY_TOAST_ID = "supertalks-pay";

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function upcomingDays(count: number): { key: string; label: string }[] {
  const now = new Date();
  const days: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      key: dateKey(d),
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
    });
  }
  return days;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const EMPTY_DETAILS: QuestionOrderClientDetails = {
  clientName: "",
  birthDate: "",
  birthTime: "",
  birthPlace: "",
};

export function ServiceDialog({
  open,
  service,
  client,
  auth,
  authNonce,
  suppressOutsideDismiss,
  onClose,
  onNeedAuth,
}: {
  open: boolean;
  service: PickedService | null;
  client?: SiteClientInfo;
  auth: UseAuth;
  authNonce: number;
  suppressOutsideDismiss?: boolean;
  onClose: () => void;
  onNeedAuth: (mode?: "signin" | "signup") => void;
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(() => dateKey(new Date()));
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<OpenSlot | null>(null);

  const [details, setDetails] = useState<QuestionOrderClientDetails>(EMPTY_DETAILS);
  const setDetail = (key: keyof QuestionOrderClientDetails, value: string) =>
    setDetails((cur) => ({ ...cur, [key]: value }));

  const pendingRef = useRef<
    | { kind: "slot"; slot: OpenSlot }
    | { kind: "question"; details: QuestionOrderClientDetails }
    | null
  >(null);

  useGatewayReturn((_outcome, _paymentId, status) => {
    const ok = status === "success";
    const message =
      status === "success"
        ? service?.kind === "slot"
          ? "Payment successful! Your session is confirmed."
          : "Payment successful! Your questions have been sent."
        : status === "failed"
          ? "Payment failed. You can try again."
          : status === "pending"
            ? "Payment is being processed. We'll confirm shortly."
            : "Payment could not be completed.";
    setStatus({ ok, message });
    if (ok) {
      toast.success(message, { id: PAY_TOAST_ID });
    } else if (status === "failed") {
      toast.error(message, { id: PAY_TOAST_ID });
    } else if (status === "pending") {
      toast(message, { id: PAY_TOAST_ID });
    } else {
      toast.error(message, { id: PAY_TOAST_ID });
    }
  });

  // Reset internal flow state each time a new service opens the dialog.
  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setSubmitting(false);
    setDate(dateKey(new Date()));
    setSlots([]);
    setSlotError(null);
    setWeekOffset(0);
    setSelectedSlot(null);
    setDetails(EMPTY_DETAILS);
    pendingRef.current = null;
  }, [open, service?.serviceId]);

  const amAuthenticated = Boolean(auth.token);
  const isSlot = service?.kind === "slot";
  const slug = client?.slug;
  const astrologerId = client?.astrologerId;

  useEffect(() => {
    if (!open || !isSlot) return;
    if (!slug) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotError(null);
    fetchOpenSlots(slug, date)
      .then(({ slots }) => {
        if (!cancelled) setSlots(slots);
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          setSlotError(err instanceof Error ? err.message : "Could not load slots");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSlot, slug, date]);

  // Finish a payment that was started before sign-in completed.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (!auth.token || !astrologerId) return;
    pendingRef.current = null;
    if (pending.kind === "slot") {
      void book(pending.slot);
    } else {
      void checkoutQuestion(pending.details);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authNonce, auth.token]);

  const days = upcomingDays(28);
  const weekSize = 7;
  const maxWeekOffset = Math.max(0, Math.ceil(days.length / weekSize) - 1);
  const weekDays = days.slice(weekOffset * weekSize, weekOffset * weekSize + weekSize);

  const goToWeek = (next: number) => {
    const clamped = Math.max(0, Math.min(maxWeekOffset, next));
    setWeekOffset(clamped);
    const shown = days.slice(clamped * weekSize, clamped * weekSize + weekSize);
    if (!shown.some((day) => day.key === date) && shown[0]) {
      setDate(shown[0].key);
    }
  };

  const pickSlot = (slot: OpenSlot) => {
    if (!amAuthenticated) {
      pendingRef.current = { kind: "slot", slot };
      onNeedAuth();
      return;
    }
    setSelectedSlot(slot);
  };

  const book = async (slot: OpenSlot) => {
    if (!astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    toast.loading("Checking availability and starting your booking…", { id: PAY_TOAST_ID });
    try {
      const { payment } = await createBooking(
        astrologerId,
        slot.startAt,
        crypto.randomUUID(),
        service?.serviceId,
        details,
      );
      if (payment) {
        setStatus({ ok: true, message: "Redirecting to secure payment…" });
        toast.loading("Redirecting to secure payment…", { id: PAY_TOAST_ID });
        const outcome = await runCheckout(payment, window.location.href);
        if (outcome === "redirect") return;
        setStatus({ ok: true, message: "Payment successful! Your session is confirmed." });
        toast.success("Payment successful! Your session is confirmed.", { id: PAY_TOAST_ID });
      } else {
        setStatus({ ok: true, message: "Session booked and confirmed." });
        toast.success("Session booked and confirmed.", { id: PAY_TOAST_ID });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed. Please try again.";
      setStatus({ ok: false, message });
      toast.error(message, { id: PAY_TOAST_ID });
    } finally {
      setSubmitting(false);
    }
  };

  const checkoutQuestion = async (cleanDetails: QuestionOrderClientDetails) => {
    if (!astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    toast.loading("Checking your order and starting payment…", { id: PAY_TOAST_ID });
    try {
      const result = await orderQuestions(
        astrologerId,
        [{ questionText: service?.title ?? "Question", serviceId: service?.serviceId }],
        cleanDetails,
      );
      setStatus({ ok: true, message: "Redirecting to secure payment…" });
      toast.loading("Redirecting to secure payment…", { id: PAY_TOAST_ID });
      const outcome = await runCheckout(result.payment, window.location.href);
      if (outcome === "redirect") return;
      setStatus({ ok: true, message: "Payment successful! Your questions have been sent." });
      toast.success("Payment successful! Your questions have been sent.", { id: PAY_TOAST_ID });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create your order. Please try again.";
      setStatus({ ok: false, message });
      toast.error(message, { id: PAY_TOAST_ID });
    } finally {
      setSubmitting(false);
    }
  };

  const detailsComplete =
    details.clientName.trim().length > 0 &&
    details.birthDate.length > 0 &&
    details.birthTime.length > 0 &&
    details.birthPlace.trim().length > 0;

  const pricePaise = service?.pricePaise ?? 0;

  const canPay = isSlot
    ? Boolean(selectedSlot) && detailsComplete && !submitting && amAuthenticated
    : detailsComplete && pricePaise > 0 && !submitting && amAuthenticated;

  const handlePay = () => {
    if (!detailsComplete || !amAuthenticated) return;
    const cleanDetails: QuestionOrderClientDetails = {
      clientName: details.clientName.trim(),
      birthDate: details.birthDate,
      birthTime: details.birthTime,
      birthPlace: details.birthPlace.trim(),
    };
    if (isSlot) {
      if (!selectedSlot) return;
      void book(selectedSlot);
    } else {
      if (pricePaise <= 0) return;
      void checkoutQuestion(cleanDetails);
    }
  };

  if (!service) return null;

  const accepting =
    isSlot ? client?.isAcceptingBookings !== false : client?.isAcceptingQuestions !== false;

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="wx-svc-dialog max-w-[560px] sm:max-w-[560px]"
        onPointerDownOutside={(event) => {
          if (suppressOutsideDismiss) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (suppressOutsideDismiss) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (suppressOutsideDismiss) event.preventDefault();
        }}
      >
        <DialogTitle className="wx-modal-title">
          {isSlot ? "Book this session" : "Ask this question"}
        </DialogTitle>
        <DialogDescription className="wx-modal-sub">
          Fill in the details below and proceed to payment.
        </DialogDescription>

        <div className="wx-svc-service">
          <div>
            <span className="wx-service-tag wx-service-tag-slot">
              {isSlot ? "Live session" : "Written question"}
            </span>
            <p className="wx-svc-service-name">{service.title}</p>
          </div>
          <span className="wx-svc-service-price">
            {pricePaise > 0 ? formatPrice(pricePaise) : "Free"}
            {service.durationMinutes > 0 ? ` · ${service.durationMinutes} min` : ""}
          </span>
        </div>

        {!accepting ? (
          <p className="wx-book-note">
            {isSlot
              ? "Bookings are currently paused. Please check back soon."
              : "Questions are currently paused."}
          </p>
        ) : (
          <>
            {isSlot ? (
              <section className="wx-svc-section">
                <h3 className="wx-svc-section-title">Choose a slot</h3>
                <div className="wx-book-week">
                  <button
                    type="button"
                    className="wx-book-week-nav"
                    aria-label="Previous week"
                    disabled={weekOffset === 0}
                    onClick={() => goToWeek(weekOffset - 1)}
                  >
                    <ArrowLeftIcon />
                  </button>
                  <div className="wx-book-days">
                    {weekDays.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={day.key === date ? "is-active" : ""}
                        onClick={() => setDate(day.key)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="wx-book-week-nav"
                    aria-label="Next week"
                    disabled={weekOffset >= maxWeekOffset}
                    onClick={() => goToWeek(weekOffset + 1)}
                  >
                    <ArrowRightIcon />
                  </button>
                </div>
                <div className="wx-svc-slots">
                  {loadingSlots ? (
                    <p className="wx-book-note">Loading slots…</p>
                  ) : slotError ? (
                    <p className="wx-book-danger">{slotError}</p>
                  ) : slots.length === 0 ? (
                    <p className="wx-book-note">No open slots on this day. Try another date.</p>
                  ) : (
                    <div className="wx-slot-grid">
                      {slots.map((slot) => (
                        <button
                          key={slot.startAt}
                          type="button"
                          className={`wx-slot${selectedSlot?.startAt === slot.startAt ? " is-selected" : ""}`}
                          disabled={submitting}
                          onClick={() => pickSlot(slot)}
                        >
                          {formatTime(slot.startAt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="wx-svc-section">
                <h3 className="wx-svc-section-title">Your question</h3>
                <p className="wx-svc-order-line">
                  {service.title}
                  {pricePaise > 0 ? ` — ${formatPrice(pricePaise)}` : ""}
                </p>
              </section>
            )}

            {isSlot && !selectedSlot ? (
              <p className="wx-book-note">Pick a time slot above to continue.</p>
            ) : pricePaise <= 0 && !isSlot ? (
              <p className="wx-book-note">Pricing not configured yet — please check back soon.</p>
            ) : (
              <section className="wx-svc-section">
                <h3 className="wx-svc-section-title">Your birth details</h3>
                <p className="wx-svc-hint">All fields are required for an accurate reading.</p>
                <div className="wx-svc-details">
                  <label className="wx-svc-field wx-svc-field--wide">
                    <span>Your name <em>*</em></span>
                    <input
                      type="text"
                      value={details.clientName}
                      onChange={(e) => setDetail("clientName", e.target.value)}
                      placeholder="Full name"
                    />
                  </label>
                  <label className="wx-svc-field">
                    <span>Birth date <em>*</em></span>
                    <input
                      type="date"
                      value={details.birthDate}
                      onChange={(e) => setDetail("birthDate", e.target.value)}
                    />
                  </label>
                  <label className="wx-svc-field">
                    <span>Birth time <em>*</em></span>
                    <input
                      type="time"
                      value={details.birthTime}
                      onChange={(e) => setDetail("birthTime", e.target.value)}
                    />
                  </label>
                  <label className="wx-svc-field wx-svc-field--wide">
                    <span>Birth place <em>*</em></span>
                    <input
                      type="text"
                      value={details.birthPlace}
                      onChange={(e) => setDetail("birthPlace", e.target.value)}
                      placeholder="City, country"
                    />
                  </label>
                </div>
              </section>
            )}

            {status ? (
              <p className={status.ok ? "wx-book-ok" : "wx-book-danger"}>{status.message}</p>
            ) : null}

            {!amAuthenticated ? (
              <p className="wx-book-note">
                Sign in (or create a free account) to continue.
                <span className="wx-auth-btns">
                  <button type="button" className="wx-auth-btn" onClick={() => onNeedAuth("signin")}>
                    Sign in
                  </button>
                  <button type="button" className="wx-auth-btn wx-auth-btn-solid" onClick={() => onNeedAuth("signup")}>
                    Create Account
                  </button>
                </span>
              </p>
            ) : (
              <button
                type="button"
                className="wx-btn wx-btn-primary wx-svc-pay"
                disabled={!canPay}
                onClick={handlePay}
              >
                {submitting
                  ? "Please wait…"
                  : isSlot
                    ? `Pay ${pricePaise > 0 ? formatPrice(pricePaise) : "Nothing"}`
                    : `Pay ${formatPrice(pricePaise)}`}
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}