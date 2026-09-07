import React, { useEffect, useRef, useState } from "react";
import type { SiteDocument, SiteSectionDoc } from "../types";
import {
  askQuestion,
  completePayment,
  createBooking,
  fetchOpenSlots,
  fetchQuestionMessages,
  formatPrice,
  listMyQuestions,
  sendQuestionMessage,
  useAuth,
  type ChatMessage,
  type ClientQuestion,
  type OpenSlot,
  type UseAuth,
} from "./client";
import { AuthModal } from "./AuthModal";
import { PayConfirm } from "./pay";

const DISPLAY_STACKS: Record<string, string> = {
  serif: '"eschaton", Georgia, serif',
  sans: '"futura-lt-w01-book", Futura, "Century Gothic", system-ui, sans-serif',
};

const BODY_STACKS: Record<string, string> = {
  sans: '"futura-lt-w01-book", Futura, "Century Gothic", system-ui, sans-serif',
  serif: '"eschaton", Georgia, serif',
};

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function num(value: unknown, fallback: number): number | string {
  return typeof value === "number" ? value : fallback;
}

export function designVars(design: Record<string, unknown>): React.CSSProperties {
  const dv = design ?? {};
  const displayFont = str(dv["displayFont"], "serif");
  const bodyFont = str(dv["bodyFont"], "sans");
  return {
    "--site-maroon": str(dv["primaryColor"], "#771609"),
    "--site-pink": str(dv["panelColor"], "#fff4f3"),
    "--site-white": str(dv["backgroundColor"], "#fffcfc"),
    "--site-dark": str(dv["darkColor"], "#253039"),
    "--site-display": DISPLAY_STACKS[displayFont] ?? DISPLAY_STACKS["serif"],
    "--site-body": BODY_STACKS[bodyFont] ?? BODY_STACKS["sans"],
    "--site-scale": num(dv["scale"], 1) as number,
  } as React.CSSProperties;
}

function propsOf(section: SiteSectionDoc): Record<string, unknown> {
  return section.props ?? {};
}

function p(props: Record<string, unknown>, key: string, fallback = ""): string {
  const value = props[key];
  return value != null ? String(value) : fallback;
}

function itemsOf(props: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const value = props[key];
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === "object") as Array<
    Record<string, unknown>
  >;
  return [];
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M180 138.25V151H20v-12.75h160z" />
      <path d="M180 49v12.75H20V49h160z" />
      <path d="M180 93.625v12.75H20v-12.75h160z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" strokeWidth="20" aria-hidden="true">
      <path d="M40 100h120" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="34" height="44" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 1 C35 12 36 27 26 42 C32 32 34 18 20 1 Z" />
      <path d="M20 1 C10 12 4 26 10 38 C3 26 6 12 20 1 Z" />
    </svg>
  );
}

function BloomIcon() {
  return (
    <svg width="44" height="34" viewBox="0 0 50 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="18" cy="20" rx="17" ry="14" />
      <ellipse cx="32" cy="20" rx="17" ry="14" />
    </svg>
  );
}

function TeardropIcon() {
  return (
    <svg width="36" height="40" viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 1 C31 16 38 26 38 31 C38 38 31 43 20 43 C9 43 2 38 2 31 C2 26 9 16 20 1 Z" />
    </svg>
  );
}

function ApproachIcon({ name }: { name: string }) {
  switch (name) {
    case "bloom":
      return <BloomIcon />;
    case "teardrop":
      return <TeardropIcon />;
    case "leaf":
    default:
      return <LeafIcon />;
  }
}

export interface SiteClientInfo {
  slug: string;
  astrologerId?: string;
  questionPricePaise?: number;
  callPricePerSlotPaise?: number;
  slotDurationMinutes?: number;
  isAcceptingQuestions?: boolean;
  isAcceptingBookings?: boolean;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function upcomingDays(count: number): { key: string; label: string }[] {
  const now = new Date();
  const days: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      key: dateKey(d),
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
    });
  }
  return days;
}

function formatTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return time;
}

