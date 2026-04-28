# ChatApp Backend

Real-time chat backend built with **Node.js**, **Express**, and **Socket.IO**.  
Supports direct messages, group chats, typing indicators, read receipts, and WebRTC voice/video call signalling.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Start the server
npm run dev       # development (auto-reload with nodemon)
npm start         # production
```

Server runs on **http://localhost:3001** by default.

---

## Project Structure

```
chatapp/
├── src/
│   ├── server.js            # Entry point — Express + Socket.IO wired together
│   ├── models/
│   │   └── db.js            # In-memory data store (swap for MongoDB/Postgres)
│   ├── middleware/
│   │   └── auth.js          # JWT verify middleware + token generator
│   ├── routes/
│   │   ├── auth.js          # POST /register, POST /login
│   │   ├── users.js         # GET/PATCH /me, GET /search, GET /:id
│   │   ├── chats.js         # GET /, POST /direct, POST /group, GET /:id
│   │   └── messages.js      # GET /:chatId (message history)
│   └── socket/
│       └── index.js         # All real-time Socket.IO event handlers
├── chatapp-client.js        # Drop-in frontend JS client helper
├── .env.example
└── package.json
```

---

## REST API Reference

All routes except `/api/auth/*` require:  
`Authorization: Bearer <token>`

### Auth
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | `{ username, phone, password }` | Create account |
| POST | `/api/auth/login` | `{ phone, password }` | Login, get token |

### Users
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users/me` | Get own profile |
| PATCH | `/api/users/me` | Update username / status |
| GET | `/api/users/search?q=name` | Search users |
| GET | `/api/users/:id` | Get user profile |

### Chats
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| GET | `/api/chats` | — | List all my chats |
| POST | `/api/chats/direct` | `{ userId }` | Open/get DM |
| POST | `/api/chats/group` | `{ name, members[] }` | Create group |
| GET | `/api/chats/:chatId` | — | Chat + recent messages |
| POST | `/api/chats/:chatId/members` | `{ userId }` | Add member |
| DELETE | `/api/chats/:chatId/members/:userId` | — | Remove / leave |

### Messages
| Method | Route | Query | Description |
|--------|-------|-------|-------------|
| GET | `/api/messages/:chatId` | `limit`, `before` (ISO date) | Load message history |

---

## Socket.IO Events

Connect with your JWT token:
```js
const socket = io('http://localhost:3001', { auth: { token: 'YOUR_JWT' } });
```

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `{ chatId }` | Subscribe to chat room |
| `leave_chat` | `{ chatId }` | Unsubscribe |
| `send_message` | `{ chatId, text, type?, fileUrl? }` | Send a message |
| `typing_start` | `{ chatId }` | Broadcast "typing…" |
| `typing_stop` | `{ chatId }` | Stop typing indicator |
| `mark_read` | `{ chatId }` | Mark all messages read |
| `call_offer` | `{ chatId, targetUserId, offer, callType }` | Initiate WebRTC call |
| `call_answer` | `{ targetUserId, answer }` | Accept call |
| `call_ice` | `{ targetUserId, candidate }` | Share ICE candidate |
| `call_end` | `{ targetUserId }` | Hang up |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `authenticated` | `{ user }` | Socket auth confirmed |
| `new_message` | `{ chatId, message }` | New message arrived |
| `typing` | `{ chatId, userId, username }` | Someone is typing |
| `stop_typing` | `{ chatId, userId }` | Typing stopped |
| `messages_read` | `{ chatId, userId }` | Read receipt |
| `user_online` | `{ userId }` | User came online |
| `user_offline` | `{ userId, lastSeen }` | User went offline |
| `call_incoming` | `{ chatId, fromUserId, offer, callType }` | Incoming call |
| `call_answered` | `{ answer }` | Call was accepted |
| `call_ice` | `{ candidate }` | ICE candidate |
| `call_ended` | `{}` | Call was ended |

---

## Upgrading to a Real Database

`src/models/db.js` is the only file to replace. It exports clean functions  
(`createUser`, `findChatById`, `createMessage`, etc.) — swap their implementations  
for Mongoose/Prisma/Knex calls and nothing else needs to change.

**Recommended stack:**
- **MongoDB** + Mongoose — easiest migration from in-memory
- **PostgreSQL** + Prisma — best for production scale
- **Redis** — add for presence tracking and message queues at scale

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `JWT_SECRET` | *(required)* | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:3000` | CORS allowed origin |
"# chat-app-test" 
