import React, { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs } from "../lib/breadcrumbs";
import {
  formatPrice,
  listMyBookings,
  listMyQuestions,
  signin,
  signup,
  useAuth,
  type AuthResponse,
  type ClientBooking,
  type ClientQuestion,
  type UseAuth,
} from "../lib/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "My Dashboard | Supertalks" }],
  }),
  component: Dashboard,
});

const ACTIVE_STATUSES = ["PendingPayment", "Confirmed", "Rescheduled"];

function Dashboard() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthPanel onAuthenticated={auth.applyAuth} />;
  }

  return <DashboardHome auth={auth} />;
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
        <Breadcrumbs />
        <h1>My Dashboard</h1>
        <p className="wx-book-note">Sign in (or create a free account) to see your bookings and questions in one place.</p>
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

function DashboardHome({ auth }: { auth: UseAuth }) {
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMyQuestions(), listMyBookings()])
      .then(([q, b]) => {
        if (cancelled) return;
        setQuestions(q.questions);
        setBookings(b.bookings);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load your dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const recentQuestions = questions.slice(0, 5);

  return (
    <main className="wx-page my-questions-page">
      <div className="wx-my-panel">
        <Breadcrumbs />
        <header className="wx-my-head">
          <div>
            <h1>My Dashboard</h1>
            <p className="wx-book-note">Signed in as {auth.user!.email}.</p>
          </div>
          <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
            Sign out
          </button>
        </header>

        {loading ? (
          <p className="wx-book-note">Loading your dashboard…</p>
        ) : loadError ? (
          <p className="wx-book-danger">{loadError}</p>
        ) : (
          <div className="wx-dash-grid">
            <section className="wx-dash-card">
              <header className="wx-dash-card-head">
                <h2>Upcoming Bookings</h2>
                <Link className="wx-linkbtn" to="/my/bookings">
                  View all bookings →
                </Link>
              </header>
              {upcoming.length === 0 ? (
                <p className="wx-book-note">No upcoming sessions. Book a slot from any astrologer's page.</p>
              ) : (
                <ul className="wx-dash-list">
                  {upcoming.map((b) => (
                    <li key={b.id} className="wx-dash-item">
                      <p className="wx-my-booking-when">
                        {new Date(b.startAt).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="wx-my-question-meta">
                        {b.astrologer?.user.name ? `With ${b.astrologer.user.name} · ` : ""}
                        {formatPrice(b.pricePaise) ?? ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="wx-dash-card">
              <header className="wx-dash-card-head">
                <h2>Recent Questions</h2>
                <Link className="wx-linkbtn" to="/my/questions" search={{ thread: undefined }}>
                  View all questions →
                </Link>
              </header>
              {recentQuestions.length === 0 ? (
                <p className="wx-book-note">No questions yet. Ask a question from any astrologer's page.</p>
              ) : (
                <ul className="wx-dash-list">
                  {recentQuestions.map((q) => (
                    <li key={q.id}>
                      <Link
                        to="/my/questions"
                        search={{ thread: q.id }}
                        className="wx-dash-item wx-dash-chat"
                      >
                        <p className="wx-my-question-text">{q.questionText}</p>
                        <p className="wx-my-question-meta">
                          {q.astrologer?.user.name ? `${q.astrologer.user.name} · ` : ""}
                          {q.status}
                          {q.lastMessage
                            ? ` · ${q.lastMessage.senderRole === "Astrologer" ? "Astrologer" : "You"}: ${q.lastMessage.body.slice(0, 50)}`
                            : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}