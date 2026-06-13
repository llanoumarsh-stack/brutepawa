import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

const accountId  = process.env.R2_ACCOUNT_ID!;
const bucketName = process.env.R2_BUCKET_NAME!;
const publicUrl  = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export type MediaKind = "image" | "video" | "audio";

const EXT_MAP: Record<string, MediaKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", heic: "image",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
  mp3: "audio", ogg: "audio", wav: "audio", m4a: "audio", aac: "audio",
};

export function detectKind(filename: string): MediaKind {
  const ext = path.extname(filename).replace(".", "").toLowerCase();
  return EXT_MAP[ext] ?? "image";
}

export function buildKey(filename: string, kind: MediaKind): string {
  const ext   = path.extname(filename) || ".bin";
  const uuid  = crypto.randomBytes(16).toString("hex");
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${kind}/${year}/${month}/${uuid}${ext}`;
}

export function buildPublicUrl(key: string): string {
  return `${publicUrl}/${key}`;
}

/** Generate a pre-signed PUT URL — client uploads directly to R2 */
export async function createPresignedUpload(filename: string, contentType: string): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  kind: MediaKind;
}> {
  const kind = detectKind(filename);
  const key  = buildKey(filename, kind);

  const command = new PutObjectCommand({
    Bucket:      bucketName,
    Key:         key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min

  return { uploadUrl, publicUrl: buildPublicUrl(key), key, kind };
}
