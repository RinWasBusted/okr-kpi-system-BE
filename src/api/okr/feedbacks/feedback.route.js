import express from "express";
import {
    listFeedbacks,
    createFeedback,
    getFeedback,
    updateFeedback,
    deleteFeedback,
    listReplies,
    createReply,
} from "./feedback.controller.js";
import { authenticate } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createFeedbackSchema,
    updateFeedbackSchema,
    createReplySchema,
    listFeedbacksQuerySchema,
} from "../../../schemas/feedback.schema.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Feedbacks
 *     description: Feedback on objectives and key results
 */

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks:
 *   get:
 *     summary: List feedbacks for an objective
 *     description: Returns top-level feedbacks only. 
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *       - in: query
 *         name: sentiment
 *         schema:
 *           type: string
 *           enum: [POSITIVE, NEUTRAL, NEGATIVE, MIXED, UNKNOWN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, FLAGGED]
 *       - in: query
 *         name: kr_tag_id
 *         schema:
 *           type: integer
 *         description: Filter by a specific key result tag
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
 *         description: Feedbacks retrieved successfully
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
 *                     $ref: '#/components/schemas/Feedback'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     last_page:
 *                       type: integer
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Objective not found
 */
router.get("/objectives/:objectiveId/feedbacks", validate(listFeedbacksQuerySchema, "query"), listFeedbacks);

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks:
 *   post:
 *     summary: Create a feedback on an objective
 *     description: Any user who can view the objective can post feedback.
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, type]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Feedback content (1-5000 characters, required)
 *               type:
 *                 type: string
 *                 enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *                 description: Type of feedback
 *               kr_tag_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Tag a specific key result within this objective
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     feedback:
 *                       $ref: '#/components/schemas/Feedback'
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Objective not found
 *       422:
 *         description: Validation error or kr_tag_id does not belong to this objective
 */
router.post("/objectives/:objectiveId/feedbacks", validate(createFeedbackSchema), createFeedback);

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks/{feedbackId}:
 *   get:
 *     summary: Get a single feedback
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     feedback:
 *                       $ref: '#/components/schemas/Feedback'
 *       403:
 *         description: No permission
 *       404:
 *         description: Feedback or objective not found
 */
router.get("/objectives/:objectiveId/feedbacks/:feedbackId", getFeedback);

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks/{feedbackId}:
 *   patch:
 *     summary: Partially update a feedback
 *     description: Author or ADMIN_COMPANY only. Send only fields to change.
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Feedback content (1-5000 characters, optional for partial update)
 *               type:
 *                 type: string
 *                 enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *                 description: Type of feedback
 *               sentiment:
 *                 type: string
 *                 enum: [POSITIVE, NEUTRAL, NEGATIVE, MIXED, UNKNOWN]
 *                 description: Manual override of AI-detected sentiment
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, RESOLVED, FLAGGED]
 *               kr_tag_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 *       400:
 *         description: No fields provided
 *       403:
 *         description: Not author or ADMIN_COMPANY
 *       404:
 *         description: Feedback not found
 *       422:
 *         description: Validation error
 */
router.patch("/objectives/:objectiveId/feedbacks/:feedbackId", validate(updateFeedbackSchema), updateFeedback);

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks/{feedbackId}:
 *   delete:
 *     summary: Delete a feedback (and its replies)
 *     description: Author or ADMIN_COMPANY only.
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feedback deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *       403:
 *         description: Not author or ADMIN_COMPANY
 *       404:
 *         description: Feedback not found
 */
router.delete("/objectives/:objectiveId/feedbacks/:feedbackId", deleteFeedback);

// ---------------------------------------------------------------------------
// Thread endpoints — flat routes under /feedbacks/:id
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /feedbacks/{id}/replies:
 *   get:
 *     summary: List replies to a feedback
 *     description: Returns all direct replies. Replies of replies are not supported (max depth = 1).
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Parent feedback ID
 *     responses:
 *       200:
 *         description: Replies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Trying to get replies of a reply
 *       404:
 *         description: Parent feedback not found
 */
router.get("/feedbacks/:id/replies", listReplies);

/**
 * @swagger
 * /feedbacks/{id}/replies:
 *   post:
 *     summary: Reply to a feedback
 *     description: >
 *       Creates a reply on a top-level feedback. Replying to a reply is not allowed.
 *       Sentiment is AI-detected asynchronously.
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Parent feedback ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, type]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Reply content (1-5000 characters, required)
 *               type:
 *                 type: string
 *                 enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *                 description: Type of reply
 *     responses:
 *       201:
 *         description: Reply created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     feedback:
 *                       $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Cannot reply to a reply
 *       403:
 *         description: No permission to view the objective
 *       404:
 *         description: Parent feedback not found
 *       422:
 *         description: Validation error
 */
router.post("/feedbacks/:id/replies", validate(createReplySchema), createReply);

export default router;