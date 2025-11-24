import { CrawlTaskModel } from "@jobtracking/db";
import { RequestQueue } from "crawlee";
import { Scheduler } from "../scheduler.js";

export abstract class BaseCrawler {
  public requestQueue: RequestQueue;
  protected taskType: string;

  constructor(requestQueue: RequestQueue, taskType: string) {
    this.requestQueue = requestQueue;
    this.taskType = taskType;
    Scheduler.instance.register(this.taskType, this);
  }

  abstract start(): Promise<void>;

  abstract run(task: CrawlTaskModel): Promise<void>;

  public onStop(reason: string): void {
    console.log(`onStop called for ${this.taskType}: ${reason}`);
  }
}
