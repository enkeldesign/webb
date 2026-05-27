import svgPaths from "./svg-rvsmvugp1e";

function Status() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Status">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <circle cx="16" cy="16" fill="var(--fill-0, #418B41)" id="bakgrund" r="16" />
      </svg>
      <div className="absolute inset-[23.08%_23.59%_23.59%_23.08%] overflow-clip" data-name="success">
        <div className="absolute inset-[12.71%_0]" data-name="Vector">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.0666 12.7268">
            <path d={svgPaths.p42ab380} fill="var(--fill-0, white)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function VertikalLinje() {
  return (
    <div className="flex-[1_0_0] min-h-px relative w-0" data-name="Vertikal linje">
      <div className="absolute flex inset-[0_43.75%_0_0] items-center justify-center" style={{ containerType: "size" }}>
        <div className="flex-none h-[254193000cqw] rotate-90 w-[100cqh]">
          <div className="relative size-full" data-name="Vertikal linje">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9 2">
                <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x2="9" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinjeEfter() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center min-h-[9px] relative w-full" data-name="Linje (efter)">
      <VertikalLinje />
    </div>
  );
}

function Vansterkolumn() {
  return (
    <div className="relative self-stretch shrink-0" data-name="Vänsterkolumn">
      <div className="flex flex-col items-center size-full">
        <div className="content-stretch flex flex-col gap-[4px] items-center pt-[2px] relative size-full">
          <Status />
          <LinjeEfter />
        </div>
      </div>
    </div>
  );
}

function Lank() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-w-px relative" data-name="Länk">
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#418b41] text-[16px] w-full">
        <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Upphandlingsuppgifter</p>
      </div>
    </div>
  );
}

function Status1() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Status">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <circle cx="16" cy="16" fill="var(--fill-0, #418B41)" id="bakgrund" r="16" />
      </svg>
      <div className="absolute inset-[23.08%_23.59%_23.59%_23.08%] overflow-clip" data-name="success">
        <div className="absolute inset-[12.71%_0]" data-name="Vector">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.0666 12.7268">
            <path d={svgPaths.p42ab380} fill="var(--fill-0, white)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function VertikalLinje1() {
  return (
    <div className="flex-[1_0_0] min-h-px relative w-0" data-name="Vertikal linje">
      <div className="absolute flex inset-[0_43.75%_0_0] items-center justify-center" style={{ containerType: "size" }}>
        <div className="flex-none h-[254193000cqw] rotate-90 w-[100cqh]">
          <div className="relative size-full" data-name="Vertikal linje">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9 2">
                <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x2="9" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinjeEfter1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center min-h-[9px] relative w-full" data-name="Linje (efter)">
      <VertikalLinje1 />
    </div>
  );
}

function Vansterkolumn1() {
  return (
    <div className="relative self-stretch shrink-0" data-name="Vänsterkolumn">
      <div className="flex flex-col items-center size-full">
        <div className="content-stretch flex flex-col gap-[4px] items-center pt-[2px] relative size-full">
          <Status1 />
          <LinjeEfter1 />
        </div>
      </div>
    </div>
  );
}

function Lank1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-w-px relative" data-name="Länk">
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#418b41] text-[16px] w-full">
        <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Leverantörer</p>
      </div>
    </div>
  );
}

function LinjeFore() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Linje (före)">
      <div className="flex h-[32px] items-center justify-center relative shrink-0 w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "21" } as React.CSSProperties}>
        <div className="flex-none rotate-90">
          <div className="h-0 relative w-[32px]" data-name="Vertikal linje">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 2">
                <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x2="32" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Steg() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[32px]" data-name="Steg">
      <div aria-hidden="true" className="absolute border-2 border-[#4c4e52] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
        <p className="leading-[24px]">3</p>
      </div>
    </div>
  );
}

