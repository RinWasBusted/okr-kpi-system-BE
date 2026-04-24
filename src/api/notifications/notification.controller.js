import * as notificationService from "./notification.service.js";
import {
  listNotificationsQuerySchema,
  markNotificationReadParamSchema,
} from "../../schemas/notification.schema.js";
import { notificationEventListener, stopListening, sendNotification  } from "../../services/notification.js";

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

export const streamNotifications = async (req, res, next) => {
  try {
    // Set headers for SSE - use setHeader to preserve CORS headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.write("\n"); // Send initial data to establish the connection

    const onNotification = (data) => {
      res.write(`data: ${data}\n\n`);
    };

    await notificationEventListener(req.user.id, onNotification);

    // Uncomment the following block for testing SSE with dummy data.
    // let cnt = 1;
    // const intervalId = setInterval(() => {
    //   // res.write(`data: {"id":${cnt},"message":"Người dùng John Doe đã cập nhật mục tiêu","ref_type":"OBJECTIVE","ref_id":456,"event_type":"UPDATED","created_at":"2026-04-22T10:30:45.000Z"}\n\n`);
    //   sendNotification([req.user.id], {
    //     id: cnt,
    //     message: `Notification ${cnt}`,
    //     ref_type: "TEST",
    //     ref_id: cnt,
    //     event_type: "CREATED",
    //     created_at: new Date().toISOString(),
    //   });
    //   cnt++;
    // }, 2000);

    req.on("close", async () => {
      // clearInterval(intervalId);
      await stopListening(req.user.id, onNotification);
      res.end();
    });
  } catch (error) {
    next(error);
  }
};
