import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    "document.getElementById('currentTicker').innerText",
    "if(document.getElementById('currentTicker')) document.getElementById('currentTicker').innerText"
)
code = code.replace(
    "document.getElementById('confidenceValue').innerText",
    "if(document.getElementById('confidenceValue')) document.getElementById('confidenceValue').innerText"
)
code = code.replace(
    "document.getElementById('walletBalance').innerText",
    "if(document.getElementById('walletBalance')) document.getElementById('walletBalance').innerText"
)
code = code.replace(
    "document.getElementById('winRateDisplay').innerText",
    "if(document.getElementById('winRateDisplay')) document.getElementById('winRateDisplay').innerText"
)
code = code.replace(
    "document.getElementById('expectancyDisplay').innerText",
    "if(document.getElementById('expectancyDisplay')) document.getElementById('expectancyDisplay').innerText"
)
code = code.replace(
    "document.getElementById('drawdownDisplay').innerText",
    "if(document.getElementById('drawdownDisplay')) document.getElementById('drawdownDisplay').innerText"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
