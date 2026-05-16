# Phase 8: Geocoding & Data Layer - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/db/migrate/20260516XXXXXX_add_geocoding_to_listing_details.rb` | migration | transform | `backend/db/migrate/20240916040506_create_estate_ratings.rb` | exact (decimal precision/scale) |
| `backend/app/services/geocoding_service.rb` | service | request-response | `backend/app/services/rets_auth_service.rb` | exact (Result struct + HTTParty) |
| `backend/app/jobs/geocode_listings_job.rb` | job | batch | `backend/app/jobs/sync_listing_photos_job.rb` | exact (same retry/discard/guard pattern) |
| `backend/app/serializers/listing_detail_serializer.rb` | serializer | transform | itself (modify in-place) | exact |
| `backend/lib/tasks/geocode.rake` | utility | batch | `backend/lib/tasks/cognito.rake` | role-match |

## Pattern Assignments

### `backend/db/migrate/20260516XXXXXX_add_geocoding_to_listing_details.rb` (migration, transform)

**Analog:** `backend/db/migrate/20240916040506_create_estate_ratings.rb` (decimal precision/scale) + `backend/db/migrate/20240911034802_add_params_to_users.rb` (add_column pattern)

**Migration class pattern** (lines 1-5 of create_estate_ratings.rb):
```ruby
class CreateEstateRatings < ActiveRecord::Migration[7.1]
  def change
    # decimal with precision/scale — exact type for coordinates
    t.decimal :rating, precision: 3, scale: 1
  end
end
```

**add_column pattern** (from add_params_to_users.rb):
```ruby
class AddParamsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :name, :string
  end
end
```

**Target pattern** — combine both into:
```ruby
class AddGeocodingToListingDetails < ActiveRecord::Migration[7.1]
  def change
    add_column :listing_details, :latitude,         :decimal, precision: 10, scale: 6
    add_column :listing_details, :longitude,        :decimal, precision: 10, scale: 6
    add_column :listing_details, :geocoding_failed, :boolean, default: false, null: false
  end
end
```

---

### `backend/app/services/geocoding_service.rb` (service, request-response)

**Analog:** `backend/app/services/rets_auth_service.rb`

**Result struct pattern** (lines 1-4):
```ruby
class RetsAuthService
  Result = Struct.new(:success, :error, keyword_init: true) do
    def success? = success
  end
```

**HTTParty call pattern** (lines 13-21):
```ruby
  def call
    response = HTTParty.get(
      @board.rets_endpoint,
      headers: {
        "User-Agent" => "RealStatePlatform/1.0",
        "RETS-Version" => "RETS/1.7.2"
      },
      basic_auth: {username: @username, password: @password},
      timeout: 10
    )
```

**Result return pattern** (lines 23-27):
```ruby
    if response.success?
      Result.new(success: true, error: nil)
    else
      Result.new(success: false, error: "RETS authentication failed (HTTP #{response.code})")
    end
```

**Error rescue pattern** (lines 28-30):
```ruby
  rescue HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Result.new(success: false, error: "Could not connect to board endpoint: #{e.message}")
  end
```

**Target GeocodingService — extends Result struct to carry lat/lng:**
```ruby
class GeocodingService
  Result = Struct.new(:success, :latitude, :longitude, :error, keyword_init: true) do
    def success? = success
  end

  def initialize(address)
    @address = address
  end

  def call
    return Result.new(success: false, error: "No address") if @address.blank?

    response = HTTParty.get(
      "https://nominatim.openstreetmap.org/search",
      query: { format: "json", limit: 1, q: @address },
      headers: { "User-Agent" => ENV.fetch("NOMINATIM_USER_AGENT") },
      timeout: 10
    )

    return Result.new(success: false, error: "HTTP #{response.code}") unless response.success?

    results = response.parsed_response
    return Result.new(success: false, error: "No results") if results.empty?

    first = results.first
    Result.new(
      success: true,
      latitude: first["lat"].to_d,   # Nominatim returns "lat"/"lon" as strings
      longitude: first["lon"].to_d,
      error: nil
    )
  rescue HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Result.new(success: false, error: e.message)
  end
end
```

