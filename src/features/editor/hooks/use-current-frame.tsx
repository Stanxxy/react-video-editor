import { CallbackListener, PlayerRef } from "@remotion/player";
import { useCallback, useSyncExternalStore, useRef } from "react";

export const useCurrentPlayerFrame = (ref: React.RefObject<PlayerRef>) => {
  const lastValidFrameRef = useRef<number>(0);
  const playerReadyRef = useRef<boolean>(false);
  
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const { current } = ref;
      if (!current) {
        return () => undefined;
      }
      
      const updater: CallbackListener<"frameupdate"> = (e) => {
        // Debug frame updates to catch corruption points
        const frame = e?.detail?.frame;
        if (typeof frame === 'number' && isNaN(frame)) {
          console.error("🎬 NaN frame received in frameupdate event:", {
            frame,
            eventDetail: e?.detail,
            timestamp: Date.now(),
            callStack: new Error().stack?.split('\n').slice(1, 4).map(line => line.trim())
          });
        }
        onStoreChange();
      };
      
      current.addEventListener("frameupdate", updater);
      
      return () => {
        current.removeEventListener("frameupdate", updater);
      };
    },
    [ref],
  );
  
  const getCurrentFrameSafe = useCallback(() => {
    if (!ref.current) {
      return lastValidFrameRef.current;
    }
    
        try {
      const frame = ref.current.getCurrentFrame();
      
      // If frame is valid, store it and mark player as ready
      if (typeof frame === 'number' && !isNaN(frame)) {
        lastValidFrameRef.current = frame;
        if (!playerReadyRef.current) {
          playerReadyRef.current = true;
        }
        return frame;
      }
      
      // Frame is NaN - check if this is expected (initial load) or a problem
      const isInitialLoad = lastValidFrameRef.current === 0;
      const hasSeekMethods = typeof ref.current.seekTo === 'function';
      
      if (!isInitialLoad) {
        // This is a regression - we had valid frames before
        console.log("🎬 Frame became NaN after being valid:", {
          frame,
          lastValidFrame: lastValidFrameRef.current,
          hasSeekMethods,
          isPlaying: ref.current.isPlaying?.(),
          playerMethods: {
            hasGetCurrentFrame: typeof ref.current.getCurrentFrame === 'function',
            hasSeekTo: typeof ref.current.seekTo === 'function',
            hasPlay: typeof ref.current.play === 'function',
            hasPause: typeof ref.current.pause === 'function'
          },
          callStack: new Error().stack?.split('\n').slice(1, 6).map(line => line.trim())
        });
      }
      

      
      // Return the last valid frame to prevent NaN
      return lastValidFrameRef.current;
          } catch (error) {
        return lastValidFrameRef.current;
      }
  }, [ref]);
  
  const data = useSyncExternalStore<number>(
    subscribe,
    getCurrentFrameSafe,
    () => 0,
  );
  
  return data;
};
