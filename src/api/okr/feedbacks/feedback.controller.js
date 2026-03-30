import * as feedbackService from "./feedback.service.js";
import AppError from "../../../utils/appError.js";

// ---------------------------------------------------------------------------
// Parse helpers (mirrors objective.controller.js conventions)
// ---------------------------------------------------------------------------

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseOptionalId = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
};

const VALID_TYPES = ["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"];
const VALID_SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED", "UNKNOWN"];
const VALID_STATUSES = ["ACTIVE", "RESOLVED", "FLAGGED"];

const parseFeedbackType = (value, required = false) => {
    if (value === undefined || value === null || value === "") {
        if (required) throw new AppError("type is required", 422);
        return undefined;
    }
    const upper = String(value).toUpperCase();
    if (!VALID_TYPES.includes(upper)) {
        throw new AppError(`type must be one of: ${VALID_TYPES.join(", ")}`, 422);
    }
    return upper;
};

const parseSentiment = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const upper = String(value).toUpperCase();
    if (!VALID_SENTIMENTS.includes(upper)) {
        throw new AppError(`sentiment must be one of: ${VALID_SENTIMENTS.join(", ")}`, 422);
    }
    return upper;
};

const parseFeedbackStatus = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const upper = String(value).toUpperCase();
    if (!VALID_STATUSES.includes(upper)) {
        throw new AppError(`status must be one of: ${VALID_STATUSES.join(", ")}`, 422);
    }
    return upper;
};

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

// GET /objectives/:objectiveId/feedbacks
export const listFeedbacks = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objectiveId, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const page = parsePositiveInt(req.query.page, 1);
        const per_page = Math.min(parsePositiveInt(req.query.per_page, 20), 100);

        const filters = {
            type: parseFeedbackType(req.query.type),
            sentiment: parseSentiment(req.query.sentiment),
            status: parseFeedbackStatus(req.query.status),
            kr_tag_id: parseOptionalId(req.query.kr_tag_id),
        };

        const { total, last_page, data } = await feedbackService.listFeedbacks(
            req.user,
            objectiveId,
            filters,
            page,
            per_page
        );

        res.success("Feedbacks retrieved successfully", 200, data, {
            total,
            page,
            per_page,
            last_page,
        });
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:objectiveId/feedbacks
export const createFeedback = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objectiveId, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { content, type, kr_tag_id } = req.body;

        if (!content || typeof content !== "string" || content.trim() === "") {
            throw new AppError("content is required", 422);
        }

        const feedback = await feedbackService.createFeedback(req.user, objectiveId, {
            content: content.trim(),
            type: parseFeedbackType(type, true),
            kr_tag_id: parseOptionalId(kr_tag_id),
        });

        res.success("Feedback created successfully", 201, { feedback });
    } catch (error) {
        throw error;
    }
};

// GET /objectives/:objectiveId/feedbacks/:feedbackId
export const getFeedback = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objectiveId, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const feedbackId = parsePositiveInt(req.params.feedbackId, null);
        if (!feedbackId) throw new AppError("Invalid feedback ID", 400);

        const feedback = await feedbackService.getFeedback(req.user, objectiveId, feedbackId);

        res.success("Feedback retrieved successfully", 200, { feedback });
    } catch (error) {
        throw error;
    }
};

// PATCH /objectives/:objectiveId/feedbacks/:feedbackId
export const updateFeedback = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objectiveId, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const feedbackId = parsePositiveInt(req.params.feedbackId, null);
        if (!feedbackId) throw new AppError("Invalid feedback ID", 400);

        const { content, type, sentiment, status, kr_tag_id } = req.body;
        const updates = {};

        if (content !== undefined) {
            if (typeof content !== "string" || content.trim() === "") {
                throw new AppError("content must be a non-empty string", 422);
            }
            updates.content = content.trim();
        }

        if (type !== undefined) updates.type = parseFeedbackType(type);
        if (sentiment !== undefined) updates.sentiment = parseSentiment(sentiment);
        if (status !== undefined) updates.status = parseFeedbackStatus(status);
        if (kr_tag_id !== undefined) {
            const parsedKrTagId = parseOptionalId(kr_tag_id);
            // If a value was provided but cannot be parsed as a valid ID,
            // and it's not an explicit "clear" (null or empty string), reject it.
            if (parsedKrTagId === undefined && kr_tag_id !== null && kr_tag_id !== "") {
                throw new AppError("Invalid kr_tag_id", 422);
            }
            updates.kr_tag_id = parsedKrTagId ?? null;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const feedback = await feedbackService.updateFeedback(
            req.user,
            objectiveId,
            feedbackId,
            updates
        );

        res.success("Feedback updated successfully", 200, { feedback });
    } catch (error) {
        throw error;
    }
};

// DELETE /objectives/:objectiveId/feedbacks/:feedbackId
export const deleteFeedback = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objectiveId, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const feedbackId = parsePositiveInt(req.params.feedbackId, null);
        if (!feedbackId) throw new AppError("Invalid feedback ID", 400);

        const result = await feedbackService.deleteFeedback(req.user, objectiveId, feedbackId);

        res.success("Feedback deleted successfully", 200, result);
    } catch (error) {
        throw error;
    }
};

// ---------------------------------------------------------------------------
// Thread endpoints
// ---------------------------------------------------------------------------

// GET /feedbacks/:id/replies
export const listReplies = async (req, res) => {
    try {
        const feedbackId = parsePositiveInt(req.params.id, null);
        if (!feedbackId) throw new AppError("Invalid feedback ID", 400);

        const replies = await feedbackService.listReplies(req.user, feedbackId);

        res.success("Replies retrieved successfully", 200, replies);
    } catch (error) {
        throw error;
    }
};

// POST /feedbacks/:id/replies
export const createReply = async (req, res) => {
    try {
        const feedbackId = parsePositiveInt(req.params.id, null);
        if (!feedbackId) throw new AppError("Invalid feedback ID", 400);

        const { content, type } = req.body;

        if (!content || typeof content !== "string" || content.trim() === "") {
            throw new AppError("content is required", 422);
        }

        const reply = await feedbackService.createReply(req.user, feedbackId, {
            content: content.trim(),
            type: parseFeedbackType(type, true),
        });

        res.success("Reply created successfully", 201, { feedback: reply });
    } catch (error) {
        throw error;
    }
};