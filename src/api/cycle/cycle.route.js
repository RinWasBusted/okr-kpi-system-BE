import express from "express";
import {
    getCycles,
    getCycleById,
    createCycle,
    updateCycle,
    deleteCycle,
    lockCycle,
    cloneCycle,
} from "./cycle.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Cycles
 *     description: OKR/KPI cycle management APIs
 */

/**
 * @swagger
 * /cycles:
 *   get:
 *     summary: Get list of cycles
 *     description: Returns a paginated list of cycles with open cycles count. Requires `accessToken` cookie and `ADMIN_COMPANY` role. Employee can only see cycle names through Objective/KPI references.
 *     tags: [Cycles]
 *     parameters:
 *       - in: query
 *         name: is_locked
 *         schema:
 *           type: boolean
 *         description: true = only locked cycles, false = only unlocked cycles
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by start year (e.g. 2026)
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
 *           default: 20
 *           maximum: 100
 *         description: Records per page (max 100)
 *     responses:
 *       200:
 *         description: Cycles retrieved successfully
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
 *                       start_date:
 *                         type: string
 *                         format: date
 *                       end_date:
 *                         type: string
 *                         format: date
 *                       is_locked:
 *                         type: boolean
 *                       days_remaining:
 *                         type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     open_cycles_count:
 *                       type: integer
 *                       description: Number of unlocked cycles
 *                     page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     last_page:
 *                       type: integer
 */
router.get("/", authorize("ADMIN_COMPANY"), getCycles);

/**
 * @swagger
 * /cycles:
 *   post:
 *     summary: Create a new cycle
 *     description: Create a new cycle. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Cycles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, start_date, end_date]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Q2/2026"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-30"
 *     responses:
 *       201:
 *         description: Cycle created successfully
 *       422:
 *         description: Validation error (DATE_OVERLAP or invalid dates)
 */
router.post("/", authorize("ADMIN_COMPANY"), createCycle);

/**
 * @swagger
 * /cycles/{id}:
 *   get:
 *     summary: Get cycle detail
 *     description: Get detailed information of a cycle including statistics. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Cycle ID
 *     responses:
 *       200:
 *         description: Cycle retrieved successfully
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
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         start_date:
 *                           type: string
 *                           format: date-time
 *                         end_date:
 *                           type: string
 *                           format: date-time
 *                         is_locked:
 *                           type: boolean
 *                         days_remaining:
 *                           type: integer
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             total_objectives:
 *                               type: integer
 *                             total_kpis:
 *                               type: integer
 *                             avg_objective_progress:
 *                               type: number
 *                               description: Average progress of all objectives (0-100)
 *                             avg_kpi_progress:
 *                               type: number
 *                               description: Average progress of all KPIs (0-100)
 *       404:
 *         description: Cycle not found
 */
router.get("/:id", getCycleById);

/**
 * @swagger
 * /cycles/{id}:
 *   put:
 *     summary: Update a cycle
 *     description: Update a cycle when it is not locked. Requires `ADMIN_COMPANY` role.
 *     tags: [Cycles]
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
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Cycle updated successfully
 */
router.put("/:id", authorize("ADMIN_COMPANY"), updateCycle);

/**
 * @swagger
 * /cycles/{id}:
 *   delete:
 *     summary: Delete a cycle
 *     description: Delete a cycle that has no objectives or KPI assignments. Requires `ADMIN_COMPANY` role.
 *     tags: [Cycles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Cycle ID
 *     responses:
 *       200:
 *         description: Cycle deleted successfully
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
 *                     deleted_cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *       400:
 *         description: Cannot delete cycle - has existing objectives or KPI assignments
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Cycle not found
 */
router.delete("/:id", authorize("ADMIN_COMPANY"), deleteCycle);

/**
 * @swagger
 * /cycles/{id}/lock:
 *   patch:
 *     summary: Lock a cycle
 *     description: Lock a cycle to make it read-only. Requires `ADMIN_COMPANY` role.
 *     tags: [Cycles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cycle locked successfully
 */
router.patch("/:id/lock", authorize("ADMIN_COMPANY"), lockCycle);

/**
 * @swagger
 * /cycles/{id}/clone:
 *   post:
 *     summary: Clone a cycle into a new cycle
 *     description: Clone a cycle into a brand new cycle with the same info and structure. Requires `ADMIN_COMPANY` role.
 *     tags: [Cycles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cycle cloned successfully
 */
router.post("/:id/clone", authorize("ADMIN_COMPANY"), cloneCycle);

export default router;
