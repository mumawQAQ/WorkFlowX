import { CrawlTaskModel, prisma } from "@jobtracking/db";
import { BaseCrawler } from "./crawlers/baseCrawler.js";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

export type TaskCompleter = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

// TODO: write a configurable Scheduler to manage different types of crawlers

type SchedulerOptions = {
  pollIntervalMs: number;
  maxParallel: number;
  errorRateThreshold?: number;
  minProcessedBeforeStop?: number;
};

export class Scheduler {
  static #instance: Scheduler;

  private registry = new Map<string, BaseCrawler>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private active = 0;
  private taskCompleters = new Map<number, TaskCompleter>();
  private ticking = false;
  private totalProcessed = 0;
  private totalErrors = 0;

  private options: SchedulerOptions = {
    pollIntervalMs: 5000,
    maxParallel: 5,
  };

  private constructor() {}

  public static get instance(): Scheduler {
    if (!Scheduler.#instance) {
      Scheduler.#instance = new Scheduler();
    }
    return Scheduler.#instance;
  }

  public register(type: string, executor: BaseCrawler) {
    if (this.registry.has(type)) {
      console.warn(
        `[Scheduler] have already registered executor for type: ${type}, overwriting...`
      );
    }
    this.registry.set(type, executor);
    console.log(`[Scheduler] registered successfully: ${type}`);
  }

  start() {
    if (this.running) return;
    this.running = true;
    void this.tick();
    this.timer = setInterval(
      () => void this.tick(),
      this.options.pollIntervalMs
    );
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  configure(options: Partial<SchedulerOptions>) {
    this.options = { ...this.options, ...options };
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    if (this.ticking) {
      return;
    }

    this.ticking = true;

    try {
      while (this.active < this.options.maxParallel) {
        const task = await this.claimNextTask();
        if (!task) break;
        this.runTask(task);
      }
    } catch (error) {
      console.error("[scheduler] tick failed", error);
    } finally {
      this.ticking = false;
    }
  }

  private async claimNextTask(): Promise<CrawlTaskModel | null> {
    console.log("[scheduler] attempting to claim next task");
    const claimed = await prisma.$transaction(async (tx) => {
      const pending = await tx.crawlTask.findFirst({
        where: { status: "pending" satisfies TaskStatus },
        orderBy: { createdAt: "asc" },
      });

      if (!pending) return null;

      const updated = await tx.crawlTask.updateMany({
        where: { id: pending.id, status: "pending" satisfies TaskStatus },
        data: { status: "in_progress" satisfies TaskStatus },
      });

      if (updated.count === 0) return null;

      console.log(`[scheduler] claimed task ${pending.id}`);

      return pending;
    });

    return claimed ? { ...claimed, status: "in_progress" } : null;
  }

  private runTask(task: CrawlTaskModel) {
    this.active += 1;

    const crawler = this.registry.get(task.crawlType);

    if (!crawler) {
      console.error(
        `[Scheduler] no crawler registered for task type: ${task.crawlType}`
      );
      throw new Error(
        `[Scheduler] no crawler registered for task type: ${task.crawlType}`
      );
    }

    crawler
      .run(task)
      .then(async () => {
        await this.markTaskCompleted(task.id);
        this.totalProcessed += 1;
        this.checkErrorRate();
      })
      .catch(async (error) => {
        await this.markTaskFailed(task.id, error);
        this.totalProcessed += 1;
        this.totalErrors += 1;
        this.checkErrorRate();
      })
      .finally(() => {
        this.active -= 1;
      });
  }

  createTaskCompletion(taskId: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.taskCompleters.set(taskId, { resolve, reject });
    });
  }

  resolveTaskCompletion(taskId: number) {
    const completer = this.taskCompleters.get(taskId);
    if (completer) {
      completer.resolve();
      this.taskCompleters.delete(taskId);
    }
  }

  rejectTaskCompletion(taskId: number, error: unknown) {
    const completer = this.taskCompleters.get(taskId);
    if (completer) {
      completer.reject(error);
      this.taskCompleters.delete(taskId);
    }
  }

  private checkErrorRate() {
    const { errorRateThreshold, minProcessedBeforeStop } = this.options;
    if (!minProcessedBeforeStop || !errorRateThreshold) return;

    if (this.totalProcessed < minProcessedBeforeStop) {
      return;
    }

    const rate =
      this.totalProcessed === 0 ? 0 : this.totalErrors / this.totalProcessed;

    if (rate >= errorRateThreshold) {
      const reason = `[scheduler] stopping: error rate ${rate.toFixed(
        2
      )} over ${this.totalProcessed} tasks (threshold ${errorRateThreshold})`;
      console.warn(reason);
      this.stop();
      this.registry.forEach((crawler) => crawler.onStop(reason)); // TODO: refactor this to use the specific onStop on clawler
    }
  }

  async hasPendingTasks(): Promise<boolean> {
    const pendingCount = await prisma.crawlTask.count({
      where: { status: "pending" satisfies TaskStatus },
    });
    return pendingCount > 0;
  }

  private async markTaskCompleted(taskId: number) {
    await prisma.crawlTask.update({
      where: { id: taskId },
      data: { status: "completed" satisfies TaskStatus },
    });
  }

  private async markTaskFailed(taskId: number, error: unknown) {
    const reason =
      error instanceof Error ? error.message : "Unknown worker error";

    await prisma.$transaction(async (tx) => {
      const task = await tx.crawlTask.findUnique({ where: { id: taskId } });
      if (!task) return;

      const failedRecord = await tx.failedCrawl.upsert({
        where: { url: task.url },
        update: {
          latestFailReason: reason,
          failCount: { increment: 1 },
          crawlType: task.crawlType,
        },
        create: {
          url: task.url,
          crawlType: task.crawlType,
          latestFailReason: reason,
          failCount: 1,
        },
      });

      await tx.crawlTask.update({
        where: { id: taskId },
        data: {
          status: "failed" satisfies TaskStatus,
          failedId: failedRecord.id,
        },
      });
    });

    console.warn(`[scheduler] task ${taskId} failed: ${reason}`);
  }
}
