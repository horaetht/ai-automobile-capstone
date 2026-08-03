# Online Garage — Frontend

React + Vite single-page application for Online Garage: authentication, multi-vehicle garage management, NHTSA-backed vehicle/VIN lookup, and per-vehicle maintenance tracking against a Supabase backend.

See the [root README](../README.md) for full project context, architecture, database schema, and current limitations.

## Stack

- React 19 + React Router 7
- Vite 8
- `@supabase/supabase-js` (Authentication + PostgreSQL)
- ESLint

## Main Commands

Run from this `frontend/` directory:

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run lint       # run ESLint
npm run build      # production build
npm run preview    # preview the production build locally
```

## Environment Variables

Create `frontend/.env.local` (never committed) from `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Both are required by `src/lib/supabaseClient.js`; the app throws on startup if either is missing.

## Main Directories

```text
src/
├── pages/        # Route-level views (Landing, Login, Signup, Home, Garage, Dashboard, Maintenance, SymptomChecker)
├── components/    # Reusable UI: Header, ProtectedRoute, VehicleCard, VehicleSummaryCard, MaintenanceTable, TelemetryCard
├── context/       # AuthContext / useAuth — Supabase session state
├── services/      # vehicleService, maintenanceService (Supabase queries), nhtsaVehicleService (NHTSA vPIC API)
├── lib/           # Supabase client initialization
└── data/          # Static data backing the symptom checker demo (not from Supabase)
```

## Development Notes

- Routing lives in `src/App.jsx`; protected routes are wrapped in `ProtectedRoute`, which redirects unauthenticated users to `/login`.
- `vehicleService.js` and `maintenanceService.js` are thin wrappers around Supabase queries — Row Level Security on the backend is the actual ownership boundary, not client-side checks.
- `nhtsaVehicleService.js` calls the public NHTSA vPIC API directly from the browser and caches results in memory per session.
- The symptom checker page currently reads from `src/data/mockData.js`, not Supabase — see the root README's Current Limitations section before extending it.
