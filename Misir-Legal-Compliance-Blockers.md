# Misir — Legal & Privacy Compliance: Launch Blockers & How to Close Them

**Date:** 2026-06-07
**Scope:** Pre-launch data-protection blockers for EU/EEA, USA, and Bangladesh.
**Status:** The code-side privacy mechanisms are built and verified (consent, DSAR,
retention, redaction, GPC, audit). The items below are the **non-code** blockers
that remain — decisions, legal artifacts, signed agreements, and a finalized
policy. **These gate an EU/Bangladesh launch.**

> ⚠️ **Not legal advice.** This document is an engineering-side compliance map to
> brief your privacy counsel / DPO. A qualified lawyer must review and complete it
> (and the drafted documents in §6) before launch.

---

## 0. TL;DR

| # | Blocker | Type | Gates | Owner |
|---|---|---|---|---|
| B1 | Decide & resolve third-party AI-token harvesting (R8) | Decision + legal | EU/US/BD + Web Store | Eng + Legal |
| B2 | DPIA (Data Protection Impact Assessment) | Legal artifact | EU (mandatory) | DPO/Legal |
| B3 | RoPA (Records of Processing, Art 30) | Legal artifact | EU | DPO/Legal |
| B4 | Appoint DPO (Art 37) + EU/EEA representative (Art 27) | Appointment | EU | Company |
| B5 | Signed DPAs + transfer mechanism (SCCs/DPF + TIA) | Contracts | EU/BD | Legal |
| B6 | Finalize the privacy policy + notices (drafts exist — §6) | Legal review | EU/US/BD | Legal |
| B7 | Bangladesh PDPO: localization + cross-border assessment | Legal | BD | Legal |
| B8 | Data-residency decision (EU region hosting) | Decision + infra | EU | Eng + Legal |
| B9 | Breach-notification process (Art 33/34 — 72h) | Process | EU/US/BD | Ops + Legal |

---

## 1. B1 — Third-party AI-token harvesting (R8) — **highest-priority decision**

**What it is:** the extension captures AI-chat transcripts by reading other
services' auth tokens/cookies (`inject-web.js` monkey-patches `window.fetch`;
adapters read `localStorage`/cookies on ChatGPT/Kimi/etc.) and calling those
providers' private APIs. It is currently **consent-gated** but still present.

**Why it's a blocker:** beyond privacy, this is plausibly **unauthorized access**
under the US **CFAA** and Bangladesh **Cyber Security Ordinance 2025**, a likely
**breach of each provider's Terms of Service**, and a **Chrome Web Store**
"Limited Use / Single Purpose" violation that can get the extension removed.

**How to close it (pick one):**
- **(Recommended) Remove it.** Drop the token/cookie harvesting + `inject-web.js`
  fetch hook; capture only content the user explicitly selects/exports. This is
  the clean path and removes the legal exposure. *(Eng can do this on your
  go-ahead — it removes the AI-chat auto-capture feature.)*
- **Or** obtain written legal sign-off + review each provider's ToS and the
  Chrome Web Store policy, and gate behind explicit, provider-specific consent.

---

## 2. B2–B4 — EU governance artifacts (mandatory before processing)

- **B2 DPIA (Art 35):** mandatory here — large-scale processing that can include
  special-category data + systematic monitoring (engagement metrics). Document
  the processing, risks, and mitigations (consent gate, redaction, retention,
  minimization). *How:* DPO/legal drafts using the data map in
  `Misir-Privacy-Compliance-Report.md` + the implemented mitigations.
- **B3 RoPA (Art 30):** record of all processing activities, purposes, data
  categories, recipients (Clerk/Supabase/Groq), transfers, retention. *How:*
  template from EDPB; populate from the data map.
- **B4 DPO + EU representative:** core activity = regular, systematic monitoring
  at scale → **DPO required (Art 37)**; non-EU controller serving EU →
  **Art 27 EU/EEA representative required**. *How:* appoint internally or engage
  a service; record names/contacts and put them in the privacy policy (§6).

---

## 3. B5 — Sub-processor DPAs + international transfers

**What:** signed **Data Processing Agreements (Art 28)** with **Clerk, Supabase,
Groq**, plus a lawful **Chapter V transfer** basis for EU→US data.

**How to close:**
- Execute each vendor's DPA (all three offer one) and keep them on file.
- Transfer basis: **Clerk** is DPF-certified; **Groq & Supabase** are not on the
  DPF list → use the **2021 SCCs (Modules 2/3)** + a **Transfer Impact
  Assessment (TIA)**. Confirm none use your data for model training (DPA terms).
