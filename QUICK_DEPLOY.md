# 🚀 Quick Deploy Guide

## Step 1: Get Supabase Service Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/arluwakftvvbioprdsmw)
2. Click **Settings** → **API**
3. Copy the **service_role** key (not the anon key)

## Step 2: Deploy Backend from Existing Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your existing `ceople-main` repository
4. Configure:
   - **Name**: `ceople-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free

## Step 3: Add Environment Variables

In Render dashboard, add these environment variables:

```
SUPABASE_URL=https://arluwakftvvbioprdsmw.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
FRONTEND_URL=https://ceople-main.vercel.app
NODE_ENV=production
```

## Step 4: Update Frontend

1. Add this to your frontend `.env` file:
```
REACT_APP_BACKEND_URL=https://ceople-main.onrender.com
```

2. Deploy frontend:
```bash
git add .
git commit -m "Add backend URL"
git push origin main
```

## Step 5: Deploy Frontend

```bash
git add .
git commit -m "Add backend URL"
git push origin main
```

## Step 6: Test

1. Go to your Vercel app: https://ceople-main.vercel.app
2. Sign up/login
3. Try starting a chat
4. Check if it connects to the backend

## 🎉 Done!

Your app should now be fully functional with:
- ✅ Authentication (Supabase)
- ✅ Real-time chat (Render backend)
- ✅ Video chat (WebRTC)
- ✅ Text chat
- ✅ User matching

## Troubleshooting

If you get errors:
1. Check Render logs in the dashboard
2. Verify environment variables
3. Make sure the backend URL is correct in frontend
4. Check browser console for connection errors 