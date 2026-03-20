# diagnosis_agent.py
# AI-Native Institutional Workflow Builder — Diagnosis Agent
# Single-file implementation with all fixes applied
# LLM: Gemini (default) or AWS Bedrock (swap via env var LLM_PROVIDER=bedrock)

import json
import os
import copy
from typing import Optional

# ── LLM Provider Abstraction ─────────────────────────────────────────────────
# Set LLM_PROVIDER=bedrock in environment to use AWS Bedrock
# Default: Gemini (Google)
# Set GEMINI_API_KEY or AWS credentials accordingly

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

# FIX 1: MODEL_GEMINI was defined as "models/gemini-1.5-flash" but the URL
# hardcoded "gemini-2.5-flash" — the constant was dead code and the names
# conflicted. Now MODEL_GEMINI is the single source of truth used in the URL.
MODEL_GEMINI = "gemini-2.5-flash"

MODEL_BEDROCK = "anthropic.claude-3-5-sonnet-20241022-v2:0"


def call_llm(system_prompt: str, user_message: str, max_tokens: int = 1024) -> str:
    """
    Unified LLM caller. Swap provider via LLM_PROVIDER env var.
    Returns raw string response from model.
    """
    if LLM_PROVIDER == "bedrock":
        return _call_bedrock(system_prompt, user_message, max_tokens)
    return _call_gemini(system_prompt, user_message, max_tokens)


# Gemini (Google) API call
def _call_gemini(system_prompt: str, user_message: str, max_tokens: int) -> str:
    import requests
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")

    # FIX 2: Use MODEL_GEMINI constant in the URL instead of a hardcoded string.
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{MODEL_GEMINI}:generateContent?key={api_key}"
    )
    headers = {"Content-Type": "application/json"}

    # FIX 3: Use the dedicated systemInstruction field instead of prepending
    # "SYSTEM: ..." inline in the user content.  Gemini v1beta honours
    # systemInstruction properly, which significantly improves instruction
    # following — especially for JSON-only prompts like PROMPT_B.
    data = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_message}]
            }
        ],
        "generationConfig": {"maxOutputTokens": max_tokens}
    }

    response = requests.post(url, headers=headers, json=data)
    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini API error: {response.status_code} {response.text}"
        )
    result = response.json()
    try:
        return result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        raise RuntimeError(f"Unexpected Gemini API response: {result}") from e


def _call_bedrock(system_prompt: str, user_message: str, max_tokens: int) -> str:
    import boto3
    client = boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "us-east-1")
    )
    response = client.converse(
        modelId=MODEL_BEDROCK,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
        inferenceConfig={"maxTokens": max_tokens}
    )
    return response["output"]["message"]["content"][0]["text"]


def parse_json_response(response: str) -> dict:
    """
    Safely parse JSON from LLM response.
    Strips markdown fences if present — LLMs frequently add them
    even when instructed not to.
    """
    cleaned = response.strip()

    # FIX 4: The original split("```") breaks when the response contains
    # multiple fence blocks (e.g. explanation + JSON).  Use a targeted strip
    # of the outermost fence pair instead.
    if cleaned.startswith("```"):
        # Drop the opening fence line (```json or just ```)
        cleaned = cleaned[3:]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        # Drop the closing fence if present
        if "```" in cleaned:
            cleaned = cleaned[:cleaned.rfind("```")]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # ── Truncation recovery ───────────────────────────────────────────
        # Two observed failure modes:
        #   A) Truncated mid-string: `"field": "applicant_`
        #      close the string, then close open objects
        #   B) Truncated mid-number or mid-key (missing comma delimiter)
        #      no closing brace, no open string — walk back to last
        #      complete key-value pair and close there
        #
        # Strategy (tried in order, first success wins):
        #   1. suffixes that close an open string + object(s)
        #   2. walk backwards char-by-char to last valid JSON prefix

        recovered = None

        # Step 1 — try appending closing sequences.
        # Order matters: try more closing braces before fewer, and try
        # closing an open string before plain closes.
        # Covers both:
        #   A) mid-string: `"field": "val`  → need `"` then close braces
        #   B) mid-number: `"global": 0.8`  → need `}}` (no open string)
        close_suffixes = []
        for n in range(5, 0, -1):
            braces = "}" * n
            close_suffixes.append('"' + braces)  # close open string + objects
            close_suffixes.append(braces)          # plain object close

        for suffix in close_suffixes:
            candidate = cleaned + suffix
            # Try parsing from last } backwards in case of extra chars
            last_brace = candidate.rfind("}")
            if last_brace != -1:
                try:
                    recovered = json.loads(candidate[: last_brace + 1])
                    break
                except Exception:
                    pass

        if recovered is not None:
            return recovered

        raise ValueError(
            f"LLM returned invalid JSON.\nRaw response:\n{response}\nError: {e}"
        )


