"use client";

import Link from "next/link";

export default function ResearchCard() {
  return (
    <Link
      href="/paper"
      className="group relative block w-full max-w-[300px] md:max-w-[280px] lg:max-w-[260px] xl:max-w-[280px]"
    >
      <div className="relative border border-line bg-surface rounded-2xl overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_-16px_rgba(124,58,237,0.25)] hover:-translate-y-1 hover:border-violet-500/40 transition-all duration-500"
        style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
      >
        {/* ───── visual: folded paper with V mark ───── */}
        <div className="relative h-[110px] bg-bg overflow-hidden">
          {/* grid lines, like notebook paper */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e5e5e0 1px, transparent 1px)",
              backgroundSize: "20px 100%",
            }}
          />
          {/* big italic V */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-display italic text-[64px] leading-none text-text/90 tracking-tight">
              <em>V</em>
            </div>
          </div>
          {/* small folded-corner */}
          <div className="absolute top-0 right-0 w-7 h-7">
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[28px] border-l-transparent border-t-[28px] border-t-line" />
            <div className="absolute top-[1px] right-[1px] w-0 h-0 border-l-[26px] border-l-transparent border-t-[26px] border-t-bg" />
          </div>
          {/* tiny σ decoration */}
          <div className="absolute bottom-2 left-3 font-mono text-[10px] text-text-3">
            σ
          </div>
          <div className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-[0.16em] text-text-3">
            vol.01
          </div>
        </div>

        {/* ───── body ───── */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-3">
              research
            </span>
          </div>

          <h3 className="font-display text-[17px] leading-[1.15] tracking-[-0.02em] text-text mb-1.5">
            The V-AMM
            <br />
            <em className="italic text-violet-500">research paper</em>
          </h3>

          <p className="text-[12px] leading-[1.45] text-text-2 mb-3">
            StableSwap, EWMA σ, dynamic fees — the full design.
          </p>

          <div className="flex items-center justify-between pt-3 border-t border-line">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-3">
              8 pp · pdf
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-violet-500 group-hover:text-violet-600 inline-flex items-center gap-1 transition-colors duration-300">
              Read
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
