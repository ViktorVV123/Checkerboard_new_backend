/*
  Warnings:

  - You are about to drop the column `method` on the `auth_logs` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `auth_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "auth_logs" DROP COLUMN "method",
DROP COLUMN "url",
ADD COLUMN     "company" VARCHAR(255),
ADD COLUMN     "department" VARCHAR(255),
ADD COLUMN     "title" VARCHAR(255);
