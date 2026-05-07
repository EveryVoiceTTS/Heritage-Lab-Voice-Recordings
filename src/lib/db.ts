import { openDB, type IDBPDatabase } from 'idb'
import type { Recording } from './types'

const DB_NAME = 'voice-recorder-db'
const DB_VERSION = 3
const STORE_NAME = 'recordings'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let store: any
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('by-prompt', 'promptId')
          store.createIndex('by-category', 'category')
        } else {
          store = tx.objectStore(STORE_NAME)
        }

        if (oldVersion < 2) {
          if (!store.indexNames.contains('by-speaker')) {
            store.createIndex('by-speaker', 'speakerName')
          }
          if (!store.indexNames.contains('by-speaker-category')) {
            store.createIndex('by-speaker-category', ['speakerName', 'category'])
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('speakers')) {
            db.createObjectStore('speakers', { keyPath: 'name' })
          }
        }
      },
    })
  }
  return dbPromise
}

export async function saveRecording(recording: Recording): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, recording)
}

export async function getRecording(id: string): Promise<Recording | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function getAllRecordings(): Promise<Recording[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