**Key difference from RetsAuthService:** Nominatim returns `"lat"` and `"lon"` (not `"latitude"`/`"longitude"`). Call `.to_d` (not `.to_f`) to match `decimal` column type and avoid float precision loss.

---

### `backend/app/jobs/geocode_listings_job.rb` (job, batch)

**Analog:** `backend/app/jobs/sync_listing_photos_job.rb`

**Job header pattern** (lines 1-4):
```ruby
class SyncListingPhotosJob < ApplicationJob
  queue_as :photos
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound
```

**Estate + listing_detail load pattern** (lines 6-10):
```ruby
  def perform(estate_id, brokerage_id)
    estate = Estate.without_deleted.accessible_by(brokerage_id).includes(:listing_detail, :real_estate_board).find(estate_id)
    listing_detail = estate.listing_detail

    return if listing_detail.nil?
    return if listing_detail.photos_synced_at.present?
```

**Target GeocodeListingsJob — adapts header + guards + adds after_discard:**
```ruby
class GeocodeListingsJob < ApplicationJob
  queue_as :default                                              # D-11: same queue as CalendarSyncJob
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  after_discard do |job, exception|
    estate_id = job.arguments.first
    estate = Estate.without_deleted.includes(:listing_detail).find_by(id: estate_id)
    estate&.listing_detail&.update_columns(geocoding_failed: true)
  end

  def perform(estate_id)
    estate = Estate.without_deleted.includes(:listing_detail).find(estate_id)
    listing_detail = estate.listing_detail

    return if listing_detail.nil?
    return if listing_detail.latitude.present?      # already geocoded
    return if listing_detail.geocoding_failed?      # previously marked hopeless
    return if listing_detail.address.blank?         # nothing to geocode

    result = GeocodingService.new(listing_detail.address).call

    if result.success?
      listing_detail.update!(
        latitude: result.latitude,
        longitude: result.longitude
      )
    end

    sleep(1)   # Nominatim rate limit: 1 req/sec — D-08
  end
end
```

**Critical differences from SyncListingPhotosJob:**
- `queue_as :default` not `:photos` (D-11)
- Takes only `estate_id`, not `(estate_id, brokerage_id)` — no brokerage context needed
- No claim guard (no concurrent job risk — each listing has one job)
- `after_discard` block sets `geocoding_failed: true` — do NOT rescue StandardError inside perform (blocks retry_on)
- `sleep(1)` always runs, even on success, to respect rate limit

---

### `backend/app/serializers/listing_detail_serializer.rb` (serializer, transform)

**Analog:** itself — modify in-place

**Current attributes block** (lines 1-38, full file):
```ruby
class ListingDetailSerializer < ActiveModel::Serializer
  attributes :id,
    :estate_id,
    :list_price,
    # ... existing attributes ...
    :photo_count,
    :photos_synced_at
end
```

**Target — append three attributes after `:photos_synced_at`:**
```ruby
    :photos_synced_at,
    :latitude,
    :longitude,
    :geocoding_failed
```

No other changes. This single diff causes both `EstatesController#index` and `EstatesController#show` to return coordinates (EstateSerializer already includes `listing_detail` association).

---

### `backend/lib/tasks/geocode.rake` (utility, batch)

**Analog:** `backend/lib/tasks/cognito.rake` (namespace/task structure) + `backend/app/jobs/resync_stale_photos_job.rb` (join + where scope + find_each pattern)

**Rake namespace/task structure** (cognito.rake lines 1-4):
```ruby
namespace :cognito do
  desc 'Test Cognito connection'
  task test_connection: :environment do
```

**Join + where scope pattern** (resync_stale_photos_job.rb lines 13-19):
```ruby
    stale_scope = ListingDetail
      .joins(:estate)
      .where("listing_details.photos_synced_at < ?", 7.days.ago)
      .where.not(listing_details: {mls_number: [nil, ""]})
      .where(estates: {deleted_at: nil})
      .select(:id, :estate_id)
```

**Batch enqueue pattern** (resync_stale_photos_job.rb lines 50-52):
```ruby
      brokerage_by_estate.each do |estate_id, brokerage_id|
        SyncListingPhotosJob.perform_later(estate_id, brokerage_id)
      end
```

