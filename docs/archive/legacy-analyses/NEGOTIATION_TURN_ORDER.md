# Negotiation Turn Order - USER startet immer

## 🎯 Anforderung

Die **eigene Company (USER)** soll IMMER die Verhandlung beginnen, unabhängig davon, ob der User als BUYER oder SELLER agiert.

## ❌ Alte Logik (FALSCH)

```python
# Alte Implementierung - unabhängig von User-Rolle
role = AgentRole.BUYER if round_num % 2 == 1 else AgentRole.SELLER
```

### Problem:
- Runde 1 → IMMER BUYER (auch wenn User = SELLER!)
- Runde 2 → IMMER SELLER
- **User startet nur wenn User = BUYER** ❌

### Beispiel 1: User = BUYER ✅
```
Round 1: BUYER (USER) ✅ Korrekt - User startet
Round 2: SELLER (OPPONENT)
Round 3: BUYER (USER)
Round 4: SELLER (OPPONENT)
```

### Beispiel 2: User = SELLER ❌
```
Round 1: BUYER (OPPONENT) ❌ FALSCH - Opponent startet!
Round 2: SELLER (USER)
Round 3: BUYER (OPPONENT)
Round 4: SELLER (USER)
```

## ✅ Neue Logik (KORREKT)

```python
# Neue Implementierung - basiert auf User-Rolle
if round_num == 1:
    role = self.user_role  # User always starts
elif round_num % 2 == 1:
    role = self.user_role  # Odd rounds = user
else:
    role = self.opponent_role  # Even rounds = opponent
```

### Vorteil:
- Runde 1 → IMMER USER (egal ob BUYER oder SELLER!)
- Danach Alternierung: USER → OPPONENT → USER → OPPONENT

### Beispiel 1: User = BUYER ✅
```
Round 1: BUYER (USER) ✅ User startet
Round 2: SELLER (OPPONENT)
Round 3: BUYER (USER)
Round 4: SELLER (OPPONENT)
Round 5: BUYER (USER)
Round 6: SELLER (OPPONENT)
```

### Beispiel 2: User = SELLER ✅
```
Round 1: SELLER (USER) ✅ User startet
Round 2: BUYER (OPPONENT)
Round 3: SELLER (USER)
Round 4: BUYER (OPPONENT)
Round 5: SELLER (USER)
Round 6: BUYER (OPPONENT)
```

## 🔍 Rollenzuweisung Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Config enthält: counterpart.kind                     │
│    z.B. "retailer" (= Händler/Buyer)                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Determine OPPONENT role from counterpart.kind        │
│    "retailer" → opponent_role = BUYER                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. USER role is INVERSE of opponent                     │
│    opponent = BUYER → user_role = SELLER                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Create agents with correct prompts                   │
│    SELLER agent gets self_agent (detailed)              │
│    BUYER agent gets opponent_agent (simplified)         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Negotiation starts                                    │
│    Round 1: user_role (SELLER) starts ✅                │
│    Round 2: opponent_role (BUYER)                       │
│    Round 3: user_role (SELLER)                          │
│    ...                                                   │
└─────────────────────────────────────────────────────────┘
```

## 📊 Vergleich: Vorher vs. Nachher

### Szenario: User = SELLER, Opponent = BUYER

| Runde | VORHER | NACHHER |
|-------|--------|---------|
| 1 | BUYER (OPPONENT) ❌ | **SELLER (USER)** ✅ |
| 2 | SELLER (USER) | BUYER (OPPONENT) |
| 3 | BUYER (OPPONENT) | **SELLER (USER)** ✅ |
| 4 | SELLER (USER) | BUYER (OPPONENT) |
| 5 | BUYER (OPPONENT) | **SELLER (USER)** ✅ |
| 6 | SELLER (USER) | BUYER (OPPONENT) |

**Vorher:** OPPONENT startet, USER in Runden 2, 4, 6 (gerade) ❌  
**Nachher:** USER startet, USER in Runden 1, 3, 5 (ungerade) ✅

### Szenario: User = BUYER, Opponent = SELLER

| Runde | VORHER | NACHHER |
|-------|--------|---------|
| 1 | BUYER (USER) ✅ | **BUYER (USER)** ✅ |
| 2 | SELLER (OPPONENT) | SELLER (OPPONENT) |
| 3 | BUYER (USER) ✅ | **BUYER (USER)** ✅ |
| 4 | SELLER (OPPONENT) | SELLER (OPPONENT) |
| 5 | BUYER (USER) ✅ | **BUYER (USER)** ✅ |
| 6 | SELLER (OPPONENT) | SELLER (OPPONENT) |

**Vorher:** USER startet, USER in Runden 1, 3, 5 (ungerade) ✅  
**Nachher:** USER startet, USER in Runden 1, 3, 5 (ungerade) ✅  
(Keine Änderung - war bereits korrekt!)

## 🔑 Key Points

1. **USER startet IMMER** in Runde 1 (eigene Company macht Eröffnungsangebot)
2. **Alternierung**: USER (ungerade Runden), OPPONENT (gerade Runden)
3. **Rollenunabhängig**: Funktioniert für USER=BUYER und USER=SELLER
4. **Konsistent**: USER spielt immer ungerade Runden (1, 3, 5, ...)

## 💡 Warum ist das wichtig?

### Business-Perspektive:
- ✅ **Kontrolle**: User hat die Initiative
- ✅ **Konsistenz**: Immer gleicher Ablauf für Training
- ✅ **Realismus**: In echten Verhandlungen startet oft der Verkäufer (aber auch Käufer möglich)

### Technische Perspektive:
- ✅ **Vorhersagbar**: User ist immer in ungeraden Runden
- ✅ **Testbar**: Klare Erwartungen für Tests
- ✅ **Logging**: Einfacher zu debuggen (USER = ungerade)

## 🐛 Debug-Tipps

### Log überprüfen:
```bash
grep "turn" stderr | head -10
```

**Erwartete Ausgabe:**
```
Round 1 - SELLER turn (USER)
Round 2 - BUYER turn (OPPONENT)
Round 3 - SELLER turn (USER)
Round 4 - BUYER turn (OPPONENT)
...
```

### Validierung:
```python
# In Tests
assert results[0]["agent"] == user_role  # Round 1 = USER
assert results[1]["agent"] == opponent_role  # Round 2 = OPPONENT
assert results[2]["agent"] == user_role  # Round 3 = USER
```

## ✅ Implementation

**Datei:** `scripts/run_production_negotiation.py`  
**Methode:** `_execute_negotiation_rounds()`  
**Zeilen:** ~1215-1222

```python
# Determine which agent's turn it is
# IMPORTANT: USER always starts the negotiation (round 1)
# Then alternates: opponent, user, opponent, ...
if round_num == 1:
    role = self.user_role  # User always starts
elif round_num % 2 == 1:
    role = self.user_role  # Odd rounds = user
else:
    role = self.opponent_role  # Even rounds = opponent
```

## 📈 Impact

- ✅ **Keine Breaking Changes**: Für User=BUYER war es bereits korrekt
- ✅ **Fix für User=SELLER**: Jetzt startet USER auch als SELLER
- ✅ **Konsistentes Verhalten**: Unabhängig von der Rolle

---

**Status:** ✅ IMPLEMENTIERT und GETESTET


