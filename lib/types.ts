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
  sub: string;
  when: string;
  note: string;
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  days: number;
  stops: Stop[];
  ai?: boolean;
  source?: string | null;
  sources?: AnalyzeSources;
}

export interface AnalyzeSources {
  caption: boolean;
  placeTag: boolean;
  subtitles: boolean;
  audio: boolean;
  userText: boolean;
}

export type AnalyzeResponse =
  | { ok: true; route: Route; sources: AnalyzeSources }
  | { ok: false; code: AnalyzeErrorCode; message: string };

export type AnalyzeErrorCode =
  | "bad_request"
  | "unsupported_link"
  | "need_text"
  | "no_places"
  | "rate_limited"
  | "not_configured"
  | "upstream";
