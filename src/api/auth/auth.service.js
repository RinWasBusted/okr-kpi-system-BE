import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import { generateToken } from '../../utils/jwt.js';
import { hashPassword, comparePassword } from '../../utils/bcrypt.js';
import AppError from '../../utils/appError.js';
import client from '../../utils/redis.js';
import requestContext from '../../utils/context.js';
import { getCloudinaryImageUrl } from '../../utils/cloudinary.js';

// ─── Session helpers ─────────────────────────────────────────────────────────

const SESSION_TTL_7D  = 7  * 24 * 60 * 60;
const SESSION_TTL_30D = 30 * 24 * 60 * 60;

/**
 * Store a new session in Redis.
 * Keys:
 *   refreshToken:{token}  → { userId, sessionId, ttl_seconds }
 *   session:{sessionId}   → { userId, device_info, created_at, ttl_seconds, token }
 *   userSessions:{userId} → Set<sessionId>
 */
const storeSession = async (userId, refreshToken, sessionId, deviceInfo, ttlSeconds) => {
    const tokenMeta = JSON.stringify({ userId, sessionId, ttl_seconds: ttlSeconds });
    const sessionMeta = JSON.stringify({
        userId,
        device_info: deviceInfo || { name: 'Unknown', fingerprint: 'unknown' },
        created_at: new Date().toISOString(),
        ttl_seconds: ttlSeconds,
        token: refreshToken,
    });

    await Promise.all([
        client.setEx(`refreshToken:${refreshToken}`, ttlSeconds, tokenMeta),
        client.setEx(`session:${sessionId}`, ttlSeconds, sessionMeta),
        client.sAdd(`userSessions:${userId}`, sessionId),
    ]);
};

/**
 * Remove a single session from all Redis keys.
 */
const removeSession = async (userId, sessionId, refreshToken) => {
    await Promise.all([
        client.del(`refreshToken:${refreshToken}`),
        client.del(`session:${sessionId}`),
        client.sRem(`userSessions:${userId}`, sessionId),
    ]);
};

/**
 * Remove all sessions for a user from Redis.
 */
const removeAllUserSessions = async (userId) => {
    const sessionIds = await client.sMembers(`userSessions:${userId}`);
    if (sessionIds.length === 0) return 0;

    const sessionDataList = await Promise.all(
        sessionIds.map(sid => client.get(`session:${sid}`))
    );

    const keysToDelete = [`userSessions:${userId}`];
    for (let i = 0; i < sessionIds.length; i++) {
        keysToDelete.push(`session:${sessionIds[i]}`);
        if (sessionDataList[i]) {
            const { token } = JSON.parse(sessionDataList[i]);
            keysToDelete.push(`refreshToken:${token}`);
        }
    }

    await client.del(keysToDelete);
    return sessionIds.length;
};

// ─── Auth services ────────────────────────────────────────────────────────────

export const loginService = async (email, password, company_slug = '', device_info = null, remember_me = false) => {
    let company_id = null;
    let company = null;
    if (company_slug !== '') {
        company = await requestContext.run({ company_id: '', role: 'ADMIN' },
            async () => await prisma.companies.findUnique({ where: { slug: company_slug } })
        );
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        company_id = company.id;
    }

    return await requestContext.run({ company_id: company_id, role: '' }, async () => {
        try {
            const user = await prisma.users.findFirst({
                where: {
                    email,
                    // Scope to company when one is identified; ADMIN accounts have null company_id
                    ...(company_id !== null && { company_id }),
                },
                include: {
                    company: true,
                    unit: true,
                }
            });

            if (!user || !(await comparePassword(password, user.password))) {
                throw new AppError("Invalid email or password", 401);
            }

            if (!user.is_active) {
                throw new AppError("Your account has been deactivated. Contact your administrator.", 403);
            }

            // Fetch unit_path if user has a unit
            let unit_path = null;
            if (user.unit_id) {
                const unitData = await prisma.$queryRaw`
                    SELECT path::text as unit_path
                    FROM "Units"
                    WHERE id = ${user.unit_id}
                `;
                unit_path = unitData[0]?.unit_path || null;
            }

            const tokenPayload = {
                id: user.id,
                role: user.role,
                company_id: user.company_id,
                unit_id: user.unit_id,
                unit_path: unit_path,
            };

            const ttlSeconds = remember_me ? SESSION_TTL_30D : SESSION_TTL_7D;
            const refreshTokenExpiry = remember_me ? '30d' : '7d';
            const accessToken = generateToken(tokenPayload, '15m');
            const refreshToken = generateToken(tokenPayload, refreshTokenExpiry);

            const sessionId = crypto.randomUUID();
            await storeSession(user.id, refreshToken, sessionId, device_info, ttlSeconds);

            // Transform avatar_url to Cloudinary URL with 50x50 pixels
            const avatarUrl = user.avatar_url
                ? getCloudinaryImageUrl(user.avatar_url, 50, 50, "fill")
                : null;

            return {
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role,
                    avatar_url: avatarUrl,
                    company_id: user.company_id,
                    company_slug: user.company?.slug || null,
                    unit_id: user.unit_id,
                    unit_name: user.unit?.name || null
                },
                accessToken,
                refreshToken,
                cookie_max_age: ttlSeconds * 1000,
                expires_in: 15 * 60 // 15 minutes in seconds
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Error occurred while logging in", 500);
        }
    });
};

