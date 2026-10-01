import Link from "next/link";
import type { Metadata } from "next";
import { LAST_UPDATED, SITE } from "@/lib/legal";

export const metadata: Metadata = { robots: { index: true, follow: true } };

const PAGES = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/afiliacion", label: "Enlaces de afiliado" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="legal-back">← Volver a {SITE.name}</Link>
      <article>{children}</article>
      <footer className="legal-foot">
        <nav>
          {PAGES.map((p) => (
            <Link key={p.href} href={p.href}>{p.label}</Link>
          ))}
        </nav>
        <p>Última actualización: {LAST_UPDATED}</p>
      </footer>
    </main>
  );
}
