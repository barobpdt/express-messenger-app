import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const sendToken = (user, statusCode, message, res) => {
    const token = jwt.sign({ id: user.id }, ENV.JWT_SECRET_KEY, {
        expiresIn: ENV.JWT_EXPIRES_IN,
    });
    res.status(statusCode).cookie("token", token, {
        expires: new Date(Date.now() + ENV.COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true
    }).json({
        success: true,
        user,
        message,
        token,
    });
};