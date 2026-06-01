import type { ResumeFormData } from "@/types/builder";

export interface ContactItem { text: string; href?: string }

// Turn a user-supplied contact string into a safe href, or undefined to render as plain text.
// Only http(s) URLs (or bare domains we can safely prefix) become links — this rejects
// javascript:/data: and other injection vectors, since href is the one place user content
// isn't auto-escaped by React.
function safeUrl(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  // Bare domain like "linkedin.com/in/abc" (no scheme, no spaces, has a dot) -> prefix https.
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return undefined;
}

// Build the header contact line for every theme. Email/phone become mailto:/tel: links;
// location is plain text; LinkedIn/GitHub link out only when they form a safe URL.
export function buildContacts(data: ResumeFormData, hideContact: boolean): ContactItem[] {
  const items: ContactItem[] = [];
  const email = data.email?.trim();
  const phone = data.phone?.trim();
  if (!hideContact && email) items.push({ text: email, href: `mailto:${email}` });
  if (!hideContact && phone) items.push({ text: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` });
  if (data.location?.trim()) items.push({ text: data.location.trim() });
  if (data.linkedIn?.trim()) items.push({ text: data.linkedIn.trim(), href: safeUrl(data.linkedIn) });
  if (data.github?.trim()) items.push({ text: data.github.trim(), href: safeUrl(data.github) });
  return items;
}

// Split a free-text "skills"/"languages"/"certifications" field (comma, newline, or
// bullet separated) into trimmed, non-empty items for chip/list rendering.
export function splitItems(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,•;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Split a multi-line "projects" blob into paragraphs.
export function splitParagraphs(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function dateRange(start: string, end: string): string {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} — ${e}`;
  return s || e || "";
}
