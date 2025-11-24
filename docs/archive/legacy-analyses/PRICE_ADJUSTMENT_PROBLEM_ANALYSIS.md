# Price Adjustment Problem - Vollständige Analyse

## 🎯 Kernproblem

Der **OPPONENT Agent** sieht in seinen **DESIRES** immer noch die **echten User-Zielpreise** statt der angepassten Preise basierend auf `counterpartDistance`.

### Aktueller Output (FALSCH):

```
OPPONENT Agent (BUYER) - DESIRES:
• Zielpreis: €1,10  ❌ FALSCH - das ist der echte User-Preis!
• Max: €1,30
```

### Erwarteter Output (KORREKT):

Bei `counterpartDistance = 50`:
```
OPPONENT Agent (BUYER) - DESIRES:
• Zielpreis: €0,94  ✅ RICHTIG - 15% niedriger als User-Zielpreis (1,10 → 0,94)
• Max: €1,11        ✅ RICHTIG - 15% niedriger als User-Max (1,30 → 1,11)
```

---

## 📊 Bisherige Lösungsansätze

### ✅ Lösungsansatz 1: Python-Code implementiert (ERFOLGREICH)

**Datei:** `scripts/run_production_negotiation.py`

**Implementierte Funktionen:**

#### 1. `_calculate_opponent_target_price()` (Zeilen 658-713)
```python
def _calculate_opponent_target_price(
    self,
    own_target_price: float,
    counterpart_distance_data: Any,
    opponent_role: str,
    max_deviation: float = 0.30
) -> float:
    """Calculate opponent's perceived target price based on distance."""

    # Extract distance value
    if isinstance(counterpart_distance_data, dict):
        distance = float(counterpart_distance_data.get('gesamt', 0))
    else:
        distance = float(counterpart_distance_data or 0)

    # Clamp distance to 0-100
    distance = max(0.0, min(distance, 100.0))

    # Calculate deviation factor
    deviation_factor = (distance / 100.0) * max_deviation

    # Apply deviation based on opponent's role
    if opponent_role.upper() == "BUYER":
        adjusted_price = own_target_price * (1 - deviation_factor)
    elif opponent_role.upper() == "SELLER":
        adjusted_price = own_target_price * (1 + deviation_factor)

    return adjusted_price
```

**Status:** ✅ Implementiert und getestet

#### 2. `_build_pricing_strings()` - Updated (Zeilen 715-766)
```python
def _build_pricing_strings(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> Dict[str, str]:
```

**Status:** ✅ Signatur erweitert

#### 3. `_format_pricing_related_text()` - Updated (Zeilen 767-816)
```python
def _format_pricing_related_text(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> str:
    # ...

    # For opponent agent, adjust target price based on distance
    if not use_self_prompt and target_price and counterpart:
        distance_data = counterpart.get('counterpartDistance') or counterpart.get('distance')
        adjusted_target = self._calculate_opponent_target_price(
            own_target_price=float(target_price),
            counterpart_distance_data=distance_data,
            opponent_role=role
        )
        target_price = adjusted_target
```

**Status:** ✅ Implementiert mit Preis-Anpassung

#### 4. `_format_products_for_prompt()` - Updated (Zeilen 1003-1045)
```python
def _format_products_for_prompt(
    self,
    products: List[Dict],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> str:
    # ...

    # For opponent agent, adjust target price based on distance
    if not use_self_prompt and ziel_preis and counterpart:
        distance_data = counterpart.get('counterpartDistance') or counterpart.get('distance')
        adjusted_target = self._calculate_opponent_target_price(
            own_target_price=float(ziel_preis),
            counterpart_distance_data=distance_data,
            opponent_role=role
        )
        ziel_preis = adjusted_target
```

**Status:** ✅ Implementiert mit Preis-Anpassung

---

### ❌ Problem 1: `counterpartDistance` war `None` (GELÖST)

**Problem:**
Debug-Logs zeigten:
```
counterpartDistance: None
Opponent target price: 1.10 → 1.10 (distance=0.0, deviation=0.00%, role=BUYER)
```

**Root Cause:**
Frontend setzte `counterpartDistance` falsch:
- Zeile 257: `counterpartDistance: { gesamt: 0 }` ❌ Default war 0
- Zeile 277: Duplicate in `counterpartProfile`

