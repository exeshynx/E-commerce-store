# Veyora E-Commerce

Veyora is a full-stack fashion store built as a TypeScript npm-workspaces monorepo. It includes a responsive React storefront, dynamic category navigation, optional customer accounts, guest cart and checkout, inventory-aware ordering, Safepay hosted payments, queued SMTP notifications, and a role-protected administration dashboard.

The admin area manages products, categories, inventory, users, orders, payments, shipments, returns, reviews, coupons, support, campaigns, and cart/purchase activity. Product files are served from `apps/api/uploads/products/`; uploaded products receive their own folder.

## Architecture

- `apps/web` — React 19, Vite 8, Tailwind CSS 4, React Router, TanStack Query, Zustand
- `apps/api` — Express 5 API and background worker, Prisma ORM, JWT authentication
- `packages/contracts` — shared API request/response types
- `apps/api/prisma/schema.prisma` — MySQL data model
- `apps/api/prisma/migrations` — versioned database migrations
- `apps/api/src/scripts/seed-database.ts` — idempotent development catalog seed
- `vercel.json` — Vercel configuration for the static storefront
- `render.yaml` and `deploy/` — persistent API/worker deployment examples

Veyora uses its own MySQL database named `veyora`; it does not read from or write to any other project's database.

## A — Requirements

1. Install Node.js 22.12.0 or newer. Node 22 LTS or newer is supported.
2. Install npm 10 or newer.
3. Install Laragon with MySQL 8.x or a compatible MariaDB/MySQL server.
4. Keep Git available if you intend to clone or contribute.

Check the runtime versions:

```powershell
node -v
npm -v
git --version
```

The repository uses npm workspaces and `engine-strict=true`; do not install each workspace separately.

## B — Clone and install

1. Clone and enter the repository:

   ```powershell
   git clone https://github.com/exeshynx/E-commerce-store.git
   Set-Location E-commerce-store
   ```

2. Install all workspace dependencies from the repository root:

   ```powershell
   npm install
   ```

3. Create the local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Replace `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` with three different random values of at least 32 characters. Do not commit `.env`.

5. Validate the environment without printing its secrets:

   ```powershell
   npm run env:check
   ```

The local defaults use these application URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health/ready`

### Environment variables

The complete safe template is in `.env.example`. Important groups are:

- Application: `NODE_ENV`, `API_HOST`, `API_PORT`, `API_URL`, `WEB_URL`
- Database: `DATABASE_URL`
- Authentication: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, token TTLs, bcrypt and rate-limit settings
- Payment: `SAFEPAY_ENABLED`, `SAFEPAY_ENVIRONMENT`, `SAFEPAY_PUBLIC_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET`
- Email: `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
- Worker/operations: `WORKER_POLL_INTERVAL_MS`, `WORKER_BATCH_SIZE`, retention settings, `METRICS_TOKEN`
- Frontend: `VITE_API_URL`
- Admin bootstrap: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`

Safepay and SMTP remain disabled until valid credentials are supplied. Payment credentials and SMTP secrets belong only in `.env` or the deployment platform's secret store—never in a `VITE_*` variable.

## C — Database setup (Laragon/MySQL)

1. Open Laragon and click **Start All**, or start its MySQL service.
2. Confirm the MySQL server uses the host and port configured in `DATABASE_URL`. The included Laragon default is:

   ```text
   mysql://root:@localhost:3306/veyora
   ```

   If the local root account has a password, URL-encode it and place it after `root:`.

3. Create the database if it does not already exist. In Laragon Terminal or any MySQL client:

   ```powershell
   mysql -u root -e "CREATE DATABASE IF NOT EXISTS veyora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

   If the account requires a password, use `mysql -u root -p` and enter it when prompted.

4. Generate the Prisma client:

   ```powershell
   npm run prisma:generate
   ```

5. Apply the committed migrations:

   ```powershell
   npm run db:migrate:deploy
   ```

   For a new development migration after changing `schema.prisma`, use:

   ```powershell
   npm run db:migrate -- --name describe_your_change
   ```

6. Seed the safe development catalog. The seed is idempotent and currently creates four categories and sixteen products:

   ```powershell
   npm run db:seed
   ```

7. Confirm the migration state:

   ```powershell
   npm run db:status
   ```

8. Open `http://localhost/phpmyadmin/` from Laragon and confirm the `veyora` database and its tables are visible. You can also inspect them with:

   ```powershell
   npm run db:studio
   ```

The schema defines relationships for registered and guest shoppers, authentication sessions, categories, products and images, inventory, carts, wishlists, orders and immutable order items, payment attempts/refunds/webhooks, shipments, campaigns and recipients, email queue items, returns, support, reviews, coupons, addresses, and activity/audit data.

### Create the first administrator

Set all four `ADMIN_*` values in `.env`, then run:

```powershell
npm run admin:bootstrap
```

The command creates or promotes the configured account without printing its password. Remove the bootstrap password from `.env` after use if it is no longer needed.

## D — Run the storefront

With the API running, start only the Vite frontend:

```powershell
npm run dev:web
```

Open `http://localhost:5173`. In local development, Vite proxies `/api`, `/health`, and `/uploads` to `http://localhost:4000`.

## E — Run the backend

Start the Express API on port 4000:

```powershell
npm run dev:api
```

In a second terminal, run the email/reconciliation background worker:

```powershell
npm run dev:worker
```

Alternatively, start the web app, API, and worker together from the repository root:

```powershell
npm run dev
```

Useful checks:

```powershell
Invoke-RestMethod http://localhost:4000/health/live
Invoke-RestMethod http://localhost:4000/health/ready
```

The storefront allows guest purchasing. Registration and sign-in are optional, while account-only features such as saved addresses, order history, returns, and wishlists remain protected.

## F — Test and production build

Run the complete project validation:

```powershell
npm run validate
```

Or run individual checks:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

After `npm run build`:

- Frontend output: `apps/web/dist`
- Backend output: `apps/api/dist`
- Shared contracts output: `packages/contracts/dist`

Run the production API and worker in separate processes:

```powershell
$env:NODE_ENV = 'production'
npm start
```

```powershell
$env:NODE_ENV = 'production'
npm run start:worker
```

For a local preview of the built storefront:

```powershell
npm run preview -w @veyora/web
```

### Deployment

`vercel.json` deploys the Vite storefront to Vercel. Set `VITE_API_URL` to the public HTTPS API URL before the Vercel build.

The Express API, worker, MySQL database, and uploaded product files require persistent server processes/storage and should be deployed to Render, Railway, a Docker VPS, or an equivalent host. Apply migrations as a pre-deploy command:

```powershell
npm run db:migrate:deploy
```

Use `deploy/.env.production.example` as the production secret checklist. Configure Safepay's return/webhook URLs and SMTP only after the public API and web origins are known.

## G — Complete local startup order

1. Open Laragon and start MySQL.
2. Ensure the `veyora` database exists.
3. Copy/configure `.env` and run `npm run env:check`.
4. Run `npm install` on the first checkout.
5. Run `npm run prisma:generate` and `npm run db:migrate:deploy`.
6. Run `npm run db:seed` once; rerunning it is safe.
7. Run `npm run dev` to start the API, worker, and storefront.
8. Open `http://localhost:5173`.
9. Use `/admin` after bootstrapping and signing in with an administrator account.

## Repository hygiene

Local `.env` files, build output, dependencies, test reports, generated Prisma client files, logs, archives, and runtime uploads are ignored. Only the safe environment templates, Prisma schema/migrations, and development placeholder asset are committed.
