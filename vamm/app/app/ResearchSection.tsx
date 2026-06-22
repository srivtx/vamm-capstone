"use client";

import Link from "next/link";

export default function ResearchSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 items-center">
      {/* ───── left: copy + meta ───── */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 mb-3">
          § 03
        </div>
        <h2 className="font-display text-[clamp(28px,6vw,44px)] leading-[1.06] tracking-[-0.02em] max-w-[14ch] text-text mb-4">
          The full
          <br />
          <em className="italic text-violet-500">research.</em>
        </h2>
        <p className="text-text-2 text-[14px] md:text-[15px] leading-[1.55] max-w-[42ch] mb-6">
          Sixteen pages. The math, the on-chain design, the adaptive-fee
          results — written up, not blogged.
        </p>

        <Link
          href="/paper"
          className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] bg-text text-bg hover:bg-violet-500 hover:text-white px-5 py-3 rounded-lg transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
        >
          Read the paper
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>

        <div className="mt-6 md:mt-7 flex flex-wrap gap-x-5 md:gap-x-6 gap-y-2 font-mono text-[10px] md:text-[10px] uppercase tracking-[0.14em] text-text-3">
          <span>16 pages</span>
          <span className="text-line">·</span>
          <span>PDF</span>
          <span className="text-line">·</span>
          <span>June 2026</span>
        </div>
      </div>

      {/* ───── right (or below on mobile): paper cover ───── */}
      <Link
        href="/paper"
        className="group block relative w-full"
        style={{ perspective: "1500px" }}
      >
        {/* ───── MOBILE: horizontal compact card (aspect 3/2) ───── */}
        <div
          className="lg:hidden relative w-full aspect-[3/2] bg-white border border-line rounded-xl overflow-hidden shadow-[0_10px_28px_-16px_rgba(12,12,14,0.18)] group-active:scale-[0.99] transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
        >
          {/* grid-paper background */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e5e5e0 1px, transparent 1px), linear-gradient(to bottom, #e5e5e0 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* violet corner */}
          <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-violet-500/14 to-transparent" />

          {/* left content column */}
          <div className="relative z-10 h-full flex flex-col justify-between p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-3">
                  research
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-3">
                vol. 01
              </span>
            </div>

            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-violet-500 mb-1.5">
                research paper
              </div>
              <h3 className="font-display text-[26px] sm:text-[30px] leading-[0.95] tracking-[-0.03em] text-text">
                <em className="italic text-violet-500">Volatility</em>{" "}
                Adaptive
                <br />
                AMM.
              </h3>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-3 mb-0.5">
                  author
                </div>
                <div className="text-[11px] text-text leading-none">
                  Sribatsha Dash
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-3 mb-0.5">
                  pages
                </div>
                <div className="text-[11px] text-text leading-none">16</div>
              </div>
            </div>
          </div>

          {/* right-edge ribbon */}
          <div className="absolute top-0 right-0 bottom-0 w-1 bg-violet-500" />
        </div>

        {/* ───── DESKTOP: tall paper cover with full content ───── */}
        <div
          className="hidden lg:block relative w-full aspect-[4/3] bg-white border border-line rounded-xl overflow-hidden shadow-[0_18px_44px_-22px_rgba(12,12,14,0.22)] group-hover:shadow-[0_24px_60px_-22px_rgba(124,58,237,0.35)] group-hover:-translate-y-1 transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e5e5e0 1px, transparent 1px), linear-gradient(to bottom, #e5e5e0 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-violet-500/12 to-transparent" />

          <div className="relative z-10 flex items-center justify-between px-7 pt-6">
            <div className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-3">
                v-amm · research
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-3">
              vol. 01
            </span>
          </div>

          <div className="relative z-10 px-7 mt-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-500 mb-3">
              research paper
            </div>
            <h3 className="font-display text-[clamp(32px,4vw,44px)] leading-[0.95] tracking-[-0.03em] text-text">
              <em className="italic text-violet-500">Volatility</em>
              <br />
              Adaptive
              <br />
              AMM.
            </h3>
          </div>

          <div className="relative z-10 px-7 mt-6 max-w-[55ch]">
            <p className="text-[12.5px] leading-[1.55] text-text-2">
              A Solana AMM whose bonding curve morphs in response to
              realized volatility. StableSwap, EWMA σ, and dynamic fees —
              end to end.
            </p>
          </div>

          <div className="relative z-10 px-7 mt-5">
            <div className="font-mono text-[11px] text-text-3 leading-[1.4]">
              A(σ) = A<sub className="text-[8px]">max</sub> · e
              <sup className="text-[8px]">−kσ</sup> &nbsp;·&nbsp; f(σ) =
              smoothstep(σ)
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-10 px-7 pb-6 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-3 mb-1">
                author
              </div>
              <div className="text-[13px] text-text">
                Sribatsha Dash
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-3 mb-1">
                date
              </div>
              <div className="text-[13px] text-text">
                June 2026
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-violet-500" />
        </div>

        {/* soft paper shadow under the card (desktop only) */}
        <div className="hidden lg:block absolute -bottom-4 left-8 right-8 h-6 bg-text/[0.07] rounded-full blur-md -z-10" />
      </Link>
    </div>
  );
}
