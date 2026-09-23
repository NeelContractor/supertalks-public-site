import React, { useEffect, useRef } from "react";
import {
  completePayment,
  getPayment,
  initiatePayment,
  type PaymentOutcome,
} from "./client";

/**
 * Start a payment for the given intent:
 *   - PhonePe configured: opens the gateway redirect (navigates the browser)
 *   - Fallback mock flow: settles locally via /complete
 */
export type CheckoutStart =
  | { kind: "redirect" }
  | { kind: "settled"; outcome: PaymentOutcome };

export async function startCheckout(
  payment: { id: string },
  returnTo: string,
): Promise<CheckoutStart> {
  const res = await initiatePayment(payment.id, returnTo);
  if (res.mode === "gateway" && res.redirectUrl) {
    window.location.assign(res.redirectUrl);
    return { kind: "redirect" };
  }
  if (res.mode === "gateway") {
    return {
      kind: "settled",
      outcome: {
        payment: res.payment,
        message: res.message,
        question: res.question,
        questions: res.questions ?? null,
        bookings: res.bookings ?? null,
      },
    };
  }
  return { kind: "settled", outcome: await completePayment(payment.id) };
}

/**
 * Run checkout for a payment intent and return the settled outcome, or a
 * "redirect" marker when the browser is being sent to the payment gateway.
 */
export async function runCheckout(
  payment: { id: string },
  returnTo: string,
): Promise<PaymentOutcome | "redirect"> {
  const started = await startCheckout(payment, returnTo);
  if (started.kind === "redirect") return "redirect";
  return started.outcome;
}

export type GatewayReturnStatus = "success" | "failed" | "pending" | "error";

/**
 * Handle the redirect back from the payment gateway. The backend lands the user
 * on the page they were on with ?paymentId=...&status=success|failed|pending.
 * This hook strips the params, polls the payment until it has a final status,
 * then calls onResult with the outcome and the gateway status.
 */
export function useGatewayReturn(
  onResult: (
    outcome: PaymentOutcome | null,
    paymentId: string,
    status: GatewayReturnStatus,
  ) => void,
): void {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    if (!paymentId) return;

    const hinted = params.get("status");
    const hintedStatus: GatewayReturnStatus =
      hinted === "success" || hinted === "failed" || hinted === "error" ? hinted : "pending";

    params.delete("paymentId");
    params.delete("status");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );

    const poll = async () => {
      const deadline = Date.now() + 60_000;
      let last: PaymentOutcome | null = null;
      while (Date.now() < deadline) {
        try {
          last = await getPayment(paymentId);
          if (last.payment.status !== "Created") {
            onResultRef.current(
              last,
              paymentId,
              last.payment.status === "Succeeded" ? "success" : "failed",
            );
            return;
          }
        } catch {
          // transient network/auth — keep polling until the deadline
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      // The backend settled before redirecting, so the payment is normally
      // already final. Only when we can't confirm do we trust the redirect hint.
      onResultRef.current(last, paymentId, hintedStatus);
    };
    void poll();
  }, []);
}