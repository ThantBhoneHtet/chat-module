import React, { useState, useEffect } from 'react';
import { Menu, User, Bookmark, Settings, Moon, Sun, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import avatarPlaceholder from "../../assets/avatar.jpg";
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import { useAuth } from '../../context/AuthContext';

const HamburgerMenu = ({ currentUser, onOpenSavedMessages }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const { logout } = useAuth();

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const handleDarkModeToggle = (checked) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    setIsProfileModalOpen(true);
  };

  const handleSavedMessagesClick = () => {
    setIsOpen(false);
    onOpenSavedMessages?.();
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    setIsSettingsModalOpen(true);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const menuItems = [
    {
      icon: User,
      label: 'My Profile',
      onClick: handleProfileClick,
    },
    {
      icon: Bookmark,
      label: 'Saved Messages',
      onClick: handleSavedMessagesClick,
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: handleSettingsClick,
    },
  ];

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 bg-card">
          <SheetHeader className="p-6 pb-4 bg-primary/10">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={currentUser?.avatarUrl || avatarPlaceholder} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl">
                  {currentUser?.firstName?.charAt(0) || 'U'}
                  {currentUser?.lastName?.charAt(0) || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left text-lg font-semibold text-foreground truncate">
                  {currentUser?.firstName || 'User'} {currentUser?.lastName || ''}
                </SheetTitle>
                <p className="text-sm text-muted-foreground truncate">
                  {currentUser?.email || ''}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="py-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center space-x-4 px-6 py-3 hover:bg-accent transition-colors text-left"
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground font-medium">{item.label}</span>
              </button>
            ))}

            <Separator className="my-2" />

            {/* Night Mode Toggle */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center space-x-4">
                {isDarkMode ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-foreground font-medium">Night Mode</span>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>

            <Separator className="my-2" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-4 px-6 py-3 hover:bg-destructive/10 transition-colors text-left"
            >
              <LogOut className="h-5 w-5 text-destructive" />
              <span className="text-destructive font-medium">Log Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
};

export default HamburgerMenu;
