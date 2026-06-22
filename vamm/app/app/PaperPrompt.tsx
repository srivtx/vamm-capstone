"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PaperPrompt() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("vamm-paper-dismissed") === "1") return;
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setClosing(true);
    window.sessionStorage.setItem("vamm-paper-dismissed", "1");
    setTimeout(() => setVisible(false), 320);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Research paper announcement"
      className={
        "fixed z-50 " +
        // mobile: bottom bar across full width
        "inset-x-3 bottom-3 " +
        // desktop: bottom-right floating card
        "md:inset-auto md:right-5 md:bottom-5 md:max-w-[340px] " +
        "transition-all duration-300 " +
        (closing
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0")
      }
      style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
    >
      <div className="relative border border-line bg-surface rounded-xl shadow-[0_8px_30px_-12px_rgba(12,12,14,0.18)] overflow-hidden">
        {/* violet accent stripe on the left */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500" />

        <div className="pl-4 pr-3 py-3.5 md:pl-5 md:pr-4 md:py-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-text-3">
                  new · research
                </span>
              </div>
              <div className="text-[13px] md:text-[14px] leading-[1.35] text-text font-medium mb-2.5">
                The V-AMM research paper is now available.
              </div>
              <Link
                href="/paper"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-violet-500 hover:text-violet-600 transition-colors duration-300"
              >
                Read the paper
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 -mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center text-text-3 hover:text-text transition-colors duration-300 rounded"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              >
                <path d="M1.5 1.5 L9.5 9.5 M9.5 1.5 L1.5 9.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
