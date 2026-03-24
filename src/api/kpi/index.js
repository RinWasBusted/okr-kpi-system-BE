import express from "express";
import dictionariesRouter from "./dictionaries/dictionaries.route.js";
import assignmentsRouter from "./assignments/assignments.route.js";
import recordsRouter from "./records/records.route.js";

const router = express.Router();

router.use(dictionariesRouter);
router.use(assignmentsRouter);
router.use(recordsRouter);

export default router;
