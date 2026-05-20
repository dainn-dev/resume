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

  throw new Error("Unmatched braces in JSON response.");
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
      "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
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
    return parseSseText(body);
  }

  const bodyJson = JSON.parse(extractJson(body));
  return (bodyJson.content as { type: string; text?: string }[])
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("");
}
