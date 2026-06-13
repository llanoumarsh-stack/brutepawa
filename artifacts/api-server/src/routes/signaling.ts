import { Router, type Request, type Response, type NextFunction } from "express";
import { verifyToken } from "../lib/auth";

const router = Router();

const listeners = new Map<number, Response>();

function sseAuth(req: Request, res: Response, next: NextFunction): void {
  let token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) token = (req.query.token as string) ?? "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid token" }); return; }
  req.userId = payload.userId;
  next();
}

router.get("/signaling/listen", sseAuth, (req, res) => {
  const userId = req.userId!;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const existing = listeners.get(userId);
  if (existing) {
    try { existing.end(); } catch { /* ignore */ }
    listeners.delete(userId);
  }
  listeners.set(userId, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  const keepalive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(keepalive); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepalive);
    if (listeners.get(userId) === res) listeners.delete(userId);
  });
});

router.post("/signaling/send", sseAuth, (req, res) => {
  const from = req.userId!;
  const { to, type, payload } = req.body as { to: number; type: string; payload: unknown };

  if (!to || !type) {
    res.status(400).json({ error: "'to' and 'type' are required" });
    return;
  }

  const target = listeners.get(Number(to));
  if (!target) {
    res.json({ delivered: false, reason: "user_offline" });
    return;
  }

  try {
    target.write(`event: signal\ndata: ${JSON.stringify({ type, from, payload: payload ?? {} })}\n\n`);
    res.json({ delivered: true });
  } catch {
    listeners.delete(Number(to));
    res.json({ delivered: false, reason: "write_failed" });
  }
});

export default router;
