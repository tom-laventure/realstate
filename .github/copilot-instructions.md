# Copilot Instructions (Realstate)

## Service-specific instructions
- Backend instructions: [backend/.github/copilot-instructions.md](backend/.github/copilot-instructions.md)
- Frontend instructions: [frontend/.github/instructions/copilot.instructions.md](frontend/.github/instructions/copilot.instructions.md)

## Repo overview
- Monorepo: Rails 7.1 JSON API in backend, Vite + React app in frontend.
- Frontend uses React Router, Redux Toolkit, React Query, Tailwind, and Amplify for Cognito auth.

## Backend architecture & patterns
- Multi-tenant resolution: `BrokerageAuth` sets `Current.brokerage` based on request host + `BrokerageDomain`, and `CognitoAuth` sets `Current.user`. See [backend/app/controllers/concerns/brokerage_auth.rb](backend/app/controllers/concerns/brokerage_auth.rb) and [backend/app/controllers/concerns/cognito_auth.rb](backend/app/controllers/concerns/cognito_auth.rb).
- Soft deletes via `acts_as_paranoid`; scope queries with `.without_deleted` (example in [backend/app/queries/group_query.rb](backend/app/queries/group_query.rb)).
- Serialization uses ActiveModel Serializers under [backend/app/serializers](backend/app/serializers).
- Complex filtering lives in query objects under [backend/app/queries](backend/app/queries).
- Seeds are deterministic and modular under [backend/db/seeds](backend/db/seeds), orchestrated by [backend/db/seeds.rb](backend/db/seeds.rb).

## Frontend data flow & patterns
- API client adds Amplify Cognito `idToken` to `Authorization` and redirects on 401: [frontend/src/assets/axios/axios.ts](frontend/src/assets/axios/axios.ts).
- API modules live under [frontend/src/assets/api](frontend/src/assets/api); some transform responses with `camelcase-keys` (see [frontend/src/assets/api/users/getCurrentUser.tsx](frontend/src/assets/api/users/getCurrentUser.tsx)).
- React Query hooks wrap API calls in [frontend/src/store/hooks](frontend/src/store/hooks); Redux slices in [frontend/src/store/reducers](frontend/src/store/reducers).
- Router entry is [frontend/src/router/main.tsx](frontend/src/router/main.tsx).
- Amplify Cognito config is in [frontend/src/config/amplify.ts](frontend/src/config/amplify.ts).

## Critical workflows
- Frontend dev/build (run in frontend/): `npm run dev`, `npm run build` (Vite, port 3000). See [frontend/package.json](frontend/package.json).
- Backend dev: `rails server`; DB setup `rails db:migrate`, `rails db:seed`; Docker options in [backend/Dockerfile](backend/Dockerfile).

## Conventions to follow
- Use `@` alias for frontend imports (configured in [frontend/vite.config.ts](frontend/vite.config.ts)).
- Auth tokens are stored in localStorage via auth hooks (see [frontend/src/store/hooks/Auth](frontend/src/store/hooks/Auth)).
- Prefer query objects for backend filtering and include associations to avoid N+1.
