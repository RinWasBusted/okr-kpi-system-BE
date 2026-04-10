import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { canViewObjective } from "../../utils/okr.js";
import { getUnitPath } from "../../utils/path.js";
import { UserRole, AIPlan, KPIEvaluationType } from "@prisma/client";
import 'dotenv/config'

const AI_ENV = {
  provider: process.env.AI_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  openrouterApiKey: process.env.OPENROUTER_API_KEY || null,
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions",
  openrouterModel: process.env.OPENROUTER_MODEL || "gpt-4.1-mini",
  payAsYouGoPricePer1M: parseFloat(process.env.AI_PAY_AS_YOU_GO_PRICE_PER_1M_TOKENS || "0.5"),
};

const LlmKeyResultSchema = z.object({
  title: z.string().min(8).max(160),
  target_value: z.number().finite().positive(),
  start_value: z.number().finite().default(0),
  unit: z.string().min(1).max(32),
  weight: z.number(),
  due_date: z.string().date(), // YYYY-MM-DD
  evaluation_method: z.enum(["MAXIMIZE", "MINIMIZE", "TARGET"]),
  evaluation: z.object({
    fit_score: z.number().int().min(0).max(100),
    fit_reason: z.string().min(1).max(600),
    issues: z.array(z.string().min(1).max(120)).max(8),
  }),
});

const LlmOverallFeedbackSchema = z.object({
  summary: z.string().min(1).max(400),
  alignment_analysis: z.string().min(1).max(400),
  risks: z.array(z.string().min(1).max(200)).max(5),
  recommendations: z.array(z.string().min(1).max(200)).max(5),
});

const LlmResponseSchema = z.object({
  suggestions: z.array(LlmKeyResultSchema).min(1).max(10),
  overall_feedback: LlmOverallFeedbackSchema,
});

// function logTokenUsage(provider, model, usage = {}) {
//   const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? null;
//   const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? null;
//   const totalTokens = usage.total_tokens ?? usage.totalTokenCount ?? null;

//   console.log("[AI Token Usage]", {
//     provider,
//     model,
//     input_tokens: inputTokens,
//     output_tokens: outputTokens,
//     total_tokens: totalTokens,
//   });
// }

