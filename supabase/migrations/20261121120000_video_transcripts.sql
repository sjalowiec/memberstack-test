-- Hosted English transcripts saved from the video admin.
-- Generated public/member/audit JSON is the text the video page reads.
-- VTT files are stored when this site has no GitHub writer.
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY.

CREATE TABLE IF NOT EXISTS public.video_transcript_documents (
  kind TEXT PRIMARY KEY,
  document TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT video_transcript_documents_kind_check CHECK (kind IN ('public', 'member', 'audit'))
);

CREATE TABLE IF NOT EXISTS public.video_transcript_files (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  sha TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_transcript_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_transcript_files ENABLE ROW LEVEL SECURITY;
