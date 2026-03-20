import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 1000, // 1000 requests per Window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Too many requests from this IP" }
});
app.use(limiter);

// Advanced Logging with Pino
app.use(pinoHttp({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
}));

// CORS — restrict origins in production
const allowedOrigins = process.env["CORS_ORIGINS"]
  ? process.env["CORS_ORIGINS"].split(",").map((o) => o.trim())
  : undefined; // undefined = allow all (development)

app.use(
  cors({
    origin: allowedOrigins ?? true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be LAST
app.use(errorHandler);

export default app;
