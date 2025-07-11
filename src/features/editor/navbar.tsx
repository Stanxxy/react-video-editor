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
  const { orientation, setOrientation, playerRef } = useStore();

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
        
        // Calculate scaling factors for existing video items
        const scaleX = newSize.width / oldSize.width;
        const scaleY = newSize.height / oldSize.height;
        
        console.log("📏 Scale factors:", { scaleX, scaleY });
        
        Object.keys(trackItemDetailsMap).forEach(itemId => {
          const item = trackItemDetailsMap[itemId];
          if (item?.type === 'video') {
            const oldLeft = parseFloat(String(item.details?.left || '0'));
            const oldTop = parseFloat(String(item.details?.top || '0'));
            const oldWidth = parseFloat(String(item.details?.width || '0'));
            const oldHeight = parseFloat(String(item.details?.height || '0'));
            
            // Calculate original aspect ratio to preserve it
            const aspectRatio = oldWidth / oldHeight;
            
            // Calculate optimal size to fit the new canvas while maintaining aspect ratio
            let newWidth, newHeight;
            
            // Calculate what size the video should be to optimally fill the new canvas
            const canvasAspectRatio = newSize.width / newSize.height;
            
            if (aspectRatio > canvasAspectRatio) {
              // Video is wider relative to canvas - fit to width
              newWidth = newSize.width * 0.8; // Use 80% of canvas width for some padding
              newHeight = newWidth / aspectRatio;
            } else {
              // Video is taller relative to canvas - fit to height  
              newHeight = newSize.height * 0.8; // Use 80% of canvas height for some padding
              newWidth = newHeight * aspectRatio;
            }
            
            console.log(`📐 Video fit calculation for ${itemId}:`, {
              videoAspectRatio: aspectRatio,
              canvasAspectRatio,
              fitStrategy: aspectRatio > canvasAspectRatio ? 'fit-to-width' : 'fit-to-height',
              newDimensions: [newWidth, newHeight]
            });
            
            // For position, center the video in the new canvas for optimal fit
            const canvasCenterX = newSize.width / 2;
            const canvasCenterY = newSize.height / 2;
            
            // Center the video in the canvas
            const newLeft = canvasCenterX - (newWidth / 2);
            const newTop = canvasCenterY - (newHeight / 2);
            
            console.log(`🎬 Transforming video ${itemId}:`, {
              aspectRatio,
              oldCanvas: [oldSize.width, oldSize.height],
              newCanvas: [newSize.width, newSize.height],
              size: { from: [oldWidth, oldHeight], to: [newWidth, newHeight] },
              position: { from: [oldLeft, oldTop], to: [newLeft, newTop] },
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px",
      }}
      className="bg-sidebar pointer-events-none flex h-[58px] items-center border-b border-border/80 px-2"
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
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5">
          <Button
            onClick={handleUndo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.undo width={20} />
          </Button>
          <Button
            onClick={handleRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.redo width={20} />
          </Button>
        </div>
        
        {/* Orientation Toggle */}
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5 border-l border-border/40">
          <Button
            onClick={() => handleOrientationChange('horizontal')}
            className={`text-muted-foreground ${orientation === 'horizontal' ? 'bg-background text-white' : ''}`}
            variant="ghost"
            size="icon"
            title="Horizontal (YouTube 16:9)"
          >
            <Monitor width={16} />
          </Button>
          <Button
            onClick={() => handleOrientationChange('vertical')}
            className={`text-muted-foreground ${orientation === 'vertical' ? 'bg-background text-white' : ''}`}
            variant="ghost"
            size="icon"
            title="Vertical (TikTok 9:16)"
          >
            <Smartphone width={16} />
          </Button>
        </div>
      </div>

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

      <div className="flex h-14 items-center justify-end gap-2">
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5">
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="outline"
          >
            <ShareIcon width={18} /> Share
          </Button>
          <DownloadPopover stateManager={stateManager} />
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="default"
            onClick={() => {
              window.open("https://discord.gg/jrZs3wZyM5", "_blank");
            }}
          >
            Discord
          </Button>
        </div>
      </div>
    </div>
  );
}

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
  const { actions, exportType } = useDownloadState();
  const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
  const [open, setOpen] = useState(false);

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
        className="bg-sidebar z-[250] flex w-60 flex-col gap-4"
      >
        <Label>Export settings</Label>

        <Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
          <PopoverTrigger asChild>
            <Button className="w-full justify-between" variant="outline">
              <div>{exportType.toUpperCase()}</div>
              <ChevronDown width={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="bg-background-subtle z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
            <div
              className="flex h-8 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
              onClick={() => {
                actions.setExportType("mp4");
                setIsExportTypeOpen(false);
              }}
            >
              MP4
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
            <div className="font-medium mb-1">Annotation Export</div>
            <div>📊 {annotationCount} annotation{annotationCount !== 1 ? 's' : ''} available</div>
            <div className="mt-1">Will export in VideoEvent schema format</div>
          </div>
        )}

        <div>
          <Button 
            onClick={handleExport} 
            className="w-full"
            disabled={exportType === "json" && annotationCount === 0}
          >
            Export {exportType === "json" ? "Annotations" : "Video"}
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
