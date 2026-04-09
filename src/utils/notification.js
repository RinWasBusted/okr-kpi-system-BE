/**
 * notification.js
 * Utility for generating localized notification messages.
 *
 * generateMessage accepts:
 * {
 *   eventType   : string   – one of EventType enum values
 *   refType     : string   – one of ReferenceType enum values
 *   actorName   : string   – display name of the user who triggered the event
 *   entityName  : string   – human-readable name of the affected entity
 *   newStatus   : string?  – required for STATUS_CHANGED events
 *                           (Pending_Approval | ON_TRACK | COMPLETED | Rejected | …)
 *   extraContext: string?  – short supplementary snippet (e.g. feedback excerpt,
 *                           KR title, reject reason, new cycle name)
 * }
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeText = (value, fallback = "") => {
    if (typeof value !== "string") return fallback;
    return value.trim();
};

const normalizeEntityName = (value, fallback = "không xác định") => {
    const text = normalizeText(value, fallback);
    return text.replace(/^['"`]+|['"`]+$/g, "");
};

/**
 * Map a ReferenceType enum value to a Vietnamese display label.
 */
const refLabel = (refType) => {
    const map = {
        OBJECTIVE: "Mục tiêu",
        KPI: "KPI",
        CYCLE: "Chu kỳ",
        UNIT: "Phòng ban",
        FEEDBACK: "Phản hồi",
    };
    return map[normalizeText(refType).toUpperCase()] ?? normalizeText(refType);
};

/**
 * Determine the semantic meaning of a STATUS_CHANGED event
 * based on the new status value.
 */
const resolveStatusChangedVariant = (newStatus) => {
    switch (normalizeText(newStatus).toLowerCase()) {
        case "pending_approval":
            return "submitted";
        case "rejected":
            return "rejected";
        case "on_track":
        case "not_started":
        case "warning":
        case "danger":
        case "at_risk":
        case "critical":
        case "completed":
            return "approved";
        default:
            return "generic";
    }
};

// ---------------------------------------------------------------------------
// generateMessage
// ---------------------------------------------------------------------------

/**
 * Returns a full, self-explanatory notification message.
 * There is no separate title field — this message is displayed on its own.
 */
export const generateMessage = ({
    eventType,
    refType,
    actorName,
    entityName,
    newStatus,
    extraContext,
}) => {
    const label = refLabel(refType);
    const actor = normalizeText(actorName, "Người dùng");
    const entity = normalizeEntityName(entityName);
    const extra = normalizeText(extraContext);

    switch (eventType) {
        case "CREATED":
            return `${actor} đã tạo ${label} "${entity}"`;

        case "UPDATED":
            if (extra) {
                return `${actor} đã cập nhật ${label} "${entity}" · ${extra}`;
            }
            return `${actor} đã cập nhật ${label} "${entity}"`;

        case "DELETED":
            return `${actor} đã xóa ${label} "${entity}"`;

        case "ASSIGNED":
            return `Bạn được ${actor} giao ${label} "${entity}"`;

        case "STATUS_CHANGED": {
            const variant = resolveStatusChangedVariant(newStatus);
            if (variant === "submitted")
                return `${actor} đã gửi ${label} "${entity}" lên chờ phê duyệt`;
            if (variant === "approved")
                return `${label} "${entity}" đã được ${actor} phê duyệt`;
            if (variant === "rejected") {
                if (extra)
                    return `${label} "${entity}" bị ${actor} từ chối · Lý do: ${extra}`;
                return `${label} "${entity}" đã bị ${actor} từ chối`;
            }
            return `Trạng thái của ${label} "${entity}" đã được ${actor} cập nhật`;
        }

        case "COMMENTED":
            if (extra)
                return `${actor} đã bình luận trên ${label} "${entity}": "${extra}"`;
            return `${actor} đã bình luận trên ${label} "${entity}"`;

        case "REPLIED":
            if (extra)
                return `${actor} đã trả lời bình luận trong ${label} "${entity}": "${extra}"`;
            return `${actor} đã trả lời bình luận trong ${label} "${entity}"`;

        case "LOCKED":
            return `${actor} đã khóa ${label} "${entity}". Không thể chỉnh sửa thêm.`;

        case "CLONED":
            if (extra)
                return `${actor} đã sao chép ${label} "${entity}" thành "${extra}"`;
            return `${actor} đã sao chép ${label} "${entity}" thành công`;

        case "REMINDER":
            return `Nhắc nhở: ${label} "${entity}" sắp đến hạn. Hãy cập nhật tiến độ.`;

        default:
            return `Có cập nhật mới trên ${label} "${entity}"`;
    }
};
