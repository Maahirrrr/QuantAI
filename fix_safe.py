import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace all simple addEventListeners with optional chaining or if statements
code = code.replace("btnRun.addEventListener('click', runAIAnalysis);", "if(btnRun) btnRun.addEventListener('click', runAIAnalysis);")
code = code.replace("btnAuto.addEventListener('click', toggleAutoTrade);", "if(btnAuto) btnAuto.addEventListener('click', toggleAutoTrade);")
code = code.replace("assetBtn.addEventListener('click', () => toggleAssetModal(true));", "if(assetBtn) assetBtn.addEventListener('click', () => toggleAssetModal(true));")
code = code.replace("assetModal.addEventListener('click', (e) => {", "if(assetModal) assetModal.addEventListener('click', (e) => {")
code = code.replace("searchInput.addEventListener('input', renderAssetList);", "if(searchInput) searchInput.addEventListener('input', renderAssetList);")
code = code.replace("portfolioBtn.addEventListener('click', () => {", "if(portfolioBtn) portfolioBtn.addEventListener('click', () => {")

# Also for execBuyBtn and execSellBtn:
code = code.replace("btn.addEventListener('click', function(e) {", "if(btn) btn.addEventListener('click', function(e) {")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
