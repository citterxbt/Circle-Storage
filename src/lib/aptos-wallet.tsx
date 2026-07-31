/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useToast } from "../components/Toaster";

interface AptosWalletContextType {
  connected: boolean;
  address: string | null;
  walletName: string | null;
  balance: number; // calculated APT balance
  shelbyUSDBalance: number; // ShelbyUSD balance
  connect: (name: string) => Promise<boolean>;
  disconnect: () => void;
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  requestFaucet: () => void;
  availableWallets: string[];
  isDetected: (name: string) => boolean;
  /** True once the wallet has signed the server's nonce and a session cookie is held. */
  authenticated: boolean;
  /** A sign-in round trip is in flight. */
  signingIn: boolean;
  /** Why the last sign-in attempt failed, if it did. */
  authError: string | null;
  /** Re-run the sign-in handshake for the connected wallet. */
  signIn: () => Promise<boolean>;
}

const AptosWalletContext = createContext<AptosWalletContextType | undefined>(undefined);

// Keep a global registry of detected AIP-62 standard wallets to ensure async announcements are captured
let registeredStandardWallets: any[] = [];

if (typeof window !== "undefined") {
  // Capture any standard wallets registered before or during load
  if ((window as any).aptosWeb3?.wallets) {
    try {
      registeredStandardWallets = [...(window as any).aptosWeb3.wallets];
    } catch {}
  }

  const addStandardWallet = (wallet: any) => {
    if (!wallet || !wallet.name) return;
    if (!registeredStandardWallets.some(w => w.name === wallet.name)) {
      console.log(`[Circle Storage] [AIP-62 Registry] Registered standard wallet: "${wallet.name}"`);
      registeredStandardWallets.push(wallet);
      // Trigger a custom event to notify React to refresh its list of available wallets
      try {
        window.dispatchEvent(new CustomEvent("circle-storage-wallet-registered"));
      } catch {}
    }
  };

  try {
    // Listen to standard announce events
    window.addEventListener("wallet-standard:register-wallet", (event: any) => {
      try {
        if (event.detail && typeof event.detail.register === "function") {
          event.detail.register((wallet: any) => {
            addStandardWallet(wallet);
            return () => {}; // return unregister callback
          });
        }
      } catch (e) {
        console.warn("[Circle Storage] Error processing wallet-standard:register-wallet event:", e);
      }
    });

    window.addEventListener("aptos-wallet-announced", (event: any) => {
      try {
        if (event.detail) {
          addStandardWallet(event.detail);
        }
      } catch (e) {
        console.warn("[Circle Storage] Error processing aptos-wallet-announced event:", e);
      }
    });

    // Dispatch the app-ready event so existing/pre-loaded standard wallets register themselves immediately
    const dispatchAppReady = () => {
      console.log("[Circle Storage] [AIP-62 Dispatch] Broadcasting standard app-ready signals...");
      window.dispatchEvent(
        new CustomEvent("wallet-standard:app-ready", {
          detail: {
            register: (wallet: any) => {
              addStandardWallet(wallet);
            }
          }
        })
      );
    };

    dispatchAppReady();
    if (document.readyState === "complete") {
      dispatchAppReady();
    } else {
      window.addEventListener("load", () => {
        dispatchAppReady();
        setTimeout(dispatchAppReady, 200);
      });
    }
    setTimeout(dispatchAppReady, 100);
    setTimeout(dispatchAppReady, 500);
    setTimeout(dispatchAppReady, 1000);
    setTimeout(dispatchAppReady, 2000);
  } catch (err) {
    console.warn("[Circle Storage] Failed to initialize standard wallet event listeners:", err);
  }
}

// Helper function to safely locate the browser extension provider mapping a given name
const getWalletProvider = (name: string): any => {
  if (typeof window === "undefined") return null;
  
  const cleanName = name.replace(" (Sandbox)", "").trim();
  
  const findInList = (list: any[]) => {
    if (!list || !Array.isArray(list)) return null;
    return list.find((w: any) => {
      if (!w || !w.name) return false;
      const wName = w.name.toLowerCase().trim();
      const cName = cleanName.toLowerCase().trim();
      return (
        wName === cName ||
        wName.includes(cName) ||
        cName.includes(wName) ||
        (cName.includes("petra") && wName.includes("petra")) ||
        (cName.includes("martian") && wName.includes("martian")) ||
        (cName.includes("pontem") && wName.includes("pontem")) ||
        (cName.includes("rise") && wName.includes("rise")) ||
        (cName.includes("okx") && wName.includes("okx")) ||
        (cName.includes("trust") && wName.includes("trust")) ||
        (cName.includes("nightly") && wName.includes("nightly"))
      );
    });
  };

  // 1. Try from early-registered standard wallets (extremely reliable)
  const earlyFound = findInList(registeredStandardWallets);
  if (earlyFound) {
    console.log(`[Circle Storage] Standard AIP-62 registered wallet match for ${cleanName}:`, earlyFound.name);
    return earlyFound;
  }

  // 2. Try standard window.aptosWeb3 wallets
  if ((window as any).aptosWeb3) {
    const rx = (window as any).aptosWeb3.wallets || [];
    const found = findInList(rx);
    if (found) {
      console.log(`[Circle Storage] Standard AIP-62 window wallets match for ${cleanName}:`, found.name);
      return found;
    }
  }

  // 3. Try standard window.navigator.wallets fallbacks
  if ((window as any).navigator?.wallets) {
    try {
      const g = (window as any).navigator.wallets.get;
      if (typeof g === "function") {
        const found = findInList(g.call((window as any).navigator.wallets));
        if (found) {
          console.log(`[Circle Storage] Standard AIP-62 navigator wallets match for ${cleanName}:`, found.name);
          return found;
        }
      }
    } catch {}
  }

  // 4. Fallbacks for standard browser property spaces
  if (cleanName === "Petra Wallet" || cleanName === "Petra") {
    try {
      if ((window as any).petra) return (window as any).petra;
    } catch (e) {
      console.warn("[Circle Storage] Error checking window.petra fallback:", e);
    }
    try {
      if ((window as any).aptos) return (window as any).aptos;
    } catch (e) {
      console.warn("[Circle Storage] Error checking window.aptos fallback:", e);
    }
    return null;
  }
  if (cleanName === "Martian Wallet" || cleanName === "Martian") {
    return (window as any).martian;
  }
  if (cleanName === "Pontem Wallet" || cleanName === "Pontem") {
    return (window as any).pontem;
  }
  if (cleanName === "Rise Wallet" || cleanName === "Rise") {
    return (window as any).rise || (window as any).riseWallet;
  }
  if (cleanName === "Fewcha Wallet" || cleanName === "Fewcha") {
    return (window as any).fewcha;
  }
  if (cleanName === "OKX Wallet" || cleanName === "OKX") {
    try {
      if ((window as any).okx?.aptos) return (window as any).okx.aptos;
      if ((window as any).okx) return (window as any).okx;
    } catch {}
  }
  if (cleanName === "Trust Wallet" || cleanName === "Trust") {
    try {
      if ((window as any).trustWallet?.aptos) return (window as any).trustWallet.aptos;
      if ((window as any).trustWallet) return (window as any).trustWallet;
    } catch {}
  }
  if (cleanName === "Nightly Wallet" || cleanName === "Nightly") {
    try {
      if ((window as any).nightly?.aptos) return (window as any).nightly.aptos;
      if ((window as any).nightly) return (window as any).nightly;
    } catch {}
  }

  return null;
};

