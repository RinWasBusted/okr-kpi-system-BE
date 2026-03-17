
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    if(err instanceof z.ZodError) {
        err.statusCode = 400;
        err.message = err.errors.map(e => e.message).join(", ");
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
}

export default errorHandler;