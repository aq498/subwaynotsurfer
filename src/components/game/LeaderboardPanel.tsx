import { Link } from "react-router";
import { Trophy, History, LogIn } from "lucide-react";
import { trpc } from "@/providers/trpc";

function formatRunTime(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function LeaderboardPanel({
  isAuthenticated,
  isAuthLoading,
}: {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}) {
  const leaderboard = trpc.runs.leaderboard.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const mine = trpc.runs.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <div className="space-y-6">
      <section className="border-2 border-[#11193b] bg-[#faebc5] p-4 shadow-[6px_6px_0_#11193b]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-pixel text-[9px] text-[#11193b]">GLOBAL BOARD</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Top runs</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#11193b] bg-[#ffdf2b] shadow-[3px_3px_0_#11193b]">
            <Trophy className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {leaderboard.isLoading && (
            <div className="border border-[#11193b]/30 bg-[#faf9ea] p-3 text-sm font-bold">
              Loading leaderboard...
            </div>
          )}
          {leaderboard.error && (
            <div className="border border-[#11193b] bg-[#feadd2] p-3 text-sm font-bold">
              Leaderboard unavailable right now.
            </div>
          )}
          {!leaderboard.isLoading && leaderboard.data?.length === 0 && (
            <div className="border border-dashed border-[#11193b]/50 bg-[#faf9ea] p-4 text-sm font-bold">
              No saved runs yet. Be the first to reach 500m.
            </div>
          )}
          {leaderboard.data?.map((run, index) => (
            <div
              key={run.id}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-2 border-[#11193b] bg-[#faf9ea] p-2"
            >
              <div className="font-pixel text-xs text-[#11193b]">{index + 1}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">
                  {run.userName?.trim() || "Student"}
                </div>
                <div className="mt-1 text-xs font-bold text-[#11193b]/70">
                  {run.completed ? "Finished" : "Timed out"} · {run.distance}m ·{" "}
                  {run.hits} hits
                </div>
              </div>
              <div className="text-right">
                <div className="font-pixel text-[10px]">{run.score}</div>
                <div className="mt-1 text-[11px] font-bold text-[#11193b]/60">
                  {formatRunTime(run.durationMs)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-2 border-[#11193b] bg-[#faf9ea] p-4 shadow-[6px_6px_0_#11193b]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-pixel text-[9px]">RUN HISTORY</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Your saves</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#11193b] bg-[#feadd2] shadow-[3px_3px_0_#11193b]">
            <History className="h-6 w-6" />
          </div>
        </div>

        {!isAuthenticated && !isAuthLoading && (
          <div className="mt-4 border border-dashed border-[#11193b]/50 p-4">
            <p className="text-sm font-bold text-[#11193b]/75">
              Play as a guest, or sign in to save runs and appear on the board.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex min-h-11 items-center gap-2 border-2 border-[#11193b] bg-[#ffdf2b] px-4 text-sm font-black shadow-[3px_3px_0_#11193b]"
            >
              <LogIn className="h-4 w-4" />
              Sign in to save
            </Link>
          </div>
        )}

        {isAuthenticated && (
          <div className="mt-4 space-y-2">
            {mine.isLoading && (
              <div className="border border-[#11193b]/30 p-3 text-sm font-bold">
                Loading your runs...
              </div>
            )}
            {mine.data?.length === 0 && (
              <div className="border border-dashed border-[#11193b]/50 p-4 text-sm font-bold">
                No saved runs yet. Finish a run and it will appear here.
              </div>
            )}
            {mine.data?.map((run) => (
              <div key={run.id} className="border border-[#11193b]/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-pixel text-[9px]">
                    {run.completed ? "CLEAR" : "MISS"}
                  </div>
                  <div className="text-xs font-bold text-[#11193b]/60">
                    {formatDate(run.createdAt)}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs font-black">
                  <span>{run.distance}m</span>
                  <span>{formatRunTime(run.durationMs)}</span>
                  <span>{run.hits} hits</span>
                  <span>{run.score} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
