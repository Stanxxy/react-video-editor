import {
  Control,
  Pattern,
  Video as VideoBase,
  VideoProps as VideoPropsBase,
  timeMsToUnits,
  unitsToTimeMs,
} from "@designcombo/timeline";
import { Filmstrip, FilmstripBacklogOptions } from "../types";
import ThumbnailCache from "../../utils/thumbnail-cache";
import { IDisplay, IMetadata, ITrim } from "@designcombo/types";
import {
  calculateOffscreenSegments,
  calculateThumbnailSegmentLayout,
} from "../../utils/filmstrip";
import { getFileFromUrl } from "../../utils/file";
import { type MP4Clip } from "@designcombo/frames";
import { createMediaControls } from "../controls";
import { generateVideoTimelineThumbnails, getThumbnailService } from "../../utils/thumbnail-service";

const EMPTY_FILMSTRIP: Filmstrip = {
  offset: 0,
  startTime: 0,
  thumbnailsCount: 0,
  widthOnScreen: 0,
};

interface VideoProps extends VideoPropsBase {
  aspectRatio: number;
  metadata: Partial<IMetadata> & {
    previewUrl: string;
  };
}
class Video extends VideoBase {
  static type = "Video";
  public clip?: MP4Clip | null;
  declare id: string;
  public resourceId: string = "";
  declare tScale: number;
  public isSelected = false;
  declare display: IDisplay;
  declare trim: ITrim;
  declare playbackRate: number;
  declare duration: number;
  public prevDuration: number;
  public itemType = "video";
  public metadata?: Partial<IMetadata>;
  declare src: string;

  public aspectRatio = 1;
  public scrollLeft = 0;
  public filmstripBacklogOptions?: FilmstripBacklogOptions;
  public thumbnailsPerSegment = 0;
  public segmentSize = 0;

  public offscreenSegments = 0;
  public thumbnailWidth: number = 0;
  public thumbnailHeight: number = 40;
  public thumbnailsList: { url: string; ts: number }[] = [];
  public isFetchingThumbnails = false;
  public thumbnailCache = new ThumbnailCache();
  private hasDefaultPattern = false;
  private isCreatingPattern = false;

  public currentFilmstrip: Filmstrip = EMPTY_FILMSTRIP;
  public nextFilmstrip: Filmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
  public loadingFilmstrip: Filmstrip = EMPTY_FILMSTRIP;

  private offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  private isDirty: boolean = true;

  private fallbackSegmentIndex: number = 0;
  private fallbackSegmentsCount: number = 0;
  private previewUrl: string = "";

  static createControls(): { controls: Record<string, Control> } {
    return { controls: createMediaControls() };
  }

  constructor(props: VideoProps) {
    super(props);
    this.id = props.id;
    this.tScale = props.tScale;
    this.objectCaching = false;
    this.rx = 4;
    this.ry = 4;
    this.display = props.display;
    this.trim = props.trim;
    this.duration = props.duration;
    this.prevDuration = props.duration;
    this.fill = "#27272a";
    this.borderOpacityWhenMoving = 1;
    this.metadata = props.metadata;

    this.aspectRatio = props.aspectRatio;

    this.src = props.src;
    this.strokeWidth = 0;

    this.transparentCorners = false;
    this.hasBorders = false;

    this.previewUrl = props.metadata?.previewUrl;
    this.initOffscreenCanvas();
    this.initialize();
  }

