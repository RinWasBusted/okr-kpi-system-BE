import cron from 'node-cron';
import prisma from '../utils/prisma.js';

/**
 * Reset token_usage for all companies to 0 at the beginning of each month
 * Runs at 00:00 on the 1st day of every month (Asia/Ho_Chi_Minh timezone)
 */
const resetTokenUsageJob = () => {
  // Schedule: 0 0 1 * * = At 00:00 on day-of-month 1
  cron.schedule(
    '0 0 1 * *',
    async () => {
      try {
        console.log('[Token Usage Job] Starting monthly token usage reset...');
        
        const result = await prisma.companies.updateMany({
          data: {
            token_usage: 0,
          },
        });

        console.log(`[Token Usage Job] Successfully reset token_usage for ${result.count} companies`);
      } catch (error) {
        console.error('[Token Usage Job] Error resetting token usage:', error);
      }
    },
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );

  console.log('[Token Usage Job] Token usage reset job scheduled (runs monthly on the 1st at 00:00 Asia/Ho_Chi_Minh)');
};

export default resetTokenUsageJob;
