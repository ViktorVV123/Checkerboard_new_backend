-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approved_at" TIMESTAMP(6),
ADD COLUMN     "approved_by" VARCHAR(255);
