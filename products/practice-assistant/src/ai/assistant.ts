import Anthropic from "@anthropic-ai/sdk";
import type { ClientConfig } from "../config/schema.js";
import type { EmrAdapter } from "../emr/types.js";
import { buildSystemPrompt } from "./prompt.js";
import { buildTools, type HandoffSink } from "./tools.js";

export interface AssistantDeps {
  client: Anthropic;
  emr: EmrAdapter;
  handoff: HandoffSink;
}

/**
 * One PracticeAssistant per client config. Stateless across calls — the
 * caller owns conversation history (see server/sessions.ts) and passes it in.
 */
export class PracticeAssistant {
  private system: string;

  constructor(
    public readonly config: ClientConfig,
    private deps: AssistantDeps,
  ) {
    this.system = buildSystemPrompt(config);
  }

  /**
   * Run one chat turn. Returns the assistant's reply text and the updated
   * history (including any tool calls) for the caller to persist.
   */
  async chat(
    history: Anthropic.Beta.BetaMessageParam[],
    userMessage: string,
  ): Promise<{ reply: string; history: Anthropic.Beta.BetaMessageParam[] }> {
    const tools = buildTools(this.config, this.deps.emr, this.deps.handoff);
    const today = new Date().toISOString().slice(0, 10);

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    const runner = this.deps.client.beta.messages.toolRunner({
      model: this.config.model,
      max_tokens: 2048,
      // Stable per-client prefix cached; the date rides in a separate block after it
      system: [
        { type: "text", text: this.system, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Today's date is ${today}.` },
      ],
      tools,
      messages,
      max_iterations: 8,
    });

    const finalMessage = await runner.runUntilDone();

    const reply = finalMessage.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return {
      reply: reply || "Sorry — something went wrong on my end. Please call the office.",
      history: [...runner.params.messages],
    };
  }
}
