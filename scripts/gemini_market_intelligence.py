#!/usr/bin/env python3
"""
Gemini Flash Market Intelligence
Verwendet Google Gemini 2.5 Flash mit Grounded Search (Google Search Tool)
"""

import os
import sys
import json
from typing import Optional
from google import genai
from google.genai import types


def _extract_json_payload(raw_text: str) -> Optional[str]:
    """
    Versucht den ersten JSON-Block ({...} oder [...]) aus dem Text zu extrahieren.
    Berücksichtigt verschachtelte Klammern und ignoriert Zeichen innerhalb von Strings.
    """

    def _extract_from_index(text: str, start_idx: int, opening: str, closing: str) -> Optional[str]:
        depth = 0
        in_string = False
        escape = False

        for idx in range(start_idx, len(text)):
            char = text[idx]

            if escape:
                escape = False
                continue

            if char == '\\':
                escape = True
                continue

            if char == '"':
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == opening:
                depth += 1
            elif char == closing:
                depth -= 1

                if depth == 0:
                    return text[start_idx:idx + 1]

        return None

    stripped = raw_text.strip()
    if not stripped:
        return None

    for index, character in enumerate(stripped):
        if character == '{':
            candidate = _extract_from_index(stripped, index, '{', '}')
            if candidate:
                return candidate
        elif character == '[':
            candidate = _extract_from_index(stripped, index, '[', ']')
            if candidate:
                return candidate

    return None

def generate_market_intelligence(negotiation_context: dict) -> list[dict]:
    """
    Generiert Marktanalyse mit Gemini Flash und Google Search

    Args:
        negotiation_context: Dict mit:
            - title: Verhandlungstitel
            - marktProduktKontext: Markt- und Produktbeschreibung
            - userRole: buyer | seller
            - produkte: Liste von Produkten

    Returns:
        Liste von Marktanalyse-Items mit:
            - aspekt: Beschreibung des Aspekts
            - quelle: URL der Quelle
            - relevanz: hoch | mittel | niedrig
    """

    # API Key aus Umgebungsvariable
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")

    # Gemini Client initialisieren
    client = genai.Client(api_key=api_key)

    # Model und Tools konfigurieren
    model = "gemini-flash-latest"

    # Google Search Tool aktivieren
    tools = [types.Tool(googleSearch=types.GoogleSearch())]

    # Generate Content Config mit Thinking Budget
    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_budget=-1),
        tools=tools,
    )

    # Prompt erstellen basierend auf Kontext
    title = negotiation_context.get('title', '')
    markt_kontext = negotiation_context.get('marktProduktKontext', '')
    user_role = negotiation_context.get('userRole', 'buyer')
    produkte = negotiation_context.get('produkte', [])

    # Produkt-Namen extrahieren
    produkt_namen = [p.get('produktName', '') for p in produkte if p.get('produktName')]
    produkt_text = ', '.join(produkt_namen) if produkt_namen else 'keine spezifischen Produkte angegeben'

    rolle_text = 'Käufer' if user_role == 'buyer' else 'Verkäufer'

    prompt = f"""Du bist ein Experte für Verhandlungsvorbereitung und Marktanalyse.

Verhandlung: {title}
Rolle: {rolle_text}
Produkte: {produkt_text}

Markt- und Produktkontext:
{markt_kontext}

Aufgabe:
Recherchiere aktuelle Marktinformationen, die für diese Verhandlung relevant sind. Fokussiere dich auf:
1. Aktuelle Marktpreise und Preisentwicklungen
2. Wettbewerbssituation und Marktanteile
3. Branchentrends und Marktbedingungen
4. Regulatorische oder wirtschaftliche Faktoren

Antworte im folgenden JSON-Format (WICHTIG: Nur valides JSON, keine zusätzlichen Texte):
{{
  "intelligence": [
    {{
      "aspekt": "Kurze Beschreibung des Marktaspekts",
      "quelle": "URL der Quelle",
      "relevanz": "hoch"
    }}
  ]
}}

Relevanz-Stufen:
- hoch: Direkt preisrelevant oder verhandlungskritisch
- mittel: Wichtiger Kontext, beeinflusst Strategie
- niedrig: Hintergrundinformation

Gib 3-5 der wichtigsten Aspekte zurück. Bedenke, vor allem, wie sie für deine Rolle (Käufer/Verkäufer) relevant sind."""

    # Contents strukturieren
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]

    try:
        # Gemini API Call mit Grounded Search
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )

        # DEBUG: Rohe Response ausgeben (nur bei Bedarf aktivieren)
        # print("=== GEMINI RAW RESPONSE ===", file=sys.stderr)
        # print(f"Response object: {response}", file=sys.stderr)
        # print(f"Response text: {response.text}", file=sys.stderr)
        # print("=== END RAW RESPONSE ===", file=sys.stderr)

        # Response Text extrahieren
        response_text = response.text.strip()

        # JSON aus Markdown Code-Blocks extrahieren (falls vorhanden)
        if response_text.startswith('```'):
            # Entferne ```json und schließende ```
            lines = response_text.split('\n')
            # Erste Zeile (```json) und letzte Zeile (```) entfernen
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            response_text = '\n'.join(lines).strip()

        def _normalize_and_validate(raw_json: str) -> list[dict]:
            result = json.loads(raw_json)
            intelligence_items = result.get('intelligence', [])

            normalized_items: list[dict] = []
            for item in intelligence_items:
                if isinstance(item, dict) and 'aspekt' in item:
                    normalized_items.append({
                        'aspekt': item.get('aspekt', ''),
                        'quelle': item.get('quelle', ''),
                        'relevanz': item.get('relevanz', 'mittel'),
                    })
            return normalized_items

        try:
            return _normalize_and_validate(response_text)

        except json.JSONDecodeError:
            # Fallback: Versuche JSON aus Response zu extrahieren
            extracted = _extract_json_payload(response_text)
            if extracted:
                try:
                    return _normalize_and_validate(extracted)
                except json.JSONDecodeError:
                    pass

            print("JSON Parse Error: Expecting valid JSON payload", file=sys.stderr)
            print(f"Response Text: {response_text}", file=sys.stderr)

            # Return Fehler-Item
            return [{
                'aspekt': 'Fehler beim Parsen der Gemini-Antwort',
                'quelle': '',
                'relevanz': 'niedrig',
            }]

    except Exception as e:
        print(f"Gemini API Error: {e}", file=sys.stderr)
        raise


def main():
    """CLI Entry Point"""
    if len(sys.argv) < 2:
        print("Usage: gemini_market_intelligence.py <json_context>", file=sys.stderr)
        sys.exit(1)

    # JSON Context von stdin oder argv
    try:
        context_json = sys.argv[1]
        context = json.loads(context_json)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    # Market Intelligence generieren
    try:
        intelligence = generate_market_intelligence(context)

        # Als JSON ausgeben
        print(json.dumps({'intelligence': intelligence}, ensure_ascii=False, indent=2))

    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
