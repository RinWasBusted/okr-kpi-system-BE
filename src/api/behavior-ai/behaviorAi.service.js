import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";
import { runPythonScript } from "../../utils/python.js";
import {
  behaviorAiModelDir,
  behaviorAiPythonScriptPath
} from "../../config/behaviorAiModelPaths.js";

async function predictRisk(features) {
  const output = await runPythonScript(behaviorAiPythonScriptPath, [
    '--model-dir',
    behaviorAiModelDir,
    '--features',
    JSON.stringify(features)
  ]);

  try {
    return JSON.parse(output.trim());
  } catch (parseError) {
    console.error('[KNN Prediction] Parse error:', parseError, 'Output:', output);
    throw parseError;
  }
}

function calculateCheckinDelayDays(checkins, windowStart, windowEnd) {
  const sortedCheckins = [...checkins].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const msPerDay = 24 * 60 * 60 * 1000;

  if (sortedCheckins.length === 0) {
    return 30;
  }

  const intervals = [];
  for (let index = 1; index < sortedCheckins.length; index += 1) {
    const prevDate = new Date(sortedCheckins[index - 1].created_at);
    const currentDate = new Date(sortedCheckins[index].created_at);
    const diffDays = (currentDate - prevDate) / msPerDay;
    intervals.push(Math.max(0, diffDays - 7));
  }

  if (intervals.length === 0) {
    const firstDate = new Date(sortedCheckins[0].created_at);
    const diffDays = (windowEnd - firstDate) / msPerDay;
    return Math.max(0, diffDays - 7);
  }

  const totalDelay = intervals.reduce((sum, delay) => sum + delay, 0);
  return totalDelay / intervals.length;
}

async function calculateObjectiveParticipationRatio(companyId, unitId, userId, startDate, endDate) {
  const userObjectives = await prisma.objectives.count({
    where: {
      company_id: companyId,
      owner_id: userId,
      deleted_at: null,
      created_at: { gte: startDate, lte: endDate }
    }
  });

  const peerCountWhere = {
    company_id: companyId,
    is_active: true
  };
  if (unitId !== null && unitId !== undefined) {
    peerCountWhere.unit_id = unitId;
  }

  const peerCount = await prisma.users.count({ where: peerCountWhere });

  const peerObjectiveWhere = {
    company_id: companyId,
    deleted_at: null,
    created_at: { gte: startDate, lte: endDate },
    owner: {
      is_active: true
    }
  };
  if (unitId !== null && unitId !== undefined) {
    peerObjectiveWhere.owner.unit_id = unitId;
  }

  const peerObjectiveCount = await prisma.objectives.count({ where: peerObjectiveWhere });

  const averageObjectives = peerCount > 0 ? peerObjectiveCount / peerCount : 0;
  if (averageObjectives > 0) {
    return userObjectives / averageObjectives;
  }

  return userObjectives > 0 ? 1.0 : 0.0;
}

async function calculateEmployeeFeatures(userId, companyId, days = 90, unitId = null) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const kpiAssignments = await prisma.kPIAssignments.findMany({
    where: {
      company_id: companyId,
      owner_id: userId,
      deleted_at: null,
      created_at: { gte: startDate, lte: endDate }
    }
  });

  let kpi_completion_rate = 0;
  if (kpiAssignments.length > 0) {
    const totalProgress = kpiAssignments.reduce((acc, kpi) => acc + kpi.progress_percentage, 0);
    kpi_completion_rate = totalProgress / kpiAssignments.length;
  }

  const checkins = await prisma.checkIns.findMany({
    where: {
      company_id: companyId,
      user_id: userId,
      created_at: { gte: startDate, lte: endDate }
    },
    orderBy: { created_at: 'asc' }
  });

  const checkin_frequency = checkins.length;
  const checkin_delay_days = calculateCheckinDelayDays(checkins, startDate, endDate);

  const feedbacks = await prisma.feedbacks.findMany({
    where: {
      company_id: companyId,
      user_id: userId,
      created_at: { gte: startDate, lte: endDate }
    }
  });

  let feedback_sentiment_score = 0;
  if (feedbacks.length > 0) {
    const mapSentimentToScore = (sentiment) => {
      switch (sentiment) {
        case 'POSITIVE': return 1;
        case 'NEGATIVE': return -1;
        case 'NEUTRAL':
        case 'MIXED':
        case 'UNKNOWN':
        default:
          return 0;
      }
    };

    const totalScore = feedbacks.reduce((acc, fb) => acc + mapSentimentToScore(fb.sentiment), 0);
    feedback_sentiment_score = totalScore / feedbacks.length;
  }

  const objective_participation_ratio = await calculateObjectiveParticipationRatio(
    companyId,
    unitId,
    userId,
    startDate,
    endDate
  );

  return {
    kpi_completion_rate,
    checkin_delay_days,
    checkin_frequency,
    feedback_sentiment_score,
    objective_participation_ratio,
    // Aliases aligned with trained model columns in feature_columns.pkl
    average_sentiment_score: feedback_sentiment_score,
    avg_delay_days: checkin_delay_days
  };
}

