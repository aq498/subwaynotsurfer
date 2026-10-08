import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { GAME_RULES, calculateRunScore } from "@contracts/game";
import { Button } from "@/components/ui/button";
import { schoolAudio } from "@/game/audio";
import { cn } from "@/lib/utils";

const ASSETS = {
  spray: "/assets/spray.webp",
  caught: "/assets/caught.webp",
  runup: "/assets/runup.webp",
  corridor: "/assets/corridor.webp",
  finish: "/assets/finish.webp",
  runner: "/assets/runner.png",
} as const;

const SPAWN_DISTANCE = 48;

type Phase = "idle" | "spray" | "caught" | "runup" | "playing" | "success" | "failed";
type ObstacleKind = "desk" | "chair" | "bin" | "wet";

export type SaveState = "idle" | "guest" | "saving" | "saved" | "error";

export type RunResult = {
  distance: number;
  durationMs: number;
  hits: number;
  completed: boolean;
  score: number;
};

type HudState = {
  timeLeft: number;
  distance: number;
  speed: number;
  hits: number;
};

type Obstacle = {
  id: number;
  lane: number;
  z: number;
  kind: ObstacleKind;
};

type GameState = {
  lane: number;
  laneVisual: number;
  speed: number;
  distance: number;
  elapsed: number;
  stun: number;
  invincible: number;
  hits: number;
  obstacles: Obstacle[];
  nextSpawn: number;
  obstacleId: number;
  finished: boolean;
  flash: number;
  shake: number;
  lastFrame: number;
  lastHud: number;
};

type GameImages = {
  corridor?: HTMLImageElement;
  runner?: HTMLImageElement;
};

