# Claude Dark — Design System

A dark-mode design system for **Claude**, Anthropic's AI assistant product. It captures the in-product surface: the chat app, projects, characters, and writing styles — built as reusable React components on a token foundation extracted from the source Figma file.

> **Source:** Figma — *"Misir Design System Dark Mode.fig"* (page `Design-System`, 14 frames). Token values, components, logos and icons were materialized directly from that file. If you have access, treat the Figma as the source of truth over this README.

---

## Product context

Claude is a conversational AI assistant. The recreated surface is the **dark theme of the Claude.ai web app**:

- **Chats** — the core conversation view; a composer with a model selector, user bubbles, and serif assistant responses.
- **Projects** — folders that bundle chats with shared **knowledge** (uploaded files, with a capacity meter) and **instructions**.
- **Characters** — saved personas that shape how Claude responds.
- **Styles** — selectable writing styles (Normal, Concise, Formal, presets).

The tone is calm, literate, and unhurried — a "thoughtful workspace," not a flashy dashboard. The serif typeface doing real UI work (titles, chat names, assistant text) is the signature move.

---

## Index / manifest

| Path | What |
|---|---|
| `styles.css` | Global entry — `@import`s every token + font file. Consumers link this. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css` |
| `components/fig-tokens.css` | Raw Figma Variables (imported by `styles.css`) |
| `components/brand/` | `Logo` |
| `components/core/` | `Button`, `AddButton`, `IconButton`, `ModelButton`, `PrevNext` |
| `components/forms/` | `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`, `SearchInput` |
| `components/navigation/` | `Nav` (fixed/temp/collapsed), `NavItem`, `TopNavItem`, `Tab`, `TopBar` |
| `components/display/` | `Badge`, `Chip`, `CapacityBar`, `Blankslate`, `ChatCard`, `ChatEmpty`, `RecentChat`, `ProjectLabel`, `FileCard`, `ProjectInstructions`, `StyleRow`, `Popover`, `CharacterPopover`, `KnowledgeUpload`, `Character`, `NewCharacterForm`, `ProjectCard` |
| `assets/icons/` | `Icon` + `icon-data.js` (24 glyphs) |
| `assets/logos/` | Claude wordmark + Anthropic symbol SVGs |
| `guidelines/` | Foundation specimen cards (Type / Colors / Spacing) |
| `ui_kits/claude-app/` | Interactive full-app recreation |

Reach a component from the compiled bundle via `window.ClaudeDarkDesignSystem_962c80.<Name>`.

---

## CONTENT FUNDAMENTALS

How Claude's product copy is written:

- **Voice:** warm, plain, and direct. Second person ("you"), and the product refers to the assistant in the third person as **"Claude"** ("How should **Claude** write responses?", "Describe **Claude's** role and how to act"), not "the AI" or "I".
- **Sentence case everywhere.** Buttons, labels, headers — "Start new chat", "Use a project", "Add content". No Title Case, no ALL CAPS (the only caps is the standalone `ANTHROPIC` wordmark).
- **Verb-first actions.** "Start new chat", "Create a character", "Add knowledge". Buttons say what happens.
- **Helper text is a calm, complete sentence.** e.g. *"Start a chat to keep conversation organized and re-use project knowledge."* — no exclamation marks, no hype.
- **Questions as field labels.** Form fields are phrased as questions: *"What do you want to call this character?"*, *"How should Claude write responses?"*, *"What role should Claude play?"*
- **No emoji.** None appear in the product chrome. Don't add them.
- **Numbers stay quiet.** Capacity is a soft caption ("30% percent of knowledge capacity used"), not a loud stat.
- **Timestamps are relative and lowercase** — "3 hours ago", "Yesterday", "2 days ago".

---

## VISUAL FOUNDATIONS

**Mood.** Quiet, warm-neutral dark. Backgrounds are warm near-blacks (the Slate ramp, slightly green-grey, *not* blue-black). Accents are used sparingly — a single clay-orange primary action per view; blue for links/active; purple reserved for plan/AI flourishes.

**Color.**
- Surfaces: `--slate-dark #191919` (sunken/sidebar), `--slate-medium #262625` (app bg), `--slate-light #40403E` (raised/inputs).
- Text: white primary, `--cloud-light #BFBFBA` secondary, `--cloud-medium #91918D` tertiary; muted text is often `rgba(255,255,255,.6)`.
- Accents: clay `--ui-orange #D97757` (primary), `--ui-blue #207FDE` (links, checkbox, active), `--ui-purple #9B87F5` (plan/character). State: focus `#61AAF2`, error `#BF4D43`.
- The primary button is a **flat clay fill `#AA532E`** — not the lighter brand orange — with a baked top highlight and hairline border.

