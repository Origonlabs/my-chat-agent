/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";

// Icon imports
import {
  Bug20Regular,
  WeatherMoon20Regular,
  Bot20Regular,
  WeatherSunny20Regular,
  Send20Regular,
  Stop20Regular,
  Chat48Regular,
  Dismiss20Regular,
  Maximize20Regular,
  Person20Regular,
  Add20Regular,
  Copy20Regular,
  Checkmark20Regular
} from "@fluentui/react-icons";

// List of tools that require human confirmation
// NOTE: this should match the tools that don't have execute functions in tools.ts
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation"
];

// Función para generar o obtener un ID único de conversación desde la URL
function getConversationId(): string {
  // Verificar si hay un ID en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlChatId = urlParams.get("chat");
  
  if (urlChatId) {
    // Si hay un ID en la URL, usarlo
    return urlChatId;
  }
  
  // Si no hay ID en la URL, generar uno nuevo y agregarlo a la URL
  const newChatId = crypto.randomUUID();
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set("chat", newChatId);
  // Actualizar la URL sin recargar la página
  window.history.replaceState({}, "", newUrl.toString());
  
  return newChatId;
}

export default function Chat() {
  // Generar o obtener ID único de conversación desde la URL
  const [conversationId] = useState<string>(() => getConversationId());
  
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [showPrivacyBanner, setShowPrivacyBanner] = useState(true);
  const [humanAgentMode, setHumanAgentMode] = useState(false);
  const [agentResponseInput, setAgentResponseInput] = useState("");
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  // Usar el ID único de conversación como name para crear una instancia privada del agente
  const agent = useAgent({
    agent: "chat",
    name: conversationId
  });

  // Función para enviar mensaje manual como agente humano
  const sendManualAgentMessage = async (message: string) => {
    if (!message.trim()) return;

    try {
      // Usar el ID único de conversación
      const agentId = conversationId;

      const response = await fetch("/send-manual-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          message
        })
      });

      if (!response.ok) {
        throw new Error("Failed to send manual message");
      }

      // Recargar mensajes para mostrar el nuevo mensaje
      // El hook useAgentChat debería actualizarse automáticamente
      setAgentResponseInput("");
    } catch (error) {
      console.error("Error sending manual message:", error);
      alert("Error al enviar mensaje. Por favor intenta de nuevo.");
    }
  };

  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (
    e: React.FormEvent,
    extraData: Record<string, unknown> = {}
  ) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    // Send message to agent
    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: extraData
      }
    );
  };

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Scroll to bottom when messages change or when status changes (para el indicador "escribiendo...")
  useEffect(() => {
    if (agentMessages.length > 0 || status === "streaming" || status === "submitted") {
      scrollToBottom();
    }
  }, [agentMessages, status, scrollToBottom]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "input-available" &&
        // Manual check inside the component
        toolsRequiringConfirmation.includes(
          part.type.replace("tool-", "") as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Estado para controlar qué mensaje se copió
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Función para copiar mensaje al portapapeles
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      // Resetear después de 2 segundos
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      // Fallback para navegadores antiguos
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Función para crear una nueva conversación
  const createNewConversation = () => {
    if (confirm("¿Estás seguro de que quieres crear una nueva conversación? La conversación actual se guardará.")) {
      const newChatId = crypto.randomUUID();
      // Recargar la página con el nuevo ID en la URL
      window.location.href = `/?chat=${newChatId}`;
    }
  };

  return (
    <div className="h-[100vh] w-full flex justify-center items-center overflow-hidden bg-neutral-100 dark:bg-black p-2">
      <HasOpenAIKey />
      <div className="h-[calc(100vh-1rem)] w-full max-w-md mx-auto flex flex-col bg-white dark:bg-neutral-900 relative rounded-2xl overflow-hidden shadow-2xl">
        {/* Header minimalista */}
        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 rounded-t-2xl">
          <h2 className="text-neutral-900 dark:text-white font-medium text-base">
            Support Chat
          </h2>
          <div className="flex items-center gap-2">
            {showDebug && (
              <div className="flex items-center gap-2 mr-2">
                <Bug20Regular className="text-neutral-600 dark:text-neutral-400" />
                <Toggle
                  toggled={showDebug}
                  aria-label="Toggle debug mode"
                  onClick={() => setShowDebug((prev) => !prev)}
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="md"
              shape="square"
              className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center p-0"
              onClick={createNewConversation}
              tooltip="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <Add20Regular className="w-5 h-5 text-[#007AFF] dark:text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="md"
              shape="square"
              className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center p-0"
              onClick={toggleTheme}
              tooltip="Cambiar tema"
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? (
                <WeatherSunny20Regular className="w-5 h-5 text-[#007AFF] dark:text-blue-400" />
              ) : (
                <WeatherMoon20Regular className="w-5 h-5 text-[#007AFF] dark:text-blue-400" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="md"
              shape="square"
              className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center p-0"
              onClick={() => {}}
              tooltip="Maximizar"
              aria-label="Maximizar"
            >
              <Maximize20Regular className="w-5 h-5 text-[#007AFF] dark:text-blue-400" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 scroll-smooth scrollbar-hide">
          {agentMessages.length === 0 && (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-2 border-neutral-300 dark:border-neutral-600 flex items-center justify-center">
                      <Chat48Regular className="text-neutral-400 dark:text-neutral-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-neutral-300 dark:bg-neutral-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white dark:bg-black rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-neutral-900 dark:text-white text-xl font-medium">
                    How can we help you?
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    Start a conversation to get help.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 pb-24">
            {agentMessages.map((m, index) => {
              const isUser = m.role === "user";
              const prevMessage = index > 0 ? agentMessages[index - 1] : null;
              const isSameSender = prevMessage?.role === m.role;
              const showSpacing = !isSameSender;

              return (
                <div 
                  key={m.id} 
                  className={`animate-fade-in ${showSpacing ? "mt-4" : "mt-1"}`}
                >
                  {showDebug && (
                    <pre className="text-xs text-neutral-600 dark:text-neutral-400 overflow-scroll mb-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded">
                      {JSON.stringify(m, null, 2)}
                    </pre>
                  )}
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"} items-end`}
                  >
                    <div
                      className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
                    >
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                            <div key={i} className="group relative">
                              <div
                                className={`px-3.5 py-2 rounded-2xl ${
                                  isUser
                                    ? "bg-[#007AFF] text-white rounded-br-sm shadow-sm"
                                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-sm"
                                } ${
                                  part.text.startsWith("scheduled message")
                                    ? "border-2 border-[#F48120]/50"
                                    : ""
                                } relative`}
                                style={{
                                  wordBreak: "break-word",
                                  overflowWrap: "break-word"
                                }}
                              >
                                {part.text.startsWith("scheduled message") && (
                                  <span className="absolute -top-2 -left-2 text-xl bg-neutral-900 rounded-full p-1">
                                    🕒
                                  </span>
                                )}
                                <div
                                  className={
                                    isUser
                                      ? "prose prose-invert prose-sm max-w-none text-white [&_*]:text-white [&_a]:text-blue-200 [&_a:hover]:text-blue-100"
                                      : "prose prose-sm dark:prose-invert max-w-none text-neutral-900 dark:text-neutral-100 [&_*]:text-neutral-900 dark:[&_*]:text-neutral-100"
                                  }
                                >
                                  <MemoizedMarkdown
                                    id={`${m.id}-${i}`}
                                    content={part.text.replace(
                                      /^scheduled message: /,
                                      ""
                                    )}
                                  />
                                </div>
                              </div>
                              {/* Botón de copiar - visible en hover */}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(part.text, `${m.id}-${i}`)}
                                className={`absolute ${
                                  isUser ? "left-0 -translate-x-10" : "right-0 translate-x-10"
                                } top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100`}
                                title="Copiar mensaje"
                                aria-label="Copiar mensaje"
                              >
                                {copiedMessageId === `${m.id}-${i}` ? (
                                  <Checkmark20Regular className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Copy20Regular className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          );
                        }

                        if (
                          isToolUIPart(part) &&
                          m.id.startsWith("assistant")
                        ) {
                          const toolCallId = part.toolCallId;
                          const toolName = part.type.replace("tool-", "");
                          const needsConfirmation =
                            toolsRequiringConfirmation.includes(
                              toolName as keyof typeof tools
                            );

                          // Skip rendering the card in debug mode
                          if (showDebug) return null;

                          return (
                            <ToolInvocationCard
                              // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here as the array is static
                              key={`${toolCallId}-${i}`}
                              toolUIPart={part}
                              toolCallId={toolCallId}
                              needsConfirmation={needsConfirmation}
                              onSubmit={({ toolCallId, result }) => {
                                addToolResult({
                                  tool: part.type.replace("tool-", ""),
                                  toolCallId,
                                  output: result
                                });
                              }}
                              addToolResult={(toolCallId, result) => {
                                addToolResult({
                                  tool: part.type.replace("tool-", ""),
                                  toolCallId,
                                  output: result
                                });
                              }}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Indicador "escribiendo..." cuando la IA está generando respuesta */}
            {(() => {
              // Verificar si el último mensaje es del asistente y tiene contenido completo
              const lastMessage = agentMessages[agentMessages.length - 1];
              const lastMessageIsAssistant = lastMessage?.role === "assistant";
              
              // Verificar si el mensaje del asistente tiene contenido significativo
              const hasCompleteText = lastMessageIsAssistant && 
                lastMessage.parts?.some(p => {
                  if (p.type === "text") {
                    const text = (p as { text: string }).text;
                    // Considerar completo si tiene al menos 5 caracteres
                    return text && text.trim().length >= 5;
                  }
                  return false;
                });
              
              // Solo mostrar si:
              // 1. Está en estado "streaming" (no "submitted" porque ese es el estado inicial)
              // 2. El último mensaje es del usuario O no hay mensaje del asistente completo
              const shouldShowTyping = status === "streaming" && 
                (!lastMessageIsAssistant || !hasCompleteText);
              
              return shouldShowTyping ? (
                <div className="animate-fade-in mt-4 flex justify-start items-end">
                  <div className="flex flex-col max-w-[75%] items-start">
                    <div className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">Escribiendo</span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Privacy Banner */}
        {showPrivacyBanner && (
          <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 flex-1">
              Chats are recorded to improve the service and are processed in
              accordance with our{" "}
              <button
                type="button"
                className="underline hover:text-neutral-300"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Open privacy policy
                }}
              >
                Privacy Policy.
              </button>
            </p>
            <button
              type="button"
              onClick={() => setShowPrivacyBanner(false)}
              className="ml-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-300"
              aria-label="Dismiss privacy banner"
            >
              <Dismiss20Regular />
            </button>
          </div>
        )}

        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e);
            setTextareaHeight("auto");
          }}
          className="p-4 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 rounded-b-2xl"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={
                  pendingToolCallConfirmation
                    ? "Please respond to the tool confirmation above..."
                    : "Ask a question to get started..."
                }
                className="flex w-full px-4 py-3 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 text-sm min-h-[44px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 focus-visible:border-blue-500 dark:focus-visible:border-blue-500/50 focus-visible:bg-white dark:focus-visible:bg-neutral-900 transition-all shadow-sm"
                value={agentInput}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto");
                  }
                }}
                rows={1}
                style={{ height: textareaHeight }}
              />
            </div>
            {status === "submitted" || status === "streaming" ? (
              <button
                type="button"
                onClick={stop}
                className="flex items-center justify-center w-10 h-10 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-white transition-colors rounded-lg"
                aria-label="Stop generation"
              >
                <Stop20Regular />
              </button>
            ) : (
              <button
                type="submit"
                className="flex items-center justify-center w-10 h-10 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                disabled={pendingToolCallConfirmation || !agentInput.trim()}
                aria-label="Send message"
              >
                <Send20Regular />
              </button>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 py-2 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 text-center rounded-b-2xl">
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            Powered by{" "}
            <span className="inline-flex items-center gap-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 80 79"
                className="text-neutral-500"
                fill="currentColor"
              >
                <path d="M69.3 39.7c-3.1 0-5.8 2.1-6.7 5H48.3V34h4.6l4.5-2.5c1.1.8 2.5 1.2 3.9 1.2 3.8 0 7-3.1 7-7s-3.1-7-7-7-7 3.1-7 7c0 .9.2 1.8.5 2.6L51.9 30h-3.5V18.8h-.1c-1.3-1-2.9-1.6-4.5-1.9h-.2c-1.9-.3-3.9-.1-5.8.6-.4.1-.8.3-1.2.5h-.1c-.1.1-.2.1-.3.2-1.7 1-3 2.4-4 4 0 .1-.1.2-.1.2l-.3.6c0 .1-.1.1-.1.2v.1h-.6c-2.9 0-5.7 1.2-7.7 3.2-2.1 2-3.2 4.8-3.2 7.7 0 .7.1 1.4.2 2.1-1.3.9-2.4 2.1-3.2 3.5s-1.2 2.9-1.4 4.5c-.1 1.6.1 3.2.7 4.7s1.5 2.9 2.6 4c-.8 1.8-1.2 3.7-1.1 5.6 0 1.9.5 3.8 1.4 5.6s2.1 3.2 3.6 4.4c1.3 1 2.7 1.7 4.3 2.2v-.1q2.25.75 4.8.6h.1c0 .1.1.1.1.1.9 1.7 2.3 3 4 4 .1.1.2.1.3.2h.1c.4.2.8.4 1.2.5 1.4.6 3 .8 4.5.7.4 0 .8-.1 1.3-.1h.1c1.6-.3 3.1-.9 4.5-1.9V62.9h3.5l3.1 1.7c-.3.8-.5 1.7-.5 2.6 0 3.8 3.1 7 7 7s7-3.1 7-7-3.1-7-7-7c-1.5 0-2.8.5-3.9 1.2l-4.6-2.5h-4.6V48.7h14.3c.9 2.9 3.5 5 6.7 5 3.8 0 7-3.1 7-7s-3.1-7-7-7m-7.9-16.9c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3m0 41.4c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3M44.3 72c-.4.2-.7.3-1.1.3-.2 0-.4.1-.5.1h-.2c-.9.1-1.7 0-2.6-.3-1-.3-1.9-.9-2.7-1.7-.7-.8-1.3-1.7-1.6-2.7l-.3-1.5v-.7q0-.75.3-1.5c.1-.2.1-.4.2-.7s.3-.6.5-.9c0-.1.1-.1.1-.2.1-.1.1-.2.2-.3s.1-.2.2-.3c0 0 0-.1.1-.1l.6-.6-2.7-3.5c-1.3 1.1-2.3 2.4-2.9 3.9-.2.4-.4.9-.5 1.3v.1c-.1.2-.1.4-.1.6-.3 1.1-.4 2.3-.3 3.4-.3 0-.7 0-1-.1-2.2-.4-4.2-1.5-5.5-3.2-1.4-1.7-2-3.9-1.8-6.1q.15-1.2.6-2.4l.3-.6c.1-.2.2-.4.3-.5 0 0 0-.1.1-.1.4-.7.9-1.3 1.5-1.9 1.6-1.5 3.8-2.3 6-2.3q1.05 0 2.1.3v-4.5c-.7-.1-1.4-.2-2.1-.2-1.8 0-3.5.4-5.2 1.1-.7.3-1.3.6-1.9 1s-1.1.8-1.7 1.3c-.3.2-.5.5-.8.8-.6-.8-1-1.6-1.3-2.6-.2-1-.2-2 0-2.9.2-1 .6-1.9 1.3-2.6.6-.8 1.4-1.4 2.3-1.8l1.8-.9-.7-1.9c-.4-1-.5-2.1-.4-3.1s.5-2.1 1.1-2.9q.9-1.35 2.4-2.1c.9-.5 2-.8 3-.7.5 0 1 .1 1.5.2 1 .2 1.8.7 2.6 1.3s1.4 1.4 1.8 2.3l4.1-1.5c-.9-2-2.3-3.7-4.2-4.9q-.6-.3-.9-.6c.4-.7 1-1.4 1.6-1.9.8-.7 1.8-1.1 2.9-1.3.9-.2 1.7-.1 2.6 0 .4.1.7.2 1.1.3V72zm25-22.3c-1.6 0-3-1.3-3-3 0-1.6 1.3-3 3-3s3 1.3 3 3c0 1.6-1.3 3-3 3" />
              </svg>
              Cloudflare Agents
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function HasOpenAIKey() {
  const [hasOpenAiKey, setHasOpenAiKey] = useState<{ success: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/check-open-ai-key")
      .then((res) => res.json<{ success: boolean }>())
      .then((data) => {
        setHasOpenAiKey(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error checking OpenAI key:", error);
        setHasOpenAiKey({ success: false });
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return null;
  }

  if (!hasOpenAiKey?.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
