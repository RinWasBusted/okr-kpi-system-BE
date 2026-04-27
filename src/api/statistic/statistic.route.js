import express from "express";
import { getKPITimeline, getOKRTimeline, getStatisticsSummary } from "./statistic.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("ADMIN_COMPANY"), getStatisticsSummary);

/**
 * @swagger
 * tags:
 *   - name: Statistics
 *     description: Statistics and analytics APIs
 */

/**
 * @swagger
 * /api/statistics/kpi-timeline:
 *   get:
 *     summary: Get KPI timeline data for chart visualization
 *     description: |
 *       Retrieves KPI progress data over time for a specific cycle.
 *       Returns timeline data showing progress_percentage for each KPI across different time periods.
 *       - group_by=month: Returns weekly data (YYYY-Www format)
 *       - group_by=year: Returns monthly data (YYYY-MM format)
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The cycle ID to get KPI data for
 *       - in: query
 *         name: group_by
 *         required: false
 *         schema:
 *           type: string
 *           enum: [month, year]
 *           default: month
 *         description: Aggregation level - 'month'=weekly data, 'year'=monthly data
 *     responses:
 *       200:
 *         description: KPI timeline data retrieved successfully
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
 *                           format: date
 *                         end_date:
 *                           type: string
 *                           format: date
 *                     group_by:
 *                       type: string
 *                       enum: [month, year]
 *                     periods:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: All time periods in the cycle for consistent x-axis
 *                     kpis:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           kpi_id:
 *                             type: integer
 *                           kpi_name:
 *                             type: string
 *                           unit:
 *                             type: string
 *                           evaluation_method:
 *                             type: string
 *                           target_value:
 *                             type: number
 *                           current_progress:
 *                             type: number
 *                             description: Current progress percentage (0-100)
 *                           assignments:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 assignment_id:
 *                                   type: integer
 *                                 unit_id:
 *                                   type: integer
 *                                 unit_name:
 *                                   type: string
 *                                 owner_id:
 *                                   type: integer
 *                                 owner_name:
 *                                   type: string
 *                           timeline:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 period:
 *                                   type: string
 *                                   description: Period identifier (YYYY-Www for week, YYYY-MM for month)
 *                                 period_start:
 *                                   type: string
 *                                   format: date
 *                                 period_end:
 *                                   type: string
 *                                   format: date
 *                                 actual_value:
 *                                   type: number
 *                                 progress_percentage:
 *                                   type: number
 *                                   description: Progress percentage at this period
 *                                 status:
 *                                   type: string
 *                                   enum: [ON_TRACK, AT_RISK, CRITICAL]
 *                                 trend:
 *                                   type: string
 *                                   enum: [Upward, Downward, Stable]
 *       403:
 *         description: No permission to access this cycle
 *       404:
 *         description: Cycle not found
 *       422:
 *         description: Validation error (e.g., missing cycle_id)
 */
router.get("/kpi-timeline", getKPITimeline);

/**
 * @swagger
 * /api/statistics/okr-timeline:
 *   get:
 *     summary: Get OKR timeline data for chart visualization
 *     description: |
 *       Retrieves OKR progress data over time for a specific cycle.
 *       Returns timeline data showing progress_percentage for each Objective across different time periods.
 *       Progress is calculated from check-ins on Key Results, weighted by KR weight.
 *       - group_by=month: Returns weekly data (YYYY-Www format)
 *       - group_by=year: Returns monthly data (YYYY-MM format)
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The cycle ID to get OKR data for
 *       - in: query
 *         name: group_by
 *         required: false
 *         schema:
 *           type: string
 *           enum: [month, year]
 *           default: month
 *         description: Aggregation level - 'month'=weekly data, 'year'=monthly data
 *     responses:
 *       200:
 *         description: OKR timeline data retrieved successfully
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
 *                           format: date
 *                         end_date:
 *                           type: string
 *                           format: date
 *                     group_by:
 *                       type: string
 *                       enum: [month, year]
 *                     periods:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: All time periods in the cycle for consistent x-axis
 *                     objectives:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           objective_id:
 *                             type: integer
 *                           objective_title:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [Draft, Active, Pending_Approval, Rejected, Completed]
 *                           current_progress:
 *                             type: number
 *                             description: Current progress percentage (0-100)
 *                           unit_id:
 *                             type: integer
 *                           unit_name:
 *                             type: string
 *                           owner_id:
 *                             type: integer
 *                           owner_name:
 *                             type: string
 *                           key_results:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 kr_id:
 *                                   type: integer
 *                                 title:
 *                                   type: string
 *                                 target_value:
 *                                   type: number
 *                                 current_value:
 *                                   type: number
 *                                 progress_percentage:
 *                                   type: number
 *                                 weight:
 *                                   type: number
 *                           timeline:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 period:
 *                                   type: string
 *                                   description: Period identifier (YYYY-Www for week, YYYY-MM for month)
 *                                 period_start:
 *                                   type: string
 *                                   format: date
 *                                 period_end:
 *                                   type: string
 *                                   format: date
 *                                 progress_percentage:
 *                                   type: number
 *                                   description: Weighted progress from KR check-ins at this period
 *       403:
 *         description: No permission to access this cycle
 *       404:
 *         description: Cycle not found
 *       422:
 *         description: Validation error (e.g., missing cycle_id)
 */
router.get("/okr-timeline", getOKRTimeline);

export default router;
