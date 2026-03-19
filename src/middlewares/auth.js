import { verifyToken } from '../utils/jwt';
import requestContext from '../utils/context';

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

    requestContext.run({ company_id: decoded.company_id, role: decoded.role }, () => {
        next();
    });
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
};