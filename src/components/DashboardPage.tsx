/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useAptosWallet } from "../lib/aptos-wallet";
import { FileMetadata, DashboardStats, UserProfile } from "../types";
import { 
  HardDrive, 
  Wallet, 
  Shield, 
  Download, 
  Eye, 
  EyeOff, 
  User, 
  Edit3, 
  Save, 
  X, 
  UploadCloud, 
  Twitter, 
  Github, 
  Send, 
  Link,
  CheckCircle2
} from "lucide-react";

export default function DashboardPage() {
  const { address, connected } = useAptosWallet();
  const [stats, setStats] = useState<DashboardStats>({ filesUploadedCount: 0, totalEarnings: 0 });
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Profile combined states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editUsername, setEditUsername] = useState<string>("");
  const [editBio, setEditBio] = useState<string>("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>("");
  const [editX, setEditX] = useState<string>("");
  const [editGithub, setEditGithub] = useState<string>("");
  const [editTelegram, setEditTelegram] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (connected && address) {
      fetchDashboardData();
      fetchProfileData();
    }
  }, [connected, address]);

  const fetchProfileData = async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/profiles/${address}`);
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
        setEditUsername(data.username || "");
        setEditBio(data.bio || "");
        setEditAvatarUrl(data.avatar_url || "");
        setEditX(data.x_social || "");
        setEditGithub(data.github_social || "");
        setEditTelegram(data.telegram_social || "");
      }
    } catch (err) {
      console.error("Failed to fetch profile in dashboard", err);
    }
  };

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

  // Profile image local file upload reader
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Maximum image size is 1.5MB to preserve blockchain storage limits.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Helper to check valid URL structure
  const isValidUrl = (urlStr: string): boolean => {
    if (!urlStr) return true; // allowed empty standard
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setValidationError(null);

    // Assert username boundary (max 12 chars)
    if (!editUsername.trim()) {
      setValidationError("Username cannot be empty.");
      return;
    }
    if (editUsername.trim().length > 12) {
      setValidationError("Username must be at most 12 characters.");
      return;
    }

    // Assert bio boundary (max 100 chars)
    if (editBio.length > 100) {
      setValidationError("Bio must be at most 100 characters.");
      return;
    }

    // Assert social links are valid links (not random text)
    if (editX && !isValidUrl(editX)) {
      setValidationError("Twitter/X must be a fully valid link starting with http:// or https://");
      return;
    }
    if (editGithub && !isValidUrl(editGithub)) {
      setValidationError("GitHub must be a fully valid link starting with http:// or https://");
      return;
    }
    if (editTelegram && !isValidUrl(editTelegram)) {
      setValidationError("Telegram must be a fully valid link starting with http:// or https://");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: editUsername.trim(),
          avatar_url: editAvatarUrl,
          bio: editBio,
          x_social: editX,
          github_social: editGithub,
          telegram_social: editTelegram
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setValidationError(errData.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Save profile error", err);
      setValidationError("Internal connection error while saving user profile.");
    } finally {
      setSavingProfile(false);
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
        
        // Create anchor link
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
      console.error("Download failure", err);
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
      <div className="flex flex-col items-center justify-center py-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl p-10 text-center shadow-xl" id="dashboard-unconnected-view">
        <HardDrive className="w-16 h-16 text-pink-500/70 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2 font-sans">Connect Wallet to View Console</h3>
        <p className="text-sm text-white/60 max-w-sm mb-6 font-sans leading-relaxed">
          Please connect your active Aptos wallet using the button in the upper header to unlock your secure files ledger, ledger total earnings, and sovereign profile settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10" id="dashboard-combined-root">
      
      {/* 1. Combined User Profile Gated Container */}
      <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden transition-all duration-300 shadow-2xl" id="profile-console-capsule">
        {!isEditing ? (
          /* Profile info display mode */
          <div className="p-8 relative">
            <div className="absolute top-0 right-0 w-44 h-44 bg-pink-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative z-10 w-full">
              {/* Profile Details (Left / Main) */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left w-full sm:w-auto">
                {/* Avatar Display */}
                <img
                  src={profile?.avatar_url || editAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${address}`}
                  alt="User avatar"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-white/15 bg-black/60 p-1.5 object-cover flex-shrink-0 shadow-lg"
                />
                
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight">
                      {profile?.username || "Aptos Pioneer"}
                    </h2>
                    <span className="text-[10px] items-center gap-1 font-mono uppercase bg-pink-950/40 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-bold hidden sm:inline-flex">
                      Sovereign Account
                    </span>
                  </div>

                  <p className="text-xs text-amber-400 font-mono select-all font-bold tracking-tight bg-black/45 px-3 py-1 rounded-lg border border-white/5 inline-block max-w-full truncate uppercase">
                    {address}
                  </p>

                  <p className="text-xs sm:text-sm text-white/70 font-sans max-w-xl italic mt-1 leading-relaxed">
                    {profile?.bio || "No biography added yet. Write one by clicking the Edit Profile button."}
                  </p>

                  {/* Clickable Social Badges with absolute link gating */}
                  <div className="flex items-center gap-3.5 pt-2 flex-wrap justify-center sm:justify-start">
                    {profile?.x_social ? (
                      <a 
                        href={profile.x_social} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-pink-400 transition-colors font-sans"
                        title="Twitter / X profile"
                      >
                        <Twitter className="w-3.5 h-3.5 text-pink-450" />
                        <span className="underline">Twitter/X</span>
                      </a>
                    ) : (
                      <span className="text-white/20 text-xs font-sans flex items-center gap-1">
                        <Twitter className="w-3.5 h-3.5 opacity-40" /> Not linked
                      </span>
                    )}

                    <span className="text-white/10 text-xs select-none">•</span>

                    {profile?.github_social ? (
                      <a 
                        href={profile.github_social} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-pink-400 transition-colors font-sans"
                        title="GitHub profile"
                      >
                        <Github className="w-3.5 h-3.5 text-amber-500" />
                        <span className="underline">GitHub</span>
                      </a>
                    ) : (
                      <span className="text-white/20 text-xs font-sans flex items-center gap-1">
                        <Github className="w-3.5 h-3.5 opacity-40" /> Not linked
                      </span>
                    )}

                    <span className="text-white/10 text-xs select-none">•</span>

                    {profile?.telegram_social ? (
                      <a 
                        href={profile.telegram_social} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-pink-400 transition-colors font-sans"
                        title="Telegram link"
                      >
                        <Send className="w-3.5 h-3.5 text-pink-400" />
                        <span className="underline">Telegram</span>
                      </a>
                    ) : (
                      <span className="text-white/20 text-xs font-sans flex items-center gap-1">
                        <Send className="w-3.5 h-3.5 opacity-40" /> Not linked
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Button Action */}
              <div className="flex flex-col items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white hover:text-pink-400 hover:border-pink-500/30 text-xs font-bold font-sans rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md group transform active:scale-95"
                >
                  <Edit3 className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                  Edit Profile
                </button>
                {saveSuccess && (
                  <span className="text-[10px] text-emerald-400 font-sans flex items-center gap-1 font-bold animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Updated!
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Profile edit mode */
          <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-pink-400" />
                <h3 className="text-base font-bold text-white font-sans">Modify Account Details</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setValidationError(null);
                }}
                className="p-1 hover:text-pink-400 text-white/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationError && (
              <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold leading-relaxed font-sans">
                {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username Input - max 12 chars */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono uppercase text-white/50 font-bold">
                  Username <span className="text-pink-500 font-bold">*</span> (Max 12 Chars)
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  placeholder="Unique handle name"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors font-sans"
                />
              </div>

              {/* Profile image upload - NOT A LINK */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono uppercase text-white/50 font-bold">
                  Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {editAvatarUrl ? (
                      <img 
                        src={editAvatarUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5 text-white/30" />
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={triggerImageUpload}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-pink-500/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-pink-400" />
                    Upload File
                  </button>
                  <span className="text-[10px] text-white/40 font-mono">Max: 1.5MB</span>
                </div>
              </div>
            </div>

            {/* Biography - max 100 chars */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono uppercase text-white/50 font-bold">
                Biography (Max 100 Chars)
              </label>
              <textarea
                rows={2}
                maxLength={100}
                placeholder="Introductions about your service files, Move templates or Aptos nodes..."
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors resize-none font-sans"
              />
              <div className="text-right text-[10px] text-white/40 font-mono">
                {editBio.length}/100 characters
              </div>
            </div>

            {/* Social Media Links with dynamic validator rules */}
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-[11px] font-mono uppercase text-amber-400 tracking-wider mb-4 font-bold">
                Sovereign Web3 Links (Must be valid https or http link URLs)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs text-white/50 font-sans">
                    <Twitter className="w-3.5 h-3.5 text-pink-450" /> Twitter/X Profile URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://x.com/username"
                    value={editX}
                    onChange={(e) => setEditX(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs focus:border-pink-500 focus:outline-none transition-colors font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs text-white/50 font-sans">
                    <Github className="w-3.5 h-3.5 text-amber-500" /> GitHub Account URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://github.com/username"
                    value={editGithub}
                    onChange={(e) => setEditGithub(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs focus:border-pink-500 focus:outline-none transition-colors font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs text-white/50 font-sans">
                    <Send className="w-3.5 h-3.5 text-pink-400" /> Telegram Invite Link
                  </label>
                  <input
                    type="text"
                    placeholder="https://t.me/username"
                    value={editTelegram}
                    onChange={(e) => setEditTelegram(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs focus:border-pink-500 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setValidationError(null);
                }}
                className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-sans font-bold rounded-xl cursor-pointer transition-all"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-bold font-sans text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? "Saving Profile..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      {!isEditing && (
        <>
          {/* 2. Top Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-stats-grid">
            {/* Earnings Card */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn">
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
                <p className="text-xs text-white/50 mt-2 font-sans">Payouts routed directly to uploader's address.</p>
              </div>
            </div>

            {/* Uploads Count Card */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn" style={{ animationDelay: "100ms" }}>
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
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group shadow-md animate-fadeIn" style={{ animationDelay: "200ms" }}>
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

          {/* 3. User Files Ledger Listings */}
          <div className="space-y-4" id="dashboard-uploads-ledger-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white font-sans">Your Shelby Upload Ledger</h3>
                <p className="text-xs text-white/60 font-sans">Select files below to retrieve and decrypt your source assets at any time without fee check.</p>
              </div>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-[#12050e]/60 backdrop-blur-md hover:bg-black/80 text-white font-bold rounded-xl text-xs font-sans transition-all border border-white/10 shadow-md cursor-pointer"
              >
                Refresh Ledger
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-sm">
                <span className="text-white/45 font-mono animate-pulse">Consulting Shelby decentralized ledger indexes...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-16 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl font-sans text-white/70 max-w-lg mx-auto p-6 flex flex-col items-center gap-3 shadow-md">
                <HardDrive className="w-10 h-10 text-pink-400/70" />
                <span className="font-bold text-white">No Registered Files Found</span>
                <p className="text-xs leading-relaxed text-white/50">You haven't uploaded any files to Circle Storage yet. Head to the 'Upload Asset' pane to lease your first slot!</p>
              </div>
            ) : (
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-lg" id="dashboard-uploads-table-wrapper">
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
                              <div className="inline-flex items-center gap-1 text-pink-400 bg-pink-950/20 px-2.5 py-1 rounded-full border border-pink-500/25 text-[10px] font-bold uppercase">
                                <Eye className="w-3 h-3" />
                                Public
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-amber-455 bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-500/20 text-[10px] font-bold uppercase text-amber-400">
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
                              <span className="font-mono text-pink-400 bg-pink-950/20 border border-pink-500/20 px-2 py-0.5 rounded text-xs select-all">
                                {file.purchase_count || 0}x
                              </span>
                            )}
                          </td>
                          <td className="p-4 sm:p-5 text-center">
                            <button
                              id={`btn-dashboard-download-${file.id}`}
                              onClick={() => downloadFile(file.id, file.name)}
                              disabled={downloadingId === file.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1a0512]/60 border border-white/10 hover:border-pink-500/30 text-white hover:text-pink-400 font-semibold font-sans text-xs rounded-lg cursor-pointer transition-all shadow-sm"
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
        </>
      )}
    </div>
  );
}
