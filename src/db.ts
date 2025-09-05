import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB!;

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB environment variable");
}

export async function getDb(): Promise<Db> {
  if (!client) {
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      await client.connect();
      console.log("✅ MongoDB connected successfully");

      // 연결 테스트
      await client.db(dbName).admin().ping();
      console.log("✅ MongoDB ping successful");
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error);
      throw error;
    }
  }

  return client.db(dbName);
}

// 앱 종료 시 연결 해제
process.on("SIGINT", async () => {
  if (client) {
    await client.close();
    console.log("🔚 MongoDB connection closed.");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (client) {
    await client.close();
    console.log("🔚 MongoDB connection closed.");
  }
  process.exit(0);
});
