export type MediaType = "image" | "video";
export type MediaItem = { url: string; type: MediaType };

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];

export function detectMediaType(fileNameOrUrl: string): MediaType {
  const clean = fileNameOrUrl.split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}

// Blocos de galeria antigos só tinham `images: string[]`; normaliza pro
// formato novo `items: { url, type }[]` sem precisar de migração de dados.
export function getGalleryItems(data: any): MediaItem[] {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.images)) return data.images.map((url: string) => ({ url, type: "image" as const }));
  return [];
}

export type PostMediaRow = {
  id: string;
  post_id: string;
  media_url: string;
  media_type: MediaType;
  position: number;
};

// Posts antigos só tinham `image_url` (sem linhas em presentation_post_media);
// normaliza pra uma lista única, caindo de volta pro image_url legado quando
// o post ainda não tem nenhuma linha na tabela de mídia.
export function getPostMediaItems(
  post: { id: string; image_url: string | null },
  media: PostMediaRow[],
): PostMediaRow[] {
  const own = media.filter((m) => m.post_id === post.id).sort((a, b) => a.position - b.position);
  if (own.length > 0) return own;
  if (post.image_url) {
    return [{ id: `legacy-${post.id}`, post_id: post.id, media_url: post.image_url, media_type: "image", position: 0 }];
  }
  return [];
}

export function isLegacyPostMedia(id: string): boolean {
  return id.startsWith("legacy-");
}
