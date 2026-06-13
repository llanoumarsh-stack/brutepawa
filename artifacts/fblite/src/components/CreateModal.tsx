import { useEffect } from "react";

interface Props {
  onClose: () => void;
  onSelect: (type: string) => void;
}

const OPTIONS = [
  { type: "post", emoji: "📝", label: "Publier un post" },
  { type: "product", emoji: "🛍️", label: "Vendre un produit" },
  { type: "service", emoji: "🔧", label: "Publier un service" },
  { type: "group", emoji: "👥", label: "Créer un groupe" },
  { type: "job", emoji: "💼", label: "Publier une offre d'emploi" },
  { type: "course", emoji: "🎓", label: "Créer une formation" },
  { type: "tontine", emoji: "💰", label: "Créer une tontine" },
];

export default function CreateModal({ onClose, onSelect }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "flex-end", paddingTop: 0 }}>
      <div
        style={{ background: "var(--fb-white)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, margin: "0 auto", overflow: "hidden", boxShadow: "0 -4px 32px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span>Créer</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "8px 0 24px" }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                width: "100%",
                padding: "14px 20px",
                background: "none",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--fb-text)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 26, width: 44, height: 44, background: "var(--fb-bg)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {opt.emoji}
              </span>
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
