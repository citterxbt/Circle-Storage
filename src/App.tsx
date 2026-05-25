/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AptosWalletProvider, useAptosWallet } from "./lib/aptos-wallet";
import LandingPage from "./components/LandingPage";
import ProfilePage from "./components/ProfilePage";
import DashboardPage from "./components/DashboardPage";
import LeaderboardPage from "./components/LeaderboardPage";
import FileUploadPage from "./components/FileUploadPage";
import MarketplacePage from "./components/MarketplacePage";
import { HardDrive, Key, Trophy, Upload, Layers, User, Coins, LogOut, Menu, X, PlusCircle } from "lucide-react";

type ActiveTab = "landing" | "marketplace" | "dashboard" | "upload" | "leaderboard" | "profile";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { connected, address, balance, connect, disconnect, availableWallets, requestFaucet } = useAptosWallet();
  const [showWalletMenu, setShowWalletMenu] = useState<boolean>(false);

  const handleWalletSelect = async (walletName: string) => {
    await connect(walletName);
    setShowWalletMenu(false);
    // Auto-route to marketplace after successful connect if currently on landing
    if (activeTab === "landing") {
      setActiveTab("marketplace");
    }
  };

  const truncateAddress = (addr: string) => {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col justify-between selection:bg-cyan-500/20 selection:text-cyan-300" id="circle-storage-app-root">
      {/* Top Navigation Hub */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-900/40" id="main-navigation-bar">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          
          {/* Logo Brand */}
          <button
            onClick={() => setActiveTab("landing")}
            className="flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none"
            id="brand-logo-trigger"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-md shadow-cyan-500/10 group-hover:scale-105 transition-transform">
              <HardDrive className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-sm font-sans font-bold tracking-tight text-white block leading-none">Circle Storage</span>
              <span className="text-[9px] font-mono text-cyan-400 font-semibold uppercase tracking-wider block mt-1">Shelby Testnet</span>
            </div>
          </button>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-1.5" id="nav-links-desktop">
            <button
              onClick={() => setActiveTab("landing")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "landing" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Overview
            </button>
            <button
              id="btn-nav-marketplace"
              onClick={() => setActiveTab("marketplace")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "marketplace" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Marketplace
            </button>
            <button
              id="btn-nav-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "dashboard" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Console List
            </button>
            <button
              id="btn-nav-upload"
              onClick={() => setActiveTab("upload")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "upload" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Upload Asset
            </button>
            <button
              id="btn-nav-leaderboard"
              onClick={() => setActiveTab("leaderboard")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "leaderboard" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Leaderboard
            </button>
            <button
              id="btn-nav-profile"
              onClick={() => setActiveTab("profile")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans transition-colors cursor-pointer ${
                activeTab === "profile" ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Profile
            </button>
          </nav>

          {/* Wallet Actions / Faucet block */}
          <div className="hidden md:flex items-center gap-3" id="wallet-toolbar-desktop">
            {connected && address ? (
              <div className="flex items-center gap-2">
                {/* Faucet trigger */}
                <button
                  id="btn-wallet-faucet"
                  onClick={requestFaucet}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-mono border border-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Claim +5 APT Faucet Tokens"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  Faucet
                </button>

                {/* Balance & Address pill */}
                <div className="bg-slate-900/90 border border-slate-805 rounded-xl px-3 py-2 flex items-center gap-3.5 text-xs font-sans">
                  <span className="font-mono text-white flex items-center gap-1 font-semibold">
                    <Coins className="w-3.5 h-3.5 text-cyan-400" />
                    {balance.toFixed(2)} APT
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300 font-mono text-[11px] select-all uppercase font-semibold">
                    {truncateAddress(address)}
                  </span>
                  <button
                    onClick={disconnect}
                    className="p-1 hover:text-red-400 text-slate-500 cursor-pointer transition-colors focus:outline-none"
                    title="Disconnect Wallet"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  id="btn-connect-wallet-trigger"
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-sans font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Connect Aptos Wallet
                </button>
                {showWalletMenu && (
                  <div className="absolute right-0 mt-2.5 w-52 bg-slate-900/95 border border-slate-800 rounded-xl shadow-xl p-2.5 z-50 text-xs text-left" id="wallet-dropdown-menu">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest p-1.5">Select Aptos Wallet</p>
                    {availableWallets.map((wallet) => (
                      <button
                        key={wallet}
                        onClick={() => handleWalletSelect(wallet)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer font-sans"
                      >
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        {wallet}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile responsive menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-100 flex items-center focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-900/60 bg-slate-950/95 backdrop-blur-md py-4 px-6 space-y-3 font-sans" id="nav-links-mobile">
            <button
              onClick={() => { setActiveTab("landing"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "landing" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Overview
            </button>
            <button
              onClick={() => { setActiveTab("marketplace"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "marketplace" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Marketplace
            </button>
            <button
              onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "dashboard" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Console List
            </button>
            <button
              onClick={() => { setActiveTab("upload"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "upload" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Upload Asset
            </button>
            <button
              onClick={() => { setActiveTab("leaderboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "leaderboard" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${activeTab === "profile" ? "text-cyan-400 bg-slate-900" : "text-slate-400"}`}
            >
              Profile
            </button>

            {/* Faucet / Wallet for mobile */}
            <div className="pt-4 border-t border-slate-900 flex flex-col gap-3">
              {connected && address ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 px-3 font-mono">
                    <span>Balance:</span>
                    <span className="font-bold flex items-center gap-1 text-cyan-400">
                      <Coins className="w-3.5 h-3.5 text-cyan-400" />
                      {balance.toFixed(2)} APT
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300 px-3 font-mono">
                    <span>Wallet:</span>
                    <span className="font-semibold select-all text-xs text-white uppercase">{truncateAddress(address)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={requestFaucet}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-slate-800"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                      Faucet +5 APT
                    </button>
                    <button
                      onClick={disconnect}
                      className="py-2.5 px-4 bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-500/20 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-mono text-slate-500 px-3">Choose Wallet</p>
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet}
                      onClick={() => handleWalletSelect(wallet)}
                      className="w-full text-left px-4 py-2 bg-slate-900/40 hover:bg-slate-900 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      {wallet}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Body Dynamic Rendering */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12" id="main-content-canvas">
        {activeTab === "landing" && (
          <LandingPage onEnterApp={() => setActiveTab("marketplace")} />
        )}
        {activeTab === "marketplace" && <MarketplacePage />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "upload" && <FileUploadPage />}
        {activeTab === "leaderboard" && <LeaderboardPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>

      {/* Persistent Web3 status margin lines */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-[11px] text-slate-600 font-mono tracking-wide" id="global-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Circle Storage. All file descriptors are client-encrypted using AES-256 Sentry.</p>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>Server Gating Enforced</span>
            <span>•</span>
            <span>Aptos JSON-RPC Network Link Success</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AptosWalletProvider>
      <AppContent />
    </AptosWalletProvider>
  );
}
