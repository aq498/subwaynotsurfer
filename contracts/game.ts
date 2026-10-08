export const GAME_RULES = {
  goalDistance: 500,
  timeLimitSeconds: 60,
  baseTopSpeed: 13,
  baseAcceleration: 3.1,
  hitTopSpeedPenalty: 2.4,
  hitAccelerationPenalty: 0.5,
  minimumTopSpeed: 6.7,
  minimumAcceleration: 1.65,
  stunSeconds: 1,
} as const;

export type RunScoreInput = {
  distance: number;
  durationMs: number;
  hits: number;
  completed: boolean;
};

export function calculateRunScore(input: RunScoreInput) {
  const distance = Math.max(0, Math.min(GAME_RULES.goalDistance, input.distance));
  const durationMs = Math.max(
    0,
    Math.min(GAME_RULES.timeLimitSeconds * 1000, input.durationMs),
  );
  const hits = Math.max(0, input.hits);
  const timeBonus = input.completed
    ? Math.max(0, GAME_RULES.timeLimitSeconds * 1000 - durationMs) / 10
    : 0;
  const completionBonus = input.completed ? 2500 : 0;

  return Math.max(
    0,
    Math.round(distance * 10 + completionBonus + timeBonus - hits * 400),
  );
}
