import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";

const app = createApp();

let dbPromise;

async function connect() {
  if (!dbPromise) {
    dbPromise = connectDatabase();
  }

  await dbPromise;
}

export default async function handler(req, res) {
  try {
    await connect();
    return app(req, res);
  } catch (error) {
    console.error("Vercel API error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}