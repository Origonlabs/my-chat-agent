# Cómo Administrar los Chats

## 🎯 Acceso al Panel de Administración

### Opción 1: Desde el Chat Principal
1. Abre el chat en tu navegador
2. Haz clic en el icono de **⚙️ Configuración** (primer icono azul en el header)
3. Serás redirigido al panel de administración

### Opción 2: URL Directa
Accede directamente a:
```
http://localhost:8787/admin
```
O en producción:
```
https://tu-dominio.com/admin
```

---

## 📋 Funcionalidades del Panel

### 1. Buscar Conversación
- Ingresa el **Agent ID** (ID de conversación)
- El Agent ID se encuentra en la URL del chat: `?chat=AGENT-ID`
- Haz clic en **"Buscar Pendientes"** para ver mensajes sin respuesta
- Haz clic en **"Ver Todo"** para ver el historial completo

### 2. Ver Mensajes Pendientes
- Lista todos los mensajes de clientes que aún no tienen respuesta
- Muestra:
  - Texto del mensaje
  - Fecha y hora
  - Estado (si está esperando respuesta humana)

### 3. Responder Manualmente
- Haz clic en **"Responder"** en cualquier mensaje pendiente
- Escribe tu respuesta en el textarea
- Haz clic en **"Enviar Respuesta"**
- El mensaje aparecerá como si fuera del asistente

### 4. Marcar como "Esperando Respuesta Humana"
- Evita que la IA responda automáticamente
- Haz clic en **"Marcar como Esperando"** en un mensaje
- El mensaje quedará marcado y la IA no responderá

### 5. Ver Historial Completo
- Muestra toda la conversación
- Incluye mensajes del usuario y del asistente
- Útil para entender el contexto completo

---

## 🔑 Cómo Obtener el Agent ID

El **Agent ID** es el identificador único de cada conversación. Lo puedes encontrar de dos formas:

### Método 1: Desde la URL del Chat
Cuando un cliente abre el chat, la URL será:
```
http://localhost:8787/?chat=abc123-def456-ghi789
                                    ↑
                            Este es el Agent ID
```

### Método 2: Desde el Código
Si tienes acceso al código del cliente, el Agent ID se genera automáticamente y se guarda en la URL.

---

## 📝 Ejemplo de Uso

### Escenario: Cliente necesita ayuda

1. **Cliente envía mensaje**: "Necesito ayuda con mi pedido #12345"
2. **Tú recibes notificación** (o revisas el panel manualmente)
3. **Accedes al panel**: `http://localhost:8787/admin`
4. **Buscas la conversación**: Ingresas el Agent ID del cliente
5. **Ves el mensaje pendiente**: Aparece en la lista
6. **Respondes manualmente**: 
   - Clic en "Responder"
   - Escribes: "Hola, revisando tu pedido #12345..."
   - Clic en "Enviar Respuesta"
7. **El cliente ve tu respuesta** inmediatamente en el chat

---

## 🚀 Próximas Mejoras

Funcionalidades que se pueden agregar:

- [ ] **Lista automática de conversaciones activas** (sin necesidad de ingresar ID)
- [ ] **Notificaciones en tiempo real** cuando hay nuevos mensajes
- [ ] **Búsqueda de conversaciones** por contenido
- [ ] **Estadísticas** (mensajes por día, tiempo de respuesta)
- [ ] **Multi-agente** (asignar conversaciones a diferentes agentes)

---

## 💡 Tips

1. **Guarda los Agent IDs importantes**: Puedes crear una lista de conversaciones activas
2. **Usa "Marcar como Esperando"**: Para evitar respuestas automáticas de la IA
3. **Revisa el historial completo**: Para entender el contexto antes de responder
4. **Actualiza periódicamente**: Haz clic en "Buscar Pendientes" para ver nuevos mensajes

---

## 🔒 Seguridad

**Nota importante**: Actualmente el panel de administración es accesible para cualquiera que conozca la URL `/admin`. 

Para producción, deberías agregar:
- Autenticación (login)
- Autorización (solo usuarios autorizados)
- Rate limiting
- Protección contra acceso no autorizado

