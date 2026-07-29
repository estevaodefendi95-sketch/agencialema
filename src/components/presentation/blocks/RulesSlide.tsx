export type RuleItem = { id: string; title: string; description: string };
export type RulesData = { items?: RuleItem[]; agency_logo_url?: string };

export default function RulesSlide({ data, agencyLogo }: { data: RulesData; agencyLogo?: string | null }) {
  const items = data.items || [];
  const agency = data.agency_logo_url || agencyLogo || null;

  return (
    <div className="w-full h-full grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-10">
      <div className="max-w-2xl">
        {items.map((item, i) => (
          <div key={item.id || i}>
            {i > 0 && <div className="w-40 h-px bg-current opacity-40 my-8 md:my-12" />}
            <h3 className="pres-display text-2xl md:text-4xl font-bold tracking-tight mb-3">
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {item.title}
            </h3>
            {item.description && (
              <p className="text-base md:text-xl leading-relaxed opacity-90 whitespace-pre-line">
                {item.description}
              </p>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="opacity-70">Nenhuma regra cadastrada.</p>}
      </div>
      {agency && (
        <img src={agency} alt="" className="hidden md:block h-24 object-contain justify-self-end opacity-90" />
      )}
    </div>
  );
}
