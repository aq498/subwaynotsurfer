import { authRouter } from "./auth-router";
import { runRouter } from "./runRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  runs: runRouter,
});

export type AppRouter = typeof appRouter;
