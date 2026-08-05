"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "sf-theme";
const DEFAULT_THEME = "corporate";

const THEMES = [
  "corporate",
  "business",
  "nord",
  "winter",
  "dim",
  "light",
  "dark",
  "cupcake",
  "emerald",
  "synthwave",
] as const;

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeSelector() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME;
    setTheme(storedTheme);
    applyTheme(storedTheme);
  }, []);

  function handleChange(nextTheme: string) {
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <label className="form-control w-full max-w-xs">
      <span className="label-text text-xs font-semibold uppercase tracking-wide">
        Theme
      </span>
      <select
        className="select select-bordered select-sm w-full"
        value={theme}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Select application theme"
      >
        {THEMES.map((option) => (
          <option key={option} value={option}>
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
