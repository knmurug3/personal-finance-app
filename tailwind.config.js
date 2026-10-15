/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

// Apple Human Interface Guidelines palette, in both appearances.
// Every color is emitted as a CSS variable (`--c-<name>-<shade>`) whose value
// flips with `prefers-color-scheme`, so all components get light and dark mode
// from the same class names. Legacy palette names used across the components
// (slate, teal, emerald, rose, amber, …) are remapped onto Apple's system colors.

const W = "#ffffff";
const K = "#000000";

function mix(hex, target, amount) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = p(hex);
  const [tr, tg, tb] = p(target);
  const c = (a, t) => Math.round(a + (t - a) * amount).toString(16).padStart(2, "0");
  return `#${c(r, tr)}${c(g, tg)}${c(b, tb)}`;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

// Dark: 400/500 sit on the system color, low shades are light tints (used as text),
// high shades are deep tints (used as backgrounds).
function darkScale(base) {
  return {
    50: mix(base, W, 0.9), 100: mix(base, W, 0.8), 200: mix(base, W, 0.6), 300: mix(base, W, 0.35),
    400: base, 500: base,
    600: mix(base, K, 0.15), 700: mix(base, K, 0.35), 800: mix(base, K, 0.55), 900: mix(base, K, 0.72), 950: mix(base, K, 0.85),
  };
}

// Light: mirrored — low shades darken for legible text on white, high shades
// become pale tints for backgrounds.
function lightScale(base) {
  return {
    50: mix(base, K, 0.55), 100: mix(base, K, 0.45), 200: mix(base, K, 0.35), 300: mix(base, K, 0.25),
    400: mix(base, K, 0.1), 500: base,
    600: mix(base, K, 0.12), 700: mix(base, W, 0.55), 800: mix(base, W, 0.72), 900: mix(base, W, 0.84), 950: mix(base, W, 0.92),
  };
}

// System colors: [dark appearance, light appearance]
const system = {
  blue: ["#0A84FF", "#007AFF"],
  green: ["#30D158", "#28A745"],
  mint: ["#63E6E2", "#00C7BE"],
  teal: ["#40C8E0", "#30B0C7"],
  cyan: ["#64D2FF", "#32ADE6"],
  indigo: ["#5E5CE6", "#5856D6"],
  purple: ["#BF5AF2", "#AF52DE"],
  pink: ["#FF375F", "#FF2D55"],
  red: ["#FF453A", "#FF3B30"],
  orange: ["#FF9F0A", "#FF9500"],
  yellow: ["#FFD60A", "#E6B800"],
};

// Neutral grays (label → background), per appearance.
const grayDark = {
  50: "#F5F5F7", 100: "#F2F2F7", 200: "#E5E5EA", 300: "#C7C7CC", 400: "#98989F", 500: "#6E6E73",
  600: "#48484A", 700: "#3A3A3C", 800: "#2C2C2E", 900: "#1C1C1E", 950: "#0E0E10",
};
const grayLight = {
  50: "#000000", 100: "#1C1C1E", 200: "#2C2C2E", 300: "#3A3A3C", 400: "#6E6E73", 500: "#8E8E93",
  600: "#AEAEB2", 700: "#C7C7CC", 800: "#E5E5EA", 900: "#FFFFFF", 950: "#F2F2F7",
};

// Which palette name maps to which system color
const legacy = {
  blue: "blue", sky: "cyan", cyan: "cyan", teal: "blue", // the app's old primary accent becomes Apple's tint
  emerald: "green", green: "green", lime: "green", indigo: "indigo", violet: "purple", purple: "purple",
  fuchsia: "pink", pink: "pink", rose: "red", red: "red", amber: "orange", orange: "orange", yellow: "yellow",
};
const grayNames = ["slate", "gray", "zinc", "neutral"];

// Semantic tokens [dark, light]
const semantic = {
  bg: ["#000000", "#F2F2F7"],
  surface: ["#1C1C1E", "#FFFFFF"],
  "surface-2": ["#2C2C2E", "#F2F2F7"],
  "surface-3": ["#3A3A3C", "#E5E5EA"],
  // "white" is the foreground color: white on dark, black on light
  fg: ["#FFFFFF", "#000000"],
};

const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

function buildVars(mode) {
  const i = mode === "dark" ? 0 : 1;
  const vars = {};
  for (const [name, pair] of Object.entries(semantic)) vars[`--c-${name}`] = rgb(pair[i]);
  for (const [name, pair] of Object.entries(system)) vars[`--c-sys-${name}`] = rgb(pair[i]);
  for (const [name, sys] of Object.entries(legacy)) {
    const s = (mode === "dark" ? darkScale : lightScale)(system[sys][i]);
    for (const [shade, hex] of Object.entries(s)) vars[`--c-${name}-${shade}`] = rgb(hex);
  }
  const g = mode === "dark" ? grayDark : grayLight;
  for (const [shade, hex] of Object.entries(g)) vars[`--c-gray-${shade}`] = rgb(hex);
  // Labels carry their own alpha (iOS secondary/tertiary label)
  vars["--label-2"] = mode === "dark" ? "235 235 245 / 0.6" : "60 60 67 / 0.6";
  vars["--label-3"] = mode === "dark" ? "235 235 245 / 0.3" : "60 60 67 / 0.3";
  return vars;
}

const colors = {
  transparent: "transparent",
  current: "currentColor",
  inherit: "inherit",
  black: "#000000",
  white: v("fg"),
  bg: v("bg"),
  surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3") },
  label: { DEFAULT: v("fg"), 2: "rgb(var(--label-2))", 3: "rgb(var(--label-3))" },
  tint: v("sys-blue"),
  primary: { DEFAULT: v("sys-blue"), foreground: "#ffffff" },
  secondary: { DEFAULT: v("sys-indigo"), foreground: "#ffffff" },
};
for (const name of Object.keys(system)) colors[`sys-${name}`] = v(`sys-${name}`);
for (const name of Object.keys(legacy)) {
  colors[name] = Object.fromEntries(Object.keys(darkScale("#000000")).map((s) => [s, v(`${name}-${s}`)]));
}
for (const name of grayNames) {
  colors[name] = Object.fromEntries(Object.keys(grayDark).map((s) => [s, v(`gray-${s}`)]));
}

module.exports = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    colors,
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "var(--font-inter)", "Helvetica Neue", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "var(--font-inter)", "Helvetica Neue", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 0 0 0.5px rgb(var(--c-fg) / 0.08) inset, 0 8px 24px rgb(0 0 0 / var(--shadow-strength))",
        glass: "0 0 0 0.5px rgb(var(--c-fg) / 0.12) inset, 0 20px 50px rgb(0 0 0 / calc(var(--shadow-strength) * 1.4))",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...buildVars("dark"), "--shadow-strength": "0.35", "color-scheme": "dark" },
        "@media (prefers-color-scheme: light)": {
          ":root": { ...buildVars("light"), "--shadow-strength": "0.06", "color-scheme": "light" },
        },
      });
    }),
  ],
};
