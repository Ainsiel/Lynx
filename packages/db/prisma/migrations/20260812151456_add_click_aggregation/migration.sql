-- CreateTable
CREATE TABLE "clicks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "url_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ip" INET,
    "country" VARCHAR(2),
    "device" VARCHAR(20),
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "url_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "clicks" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("url_id","day")
);

-- CreateTable
CREATE TABLE "stats_country" (
    "url_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "clicks" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "stats_country_pkey" PRIMARY KEY ("url_id","day","country")
);

-- CreateTable
CREATE TABLE "stats_device" (
    "url_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "device" VARCHAR(20) NOT NULL,
    "clicks" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "stats_device_pkey" PRIMARY KEY ("url_id","day","device")
);

-- CreateIndex
CREATE UNIQUE INDEX "clicks_event_id_key" ON "clicks"("event_id");

-- CreateIndex
CREATE INDEX "idx_clicks_url_occurred" ON "clicks"("url_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_country" ADD CONSTRAINT "stats_country_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_device" ADD CONSTRAINT "stats_device_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
