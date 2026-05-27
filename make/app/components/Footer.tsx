import { Building2 } from "lucide-react";

interface FooterProps {
  onToggleStartsida?: () => void;
  startsidaAktiv?: boolean;
  onToggleLofi?: () => void;
  lofiMode?: boolean;
}

export function Footer({
  onToggleStartsida,
  startsidaAktiv,
  onToggleLofi,
  lofiMode,
}: FooterProps) {
  return (
    <footer className="bg-[#002856] text-white pt-12 pb-10 mt-12">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24">
      <button
        type="button"
        onClick={onToggleStartsida}
        title={
          startsidaAktiv
            ? "Klicka för att hoppa över startsidan (gå direkt till inloggat läge)"
            : "Klicka för att aktivera startsidan igen"
        }
        className="flex items-center gap-2 mb-8 text-left hover:opacity-80"
      >
        <Building2 className="w-6 h-6 text-white" />
        <span className="text-white font-semibold tracking-wide">Bolagsverket</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-[1260px]">
        <div>
          <h3
            className="font-semibold text-[16px] mb-4 select-none"
            onClick={onToggleLofi}
            title={
              lofiMode
                ? "Klicka för att aktivera fullfärgs-temat"
                : "Klicka för att aktivera lo-fi-temat (grayscale)"
            }
          >
            Kontakta oss
          </h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a href="mailto:info@bolagsverket.se" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">
                info@bolagsverket.se
              </a>
            </li>
            <li>
              <a href="tel:+46771670670" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">
                Tel: 0771-670 670
              </a>
            </li>
            <li className="pt-2">
              <div>Bolagsverket</div>
              <div>851 81 Sundsvall</div>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-[16px] mb-4">Om oss</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a href="#" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">
                Så behandlar vi dina personuppgifter
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-[16px] mb-4">Om webbplatsen</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a href="#" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">Om tjänsten</a>
            </li>
            <li>
              <a href="#" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">Vi använder kakor</a>
            </li>
            <li>
              <a href="#" className="text-white underline decoration-1 underline-offset-2 hover:decoration-2">Tillgänglighet</a>
            </li>
          </ul>
        </div>
      </div>
      </div>
    </footer>
  );
}
