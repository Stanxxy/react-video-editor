import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Clock } from "lucide-react";
import { ITrackItem, IVideo } from "@designcombo/types";
import StateManager from "@designcombo/state";
import useStore from "../store/use-store";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";

interface AnnotationData {
  id: string;
  clipId: string;
  event: string;
  technique: string;
  player1: string;
  player2: string;
  result1: string;
  result2: string;
  notes: string;
  startTime: number;
  endTime: number;
  createdAt: Date;
}

interface MobileAnnotationPanelProps {
  stateManager: StateManager;
  onClose: () => void;
}

const MobileAnnotationPanel: React.FC<MobileAnnotationPanelProps> = ({ stateManager, onClose }) => {
  const { playerRef, fps, activeIds, trackItemsMap } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef!);
  const currentTimeMs = (currentFrame / fps) * 1000;
  
  const [annotation, setAnnotation] = useState<AnnotationData>({
    id: "",
    clipId: "",
    event: "",
    technique: "",
    player1: "",
    player2: "",
    result1: "",
    result2: "",
    notes: "",
    startTime: 0,
    endTime: 0,
    createdAt: new Date(),
  });

  // Get current selected clip
  const selectedClip = activeIds.length > 0 ? trackItemsMap[activeIds[0]] : null;
  const clipStartTime = selectedClip?.display.from || 0;
  const clipEndTime = selectedClip?.display.to || 0;
  const clipId = selectedClip?.id || "";

  const eventTypes = [
    "Strike", "Grappling", "Takedown", "Submission", "Defense", 
    "Counter Attack", "Clinch", "Ground Control"
  ];

  const techniques = [
    "Jab", "Cross", "Hook", "Uppercut", "Kick", "Knee", "Elbow",
    "Single Leg", "Double Leg", "Hip Toss", "Sprawl", "Guard Pull",
    "Armbar", "Triangle", "Guillotine", "Rear Naked Choke"
  ];

  const results = ["Success", "Partial Success", "Failed", "Countered", "Defended", "Scored"];

  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSaveAnnotation = () => {
    if (!annotation.event || !annotation.technique) {
      alert("Please fill in at least Event and Technique fields");
      return;
    }

    if (!selectedClip) {
      alert("Please select a video clip first");
      return;
    }

    const newAnnotation: AnnotationData = {
      ...annotation,
      id: annotation.id || Date.now().toString(),
      clipId: selectedClip.id,
      startTime: selectedClip.display.from,
      endTime: selectedClip.display.to,
      createdAt: annotation.id ? annotation.createdAt : new Date(),
    };

    // Get existing annotations
    const annotationsData = localStorage.getItem('combat-annotations');
    let existingAnnotations: AnnotationData[] = [];
    
    if (annotationsData) {
      try {
        existingAnnotations = JSON.parse(annotationsData);
      } catch (error) {
        console.error('Error parsing annotations:', error);
      }
    }

    // Update or add annotation
    const updatedAnnotations = annotation.id 
      ? existingAnnotations.map(a => a.id === annotation.id ? newAnnotation : a)
      : [...existingAnnotations, newAnnotation];
    
    // Save to localStorage
    localStorage.setItem('combat-annotations', JSON.stringify(updatedAnnotations));
    
    console.log("Annotation saved successfully!");
    onClose();
  };

  const handleClearAnnotation = () => {
    setAnnotation({
      id: "",
      clipId: selectedClip?.id || "",
      event: "",
      technique: "",
      player1: "",
      player2: "",
      result1: "",
      result2: "",
      notes: "",
      startTime: selectedClip?.display.from || 0,
      endTime: selectedClip?.display.to || 0,
      createdAt: new Date(),
    });
  };

  // Load existing annotation if clip is selected
  useEffect(() => {
    if (selectedClip) {
      const annotationsData = localStorage.getItem('combat-annotations');
      if (annotationsData) {
        try {
          const annotations = JSON.parse(annotationsData);
          const existingAnnotation = annotations.find((ann: any) => ann.clipId === selectedClip.id);
          
          if (existingAnnotation) {
            setAnnotation(existingAnnotation);
          } else {
            setAnnotation({
              id: "",
              clipId: selectedClip.id,
              event: "",
              technique: "",
              player1: "",
              player2: "",
              result1: "",
              result2: "",
              notes: "",
              startTime: selectedClip.display.from,
              endTime: selectedClip.display.to,
              createdAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Error loading annotations:', error);
        }
      }
    }
  }, [selectedClip]);

  return (
    <div className="flex flex-col h-full p-5 space-y-4">
      {/* Panel Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* AI Recognition Button */}
          <Button
            variant="outline"
            size="sm"
            className="p-2 border-primary/30 bg-background hover:bg-primary/10"
            title="AI Recognition"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              <circle cx="12" cy="8" r="2"/>
            </svg>
          </Button>
          
          <h2 className="text-xl font-bold text-white">
            {annotation.id ? "Edit Event" : "New Event"}
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-6 w-6 text-gray-400" />
        </Button>
      </div>

      {/* Current Clip Info */}
      {selectedClip && (
        <div className="bg-background/20 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            <span>Clip: {formatTime(clipStartTime)} - {formatTime(clipEndTime)}</span>
            <span>({Math.round((clipEndTime - clipStartTime) / 1000)}s)</span>
          </div>
        </div>
      )}

      {/* Event Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-400">Event Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {eventTypes.slice(0, 6).map((event) => (
            <Button
              key={event}
              variant={annotation.event === event ? "default" : "secondary"}
              size="sm"
              className={`text-xs p-3 h-auto ${
                annotation.event === event 
                  ? "bg-primary text-white" 
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => setAnnotation(prev => ({ ...prev, event }))}
            >
              {event}
            </Button>
          ))}
        </div>
      </div>

      {/* Technique */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-400">Technique</Label>
        <Select value={annotation.technique} onValueChange={(value) => 
          setAnnotation(prev => ({ ...prev, technique: value }))
        }>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select technique" />
          </SelectTrigger>
          <SelectContent>
            {techniques.map((technique) => (
              <SelectItem key={technique} value={technique}>
                {technique}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Players & Results */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-400">Player 1</Label>
          <Input
            placeholder="Fighter Red"
            value={annotation.player1}
            onChange={(e) => setAnnotation(prev => ({ ...prev, player1: e.target.value }))}
            className="h-12"
          />
          <div className="flex gap-1">
            {results.slice(0, 3).map((result) => (
              <Button
                key={result}
                variant={annotation.result1 === result ? "default" : "secondary"}
                size="sm"
                className={`text-xs flex-1 ${
                  annotation.result1 === result 
                    ? "bg-primary text-white" 
                    : "bg-gray-700 text-gray-300"
                }`}
                onClick={() => setAnnotation(prev => ({ ...prev, result1: result }))}
              >
                {result}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-400">Player 2</Label>
          <Input
            placeholder="Fighter Blue"
            value={annotation.player2}
            onChange={(e) => setAnnotation(prev => ({ ...prev, player2: e.target.value }))}
            className="h-12"
          />
          <div className="flex gap-1">
            {results.slice(0, 3).map((result) => (
              <Button
                key={result}
                variant={annotation.result2 === result ? "default" : "secondary"}
                size="sm"
                className={`text-xs flex-1 ${
                  annotation.result2 === result 
                    ? "bg-primary text-white" 
                    : "bg-gray-700 text-gray-300"
                }`}
                onClick={() => setAnnotation(prev => ({ ...prev, result2: result }))}
              >
                {result}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-400">Notes</Label>
        <Textarea
          placeholder="Additional notes..."
          value={annotation.notes}
          onChange={(e) => setAnnotation(prev => ({ ...prev, notes: e.target.value }))}
          className="min-h-[80px] resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-2 space-y-3">
        <div className="flex gap-3">
          <Button
            onClick={handleClearAnnotation}
            variant="outline"
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold py-3 rounded-xl"
            size="lg"
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            onClick={handleSaveAnnotation}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl"
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileAnnotationPanel; 