-- CreateTable
CREATE TABLE "auth_logs" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255),
    "email" VARCHAR(255),
    "method" VARCHAR(10) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "ip" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);
