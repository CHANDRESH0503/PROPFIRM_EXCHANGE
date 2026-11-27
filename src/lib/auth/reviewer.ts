import "server-only";
import { forbidden } from "next/navigation";
import { requireStaff, hasRole } from "./session";
export async function requireReviewer() {
  const staff = await requireStaff();
  if (!hasRole(staff.roles, "finance") && !hasRole(staff.roles, "support")) forbidden();
  return staff.user;
}
