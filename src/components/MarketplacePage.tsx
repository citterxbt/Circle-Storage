/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useAptosWallet } from "../lib/aptos-wallet";
import { FileMetadata } from "../types";
import { Coins, Download, ShieldCheck, Lock, Search, RefreshCw, Layers, Calendar, User, Eye } from "lucide-react";

export default function MarketplacePage() {
  const { address, connected, balance, signAndSubmitTransaction } = useAptosWallet();
  const [fileList, setFileList] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Tracks verified purchases made in the current user session
  const [ownedFileIds, setOwnedFileIds] = useState<string[]>([]);

  useEffect(() => {
    fetchMarketplaceFiles();
  }, [address]);

  const fetchMarketplaceFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setFileList(data);
      }

      // Ask the server which files this wallet has actually paid for, so unlocked state
      // survives a reload instead of living only in this component's memory.
      if (address) {
        const purchasesRes = await fetch("/api/purchases");
        if (purchasesRes.ok) {
          const { file_ids } = await purchasesRes.json();
          setOwnedFileIds(Array.isArray(file_ids) ? file_ids : []);
        }
      }
    } catch (err) {
      console.error("Failed to load marketplace files", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (file: FileMetadata) => {
    if (!connected || !address) {
      alert("Please connect an Aptos wallet in the top bar before initiating purchase.");
      return;
    }

    if (address.toLowerCase() === file.uploader.toLowerCase()) {
      alert("You are the owner of this file and have default full access rights on your dashboard.");
      return;
    }

    if (balance < file.price) {
      alert(`Sufficient funds required. This file requires ${file.price.toFixed(2)} APT, but your connected wallet balance is only ${balance.toFixed(2)} APT.`);
      return;
    }

    setPurchasingId(file.id);

    try {
      // Step 1: Fire direct Aptos Testnet peer-to-peer APT transfer payload to uploader wallet
      const txPayload = {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [file.uploader, Math.floor(file.price * 100000000)], // Octas multiplication for APT precision
        amount: file.price // Deductible pricing for Sandbox adapter
      };

      const result = await signAndSubmitTransaction(txPayload);
      console.log("Transaction successfully broadcasted. Transaction hash:", result.hash);

      // Step 2: Submit hash to our server database API for independent verification
      const verifyRes = await fetch("/api/files/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file_id: file.id,
          tx_hash: result.hash
        })
      });

      if (verifyRes.ok) {
        alert("Payment verified on-chain. File content is now unlocked for you.");
        setOwnedFileIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]));
        // Refresh listing so purchase counts are updated
        fetchMarketplaceFiles();
      } else {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || "Server failed to verify Aptos payment transaction.");
      }

    } catch (err: any) {
      console.error("Purchase payment lifecycle failed", err);
      alert(err.message || "On-chain payment process rejected or failed verification.");
    } finally {
      setPurchasingId(null);
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
          file_id: fileId
        })
      });

      if (res.ok) {
        const filePackage = await res.json();
        const base64Content = filePackage.data;
        const contentType = filePackage.content_type || "application/octet-stream";
        
        // Base64 decoding into downloadable blobs
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
        
        // Click action
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
      console.error("Download fetch failed", err);
      alert("Encountered server connection error while serving secure file.");
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

  const filteredFiles = fileList.filter((f) => {
    return (
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.shelby_ref.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn" id="marketplace-section">
      {/* Title & Filter rows - Premium Styling */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-500" />
            File Marketplace
          </h3>
          <p className="text-xs text-white/65 font-sans mt-1">Direct peer-to-peer decentralized file checkout backed by Aptos on-chain payment certificates.</p>
        </div>

        {/* Search Input bar */}
        <div className="flex items-center gap-2.5 max-w-sm w-full" id="marketplace-filters">
          <div className="relative flex-1 shadow-sm">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
            <input
              id="marketplace-search-field"
              type="text"
              placeholder="Search file name, hash or registry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 text-white placeholder-white/35 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={fetchMarketplaceFiles}
            className="p-3 bg-white/5 border border-white/10 text-white/60 hover:text-pink-400 hover:border-pink-500/20 hover:bg-white/10 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Refresh Listings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-black/20 border border-white/10 rounded-2xl shadow-sm">
          <span className="text-white/45 font-mono animate-pulse">Running smart indexing lookup on public Shelby nodes...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-20 bg-black/20 border border-white/10 rounded-3xl p-6 text-white/70 font-sans max-w-sm mx-auto flex flex-col items-center gap-2 shadow-sm">
          <span className="font-bold text-white">No Public Listings Found</span>
          <p className="text-xs text-white/50 leading-relaxed">No public files match your active filter coordinates, or no listings have been registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="marketplace-cards-grid">
          {filteredFiles.map((file) => {
            const isOwner = address && file.uploader.toLowerCase() === address.toLowerCase();
            const alreadyOwned = ownedFileIds.includes(file.id);

            return (
              <div
                key={file.id}
                className="bg-black/35 border border-white/10 p-6 rounded-2xl hover:border-pink-500/30 hover:shadow-lg hover:shadow-pink-500/5 transition-all flex flex-col justify-between h-[360px] relative overflow-hidden group shadow-md"
              >
                {/* Light accent orb */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/5 rounded-full blur-xl group-hover:bg-pink-500/10 transition-all"></div>

                <div className="space-y-4">
                  {/* File icon / Name details */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono select-none px-2 py-0.5 rounded border border-pink-500/20 bg-pink-950/40 font-bold uppercase text-pink-400 tracking-wider">
                      Shelby Anchor
                    </span>
                    <h4 className="text-sm font-sans font-bold text-white truncate max-w-full" title={file.name}>
                      {file.name}
                    </h4>
                    <p className="text-[10px] font-mono text-amber-400 truncate select-all">{file.shelby_ref}</p>
                  </div>

                  {/* Metadata line indicators */}
                  <div className="space-y-2 pt-3 border-t border-white/10 flex flex-col gap-1 text-[11px] text-white/60">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                      <span className="truncate">Broker: <span className="text-white font-semibold">{file.uploader.slice(0, 10)}...</span></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                      <span>Term Lease: <span className="text-white font-mono font-medium">{file.duration}</span></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                      <span>Volume size: <span className="text-white font-mono font-medium">{formatBytes(file.size)}</span></span>
                    </div>
                  </div>
                </div>

                {/* Bottom buyout section */}
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-left space-y-0.5">
                    <span className="text-[9px] uppercase font-mono text-white/40 font-semibold tracking-wider">Access Price</span>
                    <span className="text-base font-bold font-mono text-white flex items-center gap-1 leading-none">
                      <Coins className="w-4 h-4 text-amber-400" />
                      {file.price.toFixed(1)} <span className="text-[10px] text-amber-400 font-bold">APT</span>
                    </span>
                  </div>

                  {isOwner ? (
                    <span className="text-[11px] font-mono font-bold text-white/50 italic bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                      Broker Owner
                    </span>
                  ) : alreadyOwned ? (
                    <button
                      id={`btn-market-download-${file.id}`}
                      onClick={() => downloadFile(file.id, file.name)}
                      disabled={downloadingId === file.id}
                      className="px-4 py-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30 rounded-xl text-xs font-sans font-bold cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      {downloadingId === file.id ? (
                        <span className="animate-pulse">Retrieving...</span>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Unlocked
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      id={`btn-market-buy-${file.id}`}
                      onClick={() => handlePurchase(file)}
                      disabled={purchasingId === file.id}
                      className="px-4 py-2 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white rounded-xl text-xs font-sans font-bold cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-white/10"
                    >
                      {purchasingId === file.id ? (
                        <span className="animate-pulse">Locking...</span>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Unlock
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
