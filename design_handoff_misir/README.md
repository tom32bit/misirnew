# Handoff: Misir Dashboard & Onboarding

## Overview

Misir is a decision-readiness tool for founders and operators. It connects research captures (articles, AI chat threads, PDFs, posts) across multiple "spaces" (active challenges like "Raise Series A") and tells the user when they have enough signal to act.

The product has two deliverables in this handoff:
1. **Onboarding** — A 3-step first-run flow that creates the user's first space
2. **Dashboard** — The full product UI with 6 views (Home, Inbox, Notifications, Collection, Comparison, Decision)

---

## About the Design Files

The files in this bundle are **high-fidelity design prototypes built in HTML/CSS/JS**. They are working interactive demos, not production code. Your task is to **recreate these designs in your target codebase's environment** (React, Next.js, etc.) using its established patterns, routing, and component libraries.

Do not ship the HTML files directly. Use them as pixel-accurate design references. The data layer (`data.js`) is prototype-only mock data — replace with real API calls.

---

## Fidelity

**High-fidelity.** These are pixel-accurate mockups with final:
- Colors, typography, and spacing (all tokenized in `colors_and_type.css`)
- Interactions: hover states, transitions, modal animations, compact/expanded toggles
- Copy: all labels, empty states, and microcopy are final
- Responsive behavior: mobile layout is fully designed (≤767px breakpoint)
- Dark mode: fully implemented and tuned

---

## Design System Tokens

All tokens live in `colors_and_type.css`. Implement these as your CSS custom properties or design token system.

### Colors

**Brand**
```
--brand-orange:        #FF6C3C   /* Accent — signal only, never wallpaper */
--brand-orange-hover:  #F25C2A
--brand-orange-press:  #DC4D1C
--brand-orange-soft:   #FFE8DF
--brand-orange-tint:   #FFF4EE
```

**Neutral scale (warm gray)**
```
--gray-0:   #FFFFFF
--gray-25:  #FAFAF9
--gray-50:  #F5F4F2
--gray-100: #ECEAE6
--gray-150: #E0DDD8
--gray-200: #D4D0CA
--gray-300: #B8B3AC
--gray-400: #908A82
--gray-500: #6E6862
--gray-600: #4F4A45
--gray-700: #36322E
--gray-800: #211E1B
--gray-900: #141210
```

**Semantic (light mode)**
```
--bg:           #FFFFFF        /* Canvas */
--bg-subtle:    #FAFAF9        /* Sidebar / off-canvas */
--bg-muted:     #F5F4F2        /* Cards, hover fill */
--bg-inset:     #ECEAE6        /* Inset wells */
--bg-hover:     rgba(20,18,16,0.04)
--bg-active:    rgba(20,18,16,0.06)

--fg:           #141210        /* Primary text */
--fg-muted:     #4F4A45        /* Secondary */
--fg-subtle:    #908A82        /* Metadata */
--fg-faint:     #B8B3AC        /* Placeholder / disabled */
--fg-on-accent: #FFFFFF

--border:        #ECEAE6
--border-strong: #D4D0CA

--accent:        #FF6C3C
--accent-hover:  #F25C2A

--success: #2E7D55
--warning: #B8730D
--danger:  #C0392B
```

**Dark mode overrides**
```
--bg:           #0E0D0B
--bg-subtle:    #141210
--bg-muted:     #1B1916
--bg-inset:     #221F1B
--bg-hover:     rgba(255,255,255,0.04)
--bg-active:    rgba(255,255,255,0.06)

--fg:           #F5F4F2
--fg-muted:     #B8B3AC
--fg-subtle:    #6E6862
--fg-faint:     #4F4A45

--border:        #211E1B
--border-strong: #36322E
```

**Space accent colors** (one per space, used for dots, bars, rings, tags)
```
series-a: #FF6C3C
roadmap:  #2A6A4A
fleet:    #2A4A7A
hire:     #7A3FA0
```

**Comparison source left-border colors**
```
Claude: #FF6C3C
Gemini: #2A4A7A
Web:    #2A6A4A
```

### Typography

**Font families**
```
--font-sans:    "Inter"         /* UI / body */
--font-display: "Inter Tight"  /* Headlines, display moments */
--font-mono:    "JetBrains Mono" /* Timestamps, metadata, counters */
```

