import * as crypto from "crypto";
import { signSession, verifySession } from "@/lib/requireAuth";

const MAX_HISTORY = 20;
const MAX_CHARS = 2000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Signature the client hands back with an answer, proving this server wrote it. */
const answerValue = (content: string) => `ask:${crypto.createHash("sha256").update(content).digest("hex")}`;
export const signAnswer = (content: string) => signSession(answerValue(content));
const isOwnAnswer = (content: string, sig: unknown) =>
  typeof sig === "string" && verifySession(sig) === answerValue(content);

export function sanitizeHistory(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs = raw
    .slice(-MAX_HISTORY)
    // Assistant turns must carry this server's signature, so a client can't put words in its mouth
    .filter((m) => m?.role !== "assistant" || (typeof m?.content === "string" && isOwnAnswer(m.content, m.sig)))
    .map((m) => ({
      role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: typeof m?.content === "string" ? m.content.slice(0, MAX_CHARS) : "",
    }));
  // Must start with a user turn and end with the new question
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user" || !msgs[msgs.length - 1].content.trim()) return null;
  return msgs.filter((m) => m.content.trim());
}
