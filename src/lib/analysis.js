import { createClient, parseModelJson } from './openaiClient'

const MODEL = 'gpt-5.6'

const ANALYSIS_PROMPT = `This is a webcam snapshot of someone watching a video. Describe their visible emotional reaction.

Return ONLY a raw JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "emotion": string,
  "note": string
}

- "emotion" is a 1-3 word label (e.g. "smiling, amused", "neutral, focused", "confused, brow furrowed").
- "note" is one short sentence describing their expression or body language.
- If no face is clearly visible, set "emotion" to "no face visible" and explain briefly in "note".
Do not include any text before or after the JSON object.`

export async function analyzeReactionFrame(frameDataUrl) {
  const client = createClient()

  const response = await client.responses.create({
    model: MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: ANALYSIS_PROMPT },
          { type: 'input_image', image_url: frameDataUrl },
        ],
      },
    ],
  })

  const data = parseModelJson(response.output_text)

  return {
    emotion: data.emotion || '',
    note: data.note || '',
  }
}
