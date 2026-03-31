import prisma from '../../utils/prisma.js';
import { generateToken } from '../../utils/jwt.js';
import { hashPassword, comparePassword } from '../../utils/bcrypt.js';
import AppError from '../../utils/appError.js';
import client from '../../utils/redis.js';
import requestContext from '../../utils/context.js';
import { getCloudinaryImageUrl } from '../../utils/cloudinary.js';

export const loginService = async (email, password, company_slug = '') => {
    let company_id = null;
    if( company_slug !== '' ){
        const company = await requestContext.run({ company_id: '', role: 'ADMIN' },
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
            where: { email }
        });

        if (!user || !(await comparePassword(password, user.password))) {
            throw new AppError("Invalid email or password", 401);
        }

        const tokenPayload = {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            unit_id: user.unit_id
        }

        const accessToken = generateToken(tokenPayload, '15m');
        const refreshToken = generateToken(tokenPayload, '7d');

        await client.setEx(`refreshToken:${refreshToken}`, 7 * 24 * 60 * 60, JSON.stringify(tokenPayload));

        return { user: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, email: user.email, job_title: user.job_title, role: user.role, company_id: user.company_id, unit_id: user.unit_id }, accessToken, refreshToken };
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
            throw new AppError("Invalid refresh token", 401);
        }

        const { id, role, company_id, unit_id } = JSON.parse(tokenData);

        const accessToken = generateToken({ id, role, company_id, unit_id }, '15m');

        return accessToken;
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
                phone: true,
                avatar_url: true,
                role: true,
                company_id: true,
                unit_id: true,
                created_at: true,
                company: {
                    select: {
                        slug: true
                    }
                }
            }
        });

        if (!user) {
            throw new AppError("User not found", 404);
        }

        // Transform avatar_url to Cloudinary URL with 50x50 pixels
        const avatarUrl = user.avatar_url
            ? getCloudinaryImageUrl(user.avatar_url, 50, 50, "fill")
            : null;

        return {
            ...user,
            avatar_url: avatarUrl,
            company_slug: user.company?.slug || null,
            company: undefined
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
            throw new AppError("Current password is incorrect", 401);
        }

        const hashedNewPassword = await hashPassword(newPassword, 10);

        await prisma.users.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });
    } catch (error) {
        throw error;
    }
};