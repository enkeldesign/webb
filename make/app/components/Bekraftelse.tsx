import { CheckCircle2, Info } from "lucide-react";
import { Button } from "./Button";

interface Props {
  arendenummer: string;
  datum: string;
  onVisaArende: () => void;
  onSkapaNytt: () => void;
}

export function Bekraftelse({ arendenummer, datum, onVisaArende, onSkapaNytt }: Props) {
  return (
    <div className="flex flex-col items-center pt-8 px-4">
      <h1 className="text-[40px] font-bold text-black leading-[56px] mb-8">Bekräftelse</h1>

      <div className="bg-white rounded-lg shadow-sm border border-[#e5e7eb] p-8 max-w-[600px] w-full">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#63b663]" />
          <h2 className="text-[28px] text-[#0a0a0a]">Tack för din förfrågan!</h2>
        </div>

        <p className="text-[#364153] text-[16px] mb-6">
          Bolagsverket har tagit emot din förfrågan av registerkontroll.
        </p>

        <dl className="flex flex-col gap-3 mb-6">
          <div className="flex gap-2">
            <dt className="font-semibold text-[#2a2b2d] min-w-[140px]">Datum</dt>
            <dd className="text-[#101828]">{datum}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-[#2a2b2d] min-w-[140px]">Ärendenummer</dt>
            <dd className="text-[#101828]">{arendenummer}</dd>
          </div>
        </dl>

        <div className="bg-[#ecf7fe] border-2 border-[#0065bd] border-l-[12px] rounded-sm px-5 py-4 flex items-center gap-3 mb-6">
          <Info className="w-6 h-6 text-[#0065bd] shrink-0" />
          <p className="text-[#1c398e]">Du kan följa status för ditt ärende på sidan registerkontroller.</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button variant="primary" onClick={onVisaArende} className="min-w-[128px] px-6 py-3">Visa ärende</Button>
          <Button variant="secondary" onClick={onSkapaNytt} className="min-w-[128px] px-6 py-3">Skapa nytt ärende</Button>
        </div>
      </div>
    </div>
  );
}
