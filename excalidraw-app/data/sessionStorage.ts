import { createStore, get, set, del, entries } from "idb-keyval";

import {
  isInitializedImageElement,
  getNonDeletedElements,
} from "@excalidraw/element";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { exportScene } from "@excalidraw/excalidraw";
import { debounce } from "@excalidraw/common";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { importFromLocalStorage } from "./localStorage";

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionsIndex {
  activeSessionId: string | null;
  sessions: SessionMetadata[];
}

export interface SessionSceneData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
}

export const SESSION_STORAGE_KEYS = {
  LOCAL_STORAGE_SESSIONS_INDEX: "excalidraw-sessions-index",
  IDB_SESSION_DATA_PREFIX: "excalidraw-session-data-",
  IDB_SESSION_THUMB_PREFIX: "excalidraw-session-thumb-",
} as const;

export const sessionsStore = createStore(
  "excalidraw-sessions-db",
  "sessions-store",
);

export const getSessionsIndex = (): SessionsIndex | null => {
  try {
    const raw = localStorage.getItem(
      SESSION_STORAGE_KEYS.LOCAL_STORAGE_SESSIONS_INDEX,
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionsIndex;
    if (
      parsed &&
      (typeof parsed.activeSessionId === "string" ||
        parsed.activeSessionId === null) &&
      Array.isArray(parsed.sessions)
    ) {
      return parsed;
    }
  } catch (error) {
    console.error("Error reading sessions index from localStorage", error);
  }
  return null;
};

export const saveSessionsIndex = (index: SessionsIndex): void => {
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEYS.LOCAL_STORAGE_SESSIONS_INDEX,
      JSON.stringify(index),
    );
  } catch (error) {
    console.error("Error saving sessions index to localStorage", error);
  }
};

export const getSessionData = async (
  sessionId: string,
): Promise<SessionSceneData | null> => {
  try {
    const data = await get<SessionSceneData>(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_DATA_PREFIX}${sessionId}`,
      sessionsStore,
    );
    return data || null;
  } catch (error) {
    console.error(`Error loading session data for session ${sessionId}`, error);
    return null;
  }
};

export const saveSessionData = async (
  sessionId: string,
  data: SessionSceneData,
): Promise<void> => {
  try {
    await set(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_DATA_PREFIX}${sessionId}`,
      {
        elements: getNonDeletedElements(data.elements || []),
        appState: data.appState
          ? clearAppStateForLocalStorage(data.appState as AppState)
          : {},
      },
      sessionsStore,
    );
  } catch (error) {
    console.error(`Error saving session data for session ${sessionId}`, error);
  }
};

export const getSessionThumb = async (
  sessionId: string,
): Promise<string | null> => {
  try {
    const thumb = await get<string | null>(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_THUMB_PREFIX}${sessionId}`,
      sessionsStore,
    );
    return thumb || null;
  } catch (error) {
    console.error(
      `Error loading session thumbnail for session ${sessionId}`,
      error,
    );
    return null;
  }
};

export const saveSessionThumb = async (
  sessionId: string,
  thumb: string | null,
): Promise<void> => {
  try {
    await set(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_THUMB_PREFIX}${sessionId}`,
      thumb,
      sessionsStore,
    );
  } catch (error) {
    console.error(
      `Error saving session thumbnail for session ${sessionId}`,
      error,
    );
  }
};

