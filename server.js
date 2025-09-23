// require("dotenv").config();
// const express = require("express");
// const { createClient } = require("@supabase/supabase-js");
// const cors = require("cors");
// const { v4: uuidv4 } = require("uuid");
// const path = require("path");
// const fs = require("fs");

// // Get Supabase credentials from environment variables
// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
//   console.error(
//     "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
//   );
//   process.exit(1);
// }

// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// const app = express();
// app.use(cors());
// app.use(express.json());

// // Helper function to extract signed URL
// async function createSignedFileUrl(filePath) {
//   try {
//     const expiresIn = 60 * 60; // 1 hour expiration
//     const { data, error } = await supabase.storage
//       .from("projects")
//       .createSignedUrl(filePath, expiresIn);

//     if (error) {
//       console.error(`Error generating signed URL for ${filePath}:`, error);
//       return null;
//     }

//     return data.signedUrl;
//   } catch (err) {
//     console.error(`Error generating signed URL for ${filePath}:`, err);
//     return null;
//   }
// }

// app.post("/generate-project", async (req, res) => {
//   try {
//     const {
//       stack = "unknown",
//       version = "v1",
//       features = [],
//       useDummy = true,
//     } = req.body;

//     // Use timestamp + uuid in path for uniqueness
//     const uuid = uuidv4();
//     const timestamp = Date.now();
//     const basePath = `projects/${stack}-${version}-${timestamp}-${uuid}`;
//     const zipPath = `${basePath}/project.zip`;
//     const pdfPath = `${basePath}/project.pdf`;

//     // Read the files into buffers (use real files, not dummy data)
//     const zipBuffer = fs.readFileSync(
//       path.resolve(__dirname, "dummy-project.zip")
//     );
//     const pdfBuffer = fs.readFileSync(
//       path.resolve(__dirname, "dummy-project.pdf")
//     );

//     // Check the file sizes before uploading (debugging step)
//     console.log("Zip file size:", zipBuffer.length);
//     console.log("PDF file size:", pdfBuffer.length);

//     // Upload ZIP file
//     const { data: zipUploadData, error: zipUploadError } =
//       await supabase.storage.from("projects").upload(zipPath, zipBuffer, {
//         contentType: "application/zip",
//         upsert: true,
//       });

//     if (zipUploadError) {
//       console.error("Error uploading zip:", zipUploadError);
//       return res
//         .status(500)
//         .json({ success: false, message: "Zip upload failed", zipUploadError });
//     }

//     // Upload PDF file
//     const { data: pdfUploadData, error: pdfUploadError } =
//       await supabase.storage.from("projects").upload(pdfPath, pdfBuffer, {
//         contentType: "application/pdf",
//         upsert: true,
//       });

//     if (pdfUploadError) {
//       console.error("Error uploading pdf:", pdfUploadError);
//       return res
//         .status(500)
//         .json({ success: false, message: "PDF upload failed", pdfUploadError });
//     }

//     // Generate signed URLs
//     console.log("Generating signed URLs for the uploaded files...");

//     const zipUrl = await createSignedFileUrl(zipPath);
//     const pdfUrl = await createSignedFileUrl(pdfPath);

//     // If any of the signed URLs could not be generated, return an error
//     if (!zipUrl || !pdfUrl) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to generate signed URLs for the uploaded files",
//         zipUrl,
//         pdfUrl,
//       });
//     }

//     // Respond with project info and URLs
//     const project = {
//       id: uuid,
//       stack,
//       version,
//       features,
//       zip_url: zipUrl,
//       pdf_url: pdfUrl,
//       uploaded_at: new Date().toISOString(),
//     };

//     console.log("✅ Project generated and uploaded:", project);
//     return res.status(201).json({ success: true, project });
//   } catch (err) {
//     console.error("Error in /generate-project:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: String(err),
//     });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () =>
//   console.log(`Server listening on http://localhost:${PORT}`)
// );

require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

// For Node.js < 18, install: npm install node-fetch
const fetchFn = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const app = express();
app.use(cors());
app.use(express.json());

// Helper: create signed URL
async function createSignedFileUrl(filePath) {
  const expiresIn = 60 * 60; // 1 hour
  const { data, error } = await supabase.storage
    .from("projects")
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error(`Error generating signed URL:`, error);
    return null;
  }
  return data.signedUrl;
}

// Helper: download Google Drive file as Buffer
async function downloadFile(driveUrl) {
  // Convert "view" link into direct download link
  const match = driveUrl.match(/\/d\/(.*?)\//);
  if (!match) throw new Error("Invalid Google Drive URL");
  const fileId = match[1];
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  const res = await fetchFn(directUrl);
  if (!res.ok) throw new Error(`Failed to download: ${driveUrl}`);

  return Buffer.from(await res.arrayBuffer());
}

app.post("/generate-project", async (req, res) => {
  try {
    const { stack = "unknown", version = "v1", features = [] } = req.body;

    const uuid = uuidv4();
    const timestamp = Date.now();
    const basePath = `projects/${stack}-${version}-${timestamp}-${uuid}`;
    const zipPath = `${basePath}/project.zip`;
    const pdfPath = `${basePath}/project.pdf`;

    console.log("⬇️ Downloading dummy files from Google Drive...");
    const zipBuffer = await downloadFile(
      "https://drive.google.com/file/d/1j8MU3_kfNvJBlhQDjfUwcscIySe6MD9k/view?usp=sharing"
    );
    const pdfBuffer = await downloadFile(
      "https://drive.google.com/file/d/1v-nj2Ja-wWRdIvx3ViCcWuiIu3cIcvyc/view?usp=sharing"
    );

    console.log("Zip size:", zipBuffer.length, "bytes");
    console.log("PDF size:", pdfBuffer.length, "bytes");

    // Upload to Supabase
    const { error: zipError } = await supabase.storage
      .from("projects")
      .upload(zipPath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (zipError) {
      console.error("❌ Zip upload failed:", zipError);
      return res.status(500).json({ success: false, error: zipError });
    }

    const { error: pdfError } = await supabase.storage
      .from("projects")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfError) {
      console.error("❌ PDF upload failed:", pdfError);
      return res.status(500).json({ success: false, error: pdfError });
    }

    // Signed URLs
    const zipUrl = await createSignedFileUrl(zipPath);
    const pdfUrl = await createSignedFileUrl(pdfPath);

    if (!zipUrl || !pdfUrl) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate signed URLs",
      });
    }

    const project = {
      id: uuid,
      stack,
      version,
      features,
      zip_url: zipUrl,
      pdf_url: pdfUrl,
      uploaded_at: new Date().toISOString(),
    };

    console.log("✅ Project generated:", project);
    return res.status(201).json({ success: true, project });
  } catch (err) {
    console.error("❌ Error in /generate-project:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: String(err),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
