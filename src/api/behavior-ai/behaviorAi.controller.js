import AppError from "../../utils/appError.js";
import { z } from "zod";
import * as behaviorAiService from "./behaviorAi.service.js";

const getRiskScoresSchema = z.object({
  user_id: z.string().optional().transform(val => val ? Number(val) : undefined),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  min_score: z.string().optional().transform(val => val ? Number(val) : undefined),
});

const getEmployeeFeaturesSchema = z.object({
  userId: z.string().transform(val => Number(val)),
  days: z.string().optional().transform(val => val ? Number(val) : 90),
});

export const getRiskScores = async (req, res) => {
  const input = getRiskScoresSchema.parse(req.query);

  try {
    const result = await behaviorAiService.getRiskScores({
      user: req.user,
      filters: input,
    });

    res.success("Risk scores retrieved successfully", 200, result);
  } catch (error) {
    throw error;
  }
};

export const getEmployeeFeatures = async (req, res) => {
  const { userId } = req.params;
  const input = getEmployeeFeaturesSchema.parse({ userId, ...req.query });

  try {
    const result = await behaviorAiService.getEmployeeFeatures({
      user: req.user,
      userId: input.userId,
      days: input.days,
    });

    res.success("Employee features retrieved successfully", 200, result);
  } catch (error) {
    throw error;
  }
};

export const predictEmployeeRisk = async (req, res) => {
  const { userId } = req.params;
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    throw new AppError("Invalid userId", 400);
  }

  try {
    const result = await behaviorAiService.predictEmployeeRisk({
      user: req.user,
      targetUserId: parsedUserId,
    });

    res.success("Risk prediction generated successfully", 200, result);
  } catch (error) {
    throw error;
  }
};

export const generateAlert = async (req, res) => {
  const { riskScoreId } = req.params;
  const parsedRiskScoreId = Number(riskScoreId);
  if (!Number.isInteger(parsedRiskScoreId) || parsedRiskScoreId <= 0) {
    throw new AppError("Invalid riskScoreId", 400);
  }

  try {
    const result = await behaviorAiService.generateAlert({
      user: req.user,
      riskScoreId: parsedRiskScoreId,
    });

    res.success("Alert generated successfully", 200, result);
  } catch (error) {
    throw error;
  }
};

export const runETL = async (req, res) => {
  try {
    const result = await behaviorAiService.runETL({
      user: req.user,
    });

    res.success("ETL process completed successfully", 200, result);
  } catch (error) {
    throw error;
  }
};