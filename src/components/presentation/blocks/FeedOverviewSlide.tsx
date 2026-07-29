export type FeedOverviewData = { title?: string; subtitle?: string; images?: string[] };

export default function FeedOverviewSlide({ data }: { data: FeedOverviewData }) {
  const images = data.images || [];

  return (
    <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-16">
      <div className="text-[color:var(--pres-accent)] md:text-right">
        <h2 className="pres-display text-3xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          {data.title || "#seu feed, seu lema."}
        </h2>
        <p className="pres-display text-lg md:text-2xl uppercase tracking-[0.12em] mt-3 opacity-80">
          {data.subtitle || "Visão geral"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 md:gap-2">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
        ))}
        {images.length === 0 && (
          <div className="col-span-3 aspect-[3/2] flex items-center justify-center border border-current/20 opacity-60 text-sm">
            Sem imagens no mosaico
          </div>
        )}
      </div>
    </div>
  );
}
