import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import * as ctrl from "./notification.controller.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get list of notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: is_read
 *         schema:
 *           type: boolean
 *         description: Filter by read status (true/false)
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           message:
 *                             type: string
 *                           is_read:
 *                             type: boolean
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           ref:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                               id:
 *                                 type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         page_size:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         total_pages:
 *                           type: integer
 */
router.get("/", ctrl.listNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     unread_count:
 *                       type: integer
 */
router.get("/unread-count", ctrl.getUnreadCount);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated_count:
 *                       type: integer
 *                     read_at:
 *                       type: string
 *                       format: date-time
 */
router.patch("/read-all", ctrl.markAllRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     read_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", ctrl.markOneRead);

/**
 * @swagger
 * /notifications/stream:
 *   get:
 *     summary: Stream real-time notifications using Server-Sent Events (SSE)
 *     description: |
 *       Establishes a persistent connection to receive real-time notifications for the authenticated user.
 *       This endpoint uses Server-Sent Events (SSE) to push notification data to the client as they occur.
 *       The connection remains open until the client closes it or an error occurs.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           SSE stream connection established successfully.
 *           The response streams notifications in Server-Sent Events format.
 *           Each notification is sent as a separate event with JSON data payload.
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: text/event-stream
 *             description: Content type for Server-Sent Events
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-cache
 *             description: Disable caching for real-time events
 *           Connection:
 *             schema:
 *               type: string
 *               example: keep-alive
 *             description: Keep the connection open for streaming
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               description: |
 *                 Each SSE event contains notification data in JSON format.
 *                 Format: data: {JSON_OBJECT}\n\n
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Unique identifier of the notification
 *                   example: 123
 *                 message:
 *                   type: string
 *                   description: Human-readable notification message
 *                   example: "Người dùng John Doe đã cập nhật mục tiêu"
 *                 ref_type:
 *                   type: string
 *                   description: Type of resource referenced in the notification
 *                   enum: [OBJECTIVE, KPI, KEY_RESULT, KPI_ASSIGNMENT, FEEDBACK, USER]
 *                   example: "OBJECTIVE"
 *                 ref_id:
 *                   type: integer
 *                   description: ID of the referenced resource
 *                   example: 456
 *                 event_type:
 *                   type: string
 *                   description: Type of event that triggered the notification
 *                   enum: [CREATED, UPDATED, DELETED, STATUS_CHANGED, ASSIGNED, FEEDBACK_SUBMITTED]
 *                   example: "UPDATED"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the notification was created
 *                   example: "2026-04-22T10:30:45.000Z"
 *             example: |
 *               data: {"id":123,"message":"Người dùng John Doe đã cập nhật mục tiêu","ref_type":"OBJECTIVE","ref_id":456,"event_type":"UPDATED","created_at":"2026-04-22T10:30:45.000Z"}
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error - Stream connection failed
 *     x-code-samples:
 *       - lang: JavaScript
 *         label: JavaScript/Browser
 *         source: |
 *           const token = 'your-jwt-token';
 *           const eventSource = new EventSource(
 *             '/api/notifications/stream',
 *             {
 *               headers: {
 *                 'Authorization': `Bearer ${token}`
 *               }
 *             }
 *           );
 *
 *           eventSource.onmessage = (event) => {
 *             const notification = JSON.parse(event.data);
 *             console.log('New notification:', notification);
 *           };
 *
 *           eventSource.onerror = () => {
 *             console.error('Stream connection error');
 *             eventSource.close();
 *           };
 *       - lang: cURL
 *         label: cURL
 *         source: |
 *           curl -X GET http://localhost:3000/api/notifications/stream \
 *             -H "Authorization: Bearer your-jwt-token"
 */
router.get("/stream", ctrl.streamNotifications);

export default router;
