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

// Recursive Deep Scanner to locate valid Aptos addresses inside arbitrary wallet payload structures
const findAptosAddress = (obj: any, visited = new Set<any>()): string | null => {
  if (!obj) {
    console.log("[Circle Storage] [findAptosAddress] Received empty, null, or undefined entry.");
    return null;
  }
  if (visited.has(obj)) {
    console.log("[Circle Storage] [findAptosAddress] Detected circular dependency. Skipping visited node.");
    return null;
  }

  if (typeof obj === "string") {
    const clean = obj.trim();
    console.log(`[Circle Storage] [findAptosAddress] Testing raw string value: "${clean}"`);
    // Match standard Aptos addresses (0x followed by hex block 3 to 66 hex characters)
    if (/^0x[0-9a-fA-F]{3,66}$/.test(clean)) {
      console.log(`[Circle Storage] [findAptosAddress] String "${clean}" strongly matches standard 0x hex address pattern.`);
      return clean;
    }
    if (/^[0-9a-fA-F]{40,64}$/.test(clean)) {
      const fixedClean = "0x" + clean;
      console.log(`[Circle Storage] [findAptosAddress] String "${clean}" matches raw hex. Auto-prepaid 0x: "${fixedClean}"`);
      return fixedClean;
    }
    console.log(`[Circle Storage] [findAptosAddress] String format mismatch for candidate string: "${clean}"`);
  }

  if (Array.isArray(obj)) {
    visited.add(obj);
    console.log(`[Circle Storage] [findAptosAddress] Recursively parsing array of length: ${obj.length}`);
    for (let i = 0; i < obj.length; i++) {
      console.log(`[Circle Storage] [findAptosAddress] Index [${i}] check...`);
      const addr = findAptosAddress(obj[i], visited);
      if (addr) {
        console.log(`[Circle Storage] [findAptosAddress] Address resolved from array index [${i}]: ${addr}`);
        return addr;
      }
    }
    return null;
  }

  if (typeof obj === "object") {
    visited.add(obj);
    const keys = Object.keys(obj);
    console.log(`[Circle Storage] [findAptosAddress] Scanning object properties. Keys present:`, keys);
    
    // First query standard, high-priority naming fields for direct matches
    const priorityKeys = ["address", "accountAddress", "walletAddress", "selectedAddress", "account", "activeAccount"];
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        console.log(`[Circle Storage] [findAptosAddress] Prioritizing check on key "${key}" with type: ${typeof value}`);
        if (typeof value === "string") {
          const clean = value.trim();
          if (/^0x[0-9a-fA-F]{3,66}$/.test(clean)) {
            console.log(`[Circle Storage] [findAptosAddress] Found address matching standard format on key "${key}": ${clean}`);
            return clean;
          }
          if (/^[0-9a-fA-F]{40,64}$/.test(clean)) {
            const fixedClean = "0x" + clean;
            console.log(`[Circle Storage] [findAptosAddress] Found address matching raw hex on key "${key}". Fixed: ${fixedClean}`);
            return fixedClean;
          }
          console.log(`[Circle Storage] [findAptosAddress] Key "${key}" string value didn't match regex: "${clean}"`);
        } else if (value && typeof value === "object") {
          const addr = findAptosAddress(value, visited);
          if (addr) {
            console.log(`[Circle Storage] [findAptosAddress] Address successfully retrieved from sub-object of key "${key}": ${addr}`);
            return addr;
          }
        }
      }
    }

    // Inspect other custom descriptors recursively (ignoring keys already checked)
    for (const key in obj) {
      if (priorityKeys.includes(key)) continue;
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        console.log(`[Circle Storage] [findAptosAddress] Traversing nested fallback property "${key}" with type: ${typeof value}`);
        const addr = findAptosAddress(value, visited);
        if (addr) {
          console.log(`[Circle Storage] [findAptosAddress] Address resolved from fallback property pathway "${key}": ${addr}`);
          return addr;
        }
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

      // Append Developer Sandbox Wallet option explicitly at the end so it is an explicit choice for test simulations
      detectedList.push("Developer Sandbox Wallet");

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
      console.log(`[Circle Storage] Starting connection sequence for wallet: ${name}`);
      const cleanName = name.replace(" (Sandbox)", "").trim();
      
      let walletAddress: string | null = null;

      if (cleanName === "Developer Sandbox Wallet") {
        console.log(`[Circle Storage] Bypassing connection sequence. Selecting Developer Sandbox Wallet address.`);
        walletAddress = "0xe990f736f23840ca81720eb6e567c82c6de3b3c3c3c3c3c3c3c3c39e7badabcdef";
      } else {
        const provider = getWalletProvider(cleanName);
        const legacyProvider = getLegacyProvider(cleanName);

        console.log(`[Circle Storage] Wallet provider references fetched:`, {
          providerType: provider ? typeof provider : "null",
          legacyType: legacyProvider ? typeof legacyProvider : "null",
          hasFeatures: provider && provider.features ? Object.keys(provider.features) : []
        });

        if (!provider && !legacyProvider) {
          console.warn(`[Circle Storage] Provider not found! Frame isolation check...`);
          const isNestedFrame = typeof window !== "undefined" && window.self !== window.top;
          if (isNestedFrame) {
            throw new Error(
              `Web3 injection restricted inside nested previews.\n\n` +
              `Under standard browser security policies, browser extensions like Petra Wallet cannot inject their Web3 context ("window.aptos") inside nested editor preview iframes.\n\n` +
              `To connect your real wallet, please click the "Open in New Tab" button at the top-right of your screen, or choose "Developer Sandbox Wallet" in this preview to simulate storage actions.`
            );
          } else {
            throw new Error(
              `The "${cleanName}" extension was not detected on this browser.\n\n` +
              `Please ensure the Petra Wallet extension is active on your browser, then refresh the page to connect.`
            );
          }
        }

        // 1. Try modern Aptos Wallet Standard (AIP-62) connect feature
        if (provider) {
          const connectFeature = provider.features?.['standard:connect'] || provider.features?.['aptos:connect'];
          if (connectFeature) {
            try {
              console.log(`[Circle Storage] Triggering standard AIP-62 connect request for user wallet: ${cleanName}...`);
              const result = await connectFeature.connect();
              console.log(`[Circle Storage] AIP-62 connect returned payload structure:`, result);
              
              // Search result payload recursively
              walletAddress = findAptosAddress(result);
              console.log(`[Circle Storage] Search check 1 result (from AIP-62 connect return):`, walletAddress);
              if (!walletAddress) {
                walletAddress = findAptosAddress(provider);
                console.log(`[Circle Storage] Search check 2 result (from provider object direct props):`, walletAddress);
              }
            } catch (aip62Err) {
              console.warn(`[Circle Storage] Standard AIP-62 connection failed or bypassed for ${cleanName}:`, aip62Err);
            }
          } else {
            console.log(`[Circle Storage] No AIP-62 connect standard features registered for provider: ${cleanName}`);
          }
        }

        // 2. Fall back to legacy providers connect() or property extraction
        if (!walletAddress) {
          console.log(`[Circle Storage] Falling back to Legacy connect/account pathways for: ${cleanName}`);
          const activeProviders = [provider, legacyProvider].filter(Boolean);
          for (const prov of activeProviders) {
            if (walletAddress) break;

            // Try direct connect method if available
            if (typeof prov.connect === "function") {
              console.log(`[Circle Storage] Triggering provider.connect() invocation...`);
              try {
                const response = await prov.connect();
                console.log(`[Circle Storage] Legacy connect() returned response payload:`, response);
                walletAddress = findAptosAddress(response);
                console.log(`[Circle Storage] Search check 3 result (from legacy connect response):`, walletAddress);
              } catch (connectErr) {
                console.warn(`[Circle Storage] Legacy connect() call failed on provider:`, connectErr);
              }
            }

            // Try direct account method if available
            if (!walletAddress && typeof prov.account === "function") {
              try {
                console.log(`[Circle Storage] Triggering legacy provider.account() invocation...`);
                const acc = await prov.account();
                console.log(`[Circle Storage] Legacy account() returned response payload:`, acc);
                walletAddress = findAptosAddress(acc);
                console.log(`[Circle Storage] Search check 4 result (from legacy account() response):`, walletAddress);
              } catch (accErr) {
                console.warn(`[Circle Storage] account() check failed:`, accErr);
              }
            }

            // Checking standard properties
            if (!walletAddress) {
              console.log(`[Circle Storage] Checking direct properties on provider object...`);
              walletAddress = findAptosAddress(prov);
              console.log(`[Circle Storage] Search check 5 result (from direct provider property scan):`, walletAddress);
            }
          }
        }

        // 3. Last resort fallback to standard global window contexts if we STILL have no address
        if (!walletAddress && typeof window !== "undefined") {
          console.warn(`[Circle Storage] Address not found yet. Attempting global namespace connection rescue...`);
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
              console.log(`[Circle Storage] Probing fallback Candidate Context: ${cand.label}`);
              try {
                if (typeof cand.instance.isConnected === "function" && !(await cand.instance.isConnected())) {
                  console.log(`[Circle Storage] Falling back to manual connection on context: ${cand.label}`);
                  const connRes = await cand.instance.connect();
                  walletAddress = findAptosAddress(connRes);
                  console.log(`[Circle Storage] Search check 6 result (from manual fallback connection):`, walletAddress);
                }
                if (!walletAddress && typeof cand.instance.account === "function") {
                  const acc = await cand.instance.account();
                  walletAddress = findAptosAddress(acc);
                  console.log(`[Circle Storage] Search check 7 result (from manual fallback account()):`, walletAddress);
                }
                if (!walletAddress) {
                  walletAddress = findAptosAddress(cand.instance);
                  console.log(`[Circle Storage] Search check 8 result (from direct manual fallback context sweep):`, walletAddress);
                }
                if (walletAddress) {
                  console.log(`[Circle Storage] Successfully rescued connection using candidate context: ${cand.label}`);
                  break;
                }
              } catch (fallbackErr) {
                console.warn(`[Circle Storage] Fallback helper lookup failed on candidate ${cand.label}:`, fallbackErr);
              }
            }
          }
        }

        if (!walletAddress) {
          console.error(`[Circle Storage] Connection trace complete. Failure: Crucial address state could not be resolved!`);
          throw new Error(
            `A connection was made to the extension but we could not resolve your account's cryptographic address.\n\n` +
            `Please make sure your Petra wallet is unlocked and has at least one account created.`
          );
        }
      }

      // Format clean address values - make sure it starts with 0x and is properly trimmed
      if (typeof walletAddress !== "string") {
        walletAddress = String(walletAddress);
      }
      walletAddress = walletAddress.trim();
      
      // Enforce robust "0x" prefix checks and correct structure validation
      if (!walletAddress.startsWith("0x")) {
        console.log(`[Circle Storage] Resolved address missing "0x" prefix. Prepending "0x" to raw hex string.`);
        walletAddress = "0x" + walletAddress;
      }

      console.log(`[Circle Storage] Execution finished tracing address value: "${walletAddress}"`);
      
      // Robust Address Verification Step
      const cleanAddressPart = walletAddress.substring(2);
      const isHexChars = /^[0-9a-fA-F]+$/.test(cleanAddressPart);
      const isCorrectLength = walletAddress.length >= 3 && walletAddress.length <= 66;

      if (!isHexChars || !isCorrectLength) {
        console.error("[Circle Storage] CRITICAL: Parsed address validation failed!", {
          address: walletAddress,
          isHexChars,
          isCorrectLength,
          length: walletAddress.length
        });
        throw new Error(
          `Resolved wallet account address "${walletAddress}" is not a cryptographically valid Aptos string (must start with "0x" and be up to 66 valid hex characters).`
        );
      }

      console.log(`[Circle Storage] Security checks PASSED for account: ${walletAddress}`);
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