export const refreshTokenService = async (refreshToken) => {
    const tokenMeta = await client.get(`refreshToken:${refreshToken}`);

    if (!tokenMeta) {
        throw new AppError("Refresh token not found", 401);
    }

    const { id, sessionId, ttl_seconds } = JSON.parse(tokenMeta);

    // Fetch full user payload from the session record
    const sessionInfo = await client.get(`session:${sessionId}`);
    const { device_info } = sessionInfo ? JSON.parse(sessionInfo) : {};

    const user = await prisma.users.findUnique({
        where: { id: id },
        select: { id: true, role: true, company_id: true, unit_id: true },
    });

    if (!user) {
        throw new AppError("User not found", 401);
    }

    // Resolve current unit_path
    let unit_path = null;
    if (user.unit_id) {
        const unitData = await prisma.$queryRaw`
            SELECT path::text as unit_path FROM "Units" WHERE id = ${user.unit_id}
        `;
        unit_path = unitData[0]?.unit_path || null;
    }

    const tokenPayload = { id: user.id, role: user.role, company_id: user.company_id, unit_id: user.unit_id, unit_path };
    const accessToken = generateToken(tokenPayload, '15m');

    // Token rotation: use the SAME TTL as the original session so remember_me sessions aren't shortened
    const ttlDays = Math.ceil(ttl_seconds / (24 * 60 * 60));
    const newRefreshToken = generateToken(tokenPayload, `${ttlDays}d`);

    // Replace old token with new one, keeping the same sessionId and TTL
    await client.del(`refreshToken:${refreshToken}`);
    const updatedSessionMeta = JSON.stringify({
        userId: user.id,
        device_info: device_info || { name: 'Unknown', fingerprint: 'unknown' },
        created_at: sessionInfo ? JSON.parse(sessionInfo).created_at : new Date().toISOString(),
        ttl_seconds,
        token: newRefreshToken,
    });
    await Promise.all([
        client.setEx(`refreshToken:${newRefreshToken}`, ttl_seconds, JSON.stringify({ userId: user.id, sessionId, ttl_seconds })),
        client.setEx(`session:${sessionId}`, ttl_seconds, updatedSessionMeta),
    ]);

    return { accessToken, refreshToken: newRefreshToken, cookie_max_age: ttl_seconds * 1000, expires_in: 15 * 60 };
};

export const getCurrentUser = async (userId) => {
    try {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                full_name: true,
                email: true,
                avatar_url: true,
                role: true,
                company_id: true,
                unit_id: true,
                created_at: true,
                is_active: true,
                company: {
                    select: {
                        slug: true,
                        name: true
                    }
                },
                unit: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!user) {
            throw new AppError("Account no longer exists. Please login again.", 401);
        }

        // Transform avatar_url to Cloudinary URL with 50x50 pixels
        const avatarUrl = user.avatar_url
            ? getCloudinaryImageUrl(user.avatar_url, 50, 50, "fill")
            : null;

        return {
            ...user,
            avatar_url: avatarUrl,
            company_slug: user.company?.slug || null,
            company_name: user.company?.name || null,
            unit_name: user.unit?.name || null,
            company: undefined,
            unit: undefined
        };
    } catch (error) {
        throw new AppError("Error occurred while fetching user", 500);
    }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await prisma.users.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (!await comparePassword(currentPassword, user.password)) {
        throw new AppError("Current password is incorrect", 400);
    }

    if (await comparePassword(newPassword, user.password)) {
        throw new AppError("New password must be different from current password", 400);
    }

    const hashedNewPassword = await hashPassword(newPassword, 10);

    await prisma.users.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
    });

    // Invalidate all sessions for this user using the per-user set
    const revokedCount = await removeAllUserSessions(userId);

    return { sessions_revoked: revokedCount };
};

/**
 * Revoke a single session identified by the raw refresh token value.
 * Silently succeeds if the token is not found (already expired/revoked).
 */
export const logoutSingleSession = async (refreshToken) => {
    const tokenMeta = await client.get(`refreshToken:${refreshToken}`);
    if (!tokenMeta) return;

    const { userId, sessionId } = JSON.parse(tokenMeta);
    await removeSession(userId, sessionId, refreshToken);
};

export const logoutAll = async (userId) => {
    const revokedCount = await removeAllUserSessions(userId);
    return { sessions_revoked: revokedCount };
};

export const getSessions = async (userId, currentRefreshToken) => {
    const sessionIds = await client.sMembers(`userSessions:${userId}`);
    const sessions = [];
    const staleSessionIds = [];

    for (const sid of sessionIds) {
        const sessionInfo = await client.get(`session:${sid}`);
        if (sessionInfo) {
            const { device_info, created_at, token } = JSON.parse(sessionInfo);
            sessions.push({
                id: sid, // opaque UUID — safe to expose
                device_info: device_info || { name: 'Unknown', fingerprint: 'unknown' },
                created_at,
                current: token === currentRefreshToken,
            });
        } else {
            staleSessionIds.push(sid);
        }
    }

    // Clean up stale references from the set
    if (staleSessionIds.length > 0) {
        await client.sRem(`userSessions:${userId}`, ...staleSessionIds);
    }

    return sessions;
};

export const deleteSession = async (userId, sessionId) => {
    const sessionInfo = await client.get(`session:${sessionId}`);
    if (!sessionInfo) {
        throw new AppError("Session not found", 404);
    }

    const { userId: sessionUserId, token } = JSON.parse(sessionInfo);
    if (sessionUserId !== userId) {
        throw new AppError("Unauthorized to delete this session", 403);
    }

    await removeSession(userId, sessionId, token);
};