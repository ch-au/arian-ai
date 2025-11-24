# ARIAN AI Platform - Benutzerhandbuch

**Version:** 1.0.0
**Stand:** November 2025
**Status:** ✅ Produktiv

> 🇩🇪 Vollständige Anleitung zur Nutzung der ARIAN AI Verhandlungssimulations-Plattform

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Erste Schritte](#erste-schritte)
3. [Verhandlung konfigurieren](#verhandlung-konfigurieren)
4. [Simulation starten](#simulation-starten)
5. [Ergebnisse analysieren](#ergebnisse-analysieren)
6. [Erweiterte Funktionen](#erweiterte-funktionen)
7. [Best Practices](#best-practices)
8. [Häufige Fragen](#häufige-fragen)

---

## Einführung

### Was ist ARIAN AI?

ARIAN AI ist eine KI-gestützte Plattform zur Simulation und Analyse von Verhandlungen. Die Plattform nutzt fortschrittliche KI-Agenten, um realistische Verhandlungssituationen zu simulieren und datenbasierte Erkenntnisse über die Wirksamkeit verschiedener Verhandlungsstrategien zu liefern.

### Hauptfunktionen

- **Automatisierte Verhandlungssimulationen** - KI-Agenten führen mehrrundige Verhandlungen durch
- **Kombinatorisches Testen** - Systematische Evaluation von Techniken × Taktiken × Persönlichkeiten
- **Echtzeit-Monitoring** - Live-Verfolgung laufender Simulationen
- **KI-gestützte Auswertung** - Automatische Bewertung der Strategie-Effektivität
- **Detaillierte Analysen** - Umfassende Auswertungen mit interaktiven Visualisierungen

### Anwendungsfälle

- **Jahresgespräche** mit strategischen Handelspartnern
- **Listungsverhandlungen** für neue Produkte
- **Konditionen-Reviews** bestehender Geschäftsbeziehungen
- **Strategie-Entwicklung** für komplexe Multi-Produkt-Verhandlungen
- **Training & Coaching** für Verhandlungsteams

---

## Erste Schritte

### System-Voraussetzungen

- Moderner Webbrowser (Chrome, Firefox, Safari, Edge)
- Stabile Internetverbindung
- Benutzerkonto (vom Administrator bereitgestellt)

### Anmeldung

1. Öffnen Sie die ARIAN AI Plattform im Browser
2. Geben Sie Ihren **Benutzernamen** ein
3. Geben Sie Ihr **Passwort** ein
4. Klicken Sie auf **"Anmelden"**

Nach erfolgreicher Anmeldung gelangen Sie zum **Dashboard**.

### Dashboard-Übersicht

Das Dashboard zeigt Ihnen:

- **Aktive Verhandlungen** - Laufende und geplante Simulationen
- **Erfolgsrate** - Durchschnittliche Deal-Akzeptanzrate
- **Durchschnittliche Dauer** - Mittlere Anzahl Verhandlungsrunden
- **API-Kosten** - Aktuelle Kosten für KI-Nutzung
- **Trend-Diagramme** - Verlauf Ihrer Verhandlungsergebnisse

---

## Verhandlung konfigurieren

### Neue Verhandlung erstellen

Klicken Sie im Dashboard auf **"Neue Verhandlung"** oder nutzen Sie die Navigation zu **"Konfigurieren"**.

Der Konfigurationsprozess ist in **6 Schritte** unterteilt:

---

### Schritt 1: Unternehmensdaten

Definieren Sie die Grundlagen der Verhandlung:

#### Organisation & Kontext
- **Organisation** - Ihr Unternehmensname (z.B. "Müller & Co. GmbH")
- **Marke** (optional) - Spezifische Marke falls relevant
- **Land** - Hauptmarkt (z.B. "Deutschland")

#### Verhandlungsart
- **Art** - z.B. "Jahresgespräch", "Listung", "Konditionenreview"
- **Beziehungstyp** - z.B. "strategisch", "operativ", "transaktional"
- **Frequenz** - z.B. "jährlich", "quartalsweise", "ad-hoc"

#### Rolle & Bekanntheitsgrad
- **Ihre Rolle** - Wählen Sie **Käufer** oder **Verkäufer**
  - Als **Käufer**: Verhandeln Sie mit Lieferanten/Herstellern
  - Als **Verkäufer**: Verhandeln Sie mit Händlern/Kunden
- **Unternehmen bekannt?** - Ist Ihr Unternehmen dem Verhandlungspartner bekannt?
- **Partner bekannt?** - Kennen Sie den Verhandlungspartner bereits?
- **ZOPA-Abstand** - Erwartete Distanz zwischen den Verhandlungspositionen (0-100%)

#### Zusätzliche Hinweise
Fügen Sie beliebige Kontext-Informationen hinzu, die für die KI-Agenten relevant sein könnten.

---

### Schritt 2: Marktdaten

Definieren Sie den Markt für diese Verhandlung:

- **Marktname** - z.B. "DACH-Region", "Deutschland Lebensmitteleinzelhandel"
- **Region** (optional) - z.B. "Süddeutschland", "Norddeutschland"
- **Ländercode** - ISO-Code, z.B. "DE", "AT", "CH"
- **Währung** - z.B. "EUR", "CHF"

#### Market Intelligence
Fügen Sie Marktinformationen hinzu, die die KI-Agenten nutzen sollen:
- Marktgröße und Wachstum
- Wettbewerbssituation
- Besonderheiten des Marktes
- Saisonale Faktoren
- Regulatorische Rahmenbedingungen

**Beispiel:**
```
Der deutsche LEH-Markt ist stark konsolidiert mit hohem
Preisdruck. Top 5 Händler kontrollieren 80% des Marktes.
Bio-Segment wächst mit 8% p.a. Nachhaltigkeit gewinnt
zunehmend an Bedeutung.
```

---

### Schritt 3: Verhandlungspartner

Definieren Sie Ihren Counterpart (Verhandlungspartner):

#### Basisdaten
- **Name** - Unternehmensname des Partners (z.B. "REWE", "Edeka", "Nestlé")
- **Art** - Wählen Sie:
  - **Händler** (Retailer) - Supermärkte, Handelsketten
  - **Hersteller** (Manufacturer) - Produzenten, Markenartikler
  - **Distributor** - Großhändler, Zwischenhändler
  - **Andere** - Sonstige Geschäftspartner

#### Verhandlungsprofil

**Machtverhältnis** (0-100)
- `0` = Partner hat deutlich mehr Macht
- `50` = Ausgeglichenes Verhältnis
- `100` = Sie haben deutlich mehr Macht

**Persönlichkeitsprofil** (Interpersonal Circumplex)

Die Plattform nutzt das wissenschaftlich fundierte **Interpersonal Circumplex** Modell mit zwei Dimensionen:

**Dominanz** (-100 bis +100)
- `-100` = Sehr submissiv, zurückhaltend
- `0` = Ausgeglichen
- `+100` = Sehr dominant, durchsetzungsstark

**Affiliation** (-100 bis +100)
- `-100` = Sehr distanziert, kompetitiv
- `0` = Neutral
- `+100` = Sehr kooperativ, partnerschaftlich

**Beispiel-Kombinationen:**
- **Dominant + Kooperativ** (+70, +60) - "Führungsstarker Partner"
- **Dominant + Kompetitiv** (+80, -60) - "Aggressiver Verhandler"
- **Submissiv + Kooperativ** (-40, +70) - "Harmoniesuchender Partner"
- **Ausgeglichen** (0, 0) - "Sachlicher, rationaler Verhandler"

#### Verhandlungsstil
Beschreiben Sie den typischen Verhandlungsstil des Partners:
- z.B. "partnerschaftlich", "aggressiv", "analytisch", "emotionsbetont"

#### Notizen
Zusätzliche Informationen über den Partner, die für die Simulation relevant sind.

---

### Schritt 4: Produkte

Fügen Sie die zu verhandelnden Produkte hinzu:

#### Für jedes Produkt:

**Produktdaten**
- **Produktname** - z.B. "Bio-Schokolade 100g"
- **Marke** (optional) - z.B. "NaturPur"
- **Kategorie** (optional) - z.B. "Süßwaren/Schokolade"

**Preisparameter**

Die Plattform arbeitet mit dem **ZOPA-Konzept** (Zone of Possible Agreement):

- **Zielpreis** (Target) - Ihr angestrebter Preis
  - Als **Käufer**: Ihr Wunsch-Einkaufspreis
  - Als **Verkäufer**: Ihr Wunsch-Verkaufspreis

- **Minimalpreis / Maximalpreis** (Min/Max)
  - Als **Käufer**: Ihr maximaler Einkaufspreis (Budget-Obergrenze)
  - Als **Verkäufer**: Ihr minimaler Verkaufspreis (Kosten-Untergrenze)

- **Geschätztes Volumen** - Erwartete Abnahmemenge (Stück, kg, Paletten, etc.)

**ZOPA-Visualisierung:**
```
Käufer-Perspektive:
├─────────┬─────────┤
Min     Target    Max
1.00€   1.10€    1.30€
          ↑ Ziel   ↑ Limit

Verkäufer-Perspektive:
├─────────┬─────────┤
Min     Target    Max
1.20€   1.40€    1.60€
↑ Limit  ↑ Ziel

ZOPA = Überlappungsbereich [1.20€ - 1.30€]
```

**Tipp:** Wählen Sie realistische Spannen. Ein zu enger ZOPA erschwert eine Einigung, ein zu weiter ZOPA macht die Simulation weniger aussagekräftig.

---

### Schritt 5: Verhandlungsdimensionen

Neben dem Preis können weitere Verhandlungsdimensionen definiert werden:

#### Standard-Dimensionen
- **Zahlungsziel** (z.B. 30, 45, 60 Tage)
- **Lieferzeit** (z.B. 2, 4, 8 Wochen)
- **Mindestabnahme** (z.B. 1000, 5000, 10000 Einheiten)
- **Exklusivität** (z.B. 0%, 50%, 100%)
- **Marketing-Budget** (z.B. 5000€, 10000€, 20000€)

#### Für jede Dimension:

**Grunddaten**
- **Name** - Bezeichnung der Dimension
- **Einheit** - z.B. "Tage", "Wochen", "Euro", "%"

**Wertebereiche**
- **Minimum** - Untergrenze (für Sie akzeptabel)
- **Maximum** - Obergrenze (für Sie akzeptabel)
- **Zielwert** - Ihr angestrebter Wert

**Priorität**
- **1 = Kritisch** - Muss erreicht werden (Deal-Breaker)
- **2 = Wichtig** - Sollte erreicht werden
- **3 = Flexibel** - Kann als Verhandlungsmasse genutzt werden

**Beispiel:**
```
Dimension: Zahlungsziel
Einheit: Tage
Minimum: 30
Zielwert: 45
Maximum: 60
Priorität: 2 (Wichtig)
```

---

### Schritt 6: Strategie

Definieren Sie die Verhandlungsstrategie und Simulation-Parameter:

#### Simulations-Parameter

**Maximale Runden**
- Anzahl der Verhandlungsrunden (1-50)
- Empfehlung: 15-25 Runden für realistische Simulationen
- Zu wenig: Kein Konvergenz
- Zu viel: Hohe KI-Kosten, wenig zusätzlicher Erkenntnisgewinn

#### Beeinflussungstechniken

Wählen Sie 1-3 psychologische Beeinflussungstechniken (basierend auf Cialdini):

**Verfügbare Techniken:**
1. **Reziprozität** - "Ich gebe, damit du gibst"
2. **Konsistenz** - Auf frühere Zusagen verweisen
3. **Social Proof** - "Andere tun es auch"
4. **Autorität** - Expertise und Status betonen
5. **Sympathie** - Persönliche Verbindung aufbauen
6. **Knappheit** - Limitierung kommunizieren
7. **Anker setzen** - Erste Zahl dominiert Verhandlung
8. **Framing** - Darstellung der Informationen
9. **Commitment** - Kleine Schritte führen zu großen
10. **Contrast Effect** - Vergleiche nutzen

**Tipp:** Wählen Sie Techniken, die zu Ihrer Rolle und dem Kontext passen. Im Kombinatorischen Testing werden alle Kombinationen getestet.

#### Verhandlungstaktiken

Wählen Sie 1-3 konkrete Verhandlungstaktiken:

**Beispiel-Taktiken:**
1. **Direktes Fordern** - Klare Forderungen stellen
2. **Legitimieren** - Mit Daten und Fakten argumentieren
3. **Emotionale Appelle** - Gefühle ansprechen
4. **Logisches Überzeugen** - Rationale Argumentation
5. **Druck ausüben** - Deadlines und Konsequenzen
6. **Kollaboratives Problemlösen** - Gemeinsam Lösungen finden
7. **Geben und Nehmen** - Konzessionen handeln
8. **Wertargumentation** - Nutzen verdeutlichen
9. **Risiko-Management** - Unsicherheiten adressieren
10. **Paketierung** - Multiple Issues bündeln

**Verfügbare Taktiken:** Die Plattform bietet 44+ wissenschaftlich fundierte Taktiken zur Auswahl.

#### Kombinatorisches Testing

Die Plattform erstellt automatisch eine **Test-Matrix:**

```
Matrix = Techniken × Taktiken × Persönlichkeiten × ZOPA-Distanzen

Beispiel:
3 Techniken × 3 Taktiken × 2 Persönlichkeiten × 3 ZOPA-Varianten
= 54 Simulations-Runs
```

**Persönlichkeits-Variationen** werden automatisch generiert (z.B. "Kompetitiv", "Kooperativ", "Analytisch").

**ZOPA-Distanz-Variationen** testen verschiedene Überlappungen (z.B. "eng", "mittel", "weit").

---

### Konfiguration abschließen

1. **Überprüfen** - Kontrollieren Sie alle Einstellungen
2. **Titel vergeben** - Geben Sie der Verhandlung einen aussagekräftigen Namen
3. **Speichern** - Klicken Sie auf "Verhandlung erstellen"

Die Verhandlung erscheint nun in Ihrer **Verhandlungs-Liste** mit Status "Geplant".

---

## Simulation starten

### Batch-Simulation konfigurieren

Nach der Konfiguration können Sie die Simulation starten:

1. Navigieren Sie zur **Verhandlungsdetail-Seite**
2. Klicken Sie auf **"Simulationen starten"**
3. Wählen Sie die gewünschten Parameter:

#### Simulations-Optionen

**Anzahl paralleler Läufe**
- Empfehlung: 1-3 parallele Simulationen
- Höhere Parallelität = Schnellere Fertigstellung, aber höhere API-Last

**Kombinationen auswählen**
- Alle Kombinationen testen (empfohlen für initiale Analyse)
- Spezifische Kombinationen auswählen (für gezielte Tests)

**Kosten-Schätzung**
Die Plattform zeigt eine Schätzung der API-Kosten:
```
Beispiel:
54 Simulationen × ~15 Runden × $0.03 pro Runde
= ca. $24 geschätzte Kosten
```

### Simulation starten

Klicken Sie auf **"Batch-Simulation starten"**.

Die Simulationen werden in eine **Queue** eingereiht und automatisch im Hintergrund abgearbeitet.

---

## Monitoring

### Echtzeit-Überwachung

Während die Simulationen laufen, haben Sie mehrere Monitoring-Optionen:

#### Simulation Monitor

Navigieren Sie zu **"Monitor"** im Hauptmenü:

**Queue-Status:**
- Gesamtfortschritt (z.B. "34/54 abgeschlossen")
- Laufende Simulationen
- Ausstehende Simulationen
- Fehlgeschlagene Simulationen

**Live-Updates:**
Die Seite aktualisiert sich automatisch (WebSocket) und zeigt:
- Aktuelle Verhandlungsrunde
- Aktuelles Angebot
- Konvergenz-Status
- Geschätzte Restzeit

#### Detail-Ansicht einzelner Runs

Klicken Sie auf einen Simulations-Run, um Details zu sehen:

**Run-Informationen:**
- Verwendete Technik und Taktik
- Persönlichkeitsprofil
- ZOPA-Konfiguration
- Status und Fortschritt

**Live-Gesprächsverlauf:**
Sehen Sie die Verhandlung in Echtzeit:
```
Runde 1, Zug 1 (KÄUFER):
"Guten Tag, ich interessiere mich für Ihr Produkt..."

Runde 1, Zug 2 (VERKÄUFER):
"Sehr gerne! Unser Produkt bietet..."
```

### Simulation pausieren/abbrechen

Falls nötig, können Sie:
- **Pausieren** - Temporäres Anhalten (kann fortgesetzt werden)
- **Abbrechen** - Endgültiger Abbruch einer Simulation
- **Queue leeren** - Alle ausstehenden Simulationen entfernen

---

## Ergebnisse analysieren

Nach Abschluss der Simulationen stehen umfassende Analyse-Werkzeuge zur Verfügung:

### Analyse-Dashboard

Navigieren Sie zur **Verhandlungs-Detailseite** und klicken Sie auf **"Analyse"**.

#### Performance Matrix

Die **Heatmap** zeigt die Effektivität aller Technik-Taktik-Kombinationen:

```
              Taktik A    Taktik B    Taktik C
Technik 1     🥇 95%      87%         82%
Technik 2     91%         🥈 93%      85%
Technik 3     88%         90%         🥉 92%
```

**Farbcodierung:**
- 🟢 Grün (90-100%): Sehr erfolgreich
- 🟡 Gelb (70-89%): Erfolgreich
- 🟠 Orange (50-69%): Mäßig erfolgreich
- 🔴 Rot (<50%): Wenig erfolgreich

**Ranking-Badges:**
- 🥇 Gold: Beste Kombination
- 🥈 Silber: Zweitbeste Kombination
- 🥉 Bronze: Drittbeste Kombination

#### Drill-Down

Klicken Sie auf eine Zelle, um Details zu sehen:

**Deal-Ergebnisse:**
- Deal-Wert (Gesamtwert aller Produkte)
- Preis pro Produkt
- Abweichung vom Zielpreis
- ZOPA-Ausnutzung

**Dimensionen:**
- Erreichte Werte pro Dimension
- Zielerreichung (✅ oder ❌)
- Prioritäts-gewichtete Scores

**Performance-Metriken:**
- Anzahl Runden bis Einigung
- Effizienz-Score
- Konzessions-Muster
- Konvergenz-Verlauf

### Preis-Evolution Charts

Für jedes Produkt wird die Preisentwicklung visualisiert:

```
Preis (€)
1.60 ┤                            • (Verkäufer Start)
1.50 ┤
1.40 ┤           •     •    •
1.30 ┤     •  •           •     •
1.20 ┤  •                         • (Verkäufer Ende)
1.10 ┤                               • (Deal!)
1.00 ┤  • (Käufer Start)
     └─────────────────────────────────> Runden
     1   3   5   7   9   11  13  15
```

**Interpretation:**
- Schnelle Konvergenz = Effiziente Verhandlung
- Langsame Konvergenz = Zähe Verhandlung
- Kein Überlappung = Walk-away

### Gesprächsprotokolle

**Vollständiger Transcript:**

Öffnen Sie die **Konversations-Ansicht**, um den kompletten Gesprächsverlauf zu sehen:

```
═══════════════════════════════════════════
RUNDE 1 - ZUG 1
Rolle: KÄUFER
═══════════════════════════════════════════

Nachricht:
Guten Tag, ich möchte heute über die Konditionen für
unsere Bio-Schokolade sprechen. Mein Ziel ist es, einen
fairen Preis zu finden, der für beide Seiten funktioniert.

Angebot:
- Preis pro Einheit: 1.05 EUR
- Zahlungsziel: 60 Tage
- Mindestabnahme: 5000 Einheiten

Interne Analyse:
Der Verkäufer wird wahrscheinlich mit einem höheren
Preis kontern. Ich nutze Anker-Technik mit einem
optimistischen ersten Angebot.

─────────────────────────────────────────────

RUNDE 1 - ZUG 2
Rolle: VERKÄUFER
═══════════════════════════════════════════

Nachricht:
Vielen Dank für Ihr Interesse. Ihre Preisvorstellung
liegt deutlich unter unseren Produktionskosten. Ich
kann Ihnen ein Angebot von 1.45 EUR machen...

[...]
```

**Nutzbare Informationen:**
- Verwendete Argumente und Techniken
- Konzessions-Muster
- Emotionale Reaktionen
- Strategische Entscheidungen

### KI-Evaluation

Jede abgeschlossene Simulation erhält eine **automatische KI-Bewertung** (GPT-4o-mini):

**Effektivitäts-Scores:**
- Technik-Effektivität: 1-10 Punkte
- Taktik-Effektivität: 1-10 Punkte

**Taktische Zusammenfassung:**
```
Die Anker-Technik wurde effektiv eingesetzt und
beeinflusste die Verhandlung positiv. Die logische
Argumentation half, die Preisposition zu legitimieren.
Verbesserungspotenzial: Frühere Konzessionen hätten
die Anzahl der Runden reduzieren können.
```

### Export & Berichte

**Export-Optionen:**
- CSV-Export aller Simulations-Ergebnisse
- Excel-Bericht mit Pivot-Tabellen
- PDF-Report mit Visualisierungen
- JSON-Rohdaten für eigene Analysen

---

## Erweiterte Funktionen

### Playbook-Generierung

Die Plattform kann ein **KI-generiertes Verhandlungs-Playbook** erstellen:

**So funktioniert's:**
1. Öffnen Sie die Verhandlungs-Detailseite
2. Klicken Sie auf **"Playbook generieren"** in der Sidebar
3. Die KI analysiert Ihre Konfiguration und erstellt ein strukturiertes Playbook

**Playbook-Inhalte:**
- Situationsanalyse
- Empfohlene Strategie
- Konkrete Gesprächseinstiege
- Argumentation für jedes Produkt
- Umgang mit Einwänden
- Konzessionsstrategie
- Alternative Szenarien
- Do's and Don'ts

**Nutzung:**
Das Playbook kann als Vorbereitung für echte Verhandlungen oder als Trainingshilfe genutzt werden.

### Vergleichs-Analysen

**Verhandlungen vergleichen:**

Wählen Sie 2-3 ähnliche Verhandlungen aus, um zu vergleichen:
- Welche Techniken funktionieren besser?
- Unterschiede bei verschiedenen Counterparts
- Einfluss von Markt-Kontext
- Lernkurve über Zeit

**Nutzung:**
- Menü: **"Berichte"** → **"Vergleichsanalyse"**
- Verhandlungen auswählen
- Metriken auswählen (Deal-Wert, Effizienz, Technik-Scores)
- Side-by-Side Visualisierung

### Cost-Tracking

Die Plattform trackt vollständig alle KI-Kosten:

**Übersicht:**
- Kosten pro Simulation
- Kosten pro Verhandlung
- Tageskosten / Wochenkosten / Monatskosten
- Trend-Analysen

**Kosten-Optimierung:**
- Nutzen Sie gemini-flash-latest für Evaluationen (günstiger)
- Reduzieren Sie maximale Runden bei Tests
- Testen Sie zuerst mit wenigen Kombinationen

**Ansicht:**
- Dashboard → **"API-Kosten heute"**
- Detail-Seite → **"Kostenaufstellung"** Tab

### Langfuse-Integration

Für Power-User: Vollständige Observability über **Langfuse**:

**Features:**
- Komplette LLM-Traces aller Simulationen
- Prompt-Versionen und -Performance
- Token-Verbrauch pro Call
- Latenz-Analysen
- Debug-Logs für fehlgeschlagene Runs

**Zugriff:**
Falls Langfuse konfiguriert ist, finden Sie Trace-Links in jedem Simulations-Run.

---

## Best Practices

### Konfiguration

**✅ Empfehlungen:**

1. **Realistische Parameter wählen**
   - ZOPA sollte weder zu eng noch zu weit sein
   - Preise basierend auf echten Marktdaten
   - Maximal 3-5 Produkte pro Verhandlung (für Übersichtlichkeit)

2. **Sinnvolle Dimensionen**
   - 2-4 zusätzliche Dimensionen (nicht zu viele)
   - Priorisierung klar definieren
   - Ranges realistisch setzen

3. **Klare Kontextbeschreibung**
   - Je detaillierter die Market Intelligence, desto realistischer die Simulation
   - Besonderheiten des Partners einbeziehen
   - Historische Erfahrungen teilen

4. **Techniken & Taktiken**
   - 2-3 Techniken für fokussierte Analyse
   - 2-3 Taktiken pro Test
   - Nicht zu viele Kombinationen auf einmal (Kosten!)

**❌ Häufige Fehler:**

- Zu enger ZOPA → Viele Walk-aways
- Zu viele Produkte → Unübersichtliche Ergebnisse
- Unrealistische Preise → Keine Erkenntnisse für echte Verhandlungen
- Zu viele Dimensionen → KI kann nicht fokussieren
- Unklare Prioritäten → Schwammige Ergebnisse

### Analyse

**✅ Empfehlungen:**

1. **Systematisch vorgehen**
   - Erst Gesamtüberblick (Performance Matrix)
   - Dann Detail-Analysen (Drill-Down)
   - Schließlich Conversations reviewen

2. **Muster erkennen**
   - Welche Kombinationen funktionieren konstant gut?
   - Gibt es Ausreißer?
   - Unterschiede je nach ZOPA-Distanz?

3. **Learnings dokumentieren**
   - Notizen zu erfolgreichen Strategien
   - Insights für echte Verhandlungen
   - Benchmarks für zukünftige Simulationen

**❌ Häufige Fehler:**

- Nur auf Deal-Wert fokussieren (andere Dimensionen beachten!)
- Einzelne Outliers überbewerten
- KI-Evaluation ignorieren
- Keine Vergleiche zu früheren Verhandlungen

### Ressourcen-Management

**Kosten unter Kontrolle halten:**

1. **Vor Start kalkulieren**
   - Nutzen Sie die Kosten-Schätzung
   - Starten Sie mit wenigen Kombinationen zum Testen
   - Skalieren Sie nach Bedarf

2. **Effizient testen**
   - Nicht blind alle 1000 Kombinationen durchlaufen lassen
   - Top-3-Techniken identifizieren, dann verfeinern
   - Wiederholungen nur bei wichtigen Erkenntnissen

3. **Monitoring nutzen**
   - Stoppen Sie ineffiziente Runs früh
   - Pausen nutzen für Kosten-Check
   - Budget-Limits setzen

---

## Häufige Fragen (FAQ)

### Allgemein

**F: Wie lange dauert eine Simulation?**
A: Eine einzelne Simulation dauert 2-5 Minuten (abhängig von Rundenzahl und Komplexität). Ein Batch von 50 Simulationen läuft bei 3 parallelen Runs ca. 30-45 Minuten.

**F: Werden meine Daten gespeichert?**
A: Ja, alle Konfigurationen und Ergebnisse werden in der Datenbank gespeichert. Ihre Daten sind durch JWT-Authentifizierung vollständig isoliert (andere Benutzer sehen Ihre Verhandlungen nicht).

**F: Kann ich eine Simulation wiederholen?**
A: Ja, Sie können jede Verhandlung erneut simulieren. Die KI-Agenten verhalten sich deterministisch, d.h. bei gleichen Parametern kommen sehr ähnliche Ergebnisse heraus.

### Technisch

**F: Welche KI-Modelle werden genutzt?**
A: Die Plattform nutzt **OpenAI GPT-4o** für die Verhandlungen und **GPT-4o-mini** für die Evaluationen. Die Modelle können konfiguriert werden.

**F: Was passiert bei einem Fehler während der Simulation?**
A: Die Plattform hat ein automatisches Retry-System. Fehlgeschlagene Simulationen werden bis zu 3x wiederholt. Bei dauerhaftem Fehler wird der Run als "failed" markiert und Sie können Details in den Logs sehen.

**F: Kann ich die Plattform offline nutzen?**
A: Nein, die Plattform benötigt eine Internetverbindung, da die KI-Modelle über APIs angebunden sind.

### Kosten

**F: Wie teuer ist eine Simulation?**
A: Die Kosten variieren je nach Komplexität:
- Einfache Simulation (1 Produkt, 10 Runden): ~$0.20-0.40
- Mittlere Simulation (3 Produkte, 20 Runden): ~$0.50-1.00
- Komplexe Simulation (5 Produkte, 30 Runden): ~$1.00-2.00

Ein typischer Batch (50 Simulationen) kostet $20-50.

**F: Wer bezahlt die API-Kosten?**
A: Die API-Kosten werden von Ihrer Organisation getragen. Sie sehen die Kosten transparent im Dashboard.

**F: Kann ich ein Budget-Limit setzen?**
A: Ja, Ihr Administrator kann Budget-Limits pro Benutzer oder Organisation konfigurieren.

### Interpretation

**F: Was ist eine "gute" Erfolgsrate?**
A: Das hängt vom Kontext ab:
- 90%+ Deal-Akzeptanz: Sehr gut (realistische ZOPA)
- 70-90%: Gut (moderate ZOPA-Überlappung)
- 50-70%: Herausfordernd (enge ZOPA)
- <50%: Schwierig (zu enge ZOPA oder zu aggressive Strategie)

**F: Warum haben manche Techniken niedrigere Scores?**
A: Techniken wirken unterschiedlich je nach:
- Art des Counterparts (Persönlichkeit, Stil)
- Machtverhältnis
- ZOPA-Konstellation
- Kombination mit Taktiken

Eine Technik mit niedrigem Durchschnitt kann in spezifischen Situationen dennoch sehr effektiv sein!

**F: Kann ich den KI-Agenten vertrauen?**
A: Die KI-Agenten basieren auf State-of-the-Art Sprachmodellen und sind mit Negotiation-Best-Practices trainiert. Die Ergebnisse sind statistisch valide, aber:
- KI ist nicht perfekt (wie auch echte Verhandler)
- Nutzen Sie die Ergebnisse als Orientierung, nicht als absolute Wahrheit
- Validieren Sie Insights in echten Verhandlungen

### Fehlerbehebung

**F: Meine Simulation hängt - was tun?**
A:
1. Prüfen Sie den Status im Monitor
2. Warten Sie 2-3 Minuten (manchmal dauern komplexe Runden länger)
3. Falls keine Änderung: Pausieren und neu starten
4. Bei wiederholtem Problem: Administrator kontaktieren

**F: Ich sehe keine Ergebnisse nach Abschluss - was ist los?**
A:
1. Aktualisieren Sie die Seite (F5)
2. Prüfen Sie, ob der Status wirklich "completed" ist
3. Schauen Sie in die Detail-Ansicht des Runs
4. Falls Daten fehlen: Möglicherweise ist die Result-Processing fehlgeschlagen → Administrator kontaktieren

**F: Die Kosten sind höher als geschätzt - warum?**
A: Die Schätzung ist ein Durchschnittswert. Kosten können höher sein bei:
- Komplexen Produkten (mehr Token)
- Längeren Verhandlungen (mehr Runden als erwartet)
- Mehrfachen Retries (bei Fehlern)

---

## Support & Weitere Ressourcen

### Dokumentation

**Technische Dokumentation (für Entwickler):**
- [README.md](README.md) - Installation und Quick Start
- [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md) - Entwickler-Onboarding
- [FINAL_SCHEMA_DOCUMENTATION.md](FINAL_SCHEMA_DOCUMENTATION.md) - Datenbank-Schema
- [DATA_FLOW_OVERVIEW.md](DATA_FLOW_OVERVIEW.md) - System-Architektur

### Support kontaktieren

Bei Fragen oder Problemen:

1. **Technische Fragen:** Entwickler-Team kontaktieren
2. **Fachliche Fragen:** Product Owner kontaktieren
3. **Bugs/Fehler:** GitHub Issues erstellen (falls aktiviert)

### Updates & Releases

Die Plattform wird kontinuierlich weiterentwickelt. Aktuelle Änderungen finden Sie in:
- [CHANGELOG.md](CHANGELOG.md) - Versionsverlauf und neue Features

---

## Glossar

**ZOPA** - Zone of Possible Agreement - Überlappungsbereich zwischen Käufer-Maximum und Verkäufer-Minimum, in dem ein Deal möglich ist.

**BATNA** - Best Alternative to a Negotiated Agreement - Beste Alternative, falls keine Einigung erzielt wird.

**Walk-away** - Abbruch der Verhandlung ohne Einigung.

**Deal Value** - Gesamtwert aller vereinbarten Produkte (Preis × Volumen).

**Dimensionen** - Verhandlungsaspekte neben dem Preis (z.B. Zahlungsziel, Lieferzeit).

**Effektivitäts-Score** - KI-generierte Bewertung (1-10) wie gut eine Technik/Taktik funktioniert hat.

**Performance Matrix** - Heatmap-Darstellung aller Technik-Taktik-Kombinationen.

**Kombinatorisches Testing** - Systematisches Testen aller möglichen Kombinationen von Techniken, Taktiken, Persönlichkeiten und ZOPA-Distanzen.

**Interpersonal Circumplex** - Psychologisches Modell mit zwei Dimensionen (Dominanz, Affiliation) zur Beschreibung von Persönlichkeiten.

**Langfuse** - Observability-Plattform für LLM-Tracing und Monitoring.

**JWT** - JSON Web Token - Authentifizierungs-Methode der Plattform.

**Simulation Run** - Ein einzelner Durchlauf einer Verhandlung mit spezifischen Parametern.

**Queue** - Warteschlange für Simulations-Runs, die sequenziell abgearbeitet werden.

**Playbook** - KI-generiertes Verhandlungs-Handbuch mit konkreten Handlungsempfehlungen.

---

## Changelog

**Version 1.0.0** (November 2025)
- Initiale Release mit vollständiger Funktionalität
- JWT-Authentifizierung
- Kombinatorisches Testing
- AI-Evaluation System
- Performance Matrix Analysen
- Real-time Monitoring
- Azure Deployment

---

**Stand:** November 2025
**Version:** 1.0.0
**Letzte Aktualisierung:** 2025-11-21

Für technische Details siehe [README.md](README.md) und [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md).
