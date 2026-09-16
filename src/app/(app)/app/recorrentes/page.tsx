import { redirect } from "next/navigation";

/** Keeps old bookmarks working after recurring accounts were consolidated in Contas. */
export default function RecurringPage() {
  redirect("/app/contas");
}
