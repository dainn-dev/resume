function parseSseText(body: string): string {
  let text = "";
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    try {
      const evt = JSON.parse(data);
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        text += evt.delta.text;
      }
    } catch {
      // skip malformed lines
    }
  }
  return text;
}

export function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response.");

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { if (--depth === 0) return raw.slice(start, i + 1); }
  }

  // Attempt to repair truncated JSON by closing open braces/brackets
  let truncated = raw.slice(start);
  if (inString) truncated += '"';
  // Strip trailing incomplete values (e.g. a dangling comma or partial string)
  truncated = truncated.replace(/,\s*$/, "");
  // Close all open brackets/braces
  const opens: string[] = [];
  let rs = false;
  let re = false;
  for (const ch of truncated) {
    if (re) { re = false; continue; }
    if (ch === "\\" && rs) { re = true; continue; }
    if (ch === '"') { rs = !rs; continue; }
    if (rs) continue;
    if (ch === "{") opens.push("}");
    else if (ch === "[") opens.push("]");
    else if (ch === "}" || ch === "]") opens.pop();
  }
  truncated += opens.reverse().join("");

  try {
    JSON.parse(truncated);
    return truncated;
  } catch {
    throw new Error("Unmatched braces in JSON response.");
  }
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
): Promise<string> {
  const baseUrl = (process.env.ANTHROPIC_URL ?? "https://api.anthropic.com")
    .replace(/\/$/, "")
    .replace(/\/v1$/, "");
  const endpoint = `${baseUrl}/v1/messages`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const body = await res.text();

  const isSse = body.trimStart().startsWith("event:") || body.trimStart().startsWith("data:");
  if (isSse) {
    const text = parseSseText(body);
    if (!text.trim()) {
      throw new Error(
        "Model API returned an empty response. This usually means the upstream proxy or model rejected the request (often due to input size or quota limits).",
      );
    }
    return text;
  }

  const bodyJson = JSON.parse(extractJson(body));
  if (Array.isArray(bodyJson.content)) {
    return (bodyJson.content as { type: string; text?: string }[])
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("");
  }
  // Some proxies (e.g. OpenAI-compatible gateways fronting Claude) return
  // chat-completion shape instead of Anthropic's content blocks.
  if (Array.isArray(bodyJson.choices)) {
    return (bodyJson.choices as { message?: { content?: string } }[])
      .map(c => c.message?.content ?? "")
      .join("");
  }
  throw new Error("Unexpected response shape from model API.");
}
