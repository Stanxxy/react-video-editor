import { IDesign } from "@designcombo/types";
import { create } from "zustand";

interface Output {
  url: string;
  type: string;
}

// VideoEvent interface matching the backend schema
interface VideoEvent {
  id: string;
  video_id: string;
  start_moment: number;
  end_moment: number;
  player_id: string;
  action: string;
  result: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// Annotation data interface (from our frontend)
interface AnnotationData {
  id: string;
  clipId: string;
  startTime: number;
  endTime: number;
  event: string;
  technique: string;
  selectedPlayer: 'player1' | 'player2';
  result: string;
  notes: string;
  createdAt: Date;
}

interface DownloadState {
  projectId: string;
  exporting: boolean;
  exportType: "json" | "excel";
  progress: number;
  output?: Output;
  payload?: IDesign;
  displayProgressModal: boolean;
  error?: string;
  actions: {
    setProjectId: (projectId: string) => void;
    setExporting: (exporting: boolean) => void;
    setExportType: (exportType: "json" | "excel") => void;
    setProgress: (progress: number) => void;
    setState: (state: Partial<DownloadState>) => void;
    setOutput: (output: Output) => void;
    setError: (error: string | undefined) => void;
    startExport: () => void;
    setDisplayProgressModal: (displayProgressModal: boolean) => void;
  };
}

// Convert frontend annotations to VideoEvent schema
const convertAnnotationsToVideoEvents = (annotations: AnnotationData[], globalPlayerNames: { player1: string; player2: string }): VideoEvent[] => {
  return annotations.map(annotation => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate UUID-like ID
    video_id: `video-${Date.now()}`, // Dummy video ID for now
    start_moment: Math.round(annotation.startTime), // Convert to integer milliseconds
    end_moment: Math.round(annotation.endTime), // Convert to integer milliseconds
    player_id: globalPlayerNames[annotation.selectedPlayer], // Use the selected player's name
    action: `${annotation.event}: ${annotation.technique}`, // Combine event and technique
    result: annotation.result, // Use the result for the selected player
    version: 1,
    created_at: annotation.createdAt.toISOString(),
    updated_at: annotation.createdAt.toISOString(),
  }));
};

// Create and download JSON file
const downloadJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return url;
};

// Helper function to download Excel (CSV format for broad compatibility)
const downloadExcel = (annotations: AnnotationData[], filename: string): string => {
  // Create CSV headers
  const headers = [
    'ID',
    'Clip ID', 
    'Event Type',
    'Technique',
    'Player Name',
    'Player Position',
    'Result',
    'Start Time (ms)',
    'End Time (ms)',
    'Duration (s)',
    'Notes',
    'Created At'
  ];
  
  // Get global player names
  const globalPlayerNames = JSON.parse(localStorage.getItem('global-player-names') || '{"player1":"Fighter Red","player2":"Fighter Blue"}');
  
  // Convert annotations to CSV rows
  const rows = annotations.map(annotation => [
    annotation.id,
    annotation.clipId,
    annotation.event,
    annotation.technique,
    globalPlayerNames[annotation.selectedPlayer],
    annotation.selectedPlayer,
    annotation.result,
    annotation.startTime,
    annotation.endTime,
    Math.round((annotation.endTime - annotation.startTime) / 1000),
    `"${annotation.notes.replace(/"/g, '""')}"`, // Escape quotes in notes
    annotation.createdAt.toISOString()
  ]);
  
  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
  
  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
  
  return url;
};

export const useDownloadState = create<DownloadState>((set, get) => ({
  projectId: "",
  exporting: false,
  exportType: "excel",
  progress: 0,
  displayProgressModal: false,
  actions: {
    setProjectId: (projectId) => set({ projectId }),
    setExporting: (exporting) => set({ exporting }),
    setExportType: (exportType) => set({ exportType }),
    setProgress: (progress) => set({ progress }),
    setState: (state) => set({ ...state }),
    setOutput: (output) => set({ output }),
    setError: (error) => set({ error }),
    setDisplayProgressModal: (displayProgressModal) =>
      set({ displayProgressModal }),
    startExport: async () => {
      try {
        // Set exporting to true at the start and clear any previous errors
        set({ exporting: true, displayProgressModal: true, error: undefined });

        const { exportType } = get();

        if (exportType === "json") {
          // Handle JSON export for annotations
          
          // Simulate progress for better UX
          set({ progress: 25 });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get annotations from localStorage
          const annotationsData = localStorage.getItem('combat-annotations');
          let annotations: AnnotationData[] = [];
          
          if (annotationsData) {
            try {
              const parsedAnnotations = JSON.parse(annotationsData);
              // Convert createdAt strings back to Date objects
              annotations = parsedAnnotations.map((ann: any) => ({
                ...ann,
                createdAt: new Date(ann.createdAt)
              }));
            } catch (error) {
              console.error('Error parsing annotations:', error);
            }
          }
          
          set({ progress: 50 });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get global player names and convert to VideoEvent schema
          const globalPlayerNames = JSON.parse(localStorage.getItem('global-player-names') || '{"player1":"Fighter Red","player2":"Fighter Blue"}');
          const videoEvents = convertAnnotationsToVideoEvents(annotations, globalPlayerNames);
          
          set({ progress: 75 });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Create export data with metadata
          const exportData = {
            metadata: {
              export_timestamp: new Date().toISOString(),
              total_annotations: videoEvents.length,
              export_format: "VideoEvent",
              version: "1.0"
            },
            video_events: videoEvents
          };
          
          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
          const filename = `video-annotations-${timestamp}.json`;
          
          // Download the JSON file
          const url = downloadJSON(exportData, filename);
          
          set({ progress: 100 });
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Set completion state
          set({ 
            exporting: false, 
            output: { 
              url: url, 
              type: 'json'
            } 
          });
          
        } else {
          // Handle Excel export for annotations
          
          // Simulate progress for better UX
          set({ progress: 25 });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get annotations from localStorage
          const annotationsData = localStorage.getItem('combat-annotations');
          let annotations: AnnotationData[] = [];
          
          if (annotationsData) {
            try {
              const parsedAnnotations = JSON.parse(annotationsData);
              // Convert createdAt strings back to Date objects
              annotations = parsedAnnotations.map((ann: any) => ({
                ...ann,
                createdAt: new Date(ann.createdAt)
              }));
            } catch (error) {
              console.error('Error parsing annotations:', error);
            }
          }
          
          set({ progress: 50 });
          await new Promise(resolve => setTimeout(resolve, 500));

          if (annotations.length === 0) {
            throw new Error("No annotations found to export");
          }
          
          set({ progress: 75 });
          await new Promise(resolve => setTimeout(resolve, 500));

          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
          const filename = `combat-annotations-${timestamp}.csv`;
          
          // Download the Excel file
          const url = downloadExcel(annotations, filename);
          
          set({ progress: 100 });
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Set completion state
          set({ 
            exporting: false, 
            output: { 
              url: url, 
              type: 'excel'
          }
          });
        }
      } catch (error) {
        console.error(error);
        set({ 
          exporting: false, 
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          progress: 0 
        });
      }
    },
  },
}));
