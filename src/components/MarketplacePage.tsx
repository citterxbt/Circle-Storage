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
      const res = await fetch("/api/files?visibility=public");
      if (res.ok) {
        const data = await res.json();
        setFileList(data);

        // If a wallet is connected, check what files the user already own by verifying previous purchases
        if (address) {
          const ownedList: string[] = [];
          for (const f of data) {
            // Test if uploader is current user
            if (f.uploader.toLowerCase() === address.toLowerCase()) {
              ownedList.push(f.id);
            } else {
              // Try downloading metadata. If we get 200, we already have access!
              // Since the server gates download with a 403, we can check owners.
              // To avoid N+1 server loads, we will check if the user is registered in purchases database state on the server
            }
          }
          setOwnedFileIds(ownedList);
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
          buyer: address,
          tx_hash: result.hash,
          amount: file.price
        })
      });

      if (verifyRes.ok) {
        alert("Payment verified on-chain. Decrypted file content is now fully unlocked for you!");
        setOwnedFileIds((prev) => [...prev, file.id]);
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
          file_id: fileId,
          wallet_address: address
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
      {/* Title & Filter rows */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-medium text-white font-sans flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            File Marketplace
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">Direct peer-to-peer decentralized file checkout backed by Aptos on-chain payment certificates.</p>
        </div>

        {/* Search Input bar */}
        <div className="flex items-center gap-2 max-w-sm w-full" id="marketplace-filters">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              id="marketplace-search-field"
              type="text"
              placeholder="Search file name, hash or registry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-900/40 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-cyan-400 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={fetchMarketplaceFiles}
            className="p-3 bg-slate-900/60 border border-slate-900 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-xl transition-all cursor-pointer"
            title="Refresh Listings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-slate-900/5 border border-slate-900 rounded-2xl">
          <span className="text-slate-500 font-mono animate-pulse">Running smart indexing lookup on public Shelby nodes...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/10 border border-slate-900 rounded-3xl p-6 text-slate-400 font-sans max-w-sm mx-auto flex flex-col items-center gap-2">
          <span className="font-semibold text-white">No Public Listings Found</span>
          <p className="text-xs text-slate-500 leading-relaxed">No public files match your active filter coordinates, or no listings have been registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="marketplace-cards-grid">
          {filteredFiles.map((file) => {
            const isOwner = address && file.uploader.toLowerCase() === address.toLowerCase();
            const alreadyOwned = ownedFileIds.includes(file.id);

            return (
              <div
                key={file.id}
                className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl hover:border-slate-800 hover:bg-slate-900/40 transition-all flex flex-col justify-between h-[360px] relative overflow-hidden group"
              >
                {/* Light accent orb */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all"></div>

                <div className="space-y-4">
                  {/* File icon / Name details */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono select-none px-2 py-0.5 rounded border border-slate-800 bg-slate-950 font-bold uppercase text-slate-500 tracking-wider">
                      Shelby Anchor
                    </span>
                    <h4 className="text-sm font-sans font-semibold text-white truncate max-w-full" title={file.name}>
                      {file.name}
                    </h4>
                    <p className="text-[10px] font-mono text-cyan-400 truncate select-all">{file.shelby_ref}</p>
                  </div>

                  {/* Metadata line indicators */}
                  <div className="space-y-2 pt-3 border-t border-slate-950 flex flex-col gap-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <span className="truncate">Broker: <span className="text-slate-300 font-semibold">{file.uploader.slice(0, 10)}...</span></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <span>Term Lease: <span className="text-slate-300 font-mono font-medium">{file.duration}</span></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <span>Volume size: <span className="text-slate-300 font-mono font-medium">{formatBytes(file.size)}</span></span>
                    </div>
                  </div>
                </div>

                {/* Bottom buyout section */}
                <div className="pt-4 mt-4 border-t border-slate-950 flex items-center justify-between">
                  <div className="text-left space-y-0.5">
                    <span className="text-[9px] uppercase font-mono text-slate-500 font-semibold tracking-wider">Access Price</span>
                    <span className="text-base font-bold font-mono text-white flex items-center gap-1 leading-none">
                      <Coins className="w-4 h-4 text-cyan-400" />
                      {file.price.toFixed(1)} <span className="text-[10px] text-cyan-400 font-bold">APT</span>
                    </span>
                  </div>

                  {isOwner ? (
                    <span className="text-[11px] font-mono font-bold text-slate-500 italic bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-900">
                      Broker Owner
                    </span>
                  ) : alreadyOwned ? (
                    <button
                      id={`btn-market-download-${file.id}`}
                      onClick={() => downloadFile(file.id, file.name)}
                      disabled={downloadingId === file.id}
                      className="px-4 py-2 bg-slate-950 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-sans font-medium hover:border-emerald-500/40 cursor-pointer flex items-center gap-1.5 transition-all"
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
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-sans font-semibold cursor-pointer flex items-center gap-1.5 transition-all shadow-lg"
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
