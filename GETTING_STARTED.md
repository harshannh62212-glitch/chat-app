# 🚀 Getting Started - Your Chat App is Ready!

## Location
Your chat app is located at: `/Users/nhharshan/projects/chat-app`

## What to Do First

### Step 1: Prerequisites
Make sure you have:
- ✅ Node.js 16+ installed (`node --version`)
- ✅ PostgreSQL installed and running
- ✅ npm installed

### Step 2: Set Up Database
Create a PostgreSQL database:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE chat_db;

# Create user
CREATE USER chat_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE chat_db TO chat_user;

# Exit
\q
```

### Step 3: Configure Environment
```bash
cd /Users/nhharshan/projects/chat-app

# Copy example to create real .env file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Edit these in .env:**
```env
DATABASE_URL=postgresql://chat_user:your_secure_password@localhost:5432/chat_db
JWT_SECRET=generate_a_random_string_here_use_openssl_rand_-hex_32
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Step 4: Install Dependencies
```bash
cd /Users/nhharshan/projects/chat-app

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Step 5: Run the Application

**Terminal 1 - Start Backend:**
```bash
cd /Users/nhharshan/projects/chat-app
npm start
# Should see: "Server running on port 5000"
# And: "Database connection successful"
# And: "Tables created successfully"
```

**Terminal 2 - Start Frontend:**
```bash
cd /Users/nhharshan/projects/chat-app/frontend
npm run dev
# Should see: "Local: http://localhost:3000"
```

### Step 6: Open in Browser
Visit: `http://localhost:3000`

You should see the login page! 🎉

---

## 🧪 Test It Out

### Create First Account
1. Click "Register"
2. Enter: username, email, password
3. Click "Register"
4. You're logged in!

### Create a Server
1. Click "New Server" button
2. Enter "Test Server" as name
3. Optional: Add password (e.g., "password123")
4. Check "Make server public"
5. Click "Create"
6. You're now in the server!

### Send a Message
1. Type in the message box at bottom
2. Press Enter
3. Your message appears instantly! ✨

### Test Content Filtering
Try sending a message with a swear word - it will be filtered to `****`

### Test DMs
1. Click "DMs" tab
2. Click "+ New DM"
3. Search for your username (or create another account)
4. Click user to start DM
5. Send message
6. Message appears instantly!

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Full documentation with API reference |
| `QUICKSTART.md` | 5-minute quick start guide |
| `DEPLOYMENT.md` | Deploy to cloud (Railway, Vercel, etc.) |
| `BUILD_SUMMARY.md` | Complete project overview |
| `GETTING_STARTED.md` | This file! |

---

## 🌐 Deploy to Cloud (When Ready)

When you're ready to go live, see `DEPLOYMENT.md` for:
- Railway (easiest)
- Vercel + Supabase
- Docker + Google Cloud Run
- Traditional VPS

All deployment info is in `DEPLOYMENT.md`

---

## 🆘 Troubleshooting

### Backend won't start
```
Error: Cannot connect to database

Solution: Check .env file
- Is DATABASE_URL correct?
- Is PostgreSQL running?
- Is database created?
```

### Frontend won't load
```
Error: Connection refused

Solution: Make sure backend is running
- Check Terminal 1 shows "Server running on port 5000"
```

### Socket.io connection fails
```
Error: WebSocket connection fails

Solution: Check browser console (F12)
- Verify backend is running
- Check CLIENT_URL in .env matches
```

### Port already in use
```
Error: listen EADDRINUSE: address already in use :::5000

Solution: Change PORT in .env or kill the process
- killall node  (or specify a different PORT)
```

---

## 📁 Project Files You'll Use Most

### Backend
- `server.js` - Main server file
- `routes/auth.js` - Login/register
- `routes/servers.js` - Server operations
- `routes/messages.js` - Message endpoints
- `utils/contentFilter.js` - Banned words

### Frontend
- `frontend/src/App.jsx` - Main component
- `frontend/src/pages/Auth.jsx` - Login page
- `frontend/src/pages/Dashboard.jsx` - Main dashboard
- `frontend/src/components/` - UI components
- `frontend/src/styles/` - CSS styling

### Config
- `.env` - Your environment variables
- `vercel.json` - Vercel deployment
- `docker-compose.yml` - Docker setup
- `package.json` - Dependencies

---

## ⚡ Quick Commands Reference

```bash
# Navigate to app
cd /Users/nhharshan/projects/chat-app

# Start backend
npm start

# Start frontend
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Install dependencies
npm install

# View git history
git log

# View changes
git status
```

---

## 🎯 Feature Checklist

Core Features (all working):
- [x] User registration & login
- [x] Create servers
- [x] Password-protected servers
- [x] General mandatory chatroom
- [x] Send server messages
- [x] Real-time messaging
- [x] Direct messages
- [x] Server discovery
- [x] User search
- [x] Content filtering (swear words & slurs)
- [x] Server members list
- [x] JWT authentication
- [x] Database ready

---

## 💾 Database

Tables automatically created:
- `users` - User accounts
- `servers` - Servers
- `chatrooms` - Channels
- `server_members` - Members
- `server_messages` - Messages
- `direct_messages` - DMs
- `bans` - Bans (future use)

All managed automatically - no manual setup needed!

---

## 🔒 Security

Already included:
- ✅ Password hashing (bcrypt)
- ✅ JWT tokens
- ✅ CORS protection
- ✅ SQL injection prevention
- ✅ Input validation
- ✅ Secure password-protected servers

---

## 🎨 Customize

Want to change things?

**Change Colors:**
- Edit `frontend/src/styles/App.css`
- Search for `#7289da` (main color)
- Replace with your color

**Add Banned Words:**
- Edit `utils/contentFilter.js`
- Add to `BANNED_WORDS` array

**Change Port:**
- Edit `.env`
- Change `PORT=5000` to desired port

**Change Server Name:**
- Edit `frontend/src/App.jsx`
- Change "Chat App" title

---

## 🚀 What's Next?

1. ✅ Get it running locally (start here!)
2. 🧪 Test with multiple accounts
3. 🎨 Customize colors/branding
4. 📊 Test with friends
5. 🌐 Deploy to cloud
6. 🔧 Add more features

---

## 📞 Support

Having issues?
1. Check error messages in terminal
2. Check browser console (F12)
3. Verify database is running
4. See troubleshooting section above
5. Check README.md for more info

---

## 🎓 Learn More

See the documentation:
- **README.md** - Full API documentation
- **DEPLOYMENT.md** - Cloud deployment guide
- **QUICKSTART.md** - Quick start guide
- **BUILD_SUMMARY.md** - Project overview

---

## 🎉 Ready to Go!

You have a **complete, production-ready chat application**.

**Get started now:**
```bash
cd /Users/nhharshan/projects/chat-app
npm start
# Then in another terminal:
cd frontend && npm run dev
# Visit http://localhost:3000
```

---

**Happy chatting! 💬**

Questions? Check the docs or review the code comments.

Good luck! 🚀
