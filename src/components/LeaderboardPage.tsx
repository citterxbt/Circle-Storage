/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { LeaderboardRow } from "../types";
import { Trophy, HardDrive, Coins, ExternalLink, ArrowUpRight } from "lucide-react";

export default function LeaderboardPage() {
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
      }
    } catch (err) {
      console.error("Failed to load leaderboard indexes", err);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => {
    return addr.slice(0, 6) + "..." + addr.slice(-6);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn" id="leaderboard-root-view">
      {/* Title Header */}
      <div>
        <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
          Aptos Storage Leaderboard
        </h3>
        <p className="text-xs text-white/60 font-sans mt-1">Ranked by total rewards earned from decentralized file leasing sales on Shelby Testnet.</p>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-black/20 border border-white/10 rounded-2xl shadow-sm">
          <span className="text-white/40 font-mono animate-pulse">Running map-reduce matrix aggregations on Aptos storage hashes...</span>
        </div>
      ) : board.length === 0 ? (
        <div className="text-center py-20 bg-black/20 border border-white/10 rounded-3xl p-6 text-white/70 font-sans shadow-sm">
          No active web3 brokers registered on leaderboard indexes.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 3 Brokers Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="leaderboard-podiums">
            {board.slice(0, 3).map((broker, index) => {
              const bgColors = [
                "from-amber-950/40 via-black/30 to-black/50 border-amber-500/30 shadow-lg shadow-amber-500/5",
                "from-pink-950/40 via-black/30 to-black/50 border-pink-500/25 shadow-md",
                "from-rose-955/35 from-rose-950/30 via-black/30 to-black/50 border-rose-500/20 shadow-md"
              ];
              const badges = ["🏆 1st Broker", "🥈 2nd Broker", "🥉 3rd Broker"];

              return (
                <div
                  key={broker.wallet_address}
                  className={`bg-gradient-to-b ${bgColors[index]} border p-6 rounded-2xl relative overflow-hidden flex flex-col items-center text-center gap-3`}
                >
                  <span className="text-[10px] font-mono select-none px-2.5 py-0.5 rounded-full border border-pink-500/20 bg-pink-950/50 font-bold tracking-wide uppercase text-pink-300 shadow-sm">
                    {badges[index]}
                  </span>
                  
                  <img
                    src={broker.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${broker.wallet_address}`}
                    alt={broker.username}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl border border-white/10 bg-black/40 p-1 object-cover mt-2 shadow-inner"
                  />

                  <div className="space-y-1 mt-1">
                    <p className="font-bold text-white font-sans max-w-[150px] truncate">{broker.username}</p>
                    <p className="text-[10px] text-white/40 font-mono select-all uppercase">{truncateAddress(broker.wallet_address)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full pt-4 mt-2 border-t border-white/10">
                    <div className="text-left space-y-1">
                      <span className="text-[9px] text-white/40 uppercase font-mono block">Files</span>
                      <span className="text-sm font-bold text-white font-mono flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-pink-400" />
                        {broker.total_uploads}
                      </span>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-[9px] text-white/40 uppercase font-mono block">Rewards</span>
                      <span className="text-sm font-bold text-amber-400 font-mono flex items-center justify-end gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        {broker.total_earnings.toFixed(1)} APT
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table list rankings */}
          <div className="bg-black/30 border border-white/10 rounded-3xl overflow-hidden shadow-lg" id="leaderboard-table-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 font-mono text-white/50 uppercase tracking-wider text-[10px]">
                    <th className="p-4 sm:p-5 text-center w-16 font-semibold">Rank</th>
                    <th className="p-4 sm:p-5 font-semibold">Broker Profile</th>
                    <th className="p-4 sm:p-5 text-center font-semibold">Uploaded Assets</th>
                    <th className="p-4 sm:p-5 text-right w-44 font-semibold">Sales Revenue (APT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {board.map((broker, index) => (
                    <tr key={broker.wallet_address} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-4 sm:p-5 text-center font-mono text-sm font-bold text-white/80">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                      </td>
                      <td className="p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={broker.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${broker.wallet_address}`}
                            alt={broker.username}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg border border-white/10 bg-black/40 p-0.5 object-cover shadow-sm"
                          />
                          <div>
                            <p className="font-bold text-white max-w-[124px] sm:max-w-xs truncate">{broker.username}</p>
                            <span className="text-[10px] text-white/40 font-mono font-semibold select-all uppercase">{broker.wallet_address}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 text-white/80 font-mono text-xs font-semibold">
                          <HardDrive className="w-3.5 h-3.5 text-pink-400" />
                          {broker.total_uploads}
                        </div>
                      </td>
                      <td className="p-4 sm:p-5 text-right font-mono font-bold text-amber-400">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Coins className="w-4 h-4 text-amber-400" />
                          {broker.total_earnings.toFixed(2)} APT
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
