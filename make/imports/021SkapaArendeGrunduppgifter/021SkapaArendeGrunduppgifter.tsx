import svgPaths from "./svg-mvtmv0q1r5";

function Frame13() {
  return (
    <div className="absolute content-stretch flex items-center justify-center left-[95px] pb-[16px] pt-[48px] top-[91px]">
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[40px] text-black text-center whitespace-nowrap">
        <p className="leading-[56px]">Skapa registerkontroll</p>
      </div>
    </div>
  );
}

function Steg() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[32px]" data-name="Steg">
      <div aria-hidden="true" className="absolute border-2 border-[#4c4e52] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
        <p className="leading-[24px]">1</p>
      </div>
    </div>
  );
}

function Linje() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center min-h-[13px] relative w-full" data-name="Linje">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px relative w-0" style={{ containerType: "size", "--transform-inner-width": "285", "--transform-inner-height": "21" } as React.CSSProperties}>
        <div className="flex-none rotate-90 w-[100cqh]">
          <div className="h-0 relative w-full" data-name="Vertikal linje">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 2">
                <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x2="13" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vansterkolumn() {
  return (
    <div className="relative self-stretch shrink-0" data-name="Vänsterkolumn">
      <div className="flex flex-col items-center size-full">
        <div className="content-stretch flex flex-col gap-[4px] items-center pt-[21px] relative size-full">
          <Steg />
          <Linje />
        </div>
      </div>
    </div>
  );
}

function Stegtext() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal gap-[4px] items-start relative shrink-0 text-[#4c4e52] whitespace-nowrap" data-name="Stegtext">
      <p className="relative shrink-0">Steg</p>
      <p className="relative shrink-0">1</p>
      <p className="relative shrink-0">av</p>
      <p className="relative shrink-0">3</p>
    </div>
  );
}

function Texter() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start leading-[24px] min-w-px not-italic relative self-stretch text-[16px]" data-name="Texter">
      <Stegtext />
      <p className="font-['Inter:Bold',sans-serif] font-bold min-w-full relative shrink-0 text-[#2a2b2d] w-[min-content]">Upphandlingsuppgifter</p>
    </div>
  );
}

function Linje1() {
  return (
    <div className="relative self-stretch shrink-0 w-[32px]" data-name="Linje">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 524">
        <g id="Linje">
          <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x1="17" x2="17" y1="4.37114e-08" y2="524" />
        </g>
      </svg>
    </div>
  );
}

function Tooltip() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[24px]" data-name="Tooltip">
      <div className="relative shrink-0 size-[20px]" data-name="tooltip">
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
          <div className="absolute inset-[4.39%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.2422 18.2422">
              <path d={svgPaths.p15818300} fill="var(--fill-0, #005299)" id="Vector" />
            </svg>
          </div>
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path clipRule="evenodd" d={svgPaths.p12391980} fill="var(--fill-0, #005299)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="i">
          <div className="absolute inset-[42.06%_44.58%_24.21%_44.58%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.16797 6.7457">
              <path d={svgPaths.p280ea580} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
          <div className="absolute inset-[24.21%_44.32%_64.43%_44.32%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.27266 2.27266">
              <path d={svgPaths.p30988d00} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtikettRubrik() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Etikett-rubrik">
      <div className="flex flex-[1_0_0] flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Referens</p>
      </div>
      <Tooltip />
    </div>
  );
}

function Tooltip1() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[24px]" data-name="Tooltip">
      <div className="relative shrink-0 size-[20px]" data-name="tooltip">
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
          <div className="absolute inset-[4.39%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.2422 18.2422">
              <path d={svgPaths.p15818300} fill="var(--fill-0, #4A52B6)" id="Vector" />
            </svg>
          </div>
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path clipRule="evenodd" d={svgPaths.p12391980} fill="var(--fill-0, #4A52B6)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="i">
          <div className="absolute inset-[42.06%_44.58%_24.21%_44.58%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.16797 6.7457">
              <path d={svgPaths.p280ea580} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
          <div className="absolute inset-[24.21%_44.32%_64.43%_44.32%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.27266 2.27266">
              <path d={svgPaths.p30988d00} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtikettRubrik1() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Etikett-rubrik">
      <div className="flex flex-[1_0_0] flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Upphandlingslag</p>
      </div>
      <Tooltip1 />
    </div>
  );
}

