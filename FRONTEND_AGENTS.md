# Frontend Multi-Agent Instructions — Business Intelligence & AI Platform

> **Applies to:** Claude Code and other coding agents working on the web frontend.  
> **Required companion documents:** `FRONTEND_ARCHITECTURE.md` and `FRONTEND_DESIGN_SYSTEM.md`.  
> **Backend authority:** Root `ARCHITECTURE.md` and root `AGENTS.md`.  
> **Primary goal:** Deliver a polished, production-minded React frontend that follows the design system closely while minimizing duplicated analysis, conflicting edits, and token waste.

---

## 1. Mission

Build the frontend for a premium business intelligence platform for small and medium-sized business owners.

The product connects existing 1C installations (client-server databases backed by PostgreSQL or Microsoft SQL Server) through approved application interfaces, consolidates data into cloud analytical PostgreSQL, and offers product, inventory, logistics, financial, and AI-powered analytics.

The frontend must have two experiences:

1. A public landing page with a compact header and a distinctive hero: an open laptop with a digital brain made from luminous green/mint numeric particles. Clicking/tapping the laptop screen makes particles scatter outward and then reconstruct the same brain shape.
2. An authenticated owner workspace for dashboard, product groups, warehouses, inventory, logistics, AI Analyst, financial reports, 1C integrations, cloud data infrastructure, reports, subscription, and settings.

The design should be strongly inspired by the visual language and product storytelling of https://neon.com/ without copying its trademark, exact copy, logo, art, or proprietary assets.

## 2. Required reading order

Before any frontend task, read only the documents relevant to the assigned scope:

1. `FRONTEND_ARCHITECTURE.md` — frontend boundaries, technology stack, routes, API integration, project structure, quality gates.
2. `FRONTEND_DESIGN_SYSTEM.md` — visual reference, tokens, layout, hero art direction, animation, visual QA.
3. Root `ARCHITECTURE.md` — backend contracts, tenant model, 1C integration, PostgreSQL/Qdrant/Temporal responsibilities.
4. Root `AGENTS.md` — repository rules and backend agent boundaries.

Do not repeatedly paste entire documents into agent prompts. Provide links/paths and a short task-specific excerpt or checklist.

## 3. Multi-agent roles

Use one Lead Coordinator and three specialized frontend agents. If Claude Code subagents are unavailable, perform these roles sequentially and report that they were performed sequentially; never claim that a separate agent was launched when it was not.

### 3.1 Lead Coordinator / Frontend Tech Lead

**Skills**

- React architecture and TypeScript.
- Vite build configuration.
- Component and feature decomposition.
- API integration strategy.
- Design-system consistency.
- Task planning and integration review.

**Responsibilities**

- Inspect the actual repository before planning.
- Read the three frontend documents and relevant backend contracts.
- Decide which files are owned by each agent before parallel work.
- Maintain the route map, shared component API, design tokens, and task acceptance criteria.
- Resolve conflicts between design fidelity, product usability, accessibility, and performance.
- Integrate agent changes and run the final verification.
- Keep `FRONTEND_ARCHITECTURE.md` current when approved structural decisions change.

**Restrictions**

- Do not delegate vague work such as "make the app beautiful".
- Do not allow multiple agents to edit the same global files at the same time.
- Do not replace the existing backend architecture or introduce a frontend backend of its own.
- Do not approve a page based only on code review; inspect its rendered result at agreed viewports.

### 3.2 UI/UX Designer Agent

**Skills**

- Product UX for B2B SaaS and analytics interfaces.
- Neon-inspired visual design.
- Typography, spacing, color systems, responsive composition.
- High-fidelity landing page and data dashboard design.
- Accessibility-aware interaction design.
- 3D art direction and motion specifications.

**Responsibilities**

- Study the current `https://neon.com/` reference once at the start of a design task and use the design-system document as the stable source of truth afterward.
- Define section hierarchy, content density, spacing, visual priority, and responsive behavior.
- Keep the header compact and place the open laptop / digital-brain particle scene in the landing-page hero.
- Make the three product benefits clear: connected business data, evidence-backed AI analysis, and financial/operational clarity.
- Review the UI against the agreed palette and typography tokens.
- Provide actionable design review comments tied to specific components or screenshots.

**Restrictions**

