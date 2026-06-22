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
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    }, 280);
  }

  if (!mounted || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="V-AMM research paper"
      className={
        "fixed inset-0 z-50 flex items-center justify-center p-4 " +
        "transition-opacity duration-300 " +
        (closing ? "opacity-0" : "opacity-100")
      }
      style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
    >
      {/* light dim backdrop, no blur */}
      <button
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-text/[0.06]"
      />

      {/* card — white, matches the V-AMM editorial surface */}
      <div
        className={
          "relative w-full max-w-[640px] bg-surface border border-line rounded-2xl overflow-hidden " +
          "shadow-[0_20px_50px_-20px_rgba(12,12,14,0.18)] " +
          "transition-all duration-400 " +
          (closing
            ? "opacity-0 scale-[0.97] translate-y-1"
            : "opacity-100 scale-100 translate-y-0")
        }
        style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_1fr]">
          {/* ────── visual (left) ────── */}
          <div className="relative bg-bg p-5 sm:p-6 flex items-center justify-center min-h-[180px] sm:min-h-0">
            <div className="relative w-[160px] sm:w-[170px] aspect-[3/4] bg-white border border-line rounded-md overflow-hidden shadow-[0_10px_24px_-10px_rgba(12,12,14,0.18)]">
              <iframe
                src="/VAMM_Style_F-1.pdf#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0"
                title="V-AMM paper preview"
                className="w-full h-full border-0 pointer-events-none"
                tabIndex={-1}
              />
              {/* a tiny "page 1" pill on the corner of the paper */}
              <div className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-[0.12em] text-text-3 bg-white/90 px-1.5 py-0.5 rounded">
                p.1
              </div>
            </div>
            {/* subtle paper shadow underneath */}
            <div className="hidden sm:block absolute bottom-7 left-1/2 -translate-x-1/2 w-[140px] h-3 bg-text/[0.06] rounded-full blur-md -z-10" />
          </div>

          {/* ────── text + cta (right) ────── */}
          <div className="relative p-5 sm:p-6 flex flex-col">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-6 h-6 flex items-center justify-center text-text-3 hover:text-text hover:bg-bg rounded transition-colors duration-300"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2 2 L10 10 M10 2 L2 10" />
              </svg>
            </button>

            <div className="flex items-center gap-2 mb-2.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-3">
                research
              </span>
            </div>

            <h2 className="font-display text-[22px] sm:text-[26px] leading-[1.1] tracking-[-0.02em] text-text mb-2.5">
              Read the
              <br />
              <em className="italic text-violet-500">V-AMM</em> paper.
            </h2>

            <p className="text-[13px] leading-[1.5] text-text-2 mb-4 max-w-[28ch]">
              StableSwap, EWMA σ, and dynamic fees — the math, the on-chain
              design, the results. Eight pages.
            </p>

            <div className="mt-auto">
              <Link
                href="/paper"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] bg-text text-bg hover:bg-violet-500 hover:text-white px-4 py-2.5 rounded-lg transition-all duration-500"
                style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
              >
                Read paper
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
