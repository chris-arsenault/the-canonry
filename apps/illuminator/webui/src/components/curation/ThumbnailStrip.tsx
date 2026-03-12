/**
 * ThumbnailStrip — Horizontal carousel of image thumbnails with Use/Active selection.
 *
 * Used by both CurationImageSheet (chronicle images) and EntityImageSheet (entity images).
 */

import React from "react";
import "./ThumbnailStrip.css";

export interface ThumbUrl {
  imageId: string;
  url: string;
}

export default function ThumbnailStrip({ thumbs, selectedImageId, onSelect, onViewFull }: Readonly<{
  thumbs: ThumbUrl[];
  selectedImageId?: string;
  onSelect: (imageId: string) => void;
  onViewFull: (info: { imageId: string; title: string }) => void;
}>) {
  if (thumbs.length === 0) return null;
  const isActive = (id: string) => id === selectedImageId;
  return (
    <div className="cis-thumb-strip">
      {thumbs.map((thumb) => (
        <div key={thumb.imageId} className="cis-thumb-slot">
          <img
            className={`cis-thumb${isActive(thumb.imageId) ? " cis-thumb-selected" : ""}`}
            src={thumb.url}
            alt=""
            onClick={() => onViewFull({ imageId: thumb.imageId, title: "Image" })}
            title="View full size"
          />
          {isActive(thumb.imageId) ? (
            <span className="cis-use-button-active">Active</span>
          ) : (
            <button className="cis-use-button" onClick={() => onSelect(thumb.imageId)}>
              Use
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
