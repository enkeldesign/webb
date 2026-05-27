import { useState } from "react";
import { Info, AlertCircle, X, ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";

export interface Leverantor {
  orgnr: string;
  namn: string;
  form: string;
}

export interface OrgError {
  input: string;
  reason: string;
}

interface Props {
  leverantorer: Leverantor[];
  errors: OrgError[];
  onChange: (leverantorer: Leverantor[], errors: OrgError[]) => void;
  onContinue: () => void;
  onCancel: () => void;
}

const MOCK_COMPANIES: Record<string, { namn: string; form: string }> = {
  "556036-0793": { namn: "Volvo Personvagnar AB", form: "Aktiebolag" },
  "556016-0680": { namn: "Ericsson AB", form: "Aktiebolag" },
  "556074-7569": { namn: "IKEA Svenska AB", form: "Aktiebolag" },
  "556013-0683": { namn: "Hennes & Mauritz AB", form: "Aktiebolag" },
  "556397-0400": { namn: "Spotify AB", form: "Aktiebolag" },
  "556000-1234": { namn: "Skanska AB", form: "Aktiebolag" },
  "556677-8899": { namn: "AB Konsulten", form: "Aktiebolag" },
  "969712-3456": { namn: "Sveriges Byggentreprenörer", form: "Ekonomisk förening" },
  "802000-1111": { namn: "Stiftelsen Exempel", form: "Stiftelse" },
};

function normalize(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  if (digits.length === 12) return `${digits.slice(2, 8)}-${digits.slice(8)}`;
  return raw.trim();
}

function validateOrgnr(raw: string): { ok: true; orgnr: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Tom inmatning" };

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) {
    return { ok: false, reason: "Fel format – ska vara 10 siffror (XXXXXX-XXXX)" };
  }
  const core = digits.length === 12 ? digits.slice(2) : digits;
  const thirdDigit = parseInt(core[2], 10);
  if (isNaN(thirdDigit) || thirdDigit < 2) {
    return { ok: false, reason: "Fel organisationstyp – numret ser ut att vara ett personnummer" };
  }
  return { ok: true, orgnr: normalize(trimmed) };
}

function parseInputs(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function StepLeverantorer({ leverantorer, errors, onChange, onContinue, onCancel }: Props) {
  const [text, setText] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAdd = () => {
    const inputs = parseInputs(text);
    if (inputs.length === 0) return;

    const newLev: Leverantor[] = [...leverantorer];
    const newErr: OrgError[] = [...errors];

    inputs.forEach((input) => {
      const result = validateOrgnr(input);
      if (result.ok) {
        if (newLev.some((l) => l.orgnr === result.orgnr)) return;
        const company = MOCK_COMPANIES[result.orgnr] ?? {
          namn: `Företag ${result.orgnr}`,
          form: "Aktiebolag",
        };
        newLev.push({ orgnr: result.orgnr, namn: company.namn, form: company.form });
      } else {
        if (newErr.some((e) => e.input === input)) return;
        newErr.push({ input, reason: result.reason });
      }
    });

    onChange(newLev, newErr);
    setText("");
    if (newLev.length > leverantorer.length) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    }
  };

  const handleClear = () => setText("");

  const removeError = (input: string) => {
    onChange(leverantorer, errors.filter((e) => e.input !== input));
  };

  const removeLev = (orgnr: string) => {
    onChange(leverantorer.filter((l) => l.orgnr !== orgnr), errors);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[640px]">
      <div>
        <h2 className="text-[24px] font-bold text-[#2a2b2d] leading-8">
          Lägg till ett eller flera organisationsnummer
        </h2>
        <p className="text-[16px] text-[#2a2b2d] mt-1">
          Det går även att klistra in en lista med organisationsnummer (kommaseparerad, semikolonseparerad eller med mellanslag).
        </p>
      </div>

      {errors.length > 0 && (
        <div className="border-2 border-[#c00020] bg-[#fbe5e5] rounded p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[#c00020] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-[#2a2b2d] text-[16px]">
                {errors.length} organisationsnummer kunde inte läggas till
              </div>
              <p className="text-[14px] text-[#2a2b2d] mt-1">
                Åtgärda genom att mata in rätt nummer igen och ta bort de felaktiga från listan nedan.
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {errors.map((err) => (
                  <li
                    key={err.input}
                    className="flex items-center justify-between gap-2 bg-white rounded border border-[#c00020] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-[#2a2b2d]">{err.input}</span>
                      <span className="text-[#4c4e52] ml-2">– {err.reason}</span>
                    </div>
                    <button
                      onClick={() => removeError(err.input)}
                      aria-label={`Ta bort ${err.input}`}
                      className="shrink-0 rounded p-1 hover:bg-[#fbe5e5]"
                    >
                      <X className="w-4 h-4 text-[#c00020]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="border-2 border-[#1f7a3a] bg-[#e8f5ed] rounded p-3 text-[#1f5a2d] flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 text-[#1f7a3a]" />
          Leverantör tillagd
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <label className="flex-1 font-semibold text-[#2a2b2d] text-[16px]">Organisationsnummer</label>
          <Info className="w-5 h-5 text-[#005299]" fill="#005299" stroke="white" />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: 556036-0793, 556016-0680"
          rows={5}
          className="bg-white rounded border-2 border-[#8a8d93] px-3 py-2 text-[16px] text-[#2a2b2d] outline-none focus:border-[#005299] resize-y"
        />
      </div>

      <div className="flex gap-4">
        <Button variant="primary" onClick={handleAdd}>Lägg till</Button>
        <Button variant="secondary" onClick={handleClear}>Rensa</Button>
      </div>

      <div>
        <h3 className="font-bold text-[20px] text-[#2a2b2d] mb-2">Leverantörer</h3>
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
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {leverantorer.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-[#4c4e52] italic">
                    Tabellen är tom
                  </td>
                </tr>
              ) : (
                leverantorer.map((l) => (
                  <tr key={l.orgnr} className="border-b border-[#eaebee] last:border-b-0">
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.orgnr}</td>
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.namn}</td>
                    <td className="px-3 py-2 text-[#2a2b2d]">{l.form}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeLev(l.orgnr)}
                        aria-label={`Ta bort ${l.namn}`}
                        className="rounded p-1 hover:bg-[#f4f5f7]"
                      >
                        <X className="w-4 h-4 text-[#4c4e52]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-4 pt-4 pb-2">
        <Button
          variant="primary"
          onClick={onContinue}
          disabled={leverantorer.length === 0}
          className={leverantorer.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
        >
          Fortsätt
        </Button>
        <Button variant="secondary" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}
