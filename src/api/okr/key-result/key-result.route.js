import express from "express";
import {
    getKeyResults,
    createKeyResult,
    createMultipleKeyResults,
    updateKeyResult,
    deleteKeyResult,
} from "./key-result.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import { createKeyResultSchema, createMultipleKeyResultsSchema, updateKeyResultSchema } from "../../../schemas/kpi.schema.js";

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
 *         description: The objective ID
 *     responses:
 *       200:
 *         description: Key results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       target_value:
 *                         type: number
 *                       current_value:
 *                         type: number
 *                       unit:
 *                         type: string
 *                       weight:
 *                         type: number
 *                       due_date:
 *                         type: string
 *                         format: date
 *                       progress_percentage:
 *                         type: number
 *                       days_until_due:
 *                         type: integer
 *       400:
 *         description: Invalid objective ID
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Objective not found
 */
router.get("/objectives/:objective_id/key-results", getKeyResults);

/**
 * @swagger
 * /objectives/{objective_id}/key-results:
 *   post:
 *     summary: Create a key result for an objective
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: objective_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The objective ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - target_value
 *               - unit
 *               - weight
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Key result title (1-255 characters, required)
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 description: Target value to achieve
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 description: Current value progress (optional, defaults to 0)
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Unit of measurement (1-50 characters, required)
 *               weight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 100
 *                 description: Weight percentage (0-100)
 *               due_date:
 *                 type: string
 *                 format: date
 *                 description: Due date in YYYY-MM-DD format (optional)
 *     responses:
 *       201:
 *         description: Key result created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key_result:
 *                       type: object
 *       400:
 *         description: Invalid objective ID
 *       403:
 *         description: No permission to edit this objective
 *       404:
 *         description: Objective not found
 *       422:
 *         description: Validation error (missing or invalid fields)
 */
router.post("/objectives/:objective_id/key-results", validate(createKeyResultSchema), createKeyResult);

/**
 * @swagger
 * /objectives/{objective_id}/key-results/batch:
 *   post:
 *     summary: Create multiple key results for an objective
 *     tags: [KeyResults]
 *     parameters:
 *       - in: path
 *         name: objective_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The objective ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key_results
 *             properties:
 *               key_results:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - target_value
 *                     - unit
 *                     - weight
 *                   properties:
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 255
 *                       description: Key result title
 *                     target_value:
 *                       type: number
 *                       exclusiveMinimum: 0
 *                       description: Target value to achieve
 *                     current_value:
 *                       type: number
 *                       minimum: 0
 *                       default: 0
 *                       description: Current value progress (optional, defaults to 0)
 *                     unit:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 50
 *                       description: Unit of measurement
 *                     weight:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Weight percentage
 *                     due_date:
 *                       type: string
 *                       format: date
 *                       description: Due date in YYYY-MM-DD format (optional)
 *                     evaluation_method:
 *                       type: string
 *                       enum: [MAXIMIZE, MINIMIZE, TARGET]
 *                       description: Evaluation method (optional, defaults to MAXIMIZE)
 *     responses:
 *       201:
 *         description: Key results created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key_results:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid objective ID or no key results provided
 *       403:
 *         description: No permission to edit this objective
 *       404:
 *         description: Objective not found
 *       422:
 *         description: Validation error (total weight exceeds 100 or other validation errors)
 */
router.post("/objectives/:objective_id/key-results/batch", validate(createMultipleKeyResultsSchema), createMultipleKeyResults);

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
 *         description: The key result ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Key result title (1-255 characters, optional for update)
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 description: Target value to achieve (optional)
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *                 description: Current value progress (optional)
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Unit of measurement (1-50 characters, optional for update)
 *               weight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Weight percentage (0-100, optional)
 *               due_date:
 *                 type: string
 *                 format: date
 *                 description: Due date in YYYY-MM-DD format (optional)
 *     responses:
 *       200:
 *         description: Key result updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key_result:
 *                       type: object
 *       400:
 *         description: Invalid key result ID or no fields provided to update
 *       403:
 *         description: No permission to edit this objective
 *       404:
 *         description: Key result not found
 *       422:
 *         description: Validation error (invalid field values)
 */
router.put("/key-results/:id", validate(updateKeyResultSchema), updateKeyResult);

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
 *         description: The key result ID
 *     responses:
 *       204:
 *         description: Key result deleted successfully
 *       400:
 *         description: Invalid key result ID
 *       403:
 *         description: No permission to delete this key result
 *       404:
 *         description: Key result not found
 */
router.delete("/key-results/:id", deleteKeyResult);

export default router;
