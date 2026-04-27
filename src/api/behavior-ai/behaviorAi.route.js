import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import * as behaviorAiController from "./behaviorAi.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Behavior AI
 *     description: AI-powered employee behavior analysis and risk assessment
 */

/**
 * @swagger
 * /behavior-ai/risk-scores:
 *   get:
 *     summary: Get risk scores for employees
 *     description: Retrieve risk assessment scores for employees in the company
 *     tags: [Behavior AI]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by specific user ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: min_score
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         description: Minimum risk score threshold
 *     responses:
 *       200:
 *         description: Risk scores retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Risk scores retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       user_id:
 *                         type: integer
 *                         example: 10
 *                       score_date:
 *                         type: string
 *                         format: date
 *                         example: "2026-04-15"
 *                       risk_score:
 *                         type: number
 *                         example: 0.75
 *                       knn_risk_label:
 *                         type: string
 *                         enum: [LOW, MEDIUM, HIGH]
 *                         example: HIGH
 *                       statistical_alert:
 *                         type: boolean
 *                         example: true
 *                       triggered_features:
 *                         type: object
 *                         example: {"kpi_completion_rate": {"current": 0.3, "mean": 0.8, "std": 0.1}}
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN_COMPANY role
 */
router.get("/risk-scores", authenticate, behaviorAiController.getRiskScores);

/**
 * @swagger
 * /behavior-ai/employee-features/{userId}:
 *   get:
 *     summary: Get employee behavior features
 *     description: Retrieve historical behavior features for a specific employee
 *     tags: [Behavior AI]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee user ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 90
 *         description: Number of days of historical data to retrieve
 *     responses:
 *       200:
 *         description: Employee features retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Employee features retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                       example: 10
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           period:
 *                             type: string
 *                             format: date
 *                             example: "2026-04-15"
 *                           kpi_completion_rate:
 *                             type: number
 *                             example: 0.85
 *                           checkin_frequency:
 *                             type: number
 *                             example: 12
 *                           feedback_sentiment_score:
 *                             type: number
 *                             example: 0.2
 *                           objective_participation_ratio:
 *                             type: number
 *                             example: 1.0
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Employee not found
 */
router.get("/employee-features/:userId", authenticate, behaviorAiController.getEmployeeFeatures);

/**
 * @swagger
 * /behavior-ai/predict-risk/{userId}:
 *   post:
 *     summary: Predict risk for an employee
 *     description: Generate real-time risk prediction for a specific employee using current features
 *     tags: [Behavior AI]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee user ID
 *     responses:
 *       200:
 *         description: Risk prediction generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Risk prediction generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                       example: 10
 *                     risk_label:
 *                       type: string
 *                       enum: [low, medium, high]
 *                       example: medium
 *                     risk_score:
 *                       type: number
 *                       example: 0.5
 *                     features_used:
 *                       type: object
 *                       properties:
 *                         kpi_completion_rate:
 *                           type: number
 *                           example: 0.75
 *                         checkin_delay_days:
 *                           type: number
 *                           example: 15
 *                         feedback_sentiment_score:
 *                           type: number
 *                           example: -0.3
 *                         objective_participation_ratio:
 *                           type: number
 *                           example: 0.8
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Employee not found
 *       502:
 *         description: AI model prediction failed
 */
router.post("/predict-risk/:userId", authenticate, behaviorAiController.predictEmployeeRisk);

/**
 * @swagger
 * /behavior-ai/generate-alert/{riskScoreId}:
 *   post:
 *     summary: Generate AI-powered alert for a risk score
 *     description: Use RAG to generate a natural language alert based on risk score data
 *     tags: [Behavior AI]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: riskScoreId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Risk score ID
 *     responses:
 *       200:
 *         description: Alert generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Alert generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     alert_id:
 *                       type: string
 *                       example: "uuid-123"
 *                     risk_score_id:
 *                       type: integer
 *                       example: 1
 *                     severity:
 *                       type: string
 *                       enum: [low, medium, high]
 *                       example: high
 *                     summary:
 *                       type: string
 *                       example: "Nhân viên có dấu hiệu quá tải công việc nghiêm trọng"
 *                     triggered_features:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["kpi_completion_rate", "feedback_sentiment_score"]
 *                     action_items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                             example: "Tổ chức buổi 1-1 trong vòng 48 giờ"
 *                           owner:
 *                             type: string
 *                             example: "direct_manager"
 *                           deadline:
 *                             type: string
 *                             format: date
 *                             example: "2026-04-20"
 *                     llm_narrative:
 *                       type: string
 *                       example: "Dựa trên dữ liệu phân tích, nhân viên này có dấu hiệu..."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Risk score not found
 *       502:
 *         description: AI alert generation failed
 */
router.post("/generate-alert/:riskScoreId", authenticate, behaviorAiController.generateAlert);

/**
 * @swagger
 * /behavior-ai/run-etl:
 *   post:
 *     summary: Manually trigger behavior analysis ETL
 *     description: Run the daily ETL process for behavior analysis (for testing purposes)
 *     tags: [Behavior AI]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: ETL process completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: ETL process completed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed_users:
 *                       type: integer
 *                       example: 5
 *                     alerts_triggered:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN_COMPANY role
 */
router.post("/run-etl", authenticate, behaviorAiController.runETL);

export default router;