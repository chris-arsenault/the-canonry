import React, { useState, useCallback } from "react";
import type { ChronicleRecord } from "../../lib/chronicleTypes";

interface TitleAcceptModalProps {
  item: ChronicleRecord;
  onAcceptTitle: (title: string) => void;
  onRejectTitle: () => void;
}

export default function TitleAcceptModal({
  item,
  onAcceptTitle,
  onRejectTitle,
}: Readonly<TitleAcceptModalProps>) {
  const [customTitle, setCustomTitle] = useState("");
  const hasPending = !!item.pendingTitle;
  const [prevPendingTitle, setPrevPendingTitle] = useState(item.pendingTitle);

  if (item.pendingTitle !== prevPendingTitle) {
    setPrevPendingTitle(item.pendingTitle);
    setCustomTitle("");
  }

  const handleOverlayClick = useCallback(() => {
    if (hasPending) onRejectTitle();
  }, [hasPending, onRejectTitle]);

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        (e.currentTarget as HTMLElement).click();
      }
    },
    []
  );

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        (e.currentTarget as HTMLElement).click();
      }
    },
    []
  );

  const handleCustomTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCustomTitle(e.target.value),
    []
  );

  const handleCustomTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = e.currentTarget.value.trim();
        if (trimmed) onAcceptTitle(trimmed);
      }
    },
    [onAcceptTitle]
  );

  const handleUseCustomTitle = useCallback(() => {
    const trimmed = customTitle.trim();
    if (trimmed) onAcceptTitle(trimmed);
  }, [customTitle, onAcceptTitle]);

  const handleAcceptPrimary = useCallback(() => {
    if (item.pendingTitle) onAcceptTitle(item.pendingTitle);
  }, [item.pendingTitle, onAcceptTitle]);

  if (!hasPending) {
    return (
      <div
        className="cw-title-overlay"
        role="button"
        tabIndex={0}
        onKeyDown={handleOverlayKeyDown}
      >
        <div
          className="cw-title-dialog"
          onClick={handleDialogClick}
          role="button"
          tabIndex={0}
          onKeyDown={handleDialogKeyDown}
        >
          <h3 className="cw-title-heading">Generating Title...</h3>
          <div className="cw-generating-current">
            <div className="cw-generating-current-label">Current</div>
            <div className="cw-generating-current-value">{item.title}</div>
          </div>
          <div className="cw-generating-spinner-row">
            <span className="cw-spinner" />
            Generating title candidates...
          </div>
        </div>
      </div>
    );
  }

  const filteredCandidates = item.pendingTitleCandidates?.filter(
    (c) => c !== item.pendingTitle
  );

  return (
    <div
      className="cw-title-overlay"
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="cw-title-dialog"
        onClick={handleDialogClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleDialogKeyDown}
      >
        <h3 className="cw-title-heading">Choose Title</h3>
        {item.pendingTitleFragments && item.pendingTitleFragments.length > 0 && (
          <div className="cw-fragments-box">
            <div className="cw-fragments-label">Extracted Fragments</div>
            <div className="cw-fragments-list">
              {item.pendingTitleFragments.map((f, i) => (
                <span key={i}>
                  {f}
                  {i < (item.pendingTitleFragments?.length ?? 0) - 1 ? (
                    <span className="cw-fragment-separator">&middot;</span>
                  ) : (
                    ""
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="cw-candidates-list">
          <button onClick={handleAcceptPrimary} className="cw-candidate-primary">
            <span className="cw-candidate-primary-icon">&#x2726;</span>
            {item.pendingTitle}
          </button>
          {filteredCandidates?.map((candidate, i) => (
            <button
              key={i}
              onClick={() => onAcceptTitle(candidate)}
              className="cw-candidate-alt"
            >
              <span className="cw-candidate-alt-icon">&#x25C7;</span>
              {candidate}
            </button>
          ))}
        </div>
        <div className="cw-custom-title-section">
          <div className="cw-custom-title-label">Custom title</div>
          <div className="cw-custom-title-row">
            <input
              className="illuminator-input cw-custom-title-input"
              value={customTitle}
              onChange={handleCustomTitleChange}
              placeholder="Enter a custom title..."
              onKeyDown={handleCustomTitleKeyDown}
            />
            <button
              onClick={handleUseCustomTitle}
              disabled={!customTitle.trim()}
              className={`cw-custom-title-use-btn ${customTitle.trim() ? "cw-custom-title-use-btn-active" : "cw-custom-title-use-btn-disabled"}`}
            >
              Use
            </button>
          </div>
        </div>
        <div className="cw-title-footer">
          <button onClick={onRejectTitle} className="cw-keep-current-btn">
            Keep Current
          </button>
        </div>
      </div>
    </div>
  );
}
