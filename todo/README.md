# Att göra tillsammans

Gemensam att göra-lista för `https://enkel.design/todo/`.

## Funktioner

- Profilmodal för Erik eller Annika.
- Gemensam lagring i `todo/data.json` i detta GitHub-repo.
- Varje ändring sparas som en vanlig Git-commit.
- Lägg till, redigera och ta bort uppgifter.
- Ändra titel, nästa steg, brådska, värdeskapande, lugnvärde, energikostnad, taggar och status via knappen **Redigera** på varje rad.
- Manuell prioritering med dra och släpp samt tillgängliga upp/ned-knappar.
- Sortering utan att den sparade prioriteten ändras.
- Kalkylförslag: `brådska × 5 + lugnvärde × 3 + värdeskapande × 2 − energikostnad × 2`.
- Automatisk synkning var tjugonde sekund och vid återgång till fliken.
- Ingen extern databas eller server.

## Anslut GitHub

Sidan läser och skriver `todo/data.json` via GitHubs Contents API.

1. Skapa en finmaskig personal access token på GitHub.
2. Begränsa token till repot `enkeldesign/webb`.
3. Ge repository-behörigheten **Contents: Read and write**.
4. Öppna `/todo/`, välj Erik eller Annika och klistra in token under **GitHub-inställningar**.
5. Gör samma sak på den andra enheten. Ni kan använda varsin token eller samma.

Token sparas i `localStorage` på respektive enhet och checkas aldrig in i repot.

## Lagringsmodell

`data.json` innehåller listans version, senaste ändring och alla uppgifter. Vid skrivning hämtar klienten först filens aktuella SHA och skickar den med uppdateringen. Vid en samtidig ändring gör klienten ett nytt försök mot den senaste versionen.
