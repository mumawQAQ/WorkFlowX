/**
 * Factory to create different types of crawlers
 */

import {
  CheerioCrawler,
  PlaywrightCrawler,
  RequestQueue,
  type CheerioCrawlerOptions,
  type PlaywrightCrawlerOptions,
} from "crawlee";
import { LevelFyiCompanyDetailCrawler } from "./crawlers/levelfyi/companyDetailCrawler.js";

type TaskType = { taskType: string };
type CheerioConfig = { kind: "cheerio" } & TaskType & CheerioCrawlerOptions;
type PlaywrightConfig = { kind: "playwright" } & TaskType &
  PlaywrightCrawlerOptions;
export type CrawlerConfig = CheerioConfig | PlaywrightConfig;

export const createCrawler = async (config: CrawlerConfig) => {
  if (config.kind === "cheerio") {
    const { kind: _kind, taskType: _taskType, ...options } = config;
    switch (_taskType) {
      case "levelfyi_company_details":
        const requestQueue = await RequestQueue.open();
        return new LevelFyiCompanyDetailCrawler(requestQueue);
    }
    throw new Error(`Unsupported Cheerio crawler task type: ${_taskType}`);
  }

  const { kind: _kind, taskType: _taskType, ...options } = config;
  switch (_taskType) {
  }
  throw new Error(`Unsupported Playwright crawler task type: ${_taskType}`);
};