export async function getRiskScores({ user, filters }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Only ADMIN_COMPANY can access risk scores
  if (user.role !== UserRole.ADMIN_COMPANY) {
    throw new AppError("Access denied. Admin company role required.", 403);
  }

  const where = {
    company_id: user.company_id,
  };

  if (filters.user_id) {
    where.user_id = filters.user_id;
  }

  if (filters.start_date || filters.end_date) {
    where.score_date = {};
    if (filters.start_date) {
      where.score_date.gte = new Date(filters.start_date);
    }
    if (filters.end_date) {
      where.score_date.lte = new Date(filters.end_date);
    }
  }

  if (filters.min_score !== undefined) {
    where.risk_score = { gte: filters.min_score };
  }

  const riskScores = await prisma.riskScores.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          job_title: true,
          full_name: true
        }
      }
    },
    orderBy: { score_date: 'desc' }
  });

  return riskScores.map(score => ({
    id: score.id,
    user_id: score.user_id,
    user: score.user,
    score_date: score.score_date,
    risk_score: score.risk_score,
    knn_risk_label: score.knn_risk_label,
    statistical_alert: score.statistical_alert,
    triggered_features: score.triggered_features,
    // Keep a normalized field for FE consumption
    risk_label: (score.knn_risk_label || "").toLowerCase()
  }));
}

export async function getEmployeeFeatures({ user, userId, days }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Only ADMIN_COMPANY can access employee features
  if (user.role !== UserRole.ADMIN_COMPANY) {
    throw new AppError("Access denied. Admin company role required.", 403);
  }

  // Verify user exists and belongs to same company
  const targetUser = await prisma.users.findFirst({
    where: {
      id: userId,
      company_id: user.company_id,
      is_active: true
    }
  });

  if (!targetUser) {
    throw new AppError("Employee not found", 404);
  }

  const features = await prisma.employeeFeatures.findMany({
    where: {
      company_id: user.company_id,
      user_id: userId,
      period: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { period: 'desc' }
  });

  // Compute latest model-ready features (includes checkin_delay_days which is not stored in EmployeeFeatures table)
  const currentFeatures = await calculateEmployeeFeatures(
    userId,
    user.company_id,
    days,
    targetUser.unit_id
  );

  return {
    user_id: userId,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      job_title: targetUser.job_title,
      full_name: targetUser.full_name
    },
    current_features: currentFeatures,
    current_model_features: {
      kpi_completion_rate: currentFeatures.kpi_completion_rate,
      average_sentiment_score: currentFeatures.average_sentiment_score,
      avg_delay_days: currentFeatures.avg_delay_days,
      objective_participation_ratio: currentFeatures.objective_participation_ratio
    },
    features: features.map(f => ({
      period: f.period,
      kpi_completion_rate: f.kpi_completion_rate,
      // Historical table does not persist delay-days; keep explicit null for client clarity.
      checkin_delay_days: null,
      checkin_frequency: f.checkin_frequency,
      feedback_sentiment_score: f.feedback_sentiment_score,
      objective_participation_ratio: f.objective_participation_ratio,
      average_sentiment_score: f.feedback_sentiment_score,
      avg_delay_days: null
    }))
  };
}

export async function predictEmployeeRisk({ user, targetUserId }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Only ADMIN_COMPANY can predict employee risk
  if (user.role !== UserRole.ADMIN_COMPANY) {
    throw new AppError("Access denied. Admin company role required.", 403);
  }

  // Verify target user exists and belongs to same company
  const targetUser = await prisma.users.findFirst({
    where: {
      id: targetUserId,
      company_id: user.company_id,
      is_active: true
    }
  });

  if (!targetUser) {
    throw new AppError("Employee not found", 404);
  }

  try {
    // Calculate current features
    const features = await calculateEmployeeFeatures(targetUserId, user.company_id, 90, targetUser.unit_id);

    // Predict risk using KNN model
    const predictions = await predictRisk([features]);

    if (!predictions || predictions.length === 0) {
      throw new AppError("Failed to get prediction from AI model", 502);
    }

    const prediction = predictions[0];

    return {
      user_id: targetUserId,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        job_title: targetUser.job_title,
        full_name: targetUser.full_name
      },
      risk_label: prediction.risk_label,
      risk_score: prediction.risk_score_numeric,
      features_used: features,
      model_features_used: {
        kpi_completion_rate: features.kpi_completion_rate,
        average_sentiment_score: features.average_sentiment_score,
        avg_delay_days: features.avg_delay_days,
        objective_participation_ratio: features.objective_participation_ratio
      }
    };

  } catch (error) {
    const message = error?.message || "";
    if (
      message.includes("Python process exited") ||
      message.includes("Unable to run Python") ||
      message.includes("Python script failed")
    ) {
      throw new AppError("AI model prediction service is currently unavailable. Please verify Python and required ML packages are installed.", 502);
    }
    throw error;
  }
}

