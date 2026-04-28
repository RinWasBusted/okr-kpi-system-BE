import express from "express";
import { authenticate, authorize } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
    generateEvaluations,
    getEvaluations,
    getMyEvaluations,
    getEvaluationDetail,
    getCompanyEmployees,
} from "./evaluations.controller.js";
import {
    generateEvaluationsBodySchema,
    listEvaluationsQuerySchema,
    listEvaluationHistoryQuerySchema,
    companyEmployeesEvaluationsQuerySchema,
} from "../../schemas/evaluation.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /evaluations/generate:
 *   post:
 *     summary: Tạo đánh giá cho chu kỳ
 *     description: |
 *       Tạo đánh giá hiệu suất cho tất cả nhân viên trong chu kỳ được chỉ định.
 *       Chỉ Admin công ty mới có quyền thực hiện.
 *       API này sẽ:
 *       - Lấy tất cả OKR và KPI được gán cho nhân viên
 *       - Tính toán tiến độ trung bình của OKR và KPI
 *       - Tính điểm hợp thành từ OKR và KPI progress
 *       - Xếp hạng nhân viên dựa trên điểm (EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT)
 *       - Lưu trữ đánh giá trong database
 *     tags:
 *       - Evaluations
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cycle_id:
 *                 type: integer
 *                 description: ID của chu kỳ OKR/KPI
 *                 example: 1
 *             required:
 *               - cycle_id
 *     responses:
 *       200:
 *         description: Đánh giá được tạo thành công
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
 *                   example: "Evaluation generated"
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     generated_count:
 *                       type: integer
 *                       description: Số lượng đánh giá được tạo
 *                       example: 25
 *                     cycle_id:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Invalid request (cycle_id không hợp lệ)
 *       403:
 *         description: Forbidden (người dùng không phải Admin hoặc thiếu company context)
 *       500:
 *         description: Internal server error
 */
router.post(
    "/generate",
    authorize("ADMIN_COMPANY"),
    validate(generateEvaluationsBodySchema),
    generateEvaluations,
);

/**
 * @swagger
 * /evaluations:
 *   get:
 *     summary: Lấy danh sách đánh giá
 *     description: |
 *       Lấy danh sách đánh giá hiệu suất của tất cả nhân viên trong công ty.
 *       Chỉ Admin công ty mới có quyền xem.
 *       Hỗ trợ lọc theo chu kỳ, đơn vị, xếp hạng và phân trang.
 *     tags:
 *       - Evaluations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *         description: ID của chu kỳ OKR/KPI
 *         example: "1"
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *         description: ID của đơn vị (optional - lọc theo đơn vị cụ thể)
 *         example: "5"
 *       - in: query
 *         name: rating
 *         schema:
 *           type: string
 *           enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *         description: Xếp hạng hiệu suất (optional)
 *         example: "EXCELLENT"
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *           default: "1"
 *         description: Trang (bắt đầu từ 1)
 *         example: "1"
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *           default: "20"
 *           maximum: 100
 *         description: Số lượng kết quả trên một trang (tối đa 100)
 *         example: "20"
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
 *                   example: "Evaluations retrieved successfully"
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: ID của đánh giá
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
 *                         description: Thông tin đơn vị của nhân viên
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           name:
 *                             type: string
 *                             example: "Engineering"
 *                       okr_count:
 *                         type: integer
 *                         description: Số lượng OKR được gán
 *                         example: 3
 *                       kpi_count:
 *                         type: integer
 *                         description: Số lượng KPI được gán
 *                         example: 5
 *                       avg_okr_progress:
 *                         type: number
 *                         description: Tiến độ trung bình của OKR (0-100)
 *                         example: 85.5
 *                       avg_kpi_progress:
 *                         type: number
 *                         description: Tiến độ trung bình của KPI (0-100)
 *                         example: 78.2
 *                       composite_score:
 *                         type: number
 *                         description: Điểm hợp thành (trung bình của OKR và KPI progress)
 *                         example: 81.85
 *                       rating:
 *                         type: string
 *                         enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *                         description: Xếp hạng hiệu suất dựa trên composite_score
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
 *                       description: Tổng số lượng đánh giá
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 20
 *                     last_page:
 *                       type: integer
 *                       description: Trang cuối cùng
 *                       example: 5
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Forbidden (người dùng không phải Admin hoặc thiếu company context)
 *       500:
 *         description: Internal server error
 */
