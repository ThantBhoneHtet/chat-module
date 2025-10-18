import { Toaster } from "../src/components/chat/ui/toaster";
import { Toaster as Sonner } from "../src/components/chat/ui/sonner";
import { TooltipProvider } from "../src/components/chat/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// import { ProtectedRoute } from "./shared/components/auth/ProtectedRoute";
import { AuthProvider } from "../src/context/AuthContext";
// import VolunteerProfile from "./components/chat/VolunteerProfile";
import Messages from "./components/chat/Messages";


const queryClient = new QueryClient();

function App() {
  // <QueryClientProvider client={queryClient}>
  //   <TooltipProvider>
  //     <Toaster />
  //     <Sonner />
  //     <BrowserRouter>
  //       <AuthProvider>
  //         <Routes>
  //           {/* <Route path="/volunteer/:id" element={<VolunteerProfile />} /> */}
  //         </Routes>
  //       </AuthProvider>
  //     </BrowserRouter>
  //   </TooltipProvider>
  // </QueryClientProvider>

  return (
    <>
      <main className="flex-1 p-6 overflow-auto">
          <Messages />
      </main>
      
    </>
  )
}

export default App