// Helper function to safely fetch legacy providers corresponding to standard names
const getLegacyProvider = (name: string): any => {
  if (typeof window === "undefined") return null;
  const cleanName = name.replace(" (Sandbox)", "").trim();
  const cName = cleanName.toLowerCase();

  if (cName.includes("petra")) {
    return (window as any).petra || (window as any).aptos;
  }
  if (cName.includes("martian")) {
    return (window as any).martian;
  }
  if (cName.includes("pontem")) {
    return (window as any).pontem;
  }
  if (cName.includes("rise")) {
    return (window as any).rise || (window as any).riseWallet;
  }
  if (cName.includes("fewcha")) {
    return (window as any).fewcha;
  }
  if (cName.includes("okx")) {
    return (window as any).okx?.aptos || (window as any).okx;
  }
  if (cName.includes("trust")) {
    return (window as any).trustWallet?.aptos || (window as any).trustWallet;
  }
  if (cName.includes("nightly")) {
    return (window as any).nightly?.aptos || (window as any).nightly;
  }
  return (window as any).aptos;
};

// Check if a wallet extension is active/installed dynamically
const checkWalletDetected = (name: string): boolean => {
  return !!getWalletProvider(name) || !!getLegacyProvider(name);
};

// Try to safely convert Uint8Array or standard number arrays to standard hex address string representation
const tryConvertBytesToHexAddress = (val: any): string | null => {
  if (!val) return null;
  
  // Uint8Array pattern
  if (val instanceof Uint8Array || (val.constructor && val.constructor.name === "Uint8Array")) {
    try {
      const hex = Array.from(val).map((b: any) => b.toString(16).padStart(2, "0")).join("");
      return "0x" + hex;
    } catch {}
  }
  
  // Array of 32 bytes
  if (Array.isArray(val) && val.length === 32 && val.every((x: any) => typeof x === "number" && x >= 0 && x <= 255)) {
    try {
      const hex = val.map((b: any) => b.toString(16).padStart(2, "0")).join("");
      return "0x" + hex;
    } catch {}
  }
  
  // Byte array objects that are not direct Arrays (e.g. Node Buffers or other array-like types)
  if (typeof val === "object" && typeof val.length === "number" && val.length === 32) {
    try {
      const arr = Array.from(val);
      if (arr.every((x: any) => typeof x === "number" && x >= 0 && x <= 255)) {
        const hex = arr.map((b: any) => b.toString(16).padStart(2, "0")).join("");
        return "0x" + hex;
      }
    } catch {}
  }
  
  return null;
};

// Helper function to cleanly resolve a primitive string representing a valid Aptos address (including standard AccountAddress object custom string representations)
const getAddressString = (value: any): string | null => {
  if (!value) return null;

  // 0. Try direct bytes conversion (Uint8Array, byte array etc)
  const bytesHex = tryConvertBytesToHexAddress(value);
  if (bytesHex) return bytesHex;

  // 1. If primitive string, validate and return
  if (typeof value === "string") {
    const clean = value.trim();
    if (/^0x[0-9a-fA-F]{1,66}$/.test(clean)) return clean;
    if (/^[0-9a-fA-F]{30,64}$/.test(clean)) return "0x" + clean;
    return null;
  }

  // 2. If standard AccountAddress/PubKey class representation instance (modern Aptos TS SDK and AIP-62 standard objects)
  if (typeof value === "object") {
    // Try custom byte conversion on properties if any
    for (const subKey of ["addressBytes", "bytes", "data", "b", "_b", "address_bytes"]) {
      try {
        const bHex = tryConvertBytesToHexAddress(value[subKey]);
        if (bHex) return bHex;
      } catch {}
    }

    try {
      if (typeof value.toString === "function") {
        const str = value.toString().trim();
        if (str && str !== "[object Object]") {
          if (/^0x[0-9a-fA-F]{1,66}$/.test(str)) return str;
          if (/^[0-9a-fA-F]{30,64}$/.test(str)) return "0x" + str;
        }
      }
    } catch {}

    const directKeys = [
      "address",
      "hexString",
      "value",
      "accountAddress",
      "walletAddress",
      "addressString",
      "longString",
      "publicKey",
      "pubKey",
      "activeAccount"
    ];
    for (const key of directKeys) {
      try {
        const subValue = value[key];
        if (subValue) {
          const res = getAddressString(subValue);
          if (res) return res;
        }
      } catch {}
    }
  }

  return null;
};

