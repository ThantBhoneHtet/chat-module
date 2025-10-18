import api from '../config/axios';

// Dummy data fallback
const dummyVolunteers = [
  {
  volunteerId: '1',
  email: 'emma@example.com',
  firstName: 'Emma',
  lastName: 'Brown',
  avatarUrl: '/placeholder-avatar.jpg',
  location: {
    city: 'New York',
    state: 'NY',
  },
  bio: 'Passionate about environmental causes',
  skills: ['Photography', 'Content Writing', 'Environmental Science'],
  status: 'active',
  totalHours: 127,
  completedOpportunities: 24,
  rating: 4.8
  },
  {
  volunteerId: '2',
  email: 'liam@example.com',
  firstName: 'Liam',
  lastName: 'Smith',
  avatarUrl: '/placeholder-avatar-2.jpg',
  location: {
    city: 'Los Angeles',
    state: 'CA',
    coordinates: [-118.2437, 34.0522]
  },
  bio: 'Dedicated to community building and outreach.',
  skills: ['Event Planning', 'Public Speaking', 'Social Media'],
  status: 'active',
  totalHours: 210,
  completedOpportunities: 35,
  rating: 4.9
  }
];

const dummyVolunteerStats = {
  totalHours: 127,
  completedOpportunities: 24,
  teamMembers: 156,
  rating: 4.8
};

export const volunteersAPI = {
  // Register new volunteer
  register: async (volunteerData) => {
  try {
    const response = await api.post('/api/volunteers', volunteerData);
    return response.data;
  } catch (error) {
    console.error('API call failed during registration:', error);
    throw error;
  }
  },

  // Get a single volunteer's profile
  getProfile: async (volunteerId) => {
  try {
    const response = await api.get(`/api/volunteers/${volunteerId}`);
    return response.data;
  } catch (error) {
    console.warn(`API not available for getProfile, using dummy data for volunteerId ${volunteerId}:`, error.message);
    const volunteer = dummyVolunteers.find(v => v.volunteerId === volunteerId);
      return volunteer || dummyVolunteers[0]; // Fallback to the first dummy if not found
  }
  },

  // Get all volunteers with filters
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/volunteers?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      return dummyVolunteers;
    }
  },

  updateStatus: async (volunteerId, newStatus) => {
    // This endpoint pattern is common for Java/Spring backends, using a PUT request
    // to a specific sub-resource URI for a clear and RESTful action.
    try {
      const response = await api.put(`/api/volunteers/${volunteerId}/status`, { status: newStatus });
      return response.data; // Backend should return the updated volunteer or a success confirmation.
    } catch (error) {
      console.warn(`API not available for updateStatus on volunteer ${volunteerId}, simulating success:`, error.message);

      // Fallback logic for dummy data
      const volunteer = dummyVolunteers.find(v => v.volunteerId === volunteerId);
      if (volunteer) {
        volunteer.status = newStatus;
      }
      // Return a simulated success response
      return { success: true, volunteerId, status: newStatus };
    }
  },

  // Search for volunteers
  search: async (query) => {
    try {
      const response = await api.get(`/api/search/volunteers?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.warn('API not available for search, using dummy data:', error.message);
      const lowercasedQuery = query.toLowerCase();
      return dummyVolunteers.filter(v =>
        v.firstName.toLowerCase().includes(lowercasedQuery) ||
        v.lastName.toLowerCase().includes(lowercasedQuery) ||
        v.skills.some(skill => skill.toLowerCase().includes(lowercasedQuery))
      );
    }
  },

  // Update volunteer profile
  updateProfile: async (volunteerId, formData) => { // Expects a FormData object
  try {
    const response = await api.put(`/api/volunteers/${volunteerId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating volunteer profile:', error);
    throw error;
  }
  },

  // Delete a volunteer's profile
  deleteProfile: async (volunteerId) => {
    try {
      const response = await api.delete(`/api/volunteers/${volunteerId}`);
      return response.data; // Typically a success message
    } catch (error) {
      console.warn(`API not available for deleteProfile for volunteerId ${volunteerId}:`, error.message);
      // In a real scenario, you might want to simulate the removal from a local state.
      // For dummy data, we just return a success message.
      return { success: true, message: `Successfully deleted volunteer ${volunteerId} (simulation).` };
    }
  },

  // Get volunteer stats
  getStats: async (volunteerId) => {
  try {
    const response = await api.get(`/api/volunteers/${volunteerId}/stats`);
    return response.data;
  } catch (error) {
    console.warn('API not available for getStats, using dummy data:', error.message);
    return dummyVolunteerStats;
  }
  },

  // Get top-rated volunteers
  getTopRatedVolunteers: async (filters = {}) => {
    try {
      const response = await api.get('/api/volunteers/top-rated-volunteers', {
        data: filters
      });
      return response.data;
    } catch (error) {
      console.warn('API not available for getTopRatedVolunteers, using dummy data:', error.message);
    }
  },

  getFeedbacks: async (volunteerId) => {
  try {
    const response = await api.get(`/api/volunteers/${volunteerId}/feedbacks`);
    if(response.status !== 200) {
      return { feedbackDetails: [] };
    }
    return response.data;
  } catch (error) {
      console.warn(`API not available for getFeedbacks for volunteerId ${volunteerId}, using dummy data:`, error.message);
     
    }
  },

  // Get volunteer preferences
  getPreferences: async (volunteerId) => {
  try {
    const response = await api.get(`/api/volunteers/${volunteerId}/preferences`);
    return response.data;
  } catch (error) {
    console.warn('API not available for getPreferences, using dummy data:', error.message);
    return {
    notifications: { email: true, push: true, taskReminders: true, teamUpdates: true },
    privacy: { profileVisibility: true, activityStatus: true }
    };
  }
  },

  // Update volunteer preferences
  updatePreferences: async (volunteerId, preferences) => {
  try {
    const response = await api.put(`/api/volunteers/${volunteerId}/preferences`, preferences);
    return response.data;
  } catch (error) {
    console.warn('API not available for updatePreferences, using dummy data:', error.message);
    return preferences;
  }
  },
};