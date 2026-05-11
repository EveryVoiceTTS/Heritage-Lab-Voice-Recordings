import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

const SEED_PINS = [
  // pins
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS speakers (
      id SERIAL PRIMARY KEY,
      pin VARCHAR(4) UNIQUE NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      speaker_id INTEGER REFERENCES speakers(id),
      prompt_id VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      recorded_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(speaker_id, prompt_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      speaker_id INTEGER REFERENCES speakers(id),
      prompt_id VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(speaker_id, prompt_id)
    )
  `;

  let seeded = 0;
  for (const pin of SEED_PINS) {
    const existing = await sql`SELECT id FROM speakers WHERE pin = ${pin}`;
    if (existing.length === 0) {
      await sql`INSERT INTO speakers (pin) VALUES (${pin})`;
      seeded++;
    }
  }

  return res.status(200).json({
    message: "Database initialized",
    tables: ["speakers", "progress", "notes"],
    pins_seeded: seeded,
    total_pins: SEED_PINS.length,
  });
}