function LinjeEfter2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center min-h-[12px] relative w-full" data-name="Linje (efter)">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px relative w-0" style={{ containerType: "size", "--transform-inner-width": "1185", "--transform-inner-height": "21" } as React.CSSProperties}>
        <div className="flex-none rotate-90 w-[100cqh]">
          <div className="h-0 relative w-full" data-name="Vertikal linje">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 2">
                <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x2="12" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vansterkolumn2() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-center relative self-stretch shrink-0 w-[32px]" data-name="Vänsterkolumn">
      <LinjeFore />
      <Steg />
      <LinjeEfter2 />
    </div>
  );
}

function Stegtext() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal gap-[4px] items-start relative shrink-0 text-[#4c4e52] whitespace-nowrap" data-name="Stegtext">
      <p className="relative shrink-0">Steg</p>
      <p className="relative shrink-0">3</p>
      <p className="relative shrink-0">av</p>
      <p className="relative shrink-0">3</p>
    </div>
  );
}

function Texter() {
  return (
    <div className="flex-[1_0_0] min-w-px relative self-stretch" data-name="Texter">
      <div className="content-stretch flex flex-col items-start leading-[24px] not-italic pt-[15px] relative size-full text-[16px]">
        <Stegtext />
        <p className="font-['Inter:Bold',sans-serif] font-bold min-w-full relative shrink-0 text-[#2a2b2d] w-[min-content]">Granska och skicka in</p>
      </div>
    </div>
  );
}

function Linje() {
  return (
    <div className="relative self-stretch shrink-0 w-[32px]" data-name="Linje">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 1294">
        <g id="Linje">
          <line id="Vertikal linje" stroke="var(--stroke-0, #4C4E52)" strokeWidth="2" x1="17" x2="17.0001" y1="4.37114e-08" y2="1294" />
        </g>
      </svg>
    </div>
  );
}

function Frame17() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <div className="relative shrink-0 size-[24px]" data-name="info">
          <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
            <div className="absolute inset-[4.39%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.8906 21.8906">
                <path d={svgPaths.p7669f00} fill="var(--fill-0, #ECF7FE)" id="Vector" />
              </svg>
            </div>
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
              <path clipRule="evenodd" d={svgPaths.p5073500} fill="var(--fill-0, #0065BD)" fillRule="evenodd" id="Vector" />
            </svg>
          </div>
          <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="i">
            <div className="absolute inset-[42.06%_44.58%_24.21%_44.58%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.60156 8.09484">
                <path d={svgPaths.p8d78000} fill="var(--fill-0, #2A2B2D)" id="Vector" />
              </svg>
            </div>
            <div className="absolute inset-[24.21%_44.32%_64.43%_44.32%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.72719 2.72719">
                <path d={svgPaths.p16b9d080} fill="var(--fill-0, #2A2B2D)" id="Vector" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-[1_0_0] flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
          <p className="leading-[24px]">Kontrollera att alla uppgifter stämmer innan du skickar.</p>
        </div>
      </div>
    </div>
  );
}

function Frame24() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 w-[330px]">
      <p className="font-['Open_Sans:Bold',sans-serif] leading-[39.2px] not-italic relative shrink-0 text-[#2a2b2d] text-[28px] w-[327px]">Upphandlingsuppgifter</p>
    </div>
  );
}

function Group1() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[24px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="[text-decoration-skip-ink:none] decoration-solid leading-[30.8px] underline">Redigera</p>
      </div>
      <div className="col-1 ml-0 mt-[6px] overflow-clip relative row-1 size-[16px]" data-name="pen">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.0004 15.9997">
          <path d={svgPaths.p39bb9100} fill="var(--fill-0, #2A2B2D)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Frame30() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <Frame24 />
      <Group1 />
    </div>
  );
}

function Rubrik() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Rubrik">
      <p className="font-['Open_Sans:Bold',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">Referens</p>
    </div>
  );
}

function Rubrik1() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Rubrik">
      <p className="font-['Open_Sans:Bold',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">Upphandlingslag</p>
    </div>
  );
}

