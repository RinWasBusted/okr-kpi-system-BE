import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { generateMessage } from "../../utils/notification.js";
import { sendNotification } from "../../services/notification.js";

const normalizeActorName = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const resolveActorName = async ({ actorName, actorId, companyId }, tx) => {
    const normalized = normalizeActorName(actorName);
    if (normalized) return normalized;

    if (Number.isInteger(actorId) && actorId > 0) {
        const actor = await tx.users.findFirst({
            where: {
                id: actorId,
                company_id: companyId,
                deleted_at: null,
            },
            select: {
                full_name: true,
                email: true,
            },
        });

        const fullName = normalizeActorName(actor?.full_name);
        if (fullName) return fullName;

        const email = normalizeActorName(actor?.email);
        if (email) return email;
    }

    return "Người dùng";
};

export const listNotifications = async (user, { page, pageSize, isRead }) => {
    const skip = (page - 1) * pageSize;

    const whereClause = {
        recipient_id: user.id,
        notification: {
            company_id: user.company_id,
        },
    };

    if (isRead === true) {
        whereClause.read_at = { not: null };
    } else if (isRead === false) {
        whereClause.read_at = null;
    }

    const [recipients, total] = await Promise.all([
        prisma.notificationRecipients.findMany({
            where: whereClause,
            skip,
            take: pageSize,
            orderBy: {
                notification: {
                    created_at: "desc",
                },
            },
            include: {
                notification: true,
            },
        }),
        prisma.notificationRecipients.count({
            where: whereClause,
        }),
    ]);

    const items = recipients.map((nr) => ({
        id: nr.notification.id,
        message: nr.notification.message,
        is_read: nr.read_at !== null,
        created_at: nr.notification.created_at,
        ref: {
            type: nr.notification.ref_type,
            id: nr.notification.ref_id,
        },
    }));

    const totalPages = Math.ceil(total / pageSize);

    return {
        items,
        pagination: {
            page,
            page_size: pageSize,
            total,
            total_pages: totalPages,
        },
    };
};

export const markOneRead = async (user, notificationId) => {
    const now = new Date();

    const recipient = await prisma.notificationRecipients.findFirst({
        where: {
            notification_id: notificationId,
            recipient_id: user.id,
        },
    });

    if (!recipient) {
        throw new AppError("Notification not found", 404);
    }

    if (recipient.read_at !== null) {
        return {
            id: notificationId,
            read_at: recipient.read_at,
        };
    }

    await prisma.notificationRecipients.update({
        where: {
            notification_id_recipient_id: {
                notification_id: notificationId,
                recipient_id: user.id,
            },
        },
        data: {
            read_at: now,
        },
    });

    return {
        id: notificationId,
        read_at: now,
    };
};

export const markAllRead = async (user) => {
    const now = new Date();

    const result = await prisma.notificationRecipients.updateMany({
        where: {
            recipient_id: user.id,
            read_at: null,
        },
        data: {
            read_at: now,
        },
    });

    return {
        updated_count: result.count,
        read_at: now,
    };
};

export const getUnreadCount = async (user) => {
    const count = await prisma.notificationRecipients.count({
        where: {
            recipient_id: user.id,
            read_at: null,
            notification: {
                company_id: user.company_id,
            },
        },
    });

    return {
        unread_count: count,
    };
};

export const createNotification = async (
    {
        companyId,
        eventType,
        refType,
        refId,
        actorId,
        actorName,
        entityName,
        newStatus,
        extraContext,
        recipientIds,
    },
    tx = prisma,
) => {
    // Validate required parameters
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("Invalid company ID: must be a positive integer", 400);
    }
    if (!eventType || typeof eventType !== "string" || !eventType.trim()) {
        throw new AppError(
            "Event type is required and must be a non-empty string",
            400,
        );
    }
    if (!refType || typeof refType !== "string" || !refType.trim()) {
        throw new AppError(
            "Ref type is required and must be a non-empty string",
            400,
        );
    }
    if (!Number.isInteger(refId) || refId <= 0) {
        throw new AppError("Invalid ref ID: must be a positive integer", 400);
    }
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        throw new AppError("Recipient IDs must be a non-empty array", 400);
    }
    if (!recipientIds.every((id) => Number.isInteger(id) && id > 0)) {
        throw new AppError("All recipient IDs must be positive integers", 400);
    }

    if (eventType === "STATUS_CHANGED") {
        if (typeof newStatus !== "string" || !newStatus.trim()) {
            throw new AppError(
                "newStatus is required for STATUS_CHANGED notifications",
                400,
            );
        }
    }

    if (extraContext !== undefined && extraContext !== null) {
        if (typeof extraContext !== "string") {
            throw new AppError("extraContext must be a string", 400);
        }
        if (extraContext.length > 150) {
            throw new AppError("extraContext cannot exceed 150 characters", 400);
        }
    }

    const finalActorName = await resolveActorName(
        { actorName, actorId, companyId },
        tx,
    );

    const message = generateMessage({
        eventType,
        refType,
        actorName: finalActorName,
        entityName,
        newStatus,
        extraContext,
    });

    const notification = await tx.notifications.create({
        data: {
            company_id: companyId,
            event_type: eventType,
            ref_type: refType,
            ref_id: refId,
            message,
            recipients: {
                create: recipientIds.map((id) => ({ recipient_id: id })),
            },
        },
    });

    sendNotification(recipientIds, notification);
};
