import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Create the authentication context
const AuthContext = createContext();

/**
 * AuthProvider component that provides authentication state and methods
 * to all child components
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Check authentication status
    const checkAuth = useCallback(() => {
        try {
            const currentUser = sessionStorage.getItem('currentUser');

            if (!currentUser) {
                setUser(null);
                setIsAuthenticated(false);
                setIsLoading(false);
                return false;
            }

            const userData = JSON.parse(currentUser);

            if (!userData || !userData.id) {
                setUser(null);
                setIsAuthenticated(false);
                setIsLoading(false);
                return false;
            }

            setUser(userData);
            setIsAuthenticated(true);
            setIsLoading(false);
            return true;

        } catch (error) {
            console.error('Error checking authentication:', error);
            setUser(null);
            setIsAuthenticated(false);
            setIsLoading(false);
            return false;
        }
    }, []);

    // Login function
    const login = useCallback((userData) => {
        try {
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error('Error during login:', error);
            return false;
        }
    }, []);

    // Logout function
    const logout = useCallback(async (logoutAPI = null) => {
        try {
            // Call logout API if provided
            if (logoutAPI && user) {
                await logoutAPI();
            }

            // Clear session storage
            sessionStorage.removeItem('currentUser');

            // Update state
            setUser(null);
            setIsAuthenticated(false);

            // Show success message
            toast.success('Logged out successfully!');

            // Redirect to login
            navigate('/');

        } catch (error) {
            console.error('Error during logout:', error);

            // Even if API fails, clear local session
            sessionStorage.removeItem('currentUser');
            setUser(null);
            setIsAuthenticated(false);

            toast.error('Logout failed, but you have been signed out locally.');
            navigate('/login');
        }
    }, [user, navigate]);

    // Check if user has specific role
    const hasRole = useCallback((requiredRole) => {
        return user && user.role === requiredRole;
    }, [user]);

    // Check if user has any of the specified roles
    const hasAnyRole = useCallback((roles) => {
        return user && Array.isArray(roles) && roles.includes(user.role);
    }, [user]);

    // Initialize authentication check on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        hasRole,
        hasAnyRole
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Custom hook to use the authentication context
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
