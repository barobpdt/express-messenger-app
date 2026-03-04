import logger from "./logger.js";

class ErrorHandler extends Error {
	constructor(message, statusCode) {
		super(message);
		this.statusCode = statusCode;
	}
}

export const errorMiddleware = (err, req, res, next) => {
	err.message = err.message || "Internal Server Error";
	err.statusCode = err.statusCode || 500;

	if (err.code === 11000) {
		err = new ErrorHandler("Duplicate field value entered", 400);
	}
	if (err.name === "JsonWebTokenError") {
		err = new ErrorHandler("JSON Web Token is invalid, try again", 400);
	}
	if (err.name === "TokenExpiredError") {
		err = new ErrorHandler("JSON Web Token has expired, try again", 400);
	}
	if (err.name === "CastError") {
		err = new ErrorHandler(`Invalid ${err.path}: ${err.value}`, 400);
	}

	const errorMessage = err.errors
		? Object.values(err.errors).map((e) => e.message).join(" ")
		: err.message;

	// ── 로그 파일 저장 ────────────────────────────────────────────────────────
	const logMeta = `${req.method} ${req.originalUrl} → ${err.statusCode}`;
	if (err.statusCode >= 500) {
		// 서버 오류 (5xx): error 레벨로 스택트레이스 포함 기록
		logger.error(`${logMeta} | ${errorMessage}`, { stack: err.stack });
	} else {
		// 클라이언트 오류 (4xx): warn 레벨로 간략 기록
		logger.warn(`${logMeta} | ${errorMessage}`);
	}
	// ─────────────────────────────────────────────────────────────────────────

	return res.status(err.statusCode).json({
		success: false,
		message: errorMessage,
	});
};

export default ErrorHandler;