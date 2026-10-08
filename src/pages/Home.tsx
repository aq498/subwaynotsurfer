import { useCallback, useState } from "react";
import { Link } from "react-router";
import { LogIn, LogOut, Zap } from "lucide-react";
import { GAME_RULES } from "@contracts/game";
import { Button } from "@/components/ui/button";
import RunnerGame, {
  type RunResult,
  type SaveState,
} from "@/components/game/RunnerGame";
import LeaderboardPanel from "@/components/game/LeaderboardPanel";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import "../App.css";

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const utils = trpc.useUtils();

  const submitRun = trpc.runs.submit.useMutation({
    onSuccess: async () => {
      setSaveState("saved");
      await Promise.all([
        utils.runs.leaderboard.invalidate(),
        utils.runs.mine.invalidate(),
      ]);
    },
    onError: () => setSaveState("error"),
  });

  const resetSaveState = useCallback(() => {
    setSaveState("idle");
  }, []);

  const handleFinish = useCallback(
    (result: RunResult) => {
      if (!isAuthenticated) {
        setSaveState("guest");
        return;
      }
      setSaveState("saving");
      submitRun.mutate({
        distance: result.distance,
        durationMs: result.durationMs,
        hits: result.hits,
        completed: result.completed,
      });
    },
    [isAuthenticated, submitRun],
  );

  return (
    <div className="min-h-screen bg-[#faf9ea] pb-[max(1rem,env(safe-area-inset-bottom))] text-[#11193b]">
      <header className="border-b-2 border-[#11193b]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-[#11193b] bg-[#ffdf2b] font-pixel text-xs shadow-[3px_3px_0_#11193b]">
              SD
            </div>
            <div className="min-w-0">
              <div className="font-pixel text-[9px] sm:text-[10px]">SCHOOL DASH</div>
              <div className="mt-1 truncate text-sm font-bold text-[#11193b]/65">
                classroom edition
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLoading ? (
              <div className="h-11 border-2 border-[#11193b]/20 bg-[#faebc5] px-4 py-3 text-xs font-black">
                Checking...
              </div>
            ) : isAuthenticated && user ? (
              <>
                <div className="hidden min-h-11 items-center gap-2 border-2 border-[#11193b] bg-[#faf9ea] px-3 text-sm font-black sm:flex">
                  <span className="auth-dot" aria-hidden="true" />
                  <span className="max-w-36 truncate">{user.name || "Student"}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={logout}
                  className="min-h-11 rounded-none border-2 border-[#11193b] bg-[#faf9ea] px-3 font-black shadow-[3px_3px_0_#11193b] hover:bg-[#feadd2]"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center gap-2 border-2 border-[#11193b] bg-[#ffdf2b] px-4 text-sm font-black shadow-[3px_3px_0_#11193b]"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="marquee-strip font-pixel py-2 text-[8px] sm:text-[9px]" aria-hidden="true">
        <span>
          60 SECONDS · 500M OBJECTIVE · 1 SECOND STUN · SPEED RESET · 3 HITS TOO
          SLOW · LOW-FI PHOTOS · SCHOOL DASH ·
        </span>
      </div>

      <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-8">
        <section className="min-w-0">
          <RunnerGame
            onStart={resetSaveState}
            onFinish={handleFinish}
            saveState={saveState}
            isAuthenticated={isAuthenticated}
          />
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="border-2 border-[#11193b] bg-[#faf9ea] p-4 shadow-[6px_6px_0_#11193b]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-pixel text-[9px]">RUN BRIEF</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Reach the door
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center border-2 border-[#11193b] bg-[#ffdf2b] shadow-[3px_3px_0_#11193b]">
                <Zap className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-[2.5rem_1fr] gap-3 border-t-2 border-[#11193b] pt-3">
                <div className="font-pixel text-xs">01</div>
                <p className="text-sm font-bold leading-6">
                  Travel {GAME_RULES.goalDistance}m in{" "}
                  {GAME_RULES.timeLimitSeconds} seconds. A clean run finishes early;
                  every crash eats your pace.
                </p>
              </div>
              <div className="grid grid-cols-[2.5rem_1fr] gap-3 border-t-2 border-[#11193b] pt-3">
                <div className="font-pixel text-xs">02</div>
                <p className="text-sm font-bold leading-6">
                  An obstacle stuns you for {GAME_RULES.stunSeconds} second, resets
                  speed to zero, and lowers the pace you can rebuild.
                </p>
              </div>
              <div className="grid grid-cols-[2.5rem_1fr] gap-3 border-t-2 border-[#11193b] pt-3">
                <div className="font-pixel text-xs">03</div>
                <p className="text-sm font-bold leading-6">
                  Two hits are recoverable. Three or more make the 500m objective
                  effectively out of reach.
                </p>
              </div>
            </div>
          </section>

          <LeaderboardPanel
            isAuthenticated={isAuthenticated}
            isAuthLoading={isLoading}
          />
        </aside>
      </main>
    </div>
  );
}
