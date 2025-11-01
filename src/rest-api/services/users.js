import api from '../config/axios';

export const usersAPI = {
  // Register new user
  register: async (userData) => {
  try {
    const response = await api.post('/api/users', userData);
    return response.data;
  } catch (error) {
    console.error('API call failed during registration:', error);
    throw error;
  }
  },

  // Get a single user's profile
  getProfile: async (userId) => {
  try {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  } catch (error) {
    console.warn(`API not available for getProfile, using dummy data for userId ${userId}:`, error.message);
    const user = dummyusers.find(v => v.userId === userId);
      return user || dummyusers[0]; // Fallback to the first dummy if not found
  }
  },

  // Get all users with filters
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/users?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      return dummyusers;
    }
  },

  updateStatus: async (userId, newStatus) => {
    // This endpoint pattern is common for Java/Spring backends, using a PUT request
    // to a specific sub-resource URI for a clear and RESTful action.
    try {
      const response = await api.put(`/api/users/${userId}/status`, { status: newStatus });
      return response.data; // Backend should return the updated user or a success confirmation.
    } catch (error) {
      console.warn(`API not available for updateStatus on user ${userId}, simulating success:`, error.message);

      // Fallback logic for dummy data
      const user = dummyusers.find(v => v.userId === userId);
      if (user) {
        user.status = newStatus;
      }
      // Return a simulated success response
      return { success: true, userId, status: newStatus };
    }
  },

  // Search for users
  search: async (query) => {
    try {
      const response = await api.get(`/api/search/users?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.warn('API not available for search, using dummy data:', error.message);
      const lowercasedQuery = query.toLowerCase();
      return dummyusers.filter(v =>
        v.firstName.toLowerCase().includes(lowercasedQuery) ||
        v.lastName.toLowerCase().includes(lowercasedQuery) ||
        v.skills.some(skill => skill.toLowerCase().includes(lowercasedQuery))
      );
    }
  },

  // Update user profile
  updateProfile: async (userId, formData) => { // Expects a FormData object
  try {
    const response = await api.put(`/api/users/${userId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
  },

  // Delete a user's profile
  deleteProfile: async (userId) => {
    try {
      const response = await api.delete(`/api/users/${userId}`);
      return response.data; // Typically a success message
    } catch (error) {
      console.warn(`API not available for deleteProfile for userId ${userId}:`, error.message);
      // In a real scenario, you might want to simulate the removal from a local state.
      // For dummy data, we just return a success message.
      return { success: true, message: `Successfully deleted user ${userId} (simulation).` };
    }
  },

  // Get user stats
  getStats: async (userId) => {
  try {
    const response = await api.get(`/api/users/${userId}/stats`);
    return response.data;
  } catch (error) {
    console.warn('API not available for getStats, using dummy data:', error.message);
    return dummyuserStats;
  }
  },

  // Get top-rated users
  getTopRatedusers: async (filters = {}) => {
    try {
      const response = await api.get('/api/users/top-rated-users', {
        data: filters
      });
      return response.data;
    } catch (error) {
      console.warn('API not available for getTopRatedusers, using dummy data:', error.message);
    }
  },

  getFeedbacks: async (userId) => {
  try {
    const response = await api.get(`/api/users/${userId}/feedbacks`);
    if(response.status !== 200) {
      return { feedbackDetails: [] };
    }
    return response.data;
  } catch (error) {
      console.warn(`API not available for getFeedbacks for userId ${userId}, using dummy data:`, error.message);
     
    }
  },

  // Get user preferences
  getPreferences: async (userId) => {
  try {
    const response = await api.get(`/api/users/${userId}/preferences`);
    return response.data;
  } catch (error) {
    console.warn('API not available for getPreferences, using dummy data:', error.message);
    return {
    notifications: { email: true, push: true, taskReminders: true, teamUpdates: true },
    privacy: { profileVisibility: true, activityStatus: true }
    };
  }
  },

  // Update user preferences
  updatePreferences: async (userId, preferences) => {
  try {
    const response = await api.put(`/api/users/${userId}/preferences`, preferences);
    return response.data;
  } catch (error) {
    console.warn('API not available for updatePreferences, using dummy data:', error.message);
    return preferences;
  }
  },
};