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

> ⚠️ **The live app directory is `/home/yeldn/app`, not `/home/yeldnin/app`** — verified against
> `pm2 jlist` on 2026-07-22. The paths above are the original install instructions; the box does not
> match them. The branch is **`main`** (`git push origin main`), not master.
>
> Build needs the SQLite flag: `NODE_OPTIONS=--experimental-sqlite npm run build`. Gate the reload on
> its exit code — never reload onto a failed build.

```bash
cd /home/yeldn/app
cp prisma/dev.db prisma/dev.db.bak.$(date +%F)   # back up the DB first
git pull --ff-only
npx prisma migrate deploy
if NODE_OPTIONS=--experimental-sqlite npm run build > /tmp/yeldnin-build.log 2>&1; then
  pm2 reload yeldnin
else
  echo "BUILD FAILED — not reloading"; tail -25 /tmp/yeldnin-build.log; exit 1
fi
# Verify: / redirects to /login (307) and /login is 200. Loopback-only by design.
curl -s -o /dev/null -w '/login %{http_code}\n' http://127.0.0.1:3200/login
```

⚠️ **A migration that REDEFINES a table needs the app stopped.** SQLite gives
`Error: SQLite database error — database is locked` while pm2 holds connections, and
`migrate deploy` reports it as a Rust stack trace that is easy to mistake for noise — it exits
having applied nothing. Adding a column with a foreign key counts, because Prisma implements it
as create-new / copy / drop / rename. Back up first, since a half-run redefine is the one way to
lose data here:

```bash
cp prisma/dev.db prisma/dev.db.pre-<change>-$(date +%F)
pm2 stop yeldnin && sleep 2
npx prisma migrate deploy          # verify it says "successfully applied"
pm2 start yeldnin
# Confirm the new column really exists — a failed deploy leaves the app happily running:
node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('prisma/dev.db').prepare('PRAGMA table_info(Employee)').all().map(c=>c.name).join(' '))"
```

**There is no ESLint config in this repo at all** — `npm run lint` calls the removed `next lint`, and
plain `npx eslint` fails too ("couldn't find eslint.config.js"). The real gate here is
`npm run typecheck && npm run test && npm run build`.

## ⚠ nginx on this multi-vhost box (in.yeldn.com)

Other vhosts (veeey, CWP) bind `listen 204.168.129.186:443` (a specific IP).
`certbot --nginx` writes `listen 443 ssl` (wildcard `0.0.0.0:443`), which nginx
treats as a *separate* listen socket — so connections to the public IP fall
through to CWP's default (self-signed) vhost and return 404. After running
certbot, ensure our vhost uses the **specific IP**:

```bash
sed -i 's/listen 443 ssl;/listen 204.168.129.186:443 ssl;/' /etc/nginx/conf.d/yeldnin-app.conf
nginx -t && systemctl reload nginx
```

(Re-check this if certbot ever rewrites the vhost, e.g. on a manual re-issue.)

## Notes
- `SESSION_SECRET` MUST be set in production — the app refuses to start with the
  dev placeholder when `NODE_ENV=production`.
- Uploaded files live in `./uploads` (gitignored); back them up alongside the DB.
- The internal port (3200) is firewalled; only nginx talks to it.
