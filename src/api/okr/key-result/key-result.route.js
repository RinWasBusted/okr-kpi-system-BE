import express from "express";
import {
    getKeyResults,
    createKeyResult,
    updateKeyResult,
    deleteKeyResult,
} from "./key-result.controller.js";
import { authenticate } from "../../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: KeyResults
 *     description: OKR key results management APIs
 */

/**
 * @swagger
 * /objectives/{objective_id}/key-results:
 *   get:
 *     summary: Get list of key results for an objective
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: objective_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Key results retrieved successfully
 */
router.get("/objectives/:objective_id/key-results", getKeyResults);

/**
 * @swagger
 * /objectives/{objective_id}/key-results:
 *   post:
 *     summary: Create a key result
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: objective_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Key result created successfully
 */
router.post("/objectives/:objective_id/key-results", createKeyResult);

/**
 * @swagger
 * /key-results/{id}:
 *   put:
 *     summary: Update a key result
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Key result updated successfully
 */
router.put("/key-results/:id", updateKeyResult);

/**
 * @swagger
 * /key-results/{id}:
 *   delete:
 *     summary: Delete a key result
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Key result deleted successfully
 */
router.delete("/key-results/:id", deleteKeyResult);

export default router;
