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
  clipId: string;
  event: string;
  technique: string;
  selectedPlayer: 'player1' | 'player2'; // Which player this annotation is for
  result: string; // Result for the selected player
  notes: string;
  startTime: number; // in milliseconds
  endTime: number;   // in milliseconds
  createdAt: Date;
}

interface GlobalPlayerNames {
  player1: string;
  player2: string;
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
    selectedPlayer: 'player1',
    result: "",
    notes: "",
    startTime: 0,
    endTime: 0,
    createdAt: new Date(),
  });

  // Global player names (persistent across all annotations)
  const [globalPlayerNames, setGlobalPlayerNames] = useState<GlobalPlayerNames>(() => {
    const saved = localStorage.getItem('global-player-names');
    return saved ? JSON.parse(saved) : { player1: "Fighter Red", player2: "Fighter Blue" };
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
    "Blocked",
    "Countered",
    "Advantage",
    "Neutral",
  ];

  // Generate unique annotation ID
  const generateId = () => {
    return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Load saved annotations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('combat-annotations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const annotationsWithDates = parsed.map((ann: any) => ({
          ...ann,
          createdAt: new Date(ann.createdAt)
        }));
        setSavedAnnotations(annotationsWithDates);
      } catch (error) {
        console.error('Error loading annotations:', error);
      }
    }
  }, []);

  // Save annotations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('combat-annotations', JSON.stringify(savedAnnotations));
  }, [savedAnnotations]);

  // Clean annotation form
  const handleCleanAnnotation = () => {
    setAnnotation({
      id: '',
      clipId: clipId,
      event: '',
      technique: '',
      selectedPlayer: 'player1',
      result: '',
      notes: '',
      startTime: clipStartTime,
      endTime: clipEndTime,
      createdAt: new Date(),
    });
  };

  // Save or update annotation
  const handleSaveAnnotation = () => {
    if (!annotation.event || !annotation.technique || !selectedClip) {
      console.warn('Missing required fields for annotation');
      return;
    }

    const annotationToSave: AnnotationData = {
      ...annotation,
      id: annotation.id || generateId(),
      clipId: clipId,
      startTime: clipStartTime,
      endTime: clipEndTime,
      createdAt: annotation.id ? annotation.createdAt : new Date(),
    };

    if (annotation.id) {
      // Update existing annotation
      setSavedAnnotations(prev => 
        prev.map(ann => ann.id === annotation.id ? annotationToSave : ann)
      );
      console.log('Annotation updated:', annotationToSave);
    } else {
      // Add new annotation
      setSavedAnnotations(prev => [...prev, annotationToSave]);
      console.log('New annotation saved:', annotationToSave);
    }

    // Reset form after saving
    handleCleanAnnotation();
  };

  // Jump to annotation timestamp
  const handleJumpToAnnotation = (ann: AnnotationData) => {
    const targetFrame = (ann.startTime / 1000) * fps;
    playerRef?.current?.seekTo(targetFrame);
    
    // Load the annotation for editing
    setAnnotation({
      id: ann.id,
      clipId: ann.clipId,
      event: ann.event,
      technique: ann.technique,
      selectedPlayer: ann.selectedPlayer,
      result: ann.result,
      notes: ann.notes,
      startTime: ann.startTime,
      endTime: ann.endTime,
      createdAt: ann.createdAt,
    });

    // Close annotations list
    setShowAnnotationsList(false);
  };

  // Delete annotation
  const handleDeleteAnnotation = (annotationId: string) => {
    setSavedAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
    
    // If currently editing this annotation, clear the form
    if (annotation.id === annotationId) {
      handleCleanAnnotation();
    }
  };

  // Mock AI Analysis
  const handleAIAnalysis = async () => {
    if (!selectedClip) return;
    
    setIsAnalyzing(true);
    
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock AI result
    const mockEvents = ["Strike", "Grappling", "Takedown"];
    const mockTechniques = ["Jab", "Cross", "Single Leg"];
    const mockResults = ["Success", "Failed", "Blocked"];
    
    setAnnotation(prev => ({
      ...prev,
      event: mockEvents[Math.floor(Math.random() * mockEvents.length)],
      technique: mockTechniques[Math.floor(Math.random() * mockTechniques.length)],
      result: mockResults[Math.floor(Math.random() * mockResults.length)],
    }));
    
    setIsAnalyzing(false);
  };

  // Format time for display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get duration between start and end
  const getDuration = (start: number, end: number) => {
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    return `${seconds}s`;
  };

  // Get clip display name
  const getClipDisplayName = (clipId: string, startTime: number, endTime: number) => {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  // Show annotations list view
  if (showAnnotationsList) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="text-text-primary flex h-12 flex-none items-center justify-between px-4 text-sm font-medium border-b border-border/50">
          <span>Annotations ({savedAnnotations.length})</span>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAnnotationsList(false)}
            className="text-blue-400 hover:text-blue-300"
          >
            Back to Form
          </Button>
        </div>
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-3 p-4">
            {savedAnnotations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No annotations yet. Create your first annotation!
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
                    <div><strong>Player:</strong> {globalPlayerNames[ann.selectedPlayer]} ({ann.result})</div>
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

          {/* Global Player Names Section */}
          <div className="border border-border/50 rounded-lg p-3 bg-background/30">
            <Label className="font-sans text-xs font-semibold text-primary mb-2 block">
              Player Names (Global)
            </Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Player 1</Label>
                <Input
                  placeholder="Fighter Red"
                  value={globalPlayerNames.player1}
                  onChange={(e) => {
                    const newNames = { ...globalPlayerNames, player1: e.target.value };
                    setGlobalPlayerNames(newNames);
                    localStorage.setItem('global-player-names', JSON.stringify(newNames));
                  }}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Player 2</Label>
                <Input
                  placeholder="Fighter Blue"
                  value={globalPlayerNames.player2}
                  onChange={(e) => {
                    const newNames = { ...globalPlayerNames, player2: e.target.value };
                    setGlobalPlayerNames(newNames);
                    localStorage.setItem('global-player-names', JSON.stringify(newNames));
                  }}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Event Type *
            </Label>
            <Select value={annotation.event} onValueChange={(value) => 
              setAnnotation(prev => ({ ...prev, event: value }))
            }>
              <SelectTrigger className="h-9">
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

          {/* Player Selection */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Player *
            </Label>
            <Select value={annotation.selectedPlayer} onValueChange={(value: 'player1' | 'player2') => 
              setAnnotation(prev => ({ ...prev, selectedPlayer: value }))
            }>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player1">{globalPlayerNames.player1}</SelectItem>
                <SelectItem value="player2">{globalPlayerNames.player2}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Result */}
          <div className="space-y-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Result for {globalPlayerNames[annotation.selectedPlayer]} *
            </Label>
            <Select value={annotation.result} onValueChange={(value) => 
              setAnnotation(prev => ({ ...prev, result: value }))
            }>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select result" />
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
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clean Annotation
            </Button>
            
            <Button
              onClick={handleSaveAnnotation}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!annotation.event || !annotation.technique || !selectedClip}
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