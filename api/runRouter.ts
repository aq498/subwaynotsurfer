import { z } from "zod";
import { GAME_RULES, calculateRunScore } from "@contracts/game";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { createGameRun, findLeaderboardRuns, findRunsByUser } from "./queries/runs";

const runInput = z.object({
  distance: z.number().int().min(0).max(GAME_RULES.goalDistance),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(GAME_RULES.timeLimitSeconds * 1000),
  hits: z.number().int().min(0).max(20),
  completed: z.boolean(),
});

export const runRouter = createRouter({
  leaderboard: publicQuery.query(() => findLeaderboardRuns(10)),
  mine: authedQuery.query(({ ctx }) => findRunsByUser(ctx.user.id, 8)),
  submit: authedQuery.input(runInput).mutation(async ({ ctx, input }) => {
    const normalized = {
      distance: input.completed
        ? GAME_RULES.goalDistance
        : Math.min(input.distance, GAME_RULES.goalDistance - 1),
      durationMs: input.completed
        ? input.durationMs
        : GAME_RULES.timeLimitSeconds * 1000,
      hits: input.hits,
      completed: input.completed,
    };
    const score = calculateRunScore(normalized);

    return createGameRun({
      ...normalized,
      score,
      userId: ctx.user.id,
    });
  }),
});
