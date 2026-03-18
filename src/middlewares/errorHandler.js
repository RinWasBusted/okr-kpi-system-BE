import { z } from "zod";

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let errStatus = err.status || "error";
    let message = err.message || "Internal Server Error";

    if(err instanceof z.ZodError) {
        statusCode = 400;
        const issues = Array.isArray(err.issues) ? err.issues : err.errors;
        if (Array.isArray(issues) && issues.length > 0) {
            message = issues[0].message;
        } else {
            const flattenedErrors = err.flatten();
            const fieldErrors = flattenedErrors.fieldErrors || {};
            const firstField = Object.values(fieldErrors).find(v => Array.isArray(v) && v.length > 0);
            message = Array.isArray(firstField) ? firstField[0] : "Invalid input";
        }
    }

    res.status(statusCode).json({
        success: false,
        message
    });
}

export default errorHandler;