**Lösung:**
`client/src/components/CreateNegotiationForm.tsx` gefixt:
```typescript
// VORHER:
counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 0 },  ❌
counterpartProfile: {
  counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 50 },  ❌
}

// NACHHER:
counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 50 },  ✅
counterpartProfile: {
  // Removed counterpartDistance
}
```

**Status:** ✅ GELÖST

---

### ⚠️ Problem 2: Preis-Anpassung funktioniert NICHT in DESIRES (AKTUELL)

**Symptom:**
```
OPPONENT Agent - DESIRES:
• Zielpreis: €1,10  ❌ Zeigt User-Preis (nicht angepasst!)
• Max: €1,30        ❌ Zeigt User-Max (nicht angepasst!)
```

**Erwartung:**
Bei `distance=50`, `opponent=BUYER`:
```
OPPONENT Agent - DESIRES:
• Zielpreis: €0,94  ✅ (1.10 * 0.85 = 0.935)
• Max: €1,11        ✅ (1.30 * 0.85 = 1.105)
```

---

## 🔍 Wo wird DESIRES generiert?

### Verdächtige Methoden:

#### 1. `_format_pricing_related_text()` (Zeilen 767-816)

**Verwendet in:** `_build_static_prompt_variables()` Zeile 502

```python
pricing_related_text = self._format_pricing_related_text(products, role, use_self_prompt, counterpart)
# → Wird zu Variable 'pricing_related_text'
```

**Frage:** Wird diese Variable in DESIRES verwendet?

#### 2. `_format_products_for_prompt()` (Zeilen 1003-1045)

**Verwendet in:** `_build_static_prompt_variables()` Zeile 503

```python
products_info = self._format_products_for_prompt(products, role, use_self_prompt, counterpart)
# → Wird zu Variable 'products_info'
```

**Frage:** Wird diese Variable in DESIRES verwendet?

#### 3. `_build_pricing_strings()` (Zeilen 715-766)

**Verwendet in:** `_build_static_prompt_variables()` Zeile 501

```python
pricing_strings = self._build_pricing_strings(products, role, use_self_prompt, counterpart)
# → Liefert Dict mit: 'namen', 'zielpreise', 'maxpreise', 'volumes'
```

**Rückgabe-Struktur:**
```python
return {
    'namen': ", ".join(namen),
    'zielpreise': ", ".join(zielpreise),
    'maxpreise': ", ".join(maxpreise),
    'volumes': ", ".join(volumes)
}
```

**KRITISCH:** Diese Variablen werden direkt in Langfuse-Prompt injiziert!

---

## 🐛 Root Cause Analyse

### Verdacht 1: `_build_pricing_strings()` passt Preise NICHT an

Schauen wir uns die Methode an (Zeilen 715-766):

```python
def _build_pricing_strings(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,
    counterpart: Dict[str, Any] = None
) -> Dict[str, str]:
    """Build pricing strings from products for prompt variables."""

    if not products:
        return {
            'namen': 'Keine Produkte definiert',
            'zielpreise': '',
            'maxpreise': '',
            'volumes': ''
        }

    namen = []
    zielpreise = []
    maxpreise = []
    volumes = []

    for product in products:
        attrs = product.get('attrs', {})
        name = product.get('name', 'Unbekanntes Produkt')

        target_price = attrs.get('targetPrice') or attrs.get('zielPreis')
        min_price = attrs.get('minPrice') or attrs.get('minPreis')
        max_price = attrs.get('maxPrice') or attrs.get('maxPreis')
        estimated_volume = attrs.get('estimatedVolume')

        # Format values
        target_str = f"{target_price:.2f} EUR" if target_price else "nicht definiert"

        # Determine guard price based on role
        if role.upper() == AgentRole.BUYER:
            guard_str = f"{max_price:.2f} EUR" if max_price else "nicht definiert"
        else:  # SELLER
            guard_str = f"{min_price:.2f} EUR" if min_price else "nicht definiert"

        volume_str = f"{estimated_volume:,}" if estimated_volume else "nicht definiert"

        namen.append(name)
        zielpreise.append(target_str)
        maxpreise.append(guard_str)
        volumes.append(volume_str)

    return {
        'namen': ", ".join(namen),
        'zielpreise': ", ".join(zielpreise),
        'maxpreise': ", ".join(maxpreise),
        'volumes': ", ".join(volumes)
    }
```

**PROBLEM GEFUNDEN! 🚨**