function Rubrik2() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Rubrik">
      <p className="font-['Open_Sans:Bold',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">Typ av upphandling</p>
    </div>
  );
}

function Rubrik3() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Rubrik">
      <p className="font-['Open_Sans:Bold',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">Tröskelvärde</p>
    </div>
  );
}

function Frame27() {
  return (
    <div className="content-stretch flex gap-[3px] items-center relative shrink-0 w-full">
      <div className="content-stretch flex flex-col items-start relative shrink-0 w-[259px]" data-name="Presentationsfält">
        <Rubrik />
        <p className="font-['Open_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] w-full">Kaffebönor</p>
      </div>
      <div className="content-stretch flex flex-col items-start relative shrink-0 w-[259px]" data-name="Presentationsfält">
        <Rubrik1 />
        <p className="font-['Open_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] w-full">LOU</p>
      </div>
      <div className="content-stretch flex flex-col items-start relative shrink-0 w-[259px]" data-name="Presentationsfält">
        <Rubrik2 />
        <p className="font-['Open_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] w-full">Ny upphandling</p>
      </div>
      <div className="content-stretch flex flex-col items-start relative shrink-0 w-[259px]" data-name="Presentationsfält">
        <Rubrik3 />
        <p className="font-['Open_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] w-full">Över</p>
      </div>
    </div>
  );
}

function Frame28() {
  return (
    <div className="content-stretch flex flex-col gap-[61px] items-start relative shrink-0 w-full">
      <Frame27 />
      <div className="h-0 relative shrink-0 w-full">
        <div className="absolute inset-[-1px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1136 1">
            <line id="Line 9" stroke="var(--stroke-0, #D3D3D3)" x2="1136" y1="0.5" y2="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame29() {
  return (
    <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-full">
      <div className="bg-[#ecf7fe] h-[60px] relative rounded-[2px] shrink-0 w-[1136px]" data-name="Meddelanderut-kort">
        <div className="content-stretch flex flex-col items-center overflow-clip pl-[28px] pr-[18px] py-[18px] relative rounded-[inherit] size-full">
          <Frame17 />
        </div>
        <div aria-hidden="true" className="absolute border-[#0065bd] border-b-2 border-l-12 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[2px]" />
      </div>
      <Frame30 />
      <Frame28 />
    </div>
  );
}

function Group2() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[24px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="[text-decoration-skip-ink:none] decoration-solid leading-[30.8px] underline">Redigera</p>
      </div>
      <div className="col-1 ml-0 mt-[6px] overflow-clip relative row-1 size-[16px]" data-name="pen">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.0004 15.9997">
          <path d={svgPaths.p39bb9100} fill="var(--fill-0, #2A2B2D)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Frame25() {
  return (
    <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-full">
      <p className="flex-[1_0_0] font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[30.8px] min-w-px not-italic relative text-[#2a2b2d] text-[22px]">Leverantörer</p>
      <Group2 />
    </div>
  );
}

function Frame18() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <div className="relative shrink-0 size-[24px]" data-name="success">
          <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-0 left-1/2 overflow-clip top-0" data-name="circle">
            <div className="absolute inset-[4.39%]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.8906 21.8906">
                <path d={svgPaths.p7669f00} fill="var(--fill-0, #EDF7ED)" id="Vector" />
              </svg>
            </div>
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
              <path clipRule="evenodd" d={svgPaths.p5073500} fill="var(--fill-0, #63B663)" fillRule="evenodd" id="Vector" />
            </svg>
          </div>
          <div className="-translate-x-1/2 absolute aspect-[512/512] bottom-[20.83%] left-1/2 overflow-clip top-[20.83%]" data-name="success">
            <div className="absolute inset-[12.71%_0]" data-name="Vector">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 10.44">
                <path d={svgPaths.p3185be40} fill="var(--fill-0, #2A2B2D)" id="Vector" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-[1_0_0] flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[16px] text-black">
          <p className="leading-[30.8px]">132 leverantörer kommer att kontrolleras</p>
        </div>
      </div>
    </div>
  );
}

