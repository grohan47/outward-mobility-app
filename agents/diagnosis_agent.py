# diagnosis_agent.py
# AI-Native Institutional Workflow Builder — Diagnosis Agent
# Single-file implementation with all fixes applied
# LLM: Anthropic SDK (primary) or AWS Bedrock (swap via env var LLM_PROVIDER=bedrock)

import json
import os
import copy
from typing import Optional

# ── LLM Provider Abstraction ─────────────────────────────────────────────────
# Set LLM_PROVIDER=bedrock in environment to use AWS Bedrock
# Default: Anthropic SDK
# Set ANTHROPIC_API_KEY or AWS credentials accordingly

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
MODEL_GEMINI = "models/gemini-1.5-flash"  # v1beta API compatible
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
    # Use v1 endpoint and correct model name
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    # Request body for Gemini v1
    data = {
        "contents": [
            {
                "parts": [
                    {"text": f"SYSTEM: {system_prompt}\nUSER: {user_message}"}
                ]
            }
        ],
        "generationConfig": {"maxOutputTokens": max_tokens}
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code != 200:
        raise RuntimeError(f"Gemini API error: {response.status_code} {response.text}")
    result = response.json()
    # Gemini v1 returns candidates[0].content.parts[0].text
    try:
        return result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        raise RuntimeError(f"Unexpected Gemini API response: {result}")


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
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        content = parts[1]
        if content.startswith("json"):
            content = content[4:]
        cleaned = content.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Attempt to recover by truncating to last closing brace
        last_brace = cleaned.rfind('}')
        if last_brace != -1:
            try:
                return json.loads(cleaned[:last_brace+1])
            except Exception:
                pass
        print(f"LLM returned invalid JSON.\nRaw response:\n{response}\nError: {e}")
        raise ValueError(
            f"LLM returned invalid JSON.\nRaw response:\n{response}\nError: {e}"
        )


# ── Constants ────────────────────────────────────────────────────────────────

# These are the fields that MUST be present and non-empty
# before the diagnosis agent hands off to the generation agent.
# Update this list as PRISM contracts are defined.
REQUIRED_FIELDS = [
    "stages",            # ordered list of approval stages
    "stakeholder_roles", # who reviews at each stage
    "visibility_rules",  # what each role can see
    "sla_days",          # time limit per stage
    "escalation_target", # who gets notified on SLA breach
    "applicant_fields"   # data fields submitted by applicant
]

CONFIDENCE_THRESHOLD = 0.85   # global confidence required before generation
MIN_SECTION_CONFIDENCE = 0.75  # every section must meet this floor
MAX_TURNS = 20                 # hard turn limit
STUCK_TURN_WINDOW = 5          # turns of no progress before stuck flag


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
        # Store full snapshot — not just delta — for reliable rollback
        self.changelog.append({
            "version": self.version,
            "reason": reason,
            "delta": delta,
            "snapshot": copy.deepcopy(self.schema)
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
        Lists are merged by 'id' field when present — prevents
        duplicate stages or roles on successive updates.
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
        """
        id_to_index = {
            item.get("id"): i
            for i, item in enumerate(base_list)
            if isinstance(item, dict) and "id" in item
        }
        for item in delta_list:
            if isinstance(item, dict) and item.get("id") in id_to_index:
                idx = id_to_index[item["id"]]
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
    
    Checks:
    1. All REQUIRED_FIELDS present and non-empty
    2. Every stage has a corresponding visibility rule
    3. Every stage has a stakeholder role assigned
    4. SLA days are positive integers
    5. Escalation target exists as a defined role
    
    Does NOT score confidence — that belongs to Prompt B (INFER step).
    """

    def validate(self, schema: dict) -> dict:
        missing = self._check_required_fields(schema)
        conflicts = self._check_consistency(schema)
        return {
            "missing_fields": missing,
            "conflicts": conflicts,
            "valid": len(missing) == 0 and len(conflicts) == 0
        }

    def _check_required_fields(self, schema: dict) -> list:
        return [
            f for f in REQUIRED_FIELDS
            if f not in schema or not schema[f]
        ]

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

            # Every stage must have a visibility rule
            if sid not in visibility:
                conflicts.append(
                    f"Stage '{sid}' has no visibility_rule defined"
                )

            # Every stage must have an assigned stakeholder role
            if sid not in stakeholders:
                conflicts.append(
                    f"Stage '{sid}' has no stakeholder_role assigned"
                )

            # SLA must be a positive number
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

        # Escalation target must be a known role value
        # stakeholder_roles = {stage_id: role_name}
        # all_roles = set of role_name values
        if escalation and stakeholders:
            role_values = set(stakeholders.values()) if isinstance(stakeholders, dict) else set()
            esc_roles = (
                escalation.values() if isinstance(escalation, dict)
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
    
    Stuck conditions:
    1. Confidence delta across last STUCK_TURN_WINDOW turns < 0.05
    2. Hard turn limit reached (MAX_TURNS)
    
    When stuck, surfaces top 3 unresolved gaps for explicit resolution.
    """

    def __init__(self):
        self.confidence_history: list = []

    def check(
        self,
        turn_count: int,
        confidence: float,
        unresolved_gaps: list
    ) -> dict:
        self.confidence_history.append(confidence)
        recent = self.confidence_history[-STUCK_TURN_WINDOW:]

        no_progress = (
            len(recent) >= STUCK_TURN_WINDOW and
            (max(recent) - min(recent)) < 0.05
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
            "confidence_history": list(recent)
        }


# ── Tool 4: RoutingTool ──────────────────────────────────────────────────────

class RoutingTool:
    """
    Deterministic next-action router. No LLM involved.
    
    Priority order (highest to lowest):
    1. Stuck → surface top gaps explicitly
    2. Validation failures → ask targeted question
    3. Confidence below threshold → ask next question
    4. Min section confidence below floor → ask targeted question
    5. All clear → hand off to generation agent
    
    Routing is deterministic and testable — no LLM decides control flow.
    """

    def route(
        self,
        schema_state: dict,
        confidence: dict,
        validation: dict,
        stuck: dict,
        turn_count: int
    ) -> dict:

        # Priority 1 — stuck state overrides everything
        if stuck["stuck"]:
            return {
                "next": "surface_gaps",
                "reason": stuck["reason"],
                "gaps": stuck["top_gaps"]
            }

        # Priority 2 — hard validation failures
        if not validation["valid"]:
            targets = validation["missing_fields"] + validation["conflicts"]
            return {
                "next": "ask",
                "reason": "validation_failure",
                "targets": targets
            }

        # Priority 3 — global confidence below threshold
        global_conf = confidence.get("global", 0.0)
        if global_conf < CONFIDENCE_THRESHOLD:
            return {
                "next": "ask",
                "reason": f"global_confidence_{global_conf:.2f}_below_{CONFIDENCE_THRESHOLD}"
            }

        # Priority 4 — any section confidence below floor
        for section, score in confidence.items():
            if section == "global":
                continue
            if isinstance(score, (int, float)) and score < MIN_SECTION_CONFIDENCE:
                return {
                    "next": "ask",
                    "reason": f"section_{section}_confidence_{score:.2f}_below_floor",
                    "targets": [section]
                }

        # All checks pass — ready for generation agent
        return {
            "next": "generation_agent",
            "reason": "schema_complete_and_validated"
        }


# ── Tool 5: AuditLogTool ─────────────────────────────────────────────────────

class AuditLogTool:
    """
    Append-only audit log for every agent action.
    
    Records: tool calls, LLM decisions, manager responses,
    routing decisions, assumptions made, schema versions.
    
    This is the NAAC/accreditation compliance trail.
    Every entry is immutable once written.
    """

    def __init__(self):
        self._log: list = []

    def record(self, event_type: str, metadata: dict) -> int:
        """Append event. Returns entry ID."""
        entry = {
            "id": len(self._log) + 1,
            "event_type": event_type,
            "metadata": copy.deepcopy(metadata)
        }
        self._log.append(entry)
        return entry["id"]

    def export(self) -> list:
        """Return full immutable copy of audit log."""
        return copy.deepcopy(self._log)

    def export_by_type(self, event_type: str) -> list:
        """Filter log by event type."""
        return [e for e in self._log if e["event_type"] == event_type]


# ── Tool 6: PrismCompatibilityTool (Stub) ───────────────────────────────────

class PrismCompatibilityTool:
    """
    STUB — to be implemented once PRISM runtime contracts are defined.
    
    Will validate finalized diagnosis schema against:
    - PRISM roles.js     → stakeholder_roles mapping
    - PRISM workflow.js  → stage/transition contracts
    - PRISM httpServer.js → API endpoint style validation
    
    Currently returns pass with a warning so development can proceed.
    Replace _validate_roles(), _validate_stages(), _validate_api()
    with real contract checks when PRISM is ready.
    """

    def validate(self, schema: dict) -> dict:
        warnings = [
            "PrismCompatibilityTool is a stub — PRISM contracts not yet defined.",
            "Implement _validate_roles(), _validate_stages(), _validate_api() "
            "once PRISM runtime is available."
        ]
        return {
            "compatible": True,  # optimistic default until contracts exist
            "warnings": warnings,
            "conflicts": []
        }

    def _validate_roles(self, schema: dict) -> list:
        # TODO: cross-reference schema.stakeholder_roles against PRISM roles.js
        return []

    def _validate_stages(self, schema: dict) -> list:
        # TODO: validate stage transitions against PRISM workflow.js contracts
        return []

    def _validate_api(self, schema: dict) -> list:
        # TODO: validate generated endpoints against PRISM httpServer.js style
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

PROMPT_B_SYSTEM = """
You are generating structured data for a workflow engine.

Return ONLY valid JSON.

Rules:
* No markdown
* No explanations
* No code blocks
* No comments
* Output must be valid JSON
* Every string must be closed
* All property names and strings must be enclosed in double quotes
* Only use the fields 'name', 'actor', and 'description' for each stage
* Do not add, omit, or rename any fields
* Keep descriptions short (max 20 words)

Output schema:
{
    "schema_delta": {
        "stages": [
            {
                "name": "string",
                "actor": "string",
                "description": "string"
            }
        ]
    }
}

Example output:
{
    "schema_delta": {
        "stages": [
            {
                "name": "Submission",
                "actor": "Club Representative",
                "description": "Club submits funding request with event details and budget."
            },
            {
                "name": "Student Life Review",
                "actor": "Student Life Office",
                "description": "Eligibility and policy compliance are verified."
            },
            {
                "name": "Finance Review",
                "actor": "Finance Department",
                "description": "Budget and fund availability are validated."
            }
        ]
    }
}
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
    
    Session lifecycle:
    1. Manager describes their workflow problem in natural language
    2. Agent asks targeted questions (Prompt A)
    3. Agent infers schema from answers (Prompt B) 
    4. Agent confirms understanding every 3 turns (Prompt C)
    5. When confidence >= threshold and schema valid → hand off to generation
    
    All decisions are logged to AuditLogTool for compliance.
    No LLM controls routing — RoutingTool is fully deterministic.
    """

    def __init__(self):
        # Tools
        self.schema_tool     = WorkflowSchemaTool()
        self.policy_tool     = PolicyValidationTool()
        self.stuck_tool      = StuckStateTool()
        self.routing_tool    = RoutingTool()
        self.audit           = AuditLogTool()
        self.prism_tool      = PrismCompatibilityTool()

        # Session state
        self.turn_count         : int   = 0
        self.confidence         : dict  = {"global": 0.0}
        self.unresolved_gaps    : list  = []
        self.conversation_history: list = []

    # ── Public API ───────────────────────────────────────────────────────────

    def start(self) -> str:
        """
        Opening message to the manager.
        Call this before the first run_turn().
        """
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
        
        Returns dict with:
        - turn: int
        - next_question: str or None
        - confirmation: str or None  (every 3 turns)
        - confidence: dict
        - schema_version: int
        - route: dict
        - done: bool (True = ready for generation agent)
        - audit_snapshot: list (full log so far)
        """
        self.turn_count += 1
        self.conversation_history.append({
            "turn": self.turn_count,
            "role": "manager",
            "content": manager_input
        })
        self.audit.record("manager_input", {
            "turn": self.turn_count,
            "content": manager_input
        })

        # Step 1 — INFER: extract schema delta from manager answer
        infer_result = self._infer(manager_input)

        # Step 2 — VALIDATE: check schema completeness and consistency
        validation = self.policy_tool.validate(self.schema_tool.schema)
        self.audit.record("validation", {
            "turn": self.turn_count,
            "result": validation
        })

        # Step 3 — STUCK CHECK
        stuck = self.stuck_tool.check(
            self.turn_count,
            self.confidence.get("global", 0.0),
            self.unresolved_gaps
        )
        self.audit.record("stuck_check", {
            "turn": self.turn_count,
            "result": stuck
        })

        # Step 4 — ROUTE: deterministic next action
        route = self.routing_tool.route(
            self.schema_tool.schema,
            self.confidence,
            validation,
            stuck,
            self.turn_count
        )
        self.audit.record("routing_decision", {
            "turn": self.turn_count,
            "route": route
        })

        # Step 5 — CONFIRM: every 3 turns or when ready for generation
        confirmation = None
        if self.turn_count % 3 == 0 or route["next"] == "generation_agent":
            confirmation = self._confirm()

        # Step 6 — ASK or SURFACE GAPS or EXECUTE
        next_question = None

        if route["next"] == "ask":
            next_question = self._ask(manager_input)

        elif route["next"] == "surface_gaps":
            gaps = stuck["top_gaps"]
            gap_list = "\n".join(f"  - {g}" for g in gaps)
            next_question = (
                f"I'm having trouble fully understanding a few things. "
                f"Could you clarify each of these directly?\n{gap_list}"
            )
            self.audit.record("surface_gaps", {
                "turn": self.turn_count,
                "gaps": gaps
            })

        elif route["next"] == "generation_agent":
            # Run PRISM compatibility check before handoff
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
            "audit_snapshot": self.audit.export()
        }

    def get_final_schema(self) -> dict:
        """Return the finalized workflow schema for the generation agent."""
        return copy.deepcopy(self.schema_tool.schema)

    def get_implementation_plan(self) -> dict:
        """
        Generate phased implementation plan from finalized schema.
        Only call after done == True.
        """
        schema = self.schema_tool.schema
        response = call_llm(
            PROMPT_D_SYSTEM,
            json.dumps({"schema": schema}),
            max_tokens=2048
        )
        plan = parse_json_response(response)
        self.audit.record("implementation_plan", plan)
        return plan

    # ── Private Methods ──────────────────────────────────────────────────────

    def _ask(self, manager_input: Optional[str]) -> str:
        """Generate next high-information question using Prompt A."""
        user_msg = json.dumps({
            "current_schema"  : self.schema_tool.schema,
            "confidence"      : self.confidence,
            "unresolved_gaps" : self.unresolved_gaps,
            "last_manager_input": manager_input,
            "required_fields" : REQUIRED_FIELDS
        })
        response = call_llm(PROMPT_A_SYSTEM, user_msg)
        parsed = parse_json_response(response)
        self.audit.record("ask", {
            "turn"    : self.turn_count,
            "question": parsed.get("question"),
            "targets" : parsed.get("targets_field"),
            "rationale": parsed.get("rationale")
        })
        return parsed["question"]

    def _infer(self, manager_answer: str) -> dict:
        """Extract schema delta and update confidence using Prompt B."""
        user_msg = json.dumps({
            "manager_answer"       : manager_answer,
            "current_schema"       : self.schema_tool.schema,
            # Keep last 10 turns for context — enough for most sessions
            # without blowing the context window
            "conversation_history" : self.conversation_history[-10:],
            "required_fields"      : REQUIRED_FIELDS
        })
        response = call_llm(PROMPT_B_SYSTEM, user_msg)
        parsed = parse_json_response(response)

        # Update schema with extracted delta
        if parsed.get("schema_delta"):
            self.schema_tool.update(
                parsed["schema_delta"],
                f"turn_{self.turn_count}_inference"
            )

        # Update session confidence and gaps
        self.confidence     = parsed.get("confidence", self.confidence)
        self.unresolved_gaps = parsed.get("unresolved_gaps", [])

        self.audit.record("infer", {
            "turn"           : self.turn_count,
            "schema_delta"   : parsed.get("schema_delta"),
            "confidence"     : self.confidence,
            "assumptions"    : parsed.get("assumptions", []),
            "unresolved_gaps": self.unresolved_gaps
        })
        return parsed

    def _confirm(self) -> str:
        """Summarize current schema for manager confirmation using Prompt C."""
        user_msg = json.dumps({
            "schema"     : self.schema_tool.schema,
            "confidence" : self.confidence,
            "assumptions": self.audit.export_by_type("infer")
        })
        # Prompt C returns plain text, not JSON
        summary = call_llm(PROMPT_C_SYSTEM, user_msg)
        self.audit.record("confirm", {
            "turn"   : self.turn_count,
            "summary": summary
        })
        return summary


# ── CLI Runner ───────────────────────────────────────────────────────────────

def run_interactive():
    """
    Interactive CLI session with the diagnosis agent.
    Type 'quit' to exit, 'schema' to print current schema,
    'audit' to print full audit log, 'plan' to generate implementation plan.
    """
    print("\n" + "="*60)
    print("  Institutional Workflow Builder — Diagnosis Agent")
    print("="*60)
    print(f"  LLM Provider : {LLM_PROVIDER.upper()}")
    print(f"  Confidence   : global >= {CONFIDENCE_THRESHOLD}, "
          f"sections >= {MIN_SECTION_CONFIDENCE}")
    print(f"  Max turns    : {MAX_TURNS}")
    print("="*60 + "\n")

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

        # Debug commands
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

        print(f"\n[Turn {result['turn']} | "
              f"Confidence: {result['confidence'].get('global', 0):.0%} | "
              f"Schema v{result['schema_version']} | "
              f"Route: {result['route']['next']}]")

        if result.get("confirmation"):
            print(f"\nAgent (confirmation):\n{result['confirmation']}")

        if result.get("next_question"):
            print(f"\nAgent: {result['next_question']}\n")

        if result["done"]:
            print("\n" + "="*60)
            print("  Schema complete — ready for Generation Agent")
            print("="*60)
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
    Use this for testing without live LLM calls by mocking call_llm.
    """
    agent = DiagnosisAgent()
    print("Agent:", agent.start(), "\n")

    # GE study abroad nomination workflow — realistic test inputs
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

        print(f"[Turn {result['turn']} | "
              f"Confidence: {result['confidence'].get('global', 0):.0%} | "
              f"Route: {result['route']['next']}]")

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
    #   LLM_PROVIDER=anthropic (default) or bedrock
    #   ANTHROPIC_API_KEY=sk-ant-...
    #   AWS_REGION=us-east-1 (if using bedrock)