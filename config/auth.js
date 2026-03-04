import { sendToken } from "./jwtToken.js";
import { ENV } from "./env.js";
import jwt from "jsonwebtoken";
import ErrorHandler from "./error.js";

export const catchAsyncErrors = (theFunction) => {
	return (req, res, next) => Promise.resolve(theFunction(req, res, next)).catch(next)
};

export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
	const { token } = req.cookies;
	if (!token) {
		return next(new ErrorHandler("Please login to access this resource.", 401));
	}
	const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY);
	const user = await database.query(
		"SELECT * FROM users WHERE id = $1 LIMIT 1",
		[decoded.id]
	);
	req.user = user.rows[0];
	next();
});

export const register = catchAsyncErrors(async (req, res, next) => {
	const { name, email, password } = req.body;
	if (!name || !email || !password) {
		return next(new ErrorHandler("Please provide all required fields.", 400));
	}
	if (password.length < 8 || password.length > 16) {
		return next(
			new ErrorHandler("Password must be between 8 and 16 characters.", 400)
		);
	}
	const isAlreadyRegistered = await database.query(
		`SELECT * FROM users WHERE email = $1`,
		[email]
	);
	if (isAlreadyRegistered.rows.length > 0) {
		return next(
			new ErrorHandler("User already registered with this email.", 400)
		);
	}
	const hashedPassword = await bcrypt.hash(password, 10);
	const user = await database.query(
		"INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
		[name, email, hashedPassword]
	);
	sendToken(user.rows[0], 201, "User registered successfully", res);
});
