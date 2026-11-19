import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSessionData,
  getAllSessionsFileIds,
  getDuplicateSessionTitle,
  getNextSessionTitle,
  getSessionData,
  getSessionThumb,
  getSessionsIndex,
  initializeSessions,
  saveActiveSessionDataToIndexedDB,
  saveSessionData,
  saveSessionThumb,
  saveSessionsIndex,
  formatRelativeTime,
  generateSessionThumbnail,
} from "../data/sessionStorage";

describe("sessionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("title generation", () => {
    it("generates next sequential session title", () => {
      expect(getNextSessionTitle([])).toBe("Untitled Session 1");

      expect(
        getNextSessionTitle([
          { id: "1", title: "Untitled Session 1", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Untitled Session 2");

      expect(
        getNextSessionTitle([
          { id: "1", title: "Untitled Session 1", createdAt: 0, updatedAt: 0 },
          { id: "2", title: "Untitled Session 2", createdAt: 0, updatedAt: 0 },
          { id: "3", title: "Architecture Flow", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Untitled Session 3");

      expect(
        getNextSessionTitle([
          { id: "1", title: "Untitled Session 8", createdAt: 0, updatedAt: 0 },
        ]),
      ).toBe("Untitled Session 9");
    });

    it("generates duplicate titles cleanly", () => {
      const sessions = [
        { id: "1", title: "Untitled Session 1", createdAt: 0, updatedAt: 0 },
      ];

      expect(getDuplicateSessionTitle("Untitled Session 1", sessions)).toBe(
        "Untitled Session 1 (Copy)",
      );

      const sessionsWithCopy = [
        ...sessions,
        {
          id: "2",
          title: "Untitled Session 1 (Copy)",
          createdAt: 0,
          updatedAt: 0,
        },
      ];
      expect(
        getDuplicateSessionTitle("Untitled Session 1", sessionsWithCopy),
      ).toBe("Untitled Session 1 (Copy 2)");

      const sessionsWithCopy2 = [
        ...sessionsWithCopy,
        {
          id: "3",
          title: "Untitled Session 1 (Copy 2)",
          createdAt: 0,
          updatedAt: 0,
        },
      ];
      expect(
        getDuplicateSessionTitle("Untitled Session 1", sessionsWithCopy2),
      ).toBe("Untitled Session 1 (Copy 3)");
    });
  });

  describe("relative time formatting", () => {
    it("formats relative timestamps correctly", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 10 * 1000)).toBe("Edited just now");
      expect(formatRelativeTime(now - 2 * 60 * 1000)).toBe("Edited 2m ago");
      expect(formatRelativeTime(now - 3 * 3600 * 1000)).toBe("Edited 3h ago");
      expect(formatRelativeTime(now - 2 * 24 * 3600 * 1000)).toBe(
        "Edited 2d ago",
      );

      const oldDate = new Date("2026-01-15T12:00:00Z").getTime();
      expect(formatRelativeTime(oldDate)).toContain("Edited");
      expect(formatRelativeTime(oldDate)).toContain("2026");
    });
  });

  describe("index and data persistence", () => {
    it("saves and retrieves sessions index from localStorage", () => {
      expect(getSessionsIndex()).toBeNull();

      const index = {
        activeSessionId: "session_123",
        sessions: [
          {
            id: "session_123",
            title: "Untitled Session 1",
            createdAt: 100,
            updatedAt: 200,
          },
        ],
      };
      saveSessionsIndex(index);

      const retrieved = getSessionsIndex();
      expect(retrieved).toEqual(index);
    });

    it("saves and retrieves scene data and thumbnail from IndexedDB", async () => {
      const sessionId = "session_test_1";
      const sceneData = {
        elements: [
          {
            id: "el1",
            type: "rectangle",
            isDeleted: false,
          } as any,
        ],
        appState: { viewBackgroundColor: "#ffffff" },
      };

      await saveSessionData(sessionId, sceneData);
      const retrieved = await getSessionData(sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.elements.length).toBe(1);
      expect(retrieved?.elements[0].id).toBe("el1");

      const thumbDataUrl = "data:image/webp;base64,testthumb";
      await saveSessionThumb(sessionId, thumbDataUrl);
      const retrievedThumb = await getSessionThumb(sessionId);
      expect(retrievedThumb).toBe(thumbDataUrl);

      await deleteSessionData(sessionId);
      expect(await getSessionData(sessionId)).toBeNull();
      expect(await getSessionThumb(sessionId)).toBeNull();
    });

    it("initializes sessions cleanly when no existing index", async () => {
      const index = await initializeSessions();
      expect(index).toBeDefined();
      expect(index.activeSessionId).toBeNull();
      expect(Array.isArray(index.sessions)).toBe(true);
    });

    it("migrates legacy single-canvas data to Untitled Session 1 and shows dashboard", async () => {
      localStorage.setItem(
        "excalidraw",
        JSON.stringify([
          {
            id: "legacy_el1",
            type: "rectangle",
            isDeleted: false,
          },
        ]),
      );

      const index = await initializeSessions();
      expect(index.activeSessionId).toBeNull(); // dashboard view!
      expect(index.sessions.length).toBe(1);
      expect(index.sessions[0].title).toBe("Untitled Session 1");

      const sessionData = await getSessionData(index.sessions[0].id);
      expect(sessionData?.elements.length).toBe(1);
      expect(sessionData?.elements[0].id).toBe("legacy_el1");
    });

    it("saves active session data and updates updatedAt", async () => {
      const session1Id = "session_active_1";
      saveSessionsIndex({
        activeSessionId: session1Id,
        sessions: [
          {
            id: session1Id,
            title: "Untitled Session 1",
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      });

      await saveActiveSessionDataToIndexedDB(
        [
          {
            id: "el_active",
            type: "ellipse",
            isDeleted: false,
          } as any,
        ],
        { viewBackgroundColor: "#fff" } as any,
      );

      const updatedIndex = getSessionsIndex();
      expect(updatedIndex?.sessions[0].updatedAt).toBeGreaterThan(1000);

      const data = await getSessionData(session1Id);
      expect(data?.elements.length).toBe(1);
      expect(data?.elements[0].id).toBe("el_active");
    });

    it("returns null when generating thumbnail for canvas with zero non-deleted elements", async () => {
      const emptyThumb = await generateSessionThumbnail([], {});
      expect(emptyThumb).toBeNull();

      const deletedOnlyThumb = await generateSessionThumbnail(
        [{ id: "1", isDeleted: true } as any],
        {},
      );
      expect(deletedOnlyThumb).toBeNull();
    });

    it("collects file IDs from all sessions", async () => {
      await saveSessionData("session_with_img", {
        elements: [
          {
            id: "img1",
            type: "image",
            fileId: "file_abc",
            status: "saved",
            isDeleted: false,
          } as any,
        ],
        appState: {},
      });

      const fileIds = await getAllSessionsFileIds();
      expect(fileIds).toContain("file_abc");
    });
  });
});
