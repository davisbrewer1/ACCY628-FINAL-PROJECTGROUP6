export interface WorkSummaryResult {
  summary: string;
  provider: "openai" | "local";
}

const SYSTEM_PROMPT = `You are an assistant for Nexus Technology Solutions technicians.
Rewrite technician field notes into a customer-friendly work summary.

Rules:
- Be concise and professional
- Use short paragraphs or bullet points
- Avoid internal jargon, tool nicknames, and billing language
- Do not invent work that was not mentioned
- Focus on what was done, the outcome, and any next steps for the customer
- Return only the summary text with no preamble`;

function cleanNotes(notes: string): string {
  return notes.replace(/\r\n/g, "\n").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n•\-]+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function polishSentence(sentence: string): string {
  let value = sentence
    .replace(/\b(w\/)\b/gi, "with")
    .replace(/\b(r&r|rnr)\b/gi, "removed and replaced")
    .replace(/\b(cfg)\b/gi, "configuration")
    .replace(/\b(rebooted|rb)\b/gi, "restarted")
    .replace(/\b(cust)\b/gi, "customer")
    .replace(/\b(svc)\b/gi, "service")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return value;
  value = value.charAt(0).toUpperCase() + value.slice(1);
  if (!/[.!?]$/.test(value)) {
    value += ".";
  }
  return value;
}

/** Local fallback when no AI API key is configured. */
export function generateLocalWorkSummary(notes: string): string {
  const cleaned = cleanNotes(notes);
  if (!cleaned) {
    return "";
  }

  const sentences = splitSentences(cleaned).map(polishSentence).filter(Boolean);
  if (sentences.length === 0) {
    return "Completed the requested support work and confirmed the issue was resolved.";
  }

  if (sentences.length === 1) {
    return sentences[0];
  }

  const bullets = sentences
    .slice(0, 6)
    .map((sentence) => `- ${sentence}`)
    .join("\n");

  return `Work completed:\n${bullets}`;
}

async function generateOpenAiSummary(notes: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Technician notes:\n${cleanNotes(notes)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI provider error (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI returned an empty summary.");
  }
  return content;
}

/**
 * Generate a polished work summary.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise uses the local fallback.
 */
export async function generateWorkSummary(
  notes: string,
): Promise<WorkSummaryResult> {
  const cleaned = cleanNotes(notes);
  if (!cleaned) {
    throw new Error("Enter technician notes before generating a summary.");
  }

  if (process.env.OPENAI_API_KEY) {
    const summary = await generateOpenAiSummary(cleaned);
    return { summary, provider: "openai" };
  }

  return {
    summary: generateLocalWorkSummary(cleaned),
    provider: "local",
  };
}
