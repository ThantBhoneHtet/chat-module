import api from '../config/axios';
import { Client } from '@stomp/stompjs';

// Dummy data fallback
const messages = [
  {
    messageId: '1',
    chatId: '7w8G94enpgJghFLAwtDh',
    senderId: 'org1',
    receiverId: 'vol1',
    messageType: 'direct',
    content: 'Thanks for applying to our tree planting project! We are excited to have you.',
    attachments: [],
    readBy: [{ userId: 'vol1', readAt: '2024-01-13T11:00:00Z' }],
    sentAt: '2024-01-13T10:30:00Z'
  },
  {
    messageId: '2',
    chatId: '7w8G94enpgJghFLAwtDh',
    senderId: 'vol1',
    receiverId: 'org1',
    messageType: 'direct',
    content: 'Thank you! I am looking forward to contributing to this important cause.',
    attachments: [],
    readBy: [{ userId: 'org1', readAt: '2024-01-13T12:00:00Z' }],
    sentAt: '2024-01-13T11:30:00Z'
  }
];

// Chat management API
export const chatAPI = {
  async checkChatExists(participantIds) {
    try {      
      const response = await api.post('/api/chats/isExisted', participantIds);
      return response.data; // Should return chatId if exists
    } catch (error) {
      console.error('Error checking chat exists:', error);
      return null;
    }
  },

  // Create new chat
  async createChat(chatRequest) {
    try {
      const response = await api.post('/api/chats', chatRequest);
      return response.data;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  },

  // Get chat by ID
  async getChatById(chatId) {
    try {
      const response = await api.get(`/api/chats/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting chat by ID:', error);
      throw error;
    }
  },

  // Get chat participants
  async getChatParticipants(chatId) {
    try {
      const response = await api.get(`/api/chats/${chatId}/participants`);
      return response.data;
    } catch (error) {
      console.error('Error getting chat participants:', error);
      throw error;
    }
  },

  // Update chat participants
  async updateParticipants(chatId, participantIds) {
    try {
      const response = await api.put(`/api/chats/${chatId}/update-participants`, participantIds);
      return response.data;
    } catch (error) {
      console.error('Error updating participants:', error);
      throw error;
    }
  },

  // Delete chat
  async deleteChat(chatId) {
    try {
      const response = await api.delete(`/api/chats/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },

  // Update group chat info (name, image)
  async updateGroupChat(chatId, gpChatEditDto) {
    try {
      const response = await api.put(`/api/chats/${chatId}`, gpChatEditDto);
      return response.data;
    } catch (error) {
      console.error('Error updating group chat:', error);
      throw error;
    }
  }
};

const websocketAPI = {
  url: 'wss://spring-boot-chat-backend-production.up.railway.app/chat',
  stompClient: null,
  subscriptions: new Map(), // Track subscriptions by chatId
  listeners: new Map(),     // Track message listeners by chatId
  connectionPromise: null,

  // Initialize global WebSocket connection
  connect: () => {
    if (websocketAPI.connectionPromise) {
      return websocketAPI.connectionPromise;
    }

    websocketAPI.connectionPromise = new Promise((resolve, reject) => {
      // Don't reconnect if already connected
      if (websocketAPI.stompClient && websocketAPI.stompClient.connected) {
        resolve();
        return;
      }

      // Initialize new STOMP client
      websocketAPI.stompClient = new Client({
        brokerURL: websocketAPI.url,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: (str) => console.debug('[STOMP]', str),
        
        onConnect: () => {
          console.log('WebSocket connected');
          resolve(); 
        },
        
        onStompError: (frame) => {
          console.error('STOMP protocol error:', frame.headers.message);
          reject(frame);
        },
        
        onWebSocketError: (event) => {
          console.error('WebSocket error:', event);
          reject(event);
        },
        
        onDisconnect: () => {
          console.log('WebSocket disconnected');
          websocketAPI.connectionPromise = null;
        }
      });

      // Activate connection
      websocketAPI.stompClient.activate();
    });

    return websocketAPI.connectionPromise;
  },

  // Subscribe to a specific chat
  subscribeToChat: async (chatId, callback) => {
    // Ensure connection is established first
    await websocketAPI.connect();
    
    if (!websocketAPI.stompClient || !websocketAPI.stompClient.connected) {
      console.error('Cannot subscribe - WebSocket not connected');
      return null;
    }
    
    // If already subscribed to this chat, just add the listener
    if (websocketAPI.subscriptions.has(chatId)) {
      websocketAPI.addMessageListener(chatId, callback);
      return () => websocketAPI.removeMessageListener(chatId, callback);
    }
    
    // Subscribe to the chat topic
    const subscription = websocketAPI.stompClient.subscribe(
      `/topic/chat/${chatId}`,
      (message) => {
        try {
          const payload = JSON.parse(message.body);
          
          // Call all registered listeners for this chat
          const listeners = websocketAPI.listeners.get(chatId) || [];
          listeners.forEach(cb => cb(payload));
        } catch (e) {
          console.error('Message parse error:', e);
        }
      }
    );
    
    // Store subscription
    websocketAPI.subscriptions.set(chatId, subscription);
    
    // Add the callback as a listener
    websocketAPI.addMessageListener(chatId, callback);
    
    // Return unsubscribe function
    return () => {
      websocketAPI.removeMessageListener(chatId, callback);
      
      // If no more listeners for this chat, unsubscribe from topic
      const listeners = websocketAPI.listeners.get(chatId) || [];
      if (listeners.length === 0) {
        const sub = websocketAPI.subscriptions.get(chatId);
        if (sub) {
          sub.unsubscribe();
          websocketAPI.subscriptions.delete(chatId);
        }
      }
    };
  },

  // Add listener for specific chat
  addMessageListener: (chatId, callback) => {
    if (!websocketAPI.listeners.has(chatId)) {
      websocketAPI.listeners.set(chatId, []);
    }
    websocketAPI.listeners.get(chatId).push(callback);
  },

  // Remove listener for specific chat
  removeMessageListener: (chatId, callback) => {
    const listeners = websocketAPI.listeners.get(chatId) || [];
    websocketAPI.listeners.set(chatId, listeners.filter(cb => cb !== callback));
  },

  // Send message
  sendMessage: (chatId, message) => {
    if (websocketAPI.stompClient && websocketAPI.stompClient.connected) {
      websocketAPI.stompClient.publish({
        destination: `/app/chat/${chatId}/send`,
        body: JSON.stringify(message),
        headers: { 'content-type': 'application/json' }
      });
      return true;
    }
    console.error('Cannot send message - WebSocket not connected');
    return false;
  },

  // Disconnect
  disconnect: () => {
    if (websocketAPI.stompClient) {
      // Unsubscribe all subscriptions
      websocketAPI.subscriptions.forEach(sub => sub.unsubscribe());
      websocketAPI.subscriptions.clear();
      
      // Clear all listeners
      websocketAPI.listeners.clear();
      
      // Deactivate connection
      websocketAPI.stompClient.deactivate();
    }
  }
};
const messagesAPI = {
  // Get conversations for user
  getConversations: async (userId) => {
    try {
      const response = await api.get(`/api/chats/user/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      return dummyConversations.filter(conv => conv.participants.includes(userId));
    }
  },

  getChatParticpants: async (chatId) => {
    try {
      const response = await api.get(`/api/chats/${chatId}/participants`);
      return response.data;
    } catch (error) {
      console.log("Error fetching chat participants: ", error.message);
    }
  },

  getUserStatus: async (userId) => {
    try {
      const response = await api.get(`/api/chats/user/${userId}/status`);
      return response.data;
    } catch (error) {
      console.log("Error fetching user status: ", error.message);
    }
  },


  getOnlineUsersCount: async (participantIds, isGlobal = false) => {
    try {
      if (isGlobal) {
        const response = await api.get(`/api/chats/online-users-count`);
        return response.data;
      } else {
        const response = await api.post(`/api/chats/online-users-count`, participantIds);
        return response.data;
      }
    } catch (error) {
      console.log("Error fetching online users count: ", error.message);
    }
  },

  // Get messages in conversation with cursor pagination
  getMessages: async (chatId, lastMsgId = null, size = 20) => {
    try {
      let url = `/api/messages/chat/${chatId}?size=${size}`;
      if (lastMsgId) {
        url += `&lastMsgId=${lastMsgId}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      const allMessages = dummyMessages.filter(msg => msg.chatId === chatId);
      
      // Sort messages by sentAt descending (newest first) to match backend
      allMessages.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      
      let startIndex = 0;
      if (lastMsgId) {
        const lastIndex = allMessages.findIndex(msg => msg.messageId === lastMsgId);
        startIndex = lastIndex > -1 ? lastIndex + 1 : 0;
      }
      
      const endIndex = startIndex + size;
      const messages = allMessages.slice(startIndex, endIndex);
      
      return messages;
    }
  },

  uploadAttachment: async (chatId, formData) => {
    try {
      const response = await api.post(`/api/messages/chat/${chatId}/upload-attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
    }
  },
        

  // Mark message as read
  markAsRead: async (chatId, readerId) => {
    try {
      const response = await api.put(`/api/messages/${chatId}/read`, { readerId });
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      return { success: true };
    }
  },

  // Edit message
  editMessage: async (messageId, updateData) => {
    try {
      const response = await api.put(`/api/messages/${messageId}`, updateData);
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      return {
        messageId,
        ...updateData,
        editedAt: { seconds: Math.floor(Date.now() / 1000) }
      };
    }
  },

  // Delete message
  deleteMessage: async (messageId) => {
    try {
      const response = await api.delete(`/api/messages/${messageId}`);
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      return { success: true };
    }
  },

  // Start conversation
  startConversation: async (participants, initialMessage) => {
    try {
      const response = await api.post('/api/chats', {
        participants,
        initialMessage,
        type: 'direct'
      });
      return response.data;
    } catch (error) {
      console.warn('API not available, using dummy data:', error.message);
      return {
        conversationId: 'new-conv-id',
        participants,
        lastMessage: initialMessage,
        lastMessageTime: new Date().toISOString(),
        type: 'direct'
      };
    }
  }
};

// User Status API
const userStatusAPI = {
  // Update user online status
  updateStatus: async (userId, isOnline) => {
    try {
      const response = await api.post(`/users/${userId}/status/${isOnline}`);
      return response.data;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }
};

export { websocketAPI, messagesAPI, userStatusAPI };
