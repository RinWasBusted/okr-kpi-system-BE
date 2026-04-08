import * as notificationService from "./notification.service.js";
import AppError from "../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const listNotifications = async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = parsePositiveInt(req.query.page_size, 10);
  const isRead =
    req.query.is_read === undefined
      ? undefined
      : req.query.is_read === "true";

  const result = await notificationService.listNotifications(req.user, {
    page,
    pageSize,
    isRead,
  });

  res.success("Notifications retrieved", 200, result);
};

export const markOneRead = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid notification id", 400);
  }

  const result = await notificationService.markOneRead(req.user, id);
  res.success("Notification marked as read", 200, result);
};

export const markAllRead = async (req, res) => {
  const result = await notificationService.markAllRead(req.user);
  res.success("All notifications marked as read", 200, result);
};

export const getUnreadCount = async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user);
  res.success("Unread count retrieved", 200, result);
};