router.get(
    "/",
    authorize("ADMIN_COMPANY"),
    validate(listEvaluationsQuerySchema, "query"),
    getEvaluations,
);

/**
 * @swagger
 * /evaluations/employees:
 *   get:
 *     summary: Lấy danh sách toàn bộ nhân viên trong công ty và thông tin đánh giá
 *     description: |
 *       Lấy danh sách tất cả các nhân viên đang hoạt động trong công ty dựa trên chu kỳ.
 *       Bao gồm thông tin cơ bản của nhân viên và các trường id, cycle_id, avg_kpi_progress từ bảng Evaluations sau khi đã có đánh giá ở cuối chu kỳ đó.
 *     tags:
 *       - Evaluations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *         description: ID của chu kỳ đánh giá
 *         example: "1"
 *     responses:
 *       200:
 *         description: Lấy danh sách nhân viên thành công
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
 *                   example: "Company employees evaluations retrieved successfully"
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: integer
 *                         example: 10
 *                       full_name:
 *                         type: string
 *                         example: "Nguyễn Văn A"
 *                       email:
 *                         type: string
 *                         example: "nguyenvana@example.com"
 *                       avatar_url:
 *                         type: string
 *                         nullable: true
 *                         format: url
 *                       job_title:
 *                         type: string
 *                         nullable: true
 *                         example: "Developer"
 *                       id:
 *                         type: integer
 *                         nullable: true
 *                         description: ID của bản ghi đánh giá
 *                         example: 1
 *                       cycle_id:
 *                         type: integer
 *                         nullable: true
 *                         example: 1
 *                       avg_kpi_progress:
 *                         type: number
 *                         nullable: true
 *                         example: 85.5
 *                       z_score:
 *                         type: number
 *                         nullable: true
 *                         example: 1.25
 *                       verdict:
 *                         type: string
 *                         nullable: true
 *                         example: "AVERAGE"
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Forbidden (người dùng không phải Admin hoặc thiếu company context)
 *       404:
 *         description: Cycle not found
 *       500:
 *         description: Internal server error
 */
router.get(
    "/employees",
    authorize("ADMIN_COMPANY"),
    validate(companyEmployeesEvaluationsQuerySchema, "query"),
    getCompanyEmployees,
);

/**
 * @swagger
 * /evaluations/me:
 *   get:
 *     summary: Lấy lịch sử đánh giá của tôi
 *     description: |
 *       Lấy danh sách các đánh giá của người dùng hiện tại.
 *       Người dùng có thể xem các đánh giá về hiệu suất của chính họ ở các chu kỳ khác nhau.
 *       Hỗ trợ phân trang.
 *     tags:
 *       - Evaluations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *           default: "1"
 *         description: Trang (bắt đầu từ 1)
 *         example: "1"
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: string
 *           pattern: '^\d+$'
 *           default: "10"
 *           maximum: 100
 *         description: Số lượng kết quả trên một trang (tối đa 100)
 *         example: "10"
 *     responses:
 *       200:
 *         description: Lịch sử đánh giá của người dùng được lấy thành công
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
 *                   example: "My evaluations retrieved successfully"
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: ID của đánh giá
 *                         example: 1
 *                       cycle:
 *                         type: object
 *                         description: Thông tin chu kỳ đánh giá
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "Q1 2025"
 *                           start_date:
 *                             type: string
 *                             format: date
 *                             example: "2025-01-01"
 *                           end_date:
 *                             type: string
 *                             format: date
 *                             example: "2025-03-31"
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
 *                         description: Số lượng OKR được gán
 *                         example: 3
 *                       kpi_count:
 *                         type: integer
 *                         description: Số lượng KPI được gán
 *                         example: 5
 *                       avg_okr_progress:
 *                         type: number
 *                         description: Tiến độ trung bình của OKR (0-100)
 *                         example: 85.5
 *                       avg_kpi_progress:
 *                         type: number
 *                         description: Tiến độ trung bình của KPI (0-100)
 *                         example: 78.2
 *                       composite_score:
 *                         type: number
 *                         description: Điểm hợp thành (trung bình của OKR và KPI progress)
 *                         example: 81.85
 *                       rating:
 *                         type: string
 *                         enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *                         description: Xếp hạng hiệu suất
 *                         example: "GOOD"
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
 *                       description: Tổng số lượng đánh giá của người dùng
 *                       example: 4
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 10
 *                     last_page:
 *                       type: integer
 *                       description: Trang cuối cùng
 *                       example: 1
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Forbidden (thiếu company context)
 *       500:
 *         description: Internal server error
 */
