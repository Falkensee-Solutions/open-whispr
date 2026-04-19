const https = require("https");
const http = require("http");
const { URL } = require("url");
const debugLogger = require("./debugLogger");

/**
 * Azure AI Foundry Agent Service — REST API client.
 *
 * Uses the Foundry project endpoint + API key to:
 *   - List agents created in the Foundry portal
 *   - Create / delete conversation threads
 *   - Stream chat responses from a named agent
 *
 * API reference:
 *   https://learn.microsoft.com/en-us/azure/foundry/quickstarts/get-started-code
 *   @azure/ai-projects SDK npm page (v2)
 */

const API_VERSION = "2025-11-15-preview";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Normalise the project endpoint so it always ends without a trailing slash.
 * The endpoint should be the full project URL, e.g.:
 *   https://resource.services.ai.azure.com/api/projects/MyProject
 * We append /openai/... per-request.
 */
function normaliseEndpoint(raw) {
  let base = (raw || "").replace(/\/+$/, "");
  // Strip /openai suffix if the user accidentally included it
  base = base.replace(/\/openai$/, "");
  return base;
}

/**
 * Makes a generic HTTPS request to the Foundry endpoint.
 * Returns { statusCode, headers, body }.
 */
function request(endpoint, apiKey, method, path, body) {
  return new Promise((resolve, reject) => {
    const base = normaliseEndpoint(endpoint);
    const separator = path.includes("?") ? "&" : "?";
    const fullUrl = `${base}/openai${path}${separator}api-version=${API_VERSION}`;

    let parsed;
    try {
      parsed = new URL(fullUrl);
    } catch (err) {
      return reject(new Error(`Invalid Foundry endpoint URL: ${fullUrl}`));
    }

    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          json = null;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json, raw });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * List prompt agents visible in the Foundry project.
 * GET /openai/agents/versions?api-version=…
 *
 * Returns an array of { id, name, version, description, model, instructions }.
 */
async function listAgents(endpoint, apiKey) {
  debugLogger.log("[foundry] Listing agents…");

  // Try the Agents list endpoint (project-scoped Foundry API)
  let res = await request(endpoint, apiKey, "GET", "/agents");

  if (res.statusCode === 404) {
    // Fall back to Assistants list endpoint
    debugLogger.log("[foundry] /agents returned 404, trying /assistants…");
    res = await request(endpoint, apiKey, "GET", "/assistants");
  }

  if (res.statusCode !== 200) {
    const msg = res.body?.error?.message || res.raw || `HTTP ${res.statusCode}`;
    throw new Error(`Failed to list Foundry agents: ${msg}`);
  }

  // The response is { data: [...] } for both list endpoints
  const agents = res.body?.data || res.body?.value || [];
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    version: a.version,
    description: a.instructions?.substring(0, 120) || "",
    model: a.model,
  }));
}

/**
 * Create a new conversation thread.
 * POST /openai/conversations
 *
 * Returns the conversation object { id }.
 */
async function createConversation(endpoint, apiKey) {
  debugLogger.log("[foundry] Creating conversation…");

  const res = await request(endpoint, apiKey, "POST", "/conversations", {});

  if (res.statusCode !== 200 && res.statusCode !== 201) {
    const msg = res.body?.error?.message || res.raw || `HTTP ${res.statusCode}`;
    throw new Error(`Failed to create Foundry conversation: ${msg}`);
  }

  return res.body;
}

/**
 * Delete a conversation thread.
 * DELETE /openai/conversations/{conversationId}
 */
async function deleteConversation(endpoint, apiKey, conversationId) {
  debugLogger.log("[foundry] Deleting conversation:", conversationId);
  const res = await request(endpoint, apiKey, "DELETE", `/conversations/${conversationId}`);

  if (res.statusCode !== 200 && res.statusCode !== 204) {
    const msg = res.body?.error?.message || res.raw || `HTTP ${res.statusCode}`;
    throw new Error(`Failed to delete Foundry conversation: ${msg}`);
  }
}

/**
 * Stream a response from a Foundry agent.
 *
 * POST /openai/responses  (with stream: true)
 *
 * Calls `onChunk(textDelta)` for each content delta.
 * Calls `onDone(fullText)` when the stream ends.
 * Calls `onError(err)` on failures.
 *
 * Returns an abort function.
 */
