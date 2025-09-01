import type { NextApiRequest, NextApiResponse } from "next";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3:latest";

const systemPrompt = (targetLang: string) => `
You are a helpful multilingual assistant.
- Always reply in ${targetLang}.
- Keep responses concise unless the user asks for more detail.
- Preserve code blocks (triple backticks), URLs, and any text inside {{double braces}} exactly; do not translate them.
- Don't say you're translating—just answer in ${targetLang}.
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, host: OLLAMA_HOST, model: MODEL, methods: ["POST"] });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, targetLang = "French", history = [] } = req.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const messages: Msg[] = [
      { role: "system", content: systemPrompt(targetLang) },
      ...(history as Msg[]),
      { role: "user", content: message },
    ];

    const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, // llama3:latest
        messages,
        stream: false,
        options: { temperature: 0.3 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(502).json({ error: `Ollama error ${r.status}: ${errText.slice(0, 200)}` });
    }

    const data = await r.json();
    const reply = data?.message?.content ?? "";
    return res.status(200).json({ reply });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unexpected server error" });
  }
}