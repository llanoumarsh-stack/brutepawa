import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

const DISMISSED_KEY = "bp_install_banner_dismissed";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos]         = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < 3 * 24 * 60 * 60 * 1000)
      return;

    const onIos = isIos();
    setIos(onIos);

    // Chrome/Android : attendre beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari ou desktop sans prompt : afficher la bannière quand même
    // (sur iOS : guide manuel ; sur desktop dev : aperçu visuel)
    const fallback = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallback);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  const showInstallBtn = !!deferredPrompt;
  const showIosGuide   = ios && !deferredPrompt;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 60,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fff",
        borderTop: "1px solid #e4e6eb",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.10)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Icône BP */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: "#1877F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(24,119,242,0.35)",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: -0.5,
          }}
        >
          BP
        </span>
      </div>

      {/* Texte */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showIosGuide ? (
          <span
            style={{ fontSize: 12.5, color: "#1c1e21", lineHeight: 1.4 }}
          >
            Appuyez sur <span style={{ fontSize: 15 }}>⬆️</span> puis{" "}
            <strong>« Ajouter à l'écran d'accueil »</strong>
          </span>
        ) : (
          <span
            style={{ fontSize: 12.5, color: "#1c1e21", lineHeight: 1.4 }}
          >
            Profitez de la meilleure expérience dans l'application
          </span>
        )}
      </div>

      {/* Bouton d'action */}
      {showInstallBtn && (
        <button
          onClick={install}
          style={{
            background: "#1877F2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Installer
        </button>
      )}
      {showIosGuide && (
        <button
          onClick={dismiss}
          style={{
            background: "#e4e6eb",
            color: "#1c1e21",
            border: "none",
            borderRadius: 6,
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          OK
        </button>
      )}
      {!showInstallBtn && !showIosGuide && (
        /* Desktop / autre navigateur sans prompt natif */
        <button
          onClick={dismiss}
          style={{
            background: "#1877F2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Installer
        </button>
      )}

      {/* Fermer */}
      <button
        onClick={dismiss}
        aria-label="Fermer"
        style={{
          background: "none",
          border: "none",
          color: "#606770",
          fontSize: 18,
          cursor: "pointer",
          padding: "4px 2px",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
