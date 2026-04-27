import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { runPythonScript } from '../utils/python.js';
import {
  behaviorAiModelDir,
  behaviorAiPythonScriptPath
} from '../config/behaviorAiModelPaths.js';

function calculateMean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateStdDev(arr, mean) {
  if (!arr || arr.length < 2) return 0;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

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

export const runDailyETL = async (companyId = null) => {
  console.log('[BehaviorAnalysis Job] Starting daily ETL process...');
  const stats = {
    processed_users: 0,
    alerts_triggered: 0
  };

  try {
    const companyFilter = { is_active: true };
    if (companyId !== null && companyId !== undefined) {
      companyFilter.id = companyId;
    }

    const activeCompanies = await prisma.companies.findMany({
      where: companyFilter
    });

    for (const company of activeCompanies) {
      const activeUsers = await prisma.users.findMany({
        where: { company_id: company.id, is_active: true }
      });

      stats.processed_users += activeUsers.length;

      // Get current cycle for the company
      const currentDate = new Date();
      const currentCycle = await prisma.cycles.findFirst({
        where: {
          company_id: company.id,
          start_date: { lte: currentDate },
          end_date: { gte: currentDate },
          is_locked: false
        }
      });

      for (const user of activeUsers) {
        let kpi_completion_rate = 0;
        let checkin_frequency = 0;
        let feedback_sentiment_score = 0;
        let objective_participation_ratio = 0;

        // 1. KPI Completion Rate
        if (currentCycle) {
          const kpiAssignments = await prisma.kPIAssignments.findMany({
            where: {
              company_id: company.id,
              owner_id: user.id,
              cycle_id: currentCycle.id,
              deleted_at: null
            }
          });
          if (kpiAssignments.length > 0) {
            const totalProgress = kpiAssignments.reduce((acc, kpi) => acc + kpi.progress_percentage, 0);
            kpi_completion_rate = totalProgress / kpiAssignments.length;
          }
        }

        // 2. Check-in Frequency (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const checkins = await prisma.checkIns.findMany({
          where: {
            company_id: company.id,
            user_id: user.id,
            created_at: { gte: thirtyDaysAgo }
          },
          orderBy: { created_at: 'asc' }
        });

        checkin_frequency = checkins.length;
        const checkin_delay_days = calculateCheckinDelayDays(checkins, thirtyDaysAgo, new Date());

        // 3. Feedback Sentiment Score
        const feedbacks = await prisma.feedbacks.findMany({
          where: {
            company_id: company.id,
            user_id: user.id,
            created_at: { gte: thirtyDaysAgo } // Only recent feedbacks
          }
        });

        if (feedbacks.length > 0) {
          const totalScore = feedbacks.reduce((acc, fb) => acc + mapSentimentToScore(fb.sentiment), 0);
          feedback_sentiment_score = totalScore / feedbacks.length;
        }

        // 4. Objective Participation Ratio
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        objective_participation_ratio = await calculateObjectiveParticipationRatio(
          company.id,
          user.unit_id,
          user.id,
          ninetyDaysAgo,
          new Date()
        );

        // Upsert Current Feature into EmployeeFeatures
        const period = new Date();
        period.setHours(0, 0, 0, 0); // Normalize to date only

        let currentFeature;
        const existingFeature = await prisma.employeeFeatures.findUnique({
          where: {
            user_id_period: {
              user_id: user.id,
              period: period
            }
          }
        });

        if (existingFeature) {
          currentFeature = await prisma.employeeFeatures.update({
            where: { id: existingFeature.id },
            data: {
              kpi_completion_rate,
              checkin_frequency,
              feedback_sentiment_score,
              objective_participation_ratio
            }
          });
        } else {
          currentFeature = await prisma.employeeFeatures.create({
            data: {
              company_id: company.id,
              user_id: user.id,
              period: period,
              kpi_completion_rate,
              checkin_frequency,
              feedback_sentiment_score,
              objective_participation_ratio
            }
          });
        }

        // Calculate Baseline (last 90 days excluding current day to avoid polluting baseline with just-inserted values if it's identical day, though we use history)
        const historicalFeatures = await prisma.employeeFeatures.findMany({
          where: {
            company_id: company.id,
            user_id: user.id,
            period: {
              gte: ninetyDaysAgo,
              lt: period
            }
          }
        });

        if (historicalFeatures.length >= 2) {
          // Extract arrays
          const kpiRates = historicalFeatures.map(f => f.kpi_completion_rate);
          const checkinFreqs = historicalFeatures.map(f => f.checkin_frequency);
          const sentimentScores = historicalFeatures.map(f => f.feedback_sentiment_score);

          // KPI
          const mean_kpi = calculateMean(kpiRates);
          const std_kpi = calculateStdDev(kpiRates, mean_kpi);

          // Checkin
          const mean_checkin = calculateMean(checkinFreqs);
          const std_checkin = calculateStdDev(checkinFreqs, mean_checkin);

          // Sentiment
          const mean_sentiment = calculateMean(sentimentScores);
          const std_sentiment = calculateStdDev(sentimentScores, mean_sentiment);

          const triggeredFeatures = {};
          let isAlert = false;

          if (kpi_completion_rate < mean_kpi - 2 * std_kpi) {
            isAlert = true;
            triggeredFeatures.kpi_completion_rate = { current: kpi_completion_rate, mean: mean_kpi, std: std_kpi };
          }
          if (checkin_frequency < mean_checkin - 2 * std_checkin) {
            isAlert = true;
            triggeredFeatures.checkin_frequency = { current: checkin_frequency, mean: mean_checkin, std: std_checkin };
          }
          if (feedback_sentiment_score < mean_sentiment - 2 * std_sentiment) {
            isAlert = true;
            triggeredFeatures.feedback_sentiment_score = { current: feedback_sentiment_score, mean: mean_sentiment, std: std_sentiment };
          }

          if (isAlert) {
            // Get KNN risk prediction
            let knnRiskLabel = 'low';
            let knnRiskScore = 0.1;

            try {
              const features = {
                kpi_completion_rate: kpi_completion_rate,
                checkin_delay_days: checkin_delay_days,
                feedback_sentiment_score: feedback_sentiment_score,
                objective_participation_ratio: objective_participation_ratio
              };

              const prediction = await predictRisk([features]);
              if (prediction && prediction.length > 0) {
                knnRiskLabel = prediction[0].risk_label;
                knnRiskScore = prediction[0].risk_score_numeric;
              }
            } catch (error) {
              console.warn('[BehaviorAnalysis] KNN prediction failed, using default:', error.message);
            }

            // Calculate overall risk score
            const statisticalScore = isAlert ? 1.0 : 0.0;
            const riskScore = 0.4 * statisticalScore + 0.6 * knnRiskScore;

            // Trigger risk_score insertion only if risk_score >= 0.5
            if (riskScore >= 0.5) {
              await prisma.riskScores.create({
                data: {
                  company_id: company.id,
                  user_id: user.id,
                  score_date: period,
                  statistical_alert: isAlert,
                  knn_risk_label: knnRiskLabel.toUpperCase(),
                  risk_score: riskScore,
                  triggered_features: triggeredFeatures
                }
              });
              stats.alerts_triggered += 1;
              console.log(`[BehaviorAnalysis] Risk alert triggered for user ${user.id} in company ${company.id} with score ${riskScore}`);
            }
          }
        }
      }
    }

    console.log('[BehaviorAnalysis Job] Daily ETL process completed successfully.');
    return stats;
  } catch (error) {
    console.error('[BehaviorAnalysis Job] Error during ETL process:', error);
    return stats;
  }
};

// Run every night at 2:00 AM
cron.schedule('0 2 * * *', () => {
  runDailyETL();
});
