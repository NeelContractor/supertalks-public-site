import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FieldStyle, SiteDocument, SiteSectionDoc } from "../types";
import { getCloudinaryUrl } from "./cloudinary";
import {
  createBooking,
  fetchOpenSlots,
  formatPrice,
  orderQuestions,
  type OpenSlot,
  type QuestionOrderClientDetails,
  type QuestionOrderItem,
} from "./client";
import { useAuth, type UseAuth } from "./useAuth";
import { AuthModal } from "./AuthModal";
import { runCheckout, useGatewayReturn } from "./pay";
import { toast } from "sonner";
import anahataImg from "@/assets/icons/anahata.png"
import lotusImg from "@/assets/icons/lotus-1.png"
import shellImg from "@/assets/icons/shell-1.png"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DISPLAY_STACKS: Record<string, string> = {
  serif: '"eschaton", Georgia, serif',
  sans: '"futura-lt-w01-book", Futura, "Century Gothic", system-ui, sans-serif',
};

const BODY_STACKS: Record<string, string> = {
  sans: '"futura-lt-w01-book", Futura, "Century Gothic", system-ui, sans-serif',
  serif: '"eschaton", Georgia, serif',
};

// Sections whose content is required for bookings/questions and must stay
// fixed for the astrologer (not editable in the builder preview).
const LOCKED_SECTIONS = new Set(["book", "question"]);

const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
const SUPERTALKS_URL = env.BUN_PUBLIC_SUPERTALKS_URL ?? "http://fake_supertalks.com";
// The admin dashboard app owns client bookings/questions tracking. Links below
// point there instead of to tracking pages on this public site.
const EDITOR_ORIGIN = env.BUN_PUBLIC_EDITOR_ORIGIN ?? "http://localhost:3001";
const dashboardUrl = (path: string) => `${EDITOR_ORIGIN}${path}`;

/** Shared toast id so loading → success/error replaces the same notification. */
const PAY_TOAST_ID = "supertalks-pay";

