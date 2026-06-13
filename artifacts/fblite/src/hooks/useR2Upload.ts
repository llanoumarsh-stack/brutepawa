import { useState } from "react";

export type UploadStatus = "idle" | "uploading" | "done" | "error";

export interface UploadedMedia {
  url: string;
  key: string;
  kind: "image" | "video" | "audio";
  filename: string;
  size: number;
}

export interface UseR2Upload {
  upload: (file: File) => Promise<UploadedMedia | null>;
  uploadMultiple: (files: File[]) => Promise<UploadedMedia[]>;
  status: UploadStatus;
  progress: number;
  error: string | null;
  reset: () => void;
}

const API_BASE = "/api";

export function useR2Upload(): UseR2Upload {
  const [status, setStatus]     = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  function reset() {
    setStatus("idle");
    setProgress(0);
    setError(null);
  }

  async function upload(file: File): Promise<UploadedMedia | null> {
    setError(null);
    setStatus("uploading");
    setProgress(0);

    try {
      const token = localStorage.getItem("bp_token");

      const result = await new Promise<{ url: string; key: string; kind: "image" | "video" | "audio" }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("X-Filename", file.name);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.addEventListener("progress", e => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText) as { url: string; key: string; kind: "image" | "video" | "audio" }); }
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

      setStatus("done");
      setProgress(100);
      return { url: result.url, key: result.key, kind: result.kind, filename: file.name, size: file.size };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload échoué";
      setError(msg);
      setStatus("error");
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

  return { upload, uploadMultiple, status, progress, error, reset };
}
