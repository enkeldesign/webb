import { Globe, Moon, Building2, LogIn } from "lucide-react";

interface HeaderProps {
  isInloggad?: boolean;
  onLoggaIn?: () => void;
  onLoggaUt?: () => void;
}

export function Header({ isInloggad = true, onLoggaIn, onLoggaUt }: HeaderProps) {
  return (
    <header className="bg-[#002857] py-4">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-white">
          <Building2 className="w-6 h-6" />
          <span className="font-semibold tracking-wide">Bolagsverket</span>
        </div>
        <span className="text-white text-[20px]">Samordnad registerkontroll</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 text-white hover:opacity-80">
          <Globe className="w-5 h-5" />
          <span>Svenska</span>
        </button>
        <button className="flex items-center gap-2 text-white hover:opacity-80">
          <Moon className="w-5 h-5" />
          <span>Mörkt läge</span>
        </button>
        {isInloggad ? (
          <button
            onClick={onLoggaUt}
            className="bg-[#fbe5e5] text-[#002857] px-6 py-3 rounded font-semibold border-2 border-transparent shadow-sm hover:bg-[#f5d5d5]"
          >
            Logga ut
          </button>
        ) : (
          <button
            onClick={onLoggaIn}
            className="inline-flex items-center gap-2 bg-white text-[#002857] px-6 py-3 rounded font-semibold border-2 border-transparent shadow-sm hover:bg-[#e9eef5]"
          >
            <LogIn className="w-5 h-5" />
            <span>Logga in</span>
          </button>
        )}
      </div>
      </div>
    </header>
  );
}
