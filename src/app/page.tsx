import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getSessionState } from "@/lib/current-user";

/** "/" sends people home (or to sign in). Role-specific homes go here. */
export default function Home() {
  return (
    <Suspense>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect(): Promise<never> {
  await connection();
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "no_membership") redirect("/no-access");
  redirect("/dashboard");
}
