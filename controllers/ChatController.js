// controllers/ChatController.js
import Chat from "../models/chat.js";
import mongoose from "mongoose";
import User from "../models/User.js";

let io = null;

// Initialize Socket.IO instance
export const initializeChatController = (socketIo) => {
  io = socketIo;
};

// Get conversation between two users
export const getConversation = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    if (!userId || !otherUserId) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }

    const messages = await Chat.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    })
    .sort({ createdAt: "asc" })
    .populate("sender", "firstName lastName image")
    .populate("receiver", "firstName lastName image");

    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all conversations for a user
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await Chat.aggregate([
      {
        $match: {
          $or: [
            { sender: userObjectId },
            { receiver: userObjectId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", userObjectId] },
              then: "$receiver",
              else: "$sender"
            }
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$read", false] },
                    { $ne: ["$sender", userObjectId] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $unwind: "$userDetails"
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          unreadCount: 1,
          userDetails: {
            _id: "$userDetails._id",
            firstName: "$userDetails.firstName",
            lastName: "$userDetails.lastName",
            image: "$userDetails.image",
            role: "$userDetails.role",
            speciality: "$userDetails.speciality"
          }
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create or get existing conversation
export const createConversation = async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }

    const existingMessages = await Chat.findOne({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    })
    .populate("sender", "firstName lastName image")
    .populate("receiver", "firstName lastName image");

    if (existingMessages) {
      return res.json(existingMessages);
    }

    const [user1Details, user2Details] = await Promise.all([
      User.findById(user1).select("firstName lastName image"),
      User.findById(user2).select("firstName lastName image")
    ]);

    if (!user1Details || !user2Details) {
      return res.status(404).json({ message: "One or both users not found" });
    }

    res.json({
      sender: user1Details,
      receiver: user2Details,
      messages: []
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create a new message
export const createMessage = async (req, res) => {
  try {
    const { sender, receiver, message } = req.body;

    if (!sender || !receiver || !message) {
      return res.status(400).json({ message: "Sender, receiver, and message are required" });
    }

    const newMessage = new Chat({
      sender,
      receiver,
      message,
      read: false,
      createdAt: new Date()
    });

    await newMessage.save();

    const populatedMessage = await Chat.findById(newMessage._id)
      .populate("sender", "firstName lastName image")
      .populate("receiver", "firstName lastName image");

    // Emit socket event if IO is initialized
    if (io) {
      io.to(receiver).emit('new_message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ message: error.message });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { sender, receiver } = req.body;

    if (!sender || !receiver) {
      return res.status(400).json({ message: "Sender and receiver are required" });
    }

    const result = await Chat.updateMany(
      {
        sender: sender,
        receiver: receiver,
        read: false
      },
      { read: true },
      { new: true }
    );

    if (io) {
      io.to(sender).emit('messages_read', { reader: receiver });
    }

    res.json({ message: "Messages marked as read", updatedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete conversation
export const deleteConversation = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    if (!userId || !otherUserId) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }

    const result = await Chat.deleteMany({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    });

    res.json({ message: "Conversation deleted", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ message: error.message });
  }
};