import useStore from "../store/use-store";
import { useEffect } from "react";
import { filter, subject } from "@designcombo/events";
import {
  PLAYER_PAUSE,
  PLAYER_PLAY,
  PLAYER_PREFIX,
  PLAYER_SEEK,
  PLAYER_SEEK_BY,
  PLAYER_TOGGLE_PLAY,
} from "../constants/events";
import { LAYER_PREFIX, LAYER_SELECTION } from "@designcombo/state";
import { TIMELINE_SEEK, TIMELINE_PREFIX } from "@designcombo/timeline";
const useTimelineEvents = () => {
  const { playerRef, fps, timeline, setState } = useStore();

  // Debug player state
  useEffect(() => {
    if (playerRef?.current) {
      console.log("🎬 Timeline events - Player ref available:", {
        currentFrame: playerRef.current.getCurrentFrame(),
        isPlaying: playerRef.current.isPlaying(),
      });
    }
  }, [playerRef?.current]);

  //handle player events
  useEffect(() => {
    const playerEvents = subject.pipe(
      filter(({ key }) => key.startsWith(PLAYER_PREFIX)),
    );
    const timelineEvents = subject.pipe(
      filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
    );

    const timelineEventsSubscription = timelineEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_SEEK) {
        const { time } = obj.value?.payload;
        playerRef?.current?.seekTo((time / 1000) * fps);
      }
    });
    const playerEventsSubscription = playerEvents.subscribe((obj) => {
      // Helper function to check if player is ready
      const isPlayerReady = () => {
        if (!playerRef?.current) return false;
        try {
          const frame = playerRef.current.getCurrentFrame();
          return typeof frame === 'number' && !isNaN(frame);
        } catch {
          return false;
        }
      };
      
      if (obj.key === PLAYER_SEEK) {
        const { time } = obj.value?.payload;
        if (isPlayerReady()) {
          playerRef.current.seekTo((time / 1000) * fps);
        }
      } else if (obj.key === PLAYER_PLAY) {
        if (isPlayerReady()) {
          try {
            playerRef.current.play();
          } catch (error) {
            console.error("❌ Failed to play video:", error);
          }
        }
      } else if (obj.key === PLAYER_PAUSE) {
        if (isPlayerReady()) {
          try {
            playerRef.current.pause();
          } catch (error) {
            console.error("❌ Failed to pause video:", error);
          }
        }
      } else if (obj.key === PLAYER_TOGGLE_PLAY) {
        if (isPlayerReady()) {
          try {
            if (playerRef.current.isPlaying()) {
              playerRef.current.pause();
            } else {
              playerRef.current.play();
            }
          } catch (error) {
            console.error("❌ Failed to toggle play:", error);
          }
        }
      } else if (obj.key === PLAYER_SEEK_BY) {
        const { frames } = obj.value?.payload;
        if (isPlayerReady()) {
          const currentFrame = playerRef.current.getCurrentFrame();
          if (!isNaN(currentFrame)) {
            playerRef.current.seekTo(Math.round(currentFrame) + frames);
          }
        }
      }
    });

    return () => {
      playerEventsSubscription.unsubscribe();
      timelineEventsSubscription.unsubscribe();
    };
  }, [playerRef, fps]);

  // handle selection events
  useEffect(() => {
    const selectionEvents = subject.pipe(
      filter(({ key }) => key.startsWith(LAYER_PREFIX)),
    );

    const selectionSubscription = selectionEvents.subscribe((obj) => {
      if (obj.key === LAYER_SELECTION) {
        setState({
          activeIds: obj.value?.payload.activeIds,
        });
      }
    });
    return () => selectionSubscription.unsubscribe();
  }, [timeline]);
};

export default useTimelineEvents;
