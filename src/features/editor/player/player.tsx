import { useEffect, useRef } from "react";
import Composition from "./composition";
import { Player as RemotionPlayer, PlayerRef } from "@remotion/player";
import useStore from "../store/use-store";

const Player = () => {
  const playerRef = useRef<PlayerRef>(null);
  const { setPlayerRef, duration, fps, size, orientation } = useStore();

  useEffect(() => {
    setPlayerRef(playerRef);
    console.log("🎬 Player ref set, initial state:", {
      playerExists: !!playerRef.current,
      size,
      duration,
      fps,
      orientation
    });
  }, []);



  // Monitor player readiness and composition loading
  useEffect(() => {
    if (playerRef.current) {
      let retryCount = 0;
      const maxRetries = 10;
      
      const checkPlayerReady = () => {
        try {
          const frame = playerRef.current?.getCurrentFrame();
          if (typeof frame === 'number' && !isNaN(frame)) {
            console.log("🎬 Player composition ready");
            return;
          }
        } catch (error) {
          // Player not ready yet
        }
        
        // Retry if composition not ready yet
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkPlayerReady, 200); // Check every 200ms
        } else {
          console.log("🎬 Player composition taking longer than expected to load");
        }
      };
      
      // Start checking after a small delay
      const timer = setTimeout(checkPlayerReady, 100);
      return () => clearTimeout(timer);
    }
  }, [playerRef.current, duration, fps]);

  // Ensure we always have valid dimensions
  const getValidDimensions = () => {
    if (size?.width && size?.height) {
      console.log("🎬 Player using scene dimensions:", { width: size.width, height: size.height });
      return { width: size.width, height: size.height };
    }
    
    // Fallback based on orientation
    const fallback = orientation === 'horizontal' 
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };
    
    console.log("🎬 Player using fallback dimensions:", fallback);
    return fallback;
  };

  const { width, height } = getValidDimensions();

  // Don't render until we have valid dimensions
  if (!width || !height) {
    return <div className="h-full w-full bg-sidebar" />;
  }

  const durationInFrames = Math.round((duration / 1000) * fps) || 1;

  return (
    <RemotionPlayer
      ref={playerRef}
      component={Composition}
      durationInFrames={durationInFrames}
      compositionWidth={width}
      compositionHeight={height}
      className="h-full w-full"
      fps={30}
      overflowVisible
      controls={false}
      loop={false}
      autoPlay={false}
      showVolumeControls={false}
      style={{
        width: '100%',
        height: '100%',
      }}

    />
  );
};
export default Player;
