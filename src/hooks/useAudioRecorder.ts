import { useState, useRef, useCallback } from 'react'
import { blobToWav } from '../lib/wav'

interface UseAudioRecorderReturn {
  isRecording: boolean
  isConverting: boolean
  audioBlob: Blob | null
  audioUrl: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  clearRecording: () => void
  addRecording: (blob:Blob) => void
  error: string | null
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 96000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const rawBlob = new Blob(chunksRef.current, { type: mimeType })

        setIsConverting(true)
        try {
          const wavBlob = await blobToWav(rawBlob)
          setAudioBlob(wavBlob)
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
          const url = URL.createObjectURL(wavBlob)
          audioUrlRef.current = url
          setAudioUrl(url)
        } catch (err) {
          console.error('WAV conversion failed, using original format:', err)
          setAudioBlob(rawBlob)
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
          const url = URL.createObjectURL(rawBlob)
          audioUrlRef.current = url
          setAudioUrl(url)
        } finally {
          setIsConverting(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to record.')
      console.error('Recording error:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const clearRecording = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    setAudioBlob(null)
    setAudioUrl(null)
  }, [])


  const addRecording = useCallback((blob: Blob) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    const url2 = URL.createObjectURL(blob)
    audioUrlRef.current = url2
    setAudioBlob(blob)
    setAudioUrl(url2)
  }, [])


  return {
    isRecording,
    isConverting,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    clearRecording,
    addRecording,
    error,
  }
}