interface SectionShellProps {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

function SectionShell({ section, edit, selected, onSelect, children }: SectionShellProps) {
  const anchorId = section.id === "hero" ? "top" : section.id;
  return (
    <section
      id={anchorId}
      className="wx-page-section st-section"
      data-st-section-id={section.id}
      data-st-name={section.name}
      data-st-selected={edit && selected ? "true" : undefined}
      onClick={edit ? () => onSelect(section.id) : undefined}
    >
      {children}
    </section>
  );
}

function HeroSection({
  section,
  navLinks,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  navLinks: { label: string; href: string }[];
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const props = propsOf(section);
  const siteName = p(props, "siteName", "My Site");
  const logo = p(props, "logo");
  const logoAlt = p(props, "logoAlt", siteName);

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-hero">
        <header className="wx-header">
          <a href="#top" aria-label="Home">
            {logo ? <img src={logo} alt={logoAlt} /> : <span className="wx-site-name">{siteName}</span>}
          </a>
          <button
            type="button"
            className="wx-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
        </header>

        <div className="wx-hero-copy">
          <h2 style={{ whiteSpace: "pre-line" }}>{p(props, "heading", "Welcome")}</h2>
          <p className="wx-hero-sub">{p(props, "subtitle")}</p>
          <a className="wx-btn wx-btn-primary" href={p(props, "ctaLink", "#about")}>
            {p(props, "ctaLabel", "Get Started")}
          </a>
        </div>

        <div className="wx-hero-media">
          <img src={p(props, "image")} alt={p(props, "imageAlt", "")} />
        </div>
      </div>

      {menuOpen ? (
        <>
          <div className="wx-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="wx-menu-panel" role="dialog" aria-modal="true" aria-label="Main navigation">
            <div className="wx-menu-panel-inner">
              <button
                type="button"
                className="wx-menu-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
              >
                <CloseIcon />
              </button>
              <nav className="wx-menu-links">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </>
      ) : null}
    </SectionShell>
  );
}

function QuoteSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-words">
        <h3 className="wx-eyebrow">{p(props, "eyebrow")}</h3>
        <blockquote>
          <p>{p(props, "quote")}</p>
        </blockquote>
      </div>
    </SectionShell>
  );
}

function AboutSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-about">
        <h2>{p(props, "heading", "About")}</h2>
        <p className="wx-body">{p(props, "body")}</p>
        <a className="wx-btn wx-btn-outline" href={p(props, "buttonLink", "#about")}>
          {p(props, "buttonLabel", "Learn More")}
        </a>
      </div>
    </SectionShell>
  );
}

function ImageBandSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-scene" aria-hidden="true">
        <img src={p(props, "image")} alt={p(props, "alt", "")} />
      </div>
    </SectionShell>
  );
}

function ServicesSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-services">
        <div className="wx-services-grid">
          <div>
            <h2>{p(props, "heading", "Services")}</h2>
          </div>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <article>
                <span className="wx-rule" />
                <h3>{p(item, "title")}</h3>
                <p>{p(item, "body")}</p>
              </article>
              <div aria-hidden="true" />
            </React.Fragment>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function ApproachSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-approach">
        <h2>{p(props, "heading", "My Approach")}</h2>
        <div className="wx-approach-list">
          {items.map((item, i) => (
            <div className="wx-approach-row" key={i}>
              {item["icon"] ? (
                <ApproachIcon name={String(item["icon"])} />
              ) : (
                <span className="wx-approach-mark">{i + 1}</span>
              )}
              <h3>{p(item, "title")}</h3>
              <p>{p(item, "body")}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function FeedbackSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-feedback">
        <h2>{p(props, "heading", "Client Feedback")}</h2>
        <div className="wx-feedback-grid">
          {items.map((item, i) => (
            <div className="wx-feedback-card" key={i}>
              <blockquote>
                <p>{p(item, "quote")}</p>
              </blockquote>
              <cite>{p(item, "author")}</cite>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function FaqSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-faq">
        <h2>{p(props, "heading", "Frequently Asked Questions")}</h2>
        <div className="wx-faq-grid">
          {items.map((item, i) => (
            <div className="wx-faq-row" key={i}>
              <h3>{p(item, "question")}</h3>
              <p>{p(item, "answer")}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function BookingSection({
  section,
  edit,
  selected,
  onSelect,
  client,
  auth,
  onNeedAuth,
  authNonce,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  client?: SiteClientInfo;
  auth: UseAuth;
  onNeedAuth: () => void;
  authNonce: number;
}) {
  const props = propsOf(section);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<string | null>(null);
  const bookRef = useRef<((startAt: string) => Promise<void>) | null>(null);

  const days = upcomingDays(14);

  useEffect(() => {
    if (edit) return;
    const slug = client?.slug;
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchOpenSlots(slug, date)
      .then(({ slots }) => {
        if (!cancelled) setSlots(slots);
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          setLoadError(err instanceof Error ? err.message : "Could not load slots");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, edit, client?.slug]);

  const book = async (startAt: string) => {
    if (!client?.astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await createBooking(client.astrologerId, startAt, crypto.randomUUID());
      setStatus({ ok: true, message: "Session booked! Complete payment to confirm your slot." });
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Booking failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  bookRef.current = book;

  useEffect(() => {
    const startAt = pendingRef.current;
    if (startAt && auth.token) {
      pendingRef.current = null;
      void bookRef.current?.(startAt);
    }
  }, [authNonce, auth.token]);

  const handleSelect = (slot: OpenSlot) => {
    if (!auth.token || !client?.astrologerId) {
      pendingRef.current = slot.startAt;
      onNeedAuth();
      return;
    }
    void book(slot.startAt);
  };

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-book">
        <div className="wx-book-head">
          <h2>{p(props, "heading", "Book a Session")}</h2>
          <p>{p(props, "subtitle")}</p>
        </div>
        {edit ? null : (
          <>
            {client?.isAcceptingBookings === false ? (
              <p className="wx-book-note">Bookings are currently paused. Please check back soon.</p>
            ) : (
              <>
                <div className="wx-book-days">
                  {days.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      className={day.key === date ? "is-active" : ""}
                      onClick={() => setDate(day.key)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="wx-book-slots">
                  {loading ? (
                    <p className="wx-book-note">Loading slots…</p>
                  ) : loadError ? (
                    <p className="wx-book-danger">{loadError}</p>
                  ) : slots.length === 0 ? (
                    <p className="wx-book-note">No open slots on this day. Try another date.</p>
                  ) : (
                    <>
                      <p className="wx-book-note">
                        {client?.callPricePerSlotPaise != null ? `${formatPrice(client.callPricePerSlotPaise)} ` : ""}
                        {client?.slotDurationMinutes ? `· ${client.slotDurationMinutes} min call` : "call"}
                      </p>
                      <div className="wx-slot-grid">
                        {slots.map((slot) => (
                          <button
                            key={slot.startAt}
                            type="button"
                            className="wx-slot"
                            disabled={submitting}
                            onClick={() => handleSelect(slot)}
                          >
                            {formatTime(slot.startAt)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            {status ? (
              <p className={status.ok ? "wx-book-ok" : "wx-book-danger"}>{status.message}</p>
            ) : null}
            <p className="wx-book-note">
              {auth.user ? (
                <>
                  Signed in as {auth.user.email}.{" "}
                  <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
                    Sign out
                  </button>
                  <br />
                  <a className="wx-linkbtn" href="/my/bookings">
                    Open all your bookings in full page →
                  </a>
                </>
              ) : (
                "Sign in (or create a free account) to book a slot."
              )}
            </p>
          </>
        )}
      </div>
    </SectionShell>
  );
}

function QuestionSection({
  section,
  edit,
  selected,
  onSelect,
  client,
  auth,
  onNeedAuth,
  authNonce,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  client?: SiteClientInfo;
  auth: UseAuth;
  onNeedAuth: () => void;
  authNonce: number;
}) {
  const props = propsOf(section);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<{ questionText: string; category: string } | null>(null);
  const askRef = useRef<((body: { questionText: string; category: string }) => Promise<void>) | null>(null);

  const [tab, setTab] = useState<"ask" | "mine">("ask");
  const [myQuestions, setMyQuestions] = useState<ClientQuestion[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myLoaded, setMyLoaded] = useState(false);
  const [activeThread, setActiveThread] = useState<ClientQuestion | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [pendingPay, setPendingPay] = useState<{ paymentId: string; amountPaise: number } | null>(null);
  const [paying, setPaying] = useState(false);

  const ask = async (body: { questionText: string; category: string }) => {
    if (!client?.astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await askQuestion(client.astrologerId, body.questionText, body.category || "General");
      setStatus({ ok: true, message: "Question sent! You'll get a personal written answer." });
      setText("");
      setCategory("");
      setTab("mine");
      setMyLoaded(false);
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Could not send your question. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  askRef.current = ask;

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && auth.token) {
      pendingRef.current = null;
      void askRef.current?.(pending);
    }
  }, [authNonce, auth.token]);

  const handleAsk = (event: React.FormEvent) => {
    event.preventDefault();
    const body = { questionText: text.trim(), category: category.trim() };
    if (!body.questionText) return;
    if (!auth.token || !client?.astrologerId) {
      pendingRef.current = body;
      onNeedAuth();
      return;
    }
    void ask(body);
  };

  const openThread = (q: ClientQuestion) => {
    setActiveThread(q);
    setThreadMessages([]);
    setReply("");
    setThreadLoading(true);
    fetchQuestionMessages(q.id)
      .then(({ question, messages }) => {
        setThreadMessages(messages);
        setActiveThread((current) =>
          current && current.id === question.id
            ? { ...current, status: question.status }
            : current
        );
      })
      .catch((err) => {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not open this conversation." });
      })
      .finally(() => setThreadLoading(false));
  };

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeThread || !reply.trim()) return;
    setReplySending(true);
    try {
      const result = await sendQuestionMessage(activeThread.id, reply.trim());
      if (result.requiresPayment) {
        // Hold the message behind a payment prompt; the text stays in the input.
        setPendingPay({ paymentId: result.payment.id, amountPaise: result.payment.amountPaise });
        return;
      }
      setThreadMessages((prev) => [...prev, result.message]);
      setActiveThread((current) =>
        current && current.id === result.question.id
          ? { ...current, status: result.question.status }
          : current
      );
      setReply("");
      setMyLoaded(false);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not send your reply." });
    } finally {
      setReplySending(false);
    }
  };

  const confirmPayment = async () => {
    if (!pendingPay || !activeThread) return;
    setPaying(true);
    try {
      const result = await completePayment(pendingPay.paymentId);
      setPendingPay(null);
      if (result.message) setThreadMessages((prev) => [...prev, result.message!]);
      if (result.question) {
        setActiveThread((current) =>
          current && current.id === result.question!.id
            ? { ...current, status: result.question!.status }
            : current
        );
      }
      setReply("");
      setMyLoaded(false);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Payment could not be completed." });
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (tab !== "mine" || !auth.token || myLoaded) return;
    setMyLoading(true);
    listMyQuestions()
      .then(({ questions }) => {
        setMyQuestions(questions);
        setMyLoaded(true);
      })
      .catch((err) => {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not load your questions." });
      })
      .finally(() => setMyLoading(false));
  }, [tab, auth.token, myLoaded, authNonce]);

  const accepting = client?.isAcceptingQuestions !== false;
  const priceSuffix = client?.questionPricePaise != null ? ` · ${formatPrice(client.questionPricePaise)}` : "";
  const CLOSED_STATUSES = ["Rejected", "Refunded"];
  const threadClosed = activeThread ? CLOSED_STATUSES.includes(activeThread.status) : false;

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-question">
        <div className="wx-question-head">
          <h2>{p(props, "heading", "Ask a Question")}</h2>
          <p>{p(props, "subtitle")}</p>
        </div>
        {edit ? null : !accepting ? (
          <p className="wx-book-note">Questions are currently paused.</p>
        ) : (
          <>
            {activeThread ? (
              <div className="wx-chat">
                <button type="button" className="wx-linkbtn wx-chat-back" onClick={() => setActiveThread(null)}>
                  ← Back to your questions
                </button>
                <div className="wx-chat-question">
                  <p className="wx-chat-question-text">{activeThread.questionText}</p>
                  <p className="wx-book-note">
                    {activeThread.status}
                    {activeThread.category ? ` · ${activeThread.category}` : ""}
                    {client?.questionPricePaise != null
                      ? ` · ${formatPrice(client.questionPricePaise)}`
                      : ""}
                  </p>
                </div>
                <div className="wx-chat-thread">
                  {threadLoading && threadMessages.length === 0 ? (
                    <p className="wx-book-note">Loading conversation…</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="wx-book-note">No messages yet. Send a reply to start the conversation (paid per message).</p>
                  ) : (
                    threadMessages.map((m) => {
                      const mine = m.senderRole === "Client";
                      return (
                        <div key={m.id} className={`wx-msg${mine ? " wx-msg-mine" : " wx-msg-theirs"}`}>
                          <div className="wx-msg-bubble">
                            {!mine && m.sender?.name ? (
                              <p className="wx-msg-name">{m.sender.name}</p>
                            ) : null}
                            <p className="wx-msg-body">{m.body}</p>
                            <p className="wx-msg-time">
                              {new Date(m.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {threadClosed ? (
                  <p className="wx-chat-note">This conversation is closed.</p>
                ) : (
                  <form className="wx-chat-reply" onSubmit={handleSendReply}>
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type a question (paid per message)…"
                      maxLength={2000}
                    />
                    <button type="submit" className="wx-btn wx-btn-primary" disabled={replySending || !reply.trim()}>
                      {replySending ? "Sending…" : "Send"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <div className="wx-question-tabs" role="tablist">
                  <button
                    type="button"
                    className={tab === "ask" ? "is-active" : ""}
                    onClick={() => setTab("ask")}
                  >
                    Ask a Question
                  </button>
                  <button
                    type="button"
                    className={tab === "mine" ? "is-active" : ""}
                    onClick={() => setTab("mine")}
                  >
                    Your Questions{myLoaded && myQuestions.length > 0 ? ` (${myQuestions.length})` : ""}
                  </button>
                </div>

                {tab === "ask" ? (
                  <>
                    <form className="wx-question-form" onSubmit={handleAsk}>
                      <label>
                        Your question
                        <textarea
                          required
                          rows={4}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="Ask anything you'd like a personal answer to…"
                        />
                      </label>
                      <label>
                        Category
                        <input
                          type="text"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          placeholder="e.g. Career, Love, Health"
                        />
                      </label>
                      <button type="submit" className="wx-btn wx-btn-primary" disabled={submitting}>
                        {submitting ? "Sending…" : `${p(props, "buttonLabel", "Ask Question")}${priceSuffix}`}
                      </button>
                    </form>
                  </>
                ) : !auth.user ? (
                  <div className="wx-book-note">
                    <p>Sign in (or create a free account) to see your questions.</p>
                    <button type="button" className="wx-linkbtn" onClick={onNeedAuth}>
                      Sign in
                    </button>
                  </div>
                ) : myLoading ? (
                  <p className="wx-book-note">Loading your questions…</p>
                ) : myQuestions.length === 0 ? (
                  <p className="wx-book-note">You haven't asked any questions yet.</p>
                ) : (
                  <div className="wx-my-questions">
                    <p className="wx-book-note">
                      <a className="wx-linkbtn" href="/my/questions">
                        Open all your conversations in full page →
                      </a>
                    </p>
                    {myQuestions.map((q) => (
                      <button type="button" key={q.id} className="wx-my-question" onClick={() => openThread(q)}>
                        <p className="wx-my-question-text">{q.questionText}</p>
                        <p className="wx-my-question-meta">
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
            {status ? (
              <p className={status.ok ? "wx-book-ok" : "wx-book-danger"}>{status.message}</p>
            ) : null}
            <p className="wx-book-note">
              {auth.user ? (
                <>
                  Signed in as {auth.user.email}.{" "}
                  <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
                    Sign out
                  </button>
                </>
              ) : (
                "Sign in (or create a free account) to send your question."
              )}
            </p>
            <PayConfirm
              open={pendingPay !== null}
              amountPaise={pendingPay?.amountPaise ?? 0}
              paying={paying}
              onConfirm={confirmPayment}
              onCancel={() => setPendingPay(null)}
            />
          </>
        )}
      </div>
    </SectionShell>
  );
}

function FooterSection({
  section,
  edit,
  selected,
  onSelect,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const props = propsOf(section);
  const siteName = p(props, "siteName", "My Site");
  const logo = p(props, "logo");
  const logoAlt = p(props, "logoAlt", siteName);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <footer className="wx-footer">
        <div className="wx-footer-inner">
          <a className="wx-footer-logo" href="#top" aria-label={`${siteName} home`}>
            {logo ? <img src={logo} alt={logoAlt} /> : <span className="wx-footer-site-name">{siteName}</span>}
          </a>
          <div className="wx-footer-col">
            <a href={`tel:${p(props, "phone")}`}>{p(props, "phone")}</a>
            <a className="is-underline" href={`mailto:${p(props, "email")}`}>
              {p(props, "email")}
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p(props, "address"))}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {p(props, "address")}
            </a>
          </div>
          <div className="wx-footer-col">
            <a href="#privacy">Privacy Policy</a>
            <a href="#accessibility">Accessibility Statement</a>
            <p className="wx-copyright">{p(props, "copyright", `© ${new Date().getFullYear()} by ${siteName}`)}</p>
          </div>
        </div>
      </footer>
    </SectionShell>
  );
}

export function SiteRenderer({
  site,
  edit = false,
  selectedSectionId,
  onSelect,
  client,
}: {
  site: SiteDocument;
  edit?: boolean;
  selectedSectionId?: string | null;
  onSelect?: (id: string) => void;
  client?: SiteClientInfo;
}) {
  const handleSelect = onSelect ?? (() => {});
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authNonce, setAuthNonce] = useState(0);

  const handleAuthenticated = () => {
    setAuthOpen(false);
    setAuthNonce((n) => n + 1);
  };

  const navSections = site.sections.filter((s) => s.id !== "hero" && s.id !== "footer");
  const navLinks = navSections.map((s) => ({ label: s.name, href: `#${s.id}` }));

  const sectionProps = (section: SiteSectionDoc) => ({
    section,
    edit,
    selected: selectedSectionId === section.id,
    onSelect: handleSelect,
    client,
    auth,
    onNeedAuth: () => setAuthOpen(true),
    authNonce,
  });

  return (
    <main
      className={`wx-page${edit ? " st-edit" : ""}`}
      style={designVars(site.design ?? {})}
    >
      {site.sections.map((section) => {
        switch (section.type) {
          case "HeroSection":
            return <HeroSection key={section.id} {...sectionProps(section)} navLinks={navLinks} />;
          case "QuoteSection":
            return <QuoteSection key={section.id} {...sectionProps(section)} />;
          case "AboutSection":
            return <AboutSection key={section.id} {...sectionProps(section)} />;
          case "ImageBandSection":
            return <ImageBandSection key={section.id} {...sectionProps(section)} />;
          case "ServicesSection":
            return <ServicesSection key={section.id} {...sectionProps(section)} />;
          case "ApproachSection":
            return <ApproachSection key={section.id} {...sectionProps(section)} />;
          case "BookingSection":
            return <BookingSection key={section.id} {...sectionProps(section)} />;
          case "QuestionSection":
            return <QuestionSection key={section.id} {...sectionProps(section)} />;
          case "FeedbackSection":
            return <FeedbackSection key={section.id} {...sectionProps(section)} />;
          case "FaqSection":
            return <FaqSection key={section.id} {...sectionProps(section)} />;
          case "FooterSection":
            return <FooterSection key={section.id} {...sectionProps(section)} />;
          default:
            return null;
        }
      })}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(res) => {
          auth.applyAuth(res);
          handleAuthenticated();
        }}
      />
      {edit ? null : (
        <a className="wx-dash-float" href="/dashboard">
          My Dashboard
        </a>
      )}
    </main>
  );
}