# ── Constants ────────────────────────────────────────────────────────────────

REQUIRED_FIELDS = [
    "stages",
    "stakeholder_roles",
    "visibility_rules",
    "sla_days",
    "escalation_target",
    "applicant_fields",
]

CONFIDENCE_THRESHOLD = 0.85
MIN_SECTION_CONFIDENCE = 0.75
MAX_TURNS = 20
STUCK_TURN_WINDOW = 5


# ── Tool 1: WorkflowSchemaTool ───────────────────────────────────────────────

class WorkflowSchemaTool:
    """
    Maintains versioned workflow schema with deep merge and snapshot rollback.

    Key design decisions:
    - Deep merge preserves nested fields across updates (shallow merge destroys them)
    - Snapshot per version enables reliable rollback without delta replay
    - List items merged by 'id' field when present
    """

    def __init__(self):
        self.version: int = 0
        self.schema: dict = {}
        self.changelog: list = []

    def update(self, delta: dict, reason: str) -> dict:
        """
        Deep-merge delta into schema, store snapshot, increment version.
        Returns updated version number and full schema.
        """
        self.version += 1
        self._deep_merge(self.schema, delta)
        self.changelog.append({
            "version": self.version,
            "reason": reason,
            "delta": delta,
            "snapshot": copy.deepcopy(self.schema),
        })
        return {"version": self.version, "schema": self.schema}

    def diff(self, since_version: int) -> list:
        """Return all changelog entries after since_version."""
        return [e for e in self.changelog if e["version"] > since_version]

    def rollback(self, target_version: int) -> dict:
        """
        Restore schema to exact state at target_version using stored snapshot.
        Raises ValueError if target_version not found.
        """
        for entry in self.changelog:
            if entry["version"] == target_version:
                self.schema = copy.deepcopy(entry["snapshot"])
                self.version = target_version
                return self.schema
        raise ValueError(
            f"Version {target_version} not in changelog. "
            f"Available: {[e['version'] for e in self.changelog]}"
        )

    def _deep_merge(self, base: dict, delta: dict) -> None:
        """
        Recursively merge delta into base in-place.
        Lists are merged by 'id' field when present.
        """
        for key, value in delta.items():
            if key in base:
                if isinstance(base[key], dict) and isinstance(value, dict):
                    self._deep_merge(base[key], value)
                elif isinstance(base[key], list) and isinstance(value, list):
                    self._merge_lists(base[key], value)
                else:
                    base[key] = value
            else:
                base[key] = value

    def _merge_lists(self, base_list: list, delta_list: list) -> None:
        """
        Merge two lists. Items with matching 'id' fields are updated in place.
        New items are appended.

        FIX 5: Rebuild the id→index map inside the loop so that items
        appended during earlier iterations are visible to subsequent ones.
        The original built the map once before the loop, making it stale
        the moment any append occurred.
        """
        for item in delta_list:
            if not isinstance(item, dict):
                base_list.append(item)
                continue
            # Rebuild map each iteration to reflect any appended items
            id_to_index = {
                existing.get("id"): i
                for i, existing in enumerate(base_list)
                if isinstance(existing, dict) and "id" in existing
            }
            item_id = item.get("id")
            if item_id is not None and item_id in id_to_index:
                idx = id_to_index[item_id]
                if isinstance(base_list[idx], dict):
                    self._deep_merge(base_list[idx], item)
                else:
                    base_list[idx] = item
            else:
                base_list.append(item)


