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
  player1: string;
  player2: string;
  result1: string;
  result2: string;
  notes: string;
  createdAt: Date;
}

interface DownloadState {
  projectId: string;
  exporting: boolean;
  exportType: "json" | "mp4";
  progress: number;
  output?: Output;
  payload?: IDesign;
  displayProgressModal: boolean;
  actions: {
    setProjectId: (projectId: string) => void;
    setExporting: (exporting: boolean) => void;
    setExportType: (exportType: "json" | "mp4") => void;
    setProgress: (progress: number) => void;
    setState: (state: Partial<DownloadState>) => void;
    setOutput: (output: Output) => void;
    startExport: () => void;
    setDisplayProgressModal: (displayProgressModal: boolean) => void;
  };
}

// Convert frontend annotations to VideoEvent schema
const convertAnnotationsToVideoEvents = (annotations: AnnotationData[]): VideoEvent[] => {
  return annotations.map(annotation => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate UUID-like ID
    video_id: `video-${Date.now()}`, // Dummy video ID for now
    start_moment: Math.round(annotation.startTime), // Convert to integer milliseconds
    end_moment: Math.round(annotation.endTime), // Convert to integer milliseconds
    player_id: annotation.player1 || annotation.player2 || "unknown", // Use first available player
    action: `${annotation.event}: ${annotation.technique}`, // Combine event and technique
    result: annotation.result1 || annotation.result2 || "unknown", // Use first available result
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

export const useDownloadState = create<DownloadState>((set, get) => ({
  projectId: "",
  exporting: false,
  exportType: "mp4",
  progress: 0,
  displayProgressModal: false,
  actions: {
    setProjectId: (projectId) => set({ projectId }),
    setExporting: (exporting) => set({ exporting }),
    setExportType: (exportType) => set({ exportType }),
    setProgress: (progress) => set({ progress }),
    setState: (state) => set({ ...state }),
    setOutput: (output) => set({ output }),
    setDisplayProgressModal: (displayProgressModal) =>
      set({ displayProgressModal }),
    startExport: async () => {
      try {
        // Set exporting to true at the start
        set({ exporting: true, displayProgressModal: true });

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
          
          // Convert to VideoEvent schema
          const videoEvents = convertAnnotationsToVideoEvents(annotations);
          
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
          // Handle MP4 export (original code)
          const { payload } = get();

          if (!payload) throw new Error("Payload is not defined");

          // Step 1: POST request to start rendering
          const response = await fetch("/api/render", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              design: payload,
              options: {
                fps: 30,
                size: payload.size,
                format: "mp4",
              },
            }),
          });

          if (!response.ok) throw new Error("Failed to submit export request.");

          const jobInfo = await response.json();
          const videoId = jobInfo.video.id;

          // Step 2 & 3: Polling for status updates
          const checkStatus = async () => {
            const statusResponse = await fetch(
              `/api/render?id=${videoId}&type=VIDEO_RENDERING`,
            );

            if (!statusResponse.ok)
              throw new Error("Failed to fetch export status.");

            const statusInfo = await statusResponse.json();
            const { status, progress, url } = statusInfo.video;

            set({ progress });

            if (status === "COMPLETED") {
              set({ exporting: false, output: { url, type: get().exportType } });
            } else if (status === "PENDING") {
              setTimeout(checkStatus, 2500);
            }
          };

          checkStatus();
        }
      } catch (error) {
        console.error(error);
        set({ exporting: false });
      }
    },
  },
}));
