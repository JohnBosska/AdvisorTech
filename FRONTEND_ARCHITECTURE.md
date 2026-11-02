# Frontend Architecture — Business Intelligence & AI Platform

> **Document type:** Frontend technical architecture and implementation specification  
> **Status:** Proposed target architecture; inspect the repository before implementation.  
> **Product:** Premium business intelligence and AI analytics platform for small and medium-sized businesses.  
> **Backend:** Existing Python 3.14 + FastAPI Modular Monolith.  
> **Primary frontend:** React + TypeScript + Vite.  
> **Design reference:** https://neon.com/ (visual inspiration only; do not copy its brand, copy, or assets).

---

## 1. Mission

Build a production-quality frontend for a premium business intelligence platform that gives a business owner one understandable view of their company's financial and operational performance.

The interface must make the following capabilities easy to understand and use:

1. **Connect 1C and consolidate data.** A customer can connect an existing client-server 1C installation backed by PostgreSQL or Microsoft SQL Server. The platform obtains business data through approved 1C application interfaces and stores normalized analytical data in the customer's cloud analytical PostgreSQL environment.
2. **Understand business performance.** The owner can analyze product groups, sales, purchasing, warehouse balances, stock movements, logistics costs, and operating efficiency.
3. **Use AI for evidence-backed analysis.** The AI Analyst can combine deterministic analytics tools with relevant RAG context, explain findings, and create a downloadable Excel report containing calculations, recommendations, assumptions, and source references.
4. **Review owner-oriented financial reports.** The product presents financial information aligned with applicable РСБУ requirements when the connected source data and mappings support it. The interface must clearly show completeness, validation, and limitations.
5. **Use managed analytical infrastructure.** The platform provisions and monitors a cloud PostgreSQL analytical database for each tenant according to the subscription and infrastructure plan.

The frontend is not an accounting system and must not imply that it replaces 1C or performs statutory accounting operations. It is a business intelligence and decision-support interface.

## 2. Repository integration and project header

The frontend belongs in the existing repository without disturbing the Python backend.

Before creating files, inspect the repository root, current README, `AGENTS.md`, `ARCHITECTURE.md`, `pyproject.toml`, Docker Compose, and any existing frontend/package manifests. Do not overwrite an existing frontend or package manager setup.

If no frontend exists, use this default location:

```text
frontend/
  package.json
  package-lock.json
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  src/
```

Keep the Python backend at its existing location. Do not turn the backend into a JavaScript project and do not introduce Next.js unless an approved product requirement changes the deployment/rendering strategy.

### 2.1 Required project documentation references

The root project documentation must make the frontend instructions discoverable. Add this section near the top of the root `README.md` (or update an existing documentation index rather than duplicating it):

```markdown
## Frontend

The web application is developed with React, TypeScript, and Vite.

- [Frontend architecture](./FRONTEND_ARCHITECTURE.md)
- [Frontend design system](./FRONTEND_DESIGN_SYSTEM.md)
- [Frontend multi-agent workflow](./FRONTEND_AGENTS.md)

The public website and authenticated owner workspace follow the product's Neon-inspired dark technical design language. The landing-page hero includes an interactive 3D laptop / digital-brain particle visual.

Run the frontend from `frontend/` using the scripts documented in its `package.json`.
```

If the repository has no README yet, create a concise root README and put the project name, one-sentence product description, backend/ frontend directories, quick-start commands, and links to the architecture documents at the top. Do not duplicate hundreds of lines from the architecture files into README.

### 2.2 Brand configuration

The official product name is **Tech Adviser**. It lives in one place, `frontend/src/config/brand.ts` (`PRODUCT_NAME`), plus the logo in `components/navigation/Wordmark.tsx`; do not hardcode the name or introduce alternative names elsewhere.

## 3. Technology stack

Use a small, coherent stack. Prefer the repository's existing compatible tooling if it is already established; otherwise use the defaults below. Select current stable releases at implementation time, pin them through the package lockfile, and do not install alpha/beta packages for production work.

