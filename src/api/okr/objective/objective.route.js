import express from "express";
import {
    getObjectives,
    createObjective,
    updateObjective,
    submitObjective,
    approveObjective,
    rejectObjective,
    revertToDraft,
    deleteObjective,
    getAvailableParentObjectives,
    getObjectiveById,
    publishObjective,
} from "./objective.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createObjectiveSchema,
    updateObjectiveSchema,
    listObjectivesQuerySchema,
    getAvailableParentObjectivesSchema,
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
 *     description: Retrieve objectives with visibility hierarchy enforcement. Child objectives cannot be more public than parent objectives (PUBLIC < INTERNAL < PRIVATE).
 *     tags: [Objectives]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Pending_Approval, Rejected, NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED]
 *           example: ON_TRACK
 *       - in: query
 *         name: progress_status
 *         schema:
 *           type: string
 *           enum: [NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED]
 *           description: Filter by progress status (calculated from progress_percentage)
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [PUBLIC, INTERNAL, PRIVATE]
 *           example: INTERNAL
 *         description: Filter by visibility level
 *       - in: query
 *         name: parent_objective_id
 *         schema:
 *           type: integer
 *         description: Filter by parent objective
 *       - in: query
 *         name: include_key_results
 *         schema:
 *           type: boolean
 *         description: Include associated key results in response
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
 *         description: Objectives retrieved successfully
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
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [Draft, Pending_Approval, Rejected, NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED]
 *                         description: Workflow status (Draft, Pending_Approval, Rejected) or progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED)
 *                       visibility:
 *                         type: string
 *                         enum: [PUBLIC, INTERNAL, PRIVATE]
 *                       progress_percentage:
 *                         type: number
 *                       progress_status:
 *                         type: string
 *                         enum: [NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED]
 *                         description: Calculated from progress_percentage
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
 *                       parent_objective:
 *                         type: object
 *                         nullable: true
 *                       permission:
 *                         type: object
 *                         description: User permissions for this objective
 *                         properties:
 *                           view:
 *                             type: boolean
 *                           edit:
 *                             type: boolean
 *                           submit:
 *                             type: boolean
 *                           approve:
 *                             type: boolean
 *                           reject:
 *                             type: boolean
 *                           delete:
 *                             type: boolean
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
router.get("/objectives", validate(listObjectivesQuerySchema, "query"), getObjectives);

/**
 * @swagger
 * /objectives/available-parents:
 *   get:
 *     summary: Get available parent objectives for a unit
 *     description: |
 *       Retrieve objectives that can be set as parent for a new objective in the specified unit.
 *       Returns objectives from the specified unit and all its ancestor units.
 *       Only includes objectives with progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED).
 *       Results are filtered by visibility permissions.
 *     tags: [Objectives]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unit ID for which to find available parent objectives
 *       - in: query
 *         name: cycle_id
 *         schema:
 *           type: integer
 *         description: Optional - filter by cycle
 *       - in: query
 *         name: include_key_results
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include associated key results in response
 *     responses:
 *       200:
 *         description: Available parent objectives retrieved successfully
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
 *                       unit:
 *                         type: object
 *                         nullable: true
 *                       objectives:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             title:
 *                               type: string
 *                             status:
 *                               type: string
 *                             visibility:
 *                               type: string
 *                             progress_percentage:
 *                               type: number
 *                 meta:
 *                   type: object
 *                   properties:
 *                     unit_id:
 *                       type: integer
 *                     unit_ids_searched:
 *                       type: array
 *                       items:
 *                         type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         description: Invalid unit_id
 *       404:
 *         description: Unit not found
 */
