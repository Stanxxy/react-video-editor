import { createMobileThumbnailGenerator, ThumbnailResult } from './mobile-thumbnail';

export interface ThumbnailRequest {
  videoUrl: string;
  timestamps: number[]; // Array of timestamps in seconds
  width?: number;
  height?: number;
  quality?: number;
}

export interface ServerThumbnailResponse {
  success: boolean;
  thumbnails: {
    timestamp: number;
    url: string;
    width: number;
    height: number;
  }[];
  error?: string;
}

export interface ThumbnailServiceConfig {
  serverEndpoint?: string;
  fallbackToCanvas: boolean;
  enableCaching: boolean;
  maxCacheSize: number; // Maximum number of cached thumbnails
  thumbnailWidth: number;
  thumbnailHeight: number;
  quality: number;
}

export class ThumbnailService {
  private config: ThumbnailServiceConfig;
  private cache = new Map<string, ThumbnailResult>();
  private pendingRequests = new Map<string, Promise<ThumbnailResult[]>>();

  constructor(config: Partial<ThumbnailServiceConfig> = {}) {
    this.config = {
      serverEndpoint: '/api/thumbnails',
      fallbackToCanvas: true,
      enableCaching: true,
      maxCacheSize: 100,
      thumbnailWidth: 160,
      thumbnailHeight: 90,
      quality: 0.8,
      ...config
    };
  }

  /**
   * Generate thumbnails for a video at specified timestamps
   */
  async generateThumbnails(request: ThumbnailRequest): Promise<ThumbnailResult[]> {
    const cacheKey = this.getCacheKey(request);
    
    // Check if we already have a pending request for this
    if (this.pendingRequests.has(cacheKey)) {
      console.log("🔄 Using existing thumbnail request for:", cacheKey);
      return this.pendingRequests.get(cacheKey)!;
    }

    // Create the request promise
    const requestPromise = this.generateThumbnailsInternal(request);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async generateThumbnailsInternal(request: ThumbnailRequest): Promise<ThumbnailResult[]> {
    console.log("🎬 Generating thumbnails:", { 
      videoUrl: request.videoUrl, 
      timestamps: request.timestamps 
    });

    // Try server-side generation first
    if (this.config.serverEndpoint) {
      try {
        const serverResult = await this.generateThumbnailsServer(request);
        if (serverResult.length > 0) {
          console.log("✅ Server thumbnails generated successfully");
          this.cacheThumbnails(request, serverResult);
          return serverResult;
        }
      } catch (error) {
        console.warn("⚠️ Server thumbnail generation failed:", error);
      }
    }

    // Fallback to client-side canvas generation
    if (this.config.fallbackToCanvas) {
      try {
        console.log("🎨 Falling back to canvas thumbnail generation");
        const canvasResult = await this.generateThumbnailsCanvas(request);
        this.cacheThumbnails(request, canvasResult);
        return canvasResult;
      } catch (error) {
        console.error("❌ Canvas thumbnail generation failed:", error);
        throw new Error(`Thumbnail generation failed: ${error.message}`);
      }
    }

    throw new Error("No thumbnail generation methods available");
  }

  /**
   * Server-side thumbnail generation
   */
  private async generateThumbnailsServer(request: ThumbnailRequest): Promise<ThumbnailResult[]> {
    const response = await fetch(this.config.serverEndpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: request.videoUrl,
        timestamps: request.timestamps,
        width: request.width || this.config.thumbnailWidth,
        height: request.height || this.config.thumbnailHeight,
        quality: request.quality || this.config.quality,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
    }

    const data: ServerThumbnailResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Server thumbnail generation failed');
    }

    // Convert server response to ThumbnailResult format
    return data.thumbnails.map(thumb => ({
      dataUrl: thumb.url,
      timestamp: thumb.timestamp,
      width: thumb.width,
      height: thumb.height,
      size: 0, // Size not provided by server
    }));
  }

