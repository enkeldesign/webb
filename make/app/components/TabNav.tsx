export interface TabItem {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: TabItem[];
  active: string;
  onChange: (tab: string) => void;
  isInloggad?: boolean;
}

export function TabNav({ tabs, active, onChange, isInloggad = true }: TabNavProps) {
  return (
    <div className="bg-[#eee]">
      <div className="max-w-[1440px] mx-auto px-8 md:px-24 flex items-end justify-between">
      <nav className="flex">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`px-3 pt-3 pb-2 ${
                isActive
                  ? "font-semibold text-[#2a2b2d] border-b-4 border-[#005299]"
                  : "text-[#2a2b2d] hover:bg-[#e0e0e0]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      {isInloggad && (
        <div className="flex items-center gap-1 text-black py-2">
          <span className="text-[12px]">Inloggad som:</span>
          <span className="text-[14px] font-semibold">Förnamn Efternamn (UO)</span>
        </div>
      )}
      </div>
    </div>
  );
}
