import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";

import { router } from "./routes.js";

const startUrls = [
  "https://github.com/miketromba/highest-paying-software-companies",
];

const crawler = new PlaywrightCrawler({
  // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
  requestHandler: router,
  // Comment this option to scrape the full website.
  maxRequestsPerCrawl: 20,
});

await crawler.run(startUrls);
