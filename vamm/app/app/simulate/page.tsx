"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PoolSimulator, type PoolConfig } from "../../lib/simulator";
import { computeD, getDy, getPrice } from "../../lib/stableswap";

const DEFAULT_CONFIG: PoolConfig = {
  aMax: 100n,
  k: 2n,
  baseFeeBps: 5n,
  reserveA: 1_000_000n * 1_000_000n,
  reserveB: 1_000_000n * 1_000_000n,
};

const SCALE = 1_000_000_000_000n; // 1e12
const PRICE_SCALE = 1_000_000_000_000_000_000n; // 1e18

// ──────────────────────────────────────────────────────────────────────────────
// Number formatters
// ──────────────────────────────────────────────────────────────────────────────

const NF_PRICE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});
const NF_INT = new Intl.NumberFormat("en-US");
const NF_BPS = new Intl.NumberFormat("en-US");
const NF_PCT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtPrice1e18(p: bigint): string {
  return NF_PRICE.format(Number(p) / 1e18);
}
function fmtTokens(n: bigint): string {
  // n is in 1e6 scale. Show as "1,234,567.89" with 2 fractional digits.
  const raw = n.toString().padStart(7, "0");
  const sign = raw.startsWith("-") ? "-" : "";
  const abs = sign ? raw.slice(1) : raw;
  const whole = abs.slice(0, -6) || "0";
  const frac = abs.slice(-6, -4) || "00";
  return `${sign}${NF_INT.format(Number(whole))}.${frac}`;
}
function fmtBps(n: bigint | number): string {
  return `${NF_BPS.format(Number(n))} bps`;
}
function fmtA(a: bigint): string {
  return NF_INT.format(Number(a));
}
function fmtD(d: bigint): string {
  const s = d.toString();
  if (s.length <= 16) return s;
  const exp = s.length - 1;
  return `${s[0]}.${s.slice(1, 3)}e${exp}`;
}
function fmtPercentFromScaled(sigma: bigint): string {
  return ((Number(sigma) / 1e12) * 100).toFixed(2);
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const simRef = useRef<PoolSimulator | null>(null);
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [swapAmount, setSwapAmount] = useState("1000");
  const [isAToB, setIsAToB] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tickKey, setTickKey] = useState(0); // drives the quote recompute
  const [lastTx, setLastTx] = useState<{
    amountIn: string;
    amountOut: string;
    fee: string;
    impact: string;
    direction: "A→B" | "B→A";
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    simRef.current = PoolSimulator.create(DEFAULT_CONFIG);
    simRef.current.crankCurve();
    force((n) => n + 1);
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [msg, ...prev].slice(0, 20));
  }, []);

  const rerender = useCallback(() => {
    force((n) => n + 1);
    setTickKey((k) => k + 1);
  }, []);

  // Auto-run effect (hoisted so it doesn't run before mount)
  useEffect(() => {
    if (!autoRunning) return;
    const id = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      try {
        const size = BigInt(Math.floor(Math.random() * 50_000) + 1_000) * 1_000_000n;
        const dir = Math.random() < 0.5;
        sim.swap(size, dir);
        if (sim.slot % 4n === 0n) sim.crankVolatility();
        if (sim.slot % 2n === 0n) sim.crankCurve();
        const lastSnap = sim.history[sim.history.length - 1];
        const sigmaPct = lastSnap ? fmtPercentFromScaled(lastSnap.sigma) : "0";
        setLogs((prev) =>
          [
            `slot ${sim.slot}  auto  ${(Number(size) / 1e6).toFixed(0)} ${dir ? "A→B" : "B→A"}  fee=${sim.currentFeeBps}bps  σ=${sigmaPct}%`,
            ...prev,
          ].slice(0, 20),
        );
        force((n) => n + 1);
        setTickKey((k) => k + 1);
      } catch { /* skip */ }
    }, 400);
    return () => clearInterval(id);
  }, [autoRunning]);

  const sim = simRef.current;
  const reserveA = sim?.reserveA ?? 0n;
  const reserveB = sim?.reserveB ?? 0n;
  const curveACurrent = sim?.curveACurrent ?? 100n;
  const currentFeeBps = sim ? Number(sim.currentFeeBps) : 5;
  const sigmaPct = sim ? fmtPercentFromScaled(sim.ewma15min) : "0.00";
  const spotPrice1e18 = sim ? getPrice([reserveA, reserveB], curveACurrent) : 0n;

  // live quote (must be called every render — same hook order)
  const quote = useMemo(() => {
    if (!sim) return null;
    const amt = parseAmount(swapAmount);
    if (amt === null || amt === 0n) return null;
    try {
      const fee = (amt * BigInt(currentFeeBps)) / 10_000n;
      const inAfterFee = amt - fee;
      const dy = getDy(
        [reserveA, reserveB],
        isAToB ? 0 : 1,
        isAToB ? 1 : 0,
        inAfterFee,
        curveACurrent,
      );
      const spotBefore = Number(spotPrice1e18) / 1e18;
      const amountInHuman = Number(amt) / 1e6;
      const amountOutHuman = Number(dy) / 1e6;
      const rate = amountInHuman > 0 ? amountOutHuman / amountInHuman : 0;
      const impact = amountInHuman > 0
        ? (Math.abs(rate - spotBefore) / spotBefore) * 100
        : 0;
      return {
        amountIn: amt,
        amountOut: dy,
        fee,
        rate,
        impact,
        amountInHuman,
        amountOutHuman,
      };
    } catch {
      return null;
    }
  }, [swapAmount, isAToB, currentFeeBps, reserveA, reserveB, curveACurrent, spotPrice1e18, tickKey, sim]);

  const dInvariant = useMemo(() => {
    void tickKey;
    if (!sim) return 0n;
    return computeD([reserveA, reserveB], curveACurrent);
  }, [sim, reserveA, reserveB, curveACurrent, tickKey]);

  if (!mounted || !sim) {
    return (
      <div className="min-h-screen bg-bg text-text-3 font-mono text-xs flex items-center justify-center">
        loading…
      </div>
    );
  }

  // ── actions
  const handleSwap = () => {
    if (!quote) return;
    try {
      const r = sim.swap(quote.amountIn, isAToB);
      addLog(
        `slot ${sim.slot}  swap ${quote.amountInHuman.toFixed(2)} ${isAToB ? "USDC" : "USDT"} → ${(Number(r.amountOut) / 1e6).toFixed(2)} ${isAToB ? "USDT" : "USDC"}  fee ${r.feeBps}bps  impact ${r.priceImpact.toFixed(3)}%`,
      );
      setLastTx({
        amountIn: quote.amountInHuman.toFixed(2),
        amountOut: (Number(r.amountOut) / 1e6).toFixed(2),
        fee: `${r.feeBps} bps`,
        impact: `${r.priceImpact.toFixed(3)}%`,
        direction: isAToB ? "A→B" : "B→A",
      });
      rerender();
    } catch (e) {
      addLog(`! ${(e as Error).message}`);
    }
  };

  const handleStress = () => {
    const size = 50_000n * 1_000_000n;
    let okCount = 0;
    for (let i = 0; i < 20; i++) {
      try {
        sim.swap(size, isAToB);
        okCount++;
      } catch { /* skip */ }
    }
    sim.crankVolatility();
    sim.crankCurve();
    const lastSnap = sim.history[sim.history.length - 1];
    const sigmaPct = lastSnap ? fmtPercentFromScaled(lastSnap.sigma) : "0";
    addLog(`slot ${sim.slot}  stress ${okCount}/20×5% A→${isAToB ? "B" : "A"}  fee=${sim.currentFeeBps} bps  σ=${sigmaPct}%`);
    setLastTx({
      amountIn: `${(Number(size) / 1e6) * okCount}`,
      amountOut: "—",
      fee: `${sim.currentFeeBps} bps`,
      impact: "stress",
      direction: isAToB ? "A→B" : "B→A",
    });
    rerender();
  };

  const handleCrankVol = () => {
    const r = sim.crankVolatility();
    const lastSnap = sim.history[sim.history.length - 1];
    const sigmaPct = lastSnap ? fmtPercentFromScaled(lastSnap.sigma) : "0";
    addLog(
      `slot ${sim.slot}  vol crank  σ=${sigmaPct}%  fee=${sim.currentFeeBps}bps  A target=${fmtA(r.targetA)}`,
    );
    rerender();
  };

  const handleCrankCurve = () => {
    const r = sim.crankCurve();
    if (r.oldA !== r.newA) {
      addLog(`slot ${sim.slot}  curve crank  A ${fmtA(r.oldA)} → ${fmtA(r.newA)}`);
    } else {
      addLog(`slot ${sim.slot}  curve crank  A=${fmtA(r.newA)} (no change)`);
    }
    rerender();
  };

  const handleAdvance = (n: number) => {
    sim.advanceSlots(n);
    addLog(`slot ${sim.slot}  +${n} slot${n > 1 ? "s" : ""}`);
    rerender();
  };

  const handleReset = () => {
    simRef.current = PoolSimulator.create(DEFAULT_CONFIG);
    simRef.current.crankCurve();
    setLogs(["pool reset"]);
    setLastTx(null);
    rerender();
  };

  const handleAutoRun = () => {
    setAutoRunning((r) => !r);
  };

  // ── brain gauge
  const feeBarPct = Math.min(100, Math.max(0, ((currentFeeBps - 5) / 95) * 100));
  const feeColor =
    currentFeeBps <= 5 ? "bg-emerald-500" :
    currentFeeBps <= 30 ? "bg-violet-500" :
    currentFeeBps <= 60 ? "bg-amber-500" :
    "bg-rose-500";

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* ════════════════════ HEADER ════════════════════ */}
      <header className="border-b border-line bg-surface/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-mono text-[11px] tracking-[0.12em] text-text-3 hover:text-text">
            ← V-AMM
          </Link>
          <div className="font-mono text-[11px] text-text-3 tabular-nums">
            slot {NF_INT.format(Number(sim.slot))}
          </div>
          <button
            onClick={handleReset}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-3 hover:text-text"
          >
            reset
          </button>
        </div>
      </header>

      {/* ════════════════════ MAIN ════════════════════ */}
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* ─── HERO: spot price + brain status ─── */}
        <section className="bg-surface border border-line rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
              Spot
            </span>
            <span className="font-mono text-[10px] tabular-nums text-text-3">
              USDT / USDC
            </span>
          </div>
          <div className="font-display tabular-nums text-[44px] leading-[1.05] tracking-[-0.02em] text-text">
            {fmtPrice1e18(spotPrice1e18)}
          </div>

          {/* brain strip */}
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-line">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
                Fee
              </div>
              <div className="font-mono text-[15px] tabular-nums text-text mt-0.5">
                {currentFeeBps} <span className="text-text-3 text-[11px]">bps</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
                σ annual
              </div>
              <div className="font-mono text-[15px] tabular-nums text-text mt-0.5">
                {sigmaPct}<span className="text-text-3 text-[11px]">%</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
                A
              </div>
              <div className="font-mono text-[15px] tabular-nums text-text mt-0.5">
                {fmtA(sim.curveACurrent)}
              </div>
            </div>
          </div>

          {/* fee gauge bar */}
          <div className="mt-3 h-1 bg-line-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${feeColor} transition-all duration-700`}
              style={{ width: `${feeBarPct}%`, transitionTimingFunction: "var(--ease-out-premium)" }}
            />
          </div>
          <div className="flex justify-between mt-1 font-mono text-[8px] text-text-3/70 tabular-nums">
            <span>5 bps</span>
            <span>30</span>
            <span>60</span>
            <span>100</span>
          </div>
        </section>

        {/* ─── SWAP CARD ─── */}
        <section className="bg-surface border border-line rounded-2xl p-1">
          {/* You pay */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
                You pay
              </span>
              <span className="font-mono text-[10px] tabular-nums text-text-3">
                bal {fmtTokens(isAToB ? reserveA : reserveB)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="flex-1 bg-transparent font-display tabular-nums text-[32px] leading-[1.1] tracking-[-0.02em] text-text placeholder:text-text-3/40 focus:outline-none min-w-0"
              />
              <button
                onClick={() => setIsAToB(!isAToB)}
                className="shrink-0 font-mono text-xs px-3 py-2 rounded-lg border bg-text text-bg border-text tabular-nums flex items-center gap-1.5"
              >
                <TokenMark side={isAToB ? "A" : "B"} />
                {isAToB ? "USDC" : "USDT"}
              </button>
            </div>
          </div>

          {/* direction toggle */}
          <div className="flex justify-center -my-2 relative z-[1]">
            <button
              onClick={() => setIsAToB(!isAToB)}
              className="w-9 h-9 rounded-full bg-bg border border-line-2 flex items-center justify-center text-text-2 hover:border-text hover:text-text transition-all duration-500"
              aria-label="switch direction"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 2v9M4 11l-2-2M4 11l2-2M10 12V3M10 3l-2 2M10 3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* You receive */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
                You receive
              </span>
              <span className="font-mono text-[10px] tabular-nums text-text-3">
                bal {fmtTokens(isAToB ? reserveB : reserveA)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-display tabular-nums text-[32px] leading-[1.1] tracking-[-0.02em] text-text min-w-0 truncate">
                {quote ? quote.amountOutHuman.toFixed(2) : "0.00"}
              </div>
              <div className="shrink-0 font-mono text-xs px-3 py-2 rounded-lg border bg-bg-2 text-text-2 border-line-2 tabular-nums flex items-center gap-1.5">
                <TokenMark side={isAToB ? "B" : "A"} />
                {isAToB ? "USDT" : "USDC"}
              </div>
            </div>
          </div>

          {/* details */}
          <div className="border-t border-line px-4 py-3 space-y-1.5 font-mono text-[11px]">
            <Row label="Rate" value={
              quote
                ? `1 ${isAToB ? "USDC" : "USDT"} = ${quote.rate.toFixed(4)} ${isAToB ? "USDT" : "USDC"}`
                : "—"
            } />
            <Row label="Fee" value={
              quote
                ? `${currentFeeBps} bps · ${(Number(quote.fee) / 1e6).toFixed(4)} ${isAToB ? "USDC" : "USDT"}`
                : "—"
            } />
            <Row label="Impact" value={
              quote ? `${quote.impact.toFixed(3)}%` : "—"
            } />
            <Row label="D invariant" value={fmtD(dInvariant)} />
          </div>
        </section>

        {/* ─── SWAP BUTTON ─── */}
        <button
          onClick={handleSwap}
          disabled={!quote || quote.amountIn === 0n}
          className="w-full font-mono text-sm uppercase tracking-[0.08em] bg-text text-bg rounded-2xl py-4 hover:bg-violet-500 hover:text-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Swap
        </button>

        {/* ─── LAST TX (visible feedback) ─── */}
        {lastTx ? (
          <div className="bg-surface border border-line rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
                Last transaction
              </span>
              <span className="font-mono text-[10px] tabular-nums text-text-3">
                {lastTx.direction}
              </span>
            </div>
            <div className="font-mono text-sm tabular-nums text-text">
              {lastTx.amountIn} <span className="text-text-3">→</span> {lastTx.amountOut}
            </div>
            <div className="font-mono text-[10px] tabular-nums text-text-3 mt-1">
              fee {lastTx.fee} · impact {lastTx.impact}
            </div>
          </div>
        ) : null}

        {/* ─── ADVANCED TOGGLE ─── */}
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="w-full font-mono text-[10px] uppercase tracking-[0.12em] text-text-3 hover:text-text py-2 flex items-center justify-center gap-1"
        >
          {showAdvanced ? "hide" : "show"} cranks & time
          <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▾</span>
        </button>

        {showAdvanced ? (
          <section className="space-y-3">
            {/* Cranks */}
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3 mb-3">
                Cranks
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCrankVol}
                  className="font-mono text-[11px] py-2.5 rounded-lg border border-line-2 text-text-2 hover:border-text hover:text-text transition-all duration-500"
                >
                  vol crank
                </button>
                <button
                  onClick={handleCrankCurve}
                  className="font-mono text-[11px] py-2.5 rounded-lg border border-line-2 text-text-2 hover:border-text hover:text-text transition-all duration-500"
                >
                  curve crank
                </button>
              </div>
              <p className="font-mono text-[10px] text-text-3/70 leading-[1.5] mt-3">
                Permissionless. <span className="text-text-2">vol</span> reads EWMA, starts A ramp if target moved &gt;10%. <span className="text-text-2">curve</span> advances A toward target.
              </p>
            </div>

            {/* Time */}
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3 mb-3">
                Time
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 10, 100, 1000].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleAdvance(n)}
                    className="font-mono text-xs py-2 rounded-lg border border-line-2 text-text-2 hover:border-text hover:text-text transition-all duration-500 tabular-nums"
                  >
                    +{n >= 1000 ? `${n / 1000}k` : n}
                  </button>
                ))}
              </div>
              <button
                onClick={handleAutoRun}
                className={`w-full mt-3 font-mono text-[11px] uppercase tracking-[0.08em] py-2.5 rounded-lg border transition-all duration-500 ${
                  autoRunning
                    ? "border-violet-500 text-violet-500 bg-violet-500/10"
                    : "border-line-2 text-text-2 hover:border-text hover:text-text"
                }`}
              >
                {autoRunning ? "■ stop auto" : "▶ auto (400ms / slot)"}
              </button>
            </div>

            {/* Stress */}
            <button
              onClick={handleStress}
              className="w-full font-mono text-[11px] uppercase tracking-[0.08em] py-2.5 rounded-lg border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-all duration-500"
            >
              stress test (20× 5% directional)
            </button>
          </section>
        ) : null}

        {/* ─── CHARTS (simple sparkline grid) ─── */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
              History
            </span>
            <span className="font-mono text-[10px] tabular-nums text-text-3">
              {sim.history.length} pts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Sparkline
              data={sim.history.map((s) => Number(s.feeBps))}
              color={currentFeeBps > 30 ? "#f59e0b" : "#7c3aed"}
              label="Fee (bps)"
            />
            <Sparkline
              data={sim.history.map((s) => Number(s.sigma * 10_000n / SCALE) / 100)}
              color="#10b981"
              label="σ %"
            />
            <Sparkline
              data={sim.history.map((s) => Number(s.curveA))}
              color="#3b82f6"
              label="A"
            />
            <Sparkline
              data={sim.history.map((s) => Number(s.spotPrice) / 1e18)}
              color="#a78bfa"
              label="Spot"
            />
          </div>
        </section>

        {/* ─── LOG ─── */}
        <section className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
              Activity
            </span>
            <span className="font-mono text-[10px] tabular-nums text-text-3">
              {logs.length}
            </span>
          </div>
          <div
            data-lenis-prevent
            className="font-mono text-[11px] text-text-2 leading-[1.7] max-h-72 overflow-y-auto scrollbar-hidden"
          >
            {logs.length === 0 ? (
              <div className="px-4 py-6 text-text-3/60 italic text-center">
                No activity yet. Swap or crank to start.
              </div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className="px-4 py-1.5 border-b border-line/50 last:border-b-0 tabular-nums"
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-md mx-auto px-4 py-6 text-center font-mono text-[10px] text-text-3/60">
        V-AMM · Solana · simulator
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-3">{label}</span>
      <span className="text-text tabular-nums">{value}</span>
    </div>
  );
}

function TokenMark({ side }: { side: "A" | "B" }) {
  // A = USDC, B = USDT (last letters for the circle)
  const letter = side === "A" ? "C" : "T";
  const bg = side === "A" ? "bg-violet-500" : "bg-emerald-500";
  return (
    <span className={`inline-block w-4 h-4 rounded-full ${bg} text-white text-[9px] font-mono font-bold leading-4 text-center`}>
      {letter}
    </span>
  );
}

function Sparkline({
  data,
  color,
  label,
}: {
  data: number[];
  color: string;
  label: string;
}) {
  const valid = data.filter((n) => Number.isFinite(n));
  if (valid.length < 2) {
    return (
      <div className="bg-bg-2 border border-line rounded-lg p-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3 mb-2">
          {label}
        </div>
        <div className="h-12 flex items-center justify-center font-mono text-[10px] text-text-3/60">
          —
        </div>
      </div>
    );
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const points = valid
    .map((v, i) => {
      const x = (i / (valid.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = valid[valid.length - 1];
  return (
    <div className="bg-bg-2 border border-line rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-3">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text">
          {label === "σ %" ? `${last.toFixed(2)}%` : last.toFixed(2)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Hooks
// ──────────────────────────────────────────────────────────────────────────────

function parseAmount(s: string): bigint | null {
  if (!s || s === ".") return null;
  const [whole, frac = ""] = s.split(".");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) return null;
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}
