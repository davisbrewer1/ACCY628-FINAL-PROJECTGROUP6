import { redirect } from "next/navigation";

/** Security concerns are submitted through Support Tickets. */
export default function EndUserSecurityConcernRedirectPage() {
  redirect("/end-user/support");
}
