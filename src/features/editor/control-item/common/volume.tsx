import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";

const Volume = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const isMuted = value === 0;

  const handleToggleMute = () => {
    if (isMuted) {
      // Unmute - set to 100%
      onChange(100);
    } else {
      // Mute - set to 0%
      onChange(0);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <div className="flex flex-1 items-center text-sm text-muted-foreground">
        Volume
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleMute}
        className="w-20 h-8 flex items-center gap-2"
      >
        {isMuted ? (
          <>
            <VolumeX size={14} />
            <span className="text-xs">Muted</span>
          </>
        ) : (
          <>
            <Volume2 size={14} />
            <span className="text-xs">On</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default Volume;
