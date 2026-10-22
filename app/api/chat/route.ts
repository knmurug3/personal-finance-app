import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { requireAuth, getSessionUsername, clientIp } from "@/lib/requireAuth";
import { sanitizeHistory, signAnswer } from "@/lib/ask/history";
import { loadSnapshot, type AskSnapshot } from "@/lib/ask/data";
import { ASK_TOOLS, TOOL_LABELS, runAskTool } from "@/lib/ask/tools";
import { APP_TIMEZONE } from "@/lib/appTime";
import { reportError, errorText } from "@/lib/errorReport";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Claude Sonnet 5.5 by default; override with ASK_MODEL (e.g. "claude-opus-5-5") without a code change
const MODEL = process.env.ASK_MODEL || "claude-sonnet-5-5";
const MAX_TURNS = 8; // model ↔ tool round trips per question
const OWNER_DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT || 100);
const DEMO_DAILY_LIMIT = Number(process.env.ASK_DEMO_DAILY_LIMIT || 30); // shared by all demo visitors
const DEMO_IP_DAILY_LIMIT = Number(process.env.ASK_DEMO_IP_DAILY_LIMIT || 5); // so one visitor can't use up the shared pool

const SYSTEM = `You are "Ask", the money assistant inside Personal Finance, a private personal finance app.

Answer the user's questions about their own finances using the tools. Always get numbers from a tool; never estimate or invent figures, accounts, or transactions. If the data can't answer the question, say so plainly and suggest what would.

Conventions in the data:
- Transaction amounts: positive = money out (spending), negative = money in (income, refunds).
- Spending excludes transfers between the user's own accounts and investment moves.
- Investment prices come from the brokerage and are usually a day old.

Style:
- Lead with the direct answer in one sentence, with the key number. Then up to a few short bullets of supporting detail if useful.
- Format money like $1,234.56. Use the user's category names as-is.
- Be concise and warm, like a sharp friend who's good with money. No disclaimers unless the user asks for advice that genuinely needs one (taxes, legal, specific securities to buy or sell) — then add one short line.
- Resolve relative dates ("last month", "this year") from today's date given below.`;

/** Atomically counts today's question against one bucket; false once its cap is reached. */
async function takeQuota(bucket: string, limit: number): Promise<boolean> {
  const id = `${new Date().toISOString().split("T")[0]}:${bucket}`;
  const row = await db.chatUsage.upsert({
    where: { id },
    create: { id, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit;
}

/** Owner: one daily pool. Demo: a per-IP cap first, then the shared demo pool. Fails closed. */
async function withinQuota(demo: boolean, req: Request): Promise<boolean> {
  try {
    if (!demo) return await takeQuota("owner", OWNER_DAILY_LIMIT);
    // Per-IP rows pile up; drop earlier days (ids start with the date, so they sort by day)
    await db.chatUsage.deleteMany({ where: { id: { lt: new Date().toISOString().split("T")[0] } } }).catch(() => {});
    return (
      (await takeQuota(`demo-ip:${clientIp(req)}`, DEMO_IP_DAILY_LIMIT)) &&
      (await takeQuota("demo", DEMO_DAILY_LIMIT))
    );
  } catch (err) {
    console.error("Ask quota check failed:", err);
    return false;
  }
}

export async function POST(req: Request) {
  const authError = await requireAuth({ allowDemo: true });
  if (authError) return authError;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const history = sanitizeHistory(body?.messages);
  if (!history) return Response.json({ error: "Ask a question to get started." }, { status: 400 });

  const demo = (await getSessionUsername())?.toLowerCase() === "demo";
  if (!(await withinQuota(demo, req))) {
    return Response.json({ error: "Daily question limit reached. It resets at midnight UTC." }, { status: 429 });
  }

  const client = new Anthropic();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Newline-delimited JSON events: {type:"text"|"status"|"done"|"error", ...}
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      // The answer exactly as the client assembles it, so it can be signed at the end
      let answer = "";
      const sendText = (text: string) => {
        answer += text;
        send({ type: "text", text });
      };
      let snapshot: AskSnapshot | null = null;
      const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

      let jsonRetries = 0;
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const response = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            // Refusal fallback: if the model declines, the API re-runs on a fallback model in the same call
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            // Sonnet 5.5 recalibrated effort; medium suits short multi-tool answers
            output_config: { effort: "medium" },
            // Stable instructions + tools are cached; the date sits after the breakpoint
            system: [
              { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
              { type: "text", text: `Today is ${today}.${demo ? " This is the demo profile (sample data for Alex Chen)." : ""}` },
            ],
            tools: ASK_TOOLS,
            messages,
          });

          response.on("text", (delta) => sendText(delta));
          let message: Anthropic.Beta.BetaMessage;
          try {
            message = await response.finalMessage();
            jsonRetries = 0;
          } catch (err) {
            // With eager input streaming a tool input can arrive as unparseable JSON;
            // re-issue that turn (the conversation so far is unchanged). API errors bubble up.
            if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
            turn--;
            continue;
          }

          if (message.stop_reason === "refusal") {
            sendText("\n\nI can't help with that one. Try asking about your spending, budgets, accounts, or investments.");
            break;
          }

          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (toolUses.length === 0) break; // end_turn / max_tokens on a text answer

          if (message.stop_reason === "max_tokens") {
            sendText("\n\n(That answer got too long. Try a narrower question.)");
            break;
          }

          messages.push({ role: "assistant", content: message.content });
          snapshot ??= await loadSnapshot(demo);

          // Run every requested tool, then return all results in one user message
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tool) => {
            send({ type: "status", text: TOOL_LABELS[tool.name] ?? "Working" });
            const { content, isError } = runAskTool(snapshot!, tool.name, tool.input);
            return { type: "tool_result", tool_use_id: tool.id, content, ...(isError ? { is_error: true } : {}) };
          });
          messages.push({ role: "user", content: results });
          send({ type: "break" });
          if (answer && !answer.endsWith("\n\n")) answer += "\n\n";
        }
        send({ type: "done", text: answer, sig: signAnswer(answer) });
      } catch (err) {
        console.error("Ask error:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        if (!(err instanceof Anthropic.RateLimitError)) {
          await reportError({ source: "Ask", message: errorText(err) });
        }
        // Anthropic explains request-level problems (e.g. no API credit left) in the error body
        const apiReason =
          err instanceof Anthropic.BadRequestError || err instanceof Anthropic.PermissionDeniedError
            ? (err.error as { error?: { message?: string } } | undefined)?.error?.message
            : undefined;
        const message =
          err instanceof Anthropic.RateLimitError
            ? "Ask is busy right now. Try again in a moment."
            : err instanceof Anthropic.AuthenticationError
              ? "The Anthropic API key isn't valid. Check ANTHROPIC_API_KEY."
              : apiReason
                ? `Ask couldn't answer: ${apiReason}`
                : "Something went wrong answering that. Please try again.";
        send({ type: "error", text: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Lets the UI show setup guidance instead of a broken chat. */
export async function GET() {
  const authError = await requireAuth({ allowDemo: true });
  if (authError) return authError;
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}
