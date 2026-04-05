import express from "express";
import { login, refreshToken, logout, changePassword, getCurrentUser, logoutAll, getSessions, deleteSession } from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.js";
import { loginRateLimit } from "../../middlewares/rateLimit.js";

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
 *     description: Login with email and password. Returns `accessToken` and `refreshToken` cookies. Supports device tracking and remember me functionality.
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
 *               device_info:
 *                 type: object
 *                 description: Optional device information for session tracking
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Chrome/Windows"
 *                   fingerprint:
 *                     type: string
 *                     example: "abc123"
 *               remember_me:
 *                 type: boolean
 *                 description: If true, refresh token expires in 30 days instead of 7 days
 *                 example: false
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and refreshToken cookies
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
 *                         avatar_url:
 *                           type: string
 *                           example: "https://..."
 *                         company_id:
 *                           type: integer
 *                           example: 1
 *                         company_slug:
 *                           type: string
 *                           example: "acme-corp"
 *                         unit_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                         unit_name:
 *                           type: string
 *                           nullable: true
 *                           example: "Engineering"
 *                     expires_in:
 *                       type: integer
 *                       description: Access token TTL in seconds
 *                       example: 900
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
 *                   example: "Invalid email or password"
 *       403:
 *         description: Account deactivated
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
 *                   example: "Your account has been deactivated. Contact your administrator."
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
 *       429:
 *         description: Too many attempts
 *         headers:
 *           Retry-After:
 *             description: Seconds to wait before retrying
 *             schema:
 *               type: integer
 *               example: 840
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
 *                   example: "Too many attempts. Try again after 14 minutes."
 */
router.post("/login", loginRateLimit, login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Refresh access token using `refreshToken` cookie. Returns new `accessToken` cookie. Implements token rotation - the old refresh token is invalidated and a new one is issued.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and new refreshToken cookies
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     expires_in:
 *                       type: integer
 *                       description: New access token TTL in seconds
 *                       example: 900
 *       401:
 *         description: Refresh token not found or expired
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
 *       403:
 *         description: Session revoked
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
 *                   example: "Session has been revoked. Please login again."
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change password
 *     description: Change password for current user. Requires `accessToken` cookie. Invalidates all other sessions upon success.
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
 *                 minLength: 8
 *                 description: Must be at least 8 characters, contain uppercase and number
 *                 example: "Newpassword123"
 *               confirmPassword:
 *                 type: string
 *                 description: Optional confirmation password
 *                 example: "Newpassword123"
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions_revoked:
 *                       type: integer
 *                       description: Number of other sessions that were logged out
 *                       example: 2
 *       400:
 *         description: Invalid input or validation error
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
 *                   examples:
 *                     "Invalid input": "Invalid input"
 *                     "Current password incorrect": "Current password is incorrect"
 *                     "New password same": "New password must be different from current password"
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
 *                         company_name:
 *                           type: string
 *                           nullable: true
 *                           example: "Acme Corporation"
 *                         unit_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                         unit_name:
 *                           type: string
 *                           nullable: true
 *                           example: "Engineering"
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           description: "Create date (can't be changed)"
 *                           example: "2026-01-01T00:00:00.000Z"
 *       401:
 *         description: Access token missing or invalid, or account no longer exists
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
 *                   example: "Account no longer exists. Please login again."
 */
router.get("/me", authenticate, getCurrentUser);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout
 *     description: Clear `accessToken` and `refreshToken` cookies. The refresh token is blacklisted on the server side to prevent reuse.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and refreshToken cookies are cleared
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
 *       401:
 *         description: Already logged out or invalid token
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
 *                   example: "Already logged out"
 */
router.post("/logout", authenticate, logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     description: Revoke all refresh tokens for the current user across all devices. Requires `accessToken` cookie.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
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
 *                   example: "Logged out from all devices successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions_revoked:
 *                       type: integer
 *                       description: Number of sessions revoked
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
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 */
router.post("/logout-all", authenticate, logoutAll);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get active sessions
 *     description: Retrieve list of active sessions for the current user. Requires `accessToken` cookie.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
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
 *                   example: "Sessions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "refreshToken:abc123..."
 *                       device_info:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Chrome/Windows"
 *                           fingerprint:
 *                             type: string
 *                             example: "abc123"
 *                       last_seen:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-04-04T10:00:00.000Z"
 *                       current:
 *                         type: boolean
 *                         description: Whether this is the current session
 *                         example: false
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
router.get("/sessions", authenticate, getSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     description: Revoke a specific session by session ID. Requires `accessToken` cookie.
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The session ID to revoke
 *         example: "refreshToken:abc123..."
 *     responses:
 *       200:
 *         description: Session revoked successfully
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
 *                   example: "Session revoked successfully"
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
 *         description: Session not found
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
 *                   example: "Session not found"
 */
router.delete("/sessions/:sessionId", authenticate, deleteSession);

export default router;
