import { createClient } from './openaiClient'

const MODEL = 'gpt-5.6'

export function buildInterviewSystemPrompt(metadata, visualEvaluation) {
  return `You are interviewing someone right after they watched this YouTube video:

Title: ${metadata.title}
Duration: ${metadata.durationSeconds} seconds
Description: ${metadata.description}
Transcript: ${metadata.transcript}

While they watched, a webcam captured their reactions. Here is the visual evaluation of those reactions:

${visualEvaluation}

Interview them about the video: ask what they liked and disliked, and reference specific facial expressions or moments from the visual evaluation above, citing the timestamp (e.g. "I noticed you smiled around 0:45 — what caused that?"). Ask one question at a time. Keep questions short and conversational.`
}

export async function getInterviewReply(systemPrompt, messages) {
  const client = createClient()

  const response = await client.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: messages.map((message) => ({ role: message.role, content: message.content })),
  })

  const text = response.output_text?.trim()
  if (!text) {
    throw new Error('The model returned no output.')
  }
  return text
}
