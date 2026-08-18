with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    "const indicator = timeframes.querySelector('.tf-indicator');",
    "const indicator = timeframes ? timeframes.querySelector('.tf-indicator') : null;"
)

code = code.replace(
    "indicator.style.width =",
    "if(indicator) indicator.style.width ="
)

code = code.replace(
    "indicator.style.left =",
    "if(indicator) indicator.style.left ="
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
