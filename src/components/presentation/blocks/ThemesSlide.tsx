export type ThemesData = { title?: string; items?: string[] };

export default function ThemesSlide({ data }: { data: ThemesData }) {
  const items = (data.items || []).filter((t) => t?.trim());

  return (
    <div className="w-full h-full flex flex-col">
      <div
        className="-mx-6 md:-mx-16 -mt-10 md:-mt-14 px-6 md:px-16 py-8 md:py-14 mb-10 md:mb-16"
        style={{ background: "var(--pres-invert-bg)", color: "var(--pres-invert-fg)" }}
      >
        <h2 className="pres-display text-3xl md:text-6xl font-bold tracking-tight">
          {data.title || "Temas do mês"}
        </h2>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-y-10 content-start">
        {items.map((t, i) => (
          <div key={i} className="flex items-baseline gap-4">
            <span className="pres-display text-2xl md:text-5xl font-bold tabular-nums text-[color:var(--pres-accent)]">
              {String(i + 1).padStart(2, "0")}.
            </span>
            <span className="pres-display text-lg md:text-3xl uppercase tracking-tight text-[color:var(--pres-accent)]">
              {t}
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="opacity-70">Nenhum tema cadastrado.</p>}
      </div>
    </div>
  );
}
