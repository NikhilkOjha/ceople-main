# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/a71d4394-37fa-45bb-abba-dddb9fac5b6d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a71d4394-37fa-45bb-abba-dddb9fac5b6d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Socket.IO
- Supabase
- Express.js

## Features

### Chat Functionality
- **Video Chat**: Face-to-face conversations with strangers using WebRTC
- **Text Chat**: Real-time text messaging with strangers
- **Smart Matching**: AI-powered matching system for compatible connections
- **Safety Features**: Advanced moderation and content filtering

### Feedback System
- **Quick Feedback Poll**: Thumbs up/down rating after each chat session
- **Anonymous Feedback**: Works for both authenticated and guest users
- **Admin Dashboard**: View feedback statistics and analytics
- **Real-time Stats**: Track positive/negative feedback ratios

### How the Feedback System Works
1. After a chat session ends, users see a feedback modal
2. Users can rate their experience with thumbs up (positive) or thumbs down (negative)
3. Feedback is stored in the database with user and session information
4. Admins can view aggregated feedback statistics at `/admin`
5. The system supports both authenticated users and anonymous guests

### Admin Dashboard Features
- **📊 Feedback Analytics**: View thumbs up/down ratings and user satisfaction metrics
- **📩 Email Signups**: Track newsletter subscriptions and growth rates
- **💬 Chat Sessions**: Monitor active sessions, total participants, and engagement metrics
- **🌍 User Locations**: Geographic analytics with country flags and regional insights
- **📈 Real-time Stats**: Live updates with refresh functionality
- **🎨 Beautiful UI**: Modern dashboard with tabs, charts, and progress bars

### Admin Access
- Navigate to `/admin` to view the comprehensive dashboard
- Currently restricted to users with email `admin@ceople.com` or role `admin`
- Four main sections: Feedback, Email Signups, Chat Sessions, and User Locations

### Email Signup System
- **Landing Page Integration**: Beautiful signup form on the main landing page
- **Multiple Sources**: Track signups from different sources (landing, website, etc.)
- **Duplicate Prevention**: Prevents duplicate email subscriptions
- **Success/Error Handling**: User-friendly feedback with toast notifications
- **Database Storage**: Secure storage in Supabase with proper RLS policies

### User Location Tracking
- **IP Geolocation**: Automatic location detection using multiple free APIs
- **Privacy Respectful**: Only stores country/region data, not exact locations
- **Global Analytics**: View user distribution across countries with flag icons
- **Geographic Insights**: Regional breakdowns and engagement metrics
- **Automatic Tracking**: Location saved when users sign up or sign in

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a71d4394-37fa-45bb-abba-dddb9fac5b6d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
