import { createContext, useMemo, type ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

// The app is locked to dark mode. The context is preserved so any legacy
// import sites still compile and get a stable value.
const DARK_VALUE: ThemeContextValue = {
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(() => DARK_VALUE, []);
  return (
    <ThemeContext.Provider value={value}>
      <div className="contents">{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return DARK_VALUE;
}
