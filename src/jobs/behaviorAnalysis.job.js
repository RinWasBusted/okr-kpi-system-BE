import cron from 'node-cron';
import prisma from '../utils/prisma.js';

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

export const runDailyETL = async () => {
  console.log('[BehaviorAnalysis Job] Starting daily ETL process...');
  
  try {
    const activeCompanies = await prisma.companies.findMany({
      where: { is_active: true }
    });

    for (const company of activeCompanies) {
      const activeUsers = await prisma.users.findMany({
        where: { company_id: company.id, is_active: true }
      });

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
        
        checkin_frequency = await prisma.checkIns.count({
          where: {
            company_id: company.id,
            user_id: user.id,
            created_at: { gte: thirtyDaysAgo }
          }
        });

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
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

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
            // Trigger risk_score insertion
            await prisma.riskScores.create({
              data: {
                company_id: company.id,
                user_id: user.id,
                score_date: period,
                statistical_alert: true,
                knn_risk_label: 'MEDIUM', // Placeholder, can be updated by KNN pipeline later
                risk_score: 50.0, // Default base risk score, further calculation could refine this
                triggered_features: triggeredFeatures
              }
            });
            console.log(`[BehaviorAnalysis] Alert triggered for user ${user.id} in company ${company.id}`);
          }
        }
      }
    }

    console.log('[BehaviorAnalysis Job] Daily ETL process completed successfully.');
  } catch (error) {
    console.error('[BehaviorAnalysis Job] Error during ETL process:', error);
  }
};

// Run every night at 2:00 AM
cron.schedule('0 2 * * *', () => {
  runDailyETL();
});
