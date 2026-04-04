import express from "express";
import {
    getKPIDictionaries,
    createKPIDictionary,
    updateKPIDictionary,
    deleteKPIDictionary,
} from "./dictionaries.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createKPIDictionarySchema,
    updateKPIDictionarySchema,
} from "../../../schemas/kpi.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: KPIDictionaries
 *     description: KPI Dictionary management APIs
 */

/**
 * @swagger
 * /kpi-dictionaries:
 *   get:
 *     summary: Get list of KPI Dictionaries
 *     tags: [KPIDictionaries]
 *     parameters:
 *       - in: query
 *         name: for_unit_id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Filter KPI dictionaries accessible to a specific unit (company-wide + unit itself + ancestor units)
 *     responses:
 *       200:
 *         description: KPI Dictionaries retrieved successfully
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
 *                       name:
 *                         type: string
 *                       unit:
 *                         type: string
 *                       evaluation_method:
 *                         type: string
 *                         enum: [Positive, Negative, Stabilizing]
 *                       unit_id:
 *                         type: integer
 *                         nullable: true
 */
router.get("/kpi-dictionaries", getKPIDictionaries);

/**
 * @swagger
 * /kpi-dictionaries:
 *   post:
 *     summary: Create a new KPI Dictionary
 *     tags: [KPIDictionaries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - unit
 *               - evaluation_method
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: KPI name (1-255 characters, required)
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Unit of measurement (VNĐ, %, Số lượng, etc.) - 1-50 characters, required
 *               evaluation_method:
 *                 type: string
 *                 enum: [Positive, Negative, Stabilizing]
 *                 description: Evaluation method
 *               unit_id:
 *                 type: integer
 *                 description: Unit ID (null for company-wide)
 *     responses:
 *       201:
 *         description: KPI Dictionary created successfully
 *       403:
 *         description: Only admin can create KPI dictionaries
 *       422:
 *         description: Validation error
 */
router.post("/kpi-dictionaries", validate(createKPIDictionarySchema), createKPIDictionary);

/**
 * @swagger
 * /kpi-dictionaries/{id}:
 *   put:
 *     summary: Update a KPI Dictionary
 *     tags: [KPIDictionaries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: KPI name (1-255 characters, optional for update)
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Unit of measurement (1-50 characters, optional for update)
 *               evaluation_method:
 *                 type: string
 *                 enum: [Positive, Negative, Stabilizing]
 *                 description: Evaluation method (optional for update)
 *               unit_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: KPI Dictionary updated successfully
 *       403:
 *         description: Only admin can update KPI dictionaries
 *       404:
 *         description: KPI Dictionary not found
 */
router.put("/kpi-dictionaries/:id", validate(updateKPIDictionarySchema), updateKPIDictionary);

/**
 * @swagger
 * /kpi-dictionaries/{id}:
 *   delete:
 *     summary: Delete a KPI Dictionary
 *     tags: [KPIDictionaries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: KPI Dictionary deleted successfully
 *       400:
 *         description: Cannot delete if KPI assignments exist
 *       403:
 *         description: Only admin can delete KPI dictionaries
 *       404:
 *         description: KPI Dictionary not found
 */
router.delete("/kpi-dictionaries/:id", deleteKPIDictionary);

export default router;
