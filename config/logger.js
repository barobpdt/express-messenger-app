import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, "../logs");

const { combine, timestamp, printf, colorize, errors } = winston.format;

// 로그 포맷: [시간] LEVEL: 메시지 (스택 포함)
const logFormat = printf(({ level, message, timestamp, stack }) =>
    `[${timestamp}] ${level}: ${stack || message}`
);

const logger = winston.createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),  // Error 객체의 스택트레이스 포함
        logFormat
    ),
    transports: [
        // 콘솔 출력 (색상 적용)
        new winston.transports.Console({
            format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), logFormat),
        }),
        // 일반 로그 파일 (info 이상)
        new winston.transports.File({
            filename: path.join(logDir, "app.log"),
            maxsize: 5 * 1024 * 1024,  // 5MB 초과 시 새 파일
            maxFiles: 5,                // 최대 5개 보관
        }),
        // 에러 전용 파일 (error 레벨만)
        new winston.transports.File({
            filename: path.join(logDir, "error.log"),
            level: "error",
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});

export default logger;
