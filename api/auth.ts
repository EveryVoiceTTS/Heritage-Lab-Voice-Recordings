import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== "string" || pin.length !== 4) {
    return res.status(400).json({ error: "A valid 4-digit PIN is required" });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT id, pin, name FROM speakers WHERE pin = ${pin}`;

  if (rows.length === 0) {
    return res.status(401).json({ error: "Invalid PIN" });
  }

  const speaker = rows[0];
  return res.status(200).json({
    id: speaker.id,
    pin: speaker.pin,
    name: speaker.name,
  });
}
