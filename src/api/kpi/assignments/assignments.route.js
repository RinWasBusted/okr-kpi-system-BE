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
 *     description: Retrieve KPI assignments with cycle context. Child assignments inherit visibility constraints from parent assignments.
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
 *         description: Filter by visibility level
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
 *         description: Filter by KPI status from latest record (requires admin/manager permission)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deleted]
 *           default: active
 *         description: Filter by activity status (deleted requires admin/manager permission)
 *       - in: query
 *         name: parent_assignment_id
 *         schema:
 *           type: integer
 *         description: Filter by parent assignment
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [tree, list]
 *           default: tree
 *         description: Response format - tree (hierarchical) or list (flat)
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
 *           maximum: 100
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
 *                       progress_status:
 *                         type: string
 *                       visibility:
 *                         type: string
 *                         enum: [PUBLIC, INTERNAL, PRIVATE]
 *                       cycle:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           start_date:
 *                             type: string
 *                             format: date
 *                           end_date:
 *                             type: string
 *                             format: date
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
 *     description: |
 *       Create a new KPI assignment with visibility hierarchy enforcement.
 *       If parent_assignment_id is specified, child assignment's visibility must be >= parent's visibility (more private or equal).
 *       Either owner_id or unit_id must be provided (not both).
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
 *                 description: Required - KPI definition to assign
 *               cycle_id:
 *                 type: integer
 *                 description: Required - cycle this assignment belongs to
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 description: Required - target value (must be > 0)
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *                 description: Optional - current value (defaults to 0 if not provided)
 *               owner_id:
 *                 type: integer
 *                 description: Optional - assign to specific user (either owner_id or unit_id, not both)
 *               unit_id:
 *                 type: integer
 *                 description: Optional - assign to specific unit (either owner_id or unit_id, not both)
 *               parent_assignment_id:
 *                 type: integer
 *                 description: Optional - parent assignment ID (child visibility must be >= parent visibility)
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 default: INTERNAL
 *                 description: |
 *                   Visibility level (PUBLIC < INTERNAL < PRIVATE)
 *                   If parent_assignment_id provided, child visibility must be >= parent visibility
 *     responses:
 *       201:
 *         description: KPI Assignment created successfully
 *       400:
 *         description: Invalid request (e.g., both owner_id and unit_id provided)
 *       403:
 *         description: No permission to create assignment
 *       404:
 *         description: Resource not found (KPI dictionary, cycle, etc.)
 *       422:
 *         description: Validation error (e.g., child visibility more public than parent)
 */
router.post("/kpi-assignments", validate(createKPIAssignmentSchema), createKPIAssignment);

/**
 * @swagger
 * /kpi-assignments/{id}:
 *   put:
 *     summary: Update a KPI Assignment
 *     description: Update KPI assignment values and settings. Cycle context is automatically included in responses. Note - parent_assignment_id and visibility inheritance rules are enforced on create/update.
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
 *                 description: Change assignment cycle
 *               target_value:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 description: Target value (must be > 0)
 *               current_value:
 *                 type: number
 *                 minimum: 0
 *                 description: Current progress value
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 description: Visibility level (PUBLIC < INTERNAL < PRIVATE). If parent assignment exists, child visibility must be >= parent visibility
 *     responses:
 *       200:
 *         description: KPI Assignment updated successfully
 *       400:
 *         description: Invalid assignment ID
 *       403:
 *         description: No permission to edit
 *       404:
 *         description: KPI Assignment not found
 *       422:
 *         description: Validation error
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
