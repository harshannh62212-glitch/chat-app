# Chat App - Real-Time Chat Application

A full-featured chat application built with Node.js, Express, Socket.io, React, and PostgreSQL. Features real-time messaging, server discovery, direct messages, and content filtering.

## 🎯 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Servers**: Create public/private servers with password protection
- **Mandatory General Chatroom**: Every server has a central chatroom all members must be in
- **Direct Messages**: Private 1-on-1 conversations between users
- **Server Discovery**: Browse and join public servers
- **Real-time Messaging**: Instant message delivery using Socket.io
- **Content Filtering**: Automatically filters swearwords and racist slurs
- **User Search**: Find and message other users
- **Server Members**: View all members in a server

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL
- **Frontend**: React 18, Vite
- **Authentication**: JWT
- **Real-time**: Socket.io
- **Deployment**: Vercel (backend), Railway/Supabase (database)

## 📋 Prerequisites

- Node.js 16.x or higher
- PostgreSQL 12 or higher
- npm or yarn

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd chat-app
```

### 2. Run Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

### 3. Configure Environment Variables
Edit `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/chat_db
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000`

## 📚 Database Schema

### Users
- id, username, email, password, avatar_url, created_at, updated_at

### Servers
- id, name, description, owner_id, password_hash, is_public, avatar_url, created_at, updated_at

### Chatrooms
- id, server_id, name, is_general, description, created_at

### Server Members
- id, user_id, server_id, joined_at

### Server Messages
- id, sender_id, chatroom_id, content, created_at, updated_at

### Direct Messages
- id, sender_id, recipient_id, content, is_read, created_at, updated_at

### Bans
- id, user_id, server_id, reason, created_at, expires_at

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Servers
- `POST /api/servers` - Create new server (requires auth)
- `GET /api/servers/discovery` - Get public servers
- `GET /api/servers/my-servers` - Get user's servers (requires auth)
- `GET /api/servers/:serverId` - Get server details (requires auth)
- `POST /api/servers/:serverId/join` - Join server (requires auth)
- `GET /api/servers/:serverId/members` - Get server members (requires auth)
- `GET /api/servers/:serverId/chatrooms` - Get chatrooms (requires auth)

### Messages
- `GET /api/messages/chatroom/:chatroomId` - Get chatroom messages (requires auth)
- `GET /api/messages/dm/:otherUserId` - Get DM messages (requires auth)
- `GET /api/messages/dm-conversations/list` - Get DM conversations (requires auth)

### Users
- `GET /api/users/search` - Search users (requires auth)
- `GET /api/users/:userId` - Get user profile

## 🔐 Content Filtering

The application automatically filters:
- Profanity and swearwords
- Racist slurs and hateful language
- Filtered content is replaced with asterisks

## 🎮 Socket.io Events

### Client → Server
- `user-joined` - User joins a server or starts using app
- `send-message` - Send a message (server or DM)
- `user-typing` - Broadcast typing indicator

### Server → Client
- `new-message` - New message in server chatroom
- `new-dm` - New direct message received
- `dm-sent` - Confirmation of sent DM
- `user-typing` - Someone is typing

## 📦 Deployment

### Deploy to Vercel

1. **Create a Vercel account** at vercel.com

2. **Set up PostgreSQL database** using Railway or Supabase

3. **Deploy backend:**
```bash
vercel --prod
```

4. **Set environment variables** in Vercel dashboard:
   - DATABASE_URL
   - JWT_SECRET
   - CLIENT_URL

5. **Deploy frontend:** Deploy to Netlify or Vercel separately

### Alternative: Deploy to Railway

1. **Create Railway account** at railway.app
2. **Connect your GitHub repository**
3. **Add PostgreSQL database plugin**
4. **Set environment variables**
5. **Railway will auto-deploy on git push**

## 🧪 Testing

### Create a Test Server
1. Register an account
2. Create a new server with a password (e.g., "TestServer123")
3. Find your server in the discovery tab
4. Join it from another browser/incognito window

### Test Content Filtering
Send a message with a swearword - it will be filtered automatically

### Test DMs
1. Use the search feature to find another user
2. Click their profile to start a DM
3. Messages will appear in real-time

## 🐛 Troubleshooting

### Database Connection Failed
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Ensure database user has correct permissions

### Socket.io Connection Issues
- Check CLIENT_URL matches your frontend URL
- Verify CORS settings in server.js
- Check browser console for errors

### Messages Not Appearing
- Verify user is joined to the server/DM
- Check Socket.io connection status
- Look at server logs for errors

## 📝 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions, please create an issue on GitHub.

---

**Happy Chatting! 💬**
