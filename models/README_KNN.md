# KNN Risk Model — Employee Behavior Analysis

## Tổng quan
Pipeline huấn luyện model **KNN (K-Nearest Neighbors)** để phân loại rủi ro nhân viên thành 3 nhãn:
- `low`    — Không có dấu hiệu bất thường
- `medium` — Có dấu hiệu đáng lưu ý (cần theo dõi)
- `high`   — Rủi ro cao (burnout, giảm hiệu suất, nguy cơ rời bỏ)

Thiết kế tuân theo tài liệu `AI-Feature-System-Design.md`.

---

## Kiến trúc Feature

| Feature | Mô tả | Nguồn dữ liệu |
|---|---|---|
| `kpi_completion_rate` | Tỉ lệ hoàn thành KPI trung bình của nhân viên | `KPI_Assignments.progress_percentage` |
| `checkin_delay_days` | Khoảng cách trung bình giữa các lần check-in (ngày) | `Check_Ins.created_at` |
| `feedback_sentiment_score` | Điểm cảm xúc trung bình từ feedback (-1 đến 1) | `Feedbacks.sentiment` |
| `objective_participation_ratio` | Số Objectives cá nhân / trung bình phòng ban | `Objectives` + `Units` |

---

## Pipeline Huấn luyện

```
Raw Excel
    │
    ▼
Feature Engineering (4 đặc trưng)
    │
    ▼
Rule-based Labeling (low / medium / high)
    │
    ▼
SMOTE (cân bằng class) → StandardScaler → KNN
    │
    ▼
GridSearchCV (tối ưu k, metric, weights)
    │
    ▼
Model artifact (.pkl) + Evaluation report
```

---

## Kết quả trên Test Set

| Metric | low | medium | high |
|---|---|---|---|
| Precision | 0.9697 | 0.6250 | 1.0000 |
| Recall | 0.9143 | 0.8333 | 1.0000 |
| F1-score | 0.9412 | 0.7143 | 1.0000 |

- **Accuracy**: 90.48%
- **Macro F1**: 88.52%
- **Best Params**: `k=7`, `metric=manhattan`, `weights=distance`

---

## Sử dụng

> Cập nhật cấu trúc mới:
> - Python script: `src/python/behavior-ai/predict_risk.py`
> - Model artifacts: `artifacts/behavior-ai` (hoặc override bằng `BEHAVIOR_AI_MODEL_DIR`)

### 1. Huấn luyện lại model
```bash
python train_knn_risk_model.py \
  --input /path/to/kpi_okr_data_fixed.xlsx \
  --output ./artifacts/behavior-ai \
  --test-size 0.25
```

### 2. Dự đoán rủi ro cho 1 nhân viên
```bash
python src/python/behavior-ai/predict_risk.py \
  --model-dir ./artifacts/behavior-ai \
  --features '[{"kpi_completion_rate":0.45,"checkin_delay_days":25.0,"feedback_sentiment_score":-0.5,"objective_participation_ratio":0.2}]'
```

Output:
```
risk_label  risk_score_numeric
    medium                0.5
```

### 3. Dùng trong code Python
```python
from predict_risk import load_model, predict_risk

model, cols = load_model('./artifacts/behavior-ai')
employees = [
    {'kpi_completion_rate': 0.82, 'checkin_delay_days': 15,
     'feedback_sentiment_score': 0.2, 'objective_participation_ratio': 1.0},
    {'kpi_completion_rate': 0.30, 'checkin_delay_days': 35,
     'feedback_sentiment_score': -0.8, 'objective_participation_ratio': 0.0},
]
results = predict_risk(model, cols, employees)
print(results[['risk_label', 'risk_score_numeric']])
```

---

## File outputs

| File | Mô tả |
|---|---|
| `knn_risk_model.pkl` | Pipeline đầy đủ (scaler + KNN) |
| `feature_columns.pkl` | Danh sách feature đúng thứ tự |
| `evaluation_report.txt` | Classification report + confusion matrix |

---

## Lưu ý
- Chỉ sử dụng nhân viên có `role='EMPLOYEE'` để train và predict.
- Nhãn `high` ít mẫu nên SMOTE được dùng với `k_neighbors=1` để tránh lỗi trong CV fold.
- Khi có thêm dữ liệu thực tế (nhân viên nghỉ việc, cảnh cáo kỷ luật), nên thay rule-based labeling bằng nhãn thực để cải thiện model.
