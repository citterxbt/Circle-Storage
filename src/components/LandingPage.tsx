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

  return (
    <div className="bg-transparent text-white font-sans max-w-7xl mx-auto" id="landing-page-root">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32" id="hero-section">
        {/* Glow accent orb */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-pink-500/10 via-amber-500/10 to-transparent rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-pink-500/20 bg-pink-950/40 text-pink-300 text-xs font-mono tracking-wider uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
            Shelby Testnet Integration Active
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-sans font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight"
          >
            Circle Storage on <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-amber-400">Aptos Blockchain</span>
          </motion.h1>

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
              Enter Console
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#how-it-works-section"
              className="px-6 py-4 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-sans rounded-xl transition-all font-bold text-sm shadow-sm"
            >
              Explore Protocol Flow
            </a>
          </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-6 lg:px-8 border-t border-white/10" id="use-cases-section">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Industrial Web3 Use Cases
          </h2>
          <p className="text-white/60 font-sans max-w-2xl mx-auto text-sm sm:text-base">
            Circle Storage bridges Aptos high-throughput payment confirmation and Shelby decentralized file leasing to serve production-ready file verification.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-black/30 border border-white/10 p-8 rounded-2xl hover:border-pink-500/30 transition-all flex flex-col gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-pink-950/50 flex items-center justify-center text-pink-400 border border-pink-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Audit & Intel Marketplace</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Monetize high-quality smart contract security audits, intelligence briefings, and analysis PDFs. Buyers pay instantly in APT; file extraction logic executes server-side after on-chain verification.
            </p>
          </div>

          <div className="bg-black/30 border border-white/10 p-8 rounded-2xl hover:border-pink-500/30 transition-all flex flex-col gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-amber-950/50 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Software & Move Modules</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Distribute verified compiler configurations, optimized custom Move modules, and proprietary Web3 code templates. Set visibility parameters to protect proprietary engineering before final transaction.
            </p>
          </div>

          <div className="bg-black/30 border border-white/10 p-8 rounded-2xl hover:border-pink-500/30 transition-all flex flex-col gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-950/50 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-sans">Secure IP Protection</h3>
            <p className="text-white/70 font-sans text-xs sm:text-sm leading-relaxed">
              Maintain private archives. All private files are encrypted client-side, tied to your specific Aptos wallet signature, and are inaccessible to anyone else on the network.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 lg:px-8 border-t border-white/10" id="how-it-works-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Under the Hood: Shelby Protocol Flow
          </h2>
          <p className="text-white/60 font-sans max-w-xl mx-auto text-sm sm:text-base">
            Ensuring absolute, deterministic file protection with server-gated decryption keys and native Testnet checking.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-gradient-to-r from-pink-500/10 via-amber-500/20 to-pink-500/10 transform -translate-y-1/2 hidden md:block z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            <div className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-950/60 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto text-xs font-mono font-bold">1</div>
              <div className="mx-auto text-pink-400 my-1"><Key className="w-5 h-5" /></div>
              <h4 className="text-base font-bold text-white">Client Side Encrypt</h4>
              <p className="text-xs text-white/70 leading-normal">
                Files are compressed and encrypted locally inside the web browser using symmetric AES-256 techniques prior to transit.
              </p>
            </div>

            <div className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-950/60 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xs font-mono font-bold">2</div>
              <div className="mx-auto text-amber-400 my-1"><Server className="w-5 h-5" /></div>
              <h4 className="text-base font-bold text-white">Shelby Node Anchor</h4>
              <p className="text-xs text-white/70 leading-normal">
                Encrypted payload is dispatched and anchored onto Shelby nodes using on-chain storage lease vouchers. Returns Shelby hash.
              </p>
            </div>

            <div className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xs font-mono font-bold">3</div>
              <div className="mx-auto text-rose-400 my-1"><Coins className="w-5 h-5" /></div>
              <h4 className="text-base font-bold text-white">Direct Web3 Tx</h4>
              <p className="text-xs text-white/70 leading-normal">
                Buyer executes direct peer-to-peer APT transaction to uploader's address using standard Aptos wallet signatures.
              </p>
            </div>

            <div className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xs font-mono font-bold">4</div>
              <div className="mx-auto text-emerald-400 my-1"><Shield className="w-5 h-5" /></div>
              <h4 className="text-base font-bold text-white">Server Verification</h4>
              <p className="text-xs text-white/70 leading-normal">
                Express gateway verifies receipt of the transaction hash on-chain, serving decrypted files only after payment validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto border-t border-white/10" id="faq-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4">
            Frequently Answered Concerns
          </h2>
          <p className="text-white/60 font-sans text-sm">
            Details about billing, networks, and storage node architecture.
          </p>
        </div>

        <div className="flex flex-col gap-5" id="faq-content-container">
          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex gap-4 shadow-xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">What represents the Shelby Testnet Layer?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                Shelby is a specialized high-performance decentralized storage network on Aptos, allowing modular files to lease network space directly via on-chain smart vouchers.
              </p>
            </div>
          </div>

          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex gap-4 shadow-xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">Can someone bypass payment if they possess the Shelby Hash?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                No. All uploads to Shelby through Circle Storage are encrypted locally. Decryption occurs only at the server boundary AFTER the backend verifies transaction completion on Aptos RPC.
              </p>
            </div>
          </div>

          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex gap-4 shadow-xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">How does lease duration impact file preservation?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                Uploader locks storage fee based on 7 days, 30 days, 90 days, or 365 days. If a lease expires, the file is un-anchored unless a contract top-up occurs.
              </p>
            </div>
          </div>

          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex gap-4 shadow-xl">
            <div className="text-pink-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-bold text-white mb-2 font-sans text-sm sm:text-base">Why are Supabase API keys placed server-side?</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                To guarantee zero exposure vectors. Client side bundles are transparent and prone to harvesting, so our Express gateway acts as the secure, authenticated shield.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
