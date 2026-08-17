import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type Theme      = "light" | "dark" | "system";
export type FontSize   = "small" | "medium" | "large";
export type PrimaryColor = "#22C55E" | "#3B82F6" | "#EF4444" | "#8B5CF6" | "#F97316" | "#EC4899";

export interface AppearancePrefs {
  theme:        Theme;
  primaryColor: PrimaryColor;
  fontSize:     FontSize;
}

const DEFAULTS: AppearancePrefs = { theme: "system", primaryColor: "#22C55E", fontSize: "medium" };
const LS_KEY = "bp_appearance";

function loadLocal(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "light")  return "light";
  if (theme === "dark")   return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const FONT_SCALE: Record<FontSize, string> = { small: "13px", medium: "15px", large: "17px" };

function applyToDOM(prefs: AppearancePrefs) {
  const resolved = resolveTheme(prefs.theme);
  document.documentElement.setAttribute("data-bp-theme", resolved);
  document.documentElement.style.setProperty("--bp-primary",      prefs.primaryColor);
  document.documentElement.style.setProperty("--bp-primary-dark",  darken(prefs.primaryColor));
  document.documentElement.style.setProperty("--bp-font-base",    FONT_SCALE[prefs.fontSize]);
}

function darken(hex: string): string {
  const map: Record<string, string> = {
    "#22C55E": "#16A34A", "#3B82F6": "#2563EB", "#EF4444": "#DC2626",
    "#8B5CF6": "#7C3AED", "#F97316": "#EA580C", "#EC4899": "#DB2777",
  };
  return map[hex] ?? hex;
}

/* ── API helpers ─────────────────────────────────────────── */
async function apiGet(): Promise<AppearancePrefs | null> {
  try {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    const token = localStorage.getItem("bp_token");
    if (!token) return null;
    const r = await fetch(`${base}/api/preferences`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function apiSave(prefs: AppearancePrefs): Promise<boolean> {
  try {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    const token = localStorage.getItem("bp_token");
    if (!token) return false;
    const r = await fetch(`${base}/api/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(prefs),
    });
    return r.ok;
  } catch { return false; }
}

/* ── Context ─────────────────────────────────────────────── */
interface AppearanceCtx {
  prefs: AppearancePrefs;
  setPrefs: (p: AppearancePrefs) => void;
  save: () => Promise<boolean>;
  saving: boolean;
  saved: boolean;
}

const Ctx = createContext<AppearanceCtx>({
  prefs: DEFAULTS, setPrefs: () => {}, save: async () => false, saving: false, saved: false,
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [prefs,  setPrefsState] = useState<AppearancePrefs>(loadLocal);
  const [saving, setSaving]     = useState(false);
  const [saved,  setSaved]      = useState(false);

  /* Apply to DOM immediately whenever prefs change */
  useEffect(() => { applyToDOM(prefs); }, [prefs]);

  /* React to OS theme changes when mode = system */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (prefs.theme === "system") applyToDOM(prefs); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs]);

  /* On mount: try to load from server (overrides local) */
  useEffect(() => {
    apiGet().then(remote => {
      if (remote) {
        const merged = { ...DEFAULTS, ...remote };
        setPrefsState(merged);
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
      }
    });
  }, []);

  const setPrefs = useCallback((p: AppearancePrefs) => {
    setPrefsState(p);
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    const ok = await apiSave(prefs);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
    return ok;
  }, [prefs]);

  return <Ctx.Provider value={{ prefs, setPrefs, save, saving, saved }}>{children}</Ctx.Provider>;
}

export function useAppearance() { return useContext(Ctx); }
