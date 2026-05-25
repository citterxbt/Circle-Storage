/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useAptosWallet } from "../lib/aptos-wallet";
import { FileMetadata, DashboardStats } from "../types";
import { HardDrive, Wallet, Shield, Download, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function DashboardPage() {
  const { address, connected } = useAptosWallet();
  const [stats, setStats] = useState<DashboardStats>({ filesUploadedCount: 0, totalEarnings: 0 });
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (connected && address) {
      fetchDashboardData();
    }
  }, [connected, address]);

  const fetchDashboardData = async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Async fetch stats
      const statsRes = await fetch(`/api/stats/${address}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch uploaded files lists
      const filesRes = await fetch(`/api/files?uploader=${address}`);
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    if (!address) return;
    setDownloadingId(fileId);
    try {
      const res = await fetch("/api/files/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file_id: fileId,
          wallet_address: address
        })
      });

      if (res.ok) {
        const filePackage = await res.json();
        const base64Content = filePackage.data;
        const contentType = filePackage.content_type || "application/octet-stream";
        
        // Convert Base64 to Blob
        const sliceSize = 512;
        const byteCharacters = atob(base64Content);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
          const slice = byteCharacters.slice(offset, offset + sliceSize);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        const url = URL.createObjectURL(blob);
        
        // Create an anchor and click it to trigger native browser download
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const errDetails = await res.json();
        alert(errDetails.message || "Failed to download file.");
      }
    } catch (err) {
      console.error("Downloader interface encountered error", err);
      alert("Encountered connection error while fetching secure file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-black/35 border border-white/10 rounded-3xl p-10 text-center shadow-xl" id="dashboard-unconnected-view">
        <HardDrive className="w-16 h-16 text-pink-500/70 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2 font-sans">Connect Wallet to Open Dashboard</h3>
        <p className="text-sm text-white/60 max-w-sm mb-6 font-sans leading-relaxed">
          To manage your uploaded assets and view your sales ledger, please connect an active Aptos wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10" id="dashboard-connected-view">
      {/* Top statistics banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-stats-grid">
        {/* Earnings Card */}
        <div className="bg-black/30 border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-white/40 tracking-wider">Total Sales Earnings</span>
            <div className="w-10 h-10 rounded-xl bg-pink-950/40 text-pink-400 flex items-center justify-center border border-pink-500/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-bold text-white tracking-tight flex items-baseline gap-2">
              {stats.totalEarnings.toFixed(2)} <span className="text-xs text-pink-400 uppercase font-bold font-sans">APT</span>
            </h3>
            <p className="text-xs text-white/50 mt-2 font-sans">Payouts routed directly to on-chain wallet address.</p>
          </div>
        </div>

        {/* Uploads Count Card */}
        <div className="bg-black/30 border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn" style={{ animationDelay: "100ms" }}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/8 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-white/40 tracking-wider">Files Registered</span>
            <div className="w-10 h-10 rounded-xl bg-amber-950/50 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-bold text-white tracking-tight flex items-baseline gap-2">
              {stats.filesUploadedCount} <span className="text-xs text-amber-400 uppercase font-bold font-sans">Leased</span>
            </h3>
            <p className="text-xs text-white/50 mt-2 font-sans">Active leases held on Shelby Testnet storage cluster.</p>
          </div>
        </div>

        {/* Access Gating Card */}
        <div className="bg-black/30 border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn" style={{ animationDelay: "200ms" }}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-white/40 tracking-wider">Storage Security</span>
            <div className="w-10 h-10 rounded-xl bg-rose-950/40 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-bold text-white tracking-tight flex items-baseline gap-2">
              100% <span className="text-xs text-rose-400 uppercase font-bold font-sans">Gated</span>
            </h3>
            <p className="text-xs text-white/50 mt-2 font-sans">Decrypting keys secured server-side. Zero leaked bytes.</p>
          </div>
        </div>
      </div>

      {/* User files listing table */}
      <div className="space-y-4" id="dashboard-uploads-ledger-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white font-sans">Your Shelby Upload Ledger</h3>
            <p className="text-xs text-white/60 font-sans">Select files below to retrieve and decrypt your source assets at any time without fee check.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs font-sans transition-all border border-white/10 shadow-md cursor-pointer"
          >
            Refresh Ledger
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-black/20 border border-white/10 rounded-2xl shadow-sm">
            <span className="text-white/45 font-mono animate-pulse">Consulting Shelby decentralized ledger indexes...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 bg-black/20 border border-white/10 rounded-2xl font-sans text-white/70 max-w-lg mx-auto p-6 flex flex-col items-center gap-3 shadow-md">
            <HardDrive className="w-10 h-10 text-pink-400/70" />
            <span className="font-bold text-white">No Registered Files Found</span>
            <p className="text-xs leading-relaxed text-white/50">You haven't uploaded any files to Circle Storage yet. Head to the 'Upload Asset' pane to lease your first slot!</p>
          </div>
        ) : (
          <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden shadow-lg" id="dashboard-uploads-table-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 font-mono text-white/50 uppercase tracking-wider text-[10px]">
                    <th className="p-4 sm:p-5">File Reference</th>
                    <th className="p-4 sm:p-5">Visibility</th>
                    <th className="p-4 sm:p-5">Lease Term</th>
                    <th className="p-4 sm:p-5 text-right font-semibold">Pricing (APT)</th>
                    <th className="p-4 sm:p-5 text-center font-semibold">Purchased</th>
                    <th className="p-4 sm:p-5 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-4 sm:p-5">
                        <div className="space-y-1">
                          <p className="font-bold text-white max-w-[200px] sm:max-w-xs truncate">{file.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-white/40 select-all font-semibold uppercase">{file.shelby_ref}</span>
                            <span className="text-[9px] text-white/30">•</span>
                            <span className="text-[10px] text-white/40 font-mono">{formatBytes(file.size)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5">
                        {file.visibility === "public" ? (
                          <div className="inline-flex items-center gap-1 text-pink-450 bg-pink-950/20 px-2.5 py-1 rounded-full border border-pink-500/25 text-[10px] font-bold uppercase text-pink-400">
                            <Eye className="w-3 h-3" />
                            Public
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-amber-450 bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-500/20 text-[10px] font-bold uppercase text-amber-400">
                            <EyeOff className="w-3 h-3" />
                            Private
                          </div>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 font-mono text-white/70">
                        {file.duration}
                      </td>
                      <td className="p-4 sm:p-5 text-right font-mono text-white font-bold">
                        {file.visibility === "private" ? (
                          <span className="text-white/20 italic text-xs">—</span>
                        ) : (
                          <>{file.price.toFixed(2)} APT</>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        {file.visibility === "private" ? (
                          <span className="text-white/20 italic text-xs">—</span>
                        ) : (
                          <span className="font-mono text-pink-400 bg-pink-950/20 border border-pink-500/20 px-2   py-0.5 rounded text-xs select-all">
                            {file.purchase_count || 0}x
                          </span>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        <button
                          id={`btn-dashboard-download-${file.id}`}
                          onClick={() => downloadFile(file.id, file.name)}
                          disabled={downloadingId === file.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-pink-500/30 text-white hover:text-pink-400 font-semibold font-sans text-xs rounded-lg cursor-pointer transition-all shadow-sm"
                          title="Decrypt & Download from Shelby"
                        >
                          {downloadingId === file.id ? (
                            <span className="animate-pulse">Retrieving...</span>
                          ) : (
                            <>
                              <Download className="w-3 h-3 text-pink-400" />
                              Download
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
