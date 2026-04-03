-- CreateTable
CREATE TABLE IF NOT EXISTS "chess"."history_snapshots" (
                                                           "id" SERIAL NOT NULL,
                                                           "enterprise" VARCHAR(255) NOT NULL,
    "product" VARCHAR(255) NOT NULL,
    "date" INTEGER NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "snapshot_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "history_snapshots_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE INDEX IF NOT EXISTS "history_snapshots_enterprise_product_snapshot_at_idx" ON "chess"."history_snapshots"("enterprise", "product", "snapshot_at");
