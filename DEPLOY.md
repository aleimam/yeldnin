# Deploying YeldnIN

Target: `in.yeldn.com` on a CWP + nginx server, Node app behind an nginx reverse
proxy on internal port **3200**, managed by **PM2**. SQLite file DB.

## ⚠ Node / node:sqlite

The runtime uses Prisma's engine-free client over **`node:sqlite`** (see
`CLAUDE.md`). It is **stable & flag-free in Node 24+**. On **Node 22.x** the same
API exists but is gated behind `--experimental-sqlite` — the production server
(Node 22.22) runs fine with that flag, which is baked into:
- `ecosystem.config.js` → `env.NODE_OPTIONS=--experimental-sqlite` (runtime)
- the `build` / `db:seed` commands below (prefix `NODE_OPTIONS=--experimental-sqlite`)

```bash
node -v   # 22.x (needs the flag) or 24+ (flag-free)
```

## First deployment

```bash
# 1. Get the code (on the server)
git clone https://github.com/aleimam/yeldnin.git /home/yeldnin/app
cd /home/yeldnin/app

# 2. Secrets — create .env.local (NOT committed)
cp .env.example .env.local
node -e "console.log('SESSION_SECRET='+require('crypto').randomBytes(48).toString('base64url'))" >> .env.local
#   then edit .env.local: keep one SESSION_SECRET line, set PORT=3200

# 3. Install + DB + build  (Node 22 needs the flag; Node 24+ can omit it)
npm ci
npx prisma migrate deploy      # applies migrations, creates prisma/dev.db
NODE_OPTIONS=--experimental-sqlite npm run db:seed   # modules, teams, categories/accounts, super-admin
NODE_OPTIONS=--experimental-sqlite npm run build

# 4. Start under PM2
pm2 start ecosystem.config.js
pm2 save                       # persist across reboots

# 5. nginx vhost (enable in.yeldn.com -> 127.0.0.1:3200)
cp deploy/in.yeldn.com.conf /etc/nginx/conf.d/in.yeldn.com.conf
#   (on CWP, the disabled vhost in conf.d/vhosts/in.yeldn.com.conf.disabled can be
#    removed/renamed so it doesn't conflict; issue AutoSSL for in.yeldn.com)
nginx -t && systemctl reload nginx
```

Then change the default super-admin password (`admin@yeldn.local` / `ChangeMe!2026`)
on first login.

## Updates (subsequent deploys)

```bash
cd /home/yeldnin/app
cp prisma/dev.db prisma/dev.db.bak.$(date +%F)   # back up the DB first
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload yeldnin
```

## Notes
- `SESSION_SECRET` MUST be set in production — the app refuses to start with the
  dev placeholder when `NODE_ENV=production`.
- Uploaded files live in `./uploads` (gitignored); back them up alongside the DB.
- The internal port (3200) is firewalled; only nginx talks to it.
