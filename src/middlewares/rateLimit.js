import client from '../utils/redis.js';
import AppError from '../utils/appError.js';

const getLoginAttemptKey = (ip) => `login_attempts:${ip}`;

const loginRateLimit = async (req, res, next) => {
    try {
        const key = getLoginAttemptKey(req.ip);
        const attempts = await client.get(key);

        if (attempts && parseInt(attempts) >= 5) {
            // Check if still in cooldown
            const ttl = await client.ttl(key);
            if (ttl > 0) {
                res.set('Retry-After', ttl);
                throw new AppError(`Too many attempts. Try again after ${Math.ceil(ttl / 60)} minutes.`, 429);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

export const incrementLoginAttempts = async (ip) => {
    const key = getLoginAttemptKey(ip);
    await client.incr(key);
    await client.expire(key, 10 * 60);
};

export const clearLoginAttempts = async (ip) => {
    const key = getLoginAttemptKey(ip);
    await client.del(key);
};

export { loginRateLimit };