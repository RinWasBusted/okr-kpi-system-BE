# Feedback — thiết kế DB & hợp đồng API

Đặc tả **bảng `Feedbacks`** (mục tiêu migrate) và **REST** dưới `{ORIGIN}/api`. Cookie `accessToken` (JWT) như các route OKR hiện có.

---

## 1. Tổng quan


| Ý         | Nội dung                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Neo       | Luôn có `objective_id`; `kr_tag_id` tùy chọn để gắn một Key Result trong cùng objective.               |
| Sentiment | Enum `FeedbackSentiment`, mặc định `UNKNOWN` nếu client không gửi — **không** dùng `sentiment_source`. |


---

## 2. Luồng Feedback → chỉnh sửa / điều chỉnh OKR

**Mục đích:** feedback không chỉ là “bản ghi lưu ý”, mà là **tín hiệu để owner / quản lý xem xét** objective và KR, rồi **chỉnh sửa OKR** khi có vấn đề (định tính), theo lộ trình lặp chứ không một lần.

**Gợi ý sản phẩm / nghiệp vụ**

1. **Đọc & lọc:** trên màn objective (hoặc KR), hiển thị danh sách feedback; lọc `sentiment` (ví dụ `NEGATIVE`, `MIXED`), `type`, `kr_tag_id` để tập trung rủi ro hoặc bất đồng.
2. **Liên kết hành động:** CTA kiểu “Mở chỉnh sửa OKR” / “Điều chỉnh KR” dẫn tới màn `PUT /objectives/:id` hoặc luồng key-result tương ứng — có thể kèm `objectiveId` và gợi ý mở tab KR nếu feedback có `kr_tag_id`.
3. **API objective (`PUT /objectives/:id`):** đã cho phép cập nhật khi status **`Active`** (cùng `Draft`, `Rejected`): chỉnh `title` / `parent_objective_id` / `visibility` mà **không** đưa objective về `Draft` và **giữ** `approved_by`. Trạng thái **`Pending_Approval`** và **`Closed`** vẫn không sửa qua endpoint này. Quyền vẫn theo `canEditObjective` (admin công ty, owner, manager đơn vị).
4. **Vòng lặp:** nhận feedback → phân tích (con người hoặc sau này AI tóm tắt) → sửa title/scope/KR/timeline nếu hợp lý → có thể trả lời bằng feedback mới hoặc đóng vòng bằng cập nhật OKR.

**Tùy chọn sau (không bắt buộc v1):** cờ `resolved`, `linked_edit_at`, hoặc `ref_objective_version` để audit “đã đổi OKR sau feedback này”.

---

## 3. Cơ sở dữ liệu — `Feedbacks`

### 3.1 Enum

```prisma
enum FeedbackSentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
  MIXED
  UNKNOWN
}
```

### 3.2 Cột


| *Cột           | Kiểu              | Null | FK           | Mô tả                                |
| -------------- | ----------------- | ---- | ------------ | ------------------------------------ |
| `id`           | Int               |      | PK           |                                      |
| `company_id`   | Int               |      | → Companies  | Tenant                               |
| `objective_id` | Int               |      | → Objectives | Luôn bắt buộc                        |
| `kr_tag_id`    | Int               | Có   | → KeyResults | Neo KR; `null` = chung cho objective |
| `user_id`      | Int               |      | → Users      | Tác giả                              |
| `content`      | Text              |      |              |                                      |
| `type`         | String            |      |              | ví dụ `general`, `rejection`         |
| `sentiment`    | FeedbackSentiment |      |              | `@default(UNKNOWN)`                  |
| `created_at`   | DateTime          |      |              | `@default(now())`                    |


`KeyResults`:** thêm `feedbacks Feedbacks[]`; `Feedbacks.key_result` optional. **FK `kr_tag_id`:** khuyến nghị `ON DELETE SET NULL`.

