import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { UserRole } from "@prisma/client";
import { getObjectiveAccessPath, getUnitPath } from "../../../utils/path.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
    if (!candidate || !descendant) return false;
    return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

const canViewObjective = async (user, objective) => {
    if (!objective) return false;
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (objective.visibility === "PUBLIC") return true;

    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
    const objectivePath =
        objective.access_path ?? (objective.id ? await getObjectiveAccessPath(objective.id) : null);

    if (objective.visibility === "INTERNAL") {
        if (!objectivePath || !userPath) return false;
        return (
            isAncestorOrEqual(objectivePath, userPath) ||
            isDescendantOrEqual(objectivePath, userPath)
        );
    }

    if (objective.visibility === "PRIVATE") {
        if (objective.owner_id === user.id) return true;
        if (!objectivePath || !userPath) return false;
        return objectivePath !== userPath && isDescendantOrEqual(objectivePath, userPath);
    }

    return false;
};

const canMutateFeedback = (user, feedback) => {
    return user.role === UserRole.ADMIN_COMPANY || feedback.user_id === user.id;
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
    kr_tag_id: true,
    parent_id: true,
    content: true,
    type: true,
    sentiment: true,
    status: true,
    created_at: true,
    updated_at: true,
    user: { select: userSelect },
    _count: { select: { replies: true } },
};

const formatFeedback = (fb) => ({
    id: fb.id,
    objective_id: fb.objective_id,
    kr_tag_id: fb.kr_tag_id ?? null,
    parent_id: fb.parent_id ?? null,
    content: fb.content,
    type: fb.type,
    sentiment: fb.sentiment,
    status: fb.status,
    created_at: fb.created_at,
    updated_at: fb.updated_at ?? null,
    user: fb.user ?? null,
    reply_count: fb._count?.replies ?? 0,
});

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const getObjectiveForFeedback = async (objectiveId) => {
    const rows = await prisma.$queryRaw`
        SELECT id, status, visibility, unit_id, owner_id, access_path::text AS access_path
        FROM "Objectives"
        WHERE id = ${objectiveId}
          AND deleted_at IS NULL
    `;
    if (!rows || rows.length === 0) throw new AppError("Objective not found", 404);
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
            422
        );
    }
};

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

export const listFeedbacks = async (user, objectiveId, filters, page, per_page) => {
    const objective = await getObjectiveForFeedback(objectiveId);

    if (!(await canViewObjective(user, objective))) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const where = {
        objective_id: objectiveId,
        parent_id: null, // top-level only; replies fetched separately via listReplies
        ...(filters.type && { type: filters.type }),
        ...(filters.sentiment && { sentiment: filters.sentiment }),
        ...(filters.status && { status: filters.status }),
        ...(filters.kr_tag_id !== undefined && { kr_tag_id: filters.kr_tag_id }),
    };

    const [total, rows] = await Promise.all([
        prisma.feedbacks.count({ where }),
        prisma.feedbacks.findMany({
            where,
            orderBy: { created_at: "desc" },
            skip: (page - 1) * per_page,
            take: per_page,
            select: feedbackSelect,
        }),
    ]);

    return {
        total,
        last_page: Math.ceil(total / per_page),
        data: rows.map(formatFeedback),
    };
};

export const createFeedback = async (user, objectiveId, payload) => {
    const objective = await getObjectiveForFeedback(objectiveId);

    if (objective.status !== "Active") {
        throw new AppError("Feedback can only be created on active objectives", 400);
    }

    if (!(await canViewObjective(user, objective))) {
        throw new AppError("You do not have permission to post feedback on this objective", 403);
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
            type: payload.type,
            sentiment: "UNKNOWN",
            // [AI — sentiment detection] When ready, call detectSentimentAsync(created.id, payload.content)
            // here as fire-and-forget. It classifies content via Claude and updates sentiment in background.
            status: "ACTIVE",
        },
        select: feedbackSelect,
    });

    return formatFeedback(created);
};

export const getFeedback = async (user, objectiveId, feedbackId) => {
    const objective = await getObjectiveForFeedback(objectiveId);

    if (!(await canViewObjective(user, objective))) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const feedback = await getFeedbackOrThrow(feedbackId, objectiveId);
    return formatFeedback(feedback);
};

export const updateFeedback = async (user, objectiveId, feedbackId, updates) => {
    await getObjectiveForFeedback(objectiveId);

    const feedback = await getFeedbackOrThrow(feedbackId, objectiveId);

    if (!canMutateFeedback(user, feedback)) {
        throw new AppError("You do not have permission to edit this feedback", 403);
    }

    if (updates.kr_tag_id !== undefined && updates.kr_tag_id !== null) {
        await validateKrTagId(updates.kr_tag_id, objectiveId, user.company_id);
    }

    const updated = await prisma.feedbacks.update({
        where: { id: feedbackId },
        data: {
            ...(updates.content !== undefined && { content: updates.content }),
            ...(updates.type !== undefined && { type: updates.type }),
            ...(updates.sentiment !== undefined && { sentiment: updates.sentiment }),
            ...(updates.status !== undefined && { status: updates.status }),
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
        throw new AppError("You do not have permission to delete this feedback", 403);
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
        throw new AppError("You do not have permission to view this objective", 403);
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
        select: { id: true, objective_id: true, parent_id: true },
    });
    if (!parent) throw new AppError("Feedback not found", 404);

    // Enforce max depth = 1 (reply to a reply is not allowed)
    if (parent.parent_id !== null) {
        throw new AppError("Replies can only be made to top-level feedback", 400);
    }

    const objective = await getObjectiveForFeedback(parent.objective_id);

    if (objective.status !== "Active") {
        throw new AppError("Feedback can only be created on active objectives", 400);
    }

    if (!(await canViewObjective(user, objective))) {
        throw new AppError("You do not have permission to reply to this feedback", 403);
    }

    const created = await prisma.feedbacks.create({
        data: {
            company_id: user.company_id,
            objective_id: parent.objective_id,
            kr_tag_id: null, // replies do not tag a KR
            user_id: user.id,
            parent_id: parentFeedbackId,
            content: payload.content,
            type: payload.type,
            sentiment: "UNKNOWN",
            // [AI — sentiment detection] Same hook point as createFeedback.
            status: "ACTIVE",
        },
        select: feedbackSelect,
    });

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
//
// [AI — future] Clustering
//
// Batch job that groups feedbacks by topic using embeddings or Claude classification.
// Results can be stored as tags or a separate FeedbackClusters table.
// ---------------------------------------------------------------------------