Die Methode `_build_pricing_strings()` hat die Parameter `use_self_prompt` und `counterpart`, aber **NUTZT SIE NICHT**!

Es gibt **KEINE Preis-Anpassung** in dieser Methode!

---

## 🎯 Die fehlende Logik

### Was fehlt in `_build_pricing_strings()`:

```python
def _build_pricing_strings(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,
    counterpart: Dict[str, Any] = None
) -> Dict[str, str]:
    # ... existing code ...

    for product in products:
        # ... existing extraction ...

        # ⚠️ FEHLT: Preis-Anpassung für Opponent!
        if not use_self_prompt and counterpart:
            distance_data = counterpart.get('counterpartDistance') or counterpart.get('distance')

            # Adjust target price
            if target_price:
                target_price = self._calculate_opponent_target_price(
                    own_target_price=float(target_price),
                    counterpart_distance_data=distance_data,
                    opponent_role=role
                )

            # Adjust guard price (max for BUYER, min for SELLER)
            if role.upper() == AgentRole.BUYER and max_price:
                max_price = self._calculate_opponent_target_price(
                    own_target_price=float(max_price),
                    counterpart_distance_data=distance_data,
                    opponent_role=role
                )
            elif role.upper() == AgentRole.SELLER and min_price:
                min_price = self._calculate_opponent_target_price(
                    own_target_price=float(min_price),
                    counterpart_distance_data=distance_data,
                    opponent_role=role
                )

        # Then format the (possibly adjusted) prices
        target_str = f"{target_price:.2f} EUR" if target_price else "nicht definiert"
        # ... rest of formatting ...
```

---

## 📋 Vergleich: Wo funktioniert es, wo nicht?

### ✅ Funktioniert: `_format_pricing_related_text()`

```python
# Zeilen 793-806
if not use_self_prompt and target_price and counterpart:
    distance_data = counterpart.get('counterpartDistance') or counterpart.get('distance')
    adjusted_target = self._calculate_opponent_target_price(
        own_target_price=float(target_price),
        counterpart_distance_data=distance_data,
        opponent_role=role
    )
    target_price = adjusted_target  # ✅ Preis wird angepasst
```

**Wo verwendet:** Variable `pricing_related_text`

### ✅ Funktioniert: `_format_products_for_prompt()`

```python
# Zeilen 1039-1046
if not use_self_prompt and ziel_preis and counterpart:
    distance_data = counterpart.get('counterpartDistance') or counterpart.get('distance')
    adjusted_target = self._calculate_opponent_target_price(
        own_target_price=float(ziel_preis),
        counterpart_distance_data=distance_data,
        opponent_role=role
    )
    ziel_preis = adjusted_target  # ✅ Preis wird angepasst
```

**Wo verwendet:** Variable `products_info`

### ❌ Funktioniert NICHT: `_build_pricing_strings()`

```python
# Zeilen 715-766
# KEINE Preis-Anpassung implementiert!
target_str = f"{target_price:.2f} EUR" if target_price else "nicht definiert"
# ❌ target_price wird NICHT angepasst!
```

**Wo verwendet:** Variablen `zielpreise`, `maxpreise` (direkt in DESIRES!)

---

## 🔍 Langfuse Prompt Analyse

### Welche Variablen werden in DESIRES verwendet?

**Vermutung:** Der Langfuse Prompt für DESIRES verwendet:
- `{{zielpreise}}` - aus `_build_pricing_strings()`
- `{{maxpreise}}` - aus `_build_pricing_strings()`
- `{{namen}}` - aus `_build_pricing_strings()`

**PROBLEM:** Diese Variablen werden in `_build_pricing_strings()` erstellt, aber dort fehlt die Preis-Anpassung!

---

## 🎯 Lösung

### Option 1: Preis-Anpassung in `_build_pricing_strings()` hinzufügen

**Datei:** `scripts/run_production_negotiation.py`
**Methode:** `_build_pricing_strings()` (Zeilen 715-766)

**Änderung:** Preis-Anpassung vor dem Formatieren durchführen (analog zu `_format_pricing_related_text()`)

**Vorteile:**
- ✅ Konsistent mit anderen Methoden
- ✅ Alle pricing_strings Variablen werden korrekt angepasst
- ✅ DESIRES zeigt angepasste Preise

**Nachteile:**
- Muss sicherstellen, dass min/max Preise auch angepasst werden

### Option 2: Andere Variablen in Langfuse Prompt verwenden

