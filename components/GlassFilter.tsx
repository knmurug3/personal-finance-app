"use client";

import { useEffect } from "react";

/**
 * SVG lens used by `.liquid-glass.lens` to bend the backdrop like real glass.
 * Only Chromium renders SVG filters inside backdrop-filter, so the class that
 * enables it is added there alone; Safari/WebKit keep the frosted fallback.
 */
export function GlassFilter() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/iPhone|iPad|iPod/.test(ua);
    const reduce = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
    if (chromium && !reduce) document.documentElement.classList.add("lens-ok");
  }, []);

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id="liquid-glass-lens" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="42" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
