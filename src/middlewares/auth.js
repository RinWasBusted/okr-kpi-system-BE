import { verifyToken } from '../utils/jwt.js';
import requestContext from '../utils/context.js';

export const authenticate = (req, res, next) => {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
        return res.status(401).json({ error: 'Access token is missing' });
    }

    const decoded = verifyToken(accessToken);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid access token' });
    }

    req.user = decoded;

    requestContext.run({
        company_id: decoded.company_id,
        role: decoded.role,
        user_id: decoded.id,
        unit_path: decoded.unit_path,
    }, () => {
        next();
    });
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
        }

        next();
    };
};