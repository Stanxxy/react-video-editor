import React from "react";
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import {
  ACTIVE_SPLIT,
  LAYER_DELETE,
} from "@designcombo/state";
import { OPEN_ANNOTATION_PANEL, PLAYER_SEEK } from "../constants/events";
import { SquareSplitHorizontal, Trash } from "lucide-react";
import { getCurrentTime } from "../utils/time";
import useStore from "../store/use-store";
import { useScreenSize } from "../../../utils/mobile";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";

const IconPlayerSkipBack = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    viewBox="0 0 24 24"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20 5v14l-12 -7z" />
    <path d="M4 5l0 14" />
  </svg>
);

const IconPlayerSkipForward = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    viewBox="0 0 24 24"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 5v14l12 -7z" />
    <path d="M20 5l0 14" />
  </svg>
);

const BottomTab = () => {
  const { activeIds, duration, fps, playerRef } = useStore();
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'mobile';
  const currentFrame = useCurrentPlayerFrame(playerRef!);

  // Only render on mobile
  if (!isMobile) {
    return null;
  }

  const doActiveDelete = () => {
    console.log("🗑️ Delete button clicked, activeIds:", activeIds);
    dispatch(LAYER_DELETE);
  };

  const doActiveSplit = () => {
    // Use currentFrame directly like the header does - avoid getCurrentTime() DOM dependency
    const currentTime = (currentFrame / fps) * 1000;
    console.log("✂️ MOBILE Split button clicked (ISOLATED):", {
      currentTime,
      activeIds,
      currentFrame,
      fps,
      playerState: playerRef?.current ? {
        isPlaying: playerRef.current.isPlaying?.(),
        muted: playerRef.current.isMuted?.(),
        hasGetCurrentFrame: !!playerRef.current.getCurrentFrame
      } : 'no player',
      beforeSplitTimestamp: Date.now()
    });
    
    // Don't split if currentFrame is invalid
    if (isNaN(currentFrame)) {
      console.warn("❌ Cannot split - currentFrame is NaN");
      return;
    }
    
    console.log("🎬 Dispatching ACTIVE_SPLIT event...");
    dispatch(ACTIVE_SPLIT, {
      payload: {},
      options: {
        time: currentTime,
      },
    });
    
    // Log immediately after dispatch
    setTimeout(() => {
      console.log("✂️ After ACTIVE_SPLIT dispatch:", {
        newCurrentFrame: playerRef?.current?.getCurrentFrame?.(),
        afterSplitTimestamp: Date.now()
      });
    }, 10);
  };

  const handleSkipBackward = () => {
    // Handle NaN currentFrame by using 0 as fallback
    const currentTime = isNaN(currentFrame) ? 0 : (currentFrame / fps) * 1000;
    const skipAmount = 5000; // 5 seconds in milliseconds
    const newTime = Math.max(0, currentTime - skipAmount); // Don't go below 0
    
    console.log("⏪ Skip backward:", { currentFrame, currentTime, newTime, duration });
    
    dispatch(PLAYER_SEEK, {
      payload: {
        time: newTime,
      },
    });
  };

  const handleSkipForward = () => {
    // Handle NaN currentFrame by using 0 as fallback
    const currentTime = isNaN(currentFrame) ? 0 : (currentFrame / fps) * 1000;
    const skipAmount = 5000; // 5 seconds in milliseconds
    const newTime = Math.min(duration, currentTime + skipAmount); // Don't go beyond duration
    
    console.log("⏩ Skip forward:", { currentFrame, currentTime, newTime, duration });
    
    dispatch(PLAYER_SEEK, {
      payload: {
        time: newTime,
      },
    });
  };

  return (
    <div 
      className="bg-sidebar border-t border-border/50 px-4 py-2 h-full"
      onTouchStart={(e) => {
        // Prevent touch events from bubbling to parent timeline elements
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        // Prevent touch events from bubbling to parent timeline elements
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        // Prevent touch events from bubbling to parent timeline elements
        e.stopPropagation();
      }}
      style={{
        touchAction: 'manipulation', // Prevent gesture conflicts
        pointerEvents: 'auto' // Ensure touch events work correctly
      }}
    >
      <div className="flex items-center justify-between w-full h-full px-2">
        {/* Split */}
        <Button
          disabled={!activeIds.length}
          onClick={doActiveSplit}
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 text-blue-400 hover:text-blue-300 h-auto p-2 min-w-0 flex-1"
          title="Split"
        >
          <SquareSplitHorizontal size={16} />
          <span className="text-xs font-medium">Split</span>
        </Button>
        
        {/* Skip Backward */}
        <Button 
          onClick={handleSkipBackward} 
          variant="ghost" 
          size="sm"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white h-auto p-2 min-w-0 flex-1"
          title="Skip Backward"
        >
          <IconPlayerSkipBack size={16} />
          <span className="text-xs font-medium">-5s</span>
        </Button>
        
        {/* Add Annotation (always show on mobile) */}
        <Button
          onClick={() => {
            console.log("📝 Opening mobile annotation panel");
            dispatch(OPEN_ANNOTATION_PANEL);
          }}
          variant="default"
          size="sm"
          className="flex flex-col items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-auto p-2 min-w-0 flex-1"
          title="Add Annotation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span className="text-xs font-medium">Add</span>
        </Button>
        
        {/* Skip Forward */}
        <Button 
          onClick={handleSkipForward} 
          variant="ghost" 
          size="sm"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white h-auto p-2 min-w-0 flex-1"
          title="Skip Forward"
        >
          <IconPlayerSkipForward size={16} />
          <span className="text-xs font-medium">+5s</span>
        </Button>
        
        {/* Delete */}
        <Button
          disabled={!activeIds.length}
          onClick={doActiveDelete}
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 text-red-400 hover:text-red-300 h-auto p-2 min-w-0 flex-1"
          title="Delete"
        >
          <Trash size={16} />
          <span className="text-xs font-medium">Delete</span>
        </Button>
      </div>
    </div>
  );
};

export default BottomTab; 