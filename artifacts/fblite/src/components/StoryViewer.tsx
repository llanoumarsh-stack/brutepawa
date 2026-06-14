import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiViewStory, type StoryGroup, type StoryItem } from "../lib/api";

interface Props {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 5000;

const BG_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name: string) { return name.slice(0, 2).toUpperCase(); }

export default function StoryViewer({ groups, initialGroupIndex, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const group = groups[groupIdx];
  const story: StoryItem | undefined = group?.stories[storyIdx];

  useEffect(() => {
    if (!story) return;
    apiViewStory(story.id).catch(() => {});
  }, [story?.id]);

  const goNext = () => {
    if (storyIdx < (group?.stories.length ?? 0) - 1) {
      setStoryIdx(i => i + 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(i => i + 1);
      setStoryIdx(0);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIdx > 0) {
      setGroupIdx(i => i - 1);
      setStoryIdx(0);
      setProgress(0);
      elapsedRef.current = 0;
    }
  };

  useEffect(() => {
    if (paused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    startRef.current = Date.now() - elapsedRef.current;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      elapsedRef.current = elapsed;
      if (elapsed >= STORY_DURATION) { goNext(); }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [groupIdx, storyIdx, paused]);

  if (!group || !story) return null;

  const authorInitials = getInitials(group.authorName);
  const authorBg = BG_COLORS[group.authorId % BG_COLORS.length];

  const bg = story.mediaUrl
    ? `url(${story.mediaUrl}) center/cover no-repeat`
    : story.bgColor;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "#000",
        display: "flex", flexDirection: "column",
        userSelect: "none", touchAction: "none",
      }}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Progress bars */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", gap: 3, padding: "10px 10px 0" }}>
        {group.stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, background: "#fff",
              width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
              transition: i === storyIdx ? "none" : undefined,
            }} />
          </div>
        ))}
      </div>

      {/* Author header */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 10, padding: "16px 14px 8px" }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          border: "2px solid #fff", overflow: "hidden",
          background: authorBg, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 14,
        }}>
          {group.authorAvatarUrl
            ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : authorInitials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{group.authorName}</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{timeAgo(story.createdAt)}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
      </div>

      {/* Story content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: bg, position: "relative" }}>
        {story.emoji && !story.mediaUrl && (
          <div style={{ fontSize: 72, marginBottom: story.content ? 16 : 0, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{story.emoji}</div>
        )}
        {story.content && (
          <div style={{
            color: "#fff", fontWeight: 800, fontSize: 22, textAlign: "center",
            padding: "16px 24px", maxWidth: 320,
            textShadow: story.mediaUrl ? "0 2px 8px rgba(0,0,0,0.8)" : "0 2px 4px rgba(0,0,0,0.3)",
            background: story.mediaUrl ? "rgba(0,0,0,0.35)" : "transparent",
            borderRadius: story.mediaUrl ? 12 : 0,
          }}>{story.content}</div>
        )}
      </div>

      {/* Views count */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
          👁️ {story.viewsCount} vue{story.viewsCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tap zones */}
      <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 5 }}>
        <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); goPrev(); }} />
        <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); goNext(); }} />
      </div>
    </div>,
    document.body
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}
