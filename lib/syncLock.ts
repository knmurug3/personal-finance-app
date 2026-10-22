import * as crypto from "crypto";
import { db } from "@/lib/db";

// Longer than any sync can run (maxDuration is 300s), so a lease this old means its holder died
const LOCK_TTL_MS = 6 * 60 * 1000;
const MAX_PASSES = 3;

const lockKey = (itemId: string) => `syncLock:${itemId}`;
const againKey = (itemId: string) => `syncAgain:${itemId}`;

async function acquire(itemId: string): Promise<string | null> {
  const key = lockKey(itemId);
  const token = crypto.randomUUID();
  try {
    await db.appMeta.create({ data: { key, value: token } });
    return token;
  } catch {
    // Held already; take it over only if the holder's lease has expired
    const { count } = await db.appMeta.updateMany({
      where: { key, updatedAt: { lt: new Date(Date.now() - LOCK_TTL_MS) } },
      data: { value: token },
    });
    return count === 1 ? token : null;
  }
}

async function release(itemId: string, token: string) {
  await db.appMeta.deleteMany({ where: { key: lockKey(itemId), value: token } });
}

/** Consumes a pending "sync again" request; true if there was one. */
async function takeAgainRequest(itemId: string): Promise<boolean> {
  const { count } = await db.appMeta.deleteMany({ where: { key: againKey(itemId) } });
  return count > 0;
}

/**
 * Runs `run` while holding this bank item's sync lock, so the cron job, webhooks and manual
 * syncs never reconcile the same item from the same cursor at once. A caller that finds the
 * lock held leaves a "sync again" request instead, and the holder runs another pass for it,
 * so changes Plaid announced mid-sync aren't dropped. Returns false if another run had it.
 */
export async function withItemSyncLock(itemId: string, run: () => Promise<void>): Promise<boolean> {
  let token = await acquire(itemId);
  if (!token) {
    const key = againKey(itemId);
    await db.appMeta.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
    return false;
  }
  let passes = 0;
  while (token) {
    try {
      // This pass covers anything requested so far
      await takeAgainRequest(itemId);
      await run();
      passes++;
      while (passes < MAX_PASSES && (await takeAgainRequest(itemId))) {
        await run();
        passes++;
      }
    } finally {
      await release(itemId, token);
    }
    // A request that landed between the last check and the release would otherwise wait for the next sync
    token = passes < MAX_PASSES && (await takeAgainRequest(itemId)) ? await acquire(itemId) : null;
  }
  return true;
}
