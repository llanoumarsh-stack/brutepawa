import { Router, type IRouter } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, buildKey, buildPublicUrl, detectKind } from "../lib/r2";
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

    const filename = (req.headers["x-filename"] as string) || "upload.bin";
    const contentType = (req.headers["content-type"] as string) || "application/octet-stream";

    try {
      const kind = detectKind(filename);
      const key  = buildKey(filename, kind);

      await r2.send(new PutObjectCommand({
        Bucket:      process.env.R2_BUCKET_NAME!,
        Key:         key,
        Body:        body,
        ContentType: contentType,
      }));

      res.json({ url: buildPublicUrl(key), key, kind });
    } catch (err) {
      req.log.error({ err }, "R2 upload error");
      res.status(500).json({ error: "Upload échoué côté serveur" });
    }
  }
);

export default router;
