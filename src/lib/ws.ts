import { getAccessToken, type ChatMessage } from "./client";

// Client-bundled code: never touch `process` directly (not defined in the browser).
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
export const WS_URL = env.BUN_PUBLIC_WS_URL ?? "ws://localhost:3000";

export type RealtimeEvent =
  | {
      type: "connected";
      userId: string;
      role: string;
      questionId: string | null;
    }
  | {
      type: "question.message";
      questionId: string;
      message: ChatMessage;
      question: { id: string; status: string };
    }
  | {
      type: "question.updated";
      questionId: string;
      question: { id: string; status: string };
    };

export interface QuestionSocketHandlers {
  onMessage?: (payload: {
    questionId: string;
    message: ChatMessage;
    question: { id: string; status: string };
  }) => void;
  onQuestionUpdate?: (payload: { questionId: string; status: string }) => void;
}

export function connectQuestionSocket(
  questionId: string,
  handlers: QuestionSocketHandlers,
): () => void {
  const token = getAccessToken();
  if (!token) return () => {};

  let ws: WebSocket | null = null;
  let closed = false;
  let retry: number | null = null;
  let attempts = 0;

  const connect = () => {
    ws = new WebSocket(
      `${WS_URL}/ws?token=${encodeURIComponent(token)}&questionId=${encodeURIComponent(questionId)}`,
    );

    ws.onopen = () => {
      attempts = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as RealtimeEvent;
        if (data.type === "question.message" && data.questionId === questionId) {
          handlers.onMessage?.(data);
        } else if (data.type === "question.updated" && data.questionId === questionId) {
          handlers.onQuestionUpdate?.({
            questionId: data.questionId,
            status: data.question.status,
          });
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onclose = () => {
      if (closed) return;
      const delay = Math.min(1000 * 2 ** attempts, 10000);
      attempts += 1;
      retry = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return () => {
    closed = true;
    if (retry !== null) window.clearTimeout(retry);
    ws?.close();
  };
}