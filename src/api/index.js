import express from "express";
import authRoutes from "./auth/auth.route.js";
import companyRoutes from "./admin/company/company.route.js";
const router = express.Router();

router.use("/admin/companies", companyRoutes);
router.use("/auth", authRoutes);

export default router;
