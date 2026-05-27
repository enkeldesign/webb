import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { TabNav, type TabItem } from "./components/TabNav";
import { Stepper, type Step } from "./components/Stepper";
import { StepUpphandlingsuppgifter, type Upphandling } from "./components/StepUpphandlingsuppgifter";
import { StepLeverantorer, type Leverantor, type OrgError } from "./components/StepLeverantorer";
import { StepGranska } from "./components/StepGranska";
import { Bekraftelse } from "./components/Bekraftelse";
import { ArendePanel } from "./components/ArendePanel";
import type { Arende } from "./components/ArendeDetalj";
import { YttrandePdf } from "./components/YttrandePdf";
import { Startsida } from "./components/Startsida";

type View = "start" | "lista" | "wizard" | "bekraftelse" | "yttrande";

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}, Kl ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

function genArendenummer() {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 8999);
  return `${n}/${year}`;
}

const emptyUpphandling: Upphandling = { referens: "", upphandlingslag: "", typ: "", troskel: "" };

const TYP_LABEL: Record<string, string> = {
  ny: "Ny Upphandling",
  uppfoljning_avtal: "Uppföljning av avtal",
  kontroll_nytt_dis: "Kontroll vid nytt DIS",
  utokad_kontroll_dis: "Utökad Kontroll DIS",
  uppfoljning_dis: "Uppföljning DIS",
};

