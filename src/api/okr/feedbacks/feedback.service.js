import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { UserRole } from "@prisma/client";
import { canEditObjective, canViewObjective } from "../../../utils/okr.js";
import { getCloudinaryImageUrl } from "../../../utils/cloudinary.js";
import {
  notifyFeedbackEvent,
  notifyFeedbackStatusEvent,
  getUsersInUnitTree,
} from "../../../utils/notificationHelper.js";

const FEEDBACK_ALLOWED_OBJECTIVE_STATUSES = [
  "NOT_STARTED",
  "ON_TRACK",
  "AT_RISK",
  "CRITICAL",
  "COMPLETED",
];

const ensureObjectiveAllowsFeedback = (objective) => {
  if (!FEEDBACK_ALLOWED_OBJECTIVE_STATUSES.includes(objective.status)) {
    throw new AppError(
      "Feedback can only be created on active objectives",
      400,
    );
  }
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
const canMutateFeedback = (user, feedback) => {
  return user.role === UserRole.ADMIN_COMPANY || feedback.user_id === user.id;
};

const canResolveFeedbackByReply = async (user, objective) => {
  if (user.role === UserRole.ADMIN_COMPANY) return true;
  return canEditObjective(user, objective);
};

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

const userSelect = {
  id: true,
  full_name: true,
  avatar_url: true,
  job_title: true,
};

const feedbackSelect = {
  id: true,
  objective_id: true,
  parent_id: true,
  content: true,
  sentiment: true,
  status: true,
  created_at: true,
  updated_at: true,
  user: { select: userSelect },
  key_result: {
    select: {
      id: true,
      title: true,
    },
  },
};

const formatFeedback = (fb) => ({
  id: fb.id,
  objective_id: fb.objective_id,
  parent_id: fb.parent_id ?? null,
  content: fb.content,
  sentiment: fb.sentiment,
  status: fb.status,
  created_at: fb.created_at,
  updated_at: fb.updated_at ?? null,
  user: fb.user
    ? {
        ...fb.user,
        avatar_url: fb.user.avatar_url
          ? getCloudinaryImageUrl(fb.user.avatar_url, 50, 50, "fill")
          : null,
      }
    : null,
  key_result: fb.key_result
    ? {
        id: fb.key_result.id,
        title: fb.key_result.title,
      }
    : null,
});

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const getObjectiveForFeedback = async (objectiveId) => {
  const rows = await prisma.$queryRaw`
    SELECT id, title, status, visibility, unit_id, owner_id, access_path::text AS access_path
    FROM "Objectives"
    WHERE id = ${objectiveId}
      AND deleted_at IS NULL
  `;
  if (!rows || rows.length === 0)
    throw new AppError("Objective not found", 404);
  return rows[0];
};

const getFeedbackOrThrow = async (feedbackId, objectiveId) => {
  const feedback = await prisma.feedbacks.findFirst({
    where: { id: feedbackId, objective_id: objectiveId },
    select: { ...feedbackSelect, user_id: true },
  });
  if (!feedback) throw new AppError("Feedback not found", 404);
  return feedback;
};

// ---------------------------------------------------------------------------
// kr_tag_id validation
// KR must belong to the same objective AND company, and must not be deleted.
// ---------------------------------------------------------------------------

const validateKrTagId = async (krTagId, objectiveId, companyId) => {
  const kr = await prisma.keyResults.findFirst({
    where: {
      id: krTagId,
      objective_id: objectiveId,
      company_id: companyId,
      deleted_at: null,
    },
    select: { id: true },
  });
  if (!kr) {
    throw new AppError(
      "kr_tag_id does not exist or does not belong to this objective",
      422,
    );
  }
};

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

export const listFeedbacks = async (
  user,
  objectiveId,
  filters,
  page,
  per_page,
) => {
  const objective = await getObjectiveForFeedback(objectiveId);

  if (!(await canViewObjective(user, objective))) {
    throw new AppError(
      "You do not have permission to view this objective",
      403,
    );
  }

  // Build where clause with filters
  const where = {
    objective_id: objectiveId,
    ...(filters.sentiment && { sentiment: filters.sentiment }),
    ...(filters.status && { status: filters.status }),
    ...(filters.kr_tag_id !== undefined && { kr_tag_id: filters.kr_tag_id }),
  };

  // Fetch all feedbacks (both top-level and replies)
  const allFeedbacks = await prisma.feedbacks.findMany({
    where,
    orderBy: { created_at: "asc" },
    select: feedbackSelect,
  });

  // Build tree structure: group by parent_id
  const feedbacksMap = new Map();
  const rootFeedbacks = [];
  const formattedFeedbacks = allFeedbacks.map(formatFeedback);

  // Create map for quick lookup and identify root feedbacks
  formattedFeedbacks.forEach((fb) => {
    feedbacksMap.set(fb.id, { ...fb, replies: [] });
    if (fb.parent_id === null) {
      rootFeedbacks.push(fb.id);
    }
  });

  // Build parent-child relationships
  formattedFeedbacks.forEach((fb) => {
    if (fb.parent_id !== null) {
      const parent = feedbacksMap.get(fb.parent_id);
      if (parent) {
        parent.replies.push(feedbacksMap.get(fb.id));
      }
    }
  });

  // Get paginated root feedbacks
  const total = rootFeedbacks.length;
  const offset = (page - 1) * per_page;
  const paginatedRootIds = rootFeedbacks.slice(offset, offset + per_page);
  const paginatedData = paginatedRootIds.map((id) => feedbacksMap.get(id));

  return {
    total,
    last_page: Math.ceil(total / per_page),
    data: paginatedData,
  };
};

export const createFeedback = async (user, objectiveId, payload) => {
  const objective = await getObjectiveForFeedback(objectiveId);
  ensureObjectiveAllowsFeedback(objective);

  if (!(await canViewObjective(user, objective))) {
    throw new AppError(
      "You do not have permission to post feedback on this objective",
      403,
    );
  }

  if (payload.kr_tag_id) {
    await validateKrTagId(payload.kr_tag_id, objectiveId, user.company_id);
  }

  const created = await prisma.feedbacks.create({
    data: {
      company_id: user.company_id,
      objective_id: objectiveId,
      kr_tag_id: payload.kr_tag_id ?? null,
      user_id: user.id,
      content: payload.content,
      sentiment: "UNKNOWN",
      // [AI — sentiment detection] When ready, call detectSentimentAsync(created.id, payload.content)
      // here as fire-and-forget. It classifies content via Claude and updates sentiment in background.
      status: payload.status,
    },
    select: feedbackSelect,
  });

  // Notify relevant users about new feedback
  try {
    let recipientIds = [];

    // Always notify the objective owner
    if (objective.owner_id && objective.owner_id !== user.id) {
      recipientIds.push(objective.owner_id);
    }

    // Notify users in the unit tree
    if (objective.unit_id) {
      const unitUsers = await getUsersInUnitTree(
        objective.unit_id,
        user.company_id,
      );
      recipientIds = [...new Set([...recipientIds, ...unitUsers])];
    }

    // Filter out the actor
    recipientIds = recipientIds.filter((id) => id !== user.id);

    if (recipientIds.length > 0) {
      const feedbackSnippet =
        created.content?.slice(0, 100)?.trim() || undefined;

      await notifyFeedbackEvent({
        companyId: user.company_id,
        eventType: "COMMENTED",
        objectiveId,
        objectiveTitle: objective.title,
        actorName: user.full_name || user.email,
        actorId: user.id,
        extraContext: feedbackSnippet,
        recipientIds,
      });
    }
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("Failed to send feedback notification:", error);
  }

  return formatFeedback(created);
};

export const getFeedback = async (user, objectiveId, feedbackId) => {
  const objective = await getObjectiveForFeedback(objectiveId);

  if (!(await canViewObjective(user, objective))) {
    throw new AppError(
      "You do not have permission to view this objective",
      403,
    );
  }

  const feedback = await getFeedbackOrThrow(feedbackId, objectiveId);
  return formatFeedback(feedback);
};

export const updateFeedback = async (
  user,
  objectiveId,
  feedbackId,
  updates,
) => {
  const feedback = await getFeedbackOrThrow(feedbackId, objectiveId);

  if (feedback.parent_id !== null) {
    throw new AppError("Replies cannot be edited", 400);
  }

  if (!canMutateFeedback(user, feedback)) {
    throw new AppError("You do not have permission to edit this feedback", 403);
  }

  // Replies cannot change status to RESOLVED/FLAGGED
  if (updates.status && ["RESOLVED", "FLAGGED"].includes(updates.status)) {
    throw new AppError(
      "Status can only be changed to RESOLVED/FLAGGED via reply mechanism",
      400,
    );
  }

  if (updates.kr_tag_id !== undefined && updates.kr_tag_id !== null) {
    await validateKrTagId(updates.kr_tag_id, objectiveId, user.company_id);
  }

  const updated = await prisma.feedbacks.update({
    where: { id: feedbackId },
    data: {
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.kr_tag_id !== undefined && { kr_tag_id: updates.kr_tag_id }),
    },
    select: feedbackSelect,
  });

  return formatFeedback(updated);
};

