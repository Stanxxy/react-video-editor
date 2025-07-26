import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, XIcon, FileText, Download } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { download } from "@/utils/download";

const DownloadProgressModal = () => {
  const { progress, displayProgressModal, output, actions, exportType, error } =
    useDownloadState();
  const isCompleted = progress === 100;
  const isJsonExport = exportType === "json";
  const isExcelExport = exportType === "excel";
  const hasError = !!error;

  const handleDownload = async () => {
    if (output?.url) {
      if (isJsonExport || isExcelExport) {
        // For JSON and Excel exports, the file was already downloaded automatically
        // This button just serves as confirmation/acknowledgment
        actions.setDisplayProgressModal(false);
      }
    }
  };

  return (
    <Dialog
      open={displayProgressModal}
      onOpenChange={actions.setDisplayProgressModal}
    >
      <DialogContent className="flex h-[627px] flex-col gap-0 bg-background p-0 sm:max-w-[844px]">
        <DialogTitle className="hidden" />
        <DialogDescription className="hidden" />
        <XIcon
          onClick={() => actions.setDisplayProgressModal(false)}
          className="absolute right-4 top-5 h-5 w-5 text-zinc-400 hover:cursor-pointer hover:text-zinc-500"
        />
        <div className="flex h-16 items-center border-b px-4 font-medium">
          {isJsonExport ? "Export JSON" : isExcelExport ? "Export Excel" : "Download"}
        </div>
        {hasError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
            <div className="flex flex-col items-center space-y-1 text-center">
              <div className="font-semibold">
                <XIcon className="h-12 w-12 text-red-500" />
              </div>
              <div className="font-bold text-red-400">
                Export Failed
              </div>
              <div className="text-muted-foreground max-w-sm text-sm">
                {error}
              </div>
            </div>
            <Button 
              onClick={() => {
                actions.setError(undefined);
                actions.setDisplayProgressModal(false);
              }}
              variant="outline"
            >
              Close
            </Button>
          </div>
        ) : isCompleted ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
            <div className="flex flex-col items-center space-y-1 text-center">
              <div className="font-semibold">
                {isJsonExport || isExcelExport ? (
                  <FileText className="h-12 w-12 text-green-500" />
                ) : (
                <CircleCheckIcon />
                )}
              </div>
              <div className="font-bold">
                {isJsonExport ? "JSON Exported" : isExcelExport ? "Excel Exported" : "Exported"}
              </div>
              <div className="text-muted-foreground">
                {isJsonExport ? (
                  <>
                    Your annotations have been downloaded as a JSON file.<br />
                    Check your Downloads folder for the exported file.
                  </>
                ) : isExcelExport ? (
                  <>
                    Your annotations have been downloaded as a CSV file.<br />
                    Open it with Excel or any spreadsheet application for analysis.
                  </>
                ) : (
                  "You can download the file to your device."
                )}
              </div>
            </div>
            <Button onClick={handleDownload}>
              {isJsonExport || isExcelExport ? (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Close
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="text-5xl font-semibold">
              {Math.floor(progress)}%
            </div>
            <div className="font-bold">
              {isJsonExport ? "Exporting JSON..." : isExcelExport ? "Exporting Excel..." : "Exporting..."}
            </div>
            <div className="text-center text-zinc-500">
              {isJsonExport ? (
                <>
                  <div>Preparing your annotation data for JSON export.</div>
                  <div>This will only take a moment.</div>
                </>
              ) : isExcelExport ? (
                <>
                  <div>Preparing your annotation data for Excel export.</div>
                  <div>This will only take a moment.</div>
                </>
              ) : (
                <>
                  <div>Processing your export request.</div>
                  <div>Please wait...</div>
                </>
              )}
            </div>
            <Button variant={"outline"}>Cancel</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DownloadProgressModal;
