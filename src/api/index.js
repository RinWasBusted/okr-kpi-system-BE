import express from "express";
import authRoutes from "./auth/auth.route.js";
import adminRoutes from "./admin/index.js";
import unitRoutes from "./units/unit.route.js";
import userRoutes from "./users/user.route.js";
import cycleRoutes from "./cycle/cycle.route.js";
import okrRoutes from "./okr/index.js";
const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/units", unitRoutes);
router.use("/users", userRoutes);
router.use("/cycles", cycleRoutes);
router.use("/", okrRoutes);

export default router;