function Dropplista() {
  return (
    <div className="bg-white relative rounded-[4px] shrink-0 w-full" data-name="Dropplista">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="px-[12px] py-[8px] size-full">
          <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
            <p className="leading-[24px]">Välj</p>
          </div>
          <div className="overflow-clip relative shrink-0 size-[24px]" data-name="arrow-down">
            <div className="absolute inset-[24.02%_7.29%_24.22%_7.42%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.4697 12.4224">
                <path d={svgPaths.p1c1a64f0} fill="var(--fill-0, black)" id="Vector" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[#808289] border-solid inset-0 pointer-events-none rounded-[4px]" />
    </div>
  );
}

function Tooltip2() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[24px]" data-name="Tooltip">
      <div className="relative shrink-0 size-[20px]" data-name="tooltip">
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
          <div className="absolute inset-[4.39%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.2422 18.2422">
              <path d={svgPaths.p15818300} fill="var(--fill-0, #4A52B6)" id="Vector" />
            </svg>
          </div>
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path clipRule="evenodd" d={svgPaths.p12391980} fill="var(--fill-0, #4A52B6)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="i">
          <div className="absolute inset-[42.06%_44.58%_24.21%_44.58%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.16797 6.7457">
              <path d={svgPaths.p280ea580} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
          <div className="absolute inset-[24.21%_44.32%_64.43%_44.32%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.27266 2.27266">
              <path d={svgPaths.p30988d00} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtikettRubrik2() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Etikett-rubrik">
      <div className="flex flex-[1_0_0] flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Typ av upphandling</p>
      </div>
      <Tooltip2 />
    </div>
  );
}

function Dropplista1() {
  return (
    <div className="bg-white relative rounded-[4px] shrink-0 w-full" data-name="Dropplista">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="px-[12px] py-[8px] size-full">
          <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
            <p className="leading-[24px]">Välj</p>
          </div>
          <div className="overflow-clip relative shrink-0 size-[24px]" data-name="arrow-down">
            <div className="absolute inset-[24.02%_7.29%_24.22%_7.42%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.4697 12.4224">
                <path d={svgPaths.p1c1a64f0} fill="var(--fill-0, black)" id="Vector" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[#808289] border-solid inset-0 pointer-events-none rounded-[4px]" />
    </div>
  );
}

function Tooltip3() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[24px]" data-name="Tooltip">
      <div className="relative shrink-0 size-[20px]" data-name="tooltip">
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
          <div className="absolute inset-[4.39%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.2422 18.2422">
              <path d={svgPaths.p15818300} fill="var(--fill-0, #4A52B6)" id="Vector" />
            </svg>
          </div>
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path clipRule="evenodd" d={svgPaths.p12391980} fill="var(--fill-0, #4A52B6)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
        <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="i">
          <div className="absolute inset-[42.06%_44.58%_24.21%_44.58%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.16797 6.7457">
              <path d={svgPaths.p280ea580} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
          <div className="absolute inset-[24.21%_44.32%_64.43%_44.32%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.27266 2.27266">
              <path d={svgPaths.p30988d00} fill="var(--fill-0, white)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtikettRubrik3() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Etikett-rubrik">
      <div className="flex flex-[1_0_0] flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Är upphandlingen över eller under tröskelvärde?</p>
      </div>
      <Tooltip3 />
    </div>
  );
}

