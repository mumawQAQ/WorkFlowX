-- CreateTable
CREATE TABLE "CrawlResult" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "crawlType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedCrawl" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "crawlType" TEXT NOT NULL,
    "latestFailReason" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedCrawl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlTask" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "crawlType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "resultId" INTEGER,
    "failedId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrawlResult_url_key" ON "CrawlResult"("url");

-- CreateIndex
CREATE UNIQUE INDEX "FailedCrawl_url_key" ON "FailedCrawl"("url");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlTask_url_key" ON "CrawlTask"("url");

-- AddForeignKey
ALTER TABLE "CrawlTask" ADD CONSTRAINT "CrawlTask_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "CrawlResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlTask" ADD CONSTRAINT "CrawlTask_failedId_fkey" FOREIGN KEY ("failedId") REFERENCES "FailedCrawl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
