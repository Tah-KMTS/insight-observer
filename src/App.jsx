import { useEffect, useRef, useState } from 'react'
import { fetchYoutubeMetadata } from './lib/youtube'
import './App.css'

const CAPTURE_INTERVAL_MS = 3000
const MAX_FRAMES = 8

function App() {
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamStatus, setWebcamStatus] = useState('')
  const [frames, setFrames] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setFrames((prev) => [...prev, { id: Date.now(), dataUrl, time: new Date().toLocaleTimeString() }].slice(-MAX_FRAMES))
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

      <h1>Step 2: Webcam Capture</h1>

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
          <h3>Captured frames</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {frames.map((frame) => (
              <div key={frame.id}>
                <img src={frame.dataUrl} alt={`Frame at ${frame.time}`} style={{ width: 120, borderRadius: 4 }} />
                <p style={{ fontSize: '0.75rem', textAlign: 'center' }}>{frame.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