| Concern | Recommended technology | Responsibility |
|---|---|---|
| UI framework | React 19 | Component-based UI and route layouts |
| Language | TypeScript with strict mode | Typed components, API contracts, domain models |
| Build tool | Vite (current stable) | Development server, HMR, production assets |
| Styling | Tailwind CSS 4 + CSS variables | Layout utilities and centralized design tokens |
| Accessible UI primitives | shadcn/ui selectively, with Radix primitives where appropriate | Dialogs, menus, tabs, popovers, selects, accessible controls |
| Icons | `lucide-react` | Consistent interface icons |
| Routing | React Router 7 | Public routes, protected application routes, nested layouts |
| Server state | TanStack Query | API fetching, caching, retries, invalidation, loading/error state |
| Local UI state | Zustand only where shared state is useful | Sidebar, global filters, transient UI state; do not mirror server data |
| Forms | React Hook Form + Zod | Form state and client-side validation aligned with API schemas |
| Standard UI motion | Motion for React (`motion`, import from `motion/react`) | Page transitions, reveals, micro-interactions, gestures |
| 3D / WebGL | Three.js + `@react-three/fiber` v9 + `@react-three/drei` | Interactive laptop and digital-brain particle scene |
| Charts | Recharts | Dashboard charts and conventional analytics visualizations |
| Data tables | TanStack Table where complex sorting/filtering/pagination is needed | Dense analytical tables |
| API types | `openapi-typescript` or equivalent generated from FastAPI OpenAPI | Keep frontend contracts aligned with backend |
| Unit/component tests | Vitest + React Testing Library + user-event | Component and UI behavior tests |
| Browser E2E | Playwright | Core user journeys and responsive smoke tests |
| Lint/format | ESLint + Prettier | Consistent code quality |

### 3.1 Version compatibility rules

- Use React 19 with a matching React DOM version.
- React Three Fiber v9 is the stable compatibility line for React 19. Do not use the v10 alpha in production without an explicit decision and compatibility spike.
- Use Motion for React from the `motion` package (`motion/react` imports). Do not add both Motion and legacy Framer Motion for the same task.
- Use Tailwind CSS 4 with the official Vite plugin when creating a new frontend. Do not mix Tailwind v3 configuration patterns with v4.
- Verify current official install instructions before introducing or upgrading a major dependency.
- Do not add a library when CSS, a native browser API, or an existing project dependency already solves the problem adequately.

### 3.2 Package manager

Inspect the repository first. If the frontend has no existing package manager lockfile, use npm and commit `package-lock.json`. If a `pnpm-lock.yaml` or Yarn lockfile already exists, preserve the existing package manager. Never commit multiple competing JavaScript lockfiles.

## 4. Application types and route architecture

The frontend has two experiences sharing the same design system:

- **Public marketing website:** explains the value proposition, demonstrates the product, builds trust, and converts visitors to registration/demo/onboarding.
- **Authenticated owner workspace:** provides operational and financial analytics, 1C connection management, AI analysis, reports, and subscription settings.

Recommended route map:

```text
/                              Public landing page
/product                       Product capabilities
/how-it-works                  Integration and data-flow explanation
/security                      Security and data ownership
/pricing                       Premium subscription explanation
/login                         Authentication
/register                      Registration
/onboarding                    Protected onboarding flow

/app                           Authenticated application shell
/app/dashboard                 Business overview
/app/analytics/products        Product group analytics
/app/inventory                 Inventory and warehouses
/app/logistics                 Logistics analytics
/app/ai-analyst                AI analyst workspace
/app/financial-reports         Owner-oriented financial reports
/app/integrations              Integration overview
/app/integrations/1c           1C connection and synchronization
/app/data-infrastructure       Cloud PostgreSQL status and provisioning
/app/reports                   Generated reports and downloads
/app/subscription              Premium subscription and billing
/app/settings                  User, organization, and workspace settings
```

