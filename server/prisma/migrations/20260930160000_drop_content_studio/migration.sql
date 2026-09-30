-- Remove the first Content Studio. The sidebar page stays empty for a redesign.
DELETE FROM "org_feature_flags"
WHERE "flag" IN ('content_studio', 'voice_studio', 'video_studio');

DROP TABLE IF EXISTS "content_draft_attachments";
DROP TABLE IF EXISTS "generation_jobs";
DROP TABLE IF EXISTS "content_drafts";
DROP TABLE IF EXISTS "media_assets";
DROP TABLE IF EXISTS "brand_kits";
DROP TABLE IF EXISTS "generation_credit_ledger";
DROP TABLE IF EXISTS "approval_logs";

DROP TYPE IF EXISTS "ContentDraftKind";
DROP TYPE IF EXISTS "ContentDraftStatus";
DROP TYPE IF EXISTS "GenerationJobKind";
DROP TYPE IF EXISTS "GenerationJobStatus";
DROP TYPE IF EXISTS "GenerationCreditKind";
DROP TYPE IF EXISTS "MediaAssetKind";
DROP TYPE IF EXISTS "MediaAssetStatus";
