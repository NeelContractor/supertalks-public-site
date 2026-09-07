import { useEffect, useState } from "react";

// Client-bundled code: never touch `process` directly (not defined in the browser).
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
export const API_BASE = env.BACKEND_URL ?? "http://localhost:3000";

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
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

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
          setToken(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const applyAuth = (res: AuthResponse) => {
    persistAuth(res);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const signOut = () => {
    clearAuth();
    setToken(null);
    setUser(null);
  };

  return { token, user, applyAuth, signOut };
}

export type UseAuth = ReturnType<typeof useAuth>;