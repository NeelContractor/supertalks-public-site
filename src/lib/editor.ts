// Client-bundled code: never touch `process` directly (not defined in the browser).
import { API_BASE, getAccessToken, type PaymentOutcome } from "./client";

const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};

/** Origin of the dashboard app (the client's bookings/questions tracker). */
export const EDITOR_ORIGIN = env.BUN_PUBLIC_EDITOR_ORIGIN ?? "http://localhost:3001";

/** Absolute dashboard URL for a path like "/bookings" or "/questions". */
export const dashboardUrl = (path: string) => `${EDITOR_ORIGIN}${path}`;

/** True when the settled payment belongs to a session-booking flow. */
export function isBookingOutcome(outcome: PaymentOutcome | null): boolean {
  return outcome?.bookings != null && outcome.bookings.length > 0;
}

/** True when the settled payment belongs to a question-order flow. */
export function isQuestionOutcome(outcome: PaymentOutcome | null): boolean {
  return outcome?.questions != null && outcome.questions.length > 0;
}

/**
 * Dashboard deep-link for a settled payment. Several payment flows may live on
 * the same page, so the target is always derived from the settled outcome
 * rather than from any component-local state (which a gateway round-trip
 * reloads anyway).
 */
export function redirectPathFromOutcome(outcome: PaymentOutcome | null): string | null {
  const booking = outcome?.bookings?.[0];
  if (booking?.id) return `/bookings?id=${booking.id}`;
  const question = outcome?.questions?.[0];
  if (question?.id) return `/questions?thread=${question.id}`;
  return null;
}

/**
 * Send the client to the dashboard after a successful payment. A one-time
 * cross-app handoff code is minted first so they land already signed in; if
 * that fails we still navigate (they can sign in normally).
 *
 * Single-shot per page load, so a client who somehow triggers the hand-off
 * twice only ever burns one handoff code.
 */
let redirectArmed = true;

export function redirectToDashboard(path: string): Promise<void> {
  if (!redirectArmed) return Promise.resolve();
  redirectArmed = false;
  return redirectToDashboardInternal(path);
}

async function redirectToDashboardInternal(path: string): Promise<void> {
  const url = dashboardUrl(path);
  try {
    const token = getAccessToken();
    let code: string | null = null;
    if (token) {
      const res = await fetch(`${API_BASE}/auth/handoff`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { code?: string };
        code = typeof data.code === "string" ? data.code : null;
      }
    }
    const sep = path.includes("?") ? "&" : "?";
    window.location.assign(code ? `${url}${sep}code=${encodeURIComponent(code)}` : url);
  } catch {
    window.location.assign(url);
  }
}

const PENDING_REDIRECT_KEY = "supertalks:pending-redirect";
const PENDING_SCROLL_KEY = "supertalks:pending-scroll";

/**
 * Remember where to send the client once payment settles. sessionStorage
 * survives the payment gateway round-trip (a full page navigation), unlike any
 * React state/ref.
 */
export function rememberRedirectPath(path: string): void {
  try {
    sessionStorage.setItem(PENDING_REDIRECT_KEY, path);
  } catch {
    // storage unavailable — we fall back to the settled outcome instead
  }
}

/** Read and clear the pending dashboard target. */
export function consumeRedirectPath(): string | null {
  try {
    const path = sessionStorage.getItem(PENDING_REDIRECT_KEY);
    sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    return path;
  } catch {
    return null;
  }
}

/**
 * Remember the scroll offset before leaving for the gateway. The round-trip is
 * two real document loads, so the router's history-based scroll restoration has
 * no entry to restore from and the visitor would otherwise land at the top.
 */
export function rememberScrollPosition(): void {
  try {
    sessionStorage.setItem(PENDING_SCROLL_KEY, String(Math.round(window.scrollY)));
  } catch {
    // storage unavailable — we just come back to the top
  }
}

/** Read and clear the scroll offset saved before the gateway redirect. */
export function consumeScrollPosition(): number | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SCROLL_KEY);
    sessionStorage.removeItem(PENDING_SCROLL_KEY);
    if (raw == null) return null;
    const offset = Number(raw);
    return Number.isFinite(offset) && offset >= 0 ? offset : null;
  } catch {
    return null;
  }
}

/**
 * Put the visitor back where they left off. Re-applied on the next frame and
 * again on `load`, because late-arriving images and fonts change the page
 * height after the section has already mounted.
 */
export function restoreScrollPosition(offset: number | null): void {
  if (offset == null) return;
  const apply = () => window.scrollTo({ top: offset, left: 0, behavior: "auto" });
  apply();
  window.requestAnimationFrame(apply);
  if (document.readyState === "complete") return;
  window.addEventListener("load", apply, { once: true });
}