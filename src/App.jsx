import { useEffect, useRef, useState } from 'react'
import { extractVideoId, fetchYoutubeMetadata } from './lib/youtube'
import { generateVisualEvaluation } from './lib/visualEvaluation'
import { buildInterviewSystemPrompt, getInterviewReply } from './lib/interview'
import { buildFinalSynthesisPrompt, generateFinalReport } from './lib/finalSynthesis'
import './App.css'

const MAX_FRAMES = 20
const FALLBACK_CAPTURE_INTERVAL_MS = 3000

function formatVideoTime(seconds) {
  const whole = Math.floor(seconds)
  const mm = String(Math.floor(whole / 60)).padStart(2, '0')
  const ss = String(whole % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function App() {
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamStatus, setWebcamStatus] = useState('')
  const [frames, setFrames] = useState([])
  const [recordingUrl, setRecordingUrl] = useState(null)

  const [videoId, setVideoId] = useState(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const [visualEvaluation, setVisualEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [evalStatus, setEvalStatus] = useState('')

  const [interviewStarted, setInterviewStarted] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatStatus, setChatStatus] = useState('')

  const [finalReport, setFinalReport] = useState(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [synthesisStatus, setSynthesisStatus] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const recorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingUrlRef = useRef(null)

  const ytApiReadyRef = useRef(false)
  const ytContainerRef = useRef(null)
  const playerRef = useRef(null)
  const isPlayingRef = useRef(false)
  const metadataRef = useRef(null)

  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return
    if (playerRef.current && !isPlayingRef.current) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    const time = playerRef.current
      ? `video ${formatVideoTime(playerRef.current.getCurrentTime())}`
      : new Date().toLocaleTimeString()
    setFrames((prev) => [...prev, { id: Date.now(), dataUrl, time }].slice(-MAX_FRAMES))
  }

  async function startWebcam() {
    setWebcamStatus('Requesting camera access…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setWebcamActive(true)

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current)
        recordingUrlRef.current = null
        setRecordingUrl(null)
      }
      recordedChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        recordingUrlRef.current = url
        setRecordingUrl(url)
      }
      recorder.start()
      recorderRef.current = recorder

      if (playerRef.current && playerReady) {
        playerRef.current.seekTo(0, true)
        playerRef.current.playVideo()
      }

      const duration = metadataRef.current?.durationSeconds
      const captureIntervalMs = duration
        ? Math.max(2000, Math.round((duration * 1000) / MAX_FRAMES))
        : FALLBACK_CAPTURE_INTERVAL_MS

      const statusSuffix = playerRef.current && playerReady ? ' and playing the trailer from the top' : ''
      setWebcamStatus(`Webcam on — recording your whole reaction${statusSuffix}, capturing up to ${MAX_FRAMES} frames spaced across the video.`)
      intervalRef.current = setInterval(captureFrame, captureIntervalMs)
    } catch (error) {
      setWebcamStatus(error.message || 'Could not access the webcam.')
    }
  }

  function stopWebcam() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    if (!streamRef.current) return

    streamRef.current.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setWebcamActive(false)
    setWebcamStatus('Webcam off.')
  }

  useEffect(
    () => () => {
      stopWebcam()
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current)
    },
    [],
  )

  // Load the YouTube IFrame API once.
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      ytApiReadyRef.current = true
      return
    }
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      ytApiReadyRef.current = true
      previousCallback?.()
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  }, [])

  // Create or reload the player whenever we have a new video ID.
  useEffect(() => {
    if (!videoId) return

    function createOrLoad() {
      if (!ytContainerRef.current) return
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId)
        return
      }
      playerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        width: 480,
        height: 270,
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (event) => {
            const playing = event.data === window.YT.PlayerState.PLAYING
            isPlayingRef.current = playing
            setIsPlaying(playing)
          },
        },
      })
    }

    if (ytApiReadyRef.current) {
      createOrLoad()
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        ytApiReadyRef.current = true
        previousCallback?.()
        createOrLoad()
      }
    }
  }, [videoId])

  useEffect(
    () => () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    },
    [],
  )

  async function handleFetch() {
    if (!url.trim()) {
      setStatus('Paste a YouTube URL first.')
      return
    }

    setLoading(true)
    setStatus('Fetching video metadata…')
    setMetadata(null)
    setFrames([])
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current)
      recordingUrlRef.current = null
    }
    setRecordingUrl(null)
    setVisualEvaluation(null)
    setEvalStatus('')
    setInterviewStarted(false)
    setChatMessages([])
    setChatStatus('')
    setFinalReport(null)
    setSynthesisStatus('')

    try {
      const data = await fetchYoutubeMetadata(url.trim())
      setMetadata(data)
      metadataRef.current = data
      setStatus('Done.')
      setVideoId(extractVideoId(url.trim()))
    } catch (error) {
      console.error(error)
      setStatus(error.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGetVisualEvaluation() {
    setEvaluating(true)
    setEvalStatus('Analyzing captured frames…')
    setVisualEvaluation(null)
    try {
      const text = await generateVisualEvaluation(frames)
      setVisualEvaluation(text)
      setEvalStatus('Done.')
    } catch (error) {
      console.error(error)
      setEvalStatus(error.message || 'Visual evaluation failed.')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleStartInterview() {
    setInterviewStarted(true)
    setChatMessages([])
    setChatStatus('Starting interview…')
    setChatSending(true)
    try {
      const systemPrompt = buildInterviewSystemPrompt(metadata, visualEvaluation)
      const opening = await getInterviewReply(systemPrompt, [
        { role: 'user', content: 'Please start the interview with your first question.' },
      ])
      setChatMessages([{ role: 'assistant', content: opening }])
      setChatStatus('')
    } catch (error) {
      console.error(error)
      setChatStatus(error.message || 'Could not start the interview.')
    } finally {
      setChatSending(false)
    }
  }

  async function handleSendChat() {
    const text = chatInput.trim()
    if (!text) return

    const nextMessages = [...chatMessages, { role: 'user', content: text }]
    setChatMessages(nextMessages)
    setChatInput('')
    setChatSending(true)
    setChatStatus('')
    try {
      const systemPrompt = buildInterviewSystemPrompt(metadata, visualEvaluation)
      const reply = await getInterviewReply(systemPrompt, nextMessages)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (error) {
      console.error(error)
      setChatStatus(error.message || 'Could not get a reply.')
    } finally {
      setChatSending(false)
    }
  }

  async function handleEndChat() {
    setSynthesizing(true)
    setSynthesisStatus('Writing final report…')
    setFinalReport(null)
    try {
      const prompt = buildFinalSynthesisPrompt(metadata, visualEvaluation, chatMessages)
      const report = await generateFinalReport(prompt)
      setFinalReport(report)
      setSynthesisStatus('')
    } catch (error) {
      console.error(error)
      setSynthesisStatus(error.message || 'Final synthesis failed.')
    } finally {
      setSynthesizing(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <div className="masthead">
        <p className="masthead-title">🎬🎙️ Reel Reactions</p>
        <p className="masthead-tag">Movie trailer reactions, unscripted.</p>
      </div>
      <div className="film-strip" />

      <div className="segment-card">
        <p className="segment-eyebrow">🎬 Episode Intake</p>
        <h2 className="segment-heading">Cue the Trailer</h2>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube URL"
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="button" className="btn btn-primary" onClick={handleFetch} disabled={loading}>
            {loading ? 'Fetching…' : 'Fetch Metadata'}
          </button>
        </div>

        <p className="status-line">{status}</p>

        {metadata && (
          <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
            <h3>{metadata.title}</h3>
            <p>Duration: {metadata.durationSeconds} seconds</p>
            <p><strong>Description:</strong> {metadata.description}</p>
            <p>
              <strong>Transcript ({metadata.transcript.length} chars):</strong>
              <br />
              {metadata.transcript.slice(0, 500)}
              {metadata.transcript.length > 500 ? '…' : ''}
            </p>
          </div>
        )}

        {videoId && (
          <div style={{ marginTop: '1rem' }}>
            <div ref={ytContainerRef} />
            <p className="status-line">
              {playerReady ? (isPlaying ? 'Video playing.' : 'Video paused.') : 'Loading player…'}
            </p>
          </div>
        )}
      </div>

      <div className="segment-card">
        <p className="segment-eyebrow">📼 Reaction Cam</p>
        <h2 className="segment-heading">Roll Camera</h2>

        <p style={{ fontSize: '0.85rem' }}>
          Watch the video with your webcam on. Up to {MAX_FRAMES} frames are captured, spaced across the video's
          duration, only while it's playing.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn" onClick={startWebcam} disabled={webcamActive}>
            🔴 Start Webcam
          </button>
          <button type="button" className="btn" onClick={stopWebcam} disabled={!webcamActive}>
            ⏹ Stop Webcam
          </button>
        </div>

        <p className="status-line">{webcamStatus}</p>

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', maxWidth: 480, display: webcamActive ? 'block' : 'none', margin: '1rem 0' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {recordingUrl && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Your whole reaction clip</h3>
            <video src={recordingUrl} controls style={{ width: '100%', maxWidth: 480, borderRadius: 6 }} />
          </div>
        )}

        {frames.length > 0 && (
          <div>
            <h3>Captured frames ({frames.length}/{MAX_FRAMES})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {frames.map((frame) => (
                <div key={frame.id}>
                  <img src={frame.dataUrl} alt={`Frame at ${frame.time}`} style={{ width: 100, borderRadius: 4 }} />
                  <p style={{ fontSize: '0.7rem', textAlign: 'center' }}>{frame.time}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGetVisualEvaluation}
              disabled={evaluating}
              style={{ marginTop: '0.5rem' }}
            >
              {evaluating ? 'Evaluating…' : 'Get Visual Evaluation'}
            </button>
            <p className="status-line">{evalStatus}</p>
          </div>
        )}

        {visualEvaluation && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {visualEvaluation}
          </div>
        )}
      </div>

      <div className="podcast-card">
        <div className="podcast-header">
          {videoId && (
            <img
              className="podcast-cover"
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt="Episode cover art"
            />
          )}
          <div className="podcast-meta">
            <p className="podcast-eyebrow">🎙️ Reel Reactions Podcast</p>
            <h3 className="podcast-title">{metadata ? `${metadata.title} — Reaction Episode` : 'Untitled Episode'}</h3>
            {interviewStarted && !finalReport && <span className="on-air-badge">● ON AIR</span>}
          </div>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleStartInterview} disabled={!visualEvaluation || chatSending}>
          🎬 Start Interview
        </button>
        <p className="status-line">{chatStatus}</p>

        {interviewStarted && (
          <div style={{ marginTop: '1rem' }}>
            <div className="podcast-chat">
              {chatMessages.map((message, index) => (
                <div key={index} className={`podcast-bubble ${message.role === 'user' ? 'guest' : 'host'}`}>
                  <span className="podcast-speaker">{message.role === 'user' ? '🗣️ You' : '🎙️ Host'}</span>
                  {message.content}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChat()
                }}
                placeholder="Type your reply…"
                style={{ flex: 1, padding: '0.5rem' }}
                disabled={chatSending}
              />
              <button type="button" className="btn" onClick={handleSendChat} disabled={chatSending}>
                Send
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEndChat}
              disabled={chatMessages.length === 0 || synthesizing}
              style={{ marginTop: '0.75rem' }}
            >
              🎬 Wrap the Episode
            </button>
            <p className="status-line">{synthesisStatus}</p>
          </div>
        )}
      </div>

      <div className="segment-card">
        <p className="segment-eyebrow">📝 Show Notes</p>
        <h2 className="segment-heading">Wrap-Up Report</h2>

        {finalReport ? (
          <div
            style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {finalReport}
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem' }}>Finish an interview and click "Wrap the Episode" to generate the final report.</p>
        )}
      </div>
    </div>
  )
}

export default App
