# Ejemplo de Dashboard para Gestionar Mensajes

Este documento muestra cómo crear un dashboard separado que se conecte a la API para gestionar mensajes.

## Arquitectura

```
┌─────────────────┐         HTTP/REST API        ┌──────────────────┐
│   Dashboard     │ ───────────────────────────> │  Chat Agent API  │
│  (React/Vue/etc)│                               │  (Cloudflare)    │
└─────────────────┘                               └──────────────────┘
```

## Configuración del Dashboard

### 1. Variables de Entorno

Crea un archivo `.env` en tu proyecto dashboard:

```env
VITE_API_URL=http://localhost:8787
# O en producción:
# VITE_API_URL=https://tu-worker.cloudflareworkers.com
```

### 2. Servicio API (JavaScript/TypeScript)

Crea un archivo `src/services/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface PendingMessage {
  id: string;
  text: string;
  createdAt: string;
  waitingForHuman: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: string; text: string }>;
  metadata: {
    createdAt: Date;
  };
}

class ChatAPI {
  /**
   * Obtener mensajes pendientes de un agente
   */
  async getPendingMessages(agentId: string): Promise<{
    pendingMessages: PendingMessage[];
    count: number;
  }> {
    const response = await fetch(
      `${API_URL}/get-pending-messages?agentId=${agentId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch pending messages');
    }
    
    return response.json();
  }

  /**
   * Obtener todos los mensajes de un agente
   */
  async getMessages(agentId: string): Promise<{
    messages: Message[];
    total: number;
  }> {
    const response = await fetch(
      `${API_URL}/get-messages?agentId=${agentId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }

  /**
   * Marcar mensaje como esperando respuesta humana
   */
  async markWaitingHuman(agentId: string, messageId: string): Promise<void> {
    const response = await fetch(`${API_URL}/mark-waiting-human`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId, messageId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark message');
    }
  }

  /**
   * Enviar respuesta manual como agente humano
   */
  async sendManualMessage(
    agentId: string,
    message: string,
    messageId?: string
  ): Promise<{ success: boolean; messageId: string }> {
    const response = await fetch(`${API_URL}/send-manual-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        message,
        messageId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send manual message');
    }
    
    return response.json();
  }
}

export const chatAPI = new ChatAPI();
```

## Ejemplo de Componente React

### Dashboard Principal

```typescript
// src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { chatAPI, type PendingMessage } from '../services/api';

