import { Client } from '@stomp/stompjs';

class UserStatusWebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.statusUpdateCallbacks = new Set();
    this.url = 'wss://spring-boot-chat-backend-production.up.railway.app/chat';
  }

  // Connect to WebSocket for user status updates
  connect() {
    return new Promise((resolve, reject) => {
      try {
        if (this.connected) {
          resolve();
          return;
        }

        this.stompClient = new Client({
          brokerURL: this.url,
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          debug: (str) => console.debug('[STOMP User Status]', str),
        });

        this.stompClient.onConnect = (frame) => {
          console.log('Connected to User Status WebSocket:', frame);
          this.connected = true;
          
          // Subscribe to user status updates
          this.subscribeToUserStatus();
          
          resolve();
        };

        this.stompClient.onStompError = (frame) => {
          console.error('User Status WebSocket STOMP error:', frame);
          this.connected = false;
          reject(new Error(frame.body));
        };

        this.stompClient.onWebSocketError = (error) => {
          console.error('User Status WebSocket error:', error);
          this.connected = false;
          reject(error);
        };

        this.stompClient.onDisconnect = () => {
          console.log('User Status WebSocket disconnected');
          this.connected = false;
        };

        this.stompClient.activate();

      } catch (error) {
        console.warn('User Status WebSocket not available:', error.message);
        resolve();
      }
    });
  }

  // Subscribe to user status updates
  subscribeToUserStatus() {
    if (!this.stompClient || !this.connected) {
      console.error('User Status WebSocket not connected');
      return;
    }

    this.stompClient.subscribe(
      '/topic/user-status',
      (message) => {
        try {
          const statusUpdate = JSON.parse(message.body);
          console.log('Received user status update:', statusUpdate);
          
          // Notify all callbacks
          this.statusUpdateCallbacks.forEach(callback => {
            callback(statusUpdate);
          });
        } catch (error) {
          console.error('Error parsing user status update:', error);
        }
      }
    );
  }

  // Add callback for status updates
  addStatusUpdateCallback(callback) {
    this.statusUpdateCallbacks.add(callback);
    
    // Return cleanup function
    return () => {
      this.statusUpdateCallbacks.delete(callback);
    };
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.stompClient && this.connected) {
      this.stompClient.deactivate();
      this.connected = false;
      this.statusUpdateCallbacks.clear();
      console.log('Disconnected from User Status WebSocket');
    }
  }

  // Check if connected
  isConnected() {
    return this.connected;
  }
}

// Create singleton instance
const userStatusWebSocketService = new UserStatusWebSocketService();

export default userStatusWebSocketService;