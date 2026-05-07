import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env.DATABASE_URL!)

  if (req.method === 'GET') {
    const speakerId = Number(req.query.speaker_id)
    const category = req.query.category as string | undefined
    const promptId = req.query.prompt_id as string | undefined

    if (!speakerId) {
      return res.status(400).json({ error: 'speaker_id is required' })
    }

    let rows
    if (promptId) {
      rows = await sql`
        SELECT prompt_id, category, note FROM notes
        WHERE speaker_id = ${speakerId} AND prompt_id = ${promptId}
      `
    } else if (category) {
      rows = await sql`
        SELECT prompt_id, category, note FROM notes
        WHERE speaker_id = ${speakerId} AND category = ${category}
      `
    } else {
      rows = await sql`
        SELECT prompt_id, category, note FROM notes
        WHERE speaker_id = ${speakerId}
      `
    }

    return res.status(200).json({ notes: rows })
  }

  if (req.method === 'POST') {
    const { speaker_id, items } = req.body
    if (!speaker_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'speaker_id and items[] are required' })
    }

    let saved = 0
    for (const item of items) {
      if (!item.prompt_id || !item.category || !item.note) continue
      await sql`
        INSERT INTO notes (speaker_id, prompt_id, category, note)
        VALUES (${speaker_id}, ${item.prompt_id}, ${item.category}, ${item.note})
        ON CONFLICT (speaker_id, prompt_id) DO UPDATE SET
          note = EXCLUDED.note,
          updated_at = NOW()
      `
      saved++
    }

    return res.status(200).json({ saved })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
