import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

class WebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.subscriptions = new Map();
  }

  // Connect to WebSocket
  connect(email, onNotificationReceived) {
    return new Promise((resolve, reject) => {
      try {
        const socket = new SockJS('https://spring-boot-chat-backend-production.up.railway.app/chat');
        this.stompClient = Stomp.over(socket);
        
        this.stompClient.connect({}, (frame) => {
          console.log('Connected to WebSocket:', frame);
          this.connected = true;
          
          // Subscribe to notifications for the specific email
          this.subscribeToNotifications(email, onNotificationReceived);
          
          resolve();
        }, (error) => {
          console.error('WebSocket connection error:', error);
          this.connected = false;
          reject(error);
        });
      } catch (error) {
        console.warn('WebSocket dependencies not available:', error.message);
        // Resolve without error to allow app to continue
        resolve();
      }
    });
  }

  // Subscribe to notifications for a specific email
  subscribeToNotifications(email, callback) {
    if (!this.stompClient || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }

    const subscription = this.stompClient.subscribe(
      `/topic/notifications/${email}`,
      (message) => {
        try {
          const notification = JSON.parse(message.body);
          console.log('Received notification:', notification);
          callback(notification);
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      }
    );

    this.subscriptions.set(`notifications-${email}`, subscription);
  }

  // Subscribe to user status updates
  subscribeToUserStatus(callback) {
    if (!this.stompClient || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }

    const subscription = this.stompClient.subscribe(
      '/topic/user-status',
      (message) => {
        try {
          const statusUpdate = JSON.parse(message.body);
          console.log('Received user status update:', statusUpdate);
          callback(statusUpdate);
        } catch (error) {
          console.error('Error parsing user status update:', error);
        }
      }
    );

    this.subscriptions.set('user-status', subscription);
    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete('user-status');
    };
  }

  // Unsubscribe from notifications
  unsubscribeFromNotifications(email) {
    const subscriptionKey = `notifications-${email}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.stompClient) {
      // Unsubscribe from all subscriptions
      this.subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      this.subscriptions.clear();
      
      this.stompClient.disconnect();
      this.connected = false;
      console.log('Disconnected from WebSocket');
    }
  }

  // Check if connected
  isConnected() {
    return this.connected;
  }

  // Send message (if needed)
  sendMessage(destination, message) {
    if (this.stompClient && this.connected) {
      this.stompClient.send(destination, {}, JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService; 