**Type.** Three roles. **Styrene B** (sans) for UI labels, buttons, body. **Tiempos Text** (serif) does real UI work — chat titles, assistant responses, project names, the model pill. **Copernicus** for large display headings. **Fira Code** (mono) for hex/code/metadata. The serif-in-UI is the brand's fingerprint. Sans medium labels carry tight `-0.5px` tracking; serif chips go tighter (`-0.8px`).

**Spacing & radius.** 4px grid. Radii climb by component weight: 4 (checkbox) → 6 (nav rows, toggles) → 8 (buttons) → 10 (inputs) → 12–14 (cards, popovers) → 24/pill (plan chip).

**Borders & shadows.** Borders are hairlines, almost always **inset** — `inset 0 0 0 1px rgba(255,255,255,.05–.1)` on cards, `rgba(102,102,99,.75)` rings on inputs. There are no heavy drop shadows except the clay button's subtle `-1px 1px 4px rgba(0,0,0,.25)` and popovers' soft `0 4px 4px rgba(0,0,0,.25)`. Cards read as *outlined wells*, not floating elevated panels.

**Backgrounds.** Flat fills only. No photographic imagery, no full-bleed gradients, no patterns or textures in chrome. The only gradients are tiny, low-alpha tints inside chips/style rows (purple plan capsule, blue active style row).

**Fills & transparency.** Recessed controls use translucent white fills (`rgba(255,255,255,.08)`) over the dark surface rather than solid greys. Hover states are almost always a faint white wash (`rgba(255,255,255,.05)`) or, on the clay button, dropping fill opacity to 80%.

**Hover / press.** Subtle. Rows and icon buttons lighten with `--white-05`; icons brighten from tertiary → secondary; the clay primary dims rather than darkens. No scale/bounce. Transitions are short (~120ms ease) and limited to background/color/box-shadow.

**Corners & cards.** A card is an outlined well: 12–14px radius, transparent or barely-tinted fill, 1px inset hairline, generous padding, content set in the serif. The recent-chat tile (project pill → serif title → relative time) is the canonical example.

**Focus.** A solid blue (`#61AAF2`) — a 1px ring on inputs/tabs (selected tab is a full blue hairline box with blue text).

---

## ICONOGRAPHY

- **System icons** are **Feather**-style line glyphs (per the Figma's own note), supplemented by **Heroicons** (mini + outline) — thin ~1.5px strokes, 16–20px, painted in `currentColor`, usually muted grey.
- **Custom product glyphs** are bespoke line icons: chat, new-chat, project, styles, character, dna, splat, close-panel. Same thin-stroke language as the system set so they sit together.
- Delivered as a single **`assets/icons/icon-data.js`** map rendered through `<Icon name="…" size={…} />` (24 glyphs). Recolor with the CSS `color` property.
- A handful of source glyphs (paper-clip, outline-plus, sliders, drag-indicator, help) had no decodable vector geometry on extraction and are **not** in the icon set — substitute the nearest Feather/Heroicons equivalent and flag it. (`StyleRow`'s drag handle and the composer's send/attach use small inline SVGs as stand-ins.)
- **No emoji, no unicode-as-icon.** Logos: the **Claude** wordmark and the angular **Anthropic** "A" symbol live in `assets/logos/` and as the `Logo` component.

---

## ⚠️ Fonts — substitution flagged

The three core typefaces are **licensed and not embeddable here**:

| Role | Real face | Fallback in use |
|---|---|---|
| Sans (`--font-sans`) | **Styrene B LC** | Hanken Grotesk |
| Serif (`--font-serif`) | **Tiempos Text** | Newsreader |
| Display (`--font-display`) | **Copernicus** | Newsreader |
| Mono (`--font-mono`) | **Fira Code** | *(real — loaded from Google Fonts)* |

The token stacks already name the real faces first, so production picks them up automatically once licensed. **Please upload the Styrene B, Tiempos Text, and Copernicus font files** (`assets/fonts/`, then add `@font-face` rules to `tokens/fonts.css`) so specimens render true to brand. Until then, specimens use the close open substitutes above.
