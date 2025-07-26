import { ISize } from "@designcombo/types";
import { OnPinch } from "@interactify/infinite-viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import InfiniteViewer from "@interactify/infinite-viewer";
import useStore from "../store/use-store";

function useZoom(
  containerRef: React.RefObject<HTMLDivElement>,
  viewerRef: React.RefObject<InfiniteViewer>,
  size: ISize,
) {
  const [zoom, setZoom] = useState(0.01);
  const currentZoomRef = useRef(0.01);
  const { trackItemsMap } = useStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !size?.width || !size?.height) return;

    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    
    // Check if we have video items and use their dimensions for zoom calculation
    const videoItems = Object.values(trackItemsMap).filter(item => item.type === 'video');
    let targetWidth = size.width;
    let targetHeight = size.height;
    
    if (videoItems.length > 0) {
      // Use the first video's dimensions for zoom calculation
      const firstVideo = videoItems[0];
      const videoDetails = firstVideo.details as any;
      if (videoDetails.width && videoDetails.height) {
        targetWidth = videoDetails.width;
        targetHeight = videoDetails.height;
        console.log("🎬 Using video dimensions for zoom:", { targetWidth, targetHeight });
      }
    }

    // Ensure valid dimensions before calculating zoom
    if (containerWidth <= 0 || containerHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
      return;
    }

    const desiredZoom = Math.min(
      containerWidth / targetWidth,
      containerHeight / targetHeight,
    );
    
    console.log("🔍 Zoom recalculated:", {
      size,
      targetDimensions: { targetWidth, targetHeight },
      containerWidth,
      containerHeight,
      desiredZoom,
      validDimensions: containerWidth > 0 && containerHeight > 0 && targetWidth > 0 && targetHeight > 0
    });

    // Only update zoom if we have valid dimensions
    if (desiredZoom > 0 && isFinite(desiredZoom)) {
      currentZoomRef.current = desiredZoom;
      setZoom(desiredZoom);
    } else {
      console.warn("⚠️ Invalid zoom calculated, keeping current zoom");
    }
    
    // Center the viewer after zoom change
    setTimeout(() => {
      viewerRef.current?.infiniteViewer.scrollCenter();
    }, 100);
  }, [size, containerRef, viewerRef, trackItemsMap]);

  const handlePinch = useCallback((e: OnPinch) => {
    const deltaY = (e as any).inputEvent.deltaY;
    const changer = deltaY > 0 ? 0.0085 : -0.0085;
    const currentZoom = currentZoomRef.current;
    const newZoom = currentZoom + changer;
    if (newZoom >= 0.001 && newZoom <= 10) {
      currentZoomRef.current = newZoom;
      setZoom(newZoom);
    }
  }, []);

  return { zoom, handlePinch };
}

export default useZoom;
