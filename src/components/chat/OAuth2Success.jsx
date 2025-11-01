import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authAPI } from "../../rest-api/services/auth";
import { toast } from "sonner";

const OAuth2Success = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleOAuthSuccess = async () => {
      const token = searchParams.get("token");
      const message = searchParams.get("message");

      if (!token) {
        toast.error("Authentication failed: No token received");
        navigate("/");
        return;
      }

      try {
        // Store JWT token
        sessionStorage.setItem('jwtToken', token);

        // Fetch user data
        const userData = await authAPI.getCurrentUser();
        login(userData);

        toast.success(message || "Login successful!");
        navigate("/chat");
      } catch (error) {
        console.error("OAuth success handler error:", error);
        toast.error("Failed to complete authentication");
        sessionStorage.removeItem('jwtToken');
        navigate("/");
      }
    };

    handleOAuthSuccess();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
};

export default OAuth2Success;
