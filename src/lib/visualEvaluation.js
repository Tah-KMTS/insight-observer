import { createClient } from './openaiClient'

const MODEL = 'gpt-5.6'

const INSTRUCTIONS = `You are analyzing a sequence of webcam snapshots taken while someone watched a video. Each image is labeled with the video timestamp when it was captured, in chronological order.

Write a clear, readable visual evaluation report (plain text, not JSON) with:
1. A short overall summary of the viewer's engagement and reactions.
2. A list of notable moments, each with its timestamp and the observed expression (e.g. "0:45 - smiled, looked amused").

If a face isn't clearly visible in a frame, skip it rather than guessing. Keep the whole report under 300 words.`

export async function generateVisualEvaluation(frames) {
  const client = createClient()

  const content = [
    { type: 'input_text', text: INSTRUCTIONS },
    ...frames.flatMap((frame) => [
      { type: 'input_text', text: `Timestamp: ${frame.time}` },
      { type: 'input_image', image_url: frame.dataUrl },
    ]),
  ]

  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: 'user', content }],
  })

  const text = response.output_text?.trim()
  if (!text) {
    throw new Error('The model returned no output.')
  }
  return text
}
