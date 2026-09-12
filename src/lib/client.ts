// Client-bundled code: never touch `process` directly (not defined in the browser).
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
export const API_BASE = env.BUN_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

const ACCESS_KEY = "supertalks_access_token";
const REFRESH_KEY = "supertalks_refresh_token";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface OpenSlot {
  startAt: string;
  endAt: string;
}

const hasLocalStorage = typeof localStorage !== "undefined";

export function getAccessToken(): string | null {
  if (!hasLocalStorage) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function persistAuth(res: AuthResponse): void {
  if (!hasLocalStorage) return;
  localStorage.setItem(ACCESS_KEY, res.accessToken);
  localStorage.setItem(REFRESH_KEY, res.refreshToken);
}

export function clearAuth(): void {
  if (!hasLocalStorage) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RetryInit = RequestInit & { retried?: boolean };

/**
 * Exchange the stored refresh token for a fresh pair. Single-flight: parallel
 * 401s share one refresh, since the backend rotates (revokes) it on each use.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!hasLocalStorage) return false;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RetryInit = {}): Promise<T> {
  const { retried = false, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");
  if (typeof requestInit.body === "string") headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...requestInit, headers });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    if (res.status === 401 && token && !retried) {
      // Token probably expired: try to refresh once, then replay the request.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        return request<T>(path, { ...requestInit, retried: true });
      }
    }
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export interface SignupInput {
  name: string;
  email: string;
  username: string;
  mobile?: string;
  password: string;
}

export function signup(input: SignupInput): Promise<AuthResponse> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function signin(identifier: string, password: string): Promise<AuthResponse> {
  return request("/auth/signin", { method: "POST", body: JSON.stringify({ identifier, password }) });
}

export function fetchMe(): Promise<{ user: PublicUser }> {
  return request("/me");
}

export function fetchOpenSlots(
  slug: string,
  date: string,
): Promise<{ date: string; slots: OpenSlot[] }> {
  return request(`/astrologers/${encodeURIComponent(slug)}/slots?date=${date}`);
}

export function createBooking(
  astrologerId: string,
  startAt: string,
  idempotencyKey: string,
): Promise<{ booking: unknown }> {
  return request("/bookings", {
    method: "POST",
    body: JSON.stringify({ astrologerId, startAt }),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function askQuestion(
  astrologerId: string,
  questionText: string,
  category: string,
): Promise<{ question: unknown }> {
  return request("/questions", {
    method: "POST",
    body: JSON.stringify({ astrologerId, questionText, category }),
  });
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "Client" | "Astrologer";
  body: string;
  createdAt: string;
  sender?: { id: string; name: string };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "Client" | "Astrologer";
  body: string;
  createdAt: string;
  sender?: { id: string; name: string };
}

export interface ClientQuestion {
  id: string;
  questionText: string;
  category?: string;
  status: string;
  pricePaise: number;
  createdAt: string;
  lastMessage?: ChatMessage | null;
  astrologer?: { id: string; user: { id: string; name: string } } | null;
}

export interface QuestionPaymentIntent {
  id: string;
  amountPaise: number;
  currency: string;
}

export type SendQuestionMessageResult =
  | { requiresPayment: true; payment: QuestionPaymentIntent; question: ClientQuestion }
  | { requiresPayment: false; message: ChatMessage; question: ClientQuestion };

export interface CompletedPayment {
  id: string;
  amountPaise: number;
  currency: string;
  status: string;
}

export function listMyQuestions(): Promise<{
  questions: ClientQuestion[];
  total: number;
}> {
  return request("/questions");
}

export function fetchQuestionMessages(
  id: string,
): Promise<{ question: ClientQuestion; messages: ChatMessage[] }> {
  return request(`/questions/${id}/messages`);
}

export function sendQuestionMessage(
  id: string,
  body: string,
): Promise<SendQuestionMessageResult> {
  return request(`/questions/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function completePayment(
  paymentId: string,
): Promise<{
  payment: CompletedPayment;
  message: ChatMessage | null;
  question: ClientQuestion | null;
}> {
  return request(`/payments/${paymentId}/complete`, { method: "POST" });
}

export interface ClientBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  pricePaise: number;
  meetingLink?: string | null;
  clientNote?: string | null;
  cancellationReason?: string | null;
  astrologer?: { id: string; slug?: string | null; user: { id: string; name: string } } | null;
}

export interface MyBookingsResult {
  bookings: ClientBooking[];
  total: number;
  counts: {
    all: number;
    Confirmed: number;
    Completed: number;
    Cancelled: number;
    Pending: number;
  };
}

export function listMyBookings(): Promise<MyBookingsResult> {
  return request("/bookings?limit=100");
}

export function cancelBooking(id: string, reason?: string): Promise<{ booking: ClientBooking }> {
  return request(`/bookings/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function formatPrice(paise: number | null | undefined): string {
  if (typeof paise !== "number" || !Number.isFinite(paise) || paise < 0) return "";
  const amount = paise / 100;
  const formatted =
    amount % 1 === 0
      ? amount.toLocaleString("en-IN")
      : amount.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  return `\u20B9${formatted}`;
}