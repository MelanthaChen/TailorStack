import crypto from "node:crypto";

const pdfHeader = Buffer.from("%PDF-");
const blockedExtensions = [".docx", ".txt", ".zip", ".exe", ".dmg", ".sh", ".bat"];

export function validateResumeUpload(file, { maxUploadBytes }) {
  if (!file) {
    throwValidation("A PDF file is required", { file: "required" });
  }
  if (!file.buffer?.length) {
    throwValidation("Uploaded file is empty", { file: "empty" });
  }
  if (file.buffer.length > maxUploadBytes) {
    const error = new Error("Uploaded file exceeds the maximum size");
    error.code = "validation_error";
    error.statusCode = 413;
    error.details = { file: "too_large", maxUploadBytes };
    throw error;
  }

  const filename = sanitizeFilename(file.filename);
  const lowerFilename = filename.toLowerCase();
  if (blockedExtensions.some((extension) => lowerFilename.endsWith(extension))) {
    throwValidation("Only PDF files are supported", { file: "unsupported_extension" });
  }
  if (!lowerFilename.endsWith(".pdf")) {
    throwValidation("Only PDF files are supported", { file: "unsupported_extension" });
  }
  if (file.contentType !== "application/pdf") {
    throwValidation("Only application/pdf uploads are supported", { file: "unsupported_mime" });
  }
  if (!file.buffer.subarray(0, pdfHeader.length).equals(pdfHeader)) {
    throwValidation("Uploaded file is not a valid PDF", { file: "invalid_pdf_header" });
  }

  return {
    filename,
    contentType: "application/pdf",
    byteSize: file.buffer.length,
    checksumSha256: sha256(file.buffer)
  };
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sanitizeFilename(filename) {
  const cleaned = String(filename ?? "resume.pdf").replaceAll(/[^\w.\- ]/g, "").trim();
  return cleaned || "resume.pdf";
}

function throwValidation(message, details) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 400;
  error.details = details;
  throw error;
}
