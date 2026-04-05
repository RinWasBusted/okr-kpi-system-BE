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
                device_info: device_info
            }

            const accessToken = generateToken(tokenPayload, '15m');
            const refreshTokenExpiry = remember_me ? '30d' : '7d';
            const refreshToken = generateToken(tokenPayload, refreshTokenExpiry);

            await client.setEx(`refreshToken:${refreshToken}`, remember_me ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60, JSON.stringify(tokenPayload));

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
        const tokenData = await client.get(`refreshToken:${refreshToken}`);

        if (!tokenData) {
            throw new AppError("Refresh token not found", 401);
        }

        const parsedData = JSON.parse(tokenData);
        const { id, role, company_id, unit_id, unit_path } = parsedData;

        // Check if token is expired (by checking if it exists, since we set expiry)
        // But since Redis handles expiry, if it exists, it's valid

        const accessToken = generateToken({ id, role, company_id, unit_id, unit_path }, '15m');

        // Token rotation: invalidate old refresh token and create new one
        await client.del(`refreshToken:${refreshToken}`);
        const newRefreshToken = generateToken({ id, role, company_id, unit_id, unit_path }, '7d');
        await client.setEx(`refreshToken:${newRefreshToken}`, 7 * 24 * 60 * 60, JSON.stringify(parsedData));

        return { accessToken, refreshToken: newRefreshToken, expires_in: 15 * 60 };
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

        // Invalidate all refresh tokens for this user
        const keys = await client.keys(`refreshToken:*`);
        let revokedCount = 0;
        for (const key of keys) {
            const tokenData = await client.get(key);
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                if (parsed.id === userId) {
                    await client.del(key);
                    revokedCount++;
                }
            }
        }

        return { sessions_revoked: revokedCount };
    } catch (error) {
        throw error;
    }
};

export const logoutAll = async (userId, currentRefreshToken) => {
    try {
        const keys = await client.keys(`refreshToken:*`);
        let revokedCount = 0;
        for (const key of keys) {
            const tokenData = await client.get(key);
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                if (parsed.id === userId && key !== `refreshToken:${currentRefreshToken}`) {
                    await client.del(key);
                    revokedCount++;
                }
            }
        }
        // Also revoke current session
        if (currentRefreshToken) {
            await client.del(`refreshToken:${currentRefreshToken}`);
        }
        return { sessions_revoked: revokedCount + (currentRefreshToken ? 1 : 0) };
    } catch (error) {
        throw error;
    }
};

export const getSessions = async (userId, currentRefreshToken) => {
    try {
        const keys = await client.keys(`refreshToken:*`);
        const sessions = [];
        for (const key of keys) {
            const tokenData = await client.get(key);
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                if (parsed.id === userId) {
                    // Note: In a real implementation, you'd store device_info in Redis
                    // For now, we'll return basic session info
                    sessions.push({
                        id: key.replace('refreshToken:', ''),
                        device_info: parsed.device_info || { name: 'Unknown', fingerprint: 'unknown' },
                        last_seen: new Date().toISOString(), // This should be stored in Redis
                        current: key === `refreshToken:${currentRefreshToken}`
                    });
                }
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
    } catch (error) {
        throw error;
    }
};