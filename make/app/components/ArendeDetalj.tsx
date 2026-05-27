import { useState } from "react";
import { ChevronLeft, Download, ArrowUpDown } from "lucide-react";
import { Button } from "./Button";
import type { Leverantor } from "./StepLeverantorer";
import type { Upphandling } from "./StepUpphandlingsuppgifter";

export interface Arende {
  arendenummer: string;
  datum: string;
  upphandling: Upphandling;
  leverantorer: Leverantor[];
  status: "Pågående" | "Klar";
  klarDatum?: string;
  skapadAv?: string;
}

interface Props {
  arende: Arende;
  onTillbaka: () => void;
  onLaddaNer: () => void;
  onMarkeraKlar: () => void;
}

const UPPHANDLINGSLAG_LABEL: Record<string, string> = { LOU: "LOU", LUF: "LUF", LUK: "LUK", LUFS: "LUFS" };
const TYP_LABEL: Record<string, string> = {
  ny: "Ny Upphandling",
  uppfoljning_avtal: "Uppföljning av avtal",
  kontroll_nytt_dis: "Kontroll vid nytt DIS",
  utokad_kontroll_dis: "Utökad Kontroll DIS",
  uppfoljning_dis: "Uppföljning DIS",
};

const PAGE_SIZE = 10;

export function ArendeDetalj({ arende, onTillbaka, onLaddaNer, onMarkeraKlar }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(arende.leverantorer.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = arende.leverantorer.slice(pageStart, pageStart + PAGE_SIZE);

  const pageNumbers: (number | "...")[] = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const result: (number | "...")[] = [1, 2, 3];
    if (page > 3 && page < totalPages - 2) {
      if (page > 4) result.push("...");
      result.push(page);
      if (page < totalPages - 3) result.push("...");
    } else {
      result.push("...");
    }
    result.push(totalPages);
    return Array.from(new Set(result));
  })();

  const isKlar = arende.status === "Klar";

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[40px] font-bold text-black leading-[56px]">
          Registerkontroll {arende.arendenummer}
        </h1>
        <button
          onClick={onTillbaka}
          className="inline-flex items-center gap-2 bg-[#ecf7fe] border-2 border-[#0065bd] text-[#0065bd] px-4 py-2 rounded hover:bg-[#d9edfc]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Tillbaka</span>
        </button>
      </div>

      <section className="bg-white rounded-lg border border-[#c5c6c9] px-6 py-4 mb-6">
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-2">
          <SummaryItem label="Referens:" value={arende.upphandling.referens || "—"} />
          <SummaryItem label="Skapad:" value={arende.datum.split(",")[0]} />
          <SummaryItem label="Skapad av:" value={arende.skapadAv ?? "Förnamn Efternamn"} />
          <SummaryItem label="Upphandlingstyp:" value={TYP_LABEL[arende.upphandling.typ] ?? "Ny upphandling"} />
          <SummaryItem label="Upphandlingslag:" value={UPPHANDLINGSLAG_LABEL[arende.upphandling.upphandlingslag] ?? "—"} />
        </dl>
      </section>

      <section
        className={`rounded-lg border p-6 mb-8 ${
          isKlar ? "bg-[#e8f5ed] border-[#1f7a3a]" : "bg-[#f4f5f7] border-[#c5c6c9]"
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-bold text-[24px] text-[#2a2b2d]">
              {isKlar ? "Alla kontroller klara" : "Registerkontroll pågår"}
            </h2>
            <p className="text-[#4c4e52] text-[16px] mt-1">
              {isKlar
                ? "Yttrandet är nu färdigt för nedladdning och granskning."
                : "Vänligen vänta medan vi samlar in information från myndigheterna."}
            </p>
          </div>
          <button
            onClick={onLaddaNer}
            disabled={!isKlar}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded border-2 font-semibold ${
              isKlar
                ? "bg-[#005299] border-transparent text-white hover:bg-[#003d73]"
                : "bg-[#f4f5f7] border-[#c5c6c9] text-[#8a8d93] cursor-not-allowed"
            }`}
          >
            <Download className="w-5 h-5" />
            <span>Ladda ner yttrande</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusCard
            label={isKlar ? "Rapport/yttrande genererad" : "Registerkontroll startad"}
            value={isKlar ? arende.klarDatum ?? arende.datum : arende.datum}
          />
          <StatusCard
            label={isKlar ? "Leverantörer granskade" : "Leverantörer under granskning"}
            value={`${arende.leverantorer.length} stycken`}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-[24px] text-[#2a2b2d] mb-3">
          Leverantörer ({arende.leverantorer.length})
        </h2>
        <div className="border border-[#d0d2d7] rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f4f5f7] border-b border-[#d0d2d7]">
                <th className="text-left px-3 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1">Organisationsnummer <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1">Företagsnamn <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1">Företagsform <ArrowUpDown className="w-3 h-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l) => (
                <tr key={l.orgnr} className="border-b border-[#eaebee] last:border-b-0">
                  <td className="px-3 py-2">{l.orgnr}</td>
                  <td className="px-3 py-2">{l.namn}</td>
                  <td className="px-3 py-2">{l.form}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {arende.leverantorer.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3">
            <nav className="flex items-center gap-1">
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="px-2 text-[#4c4e52]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-8 h-8 px-2 rounded ${
                      p === page ? "bg-[#005299] text-white font-semibold" : "text-[#005299] hover:bg-[#ecf7fe]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="ml-2 px-2 h-8 text-[#005299] hover:bg-[#ecf7fe] disabled:opacity-40 disabled:cursor-not-allowed rounded"
              >
                Nästa ›
              </button>
            </nav>
            <span className="text-[#4c4e52]">
              Visar {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, arende.leverantorer.length)} av {arende.leverantorer.length} leverantörer
            </span>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={onTillbaka}
          className="inline-flex items-center gap-2 bg-[#ecf7fe] border-2 border-[#0065bd] text-[#0065bd] px-4 py-2 rounded hover:bg-[#d9edfc]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Tillbaka</span>
        </button>

        {!isKlar && (
          <Button variant="secondary" onClick={onMarkeraKlar} className="min-w-[152px] px-4 py-2">
            Simulera: Markera klar (demo)
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[#2a2b2d]">{label}</dt>
      <dd className="text-[#2a2b2d]">{value}</dd>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border border-[#c5c6c9] px-4 py-3">
      <div className="text-[#4c4e52] text-[14px]">{label}</div>
      <div className="font-semibold text-[#2a2b2d] text-[16px]">{value}</div>
    </div>
  );
}