# ── Tool 2: PolicyValidationTool ────────────────────────────────────────────

class PolicyValidationTool:
    """
    Validates schema against required fields and internal consistency rules.
    """

    def validate(self, schema: dict) -> dict:
        missing = self._check_required_fields(schema)
        conflicts = self._check_consistency(schema)
        return {
            "missing_fields": missing,
            "conflicts": conflicts,
            "valid": len(missing) == 0 and len(conflicts) == 0,
        }

    def _check_required_fields(self, schema: dict) -> list:
        return [f for f in REQUIRED_FIELDS if f not in schema or not schema[f]]

    def _check_consistency(self, schema: dict) -> list:
        conflicts = []
        stages = schema.get("stages", [])
        visibility = schema.get("visibility_rules", {})
        stakeholders = schema.get("stakeholder_roles", {})
        sla = schema.get("sla_days", {})
        escalation = schema.get("escalation_target", {})

        for stage in stages:
            sid = stage.get("id")
            if not sid:
                conflicts.append("A stage is missing an 'id' field")
                continue

            if sid not in visibility:
                conflicts.append(f"Stage '{sid}' has no visibility_rule defined")

            if sid not in stakeholders:
                conflicts.append(f"Stage '{sid}' has no stakeholder_role assigned")

            stage_sla = sla.get(sid) if isinstance(sla, dict) else sla
            if stage_sla is not None:
                try:
                    if float(stage_sla) <= 0:
                        conflicts.append(
                            f"Stage '{sid}' has non-positive sla_days: {stage_sla}"
                        )
                except (TypeError, ValueError):
                    conflicts.append(
                        f"Stage '{sid}' sla_days is not a number: {stage_sla}"
                    )

        if escalation and stakeholders:
            role_values = (
                set(stakeholders.values()) if isinstance(stakeholders, dict) else set()
            )
            esc_roles = (
                escalation.values()
                if isinstance(escalation, dict)
                else [escalation]
            )
            for role in esc_roles:
                if role and role_values and role not in role_values:
                    conflicts.append(
                        f"Escalation target '{role}' is not a defined stakeholder role. "
                        f"Known roles: {sorted(role_values)}"
                    )

        return conflicts


# ── Tool 3: StuckStateTool ───────────────────────────────────────────────────

class StuckStateTool:
    """
    Detects when the diagnosis session has stalled.
    """

    def __init__(self):
        self.confidence_history: list = []

    def check(
        self,
        turn_count: int,
        confidence: float,
        unresolved_gaps: list,
    ) -> dict:
        self.confidence_history.append(confidence)

        # FIX 6: Only keep the last STUCK_TURN_WINDOW values to avoid
        # unbounded memory growth over long sessions.
        if len(self.confidence_history) > STUCK_TURN_WINDOW * 2:
            self.confidence_history = self.confidence_history[-STUCK_TURN_WINDOW:]

        recent = self.confidence_history[-STUCK_TURN_WINDOW:]

        no_progress = (
            len(recent) >= STUCK_TURN_WINDOW
            and (max(recent) - min(recent)) < 0.05
        )
        hard_limit = turn_count >= MAX_TURNS

        stuck = no_progress or hard_limit
        reason = None
        if hard_limit:
            reason = "turn_limit"
        elif no_progress:
            reason = "no_progress"

        return {
            "stuck": stuck,
            "reason": reason,
            "top_gaps": unresolved_gaps[:3],
            "confidence_history": list(recent),
        }


