// Central API exports
// export { adminApi as adminAPI } from './services/admin';
// export { analyticsAPI } from './services/analytics';
// export { applicationsAPI } from './services/applications';
// export { categoriesApi as categoriesAPI } from './services/categories';
// export { emailAPI } from './services/email';
// export { notificationAPI } from './services/notification-api';
// export { opportunitiesAPI  } from './services/opportunities';
// export { organizationRequestApi } from './services/organization-request';
// export { organizationsAPI } from './services/organizations';
// export { skillsApi as skillsAPI } from './services/skills';
// export { tasksAPI } from './services/tasks';
export { usersAPI } from './services/users';
export { messagesAPI, userStatusAPI, chatAPI } from './services/messages';
export { authAPI } from './services/auth';

// Export axios instance for custom API calls
export { default as api } from './config/axios';

