import { ScrollArea } from "@/components/ui/scroll-area";
import { ITrackItem, IVideo } from "@designcombo/types";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Save, List, Trash2, Clock, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useStore from "../store/use-store";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import StateManager from "@designcombo/state";
import { useScreenSize } from "../../../utils/mobile";

interface AnnotationData {
  id: string;
  clipId: string; // Add clip ID for better identification
  event: string;
  technique: string;
  player1: string;
  player2: string;
  result1: string;
  result2: string;
  notes: string;
  startTime: number; // in milliseconds
  endTime: number;   // in milliseconds
  createdAt: Date;
}

const BasicVideo = ({ trackItem, stateManager }: { trackItem: ITrackItem & IVideo; stateManager: StateManager }) => {
  const { playerRef, fps, activeIds, trackItemsMap } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef!);
  const currentTimeMs = (currentFrame / fps) * 1000;
  const screenSize = useScreenSize();
  
  const isMobile = screenSize === 'mobile';
  
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

  const [savedAnnotations, setSavedAnnotations] = useState<AnnotationData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnnotationsList, setShowAnnotationsList] = useState(false);

  // Get current selected clip boundaries
  const selectedClip = activeIds.length > 0 ? trackItemsMap[activeIds[0]] : null;
  const clipStartTime = selectedClip?.display.from || 0;
  const clipEndTime = selectedClip?.display.to || 0;
  const clipId = selectedClip?.id || "";

  const eventTypes = [
    "Strike",
    "Grappling",
    "Takedown", 
    "Submission",
    "Defense",
    "Counter Attack",
    "Clinch",
    "Ground Control",
  ];

  const techniques = [
    "Jab",
    "Cross", 
    "Hook",
    "Uppercut",
    "Kick",
    "Knee",
    "Elbow",
    "Single Leg",
    "Double Leg",
    "Hip Toss",
    "Sprawl",
    "Guard Pull",
    "Armbar",
    "Triangle",
    "Guillotine",
    "Rear Naked Choke",
  ];

  const results = [
    "Success",
    "Partial Success", 
    "Failed",
    "Countered",
    "Defended",
    "Scored",
  ];

  // Load saved annotations from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('combat-annotations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedAnnotations(parsed.map((a: any) => ({
          ...a,
          clipId: a.clipId || "", // Handle old annotations without clipId
          createdAt: new Date(a.createdAt)
        })));
      } catch (error) {
        console.error('Error loading annotations:', error);
      }
    }
  }, []);

  // Reset form when selecting a different clip that has no annotation
  useEffect(() => {
    if (selectedClip) {
      const existingAnnotation = savedAnnotations.find(ann => ann.clipId === selectedClip.id);
      
      if (existingAnnotation) {
        // Populate form with existing annotation
        setAnnotation(existingAnnotation);
      } else {
        // Reset form for new clip
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
    }
  }, [selectedClip, savedAnnotations]);

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

    // Update or add annotation
    const updatedAnnotations = annotation.id 
      ? savedAnnotations.map(a => a.id === annotation.id ? newAnnotation : a)
      : [...savedAnnotations, newAnnotation];
    
    setSavedAnnotations(updatedAnnotations);
    
    // Save to localStorage
    localStorage.setItem('combat-annotations', JSON.stringify(updatedAnnotations));
    
    console.log("Annotation saved successfully!");
  };

  const handleDeleteAnnotation = (id: string) => {
    const updatedAnnotations = savedAnnotations.filter(a => a.id !== id);
    setSavedAnnotations(updatedAnnotations);
    localStorage.setItem('combat-annotations', JSON.stringify(updatedAnnotations));
  };

  const handleCleanAnnotation = () => {
    // Remove annotation from the associated clip if any
    if (annotation.id) {
      const updatedAnnotations = savedAnnotations.filter(a => a.id !== annotation.id);
      setSavedAnnotations(updatedAnnotations);
      localStorage.setItem('combat-annotations', JSON.stringify(updatedAnnotations));
    }
    
    // Reset all input box values
    setAnnotation({
      id: '',
      clipId: clipId,
      event: '',
      technique: '',
      player1: '',
      player2: '',
      result1: '',
      result2: '',
      notes: '',
      startTime: clipStartTime,
      endTime: clipEndTime,
      createdAt: new Date()
    });
  };

  const handleJumpToAnnotation = (annotation: AnnotationData) => {
    // Find the track item that corresponds to this annotation's clip ID
    const matchingTrackItem = Object.values(trackItemsMap).find(item => 
      item.id === annotation.clipId
    );

    if (matchingTrackItem) {
      // Select the matching track item using the proper stateManager
      stateManager.updateState(
        {
          activeIds: [matchingTrackItem.id],
          },
        {
          updateHistory: false,
          kind: "layer:selection",
        },
      );
    }

    // Populate the annotation form with the selected annotation's data
    setAnnotation({
      id: annotation.id,
      clipId: annotation.clipId,
      event: annotation.event,
      technique: annotation.technique,
      player1: annotation.player1,
      player2: annotation.player2,
      result1: annotation.result1,
      result2: annotation.result2,
      notes: annotation.notes,
      startTime: annotation.startTime,
      endTime: annotation.endTime,
      createdAt: annotation.createdAt,
    });

    // Jump to the start time of the annotation
    const frameToSeek = (annotation.startTime / 1000) * fps;
    playerRef?.current?.seekTo(frameToSeek);
    
    // Switch back to annotation form
    setShowAnnotationsList(false);
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate AI analysis - replace with actual AI integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock AI results using clip boundaries
      setAnnotation(prev => ({
        ...prev,
        event: "Strike",
        technique: "Jab",
        player1: "Fighter Red",
        result1: "Success",
        startTime: clipStartTime,
        endTime: clipEndTime,
      }));
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keyboard shortcuts for annotation controls (disabled on mobile)
  useEffect(() => {
    // Don't add keyboard listeners on mobile devices
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      
      // Handle 'Escape' to blur current input and close select dropdowns
      if (event.key === 'Escape') {
        event.preventDefault();
        
        // First, check if there are any open Select components (Radix UI creates elements with data-state="open")
        const openSelectContent = document.querySelector('[data-radix-select-content][data-state="open"]');
        if (openSelectContent) {
          // If there's an open select, trigger escape on it to close it
          const escapeEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true
          });
          openSelectContent.dispatchEvent(escapeEvent);
          return; // Exit early after handling select
        }
        
        // If no select is open, blur any focused input element
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
          activeElement.blur();
        }
        return; // Exit early after handling escape
      }
      
      // Don't trigger other shortcuts when typing in inputs, textareas, or contenteditable elements
      if (isInputFocused) {
        return;
      }
      
      // Handle Ctrl/Cmd+Enter for AI analysis
      if (isCtrlOrCmd && event.key === 'Enter') {
        event.preventDefault();
        if (selectedClip && !isAnalyzing) {
          handleAIAnalysis();
        }
      }
      
      // Handle Shift+Enter for Save Annotation
      if (event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        if (annotation.event && annotation.technique && selectedClip) {
          handleSaveAnnotation();
        }
      }
      
      // Handle '/' to focus Event Type select
      if (event.key === '/') {
        event.preventDefault();
        const eventTypeSelect = document.querySelector('[data-testid="event-type-select"]') as HTMLElement;
        if (eventTypeSelect) {
          eventTypeSelect.focus();
        }
      }
      
      // Handle Ctrl/Cmd+Backspace for Clean Annotation
      if (isCtrlOrCmd && event.key === 'Backspace') {
        event.preventDefault();
        handleCleanAnnotation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, selectedClip, isAnalyzing, annotation.event, annotation.technique, handleAIAnalysis, handleSaveAnnotation, handleCleanAnnotation]);

  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeRange = (startMs: number, endMs: number) => {
    return `${formatTime(startMs)} - ${formatTime(endMs)}`;
  };

  const getDuration = (startMs: number, endMs: number) => {
    const durationMs = endMs - startMs;
    const seconds = Math.floor(durationMs / 1000);
    return `${seconds}s`;
  };

  // Generate a human-readable clip ID for display
  const getClipDisplayName = (clipId: string, startTime: number, endTime: number) => {
    return `Clip ${formatTimeRange(startTime, endTime)}`;
  };

  if (showAnnotationsList) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="text-text-primary flex h-12 flex-none items-center justify-between px-4 text-sm font-medium border-b border-border/50">
          <span>Saved Annotations ({savedAnnotations.length})</span>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAnnotationsList(false)}
          >
            Back
          </Button>
        </div>
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {savedAnnotations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2" />
                <p>No annotations saved yet</p>
              </div>
            ) : (
              savedAnnotations.map((ann) => (
                <div 
                  key={ann.id}
                  className="border border-border/50 rounded-lg p-3 bg-background/30 hover:bg-background/50 transition-colors cursor-pointer"
                  onClick={() => handleJumpToAnnotation(ann)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {ann.event}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {ann.technique}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToAnnotation(ann);
                        }}
                        className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300"
                        title="Jump to timestamp"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnnotation(ann.id);
                        }}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        title="Delete annotation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1 font-mono text-blue-400">
                      <Clock className="h-3 w-3" />
                      {getClipDisplayName(ann.clipId, ann.startTime, ann.endTime)} ({getDuration(ann.startTime, ann.endTime)})
                    </div>
                    {ann.clipId && <div><strong>Clip ID:</strong> {ann.clipId.substring(0, 8)}...</div>}
                    {ann.player1 && <div><strong>Player 1:</strong> {ann.player1} ({ann.result1})</div>}
                    {ann.player2 && <div><strong>Player 2:</strong> {ann.player2} ({ann.result2})</div>}
                    {ann.notes && <div><strong>Notes:</strong> {ann.notes}</div>}
                    <div className="text-xs text-muted-foreground/70">
                      Created: {ann.createdAt.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center justify-between px-4 text-sm font-medium border-b border-border/50">
        <span>Combat Sport Annotation</span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowAnnotationsList(true)}
          className="text-blue-400 hover:text-blue-300"
        >
          <List className="h-4 w-4 mr-1" />
          View ({savedAnnotations.length})
        </Button>
      </div>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-4">
          
          {/* Selected Clip Info */}
          <div className="text-xs text-muted-foreground bg-background/20 p-3 rounded">
            <div className="font-medium mb-1">Selected Clip</div>
            {selectedClip ? (
              <>
                <div className="space-y-1">
                  <div><strong>Clip:</strong> {getClipDisplayName(clipId, clipStartTime, clipEndTime)} ({getDuration(clipStartTime, clipEndTime)})</div>
                  <div><strong>Clip ID:</strong> {clipId.substring(0, 8)}...</div>
                  <div><strong>Current Time:</strong> {formatTime(currentTimeMs)}</div>
                  {annotation.id && (
                    <div className="text-green-400"><strong>Status:</strong> Has annotation (editing existing)</div>
                  )}
                  {!annotation.id && (
                    <div className="text-blue-400"><strong>Status:</strong> No annotation (creating new)</div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-yellow-400">No clip selected - please select a video clip to annotate</div>
            )}
          </div>
          
          {/* AI Recognition Section */}
          <div className="border border-border/50 rounded-lg p-3 bg-background/30">
            <Label className="font-sans text-xs font-semibold text-blue-400 mb-2 block">
              AI Recognition
            </Label>
            <Button
              onClick={handleAIAnalysis}
              disabled={isAnalyzing || !selectedClip}
              variant="outline"
              size="sm"
              className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-950/20 disabled:opacity-50"
              title="Analyze Selected Clip (Ctrl/Cmd+Enter)"
            >
              {isAnalyzing ? (
                <>
                  <Bot className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Analyze Selected Clip
                </>
              )}
            </Button>
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Event Type * (Press '/' to focus)
            </Label>
            <Select value={annotation.event} onValueChange={(value) => 
              setAnnotation(prev => ({ ...prev, event: value }))
            }>
              <SelectTrigger className="h-9" data-testid="event-type-select">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((event) => (
                  <SelectItem key={event} value={event}>
                    {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Technique */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Technique *
            </Label>
            <Select value={annotation.technique} onValueChange={(value) => 
              setAnnotation(prev => ({ ...prev, technique: value }))
            }>
              <SelectTrigger className="h-9">
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

          {/* Players Section */}
          <div className="space-y-3">
            <Label className="font-sans text-xs font-semibold text-primary">
              Players
            </Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Player 1</Label>
                <Input
                  placeholder="Fighter Red"
                  value={annotation.player1}
                  onChange={(e) => 
                    setAnnotation(prev => ({ ...prev, player1: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Player 2</Label>
                <Input
                  placeholder="Fighter Blue"
                  value={annotation.player2}
                  onChange={(e) => 
                    setAnnotation(prev => ({ ...prev, player2: e.target.value }))
                  }
                  className="h-9"
            />
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-3">
            <Label className="font-sans text-xs font-semibold text-primary">
              Results
            </Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Result 1</Label>
                <Select value={annotation.result1} onValueChange={(value) => 
                  setAnnotation(prev => ({ ...prev, result1: value }))
                }>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Player 1 result" />
                  </SelectTrigger>
                  <SelectContent>
                    {results.map((result) => (
                      <SelectItem key={result} value={result}>
                        {result}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Result 2</Label>
                <Select value={annotation.result2} onValueChange={(value) => 
                  setAnnotation(prev => ({ ...prev, result2: value }))
                }>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Player 2 result" />
                  </SelectTrigger>
                  <SelectContent>
                    {results.map((result) => (
                      <SelectItem key={result} value={result}>
                        {result}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Notes
            </Label>
            <Textarea
              placeholder="Additional notes about this sequence..."
              value={annotation.notes}
              onChange={(e) => 
                setAnnotation(prev => ({ ...prev, notes: e.target.value }))
              }
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCleanAnnotation}
              variant="outline"
              className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-950/20"
              title="Clean Annotation (Ctrl/Cmd+Backspace)"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clean Annotation
            </Button>
            
            <Button
              onClick={handleSaveAnnotation}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!annotation.event || !annotation.technique || !selectedClip}
              title="Save Annotation (Shift+Enter)"
            >
              <Save className="mr-2 h-4 w-4" />
              {annotation.id ? 'Update Annotation' : 'Save Annotation'}
            </Button>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};

export default BasicVideo;
