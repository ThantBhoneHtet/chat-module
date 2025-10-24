import { Toaster } from "../src/components/chat/ui/toaster";
import { Toaster as Sonner } from "../src/components/chat/ui/sonner";
import { TooltipProvider } from "../src/components/chat/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// import { ProtectedRoute } from "./shared/components/auth/ProtectedRoute";
import { AuthProvider } from "../src/context/AuthContext";
// import VolunteerProfile from "./components/chat/VolunteerProfile";
import Messages from "./components/chat/Messages";
import LoginPage from "./components/chat/LoginPage";


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/chat" element={<Messages />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App
