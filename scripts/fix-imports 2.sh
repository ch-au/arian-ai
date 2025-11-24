#!/bin/bash

# Fix server/storage.ts - remove legacy imports
sed -i '' '/negotiationRounds/d' server/storage.ts
sed -i '' '/roundStates/d' server/storage.ts
sed -i '' '/simulations,/d' server/storage.ts
sed -i '' '/productDimensionValues/d' server/storage.ts
sed -i '' '/offers,/d' server/storage.ts
sed -i '' '/events,/d' server/storage.ts
sed -i '' '/agentMetrics/d' server/storage.ts
sed -i '' '/interactions/d' server/storage.ts
sed -i '' '/analyticsSessions/d' server/storage.ts
sed -i '' '/performanceMetrics/d' server/storage.ts
sed -i '' '/policies/d' server/storage.ts

# Fix server/csv-import.ts
sed -i '' '/negotiationRounds/d' server/csv-import.ts

# Fix server/seed.ts
sed -i '' '/negotiationRounds/d' server/seed.ts

# Fix server/services/analytics.ts
sed -i '' '/PerformanceMetric/d' server/services/analytics.ts

echo "✓ Fixed import statements"
