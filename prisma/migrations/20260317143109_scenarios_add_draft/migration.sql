-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "created_by" VARCHAR(255),
ADD COLUMN     "is_draft" BOOLEAN NOT NULL DEFAULT false;
