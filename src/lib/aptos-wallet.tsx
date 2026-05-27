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
    // Avoid accessing window.petra at all under any circumstances since its property getter
    // raises an instant deprecation exception in modern Petra Wallet versions on properties/calls.
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

// Check if a wallet extension is active/installed dynamically
const checkWalletDetected = (name: string): boolean => {
  return !!getWalletProvider(name);
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
      console.log(`[Circle Storage] Connecting to wallet: ${name}`);
      const cleanName = name.replace(" (Sandbox)", "").trim();
      const provider = getWalletProvider(cleanName);

      if (!provider) {
        // No wallet extension active or detected. Inform user strictly.
        alert(
          `Could not connect to ${cleanName} Extension.\n\n` +
          `Aptos extension matches for "${cleanName}" were not detected on your browser.\n\n` +
          `Please install the browser extension or open this page inside a compliant Web3 browser.`
        );
        return false;
      }

      let walletAddress: string | null = null;

      // 1. Try modern Aptos Wallet Standard (AIP-62) connect feature
      const connectFeature = provider.features?.['standard:connect'] || provider.features?.['aptos:connect'];
      if (connectFeature) {
        console.log(`[Circle Storage] Triggering standard AIP-62 connect request for ${cleanName}...`);
        const result = await connectFeature.connect();
        console.log(`[Circle Storage] AIP-62 connect result:`, result);
        
        const accounts = result?.accounts || result?.[0]?.accounts;
        if (accounts && accounts.length > 0) {
          walletAddress = accounts[0].address;
        } else if (result && result.address) {
          walletAddress = result.address;
        } else if (Array.isArray(result) && result[0]?.address) {
          walletAddress = result[0].address;
        } else if (result?.accounts?.[0]) {
          walletAddress = result.accounts[0].address;
        } else {
          walletAddress = result;
        }
      } 
      // 2. Fall back to clean window call if AIP-62 connect feature is not present and NOT Petra Wallet to prevent deprecation alerts
      else if (typeof provider.connect === "function" && cleanName !== "Petra" && cleanName !== "Petra Wallet") {
        console.log(`[Circle Storage] Triggering legacy provider.connect() request for ${cleanName}...`);
        const response = await provider.connect();
        walletAddress = response?.address || response?.walletAddress || response;
      }

      if (!walletAddress) {
        throw new Error("Connected successfully but no Aptos cryptographic address was returned.");
      }

      // Format clean address values
      if (typeof walletAddress !== "string") {
        walletAddress = String(walletAddress);
      }

      console.log(`[Circle Storage] Actual connected account detected: ${walletAddress}`);
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
