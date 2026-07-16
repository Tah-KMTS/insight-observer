import { useEffect, useRef, useState } from 'react'
import { extractVideoId, fetchYoutubeMetadata } from './lib/youtube'
import { analyzeReactionFrame } from './lib/analysis'
import './App.css'

const CAPTURE_INTERVAL_MS = 3000
const MAX_FRAMES = 8

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

  const [videoId, setVideoId] = useState(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  const ytApiReadyRef = useRef(false)
  const ytContainerRef = useRef(null)
  const playerRef = useRef(null)
  const isPlayingRef = useRef(false)

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
    setFrames((prev) => [...prev, { id: Date.now(), dataUrl, time, analysis: null }].slice(-MAX_FRAMES))
  }

  function updateFrame(id, patch) {
    setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, ...patch } : frame)))
  }

  async function handleAnalyze(frame) {
    updateFrame(frame.id, { analysis: 'pending' })
    try {
      const result = await analyzeReactionFrame(frame.dataUrl)
      updateFrame(frame.id, { analysis: result })
    } catch (error) {
      console.error(error)
      updateFrame(frame.id, { analysis: { error: error.message || 'Analysis failed.' } })
    }
  }

  async function startWebcam() {
    setWebcamStatus('Requesting camera access…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setWebcamActive(true)
      setWebcamStatus('Webcam on — capturing a frame every 3s.')
      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)
    } catch (error) {
      setWebcamStatus(error.message || 'Could not access the webcam.')
    }
  }

  function stopWebcam() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (!streamRef.current) return

    streamRef.current.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setWebcamActive(false)
    setWebcamStatus('Webcam off.')
  }

  useEffect(() => stopWebcam, [])

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
      setPlayerReady((ready) => ready)
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

    try {
      const data = await fetchYoutubeMetadata(url.trim())
      setMetadata(data)
      setStatus('Done.')
      setVideoId(extractVideoId(url.trim()))
    } catch (error) {
      console.error(error)
      setStatus(error.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <h1>Insight Observer — Step 1: YouTube Metadata</h1>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="button" onClick={handleFetch} disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch Metadata'}
        </button>
      </div>

      <p>{status}</p>

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
          <p style={{ fontSize: '0.85rem' }}>
            {playerReady ? (isPlaying ? 'Video playing.' : 'Video paused.') : 'Loading player…'}
          </p>
        </div>
      )}

      <h1>Step 2/3: Webcam Capture Synced to Video</h1>

      <p style={{ fontSize: '0.85rem' }}>
        {videoId
          ? 'Frames capture only while the video is playing, tagged with the video timestamp.'
          : 'Fetch a video above to tag frames with video time; without one, capture just runs on a timer.'}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={startWebcam} disabled={webcamActive}>
          Start Webcam
        </button>
        <button type="button" onClick={stopWebcam} disabled={!webcamActive}>
          Stop Webcam
        </button>
      </div>

      <p>{webcamStatus}</p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', maxWidth: 480, display: webcamActive ? 'block' : 'none', margin: '1rem 0' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {frames.length > 0 && (
        <div>
          <h1>Step 4: Reaction Analysis</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {frames.map((frame) => (
              <div key={frame.id} style={{ width: 140 }}>
                <img src={frame.dataUrl} alt={`Frame at ${frame.time}`} style={{ width: 140, borderRadius: 4 }} />
                <p style={{ fontSize: '0.75rem', textAlign: 'center' }}>{frame.time}</p>
                <button
                  type="button"
                  onClick={() => handleAnalyze(frame)}
                  disabled={frame.analysis === 'pending'}
                  style={{ width: '100%' }}
                >
                  {frame.analysis === 'pending' ? 'Analyzing…' : 'Analyze'}
                </button>
                {frame.analysis && frame.analysis !== 'pending' && (
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {frame.analysis.error ? (
                      <span style={{ color: 'tomato' }}>{frame.analysis.error}</span>
                    ) : (
                      <>
                        <strong>{frame.analysis.emotion}</strong>
                        <br />
                        {frame.analysis.note}
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
