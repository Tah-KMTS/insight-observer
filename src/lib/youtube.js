import OpenAI from 'openai'

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
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Add your API key to .env as VITE_OPENAI_API_KEY, then restart npm run dev.')
  }

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.responses.create({
    model: MODEL,
    tools: [{ type: 'web_search' }],
    input: EXTRACTION_PROMPT(videoUrl),
  })

  const text = response.output_text?.trim()
  if (!text) {
    throw new Error('The model returned no output.')
  }

  const jsonText = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let data
  try {
    data = JSON.parse(jsonText)
  } catch (err) {
    throw new Error(`Could not parse the model's response as JSON: ${err.message}\n\nRaw response: ${text.slice(0, 300)}`)
  }

  return {
    title: data.title || '',
    durationSeconds: Number(data.durationSeconds) || 0,
    description: data.description || '',
    transcript: data.transcript || '',
  }
}
