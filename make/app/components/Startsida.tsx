import heroPersoner from "../../imports/Personer_p__m_te_-_original__1548186___1_.jpg";
import {
  ShieldCheck,
  Search,
  FileCheck2,
  Building2,
  ArrowRight,
  LogIn,
  ListChecks,
  PlusCircle,
  ExternalLink,
  Info,
  Scale,
  Users,
} from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1508189860359-777d945909ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1600&q=80";
const OM_IMG =
  "https://images.unsplash.com/photo-1758518730384-be3d205838e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200&q=80";

interface Props {
  isInloggad: boolean;
  onLoggaIn: () => void;
  onSkapaNytt: () => void;
  onVisaListan: () => void;
  antalArenden: number;
  antalPagaende: number;
}

export function Startsida({
  isInloggad,
  onLoggaIn,
  onSkapaNytt,
  onVisaListan,
  antalArenden,
  antalPagaende,
}: Props) {
  return (
    <div className="bg-white">
      {isInloggad ? (
        <InloggadHero
          onSkapaNytt={onSkapaNytt}
          onVisaListan={onVisaListan}
          antalArenden={antalArenden}
          antalPagaende={antalPagaende}
        />
      ) : (
        <UtloggadHero onLoggaIn={onLoggaIn} />
      )}

      <Nyheter />
      <Divider />
      <OmTjansten />
      <Divider />
      <SaFungerarDet />
      <Divider />
      <LasMer />
    </div>
  );
}

