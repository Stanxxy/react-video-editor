import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import {
  ACTIVE_SPLIT,
  LAYER_DELETE,
  TIMELINE_SCALE_CHANGED,
  HISTORY_UNDO,
  HISTORY_REDO,
} from "@designcombo/state";
import { OPEN_ANNOTATION_PANEL } from "../constants/events";
import { Icons } from "@/components/shared/icons";
import { PLAYER_PAUSE, PLAYER_PLAY, PLAYER_SEEK } from "../constants/events";
import { frameToTimeString, getCurrentTime, timeToString } from "../utils/time";
import useStore from "../store/use-store";
import { SquareSplitHorizontal, Trash, ZoomIn, ZoomOut } from "lucide-react";
import {
  getFitZoomLevel,
  getNextZoomLevel,
  getPreviousZoomLevel,
  getZoomByIndex,
} from "../utils/timeline";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import { Slider } from "@/components/ui/slider";
import { useEffect, useState } from "react";
import useUpdateAnsestors from "../hooks/use-update-ansestors";
import { ITimelineScaleState } from "@designcombo/types";
import AudioControls from "./audio-controls";
import { useScreenSize } from "../../../utils/mobile";

const IconPlayerPlayFilled = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" />
  </svg>
);

const IconPlayerPauseFilled = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
    <path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
  </svg>
);
const IconPlayerSkipBack = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
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
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 5v14l12 -7z" />
    <path d="M20 5l0 14" />
  </svg>
);
const Header = () => {
  const [playing, setPlaying] = useState(false);
  const { duration, fps, scale, playerRef, activeIds } = useStore();
  const screenSize = useScreenSize();
  
  const isMobile = screenSize === 'mobile';

  useUpdateAnsestors({ playing, playerRef });

  const currentFrame = useCurrentPlayerFrame(playerRef!);

  const doActiveDelete = () => {
    dispatch(LAYER_DELETE);
  };

  const doActiveSplit = () => {
    // Get current time directly from the current frame instead of DOM element
    const currentTime = (currentFrame / fps) * 1000;
    
    dispatch(ACTIVE_SPLIT, {
      payload: {},
      options: {
        time: currentTime,
      },
    });
  };

  const handleSkipBackward = () => {
    const currentTime = (currentFrame / fps) * 1000; // Current time in milliseconds
    const skipAmount = 5000; // 5 seconds in milliseconds
    const newTime = Math.max(0, currentTime - skipAmount); // Don't go below 0
    
    dispatch(PLAYER_SEEK, {
      payload: {
        time: newTime,
      },
    });
  };

  const handleSkipForward = () => {
    const currentTime = (currentFrame / fps) * 1000; // Current time in milliseconds
    const skipAmount = 5000; // 5 seconds in milliseconds
    const newTime = Math.min(duration, currentTime + skipAmount); // Don't go beyond duration
    
    dispatch(PLAYER_SEEK, {
      payload: {
        time: newTime,
      },
    });
  };

  const handleSelectPreviousClip = () => {
    const { trackItemsMap } = useStore.getState();
    const clips = Object.values(trackItemsMap).filter(item => item.type === 'video');
    
    if (clips.length === 0) return;
    
    let targetClipId: string;
    
    if (activeIds.length === 0) {
      // No clip selected, select the first one
      targetClipId = clips[0].id;
    } else {
      // Find current clip and select previous one
      const currentClipIndex = clips.findIndex(clip => clip.id === activeIds[0]);
      if (currentClipIndex > 0) {
        targetClipId = clips[currentClipIndex - 1].id;
      } else {
        return; // Already at first clip
      }
    }
    
    // Use stateManager to trigger proper selection events
    const stateManager = useStore.getState().timeline?.state;
    if (stateManager) {
      stateManager.updateState(
        { activeIds: [targetClipId] },
        { updateHistory: false, kind: "layer:selection" }
      );
    }
  };

  const handleSelectNextClip = () => {
    const { trackItemsMap } = useStore.getState();
    const clips = Object.values(trackItemsMap).filter(item => item.type === 'video');
    
    if (clips.length === 0) return;
    
    let targetClipId: string;
    
    if (activeIds.length === 0) {
      // No clip selected, select the first one
      targetClipId = clips[0].id;
    } else {
      // Find current clip and select next one
      const currentClipIndex = clips.findIndex(clip => clip.id === activeIds[0]);
      if (currentClipIndex < clips.length - 1) {
        targetClipId = clips[currentClipIndex + 1].id;
      } else {
        return; // Already at last clip
      }
    }
    
    // Use stateManager to trigger proper selection events
    const stateManager = useStore.getState().timeline?.state;
    if (stateManager) {
      stateManager.updateState(
        { activeIds: [targetClipId] },
        { updateHistory: false, kind: "layer:selection" }
      );
    }
  };

  const handleSelectClipByNumber = (key: string) => {
    const { trackItemsMap } = useStore.getState();
    const clips = Object.values(trackItemsMap).filter(item => item.type === 'video');
    
    if (clips.length === 0) return;
    
    let targetIndex: number;
    
    if (key === '0') {
      // Key '0' selects the last clip
      targetIndex = clips.length - 1;
    } else {
      // Keys '1'-'9' select clips by index (1-based)
      targetIndex = parseInt(key) - 1;
    }
    
    // Check if the target index is valid
    if (targetIndex >= 0 && targetIndex < clips.length) {
      const stateManager = useStore.getState().timeline?.state;
      if (stateManager) {
        stateManager.updateState(
          { activeIds: [clips[targetIndex].id] },
          { updateHistory: false, kind: "layer:selection" }
        );
      }
    }
  };

  const changeScale = (scale: ITimelineScaleState) => {
    dispatch(TIMELINE_SCALE_CHANGED, {
      payload: {
        scale,
      },
    });
  };

  const handlePlay = () => {
    dispatch(PLAYER_PLAY);
  };

  const handlePause = () => {
    dispatch(PLAYER_PAUSE);
  };

  useEffect(() => {
    const handlePlayEvent = () => {
      setPlaying(true);
    };
    
    const handlePauseEvent = () => {
      setPlaying(false);
    };

    const player = playerRef?.current;
    if (player) {
      player.addEventListener("play", handlePlayEvent);
      player.addEventListener("pause", handlePauseEvent);
    }

    return () => {
      if (player) {
        player.removeEventListener("play", handlePlayEvent);
        player.removeEventListener("pause", handlePauseEvent);
      }
    };
  }, [playerRef]);

  // Keyboard shortcuts for timeline controls (disabled on mobile)
  useEffect(() => {
    // Don't add keyboard listeners on mobile devices
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      switch (event.key) {
        case 's':
        case 'S':
          if (activeIds.length > 0) {
            event.preventDefault();
            doActiveSplit();
          }
          break;
        case 'd':
        case 'D':
          if (activeIds.length > 0) {
            event.preventDefault();
            doActiveDelete();
          }
          break;
        case ' ':
          event.preventDefault();
          if (playing) {
            handlePause();
          } else {
            handlePlay();
          }
          break;
        case 'ArrowLeft':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleSelectPreviousClip();
          } else {
            event.preventDefault();
            handleSkipBackward();
          }
          break;
        case 'ArrowRight':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleSelectNextClip();
          } else {
            event.preventDefault();
            handleSkipForward();
          }
          break;
        case '+':
        case '=':
          event.preventDefault();
          const nextZoom = getNextZoomLevel(scale);
          changeScale(nextZoom);
          break;
        case '-':
        case '_':
          event.preventDefault();
          const previousZoom = getPreviousZoomLevel(scale);
          changeScale(previousZoom);
          break;
        case 'Escape':
          event.preventDefault();
          // Blur any focused input element (removed clip unselection)
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
            activeElement.blur();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '0':
          event.preventDefault();
          handleSelectClipByNumber(event.key);
          break;
      }
    };

    // Add event listener to document for global shortcuts
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, activeIds, playing, scale, doActiveSplit, doActiveDelete, handlePlay, handlePause, handleSkipBackward, handleSkipForward, changeScale, handleSelectClipByNumber]);

  if (isMobile) {
    // Mobile layout: Header with play controls, undo/redo, and time display
    return (
      <div className="flex items-center justify-between bg-sidebar border-b border-border/80 px-3 py-1">
        {/* Play/Pause button (left) */}
                  <Button
            onClick={() => {
              if (playing) {
                return handlePause();
              }
              handlePlay();
            }}
            variant="ghost"
            size="sm"
            className="text-white hover:text-white bg-primary/20 hover:bg-primary/30 rounded-full h-10 w-10"
            title="Play/Pause"
          >
          {playing ? (
            <IconPlayerPauseFilled size={20} />
          ) : (
            <IconPlayerPlayFilled size={20} />
          )}
        </Button>
        
        {/* Center section: Time display */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs font-light flex items-center gap-1">
          <div
                className="font-medium text-zinc-200"
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
                data-current-time={currentFrame / fps}
                id="video-current-time"
              >
                {frameToTimeString({ frame: currentFrame }, { fps })}
              </div>
              <span>/</span>
              <div
                className="text-muted-foreground"
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {timeToString({ time: duration })}
              </div>
          </div>
        </div>
        
        {/* Undo/Redo buttons (right) */}
        <div className="flex items-center gap-1">
          <Button
            onClick={() => dispatch(HISTORY_UNDO)}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-white"
            title="Undo"
          >
            <Icons.undo width={20} />
          </Button>
          <Button
            onClick={() => dispatch(HISTORY_REDO)}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-white"
            title="Redo"
          >
            <Icons.redo width={20} />
          </Button>
        </div>
      </div>
    );
  }

  // Desktop layout (original)
  return (
    <div
      style={{
        position: "relative",
        height: "50px",
        flex: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          height: 50,
          width: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            height: 36,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 260px 1fr",
            alignItems: "center",
          }}
        >
          <div className="flex items-center gap-1 px-2">
            <Button
              disabled={!activeIds.length}
              onClick={doActiveDelete}
              variant={"ghost"}
              size={"sm"}
              className="flex items-center gap-1 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/20"
              title="Delete (D)"
            >
              <Trash size={14} /> Delete
            </Button>

            <Button
              disabled={!activeIds.length}
              onClick={doActiveSplit}
              variant={"ghost"}
              size={"sm"}
              className="flex items-center gap-1 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 border border-blue-500/30"
              title="Split Video (S)"
            >
              <SquareSplitHorizontal size={15} /> Split Video
            </Button>
          </div>
          <div className="flex items-center justify-center">
            <div>
              <Button onClick={handleSkipBackward} variant={"ghost"} size={"icon"} title="Skip Backward 5s (←)">
                <IconPlayerSkipBack size={14} />
              </Button>
              <Button
                onClick={() => {
                  if (playing) {
                    return handlePause();
                  }
                  handlePlay();
                }}
                variant={"ghost"}
                size={"icon"}
                title="Play/Pause (Space)"
              >
                {playing ? (
                  <IconPlayerPauseFilled size={14} />
                ) : (
                  <IconPlayerPlayFilled size={14} />
                )}
              </Button>
              <Button onClick={handleSkipForward} variant={"ghost"} size={"icon"} title="Skip Forward 5s (→)">
                <IconPlayerSkipForward size={14} />
              </Button>
            </div>
            <div
              className="text-xs font-light"
              style={{
                display: "grid",
                alignItems: "center",
                gridTemplateColumns: "54px 4px 54px",
                paddingTop: "2px",
                justifyContent: "center",
              }}
            >
              <div
                className="font-medium text-zinc-200"
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
                data-current-time={currentFrame / fps}
                id="video-current-time"
              >
                {frameToTimeString({ frame: currentFrame }, { fps })}
              </div>
              <span>/</span>
              <div
                className="text-muted-foreground"
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {timeToString({ time: duration })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <AudioControls />
            <ZoomControl
              scale={scale}
              onChangeTimelineScale={changeScale}
              duration={duration}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ZoomControl = ({
  scale,
  onChangeTimelineScale,
  duration,
}: {
  scale: ITimelineScaleState;
  onChangeTimelineScale: (scale: ITimelineScaleState) => void;
  duration: number;
}) => {
  const [localValue, setLocalValue] = useState(scale.index);

  useEffect(() => {
    setLocalValue(scale.index);
  }, [scale.index]);

  const onZoomOutClick = () => {
    const previousZoom = getPreviousZoomLevel(scale);
    onChangeTimelineScale(previousZoom);
  };

  const onZoomInClick = () => {
    const nextZoom = getNextZoomLevel(scale);
    onChangeTimelineScale(nextZoom);
  };

  const onZoomFitClick = () => {
    const fitZoom = getFitZoomLevel(duration, scale.zoom);
    onChangeTimelineScale(fitZoom);
  };

  return (
    <div className="flex items-center justify-end">
      <div className="flex border-l border-border pl-4 pr-2">
        <Button size={"icon"} variant={"ghost"} onClick={onZoomOutClick} title="Zoom Out (-)">
          <ZoomOut size={16} />
        </Button>
        <Slider
          className="w-28"
          value={[localValue]}
          min={0}
          max={12}
          step={1}
          onValueChange={(e) => {
            setLocalValue(e[0]); // Update local state
          }}
          onValueCommit={() => {
            const zoom = getZoomByIndex(localValue);
            onChangeTimelineScale(zoom); // Propagate value to parent when user commits change
          }}
        />
        <Button size={"icon"} variant={"ghost"} onClick={onZoomInClick} title="Zoom In (+)">
          <ZoomIn size={16} />
        </Button>
        <Button onClick={onZoomFitClick} variant={"ghost"} size={"icon"}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M20 8V6h-2q-.425 0-.712-.288T17 5t.288-.712T18 4h2q.825 0 1.413.588T22 6v2q0 .425-.288.713T21 9t-.712-.288T20 8M2 8V6q0-.825.588-1.412T4 4h2q.425 0 .713.288T7 5t-.288.713T6 6H4v2q0 .425-.288.713T3 9t-.712-.288T2 8m18 12h-2q-.425 0-.712-.288T17 19t.288-.712T18 18h2v-2q0-.425.288-.712T21 15t.713.288T22 16v2q0 .825-.587 1.413T20 20M4 20q-.825 0-1.412-.587T2 18v-2q0-.425.288-.712T3 15t.713.288T4 16v2h2q.425 0 .713.288T7 19t-.288.713T6 20zm2-6v-4q0-.825.588-1.412T8 8h8q.825 0 1.413.588T18 10v4q0 .825-.587 1.413T16 16H8q-.825 0-1.412-.587T6 14"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default Header;
