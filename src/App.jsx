import { useState } from 'react'
import { fetchYoutubeMetadata } from './lib/youtube'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

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
    </div>
  )
}

export default App
