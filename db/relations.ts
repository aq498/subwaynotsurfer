import { relations } from "drizzle-orm";
import { gameRuns, users } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  gameRuns: many(gameRuns),
}));

export const gameRunsRelations = relations(gameRuns, ({ one }) => ({
  user: one(users, {
    fields: [gameRuns.userId],
    references: [users.id],
  }),
}));
