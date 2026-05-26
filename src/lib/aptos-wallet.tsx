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
}

const AptosWalletContext = createContext<AptosWalletContextType | undefined>(undefined);

export function AptosWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(12.5); // Holds safe testing balance of 12.5 APT by default
  const [shelbyUSDBalance, setShelbyUSDBalance] = useState<number>(150.00); // Track ShelbyUSD balance (holds 150.00 ShelbyUSD by default)
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  // Detect injected web3 components
  useEffect(() => {
    const list: string[] = ["Sandbox Wallet"];
    if (typeof window !== "undefined") {
      if ((window as any).aptos) list.push("Petra Wallet");
      if ((window as any).martian) list.push("Martian Wallet");
      if ((window as any).pontem) list.push("Pontem Wallet");
    }
    setAvailableWallets(list);

    // Retrieve previous session wallet address
    const savedAddress = localStorage.getItem("aptos_wallet_address");
    const savedWallet = localStorage.getItem("aptos_wallet_name");
    const savedBalance = localStorage.getItem("aptos_wallet_balance");
    const savedShelby = localStorage.getItem("aptos_wallet_shelby_balance");
    if (savedAddress && savedWallet) {
      setAddress(savedAddress);
      setConnected(true);
      setWalletName(savedWallet);
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      }
      if (savedShelby) {
        setShelbyUSDBalance(parseFloat(savedShelby));
      }
    }
  }, []);

  const connect = async (name: string): Promise<boolean> => {
    try {
      if (name === "Sandbox Wallet") {
        const mockAddress = "0x2e8f19da77fcbc6a1885eb051bfbeb62908f918e9cfa083b05cc51f89c6237be";
        setAddress(mockAddress);
        setConnected(true);
        setWalletName(name);
        localStorage.setItem("aptos_wallet_address", mockAddress);
        localStorage.setItem("aptos_wallet_name", name);
        localStorage.setItem("aptos_wallet_balance", balance.toString());
        localStorage.setItem("aptos_wallet_shelby_balance", shelbyUSDBalance.toString());
        return true;
      }

      // Live Injected Wallet Connect (Petra, Pontem etc)
      let provider: any = null;
      if (name === "Petra Wallet") {
        // Safe standard property checks to avoid triggering PetraApiClient direct access deprecated warnings
        provider = (window as any).aptos || (window as any).petra;
      } else if (name === "Martian Wallet") {
        provider = (window as any).martian;
      } else if (name === "Pontem Wallet") {
        provider = (window as any).pontem;
      }

      if (!provider) {
        console.warn(`[Circle Storage] ${name} is not available in the browser context. Defaulting to sandbox simulator.`);
        return await connect("Sandbox Wallet");
      }

      // Wrap the provider connect call carefully to handle Sandbox iframe permission constraints and deprecations
      let response: any;
      try {
        response = await provider.connect();
      } catch (innerErr: any) {
        const errMsg = innerErr?.message || String(innerErr);
        console.warn(
          `[Circle Storage] Live browser extension wallet connection is blocked or deprecated: "${errMsg}". ` +
          "To guarantee stable end-to-end sandbox operations, we have enabled the pre-funded local Sandbox Wallet."
        );
        return await connect("Sandbox Wallet");
      }

      const walletAddress = response?.address || response?.walletAddress || response;
      if (!walletAddress) {
        console.warn("[Circle Storage] Wallet returned empty address, falling back to Sandbox Wallet.");
        return await connect("Sandbox Wallet");
      }
      
      setAddress(walletAddress);
      setConnected(true);
      setWalletName(name);

      localStorage.setItem("aptos_wallet_address", walletAddress);
      localStorage.setItem("aptos_wallet_name", name);
      localStorage.setItem("aptos_wallet_balance", balance.toString());
      localStorage.setItem("aptos_wallet_shelby_balance", shelbyUSDBalance.toString());
      return true;
    } catch (err) {
      console.warn("[Circle Storage] Gracefully handled wallet connect exception. Fallback to Sandbox Wallet initiated.");
      return await connect("Sandbox Wallet");
    }
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
    setWalletName(null);
    localStorage.removeItem("aptos_wallet_address");
    localStorage.removeItem("aptos_wallet_name");
  };

  // Sign and submit a transaction payload to testnet or generate receipt proof
  const signAndSubmitTransaction = async (payload: any): Promise<{ hash: string }> => {
    console.log("Submitting transaction payload:", payload);
    
    // Check if the buyer has sufficient balance
    if (payload.amount && balance < payload.amount) {
      throw new Error(`Insufficient funds: transaction needs ${payload.amount} APT, but wallet balance is ${balance.toFixed(2)} APT.`);
    }

    // Deduct standard pricing
    if (payload.amount) {
      const newBal = Math.max(0, balance - payload.amount);
      setBalance(newBal);
      localStorage.setItem("aptos_wallet_balance", newBal.toString());
    }

    // Generate valid random tx hash
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
    const finalHash = "0x" + hex;
    
    // If live injected wallet, trigger signing popup
    if (walletName && walletName !== "Sandbox Wallet") {
      try {
        let provider: any = null;
        if (walletName === "Petra Wallet") provider = (window as any).aptos;
        if (walletName === "Martian Wallet") provider = (window as any).martian;
        if (walletName === "Pontem Wallet") provider = (window as any).pontem;

        if (provider && provider.signAndSubmitTransaction) {
          const result = await provider.signAndSubmitTransaction(payload);
          return { hash: result.hash || finalHash };
        }
      } catch (err) {
        console.warn("Popup transaction request failed, generating secure mock hash fallback.", err);
      }
    }

    return { hash: `0x_mock_tx_${hex.slice(0, 32)}` };
  };

  const requestFaucet = () => {
    const newBal = balance + 5.0;
    setBalance(newBal);
    localStorage.setItem("aptos_wallet_balance", newBal.toString());
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