function Frame31() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
      <Frame25 />
      <div className="bg-[#edf7ed] h-[60px] relative rounded-[2px] shrink-0 w-full" data-name="Meddelanderut-kort">
        <div className="flex flex-col items-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center pl-[28px] pr-[18px] py-[18px] relative size-full">
            <Frame18 />
          </div>
        </div>
        <div aria-hidden="true" className="absolute border-[#63b663] border-b-2 border-l-12 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[2px]" />
      </div>
    </div>
  );
}

function Frame14() {
  return (
    <div className="h-full relative shrink-0">
      <div className="flex flex-row items-end justify-center size-full">
        <div className="content-stretch flex items-end justify-center py-[4px] relative size-full">
          <div className="relative shrink-0 size-[16px]" data-name="Sortera">
            <div className="absolute inset-0 overflow-clip" data-name="sort">
              <div className="absolute inset-[11.12%_22.06%]" data-name="Vector">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.9416 12.4406">
                  <path d={svgPaths.p233b6700} fill="var(--fill-0, #808289)" id="Vector" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex gap-[6px] items-center relative shrink-0 w-full">
      <div className="flex flex-[1_0_0] flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Organisationsnummer</p>
      </div>
      <div className="flex flex-row items-center self-stretch">
        <Frame14 />
      </div>
    </div>
  );
}

function Frame15() {
  return (
    <div className="h-full relative shrink-0">
      <div className="flex flex-row items-end justify-center size-full">
        <div className="content-stretch flex items-end justify-center py-[4px] relative size-full">
          <div className="relative shrink-0 size-[16px]" data-name="Sortera">
            <div className="absolute inset-0 overflow-clip" data-name="sort">
              <div className="absolute inset-[11.12%_22.06%]" data-name="Vector">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.9416 12.4406">
                  <path d={svgPaths.p233b6700} fill="var(--fill-0, #808289)" id="Vector" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex gap-[6px] items-center relative shrink-0 w-full">
      <div className="flex flex-[1_0_0] flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Företagsnamn</p>
      </div>
      <div className="flex flex-row items-center self-stretch">
        <Frame15 />
      </div>
    </div>
  );
}

