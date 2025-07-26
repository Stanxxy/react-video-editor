"use client";
import Timeline from "./timeline";
import useStore from "./store/use-store";
import Navbar from "./navbar";
import useTimelineEvents from "./hooks/use-timeline-events";
import Scene from "./scene";
import StateManager from "@designcombo/state";
import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getCompactFontData, loadFonts } from "./utils/fonts";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import { ControlItem } from "./control-item";
import CropModal from "./crop-modal/crop-modal";
import useDataState from "./store/use-data-state";
import { FONTS } from "./data/fonts";
import FloatingControl from "./control-item/floating-controls/floating-control";
import { useScreenSize } from "../../utils/mobile";
import { Button } from "@/components/ui/button";
import MobileAnnotationPanel from "./control-item/mobile-annotation-panel";
import { subject, filter } from "@designcombo/events";
import { OPEN_ANNOTATION_PANEL } from "./constants/events";
import BottomTab from "./timeline/bottom-tab";

// Initialize with horizontal orientation (YouTube format) by default
const stateManager = new StateManager({
  size: {
    width: 1920,
    height: 1080,
  },
});

const Editor = () => {
  const [projectName, setProjectName] = useState<string>("Untitled video");
  const [showRightPanel, setShowRightPanel] = useState(false);
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const { timeline, playerRef, setState, orientation, size } = useStore();
  const screenSize = useScreenSize();
  
  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';

  useTimelineEvents();

  // Sync stateManager size changes to store
  useEffect(() => {
    const sizeSubscription = stateManager.subscribeToSize((newState) => {
      console.log("🔄 StateManager size changed:", newState.size);
      setState(newState);
    });

    return () => {
      sizeSubscription.unsubscribe();
    };
  }, [setState]);

  // Listen for annotation panel open events
  useEffect(() => {
    const annotationEvents = subject.pipe(
      filter(({ key }) => key === OPEN_ANNOTATION_PANEL)
    );

    const annotationSubscription = annotationEvents.subscribe(() => {
      if (isMobile) {
        setShowRightPanel(true);
      }
    });

    return () => {
      annotationSubscription.unsubscribe();
    };
  }, [isMobile]);

  const { setCompactFonts, setFonts } = useDataState();

  useEffect(() => {
    setCompactFonts(getCompactFontData(FONTS));
    setFonts(FONTS);
  }, []);

  useEffect(() => {
    loadFonts([
      {
        name: SECONDARY_FONT,
        url: SECONDARY_FONT_URL,
      },
    ]);
  }, []);

  useEffect(() => {
    const screenHeight = window.innerHeight;
    const desiredHeight = 300;
    const percentage = (desiredHeight / screenHeight) * 100;
    timelinePanelRef.current?.resize(percentage);
  }, []);

  const handleTimelineResize = () => {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) return;

    // On desktop, account for annotation panel width (272px)
    const widthOffset = isMobile ? 40 : 40; // Keep same offset since we're using calc() for container width
    
    const newDimensions = {
      height: timelineContainer.clientHeight - 90,
      width: timelineContainer.clientWidth - widthOffset,
    };
    
    console.log("📏 Timeline resize:", {
      isMobile,
      containerWidth: timelineContainer.clientWidth,
      newWidth: newDimensions.width,
      annotationPanelAccounted: !isMobile ? "272px subtracted via calc()" : "none"
    });
    
    timeline?.resize(newDimensions, { force: true });
  };

  useEffect(() => {
    const onResize = () => handleTimelineResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [timeline]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Navbar
        projectName={projectName}
        user={null}
        stateManager={stateManager}
        setProjectName={setProjectName}
      />
      <div className={`flex flex-1 ${isMobile ? 'flex-col pb-[60px]' : ''} relative`}>

        <div className={`${isMobile ? 'flex-1' : 'flex-1'}`}>
          <ResizablePanelGroup 
            style={{ 
              flex: 1,
              // On desktop, account for the annotation panel width
              width: isMobile ? '100%' : 'calc(100vw - 272px)'
            }} 
            direction="vertical"
          >
            <ResizablePanel 
              className="relative" 
              defaultSize={isMobile ? 65 : 70}
              minSize={isMobile ? 55 : 50}
            >
            <FloatingControl />
            <div className="flex h-full flex-1">
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <CropModal />
                <Scene 
                  stateManager={stateManager} 
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
              className={`${isMobile ? 'min-h-[200px]' : 'min-h-[50px]'}`}
            ref={timelinePanelRef}
              defaultSize={isMobile ? 35 : 30}
            onResize={handleTimelineResize}
              style={isMobile ? { height: '200px', minHeight: '200px', maxHeight: '200px' } : undefined}
          >
            {playerRef && <Timeline stateManager={stateManager} />}
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>

        {/* Mobile Bottom Tab - Fixed at screen bottom, isolated from timeline */}
        {isMobile && (
          <div 
            className="fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-border/50 safe-area-pb"
            style={{ 
              height: '60px',
              touchAction: 'manipulation', // Prevent gesture conflicts
              pointerEvents: 'auto' // Ensure touch events are handled here
            }}
          >
            <BottomTab />
          </div>
        )}

        {/* Control Panel - Desktop: Side panel, Mobile: Hidden by default */}
        {isMobile ? (
          // Mobile: Hidden annotation panel by default
          showRightPanel && (
            <>
              {/* Backdrop overlay with blur effect */}
              <div 
                className="fixed inset-0 z-35 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
                onClick={() => setShowRightPanel(false)}
              />
              
              {/* Annotation panel with solid background */}
              <div 
                className="absolute bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t-2 border-primary rounded-t-2xl shadow-xl transition-transform duration-300 ease-in-out"
                style={{ height: '80vh' }}
              >
                <MobileAnnotationPanel 
                  stateManager={stateManager} 
                  onClose={() => setShowRightPanel(false)}
                />
              </div>
            </>
          )
        ) : (
          // Desktop: Fixed side panel positioned at the right
          <div className="absolute top-0 right-0 h-full z-20">
            <ControlItem stateManager={stateManager} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Editor;
