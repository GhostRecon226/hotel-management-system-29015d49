// Room labels are free text: 101, A101, Zurich, or a mix (ROOM-005). They are shown as typed, never with
// "Room" in front. The database tidies and checks them (app.room_label); this file only displays and sorts.

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Natural order, the same as the database (collation app.natural): 2 before 10, names A to Z. */
export function compareRoomLabels(a: string | null | undefined, b: string | null | undefined) {
  return collator.compare(a ?? "", b ?? "");
}

/** Sorts rows by their room label in natural order. Returns a new array. */
export function sortByRoom<T extends { room_number?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => compareRoomLabels(x.room_number, y.room_number));
}

/** "Zurich (Deluxe)": the label as typed, with the room type when there is one. Used in lists and boards. */
export function roomWithType(label: string | null | undefined, typeName?: string | null) {
  if (!label) return "";
  return typeName ? `${label} (${typeName})` : label;
}

/** The longest label the database accepts. */
export const ROOM_LABEL_MAX = 30;