// Generate alert using RAG and LLM
async function generateAlertWithLLM(riskScoreData) {
  // For now, return a mock alert. In production, this would call an LLM with RAG
  const severity = riskScoreData.risk_score >= 0.8 ? 'high' : riskScoreData.risk_score >= 0.5 ? 'medium' : 'low';

  const mockAlerts = {
    high: {
      summary: "Nhân viên có dấu hiệu quá tải công việc nghiêm trọng",
      action_items: [
        {
          action: "Tổ chức buổi 1-1 khẩn cấp trong vòng 24 giờ",
          owner: "direct_manager",
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          action: "Đề xuất nghỉ phép hoặc giảm workload",
          owner: "hr_manager",
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ],
      llm_narrative: "Dựa trên phân tích dữ liệu hành vi, nhân viên này cho thấy dấu hiệu căng thẳng công việc nghiêm trọng với hiệu suất KPI giảm sút và cảm xúc tiêu cực trong feedback. Cần can thiệp ngay để tránh burnout."
    },
    medium: {
      summary: "Nhân viên có dấu hiệu cần theo dõi thêm",
      action_items: [
        {
          action: "Tăng cường check-in hàng tuần",
          owner: "direct_manager",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ],
      llm_narrative: "Nhân viên có một số dấu hiệu cần lưu ý trong hiệu suất làm việc. Khuyến nghị theo dõi chặt chẽ và hỗ trợ nếu cần thiết."
    },
    low: {
      summary: "Nhân viên hoạt động bình thường",
      action_items: [],
      llm_narrative: "Không có dấu hiệu bất thường trong dữ liệu hành vi của nhân viên."
    }
  };

  return {
    alert_id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    severity,
    ...mockAlerts[severity],
    triggered_features: Object.keys(riskScoreData.triggered_features || {})
  };
}

export async function generateAlert({ user, riskScoreId }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Only ADMIN_COMPANY can generate alerts
  if (user.role !== UserRole.ADMIN_COMPANY) {
    throw new AppError("Access denied. Admin company role required.", 403);
  }

  // Get risk score
  const riskScore = await prisma.riskScores.findFirst({
    where: {
      id: riskScoreId,
      company_id: user.company_id
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          job_title: true,
          full_name: true
        }
      }
    }
  });

  if (!riskScore) {
    throw new AppError("Risk score not found", 404);
  }

  try {
    // Generate alert using LLM (mock for now)
    const alert = await generateAlertWithLLM({
      risk_score: riskScore.risk_score,
      triggered_features: riskScore.triggered_features,
      knn_risk_label: riskScore.knn_risk_label,
      statistical_alert: riskScore.statistical_alert
    });

    const storedAlert = await prisma.aIAlerts.create({
      data: {
        company_id: user.company_id,
        user_id: riskScore.user_id,
        risk_score: riskScore.risk_score,
        severity: alert.severity === 'high' ? 'CRITICAL' : alert.severity === 'medium' ? 'WARNING' : 'INFO',
        summary: alert.summary,
        triggered_features: alert.triggered_features,
        action_items: alert.action_items,
        retrieved_docs: [],
        llm_narrative: alert.llm_narrative
      }
    });

    return {
      alert_id: storedAlert.id,
      risk_score_id: riskScoreId,
      user_id: riskScore.user_id,
      user: riskScore.user,
      generated_at: storedAlert.generated_at.toISOString(),
      risk_score: riskScore.risk_score,
      severity: alert.severity,
      summary: alert.summary,
      triggered_features: alert.triggered_features,
      action_items: alert.action_items,
      llm_narrative: alert.llm_narrative
    };

  } catch (error) {
    throw new AppError("Failed to generate alert", 502);
  }
}

export async function runETL({ user }) {
  if (!user) throw new AppError("Unauthorized", 401);

  // Only ADMIN_COMPANY can run ETL
  if (user.role !== UserRole.ADMIN_COMPANY) {
    throw new AppError("Access denied. Admin company role required.", 403);
  }

  // Import and run the ETL function
  const { runDailyETL } = await import("../../jobs/behaviorAnalysis.job.js");

  try {
    const result = await runDailyETL(user.company_id);
    return result;

  } catch (error) {
    throw new AppError("ETL process failed", 500);
  }
}