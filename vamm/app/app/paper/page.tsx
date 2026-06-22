"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const TOTAL_PAGES = 16;

export default function PaperPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<"fit" | "100" | "125" | "150" | "200">(
    "fit"
  );

  // iframe URL with the right page + zoom
  const src = `/VAMM_Style_F-1.pdf#page=${page}&view=${
    zoom === "fit" ? "FitH" : `${zoom}`
  }&toolbar=0&navpanes=0&statusbar=0&scrollbar=1`;

  function go(d: number) {
    setPage((p) => Math.min(TOTAL_PAGES, Math.max(1, p + d)));
  }

  function fullscreen() {
    const el = iframeRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }

  // keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(e.target.tagName)
      )
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "+" || e.key === "=") {
        setZoom((z) =>
          z === "fit" ? "100" : z === "100" ? "125" : z === "125" ? "150" : "200"
        );
      }
      if (e.key === "-") {
        setZoom((z) =>
          z === "200"
            ? "150"
            : z === "150"
            ? "125"
            : z === "125"
            ? "100"
            : "fit"
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col">
      {/* ─── top bar ─── */}
      <header className="border-b border-line bg-bg sticky top-0 z-30" style={{ willChange: "transform" }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[10px] md:text-xs uppercase tracking-[0.16em] text-text-2 hover:text-text transition-colors duration-300"
          >
            ← v-amm / paper
          </Link>

          <div className="flex items-center gap-1.5 md:gap-2">
            <a
              href="/VAMM_Style_F-1.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.12em] border border-line text-text-2 hover:text-text hover:border-text-2 px-2.5 md:px-3 py-1.5 rounded-lg transition-colors duration-300"
            >
              <span className="hidden sm:inline">Open in tab </span>
              <span>↗</span>
            </a>
            <a
              href="/VAMM_Style_F-1.pdf"
              download="VAMM_Style_F-1.pdf"
              className="font-mono text-[10px] uppercase tracking-[0.12em] bg-text text-bg hover:bg-violet-500 hover:text-white px-2.5 md:px-3 py-1.5 rounded-lg transition-colors duration-300"
            >
              <span className="hidden sm:inline">Download </span>
              <span>↓</span>
            </a>
          </div>
        </div>
      </header>

      {/* ─── reader ─── */}
      <main className="flex-1 bg-bg">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 md:py-5">
          {/* control bar */}
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
            {/* page nav */}
            <div className="flex items-center gap-1 border border-line rounded-lg bg-surface p-1">
              <CtrlBtn onClick={() => go(-1)} ariaLabel="Previous page" disabled={page === 1}>
                ←
              </CtrlBtn>
              <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-text-2 px-2 md:px-3 min-w-[64px] md:min-w-[80px] text-center">
                <span className="text-text tabular-nums">{String(page).padStart(2, "0")}</span>
                <span className="text-text-3 mx-1">/</span>
                <span className="text-text-3 tabular-nums">{String(TOTAL_PAGES).padStart(2, "0")}</span>
              </div>
              <CtrlBtn onClick={() => go(1)} ariaLabel="Next page" disabled={page === TOTAL_PAGES}>
                →
              </CtrlBtn>
            </div>

            {/* zoom */}
            <div className="flex items-center gap-1 border border-line rounded-lg bg-surface p-1">
              <CtrlBtn onClick={() => setZoom((z) => zoomOut(z))} ariaLabel="Zoom out">
                −
              </CtrlBtn>
              <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-text-2 px-2 md:px-3 min-w-[58px] md:min-w-[68px] text-center tabular-nums">
                {zoom === "fit" ? "fit" : `${zoom}%`}
              </div>
              <CtrlBtn onClick={() => setZoom((z) => zoomIn(z))} ariaLabel="Zoom in">
                +
              </CtrlBtn>
            </div>

            {/* fullscreen */}
            <button
              onClick={fullscreen}
              className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] border border-line bg-surface text-text-2 hover:text-text hover:border-text-2 px-2.5 md:px-3 py-2 rounded-lg transition-colors duration-300"
            >
              <span className="hidden sm:inline">Full </span>⛶
            </button>
          </div>

          {/* pdf frame */}
          <div
            className="relative border border-line rounded-xl overflow-hidden bg-surface shadow-[0_10px_40px_-20px_rgba(12,12,14,0.18)]"
            style={{ height: "calc(100dvh - 180px)", minHeight: "640px" }}
          >
            <iframe
              key={`${page}-${zoom}`}
              ref={iframeRef}
              src={src}
              title="V-AMM research paper"
              className="w-full h-full block bg-white"
            />
          </div>

          {/* hints */}
          <div className="mt-3 md:mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.14em] text-text-3">
            <span className="hidden md:inline">
              ← → page · + − zoom · ⛶ fullscreen
            </span>
            <span className="md:hidden">swipe / scroll to read</span>
            <span>v-amm · 2026</span>
          </div>

          {/* spec notes */}
          <div className="mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <Note k="program" v="Solana devnet · Anchor framework" />
            <Note k="math" v="StableSwap (canonical Curve) + EWMA σ" />
            <Note k="fees" v="5 → 100 bps smoothstep, λ=0.95, rate-limited" />
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3">
            V-AMM · capstone research artifact
          </div>
          <Link
            href="/simulate"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-500 hover:text-violet-600 transition-colors duration-300"
          >
            try the simulator →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function zoomOut(z: "fit" | "100" | "125" | "150" | "200") {
  if (z === "fit") return "fit" as const;
  if (z === "100") return "fit" as const;
  if (z === "125") return "100" as const;
  if (z === "150") return "125" as const;
  return "150" as const;
}
function zoomIn(z: "fit" | "100" | "125" | "150" | "200") {
  if (z === "fit") return "100" as const;
  if (z === "100") return "125" as const;
  if (z === "125") return "150" as const;
  if (z === "150") return "200" as const;
  return "200" as const;
}

function CtrlBtn({
  onClick,
  ariaLabel,
  disabled,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className="font-mono text-xs text-text-2 hover:text-text disabled:text-text-3 disabled:cursor-not-allowed w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md hover:bg-bg transition-colors duration-200"
    >
      {children}
    </button>
  );
}

function Note({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-line rounded-lg bg-surface px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 mb-1">
        {k}
      </div>
      <div className="text-[13px] text-text-2 leading-snug">{v}</div>
    </div>
  );
}
