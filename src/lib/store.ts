import { create } from "zustand";
import {
  clearAuth,
  fetchMe,
  fetchQuestionMessages,
  getAccessToken,
  listMyBookings,
  listMyQuestions,
  persistAuth,
  type AuthResponse,
  type ChatMessage,
  type ClientBooking,
  type ClientQuestion,
  type PublicUser,
} from "./client";

interface AppState {
  token: string | null;
  user: PublicUser | null;
  authHydrated: boolean;

  bookings: ClientBooking[];
  bookingsLoading: boolean;
  bookingsLoaded: boolean;
  bookingsError: string | null;

  questions: ClientQuestion[];
  questionsLoading: boolean;
  questionsLoaded: boolean;
  questionsError: string | null;

  messagesByQuestion: Record<string, ChatMessage[]>;
  threadsLoading: Record<string, boolean>;

  hydrate: () => Promise<void>;
  applyAuth: (res: AuthResponse) => void;
  signOut: () => void;
  loadBookings: (force?: boolean) => Promise<void>;
  loadQuestions: (force?: boolean) => Promise<void>;
  openThread: (questionId: string) => Promise<void>;
  appendMessage: (questionId: string, message: ChatMessage) => void;
  updateQuestionStatus: (questionId: string, status: string) => void;
  resetData: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: getAccessToken(),
  user: null,
  authHydrated: false,

  bookings: [],
  bookingsLoading: false,
  bookingsLoaded: false,
  bookingsError: null,

  questions: [],
  questionsLoading: false,
  questionsLoaded: false,
  questionsError: null,

  messagesByQuestion: {},
  threadsLoading: {},

  hydrate: async () => {
    if (get().authHydrated) return;
    const token = get().token;
    if (!token) {
      set({ user: null, authHydrated: true });
      return;
    }
    try {
      const { user } = await fetchMe();
      set({ user, authHydrated: true });
    } catch {
      clearAuth();
      set({ token: null, user: null, authHydrated: true });
      get().resetData();
    }
  },

  applyAuth: (res) => {
    persistAuth(res);
    set({ token: res.accessToken, user: res.user, authHydrated: true });
  },

  signOut: () => {
    clearAuth();
    set({ token: null, user: null, authHydrated: true });
    get().resetData();
  },

  loadBookings: async (force = false) => {
    if (!get().token) return;
    if (get().bookingsLoaded && !force) return;
    set({ bookingsLoading: true, bookingsError: null });
    try {
      const { bookings } = await listMyBookings();
      set({ bookings, bookingsLoaded: true });
    } catch (err) {
      set({ bookingsError: err instanceof Error ? err.message : "Could not load your bookings." });
    } finally {
      set({ bookingsLoading: false });
    }
  },

  loadQuestions: async (force = false) => {
    if (!get().token) return;
    if (get().questionsLoaded && !force) return;
    set({ questionsLoading: true, questionsError: null });
    try {
      const { questions } = await listMyQuestions();
      set({ questions, questionsLoaded: true });
    } catch (err) {
      set({ questionsError: err instanceof Error ? err.message : "Could not load your questions." });
    } finally {
      set({ questionsLoading: false });
    }
  },

  openThread: async (questionId) => {
    if (get().threadsLoading[questionId]) return;
    set((s) => ({ threadsLoading: { ...s.threadsLoading, [questionId]: true } }));
    try {
      const { question, messages } = await fetchQuestionMessages(questionId);
      set((s) => ({
        messagesByQuestion: { ...s.messagesByQuestion, [questionId]: messages },
      }));
      get().updateQuestionStatus(question.id, question.status);
    } finally {
      set((s) => {
        const next = { ...s.threadsLoading };
        delete next[questionId];
        return { threadsLoading: next };
      });
    }
  },

  appendMessage: (questionId, message) => {
    set((s) => {
      const existing = s.messagesByQuestion[questionId] ?? [];
      if (existing.some((m) => m.id === message.id)) return {};
      return {
        messagesByQuestion: { ...s.messagesByQuestion, [questionId]: [...existing, message] },
      };
    });
  },

  updateQuestionStatus: (questionId, status) => {
    set((s) => ({
      questions: s.questions.map((it) =>
        it.id === questionId ? { ...it, status } : it,
      ),
    }));
  },

  resetData: () =>
    set({
      bookings: [],
      bookingsLoading: false,
      bookingsLoaded: false,
      bookingsError: null,
      questions: [],
      questionsLoading: false,
      questionsLoaded: false,
      questionsError: null,
      messagesByQuestion: {},
      threadsLoading: {},
    }),
}));