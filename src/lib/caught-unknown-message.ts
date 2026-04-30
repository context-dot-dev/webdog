/** Readable message when catching unknown values (e.g. avoid "[object Event]" in UI/logs). */
export function caughtUnknownMessage(caught: unknown): string {
  if (typeof caught === "string") return caught;
  if (caught instanceof Error) return caught.message;
  return "Something went wrong.";
}
