import express from "express";
import objectiveRoutes from "./objective/objective.route.js";
import keyResultRoutes from "./key-result/key-result.route.js";
import checkInRoutes from "./check-in/check-in.route.js";
import feedbackRoutes from "./feedbacks/feedback.route.js";

const router = express.Router();

router.use(objectiveRoutes);
router.use(keyResultRoutes);
router.use(checkInRoutes);
router.use(feedbackRoutes);

export default router;
