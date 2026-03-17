const responseHandler = (req, res, next) => {
    res.success = (message = "Success", statusCode = 200, data = null) => {
        res.status(statusCode).json({ success: true, message, data });
    };

    next();
};

export default responseHandler;