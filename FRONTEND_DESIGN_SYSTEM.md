# Frontend Design System — Neon-Inspired Business Intelligence Platform

> **Document type:** Visual direction, UX structure, design tokens, motion language, and landing-page art direction.  
> **Status:** Required design specification for frontend implementation.  
> **Reference:** https://neon.com/  
> **Important:** Reinterpret the reference for this product. Do not copy Neon branding, logos, text, illustrations, screenshots, or proprietary assets.

---

## 1. Design objective

Create a premium, modern, technically confident SaaS experience that feels like a high-quality data infrastructure product rather than a generic accounting dashboard.

The design should combine:

- Neon's dark, minimal, developer-oriented visual discipline.
- Clear enterprise product storytelling.
- Restrained mint/green action accents.
- Iridescent 3D visual art used selectively in the landing-page hero.
- Highly legible financial and operational analytics.
- A confident, precise interface for business owners who are not necessarily technical specialists.

The reference's current public website uses a compact navigation, a strong single-message hero with a primary action, and a sequence of capability, agent-operation, scale, and social-proof sections. Reuse this storytelling rhythm: one clear promise, a visual demonstration, concrete capabilities, trust, and a repeated call to action. Do not clone the layout pixel-for-pixel.

## 2. Product narrative and three value pillars

The public-facing message must make the product's value clear in seconds.

### Core positioning

**Your business. One intelligence.**

Supporting statement:

> Connect your accounting and operational data. Understand every product group, warehouse, and financial result. Turn verified business data into clear AI-powered recommendations.

Treat this as draft copy. The product owner may refine the wording later.

### Three product benefits

#### 1. One connected business picture

Connect 1C, consolidate business data, and provision a dedicated cloud PostgreSQL analytics environment. The customer keeps their existing 1C installation and working database; the platform reads data through approved integration interfaces.

Suggested UI message: **All your business data, in one place.**

#### 2. Answers backed by actual numbers

Combine deterministic SQL/Python calculations with AI explanations and relevant RAG context. The AI Analyst surfaces product profitability, inventory risks, warehouse performance, and logistics inefficiencies. It can prepare an Excel report with formulas/results, findings, assumptions, and recommendations.

Suggested UI message: **From raw data to decisions you can act on.**

#### 3. Financial and operational clarity

Present owner-oriented financial information aligned with applicable РСБУ mappings when source data is complete and validated, alongside cross-cutting product, inventory, and logistics analytics.

Suggested UI message: **Understand the numbers behind your business.**

Do not promise automatic legal/accounting compliance for every arbitrary 1C database. Show supported data scope and validation status.

## 3. Visual reference analysis

Reference website: https://neon.com/

Observed design principles to reinterpret:

- Near-black canvas and high-contrast typography.
- Short navigation with a small number of top-level destinations.
- Large, confident headline and compact supporting copy.
- A prominent visual asset that explains the technology, not generic decoration.
- A small number of bright accents used with restraint.
- Alternating narrative sections that pair one message with a real product artifact.
- Product screenshots, charts, code-like details, architecture diagrams, and concise feature explanations.
- A clear primary CTA repeated at meaningful points.
- Technical metadata and monospace labels used sparingly.

The page should feel spacious and deliberate. The dashboard should use the same visual language but prioritize data readability over marketing drama.

## 4. Brand and design tokens

The product name is **Tech Adviser**. Use the single brand config (`frontend/src/config/brand.ts`) and the shared wordmark component; do not hardcode the name in pages or introduce alternative names.

### 4.1 Base color palette

Use this as the initial palette, then tune it by visual comparison with the current Neon reference and accessibility checks.

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#000000` | Main page background |
| `--color-surface-1` | `#0B0D0C` | Primary section / navigation surface |
| `--color-surface-2` | `#151617` | Elevated panels |
| `--color-surface-3` | `#18191B` | Cards, dropdowns, modal surfaces |
| `--color-border` | `#303236` | Thin borders and separators |
| `--color-text` | `#FFFFFF` | Primary text |
| `--color-text-soft` | `#E4F1EB` | Secondary high-emphasis text |
| `--color-muted` | `#94979E` | Descriptions and metadata |
| `--color-accent` | `#34D59A` | Primary actions, active states, key highlights |
| `--color-link` | `#39A57D` | Text links and subtle interactive emphasis |
| `--color-success` | `#34D59A` | Success state, with label/icon too |
| `--color-warning` | `#E6B85C` | Warnings and attention states |
| `--color-danger` | `#F17C78` | Errors and negative business states |

The accent must be scarce. Do not paint large dashboard areas bright green. Use green for actions, progress, one important metric, active navigation, and the hero particle visual.

### 4.2 Controlled iridescent gradient palette

