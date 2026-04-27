import express from "express";
import {
    getCycles,
    getCycleById,
    getCycleEvaluations,
    createCycle,
    updateCycle,
    deleteCycle,
    lockCycle,
    unlockCycle,
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
router.get("/", authenticate, getCycles);

/**
 * @swagger
 * /cycles:
 *   post:
 *     summary: Tạo một chu kỳ mới
 *     description: |
 *       Tạo một chu kỳ OKR/KPI mới.
 *       Các ngày end_date phải sau start_date.
 *       Chỉ Admin công ty mới có quyền tạo. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
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
 *                 minLength: 1
 *                 example: "Q2/2026"
 *                 description: Tên chu kỳ
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-01"
 *                 description: Ngày bắt đầu (YYYY-MM-DD)
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-30"
 *                 description: Ngày kết thúc (YYYY-MM-DD), phải sau start_date
 *     responses:
 *       201:
 *         description: Chu kỳ được tạo thành công
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
 *                   example: "Cycle created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 5
 *                         name:
 *                           type: string
 *                           example: "Q2/2026"
 *                         start_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-04-01T00:00:00Z"
 *                         end_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-06-30T00:00:00Z"
 *                         is_locked:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Company context required hoặc bad request
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       422:
 *         description: Validation error (invalid date format hoặc end_date không sau start_date)
 */
router.post("/", authorize("ADMIN_COMPANY"),createCycle);

/**
 * @swagger
 * /cycles/{id}/evaluations:
 *   get:
 *     summary: Lấy danh sách đánh giá của chu kỳ
 *     description: |
 *       Lấy danh sách đánh giá hiệu suất của tất cả nhân viên trong một chu kỳ cụ thể.
 *       Hỗ trợ lọc theo đơn vị, xếp hạng và phân trang.
 *       Chỉ Admin công ty mới có quyền xem. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ
 *         example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang (bắt đầu từ 1)
 *         example: 1
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Số lượng kết quả trên một trang (tối đa 100)
 *         example: 20
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: integer
 *         description: Lọc theo ID đơn vị (optional)
 *         example: 5
 *       - in: query
 *         name: rating
 *         schema:
 *           type: string
 *           enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *         description: Lọc theo xếp hạng (optional)
 *         example: "EXCELLENT"
 *     responses:
 *       200:
 *         description: Danh sách đánh giá được lấy thành công
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
 *                   example: "Cycle evaluations retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       evaluatee:
 *                         type: object
 *                         description: Thông tin nhân viên được đánh giá
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
 *                         description: Thông tin đơn vị
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           name:
 *                             type: string
 *                             example: "Engineering"
 *                       okr_count:
 *                         type: integer
 *                         example: 3
 *                       kpi_count:
 *                         type: integer
 *                         example: 5
 *                       avg_okr_progress:
 *                         type: number
 *                         description: Tiến độ trung bình OKR (0-100)
 *                         example: 85.5
 *                       avg_kpi_progress:
 *                         type: number
 *                         description: Tiến độ trung bình KPI (0-100)
 *                         example: 78.2
 *                       composite_score:
 *                         type: number
 *                         description: Điểm hợp thành (trung bình của OKR và KPI progress)
 *                         example: 81.85
 *                       rating:
 *                         type: string
 *                         enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *                         example: "EXCELLENT"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-04-20T10:30:00Z"
 *                 meta:
 *                   type: object
 *                   description: Thông tin phân trang
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 20
 *                     last_page:
 *                       type: integer
 *                       example: 5
 *       400:
 *         description: Invalid cycle ID
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Cycle not found
 */
router.get("/:id/evaluations", authorize("ADMIN_COMPANY"), getCycleEvaluations);

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
 *     summary: Cập nhật thông tin chu kỳ
 *     description: |
 *       Cập nhật tên, ngày bắt đầu hoặc ngày kết thúc của chu kỳ.
 *       Chu kỳ không được khóa mới có thể cập nhật.
 *       Chỉ Admin công ty mới có quyền. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ
 *         example: 1
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
 *                 example: "Q3/2026"
 *                 description: Tên chu kỳ (optional)
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-07-01"
 *                 description: Ngày bắt đầu YYYY-MM-DD (optional)
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-30"
 *                 description: Ngày kết thúc YYYY-MM-DD (optional)
 *     responses:
 *       200:
 *         description: Chu kỳ được cập nhật thành công
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
 *                   example: "Cycle updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Q3/2026"
 *                         start_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-07-01T00:00:00Z"
 *                         end_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-09-30T00:00:00Z"
 *                         is_locked:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Bad request (chu kỳ bị khóa, end_date không sau start_date, hoặc không có field để cập nhật)
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Cycle not found
 *       422:
 *         description: Validation error (invalid date format)
 */
router.put("/:id", authorize("ADMIN_COMPANY"), updateCycle);

/**
 * @swagger
 * /cycles/{id}:
 *   delete:
 *     summary: Xóa chu kỳ
 *     description: |
 *       Xóa một chu kỳ. Chỉ có thể xóa chu kỳ khi không có Objective hoặc KPI Assignment nào.
 *       Chỉ Admin công ty mới có quyền. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ
 *         example: 1
 *     responses:
 *       200:
 *         description: Chu kỳ được xóa thành công
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
 *                   example: "Cycle deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Q1/2026"
 *       400:
 *         description: Bad request - chu kỳ vẫn còn Objectives hoặc KPI Assignments
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Cycle not found
 */
router.delete("/:id", authorize("ADMIN_COMPANY"), deleteCycle);

/**
 * @swagger
 * /cycles/{id}/lock:
 *   patch:
 *     summary: Khóa chu kỳ
 *     description: |
 *       Khóa một chu kỳ để cho phép chỉ đọc các OKR/KPI.
 *       Khi chu kỳ bị khóa, không thể tạo, sửa hoặc xóa Objectives và KPI Assignments.
 *       Chỉ Admin công ty mới có quyền. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ
 *         example: 1
 *     responses:
 *       200:
 *         description: Chu kỳ được khóa thành công
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
 *                   example: "Cycle locked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Q1/2026"
 *                         is_locked:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Bad request - Company context required
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Cycle not found
 */
router.patch("/:id/lock", authorize("ADMIN_COMPANY"), lockCycle);

/**
 * @swagger
 * /cycles/{id}/unlock:
 *   patch:
 *     summary: Mở khóa chu kỳ
 *     description: |
 *       Mở khóa một chu kỳ để cho phép sửa các OKR/KPI.
 *       Khi chu kỳ được mở khóa, có thể tạo, sửa hoặc xóa Objectives và KPI Assignments.
 *       Chỉ Admin công ty mới có quyền. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ
 *         example: 1
 *     responses:
 *       200:
 *         description: Chu kỳ được mở khóa thành công
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
 *                   example: "Cycle unlocked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Q1/2026"
 *                         is_locked:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Bad request - Company context required
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Cycle not found
 */
router.patch("/:id/unlock", authorize("ADMIN_COMPANY"), unlockCycle);

/**
 * @swagger
 * /cycles/{id}/clone:
 *   post:
 *     summary: Sao chép Objectives và KPIs vào chu kỳ này
 *     description: |
 *       Sao chép các Objectives và KPI Assignments từ chu kỳ khác vào chu kỳ đích (ID trong URL).
 *       - Progress của các items được sao chép sẽ được reset về 0
 *       - Các mối quan hệ parent-child sẽ được bảo toàn
 *       - Key Results được tự động sao chép cùng Objectives
 *       - Chu kỳ đích không được khóa
 *       Chỉ Admin công ty mới có quyền. Requires `accessToken` cookie.
 *     tags: [Cycles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chu kỳ đích (nơi sao chép vào)
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               objective_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 5, 12]
 *                 description: Danh sách ID của Objectives cần sao chép (nếu để trống hoặc không cung cấp, sẽ không sao chép Objectives)
 *               kpi_assignment_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [3, 8]
 *                 description: Danh sách ID của KPI Assignments cần sao chép (nếu để trống hoặc không cung cấp, sẽ không sao chép KPIs)
 *     responses:
 *       201:
 *         description: Sao chép thành công
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
 *                   example: "Items cloned successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cloned_objective_ids:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: Danh sách ID của Objectives đã được sao chép (các ID mới)
 *                       example: [101, 102, 103]
 *                     cloned_kpi_assignment_ids:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: Danh sách ID của KPI Assignments đã được sao chép (các ID mới)
 *                       example: [201, 202]
 *       400:
 *         description: Bad request (chu kỳ đích bị khóa hoặc company context bị thiếu)
 *       403:
 *         description: Forbidden - chỉ ADMIN_COMPANY mới có quyền
 *       404:
 *         description: Target cycle not found
 *       422:
 *         description: Validation error (objective_ids hoặc kpi_assignment_ids không phải array)
 */
router.post("/:id/clone", authorize("ADMIN_COMPANY"), cloneCycle);

export default router;
