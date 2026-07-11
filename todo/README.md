# Att göra tillsammans

Gemensam att göra-lista för `https://enkel.design/todo/`.

## Funktioner

- Profilmodal för Erik eller Annika.
- Gemensam serverlagring i Supabase/Postgres.
- Lägg till, redigera och ta bort uppgifter.
- Ändra titel, nästa steg, brådska, värdeskapande, lugnvärde, energikostnad, taggar och status via knappen **Redigera** på varje rad.
- Manuell prioritering med dra och släpp samt tillgängliga upp/ned-knappar.
- Sortering utan att den sparade prioriteten ändras.
- Kalkylförslag: `brådska × 5 + lugnvärde × 3 + värdeskapande × 2 − energikostnad × 2`.
- Automatisk synkning var tjugonde sekund och vid återgång till fliken.
- Serveråtkomst skyddad av en familjekod som hashas med bcrypt i databasen.

## Installera databasen

1. Skapa ett Supabase-projekt.
2. Öppna SQL Editor och kör hela `supabase.sql`.
3. Öppna `/todo/` och välj Erik eller Annika.
4. Fyll i Project URL, den publika `anon`-nyckeln och en familjekod på minst 12 tecken.
5. Välj **Skapa listan** första gången.
6. Gör samma anslutning på den andra personens enhet.

Project URL och anon-nyckel finns under **Project Settings → API** i Supabase. Familjekoden lagras bara lokalt i respektive webbläsare och skickas över HTTPS till databasfunktionerna.

## Säkerhetsmodell

Tabellerna har Row Level Security aktiverad och ger inga direkta rättigheter till `anon` eller `authenticated`. All åtkomst går genom ett litet antal `security definer`-funktioner. Varje funktion kontrollerar familjekoden mot ett bcrypt-hashat värde innan data läses eller ändras.
