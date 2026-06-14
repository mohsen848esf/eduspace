import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import client from "../../../lib/api/client";
import Spinner from "../../../components/ui/Spinner";

interface LeaderboardEntry {
  username: string;
  full_name: string;
  game_points: number;
  assessment_points: number;
  total_score: number;
  rank: number;
}

export default function LeaderboardPage() {
  const { language } = useLocale();
  const [search, setSearch] = useState("");
  const isFarsi = language === "fa";
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", page],
    queryFn: async () => {
      const res = await client.get(`/games/leaderboard/?page=${page}`);
      return res.data;
    },
  });

  const leaderboardList: LeaderboardEntry[] = data
    ? Array.isArray(data)
      ? data
      : (data.results || [])
    : [];

  const filteredLeaderboard = leaderboardList.filter(
    (entry) =>
      entry.username.toLowerCase().includes(search.toLowerCase()) ||
      entry.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const topThree = page === 1 ? filteredLeaderboard.slice(0, 3) : [];


  // Styling helpers for top 3 podium
  const podiumStyles = [
    {
      bg: "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-yellow-500/20 border-yellow-300",
      badge: "🥇",
      title: isFarsi ? "رتبه اول" : "1st Place",
    },
    {
      bg: "bg-gradient-to-br from-slate-200 via-gray-300 to-slate-400 text-slate-900 shadow-slate-400/20 border-slate-200",
      badge: "🥈",
      title: isFarsi ? "رتبه دوم" : "2nd Place",
    },
    {
      bg: "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-amber-50 shadow-amber-700/20 border-amber-600",
      badge: "🥉",
      title: isFarsi ? "رتبه سوم" : "3rd Place",
    },
  ];

  return (
    <AppShell title={isFarsi ? "جدول امتیازات" : "Leaderboard"}>
      <div className="space-y-8 p-6 max-w-6xl mx-auto" dir={isFarsi ? "rtl" : "ltr"}>
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              {isFarsi ? "تالار افتخارات کلاس" : "Classroom Hall of Fame"}
            </h1>
            <p className="text-gray-400 mt-2">
              {isFarsi
                ? "رده‌بندی دانشجویان بر اساس امتیاز بازی‌های گروهی و تکالیف"
                : "Student rankings based on interactive game participation and graded assessments."}
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder={isFarsi ? "جستجو در دانشجوها..." : "Search students..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 2nd place on left, 1st place in middle, 3rd place on right */}
                {[
                  topThree[1] && { entry: topThree[1], index: 1 },
                  topThree[0] && { entry: topThree[0], index: 0 },
                  topThree[2] && { entry: topThree[2], index: 2 },
                ]
                  .filter(Boolean)
                  .map((item) => {
                    const { entry, index } = item!;
                    const style = podiumStyles[index];
                    return (
                      <div
                        key={entry.username}
                        className={`relative flex flex-col items-center justify-between p-6 rounded-2xl border backdrop-blur-md transition-all hover:scale-105 duration-300 ${style.bg}`}
                      >
                        <div className="absolute top-4 right-4 text-3xl">{style.badge}</div>
                        <div className="text-center mt-4">
                          <span className="text-xs uppercase tracking-wider font-semibold opacity-70">
                            {style.title}
                          </span>
                          <h3 className="text-xl font-bold mt-1 truncate max-w-[200px]">
                            {entry.full_name}
                          </h3>
                          <p className="text-xs opacity-60">@{entry.username}</p>
                        </div>
                        <div className="mt-6 text-center">
                          <span className="text-4xl font-extrabold">{entry.total_score}</span>
                          <span className="text-xs block opacity-70 mt-1">
                            {isFarsi ? "امتیاز کل" : "Total Points"}
                          </span>
                        </div>
                        <div className="mt-4 w-full border-t border-current/10 pt-4 flex justify-around text-xs opacity-80">
                          <div>
                            <span className="block font-bold">{entry.game_points}</span>
                            <span className="block text-[10px] opacity-75">{isFarsi ? "بازی‌ها" : "Games"}</span>
                          </div>
                          <div>
                            <span className="block font-bold">{entry.assessment_points}</span>
                            <span className="block text-[10px] opacity-75">{isFarsi ? "تکالیف" : "Tasks"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* General Leaderboard Table */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" dir={isFarsi ? "rtl" : "ltr"}>
                  <thead>
                    <tr className="bg-gray-900/80 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                      <th className="px-6 py-4 text-center w-20">{isFarsi ? "رتبه" : "Rank"}</th>
                      <th className="px-6 py-4">{isFarsi ? "دانشجو" : "Student"}</th>
                      <th className="px-6 py-4 text-center">{isFarsi ? "امتیاز بازی‌ها" : "Game Points"}</th>
                      <th className="px-6 py-4 text-center">{isFarsi ? "امتیاز تکالیف" : "Assessment Points"}</th>
                      <th className="px-6 py-4 text-right pr-10">{isFarsi ? "مجموع امتیازات" : "Total Score"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {filteredLeaderboard.map((entry) => (
                      <tr
                        key={entry.username}
                        className="hover:bg-gray-800/20 transition-colors duration-150 text-gray-300"
                      >
                        <td className="px-6 py-4 text-center font-bold text-gray-400">
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-white">{entry.full_name}</div>
                            <div className="text-xs text-gray-500">@{entry.username}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-purple-400">
                          {entry.game_points}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-pink-400">
                          {entry.assessment_points}
                        </td>
                        <td className="px-6 py-4 text-right pr-10 font-bold text-white text-base">
                          {entry.total_score}
                        </td>
                      </tr>
                    ))}
                    {filteredLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          {isFarsi ? "دانشجویی یافت نشد" : "No students found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Pagination Controls */}
            {data && !Array.isArray(data) && (data.next || data.previous) && (
              <div className="flex items-center justify-between mt-6 bg-gray-900/20 border border-gray-800/80 rounded-xl p-4 backdrop-blur-sm" dir={isFarsi ? "rtl" : "ltr"}>
                <button
                  disabled={!data.previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg text-purple-400 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-600/20 active:scale-95 transition-all text-xs"
                >
                  {isFarsi ? "صفحه قبلی" : "Previous Page"}
                </button>
                <span className="text-gray-400 text-sm font-medium">
                  {isFarsi ? `صفحه ${page}` : `Page ${page}`}
                </span>
                <button
                  disabled={!data.next}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg text-purple-400 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-600/20 active:scale-95 transition-all text-xs"
                >
                  {isFarsi ? "صفحه بعدی" : "Next Page"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
