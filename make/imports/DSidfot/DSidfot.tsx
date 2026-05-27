import svgPaths from "./svg-kmnv1i2f0y";
type LankProps = {
  className?: string;
  hover?: boolean;
  lanktext?: string;
  stil?: "Diskret" | "Standard";
};

function Lank({ className, hover = false, lanktext = "Länktext", stil = "Standard" }: LankProps) {
  return (
    <div className={className || "content-stretch flex flex-col items-start relative"}>
      {stil === "Diskret" && !hover && (
        <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#26292b] text-[16px] whitespace-nowrap">
          <p className="[text-decoration-skip-ink:none] decoration-[#9e9e9e] decoration-[2px] decoration-solid leading-[24px] underline">{lanktext || "Länktext"}</p>
        </div>
      )}
      {stil === "Standard" && !hover && (
        <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
          <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">{lanktext || "Länktext"}</p>
        </div>
      )}
      {stil === "Standard" && hover && (
        <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
          <p className="[text-decoration-skip-ink:none] decoration-[#0b3d6f] decoration-[3px] decoration-solid leading-[24px] underline">{lanktext || "Länktext"}</p>
        </div>
      )}
      {stil === "Diskret" && hover && (
        <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#26292b] text-[16px] whitespace-nowrap">
          <p className="[text-decoration-skip-ink:none] decoration-[#9e9e9e] decoration-[3px] decoration-solid leading-[24px] underline">{lanktext || "Länktext"}</p>
        </div>
      )}
    </div>
  );
}

export default function DSidfot({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#002856] content-stretch flex flex-col gap-[32px] h-[303px] items-start pt-[48px] px-[91px] relative w-[1440px]"} data-name="D / Sidfot">
      <div className="content-stretch flex h-[27px] items-center relative shrink-0 w-full" data-name="Container">
        <div className="h-[31px] relative shrink-0 w-[181px]" data-name="logo-bolagsverket">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
            <div className="absolute contents inset-[0_87.9%_5.88%_0.1%]" data-name="Group">
              <div className="absolute inset-[11.76%_95.9%_17.65%_0.1%]" data-name="d3">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.24 21.8824">
                  <g id="d3">
                    <path d={svgPaths.pa0c040} fill="var(--fill-0, white)" id="Vector" />
                    <path d={svgPaths.p360dee00} fill="var(--fill-0, white)" id="Vector_2" />
                    <path d={svgPaths.p33e71740} fill="var(--fill-0, white)" id="Vector_3" />
                  </g>
                </svg>
              </div>
              <div className="absolute inset-[0_91.9%_5.88%_4.1%]" data-name="Group">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.24 29.1765">
                  <g id="Group">
                    <path d={svgPaths.p6a38800} fill="var(--fill-0, white)" id="Vector" />
                    <path d={svgPaths.p35471000} fill="var(--fill-0, white)" id="Vector_2" />
                    <path d={svgPaths.p24ddb80} fill="var(--fill-0, white)" id="Vector_3" />
                  </g>
                </svg>
              </div>
              <div className="absolute inset-[11.76%_87.9%_17.65%_8.1%]" data-name="d3">
                <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.24 21.8824">
                  <g id="d3">
                    <path d={svgPaths.p2e87d80} fill="var(--fill-0, white)" id="Vector" />
                    <path d={svgPaths.p360dee00} fill="var(--fill-0, white)" id="Vector_2" />
                    <path d={svgPaths.p33e71740} fill="var(--fill-0, white)" id="Vector_3" />
                  </g>
                </svg>
              </div>
            </div>
            <div className="absolute inset-[15.88%_0.4%_2.65%_16.1%]" data-name="Group">
              <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 151.135 25.2559">
                <g id="Group">
                  <path clipRule="evenodd" d={svgPaths.p19c24400} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector" />
                  <path clipRule="evenodd" d={svgPaths.p125e3900} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_2" />
                  <path clipRule="evenodd" d={svgPaths.p1978000} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_3" />
                  <path clipRule="evenodd" d={svgPaths.p21f75480} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_4" />
                  <path clipRule="evenodd" d={svgPaths.pabe8140} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_5" />
                  <path clipRule="evenodd" d={svgPaths.p29a65ee0} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_6" />
                  <path clipRule="evenodd" d={svgPaths.pd0cb0f0} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_7" />
                  <path clipRule="evenodd" d={svgPaths.p28ddd1e0} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_8" />
                  <path clipRule="evenodd" d={svgPaths.p34af75b0} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_9" />
                  <path clipRule="evenodd" d={svgPaths.p1f195ef0} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_10" />
                  <path clipRule="evenodd" d={svgPaths.p903f580} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_11" />
                  <path clipRule="evenodd" d={svgPaths.p305cda80} fill="var(--fill-0, white)" fillRule="evenodd" id="Vector_12" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="h-[148px] relative shrink-0 w-full" data-name="Container">
        <div className="absolute content-stretch flex flex-col gap-[16px] h-[148px] items-start left-0 top-0 w-[405.328px]" data-name="Navigation">
          <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 2">
            <p className="absolute font-['Open_Sans:SemiBold',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-white top-0 whitespace-nowrap">Kontakta oss</p>
          </div>
          <div className="content-stretch flex flex-col gap-[8px] h-[108px] items-start relative shrink-0 w-full" data-name="List">
            <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Länk">
              <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
                <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">info@bolagsverket.se</p>
              </div>
            </div>
            <Lank className="content-stretch flex flex-col items-start relative shrink-0" lanktext="Tel: 0771-670 670" />
            <div className="h-[50px] relative shrink-0 w-full" data-name="List Item">
              <div className="absolute font-['Inter:Regular',sans-serif] font-normal h-[42px] leading-[21px] left-0 not-italic text-[16px] text-white top-[8px] w-[405.328px] whitespace-nowrap" data-name="Address">
                <p className="absolute left-0 top-0">Bolagsverket</p>
                <p className="absolute left-0 top-[24px]">851 81 Sundsvall</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute content-stretch flex flex-col gap-[16px] h-[148px] items-start left-[437.33px] top-0 w-[405.328px]" data-name="Navigation">
          <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 2">
            <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-0 not-italic text-[16px] text-white top-0 whitespace-nowrap">Om oss</p>
          </div>
          <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Länk">
            <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
              <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Så behandlar vi dina personuppgifter</p>
            </div>
          </div>
        </div>
        <div className="absolute content-stretch flex flex-col gap-[16px] h-[148px] items-start left-[874.66px] top-0 w-[405.344px]" data-name="Navigation">
          <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 2">
            <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-0 not-italic text-[16px] text-white top-0 whitespace-nowrap">Om webbplatsen</p>
          </div>
          <div className="content-stretch flex flex-col gap-[8px] h-[79px] items-start relative shrink-0 w-full" data-name="List">
            <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
              <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Om tjänsten</p>
            </div>
            <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
              <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Vi använder kakor</p>
            </div>
            <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Länk">
              <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#0b3d6f] text-[16px] whitespace-nowrap">
                <p className="[text-decoration-skip-ink:none] decoration-[2px] decoration-solid leading-[24px] underline">Tillgänglighet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}