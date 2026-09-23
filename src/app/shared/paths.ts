import {downloadDir} from "@tauri-apps/api/path";

/**
 * The user's download directory, or `undefined` when the system has none.
 *
 * On Linux, `downloadDir()` rejects when `XDG_DOWNLOAD_DIR` is not set, which is common without
 * xdg-user-dirs. A file dialog opens without a default path, so callers pass this on as is.
 */
export async function defaultDownloadDir(): Promise<string | undefined> {
    return downloadDir().catch(() => undefined);
}
