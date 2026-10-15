import {
  LayoutGrid,
  Receipt,
  Target,
  Trophy,
  BarChart3,
  Repeat,
  Building2,
  Wallet,
  Sliders,
  LineChart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { TabType } from "@/app/page";

export type NavItem = {
  id: TabType;
  label: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Settings-app style icon tile color */
  tile: string;
};

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Money",
    items: [
      { id: "dashboard", label: "Overview", title: "Overview", subtitle: "Your financial picture at a glance", icon: LayoutGrid, tile: "#0A84FF" },
      { id: "transactions", label: "Transactions", title: "Transactions", subtitle: "Every dollar in and out", icon: Receipt, tile: "#FF9F0A" },
      { id: "investments", label: "Investments", title: "Investments", subtitle: "Every stock, across all your brokerages", icon: LineChart, tile: "#30D158" },
      { id: "budgets", label: "Budgets", title: "Budgets", subtitle: "Spending limits by category", icon: Target, tile: "#30D158" },
      { id: "goals", label: "Goals", title: "Goals", subtitle: "Save toward what matters", icon: Trophy, tile: "#FFD60A" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { id: "ask", label: "Ask", title: "Ask", subtitle: "Questions about your money, answered", icon: MessageCircle, tile: "#30B0C7" },
      { id: "mom", label: "Trends", title: "Trends", subtitle: "Month-over-month analysis", icon: BarChart3, tile: "#BF5AF2" },
      { id: "subscriptions", label: "Recurring", title: "Recurring", subtitle: "Subscriptions and bills", icon: Repeat, tile: "#5E5CE6" },
    ],
  },
  {
    heading: "Accounts",
    items: [
      { id: "accounts", label: "Banks", title: "Banks", subtitle: "Linked institutions", icon: Building2, tile: "#64D2FF" },
      { id: "manual", label: "Assets", title: "Assets", subtitle: "Property, crypto and other holdings", icon: Wallet, tile: "#63E6E2" },
      { id: "rules", label: "Rules", title: "Rules", subtitle: "Automatic categorization", icon: Sliders, tile: "#FF375F" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const navItem = (id: TabType) => NAV_ITEMS.find((n) => n.id === id)!;
