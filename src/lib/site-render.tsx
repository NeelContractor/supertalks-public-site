import React, { useState } from "react";
import type { SiteDocument, SiteSectionDoc } from "../types";

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

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <header className="wx-header">
        <a href="#top" aria-label="Home">
          <span className="wx-site-name">{p(props, "siteName", "My Site")}</span>
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
              <span className="wx-approach-mark">{i + 1}</span>
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
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <footer className="wx-footer">
        <div className="wx-footer-inner">
          <a className="wx-footer-logo" href="#top" aria-label={`${siteName} home`}>
            <span className="wx-footer-site-name">{siteName}</span>
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
}: {
  site: SiteDocument;
  edit?: boolean;
  selectedSectionId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const handleSelect = onSelect ?? (() => {});

  const navSections = site.sections.filter((s) => s.id !== "hero" && s.id !== "footer");
  const navLinks = navSections.map((s) => ({ label: s.name, href: `#${s.id}` }));

  return (
    <main
      className={`wx-page${edit ? " st-edit" : ""}`}
      style={designVars(site.design ?? {})}
    >
      {site.sections.map((section) => {
        const props = { section, edit, selected: selectedSectionId === section.id, onSelect: handleSelect };
        switch (section.type) {
          case "HeroSection":
            return <HeroSection key={section.id} {...props} navLinks={navLinks} />;
          case "QuoteSection":
            return <QuoteSection key={section.id} {...props} />;
          case "AboutSection":
            return <AboutSection key={section.id} {...props} />;
          case "ImageBandSection":
            return <ImageBandSection key={section.id} {...props} />;
          case "ServicesSection":
            return <ServicesSection key={section.id} {...props} />;
          case "ApproachSection":
            return <ApproachSection key={section.id} {...props} />;
          case "FeedbackSection":
            return <FeedbackSection key={section.id} {...props} />;
          case "FaqSection":
            return <FaqSection key={section.id} {...props} />;
          case "FooterSection":
            return <FooterSection key={section.id} {...props} />;
          default:
            return null;
        }
      })}
    </main>
  );
}