# Plan 6 — Frontend Bundle & Rendering

**Findings**: #20
**Effort**: 1–2 days
**Tier**: 📉 Medium

## Why

Zero `React.lazy`/`Suspense`. `draft-js`, `react-draft-wysiwyg`, `recharts`, `@mui/x-date-pickers` all ship in the initial bundle. Likely ~1.5–3 MB gzipped on first load. Bundle savings of 30–50% available with a half-day refactor.

## Approach

- **Files**: `src/App.tsx:7-28`; `src/components/WorkActivityEditDialog.tsx:31-35`
- **Steps**:
  1. Lazy-load every route component:
     ```typescript
     const Dashboard = React.lazy(() => import('./components/Dashboard'));
     const Reports = React.lazy(() => import('./components/Reports'));
     const Admin = React.lazy(() => import('./components/Admin'));
     const Invoices = React.lazy(() => import('./components/Invoices'));
     // ...all 30+ route components
     ```
  2. Wrap `<Routes>` in `<Suspense fallback={<CircularProgress />}>`.
  3. Inside `WorkActivityEditDialog.tsx`, lazy-load the rich-text editor: split the editor body into a separate component and `React.lazy` it so `draft-js` only loads when the dialog opens.
  4. Optional: install `source-map-explorer` to verify before/after.

## Verify

- `npm run build` → check `build/static/js/` for split chunks (multiple JS files instead of one giant `main.*.js`).
- Login page first load <500KB gzipped (was likely 1.5–3MB).
- Opening `WorkActivityEditDialog` triggers a network request for the editor chunk on first open only.
