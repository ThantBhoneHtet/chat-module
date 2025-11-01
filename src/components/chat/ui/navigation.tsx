import { Link, useNavigate } from "react-router-dom";
import { 
  Home,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";

export const Navigation = ({
  user,
  onLogout,
  notificationCount = 0,
}: {
  user: any;
  onLogout: () => void;
  notificationCount?: number;
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout?.();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left side - Logo and main nav */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">UserHub</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link 
              to="/posts" 
              className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Opportunities
            </Link>
            <Link 
              to="/calendar" 
              className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Link>
            <Link 
              to="/messages" 
              className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Messages
            </Link>
          </nav>
        </div>

        {/* Right side - User controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-xs text-destructive-foreground flex items-center justify-center">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 pl-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} alt="User avatar" />
                  <AvatarFallback>
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-flex items-center gap-1">
                  {user?.name || "Account"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/help")}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};