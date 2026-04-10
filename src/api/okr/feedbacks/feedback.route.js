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
 *     summary: List feedbacks for an objective with tree structure
 *     description: Returns top-level feedbacks with nested replies as tree structure. Replies are included within each root feedback.
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sentiment
 *         schema:
 *           type: string
 *           enum: [POSITIVE, NEUTRAL, NEGATIVE, MIXED, UNKNOWN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER, RESOLVED, FLAGGED]
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
 *         description: Feedbacks retrieved successfully with tree structure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 total:
 *                   type: integer
 *                   description: Total number of root-level feedbacks
 *                 last_page:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       objective_id:
 *                         type: integer
 *                       parent_id:
 *                         type: integer
 *                         nullable: true
 *                         description: null for root-level feedbacks
 *                       content:
 *                         type: string
 *                       sentiment:
 *                         type: string
 *                         enum: [POSITIVE, NEUTRAL, NEGATIVE, MIXED, UNKNOWN]
 *                       status:
 *                         type: string
 *                         enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER, RESOLVED, FLAGGED]
 *                       key_result:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           full_name:
 *                             type: string
 *                           avatar_url:
 *                             type: string
 *                             nullable: true
 *                           job_title:
 *                             type: string
 *                             nullable: true
 *                       replies:
 *                         type: array
 *                         description: Nested replies to this feedback (max depth 1)
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             objective_id:
 *                               type: integer
 *                             parent_id:
 *                               type: integer
 *                             content:
 *                               type: string
 *                             sentiment:
 *                               type: string
 *                             status:
 *                               type: string
 *                             key_result:
 *                               type: object
 *                               nullable: true
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 title:
 *                                   type: string
 *                             created_at:
 *                               type: string
 *                               format: date-time
 *                             updated_at:
 *                               type: string
 *                               format: date-time
 *                             user:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 full_name:
 *                                   type: string
 *                                 avatar_url:
 *                                   type: string
 *                                   nullable: true
 *                                 job_title:
 *                                   type: string
 *                                   nullable: true
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Objective not found
 */
router.get(
  "/objectives/:objectiveId/feedbacks",
  validate(listFeedbacksQuerySchema, "query"),
  listFeedbacks,
);

/**
 * @swagger
 * /objectives/{objectiveId}/feedbacks:
 *   post:
 *     summary: Create a feedback on an objective
 *     description: Any user who can view the objective can post feedback, including edit-capable managers/admin_company.
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
 *             required: [content, status]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Feedback content (1-5000 characters, required)
 *               status:
 *                 type: string
 *                 enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *                 description: Required active feedback category selected by user
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         objective_id:
 *                           type: integer
 *                         user_id:
 *                           type: integer
 *                         content:
 *                           type: string
 *                         sentiment:
 *                           type: string
 *                         status:
 *                           type: string
 *                         kr_tag_id:
 *                           type: integer
 *                           nullable: true
 *                         parent_feedback_id:
 *                           type: integer
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Objective not found
 *       422:
 *         description: Validation error or kr_tag_id does not belong to this objective
 */
router.post(
  "/objectives/:objectiveId/feedbacks",
  validate(createFeedbackSchema),
  createFeedback,
);

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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         objective_id:
 *                           type: integer
 *                         user_id:
 *                           type: integer
 *                         content:
 *                           type: string
 *                         sentiment:
 *                           type: string
 *                         status:
 *                           type: string
 *                         kr_tag_id:
 *                           type: integer
 *                           nullable: true
 *                         parent_feedback_id:
 *                           type: integer
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
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
 *     description: Author or ADMIN_COMPANY only. Can update content, status (between active states), or kr_tag_id. Replies cannot be edited; use reply mechanism to set RESOLVED/FLAGGED.
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
 *               status:
 *                 type: string
 *                 enum: [PRAISE, CONCERN, SUGGESTION, QUESTION, BLOCKER]
 *                 description: Feedback type - can be changed between active states (optional). RESOLVED/FLAGGED are reply-only.
 *               kr_tag_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Key result tag ID (optional)
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
router.patch(
  "/objectives/:objectiveId/feedbacks/:feedbackId",
  validate(updateFeedbackSchema),
  updateFeedback,
);

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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       objective_id:
 *                         type: integer
 *                       user_id:
 *                         type: integer
 *                       content:
 *                         type: string
 *                       sentiment:
 *                         type: string
 *                       status:
 *                         type: string
 *                       kr_tag_id:
 *                         type: integer
 *                         nullable: true
 *                       parent_feedback_id:
 *                         type: integer
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
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
 *       Creates the only allowed reply on a top-level feedback.
 *       Only users who can edit the objective/KR (or ADMIN_COMPANY) can reply.
 *       Reply must carry status RESOLVED or FLAGGED.
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
 *             required: [content, status]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Reply content (1-5000 characters, required)
 *               status:
 *                 type: string
 *                 enum: [RESOLVED, FLAGGED]
 *               kr_tag_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional KR tag for resolver context
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         objective_id:
 *                           type: integer
 *                         user_id:
 *                           type: integer
 *                         content:
 *                           type: string
 *                         sentiment:
 *                           type: string
 *                         status:
 *                           type: string
 *                         kr_tag_id:
 *                           type: integer
 *                           nullable: true
 *                         parent_feedback_id:
 *                           type: integer
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Cannot reply to a reply
 *       409:
 *         description: Feedback already has a reply
 *       403:
 *         description: No permission to resolve/flag this feedback
 *       404:
 *         description: Parent feedback not found
 *       422:
 *         description: Validation error
 */
router.post("/feedbacks/:id/replies", validate(createReplySchema), createReply);

export default router;
