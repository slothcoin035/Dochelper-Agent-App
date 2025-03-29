import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '5555', 10);

if (isNaN(port)) {
  console.error('Invalid PORT configuration. Using default port 3003');
  port = 3003;
}

// Initialize Groq client with better error handling and retry logic
let groq;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

const initializeGroq = () => {
  try {
    if (!process.env.VITE_GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }
    groq = new Groq({
      apiKey: process.env.VITE_GROQ_API_KEY.trim(),
      timeout: 30000
    });
    console.log('Groq AI service initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Groq:', error.message);
    return false;
  }
};

const initializeGroqWithRetry = async () => {
  while (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS && !groq) {
    if (await initializeGroq()) {
      break;
    }
    initializationAttempts++;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * initializationAttempts));
  }
};

// Enhanced CORS configuration
const corsOptions = {
  origin: ['http://localhost:5174', 'http://localhost:5555'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 3600
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const status = {
      server: "healthy",
      aiService: groq ? "available" : "unavailable",
      aiError: !groq ? `AI service not initialized after ${initializationAttempts} attempts` : null,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || 'development'
    };

    if (!groq && initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
      return res.status(503).json({
        ...status,
        server: "degraded",
        error: "AI service initialization failed",
        retryable: true
      });
    }
    
    res.json(status);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      server: "error",
      aiService: "error",
      error: error.message || "Internal server error",
      timestamp: new Date().toISOString(),
      retryable: true
    });
  }
});

// AI suggestion endpoint
app.post("/api/suggest", async (req, res) => {
  if (!groq) {
    await initializeGroqWithRetry();
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Missing text",
        message: "Please provide text to get suggestions"
      });
    }

    if (text.length > 32000) {
      return res.status(400).json({
        error: "Text too long",
        message: "The provided text exceeds the maximum length limit"
      });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are DocHelper AI, a professional document assistant focused on improving text while maintaining meaning and tone."
        },
        {
          role: "user",
          content: `Please help improve the following text while maintaining its core meaning and professional tone. Focus on clarity, conciseness, and proper formatting:\n\n${text}`
        }
      ],
      model: "mistral-saba-24b",
      temperature: 0.7,
      max_tokens: 32768,
      top_p: 1,
      stream: false
    });

    const suggestion = completion.choices[0]?.message?.content;

    if (!suggestion) {
      throw new Error('No suggestion generated from AI service');
    }

    res.json({ suggestion });
  } catch (error) {
    console.error("Error generating suggestion:", error);
    
    const isRetryableError = error.message?.includes('timeout') || 
                            error.message?.includes('rate limit') ||
                            error.message?.includes('connection');
    
    res.status(isRetryableError ? 503 : 500).json({
      error: "AI service error",
      message: error.message || "Failed to generate suggestion",
      retryable: isRetryableError
    });
  }
});

// Format document endpoint
app.post("/api/format", async (req, res) => {
  if (!groq) {
    await initializeGroqWithRetry();
    if (!groq) {
      return res.status(503).json({
        error: "AI service unavailable",
        message: "The AI service is not properly initialized. Please try again later.",
        retryable: true
      });
    }
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Missing text",
        message: "Please provide text to format"
      });
    }

    if (text.length > 32000) {
      return res.status(400).json({
        error: "Text too long",
        message: "The provided text exceeds the maximum length limit"
      });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are DocHelper AI, a professional document formatter focused on improving document structure and readability."
        },
        {
          role: "user",
          content: `Please format the following text to improve its structure and readability. Apply proper spacing, paragraphs, and formatting:\n\n${text}`
        }
      ],
      model: "mistral-saba-24b",
      temperature: 0.5,
      max_tokens: 32768,
      top_p: 1,
      stream: false
    });

    const formattedText = completion.choices[0]?.message?.content;

    if (!formattedText) {
      throw new Error('No formatted text generated');
    }

    res.json({ formattedText });
  } catch (error) {
    console.error("Error formatting text:", error);
    
    const isRetryableError = error.message?.includes('timeout') || 
                            error.message?.includes('rate limit') ||
                            error.message?.includes('connection');
    
    res.status(isRetryableError ? 503 : 500).json({
      error: "AI service error",
      message: error.message || "Failed to format text",
      retryable: isRetryableError
    });
  }
});

// Serve index.html for all other routes to support client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred"
  });
});

// Start server with improved error handling
const startServer = async () => {
  try {
    await initializeGroqWithRetry();
    
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
      console.log(`AI Service: ${groq ? 'Available' : 'Unavailable'}`);
      console.log('CORS enabled for specified origins');
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();