# API para Gestionar Mensajes de Clientes

Este documento explica cómo recibir y gestionar las solicitudes de mensajes que hacen los clientes.

## Flujo de Mensajes

1. **Cliente envía mensaje**: Los clientes envían mensajes a través del frontend (interfaz web)
2. **Mensaje llega al servidor**: El mensaje se recibe en el Durable Object `Chat` a través de `routeAgentRequest`
3. **Procesamiento**: El método `onChatMessage` procesa el mensaje y genera una respuesta (IA o espera respuesta humana)

## Endpoints Disponibles

### 1. Obtener Mensajes Pendientes

Obtiene todos los mensajes de clientes que aún no tienen respuesta del asistente.

**Endpoint**: `GET /get-pending-messages?agentId={agentId}`

**Ejemplo de uso**:
```bash
curl "http://localhost:8787/get-pending-messages?agentId=default-chat"
```

**Respuesta**:
```json
{
  "pendingMessages": [
    {
      "id": "msg-123",
      "text": "Hola, necesito ayuda con mi pedido",
      "createdAt": "2024-01-15T10:30:00Z",
      "waitingForHuman": false
    }
  ],
  "count": 1
}
```

### 2. Obtener Todos los Mensajes

Obtiene la conversación completa de un agente.

**Endpoint**: `GET /get-messages?agentId={agentId}`

**Ejemplo de uso**:
```bash
curl "http://localhost:8787/get-messages?agentId=default-chat"
```

**Respuesta**:
```json
{
  "messages": [
    {
      "id": "msg-123",
      "role": "user",
      "parts": [{"type": "text", "text": "Hola"}],
      "metadata": {"createdAt": "2024-01-15T10:30:00Z"}
    },
    {
      "id": "msg-124",
      "role": "assistant",
      "parts": [{"type": "text", "text": "Hola, ¿cómo puedo ayudarte?"}],
      "metadata": {"createdAt": "2024-01-15T10:30:05Z"}
    }
  ],
  "total": 2
}
```

### 3. Marcar Mensaje como Esperando Respuesta Humana

Marca un mensaje del cliente para que NO sea respondido automáticamente por la IA, esperando que un agente humano responda.

**Endpoint**: `POST /mark-waiting-human`

**Body**:
```json
{
  "agentId": "default-chat",
  "messageId": "msg-123"
}
```

**Ejemplo de uso**:
```bash
curl -X POST "http://localhost:8787/mark-waiting-human" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "default-chat",
    "messageId": "msg-123"
  }'
```

**Respuesta**:
```json
{
  "success": true
}
```

### 4. Enviar Respuesta Manual (Agente Humano)

Envía una respuesta como asistente, simulando que un agente humano está respondiendo.

**Endpoint**: `POST /send-manual-message`

**Body**:
```json
{
  "agentId": "default-chat",
  "message": "Hola, gracias por contactarnos. Te ayudo con tu pedido.",
  "messageId": "msg-123"
}
```

**Ejemplo de uso**:
```bash
curl -X POST "http://localhost:8787/send-manual-message" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "default-chat",
    "message": "Hola, gracias por contactarnos.",
    "messageId": "msg-123"
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "messageId": "msg-125"
}
```

## Cómo Obtener el agentId

El `agentId` es el identificador único de cada conversación. En el frontend, se obtiene usando:

```typescript
const agent = useAgent({ agent: "chat" });
const agentId = agent.id || "default-chat";
```

## Flujo Completo de Trabajo

### Escenario 1: Responder Manualmente a un Mensaje Específico

1. **Obtener mensajes pendientes**:
   ```bash
   GET /get-pending-messages?agentId=default-chat
   ```

2. **Marcar mensaje como esperando respuesta humana** (opcional, si quieres evitar que la IA responda):
   ```bash
   POST /mark-waiting-human
   {
     "agentId": "default-chat",
     "messageId": "msg-123"
   }
   ```

3. **Enviar respuesta manual**:
   ```bash
   POST /send-manual-message
   {
     "agentId": "default-chat",
     "message": "Tu respuesta aquí",
     "messageId": "msg-123"
   }
   ```

### Escenario 2: Monitoreo Continuo

Puedes crear un script que periódicamente consulte los mensajes pendientes:

```javascript
async function checkPendingMessages(agentId) {
  const response = await fetch(
    `http://localhost:8787/get-pending-messages?agentId=${agentId}`
  );
  const data = await response.json();
  
  if (data.count > 0) {
    console.log(`Hay ${data.count} mensajes pendientes:`);
    data.pendingMessages.forEach(msg => {
      console.log(`- ${msg.text} (${msg.id})`);
    });
  }
}

// Consultar cada 30 segundos
setInterval(() => checkPendingMessages("default-chat"), 30000);
```

## Notas Importantes

1. **agentId**: Cada conversación tiene un `agentId` único. Si no se especifica, se usa `"default-chat"`.

2. **Mensajes Pendientes**: Un mensaje se considera pendiente si:
   - Es del rol `"user"`
   - No tiene un mensaje siguiente del rol `"assistant"`
   - O está marcado con `waitingForHuman: true`

3. **Modo Esperando Humano**: Cuando un mensaje tiene `waitingForHuman: true`, el método `onChatMessage` no generará una respuesta automática de IA.

4. **Producción**: En producción, reemplaza `http://localhost:8787` con la URL de tu Worker desplegado en Cloudflare.

## Integración con Dashboard o Panel de Control

Puedes crear un dashboard separado que:
1. Consulte periódicamente `/get-pending-messages` para todos los agentes activos
2. Muestre una lista de mensajes pendientes
3. Permita al agente humano responder directamente desde el dashboard
4. Marque mensajes como "en proceso" o "resueltos"

Ejemplo de estructura de dashboard:
```typescript
// Dashboard component
function AgentDashboard() {
  const [pendingMessages, setPendingMessages] = useState([]);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(
        `/get-pending-messages?agentId=default-chat`
      );
      const data = await response.json();
      setPendingMessages(data.pendingMessages);
    }, 5000); // Cada 5 segundos
    
    return () => clearInterval(interval);
  }, []);
  
  // Renderizar lista de mensajes pendientes
  // Permitir responder a cada uno
}
```