# ── Tool 4: RoutingTool ──────────────────────────────────────────────────────

class RoutingTool:
    """
    Deterministic next-action router. No LLM involved.
    """

    def route(
        self,
        schema_state: dict,
        confidence: dict,
        validation: dict,
        stuck: dict,
        turn_count: int,
    ) -> dict:

        if stuck["stuck"]:
            return {
                "next": "surface_gaps",
                "reason": stuck["reason"],
                "gaps": stuck["top_gaps"],
            }

        if not validation["valid"]:
            targets = validation["missing_fields"] + validation["conflicts"]
            return {
                "next": "ask",
                "reason": "validation_failure",
                "targets": targets,
            }

        global_conf = confidence.get("global", 0.0)
        if global_conf < CONFIDENCE_THRESHOLD:
            return {
                "next": "ask",
                "reason": (
                    f"global_confidence_{global_conf:.2f}_below_{CONFIDENCE_THRESHOLD}"
                ),
            }

        for section, score in confidence.items():
            if section == "global":
                continue
            if isinstance(score, (int, float)) and score < MIN_SECTION_CONFIDENCE:
                return {
                    "next": "ask",
                    "reason": (
                        f"section_{section}_confidence_{score:.2f}_below_floor"
                    ),
                    "targets": [section],
                }

        return {
            "next": "generation_agent",
            "reason": "schema_complete_and_validated",
        }


# ── Tool 5: AuditLogTool ─────────────────────────────────────────────────────

class AuditLogTool:
    """
    Append-only audit log for every agent action.
    """

    def __init__(self):
        self._log: list = []

    def record(self, event_type: str, metadata: dict) -> int:
        entry = {
            "id": len(self._log) + 1,
            "event_type": event_type,
            "metadata": copy.deepcopy(metadata),
        }
        self._log.append(entry)
        return entry["id"]

    def export(self) -> list:
        return copy.deepcopy(self._log)

    def export_by_type(self, event_type: str) -> list:
        return [e for e in self._log if e["event_type"] == event_type]


# ── Tool 6: PrismCompatibilityTool (Stub) ───────────────────────────────────

class PrismCompatibilityTool:
    """
    STUB — to be implemented once PRISM runtime contracts are defined.
    """

    def validate(self, schema: dict) -> dict:
        warnings = [
            "PrismCompatibilityTool is a stub — PRISM contracts not yet defined.",
            "Implement _validate_roles(), _validate_stages(), _validate_api() "
            "once PRISM runtime is available.",
        ]
        return {"compatible": True, "warnings": warnings, "conflicts": []}

    def _validate_roles(self, schema: dict) -> list:
        return []

    def _validate_stages(self, schema: dict) -> list:
        return []

    def _validate_api(self, schema: dict) -> list:
        return []


# ── Prompts ──────────────────────────────────────────────────────────────────

PROMPT_A_SYSTEM = """\
You are a workflow diagnosis expert helping a department manager
describe their institutional approval process.

Your job: given the current partial workflow schema and its confidence gaps,
generate exactly ONE high-information question that will most efficiently
fill the most critical unknown.

Rules:
- Ask about the highest-impact missing field first
- Never ask about something already in the schema
- Ask in plain language — the manager is not technical
- One question only — never multiple questions in one turn

Output JSON only, no markdown fences:
{
  "question": "plain language question for the manager",
  "targets_field": "which REQUIRED_FIELD this addresses",
  "rationale": "why this is the highest-priority gap right now"
}"""

