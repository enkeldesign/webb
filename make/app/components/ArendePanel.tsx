import { useState } from "react";
import { X, Download, ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import type { Arende } from "./ArendeDetalj";

interface Props {
  arende: Arende;
  onStang: () => void;
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

export function ArendePanel({ arende, onStang, onLaddaNer, onMarkeraKlar }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(arende.leverantorer.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = arende.leverantorer.slice(pageStart, pageStart + PAGE_SIZE);
  const isKlar = arende.status === "Klar";

  return (
    <aside className="bg-white border-l border-[#d0d2d7] h-full overflow-y-auto">
      <div className="px-6 py-4 flex items-center gap-2 border-b border-[#eaebee] sticky top-0 bg-white z-10">
        <button
          onClick={onStang}
          aria-label="Stäng detaljpanel"
          className="rounded p-1 hover:bg-[#f4f5f7]"
        >
          <X className="w-5 h-5 text-[#2a2b2d]" />
        </button>
        <h2 className="font-bold text-[20px] text-[#2a2b2d]">
          Registerkontroll {arende.arendenummer}
        </h2>
      </div>

      <div className="px-6 py-6">
        <section className="bg-white rounded-lg border border-[#c5c6c9] px-5 py-4 mb-5">
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-2">
            <Field label="Referens:" value={arende.upphandling.referens || "—"} />
            <Field label="Skapad:" value={arende.datum.split(",")[0]} />
            <Field label="Skapad av:" value={arende.skapadAv ?? "Förnamn Efternamn"} />
            <Field label="Upphandlingstyp:" value={TYP_LABEL[arende.upphandling.typ] ?? "Ny upphandling"} />
            <Field label="Upphandlingslag:" value={UPPHANDLINGSLAG_LABEL[arende.upphandling.upphandlingslag] ?? "—"} />
          </dl>
        </section>

        <section
          className={`rounded-lg border p-5 mb-6 ${
            isKlar ? "bg-[#e8f5ed] border-[#1f7a3a]" : "bg-[#f4f5f7] border-[#c5c6c9]"
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="font-bold text-[22px] text-[#2a2b2d] flex items-center gap-2">
                {isKlar && <CheckCircle2 className="w-6 h-6 text-[#1f7a3a]" />}
                {isKlar ? "Registerkontroll klar" : "Registerkontroll pågår"}
              </h3>
              <p className="text-[#4c4e52] mt-1">
                {isKlar
                  ? "Yttrandet är nu färdigt för nedladdning och granskning"
                  : "Vänligen vänta medan vi samlar in information från myndigheterna"}
              </p>
            </div>
            <button
              onClick={onLaddaNer}
              disabled={!isKlar}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded border-2 font-semibold ${
                isKlar
                  ? "bg-[#005299] border-transparent text-white hover:bg-[#003d73]"
                  : "bg-[#f4f5f7] border-[#c5c6c9] text-[#8a8d93] cursor-not-allowed"
              }`}
            >
              <Download className="w-5 h-5" />
              <span>Ladda ner yttrande</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatusCard
              label={isKlar ? "Rapport/yttrande genererad" : "Registerkontroll startad"}
              value={isKlar ? arende.klarDatum ?? arende.datum : arende.datum}
            />
            <StatusCard
              label={isKlar ? "Leverantörer granskade" : "Leverantörer under granskning"}
              value={`${arende.leverantorer.length} av ${arende.leverantorer.length}`}
            />
          </div>
        </section>

        <section>
          <h3 className="font-bold text-[22px] text-[#2a2b2d] mb-3">
            Leverantörer ({arende.leverantorer.length})
          </h3>
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
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <nav className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-8 h-8 px-2 rounded ${
                      p === page ? "bg-[#005299] text-white font-semibold" : "text-[#005299] hover:bg-[#ecf7fe]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </nav>
              <span className="text-[#4c4e52]">
                Visar {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, arende.leverantorer.length)} av {arende.leverantorer.length}
              </span>
            </div>
          )}
        </section>

        {!isKlar && (
          <div className="pt-6">
            <Button variant="secondary" onClick={onMarkeraKlar} className="min-w-[152px] px-4 py-2">
              Simulera: Markera klar (demo)
            </Button>
          </div>
        )}
      </div>
    </aside>
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

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border border-[#c5c6c9] px-4 py-3">
      <div className="text-[#4c4e52] text-[14px]">{label}</div>
      <div className="font-semibold text-[#2a2b2d] text-[16px]">{value}</div>
    </div>
  );
}
