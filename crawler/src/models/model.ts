type CrawlTask = {
  id: string;
  url: string;
  crawlType: string;
  status: string;
  source?: string;

  createdAt: Date;
  updatedAt: Date;
};