**Änderung:** Im Langfuse Prompt `pricing_related_text` statt einzelner Variablen verwenden

**Vorteile:**
- ✅ Keine Code-Änderung nötig
- ✅ Verwendet bereits angepasste Preise

**Nachteile:**
- ⚠️ Format passt möglicherweise nicht zu DESIRES-Struktur
- ⚠️ Weniger flexibel

---

## 📊 Debug-Informationen

### Wichtige Log-Stellen:

```python
# Zeile 464: Counterpart data
logger.debug(f"Counterpart data: {counterpart}")

# Zeile 496-500: Opponent pricing
if not use_self_prompt:
    logger.debug(f"   → Building opponent pricing with distance adjustment:")
    logger.debug(f"      - counterpart data available: {bool(counterpart)}")
    if counterpart:
        distance = counterpart.get('counterpartDistance') or counterpart.get('distance')
        logger.debug(f"      - counterpartDistance: {distance}")

# Zeile 803-806: Price adjustment (in _format_pricing_related_text)
logger.debug(f"      → Adjusting price for {name}: {target_price} EUR")
# ... adjustment ...
logger.debug(f"      → Adjusted to: {target_price:.2f} EUR")
```

### Zu prüfen:

```bash
# Check if counterpartDistance is available
grep "counterpartDistance:" logs

# Check if price adjustment happens
grep "Opponent target price" logs

# Check what values go into pricing_strings
# → FEHLT: Debug-Logging in _build_pricing_strings()!
```

---

## ✅ Empfohlene Lösung

### Schritt 1: Debug-Logging in `_build_pricing_strings()` hinzufügen

```python
def _build_pricing_strings(...):
    logger.debug(f"Building pricing strings for role={role}, use_self_prompt={use_self_prompt}")
    if counterpart:
        logger.debug(f"Counterpart distance data: {counterpart.get('counterpartDistance')}")

    # ... existing code ...

    for product in products:
        # ... extraction ...
        logger.debug(f"Product: {name}, original target: {target_price}, max: {max_price}")
```

### Schritt 2: Preis-Anpassung implementieren

Analog zu `_format_pricing_related_text()` Zeilen 793-806.

### Schritt 3: Testen

```bash
# Create new negotiation with distance=50
# Check logs:
grep "Building pricing strings" logs
grep "original target" logs
grep "Adjusted to" logs

# Verify Langfuse trace:
# DESIRES should show adjusted prices
```

---

## 📝 Status

### Implementiert:
- ✅ `_calculate_opponent_target_price()` - Berechnungslogik
- ✅ `_format_pricing_related_text()` - Preis-Anpassung
- ✅ `_format_products_for_prompt()` - Preis-Anpassung
- ✅ Frontend `counterpartDistance` Default-Wert Fix
- ✅ Debug-Logging in mehreren Methoden

### Fehlt:
- ❌ **`_build_pricing_strings()` - Preis-Anpassung** ← KRITISCH!
- ❌ Debug-Logging in `_build_pricing_strings()`
- ❌ Verifikation welche Variablen DESIRES verwendet

### Nächste Schritte:
1. Preis-Anpassung in `_build_pricing_strings()` implementieren
2. Debug-Logging hinzufügen
3. Test mit `distance=50` durchführen
4. Langfuse Trace überprüfen

---

## 🎓 Lessons Learned

1. **Konsistenz ist wichtig:** Wenn Parameter hinzugefügt werden (`use_self_prompt`, `counterpart`), müssen sie auch **verwendet** werden!

2. **Debug-Logging ist essentiell:** Ohne Logging schwer zu finden, wo Anpassung fehlt.

3. **Multiple Code-Paths:** Es gibt 3 Methoden die Preise formatieren:
   - `_build_pricing_strings()` → für separate Variablen
   - `_format_pricing_related_text()` → für Textblock
   - `_format_products_for_prompt()` → für Produktinfo

   Alle müssen konsistent sein!

4. **Frontend-Backend-Python Pipeline:** Daten müssen durch 3 Schichten fließen:
   - Frontend: `scenario.counterpartDistance`
   - Backend: Speichern und weitergeben
   - Python: Verwenden zur Berechnung

---

**Fazit:** Die Preis-Anpassung funktioniert in 2 von 3 Methoden. `_build_pricing_strings()` wurde vergessen zu aktualisieren, obwohl die Parameter hinzugefügt wurden! 🎯


