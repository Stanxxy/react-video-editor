import { useEffect, useRef } from "react";
import Composition from "./composition";
import { Player as RemotionPlayer, PlayerRef } from "@remotion/player";
import useStore from "../store/use-store";

const Player = () => {
  const playerRef = useRef<PlayerRef>(null);
  const { setPlayerRef, duration, fps, size, orientation } = useStore();

  useEffect(() => {
    setPlayerRef(playerRef);
  }, []);

  // Ensure we always have valid dimensions
  const getValidDimensions = () => {
    if (size?.width && size?.height) {
      return { width: size.width, height: size.height };
    }
    
    // Fallback based on orientation
    return orientation === 'horizontal' 
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };
  };

  const { width, height } = getValidDimensions();

  // Don't render until we have valid dimensions
  if (!width || !height) {
    return <div className="h-full w-full bg-sidebar" />;
  }

  return (
    <RemotionPlayer
      ref={playerRef}
      component={Composition}
      durationInFrames={Math.round((duration / 1000) * fps) || 1}
      compositionWidth={width}
      compositionHeight={height}
      className="h-full w-full"
      fps={30}
      overflowVisible
    />
  );
};
export default Player;
