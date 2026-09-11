import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Breadcrumbs } from "../lib/breadcrumbs";
import {
  completePayment,
  formatPrice,
  sendQuestionMessage,
  type ClientQuestion,
} from "../lib/client";
import { useAuth, type UseAuth } from "../lib/useAuth";
import { AuthPanel } from "../lib/AuthPanel";
import { PayConfirm } from "../lib/pay";
import { connectQuestionSocket } from "../lib/ws";
import { useStore } from "../lib/store";

export const Route = createFileRoute("/my/questions")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...search,
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  head: () => ({
    meta: [{ title: "My Questions | Supertalks" }],
  }),
  component: MyQuestions,
});

const CLOSED_STATUSES = ["Rejected", "Refunded"];

function MyQuestions() {
  const auth = useAuth();

  if (!auth.user) {
    return (
      <AuthPanel
        title="My Questions"
        note="Sign in (or create a free account) to view all your question chats."
        onAuthenticated={auth.applyAuth}
      />
    );
  }

  return <QuestionsHome auth={auth} />;
}

function QuestionsHome({ auth }: { auth: UseAuth }) {
  const navigate = useNavigate();
  const { thread } = Route.useSearch();
  const questions = useStore((s) => s.questions);
  const loading = useStore((s) => s.questionsLoading && !s.questionsLoaded);
  const loadError = useStore((s) => s.questionsError);
  const [activeId, setActiveId] = useState<string | null>(null);
  const messages = useStore((s) => (activeId ? s.messagesByQuestion[activeId] : undefined)) ?? [];
  const threadLoading = useStore((s) => (activeId ? !!s.threadsLoading[activeId] : false));
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingPay, setPendingPay] = useState<{ paymentId: string; amountPaise: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const replyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void useStore.getState().loadQuestions();
  }, []);

  // Open a specific conversation when arriving with ?thread=<questionId>
  // (e.g. clicking a recent question from the dashboard).
  useEffect(() => {
    if (!thread || loading || activeId === thread) return;
    const target = questions.find((q) => q.id === thread);
    if (!target) return;
    openThread(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, questions, loading, activeId]);

  const active = questions.find((q) => q.id === activeId) ?? null;

  const openThread = (q: ClientQuestion, go = true) => {
    if (go) setActiveId(q.id);
    setReply("");
    useStore
      .getState()
      .openThread(q.id)
      .catch((err) =>
        setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not open chat." })
      );
  };

  useEffect(() => {
    if (!activeId) return;
    const disconnect = connectQuestionSocket(activeId, {
      onMessage: ({ questionId, message, question }) => {
        useStore.getState().appendMessage(questionId, message);
        useStore.getState().updateQuestionStatus(questionId, question.status);
      },
      onQuestionUpdate: ({ questionId, status }) =>
        useStore.getState().updateQuestionStatus(questionId, status),
    });
    return () => disconnect();
  }, [activeId]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !reply.trim()) return;
    setSending(true);
    setBanner(null);
    try {
      const result = await sendQuestionMessage(active.id, reply.trim());
      if (result.requiresPayment) {
        setPendingPay({ paymentId: result.payment.id, amountPaise: result.payment.amountPaise });
        return;
      }
      useStore.getState().appendMessage(active.id, result.message);
      useStore.getState().updateQuestionStatus(result.question.id, result.question.status);
      setReply("");
    } catch (err) {
      setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not send your message." });
    } finally {
      setSending(false);
    }
  };

  const confirmPayment = async () => {
    if (!pendingPay || !active) return;
    setPaying(true);
    try {
      const result = await completePayment(pendingPay.paymentId);
      setPendingPay(null);
      if (result.message) useStore.getState().appendMessage(active.id, result.message);
      if (result.question) {
        useStore.getState().updateQuestionStatus(result.question.id, result.question.status);
      }
      setReply("");
      replyRef.current?.focus();
    } catch (err) {
      setBanner({ ok: false, message: err instanceof Error ? err.message : "Payment could not be completed." });
    } finally {
      setPaying(false);
    }
  };

  const threadClosed = active ? CLOSED_STATUSES.includes(active.status) : false;

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <Breadcrumbs />
        <header className="wx-my-head">
          <div>
            <h1>My Questions</h1>
            <p className="wx-book-note">Signed in as {auth.user!.email}.</p>
            {/* <p className="wx-book-note">
              <Link className="wx-linkbtn" to="/my/bookings">
                View your bookings →
              </Link>
            </p> */}
          </div>
          <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
            Sign out
          </button>
        </header>

        {active ? (
          <div className="wx-chat">
            <p className="wx-book-note">
              <button
                type="button"
                className="wx-linkbtn"
                onClick={() => {
                  setActiveId(null);
                  navigate({ to: "/my/questions", search: { thread: undefined } });
                }}
              >
                ← All conversations
              </button>
            </p>
            <div className="wx-chat-question">
              <p className="wx-chat-question-text">{active.questionText}</p>
              <p className="wx-book-note">
                {active.status}
                {active.astrologer?.user.name ? ` · ${active.astrologer.user.name}` : ""}
                {active.category ? ` · ${active.category}` : ""}
                {formatPrice(active.pricePaise) ? ` · ${formatPrice(active.pricePaise)}/message` : ""}
              </p>
            </div>
            <div className="wx-chat-thread">
              {threadLoading && messages.length === 0 ? (
                <p className="wx-book-note">Loading conversation…</p>
              ) : messages.length === 0 ? (
                <p className="wx-book-note">No messages yet. Send a question to start (paid per message).</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === "Client";
                  return (
                    <div key={m.id} className={`wx-msg${mine ? " wx-msg-mine" : " wx-msg-theirs"}`}>
                      <div className="wx-msg-bubble">
                        {!mine && m.sender?.name ? <p className="wx-msg-name">{m.sender.name}</p> : null}
                        <p className="wx-msg-body">{m.body}</p>
                        <p className="wx-msg-time">{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {threadClosed ? (
              <p className="wx-chat-note">This conversation is closed.</p>
            ) : (
              <form className="wx-chat-reply" onSubmit={handleSend}>
                <input
                  ref={replyRef}
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a question (paid per message)…"
                  maxLength={2000}
                />
                <button type="submit" className="wx-btn wx-btn-primary" disabled={sending || !reply.trim()}>
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            {loading ? (
              <p className="wx-book-note">Loading your questions…</p>
            ) : loadError ? (
              <p className="wx-book-danger">{loadError}</p>
            ) : questions.length === 0 ? (
              <p className="wx-book-note">You haven't asked any questions yet.</p>
            ) : (
              <div className="wx-my-questions">
                {questions.map((q) => (
                  <button type="button" key={q.id} className="wx-my-question" onClick={() => openThread(q)}>
                    <p className="wx-my-question-text">{q.questionText}</p>
                    <p className="wx-my-question-meta">
                      {q.astrologer?.user.name ? `${q.astrologer.user.name} · ` : ""}
                      {q.status}
                      {q.lastMessage
                        ? ` · ${q.lastMessage.senderRole === "Astrologer" ? "Astrologer" : "You"}: ${q.lastMessage.body.slice(0, 60)}`
                        : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {banner ? (
          <p className={banner.ok ? "wx-book-ok" : "wx-book-danger"}>{banner.message}</p>
        ) : null}

        <PayConfirm
          open={pendingPay !== null}
          amountPaise={pendingPay?.amountPaise ?? 0}
          paying={paying}
          onConfirm={confirmPayment}
          onCancel={() => setPendingPay(null)}
        />
      </div>
    </main>
  );
}