**Target geocode.rake — combines namespace + join scope + find_each enqueue:**
```ruby
namespace :geocode do
  desc "Enqueue GeocodeListingsJob for all listings with an address but no coordinates"
  task backfill: :environment do
    scope = ListingDetail
      .joins(:estate)
      .where(latitude: nil)
      .where.not(address: [nil, ""])
      .where(geocoding_failed: false)
      .where(estates: { deleted_at: nil })
      .select(:id, :estate_id)

    count = 0
    scope.find_each do |ld|
      GeocodeListingsJob.perform_later(ld.estate_id)
      count += 1
    end

    puts "Enqueued #{count} GeocodeListingsJob(s)"
  end
end
```

**Key notes:**
- `find_each` (not `in_batches`) — streams 1000 at a time, memory-safe for large tables
- All three idempotency filters required (D-10): `latitude IS NULL`, `address NOT NULL/empty`, `geocoding_failed = false`
- `where(estates: { deleted_at: nil })` guards soft-deleted estates (listing_details has no paranoid)

---

## Shared Patterns

### ENV.fetch for External Service Config
**Source:** `backend/app/jobs/calendar_sync_job.rb` lines 104-108
**Apply to:** `GeocodingService`
```ruby
ENV.fetch("GOOGLE_CALENDAR_CLIENT_ID")   # raises KeyError if missing — fail loud
ENV.fetch("GOOGLE_CALENDAR_CLIENT_SECRET")
```
Copy pattern as: `ENV.fetch("NOMINATIM_USER_AGENT")` — raises `KeyError` at runtime if not configured. Do not use `ENV["NOMINATIM_USER_AGENT"]` (silently nil).

### Estate Soft-Delete Guard
**Source:** `backend/app/jobs/sync_listing_photos_job.rb` line 7 + `backend/app/jobs/resync_stale_photos_job.rb` line 17
**Apply to:** `GeocodeListingsJob`, `geocode.rake`
```ruby
# In job:
estate = Estate.without_deleted.includes(:listing_detail).find(estate_id)

# In rake scope:
.where(estates: { deleted_at: nil })
```
`listing_details` has NO `acts_as_paranoid` — only `Estate` needs the guard. Never add `.without_deleted` to a `ListingDetail` query.

### retry_on + discard_on Job Declaration
**Source:** `backend/app/jobs/calendar_sync_job.rb` lines 2-4 and `backend/app/jobs/sync_listing_photos_job.rb` lines 2-4
**Apply to:** `GeocodeListingsJob`
```ruby
queue_as :default
retry_on StandardError, wait: :polynomially_longer, attempts: 3
discard_on ActiveRecord::RecordNotFound
```
Do NOT rescue `StandardError` inside `perform` — it prevents `retry_on` from retrying. Use `after_discard` for post-failure side effects (setting `geocoding_failed: true`).

### Guard Returns in perform
**Source:** `backend/app/jobs/sync_listing_photos_job.rb` lines 9-12
**Apply to:** `GeocodeListingsJob`
```ruby
return if listing_detail.nil?
return if listing_detail.photos_synced_at.present?
return if estate.real_estate_board_id.nil?
return if listing_detail.mls_number.blank?
```
Each guard is a separate `return if` — readable, no nesting. Apply same pattern with geocoding-specific guards.

### update_columns for Non-Validating Updates
**Source:** `backend/app/jobs/calendar_sync_job.rb` line 57
**Apply to:** `after_discard` block in `GeocodeListingsJob`
```ruby
conn.update_columns(last_error: nil)
```
Use `update_columns` (not `update!`) when setting failure flags — skips validations and callbacks, ensuring the flag is always set even if validations would fail.

---

## No Analog Found

All five files have clear analogs. No files require falling back to RESEARCH.md patterns alone.

---

## Metadata

**Analog search scope:** `backend/app/jobs/`, `backend/app/services/`, `backend/app/serializers/`, `backend/db/migrate/`, `backend/lib/tasks/`, `backend/app/models/`
**Files scanned:** 10 (calendar_sync_job.rb, sync_listing_photos_job.rb, resync_stale_photos_job.rb, rets_auth_service.rb, rets_photo_service.rb, listing_detail_serializer.rb, estate_serializer.rb, listing_detail.rb, cognito.rake, create_estate_ratings migration)
**Pattern extraction date:** 2026-05-16
