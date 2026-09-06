export interface SiteSectionDoc {
  id: string;
  type: string;
  name: string;
  default: boolean;
  props: Record<string, unknown>;
}

export interface SiteDocument {
  design: Record<string, unknown>;
  sections: SiteSectionDoc[];
}

export interface SitePayload {
  slug: string;
  astrologerName: string;
  templateId: string;
  templateName: string;
  templatePreviewImageUrl: string | null;
  schema: unknown;
  site: SiteDocument;
}