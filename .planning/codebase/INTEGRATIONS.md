# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**MLS / Real Estate Data (RETS Protocol):**
- RETS-compliant MLS boards — fetches listing photos via RETS `GetObject` endpoint
  - Protocol: RETS 1.7.2 over HTTP Basic Auth
  - Client: `HTTParty` gem
  - Services: `backend/app/services/rets_auth_service.rb` (credential validation), `backend/app/services/rets_photo_service.rb` (photo fetching)
  - Board endpoint URLs stored on `RealEstateBoard#rets_endpoint` (`backend/app/models/real_estate_board.rb`)
  - Credentials: `rets_username` and `rets_password` on `BrokerageBoardCredential`, encrypted at rest via ActiveRecord Encryption (`backend/app/models/brokerage_board_credential.rb`)
  - Credential test: `RetsAuthService#call` returns a `Result` struct with `success?` boolean
  - Photo sync background job: `SyncListingPhotosJob` (`backend/app/jobs/sync_listing_photos_job.rb`), queued on `:photos` queue
  - Atomic claim pattern used in `SyncListingPhotosJob` to prevent concurrent duplicate syncs
  - Stale resync job: `ResyncStalePhotosJob` (`backend/app/jobs/resync_stale_photos_job.rb`), scheduled via SolidQueue

## Data Storage

**Databases:**
- PostgreSQL — primary database (development + production)
  - Connection: `DATABASE_URL` environment variable
  - Config: `backend/config/database.yml`
  - ORM: ActiveRecord (Rails 7.1)
  - Soft-delete pattern: `paranoia` gem — all user-facing models use `acts_as_paranoid`; all queries MUST scope with `.without_deleted`
- SQLite3 — test environment only (`backend/storage/test.sqlite3`)

**File Storage:**
- AWS S3 — primary file/image storage
  - Client: `aws-sdk-s3` 1.209.0
  - Service: `backend/app/services/s3_upload_service.rb`
  - Bucket: `Rails.application.credentials.dig(:aws, :s3_bucket)`
  - Supported upload types: base64 data URIs (`upload_base64`), file objects (`upload_file`), raw binary/RETS photos (`upload_binary`), delete (`delete`)
  - Key generation helper: `generate_unique_key` adds `SecureRandom.hex(8)` suffix
  - All methods return CloudFront CDN URLs (not direct S3 URLs)

**CDN:**
- AWS CloudFront — fronts the S3 bucket for media delivery
  - Domain: `Rails.application.credentials.dig(:aws, :cloudfront_domain)`
  - All `S3UploadService` uploads return `https://<cloudfront_domain>/<key>`
  - Frontend: accessed via `VITE_CDN_URL` env var

**Caching:**
- No Redis or Memcache — SolidQueue uses PostgreSQL for job persistence
- Development: in-memory store when `tmp/caching-dev.txt` exists (`config.cache_store = :memory_store`)
- Test/default dev: null store

**Background Jobs:**
- SolidQueue 0.9.0 — DB-backed ActiveJob adapter (no Redis required)
  - Config: `backend/config/queue.yml`
  - Queues: `default` (3 threads, `JOB_CONCURRENCY` processes), `photos` + `background` (1 thread, 1 process)
  - Polling: default queue 0.1s, photos/background 0.5s
  - Admin UI: MissionControl::Jobs 1.1.0 at `/jobs` (HTTP basic auth; only routed when `OPS_ENABLED=true` — operator machine only, RB-67)
  - Jobs: `FanoutNotificationsJob`, `SyncListingPhotosJob`, `ResyncStalePhotosJob`, `SendInvitationEmailJob` (`backend/app/jobs/`)

## Authentication & Identity

**Auth Provider — AWS Cognito:**
- Backend:
  - SDK: `aws-sdk-cognitoidentityprovider` 1.132.0
  - Service: `backend/app/services/cognito_service.rb`
  - Operations: `initiate_auth` (USER_PASSWORD_AUTH flow with optional HMAC `SECRET_HASH`), `forgot_password`, `admin_user_global_sign_out`, `admin_get_user`, `admin_delete_user`
  - Initializer: `backend/config/initializers/cognito.rb` — builds `COGNITO_CONFIG` constant from Rails credentials
  - JWT: `backend/app/services/token_service.rb` — issues HS256 JWTs signed with `secret_key_base` (24h expiry); Cognito `sub` stored as `User#uid`
  - Per-request auth: `CognitoAuth` concern (`backend/app/controllers/concerns/cognito_auth.rb`) — extracts Bearer token, verifies JWT, sets `Current.user`, enforces brokerage membership
  - Credentials: `aws.region`, `aws.cognito.user_pool_id`, `aws.cognito.client_id`, `aws.cognito.client_secret`
