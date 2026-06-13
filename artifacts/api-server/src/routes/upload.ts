import { Router, type IRouter } from "express";
import { buildKey, buildPublicUrl, detectKind, putObject, deleteObject, ownerIdFromKey } from "../lib/r2";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post(
  "/upload",
  requireAuth,
  (req, res, next) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => { (req as unknown as { rawBody: Buffer }).rawBody = Buffer.concat(chunks); next(); });
    req.on("error", next);
  },
  async (req, res): Promise<void> => {
    const body = (req as unknown as { rawBody: Buffer }).rawBody;
    if (!body || body.length === 0) {
      res.status(400).json({ error: "Fichier vide" });
      return;
    }

    const filename    = (req.headers["x-filename"] as string) || "upload.bin";
    const contentType = (req.headers["content-type"] as string) || "application/octet-stream";

    try {
      const kind = detectKind(filename);
      const key  = buildKey(filename, kind, req.userId!);

      await putObject(key, body, contentType);

      res.json({ url: buildPublicUrl(key), key, kind });
    } catch (err) {
      req.log.error({ err }, "R2 upload error");
      res.status(500).json({ error: "Upload échoué côté serveur" });
    }
  }
);

/**
 * DELETE /api/upload/<key>
 * Authenticated — deletes an R2 object by key.
 * Ownership is validated via the userId embedded in the v2 key format.
 * Key must start with a known media prefix (image/ video/ audio/).
 */
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
      // Legacy key without embedded ownership — refuse deletion via this endpoint
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
  }
);

export default router;
