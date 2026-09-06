import type { StudioGraphNode, StudioGraphEdge } from "./studioTypes";

export type ReviewLevel = { id: string; name: string; reviewers: StudioGraphNode[] };
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export function reviewer(): StudioGraphNode {
  return { node_key: id("review"), node_type: "reviewer", display_name: "New reviewer", reviewer_email: "",
    visible_sections: [], allowed_actions: ["approve", "request_changes", "comment"],
    metadata: { required_inputs: [], sla_hours: 72, can_view_comments: false, return_target: "student", return_rule: null, student_visible_fields: [] } };
}
export function newLevel(): ReviewLevel {
  return { id: id("level"), name: "Review level", reviewers: [reviewer()] };
}

/** Import the supported old start/reviewer/join_all/end format once at the boundary. */
export function levelsFromGraph(nodes: StudioGraphNode[], edges: StudioGraphEdge[]): ReviewLevel[] {
  if (!nodes.length) return [];
  if (nodes.some((n) => !["start", "reviewer", "join_all", "end"].includes(n.node_type))) {
    throw new Error("This draft uses conditional or any-reviewer branches. Rebuild it as unanimous review levels.");
  }
  const keys = nodes.map((node) => node.node_key);
  if (new Set(keys).size !== keys.length) throw new Error("The imported workflow contains duplicate node IDs.");
  if (nodes.filter((node) => node.node_type === "start").length !== 1 || nodes.filter((node) => node.node_type === "end").length !== 1) {
    throw new Error("The imported workflow must contain exactly one start and one end node.");
  }
  if (edges.some((edge) => !keys.includes(edge.from_node_key) || !keys.includes(edge.to_node_key))) {
    throw new Error("The imported workflow contains an edge to an unknown node.");
  }
  const pending = new Set(keys);
  const depth = new Map<string, number>();
  while (pending.size) {
    let progressed = false;
    for (const node of nodes.filter((n) => pending.has(n.node_key))) {
      const parents = edges.filter((e) => e.to_node_key === node.node_key && !["request_changes", "reject"].includes(e.action || ""));
      if (node.node_type !== "start" && !parents.length) throw new Error(`The imported node "${node.node_key}" is disconnected from the start.`);
      if (parents.some((e) => !depth.has(e.from_node_key))) continue;
      depth.set(node.node_key, Math.max(0, ...parents.map((e) => depth.get(e.from_node_key)!)) + (node.node_type === "reviewer" ? 1 : 0));
      pending.delete(node.node_key); progressed = true;
    }
    if (!progressed) throw new Error("The forward review flow contains a cycle or an unknown node.");
  }
  const grouped = new Map<number, ReviewLevel>();
  for (const node of nodes.filter((n) => n.node_type === "reviewer")) {
    const d = depth.get(node.node_key)!;
    const levelId = String(node.metadata.level_id || `level_${d}`);
    const levelName = String(node.metadata.level_name || `Level ${d}`);
    const existing = grouped.get(d);
    if (existing && (existing.id !== levelId || existing.name !== levelName)) {
      throw new Error(`Reviewers at depth ${d} disagree about their level identity.`);
    }
    const level = existing || { id: levelId, name: levelName, reviewers: [] };
    level.reviewers.push(node); grouped.set(d, level);
  }
  return validateLevels([...grouped.entries()].sort(([a], [b]) => a - b).map(([, level]) => level));
}

export function validateLevels(levels: ReviewLevel[]): ReviewLevel[] {
  const validId = /^[A-Za-z0-9_-]+$/;
  const levelIds = levels.map((level) => level.id);
  const nodeIds = levels.flatMap((level) => level.reviewers.map((node) => node.node_key));
  if (levelIds.some((levelId) => !validId.test(levelId))) throw new Error("The imported workflow contains an invalid level ID.");
  if (new Set(levelIds).size !== levelIds.length) throw new Error("The imported workflow contains duplicate level IDs.");
  if (nodeIds.some((nodeId) => !validId.test(nodeId))) throw new Error("The imported workflow contains an invalid reviewer ID.");
  if (new Set(nodeIds).size !== nodeIds.length) throw new Error("The imported workflow contains duplicate reviewer IDs.");
  const connectorIds = new Set(["start", "end", ...levelIds.map((levelId) => `join_${levelId}`)]);
  if (nodeIds.some((nodeId) => connectorIds.has(nodeId))) throw new Error("A reviewer ID conflicts with a generated connector ID.");
  if (levels.some((level) => level.reviewers.some((node) => node.node_type !== "reviewer"))) {
    throw new Error("Review levels may contain only reviewer nodes.");
  }
  return levels;
}

/** Forward edges are derived. They are never independently editable. */
export function compileLevels(levels: ReviewLevel[]) {
  validateLevels(levels);
  const nodes: StudioGraphNode[] = [{ node_key: "start", node_type: "start", visible_sections: [], allowed_actions: [], metadata: { required_inputs: [] } }];
  const edges: StudioGraphEdge[] = [];
  let previous = "start";
  for (const level of levels) {
    const join = `join_${level.id}`;
    nodes.push(...level.reviewers.map((n) => ({ ...n, metadata: { ...n.metadata, level_id: level.id, level_name: level.name } })));
    for (const n of level.reviewers) {
      edges.push({ from_node_key: previous, to_node_key: n.node_key, action: "always" });
      edges.push({ from_node_key: n.node_key, to_node_key: join, action: "approve" });
    }
    nodes.push({ node_key: join, node_type: "join_all", visible_sections: [], allowed_actions: [], metadata: { required_inputs: [] } });
    previous = join;
  }
  nodes.push({ node_key: "end", node_type: "end", visible_sections: [], allowed_actions: [], metadata: { required_inputs: [] } });
  edges.push({ from_node_key: previous, to_node_key: "end", action: "always" });
  return { levels, nodes, edges };
}
