import { useEffect } from "react";

interface Props {
  onClose: () => void;
  onSelect: (type: string) => void;
}

const OPTIONS = [
  {
    type: "post",
    label: "Publier un post",
    desc: "Partagez vos idées, actualités et moments avec la communauté.",
    color: "#22C55E",
    bg: "#F0FDF4",
    badge: { text: "Tendance", icon: "📈", textColor: "#16A34A", bgColor: "#DCFCE7" },
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2v6h6" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 13h5M8 17h8" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M10 10l1.5 1.5L14 8" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "product",
    label: "Marketplace",
    desc: "Proposez vos produits à des millions d'utilisateurs.",
    color: "#F97316",
    bg: "#FEF3C7",
    badge: { text: "Recommandé", icon: "⭐", textColor: "#D97706", bgColor: "#FEF3C7" },
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 6h18" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 10a4 4 0 0 1-8 0" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "service",
    label: "Publier un service",
    desc: "Faites connaître vos services et développez votre activité.",
    color: "#0EA5E9",
    bg: "#DCFCE7",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="14" r="2" stroke="#0EA5E9" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    type: "group",
    label: "Créer un groupe",
    desc: "Rassemblez des personnes autour d'intérêts communs.",
    color: "#0EA5E9",
    bg: "#ECFEFF",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "job",
    label: "Offre d'emploi",
    desc: "Trouvez les meilleurs talents pour votre entreprise.",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="3" y="7" width="18" height="14" rx="2" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 12v4M10 14h4" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    type: "course",
    label: "Formation",
    desc: "Partagez votre savoir et formez des apprenants.",
    color: "#F59E0B",
    bg: "#FEF3C7",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function CreateModal({ onClose, onSelect }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <style>{`
        @keyframes bpcm-slide {
          from { transform: translateY(80px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes bpcm-item {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .bpcm-card {
          transition: transform 0.14s ease, box-shadow 0.14s ease;
          cursor: pointer;
        }
        .bpcm-card:active {
          transform: scale(0.97) !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
        }
        .bpcm-close:hover { background: #E5E7EB !important; }
      `}</style>

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#FFFFFF",
          borderRadius: "32px 32px 0 0",
          overflow: "hidden",
          boxShadow: "0 -4px 6px rgba(0,0,0,0.03), 0 -12px 40px rgba(0,0,0,0.12), 0 -32px 80px rgba(0,0,0,0.08)",
          animation: "bpcm-slide 0.36s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB" }}/>
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 20px 16px",
        }}>
          {/* Big circular "+" icon */}
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #22C55E 0%, #22C55E 60%, #16A34A 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 0 4px #DCFCE7, 0 4px 16px rgba(34,197,94,0.35)",
            position: "relative",
          }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
            </svg>
            {/* Sparkle top-left */}
            <div style={{
              position: "absolute", top: -2, right: -2,
              width: 12, height: 12,
            }}>
              <svg viewBox="0 0 12 12" width="12" height="12">
                <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" fill="#FBBF24"/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#111827", lineHeight: 1.15, fontFamily: "Inter, sans-serif" }}>
              Créer
            </div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2, lineHeight: 1.3, fontFamily: "Inter, sans-serif" }}>
              Choisissez ce que vous souhaitez publier ou lancer
            </div>
          </div>

          {/* Close */}
          <button
            className="bpcm-close"
            onClick={onClose}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#F1F5F9",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: "0 16px 4px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: "65vh" }}>
          {OPTIONS.map((opt, i) => (
            <div
              key={opt.type}
              className="bpcm-card"
              onClick={() => onSelect(opt.type)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "#FFFFFF",
                borderRadius: 24,
                padding: "14px 14px 14px 14px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 10px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.06)",
                animation: `bpcm-item 0.32s ${i * 0.045}s both`,
              }}
            >
              {/* Icon */}
              <div style={{
                width: 56, height: 56, borderRadius: 18,
                background: opt.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {opt.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title + badge inline */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 15.5, color: "#111827", fontFamily: "Inter, sans-serif", lineHeight: 1.2 }}>
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: opt.badge.bgColor,
                      borderRadius: 20,
                      padding: "2px 8px",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 11 }}>{opt.badge.icon}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: opt.badge.textColor,
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: 0.1,
                      }}>{opt.badge.text}</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.45, fontFamily: "Inter, sans-serif" }}>
                  {opt.desc}
                </div>
              </div>

              {/* Arrow — solid colored circle */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: opt.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 4px 12px ${opt.color}40`,
              }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 7, padding: "14px 20px 28px",
        }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
            <path d="M12 2l-7 3v5c0 5.25 3.5 10.15 7 11.5C16.5 20.15 20 15.25 20 10V5l-8-3z"
              fill="#22C55E" fillOpacity=".18" stroke="#22C55E" strokeWidth="1.8"/>
            <path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 12.5, color: "#64748B", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            Vos contenus sont protégés et sécurisés
          </span>
        </div>
      </div>
    </div>
  );
}
