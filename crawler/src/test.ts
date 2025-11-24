import { log, LogLevel } from "crawlee";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Scheduler } from "./scheduler.js";
import { createCrawler } from "./crawlerFactory.js";
import { addMultipleTasks } from "./utils/taskUtil.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

log.setLevel(LogLevel.DEBUG);
const DEFAULT_CRAWLER_TYPE = "levelfyi_company_details";

const buildStartUrls = (
  filePath: string,
  baseUrl: string,
  limit: number | undefined = undefined
): string[] => {
  const companies = getCompaniesFromFile(filePath);
  const _limit = limit ? Math.min(limit, companies.length) : companies.length;
  return companies.slice(0, _limit).map((company) => `${baseUrl}/${company}`);
};

const getCompaniesFromFile = (filePath: string): string[] => {
  const filename = path.join(__dirname, filePath);
  const data = readFileSync(filename, "utf-8");
  return data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const seedTasks = async (urls: string[]) => {
  await addMultipleTasks(
    urls.map((url) => ({
      url,
      crawlType: DEFAULT_CRAWLER_TYPE,
      source: "companies.txt",
    }))
  );
};

const main = async () => {
  const startUrls = buildStartUrls(
    "companies.txt",
    "https://www.levels.fyi/companies",
    3
  );

  await seedTasks(startUrls);

  const crawler = await createCrawler({
    kind: "cheerio",
    taskType: DEFAULT_CRAWLER_TYPE,
  });

  const scheduler = Scheduler.instance;
  scheduler.start();

  log.info(
    `Scheduler started for ${startUrls.length} seeded tasks. Polling for more...`
  );

  await crawler.start();
  scheduler.stop();
  log.info("Crawler run completed. Scheduler stopped.");
};

await main().catch((error) => {
  log.error(`Crawler run failed: ${error.message}`);
  process.exit(1);
});
