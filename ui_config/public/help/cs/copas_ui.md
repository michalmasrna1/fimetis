## Copas UI
Popis uživatelského rozhraní

### Statusbar

Vlevo vidíte stav dostupných služeb přítomných v tomto modulu. Služby mohou být buď dostupné (zelená) nebo nedostupné (červená). Při najetí myší na název služby se mohou zobrazit další informace o službě.

![Image](./images/copas-services.png)

Vedle stavu služeb jsou dostupné akce, které může modul definovat. Ty slouží k aktualizaci stavu kontejneru – např. smazání dat služby, restartování služby a podobné.

Dále je profil. Pokud je k dispozici funkce profilu, existuje vždy jeden aktivní, který lze aktualizovat pomocí rozevíracího seznamu. Profil obvykle slouží k nastavení maximální spotřeby zdrojů modulu, ale lze jej použít i pro jiné účely.

![Image](./images/copas-profile.png)

Na pravé straně stavového řádku je název kontejneru a název modulu s jeho verzí.

### Správce souborů
Správce souborů umožňuje spravovat soubory uvnitř kontejneru.
V současné době existuje podpora pro:
- **nahrávání souborů** - buď tlačítko nahrát, nebo přetažení
- **vytvoření nových adresářů** pomocí tlačítka nový adresář
- **mazání souborů** - buď tlačítko delete nebo klávesa Del na klávesnici
- **kopírování/vyjmutí souborů** - funkcionalita používá zkratky Ctrl + C/X , Ctrl + V
- **vyhledávání a filtrování** souborů pomocí vyhledávací lišty

Existují dva režimy zobrazení obsahu adresářů - režim seznamu a mřížky.
Ve výchozím nastavení zůstávají skryté soubory (začínající tečkou) skryté, ale lze je zobrazit pomocí přepínače.

### Import souborů pro analýzu
Ústřední částí aplikace je import souborů.
Soubory již musí být nahrány do kontejneru (např. prostřednictvím správce souborů), než je importujete k analýze.

Proces má (potenciálně) 4 kroky:
1. **Výběr souboru** - Nejprve se vyberou soubory, lze také vybrat adresáře a obsah archivů. Adresáře lze vybrat pro další sledování, což je vysvětleno dále. Jakmile uživatel vybere všechny požadované soubory, přichází další krok.
2. **Výběr konfigurace analýzy** - Konfigurace pro analýzu může být zvolena buď přímo, může být vytvořena nová od začátku nebo může být existující konfigurace duplikována a upravena.
3. **Vytvořit/upravit konfiguraci** (Volitelné) – Podrobnosti o konkrétní sadě možností pro modul jsou uvedeny v příslušné části nápovědy.
4. **Zobrazit souhrn a potvrdit import** - Zobrazí se souhrn vybraných souborů, konfigurace a sledovaných adresářů. Pokud byla vytvořena nová konfigurace nebo stávající upravena, zobrazí se možnost uložit konfiguraci, což se v případě úspěšného importu provede.

### Sledování nových souborů v adresářích

Adresáře lze vybrat pro sledování spolu s přiřazenou konfigurací. Watchdog kontroluje tento adresář a jeho podstrom a když se v podstromu daném adresářem objeví nový soubor, je automaticky importován.

Watchdogs lze vytvořit buď během importu při výběru adresáře nebo samostatně v jeho vyhrazeném uživatelském rozhraní, kde lze prohlížet všechny sledované adresáře.

### Historie
K dispozici je také historie všech importů. Tabulka zobrazuje informace o datu, stavu importu, importovaných souborech, původu importu (manuální vs. watchdog) a použité konfiguraci.

Informace lze filtrovat a třídit.