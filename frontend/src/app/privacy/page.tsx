import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy · Misir",
  description: "How Misir collects, uses, shares, and protects personal data.",
}

const POLICY_VERSION = "2026-06-07"

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <div className="mb-8 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
        <strong>Draft — pending legal review.</strong> This template documents Misir&apos;s intended
        data practices. It must be reviewed and finalized by qualified privacy counsel (and the
        bracketed placeholders completed) before launch.
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Version {POLICY_VERSION}</p>

      <div className="prose-sm mt-8 space-y-8 text-[15px] leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Who we are</h2>
          <p className="mt-2 text-muted-foreground">
            Misir (&quot;we&quot;) provides a decision-readiness tool with an optional browser
            extension. Data controller: <em>[legal entity, address]</em>. EU/EEA representative
            (GDPR Art 27): <em>[name, address]</em>. Data Protection Officer: <em>[contact]</em>.
            Contact for privacy requests: <em>[privacy@…]</em>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li><strong>Account data:</strong> your email and identifier (via Clerk).</li>
            <li>
              <strong>Content you choose to capture:</strong> with your explicit consent, the
              extension saves readable text from pages and/or your AI-chat conversations that match
              your spaces. Capture is <strong>off by default</strong>, per-purpose, and can be
              withdrawn at any time. Obvious direct identifiers are redacted on your device before
              upload.
            </li>
            <li><strong>Usage signals:</strong> engagement metrics (e.g. dwell/scroll) on captured items.</li>
            <li><strong>Derived data:</strong> AI-generated insights, gaps, and nudges.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            We do not intentionally collect special-category data or the personal data of third
            parties. Please do not capture pages or conversations containing others&apos; sensitive
            information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Why we process it (lawful bases)</h2>
          <p className="mt-2 text-muted-foreground">
            We process account data to provide the service (contract). All content capture and
            related profiling is based on your <strong>explicit, opt-in consent</strong> (GDPR
            Art 6(1)(a)/Art 9(2)(a); ePrivacy Art 5(3); CCPA opt-in for sensitive personal
            information; Bangladesh PDPO explicit consent). You may withdraw consent at any time in
            Settings without affecting prior processing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Sharing &amp; sub-processors</h2>
          <p className="mt-2 text-muted-foreground">
            We use vetted processors under data-processing agreements: <strong>Clerk</strong>
            (authentication), <strong>Supabase</strong> (database/hosting), and <strong>Groq</strong>
            (AI inference for synthesis). We do <strong>not</strong> sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. International transfers</h2>
          <p className="mt-2 text-muted-foreground">
            Data may be processed in the United States. Where required, transfers rely on the EU-US
            Data Privacy Framework and/or Standard Contractual Clauses with a transfer-impact
            assessment. Bangladesh transfers follow the PDPO cross-border regime. EU/EEA hosting
            options: <em>[region]</em>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Retention</h2>
          <p className="mt-2 text-muted-foreground">
            Captured content and derived data are retained for up to <strong>[400] days</strong>
            and then purged, unless you delete them sooner. Account data is kept until you delete
            your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Your rights</h2>
          <p className="mt-2 text-muted-foreground">
            Depending on where you live (EU/EEA, UK, US states, Bangladesh) you can access, correct,
            export, and delete your data, withdraw consent, and object to or restrict processing.
            Use <strong>Settings → Privacy &amp; data</strong> to export or delete your account, or
            contact us. California residents: see{" "}
            <Link href="/privacy/do-not-sell" className="text-primary underline">
              Do Not Sell or Share My Personal Information
            </Link>
            . We honor the <strong>Global Privacy Control (GPC)</strong> signal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Children</h2>
          <p className="mt-2 text-muted-foreground">
            Misir is not directed to children. You must be at least 18 to use it. We do not
            knowingly collect data from minors; contact us to report any such collection.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Automated processing</h2>
          <p className="mt-2 text-muted-foreground">
            Insights, gaps, and nudges are generated by AI to assist you. They are advisory and do
            not produce legal or similarly significant effects without your involvement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Changes &amp; contact</h2>
          <p className="mt-2 text-muted-foreground">
            We will notify you of material changes and ask for renewed consent where required.
            Questions or complaints: <em>[privacy@…]</em>. You may also lodge a complaint with your
            local supervisory authority.
          </p>
        </section>
      </div>

      <div className="mt-12 text-sm">
        <Link href="/" className="text-primary underline">← Back to Misir</Link>
      </div>
    </main>
  )
}
