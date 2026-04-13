import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Step 2: extend Express request type so multer file is recognized
interface MulterRequest extends express.Request {
  file?: Express.Multer.File;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Step 3: configure multer for in-memory PDF uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  app.use(express.json());

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  app.get("/api/extract-pdf", (req, res) => {
    res.status(405).json({ success: false, error: "Method Not Allowed. Use POST." });
  });

  // Step 4: PDF extraction endpoint
  app.post(
    "/api/extract-pdf",
    upload.single("file"),
    async (req: any, res: express.Response) => {
      console.log("POST /api/extract-pdf received");
      try {
        const mReq = req as MulterRequest;

        if (!mReq.file) {
          console.error("No file in request");
          return res.status(400).json({
            success: false,
            stage: "upload",
            error: "No file uploaded",
          });
        }

        console.log(`Extracting text from: ${mReq.file.originalname} (${mReq.file.size} bytes)`);

        if (mReq.file.mimetype !== "application/pdf") {
          return res.status(400).json({
            success: false,
            stage: "validation",
            error: "Uploaded file is not a valid PDF",
          });
        }

        // Validate PDFParse class exists
        if (typeof PDFParse !== "function") {
          console.error("PDFParse is not a function:", typeof PDFParse);
          return res.status(500).json({
            success: false,
            stage: "server_init",
            error: "PDFParse class failed to load",
          });
        }

        const parser = new PDFParse({ data: mReq.file.buffer });
        const parsed = await parser.getText();

        if (!parsed?.text || !parsed.text.trim()) {
          console.warn("Empty text extracted from PDF");
          return res.status(400).json({
            success: false,
            stage: "pdf_extraction",
            error: "PDF text extraction returned empty content",
          });
        }

        const extractedText = parsed.text.trim().slice(0, 25000);
        console.log(`Successfully extracted ${extractedText.length} characters`);

        return res.json({
          success: true,
          stage: "pdf_extraction",
          fileName: mReq.file.originalname,
          text: extractedText,
        });
      } catch (error: any) {
        console.error("PDF Extraction Error:", error);
        return res.status(500).json({
          success: false,
          stage: "pdf_extraction",
          error: error?.message || "Failed to extract text from PDF",
        });
      }
    }
  );

  // Global error handler for JSON/Multer errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  });

  // Step 5: Vite middleware for development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    // Step 6: serve built frontend in production mode
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Step 7: start the server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});