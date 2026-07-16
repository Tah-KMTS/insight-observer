import OpenAI from 'openai'

export function createClient() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Add your API key to .env as VITE_OPENAI_API_KEY, then restart npm run dev.')
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
}

export function parseModelJson(text) {
  if (!text?.trim()) {
    throw new Error('The model returned no output.')
  }

  const jsonText = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  try {
    return JSON.parse(jsonText)
  } catch (err) {
    throw new Error(`Could not parse the model's response as JSON: ${err.message}\n\nRaw response: ${text.slice(0, 300)}`)
  }
}