# FIX 7 (critical): The original PROMPT_B only instructed the model to return
# a stages array. _infer() reads confidence, unresolved_gaps, and assumptions
# from the parsed response — fields that were never in the prompt, so they
# always came back as None/missing. As a result:
#   • self.confidence stayed {global: 0.0} forever
#   • RoutingTool always routed to "ask", never to "generation_agent"
#   • The agent looped until MAX_TURNS regardless of how much info was given
#
# The fixed prompt instructs the model to return ALL four top-level keys:
# schema_delta, confidence, unresolved_gaps, and assumptions.
PROMPT_B_SYSTEM = """\
You are a workflow schema extraction engine.

Given a manager's answer and the current partial schema, extract structured
information and return a single JSON object.

Output JSON only — no markdown, no explanations, no code blocks.

Return exactly this shape:
{
  "schema_delta": {
    "stages": [
      { "id": "string", "name": "string", "actor": "string", "description": "string (max 20 words)" }
    ],
    "stakeholder_roles": { "<stage_id>": "<role_name>" },
    "visibility_rules":  { "<stage_id>": "<what this role can see>" },
    "sla_days":          { "<stage_id>": <positive integer> },
    "escalation_target": { "<stage_id>": "<supervisor role>" },
    "applicant_fields":  ["field1", "field2"]
  },
  "confidence": {
    "global": <0.0-1.0>,
    "stages": <0.0-1.0>,
    "stakeholder_roles": <0.0-1.0>,
    "visibility_rules": <0.0-1.0>,
    "sla_days": <0.0-1.0>,
    "escalation_target": <0.0-1.0>,
    "applicant_fields": <0.0-1.0>
  },
  "unresolved_gaps": ["description of gap 1", "description of gap 2"],
  "assumptions": ["assumption made 1", "assumption made 2"]
}

Rules:
- Only include fields for which you have evidence from the conversation.
  Omit sub-fields you have no data for rather than guessing.
- confidence.global is your overall certainty that the schema is complete
  and correct. Raise it as more fields are confirmed. Start at 0.1 and
  increase toward 1.0 as gaps close.
- unresolved_gaps lists the most important things still unknown.
- assumptions lists inferences you made that the manager has not confirmed.
- Every stage object MUST include an "id" field (snake_case, e.g. "ug_review").
- schema_delta may be an empty object {} if nothing new was learned.
"""

PROMPT_C_SYSTEM = """\
You are a workflow confirmation assistant.

Summarize the current workflow schema in plain language so the
department manager can confirm or correct your understanding.

Rules:
- Maximum 5 bullet points
- Plain language only — no technical terms
- End with: "Is this correct, or would you like to change anything?"
- Do not output JSON — this is a human-readable message"""

PROMPT_D_SYSTEM = """\
You are a workflow implementation planner.

Given a finalized workflow schema, produce a phased implementation plan
covering database tables, API endpoints, UI screens, and test cases.

Output JSON only, no markdown fences:
{
  "phases": [
    {
      "phase": 1,
      "name": "Database Layer",
      "tasks": [],
      "tables": [],
      "estimated_hours": 0
    },
    {
      "phase": 2,
      "name": "API Layer",
      "tasks": [],
      "endpoints": [],
      "estimated_hours": 0
    },
    {
      "phase": 3,
      "name": "UI Layer",
      "tasks": [],
      "screens": [],
      "estimated_hours": 0
    },
    {
      "phase": 4,
      "name": "Testing",
      "tasks": [],
      "test_cases": [],
      "estimated_hours": 0
    }
  ],
  "total_estimated_hours": 0,
  "risks": [],
  "assumptions": []
}"""


# ── Diagnosis Agent ──────────────────────────────────────────────────────────

