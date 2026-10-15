"use client";

import React, { useEffect, useState } from "react";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { TabType } from "@/app/page";
import { NAV_ITEMS, NavItem } from "./navigation";

interface MobileBottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreviewedCount?: number;
  accountsCount?: number;
  /** Extra controls shown under the page list in the More sheet */
  sheetFooter?: React.ReactNode;
}

// iOS tab bar: the four highest-frequency destinations stay pinned; the rest
// live in a "More" sheet styled like an inset grouped list.
const PRIMARY_IDS: TabType[] = ["dashboard", "transactions", "investments", "ask"];
const PRIMARY_TABS = PRIMARY_IDS.map((id) => NAV_ITEMS.find((n) => n.id === id)!);
const MORE_TABS = NAV_ITEMS.filter((n) => !PRIMARY_IDS.includes(n.id));

export function MobileBottomNav({
  activeTab,
  setActiveTab,
  unreviewedCount = 0,
  accountsCount = 0,
  sheetFooter,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // The sheet mounts off-screen, then flips to its resting position one frame
  // later so the slide-up actually animates.
  const [sheetVisible, setSheetVisible] = useState(false);

  const isMoreTabActive = MORE_TABS.some((tab) => tab.id === activeTab);

  useEffect(() => {
    if (!moreOpen) return;
    // Lock the page behind the sheet, like a native modal
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setSheetVisible(true));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const closeMore = () => {
    setSheetVisible(false);
    setTimeout(() => setMoreOpen(false), 300);
  };

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (moreOpen) closeMore();
  };

  const TabButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    const badge = item.id === "transactions" ? unreviewedCount : 0;
    return (
      <button
        onClick={() => selectTab(item.id)}
        aria-current={active ? "page" : undefined}
        className={`flex-1 flex flex-col items-center justify-center gap-[2px] rounded-full transition-[color,background-color,transform] duration-300 ease-apple active:scale-[0.92] ${
          active ? "glass-pill text-sys-blue" : "text-label-2"
        }`}
      >
        <span className="relative">
          <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.3 : 1.8} />
          {badge > 0 && (
            <span className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sys-red text-[#fff] text-[11px] font-semibold flex items-center justify-center">
              {badge}
            </span>
          )}
        </span>
        <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {moreOpen && (
        <div
          className={`md:hidden fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
            sheetVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeMore}
          aria-hidden="true"
        />
      )}

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More"
          className={`md:hidden fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] z-50 liquid-glass rounded-[34px] pb-4 transition-transform duration-300 ease-apple ${
            sheetVisible ? "translate-y-0" : "translate-y-[110%]"
          }`}
        >
          <div className="pt-2 flex justify-center">
            <span className="w-9 h-[5px] rounded-full bg-white/25" />
          </div>
          <div className="flex items-center justify-between px-4 pt-3 pb-3">
            <span className="text-[17px] font-semibold">More</span>
            <button onClick={closeMore} className="text-[17px] font-semibold text-sys-blue">
              Done
            </button>
          </div>

          <ul className="mx-3 rounded-[22px] bg-surface/70 overflow-hidden">
            {MORE_TABS.map((item, i) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const count = item.id === "accounts" ? accountsCount : 0;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => selectTab(item.id)}
                    aria-current={active ? "page" : undefined}
                    className="w-full flex items-center gap-3 pl-4 active:bg-white/[0.08] transition-colors"
                  >
                    <span
                      className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0"
                      style={{ background: item.tile }}
                    >
                      <Icon className="w-[17px] h-[17px] text-[#fff]" strokeWidth={2.3} />
                    </span>
                    <span
                      className={`flex-1 flex items-center justify-between pr-4 py-3 text-[17px] ${
                        i < MORE_TABS.length - 1 ? "border-b-[0.5px] border-white/[0.12]" : ""
                      }`}
                    >
                      <span className={active ? "text-sys-blue font-medium" : "text-white"}>{item.label}</span>
                      <span className="flex items-center gap-1.5 text-[#8E8E93]">
                        {count > 0 && <span className="text-[17px]">{count}</span>}
                        <ChevronRight className="w-4 h-4 opacity-60" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {sheetFooter}
        </div>
      )}

      {/* Scroll-edge fade so content doesn't fight the floating bar */}
      <div
        aria-hidden="true"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-28 pointer-events-none bg-gradient-to-t from-bg via-bg/70 to-transparent"
      />
      <nav
        aria-label="Tab bar"
        className="md:hidden fixed z-40 left-3 right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] h-[64px] p-1.5 rounded-full liquid-glass lens"
      >
        <div className="flex items-stretch h-full gap-1">
          {PRIMARY_TABS.map((item) => (
            <TabButton key={item.id} item={item} />
          ))}
          <button
            onClick={() => (moreOpen ? closeMore() : setMoreOpen(true))}
            aria-expanded={moreOpen}
            aria-label="More"
            className={`flex-1 flex flex-col items-center justify-center gap-[2px] rounded-full transition-[color,background-color,transform] duration-300 ease-apple active:scale-[0.92] ${
              moreOpen || isMoreTabActive ? "glass-pill text-sys-blue" : "text-label-2"
            }`}
          >
            <MoreHorizontal className="w-[22px] h-[22px]" strokeWidth={moreOpen || isMoreTabActive ? 2.3 : 1.8} />
            <span className="text-[10px] font-medium tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