const initialHud: HudState = {
  timeLeft: GAME_RULES.timeLimitSeconds,
  distance: 0,
  speed: 0,
  hits: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function laneX(lane: number, progress: number, width: number) {
  return width / 2 + (lane - 1) * width * (0.055 + progress * 0.205);
}

function obstacleColor(kind: ObstacleKind) {
  if (kind === "desk") return "#b9793d";
  if (kind === "chair") return "#d98a2b";
  if (kind === "bin") return "#7f8a94";
  return "#ffdf2b";
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  width: number,
  height: number,
) {
  const progress = clamp(1 - obstacle.z / SPAWN_DISTANCE, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const x = laneX(obstacle.lane, eased, width);
  const y = height * 0.16 + (height * 0.77 - height * 0.16) * eased;
  const scale = 0.22 + eased * 1.18;
  const unit = width * 0.13 * scale;
  const main = obstacleColor(obstacle.kind);

  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.strokeStyle = "#11193b";

  ctx.fillStyle = "rgba(17, 25, 59, 0.34)";
  ctx.beginPath();
  ctx.ellipse(0, unit * 0.62, unit * 0.72, unit * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obstacle.kind === "desk") {
    ctx.fillStyle = main;
    ctx.fillRect(-unit * 0.72, -unit * 0.44, unit * 1.44, unit * 0.42);
    ctx.strokeRect(-unit * 0.72, -unit * 0.44, unit * 1.44, unit * 0.42);
    ctx.fillStyle = "#59616d";
    ctx.fillRect(-unit * 0.55, -unit * 0.02, unit * 0.12, unit * 0.66);
    ctx.fillRect(unit * 0.43, -unit * 0.02, unit * 0.12, unit * 0.66);
    ctx.strokeRect(-unit * 0.55, -unit * 0.02, unit * 0.12, unit * 0.66);
    ctx.strokeRect(unit * 0.43, -unit * 0.02, unit * 0.12, unit * 0.66);
    ctx.fillStyle = "#faf9ea";
    ctx.fillRect(-unit * 0.32, -unit * 0.58, unit * 0.42, unit * 0.12);
  } else if (obstacle.kind === "chair") {
    ctx.fillStyle = main;
    ctx.fillRect(-unit * 0.48, -unit * 0.72, unit * 0.96, unit * 0.34);
    ctx.strokeRect(-unit * 0.48, -unit * 0.72, unit * 0.96, unit * 0.34);
    ctx.fillRect(-unit * 0.55, -unit * 0.2, unit * 1.1, unit * 0.28);
    ctx.strokeRect(-unit * 0.55, -unit * 0.2, unit * 1.1, unit * 0.28);
    ctx.fillStyle = "#59616d";
    ctx.fillRect(-unit * 0.42, unit * 0.08, unit * 0.1, unit * 0.62);
    ctx.fillRect(unit * 0.32, unit * 0.08, unit * 0.1, unit * 0.62);
  } else if (obstacle.kind === "bin") {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(-unit * 0.42, -unit * 0.62);
    ctx.lineTo(unit * 0.42, -unit * 0.62);
    ctx.lineTo(unit * 0.32, unit * 0.58);
    ctx.lineTo(-unit * 0.32, unit * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c9d0d6";
    ctx.fillRect(-unit * 0.52, -unit * 0.76, unit * 1.04, unit * 0.16);
    ctx.strokeRect(-unit * 0.52, -unit * 0.76, unit * 1.04, unit * 0.16);
  } else {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(0, -unit * 0.82);
    ctx.lineTo(unit * 0.62, unit * 0.5);
    ctx.lineTo(-unit * 0.62, unit * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#11193b";
    ctx.fillRect(-unit * 0.08, -unit * 0.34, unit * 0.16, unit * 0.4);
    ctx.fillRect(-unit * 0.08, unit * 0.2, unit * 0.16, unit * 0.12);
  }

  ctx.restore();
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  images: GameImages,
) {
  const { width, height } = canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  if (state.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.shake,
      (Math.random() - 0.5) * state.shake,
    );
  }

  if (images.corridor) {
    drawCover(ctx, images.corridor, width, height);
  } else {
    ctx.fillStyle = "#11193b";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = "rgba(17, 25, 59, 0.18)";
  ctx.fillRect(0, 0, width, height);

  const topY = height * 0.15;
  const bottomY = height * 0.98;
  ctx.beginPath();
  ctx.moveTo(width * 0.42, topY);
  ctx.lineTo(width * 0.58, topY);
  ctx.lineTo(width * 0.96, bottomY);
  ctx.lineTo(width * 0.04, bottomY);
  ctx.closePath();
  ctx.fillStyle = "rgba(250, 249, 234, 0.12)";
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 223, 43, 0.72)";
  [0, 1, 2, 3].forEach((boundary) => {
    const bottomX = width * (0.08 + boundary * 0.28);
    const topX = width * (0.45 + boundary * 0.033);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(bottomX, bottomY);
    ctx.stroke();
  });

  const scroll = (state.distance * 0.035) % 1;
  for (let index = 0; index < 12; index += 1) {
    const progress = (index / 12 + scroll) % 1;
    const y = topY + (bottomY - topY) * progress * progress;
    const halfWidth = width * (0.06 + progress * 0.42);
    ctx.strokeStyle = `rgba(250, 249, 234, ${0.12 + progress * 0.3})`;
    ctx.lineWidth = 1 + progress * 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - halfWidth, y);
    ctx.lineTo(width / 2 + halfWidth, y);
    ctx.stroke();
  }

  [...state.obstacles]
    .sort((a, b) => b.z - a.z)
    .forEach((obstacle) => drawObstacle(ctx, obstacle, width, height));

  const runnerImage = images.runner;
  const runnerWidth = clamp(width * 0.25, 76, 132);
  const runnerHeight = runnerImage
    ? runnerWidth * (runnerImage.height / runnerImage.width)
    : runnerWidth * 1.9;
  const runnerX = laneX(state.laneVisual, 1, width);
  const bounce = state.speed > 0.2 ? Math.sin(state.distance * 0.45) * 5 : 0;
  const runnerY = height * 0.96 + bounce;

  ctx.fillStyle = "rgba(17, 25, 59, 0.38)";
  ctx.beginPath();
  ctx.ellipse(
    runnerX,
    height * 0.965,
    runnerWidth * 0.48,
    runnerWidth * 0.13,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const blink = state.invincible > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
  if (!blink) {
    ctx.save();
    ctx.translate(runnerX, runnerY - runnerHeight / 2);
    if (state.stun > 0) {
      ctx.rotate(Math.sin(state.elapsed * 34) * 0.12);
    } else {
      ctx.rotate(Math.sin(state.distance * 0.12) * 0.035);
    }
    if (runnerImage) {
      ctx.drawImage(
        runnerImage,
        -runnerWidth / 2,
        -runnerHeight / 2,
        runnerWidth,
        runnerHeight,
      );
    } else {
      ctx.fillStyle = "#faf9ea";
      ctx.fillRect(-runnerWidth / 2, -runnerHeight / 2, runnerWidth, runnerHeight);
    }
    ctx.restore();
  }

  if (state.speed > 10) {
    ctx.strokeStyle = "rgba(250, 249, 234, 0.38)";
    ctx.lineWidth = 2;
    for (let index = 0; index < 9; index += 1) {
      const x = ((index * 73 + state.distance * 11) % (width + 80)) - 40;
      const y = height * (0.2 + ((index * 29) % 70) / 100);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 28, y + 40);
      ctx.stroke();
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 42, 0, ${state.flash * 0.42})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

function formatSeconds(value: number) {
  return Math.max(0, value).toFixed(1);
}

function formatResultTime(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function IntroScreen({
  image,
  kicker,
  title,
  body,
  danger = false,
}: {
  image: string;
  kicker: string;
  title: string;
  body: string;
  danger?: boolean;
}) {
  return (
    <div className="screen-panel absolute inset-0 z-20">
      <img src={image} alt="" className="game-photo" draggable={false} />
      <div className="photo-shade" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        <div
          className={cn(
            "sticker-label font-pixel text-[10px] sm:text-xs",
            danger && "bg-[#feadd2]",
          )}
        >
          {kicker}
        </div>
        <h2 className="font-pixel mt-4 max-w-[13ch] text-2xl leading-relaxed text-[#faf9ea] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-md text-sm font-bold text-[#faf9ea] sm:text-base">
          {body}
        </p>
      </div>
    </div>
  );
}

export default function RunnerGame({
  onFinish,
  onStart,
  saveState,
  isAuthenticated,
}: {
  onFinish: (result: RunResult) => void;
  onStart: () => void;
  saveState: SaveState;
  isAuthenticated: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const frameRef = useRef<number | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const imagesRef = useRef<GameImages>({});
  const touchStartX = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [hud, setHud] = useState<HudState>(initialHud);
  const [assetsReady, setAssetsReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage(ASSETS.corridor), loadImage(ASSETS.runner)])
      .then(([corridor, runner]) => {
        if (!cancelled) {
          imagesRef.current = { corridor, runner };
          setAssetsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAssetsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(rect.width));
      canvas.height = Math.max(420, Math.floor(rect.height));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === "spray" || phase === "caught" || phase === "runup") {
      schoolAudio.cue(phase);
    }

    if (phase === "spray") {
      const timer = window.setTimeout(() => setPhase("caught"), 1900);
      return () => window.clearTimeout(timer);
    }
    if (phase === "caught") {
      const timer = window.setTimeout(() => setPhase("runup"), 1500);
      return () => window.clearTimeout(timer);
    }
    if (phase === "runup") {
      const timer = window.setTimeout(() => setPhase("playing"), 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  const moveLane = useCallback((direction: -1 | 1) => {
    const state = gameRef.current;
    if (phaseRef.current !== "playing" || !state || state.finished || state.stun > 0) {
      return;
    }
    state.lane = clamp(state.lane + direction, 0, 2);
  }, []);

  const startSequence = useCallback(() => {
    if (!assetsReady) return;
    schoolAudio.unlock();
    onStart();
    setResult(null);
    setHud(initialHud);
    setPhase("spray");
  }, [assetsReady, onStart]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        moveLane(-1);
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        moveLane(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveLane]);

  useEffect(() => {
    if (phase !== "playing") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const state: GameState = {
      lane: 1,
      laneVisual: 1,
      speed: 0,
      distance: 0,
      elapsed: 0,
      stun: 0,
      invincible: 0,
      hits: 0,
      obstacles: [],
      nextSpawn: 0.75,
      obstacleId: 0,
      finished: false,
      flash: 0,
      shake: 0,
      lastFrame: performance.now(),
      lastHud: 0,
    };
    gameRef.current = state;
    schoolAudio.startMusic();

    const finish = (completed: boolean) => {
      if (state.finished) return;
      state.finished = true;
      const durationMs = Math.round(
        Math.min(GAME_RULES.timeLimitSeconds * 1000, state.elapsed * 1000),
      );
      const run = {
        distance: completed
          ? GAME_RULES.goalDistance
          : Math.floor(Math.min(state.distance, GAME_RULES.goalDistance - 1)),
        durationMs,
        hits: state.hits,
        completed,
      };
      const finalResult: RunResult = {
        ...run,
        score: calculateRunScore(run),
      };
      setHud({
        timeLeft: GAME_RULES.timeLimitSeconds - state.elapsed,
        distance: run.distance,
        speed: state.speed,
        hits: state.hits,
      });
      setResult(finalResult);
      schoolAudio.stopMusic();
      schoolAudio.cue(completed ? "success" : "fail");
      onFinish(finalResult);
      setPhase(completed ? "success" : "failed");
    };

    const spawnObstacles = () => {
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      const kinds: ObstacleKind[] = ["desk", "chair", "bin", "wet"];
      const first: Obstacle = {
        id: state.obstacleId,
        lane: lanes[0],
        z: SPAWN_DISTANCE,
        kind: kinds[state.obstacleId % kinds.length],
      };
      state.obstacleId += 1;
      state.obstacles.push(first);

      if (state.elapsed > 11 && Math.random() < 0.32) {
        const second: Obstacle = {
          id: state.obstacleId,
          lane: lanes[1],
          z: SPAWN_DISTANCE + 2 + Math.random() * 4,
          kind: kinds[state.obstacleId % kinds.length],
        };
        state.obstacleId += 1;
        state.obstacles.push(second);
      }

      const urgency = clamp(state.elapsed / GAME_RULES.timeLimitSeconds, 0, 1);
      state.nextSpawn = 1.35 - urgency * 0.38 + Math.random() * 0.34;
    };

    const registerHit = (obstacleIndex: number) => {
      state.obstacles.splice(obstacleIndex, 1);
      state.hits += 1;
      state.stun = GAME_RULES.stunSeconds;
      state.invincible = 1.8;
      state.speed = 0;
      state.flash = 0.7;
      state.shake = 10;
      schoolAudio.cue("hit");
    };

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0, (now - state.lastFrame) / 1000));
      state.lastFrame = now;
      state.elapsed += dt;

      if (state.stun > 0) {
        state.stun = Math.max(0, state.stun - dt);
      } else {
        const topSpeed = Math.max(
          GAME_RULES.minimumTopSpeed,
          GAME_RULES.baseTopSpeed - state.hits * GAME_RULES.hitTopSpeedPenalty,
        );
        const acceleration = Math.max(
          GAME_RULES.minimumAcceleration,
          GAME_RULES.baseAcceleration -
            state.hits * GAME_RULES.hitAccelerationPenalty,
        );
        state.speed = Math.min(topSpeed, state.speed + acceleration * dt);
        state.distance += state.speed * dt;
      }

      state.invincible = Math.max(0, state.invincible - dt);
      state.flash = Math.max(0, state.flash - dt * 1.7);
      state.shake = Math.max(0, state.shake - dt * 18);
      state.laneVisual += (state.lane - state.laneVisual) * Math.min(1, dt * 13);

      state.nextSpawn -= dt;
      if (state.nextSpawn <= 0) spawnObstacles();

      for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
        const obstacle = state.obstacles[index];
        obstacle.z -= state.speed * dt;
        if (obstacle.z < -4) {
          state.obstacles.splice(index, 1);
          continue;
        }
        if (
          state.stun <= 0 &&
          state.invincible <= 0 &&
          obstacle.lane === state.lane &&
          obstacle.z < 3.2 &&
          obstacle.z > -1.5
        ) {
          registerHit(index);
        }
      }

      drawGame(ctx, canvas, state, imagesRef.current);

      if (now - state.lastHud > 90) {
        state.lastHud = now;
        setHud({
          timeLeft: GAME_RULES.timeLimitSeconds - state.elapsed,
          distance: Math.floor(state.distance),
          speed: state.speed,
          hits: state.hits,
        });
      }

      if (state.distance >= GAME_RULES.goalDistance) {
        finish(true);
        return;
      }
      if (state.elapsed >= GAME_RULES.timeLimitSeconds) {
        finish(false);
        return;
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      schoolAudio.stopMusic();
    };
  }, [phase, onFinish]);

  useEffect(
    () => () => {
      schoolAudio.stopMusic();
    },
    [],
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    schoolAudio.setMuted(next);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 24) return;
    moveLane(delta > 0 ? 1 : -1);
  };

  const progress = clamp(
    (hud.distance / GAME_RULES.goalDistance) * 100,
    0,
    100,
  );

  return (
    <div
      ref={stageRef}
      className="game-stage"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="School Dash playable runner"
    >
      <canvas ref={canvasRef} className="game-canvas" />

      {phase === "idle" && (
        <div className="screen-panel absolute inset-0 z-20">
          <img src={ASSETS.corridor} alt="School corridor" className="game-photo" draggable={false} />
          <div className="photo-shade" />
          <img
            src={ASSETS.runner}
            alt="Runner sprite"
            className="absolute bottom-[-2%] left-1/2 z-10 w-[42%] max-w-56 -translate-x-1/2 image-rendering-pixelated"
            draggable={false}
          />
          <div className="absolute inset-x-0 top-0 p-5 sm:p-7">
            <div className="sticker-label font-pixel text-[10px] sm:text-xs">
              LOW-FI SCHOOL RUNNER
            </div>
            <h1 className="font-pixel mt-5 max-w-[10ch] text-3xl leading-relaxed text-[#faf9ea] sm:text-5xl">
              SCHOOL DASH
            </h1>
            <p className="mt-4 max-w-sm text-sm font-extrabold text-[#faf9ea] sm:text-base">
              500 metres. 60 seconds. Dodge classroom chaos, keep your speed,
              and reach the corridor door before the bell.
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 bg-[#11193b]/88 p-4 sm:p-5">
            <Button
              type="button"
              disabled={!assetsReady}
              onClick={startSequence}
              className="h-14 w-full rounded-none border-2 border-[#11193b] bg-[#ffdf2b] font-pixel text-xs text-[#11193b] shadow-[5px_5px_0_#faf9ea] hover:bg-[#feadd2] disabled:opacity-60 sm:text-sm"
            >
              {assetsReady ? "START RUN" : "LOADING ASSETS"}
            </Button>
            <p className="mt-3 text-center text-xs font-bold text-[#faf9ea]">
              Arrow keys / A D / swipe or use the big lane buttons.
            </p>
          </div>
        </div>
      )}

      {phase === "spray" && (
        <IntroScreen
          image={ASSETS.spray}
          kicker="STEP 01 / SPRAY"
          title="LEAVE YOUR MARK"
          body="One quiet moment under the desk. Then the run begins."
        />
      )}

      {phase === "caught" && (
        <IntroScreen
          image={ASSETS.caught}
          kicker="STEP 02 / CAUGHT"
          title="SPOTTED!"
          body="No time to explain. Move."
          danger
        />
      )}

      {phase === "runup" && (
        <div className="screen-panel absolute inset-0 z-20">
          <img src={ASSETS.runup} alt="Classroom run-up" className="game-photo" draggable={false} />
          <div className="speed-lines" />
          <img src={ASSETS.runner} alt="" className="runup-sprite" draggable={false} />
          <div className="absolute inset-x-0 top-0 p-5 sm:p-7">
            <div className="sticker-label font-pixel text-[10px] sm:text-xs">
              STEP 03 / RUN-UP
            </div>
            <h2 className="font-pixel mt-4 text-2xl leading-relaxed text-[#11193b] sm:text-4xl">
              GET READY
            </h2>
          </div>
          <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 border-2 border-[#11193b] bg-[#faf9ea] px-4 py-3 font-pixel text-xs text-[#11193b] shadow-[4px_4px_0_#11193b]">
            RUN!
          </div>
        </div>
      )}

      {phase === "playing" && (
        <>
          <div className="absolute inset-x-3 top-3 z-40 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="hud-chip px-3 py-2">
              <div className="font-pixel text-[8px]">TIME</div>
              <div className="hud-number font-pixel mt-2 text-sm">
                {formatSeconds(hud.timeLeft)}
              </div>
            </div>
            <div className="hud-chip px-3 py-2">
              <div className="font-pixel text-[8px]">DIST</div>
              <div className="hud-number font-pixel mt-2 text-sm">
                {Math.floor(hud.distance)}m
              </div>
            </div>
            <div className="hud-chip px-3 py-2">
              <div className="font-pixel text-[8px]">SPEED</div>
              <div className="hud-number font-pixel mt-2 text-sm">
                {hud.speed.toFixed(1)}
              </div>
            </div>
            <div className="hud-chip px-3 py-2">
              <div className="font-pixel text-[8px]">HITS</div>
              <div className="hud-number font-pixel mt-2 text-sm">{hud.hits}</div>
            </div>
          </div>

          <div className="absolute inset-x-3 top-[166px] z-40 sm:top-[78px]">
            <div className="mb-1 flex items-center justify-between font-pixel text-[8px] text-[#faf9ea]">
              <span>OBJECTIVE</span>
              <span>{GAME_RULES.goalDistance}m</span>
            </div>
            <div className="objective-meter h-5">
              <div style={{ width: `${progress}%` }} className="h-full" />
            </div>
          </div>

          <button
            type="button"
            onClick={toggleMute}
            className="hud-chip absolute right-3 top-[220px] z-40 flex h-11 w-11 items-center justify-center sm:top-[126px]"
            aria-label={muted ? "Unmute audio" : "Mute audio"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          {hud.hits >= 2 && (
            <div className="absolute left-1/2 top-[224px] z-40 -translate-x-1/2 border-2 border-[#11193b] bg-[#feadd2] px-3 py-2 font-pixel text-[8px] text-[#11193b] shadow-[3px_3px_0_#11193b] sm:top-[132px]">
              ONE MORE HIT = TOO SLOW
            </div>
          )}

          <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-end justify-between px-4">
            <button
              type="button"
              className="lane-button"
              onPointerDown={(event) => {
                event.preventDefault();
                moveLane(-1);
              }}
              aria-label="Move left"
            >
              ←
            </button>
            <div className="pb-1 text-center font-pixel text-[8px] text-[#faf9ea]">
              SWIPE / ARROWS
            </div>
            <button
              type="button"
              className="lane-button"
              onPointerDown={(event) => {
                event.preventDefault();
                moveLane(1);
              }}
              aria-label="Move right"
            >
              →
            </button>
          </div>
        </>
      )}

      {(phase === "success" || phase === "failed") && (
        <div className="screen-panel absolute inset-0 z-30">
          <img
            src={phase === "success" ? ASSETS.finish : ASSETS.caught}
            alt={phase === "success" ? "Finish corridor" : "Caught"}
            className="game-photo result-photo"
            draggable={false}
          />
          <div className="photo-shade" />
          <div className="absolute inset-x-0 bottom-0 bg-[#11193b]/90 p-4 text-[#faf9ea] sm:p-6">
            <div
              className={cn(
                "sticker-label font-pixel text-[10px]",
                phase === "failed" && "bg-[#feadd2]",
              )}
            >
              {phase === "success" ? "OBJECTIVE REACHED" : "TIME UP"}
            </div>
            <h2 className="font-pixel mt-4 text-xl leading-relaxed sm:text-3xl">
              {phase === "success" ? "YOU MADE IT" : "NOT THIS TIME"}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="border border-[#faf9ea]/50 p-2">
                <div className="font-pixel text-[7px] text-[#feadd2]">DIST</div>
                <div className="font-pixel mt-2 text-xs">{result?.distance ?? 0}m</div>
              </div>
              <div className="border border-[#faf9ea]/50 p-2">
                <div className="font-pixel text-[7px] text-[#feadd2]">TIME</div>
                <div className="font-pixel mt-2 text-xs">
                  {formatResultTime(result?.durationMs ?? 0)}
                </div>
              </div>
              <div className="border border-[#faf9ea]/50 p-2">
                <div className="font-pixel text-[7px] text-[#feadd2]">HITS</div>
                <div className="font-pixel mt-2 text-xs">{result?.hits ?? 0}</div>
              </div>
              <div className="border border-[#faf9ea]/50 p-2">
                <div className="font-pixel text-[7px] text-[#feadd2]">SCORE</div>
                <div className="font-pixel mt-2 text-xs">{result?.score ?? 0}</div>
              </div>
            </div>
            <div className="mt-3 min-h-6 text-xs font-bold text-[#ffdf2b]">
              {saveState === "saving" && "Saving run to the leaderboard..."}
              {saveState === "saved" && "Run saved to the leaderboard."}
              {saveState === "guest" &&
                "Guest run complete. Sign in before a run to save it."}
              {saveState === "error" && "The run could not be saved. Try again."}
              {saveState === "idle" && !isAuthenticated && "Sign in to save future runs."}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={startSequence}
                className="h-12 rounded-none border-2 border-[#11193b] bg-[#ffdf2b] font-pixel text-[10px] text-[#11193b] hover:bg-[#feadd2]"
              >
                RETRY
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onStart();
                  setResult(null);
                  setHud(initialHud);
                  setPhase("idle");
                }}
                className="h-12 rounded-none border-2 border-[#faf9ea] bg-transparent font-pixel text-[10px] text-[#faf9ea] hover:bg-[#faf9ea] hover:text-[#11193b]"
              >
                TITLE
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