  private initOffscreenCanvas() {
    // Check if OffscreenCanvas is supported (mainly for mobile compatibility)
    if (typeof OffscreenCanvas !== 'undefined') {
      if (!this.offscreenCanvas) {
        this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
        this.offscreenCtx = this.offscreenCanvas.getContext("2d");
      }

      // Resize if dimensions changed
      if (
        this.offscreenCanvas.width !== this.width ||
        this.offscreenCanvas.height !== this.height
      ) {
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        this.isDirty = true;
      }
    } else {
      // Fallback for mobile browsers that don't support OffscreenCanvas
      console.log("📱 OffscreenCanvas not supported, using regular canvas");
      if (!this.offscreenCanvas) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = this.width;
        fallbackCanvas.height = this.height;
        this.offscreenCanvas = fallbackCanvas as any;
        this.offscreenCtx = fallbackCanvas.getContext("2d");
      }
    }
  }

  public initDimensions() {
    // Ensure we have valid dimensions before calculating
    if (!this.aspectRatio || this.aspectRatio <= 0 || !isFinite(this.aspectRatio)) {
      console.log("🔄 Invalid aspect ratio detected, setting default");
      this.setDefaultAspectRatio();
    }
    
    this.thumbnailWidth = this.thumbnailHeight * this.aspectRatio;
    
    // Validate thumbnail width
    if (!this.thumbnailWidth || this.thumbnailWidth <= 0 || !isFinite(this.thumbnailWidth)) {
      console.log("❌ Invalid thumbnailWidth calculated, using fallback");
      this.thumbnailWidth = 71; // Default for 16:9 at 40px height
      this.aspectRatio = this.thumbnailWidth / this.thumbnailHeight;
    }

    console.log("📐 Dimensions initialized:", {
      aspectRatio: this.aspectRatio,
      thumbnailWidth: this.thumbnailWidth,
      thumbnailHeight: this.thumbnailHeight
    });

    const segmentOptions = calculateThumbnailSegmentLayout(this.thumbnailWidth);
    this.thumbnailsPerSegment = segmentOptions.thumbnailsPerSegment;
    this.segmentSize = segmentOptions.segmentSize;
    
    console.log("📊 Segment options calculated:", {
      thumbnailsPerSegment: this.thumbnailsPerSegment,
      segmentSize: this.segmentSize
    });
  }

  public async initialize() {
    this.previewUrl = (this.metadata as any)?.previewUrl || "";
    this.initOffscreenCanvas();
    this.initDimensions();
    
    // Load fallback thumbnail first
    await this.loadFallbackThumbnail();
    
    // Create fallback pattern
    this.createFallbackPattern();
    
    // Then prepare assets (which may or may not create MP4Clip)
    await this.prepareAssets();
    
    // Ensure we have a fallback pattern even if MP4Clip fails
    if (!this.thumbnailCache.getThumbnail("fallback")) {
      console.log("🔄 No fallback thumbnail after initialization, creating default pattern");
      this.createDefaultPattern();
    }
    
    // Initialize scroll position
    this.onScrollChange({ scrollLeft: 0 });
  }

  public async prepareAssets() {
    if (typeof window === "undefined") return;

    console.log("🎬 Video.prepareAssets() - Starting asset preparation for:", this.src);
    console.log("📊 Metadata available:", this.metadata);

    // Check if we're on mobile and potentially skip MP4Clip for performance
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log("📱 Mobile device detected, using optimized thumbnail approach");
      // On mobile, we'll still create a basic clip for playback but skip heavy thumbnail processing
      // This ensures the video can be played even if thumbnails aren't generated
    }

    // Check if OPFS is supported before trying to use MP4Clip
    const isOPFSSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
    if (!isOPFSSupported) {
      console.log("⚠️ OPFS not supported, skipping MP4Clip thumbnail generation");
      return;
    }

    try {
      const { MP4Clip } = await import("@designcombo/frames");
      console.log("✅ MP4Clip imported successfully");
      
      let stream: ReadableStream<Uint8Array>;
      
      // Check if we have the original file in metadata
      const metadataWithFile = this.metadata as any;
      if (metadataWithFile?.originalFile instanceof File) {
        console.log("📁 Using original file from metadata:", metadataWithFile.originalFile.name);
        stream = metadataWithFile.originalFile.stream();
      } else {
        console.log("🌐 Fetching file from URL:", this.src);
      const file = await getFileFromUrl(this.src);
        console.log("✅ File fetched successfully:", file.name, file.size, "bytes");
        stream = file.stream();
      }
      
      console.log("✅ Stream created successfully");
      
      this.clip = new MP4Clip(stream);
      console.log("✅ MP4Clip created successfully:", this.clip);
      
    } catch (error) {
      console.error("❌ Error loading MP4Clip:", error);
      console.error("Error details:", {
        src: this.src,
        metadata: this.metadata,
        error: error.message,
        stack: error.stack
      });
    }
  }

  private calculateFilmstripDimensions({
    segmentIndex,
    widthOnScreen,
  }: {
    segmentIndex: number;
    widthOnScreen: number;
  }) {
    const filmstripOffset = segmentIndex * this.segmentSize;
    const shouldUseLeftBacklog = segmentIndex > 0;
    const leftBacklogSize = shouldUseLeftBacklog ? this.segmentSize : 0;

    const totalWidth = timeMsToUnits(
      this.duration,
      this.tScale,
      this.playbackRate,
    );

    const rightRemainingSize =
      totalWidth - widthOnScreen - leftBacklogSize - filmstripOffset;
    const rightBacklogSize = Math.min(this.segmentSize, rightRemainingSize);

    const filmstripStartTime = unitsToTimeMs(filmstripOffset, this.tScale);
    const filmstrimpThumbnailsCount =
      1 +
      Math.round(
        (widthOnScreen + leftBacklogSize + rightBacklogSize) /
          this.thumbnailWidth,
      );

    return {
      filmstripOffset,
      leftBacklogSize,
      rightBacklogSize,
      filmstripStartTime,
      filmstrimpThumbnailsCount,
    };
  }

  // load fallback thumbnail, resize it and cache it
  private async loadFallbackThumbnail() {
    const fallbackThumbnail = this.previewUrl;
    console.log("🖼️  loadFallbackThumbnail() called with previewUrl:", fallbackThumbnail ? "URL provided" : "No URL");
    
    if (!fallbackThumbnail) {
      console.log("❌ No fallback thumbnail URL provided");
      // Set default aspect ratio if no thumbnail
      this.aspectRatio = 16/9; // Default video aspect ratio
      this.thumbnailWidth = this.thumbnailHeight * this.aspectRatio;
      return;
    }

    // Validate the data URL format
    if (fallbackThumbnail.startsWith('data:image/')) {
      console.log("✅ Valid data URL format detected");
    } else {
      console.log("⚠️ Invalid data URL format, using default aspect ratio");
      this.setDefaultAspectRatio();
      return;
    }

    return new Promise<void>((resolve) => {
      const img = new Image();
      
      // For mobile compatibility, we don't set crossOrigin for blob URLs
      if (!fallbackThumbnail.startsWith('blob:')) {
        img.crossOrigin = "anonymous";
      }
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      img.onload = () => {
        console.log("✅ Fallback thumbnail loaded successfully:", img.width, "x", img.height);
        
        try {
          // Calculate aspect ratio and dimensions
          const aspectRatio = img.width / img.height;
          const targetHeight = 40;
          const targetWidth = Math.round(targetHeight * aspectRatio);
          
          console.log("🎨 Resizing thumbnail to:", targetWidth, "x", targetHeight);
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error("❌ Failed to get canvas context");
            this.setDefaultAspectRatio();
            resolve();
            return;
          }
          
          canvas.height = targetHeight;
          canvas.width = targetWidth;
          
          // Draw and resize image
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Create final image
          const resizedImg = new Image();
          
          resizedImg.onload = () => {
            // Update aspect ratio and cache the resized image
            this.aspectRatio = aspectRatio;
            this.thumbnailWidth = targetWidth;
            this.thumbnailCache.setThumbnail("fallback", resizedImg);
            
            console.log("✅ Fallback thumbnail cached successfully with aspectRatio:", aspectRatio, "thumbnailWidth:", targetWidth);
            resolve();
          };
          
          resizedImg.onerror = () => {
            console.warn("⚠️ Failed to load resized image, using default");
            this.setDefaultAspectRatio();
            resolve();
          };
          
          // Use lower quality on mobile to improve performance and avoid base64 corruption
          const quality = isMobile ? 0.5 : 0.7;
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Validate data URL before using it
          if (dataUrl && dataUrl.startsWith('data:image/jpeg;base64,')) {
            resizedImg.src = dataUrl;
          } else {
            console.warn("⚠️ Invalid data URL generated, using default");
            this.setDefaultAspectRatio();
            resolve();
          }
          
        } catch (error) {
          console.warn("⚠️ Error processing thumbnail, using default:", error);
          this.setDefaultAspectRatio();
          resolve();
        }
      };
      
      img.onerror = (error) => {
        console.warn("⚠️ Fallback thumbnail failed to load, using default aspect ratio");
        this.setDefaultAspectRatio();
        resolve();
      };
      
      // Add timestamp to prevent caching issues, but not for blob URLs
      if (fallbackThumbnail.startsWith('blob:')) {
        img.src = fallbackThumbnail;
      } else {
        img.src = fallbackThumbnail + (fallbackThumbnail.includes('?') ? '&' : '?') + "t=" + Date.now();
      }
      
      console.log("📥 Loading fallback thumbnail from:", img.src);
    });
  }

  private setDefaultAspectRatio() {
    console.log("🔄 Setting default aspect ratio");
    // Use metadata if available, otherwise default to 16:9
    const metadataWithSize = this.metadata as any;
    if (metadataWithSize && typeof metadataWithSize.width === 'number' && typeof metadataWithSize.height === 'number') {
      this.aspectRatio = metadataWithSize.width / metadataWithSize.height;
    } else {
      this.aspectRatio = 16/9; // Default video aspect ratio
    }
    this.thumbnailWidth = this.thumbnailHeight * this.aspectRatio;
    console.log("✅ Default aspect ratio set:", this.aspectRatio, "thumbnailWidth:", this.thumbnailWidth);
  }

  private generateTimestamps(startTime: number, count: number): number[] {
    // Validate inputs
    if (!isFinite(startTime) || !isFinite(count) || count <= 0 || !this.thumbnailWidth || !isFinite(this.thumbnailWidth)) {
      console.log("⚠️  Invalid parameters for timestamp generation:", {
        startTime,
        count,
        thumbnailWidth: this.thumbnailWidth
      });
      return [];
    }

    const timePerThumbnail = unitsToTimeMs(
      this.thumbnailWidth,
      this.tScale,
      this.playbackRate,
    );

    if (!isFinite(timePerThumbnail) || timePerThumbnail <= 0) {
      console.log("⚠️  Invalid timePerThumbnail calculated:", timePerThumbnail);
      return [];
    }

    const timestamps = Array.from({ length: count }, (_, i) => {
      const timeInFilmstripe = startTime + i * timePerThumbnail;
      return Math.ceil(timeInFilmstripe / 1000);
    });

    console.log("⏰ Generated", timestamps.length, "timestamps from", startTime, "count", count);
    return timestamps;
  }

  private createFallbackPattern() {
    const canvas = this.canvas;
    
    if (!canvas || this.isCreatingPattern || this.hasDefaultPattern) {
      return;
    }

    this.isCreatingPattern = true;

    const canvasWidth = this.canvas!.width;
    const maxPatternSize = 12000;
    const fallbackSource = this.thumbnailCache.getThumbnail("fallback");

    if (!fallbackSource) {
      this.createDefaultPattern();
      return;
    }

    // Compute the total width and number of segments needed
    const totalWidthNeeded = Math.min(canvasWidth * 20, maxPatternSize);
    const segmentsRequired = Math.ceil(totalWidthNeeded / this.segmentSize);
    this.fallbackSegmentsCount = segmentsRequired;
    const patternWidth = segmentsRequired * this.segmentSize;

    console.log("📐 Pattern dimensions:", {
      totalWidthNeeded,
      segmentsRequired,
      patternWidth,
      segmentSize: this.segmentSize
    });

    // Setup canvas dimensions
    const offCanvas = document.createElement("canvas");
    offCanvas.height = this.thumbnailHeight;
    offCanvas.width = patternWidth;

    const context = offCanvas.getContext("2d")!;
    const thumbnailsTotal = segmentsRequired * this.thumbnailsPerSegment;

    console.log("🖼️  Drawing", thumbnailsTotal, "thumbnails to pattern");

    // Draw the fallback image across the entirety of the canvas horizontally
    for (let i = 0; i < thumbnailsTotal; i++) {
      const x = i * this.thumbnailWidth;
      context.drawImage(
        fallbackSource,
        x,
        0,
        this.thumbnailWidth,
        this.thumbnailHeight,
      );
    }

    // Create the pattern and apply it
    const fillPattern = new Pattern({
      source: offCanvas,
      repeat: "no-repeat",
      offsetX: 0,
    });

    this.set("fill", fillPattern);
    this.canvas?.requestRenderAll();
    this.hasDefaultPattern = true;
    this.isCreatingPattern = false;
  }

  private createDefaultPattern() {
    if (this.hasDefaultPattern) return;
    
    // Create a simple colored rectangle pattern as fallback
    const offCanvas = document.createElement("canvas");
    offCanvas.height = this.thumbnailHeight;
    offCanvas.width = this.thumbnailWidth || 100; // Use default width if not set
    
    const context = offCanvas.getContext("2d")!;
    
    // Fill with a gradient pattern
    const gradient = context.createLinearGradient(0, 0, offCanvas.width, 0);
    gradient.addColorStop(0, "#3b82f6");
    gradient.addColorStop(0.5, "#8b5cf6");
    gradient.addColorStop(1, "#3b82f6");
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, offCanvas.width, offCanvas.height);
    
    // Add some text
    context.fillStyle = "white";
    context.font = "12px Arial";
    context.textAlign = "center";
    context.fillText("VIDEO", offCanvas.width / 2, offCanvas.height / 2 + 4);
    
    // Create the pattern and apply it
    const fillPattern = new Pattern({
      source: offCanvas,
      repeat: "no-repeat",
      offsetX: 0,
    });
    
    this.set("fill", fillPattern);
    this.canvas?.requestRenderAll();
    this.hasDefaultPattern = true;
    this.isCreatingPattern = false;
  }
  public async loadAndRenderThumbnails() {
    if (this.isFetchingThumbnails) {
      return;
    }
    
    // If no clip is available (e.g., on mobile), try the new thumbnail service
    if (!this.clip) {
      console.log("📱 No MP4Clip available, attempting thumbnail service generation");
      await this.tryThumbnailService();
      return;
    }
    
    // set segmentDrawn to segmentToDraw
    this.loadingFilmstrip = { ...this.nextFilmstrip };
    this.isFetchingThumbnails = true;

    // Calculate dimensions and offsets
    const { startTime, thumbnailsCount } = this.loadingFilmstrip;

    // Generate required timestamps
    const timestamps = this.generateTimestamps(startTime, thumbnailsCount);

    try {
      // Match and prepare thumbnails
      let thumbnailsArr = await this.clip.thumbnailsList(this.thumbnailWidth, {
        timestamps: timestamps.map((timestamp) => timestamp * 1e6),
      });

      const updatedThumbnails = thumbnailsArr.map((thumbnail) => {
        return {
          ts: Math.round(thumbnail.ts / 1e6),
          img: thumbnail.img,
        };
      });

      // Load all thumbnails in parallel
      await this.loadThumbnailBatch(updatedThumbnails);

      this.isDirty = true; // Mark as dirty after preparing new thumbnails
      this.isFetchingThumbnails = false;

      // Update currentFilmstrip with the successfully loaded filmstrip
      this.currentFilmstrip = { ...this.loadingFilmstrip };

      requestAnimationFrame(() => {
        this.canvas?.requestRenderAll();
      });
        } catch (error) {
      console.warn("⚠️ Error in loadAndRenderThumbnails, using fallback:", error);
      this.isFetchingThumbnails = false;

      // On error, still try to create a fallback pattern
      this.createFallbackPattern();
      this.isDirty = true;
      this.canvas?.requestRenderAll();
    }
  }

  private async tryThumbnailService() {
    try {
      const { startTime, thumbnailsCount } = this.nextFilmstrip;
      
      if (!thumbnailsCount || thumbnailsCount <= 0) {
        this.createFallbackPattern();
        return;
      }

      // Generate timestamps for the current filmstrip segment
      const timestamps = this.generateTimestamps(startTime, thumbnailsCount);
      
      if (timestamps.length === 0) {
        this.createFallbackPattern();
        return;
      }

      console.log("🎬 Requesting thumbnails via thumbnail service:", {
        src: this.src,
        timestamps: timestamps.length,
        startTime,
        thumbnailsCount
      });

      // Use the thumbnail service to generate thumbnails
      const thumbnailResults = await generateVideoTimelineThumbnails(
        this.src,
        this.duration / 1000, // Convert to seconds
        timestamps.length,
        {
          thumbnailWidth: this.thumbnailWidth,
          thumbnailHeight: this.thumbnailHeight,
          serverEndpoint: '/api/thumbnails', // Will fallback to canvas if server unavailable
          fallbackToCanvas: true,
          enableCaching: true
        }
      );

      if (thumbnailResults.length > 0) {
        console.log("✅ Thumbnail service generated", thumbnailResults.length, "thumbnails");
        
        // Convert thumbnail service results to the format expected by our cache
        const convertedThumbnails = thumbnailResults.map((result, index) => ({
          ts: timestamps[index] || result.timestamp,
          dataUrl: result.dataUrl
        }));

        await this.loadThumbnailServiceBatch(convertedThumbnails);
        
        // Update filmstrip state
        this.currentFilmstrip = { ...this.nextFilmstrip };
        this.isDirty = true;
        this.canvas?.requestRenderAll();
        
        console.log("✅ Thumbnail service thumbnails loaded successfully");
      } else {
        throw new Error("No thumbnails generated by service");
      }
      
    } catch (error) {
      console.warn("⚠️ Thumbnail service failed, falling back to pattern:", error);
      this.createFallbackPattern();
      this.isDirty = true;
      this.canvas?.requestRenderAll();
    }
  }

  private async loadThumbnailServiceBatch(thumbnails: { ts: number; dataUrl: string }[]) {
    const loadPromises = thumbnails.map(async (thumbnail) => {
      if (this.thumbnailCache.getThumbnail(thumbnail.ts)) return;

      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.thumbnailCache.setThumbnail(thumbnail.ts, img);
          resolve();
        };
        img.onerror = () => {
          console.warn("Failed to load thumbnail from data URL");
          reject();
        };
        img.src = thumbnail.dataUrl;
      });
    });

    await Promise.allSettled(loadPromises); // Use allSettled to continue even if some fail
  }

  private async loadThumbnailBatch(thumbnails: { ts: number; img: Blob }[]) {
    const loadPromises = thumbnails.map(async (thumbnail) => {
      if (this.thumbnailCache.getThumbnail(thumbnail.ts)) return;

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(thumbnail.img);
        img.onload = () => {
          URL.revokeObjectURL(img.src); // Clean up the blob URL after image loads
          this.thumbnailCache.setThumbnail(thumbnail.ts, img);
          resolve();
        };
      });
    });

    await Promise.all(loadPromises);
  }

  public _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);

    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);

    // Clip the area to prevent drawing outside
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    this.renderToOffscreen();

    ctx.drawImage(this.offscreenCanvas!, 0, 0);

    ctx.restore();
    // this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
  }

  public setDuration(duration: number) {
    this.duration = duration;
    this.prevDuration = duration;
  }

  public async setSrc(src: string) {
    super.setSrc(src);
    this.clip = null;
    await this.initialize();
    await this.prepareAssets();
    this.thumbnailCache.clearCacheButFallback();
    this.onScale();
  }
  public onResizeSnap() {
    this.renderToOffscreen(true);
  }
  public onResize() {
    this.renderToOffscreen(true);
  }

  public renderToOffscreen(force?: boolean) {
    if (!this.offscreenCtx) {
      return;
    }
    
    if (!this.isDirty && !force) {
      return;
    }

    // Check if filmstrip is valid
    if (!this.currentFilmstrip.thumbnailsCount || this.currentFilmstrip.thumbnailsCount <= 0) {
      if (!this.hasDefaultPattern && !this.isCreatingPattern) {
        this.createFallbackPattern();
      }
      return;
    }

    // Ensure we have a fallback thumbnail before rendering
    if (!this.thumbnailCache.getThumbnail("fallback") && !this.hasDefaultPattern) {
      this.loadFallbackThumbnail().then(() => {
        // Retry rendering after fallback thumbnail is loaded
        this.renderToOffscreen(force);
      });
      return;
    }

    this.offscreenCanvas!.width = this.width;
    const ctx = this.offscreenCtx;
    const { startTime, offset, thumbnailsCount } = this.currentFilmstrip;
    const thumbnailWidth = this.thumbnailWidth;
    const thumbnailHeight = this.thumbnailHeight;

    // Calculate the offset caused by the trimming
    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    let timeInFilmstripe = startTime;
    const timePerThumbnail = unitsToTimeMs(
      thumbnailWidth,
      this.tScale,
      this.playbackRate,
    );

    // Clear the offscreen canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // Clip with rounded corners
    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, this.rx);
    ctx.clip();
    
    let renderedCount = 0;
    let fallbackCount = 0;
    
    // Draw thumbnails
    for (let i = 0; i < thumbnailsCount; i++) {
      const timestamp = Math.ceil(timeInFilmstripe / 1000);
      let img = this.thumbnailCache.getThumbnail(timestamp);

      if (!img) {
        img = this.thumbnailCache.getThumbnail("fallback");
        if (img) fallbackCount++;
      } else {
        renderedCount++;
      }

      if (img && img.complete) {
        const xPosition = i * thumbnailWidth + offset - trimFromSize;
        ctx.drawImage(img, xPosition, 0, thumbnailWidth, thumbnailHeight);
        timeInFilmstripe += timePerThumbnail;
      }
    }

    // Thumbnails rendered successfully

    this.isDirty = false;
  }

  public drawTextIdentity(ctx: CanvasRenderingContext2D) {
    const iconPath = new Path2D(
      "M16.5625 0.925L12.5 3.275V0.625L11.875 0H0.625L0 0.625V9.375L0.625 10H11.875L12.5 9.375V6.875L16.5625 9.2125L17.5 8.625V1.475L16.5625 0.925ZM11.25 8.75H1.25V1.25H11.25V8.75ZM16.25 7.5L12.5 5.375V4.725L16.25 2.5V7.5Z",
    );
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.translate(0, 14);
    ctx.font = "600 12px 'Geist variable'";
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "left";
    ctx.clip();
    ctx.fillText("Video", 36, 10);

    ctx.translate(8, 1);

    ctx.fillStyle = "#f4f4f5";
    ctx.fill(iconPath);
    ctx.restore();
  }

  public setSelected(selected: boolean) {
    this.isSelected = selected;
    this.set({ dirty: true });
  }

  public updateSelected(ctx: CanvasRenderingContext2D) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255,1.0)"
      : "rgba(255, 255, 255,0.1)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6,
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }

  public calulateWidthOnScreen() {
    const canvasEl = document.getElementById("designcombo-timeline-canvas");
    const canvasWidth = canvasEl?.clientWidth;
    const scrollLeft = this.scrollLeft;
    const timelineWidth = canvasWidth!;
    const cutFromBottomEdge = Math.max(
      timelineWidth - (this.width + this.left + scrollLeft),
      0,
    );
    const visibleHeight = Math.min(
      timelineWidth - this.left - scrollLeft,
      timelineWidth,
    );

    return Math.max(visibleHeight - cutFromBottomEdge, 0);
  }

  // Calculate the width that is not visible on the screen measured from the left
  public calculateOffscreenWidth({ scrollLeft }: { scrollLeft: number }) {
    const offscreenWidth = Math.min(this.left + scrollLeft, 0);

    return Math.abs(offscreenWidth);
  }

  public onScrollChange({
    scrollLeft,
    force,
  }: {
    scrollLeft: number;
    force?: boolean;
  }) {
    const offscreenWidth = this.calculateOffscreenWidth({ scrollLeft });
    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    const offscreenSegments = calculateOffscreenSegments(
      offscreenWidth,
      trimFromSize,
      this.segmentSize,
    );

    this.offscreenSegments = offscreenSegments;

    // calculate start segment to draw
    const segmentToDraw = offscreenSegments;

    if (this.currentFilmstrip.segmentIndex === segmentToDraw) {
      return false;
    }

    if (segmentToDraw !== this.fallbackSegmentIndex) {
      const fillPattern = this.fill as Pattern;
      if (fillPattern instanceof Pattern) {
        fillPattern.offsetX =
          this.segmentSize *
          (segmentToDraw - Math.floor(this.fallbackSegmentsCount / 2));
      }

      this.fallbackSegmentIndex = segmentToDraw;
    }
    if (!this.isFetchingThumbnails || force) {
      this.scrollLeft = scrollLeft;
      const widthOnScreen = this.calulateWidthOnScreen();
      // With these lines:
      const { filmstripOffset, filmstripStartTime, filmstrimpThumbnailsCount } =
        this.calculateFilmstripDimensions({
          widthOnScreen: this.calulateWidthOnScreen(),
          segmentIndex: segmentToDraw,
        });

      this.nextFilmstrip = {
        segmentIndex: segmentToDraw,
        offset: filmstripOffset,
        startTime: filmstripStartTime,
        thumbnailsCount: filmstrimpThumbnailsCount,
        widthOnScreen,
      };

      this.loadAndRenderThumbnails();
    }
  }
  public onScale() {
    console.log("🔄 onScale() called - resetting thumbnail state, current tScale:", this.tScale);
    
    // Reset all filmstrip state
    this.currentFilmstrip = { ...EMPTY_FILMSTRIP };
    this.nextFilmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
    this.loadingFilmstrip = { ...EMPTY_FILMSTRIP };
    
    // Important: Reset the fetching flag to allow immediate thumbnail reload
    this.isFetchingThumbnails = false;
    
    // Mark as dirty to force re-render
    this.isDirty = true;
    
    // Add a small delay to ensure the canvas and timeline have processed the scale change
    setTimeout(() => {
      console.log("🔄 Executing delayed onScrollChange after scale reset, tScale:", this.tScale);
      // Force scroll change with immediate effect
      this.onScrollChange({ scrollLeft: this.scrollLeft, force: true });
    }, 50);
  }
}

export default Video;
