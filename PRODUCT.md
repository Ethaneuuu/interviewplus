# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

University students and early-career candidates recruiting for investment banking, private equity, and M&A roles (internships and full-time), preparing for real technical interviews. Access is currently gated to an allowlist (`authorized_users` in Supabase, no public signup, no guest mode) as a private beta — the gate is a current operating state, not the permanent target audience.

## Product Purpose

A bilingual (FR/EN) training platform for M&A/IB interview prep: timed question sessions drawn from a 3,482-entry bilingual bank, plus DCF/LBO/Merger Model practical cases at three difficulty levels. Success means a candidate walks into a real interview having drilled both technical Q&A and full financial-model cases under time pressure, with graded feedback on each.

## Positioning

Three things a memorization app or a generic AI quiz tool couldn't truthfully copy:

1. **No browsing before a session.** The question bank and case answer keys are never explorable up front — a candidate can't cram the exact answer set, only train against it live.
2. **Deterministic case grading.** DCF/LBO/Merger Model cases are scored by server-side financial formulas with absolute tolerances, not by an LLM's judgment call; AI is used only for optional narrative recommendation feedback, capped and non-authoritative on the numeric score.
3. **Fully bilingual FR/EN**, not a translated afterthought — templates, question bank, and results are localized for all language/theme combinations.

Real bank wordmarks (Goldman Sachs, J.P. Morgan, Morgan Stanley, Evercore, Lazard, Rothschild & Co, Blackstone, KKR) are used as a trust signal, reinforcing a rigorous, exam-like tone rather than a casual flashcard app.

## Operating Context

- Solo, timed practice sessions: candidate picks language/theme/count/time (Questions) or theme/difficulty/time (Cases), then works against a countdown with pause/quit/resume.
- Correction happens immediately after submission (Questions: AI-graded via OpenRouter with local-degraded fallback; Cases: deterministic server formulas, optional AI narrative).
- Progress and history live in a personal profile (`profile.html`): past sessions, resume banner for paused sessions, progress charts.
- Deployed as a live Netlify site backed by Supabase for auth/history/private storage; no framework, native HTML/CSS/JS client.

## Capabilities and Constraints

- No framework, no new client dependencies; SheetJS (already present) is the only bundled library.
- Question bank (3,482 bilingual entries) and case grading formulas are never shipped to the public bundle or exposed before submission.
- `/api/correct` is the single application endpoint; Questions use AI grading with a free→paid OpenRouter model fallback and a `local-degraded` client-side fallback if both fail; Cases are graded deterministically server-side, with AI touching only an optional bounded narrative field.
- Payments/entitlements are explicitly out of scope for now (see Roadmap below) — no paywall, credit ledger, or checkout exists.
- Restricted access model: signup is allowlist-gated (`authorized_users`), no guest access.

## Brand Commitments

- Name: **InterviewPlus**.
- Bilingual FR/EN across the entire product surface (UI chrome, question bank, case templates, results) — not optional or partial.
- Real, publicly-sourced (Wikimedia Commons, public domain) bank wordmark logos used as social proof; not placeholder or invented logos.

## Evidence on Hand

- `Questions_InterviewPlus_Bilingual.xlsx`: 3,482 real bilingual Q&A entries with keywords, stored privately (Supabase bucket), not in the public repo/bundle.
- Real bank logos (Goldman Sachs, J.P. Morgan, Morgan Stanley, Evercore, Lazard, Rothschild & Co, Blackstone, KKR), sourced from Wikimedia Commons, public domain.
- No testimonials, case studies, press, or user-count claims exist — do not fabricate any.

## Product Principles

1. Rigor over convenience: no shortcuts that let a candidate memorize instead of perform (no pre-session browsing, no exposed answer keys).
2. Grading must be trustworthy and reproducible: deterministic math for anything scoreable by formula; AI is a bounded assist, never the sole arbiter of a numeric case score.
3. Bilingual is a first-class constraint, not a translation pass — every new theme/template/copy change ships in both languages.
4. Minimal dependency footprint: native web platform features and already-installed tools before new frameworks or libraries.
5. Private/allowlisted access can change later (roadmap includes broader access and paid sessions) but must never be assumed unlocked in current UX decisions.

## Accessibility & Inclusion

Keyboard focus must remain visible; `prefers-reduced-motion` must be respected (both already implemented and covered by existing smoke tests). No further accessibility standard has been confirmed as a requirement.
