import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
} from "@excalidraw/excalidraw/tests/test-utils";

import { SessionGallery, WorkspacePill } from "../components/Workspace";

import type { SessionMetadata } from "../data/sessionStorage";

describe("Workspace Components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("SessionGallery Component", () => {
    const mockSessions: SessionMetadata[] = [
      {
        id: "session_1",
        title: "Alpha Project",
        createdAt: 1000,
        updatedAt: 5000,
      },
      {
        id: "session_2",
        title: "Beta Wireframes",
        createdAt: 2000,
        updatedAt: 4000,
      },
      {
        id: "session_3",
        title: "Gamma Architecture",
        createdAt: 3000,
        updatedAt: 6000,
      },
    ];

    it("renders workspace header with logo, title, and search input", () => {
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      expect(screen.getByText("Excalidraw")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search sessions..."),
      ).toBeInTheDocument();
      expect(screen.getByText("New Session")).toBeInTheDocument();
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.getByText("Beta Wireframes")).toBeInTheDocument();
      expect(screen.getByText("Gamma Architecture")).toBeInTheDocument();
    });

    it("calls onCreateSession when clicking the New Session card", () => {
      const handleCreate = vi.fn();
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={handleCreate}
          onOpenSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      const createCard = screen
        .getByText("New Session")
        .closest(".session-card-create");
      expect(createCard).toBeInTheDocument();
      fireEvent.click(createCard!);
      expect(handleCreate).toHaveBeenCalledTimes(1);
    });

    it("filters session cards in real-time by search query", () => {
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      const searchInput = screen.getByPlaceholderText("Search sessions...");
      fireEvent.change(searchInput, { target: { value: "alpha" } });

      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.queryByText("Beta Wireframes")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma Architecture")).not.toBeInTheDocument();

      // Clear search
      const clearBtn = screen.getByLabelText("Clear search");
      fireEvent.click(clearBtn);

      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.getByText("Beta Wireframes")).toBeInTheDocument();
      expect(screen.getByText("Gamma Architecture")).toBeInTheDocument();
    });

    it("sorts session cards according to sort selection", () => {
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      const sortSelect = screen.getByLabelText("Sort sessions");

      // Sort by Name A-Z
      fireEvent.change(sortSelect, { target: { value: "name" } });
      let titles = Array.from(
        document.querySelectorAll(".session-card__title"),
      ).map((el) => el.textContent);
      expect(titles).toEqual([
        "Alpha Project",
        "Beta Wireframes",
        "Gamma Architecture",
      ]);

      // Sort by Newest (createdAt desc: 3000, 2000, 1000)
      fireEvent.change(sortSelect, { target: { value: "newest" } });
      titles = Array.from(
        document.querySelectorAll(".session-card__title"),
      ).map((el) => el.textContent);
      expect(titles).toEqual([
        "Gamma Architecture",
        "Beta Wireframes",
        "Alpha Project",
      ]);

      // Sort by Last modified (updatedAt desc: 6000, 5000, 4000)
      fireEvent.change(sortSelect, { target: { value: "lastModified" } });
      titles = Array.from(
        document.querySelectorAll(".session-card__title"),
      ).map((el) => el.textContent);
      expect(titles).toEqual([
        "Gamma Architecture",
        "Alpha Project",
        "Beta Wireframes",
      ]);
    });

    it("calls onOpenSession when clicking a session card preview or title", () => {
      const handleOpen = vi.fn();
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenSession={handleOpen}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("Alpha Project"));
      expect(handleOpen).toHaveBeenCalledWith("session_1");
    });

    it("toggles theme when clicking the theme button", () => {
      const handleToggleTheme = vi.fn();
      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={handleToggleTheme}
          onCreateSession={vi.fn()}
          onOpenSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDuplicateSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />,
      );

      const themeBtn = screen.getByLabelText("Toggle theme");
      fireEvent.click(themeBtn);
      expect(handleToggleTheme).toHaveBeenCalledTimes(1);
    });

    it("opens action menu and handles Rename, Duplicate, Delete", async () => {
      const handleRename = vi.fn();
      const handleDuplicate = vi.fn();
      const handleDelete = vi.fn();

      render(
        <SessionGallery
          sessions={mockSessions}
          theme="light"
          onToggleTheme={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenSession={vi.fn()}
          onRenameSession={handleRename}
          onDuplicateSession={handleDuplicate}
          onDeleteSession={handleDelete}
        />,
      );

      const card1 = screen.getByTestId("session-card-session_1");
      const actionBtn = card1.querySelector(".session-card__menu-btn");
      expect(actionBtn).not.toBeNull();
      fireEvent.click(actionBtn!);

      expect(screen.getByText("Open")).toBeInTheDocument();
      expect(screen.getByText("Rename")).toBeInTheDocument();
      expect(screen.getByText("Duplicate")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();

      // Duplicate
      fireEvent.click(screen.getByText("Duplicate"));
      expect(handleDuplicate).toHaveBeenCalledWith("session_1");

      // Open menu again for Delete confirmation
      fireEvent.click(actionBtn!);
      fireEvent.click(screen.getByText("Delete"));

      expect(screen.getByText("Delete Session")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete.*Alpha Project/),
      ).toBeInTheDocument();

      const confirmDeleteBtn = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(confirmDeleteBtn);
      expect(handleDelete).toHaveBeenCalledWith("session_1");
    });
  });

  describe("WorkspacePill Component", () => {
    it("renders session title and back button", () => {
      const handleBack = vi.fn();
      const handleUpdateTitle = vi.fn();

      render(
        <WorkspacePill
          activeSessionId="session_1"
          sessions={[
            {
              id: "session_1",
              title: "System Diagram",
              createdAt: 0,
              updatedAt: 0,
            },
          ]}
          onUpdateTitle={handleUpdateTitle}
          onBackToGallery={handleBack}
        />,
      );

      expect(screen.getByText("System Diagram")).toBeInTheDocument();
      const backBtn = screen.getByLabelText("Back to gallery");
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it("supports inline rename via click, Enter, and blur", () => {
      const handleUpdateTitle = vi.fn();

      render(
        <WorkspacePill
          activeSessionId="session_1"
          sessions={[
            {
              id: "session_1",
              title: "System Diagram",
              createdAt: 0,
              updatedAt: 0,
            },
          ]}
          onUpdateTitle={handleUpdateTitle}
          onBackToGallery={vi.fn()}
        />,
      );

      // Click title to enter editing
      fireEvent.click(screen.getByText("System Diagram"));

      const input = screen.getByLabelText("Edit session title");
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "New Diagram Name" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(handleUpdateTitle).toHaveBeenCalledWith("New Diagram Name");
    });

    it("cancels rename on Escape", () => {
      const handleUpdateTitle = vi.fn();

      render(
        <WorkspacePill
          activeSessionId="session_1"
          sessions={[
            {
              id: "session_1",
              title: "System Diagram",
              createdAt: 0,
              updatedAt: 0,
            },
          ]}
          onUpdateTitle={handleUpdateTitle}
          onBackToGallery={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("System Diagram"));
      const input = screen.getByLabelText("Edit session title");
      fireEvent.change(input, { target: { value: "Cancelled Name" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(handleUpdateTitle).not.toHaveBeenCalled();
      expect(screen.getByText("System Diagram")).toBeInTheDocument();
    });
  });
});
