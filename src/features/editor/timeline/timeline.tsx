import { useEffect, useRef, useState } from "react";
import Header from "./header";
import Ruler from "./ruler";
import { timeMsToUnits, unitsToTimeMs } from "@designcombo/timeline";
import CanvasTimeline from "./items/timeline";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { dispatch, filter, subject } from "@designcombo/events";
import {
  TIMELINE_BOUNDING_CHANGED,
  TIMELINE_PREFIX,
} from "@designcombo/timeline";
import useStore from "../store/use-store";
import Playhead from "./playhead";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import { Audio, Image, Text, Video, Caption, Helper, Track } from "./items";
import StateManager, { REPLACE_MEDIA } from "@designcombo/state";
import {
  TIMELINE_OFFSET_CANVAS_LEFT,
  TIMELINE_OFFSET_CANVAS_RIGHT,
} from "../constants/constants";
import { ITrackItem } from "@designcombo/types";
import PreviewTrackItem from "./items/preview-drag-item";
import { EDIT_OBJECT } from "@designcombo/state";
import { useScreenSize } from "../../../utils/mobile";
import { getNextZoomLevel, getPreviousZoomLevel } from "../utils/timeline";
import { TIMELINE_SCALE_CHANGED } from "@designcombo/state";

CanvasTimeline.registerItems({
  Text,
  Image,
  Audio,
  Video,
  Caption,
  Helper,
  Track,
  PreviewTrackItem,
});

