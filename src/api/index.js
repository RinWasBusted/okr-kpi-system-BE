import express from "express";
import authRoutes from "./auth/auth.route.js";
import adminRoutes from "./admin/index.js";
const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);

export default router;
