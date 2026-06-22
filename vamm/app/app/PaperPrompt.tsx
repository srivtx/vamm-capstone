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
      aria-label="V-AMM research paper"
      className={
        "fixed z-50 " +
        // mobile: bottom bar across full width
        "inset-x-3 bottom-3 " +
        // desktop: bottom-left floating card (away from the phone mockup on the right)
        "md:inset-auto md:left-5 md:bottom-5 md:max-w-[380px] " +
        "transition-all duration-300 " +
        (closing
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0")
      }
      style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
    >
      <div className="relative border border-line bg-surface rounded-xl shadow-[0_10px_30px_-12px_rgba(12,12,14,0.18)] overflow-hidden">
        <div className="p-3.5 md:p-4 flex items-start gap-3">
          {/* tiny paper thumbnail */}
          <div className="shrink-0 w-12 h-16 md:w-14 md:h-[72px] bg-white border border-line rounded-sm overflow-hidden relative shadow-[0_2px_6px_-2px_rgba(0,0,0,0.15)]">
            <iframe
              src="/VAMM_Style_F-1.pdf#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0"
              title="V-AMM paper preview"
              className="w-full h-full border-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>

          <div className="flex-1 min-w-0 pr-5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-text-3">
                new · research
              </span>
            </div>
            <div className="text-[13px] md:text-[14px] leading-[1.3] text-text font-medium mb-1.5">
              The V-AMM paper is out.
            </div>
            <Link
              href="/paper"
              onClick={dismiss}
              className="inline-flex items-center gap-1 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-violet-500 hover:text-violet-600 transition-colors duration-300"
            >
              Read it
              <span>→</span>
            </Link>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-text-3 hover:text-text transition-colors duration-300 rounded"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M2 2 L10 10 M10 2 L2 10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
