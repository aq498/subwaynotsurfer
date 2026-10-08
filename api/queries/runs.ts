import { asc, desc, eq } from "drizzle-orm";
import { gameRuns, users } from "@db/schema";
import type { InsertGameRun } from "@db/schema";
import { getDb } from "./connection";

export async function createGameRun(data: Omit<InsertGameRun, "id" | "createdAt">) {
  const [{ id }] = await getDb().insert(gameRuns).values(data).$returningId();
  return getDb().query.gameRuns.findFirst({ where: eq(gameRuns.id, id) });
}

export async function findRunsByUser(userId: number, limit = 8) {
  return getDb()
    .select()
    .from(gameRuns)
    .where(eq(gameRuns.userId, userId))
    .orderBy(desc(gameRuns.createdAt))
    .limit(limit);
}

export async function findLeaderboardRuns(limit = 10) {
  return getDb()
    .select({
      id: gameRuns.id,
      distance: gameRuns.distance,
      durationMs: gameRuns.durationMs,
      hits: gameRuns.hits,
      completed: gameRuns.completed,
      score: gameRuns.score,
      createdAt: gameRuns.createdAt,
      userName: users.name,
      userAvatar: users.avatar,
    })
    .from(gameRuns)
    .innerJoin(users, eq(gameRuns.userId, users.id))
    .orderBy(desc(gameRuns.score), asc(gameRuns.durationMs), desc(gameRuns.createdAt))
    .limit(limit);
}