**Ràng buộc:** nếu `kr_tag_id` có giá trị thì KR phải cùng `company_id` và cùng `objective_id` với feedback; KR còn hiệu lực (ví dụ `deleted_at` null).

---

## 4. HTTP API

### 4.1 Envelope

- **Thành công:** `{ "success": true, "message", "data", "meta"? }` — `meta` khi phân trang.
- **Lỗi:** `{ "success": false, "error": { "code", "message", "details"? } }`.

### 4.2 Danh sách endpoint


| Method | Path (sau `/api`)                                | Mục đích                           |
| ------ | ------------------------------------------------ | ---------------------------------- |
| GET    | `/objectives/:objectiveId/feedbacks`             | List + lọc                         |
| POST   | `/objectives/:objectiveId/feedbacks`             | Tạo                                |
| GET    | `/objectives/:objectiveId/feedbacks/:feedbackId` | Chi tiết                           |
| PATCH  | `/objectives/:objectiveId/feedbacks/:feedbackId` | Sửa một phần                       |
| DELETE | `/objectives/:objectiveId/feedbacks/:feedbackId` | Xóa (tác giả hoặc `ADMIN_COMPANY`) |


### 4.3 Bảng tham số tổng hợp

*Mọi request: cookie `accessToken`.*


| Endpoint             | Path                        | Query                                                                                         | Body (JSON)                                     |
| -------------------- | --------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| GET …/feedbacks      | `objectiveId`               | `page?` (mặc định 1), `per_page?` (mặc định 20, max 100), `kr_tag_id?`, `sentiment?`, `type?` | —                                               |
| POST …/feedbacks     | `objectiveId`               | —                                                                                             | `content`*, `type`*, `kr_tag_id?`, `sentiment?` |
| GET …/:feedbackId    | `objectiveId`, `feedbackId` | —                                                                                             | —                                               |
| PATCH …/:feedbackId  | `objectiveId`, `feedbackId` | —                                                                                             | `content?`, `type?`, `kr_tag_id?`, `sentiment?` |
| DELETE …/:feedbackId | `objectiveId`, `feedbackId` | —                                                                                             | —                                               |


 bắt buộc khi POST; PATCH chỉ gửi trường cần đổi. `sentiment`: giá trị enum; bỏ qua khi tạo → server `UNKNOWN`.

### 4.4 Response

- **GET list 200:** `data`: mảng **Feedback**; `meta`: `total`, `page`, `per_page`, `last_page`.
- **POST 201 / PATCH 200:** `data.feedback`: object **Feedback**.
- **GET một 200:** `data.feedback`.
- **DELETE 200:** `data.id` (id đã xóa).

**Object `Feedback`:** `id`, `objective_id`, `kr_tag_id` (null được), `content`, `type`, `sentiment`, `created_at`, `user` `{ id, full_name, avatar_url?, job_title? }`. *(Tùy chọn sau: `updated_at`, `key_result` rút gọn cho UI.)*

**Lỗi thường gặp:** `401` / `403` / `404`; `422` validation hoặc `kr_tag_id` không trùng objective/company.

**PATCH:** ai được sửa do policy (ví dụ tác giả + `ADMIN_COMPANY`); có thể khóa sửa `type` với bản ghi hệ thống (`rejection`).

---

## 5. Phụ lục (sau này)

AI tóm tắt, threading, visibility từng dòng, xóa mềm, checklist bảo mật chi tiết.

---

## 6. Nhật ký


| Ngày       | Nội dung                                                                |
| ---------- | ----------------------------------------------------------------------- |
| 2026-03-28 | Refactor DB + HTTP đầy đủ                                               |
| 2026-03-28 | Bỏ `sentiment_source`; gọn tài liệu; thêm §2 luồng feedback → chỉnh OKR |
| 2026-03-28 | Ghi nhận `PUT /objectives/:id` cho phép khi `Active` (khớp code backend) |


---

*Chốt spec → migration Prisma + implement route/service.*