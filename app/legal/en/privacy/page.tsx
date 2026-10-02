import Link from "next/link";
import type { Metadata } from "next";
import { OWNER, SITE } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="legal-lead">
        The honest summary: {SITE.name} doesn&apos;t ask you for an account or an email,
        and doesn&apos;t keep your routes on any server. What you create stays in your own
        browser.
      </p>

      <h2>Who handles your data</h2>
      <p>
        The data controller is {OWNER.name}{OWNER.taxId ? ` (${OWNER.taxId})` : ""}. For
        any privacy question: {OWNER.email}.
      </p>

      <h2>What data is handled</h2>
      <table>
        <thead><tr><th>Data</th><th>What for</th><th>Where it stays</th></tr></thead>
        <tbody>
          <tr>
            <td>The video link you paste</td>
            <td>Downloading the video and taking frames to identify places</td>
            <td>In the server&apos;s memory, cached for up to 6 hours</td>
          </tr>
          <tr>
            <td>Your places and saved routes</td>
            <td>So they are still there when you come back</td>
            <td>Only in your browser (local storage). Never sent to any server</td>
          </tr>
          <tr>
            <td>Your IP address</td>
            <td>Limiting analyses per visitor and preventing abuse</td>
            <td>In the server&apos;s memory, in 10-minute windows</td>
          </tr>
          <tr>
            <td>Technical server logs</td>
            <td>Spotting errors</td>
            <td>Vercel&apos;s infrastructure, temporarily</td>
          </tr>
        </tbody>
      </table>
      <p>
        No name, email, phone number or payment details are collected, because the
        service doesn&apos;t need them.
      </p>

      <h2>Legal basis</h2>
      <ul>
        <li><strong>Providing the service</strong> you ask for: processing the link you paste.</li>
        <li><strong>Legitimate interest</strong>: protecting the service from abuse with the per-IP limit.</li>
        <li><strong>Consent</strong>: for any cookie that isn&apos;t strictly necessary.</li>
      </ul>

      <h2>Who it is shared with</h2>
      <p>Only the providers the app needs to work:</p>
      <ul>
        <li><strong>Vercel</strong>: hosting, running the server, and anonymous, aggregated visit statistics (no cookies or personal identifiers).</li>
        <li><strong>Anthropic</strong>: the model that reads the frames and identifies places. It receives the video&apos;s images and text, not personal data about you.</li>
        <li><strong>Esri (ArcGIS)</strong>: the globe&apos;s satellite imagery. Your browser downloads it directly from their servers, which see your IP address.</li>
        <li><strong>Mapbox</strong>: geocoding the places detected.</li>
        <li><strong>TikTok and Instagram</strong>: the public content of the link you paste is fetched.</li>
      </ul>
      <p>Data is never sold or shared for advertising.</p>

      <h2>How long it is kept</h2>
      <ul>
        <li>Cached analyses: up to 6 hours.</li>
        <li>Per-IP limit: 10-minute windows.</li>
        <li>Your routes: in your browser, until you delete them or clear the site&apos;s data.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can exercise your rights of access, rectification, erasure, objection,
        restriction and portability by writing to {OWNER.email}. Since the service keeps
        no data that identifies you, in practice the quickest way to delete everything is
        to clear this site&apos;s data in your browser.
      </p>
      <p>
        If you think your rights haven&apos;t been respected, you can complain to the
        Spanish Data Protection Agency (<span className="nowrap">aepd.es</span>) or to
        the data protection authority where you live.
      </p>

      <h2>Children</h2>
      <p>
        The service isn&apos;t aimed at children under 14 and doesn&apos;t knowingly
        collect their data.
      </p>

      <h2>Cookies and affiliate links</h2>
      <p>
        They have their own pages: <Link href="/legal/en/cookies">cookies</Link> and{" "}
        <Link href="/legal/en/affiliates">affiliate links</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date at the bottom is updated. Important changes will
        be announced in the app itself.
      </p>
    </>
  );
}
