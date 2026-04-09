const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim();
};

const normalizeEntityName = (value) => {
  const text = normalizeText(value, "mục tiêu");
  // Remove one layer of wrapping quotes to avoid awkward escaped output.
  return text.replace(/^['"`]+|['"`]+$/g, "");
};

export const generateMessage = ({
  eventType,
  refType,
  actorName,
  entityName,
}) => {
  const ref = normalizeText(refType, "mục").toLowerCase();
  const actor = normalizeText(actorName, "Người dùng");
  const entity = normalizeEntityName(entityName);

  switch (eventType) {
    case "CREATED":
      return `${actor} đã tạo ${ref} ${entity}`;
    case "UPDATED":
      return `${ref} ${entity} đã được cập nhật bởi ${actor}`;
    case "DELETED":
      return `${ref} ${entity} đã bị xóa bởi ${actor}`;
    case "ASSIGNED":
      return `Bạn được gán vào ${ref} ${entity}`;
    case "STATUS_CHANGED":
      return `${ref} ${entity} đã thay đổi trạng thái`;
    case "COMMENTED":
      return `${actor} đã bình luận vào ${ref} ${entity}`;
    case "REPLIED":
      return `${actor} đã trả lời bình luận trong ${ref} ${entity}`;
    case "LOCKED":
      return `${ref} ${entity} đã bị khóa bởi ${actor}`;
    case "CLONED":
      return `${ref} ${entity} đã được sao chép bởi ${actor}`;
    case "REMINDER":
      return `Nhắc nhở: ${ref} ${entity} sắp đến hạn`;
    default:
      return `Có cập nhật mới trên ${ref} ${entity}`;
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
    REPLIED: `Trả lời mới`,
    LOCKED: `${ref} đã bị khóa`,
    CLONED: `${ref} được sao chép`,
    REMINDER: `Nhắc nhở`,
  };
  return map[eventType] ?? `Thông báo ${ref}`;
};
