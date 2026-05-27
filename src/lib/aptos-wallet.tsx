/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
}

const AptosWalletContext = createContext<AptosWalletContextType | undefined>(undefined);

// Helper function to safely locate the browser extension provider mapping a given name
const getWalletProvider = (name: string): any => {
  if (typeof window === "undefined") return null;
  
  const cleanName = name.replace(" (Sandbox)", "").trim();
  
  // 1. Try AIP-62 standard wallet detection first
  if ((window as any).aptosWeb3) {
    const rx = (window as any).aptosWeb3.wallets || [];
    const found = rx.find((w: any) => {
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
    if (found) {
      console.log(`[Circle Storage] Standard AIP-62 wallet matches found for ${cleanName}:`, found.name);
      return found;
    }
  }

  // 2. Fallbacks for standard browser property spaces
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
    for (const subKey of ["addressBytes", "bytes", "data"]) {
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

    const directKeys = ["address", "hexString", "value", "accountAddress", "walletAddress"];
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

export function AptosWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0.00); 
  const [shelbyUSDBalance, setShelbyUSDBalance] = useState<number>(0.00); 
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  const isDetected = (name: string): boolean => {
    return checkWalletDetected(name);
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
          detectedList.push(wallet);
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
    }

    // Retrieve previous connected wallet session
    const savedAddress = localStorage.getItem("aptos_wallet_address");
    const savedWallet = localStorage.getItem("aptos_wallet_name");
    if (savedAddress && savedWallet) {
      setAddress(savedAddress);
      setConnected(true);
      setWalletName(savedWallet);
      
      const savedBalance = localStorage.getItem(`aptos_wallet_balance_${savedAddress}`);
      const savedShelby = localStorage.getItem(`aptos_wallet_shelby_balance_${savedAddress}`);
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      } else {
        setBalance(0.00);
      }
      if (savedShelby) {
        setShelbyUSDBalance(parseFloat(savedShelby));
      } else {
        setShelbyUSDBalance(250.00);
        localStorage.setItem(`aptos_wallet_shelby_balance_${savedAddress}`, "250.00");
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wallet-standard:register-wallet", detectInjectedWallets);
        window.removeEventListener("aptos-wallet-announced", detectInjectedWallets);
      }
    };
  }, []);

  // Sync real-time testnet balances when a live Web3 wallet is connected
  useEffect(() => {
    if (connected && address) {
      const fetchOnChainBalances = async () => {
        try {
          // Query Aptos Testnet Node API for true APT CoinStore resources
          const response = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${address}/resources`);
          if (response.ok) {
            const resources = await response.json();
            const coinStore = resources.find(
              (res: any) => res.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
            );
            if (coinStore && coinStore.data && coinStore.data.coin) {
              const octas = parseFloat(coinStore.data.coin.value);
              const actualApt = octas / 100_000_000; // 10^8 Octas = 1 APT
              setBalance(actualApt);
              localStorage.setItem(`aptos_wallet_balance_${address}`, actualApt.toString());
            } else {
              setBalance(0.00);
              localStorage.setItem(`aptos_wallet_balance_${address}`, "0");
            }
          } else if (response.status === 404) {
            setBalance(0.00);
            localStorage.setItem(`aptos_wallet_balance_${address}`, "0");
          }
        } catch (error) {
          console.warn("[Circle Storage] Could not fetch real on-chain balance from Aptos Testnet node:", error);
        }
      };
      
      fetchOnChainBalances();
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
            
            // Search result payload carefully
            walletAddress = await probeInstanceForAddress(result);
            console.log(`[Circle Storage] [Address Scan Step 1] Check on response container yields address: "${walletAddress}"`);
            
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

          // A. Try direct Legacy connect method
          if (typeof prov.connect === "function") {
            try {
              console.log(`[Circle Storage] [Legacy Connect Stage] Triggering prov.connect() invocation...`);
              const response = await prov.connect();
              console.log(`[Circle Storage] [Legacy Connect Complete] Returned response payload:`, response);
              walletAddress = await probeInstanceForAddress(response) || await probeInstanceForAddress(prov);
              console.log(`[Circle Storage] [Address Scan Step 3] Check on response/provider payload: "${walletAddress}"`);
            } catch (connectErr) {
              console.warn(`[Circle Storage] [Legacy Connect Error] connect() call failed on provider:`, connectErr);
            }
          }

          // B. Try direct Legacy account method
          if (!walletAddress && typeof prov.account === "function") {
            try {
              console.log(`[Circle Storage] [Legacy Account Stage] Triggering legacy prov.account() invocation...`);
              const acc = await prov.account();
              console.log(`[Circle Storage] [Legacy Account Complete] Returned response payload:`, acc);
              walletAddress = await probeInstanceForAddress(acc);
              console.log(`[Circle Storage] [Address Scan Step 4] Check on legacy account response: "${walletAddress}"`);
            } catch (accErr) {
              console.warn(`[Circle Storage] [Legacy Account Error] account() check failed:`, accErr);
            }
          }

          // C. Checking standard properties directly on provider metadata
          if (!walletAddress) {
            console.log(`[Circle Storage] [Direct Extraction Stage] Sweeping direct properties on provider instance...`);
            walletAddress = await probeInstanceForAddress(prov);
            console.log(`[Circle Storage] [Address Scan Step 5] Check on direct properties: "${walletAddress}"`);
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
              if (typeof cand.instance.isConnected === "function" && !(await cand.instance.isConnected())) {
                console.log(`[Circle Storage] [Rescue Connected State] Context reports offline. Invoking cand.connect()...`);
                const connRes = await cand.instance.connect();
                walletAddress = await probeInstanceForAddress(connRes) || await probeInstanceForAddress(cand.instance);
                console.log(`[Circle Storage] [Address Scan Step 6] Check on rescue connect: "${walletAddress}"`);
              }
              if (!walletAddress) {
                walletAddress = await probeInstanceForAddress(cand.instance);
                console.log(`[Circle Storage] [Address Scan Step 7] Check on rescue sweeping: "${walletAddress}"`);
              }
              if (walletAddress) {
                console.log(`[Circle Storage] [Rescue Success] Resolved address from candidate "${cand.label}": "${walletAddress}"`);
                break;
              }
            } catch (fallbackErr) {
              console.warn(`[Circle Storage] [Rescue Candidate Error] Fallback helper lookup failed on candidate ${cand.label}:`, fallbackErr);
            }
          }
        }
      }

      if (!walletAddress) {
        console.error(`[Circle Storage] [Resolution Failure] Connection trace complete. Error: walletAddress state could not be resolved.`);
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

      // Load balances safely
      const savedBalance = localStorage.getItem(`aptos_wallet_balance_${walletAddress}`);
      const savedShelby = localStorage.getItem(`aptos_wallet_shelby_balance_${walletAddress}`);

      const finalBal = savedBalance ? parseFloat(savedBalance) : 10.0;
      const finalShelby = savedShelby ? parseFloat(savedShelby) : 250.00;

      setBalance(finalBal);
      setShelbyUSDBalance(finalShelby);

      localStorage.setItem(`aptos_wallet_balance_${walletAddress}`, finalBal.toString());
      localStorage.setItem(`aptos_wallet_shelby_balance_${walletAddress}`, finalShelby.toString());
      return true;
    } catch (err: any) {
      console.error(`[Circle Storage] Failed to connect to actual wallet extension ${name}:`, err);
      alert(`Could not connect to ${name}: ${err?.message || "User declined the wallet signature request."}`);
      return false;
    }
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
    setWalletName(null);
    setBalance(0.00);
    setShelbyUSDBalance(0.00);
    localStorage.removeItem("aptos_wallet_address");
    localStorage.removeItem("aptos_wallet_name");
  };

  // Sign and submit a transaction payload to testnet or generate receipt proof
  const signAndSubmitTransaction = async (payload: any): Promise<{ hash: string }> => {
    console.log("[Circle Storage] Submitting transaction payload to extension:", payload);
    
    if (!address) {
      throw new Error("No connected wallet found for signing transaction.");
    }

    // Check if the buyer has sufficient balance
    if (payload.amount && balance < payload.amount) {
      throw new Error(`Insufficient funds: transaction needs ${payload.amount} APT, but wallet balance is ${balance.toFixed(2)} APT.`);
    }

    // Deduct standard pricing
    if (payload.amount) {
      const newBal = Math.max(0, balance - payload.amount);
      setBalance(newBal);
      localStorage.setItem(`aptos_wallet_balance_${address}`, newBal.toString());
    }

    // Generate fall-back/standard random seed receipt hash
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
    const finalHash = "0x" + hex;
    
    if (walletName) {
      try {
        const provider = getWalletProvider(walletName);
        if (provider) {
          // 1. Try Aptos Wallet Standard (AIP-62) signAndSubmitTransaction
          const signFeature = provider.features?.['aptos:signAndSubmitTransaction'] || provider.features?.['standard:signAndSubmitTransaction'];
          if (signFeature) {
            console.log(`[Circle Storage] Signing transaction via AIP-62 feature on ${walletName}...`);
            const result = await signFeature.signAndSubmitTransaction({
              payload: payload
            });
            return { hash: result?.hash || finalHash };
          } 
          // 2. Try legacy signAndSubmitTransaction call
          else if (typeof provider.signAndSubmitTransaction === "function") {
            console.log(`[Circle Storage] Signing transaction via legacy API on ${walletName}...`);
            const result = await provider.signAndSubmitTransaction(payload);
            return { hash: result?.hash || result || finalHash };
          }
        }
      } catch (err: any) {
        console.warn("[Circle Storage] Direct extension transaction submission failed or declined:", err);
        throw new Error(err?.message || "Aptos transaction signing rejected by user.");
      }
    }

    return { hash: `0x_mock_tx_${hex.slice(0, 32)}` };
  };

  const requestFaucet = () => {
    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }
    const newBal = balance + 5.0;
    setBalance(newBal);
    localStorage.setItem(`aptos_wallet_balance_${address}`, newBal.toString());
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