Routes are a proposed frontend contract. Before wiring API calls, inspect actual FastAPI routes and OpenAPI output. Do not invent production endpoints just because a page exists in the route map.

## 5. Product information architecture

### 5.1 Public website navigation

Use a minimal top navigation inspired by the information architecture of Neon:

- Product
- Solutions / Capabilities
- How it works
- Security
- Pricing
- Resources (only when real resources exist)
- Log in
- Primary CTA: Start / Request access (use the real product onboarding flow when implemented)

Keep the navigation compact. Do not add a long list of every feature to the header.

### 5.2 Authenticated application navigation

Use a persistent but collapsible sidebar on desktop:

1. Overview
2. Product analytics
3. Inventory & warehouses
4. Logistics
5. AI Analyst
6. Financial reports
7. Integrations
8. Data infrastructure
9. Reports
10. Subscription
11. Settings

Use labels understandable to a non-technical Russian-speaking business owner. The primary application language is Russian. Technical source code, types, identifiers, and developer documentation remain in English.

### 5.3 Main dashboard

The dashboard should answer, at a glance:

- How is the business performing in the selected period?
- What changed compared with the previous period?
- Which product groups contribute most to profit?
- Where are inventory and logistics issues emerging?
- Is the data current and reconciled?
- What should the owner investigate next?

Recommended widgets:

- Revenue
- Gross profit
- Gross margin
- Inventory value
- Logistics expenses
- Sales by product group
- Profitability trend
- Inventory distribution by warehouse
- Data freshness / synchronization status
- AI insight summary
- Open alerts and data quality warnings

All monetary values must use a safe decimal representation and Russian ruble formatting where applicable. Never fabricate production business metrics. Demo data must be visibly labelled as sample data.

## 6. Frontend folder structure

Use feature-oriented grouping and keep visual primitives separate from domain pages.

```text
frontend/
├── public/
│   ├── favicon.svg
│   └── assets/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers/
│   │   └── layouts/
│   │       ├── PublicLayout.tsx
│   │       └── AppLayout.tsx
│   ├── components/
│   │   ├── ui/                  # Accessible primitives and project-styled controls
│   │   ├── navigation/
│   │   ├── feedback/            # Empty, loading, error, warning states
│   │   ├── data-display/        # Metric cards, tables, chart shells
│   │   └── 3d/                  # Reusable Three/R3F scene components
│   ├── features/
│   │   ├── landing/
│   │   ├── dashboard/
│   │   ├── product-analytics/
│   │   ├── inventory/
│   │   ├── logistics/
│   │   ├── ai-analyst/
│   │   ├── financial-reports/
│   │   ├── integrations/
│   │   ├── data-infrastructure/
│   │   ├── reports/
│   │   ├── onboarding/
│   │   └── subscription/
│   ├── hooks/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── format/
│   │   ├── validation/
│   │   └── utils/
│   ├── stores/                  # Client-only UI state
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   ├── types/
│   └── test/
├── e2e/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Adapt this structure to the existing repository if a frontend already exists. Do not create empty folders for hypothetical features; add a module when it has an implementation task.

## 7. Component architecture

### 7.1 Shared design-system components

Build reusable primitives first:

- `Button`, `IconButton`, `LinkButton`
- `Input`, `Textarea`, `Select`, `DateRangePicker`
- `Dialog`, `Drawer`, `DropdownMenu`, `Popover`, `Tooltip`
- `Tabs`, `Badge`, `StatusIndicator`, `Progress`
- `Card`, `SectionHeader`, `PageHeader`
- `MetricCard`, `TrendIndicator`, `ChartContainer`
- `DataTable`, `FilterBar`, `Pagination`
- `EmptyState`, `LoadingState`, `ErrorState`, `DataFreshnessBadge`
- `AppSidebar`, `TopBar`, `CompanySwitcher`, `PeriodSelector`

Components must support keyboard interaction and proper labels/focus states. Use shadcn/ui as a source of accessible component structure, not as a reason to render the default shadcn appearance unchanged. Apply the project design tokens.

### 7.2 Feature ownership

Domain components belong to their feature directory. Shared generic components belong to `components/`. Do not place business-specific logic in generic UI primitives.

Example:

```text
features/inventory/
  pages/InventoryPage.tsx
  components/InventoryKpiGrid.tsx
  components/WarehouseDistribution.tsx
  components/StockRiskTable.tsx
  hooks/useInventorySummary.ts
  api/inventoryApi.ts
  types.ts
