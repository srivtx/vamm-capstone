"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* ════════════════════ HERO ════════════════════ */}
      <section className="border-b border-line relative overflow-hidden">
        {/* Ambient light glows from the coins — subtle, premium (desktop + mobile) */}
        <div
          aria-hidden
          className="ambient-glow-usdc absolute pointer-events-none"
          style={{
            top: "12%",
            right: "20%",
            width: 320,
            height: 320,
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, rgba(37, 99, 235, 0) 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          aria-hidden
          className="ambient-glow-usdt absolute pointer-events-none"
          style={{
            bottom: "8%",
            right: "4%",
            width: 280,
            height: 280,
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0) 70%)",
            filter: "blur(40px)",
          }}
        />
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-12 md:py-24 relative z-10">
          {/* top tag */}
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-500 mb-5 md:mb-6 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            V-AMM · Solana · v1.2.0
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
            {/* ─── left: copy ─── */}
            <div>
              <h1 className="font-display text-[clamp(32px,8vw,72px)] leading-[1.02] tracking-[-0.03em] mb-5 md:mb-6 text-text">
                An AMM that{" "}
                <em className="italic text-violet-500">breathes</em>{" "}
                with the market.
              </h1>
              <p className="text-text-2 text-[15px] md:text-[17px] leading-[1.55] max-w-[52ch] mb-7 md:mb-8">
                A volatility-adaptive StableSwap on Solana. The curve shape
                and fees respond to on-chain price action in real time — no
                oracles, no governance, no keeper keys. Two permissionless
                cranks drive the brain.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/simulate"
                  className="font-mono text-xs uppercase tracking-[0.08em] bg-text text-bg px-5 py-3 rounded-lg hover:bg-violet-500 hover:text-white hover:-translate-y-0.5 hover:shadow-lg transition-all duration-500"
                  style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
                >
                  Open simulator →
                </Link>
                <a
                  href="https://github.com/srivtx/vamm-capstone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs uppercase tracking-[0.08em] border border-line text-text-2 px-5 py-3 rounded-lg hover:text-text hover:border-text-2 hover:-translate-y-0.5 transition-all duration-500"
                  style={{ transitionTimingFunction: "var(--ease-out-premium)" }}
                >
                  GitHub ↗
                </a>
              </div>

              {/* small spec strip */}
              <div className="mt-10 md:mt-12 grid grid-cols-3 gap-4 md:gap-6 max-w-md">
                <Spec label="amp" value="auto" hint="A_max → 1 by σ" />
                <Spec label="fee" value="5→100" hint="bps by σ" />
                <Spec label="crank" value="2" hint="vol, curve" />
              </div>
            </div>

            {/* ─── right: phone with coins on each side (diagonal composition) ─── */}
            <div className="relative flex justify-center lg:justify-end items-center">
              {/* USDC: above-left, frames the top of the phone */}
              <div className="coin-entrance coin-entrance--left hidden lg:block absolute right-[calc(100%-70px)] top-[14%] z-0">
                <Coin variant="usdc" size={105} />
              </div>
              {/* USDT: below-right, further from the phone, gives breathing room */}
              <div className="coin-entrance coin-entrance--right hidden lg:block absolute right-[-100px] bottom-[8%] z-0">
                <Coin variant="usdt" size={85} />
              </div>
              {/* Mobile: same full coins as desktop (3D perspective auto-disabled on mobile via CSS) */}
              <div className="coin-entrance coin-entrance--left lg:hidden absolute left-[-28px] top-[20%] z-20">
                <Coin variant="usdc" size={85} />
              </div>
              <div className="coin-entrance coin-entrance--right lg:hidden absolute right-[-28px] bottom-[16%] z-20">
                <Coin variant="usdt" size={72} />
              </div>
              <div className="relative z-10">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ WHAT IT DOES ════════════════════ */}
      <RevealSection className="border-b border-line">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-14 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 md:gap-12">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 mb-3">
                § 01
              </div>
              <h2 className="font-display text-[clamp(26px,6vw,40px)] leading-[1.1] tracking-[-0.02em] max-w-[16ch] text-text">
                Three mechanisms, one brain.
              </h2>
            </div>

            <ol className="space-y-0 border-t border-line">
              <ListItem
                n="01"
                title="StableSwap curve"
                body={
                  <>
                    Newton-Raphson solver for the D invariant. Amplification
                    A starts at A<sub>max</sub> and ramps toward a target
                    driven by realized volatility. Tight in calm markets,
                    protective when things get rough.
                  </>
                }
              />
              <ListItem
                n="02"
                title="EWMA volatility engine"
                body={
                  <>
                    Exponentively weighted moving average of price jumps.
                    λ=0.95 on a 15-minute ring buffer, plus a 1-hour
                    window. σ is annualized to feed fee and A targets.
                  </>
                }
              />
              <ListItem
                n="03"
                title="Dynamic fee schedule"
                body={
                  <>
                    Piecewise smoothstep from 5 to 100 bps based on σ. EMA
                    smoothed (α=0.9) and rate-limited to 10 bps per slot.
                    No jumps, no arb windows.
                  </>
                }
              />
            </ol>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════ THE MATH ════════════════════ */}
      <RevealSection className="border-b border-line">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-14 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 md:gap-12">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3 mb-3">
                § 02
              </div>
              <h2 className="font-display text-[clamp(26px,6vw,40px)] leading-[1.1] tracking-[-0.02em] max-w-[16ch] text-text">
                The invariant.
              </h2>
              <p className="text-text-2 text-[15px] leading-[1.65] max-w-[40ch] mt-5 md:mt-6">
                StableSwap blends constant-sum and constant-product via a
                single parameter A. The D invariant stays constant across
                swaps. Volatility tightens the curve and raises fees; calm
                relaxes both.
              </p>
            </div>

            <pre
              data-lenis-prevent
              className="font-mono text-[10.5px] md:text-[13px] leading-[1.7] md:leading-[1.85] text-text-2 bg-surface border border-line rounded-2xl p-4 md:p-6 scrollbar-hidden whitespace-pre-wrap md:whitespace-pre"
            >
{`4A(x + y) + D  =  4AD + D³ / (4xy)

A(σ)           =  A_max · exp(−k·σ)
                        ≈  A_max · (1 − k·σ/100)

fee(σ)         =  5 bps                       if σ ≤ 15%
                =  5 + 25·S((σ−15%)/60%) bps  if 15% < σ < 75%
                =  30 + 70·S((σ−75%)/45%) bps if 75% ≤ σ < 120%
                =  100 bps                     if σ ≥ 120%

σ(returns)    =  √(EWMA) · √(SECONDS_PER_YEAR / BUCKET_SECONDS)

EWMA_t        =  λ · EWMA_{t-1}  +  (1−λ) · return_t²   with λ = 0.95

A_ramp        =  linear interp over 9000 slots (~1h)
                  when |target − A| / A > 10%`}
            </pre>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="max-w-[1280px] mx-auto px-6 md:px-10 py-12 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] text-text-3">
        <span>V-AMM · Turbine Capstone · 2026</span>
        <span>MIT</span>
        <a
          href="https://github.com/srivtx/vamm-capstone"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text"
        >
          github.com/srivtx/vamm-capstone ↗
        </a>
        <span className="ml-auto">Deployed: devnet · 75yCYNeZrSoVKWk5kFti7tRpRacZHptmAqtPwfc9U4Zt</span>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function RevealSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3;
}) {
  const ref = useReveal<HTMLElement>();
  const cls = delay ? `reveal reveal-${delay}` : "reveal";
  return (
    <section ref={ref} className={`${cls} ${className ?? ""}`}>
      {children}
    </section>
  );
}

