# 🎮 TETRIS NES

Tetris con estética NES/Famicom, perfiles de jugador y ranking global.

## Stack
- Node.js + Express
- PostgreSQL (Railway)
- Vanilla JS frontend

## Deploy en Railway

### 1. Crear proyecto en Railway
1. Ir a [railway.app](https://railway.app) → New Project
2. Deploy from GitHub repo (subí este código a un repo tuyo primero)

### 2. Agregar PostgreSQL
- En el proyecto de Railway → New → Database → PostgreSQL
- Railway conecta automáticamente la variable `DATABASE_URL`

### 3. Variables de entorno
En Railway → tu servicio → Variables, agregar:
```
NODE_ENV=production
```
`DATABASE_URL` ya la pone Railway automáticamente al conectar la DB.

### 4. Deploy
Railway detecta el `railway.json` y usa `node src/server.js` como start command.

Las tablas se crean automáticamente al iniciar el servidor.

## Desarrollo local

```bash
npm install
cp .env.example .env
# Editar .env con tu DATABASE_URL local
npm run dev
```

## Controles
| Tecla | Acción |
|-------|--------|
| ← → | Mover |
| ↑ | Rotar |
| ↓ | Bajar suave |
| Espacio | Hard drop |
| P | Pausa |
