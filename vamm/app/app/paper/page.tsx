"use client";

import Link from "next/link";

export default function PaperPage() {
  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col">
      {/* ─── top bar ─── */}
      <header className="border-b border-line bg-bg/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-3 md:py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[10px] md:text-xs uppercase tracking-[0.16em] text-text-2 hover:text-text transition-colors duration-300 flex items-center gap-2"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
            ← v-amm / paper
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <a
              href="/VAMM_Style_F-1.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] md:text-xs uppercase tracking-[0.12em] border border-line text-text-2 hover:text-text hover:border-text-2 px-3 md:px-4 py-2 rounded-lg transition-colors duration-300"
            >
              Open in tab ↗
            </a>
            <a
              href="/VAMM_Style_F-1.pdf"
              download="VAMM_Style_F-1.pdf"
              className="font-mono text-[10px] md:text-xs uppercase tracking-[0.12em] bg-text text-bg hover:bg-violet-500 hover:text-white px-3 md:px-4 py-2 rounded-lg transition-colors duration-300"
            >
              Download ↓
            </a>
          </div>
        </div>
      </header>

      {/* ─── meta strip ─── */}
      <div className="border-b border-line">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-4 md:py-5 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Meta label="title" value="V-AMM" />
          <Meta label="subtitle" value="Volatility-Adaptive AMM" />
          <Meta label="format" value="research paper" />
          <Meta label="program id" value="75yCYN…fc9U4Zt" mono />
        </div>
      </div>

      {/* ─── pdf embed ─── */}
      <main className="flex-1 bg-bg">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-6 md:py-10">
          <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 md:px-5 py-2.5 md:py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                VAMM_Style_F-1.pdf
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3 hidden md:block">
                scroll to read
              </div>
            </div>
            <iframe
              src="/VAMM_Style_F-1.pdf#toolbar=1&navpanes=0&scrollbar=1&view=FitH"
              title="V-AMM research paper"
              className="w-full block bg-white"
              style={{ height: "calc(100vh - 280px)", minHeight: "600px" }}
            />
          </div>

          <div className="mt-5 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Note
              k="program"
              v="Solana devnet · Anchor framework"
            />
            <Note
              k="math"
              v="StableSwap (canonical Curve formula) + EWMA σ"
            />
            <Note
              k="fees"
              v="5 → 100 bps smoothstep, λ=0.95, rate-limited"
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-5 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
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

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 mb-1">
        {label}
      </div>
      <div
        className={
          "text-[13px] md:text-sm text-text " + (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
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