function Spec({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
        {label}
      </div>
      <div className="font-display text-2xl text-text tabular-nums mt-1 leading-none">
        {value}
      </div>
      <div className="font-mono text-[10px] text-text-3/70 mt-1">{hint}</div>
    </div>
  );
}

/**
 * Real USDC / USDT coins. Brand-accurate colors, custom letter paths
 * (hand-drawn feel, not a font). Skewed 3/4 perspective. The shadow is
 * a static element on the "ground" (doesn't rotate with the coin).
 */
function Coin({
  variant,
  size = 200,
  className = "",
  simple = false,
}: {
  variant: "usdc" | "usdt";
  size?: number;
  className?: string;
  simple?: boolean;
}) {
  const isUsdc = variant === "usdc";
  const palette = isUsdc
    ? {
        rim: "#1e3a8a",
        edgeTop: "#3b82f6",
        edgeMid: "#1d4ed8",
        edgeBot: "#172554",
        face: "#1d4ed8",
        faceDeep: "#1e3a8a",
        highlight: "#3b82f6",
        water: "#2563eb",
        letter: "#ffffff",
        letterShadow: "rgba(15, 23, 42, 0.5)",
        micro: "#93c5fd",
      }
    : {
        rim: "#064e3b",
        edgeTop: "#10b981",
        edgeMid: "#047857",
        edgeBot: "#022c22",
        face: "#047857",
        faceDeep: "#064e3b",
        highlight: "#10b981",
        water: "#059669",
        letter: "#ffffff",
        letterShadow: "rgba(6, 78, 59, 0.5)",
        micro: "#6ee7b7",
      };
  const id = `coin-${variant}`;

  // Simple flat version — looks like real USDC/USDT coin from reference sites
  if (simple) {
    const mainColor = isUsdc ? "#2775ca" : "#26a17b";
    const darkColor = isUsdc ? "#1652f0" : "#0e8a5f";
    const textColor = "#ffffff";
    const r = size / 2;
    return (
      <div
        className={`pointer-events-none select-none ${className}`}
        style={{ width: size, height: size, position: "relative" }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <svg viewBox="0 0 100 100" width={size} height={size} className="block">
            {/* Outer ring (thin) */}
            <circle cx="50" cy="50" r="49" fill="none" stroke={darkColor} strokeWidth="1.5" />
            {/* Main face — solid color, slight inner gradient */}
            <defs>
              <linearGradient id={`s-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={mainColor} />
                <stop offset="100%" stopColor={darkColor} />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="47" fill={`url(#s-${id})`} />
            {/* Inner highlight ring (subtle) */}
            <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" />
            {/* Symbol — bold white, distinctive font */}
            {isUsdc ? (
              <text
                x="50" y="50" textAnchor="middle" dominantBaseline="central"
                fontSize="42" fontWeight="700" fill={textColor}
                fontFamily="'Geist', 'Inter', system-ui, -apple-system, sans-serif"
                fontWeight="900"
                style={{ fontStretch: 'condensed' }}
              >$</text>
            ) : (
              <text
                x="50" y="50" textAnchor="middle" dominantBaseline="central"
                fontSize="52" fontWeight="700" fill={textColor}
                fontFamily="'Geist', 'Inter', system-ui, -apple-system, sans-serif"
                style={{ fontStretch: 'condensed' }}
              >₮</text>
            )}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, position: "relative" }}
    >
      {/* STATIC ground shadow — pulses with the coin's float (bigger when up, smaller when down) */}
      <div
        aria-hidden
        className="coin-shadow"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "0%",
          transform: "translate(-50%, 50%)",
          width: "70%",
          height: size * 0.08,
          borderRadius: "50%",
          background: isUsdc ? "rgba(30, 64, 175, 0.35)" : "rgba(6, 78, 59, 0.35)",
          filter: "blur(6px)",
        }}
      />

      {/* Rotating coin */}
      <div
        className="coin-inner"
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <svg
          viewBox="0 0 200 200"
          width={size}
          height={size}
          className="block"
        >
          <defs>
            <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.face} />
              <stop offset="100%" stopColor={palette.faceDeep} />
            </linearGradient>
            <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.edgeTop} />
              <stop offset="50%" stopColor={palette.edgeMid} />
              <stop offset="100%" stopColor={palette.edgeBot} />
            </linearGradient>
            <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-bottomshadow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="70%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* EDGE BAND (3/4 view thickness) */}
          <path
            d="M 18 110 Q 18 140 100 146 Q 182 140 182 110 L 182 118 Q 182 146 100 152 Q 18 146 18 118 Z"
            fill={`url(#${id}-edge)`}
          />

          {/* TOP FACE — fills more of the viewBox so the color is dominant */}
          <ellipse cx="100" cy="100" rx="92" ry="88" fill={`url(#${id}-face)`} />

          {/* Decorative inner ring */}
          <ellipse cx="100" cy="100" rx="74" ry="70" fill="none" stroke={palette.rim} strokeWidth="0.8" opacity="0.35" />
          <ellipse cx="100" cy="100" rx="70" ry="66" fill="none" stroke={palette.highlight} strokeWidth="0.5" opacity="0.45" />

          {/* Tiny radial "minted" marks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 360) / 36;
            return (
              <line
                key={i}
                x1="100"
                y1="32"
                x2="100"
                y2="38"
                stroke={palette.rim}
                strokeWidth="0.6"
                opacity="0.3"
                transform={`rotate(${angle} 100 100)`}
              />
            );
          })}

          {/* MAIN SYMBOL — USDC "$" or USDT "₮" drawn as a bold path */}
          {isUsdc ? (
            <g>
              <line x1="100" y1="56" x2="100" y2="146" stroke={palette.letter} strokeWidth="6" strokeLinecap="round" opacity="0.95" />
              <path
                d="M 132 78 C 122 66, 92 64, 80 72 C 68 82, 70 96, 86 100 C 100 104, 112 108, 118 116 C 124 128, 110 140, 92 138 C 78 136, 70 128, 68 122"
                fill="none"
                stroke={palette.letter}
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
                style={{ filter: `drop-shadow(0 2px 0 ${palette.letterShadow})` }}
              />
            </g>
          ) : (
            <g>
              <line x1="50" y1="72" x2="150" y2="72" stroke={palette.letter} strokeWidth="11" strokeLinecap="round" opacity="0.95" />
              <line x1="100" y1="72" x2="100" y2="148" stroke={palette.letter} strokeWidth="11" strokeLinecap="round" opacity="0.95" />
              <line x1="76" y1="92" x2="124" y2="92" stroke={palette.letter} strokeWidth="7" strokeLinecap="round" opacity="0.95" />
            </g>
          )}

          {/* Token name below the symbol */}
          <text
            x="100"
            y="166"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fill={palette.letter}
            opacity="0.85"
            letterSpacing="0.18em"
          >
            {isUsdc ? "USDC" : "USDT"}
          </text>

          {/* TOP GLOSS highlight */}
          <ellipse cx="100" cy="44" rx="64" ry="18" fill={`url(#${id}-gloss)`} />
          <ellipse cx="72" cy="38" rx="14" ry="5" fill="#ffffff" opacity="0.7" transform="rotate(-25 72 38)" />

          {/* BOTTOM rim shadow on the face */}
          <ellipse cx="100" cy="100" rx="82" ry="78" fill={`url(#${id}-bottomshadow)`} />
        </svg>
      </div>
    </div>
  );
}

