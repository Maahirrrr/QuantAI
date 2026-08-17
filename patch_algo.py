with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

import re

# 1. Remove Latency Block that breaks the loop
code = re.sub(
    r'const currentLatencyMs = Math\.floor\(Math\.random\(\) \* 150\) \+ 10;.*?return;\s*\}',
    'const currentLatencyMs = Math.floor(Math.random() * 50) + 10; // High speed execution',
    code,
    flags=re.DOTALL
)

# 2. Aggressive Z-Score (from 2.0 to 1.2)
code = code.replace('zScore < -2.0', 'zScore < -1.2')
code = code.replace('zScore > 2.0', 'zScore > 1.2')

# 3. Lower ML Confidence (from 60 to 55)
code = code.replace("bData.confidence > 60", "bData.confidence >= 55")

# 4. Aggressive Pairs Hedging (from 0.005 to 0.001)
code = code.replace("Math.abs(spread) > 0.005", "Math.abs(spread) > 0.0015")

# 5. Fix Reset Wallet output
code = code.replace("Paper wallet reset to initial state (,000)", "Paper wallet reset to initial state ($10,000)")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
