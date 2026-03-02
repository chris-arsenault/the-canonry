import type cytoscape from "cytoscape";
import type { EdgeSingular, StylesheetJsonBlock, LayoutOptions } from "cytoscape";
import type { EntityKindDefinition } from "@canonry/world-schema";

export interface CoseBilkentLayoutOptions extends LayoutOptions {
  name: "cose-bilkent";
  randomize: boolean;
  fit: boolean;
  idealEdgeLength: number;
  edgeLength: (edge: EdgeSingular) => number;
  nodeRepulsion: number;
  gravity: number;
  numIter: number;
  tile: boolean;
  tilingPaddingVertical: number;
  tilingPaddingHorizontal: number;
  animate: boolean;
  animationDuration: number;
}

const SUPPORTED_NODE_SHAPES = new Set<cytoscape.Css.NodeShape>([
  "ellipse", "diamond", "hexagon", "rectangle", "star", "triangle", "octagon",
]);

function toNodeShape(shape?: string): cytoscape.Css.NodeShape | undefined {
  if (!shape) return undefined;
  return SUPPORTED_NODE_SHAPES.has(shape as cytoscape.Css.NodeShape)
    ? (shape as cytoscape.Css.NodeShape)
    : undefined;
}

function generateEntityKindStyles(entityKinds: EntityKindDefinition[]): StylesheetJsonBlock[] {
  return entityKinds.map((ek) => {
    const shape = toNodeShape(ek.style?.shape);
    const style: cytoscape.Css.Node = {
      "background-color": (() => {
        if (!ek.style?.color) {
          throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
        }
        return ek.style.color;
      })(),
    };
    if (shape) { style.shape = shape; }
    return { selector: `node[kind="${ek.kind}"]`, style };
  });
}

/** Map Cytoscape shape to CSS class for legend */
export function shapeToLegendClass(shape: string): string {
  switch (shape) {
    case "ellipse": return "gv-shape-ellipse";
    case "diamond": return "gv-shape-diamond";
    case "hexagon": return "gv-shape-hexagon";
    case "rectangle": return "";
    case "star": return "gv-shape-star";
    case "triangle": return "gv-shape-triangle";
    case "octagon": return "gv-shape-octagon";
    default: return "";
  }
}

/** Full Cytoscape style array from entity kind schemas. */
export function getCytoscapeStyles(entityKindSchemas: EntityKindDefinition[]): StylesheetJsonBlock[] {
  const entityStyles = generateEntityKindStyles(entityKindSchemas);
  return [
    {
      selector: "node",
      style: {
        label: "data(name)", "text-valign": "center", "text-halign": "center",
        "font-size": "10px", color: "#fff", "text-outline-color": "#000", "text-outline-width": 2,
        width: "mapData(prominence, 0, 4, 20, 60)", height: "mapData(prominence, 0, 4, 20, 60)",
        "background-color": "#666",
      },
    },
    ...entityStyles,
    {
      selector: "node:selected",
      style: { "border-width": 4, "border-color": "#FFD700", "background-color": "#FFD700" },
    },
    {
      selector: "edge",
      style: {
        width: "mapData(strength, 0, 1, 0.5, 7)" as unknown as number,
        "line-color": "#888", "target-arrow-color": "#888", "target-arrow-shape": "triangle",
        "curve-style": "bezier", opacity: "mapData(strength, 0, 1, 0.2, 1)" as unknown as number,
        label: "data(label)", "font-size": "8px", color: "#999",
        "text-rotation": "autorotate", "text-margin-y": -10,
      },
    },
    {
      selector: "edge.highlighted",
      style: { "line-color": "#FFD700", "target-arrow-color": "#FFD700", width: 3 },
    },
    {
      selector: "edge.catalyzed",
      style: {
        "line-style": "dashed" as cytoscape.Css.LineStyle,
        "line-dash-pattern": [6, 3] as unknown as number[],
        "line-color": "#a78bfa", "target-arrow-color": "#a78bfa",
        width: "mapData(strength, 0, 1, 1, 4)" as unknown as number,
        opacity: 0.9,
      },
    },
  ];
}

/** Edge-length function: maps strength to spring length with non-linear scaling. */
function edgeLengthFn(edge: EdgeSingular): number {
  const strength = (edge.data("strength") as number | undefined) ?? 0.5;
  const invStrength = 1 - strength;
  return 25 + Math.pow(invStrength, 1.8) * 375;
}

/** Create Cose-Bilkent layout options. */
export function createLayoutOptions(opts: {
  randomize: boolean; fit: boolean; animate: boolean; numIter: number; animationDuration: number;
}): CoseBilkentLayoutOptions {
  return {
    name: "cose-bilkent",
    randomize: opts.randomize,
    fit: opts.fit,
    idealEdgeLength: 100,
    edgeLength: edgeLengthFn,
    nodeRepulsion: 100000,
    gravity: 0.25,
    numIter: opts.numIter,
    tile: true,
    tilingPaddingVertical: 10,
    tilingPaddingHorizontal: 10,
    animate: opts.animate,
    animationDuration: opts.animationDuration,
  };
}
