import { TextField, SelectField } from "./FormField";
import { Button } from "./Button";

export interface Upphandling {
  referens: string;
  upphandlingslag: string;
  typ: string;
  troskel: string;
}

interface Props {
  data: Upphandling;
  onChange: (data: Upphandling) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function StepUpphandlingsuppgifter({ data, onChange, onContinue, onCancel }: Props) {
  const update = <K extends keyof Upphandling>(key: K, value: Upphandling[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="flex flex-col gap-8 max-w-[480px]">
      <TextField
        label="Referens"
        placeholder="Fyll i referens"
        value={data.referens}
        onChange={(v) => update("referens", v)}
        help="Här kan du som upphandlare lägga in en egen referens som senare blir sökbar i dina ärenden. Ex. upphandlingstid"
      />
      <SelectField
        label="Upphandlingslag"
        value={data.upphandlingslag}
        onChange={(v) => update("upphandlingslag", v)}
        help="Här väljer du den upphandlingslag som ska ligga till grund för upphandlingen"
        options={[
          { value: "LOU", label: "(LOU) Lagen om offentlig upphandling" },
          { value: "LUF", label: "(LUF) Lagen om upphandling inom försörjningssektorerna -- Kommer senare", disabled: true },
          { value: "LUK", label: "(LUK) Lagen om upphandling av koncessioner -- Kommer senare", disabled: true },
          { value: "LUFS", label: "(LUFS) Lagen om upphandling på försvars- och säkerhetsområdet – Kommer senare", disabled: true },
          { value: "LOV", label: "(LOV) Lagen om valfrihetssystem -- Kommer senare", disabled: true },
        ]}
      />
      <SelectField
        label="Typ av upphandling"
        value={data.typ}
        onChange={(v) => update("typ", v)}
        help="Här väljer du vilken typ av upphandling som kontrollen ska gälla"
        options={[
          { value: "ny", label: "Ny Upphandling" },
          { value: "uppfoljning_avtal", label: "Uppföljning av avtal" },
          { value: "kontroll_nytt_dis", label: "Kontroll vid nytt DIS" },
          { value: "utokad_kontroll_dis", label: "Utökad Kontroll DIS" },
          { value: "uppfoljning_dis", label: "Uppföljning DIS" },
        ]}
      />
      <SelectField
        label="Är upphandlingen över eller under tröskelvärdet"
        value={data.troskel}
        onChange={(v) => update("troskel", v)}
        help="Här väljer du om upphandlingen är över eller under tröskelvärdet"
        options={[
          { value: "over", label: "Över tröskelvärde" },
          { value: "under", label: "Under tröskelvärde" },
        ]}
      />
      <div className="flex gap-4 pt-4 pb-4">
        <Button variant="primary" onClick={onContinue}>Fortsätt</Button>
        <Button variant="secondary" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}
