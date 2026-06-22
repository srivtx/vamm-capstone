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

          {/* ── small abstract violet diagram (compact) ── */}
          <svg
            className="absolute z-20 pointer-events-none"
            style={{ right: "14px", top: "26px", width: "78px", height: "60px" }}
            viewBox="0 0 78 60"
            aria-hidden
          >
            {/* main curve */}
            <path
              d="M 4 50 C 16 50 26 50 33 46 C 40 42 42 26 47 14 C 52 4 62 3 74 4"
              stroke="#7c3aed"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
            {/* dot at the bend */}
            <circle cx="47" cy="14" r="1.6" fill="#7c3aed" />
            {/* ghost lines (range of motion) */}
            <path
              d="M 4 50 L 74 22"
              stroke="#7c3aed"
              strokeWidth="0.6"
              fill="none"
              strokeLinecap="round"
              opacity="0.28"
              strokeDasharray="1.5 2"
            />
            <path
              d="M 4 50 L 74 0"
              stroke="#7c3aed"
              strokeWidth="0.6"
              fill="none"
              strokeLinecap="round"
              opacity="0.22"
              strokeDasharray="1.5 2"
            />
          </svg>
        </div>

        {/* ───── DESKTOP: tall paper cover with full content ───── */}
        <div
          className="hidden lg:block relative w-full aspect-[4/3] bg-white border border-line rounded-xl overflow-hidden shadow-[0_18px_44px_-22px_rgba(12,12,14,0.22)] group-hover:shadow-[0_24px_60px_-22px_rgba(124,58,237,0.35)] group-hover:-translate-y-1 transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e5e5e0 1px, transparent 1px), linear-gradient(to bottom, #e5e5e0 1px, transparent 1px)",
              backgroundSize: "32px 32px",
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

          {/* ── ink-stamp ── */}
          <div
            className="absolute top-[58%] right-7 z-20 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-violet-500/55 border border-violet-500/35 px-1.5 py-0.5 rounded-sm"
            style={{ transform: "rotate(-6deg)" }}
          >
            v-amm
          </div>

          {/* ── abstract violet diagram: a "breathing" curve that morphs ── */}
          <svg
            className="absolute z-20 pointer-events-none"
            style={{ right: "30px", top: "60px", width: "170px", height: "135px" }}
            viewBox="0 0 170 135"
            aria-hidden
          >
            {/* a single flowing line that bends — the "morph" — in violet */}
            <path
              d="M 8 95 C 30 95 50 95 65 88 C 80 80 85 50 95 30 C 105 14 130 12 162 14"
              stroke="#7c3aed"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />

            {/* a small filled dot at the bend — the current state */}
            <circle cx="95" cy="30" r="2.4" fill="#7c3aed" />

            {/* two thin ghost lines showing the curve's range of motion (high A vs low A) */}
            <path
              d="M 8 95 L 162 38"
              stroke="#7c3aed"
              strokeWidth="0.7"
              fill="none"
              strokeLinecap="round"
              opacity="0.28"
              strokeDasharray="2 2.5"
            />
            <path
              d="M 8 95 L 162 6"
              stroke="#7c3aed"
              strokeWidth="0.7"
              fill="none"
              strokeLinecap="round"
              opacity="0.22"
              strokeDasharray="2 2.5"
            />

            {/* small tick marks on the right end — showing the range */}
            <path
              d="M 158 14 L 162 14"
              stroke="#7c3aed"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M 158 38 L 162 38"
              stroke="#7c3aed"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M 158 6 L 162 6"
              stroke="#7c3aed"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />

            {/* tiny annotation — italic σ above the bend */}
            <text
              x="100"
              y="14"
              fontFamily="Newsreader, Georgia, serif"
              fontStyle="italic"
              fontSize="11"
              fill="#7c3aed"
              dominantBaseline="hanging"
            >
              σ
            </text>

            {/* "A" sits above the curve at the top-right tick */}
            <text
              x="152"
              y="2"
              fontFamily="Newsreader, Georgia, serif"
              fontStyle="italic"
              fontSize="9"
              fill="#7c3aed"
              opacity="0.8"
              dominantBaseline="hanging"
            >
              A
            </text>
            <text
              x="2"
              y="102"
              fontFamily="Newsreader, Georgia, serif"
              fontStyle="italic"
              fontSize="10"
              fill="#1a1a1a"
              opacity="0.6"
              dominantBaseline="middle"
            >
              t
            </text>
          </svg>
        </div>

        {/* soft paper shadow under the card (desktop only) */}
        <div className="hidden lg:block absolute -bottom-4 left-8 right-8 h-6 bg-text/[0.07] rounded-full blur-md -z-30" />
      </Link>
    </div>
  );
}
