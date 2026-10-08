import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const gameRuns = mysqlTable(
  "game_runs",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    distance: int("distance").notNull(),
    durationMs: int("durationMs").notNull(),
    hits: int("hits").notNull(),
    completed: boolean("completed").notNull(),
    score: int("score").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("game_runs_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    leaderboardIdx: index("game_runs_leaderboard_idx").on(
      table.completed,
      table.score,
      table.durationMs,
    ),
  }),
);

export type GameRun = typeof gameRuns.$inferSelect;
export type InsertGameRun = typeof gameRuns.$inferInsert;
