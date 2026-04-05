import client from '../utils/redis.js';
import AppError from '../utils/appError.js';

const loginRateLimit = async (req, res, next) => {
    try {
        const key = `login_attempts:${req.ip}`;
        const attempts = await client.get(key);

        if (attempts && parseInt(attempts) >= 5) {
            // Check if still in cooldown
            const ttl = await client.ttl(key);
            if (ttl > 0) {
                res.set('Retry-After', ttl);
                throw new AppError(`Too many attempts. Try again after ${Math.ceil(ttl / 60)} minutes.`, 429);
            }
        }

        // Increment attempts
        await client.incr(key);
        // Set expiry to 10 minutes if not set
        await client.expire(key, 10 * 60);

        next();
    } catch (error) {
        next(error);
    }
};

export { loginRateLimit };