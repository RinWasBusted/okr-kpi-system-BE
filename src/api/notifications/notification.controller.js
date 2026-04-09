import * as notificationService from "./notification.service.js";
import AppError from "../../utils/appError.js";
import {
  listNotificationsQuerySchema,
  markNotificationReadParamSchema,
} from "../../schemas/notification.schema.js";

export const listNotifications = async (req, res, next) => {
  try {
    // Validate query parameters using schema
    const validated = listNotificationsQuerySchema.parse(req.query);

    const result = await notificationService.listNotifications(req.user, {
      page: validated.page,
      pageSize: validated.page_size,
      isRead: validated.is_read,
    });

    res.success("Notifications retrieved successfully", 200, result);
  } catch (error) {
    next(error);
  }
};

export const markOneRead = async (req, res, next) => {
  try {
    // Validate path parameter using schema
    const validated = markNotificationReadParamSchema.parse(req.params);

    const result = await notificationService.markOneRead(req.user, validated.id);
    res.success("Notification marked as read successfully", 200, result);
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user);
    res.success("All notifications marked as read successfully", 200, result);
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user);
    res.success("Unread notification count retrieved successfully", 200, result);
  } catch (error) {
    next(error);
  }
};
