import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import * as okrAiController from "./okrAi.controller.js";

const router = express.Router();

// Generate Key Result suggestions + fit evaluation for an Objective
router.post(
  "/objectives/:objectiveId/key-results/generate",
  authenticate,
  okrAiController.generateKeyResultsForObjective
);

// Generate test key results without auth / without objectiveId
router.post("/okr-ai/generate-test", okrAiController.generateTest);

export default router;

