/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AptosWalletProvider, useAptosWallet } from "./lib/aptos-wallet";
import LandingPage from "./components/LandingPage";
import ProfilePage from "./components/ProfilePage";
import DashboardPage from "./components/DashboardPage";
import LeaderboardPage from "./components/LeaderboardPage";
import FileUploadPage from "./components/FileUploadPage";
import MarketplacePage from "./components/MarketplacePage";
import PsychedelicWaterBackground from "./components/PsychedelicWaterBackground";
import { HardDrive, Key, Trophy, Upload, Layers, User, Coins, LogOut, Menu, X, PlusCircle, ArrowUp } from "lucide-react";

type ActiveTab = "landing" | "marketplace" | "dashboard" | "upload" | "leaderboard" | "profile";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { connected, address, balance, connect, disconnect, availableWallets, requestFaucet } = useAptosWallet();
  const [showWalletMenu, setShowWalletMenu] = useState<boolean>(false);
  const [showGoToTop, setShowGoToTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowGoToTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  if (activeTab === "landing") {
    return (
      <div className="relative bg-[#0c0308] text-white min-h-screen font-sans flex flex-col justify-between selection:bg-pink-500/30 selection:text-white overflow-hidden" id="circle-storage-landing-root">
        {/* Ambient Interactive Psychedelic WebGL Background Loop */}
        <PsychedelicWaterBackground />

        {/* High-contrast vignettes locked to the viewport to frame text beautifully and preserve contrast */}
        <div className="fixed inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75 z-5 pointer-events-none" />
        <div className="fixed inset-0 bg-radial-gradient from-transparent to-black/40 z-5 pointer-events-none" />

        {/* Landing Navigation Header - Pure Transparent Centered Styling */}
        <header className="relative z-50 bg-transparent py-6" id="landing-navigation-bar">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
            {/* Anchor Links wrapped in dark, transparent glassmorphism capsules with larger text */}
            <nav className="flex items-center gap-3 flex-wrap justify-center animate-fade-in" id="landing-anchor-links">
              <a 
                href="#hero-section" 
                className="px-5 py-2 text-sm font-bold font-sans text-white/90 bg-black/60 hover:bg-black/85 border border-white/10 hover:border-pink-500/40 rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center tracking-wide hover:scale-105 active:scale-95"
              >
                About
              </a>
              <a 
                href="#use-cases-section" 
                className="px-5 py-2 text-sm font-bold font-sans text-white/90 bg-black/60 hover:bg-black/85 border border-white/10 hover:border-pink-500/40 rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center tracking-wide hover:scale-105 active:scale-95"
              >
                Use Case
              </a>
              <a 
                href="#how-it-works-section" 
                className="px-5 py-2 text-sm font-bold font-sans text-white/90 bg-black/60 hover:bg-black/85 border border-white/10 hover:border-pink-500/40 rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center tracking-wide hover:scale-105 active:scale-95"
              >
                Protocol Flow
              </a>
              <a 
                href="#faq-section" 
                className="px-5 py-2 text-sm font-bold font-sans text-white/90 bg-black/60 hover:bg-black/85 border border-white/10 hover:border-pink-500/40 rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center tracking-wide hover:scale-105 active:scale-95"
              >
                FAQ
              </a>
            </nav>
          </div>
        </header>

        {/* Full-bleed landing page content container */}
        <main className="flex-1 relative z-10" id="landing-content-canvas">
          <LandingPage onEnterApp={() => setActiveTab("marketplace")} />
        </main>

        {/* Go To Top floating capsule */}
        {showGoToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-black/70 border border-white/10 hover:border-pink-500/40 hover:bg-black/90 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Go to Top"
            id="btn-go-to-top"
          >
            <ArrowUp className="w-5 h-5 text-pink-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-rose-950 via-[#180a13] to-[#251502] text-white min-h-screen font-sans flex flex-col justify-between selection:bg-pink-500/30 selection:text-white" id="circle-storage-app-root">
      {/* App Specific Header */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10" id="main-navigation-bar">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          
          {/* Left indicator without physical graphic logo */}
          <div className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase select-none" id="brand-logo-trigger">
            Shelby Testnet
          </div>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-1.5" id="nav-links-desktop">
            <button
              onClick={() => setActiveTab("landing")}
              className="px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans text-white/70 hover:text-pink-400 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Exit Console
            </button>
            <button
              id="btn-nav-marketplace"
              onClick={() => setActiveTab("marketplace")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                activeTab === "marketplace" ? "bg-white/10 text-white border border-white/25 shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Marketplace
            </button>
            <button
              id="btn-nav-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                activeTab === "dashboard" ? "bg-white/10 text-white border border-white/25 shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Console List
            </button>
            <button
              id="btn-nav-upload"
              onClick={() => setActiveTab("upload")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                activeTab === "upload" ? "bg-white/10 text-white border border-white/25 shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Upload Asset
            </button>
            <button
              id="btn-nav-leaderboard"
              onClick={() => setActiveTab("leaderboard")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                activeTab === "leaderboard" ? "bg-white/10 text-white border border-white/25 shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Leaderboard
            </button>
            <button
              id="btn-nav-profile"
              onClick={() => setActiveTab("profile")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                activeTab === "profile" ? "bg-white/10 text-white border border-white/25 shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
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
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-mono border border-white/15 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  title="Claim +5 APT Faucet Tokens"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Faucet
                </button>

                {/* Balance & Address pill */}
                <div className="bg-black/20 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-3.5 text-xs font-sans shadow-sm">
                  <span className="font-mono text-white flex items-center gap-1 font-bold">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    {balance.toFixed(2)} APT
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-white font-mono text-[11px] select-all uppercase font-semibold">
                    {truncateAddress(address)}
                  </span>
                  <button
                    onClick={disconnect}
                    className="p-1 hover:text-red-400 text-white/50 cursor-pointer transition-colors focus:outline-none"
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
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-sans font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-white/10"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Connect Aptos Wallet
                </button>
                {showWalletMenu && (
                  <div className="absolute right-0 mt-2.5 w-52 bg-[#1a0a14] border border-white/15 rounded-xl shadow-xl p-2.5 z-50 text-xs text-left" id="wallet-dropdown-menu">
                    <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest p-1.5">Select Aptos Wallet</p>
                    {availableWallets.map((wallet) => (
                      <button
                        key={wallet}
                        onClick={() => handleWalletSelect(wallet)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/90 hover:text-pink-400 rounded-lg transition-colors flex items-center gap-2 cursor-pointer font-sans"
                      >
                        <span className="w-2 h-2 rounded-full bg-pink-500"></span>
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
            className="md:hidden p-2 text-white/70 hover:text-white flex items-center focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#160811] py-4 px-6 space-y-3 font-sans shadow-lg" id="nav-links-mobile">
            <button
              onClick={() => { setActiveTab("landing"); setMobileMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 font-bold"
            >
              Exit Console
            </button>
            <button
              onClick={() => { setActiveTab("marketplace"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeTab === "marketplace" ? "text-pink-400 bg-white/10" : "text-white/70"}`}
            >
              Marketplace
            </button>
            <button
              onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeTab === "dashboard" ? "text-pink-400 bg-white/10" : "text-white/70"}`}
            >
              Console List
            </button>
            <button
              onClick={() => { setActiveTab("upload"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeTab === "upload" ? "text-pink-400 bg-white/10" : "text-white/70"}`}
            >
              Upload Asset
            </button>
            <button
              onClick={() => { setActiveTab("leaderboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeTab === "leaderboard" ? "text-pink-400 bg-white/10" : "text-white/70"}`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeTab === "profile" ? "text-pink-400 bg-white/10" : "text-white/70"}`}
            >
              Profile
            </button>

            {/* Faucet / Wallet for mobile */}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              {connected && address ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-white/70 px-3 font-mono">
                    <span>Balance:</span>
                    <span className="font-bold flex items-center gap-1 text-amber-400">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      {balance.toFixed(2)} APT
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/70 px-3 font-mono">
                    <span>Wallet:</span>
                    <span className="font-semibold select-all text-xs text-white uppercase">{truncateAddress(address)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={requestFaucet}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-white/10"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                      Faucet +5 APT
                    </button>
                    <button
                      onClick={disconnect}
                      className="py-2.5 px-4 bg-red-950/45 text-red-400 hover:bg-red-900/40 border border-red-900/30 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-mono text-white/50 px-3">Choose Wallet</p>
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet}
                      onClick={() => handleWalletSelect(wallet)}
                      className="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 text-white/90 rounded-lg text-xs transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-pink-500"></span>
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
        {activeTab === "marketplace" && <MarketplacePage />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "upload" && <FileUploadPage />}
        {activeTab === "leaderboard" && <LeaderboardPage />}
        {activeTab === "profile" && <ProfilePage />}
      </main>

      {/* Persistent Web3 footer */}
      <footer className="py-6 border-t border-white/10 bg-black/20 text-center text-[11px] text-white/50 font-mono tracking-wide" id="global-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Circle Storage. All uploads are end-to-end client-side encrypted before hosting.</p>
          <p className="text-[10px] text-white/40">Aptos Shelby Testnet • Pink & Gold Premium Console</p>
        </div>
      </footer>

      {/* Go To Top floating capsule for the app workspace */}
      {showGoToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-black/70 border border-white/10 hover:border-pink-500/40 hover:bg-black/90 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
          title="Go to Top"
          id="btn-app-go-to-top"
        >
          <ArrowUp className="w-5 h-5 text-pink-400" />
        </button>
      )}
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
