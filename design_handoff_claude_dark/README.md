# Handoff: Claude Dark Design System

## Overview
This package is the **Claude Dark design system** — a dark-mode UI foundation and component library recreating the Claude.ai product surface (chat, projects, characters, writing styles). It contains design tokens (CSS custom properties), self-hosted brand fonts, an icon set, ~35 React components, and a full interactive app recreation, plus foundation specimen cards.

The goal of this handoff is to let a developer **integrate this system into a real codebase** — wiring the tokens into the app's theme layer and porting the components into the codebase's framework and conventions.

## About the Design Files
The files in this bundle are **design references**. The components are written as plain React + inline styles driven by CSS custom properties — they are intentionally framework-light and **not** production-hardened (no tests, no a11y audit, no SSR considerations, trial fonts). Treat them as the **source of truth for visual + interaction intent**, and recreate them in the target codebase using its established patterns:

- If the codebase already has a component framework (React/Vue/Svelte/SwiftUI/etc.) and a styling approach (CSS Modules, Tailwind, styled-components, tokens pipeline), **port the tokens first**, then rebuild each component on the existing primitives.
- If there is no environment yet, React + CSS variables (as shipped here) is a fine starting point — the components run as-is once the bundle is compiled.

Do not ship the trial font files to production (see **Fonts**).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, and interaction states are final and exact — recreate them pixel-for-pixel. Hover/focus/press states and ~120ms transitions are specified in each component.

## Design Tokens
All tokens are CSS custom properties. Entry point: `design-system/styles.css` (import-only; it `@import`s the files below). Reference tokens by `var(--token)`.

### Colors — surfaces (warm-neutral dark, NOT blue-black)
| Token | Hex | Use |
|---|---|---|
| `--slate-dark` | `#191919` | sidebar / sunken wells |
| `--slate-medium` | `#262625` | app background |
| `--slate-light` | `#40403E` | raised surfaces, input fills |

### Colors — text
| Token | Hex | Use |
|---|---|---|
| `--neutral-white` | `#FFFFFF` | primary text |
| `--cloud-light` | `#BFBFBA` | secondary text |
| `--cloud-medium` | `#91918D` | tertiary text |
| `--cloud-30c` | `#A9AEB1` | mono/meta grey |
| `--white-60` (rgba 255,255,255,.6) | — | muted text |

### Colors — off-whites / accents / state
| Token | Hex | Use |
|---|---|---|
| `--ivory-light` / `--ivory-medium` / `--ivory-dark` | `#FAFAF7` / `#F0F0EB` / `#E5E4DF` | input text, soft fills |
| `--ui-orange` | `#D97757` | primary brand accent (clay) |
| `--clay-fill` / `--clay-border` | `#AA532E` / `#9C5A3C` | primary button surface + ring |
| `--ui-blue` | `#207FDE` | links, active, checkbox, "Add"/"Edit" |
| `--ui-purple` | `#9B87F5` | plan / character / AI flourishes |
| `--state-focus` | `#61AAF2` | focus rings, selected tab |
| `--state-error` | `#BF4D43` | errors |
| `--hero-manilla` | `#EBDBBC` | starred / hero tone |

Alpha tokens: `--white-10/08/05`, `--black-40/25/20/10` for hairlines, fills, and hover washes.

### Typography
| Token | Stack | Role |
|---|---|---|
| `--font-sans` | **Styrene B LC** → Hanken Grotesk | UI labels, buttons, body |
| `--font-serif` | **Tiempos Text** → Newsreader | chat titles, assistant text, project names, model pill |
| `--font-display` | **Copernicus** → Newsreader | large headings |
| `--font-mono` | **Fira Code** | hex, code, metadata |

Scale (`--text-*`): 8, 10, 11, 12, 13, 14, 15, 16, 20, 24, 32, 40, 48 px. Weights: 400 / 500 / 700. Line-height: `--leading-tight` 1 (most UI), `--leading-normal` 1.5 (mono/body). Tracking: `--tracking-tight` −0.5px (sans medium labels), `--tracking-serif` −0.8px (serif chips).

The serif doing real UI work (titles, chat names, model pill) is the brand fingerprint — preserve the sans/serif split exactly.

### Spacing (4px grid)
`--space-1..10` = 4, 6, 8, 10, 12, 16, 24, 32, 40, 64 px.

### Radius
`--radius-xs` 2 · `--radius-sm` 4 (checkbox) · `--radius-md` 6 (nav rows, toggles) · `--radius-lg` 8 (buttons) · `--radius-xl` 10 (inputs) · `--radius-2xl` 12 (cards/popovers) · `--radius-pill` 24 · `--radius-full` 999. Chat/project cards use 14px.

### Shadows / rings (borders are hairline & usually INSET; no heavy drop shadows)
- `--ring-subtle` = `inset 0 0 0 1px var(--white-10)` — cards
- `--ring-input` = `inset 0 0 0 1px var(--border-default)` (`rgba(102,102,99,.75)`) — inputs
- `--ring-focus` = `0 0 0 2px var(--state-focus)`
- `--shadow-clay` = `inset 0 0 0 1px var(--clay-border), inset 0 1.5px 0 0 var(--clay-highlight), -1px 1px 4px 0 var(--black-25)` — primary button
- `--shadow-popover` = `0 8px 30px -6px rgba(0,0,0,.5)`

## Components
React function components, named PascalCase exports, styled only via the tokens above. **Full source for every component (plus its props `.d.ts`) is in `COMPONENT_SOURCE.md`** at the root of this bundle — one Markdown file, grouped by concern, so there are no loose `.jsx` files to wire up before reading. Recreate them in your codebase's framework.

