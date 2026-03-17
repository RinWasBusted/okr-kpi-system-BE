import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

/**
 * @param {Object} payload - The payload to encode in the JWT.
 * @param {string|number} [expiresIn='1h'] - Optional expiration time (e.g., '1h', '30m', 3600).
 * @returns {string} The generated JWT token.
 */
export const generateToken = (payload, expiresIn = '1h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * @param {string} token - The JWT token to verify.
 * @returns {Object|null} The decoded payload if the token is valid, or null if invalid.
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};

