"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Premium smooth scroll using Lenis. Gives the page a weighted, inertia feel —
 * scrolling builds up momentum rather than jumping instantly.
 *
 * Also intercepts in-page anchor clicks (#section-id) and scrolls to them via
 * Lenis so anchor links still work under smooth-scroll.
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

    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest(
        "a[href^='#']"
      ) as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -20 });
    }
    document.addEventListener("click", onAnchorClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onAnchorClick);
      lenis.destroy();
    };
  }, []);

  return null;
}
