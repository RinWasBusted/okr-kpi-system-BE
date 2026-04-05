import { loginSchema, changePasswordSchema } from "../../schemas/auth.schema.js";
import { incrementLoginAttempts, resetLoginAttempts } from "../../middlewares/rateLimit.js";
import * as authService from "./auth.service.js";
import AppError from "../../utils/appError.js";

export const login = async (req, res) => {
    const { email, password, company_slug, device_info, remember_me } = loginSchema.parse(req.body);

    try {
        const { user, accessToken, refreshToken, cookie_max_age, expires_in } = await authService.loginService(
            email, password, company_slug ? company_slug : '', device_info, remember_me
        );

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
            maxAge: cookie_max_age
        });

        // Clear rate-limit counter on successful login
        await resetLoginAttempts(req.ip);

        res.success("Login successful", 200, { user, expires_in });
    } catch (error) {
        // Only count failed credential attempts toward the rate limit
        if (error instanceof AppError && error.statusCode === 401) {
            await incrementLoginAttempts(req.ip);
        }
        throw error;
    }
};

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
        throw new AppError("Refresh token not found", 401);
    }

    const { accessToken, refreshToken: newRefreshToken, cookie_max_age, expires_in } = await authService.refreshTokenService(refreshToken);

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    };

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Preserve the original session TTL (handles remember_me correctly)
    res.cookie('refreshToken', newRefreshToken, {
        ...cookieOptions,
        maxAge: cookie_max_age
    });

    res.success("Access token refreshed", 200, { expires_in });
};

export const logout = async (req, res) => {
    const { refreshToken } = req.cookies;

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    if (refreshToken) {
        // logoutSingleSession ignores "not found" errors; other errors propagate normally
        await authService.logoutSingleSession(refreshToken);
    }

    res.success("Logged out successfully", 200);
};

export const getCurrentUser = async (req, res) => {
    const { id } = req.user;

    const user = await authService.getCurrentUser(id);

    res.success("Current user retrieved successfully", 200, { user });
};

export const changePassword = async (req, res) => {
    const { id } = req.user;
    // Parse the full body so confirmPassword is validated by the schema refine rule
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const result = await authService.changePassword(id, currentPassword, newPassword);

    res.success("Password changed successfully", 200, result);
};
export const logoutAll = async (req, res) => {
    const { id } = req.user;

    const result = await authService.logoutAll(id);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.success("Logged out from all devices successfully", 200, result);
};

export const getSessions = async (req, res) => {
    const { id } = req.user;
    const { refreshToken } = req.cookies;

    const sessions = await authService.getSessions(id, refreshToken);

    res.success("Sessions retrieved successfully", 200, sessions);
};

export const deleteSession = async (req, res) => {
    const { id } = req.user;
    const { sessionId } = req.params;

    await authService.deleteSession(id, sessionId);

    res.success("Session revoked successfully", 200);
};