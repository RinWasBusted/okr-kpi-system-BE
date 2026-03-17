import { verifyToken } from '../utils/jwt';

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
    next();
};
