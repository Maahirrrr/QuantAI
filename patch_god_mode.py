import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add EquityChart logic at the top after State
equity_code = """
let equityChartInstance = null;
const equityHistory = [10000.00];
const equityLabels = [new Date().toLocaleTimeString()];

function initEquityChart() {
    const ctx = document.getElementById('equityChart');
    if (!ctx) return;
    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: equityLabels,
            datasets: [{
                label: 'Equity ($)',
                data: equityHistory,
                borderColor: '#7C3AED',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8b949e', callback: (v) => '$'+v }
                }
            }
        }
    });
}

function renderOrderBook(depthData) {
    const asksDiv = document.getElementById('ob-asks');
    const bidsDiv = document.getElementById('ob-bids');
    const spreadDiv = document.getElementById('ob-spread');
    if(!asksDiv || !bidsDiv) return;
    
    let htmlAsks = '';
    let maxAskVol = 0;
    depthData.asks.forEach(a => { maxAskVol = Math.max(maxAskVol, parseFloat(a[1])); });
    
    depthData.asks.slice(0, 8).reverse().forEach(ask => {
        const price = parseFloat(ask[0]).toFixed(2);
        const amt = parseFloat(ask[1]).toFixed(3);
        const width = (parseFloat(ask[1]) / maxAskVol) * 100;
        htmlAsks += `<div class="ob-row pnl-negative"><div class="ob-bg" style="width: ${width}%"></div><div class="ob-text"><span>${price}</span><span>${amt}</span></div></div>`;
    });
    
    let htmlBids = '';
    let maxBidVol = 0;
    depthData.bids.forEach(b => { maxBidVol = Math.max(maxBidVol, parseFloat(b[1])); });
    
    depthData.bids.slice(0, 8).forEach(bid => {
        const price = parseFloat(bid[0]).toFixed(2);
        const amt = parseFloat(bid[1]).toFixed(3);
        const width = (parseFloat(bid[1]) / maxBidVol) * 100;
        htmlBids += `<div class="ob-row pnl-positive"><div class="ob-bg" style="width: ${width}%"></div><div class="ob-text"><span>${price}</span><span>${amt}</span></div></div>`;
    });
    
    asksDiv.innerHTML = htmlAsks;
    bidsDiv.innerHTML = htmlBids;
    
    const bestAsk = parseFloat(depthData.asks[0][0]);
    const bestBid = parseFloat(depthData.bids[0][0]);
    spreadDiv.innerText = `Spread: $${(bestAsk - bestBid).toFixed(2)}`;
}
"""

if "initEquityChart()" not in code:
    code = code.replace("const priceHistory = [];", equity_code + "\nconst priceHistory = [];")

# 2. Add initEquityChart to initUI
if "initEquityChart();" not in code:
    code = code.replace("function initUI() {", "function initUI() {\n    initEquityChart();")

# 3. Add WebSockets to startMarketSimulation
ws_code = """    try {
        const ws = new WebSocket('wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/btcusdt@depth10@100ms');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const stream = data.stream;
            
            if (stream.includes('@trade')) {
                const price = parseFloat(data.data.p);
                const qty = parseFloat(data.data.q);
                const usdVolume = price * qty;
                
                if (stream === 'btcusdt@trade') {
                    const btc = assets.find(a => a.symbol === 'BINANCE:BTCUSD');
                    if (btc) btc.price = price;
                } else if (stream === 'ethusdt@trade') {
                    const eth = assets.find(a => a.symbol === 'BINANCE:ETHUSD');
                    if (eth) eth.price = price;
                }
                
                if (usdVolume > 200000) { 
                    const side = data.data.m ? 'SELL' : 'BUY';
                    addLog('WHALE', `🚨 WHALE ${side}: $${usdVolume.toLocaleString(undefined, {maximumFractionDigits:0})} on ${stream.split('@')[0].toUpperCase()}`);
                }
            } else if (stream.includes('@depth')) {
                if (state.currentAsset.symbol === 'BINANCE:BTCUSD') {
                    renderOrderBook(data.data);
                }
            }
        };
    } catch(e) {}
"""
if "wss://stream.binance.com" not in code:
    code = code.replace("assets.forEach(a => window.priceHistories[a.display] = [a.price]);", 
                        "assets.forEach(a => window.priceHistories[a.display] = [a.price]);\n" + ws_code)

# 4. Update closePosition to update Equity chart
equity_update = """
        if (typeof equityChartInstance !== 'undefined' && equityChartInstance) {
            equityLabels.push(new Date().toLocaleTimeString());
            equityHistory.push(state.balance);
            if(equityLabels.length > 50) { equityLabels.shift(); equityHistory.shift(); }
            equityChartInstance.update();
        }
"""
if "equityChartInstance.update()" not in code:
    code = code.replace("state.positions.splice(idx, 1);", "state.positions.splice(idx, 1);\n" + equity_update)


# 5. Add Pairs Trading logic
pairs_logic = """
    if (activePositions.length === 0 && state.balance > 100 && window.priceHistories['BTC/USD'] && window.priceHistories['ETH/USD']) {
        const btcHist = window.priceHistories['BTC/USD'];
        const ethHist = window.priceHistories['ETH/USD'];
        if (btcHist.length >= 20 && ethHist.length >= 20) {
            const btcBase = btcHist[btcHist.length-20];
            const ethBase = ethHist[ethHist.length-20];
            const btcRet = (btcHist[btcHist.length-1] - btcBase) / btcBase;
            const ethRet = (ethHist[ethHist.length-1] - ethBase) / ethBase;
            const spread = btcRet - ethRet;
            if (Math.abs(spread) > 0.005) {
                let hedgeSize = state.balance * 0.02;
                if (spread > 0) {
                    addLog('SYSTEM', `[Pairs Hedging] BTC/ETH Divergence (${(spread*100).toFixed(2)}%). Short BTC, Long ETH.`);
                    executeTrade('SHORT', hedgeSize, assets.find(a=>a.symbol==='BINANCE:BTCUSD'));
                    executeTrade('LONG', hedgeSize, assets.find(a=>a.symbol==='BINANCE:ETHUSD'));
                } else {
                    addLog('SYSTEM', `[Pairs Hedging] BTC/ETH Divergence (${(spread*100).toFixed(2)}%). Long BTC, Short ETH.`);
                    executeTrade('LONG', hedgeSize, assets.find(a=>a.symbol==='BINANCE:BTCUSD'));
                    executeTrade('SHORT', hedgeSize, assets.find(a=>a.symbol==='BINANCE:ETHUSD'));
                }
            }
        }
    }
"""

if "Pairs Hedging" not in code:
    code = code.replace("assets.forEach(asset => {", pairs_logic + "\n    assets.forEach(asset => {")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("success")
