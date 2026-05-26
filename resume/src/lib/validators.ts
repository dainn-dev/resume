const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateFile(file: File): void {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const isAllowedExt = ["pdf", "docx", "txt"].includes(ext ?? "");
  const isAllowedType = ALLOWED_TYPES.includes(file.type);

  if (!isAllowedType && !isAllowedExt) {
    throw new Error("Only PDF, DOCX, and TXT files are accepted.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the 5 MB limit.");
  }
}
