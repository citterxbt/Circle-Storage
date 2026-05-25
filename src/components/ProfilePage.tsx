/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import { useAptosWallet } from "../lib/aptos-wallet";
import { User, Twitter, Github, Send, Edit, Save, CheckCircle2, RotateCw } from "lucide-react";

export default function ProfilePage() {
  const { address, connected } = useAptosWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Editable Form Inputs
  const [username, setUsername] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [xSocial, setXSocial] = useState<string>("");
  const [githubSocial, setGithubSocial] = useState<string>("");
  const [telegramSocial, setTelegramSocial] = useState<string>("");

  useEffect(() => {
    if (connected && address) {
      fetchProfile();
    }
  }, [connected, address]);

  const fetchProfile = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/profiles/${address}`);
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
        setUsername(data.username);
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setXSocial(data.x_social || "");
        setGithubSocial(data.github_social || "");
        setTelegramSocial(data.telegram_social || "");
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (!username.trim()) {
      alert("Username cannot be empty");
      return;
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet_address: address,
          username: username.trim(),
          avatar_url: avatarUrl,
          bio,
          x_social: xSocial,
          github_social: githubSocial,
          telegram_social: telegramSocial
        })
      });

      if (res.ok) {
        const updated: UserProfile = await res.json();
        setProfile(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Failed to save profile", err);
      alert("Server error occurred saving profile.");
    } finally {
      setSaving(false);
    }
  };

  const generateNewBotAvatar = () => {
    if (!address) return;
    const randomSeed = Math.random().toString(36).substring(7);
    setAvatarUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-black/25 border border-white/10 rounded-3xl p-10 text-center shadow-xl animate-fadeIn" id="profile-unconnected-container">
        <User className="w-16 h-16 text-pink-500/70 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2 font-sans">Connect Wallet to Manage Profile</h3>
        <p className="text-sm text-white/60 max-w-sm mb-6 font-sans leading-relaxed">
          To read and update your storage metadata profile, please select and authenticate your Aptos wallet in the top bar.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn" id="profile-connected-view">
      {/* Header and overview block */}
      <div className="flex flex-col md:flex-row items-center gap-6 p-8 bg-black/35 border border-white/10 rounded-3xl relative overflow-hidden" id="profile-overview-card">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl"></div>
        
        <div className="relative group flex-shrink-0">
          <img
            src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${address}`}
            alt="User avatar"
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-2xl border border-white/15 bg-black/40 p-1.5 object-cover"
          />
          <button
            onClick={generateNewBotAvatar}
            className="absolute -bottom-1 -right-1 p-1.5 bg-[#1d0c15] text-pink-400 hover:text-white rounded-lg border border-white/10 cursor-pointer transition-colors shadow-lg"
            title="Generate Random Avatar"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-center md:text-left flex-1 space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <h2 className="text-2xl font-sans font-bold text-white tracking-tight">
              {username || "Aptos Pioneer"}
            </h2>
            <span className="text-[10px] font-mono uppercase bg-pink-950/40 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-bold">
              Active
            </span>
          </div>
          <p className="text-xs text-amber-400 font-mono select-all font-bold">
            {address}
          </p>
          {bio && <p className="text-sm text-white/70 font-sans max-w-xl line-clamp-2">{bio}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="text-white/40 font-mono animate-pulse">Syncing profile with Aptos ledger...</span>
        </div>
      ) : (
        <form onSubmit={saveProfile} className="bg-black/30 border border-white/10 p-8 rounded-3xl space-y-6" id="profiles-edit-form">
          <div className="flex items-center gap-2 pb-4 border-b border-white/10">
            <Edit className="w-4 h-4 text-pink-400" />
            <h3 className="text-base font-bold text-white font-sans">Modify Metadata Profile</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="input-username" className="block text-xs font-mono uppercase text-white/45 font-bold">Username <span className="text-pink-500">*</span></label>
              <input
                id="input-username"
                type="text"
                required
                placeholder="Enter unique profile handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="input-avatar" className="block text-xs font-mono uppercase text-white/45 font-bold">Avatar URL</label>
              <input
                id="input-avatar"
                type="text"
                placeholder="https://example.com/photo.png"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="input-bio" className="block text-xs font-mono uppercase text-white/45 font-bold">Biography</label>
            <textarea
              id="input-bio"
              rows={3}
              placeholder="Write a brief introduction about your Web3 files, background or on-chain assets..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="pt-4 border-t border-white/10">
            <h4 className="text-xs font-mono uppercase text-white/45 mb-4 font-bold">Sovereign Web3 Credentials (Social Accounts)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="input-x" className="flex items-center gap-1.5 text-xs text-white/50"><Twitter className="w-3.5 h-3.5 text-white/60" /> Twitter/X Handle</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-white/40 text-sm">@</span>
                  <input
                    id="input-x"
                    type="text"
                    placeholder="handle"
                    value={xSocial}
                    onChange={(e) => setXSocial(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 text-white rounded-xl pl-8 pr-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="input-github" className="flex items-center gap-1.5 text-xs text-white/50"><Github className="w-3.5 h-3.5 text-white/60" /> GitHub Account</label>
                <input
                  id="input-github"
                  type="text"
                  placeholder="github-username"
                  value={githubSocial}
                  onChange={(e) => setGithubSocial(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="input-tg" className="flex items-center gap-1.5 text-xs text-white/50"><Send className="w-3.5 h-3.5 text-white/60" /> Telegram Handle</label>
                <input
                  id="input-tg"
                  type="text"
                  placeholder="tg_handle"
                  value={telegramSocial}
                  onChange={(e) => setTelegramSocial(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10">
            <span className="text-[11px] text-white/40 font-sans italic">All credentials strictly stored server-side with gated API validation.</span>
            
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium animate-fadeIn">
                  <CheckCircle2 className="w-4 h-45 w-4 h-4" />
                  Profile updated successfully
                </div>
              )}
              <button
                id="btn-save-profile"
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-bold font-sans text-sm rounded-xl cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50 border border-white/15"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
