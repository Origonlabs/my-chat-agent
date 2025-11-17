/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useState, useEffect } from "react";
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";
import {
  Send20Regular,
  Search20Regular,
  Refresh20Regular,
  ArrowLeft20Regular
} from "@fluentui/react-icons";

interface PendingMessage {
  id: string;
  text: string;
  createdAt: string;
  waitingForHuman: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string; text: string }>;
  metadata: {
    createdAt: string;
  };
}

export default function Admin() {
  const [agentId, setAgentId] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [responseText, setResponseText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar mensajes pendientes
  const loadPendingMessages = async () => {
    if (!agentId.trim()) {
      setError("Por favor ingresa un Agent ID");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/get-pending-messages?agentId=${encodeURIComponent(agentId)}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setPendingMessages(data.pendingMessages || []);
      } else {
        setError(data.error || "Error al cargar mensajes");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar todos los mensajes
  const loadAllMessages = async () => {
    if (!agentId.trim()) {
      setError("Por favor ingresa un Agent ID");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/get-messages?agentId=${encodeURIComponent(agentId)}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setAllMessages(data.messages || []);
      } else {
        setError(data.error || "Error al cargar mensajes");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Enviar respuesta manual
  const sendManualResponse = async () => {
    if (!agentId.trim() || !responseText.trim()) {
      setError("Agent ID y mensaje son requeridos");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/send-manual-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          message: responseText,
          messageId: selectedMessageId || undefined
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResponseText("");
        setSelectedMessageId(null);
        // Recargar mensajes
        await loadPendingMessages();
        await loadAllMessages();
      } else {
        setError(data.error || "Error al enviar mensaje");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Marcar como esperando respuesta humana
  const markWaitingHuman = async (messageId: string) => {
    if (!agentId.trim()) {
      setError("Agent ID es requerido");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/mark-waiting-human", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          messageId
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        await loadPendingMessages();
      } else {
        setError(data.error || "Error al marcar mensaje");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Panel de Administración de Chats
            </h1>
            <Button
              onClick={() => {
                window.location.href = "/";
              }}
              variant="ghost"
              tooltip="Volver al Chat"
            >
              <ArrowLeft20Regular className="w-4 h-4 mr-2" />
              Volver al Chat
            </Button>
          </div>

          {/* Buscar conversación */}
          <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Agent ID (ID de Conversación)
                </label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Ingresa el ID de la conversación (ej: UUID)"
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      loadPendingMessages();
                    }
                  }}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  El Agent ID se encuentra en la URL del chat: <code>?chat=AGENT-ID</code>
                </p>
              </div>
              <Button
                onClick={loadPendingMessages}
                disabled={loading || !agentId.trim()}
                variant="primary"
              >
                <Search20Regular className="w-4 h-4 mr-2" />
                Buscar Pendientes
              </Button>
              <Button
                onClick={loadAllMessages}
                disabled={loading || !agentId.trim()}
                variant="secondary"
              >
                <Refresh20Regular className="w-4 h-4 mr-2" />
                Ver Todo
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mensajes Pendientes */}
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Mensajes Pendientes ({pendingMessages.length})
              </h2>
              
              {pendingMessages.length === 0 ? (
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                  No hay mensajes pendientes
                </p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {pendingMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                        {msg.waitingForHuman && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                            Esperando Humano
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-900 dark:text-white mb-2">
                        {msg.text}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedMessageId(msg.id);
                            setResponseText("");
                          }}
                          variant="primary"
                          size="sm"
                        >
                          Responder
                        </Button>
                        {!msg.waitingForHuman && (
                          <Button
                            onClick={() => markWaitingHuman(msg.id)}
                            variant="secondary"
                            size="sm"
                          >
                            Marcar como Esperando
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Responder / Ver Conversación */}
            <div className="space-y-4">
              {/* Formulario de respuesta */}
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                  {selectedMessageId ? "Responder a Mensaje" : "Enviar Mensaje Manual"}
                </h2>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="mb-3 min-h-[100px]"
                  disabled={loading || !agentId.trim()}
                />
                <Button
                  onClick={sendManualResponse}
                  disabled={loading || !agentId.trim() || !responseText.trim()}
                  variant="primary"
                  className="w-full"
                >
                  <Send20Regular className="w-4 h-4 mr-2" />
                  Enviar Respuesta
                </Button>
                {selectedMessageId && (
                  <Button
                    onClick={() => {
                      setSelectedMessageId(null);
                      setResponseText("");
                    }}
                    variant="ghost"
                    className="w-full mt-2"
                  >
                    Cancelar
                  </Button>
                )}
              </div>

              {/* Historial completo */}
              {allMessages.length > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Historial Completo ({allMessages.length} mensajes)
                  </h2>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
                    {allMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-lg text-sm ${
                          msg.role === "user"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                        }`}
                      >
                        <div className="font-semibold mb-1">
                          {msg.role === "user" ? "👤 Usuario" : "🤖 Asistente"}
                        </div>
                        <div>
                          {msg.parts
                            ?.filter((p) => p.type === "text")
                            .map((p, i) => (
                              <div key={i}>{(p as { text: string }).text}</div>
                            ))}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.metadata?.createdAt || Date.now()).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

