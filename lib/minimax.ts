const MINIMAX_API_URL = "https://api.minimaxi.chat/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-Text-01";
const MINIMAX_TIMEOUT_MS = 30000;

export async function minimaxChat(params: {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
  timeout_ms?: number;
}): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is not set");
  }

  const messages = params.system
    ? [{ role: "system" as const, content: params.system }, ...params.messages]
    : params.messages;

  let res: Response;
  try {
    res = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages,
        max_tokens: params.max_tokens ?? 1024,
      }),
      signal: AbortSignal.timeout(params.timeout_ms ?? MINIMAX_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`MiniMax API timed out after ${params.timeout_ms ?? MINIMAX_TIMEOUT_MS}ms`);
    }
    throw err;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