// Helper to cleanly extract standard-compliant Aptos cryptographic address payloads from response structures
const extractAddress = (payload: any): string | null => {
  if (!payload) return null;

  try {
    const directResult = getAddressString(payload);
    if (directResult) {
      console.log(`[Circle Storage] [extractAddress] Extracted address representation from direct structure: "${directResult}"`);
      return directResult;
    }

    if (Array.isArray(payload) && payload.length > 0) {
      for (let i = 0; i < payload.length; i++) {
        const res = getAddressString(payload[i]);
        if (res) {
          console.log(`[Circle Storage] [extractAddress] Extracted address from index [${i}]: "${res}"`);
          return res;
        }
      }
    }

    if (typeof payload === "object") {
      if (payload.accounts && Array.isArray(payload.accounts) && payload.accounts.length > 0) {
        for (let i = 0; i < payload.accounts.length; i++) {
          const res = getAddressString(payload.accounts[i]);
          if (res) {
            console.log(`[Circle Storage] [extractAddress] Extracted address from payload.accounts[${i}]: "${res}"`);
            return res;
          }
        }
      }

      const priorityKeys = ["address", "accountAddress", "walletAddress", "selectedAddress", "account", "activeAccount"];
      for (const key of priorityKeys) {
        try {
          const val = payload[key];
          if (val) {
            const res = getAddressString(val);
            if (res) {
              console.log(`[Circle Storage] [extractAddress] Extracted address using key "${key}": "${res}"`);
              return res;
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[Circle Storage] Direct extractAddress failed with exception:", err);
  }

  return null;
};

// Asynchronously probe any wallet instance or connection payload for a usable Aptos account address
const probeInstanceForAddress = async (instance: any): Promise<string | null> => {
  if (!instance) return null;
  console.log("[Circle Storage] [probeInstanceForAddress] Probing instance:", instance);

  // Try direct properties first before calling async methods
  const directSweep = extractAddress(instance) || findAptosAddress(instance);
  if (directSweep) {
    console.log("[Circle Storage] [probeInstanceForAddress] Found address in direct properties:", directSweep);
    return directSweep;
  }

  // Avoid calling deprecated functions on raw legacy Petra client
  const isRawPetra = typeof window !== "undefined" && (
    instance === (window as any).petra || 
    instance === (window as any).aptos || 
    (instance && typeof instance.name === "string" && instance.name.toLowerCase().includes("petra"))
  );

  if (!isRawPetra) {
    // Try calling account()
    if (typeof instance.account === "function") {
      try {
        const acc = await instance.account();
        console.log("[Circle Storage] [probeInstanceForAddress] Called instance.account():", acc);
        const res = extractAddress(acc) || findAptosAddress(acc);
        if (res) return res;
      } catch (e) {
        console.warn("[Circle Storage] Error pattern calling instance.account():", e);
      }
    }

    // Try calling accounts()
    if (typeof instance.accounts === "function") {
      try {
        const accs = await instance.accounts();
        console.log("[Circle Storage] [probeInstanceForAddress] Called instance.accounts():", accs);
        const res = extractAddress(accs) || findAptosAddress(accs);
        if (res) return res;
      } catch (e) {
        console.warn("[Circle Storage] Error pattern calling instance.accounts():", e);
      }
    }

    // Try calling getAccount()
    if (typeof instance.getAccount === "function") {
      try {
        const acc = await instance.getAccount();
        console.log("[Circle Storage] [probeInstanceForAddress] Called instance.getAccount():", acc);
        const res = extractAddress(acc) || findAptosAddress(acc);
        if (res) return res;
      } catch (e) {
        console.warn("[Circle Storage] Error pattern calling instance.getAccount():", e);
      }
    }
  }

  // Try direct provider.accounts getter (if standard AIP-62)
  if (instance.accounts && Array.isArray(instance.accounts) && instance.accounts.length > 0) {
    console.log("[Circle Storage] [probeInstanceForAddress] Found standard instance.accounts array:", instance.accounts);
    const res = extractAddress(instance.accounts) || findAptosAddress(instance.accounts);
    if (res) return res;
  }

  return null;
};

// Recursive Deep Scanner to locate valid Aptos addresses inside arbitrary wallet payload structures
const findAptosAddress = (obj: any, visited = new Set<any>()): string | null => {
  if (!obj) {
    return null;
  }
  if (visited.has(obj)) {
    return null;
  }

  const directCheck = extractAddress(obj);
  if (directCheck) {
    return directCheck;
  }

  if (typeof obj === "string") {
    const clean = obj.trim();
    if (/^0x[0-9a-fA-F]{3,66}$/.test(clean)) {
      return clean;
    }
    if (/^[0-9a-fA-F]{40,64}$/.test(clean)) {
      return "0x" + clean;
    }
  }

  if (Array.isArray(obj)) {
    visited.add(obj);
    for (let i = 0; i < obj.length; i++) {
      try {
        const addr = findAptosAddress(obj[i], visited);
        if (addr) {
          return addr;
        }
      } catch (e) {
        console.warn(`[Circle Storage] Error accessing array index [${i}] during recursion:`, e);
      }
    }
    return null;
  }

  if (typeof obj === "object") {
    visited.add(obj);
    let keys: string[] = [];
    try {
      keys = Object.keys(obj);
    } catch (e) {
      console.log("[Circle Storage] [findAptosAddress] Failed to retrieve object keys.");
    }

    const priorityKeys = ["address", "accountAddress", "walletAddress", "selectedAddress", "account", "activeAccount"];
    for (const key of priorityKeys) {
      try {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (value) {
            const addr = getAddressString(value) || findAptosAddress(value, visited);
            if (addr) {
              return addr;
            }
          }
        }
      } catch (propertyErr) {
        console.warn(`[Circle Storage] Skipping priority key "${key}" check on object due to access exception:`, propertyErr);
      }
    }

    for (const key of keys) {
      if (priorityKeys.includes(key)) continue;
      try {
        const value = obj[key];
        if (value && typeof value === "object") {
          if (key.startsWith("$$") || key.startsWith("__") || value.nodeType !== undefined || value === window || value === document) {
            continue;
          }
          const addr = findAptosAddress(value, visited);
          if (addr) {
            return addr;
          }
        }
      } catch (fallbackPropertyErr) {
        console.warn(`[Circle Storage] Skipping fallback key "${key}" check on object due to access exception:`, fallbackPropertyErr);
      }
    }
  }

  return null;
};

const bytesToHex = (bytes: Iterable<number>): string =>
  "0x" +
  Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

// Wallets return signatures and public keys in a handful of shapes: hex strings, byte arrays,
// or Aptos SDK class instances such as Ed25519Signature (which wraps a Hex, which wraps a
// Uint8Array). Reduce any of them to a plain "0x..." hex string.
const normalizeHex = (value: any): string | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const clean = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(clean)) return clean.toLowerCase();
    if (/^[0-9a-fA-F]+$/.test(clean)) return "0x" + clean.toLowerCase();
    return null;
  }

  if (value instanceof Uint8Array || value?.constructor?.name === "Uint8Array") {
    return bytesToHex(value as Uint8Array);
  }

  if (typeof value === "object") {
    // Ed25519Signature, Ed25519PublicKey and Hex all expose this, and it is exact.
    if (typeof value.toUint8Array === "function") {
      try {
        const bytes = value.toUint8Array();
        if (bytes && bytes.length > 0) return bytesToHex(bytes);
      } catch {}
    }

    try {
      if (typeof value.toString === "function") {
        const asString = value.toString();
        if (asString && asString !== "[object Object]") {
          const fromString = normalizeHex(asString);
          if (fromString) return fromString;
        }
      }
    } catch {}

    for (const key of ["data", "value", "signature", "publicKey", "key", "hexString"]) {
      try {
        const nested = normalizeHex(value[key]);
        if (nested) return nested;
      } catch {}
    }

    if (Array.isArray(value) && value.length > 0) {
      return normalizeHex(value[0]);
    }
  }

  return null;
};

/**
 * Dig the account's public key out of a provider. Petra's legacy `account()` includes it, and
 * AIP-62 providers expose it on their account objects. The server needs it to confirm the key
 * actually controls the address being claimed.
 */
const resolveWalletPublicKey = async (provider: any): Promise<string | null> => {
  if (!provider) return null;

  const fromAccountObject = (account: any): string | null => {
    if (!account) return null;
    if (Array.isArray(account)) return fromAccountObject(account[0]);
    return normalizeHex(account.publicKey ?? account.public_key);
  };

  try {
    const direct = fromAccountObject(provider.accounts) || fromAccountObject(provider.account);
    if (direct) return direct;
  } catch {}

  try {
    const key = normalizeHex(provider.publicKey);
    if (key) return key;
  } catch {}

  // AIP-62 account feature
  try {
    const feature = provider.features?.["aptos:account"];
    if (feature && typeof feature.account === "function") {
      const key = fromAccountObject(await feature.account());
      if (key) return key;
    }
  } catch {}

  // Legacy account() call
  try {
    if (typeof provider.account === "function") {
      const key = fromAccountObject(await provider.account());
      if (key) return key;
    }
  } catch {}

  return null;
};

/**
 * Pull the transaction hash out of a submit response. AIP-62 wraps it as { status, args },
 * legacy providers return it flat, and some return the hash as a bare string.
 */
const readTransactionHash = (result: any): string | null => {
  if (!result) return null;

  if (typeof result === "string") {
    return /^0x[0-9a-fA-F]{1,64}$/.test(result.trim()) ? result.trim() : null;
  }

  const status = result.status;
  if (typeof status === "string" && status.toLowerCase() === "rejected") return null;

  const body = result.args || result;
  for (const key of ["hash", "transactionHash", "txnHash", "tx_hash"]) {
    const candidate = body?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return null;
};

/** The network this app is built against. Signing anywhere else is refused. */
const EXPECTED_CHAIN_ID = 2; // Aptos testnet
const EXPECTED_NETWORK_NAME = "testnet";

/** Node API used for read-only lookups such as balances. */
const APTOS_FULLNODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";

/**
 * ShelbyUSD on Aptos testnet, as published by the fungible asset registry:
 * name "ShelbyUSD", symbol "SHELBY_USD", 8 decimals.
 */
const SHELBY_USD_ASSET_TYPE =
  "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1";
const SHELBY_USD_DECIMALS = 8;

/**
 * Call a read-only Move view and return its first return value, or null if the node refused.
 */
const callView = async (
  fn: string,
  typeArguments: string[],
  args: unknown[]
): Promise<string | null> => {
  const response = await fetch(`${APTOS_FULLNODE_URL}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function: fn, type_arguments: typeArguments, arguments: args })
  });

  if (!response.ok) {
    console.warn(
      `[Circle Storage] View ${fn} returned HTTP ${response.status}.`,
      await response.text().catch(() => "")
    );
    return null;
  }

  const [value] = await response.json();
  return value === undefined || value === null ? null : String(value);
};

/** Read the wallet's current network across the standard and legacy shapes. */
const readWalletNetwork = async (provider: any): Promise<{ name?: string; chainId?: number } | null> => {
  const parse = (value: any): { name?: string; chainId?: number } | null => {
    if (!value) return null;
    if (typeof value === "string") return { name: value.toLowerCase() };
    const name = typeof value.name === "string" ? value.name.toLowerCase() : undefined;
    const rawChain = value.chainId ?? value.chain_id;
    const chainId = rawChain === undefined || rawChain === null ? undefined : Number(rawChain);
    if (name === undefined && chainId === undefined) return null;
    return { name, chainId };
  };

  const feature = provider?.features?.["aptos:network"] || provider?.features?.["aptos:getNetwork"];
  if (feature) {
    for (const fn of [feature.network, feature.getNetwork]) {
      if (typeof fn === "function") {
        try {
          const parsed = parse(await fn.call(feature));
          if (parsed) return parsed;
        } catch {}
      }
    }
  }

  for (const fnName of ["network", "getNetwork"]) {
    try {
      if (typeof provider?.[fnName] === "function") {
        const parsed = parse(await provider[fnName]());
        if (parsed) return parsed;
      }
    } catch {}
  }

  try {
    const parsed = parse(provider?.network);
    if (parsed) return parsed;
  } catch {}

  return null;
};

/**
 * Throw unless the wallet is on the expected network.
 *
 * When the network cannot be read at all we proceed with a warning rather than blocking, since
 * not every provider exposes it — meaning this guard reduces the risk of a mainnet transfer
 * but cannot rule it out for wallets that stay silent about their network.
 */
const assertExpectedNetwork = async (provider: any): Promise<void> => {
  const network = await readWalletNetwork(provider);

  if (!network) {
    console.warn(
      "[Circle Storage] Wallet did not report its network; proceeding without a network check."
    );
    return;
  }

  const nameMatches = network.name ? network.name.includes(EXPECTED_NETWORK_NAME) : undefined;
  const chainMatches =
    network.chainId === undefined ? undefined : network.chainId === EXPECTED_CHAIN_ID;

  if (nameMatches === false || chainMatches === false) {
    const reported = network.name || `chain ${network.chainId}`;
    throw new Error(
      `Your wallet is connected to ${reported}, but Circle Storage runs on Aptos testnet. ` +
        `Switch the network in your wallet before signing, otherwise you could move real funds.`
    );
  }
};

/**
 * Turn whatever a wallet or the network threw into something a user can act on.
 *
 * Wallets reject with plain objects, numeric codes, or strings as often as with real Errors, so
 * `err.message` is frequently empty — and reporting "sign-in failed" with no reason hides the
 * one detail needed to fix it.
 */
const describeError = (err: any): string => {
  if (!err) return "Wallet sign-in failed for an unknown reason.";
  if (typeof err === "string") return err;

  if (err.message) {
    // Petra reports a declined request as code 4001.
    return err.code ? `${err.message} (code ${err.code})` : String(err.message);
  }

  if (err.code === 4001) return "You declined the signature request in your wallet.";
  if (err.code) return `Wallet returned error code ${err.code}.`;
  if (err.name) return `Wallet sign-in failed: ${err.name}.`;

  try {
    const asJson = JSON.stringify(err);
    if (asJson && asJson !== "{}") return `Wallet sign-in failed: ${asJson.slice(0, 200)}`;
  } catch {}

  return "Wallet sign-in failed and the wallet gave no reason. See the browser console.";
};

/** Compare two Aptos addresses, which may be written with different zero padding. */
const sameAddress = (a: string, b: string): boolean => {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return normalize(a) === normalize(b);
};

const truncate = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

/** Locate the wallet's signMessage entry point, standard first then legacy. */
const getSignMessageFn = (provider: any): ((input: any) => Promise<any>) | null => {
  if (!provider) return null;

  const feature =
    provider.features?.["aptos:signMessage"] || provider.features?.["standard:signMessage"];
  if (feature && typeof feature.signMessage === "function") {
    return (input: any) => feature.signMessage(input);
  }

  if (typeof provider.signMessage === "function") {
    return (input: any) => provider.signMessage(input);
  }

  return null;
};

export function AptosWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0.00); 
  const [shelbyUSDBalance, setShelbyUSDBalance] = useState<number>(0.00); 
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const toast = useToast();

  // The public key that came back with the connection, needed so the server can tie the
  // signature to the claimed address.
  const publicKeyRef = useRef<string | null>(null);

  const isDetected = (name: string): boolean => {
    return checkWalletDetected(name);
  };

  /**
   * Prove control of the address to the server: fetch a nonce, have the wallet sign it, and
   * exchange the signature for a session cookie. Until this succeeds the API rejects every
   * write and every download.
   */
  const establishSession = async (
    targetAddress: string,
    targetWalletName: string,
    publicKey: string | null
  ): Promise<boolean> => {
    setSigningIn(true);
    setAuthError(null);

    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress })
      });

      if (!nonceRes.ok) {
        const details = await nonceRes.json().catch(() => ({}));
        throw new Error(details.error || "Server refused to issue a sign-in nonce.");
      }

      const { nonce, message } = await nonceRes.json();

      const provider = getWalletProvider(targetWalletName) || getLegacyProvider(targetWalletName);
      const signMessage = getSignMessageFn(provider);
      if (!signMessage) {
        throw new Error(
          `${targetWalletName} does not expose a signMessage method, so ownership of the ` +
            `address cannot be proven. Try a wallet that supports the Aptos wallet standard.`
        );
      }

      const signed = await signMessage({
        message,
        nonce,
        address: true,
        application: true,
        chainId: true
      });

      // AIP-62 wraps the result as { status, args }, while legacy providers return the fields
      // flat. Unwrap before reading anything out of it.
      const status = signed?.status;
      if (typeof status === "string" && status.toLowerCase() === "rejected") {
        throw new Error("You declined the sign-in signature request.");
      }
      const signedArgs = signed?.args || signed;

      const signature = normalizeHex(signedArgs?.signature);
      const fullMessage: string = signedArgs?.fullMessage || signedArgs?.full_message || "";
      const resolvedKey =
        publicKey ||
        normalizeHex(signedArgs?.publicKey) ||
        (await resolveWalletPublicKey(provider));

      if (!signature || !fullMessage || !resolvedKey) {
        // Log the actual shape so an unfamiliar wallet response can be diagnosed quickly.
        console.error("[Circle Storage] Unusable signMessage response:", {
          topLevelKeys: signed ? Object.keys(signed) : null,
          argKeys: signedArgs ? Object.keys(signedArgs) : null,
          signatureType: signedArgs?.signature?.constructor?.name,
          haveSignature: !!signature,
          haveFullMessage: !!fullMessage,
          havePublicKey: !!resolvedKey,
          raw: signed
        });
      }

      if (!signature) throw new Error("Wallet returned a signature in an unrecognised format.");
      if (!fullMessage) throw new Error("Wallet did not return the signed payload.");
      if (!resolvedKey) throw new Error("Could not determine the wallet's public key.");

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: targetAddress,
          publicKey: resolvedKey,
          signature,
          fullMessage,
          nonce
        })
      });

      if (!verifyRes.ok) {
        const details = await verifyRes.json().catch(() => ({}));
        throw new Error(details.message || "Server rejected the wallet signature.");
      }

      setAuthenticated(true);
      return true;
    } catch (err: any) {
      console.error("[Circle Storage] Wallet sign-in failed:", err);
      setAuthenticated(false);
      setAuthError(describeError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  /**
   * Adopt the account the wallet has switched to.
   *
   * The old session belongs to the previous address, so it is dropped rather than left to fail
   * server-side checks later. The user signs in again, deliberately, as whoever they now are.
   */
  const handleAccountChange = async (newAddress: string) => {
    if (address && sameAddress(newAddress, address)) return;

    console.log(`[Circle Storage] Wallet switched account to ${newAddress}`);
    setAddress(newAddress);
    setAuthenticated(false);
    setAuthError(null);
    publicKeyRef.current = null;
    localStorage.setItem("aptos_wallet_address", newAddress);

    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    toast.info(`Wallet switched to ${truncate(newAddress)}. Sign in again to continue.`);
  };

  // Follow the wallet's own account switches, so the app does not keep acting as an account the
  // user has moved away from.
  useEffect(() => {
    if (!walletName) return;

    const provider = getWalletProvider(walletName) || getLegacyProvider(walletName);
    const feature = provider?.features?.["aptos:onAccountChange"];
    if (!feature || typeof feature.onAccountChange !== "function") return;

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = feature.onAccountChange(async (account: any) => {
        const next = extractAddress(account) || (await probeInstanceForAddress(account));
        if (next) await handleAccountChange(next);
      });
    } catch (err) {
      console.warn("[Circle Storage] Could not subscribe to wallet account changes:", err);
    }

    return () => {
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [walletName, address]);

  const signIn = async (): Promise<boolean> => {
    if (!walletName) {
      setAuthError("Connect a wallet before signing in.");
      return false;
    }

    // A reload restores the remembered address but not the wallet connection, so the provider
    // has no account to sign with and no public key to offer. Reconnect in that case rather
    // than failing — otherwise the only way through is to disconnect and start again, which
    // nobody should have to work out for themselves.
    const provider = getWalletProvider(walletName) || getLegacyProvider(walletName);
    const key = publicKeyRef.current || (await resolveWalletPublicKey(provider));

    if (!address || !key) {
      return connect(walletName);
    }

    // Sign in as whoever the wallet currently is. If it has switched accounts since we last
    // looked, signing with the remembered address would produce a payload naming a different
    // one, which the server refuses — so adopt the active account instead of failing.
    const activeAddress = await probeInstanceForAddress(provider);
    if (activeAddress && !sameAddress(activeAddress, address)) {
      console.log(
        `[Circle Storage] Signing in as the wallet's current account ${activeAddress}, ` +
          `not the remembered ${address}`
      );
      setAddress(activeAddress);
      localStorage.setItem("aptos_wallet_address", activeAddress);
      const activeKey = (await resolveWalletPublicKey(provider)) || key;
      publicKeyRef.current = activeKey;
      return establishSession(activeAddress, walletName, activeKey);
    }

    publicKeyRef.current = key;
    return establishSession(address, walletName, key);
  };

  // Detect injected web3 options on load
  useEffect(() => {
    const detectInjectedWallets = () => {
      const detectedList: string[] = [];
      const testList = [
        "Petra Wallet",
        "Martian Wallet",
        "Pontem Wallet",
        "Rise Wallet",
        "Fewcha Wallet",
        "OKX Wallet",
        "Trust Wallet",
        "Nightly Wallet"
      ];

      for (const wallet of testList) {
        if (checkWalletDetected(wallet)) {
          if (detectedList.indexOf(wallet) === -1) {
            detectedList.push(wallet);
          }
        }
      }

      // Check generic objects in standard registry
      if (typeof window !== "undefined" && (window as any).aptosWeb3) {
        const standardWallets = (window as any).aptosWeb3.wallets || [];
        for (const wallet of standardWallets) {
          if (wallet.name && detectedList.indexOf(wallet.name) === -1) {
            detectedList.push(wallet.name);
          }
        }
      }

      // Always maintain at least a high-contrast standard prompt options as suggested by context
      // sorted with real detected extensions at the very top
      const backupList = ["Petra Wallet", "Martian Wallet", "Pontem Wallet"];
      for (const backup of backupList) {
        if (detectedList.indexOf(backup) === -1) {
          detectedList.push(backup);
        }
      }

      setAvailableWallets(detectedList);
    };

    detectInjectedWallets();
    // Re-run standard listener check
    if (typeof window !== "undefined") {
      window.addEventListener("wallet-standard:register-wallet", detectInjectedWallets);
      window.addEventListener("aptos-wallet-announced", detectInjectedWallets);
      window.addEventListener("circle-storage-wallet-registered", detectInjectedWallets);
    }

    // Restore a previous session. The server is the authority on which address is signed in;
    // localStorage only remembers which wallet to talk to.
    const savedAddress = localStorage.getItem("aptos_wallet_address");
    const savedWallet = localStorage.getItem("aptos_wallet_name");

    fetch("/api/auth/session")
      .then(res => (res.ok ? res.json() : null))
      .then(session => {
        if (session?.address) {
          setAddress(session.address);
          setConnected(true);
          setAuthenticated(true);
          if (savedWallet) setWalletName(savedWallet);
        } else {
          // A remembered address without a valid session is not signed in.
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false));

    if (savedAddress && savedWallet) {
      setAddress(savedAddress);
      setConnected(true);
      setWalletName(savedWallet);

      // Both balances are read from chain by the effect below, so nothing is restored here.
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wallet-standard:register-wallet", detectInjectedWallets);
        window.removeEventListener("aptos-wallet-announced", detectInjectedWallets);
        window.removeEventListener("circle-storage-wallet-registered", detectInjectedWallets);
      }
    };
  }, []);

  /**
   * Read both balances from chain. These are the only writers of `balance` and
   * `shelbyUSDBalance`: neither is ever adjusted locally, so what the UI shows is what the
   * account actually holds.
   *
   * APT is read through the `0x1::coin::balance` view rather than by looking for a
   * `0x1::coin::CoinStore<AptosCoin>` resource. Since APT migrated to the fungible asset
   * standard, funded accounts generally carry no CoinStore at all, so scanning resources
   * reports zero for them; the view covers both the legacy store and the migrated balance.
   *
   * ShelbyUSD is a fungible asset, so it is read from its primary store. Accounts that hold
   * none answer "0" rather than failing, so an absent store needs no special case.
   *
   * A failed lookup leaves the previous figure in place instead of flashing a misleading zero.
   */
  const refreshOnChainBalance = async (targetAddress: string | null) => {
    if (!targetAddress) return;

    const [apt, shelby] = await Promise.all([
      callView("0x1::coin::balance", ["0x1::aptos_coin::AptosCoin"], [targetAddress]).catch(
        (error) => {
          console.warn("[Circle Storage] Could not read the on-chain APT balance:", error);
          return null;
        }
      ),
      callView(
        "0x1::primary_fungible_store::balance",
        ["0x1::fungible_asset::Metadata"],
        [targetAddress, SHELBY_USD_ASSET_TYPE]
      ).catch((error) => {
        console.warn("[Circle Storage] Could not read the on-chain ShelbyUSD balance:", error);
        return null;
      })
    ]);

    if (apt !== null) {
      setBalance(Number(apt) / 100_000_000);
    }
    if (shelby !== null) {
      setShelbyUSDBalance(Number(shelby) / 10 ** SHELBY_USD_DECIMALS);
    }
  };

  // Keep the displayed balance in step with the connected account
  useEffect(() => {
    if (connected && address) {
      refreshOnChainBalance(address);
    } else {
      setBalance(0.00);
      setShelbyUSDBalance(0.00);
    }
  }, [connected, address]);

  const connect = async (name: string): Promise<boolean> => {
    try {
      console.log(`[Circle Storage] [Connection Sequence Initialized] Target wallet: "${name}"`);
      const cleanName = name.replace(" (Sandbox)", "").trim();
      
      let walletAddress: string | null = null;

      const provider = getWalletProvider(cleanName);
      const legacyProvider = getLegacyProvider(cleanName);

      console.log(`[Circle Storage] [Connection Provider Probe] Fetched references for "${cleanName}":`, {
        providerType: provider ? typeof provider : "null",
        legacyType: legacyProvider ? typeof legacyProvider : "null",
        hasFeatures: provider && provider.features ? Object.keys(provider.features) : []
      });

      if (!provider && !legacyProvider) {
        console.warn(`[Circle Storage] [Connection Error] Provider reference not found for "${cleanName}". Checking environment frame details...`);
        const isNestedFrame = typeof window !== "undefined" && window.self !== window.top;
        if (isNestedFrame) {
          throw new Error(
            `Web3 injection restricted inside nested previews.\n\n` +
            `Under standard browser security policies, browser extensions like Petra Wallet cannot inject their Web3 context ("window.aptos") inside nested editor preview iframes.\n\n` +
            `To connect your real wallet, please click the "Open in New Tab" button at the top-right of your screen.`
          );
        } else {
          throw new Error(
            `The "${cleanName}" extension was not detected on this browser.\n\n` +
            `Please ensure the Petra Wallet extension is active on your browser, then refresh the page to connect.`
          );
        }
      }

      // 1. Try modern Aptos Wallet Standard (AIP-62) connect feature first
      if (provider) {
        const connectFeature = provider.features?.['standard:connect'] || provider.features?.['aptos:connect'];
        if (connectFeature) {
          try {
            console.log(`[Circle Storage] [AIP-62 Connect Stage] Triggering standard connect request for user wallet: "${cleanName}"...`);
            const result = await connectFeature.connect();
            console.log(`[Circle Storage] [AIP-62 Connect Complete] Response payload:`, result);
            
            // Extract accounts from result or provider state directly first
            if (result && result.accounts && Array.isArray(result.accounts) && result.accounts.length > 0) {
              const standardAcc = result.accounts[0];
              if (standardAcc && standardAcc.address) {
                walletAddress = standardAcc.address;
                console.log(`[Circle Storage] Resolved standard account address via connect result.accounts[0]: "${walletAddress}"`);
              }
            }

            if (!walletAddress && provider.accounts && Array.isArray(provider.accounts) && provider.accounts.length > 0) {
              const standardAcc = provider.accounts[0];
              if (standardAcc && standardAcc.address) {
                walletAddress = standardAcc.address;
                console.log(`[Circle Storage] Resolved standard account address via provider.accounts[0]: "${walletAddress}"`);
              }
            }

            if (!walletAddress) {
              walletAddress = await probeInstanceForAddress(result);
              console.log(`[Circle Storage] [Address Scan Step 1] Check on response container yields address: "${walletAddress}"`);
            }
            
            if (!walletAddress) {
              console.log(`[Circle Storage] [Address Scan Step 2] Fetching directly from root standard provider state...`);
              walletAddress = await probeInstanceForAddress(provider);
              console.log(`[Circle Storage] [Address Scan Step 2 Results] Direct sweep yields address: "${walletAddress}"`);
            }
          } catch (aip62Err) {
            console.warn(`[Circle Storage] [AIP-62 Alert] Standard AIP-62 connection attempt threw error or bypassed:`, aip62Err);
          }
        } else {
          console.log(`[Circle Storage] [AIP-62 Probe] No AIP-62 connect standard features registered for provider: "${cleanName}"`);
        }
      }

      // 2. Fall back to legacy providers connect() or property extraction
      if (!walletAddress) {
        console.log(`[Circle Storage] [Legacy Fallback Processing] Falling back to Legacy connect/account pathways for: "${cleanName}"`);
        const activeProviders = [provider, legacyProvider].filter(Boolean);
        for (let i = 0; i < activeProviders.length; i++) {
          const prov = activeProviders[i];
          if (walletAddress) break;

          const isLegacyConflict = typeof window !== "undefined" && (
            prov === (window as any).petra || 
            prov === (window as any).aptos || 
            (prov && typeof prov.name === "string" && prov.name.toLowerCase().includes("petra"))
          );

          // A. If legacy conflict object has standard AIP-62 features, use standard features first to bypass deprecation stubs
          if (isLegacyConflict && prov.features) {
            const connectFeature = prov.features['standard:connect'] || prov.features['aptos:connect'];
            if (connectFeature) {
              try {
                console.log(`[Circle Storage] [Legacy Conflict Resolution] Connecting legacy conflict using standard AIP-62 features...`);
                const result = await connectFeature.connect();
                if (result && result.accounts && Array.isArray(result.accounts) && result.accounts.length > 0) {
                  walletAddress = result.accounts[0].address;
                }
                if (!walletAddress && prov.accounts && Array.isArray(prov.accounts) && prov.accounts.length > 0) {
                  walletAddress = prov.accounts[0].address;
                }
              } catch (subErr) {
                console.warn("[Circle Storage] Failed inside legacy conflict features connect:", subErr);
              }
            }
          }

          // B. Try direct Legacy connect method if not a conflict or if conflict did not resolve
          if (!walletAddress && !isLegacyConflict && typeof prov.connect === "function") {
            try {
              console.log(`[Circle Storage] [Legacy Connect Stage] Triggering prov.connect() invocation...`);
              const response = await prov.connect();
              console.log(`[Circle Storage] [Legacy Connect Complete] Returned response payload:`, response);
              walletAddress = await probeInstanceForAddress(response) || await probeInstanceForAddress(prov);
              console.log(`[Circle Storage] [Address Scan Step 3] Check on response/provider payload: "${walletAddress}"`);
            } catch (connectErr: any) {
              console.warn(`[Circle Storage] [Legacy Connect Error] connect() call failed on provider:`, connectErr?.message || connectErr);
              // Fallback: If it's a DeprecatedApiError/warning, maybe standard window.aptos features can be used on it!
              if (prov.features) {
                try {
                  const subConn = prov.features['standard:connect'] || prov.features['aptos:connect'];
                  if (subConn && typeof subConn.connect === "function") {
                    console.log("[Circle Storage] Using standard features fallback on throw provider...");
                    const subRes = await subConn.connect();
                    walletAddress = await probeInstanceForAddress(subRes) || await probeInstanceForAddress(prov);
                  }
                } catch (subErr) {
                  console.warn("[Circle Storage] Failed inside features fallback:", subErr);
                }
              }
            }
          }

          // C. Try direct Legacy account method
          if (!walletAddress && !isLegacyConflict && typeof prov.account === "function") {
            try {
              console.log(`[Circle Storage] [Legacy Account Stage] Triggering legacy prov.account() invocation...`);
              const acc = await prov.account();
              console.log(`[Circle Storage] [Legacy Account Complete] Returned response payload:`, acc);
              walletAddress = await probeInstanceForAddress(acc);
              console.log(`[Circle Storage] [Address Scan Step 4] Check on legacy account response: "${walletAddress}"`);
            } catch (accErr: any) {
              console.warn(`[Circle Storage] [Legacy Account Error] account() check failed:`, accErr?.message || accErr);
            }
          }

          // D. Checking standard properties directly on provider metadata
          if (!walletAddress) {
            try {
              console.log(`[Circle Storage] [Direct Extraction Stage] Sweeping direct properties on provider instance...`);
              walletAddress = await probeInstanceForAddress(prov);
              console.log(`[Circle Storage] [Address Scan Step 5] Check on direct properties: "${walletAddress}"`);
            } catch (sweepErr) {
              console.warn("[Circle Storage] Probe direct sweep error:", sweepErr);
            }
          }
        }
      }

      // 3. Last resort fallback to standard global window contexts if we STILL have no address
      if (!walletAddress && typeof window !== "undefined") {
        console.warn(`[Circle Storage] [Rescue Fallback Stage] Address not found yet. Searching globally on window namespace...`);
        const fallbackCandidates = [
          { label: "window.petra", instance: (window as any).petra },
          { label: "window.aptos", instance: (window as any).aptos },
          { label: "window.martian", instance: (window as any).martian },
          { label: "window.pontem", instance: (window as any).pontem },
          { label: "window.riseWallet", instance: (window as any).riseWallet },
          { label: "window.rise", instance: (window as any).rise }
        ];

        for (const cand of fallbackCandidates) {
          if (cand.instance) {
            console.log(`[Circle Storage] [Rescue Candidate Probing] Probing global: "${cand.label}"`);
            try {
              const isCandLegacyConflict = cand.label.includes("petra") || cand.label.includes("aptos") || (cand.instance && typeof cand.instance.name === "string" && cand.instance.name.toLowerCase().includes("petra"));

              // A. If candidate has standard AIP-62 features, connect using standard Connect
              if (cand.instance.features) {
                try {
                  const connFeature = cand.instance.features['standard:connect'] || cand.instance.features['aptos:connect'];
                  if (connFeature && typeof connFeature.connect === "function") {
                    console.log(`[Circle Storage] [Rescue AIP-62 Connect] Triggering standard connect on: ${cand.label}`);
                    const connRes = await connFeature.connect();
                    if (connRes && connRes.accounts && Array.isArray(connRes.accounts) && connRes.accounts.length > 0) {
                      walletAddress = connRes.accounts[0].address;
                    }
                    if (!walletAddress && cand.instance.accounts && Array.isArray(cand.instance.accounts) && cand.instance.accounts.length > 0) {
                      walletAddress = cand.instance.accounts[0].address;
                    }
                    if (!walletAddress) {
                      walletAddress = await probeInstanceForAddress(connRes) || await probeInstanceForAddress(cand.instance);
                    }
                  }
                } catch (stdErr: any) {
                  console.warn(`[Circle Storage] Standard connect failed on rescue candidate ${cand.label}:`, stdErr?.message || stdErr);
                }
              }

              // B. Try legacy connect if not standard or if standard connect did not yield address AND not a legacy conflict
              if (!walletAddress && !isCandLegacyConflict && typeof cand.instance.connect === "function") {
                try {
                  console.log(`[Circle Storage] [Rescue Legacy Connect] Invoking cand.instance.connect() for ${cand.label}`);
                  const connRes = await cand.instance.connect();
                  walletAddress = await probeInstanceForAddress(connRes) || await probeInstanceForAddress(cand.instance);
                } catch (legacyErr: any) {
                  console.warn(`[Circle Storage] Legacy connect failed on rescue candidate ${cand.label}:`, legacyErr?.message || legacyErr);
                }
              }

              // C. Check isConnected safely (wrapping in try-catch to absorb Petra DeprecatedApiError)
              if (!walletAddress && !isCandLegacyConflict && typeof cand.instance.isConnected === "function") {
                try {
                  console.log(`[Circle Storage] Checking isConnected on ${cand.label} safely...`);
                  const isConnected = await cand.instance.isConnected();
                  if (isConnected) {
                    walletAddress = await probeInstanceForAddress(cand.instance);
                  }
                } catch (chkErr: any) {
                  console.warn(`[Circle Storage] Safely caught isConnected check thrown on ${cand.label}:`, chkErr?.message || chkErr);
                }
              }

              // D. Fall back to sweeping properties recursively
              if (!walletAddress) {
                walletAddress = await probeInstanceForAddress(cand.instance);
              }

              if (walletAddress) {
                console.log(`[Circle Storage] [Rescue Success] Resolved address from candidate "${cand.label}": "${walletAddress}"`);
                break;
              }
            } catch (fallbackErr: any) {
              console.warn(`[Circle Storage] [Rescue Candidate Error] Fallback helper lookup failed on candidate ${cand.label}:`, fallbackErr?.message || fallbackErr);
            }
          }
        }
      }

      if (!walletAddress) {
        console.error(`[Circle Storage] [Resolution Failure] Connection trace complete. Error: walletAddress state could not be resolved.`);
        const isNestedFrame = typeof window !== "undefined" && window.self !== window.top;
        if (isNestedFrame) {
          throw new Error(
            `A connection was established with your browser extension, but communication is restricted inside embedded preview containers.\n\n` +
            `Under modern cross-origin privacy and security rules (such as AIP-62 standard protection), browser wallets (such as Petra) block account-sharing inside nested iFrame code editors.\n\n` +
            `To connect your wallet securely, please click the "Open in New Tab" button in the top-right corner of this screen, and connect from there!`
          );
        }
        throw new Error(
          `A connection was made to the extension but we could not resolve your account's cryptographic address.\n\n` +
          `Please make sure your Petra wallet is unlocked and has at least one account created.`
        );
      }

      // Format clean address values - make sure it starts with 0x and is properly trimmed
      if (typeof walletAddress !== "string") {
        walletAddress = String(walletAddress);
      }
      walletAddress = walletAddress.trim();
      
      // Enforce robust "0x" prefix checks and correct structure validation
      if (!walletAddress.startsWith("0x")) {
        console.log(`[Circle Storage] [Address Normalization] Resolved address missing "0x" prefix. Prepending "0x" to raw hex string.`);
        walletAddress = "0x" + walletAddress;
      }

      console.log(`[Circle Storage] [Address Normalization Complete] Target address payload evaluated: "${walletAddress}"`);
      
      // Robust Address Verification Step
      const cleanAddressPart = walletAddress.substring(2);
      const isHexChars = /^[0-9a-fA-F]+$/.test(cleanAddressPart);
      const isCorrectLength = walletAddress.length >= 3 && walletAddress.length <= 66;

      if (!isHexChars || !isCorrectLength) {
        console.error("[Circle Storage] [Verification Severity High] CRITICAL: Parsed address validation failed!", {
          address: walletAddress,
          isHexChars,
          isCorrectLength,
          length: walletAddress.length
        });
        throw new Error(
          `Resolved wallet account address "${walletAddress}" is not a cryptographically valid Aptos string (must start with "0x" and be up to 66 valid hex characters).`
        );
      }

      console.log(`[Circle Storage] [Verification Success] Security checks PASSED for account: "${walletAddress}"`);
      setAddress(walletAddress);
      setConnected(true);
      setWalletName(cleanName);

      localStorage.setItem("aptos_wallet_address", walletAddress);
      localStorage.setItem("aptos_wallet_name", cleanName);

      // Balances are whatever the chain says, so read them rather than seeding figures.
      await refreshOnChainBalance(walletAddress);

      // Capture the public key while the provider is still in hand: the server needs it to
      // check that this key really controls the address we just resolved.
      publicKeyRef.current =
        (await resolveWalletPublicKey(provider)) || (await resolveWalletPublicKey(legacyProvider));

      // Connecting alone grants nothing server-side; the signature does.
      await establishSession(walletAddress, cleanName, publicKeyRef.current);

      return true;
    } catch (err: any) {
      console.error(`[Circle Storage] Failed to connect to actual wallet extension ${name}:`, err);
      setAuthError(describeError(err));
      toast.error(`Could not connect to ${name}: ${describeError(err)}`);
      return false;
    }
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
    setWalletName(null);
    setBalance(0.00);
    setShelbyUSDBalance(0.00);
    setAuthenticated(false);
    setAuthError(null);
    publicKeyRef.current = null;
    localStorage.removeItem("aptos_wallet_address");
    localStorage.removeItem("aptos_wallet_name");

    // Drop the server session too, otherwise the cookie outlives the disconnect.
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  // Submit a transaction through the connected wallet. There is no fallback: if the wallet
  // cannot or will not sign, this throws, because a fabricated hash would be indistinguishable
  // from a real receipt to anything downstream.
  const signAndSubmitTransaction = async (payload: any): Promise<{ hash: string }> => {
    console.log("[Circle Storage] Submitting transaction payload to extension:", payload);

    if (!address) {
      throw new Error("No connected wallet found for signing transaction.");
    }
    if (!walletName) {
      throw new Error("No wallet is connected to sign this transaction.");
    }

    if (payload.amount && balance < payload.amount) {
      throw new Error(
        `Insufficient funds: transaction needs ${payload.amount} APT, but the wallet holds ${balance.toFixed(4)} APT.`
      );
    }

    const provider = getWalletProvider(walletName) || getLegacyProvider(walletName);
    if (!provider) {
      throw new Error(`Lost the connection to ${walletName}. Reconnect the wallet and retry.`);
    }

    // Refuse to sign anywhere but the network this app targets, so a wallet left on mainnet
    // cannot move real funds.
    await assertExpectedNetwork(provider);

    // The wallet signs with whichever account it currently has selected. If that is no longer
    // the one this session belongs to, the server rightly rejects the result — as "transaction
    // was not sent by the paying wallet" — after the user has already paid gas. Catch it first.
    const activeAddress = await probeInstanceForAddress(provider);
    if (activeAddress && !sameAddress(activeAddress, address)) {
      await handleAccountChange(activeAddress);
      throw new Error(
        `Your wallet has switched to ${truncate(activeAddress)}, but this session belongs to ` +
          `${truncate(address)}. Sign in again with the account you want to use.`
      );
    }

    try {
      // 1. Aptos Wallet Standard (AIP-62). The standard names the field functionArguments;
      // sending `arguments` leaves the wallet with no arguments to encode.
      const signFeature =
        provider.features?.["aptos:signAndSubmitTransaction"] ||
        provider.features?.["standard:signAndSubmitTransaction"];

      if (signFeature) {
        console.log(`[Circle Storage] Signing transaction via AIP-62 feature on ${walletName}...`);
        const args = payload.functionArguments || payload.arguments || [];
        const typeArguments = payload.typeArguments || payload.type_arguments || [];
        const result = await signFeature.signAndSubmitTransaction({
          payload: {
            function: payload.function,
            typeArguments,
            functionArguments: args
          },
          // Registering a Shelby blob needs a higher gas ceiling than the wallet's default.
          ...(payload.options ? { gasUnitPrice: payload.options.gasUnitPrice,
                                  maxGasAmount: payload.options.maxGasAmount } : {})
        });

        const hash = readTransactionHash(result);
        if (!hash) {
          console.error("[Circle Storage] Unusable signAndSubmitTransaction response:", result);
          throw new Error("Wallet did not return a transaction hash.");
        }
        await refreshOnChainBalance(address);
        return { hash };
      }

      // 2. Legacy providers take the original entry_function_payload shape.
      if (typeof provider.signAndSubmitTransaction === "function") {
        console.log(`[Circle Storage] Signing transaction via legacy API on ${walletName}...`);
        const result = await provider.signAndSubmitTransaction({
          type: "entry_function_payload",
          function: payload.function,
          type_arguments: payload.typeArguments || payload.type_arguments || [],
          arguments: payload.functionArguments || payload.arguments || []
        });

        const hash = readTransactionHash(result);
        if (!hash) {
          console.error("[Circle Storage] Unusable legacy transaction response:", result);
          throw new Error("Wallet did not return a transaction hash.");
        }
        await refreshOnChainBalance(address);
        return { hash };
      }
    } catch (err: any) {
      console.warn("[Circle Storage] Transaction submission failed or was declined:", err);
      throw new Error(err?.message || "The wallet rejected this transaction.");
    }

    throw new Error(`${walletName} does not expose a way to submit transactions.`);
  };

  // Balances come from chain, so there is nothing local to top up. Point at the real faucet
  // and re-read the balance instead of inventing one.
  const requestFaucet = () => {
    if (!address) {
      toast.info("Connect your wallet first.");
      return;
    }
    window.open(`https://aptos.dev/network/faucet?address=${address}`, "_blank", "noopener");
    refreshOnChainBalance(address);
  };

  return (
    <AptosWalletContext.Provider
      value={{
        connected,
        address,
        walletName,
        balance,
        shelbyUSDBalance,
        connect,
        disconnect,
        signAndSubmitTransaction,
        requestFaucet,
        availableWallets,
        isDetected,
        authenticated,
        signingIn,
        authError,
        signIn,
      }}
    >
      {children}
    </AptosWalletContext.Provider>
  );
}

export function useAptosWallet() {
  const context = useContext(AptosWalletContext);
  if (context === undefined) {
    throw new Error("useAptosWallet must be used within an AptosWalletProvider");
  }
  return context;
}
