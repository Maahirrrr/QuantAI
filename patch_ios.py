import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update initChart colors for iOS style
code = re.sub(
    r'"upColor":\s*"[^"]*"',
    '"upColor": "#00D4AA"',
    code
)
code = re.sub(
    r'"downColor":\s*"[^"]*"',
    '"downColor": "#FF4D6D"',
    code
)

# 2. Rewrite renderPositions for iOS card style
new_render_positions = '''function renderPositions() {
    const tbody = document.getElementById('positionsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let totalUnrealized = 0;
    
    if (state.positions.length === 0) {
        tbody.innerHTML = '<div class="empty-state"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5H5a2 2 0 0 1 0-4h16V7"/></svg>No open positions</div>';
    } else {
        state.positions.forEach(p => {
            const isLong = p.side === 'LONG';
            const diff = isLong ? p.currentPrice - p.entryPrice : p.entryPrice - p.currentPrice;
            const pnl = diff * p.size;
            totalUnrealized += pnl;
            
            const pnlColor = pnl >= 0 ? 'var(--accent-buy)' : 'var(--accent-sell)';
            const assetInfo = assets.find(a => a.display === p.asset) || {icon: '', display: p.asset};
            
            const div = document.createElement('div');
            div.className = `pos-row ${isLong ? 'long' : 'short'}`;
            div.innerHTML = `
                <div class="pos-asset">
                    <img src="${assetInfo.icon}" class="pos-icon">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span class="pos-name">${p.asset}</span>
                        <span class="pos-pill ${isLong ? 'long' : 'short'}">${p.side}</span>
                    </div>
                </div>
                <div class="pos-price">
                    $${p.entryPrice.toLocaleString(undefined, {maximumFractionDigits:2})}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    <span style="color:var(--text-primary);">$${p.currentPrice.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                </div>
                <div class="pos-pnl" style="color: ${pnlColor}">
                    ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                </div>
            `;
            tbody.appendChild(div);
        });
    }
    
    // Update daily pill (using unrealized PNL roughly as daily change)
    if(document.getElementById('dailyPill')) {
        const pill = document.getElementById('dailyPill');
        const pct = state.balance > 0 ? (totalUnrealized / state.balance) * 100 : 0;
        pill.className = `daily-pill ${pct >= 0 ? 'positive' : 'negative'}`;
        pill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${pct >= 0 ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'}"/></svg>
        <span>${Math.abs(pct).toFixed(2)}%</span>`;
    }
}
'''
code = re.sub(r'function renderPositions\(\) \{.*?(?=\nasync function executeHFTLogic|\nfunction calculateTotalEquity)', new_render_positions, code, flags=re.DOTALL)

# 3. Rewrite renderOrderBook for horizontal bars
new_order_book = '''function renderOrderBook(depthData) {
    const obBids = document.getElementById('obBids');
    const obAsks = document.getElementById('obAsks');
    const obSpread = document.getElementById('obSpread');
    if (!obBids || !obAsks || !obSpread) return;
    
    obBids.innerHTML = '';
    obAsks.innerHTML = '';
    
    const maxRows = 5;
    let maxVol = 0;
    
    for(let i = 0; i < maxRows; i++) {
        if(depthData.bids[i]) maxVol = Math.max(maxVol, parseFloat(depthData.bids[i][1]));
        if(depthData.asks[i]) maxVol = Math.max(maxVol, parseFloat(depthData.asks[i][1]));
    }
    
    for (let i = 0; i < maxRows; i++) {
        if (depthData.bids[i]) {
            const px = parseFloat(depthData.bids[i][0]).toFixed(1);
            const amt = parseFloat(depthData.bids[i][1]);
            const pct = (amt / maxVol) * 100;
            const div = document.createElement('div');
            div.className = 'hob-row';
            div.innerHTML = `<div class="hob-bar" style="width: ${pct}%"></div><div class="hob-val" style="color:var(--text-secondary)">${amt.toFixed(2)}</div><div class="hob-val" style="color:var(--accent-buy)">${px}</div>`;
            obBids.appendChild(div);
        }
        if (depthData.asks[i]) {
            const px = parseFloat(depthData.asks[i][0]).toFixed(1);
            const amt = parseFloat(depthData.asks[i][1]);
            const pct = (amt / maxVol) * 100;
            const div = document.createElement('div');
            div.className = 'hob-row';
            div.innerHTML = `<div class="hob-val" style="color:var(--accent-sell)">${px}</div><div class="hob-val" style="color:var(--text-secondary)">${amt.toFixed(2)}</div><div class="hob-bar" style="width: ${pct}%"></div>`;
            obAsks.appendChild(div);
        }
    }
    
    const bestAsk = parseFloat(depthData.asks[0][0]);
    const bestBid = parseFloat(depthData.bids[0][0]);
    const mid = (bestAsk + bestBid) / 2;
    obSpread.innerText = `$${mid.toFixed(1)}`;
    obSpread.classList.add('flash-update');
    setTimeout(() => obSpread.classList.remove('flash-update'), 300);
}
'''
code = re.sub(r'function renderOrderBook\(depthData\) \{.*?(?=function initChart)', new_order_book, code, flags=re.DOTALL)

# 4. Rewrite addLog for iOS cards
new_add_log = '''function addLog(type, msg) {
    if (state.logPaused) return;
    const logContainer = document.getElementById('signalLog');
    if (!logContainer) return;
    const div = document.createElement('div');
    div.className = 'signal-card';
    
    let color = 'var(--text-secondary)';
    if(type === 'SIGNAL') color = 'var(--accent-primary)';
    if(type === 'ACTION') color = 'var(--accent-signal)';
    if(type === 'EXEC') color = 'var(--accent-buy)';
    if(type === 'WHALE') color = 'var(--accent-sell)';
    if(type === 'ERROR') color = 'var(--accent-sell)';
    
    const time = new Date().toLocaleTimeString();
    
    div.innerHTML = `
        <div class="sig-header">
            <span class="sig-badge" style="color: ${color}; background: ${color}20">${type}</span>
            <span class="sig-time">${time}</span>
        </div>
        <div class="sig-msg">${msg}</div>
        <div class="sig-conf-bar"><div class="sig-conf-fill" style="width: ${type==='SIGNAL'? '100%' : '0%'}"></div></div>
    `;
    
    logContainer.prepend(div);
    if (logContainer.children.length > 50) {
        logContainer.lastChild.remove();
    }
    
    // Handle AI Overlay
    if(type === 'SIGNAL' && msg.includes('Reason:') && msg.includes('GradientBoost')) {
        const overlay = document.getElementById('aiOverlay');
        const overlayTitle = document.getElementById('overlayTitle');
        const overlayDesc = document.getElementById('overlayDesc');
        if(overlay) {
            overlayTitle.innerText = "AI INSIGHT";
            overlayDesc.innerText = msg;
            overlay.classList.add('active');
            setTimeout(() => { overlay.classList.remove('active'); }, 3000);
        }
    }
}
'''
code = re.sub(r'function addLog\(type, msg\) \{.*?(?=function renderPositions)', new_add_log, code, flags=re.DOTALL)

# 5. Connect toggle switch
code = code.replace("document.getElementById('pauseLogBtn').addEventListener('click'", "document.getElementById('pauseLogToggle').addEventListener('click'")
code = code.replace("this.innerText = state.logPaused ? \"▶ Resume\" : \"⏸ Pause\";", "this.classList.toggle('active');")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