/** Adds .in class when element scrolls into view (one-shot). Falls back to
 *  immediately showing if the observer never fires (small viewports, tall content). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const showNow = () => el.classList.add("in");

    if (typeof IntersectionObserver === "undefined") {
      showNow();
      return;
    }

    // Safety net: if observer never fires within 2.5s (small viewport, weird
    // height), reveal anyway. Better than invisible content.
    const safety = window.setTimeout(showNow, 2500);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            showNow();
            window.clearTimeout(safety);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -4% 0px" },
    );
    io.observe(el);

    // Also check immediately on next frame (handles elements already visible
    // at mount, which IntersectionObserver can miss on mobile).
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < vh * 0.95 && rect.bottom > 0) {
        showNow();
        window.clearTimeout(safety);
        io.disconnect();
      }
    });

    return () => {
      window.clearTimeout(safety);
      io.disconnect();
    };
  }, []);
  return ref;
}

function ListItem({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[48px_1fr] gap-4 py-7 border-b border-line">
      <span className="font-mono text-[12px] text-text-3 pt-[3px] tabular-nums">{n}</span>
      <div>
        <h3 className="font-display text-xl text-text mb-2 tracking-[-0.01em]">
          {title}
        </h3>
        <p className="text-text-2 text-[15px] leading-[1.65] max-w-[68ch]">{body}</p>
      </div>
    </li>
  );
}

/**
 * iPhone-style frame containing an animated product showcase.
 * Shows the brain in action — calm → chaos → calm loop.
 */
