import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Enregistré — scope:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Échec enregistrement:", err);
      });
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, data } = event.data ?? {};
    if (type === "bp:navigate" && data?.url) {
      window.location.href = data.url;
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
