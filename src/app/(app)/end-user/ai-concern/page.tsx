import { redirect } from "next/navigation";

/** AI issues are submitted through Support Tickets. */
export default function EndUserAiConcernRedirectPage() {
  redirect("/end-user/support");
}
