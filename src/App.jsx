import { Toaster } from "../src/components/chat/ui/toaster";
import { Toaster as Sonner } from "../src/components/chat/ui/sonner";
import { TooltipProvider } from "../src/components/chat/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import Messages from "./components/chat/Messages";
import LoginPage from "./components/chat/LoginPage";
import SignupPage from "./components/chat/SignupPage";
import OAuth2Success from "./components/chat/OAuth2Success";
import OAuth2Failure from "./components/chat/OAuth2Failure";


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/oauth2/success" element={<OAuth2Success />} />
              <Route path="/oauth2/failure" element={<OAuth2Failure />} />
              <Route path="/chat" element={<Messages />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App
