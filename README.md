# Futboru

Minimalistyczny, źródłowy feed transferów piłkarskich. Strona nie kopiuje artykułów: pokazuje wyłącznie ustrukturyzowany fakt, status i link do źródła.

## Co działa w PoC

- potwierdzone transfery z bieżącej listy angielskiego okna transferowego w Wikipedii, wraz z cytowanym źródłem;
- wiek i pozycja wzbogacane przez Wikidane, gdy rekord zawodnika jest dostępny;
- ostrożnie filtrowane sygnały transferowe z publicznego kanału BBC Football RSS jako `plotka`;
- ręczne, źródłowe doniesienia w `data/manual-rumours.json`;
- deduplikacja, walidacja i odświeżanie co 30 minut przez GitHub Actions;
- dostępny, responsywny interfejs bez menu, kart, zdjęć i efektów.

`Oficjalne` oznacza wpis z listy zakończonych transferów. Link przy wierszu prowadzi do cytowanego komunikatu klubu albo medium, które potwierdziło ruch. Doniesienia BBC pozostają `Plotką`, dopóki nie pojawi się na liście zakończonych transferów.

## Lokalnie

Wymagany jest Node.js 22 lub nowszy.

```bash
npm install
npm run check
python3 -m http.server 4173
```

Następnie otwórz `http://127.0.0.1:4173`.

## Dodawanie ręcznego źródła

`data/manual-rumours.json` przyjmuje tablicę rekordów. Minimalny wpis:

```json
{
  "date": "2026-07-15",
  "player": "Imię i nazwisko",
  "fromClub": "Klub A",
  "toClub": "Klub B",
  "fee": "€30 mln?",
  "sourceName": "Nazwa źródła",
  "sourceUrl": "https://adres-zrodla.example/wpis"
}
```

Nie dodawaj rekordu bez bezpośredniego linku do oryginalnej publikacji.

## Źródła, których PoC celowo nie scrapuje

- **X / Fabrizio Romano** — stabilna integracja wymaga oficjalnego X API i tokenu; wpis dziennikarza nadal powinien mieć status `plotka` lub `doniesienie`, nie `oficjalne`.
- **Facebook Groups** — brak obecnie stabilnej, autoryzowanej ścieżki do automatycznego pobierania postów grupowych; odpowiednią drogą jest ręczne zgłaszanie linków.
- **Meczyki i inne portale bez publicznego RSS/API** — kolejny adapter powinien powstać dopiero po sprawdzeniu warunków użycia lub uzyskaniu zgody.

Kolejny krok produkcyjny to bezpośrednie adaptery oficjalnych trackerów Premier League, Bundesligi, LaLigi, Serie A i Ekstraklasy. Przy wielu ligach płatne API (np. Sportmonks) będzie stabilniejsze niż utrzymywanie wielu parserów HTML.
