import AppError from "../../utils/appError.js";
import { generateKeyResultsSchema } from "../../schemas/okrAi.schema.js";
import * as okrAiService from "./okrAi.service.js";

export const generateKeyResultsForObjective = async (req, res) => {
  const { objectiveId } = req.params;
  const parsedObjectiveId = Number(objectiveId);
  if (!Number.isInteger(parsedObjectiveId) || parsedObjectiveId <= 0) {
    throw new AppError("Invalid objectiveId", 400);
  }

  const input = generateKeyResultsSchema.parse(req.body ?? {});

  try {
    const result = await okrAiService.generateKeyResultsForObjective({
      objectiveId: parsedObjectiveId,
      user: req.user,
      input,
    });

    res.success("Generated key results successfully", 200, result);
  } catch (error) {
    // Handle AI provider errors with user-friendly messages
    if (error?.status === 503 || error?.code === 503) {
      throw new AppError(
        "AI service is currently overloaded. Please try again in a moment.",
        503
      );
    }
    if (error?.status === 429 || error?.code === 429) {
      throw new AppError(
        "Too many requests to AI service. Please try again later.",
        429
      );
    }
    // Handle JSON parsing or schema validation errors from AI response
    if (error?.name === "ZodError") {
      throw new AppError(
        "AI response validation failed. The generated content was invalid. Please try again.",
        422
      );
    }
    // Handle AI provider not configured
    if (error?.message?.includes("Missing") && error?.message?.includes("API_KEY")) {
      throw new AppError(
        "AI service is not properly configured. Please contact support.",
        500
      );
    }
    // Re-throw other errors to be handled by global error handler
    throw error;
  }
};
