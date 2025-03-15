import Chat from "../models/chat.js";


export const initializeSocketIO = (io) => {
  if (!io) {
    console.error('Socket.IO instance not provided to NotificationService');
    return;
  }

  io.on("connection", (socket) => {
    console.log("New notification connection:", socket.id);
    
    // Notification handling logic here...
  });
};

export const initializeChatSocket = (io) => {
  if (!io) {
    console.error('Socket.IO instance not provided to ChatService');
    return;
  }

  io.on("connection", (socket) => {
    console.log("New chat connection:", socket.id);

    socket.on("join_chat", (userId) => {
      if (!userId) {
        socket.emit("error", { message: "UserId is required" });
        return;
      }
      socket.join(userId);
      console.log(`User ${userId} joined chat`);
    });

    // Rest of the chat event handlers...
  });
};