function Frame16() {
  return (
    <div className="h-full relative shrink-0">
      <div className="flex flex-row items-end justify-center size-full">
        <div className="content-stretch flex items-end justify-center py-[4px] relative size-full">
          <div className="relative shrink-0 size-[16px]" data-name="Sortera">
            <div className="absolute inset-0 overflow-clip" data-name="sort">
              <div className="absolute inset-[11.12%_22.06%]" data-name="Vector">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.9416 12.4406">
                  <path d={svgPaths.p233b6700} fill="var(--fill-0, #808289)" id="Vector" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame11() {
  return (
    <div className="content-stretch flex gap-[6px] items-center relative shrink-0 w-full">
      <div className="flex flex-[1_0_0] flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] min-w-px not-italic relative text-[#2a2b2d] text-[16px]">
        <p className="leading-[24px]">Företagsform</p>
      </div>
      <div className="flex flex-row items-center self-stretch">
        <Frame16 />
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="col-1 content-stretch flex flex-col gap-[2px] items-start ml-0 mt-0 overflow-clip relative row-1 w-[1136px]">
      <div className="content-stretch flex h-[36px] items-start relative shrink-0 w-full" data-name="Rubrik/rad">
        <div aria-hidden="true" className="absolute border-[#808289] border-b-2 border-solid inset-[0_0_-2px_0] pointer-events-none" />
        <div className="bg-[#f4f4f4] relative self-stretch shrink-0 w-[38px]" data-name="Kolumnrubriker/Tom kolumnrubrik">
          <div className="size-full" />
        </div>
        <div className="bg-[#f4f4f4] flex-[1_0_0] min-w-px relative self-stretch" data-name="Kolumnrubrik 1">
          <div aria-hidden="true" className="absolute border-[#808289] border-l border-solid inset-[0_0_0_-1px] pointer-events-none" />
          <div className="content-stretch flex flex-col items-start px-[10px] py-[6px] relative size-full">
            <Frame9 />
          </div>
        </div>
        <div className="bg-[#f4f4f4] flex-[1_0_0] min-w-px relative self-stretch" data-name="Kolumnrubrik 2">
          <div aria-hidden="true" className="absolute border-[#808289] border-l border-solid inset-[0_0_0_-1px] pointer-events-none" />
          <div className="content-stretch flex flex-col items-start px-[10px] py-[6px] relative size-full">
            <Frame10 />
          </div>
        </div>
        <div className="bg-[#f4f4f4] flex-[1_0_0] min-w-px relative self-stretch" data-name="Kolumnrubrik 3">
          <div aria-hidden="true" className="absolute border-[#808289] border-l border-solid inset-[0_0_0_-1px] pointer-events-none" />
          <div className="content-stretch flex flex-col items-start px-[10px] py-[6px] relative size-full">
            <Frame11 />
          </div>
        </div>
        <div className="bg-[#f4f4f4] relative self-stretch shrink-0 w-[38px]" data-name="B Kolumnrubriker/Tom kolumnrubrik">
          <div className="size-full" />
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-stretch flex gap-px items-center relative shrink-0 w-full" data-name="Rad/interaktiv tabell">
        <div aria-hidden="true" className="absolute border-[#808289] border-b border-solid inset-0 pointer-events-none" />
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 1">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">
                <p className="leading-[30.8px]">557034-0087</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 2">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsnamn]</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-[1_0_0] min-w-px relative" data-name="Tabellceller/visa info 3">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center px-[10px] py-[12px] relative size-full">
              <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
                <p className="leading-[24px]">[företagsform]</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-[12px] place-items-start relative row-1">
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[40px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">2</p>
      </div>
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[100px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">...</p>
      </div>
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[74px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">3</p>
      </div>
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[129px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">13</p>
      </div>
      <div className="bg-[#d9d9d9] col-1 ml-0 mt-[6px] rounded-[1px] row-1 size-[20px]" />
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[5px] mt-0 not-italic relative row-1 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">1</p>
      </div>
    </div>
  );
}

function Frame19() {
  return (
    <div className="col-1 content-stretch flex items-center ml-[174px] mt-0 relative row-1">
      <div className="flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-black text-right whitespace-nowrap">
        <p className="leading-[30.8px]">Nästa</p>
      </div>
      <div className="content-stretch flex gap-[8px] h-[55px] items-center px-[10px] py-[6px] relative rounded-[6px] shrink-0 w-[36px]" data-name="Tabellcell/Knapp 3">
        <div className="overflow-clip relative shrink-0 size-[16px]" data-name="Storlek=small">
          <div className="absolute inset-[7.35%_24.12%]" data-name="Vector">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.28158 13.6465">
              <path d={svgPaths.p47a9300} fill="var(--fill-0, #4A52B6)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group3() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Group />
      <Frame19 />
    </div>
  );
}

function Frame20() {
  return (
    <div className="col-1 content-stretch flex items-center justify-center ml-0 mt-0 relative row-1 w-[1136px]">
      <Group3 />
    </div>
  );
}

function Group4() {
  return (
    <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-[606px] place-items-start relative row-1">
      <Frame20 />
      <div className="col-1 flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center ml-[918.34px] mt-[12px] not-italic relative row-1 text-[14px] text-black text-right w-[206px]">
        <p className="leading-[30.8px]">Visar 1-10 av 132 leverantörer</p>
      </div>
    </div>
  );
}

function Group6() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Frame1 />
      <Group4 />
    </div>
  );
}

function Kryssruta1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Kryssruta">
      <div className="absolute inset-[-2.15%_-4.03%_-2.06%_-1.44%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.0941 20.8412">
          <g id="Kryssruta">
            <rect fill="var(--fill-0, white)" height="18" id="ram" rx="1" stroke="var(--stroke-0, #808289)" strokeWidth="2" width="18" x="1.28785" y="1.43012" />
            <rect fill="var(--fill-0, white)" height="16" id="bkg" width="16" x="2.28785" y="2.43012" />
            <path d={svgPaths.pbca45c0} fill="var(--fill-0, white)" id="kryss" />
            <g id="Group">
              <path d={svgPaths.p2fc40af0} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeWidth="1.6" />
              <path d={svgPaths.p23c2a140} id="Vector_2" stroke="var(--stroke-0, #808289)" strokeLinecap="round" strokeWidth="2" />
            </g>
            <g id="Group_2">
              <path d={svgPaths.p2e1f42b0} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeWidth="1.452" />
              <path d={svgPaths.p161a9680} id="Vector_4" stroke="var(--stroke-0, #808289)" strokeLinecap="round" strokeWidth="2" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Kryssruta() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-[1136px]" data-name="Kryssruta">
      <Kryssruta1 />
      <p className="font-['Open_Sans:Regular',sans-serif] leading-[30.8px] not-italic relative shrink-0 text-[16px] text-black w-[1005px]">Jag intygar att uppgifterna är korrekta och är medveten om att inskickad kontroll inte kan ändras.</p>
    </div>
  );
}

function Knappar() {
  return (
    <div className="content-stretch flex gap-[16px] items-start pb-[32px] relative shrink-0" data-name="Knappar">
      <div className="bg-[#005299] content-stretch flex gap-[8px] items-center justify-center min-w-[152px] px-[26px] py-[20px] relative rounded-[4px] shrink-0" data-name="Primär">
        <div aria-hidden="true" className="absolute border-2 border-[rgba(255,255,255,0)] border-solid inset-0 pointer-events-none rounded-[4px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.3)]" />
        <div className="flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white whitespace-nowrap">
          <p className="leading-[20px]">Skicka</p>
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
    <div className="content-stretch flex flex-col gap-[32px] items-start pt-[16px] relative shrink-0 w-[1136px]" data-name="Innehåll">
      <Frame29 />
      <Frame31 />
      <Group6 />
      <Kryssruta />
      <Knappar />
    </div>
  );
}

function InnehallOppetSteg() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full" data-name="Innehåll - öppet steg">
      <Linje />
      <Innehall />
    </div>
  );
}