function streamMessage(endpoint, apiKey, conversationId, agentName, input, { onChunk, onDone, onError }) {
  const base = normaliseEndpoint(endpoint);
  const path = `/openai/responses?api-version=${API_VERSION}`;
  const fullUrl = `${base}${path}`;

  let parsed;
  try {
    parsed = new URL(fullUrl);
  } catch (err) {
    onError(new Error(`Invalid Foundry endpoint URL: ${fullUrl}`));
    return () => {};
  }

  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? https : http;

  const body = {
    stream: true,
    input,
  };

  if (conversationId) {
    body.conversation = conversationId;
  }

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    timeout: REQUEST_TIMEOUT_MS,
  };

  // Route to the named agent — field is "agent" per the SDK convention;
  // the object inside uses type: "agent_reference".
  const agentRef = { name: agentName, type: "agent_reference" };
  const mergedBody = { ...body, agent: agentRef };

  let fullText = "";
  let aborted = false;

  const req = transport.request(options, (res) => {
    if (res.statusCode !== 200) {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        let errMsg;
        try {
          const parsed = JSON.parse(raw);
          errMsg = parsed?.error?.message || raw;
        } catch {
          errMsg = raw;
        }
        if (!aborted) onError(new Error(`Foundry API error (${res.statusCode}): ${errMsg}`));
      });
      return;
    }

    let buffer = "";

    res.on("data", (chunk) => {
      if (aborted) return;
      buffer += chunk.toString("utf-8");

      // Process SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line for next chunk

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            if (!aborted) onDone(fullText);
            return;
          }
          try {
            const event = JSON.parse(data);

            // Extract text delta from various response formats
            // Format 1: responses API streaming { type: "response.output_text.delta", delta: "..." }
            if (event.type === "response.output_text.delta" && event.delta) {
              fullText += event.delta;
              onChunk(event.delta);
            }
            // Format 2: chat completions style { choices: [{ delta: { content: "..." } }] }
            else if (event.choices?.[0]?.delta?.content) {
              const text = event.choices[0].delta.content;
              fullText += text;
              onChunk(text);
            }
            // Format 3: response.completed with full output
            else if (event.type === "response.completed" && event.response?.output) {
              // Final event, extract any remaining text
              for (const item of event.response.output) {
                if (item.type === "message" && item.content) {
                  for (const part of item.content) {
                    if (part.type === "output_text" && part.text && !fullText.includes(part.text)) {
                      // Only emit if we haven't already streamed it
                      const remaining = part.text.slice(fullText.length);
                      if (remaining) {
                        fullText += remaining;
                        onChunk(remaining);
                      }
                    }
                  }
                }
              }
              if (!aborted) onDone(fullText);
            }
          } catch {
            // Skip unparseable SSE events
          }
        }
      }
    });

    res.on("end", () => {
      if (!aborted) onDone(fullText);
    });

    res.on("error", (err) => {
      if (!aborted) onError(err);
    });
  });

  req.on("timeout", () => {
    req.destroy();
    if (!aborted) onError(new Error("Foundry stream timed out"));
  });

  req.on("error", (err) => {
    if (!aborted) onError(err);
  });

  req.write(JSON.stringify(mergedBody));
  req.end();

  debugLogger.log("[foundry] Streaming message to agent:", agentName, "conversation:", conversationId);

  return () => {
    aborted = true;
    req.destroy();
  };
}

/**
 * Send a single (non-streaming) message to a Foundry agent.
 * Useful as a fallback if streaming is not supported.
 */
async function sendMessage(endpoint, apiKey, conversationId, agentName, input) {
  debugLogger.log("[foundry] Sending message to agent:", agentName);

  const body = { input };
  if (conversationId) {
    body.conversation = conversationId;
  }

  const res = await request(endpoint, apiKey, "POST", "/responses", {
    ...body,
    agent: { name: agentName, type: "agent_reference" },
  });

  if (res.statusCode !== 200) {
    const msg = res.body?.error?.message || res.raw || `HTTP ${res.statusCode}`;
    throw new Error(`Foundry agent error: ${msg}`);
  }

  // Extract text from response
  const output = res.body?.output || [];
  let text = res.body?.output_text || "";
  if (!text) {
    for (const item of output) {
      if (item.type === "message" && item.content) {
        for (const part of item.content) {
          if (part.type === "output_text") {
            text += part.text;
          }
        }
      }
    }
  }

  return { text, raw: res.body };
}

module.exports = {
  listAgents,
  createConversation,
  deleteConversation,
  streamMessage,
  sendMessage,
};