function buildPrompt({ objective, cycle, unit, existingKeyResults, visibleObjectives, input, owner, parentObjective }) {
  const lang = input.language === "en" ? "English" : "Vietnamese";
  // due_date priority: user hint first, then cycle end date, then null
  const dueDateHint = input.constraints?.due_date || null;
  const unitHint = input.constraints?.unit || null;
  const additionalContext = input.constraints?.context || null;

  // Calculate remaining weight budget from existing KRs
  const existingTotalWeight = existingKeyResults.reduce(
    (sum, kr) => sum + (Number.isFinite(kr.weight) ? kr.weight : 0),
    0
  );
  const remainingWeight = Math.max(0, 1.0 - existingTotalWeight);

  const context = {
    objective: {
      id: objective.id,
      title: objective.title,
      status: objective.status,
      visibility: objective.visibility,
      progress_percentage: objective.progress_percentage,
      owner_job_title: owner?.job_title || null,
      parent_objective_title: parentObjective?.title || null,
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
      start_value: kr.start_value ?? 0,
      due_date: kr.due_date,
      weight: kr.weight,
      evaluation_method: kr.evaluation_method || "MAXIMIZE",
    })),
    related_objectives: (visibleObjectives || []).map((obj) => ({
      id: obj.id,
      title: obj.title,
      status: obj.status,
      visibility: obj.visibility,
      progress_percentage: obj.progress_percentage,
      unit_id: obj.unit_id,
      owner_id: obj.owner_id,
    })),
    generation_hints: {
      count: input.count,
      language: lang,
      due_date_hint: dueDateHint,
      unit_hint: unitHint,
      remaining_weight_budget: remainingWeight,
      evaluation_method_hint: input.constraints?.evaluation_method || null,
    },
    additional_context: additionalContext,
  };

  const contextInstruction = additionalContext
    ? `\nAdditional User Context:\n"""\n${additionalContext}\n"""\nUse this additional context to better understand the user's intent, business domain, constraints, or specific requirements when generating Key Results.`
    : "";

  return [
    `You are an OKR coach helping generate measurable Key Results for a single Objective.`,
    `Return ONLY valid JSON (no markdown, no code fences).`,
    ``,
    `Requirements:`,
    `- Generate exactly ${input.count} Key Results that are measurable and non-overlapping.`,
    `- Each Key Result must be strongly aligned with the Objective and realistically achievable within the cycle.`,
    `- Avoid duplicating or rephrasing existing key results.`,
    `- Use ${lang} for all natural language fields.`,
    `- Total weight of NEW suggestions must not exceed remaining_weight_budget (= ${remainingWeight.toFixed(2)}).`,
    `- If there are no existing key results, total weight of new suggestions should be approximately 100 (±5).`,
    `- due_date: Use due_date_hint if provided (must be on or before cycle.end_date if cycle exists); otherwise choose a reasonable date within 90 days.`,
    `- evaluation_method: choose "MAXIMIZE" (higher is better), "MINIMIZE" (lower is better), or "TARGET" (hit a specific value) based on the nature of each KR.`,
    `- start_value: use context clues from the objective and related objectives. If no clues, default to 0.`,
    `- If parent_objective exists, ensure KRs cascade down from it logically.`,
    `- Include an evaluation for each Key Result (fit_score 0-100, fit_reason, issues).`,
    contextInstruction,
    ``,
    `JSON shape:`,
    `{"suggestions":[{"title": "...","target_value": 0,"start_value": 0,"unit":"...","weight": "...","due_date":"YYYY-MM-DD","evaluation_method":"MAXIMIZE|MINIMIZE|TARGET","evaluation":{"fit_score": 0,"fit_reason":"...","issues":["..."]}}],"overall_feedback":{"summary":"...","alignment_analysis":"...","risks":["..."],"recommendations":["..."]}}`,
    ``,
    `Context JSON:`,
    JSON.stringify(context),
  ].filter(Boolean).join("\n");
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

  // Extract usage info from OpenAI response
  const usage = {
    input_tokens: data?.usage?.prompt_tokens ?? 0,
    output_tokens: data?.usage?.completion_tokens ?? 0,
    total_tokens: data?.usage?.total_tokens ?? 0,
  };

  return { json, usage };
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
      const json = parseJsonFromText(text, "Gemini");

      // Extract usage info from Gemini response (if available)
      const usage = {
        input_tokens: resp?.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: resp?.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: resp?.usageMetadata?.totalTokenCount ?? 0,
      };

      return { json, usage };
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

