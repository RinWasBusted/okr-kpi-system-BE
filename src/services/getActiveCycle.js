import prisma from "../utils/prisma.js";

/**
 * Get list of active cycle IDs (is_locked = false)
 * 
 * @returns {Promise<number[]>} Array of active cycle IDs
 */
export const getActiveCycles = async () => {
  if (!companyId) {
    return [];
  }

  try {
    const activeCycles = await prisma.cycles.findMany({
      where: {
        is_locked: false,
      },
      select: {
        id: true,
      },
      orderBy: {
        start_date: "desc",
      },
    });

    return activeCycles.map((cycle) => cycle.id);
  } catch (error) {
    console.error("Error fetching active cycles:", error);
    return [];
  }
};
