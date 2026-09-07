import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteRenderer } from "../lib/site-render";
import type { SitePayload } from "../types";

// Client-bundled code: never touch `process` directly (not defined in the browser).
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};
const API_BASE = env.BACKEND_URL ?? "http://localhost:3000";
const EDITOR_ORIGIN = env.EDITOR_ORIGIN ?? "http://localhost:3001";

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
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;
    setEdit(true);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EDITOR_ORIGIN) return;
      const msg = event.data as { type?: string; site?: typeof site; sectionId?: string } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "supertalks:site-data" && msg.site) {
        setSite(msg.site);
      } else if (msg.type === "supertalks:select") {
        setSelectedSectionId(msg.sectionId ?? null);
        if (msg.sectionId) {
          // Bring the section into view when it is selected in the editor's
          // customize list (hero section renders as data-st-section-id="hero").
          window.requestAnimationFrame(() => {
            document
              .querySelector(`[data-st-section-id="${msg.sectionId}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    if (edit) {
      window.parent?.postMessage({ type: "supertalks:select", sectionId: id }, "*");
    }
  };

  return (
    <SiteRenderer
      site={site}
      edit={edit}
      selectedSectionId={selectedSectionId}
      onSelect={handleSelect}
      client={data}
    />
  );
}