import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteRenderer } from "../lib/site-render";
import type { FieldStyle, SiteDocument, SitePayload } from "../types";

// Client-bundled code: never touch `process` directly (not defined in the browser).
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
const API_BASE = env.BUN_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
const EDITOR_ORIGIN = env.BUN_PUBLIC_EDITOR_ORIGIN ?? "http://localhost:3001";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const res = await fetch(
      `${API_BASE}/astrologers/${encodeURIComponent(params.slug)}/site`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      throw new Error("Site not found");
    }
    const payload = (await res.json()) as SitePayload;
    return payload;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.astrologerName}'s Site`
          : "Astrologer Site",
      },
    ],
  }),
  component: SitePage,
});

function SitePage() {
  const data = Route.useLoaderData();
  const [site, setSite] = useState(data.site);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const lastSelectRef = useRef<{ sectionId: string; fieldKey: string | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;
    setEdit(true);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EDITOR_ORIGIN) return;
      const msg = event.data as {
        type?: string;
        site?: SiteDocument;
        sectionId?: string;
        fieldKey?: string;
      } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "supertalks:site-data" && msg.site) {
        setSite(msg.site);
      } else if (msg.type === "supertalks:select") {
        setSelectedSectionId(msg.sectionId ?? null);
        if (msg.sectionId) {
          setSelectedFieldKey(msg.fieldKey ?? null);
          // Skip the scroll when this select is merely the parent echoing back
          // a selection the user made inside the preview itself. Otherwise the
          // iframe smoothly scrolls the clicked text away from the click point
          // and the floating toolbar overlaps it.
          const last = lastSelectRef.current;
          const isSelfEcho =
            last !== null &&
            last.sectionId === msg.sectionId &&
            last.fieldKey === (msg.fieldKey ?? null);
          if (isSelfEcho) return;

          // Bring the section into view when it is selected in the editor's
          // customize list (hero section renders as data-st-section-id="hero").
          window.requestAnimationFrame(() => {
            const el = document.querySelector(`[data-st-section-id="${msg.sectionId}"]`);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const alreadyVisible =
              rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
            if (!alreadyVisible) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });
        }
      }
    };

    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "supertalks:ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSelect = (id: string) => {
    setSelectedSectionId(id);
    setSelectedFieldKey(null);
    lastSelectRef.current = { sectionId: id, fieldKey: null };
    if (edit) {
      window.parent?.postMessage({ type: "supertalks:select", sectionId: id }, "*");
    }
  };

  const handleSelectField = (sectionId: string, field: string) => {
    setSelectedSectionId(sectionId);
    setSelectedFieldKey(null);
    lastSelectRef.current = { sectionId, fieldKey: field };
    if (edit) {
      window.parent?.postMessage(
        { type: "supertalks:select", sectionId, fieldKey: field },
        "*",
      );
    }
  };

  const setPathValue = (target: unknown, path: string, value: unknown): unknown => {
    const [head, ...rest] = path.split(".");
    if (!head) return target;
    if (rest.length === 0) {
      if (Array.isArray(target)) {
        const arr = [...target];
        arr[Number(head)] = value;
        return arr;
      }
      return { ...((target as Record<string, unknown>) ?? {}), [head]: value };
    }
    if (Array.isArray(target)) {
      const arr = [...target];
      arr[Number(head)] = setPathValue(arr[Number(head)], rest.join("."), value);
      return arr;
    }
    return {
      ...((target as Record<string, unknown>) ?? {}),
      [head]: setPathValue(
        (target as Record<string, unknown> | undefined)?.[head],
        rest.join("."),
        value,
      ),
    };
  };

  const applyFieldEdit = (
    sectionId: string,
    fieldKey: string,
    patch: { value?: string; style?: FieldStyle | null },
  ) => {
    setSite((current) => {
      if (!current) return current;
      const sections = current.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        let next = sec;
        if (patch.value !== undefined) {
          next = {
            ...next,
            props: setPathValue(sec.props, fieldKey, patch.value) as Record<string, unknown>,
          };
        }
        if (patch.style !== undefined) {
          const fieldStyles = { ...(sec.fieldStyles ?? {}) };
          if (patch.style === null) {
            delete fieldStyles[fieldKey];
          } else {
            fieldStyles[fieldKey] = patch.style;
          }
          next = { ...next, fieldStyles };
        }
        return next;
      });
      return { ...current, sections };
    });
    window.parent?.postMessage(
      { type: "supertalks:edit", sectionId, fieldKey, ...patch },
      "*",
    );
  };

  return (
    <SiteRenderer
      site={site}
      edit={edit}
      selectedSectionId={selectedSectionId}
      activeFieldKey={selectedFieldKey}
      onSelect={handleSelect}
      onSelectField={handleSelectField}
      onEditField={applyFieldEdit}
      client={data}
    />
  );
}