  /**
   * Client-side canvas thumbnail generation
   */
  private async generateThumbnailsCanvas(request: ThumbnailRequest): Promise<ThumbnailResult[]> {
    const generator = createMobileThumbnailGenerator({
      width: request.width || this.config.thumbnailWidth,
      height: request.height || this.config.thumbnailHeight,
      quality: request.quality || this.config.quality,
      format: 'image/jpeg',
    });

    try {
      const results = await generator.generateMultipleThumbnails(
        request.videoUrl,
        request.timestamps
      );
      return results;
    } finally {
      generator.destroy();
    }
  }

  /**
   * Get thumbnails from cache if available
   */
  getCachedThumbnails(request: ThumbnailRequest): ThumbnailResult[] | null {
    if (!this.config.enableCaching) return null;

    const cached: ThumbnailResult[] = [];
    for (const timestamp of request.timestamps) {
      const cacheKey = this.getThumbnailCacheKey(request.videoUrl, timestamp);
      const cachedThumbnail = this.cache.get(cacheKey);
      if (cachedThumbnail) {
        cached.push(cachedThumbnail);
      } else {
        return null; // If any thumbnail is missing, return null
      }
    }
    return cached;
  }

  /**
   * Cache thumbnails for future use
   */
  private cacheThumbnails(request: ThumbnailRequest, thumbnails: ThumbnailResult[]): void {
    if (!this.config.enableCaching) return;

    thumbnails.forEach(thumbnail => {
      const cacheKey = this.getThumbnailCacheKey(request.videoUrl, thumbnail.timestamp);
      
      // Implement LRU cache by removing oldest entries
      if (this.cache.size >= this.config.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(cacheKey, thumbnail);
    });

    console.log(`📦 Cached ${thumbnails.length} thumbnails. Cache size: ${this.cache.size}`);
  }

  /**
   * Generate cache key for a complete request
   */
  private getCacheKey(request: ThumbnailRequest): string {
    const key = `${request.videoUrl}:${request.timestamps.join(',')}_${request.width || this.config.thumbnailWidth}x${request.height || this.config.thumbnailHeight}_q${request.quality || this.config.quality}`;
    return btoa(key).replace(/[+/=]/g, ''); // Base64 encode and clean
  }

  /**
   * Generate cache key for individual thumbnail
   */
  private getThumbnailCacheKey(videoUrl: string, timestamp: number): string {
    return `${videoUrl}:${timestamp}`;
  }

  /**
   * Clear all cached thumbnails
   */
  clearCache(): void {
    this.cache.clear();
    console.log("🗑️ Thumbnail cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Global thumbnail service instance
let thumbnailService: ThumbnailService | null = null;

/**
 * Get or create the global thumbnail service instance
 */
export function getThumbnailService(config?: Partial<ThumbnailServiceConfig>): ThumbnailService {
  if (!thumbnailService) {
    thumbnailService = new ThumbnailService(config);
  }
  return thumbnailService;
}

/**
 * Convenience function for generating video timeline thumbnails
 */
export async function generateVideoTimelineThumbnails(
  videoUrl: string,
  durationSeconds: number,
  count: number = 10,
  config?: Partial<ThumbnailServiceConfig>
): Promise<ThumbnailResult[]> {
  const service = getThumbnailService(config);
  
  // Generate evenly spaced timestamps
  const timestamps = Array.from({ length: count }, (_, i) => 
    (durationSeconds / count) * i
  );

  // Check cache first
  const cached = service.getCachedThumbnails({ videoUrl, timestamps });
  if (cached) {
    console.log("📦 Using cached timeline thumbnails");
    return cached;
  }

  // Generate new thumbnails
  return service.generateThumbnails({ videoUrl, timestamps });
}

/**
 * Generate thumbnails for specific timestamps
 */
export async function generateSpecificThumbnails(
  videoUrl: string,
  timestamps: number[],
  config?: Partial<ThumbnailServiceConfig>
): Promise<ThumbnailResult[]> {
  const service = getThumbnailService(config);
  return service.generateThumbnails({ videoUrl, timestamps });
} 