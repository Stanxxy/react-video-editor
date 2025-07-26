import Draggable from "@/components/shared/draggable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VIDEOS } from "../data/video";
import { dispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IVideo } from "@designcombo/types";
import React from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import useStore from "../store/use-store";

export const Videos = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();

  const handleAddVideo = (payload: Partial<IVideo>) => {
    // Get current scene size from store
    const { size } = useStore.getState();
    
    // Calculate video dimensions to fill the scene
    const sceneWidth = size.width;
    const sceneHeight = size.height;
    
    // For predefined videos, we'll use a default aspect ratio (16:9) if not specified
    const videoAspectRatio = (payload as any).aspectRatio || 16/9;
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
    
    // Update payload with proper sizing
    const updatedPayload = {
      ...payload,
      details: {
        ...payload.details,
        width: finalWidth,
        height: finalHeight,
        top: (sceneHeight - finalHeight) / 2, // Center vertically
        left: (sceneWidth - finalWidth) / 2, // Center horizontally
      },
      aspectRatio: videoAspectRatio,
    };
    
    dispatch(ADD_VIDEO, {
      payload: updatedPayload,
      options: {
        resourceId: "main",
        scaleMode: "fit",
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Videos
      </div>
      <ScrollArea>
        <div className="masonry-sm px-4">
          {VIDEOS.map((video, index) => {
            return (
              <VideoItem
                key={index}
                video={video}
                shouldDisplayPreview={!isDraggingOverTimeline}
                handleAddImage={handleAddVideo}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

const VideoItem = ({
  handleAddImage,
  video,
  shouldDisplayPreview,
}: {
  handleAddImage: (payload: Partial<IVideo>) => void;
  video: Partial<IVideo>;
  shouldDisplayPreview: boolean;
}) => {
  const style = React.useMemo(
    () => ({
      backgroundImage: `url(${video.preview})`,
      backgroundSize: "cover",
      width: "80px",
      height: "80px",
    }),
    [video.preview],
  );

  return (
    <Draggable
      data={{
        ...video,
        metadata: {
          previewUrl: video.preview,
        },
      }}
      renderCustomPreview={<div style={style} className="draggable" />}
      shouldDisplayPreview={shouldDisplayPreview}
    >
      <div
        onClick={() =>
          handleAddImage({
            id: generateId(),
            details: {
              src: video.details!.src,
            },
            metadata: {
              previewUrl: video.preview,
            },
          } as any)
        }
        className="flex w-full items-center justify-center overflow-hidden bg-background pb-2"
      >
        <img
          draggable={false}
          src={video.preview}
          className="h-full w-full rounded-md object-cover"
          alt="image"
        />
      </div>
    </Draggable>
  );
};
