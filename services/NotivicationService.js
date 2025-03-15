// services/NotificationService.js
import Notification from '../models/Notification.js';

let io = null;
let connectedUsers = new Map();

// Initialize Socket.IO instance
export const initializeSocketIO = (socketIo) => {
  io = socketIo;
  if (!io) {
    console.error('Socket.IO instance not provided to NotificationService');
    return;
  }

  io.on('connection', (socket) => {
   
    // Handle user registration
    socket.on('register', (userId) => {
      if (!userId) return;
      connectedUsers.set(userId, socket);
     
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      for (const [userId, userSocket] of connectedUsers.entries()) {
        if (userSocket === socket) {
          connectedUsers.delete(userId);
          
          break;
        }
      }
    });
  });
};

// Create and send notification
export const createNotification = async (receiverId, notif) => {
  try {
    // Validate notification data
    if (!receiverId || !notif) {
      throw new Error('Invalid notification data');
    }

    // Create notification in database
    const notification = new Notification({
      ...notif,
      receiverId,
      timestamp: new Date(),
      read: false
    });

    await notification.save();
    
    // Send real-time notification
    await sendNotification(receiverId, notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get notifications for a user
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const notifications = await Notification.find({ receiverId:userId  })
    .sort({ timestamp: -1 })
    .limit(100); // Optional: limit the number of notifications returned
    
    return res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

// Send real-time notification
const sendNotification = async (userId, notificationData) => {
  try {
    const socket = connectedUsers.get(userId);
    if (socket) {
      socket.emit('notification', notificationData);
      
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Optional: Add method to mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const result = await Notification.updateMany(
      { receiverId: userId, read: false },
      { read: true }
    );

    return res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};