function Linje1() {
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

function Steg1() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[32px]" data-name="Steg">
      <div aria-hidden="true" className="absolute border-2 border-[#4c4e52] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[#2a2b2d] text-[16px] whitespace-nowrap">
        <p className="leading-[24px]">3</p>
      </div>
    </div>
  );
}

function Vansterkolumn3() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-full items-center relative shrink-0" data-name="Vänsterkolumn">
      <Linje1 />
      <Steg1 />
    </div>
  );
}

function Rubrik4() {
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
      <div className="content-stretch flex gap-[8px] h-[45px] items-center relative shrink-0 w-[289px]" data-name="Kommande steg">
        <div className="flex flex-row items-center self-stretch">
          <Vansterkolumn3 />
        </div>
        <div className="flex flex-[1_0_0] flex-row items-center self-stretch">
          <Rubrik4 />
        </div>
      </div>
    </div>
  );
}

function Desktop() {
  return (
    <div className="content-stretch flex flex-col items-start py-[8px] relative shrink-0 w-full" data-name="Desktop">
      <div className="content-stretch flex gap-[8px] items-start min-h-[47px] relative shrink-0 w-[327px]" data-name="Klart steg">
        <Vansterkolumn />
        <Lank />
      </div>
      <div className="content-stretch flex gap-[8px] items-start min-h-[47px] relative shrink-0 w-[327px]" data-name="Klart steg">
        <Vansterkolumn1 />
        <Lank1 />
      </div>
      <div className="content-stretch flex gap-[8px] h-[84px] items-start min-h-[84px] relative shrink-0 w-[327px]" data-name="Öppet steg">
        <Vansterkolumn2 />
        <Texter />
      </div>
      <InnehallOppetSteg />
      <KommandeSteg />
    </div>
  );
}

