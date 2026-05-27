import { ChevronLeft, Printer, Building2 } from "lucide-react";
import type { Arende } from "./ArendeDetalj";

interface Props {
  arende: Arende;
  onStang: () => void;
}

const UPPHANDLINGSLAG_LABEL: Record<string, string> = { LOU: "LOU", LUF: "LUF", LUK: "LUK", LUFS: "LUFS" };
const TYP_LABEL: Record<string, string> = {
  ny: "Ny Upphandling",
  uppfoljning_avtal: "Uppföljning av avtal",
  kontroll_nytt_dis: "Kontroll vid nytt DIS",
  utokad_kontroll_dis: "Utökad Kontroll DIS",
  uppfoljning_dis: "Uppföljning DIS",
};

const MYNDIGHETER = [
  {
    namn: "Myndighet 1",
    info: "[Information om kontrollen]",
    yttrande: "[Yttrande från myndighet 1]",
  },
  {
    namn: "Myndighet 2",
    info: "[Information om kontrollen]",
    yttrande: "[Yttrande från myndighet 2]",
  },
  {
    namn: "Myndighet 3",
    info: "[Information om kontrollen]",
    yttrande: "[Yttrande från myndighet 3]",
  },
];

export function YttrandePdf({ arende, onStang }: Props) {
  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <div className="sticky top-0 z-10 bg-white border-b border-[#d0d2d7] px-6 py-3 flex items-center justify-between print:hidden">
        <button
          onClick={onStang}
          className="inline-flex items-center gap-2 bg-[#ecf7fe] border-2 border-[#0065bd] text-[#0065bd] px-4 py-2 rounded hover:bg-[#d9edfc]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Tillbaka till ärende</span>
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-[#005299] text-white px-4 py-2 rounded hover:bg-[#003d73]"
        >
          <Printer className="w-4 h-4" />
          <span>Skriv ut / Spara som PDF</span>
        </button>
      </div>

      <div className="max-w-[1244px] mx-auto bg-white my-8 p-12 rounded-lg shadow print:shadow-none print:my-0 print:rounded-none">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="w-10 h-10 text-[#002857]" />
          <span className="text-[#1d1d1b] font-bold tracking-wide text-[20px]">Bolagsverket</span>
        </div>

        <h1 className="text-[40px] font-bold text-black leading-[56px] mb-2">Samordnad registerkontroll</h1>
        <p className="text-[28px] font-bold text-[#2a2b2d] mb-8">Ärendenummer: {arende.arendenummer}</p>

        <section className="border border-[#c5c6c9] rounded-lg px-6 py-4 mb-8">
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-2">
            <Field label="Referens:" value={arende.upphandling.referens || "—"} />
            <Field label="Skapad:" value={arende.datum.split(",")[0]} />
            <Field label="Skapad av:" value={arende.skapadAv ?? "Förnamn Efternamn"} />
            <Field label="Upphandlingstyp:" value={TYP_LABEL[arende.upphandling.typ] ?? "Ny upphandling"} />
            <Field label="Upphandlingslag:" value={UPPHANDLINGSLAG_LABEL[arende.upphandling.upphandlingslag] ?? "—"} />
          </dl>
        </section>

        <section className="border border-[#c5c6c9] rounded-lg p-6">
          <h2 className="text-[28px] font-bold text-[#2a2b2d] mb-1">Yttranden</h2>
          <p className="text-[#2a2b2d] mb-4">Myndigheternas yttranden och kontrollresultat</p>
          <hr className="border-[#d3d3d3] mb-6" />

          {arende.leverantorer.slice(0, 3).map((lev, i) => (
            <div key={lev.orgnr} className={i > 0 ? "mt-8" : ""}>
              <h3 className="text-[24px] font-bold text-[#2a2b2d] mb-1">{lev.namn}</h3>
              <p className="text-[16px] text-black mb-4">{lev.orgnr}</p>

              <div className="flex flex-col gap-4">
                {MYNDIGHETER.map((m) => (
                  <div
                    key={m.namn}
                    className="bg-[#fefcf4] border border-[#c5c6c9] rounded-lg p-6"
                  >
                    <h4 className="text-[20px] font-bold text-[#2a2b2d] mb-1">{m.namn}</h4>
                    <p className="text-[#2a2b2d]">{m.info}</p>
                    <p className="text-[#8a8d93] text-[14px] mt-1">
                      Kontrollerad {(arende.klarDatum ?? arende.datum).split(",")[0]}, Kl. 13.37
                    </p>
                    <p className="text-[#2a2b2d] mt-3">{m.yttrande}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {arende.leverantorer.length > 3 && (
            <p className="text-[#4c4e52] italic mt-6">
              … och {arende.leverantorer.length - 3} ytterligare leverantör{arende.leverantorer.length - 3 === 1 ? "" : "er"} med motsvarande yttranden.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[#2a2b2d]">{label}</dt>
      <dd className="text-[#2a2b2d]">{value}</dd>
    </div>
  );
}
