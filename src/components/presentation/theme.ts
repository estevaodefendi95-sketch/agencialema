// Tema visual da apresentação ao cliente. Guardado em
// project_presentations.theme (jsonb) e aplicado como CSS vars no container
// do deck — nenhum componente usa cor fixa.
export type PresentationTheme = {
  bg: string;
  fg: string;
  accent: string;
  invert_bg: string;
  invert_fg: string;
  font: string;
};

export const DEFAULT_THEME: PresentationTheme = {
  bg: "#F6F4EF",
  fg: "#141414",
  accent: "#1B1BC7",
  invert_bg: "#1B1BC7",
  invert_fg: "#FFFFFF",
  font: "Archivo",
};

export const FONT_OPTIONS: { label: string; value: string; sample: string }[] = [
  { label: "Archivo (padrão)", value: "Archivo", sample: "Archivo" },
  { label: "Poppins", value: "Poppins", sample: "Poppins" },
  { label: "Playfair Display", value: "Playfair Display", sample: "Playfair Display" },
  { label: "DM Sans", value: "DM Sans", sample: "DM Sans" },
  { label: "Space Grotesk", value: "Space Grotesk", sample: "Space Grotesk" },
  { label: "Fraunces", value: "Fraunces", sample: "Fraunces" },
  { label: "Sora", value: "Sora", sample: "Sora" },
];

// A identidade visual é sempre a padrão da Lema — o valor salvo em
// project_presentations.theme (inclusive em versões já lançadas) é ignorado.
export function normalizeTheme(_raw?: any): PresentationTheme {
  return DEFAULT_THEME;
}

export function themeVars(theme: PresentationTheme): React.CSSProperties {
  return {
    ["--pres-bg" as any]: theme.bg,
    ["--pres-fg" as any]: theme.fg,
    ["--pres-accent" as any]: theme.accent,
    ["--pres-invert-bg" as any]: theme.invert_bg,
    ["--pres-invert-fg" as any]: theme.invert_fg,
    ["--pres-font" as any]: `"${theme.font}", ui-sans-serif, system-ui, sans-serif`,
  };
}

export const THEME_FIELDS: { key: keyof PresentationTheme; label: string }[] = [
  { key: "bg", label: "Fundo" },
  { key: "fg", label: "Texto" },
  { key: "accent", label: "Destaque" },
  { key: "invert_bg", label: "Fundo invertido" },
  { key: "invert_fg", label: "Texto invertido" },
];
