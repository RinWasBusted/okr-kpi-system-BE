import express from "express";
import {
  getCompanyAdmins,
  createCompanyAdmin,
  updateCompanyAdmin,
  deactivateCompanyAdmin,
  uploadAvatar,
  deleteAvatar,
} from "./adminCompany.controller.js";
import { uploadSingle } from "../../../utils/multer.js";
import { wrapMulter } from "../../../utils/wrapMulter.js";
import requestContext from "../../../utils/context.js";

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   - name: Admin - Company Admins
 *     description: Manage company-level admin accounts
 */

/**
 * @swagger
 * /admin/companies/{company_id}/admins:
 *   get:
 *     summary: Get company admins
 *     description: Returns a paginated list of AdminCompany accounts for a company.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
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
 *         description: List of company admins
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
 *                   example: "Company admins retrieved successfully"
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
 *                         example: "admin@acme.com"
 *                       avatar_url:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-01T00:00:00.000Z"
 *                       last_login_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 5
 *       400:
 *         description: Invalid company id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid company ID"
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 */
router.get("/", getCompanyAdmins);

/**
 * @swagger
 * /admin/companies/{company_id}/admins:
 *   post:
 *     summary: Create company admin
 *     description: Create a new AdminCompany account for a company. Optionally upload an avatar image.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
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
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@acme.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "password123"
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Optional avatar image file
 *     responses:
 *       201:
 *         description: Admin created successfully
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
 *                   example: "Company admin created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         full_name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                         is_active:
 *                           type: boolean
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Invalid payload or password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "full_name, email and password are required"
 *       403:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
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
 *                 message:
 *                   type: string
 *                   example: "Email already exists"
 */
router.post("/", wrapMulter(requestContext, uploadSingle("avatar")), createCompanyAdmin);

/**
 * @swagger
 * /admin/companies/{company_id}/admins/{admin_id}:
 *   put:
 *     summary: Update company admin
 *     description: Update AdminCompany profile or status.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *       - in: path
 *         name: admin_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin updated successfully
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
 *                   example: "Company admin updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *       400:
 *         description: Invalid params or payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid parameters"
 *       404:
 *         description: Company or admin not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Admin not found"
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
 *                 message:
 *                   type: string
 *                   example: "Email already exists"
 */
router.put("/:admin_id", updateCompanyAdmin);

/**
 * @swagger
 * /admin/companies/{company_id}/admins/{admin_id}/avatar:
 *   patch:
 *     summary: Upload or update admin avatar
 *     description: Upload or update the avatar for a company admin. Send empty request (no file) to delete current avatar.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *       - in: path
 *         name: admin_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Company or admin not found
 */
router.patch("/:admin_id/avatar", wrapMulter(requestContext, uploadSingle("avatar")), uploadAvatar);

/**
 * @swagger
 * /admin/companies/{company_id}/admins/{admin_id}/avatar:
 *   delete:
 *     summary: Delete admin avatar
 *     description: Remove the avatar from a company admin.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *       - in: path
 *         name: admin_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Admin not found
 */
router.delete("/:admin_id/avatar", deleteAvatar);

/**
 * @swagger
 * /admin/companies/{company_id}/admins/{admin_id}:
 *   delete:
 *     summary: Deactivate company admin
 *     description: Soft delete an AdminCompany by setting is_active = false.
 *     tags: [Admin - Company Admins]
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *       - in: path
 *         name: admin_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Admin deactivated successfully
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
 *                   example: "Company admin deactivated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *       400:
 *         description: Invalid params or last active admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Cannot deactivate the last admin"
 *       404:
 *         description: Admin not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Admin not found"
 */
router.delete("/:admin_id", deactivateCompanyAdmin);

export default router;
