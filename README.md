# Virus! MARVEL — online (uso familiar)

Aplicación web multijugador en tiempo real del juego de cartas *Virus! MARVEL* para jugar
2–5 jugadores online en familia. Servidor Node con estado autoritativo (Socket.IO) y
frontend React (Vite), mobile-first y en español.

> Proyecto **privado para uso familiar**. Los nombres de personajes Marvel y la mecánica de
> *Virus!* pertenecen a sus titulares. No publicar ni distribuir comercialmente.

## Estado del proyecto

- **Fase 1 — Acceso + Lobby + Salas + Admin** ✅ (esto es lo que hay ahora)
- Fase 2 — Motor de reglas + tests (pendiente)
- Fase 3 — UI de partida + tiempo real (pendiente)
- Fase 4 — Pulido / responsive (pendiente)

## Requisitos

- Node.js 18 o superior.

## Configuración

1. Copia el archivo de ejemplo y ajústalo:

   ```bash
   cp .env.example .env
   ```

2. Variables disponibles:

   | Variable           | Descripción                                   |
   | ------------------ | --------------------------------------------- |
   | `SITE_ACCESS_CODE` | Código para entrar a la web (toda la familia) |
   | `ADMIN_CODE`       | Código del panel de administración            |
   | `PORT`             | Puerto del servidor (por defecto 3000)        |

## Ejecutar en desarrollo

Instala dependencias (raíz = servidor, `client/` = frontend):

```bash
npm install
npm install --prefix client
```

Arranca servidor + frontend con recarga en caliente:

```bash
npm run dev
```

- Frontend (Vite): http://localhost:5173
- API y Socket.IO los sirve el servidor en :3000; Vite hace proxy automáticamente.
- Panel de administración: http://localhost:5173/#admin

## Ejecutar en producción

Compila el frontend y arranca el servidor (que sirve el frontend ya compilado):

```bash
npm run build
npm start
```

Todo queda servido desde un único puerto (`PORT`). Listo para Railway / Render / Fly.io o
un VPS: solo necesitan Node, las variables de entorno y ejecutar `npm run build && npm start`.

## Cómo probar la Fase 1

1. Abre http://localhost:5173 e introduce el `SITE_ACCESS_CODE`.
2. Pulsa **Crear sala**, pon un apodo → verás el código de sala (4 letras).
3. En otra pestaña/dispositivo, entra con el mismo código de acceso → **Unirse a sala**,
   introduce el código y otro apodo.
4. El anfitrión verá habilitado **Empezar partida** con ≥2 jugadores.
5. Recarga la página de un jugador: se reconecta a su sitio automáticamente.
6. Abre http://localhost:5173/#admin, introduce el `ADMIN_CODE`: verás todas las salas y
   podrás cerrarlas. Las salas inactivas > 2 h se limpian solas.

## Estructura

```
server/   Express + Socket.IO, estado autoritativo en memoria
  store/      capa de persistencia (memoria; cambiable a Redis/SQLite)
  rooms/      gestión de salas, códigos y reconexión
  game/       motor de reglas (Fase 2)
shared/   constantes y catálogo de eventos compartidos cliente/servidor
client/   frontend React (Vite), mobile-first
tests/    tests del motor de reglas (Fase 2)
```

## Arquitectura

- El **servidor es la autoridad**: valida toda acción; el cliente solo envía intenciones.
- El **motor de reglas** (Fase 2) será un módulo puro y testeable, sin dependencias de
  Socket.IO.
- Estado en memoria detrás de una interfaz de `store` para poder migrar a Redis/SQLite sin
  tocar la lógica.
