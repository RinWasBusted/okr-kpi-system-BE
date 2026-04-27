import cron from "node-cron";
import { UserRole } from "@prisma/client";
import prisma from "../utils/prisma.js";
import requestContext from "../utils/context.js";
import {
    generateEvaluationsForCycle,
    getYesterdayInTimezone,
} from "../api/evaluations/evaluations.service.js";

const generateEvaluationsJob = () => {
    cron.schedule(
        "0 1 * * *",
        async () => {
            try {
                const yesterday = getYesterdayInTimezone();

                const expiredCycles = await requestContext.run(
                    { company_id: "", role: UserRole.ADMIN, user_id: "", unit_path: "" },
                    async () =>
                        prisma.cycles.findMany({
                            where: {
                                end_date: yesterday,
                            },
                            select: {
                                id: true,
                                company_id: true,
                                name: true,
                            },
                        }),
                );

                for (const cycle of expiredCycles) {
                    await requestContext.run(
                        {
                            company_id: cycle.company_id,
                            role: UserRole.ADMIN_COMPANY,
                            user_id: "",
                            unit_path: "",
                        },
                        async () => {
                            const result = await generateEvaluationsForCycle(cycle.id, cycle.company_id);
                            console.log(
                                `[Evaluation Job] Cycle ${cycle.id} (${cycle.name}) generated: ${result.created} created, ${result.skipped} skipped`,
                            );
                        },
                    );
                }
            } catch (error) {
                console.error("[Evaluation Job] Error generating evaluations:", error);
            }
        },
        {
            timezone: "Asia/Ho_Chi_Minh",
        },
    );

    console.log("[Evaluation Job] Evaluation generation job scheduled (runs daily at 01:00 Asia/Ho_Chi_Minh)");
};

export default generateEvaluationsJob;
