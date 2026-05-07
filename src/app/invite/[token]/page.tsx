import { redirect } from "next/navigation";
import { InviteClient } from "./invite-client";
import { getCurrentSession } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw?.trim() ?? "");
  if (!token) redirect("/dashboard");

  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?invite=${encodeURIComponent(token)}`);
  }

  return <InviteClient token={token} />;
}