router.get(
    "/me",
    validate(listEvaluationHistoryQuerySchema, "query"),
    getMyEvaluations,
);

/**
 * @swagger
 * /evaluations/{id}:
 *   get:
 *     summary: Lấy chi tiết một đánh giá
 *     description: |
 *       Lấy thông tin chi tiết của một đánh giá cụ thể.
 *       Bao gồm tất cả thông tin về nhân viên được đánh giá, chu kỳ, OKR, KPI, điểm số và xếp hạng.
 *       Người dùng có thể xem đánh giá của mình hoặc nếu là Admin thì có thể xem bất kỳ đánh giá nào.
 *     tags:
 *       - Evaluations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của đánh giá
 *         example: 1
 *     responses:
 *       200:
 *         description: Chi tiết đánh giá được lấy thành công
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
 *                   example: "Evaluation retrieved successfully"
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     cycle:
 *                       type: object
 *                       description: Thông tin chu kỳ
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Q1 2025"
 *                         start_date:
 *                           type: string
 *                           format: date
 *                           example: "2025-01-01"
 *                         end_date:
 *                           type: string
 *                           format: date
 *                           example: "2025-03-31"
 *                     evaluatee:
 *                       type: object
 *                       description: Thông tin nhân viên được đánh giá
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 10
 *                         full_name:
 *                           type: string
 *                           example: "Nguyễn Văn A"
 *                         job_title:
 *                           type: string
 *                           nullable: true
 *                           example: "Senior Developer"
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           format: url
 *                           example: "https://res.cloudinary.com/image.jpg"
 *                     unit:
 *                       type: object
 *                       description: Thông tin đơn vị
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 5
 *                         name:
 *                           type: string
 *                           example: "Engineering"
 *                     okr_count:
 *                       type: integer
 *                       description: Số lượng OKR được gán
 *                       example: 3
 *                     kpi_count:
 *                       type: integer
 *                       description: Số lượng KPI được gán
 *                       example: 5
 *                     avg_okr_progress:
 *                       type: number
 *                       description: Tiến độ trung bình của OKR (0-100)
 *                       example: 85.5
 *                     avg_kpi_progress:
 *                       type: number
 *                       description: Tiến độ trung bình của KPI (0-100)
 *                       example: 78.2
 *                     composite_score:
 *                       type: number
 *                       description: Điểm hợp thành (trung bình OKR và KPI)
 *                       example: 81.85
 *                     rating:
 *                       type: string
 *                       enum: [EXCELLENT, GOOD, ABOVE_AVERAGE, SATISFACTORY, NEEDS_IMPROVEMENT]
 *                       description: Xếp hạng hiệu suất
 *                       example: "EXCELLENT"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-04-20T10:30:00Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-04-20T10:30:00Z"
 *       400:
 *         description: Invalid evaluation ID
 *       404:
 *         description: Evaluation not found
 *       403:
 *         description: Unauthorized (người dùng không có quyền xem đánh giá này)
 *       500:
 *         description: Internal server error
 */
router.get("/:id", getEvaluationDetail);

export default router;