function Kort() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col gap-[16px] items-start left-[100px] p-[32px] rounded-[8px] top-[282px] w-[1240px]" data-name="Kort">
      <Desktop />
    </div>
  );
}

function Frame26() {
  return (
    <div className="absolute content-stretch flex items-center justify-center left-[95px] pb-[16px] pt-[48px] top-[91px]">
      <div className="flex flex-col font-['Inter:Bold',sans-serif] font-bold justify-center leading-[0] not-italic relative shrink-0 text-[40px] text-black text-center whitespace-nowrap">
        <p className="leading-[56px]">Skapa registerkontroll</p>
      </div>
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

function Frame4() {
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

function Frame5() {
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

function Frame6() {
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

function Frame7() {
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

function Frame8() {
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

function Frame12() {
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

function Frame13() {
  return (
    <div className="content-stretch flex flex-col items-start px-[12px] relative shrink-0">
      <Lankobjekt6 />
      <div className="h-[5px] shrink-0 w-full" data-name="Bar" />
    </div>
  );
}

function Group5() {
  return (
    <div className="flex-[1_0_0] grid-rows-[max-content] inline-grid min-w-px place-items-start relative">
      <div className="col-1 h-[44px] ml-0 mt-0 row-1 w-full" />
    </div>
  );
}

function Frame21() {
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

function Group8() {
  return (
    <div className="absolute contents inset-[64.52%_0_0_0]">
      <div className="absolute bg-[#eee] content-stretch flex inset-[64.52%_0_0_0] items-end" data-name="Navigationsmeny - Horisontell">
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
          <Frame12 />
        </div>
        <div className="content-stretch flex flex-col h-[44px] items-center justify-end overflow-clip relative shrink-0" data-name="Navigationsmeny - Horisontell - menyval">
          <Frame13 />
        </div>
      </div>
      <div className="absolute content-stretch flex inset-[64.52%_0_0_68.19%] items-center justify-center leading-[0] px-[12px]" data-name="D / Menyslot">
        <Group5 />
        <Frame21 />
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

function Frame22() {
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

function Frame23() {
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

function Frame2() {
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

function Frame3() {
  return (
    <div className="content-stretch flex gap-[16px] items-center justify-end relative shrink-0 w-[436px]">
      <div className="content-stretch flex gap-[4px] h-[24px] items-start overflow-clip relative shrink-0" data-name="Språkval">
        <Frame22 />
      </div>
      <button className="block cursor-pointer h-[24px] relative shrink-0 w-[114px]" data-name="Dark/Light-mode">
        <Frame23 />
      </button>
      <Frame2 />
    </div>
  );
}

function Group7() {
  return (
    <div className="absolute contents inset-[0_0_35.48%_0]">
      <div className="absolute bg-[#002857] content-stretch flex inset-[0_0_35.48%_0] items-center justify-between px-[12px] py-[16px]" data-name="D / Sidhuvud">
        <Frame />
        <Frame3 />
      </div>
    </div>
  );
}

export default function Component024SkapaArendeGranska() {
  return (
    <div className="bg-white relative size-full" data-name="02.4 SKAPA ÄRENDE / GRANSKA">
      <Kort />
      <Frame26 />
      <div className="-translate-y-1/2 absolute flex flex-col font-['Open_Sans:Regular',sans-serif] justify-center leading-[0] left-[100px] not-italic text-[16px] text-black top-[226.5px] whitespace-nowrap">
        <p className="leading-[30.8px]">Fyll i upphandlingsuppgifter</p>
      </div>
      <div className="absolute h-[124px] left-0 top-0 w-[1440px]" data-name="Huvudmeny SRK">
        <Group8 />
        <Group7 />
      </div>
    </div>
  );
}