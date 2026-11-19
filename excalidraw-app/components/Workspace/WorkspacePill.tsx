import React, { useState, useRef, useEffect } from "react";
import clsx from "clsx";

import { GridIcon } from "./icons";

import type { SessionMetadata } from "../../data/sessionStorage";

interface WorkspacePillProps {
  activeSessionId: string | null;
  sessions: SessionMetadata[];
  onUpdateTitle: (newTitle: string) => void;
  onBackToGallery: () => void;
  className?: string;
}

export const WorkspacePill: React.FC<WorkspacePillProps> = ({
  activeSessionId,
  sessions,
  onUpdateTitle,
  onBackToGallery,
  className,
}) => {
  const currentSession = sessions.find((s) => s.id === activeSessionId);
  const title = currentSession?.title || "Untitled Session";

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(title);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onUpdateTitle(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      ref={containerRef}
      className={clsx("Island", "workspace-pill", className)}
      title="Drawing session"
    >
      <button
        type="button"
        className="workspace-pill__back-btn"
        onClick={onBackToGallery}
        title="Back to gallery"
        aria-label="Back to gallery"
      >
        <GridIcon size={18} />
      </button>

      <div className="workspace-pill__divider" />

      <div className="workspace-pill__title-wrapper">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="workspace-pill__title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            maxLength={100}
            aria-label="Edit session title"
          />
        ) : (
          <span
            className="workspace-pill__title"
            onClick={handleStartEdit}
            title={`${title} (Click to rename)`}
          >
            {title}
          </span>
        )}
      </div>
    </div>
  );
};
