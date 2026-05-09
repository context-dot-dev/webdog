import type { InvitePreview } from "./account-invite-preview";
import { APP_NAME } from "./product-info";

export function signInInviteSubtitle(inviteToken: string | null, preview: InvitePreview | null): string {
  if (!inviteToken) return `Sign in to your ${APP_NAME} account.`;
  if (preview?.valid && preview.organizationLabel) {
    return `You've been invited to join ${preview.organizationLabel}'s ${APP_NAME} organization. Sign in below (or choose Create an account if you're new).`;
  }
  if (preview?.valid) {
    return `You've been invited to join a ${APP_NAME} organization. Sign in below, or choose Create an account if you're new.`;
  }
  return `This invite link may have expired or already reached its member limit. Try signing in, or ask your team for a new link before joining.`;
}

export function signUpInviteSubtitle(inviteToken: string | null, preview: InvitePreview | null): string {
  if (!inviteToken) return "Start watching the web in under a minute.";
  if (preview?.valid && preview.organizationLabel) {
    return `Create an account to join ${preview.organizationLabel}'s ${APP_NAME} organization.`;
  }
  if (preview?.valid) {
    return `Create an account to join the ${APP_NAME} organization you were invited to.`;
  }
  return `Create an account to get started. If you were expecting to join someone's team through an invite link, ask for a new link — this one may be expired or full.`;
}
