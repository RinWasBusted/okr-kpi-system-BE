import prisma from '../../utils/prisma.js';
import { generateToken } from '../../utils/jwt.js';
import { hashPassword, comparePassword } from '../../utils/bcrypt.js';
import AppError from '../../utils/appError.js';
import client from '../../utils/redis.js';
import requestContext from '../../utils/context.js';
import { getCloudinaryImageUrl } from '../../utils/cloudinary.js';

export const loginService = async (email, password, company_slug = '', device_info = null, remember_me = false) => {
    let company_id = null;
    let company = null;
    if( company_slug !== '' ){
        company = await requestContext.run({ company_id: '', role: 'ADMIN' },
            async () => await prisma.companies.findUnique({ where: { slug: company_slug } })
        );
        if(!company){
            throw new AppError("Company not found", 404);
        }
        company_id = company.id;
    }

    return await requestContext.run({ company_id: company_id, role: '' }, async () => {
        try {
            const user = await prisma.users.findFirst({
                where: { email },
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
                device_info: device_info,
                remember_me: remember_me,
            }

            const accessToken = generateToken(tokenPayload, '15m');
            const refreshTokenExpiry = remember_me ? '30d' : '7d';
            const refreshTokenTtlSeconds = remember_me ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
            const refreshToken = generateToken(tokenPayload, refreshTokenExpiry);

            const tokenKey = `refreshToken:${refreshToken}`;
            const userSessionsKey = `userSessions:${user.id}`;
            await client.setEx(tokenKey, refreshTokenTtlSeconds, JSON.stringify(tokenPayload));
            await client.sAdd(userSessionsKey, tokenKey);

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
    try {
        const tokenKey = `refreshToken:${refreshToken}`;
        const tokenData = await client.get(tokenKey);

        if (!tokenData) {
            throw new AppError("Refresh token not found", 401);
        }

        const parsedData = JSON.parse(tokenData);
        const { id, role, company_id, unit_id, unit_path, remember_me } = parsedData;

        const accessToken = generateToken({ id, role, company_id, unit_id, unit_path }, '15m');

        // Token rotation: invalidate old refresh token and create new one with same TTL
        const userSessionsKey = `userSessions:${id}`;
        await client.del(tokenKey);
        await client.sRem(userSessionsKey, tokenKey);

        const newTtlSeconds = remember_me ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
        const newRefreshTokenExpiry = remember_me ? '30d' : '7d';
        const newRefreshToken = generateToken({ id, role, company_id, unit_id, unit_path, remember_me }, newRefreshTokenExpiry);
        const newTokenKey = `refreshToken:${newRefreshToken}`;
        await client.setEx(newTokenKey, newTtlSeconds, JSON.stringify(parsedData));
        await client.sAdd(userSessionsKey, newTokenKey);

        return { accessToken, refreshToken: newRefreshToken, expires_in: 15 * 60, remember_me: !!remember_me };
    } catch (error) {
        throw error;
    }
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
    try {
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

        // Invalidate all refresh tokens for this user via per-user session set
        const userSessionsKey = `userSessions:${userId}`;
        const tokenKeys = await client.sMembers(userSessionsKey);
        let revokedCount = 0;
        for (const key of tokenKeys) {
            await client.del(key);
            revokedCount++;
        }
        await client.del(userSessionsKey);

        return { sessions_revoked: revokedCount };
    } catch (error) {
        throw error;
    }
};

export const logoutAll = async (userId) => {
    try {
        const userSessionsKey = `userSessions:${userId}`;
        const tokenKeys = await client.sMembers(userSessionsKey);
        let revokedCount = 0;
        for (const key of tokenKeys) {
            await client.del(key);
            revokedCount++;
        }
        await client.del(userSessionsKey);
        return { sessions_revoked: revokedCount };
    } catch (error) {
        throw error;
    }
};

export const getSessions = async (userId, currentRefreshToken) => {
    try {
        const userSessionsKey = `userSessions:${userId}`;
        const tokenKeys = await client.sMembers(userSessionsKey);
        const sessions = [];
        for (const key of tokenKeys) {
            const tokenData = await client.get(key);
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                const sessionId = key.replace('refreshToken:', '');
                sessions.push({
                    id: sessionId,
                    device_info: parsed.device_info || { name: 'Unknown', fingerprint: 'unknown' },
                    last_seen: new Date().toISOString(),
                    current: key === `refreshToken:${currentRefreshToken}`
                });
            } else {
                // Token expired; clean up stale entry from the set
                await client.sRem(userSessionsKey, key);
            }
        }
        return sessions;
    } catch (error) {
        throw error;
    }
};

export const deleteSession = async (userId, sessionId) => {
    try {
        const key = `refreshToken:${sessionId}`;
        const tokenData = await client.get(key);
        if (!tokenData) {
            throw new AppError("Session not found", 404);
        }
        const parsed = JSON.parse(tokenData);
        if (parsed.id !== userId) {
            throw new AppError("Unauthorized to delete this session", 403);
        }
        await client.del(key);
        await client.sRem(`userSessions:${userId}`, key);
    } catch (error) {
        throw error;
    }
};