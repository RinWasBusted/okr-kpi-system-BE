/**
 * Middleware factory to validate request data using Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to get data from: 'body', 'query', 'params'
 */
export const validate = (schema, source = "body") => {
    return async (req, res, next) => {
        try {
            const data = req[source];
            const validData = await schema.parseAsync(data);
            
            if(!req.validated) req.validated = {};
            req.validated[source] = validData; 

            next();
        } catch (error) {
            if (error.name === "ZodError" && Array.isArray(error.errors)) {
                const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
                return res.status(422).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message,
                    },
                });
            }
            // Fallback for non-ZodError or malformed ZodError
            next(error);
        }
    };
};

/**
 * Validate file upload size
 * @param {number} maxSizeInMB - Maximum file size in MB
 */
export const validateFileSize = (maxSizeInMB = 5) => {
    return (req, res, next) => {
        if (!req.file) return next();

        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        if (req.file.size > maxSizeInBytes) {
            return res.status(422).json({
                success: false,
                error: {
                    code: "FILE_TOO_LARGE",
                    message: `File size must not exceed ${maxSizeInMB}MB`,
                },
            });
        }
        next();
    };
};
