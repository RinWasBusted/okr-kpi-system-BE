import prisma from "./prisma.js";
import { createNotification } from "../api/notifications/notification.service.js";

/**
 * Get all users in a unit and its descendants
 * @param {number} unitId - The unit ID
 * @param {number} companyId - The company ID
 * @returns {Promise<number[]>} - Array of user IDs
 */
export const getUsersInUnitTree = async (unitId, companyId) => {
  if (!unitId) return [];

  const unitPath = await prisma.$queryRaw`
        SELECT path::text AS path
        FROM "Units"
        WHERE id = ${unitId} AND company_id = ${companyId}
    `;

  if (!unitPath || unitPath.length === 0) return [];

  const path = unitPath[0].path;

  // Get all units that are descendants of this unit (including itself)
  const descendantUnits = await prisma.$queryRaw`
        SELECT id
        FROM "Units"
        WHERE path <@ ${path}::ltree AND company_id = ${companyId}
`;

  const unitIds = descendantUnits.map((u) => u.id);

  // Get all active users in these units
  const users = await prisma.users.findMany({
    where: {
      unit_id: { in: unitIds },
      company_id: companyId,
      is_active: true,
      deleted_at: null,
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
};

/**
 * Get all users in a unit and its ancestors (for notification to managers)
 * @param {number} unitId - The unit ID
 * @param {number} companyId - The company ID
 * @returns {Promise<number[]>} - Array of user IDs
 */
export const getUsersInUnitAndAncestors = async (unitId, companyId) => {
  if (!unitId) return [];

  const unitPath = await prisma.$queryRaw`
        SELECT path::text AS path
        FROM "Units"
        WHERE id = ${unitId}
          AND company_id = ${companyId}
    `;

  if (!unitPath || unitPath.length === 0) return [];

  const path = unitPath[0].path;

  // Get all units that are ancestors of this unit (including itself)
  const ancestorUnits = await prisma.$queryRaw`
                SELECT id
                FROM "Units"
                WHERE path @> ${path}::ltree
                    AND company_id = ${companyId}
        `;

  const unitIds = ancestorUnits.map((u) => u.id);

  // Get all active users in these units
  const users = await prisma.users.findMany({
    where: {
      unit_id: { in: unitIds },
      company_id: companyId,
      is_active: true,
      deleted_at: null,
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
};

/**
 * Notify users about an objective event
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type (CREATED, UPDATED, etc.)
 * @param {Object} params.objective - Objective data
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event (to exclude from recipients)
 * @param {string} params.refType - Reference type (default: OBJECTIVE)
 */
export const notifyObjectiveEvent = async ({
  companyId,
  eventType,
  objective,
  actorName,
  actorId,
  newStatus,
  extraContext,
  refType = "OBJECTIVE",
}) => {
  try {
    let recipientIds = [];

    if (objective.unit_id) {
      // Get users in the unit tree
      recipientIds = await getUsersInUnitTree(objective.unit_id, companyId);
    } else if (objective.owner_id) {
      // Company-wide objective, notify owner
      const owner = await prisma.users.findUnique({
        where: { id: objective.owner_id },
        select: { id: true },
      });
      if (owner) recipientIds = [owner.id];
    }

    // Filter out the actor
    recipientIds = recipientIds.filter((id) => id !== actorId);

    if (recipientIds.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType,
      refId: objective.id,
      actorId,
      actorName,
      entityName: objective.title,
      newStatus,
      extraContext,
      recipientIds,
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("Failed to send notification:", error);
  }
};

/**
 * Notify specific users (e.g., owner, managers) about an objective event
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type
 * @param {Object} params.objective - Objective data
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event
 * @param {number[]} params.recipientIds - Specific recipient IDs
 * @param {string} params.refType - Reference type
 */
export const notifySpecificUsers = async ({
  companyId,
  eventType,
  objective,
  actorName,
  actorId,
  recipientIds,
  newStatus,
  extraContext,
  refType = "OBJECTIVE",
}) => {
  try {
    // Filter out the actor and ensure unique IDs
    const filteredRecipients = [...new Set(recipientIds)].filter(
      (id) => id !== actorId,
    );

    if (filteredRecipients.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType,
      refId: objective.id,
      actorId,
      actorName,
      entityName: objective.title,
      newStatus,
      extraContext,
      recipientIds: filteredRecipients,
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};

/**
 * Notify users about a KPI assignment event
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type
 * @param {Object} params.assignment - Assignment data
 * @param {string} params.kpiName - KPI dictionary name
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event
 */
export const notifyKPIAssignmentEvent = async ({
  companyId,
  eventType,
  assignment,
  kpiName,
  actorName,
  actorId,
  extraContext,
}) => {
  try {
    let recipientIds = [];

    if (assignment.unit_id) {
      // Get users in the unit tree
      recipientIds = await getUsersInUnitTree(assignment.unit_id, companyId);
    } else if (assignment.owner_id) {
      // Assigned to specific user
      recipientIds = [assignment.owner_id];
    }

    // Filter out the actor
    recipientIds = recipientIds.filter((id) => id !== actorId);

    if (recipientIds.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType: "KPI",
      refId: assignment.id,
      actorId,
      actorName,
      entityName: kpiName,
      extraContext,
      recipientIds,
    });
  } catch (error) {
    console.error("Failed to send KPI notification:", error);
  }
};

/**
 * Notify about feedback/reply events on an objective
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type
 * @param {number} params.objectiveId - Objective ID
 * @param {string} params.objectiveTitle - Objective title
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event
 * @param {number[]} params.recipientIds - Recipient IDs
 */
export const notifyFeedbackEvent = async ({
  companyId,
  eventType,
  objectiveId,
  objectiveTitle,
  actorName,
  actorId,
  recipientIds,
  extraContext,
}) => {
  try {
    // Filter out the actor
    const filteredRecipients = recipientIds.filter((id) => id !== actorId);

    if (filteredRecipients.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType: "OBJECTIVE",
      refId: objectiveId,
      actorId,
      actorName,
      entityName: objectiveTitle,
      extraContext,
      recipientIds: filteredRecipients,
    });
  } catch (error) {
    console.error("Failed to send feedback notification:", error);
  }
};

/**
 * Notify about a feedback status change.
 * Notifies the feedback author and the objective owner, if available.
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type
 * @param {number} params.feedbackId - Feedback ID
 * @param {string} params.feedbackPreview - Short feedback content preview
 * @param {number} params.objectiveId - Objective ID
 * @param {string} params.objectiveTitle - Objective title
 * @param {number} params.feedbackAuthorId - Feedback author user ID
 * @param {number} params.objectiveOwnerId - Objective owner user ID
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event
 * @param {string} params.newStatus - New feedback status
 */
export const notifyFeedbackStatusEvent = async ({
  companyId,
  eventType,
  feedbackId,
  feedbackPreview,
  objectiveId,
  objectiveTitle,
  feedbackAuthorId,
  objectiveOwnerId,
  actorName,
  actorId,
  newStatus,
}) => {
  try {
    const recipientIds = [
      ...new Set([feedbackAuthorId, objectiveOwnerId].filter(Boolean)),
    ].filter((id) => id !== actorId);

    if (recipientIds.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType: "FEEDBACK",
      refId: feedbackId,
      actorId,
      actorName,
      entityName: feedbackPreview,
      newStatus,
      extraContext: `Mục tiêu: ${objectiveTitle}`,
      recipientIds,
    });
  } catch (error) {
    console.error("Failed to send feedback status notification:", error);
  }
};

/**
 * Notify about a cycle event (created, locked, etc.)
 * @param {Object} params - Notification parameters
 * @param {number} params.companyId - Company ID
 * @param {string} params.eventType - Event type (CREATED, UPDATED, LOCKED, etc.)
 * @param {Object} params.cycle - Cycle data { id, name }
 * @param {string} params.actorName - Name of the user who triggered the event
 * @param {number} params.actorId - ID of the user who triggered the event
 * @param {number[]} params.recipientIds - Specific recipient IDs (optional, defaults to all company users)
 */
export const notifyCycleEvent = async ({
  companyId,
  eventType,
  cycle,
  actorName,
  actorId,
  recipientIds,
  extraContext,
}) => {
  try {
    let finalRecipientIds = recipientIds;

    // If no specific recipients provided, notify all active users in company
    if (!finalRecipientIds || finalRecipientIds.length === 0) {
      const users = await prisma.users.findMany({
        where: {
          company_id: companyId,
          is_active: true,
          deleted_at: null,
        },
        select: { id: true },
      });
      finalRecipientIds = users.map((u) => u.id);
    }

    // Filter out the actor
    finalRecipientIds = finalRecipientIds.filter((id) => id !== actorId);

    if (finalRecipientIds.length === 0) return;

    await createNotification({
      companyId,
      eventType,
      refType: "CYCLE",
      refId: cycle.id,
      actorId,
      actorName,
      entityName: cycle.name,
      extraContext,
      recipientIds: finalRecipientIds,
    });
  } catch (error) {
    console.error("Failed to send cycle notification:", error);
  }
};

export default {
  getUsersInUnitTree,
  getUsersInUnitAndAncestors,
  notifyObjectiveEvent,
  notifySpecificUsers,
  notifyKPIAssignmentEvent,
  notifyFeedbackEvent,
  notifyFeedbackStatusEvent,
  notifyCycleEvent,
};
