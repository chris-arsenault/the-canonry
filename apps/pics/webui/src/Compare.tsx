/**
 * Compare — Side-by-side image comparison.
 *
 * Users select 2 images from the grid, then view them side by side.
 */

import type { CatalogImage } from "./types";
import "./Compare.css";

interface CompareProps {
  images: [CatalogImage, CatalogImage];
  baseUrl: string;
  onClose: () => void;
}

export default function Compare({ images, baseUrl, onClose }: Readonly<CompareProps>) {
  const resolveUrl = (path: string) => (baseUrl ? `${baseUrl}/${path}` : `/${path}`);

  return (
    <div className="cmp-overlay">
      <div className="cmp-toolbar">
        <span className="cmp-label">Compare Mode</span>
        <button className="cmp-close" onClick={onClose}>&times;</button>
      </div>
      <div className="cmp-panels">
        {images.map((img) => (
          <div key={img.imageId} className="cmp-panel">
            <img
              src={resolveUrl(img.hqPath ?? img.fullPath)}
              alt={img.title}
              className="cmp-image"
            />
            <div className="cmp-caption">
              <div className="cmp-title">{img.title}</div>
              {img.imageType === "entity" && <div className="cmp-entity">{img.entityName}</div>}
              <div className="cmp-meta">
                {img.width}&times;{img.height} &middot; {img.model}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