export const deleteSessionData = async (sessionId: string): Promise<void> => {
  try {
    await del(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_DATA_PREFIX}${sessionId}`,
      sessionsStore,
    );
    await del(
      `${SESSION_STORAGE_KEYS.IDB_SESSION_THUMB_PREFIX}${sessionId}`,
      sessionsStore,
    );
  } catch (error) {
    console.error(
      `Error deleting session data for session ${sessionId}`,
      error,
    );
  }
};

/**
 * Generates a compressed preview image (WebP/JPEG data URL scaled to max width 480px).
 * If the canvas has zero non-deleted elements, returns null.
 */
export const generateSessionThumbnail = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files?: BinaryFiles | null,
): Promise<string | null> => {
  const nonDeleted = getNonDeletedElements(elements);
  if (!nonDeleted || nonDeleted.length === 0) {
    return null;
  }

  try {
    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: nonDeleted,
        appState,
        files: files || null,
      },
      config: {
        maxWidthOrHeight: 480,
        theme: appState?.theme,
        canvasBackgroundColor: appState?.viewBackgroundColor,
      },
    });

    if (!canvas || typeof canvas.toDataURL !== "function") {
      return null;
    }

    try {
      const webpUrl = canvas.toDataURL("image/webp", 0.8);
      if (webpUrl && webpUrl.startsWith("data:image/webp")) {
        return webpUrl;
      }
    } catch {
      // Browser might not support webp in toDataURL, continue to jpeg fallback
    }

    try {
      const jpegUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (jpegUrl && jpegUrl.startsWith("data:image/jpeg")) {
        return jpegUrl;
      }
    } catch {
      // Fallback
    }

    return canvas.toDataURL();
  } catch (error) {
    console.warn("Could not generate session thumbnail", error);
    return null;
  }
};

/**
 * Backward-Compatible Migration:
 * On initial load, if legacy single-canvas data exists and excalidraw-sessions-index does not exist yet,
 * migrate that existing drawing into "Untitled Session 1", generate its initial thumbnail, and show it in the dashboard.
 */
export const initializeSessions = async (): Promise<SessionsIndex> => {
  const existingIndex = getSessionsIndex();
  if (existingIndex) {
    if (
      existingIndex.activeSessionId !== null &&
      !existingIndex.sessions.some(
        (s) => s.id === existingIndex.activeSessionId,
      )
    ) {
      existingIndex.activeSessionId = null;
      saveSessionsIndex(existingIndex);
    }
    return existingIndex;
  }

  // Check legacy single-canvas data
  const legacy = importFromLocalStorage();
  const now = Date.now();
  const session1Id = `session_${now}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  const hasLegacyData =
    Boolean(legacy?.elements && legacy.elements.length > 0) ||
    Boolean(localStorage.getItem("excalidraw"));

  if (hasLegacyData) {
    const session1: SessionMetadata = {
      id: session1Id,
      title: "Untitled Session 1",
      createdAt: now,
      updatedAt: now,
    };

    await saveSessionData(session1Id, {
      elements: legacy?.elements || [],
      appState: legacy?.appState || {},
    });

    const thumb = await generateSessionThumbnail(
      legacy?.elements || [],
      legacy?.appState || {},
    );
    await saveSessionThumb(session1Id, thumb);

    const newIndex: SessionsIndex = {
      activeSessionId: null, // show in dashboard!
      sessions: [session1],
    };

    saveSessionsIndex(newIndex);
    return newIndex;
  }

  const emptyIndex: SessionsIndex = {
    activeSessionId: null,
    sessions: [],
  };
  saveSessionsIndex(emptyIndex);
  return emptyIndex;
};

export const loadActiveSessionScene = async (): Promise<
  ReturnType<typeof importFromLocalStorage>
> => {
  const index = await initializeSessions();
  if (index.activeSessionId) {
    const sessionData = await getSessionData(index.activeSessionId);
    if (sessionData) {
      return {
        elements: (sessionData.elements as ExcalidrawElement[]) || [],
        appState: sessionData.appState
          ? {
              ...getDefaultAppState(),
              ...sessionData.appState,
            }
          : null,
      };
    }
  }

  return importFromLocalStorage();
};

export const debouncedUpdateActiveThumbnail = debounce(
  async (
    sessionId: string,
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files?: BinaryFiles | null,
  ) => {
    try {
      const thumb = await generateSessionThumbnail(elements, appState, files);
      await saveSessionThumb(sessionId, thumb);
    } catch (err) {
      console.warn("Debounced thumbnail refresh failed", err);
    }
  },
  2000,
);

export const saveActiveSessionDataToIndexedDB = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files?: BinaryFiles | null,
): Promise<void> => {
  const index = getSessionsIndex();
  if (!index || !index.activeSessionId) {
    return;
  }

  const activeId = index.activeSessionId;

  await saveSessionData(activeId, {
    elements,
    appState,
  });

  const now = Date.now();
  const updatedSessions = index.sessions.map((s) =>
    s.id === activeId ? { ...s, updatedAt: now } : s,
  );
  saveSessionsIndex({
    ...index,
    sessions: updatedSessions,
  });

  debouncedUpdateActiveThumbnail(activeId, elements, appState, files);
};

export const getAllSessionsFileIds = async (): Promise<FileId[]> => {
  const fileIds: FileId[] = [];
  try {
    const allEntries = await entries(sessionsStore);
    for (const [key, val] of allEntries) {
      if (
        typeof key === "string" &&
        key.startsWith(SESSION_STORAGE_KEYS.IDB_SESSION_DATA_PREFIX)
      ) {
        const session = val as SessionSceneData | undefined;
        if (session && Array.isArray(session.elements)) {
          for (const el of session.elements) {
            if (isInitializedImageElement(el)) {
              fileIds.push(el.fileId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error reading all sessions file IDs", error);
  }
  return fileIds;
};

export const getNextSessionTitle = (sessions: SessionMetadata[]): string => {
  let maxNum = 0;
  const regex = /^Untitled Session\s+(\d+)$/i;
  for (const session of sessions) {
    const match = session.title.trim().match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `Untitled Session ${maxNum > 0 ? maxNum + 1 : sessions.length + 1}`;
};

export const getDuplicateSessionTitle = (
  baseTitle: string,
  sessions: SessionMetadata[],
): string => {
  const existingTitles = new Set(
    sessions.map((s) => s.title.trim().toLowerCase()),
  );
  const cleanBase = baseTitle.trim();
  const candidate = `${cleanBase} (Copy)`;
  if (!existingTitles.has(candidate.toLowerCase())) {
    return candidate;
  }
  let count = 2;
  while (existingTitles.has(`${cleanBase} (Copy ${count})`.toLowerCase())) {
    count++;
  }
  return `${cleanBase} (Copy ${count})`;
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 60) {
    return "Edited just now";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `Edited ${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `Edited ${diffHour}h ago`;
  }
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) {
    return `Edited ${diffDays}d ago`;
  }

  const date = new Date(timestamp);
  return `Edited ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};
