# YeldnIN — internal operations platform for Yeldn Health

Internal back-office platform (the storefront "Veeey" is a separate app). Two
business lines: **VEEEY** (the Veeey storefront line, formerly "EGV" — supplements/devices) and **XOONX**
(global "order anything" service). See `APP_BLUEPRINT.md` for the full spec and
`PDD.docx` for the product design doc. (The pricing math from the original
`Pricing.xlsx` is long since implemented in the Pricing module; the file is gone.)

> **⚠ Read `HANDOFF.md` before deploying or touching permissions/scope code.**
> It carries the operational runbook (deploy gotchas that each caused a real
> incident), the golden-rule enforcement map, and the current production state.

## Stack

- **Next.js 15** (App Router, RSC + Server Actions), **TypeScript** (strict).
- **Tailwind CSS** + shared utility classes (`.card`, `.btn-primary`, `.input`,
  `.label`, `.th`, `.td`, `.role-badge`) defined in `src/app/globals.css`.
  Brand color is the `--brand` CSS variable (admin-settable).
- **Prisma + SQLite**, engine-free. See the DB note below.
- **Custom i18n**: `src/i18n/{en,ar}.json` flat dicts; `getT()` (server),
  `useT()`/`I18nProvider` (client). RTL via `dir` + logical props (`ps/pe`,
  `ms/me`, `start/end`). Locale in the `yeldnin_locale` cookie.
- **Auth**: hand-rolled (HMAC session cookie + bcrypt) — *Phase 1, not yet built*.

## ⚠ Database — read before touching Prisma

This machine is **Windows on ARM (win32/arm64)**. Prisma's native x64 query
engine `.node` **cannot load** here ("not a valid Win32 application"), and
neither `better-sqlite3` nor `@libsql/client` ship ARM64-Windows prebuilds (no
local C/Python toolchain to compile them). The working setup is:

- `generator client { engineType = "client" }` → engine-free WASM query
  compiler (no native `.node`).
- Driver adapter **`prisma-adapter-node-sqlite`** over Node's built-in
  `node:sqlite` (native to the arm64 Node runtime). Wired in `src/lib/db.ts`.
- DB file: `prisma/dev.db` (gitignored). `DATABASE_URL="file:./dev.db"` (CLI,
  relative to `prisma/`); the runtime adapter resolves an absolute path.

Do **not** switch to the native engine or better-sqlite3 unless the target
machine is x64 (the CentOS server is x64, so it could use either there).

## Commands

```bash
npm run dev          # dev server on http://localhost:3200
npm run build        # production build
npm run typecheck    # tsc --noEmit (must be 0 errors)
npm test             # vitest (pure *-logic.ts units)
npm run db:seed      # idempotent seed (modules, teams, settings, super-admin)
npx prisma migrate dev --name <name>   # schema change + migration
```

Default super-admin (dev only): `admin@yeldn.local` / `ChangeMe!2026`.

## Conventions (from the blueprint)

- **Pure logic vs service split**: `lib/<x>-logic.ts` (pure, unit-tested) +
  `lib/<x>-service.ts` (`import "server-only"`, touches Prisma).
- Mutations via **Server Actions**: guard with permission check → service →
  `revalidatePath` → `redirect`. Validation errors returned as `{ error }`.
- **4-level per-user module permissions**: NONE / VIEW / OPERATE / MANAGE
  (`UserModulePermission`). Permissions are **purely per-user** (teams group
  users but do not auto-grant).
- **Scope** (VEEEY / XOONX / PERSONAL) is a hard data boundary — Sales sees only
  VEEEY, XOONX only XOONX; neither sees Trips/Travelers.
- Soft-delete (`archivedAt`) over hard-delete; double-confirm destructive ops.
- UIDs: `<PREFIX><YY><MM><seq3>` via the `Counter` table.

## Ports

- Dev + prod internal: **3200** (behind nginx in prod). The server already runs
  another app on 3100; local machine also uses 3000/3001/3100/2900.

## Build order

Phase 0 ✅ scaffold · Phase 1 auth+RBAC+shell · Phase 2 Pricing · then the rest.
