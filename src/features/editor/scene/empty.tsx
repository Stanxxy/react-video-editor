import useStore from "../store/use-store";
import { useEffect, useRef, useState } from "react";
import { Droppable } from "@/components/ui/droppable";
import { PlusIcon, Video } from "lucide-react";
import { DroppableArea } from "./droppable";
import { dispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { useScreenSize } from "../../../utils/mobile";
import { Button } from "@/components/ui/button";

const SceneEmpty = () => {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [desiredSize, setDesiredSize] = useState({ width: 0, height: 0 });
  const { size } = useStore();
  const screenSize = useScreenSize();
  
  const isMobile = screenSize === 'mobile';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle mobile file selection
  const handleMobileFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onSelectFiles(files);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !size?.width || !size?.height) {
      setIsLoading(false);
      return;
    }
    
    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    const { width, height } = size;

    // Ensure valid container dimensions
    if (containerWidth <= 0 || containerHeight <= 0) {
      setIsLoading(false);
      return;
    }

    const desiredZoom = Math.min(
      containerWidth / width,
      containerHeight / height,
    );
    
    console.log("📐 SceneEmpty size calculation:", {
      size,
      containerDimensions: { containerWidth, containerHeight },
      desiredZoom,
      finalSize: { width: width * desiredZoom, height: height * desiredZoom }
    });
    
    // Ensure minimum size for visibility
    const finalWidth = Math.max(width * desiredZoom, 200);
    const finalHeight = Math.max(height * desiredZoom, 150);
    
    setDesiredSize({
      width: finalWidth,
      height: finalHeight,
    });
    setIsLoading(false);
  }, [size]);

  const onSelectFiles = (files: File[]) => {
    console.log({ files });
    
    // Process each uploaded file
    files.forEach(async (file) => {
      // Check if it's a video file
      if (file.type.startsWith('video/')) {
        console.log("📁 Processing video file:", file.name, file.size, "bytes");
        
        // Create a blob URL for the uploaded video
        const videoUrl = URL.createObjectURL(file);
        
        // Create a video element to get duration and generate thumbnail
        const video = document.createElement('video');
        video.src = videoUrl;
        video.preload = 'metadata';
        
        video.addEventListener('loadedmetadata', () => {
          // Get actual video duration in milliseconds
          const durationMs = video.duration * 1000;
          
          console.log("📹 Video metadata loaded:", {
            duration: durationMs,
            width: video.videoWidth,
            height: video.videoHeight
          });
          
          // Generate thumbnail from video
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Set canvas size based on video dimensions
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw first frame to canvas
          video.currentTime = 0.1;
          
          video.addEventListener('seeked', () => {
            // Draw the video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert canvas to data URL instead of blob URL for stability
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            console.log("🖼️  Thumbnail generated as data URL (length):", thumbnailDataUrl.length);
            
            // Create a unique ID for the video
            const videoId = generateId();
            
            // Calculate video dimensions to fill the scene
            const sceneWidth = size.width;
            const sceneHeight = size.height;
            const videoAspectRatio = video.videoWidth / video.videoHeight;
            const sceneAspectRatio = sceneWidth / sceneHeight;
            
            let finalWidth, finalHeight;
            
            if (videoAspectRatio > sceneAspectRatio) {
              // Video is wider than scene, fit to width
              finalWidth = sceneWidth;
              finalHeight = sceneWidth / videoAspectRatio;
            } else {
              // Video is taller than scene, fit to height
              finalHeight = sceneHeight;
              finalWidth = sceneHeight * videoAspectRatio;
            }
            
            console.log("📐 Video sizing calculation:", {
              original: { width: video.videoWidth, height: video.videoHeight },
              scene: { width: sceneWidth, height: sceneHeight },
              final: { width: finalWidth, height: finalHeight },
              aspectRatio: videoAspectRatio
            });
            
            // Dispatch action to add video to timeline with proper duration
            dispatch(ADD_VIDEO, {
              payload: {
                id: videoId,
                type: "video",
                details: {
                  src: videoUrl,
                  width: finalWidth,
                  height: finalHeight,
                  top: (sceneHeight - finalHeight) / 2, // Center vertically
                  left: (sceneWidth - finalWidth) / 2, // Center horizontally
                },
                metadata: {
                  previewUrl: thumbnailDataUrl, // Use data URL instead of blob URL
                  fileName: file.name,
                  fileSize: file.size,
                  duration: durationMs,
                  originalFile: file, // Store the original file for MP4Clip
                  width: video.videoWidth, // Add original width to metadata
                  height: video.videoHeight, // Add original height to metadata
                },
                display: {
                  from: 0,
                  to: durationMs, // Use actual video duration
                },
                trim: {
                  from: 0,
                  to: durationMs, // Use actual video duration for trim
                },
                duration: durationMs, // Set duration property
                aspectRatio: videoAspectRatio, // Add aspect ratio
              },
              options: {
                resourceId: "main",
                scaleMode: "fit",
                autoSelect: true, // Auto-select the video after adding
              },
            });
            
            console.log("✅ Video added to timeline with ID:", videoId, "and auto-selected");
          }, { once: true });
        });
      }
    });
  };

  return (
    <div ref={containerRef} className="absolute z-50 flex h-full w-full flex-1">
      {/* Hidden file input for mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {!isLoading ? (
        isMobile ? (
          // Mobile-specific interface
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="rounded-full bg-primary p-6">
                <Video className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-foreground">
                  Add Video
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select a video from your gallery or record a new one
                </p>
              </div>
              <Button 
                onClick={handleMobileFileSelect}
                size="lg"
                className="w-full max-w-xs"
              >
                <Video className="mr-2 h-4 w-4" />
                Choose Video
              </Button>
            </div>
          </div>
        ) : (
          // Desktop drag-and-drop interface
        <Droppable
          maxFileCount={4}
          maxSize={100 * 1024 * 1024} // 100MB for video files
          disabled={false}
          noClick={false}
          onValueChange={onSelectFiles}
          accept={{
            "video/*": [".mp4", ".webm", ".mov", ".avi", ".mkv"]
          }}
          className="h-full w-full flex-1 bg-background"
        >
          <DroppableArea
            onDragStateChange={setIsDraggingOver}
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center justify-center border border-dashed text-center transition-colors duration-200 ease-in-out ${
              isDraggingOver ? "border-white bg-white/10" : "border-white/15"
            }`}
            style={{
              width: desiredSize.width,
              height: desiredSize.height,
            }}
          >
            <div className="flex flex-col items-center justify-center gap-4 pb-12">
              <div className="hover:bg-primary-dark cursor-pointer rounded-md border bg-primary p-2 text-secondary transition-colors duration-200">
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-sm text-muted-foreground">Click to upload video</p>
                <p className="text-xs text-muted-foreground/70">
                  Or drag and drop video files here
                </p>
              </div>
            </div>
          </DroppableArea>
        </Droppable>
        )
      ) : (
        <div className="flex flex-1 items-center justify-center bg-background-subtle text-sm text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
};

export default SceneEmpty;