router.get("/objectives/available-parents", validate(getAvailableParentObjectivesSchema, "query"), getAvailableParentObjectives);
/**
 * @swagger
 * /objectives/available-parents:
 *   get:
 *     summary: Get available parent objectives for a unit
 *     description: |
 *       Retrieve objectives that can be set as parent for a new objective in the specified unit.
 *       Returns objectives from the specified unit and all its ancestor units.
 *       Only includes objectives with progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED).
 *       Results are filtered by visibility permissions.
 *     tags: [Objectives]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unit ID for which to find available parent objectives
 *       - in: query
 *         name: cycle_id
 *         schema:
 *           type: integer
 *         description: Optional - filter by cycle
 *       - in: query
 *         name: include_key_results
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include associated key results in response
 *     responses:
 *       200:
 *         description: Available parent objectives retrieved successfully
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
 *                       unit:
 *                         type: object
 *                         nullable: true
 *                       objectives:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             title:
 *                               type: string
 *                             status:
 *                               type: string
 *                             visibility:
 *                               type: string
 *                             progress_percentage:
 *                               type: number
 *                 meta:
 *                   type: object
 *                   properties:
 *                     unit_id:
 *                       type: integer
 *                     unit_ids_searched:
 *                       type: array
 *                       items:
 *                         type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         description: Invalid unit_id
 *       404:
 *         description: Unit not found
 */
router.get("/objectives/available-parents", validate(getAvailableParentObjectivesSchema, "query"), getAvailableParentObjectives);


/**
 * @swagger
 * /objectives/available-parents:
 *   get:
 *     summary: Get available parent objectives for a unit
 *     description: |
 *       Retrieve objectives that can be set as parent for a new objective in the specified unit.
 *       Returns objectives from the specified unit and all its ancestor units.
 *       Only includes objectives with progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED).
 *       Results are filtered by visibility permissions.
 *     tags: [Objectives]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unit ID for which to find available parent objectives
 *       - in: query
 *         name: cycle_id
 *         schema:
 *           type: integer
 *         description: Optional - filter by cycle
 *       - in: query
 *         name: include_key_results
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include associated key results in response
 *     responses:
 *       200:
 *         description: Available parent objectives retrieved successfully
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
 *                       unit:
 *                         type: object
 *                         nullable: true
 *                       objectives:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             title:
 *                               type: string
 *                             status:
 *                               type: string
 *                             visibility:
 *                               type: string
 *                             progress_percentage:
 *                               type: number
 *                 meta:
 *                   type: object
 *                   properties:
 *                     objective:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                         status:
 *                           type: string
 *                         visibility:
 *                           type: string
 *                         progress_percentage:
 *                           type: number
 *                         progress_status:
 *                           type: string
 *                         cycle:
 *                           type: object
 *                         owner:
 *                           type: object
 *                         unit:
 *                           type: object
 *                         parent_objective:
 *                           type: object
 *                         key_results:
 *                           type: array
 *                         permission:
 *                           type: object
 *                           description: User permissions for this objective
 *                           properties:
 *                             view:
 *                               type: boolean
 *                             edit:
 *                               type: boolean
 *                             submit:
 *                               type: boolean
 *                             approve:
 *                               type: boolean
 *                             reject:
 *                               type: boolean
 *                             delete:
 *                               type: boolean
 *       400:
 *         description: Invalid unit_id
 *       404:
 *         description: Unit not found
 */
router.get("/objectives/:id", getObjectiveById);

/**
 * @swagger
 * /objectives:
 *   post:
 *     summary: Create a new objective
 *     description: Create a new objective with visibility hierarchy enforcement. If parent_objective_id is specified, child objective's visibility must be >= parent's visibility (more private or equal). Status determined automatically based on user role and target unit.
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
 *                 description: Required - cycle this objective belongs to
 *               unit_id:
 *                 type: integer
 *                 description: Optional - target unit for this objective
 *               owner_id:
 *                 type: integer
 *                 description: Optional - assign to specific user
 *               parent_objective_id:
 *                 type: integer
 *                 description: Optional - parent objective ID (child visibility must be >= parent visibility)
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 default: INTERNAL
 *                 description: |
 *                   Visibility level (PUBLIC < INTERNAL < PRIVATE)
 *                   - PUBLIC: Visible to all users
 *                   - INTERNAL: Visible within unit hierarchy
 *                   - PRIVATE: Only visible to owner and unit ancestors
 *                   If parent_objective_id provided, child visibility must be >= parent visibility
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional description for the objective (max 1000 characters)
 *     responses:
 *       201:
 *         description: Objective created successfully
 *       400:
 *         description: Invalid request or objective cannot be its own parent
 *       422:
 *         description: Validation error (e.g., child visibility more public than parent)
 */
