import {Channel} from "@tauri-apps/api/core";

export type ProgressCallback = (copied: number, total: number) => void;

interface ProgressPayload {
    copied: number;
    total: number;
}

export function progressChannel(progress?: ProgressCallback) {
    const onProgress = new Channel<ProgressPayload>();
    onProgress.onmessage = (e: ProgressPayload) => {
        progress?.(e.copied, e.total);
    }
    return onProgress;
}
