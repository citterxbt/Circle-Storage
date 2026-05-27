/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AptosWalletProvider, useAptosWallet } from "./lib/aptos-wallet";
import LandingPage from "./components/LandingPage";
import DashboardPage from "./components/DashboardPage";
import LeaderboardPage from "./components/LeaderboardPage";
import FileUploadPage from "./components/FileUploadPage";
import MarketplacePage from "./components/MarketplacePage";
import PsychedelicWaterBackground from "./components/PsychedelicWaterBackground";
import { Coins, Menu, X, ArrowUp, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ActiveTab = "landing" | "marketplace" | "dashboard" | "upload" | "leaderboard";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { connected, address, balance, shelbyUSDBalance, connect, disconnect, availableWallets } = useAptosWallet();
  const [showWalletMenu, setShowWalletMenu] = useState<boolean>(false);
  const [showConnectedWalletMenu, setShowConnectedWalletMenu] = useState<boolean>(false);
  const [showGoToTop, setShowGoToTop] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

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

        {/* Landing Navigation Header - Pure transparent wrapper with premium individual glassmorphism capsules */}
        <header className="sticky top-0 z-50 bg-transparent py-6 border-none select-none" id="landing-navigation-bar">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
            {/* Anchor Links wrapped individually in premium, dark, translucent glassmorphism capsules */}
            <nav className="flex items-center gap-4 flex-wrap justify-center animate-fade-in" id="landing-anchor-links">
              <a 
                href="#hero-section" 
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white/90 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)]"
              >
                About
              </a>
              <a 
                href="#use-cases-section" 
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white/90 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)]"
              >
                Use Cases
              </a>
              <a 
                href="#how-it-works-section" 
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white/90 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)]"
              >
                Protocol Flow
              </a>
              <a 
                href="#faq-section" 
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white/90 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)]"
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

  // Define transition motion configuration for premium page transitions
  const pageTransition = {
    initial: { opacity: 0, y: 15, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -15, filter: "blur(4px)" },
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <div className="bg-gradient-to-br from-rose-950 via-[#180a13] to-[#251502] text-white min-h-screen font-sans flex flex-col justify-between selection:bg-pink-500/30 selection:text-white" id="circle-storage-app-root">
      
      {/* App Specific Header - Transparent wrapper with premium individual glassmorphism capsules */}
      <header className="sticky top-0 z-50 bg-transparent py-6 border-none select-none" id="main-navigation-bar">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          
          {/* Top-Left Circular Gradient Logo & Brand wrapped in a responsive premium glassmorphism capsule */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer group px-5 py-2.5 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]" 
            onClick={() => setActiveTab("landing")} 
            id="brand-logo-trigger"
          >
            <div className="flex-shrink-0" id="header-circle-logo-frame">
              <svg className="w-6 h-6 filter drop-shadow-[0_0_10px_rgba(236,72,153,0.3)] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" id="header-premium-logo-svg">
                <defs>
                  <linearGradient id="header-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" /> {/* pink-400 */}
                    <stop offset="50%" stopColor="#fda4af" /> {/* rose-300 */}
                    <stop offset="100%" stopColor="#fbbf24" /> {/* amber-400 */}
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="40" stroke="url(#header-logo-gradient)" strokeWidth="10" />
                <circle cx="50" cy="50" r="23" fill="url(#header-logo-gradient)" />
              </svg>
            </div>
            <span className="text-xs font-bold font-sans tracking-widest text-white/95 group-hover:text-pink-300 transition-colors uppercase hidden sm:inline-block">
              Circle Storage
            </span>
          </div>

          {/* Desktop Links - styled in separate elegant glassmorphism capsules with slightly larger font sizes */}
          <nav className="hidden md:flex items-center gap-3.5" id="nav-links-desktop">
            <button
              id="btn-nav-upload"
              onClick={() => setActiveTab("upload")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 border ${
                activeTab === "upload"
                  ? "bg-pink-500/20 text-white border-pink-500/50 shadow-pink-500/10"
                  : "text-white/70 bg-black/60 hover:bg-black/95 border-white/10 hover:border-pink-500/50"
              }`}
            >
              Upload
            </button>
            <button
              id="btn-nav-marketplace"
              onClick={() => setActiveTab("marketplace")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 border ${
                activeTab === "marketplace"
                  ? "bg-pink-500/20 text-white border-pink-500/50 shadow-pink-500/10"
                  : "text-white/70 bg-black/60 hover:bg-black/95 border-white/10 hover:border-pink-500/50"
              }`}
            >
              Marketplace
            </button>
            <button
              id="btn-nav-leaderboard"
              onClick={() => setActiveTab("leaderboard")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 border ${
                activeTab === "leaderboard"
                  ? "bg-pink-500/20 text-white border-pink-500/50 shadow-pink-500/10"
                  : "text-white/70 bg-black/60 hover:bg-black/95 border-white/10 hover:border-pink-500/50"
              }`}
            >
              Leaderboard
            </button>
            <button
              id="btn-nav-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full backdrop-blur-md transition-all duration-300 shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 border ${
                activeTab === "dashboard"
                  ? "bg-pink-500/20 text-white border-pink-500/50 shadow-pink-500/10"
                  : "text-white/70 bg-black/60 hover:bg-black/95 border-white/10 hover:border-pink-500/50"
              }`}
            >
              Dashboard
            </button>
          </nav>

          {/* Desktop Wallet connection pill */}
          <div className="hidden md:flex items-center gap-3 relative" id="wallet-toolbar-desktop">
            {connected && address ? (
              <div className="relative">
                <button
                  id="btn-connected-wallet-dropdown-trigger"
                  onClick={() => setShowConnectedWalletMenu(!showConnectedWalletMenu)}
                  className="px-5 py-2.5 bg-black/60 hover:bg-black/95 border border-white/10 hover:border-pink-500/50 rounded-full flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md cursor-pointer transition-all active:scale-95 hover:scale-105 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-white font-mono lowercase font-semibold">
                    {truncateAddress(address)}
                  </span>
                </button>
                
                {showConnectedWalletMenu && (
                  <div className="absolute right-0 mt-3 w-72 bg-[#1c0b16]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-4.5 z-50 space-y-4" id="connected-wallet-dropdown-menu">
                    <div className="border-b border-white/10 pb-3">
                      <p className="text-[10px] uppercase font-mono text-white/40 tracking-widest font-bold">Connected Address</p>
                      <div className="flex items-center justify-between gap-2 mt-2 bg-black/35 p-2 px-3 rounded-xl border border-white/5">
                        <span className="text-white font-mono text-xs uppercase" title={address}>
                          {truncateAddress(address)}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(address);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="p-1.5 hover:bg-white/5 rounded-lg text-pink-400 hover:text-pink-300 transition-all flex items-center justify-center cursor-pointer"
                          title="Copy Full Address"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-pink-400 hover:scale-105 active:scale-95" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 font-sans">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-white/60">APT Balance:</span>
                        <span className="font-mono text-white flex items-center gap-1.5 font-bold">
                          <Coins className="w-4 h-4 text-amber-500" />
                          {balance.toFixed(2)} APT
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-white/60">ShelbyUSD Balance:</span>
                        <span className="font-mono text-pink-400 flex items-center gap-1.5 font-bold">
                          <span className="text-xs uppercase bg-pink-950/40 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20 font-sans tracking-wider">SUSD</span>
                          ${shelbyUSDBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        disconnect();
                        setShowConnectedWalletMenu(false);
                      }}
                      className="w-full py-2.5 bg-red-950/45 text-red-400 hover:bg-red-900/40 border border-red-900/30 rounded-xl text-xs sm:text-sm font-bold font-sans cursor-pointer transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <button
                  id="btn-connect-wallet-trigger"
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-500/80 to-amber-500/80 hover:from-pink-400 hover:to-amber-400 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-full cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-white/10 hover:scale-105"
                >
                  <Coins className="w-4 h-4" />
                  Connect Wallet
                </button>
                {showWalletMenu && (
                  <div className="absolute right-0 mt-3 w-56 bg-[#1a0a14] border border-white/15 rounded-2xl shadow-xl p-3 z-50 text-sm text-left" id="wallet-dropdown-menu">
                    <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest p-1.5 font-bold">Select Wallet</p>
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

          {/* Mobile responsive navigation trigger - glassmorphism single capsule */}
          <div className="md:hidden flex items-center px-4 py-2 bg-black/60 border border-white/10 rounded-full backdrop-blur-md hover:border-pink-500/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white/70 hover:text-white flex items-center focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 animate-fade-in" /> : <Menu className="w-6 h-6 animate-fade-in" />}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#160811] py-4 px-6 space-y-3 font-sans shadow-lg pb-6" id="nav-links-mobile">
            <button
              onClick={() => { setActiveTab("upload"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-5 py-3 rounded-full text-sm font-bold ${activeTab === "upload" ? "text-white bg-pink-500/20 border border-pink-500/30" : "text-white/70 bg-black/40"}`}
            >
              Upload
            </button>
            <button
              onClick={() => { setActiveTab("marketplace"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-5 py-3 rounded-full text-sm font-bold ${activeTab === "marketplace" ? "text-white bg-pink-500/20 border border-pink-500/30" : "text-white/70 bg-black/40"}`}
            >
              Marketplace
            </button>
            <button
              onClick={() => { setActiveTab("leaderboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-5 py-3 rounded-full text-sm font-bold ${activeTab === "leaderboard" ? "text-white bg-pink-500/20 border border-pink-500/30" : "text-white/70 bg-black/40"}`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-5 py-3 rounded-full text-sm font-bold ${activeTab === "dashboard" ? "text-white bg-pink-500/20 border border-pink-500/30" : "text-white/70 bg-black/40"}`}
            >
              Dashboard
            </button>

            {/* Wallet actions drawer on mobile */}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              {connected && address ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-white/70 px-3 font-mono">
                    <span>APT Balance:</span>
                    <span className="font-bold flex items-center gap-1.5 text-amber-400">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      {balance.toFixed(2)} APT
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/70 px-3 font-mono">
                    <span>ShelbyUSD Balance:</span>
                    <span className="font-bold flex items-center gap-1.5 text-pink-400">
                      <span className="text-[9px] uppercase bg-pink-950/40 text-pink-400 px-1 py-0.5 rounded border border-pink-500/20 font-sans tracking-wider">SUSD</span>
                      ${shelbyUSDBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/70 px-3 font-mono">
                    <span>Address:</span>
                    <span className="font-semibold select-all text-xs text-white uppercase">{truncateAddress(address)}</span>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => { disconnect(); setMobileMenuOpen(false); }}
                      className="w-full py-2.5 bg-red-950/45 text-red-400 hover:bg-red-900/40 border border-red-900/30 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-[10px] uppercase font-mono text-white/50 px-3 text-left">Choose Wallet</p>
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet}
                      onClick={() => { handleWalletSelect(wallet); setMobileMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 text-white/90 rounded-xl text-xs transition-colors flex items-center gap-2"
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

      {/* Main Body with Classy Page Smooth Entrance Transition */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12" id="main-content-canvas">
        <AnimatePresence mode="wait">
          {!connected || !address ? (
            <motion.div
              key="wallet-gate-prompt"
              initial={pageTransition.initial}
              animate={pageTransition.animate}
              exit={pageTransition.exit}
              transition={pageTransition.transition}
              className="max-w-md mx-auto my-12"
            >
              <div 
                className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col items-center text-center gap-6" 
                id="wallet-gate-container"
              >
                <div 
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500/20 via-amber-500/10 to-transparent flex items-center justify-center border border-pink-500/30 text-pink-400 animate-pulse shadow-[0_0_30px_rgba(236,72,153,0.15)]" 
                  id="gate-icon"
                >
                  <Coins className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-sans text-white tracking-tight mb-3">
                    Wallet Signature Required
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-sans">
                    Secure Web3 operations on Circle Storage require a connected Aptos wallet. Connect to handle decentralized uploading, encrypted file storage, and live marketplace deals.
                  </p>
                </div>
                
                <div className="w-full space-y-3 mt-2" id="gate-actions-block">
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet}
                      onClick={() => handleWalletSelect(wallet)}
                      className="w-full py-3.5 px-5 bg-gradient-to-r from-pink-500/10 to-amber-500/10 hover:from-pink-500/20 hover:to-amber-500/20 border border-white/10 hover:border-pink-500/40 rounded-xl font-bold font-sans text-xs uppercase tracking-wider text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(236,72,153,0.1)] hover:text-pink-300"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                      Connect {wallet}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {activeTab === "marketplace" && (
                <motion.div
                  key="marketplace"
                  initial={pageTransition.initial}
                  animate={pageTransition.animate}
                  exit={pageTransition.exit}
                  transition={pageTransition.transition}
                >
                  <MarketplacePage />
                </motion.div>
              )}

              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={pageTransition.initial}
                  animate={pageTransition.animate}
                  exit={pageTransition.exit}
                  transition={pageTransition.transition}
                >
                  <DashboardPage />
                </motion.div>
              )}

              {activeTab === "upload" && (
                <motion.div
                  key="upload"
                  initial={pageTransition.initial}
                  animate={pageTransition.animate}
                  exit={pageTransition.exit}
                  transition={pageTransition.transition}
                >
                  <FileUploadPage />
                </motion.div>
              )}

              {activeTab === "leaderboard" && (
                <motion.div
                  key="leaderboard"
                  initial={pageTransition.initial}
                  animate={pageTransition.animate}
                  exit={pageTransition.exit}
                  transition={pageTransition.transition}
                >
                  <LeaderboardPage />
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Go To Top floating capsule for the workspace */}
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
