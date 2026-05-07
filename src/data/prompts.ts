import Papa from 'papaparse'
import type { Prompt, Category } from '../lib/types'
import { syllabicsToRoman, romanToSyllabics } from './transliterate'

const CSV_FILES: Record<Category, string> = {
  words: '/data/single_words.csv',
  sentences: '/data/short_sentences.csv',
  questions: '/data/questions.csv',
  grammar: '/data/grammar_elements.csv',
}

const cache: Partial<Record<Category, Prompt[]>> = {}

function cleanField(val: string): string {
  return val.replace(/^"+|"+$/g, '').trim()
}

const SYLLABICS_RE = /[\u1400-\u167F]/
const LATIN_RE = /[a-zA-Z]/
const PARENS_RE = /[()]/
const DIGITS_RE = /[0-9]/
const PUNCT_WORDS_SENTENCES = /[.,!;:]/

function isValidSyllabics(text: string, category: Category): boolean {
  if (!SYLLABICS_RE.test(text)) return false
  if (LATIN_RE.test(text)) return false
  if (PARENS_RE.test(text)) return false
  if (DIGITS_RE.test(text)) return false
  if (category === 'questions') {
    if (/[.,!]/.test(text)) return false
  } else {
    if (PUNCT_WORDS_SENTENCES.test(text)) return false
  }
  return true
}

export async function loadPrompts(category: Category): Promise<Prompt[]> {
  if (cache[category]) return cache[category]!

  const res = await fetch(CSV_FILES[category])
  const text = await res.text()

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  let prompts: Prompt[]

  if (category === 'grammar') {
    prompts = result.data
      .map((row, i) => {
        const roman = cleanField(row.text || '')
        if (!roman) return null
        return {
          id: `g${i + 1}`,
          syllabics: romanToSyllabics(roman),
          romanized: roman,
          category: category as Category,
        }
      })
      .filter((p): p is Prompt => p !== null)
  } else {
    prompts = result.data
      .map((row, i) => {
        const syllabics = cleanField(row.Inuktitut || '')
        if (!syllabics) return null
        if (!isValidSyllabics(syllabics, category)) return null
        return {
          id: `${category[0]}${i + 1}`,
          syllabics,
          romanized: syllabicsToRoman(syllabics),
          category: category as Category,
        }
      })
      .filter((p): p is Prompt => p !== null)
  }

  cache[category] = prompts
  return prompts
}

export async function getPromptCount(category: Category): Promise<number> {
  const prompts = await loadPrompts(category)
  return prompts.length
}