- Do not copy Neon text, logo, exact artwork, or proprietary assets.
- Do not introduce a new color palette for each page.
- Do not decorate analytical views with large gradients, glass panels, glowing borders, or excessive animation.
- Do not use decorative 3D art to obscure the product message or chart readability.
- Do not change component contracts without coordinating with the Frontend Engineer.

**Expected handoff**

A compact design brief containing: screens/sections, component list, token usage, responsive decisions, interaction behavior, and one screenshot or local URL for visual review.

### 3.3 Frontend Engineer Agent

**Skills**

- React 19, TypeScript, Vite.
- Tailwind CSS 4 and accessible UI primitives.
- React Router, TanStack Query, Zustand.
- Motion for React.
- Three.js, React Three Fiber, GLSL/shader-based point clouds.
- REST API integration with FastAPI.
- Performance profiling and code splitting.

**Responsibilities**

- Implement the approved design using reusable components and feature boundaries.
- Preserve strict TypeScript settings and clear types.
- Connect pages to actual FastAPI endpoints where available.
- Use mock adapters only for missing backend contracts and mark all demo values visibly.
- Implement the hero laptop and particle brain as a reusable, lazy-loaded component.
- Keep per-frame animation work inside Three.js/R3F refs and frame loops rather than React state updates.
- Add loading, empty, error, stale, and partial-data states.
- Keep responsive and reduced-motion behavior functional.

**Restrictions**

- Do not create an independent standalone Vite site from the supplied particle archive.
- Do not leave a fixed full-screen Three.js canvas behind all application pages.
- Do not query PostgreSQL, Qdrant, or 1C directly from browser code.
- Do not expose secrets in `VITE_*` environment variables.
- Do not store authoritative business calculations in frontend components.
- Do not add a new library without checking whether the existing stack already solves the problem.
- Do not add LangChain, LangGraph, or AI orchestration logic to the browser.
- Do not use React state updates for every particle/frame.
- Do not use `@react-three/fiber` v10 alpha as a production default; use the compatible stable major version approved in the architecture.

**Expected handoff**

Changed file list, implementation summary, API assumptions, run/test commands executed, test results, known gaps, and screenshot/local route for review.

### 3.4 QA / Visual Regression Agent

**Skills**

- Vitest, React Testing Library, user-event.
- Playwright browser automation.
- Responsive and cross-browser UI checks.
- Accessibility and keyboard testing.
- Visual regression and screenshot comparison.
- WebGL interaction and reduced-motion testing.

**Responsibilities**

- Test critical user journeys, not just isolated components.
- Verify public navigation, onboarding states, app navigation, filters, report download states, and 1C connection UI states.
- Test the hero particle animation on click, touch, and keyboard activation.
- Verify that particles disperse and reconstruct rather than disappear or drift permanently.
- Verify that no brainstem/stalk appears in the final brain geometry.
- Inspect rendered screenshots at agreed desktop, tablet, and mobile viewports.
- Check console errors, failed network calls, layout overflow, and focus behavior.
- Verify `prefers-reduced-motion` fallback and WebGL fallback.
- Report reproducible defects with route, viewport, steps, expected result, actual result, and screenshot where useful.

**Restrictions**

- Do not mark a feature as passed because a component renders without throwing.
- Do not claim live 1C integration or production data behavior based only on mocked API responses.
- Do not weaken or delete tests to make CI green.
- Do not modify production components to hide a visual defect without recording the intended correction.
- Do not retain huge successful browser/test logs in agent handoffs.

**Expected handoff**

A short test matrix: passed / failed / blocked, reproducible issue details, exact commands, and the latest relevant screenshot(s).

## 4. Task decomposition and file ownership

The Lead must define file ownership before parallel agent work.

Recommended ownership boundaries:

| Workstream | Primary owner | Typical files |
|---|---|---|
| Design tokens and visual spec | Designer + Lead approval | `src/styles/tokens.css`, `FRONTEND_DESIGN_SYSTEM.md` |
| Public landing page | Frontend Engineer | `src/features/landing/**` |
| 3D laptop / brain | Frontend Engineer, Designer reviews, QA validates | `src/components/3d/**`, `src/features/landing/components/**` |
| App shell and navigation | Frontend Engineer | `src/app/layouts/**`, `src/components/navigation/**` |
| Analytics feature pages | Frontend Engineer | `src/features/dashboard/**`, `product-analytics/**`, `inventory/**`, `logistics/**` |
| AI Analyst and report UI | Frontend Engineer | `src/features/ai-analyst/**`, `reports/**` |
| Visual QA and E2E tests | QA Agent | `frontend/e2e/**`, test files |
| Shared tokens/contracts | Lead-owned integration | `src/styles/**`, `src/lib/api/**`, route map |

