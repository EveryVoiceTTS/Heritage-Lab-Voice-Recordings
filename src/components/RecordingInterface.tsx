import { useState, useEffect, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import type { Category, Prompt, Recording } from '../lib/types'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { saveRecording, deleteRecording } from '../lib/db'
import { saveProgress, saveNotes } from '../lib/api'


interface Props {
  prompts: Prompt[]
  latestPrompt: Record<string, string>
  category: Category
  speakerName: string
  speakerId: number
  onBack: () => void
  onSessionComplete: () => void
}

const BATCH_SIZE = 5

export default function RecordingInterface({ prompts, latestPrompt, category, speakerName, speakerId, onBack, onSessionComplete }: Props) {
  const index = prompts.findIndex(p => p.id === latestPrompt[category]);
  
  const [currentIndex, setCurrentIndex] = useState(index + 1)
  const [recordings, setRecordings] = useState<Map<string, { blob: Blob; url: string }>>(new Map())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState<Map<string, string>>(new Map())
  const audioPlayRef = useRef<HTMLAudioElement | null>(null)

  const {
    isRecording,
    isConverting,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    clearRecording,
    addRecording,
    error,
  } = useAudioRecorder()

  const prompt = prompts[currentIndex]
  const batchStart = Math.floor(currentIndex / BATCH_SIZE) * BATCH_SIZE
  const batchEnd = Math.min(batchStart + BATCH_SIZE, prompts.length)
  const batchPrompts = prompts.slice(batchStart, batchEnd)
  const batchLocalIndex = currentIndex - batchStart

  const batchComplete = batchPrompts.every(
    (p) => recordings.has(p.id) || skipped.has(p.id)
  )

  const batchRecordedCount = batchPrompts.filter(p => recordings.has(p.id)).length

  const hasCurrentRecording = recordings.has(prompt.id)
  const isCurrentSkipped = skipped.has(prompt.id)

  useEffect(() => {
    if (audioBlob && audioUrl && prompt) {
      const rec = { blob: audioBlob, url: audioUrl }
      setRecordings((prev) => new Map(prev).set(prompt.id, rec))
    }
  }, [audioBlob, audioUrl, prompt])

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      stopRecording()
    } else {
      clearRecording()
      await startRecording()
    }
  }, [isRecording, stopRecording, startRecording, clearRecording])

  const handleSkip = useCallback(() => {
    if (isRecording) stopRecording()
    setSkipped((prev) => new Set(prev).add(prompt.id))
    if (currentIndex < batchEnd - 1) {
      clearRecording()
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      const rec = recordings.get(prompts[nextIndex].id)
      if (rec) addRecording(rec?.blob)
      
    }
  }, [isRecording, stopRecording, prompt, currentIndex, batchEnd, clearRecording, addRecording])

  const handlePrev = useCallback(() => {
    if (currentIndex > batchStart) {
      clearRecording()
      const nextIndex = currentIndex - 1
      setCurrentIndex(nextIndex)
      const rec = recordings.get(prompts[nextIndex].id)
      if (rec) addRecording(rec?.blob)
    }
  }, [currentIndex, batchStart, clearRecording, addRecording])

  const handleNext = useCallback(() => {
    if (currentIndex < batchEnd - 1) {
      clearRecording()
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      const rec = recordings.get(prompts[nextIndex].id)
      if (rec) addRecording(rec?.blob)
      
    }
  }, [currentIndex, batchEnd, clearRecording])

  const handleStepClick = (idx: number) => {
    if (isRecording) return
    clearRecording()
    const nextIndex = batchStart + idx
    setCurrentIndex(nextIndex)
    const rec = recordings.get(prompts[nextIndex].id)
    if (rec) addRecording(rec?.blob)
  }

  const sanitize = (s: string) =>
    s.replace(/[^a-zA-Z0-9\u1400-\u167F]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  const handleSubmitBatch = useCallback(async () => {
    const zip = new JSZip();
    const ts = new Date();
    let humanReadableTs = ts.toLocaleString(undefined,{ hour12: false}) //change to format dd-mm-yyyy_hh-mm-ss
        .replace(/\//g, "-")      
        .replace(", ", "_")       
        .replace(/:/g, "-");
    const metadata: Array<Recording> = [];
    const savedRecordingIds: string[] = [];
    for (const p of batchPrompts) {
      const rec = recordings.get(p.id)
      const filename = `${p.id}_${humanReadableTs}_${sanitize(p.romanized)}_${speakerName}.wav`
      if (rec) {
        const recording: Recording = {
          id: `${p.id}_${humanReadableTs}_${sanitize(p.romanized)}_${speakerName}`,
          promptId: p.id,
          category,
          speakerName,
          blob: rec.blob,
          timestamp: humanReadableTs,
          text: p.romanized,
          filename: filename,
        }
        try {
          await saveRecording(recording)
          savedRecordingIds.push(recording.id)
        } catch (e) {
          console.warn('Could not save recording to IndexedDB (quota may be exceeded):', e)
        }
        
        metadata.push(recording);
        zip.file(filename, rec.blob)
        URL.revokeObjectURL(rec.url) //clear recording here instead of at every change
      }
    }
    const metadataString = JSON.stringify(metadata, null, 2);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const metadataFilename = `${humanReadableTs}-${speakerName}-${category}-batch${batchNum}.json`;
    zip.file(metadataFilename, metadataString);
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${humanReadableTs}-${speakerName}-${category}-batch${batchNum}.zip`
    a.click()

    for (const id of savedRecordingIds) {
      deleteRecording(id).catch(() => {})
    }

    try {
      const progressItems = batchPrompts
        .filter(p => recordings.has(p.id))
        .map(p => ({ prompt_id: p.id, category }))
      if (progressItems.length > 0) {
        await saveProgress(speakerId, progressItems)
      }

      const noteItems = batchPrompts
        .filter(p => notes.has(p.id) && notes.get(p.id)!.trim())
        .map(p => ({ prompt_id: p.id, category, note: notes.get(p.id)! }))
      if (noteItems.length > 0) {
        await saveNotes(speakerId, noteItems)
      }
    } catch {
      console.error('Failed to sync progress/notes to server')
    }

    if (batchEnd >= prompts.length) {
      setSubmitted(true)
    } else {
      clearRecording()
      setCurrentIndex(batchEnd)
      setRecordings(new Map())
      setSkipped(new Set())
      setNotes(new Map())
    }
  }, [batchPrompts, recordings, category, batchStart, batchEnd, prompts.length, clearRecording, sanitize])

  const handlePlayRecording = (promptId: string) => {
    const rec = recordings.get(promptId)
    // URL.createObjectURL(rec.blob)
    if (!rec) return

    if (playingId === promptId) {
      audioPlayRef.current?.pause()
      setPlayingId(null)
      return
    }

    if (audioPlayRef.current) {
      audioPlayRef.current.pause()
    }
    const audio = new Audio(rec.url)
    audioPlayRef.current = audio
    setPlayingId(promptId)
    audio.onended = () => setPlayingId(null)
    audio.play()
  }

  const handleReRecord = () => {
    setRecordings((prev) => {
      const next = new Map(prev)
      next.delete(prompt.id)
      return next
    })
    setSkipped((prev) => {
      const next = new Set(prev)
      next.delete(prompt.id)
      return next
    })
    clearRecording()
  }

  const submittingRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && playingId !== prompt.id) {
        e.preventDefault()
        if (hasCurrentRecording) { // Call rerecord methods if recording already exists
          handleReRecord()
        }
        handleRecord()
      }
      if (isRecording){ // Do not allow navigate actions while recording.
        return 
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.code === 'KeyS') {
        e.preventDefault()
        handleSkip()
      } else if (e.code === 'KeyP') {
        e.preventDefault()
        handlePlayRecording(prompt.id)
      } else if (e.code === 'Enter' && batchComplete && !submittingRef.current) {
        e.preventDefault()
        submittingRef.current = true
        handleSubmitBatch().finally(() => { submittingRef.current = false })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleRecord, handleNext, handlePrev, handleSkip, handlePlayRecording, batchComplete, handleSubmitBatch])

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center overflow-y-auto min-h-0 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-cream-dark p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-sage-light/40 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-charcoal mb-2">All Done!</h2>
          <p className="text-charcoal-light mb-6">All recordings for this category have been saved locally.</p>
          <button
            onClick={() => { onSessionComplete(); onBack(); }}
            className="px-6 py-3 bg-forest-dark text-white rounded-xl font-medium hover:bg-charcoal transition-colors cursor-pointer"
          >
            Back to Categories
          </button>
        </div>
      </div>
    )
  }



  const categoryLabels: Record<Category, string> = {
    grammar: 'Grammar Reading',
    words: 'Single Words',
    sentences: 'Short Sentences',
    questions: 'Questions',
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-header */}
      <div className="bg-cream-dark/50 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-charcoal-light hover:text-charcoal transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="text-center">
            <span className="text-sm font-medium text-forest-dark">{categoryLabels[category]}</span>
            <p className="text-xs text-charcoal-light">
              {currentIndex + 1} of {prompts.length} total
            </p>
          </div>
          <div className="w-16" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto min-h-0 p-6">
        <div className="max-w-2xl w-full my-auto">
          {/* Instruction */}
          <p className="text-center text-charcoal-light text-sm mb-4">
            {isRecording
              ? 'Recording... click the mic to stop'
              : isConverting
                ? 'Converting to WAV...'
                : hasCurrentRecording
                  ? 'Recording saved. Play it back or re-record.'
                  : 'Click the mic button then read the text aloud'}
          </p>

          {/* Text Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-cream-dark p-8 mb-8 flex items-center gap-6">
            <div className="flex-1 text-center">
              <p className="text-3xl leading-relaxed text-charcoal mb-3 font-medium font-syllabics" lang="iu">
                {prompt.syllabics}
              </p>
              <p className="text-lg text-charcoal-light italic">
                {prompt.romanized}
              </p>
            </div>

            {/* Step indicators */}
            <div className="flex flex-col gap-2 shrink-0">
              {batchPrompts.map((p, idx) => {
                const isActive = idx === batchLocalIndex
                const hasRec = recordings.has(p.id)
                const wasSkipped = skipped.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => handleStepClick(idx)}
                    className={`
                      w-10 h-10 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center justify-center
                      ${isActive
                        ? 'bg-forest-dark text-white shadow-md'
                        : hasRec
                          ? 'bg-sage-light/50 text-forest-dark hover:bg-sage-light/70'
                          : wasSkipped
                            ? 'bg-mauve/10 text-mauve hover:bg-mauve/20'
                            : 'bg-cream-dark text-charcoal-light hover:bg-sage-light/30'
                      }
                    `}
                  >
                    {hasRec ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : wasSkipped ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm text-center">
              {error}
            </div>
          )}

          {/* Mic button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handleRecord}
              disabled={(hasCurrentRecording && !isRecording) || isConverting}
              className={`
                w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer
                ${isRecording
                  ? 'bg-mauve shadow-lg shadow-mauve/30 animate-pulse'
                  : isConverting
                    ? 'bg-cream-dark animate-pulse cursor-wait'
                    : hasCurrentRecording
                      ? 'bg-cream-dark cursor-not-allowed'
                      : 'bg-forest-dark hover:bg-charcoal shadow-lg shadow-forest-dark/25'
                }
              `}
            >
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </div>

          {/* Playback controls for current recording */}
            <div className="flex justify-center gap-3 mb-8">
              <button
                onClick={() => handlePlayRecording(prompt.id)}
                disabled={ isRecording }
                className={`
                  flex items-center gap-2 px-4 py-2 bg-white border border-cream-dark rounded-xl text-sm text-charcoal
                  ${(isRecording || !hasCurrentRecording) ?'cursor-not-allowed text-charcoal/50 bg-white/50' 
                    :'hover:bg-cream-dark/50 transition-colors cursor-pointer'
                  }
              `}
              >
                {playingId === prompt.id ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Play
                  </>
                )}
              </button>
              <button
                onClick={handleReRecord}
                className={`
                  flex items-center gap-2 px-4 py-2 bg-white border border-cream-dark rounded-xl text-sm text-charcoal
                  ${(isRecording || !hasCurrentRecording) ?'cursor-not-allowed text-charcoal/50 bg-white/50' 
                    :'hover:bg-cream-dark/50 transition-colors cursor-pointer'
                  }
              `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-record
              </button>
            </div>


          {/* Notes */}
          <div className="mb-6">
            <label htmlFor="prompt-note" className="flex items-center gap-1.5 text-xs font-medium text-charcoal-light mb-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Note (optional)
            </label>
            <textarea
              id="prompt-note"
              rows={2}
              value={notes.get(prompt.id) ?? ''}
              onChange={(e) => setNotes(prev => new Map(prev).set(prompt.id, e.target.value))}
              placeholder="Add a note about this recording..."
              className="w-full px-3 py-2 rounded-xl border border-cream-dark bg-white text-sm text-charcoal placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest transition-colors resize-none"
            />
          </div>

          {/* Bottom actions */}
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-charcoal-light">
                {batchRecordedCount} of {batchPrompts.length} recorded
              </div>
              <div className="text-xs text-charcoal-light mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span><kbd className="px-1.5 py-0.5 bg-cream-dark rounded text-[10px] font-mono">Space</kbd> record</span>
                <span><kbd className="px-1.5 py-0.5 bg-cream-dark rounded text-[10px] font-mono">P</kbd> play/pause</span>
                <span><kbd className="px-1.5 py-0.5 bg-cream-dark rounded text-[10px] font-mono">&larr; &rarr;</kbd> navigate</span>
                <span><kbd className="px-1.5 py-0.5 bg-cream-dark rounded text-[10px] font-mono">S</kbd> skip</span>
                <span><kbd className="px-1.5 py-0.5 bg-cream-dark rounded text-[10px] font-mono">Enter</kbd> submit</span>
              </div>
            </div>

            <div className="flex gap-3">
              {!hasCurrentRecording && !isCurrentSkipped && !isRecording && (
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-2 px-5 py-2 text-charcoal-light hover:text-charcoal hover:bg-cream-dark rounded-xl transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Skip
                </button>
              )}

              {(hasCurrentRecording || isCurrentSkipped) && currentIndex < batchEnd - 1 && !isRecording &&(
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2 bg-forest-dark text-white rounded-xl font-medium hover:bg-charcoal transition-colors cursor-pointer"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {batchComplete && (
                <button
                  onClick={handleSubmitBatch}
                  className="px-6 py-2.5 bg-forest-dark text-white rounded-xl font-medium hover:bg-charcoal transition-colors cursor-pointer"
                >
                  {batchEnd >= prompts.length ? 'Submit All' : 'Submit & Next Batch'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
