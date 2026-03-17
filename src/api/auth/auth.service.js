import prisma from '../../utils/prisma';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { comparePassword } from '../../utils/bcrypt';

export const loginService = async (email, password) => {
    try {
        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) {
            throw new Error("User not found", 404);
        }

        if (!await comparePassword(password, user.password)) {
            throw new Error("Invalid credentials", 401);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);



        return { user, accessToken, refreshToken };
    } catch (error) {
        throw new Error("Error occurred while logging in");
    }
};