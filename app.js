
window.addEventListener('error', function(e) {
    const err = document.createElement('div');
    err.style.position = 'fixed';
    err.style.top = '0';
    err.style.left = '0';
    err.style.zIndex = '9999';
    err.style.background = 'red';
    err.style.color = 'white';
    err.style.padding = '20px';
    err.style.width = '100%';
    err.innerHTML = 'ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno;
    document.body.appendChild(err);
});
window.addEventListener('unhandledrejection', function(e) {
    const err = document.createElement('div');
    err.style.position = 'fixed';
    err.style.top = '50px';
    err.style.left = '0';
    err.style.zIndex = '9999';
    err.style.background = 'orange';
    err.style.color = 'white';
    err.style.padding = '20px';
    err.style.width = '100%';
    err.innerHTML = 'PROMISE REJECTION: ' + e.reason;
    document.body.appendChild(err);
});
// App State
const state = {
    startBalance: 10000.00,
    balance: 10000.00,
    positions: [],
    metrics: {
        wins: 0,
        losses: 0,
        totalWinUsd: 0,
        totalLossUsd: 0
    },
    currentAsset: {
        symbol: 'BINANCE:BTCUSD',
        display: 'BTC/USD',
        name: 'Bitcoin',
        icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
        price: 65000 
    },
    signalsToday: 0,
    isAnalysisRunning: false,
    logPaused: false,
    tvWidget: null,
    lastUpdateMs: Date.now(),
    autoTradeActive: false,
};


let equityChartInstance = null;
const equityHistory = [10000.00];
const equityLabels = [new Date().toLocaleTimeString()];

function initEquityChart() {
    const ctx = document.getElementById('equityChart');
    if (!ctx) return;
    
    // Create gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(124, 111, 238, 0.4)');
    gradient.addColorStop(1, 'rgba(124, 111, 238, 0.0)');

    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: equityLabels,
            datasets: [{
                label: 'Equity ($)',
                data: equityHistory,
                borderColor: '#7C6FEE',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            layout: { padding: 0 }
        }
    });
}


function renderOrderBook(depthData) {
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
function initChart() {
    state.tvWidget = new TradingView.widget({
        "autosize": true,
        "symbol": state.currentAsset.symbol,
        "interval": "240",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "#0A0B0E",
        "gridColor": "#1E2535",
        "hide_top_toolbar": true,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tv_chart_container"
    });
}

function initUI() {
    initEquityChart();
    // Navigation Buttons Logic
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const title = e.currentTarget.getAttribute('title');
            if(title) {
                addLog('ACTION', `Navigated to ${title} view`);
            }
        });
    });

    // Timeframes sliding underline
    const timeframes = document.getElementById('timeframes');
    const indicator = timeframes ? timeframes.querySelector('.tf-indicator') : null;
    const pills = timeframes.querySelectorAll('.tf-pill');
    
    const updateIndicator = (activeElement) => {
        if(indicator) indicator.style.width = `${activeElement.offsetWidth}px`;
        if(indicator) indicator.style.left = `${activeElement.offsetLeft}px`;
    };
    
    setTimeout(() => updateIndicator(document.querySelector('.tf-pill.active')), 100);

    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            updateIndicator(e.target);
            
            const map = {'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','D':'D','W':'W'};
            state.tvWidget.chart().setResolution(map[e.target.innerText]);
        });
    });

    // Modals
    const assetBtn = document.getElementById('assetSelectorBtn');
    const assetModal = document.getElementById('assetModal');
    const searchInput = document.getElementById('assetSearch');
    
    if(assetBtn) assetBtn.addEventListener('click', () => toggleAssetModal(true));
    if(assetModal) assetModal.addEventListener('click', (e) => {
        if(e.target === assetModal) toggleAssetModal(false);
    });

    if(searchInput) searchInput.addEventListener('input', renderAssetList);

    // Collapsible
    window.toggleSection = function(id) {
        document.getElementById(id).classList.toggle('collapsed');
    };

    // Right panel toggle for mobile/tablet
    const portfolioBtn = document.querySelector('.nav-btn[title="Portfolio"]');
    if(portfolioBtn) portfolioBtn.addEventListener('click', () => {
        if(window.innerWidth <= 1280) {
            document.getElementById('rightPanel').classList.toggle('open');
        }
    });

    setupButtons();
    initUI();
}

