import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiApiKey() {
  const envLocalPath = path.join(__dirname, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf-8");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
    if (match && match[1]) {
      let val = match[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return "";
}

async function run() {
  const apiKey = getGeminiApiKey();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.list();
    console.log("Response type:", typeof response);
    console.log("Response keys:", Object.keys(response));
    console.log("Response content:", JSON.stringify(response, null, 2));
  } catch (e) {
    console.error("Failed to list models:", e);
  }
}

run();
