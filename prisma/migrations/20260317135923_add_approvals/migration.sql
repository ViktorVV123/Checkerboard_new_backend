-- CreateTable
CREATE TABLE "approvals" (
    "id" SERIAL NOT NULL,
    "date" INTEGER NOT NULL,
    "enterprise" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approvals_date_enterprise_username_key" ON "approvals"("date", "enterprise", "username");
