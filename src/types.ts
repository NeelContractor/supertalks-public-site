export interface FieldStyle {
  fontSize?: string;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textTransform?: string;
}

export interface SiteSectionDoc {
  id: string;
  type: string;
  name: string;
  default: boolean;
  props: Record<string, unknown>;
  fieldStyles?: Record<string, FieldStyle>;
}

export interface SiteDocument {
  design: Record<string, unknown>;
  sections: SiteSectionDoc[];
}

export interface SitePayload {
  slug: string;
  astrologerId?: string;
  astrologerName: string;
  templateId: string;
  templateName: string;
  templatePreviewImageUrl: string | null;
  schema: unknown;
  site: SiteDocument;
  questionPricePaise?: number;
  callPricePerSlotPaise?: number;
  slotDurationMinutes?: number;
  isAcceptingQuestions?: boolean;
  isAcceptingBookings?: boolean;
}