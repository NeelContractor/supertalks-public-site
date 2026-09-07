import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import headerLogo from "../assets/wix-header-logo.png";
import footerLogo from "../assets/wix-logo.png";
import scene from "../assets/wix-livingroom.jpg";
import portrait from "../assets/wix-portrait.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home | Therapist" },
      {
        name: "description",
        content:
          "Lee Mor is a dedicated therapist offering compassionate, personalized therapy services for individuals, couples, and families.",
      },
      { property: "og:title", content: "Home | Therapist" },
      {
        property: "og:description",
        content:
          "Discover inner peace with Lee Mor — individual, couples, and family therapy built on confidentiality, empathy, and personalized care.",
      },
    ],
  }),
  component: Index,
});

const WIX_LINKS = [
  { label: "Home", href: "#top", current: true },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

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

function Quote(props: { children: React.ReactNode }) {
  return (
    <blockquote>
      <p>{props.children}</p>
    </blockquote>
  );
}

function Section(props: { children: React.ReactNode; cls: string; id?: string }) {
  return (
    <section id={props.id} className={props.cls}>
      {props.children}
    </section>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main id="top" className="wx-page">
      {/* ---------------- Hero + header ---------------- */}
      <Section cls="wx-hero">
        <header className="wx-header">
          <a href="#top" aria-label="Home">
            <img src={headerLogo} alt="Lee Mor" width={179} height={39} />
          </a>
          <div className="wx-header-actions">
            <a className="wx-header-dash" href="/dashboard">
              My Dashboard
            </a>
            <button
              type="button"
              className="wx-menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>
          </div>
        </header>

        <div className="wx-hero-copy">
          <h2>
            Discover
            <br />
            Inner Peace
          </h2>
          <p className="wx-hero-sub">Embrace Healing Today</p>
          <div className="wx-hero-buttons">
            <a className="wx-btn wx-btn-primary" href="#words">
              Get Started
            </a>
            <a className="wx-btn wx-btn-outline" href="/dashboard">
              My Dashboard
            </a>
          </div>
        </div>

        <div className="wx-hero-media">
          <img src={portrait} alt="Lee Mor seated in a warm, plant-filled room" width={720} height={694} />
        </div>
      </Section>

      {/* ---------------- Words of Wisdom ---------------- */}
      <Section cls="wx-words" id="words">
        <h3 className="wx-eyebrow">Words of Wisdom</h3>
        <Quote>
          ״As a therapist, I believe in the power of healing through understanding and self-discovery. My goal is to
          support you on your journey towards mental well-being and inner peace.״
        </Quote>
      </Section>

      {/* ---------------- About Lee Mor ---------------- */}
      <Section cls="wx-about" id="about">
        <h2>About Lee Mor</h2>
        <p className="wx-body">
          Lee Mor is a dedicated therapist offering compassionate and personalized therapy services. With a focus on
          empathy and confidentiality, we provide a safe space for you to explore your feelings and work towards
          positive change. Our therapy sessions are tailored to your individual needs, promoting growth and
          self-awareness.
        </p>
        <a className="wx-btn wx-btn-outline" href="#about">
          Learn More
        </a>
      </Section>

      {/* ---------------- Living room image band ---------------- */}
      <Section cls="wx-scene" aria-hidden="true">
        <img src={scene} alt="" width={1440} height={900} />
      </Section>

      {/* ---------------- Services ---------------- */}
      <Section cls="wx-services" id="services">
        <div className="wx-services-grid">
          <div>
            <h2>Services</h2>
          </div>
          <article>
            <span className="wx-rule" />
            <h3>Individual</h3>
            <p>
              Our individual therapy sessions are designed to address your specific concerns and help you navigate
              life&apos;s challenges. Through a collaborative and supportive approach, we aim to empower you to overcome
              obstacles and live a fulfilling life.
            </p>
          </article>
          <article>
            <span className="wx-rule" />
            <h3>Couples</h3>
            <p>
              Our couples therapy focuses on enhancing communication, building trust, and strengthening relationships.
              We provide a neutral and supportive environment for couples to address conflicts, improve intimacy, and
              foster a deeper connection.
            </p>
          </article>
          <div aria-hidden="true" />
          <article>
            <span className="wx-rule" />
            <h3>Family</h3>
            <p>
              Family therapy sessions aim to improve family dynamics, resolve conflicts, and strengthen bonds. By
              promoting understanding and effective communication, we help families navigate challenges together and
              create harmonious relationships.
            </p>
          </article>
          <div aria-hidden="true" />
        </div>
      </Section>

      {/* ---------------- My Approach ---------------- */}
      <Section cls="wx-approach" id="approach">
        <h2>My Approach</h2>
        <div className="wx-approach-list">
          <div className="wx-approach-row">
            <LeafIcon />
            <h3>Confidentiality</h3>
            <p>
              Confidentiality is at the core of our therapy practice. We prioritize privacy and trust, ensuring that
              your personal information and sessions remain completely confidential.
            </p>
          </div>
          <div className="wx-approach-row">
            <BloomIcon />
            <h3>Empathy</h3>
            <p>
              Empathy is the foundation of our therapeutic approach. We provide a compassionate and understanding
              environment where you can feel heard, validated, and supported throughout your healing journey.
            </p>
          </div>
          <div className="wx-approach-row">
            <TeardropIcon />
            <h3>Personalized Care</h3>
            <p>
              We believe in offering personalized care to every client. Our tailored therapy sessions focus on your
              unique needs and goals, allowing for a customized therapeutic experience.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------- Client Feedback ---------------- */}
      <Section cls="wx-feedback" id="feedback">
        <h2>Client Feedback</h2>
        <div className="wx-feedback-grid">
          <div className="wx-feedback-card">
            <Quote>
              &ldquo;Lee Mor has been a guiding light in my journey towards self-discovery and healing. Their
              compassionate approach and expertise have truly&rdquo;
            </Quote>
            <cite>Sara H.</cite>
          </div>
          <div className="wx-feedback-card">
            <Quote>
              &ldquo;I am grateful for Lee Mor&apos;s support and guidance during a challenging time in my life. Their
              professionalism and care have been invaluable.&rdquo;
            </Quote>
            <cite>James T.</cite>
          </div>
          <div className="wx-feedback-card">
            <Quote>
              &ldquo;Lee Mor&apos;s therapy sessions have provided me with a safe space to explore my thoughts and
              emotions. I highly recommend their services&rdquo;
            </Quote>
            <cite>Emily L.</cite>
          </div>
        </div>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section cls="wx-faq" id="faq">
        <h2>Frequently Asked Questions</h2>
        <div className="wx-faq-grid">
          <div className="wx-faq-row">
            <h3>What services do you offer?</h3>
            <p>
              Lee Mor provides a range of therapy services tailored to individual needs, including cognitive behavioral
              therapy, mindfulness techniques, and stress management. Each session is personalized to address specific
              concerns and promote overall well-being.
            </p>
          </div>
          <div className="wx-faq-row">
            <h3>How do I schedule an appointment?</h3>
            <p>
              Scheduling an appointment with Lee Mor is easy. Simply contact our office via phone or email to book a
              convenient time for your initial consultation. We strive to accommodate your schedule and provide prompt
              assistance.
            </p>
          </div>
          <div className="wx-faq-row">
            <h3>What can I expect during a therapy session?</h3>
            <p>
              During a therapy session with Lee Mor, you can expect a safe and confidential environment where you can
              openly discuss your thoughts and feelings. Our therapist will listen attentively, offer guidance, and work
              collaboratively with you to explore solutions and promote personal growth.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------- Footer ---------------- */}
      <footer className="wx-footer" id="contact">
        <div className="wx-footer-inner">
          <a className="wx-footer-logo" href="#top" aria-label="Lee Mor home">
          <img src={footerLogo} alt="Lee Mor" width={158} height={40} />
        </a>
        <div className="wx-footer-col">
          <a href="tel:1234567890">123-456-7890</a>
          <a className="is-underline" href="mailto:info@mysite.com">
            info@mysite.com
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=500+Terry+Francine+St.+San+Francisco,+CA+94158"
            target="_blank"
            rel="noreferrer noopener"
          >
            500 Terry Francine St. San Francisco, CA 94158
          </a>
        </div>
        <div className="wx-footer-col">
          <a href="#privacy">Privacy Policy</a>
          <a href="#accessibility">Accessibility Statement</a>
          <p className="wx-copyright">
            © 2035 by Lee Mor. Powered and secured by{" "}
            <a className="is-underline" href="https://www.fake_supertalks.com" target="_blank" rel="noreferrer noopener">
              Supertalks
            </a>
          </p>
        </div>
        </div>
      </footer>

      {/* ---------------- Menu overlay ---------------- */}
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
                {WIX_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className={link.current ? "is-current" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}