export type PinType = "visitado" | "wishlist";

export interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: PinType;
}

export interface Stop {
  name: string;
  country?: string;
  sub: string;
  when: string;
  note: string;
  lat: number;
  lng: number;
  days?: number;
  wiki?: string; // Wikipedia (es) article title, for the photo and blurb
}

export interface Budget {
  currency: string;
  total: number;
  perPerson?: number;
  breakdown: { label: string; amount: number }[];
  note?: string;
}

export interface Route {
  id: string;
  name: string;
  days: number;
  stops: Stop[];
  kind?: "video" | "plan" | "demo";
  ai?: boolean;
  source?: string | null;
  sources?: AnalyzeSources;
  summary?: string;
  budget?: Budget;
  tips?: string[];
}

export interface AnalyzeSources {
  caption: boolean;
  placeTag: boolean;
  subtitles: boolean;
  audio: boolean;
  userText: boolean;
  frames?: number;
}

/** A place detected in a video, before the person picks which ones they want. */
export interface Candidate {
  name: string;
  country?: string;
  sub: string;
  note: string;
  lat: number;
  lng: number;
  days: number;
  wiki?: string;
  frame?: number; // index into AnalyzeOk.frames
}

export interface AnalyzeOk {
  ok: true;
  name: string;
  candidates: Candidate[];
  frames: string[]; // small JPEG data URLs from the video, for the picker
  cover?: string;
  source: string | null;
  sources: AnalyzeSources;
}

export type AnalyzeResponse = AnalyzeOk | { ok: false; code: AnalyzeErrorCode; message: string };

export type AnalyzeErrorCode =
  | "bad_request"
  | "unsupported_link"
  | "no_places"
  | "rate_limited"
  | "not_configured"
  | "upstream";

export type BudgetLevel = "mochilero" | "medio" | "alto";

export interface PlanRequest {
  destination?: string;
  theme?: string;
  days: number;
  budget: BudgetLevel;
  budgetAmount?: number;
  origin?: string;
  travelers: number;
}

export type PlanResponse = { ok: true; route: Route } | { ok: false; code: AnalyzeErrorCode; message: string };
