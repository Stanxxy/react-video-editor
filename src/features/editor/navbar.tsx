import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import { HISTORY_UNDO, HISTORY_REDO, DESIGN_RESIZE, EDIT_OBJECT } from "@designcombo/state";
import { Icons } from "@/components/shared/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Download, MenuIcon, ShareIcon, Monitor, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IDesign } from "@designcombo/types";
import { useDownloadState } from "./store/use-download-state";
import DownloadProgressModal from "./download-progress-modal";
import AutosizeInput from "@/components/ui/autosize-input";
import useStore from "./store/use-store";
import { debounce } from "lodash";
import { useScreenSize } from "../../utils/mobile";

export default function Navbar({
  stateManager,
  setProjectName,
  projectName,
}: {
  user: null;
  stateManager: StateManager;
  setProjectName: (name: string) => void;
  projectName: string;
}) {
  const [title, setTitle] = useState(projectName);
  const { orientation, setOrientation, playerRef, trackItemsMap } = useStore();
  const screenSize = useScreenSize();

  // Check if any videos are present in the scene
  const hasVideos = Object.values(trackItemsMap).some(item => item.type === 'video');
  const isMobile = screenSize === 'mobile';

  const handleUndo = () => {
    dispatch(HISTORY_UNDO);
  };

  const handleRedo = () => {
    dispatch(HISTORY_REDO);
  };

  const handleOrientationChange = (newOrientation: 'horizontal' | 'vertical') => {
    console.log("🔄 Orientation change initiated:", newOrientation);
    
    // Store current player frame before orientation change
    const currentFrame = playerRef?.current?.getCurrentFrame() || 0;
    console.log("💾 Storing current frame:", currentFrame);
    
    const currentState = stateManager.getState();
    const oldSize = currentState.size;
    
    // Calculate new size based on orientation
    const newSize = newOrientation === 'horizontal' 
      ? { width: 1920, height: 1080 }  // YouTube 16:9
      : { width: 1080, height: 1920 }; // TikTok 9:16
    
    console.log("📐 Size change:", { from: oldSize, to: newSize });
    
    // Update orientation in store first
    setOrientation(newOrientation);
    
    // Update stateManager size first and let zoom recalculate
    setTimeout(() => {
      console.log("🎯 Updating stateManager size...");
      
      // Update canvas size
      stateManager.updateState({
        size: newSize,
      });
      
      // Wait for zoom to stabilize, then transform videos
      setTimeout(() => {
        console.log("🎬 Starting video transformation...");
        
        // Get current state after zoom recalculation
        const updatedState = stateManager.getState();
        const trackItemDetailsMap = updatedState.trackItemDetailsMap;
        const videoUpdates: Record<string, any> = {};
        
        console.log("📏 Canvas size change:", { from: oldSize, to: newSize });
        
        Object.keys(trackItemDetailsMap).forEach(itemId => {
          const item = trackItemDetailsMap[itemId];
          if (item?.type === 'video') {
            // Get video's original dimensions from metadata if available
            const originalVideoWidth = item.metadata?.width || parseFloat(String(item.details?.width || '0'));
            const originalVideoHeight = item.metadata?.height || parseFloat(String(item.details?.height || '0'));
            
            // Calculate video aspect ratio from original dimensions
            const aspectRatio = originalVideoWidth / originalVideoHeight;
            
            console.log(`📹 Video ${itemId} original dimensions:`, {
              originalVideoWidth,
              originalVideoHeight,
              aspectRatio
            });
            
            // Calculate what size the video should be to completely fill the new canvas
            const canvasAspectRatio = newSize.width / newSize.height;
            let newWidth, newHeight;
            
            if (aspectRatio > canvasAspectRatio) {
              // Video is wider relative to canvas - fit to width (fill entire width)
              newWidth = newSize.width;
              newHeight = newWidth / aspectRatio;
            } else {
              // Video is taller relative to canvas - fit to height (fill entire height)
              newHeight = newSize.height;
              newWidth = newHeight * aspectRatio;
            }
            
            console.log(`📐 Video fit calculation for ${itemId}:`, {
              videoAspectRatio: aspectRatio,
              canvasAspectRatio,
              fitStrategy: aspectRatio > canvasAspectRatio ? 'fit-to-width' : 'fit-to-height',
              newDimensions: [newWidth, newHeight]
            });
            
            // Center the video in the canvas (this matches the initial "fit" positioning)
            const newLeft = (newSize.width - newWidth) / 2;
            const newTop = (newSize.height - newHeight) / 2;
            
            console.log(`🎬 Transforming video ${itemId}:`, {
              aspectRatio,
              oldCanvas: [oldSize.width, oldSize.height],
              newCanvas: [newSize.width, newSize.height],
              newDimensions: [newWidth, newHeight],
              newPosition: [newLeft, newTop],
              centered: true
            });
            
            videoUpdates[itemId] = {
              details: {
                ...item.details,
                left: `${newLeft}px`,
                top: `${newTop}px`, 
                width: `${newWidth}px`,
                height: `${newHeight}px`,
              }
            };
          }
        });
        
        // Apply video transformations if any exist
        if (Object.keys(videoUpdates).length > 0) {
          console.log("🔄 Applying video transformations:", videoUpdates);
          dispatch(EDIT_OBJECT, {
            payload: videoUpdates
          });
        }
        
        // Restore player frame after transformations complete
        setTimeout(() => {
          if (currentFrame > 0 && playerRef?.current) {
            console.log("🎬 Restoring player frame:", currentFrame);
            playerRef.current.seekTo(currentFrame);
          }
        }, 100);
        
        console.log("✅ Orientation change complete");
      }, 150); // Wait for zoom to stabilize
    }, 50);
  };

  const handleCreateProject = async () => {};

  // Create a debounced function for setting the project name
  const debouncedSetProjectName = useCallback(
    debounce((name: string) => {
      console.log("Debounced setProjectName:", name);
      setProjectName(name);
    }, 2000), // 2 seconds delay
    [],
  );

  // Update the debounced function whenever the title changes
  useEffect(() => {
    debouncedSetProjectName(title);
  }, [title, debouncedSetProjectName]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  // Keyboard shortcuts for navbar controls (disabled on mobile)
  useEffect(() => {
    // Don't add keyboard listeners on mobile devices
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Handle Z for undo (changed from Ctrl+Z to just Z)
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      // Handle Shift+Z for redo (changed from Ctrl+Shift+Z to just Shift+Z)
      else if (event.shiftKey && event.key === 'Z') {
        event.preventDefault();
        handleRedo();
      }
      // Handle Escape key to blur inputs (removed clip unselection)
      else if (event.key === 'Escape') {
        event.preventDefault();
        // Blur any focused input element
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
          activeElement.blur();
        }
      }
    };

    // Add event listener to document for global shortcuts
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo, isMobile]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr auto" : "320px 1fr 320px",
      }}
      className={`bg-sidebar pointer-events-none flex items-center border-b border-border/80 px-2 ${
        isMobile ? 'h-[48px]' : 'h-[58px]'
      }`}
    >
      <DownloadProgressModal />

      <div className="flex items-center gap-2">
        <div className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-md text-zinc-200">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="hover:bg-background-subtle flex h-8 w-8 items-center justify-center">
                <MenuIcon className="h-5 w-5" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[300] w-56 p-2" align="start">
              <DropdownMenuItem
                onClick={handleCreateProject}
                className="cursor-pointer text-muted-foreground"
              >
                New project
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-muted-foreground">
                My projects
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCreateProject}
                className="cursor-pointer text-muted-foreground"
              >
                Duplicate project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Undo/Redo buttons - Hidden on mobile */}
        {!isMobile && (
          <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5">
            <Button
              onClick={handleUndo}
              className="text-muted-foreground"
              variant="ghost"
              size="icon"
              title="Undo (Z)"
            >
              <Icons.undo width={20} />
            </Button>
            <Button
              onClick={handleRedo}
              className="text-muted-foreground"
              variant="ghost"
              size="icon"
              title="Redo (Shift+Z)"
            >
              <Icons.redo width={20} />
            </Button>
          </div>
        )}
        
        {/* Orientation Toggle - Hidden on mobile */}
        {!isMobile && (
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5 border-l border-border/40">
          <Button
            onClick={hasVideos ? undefined : () => handleOrientationChange('horizontal')}
            className={`${hasVideos ? 'text-muted-foreground/50 cursor-not-allowed' : 'text-muted-foreground'} ${orientation === 'horizontal' && !hasVideos ? 'bg-background text-white' : ''}`}
            variant="ghost"
            size="icon"
            disabled={hasVideos}
            title={hasVideos ? "Cannot switch orientation when videos are present" : "Horizontal (YouTube 16:9)"}
          >
            <Monitor width={16} />
          </Button>
          <Button
            onClick={hasVideos ? undefined : () => handleOrientationChange('vertical')}
            className={`${hasVideos ? 'text-muted-foreground/50 cursor-not-allowed' : 'text-muted-foreground'} ${orientation === 'vertical' && !hasVideos ? 'bg-background text-white' : ''}`}
            variant="ghost"
            size="icon"
            disabled={hasVideos}
            title={hasVideos ? "Cannot switch orientation when videos are present" : "Vertical (TikTok 9:16)"}
          >
            <Smartphone width={16} />
          </Button>
        </div>
        )}
      </div>

      {!isMobile && (
      <div className="flex h-14 items-center justify-center gap-2">
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5 text-muted-foreground">
          <AutosizeInput
            name="title"
            value={title}
            onChange={handleTitleChange}
            width={200}
            inputClassName="border-none outline-none px-1 bg-background text-sm font-medium text-zinc-200"
          />
        </div>
      </div>
      )}

      <div className={`flex items-center justify-end gap-2 ${isMobile ? 'h-12' : 'h-14'}`}>
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5">
          <DownloadPopover stateManager={stateManager} />
        </div>
      </div>
    </div>
  );
}

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
  const { actions, exportType } = useDownloadState();
  const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const { trackItemsMap } = useStore();

  // Check if any videos are present in the scene
  const hasVideos = Object.values(trackItemsMap).some(item => item.type === 'video');

  // Get annotation count from localStorage
  const getAnnotationCount = () => {
    const annotationsData = localStorage.getItem('combat-annotations');
    if (annotationsData) {
      try {
        const annotations = JSON.parse(annotationsData);
        return Array.isArray(annotations) ? annotations.length : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const annotationCount = getAnnotationCount();

  const handleExport = () => {
    const data: IDesign = {
      id: generateId(),
      ...stateManager.getState(),
    };

    actions.setState({ payload: data });
    actions.startExport();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="flex h-8 gap-1 border border-border"
          variant="outline"
        >
          <Download width={18} /> Export
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="bg-black border-border z-[250] flex w-60 flex-col gap-4"
      >
        <Label>Export settings</Label>

        <Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
          <PopoverTrigger asChild>
            <Button className="w-full justify-between" variant="outline">
              <div>{exportType.toUpperCase()}</div>
              <ChevronDown width={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="bg-black border-border z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
            <div
              className="flex h-8 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
              onClick={() => {
                actions.setExportType("excel");
                setIsExportTypeOpen(false);
              }}
            >
              EXCEL
            </div>
            <div
              className="flex h-8 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
              onClick={() => {
                actions.setExportType("json");
                setIsExportTypeOpen(false);
              }}
            >
              JSON
            </div>
          </PopoverContent>
        </Popover>

        {exportType === "json" && (
          <div className="text-xs text-muted-foreground p-2 bg-background/20 rounded">
            <div className="font-medium mb-1">JSON Export</div>
            <div>📊 {annotationCount} annotation{annotationCount !== 1 ? 's' : ''} available</div>
            <div className="mt-1">Will export in VideoEvent schema format</div>
          </div>
        )}

        {exportType === "excel" && (
          <div className="text-xs text-muted-foreground p-2 bg-background/20 rounded">
            <div className="font-medium mb-1">Excel Export</div>
            <div>📊 {annotationCount} annotation{annotationCount !== 1 ? 's' : ''} available</div>
            <div className="mt-1">Will export as CSV file for analysis in Excel or other tools</div>
          </div>
        )}

        <div>
          <Button 
            onClick={handleExport} 
            className="w-full"
            disabled={(exportType === "json" && annotationCount === 0) || (exportType === "excel" && annotationCount === 0)}
            title={annotationCount === 0 ? "No annotations available to export" : ""}
          >
            Export {exportType === "json" ? "JSON" : "Excel"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ResizeOptionProps {
  label: string;
  icon: string;
  value: ResizeValue;
  description: string;
}

interface ResizeValue {
  width: number;
  height: number;
  name: string;
}

const RESIZE_OPTIONS: ResizeOptionProps[] = [
  {
    label: "16:9",
    icon: "landscape",
    description: "YouTube ads",
    value: {
      width: 1920,
      height: 1080,
      name: "16:9",
    },
  },
  {
    label: "9:16",
    icon: "portrait",
    description: "TikTok, YouTube Shorts",
    value: {
      width: 1080,
      height: 1920,
      name: "9:16",
    },
  },
  {
    label: "1:1",
    icon: "square",
    description: "Instagram, Facebook posts",
    value: {
      width: 1080,
      height: 1080,
      name: "1:1",
    },
  },
];

const ResizeVideo = () => {
  const handleResize = (options: ResizeValue) => {
    dispatch(DESIGN_RESIZE, {
      payload: {
        ...options,
      },
    });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="border border-border" variant="secondary">
          Resize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[250] w-60 px-2.5 py-3">
        <div className="text-sm">
          {RESIZE_OPTIONS.map((option, index) => (
            <ResizeOption
              key={index}
              label={option.label}
              icon={option.icon}
              value={option.value}
              handleResize={handleResize}
              description={option.description}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ResizeOption = ({
  label,
  icon,
  value,
  description,
  handleResize,
}: ResizeOptionProps & { handleResize: (payload: ResizeValue) => void }) => {
  const Icon = Icons[icon as "text"];
  return (
    <div
      onClick={() => handleResize(value)}
      className="flex cursor-pointer items-center rounded-md p-2 hover:bg-zinc-50/10"
    >
      <div className="w-8 text-muted-foreground">
        <Icon size={20} />
      </div>
      <div>
        <div>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
};