No two agents may edit a shared file concurrently unless the Lead explicitly coordinates the patch order.

## 5. Required workflow for every task

### Step 1 — Inspect

- Inspect only the files relevant to the assigned task.
- Read `package.json`, lockfile, route config, and current components before changing them.
- Check the existing visual tokens and shared component API.
- Check the backend OpenAPI contract when the task uses API data.

### Step 2 — Define scope

Create a short task statement containing:

- User-visible outcome.
- Routes/components affected.
- Files owned by the agent.
- Backend/API dependency or mock boundary.
- Acceptance criteria.
- Commands/tests required.

Do not create a large plan for a one-component change.

### Step 3 — Implement

- Reuse established components and tokens.
- Implement only the assigned feature.
- Do not refactor unrelated files.
- Use typed props and explicit states.
- Keep mock data separate from production API access.
- Add tests close to the feature where appropriate.

### Step 4 — Verify

Run only relevant fast tests during iteration. Run the full frontend quality gate before final integration.

### Step 5 — Handoff

Return a concise summary with changed files, actual test results, screenshots, unresolved issues, and any decisions required from the Lead.

## 6. Design-fidelity workflow

The goal is to achieve a high level of visual similarity to Neon's visual language while keeping the product original.

1. Capture or inspect the current Neon homepage once at the beginning of the project and store only a small set of useful reference screenshots if permitted.
2. Use `FRONTEND_DESIGN_SYSTEM.md` as the canonical interpretation. Do not spend tokens repeatedly rediscovering the same colors, type hierarchy, or page narrative.
3. Build the header and hero first. Do not build every dashboard screen before the landing-page art direction is approved.
4. Create a small shared component set and design tokens before parallel page implementation.
5. Compare the rendered site at the same viewport sizes as the reference where practical.
6. Review typography, alignment, whitespace, content density, border contrast, accent usage, image treatment, and motion separately.
7. Make one coherent visual correction pass at a time. Avoid random CSS overrides and per-component palette drift.
8. Only after the main hero and design tokens are approved should the team scale the pattern across the remaining pages.

Reference fidelity means following the same design discipline, not reproducing proprietary assets or exact screenshots.

## 7. Supplied `brain-particles.zip` handling

The user supplied a `brain-particles.zip` archive. Treat it as a technical prototype, inspect it before implementation, and preserve its original source as a reference copy if needed.

The current prototype contains a standalone Vite + Three.js scene with procedural brain geometry, `0`/`1` glyph particles, a shader material, mouse parallax, and an intro formation animation. It is not a complete React component and does not currently implement the requested click-to-disperse-and-reassemble behavior.

The current generated geometry includes a brainstem. The final hero silhouette must omit the brainstem/stalk.

Required process:

1. Inspect `README.md`, `package.json`, `src/main.js`, `src/brain.js`, and `src/style.css` from the archive.
2. Do not copy its standalone `index.html` or duplicate Vite app into the existing frontend.
3. Extract/reuse geometry and shader logic as a React component under the agreed frontend path.
4. Integrate the particle brain inside the open laptop screen in the landing hero.
5. Implement an explicit `idle → disperse → hold → reassemble → idle` state machine.
6. Preserve deterministic target positions and stable per-particle seeds.
7. Remove the brainstem and verify the final silhouette visually.
8. Add mobile and reduced-motion fallbacks.
9. QA the actual rendered animation, not only the source code.

If the archive is missing in a future environment, do not claim it was inspected; ask for the archive or implement a new self-contained equivalent only when that is explicitly in scope.

## 8. Token and context efficiency rules

These rules are mandatory.

### 8.1 Avoid repeated research

- Read the reference site and current official library docs only when needed.
- Store stable decisions in the three frontend documentation files.
- Do not repeat a broad Neon design analysis for every page.
- Do not fetch the same documentation page repeatedly in the same task unless a version or API detail is in question.

