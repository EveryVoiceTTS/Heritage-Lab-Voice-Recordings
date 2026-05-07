import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env.DATABASE_URL!)

  if (req.method === 'GET') {
    const speakerId = Number(req.query.speaker_id)
    if (!speakerId) {
      return res.status(400).json({ error: 'speaker_id is required' })
    }

    const rows = await sql`
      SELECT category, COUNT(DISTINCT prompt_id)::int AS count
      FROM progress
      WHERE speaker_id = ${speakerId}
      GROUP BY category
    `

    const counts: Record<string, number> = {
      words: 0,
      sentences: 0,
      questions: 0,
      grammar: 0,
    }
    for (const row of rows) {
      counts[row.category] = row.count
    }

    const latest = await sql`
      SELECT DISTINCT ON (category) category, prompt_id::text AS prompt_id
      FROM progress
      WHERE speaker_id = ${speakerId}
      ORDER BY category, recorded_at DESC
    `

    const lastPrompt: Record<string, string> = {
      words: "",
      sentences: "",
      questions: "",
      grammar: "",
    }

    for (const l of latest) {
      lastPrompt[l.category] = l.prompt_id
    }


    return res.status(200).json({ progress: counts, latestprompts: lastPrompt })
  }

  if (req.method === 'POST') {
    const { speaker_id, items } = req.body
    if (!speaker_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'speaker_id and items[] are required' })
    }

    let saved = 0
    for (const item of items) {
      if (!item.prompt_id || !item.category) continue
      await sql`
        INSERT INTO progress (speaker_id, prompt_id, category)
        VALUES (${speaker_id}, ${item.prompt_id}, ${item.category})
        ON CONFLICT (speaker_id, prompt_id) DO NOTHING
      `
      saved++
    }

    return res.status(200).json({ saved })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
