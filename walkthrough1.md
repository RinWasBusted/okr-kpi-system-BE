# Tổng kết Cập nhật Database Schema

Tính năng "Cảnh báo Hành vi Nhân viên" (AI Alert) đã được tích hợp thành công vào Database Schema.

## Các thay đổi chính

1.  **Thêm mới các Model:**
    *   `EmployeeFeatures`: Lưu trữ dữ liệu sau khi chạy ETL (đã chuẩn hoá để phục vụ ML).
    *   `RiskScores`: Lưu kết quả chấm điểm rủi ro theo thống kê và KNN.
    *   `AIAlerts`: Lưu kết quả cuối cùng sinh ra bởi LLM dưới dạng JSON cùng các actions liên quan.

2.  **Cập nhật Quan hệ (Relations):**
    *   Tất cả các bảng mới đều được liên kết chuẩn xác với bảng `Companies` và `Users` hiện tại.
    *   `EmployeeFeatures` có composite unique key `[user_id, period]` để đảm bảo tính toàn vẹn dữ liệu (mỗi nhân viên chỉ có 1 bản ghi mỗi kỳ đánh giá).

3.  **Thêm các Enum:**
    *   `KNNRiskLabel`: Phân loại rủi ro (LOW, MEDIUM, HIGH).
    *   `AlertSeverity`: Mức độ cảnh báo (INFO, WARNING, CRITICAL).
    *   `AlertStatus`: Trạng thái xử lý (UNREAD, ACKNOWLEDGED, RESOLVED).

## Kết quả Verification
Mình đã chạy thành công các lệnh kiểm tra của Prisma:

```bash
$ npx prisma format
Formatted prisma/schema.prisma in 31ms 🚀

$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

## Bước tiếp theo (Next Steps)
Để áp dụng schema này vào database thực tế của bạn, bạn hãy chạy lệnh migration:
```bash
npx prisma migrate dev --name init_ai_alerts
```
Sau đó bạn có thể tiến hành viết API cho luồng ETL và RAG được rồi.


Agent Context ETL Job Implementation
I have implemented the ETL job based on your updated requirements.

1. Schema Modifications
Removed checkin_delay_days from the EmployeeFeatures model in prisma/schema.prisma as requested, and regenerated the Prisma Client to ensure the backend uses the latest schema definitions.

2. ETL Logic Implementation
Created src/jobs/behaviorAnalysis.job.js with the following changes:

Calculations: Implemented pure JavaScript functions to calculate the mean and standard deviation (std_dev), negating the need for the simple-statistics package.
Data Collection:
kpi_completion_rate: Calculates the average progress_percentage from the current cycle's KPIAssignments.
checkin_frequency: Counts the number of check-ins by the user in the last 30 days.
feedback_sentiment_score: Maps Feedbacks.sentiment enum to numerical values (Positive = 1, Negative = -1, Others = 0) and computes the average over the last 30 days.
Statistical Alerting: Compares the newly computed features against their historical baseline (last 90 days). If any of the features fall below baseline - 2 * std_dev, a RiskScore record is generated with statistical_alert: true and the specific triggered features are recorded.
Scheduling: The ETL job is scheduled to run every night at 2:00 AM using node-cron.