class DiagnosisAgent:
    """
    Core diagnosis agent implementing the ASK → INFER → CONFIRM → EXECUTE loop.
    """

    def __init__(self):
        self.schema_tool      = WorkflowSchemaTool()
        self.policy_tool      = PolicyValidationTool()
        self.stuck_tool       = StuckStateTool()
        self.routing_tool     = RoutingTool()
        self.audit            = AuditLogTool()
        self.prism_tool       = PrismCompatibilityTool()

        self.turn_count          : int  = 0
        self.confidence          : dict = {"global": 0.0}
        self.unresolved_gaps     : list = []
        self.conversation_history: list = []

    # ── Public API ───────────────────────────────────────────────────────────

    def start(self) -> str:
        opening = (
            "Hi! I'm going to help you set up your workflow. "
            "Let's start simple — can you describe the process "
            "you want to automate? For example: who submits something, "
            "who needs to review or approve it, and what happens at the end?"
        )
        self.audit.record("session_start", {"opening": opening})
        return opening

    def run_turn(self, manager_input: str) -> dict:
        """
        Process one turn of manager input through the full loop.
        """
        self.turn_count += 1
        self.conversation_history.append({
            "turn": self.turn_count,
            "role": "manager",
            "content": manager_input,
        })
        self.audit.record("manager_input", {
            "turn": self.turn_count,
            "content": manager_input,
        })

        # Step 1 — INFER
        self._infer(manager_input)

        # Step 2 — VALIDATE
        validation = self.policy_tool.validate(self.schema_tool.schema)
        self.audit.record("validation", {
            "turn": self.turn_count,
            "result": validation,
        })

        # Step 3 — STUCK CHECK
        stuck = self.stuck_tool.check(
            self.turn_count,
            self.confidence.get("global", 0.0),
            self.unresolved_gaps,
        )
        self.audit.record("stuck_check", {
            "turn": self.turn_count,
            "result": stuck,
        })

        # Step 4 — ROUTE
        route = self.routing_tool.route(
            self.schema_tool.schema,
            self.confidence,
            validation,
            stuck,
            self.turn_count,
        )
        self.audit.record("routing_decision", {
            "turn": self.turn_count,
            "route": route,
        })

        # FIX 8: Skip the confirmation summary when in stuck / surface_gaps
        # state — showing a "here's what I know" summary while simultaneously
        # flagging that we're stuck is confusing for the manager.
        confirmation = None
        if route["next"] != "surface_gaps":
            if self.turn_count % 3 == 0 or route["next"] == "generation_agent":
                confirmation = self._confirm()

        # Step 6 — ACT
        next_question = None

        if route["next"] == "ask":
            next_question = self._ask(manager_input)

        elif route["next"] == "surface_gaps":
            gaps = stuck["top_gaps"]
            gap_list = "\n".join(f"  - {g}" for g in gaps)
            next_question = (
                "I'm having trouble fully understanding a few things. "
                f"Could you clarify each of these directly?\n{gap_list}"
            )
            self.audit.record("surface_gaps", {
                "turn": self.turn_count,
                "gaps": gaps,
            })

        elif route["next"] == "generation_agent":
            prism_result = self.prism_tool.validate(self.schema_tool.schema)
            self.audit.record("prism_check", prism_result)

        return {
            "turn"          : self.turn_count,
            "route"         : route,
            "next_question" : next_question,
            "confirmation"  : confirmation,
            "confidence"    : self.confidence,
            "schema_version": self.schema_tool.version,
            "done"          : route["next"] == "generation_agent",
            "audit_snapshot": self.audit.export(),
        }

    def get_final_schema(self) -> dict:
        return copy.deepcopy(self.schema_tool.schema)

    def get_implementation_plan(self) -> dict:
        schema = self.schema_tool.schema
        response = call_llm(
            PROMPT_D_SYSTEM,
            json.dumps({"schema": schema}),
            max_tokens=2048,
        )
        plan = parse_json_response(response)
        self.audit.record("implementation_plan", plan)
        return plan

    # ── Private Methods ──────────────────────────────────────────────────────

    def _ask(self, manager_input: Optional[str]) -> str:
        """Generate next high-information question using Prompt A.

        max_tokens raised to 512 — the output JSON is small (~150 tokens)
        but the serialised schema in the input can be large, leaving the
        model with almost no budget to finish its response at 1024 total.
        We also send only the gap/field summary rather than the full schema
        to keep the input lean and reduce the chance of hitting the limit.
        """
        user_msg = json.dumps({
            # Send only the keys of the current schema, not full values —
            # PROMPT_A only needs to know what's present vs missing.
            "present_fields"    : list(self.schema_tool.schema.keys()),
            "confidence"        : self.confidence,
            "unresolved_gaps"   : self.unresolved_gaps,
            "last_manager_input": manager_input,
            "required_fields"   : REQUIRED_FIELDS,
        })
        response = call_llm(PROMPT_A_SYSTEM, user_msg, max_tokens=512)
        parsed = parse_json_response(response)
        self.audit.record("ask", {
            "turn"     : self.turn_count,
            "question" : parsed.get("question"),
            "targets"  : parsed.get("targets_field"),
            "rationale": parsed.get("rationale"),
        })
        question = parsed.get("question")
        if not question:
            # Truncation recovery: the JSON parsed but the question value
            # was the truncated field — fall back to a generic prompt.
            question = (
                "Could you tell me more about the part of the process "
                "you haven't described yet?"
            )
        return question

    def _infer(self, manager_answer: str) -> dict:
        """
        Extract schema delta and update confidence using Prompt B.

        Token budget notes:
        - max_tokens raised to 2048: PROMPT_B must emit schema_delta +
          confidence (7 fields) + unresolved_gaps + assumptions in one shot.
          At 1024 the confidence object was reliably truncated mid-key.
        - conversation_history trimmed to last 4 turns (was 10): each turn
          can be hundreds of tokens; 10 turns of context was eating most of
          the input budget, leaving the model little room for its output.
        """
        user_msg = json.dumps({
            "manager_answer"      : manager_answer,
            "current_schema"      : self.schema_tool.schema,
            "conversation_history": self.conversation_history[-4:],
            "required_fields"     : REQUIRED_FIELDS,
        })
        response = call_llm(PROMPT_B_SYSTEM, user_msg, max_tokens=2048)
        parsed = parse_json_response(response)

        if parsed.get("schema_delta"):
            self.schema_tool.update(
                parsed["schema_delta"],
                f"turn_{self.turn_count}_inference",
            )

        # Only overwrite confidence if the model actually returned it
        new_confidence = parsed.get("confidence")
        if isinstance(new_confidence, dict) and "global" in new_confidence:
            self.confidence = new_confidence

        # Only overwrite gaps if the model returned a list
        new_gaps = parsed.get("unresolved_gaps")
        if isinstance(new_gaps, list):
            self.unresolved_gaps = new_gaps

        self.audit.record("infer", {
            "turn"           : self.turn_count,
            "schema_delta"   : parsed.get("schema_delta"),
            "confidence"     : self.confidence,
            "assumptions"    : parsed.get("assumptions", []),
            "unresolved_gaps": self.unresolved_gaps,
        })
        return parsed

    def _confirm(self) -> str:
        """Summarize current schema for manager confirmation using Prompt C."""
        user_msg = json.dumps({
            "schema"     : self.schema_tool.schema,
            "confidence" : self.confidence,
            "assumptions": self.audit.export_by_type("infer"),
        })
        summary = call_llm(PROMPT_C_SYSTEM, user_msg)
        self.audit.record("confirm", {
            "turn"   : self.turn_count,
            "summary": summary,
        })
        return summary


