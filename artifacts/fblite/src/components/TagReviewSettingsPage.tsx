import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
  onOpenTagReview: () => void;
}

export default function TagReviewSettingsPage({ onClose, onOpenTagReview }: Props) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "#f0f2f5",
      zIndex: 150, overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* ── Nav bar ─────────────────────────────────────── */}
      <div style={{
        background: "#fff", display: "flex", alignItems: "center",
        padding: "10px 12px", borderBottom: "1px solid #e4e6eb",
        position: "sticky", top: 0, zIndex: 2, gap: 6,
      }}>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            width: 36, height: 36, display: "flex", alignItems: "center",
            justifyContent: "center", borderRadius: "50%", flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#050505" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{
          fontWeight: 700, fontSize: 17, flex: 1, color: "#050505",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          Examiner les publications et les identifications
        </span>
      </div>

      {/* ── Mode payant ─────────────────────────────────── */}
      <div style={{
        background: "#fff", padding: "11px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "8px solid #f0f2f5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#050505" }}>Mode payant</span>
          <div style={{
            width: 18, height: 18, borderRadius: "50%", background: "#ccd0d5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "#fff", lineHeight: 1,
          }}>?</div>
        </div>
        <button style={{
          background: "#e4e6eb", border: "none", borderRadius: 6,
          padding: "7px 14px", fontWeight: 600, fontSize: 14,
          cursor: "pointer", color: "#050505",
        }}>
          Changer de mode
        </button>
      </div>

      {/* ── Section 1 : publications où l'on est identifié ── */}
      <div style={{ background: "#fff", marginTop: 0 }}>
        {/* header row */}
        <div style={{
          padding: "14px 16px 10px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <span style={{
            fontWeight: 700, fontSize: 15, lineHeight: 1.4,
            color: "#050505", flex: 1, paddingRight: 12,
          }}>
            Examiner les publications dans lesquelles vous êtes identifié
          </span>
          <button style={{
            background: "none", border: "none", color: "#1877F2",
            fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0,
            padding: 0,
          }}>
            Paramètres
          </button>
        </div>

        {/* empty state */}
        <div style={{
          padding: "12px 16px 30px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <rect x="10" y="16" width="52" height="40" rx="5"
              stroke="#bcc0c4" strokeWidth="3" fill="none" />
            <circle cx="36" cy="32" r="9"
              stroke="#bcc0c4" strokeWidth="2.5" fill="none" />
            <path d="M18 56c0-9.9 8.1-16 18-16s18 6.1 18 16"
              stroke="#bcc0c4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
          <span style={{ marginTop: 10, color: "#65676b", fontSize: 14 }}>
            Aucune publication à examiner
          </span>
        </div>

        {/* divider */}
        <div style={{ height: 1, background: "#e4e6eb" }} />
      </div>

      {/* ── Section 2 : identifications dans ses propres publis ── */}
      <div style={{ background: "#fff" }}>
        {/* header row */}
        <div style={{
          padding: "14px 16px 10px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <span style={{
            fontWeight: 700, fontSize: 15, lineHeight: 1.4,
            color: "#050505", flex: 1, paddingRight: 12,
          }}>
            Examiner les identifications dans vos publications
          </span>
          <button
            onClick={onOpenTagReview}
            style={{
              background: "none", border: "none", color: "#1877F2",
              fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0,
              padding: 0,
            }}
          >
            Paramètres
          </button>
        </div>

        {/* empty state */}
        <div style={{
          padding: "12px 16px 30px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <path d="M40 10H20a5 5 0 0 0-5 5v22a5 5 0 0 0 1.5 3.5l24 24a5 5 0 0 0 7 0l20-20a5 5 0 0 0 0-7l-24-24A5 5 0 0 0 40 10z"
              stroke="#bcc0c4" strokeWidth="3" fill="none" />
            <circle cx="25" cy="25" r="3.5" fill="#bcc0c4" />
          </svg>
          <span style={{ marginTop: 10, color: "#65676b", fontSize: 14 }}>
            Aucune identification à examiner
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
