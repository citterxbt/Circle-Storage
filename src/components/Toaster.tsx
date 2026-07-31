/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-app notifications.
 *
 * These replace `alert()`, which blocks the whole page until dismissed — so a background step
 * like a download or a wallet prompt could not continue while one was open — and looks nothing
 * like the rest of the interface.
 */

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** Errors stay longer, because they usually carry something to read and act on. */
const DISMISS_AFTER_MS: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  error: 9000,
};

const TONE_STYLES: Record<ToastTone, { border: string; icon: ReactNode }> = {
  success: {
    border: "border-emerald-500/30",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
  },
  error: {
    border: "border-red-500/30",
    icon: <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />,
  },
  info: {
    border: "border-pink-500/30",
    icon: <Info className="w-4 h-4 text-pink-400 flex-shrink-0" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      // Date.now() alone collides when two arrive in the same millisecond.
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS[tone]);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      info: (message: string) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Sits above the go-to-top button rather than under it. */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 flex flex-col gap-2 pointer-events-none"
        id="toast-stack"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter pointer-events-auto bg-[#0c040a]/95 backdrop-blur-xl border ${TONE_STYLES[toast.tone].border} rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] px-4 py-3 flex items-start gap-3`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            {TONE_STYLES[toast.tone].icon}
            <p className="text-xs text-white/90 font-sans leading-relaxed flex-1 break-words whitespace-pre-line">
              {toast.message}
            </p>
            <button
              onClick={() => dismiss(toast.id)}
              className="p-0.5 text-white/40 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
