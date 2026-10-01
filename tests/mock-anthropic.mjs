#!/usr/bin/env node
// A tiny stand-in for the Anthropic Messages API used by end-to-end tests, so
// the full chat pipeline (streaming, tool use, persistence, retrieval) can be
// exercised without an API key or network. It never runs in the app itself.
//
//   PORT=54400 node tests/mock-anthropic.mjs
//
// Behaviour, keyed on the latest user text:
//   contains "remember that" -> short reply + a propose_memory tool call
//   a tool_result turn        -> confirms the suggestion is awaiting approval
//   otherwise                 -> echoes how many memories the context carried
// Every request body is appended to MOCK_LOG (if set) for assertions.

import fs from "node:fs";
import http from "node:http";

const port = Number(process.env.PORT || 54400);
const log = process.env.MOCK_LOG;

function textOf(content) {
  if (typeof content === "string") return content;
  return content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamReply(res, model, blocks, stopReason) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  sse(res, "message_start", {
    type: "message_start",
    message: { id: `msg_${Date.now()}`, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 42, output_tokens: 0 } },
  });
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      sse(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } });
      for (const piece of block.text.match(/.{1,12}/gs) ?? []) {
        sse(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: piece } });
      }
    } else {
      sse(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      sse(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index });
  });
  sse(res, "message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 30 } });
  sse(res, "message_stop", { type: "message_stop" });
  res.end();
}

function jsonReply(res, model, blocks, stopReason) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: `msg_${Date.now()}`, type: "message", role: "assistant", model, content: blocks, stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 42, output_tokens: 30 } }));
}

http
  .createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      if (log) fs.appendFileSync(log, JSON.stringify(body) + "\n");
      const model = body.model;
      const msgs = body.messages;
      const lastUserIndex = msgs.map((m) => m.role).lastIndexOf("user");
      const last = msgs[lastUserIndex];
      const isToolResult = Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
      const system = msgs.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n");
      const memoryCount = (system.match(/<memory /g) || []).length;

      // Structured-output calls (reflection / mirror) get a JSON answer.
      if (body.output_config?.format) {
        const ids = [...system.matchAll(/id="([0-9a-f-]{36})"/g), ...textOf(last.content).matchAll(/id="([0-9a-f-]{36})"/g)].map((m) => m[1]);
        const answer = {
          observations: ids.length
            ? [{ kind: "theme", label: "hypothesis", statement: "You return often to the question of meaningful work.", source_ids: [ids[0]] }]
            : [],
          questions: ["What would a good next small step look like?"],
        };
        return jsonReply(res, model, [{ type: "text", text: JSON.stringify(answer) }], "end_turn");
      }

      const blocks = [];
      let stop = "end_turn";
      if (isToolResult) {
        blocks.push({ type: "text", text: "I've suggested saving that; it's waiting for your approval." });
      } else {
        const said = textOf(last.content);
        if (/remember that/i.test(said)) {
          blocks.push({ type: "text", text: "That sounds important." });
          blocks.push({
            type: "tool_use",
            id: `toolu_${Date.now()}`,
            name: "propose_memory",
            input: { title: "Moving toward design research", body: said.replace(/.*remember that/i, "").trim(), kind: "goal", tags: ["career"], reason: "A decision about your work." },
          });
          stop = "tool_use";
        } else {
          blocks.push({ type: "text", text: `You said: ${said.slice(0, 80)}\n\nI was given **${memoryCount}** saved memories for this reply.` });
        }
      }
      if (body.stream) streamReply(res, model, blocks, stop);
      else jsonReply(res, model, blocks, stop);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`[mock-anthropic] listening on ${port}`));
