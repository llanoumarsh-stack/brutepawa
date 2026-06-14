import { Router, type IRouter } from "express";
import {
  buildKey, buildPublicUrl, detectKind, putObject, deleteObject,
  ownerIdFromKey, extractKeyFromUrl,
} from "../lib/r2";
import {
  processImage, generateVideoThumbnail, compressAudioToOpus,
  MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_AUDIO_BYTES, USER_QUOTA_BYTES,
} from "../lib/media";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import path from "path";

const router: IRouter = Router();

// ─── POST /api/upload ─────────────────────────────────────────────────────────

router.post(
  "/upload",
  requireAuth,
  (req, res, next) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      (req as unknown as { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on("error", next);
  },
  async (req, res): Promise<void> => {
    const body = (req as unknown as { rawBody: Buffer }).rawBody;
    if (!body || body.length === 0) {
      res.status(400).json({ error: "Fichier vide" });
      return;
    }

    const filename    = (req.headers["x-filename"] as string) || "upload.bin";
    const userId      = req.userId!;
    const kind        = detectKind(filename);
    const ext         = path.extname(filename).toLowerCase();

    // ── Size limits ──────────────────────────────────────────────────────────
    const limit =
      kind === "video" ? MAX_VIDEO_BYTES :
      kind === "audio" ? MAX_AUDIO_BYTES :
      MAX_IMAGE_BYTES;

    if (body.length > limit) {
      const limitMb = Math.round(limit / 1024 / 1024);
      res.status(413).json({ error: `Fichier trop volumineux — max ${limitMb} Mo pour ce type` });
      return;
    }

    // ── Quota utilisateur (500 MB total) ─────────────────────────────────────
    try {
      const [user] = await db
        .select({ totalStorageBytes: sql<number>`total_storage_bytes` })
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (user && Number(user.totalStorageBytes) + body.length > USER_QUOTA_BYTES) {
        res.status(413).json({
          error: "Quota de stockage dépassé (500 Mo). Supprime des fichiers pour libérer de l'espace.",
        });
        return;
      }
    } catch {
      // Non-fatal — continue if quota check fails (column may not exist yet)
    }

    try {
      let mainKey: string;
      let mainBuffer: Buffer;
      let mainContentType: string;
      let thumbnailUrl: string | undefined;
      let mediumUrl: string | undefined;

      // ── Image: compress to WebP, generate thumbnail + medium ───────────────
      if (kind === "image") {
        const processed = await processImage(body);

        // Main key uses .webp regardless of original extension
        mainKey         = buildKey("upload.webp", "image", userId);
        mainBuffer      = processed.original.data;
        mainContentType = "image/webp";

        // Upload thumbnail and medium in parallel
        const thumbKey  = buildKey("thumb.webp", "image", userId);
        const mediumKey = buildKey("medium.webp", "image", userId);

        await Promise.all([
          putObject(mainKey,   processed.original.data,  "image/webp"),
          putObject(thumbKey,  processed.thumbnail.data, "image/webp"),
          putObject(mediumKey, processed.medium.data,    "image/webp"),
        ]);

        thumbnailUrl = buildPublicUrl(thumbKey);
        mediumUrl    = buildPublicUrl(mediumKey);

      // ── Video: enforce limit, generate thumbnail ───────────────────────────
      } else if (kind === "video") {
        mainKey         = buildKey(filename, "video", userId);
        mainBuffer      = body;
        mainContentType = (req.headers["content-type"] as string) || "video/mp4";

        const thumbBuffer = await generateVideoThumbnail(body, ext);

        await putObject(mainKey, mainBuffer, mainContentType);

        if (thumbBuffer) {
          const thumbKey = buildKey("thumb.jpg", "image", userId);
          await putObject(thumbKey, thumbBuffer, "image/jpeg");
          thumbnailUrl = buildPublicUrl(thumbKey);
        }

      // ── Audio: compress to Opus ────────────────────────────────────────────
      } else {
        const compressed = await compressAudioToOpus(body, ext || ".mp3");
        mainKey         = buildKey(`voice${compressed.ext}`, "audio", userId);
        mainBuffer      = compressed.data;
        mainContentType = compressed.contentType;

        await putObject(mainKey, mainBuffer, mainContentType);
      }

      // ── Increment user storage quota ─────────────────────────────────────
      const storedBytes = mainBuffer.length;
      await db.execute(
        sql`UPDATE users SET total_storage_bytes = total_storage_bytes + ${storedBytes} WHERE id = ${userId}`,
      ).catch(() => {});

      res.json({
        url:          buildPublicUrl(mainKey),
        key:          mainKey,
        kind,
        thumbnailUrl: thumbnailUrl ?? null,
        mediumUrl:    mediumUrl    ?? null,
        size:         storedBytes,
      });
    } catch (err) {
      req.log.error({ err }, "R2 upload error");
      res.status(500).json({ error: "Upload échoué côté serveur" });
    }
  },
);

// ─── DELETE /api/upload/<key> ─────────────────────────────────────────────────

router.delete(
  /^\/upload\/(.+)$/,
  requireAuth,
  async (req, res): Promise<void> => {
    const key = (req.params as unknown as string[])[0];

    if (!key || !/^(image|video|audio)\//.test(key)) {
      res.status(400).json({ error: "Clé invalide" });
      return;
    }

    const ownerId = ownerIdFromKey(key);
    if (ownerId === null) {
      res.status(403).json({ error: "Ce fichier ne peut pas être supprimé via cette API" });
      return;
    }
    if (ownerId !== req.userId!) {
      res.status(403).json({ error: "Non autorisé" });
      return;
    }

    try {
      await deleteObject(key);
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "R2 delete error");
      res.status(500).json({ error: "Suppression échouée" });
    }
  },
);

export default router;
