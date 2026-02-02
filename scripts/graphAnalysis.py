#!/usr/bin/env python3
"""Graph analysis utilities for worldData knowledge graphs."""

import argparse
import json
import math
import random
import statistics
import sys
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import networkx as nx
    from networkx.algorithms.community import greedy_modularity_communities
    from networkx.algorithms.community.quality import modularity
except Exception:  # pragma: no cover - runtime dependency guard
    nx = None
    greedy_modularity_communities = None
    modularity = None


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def select_entity_kind(entity: Dict[str, Any], fallback: str = "unknown") -> str:
    for key in ("kind", "type", "entityType", "subtype"):
        value = entity.get(key)
        if value:
            return str(value)
    return fallback


def extract_entities(world_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    if "hardState" in world_data:
        return list(world_data["hardState"])
    if "entities" in world_data:
        return list(world_data["entities"])
    if "nodes" in world_data:
        return list(world_data["nodes"])
    raise ValueError("Could not find entities (hardState/entities/nodes) in world data.")


def derive_relationships_from_entities(entities: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    relationships: List[Dict[str, Any]] = []
    for entity in entities:
        src = entity.get("id")
        if not src:
            continue
        links = entity.get("links")
        if links:
            link_items = links.values() if isinstance(links, dict) else links
            for link in link_items:
                if isinstance(link, dict):
                    dst = link.get("dst") or link.get("target") or link.get("id")
                    kind = link.get("kind") or link.get("type") or link.get("relationship")
                    if src and dst and kind:
                        relationships.append({"src": src, "dst": dst, "kind": kind})
        for key, value in entity.items():
            if not key.startswith("relationship"):
                continue
            if value is None:
                continue
            dests = value if isinstance(value, list) else [value]
            for dst in dests:
                if isinstance(dst, dict):
                    dst = dst.get("id") or dst.get("dst") or dst.get("target")
                if src and dst:
                    relationships.append({"src": src, "dst": dst, "kind": key})
    return relationships


def extract_relationships(world_data: Dict[str, Any], entities: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
    relationships = world_data.get("relationships")
    if relationships:
        return list(relationships), "worldData.relationships"
    relationships = world_data.get("edges")
    if relationships:
        return list(relationships), "worldData.edges"
    derived = derive_relationships_from_entities(entities)
    if derived:
        return derived, "derived-from-entities"
    raise ValueError("Could not find relationships (relationships/edges) or derive from entities.")


def build_histogram(values: Sequence[int], bins: int) -> List[Dict[str, int]]:
    if bins <= 0 or not values:
        return []
    min_value = min(values)
    max_value = max(values)
    if min_value == max_value:
        return [{"min": min_value, "max": max_value, "count": len(values)}]
    span = max_value - min_value + 1
    bins = min(bins, span)
    counts = [0 for _ in range(bins)]
    for value in values:
        index = (value - min_value) * bins // span
        if index >= bins:
            index = bins - 1
        counts[index] += 1
    edges = [min_value + (idx * span) // bins for idx in range(bins)] + [max_value + 1]
    histogram = []
    for idx, count in enumerate(counts):
        start = edges[idx]
        end = edges[idx + 1] - 1
        histogram.append({"min": start, "max": end, "count": count})
    return histogram


def summarize_values(values: Sequence[int], histogram_bins: int) -> Dict[str, Any]:
    if not values:
        return {
            "count": 0,
            "min": None,
            "max": None,
            "mean": None,
            "std": None,
            "histogram": [],
        }
    mean = statistics.mean(values)
    std = statistics.pstdev(values) if len(values) > 1 else 0.0
    return {
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "mean": mean,
        "std": std,
        "histogram": build_histogram(values, histogram_bins),
    }


def summarize_numeric(values: Sequence[float]) -> Dict[str, Any]:
    if not values:
        return {
            "count": 0,
            "min": None,
            "max": None,
            "mean": None,
            "std": None,
        }
    mean = statistics.mean(values)
    std = statistics.pstdev(values) if len(values) > 1 else 0.0
    return {
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "mean": mean,
        "std": std,
    }


def add_edge_info(edge: Dict[str, Any], edges_by_src: Dict[str, List[Dict[str, Any]]], edges_by_dst: Dict[str, List[Dict[str, Any]]]) -> None:
    src = edge.get("src")
    dst = edge.get("dst")
    if not src or not dst:
        return
    edges_by_src[src].append(edge)
    edges_by_dst[dst].append(edge)


def compute_connection_metrics(
    entity_kind: Dict[str, str],
    relationships: Sequence[Dict[str, Any]],
    histogram_bins: int,
) -> Dict[str, Any]:
    edges_by_src: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    edges_by_dst: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for rel in relationships:
        add_edge_info(rel, edges_by_src, edges_by_dst)

    metrics_by_entity: Dict[str, Dict[str, int]] = {}
    for entity_id in entity_kind:
        out_edges = edges_by_src.get(entity_id, [])
        in_edges = edges_by_dst.get(entity_id, [])
        unique_destinations = {edge.get("dst") for edge in out_edges if edge.get("dst")}
        unique_sources = {edge.get("src") for edge in in_edges if edge.get("src")}
        neighbors = unique_destinations | unique_sources
        unique_relationships = {
            edge.get("kind")
            for edge in out_edges + in_edges
            if edge.get("kind") is not None
        }
        metrics_by_entity[entity_id] = {
            "unique_relationship_kinds": len(unique_relationships),
            "unique_destinations": len(unique_destinations),
            "unique_neighbors": len(neighbors),
        }

    overall = {
        "unique_relationship_kinds": summarize_values(
            [metrics["unique_relationship_kinds"] for metrics in metrics_by_entity.values()],
            histogram_bins,
        ),
        "unique_destinations": summarize_values(
            [metrics["unique_destinations"] for metrics in metrics_by_entity.values()],
            histogram_bins,
        ),
        "unique_neighbors": summarize_values(
            [metrics["unique_neighbors"] for metrics in metrics_by_entity.values()],
            histogram_bins,
        ),
    }

    by_type: Dict[str, Dict[str, Any]] = {}
    type_to_entities: Dict[str, List[str]] = defaultdict(list)
    for entity_id, kind in entity_kind.items():
        type_to_entities[kind].append(entity_id)

    for kind, ids in type_to_entities.items():
        by_type[kind] = {
            "unique_relationship_kinds": summarize_values(
                [metrics_by_entity[eid]["unique_relationship_kinds"] for eid in ids],
                histogram_bins,
            ),
            "unique_destinations": summarize_values(
                [metrics_by_entity[eid]["unique_destinations"] for eid in ids],
                histogram_bins,
            ),
            "unique_neighbors": summarize_values(
                [metrics_by_entity[eid]["unique_neighbors"] for eid in ids],
                histogram_bins,
            ),
        }

    return {
        "overall": overall,
        "by_entity_type": by_type,
    }


def weighted_avg_shortest_path(components: Iterable[Any]) -> Optional[float]:
    total_pairs = 0
    total_distance = 0.0
    for comp in components:
        node_count = comp.number_of_nodes()
        if node_count < 2:
            continue
        pairs = node_count * (node_count - 1) / 2
        avg_distance = nx.average_shortest_path_length(comp)
        total_pairs += pairs
        total_distance += avg_distance * pairs
    if total_pairs == 0:
        return None
    return total_distance / total_pairs


def compute_cluster_metrics(
    graph: Any,
    entity_kind: Dict[str, str],
    ignore_kinds: Sequence[str],
) -> Dict[str, Any]:
    if nx is None:
        raise RuntimeError("networkx is required to compute cluster metrics.")

    nodes_to_remove = [node for node, kind in entity_kind.items() if kind in ignore_kinds]
    cluster_graph = graph.copy()
    cluster_graph.remove_nodes_from(nodes_to_remove)

    components = [cluster_graph.subgraph(nodes).copy() for nodes in nx.connected_components(cluster_graph)]
    component_summaries = []
    for comp in components:
        node_count = comp.number_of_nodes()
        edge_count = comp.number_of_edges()
        if node_count > 1:
            avg_distance = nx.average_shortest_path_length(comp)
            diameter = nx.diameter(comp)
        else:
            avg_distance = None
            diameter = None
        component_summaries.append(
            {
                "node_count": node_count,
                "edge_count": edge_count,
                "density": nx.density(comp) if node_count > 1 else 0.0,
                "avg_shortest_path_length": avg_distance,
                "diameter": diameter,
                "avg_clustering": nx.average_clustering(comp) if node_count > 1 else 0.0,
            }
        )

    component_sizes = [comp.number_of_nodes() for comp in components]
    largest_component_size = max(component_sizes) if component_sizes else 0
    avg_distance_weighted = weighted_avg_shortest_path(components)

    community_summary: Dict[str, Any] = {
        "count": None,
        "sizes": [],
        "modularity": None,
        "inter_community_edge_ratio": None,
        "avg_community_density": None,
    }
    if cluster_graph.number_of_nodes() > 0 and cluster_graph.number_of_edges() > 0:
        if greedy_modularity_communities and modularity:
            communities = list(greedy_modularity_communities(cluster_graph))
            if communities:
                community_summary["count"] = len(communities)
                community_summary["sizes"] = [len(comm) for comm in communities]
                community_summary["modularity"] = modularity(cluster_graph, communities)
                node_to_comm: Dict[str, int] = {}
                for idx, comm in enumerate(communities):
                    for node in comm:
                        node_to_comm[node] = idx
                inter_edges = sum(
                    1
                    for u, v in cluster_graph.edges()
                    if node_to_comm.get(u) != node_to_comm.get(v)
                )
                total_edges = cluster_graph.number_of_edges()
                community_summary["inter_community_edge_ratio"] = (
                    inter_edges / total_edges if total_edges else None
                )
                densities = []
                for comm in communities:
                    sub = cluster_graph.subgraph(comm)
                    densities.append(nx.density(sub) if sub.number_of_nodes() > 1 else 0.0)
                community_summary["avg_community_density"] = (
                    statistics.mean(densities) if densities else None
                )

    return {
        "ignored_entity_kinds": list(ignore_kinds),
        "node_count": cluster_graph.number_of_nodes(),
        "edge_count": cluster_graph.number_of_edges(),
        "component_count": len(components),
        "component_sizes": component_sizes,
        "largest_component_size": largest_component_size,
        "avg_shortest_path_length_weighted": avg_distance_weighted,
        "avg_clustering": nx.average_clustering(cluster_graph) if cluster_graph.number_of_nodes() > 1 else 0.0,
        "global_efficiency": nx.global_efficiency(cluster_graph) if cluster_graph.number_of_nodes() > 1 else None,
        "components": component_summaries,
        "communities": community_summary,
    }


def update_running_stats(count: int, mean: float, m2: float, value: float) -> Tuple[int, float, float]:
    count += 1
    delta = value - mean
    mean += delta / count
    m2 += delta * (value - mean)
    return count, mean, m2


def compute_jaccard_summary(
    nodes: Sequence[str],
    neighbor_sets: Dict[str, set],
    max_pairs: int,
    seed: int,
) -> Dict[str, Any]:
    node_count = len(nodes)
    total_pairs = node_count * (node_count - 1) // 2
    if total_pairs == 0:
        return {
            "node_count": node_count,
            "pair_count": total_pairs,
            "sampled": False,
            "sample_size": 0,
            "avg_jaccard": None,
            "std_jaccard": None,
        }

    if max_pairs <= 0 or total_pairs <= max_pairs:
        pair_iter = (
            (nodes[i], nodes[j])
            for i in range(node_count)
            for j in range(i + 1, node_count)
        )
        sample_size = total_pairs
        sampled = False
    else:
        rng = random.Random(seed)
        sample_size = max_pairs
        sampled = True

        def pair_iter() -> Iterable[Tuple[str, str]]:
            for _ in range(sample_size):
                i = rng.randrange(node_count)
                j = rng.randrange(node_count - 1)
                if j >= i:
                    j += 1
                yield nodes[i], nodes[j]
        pair_iter = pair_iter()

    count = 0
    mean = 0.0
    m2 = 0.0
    for left, right in pair_iter:
        left_set = neighbor_sets[left]
        right_set = neighbor_sets[right]
        union_size = len(left_set | right_set)
        if union_size == 0:
            value = 0.0
        else:
            value = len(left_set & right_set) / union_size
        count, mean, m2 = update_running_stats(count, mean, m2, value)

    std = math.sqrt(m2 / count) if count > 0 else None
    return {
        "node_count": node_count,
        "pair_count": total_pairs,
        "sampled": sampled,
        "sample_size": sample_size,
        "avg_jaccard": mean if count > 0 else None,
        "std_jaccard": std,
    }


def compute_locality_metrics(
    graph: Any,
    entity_kind: Dict[str, str],
    ignore_kinds: Sequence[str],
    histogram_bins: int,
    overlap_max_pairs: int,
    overlap_seed: int,
) -> Dict[str, Any]:
    if nx is None:
        raise RuntimeError("networkx is required to compute locality metrics.")

    nodes_to_remove = [node for node, kind in entity_kind.items() if kind in ignore_kinds]
    locality_graph = graph.copy()
    locality_graph.remove_nodes_from(nodes_to_remove)
    nodes = list(locality_graph.nodes())
    node_count = len(nodes)

    if node_count == 0:
        return {
            "ignored_entity_kinds": list(ignore_kinds),
            "node_count": 0,
            "one_hop_size": summarize_values([], histogram_bins),
            "two_hop_size": summarize_values([], histogram_bins),
            "two_hop_coverage_ratio": summarize_numeric([]),
            "two_hop_growth_factor": summarize_numeric([]),
            "zero_one_hop_nodes": 0,
            "two_hop_overlap": {
                "node_count": 0,
                "pair_count": 0,
                "sampled": False,
                "sample_size": 0,
                "avg_jaccard": None,
                "std_jaccard": None,
            },
            "by_entity_type": {},
        }

    one_hop_sizes: Dict[str, int] = {}
    two_hop_sizes: Dict[str, int] = {}
    two_hop_sets: Dict[str, set] = {}
    for node in nodes:
        one_hop_sizes[node] = locality_graph.degree(node)
        lengths = nx.single_source_shortest_path_length(locality_graph, node, cutoff=2)
        two_hop = {neighbor for neighbor, dist in lengths.items() if 0 < dist <= 2}
        two_hop_sets[node] = two_hop
        two_hop_sizes[node] = len(two_hop)

    one_hop_list = [one_hop_sizes[node] for node in nodes]
    two_hop_list = [two_hop_sizes[node] for node in nodes]
    coverage_list = [
        two_hop_sizes[node] / (node_count - 1) if node_count > 1 else 0.0
        for node in nodes
    ]
    growth_list = [
        two_hop_sizes[node] / one_hop_sizes[node]
        for node in nodes
        if one_hop_sizes[node] > 0
    ]
    zero_one_hop_nodes = sum(1 for size in one_hop_list if size == 0)

    by_type_nodes: Dict[str, List[str]] = defaultdict(list)
    for node in nodes:
        by_type_nodes[entity_kind.get(node, "unknown")].append(node)

    by_type_metrics: Dict[str, Any] = {}
    for kind, kind_nodes in by_type_nodes.items():
        kind_one = [one_hop_sizes[node] for node in kind_nodes]
        kind_two = [two_hop_sizes[node] for node in kind_nodes]
        kind_coverage = [
            two_hop_sizes[node] / (node_count - 1) if node_count > 1 else 0.0
            for node in kind_nodes
        ]
        kind_growth = [
            two_hop_sizes[node] / one_hop_sizes[node]
            for node in kind_nodes
            if one_hop_sizes[node] > 0
        ]
        by_type_metrics[kind] = {
            "one_hop_size": summarize_values(kind_one, histogram_bins),
            "two_hop_size": summarize_values(kind_two, histogram_bins),
            "two_hop_coverage_ratio": summarize_numeric(kind_coverage),
            "two_hop_growth_factor": summarize_numeric(kind_growth),
            "zero_one_hop_nodes": sum(1 for size in kind_one if size == 0),
            "two_hop_overlap": compute_jaccard_summary(
                kind_nodes,
                two_hop_sets,
                overlap_max_pairs,
                overlap_seed,
            ),
        }

    return {
        "ignored_entity_kinds": list(ignore_kinds),
        "node_count": node_count,
        "one_hop_size": summarize_values(one_hop_list, histogram_bins),
        "two_hop_size": summarize_values(two_hop_list, histogram_bins),
        "two_hop_coverage_ratio": summarize_numeric(coverage_list),
        "two_hop_growth_factor": summarize_numeric(growth_list),
        "zero_one_hop_nodes": zero_one_hop_nodes,
        "two_hop_overlap": compute_jaccard_summary(
            nodes,
            two_hop_sets,
            overlap_max_pairs,
            overlap_seed,
        ),
        "by_entity_type": by_type_metrics,
    }


def format_stats(stats: Dict[str, Any]) -> str:
    if stats.get("count", 0) == 0:
        return "no data"
    def _format_value(value: Any) -> str:
        if isinstance(value, float):
            return f"{value:.3f}"
        return str(value)
    return (
        f"count={stats['count']} min={_format_value(stats['min'])} "
        f"max={_format_value(stats['max'])} mean={stats['mean']:.3f} std={stats['std']:.3f}"
    )


def render_histogram(histogram: Sequence[Dict[str, int]]) -> str:
    if not histogram:
        return ""
    parts = []
    for bucket in histogram:
        parts.append(f"{bucket['min']}-{bucket['max']}: {bucket['count']}")
    return " | ".join(parts)


def print_connection_report(name: str, summary: Dict[str, Any]) -> None:
    print(f"{name}: {format_stats(summary)}")
    hist = render_histogram(summary.get("histogram", []))
    if hist:
        print(f"  histogram: {hist}")


def format_overlap_summary(summary: Dict[str, Any]) -> str:
    if not summary or summary.get("pair_count", 0) == 0 or summary.get("avg_jaccard") is None:
        return "no data"
    avg = summary["avg_jaccard"]
    std = summary.get("std_jaccard")
    sample_size = summary.get("sample_size")
    pair_count = summary.get("pair_count")
    sampled = "sampled" if summary.get("sampled") else "full"
    std_text = f"{std:.3f}" if isinstance(std, float) else "n/a"
    return f"avg={avg:.3f} std={std_text} pairs={sample_size}/{pair_count} ({sampled})"


def print_overlap_report(name: str, summary: Dict[str, Any]) -> None:
    print(f"{name}: {format_overlap_summary(summary)}")


def build_graph(entity_kind: Dict[str, str], relationships: Sequence[Dict[str, Any]]) -> Any:
    if nx is None:
        raise RuntimeError("networkx is required to compute graph metrics.")
    graph = nx.Graph()
    for node, kind in entity_kind.items():
        graph.add_node(node, kind=kind)
    for rel in relationships:
        src = rel.get("src")
        dst = rel.get("dst")
        if not src or not dst:
            continue
        if src not in graph:
            graph.add_node(src, kind=entity_kind.get(src, "unknown"))
        if dst not in graph:
            graph.add_node(dst, kind=entity_kind.get(dst, "unknown"))
        graph.add_edge(src, dst, kind=rel.get("kind"))
    return graph


def build_entity_index(entities: Sequence[Dict[str, Any]], relationships: Sequence[Dict[str, Any]]) -> Dict[str, str]:
    entity_kind: Dict[str, str] = {}
    for entity in entities:
        entity_id = entity.get("id")
        if not entity_id:
            continue
        entity_kind[entity_id] = select_entity_kind(entity)
    for rel in relationships:
        for node in (rel.get("src"), rel.get("dst")):
            if node and node not in entity_kind:
                entity_kind[node] = "unknown"
    return entity_kind


def build_report(
    path: str,
    histogram_bins: int,
    ignore_kinds: Sequence[str],
    overlap_max_pairs: int,
    overlap_seed: int,
) -> Dict[str, Any]:
    raw = load_json(path)
    world_data = raw.get("worldData") if isinstance(raw, dict) and "worldData" in raw else raw
    if not isinstance(world_data, dict):
        raise ValueError("Unexpected world data format.")

    entities = extract_entities(world_data)
    relationships, relationships_source = extract_relationships(world_data, entities)
    entity_kind = build_entity_index(entities, relationships)

    graph = build_graph(entity_kind, relationships)
    connection_metrics = compute_connection_metrics(entity_kind, relationships, histogram_bins)
    cluster_metrics = compute_cluster_metrics(graph, entity_kind, ignore_kinds)
    locality_metrics = compute_locality_metrics(
        graph,
        entity_kind,
        ignore_kinds,
        histogram_bins,
        overlap_max_pairs,
        overlap_seed,
    )

    return {
        "input_path": path,
        "relationships_source": relationships_source,
        "entity_count": len(entity_kind),
        "relationship_count": len(relationships),
        "entity_type_counts": Counter(entity_kind.values()),
        "connection_metrics": connection_metrics,
        "cluster_metrics": cluster_metrics,
        "locality_metrics": locality_metrics,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze worldData knowledge graph metrics.")
    parser.add_argument("world_data", help="Path to worldData.json")
    parser.add_argument(
        "--histogram-bins",
        type=int,
        default=0,
        help="Number of histogram bins to include in metrics (0 disables).",
    )
    parser.add_argument(
        "--include-era",
        action="store_true",
        help="Include 'era' entities in cluster metrics.",
    )
    parser.add_argument(
        "--overlap-max-pairs",
        type=int,
        default=50000,
        help="Max node pairs to sample for 2-hop overlap (0 disables sampling limit).",
    )
    parser.add_argument(
        "--overlap-seed",
        type=int,
        default=13,
        help="Random seed for overlap sampling.",
    )
    parser.add_argument(
        "--json",
        dest="json_output",
        action="store_true",
        help="Output JSON report to stdout.",
    )
    parser.add_argument(
        "--json-out",
        default=None,
        help="Write JSON report to a file instead of stdout.",
    )
    args = parser.parse_args()

    if nx is None:
        print("Missing dependency: networkx. Install via `pip install networkx`.", file=sys.stderr)
        return 1

    ignore_kinds = [] if args.include_era else ["era"]
    report = build_report(
        args.world_data,
        args.histogram_bins,
        ignore_kinds,
        args.overlap_max_pairs,
        args.overlap_seed,
    )

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=True, default=str)
        return 0

    if args.json_output:
        json.dump(report, sys.stdout, indent=2, sort_keys=True, default=str)
        print()
        return 0

    print("Graph summary")
    print(f"- input: {report['input_path']}")
    print(f"- entities: {report['entity_count']}")
    print(f"- relationships: {report['relationship_count']} ({report['relationships_source']})")
    print(f"- entity types: {dict(report['entity_type_counts'])}")

    print("\nConnection metrics (overall)")
    overall = report["connection_metrics"]["overall"]
    print_connection_report("unique relationship kinds", overall["unique_relationship_kinds"])
    print_connection_report("unique destinations", overall["unique_destinations"])
    print_connection_report("unique neighbors", overall["unique_neighbors"])

    print("\nConnection metrics (by entity type)")
    for kind, metrics in sorted(report["connection_metrics"]["by_entity_type"].items()):
        print(f"- {kind}")
        print_connection_report("  unique relationship kinds", metrics["unique_relationship_kinds"])
        print_connection_report("  unique destinations", metrics["unique_destinations"])
        print_connection_report("  unique neighbors", metrics["unique_neighbors"])

    locality = report["locality_metrics"]
    print("\nLocality metrics (1-2 hops, era excluded)" if ignore_kinds else "\nLocality metrics (1-2 hops, era included)")
    print(f"- nodes: {locality['node_count']}")
    print(f"- zero 1-hop nodes: {locality['zero_one_hop_nodes']}")
    print_connection_report("1-hop neighborhood size", locality["one_hop_size"])
    print_connection_report("2-hop neighborhood size", locality["two_hop_size"])
    print_connection_report("2-hop coverage ratio", locality["two_hop_coverage_ratio"])
    print_connection_report("2-hop growth factor", locality["two_hop_growth_factor"])
    print_overlap_report("2-hop overlap (Jaccard)", locality["two_hop_overlap"])

    print("\nLocality metrics (by entity type)")
    for kind, metrics in sorted(locality["by_entity_type"].items()):
        print(f"- {kind}")
        print_connection_report("  1-hop neighborhood size", metrics["one_hop_size"])
        print_connection_report("  2-hop neighborhood size", metrics["two_hop_size"])
        print_connection_report("  2-hop coverage ratio", metrics["two_hop_coverage_ratio"])
        print_connection_report("  2-hop growth factor", metrics["two_hop_growth_factor"])
        print_overlap_report("  2-hop overlap (Jaccard)", metrics["two_hop_overlap"])

    cluster = report["cluster_metrics"]
    print("\nCluster metrics (era excluded)" if ignore_kinds else "\nCluster metrics (era included)")
    print(f"- nodes: {cluster['node_count']}")
    print(f"- edges: {cluster['edge_count']}")
    print(f"- components: {cluster['component_count']}")
    print(f"- component sizes: {cluster['component_sizes']}")
    print(f"- largest component size: {cluster['largest_component_size']}")
    print(
        f"- avg shortest path (weighted): {cluster['avg_shortest_path_length_weighted']}"
    )
    print(f"- avg clustering: {cluster['avg_clustering']}")
    print(f"- global efficiency: {cluster['global_efficiency']}")

    communities = cluster["communities"]
    if communities.get("count"):
        print("\nCommunity detection (greedy modularity)")
        print(f"- communities: {communities['count']}")
        print(f"- sizes: {communities['sizes']}")
        print(f"- modularity: {communities['modularity']}")
        print(f"- inter-community edge ratio: {communities['inter_community_edge_ratio']}")
        print(f"- avg community density: {communities['avg_community_density']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
