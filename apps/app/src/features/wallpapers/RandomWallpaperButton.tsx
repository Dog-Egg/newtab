import { Loader, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconButton } from "../../components/IconButton";
import { isWallpaperChangePending, useWallpapersStore } from "./store";

const toastId = "random-wallpaper";

export function RandomWallpaperButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const application = useWallpapersStore((state) => state.imageApplication);
  const applyRandomImage = useWallpapersStore(
    (state) => state.applyRandomImage,
  );
  const busy = isWallpaperChangePending(application);
  const loading = busy && application?.input === "random";

  useEffect(() => {
    if (application?.input !== "random") return;

    if (application.status === "error") {
      toast.error(t("app.randomWallpaperFailed"), { id: toastId });
    } else if (application.status === "empty") {
      toast.error(t("app.randomWallpaperEmpty"), { id: toastId });
    }
  }, [application, t]);

  return (
    <IconButton
      className={className}
      label={t("app.randomWallpaper")}
      aria-busy={loading}
      disabled={busy}
      onClick={() => {
        toast.dismiss(toastId);
        void applyRandomImage();
      }}
    >
      {loading ? (
        <Loader className="animate-spin [animation-duration:2s] motion-reduce:animate-none" />
      ) : (
        <Sparkles />
      )}
    </IconButton>
  );
}
