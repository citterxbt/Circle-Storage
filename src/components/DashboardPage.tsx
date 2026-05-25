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
      <div className="flex flex-col items-center justify-center py-20 bg-slate-900/10 border border-slate-900 rounded-3xl p-10 text-center" id="dashboard-unconnected-view">
        <HardDrive className="w-16 h-16 text-slate-700 mb-4" />
        <h3 className="text-xl font-medium text-white mb-2 font-sans">Connect Wallet to Open Dashboard</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-6 font-sans">
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
        <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">Total Sales Earnings</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-medium text-white tracking-tight flex items-baseline gap-2">
              {stats.totalEarnings.toFixed(2)} <span className="text-xs text-cyan-400 uppercase font-bold font-sans">APT</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-sans">Payouts routed directly to on-chain wallet address.</p>
          </div>
        </div>

        {/* Uploads Count Card */}
        <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">Files Registered</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-medium text-white tracking-tight flex items-baseline gap-2">
              {stats.filesUploadedCount} <span className="text-xs text-indigo-400 uppercase font-bold font-sans">Leased</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-sans">Active leases held on Shelby Testnet storage cluster.</p>
          </div>
        </div>

        {/* Access Gating Card */}
        <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">Storage Security</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-4xl font-mono font-medium text-white tracking-tight flex items-baseline gap-2">
              100% <span className="text-xs text-purple-400 uppercase font-bold font-sans">Gated</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-sans">Decrypting keys secured server-side. Zero leaked bytes.</p>
          </div>
        </div>
      </div>

      {/* User files listing table */}
      <div className="space-y-4" id="dashboard-uploads-ledger-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-white font-sans">Your Shelby Upload Ledger</h3>
            <p className="text-xs text-slate-400 font-sans">Select files below to retrieve and decrypt your source assets at any time without fee check.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-mono transition-colors border border-slate-800 cursor-pointer"
          >
            Refresh Ledger
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-slate-900/5 border border-slate-900 rounded-2xl">
            <span className="text-slate-500 font-mono animate-pulse">Consulting Shelby decentralized ledger indexes...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/10 border border-slate-900 rounded-2xl font-sans text-slate-400 max-w-lg mx-auto p-6 flex flex-col items-center gap-3">
            <HardDrive className="w-10 h-10 text-slate-700" />
            <span className="font-semibold text-white">No Registered Files Found</span>
            <p className="text-xs leading-relaxed text-slate-400">You haven't uploaded any files to Circle Storage yet. Head to the 'Upload' pane to secure your first file on-chain!</p>
          </div>
        ) : (
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden" id="dashboard-uploads-table-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-900 font-mono text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="p-4 sm:p-5">File Reference</th>
                    <th className="p-4 sm:p-5">Visibility</th>
                    <th className="p-4 sm:p-5">Lease Term</th>
                    <th className="p-4 sm:p-5 text-right">Pricing (APT)</th>
                    <th className="p-4 sm:p-5 text-center">Purchased</th>
                    <th className="p-4 sm:p-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950/60">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="p-4 sm:p-5">
                        <div className="space-y-1">
                          <p className="font-medium text-white max-w-[200px] sm:max-w-xs truncate">{file.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 select-all font-semibold uppercase">{file.shelby_ref}</span>
                            <span className="text-[9px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500 font-mono">{formatBytes(file.size)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5">
                        {file.visibility === "public" ? (
                          <div className="inline-flex items-center gap-1 text-cyan-400 bg-cyan-500/5 px-2.5 py-1 rounded-full border border-cyan-500/20 text-[10px] font-medium uppercase">
                            <Eye className="w-3 h-3" />
                            Public
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-purple-400 bg-purple-500/5 px-2.5 py-1 rounded-full border border-purple-500/20 text-[10px] font-medium uppercase">
                            <EyeOff className="w-3 h-3" />
                            Private
                          </div>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 font-mono text-slate-300">
                        {file.duration}
                      </td>
                      <td className="p-4 sm:p-5 text-right font-mono text-white font-medium">
                        {file.visibility === "private" ? (
                          <span className="text-slate-500 italic text-xs">—</span>
                        ) : (
                          <>{file.price.toFixed(2)} APT</>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        {file.visibility === "private" ? (
                          <span className="text-slate-500 italic text-xs">—</span>
                        ) : (
                          <span className="font-mono text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 px-2 py-0.5 rounded text-xs select-all">
                            {file.purchase_count || 0}x
                          </span>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        <button
                          id={`btn-dashboard-download-${file.id}`}
                          onClick={() => downloadFile(file.id, file.name)}
                          disabled={downloadingId === file.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-sans text-xs rounded-lg cursor-pointer transition-colors"
                          title="Decrypt & Download from Shelby"
                        >
                          {downloadingId === file.id ? (
                            <span className="animate-pulse">Retrieving...</span>
                          ) : (
                            <>
                              <Download className="w-3 h-3 text-cyan-400" />
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
