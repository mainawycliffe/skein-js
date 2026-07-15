-- Up Migration
--
-- Store-item TTL. `expires_at` is when the item should be treated as gone; the background sweeper
-- deletes rows past it, and reads filter them out lazily. `ttl_minutes` is the item's own lifetime,
-- kept so a refresh-on-read can re-derive `expires_at = now() + ttl_minutes`. Both are NULL for
-- items with no TTL (the default), so existing rows are unaffected.

ALTER TABLE store_items ADD COLUMN ttl_minutes double precision;
ALTER TABLE store_items ADD COLUMN expires_at  timestamptz;

CREATE INDEX store_items_expires_at_idx ON store_items (expires_at) WHERE expires_at IS NOT NULL;

-- Down Migration

DROP INDEX store_items_expires_at_idx;
ALTER TABLE store_items DROP COLUMN expires_at;
ALTER TABLE store_items DROP COLUMN ttl_minutes;
