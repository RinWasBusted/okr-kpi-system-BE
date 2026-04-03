import express from "express";
import {
    getKPIAssignments,
    createKPIAssignment,
    updateKPIAssignment,
    deleteKPIAssignment,
} from "./assignments.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createKPIAssignmentSchema,
    updateKPIAssignmentSchema,
} from "../../../schemas/kpi.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: KPIAssignments
 *     description: KPI Assignment management APIs
 */

/**
 * @swagger
 * /kpi-assignments:
 *   get:
 *     summary: Get list of KPI Assignments
 *     tags: [KPIAssignments]
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         schema:
 *           type: integer
 *         description: Filter by cycle
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: integer
 *         description: Filter by unit
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filter by owner
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [PUBLIC, INTERNAL, PRIVATE]
 *         description: Filter by visibility
 *       - in: query
 *         name: progress_status
 *         schema:
 *           type: string
 *           enum: [NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED]
 *         description: Filter by progress status (calculated from progress_percentage)
 *       - in: query
 *         name: kpi_status
 *         schema:
 *           type: string
 *           enum: [ON_TRACK, AT_RISK, CRITICAL]
 *         description: Filter by KPI status from latest record
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deleted]
 *           default: active
 *         description: Filter by activity status
 *       - in: query
 *         name: parent_assignment_id
 *         schema:
 *           type: integer
 *         description: Filter by parent assignment
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
 *         description: KPI Assignments retrieved successfully
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
 *                       kpi_dictionary:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           unit:
 *                             type: string
 *                           evaluation_method:
 *                             type: string
 *                       target_value:
 *                         type: number
 *                       current_value:
 *                         type: number
 *                       progress_percentage:
 *                         type: number
 *                       visibility:
 *                         type: string
 *                       owner:
 *                         type: object
 *                         nullable: true
 *                       unit:
 *                         type: object
 *                         nullable: true
 *                       parent_assignment:
 *                         type: object
 *                         nullable: true
 *                       latest_record:
 *                         type: object
 *                         nullable: true
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     last_page:
 *                       type: integer
 */
router.get("/kpi-assignments", getKPIAssignments);

/**
 * @swagger
 * /kpi-assignments:
 *   post:
 *     summary: Create a new KPI Assignment
 *     tags: [KPIAssignments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kpi_dictionary_id
 *               - cycle_id
 *               - target_value
 *             properties:
 *               kpi_dictionary_id:
 *                 type: integer
 *               cycle_id:
 *                 type: integer
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *                 description: Defaults to 0 if not provided
 *               owner_id:
 *                 type: integer
 *                 description: For personal KPI (either owner_id or unit_id, not both)
 *               unit_id:
 *                 type: integer
 *                 description: For unit KPI (either owner_id or unit_id, not both)
 *               parent_assignment_id:
 *                 type: integer
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 default: INTERNAL
 *     responses:
 *       201:
 *         description: KPI Assignment created successfully
 *       404:
 *         description: Resource not found
 *       422:
 *         description: Validation error
 */
router.post("/kpi-assignments", validate(createKPIAssignmentSchema), createKPIAssignment);

/**
 * @swagger
 * /kpi-assignments/{id}:
 *   put:
 *     summary: Update a KPI Assignment
 *     tags: [KPIAssignments]
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
 *               cycle_id:
 *                 type: integer
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *     responses:
 *       200:
 *         description: KPI Assignment updated successfully
 *       403:
 *         description: No permission to edit
 *       404:
 *         description: KPI Assignment not found
 */
router.put("/kpi-assignments/:id", validate(updateKPIAssignmentSchema), updateKPIAssignment);

/**
 * @swagger
 * /kpi-assignments/{id}:
 *   delete:
 *     summary: Delete a KPI Assignment
 *     tags: [KPIAssignments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cascade
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, soft delete all descendants recursively. If false, only soft delete direct children.
 *     responses:
 *       204:
 *         description: KPI Assignment deleted successfully
 *       403:
 *         description: No permission to delete
 *       404:
 *         description: KPI Assignment not found
 */
router.delete("/kpi-assignments/:id", deleteKPIAssignment);

export default router;