async function callOpenRouterJson(prompt) {
  if (!AI_ENV.openrouterApiKey) {
    throw new AppError("Missing OPENROUTER_API_KEY", 500);
  }

  const resp = await fetch(AI_ENV.openrouterBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_ENV.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_ENV.openrouterModel,
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

  // Extract usage info from OpenRouter response
  const usage = {
    input_tokens: data?.usage?.prompt_tokens ?? 0,
    output_tokens: data?.usage?.completion_tokens ?? 0,
    total_tokens: data?.usage?.total_tokens ?? 0,
  };

  return { json, usage };
}

async function callLlm(prompt) {
  if (AI_ENV.provider === "openai") return callOpenAiJson(prompt);
  if (AI_ENV.provider === "gemini") return callGeminiJson(prompt);
  if (AI_ENV.provider === "openrouter") return callOpenRouterJson(prompt);
  throw new AppError(`Unsupported AI_PROVIDER: ${AI_ENV.provider}`, 500);
}

function calculateCreditCost(totalTokens) {
  return (totalTokens / 1000000) * AI_ENV.payAsYouGoPricePer1M;
}

function normalizeWeights(suggestions, maxTotalWeight = 1.0) {
  const sum = suggestions.reduce((acc, s) => acc + (Number.isFinite(s.weight) ? s.weight : 0), 0);
  if (sum <= 0) return suggestions;
  // Normalize to fit within maxTotalWeight budget
  const scale = maxTotalWeight / sum;
  return suggestions.map((s) => ({
    ...s,
    weight: Math.round(s.weight * scale * 1000) / 1000,
  }));
}

// Get list of objective IDs visible to user (for context filtering)
const getVisibleObjectiveIdsForUser = async (user) => {
  if (user.role === UserRole.ADMIN_COMPANY) return null;

  const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;

  if (!userPath) {
    const rows = await prisma.$queryRaw`
      SELECT id
      FROM "Objectives"
      WHERE (
          visibility = 'PUBLIC'
          OR (visibility = 'PRIVATE' AND owner_id = ${user.id})
        )
    `;
    return rows.map((row) => row.id);
  }

  const rows = await prisma.$queryRaw`
    SELECT id
    FROM "Objectives"
    WHERE (
        visibility = 'PUBLIC'
        OR (
            visibility = 'INTERNAL'
            AND (access_path <@ ${userPath}::ltree OR access_path @> ${userPath}::ltree)
        )
        OR (
            visibility = 'PRIVATE'
            AND (
                owner_id = ${user.id}
                OR (access_path <@ ${userPath}::ltree AND access_path <> ${userPath}::ltree)
            )
        )
      )
  `;

  return rows.map((row) => row.id);
};

export async function generateKeyResultsForObjective({ objectiveId, user, input }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Get company for AI usage tracking
  if (!user.company_id) {
    throw new AppError("Company not found", 404);
  }

  const company = await prisma.companies.findUnique({
    where: { id: user.company_id },
  });

  if (!company) {
    throw new AppError("Company not found", 404);
  }

  // Check AI plan and usage limits (best-effort pre-check)
  if (company.ai_plan === AIPlan.FREE || company.ai_plan === AIPlan.SUBSCRIPTION) {
    if (company.token_usage >= company.usage_limit) {
      throw new AppError("AI usage limit exceeded. Please upgrade your plan.", 403);
    }
  }

  const objective = await prisma.objectives.findFirst({
    where: { id: objectiveId },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      progress_percentage: true,
      cycle_id: true,
      unit_id: true,
      owner_id: true,
      parent_objective_id: true,
    },
  });

  if (!objective) throw new AppError("Objective not found", 404);

  // Check if user can view this objective
  const canView = await canViewObjective(user, objective);
  if (!canView) {
    throw new AppError("You do not have permission to view this objective", 403);
  }

  // Get visible objective IDs for context filtering
  const visibleObjectiveIds = await getVisibleObjectiveIdsForUser(user);

  const [cycle, unit, existingKeyResults, allVisibleObjectives, owner, parentObjective] = await Promise.all([
    prisma.cycles.findFirst({
      where: { id: objective.cycle_id },
      select: { id: true, name: true, start_date: true, end_date: true },
    }),
    prisma.units.findFirst({
      where: { id: objective.unit_id },
      select: { id: true, name: true },
    }),
    prisma.keyResults.findMany({
      where: { objective_id: objective.id },
      select: {
        id: true,
        title: true,
        unit: true,
        target_value: true,
        start_value: true,
        due_date: true,
        weight: true,
        evaluation_method: true,
      },
      orderBy: { id: "asc" },
      take: 50,
    }),
    // Fetch other visible objectives for context (filtered by user permissions)
    (async () => {
      const where = { id: { not: objectiveId } };
      if (visibleObjectiveIds) {
        if (visibleObjectiveIds.length === 0) return [];
        where.id = { in: [...visibleObjectiveIds, objectiveId] };
      }
      const objectives = await prisma.objectives.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          progress_percentage: true,
          unit_id: true,
          owner_id: true,
        },
        orderBy: { id: "asc" },
        take: 100,
      });
      return objectives.filter((o) => o.id !== objectiveId);
    })(),
    // Fetch owner information
    objective.owner_id
      ? prisma.users.findFirst({
          where: { id: objective.owner_id },
          select: { id: true, job_title: true, full_name: true },
        })
      : Promise.resolve(null),
    // Fetch parent objective
    objective.parent_objective_id
      ? prisma.objectives.findFirst({
          where: { id: objective.parent_objective_id },
          select: { id: true, title: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  const prompt = buildPrompt({ objective, cycle, unit, existingKeyResults, visibleObjectives: allVisibleObjectives, input, owner, parentObjective });
  // Create AI usage log with PENDING status
  const aiUsageLog = await prisma.aIUsageLogs.create({
    data: {
      company_id: company.id,
      user_id: user.id,
      feature_name: "Suggest Key Results For Objective",
      model_name: AI_ENV.provider === "openai" ? AI_ENV.openaiModel : AI_ENV.geminiModel,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      credit_cost: 0,
      status: "PENDING",
    },
  });

  let result;
  let usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  try {
    // Try once; if the model returns invalid shape, retry with a stricter instruction.
    let parsed;
    let llmResult;
    try {
      llmResult = await callLlm(prompt);
      console.log("[LLM Raw JSON]", llmResult.json);
      parsed = LlmResponseSchema.parse(llmResult.json);
    } catch (e) {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Output must match the JSON shape exactly. Do not add extra keys.`;
      llmResult = await callLlm(retryPrompt);
      parsed = LlmResponseSchema.parse(llmResult.json);
    }

    // Get usage from LLM result
    usage = llmResult.usage || usage;
    console.log("[LLM Usage]", usage);

    // Calculate remaining weight budget for normalization
    const existingTotalWeight = existingKeyResults.reduce(
      (sum, kr) => sum + (Number.isFinite(kr.weight) ? kr.weight : 0),
      0
    );
    const remainingWeight = Math.max(0, 1.0 - existingTotalWeight);

    const suggestions = normalizeWeights(parsed.suggestions, remainingWeight).map((s) => ({
      title: s.title,
      target_value: s.target_value,
      start_value: s.start_value ?? 0,
      unit: s.unit,
      weight: s.weight,
      due_date: s.due_date,
      evaluation_method: s.evaluation_method || "MAXIMIZE",
      evaluation: s.evaluation,
    }));

    console.log("[Normalized Suggestions]", suggestions);

    result = {
      objective: { id: objective.id, title: objective.title },
      suggestions,
      overall_feedback: parsed.overall_feedback,
    };
    console.log("[Final Result]", result);

    // Calculate credit cost for PAY_AS_YOU_GO plan
    const creditCost = company.ai_plan === AIPlan.PAY_AS_YOU_GO
      ? calculateCreditCost(usage.total_tokens)
      : 0;

    // Update AI usage log with SUCCESS status
    await prisma.aIUsageLogs.update({
      where: { id: aiUsageLog.id },
      data: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        total_tokens: usage.total_tokens,
        credit_cost: creditCost,
        status: "SUCCESS",
      },
    });

    // Update company token usage and credit cost using atomic increment to avoid race condition
    const updateData = {
      token_usage: { increment: usage.total_tokens },
    };

    if (company.ai_plan === AIPlan.PAY_AS_YOU_GO) {
      updateData.credit_cost = { increment: creditCost };
    }

    await prisma.companies.update({
      where: { id: company.id },
      data: updateData,
    });

    return result;
  } catch (error) {
    // Update AI usage log with FAILED status
    await prisma.aIUsageLogs.update({
      where: { id: aiUsageLog.id },
      data: {
        status: "FAILED",
      },
    });
    throw error;
  }
}