**Key type sizes in use**
| Use | Size | Weight | Family |
|---|---|---|---|
| Brief text / hero | 20–22px | 500–600 | Inter Tight |
| Onboarding question | 42px | 600 | Inter Tight |
| Section title | 14px | 500 | Inter |
| Body / capture title | 13–14px | 400 | Inter |
| Metadata / timestamp | 10.5–11px | 400 | JetBrains Mono |
| Eyebrow / label | 10px, 0.08em tracking, uppercase | 400 | JetBrains Mono |
| Subspace/space name | 13.5px | 600 | Inter |

### Spacing

4px base unit. Key values: 4 / 8 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 48 / 64px.

### Border radius

```
xs: 2px   sm: 4px   md: 6px   lg: 8px   xl: 12px   pill: 999px
```
Misir uses **restrained radii** — 6–8px for cards, 5–6px for buttons and inputs, 999px only for tags and badges.

### Shadows

```
--shadow-sm:  0 1px 2px rgba(20,18,16,0.04)
--shadow-md:  0 4px 12px rgba(20,18,16,0.06), 0 1px 2px rgba(20,18,16,0.04)
--shadow-pop: 0 18px 48px rgba(20,18,16,0.14)
```

Shadows are used **only for floating elements** (modals, dropdown menus). No drop-shadow on chrome or cards.

### Motion

```
--ease-out:    cubic-bezier(0.2, 0.7, 0.2, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--dur-fast: 120ms
--dur-base: 180ms
--dur-slow: 280ms
```

---

## Layout Architecture

```
<html data-theme="light|dark">
  <body>
    <div id="root">
      [mobile-scrim]         <!-- mobile only, when drawer open -->
      <aside class="side">   <!-- 252px sidebar, fixed height -->
      <div class="main">
        <div class="topbar"> <!-- 52px, border-bottom -->
        <div class="body">   <!-- flex:1, overflow-y:auto, padding 24px 28px -->
          <div class="view"> <!-- max-width 1180px, flex col, gap 18px -->
      <nav class="mobile-nav"> <!-- fixed bottom, display:flex, mobile only -->
      [modal-scrim + modal-wrap] <!-- z-index 200–201, when modal open -->
```

**Desktop:** Sidebar always visible, main takes remaining width. `overflow:hidden` on root and main, scroll only on `.body`.

**Mobile (≤767px):** Sidebar becomes a slide-out drawer (left: -100% → 0, `box-shadow: 4px 0 32px rgba(0,0,0,0.24)`). Bottom nav fixed at 56px. `.body` gets `padding-bottom: 72px` to clear the nav.

---

## Screens & Views

### 1. Onboarding (`Onboarding.html`)

A standalone pre-dashboard flow. Three sequential steps with animated transitions.

**Layout:** Full-viewport centered column, max-width 580px. Fixed elements: 2px progress bar (top), brand wordmark (top-left), step counter in mono (top-right), tagline (bottom center).

#### Step 1 — The challenge
- Eyebrow: `NEW SPACE` in accent orange with pulsing dot
- Headline: `"What decision are you building toward?"` — 42px Inter Tight 600, tracking -0.03em
- Single text input, auto-focused on load
- Hint below input: `"This becomes your first space."`
- Continue button: disabled until input ≥ 3 chars. Enter key also advances.
- Progress bar: 33%

#### Step 2 — Define the outcome
- Eyebrow: `DEFINE THE OUTCOME`
- Headline dynamically updates to: `"What does [challenge name] look like, done?"` — challenge name in accent orange
- Two fields: "End goal" (textarea, 3 rows, required ≥10 chars to enable Continue) and "Deadline" (text input, optional)
- Back button (ghost, left-aligned)
- Progress bar: 66%

#### Step 3 — Extension install
- Eyebrow: `ONE LAST THING`
- Headline: `"Get the extension. It does the capturing."`
- Extension card (border: 1px `--border`, border-radius 12px):
  - Top section: 52×52px orange icon (shield SVG), name "Misir Capture", meta in fg-muted
  - Body: 3 feature bullets with 5px orange dots
  - Footer (bg-subtle): "Add to Chrome" primary button + "I'll do this later" ghost button