router.post("/objectives", validate(createObjectiveSchema), createObjective);

/**
 * @swagger
 * /objectives/{id}:
 *   put:
 *     summary: Update an objective
 *     description: |
 *       Update objective with visibility hierarchy enforcement.
 *       Allowed when status is Draft or Rejected.
 *       When parent_objective_id changes, child visibility must be >= parent visibility (more private or equal).
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
 *                 description: Change parent objective (child visibility must be >= parent visibility)
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 description: |
 *                   Visibility level (must be >= parent visibility if parent changes)
 *                   - PUBLIC (1) < INTERNAL (2) < PRIVATE (3)
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional description for the objective (max 1000 characters)
 *     responses:
 *       200:
 *         description: Objective updated successfully
 *       400:
 *         description: Invalid objective ID or cannot be own parent
 *       403:
 *         description: No permission to update
 *       422:
 *         description: Validation error (e.g., child visibility more public than parent)
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
 *     description: |
 *       Approve objective (status must be Pending_Approval).
 *       Can optionally update title, parent, or visibility during approval.
 *       If parent_objective_id changes, child visibility must be >= parent visibility (more private or equal).
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
 *                 description: Set parent objective (child visibility must be >= parent visibility)
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 description: |
 *                   Visibility level (must be >= parent visibility if parent changes)
 *                   - PUBLIC (1) < INTERNAL (2) < PRIVATE (3)
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional description for the objective (max 1000 characters)
 *     responses:
 *       200:
 *         description: Objective approved successfully
 *       400:
 *         description: Objective not pending approval or invalid parent
 *       403:
 *         description: No permission to approve
 *       422:
 *         description: Validation error (e.g., child visibility more public than parent)
 */
router.post("/objectives/:id/approve", approveObjective);

/**
 * @swagger
 * /objectives/{id}/publish:
 *   patch:
 *     summary: Publish objective (Draft → progress-based status)
 *     description: |
 *       Publish a Draft objective directly to a progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, or COMPLETED).
 *       This bypasses the Pending_Approval workflow for admin/high-level users.
 *       Only users with approval permission (ADMIN_COMPANY or unit managers) can publish.
 *       Can optionally update title, parent, or visibility during publish.
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
 *                 description: Set parent objective (child visibility must be >= parent visibility)
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, INTERNAL, PRIVATE]
 *                 description: |
 *                   Visibility level (must be >= parent visibility if parent changes)
 *                   - PUBLIC (1) < INTERNAL (2) < PRIVATE (3)
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional description for the objective (max 1000 characters)
 *     responses:
 *       200:
 *         description: Objective published successfully
 *       400:
 *         description: Objective not in Draft status or invalid parent
 *       403:
 *         description: No permission to publish
 *       422:
 *         description: Validation error (e.g., child visibility more public than parent)
 */
router.patch("/objectives/:id/publish", publishObjective);

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
 * /objectives/{id}/revert-to-draft:
 *   post:
 *     summary: Revert objective to draft status
 *     description: |
 *       Revert an objective from Rejected, Pending_Approval, or any progress-based status (NOT_STARTED, ON_TRACK, AT_RISK, CRITICAL, COMPLETED) back to Draft.
 *       Only the objective owner, unit manager, or company admin can perform this action.
 *     tags: [Objectives]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Objective reverted to draft successfully
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
 *                     objective:
 *                       type: object
 *       400:
 *         description: Invalid objective ID or cannot revert from current status
 *       403:
 *         description: No permission to revert this objective
 *       404:
 *         description: Objective not found
 */
router.post("/objectives/:id/revert-to-draft", revertToDraft);

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
