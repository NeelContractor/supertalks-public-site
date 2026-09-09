import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  completePayment,
  fetchQuestionMessages,
  formatPrice,
  listMyQuestions,
  sendQuestionMessage,
  signin,
  signup,
  useAuth,
  type AuthResponse,
  type ChatMessage,
  type ClientQuestion,
  type UseAuth,
} from "../lib/client";
import { PayConfirm } from "../lib/pay";
import { connectQuestionSocket } from "../lib/ws";

export const Route = createFileRoute("/my/questions")({
  head: () => ({
    meta: [{ title: "My Questions | Supertalks" }],
  }),
  component: MyQuestions,
});

const CLOSED_STATUSES = ["Rejected", "Refunded"];

function MyQuestions() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthPanel onAuthenticated={auth.applyAuth} />;
  }

  return <QuestionsHome auth={auth} />;
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
        <h1>My Questions</h1>
        <p className="wx-book-note">Sign in (or create a free account) to view all your question chats.</p>
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

function QuestionsHome({ auth }: { auth: UseAuth }) {
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingPay, setPendingPay] = useState<{ paymentId: string; amountPaise: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const replyRef = useRef<HTMLInputElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    setLoadError(null);
    listMyQuestions()
      .then(({ questions }) => setQuestions(questions))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Could not load your questions.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = questions.find((q) => q.id === activeId) ?? null;

  const upsertMessage = (message: ChatMessage) => {
    if (seenIds.current.has(message.id)) return;
    seenIds.current.add(message.id);
    setMessages((prev) => [...prev, message]);
  };

  const applyThreadStatus = (questionId: string, status: string) => {
    setQuestions((prev) =>
      prev.map((it) => (it.id === questionId ? { ...it, status } : it))
    );
  };

  const fetchThread = (q: ClientQuestion) => {
    setActiveId(q.id);
    setMessages([]);
    seenIds.current = new Set();
    setReply("");
    setThreadLoading(true);
    fetchQuestionMessages(q.id)
      .then(({ question, messages }) => {
        seenIds.current = new Set(messages.map((m) => m.id));
        setMessages(messages);
        applyThreadStatus(question.id, question.status);
      })
      .catch((err) => setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not open chat." }))
      .finally(() => setThreadLoading(false));
  };

  useEffect(() => {
    if (!activeId) return;
    const disconnect = connectQuestionSocket(activeId, {
      onMessage: ({ questionId, message, question }) => {
        upsertMessage(message);
        applyThreadStatus(questionId, question.status);
      },
      onQuestionUpdate: ({ questionId, status }) => applyThreadStatus(questionId, status),
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
      upsertMessage(result.message);
      setReply("");
      setQuestions((prev) =>
        prev.map((it) => (it.id === result.question.id ? { ...it, status: result.question.status } : it))
      );
    } catch (err) {
      setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not send your message." });
    } finally {
      setSending(false);
    }
  };

  const confirmPayment = async () => {
    if (!pendingPay) return;
    setPaying(true);
    try {
      const result = await completePayment(pendingPay.paymentId);
      setPendingPay(null);
      if (result.message) upsertMessage(result.message!);
      if (result.question) {
        setQuestions((prev) =>
          prev.map((it) => (it.id === result.question!.id ? { ...it, status: result.question!.status } : it))
        );
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
        <header className="wx-my-head">
          <div>
            <h1>My Questions</h1>
            <p className="wx-book-note">Signed in as {auth.user!.email}.</p>
            <p className="wx-book-note">
              <Link className="wx-linkbtn" to="/my/bookings">
                View your bookings →
              </Link>
            </p>
          </div>
          <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
            Sign out
          </button>
        </header>

        {active ? (
          <div className="wx-chat">
            <p className="wx-book-note">
              <button type="button" className="wx-linkbtn" onClick={() => setActiveId(null)}>
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
            <p className="wx-book-note">
              <Link className="wx-linkbtn" to="/">
                ← Back to browsing
              </Link>
            </p>
            {loading ? (
              <p className="wx-book-note">Loading your questions…</p>
            ) : loadError ? (
              <p className="wx-book-danger">{loadError}</p>
            ) : questions.length === 0 ? (
              <p className="wx-book-note">You haven't asked any questions yet.</p>
            ) : (
              <div className="wx-my-questions">
                {questions.map((q) => (
                  <button type="button" key={q.id} className="wx-my-question" onClick={() => fetchThread(q)}>
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