export default function App() {
  const [startsidaAktiv, setStartsidaAktiv] = useState(false);
  const [lofiMode, setLofiMode] = useState(true);
  const [view, setView] = useState<View>("wizard");
  const [isInloggad, setIsInloggad] = useState(true);

  const handleToggleLofi = () => setLofiMode((v) => !v);

  const handleToggleStartsida = () => {
    setStartsidaAktiv((prev) => {
      const next = !prev;
      if (next) {
        setView("start");
        setIsInloggad(false);
        setValtArendeId(null);
      } else {
        setIsInloggad(true);
        setView("wizard");
      }
      return next;
    });
  };
  const [activeStep, setActiveStepState] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const setActiveStep = (n: number) => {
    setActiveStepState(n);
    setMaxStepReached((m) => Math.max(m, n));
  };
  const [upphandling, setUpphandling] = useState<Upphandling>(emptyUpphandling);
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([]);
  const [orgErrors, setOrgErrors] = useState<OrgError[]>([]);
  const [arenden, setArenden] = useState<Arende[]>([]);
  const [valtArendeId, setValtArendeId] = useState<string | null>(null);
  const [sok, setSok] = useState("");

  const valtArende = arenden.find((a) => a.arendenummer === valtArendeId) ?? null;

  const resetWizard = () => {
    setUpphandling(emptyUpphandling);
    setLeverantorer([]);
    setOrgErrors([]);
    setActiveStepState(1);
    setMaxStepReached(1);
  };

  const handleSubmit = () => {
    const arende: Arende = {
      arendenummer: genArendenummer(),
      datum: formatDate(new Date()),
      upphandling,
      leverantorer,
      status: "Pågående",
      skapadAv: "Urgy Ibo",
    };
    setArenden((prev) => [arende, ...prev]);
    setValtArendeId(arende.arendenummer);
    setView("bekraftelse");
  };

  const handleSkapaNytt = () => {
    resetWizard();
    setValtArendeId(null);
    setView("wizard");
  };

  const handleVisaArende = () => {
    setView("lista");
  };

  const handleMarkeraKlar = () => {
    if (!valtArende) return;
    setArenden((prev) =>
      prev.map((a) =>
        a.arendenummer === valtArende.arendenummer
          ? { ...a, status: "Klar", klarDatum: formatDate(new Date()) }
          : a
      )
    );
  };

  const steps: Step[] = [
    {
      number: 1,
      title: "Upphandlingsuppgifter",
      status: activeStep === 1 ? "active" : "complete",
      onHeaderClick: () => setActiveStepState(1),
      content: (
        <StepUpphandlingsuppgifter
          data={upphandling}
          onChange={setUpphandling}
          onContinue={() => setActiveStep(2)}
          onCancel={() => {
            resetWizard();
            setView("lista");
          }}
        />
      ),
    },
    {
      number: 2,
      title: "Leverantörer",
      status: activeStep === 2 ? "active" : maxStepReached >= 2 ? "complete" : "upcoming",
      onHeaderClick: () => maxStepReached >= 2 && setActiveStepState(2),
      content: (
        <StepLeverantorer
          leverantorer={leverantorer}
          errors={orgErrors}
          onChange={(lev, errs) => {
            setLeverantorer(lev);
            setOrgErrors(errs);
          }}
          onContinue={() => setActiveStep(3)}
          onCancel={() => {
            resetWizard();
            setView("lista");
          }}
        />
      ),
    },
    {
      number: 3,
      title: "Granska och skicka in",
      status: activeStep === 3 ? "active" : maxStepReached >= 3 ? "complete" : "upcoming",
      onHeaderClick: () => maxStepReached >= 3 && setActiveStepState(3),
      content: (
        <StepGranska
          upphandling={upphandling}
          leverantorer={leverantorer}
          onEditUpphandling={() => setActiveStep(1)}
          onEditLeverantorer={() => setActiveStep(2)}
          onSubmit={handleSubmit}
          onCancel={() => {
            resetWizard();
            setView("lista");
          }}
        />
      ),
    },
  ];

  const tabs: TabItem[] = [
    ...(startsidaAktiv ? [{ id: "start", label: "Start" }] : []),
    { id: "lista", label: "Registerkontroller" },
    { id: "wizard", label: "Skapa registerkontroll" },
  ];

  const activeTab =
    view === "wizard" || view === "bekraftelse"
      ? "wizard"
      : view === "start"
      ? "start"
      : "lista";

  const handleTabChange = (id: string) => {
    if (id === "lista") setView("lista");
    else if (id === "wizard") setView("wizard");
    else if (id === "start") setView("start");
  };

  const handleLoggaIn = () => {
    setIsInloggad(true);
  };

  const handleLoggaUt = () => {
    toast.success("Du är nu utloggad.");
    if (!startsidaAktiv) {
      // Startsidan är dold – stanna kvar i inloggat läge
      setView("wizard");
      setValtArendeId(null);
      return;
    }
    setIsInloggad(false);
    setView("start");
    setValtArendeId(null);
  };

  const filtrerade = arenden.filter((a) => {
    const q = sok.trim().toLowerCase();
    if (!q) return true;
    return (
      a.arendenummer.toLowerCase().includes(q) ||
      (a.upphandling.referens ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className={`min-h-screen bg-white flex flex-col ${lofiMode ? "lofi-root" : ""}`}>
      <Toaster position="top-right" richColors offset={70} />
      {view !== "yttrande" && (
        <>
          <Header
            isInloggad={isInloggad}
            onLoggaIn={handleLoggaIn}
            onLoggaUt={handleLoggaUt}
          />
          {isInloggad && (
            <TabNav
              tabs={tabs}
              active={activeTab}
              onChange={handleTabChange}
              isInloggad={isInloggad}
            />
          )}
        </>
      )}

      <main className="flex-1">
        {view === "yttrande" && valtArende ? (
          <YttrandePdf arende={valtArende} onStang={() => setView("lista")} />
        ) : view === "start" ? (
          <Startsida
            isInloggad={isInloggad}
            onLoggaIn={handleLoggaIn}
            onSkapaNytt={handleSkapaNytt}
            onVisaListan={() => setView("lista")}
            antalArenden={arenden.length}
            antalPagaende={arenden.filter((a) => a.status === "Pågående").length}
          />
        ) : !isInloggad ? (
          <Startsida
            isInloggad={false}
            onLoggaIn={handleLoggaIn}
            onSkapaNytt={handleSkapaNytt}
            onVisaListan={() => setView("lista")}
            antalArenden={arenden.length}
            antalPagaende={arenden.filter((a) => a.status === "Pågående").length}
          />
        ) : view === "bekraftelse" && valtArende ? (
          <div className="max-w-[1440px] mx-auto px-8 md:px-24 py-12">
            <Bekraftelse
              arendenummer={valtArende.arendenummer}
              datum={valtArende.datum}
              onVisaArende={handleVisaArende}
              onSkapaNytt={handleSkapaNytt}
            />
          </div>
        ) : view === "wizard" ? (
          <div className="max-w-[1440px] mx-auto px-8 md:px-24 py-12">
            <h1 className="text-[40px] font-bold text-black leading-[56px]">Skapa registerkontroll</h1>
            <p className="text-[16px] text-black mt-2 mb-8">Fyll i uppgifter om din aktuella upphandling för att skapa ett underlag för registerkontroll</p>
            <section className="bg-white rounded-lg p-8 max-w-[900px] shadow-sm border border-[#e5e7eb]">
              <Stepper steps={steps} />
            </section>
          </div>
        ) : (
          <div className={`flex ${valtArende ? "h-[calc(100vh-120px)]" : ""}`}>
            <div className={`${valtArende ? "w-[45%] border-r border-[#d0d2d7] overflow-y-auto" : "w-full"} max-w-[1440px] mx-auto px-8 md:px-24 py-10`}>
              <Registerkontroller
                arenden={filtrerade}
                totalCount={arenden.length}
                valtId={valtArendeId}
                sok={sok}
                onSok={setSok}
                onOpen={(id) => setValtArendeId(id)}
                compact={!!valtArende}
              />
            </div>
            {valtArende && (
              <div className="w-[55%]">
                <ArendePanel
                  arende={valtArende}
                  onStang={() => setValtArendeId(null)}
                  onLaddaNer={() => setView("yttrande")}
                  onMarkeraKlar={handleMarkeraKlar}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {view !== "yttrande" && (
        <Footer
          onToggleStartsida={handleToggleStartsida}
          startsidaAktiv={startsidaAktiv}
          onToggleLofi={handleToggleLofi}
          lofiMode={lofiMode}
        />
      )}
    </div>
  );
}

function Registerkontroller({
  arenden,
  totalCount,
  valtId,
  sok,
  onSok,
  onOpen,
  compact,
}: {
  arenden: Arende[];
  totalCount: number;
  valtId: string | null;
  sok: string;
  onSok: (v: string) => void;
  onOpen: (id: string) => void;
  compact: boolean;
}) {
  return (
    <div className={compact ? "" : "max-w-[1100px]"}>
      <h1 className="text-[40px] font-bold text-black leading-[56px]">Registerkontroller</h1>
      <p className="text-[16px] text-black mt-2 mb-6">
        Här hittar du de pågående och avslutade registerkontroller
      </p>

      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <h2 className="font-bold text-[22px] text-[#2a2b2d]">Rubrik</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#4c4e52]" />
          <input
            type="search"
            value={sok}
            onChange={(e) => onSok(e.target.value)}
            placeholder="Sök"
            className="bg-white rounded border border-[#8a8d93] pl-9 pr-3 py-2 outline-none focus:border-[#005299] w-[220px]"
          />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg p-8 text-[#4c4e52]">
          Inga registerkontroller att visa ännu.
        </div>
      ) : (
        <div className="border border-[#d0d2d7] rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f4f5f7] border-b border-[#d0d2d7]">
                <th className="text-left px-3 py-2 font-semibold">Datum</th>
                <th className="text-left px-3 py-2 font-semibold">Ärendenummer</th>
                <th className="text-left px-3 py-2 font-semibold">Referens</th>
                {!compact && <th className="text-left px-3 py-2 font-semibold">Typ</th>}
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {arenden.map((a) => {
                const isSelected = a.arendenummer === valtId;
                return (
                  <tr
                    key={a.arendenummer}
                    onClick={() => onOpen(a.arendenummer)}
                    className={`border-b border-[#eaebee] last:border-b-0 cursor-pointer ${
                      isSelected ? "bg-[#ecf7fe]" : "hover:bg-[#f9fafb]"
                    }`}
                  >
                    <td className="px-3 py-2">{a.datum.split(",")[0]}</td>
                    <td className="px-3 py-2 text-[#005299] underline">{a.arendenummer}</td>
                    <td className="px-3 py-2">{a.upphandling.referens || "—"}</td>
                    {!compact && (
                      <td className="px-3 py-2">{TYP_LABEL[a.upphandling.typ] ?? "—"}</td>
                    )}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[14px] font-semibold ${
                          a.status === "Klar"
                            ? "bg-[#e8f5ed] text-[#1f5a2d]"
                            : "bg-[#fff4d6] text-[#6b4d00]"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[#4c4e52]">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })}
              {arenden.length === 0 && (
                <tr>
                  <td colSpan={compact ? 5 : 6} className="px-3 py-3 italic text-[#4c4e52]">
                    Inga träffar för "{sok}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
