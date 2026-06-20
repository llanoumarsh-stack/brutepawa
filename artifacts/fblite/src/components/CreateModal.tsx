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
    badge: "🔥 Populaire",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15.5 13.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S14 11.17 14 12s.67 1.5 1.5 1.5z" fill="#22C55E"/>
      </svg>
    ),
  },
  {
    type: "product",
    label: "Vendre un produit",
    desc: "Proposez vos produits à des millions d'utilisateurs.",
    color: "#F97316",
    bg: "#FFF7ED",
    badge: "⭐ Recommandé",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "service",
    label: "Publier un service",
    desc: "Faites connaître vos services et développez votre activité.",
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "group",
    label: "Créer un groupe",
    desc: "Rassemblez des personnes autour d'intérêts communs.",
    color: "#06B6D4",
    bg: "#ECFEFF",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "job",
    label: "Publier une offre d'emploi",
    desc: "Trouvez les meilleurs talents pour votre entreprise.",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "course",
    label: "Créer une formation",
    desc: "Partagez votre savoir et formez des apprenants.",
    color: "#F59E0B",
    bg: "#FFFBEB",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    type: "tontine",
    label: "Créer une tontine",
    desc: "Lancez une tontine et atteignez vos objectifs ensemble.",
    color: "#22C55E",
    bg: "#F0FDF4",
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#22C55E" strokeWidth="1.8"/>
        <path d="M12 6v6l4 2" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 3.5C9 3.5 9.5 5 12 5s3-1.5 3-1.5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M12 17v1M10.5 15.5h3" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
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
      style={{ position:"fixed", inset:0, zIndex:9000, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)" }}
    >
      <style>{`
        @keyframes bpcm-slide{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes bpcm-item{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
        .bpcm-item{transition:transform .14s,box-shadow .14s}
        .bpcm-item:active{transform:scale(.97)!important;box-shadow:0 1px 6px rgba(0,0,0,0.08)!important}
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width:"100%", maxWidth:600, background:"#fff", borderRadius:"28px 28px 0 0", overflow:"hidden", boxShadow:"0 -8px 48px rgba(0,0,0,0.18)", animation:"bpcm-slide .32s cubic-bezier(.22,1,.36,1) both" }}
      >
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M3 7.5c0-1.1.4-2.1 1.2-2.8C5.3 3.5 6.4 3 7.5 3" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" opacity=".45"/>
                <path d="M21 16.5c0 1.1-.4 2.1-1.2 2.8C18.7 20.5 17.6 21 16.5 21" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" opacity=".45"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:"#111", lineHeight:1.1 }}>Créer</div>
              <div style={{ fontSize:12, color:"#6B7280", marginTop:1 }}>Choisissez ce que vous voulez créer</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width:36, height:36, borderRadius:"50%", background:"#F3F4F6", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#374151" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Options list */}
        <div style={{ padding:"14px 16px 8px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto", maxHeight:"70vh" }}>
          {OPTIONS.map((opt, i) => (
            <div
              key={opt.type}
              className="bpcm-item"
              onClick={() => onSelect(opt.type)}
              style={{
                position:"relative", display:"flex", alignItems:"center", gap:14,
                background: opt.type === "post" ? "#F0FDF4" : "#fff",
                borderRadius:20, padding:"14px 16px", cursor:"pointer",
                boxShadow:"0 1px 4px rgba(0,0,0,0.07), 0 2px 12px rgba(0,0,0,0.05)",
                border: opt.type === "post" ? "1.5px solid #22C55E" : "1px solid rgba(0,0,0,0.05)",
                animation:`bpcm-item .3s ${i * 0.04}s both`
              }}
            >
              {/* Badge */}
              {"badge" in opt && opt.badge && (
                <div style={{
                  position:"absolute", top:10, right:52,
                  background: opt.type === "post" ? "#22C55E" : "#FFF7ED",
                  border: opt.type === "post" ? "none" : "1px solid #F97316",
                  borderRadius:20, padding:"2px 10px",
                  fontSize:11, fontWeight:700,
                  color: opt.type === "post" ? "#fff" : "#F97316",
                }}>
                  {opt.badge}
                </div>
              )}
              {/* Icon block */}
              <div style={{ width:52, height:52, borderRadius:16, background:opt.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {opt.icon}
              </div>
              {/* Text */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#111", marginBottom:2 }}>{opt.label}</div>
                <div style={{ fontSize:12, color:"#6B7280", lineHeight:1.4 }}>{opt.desc}</div>
              </div>
              {/* Arrow — solid colored circle */}
              <div style={{ width:36, height:36, borderRadius:"50%", background:opt.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Footer — security badge */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"12px 20px 32px" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M12 2l-7 3v5c0 5.25 3.5 10.15 7 11.5C16.5 20.15 20 15.25 20 10V5l-8-3z" fill="#22C55E" fillOpacity=".15" stroke="#22C55E" strokeWidth="1.7"/>
            <path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>
            <span style={{ color:"#22C55E", fontWeight:700 }}>100% sécurisé</span>
            {" • "}Vos données sont protégées.
          </span>
        </div>
      </div>
    </div>
  );
}
