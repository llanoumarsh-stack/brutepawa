import { useState } from "react";

export type UploadStatus = "idle" | "uploading" | "done" | "error";
export type UploadPhase =
  | "idle"
  | "checking"
  | "generating-thumbnail"
  | "uploading-thumbnail"
  | "uploading"
  | "done"
  | "error";

export interface UploadedMedia {
  url: string;
  key: string;
  kind: "image" | "video" | "audio";
  filename: string;
  size: number;
  thumbnailUrl?: string;
  thumbnailKey?: string;
}

export interface UseR2Upload {
  upload: (file: File) => Promise<UploadedMedia | null>;
  uploadMultiple: (files: File[]) => Promise<UploadedMedia[]>;
  status: UploadStatus;
  phase: UploadPhase;
  progress: number;
  error: string | null;
  reset: () => void;
}

const API_BASE = "/api";
const MAX_VIDEO_DURATION_S = 180; // 3 minutes

/** Returns duration in seconds, or rejects on error. */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    });
    video.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire la vidéo"));
    });
  });
}

/** Captures frame at t≈1s and returns a JPEG File, or null on failure. */
function generateVideoThumbnail(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(1, video.duration > 0 ? video.duration * 0.1 : 1);
    });

    video.addEventListener("seeked", () => {
      try {
        const W = Math.min(video.videoWidth || 640, 1280);
        const H = video.videoWidth
          ? Math.round((video.videoHeight / video.videoWidth) * W)
          : 720;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(video, 0, 0, W, H);
        canvas.toBlob((blob) => {
          cleanup();
          if (!blob) { resolve(null); return; }
          const thumbName = file.name.replace(/\.[^.]+$/, "") + "_thumb.jpg";
          resolve(new File([blob], thumbName, { type: "image/jpeg" }));
        }, "image/jpeg", 0.82);
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
  });
}

/** Low-level XHR upload — returns parsed JSON response. */
function rawUpload(
  file: File,
  token: string | null,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; key: string; kind: "image" | "video" | "audio" }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("X-Filename", file.name);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Réponse invalide du serveur")); }
      } else {
        if (xhr.status === 401 && token) {
          localStorage.removeItem("bp_token");
          localStorage.removeItem("fb_user");
          window.dispatchEvent(new CustomEvent("bp:session-expired"));
        }
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(body.error ?? `Erreur ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
    xhr.send(file);
  });
}

export function useR2Upload(): UseR2Upload {
  const [status, setStatus]   = useState<UploadStatus>("idle");
  const [phase, setPhase]     = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError]     = useState<string | null>(null);

  function reset() {
    setStatus("idle");
    setPhase("idle");
    setProgress(0);
    setError(null);
  }

  async function upload(file: File): Promise<UploadedMedia | null> {
    setError(null);
    setStatus("uploading");
    setProgress(0);

    const token = localStorage.getItem("bp_token");
    const isVideo = file.type.startsWith("video/");

    try {
      // ── 1. Validate video duration ────────────────────────────────────────
      if (isVideo) {
        setPhase("checking");
        const duration = await getVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION_S) {
          throw new Error(
            `La vidéo dépasse 3 minutes (${Math.round(duration)}s). Limite : 3 min.`,
          );
        }
      }

      // ── 2. Generate + upload thumbnail for videos ─────────────────────────
      let thumbnailUrl: string | undefined;
      let thumbnailKey: string | undefined;

      if (isVideo) {
        setPhase("generating-thumbnail");
        const thumbFile = await generateVideoThumbnail(file);

        if (thumbFile) {
          setPhase("uploading-thumbnail");
          try {
            const thumbResult = await rawUpload(thumbFile, token);
            thumbnailUrl = thumbResult.url;
            thumbnailKey = thumbResult.key;
          } catch {
            // Thumbnail failure is non-fatal — continue without it
          }
        }
      }

      // ── 3. Upload the main file ───────────────────────────────────────────
      setPhase("uploading");
      setProgress(0);

      const result = await rawUpload(file, token, setProgress);

      setStatus("done");
      setPhase("done");
      setProgress(100);

      return {
        url:          result.url,
        key:          result.key,
        kind:         result.kind,
        filename:     file.name,
        size:         file.size,
        thumbnailUrl,
        thumbnailKey,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload échoué";
      setError(msg);
      setStatus("error");
      setPhase("error");
      return null;
    }
  }

  async function uploadMultiple(files: File[]): Promise<UploadedMedia[]> {
    const results: UploadedMedia[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await upload(files[i]);
      if (result) results.push(result);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }
    return results;
  }

  return { upload, uploadMultiple, status, phase, progress, error, reset };
}

/** Human-readable label for the current upload phase */
export function phaseLabel(phase: UploadPhase, progress: number): string {
  switch (phase) {
    case "checking":              return "Vérification…";
    case "generating-thumbnail":  return "Génération de la miniature…";
    case "uploading-thumbnail":   return "Upload miniature…";
    case "uploading":             return `Envoi en cours — ${progress}%`;
    case "done":                  return "Envoi terminé ✓";
    case "error":                 return "Erreur d'upload";
    default:                      return "";
  }
}
