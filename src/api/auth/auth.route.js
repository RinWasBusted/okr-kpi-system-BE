import express from "express";
import { login, refreshToken, logout, changePassword, getCurrentUser } from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication APIs
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login
 *     description: Login with email and password. Returns `accessToken` and `refreshToken` cookies.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               company_slug:
 *                 type: string
 *                 description: Company slug for multi-tenant applications. If provided, the system will attempt to find the user within the specified company.
 *                 example: "acme-corp"
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: accessToken và refreshToken cookies
 *             schema:
 *               type: string
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
 *                   example: "Login successful"
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
 *                           example: "user@example.com"
 *                         role:
 *                           type: string
 *                           example: "employee"
 *                         company_id:
 *                           type: integer
 *                           example: 1
 *                         unit_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-01-01T00:00:00.000Z"
 *       400:
 *         description: Invalid input
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
 *                   example: "Invalid email address"
 *       401:
 *         description: Invalid credentials
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
 *                   example: "Invalid credentials"
 */
router.post("/login", login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Refresh access token using `refreshToken` cookie. Returns new `accessToken` cookie.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken cookie
 *             schema:
 *               type: string
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
 *                   example: "Access token refreshed"
 *       401:
 *         description: Refresh token not found
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
 *                   example: "Refresh token not found"
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change password
 *     description: Change password for current user. Requires `accessToken` cookie.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                   example: "Password changed successfully"
 *       400:
 *         description: Invalid input
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
 *                   example: "Invalid input"
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
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 */
router.patch("/change-password", authenticate, changePassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user information
 *     description: Retrieve information of the currently authenticated user. Requires `accessToken` cookie.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user information retrieved successfully
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
 *                   example: "Current user retrieved successfully"
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
 *                           example: "user@example.com"
 *                         phone:
 *                           type: string
 *                           nullable: true
 *                           example: "0987654321"
 *                         role:
 *                           type: string
 *                           enum: [admin, manager, employee]
 *                           example: "employee"
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                           description: "Cloudinary URL 50x50 pixels"
 *                           example: "https://res.cloudinary.com/demo/image/upload/c_fill,h_50,w_50/avatar.jpg"
 *                         company_id:
 *                           type: integer
 *                           example: 1
 *                         company_slug:
 *                           type: string
 *                           nullable: true
 *                           example: "acme-corp"
 *                         unit_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           description: "Create date (can't be changed)"
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
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
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
 *                 message:
 *                   type: string
 *                   example: "User not found"
 */
router.get("/me", authenticate, getCurrentUser);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout
 *     description: Clear `accessToken` and `refreshToken` cookies.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken và refreshToken cookies bị xóa
 *             schema:
 *               type: string
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
 *                   example: "Logged out successfully"
 */
router.post("/logout", authenticate, logout);

export default router;
