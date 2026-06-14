// Minimal type shim for whisper.rn until its package.json exports a root entry
declare module 'whisper.rn' {
  export interface TranscribeNewSegmentsResult {
    nNew: number;
    totalNNew: number;
    result: string;
    segments: Array<{ text: string; t0: number; t1: number }>;
  }

  export interface TranscribeFileOptions {
    language?: string;
    onProgress?: (progress: number) => void;
    onNewSegments?: (result: TranscribeNewSegmentsResult) => void;
  }

  export interface TranscribeResult {
    result: string;
    segments: Array<{ text: string; t0: number; t1: number }>;
  }

  export class WhisperContext {
    transcribe(
      filePathOrBase64: string | number,
      options?: TranscribeFileOptions,
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    release(): Promise<void>;
  }

  export interface ContextOptions {
    filePath: string | number;
    isBundleAsset?: boolean;
    useCoreMLIos?: boolean;
    useGpu?: boolean;
  }

  export function initWhisper(options: ContextOptions): Promise<WhisperContext>;
  export function releaseAllWhisper(): Promise<void>;
}