function Dropplista2() {
  return (
    <div className="bg-white relative rounded-[4px] shrink-0 w-full" data-name="Dropplista">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="px-[12px] py-[8px] size-full">
          <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
            <p className="leading-[24px]">Välj</p>
          </div>
          <div className="overflow-clip relative shrink-0 size-[24px]" data-name="arrow-down">
            <div className="absolute inset-[24.02%_7.29%_24.22%_7.42%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.4697 12.4224">
                <path d={svgPaths.p1c1a64f0} fill="var(--fill-0, black)" id="Vector" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[#808289] border-solid inset-0 pointer-events-none rounded-[4px]" />
    </div>
  );
}

function Knappar() {
  return (
    <div className="content-stretch flex gap-[16px] items-start pb-[32px] pt-[16px] relative shrink-0" data-name="Knappar">
      <div className="bg-[#005299] content-stretch flex gap-[8px] items-center justify-center min-w-[152px] px-[26px] py-[20px] relative rounded-[4px] shrink-0" data-name="Primär">
        <div aria-hidden="true" className="absolute border-2 border-[rgba(255,255,255,0)] border-solid inset-0 pointer-events-none rounded-[4px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.3)]" />
        <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white whitespace-nowrap">
          <p className="leading-[20px]">Fortsätt</p>
        </div>
      </div>
      <div className="bg-[#ecf7fe] content-stretch flex gap-[8px] items-center justify-center min-w-[152px] px-[26px] py-[20px] relative rounded-[4px] shrink-0" data-name="Sekundär">
        <div aria-hidden="true" className="absolute border-2 border-[#0065bd] border-solid inset-0 pointer-events-none rounded-[4px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.3)]" />
        <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#0065bd] text-[16px] text-center whitespace-nowrap">
          <p className="leading-[20px]">Avbryt</p>
        </div>
      </div>
    </div>
  );
}

function Innehall() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[32px] items-start min-w-px pt-[16px] relative" data-name="Innehåll">
      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Inmatningsfält - med etikett">
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Etikett">
          <EtikettRubrik />
        </div>
        <div className="h-[40px] relative rounded-[4px] shrink-0 w-full" data-name="Inmatningsfält - enkelt">
          <div aria-hidden="true" className="absolute bg-white inset-0 pointer-events-none rounded-[4px]" />
          <div className="overflow-clip rounded-[inherit] size-full">
            <div className="content-stretch flex flex-col items-start px-[12px] py-[8px] relative size-full">
              <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] w-full">
                <p className="leading-[24px]">Fyll i referens</p>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_3px_2px_0px_rgba(0,0,0,0.1)]" />
          <div aria-hidden="true" className="absolute border-2 border-[#8a8d93] border-solid inset-0 pointer-events-none rounded-[4px]" />
        </div>
      </div>
      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Dropplista">
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Etikett">
          <EtikettRubrik1 />
        </div>
        <Dropplista />
      </div>
      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Dropplista">
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Etikett">
          <EtikettRubrik2 />
        </div>
        <Dropplista1 />
      </div>
      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Dropplista">
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Etikett">
          <EtikettRubrik3 />
        </div>
        <Dropplista2 />
      </div>
      <Knappar />
    </div>
  );
}

function InnehallOppetSteg() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Innehåll - öppet steg">
      <Linje1 />
      <Innehall />
    </div>
  );
}

function LinjeFore() {
  return (
    <div className="h-[9px] relative shrink-0 w-[26px]" data-name="Linje (före)">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 26 9">
        <g id="Linje (fÃ¶re)">
          <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x1="14" x2="14" y1="4.37114e-08" y2="9" />
        </g>
      </svg>
    </div>
  );
}

function Steg1() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[32px]" data-name="Steg">
      <div aria-hidden="true" className="absolute border-2 border-[#4c4e52] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
        <p className="leading-[24px]">2</p>
      </div>
    </div>
  );
}

