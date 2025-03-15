
import express from "express";
import { getConversation, getUserConversations,createConversation,markMessagesAsRead,createMessage } from "../controllers/ChatController.js";
import {verifyToken} from "../middlewares/auth.js"
const router = express.Router();

// Routes des conversations
router.get("/:userId/:otherUserId",verifyToken, getConversation);
router.get("/:userId",verifyToken, getUserConversations);
router.post("/", verifyToken,createConversation);
router.post("/messages",verifyToken, createMessage);
router.put("/read",verifyToken, markMessagesAsRead);
export default router;

// Dans app.js, ajoutez après l'initialisation de Socket.IO :
import { initializeChatSocket } from "../services/chat.js";
initializeChatSocket();