# Quick Start Guide

Get your Chat App running in 5 minutes!

## Prerequisites
- Node.js 16+ installed
- PostgreSQL running locally
- A code editor (VS Code recommended)

## ⚡ Quick Start (Local Development)

### 1. **Setup**
```bash
cd chat-app
chmod +x setup.sh
./setup.sh
```

### 2. **Update .env file**
```bash
# Edit .env with your PostgreSQL credentials
nano .env

# Example:
DATABASE_URL=postgresql://postgres:password@localhost:5432/chat_db
JWT_SECRET=my_super_secret_key_123
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 3. **Start Backend** (Terminal 1)
```bash
npm start
# You should see: "Server running on port 5000"
```

### 4. **Start Frontend** (Terminal 2)
```bash
cd frontend
npm run dev
# You should see: "Local: http://localhost:3000"
```

### 5. **Open in Browser**
Visit: `http://localhost:3000`

---

## 🎮 Test the App

### Create an Account
1. Click "Register"
2. Choose username, email, password
3. Click "Register"

### Create a Server
1. Click "New Server" button
2. Enter server name: "Test Server"
3. Optional: Add password
4. Click "Create"

### Send a Message
1. Select the server
2. Type a message in "general" chatroom
3. Press Enter to send
4. Message appears instantly! 💬

### Send a DM
1. Click "DMs" tab
2. Click "New DM"
3. Search for another user
4. Click their name
5. Type and send message

### Test Content Filtering
Send a message with a swear word - it will be filtered to asterisks!

---

## 🌐 Deploy to Cloud (5 mins)

### Easiest Option: Railway

1. Push your code to GitHub
2. Go to railway.app
3. Import repository
4. Add PostgreSQL service
5. Set environment variables
6. Done! 🎉

See `DEPLOYMENT.md` for detailed instructions.

---

## 📱 Features Walkthrough

### Servers
- **Create**: Make public/private servers with optional passwords
- **Discover**: Browse public servers
- **General Chatroom**: All servers have mandatory "general" room
- **Members**: See who's in each server

### Direct Messages
- **Search**: Find users and start DMs
- **Real-time**: Messages appear instantly
- **Conversations**: View all your active DMs

### Content Filtering
- **Swearwords**: Automatically filtered
- **Racist Slurs**: Automatically filtered
- **Replacement**: Filtered text shows as `****`

---

## 🛠️ Useful Commands

```bash
# Install all dependencies
npm run install-all

# Start backend only
npm start

# Start frontend only (from frontend directory)
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build

# View backend logs
npm start

# Reset database (delete all data)
# - Delete .env DATABASE_URL and recreate database
# - Restart backend
```

---

## 📁 Project Structure

```
chat-app/
├── server.js              # Main backend file
├── package.json           # Backend dependencies
├── .env                   # Your environment variables
├── .env.example           # Example template
│
├── db/
│   └── database.js        # Database setup
│
├── middleware/
│   └── auth.js            # JWT authentication
│
├── routes/
│   ├── auth.js            # Login/register
│   ├── servers.js         # Server operations
│   ├── messages.js        # Messages & DMs
│   └── users.js           # User search & profiles
│
├── frontend/
│   ├── package.json       # React dependencies
│   ├── index.html
│   ├── vite.config.js
│   │
│   └── src/
│       ├── App.jsx        # Main app
│       ├── main.jsx       # Entry point
│       │
│       ├── pages/
│       │   ├── Auth.jsx   # Login/Register
│       │   └── Dashboard.jsx
│       │
│       ├── components/
│       │   ├── ServerList.jsx
│       │   ├── ServerChat.jsx
│       │   ├── Discovery.jsx
│       │   ├── DMList.jsx
│       │   └── DirectMessage.jsx
│       │
│       └── styles/
│           ├── App.css
│           ├── Auth.css
│           └── Dashboard.css
│
├── DEPLOYMENT.md          # Cloud deployment guide
├── README.md              # Full documentation
└── docker-compose.yml     # Docker setup
```

---

## ❓ FAQ

**Q: How do I change the port?**
A: Edit `PORT` in .env file

**Q: Can I run this without PostgreSQL?**
A: Not recommended, but you could use SQLite (would need code changes)

**Q: How do I add more users?**
A: Each person registers their own account

**Q: Can I delete messages?**
A: Currently no - you can add this feature!

**Q: How do I prevent certain users from joining?**
A: Use the bans table (admin feature coming soon)

---

## 🆘 Common Issues

**"Cannot connect to PostgreSQL"**
- Check PostgreSQL is running: `psql -U postgres`
- Verify DATABASE_URL in .env
- Ensure password is correct

**"Port 5000 already in use"**
- Change PORT in .env
- Or kill the process using that port

**"Frontend not connecting to backend"**
- Check backend is running on port 5000
- Verify CLIENT_URL in .env matches frontend URL
- Check browser console for CORS errors

**"Socket.io not connecting"**
- Check WebSocket support in your browser
- Verify firewall isn't blocking connections
- Check browser console for errors

---

## 🚀 Next Steps

1. ✅ Get it running locally
2. 🧪 Test with friends (create multiple accounts)
3. 🌐 Deploy to cloud (see DEPLOYMENT.md)
4. 🎨 Customize styling (edit CSS files)
5. 🔧 Add more features (suggestions below)

---

## 💡 Feature Ideas

- Avatar uploads
- User profiles with bio
- Typing indicators
- Message reactions/emojis
- User status (online/offline)
- Admin panel
- User banning
- Channel categories
- Voice messages
- File sharing
- Pinned messages
- Message search

---

## 📞 Need Help?

1. Check the README.md
2. Look at browser console (F12)
3. Look at backend logs (Terminal)
4. Check database is connected
5. Read the DEPLOYMENT.md

---

**You're all set! Happy coding! 🎉**

Questions? Create an issue on GitHub!
