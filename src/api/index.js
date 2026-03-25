import express from "express";
import authRoutes from "./auth/auth.route.js";
import companyRoutes from "./admin/company.route.js";
import okrAiRoutes from "./okr-ai/okrAi.route.js";
const router = express.Router();

router.use("/admin/companies", companyRoutes);
router.use("/auth", authRoutes);
router.use("/", okrAiRoutes);

export default router;