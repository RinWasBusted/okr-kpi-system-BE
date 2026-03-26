import AppError from "../../utils/appError.js";
import { generateKeyResultsSchema, generateTestKeyResultsSchema } from "../../schemas/okrAi.schema.js";
import * as okrAiService from "./okrAi.service.js";

export const generateKeyResultsForObjective = async (req, res) => {
  const { objectiveId } = req.params;
  const parsedObjectiveId = Number(objectiveId);
  if (!Number.isInteger(parsedObjectiveId) || parsedObjectiveId <= 0) {
    throw new AppError("Invalid objectiveId", 400);
  }

  const input = generateKeyResultsSchema.parse(req.body ?? {});

  const result = await okrAiService.generateKeyResultsForObjective({
    objectiveId: parsedObjectiveId,
    user: req.user,
    input,
  });

  res.success("Generated key results successfully", 200, result);
};

export const generateTest = async (req, res) => {
  const input = generateTestKeyResultsSchema.parse(req.body ?? {});

  const result = await okrAiService.generateTestKeyResults({ input });
  res.success("Generate Test completed", 200, result);
};

