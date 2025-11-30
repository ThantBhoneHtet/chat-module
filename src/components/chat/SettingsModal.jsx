import React, { useState, useEffect, useRef } from 'react';
import { ImagePlus, Trash2, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { usersAPI } from '../../rest-api/services/users';
import { useToast } from '../../hooks/use-toast';
import defaultWallpaper from '../../assets/wallpaperflare.com_wallpaper.jpg';

const SettingsModal = ({ isOpen, onClose, currentUser }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Font size settings
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('chatFontSize') || '14');
  });

  // Theme/Background settings
  const [backgroundImages, setBackgroundImages] = useState(() => {
    const saved = localStorage.getItem('chatBackgroundImages');
    return saved ? JSON.parse(saved) : [{ id: 'default', url: defaultWallpaper, name: 'Default' }];
  });
  const [selectedBackground, setSelectedBackground] = useState(() => {
    return localStorage.getItem('chatBackground') || 'default';
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    searchVisibility: true,
  });

  useEffect(() => {
    if (currentUser && isOpen) {
      setPrivacySettings({
        profileVisibility: currentUser.privacySettings?.profileVisibility || 'public',
        searchVisibility: currentUser.privacySettings?.searchVisibility ?? true,
      });
    }
  }, [currentUser, isOpen]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`);
    localStorage.setItem('chatFontSize', fontSize.toString());
  }, [fontSize]);

  // Apply background
  useEffect(() => {
    localStorage.setItem('chatBackground', selectedBackground);
    localStorage.setItem('chatBackgroundImages', JSON.stringify(backgroundImages));
    
    // Dispatch custom event to notify MessageDisplay
    window.dispatchEvent(new CustomEvent('chatBackgroundChange', { 
      detail: { 
        backgroundId: selectedBackground,
        backgroundUrl: backgroundImages.find(bg => bg.id === selectedBackground)?.url 
      } 
    }));
  }, [selectedBackground, backgroundImages]);

  const handleAddBackgroundImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image under 5MB',
          variant: 'destructive',
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/jpeg') && !file.type.startsWith('image/jpg')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a JPG image',
          variant: 'destructive',
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage = {
          id: `custom-${Date.now()}`,
          url: reader.result,
          name: file.name,
        };
        setBackgroundImages(prev => [...prev, newImage]);
        toast({
          title: 'Image added',
          description: 'Background image has been added successfully.',
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemoveBackground = (imageId) => {
    if (imageId === 'default') return;
    
    setBackgroundImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedBackground === imageId) {
      setSelectedBackground('default');
    }
    toast({
      title: 'Image removed',
      description: 'Background image has been removed.',
    });
  };

  const handlePrivacyChange = async (key, value) => {
    const newSettings = { ...privacySettings, [key]: value };
    setPrivacySettings(newSettings);

    try {
      const submitData = new FormData();
      const dto = {
        privacySettings: newSettings,
      };
      submitData.append('dto', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
      
      await usersAPI.updateProfile(currentUser.userId || currentUser.id, submitData);
      
      // Update sessionStorage
      const storedUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      storedUser.privacySettings = newSettings;
      sessionStorage.setItem('currentUser', JSON.stringify(storedUser));

      toast({
        title: 'Settings updated',
        description: 'Privacy settings have been saved.',
      });
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to save privacy settings.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Font Size</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust the text size for chat messages
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-8">A</span>
                  <Slider
                    value={[fontSize]}
                    onValueChange={([value]) => setFontSize(value)}
                    min={12}
                    max={20}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-lg font-medium w-8">A</span>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {fontSize}px
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-muted-foreground text-sm mb-2">Preview:</p>
                <p style={{ fontSize: `${fontSize}px` }} className="text-foreground">
                  This is how your messages will look.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Themes Tab */}
          <TabsContent value="themes" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Chat Background</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose or upload a background image for your chat
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {backgroundImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedBackground === image.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                    onClick={() => setSelectedBackground(image.id)}
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedBackground === image.id && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {image.id !== 'default' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBackground(image.id);
                        }}
                        className="absolute bottom-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add New Image Button */}
                <button
                  onClick={handleAddBackgroundImage}
                  className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add Image</span>
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Supported format: JPG. Max size: 5MB. Recommended resolution: 1920x1080
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6 pt-4">
            <div className="space-y-6">
              {/* Profile Visibility */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Profile Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Control who can see your profile information
                </p>
                <Select
                  value={privacySettings.profileVisibility}
                  onValueChange={(value) => handlePrivacyChange('profileVisibility', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Everyone can see</SelectItem>
                    <SelectItem value="connections">Connections Only</SelectItem>
                    <SelectItem value="private">Private - Only you</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Visibility */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Search Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow others to find you through search
                  </p>
                </div>
                <Switch
                  checked={privacySettings.searchVisibility}
                  onCheckedChange={(checked) => handlePrivacyChange('searchVisibility', checked)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
