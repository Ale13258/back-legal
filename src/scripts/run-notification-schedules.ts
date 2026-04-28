import "dotenv/config";
import { RunSchedulesUseCase } from "../modules/notifications/application/use-cases/run-schedules.use-case.js";
import { NotificationsPrismaRepository } from "../modules/notifications/infrastructure/persistence/notifications-prisma.repository.js";
import { enqueueNotificationJob } from "../modules/notifications/infrastructure/queue/notifications.queue.js";
import { prisma } from "../shared/infrastructure/prisma/prisma.client.js";

async function run() {
  const notificationsPersistence = new NotificationsPrismaRepository();
  const useCase = new RunSchedulesUseCase({
    notificationsPersistence,
    queuePublisher: { enqueueNotificationJob },
  });
  const result = await useCase.execute({});
  console.log("scheduler_result", result);
}

run()
  .catch((error) => {
    console.error("scheduler_error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
