import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import TourPlanner from "@/components/TourPlanner";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/constants";

export default async function HomePage() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;

  if (!isLoggedIn) {
    redirect("/login");
  }

  return <TourPlanner />;
}
