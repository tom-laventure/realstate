---
phase: 20
status: issues_found
files_reviewed: 13
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
---

# Code Review: Phase 20 — Backend Domain API

## Critical

### CR-01: `before_create` unconditionally overwrites `verification_token: nil` on pre-verified domain creation

**File:** `backend/app/models/brokerage_domain.rb` (line 43–45)  
**Also affects:** `backend/app/controllers/v1/admin/domains_controller.rb` (subdomain + custom actions)  
**Confidence:** 95%

`generate_verification_token` is a `before_create` callback that unconditionally runs `self.verification_token = SecureRandom.hex(16)`. Rails fires `before_create` after attributes are assigned from `create!` but before the INSERT, so it overwrites any explicit `verification_token: nil` passed by the caller.

Every admin `subdomain` and `custom` action creates domains with `verified: true, verification_token: nil` — but the token is silently replaced with a random hex value before persisting. Result: every admin-created domain is stored with `verified: true, verified_at: <timestamp>, verification_token: <non-nil>` — inconsistent state.

The serializer correctly excludes `verification_token` from API responses (D-02) so this does not currently leak to clients. However if DNS verification is ever reintroduced (deferred per A1), stale tokens on already-active domains become live credentials.

**Fix:**
```ruby
def generate_verification_token
  self.verification_token ||= SecureRandom.hex(16)
end
```

`||=` respects an explicitly-passed `nil` from `create!` while still generating a token for normal unverified domain creation flows.

---

## Warning

### WR-01: `InvitationMailer#primary_domain` fallback lacks status guard

**File:** `backend/app/mailers/invitation_mailer.rb` (lines 23–27)  
**Confidence:** 85%

The fallback `brokerage.brokerage_domains.first` applies no status scope. `BrokerageDomain` does not use `acts_as_paranoid`, so no default scope excludes records with `deleted_at` set. If the first record by primary key is a `decommissioned` domain, the mailer embeds that dead domain in the invitation URL.

**Fix:**
```ruby
brokerage.brokerage_domains
  .where(is_primary: true)
  .where.not(domain: "localhost")
  .first&.domain || brokerage.brokerage_domains.routable.first&.domain
```

---

### WR-02: `slot_block_response` and `phase_out_warning_for` call `.first.phase_out_at` without nil guard

**File:** `backend/app/controllers/v1/admin/domains_controller.rb` (private helpers)  
**Confidence:** 80%

Both helpers count phasing-out records then call `.first.phase_out_at` in a separate query. A concurrent `decommission!` between the two queries causes `.first` to return `nil`, raising `NoMethodError` (500).

**Fix:** Use `pick` to fetch the scalar directly:
```ruby
earliest = Current.brokerage.brokerage_domains
  .status_phasing_out
  .where(domain_type: domain_type)
  .order(:phase_out_at)
  .pick(:phase_out_at)
```

`pick` returns `nil` when no record exists rather than raising.

---

## Info

### I-01: `generate_verification_token` is accidentally public

**File:** `backend/app/models/brokerage_domain.rb` (line 43–45)  
**Confidence:** 80%

`generate_verification_token` is defined before the `private` marker (line 47), placing it in the public interface. It is only used as a `before_create` hook. External callers can invoke it to regenerate and invalidate a live verification token on an unverified domain.

**Fix:** Move the method definition to after the `private` marker alongside the other private validation helpers.
