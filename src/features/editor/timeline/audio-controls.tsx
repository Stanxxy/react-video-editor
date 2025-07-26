import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import useStore from "../store/use-store";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";

const AudioControls = () => {
  const { trackItemsMap } = useStore();
  const [isMuted, setIsMuted] = useState(false);

  // Apply volume changes to all video tracks (simple mute/unmute)
  const applyVolume = (muted: boolean) => {
    const actualVolume = muted ? 0 : 100; // Simple 0 or 100
    
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

  const handleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    applyVolume(newMutedState);
  };

  // Initialize mute state when video tracks are available
  useEffect(() => {
    const videoTracks = Object.values(trackItemsMap).filter(item => item.type === 'video');
    if (videoTracks.length > 0) {
      // Get the current volume from the first video track
      const firstVideoTrack = videoTracks[0] as any;
      const currentVolume = firstVideoTrack.details?.volume || 100;
      setIsMuted(currentVolume === 0);
    }
  }, [trackItemsMap]);

  // Keyboard shortcuts for audio controls (just mute toggle)
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

      // Only handle mute toggle
      switch (event.key) {
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
  }, [isMuted]);

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
    </div>
  );
};

export default AudioControls; 