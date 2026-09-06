# Opportunity definition

`fastapi_app/graph_models.py` defines the draft contract. `fastapi_app/contracts.py` defines HTTP request envelopes. Manual saves use camelCase fields such as `applicantFormFields`, `studentVisibilityRules`, `customFields`, `draftId`, and `expectedUpdatedAt`; stored draft output uses the snake_case model below.

```json
{
  "opportunity": {
    "code": "EXCHANGE-2027",
    "title": "Partner university exchange",
    "description": "The organiser's description",
    "cover_image_url": null,
    "deadline": "2027-01-15",
    "detail_fields": [],
    "ai_summary_bullets": []
  },
  "applicant_form_fields": ["full_name", "email"],
  "custom_fields": [],
  "student_visibility_rules": ["student@example.edu"],
  "graph": {
    "levels": [{
      "id": "oge_review",
      "name": "OGE review",
      "reviewers": [{
        "node_key": "oge_reviewer",
        "node_type": "reviewer",
        "display_name": "OGE",
        "reviewer_email": "oge@example.edu",
        "visible_sections": ["full_name", "email"],
        "allowed_actions": ["approve", "reject", "request_changes", "comment"],
        "metadata": {
          "sla_hours": 72,
          "can_view_comments": false,
          "return_target": "student",
          "return_rule": null,
          "required_inputs": [],
          "student_visible_fields": []
        }
      }]
    }]
  },
  "clarifying_questions": [],
  "warnings": [],
  "confidence": 1,
  "is_fallback": false
}
```

The server derives graph nodes and edges from levels. Clients edit levels, not positions or forward edges. A level with several reviewers is a parallel unanimous barrier. A return target is `student` or an earlier level ID. A return rule is `{ "field": "output_key", "value": "comparison", "target": "earlier_level_id" }` and is evaluated once the current level has approved.

Reviewer inputs have `input_key`, `label`, `input_type` (`text`, `number`, `select`, or `checkbox`), `options`, and `required`. Their keys must be unique and distinct from student fields. `student_visible_fields` can grant only that reviewer's own outputs. Other reviewers need explicit visibility grants to read earlier outputs.

Publishing adds a resolved `form_schema` and stores the full snapshot in `graph_versions.definition_json`. Every application references a version; browser JSON previews and AI drafts do not bypass server validation or authorization.
