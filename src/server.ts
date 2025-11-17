import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";

const model = openai("gpt-4o-2024-11-20");

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles manual messages sent by human agent and provides endpoints to view client requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Endpoint para obtener todos los mensajes (ver conversación completa)
    if (url.pathname === "/messages" && request.method === "GET") {
      try {
        return Response.json({
          messages: this.messages,
          total: this.messages.length
        });
      } catch (error) {
        console.error("Error getting messages:", error);
        return Response.json({ error: "Failed to get messages" }, { status: 500 });
      }
    }

    // Endpoint para obtener mensajes pendientes (mensajes del usuario sin respuesta)
    if (url.pathname === "/pending-messages" && request.method === "GET") {
      try {
        const pendingMessages = [];
        
        // Recorrer mensajes y encontrar los que son del usuario y no tienen respuesta siguiente
        for (let i = 0; i < this.messages.length; i++) {
          const message = this.messages[i];
          
          if (message.role === "user") {
            // Verificar si el siguiente mensaje es del asistente
            const nextMessage = this.messages[i + 1];
            const hasResponse = nextMessage?.role === "assistant";
            const waitingForHuman = message.metadata?.waitingForHuman === true;
            
            if (!hasResponse || waitingForHuman) {
              pendingMessages.push({
                id: message.id,
                text: message.parts
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join(""),
                createdAt: message.metadata?.createdAt || new Date(),
                waitingForHuman
              });
            }
          }
        }

        return Response.json({
          pendingMessages,
          count: pendingMessages.length
        });
      } catch (error) {
        console.error("Error getting pending messages:", error);
        return Response.json({ error: "Failed to get pending messages" }, { status: 500 });
      }
    }

    // Endpoint para marcar un mensaje como "esperando respuesta humana"
    if (url.pathname === "/mark-waiting-human" && request.method === "POST") {
      try {
        const body = await request.json<{ messageId: string }>();

        if (!body.messageId) {
          return Response.json(
            { error: "messageId is required" },
            { status: 400 }
          );
        }

        // Buscar el mensaje y actualizar su metadata
        const messageIndex = this.messages.findIndex(
          (m) => m.id === body.messageId
        );

        if (messageIndex === -1) {
          return Response.json({ error: "Message not found" }, { status: 404 });
        }

        const updatedMessages = [...this.messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          metadata: {
            ...updatedMessages[messageIndex].metadata,
            waitingForHuman: true
          }
        };

        await this.saveMessages(updatedMessages);

        return Response.json({ success: true });
      } catch (error) {
        console.error("Error marking message:", error);
        return Response.json({ error: "Failed to mark message" }, { status: 500 });
      }
    }

    // Endpoint para enviar mensaje manual como asistente (modo agente humano)
    if (url.pathname === "/manual-message" && request.method === "POST") {
      try {
        const body = await request.json<{ message: string; messageId?: string }>();

        if (!body.message) {
          return Response.json(
            { error: "message is required" },
            { status: 400 }
          );
        }

        // Guardar mensaje como asistente
        const newMessage = {
          id: generateId(),
          role: "assistant" as const,
          parts: [
            {
              type: "text" as const,
              text: body.message
            }
          ],
          metadata: {
            createdAt: new Date()
          }
        };

        await this.saveMessages([...this.messages, newMessage]);

        // Si se proporcionó messageId, marcar el mensaje original como respondido
        if (body.messageId) {
          const messageIndex = this.messages.findIndex(
            (m) => m.id === body.messageId
          );
          
          if (messageIndex !== -1) {
            const updatedMessages = [...this.messages, newMessage];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              metadata: {
                ...updatedMessages[messageIndex].metadata,
                waitingForHuman: false
              }
            };
            await this.saveMessages(updatedMessages);
          }
        }

        return Response.json({ success: true, messageId: newMessage.id });
      } catch (error) {
        console.error("Error in manual message:", error);
        return Response.json({ error: "Failed to save message" }, { status: 500 });
      }
    }

    // Delegate to parent class for other requests
    return super.fetch(request);
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Verificar si hay un mensaje pendiente de agente humano
    // Si el último mensaje del usuario tiene una flag especial, esperar respuesta humana
    const lastUserMessage = this.messages[this.messages.length - 1];
    const waitingForHuman = lastUserMessage?.metadata?.waitingForHuman;

    if (waitingForHuman) {
      // No generar respuesta de IA, esperar respuesta humana
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Simplemente retornar sin generar respuesta
          writer.write({
            type: "text-delta",
            textDelta: ""
          });
        }
      });
      return createUIMessageStreamResponse({ stream });
    }

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful AI assistant with access to various tools and capabilities.

