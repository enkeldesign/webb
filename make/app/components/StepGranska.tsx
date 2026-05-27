import { useState } from "react";
import { Info, CheckCircle2, Pencil, ArrowUpDown } from "lucide-react";
import { Button } from "./Button";
import type { Upphandling } from "./StepUpphandlingsuppgifter";
import type { Leverantor } from "./StepLeverantorer";

interface Props {
  upphandling: Upphandling;
  leverantorer: Leverantor[];
  onEditUpphandling: () => void;
  onEditLeverantorer: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const UPPHANDLINGSLAG_LABEL: Record<string, string> = {
  LOU: "LOU",
  LUF: "LUF",
  LUK: "LUK",
  LUFS: "LUFS",
};
const TYP_LABEL: Record<string, string> = {
  ny: "Ny Upphandling",
  uppfoljning_avtal: "Uppföljning av avtal",
  kontroll_nytt_dis: "Kontroll vid nytt DIS",
  utokad_kontroll_dis: "Utökad Kontroll DIS",
  uppfoljning_dis: "Uppföljning DIS",
};
const TROSKEL_LABEL: Record<string, string> = {
  over: "Över tröskelvärde",
  under: "Under tröskelvärde",
};

const PAGE_SIZE = 10;

export function StepGranska({
  upphandling,
  leverantorer,
  onEditUpphandling,
  onEditLeverantorer,
  onSubmit,
  onCancel,
}: Props) {
  const [intygar, setIntygar] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(leverantorer.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = leverantorer.slice(pageStart, pageStart + PAGE_SIZE);

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

  return (
    <div className="flex flex-col gap-6 max-w-[780px]">
      <div className="bg-[#ecf7fe] border-2 border-[#0065bd] border-l-[12px] rounded-sm px-6 py-4 flex items-center gap-3">
        <Info className="w-6 h-6 text-[#0065bd] shrink-0" />
        <p className="text-[#1c398e] text-[16px]">Kontrollera att alla uppgifter stämmer innan du skickar.</p>
      </div>

      <section>
        <div className="flex items-center justify-between border-b border-[#d0d2d7] pb-2 mb-4">
          <h2 className="font-bold text-[20px] text-[#2a2b2d]">Upphandlingsuppgifter</h2>
          <button
            onClick={onEditUpphandling}
            className="inline-flex items-center gap-1 text-[#005299] underline hover:text-[#003d73]"
          >
            <Pencil className="w-4 h-4" />
            <span>Redigera</span>
          </button>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <SummaryItem label="Referens" value={upphandling.referens || "—"} />
          <SummaryItem label="Upphandlingslag" value={UPPHANDLINGSLAG_LABEL[upphandling.upphandlingslag] ?? "—"} />
          <SummaryItem label="Typ av upphandling" value={TYP_LABEL[upphandling.typ] ?? "—"} />
          <SummaryItem label="Tröskelvärde" value={TROSKEL_LABEL[upphandling.troskel] ?? "—"} />
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#d0d2d7] pb-2 mb-4">
          <h2 className="font-bold text-[20px] text-[#2a2b2d]">Leverantörer</h2>
          <button
            onClick={onEditLeverantorer}
            className="inline-flex items-center gap-1 text-[#005299] underline hover:text-[#003d73]"
          >
            <Pencil className="w-4 h-4" />
            <span>Redigera</span>
          </button>
        </div>

        <div className="border-2 border-[#1f7a3a] bg-[#e8f5ed] rounded px-4 py-2 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#1f7a3a]" />
          <span className="text-[#1f5a2d]">
            {leverantorer.length} leverantör{leverantorer.length === 1 ? "" : "er"} kommer att kontrolleras
          </span>
        </div>

        <div className="border border-[#d0d2d7] rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f4f5f7] border-b border-[#d0d2d7]">
                <th className="text-left px-3 py-2 font-semibold text-[#2a2b2d]">
                  <span className="inline-flex items-center gap-1">Organisationsnummer <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-left px-3 py-2 font-semibold text-[#2a2b2d]">
                  <span className="inline-flex items-center gap-1">Företagsnamn <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-left px-3 py-2 font-semibold text-[#2a2b2d]">
                  <span className="inline-flex items-center gap-1">Företagsform <ArrowUpDown className="w-3 h-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-[#4c4e52] italic">Inga leverantörer tillagda</td>
                </tr>
              ) : (
                pageItems.map((l) => (
                  <tr key={l.orgnr} className="border-b border-[#eaebee] last:border-b-0">
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.orgnr}</td>
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.namn}</td>
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.form}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {leverantorer.length > PAGE_SIZE && (
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
              Visar {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, leverantorer.length)} av {leverantorer.length} leverantörer
            </span>
          </div>
        )}
      </section>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={intygar}
          onChange={(e) => setIntygar(e.target.checked)}
          className="mt-1 w-5 h-5 accent-[#005299]"
        />
        <span className="text-[#2a2b2d]">
          Jag intygar att uppgifterna är korrekta och är medveten om att inskickad kontroll inte kan ändras.
        </span>
      </label>

      <div className="flex gap-4 pt-2 pb-4">
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!intygar || leverantorer.length === 0}
          className={!intygar || leverantorer.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
        >
          Skicka
        </Button>
        <Button variant="secondary" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-[#2a2b2d] text-[16px]">{label}</dt>
      <dd className="text-[#2a2b2d] text-[16px]">{value}</dd>
    </div>
  );
}
