import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";

// ─── Size limits ────────────────────────────────────────────────────────────
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;  // 100 MB
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;   // 10 MB
export const USER_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB per user

// ─── Image processing ────────────────────────────────────────────────────────

export interface ProcessedImage {
  /** Compressed original, re-encoded to WebP */
  original: { data: Buffer; contentType: "image/webp"; ext: ".webp" };
  /** 800 × auto, fit inside, WebP quality 80 */
  medium: { data: Buffer; contentType: "image/webp"; ext: ".webp" };
  /** 200 × 200 cover crop, WebP quality 75 */
  thumbnail: { data: Buffer; contentType: "image/webp"; ext: ".webp" };
}

/**
 * Compress an image and produce three sizes.
 * Auto-rotates based on EXIF orientation.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const [original, medium, thumbnail] = await Promise.all([
    sharp(buffer).rotate().webp({ quality: 82 }).toBuffer(),
    sharp(buffer).rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(buffer).rotate()
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 75 })
      .toBuffer(),
  ]);
  return {
    original:  { data: original,  contentType: "image/webp", ext: ".webp" },
    medium:    { data: medium,    contentType: "image/webp", ext: ".webp" },
    thumbnail: { data: thumbnail, contentType: "image/webp", ext: ".webp" },
  };
}

// ─── FFmpeg helpers ──────────────────────────────────────────────────────────

const FFMPEG_BIN =
  process.env.FFMPEG_PATH ??
  "/nix/store/0rprx5rl00z3a3snhxyn9qqlkhzfsxl4-replit-runtime-path/bin/ffmpeg";

function tmpFile(ext: string): string {
  return path.join(os.tmpdir(), `bp-${crypto.randomBytes(8).toString("hex")}${ext}`);
}

function cleanupFiles(...files: string[]) {
  for (const f of files) { try { fs.unlinkSync(f); } catch {} }
}

// ─── Video thumbnail ─────────────────────────────────────────────────────────

/**
 * Extract a JPEG thumbnail from a video at the 1-second mark (320px wide).
 * Returns null on failure (non-fatal — caller stores video without thumb).
 */
export async function generateVideoThumbnail(
  videoBuffer: Buffer,
  inputExt = ".mp4",
): Promise<Buffer | null> {
  const inputPath  = tmpFile(inputExt);
  const outputPath = tmpFile(".jpg");
  try {
    fs.writeFileSync(inputPath, videoBuffer);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(FFMPEG_BIN, [
        "-y", "-i", inputPath,
        "-ss", "00:00:01.000",
        "-vframes", "1",
        "-vf", "scale=320:-1",
        "-q:v", "3",
        outputPath,
      ]);
      proc.on("close", code =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
      );
      proc.on("error", reject);
    });
    return fs.readFileSync(outputPath);
  } catch {
    return null;
  } finally {
    cleanupFiles(inputPath, outputPath);
  }
}

// ─── Audio → Opus ────────────────────────────────────────────────────────────

export interface CompressedAudio {
  data: Buffer;
  ext: string;
  contentType: string;
}

/**
 * Re-encode audio to Opus/OGG at 24 kbps (ideal for voice messages).
 * Falls back to the original buffer + mime if ffmpeg fails.
 */
export async function compressAudioToOpus(
  audioBuffer: Buffer,
  inputExt: string,
): Promise<CompressedAudio> {
  const inputPath  = tmpFile(inputExt);
  const outputPath = tmpFile(".ogg");
  try {
    fs.writeFileSync(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(FFMPEG_BIN, [
        "-y", "-i", inputPath,
        "-c:a", "libopus",
        "-b:a", "24k",
        "-vbr", "on",
        "-compression_level", "10",
        "-application", "voip",
        outputPath,
      ]);
      proc.on("close", code =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
      );
      proc.on("error", reject);
    });
    return {
      data: fs.readFileSync(outputPath),
      ext: ".ogg",
      contentType: "audio/ogg",
    };
  } catch {
    return { data: audioBuffer, ext: inputExt, contentType: "audio/mpeg" };
  } finally {
    cleanupFiles(inputPath, outputPath);
  }
}