# ── CLI Runner ───────────────────────────────────────────────────────────────

def run_interactive():
    """
    Interactive CLI session with the diagnosis agent.
    Type 'quit' to exit, 'schema' to print current schema,
    'audit' to print full audit log, 'plan' to generate implementation plan.
    """
    print("\n" + "=" * 60)
    print("  Institutional Workflow Builder — Diagnosis Agent")
    print("=" * 60)
    print(f"  LLM Provider : {LLM_PROVIDER.upper()}")
    print(
        f"  Confidence   : global >= {CONFIDENCE_THRESHOLD}, "
        f"sections >= {MIN_SECTION_CONFIDENCE}"
    )
    print(f"  Max turns    : {MAX_TURNS}")
    print("=" * 60 + "\n")

    agent = DiagnosisAgent()
    print("Agent:", agent.start(), "\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nSession ended.")
            break

        if not user_input:
            continue

        if user_input.lower() == "quit":
            break
        if user_input.lower() == "schema":
            print("\nCurrent Schema:")
            print(json.dumps(agent.schema_tool.schema, indent=2))
            continue
        if user_input.lower() == "audit":
            print("\nAudit Log:")
            print(json.dumps(agent.audit.export(), indent=2))
            continue
        if user_input.lower() == "plan":
            print("\nGenerating implementation plan...")
            plan = agent.get_implementation_plan()
            print(json.dumps(plan, indent=2))
            continue

        result = agent.run_turn(user_input)

        print(
            f"\n[Turn {result['turn']} | "
            f"Confidence: {result['confidence'].get('global', 0):.0%} | "
            f"Schema v{result['schema_version']} | "
            f"Route: {result['route']['next']}]"
        )

        if result.get("confirmation"):
            print(f"\nAgent (confirmation):\n{result['confirmation']}")

        if result.get("next_question"):
            print(f"\nAgent: {result['next_question']}\n")

        if result["done"]:
            print("\n" + "=" * 60)
            print("  Schema complete — ready for Generation Agent")
            print("=" * 60)
            print("\nFinal Schema:")
            print(json.dumps(agent.get_final_schema(), indent=2))

            generate = input(
                "\nGenerate implementation plan? (y/n): "
            ).strip().lower()
            if generate == "y":
                print("\nGenerating plan...")
                plan = agent.get_implementation_plan()
                print(json.dumps(plan, indent=2))
            break


