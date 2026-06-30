import { useState, useRef, useEffect, memo } from "react";
import Cropper from "cropperjs";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../ui/Modal";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import {
  Camera,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { toast } from "react-hot-toast";

export interface ImageUploadProps {
  preset: "profile" | "logo" | "banner";
  value?: string | null;
  onChange: (file: File) => void;
  disabled?: boolean;
  isFarsi?: boolean;
}

const CropperWidget = memo(
  ({
    src,
    preset,
    cropperRef,
  }: {
    src: string;
    preset: "profile" | "logo" | "banner";
    cropperRef: React.MutableRefObject<Cropper | null>;
  }) => {
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      if (!imageRef.current) return;
      const el = imageRef.current;

      let cropperInstance: Cropper | null = null;

      const init = () => {
        if (cropperInstance) return;
        console.log("[CropperWidget] Initializing Cropper on image element:", el);
        cropperInstance = new Cropper(el, {
          aspectRatio: preset === "profile" ? 1 : preset === "banner" ? 16 / 9 : NaN,
          viewMode: 1,
          background: false,
          zoomable: true,
          scalable: true,
          autoCropArea: 0.9,
          responsive: true,
        });
        cropperRef.current = cropperInstance;
        console.log("[CropperWidget] Cropper instance set on ref:", cropperRef.current);
      };

      if (el.complete) {
        init();
      } else {
        el.addEventListener("load", init);
      }

      return () => {
        el.removeEventListener("load", init);
        if (cropperInstance) {
          console.log("[CropperWidget] Component unmounting/changing, destroying Cropper:", cropperInstance);
          cropperInstance.destroy();
        }
        cropperRef.current = null;
      };
    }, [src, preset, cropperRef]);

    return (
      <div
        className={cn(
          "w-full h-[400px] md:h-[450px] overflow-hidden relative flex items-center justify-center bg-black/60",
          preset === "profile" && "cropper-circle-viewport"
        )}
      >
        <img
          ref={imageRef}
          src={src}
          alt="Crop Target"
          className="max-w-full max-h-full block"
        />
      </div>
    );
  }
);