function PhoneMockup() {
  return (
    <div className="relative" style={{ perspective: "1000px" }}>
      {/* soft glow behind the phone */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.35), transparent 70%)",
        }}
      />

      <div
        className="phone-mockup relative mx-auto animate-[float_14s_ease-in-out_infinite]"
        style={{
          width: 300,
          height: 620,
        }}
      >
        {/* outer frame (phone body) */}
        <div
          className="absolute inset-0 rounded-[48px] bg-gradient-to-br from-[#1a1a1c] via-[#0a0a0c] to-[#1a1a1c] shadow-2xl"
          style={{
            padding: 10,
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
          }}
        >
          {/* side buttons (visual) */}
          <div className="absolute -left-[3px] top-[110px] w-[3px] h-7 rounded-l-sm bg-[#2a2a2c]" />
          <div className="absolute -left-[3px] top-[150px] w-[3px] h-12 rounded-l-sm bg-[#2a2a2c]" />
          <div className="absolute -right-[3px] top-[140px] w-[3px] h-16 rounded-r-sm bg-[#2a2a2c]" />

          {/* screen */}
          <div
            className="relative w-full h-full bg-bg rounded-[40px] overflow-hidden"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
          >
            {/* dynamic island */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[88px] h-[26px] rounded-full bg-black z-20" />

            <ShowcaseScreen />
          </div>
        </div>
      </div>

      {/* tag below phone */}
      <div className="text-center mt-8 font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
        The brain in action
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}

