export interface ThumbnailConfig {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  maxMemory?: number; // Maximum memory usage in MB
}

export interface ThumbnailResult {
  dataUrl: string;
  timestamp: number;
  width: number;
  height: number;
  size: number; // File size in bytes
}

export class MobileThumbnailGenerator {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isGenerating = false;
  
  constructor(private config: ThumbnailConfig = {}) {
    // Default config optimized for mobile
    this.config = {
      width: 160,
      height: 90,
      quality: 0.7,
      format: 'image/jpeg',
      maxMemory: 50, // 50MB limit for mobile
      ...config
    };
  }

  async generateThumbnail(
    videoSrc: string, 
    timestamp: number
  ): Promise<ThumbnailResult> {
    if (this.isGenerating) {
      throw new Error('Thumbnail generation already in progress');
    }

    this.isGenerating = true;
    
    try {
      // Check memory constraints
      await this.checkMemoryConstraints();
      
      // Create video element
      const video = await this.createVideoElement(videoSrc);
      
      // Seek to timestamp
      await this.seekToTimestamp(video, timestamp);
      
      // Generate thumbnail
      const thumbnail = await this.captureFrame(video);
      
      // Cleanup
      this.cleanup();
      
      return thumbnail;
      
    } catch (error) {
      this.cleanup();
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  async generateMultipleThumbnails(
    videoSrc: string,
    timestamps: number[]
  ): Promise<ThumbnailResult[]> {
    const results: ThumbnailResult[] = [];
    
    // Process in batches to avoid memory issues
    const batchSize = this.isMobile() ? 3 : 10;
    
    for (let i = 0; i < timestamps.length; i += batchSize) {
      const batch = timestamps.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(timestamp => this.generateThumbnail(videoSrc, timestamp))
      );
      
      results.push(...batchResults);
      
      // Add delay between batches on mobile to prevent memory issues
      if (this.isMobile() && i + batchSize < timestamps.length) {
        await this.delay(100);
      }
    }
    
    return results;
  }

  private async createVideoElement(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      // Mobile-specific optimizations
      if (this.isMobile()) {
        video.preload = 'metadata';
      }

      video.onloadedmetadata = () => {
        console.log('📹 Video metadata loaded for thumbnail generation');
        resolve(video);
      };

      video.onerror = (error) => {
        console.error('❌ Video load error:', error);
        reject(new Error('Failed to load video for thumbnail generation'));
      };

      video.src = src;
      video.load();
    });
  }

  private async seekToTimestamp(video: HTMLVideoElement, timestamp: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Seek timeout'));
      }, 5000);

      const onSeeked = () => {
        clearTimeout(timeoutId);
        video.removeEventListener('seeked', onSeeked);
        
        // Add small delay for mobile browsers to ensure frame is ready
        if (this.isMobile()) {
          setTimeout(resolve, 50);
        } else {
          resolve();
        }
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = timestamp;
    });
  }

  private async captureFrame(video: HTMLVideoElement): Promise<ThumbnailResult> {
    // Create canvas if not exists
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error('Failed to get 2D context for thumbnail generation');
      }
    }

    // Calculate dimensions maintaining aspect ratio
    const { width, height } = this.calculateDimensions(
      video.videoWidth,
      video.videoHeight
    );

    this.canvas.width = width;
    this.canvas.height = height;

    // Draw video frame to canvas
    this.ctx!.drawImage(video, 0, 0, width, height);

    // Convert to data URL
    const dataUrl = this.canvas.toDataURL(
      this.config.format,
      this.config.quality
    );

    // Calculate approximate size
    const size = Math.round((dataUrl.length * 3) / 4); // Base64 size estimation

    return {
      dataUrl,
      timestamp: video.currentTime,
      width,
      height,
      size
    };
  }

  private calculateDimensions(videoWidth: number, videoHeight: number) {
    const targetWidth = this.config.width!;
    const targetHeight = this.config.height!;
    
    const videoAspectRatio = videoWidth / videoHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    let width, height;

    if (videoAspectRatio > targetAspectRatio) {
      // Video is wider than target
      width = targetWidth;
      height = Math.round(targetWidth / videoAspectRatio);
    } else {
      // Video is taller than target
      height = targetHeight;
      width = Math.round(targetHeight * videoAspectRatio);
    }

    return { width, height };
  }

  private async checkMemoryConstraints(): Promise<void> {
    // Basic memory check for mobile devices
    if (this.isMobile()) {
      const maxMemoryMB = this.config.maxMemory!;
      
      // @ts-ignore - Check if performance.memory is available
      if (window.performance && window.performance.memory) {
        // @ts-ignore
        const usedMemoryMB = window.performance.memory.usedJSHeapSize / (1024 * 1024);
        
        if (usedMemoryMB > maxMemoryMB) {
          throw new Error(`Memory limit exceeded: ${usedMemoryMB.toFixed(1)}MB > ${maxMemoryMB}MB`);
        }
      }
    }
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    if (this.video) {
      this.video.remove();
      this.video = null;
    }
    
    if (this.canvas) {
      // Clear canvas to free memory
      this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {
    this.cleanup();
    this.canvas = null;
    this.ctx = null;
  }
}

// Factory function for easy usage
export function createMobileThumbnailGenerator(config?: ThumbnailConfig) {
  return new MobileThumbnailGenerator(config);
}

// Helper function for generating thumbnails at regular intervals
export async function generateTimelineThumbnails(
  videoSrc: string,
  duration: number,
  count: number = 10
): Promise<ThumbnailResult[]> {
  const generator = createMobileThumbnailGenerator();
  
  const timestamps = Array.from({ length: count }, (_, i) => 
    (duration / count) * i
  );
  
  try {
    return await generator.generateMultipleThumbnails(videoSrc, timestamps);
  } finally {
    generator.destroy();
  }
} 