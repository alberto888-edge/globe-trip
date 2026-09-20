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

/** How safe the trip is, on the same 1–4 scale Spain's Foreign Office uses. */
export interface TripRisk {
  level: 1 | 2 | 3 | 4; // 1 normal · 2 precaución · 3 evitar zonas / viajes no esenciales · 4 no viajar
  summary: string;
  points: string[];
  countries: string[]; // countries the route goes through, in Spanish (for the official advice links)
}

export interface Route {
  id: string;
  name: string;
  days: number;
  stops: Stop[];
  kind?: "video" | "plan" | "demo" | "ready";
  risks?: TripRisk;
  request?: Partial<PlanRequest>; // what to prefill when adapting this trip
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
  scope?: "place" | "region" | "country"; // a whole country/region means the video didn't name concrete spots
}

export interface AnalyzeOk {
  ok: true;
  name: string;
  candidates: Candidate[];
  frames: string[]; // small JPEG data URLs from the video, for the picker
  cover?: string;
  source: string | null;
  sources: AnalyzeSources;
  risks?: TripRisk;
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

export type TravelerLevel = "primera" | "intermedio" | "experto";

export interface PlanRequest {
  destination?: string;
  theme?: string;
  days?: number; // missing = let the planner pick the ideal length
  styles?: string[]; // "Lo imprescindible", "Explorador", "Histórico"…
  level?: TravelerLevel;
  multiCountry?: boolean; // allow neighbouring countries
  context?: string; // e.g. what a video showed
  budget: BudgetLevel;
  budgetAmount?: number;
  origin?: string;
  travelers: number;
}

export type PlanResponse = { ok: true; route: Route } | { ok: false; code: AnalyzeErrorCode; message: string };
