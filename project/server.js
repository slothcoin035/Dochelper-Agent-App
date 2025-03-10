import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "Gemini-1.5-flash-002" });

// Version storage configuration
const VERSIONS_DIR = "./saved_versions";
if (!fs.existsSync(VERSIONS_DIR)) {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
}

// Rate limiting configuration
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Rate limiting middleware
const rateLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return next();
  }

  const requestData = requestCounts.get(ip);
  
  if (now - requestData.windowStart > RATE_LIMIT_WINDOW) {
    // Reset window
    requestData.count = 1;
    requestData.windowStart = now;
    return next();
  }

  if (requestData.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again in a minute.",
      retryAfter: Math.ceil((requestData.windowStart + RATE_LIMIT_WINDOW - now) / 1000)
    });
  }

  requestData.count++;
  next();
};

// Clean up old rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// Middleware
app.use(cors());
app.use(express.json());

// Apply rate limiting to AI endpoints
app.use(['/api/suggest', '/api/format'], rateLimiter);

app.post("/api/suggest", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Missing text",
        message: "Please provide text to get suggestions"
      });
    }

    const prompt = `You are DocHelper AI, a professional document assistant. Please help improve the following text while maintaining its core meaning and professional tone:\n\n${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const suggestion = response.text();

    res.json({ suggestion });
  } catch (error) {
    console.error("Error generating suggestion:", error);
    res.status(503).json({
      error: "AI service error",
      message: "Failed to generate suggestion. Please try again later."
    });
  }
});

app.post("/api/format", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Missing text",
        message: "Please provide text to format"
      });
    }

    const prompt = `You are DocHelper AI, a professional document formatter. Please format the following text to improve its structure, using appropriate headings, paragraphs, and bullet points where needed. Maintain the original content and meaning:\n\n${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const formattedText = response.text();

    res.json({ formattedText });
  } catch (error) {
    console.error("Error formatting text:", error);
    res.status(503).json({
      error: "AI service error",
      message: "Failed to format text. Please try again later."
    });
  }
});

app.post("/api/save-version", async (req, res) => {
  try {
    const { documentId, title, content, userId } = req.body;

    if (!documentId) {
      return res.status(400).json({
        error: "Missing document ID",
        message: "Document ID is required"
      });
    }

    if (!content) {
      return res.status(400).json({
        error: "Missing content",
        message: "Document content is required"
      });
    }

    // Ensure versions directory exists
    if (!fs.existsSync(VERSIONS_DIR)) {
      fs.mkdirSync(VERSIONS_DIR, { recursive: true });
    }

    // Save to file system
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `document-${documentId}-${timestamp}.txt`;
    const filePath = path.join(VERSIONS_DIR, fileName);

    // Save metadata
    const metadata = {
      title: title || 'Untitled Version',
      timestamp,
      userId,
      documentId
    };

    // Write content and metadata
    await fs.promises.writeFile(filePath, content);
    await fs.promises.writeFile(
      `${filePath}.meta.json`,
      JSON.stringify(metadata, null, 2)
    );

    // Return success response
    res.json({ 
      success: true, 
      message: "Version saved successfully",
      version: {
        id: fileName,
        title: metadata.title,
        content: { text: content },
        created_at: metadata.timestamp,
        created_by: metadata.userId,
        source: 'file'
      }
    });
  } catch (error) {
    console.error("Error saving version:", error);
    res.status(500).json({
      error: "Failed to save version",
      message: error.message || "An unexpected error occurred while saving the version"
    });
  }
});

// Get all versions for a document
app.get("/api/versions/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    if (!documentId) {
      return res.status(400).json({
        error: "Missing document ID",
        message: "Document ID is required"
      });
    }

    const versions = [];

    // Read file system versions
    if (fs.existsSync(VERSIONS_DIR)) {
      const files = await fs.promises.readdir(VERSIONS_DIR);
      
      for (const file of files) {
        if (file.endsWith('.txt') && !file.endsWith('.meta.json')) {
          try {
            const filePath = path.join(VERSIONS_DIR, file);
            const metaPath = `${filePath}.meta.json`;
            
            if (fs.existsSync(metaPath)) {
              const content = await fs.promises.readFile(filePath, 'utf-8');
              const metadata = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));

              if (metadata.documentId === documentId) {
                versions.push({
                  id: file,
                  title: metadata.title,
                  content: { text: content },
                  created_at: metadata.timestamp,
                  created_by: metadata.userId,
                  source: 'file'
                });
              }
            }
          } catch (err) {
            console.error(`Error reading version file ${file}:`, err);
            // Continue with other files even if one fails
          }
        }
      }
    }

    // Sort versions by creation date
    versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ versions });
  } catch (error) {
    console.error("Error fetching versions:", error);
    res.status(500).json({
      error: "Failed to fetch versions",
      message: error.message || "An unexpected error occurred while fetching versions"
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  const aiAvailable = !!process.env.GOOGLE_API_KEY;
  res.json({ 
    status: "healthy",
    aiService: aiAvailable ? "available" : "unavailable"
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Versions directory: ${VERSIONS_DIR}`);
  console.log(`AI Service: ${process.env.GOOGLE_API_KEY ? 'Available' : 'Unavailable'}`);
});