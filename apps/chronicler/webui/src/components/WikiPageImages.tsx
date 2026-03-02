/**
 * WikiPageImages - Image components for wiki page rendering
 *
 * Provides inline chronicle images, cover hero banners, and chronicle galleries.
 */

import React, { useState, useMemo, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { WikiPage, WikiSectionImage } from "../types/world.ts";
import type { LayoutMode } from "./WikiPageLayout.ts";
import { getImageClassName } from "./WikiPageLayout.ts";
import { useImageUrl, useImageUrls } from "@the-canonry/image-store";
import { FrostEdge } from "./Ornaments.tsx";
import styles from "./WikiPage.module.css";

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
  const { url: imageUrl, loading } = useImageUrl(image.imageId);
  const [error, setError] = useState(false);

  const handleError = useCallback(() => setError(true), []);
  const handleClick = useCallback(() => {
    if (imageUrl) onOpen?.(imageUrl, image);
  }, [onOpen, imageUrl, image]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") handleClick();
  }, [handleClick]);

  const imageClassName =
    layoutMode === "margin"
      ? styles.marginImage
      : getImageClassName(image.size, image.justification || "left");

  if (loading) {
    return (
      <figure className={imageClassName}>
        <div className={styles.imagePlaceholder}>Loading...</div>
      </figure>
    );
  }

  if (error || !imageUrl) {
    return null; // Don't render if image not found
  }

  return (
    <figure className={imageClassName}>
      <button
        type="button"
        className={styles.figureImageBtn}
        onClick={handleClick}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <img
          src={imageUrl}
          alt={image.caption || "Chronicle illustration"}
          className={styles.figureImage}
          onError={handleError}
        />
      </button>
      {image.caption && <figcaption className={styles.imageCaption}>{image.caption}</figcaption>}
    </figure>
  );
}

/**
 * CoverHeroImage - Full-width hero banner for chronicle cover images
 * Displays with a fade-to-background gradient overlay and title
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
  const { url: imageUrl, loading } = useImageUrl(imageId);
  const [error, setError] = useState(false);

  const handleError = useCallback(() => setError(true), []);
  const handleClick = useCallback(() => {
    if (imageUrl) onOpen?.(imageUrl);
  }, [onOpen, imageUrl]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") handleClick();
  }, [handleClick]);

  if (loading || error || !imageUrl) return null;

  return (
    <div className={styles.coverHero}>
      <button
        type="button"
        className={styles.coverHeroImageBtn}
        onClick={handleClick}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <img
          src={imageUrl}
          alt={title}
          className={[styles.coverHeroImage, onOpen ? styles.coverHeroImageClickable : ""].filter(Boolean).join(" ")}
          onError={handleError}
        />
      </button>
      <div className={styles.coverHeroOverlay}>
        <h1 className={styles.chronicleTitleHero}>{title}</h1>
      </div>
      <FrostEdge position="bottom" className={styles.frostEdgeHero} />
    </div>
  );
}

/**
 * ChronicleGallery - Card grid of chronicle cover images
 * Replaces the old text-only chronicle list with a visual gallery.
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
  const imageIds = useMemo(
    () => links.slice(0, 20).map((l) => l.content.coverImageId ?? null),
    [links],
  );
  const { urls } = useImageUrls(imageIds);
  const capped = links.slice(0, 20);

  return (
    <div className={styles.gallerySection}>
      <h2 className={styles.sectionHeading}>
        {title} ({links.length})
      </h2>
      <div className={styles.galleryGrid}>
        {capped.map((link) => {
          const coverUrl = link.content.coverImageId ? urls.get(link.content.coverImageId) : null;
          return (
            <GalleryCard key={link.id} link={link} coverUrl={coverUrl ?? undefined} onNavigate={onNavigate} />
          );
        })}
      </div>
      {links.length > 20 && <div className={styles.moreText}>...and {links.length - 20} more</div>}
    </div>
  );
}

function GalleryCard({ link, coverUrl, onNavigate }: Readonly<{
  link: WikiPage;
  coverUrl: Optional<string>;
  onNavigate: (id: string) => void;
}>) {
  const handleClick = useCallback(() => onNavigate(link.id), [onNavigate, link.id]);
  return (
    <button
      className={styles.galleryCard}
      onClick={handleClick}
    >
      {coverUrl ? (
        <img src={coverUrl} alt={link.title} className={styles.galleryImage} />
      ) : (
        <div className={styles.galleryPlaceholder}>&#x1F4DC;</div>
      )}
      <div className={styles.galleryTitle} title={link.title}>
        {link.title}
      </div>
    </button>
  );
}
