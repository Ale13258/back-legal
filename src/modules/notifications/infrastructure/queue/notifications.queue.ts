import { Queue } from "bullmq";
import { Redis } from "ioredis";
import net from "node:net";

let notificationsWhatsAppQueue: Queue | null = null;
let redisReachableCache: { ok: boolean; checkedAt: number } | null = null;

function parseRedisEndpoint(redisUrl: string) {
  const url = new URL(redisUrl);
  return { host: url.hostname, port: Number(url.port || "6379") };
}

async function isRedisReachable(redisUrl: string): Promise<boolean> {
  const now = Date.now();
  if (redisReachableCache && now - redisReachableCache.checkedAt < 5_000) {
    return redisReachableCache.ok;
  }

  const { host, port } = parseRedisEndpoint(redisUrl);
  const ok = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    const finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
  redisReachableCache = { ok, checkedAt: now };
  return ok;
}

function getNotificationsQueue(): Queue {
  if (notificationsWhatsAppQueue) return notificationsWhatsAppQueue;

  const connection = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    reconnectOnError: () => false,
  });
  connection.on("error", () => {
    // Evita spam en consola cuando Redis no está disponible en desarrollo.
  });

  notificationsWhatsAppQueue = new Queue("notifications-whatsapp", {
    connection,
  });
  return notificationsWhatsAppQueue;
}

export async function enqueueNotificationJob(input: { event_id: string }) {
  try {
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    if (!(await isRedisReachable(redisUrl))) {
      return false;
    }
    const queue = getNotificationsQueue();
    await queue.add(
      "send-whatsapp",
      { event_id: input.event_id },
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 30_000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    return true;
  } catch {
    return false;
  }
}

export async function getNotificationQueueCountsSafe() {
  try {
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    if (!(await isRedisReachable(redisUrl))) {
      return { waiting: 0, active: 0, delayed: 0, failed: 0 };
    }
    const queue = getNotificationsQueue();
    return await queue.getJobCounts("waiting", "active", "delayed", "failed");
  } catch {
    return { waiting: 0, active: 0, delayed: 0, failed: 0 };
  }
}
