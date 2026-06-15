# YeldnIN

Internal operations platform for **Yeldn Health** (Egypt). Back-office for two
business lines — **EGV** (Egypt Vitamins: supplements & devices) and **XOONX**
(global "order anything"). The customer-facing storefront ("Veeey") is separate.

Bilingual (English + Arabic, full RTL), installable, dark/light themes.

## Stack
Next.js 15 (App Router, RSC + Server Actions) · TypeScript · Tailwind ·
Prisma + SQLite (engine-free via `node:sqlite`) · hand-rolled auth (HMAC session
+ bcrypt) · custom i18n. See [`CLAUDE.md`](CLAUDE.md) for conventions and the
[`APP_BLUEPRINT.md`](APP_BLUEPRINT.md) for the full spec.

## Develop
```bash
npm install
npm run db:seed        # modules, teams, expense categories/accounts, super-admin
npm run dev            # http://localhost:3200
```
Default super-admin (dev): `admin@yeldn.local` / `ChangeMe!2026`.

```bash
npm run typecheck      # tsc --noEmit (0 errors)
npm test               # vitest (pure logic units)
npm run build          # production build
```

## Modules
| Status | Module |
|---|---|
| ✅ | Auth, RBAC (4-level per-user module permissions), app shell |
| ✅ | Appearance (themes, light/dark/system) + branding + per-user prefs |
| ✅ | Pricing (Supplements + Devices calculators, History, Variables, Suppliers) |
| ✅ | Expenses (transactions, dashboard, reports, reconciliation, monthly admin, audit) |
| ⏳ | Sales · Purchasing · Logistics · Operations · Couriers · Issues · History |

## Deploy
See [`DEPLOY.md`](DEPLOY.md). Production: `in.yeldn.com`, PM2 behind nginx on
internal port 3200, Node 24+.