```

## 8. Backend integration and data flow

The backend remains the source of truth. The frontend is a client of FastAPI, not a second business-logic layer.

### 8.1 API client

Create one typed API client in `src/lib/api/` with:

- Base URL configured through `VITE_API_BASE_URL`.
- Consistent JSON serialization/deserialization.
- Request correlation where supported.
- Centralized handling of `401`, `403`, `409`, `422`, `429`, and `5xx` responses.
- Safe cancellation using `AbortSignal`.
- Download handling for binary files.
- No secret API keys in Vite environment variables; `VITE_*` values are public in the browser bundle.

Use FastAPI's OpenAPI schema to generate or validate frontend API types. Do not manually duplicate large backend DTO definitions when they can be generated.

### 8.2 Server state vs client state

- TanStack Query owns server state: API entities, analytics responses, sync history, report metadata, and subscription data.
- Zustand owns only local UI state: sidebar state, selected non-persisted view options, transient assistant panel state, and other client-only state.
- URL search parameters should own shareable filters such as reporting period, warehouse, product group, sorting, and pagination where appropriate.
- Do not store API results in Zustand as a second cache.

### 8.3 Tenant context

The authenticated backend session determines the authorized tenant and organization. The frontend may display a company selector, but it must never be treated as an authorization boundary. Every API operation must be validated by FastAPI against the authenticated identity and server-side permissions.

### 8.4 Authentication

Inspect the existing backend authentication contract before implementing the frontend. Do not invent a new auth flow or weaken existing JWT protections.

Prefer secure, HttpOnly, SameSite cookies when supported by the backend contract. If bearer tokens are returned by the current backend, document and implement the safest compatible storage strategy; avoid persistent plaintext tokens in `localStorage` by default.

### 8.5 Excel and report downloads

In production, the backend/report module generates authoritative `.xlsx` files. The frontend should:

1. Request report generation or retrieve a ready report using the real API contract.
2. Show `queued`, `processing`, `ready`, `failed`, or `expired` states when available.
3. Download the file through an authenticated API response or a short-lived signed URL.
4. Show report period, generation time, source data freshness, and any validation warnings.

Do not recalculate official financial values in browser code. A local mock export may be used only for an explicitly labelled prototype state.

## 9. Page implementation requirements

### 9.1 Landing page

Build the public site with this narrative sequence:

1. Compact global navigation.
2. Hero statement and interactive laptop / digital-brain scene.
3. Three product value pillars.
4. 1C-to-cloud-data flow demonstration.
5. Product capability sections (financial, product, inventory, logistics, AI).
6. AI Analyst and Excel report demonstration.
7. Security and data ownership.
8. Premium plan / call to action.
9. Compact footer.

The public site must show product proof rather than generic stock illustrations. Use actual UI previews or clearly-labelled demo views.

### 9.2 Onboarding

Build a guided flow with clear progress and recoverable steps:

1. Company profile.
2. Choose data source / 1C configuration.
3. Connect 1C or select a supported import path.
4. Register and connect Connector Agent where required.
5. Test connection and inspect detected capabilities.
6. Provision the analytical PostgreSQL environment.
7. Start the initial synchronization.
8. Show data validation and completion status.

Only display steps supported by the current backend implementation. Future capabilities may appear in a design prototype only when clearly marked as not yet available.

### 9.3 1C integrations

Show connection status, detected configuration and version, source type, supported entities, last successful sync, active job, sync history, warnings, and available actions. Explain that exact data availability depends on configuration, version, publication, permissions, and adapter support.

### 9.4 Analytics screens

Product analytics, inventory, warehouse, and logistics views should use consistent filters and a shared reporting-period pattern. Every chart should have a clear title, unit, period, tooltip, and empty/error state. Avoid ornamental visualizations that do not answer a business question.

### 9.5 Financial reports

Provide report navigation for Balance Sheet, Financial Results, and Cash Flow where the backend data and mapping support them. Include reporting period, data quality/reconciliation state, source freshness, and export action. Do not use labels such as `certified`, `audited`, or `fully compliant` without verified legal and accounting approval.

### 9.6 AI Analyst

The AI workspace should display:

- Conversation and saved analyses.
- Prompt composer and suggested questions.
- Structured answer sections: summary, findings, calculations, risks, recommendations.
- Evidence/source references and reporting period.
- Data freshness and reconciliation warnings.
- Generated report preview and download action.

Clearly distinguish verified numeric results returned by analytics tools from LLM-generated narrative. Provide an explicit state when data is missing, stale, or insufficient.

## 10. 3D hero scene and supplied brain-particles prototype

A user-provided archive named `brain-particles.zip` is available as a visual/technical reference. Inspect it before rebuilding the animation.

The supplied prototype contains:

- A standalone Vite + Three.js project.
- Procedural brain geometry in `src/brain.js`.
- Glyph atlas for `0` and `1` characters.
- A `THREE.ShaderMaterial` point-cloud renderer.
- Mouse parallax and an intro animation that forms a brain from dispersed points.
- A configurable particle count (approximately 28,000 desktop / 9,000 mobile in the supplied prototype).

It is a prototype, not a ready-made React hero component. Its current code does **not** implement the required click-to-scatter-and-reform interaction. The current procedural geometry also includes a brainstem. The final product hero must not display a brainstem/stalk. Inspect and modify the geometry accordingly. Keep the cerebral hemispheres recognizable; preserve the cerebellum only if it matches the approved design reference and does not create the excluded lower stem silhouette.

### 10.1 Integration rules

- Do not ship the archive as a second independent website or mount its full-screen fixed canvas over the entire application.
- Extract/reuse the relevant geometry, shader, and particle logic as a reusable React component under `src/components/3d/` or `features/landing/components/`.
- Integrate the 3D brain inside the screen of an open laptop displayed in the landing-page hero.
- The laptop shell can be a light, carefully-crafted Three.js/R3F model or a CSS/perspective composition. Prefer a convincing silhouette and clean screen framing over unnecessary physical detail.
- The 3D Canvas must be constrained to the hero visual container and must not intercept clicks intended for navigation or CTAs.
- The laptop screen itself must be an accessible interactive control with a visible focus style and keyboard activation.
- On click/tap, the green numeric/alphanumeric particles disperse outward in multiple directions, then reverse/flow back and reconstruct the exact brain silhouette.
- The scene must support `prefers-reduced-motion`, mobile performance budgets, device-pixel-ratio limits, and a static fallback.
- Lazy-load the 3D scene so dashboard routes do not download Three.js unnecessarily.

See `FRONTEND_DESIGN_SYSTEM.md` for the exact art direction and animation states.

## 11. Localization and formatting

- Primary product interface language: Russian.
- Developer code, identifiers, folder names, and documentation: English.
- Currency: RUB (₽) when the selected organization's reporting currency is RUB.
- Date display: `DD.MM.YYYY` for the Russian locale.
- Number formatting: `Intl.NumberFormat` with explicit locale/currency and no hardcoded punctuation.
- Do not assume all customers use RUB; use organization settings and API-provided currency metadata.

## 12. Responsive behavior

Design desktop-first for analytical workspaces, but provide complete mobile layouts.

- Desktop: full sidebar, multi-column dashboard, wide tables, 3D hero with laptop.
- Tablet: collapsible navigation, reduced chart columns, horizontally scrollable tables only where appropriate.
- Mobile: compact navigation, stacked metrics, readable charts, accessible filters, no forced desktop-width canvas.
- Never make a critical action available only on hover.
- The hero 3D scene may use fewer particles and a simpler laptop silhouette on mobile.

## 13. Performance budgets and rendering rules

- Route-level code splitting for protected sections.
- Lazy-load Three.js/R3F and heavy charting code.
- Avoid mounting the 3D Canvas in authenticated application routes.
- Pause the animation when the tab is hidden or the hero is outside the viewport.
- Cap pixel ratio (normally `Math.min(devicePixelRatio, 1.5–2)` after profiling).
- Use instanced/buffer-based particle geometry and shader work; do not create tens of thousands of React components for particles.
- Avoid React state updates on every animation frame. Keep per-frame work in Three.js/R3F refs and frame loop.
- Honor `prefers-reduced-motion` and provide a static image/canvas alternative.
- Optimize images, fonts, and 3D assets; avoid unnecessary large videos.
- Measure real performance before optimizing blindly.

## 14. Accessibility and UX requirements

- Semantic HTML landmarks and heading hierarchy.
- Keyboard-accessible navigation, buttons, forms, dialogs, and data controls.
- Visible focus rings using the accent color.
- Contrast that remains readable against near-black surfaces.
- Text alternatives for charts and important visualizations.
- Do not rely on green/red alone to communicate status; include labels/icons.
- Reduced-motion mode must preserve functionality.
- 3D visuals are decorative/illustrative and must not contain information available nowhere else.
- Loading, empty, partial, stale, and failed states must be distinguishable.

## 15. Demo data and truthfulness

A frontend prototype may use mock responses, but:

- Keep mock data in a dedicated `mocks/` or feature-local mock module.
- Display a visible `Демо-данные` / sample-data label.
- Do not mix mock records with production API records.
- Do not claim that a live 1C connection, actual cloud provisioning, actual RAG retrieval, or real financial reconciliation has occurred when using mocks.
- Avoid invented customer logos, testimonials, certifications, exact subscription prices, and performance statistics.
- Use neutral sample company names and clearly marked test data.

## 16. Quality gates

Before marking frontend work complete, run the scripts that actually exist in `frontend/package.json`. Target scripts should include:

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Add scripts only when their underlying tools are installed and configured. If Playwright E2E is configured separately, document its command.

Acceptance criteria:

- The application builds without TypeScript or Vite errors.
- Main public and authenticated routes render.
- Navigation and core controls work with mouse and keyboard.
- All API screens handle loading, error, empty, and stale states.
- Demo mode is clearly labelled.
- The landing-page laptop/brain animation works, including click/tap scatter and reconstruction.
- No brainstem appears in the final brain silhouette.
- Reduced-motion and mobile fallbacks work.
- No frontend code accesses backend databases directly.
- No secrets are embedded in client bundles.
- No critical tenant authorization is delegated to the frontend.

## 17. Reference links

Use official documentation and verify it before changing major versions:

- React: https://react.dev/learn/build-a-react-app-from-scratch
- Vite: https://vite.dev/guide/
- Tailwind CSS: https://tailwindcss.com/docs/installation/using-vite
- shadcn/ui: https://ui.shadcn.com/docs/installation/vite
- React Router: https://reactrouter.com/
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Motion for React: https://motion.dev/docs/react
- Three.js: https://threejs.org/docs/
- React Three Fiber: https://r3f.docs.pmnd.rs/getting-started/introduction
- Recharts: https://recharts.org/en-US/
- Vitest: https://vitest.dev/guide/
- Playwright: https://playwright.dev/docs/intro
- Neon visual reference: https://neon.com/

The frontend must borrow the reference's visual discipline and product storytelling, not its trademark, logos, exact copy, or proprietary assets.
