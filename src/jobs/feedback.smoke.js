import prisma from '../utils/prisma.js';

/**
 * Smoke test for feedback system
 * Runs basic checks to ensure feedback CRUD operations work
 * Can be triggered manually or as part of deployment verification
 */
export const runFeedbackSmokeTest = async () => {
  console.log('[Feedback Smoke Test] Starting feedback system smoke test...');

  try {
    // Test 1: Create a test feedback
    const testCompany = await prisma.companies.findFirst({
      where: { is_active: true }
    });

    if (!testCompany) {
      console.log('[Feedback Smoke Test] No active company found, skipping test');
      return;
    }

    const testUser = await prisma.users.findFirst({
      where: { company_id: testCompany.id, is_active: true }
    });

    if (!testUser) {
      console.log('[Feedback Smoke Test] No active user found, skipping test');
      return;
    }

    const testObjective = await prisma.objectives.findFirst({
      where: { company_id: testCompany.id }
    });

    if (!testObjective) {
      console.log('[Feedback Smoke Test] No objective found, skipping test');
      return;
    }

    // Create test feedback
    const testFeedback = await prisma.feedbacks.create({
      data: {
        company_id: testCompany.id,
        objective_id: testObjective.id,
        user_id: testUser.id,
        content: 'Test feedback for smoke test',
        sentiment: 'POSITIVE',
        status: 'PRAISE'
      }
    });

    console.log(`[Feedback Smoke Test] Created test feedback with ID: ${testFeedback.id}`);

    // Test 2: Read feedback
    const readFeedback = await prisma.feedbacks.findUnique({
      where: { id: testFeedback.id }
    });

    if (!readFeedback) {
      throw new Error('Failed to read created feedback');
    }

    console.log('[Feedback Smoke Test] Successfully read feedback');

    // Test 3: Update feedback
    await prisma.feedbacks.update({
      where: { id: testFeedback.id },
      data: { content: 'Updated test feedback' }
    });

    console.log('[Feedback Smoke Test] Successfully updated feedback');

    // Test 4: Create reply feedback
    const replyFeedback = await prisma.feedbacks.create({
      data: {
        company_id: testCompany.id,
        objective_id: testObjective.id,
        user_id: testUser.id,
        parent_id: testFeedback.id,
        content: 'Test reply for smoke test',
        sentiment: 'NEUTRAL',
        status: 'QUESTION'
      }
    });

    console.log(`[Feedback Smoke Test] Created reply feedback with ID: ${replyFeedback.id}`);

    // Test 5: List feedbacks with replies
    const feedbacks = await prisma.feedbacks.findMany({
      where: {
        company_id: testCompany.id,
        objective_id: testObjective.id,
        parent_id: null // Root feedbacks only
      },
      include: {
        replies: true
      }
    });

    console.log(`[Feedback Smoke Test] Found ${feedbacks.length} root feedbacks`);

    // Test 6: Delete feedbacks (cleanup)
    await prisma.feedbacks.deleteMany({
      where: {
        id: { in: [testFeedback.id, replyFeedback.id] }
      }
    });

    console.log('[Feedback Smoke Test] Successfully cleaned up test feedbacks');

    console.log('[Feedback Smoke Test] All feedback smoke tests passed!');

  } catch (error) {
    console.error('[Feedback Smoke Test] Error during smoke test:', error);
    throw error;
  }
};

// Export for manual testing
export default runFeedbackSmokeTest;