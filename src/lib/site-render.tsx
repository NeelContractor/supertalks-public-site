import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FieldStyle, SiteDocument, SiteSectionDoc } from "../types";
import {
  askQuestion,
  completePayment,
  createBooking,
  fetchOpenSlots,
  formatPrice,
  sendQuestionMessage,
  type ClientQuestion,
  type OpenSlot,
} from "./client";
import { useAuth, type UseAuth } from "./useAuth";
import { AuthModal } from "./AuthModal";
import { PayConfirm } from "./pay";
import { useStore } from "./store";

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

function scrollToQuestion(e: React.MouseEvent) {
  e.preventDefault();
  document
    .querySelector('[data-st-section-id="question"]')
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function num(value: unknown, fallback: number): number | string {
  return typeof value === "number" ? value : fallback;
}

// A real Google Font family name (as opposed to the built-in serif/sans categories).
function fontStack(value: string, stacks: Record<string, string>, fallbackKey: string): string {
  if (value in stacks) return stacks[value] as string;
  if (value && value !== "serif" && value !== "sans") {
    return `"${value}", system-ui, sans-serif`;
  }
  return stacks[fallbackKey] as string;
}

const loadFonts: Record<string, Promise<void>> = {};

function ensureFont(family: string): void {
  if (!family || family === "serif" || family === "sans" || loadFonts[family]) return;
  if (typeof document === "undefined") return;
  loadFonts[family] = (async () => {
    const id = `gf-${family.replace(/[^a-zA-Z0-9]/g, "-")}`;
    if (document.getElementById(id)) return;
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@400;500;600;700&display=swap`;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
    try {
      await document.fonts.load(`16px "${family}"`);
    } catch {
      /* font may not be available yet */
    }
  })();
}

export function designVars(design: Record<string, unknown>): React.CSSProperties {
  const dv = design ?? {};
  const displayFont = str(dv["displayFont"], "serif");
  const bodyFont = str(dv["bodyFont"], "sans");
  ensureFont(displayFont);
  ensureFont(bodyFont);
  return {
    "--site-maroon": str(dv["primaryColor"], "#771609"),
    "--site-pink": str(dv["panelColor"], "#fff4f3"),
    "--site-white": str(dv["backgroundColor"], "#fffcfc"),
    "--site-dark": str(dv["darkColor"], "#253039"),
    "--site-display": fontStack(displayFont, DISPLAY_STACKS, "serif"),
    "--site-body": fontStack(bodyFont, BODY_STACKS, "sans"),
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

// ---- Click-to-edit ---------------------------------------------------------

function fieldStyleOf(section: SiteSectionDoc, path: string): FieldStyle {
  return section.fieldStyles?.[path] ?? {};
}

const TOOLBAR_FONTS = [
  "serif",
  "sans",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans 3",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Cormorant Garamond",
  "Oswald",
  "Bebas Neue",
  "Space Grotesk",
  "Outfit",
  "Josefin Sans",
  "DM Sans",
  "Cabin",
];

const SIZE_PRESETS = [
  "12px",
  "13px",
  "14px",
  "15px",
  "16px",
  "18px",
  "20px",
  "22px",
  "24px",
  "28px",
  "32px",
  "36px",
  "40px",
  "44px",
  "48px",
  "56px",
  "64px",
  "72px",
];

function styleSheetFor(style: FieldStyle): React.CSSProperties {
  const out: Record<string, string> = {};
  if (style.fontSize) out["fontSize"] = style.fontSize;
  if (style.color) out["color"] = style.color;
  if (style.fontWeight) out["fontWeight"] = style.fontWeight;
  if (style.fontStyle) out["fontStyle"] = style.fontStyle;
  if (style.textTransform) out["textTransform"] = style.textTransform;
  if (style.fontFamily) {
    const family = style.fontFamily;
    ensureFont(family);
    out["fontFamily"] =
      family === "serif" || family === "sans"
        ? fontStack(family, DISPLAY_STACKS, "sans")
        : `"${family}", system-ui, sans-serif`;
  }
  return out as React.CSSProperties;
}

interface EditableProps {
  as?: string;
  field: string;
  section: SiteSectionDoc;
  edit: boolean;
  value: string;
  className?: string;
  style?: React.CSSProperties;
  onSelectField?: (field: string) => void;
  onEditValue?: (field: string, value: string) => void;
  href?: string;
  title?: string;
}

function Editable({
  as = "span",
  field,
  section,
  edit,
  value,
  className,
  style,
  onSelectField,
  onEditValue,
  href,
  title,
  ...rest
}: EditableProps & Record<string, unknown>) {
  const elRef = useRef<HTMLElement | null>(null);
  const mergedStyle: React.CSSProperties = {
    ...styleSheetFor(fieldStyleOf(section, field)),
    ...style,
  };

  // Keep the DOM text in sync with the stored value, but never clobber the
  // caret while the user is actively typing inside the element.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value, field, edit]);

  if (edit) {
    return React.createElement(
      as,
      {
        ...rest,
        ref: elRef,
        className,
        href,
        title,
        style: { ...mergedStyle, cursor: "text", minWidth: 8 },
        "data-st-field": `${section.id}|${field}`,
        contentEditable: true,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onSelectField?.(field);
        },
        onInput: (e: React.FormEvent) => {
          const text = (e.currentTarget as HTMLElement).textContent ?? "";
          onEditValue?.(field, text);
        },
        onBlur: () => {
          onEditValue?.(field, elRef.current?.textContent ?? "");
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        },
      },
      null,
    );
  }
  return React.createElement(
    as,
    { ...rest, className, href, title, style: mergedStyle },
    value,
  );
}

function StyleToolbar({
  rect,
  style,
  fieldLabel,
  onChange,
  onClose,
}: {
  rect: { top: number; left: number; width: number; bottom: number };
  style: FieldStyle;
  fieldLabel: string;
  onChange: (patch: { value?: string; style?: FieldStyle | null }) => void;
  onClose: () => void;
}) {
  const [toolbarH, setToolbarH] = useState(196);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (toolbarRef.current) setToolbarH(toolbarRef.current.offsetHeight);
  }, []);
  const gap = 10;
  const gridGap = 8;
  const above = rect.top - toolbarH >= gridGap;
  const toolbar: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 262 - 8)),
    top: above ? rect.top - toolbarH - gap : rect.bottom + gap,
    width: 250,
    background: "#1d2733",
    color: "#fff",
    borderRadius: 10,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 10,
    fontSize: 12,
    fontFamily: "system-ui, sans-serif",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  };
  const label: React.CSSProperties = {
    width: 44,
    color: "#9fb0c0",
    flexShrink: 0,
  };
  const inputBase: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: "#0f1720",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: 6,
    padding: "4px 6px",
    fontSize: 12,
    outline: "none",
  };
  const colorVal = /^#[0-9a-fA-F]{6}$/.test(style.color ?? "") ? (style.color as string) : "#000000";

  return (
    <div ref={toolbarRef} style={toolbar}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>{fieldLabel}</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#9fb0c0",
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
          }}
          aria-label="Close element toolbar"
        >
          ×
        </button>
      </div>
      <p
        style={{
          margin: 0,
          marginBottom: 8,
          fontSize: 10.5,
          color: "#9fb0c0",
          lineHeight: 1.4,
        }}
      >
        Editing "{fieldLabel}" — click the text on the page to type.
      </p>
      <div style={row}>
        <span style={label}>Size</span>
        <select
          value={style.fontSize ?? ""}
          style={{ ...inputBase, flex: "0 0 auto", width: 78 }}
          onChange={(e) => onChange({ style: { ...style, fontSize: e.target.value } })}
        >
          <option value="">Default</option>
          {SIZE_PRESETS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={style.fontSize ?? ""}
          style={{ ...inputBase, width: 56, flex: "0 0 auto" }}
          onChange={(e) => onChange({ style: { ...style, fontSize: e.target.value } })}
          placeholder="e.g. 24px"
          title="Custom font size"
        />
        <button
          type="button"
          onClick={() => onChange({ style: null })}
          style={{
            background: "#334155",
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            cursor: "pointer",
            marginLeft: "auto",
          }}
          title="Reset element styles to defaults"
        >
          Reset
        </button>
      </div>
      <div style={row}>
        <span style={label}>Font</span>
        <select
          value={style.fontFamily ?? ""}
          style={inputBase}
          onChange={(e) => onChange({ style: { ...style, fontFamily: e.target.value } })}
        >
          <option value="">Default</option>
          {TOOLBAR_FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>
      <div style={row}>
        <span style={label}>Color</span>
        <input
          type="color"
          value={colorVal}
          style={{ width: 30, height: 26, padding: 0, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0 }}
          onChange={(e) => onChange({ style: { ...style, color: e.target.value } })}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() =>
            onChange({
              style: {
                ...style,
                fontWeight: style.fontWeight === "bold" ? "" : "bold",
              },
            })
          }
          style={{
            width: 32,
            height: 28,
            borderRadius: 6,
            border: "1px solid #334155",
            background: style.fontWeight === "bold" ? "#ffb3ab" : "#0f1720",
            color: style.fontWeight === "bold" ? "#1d2733" : "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              style: {
                ...style,
                fontStyle: style.fontStyle === "italic" ? "" : "italic",
              },
            })
          }
          style={{
            width: 32,
            height: 28,
            borderRadius: 6,
            border: "1px solid #334155",
            background: style.fontStyle === "italic" ? "#ffb3ab" : "#0f1720",
            color: style.fontStyle === "italic" ? "#1d2733" : "#fff",
            fontStyle: "italic",
            cursor: "pointer",
          }}
          title="Italic"
        >
          I
        </button>
        <select
          value={style.textTransform ?? ""}
          onChange={(e) => onChange({ style: { ...style, textTransform: e.target.value } })}
          style={{ ...inputBase, height: 28 }}
        >
          <option value="">Case: default</option>
          <option value="none">none</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Title Case</option>
        </select>
      </div>
    </div>
  );
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  navLinks: { label: string; href: string }[];
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const props = propsOf(section);
  const siteName = p(props, "siteName", "My Site");
  const logo = p(props, "logo");

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-hero">
        <header className="wx-header">
          <a href="#top" aria-label="Home">
            {logo ? (
              <img src={logo} alt="supertalks" />
            ) : (
              <Editable as="span" className="wx-site-name" field="siteName" section={section} edit={edit} value={siteName} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
            )}
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
          <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Welcome")} style={{ whiteSpace: "pre-line" }} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="p" className="wx-hero-sub" field="subtitle" section={section} edit={edit} value={p(props, "subtitle")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="a" className="wx-btn wx-btn-primary" field="ctaLabel" section={section} edit={edit} value={p(props, "ctaLabel", "Get Started")} href="#question" onClick={scrollToQuestion} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        </div>

        <div className="wx-hero-media">
          <img src={p(props, "image")} alt="supertalks" />
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-words">
        <Editable as="h3" className="wx-eyebrow" field="eyebrow" section={section} edit={edit} value={p(props, "eyebrow")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <blockquote>
          <Editable as="p" field="quote" section={section} edit={edit} value={p(props, "quote")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-about">
        <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "About")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <Editable as="p" className="wx-body" field="body" section={section} edit={edit} value={p(props, "body")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <Editable as="a" className="wx-btn wx-btn-outline" field="buttonLabel" section={section} edit={edit} value={p(props, "buttonLabel", "Learn More")} href="#question" onClick={scrollToQuestion} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
        <img src={p(props, "image")} alt="supertalks" />
      </div>
    </SectionShell>
  );
}

function ServicesSection({
  section,
  edit,
  selected,
  onSelect,
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-services">
        <div className="wx-services-grid">
          <div>
            <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Services")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          </div>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <article>
                <span className="wx-rule" />
                <Editable as="h3" field={`items.${i}.title`} section={section} edit={edit} value={p(item, "title")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
                <Editable as="p" field={`items.${i}.body`} section={section} edit={edit} value={p(item, "body")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-approach">
        <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "My Approach")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <div className="wx-approach-list">
          {items.map((item, i) => (
            <div className="wx-approach-row" key={i}>
              {item["icon"] ? (
                <ApproachIcon name={String(item["icon"])} />
              ) : (
                <span className="wx-approach-mark">{i + 1}</span>
              )}
              <Editable as="h3" field={`items.${i}.title`} section={section} edit={edit} value={p(item, "title")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
              <Editable as="p" field={`items.${i}.body`} section={section} edit={edit} value={p(item, "body")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-feedback">
        <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Client Feedback")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <div className="wx-feedback-grid">
          {items.map((item, i) => (
            <div className="wx-feedback-card" key={i}>
              <blockquote>
                <Editable as="p" field={`items.${i}.quote`} section={section} edit={edit} value={p(item, "quote")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
              </blockquote>
              <Editable as="cite" field={`items.${i}.author`} section={section} edit={edit} value={p(item, "author")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  const items = itemsOf(props, "items");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-faq">
        <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Frequently Asked Questions")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        <div className="wx-faq-grid">
          {items.map((item, i) => (
            <div className="wx-faq-row" key={i}>
              <Editable as="h3" field={`items.${i}.question`} section={section} edit={edit} value={p(item, "question")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
              <Editable as="p" field={`items.${i}.answer`} section={section} edit={edit} value={p(item, "answer")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
  client,
  auth,
  onNeedAuth,
  authNonce,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
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
          <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Book a Session")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="p" field="subtitle" section={section} edit={edit} value={p(props, "subtitle")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditValue,
  client,
  auth,
  onNeedAuth,
  authNonce,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
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
  const myQuestions = useStore((s) => s.questions);
  const questionsLoaded = useStore((s) => s.questionsLoaded);
  const myLoading = useStore((s) => s.questionsLoading && !s.questionsLoaded);
  const [activeId, setActiveId] = useState<string | null>(null);
  const threadMessages = useStore((s) => (activeId ? s.messagesByQuestion[activeId] : undefined)) ?? [];
  const threadLoading = useStore((s) => (activeId ? !!s.threadsLoading[activeId] : false));
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
      void useStore.getState().loadQuestions(true);
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
    setActiveId(q.id);
    setReply("");
    useStore
      .getState()
      .openThread(q.id)
      .catch((err) => {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not open this conversation." });
      });
  };

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeId || !reply.trim()) return;
    setReplySending(true);
    try {
      const result = await sendQuestionMessage(activeId, reply.trim());
      if (result.requiresPayment) {
        // Hold the message behind a payment prompt; the text stays in the input.
        setPendingPay({ paymentId: result.payment.id, amountPaise: result.payment.amountPaise });
        return;
      }
      useStore.getState().appendMessage(activeId, result.message);
      useStore.getState().updateQuestionStatus(result.question.id, result.question.status);
      setReply("");
      void useStore.getState().loadQuestions(true);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not send your reply." });
    } finally {
      setReplySending(false);
    }
  };

  const confirmPayment = async () => {
    if (!pendingPay || !activeId) return;
    setPaying(true);
    try {
      const result = await completePayment(pendingPay.paymentId);
      setPendingPay(null);
      if (result.message) useStore.getState().appendMessage(activeId, result.message);
      if (result.question) {
        useStore.getState().updateQuestionStatus(result.question.id, result.question.status);
      }
      setReply("");
      void useStore.getState().loadQuestions(true);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Payment could not be completed." });
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (tab !== "mine" || !auth.token) return;
    void useStore.getState().loadQuestions();
  }, [tab, auth.token, authNonce]);

  const accepting = client?.isAcceptingQuestions !== false;
  const priceSuffix = client?.questionPricePaise != null ? ` · ${formatPrice(client.questionPricePaise)}` : "";
  const CLOSED_STATUSES = ["Rejected", "Refunded"];
  const activeQuestion = activeId ? myQuestions.find((q) => q.id === activeId) ?? null : null;
  const threadClosed = activeQuestion ? CLOSED_STATUSES.includes(activeQuestion.status) : false;

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-question">
        <div className="wx-question-head">
          <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Ask a Question")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="p" field="subtitle" section={section} edit={edit} value={p(props, "subtitle")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
        </div>
        {edit ? null : !accepting ? (
          <p className="wx-book-note">Questions are currently paused.</p>
        ) : (
          <>
            {activeQuestion ? (
              <div className="wx-chat">
                <button type="button" className="wx-linkbtn wx-chat-back" onClick={() => setActiveId(null)}>
                  ← Back to your questions
                </button>
                <div className="wx-chat-question">
                  <p className="wx-chat-question-text">{activeQuestion.questionText}</p>
                  <p className="wx-book-note">
                    {activeQuestion.status}
                    {activeQuestion.category ? ` · ${activeQuestion.category}` : ""}
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
                    Your Questions{questionsLoaded && myQuestions.length > 0 ? ` (${myQuestions.length})` : ""}
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
                        {submitting
                          ? "Sending…"
                          : (
                            <Editable as="span" field="buttonLabel" section={section} edit={edit} value={p(props, "buttonLabel", "Ask Question")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
                          )}
                        {submitting ? "" : priceSuffix}
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
  onSelectField,
  onEditValue,
}: {
  section: SiteSectionDoc;
  edit: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditValue?: (sectionId: string, field: string, value: string) => void;
}) {
  const props = propsOf(section);
  const siteName = p(props, "siteName", "My Site");
  const logo = p(props, "logo");
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <footer className="wx-footer">
        <div className="wx-footer-inner">
          <a className="wx-footer-logo" href="#top" aria-label={`${siteName} home`}>
            {logo ? <img src={logo} alt="supertalks" /> : <Editable as="span" className="wx-footer-site-name" field="siteName" section={section} edit={edit} value={siteName} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />}
          </a>
          <div className="wx-footer-col">
            <Editable as="a" field="phone" section={section} edit={edit} value={p(props, "phone")} href={`tel:${p(props, "phone")}`} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
            <Editable as="a" className="is-underline" field="email" section={section} edit={edit} value={p(props, "email")} href={`mailto:${p(props, "email")}`} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
            <Editable
              as="a"
              field="address"
              section={section}
              edit={edit}
              value={p(props, "address")}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p(props, "address"))}`}
              target="_blank"
              rel="noreferrer noopener"
              onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)}
            />
          </div>
          <div className="wx-footer-col">
            <a href="#privacy">Privacy Policy</a>
            <a href="#accessibility">Accessibility Statement</a>
            <Editable as="p" className="wx-copyright" field="copyright" section={section} edit={edit} value={p(props, "copyright", `© ${new Date().getFullYear()} by ${siteName}`)} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
  onSelectField,
  onEditField,
  activeFieldKey,
  client,
}: {
  site: SiteDocument;
  edit?: boolean;
  selectedSectionId?: string | null;
  onSelect?: (id: string) => void;
  onSelectField?: (sectionId: string, field: string) => void;
  onEditField?: (
    sectionId: string,
    field: string,
    patch: { value?: string; style?: FieldStyle | null },
  ) => void;
  activeFieldKey?: string | null;
  client?: SiteClientInfo;
}) {
  const handleSelect = onSelect ?? (() => {});
  const handleFieldSelect = onSelectField ?? handleSelect;
  const handleEditField = onEditField ?? (() => {});
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authNonce, setAuthNonce] = useState(0);
  const [localField, setLocalField] = useState<{ sectionId: string; field: string } | null>(null);
  const [toolbarRect, setToolbarRect] = useState<{
    top: number;
    left: number;
    width: number;
    bottom: number;
  } | null>(null);

  const active =
    localField ??
    (activeFieldKey && selectedSectionId
      ? { sectionId: selectedSectionId, field: activeFieldKey }
      : null);

  useEffect(() => {
    if (!active) {
      setToolbarRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(
        `[data-st-field="${String(active.sectionId)}|${String(active.field)}"]`,
      );
      if (!el) {
        setToolbarRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const visible =
        r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
      setToolbarRect(
        visible ? { top: r.top, left: r.left, width: r.width, bottom: r.bottom } : null,
      );
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.sectionId, active?.field, site.sections]);

  const handleAuthenticated = () => {
    setAuthOpen(false);
    setAuthNonce((n) => n + 1);
  };

const selectField = (sectionId: string, field: string) => {
  setLocalField({ sectionId, field });
  handleFieldSelect(sectionId, field);
};

  const navSections = site.sections.filter((s) => s.id !== "hero" && s.id !== "footer");
  const navLinks = navSections.map((s) => ({ label: s.name, href: `#${s.id}` }));

  const sectionProps = (section: SiteSectionDoc) => ({
    section,
    edit,
    selected: selectedSectionId === section.id,
    onSelect: (id: string) => {
      setLocalField(null);
      handleSelect(id);
    },
    onSelectField: (sectionId: string, field: string) => selectField(sectionId, field),
    onEditValue: (sectionId: string, field: string, value: string) =>
      handleEditField(sectionId, field, { value }),
    client,
    auth,
    onNeedAuth: () => setAuthOpen(true),
    authNonce,
  });

  const activeSection = active
    ? site.sections.find((sec) => sec.id === active.sectionId)
    : null;
  const activeStyle = active && activeSection ? fieldStyleOf(activeSection, active.field) : {};
  // Human-friendly labels for otherwise cryptic template field keys.
const FIELD_LABELS: Record<string, string> = {
  siteName: "Site Name",
  ctaLabel: "Button Text",
  buttonLabel: "Button Text",
  eyebrow: "Eyebrow",
  quote: "Quote",
  heading: "Heading",
  subtitle: "Subtitle",
  body: "Description",
  question: "Question",
  answer: "Answer",
  title: "Title",
  icon: "Icon",
};

function fieldLabelOf(key: string): string {
  const mapped = FIELD_LABELS[key];
  if (mapped) return mapped;
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

  const activeLabel = active ? fieldLabelOf(active.field.split(".").pop() ?? active.field) : "";

  const handleFieldChange = (patch: { value?: string; style?: FieldStyle | null }) => {
    if (!active) return;
    handleEditField(active.sectionId, active.field, patch);
  };

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
      {edit && active && activeSection && toolbarRect ? (
        <StyleToolbar
          rect={toolbarRect}
          style={activeStyle}
          fieldLabel={activeLabel}
          onChange={handleFieldChange}
          onClose={() => {
            setLocalField(null);
            setToolbarRect(null);
            if (active) handleSelect(active.sectionId);
          }}
        />
      ) : null}
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