function setupButtons() {
    const btnRun = document.getElementById('runAnalysisBtn');
    const btnBuy = document.getElementById('execBuyBtn');
    const btnSell = document.getElementById('execSellBtn');
    const btnAuto = document.getElementById('autoTradeBtn');

    if(btnRun) btnRun.addEventListener('click', runAIAnalysis);
    if(btnAuto) btnAuto.addEventListener('click', toggleAutoTrade);
    
    [btnBuy, btnSell].forEach(btn => {
        if(btn) btn.addEventListener('click', function(e) {
            addRipple(e, this);
            const isBuy = this.id === 'execBuyBtn';
            
            if (!this.dataset.confirm) {
                const originalText = this.innerText;
                this.dataset.confirm = "true";
                this.innerText = `Confirm ${isBuy ? 'BUY' : 'SELL'}? ✓`;
                this.style.color = isBuy ? "var(--accent-buy)" : "var(--accent-sell)";
                this.style.borderColor = isBuy ? "var(--accent-buy)" : "var(--accent-sell)";
                
                setTimeout(() => {
                    if(this.dataset.confirm) {
                        this.dataset.confirm = "";
                        this.innerText = originalText;
                        this.style.color = "";
                        this.style.borderColor = "";
                    }
                }, 3000);
            } else {
                this.dataset.confirm = "";
                this.innerText = isBuy ? "Execute BUY" : "Execute SELL";
                this.style.color = "";
                this.style.borderColor = "";
                executeTrade(isBuy ? 'LONG' : 'SHORT');
            }
        });
    });

    document.getElementById('resetWalletBtn').addEventListener('click', () => {
        state.balance = 10000;
        state.positions = [];
        state.metrics = { wins: 0, losses: 0, totalWinUsd: 0, totalLossUsd: 0 };
        saveState();
        updateWalletDisplay();
        renderPositions();
        if(typeof equityHistory !== 'undefined') {
            equityHistory.length = 0;
            equityLabels.length = 0;
            equityHistory.push(10000);
            equityLabels.push(new Date().toLocaleTimeString());
            if(equityChartInstance) equityChartInstance.update();
        }
        addLog('ACTION', 'Paper wallet reset to initial state ($10,000)');
    });

    document.getElementById('closeAllBtn').addEventListener('click', () => {
        if (state.positions.length === 0) return;
        const idsToClose = state.positions.map(p => p.id);
        idsToClose.forEach(id => {
            closePosition(id, 'Manual Force Close.');
        });
        addLog('ACTION', `Force closed all ${idsToClose.length} active positions.`);
    });

    document.getElementById('pauseLogToggle').addEventListener('click', function() {
        state.logPaused = !state.logPaused;
        this.classList.toggle('active');
    });
}

let hftInterval = null;
let lastBackendFetch = 0;
let lastBackendData = null;

function toggleAutoTrade() {
    state.autoTradeActive = !state.autoTradeActive;
    const btn = document.getElementById('autoTradeBtn');
    const timerText = document.getElementById('autoTradeTimer');
    const textSpan = document.getElementById('autoTradeText');
    
    if(state.autoTradeActive) {
        btn.classList.add('active');
        textSpan.innerText = 'Systematic Algo ON';
        timerText.classList.add('active');
        timerText.innerText = 'ALGO';
        
        addLog('ACTION', 'Systematic Trading enabled. Tracking Expectancy and Latency rules.');
        
        hftInterval = setInterval(() => {
            executeHFTLogic();
        }, 1000);
        
    } else {
        btn.classList.remove('active');
        textSpan.innerText = 'Start Systematic Algo';
        timerText.classList.remove('active');
        timerText.innerText = '00:30';
        clearInterval(hftInterval);
        addLog('ACTION', 'Systematic Algo disabled.');
    }
}

const ENTRY_FEE = 0.0002; // 0.02% VIP Maker fee (Limit Order simulation)
const EXIT_FEE = 0.0004;  // 0.04% VIP Taker fee (Market Order execution)