function LinjeEfter() {
  return (
    <div className="flex-[1_0_0] min-h-[9px] relative w-[26px]" data-name="Linje (efter)">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 26 10">
        <g id="Linje (efter)">
          <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x1="14" x2="14" y1="4.37114e-08" y2="10" />
        </g>
      </svg>
    </div>
  );
}

function Vansterkolumn1() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-center relative self-stretch shrink-0" data-name="Vänsterkolumn">
      <LinjeFore />
      <Steg1 />
      <LinjeEfter />
    </div>
  );
}

function Text() {
  return (
    <div className="flex-[1_0_0] min-w-px relative self-stretch" data-name="Text">
      <div className="content-stretch flex flex-col items-start pb-[18px] pt-[17px] relative size-full">
        <p className="font-['Inter:Bold',sans-serif] font-bold leading-[24px] not-italic relative shrink-0 text-[#4c4e52] text-[16px] w-full">Leverantörer</p>
      </div>
    </div>
  );
}

function Linje2() {
  return (
    <div className="h-[9px] relative shrink-0 w-0" data-name="Linje">
      <div className="absolute inset-[0_-2px_0_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2 9">
          <g id="Linje">
            <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x1="1" x2="1" y1="4.37114e-08" y2="9" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Steg2() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[32px]" data-name="Steg">
      <div aria-hidden="true" className="absolute border-2 border-[#4c4e52] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
        <p className="leading-[24px]">3</p>
      </div>
    </div>
  );
}

function Vansterkolumn2() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-full items-center relative shrink-0" data-name="Vänsterkolumn">
      <Linje2 />
      <Steg2 />
    </div>
  );
}

function Rubrik() {
  return (
    <div className="flex-[1_0_0] h-full min-w-px relative" data-name="Rubrik">
      <div className="flex flex-col items-end size-full">
        <div className="content-stretch flex flex-col items-end pt-[17px] relative size-full">
          <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-end leading-[0] not-italic relative shrink-0 text-[#4c4e52] text-[16px] w-full">
            <p className="leading-[24px]">Granska och skicka in</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function KommandeSteg() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Kommande steg">
      <div className="content-stretch flex gap-[8px] h-[59px] items-start min-h-[58px] relative shrink-0 w-[327px]" data-name="Kommande steg">
        <Vansterkolumn1 />
        <Text />
      </div>
      <div className="content-stretch flex gap-[8px] h-[45px] items-center relative shrink-0 w-[289px]" data-name="Kommande steg">
        <div className="flex flex-row items-center self-stretch">
          <Vansterkolumn2 />
        </div>
        <div className="flex flex-[1_0_0] flex-row items-center self-stretch">
          <Rubrik />
        </div>
      </div>
    </div>
  );
}

function Desktop() {
  return (
    <div className="content-stretch flex flex-col items-start py-[8px] relative shrink-0 w-[704px]" data-name="Desktop">
      <div className="content-stretch flex gap-[8px] h-[70px] items-start min-h-[70px] relative shrink-0 w-[327px]" data-name="Öppet steg">
        <Vansterkolumn />
        <Texter />
      </div>
      <InnehallOppetSteg />
      <KommandeSteg />
    </div>
  );
}

function Kort() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col gap-[16px] items-start left-[95px] p-[32px] rounded-[8px] top-[282px]" data-name="Kort">
      <Desktop />
    </div>
  );
}

function Lankobjekt() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Första</p>
      </div>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Lankobjekt1() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[13px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div aria-hidden="true" className="absolute border-[#005299] border-b-5 border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Andra</p>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt1 />
    </div>
  );
}

function Lankobjekt2() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Tredje</p>
      </div>
    </div>
  );
}

function Frame5() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt2 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Lankobjekt3() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Fjärde</p>
      </div>
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt3 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Lankobjekt4() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Femte</p>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt4 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Lankobjekt5() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Sjätte</p>
      </div>
    </div>
  );
}

