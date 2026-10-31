-- ============================================================
-- 071: messages.media_transcript
--
-- Speech-to-text transcript of an inbound voice note / audio message,
-- filled lazily by the AI agent the first time the audio enters its
-- context (src/lib/ai/media.ts). Cached here so the same audio is
-- never transcribed (and billed) twice, and so the inbox can show the
-- text under the audio bubble. NULL for every non-audio row and for
-- audio the agent hasn't processed (AI off, no OpenAI key, failure).
--
-- Idempotent: safe to run more than once.
-- ============================================================

alter table public.messages
  add column if not exists media_transcript text;

comment on column public.messages.media_transcript is
  'Speech-to-text transcript of an audio message, written by the AI agent (NULL when not transcribed).';
