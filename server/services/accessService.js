import { REJECT_ALLOWED_ROLES, ROLES } from "../config/roles.js";
import { VISIBILITY } from "../config/visibility.js";

export function canReject(role) {
    return REJECT_ALLOWED_ROLES.includes(role);
}

export function canViewApplication({ role, actorStudentProfileId, ownerStudentProfileId }) {
    if (role === ROLES.STUDENT) {
        return actorStudentProfileId === ownerStudentProfileId;
    }
    return true;
}

export function canViewRemark({ role, visibilityScope, actorStudentProfileId, ownerStudentProfileId }) {
    if (visibilityScope === VISIBILITY.INTERNAL && role === ROLES.STUDENT) {
        return false;
    }
    return canViewApplication({ role, actorStudentProfileId, ownerStudentProfileId });
}
