import express from "express";
import {
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit
} from "./unit.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, authorize("ADMIN_COMPANY"));

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
 *     description: Returns a flat list of all units in the company. Use `parent_id` to build a tree on the frontend. Requires `accessToken` cookie.
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
 *         description: Records per page
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
 *                       member_count:
 *                         type: integer
 *                         example: 12
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
router.get("/", getUnits);

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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Frontend Team"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *                 description: ID of the parent unit. Omit or set null for a top-level unit.
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
router.post("/", createUnit);

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
 *                 example: "Backend Team"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *                 description: New parent unit. Set null to promote to top-level.
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
router.put("/:id", updateUnit);

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
router.delete("/:id", deleteUnit);

export default router;
