import { createClient, MODEL } from './openaiClient'

export function buildFinalSynthesisPrompt(metadata, visualEvaluation, chatMessages) {
  const interviewTranscript = chatMessages
    .map((message) => `${message.role === 'user' ? 'Viewer' : 'Interviewer'}: ${message.content}`)
    .join('\n')

  return `Here is everything gathered about a viewer who just watched a YouTube video and was interviewed about their reaction.

VIDEO METADATA
Title: ${metadata.title}
Duration: ${metadata.durationSeconds} seconds
Description: ${metadata.description}
Transcript: ${metadata.transcript}

VISUAL EVALUATION (from webcam analysis while they watched)
${visualEvaluation}

INTERVIEW TRANSCRIPT
${interviewTranscript}

Write a final written sentiment report describing how the viewer felt about the video overall. Integrate what they said in the interview with what was observed visually. Structure it with a short headline sentiment on its own line, then supporting detail in plain paragraphs. Do not use markdown syntax (no #, *, or **) — plain text only. Keep it under 300 words.`
}

export async function generateFinalReport(prompt) {
  const client = createClient()

  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
  })

  const text = response.output_text?.trim()
  if (!text) {
    throw new Error('The model returned no output.')
  }
  return text
}