Use color-shifting 3D gradients in the hero visual and a few high-value visual moments only. Suggested colors:

- emerald: `#34D59A`
- mint: `#A5F3D2`
- cyan: `#62DDEB`
- teal: `#1B9D91`
- cool blue: `#557EEA`
- subdued violet: `#8A74D6`

Gradient examples (adjust by eye, do not apply everywhere):

```css
:root {
  --gradient-hero: linear-gradient(
    125deg,
    #34d59a 0%,
    #62ddeb 34%,
    #557eea 66%,
    #8a74d6 100%
  );

  --gradient-glow: radial-gradient(
    circle at 50% 50%,
    rgb(52 213 154 / 22%),
    rgb(98 221 235 / 10%) 36%,
    transparent 72%
  );
}
```

The 3D scene should create the gradient through material/shader color interpolation and lighting where possible, not a large flat CSS gradient laid over the entire hero.

### 4.3 Typography

- Main UI and marketing font: Inter.
- Technical labels, IDs, small data metadata: Geist Mono or a compatible monospace fallback.
- Use a tight, deliberate scale. Headlines should be large but not excessively heavy.
- Use tabular numerals for financial values and aligned metric columns.
- Avoid mixing many font families or using mono text for long paragraphs.

Suggested scale:

| Element | Desktop | Mobile |
|---|---:|---:|
| Hero H1 | clamp(48px, 5.4vw, 76px) | 40–48px |
| Section H2 | 40–48px | 30–36px |
| Page H1 | 32–40px | 28–32px |
| Card title | 15–18px | 15–17px |
| Body | 16–18px | 15–16px |
| Metadata | 11–13px | 11–12px |

### 4.4 Spacing, radii, and borders

- Use a 4px spacing base.
- Marketing page should use generous vertical whitespace.
- App dashboard should use consistent 16–24px panel spacing.
- Prefer crisp corners and modest radii: 4–12px for most surfaces; larger rounding only for hero visual frames or large feature demonstrations.
- Use one-pixel, low-contrast borders instead of heavy shadows.
- Use shadows only to establish layering, not as the main visual decoration.

## 5. Landing page header and hero — highest priority

The first screen must establish the brand, proposition, and product personality immediately. The interactive laptop scene is a signature hero component and must be placed in the header/hero area, not buried several screens below.

### 5.1 Header navigation

Desktop layout:

- Left: configurable wordmark/logo.
- Center/right: Product, How it works, Security, Pricing.
- Right edge: Log in (quiet link) and primary mint CTA.
- Header background: transparent or near-black; use a subtle bottom border only if it improves separation.
- Sticky behavior: optional; keep it lightweight and avoid a large opaque bar.

Mobile layout:

- Wordmark left.
- Menu button right.
- CTA inside the opened menu or as a compact button when space allows.
- Keyboard-accessible drawer/menu with correct focus behavior.

### 5.2 Hero content

Desktop layout: two balanced columns.

**Left column:**

- Small technical eyebrow, e.g. `BUSINESS INTELLIGENCE PLATFORM`.
- Headline: `Your business. One intelligence.`
- Supporting message describing 1C integration, unified analytics, and AI-assisted decisions.
- Primary CTA: `Explore the platform` / `Start with your data` (use the real onboarding flow if available).
- Secondary CTA: `See how it works`.
- Optional small feature row: `1C integration`, `Cloud PostgreSQL`, `AI analytics`.

**Right column:**

- Premium open-laptop visual in a three-quarter front view.
- The laptop screen contains a luminous digital brain composed of small green numeric/alphanumeric glyph particles.
- Particle colors shift subtly from mint/emerald to cyan/blue and a restrained violet edge, while green remains the dominant identity.
- The laptop and brain are the primary visual; do not add random floating objects, unrelated icons, or a second hero illustration.

Suggested desktop proportions: text takes approximately 42–48% of the hero width; visual takes 52–58%. Keep enough negative space around the laptop.

### 5.3 Hero visual: laptop and particle brain

The supplied `brain-particles.zip` is a technical reference and a starting point. Inspect it in full before implementation.

Current archive characteristics:

- Standalone Vite + Three.js prototype.
- Procedural brain geometry in `src/brain.js`.
- Point-cloud glyph rendering in `src/main.js` using a custom Three.js shader.
- Glyphs are generated from `0` and `1` shapes.
- Intro animation forms the brain from scattered points.
- Mouse parallax is implemented.
- Existing particle count is roughly 28,000 on desktop and 9,000 on narrow screens.
- Current procedural geometry includes cerebrum, cerebellum, and brainstem.
- Current prototype does not implement click-to-scatter-and-reform behavior.

Required final result:

