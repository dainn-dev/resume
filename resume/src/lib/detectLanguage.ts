const VIETNAMESE_PATTERN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function detectLanguage(text: string): "vi" | "en" {
  const sample = text.slice(0, 2000);
  const matches = sample.match(VIETNAMESE_PATTERN);
  return matches && matches.length >= 3 ? "vi" : "en";
}

export function languageInstruction(lang: "vi" | "en"): string {
  return lang === "vi"
    ? "IMPORTANT: Respond entirely in Vietnamese."
    : "IMPORTANT: Respond entirely in English.";
}
