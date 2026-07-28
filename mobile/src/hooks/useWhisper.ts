import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { initWhisper, WhisperContext } from 'whisper.rn';
import {
  documentDirectory,
  getInfoAsync,
  createDownloadResumable,
} from 'expo-file-system/legacy';

const MODEL_NAME = 'ggml-tiny.en.bin';
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const MODEL_PATH = `${documentDirectory}${MODEL_NAME}`;

// This only fires once ever per device — after the first successful download,
// getInfoAsync(MODEL_PATH) short-circuits prepare() below. Asking here (rather
// than silently spending ~75MB, which could be cellular data) is worth the
// one-time interruption.
function confirmDownload(): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Download offline transcription?',
      'MedScout transcribes your call summary on-device using a ~75MB Whisper model. This downloads once and then works offline. Wi-Fi is recommended to avoid using cellular data.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Download', onPress: () => resolve(true) },
      ],
    );
  });
}

export type WhisperStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'transcribing' | 'error';

interface UseWhisperReturn {
  status: WhisperStatus;
  downloadProgress: number;
  transcribeProgress: number;
  error: string | null;
  prepare: () => Promise<void>;
  transcribeFile: (filePath: string) => Promise<string>;
}

export function useWhisper(): UseWhisperReturn {
  const ctxRef = useRef<WhisperContext | null>(null);
  const [status, setStatus] = useState<WhisperStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      const info = await getInfoAsync(MODEL_PATH!);
      if (!info.exists) {
        const confirmed = await confirmDownload();
        if (!confirmed) {
          setStatus('idle');
          return;
        }
        setStatus('downloading');
        const dl = createDownloadResumable(
          MODEL_URL,
          MODEL_PATH!,
          {},
          (p) => setDownloadProgress(p.totalBytesWritten / (p.totalBytesExpectedToWrite || 1)),
        );
        await dl.downloadAsync();
        setDownloadProgress(1);
      }
      setStatus('loading');
      ctxRef.current = await initWhisper({ filePath: MODEL_PATH! });
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load Whisper model');
      setStatus('error');
      throw e;
    }
  }, []);

  const transcribeFile = useCallback(async (filePath: string): Promise<string> => {
    if (!ctxRef.current) await prepare();
    if (!ctxRef.current) throw new Error('Transcription model not downloaded');

    setStatus('transcribing');
    setTranscribeProgress(0);

    try {
      const segments: string[] = [];
      const { promise } = ctxRef.current.transcribe(filePath, {
        language: 'en',
        onProgress: (pct: number) => setTranscribeProgress(pct / 100),
        onNewSegments: (result: { segments: Array<{ text: string }> }) => {
          for (const seg of result.segments) {
            segments.push(seg.text.trim());
          }
        },
      });
      await promise;
      setStatus('ready');
      setTranscribeProgress(1);
      return segments.join(' ');
    } catch (e: any) {
      setError(e?.message ?? 'Transcription failed');
      setStatus('error');
      throw e;
    }
  }, [prepare]);

  return { status, downloadProgress, transcribeProgress, error, prepare, transcribeFile };
}