1. Show an open laptop as the only main physical object in the hero.
2. Render the particle brain inside the laptop screen, not as a full-screen background.
3. Preserve the recognizable two-hemisphere brain silhouette.
4. Remove the brainstem/stalk from the final geometry. Do not render a lower stem-like extension. Keep the cerebellum only if it remains consistent with the approved silhouette.
5. Use green digits/letters/code-like glyphs as particles. The glyphs must remain legible as a field while also describing the brain form.
6. On click/tap/keyboard activation of the laptop screen, particles break apart and travel outward in multiple directions with a deliberate, cinematic motion.
7. After a brief outward spread, particles reverse/flow back and reconstruct the same brain shape at the same screen position.
8. Return to the idle state; repeated interactions must not corrupt particle positions or cause particle accumulation.
9. Add a subtle idle motion: slow, low-amplitude rotation/float and restrained color shimmer. Do not constantly shake the laptop.
10. Avoid long blocking introductions. The hero should communicate immediately and become interactive without requiring the user to wait.

### 5.4 Animation choreography

Implement the animation as an explicit state machine, not scattered boolean flags:

```text
IDLE
  -> DISPERSE
  -> OUTWARD_HOLD
  -> REASSEMBLE
  -> IDLE
```

Recommended timing ranges (tune visually and measure):

- `IDLE`: slow, restrained float / subtle particle shimmer.
- `DISPERSE`: 700–1100 ms; particles move outward with varied direction and velocity.
- `OUTWARD_HOLD`: 150–350 ms; a brief suspended cloud, not a chaotic explosion.
- `REASSEMBLE`: 1000–1600 ms; each particle returns to its exact target point with smooth eased motion.
- A short completion glow may be used, then return to idle.

Implementation notes:

- Keep a stable target-position buffer for the brain silhouette.
- Derive a deterministic scatter vector from a per-particle seed so the same click produces a coherent result.
- Use shader attributes / typed arrays / buffer geometry. Do not create one React component per particle.
- Use a ref-driven animation loop; do not cause React reconciliation on every frame.
- Make animation interrupt behavior explicit: ignore or safely queue clicks while animating; do not start overlapping timelines that corrupt the point positions.
- Support mouse, touch, keyboard, and visible focus state.
- Keep a non-WebGL static fallback with an accessible description.

### 5.5 Visual quality guardrails

- Do not display a brainstem.
- Do not replace the laptop with a floating abstract brain alone.
- Do not make the particle cloud look like smoke, dust, or an unrecognizable blob.
- Do not use noisy rainbow colors. The color transition must be smooth, iridescent, and mostly mint/green/cyan.
- Do not make the scene full-screen fixed behind all text.
- Do not obscure the headline or CTAs with particles.
- Do not reproduce Neon’s actual logo, waveform artwork, copy, or exact section illustrations.

## 6. Landing page narrative and section design

Use a clear sequence inspired by the reference's short product-story sections.

### Section 1 — Hero

One clear promise, laptop/brain visual, primary and secondary CTA.

### Section 2 — Three benefits

Three wide editorial panels or cards:

1. **Connect your business data** — connect 1C and consolidate information into an isolated cloud PostgreSQL analytical environment.
2. **Understand what drives performance** — product group profitability, inventory, warehouses, and logistics in one view.
3. **Turn analysis into action** — evidence-backed AI insights and downloadable Excel recommendations.

Keep the panels minimal; each needs one visual artifact (data flow, product analytics chart, or report preview).

### Section 3 — How it works

Show a simple flow:

`1C / Other Sources → Connector Agent → Cloud PostgreSQL → Analytics Engine → AI Analyst`

Use simple technical line art and a small number of labels. Explain that the customer's working 1C database stays in place.

### Section 4 — One view of business performance

Use a realistic product UI preview with:

- Revenue and gross profit.
- Product-group profitability.
- Warehouse stock distribution.
- Logistics cost trend.
- Data freshness status.

Do not present mock data as actual customer results.

### Section 5 — AI Analyst

Show a user question, a compact evidence-backed answer, a few actual calculated metrics, recommendation bullets, and an Excel report preview. Clearly label any demo data.

### Section 6 — Financial reporting

Present owner-oriented reports aligned with supported РСБУ mappings. Explain that report completeness depends on the 1C configuration, source data, and validated mappings.

### Section 7 — Security and infrastructure

Explain the local Connector Agent, outbound encrypted connectivity, tenant isolation, and cloud PostgreSQL. Do not claim certifications that the company does not have.

### Section 8 — Pricing / CTA

Explain premium features and onboarding. Do not invent prices, availability, SLAs, or commercial terms.

### Section 9 — Footer

Product, documentation, security, contact, legal pages where real destinations exist.

## 7. Authenticated app design language

The authenticated experience must share the same dark design language while prioritizing scanning, density, and clarity.

