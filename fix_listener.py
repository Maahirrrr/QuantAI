import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target_pattern = r"document\.getElementById\('autoTradeBtn'\)\.addEventListener\('click', \(e\) => \{.*?(?=\n    document\.getElementById\('closeAllBtn'\))"

new_listener = '''document.getElementById('autoTradeBtn').addEventListener('click', (e) => {
        state.autoTradeActive = !state.autoTradeActive;
        const btn = e.currentTarget;
        if(state.autoTradeActive) {
            btn.innerText = 'AutoTrade: ON';
            btn.style.color = 'var(--accent-buy)';
            addLog('ACTION', 'Systematic Trading enabled.');
            hftInterval = setInterval(() => { executeHFTLogic(); }, 1000);
        } else {
            btn.innerText = 'AutoTrade: OFF';
            btn.style.color = 'var(--text-secondary)';
            clearInterval(hftInterval);
            addLog('ACTION', 'Systematic Algo disabled.');
        }
    });'''

code = re.sub(target_pattern, new_listener, code, flags=re.DOTALL)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
