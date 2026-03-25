import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const AI_ENV = {
  provider: process.env.AI_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
};

const LlmKeyResultSchema = z.object({
  title: z.string().min(8).max(160),
  target_value: z.number().finite().positive(),
  unit: z.string().min(1).max(32),
  weight: z.number().finite().min(0.05).max(1),
  due_date: z.string().date(), // YYYY-MM-DD
  evaluation: z.object({
    fit_score: z.number().int().min(0).max(100),
    fit_reason: z.string().min(1).max(600),
    issues: z.array(z.string().min(1).max(120)).max(8),
  }),
});

const LlmResponseSchema = z.object({
  suggestions: z.array(LlmKeyResultSchema).min(1).max(10),
  overall_feedback: z.string().min(1).max(900),
});

function buildPrompt({ objective, cycle, unit, existingKeyResults, input }) {
  const lang = input.language === "en" ? "English" : "Vietnamese";
  const dueDateHint = input.constraints?.due_date || cycle?.end_date || null;
  const unitHint = input.constraints?.unit || null;

  const context = {
    objective: {
      id: objective.id,
      title: objective.title,
      status: objective.status,
      visibility: objective.visibility,
      progress_percentage: objective.progress_percentage,
    },
    cycle: cycle
      ? {
          id: cycle.id,
          name: cycle.name,
          start_date: cycle.start_date,
          end_date: cycle.end_date,
        }
      : null,
    unit: unit ? { id: unit.id, name: unit.name } : null,
    existing_key_results: existingKeyResults.map((kr) => ({
      id: kr.id,
      title: kr.title,
      unit: kr.unit,
      target_value: kr.target_value,
      due_date: kr.due_date,
    })),
    generation_hints: {
      count: input.count,
      language: lang,
      due_date_hint: dueDateHint,
      unit_hint: unitHint,
    },
  };

  return [
    `You are an OKR coach helping generate measurable Key Results for a single Objective.`,
    `Return ONLY valid JSON (no markdown, no code fences).`,
    ``,
    `Requirements:`,
    `- Generate exactly ${input.count} Key Results that are measurable and non-overlapping.`,
    `- Each Key Result must be strongly aligned with the Objective and realistically achievable within the cycle.`,
    `- Avoid duplicating or rephrasing existing key results.`,
    `- Use ${lang} for all natural language fields.`,
    `- Weight: each between 0.05 and 1.0; sum of all weights should be approximately 1.0 (±0.05).`,
    `- due_date must be within cycle end date if available; otherwise use the due_date_hint; otherwise choose a reasonable date within 90 days.`,
    `- Include an evaluation for each Key Result (fit_score 0-100, fit_reason, issues).`,
    ``,
    `JSON shape:`,
    `{"suggestions":[{"title": "...","target_value": 0,"unit":"...","weight": 0.2,"due_date":"YYYY-MM-DD","evaluation":{"fit_score": 0,"fit_reason":"...","issues":["..."]}}],"overall_feedback":"..."}`,
    ``,
    `Context JSON:`,
    JSON.stringify(context),
  ].join("\n");
}

function parseJsonFromText(text, labelForError = "AI provider") {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new AppError(`${labelForError} returned empty content`, 502);
  try {
    return JSON.parse(trimmed);
  } catch {
    // Sometimes models wrap JSON with extra characters; try to extract the first JSON object.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(`${labelForError} returned non-JSON content`, 502);
    try {
      return JSON.parse(match[0]);
    } catch {
      throw new AppError(`${labelForError} returned non-JSON content`, 502);
    }
  }
}

