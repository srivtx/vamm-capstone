"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PaperPrompt() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("vamm-paper-dismissed") === "1") return;
    const t = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    setClosing(true);
    window.sessionStorage.setItem("vamm-paper-dismissed", "1");
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 320);
  }

  if (!mounted || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="V-AMM research paper"
      className={
        "fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 " +
        "transition-opacity duration-300 " +
        (closing ? "opacity-0" : "opacity-100")
      }
      style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
    >
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-text/40 backdrop-blur-[6px]"
      />

      {/* Card */}
      <div
        className={
          "relative w-full max-w-[920px] max-h-[92vh] " +
          "bg-surface border border-line rounded-2xl overflow-hidden " +
          "shadow-[0_24px_60px_-20px_rgba(12,12,14,0.45)] " +
          "transition-all duration-500 " +
          (closing
            ? "opacity-0 scale-[0.97] translate-y-1"
            : "opacity-100 scale-100 translate-y-0")
        }
        style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">
          {/* ────── PDF preview (left) ────── */}
          <div className="relative bg-[#0c0c0e] p-4 md:p-6 md:pr-3">
            <div className="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-3 z-10 flex items-center gap-1.5 pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>

            <div className="relative h-[200px] sm:h-[260px] md:h-[420px] mt-5 md:mt-7 rounded-md overflow-hidden bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]">
              <iframe
                src="/VAMM_Style_F-1.pdf#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0"
                title="V-AMM paper preview"
                className="w-full h-full border-0 pointer-events-none"
                tabIndex={-1}
              />
              {/* soft fade at the bottom of the preview for depth */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
            </div>

            <div className="mt-3 md:mt-4 flex items-center justify-between">
              <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-text-3">
                VAMM_Style_F-1.pdf
              </div>
              <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-text-3 hidden md:block">
                page 1 of 8
              </div>
            </div>
          </div>

          {/* ────── Text + CTA (right) ────── */}
          <div className="relative p-5 md:p-8 flex flex-col">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 md:top-4 md:right-4 w-7 h-7 flex items-center justify-center text-text-3 hover:text-text hover:bg-bg rounded-md transition-colors duration-300"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2 2 L10 10 M10 2 L2 10" />
              </svg>
            </button>

            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-violet-500">
                new · research artifact
              </span>
            </div>

            <h2 className="font-display text-[clamp(22px,4.5vw,32px)] leading-[1.08] tracking-[-0.025em] text-text mb-3 md:mb-4">
              The full V-AMM
              <br />
              <em className="italic text-violet-500">research paper</em>
              <br />
              is now available.
            </h2>

            <p className="text-[13px] md:text-[14px] leading-[1.55] text-text-2 mb-5 md:mb-6 max-w-[36ch]">
              StableSwap, EWMA volatility, and dynamic fees — the math, the
              on-chain design, and the results, in one document.
            </p>

            <div className="mt-auto flex flex-col sm:flex-row gap-2.5">
              <Link
                href="/paper"
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 font-mono text-[11px] md:text-xs uppercase tracking-[0.12em] bg-text text-bg hover:bg-violet-500 hover:text-white px-5 py-3 rounded-lg transition-all duration-500"
                style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
              >
                Read the paper
                <span>→</span>
              </Link>
              <button
                onClick={dismiss}
                className="inline-flex items-center justify-center font-mono text-[11px] md:text-xs uppercase tracking-[0.12em] border border-line text-text-2 hover:text-text hover:border-text-2 px-5 py-3 rounded-lg transition-colors duration-300"
              >
                Maybe later
              </button>
            </div>

            <div className="mt-4 md:mt-5 pt-4 md:pt-5 border-t border-line grid grid-cols-3 gap-2 md:gap-3">
              <Stat k="pages" v="8" />
              <Stat k="format" v="PDF" />
              <Stat k="size" v="~740KB" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-3 mb-0.5">
        {k}
      </div>
      <div className="font-mono text-[12px] md:text-[13px] text-text">{v}</div>
    </div>
  );
}