- Back button below card
- Progress bar: 100%

#### Setup overlay
Triggered by either button on Step 3. Full-viewport fade-in (`opacity: 0 → 1`, 300ms). Shows:
- Label: `"Setting up '[challenge name]'"` — 22px Inter Tight
- 200px × 2px loading bar (--accent fill, animated via JS steps)
- Mono status line cycles: "Generating subspaces" → "Building marker set" → "Calibrating readiness baseline" → "Ready"
- Redirects to dashboard after final step (500ms delay)

**Persistence:** Saves `misir.onboarded` and `misir.firstSpace` JSON to localStorage on completion.

**Transitions:** Steps animate with `translateY(18px) → 0` on enter, `0 → translateY(-12px)` on exit, 320ms / 220ms.

---

### 2. Dashboard Shell

#### Sidebar (252px, `bg-subtle`, `border-right`)

Top-to-bottom sections:
1. **Brand** — 22×22px logo + "Misir" (18px Inter Tight 600) + "v1" badge (10px mono, fg-subtle, margin-left:auto)
2. **Search bar** — full-width, 30px height, border, `⌘K` kbd chip right-aligned
3. **Action row** — 2-col grid: "New space" (ghost) + "Chat" (accent primary), 28px height
4. **Nav items** — `home`, `inbox`, `notification`, `collection`, `comparison`, `decision`. 30px height, 5px border-radius, active state: `bg-active` + fg + accent icon. Unread badges: mono 10.5px, accent color.
5. **Spaces section label** — "▾ Spaces" in mono uppercase + `+` button right-aligned
6. **Spaces list** — "All spaces" item + one item per space. Space items: target icon in space color, title, readiness% or unread pip in space color.
7. **Profile strip** — Avatar (28px circle, gray-700 bg, white initial), name + role, sun/moon theme toggle, settings cog.

**Active state:** `background: --bg-active`, color: --fg, font-weight: 500. Active icon: accent orange.

**Mobile:** Sidebar is `position:fixed; left:-100%`. When `mobileMenuOpen` state is true, slides to `left:0` with box-shadow. Dark scrim covers the rest of the viewport and closes the drawer on tap.

#### Topbar (52px, `border-bottom`, 3-col grid)

- **Left:** Hamburger button (mobile only, `display:none` on desktop), current view name (13px, fg, 500) + "/" separator (fg-faint) + scope label (fg-muted)
- **Center:** Date scrubber — prev/next chevron buttons + current date range label (Today / This week / This month / All time)
- **Right:** Empty on production (theme toggle was removed from here)

#### Bottom mobile nav (`position:fixed; bottom:0`, 56px height, `border-top`)

5 icon buttons: Home, Inbox, Collection, Comparison, Decision. Active state: accent color. Unread badge: 14px circle, accent bg, 9px mono text, positioned top-right of icon.

---

### 3. Home — All Spaces

Shown when scope = "all".

#### Hero section (`all-hero`)
2-column grid (1fr + auto right column):
- **Left:** Greeting ("Good morning, [name]"), then the "moment" — 3 lines of Inter Tight 600, third line in accent orange. CTA link button + meta line (total captures · critical gaps).
- **Right:** Space cards — one per space. Each is a button with a conic-gradient readiness ring (space color), space name, and critical/on-track status in space color.

Ring implementation: `background: conic-gradient([color] 0 [readiness*3.6]deg, --border-strong [readiness*3.6]deg 360deg)`. Inner circle: `position:absolute; inset:8px; background:--bg; border-radius:999px`.

#### Insights list (`insight-list`)
Bordered list (border-radius 10px, overflow hidden). Each row: 4-col grid (`36px 130px 1fr auto`):
- Row number (mono, fg-faint)
- Label column: type badge (mono uppercase, colored) + space chips (pill badges in space color)
- Text: 14.5px, fg, line-height 1.6
- CTA button: ghost, colored border and text matching insight type

Hover state: `background: var(--ins-bg)` (a very faint tint of the insight color).

Insight type colors:
```
cross-space: #2A4A7A
pattern:     #FF6C3C
collision:   #B8730D
readiness:   #2A6A4A
blindspot:   #A8423D
```

