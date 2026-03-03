const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// Load data from file or initialize empty
let users = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log('📂 Data loaded from file');
  }
} catch (err) {
  console.error('Error loading data:', err);
}

// Save data to file
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Auto-save every 30 seconds
setInterval(saveData, 30000);

// Status types with colors
const STATUS_TYPES = {
  available: { label: 'Available', color: '#10b981', icon: '✅' },
  busy: { label: 'Busy', color: '#ef4444', icon: '🔴' },
  meeting: { label: 'In a Meeting', color: '#f59e0b', icon: '📅' },
  focus: { label: 'Focus Mode', color: '#8b5cf6', icon: '🎯' },
  break: { label: 'On Break', color: '#3b82f6', icon: '☕' },
  custom: { label: 'Custom', color: '#6b7280', icon: '⚪' }
};

// Routes

// Register new user
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if username exists
  const existingUser = Object.values(users).find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const userId = uuidv4();
  const shareableLink = `${req.protocol}://${req.get('host')}/status/${userId}`;

  users[userId] = {
    id: userId,
    username,
    password, // In production, hash this!
    tasks: [],
    status: {
      type: 'available',
      message: '',
      until: null,
      updatedAt: new Date().toISOString()
    },
    shareableLink,
    createdAt: new Date().toISOString()
  };

  saveData();
  console.log(`✅ New user registered: ${username}`);

  res.json({ 
    success: true, 
    userId, 
    username,
    shareableLink 
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = Object.values(users).find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    success: true,
    userId: user.id,
    username: user.username,
    shareableLink: user.shareableLink
  });
});

// Get user data (private)
app.get('/api/user/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Don't send password
  const { password, ...userData } = user;
  res.json(userData);
});

// Update status
app.post('/api/status/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { type, message, until } = req.body;

  user.status = {
    type: type || 'available',
    message: message || '',
    until: until || null,
    updatedAt: new Date().toISOString()
  };

  saveData();

  // Broadcast update to all connected clients viewing this user
  io.emit(`status_update_${user.id}`, user.status);

  res.json({ success: true, status: user.status });
});

// Add task
app.post('/api/tasks/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { text, dueDate, priority = 'medium' } = req.body;

  const task = {
    id: uuidv4(),
    text,
    dueDate: dueDate || null,
    priority,
    completed: false,
    createdAt: new Date().toISOString()
  };

  user.tasks.push(task);
  saveData();

  res.json({ success: true, task });
});

// Toggle task completion
app.put('/api/tasks/:userId/:taskId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const task = user.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  task.completed = !task.completed;
  saveData();

  res.json({ success: true, task });
});

// Delete task
app.delete('/api/tasks/:userId/:taskId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.tasks = user.tasks.filter(t => t.id !== req.params.taskId);
  saveData();

  res.json({ success: true });
});

// Get public status (no auth required)
app.get('/api/public/status/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Calculate next available time based on tasks
  const now = new Date();
  const upcomingTasks = user.tasks
    .filter(t => !t.completed && t.dueDate && new Date(t.dueDate) > now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const nextTask = upcomingTasks[0];

  res.json({
    username: user.username,
    status: user.status,
    statusMeta: STATUS_TYPES[user.status.type] || STATUS_TYPES.custom,
    nextTask: nextTask ? {
      text: nextTask.text,
      dueDate: nextTask.dueDate
    } : null,
    lastUpdated: user.status.updatedAt
  });
});

// Serve public status page
app.get('/status/:userId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('👤 Client connected');

  socket.on('disconnect', () => {
    console.log('👤 Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Local: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, saving data...');
  saveData();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, saving data...');
  saveData();
  process.exit(0);
});