def run_simulation():
    """
    Non-interactive simulation with predefined inputs.
    Use for testing without live LLM calls by mocking call_llm.
    """
    agent = DiagnosisAgent()
    print("Agent:", agent.start(), "\n")

    test_inputs = [
        "We run a study abroad nomination process for students applying "
        "to partner universities abroad",
        "There are four reviewers: UG Academic Office checks CGPA, "
        "then Student Affairs checks disciplinary records, "
        "then the Program Chair checks course alignment, "
        "then our OG office does the final review",
        "Academic Office should only see CGPA and transcripts. "
        "Student Affairs should only see disciplinary records, not CGPA. "
        "Program Chair sees resume and course selections. "
        "OG sees everything",
        "Each stage should be completed within 5 working days. "
        "If someone doesn't respond after two reminders, "
        "escalate to their supervisor",
        "Students submit their name, CGPA, resume, statement of purpose, "
        "and their chosen courses at the partner university",
    ]

    for user_input in test_inputs:
        print(f"You: {user_input[:80]}{'...' if len(user_input) > 80 else ''}")
        result = agent.run_turn(user_input)

        print(
            f"[Turn {result['turn']} | "
            f"Confidence: {result['confidence'].get('global', 0):.0%} | "
            f"Route: {result['route']['next']}]"
        )

        if result.get("confirmation"):
            print(f"Agent (confirm): {result['confirmation'][:200]}...")

        if result.get("next_question"):
            print(f"Agent: {result['next_question']}\n")

        if result["done"]:
            print("\nSchema complete — ready for Generation Agent")
            print(json.dumps(agent.get_final_schema(), indent=2))
            break

    print("\nFull Audit Log entries:", len(agent.audit.export()))


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "interactive"

    if mode == "simulate":
        run_simulation()
    else:
        run_interactive()

    # Run:
    #   python diagnosis_agent.py              → interactive CLI
    #   python diagnosis_agent.py simulate     → simulation with test inputs
    #
    # Environment variables:
    #   LLM_PROVIDER=gemini (default) or bedrock
    #   GEMINI_API_KEY=...
    #   AWS_REGION=us-east-1 (if using bedrock)