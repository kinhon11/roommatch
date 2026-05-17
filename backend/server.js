const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes     = require('./routes/authRoutes');
const roomRoutes     = require('./routes/roomRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const aiRoutes       = require('./routes/aiRoutes');
const profileRoutes  = require('./routes/profileRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const reportRoutes   = require('./routes/reportRoutes');
const chatRoutes     = require('./routes/chatRoutes');
const roommateRequestRoutes = require('./routes/roommateRequestRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const depositRoutes = require('./routes/depositRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware
const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép: không có origin (Postman/curl), localhost bất kỳ port, và CLIENT_URL
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
    ].filter(Boolean);

    if (!origin || allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), project: 'RoommieMatch API' });
});

// ─── Routes
app.use('/api/auth',      authRoutes);
app.use('/api/rooms',     roomRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/profile',   profileRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/roommate-requests', roommateRequestRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/deposits', depositRoutes);

// ─── 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route '${req.originalUrl}' không tồn tại.` });
});

// ─── Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ RoommieMatch Backend is running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
