# Domain Context

This file names the core concepts used by webdog.ai so future architecture work can talk about the same things consistently.

## Terms

- **Account** — the owner scope for websites, monitors, notification destinations, team members, and stored account-level settings.
- **Managed Deployment** — an operator-run instance where server environment variables provide Context.dev access, Resend delivery, alert postfixing, or monitor limits for all accounts.
- **Website** — a domain being watched. Websites own monitors, snapshots, and alerts.
- **Monitor** — a configured target on a website. A monitor checks site links, page content, or product price data and can be enabled or disabled.
- **Alert** — a persisted change detected by a monitor. Alerts can stay in the dashboard and can also be delivered externally.
- **Notification Destination** — a named outbound route for alerts, such as Slack, email, or webhook.
- **Context.dev Access** — the credential path used for scraping, extraction, screenshots, and brand data. In a Managed Deployment this is server-managed.
- **Email Delivery** — the Resend credential and sender path used for email notification destinations. In a Managed Deployment this can be server-managed.
