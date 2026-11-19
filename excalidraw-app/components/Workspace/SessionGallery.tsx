import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { getSessionThumb, formatRelativeTime } from "../../data/sessionStorage";

import {
  PlusIcon,
  SearchIcon,
  ClearIcon,
  MoreIcon,
  OpenIcon,
  EditIcon,
  DuplicateIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
  CanvasPlaceholderIcon,
  ExcalidrawWorkspaceLogo,
} from "./icons";
import "./Workspace.scss";

import type { SessionMetadata } from "../../data/sessionStorage";

type SortOption = "lastModified" | "newest" | "name";

interface SessionGalleryProps {
  sessions: SessionMetadata[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const SessionGallery: React.FC<SessionGalleryProps> = ({
  sessions,
  theme,
  onToggleTheme,
  onCreateSession,
  onOpenSession,
  onRenameSession,
  onDuplicateSession,
  onDeleteSession,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("lastModified");
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>(
    {},
  );
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(
    null,
  );
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [sessionToDelete, setSessionToDelete] =
    useState<SessionMetadata | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  // Load thumbnails for all sessions
  useEffect(() => {
    let isCancelled = false;
    const loadThumbs = async () => {
      const thumbs: Record<string, string | null> = {};
      await Promise.all(
        sessions.map(async (s) => {
          const thumb = await getSessionThumb(s.id);
          thumbs[s.id] = thumb;
        }),
      );
      if (!isCancelled) {
        setThumbnails(thumbs);
      }
    };
    loadThumbs();
    return () => {
      isCancelled = true;
    };
  }, [sessions]);

  // Close active dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeMenuSessionId) {
      return;
    }

    const doc = galleryRef.current?.ownerDocument || document;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".session-card__menu-wrapper")) {
        setActiveMenuSessionId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuSessionId(null);
      }
    };

    doc.addEventListener("mousedown", handleClickOutside);
    doc.addEventListener("keydown", handleKeyDown);

    return () => {
      doc.removeEventListener("mousedown", handleClickOutside);
      doc.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuSessionId]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingSessionId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingSessionId]);

  // Auto-focus delete button and attach escape listener when confirmation modal opens
  useEffect(() => {
    if (!sessionToDelete) {
      return;
    }

    deleteBtnRef.current?.focus();

    const doc = galleryRef.current?.ownerDocument || document;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSessionToDelete(null);
      }
    };

    doc.addEventListener("keydown", handleKeyDown);
    return () => {
      doc.removeEventListener("keydown", handleKeyDown);
    };
  }, [sessionToDelete]);

  // Filter and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions];

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((s) => s.title.toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      if (sortBy === "lastModified") {
        return b.updatedAt - a.updatedAt;
      }
      if (sortBy === "newest") {
        return b.createdAt - a.createdAt;
      }
      if (sortBy === "name") {
        return a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
        });
      }
      return 0;
    });

    return result;
  }, [sessions, searchQuery, sortBy]);

  const handleStartRename = (session: SessionMetadata) => {
    setRenamingSessionId(session.id);
    setRenameValue(session.title);
    setActiveMenuSessionId(null);
  };

  const handleSaveRename = (sessionId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRenameSession(sessionId, trimmed);
    }
    setRenamingSessionId(null);
  };

  const handleRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    sessionId: string,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename(sessionId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setRenamingSessionId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <div ref={galleryRef} className="session-gallery">
      {/* Top Header Bar */}
      <header className="session-gallery__header">
        <div className="session-gallery__header-left">
          <div className="session-gallery__logo-icon">
            <ExcalidrawWorkspaceLogo size={28} />
          </div>
          <h1 className="session-gallery__logo-title">Excalidraw</h1>
        </div>

        <div className="session-gallery__header-center">
          <div className="session-gallery__search-wrapper">
            <span className="session-gallery__search-icon" aria-hidden="true">
              <SearchIcon size={18} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="session-gallery__search-input"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search sessions"
              style={{
                paddingLeft: "46px",
                paddingRight: searchQuery ? "40px" : "16px",
                borderRadius: "9999px",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="session-gallery__search-clear"
                onClick={handleClearSearch}
                aria-label="Clear search"
                title="Clear search"
              >
                <ClearIcon size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="session-gallery__header-right">
          <select
            className="session-gallery__sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort sessions"
          >
            <option value="lastModified">Last modified</option>
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
          </select>

          <button
            type="button"
            className="session-gallery__theme-btn"
            onClick={onToggleTheme}
            title={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="session-gallery__content">
        <div className="session-gallery__grid">
          {/* First Card — Create New Session */}
          <div
            className="session-card-create"
            onClick={onCreateSession}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCreateSession();
              }
            }}
            aria-label="Create New Session"
          >
            <div className="session-card-create__icon">
              <PlusIcon size={24} />
            </div>
            <span className="session-card-create__label">New Session</span>
          </div>

          {/* Saved Session Cards */}
          {filteredAndSortedSessions.map((session) => {
            const thumbUrl = thumbnails[session.id];
            const isMenuOpen = activeMenuSessionId === session.id;
            const isRenaming = renamingSessionId === session.id;

            return (
              <div
                key={session.id}
                className="session-card"
                data-testid={`session-card-${session.id}`}
              >
                {/* Thumbnail Preview Area */}
                <div
                  className="session-card__preview"
                  onClick={() => onOpenSession(session.id)}
                  title={`Open "${session.title}"`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenSession(session.id);
                    }
                  }}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={session.title}
                      className="session-card__thumb-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="session-card__thumb-placeholder">
                      <CanvasPlaceholderIcon size={36} />
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="session-card__footer">
                  <div className="session-card__info">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="session-card__title-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleSaveRename(session.id)}
                        onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                        maxLength={100}
                        aria-label="Session title"
                      />
                    ) : (
                      <span
                        className="session-card__title"
                        title={`${session.title} (Double-click to rename)`}
                        onDoubleClick={() => handleStartRename(session)}
                        onClick={() => onOpenSession(session.id)}
                      >
                        {session.title}
                      </span>
                    )}

                    <span className="session-card__subtitle">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>

                  {/* Action Menu (⋮) */}
                  <div className="session-card__menu-wrapper">
                    <button
                      type="button"
                      className={`session-card__menu-btn ${
                        isMenuOpen ? "active" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuSessionId(isMenuOpen ? null : session.id);
                      }}
                      title="Session actions"
                      aria-label="Session actions"
                      aria-haspopup="true"
                      aria-expanded={isMenuOpen}
                    >
                      <MoreIcon size={16} />
                    </button>

                    {isMenuOpen && (
                      <div
                        className="session-menu-popover dropdown-menu"
                        role="menu"
                      >
                        <button
                          type="button"
                          className="session-menu-popover__item"
                          onClick={() => {
                            setActiveMenuSessionId(null);
                            onOpenSession(session.id);
                          }}
                          role="menuitem"
                        >
                          <OpenIcon size={14} />
                          <span>Open</span>
                        </button>

                        <button
                          type="button"
                          className="session-menu-popover__item"
                          onClick={() => handleStartRename(session)}
                          role="menuitem"
                        >
                          <EditIcon size={14} />
                          <span>Rename</span>
                        </button>

                        <button
                          type="button"
                          className="session-menu-popover__item"
                          onClick={() => {
                            setActiveMenuSessionId(null);
                            onDuplicateSession(session.id);
                          }}
                          role="menuitem"
                        >
                          <DuplicateIcon size={14} />
                          <span>Duplicate</span>
                        </button>

                        <button
                          type="button"
                          className="session-menu-popover__item session-menu-popover__item--danger"
                          onClick={() => {
                            setActiveMenuSessionId(null);
                            setSessionToDelete(session);
                          }}
                          role="menuitem"
                        >
                          <TrashIcon size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty search results state */}
        {searchQuery.trim() && filteredAndSortedSessions.length === 0 && (
          <div className="session-gallery__empty-search">
            <p>No sessions found matching &ldquo;{searchQuery}&rdquo;</p>
            <button type="button" onClick={handleClearSearch}>
              Clear search
            </button>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {sessionToDelete &&
        createPortal(
          <div
            className={clsx("excalidraw", "excalidraw-modal-container", {
              "theme--dark": theme === "dark",
            })}
          >
            <div
              className="session-dialog-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSessionToDelete(null);
                }
              }}
            >
              <div
                className="session-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="session-dialog-title"
                aria-describedby="session-dialog-description"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSessionToDelete(null);
                  }
                }}
              >
                <div className="session-dialog__header">
                  <h2
                    id="session-dialog-title"
                    className="session-dialog__title"
                  >
                    Delete Session
                  </h2>
                </div>
                <p
                  id="session-dialog-description"
                  className="session-dialog__description"
                >
                  Are you sure you want to delete &ldquo;
                  {sessionToDelete.title}&rdquo;? This action cannot be undone.
                </p>
                <div className="session-dialog__actions">
                  <button
                    type="button"
                    className="session-dialog__btn session-dialog__btn--cancel"
                    onClick={() => setSessionToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    ref={deleteBtnRef}
                    className="session-dialog__btn session-dialog__btn--danger"
                    onClick={handleConfirmDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          galleryRef.current?.ownerDocument.body || document.body,
        )}
    </div>
  );
};