const EMPTY_SIZE = { width: 0, height: 0 };
const Timeline = ({ stateManager }: { stateManager: StateManager }) => {
  // prevent duplicate scroll events
  const canScrollRef = useRef(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<CanvasTimeline | null>(null);
  const verticalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const horizontalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const { scale, playerRef, fps, duration, setState, timeline, trackItemsMap } = useStore();
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'mobile';
  const currentFrame = useCurrentPlayerFrame(playerRef!);
  const [canvasSize, setCanvasSize] = useState(EMPTY_SIZE);
  const [size, setSize] = useState<{ width: number; height: number }>(
    EMPTY_SIZE,
  );
  
  // Mobile pinch-to-zoom state
  const [isZooming, setIsZooming] = useState(false);
  const lastPinchDistance = useRef<number>(0);

  const { setTimeline } = useStore();
  const onScroll = (v: { scrollTop: number; scrollLeft: number }) => {
    if (horizontalScrollbarVpRef.current && verticalScrollbarVpRef.current) {
      verticalScrollbarVpRef.current.scrollTop = -v.scrollTop;
      horizontalScrollbarVpRef.current.scrollLeft = -v.scrollLeft;
      setScrollLeft(-v.scrollLeft);
    }
  };

  // Mobile pinch-to-zoom handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    // Handle two-finger pinch
    if (e.touches.length === 2) {
      setIsZooming(true);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      lastPinchDistance.current = distance;
      
      console.log("🔍 Timeline pinch started:", { distance, timestamp: Date.now() });
      
      // Prevent any other touch interactions during pinch
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    // Handle pinch zoom
    if (isZooming && e.touches.length === 2) {
      e.preventDefault(); // Prevent default browser zoom
      e.stopPropagation(); // Stop event from reaching other elements
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      const deltaDistance = distance - lastPinchDistance.current;
      const threshold = 15; // Increased threshold for more stable zooming
      
      if (Math.abs(deltaDistance) > threshold) {
        if (deltaDistance > 0) {
          // Pinch out - zoom in
          const nextZoom = getNextZoomLevel(scale);
          if (nextZoom.zoom !== scale.zoom) {
            console.log("🔍 Timeline zoom in:", { from: scale.zoom, to: nextZoom.zoom });
            dispatch(TIMELINE_SCALE_CHANGED, { payload: { scale: nextZoom } });
          }
        } else {
          // Pinch in - zoom out
          const prevZoom = getPreviousZoomLevel(scale);
          if (prevZoom.zoom !== scale.zoom) {
            console.log("🔍 Timeline zoom out:", { from: scale.zoom, to: prevZoom.zoom });
            dispatch(TIMELINE_SCALE_CHANGED, { payload: { scale: prevZoom } });
          }
        }
        lastPinchDistance.current = distance;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    if (e.touches.length < 2 && isZooming) {
      setIsZooming(false);
      console.log("🔍 Timeline pinch ended");
    }
  };

  useEffect(() => {
    if (playerRef?.current) {
      canScrollRef.current = playerRef?.current.isPlaying();
    }
  }, [playerRef?.current?.isPlaying()]);

  useEffect(() => {
    // Skip if currentFrame is NaN to prevent cascade issues
    if (isNaN(currentFrame)) {
      console.log("⚠️ Timeline effect skipped - currentFrame is NaN");
      return;
    }
    
    const position = timeMsToUnits((currentFrame / fps) * 1000, scale.zoom);
    
    // Auto-scroll timeline to keep playhead visible when using skip controls (both desktop and mobile)
    {
      const scrollableElement = horizontalScrollbarVpRef.current;
      if (scrollableElement) {
        const containerWidth = scrollableElement.clientWidth;
        const playheadX = position - scrollLeft + 40; // Playhead position relative to visible area
        const margin = 100; // Increased margin to ensure playhead stays comfortably visible
        
        let needsScroll = false;
        let targetScrollLeft = scrollLeft;
        
        // Check if playhead is off-screen to the left or close to left edge
        if (playheadX < margin) {
          needsScroll = true;
          // Center the playhead when scrolling left
          targetScrollLeft = Math.max(0, position - containerWidth / 2);
          console.log("📏 Desktop: Playhead off-screen left, centering it");
        }
        // Check if playhead is off-screen to the right or close to right edge
        else if (playheadX > containerWidth - margin) {
          needsScroll = true;
          // Center the playhead when scrolling right
          targetScrollLeft = position - containerWidth / 2;
          console.log("📏 Desktop: Playhead off-screen right, centering it");
        }
        
        if (needsScroll) {
          console.log("📏 Desktop timeline auto-scroll:", {
            currentFrame,
            position,
            playheadX,
            containerWidth,
            oldScrollLeft: scrollLeft,
            newScrollLeft: targetScrollLeft,
            reason: playheadX < margin ? 'left' : 'right'
          });
          
          const finalScrollLeft = Math.max(0, targetScrollLeft);
          
          // Update scroll position
          scrollableElement.scrollLeft = finalScrollLeft;
          setScrollLeft(finalScrollLeft);
          
          // Force canvas scroll update and trigger thumbnail updates
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.scrollTo({ scrollLeft: finalScrollLeft });
            // Small delay before forcing scroll change to ensure scroll position is updated
            setTimeout(() => {
              canvas.forceScrollChange();
            }, 10);
          }
          
          return; // Skip normal positioning since we scrolled
        }
      }
    }
    
    const canvasBoudingX =
      canvasElRef.current?.getBoundingClientRect().x! +
      canvasElRef.current?.clientWidth!;
    const playHeadPos = position - scrollLeft + 40;
    if (playHeadPos >= canvasBoudingX) {
      const scrollDivWidth = horizontalScrollbarVpRef.current?.clientWidth!;
      const totalScrollWidth = horizontalScrollbarVpRef.current?.scrollWidth!;
      const currentPosScroll = horizontalScrollbarVpRef.current?.scrollLeft!;
      const availableScroll =
        totalScrollWidth - (scrollDivWidth + currentPosScroll);
      const scaleScroll = availableScroll / scrollDivWidth;
      if (scaleScroll >= 0) {
        if (scaleScroll > 1)
          horizontalScrollbarVpRef.current?.scrollTo({
            left: currentPosScroll + scrollDivWidth,
          });
        else
          horizontalScrollbarVpRef.current?.scrollTo({
            left: totalScrollWidth - scrollDivWidth,
          });
      }
    }
  }, [currentFrame]);

  const onResizeCanvas = (payload: { width: number; height: number }) => {
    setCanvasSize({
      width: payload.width,
      height: payload.height,
    });
  };

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const timelineContainerEl = timelineContainerRef.current;

    if (!canvasEl || !timelineContainerEl) return;

    const containerWidth = timelineContainerEl.clientWidth - 40;
    const containerHeight = timelineContainerEl.clientHeight - 60; // Reduced from 90 to 60 to give more space
    const canvas = new CanvasTimeline(canvasEl, {
      width: containerWidth,
      height: containerHeight,
      bounding: {
        width: containerWidth,
        height: 0,
      },
      selectionColor: "rgba(0, 216, 214,0.1)",
      selectionBorderColor: "rgba(0, 216, 214,1.0)",
      onScroll,
      onResizeCanvas,
      scale: scale,
      state: stateManager,
      duration,
      spacing: {
        left: TIMELINE_OFFSET_CANVAS_LEFT,
        right: TIMELINE_OFFSET_CANVAS_RIGHT,
      },
      sizesMap: {
        main: 80, // Increased height for main video track to show filmstrip properly
        audio: 36,
        caption: 32,
        text: 32,
      },
      acceptsMap: {
        main: ["video"], // Only accept videos on main track - no new video tracks allowed
        audio: ["audio"],
        caption: ["caption", "text"],
        text: ["text", "caption"],
      },
      guideLineColor: "#ffffff",
      // Note: Videos can only be dropped on the main track due to acceptsMap restriction
    });

    canvasRef.current = canvas;

    setCanvasSize({ width: containerWidth, height: containerHeight });
    setSize({
      width: containerWidth,
      height: 0,
    });
    setTimeline(canvas);

    const resizeDesignSubscription = stateManager.subscribeToSize(
      (newState) => {
        setState(newState);
      },
    );
    const scaleSubscription = stateManager.subscribeToScale((newState) => {
      setState(newState);
    });

    const tracksSubscription = stateManager.subscribeToState((newState) => {
      setState(newState);
    });
    const durationSubscription = stateManager.subscribeToDuration(
      (newState) => {
        setState(newState);
      },
    );

    const updateTrackItemsMap = stateManager.subscribeToUpdateTrackItem(() => {
      const currentState = stateManager.getState();
      console.log("🎬 Track items updated (potential split):", {
        trackItemsCount: Object.keys(currentState.trackItemsMap).length,
        previousCount: Object.keys(trackItemsMap).length,
        duration: currentState.duration,
        timestamp: Date.now()
      });
      setState({
        duration: currentState.duration,
        trackItemsMap: currentState.trackItemsMap,
      });
    });

    const itemsDetailsSubscription = stateManager.subscribeToAddOrRemoveItems(
      () => {
        const currentState = stateManager.getState();
        
        // Check for newly added video items to auto-select them
        const newVideoItems = Object.values(currentState.trackItemsMap).filter(
          (item: ITrackItem) => item.type === 'video' && !trackItemsMap[item.id]
        );
        
        // If there are new video items, auto-select the first one
        if (newVideoItems.length > 0) {
          const newVideoId = newVideoItems[0].id;
          console.log("🎯 Auto-selecting newly added video:", newVideoId);
          
          
          
          // Update the state to include the new selection
          setState({
            trackItemDetailsMap: currentState.trackItemDetailsMap,
            trackItemsMap: currentState.trackItemsMap,
            trackItemIds: currentState.trackItemIds,
            tracks: currentState.tracks,
            activeIds: [newVideoId], // Auto-select the new video
          });
          
          // Also update the stateManager to reflect the selection
          stateManager.updateState(
            {
              activeIds: [newVideoId],
            },
            {
              updateHistory: false,
              kind: "layer:selection",
            },
          );
        } else {
          setState({
            trackItemDetailsMap: currentState.trackItemDetailsMap,
            trackItemsMap: currentState.trackItemsMap,
            trackItemIds: currentState.trackItemIds,
            tracks: currentState.tracks,
          });
        }
      },
    );

    const updateItemDetailsSubscription =
      stateManager.subscribeToUpdateItemDetails(() => {
        const currentState = stateManager.getState();
        setState({
          trackItemDetailsMap: currentState.trackItemDetailsMap,
        });
      });

    return () => {
      canvas.purge();
      scaleSubscription.unsubscribe();
      tracksSubscription.unsubscribe();
      durationSubscription.unsubscribe();
      itemsDetailsSubscription.unsubscribe();
      updateTrackItemsMap.unsubscribe();
      updateItemDetailsSubscription.unsubscribe();
      resizeDesignSubscription.unsubscribe();
    };
  }, []);

  const handleOnScrollH = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (canScrollRef.current) {
      const canvas = canvasRef.current!;
      canvas.scrollTo({ scrollLeft });
    }
    setScrollLeft(scrollLeft);
  };

  const handleOnScrollV = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (canScrollRef.current) {
      const canvas = canvasRef.current!;
      canvas.scrollTo({ scrollTop });
    }
  };

  useEffect(() => {
    const addEvents = subject.pipe(
      filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
    );

    const subscription = addEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_BOUNDING_CHANGED) {
        const bounding = obj.value?.payload?.bounding;
        if (bounding) {
          setSize({
            width: bounding.width,
            height: bounding.height,
          });
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Add synchronization effect for trim/display properties after state changes
  useEffect(() => {
    let hasChanges = false;
    
    // Check for any video items that have mismatched trim and display properties
    Object.values(trackItemsMap).forEach((item: ITrackItem) => {
      if (item.type === 'video' && item.trim && item.display) {
        const displayDuration = item.display.to - item.display.from;
        const trimDuration = item.trim.to - item.trim.from;
        
        // If display shows more duration than trim allows, synchronize them
        if (Math.abs(displayDuration - trimDuration) > 100) { // 100ms tolerance
          console.log("🔄 Synchronizing trim/display mismatch for video:", item.id);
          console.log("Display range:", item.display.from, "to", item.display.to, "duration:", displayDuration);
          console.log("Trim range:", item.trim.from, "to", item.trim.to, "duration:", trimDuration);
          
          hasChanges = true;
          
          // Update trim to match display for restored clips
          dispatch(EDIT_OBJECT, {
            payload: {
              [item.id]: {
                trim: {
                  from: 0, // Reset to start of original video
                  to: displayDuration, // Match the display duration
                },
              },
            },
          });
        }
      }
    });

    // Recalculate timeline duration to include all track items
    const trackItemDurations = Object.values(trackItemsMap).map((item: ITrackItem) => item.display?.to || 0);
    console.log("📊 Track item durations:", trackItemDurations);
    
    const maxEndTime = Math.max(
      duration, // Keep current duration as minimum
      ...trackItemDurations,
      1000 // Minimum 1 second
    );

    // Update duration if it's insufficient for the track items
    if (maxEndTime > duration) {
      console.log("📏 Updating timeline duration from", duration, "to", maxEndTime);
      setTimeout(() => {
        setState({ duration: maxEndTime });
        console.log("✅ Duration updated successfully");
      }, 50); // Small delay to avoid conflicts with other state updates
    }

    // Force thumbnail regeneration for restored clips
    if (hasChanges) {
      const canvas = canvasRef.current;
      if (canvas) {
        console.log("🎬 Forcing thumbnail regeneration after restoration");
        setTimeout(() => {
          canvas.onScrollChange();
          canvas.requestRenderAll();
        }, 150); // Slightly longer delay to ensure all state updates are complete
      }
    }
  }, [trackItemsMap, duration, setState]);

  const handleReplaceItem = (trackItem: Partial<ITrackItem>) => {
    dispatch(REPLACE_MEDIA, {
      payload: {
        [trackItem.id!]: {
          details: {
            src: "https://cdn.designcombo.dev/videos/demo-video-4.mp4",
          },
        },
      },
    });
  };

  const onClickRuler = (units: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const time = unitsToTimeMs(units, scale.zoom);
    playerRef?.current?.seekTo((time * fps) / 1000);
  };

  useEffect(() => {
    const availableScroll = horizontalScrollbarVpRef.current?.scrollWidth;
    if (!availableScroll || !timeline) return;
    const canvasWidth = timeline.width;
    if (availableScroll < canvasWidth + scrollLeft) {
      timeline.scrollTo({ scrollLeft: availableScroll - canvasWidth });
    }

    // Force thumbnail regeneration when scale changes
    // This ensures thumbnails are properly updated when using zoom shortcuts
    const canvas = canvasRef.current;
    if (canvas) {
      console.log("📏 Scale changed, forcing thumbnail regeneration");
      
      // Call onScaleChange immediately to prevent timing issues
      canvas.onScaleChange();
      
      // Request render after a brief delay to ensure thumbnails are loaded
      setTimeout(() => {
        canvas.requestRenderAll();
      }, 150);
    }
  }, [scale]);

  return (
    <div
      ref={timelineContainerRef}
      id={"timeline-container"}
      className="relative h-full w-full overflow-hidden bg-sidebar border-t border-border/50 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: isMobile ? 'pan-x pan-y' : 'auto' // Allow pan but prevent browser zoom
      }}
    >
      <Header />
      <Ruler onClick={onClickRuler} scrollLeft={scrollLeft} />
      <Playhead scrollLeft={scrollLeft} />
      <div className="flex flex-1 min-h-0">
        <div className="relative w-10 flex-none bg-sidebar border-r border-border/30">
          <div className="absolute top-2 left-2 text-xs text-muted-foreground/70 font-medium">
            VIDEO
          </div>
        </div>
        <div style={{ height: canvasSize.height }} className="relative flex-1">
          <div
            style={{ height: canvasSize.height }}
            ref={containerRef}
            className="absolute top-0 w-full"
          >
            <canvas id="designcombo-timeline-canvas" ref={canvasElRef} />
          </div>
          <ScrollArea.Root
            type="always"
            style={{
              position: "absolute",
              width: isMobile ? "calc(100vw - 40px)" : "calc(100vw - 312px)", // 272px annotation panel + 40px padding
              height: "10px",
            }}
            className="ScrollAreaRootH"
            onPointerDown={() => {
              canScrollRef.current = true;
            }}
            onPointerUp={() => {
              canScrollRef.current = false;
            }}
          >
            <ScrollArea.Viewport
              onScroll={handleOnScrollH}
              className="ScrollAreaViewport"
              id="viewportH"
              ref={horizontalScrollbarVpRef}
            >
              <div
                style={{
                  width:
                    size.width > canvasSize.width
                      ? size.width + TIMELINE_OFFSET_CANVAS_RIGHT
                      : size.width,
                }}
                className="pointer-events-none h-[10px]"
              ></div>
            </ScrollArea.Viewport>

            <ScrollArea.Scrollbar
              className="ScrollAreaScrollbar"
              orientation="horizontal"
            >
              <ScrollArea.Thumb
                onMouseDown={() => {
                  canScrollRef.current = true;
                }}
                onMouseUp={() => {
                  canScrollRef.current = false;
                }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          <ScrollArea.Root
            type="always"
            style={{
              position: "absolute",
              height: canvasSize.height,
              width: "10px",
            }}
            className="ScrollAreaRootV"
          >
            <ScrollArea.Viewport
              onScroll={handleOnScrollV}
              className="ScrollAreaViewport"
              ref={verticalScrollbarVpRef}
            >
              <div
                style={{
                  height:
                    size.height > canvasSize.height
                      ? size.height + 40
                      : canvasSize.height,
                }}
                className="pointer-events-none w-[10px]"
              ></div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              className="ScrollAreaScrollbar"
              orientation="vertical"
            >
              <ScrollArea.Thumb
                onMouseDown={() => {
                  canScrollRef.current = true;
                }}
                onMouseUp={() => {
                  canScrollRef.current = false;
                }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