Your capabilities include:
- Getting weather information for any city (requires user confirmation)
- Getting local time for different locations
- Scheduling tasks (one-time, delayed, or recurring via cron)
- Managing scheduled tasks (listing and canceling)

${getSchedulePrompt({ date: new Date() })}

Guidelines:
- Always be helpful, accurate, and concise
- When scheduling tasks, use the schedule tool appropriately
- If the user asks to schedule a task, use the schedule tool to schedule the task
- Provide clear explanations of what you're doing
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      // Check if OPENAI_API_KEY is available in the environment
      // In Cloudflare Workers, secrets are accessed via env object
      const hasOpenAIKey = !!(env as { OPENAI_API_KEY?: string })
        .OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });
    }

    // Endpoint para enviar mensajes manuales como asistente (modo agente humano)
    if (url.pathname === "/send-manual-message" && request.method === "POST") {
      try {
        const body = await request.json<{
          agentId: string;
          message: string;
          messageId?: string;
        }>();

        if (!body.agentId || !body.message) {
          return Response.json(
            { error: "agentId and message are required" },
            { status: 400 }
          );
        }

        // Obtener la instancia del agente
        const id = env.Chat.idFromName(body.agentId);
        const agent = env.Chat.get(id);

        // Enviar mensaje como asistente
        const response = await agent.fetch(
          new Request("https://agent/manual-message", {
            method: "POST",
            body: JSON.stringify({ 
              message: body.message,
              messageId: body.messageId 
            })
          })
        );

        return response;
      } catch (error) {
        console.error("Error sending manual message:", error);
        return Response.json(
          { error: "Failed to send manual message" },
          { status: 500 }
        );
      }
    }

    // Endpoint para obtener mensajes pendientes de un agente específico
    if (url.pathname === "/get-pending-messages" && request.method === "GET") {
      try {
        const agentId = url.searchParams.get("agentId");

        if (!agentId) {
          return Response.json(
            { error: "agentId query parameter is required" },
            { status: 400 }
          );
        }

        // Obtener la instancia del agente
        const id = env.Chat.idFromName(agentId);
        const agent = env.Chat.get(id);

        // Obtener mensajes pendientes
        const response = await agent.fetch(
          new Request("https://agent/pending-messages", {
            method: "GET"
          })
        );

        return response;
      } catch (error) {
        console.error("Error getting pending messages:", error);
        return Response.json(
          { error: "Failed to get pending messages" },
          { status: 500 }
        );
      }
    }

    // Endpoint para obtener todos los mensajes de un agente específico
    if (url.pathname === "/get-messages" && request.method === "GET") {
      try {
        const agentId = url.searchParams.get("agentId");

        if (!agentId) {
          return Response.json(
            { error: "agentId query parameter is required" },
            { status: 400 }
          );
        }

        // Obtener la instancia del agente
        const id = env.Chat.idFromName(agentId);
        const agent = env.Chat.get(id);

        // Obtener todos los mensajes
        const response = await agent.fetch(
          new Request("https://agent/messages", {
            method: "GET"
          })
        );

        return response;
      } catch (error) {
        console.error("Error getting messages:", error);
        return Response.json(
          { error: "Failed to get messages" },
          { status: 500 }
        );
      }
    }

    // Endpoint para marcar mensaje como esperando respuesta humana
    if (url.pathname === "/mark-waiting-human" && request.method === "POST") {
      try {
        const body = await request.json<{
          agentId: string;
          messageId: string;
        }>();

        if (!body.agentId || !body.messageId) {
          return Response.json(
            { error: "agentId and messageId are required" },
            { status: 400 }
          );
        }

        // Obtener la instancia del agente
        const id = env.Chat.idFromName(body.agentId);
        const agent = env.Chat.get(id);

        // Marcar mensaje como esperando respuesta humana
        const response = await agent.fetch(
          new Request("https://agent/mark-waiting-human", {
            method: "POST",
            body: JSON.stringify({ messageId: body.messageId })
          })
        );

        return response;
      } catch (error) {
        console.error("Error marking message:", error);
        return Response.json(
          { error: "Failed to mark message" },
          { status: 500 }
        );
      }
    }

    // Log warning if API key is not set (for development)
    if (!(env as { OPENAI_API_KEY?: string }).OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set. Set it locally in .dev.vars, and use `wrangler secret put OPENAI_API_KEY` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
