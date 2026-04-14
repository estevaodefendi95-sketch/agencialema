import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  file: File;
  open: boolean;
  onClose: () => void;
  onCropped: (url: string) => void;
  circular?: boolean;
  uploadPath: string;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export default function ImageCropper({ file, open, onClose, onCropped, circular = false, uploadPath }: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc] = useState(() => URL.createObjectURL(file));

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setCrop(centerAspectCrop(naturalWidth, naturalHeight));
  }, []);

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

      const size = Math.min(pixelCrop.width, pixelCrop.height, 512);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No ctx");

      if (circular) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);
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
    } catch {
      console.error("Crop upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recortar Imagem</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={1}
            circularCrop={circular}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              onLoad={onImageLoad}
              alt="Crop"
              className="max-h-[400px] max-w-full"
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
