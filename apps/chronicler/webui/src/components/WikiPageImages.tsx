/**
 * WikiPageImages - Image components for wiki page rendering
 *
 * Provides inline chronicle images, cover hero banners, and chronicle galleries.
 */

import React, { useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { ImageDisplay } from "@the-canonry/shared-components";
import type { WikiPage, WikiSectionImage } from "../types/world.ts";
import type { LayoutMode } from "./WikiPageLayout.ts";
import { getImageClassName } from "./WikiPageLayout.ts";
import { FrostEdge } from "./Ornaments.tsx";

/**
 * ChronicleImage - Renders an inline chronicle image
 * Loads images on-demand from the shared image store.
 * Supports flow mode (CSS float) and margin mode (side column in grid).
 */
export function ChronicleImage({
  image,
  onOpen,
  layoutMode = "flow",
}: Readonly<{
  image: WikiSectionImage;
  onOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
  layoutMode: Optional<LayoutMode>;
}>) {
  const imageClassName =
    layoutMode === "margin"
      ? "margin-image"
      : getImageClassName(image.size, image.justification || "left");

  const handleClick = useCallback(
    (_id: string, url: string) => onOpen?.(url, image),
    [onOpen, image],
  );

  return (
    <figure className={imageClassName}>
      <ImageDisplay
        imageId={image.imageId}
        alt={image.caption || "Chronicle illustration"}
        className="figure-image"
        onClick={onOpen ? handleClick : undefined}
        enableVersionCycling
        loadingContent={<div className="image-placeholder">Loading...</div>}
      />
      {image.caption && <figcaption className="image-caption">{image.caption}</figcaption>}
    </figure>
  );
}

/**
 * CoverHeroImage - Gradient-reveal hero for chronicle cover images.
 *
 * Shows the image at natural width up to a max-height cap.
 * Title overlays the bottom with a gradient fade (pointer-events: none
 * so clicks pass through to the image for lightbox opening).
 */
export function CoverHeroImage({
  imageId,
  title,
  onOpen,
}: Readonly<{
  imageId: string;
  title: string;
  onOpen: Optional<(imageUrl: string) => void>;
}>) {
  const handleClick = useCallback(
    (_id: string, url: string) => onOpen?.(url),
    [onOpen],
  );

  return (
    <div className="cover-hero">
      <ImageDisplay
        imageId={imageId}
        alt={title}
        className={["cover-hero-image", onOpen ? "cover-hero-image-clickable" : ""].filter(Boolean).join(" ")}
        onClick={onOpen ? handleClick : undefined}
        enableVersionCycling
      />
      <div className="cover-hero-overlay">
        <h1 className="chronicle-title-hero">{title}</h1>
      </div>
      <FrostEdge position="bottom" className="frost-edge-hero" />
    </div>
  );
}

/**
 * ChronicleGallery - Card grid of chronicle cover images
 */
export function ChronicleGallery({
  title,
  links,
  onNavigate,
}: Readonly<{
  title: string;
  links: WikiPage[];
  onNavigate: (id: string) => void;
}>) {
  const capped = links.slice(0, 20);

  return (
    <div className="gallery-section">
      <h2 className="section-heading">
        {title} ({links.length})
      </h2>
      <div className="gallery-grid">
        {capped.map((link) => (
          <GalleryCard key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </div>
      {links.length > 20 && <div className="more-text">...and {links.length - 20} more</div>}
    </div>
  );
}

function GalleryCard({ link, onNavigate }: Readonly<{
  link: WikiPage;
  onNavigate: (id: string) => void;
}>) {
  const handleClick = useCallback(() => onNavigate(link.id), [onNavigate, link.id]);
  return (
    <button className="gallery-card" onClick={handleClick}>
      <ImageDisplay
        imageId={link.content.coverImageId ?? null}
        alt={link.title}
        className="gallery-image"
        enableVersionCycling
        errorContent={<div className="gallery-placeholder">&#x1F4DC;</div>}
      />
      <div className="gallery-title" title={link.title}>
        {link.title}
      </div>
    </button>
  );
}
