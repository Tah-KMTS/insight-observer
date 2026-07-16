import { createClient, parseModelJson } from './openaiClient'

const MODEL = 'gpt-5.6'

const EXTRACTION_PROMPT = (videoUrl) => `Open this YouTube video and extract its metadata: ${videoUrl}

Return ONLY a raw JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "title": string,
  "durationSeconds": number,
  "description": string,
  "transcript": string
}

- "durationSeconds" is the video length in whole seconds.
- "transcript" should be the full spoken dialogue/transcript of the video, as accurately as you can retrieve it. If no transcript or captions are available, use an empty string.
Do not include any text before or after the JSON object.`

export function extractVideoId(videoUrl) {
  try {
    const parsed = new URL(videoUrl)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1) || null
    }
    const vParam = parsed.searchParams.get('v')
    if (vParam) return vParam

    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]

    return null
  } catch {
    return null
  }
}

export async function fetchYoutubeMetadata(videoUrl) {
  const client = createClient()

  const response = await client.responses.create({
    model: MODEL,
    tools: [{ type: 'web_search' }],
    input: EXTRACTION_PROMPT(videoUrl),
  })

  const data = parseModelJson(response.output_text)

  return {
    title: data.title || '',
    durationSeconds: Number(data.durationSeconds) || 0,
    description: data.description || '',
    transcript: data.transcript || '',
  }
}
