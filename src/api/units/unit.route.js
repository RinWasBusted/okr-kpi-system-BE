import express from "express";
import {
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit,
    getUnitDetail,
    getUnitInfo,
    getUnitEvaluations,
} from "./unit.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { createUnitSchema, updateUnitSchema, listUnitsQuerySchema } from "../../schemas/unit.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Units
 *     description: Unit / department management APIs
 */

/**
 * @swagger
 * /units:
 *   get:
 *     summary: Get list of units
 *     description: Returns units in the company. Use `mode` to specify tree or flat list. Requires `accessToken` cookie.
 *     tags: [Units]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Current page number
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 100
 *         description: Records per page (max 100)
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [tree, list]
 *           default: tree
 *         description: Response format - "tree" returns hierarchical structure with sub_units, "list" returns flat list
 *     responses:
 *       200:
 *         description: Units retrieved successfully
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
 *                   example: "Units retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Engineering"
 *                       parent_id:
 *                         type: integer
 *                         nullable: true
 *                         example: null
 *                       path:
 *                         type: string
 *                         example: "1.3.5"
 *                       manager:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           full_name:
 *                             type: string
 *                             example: "Nguyen Van A"
 *                       manager_name:
 *                         type: string
 *                         nullable: true
 *                         example: "Nguyen Van A"
 *                       member_count:
 *                         type: integer
 *                         example: 12
 *                       okr_count:
 *                         type: integer
 *                         example: 5
 *                       kpi_count:
 *                         type: integer
 *                         example: 3
 *                       okr_progress:
 *                         type: number
 *                         nullable: true
 *                         example: 67.5
 *                       kpi_health:
 *                         type: number
 *                         nullable: true
 *                         example: 82.3
 *                       sub_units:
 *                         type: array
 *                         description: Only present in tree mode
 *                         items:
 *                           type: object
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-01T00:00:00.000Z"
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 100
 *                     total:
 *                       type: integer
 *                       example: 8
 *                     mode:
 *                       type: string
 *                       example: "tree"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 */
router.get("/", validate(listUnitsQuerySchema, "query"), getUnits);

/**
 * @swagger
 * /units/{id}/info:
 *   get:
 *     summary: Get unit basic info
 *     description: Retrieve basic information about a specific unit including manager name, job title, and email. Requires `accessToken` cookie.
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unit ID
 *     responses:
 *       200:
 *         description: Unit info retrieved successfully
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
 *                   example: "Unit info retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unit_id:
 *                       type: integer
 *                       example: 1
 *                     unit_name:
 *                       type: string
 *                       example: "Engineering"
 *                     manager_name:
 *                       type: string
 *                       nullable: true
 *                       example: "Nguyen Van A"
 *                     manager_job_title:
 *                       type: string
 *                       nullable: true
 *                       example: "Engineering Lead"
 *                     manager_email:
 *                       type: string
 *                       nullable: true
 *                       example: "manager@example.com"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       404:
 *         description: Unit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 */
router.get("/:id/info", getUnitInfo);

/**
 * @swagger
 * /units/{id}/evaluations:
 *   get:
 *     summary: Get unit evaluations
 *     description: |
 *       Retrieve performance evaluations for all members of a specific unit in a given cycle.
 *       Returns a list of evaluations including OKR/KPI progress, composite scores, and performance ratings.
 *       Only `ADMIN_COMPANY` users can access this endpoint. Requires `accessToken` cookie.
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unit ID
 *       - in: query
 *         name: cycle_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: OKR/KPI cycle ID for which to retrieve evaluations
 *         example: 1
 *     responses:
 *       200:
 *         description: Unit evaluations retrieved successfully
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
 *                   example: "Unit evaluations retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Evaluation ID
 *                         example: 1
 *                       evaluatee:
 *                         type: object
 *                         description: Employee being evaluated
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 10
 *                           full_name:
 *                             type: string
 *                             example: "Nguyễn Văn A"
 *                           job_title:
 *                             type: string
 *                             nullable: true
 *                             example: "Senior Developer"
 *                           avatar_url:
 *                             type: string
 *                             nullable: true
 *                             format: url
 *                             example: "https://res.cloudinary.com/image.jpg"
 *                       unit:
 *                         type: object
 *                         description: Unit information
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           name:
 *                             type: string
 *                             example: "Engineering"
 *                       okr_count:
 *                         type: integer
 *                         description: Number of OKRs assigned to employee
 *                         example: 3
 *                       kpi_count:
 *                         type: integer
 *                         description: Number of KPIs assigned to employee
 *                         example: 5
 *                       avg_okr_progress:
 *                         type: number
 *                         description: Average OKR progress percentage (0-100)
 *                         example: 85.5
 *                       avg_kpi_progress:
 *                         type: number
 *                         description: Average KPI progress percentage (0-100)
 *                         example: 78.2
 *                       composite_score:
 *                         type: number
 *                         description: Overall performance score (weighted average of OKR and KPI progress)
 *                         example: 81.85
 *                       rating:
 *                         type: string
 *                         enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *                         description: Performance rating based on composite_score
 *                         example: "EXCELLENT"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-04-20T10:30:00Z"
 *       400:
 *         description: Invalid unit ID or missing cycle_id parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     message:
 *                       type: string
 *                       example: "cycle_id is required"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       403:
 *         description: Forbidden - Only ADMIN_COMPANY users can access
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FORBIDDEN"
 *                     message:
 *                       type: string
 *                       example: "Access denied"
 *       404:
 *         description: Unit or cycle not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 */
