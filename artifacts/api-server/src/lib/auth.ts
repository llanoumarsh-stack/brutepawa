import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but not set. The server cannot start without it.");
}

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, SECRET!, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const payload = jwt.verify(token, SECRET!) as { userId: number; role: string };
    return payload;
  } catch {
    return null;
  }
}