#### Space pulse strip (`space-pulse-strip`)
4-col grid of space summary cards. Each card: space dot + name + optional critical badge, a filled progress bar (space color), and metadata (readiness%, deadline days, captures/wk).

---

### 4. Home — Single Space

Shown when scope = a specific space ID.

#### Misir brief (`misir-brief`)
No card, no border — just text on the canvas:
- Eyebrow: "Misir's read · [space title] · [updated]"
- Body text: 20px Inter Tight 500, line-height 1.5, max-width 820px. This is editorial voice — direct, specific, slightly confrontational.
- Deadline line: space color, clock icon, deadline label + days in bold, readiness% in mono.

#### Misir asks card (`misir-asks`)
The "thinking partner" interrupt. Has three states:

**Collapsed (default):**
- Single-row flex bar: eyebrow attr (mono, zap icon) + question text (truncated, 14px 500) + "Answer →" primary button + dismiss X.
- Background: `color-mix(in srgb, [space-color] 4%, --bg)`. Left border: 3px solid space color.
- Clicking anywhere on the row expands to the full state.

**Expanded:**
- Full card with: context line (fg-muted, 12.5px), question (20px Inter Tight 600), 2-row textarea (auto-focused), footer with "Collapse" + "Ask later" + "Answer →".
- `⌘ Enter` submits.

**Answering (loading):**
- Shows submitted answer in italic + typing dots animation (3 dots, bounce keyframes, staggered delay).

**Responded:**
- Exchange format: "You said" block (bg-muted, italic) + "Misir" response (14.5px, line-height 1.65).
- Actions: "File to [subspace]" primary + "Ask another" ghost + "Done" ghost.

The card uses `--ma-color` CSS custom property = space color, so all accent elements (border, attr label, button) automatically match the active space.

#### Subspace status list (`ss-status-list`)
Bordered list (border-radius 10px). Each row: CSS grid `5px 1fr auto` × 3 rows:
- Lane bar (col 1, rows 1-3): 5px wide, full height, space/subspace color
- Head (col 2, row 1): title (13.5px 600) + optional "Critical" or "Needs pull" flag badge
- Bar wrap (col 3, row 1): 80px progress bar + % label in subspace color
- Status text (cols 2-3, row 2): 12.5px fg-muted, editorial one-liner about the subspace
- Footer (cols 2-3, row 3): capture count + weekly delta (in subspace color) + last hit timestamp

Critical rows: faint orange background tint. Low rows: 0.8 opacity.

#### Two-up grid
Two equal-width cards side by side:
- **Left — Today timeline:** Day arc visualization (colored dots on a timeline track showing capture times) + list of today's captures as timeline rows
- **Right — Decision readiness:** Ring + readiness headline + divider + "Ask Misir anything" chat CTA

**Today timeline row** grid: `52px 5px 18px 1fr auto`
- Time (mono), lane bar (subspace color), icon, title + meta, marker chip

**Mini readiness ring:** CSS conic-gradient at `--p` variable, 96px diameter, 8px inner circle gap, percentage text centered via z-index.

---

### 5. Inbox

Filter bar + list of chat conversations.

**Filter bar:** Segmented control (All/Unread) + optional space select (all-spaces mode) + text search input + count label. All in `bg-subtle` strip, `border-bottom`.

**Inbox row** grid: `18px 1fr 120px`
- Unread dot (6px, accent, animated pulse if unread)
- Lead: subject (13.5px, 600 if unread) + snippet (1-line clamp, fg-muted)
- Meta: timestamp (mono) + subspace tag (pill, `--sc` color)

Empty state: centered "No chats match." in fg-subtle.

---

### 6. Notifications

Same filter bar pattern as Inbox (severity segments: All / Critical / Warning / Info + space picker). 

**Notification row** grid: `100px 1fr auto`
- Severity badge: mono uppercase, colored. Critical = accent + pulsing dot. Warning = `--warning`. Info = fg-muted.
- Body: title (13.5px 500) + body text (12.5px fg-muted) + subspace/space tags
- Right: timestamp + action button

Nudge card appears above the list when not dismissed: orange-tinted card with left accent bar, "Misir noticed" pulsing label, 3 text lines (scatter / direction / consequence), CTA + dismiss button.

---

### 7. Collection

Filter bar (type segments: All / Articles / AI chats / PDFs / Videos / Posts + subspace select + space select if all-spaces + search + count).

