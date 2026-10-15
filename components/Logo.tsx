"use client";

import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
  subtitle?: string;
}

const iconSizes = {
  sm: "w-8 h-8 rounded-[9px]",
  md: "w-9 h-9 rounded-[10px]",
  lg: "w-[72px] h-[72px] rounded-[18px]",
};

const textSizes = {
  sm: "text-[15px]",
  md: "text-[17px]",
  lg: "text-[28px]",
};

// App-icon style mark: a continuous-corner squircle with an "S" glyph.
export function LogoMark({ size = "md" }: { size?: LogoProps["size"] }) {
  return (
    <div
      className={`relative ${iconSizes[size]} shrink-0 overflow-hidden shadow-[0_4px_14px_rgba(10,132,255,0.35)]`}
      style={{ background: "linear-gradient(145deg, #3D9BFF 0%, #0A84FF 45%, #5E5CE6 100%)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,0.45),transparent_55%)]" />
      <svg viewBox="0 0 40 40" fill="none" className="relative w-full h-full" aria-hidden="true">
        <path d="M26.5 13.2c-1.6-2-4-3.2-6.8-3.2-3.8 0-6.6 2.1-6.6 5.1 0 6.8 14 3.6 14 10.4 0 3.2-3 5.5-7.1 5.5-3 0-5.7-1.3-7.4-3.5" stroke="white" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Logo({ size = "md", className = "", showText = true, subtitle }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <LogoMark size={size} />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`${textSizes[size]} font-display font-semibold text-white tracking-tight`}>
            Personal Finance
          </span>
          {subtitle && <span className="text-[11px] text-label-2 font-medium">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
