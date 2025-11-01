import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { AlertCircle } from "lucide-react";

const OAuth2Failure = () => {
  const navigate = useNavigate();

  useEffect(() => {
    toast.error("OAuth2 authentication failed");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Authentication Failed</CardTitle>
          <CardDescription>
            We couldn't complete your OAuth2 authentication. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => navigate("/")} className="w-full">
            Return to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuth2Failure;
