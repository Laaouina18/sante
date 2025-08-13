// app.js
import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from 'cors';
import { fileURLToPath } from "url";
import http from 'http';
import { Server } from 'socket.io';
import path, { dirname } from "path";
import mongoose from "mongoose";
import * as NotificationService from "./services/NotivicationService.js";
import * as ChatService from "./services/chat.js";
import router from "./routes/index.js";

// Load environment variables first
dotenv.config();

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app and create HTTP server
const app = express();
const server = http.createServer(app);

// Environment variables
const API_PORT = parseInt(process.env.API_PORT || "5001", 10);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Initialize Socket.IO with the server
const io = new Server(server, {
  cors: {
    origin: '*',  // ✅ toutes les origines
    methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling']
});


// Test Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected to socket:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Initialize socket services after io is created
ChatService.initializeChatSocket(io);
NotificationService.initializeSocketIO(io);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(morgan("dev"));

// Static files

// Routes
app.use("/", router);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// // Ajoutez cette route à la fin de vos routes
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
// });
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database connection and server start
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Start the server
    server.listen(API_PORT,'0.0.0.0', () => {
      console.log(`Server is running on port ${API_PORT}`);
      console.log(`WebSocket server initialized`);
      console.log(`Accepting requests from ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Start the server
startServer();

export default app;