### 7.1 Application shell

- Compact top bar with company selector, reporting period, last update, notifications, and profile.
- Left sidebar with a clear active item and optional collapse behavior.
- Main content area aligned to a consistent max-width/grid.
- Use thin borders, restrained panel contrast, minimal shadows, and consistent spacing.

### 7.2 Dashboard cards

- No excessive rounded cards or floating glass panels.
- Prefer transparent/near-black card surfaces with thin borders.
- Large primary number, compact label, small trend/delta, and period context.
- Use green for positive movement only when the metric is actually positive; business context may make a falling cost positive and a rising expense negative.
- Always include units and comparison periods.

### 7.3 Charts

- Use limited series and clear labels.
- Grid lines should be very subtle.
- Use mint/green as the primary series, with cyan/blue as secondary when needed.
- Use color sparingly; the data should remain the focus.
- Include accessible legends, tooltips, units, and textual summary.
- Use red/amber only for real negative states/warnings, never decorative palette variety.

### 7.4 Tables

- Dense but breathable.
- Clear column hierarchy and alignment.
- Numeric values right-aligned and formatted consistently.
- Sticky headers only where useful.
- Sorting, filters, pagination, and empty states must be functional.
- Avoid decorative gradients in table rows.

### 7.5 AI Analyst workspace

- Feels like a premium analysis workstation, not a generic chatbot clone.
- Keep conversation readable and compact.
- Distinguish user messages, AI summaries, deterministic numeric results, source citations, and recommendations.
- Use monospace labels for source IDs / calculation metadata only.
- Display data period, freshness, and validation status.
- Provide an expandable evidence panel and a real report download action when implemented.

### 7.6 1C and database connection screens

- Use precise status indicators: Connected, Syncing, Needs attention, Disconnected, Unsupported configuration.
- Show last sync and supported entity coverage.
- Use a clear stepper for setup and provisioning.
- Show warnings when a configuration does not expose an entity or register required for a report.
- Mask all secret values and connection credentials.

## 8. Motion language

Motion should feel quiet, precise, and intentional.

Use Motion for React for:

- Page/section reveal.
- Navigation state transitions.
- Dialog/drawer enter/exit.
- Small card hover/focus feedback.
- Number transitions only when they clarify an actual data update.

Use Three.js/R3F for the 3D laptop/particle brain.

Use CSS transitions for simple color, border, and opacity changes.

Do not animate every card, chart, table row, and icon. Avoid excessive parallax, long scroll-jacking, bouncing, and constant motion.

Always honor `prefers-reduced-motion`.

## 9. Responsive art direction

### Desktop

- Hero text and laptop side-by-side.
- Full detail in 3D scene.
- Wider feature panels and dashboard grids.

### Tablet

- Reduce 3D footprint and particle count.
- Maintain hierarchy and readable headline.
- Stack feature content where needed.

### Mobile

- Stack hero copy before laptop visual or place the laptop visual beneath the primary CTA.
- Lower particle count substantially or use a static fallback on low-power devices.
- Keep touch target sizes comfortable.
- Never require hover to discover the click animation.
- Keep the main value proposition and CTA visible quickly.

## 10. Visual QA checklist

Review the page at minimum at 1440×900, 1024×768, 768×1024, and 390×844.

- [ ] The first viewport is recognizably in the same dark, minimal, technically sophisticated family as Neon.
- [ ] The product has its own identity and does not look like a Neon clone.
- [ ] Header navigation is compact and aligned.
- [ ] Hero headline is clear and not crowded.
- [ ] Open laptop is the only main physical hero object.
- [ ] Digital brain is visible inside the laptop screen.
- [ ] No brainstem/stalk is present.
- [ ] Particle colors shimmer smoothly within the mint/green/cyan/blue/violet range.
- [ ] Click/tap disperses particles outward, then reconstructs the exact brain.
- [ ] The animation does not block or steal CTA/navigation interactions.
- [ ] Dashboard surfaces remain readable and not overly colorful.
- [ ] Data charts show units, periods, and meaningful labels.
- [ ] All demo data is labelled.
- [ ] Mobile layout is usable and WebGL does not overwhelm the device.
- [ ] Reduced-motion fallback works.

## 11. Source references

- Neon homepage: https://neon.com/
- Neon company / product positioning: https://neon.com/about-us
- Neon AI product narrative: https://neon.com/ai
- Independent captured color/type reference (not an official Neon design system): https://www.pikspec.com/design-systems/neon
- React Three Fiber introduction: https://r3f.docs.pmnd.rs/getting-started/introduction
- Motion for React: https://motion.dev/docs/react

The reference is used for visual principles and storytelling structure only. All product copy, brand elements, 3D assets, and UI implementation must be original to this platform.
