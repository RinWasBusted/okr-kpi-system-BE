import { z } from "zod";

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let code = err.code || "INTERNAL_ERROR";
    let message = err.message || "Internal Server Error";
    let details = undefined;

    if (err instanceof z.ZodError) {
        statusCode = 422;
        code = "VALIDATION_ERROR";
        const issues = Array.isArray(err.issues) ? err.issues : err.errors;

        if (Array.isArray(issues) && issues.length > 0) {
            message = issues[0].message;
            details = issues.reduce((acc, issue) => {
                const field = issue.path.join(".") || "input";
                if (!acc[field]) acc[field] = [];
                acc[field].push(issue.message);
                return acc;
            }, {});
        } else {
            message = "Invalid input";
        }
    }

    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            ...(details !== undefined && { details }),
        },
    });
};

export default errorHandler;