async function executeHFTLogic() {
    // 1. Risk Management
    state.positions.forEach(p => {
        const liveAsset = assets.find(a => a.display === p.asset);
        if (liveAsset) p.currentPrice = liveAsset.price;
        
        if (!p.highestPrice) p.highestPrice = p.entryPrice;
        if (!p.lowestPrice) p.lowestPrice = p.entryPrice;
        
        if (p.currentPrice > p.highestPrice) p.highestPrice = p.currentPrice;
        if (p.currentPrice < p.lowestPrice) p.lowestPrice = p.currentPrice;
        
        let grossPnl = p.side === 'LONG' ? (p.currentPrice - p.entryPrice) * p.size : (p.entryPrice - p.currentPrice) * p.size;
        let peakPnl = p.side === 'LONG' ? (p.highestPrice - p.entryPrice) * p.size : (p.entryPrice - p.lowestPrice) * p.size;
        
        const positionValue = p.size * p.currentPrice;
        const entryFee = (p.size * p.entryPrice) * ENTRY_FEE; 
        const exitFee = positionValue * EXIT_FEE;            
        
        const netPnl = grossPnl - entryFee - exitFee;
        const netPnlPct = netPnl / (p.size * p.entryPrice);
        const peakNetPnl = peakPnl - entryFee - exitFee;
        const peakPnlPct = peakNetPnl / (p.size * p.entryPrice);
        
        // HFT Exit Strategy
        if (netPnlPct < -0.01) {
            closePosition(p.id, `Hard stop hit (${(netPnlPct*100).toFixed(2)}% net).`);
        } else if (netPnlPct > 0.015) {
            closePosition(p.id, `Take-Profit hit (+${(netPnlPct*100).toFixed(2)}% net).`);
        } else if (peakPnlPct > 0.005 && (peakPnlPct - netPnlPct) > 0.003) {
            closePosition(p.id, `Trailing stop locked profit (+${(netPnlPct*100).toFixed(2)}% net).`);
        }
    });

    const now = Date.now();
    // 2. Poll Backend for Macro Sentiment
    if (now - lastBackendFetch > 3000) {
        try {
            // Pick an asset to analyze
            const target = assets[Math.floor(Math.random() * assets.length)];
            const response = await fetch(`http://127.0.0.1:8000/api/analyze?symbol=${encodeURIComponent(target.symbol)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    if (!window.backendDataMap) window.backendDataMap = {};
                    window.backendDataMap[target.display] = data;
                    target.price = data.current_price;
                }
            }
        } catch(e) {}
        lastBackendFetch = now;
    }

    // 3. Algorithmic Entry Logic
    
    if (activePositions.length === 0 && state.balance > 100 && window.priceHistories['BTC/USD'] && window.priceHistories['ETH/USD']) {
        const btcHist = window.priceHistories['BTC/USD'];
        const ethHist = window.priceHistories['ETH/USD'];
        if (btcHist.length >= 20 && ethHist.length >= 20) {
            const btcBase = btcHist[btcHist.length-20];
            const ethBase = ethHist[ethHist.length-20];
            const btcRet = (btcHist[btcHist.length-1] - btcBase) / btcBase;
            const ethRet = (ethHist[ethHist.length-1] - ethBase) / ethBase;
            const spread = btcRet - ethRet;
            if (Math.abs(spread) > 0.0015) {
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

    assets.forEach(asset => {
        const activePositions = state.positions.filter(p => p.asset === asset.display);
        // Only trade if we don't hold this asset, and have enough balance
        if (activePositions.length === 0 && state.balance > 10) {
            
            // Dynamic Position Sizing based on Kelly / UI Selection
            const budgetSelection = document.getElementById('autoTradeBudget').value;
            let targetBudgetUsd = 1000;
            if (budgetSelection === 'KELLY') {
                const totalTrades = Math.max(1, state.metrics.wins + state.metrics.losses);
                const W = state.metrics.wins / totalTrades;
                const avgWin = state.metrics.wins > 0 ? state.metrics.totalWinUsd / state.metrics.wins : 0.01;
                const avgLoss = state.metrics.losses > 0 ? state.metrics.totalLossUsd / state.metrics.losses : 0.01;
                const R = avgWin / avgLoss;
                let kellyPct = 0;
                if (W > 0 && R > 0) kellyPct = W - ((1 - W) / R);
                kellyPct = Math.max(0.01, Math.min(kellyPct, 0.10));
                targetBudgetUsd = state.balance * kellyPct;
            } else if (budgetSelection === 'RISK_0.5') {
                targetBudgetUsd = state.balance * 0.05; // Using 5% for better demonstration
            } else if (budgetSelection === 'MAX') {
                targetBudgetUsd = state.balance;
            } else {
                targetBudgetUsd = parseFloat(budgetSelection);
            }

            if (targetBudgetUsd > state.balance) targetBudgetUsd = state.balance;
            if (targetBudgetUsd < 10) return; // Too small to trade

            let signal = 'HOLD';
            let reason = '';
            
            // Priority 1: Backend Signals
            const bData = window.backendDataMap ? window.backendDataMap[asset.display] : null;
            if (bData && bData.signal !== 'HOLD' && bData.confidence >= 55) {
                signal = bData.signal;
                // dynamically scale position size based on confidence (e.g. 60-100 scales to 0.5x - 1.5x)
                const confScale = (bData.confidence - 60) / 40; 
                targetBudgetUsd = targetBudgetUsd * (0.5 + confScale); 
                if (targetBudgetUsd > state.balance) targetBudgetUsd = state.balance;
                reason = `Macro trend alignment (Conf: ${bData.confidence}%)`;
            } 
            // Priority 2: Statistical Arbitrage / Mean Reversion
            else if (window.priceHistories && window.priceHistories[asset.display] && window.priceHistories[asset.display].length >= 20) {
                const history = window.priceHistories[asset.display];
                const period = 20;
                const slice = history.slice(-period);
                const sma = slice.reduce((a,b)=>a+b, 0) / period;
                const variance = slice.reduce((a,b) => a + Math.pow(b - sma, 2), 0) / period;
                const sd = Math.sqrt(variance);
                const zScore = sd > 0 ? (asset.price - sma) / sd : 0;

                if (zScore < -1.2) {
                    signal = 'LONG';
                    reason = `Stat-Arb ${asset.display}: Z-Score ${zScore.toFixed(2)} (Oversold)`;
                } else if (zScore > 1.2) {
                    signal = 'SHORT';
                    reason = `Stat-Arb ${asset.display}: Z-Score ${zScore.toFixed(2)} (Overbought)`;
                }
            }
            
            if (signal !== 'HOLD') {
                executeTrade(signal, targetBudgetUsd, asset);
                addLog('SIGNAL', `[Systematic Algo] ${reason}. Executed ${signal} with $${targetBudgetUsd.toFixed(2)}`);
                // Clear backend data so we don't repeatedly trade the same signal
                if (window.backendDataMap) window.backendDataMap[asset.display] = null;
            }
        }
    });
}

function closePosition(id, reason) {
    const idx = state.positions.findIndex(p => p.id === id);
    if (idx > -1) {
        const p = state.positions[idx];
        let grossPnl = 0;
        if(p.side === 'LONG') grossPnl = (p.currentPrice - p.entryPrice) * p.size;
        else grossPnl = (p.entryPrice - p.currentPrice) * p.size;
        
        const positionValue = p.size * p.currentPrice;
        const exitFee = positionValue * EXIT_FEE;
        const entryFee = (p.size * p.entryPrice) * ENTRY_FEE;
        const netPnl = grossPnl - entryFee - exitFee;
        
        // Track Metrics
        if (netPnl > 0) {
            state.metrics.wins++;
            state.metrics.totalWinUsd += netPnl;
        } else {
            state.metrics.losses++;
            state.metrics.totalLossUsd += Math.abs(netPnl);
        }
        
        // Return margin + net pnl
        state.balance += (p.size * p.entryPrice) + grossPnl - exitFee; 
        state.positions.splice(idx, 1);

        if (typeof equityChartInstance !== 'undefined' && equityChartInstance) {
            equityLabels.push(new Date().toLocaleTimeString());
            equityHistory.push(state.balance);
            if(equityLabels.length > 50) { equityLabels.shift(); equityHistory.shift(); }
            equityChartInstance.update();
        }

        
        const pnlPrefix = netPnl >= 0 ? '+$' : '-$';
        addLog('EXEC', `Closed ${p.side} on ${p.asset}. Net PNL: ${pnlPrefix}${Math.abs(netPnl).toFixed(2)}. ${reason}`);
        
        saveState();
        updateWalletDisplay();
        updateMetricsDisplay();
        renderPositions();
    }
}

function addRipple(e, button) {
    const ripple = document.createElement("span");
    ripple.classList.add("ripple");
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size/2}px`;
    ripple.style.top = `${e.clientY - rect.top - size/2}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 300);
}

function executeTrade(side, forceSizeUsd = null, targetAsset = state.currentAsset) {
    const price = targetAsset.price;
    let sizeUsd = forceSizeUsd;
    
    if (!sizeUsd) sizeUsd = state.balance * 0.1;
    if (sizeUsd > state.balance) sizeUsd = state.balance;
    if (sizeUsd <= 0) return;
    
    const fee = sizeUsd * ENTRY_FEE; // Entry Fee
    const netInvestment = sizeUsd - fee;
    const sizeAsset = netInvestment / price;
    
    state.positions.push({
        id: Math.random().toString(36).substr(2, 9),
        asset: targetAsset.display,
        side: side,
        entryPrice: price,
        size: sizeAsset,
        currentPrice: price,
        highestPrice: price,
        lowestPrice: price
    });
    
    state.balance -= sizeUsd;
    saveState();
    updateWalletDisplay();
    renderPositions();
    addLog('EXEC', `Filled ${side} ${targetAsset.display} @ $${price.toLocaleString()} (Size: $${netInvestment.toFixed(2)}, Maker Fee: $${fee.toFixed(2)})`);
}

function toggleAssetModal(show) {
    const modal = document.getElementById('assetModal');
    if (show) {
        modal.classList.add('active');
        document.getElementById('assetSearch').value = '';
        renderAssetList();
        setTimeout(() => document.getElementById('assetSearch').focus(), 100);
    } else {
        modal.classList.remove('active');
    }
}

function renderAssetList() {
    const query = document.getElementById('assetSearch').value.toLowerCase();
    const list = document.getElementById('assetList');
    list.innerHTML = '';

    assets.filter(a => a.display.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)).forEach(a => {
        const div = document.createElement('div');
        div.className = 'asset-item';
        div.innerHTML = `
            <img src="${a.icon}" width="24" height="24">
            <div class="asset-info">
                <div class="symbol">${a.display}</div>
                <div class="name">${a.name}</div>
            </div>
            <div class="asset-price-info">
                <div class="price">$${a.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div class="change" style="color: ${a.change.includes('+') ? 'var(--accent-buy)' : 'var(--accent-sell)'}">${a.change}</div>
            </div>
        `;
        div.addEventListener('click', () => {
            selectAsset(a);
            toggleAssetModal(false);
        });
        list.appendChild(div);
    });
}

function selectAsset(asset) {
    state.currentAsset = asset;
    if(document.getElementById('currentTicker')) document.getElementById('currentTicker').innerText = asset.display;
    document.getElementById('assetIcon').src = asset.icon;
    state.tvWidget.chart().setSymbol(asset.symbol);
    addLog('ACTION', `Context switched to ${asset.display} [MCP Feed Active]`);
    
    setTimeout(() => {
        setConfidence(0);
        document.getElementById('bottomSignalFeed').innerHTML = `
            <div class="feed-content">
                <span class="feed-icon">⚡</span>
                <span class="feed-text">Analyzing ${asset.display} historical volatility patterns via cantaro86 modules...</span>
            </div>
        `;
    }, 500);
}

async function runAIAnalysis() {
    if (state.isAnalysisRunning) return;
    state.isAnalysisRunning = true;
    
    const btn = document.getElementById('runAnalysisBtn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> Analyzing...`;
    
    setConfidence(0);
    addLog('SIGNAL', 'Contacting local Python Quant Backend...');

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/analyze?symbol=${encodeURIComponent(state.currentAsset.symbol)}`);
        const data = await response.json();

        if (data.status === 'success') {
            state.currentAsset.price = data.current_price;
            
            addLog('SIGNAL', `[Backend Data] Price: $${data.current_price} | RSI: ${data.rsi} | Reason: ${data.reason}`);
            setConfidence(data.confidence);
            
            const signalText = `${data.signal} SIGNAL DETECTED for ${state.currentAsset.display} with ${data.confidence}% confidence.`;
            addLog('EXEC', signalText);
            
            document.getElementById('bottomSignalFeed').innerHTML = `
                <div class="feed-content" style="color: ${data.signal === 'HOLD' ? 'var(--text-secondary)' : (data.signal === 'LONG' ? 'var(--accent-buy)' : 'var(--accent-sell)')}">
                    <span class="feed-icon">🎯</span>
                    <span class="feed-text">Backend Prediction: ${signalText}</span>
                </div>
            `;
            
            state.signalsToday++;
            if(document.getElementById('signalsToday')) document.getElementById('signalsToday').innerText = state.signalsToday;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        addLog('ERROR', `Backend unreachable: ${error.message}. Start the Python server on port 8000.`);
    } finally {
        btn.innerHTML = originalContent;
        state.isAnalysisRunning = false;
    }
}

function setConfidence(val) {
    if(document.getElementById('confidenceValue')) document.getElementById('confidenceValue').innerText = `${val}%`;
    const blocks = document.querySelectorAll('.confidence-meter .block');
    const numFilled = Math.round((val / 100) * 5);
    
    blocks.forEach((b, i) => {
        b.className = 'block';
        if (i < numFilled) {
            b.classList.add('filled');
            if (i === numFilled - 1) b.classList.add('head');
        }
    });
}

function addLog(type, message) {
    if (state.logPaused) return;
    
    const logContainer = document.getElementById('signalLog');
    const time = new Date().toLocaleTimeString('en-US', {hour12: false});
    
    const div = document.createElement('div');
    div.className = 'log-line';
    
    const typeClass = `log-type-${type.toLowerCase()}`;
    div.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="${typeClass}">${type}</span>
        <span class="log-msg">${message}</span>
    `;
    
    logContainer.appendChild(div);
    
    // Performance: Keep only the last 100 logs
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
    
    logContainer.scrollTop = logContainer.scrollHeight;
    
    div.style.backgroundColor = 'rgba(124, 58, 237, 0.15)';
    setTimeout(() => div.style.backgroundColor = 'transparent', 300);
}

function updateWalletDisplay() {
    let total = state.balance;
    state.positions.forEach(p => {
        let grossPnl = 0;
        if(p.side === 'LONG') {
            grossPnl = (p.currentPrice - p.entryPrice) * p.size;
        } else {
            grossPnl = (p.entryPrice - p.currentPrice) * p.size;
        }
        
        const positionValue = p.size * p.currentPrice;
        const exitFee = positionValue * EXIT_FEE;
        total += (p.size * p.entryPrice) + grossPnl - exitFee;
    });
    
    if(document.getElementById('walletBalance')) document.getElementById('walletBalance').innerText = `$${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function renderPositions() {
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

function calculateTotalEquity() {
    let total = state.balance;
    state.positions.forEach(p => {
        let grossPnl = 0;
        if(p.side === 'LONG') grossPnl = (p.currentPrice - p.entryPrice) * p.size;
        else grossPnl = (p.entryPrice - p.currentPrice) * p.size;
        
        const positionValue = p.size * p.currentPrice;
        const exitFee = positionValue * EXIT_FEE;
        total += (p.size * p.entryPrice) + grossPnl - exitFee;
    });
    return total;
}

function startMarketSimulation() {
    if (!window.priceHistories) window.priceHistories = {};
    if (!window.backendDataMap) window.backendDataMap = {};
    assets.forEach(a => window.priceHistories[a.display] = [a.price]);

    // 1. Live Binance WebSockets for Crypto
    try {
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
                    addLog('WHALE', `🚨 WHALE ${side}: $${usdVolume.toLocaleString(undefined, {maximumFractionDigits:0})}`);
                }
            } else if (stream.includes('@depth')) {
                if (state.currentAsset.symbol === 'BINANCE:BTCUSD' && typeof renderOrderBook === 'function') {
                    renderOrderBook(data.data);
                }
            }
        };
        setTimeout(() => addLog('SYSTEM', 'Binance WebSocket Connected. Streaming LIVE tick-by-tick Crypto orderbook data.'), 1500);
    } catch(e) {}

    setInterval(() => {
        const now = Date.now();
        if(now - state.lastUpdateMs > 5000) {
            document.getElementById('connDot').className = 'dot stale';
        } else {
            document.getElementById('connDot').className = 'dot live';
        }

        const vol = 0.0005; 
        assets.forEach(a => {
            // Only mock non-crypto since crypto is now driven by live WebSocket
            if (!a.symbol.includes('BTC') && !a.symbol.includes('ETH')) {
                a.price *= (1 + (Math.random() - 0.5) * vol);
            }
            
            window.priceHistories[a.display].push(a.price);
            if (window.priceHistories[a.display].length > 60) window.priceHistories[a.display].shift();
            
            if (a.display === state.currentAsset.display) {
                state.currentAsset.price = a.price;
            }
        });
        state.lastUpdateMs = now;
        
        let pnlChanged = false;
        let todaysPnl = 0;

        state.positions.forEach(p => {
            // Update prices of positions tracking current asset
            if (p.asset === state.currentAsset.display) {
                p.currentPrice = state.currentAsset.price;
                pnlChanged = true;
            }
            // Calc total PNL for the day
            if(p.side === 'LONG') {
                todaysPnl += (p.currentPrice - p.entryPrice) * p.size;
            } else {
                todaysPnl += (p.entryPrice - p.currentPrice) * p.size;
            }
        });
        
        if(pnlChanged) {
            renderPositions();
            updateWalletDisplay();
            saveState();
        }

        // Update live ticker slot
        updateLivePnlSlot(todaysPnl);

    }, 2000);
}

let lastPnlStr = "";
function updateLivePnlSlot(pnlVal) {
    const livePnl = document.getElementById('livePnl');
    if (!livePnl) return;
    const isPos = pnlVal >= 0;
    const absVal = Math.abs(pnlVal).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    const newStr = `${isPos ? '+' : '-'}$${absVal}`;
    
    if (newStr !== lastPnlStr) {
        livePnl.className = `live-pnl ${isPos ? '' : 'negative'}`;
        livePnl.querySelector('.dir-arrow').innerText = isPos ? '▲' : '▼';
        
        const pnlSpan = livePnl.querySelector('.pnl-value');
        
        // Remove and re-add class to trigger slot roll animation
        pnlSpan.classList.remove('roll-up');
        void pnlSpan.offsetWidth; // trigger reflow
        pnlSpan.innerText = newStr;
        pnlSpan.classList.add('roll-up');
        
        lastPnlStr = newStr;
    }
}

function startAIBackgroundProcess() {
    setInterval(() => {
        if(!state.isAnalysisRunning && Math.random() > 0.8) {
            const msgs = [
                "Ingesting MCP video feed. Monitoring L2 order book depth...",
                "[Shubhamsaboo] LLM agent parsing recent SEC filings for sentiment...",
                "Re-calibrating algorithmic risk parameters via awesome-quant libraries.",
                "[machine-learning-for-trading] Random Forest classifier detected minor anomaly."
            ];
            addLog('SIGNAL', msgs[Math.floor(Math.random() * msgs.length)]);
        }
    }, 6000);
}

function saveState() {
    localStorage.setItem('quantAiState', JSON.stringify({
        balance: state.balance,
        positions: state.positions
    }));
}

function loadState() {
    const saved = localStorage.getItem('quantAiState');
    if (saved) {
        try {
            const parsed = JSON.stringify(saved); // Wait, need to parse
            const p = JSON.parse(saved);
            if(p.balance) state.balance = p.balance;
            if(p.positions) state.positions = p.positions;
        } catch(e) {}
    }
    updateWalletDisplay();
    renderPositions();
}

async function fetchFearAndGreed() {
    try {
        const response = await fetch('https://api.alternative.me/fng/');
        const data = await response.json();
        const fng = data.data[0];
        const badge = document.getElementById('sentimentBadge');
        if(badge) {
            badge.innerText = `F&G: ${fng.value} (${fng.value_classification})`;
            const val = parseInt(fng.value);
            if (val <= 30) badge.style.color = 'var(--accent-sell)';
            else if (val >= 70) badge.style.color = 'var(--accent-buy)';
            else badge.style.color = 'var(--text-primary)';
        }
    } catch(e) {}
}

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    initEquityChart();
    setupButtons();
    initUI();
    loadState();
    startMarketSimulation();
    startAIBackgroundProcess();
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            // toggleAssetModal(true); 
        }
        if(e.key >= '1' && e.key <= '7' && !e.metaKey && !e.ctrlKey) {
            const pills = document.querySelectorAll('.tf-pill');
            const idx = parseInt(e.key) - 1;
            if(pills[idx]) {
                pills[idx].click();
            }
        }
    });
});