Captures grouped by date. Date group header: `bg-subtle`, `border-bottom`, eyebrow label.

**Capture row** grid: `60px 110px 1fr auto`
- Time (mono, fg-subtle)
- Surface (domain name, with icon, mono 11px)
- Title: type chip + title text (truncated) + optional "×N revisited" badge (accent bg, mono)
- Right: marker chip + subspace tag + space tag (all-spaces mode)

---

### 8. Comparison

Space tab row (all-spaces mode) → tension table → 3-col source cards → synthesis card.

**Tension table:** Orange-tinted card (`rgba(255,108,60,0.04)` bg, `rgba(255,108,60,0.2)` border). Rows: 3-col grid (number / source / stance). Footer: "Your edge." + summary.

**Source cards** (3-col grid, 1-col on mobile): Each card has:
- Header: `bg-subtle`, `--fg`, `border-bottom: 1px solid --border`, left border 3px in source color (Claude=#FF6C3C, Gemini=#2A4A7A, Web=#2A6A4A). Name + count chip.
- Body: findings list (each row: 2-col grid with confidence% + mini bar + text)
- Signal box: left-border accent, `bg-subtle`, "Unique signal" eyebrow + text

**Synthesis card** (3-col grid, 1-col on mobile): Agree / Conflict / Blindspot columns. Each column has an icon badge + eyebrow + paragraph. Blindspot column has `rgba(255,108,60,0.03)` bg.

---

### 9. Decision

All-spaces mode: grid of space cards, each showing readiness ring, decision question, gap count, CTA.

Single-space mode:
- **Decision hero:** `rgba(255,108,60,0.04)` tinted card. Decision question (22px Inter Tight 600). Two options in a 3-col grid (`1fr auto 1fr`) with a "VS" pill in the center. Primary option gets accent border + inner shadow.
- **Pro/con grid** (`pcgrid`): 2 cards side by side. "For" card: `border-top: 3px solid --success`. "Against" card: `border-top: 3px solid --danger`. Each has a bulleted list (colored dots, 13px fg-muted, 1.55 line-height).
- **Knowledge gaps:** List rows in a card. Each row: 3-col grid (`110px 1fr auto`). Severity badge (Critical/High/Medium) + label + action text + "Open" button.

---

## Interactions & Behavior

### State management
The prototype uses a single `state` object in `app.js`. In production, implement with your framework's state management:

```
view: "home" | "inbox" | "notification" | "collection" | "comparison" | "decision"
scope: "all" | spaceId
spaceId: string (active space when scope !== "all")
date: 0-3 (Today/This week/This month/All time)
theme: "light" | "dark"
mobileMenuOpen: boolean
misirAsksExpanded: boolean
misirQuestionDismissed: boolean
misirAnswerDraft: string
misirAnswerSubmitted: string | null
misirAnswering: boolean
misirResponse: string | null
modal: null | "new-space" | "new-chat"
```

### Navigation
- **Sidebar nav items** set `view`. Active item: `bg-active` bg, accent icon.
- **Spaces in sidebar** set both `scope` and `spaceId`. Switching scope also closes mobile drawer.
- **Scope = "all"** shows cross-space aggregated views. Scope = spaceId shows single-space data.
- **Mobile bottom nav:** Sets `view` and closes drawer.
- **Breadcrumb** is read-only — shows `view label / scope label` as plain text.

### Modals
- Triggered by "New space" or "Chat" buttons. Full-viewport scrim + centered card (560px max-width).
- On mobile: bottom sheet (border-radius 16px 16px 0 0, max-height 90vh).
- Scrim click or Escape key closes.
- On open, first input auto-focuses.
- Animations: scrim fades in (160ms), card slides up + scales in (200ms, `translateY(8px) scale(0.98) → 0`).

### Theme toggle
Stored in `localStorage` under `misir.theme`. Toggled by the sun/moon button in sidebar footer. Applied as `data-theme="light|dark"` on `<html>`.

### Misir asks
- Collapsed by default. Click anywhere on the bar (or "Answer" button) to expand.
- Expanded: textarea auto-focuses after 60ms.
- Submit via button or `⌘ Enter` / `Ctrl+Enter`.
- After submission: shows loading dots, then Misir's response via Claude API (falls back to space-specific canned response on error).
- "File to [subspace]" button navigates to Collection view filtered to that subspace.
- Dismiss persists for the session (not to localStorage — intentional).
- "Collapse" button returns to collapsed state.

### Search / filter
- Typing in the inbox or collection search inputs re-renders the list while preserving focus and cursor position (patch-render, not full re-render).
- Filters are additive (type AND subspace AND space AND query).
- Filter bar counts update live.

### Transitions
- View changes: no transition (instant re-render). Do not add page transitions — the content density makes sliding feel slow.
- Hover states: 120ms ease-out on background.
- Modal: 160ms scrim, 200ms card.
- Misir-asks expansion: no animation needed — the height change is fast enough.
- Theme toggle: applied immediately via `data-theme` attribute change.

---

## Components to implement

### Primitive components
| Component | Notes |
|---|---|
| `.btn` | 28px height, 12px padding, 6px radius. Variants: default, primary (accent), ghost (no border) |
| `.chip` | Mono 10.5px, 3px radius. Variants: default, marker (orange dot prefix), type (bg-subtle) |
| `.eyebrow` | Mono 10–10.5px, 0.08em tracking, uppercase, fg-muted |
| `.dot` | 6px circle. Variants: default (accent), success, warning, faint |
| `.pulsing` | 7px circle, accent, keyframe pulse animation |
| `.subspace-tag` | Pill, border, 5px colored dot prefix, uses `--sc` CSS var |
| `.space-tag` | Pill, colored border/bg from `--sc`, colored text |
| `.card` | bg, border, 8px radius. With `.ph` (header strip) and `.pb` (body padding) |
| `.filterbar` | bg-subtle strip, border-bottom, flex with gap |
| `.seg` | Segmented control inside filterbar, overflow:hidden, inline-flex |
| `.readiness-ring` | Conic-gradient ring with inner circle. `--p` = percentage 0-100 |

### Feature components
| Component | Notes |
|---|---|
| `MisirBrief` | Editorial text block — no border/card treatment |
| `MisirAsks` | 3-state card (compact/expanded/responded) with `--ma-color` custom property |
| `SubspaceStatusRow` | 5px color lane + 3-row grid layout |
| `TodayTimeline` | Day arc + timeline rows |
| `InsightRow` | 4-col grid with colored type metadata |
| `SpacePulseCard` | Compact space summary with progress bar |
| `SourceCard` | Comparison source card (Claude/Gemini/Web) with left-border variant |
| `NudgeCard` | Orange-tinted interrupt card with left accent bar |
| `DecisionHero` | Two-option comparison with VS pill |
| `KnowledgeGapRow` | Severity + label + action + button |
| `NewSpaceModal` | 3-field form (title, goal, deadline) with preview list |
| `NewChatModal` | Space picker + question textarea + suggested prompts |

---

## Responsive breakpoints

Only one breakpoint: **767px**.

Below 767px:
- Sidebar: slide-out drawer (fixed, left:-100% → 0)
- Bottom nav: display:flex (hidden above 767px)
- Hamburger in topbar: display:grid (hidden above 767px)
- Date scrubber: hidden on mobile
- All multi-column grids reflow to 1-col or 2-col
- Modal: bottom sheet
- Capture/inbox/timeline rows drop right-side secondary columns
- Misir-asks compact bar: question wraps to second line
- Body padding-bottom: 72px (to clear bottom nav)

---

## Assets

| File | Use |
|---|---|
| `assets/misir-logo.png` | 22×22px brand mark in sidebar and onboarding |

**Icons:** All icons use [Lucide](https://lucide.dev/) loaded via `https://unpkg.com/lucide@latest`. The prototype calls `lucide.createIcons()` after every render. In production, import lucide-react or use your icon system.

Key icons in use: `home`, `inbox`, `bell`, `library`, `columns-3`, `git-branch`, `layers`, `target`, `settings`, `sun`, `moon`, `search`, `plus`, `message-circle`, `menu`, `chevron-down`, `chevron-left`, `chevron-right`, `arrow-right`, `zap`, `x`, `check`, `check-circle`, `alert-circle`, `alert-triangle`, `eye-off`, `link-2`, `repeat`, `rotate-ccw`, `clock`, `globe`, `messages-square`, `play`, `at-sign`, `file-text`.

---

## Data architecture

The prototype data layer (`data.js`) defines the shape production APIs should follow:

```js
// Global collections
SPACES: Array<{
  id: string,
  title: string,
  unread: number,
  readiness: number,       // 0-100
  subspaceCount: number,
  capturesWeek: number,
  criticalGaps: number,
}>

SPACE_DATA[spaceId]: {
  challenge: {
    id, title, goal, deadline: { label, inDays } | null,
    readiness, created, updated,
    capturesToday, capturesWeek, subspaceCount, criticalGaps,
  },
  subspaces: Array<{
    id, title, desc, markers: string[],
    captures, weekDelta, completeness,  // 0-100
    lastHit, spark: number[],           // 7-point sparkline
    aiGen: boolean,
    flag?: "critical" | "low",
    flagNote?: string,
  }>,
  captures: Array<{
    id, time, date, surface, type, title, marker, subspaceId,
    revisit?: number,  // times revisited
  }>,
  chats: Array<{
    id, subject, lastAt, unread, snippet, subspaceId,
  }>,
  notifications: Array<{
    id, severity: "critical"|"warning"|"info",
    title, body, at, subspaceId, actionLabel,
  }>,
  comparison: { tension, sources, synthesis },
  decision: { question, optionA, optionB, for[], against[], gaps[], ask },
  nudge: { scatter, direction, consequence } | null,
}
```

---

## Files in this bundle

| File | Purpose |
|---|---|
| `dashboard/Onboarding.html` | Standalone onboarding flow — 3-step first-run |
| `dashboard/Misir Dashboard.html` | Full dashboard shell |
| `dashboard/app.js` | Shell, state, routing, sidebar, topbar, modals |
| `dashboard/views.js` | All view render functions + shared helpers |
| `dashboard/style.css` | All dashboard styles (supplemental to tokens) |
| `dashboard/data.js` | Mock data — shape reference for production APIs |
| `colors_and_type.css` | Design system tokens (colors, type, spacing, radii, shadows, motion) |
| `assets/misir-logo.png` | Brand mark |

---

## Notes for the developer

1. **The editorial voice is load-bearing.** The brief text, nudge copy, and Misir-asks questions are final copy. Do not paraphrase or genericize them in implementation.

2. **`--ma-color` pattern:** The Misir-asks card uses a single CSS custom property on the element root to theme all its internal elements (border, attr label, focus ring, button color). Implement this as a CSS variable passed via inline style or a wrapper class.

3. **`--sc` pattern (space/subspace color):** Tags, dots, rings, and bars all derive their color from `--sc` set on a parent or the element itself. Makes the whole space color system work without prop-drilling in React.

4. **Subspace lane is structural:** The 5px color lane on subspace rows is part of the grid layout (`grid-template-columns: 5px 1fr auto`), not a pseudo-element. The lane spans all 3 rows via `grid-row: 1 / 4`.

5. **Conic-gradient rings:** The readiness rings are pure CSS — no SVG or canvas. `background: conic-gradient([color] 0 [deg]deg, --border-strong [deg]deg 360deg)` with an absolute-positioned inner circle (`inset: 8px, background: --bg`).

6. **The "moment" text on All-spaces Home is newline-separated:** Three lines, the third in accent orange. Implement as 3 `<span>` elements in a flex column, not as a paragraph.

7. **Dark mode tuning:** Source card headers use `--bg-muted` (not `--bg-subtle`) in dark mode to be visible against the card body. Tension/nudge/decision-hero cards use `rgba(255,108,60,0.07-0.09)` tints in dark mode (not 0.04). See the dark mode overrides section in `style.css`.

8. **Mobile nav excludes Notifications:** The bottom nav has 5 items (Home, Inbox, Collection, Comparison, Decision). Notifications is accessible from the sidebar drawer on mobile only.

9. **The `v1` badge in the sidebar** is a design choice worth discussing before implementation — it's honest but may signal immaturity.

10. **Unimplemented states:** `openCapture()`, `openChat()`, and `openSubspace()` (for the panel) are no-ops in the prototype. These are the next features to design/build: a capture detail panel, a chat thread view, and a subspace detail panel.
