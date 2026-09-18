-- ============================================================
-- 055_payment_media.sql
--
-- Adds the `payment-media` Supabase Storage bucket for images
-- uploaded from the Payment Skins editor (logo, background image,
-- top-section banner, top-section product image) — previously plain
-- URL text fields, now real file uploads.
--
-- Mirrors `chat-media` (migration 023) exactly: same account-scoped
-- RLS shape, same public-read/member-write split, same
-- `uploadAccountMedia()` client helper (`src/lib/storage/
-- upload-media.ts`) builds the path and does the upload — no new
-- upload code, just a new bucket for it to point at.
--
-- Path convention:
--   payment-media/account-<account_id>/<timestamp>-<basename>.<ext>
-- Public bucket: the uploaded image must be readable by the public
-- `/pay/[slug]` checkout page and `/pay/preview`, neither of which
-- carries an authenticated session.
--
-- 5 MB limit, images only — matches `MEDIA_MAX_BYTES_BY_KIND.image`
-- in `src/lib/storage/upload-media.ts`, which the uploader checks
-- client-side before ever calling Storage.
--
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-media',
  'payment-media',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Payment media is publicly readable" ON storage.objects;
CREATE POLICY "Payment media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-media');

DROP POLICY IF EXISTS "Members can upload payment media" ON storage.objects;
CREATE POLICY "Members can upload payment media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update payment media" ON storage.objects;
CREATE POLICY "Members can update payment media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payment-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete payment media" ON storage.objects;
CREATE POLICY "Members can delete payment media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
