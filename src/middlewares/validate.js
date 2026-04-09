/**
 * Middleware factory to validate request data using Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to get data from: 'body', 'query', 'params'
 */
export const validate = (schema, source = "body") => {
    return async (req, res, next) => {
        try {
            // Use Object.getOwnPropertyDescriptor to safely read without triggering getter-only errors
            const data = source === "query"
                ? { ...req.query }  // Clone query object to avoid getter issues
                : source === "params"
                    ? { ...req.params }  // Clone params as well for consistency
                    : req.body;

            const validData = await schema.parseAsync(data);

            // Initialize validated container if not exists
            if (!req.validated) {
                Object.defineProperty(req, "validated", {
                    value: {},
                    writable: true,
                    configurable: true,
                });
            }

            // Store validated data - never try to overwrite req.query/req.params directly
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
