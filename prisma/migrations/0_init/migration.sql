-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "chess_data_new" (
    "id" SERIAL NOT NULL,
    "Дата" INTEGER NOT NULL,
    "Предприятие" VARCHAR(255) NOT NULL,
    "Продукт" VARCHAR(255) NOT NULL,
    "ГруппировкаПланФакт" VARCHAR(255),
    "Для остатков" VARCHAR(255),
    "План" DOUBLE PRECISION,
    "Факт" DOUBLE PRECISION,
    "Этап" VARCHAR(255),
    "Ожид" DOUBLE PRECISION,
    "Торговые остатки" DOUBLE PRECISION,
    "Свободная емкость" DOUBLE PRECISION,
    "Объем парка" DOUBLE PRECISION,
    "Нумерация продукта" INTEGER,
    "Нумерация остатков" INTEGER,
    "Нумерация групп" INTEGER,
    "ТорговыеОстатки_2" DOUBLE PRECISION,
    "ОбъемПаркаДляПрогноза" DOUBLE PRECISION,
    "Ж/Д отгрузка" DECIMAL(28,6),
    "Отгрузка по воде" DECIMAL(28,6),
    "Труба" DECIMAL(28,6),
    "МНПП" DECIMAL(28,6),
    "Автоотгрузка" DECIMAL(28,6),
    "ОтгрузкаПлан" DECIMAL(32,6),
    "ОтгрузкаФакт" DECIMAL(32,6),
    "Отгрузка вода факт" DECIMAL(28,6),
    "Отгрузка жд факт" DECIMAL(28,6),
    "Отгрузка авто факт" DECIMAL(28,6),
    "Отгрузка труба факт" DECIMAL(28,6),
    "Отгрузка МНПП факт" DECIMAL(28,6),
    "Налив (отгрузка)" BIGINT,
    "Неоформл. отгрузка" BIGINT,
    "Паспортный" DECIMAL(28,6),
    "ПаспортныйПрогноз" DECIMAL(28,6),
    "Отгрузка" DECIMAL(32,6),
    "Дата_2" INTEGER,
    "Отгрузка_для_прогноза" DECIMAL(38,6),
    "Ожид_для_прогноза" DOUBLE PRECISION,
    "ОБР" DECIMAL(28,6),
    "inserted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chess_data_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_forecast_data_tmp" (
    "id" INTEGER NOT NULL,
    "forecast_date" DATE,
    "enterprise" VARCHAR(40),
    "product_name" VARCHAR(250),
    "railway" INTEGER,
    "tube" INTEGER,
    "mnpp" INTEGER,
    "water" INTEGER,
    "full_shippment" INTEGER,
    "manufacture" INTEGER,
    "leftovers_all" INTEGER,
    "leftovers_pass" INTEGER,
    "free_volume" INTEGER,
    "unformulated_shippment" INTEGER,
    "reserv_volume" INTEGER,
    "manufacture_plan" INTEGER,
    "manufacture_obr" INTEGER,
    "shippment_plan_zhd" INTEGER,
    "shippment_obr_zhd" INTEGER,
    "shippment_plan_tube" INTEGER,
    "shippment_obr_tube" INTEGER,
    "shippment_plan_mnpp" INTEGER,
    "shippment_obr_mnpp" INTEGER,
    "shippment_plan_water" INTEGER,
    "shippment_obr_water" INTEGER,
    "created_at" TIMESTAMP(6),
    "author" VARCHAR(100),

    CONSTRAINT "base_forecast_data_tmp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_data" (
    "id" SERIAL NOT NULL,
    "forecast_id" INTEGER,
    "railway" INTEGER,
    "tube" INTEGER,
    "mnpp" INTEGER,
    "water" INTEGER,
    "full_shippment" INTEGER,
    "manufacture" INTEGER,
    "leftovers_all" INTEGER,
    "leftovers_pass" INTEGER,
    "free_volume" INTEGER,
    "unformulated_shippment" INTEGER,
    "reserv_volume" INTEGER,
    "manufacture_plan" INTEGER,
    "manufacture_obr" INTEGER,
    "shippment_plan_zhd" INTEGER,
    "shippment_obr_zhd" INTEGER,
    "shippment_plan_tube" INTEGER,
    "shippment_obr_tube" INTEGER,
    "shippment_plan_mnpp" INTEGER,
    "shippment_obr_mnpp" INTEGER,
    "shippment_plan_water" INTEGER,
    "shippment_obr_water" INTEGER,
    "created_at" TIMESTAMP(6),
    "author" VARCHAR(250),

    CONSTRAINT "forecast_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_forecast" (
    "id" SERIAL NOT NULL,
    "enterprise" VARCHAR(255) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "forecast_date" DATE NOT NULL,
    "forecast_id" SERIAL NOT NULL,

    CONSTRAINT "products_forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "forecasts" JSON NOT NULL,

    CONSTRAINT "sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits_history" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "action" VARCHAR(255) NOT NULL,

    CONSTRAINT "visits_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wagon_forecast_tmp" (
    "id" SERIAL NOT NULL,
    "forecast_date" DATE,
    "enterprise" VARCHAR(40),
    "cargo_type" VARCHAR(50),
    "demand" INTEGER,
    "forecast" INTEGER,
    "shipment_fact" INTEGER,
    "osvoenie" INTEGER,
    "forecast_type" VARCHAR(20) DEFAULT 'full',
    "created_at" TIMESTAMP(6),

    CONSTRAINT "wagon_forecast_tmp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "comment" TEXT,
    "enterprise" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_edits" (
    "id" SERIAL NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "original_id" INTEGER NOT NULL,
    "field" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "base_forecast_data_tmp_id_key" ON "base_forecast_data_tmp"("id");

-- CreateIndex
CREATE UNIQUE INDEX "products_forecast_forecast_id_key" ON "products_forecast"("forecast_id");

-- CreateIndex
CREATE INDEX "ix_sample_author" ON "sample"("author");

-- CreateIndex
CREATE INDEX "ix_sample_name" ON "sample"("name");

-- CreateIndex
CREATE INDEX "ix_visits_history_action" ON "visits_history"("action");

-- CreateIndex
CREATE INDEX "ix_visits_history_username" ON "visits_history"("username");

-- AddForeignKey
ALTER TABLE "forecast_data" ADD CONSTRAINT "forecast_data_forecast_id_fkey" FOREIGN KEY ("forecast_id") REFERENCES "products_forecast"("forecast_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scenario_edits" ADD CONSTRAINT "scenario_edits_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

