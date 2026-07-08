// Palette used to color-tag projects (KanbanBoard columns/tasks, Projects, TaskCalendar).
// Includes the brand primary (deep blue) and brand-accent (orange) alongside
// complementary hues, so auto-assigned colors stay harmonic with the theme.
export const PROJECT_COLOR_PALETTE = [
  "#0E1AB9", // brand primary (--primary)
  "#F68D1E", // brand accent (--brand-accent)
  "#16A34A",
  "#DC2626",
  "#9333EA",
  "#DB2777",
  "#0891B2",
  "#CA8A04",
  "#4D7C0F",
  "#4F46E5",
  "#0D9488",
  "#B45309",
];

// Same hues in a different order so a project and a person are unlikely to
// land on the same color when both palettes are used side by side.
export const TEAM_COLOR_PALETTE = [
  "#DB2777",
  "#0E1AB9",
  "#CA8A04",
  "#16A34A",
  "#9333EA",
  "#F68D1E",
  "#0D9488",
  "#DC2626",
  "#4F46E5",
  "#4D7C0F",
  "#0891B2",
  "#B45309",
];

// Deterministic color for an entity: an explicit color always wins, otherwise
// the same id always hashes to the same palette entry.
export function getEntityColor(
  id: string,
  explicitColor: string | null | undefined,
  palette: string[] = PROJECT_COLOR_PALETTE,
): string {
  if (explicitColor) return explicitColor;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash += id.charCodeAt(i);
  }
  return palette[hash % palette.length];
}
