// Database errors look like "[E_CODE] Plain message". Show only the message.
export function errorMessage(e: unknown): string {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e ?? "Something went wrong.");
  return raw.replace(/^\[[A-Z0-9_]+\]\s*/, "");
}

export function errorCode(e: unknown): string | null {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : "";
  const m = raw.match(/^\[([A-Z0-9_]+)\]/);
  return m ? m[1] : null;
}
