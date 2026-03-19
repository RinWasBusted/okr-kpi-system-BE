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