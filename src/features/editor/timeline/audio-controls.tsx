import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";
import useStore from "../store/use-store";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";

const AudioControls = () => {
  const { trackItemsMap, activeIds } = useStore();
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);

  // Apply volume changes to all video tracks (since Remotion doesn't have global volume)
  const applyVolume = (newVolume: number, muted: boolean = false) => {
    const actualVolume = muted ? 0 : newVolume;
    
    // Update all video tracks' volume
    const videoTracks = Object.values(trackItemsMap).filter(item => item.type === 'video');
    
    if (videoTracks.length > 0) {
      const updatePayload: any = {};
      
      videoTracks.forEach(track => {
        updatePayload[track.id] = {
          details: {
            volume: actualVolume,
          },
        };
      });
      
      dispatch(EDIT_OBJECT, {
        payload: updatePayload,
      });
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    
    if (vol === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
    
    applyVolume(vol);
  };

  const handleMute = () => {
    if (isMuted) {
      // Unmute: restore previous volume
      const restoreVolume = previousVolume > 0 ? previousVolume : 50;
      setVolume(restoreVolume);
      setIsMuted(false);
      applyVolume(restoreVolume);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
      applyVolume(0, true);
    }
  };

  const adjustVolume = (increment: number) => {
    const newVolume = Math.min(100, Math.max(0, volume + increment));
    setVolume(newVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
    
    applyVolume(newVolume);
  };

  // Initialize volume when video tracks are available
  useEffect(() => {
    const videoTracks = Object.values(trackItemsMap).filter(item => item.type === 'video');
    if (videoTracks.length > 0) {
      // Get the current volume from the first video track
      const firstVideoTrack = videoTracks[0] as any;
      const currentVolume = firstVideoTrack.details?.volume || 100;
      setVolume(currentVolume);
      setIsMuted(currentVolume === 0);
    }
  }, [trackItemsMap]);

  // Keyboard shortcuts for audio controls
  useEffect(() => {
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

      // Use Ctrl/Cmd+Arrow keys for volume control
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      
      switch (event.key) {
        case 'ArrowUp':
          if (isCtrlOrCmd) {
            event.preventDefault();
            adjustVolume(5); // Increase volume by 5%
          }
          break;
        case 'ArrowDown':
          if (isCtrlOrCmd) {
            event.preventDefault();
            adjustVolume(-5); // Decrease volume by 5%
          }
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          handleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [volume, isMuted, previousVolume, trackItemsMap]);

  return (
    <div className="flex items-center gap-2 px-2 border-l border-border/40">
      <Button
        onClick={handleMute}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-white"
        title={isMuted ? "Unmute (M)" : "Mute (M)"}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </Button>
      
      <div className="flex items-center gap-2">
        <Slider
          value={[volume]}
          onValueChange={handleVolumeChange}
          max={100}
          step={1}
          className="w-20"
          title="Volume (Ctrl/Cmd+↑↓)"
        />
        <span className="text-xs text-muted-foreground w-8 text-center">
          {Math.round(volume)}
        </span>
      </div>
    </div>
  );
};

export default AudioControls; 