export const deleteFeedback = async (user, objectiveId, feedbackId) => {
  await getObjectiveForFeedback(objectiveId);

  const feedback = await getFeedbackOrThrow(feedbackId, objectiveId);

  if (!canMutateFeedback(user, feedback)) {
    throw new AppError(
      "You do not have permission to delete this feedback",
      403,
    );
  }

  // Delete replies first to satisfy FK constraint before deleting parent
  await prisma.$transaction([
    prisma.feedbacks.deleteMany({ where: { parent_id: feedbackId } }),
    prisma.feedbacks.delete({ where: { id: feedbackId } }),
  ]);

  return { id: feedbackId };
};

// ---------------------------------------------------------------------------
// Thread endpoints
// ---------------------------------------------------------------------------

export const listReplies = async (user, parentFeedbackId) => {
  const parent = await prisma.feedbacks.findFirst({
    where: { id: parentFeedbackId },
    select: { id: true, objective_id: true, parent_id: true },
  });
  if (!parent) throw new AppError("Feedback not found", 404);

  // Enforce max depth = 1
  if (parent.parent_id !== null) {
    throw new AppError("Cannot get replies of a reply", 400);
  }

  const objective = await getObjectiveForFeedback(parent.objective_id);
  if (!(await canViewObjective(user, objective))) {
    throw new AppError(
      "You do not have permission to view this objective",
      403,
    );
  }

  const replies = await prisma.feedbacks.findMany({
    where: { parent_id: parentFeedbackId },
    orderBy: { created_at: "asc" },
    select: feedbackSelect,
  });

  return replies.map(formatFeedback);
};

