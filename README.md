# Field Operations — Team Rubicon Canada

**Powered by DriveX.**

A field-operations console for disaster-relief deployments: a borrowed field
kitchen feeding 25–50+ Greyshirts for one to three weeks, on unreliable
connectivity.

> This is safety software. **A missed severe allergy is the failure mode that
> matters.** Every ambiguity is designed to warn loudly rather than look clean.

> ⚠️ **Concept build.** This is not an official Team Rubicon product and does not
> ship the Team Rubicon logo. See [Branding](#branding).

## Stack

- **Next.js 15** (App Router, TypeScript **strict**, no `any`), server actions
- **PostgreSQL** + **Drizzle ORM**
- Credentials auth — username + PIN, **no email, no SMTP** (works in a dead zone)
- **Tailwind**, **PWA** + **IndexedDB** (`idb`) for offline reads and a write queue
- `qrcode` for the kiosk QR
- Optional AI, proxied **server-side only**, degrading off with no key

## Getting started

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL and AUTH_SECRET
npm run db:migrate:deploy         # apply migrations
npm run db:seed                   # fictional sample deployment
npm run dev                       # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | ESLint (`no-explicit-any` is an error) |
| `npm test` | Vitest — presence, conflict engine, scorer, shopping list, budget |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate:deploy` | Apply migrations (production-safe, prod deps only) |
| `npm run db:seed` | Load the fictional sample deployment |
| `npm run db:purge` | Retention job — hard-deletes expired volunteer data |

## Deploy to Railway

One project = **this app + a Postgres plugin**.

1. **New → GitHub Repo →** this repository. Set the deploy branch to `main` and
   enable **Wait for CI**.
2. **New → Database → PostgreSQL** in the same project.
3. On the app service set **Variables**:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` — the part before the dot is
     the **Postgres service's name**, which Railway may have generated as
     something like `Postgres-Ad94`. Type `${{` in the value field and pick from
     Railway's autocomplete rather than pasting, or rename the service to
     `Postgres` first. A name that does not match resolves to nothing: the
     literal `${{...}}` string is passed through as the connection URL and the
     release fails at the migration step.
   - `AUTH_SECRET` → `openssl rand -base64 48`
   - `AUTH_URL` → the public Railway URL (makes the kiosk QR absolute)
   - `MASTER_USERNAME`, `MASTER_PIN` → provisions the master account on boot
   - *(optional)* `ANTHROPIC_API_KEY`, `AI_MODEL`
4. **Deploy.** The start command is `npm run start:railway`, which applies
   migrations and then boots on `$PORT`.

> **Why migrations run in the start command, not a `preDeployCommand`:** a
> `preDeployCommand` in `railway.json` was silently not executed on a real
> deployment — the app came up against an empty database and only failed when
> someone tried to sign in. The start command always runs. Migrations are
> idempotent, so re-running them on every boot costs about a second, and a
> failed migration stops the container from starting rather than serving a
> console that cannot reach its data.

**Healthcheck** is `/api/health`. It answers 200 whenever the server can serve,
reporting database state without gating on it — migrations run in the release
phase, so a broken database already fails the deploy, and failing the
healthcheck on a transient blip would restart a server that is still feeding a
field team.

## Branding

Two token layers, deliberately separated (`tailwind.config.ts`):

- **Brand tokens** (`tr-*`, `drivex-*`) carry the Team Rubicon Canada identity —
  red `#CE1126`, charcoal, greyshirt grey — and change on a rebrand.
- **Functional severity tokens** (`severe`, `intolerance`, `preference`) encode
  meaning, not brand. Severe is red because red means stop. **These must survive
  any rebrand.**

This build ships an honest placeholder mark, not the Team Rubicon logo —
fabricating a charity's mark misrepresents them. Replace it only with an
official asset from Team Rubicon Canada, and remove the concept banner
(`ConceptBanner` in `src/components/Brand.tsx`) only once the build is sanctioned.

## Known advisories

`npm audit` reports build-time-only findings that cannot be cleared without a
Next.js 16 major upgrade (`postcss` bundled inside `next`, `esbuild` via
`drizzle-kit`). The production dependency tree is clean — notably `drizzle-orm`
is pinned at `>=0.45.2`, which fixes the SQL-identifier injection advisory
(GHSA-gpj5-g38j-94v9).
