import { useState } from "react";
import { DroppableArea } from "./droppable";
import { useScreenSize } from "../../../utils/mobile";

const SceneBoard = ({
  size,
  children,
}: {
  size: { width: number; height: number };
  children: React.ReactNode;
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'mobile';

  // Don't render if size is invalid
  if (!size?.width || !size?.height) {
    return <div className="w-full h-full bg-sidebar" />;
  }

  // Keep consistent sizing for proper video rendering
  const boardStyle = {
    width: size.width,
    height: size.height,
  };

  const overlayStyle = {
    width: size.width,
    height: size.height,
  };

  return (
    <DroppableArea
      id="artboard"
      onDragStateChange={setIsDraggingOver}
      style={boardStyle}
      className="pointer-events-auto"
    >
      <div
        style={overlayStyle}
        className={`pointer-events-none absolute z-50 border border-white/15 transition-colors duration-200 ease-in-out ${isDraggingOver ? "border-4 border-dashed border-white bg-white/[0.075]" : "bg-transparent"} ${isMobile ? '' : 'shadow-[0_0_0_5000px_#121213]'}`}
      />
      {children}
    </DroppableArea>
  );
};

export default SceneBoard;
