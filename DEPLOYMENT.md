# 🚀 Deployment Guide

This guide will walk you through deploying the Chat App to the cloud.

## Option 1: Deploy with Railway (Recommended - Easiest)

Railway is the easiest option because it handles both backend and database.

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (easiest option)
3. Create a new project

### Step 2: Add Services
1. Click "Add Service" → "GitHub Repo"
2. Select your chat-app repository
3. Click "Add Service" → "Database" → "PostgreSQL"

### Step 3: Configure Environment Variables
In Railway dashboard, set these variables:
```
DATABASE_URL=postgresql://... (Railway auto-fills this)
JWT_SECRET=your-super-secret-key-change-this
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-railway-domain.up.railway.app
```

### Step 4: Deploy Frontend
1. Build frontend: `npm run build` in frontend directory
2. Deploy to Vercel or Netlify (see below)
3. Update CLIENT_URL in backend variables

**Done!** Railway will automatically deploy when you push to GitHub.

---

## Option 2: Deploy Frontend to Vercel + Backend to Render + Database to Supabase (Recommended Hybrid Setup)

This is the best architecture for this app. It hosts the frontend on Vercel's global static CDN for fast loading, while running the backend on Render as a persistent Node server (enabling Socket.io WebSockets), and utilizing Supabase for a free, persistent PostgreSQL database.

### Step 1: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com).
2. Create a new project.
3. Once created, click the **Connect** button at the top of the dashboard.
4. Copy the connection string (PostgreSQL URI) under the **Transaction Connection String** section.
5. Save this URL, replacing `[YOUR-PASSWORD]` with the database password you chose during project setup.

### Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) and create a new **Web Service**.
2. Connect your GitHub repository.
3. Configure the following build settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. In the **Environment Variables** section, add:
   - `DATABASE_URL`: Your Supabase connection string.
   - `JWT_SECRET`: A random secure string (e.g., generate with `openssl rand -hex 32` in your local terminal).
   - `CLIENT_URL`: Your Vercel frontend URL (e.g., `https://your-app-frontend.vercel.app` — you can update this on Render once Vercel finishes deploying).
   - `NODE_ENV`: `production`

### Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository.
2. Under **Project Settings**, configure:
   - **Root Directory**: `frontend`
3. Add the following **Environment Variable**:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://your-backend.onrender.com`).
4. Click **Deploy**.

---

## Option 3: Docker + Cloud Run (Google Cloud)

### Step 1: Set Up Google Cloud Project
```bash
# Install Google Cloud SDK
# Then:
gcloud init
gcloud projects create my-chat-app
gcloud config set project my-chat-app
```

### Step 2: Build and Push Docker Image
```bash
# Build image
docker build -t gcr.io/my-chat-app/backend:latest .

# Push to Google Container Registry
docker push gcr.io/my-chat-app/backend:latest
```

### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy chat-app-backend \
  --image gcr.io/my-chat-app/backend:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=postgresql://...,JWT_SECRET=... \
  --allow-unauthenticated
```

---

## Option 4: Traditional VPS (DigitalOcean, Linode, etc.)

### Step 1: Create Droplet
- OS: Ubuntu 22.04
- Size: Basic ($5-10/month)
- Region: Choose closest to you

### Step 2: SSH into Server
```bash
ssh root@your_droplet_ip
```

### Step 3: Install Dependencies
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Git
apt install -y git
```

### Step 4: Clone Repository
```bash
git clone https://github.com/yourusername/chat-app.git
cd chat-app
npm install
cd frontend && npm install && npm run build && cd ..
```

### Step 5: Set Up Environment Variables
```bash
nano .env
# Add your variables
```

### Step 6: Set Up PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start server.js --name "chat-app"
pm2 startup
pm2 save
```

### Step 7: Set Up Nginx (Reverse Proxy)
```bash
apt install -y nginx

# Create config file
nano /etc/nginx/sites-available/chat-app

# Add:
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 8: Set Up SSL (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your_domain.com
```

---

## Post-Deployment Checklist

- [ ] Database is running and accessible
- [ ] Backend API responds to health check (`/api/health`)
- [ ] Frontend loads without errors
- [ ] Can register a new account
- [ ] Can create a server
- [ ] Can send messages in real-time
- [ ] Can send DMs
- [ ] Content filtering works
- [ ] Password-protected servers work
- [ ] Environment variables are secure (not exposed)

---

## Monitoring & Maintenance

### View Logs
**Railway:**
```bash
# Logs appear in dashboard
```

**Vercel:**
```bash
# Logs appear in Vercel dashboard under Deployments
```

**VPS with PM2:**
```bash
pm2 logs chat-app
```

### Database Backups
- Set up automated backups in your database provider
- For PostgreSQL: `pg_dump` regularly
- Store backups securely

### Security Hardening
1. **Change JWT_SECRET** - Generate strong random key
2. **Enable HTTPS** - Use SSL/TLS certificates
3. **Database** - Use strong passwords
4. **CORS** - Restrict to your domain only
5. **Rate Limiting** - Add rate limiting to API

---

## Troubleshooting

### "Connection refused" errors
- Check DATABASE_URL is correct
- Verify database is running and accessible
- Check network settings allow connections

### "Socket.io connection failed"
- Verify CLIENT_URL matches frontend domain
- Check CORS settings
- Look at browser console for errors

### "502 Bad Gateway"
- Check backend is running
- Look at backend logs
- Verify database connection

### Messages not appearing in real-time
- Check Socket.io is connecting
- Verify server is handling socket events
- Check browser network tab for WebSocket connection

---

## Cost Estimation (Monthly)

| Platform | Cost | Includes |
|----------|------|----------|
| Railway | $5-50 | Backend + Database |
| Supabase + Vercel | $5-50 | Database + Backend + Frontend |
| DigitalOcean Droplet | $5-20 | Server only (you manage everything) |
| Google Cloud Run | $0-25 | Usage-based (very cheap for low traffic) |

---

## Getting Help

- Check application logs
- Review the README.md
- Look at GitHub issues
- Check Socket.io documentation
- Consult PostgreSQL documentation

---

**Good luck with your deployment! 🚀**
