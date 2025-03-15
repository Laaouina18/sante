import express from 'express';
import { 
  createNotification, 
  getNotifications,
  markAsRead,
  initializeSocketIO
} from '../services/NotivicationService.js';
import {verifyToken} from "../middlewares/auth.js"
const router = express.Router();



// Create a new notification
router.post('/', createNotification);

// Get a user's notifications
router.get('/', verifyToken,getNotifications);

// Mark a notification as read
router.put('/:id/read', markAsRead);

export default router;