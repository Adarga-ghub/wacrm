-- ============================================================
-- 058_raise_media_bucket_limit.sql
--
-- Raises the `file_size_limit` on the `flow-media` (016) and
-- `chat-media` (023) Storage buckets from 16 MB to 100 MB.
--
-- Both buckets were capped at 16 MB — Meta's video/audio ceiling —
-- to keep one universal limit to reason about, per the comments in
-- those migrations. But Meta's WhatsApp Cloud API actually allows
-- documents up to 100 MB, and the "Send Document" automation step
-- (and the inbox composer / Flows `send_media` node) needs to pass
-- large PDFs through without the bucket rejecting the upload first.
--
-- Application code still enforces Meta's real per-kind caps client-
-- side (image 5 MB, video/audio 16 MB, document 100 MB — see
-- `MEDIA_MAX_BYTES_BY_KIND` in src/lib/storage/upload-media.ts), so
-- this migration only removes the bucket-level ceiling that was
-- blocking documents specifically; it doesn't loosen validation for
-- other media kinds.
--
-- Idempotent — safe to re-run.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 104857600 -- 100 MB
WHERE id IN ('flow-media', 'chat-media');
