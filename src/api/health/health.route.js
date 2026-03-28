import express from "express";
import prisma from "../../utils/prisma.js";
import client from "../../utils/redis.js";

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the application and its dependencies (database, Redis) are healthy. Used by Docker Swarm and load balancers.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-03-28T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Uptime in milliseconds
 *                   example: 3600000
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [ok, error]
 *                       example: "ok"
 *                     redis:
 *                       type: string
 *                       enum: [ok, error]
 *                       example: "ok"
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [ok, error]
 *                     redis:
 *                       type: string
 *                       enum: [ok, error]
 *                 message:
 *                   type: string
 */
router.get("/health", async (req, res) => {
  const startTime = process.uptime() * 1000;
  let status = "healthy";
  const services = {
    database: "error",
    redis: "error",
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = "ok";
  } catch (error) {
    console.error("[Health Check] Database error:", error.message);
    status = "degraded";
  }

  // Check Redis
  try {
    await client.ping();
    services.redis = "ok";
  } catch (error) {
    console.error("[Health Check] Redis error:", error.message);
    status = "degraded";
  }

  const response = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(startTime),
    services,
  };

  if (services.database === "error" || services.redis === "error") {
    return res.status(503).json({
      ...response,
      status: "unhealthy",
      message: "One or more services are unavailable",
    });
  }

  return res.status(200).json(response);
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Simple endpoint to check if the application is running. Returns 200 if service is alive.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "alive"
 */
router.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive" });
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Check if the application is ready to accept traffic. Verifies critical dependencies.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ready"
 *       503:
 *         description: Service is not ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "not_ready"
 */
router.get("/health/ready", async (req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      client.ping(),
    ]);

    return res.status(200).json({ status: "ready" });
  } catch (error) {
    console.error("[Health Check] Readiness probe failed:", error.message);
    return res.status(503).json({ status: "not_ready" });
  }
});

export default router;
