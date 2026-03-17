import { loginSchema, changePasswordSchema } from "../../schemas/auth.schema"
import * as authService from "./auth.service";
import appError from "../../utils/appError";

export const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const { user, accessToken, refreshToken } = await authService.loginService(email, password);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',        
        };

        res.cookie('accessToken', accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.success("Login successful", 200, { user });

    } catch (error) {
        throw error;
    }
};

export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            throw new appError("Refresh token not found", 401);
        }
        
        const accessToken = await authService.refreshTokenService(refreshToken);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.success("Access token refreshed", 200);
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
        throw error;
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
        
        await authService.changePassword(id, currentPassword, newPassword);

        res.success("Password changed successfully", 200);
    } catch (error) {
        throw error;
    }
};