"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Premium smooth scroll using Lenis. Gives the page a weighted, inertia feel —
 * scrolling builds up momentum rather than jumping instantly.
 *
 * Tweak:
 *   - duration  (s): higher = longer animation per scroll input
 *   - smoothWheel: false would let the browser handle wheel; we want Lenis to
 *   - wheelMultiplier: how aggressively each wheel event translates to scroll
 */
export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    function tick(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