/** Render the whole copyright line as a single link to the SuperTalks site. */
function linkifySuperTalks(text: string, url: string): React.ReactNode {
  return (
    <a
      className="is-underline"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {text}
    </a>
  );
}

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
  locked?: boolean;
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
  locked,
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

  if (edit && !LOCKED_SECTIONS.has(section.id) && !locked) {
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
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 274 - 8)),
    top: above ? rect.top - toolbarH - gap : rect.bottom + gap,
    width: 262,
    background: "#2C2C2C",
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
        <Select
          value={style.fontSize || "default"}
          onValueChange={(v) =>
            onChange({ style: { ...style, fontSize: v === "default" ? "" : v } })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[76px] rounded-md border-[#334155] bg-[#0f1720] px-2 text-xs text-white"
          >
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent className="z-[10001] border-[#334155] bg-[#242b36] text-gray-100 shadow-xl [&_[data-slot=select-item]]:focus:bg-[#3a4351] [&_[data-slot=select-item]]:focus:text-white [&_svg]:text-gray-400">
            <SelectItem value="default">Default</SelectItem>
            {SIZE_PRESETS.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="text"
          value={style.fontSize ?? ""}
          style={{ ...inputBase, flex: 1, minWidth: 44 }}
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
            whiteSpace: "nowrap",
          }}
          title="Reset element styles to defaults"
        >
          Reset
        </button>
      </div>
      <div style={row}>
        <span style={label}>Font</span>
        <Select
          value={style.fontFamily || "default"}
          onValueChange={(v) =>
            onChange({ style: { ...style, fontFamily: v === "default" ? "" : v } })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-7 flex-1 rounded-md border-[#334155] bg-[#0f1720] px-2 text-xs text-white"
          >
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent className="z-[10001] border-[#334155] bg-[#242b36] text-gray-100 shadow-xl [&_[data-slot=select-item]]:focus:bg-[#3a4351] [&_[data-slot=select-item]]:focus:text-white [&_svg]:text-gray-400">
            <SelectItem value="default">Default</SelectItem>
            {TOOLBAR_FONTS.map((font) => (
              <SelectItem key={font} value={font}>
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select
          value={style.textTransform || "default"}
          onValueChange={(v) =>
            onChange({ style: { ...style, textTransform: v === "default" ? "" : v } })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-7 flex-1 rounded-md border-[#334155] bg-[#0f1720] px-2 text-xs text-white"
          >
            <SelectValue placeholder="Case" />
          </SelectTrigger>
          <SelectContent className="z-[10001] border-[#334155] bg-[#242b36] text-gray-100 shadow-xl [&_[data-slot=select-item]]:focus:bg-[#3a4351] [&_[data-slot=select-item]]:focus:text-white [&_svg]:text-gray-400">
            <SelectItem value="default">default</SelectItem>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="uppercase">UPPERCASE</SelectItem>
            <SelectItem value="lowercase">lowercase</SelectItem>
            <SelectItem value="capitalize">Title Case</SelectItem>
          </SelectContent>
        </Select>
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
    <svg viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 1 C35 12 36 27 26 42 C32 32 34 18 20 1 Z" />
      <path d="M20 1 C10 12 4 26 10 38 C3 26 6 12 20 1 Z" />
    </svg>
  );
}

function BloomIcon() {
  return (
    <svg viewBox="0 0 50 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="18" cy="20" rx="17" ry="14" />
      <ellipse cx="32" cy="20" rx="17" ry="14" />
    </svg>
  );
}

function TeardropIcon() {
  return (
    <svg viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 1 C31 16 38 26 38 31 C38 38 31 43 20 43 C9 43 2 38 2 31 C2 26 9 16 20 1 Z" />
    </svg>
  );
}

export interface SiteClientInfo {
  slug: string;
  astrologerId?: string;
  astrologerName?: string;
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
  const logo = getCloudinaryUrl(p(props, "logo"));

  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <div className="wx-hero">
        <header className="wx-header">
          <a className="wx-header-brand" href="#top" aria-label="Home">
            {logo ? <img className="wx-header-logo" src={logo} alt={siteName} /> : null}
            <Editable as="span" className="wx-site-name" field="siteName" section={section} edit={edit} value={siteName} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          </a>
          {/* <button
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
          </button> */}
        </header>

        <div className="wx-hero-copy">
          <Editable as="h2" field="heading" section={section} edit={edit} value={p(props, "heading", "Welcome")} style={{ whiteSpace: "pre-line" }} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="p" className="wx-hero-sub" field="subtitle" section={section} edit={edit} value={p(props, "subtitle")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          <Editable as="a" className="wx-btn wx-btn-primary" field="ctaLabel" section={section} edit={edit} value={p(props, "ctaLabel", "Get Started")} href="#question" onClick={scrollToQuestion} locked onSelectField={(f) => onSelectField?.(section.id, f)}
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
          {items.map((item, i) => {
            return (
              <div className="wx-approach-row" key={i}>
                <img
                  src={[anahataImg, lotusImg, shellImg][i % 3]}
                  alt=""
                  width={100}
                  height={100}
                />
                <Editable as="h3" field={`items.${i}.title`} section={section} edit={edit} value={p(item, "title")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
                <Editable as="p" field={`items.${i}.body`} section={section} edit={edit} value={p(item, "body")} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
              </div>
            );
          })}
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
  onNeedAuth: (mode?: "signin" | "signup") => void;
  authNonce: number;
}) {
  const props = propsOf(section);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const pendingRef = useRef<string | null>(null);
  const bookRef = useRef<((startAt: string) => Promise<void>) | null>(null);

  // Back from the payment gateway: confirm the booking once payment lands.
  useGatewayReturn((_outcome, _paymentId, status) => {
    const ok = status === "success";
    setStatus({
      ok,
      message:
        status === "success"
          ? "Payment successful! Your session is confirmed."
          : status === "failed"
            ? "Payment failed. You can try again."
            : status === "pending"
              ? "Payment is being processed. We'll confirm your session shortly."
              : "Payment could not be completed.",
    });
    if (ok) {
      toast.success("Payment successful! Your session is confirmed.", { id: PAY_TOAST_ID });
      setRefreshNonce((n) => n + 1);
    } else if (status === "failed") {
      toast.error("Payment failed. You can try again.", { id: PAY_TOAST_ID });
    } else if (status === "pending") {
      toast("Payment is being processed. We'll confirm your session shortly.", { id: PAY_TOAST_ID });
    } else {
      toast.error("Payment could not be completed.", { id: PAY_TOAST_ID });
    }
  });

  const days = upcomingDays(28);
  const weekSize = 7;
  const maxWeekOffset = Math.max(0, Math.ceil(days.length / weekSize) - 1);
  const weekDays = days.slice(weekOffset * weekSize, weekOffset * weekSize + weekSize);

  const goToWeek = (next: number) => {
    const clamped = Math.max(0, Math.min(maxWeekOffset, next));
    setWeekOffset(clamped);
    const shown = days.slice(clamped * weekSize, clamped * weekSize + weekSize);
    if (!shown.some((day) => day.key === date) && shown[0]) {
      setDate(shown[0].key);
    }
  };

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
  }, [date, edit, client?.slug, refreshNonce]);

  const book = async (startAt: string) => {
    if (!client?.astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    toast.loading("Checking availability and starting your booking…", { id: PAY_TOAST_ID });
    try {
      const { payment } = await createBooking(client.astrologerId, startAt, crypto.randomUUID());
      if (payment) {
        setStatus({ ok: true, message: "Redirecting to secure payment…" });
        toast.loading("Redirecting to secure payment…", { id: PAY_TOAST_ID });
        const outcome = await runCheckout(payment, window.location.href);
        if (outcome === "redirect") return;
        setStatus({ ok: true, message: "Payment successful! Your session is confirmed." });
        toast.success("Payment successful! Your session is confirmed.", { id: PAY_TOAST_ID });
        setRefreshNonce((n) => n + 1);
      } else {
        setStatus({ ok: true, message: "Session booked and confirmed." });
        toast.success("Session booked and confirmed.", { id: PAY_TOAST_ID });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Booking failed. Please try again.";
      setStatus({ ok: false, message });
      toast.error(message, { id: PAY_TOAST_ID });
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
                <div className="wx-book-week">
                  <button
                    type="button"
                    className="wx-book-week-nav"
                    aria-label="Previous week"
                    disabled={weekOffset === 0}
                    onClick={() => goToWeek(weekOffset - 1)}
                  >
                    <ArrowLeftIcon />
                  </button>
                  <div className="wx-book-days">
                    {weekDays.map((day) => (
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
                  <button
                    type="button"
                    className="wx-book-week-nav"
                    aria-label="Next week"
                    disabled={weekOffset >= maxWeekOffset}
                    onClick={() => goToWeek(weekOffset + 1)}
                  >
                    <ArrowRightIcon />
                  </button>
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
            {auth.user ? (
              <p className="wx-book-note">
                Signed in as {auth.user.email}.{" "}
                <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
                  Sign out
                </button>
                <a className="wx-auth-btn wx-auth-btn-solid" href={dashboardUrl("/dashboard")}>
                  Go to Dashboard
                </a>
                <a className="wx-linkbtn" href={dashboardUrl("/bookings")}>
                  Track your bookings in your dashboard →
                </a>
              </p>
            ) : (
              <p className="wx-book-note">
                Sign in (or create a free account) to book a slot.
                <span className="wx-auth-btns">
                  <button type="button" className="wx-auth-btn" onClick={() => onNeedAuth("signin")}>
                    Sign in
                  </button>
                  <button type="button" className="wx-auth-btn wx-auth-btn-solid" onClick={() => onNeedAuth("signup")}>
                    Create Account
                  </button>
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}

function QuestionSection({
  section,
  edit,
  selected: isSectionSelected,
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
  onNeedAuth: (mode?: "signin" | "signup") => void;
  authNonce: number;
}) {
  const props = propsOf(section);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<{ items: QuestionOrderItem[]; clientDetails: QuestionOrderClientDetails } | null>(null);
  const createOrderRef = useRef<
    ((items: QuestionOrderItem[], clientDetails: QuestionOrderClientDetails) => Promise<void>) | null
  >(null);

  // Back from the payment gateway: finish the order once the payment lands.
  useGatewayReturn((_outcome, _paymentId, status) => {
    const ok = status === "success";
    const message =
      status === "success"
        ? "Payment successful! Your questions have been sent. Track replies from your dashboard."
        : status === "failed"
          ? "Payment failed. Please try again."
          : status === "pending"
            ? "Payment is being processed. Your questions will be sent shortly."
            : "Payment could not be completed.";
    setStatus({ ok, message });
    if (ok) {
      toast.success(message, { id: PAY_TOAST_ID });
    } else if (status === "failed") {
      toast.error(message, { id: PAY_TOAST_ID });
    } else if (status === "pending") {
      toast(message, { id: PAY_TOAST_ID });
    } else {
      toast.error(message, { id: PAY_TOAST_ID });
    }
  });

  // ---- Category & question selection (pick questions across all topics) ----
  const topics = itemsOf(props, "topics")
    .map((topic) => ({
      title: p(topic, "title", "Questions"),
      description: p(topic, "description", "") || p(topic, "text", ""),
      questions: itemsOf(topic, "questions")
        .map((q) => p(q, "label", "").trim())
        .filter((label) => label.length > 0),
    }))
    .filter((topic) => topic.questions.length > 0);
  const pricePaise = typeof client?.questionPricePaise === "number" ? client.questionPricePaise : 0;

  const [categoryIndex, setCategoryIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<QuestionOrderItem[]>([]);
  const [clientDetails, setClientDetails] = useState<QuestionOrderClientDetails>({
    clientName: "",
    birthDate: "",
    birthTime: "",
    birthPlace: "",
  });
  const setDetail = (key: keyof QuestionOrderClientDetails, value: string) =>
    setClientDetails((cur) => ({ ...cur, [key]: value }));

  const activeTopic = categoryIndex != null && topics[categoryIndex] ? topics[categoryIndex] : null;

  const selectCategory = (index: number) => setCategoryIndex(index);

  useEffect(() => {
    if (categoryIndex != null) {
      const el = document.getElementById(`questions-${categoryIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [categoryIndex]);

  const isQuestionPicked = (question: string, category: string) =>
    picked.some((q) => q.questionText === question && q.category === category);

  const toggleQuestion = (question: string, category: string) => {
    setPicked((cur) =>
      cur.some((q) => q.questionText === question && q.category === category)
        ? cur.filter((q) => !(q.questionText === question && q.category === category))
        : [...cur, { questionText: question, category }],
    );
  };

  const entryList: {
    key: string;
    label: string;
    category: string;
  }[] = picked.map((q) => ({
    key: `${q.category ?? "General"}::${q.questionText}`,
    label: q.questionText,
    category: q.category ?? "General",
  }));

  const totalCount = entryList.length;
  const totalPaise = totalCount * pricePaise;

  const createOrder = async (items: QuestionOrderItem[], details: QuestionOrderClientDetails) => {
    if (!client?.astrologerId) return;
    setSubmitting(true);
    setStatus(null);
    toast.loading("Checking your order and starting payment…", { id: PAY_TOAST_ID });
    try {
      const result = await orderQuestions(client.astrologerId, items, details);
      setStatus({ ok: true, message: "Redirecting to secure payment…" });
      toast.loading("Redirecting to secure payment…", { id: PAY_TOAST_ID });
      const outcome = await runCheckout(result.payment, window.location.href);
      if (outcome === "redirect") return;
      setCategoryIndex(null);
      setPicked([]);
      const successMsg =
        "Payment successful! Your questions have been sent. Track replies and continue chatting from your dashboard.";
      setStatus({ ok: true, message: successMsg });
      toast.success(successMsg, { id: PAY_TOAST_ID });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create your order. Please try again.";
      setStatus({ ok: false, message });
      toast.error(message, { id: PAY_TOAST_ID });
    } finally {
      setSubmitting(false);
    }
  };
  createOrderRef.current = createOrder;

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && auth.token && client?.astrologerId) {
      pendingRef.current = null;
      void createOrderRef.current?.(pending.items, pending.clientDetails);
    }
  }, [authNonce, auth.token, client?.astrologerId]);

  const handleProceed = () => {
    const details = clientDetails;
    if (
      entryList.length === 0 ||
      pricePaise <= 0 ||
      !details.clientName.trim() ||
      !details.birthDate ||
      !details.birthTime ||
      !details.birthPlace.trim()
    )
      return;
    const items: QuestionOrderItem[] = entryList.map((entry) => ({
      questionText: entry.label,
      category: entry.category,
    }));
    const cleanDetails: QuestionOrderClientDetails = {
      clientName: details.clientName.trim(),
      birthDate: details.birthDate,
      birthTime: details.birthTime,
      birthPlace: details.birthPlace.trim(),
    };
    if (!auth.token || !client?.astrologerId) {
      pendingRef.current = { items, clientDetails: cleanDetails };
      onNeedAuth();
      return;
    }
    void createOrder(items, cleanDetails);
  };

  const accepting = client?.isAcceptingQuestions !== false;

  return (
    <SectionShell section={section} edit={edit} selected={isSectionSelected} onSelect={onSelect}>
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
            {(
              <>
                <div className="max-w-4xl">
                      <header className="m-8">
                        <p className="text-sm font-semibold text-indigo-600 mb-2">STEP 1 OF 2</p>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900">Select Your Question Topic</h3>
                        <p className="mt-2 text-gray-500">Choose a topic and select the questions you want answered.</p>
                      </header>

                      {topics.length === 0 ? (
                        <p className="wx-book-note">No question topics are available right now.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {topics.map((topic, index) => {
                              const isCategorySelected = categoryIndex === index;
                              return (
                                <button
                                  key={`${topic.title}-${index}`}
                                  type="button"
                                  onClick={() => selectCategory(index)}
                                  className={`text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
                                    isCategorySelected
                                      ? "border-indigo-600 bg-indigo-50 shadow-md"
                                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="text-lg font-bold text-gray-900">{topic.title}</h4>
                                      {topic.description ? (
                                        <p className="mt-2 text-sm text-gray-500">{topic.description}</p>
                                      ) : null}
                                    </div>
                                    {isCategorySelected && <span className="text-indigo-600 text-xl">✓</span>}
                                  </div>
                                  <div className="mt-4 text-sm font-medium text-indigo-600">
                                    {topic.questions.length} question{topic.questions.length === 1 ? "" : "s"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {activeTopic ? (
                            <div
                              id={`questions-${categoryIndex}`}
                              className="border-t border-gray-200 pt-8"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-5">
                                <div>
                                  <h4 className="text-xl md:text-2xl font-bold text-gray-900">{activeTopic.title}</h4>
                                  <p className="text-sm text-gray-500 mt-1">Select the questions you want to ask.</p>
                                </div>
                                <div className="text-sm font-semibold text-indigo-600">
                                  {totalCount} selected
                                  {pricePaise > 0 ? ` · ${formatPrice(pricePaise)} each` : ""}
                                </div>
                              </div>

                              <div className="space-y-3">
                                {activeTopic.questions.map((question, index) => {
                                  const isQuestionSelected = isQuestionPicked(question, activeTopic.title);
                                  return (
                                    <button
                                      key={question}
                                      type="button"
                                      onClick={() => toggleQuestion(question, activeTopic.title)}
                                      className={`w-full flex items-start gap-4 text-left p-4 rounded-xl border transition-all ${
                                        isQuestionSelected
                                          ? "border-indigo-600 bg-indigo-50"
                                          : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                      }`}
                                    >
                                      <div
                                        className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                                          isQuestionSelected
                                            ? "bg-indigo-600 border-indigo-600 text-white"
                                            : "border-gray-300 bg-white"
                                        }`}
                                      >
                                        {isQuestionSelected && <span className="text-sm">✓</span>}
                                      </div>
                                      <div className="flex-1">
                                        <span className="text-xs font-semibold text-gray-400">QUESTION {index + 1}</span>
                                        <p className="mt-1 text-gray-800 font-medium">{question}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
                              <div className="text-4xl mb-3">✨</div>
                              <h4 className="font-semibold text-gray-800">Choose a topic to continue</h4>
                              <p className="text-sm text-gray-500 mt-1">
                                Select one of the topics above to pick your questions.
                              </p>
                            </div>
                          )}

                          <p className="mt-6 text-sm text-gray-500">
                            Can't find your exact question?{" "}
                            <a href="#book" className="font-semibold text-indigo-600 hover:underline">
                              Book a slot
                            </a>{" "}
                            for a personalised consultation.
                          </p>
                        </>
                      )}

                      <div className="mt-8 pt-6 border-t border-gray-200">
                        {totalCount > 0 && (
                          <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                            <h4 className="text-sm font-bold text-gray-900">Your birth details</h4>
                            <p className="mt-1 text-xs text-gray-500">
                              All fields are required for an accurate reading.
                            </p>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <label className="block sm:col-span-2">
                                <span className="block text-sm font-medium text-gray-700">
                                  Your name <span className="text-red-500">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={clientDetails.clientName}
                                  onChange={(e) => setDetail("clientName", e.target.value)}
                                  placeholder="Full name"
                                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-sm font-medium text-gray-700">
                                  Birth date <span className="text-red-500">*</span>
                                </span>
                                <input
                                  type="date"
                                  value={clientDetails.birthDate}
                                  onChange={(e) => setDetail("birthDate", e.target.value)}
                                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-sm font-medium text-gray-700">
                                  Birth time <span className="text-red-500">*</span>
                                </span>
                                <input
                                  type="time"
                                  value={clientDetails.birthTime}
                                  onChange={(e) => setDetail("birthTime", e.target.value)}
                                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                                />
                              </label>
                              <label className="block sm:col-span-2">
                                <span className="block text-sm font-medium text-gray-700">
                                  Birth place <span className="text-red-500">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={clientDetails.birthPlace}
                                  onChange={(e) => setDetail("birthPlace", e.target.value)}
                                  placeholder="City, country"
                                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-4">
                          <p className="text-sm text-gray-500">
                            {totalCount > 0
                              ? `${totalCount} question${totalCount === 1 ? "" : "s"} selected${
                                  pricePaise > 0
                                    ? ` · Total ${formatPrice(totalPaise)}`
                                    : " · Pricing not configured yet"
                                }`
                              : "No questions selected"}
                          </p>
                          <button
                            type="button"
                            onClick={handleProceed}
                            disabled={
                              totalCount === 0 ||
                              pricePaise <= 0 ||
                              submitting ||
                              !clientDetails.clientName.trim() ||
                              !clientDetails.birthDate ||
                              !clientDetails.birthTime ||
                              !clientDetails.birthPlace.trim()
                            }
                            className="w-full md:w-auto bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            <span className="mr-2">✓</span>
                            {submitting ? "Please wait…" : "Proceed to Payment"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {status ? (
              <p className={status.ok ? "wx-book-ok" : "wx-book-danger"}>{status.message}</p>
            ) : null}
            {auth.user ? (
              <p className="wx-book-note">
                Signed in as {auth.user.email}.{" "}
                <button type="button" className="wx-linkbtn" onClick={auth.signOut}>
                  Sign out
                </button>
                <a className="wx-auth-btn wx-auth-btn-solid" href={dashboardUrl("/dashboard")}>
                  Go to Dashboard
                </a>
                <a className="wx-linkbtn" href={dashboardUrl("/questions")}>
                  Track your questions in your dashboard →
                </a>
              </p>
            ) : (
              <p className="wx-book-note">
                Sign in (or create a free account) to send your question.
                <span className="wx-auth-btns">
                  <button type="button" className="wx-auth-btn" onClick={() => onNeedAuth("signin")}>
                    Sign in
                  </button>
                  <button type="button" className="wx-auth-btn wx-auth-btn-solid" onClick={() => onNeedAuth("signup")}>
                    Create Account
                  </button>
                </span>
              </p>
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
  const logo = getCloudinaryUrl(p(props, "logo"));
  const copyrightText = p(props, "copyright", `© ${new Date().getFullYear()} by ${siteName}`);
  return (
    <SectionShell section={section} edit={edit} selected={selected} onSelect={onSelect}>
      <footer className="wx-footer">
        <div className="wx-footer-inner">
          <a className="wx-footer-logo" href="#top" aria-label={`${siteName} home`}>
            {logo ? <img className="wx-footer-logo-img" src={logo} alt={siteName} /> : null}
            <Editable as="span" className="wx-footer-site-name" field="siteName" section={section} edit={edit} value={siteName} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
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
          </div>
        </div>
        <div className="wx-footer-bottom">
          {edit ? (
            <Editable as="p" className="wx-copyright" field="copyright" section={section} edit={edit} value={copyrightText} onSelectField={(f) => onSelectField?.(section.id, f)}
                onEditValue={(f, v) => onEditValue?.(section.id, f, v)} />
          ) : (
            <p className="wx-copyright">{linkifySuperTalks(copyrightText, SUPERTALKS_URL)}</p>
          )}
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
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
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
    onNeedAuth: (mode?: "signin" | "signup") => {
      setAuthMode(mode ?? "signin");
      setAuthOpen(true);
    },
    authNonce,
  });

  const activeSection = active
    ? site.sections.find((sec) => sec.id === active.sectionId)
    : null;
  const activeStyle = active && activeSection ? fieldStyleOf(activeSection, active.field) : {};
  // Human-friendly labels for otherwise cryptic template field keys.
const FIELD_LABELS: Record<string, string> = {
  siteName: "Site Name",
  // ctaLabel: "Button Text",
  // buttonLabel: "Button Text",
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
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(res) => {
          auth.applyAuth(res);
          handleAuthenticated();
        }}
      />
      {edit ? null : (
        <a className="wx-dash-float" href={dashboardUrl("/dashboard")}>
          My Dashboard
        </a>
      )}
    </main>
  );
}