export function Dashboard() {
  const [agentId, setAgentId] = useState('default-chat');
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  // Cargar mensajes pendientes
  const loadPendingMessages = async () => {
    setLoading(true);
    try {
      const data = await chatAPI.getPendingMessages(agentId);
      setPendingMessages(data.pendingMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      alert('Error al cargar mensajes');
    } finally {
      setLoading(false);
    }
  };

  // Cargar automáticamente cada 10 segundos
  useEffect(() => {
    loadPendingMessages();
    const interval = setInterval(loadPendingMessages, 10000);
    return () => clearInterval(interval);
  }, [agentId]);

  // Marcar como esperando respuesta humana
  const handleMarkWaiting = async (messageId: string) => {
    try {
      await chatAPI.markWaitingHuman(agentId, messageId);
      await loadPendingMessages(); // Recargar
      alert('Mensaje marcado como esperando respuesta humana');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al marcar mensaje');
    }
  };

  // Enviar respuesta
  const handleSendResponse = async () => {
    if (!responseText.trim() || !selectedMessage) return;

    try {
      await chatAPI.sendManualMessage(agentId, responseText, selectedMessage);
      setResponseText('');
      setSelectedMessage(null);
      await loadPendingMessages(); // Recargar
      alert('Respuesta enviada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al enviar respuesta');
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Dashboard de Mensajes</h1>
        <div>
          <label>
            Agent ID:
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
          </label>
          <button onClick={loadPendingMessages} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      <div className="messages-section">
        <h2>Mensajes Pendientes ({pendingMessages.length})</h2>
        
        {pendingMessages.length === 0 ? (
          <p>No hay mensajes pendientes</p>
        ) : (
          <div className="messages-list">
            {pendingMessages.map((msg) => (
              <div key={msg.id} className="message-card">
                <div className="message-header">
                  <span className="message-id">ID: {msg.id}</span>
                  <span className="message-date">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="message-text">{msg.text}</p>
                <div className="message-actions">
                  <button
                    onClick={() => setSelectedMessage(msg.id)}
                    className="btn-respond"
                  >
                    Responder
                  </button>
                  <button
                    onClick={() => handleMarkWaiting(msg.id)}
                    className="btn-mark"
                    disabled={msg.waitingForHuman}
                  >
                    {msg.waitingForHuman
                      ? 'Esperando Humano'
                      : 'Marcar como Esperando'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMessage && (
        <div className="response-section">
          <h3>Responder a mensaje: {selectedMessage}</h3>
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Escribe tu respuesta aquí..."
            rows={5}
          />
          <div className="response-actions">
            <button onClick={handleSendResponse} className="btn-send">
              Enviar Respuesta
            </button>
            <button
              onClick={() => {
                setSelectedMessage(null);
                setResponseText('');
              }}
              className="btn-cancel"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Ejemplo con Estilos (CSS)

```css
/* src/styles/dashboard.css */
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.messages-section {
  margin-bottom: 30px;
}

.messages-list {
  display: grid;
  gap: 15px;
}

.message-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: #f9f9f9;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.9em;
  color: #666;
}

.message-text {
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.message-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-respond,
.btn-mark,
.btn-send,
.btn-cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-respond {
  background: #007bff;
  color: white;
}

.btn-mark {
  background: #ffc107;
  color: black;
}

.btn-send {
  background: #28a745;
  color: white;
}

.btn-cancel {
  background: #6c757d;
  color: white;
}

.response-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 20px;
  border-top: 2px solid #ddd;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.response-section textarea {
  width: 100%;
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.response-actions {
  display: flex;
  gap: 10px;
}
```

## Estructura del Proyecto Dashboard

```
dashboard-proyecto/
├── src/
│   ├── components/
│   │   └── Dashboard.tsx
│   ├── services/
│   │   └── api.ts
│   ├── styles/
│   │   └── dashboard.css
│   └── App.tsx
├── .env
├── package.json
└── vite.config.ts
```

## Instalación Rápida

```bash
# Crear nuevo proyecto React
npm create vite@latest dashboard-proyecto -- --template react-ts

cd dashboard-proyecto

# Instalar dependencias
npm install

# Agregar archivo .env
echo "VITE_API_URL=http://localhost:8787" > .env

# Copiar los archivos de ejemplo (api.ts, Dashboard.tsx, etc.)

# Ejecutar
npm run dev
```

## Características Adicionales que Puedes Agregar

1. **Múltiples Agentes**: Lista de todos los agentes activos
2. **Filtros**: Filtrar por fecha, estado, etc.
3. **Búsqueda**: Buscar en el historial de mensajes
4. **Notificaciones**: Alertas cuando hay nuevos mensajes
5. **Estadísticas**: Dashboard con métricas (mensajes por día, tiempo de respuesta, etc.)
6. **Autenticación**: Login para proteger el dashboard
7. **WebSockets**: Actualización en tiempo real (si implementas WebSockets en el backend)

## CORS (Si es necesario)

Si tu dashboard está en un dominio diferente, necesitarás configurar CORS en el Worker:

```typescript
// En src/server.ts, agregar headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O tu dominio específico
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// En cada respuesta, agregar:
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

## Ejemplo con Next.js

Si prefieres Next.js:

```typescript
// app/api/messages/route.ts (Server Component)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  
  const response = await fetch(
    `${process.env.API_URL}/get-pending-messages?agentId=${agentId}`
  );
  
  const data = await response.json();
  return Response.json(data);
}
```

¡El dashboard puede estar en cualquier tecnología: React, Vue, Angular, Next.js, o incluso una aplicación móvil!

