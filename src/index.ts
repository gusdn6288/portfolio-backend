import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";
import feedbackRouter from "./routes/feedback.js";
import { getDb } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// HTTP 서버 생성
const httpServer = createServer(app);

// ──────────────────────────────
// ✅ 환경변수 기반 CORS 설정
// ──────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

const SOCKET_CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN
  ? process.env.SOCKET_CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

// Express CORS
const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Socket.IO 서버 생성
const io = new Server(httpServer, {
  cors: {
    origin: SOCKET_CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// IP 추출 헬퍼 함수
function getClientIp(socket: any): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    return (forwarded as string).split(",")[0].trim();
  }
  return socket.handshake.address || "unknown";
}

// Socket.IO 연결
io.on("connection", (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`👤 User connected: ${socket.id} (IP: ${clientIp})`);

  socket.on("chat:send", async (data) => {
    try {
      const db = await getDb();
      const collection = db.collection("feedback");

      const newMsg = {
        slug: data.slug,
        name: data.name || "익명",
        message: data.message,
        clientIp: clientIp,
        createdAt: new Date(),
      };

      const result = await collection.insertOne(newMsg);

      const responseMsg = {
        ...newMsg,
        _id: result.insertedId.toString(),
      };

      io.emit("chat:newMessage", responseMsg);
      console.log(`📝 Message from ${clientIp}: ${newMsg.message}`);
    } catch (err) {
      console.error("❌ DB 저장 실패:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (IP: ${clientIp})`);
  });
});

// ──────────────────────────────
// 미들웨어
// ──────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// ──────────────────────────────
// Health Check
// ──────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
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

// ──────────────────────────────
// API 라우트
// ──────────────────────────────
app.use("/api/feedback", feedbackRouter);

// 기본 라우트
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Portfolio Backend API with Socket.IO",
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
      socket: "chat:send / chat:newMessage",
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

// ──────────────────────────────
// 서버 시작
// ──────────────────────────────
async function startServer() {
  try {
    console.log("🔗 Testing database connection...");
    const db = await getDb();
    await db.admin().ping();
    console.log("✅ Database connection successful");

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📝 Feedback API: http://localhost:${PORT}/api/feedback`);
      console.log(`💬 Socket.IO ready at ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
