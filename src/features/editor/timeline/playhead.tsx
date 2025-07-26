import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import useStore from "../store/use-store";
import { MouseEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { timeMsToUnits, unitsToTimeMs } from "../utils/timeline";
import { TIMELINE_OFFSET_CANVAS_LEFT } from "../constants/constants";

const Playhead = ({ scrollLeft }: { scrollLeft: number }) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  const { playerRef, fps, scale } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef!);
  const position =
    timeMsToUnits((currentFrame / fps) * 1000, scale.zoom) - scrollLeft;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(position);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (
    e:
      | MouseEvent<HTMLDivElement, globalThis.MouseEvent>
      | TouchEvent<HTMLDivElement>,
  ) => {
    // Prevent any playhead interaction if current frame is NaN
    if (isNaN(currentFrame)) {
      console.warn("🎯 Playhead interaction blocked - currentFrame is NaN");
      return;
    }
    
    // Only allow intentional interactions - prevent accidental touch triggers during scrolling
    const isTouch = "touches" in e;
    
    if (isTouch) {
      // Check if this might be a scroll gesture rather than intentional playhead interaction
      const touch = (e as TouchEvent<HTMLDivElement>).touches[0];
      
      console.log("🎯 Playhead touch detected:", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        currentFrame: currentFrame,
        position,
        timestamp: Date.now(),
        target: e.target
      });
      
      // Be more restrictive about when to start dragging on touch devices
      // Only start if the touch is very close to the playhead center
      const playheadCenterX = 40 + TIMELINE_OFFSET_CANVAS_LEFT + position;
      const touchDistance = Math.abs(touch.clientX - playheadCenterX);
      
      if (touchDistance > 20) { // 20px tolerance
        console.log("🎯 Touch rejected - too far from playhead center:", {
          touchDistance,
          playheadCenterX,
          touchX: touch.clientX
        });
        return; // Don't start dragging if touch is not close enough
      }
    }
    
    e.preventDefault(); // Prevent default drag behavior
    
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    
    console.log("🎯 Playhead drag start (accepted):", {
      isTouch,
      clientX,
      currentFrame: currentFrame,
      position,
      timestamp: Date.now()
    });
    
    setIsDragging(true);
    setDragStartX(clientX);
    setDragStartPosition(position);
  };

  const handleMouseMove = (
    e: globalThis.MouseEvent | globalThis.TouchEvent,
  ) => {
    if (isDragging) {
      e.preventDefault(); // Prevent default drag behavior
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const delta = clientX - dragStartX + scrollLeft;
      const newPosition = dragStartPosition + delta;

      const time = unitsToTimeMs(newPosition, scale.zoom);
      const targetFrame = (time * fps) / 1000;
      
      // Debug playhead seeking
      const isTouch = "touches" in e;
      console.log("🎯 Playhead seeking:", {
        isTouch,
        time,
        targetFrame,
        currentFrameBefore: playerRef?.current?.getCurrentFrame?.(),
        timestamp: Date.now()
      });
      
      if (playerRef?.current && typeof targetFrame === 'number' && !isNaN(targetFrame) && targetFrame >= 0) {
        // Additional validation - ensure we have a valid current frame before seeking
        const currentFrameBefore = playerRef.current.getCurrentFrame();
        
        if (isNaN(currentFrameBefore)) {
          console.error("❌ PLAYHEAD SEEK ABORTED - current frame is NaN before seek!", {
            isTouch,
            targetFrame,
            currentFrameBefore,
            timestamp: Date.now()
          });
          return;
        }
        
        console.log("🎯 Executing playhead seek:", {
          isTouch,
          targetFrame,
          currentFrameBefore,
          timestamp: Date.now()
        });
        
        try {
          playerRef.current.seekTo(targetFrame);
          
          // Check frame immediately after seek
          setTimeout(() => {
            const frameAfter = playerRef?.current?.getCurrentFrame?.();
            if (isNaN(frameAfter)) {
              console.error("❌ PLAYHEAD SEEK CAUSED NaN FRAME!", {
                isTouch,
                targetFrame,
                frameAfter,
                currentFrameBefore,
                timestamp: Date.now()
              });
            } else {
              console.log("✅ Playhead seek successful:", {
                isTouch,
                targetFrame,
                frameAfter,
                timestamp: Date.now()
              });
            }
          }, 10);
        } catch (error) {
          console.error("❌ PLAYHEAD SEEK ERROR:", {
            error,
            targetFrame,
            isTouch,
            timestamp: Date.now()
          });
        }
      } else {
        console.warn("⚠️ PLAYHEAD SEEK REJECTED - invalid parameters:", {
          hasPlayerRef: !!playerRef?.current,
          targetFrame,
          isValidNumber: typeof targetFrame === 'number' && !isNaN(targetFrame),
          isPositive: targetFrame >= 0,
          isTouch,
          timestamp: Date.now()
        });
      }
    }
  };

  useEffect(() => {
    const preventDefaultDrag = (e: Event) => {
      e.preventDefault();
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleMouseMove);
      document.addEventListener("touchend", handleMouseUp);
      document.addEventListener("dragstart", preventDefaultDrag);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("dragstart", preventDefaultDrag);
    }

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("dragstart", preventDefaultDrag);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Check if mobile to render centered playhead within timeline
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Get the timeline canvas container to position playhead in the center  
    const canvasContainer = document.getElementById("designcombo-timeline-canvas")?.parentElement;
    const containerWidth = canvasContainer?.clientWidth || window.innerWidth;
    const centerX = containerWidth / 2;
    
    return (
      <div
        style={{
          position: "absolute",
          left: centerX - 1.5, // Center the 3px wide playhead
          top: 0,
          width: 3,
          height: "100%",
          zIndex: 30,
          pointerEvents: "none", // Critical: Don't interfere with pinch gestures
        }}
      >
        {/* Top indicator */}
        <div
          style={{
            position: "absolute",
            top: -8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24,
            height: 16,
            borderRadius: "0 0 8px 8px",
            background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            border: "2px solid white",
          }}
        />
        
        {/* Playhead line */}
        <div 
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 3,
            height: "calc(100% - 16px)",
            background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
            boxShadow: "0 0 12px rgba(59, 130, 246, 0.6)",
          }}
        />
        
        {/* Bottom indicator */}
        <div
          style={{
            position: "absolute",
            bottom: -8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24,
            height: 16,
            borderRadius: "8px 8px 0 0",
            background: "linear-gradient(to top, #3b82f6, #1d4ed8)",
            boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.4)",
            border: "2px solid white",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={playheadRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: "absolute",
        left: 40 + TIMELINE_OFFSET_CANVAS_LEFT + position,
        top: 50,
        width: 1,
        height: "calc(100% - 40px)",
        zIndex: 10,
        cursor: "pointer",
        touchAction: "none", // Prevent default touch actions
      }}
    >
      <div
        style={{
          borderRadius: "0 0 4px 4px",
          background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
        }}
        className="absolute top-0 h-4 w-3 -translate-x-1/2 transform text-xs font-semibold text-white"
      ></div>
      <div className="relative h-full">
        <div className="absolute top-0 h-full w-4 -translate-x-1/2 transform cursor-pointer"></div>
        <div 
          className="absolute top-0 h-full w-0.5 -translate-x-1/2 transform bg-blue-500 shadow-lg"
          style={{
            boxShadow: "0 0 8px rgba(59, 130, 246, 0.5)",
          }}
        ></div>
      </div>
    </div>
  );
};

export default Playhead;
