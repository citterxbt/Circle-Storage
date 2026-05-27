/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Shield, HardDrive, Cpu, Coins, Key, Server, HelpCircle, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface LandingPageProps {
  onEnterApp: () => void;
}

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const sectionRevealVariants = {
    hidden: { 
      opacity: 0, 
      y: 40, 
      filter: "blur(12px)", 
      scale: 0.98 
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      scale: 1,
      transition: { 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      }
    }
  };

  return (
    <div className="bg-transparent text-white font-sans max-w-7xl mx-auto" id="landing-page-root">
      {/* Hero Section - Aligned to remaining viewport vertical fold */}
      <section className="relative overflow-hidden min-h-[calc(100vh-73px)] flex flex-col justify-center py-12 md:py-20" id="hero-section">
        {/* Glow accent orb */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-pink-500/10 via-amber-500/10 to-transparent rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-row items-center justify-center gap-4 sm:gap-7 max-w-4xl mx-auto mb-6 flex-wrap sm:flex-nowrap"
          >
            {/* Elegant premium circular logo with gradient applied */}
            <div className="flex-shrink-0" id="landing-hero-circle-logo-frame">
              <svg className="w-16 h-16 sm:w-24 sm:h-24 filter drop-shadow-[0_0_25px_rgba(236,72,153,0.3)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" id="hero-premium-logo-svg">
                <defs>
                  <linearGradient id="circle-storage-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" /> {/* pink-400 */}
                    <stop offset="50%" stopColor="#fda4af" /> {/* rose-300 */}
                    <stop offset="100%" stopColor="#fbbf24" /> {/* amber-400 */}
                  </linearGradient>
                </defs>
                {/* Outer ring - enclosed, thick & premium */}
                <circle cx="50" cy="50" r="40" stroke="url(#circle-storage-logo-gradient)" strokeWidth="10" />
                {/* Thick solid inner circle detail */}
                <circle cx="50" cy="50" r="23" fill="url(#circle-storage-logo-gradient)" />
              </svg>
            </div>
            
            <h1 className="text-4xl sm:text-7xl font-sans font-bold tracking-tight text-white leading-tight">
              Circle Storage
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-xl text-white/70 mt-6 max-w-2xl mx-auto font-sans leading-relaxed"
          >
            A high-performance decentralized file storage and secure marketplace. Lock files in Shelby storage, set custom pricing on Aptos, and monetize directly via on-chain smart agreements.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              id="btn-launch-app"
              onClick={onEnterApp}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-bold font-sans rounded-xl shadow-lg shadow-pink-500/10 cursor-pointer flex items-center gap-2 group transition-all"
            >
              Launch App
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <motion.section 
        className="py-20 px-6 lg:px-8 border-t border-white/10" 
        id="use-cases-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.15 }}
        variants={sectionRevealVariants}
      >
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Industrial Web3 Use Cases
          </h2>
          <p className="text-white/60 font-sans max-w-2xl mx-auto text-sm sm:text-base">
            Circle Storage bridges Aptos high-throughput payment confirmation and Shelby decentralized file leasing to serve production-ready file verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex flex-col gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-pink-950/50 flex items-center justify-center text-pink-400 border border-pink-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Audit & Intel Marketplace</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Monetize high-quality smart contract security audits, intelligence briefings, and analysis PDFs. Buyers pay instantly in APT; file extraction logic executes server-side after on-chain verification.
            </p>
          </div>

          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex flex-col gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-950/50 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Software & Move Modules</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Distribute verified compiler configurations, optimized custom Move modules, and proprietary Web3 code templates. Set visibility parameters to protect proprietary engineering before final transaction.
            </p>
          </div>

          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex flex-col gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-950/50 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Secure IP Protection</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Maintain private archives. All private files are encrypted client-side, tied to your specific Aptos wallet signature, and are inaccessible to anyone else on the network.
            </p>
          </div>
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section 
        className="py-20 px-6 lg:px-8 border-t border-white/10" 
        id="how-it-works-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.15 }}
        variants={sectionRevealVariants}
      >
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Under the Hood: Shelby Protocol Flow
          </h2>
          <p className="text-white/60 font-sans max-w-xl mx-auto text-sm sm:text-base">
            Ensuring absolute, deterministic file protection with server-gated decryption keys and native Testnet checking.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line - elegant, thin, sleek line acting as a segment separator */}
          <div className="absolute top-[44px] left-[12%] right-[12%] h-[1.5px] bg-gradient-to-r from-pink-500/20 via-amber-500/40 to-emerald-500/20 hidden md:block z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-black/80 border border-pink-500/30 text-pink-400 flex items-center justify-center shadow-lg shadow-pink-500/10 z-10">
                <Key className="w-5 h-5" />
              </div>
              <div className="w-full text-center">
                <h4 className="text-base font-bold text-white font-sans">Client Side Encrypt</h4>
                <div className="h-[1px] w-12 bg-white/10 mx-auto my-3"></div>
                <p className="text-xs text-white/70 leading-relaxed font-sans">
                  Files are compressed and encrypted locally inside the web browser using symmetric AES-256 techniques prior to transit.
                </p>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-black/80 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10 z-10">
                <Server className="w-5 h-5" />
              </div>
              <div className="w-full text-center">
                <h4 className="text-base font-bold text-white font-sans">Shelby Node Anchor</h4>
                <div className="h-[1px] w-12 bg-white/10 mx-auto my-3"></div>
                <p className="text-xs text-white/70 leading-relaxed font-sans">
                  Encrypted payload is dispatched and anchored onto Shelby nodes using on-chain storage lease vouchers. Returns Shelby hash.
                </p>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-black/80 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/10 z-10">
                <Coins className="w-5 h-5" />
              </div>
              <div className="w-full text-center">
                <h4 className="text-base font-bold text-white font-sans">Direct Web3 Tx</h4>
                <div className="h-[1px] w-12 bg-white/10 mx-auto my-3"></div>
                <p className="text-xs text-white/70 leading-relaxed font-sans">
                  Buyer executes direct peer-to-peer APT transaction to uploader's address using standard Aptos wallet signatures.
                </p>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-black/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10 z-10">
                <Shield className="w-5 h-5" />
              </div>
              <div className="w-full text-center">
                <h4 className="text-base font-bold text-white font-sans">Server Verification</h4>
                <div className="h-[1px] w-12 bg-white/10 mx-auto my-3"></div>
                <p className="text-xs text-white/70 leading-relaxed font-sans">
                  Express gateway verifies receipt of the transaction hash on-chain, serving decrypted files only after payment validation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* FAQ Section */}
      <motion.section 
        className="py-20 px-6 max-w-4xl mx-auto border-t border-white/10" 
        id="faq-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.15 }}
        variants={sectionRevealVariants}
      >
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Frequently Answered Concerns
          </h2>
          <p className="text-white/60 font-sans text-sm">
            Details about billing, networks, and storage node architecture.
          </p>
        </div>

        <div className="flex flex-col gap-5" id="faq-content-container">
          <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex gap-4 shadow-2xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">What represents the Shelby Testnet Layer?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                Shelby is a specialized high-performance decentralized storage network on Aptos, allowing modular files to lease network space directly via on-chain smart vouchers.
              </p>
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex gap-4 shadow-2xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">Can someone bypass payment if they possess the Shelby Hash?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                No. All uploads to Shelby through Circle Storage are encrypted locally. Decryption occurs only at the server boundary AFTER the backend verifies transaction completion on Aptos RPC.
              </p>
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex gap-4 shadow-2xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">How does lease duration impact file preservation?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                Uploader locks storage fee based on 7 days, 30 days, 90 days, or 365 days. If a lease expires, the file is un-anchored unless a contract top-up occurs.
              </p>
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-pink-500/40 hover:bg-black/75 transition-all duration-300 flex gap-4 shadow-2xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">Why are Supabase API keys placed server-side?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                To guarantee zero exposure vectors. Client side bundles are transparent and prone to harvesting, so our Express gateway acts as the secure, authenticated shield.
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
