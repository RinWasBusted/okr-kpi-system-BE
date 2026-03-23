import express from "express";
import { createCheckIn, getCheckIns } from "./check-in.controller.js";
import { authenticate } from "../../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: CheckIns
 *     description: OKR check-in APIs
 */

/**
 * @swagger
 * /key-results/{kr_id}/check-ins:
 *   post:
 *     summary: Create a check-in for a key result
 *     tags: [CheckIns]
 *     parameters:
 *       - in: path
 *         name: kr_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Check-in created successfully
 */
router.post("/key-results/:kr_id/check-ins", createCheckIn);

/**
 * @swagger
 * /key-results/{kr_id}/check-ins:
 *   get:
 *     summary: Get check-in history for a key result
 *     tags: [CheckIns]
 *     parameters:
 *       - in: path
 *         name: kr_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Check-ins retrieved successfully
 */
router.get("/key-results/:kr_id/check-ins", getCheckIns);

export default router;
