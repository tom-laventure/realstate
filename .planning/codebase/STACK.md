# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- Ruby 4.0.2 — Backend API (`backend/`), pinned in `backend/Gemfile` line 3 and `backend/.ruby-version`
- TypeScript 4.9.4 — Frontend SPA (`frontend/src/`), strict mode enabled

**Secondary:**
- SQL (PostgreSQL dialect) — Database queries and migrations
- SCSS/Sass 1.79.5 — Frontend supplemental styles alongside Tailwind

## Runtime

**Backend Environment:**
- Ruby 4.0.2
- Puma 6.4.3 — Rack web server, dev port 8080

**Frontend Environment:**
- Node.js 22 (pinned in `frontend/.nvmrc`)
- Vite 6.4.1 dev server — port 3000

**Package Manager:**
- Ruby: Bundler — lockfile at `backend/Gemfile.lock`
- JavaScript: npm — lockfile at `frontend/package-lock.json`

## Frameworks

**Core (Backend):**
- Rails 7.1.5 — JSON API only mode (`config.api_only = true` in `backend/config/application.rb`)
  - `ActionController::API` base class (no session/cookie middleware by default; added back via `config/application.rb`)
  - Loaded railties: ActiveRecord, ActiveStorage, ActionMailer, ActionMailbox, ActionText, ActionCable, ActionController
  - Views only used for mailer templates

**Core (Frontend):**
- React 18.2.0 — SPA framework
- React Router DOM 6.4.3 — client-side routing (`frontend/src/router/`)
- TanStack Query (React Query) 4.22.0 — server state management (`frontend/src/store/hooks/`)
- Redux Toolkit 1.9.1 + React Redux 8.0.5 — client state (limited use alongside TanStack Query)

**UI Components:**
- shadcn/ui (New York style, zinc base) — component primitives built on Radix UI
  - Config: `frontend/components.json`
  - Components: `frontend/src/components/ui/`
  - Icons: `lucide-react` 0.555.0 (ONLY permitted icon library)
- Radix UI primitives: `@radix-ui/react-avatar`, `react-dialog`, `react-dropdown-menu`, `react-label`, `react-popover`, `react-select`, `react-tabs`
- Tailwind CSS 4.1.18 — utility-first styling (CSS variables enabled, zinc base color)
- `tailwind-merge` 2.6.1 + `class-variance-authority` 0.7.1 + `clsx` 2.1.1 — class composition (`cn()` in `frontend/src/lib/utils.ts`)
- `tailwindcss-animate` 1.0.7 — CSS animation utilities

**Build/Dev:**
- Vite 6.4.1 (`frontend/vite.config.ts`)
  - `@vitejs/plugin-react` 4.7.0 — JSX transform
  - `@tailwindcss/vite` 4.1.18 — Tailwind v4 Vite plugin (no `postcss.config.js` needed for Tailwind)
  - `@` alias resolves to `frontend/src/`
  - Dev server hosts: `*.realstate.local`, `*.realstate.ca`, `localhost`

**Testing (Backend):**
- Minitest (Rails default) — test runner
- `webmock` — HTTP request stubbing
- `sqlite3` — in-memory test database (separate adapter from dev/prod PostgreSQL)
- `faker` 3.5.2 — test data generation

**Testing (Frontend):**
- `@testing-library/react` 13.4.0 + `@testing-library/user-event` 13.5.0
- `@testing-library/jest-dom` 5.16.5
- `@types/jest` 29.2.5
- No vitest.config or jest.config detected at root — test setup likely minimal/incomplete

**Linting/Formatting:**
- Backend: StandardRB 1.52.0 — `bundle exec standardrb` (RuboCop wrapper with opinionated defaults)
- Frontend: ESLint 8.27.0 with `eslint-config-standard`, `eslint-plugin-react`, `eslint-plugin-import`
- TypeScript: `"strict": true` in `frontend/tsconfig.json`

## Key Dependencies

**Backend Critical:**
- `paranoia` 3.0.0 — soft deletes via `acts_as_paranoid`; all user-facing models must use `.without_deleted`
- `active_model_serializers` 0.10.14 — JSON serialization with `:json` adapter (root key wrapping); config at `backend/config/initializers/active_model_serializers.rb`
- `pagy` 6.5.0 — pagination (10/page default, capped at 100); config at `backend/config/initializers/pagy.rb`
- `jwt` 2.9.3 — JWT issuance and verification (`backend/app/services/token_service.rb`, HS256, 24h expiry)
- `solid_queue` 0.9.0 — DB-backed background job processing; no Redis required; config at `backend/config/queue.yml`
- `httparty` 0.23.2 — HTTP client for RETS MLS board API requests
- `rack-cors` — CORS middleware; currently allows `origins "*"` (`backend/config/initializers/cors.rb`)
- `dotenv-rails` — loads `.env` in development/test environments

