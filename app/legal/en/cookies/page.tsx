import Link from "next/link";
import type { Metadata } from "next";
import { OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie policy · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Cookie policy</h1>
      <p className="legal-lead">
        This website uses no tracking or advertising cookies. To know how many people
        visit, it uses Vercel Web Analytics, which sets no cookies: it counts visits in an
        aggregated, anonymous way, and the session is discarded after 24 hours.
      </p>

      <h2>What is used</h2>
      <p>
        <strong>Your browser&apos;s local storage</strong> (<code>localStorage</code>),
        which technically isn&apos;t a cookie but is worth explaining anyway. It keeps your
        places and routes on your own device so they are there when you come back. It is
        never sent to any server, doesn&apos;t travel with requests, and nobody else can
        read it.
      </p>
      <p>
        It is strictly necessary for the app to do what you expect, so it doesn&apos;t
        need prior consent.
      </p>

      <h2>How to delete it</h2>
      <p>
        From your browser&apos;s settings, by clearing this site&apos;s data. You can also
        delete your routes one by one inside the app.
      </p>

      <h2>When there are affiliate links</h2>
      <p>
        Affiliate links to activity platforms are planned. Those links do set third-party
        cookies to attribute a booking, and{" "}
        <strong>they won&apos;t be switched on without asking you first</strong> through a
        consent notice. As long as this paragraph is here and you haven&apos;t seen that
        notice, there aren&apos;t any yet.
      </p>
      <p>
        More in <Link href="/legal/en/affiliates">affiliate links</Link>.
      </p>

      <h2>Questions</h2>
      <p>Write to {OWNER.email}.</p>
    </>
  );
}