**core/** — `Button` (variant: primary clay / secondary / outline; size sm·md; icon/iconRight), `AddButton` (ghost "+ blue label"), `IconButton` (sm 24 / md 28 / lg 32 / xl 40; active), `ModelButton` (serif model pill + chevron), `PrevNext` (back/forward link).

**forms/** — `Input`, `Textarea`, `Select`, `SearchInput` (all 45px tall, 10px radius, white-08 fill, blue focus ring, ivory text), `Checkbox` (24px, blue fill when checked), `Toggle` (selectable option row with check).

**navigation/** — `Nav` (sidebar shell: fixed / temp / collapsed), `NavItem` (serif chat-list row), `TopNavItem` (sans app-nav row), `Tab` (filter tab; selected = blue hairline ring), `TopBar` (content header: breadcrumb + icon actions).

**display/** — `Badge` (lock pill), `Chip` (plan serif purple capsule / preset grey tag), `CapacityBar` (knowledge meter), `Blankslate` (empty state), `ChatCard` (recent-chat tile), `ChatEmpty` (empty composer), `RecentChat` (compact list row), `ProjectLabel`, `ProjectCard`, `ProjectInstructions`, `StyleRow`, `Popover`, `CharacterPopover`, `KnowledgeUpload`, `FileCard`, `Character`, `NewCharacterForm`.

**brand/** — `Logo` (variant: claude wordmark / anthropic-symbol; inherits currentColor).

See `COMPONENT_SOURCE.md` for each component's exact implementation and props contract.

## Iconography
- `design-system/assets/icons/Icon.jsx` — `<Icon name="…" size={n} />`, paints with `currentColor`. 24 glyphs.
- Custom product glyphs: `IconChat, IconNewChat, IconProject, IconStyles, IconCharacter, IconDna, IconSplat, IconClosePanel`.
- System glyphs (Feather + Heroicons mini/outline/solid): `FiArrowRight, FiCheck, FiInfo, FiPlusCircle, FiSidebar, FiTrash2, HeroiconsMini{ArrowLeft,ArrowRight,BookOpen,ChevronDown,Plus}, HeroiconsOutline{EllipsisVertical,InformationCircle,LockClosed,MagnifyingGlass}, HeroiconsSolidStar`.
- Thin ~1.5px strokes, 16–20px. **No emoji, no unicode-as-icon.** A few source glyphs (paper-clip, outline-plus, sliders, drag-indicator, help) weren't decodable on import — substitute the nearest Feather/Heroicons equivalent in production.
- `design-system/assets/icons/icon-data.js` holds the raw `{ viewBox, body }` map if you want to feed your own icon pipeline.

## Interactions & Behavior
- **Hover:** rows/icon buttons lighten with `--white-05`; icons brighten tertiary→secondary; clay primary drops fill to 80% opacity. No scale/bounce.
- **Transitions:** ~120ms ease, limited to background/color/box-shadow.
- **Focus:** solid blue (`--state-focus`) ring on inputs/tabs; selected tab is a full blue hairline box with blue text.
- **Composer (ChatEmpty / app):** Enter sends, Shift+Enter newlines; send button is disabled-grey until there's text, then clay.
- See `design-system/ui_kits/claude-app/` for the canonical interactive flow (new chat → send → conversation; projects grid → detail; characters).

## State Management
The shipped app (`ui_kits/claude-app/App.jsx`) is a small client-only state machine: `view` (home·chat·projects·project·characters), `activeChatId`, `activeProjectId`, `draft`, plus `chats`/`projects` arrays. Replies are canned (no network). In a real app, replace the canned `reply()` with your assistant API and lift chat/project state into your store/router.

## Assets
- `design-system/assets/logos/` — `claude-symbol.svg` (Claude wordmark), `anthropic-symbol.svg` (Anthropic "A").
- `design-system/assets/icons/` — icon component + data.
- `design-system/fonts/` — see Fonts.

## Fonts
Self-hosted via `@font-face` in `design-system/tokens/font-faces.css` (paths resolve to `design-system/fonts/`): **Styrene B LC**, **Tiempos Text**, **Copernicus** (Fira Code loads from Google Fonts). ⚠️ **The files in `fonts/` are TRIAL versions** (`*Trial*`). Do not ship them to production — purchase the proper licenses (Styrene & Tiempos: Klim Type Foundry; Copernicus) and swap the files, keeping the same family names so the tokens resolve unchanged.

## Files
- `README.md` — this document
- `COMPONENT_SOURCE.md` — full source for all ~35 components (`.jsx` + props `.d.ts`), grouped
- `design-system/styles.css` — token entry point (import this one file)
- `design-system/tokens/` — `fonts.css`, `font-faces.css`, `colors.css`, `typography.css`, `spacing.css`
- `design-system/assets/logos/` — `claude-symbol.svg`, `anthropic-symbol.svg`
- `design-system/assets/icons/icon-data.js` — the `{viewBox, body}` glyph map (feed your own icon pipeline; the `<Icon>` wrapper source is in `COMPONENT_SOURCE.md`)
- `design-system/fonts/` — trial brand font files (see Fonts)
- `design-system/readme.md` — the full design guide (content fundamentals, visual foundations, iconography)

> Component source is provided as Markdown code blocks (`COMPONENT_SOURCE.md`) rather than loose `.jsx` files — copy each into your framework and import React + the tokens. In the original project these run via a compiled bundle (`window.ClaudeDarkDesignSystem_…`); that bundle is a preview artifact and not needed here.
