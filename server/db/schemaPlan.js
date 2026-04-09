import { TABLES } from "./tableCatalog.js";

// Schema planning metadata used as single reference before SQL migrations are added.
export const SCHEMA_PLAN = Object.freeze({
    [TABLES.USERS]: ["id", "email", "full_name", "is_active", "created_at"],
    [TABLES.ROLES]: ["id", "code", "display_name"],
    [TABLES.USER_ROLES]: ["id", "user_id", "role_id", "created_at"],
    [TABLES.USER_SCOPE_ROLES]: ["id", "user_id", "role_id", "scope_type", "scope_id", "created_by", "created_at"],
    [TABLES.STUDENT_PROFILES]: ["id", "user_id", "student_id", "program", "official_cgpa", "created_at"],
    [TABLES.OPPORTUNITIES]: ["id", "code", "title", "term", "destination"],
    [TABLES.EMAIL_GROUPS]: ["id", "email_address", "display_name", "is_active", "created_at"],
    [TABLES.EMAIL_GROUP_MEMBERSHIPS]: ["id", "group_id", "user_id", "created_at"],
    [TABLES.OPPORTUNITY_VISIBILITY_RULES]: ["id", "opportunity_id", "rule_type", "rule_value", "created_by", "created_at"],
    [TABLES.WORKFLOW_STAGES]: ["id", "code", "display_name", "sequence_order", "is_active"],
    [TABLES.APPLICATIONS]: ["id", "student_profile_id", "opportunity_id", "current_stage", "final_status", "created_at", "updated_at"],
    [TABLES.APPLICATION_STUDENT_SNAPSHOT]: ["id", "application_id", "official_cgpa_at_submission", "program_at_submission", "disciplinary_status_at_submission", "snapshot_captured_at"],
    [TABLES.APPLICATION_DOCUMENTS]: ["id", "application_id", "document_type", "file_name", "storage_key", "uploaded_by", "uploaded_at"],
    [TABLES.APPLICATION_REVIEWS]: ["id", "application_id", "review_role", "verification_outcome", "remarks", "visibility_scope", "created_by", "created_at"],
    [TABLES.APPLICATION_DECISIONS]: ["id", "application_id", "stage_code", "decision", "reason", "decided_by", "decided_at"],
    [TABLES.APPLICATION_REMARKS]: ["id", "application_id", "remark_type", "text", "visibility_scope", "created_by", "created_at"],
    [TABLES.TIMELINE_EVENTS]: ["id", "application_id", "event_type", "event_payload", "actor_user_id", "created_at"],
});