- Frontend:
  - SDK: `aws-amplify` 6.15.9 + `@aws-amplify/auth` 6.17.1
  - Config: `frontend/src/config/amplify.ts` — OAuth2 PKCE authorization code flow
  - Scopes: `email`, `openid`, `aws.cognito.signin.user.admin`
  - Token storage: `localStorage` via `frontend/src/lib/auth.ts` (`getToken`, `setToken`, `clearToken`)
  - Token attached via Axios request interceptor: `frontend/src/assets/axios/axios.ts`
  - 401 response: Axios interceptor clears token and redirects to `/auth/login`
  - 403 with `next_step: "no-access"`: redirects to `/auth/brokerage-contact`
  - Env vars: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_REDIRECT_SIGN_IN`, `VITE_REDIRECT_SIGN_OUT`

**Multi-Tenancy Domain Resolution:**
- `BrokerageAuth` concern (`backend/app/controllers/concerns/brokerage_auth.rb`) — resolves `Current.brokerage` from `Origin` or `Host` header via `BrokerageDomain` table lookup on every request
- Each request is scoped to a single brokerage; cross-brokerage data access is blocked at controller/query level

**OmniAuth (Present but Inactive):**
- Gems in Gemfile: `omniauth-facebook`, `omniauth-google-oauth2`, `omniauth-rails_csrf_protection`
- No active routes or controller callbacks wired up — gems exist but are not integrated

## Transactional Email

**Resend:**
- Purpose: transactional email delivery (brokerage and group invitation emails)
- Gem: `resend` 1.1.0 (wraps HTTParty)
- Configured as ActionMailer delivery method in both dev and prod: `config.action_mailer.delivery_method = :resend`
- API key: `Rails.application.credentials.dig(:resend, :api_key)` (set in `backend/config/initializers/resend.rb`)
- Mailers:
  - `backend/app/mailers/invitation_mailer.rb` — `invite_brokerage` and `invite_group` methods
  - `backend/app/mailers/test_mailer.rb` — smoke test mailer
  - `backend/app/mailers/application_mailer.rb` — base mailer, from: `noreply@notifications.realtybase.ca`
- Email dispatch job: `SendInvitationEmailJob` (`backend/app/jobs/send_invitation_email_job.rb`) with 3 retry attempts

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Bugsnag, Rollbar, or similar gem or configuration present

**Logs:**
- Production: `ActiveSupport::TaggedLogging` to STDOUT, tagged with `:request_id` (`backend/config/environments/production.rb`)
- Log level: `RAILS_LOG_LEVEL` env var (default `"info"`)
- Sensitive params filtered: `backend/config/initializers/filter_parameter_logging.rb`

**Job Admin:**
- MissionControl::Jobs UI at `/jobs` (HTTP basic auth)
- Only routed when `OPS_ENABLED=true` (operator machine only, never on Render — RB-67)
- Production credentials enforced (cannot use default `admin/changeme` in production)

## CI/CD & Deployment

**Frontend Hosting:**
- Vercel — SPA deployment
- `frontend/vercel.json`: all routes rewrite to `/index.html` for client-side routing

**Backend Hosting:**
- Not explicitly declared; Puma-based, behind SSL-terminating reverse proxy
- `config.force_ssl = true` in production
- Allowed hosts: `ALLOWED_HOSTS` env var + hardcoded `*.realstate.local` for local multi-tenant dev

**CI Pipeline:**
- Not detected — no `.github/workflows/`, `.circleci/`, or CI configuration found

## Environment Configuration

**Backend required credentials (`config/credentials.yml.enc`):**
- `aws.region`
- `aws.access_key_id`
- `aws.secret_access_key`
- `aws.s3_bucket`
- `aws.cloudfront_domain`
- `aws.cognito.user_pool_id`
- `aws.cognito.client_id`
- `aws.cognito.client_secret`
- `resend.api_key`
- `active_record_encryption.primary_key`
- `active_record_encryption.deterministic_key`
- `active_record_encryption.key_derivation_salt`
- `mission_control.username` / `mission_control.password` (or env var overrides)

**Backend required environment variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `RAILS_MASTER_KEY` — decrypts credentials (or `config/master.key` file)
- `RAILS_MAX_THREADS` — Puma thread count (default 5)
- `RAILS_LOG_LEVEL` — log verbosity (default `"info"`)
- `JOB_CONCURRENCY` — SolidQueue worker processes (default 1)
- `ALLOWED_HOSTS` — comma-separated extra allowed hostnames
- `OPS_ENABLED` — `"true"` to route `/ops` and `/jobs` (operator machine only; production refuses to boot with it unless `OPS_ALLOW_IN_PRODUCTION=true` — RB-67)

**Frontend required environment variables:**
- `VITE_BE_ENDPOINT` — backend API base URL
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_DOMAIN`
- `VITE_REDIRECT_SIGN_IN`
- `VITE_REDIRECT_SIGN_OUT`
- `VITE_CDN_URL` — CloudFront domain for media assets
- `VITE_SECRET_KEY` — client-side encryption secret (fallback `'123'` is insecure for production)

**Secrets location:**
- Backend: `backend/config/credentials.yml.enc` (encrypted, committed) + `backend/config/master.key` (gitignored)
- Frontend: `frontend/.env` (gitignored); values injected by Vite at build time

## Webhooks & Callbacks

**Incoming:**
- None detected — no webhook receiver endpoints in `backend/config/routes.rb`

**Outgoing:**
- RETS board endpoints — HTTP GET for listing credential validation and photo fetching (`RetsAuthService`, `RetsPhotoService`)
- Resend API — HTTP POST for transactional email delivery (via `resend` gem)
- AWS Cognito — SDK calls for auth operations (`aws-sdk-cognitoidentityprovider`)
- AWS S3 — SDK calls for object upload and deletion (`aws-sdk-s3`)
- AWS STS — SDK calls for credential operations (`aws-sdk-sts`)

---

*Integration audit: 2026-04-29*
