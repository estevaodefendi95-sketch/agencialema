import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  file: File;
  open: boolean;
  onClose: () => void;
  onCropped: (url: string) => void;
  circular?: boolean;
  /** Aspect ratio. number like 1, 16/9, 4/5, or "free" for unrestricted, or "choice" to let the user pick. Default: 1 */
  aspect?: number | "free" | "choice";
  uploadPath: string;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect?: number) {
  if (!aspect) {
    return centerCrop(
      { unit: "%", x: 5, y: 5, width: 90, height: 90 } as Crop,
      mediaWidth,
      mediaHeight
    );
  }
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

const ASPECT_OPTIONS: { label: string; value: string; ratio: number | undefined }[] = [
  { label: "Livre", value: "free", ratio: undefined },
  { label: "1:1", value: "1", ratio: 1 },
  { label: "4:5", value: "4-5", ratio: 4 / 5 },
  { label: "16:9", value: "16-9", ratio: 16 / 9 },
  { label: "4:3", value: "4-3", ratio: 4 / 3 },
];

export default function ImageCropper({
  file,
  open,
  onClose,
  onCropped,
  circular = false,
  aspect = 1,
  uploadPath,
}: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc] = useState(() => URL.createObjectURL(file));

  // For "choice" mode, let the user pick. Default to 1:1.
  const [chosenAspect, setChosenAspect] = useState<string>("1");
  const effectiveAspect: number | undefined =
    circular
      ? 1
      : aspect === "choice"
      ? ASPECT_OPTIONS.find((o) => o.value === chosenAspect)?.ratio
      : aspect === "free"
      ? undefined
      : (aspect as number);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, effectiveAspect));
    },
    [effectiveAspect]
  );

  const handleAspectChange = (v: string) => {
    if (!v) return;
    setChosenAspect(v);
    const ratio = ASPECT_OPTIONS.find((o) => o.value === v)?.ratio;
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, ratio));
    }
  };

  const getCroppedBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = imgRef.current;
      if (!image || !crop) return reject("No crop");

      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const pixelCrop = {
        x: (crop.unit === "%" ? (crop.x / 100) * image.width : crop.x) * scaleX,
        y: (crop.unit === "%" ? (crop.y / 100) * image.height : crop.y) * scaleY,
        width: (crop.unit === "%" ? (crop.width / 100) * image.width : crop.width) * scaleX,
        height: (crop.unit === "%" ? (crop.height / 100) * image.height : crop.height) * scaleY,
      };

      // Output dimensions: cap longest side at 1600px to keep files reasonable
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(pixelCrop.width, pixelCrop.height));
      const outW = Math.round(pixelCrop.width * scale);
      const outH = Math.round(pixelCrop.height * scale);

      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No ctx");

      if (circular) {
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject("Blob failed")), "image/png", 0.95);
    });
  };

  const handleCrop = async () => {
    setUploading(true);
    try {
      const blob = await getCroppedBlob();
      const { error } = await supabase.storage.from("attachments").upload(uploadPath, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("attachments").getPublicUrl(uploadPath);
      onCropped(data.publicUrl + "?t=" + Date.now());
      onClose();
    } catch (err) {
      console.error("Crop upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recortar Imagem</DialogTitle>
        </DialogHeader>

        {aspect === "choice" && !circular && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Proporção:</span>
            <ToggleGroup type="single" value={chosenAspect} onValueChange={handleAspectChange} size="sm">
              {ASPECT_OPTIONS.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} className="text-xs h-7 px-2">
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <div className="flex justify-center bg-muted/30 rounded p-2 max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={effectiveAspect}
            circularCrop={circular}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              onLoad={onImageLoad}
              alt="Crop"
              className="max-h-[55vh] max-w-full"
            />
          </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCrop} disabled={uploading}>
            {uploading ? "Salvando..." : "Recortar e Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
