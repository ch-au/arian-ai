# Negotiation Playbook Generator - API Documentation

## Overview

Der Playbook-Generator erstellt ein umfassendes Verhandlungsplaybook aus allen Simulation Runs einer Negotiation. Er verwendet die Langfuse-Prompt `playbookGenerator` und generiert Markdown-Output via LLM.

## Endpoint

```
POST /api/negotiations/:id/playbook
```

### Request

**URL Parameter:**
- `id` (required): UUID der Negotiation

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "playbook": "# Verhandlungsplaybook\n\n## Einleitung\n...",
  "metadata": {
    "negotiation_id": "99a75f3f-3054-4566-b519-4df81f047aeb",
    "company_name": "Dein Unternehmen",
    "opponent_name": "REWE",
    "negotiation_title": "Jahresgespräch 2024",
    "model": "gemini/gemini-2.0-flash-exp",
    "prompt_version": 1
  }
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Playbook generation failed",
  "details": "Error message..."
}
```

## Implementation Details

### Python Script

Das Backend ruft `scripts/generate_playbook.py` auf, welches:

1. **Daten sammelt:**
   - Negotiation Metadata (Firmenname, Opponent, Titel)
   - Alle Simulation Runs via `negotiation_playbook.py`

2. **LLM-Call:**
   - Lädt Langfuse Prompt: `playbookGenerator`
   - Input-Variablen:
     - `company_name`: Name des Unternehmens
     - `opponent_name`: Name des Verhandlungspartners
     - `negotiation_title`: Titel der Verhandlung
     - `logs`: JSON-String aller Simulation Runs (komplett)
   - Verwendet LiteLLM für Multi-Provider Support

3. **Output:**
   - Markdown-formatiertes Playbook
   - Metadata über Model und Prompt Version

### Langfuse Prompt Requirements

Der Prompt `playbookGenerator` muss folgende Variablen unterstützen:

```
{{company_name}}      - Name des Unternehmens
{{opponent_name}}     - Name des Gegenübers
{{negotiation_title}} - Titel der Verhandlung
{{logs}}              - JSON mit allen Simulation Run Daten
```

### Data Structure (logs)

Der `logs` Parameter enthält ein JSON-Array mit folgender Struktur pro Run:

```json
[
  {
    "id": "uuid",
    "name": "Technik + Taktik",
    "summary": {
      "tacticSummary": "...",
      "techniqueEffectivenessScore": 8.0,
      "tacticEffectivenessScore": 6.0,
      "dealValue": 105000.0,
      "outcome": "DEAL_ACCEPTED",
      "totalRounds": 4
    },
    "performance": {
      "productResults": [...],
      "dimensionResults": [...]
    },
    "conversationLog": [
      {
        "turn": 1,
        "agent": "SELLER",
        "offer": {...},
        "message": "...",
        "internal_analysis": "..."
      }
    ],
    "metadata": {
      "technique": "Legitimieren",
      "tactic": "Zeitdruck",
      "startedAt": "2025-11-19T19:41:23.483000+00:00",
      "completedAt": "2025-11-19T19:41:45.813000+00:00"
    }
  }
]
```

## Usage Example

### cURL

```bash
curl -X POST \
  https://your-api.com/api/negotiations/99a75f3f-3054-4566-b519-4df81f047aeb/playbook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### TypeScript/JavaScript

```typescript
async function generatePlaybook(negotiationId: string) {
  const response = await fetch(
    `/api/negotiations/${negotiationId}/playbook`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log(result.playbook); // Markdown text
    return result;
  } else {
    throw new Error(result.error);
  }
}
```

## Environment Variables

Benötigte Environment Variables (in `.env`):

```bash
# Database
DATABASE_URL=postgresql://...

# Langfuse (for prompt loading)
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=https://cloud.langfuse.com

# LiteLLM (for model access)
LITELLM_MODEL=gemini/gemini-2.0-flash-exp  # Optional, can be in Langfuse prompt config
GEMINI_API_KEY=...                          # If using Gemini
OPENAI_API_KEY=...                          # If using OpenAI
ANTHROPIC_API_KEY=...                       # If using Claude

# Python
PYTHON_PATH=python  # Optional, defaults to 'python'
```

## Testing

### Manual Test

```bash
# Test Python script directly
python scripts/generate_playbook.py \
  --negotiation-id=99a75f3f-3054-4566-b519-4df81f047aeb

# Test via API
curl -X POST http://localhost:5000/api/negotiations/99a75f3f-3054-4566-b519-4df81f047aeb/playbook \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Handling

Der Endpoint kann folgende Fehler zurückgeben:

- **404 Not Found**: Negotiation existiert nicht
- **403 Forbidden**: User hat keine Berechtigung
- **500 Internal Server Error**:
  - Python Script konnte nicht gestartet werden
  - Langfuse Prompt nicht gefunden
  - LLM-Call fehlgeschlagen
  - Datenbankfehler

Alle Fehler werden mit Details im `details` Feld zurückgegeben.
