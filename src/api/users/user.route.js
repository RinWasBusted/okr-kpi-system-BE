import express from "express";
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    uploadAvatar,
    deleteAvatar,
    deleteUser,
    isOwnerOrAdmin
} from "./user.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";
import { uploadSingle } from "../../utils/multer.js";
import { wrapMulter } from "../../utils/wrapMulter.js";
import requestContext from "../../utils/context.js";
import { validate } from "../../middlewares/validate.js";
import {
    createUserSchema,
    updateUserSchema,
    listUsersQuerySchema,
} from "../../schemas/user.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: Employee management APIs
 */
 
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get list of employees
 *     description: Returns a paginated list of employees in the company. Supports filtering by unit and search by name or email. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: integer
 *         description: Filter by unit ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search by full name or email (partial match)
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
 *         description: Users retrieved successfully
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
 *                   example: "Users retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       full_name:
 *                         type: string
 *                         example: "Nguyen Van A"
 *                       email:
 *                         type: string
 *                         format: email
 *                         example: "nguyenvana@acme.com"
 *                       job_title:
 *                         type: string
 *                         nullable: true
 *                         example: "Software Engineer"
 *                       avatar_url:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       role:
 *                         type: string
 *                         enum: [ADMIN_COMPANY, EMPLOYEE]
 *                         example: "EMPLOYEE"
 *                       unit:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 2
 *                           name:
 *                             type: string
 *                             example: "Engineering"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-01T00:00:00.000Z"
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 50
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 20
 *                     last_page:
 *                       type: integer
 *                       example: 3
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
 */
router.get("/", validate(listUsersQuerySchema, "query"), getUsers);
 
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get employee detail
 *     description: Returns detailed information of a specific employee. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
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
 *                   example: "User retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         full_name:
 *                           type: string
 *                           example: "Nguyen Van A"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: "nguyenvana@acme.com"
 *                         job_title:
 *                           type: string
 *                           nullable: true
 *                           example: "Software Engineer"
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         role:
 *                           type: string
 *                           enum: [ADMIN_COMPANY, EMPLOYEE]
 *                           example: "EMPLOYEE"
 *                         unit:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 2
 *                             name:
 *                               type: string
 *                               example: "Engineering"
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-01-01T00:00:00.000Z"
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
 *         description: User not found
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
 *                       example: "User not found"
 */
router.get("/:id", getUserById);

/**
 * @swagger
 * /users/{id}/avatar:
 *   patch:
 *     summary: Update user avatar
 *     description: Upload or update user avatar. Can only be done by the user themselves or ADMIN_COMPANY. If no file is sent, the avatar will be deleted. Requires `accessToken` cookie.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (jpg, png, gif)
 *     responses:
 *       200:
 *         description: Avatar updated successfully
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
 *                   example: "Avatar updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized - Access token missing or invalid
 *       403:
 *         description: Forbidden - Not owner or admin
 *       404:
 *         description: User not found
 */
router.patch("/:id/avatar", isOwnerOrAdmin, wrapMulter(requestContext, uploadSingle("avatar")), uploadAvatar);

/**
 * @swagger
 * /users/{id}/avatar:
 *   delete:
 *     summary: Delete user avatar
 *     description: Delete user avatar. Can only be done by the user themselves or ADMIN_COMPANY.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete("/:id/avatar", authorize("ADMIN_COMPANY", "EMPLOYEE"), isOwnerOrAdmin, deleteAvatar);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new employee
 *     description: Creates a new Employee account in the company. Email must be unique across the entire platform. Requires `accessToken` cookie and `ADMIN_COMPANY` role.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [full_name, email, password]
 *             properties:
 *               full_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 example: "nguyenvana@acme.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 255
 *                 example: "password123"
 *               unit_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *                 description: Assign to a unit. Omit or set null to leave unassigned.
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Optional avatar image file
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: "User created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 10
 *                         full_name:
 *                           type: string
 *                           example: "Nguyen Van A"
 *                         email:
 *                           type: string
 *                           example: "nguyenvana@acme.com"
 *                         job_title:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           example: "okr-kpi-system/users/avatars/image-123"
 *                         role:
 *                           type: string
 *                           example: "EMPLOYEE"
 *                         unit:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 2
 *                             name:
 *                               type: string
 *                               example: "Engineering"
 *                         is_active:
 *                           type: boolean
 *                           example: true
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
 *                       example: "UNIT_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Unit not found"
 *       409:
 *         description: Email already exists
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
 *                       example: "EMAIL_EXISTS"
 *                     message:
 *                       type: string
 *                       example: "Email already exists"
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
 *                       example: "Password must be at least 8 characters"
 */
router.post("/", authorize("ADMIN_COMPANY"), wrapMulter(requestContext, uploadSingle("avatar")), validate(createUserSchema), createUser);
 
/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update employee information
 *     description: Update employee profile, unit assignment, password, or active status. Requires `accessToken` cookie and `ADMIN_COMPANY` role. To let employees change their own password, use `PATCH /auth/change-password`.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Nguyen Van B"
 *               job_title:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Senior Engineer"
 *                 description: Update job title. Set null to remove.
 *               unit_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 3
 *                 description: Transfer to another unit. Set null to remove from unit.
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 255
 *                 example: "newpassword123"
 *                 description: Admin reset password on behalf of employee.
 *               is_active:
 *                 type: boolean
 *                 example: false
 *                 description: false = lock the employee account.
 *     responses:
 *       200:
 *         description: User updated successfully
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
 *                   example: "User updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 10
 *                         full_name:
 *                           type: string
 *                           example: "Nguyen Van B"
 *                         email:
 *                           type: string
 *                           example: "nguyenvana@acme.com"
 *                         job_title:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         role:
 *                           type: string
 *                           example: "EMPLOYEE"
 *                         unit:
 *                           type: object
 *                           nullable: true
 *                         is_active:
 *                           type: boolean
 *                           example: false
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-01-01T00:00:00.000Z"
 *       400:
 *         description: No fields provided to update
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
 *                       example: "No fields provided to update"
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
 *         description: User or unit not found
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
 *                       example: "User not found"
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
 *                       example: "Password must be at least 8 characters"
 */
router.put("/:id", isOwnerOrAdmin, validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Soft delete a user
 *     description: Soft delete (deactivate) a user by marking with deleted_at timestamp. Only ADMIN_COMPANY can perform this action.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to delete
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       400:
 *         description: Invalid user ID or user already deleted
 *       401:
 *         description: Unauthorized - Access token missing or invalid
 *       403:
 *         description: Forbidden - Only ADMIN_COMPANY can delete users
 *       404:
 *         description: User not found
 */
router.delete("/:id", authorize("ADMIN_COMPANY"), deleteUser);
 
export default router;