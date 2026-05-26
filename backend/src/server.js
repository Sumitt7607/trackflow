const http = require('http');
const dotenv = require('dotenv');
const app = require('./app');
const connectDB = async () => {
  const conn = require('./config/db');
  await conn();
};
const { initializeSocket } = require('./config/socket');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Make socket server globally accessible if needed
app.set('io', io);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`TrackFlow Backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
