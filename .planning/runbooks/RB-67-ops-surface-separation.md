# Runbook: Separating admin functions from the public API (RB-67)

**Status:** Code done 2026-10-11. The Render env cleanup in §4 is still to do after deploy.
**Owner:** Tom
**Requirement:** REB-3 §3.10.2(i): "Administrative-level functions must always be located on a separate IP address, or at least on a separate port, from public functions. Ideally, VPN access would be required."
**Related:** RB-73 (Vercel WAF), RB-68 (rack-attack rate limiting)

---

## 1. What counts as "administrative-level functions"

RealtyBase has two surfaces called "admin". Only one of them is system administration:

| Surface | Who uses it | What it can do | In scope for §3.10.2(i)? |
|---|---|---|---|
| `/ops/**` (server-rendered ops panel) and `/jobs` (Mission Control) | The platform operator only | Register boards, approve or revoke board connections, decide member verifications, grant manual board access, change any brokerage's plan or domains, inspect and retry background jobs | **Yes.** This is the vendor's control plane. |
| `/v1/admin/**` (JSON API behind the SPA's brokerage settings screens) | Brokerage owners and admins (customers) | Manage their own brokerage's users, groups, domains and plan, scoped to their tenant by `BrokerageAuth` and role checks | **No.** This is tenant end-user functionality, the same kind as `/v1/dashboard/**`, and it has to be reachable from anywhere the customer works. |

## 2. How the requirement is met

The admin functions **don't exist on the public deployment.**

- `config/routes.rb` only draws `/ops/**` and mounts `/jobs` when `OPS_ENABLED=true` (`lib/ops_surface.rb`).
- `OPS_ENABLED` is set only in the operator's local `backend/.env`. The ops panel runs on the operator's own machine (`rails server`, `http://localhost:8080/ops`) against the production database. It is never exposed on a public IP or port.
- The public API on Render (`realstate-be.onrender.com`, proxied as `app.realtybase.ca/v1/*`) has no route to any ops or jobs controller. Requests for those paths return 404.
- **Boot guard:** a production process refuses to start if `OPS_ENABLED=true` (`config/initializers/00_ops_surface.rb`), so a stray env var can't re-expose the panel. The only escape hatch is `OPS_ALLOW_IN_PRODUCTION=true`, kept for a possible future separate, non-public ops deployment if more operators join.
- **Defense in depth:** the ops panel still requires HTTP basic auth (`OPS_USERNAME`/`OPS_PASSWORD`) locally, and Mission Control has its own basic auth.

So the admin functions run on a separate host (the operator's machine) and a separate port, and are reachable only from that machine. That is stronger than the "separate port" minimum.

## 3. Running the ops panel

1. Make sure `backend/.env` has `OPS_ENABLED=true`, `OPS_USERNAME`, `OPS_PASSWORD`, and (for the board **Test connection** button) `BRIDGE_SERVER_TOKEN`.
2. From `backend/`, run `rails server`, then open `http://localhost:8080/ops`. Mission Control is at `http://localhost:8080/jobs`.

Notes:
- Ops actions enqueue jobs (invitation emails, plan transitions, domain verification, board verification emails) into the shared `solid_queue` tables. Whichever worker processes them runs them with its own environment. Production has no worker yet (RB-72).
- Running locally means the operator's machine holds production DB credentials. That's acceptable while there is a single operator. Revisit if more operators are added (the likely move is a separate, IP-allowlisted ops service using `OPS_ALLOW_IN_PRODUCTION`).

## 4. Deploy checklist

- [ ] Deploy the backend change to Render.
- [ ] Confirm `https://realstate-be.onrender.com/ops` and `/jobs` return 404.
- [ ] Remove `OPS_USERNAME`, `OPS_PASSWORD`, `MISSION_CONTROL_USERNAME`, `MISSION_CONTROL_PASSWORD` and `MISSION_CONTROL_JOBS_ENABLED` from the Render service's environment. They are now dead config. Production no longer reads them (the ops controller reads credentials per request, and Mission Control's credential check only runs when `OPS_ENABLED` is set).
- [ ] Confirm the service restarts cleanly after removing them.

## 5. Evidence for the board compliance review (REB-3 §3.11)

- `backend/lib/ops_surface.rb`, `backend/config/routes.rb` (the `OpsSurface.enabled?` block) and `backend/config/initializers/00_ops_surface.rb`
- Tests: `backend/test/lib/ops_surface_test.rb` (boot guard) and `backend/test/integration/ops_surface_test.rb` (no ops or jobs routes without the flag; tenant `/v1/admin` unaffected)
- A live 404 from `/ops` on the production host
