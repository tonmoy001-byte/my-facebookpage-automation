-- Create Language enum
CREATE TYPE "Language" AS ENUM ('EN', 'BN');

-- Create CommentStatus enum
CREATE TYPE "CommentStatus" AS ENUM ('PROCESSING', 'REPLIED', 'PENDING', 'ESCALATED', 'FAILED');

-- Add fields to Post
ALTER TABLE "Post" ADD COLUMN "autoReply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "language" "Language" NOT NULL DEFAULT 'EN';

-- Add fields to AISettings
ALTER TABLE "AISettings" ADD COLUMN "defaultLanguage" "Language" NOT NULL DEFAULT 'EN';
ALTER TABLE "AISettings" ADD COLUMN "defaultBrandVoiceId" TEXT;

-- Add isPreset to BrandVoice
ALTER TABLE "BrandVoice" ADD COLUMN "isPreset" BOOLEAN NOT NULL DEFAULT false;

-- Migrate Comment.status from String to enum
-- First add new column
ALTER TABLE "Comment" ADD COLUMN "statusNew" "CommentStatus" NOT NULL DEFAULT 'PENDING';

-- Copy existing data
UPDATE "Comment" SET "statusNew" = 'REPLIED' WHERE "status" = 'replied';
UPDATE "Comment" SET "statusNew" = 'PENDING' WHERE "status" = 'pending';
UPDATE "Comment" SET "statusNew" = 'PENDING' WHERE "status" = 'ignored';

-- Drop old column and rename new
ALTER TABLE "Comment" DROP COLUMN "status";
ALTER TABLE "Comment" RENAME COLUMN "statusNew" TO "status";

-- Add audit fields to Comment
ALTER TABLE "Comment" ADD COLUMN "replyType" TEXT;
ALTER TABLE "Comment" ADD COLUMN "brandVoiceId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "modelUsed" TEXT;