async function callOpenAiJson(prompt) {
  if (!AI_ENV.openaiApiKey) {
    throw new AppError("Missing OPENAI_API_KEY", 500);
  }

  const resp = await fetch(`${AI_ENV.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_ENV.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_ENV.openaiModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: "You output strict JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new AppError(`AI provider error: ${resp.status} ${text}`.slice(0, 500), 502);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AppError("AI provider returned empty content", 502);
  }

  let json;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AppError("AI provider returned non-JSON content", 502);
  }
  return json;
}

async function callGeminiJson(prompt) {
  if (!AI_ENV.geminiApiKey) {
    throw new AppError("Missing GEMINI_API_KEY", 500);
  }

  const ai = new GoogleGenAI({ apiKey: AI_ENV.geminiApiKey });

  const maxAttempts = Number(process.env.GEMINI_MAX_ATTEMPTS || 3);

  // Gemini sometimes returns transient errors (e.g. 503 UNAVAILABLE: high demand).
  // Retry with exponential backoff to make local testing more stable.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: AI_ENV.geminiModel,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      });

      const text = typeof resp?.text === "string" ? resp.text : "";
      return parseJsonFromText(text, "Gemini");
    } catch (err) {
      const status = err?.status ?? err?.code ?? null;
      const message = String(err?.message ?? "");
      const isUnavailable = status === 503 || /UNAVAILABLE|high demand/i.test(message);
      const isRateLimited = status === 429 || /rate/i.test(message);

      const retryable = isUnavailable || isRateLimited;
      const shouldRetry = retryable && attempt < maxAttempts;
      if (!shouldRetry) throw err;

      const baseMs = 1000;
      const backoffMs = Math.min(8000, baseMs * 2 ** (attempt - 1));
      // Add small jitter to reduce thundering herd if many requests happen.
      const jitterMs = Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }

  // Should never reach here.
  throw new AppError("Gemini call failed after retries", 502);
}

async function callLlm(prompt) {
  if (AI_ENV.provider === "openai") return callOpenAiJson(prompt);
  if (AI_ENV.provider === "gemini") return callGeminiJson(prompt);
  throw new AppError(`Unsupported AI_PROVIDER: ${AI_ENV.provider}`, 500);
}

function normalizeWeights(suggestions) {
  const sum = suggestions.reduce((acc, s) => acc + (Number.isFinite(s.weight) ? s.weight : 0), 0);
  if (sum <= 0) return suggestions;
  return suggestions.map((s) => ({ ...s, weight: Math.round((s.weight / sum) * 1000) / 1000 }));
}

export async function generateKeyResultsForObjective({ objectiveId, companyId, input }) {
  if (!companyId) throw new AppError("Unauthorized", 401);

  const objective = await prisma.objectives.findFirst({
    where: { id: objectiveId, company_id: companyId },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      progress_percentage: true,
      cycle_id: true,
      unit_id: true,
    },
  });

  if (!objective) throw new AppError("Objective not found", 404);

  const [cycle, unit, existingKeyResults] = await Promise.all([
    prisma.cycles.findFirst({
      where: { id: objective.cycle_id, company_id: companyId },
      select: { id: true, name: true, start_date: true, end_date: true },
    }),
    prisma.units.findFirst({
      where: { id: objective.unit_id, company_id: companyId },
      select: { id: true, name: true },
    }),
    prisma.keyResults.findMany({
      where: { objective_id: objective.id, company_id: companyId },
      select: { id: true, title: true, unit: true, target_value: true, due_date: true },
      orderBy: { id: "asc" },
      take: 50,
    }),
  ]);

  const prompt = buildPrompt({ objective, cycle, unit, existingKeyResults, input });

  // Try once; if the model returns invalid shape, retry with a stricter instruction.
  let parsed;
  try {
    parsed = LlmResponseSchema.parse(await callLlm(prompt));
  } catch (e) {
    const retryPrompt = `${prompt}\n\nIMPORTANT: Output must match the JSON shape exactly. Do not add extra keys.`;
    parsed = LlmResponseSchema.parse(await callLlm(retryPrompt));
  }

  const suggestions = normalizeWeights(parsed.suggestions).map((s) => ({
    title: s.title,
    target_value: s.target_value,
    unit: s.unit,
    weight: s.weight,
    due_date: s.due_date,
    evaluation: s.evaluation,
  }));

  return {
    objective: { id: objective.id, title: objective.title },
    suggestions,
    overall_feedback: parsed.overall_feedback,
  };
}

export async function generateTestKeyResults({ input }) {
  // Minimal context for test: no objectiveId/companyId/cycle/unit.
  const objective = {
    id: 0,
    title: input.objective,
    status: "active",
    visibility: "private",
    progress_percentage: 0,
  };

  const cycle = null;
  const unit = null;
  const existingKeyResults = [];

  const prompt = buildPrompt({ objective, cycle, unit, existingKeyResults, input });

  // Try once; if the model returns invalid shape, retry with a stricter instruction.
  let parsed;
  try {
    parsed = LlmResponseSchema.parse(await callLlm(prompt));
  } catch (e) {
    const retryPrompt = `${prompt}\n\nIMPORTANT: Output must match the JSON shape exactly. Do not add extra keys.`;
    parsed = LlmResponseSchema.parse(await callLlm(retryPrompt));
  }

  const suggestions = normalizeWeights(parsed.suggestions).map((s) => ({
    title: s.title,
    target_value: s.target_value,
    unit: s.unit,
    weight: s.weight,
    due_date: s.due_date,
    evaluation: s.evaluation,
  }));

  return {
    objective: { id: objective.id, title: objective.title },
    suggestions,
    overall_feedback: parsed.overall_feedback,
  };
}

