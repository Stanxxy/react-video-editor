import React from "react";
import {
  IAudio,
  ICaption,
  IImage,
  IText,
  ITrackItem,
  ITrackItemAndDetails,
  IVideo,
} from "@designcombo/types";
import { useEffect, useState } from "react";
import BasicText from "./basic-text";
import BasicImage from "./basic-image";
import BasicVideo from "./basic-video";
import BasicAudio from "./basic-audio";
import useStore from "../store/use-store";
import useLayoutStore from "../store/use-layout-store";
import BasicCaption from "./basic-caption";
import { LassoSelect } from "lucide-react";
import StateManager from "@designcombo/state";

export const ControlItem = ({ stateManager }: { stateManager: StateManager }) => {
  const { activeIds, trackItemsMap, trackItemDetailsMap, transitionsMap } =
    useStore();
  const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
  const { setTrackItem: setLayoutTrackItem } = useLayoutStore();

  useEffect(() => {
    if (activeIds.length === 1) {
      const [id] = activeIds;
      const trackItemDetails = trackItemDetailsMap[id];
      const trackItem = {
        ...trackItemsMap[id],
        details: trackItemDetails?.details || {},
      };
      if (trackItemDetails) {
        setTrackItem(trackItem);
        setLayoutTrackItem(trackItem);
      } else console.log(transitionsMap[id]);
    } else {
      setTrackItem(null);
      setLayoutTrackItem(null);
    }
  }, [activeIds, trackItemsMap]);

  const renderActiveControlItem = () => {
  if (!trackItem) {
    console.log("No item selected");
    return (
      <div className="mb-32 flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <LassoSelect />
        <span className="text-zinc-500">No item selected</span>
      </div>
    );
  }

    switch (trackItem.type) {
      case "text":
        return <BasicText trackItem={trackItem as ITrackItem & IText} />;
      case "caption":
        return <BasicCaption trackItem={trackItem as ITrackItem & ICaption} />;
      case "image":
        return <BasicImage trackItem={trackItem as ITrackItem & IImage} />;
      case "video":
        return <BasicVideo trackItem={trackItem as ITrackItem & IVideo} stateManager={stateManager} />;
      case "audio":
        return <BasicAudio trackItem={trackItem as ITrackItem & IAudio} />;
      default:
  return (
          <div className="mb-32 flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <LassoSelect />
            <span className="text-zinc-500">Unsupported item type</span>
          </div>
  );
    }
};

  return (
    <div className="flex w-[272px] flex-none border-l border-border/80 bg-sidebar">
      {renderActiveControlItem()}
    </div>
  );
};
