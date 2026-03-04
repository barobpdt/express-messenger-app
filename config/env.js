import "dotenv/config";

export const ENV = {
  PORT: process.env.PORT || 5001,
  DATABASE_URL: process.env.DATABASE_URL,
  LOCAL_URL: process.env.LOCAL_URL,
  DB_DRIVER: process.env.DB_DRIVER || "neon",   // "local" | "neon"
  NODE_ENV: process.env.NODE_ENV,
};
