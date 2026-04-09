import client from '../utils/redis.js';
import AppError from '../utils/appError.js';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = 10 * 60; // 10 minutes in seconds

export const incrementLoginAttempts = async (ip) => {
    const key = `login_attempts:${ip}`;
    const attempts = await client.incr(key);
    if (attempts === 1) {
        // Set expiry only on the first increment to avoid resetting the window
        await client.expire(key, RATE_LIMIT_TTL);
    }
};

export const resetLoginAttempts = async (ip) => {
    await client.del(`login_attempts:${ip}`);
};

const loginRateLimit = async (req, res, next) => {
    try {
        const key = `login_attempts:${req.ip}`;
        const attempts = await client.get(key);

        if (attempts && parseInt(attempts) >= RATE_LIMIT_MAX) {
            const ttl = await client.ttl(key);
            if (ttl > 0) {
                res.set('Retry-After', ttl);
                throw new AppError(`Too many login attempts. Try again after ${Math.ceil(ttl / 60)} minutes.`, 429);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

export { loginRateLimit };
