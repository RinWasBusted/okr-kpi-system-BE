import express from "express";
import {
    getObjectives,
    createObjective,
    updateObjective,
    submitObjective,
    approveObjective,
    rejectObjective,
    deleteObjective,
} from "./objective.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createObjectiveSchema,
    updateObjectiveSchema,
    listObjectivesQuerySchema,
} from "../../../schemas/objective.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Objectives
 *     description: OKR objectives management APIs
 */

/**
 * @swagger
 * /objectives:
 *   get:
 *     summary: Get list of objectives
 *     tags: [Objectives]
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Active, Pending_Approval, Rejected, Completed]
 *           example: Active
 *       - in: query
 *         name: progress_status
 *         schema:
 *           type: string
 *           enum: [NOT_STARTED, DANGER, WARNING, ON_TRACK, COMPLETED]
 *           description: Filter by progress percentage
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           example: PUBLIC
 *       - in: query
 *         name: parent_objective_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: include_key_results
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Objectives retrieved successfully
 */
router.get("/objectives", validate(listObjectivesQuerySchema, "query"), getObjectives);

/**
 * @swagger
 * /objectives:
 *   post:
 *     summary: Create a new objective
 *     tags: [Objectives]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, cycle_id]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Increase customer satisfaction"
 *                 description: Objective title (1-255 characters)
 *               cycle_id:
 *                 type: integer
 *               unit_id:
 *                 type: integer
 *               owner_id:
 *                 type: integer
 *               parent_objective_id:
 *                 type: integer
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 example: INTERNAL
 *     responses:
 *       201:
 *         description: Objective created successfully
 */
router.post("/objectives", validate(createObjectiveSchema), createObjective);

/**
 * @swagger
 * /objectives/{id}:
 *   put:
 *     summary: Update an objective
 *     description: Allowed when status is Draft, Rejected, or Active. For Active, title/parent/visibility can change without resetting to Draft (supports iteration after feedback).
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Objective title (1-255 characters)
 *               parent_objective_id:
 *                 type: integer
 *                 nullable: true
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *     responses:
 *       200:
 *         description: Objective updated successfully
 */
router.put("/objectives/:id", validate(updateObjectiveSchema), updateObjective);

/**
 * @swagger
 * /objectives/{id}/submit:
 *   post:
 *     summary: Submit objective for approval
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Objective submitted successfully
 */
router.post("/objectives/:id/submit", submitObjective);

/**
 * @swagger
 * /objectives/{id}/approve:
 *   post:
 *     summary: Approve objective
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Objective title (1-255 characters)
 *               parent_objective_id:
 *                 type: integer
 *                 nullable: true
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, COMPANY]
 *     responses:
 *       200:
 *         description: Objective approved successfully
 */
router.post("/objectives/:id/approve", approveObjective);

/**
 * @swagger
 * /objectives/{id}/reject:
 *   post:
 *     summary: Reject objective
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Reason for rejection (max 1000 characters)
 *     responses:
 *       200:
 *         description: Objective rejected successfully
 */
router.post("/objectives/:id/reject", rejectObjective);

/**
 * @swagger
 * /objectives/{id}:
 *   delete:
 *     summary: Delete objective (soft delete)
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Objective deleted successfully
 */
router.delete("/objectives/:id", deleteObjective);

export default router;
