import { redirect } from "next/navigation";

/** The template's old home. Kept as a redirect so old links and installed shortcuts land on Home. */
export default function DashboardRedirect(): never {
  redirect("/");
}
