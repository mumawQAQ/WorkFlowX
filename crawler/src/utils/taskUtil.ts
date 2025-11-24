import {
  prisma,
  type CrawlTaskCreateInput,
  type CrawlResultCreateInput,
} from "@jobtracking/db";

type BatchPayload = { count: number };

export const storeResult = async (
  resultInput: CrawlResultCreateInput
): Promise<void> => {
  await prisma.crawlResult.upsert({
    where: { url: resultInput.url },
    update: resultInput,
    create: resultInput,
  });
};

export const addMultipleTasks = async (
  taskInputs: CrawlTaskCreateInput[]
): Promise<BatchPayload> => {
  const result = await prisma.crawlTask.createMany({
    data: taskInputs,
    skipDuplicates: true,
  });
  return result;
};

export const addTask = async (
  taskInput: CrawlTaskCreateInput
): Promise<void> => {
  await prisma.crawlTask.create({
    data: taskInput,
  });
};

export const updateTaskStatus = async (
  id: number,
  status: string
): Promise<void> => {
  await prisma.crawlTask.update({
    where: { id },
    data: { status },
  });
};
