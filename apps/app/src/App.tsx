import { Toaster } from "sonner";
import { Launcher } from "./Launcher";
import { SearchEngineBox } from "./SearchEngineBox";
import { Wallpaper } from "./Wallpaper";

export function App() {
  return (
    <Wallpaper>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "border-white/15 bg-slate-950/90 text-white shadow-2xl backdrop-blur",
            title: "font-bold",
            description: "text-white/70",
          },
        }}
      />
      <div className="flex flex-col gap-4 pt-16 sm:gap-6 sm:pt-20">
        <div className="relative z-20 px-6 sm:px-10">
          <SearchEngineBox />
        </div>
        <Launcher />
      </div>
    </Wallpaper>
  );
}
