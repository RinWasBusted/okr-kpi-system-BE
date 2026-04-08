import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";

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
    title: nr.notification.title,
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
    actorName,
    entityName,
    recipientIds,
  },
  tx = prisma
) => {
  const { generateMessage, generateTitle } = await import(
    "../../utils/notification.js"
  );

  const message = generateMessage({
    eventType,
    refType,
    actorName,
    entityName,
  });
  const title = generateTitle({ eventType, refType, entityName });

  await tx.notifications.create({
    data: {
      company_id: companyId,
      event_type: eventType,
      ref_type: refType,
      ref_id: refId,
      title,
      message,
      recipients: {
        create: recipientIds.map((id) => ({ recipient_id: id })),
      },
    },
  });
};
