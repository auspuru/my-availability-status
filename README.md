[README.md](https://github.com/user-attachments/files/25705497/README.md)
# Availability & Task Manager

A personal app to manage your tasks and share your availability status with friends.

## Features

- **Task Management**: Add, complete, and delete tasks with due dates
- **Status Settings**: Set your current status (Available, Busy, In Meeting, Focus Mode, On Break, Custom)
- **Shareable Link**: Unique public page friends can check to see if you're available
- **Real-time Updates**: Status updates instantly when you change it
- **Mobile Responsive**: Works on all devices

## Quick Deploy to Railway (Recommended)

1. **Create new project** on Railway
2. **Upload code**:
   ```bash
   # Local setup
   npm install
   npm start
   ```
   Or deploy directly from GitHub.

3. **Environment Variables**: None required (uses file storage)

4. **Domain**: Railway provides automatic HTTPS URL

## Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## How to Use

1. **Register** an account
2. **Set your status** using the dashboard buttons
3. **Add tasks** with deadlines
4. **Copy your shareable link** and send to friends
5. Friends visit the link to see:
   - Your current status (with color coding)
   - Custom message
   - Your next upcoming task
   - Live indicator

## API Endpoints

- `POST /api/register` - Create account
- `POST /api/login` - Login
- `GET /api/user/:userId` - Get user data
- `POST /api/status/:userId` - Update status
- `GET /api/public/status/:userId` - Public status (no auth)
- `POST /api/tasks/:userId` - Add task
- `PUT /api/tasks/:userId/:taskId` - Toggle task completion
- `DELETE /api/tasks/:userId/:taskId` - Delete task

## Data Storage

Data is stored in `data/users.json` (automatically created). On Railway, this persists across restarts but not deploys. For production with many users, switch to MongoDB or PostgreSQL.

## Customization

Edit `public/style.css` to change colors and branding.
