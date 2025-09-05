import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { ObjectId } from "mongodb";

const router = Router();

// Validation Schema
const BodySchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(40).default("익명").optional(),
  message: z.string().trim().min(1).max(1000),
  email: z.string().email().optional().or(z.literal("")),
  hp: z.string().optional(), // honeypot field for bot detection
});

// 피드백 타입 정의
interface Feedback {
  _id?: ObjectId;
  slug: string;
  name: string;
  message: string;
  email?: string;
  createdAt: Date;
}

// GET /api/feedback?slug=/feedback
router.get("/", async (req: Request, res: Response) => {
  try {
    const slug = String(req.query.slug ?? "");

    if (!slug) {
      return res.status(400).json({
        error: "Missing slug parameter",
        example: "/api/feedback?slug=/feedback",
      });
    }

    const db = await getDb();
    const collection = db.collection<Feedback>("feedback");

    // 인덱스 생성 (이미 존재하면 무시됨)
    await collection.createIndex({ slug: 1, createdAt: -1 });

    const feedbacks = await collection
      .find({ slug })
      .sort({ createdAt: -1 })
      .limit(150)
      .toArray();

    const response = feedbacks.map((feedback) => ({
      _id: feedback._id?.toString(),
      slug: feedback.slug,
      name: feedback.name,
      message: feedback.message,
      createdAt: feedback.createdAt,
    }));

    console.log(`📋 Retrieved ${response.length} feedbacks for slug: ${slug}`);

    return res.json({
      success: true,
      data: response,
      count: response.length,
    });
  } catch (error) {
    console.error("[GET /api/feedback] Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "피드백을 불러오는 중 오류가 발생했습니다.",
    });
  }
});

// POST /api/feedback
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = BodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.errors,
        message: "입력 데이터가 올바르지 않습니다.",
      });
    }

    const { slug, name = "익명", message, email, hp } = parsed.data;

    // Honeypot 체크 (봇 차단)
    if (hp && hp.trim()) {
      console.log("🤖 Bot detected via honeypot, ignoring request");
      return res.json({ success: true, message: "피드백이 등록되었습니다." });
    }

    const db = await getDb();
    const collection = db.collection<Feedback>("feedback");

    const newFeedback: Omit<Feedback, "_id"> = {
      slug,
      name,
      message,
      email: email || undefined,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newFeedback);

    console.log(`✅ New feedback created with ID: ${result.insertedId}`);
    console.log(
      `📝 From: ${name} | Slug: ${slug} | Message: ${message.substring(
        0,
        50
      )}...`
    );

    return res.status(201).json({
      success: true,
      message: "피드백이 성공적으로 등록되었습니다.",
      id: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("[POST /api/feedback] Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "피드백 등록 중 오류가 발생했습니다.",
    });
  }
});

// DELETE /api/feedback/:id (관리자용 - 선택사항)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid ID format",
        message: "올바르지 않은 ID 형식입니다.",
      });
    }

    const db = await getDb();
    const collection = db.collection<Feedback>("feedback");

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "Feedback not found",
        message: "해당 피드백을 찾을 수 없습니다.",
      });
    }

    console.log(`🗑️ Feedback deleted: ${id}`);

    return res.json({
      success: true,
      message: "피드백이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("[DELETE /api/feedback/:id] Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "피드백 삭제 중 오류가 발생했습니다.",
    });
  }
});

export default router;
