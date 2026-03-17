import { loginSchema } from "../../schemas/auth.schema"
import { hashPassword, comparePassword } from "../../utils/bcrypt";
import appError from "../../utils/appError";

export const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        if(!await comparePassword(password, user.password)) {
            throw new appError("Invalid credentials", 401);
        };

        const { user, accessToken, refreshToken } = await loginService(email, password);

        res.success("Login successful", 200, { user, accessToken, refreshToken });

    } catch (error) {
        throw error;
    }
};