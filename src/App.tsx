import { useState, useEffect, useCallback } from 'react'
import type { Category, Prompt } from './lib/types'
import { type Speaker, fetchProgress, fetchLatestPrompt } from './lib/api'
import { loadPrompts, getPromptCount } from './data/prompts'
import Layout from './components/Layout'
import SpeakerNamePrompt from './components/SpeakerNamePrompt'
import CategorySelect from './components/CategorySelect'
import RecordingInterface from './components/RecordingInterface'

type Screen = 'categories' | 'recording'

export default function App() {
  const [speaker, setSpeaker] = useState<Speaker | null>(null)
  const [screen, setScreen] = useState<Screen>('categories')
  const [selectedCategory, setSelectedCategory] = useState<Category>('words')
  const [categoryPrompts, setCategoryPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(false)
  const [latestPrompt, setLatestPrompts] = useState<Record<Category, string>>({
    grammar: "", words: "", sentences: "", questions: "",
  })
  const [completedCounts, setCompletedCounts] = useState<Record<Category, number>>({
    grammar: 0, words: 0, sentences: 0, questions: 0,
  })
  const [totalCounts, setTotalCounts] = useState<Record<Category, number>>({
    grammar: 0, words: 0, sentences: 0, questions: 0,
  })

  const speakerDisplayName = speaker
    ? speaker.name || `Speaker ${speaker.pin}`
    : ''

  const loadCounts = useCallback(async () => {
    if (!speaker) return
    const categories: Category[] = ['grammar', 'words', 'sentences', 'questions']
    const totals: Record<string, number> = {}

    for (const cat of categories) {
      totals[cat] = await getPromptCount(cat)
    }
    setTotalCounts(totals as Record<Category, number>)

    try {
      const progress = await fetchProgress(speaker.id)
      setCompletedCounts(progress as Record<Category, number>)
    } catch {
      console.error('Failed to load progress from server')
    }

    try {
      const latestprompts = await fetchLatestPrompt(speaker.id)
      setLatestPrompts(latestprompts as Record<Category, string>)
    } catch {
      console.error('Failed to load latest prompt from server')
    }



  }, [speaker])

  useEffect(() => {
    if (speaker) loadCounts()
  }, [loadCounts, speaker])

  const handleAuth = (s: Speaker) => {
    setSpeaker(s)
  }

  const handleSwitchUser = () => {
    setSpeaker(null)
    setScreen('categories')
    setCompletedCounts({ grammar: 0, words: 0, sentences: 0, questions: 0 })
    setLatestPrompts({ grammar: "", words: "", sentences: "", questions: "" })
    setTotalCounts({ grammar: 0, words: 0, sentences: 0, questions: 0 })
  }

  const handleSelectCategory = async (category: Category) => {
    setSelectedCategory(category)
    setLoading(true)
    const prompts = await loadPrompts(category)
    const orderedPrompts = randomizePrompts(category, prompts)
    setCategoryPrompts(orderedPrompts)
    setLoading(false)
    setScreen('recording')
  }

  const randomizePrompts = (category: Category, prompts: Prompt[]) => {
    let keepFirst15 = false
    if (category !== 'grammar') {
      keepFirst15 = true
    }
    let promptsCopy = [...prompts]
    let first = keepFirst15 ? promptsCopy.slice(0,15) : []
    let last = keepFirst15 ? promptsCopy.slice(15) : promptsCopy

    let seed = speaker?.id ?? 0;
    // Source - https://stackoverflow.com/a/53758827
    // Posted by Ulf Aslak
    // Retrieved 2026-03-16, License - CC BY-SA 4.0
    const random = (seed:number) => {
      let x = Math.sin(seed++) * 10000; 
      return x - Math.floor(x);
    }
    let m = last.length, t, i;
    // While there remain elements to shuffle…
    while (m) {
      // Pick a remaining element…
      i = Math.floor(random(seed) * m--);
      // And swap it with the current element.
      t = last[m];
      last[m] = last[i];
      last[i] = t;
      ++seed                                     
    }
    return [...first,...last]
  }


  const handleBack = () => {
    setScreen('categories')
    loadCounts()
  }

  if (!speaker) {
    return <SpeakerNamePrompt onSubmit={handleAuth} />
  }

  if (loading) {
    return (
      <Layout speakerName={speakerDisplayName} onSwitchUser={handleSwitchUser}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-sage-light border-t-forest-dark rounded-full animate-spin mx-auto mb-4" />
            <p className="text-charcoal-light">Loading prompts...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout speakerName={speakerDisplayName} onSwitchUser={handleSwitchUser}>
      {screen === 'recording' ? (
        <RecordingInterface
          prompts={categoryPrompts}
          latestPrompt={latestPrompt}
          category={selectedCategory}
          speakerName={speakerDisplayName}
          speakerId={speaker.id}
          onBack={handleBack}
          onSessionComplete={loadCounts}
        />
      ) : (
        <CategorySelect
          onSelect={handleSelectCategory}
          completedCounts={completedCounts}
          totalCounts={totalCounts}
        />
      )}
    </Layout>
  )
}
