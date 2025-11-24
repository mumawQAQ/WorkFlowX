import { CheerioCrawler, RequestQueue } from "crawlee";
import { BaseCrawler } from "../baseCrawler.js";
import { CrawlTaskModel } from "@jobtracking/db";
import { Scheduler } from "../../scheduler.js";
import { addMultipleTasks, storeResult } from "../../utils/taskUtil.js";

const TASK_TYPE = "levelfyi_company_details";

export class LevelFyiCompanyDetailCrawler extends BaseCrawler {
  private crawler: CheerioCrawler;

  constructor(requestQueue: RequestQueue) {
    super(requestQueue, TASK_TYPE);

    const crawler = new CheerioCrawler({
      requestQueue,
      minConcurrency: 10,
      maxConcurrency: 50,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: 30,
      maxRequestsPerMinute: 200,
      autoscaledPoolOptions: {
        isFinishedFunction: async () => {
          const queueFinished = await requestQueue.isFinished();
          const hasPending = await Scheduler.instance.hasPendingTasks();
          return queueFinished && !hasPending;
        },
      },

      async requestHandler({ request, $, response }) {
        const taskId = request.userData?.taskId as number | undefined;

        if (!taskId) {
          throw new Error(`Missing taskId for request ${request.url}`);
        }

        const title = $("title").text();
        const data = $('script[id="__NEXT_DATA__"]').html();

        let companyData = {};
        let jobFamilies = [];

        if (data) {
          const jsonData = JSON.parse(data);
          const props = jsonData["props"] || {};
          const pageProps = props["pageProps"] || {};
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
          throw new Error(
            `Could not extract data from ${request.url}, status=${
              response?.statusCode
            }, body=${$.html()}`
          );
        }

        await storeResult({
          url: request.url,
          crawlType:
            (request.userData?.crawlType as string) ??
            "levelfyi_company_details",
          data: JSON.stringify({
            title,
            companyData,
            jobFamilies,
          }),
          dataType: "json",
          crawlTasks: { connect: { id: taskId } },
        });

        if (taskId) {
          Scheduler.instance.resolveTaskCompletion(taskId);
        }

        const relatedSlugs = Array.isArray(
          (companyData as Record<string, unknown>)["related_companies_slugs"]
        )
          ? ((companyData as Record<string, unknown>)[
              "related_companies_slugs"
            ] as Array<Record<string, unknown>>)
          : [];

        if (relatedSlugs.length > 0) {
          const relatedTasks = relatedSlugs
            .map((item) => item["slug"])
            .filter(
              (slug): slug is string =>
                typeof slug === "string" && slug.length > 0
            )
            .map((slug) => ({
              url: `https://www.levels.fyi/companies/${slug}`,
              crawlType: "levelfyi_company_details",
              source: "related_companies",
            }));

          if (relatedTasks.length > 0) {
            await addMultipleTasks(relatedTasks);
          }
        }
      },

      failedRequestHandler({ request, response }, error) {
        const taskId = request.userData?.taskId as number | undefined;
        const parts = [
          error.message,
          response ? `status=${response.statusCode}` : null,
          request.errorMessages && request.errorMessages.length > 0
            ? `errors=${request.errorMessages.join(" | ")}`
            : null,
          request.loadedUrl ? `loadedUrl=${request.loadedUrl}` : null,
        ].filter(Boolean);

        const reason =
          parts.length > 0
            ? parts.join(" | ")
            : `Failed to crawl ${request.url}`;

        if (taskId) {
          Scheduler.instance.rejectTaskCompletion(taskId, new Error(reason));
        }
      },
    });

    this.crawler = crawler;
  }

  override async start(): Promise<void> {
    await this.crawler.run();
  }

  override async run(task: CrawlTaskModel): Promise<void> {
    const completion = Scheduler.instance.createTaskCompletion(task.id);

    await this.requestQueue.addRequest({
      url: task.url,
      userData: { taskId: task.id, crawlType: task.crawlType },
    });

    await completion;
  }
}
