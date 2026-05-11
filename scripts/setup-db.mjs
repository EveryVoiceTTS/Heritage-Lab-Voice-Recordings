import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const SEED_PINS = process.env.SEED_PINS?.split(",").map((seed) =>
  parseInt(seed.trim()),
);

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log("Creating speakers table...");
  await sql`
    CREATE TABLE IF NOT EXISTS speakers (
      id SERIAL PRIMARY KEY,
      pin VARCHAR(4) UNIQUE NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating progress table...");
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

  console.log("Seeding PINs...");
  let seeded = 0;
  for (const pin of SEED_PINS) {
    const existing = await sql`SELECT id FROM speakers WHERE pin = ${pin}`;
    if (existing.length === 0) {
      await sql`INSERT INTO speakers (pin) VALUES (${pin})`;
      seeded++;
    }
  }

  console.log(`Done! Seeded ${seeded} new PINs (${SEED_PINS.length} total).`);

  const rows = await sql`SELECT id, pin, name FROM speakers ORDER BY id`;
  console.log("\nSpeakers table:");
  console.table(rows);
}

main().catch(console.error);