/**
 * Animated product showcase: a calm→chaos loop that demonstrates
 * the brain responding to volatility.
 */
function ShowcaseScreen() {
  const [t, setT] = useState(0); // 0..1..0 ping-pong
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      // 8s loop, smooth ping-pong (0→1→0)
      const phase = (elapsed % 8) / 8;
      const v = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      setT(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // derived values, eased for visual smoothness
  const ease = (x: number) => x * x * (3 - 2 * x);
  const e = ease(t);

  const sigmaPct = e * 180; // 0..180%
  const feeBps = Math.round(5 + e * 90); // 5..95 bps
  const curveA = Math.round(100 - e * 90); // 100..10
  const spot = 1 + (e - 0.5) * 0.05; // 0.975..1.025

  // chart trail — i=0 oldest, i=N-1 newest (so x-axis flows left→right = time)
  const trail = useMemo(() => {
    const pts: number[] = [];
    const N = 60;
    for (let i = 0; i < N; i++) {
      const age = N - 1 - i; // 0 = oldest, N-1 = newest
      const local = Math.max(0, Math.min(1, t - age * 0.012));
      const le = local * local * (3 - 2 * local);
      pts.push(5 + le * 90);
    }
    return pts;
  }, [t]);

  const phase =
    t < 0.15 ? "calm" :
    t < 0.45 ? "swapping" :
    t < 0.65 ? "brain reacting" :
    t < 0.85 ? "deamplifying" :
    "settling";

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 flex flex-col font-sans text-text overflow-hidden">
      {/* ── iOS status bar ── */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 font-mono text-[10px] text-text-2 tabular-nums">
        <span className="font-semibold">9:41</span>
        <span>● ● ●</span>
      </div>

      {/* ── nav bar ── */}
      <div className="flex items-center justify-between px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em]">
        <span className="text-violet-500">← home</span>
        <span className="text-text-3">slot 142</span>
        <span className="text-violet-500">reset</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col gap-2 px-3 pb-3">
        {/* ── spot card ── */}
        <div className="bg-surface rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
            <span>Spot</span>
            <span>USDT / USDC</span>
          </div>
          <div className="font-display tabular-nums text-[26px] leading-[1] tracking-[-0.02em] text-text">
            <AnimatedNumber value={spot.toFixed(4)} />
          </div>
        </div>

        {/* ── brain card ── */}
        <div className="bg-surface rounded-2xl p-3.5">
          <div className="grid grid-cols-3 gap-3">
            <BrainStat label="Fee" value={feeBps} unit="bps" />
            <BrainStat label="σ" value={sigmaPct.toFixed(1)} unit="%" />
            <BrainStat label="A" value={curveA} unit="" />
          </div>
          <div className="mt-2.5 h-[3px] bg-line rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${((feeBps - 5) / 95) * 100}%`,
                background:
                  feeBps <= 30 ? "#10b981" :
                  feeBps <= 60 ? "#8b5cf6" :
                  feeBps <= 80 ? "#f59e0b" : "#f43f5e",
              }}
            />
          </div>
          <div className="flex justify-between mt-1 font-mono text-[8px] text-text-3 tabular-nums">
            <span>5</span><span>30</span><span>60</span><span>100</span>
          </div>
        </div>

        {/* ── chart card (full width) ── */}
        <div className="bg-surface rounded-2xl p-3.5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
              Fee · live
            </span>
            <span className="font-mono text-[11px] tabular-nums text-text">
              {feeBps} <span className="text-text-3 text-[9px]">bps</span>
            </span>
          </div>
          <div className="h-14">
            <svg viewBox="0 0 240 50" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="feegrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const max = 100;
                const min = 0;
                const range = max - min;
                const N = trail.length;
                const points = trail
                  .map((v, i) => {
                    const x = (i / (N - 1)) * 240;
                    const y = 50 - ((v - min) / range) * 50;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ");
                const area = `0,50 ${points} 240,50`;
                return (
                  <>
                    <polygon points={area} fill="url(#feegrad)" />
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* ── activity (full width, compact) ── */}
        <div className="bg-surface rounded-2xl p-3.5 flex-1 min-h-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3 mb-1.5">
            Activity
          </div>
          <div className="font-mono text-[10px] text-text-2 leading-[1.7] tabular-nums">
            {[
              { th: 0.08, slot: 142, text: "swap 1,000 USDC→USDT" },
              { th: 0.20, slot: 143, text: "vol crank  σ 47%" },
              { th: 0.38, slot: 144, text: "swap 1,000 USDC→USDT" },
              { th: 0.55, slot: 145, text: "curve ramp  A 100→58" },
              { th: 0.72, slot: 146, text: "swap 1,000 USDC→USDT" },
              { th: 0.88, slot: 147, text: "vol crank  σ 162%" },
            ].map((row) => {
              const dist = t - row.th;
              const op = dist <= 0 ? 0 : Math.min(1, dist * 10);
              return (
                <div
                  key={row.slot}
                  style={{
                    opacity: op,
                    transform: `translateY(${(1 - op) * 4}px)`,
                    transition: "opacity 200ms linear, transform 200ms linear",
                  }}
                >
                  <span className="text-text-3">slot {row.slot}</span>  {row.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainStat({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
        {label}
      </div>
      <div className="font-mono tabular-nums text-[13px] text-text mt-1 leading-none transition-colors duration-300">
        {value}
        {unit && <span className="text-text-3 text-[9px] ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

/** Number that smoothly transitions width as digits change, preventing jitter. */
function AnimatedNumber({ value }: { value: string }) {
  return (
    <span className="inline-block tabular-nums transition-all duration-200">
      {value}
    </span>
  );
}
