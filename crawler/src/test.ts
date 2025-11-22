import { CheerioCrawler, log, LogLevel, Dataset } from "crawlee";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataset = await Dataset.open("company-info");

log.setLevel(LogLevel.DEBUG);

const crawler = new CheerioCrawler({
  minConcurrency: 10,
  maxConcurrency: 50,
  maxRequestRetries: 1,
  requestHandlerTimeoutSecs: 30,
  maxRequestsPerMinute: 200,

  async requestHandler({ request, $ }) {
    // Extract data from the page using cheerio.
    const title = $("title").text();
    const data = $('script[id="__NEXT_DATA__"]').html();

    let companyData = {};
    let jobFamilies = [];

    if (data) {
      const jsonData = JSON.parse(data);
      const props = jsonData["props"] || {};
      const pageProps = props["pageProps"] || {};
      // get the company data and job families from it
      companyData = pageProps["company"] || {};

      const jobFamiliesData = pageProps["jobFamilies"] || [];

      for (const jobFamily of jobFamiliesData) {
        jobFamilies.push({
          slug: jobFamily["slug"] || "",
          name: jobFamily["name"] || "",
          category: jobFamily["category"] || "",
          aliases: jobFamily["aliases"] || [],
        });
      }
    }

    if (!data || !companyData) {
      throw new Error(`Could not extract data from ${request.url}`);
    }

    // Store the results to the dataset. In local configuration,
    // the data will be stored as JSON files in ./storage/datasets/default
    await dataset.pushData({
      url: request.url,
      title: title,
      companyData: companyData,
      jobFamilies: jobFamilies,
    });
  },

  failedRequestHandler({ request }) {
    // record the failed requests
  },
});

const buildStartUrls = (
  filePath: string,
  baseUrl: string,
  limit: number | undefined = undefined
): string[] => {
  const companies = getCompaniesFromFile(filePath);
  const _limit = limit ? Math.min(limit, companies.length) : companies.length;
  const startUrls = companies
    .slice(0, _limit)
    .map((company) => `${baseUrl}/${company}`);
  return startUrls;
};

const getCompaniesFromFile = (filePath: string): string[] => {
  const filename = path.join(__dirname, filePath);
  const data = readFileSync(filename, "utf-8");
  return data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

// Run the crawler and wait for it to finish.
await crawler.run(
  buildStartUrls("companies.txt", "https://www.levels.fyi/companies")
);

log.debug("Crawler finished.");
