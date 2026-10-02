"use client";
// The frame around the legal pages, in the language of the page: Spanish under /legal,
// English under /legal/en. Each page links to its version in the other language.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAST_UPDATED, LAST_UPDATED_EN, SITE } from "@/lib/legal";

const ES = [
  { href: "/legal/aviso-legal", label: "Aviso legal", other: "/legal/en/legal-notice" },
  { href: "/legal/privacidad", label: "Privacidad", other: "/legal/en/privacy" },
  { href: "/legal/cookies", label: "Cookies", other: "/legal/en/cookies" },
  { href: "/legal/afiliacion", label: "Enlaces de afiliado", other: "/legal/en/affiliates" },
];
const EN = [
  { href: "/legal/en/legal-notice", label: "Legal notice", other: "/legal/aviso-legal" },
  { href: "/legal/en/privacy", label: "Privacy", other: "/legal/privacidad" },
  { href: "/legal/en/cookies", label: "Cookies", other: "/legal/cookies" },
  { href: "/legal/en/affiliates", label: "Affiliate links", other: "/legal/afiliacion" },
];

export default function LegalFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "";
  const en = path.startsWith("/legal/en");
  const pages = en ? EN : ES;
  const other = pages.find((p) => p.href === path)?.other;
  return (
    <main className="legal" lang={en ? "en" : "es"}>
      <Link href="/" className="legal-back">{en ? `← Back to ${SITE.name}` : `← Volver a ${SITE.name}`}</Link>
      {other && <Link href={other} className="legal-other" lang={en ? "es" : "en"}>{en ? "Versión en español" : "English version"}</Link>}
      <article>{children}</article>
      <footer className="legal-foot">
        <nav>
          {pages.map((p) => (
            <Link key={p.href} href={p.href}>{p.label}</Link>
          ))}
        </nav>
        <p>{en ? `Last updated: ${LAST_UPDATED_EN}` : `Última actualización: ${LAST_UPDATED}`}</p>
      </footer>
    </main>
  );
}
