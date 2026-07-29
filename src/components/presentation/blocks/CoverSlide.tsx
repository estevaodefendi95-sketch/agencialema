export type CoverData = {
  tagline?: string;
  label?: string;
  month?: string;
  year?: string;
  logo_url?: string;
  agency_logo_url?: string;
};

export default function CoverSlide({
  data,
  clientLogo,
  agencyLogo,
}: {
  data: CoverData;
  clientLogo?: string | null;
  agencyLogo?: string | null;
}) {
  const logo = data.logo_url || clientLogo || null;
  const agency = data.agency_logo_url || agencyLogo || null;

  return (
    <div className="w-full h-full flex flex-col justify-between gap-10">
      <div className="flex items-start justify-between gap-6 text-[color:var(--pres-accent)]">
        <span className="pres-display text-sm md:text-lg tracking-tight">
          {data.tagline || "#tudo começa pelo seu lema."}
        </span>
        {data.year && <span className="pres-display text-sm md:text-lg">{data.year}</span>}
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        {logo ? (
          <img src={logo} alt="Logo do cliente" className="max-h-[38vh] max-w-[70%] object-contain" />
        ) : (
          <span className="pres-display text-4xl md:text-7xl tracking-tight opacity-80">
            {data.label || "PLANEJAMENTO"}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-6 text-[color:var(--pres-accent)]">
        <span className="pres-display text-lg md:text-3xl tracking-[0.18em] uppercase">
          {data.label || "PLANEJAMENTO"}
        </span>
        <div className="flex items-center gap-6">
          {data.month && (
            <span className="pres-display text-lg md:text-3xl font-bold tracking-[0.12em] uppercase">
              {data.month}
            </span>
          )}
          {agency && <img src={agency} alt="" className="h-7 md:h-9 object-contain opacity-80" />}
        </div>
      </div>
    </div>
  );
}