- Keep a current **sub-processor list** and notify users of changes.

---

## 4. B7 — Bangladesh PDPO 2025

**What:** Bangladesh now has the **Personal Data Protection Ordinance 2025**
(amended Jan/Feb 2026) — extraterritorial; "child" = under 18; a cross-border
transfer regime + residual **data-localization** for some data classes;
turnover-based fines (enforcement body ramps to ~May 2027 but obligations apply).

**How to close:** legal assessment of (a) whether any data class triggers
in-country storage, (b) the cross-border transfer basis (consent/contract), and
(c) significant-data-fiduciary duties if thresholds are met. Map to the
`DATA_REGION` config + residency decision (B8).

---

## 5. B8/B9 — Residency + breach process

- **B8 Data residency:** decide whether EU users' data must be hosted in the EU.
  If so, provision EU-region Supabase/Clerk and set `DATA_REGION=EU`. *(Infra
  decision; the code already records intent via `DATA_REGION`.)*
- **B9 Breach notification:** stand up a runbook for **GDPR Art 33/34 (72-hour)**
  notification + the BD/CCPA equivalents, plus the **audit log** (already
  implemented) and access logging to actually scope a breach.

---

## 6. ⚠️ Drafts & placeholders that MUST be completed + legally reviewed

The engineering work shipped **drafts with placeholders**. They are functional
but **not launch-ready** until counsel finalizes the content and the bracketed
fields are filled:

| Artifact | File | Placeholders / TODO |
|---|---|---|
| **Privacy Policy page** | `frontend/src/app/privacy/page.tsx` | Banner says *"Draft — pending legal review."* Fill: `[legal entity, address]`, EU representative `[name, address]`, DPO `[contact]`, `[privacy@…]`, retention `[400] days`, EU-residency `[region]`. Confirm all 10 sections with counsel. |
| **"Do Not Sell/Share" page** | `frontend/src/app/privacy/do-not-sell/page.tsx` | Confirm the CCPA/CPRA wording + that "we do not sell" is accurate for your final data flows. |
| **Compliance audit report** | `Misir-Privacy-Compliance-Report.md` | Internal reference (the full EU/US/BD gap analysis + data map) — use to populate the DPIA/RoPA. |
| **Policy version** | backend `PRIVACY_POLICY_VERSION` (config, `2026-06-07`) | Bump whenever the policy text changes so re-consent is triggered. |
| **Consent purposes** | backend `consent_purpose` enum + extension/frontend | `web_capture`, `ai_chat_capture`, `analytics`, `marketing` — confirm these match the finalized policy's stated purposes. |
| **Retention period** | backend `RETENTION_DAYS` (`400`) + pg_cron | Must equal the number published in the finalized privacy policy. |

**Action:** treat every bracketed `[...]` in the privacy pages as a required
field. Do not launch with the "Draft — pending legal review" banner present.

---

## 7. What is already DONE in code (so counsel knows the mitigations exist)

Consent gate (capture off by default, server-enforced) · DSAR endpoints
(`GET/PUT /me/consent`, `GET /me/export`, `DELETE /me` with cascade + best-effort
Clerk-identity deletion) · retention purge (`RETENTION_DAYS` + pg_cron) ·
on-device PII redaction before upload · GPC honoring · audit log ·
notice/consent banner + 18+ age gate · security hardening (IDOR fix, JWT issuer
pinning, rate-limiting/DoS, scoped extension permissions, no JWT at rest). See
`security-posture` / `privacy-compliance` notes and `Misir-Privacy-Compliance-Report.md`.

---

## 8. Recommended sequence

1. **B1 decision** (remove harvesting — unblocks the worst exposure).
2. Engage counsel → **B6** (finalize policy/§6) + **B2/B3** (DPIA/RoPA).
3. **B4** (appoint DPO + EU rep) and **B5** (sign DPAs + SCCs/TIA) in parallel.
4. **B8/B7** residency + Bangladesh assessment; set `DATA_REGION` + provision.
5. **B9** breach runbook. Then EU/BD launch is defensible.

A **US-only limited pilot** can proceed earlier: it mainly needs a finalized
privacy policy (§6), the DSAR flows (done), and the B1 decision — not the EU
DPIA/RoPA/DPO/rep artifacts.
