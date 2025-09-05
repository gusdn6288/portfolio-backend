import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import feedbackRouter from "./routes/feedback.js";
import { getDb } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// 환경 변수 검증
const requiredEnvVars = ["MONGODB_URI", "MONGODB_DB"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// CORS 설정
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const corsOptions = {
  origin:
    CORS_ORIGIN === "*"
      ? true
      : CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// Health Check 엔드포인트
app.get("/api/health", async (req, res) => {
  try {
    // MongoDB 연결 상태 확인
    const db = await getDb();
    await db.admin().ping();

    res.json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: PORT,
        MONGODB_URI: !!process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB || null,
        CORS_ORIGIN: CORS_ORIGIN,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API 라우트 등록
app.use("/api/feedback", feedbackRouter);

// 기본 라우트
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Portfolio Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      feedback: {
        get: "/api/feedback?slug=<slug>",
        post: "/api/feedback",
        delete: "/api/feedback/:id",
      },
    },
  });
});

// 404 핸들러
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `경로 '${req.originalUrl}'을 찾을 수 없습니다.`,
    timestamp: new Date().toISOString(),
  });
});

// 글로벌 에러 핸들러
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("💥 Unhandled error:", error);

    res.status(500).json({
      error: "Internal Server Error",
      message: "서버에서 예상치 못한 오류가 발생했습니다.",
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }
);

// 서버 시작
async function startServer() {
  try {
    // MongoDB 연결 테스트
    console.log("🔗 Testing database connection...");
    const db = await getDb();
    await db.admin().ping();
    console.log("✅ Database connection successful");

    // 서버 시작
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📝 Feedback API: http://localhost:${PORT}/api/feedback`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔒 CORS Origin: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
