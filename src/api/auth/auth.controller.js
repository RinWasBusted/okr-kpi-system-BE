import { loginSchema, changePasswordSchema } from "../../schemas/auth.schema.js";
import client from "../../utils/redis.js";
import * as authService from "./auth.service.js";
import AppError from "../../utils/appError.js";

export const login = async (req, res) => {
    try {
        const { email, password, company_slug, device_info, remember_me } = loginSchema.parse(req.body);

        const { user, accessToken, refreshToken, expires_in } = await authService.loginService(email, password, company_slug ? company_slug : '', device_info, remember_me);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',        
        };

        const refreshMaxAge = remember_me ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days

        res.cookie('accessToken', accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: refreshMaxAge
        });

        res.success("Login successful", 200, { user, expires_in });

    } catch (error) {
        throw error;
    }
};

export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            throw new AppError("Refresh token not found", 401);
        }
        
        const { accessToken, refreshToken: newRefreshToken, expires_in } = await authService.refreshTokenService(refreshToken);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.success("Access token refreshed", 200, { expires_in });
    } catch (error) {
        throw error;
    }
};

export const logout = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;
        
        if (refreshToken) {
            await client.del(`refreshToken:${refreshToken}`);
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.success("Logged out successfully", 200);
    } catch (error) {
        // If token is invalid, still clear cookies and return success
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.success("Already logged out", 200);
    }
};

export const getCurrentUser = async (req, res) => {
    try {
        const { id } = req.user; 

        const user = await authService.getCurrentUser(id);

        if (!user) {
            throw new appError("User not found", 404);
        }

        res.success("Current user retrieved successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

export const changePassword = async (req, res) => {
    try {
        const { id } = req.user; 
        const { currentPassword, newPassword } = req.body;

        if(! changePasswordSchema.parse({ currentPassword, newPassword }))
            throw new appError("Invalid input", 400)    
        
        const result = await authService.changePassword(id, currentPassword, newPassword);

        res.success("Password changed successfully", 200, result);
    } catch (error) {
        throw error;
    }
};
export const logoutAll = async (req, res) => {
    try {
        const { id } = req.user;
        const { refreshToken } = req.cookies;

        const result = await authService.logoutAll(id, refreshToken);

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.success("Logged out from all devices successfully", 200, result);
    } catch (error) {
        throw error;
    }
};

export const getSessions = async (req, res) => {
    try {
        const { id } = req.user;
        const { refreshToken } = req.cookies;

        const sessions = await authService.getSessions(id, refreshToken);

        res.success("Sessions retrieved successfully", 200, sessions);
    } catch (error) {
        throw error;
    }
};

export const deleteSession = async (req, res) => {
    try {
        const { id } = req.user;
        const { sessionId } = req.params;

        await authService.deleteSession(id, sessionId);

        res.success("Session revoked successfully", 200);
    } catch (error) {
        throw error;
    }
};