export default function ImageUpload({
  preset,
  value,
  onChange,
  disabled = false,
  isFarsi = false,
}: ImageUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  // Keep track of rotation/flips
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  // Make sure we clean up imageSrc when modal is closed
  useEffect(() => {
    if (!isModalOpen) {
      setImageSrc(null);
      setScaleX(1);
      setScaleY(1);
    }
  }, [isModalOpen]);

  const handleFile = async (file: File) => {
    if (disabled) return;

    // Reject SVG files
    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      toast.error(
        isFarsi
          ? "فایل‌های SVG مجاز نیستند"
          : "SVG files are not allowed"
      );
      return;
    }

    setIsProcessing(true);
    let targetFile = file;

    // Convert HEIC to JPEG
    if (
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif") ||
      file.type === "image/heic" ||
      file.type === "image/heif"
    ) {
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: file, toType: "image/jpeg" });
        targetFile = new File([blob as Blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
          type: "image/jpeg",
        });
      } catch (err) {
        console.error("HEIC conversion failed:", err);
        toast.error(
          isFarsi
            ? "خطا در پردازش فایل HEIC. لطفاً فرمت دیگری استفاده کنید."
            : "Failed to process HEIC file. Please use another format."
        );
        setIsProcessing(false);
        return;
      }
    }

    // Read image for cropping
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsModalOpen(true);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      toast.error(isFarsi ? "خطا در خواندن فایل" : "Error reading file");
      setIsProcessing(false);
    };
    reader.readAsDataURL(targetFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset file input value so same file can be chosen again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleCropSave = () => {
    console.log("[ImageUpload] handleCropSave clicked. cropperRef.current:", cropperRef.current);
    if (!cropperRef.current) {
      console.warn("[ImageUpload] cropperRef.current is null!");
      return;
    }

    const mimeType = preset === "logo" ? "image/png" : "image/jpeg";
    const extension = preset === "logo" ? "png" : "jpg";

    cropperRef.current.getCroppedCanvas({
      width: preset === "profile" ? 256 : preset === "logo" ? 512 : 1280,
      height: preset === "profile" ? 256 : preset === "logo" ? 512 : 720,
    }).toBlob((blob: Blob | null) => {
      if (blob) {
        const croppedFile = new File([blob], `cropped_image.${extension}`, {
          type: mimeType,
        });
        onChange(croppedFile);
        setIsModalOpen(false);
      }
    }, mimeType, preset === "logo" ? undefined : 0.9);
  };

  return (
    <>
      <style>{`
        .cropper-circle-viewport .cropper-view-box,
        .cropper-circle-viewport .cropper-face {
          border-radius: 50% !important;
        }
      `}</style>

      <div className="flex flex-col gap-3">
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed border-[var(--b)] bg-[var(--s3)] hover:bg-[var(--s2)] transition-all duration-200 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center",
            preset === "profile" && "w-24 h-24 rounded-full",
            preset === "logo" && "w-20 h-20 rounded-2xl",
            preset === "banner" && "w-full h-40 rounded-2xl",
            isDragging && "border-[var(--brand)] bg-[var(--brand)]/5",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {isProcessing ? (
            <Spinner />
          ) : value ? (
            <>
              <img
                src={value}
                alt="Upload preview"
                className={cn(
                  "w-full h-full object-cover",
                  preset === "profile" && "rounded-full"
                )}
              />
              {!disabled && (
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">
                    {isFarsi ? "تغییر" : "Change"}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-2">
              <Camera className="w-5 h-5 text-[var(--t3)]" />
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                {isFarsi ? "آپلود" : "Upload"}
              </span>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*, .heic, .heif"
          className="hidden"
          disabled={disabled}
        />

        {/* RADIX MODAL EDITOR WITH DARK GLASSMORPHIC UX */}
        <Modal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          panelClassName="max-w-2xl bg-black/95 backdrop-blur-xl border border-white/10 text-white rounded-2xl shadow-2xl p-0 overflow-hidden"
        >
          <ModalHeader className="border-white/10 px-6 py-4">
            <ModalTitle className="text-white text-base">
              {isFarsi ? "ویرایش و برش تصویر" : "Edit & Crop Image"}
            </ModalTitle>
          </ModalHeader>
          
          <ModalBody className="p-0 bg-black/40 flex flex-col items-stretch">
            {imageSrc && (
              <CropperWidget
                src={imageSrc}
                preset={preset}
                cropperRef={cropperRef}
              />
            )}

            {/* Premium Controls Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 p-3 bg-white/5 border-t border-white/10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cropperRef.current?.rotate(-90)}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "چرخش به چپ" : "Rotate Left"}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cropperRef.current?.rotate(90)}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "چرخش به راست" : "Rotate Right"}
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const nextX = scaleX === 1 ? -1 : 1;
                  setScaleX(nextX);
                  cropperRef.current?.scaleX(nextX);
                }}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "قرینه افقی" : "Flip Horizontal"}
              >
                <FlipHorizontal className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const nextY = scaleY === 1 ? -1 : 1;
                  setScaleY(nextY);
                  cropperRef.current?.scaleY(nextY);
                }}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "قرینه عمودی" : "Flip Vertical"}
              >
                <FlipVertical className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cropperRef.current?.zoom(0.1)}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "بزرگنمایی" : "Zoom In"}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cropperRef.current?.zoom(-0.1)}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "کوچکنمایی" : "Zoom Out"}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  cropperRef.current?.reset();
                  setScaleX(1);
                  setScaleY(1);
                }}
                className="bg-transparent border-white/15 text-white hover:bg-white/10"
                title={isFarsi ? "تنظیم مجدد" : "Reset"}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </ModalBody>
          
          <ModalFooter className="border-white/10 px-6 py-4 bg-white/5">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="bg-transparent border-white/15 text-white hover:bg-white/10"
            >
              {isFarsi ? "انصراف" : "Cancel"}
            </Button>
            <Button onClick={handleCropSave} className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 border-none">
              {isFarsi ? "برش و ذخیره" : "Crop & Save"}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </>
  );
}