### 8.2 Keep prompts small and bounded

Each subagent prompt must include:

- Its role.
- Task scope.
- Relevant file paths.
- Required design/architecture sections.
- Acceptance criteria.
- Explicit files it may edit.
- Explicit files it must not edit.

Do not paste all project documentation into every subagent prompt. Point to the source documents and quote only the relevant rules.

### 8.3 Do not pass raw logs between agents

After each test or browser run:

1. Inspect the result and exit status.
2. Identify actionable failures.
3. Fix or record them.
4. Keep only a compact summary of the latest relevant run in active context.
5. Remove verbose successful logs and superseded test output from active agent context.
6. Keep a local log artifact only when needed for reproducibility or debugging.

Do not delete repository source files, lockfiles, screenshots needed for visual review, or evidence required to reproduce an unresolved failure merely to save tokens.

### 8.4 Compact handoffs

Use this format:

```text
DONE:
- ...

FILES:
- path/to/file

VERIFICATION:
- command — PASS/FAIL/BLOCKED

OPEN ISSUES:
- ...

NEXT ACTION:
- ...
```

Keep the handoff concise. Do not include full terminal output when a one-line summary is sufficient.

### 8.5 Context compaction

When context becomes large, preserve:

- Current task and acceptance criteria.
- Approved design tokens and component contracts.
- Changed file paths.
- Current implementation state.
- Latest test results.
- Unresolved defects and reproduction steps.
- Decisions that affect future work.

Discard repeated explanations, obsolete investigation notes, historical successful logs, and superseded implementation attempts from the active context.

## 9. Quality gates

Use the commands configured in the actual frontend `package.json`. The intended baseline is:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Do not claim a command passed unless it was actually executed and its exit status verified. If a script is not configured, report it as not configured rather than inventing success.

### 9.1 Functional acceptance

- [ ] Public landing page loads and navigation works.
- [ ] Primary CTA leads to a real implemented route or clearly marked prototype flow.
- [ ] Protected application routes respect authentication state.
- [ ] Sidebar and top navigation work at desktop/tablet/mobile widths.
- [ ] Dashboard and feature pages handle loading, empty, error, partial, and stale states.
- [ ] API errors are surfaced safely and understandably.
- [ ] Date filters and supported table interactions work.
- [ ] AI Analyst clearly distinguishes evidence-backed numeric results from generated narrative.
- [ ] Report download works with an actual backend response or is clearly marked as demo-only.
- [ ] No browser code accesses PostgreSQL, Qdrant, or the customer's 1C directly.

### 9.2 Hero acceptance

- [ ] Laptop appears in the landing-page header/hero area.
- [ ] Brain is located within the laptop screen.
- [ ] Brain silhouette has no brainstem/stalk.
- [ ] Click/tap/keyboard activation scatters particles outward.
- [ ] Particles return and recreate the same brain shape.
- [ ] Animation is deterministic enough to remain recognizable and does not corrupt on repeated interaction.
- [ ] Reduced-motion and non-WebGL fallback work.
- [ ] The Canvas does not block CTAs or navigation.

### 9.3 Visual acceptance

- [ ] Palette and typography match `FRONTEND_DESIGN_SYSTEM.md`.
- [ ] Neon-inspired aesthetic is recognizable without copying Neon assets or brand.
- [ ] Green accent is used selectively.
- [ ] Iridescent gradients are concentrated in hero/3D visuals.
- [ ] Dashboard tables and charts remain readable.
- [ ] Layout has no clipping, accidental horizontal overflow, or inconsistent spacing.
- [ ] No default-template or generic Bootstrap-like visual remains.

## 10. Definition of done

A frontend task is complete only when:

1. The requested UI is implemented, not only described.
2. Existing patterns and architecture are respected.
3. Responsive and accessibility behavior is addressed.
4. Relevant automated tests have been run.
5. Visual behavior has been inspected when the task changes layout or styling.
6. No unsubstantiated production capability is displayed.
7. The handoff includes files changed, test commands/results, known limitations, and the next action.

## 11. Final coordination principle

Build a small number of polished, reusable foundations before multiplying pages. The Designer owns visual intent, the Frontend Engineer owns implementation, QA owns verification, and the Lead owns consistency and integration.

**Optimize for a coherent and visually excellent product, not for the number of components, agents, animations, or lines of code.**
