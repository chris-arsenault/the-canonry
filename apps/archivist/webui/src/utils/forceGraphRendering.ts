import * as THREE from "three";

/** Minimal node shape for 3D rendering — satisfied by both graph view node types. */
export interface RenderableNode {
  val: number;
  color: string;
  name: string;
  kind: string;
}

/** Create the main mesh for a node and add it to the group. */
export function addNodeMesh(group: THREE.Group, node: RenderableNode, isEra: boolean, isSelected: boolean): void {
  const geometry = isEra
    ? new THREE.BoxGeometry(node.val * 3, node.val * 3, node.val * 3)
    : new THREE.SphereGeometry(node.val * 2, 16, 16);
  const material = new THREE.MeshLambertMaterial({
    color: node.color,
    transparent: true,
    opacity: isSelected ? 1 : 0.9,
  });
  group.add(new THREE.Mesh(geometry, material));
}

/** Add a golden glow mesh around a selected node. */
export function addSelectionGlow(group: THREE.Group, node: RenderableNode, isEra: boolean): void {
  const glowGeometry = isEra
    ? new THREE.BoxGeometry(node.val * 4, node.val * 4, node.val * 4)
    : new THREE.SphereGeometry(node.val * 2.5, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: "#FFD700",
    transparent: true,
    opacity: 0.3,
  });
  group.add(new THREE.Mesh(glowGeometry, glowMaterial));
}

/** Create a text label sprite and add it to the group. */
export function addTextSprite(group: THREE.Group, node: RenderableNode, isEra: boolean): void {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = isEra ? "rgba(50, 40, 0, 0.8)" : "rgba(0, 0, 0, 0.7)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = isEra ? "Bold 24px Arial" : "Bold 20px Arial";
  context.fillStyle = isEra ? "#FFD700" : "white";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(node.name, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(isEra ? 30 : 20, isEra ? 7.5 : 5, 1);
  sprite.position.set(0, node.val * (isEra ? 3 : 2) + 5, 0);
  group.add(sprite);
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export const webglAvailable = detectWebGL();