export const createReply = async (user, parentFeedbackId, payload) => {
  const parent = await prisma.feedbacks.findFirst({
    where: { id: parentFeedbackId },
    select: {
      id: true,
      objective_id: true,
      parent_id: true,
      user_id: true,
      content: true,
      status: true,
      kr_tag_id: true,
    },
  });
  if (!parent) throw new AppError("Feedback not found", 404);

  // Enforce max depth = 1 (reply to a reply is not allowed)
  if (parent.parent_id !== null) {
    throw new AppError("Replies can only be made to top-level feedback", 400);
  }

  const objective = await getObjectiveForFeedback(parent.objective_id);
  ensureObjectiveAllowsFeedback(objective);

  if (!(await canViewObjective(user, objective))) {
    throw new AppError(
      "You do not have permission to reply to this feedback",
      403,
    );
  }

  if (!(await canResolveFeedbackByReply(user, objective))) {
    throw new AppError(
      "You do not have permission to resolve or flag this feedback",
      403,
    );
  }

  const existingReplyCount = await prisma.feedbacks.count({
    where: { parent_id: parentFeedbackId },
  });
  if (existingReplyCount > 0) {
    throw new AppError("This feedback has already been replied to", 409);
  }

  if (payload.kr_tag_id !== undefined && payload.kr_tag_id !== null) {
    await validateKrTagId(
      payload.kr_tag_id,
      parent.objective_id,
      user.company_id,
    );
  }

  // Create reply without modifying parent feedback
  const created = await prisma.feedbacks.create({
    data: {
      company_id: user.company_id,
      objective_id: parent.objective_id,
      kr_tag_id: payload.kr_tag_id ?? null,
      user_id: user.id,
      parent_id: parentFeedbackId,
      content: payload.content,
      sentiment: "UNKNOWN",
      status: payload.status,
    },
    select: feedbackSelect,
  });

  // Notify relevant users about new reply
  try {
    let recipientIds = [];

    // Notify parent feedback creator (if not the actor)
    if (parent.user_id && parent.user_id !== user.id) {
      recipientIds.push(parent.user_id);
    }

    // Also notify objective owner (if different from parent creator and actor)
    if (
      objective.owner_id &&
      objective.owner_id !== user.id &&
      !recipientIds.includes(objective.owner_id)
    ) {
      recipientIds.push(objective.owner_id);
    }

    // Notify users in the unit tree
    if (objective.unit_id) {
      const unitUsers = await getUsersInUnitTree(
        objective.unit_id,
        user.company_id,
      );
      recipientIds = [...new Set([...recipientIds, ...unitUsers])];
    }

    // Filter out the actor
    recipientIds = recipientIds.filter((id) => id !== user.id);

    if (recipientIds.length > 0) {
      const replySnippet = created.content?.slice(0, 100)?.trim() || undefined;

      await notifyFeedbackEvent({
        companyId: user.company_id,
        eventType: "REPLIED",
        objectiveId: parent.objective_id,
        objectiveTitle: objective.title,
        actorName: user.full_name || user.email,
        actorId: user.id,
        extraContext: replySnippet,
        recipientIds,
      });

      await notifyFeedbackStatusEvent({
        companyId: user.company_id,
        eventType: "STATUS_CHANGED",
        feedbackId: parent.id,
        feedbackPreview: parent.content?.slice(0, 80)?.trim() || "Phản hồi",
        objectiveId: parent.objective_id,
        objectiveTitle: objective.title,
        feedbackAuthorId: parent.user_id,
        objectiveOwnerId: objective.owner_id,
        actorName: user.full_name || user.email,
        actorId: user.id,
        newStatus: nextStatus,
      });
    }
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("Failed to send reply notification:", error);
  }

  return formatFeedback(created);
};

// ---------------------------------------------------------------------------
// [AI — future] Sentiment detection
//
// When ready to implement, add a `detectSentimentAsync(feedbackId, content)` function here.
// Flow:
//   1. POST feedback → save with sentiment = UNKNOWN → return response immediately
//   2. detectSentimentAsync fires in background (not awaited)
//   3. Claude classifies content → POSITIVE | NEUTRAL | NEGATIVE | MIXED
//   4. prisma.feedbacks.update({ sentiment: result })
//   5. Log token usage to AIUsageLogs (feature_name: "feedback_sentiment")
//
// [AI — future] Feedback summarization
//
// Add endpoint: POST /objectives/:id/feedbacks/summary
// Flow:
//   1. Fetch all ACTIVE top-level feedbacks for the objective
//   2. Send to Claude with prompt asking for structured summary per type / sentiment
//   3. Upsert result into FeedbackSummaries (@@unique on objective_id)
//   4. Log token usage to AIUsageLogs (feature_name: "feedback_summary")
// ---------------------------------------------------------------------------
