import React, { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs } from "../lib/breadcrumbs";
import { formatPrice } from "../lib/client";
import { useAuth, type UseAuth } from "../lib/useAuth";
import { AuthPanel } from "../lib/AuthPanel";
import { useStore } from "../lib/store";

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
    return (
      <AuthPanel
        title="My Dashboard"
        note="Sign in (or create a free account) to see your bookings and questions in one place."
        onAuthenticated={auth.applyAuth}
      />
    );
  }

  return <DashboardHome auth={auth} />;
}

function DashboardHome({ auth }: { auth: UseAuth }) {
  const questions = useStore((s) => s.questions);
  const bookings = useStore((s) => s.bookings);
  const loading = useStore(
    (s) => (s.bookingsLoading && !s.bookingsLoaded) || (s.questionsLoading && !s.questionsLoaded),
  );
  const loadError = useStore((s) => s.bookingsError ?? s.questionsError);

  useEffect(() => {
    void useStore.getState().loadBookings();
    void useStore.getState().loadQuestions();
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
