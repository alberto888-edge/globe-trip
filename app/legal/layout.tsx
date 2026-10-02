import type { Metadata } from "next";
import LegalFrame from "./LegalFrame";

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <LegalFrame>{children}</LegalFrame>;
}
