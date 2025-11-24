import { readFileSync } from "fs";
import path from "path";
import { addMultipleTasks } from "./taskUtil.js";

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
      crawlType: "levelfyi_company_details",
      source: "companies.txt",
    }))
  );
};