router.get("/:id/evaluations", authorize("ADMIN_COMPANY"), getUnitEvaluations);

/**
 * @swagger
 * /units/{id}/detail:
 *   get:
 *     summary: Get unit details
 *     description: Retrieve detailed information about a specific unit including manager info, KPI assignments count, and objectives count. Requires `accessToken` cookie.
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unit ID
 *     responses:
 *       200:
 *         description: Unit detail retrieved successfully
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
 *                   example: "Unit detail retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Engineering"
 *                     parent_id:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *                     manager:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 5
 *                         full_name:
 *                           type: string
 *                           example: "Nguyen Van A"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: "manager@example.com"
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           example: "https://example.com/avatar.jpg"
 *                         job_title:
 *                           type: string
 *                           nullable: true
 *                           example: "Engineering Lead"
 *                     total_kpi:
 *                       type: integer
 *                       example: 12
 *                     total_objective:
 *                       type: integer
 *                       example: 8
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       404:
 *         description: Unit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 */
router.get("/:id/detail", getUnitDetail);

/**
 * @swagger
 * /units:
 *   post:
 *     summary: Create a new unit
 *     description: Creates a new department or team within the company. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Units]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, parent_id]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Frontend Team"
 *               parent_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID of the parent unit. Required — the root company unit is created automatically with the company.
 *               manager_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 5
 *                 description: user_id of the unit manager. Must be an employee in this company.
 *     responses:
 *       201:
 *         description: Unit created successfully
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
 *                   example: "Unit created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unit:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 3
 *                         name:
 *                           type: string
 *                           example: "Frontend Team"
 *                         parent_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 1
 *                         path:
 *                           type: string
 *                           example: "1.3"
 *                         manager:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 5
 *                             full_name:
 *                               type: string
 *                               example: "Nguyen Van A"
 *                         member_count:
 *                           type: integer
 *                           example: 0
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-03-21T00:00:00.000Z"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FORBIDDEN"
 *                     message:
 *                       type: string
 *                       example: "Access denied"
 *       404:
 *         description: Parent unit or manager not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Parent unit not found"
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "name is required"
 */
router.post("/", authorize("ADMIN_COMPANY"), validate(createUnitSchema), createUnit);

/**
 * @swagger
 * /units/{id}:
 *   put:
 *     summary: Update unit information
 *     description: Update unit name, parent, or manager. Circular hierarchy is prevented. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unit ID
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
 *                 example: "Backend Team"
 *               parent_id:
 *                 type: integer
 *                 example: 2
 *                 description: New parent unit. Cannot be set to null — the root unit is immutable.
 *               manager_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 7
 *                 description: New manager user_id. Set null to remove manager.
 *     responses:
 *       200:
 *         description: Unit updated successfully
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
 *                   example: "Unit updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unit:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 3
 *                         name:
 *                           type: string
 *                           example: "Backend Team"
 *                         parent_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                         path:
 *                           type: string
 *                           example: "1.2.3"
 *                         manager:
 *                           type: object
 *                           nullable: true
 *                         member_count:
 *                           type: integer
 *                           example: 5
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-01-01T00:00:00.000Z"
 *       400:
 *         description: No fields provided or circular hierarchy detected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     message:
 *                       type: string
 *                       example: "Circular unit hierarchy is not allowed"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FORBIDDEN"
 *                     message:
 *                       type: string
 *                       example: "Access denied"
 *       404:
 *         description: Unit, parent unit, or manager not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 */
router.put("/:id", authorize("ADMIN_COMPANY"), validate(updateUnitSchema), updateUnit);

/**
 * @swagger
 * /units/{id}:
 *   delete:
 *     summary: Delete a unit
 *     description: Permanently deletes a unit. Only allowed when the unit has no members and no child units. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Units]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unit ID
 *     responses:
 *       204:
 *         description: Unit deleted successfully. No response body.
 *       400:
 *         description: Unit still has members or child units
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     message:
 *                       type: string
 *                       example: "Unit still has members and cannot be deleted"
 *       401:
 *         description: Access token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FORBIDDEN"
 *                     message:
 *                       type: string
 *                       example: "Access denied"
 *       404:
 *         description: Unit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 */
router.delete("/:id", authorize("ADMIN_COMPANY"), deleteUnit);

export default router;
