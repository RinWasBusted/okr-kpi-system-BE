const responseHandler = (req, res, next) => {
    res.success = (message = "Success", statusCode = 200, data = null, meta = undefined) => {
        const payload = { success: true, message, data };
        if (meta !== undefined) {
            payload.meta = meta;
        }
        res.status(statusCode).json(payload);
    };

    next();
};

export default responseHandler;