function Frame8() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt5 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Lankobjekt6() {
  return (
    <div className="content-stretch flex items-center justify-center pb-[8px] pt-[14px] relative shrink-0" data-name="Länkobjekt">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] text-center whitespace-nowrap">
        <p className="leading-[normal]">Sjunde</p>
      </div>
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt6 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Group() {
  return (
    <div className="flex-[1_0_0] grid-rows-[max-content] inline-grid min-w-px place-items-start relative">
      <div className="col-1 h-[44px] ml-0 mt-0 row-1 w-full" />
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex gap-[4px] h-[40px] items-center justify-center not-italic relative shrink-0 text-black w-[288px] whitespace-nowrap">
      <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center relative shrink-0 text-[12px]">
        <p className="leading-[24px]">Inloggad som:</p>
      </div>
      <div className="flex flex-col font-['Open_Sans:SemiBold',sans-serif] justify-center relative shrink-0 text-[14px]">
        <p className="leading-[24px]">Förnamn Efternamn (Företag)</p>
      </div>
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents inset-[64.52%_0_0_0]">
      <div className="absolute bg-[#eee] content-stretch flex inset-[64.52%_0_0_0] items-end" data-name="Navigationsmeny - Horisontell">
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame3 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame4 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame5 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame6 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame7 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame8 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame9 />
        </div>
      </div>
      <div className="absolute content-stretch flex inset-[64.52%_0_0_68.19%] items-center justify-center leading-[0] px-[12px]" data-name="D / Menyslot">
        <Group />
        <Frame10 />
      </div>
    </div>
  );
}

function BolagsverketLogo() {
  return (
    <div className="h-[25px] relative shrink-0 w-[150px]" data-name="bolagsverket_logo (1) 5">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 150 25">
        <g id="bolagsverket_logo (1) 5">
          <path d={svgPaths.p20a5e000} fill="var(--fill-0, white)" id="Vector" />
          <path d={svgPaths.p3b60b200} fill="var(--fill-0, white)" id="Vector_2" />
          <path d={svgPaths.p55dbf80} fill="var(--fill-0, white)" id="Vector_3" />
          <path d={svgPaths.p2c41a000} fill="var(--fill-0, white)" id="Vector_4" />
          <path d={svgPaths.p4b04f80} fill="var(--fill-0, white)" id="Vector_5" />
          <path d={svgPaths.pfcf7680} fill="var(--fill-0, white)" id="Vector_6" />
          <path d={svgPaths.p14b680} fill="var(--fill-0, white)" id="Vector_7" />
          <path d={svgPaths.p2acafc00} fill="var(--fill-0, white)" id="Vector_8" />
          <path d={svgPaths.pd8fae80} fill="var(--fill-0, white)" id="Vector_9" />
          <path d={svgPaths.pefc0980} fill="var(--fill-0, white)" id="Vector_10" />
          <path d={svgPaths.p2ff2e100} fill="var(--fill-0, white)" id="Vector_11" />
          <path d={svgPaths.p1480d980} fill="var(--fill-0, white)" id="Vector_12" />
          <path d={svgPaths.p1e306300} fill="var(--fill-0, white)" id="Vector_13" />
          <path d={svgPaths.p17ad00} fill="var(--fill-0, white)" id="Vector_14" />
          <path d={svgPaths.p11d55800} fill="var(--fill-0, white)" id="Vector_15" />
          <path d={svgPaths.p22bc3a00} fill="var(--fill-0, white)" id="Vector_16" />
          <path d={svgPaths.p5ad2180} fill="var(--fill-0, white)" id="Vector_17" />
          <path d={svgPaths.p19584080} fill="var(--fill-0, white)" id="Vector_18" />
          <path d={svgPaths.p3b10e580} fill="var(--fill-0, white)" id="Vector_19" />
          <path d={svgPaths.p240ef800} fill="var(--fill-0, white)" id="Vector_20" />
          <path d={svgPaths.p2e4f6a00} fill="var(--fill-0, white)" id="Vector_21" />
        </g>
      </svg>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-[311px]" data-name="Frame">
      <BolagsverketLogo />
      <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[20px] text-white whitespace-nowrap">
        <p className="leading-[1.5]">Samordnad registerkontroll</p>
      </div>
    </div>
  );
}

function Frame11() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-[95px]">
      <div className="relative shrink-0 size-[24px]" data-name="språk">
        <div className="absolute inset-0 overflow-clip" data-name="language">
          <div className="absolute inset-[8.33%]" data-name="icon">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
              <path d={svgPaths.pdb50800} fill="var(--fill-0, white)" id="icon" />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white whitespace-nowrap">
        <p className="leading-[24px]">{`<Språk>`}</p>
      </div>
      <div className="relative shrink-0 size-[24px]" data-name="chevron ner">
        <div className="absolute inset-0 overflow-clip" data-name="keyboard_arrow_down">
          <div className="absolute bottom-[35.83%] left-1/4 right-1/4 top-[33.33%]" data-name="icon">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 7.4">
              <path d={svgPaths.p13733a00} fill="var(--fill-0, white)" id="icon" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame12() {
  return (
    <div className="absolute content-stretch flex gap-[8px] items-center left-0 top-0 w-[114px]">
      <div className="relative shrink-0 size-[24px]" data-name="mörkt">
        <div className="absolute inset-0 overflow-clip" data-name="Dark Mode Icon">
          <div className="absolute inset-[12.5%]" data-name="icon">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
              <path d={svgPaths.p2fc37e00} fill="var(--fill-0, white)" id="icon" />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white whitespace-nowrap">
        <p className="leading-[24px]">Mörkt läge</p>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex items-center relative shrink-0 w-[147px]">
      <div className="bg-[#fbe5e5] flex-[1_0_0] min-w-[128px] relative rounded-[4px]" data-name="Primär">
        <div aria-hidden="true" className="absolute border-2 border-[rgba(255,255,255,0)] border-solid inset-0 pointer-events-none rounded-[4px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.3)]" />
        <div className="flex flex-row items-center justify-center min-w-[inherit] size-full">
          <div className="content-stretch flex gap-[8px] items-center justify-center min-w-[inherit] px-[22px] py-[14px] relative size-full">
            <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[#002857] text-[16px] text-center whitespace-nowrap">
              <p className="leading-[20px]">Logga in</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex gap-[16px] items-center justify-end relative shrink-0 w-[436px]">
      <div className="content-stretch flex gap-[4px] h-[24px] items-start overflow-clip relative shrink-0" data-name="Språkval">
        <Frame11 />
      </div>
      <button className="block cursor-pointer h-[24px] relative shrink-0 w-[114px]" data-name="Dark/Light-mode">
        <Frame12 />
      </button>
      <Frame1 />
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents inset-[0_0_35.48%_0]">
      <div className="absolute bg-[#002857] content-stretch flex inset-[0_0_35.48%_0] items-center justify-between px-[12px] py-[16px]" data-name="D / Sidhuvud">
        <Frame />
        <Frame2 />
      </div>
    </div>
  );
}

export default function Component021SkapaArendeGrunduppgifter() {
  return (
    <div className="bg-white relative size-full" data-name="02.1 SKAPA ÄRENDE / GRUNDUPPGIFTER">
      <Frame13 />
      <div className="-translate-y-1/2 absolute flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] left-[100px] not-italic text-[16px] text-black top-[226.5px] whitespace-nowrap">
        <p className="leading-[30.8px]">Fyll i upphandlingsuppgifter</p>
      </div>
      <Kort />
      <div className="absolute h-[124px] left-0 top-0 w-[1440px]" data-name="Huvudmeny SRK">
        <Group2 />
        <Group1 />
      </div>
    </div>
  );
}