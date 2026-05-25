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

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans" id="landing-page-root">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 border-b border-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" id="hero-section">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 text-xs font-mono tracking-wider uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Shelby Testnet Integration Active
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-sans font-medium tracking-tight text-white max-w-3xl mx-auto leading-none"
          >
            Circle Storage on <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Aptos Blockchain</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 mt-6 max-w-2xl mx-auto font-sans font-normal leading-relaxed"
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
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-medium font-sans rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer flex items-center gap-2 group transition-all"
            >
              Launch Console
              <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#how-it-works-section"
              className="px-6 py-4 border border-slate-800 bg-slate-900/30 hover:bg-slate-900 hover:border-slate-700 text-slate-300 font-sans rounded-xl transition-all font-medium text-sm"
            >
              Explore Protocol Flow
            </a>
          </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-8 border-b border-slate-900" id="use-cases-section">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-sans font-medium tracking-tight text-white mb-4">
            Industrial Web3 Use Cases
          </h2>
          <p className="text-slate-400 font-sans max-w-xl mx-auto text-sm sm:text-base">
            Circle Storage bridges Aptos high-throughput payment confirmation and Shelby decentralized file leasing to serve production-ready file verification.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-2xl hover:border-slate-800 hover:bg-slate-900/70 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-medium text-white font-sans">Audit & Intel Marketplace</h3>
            <p className="text-slate-400 font-sans text-sm leading-relaxed">
              Monetize high-quality smart contract security audits, intelligence briefings, and analysis PDFs. Buyers pay instantly in APT; file extraction logic executes server-side after on-chain verification.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-2xl hover:border-slate-800 hover:bg-slate-900/70 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-medium text-white font-sans">Software & Move Modules</h3>
            <p className="text-slate-400 font-sans text-sm leading-relaxed">
              Distribute verified compiler configurations, optimized custom Move modules, and proprietary Web3 code templates. Set visibility parameters to protect proprietary engineering before final transaction.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-2xl hover:border-slate-800 hover:bg-slate-900/70 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-medium text-white font-sans">Secure IP Protection</h3>
            <p className="text-slate-400 font-sans text-sm leading-relaxed">
              Maintain private archives. All private files are encrypted client-side, tied to your specific Aptos wallet signature, and are inaccessible to anyone else on the network.
            </p>
          </div>
        </div>
      </section>

      {/* How It works Section */}
      <section className="py-24 bg-slate-950 max-w-7xl mx-auto px-6 lg:px-8 border-b border-slate-900" id="how-it-works-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-medium tracking-tight text-white mb-4">
            Under the Hood: Shelby Protocol Flow
          </h2>
          <p className="text-slate-400 font-sans max-w-xl mx-auto text-sm sm:text-base">
            Ensuring absolute, deterministic file protection with server-gated decryption keys and native Testnet checking.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 transform -translate-y-1/2 hidden md:block z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-900 text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto text-sm font-mono font-bold">1</div>
              <div className="mx-auto text-cyan-400 my-1"><Key className="w-5 h-5" /></div>
              <h4 className="text-base font-semibold text-white">Client Side Encrypt</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Files are compressed and encrypted locally inside the web browser using symmetric AES-256 techniques prior to transit.
              </p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-900 text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-sm font-mono font-bold">2</div>
              <div className="mx-auto text-indigo-400 my-1"><Server className="w-5 h-5" /></div>
              <h4 className="text-base font-semibold text-white">Shelby Node Anchor</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Encrypted payload is dispatched and anchored onto Shelby nodes using on-chain storage lease vouchers. Returns Shelby hash.
              </p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-900 text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto text-sm font-mono font-bold">3</div>
              <div className="mx-auto text-purple-400 my-1"><Coins className="w-5 h-5" /></div>
              <h4 className="text-base font-semibold text-white">Direct Web3 Tx</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Buyer executes direct peer-to-peer APT transaction to uploader's address using standard Aptos wallet signatures.
              </p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-900 text-center flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-sm font-mono font-bold">4</div>
              <div className="mx-auto text-emerald-400 my-1"><Shield className="w-5 h-5" /></div>
              <h4 className="text-base font-semibold text-white">Server Verification</h4>
              <p className="text-xs text-slate-400 leading-normal">
                Express backend verifies receipt of the transaction hash on-chain, and serves files decrypted only after verified payment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 max-w-3xl mx-auto px-6 border-b border-slate-900" id="faq-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-sans font-medium tracking-tight text-white mb-4">
            Frequently Answered Concerns
          </h2>
          <p className="text-slate-400 font-sans text-sm">
            Details about billing, networks, and storage node architecture.
          </p>
        </div>

        <div className="flex flex-col gap-6" id="faq-content-container">
          <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors flex gap-4">
            <div className="text-indigo-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-medium text-white mb-2 font-sans text-sm sm:text-base">What represents the Shelby Testnet Layer?</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                Shelby is a specialized high-performance decentralized storage network on Aptos, allowing modular files to lease network space directly via on-chain smart vouchers.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors flex gap-4">
            <div className="text-indigo-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-medium text-white mb-2 font-sans text-sm sm:text-base">Can someone bypass payment if they possess the Shelby Hash?</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                No. All uploads to Shelby through Circle Storage are encrypted locally. Decryption occurs only at the server boundary AFTER the backend verifies transaction completion on Aptos RPC.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors flex gap-4">
            <div className="text-indigo-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-medium text-white mb-2 font-sans text-sm sm:text-base">How does lease duration impact file preservation?</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                Uploader locks storage fee based on 7 days, 30 days, 90 days, or 365 days. If a lease expires, the file is un-anchored unless a contract top-up occurs.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors flex gap-4">
            <div className="text-indigo-400 mt-1"><HelpCircle className="w-5 h-5 flex-shrink-0" /></div>
            <div>
              <h4 className="font-medium text-white mb-2 font-sans text-sm sm:text-base">Why are Supabase API keys placed server-side?</h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                To guarantee zero exposure vectors. Client side bundles are transparent and prone to harvesting, so our Express gateway acts as the secure, authenticated shield.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-slate-500 text-xs border-t border-slate-950 bg-slate-950 font-mono">
        <p>© 2026 Circle Storage. Sovereign file marketplaces connected via Aptos & Shelby Protocol.</p>
      </footer>
    </div>
  );
}
