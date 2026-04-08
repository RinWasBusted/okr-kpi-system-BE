export const generateMessage = ({
  eventType,
  refType,
  actorName,
  entityName,
}) => {
  const ref = refType.toLowerCase();
  switch (eventType) {
    case "CREATED":
      return `${actorName} đã tạo ${ref} "${entityName}"`;
    case "UPDATED":
      return `${ref} "${entityName}" đã được cập nhật bởi ${actorName}`;
    case "DELETED":
      return `${ref} "${entityName}" đã bị xóa bởi ${actorName}`;
    case "ASSIGNED":
      return `Bạn được gán vào ${ref} "${entityName}"`;
    case "STATUS_CHANGED":
      return `${ref} "${entityName}" đã thay đổi trạng thái`;
    case "COMMENTED":
      return `${actorName} đã bình luận vào ${ref} "${entityName}"`;
    case "REMINDER":
      return `Nhắc nhở: ${ref} "${entityName}" sắp đến hạn`;
    default:
      return `Có cập nhật mới trên ${ref} "${entityName}"`;
  }
};

export const generateTitle = ({ eventType, refType, entityName }) => {
  const ref = refType.toLowerCase();
  const map = {
    CREATED: `${ref} mới được tạo`,
    UPDATED: `${ref} đã được cập nhật`,
    DELETED: `${ref} đã bị xóa`,
    ASSIGNED: `Bạn được gán vào ${ref}`,
    STATUS_CHANGED: `Trạng thái ${ref} thay đổi`,
    COMMENTED: `Bình luận mới`,
    REMINDER: `Nhắc nhở`,
  };
  return map[eventType] ?? `Thông báo ${ref}`;
};
