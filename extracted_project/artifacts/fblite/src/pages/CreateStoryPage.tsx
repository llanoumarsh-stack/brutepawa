import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { apiCreateStory } from "../lib/api";
import { useR2Upload } from "../hooks/useR2Upload";
import { storyDraftStore } from "../lib/storyDraft";

const BG_OPTIONS = [
  { id: "blue",    value: "#1877F2" },
  { id: "pink",    value: "#E91E63" },
  { id: "purple",  value: "#9C27B0" },
  { id: "orange",  value: "#F57C00" },
  { id: "green",   value: "#388E3C" },
  { id: "black",   value: "#212121" },
  { id: "red",     value: "#D32F2F" },
  { id: "teal",    value: "#00838F" },
  { id: "grad1",   value: "linear-gradient(135deg,#1877F2,#9C27B0)" },
  { id: "grad2",   value: "linear-gradient(135deg,#E91E63,#F57C00)" },
  { id: "grad3",   value: "linear-gradient(135deg,#388E3C,#1877F2)" },
];

const EMOJIS = ["🔥","😊","❤️","🎉","💪","🌍","😍","🙏","✨","🎵","🌅","💼","🎓","🤝","🛍️","🏆"];

export default function CreateStoryPage({ onCreated }: { onCreated?: () => void }) {
  const navigate = useNavigate();

  // Detect pre-selected file from Home/Feed story card gallery picker
  const draft = storyDraftStore.get();
  const [mode, setMode] = useState<"text" | "photo">(draft ? "photo" : "text");
  const [text, setText] = useState("");
  const [selectedBg, setSelectedBg] = useState(BG_OPTIONS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(draft?.previewUrl ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, status: uploadStatus, progress } = useR2Upload();

  // On mount: if a draft file was passed via storyDraftStore, start uploading it immediately
  useEffect(() => {
    const d = storyDraftStore.get();
    if (!d) return;
    const { file, previewUrl } = d;
    storyDraftStore.clear(); // clears reference only, does NOT revoke the URL
    upload(file).then(result => {
      if (result) setPhotoUrl(result.url);
    });
    // Revoke the object URL only when the component unmounts
    return () => URL.revokeObjectURL(previewUrl);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoUrl(null);
    const result = await upload(file);
    if (result) {
      setPhotoUrl(result.url);
      setMode("photo");
    } else {
      setPhotoPreview(null);
    }
  };

  const handlePublish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "photo") {
        if (!photoUrl) { setError("Photo en cours d'upload, attends encore…"); setSubmitting(false); return; }
        await apiCreateStory({ mediaUrl: photoUrl, content: text.trim() || undefined });
      } else {
        if (!text.trim() && !selectedEmoji) { setError("Écris quelque chose ou choisis un emoji"); setSubmitting(false); return; }
        await apiCreateStory({ content: text.trim() || undefined, bgColor: selectedBg.value, emoji: selectedEmoji ?? undefined });
      }
      onCreated?.();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const bg = mode === "photo" && photoPreview
    ? `url(${photoPreview}) center/cover no-repeat`
    : selectedBg.value;

  const canPublish = mode === "photo" ? (!!photoUrl && uploadStatus !== "uploading") : (!!text.trim() || !!selectedEmoji);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "#000" }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Preview area */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: bg, position: "relative", transition: "background 0.3s",
      }}>
        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", zIndex: 10 }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", borderRadius: "50%", width: 40, height: 40, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >←</button>

          <div style={{ display: "flex", gap: 8 }}>
            {/* Mode toggle */}
            <button
              onClick={() => setMode(mode === "photo" ? "text" : "photo")}
              style={{ background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {mode === "photo" ? "✍️ Texte" : "📷 Photo"}
            </button>
            {mode === "photo" && (
              <button
                onClick={() => fileRef.current?.click()}
                style={{ background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                🔄 Changer
              </button>
            )}
          </div>
        </div>

        {/* Upload progress */}
        {uploadStatus === "uploading" && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 0 4px" }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.3)" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#fff", transition: "width 0.2s" }} />
            </div>
            <div style={{ color: "#fff", fontSize: 12, textAlign: "center", padding: "4px 0" }}>
              Upload… {progress}%
            </div>
          </div>
        )}

        {/* Emoji display */}
        {selectedEmoji && mode === "text" && (
          <div style={{ fontSize: 80, marginBottom: text ? 16 : 0, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{selectedEmoji}</div>
        )}

        {/* Text preview */}
        {text && (
          <div style={{
            color: "#fff", fontWeight: 800, fontSize: 24, textAlign: "center",
            padding: "12px 20px", maxWidth: 300,
            textShadow: mode === "photo" ? "0 2px 8px rgba(0,0,0,0.8)" : "0 2px 4px rgba(0,0,0,0.3)",
            background: mode === "photo" ? "rgba(0,0,0,0.4)" : "transparent",
            borderRadius: 12,
          }}>{text}</div>
        )}

        {/* Photo placeholder */}
        {mode === "photo" && !photoPreview && (
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: "rgba(255,255,255,0.15)", border: "2px dashed rgba(255,255,255,0.5)", borderRadius: 16, padding: "32px 40px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 48 }}>📷</span>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Choisir une photo</span>
          </button>
        )}

        {/* Text placeholder */}
        {mode === "text" && !text && !selectedEmoji && (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: 600 }}>
            Tapez votre message ↓
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ background: "#111", padding: "16px 16px", flexShrink: 0 }}>
        {error && <div style={{ color: "#FF5252", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{error}</div>}

        {/* Text input */}
        <textarea
          placeholder={mode === "photo" ? "Ajouter un texte sur la photo (optionnel)…" : "Quoi de neuf ?"}
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #333",
            background: "#1c1c1c", color: "#fff", fontSize: 15, resize: "none", minHeight: 52,
            outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          }}
          maxLength={200}
        />

        {/* Emoji row */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "10px 0 4px", marginBottom: 6 }}>
          <button
            onClick={() => setSelectedEmoji(null)}
            style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: !selectedEmoji ? "2px solid var(--fb-blue)" : "2px solid #333", background: "#222", cursor: "pointer", fontSize: 14, color: "#fff" }}
          >✕</button>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setSelectedEmoji(selectedEmoji === e ? null : e)}
              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: selectedEmoji === e ? "2px solid var(--fb-blue)" : "2px solid #333", background: "#222", cursor: "pointer", fontSize: 20 }}
            >{e}</button>
          ))}
        </div>

        {/* Bg color row (text mode only) */}
        {mode === "text" && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "4px 0 10px" }}>
            {BG_OPTIONS.map(bg => (
              <button
                key={bg.id}
                onClick={() => setSelectedBg(bg)}
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                  background: bg.value,
                  border: selectedBg.id === bg.id ? "3px solid #fff" : "2px solid #444",
                  boxShadow: selectedBg.id === bg.id ? "0 0 0 2px #1877F2" : "none",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}

        {/* Publish button */}
        <button
          onClick={handlePublish}
          disabled={!canPublish || submitting}
          style={{
            width: "100%", padding: 14, borderRadius: 10, border: "none",
            background: canPublish && !submitting ? "var(--fb-blue)" : "#444",
            color: "#fff", fontWeight: 900, fontSize: 16,
            cursor: canPublish && !submitting ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Publication…" : uploadStatus === "uploading" ? `⏳ Upload ${progress}%…` : "📤 Partager ma story"}
        </button>
      </div>
    </div>
  );
}