function UtloggadHero({ onLoggaIn }: { onLoggaIn: () => void }) {
  return (
    <section className="bg-gradient-to-br from-[#002857] to-[#003d7a] text-white">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24 py-24 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <span className="inline-block bg-white/15 text-white text-[14px] font-semibold px-3 py-1 rounded-full mb-4">
            E-tjänst för upphandlande organisationer
          </span>
          <h1
            className="text-[48px] md:text-[56px] font-bold leading-[1.1] mb-4"
            style={{ fontFamily: '"Bolagsverket Sans", Inter, sans-serif' }}
          >
            Samordnad registerkontroll
            <br />
            av leverantörer
          </h1>
          <p className="text-[18px] text-[#cfe0f3] mb-8 max-w-[640px]">
            En tjänst från Bolagsverket som samordnar kontroller hos flera myndigheter
            <br />
            – så att du som upphandlare snabbt och rättssäkert kan kontrollera om en
            leverantör uppfyller kraven för offentlig upphandling.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onLoggaIn}
              className="inline-flex items-center gap-2 bg-white text-[#002857] px-6 py-3 rounded font-semibold hover:bg-[#e9eef5]"
            >
              <LogIn className="w-5 h-5" />
              Logga in med BankID
            </button>
            <a
              href="#om-tjansten"
              className="inline-flex items-center gap-2 border-2 border-white/60 text-white px-6 py-3 rounded font-semibold hover:bg-white/10"
            >
              Läs mer om tjänsten
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <p className="text-[14px] text-[#cfe0f3] mt-6">
            Tjänsten är under utveckling och används just nu i pilotform tillsammans
            <br />
            med utvalda upphandlande myndigheter.
          </p>
          <p className="text-[14px] text-white mt-4">
            Saknar du behörighet?{" "}
            <a href="#" className="text-white underline hover:no-underline">
              Läs om hur din organisation ansluter
            </a>
          </p>
        </div>

        <div className="rounded-lg overflow-hidden shadow-2xl">
          <img
            src={heroPersoner}
            alt="Personer i möte"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function InloggadHero({
  onSkapaNytt,
  onVisaListan,
  antalArenden,
  antalPagaende,
}: {
  onSkapaNytt: () => void;
  onVisaListan: () => void;
  antalArenden: number;
  antalPagaende: number;
}) {
  return (
    <section className="relative overflow-hidden bg-[#002857] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#002857] via-[#002857]/90 to-[#003d7a]/70" aria-hidden />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-24 py-20">
        <h1 className="text-[40px] md:text-[48px] font-bold leading-[1.1] mb-3">
          Välkommen tillbaka
        </h1>
        <p className="text-[18px] text-[#cfe0f3] mb-10 max-w-[700px]">
          Här skapar och följer du registerkontroller av leverantörer. Tjänsten
          samordnar uppgifter från flera myndigheter åt dig – allt i ett ärende.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            icon={<PlusCircle className="w-6 h-6" />}
            title="Skapa registerkontroll"
            description="Starta ett nytt ärende för en upphandling och fyll i leverantörer."
            onClick={onSkapaNytt}
            primary
          />
          <ActionCard
            icon={<ListChecks className="w-6 h-6" />}
            title={`Mina registerkontroller (${antalArenden})`}
            description={
              antalPagaende > 0
                ? `${antalPagaende} pågående och ${antalArenden - antalPagaende} klara ärenden.`
                : "Pågående och avslutade ärenden för din organisation."
            }
            onClick={onVisaListan}
          />
          <ActionCard
            icon={<Info className="w-6 h-6" />}
            title="Så fungerar tjänsten"
            description="Läs om processen, vilka myndigheter som ingår och vad du kan förvänta dig."
            href="#sa-fungerar"
          />
        </div>
      </div>
    </section>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  href,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const base = `text-left rounded-lg p-5 border-2 transition group ${
    primary
      ? "bg-white border-white hover:bg-[#e9eef5] text-[#002857]"
      : "bg-white/5 border-white/30 hover:bg-white/10 text-white"
  }`;
  const inner = (
    <>
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 ${
          primary ? "bg-[#ecf7fe] text-[#005299]" : "bg-white/15 text-white"
        }`}
      >
        {icon}
      </div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-[18px]">{title}</h3>
        <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className={`text-[15px] mt-1 ${primary ? "text-[#4c4e52]" : "text-[#cfe0f3]"}`}>
        {description}
      </p>
    </>
  );
  if (href) {
    return (
      <a href={href} className={base}>
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={base}>
      {inner}
    </button>
  );
}

function OmTjansten() {
  return (
    <section id="om-tjansten" className="max-w-[1440px] mx-auto px-8 md:px-24 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <div
            className="aspect-[4/3] rounded-lg bg-cover bg-center shadow-lg"
            style={{ backgroundImage: `url(${OM_IMG})` }}
            aria-hidden
          />
          <div className="hidden lg:block absolute -bottom-6 -right-6 bg-[#002857] text-white rounded-lg p-5 shadow-xl max-w-[260px]">
            <div className="font-bold text-[24px] leading-tight">SOU 2023:43</div>
            <div className="text-[14px] text-[#cfe0f3] mt-1">
              Utredningen som ligger till grund för uppdraget
            </div>
          </div>
        </div>

        <div>
          <span className="inline-block text-[14px] font-semibold text-[#005299] tracking-wide uppercase mb-3">
            Om uppdraget
          </span>
          <h2 className="text-[36px] font-bold text-[#2a2b2d] leading-tight mb-5">
            En samordnad väg till
            <br />
            seriösa leverantörer
          </h2>
          <p className="text-[17px] text-[#2a2b2d] mb-4 leading-relaxed">
            Samordnad registerkontroll är ett regeringsuppdrag till Bolagsverket att
            utveckla en e-tjänst som gör det enklare för upphandlande myndigheter att
            kontrollera leverantörer mot flera registerförande myndigheter samtidigt.
          </p>
          <p className="text-[17px] text-[#4c4e52] leading-relaxed mb-8">
            Syftet är att stärka den offentliga upphandlingen, motverka oseriösa
            aktörer och välfärdsbrottslighet, samt minska den administrativa bördan
            för både myndigheter och leverantörer.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Scale className="w-5 h-5 text-[#005299]" />}
              value="Lagstöd"
              label="Grundat i SOU 2023:43"
            />
            <StatCard
              icon={<Users className="w-5 h-5 text-[#005299]" />}
              value="Samverkan"
              label="Flera myndigheter i en kontroll"
            />
            <StatCard
              icon={<FileCheck2 className="w-5 h-5 text-[#005299]" />}
              value="Ett yttrande"
              label="Ett samlat underlag"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="border-l-4 border-[#005299] pl-3 py-1">
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <div className="font-bold text-[16px] text-[#2a2b2d]">{value}</div>
      </div>
      <div className="text-[13px] text-[#4c4e52]">{label}</div>
    </div>
  );
}

function Divider() {
  return (
    <div className="max-w-[1440px] mx-auto px-8 md:px-24">
      <hr className="border-t border-[#eaebee]" />
    </div>
  );
}

function Nyheter() {
  const nyheter = [
    {
      datum: "2026-05-12",
      kategori: "Lagstiftning",
      titel: "Riksdagen väntas besluta om samordnad registerkontroll",
      text: "Den 27 maj fattar riksdagen beslut om propositionen som ger Bolagsverket utökat ansvar för leverantörskontroll vid offentlig upphandling.",
    },
    {
      datum: "2026-04-03",
      kategori: "Pilot",
      titel: "Fler upphandlande organisationer ansluter till piloten",
      text: "Ytterligare tre regioner och två kommuner har anslutit sig till pilotomgången för att testa tjänsten i skarp upphandling.",
    },
    {
      datum: "2026-03-17",
      kategori: "Proposition",
      titel: "Regeringen lämnar propositionen till riksdagen",
      text: "Propositionen om ett effektivare system för leverantörskontroll bygger på betänkandet SOU 2023:43 och förslår ikraftträdande under hösten 2026.",
    },
    {
      datum: "2026-02-12",
      kategori: "Lagrådet",
      titel: "Lagrådet har granskat förslaget",
      text: "Lagrådet lämnade sitt yttrande över lagrådsremissen den 12 februari. Bolagsverket ses som lämplig huvudman för den nya tjänsten.",
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
          <div className="max-w-[720px]">
            <span className="inline-block text-[14px] font-semibold text-[#005299] tracking-wide uppercase mb-3">
              Nyheter
            </span>
            <h2 className="text-[36px] font-bold text-[#2a2b2d] leading-tight mb-3">
              Senaste om uppdraget
            </h2>
            <p className="text-[17px] text-[#4c4e52] leading-relaxed">
              Följ utvecklingen av samordnad registerkontroll – från utredning till
              skarp e-tjänst.
            </p>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-2 text-[#005299] font-semibold underline hover:no-underline"
          >
            Alla nyheter
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {nyheter.map((n) => (
            <a
              key={n.titel}
              href="#"
              className="group bg-white rounded-lg p-6 border border-[#e5e7eb] hover:border-[#005299] hover:shadow transition flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block bg-[#ecf7fe] text-[#002857] text-[12px] font-semibold uppercase tracking-wide px-2 py-1 rounded">
                  {n.kategori}
                </span>
                <span className="text-[13px] text-[#4c4e52]">{n.datum}</span>
              </div>
              <h3 className="font-bold text-[18px] text-[#2a2b2d] leading-snug mb-2 group-hover:text-[#005299]">
                {n.titel}
              </h3>
              <p className="text-[15px] text-[#4c4e52] flex-1">{n.text}</p>
              <span className="inline-flex items-center gap-1 text-[#005299] font-semibold mt-4 text-[14px]">
                Läs mer
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}


function SaFungerarDet() {
  const steg = [
    {
      icon: <FileCheck2 className="w-6 h-6" />,
      title: "Fyll i upphandlingsuppgifter",
      text: "Ange referens, upphandlingslag och typ av upphandling som kontrollen avser.",
    },
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Lägg till leverantörer",
      text: "Klistra in organisationsnummer för en eller flera leverantörer som ska kontrolleras.",
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: "Vi samordnar kontrollen",
      text: "Bolagsverket hämtar in uppgifter från berörda myndigheter åt dig.",
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Ta del av yttrandet",
      text: "Du får ett samlat yttrande som underlag för bedömning i upphandlingen.",
    },
  ];
  return (
    <section id="sa-fungerar" className="bg-white py-24">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24">
        <div className="max-w-[720px] mb-12">
          <span className="inline-block text-[14px] font-semibold text-[#005299] tracking-wide uppercase mb-3">
            Så fungerar tjänsten
          </span>
          <h2 className="text-[36px] font-bold text-[#2a2b2d] leading-tight mb-3">
            Fyra steg från ärende till yttrande
          </h2>
          <p className="text-[17px] text-[#4c4e52] leading-relaxed">
            Enkelt och samordnat – så att du som upphandlare kan fokusera på det
            som spelar roll:
            <br />
            att hitta rätt leverantör.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steg.map((s, i) => (
            <li
              key={s.title}
              className="bg-white rounded-lg p-6 border border-[#e5e7eb] h-full relative"
            >
              <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-[#002857] text-white font-bold flex items-center justify-center shadow">
                {i + 1}
              </div>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#ecf7fe] text-[#005299] mb-4">
                {s.icon}
              </div>
              <h3 className="font-bold text-[18px] text-[#2a2b2d] mb-1">{s.title}</h3>
              <p className="text-[15px] text-[#4c4e52]">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Myndigheter() {
  const myndigheter = [
    "Bolagsverket",
    "Skatteverket",
    "Kronofogden",
    "Försäkringskassan",
    "Polismyndigheten",
    "Arbetsmiljöverket",
  ];
  return (
    <section className="max-w-[1440px] mx-auto px-8 md:px-24 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
        <div>
          <span className="inline-block text-[14px] font-semibold text-[#005299] tracking-wide uppercase mb-3">
            Samverkan
          </span>
          <h2 className="text-[36px] font-bold text-[#2a2b2d] leading-tight mb-4">
            Myndigheter som samverkar
          </h2>
          <p className="text-[17px] text-[#4c4e52] leading-relaxed">
            Tjänsten utvecklas i samverkan med flera registerförande myndigheter.
            Vilka kontroller som ingår kan komma att utökas över tid.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {myndigheter.map((m) => (
            <div
              key={m}
              className="flex items-center gap-3 bg-white border border-[#e5e7eb] rounded-lg px-4 py-4 hover:border-[#9ec5f0] hover:shadow-sm transition"
            >
              <div className="w-9 h-9 rounded-md bg-[#ecf7fe] text-[#002857] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-semibold text-[#2a2b2d]">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LasMer() {
  const lankar = [
    {
      titel: "Leverantörskontroll – Bolagsverket",
      beskrivning:
        "Bakgrund, status och utveckling av tjänsten samordnad registerkontroll.",
      href: "https://bolagsverket.se/omoss/utvecklingavdigitalatjanster/leverantorskontroll.5512.html",
      kalla: "bolagsverket.se",
    },
    {
      titel: "SOU 2023:43",
      beskrivning:
        "Statens offentliga utredning som ligger till grund för uppdraget om en samordnad kontroll av leverantörer.",
      href: "https://www.regeringen.se/rattsliga-dokument/statens-offentliga-utredningar/2023/08/sou-202343/",
      kalla: "regeringen.se",
    },
  ];
  return (
    <section className="bg-white py-24">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24">
        <div className="max-w-[720px] mb-10">
          <span className="inline-block text-[14px] font-semibold text-[#005299] tracking-wide uppercase mb-3">
            Resurser
          </span>
          <h2 className="text-[36px] font-bold text-[#2a2b2d] leading-tight">Läs mer</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {lankar.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-lg p-6 border border-[#e5e7eb] hover:border-[#005299] hover:shadow transition flex flex-col"
            >
              <div className="text-[13px] uppercase tracking-wide text-[#4c4e52] mb-2">
                {l.kalla}
              </div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-[20px] text-[#002857] group-hover:text-[#005299]">
                  {l.titel}
                </h3>
                <ExternalLink className="w-5 h-5 text-[#005299] shrink-0 mt-1" />
              </div>
              <p className="text-[15px] text-[#4c4e52] mt-3">{l.beskrivning}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
