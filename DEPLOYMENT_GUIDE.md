# 🚀 Ceople Deployment Guide

## Architecture Overview

```
Frontend (Vercel) → Render Backend → Supabase Auth + Database
```

## 📋 Prerequisites

1. **Supabase Account**: Already set up
2. **Vercel Account**: Already set up  
3. **Render Account**: Need to create
4. **GitHub Repository**: Already set up

## 🔧 Step 1: Get Supabase Service Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/arluwakftvvbioprdsmw)
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (not the anon key)
4. Keep this safe - you'll need it for Render

## 🎯 Step 2: Deploy Backend to Render

### Option A: Deploy via GitHub (Recommended)

1. **Push Backend to GitHub**:
   ```bash
   # Create a new repository for backend
   git init backend
   cd backend
   git add .
   git commit -m "Initial backend commit"
   git remote add origin https://github.com/yourusername/ceople-backend.git
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New** → **Web Service**
   - Connect your GitHub repository
   - Configure:
     - **Name**: `ceople-backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Add Environment Variables**:
   ```
   SUPABASE_URL=https://arluwakftvvbioprdsmw.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   FRONTEND_URL=https://ceople-main.vercel.app
   NODE_ENV=production
   ```

### Option B: Deploy via Render CLI

1. **Install Render CLI**:
   ```bash
   brew install render
   ```

2. **Deploy**:
   ```bash
   cd backend
   render deploy
   ```

## 🔗 Step 3: Update Frontend

1. **Add Backend URL to Frontend**:
   Create `.env` file in frontend root:
   ```
   REACT_APP_BACKEND_URL=https://your-backend-name.onrender.com
   ```

2. **Deploy Frontend**:
   ```bash
   git add .
   git commit -m "Add backend integration"
   git push origin main
   ```

## 🧪 Step 4: Test the Application

1. **Test Authentication**: Sign up/login should work
2. **Test Chat Queue**: Join queue should work
3. **Test Matching**: Two users should be able to connect
4. **Test Video Chat**: WebRTC should work
5. **Test Text Chat**: Messages should be real-time

## 📊 Step 5: Monitor & Scale

### Render Monitoring:
- **Logs**: View real-time logs in Render dashboard
- **Metrics**: Monitor CPU, memory, and response times
- **Uptime**: Check service health

### Supabase Monitoring:
- **Database**: Monitor query performance
- **Auth**: Track user signups/logins
- **Storage**: Monitor file uploads (if any)

## 🔒 Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **CORS**: Backend only accepts requests from your frontend
3. **Rate Limiting**: Backend has rate limiting enabled
4. **Authentication**: All socket connections require valid tokens

## 💰 Cost Estimation

### Free Tier (Up to 1K users):
- **Render**: Free (750 hours/month)
- **Supabase**: Free (50K MAU)
- **Vercel**: Free (100GB bandwidth)
- **Total**: $0/month

### Paid Tier (1K-10K users):
- **Render**: $7/month
- **Supabase**: $25/month
- **Vercel**: $20/month
- **Total**: ~$52/month

## 🚨 Troubleshooting

### Common Issues:

1. **Backend Connection Failed**:
   - Check environment variables
   - Verify Supabase service key
   - Check Render logs

2. **WebRTC Not Working**:
   - Ensure HTTPS is enabled
   - Check browser permissions
   - Verify ICE servers

3. **Authentication Errors**:
   - Verify Supabase URL
   - Check token expiration
   - Ensure CORS is configured

### Debug Commands:

```bash
# Check backend health
curl https://your-backend.onrender.com/health

# Check frontend build
npm run build

# Test local backend
cd backend && npm run dev
```

## 🎉 Launch Checklist

- [ ] Backend deployed to Render
- [ ] Frontend updated with backend URL
- [ ] Environment variables configured
- [ ] Authentication working
- [ ] Chat functionality tested
- [ ] Video chat working
- [ ] Error handling implemented
- [ ] Monitoring set up
- [ ] Domain configured (optional)
- [ ] SSL certificates active

## 📞 Support

If you encounter issues:
1. Check Render logs
2. Check Supabase logs
3. Check browser console
4. Verify environment variables
5. Test with multiple browsers

Your app should now be production-ready! 🚀 