**Backend Infrastructure:**
- `pg` 1.5.9 — PostgreSQL adapter
- `aws-sdk-s3` 1.209.0 — S3 file uploads (`backend/app/services/s3_upload_service.rb`)
- `aws-sdk-cognitoidentityprovider` 1.132.0 — Cognito user pool management (`backend/app/services/cognito_service.rb`)
- `aws-sdk-sts` 1.12.0 — AWS STS for credential chaining
- `aws-sdk-core` 3.239.2 — shared AWS SDK core
- `resend` 1.1.0 — transactional email via Resend API
- `mission_control-jobs` 1.1.0 — job admin dashboard UI at `/jobs`
- `sprockets-rails` 3.5.2 — asset pipeline (required for mission control UI)
- `standard` 1.52.0 — Ruby linting (dev only)

**Frontend Critical:**
- `aws-amplify` 6.15.9 + `@aws-amplify/auth` 6.17.1 — Cognito OAuth2 PKCE flow; configured in `frontend/src/config/amplify.ts`
- `axios` 1.2.3 — HTTP client; global instance at `frontend/src/assets/axios/axios.ts`
- `camelcase-keys` 10.0.1 — applied globally in Axios response interceptor (NEVER call again in hooks)
- `snakecase-keys` 9.0.2 — used when serializing request bodies to backend
- `react-hook-form` 7.53.0 — form state management
- `react-hot-toast` 2.6.0 — toast notifications
- `motion` 12.23.24 — animation library
- `dayjs` 1.11.7 — date formatting and manipulation
- `react-big-calendar` 1.19.4 — calendar views for estate events
- `react-day-picker` 8.10.1 — date picker component
- `embla-carousel-react` 8.6.0 — carousel/photo gallery
- `oidc-client-ts` 3.4.1 + `react-oidc-context` 3.3.0 — OIDC library (present but likely secondary to Amplify)

## Configuration

**Backend Secrets:**
- Rails encrypted credentials: `backend/config/credentials.yml.enc`
- Decryption key: `backend/config/master.key` (gitignored) or `RAILS_MASTER_KEY` env var
- Credential namespaces:
  - `aws`: `region`, `access_key_id`, `secret_access_key`, `s3_bucket`, `cloudfront_domain`, `cognito.user_pool_id`, `cognito.client_id`, `cognito.client_secret`
  - `resend`: `api_key`
  - `active_record_encryption`: `primary_key`, `deterministic_key`, `key_derivation_salt`
  - `mission_control`: `username`, `password`

**Backend Environment Variables:**
- `DATABASE_URL` — PostgreSQL connection string (dev + prod)
- `RAILS_MASTER_KEY` — credentials decryption key
- `RAILS_MAX_THREADS` — Puma thread count (default 5)
- `RAILS_LOG_LEVEL` — log verbosity (default `"info"`)
- `JOB_CONCURRENCY` — SolidQueue worker processes (default 1)
- `ALLOWED_HOSTS` — comma-separated extra allowed hostnames
- `OPS_ENABLED` — set to `"true"` to route `/ops` and the `/jobs` job admin UI (operator machine only — RB-67)
- `MISSION_CONTROL_USERNAME` / `MISSION_CONTROL_PASSWORD` — job admin credentials override

**Frontend Environment Variables (VITE_*):**
- `VITE_BE_ENDPOINT` — backend API base URL (defaults to `window.location.origin`)
- `VITE_COGNITO_USER_POOL_ID` — Cognito user pool ID
- `VITE_COGNITO_CLIENT_ID` — Cognito app client ID
- `VITE_COGNITO_DOMAIN` — Cognito hosted UI domain
- `VITE_REDIRECT_SIGN_IN` — OAuth callback URL
- `VITE_REDIRECT_SIGN_OUT` — OAuth sign-out URL
- `VITE_CDN_URL` — CloudFront CDN base URL for media assets
- `VITE_SECRET_KEY` — client-side encryption key (insecure fallback `'123'` in `frontend/src/helpers/Encryption.ts`)

**Build Config Files:**
- `frontend/vite.config.ts` — Vite config with `@` alias
- `frontend/tsconfig.json` — TypeScript strict mode, ESNext target, `paths: { "@/*": ["./src/*"] }`
- `frontend/tailwind.config.js` — Tailwind content paths
- `frontend/postcss.config.js` — PostCSS (autoprefixer)
- `frontend/components.json` — shadcn/ui configuration
- `backend/config/queue.yml` — SolidQueue worker definitions
- `backend/config/database.yml` — database adapters per environment

## Platform Requirements

**Development:**
- Ruby 4.0.2
- Node.js 22
- PostgreSQL (dev database via `DATABASE_URL`)
- Rails credentials master key
- `.env` files for both `backend/` and `frontend/`

**Production:**
- Frontend: Vercel (SPA catch-all rewrite in `frontend/vercel.json`)
- Backend: Puma behind SSL-terminating reverse proxy (`config.force_ssl = true`)
- PostgreSQL via `DATABASE_URL`
- AWS account: Cognito user pool, S3 bucket, CloudFront distribution
- Resend account for transactional email
- No Redis — SolidQueue uses PostgreSQL for job queue storage

**Frontend Build Commands:**
```bash
npm run dev       # Vite dev server on port 3000
npm run build     # Production build to frontend/dist/
npm run preview   # Preview production build
```

**Backend Commands:**
```bash
rails server              # Dev server on port 8080 (run from backend/)
bundle exec standardrb    # Lint Ruby
rails db:migrate          # Apply migrations
rails db:seed             # Seed data
```

---

*Stack analysis: 2026-04-29*
