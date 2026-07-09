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
      <div className="absolute left-0 right-0 top-16 z-20 px-6 sm:top-20 sm:px-10">
        <SearchEngineBox />
      </div>
      <div className="pt-16 sm:pt-[68px]">
        <Launcher />
      </div>
    </Wallpaper>
  );
}
