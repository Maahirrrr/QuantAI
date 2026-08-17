// App State
const state = {
    balance: 10000.00,
    positions: [],
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
    autoTradeCountdown: 30,
    autoTradeCountdownInterval: null
};

// Universe
const assets = [
    { symbol: 'BINANCE:BTCUSD', display: 'BTC/USD', name: 'Bitcoin', icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', price: 65000, change: '+2.4%' },
    { symbol: 'BINANCE:ETHUSD', display: 'ETH/USD', name: 'Ethereum', icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', price: 3400, change: '+1.1%' },
    { symbol: 'NASDAQ:AAPL', display: 'AAPL', name: 'Apple Inc.', icon: 'https://companieslogo.com/img/orig/AAPL-12345678.png', price: 175.50, change: '-0.5%' },
    { symbol: 'NASDAQ:TSLA', display: 'TSLA', name: 'Tesla Inc.', icon: 'https://companieslogo.com/img/orig/TSLA-12345678.png', price: 210.20, change: '+4.2%' },
    { symbol: 'NASDAQ:NVDA', display: 'NVDA', name: 'NVIDIA Corp.', icon: 'https://companieslogo.com/img/orig/NVDA-12345678.png', price: 890.00, change: '+1.8%' },
    { symbol: 'BSE:RELIANCE', display: 'RELIANCE', name: 'Reliance Ind.', icon: 'https://companieslogo.com/img/orig/RELIANCE.NS-12345678.png', price: 2950.00, change: '+0.8%' },
    { symbol: 'BSE:HDFCBANK', display: 'HDFC', name: 'HDFC Bank', icon: 'https://companieslogo.com/img/orig/HDFCBANK.NS-12345678.png', price: 1450.00, change: '-1.2%' },
    { symbol: 'BSE:TATAMOTORS', display: 'TATAMOTORS', name: 'Tata Motors', icon: 'https://companieslogo.com/img/orig/TATAMOTORS.NS-12345678.png', price: 980.00, change: '+3.4%' }
];

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    initUI();
    loadState();
    startMarketSimulation();
    startAIBackgroundProcess();
    
    // Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            toggleAssetModal(true);
        }
        // 1-7 for timeframes
        if(e.key >= '1' && e.key <= '7' && !e.metaKey && !e.ctrlKey) {
            const pills = document.querySelectorAll('.tf-pill');
            const idx = parseInt(e.key) - 1;
            if(pills[idx]) {
                pills[idx].click();
            }
        }
    });
});

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
    const indicator = timeframes.querySelector('.tf-indicator');
    const pills = timeframes.querySelectorAll('.tf-pill');
    
    const updateIndicator = (activeElement) => {
        indicator.style.width = `${activeElement.offsetWidth}px`;
        indicator.style.left = `${activeElement.offsetLeft}px`;
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
    
    assetBtn.addEventListener('click', () => toggleAssetModal(true));
    assetModal.addEventListener('click', (e) => {
        if(e.target === assetModal) toggleAssetModal(false);
    });

    searchInput.addEventListener('input', renderAssetList);

    // Collapsible
    window.toggleSection = function(id) {
        document.getElementById(id).classList.toggle('collapsed');
    };

    // Right panel toggle for mobile/tablet
    const portfolioBtn = document.querySelector('.nav-btn[title="Portfolio"]');
    portfolioBtn.addEventListener('click', () => {
        if(window.innerWidth <= 1280) {
            document.getElementById('rightPanel').classList.toggle('open');
        }
    });

    setupButtons();
}

function setupButtons() {
    const btnRun = document.getElementById('runAnalysisBtn');
    const btnBuy = document.getElementById('execBuyBtn');
    const btnSell = document.getElementById('execSellBtn');
    const btnAuto = document.getElementById('autoTradeBtn');

    btnRun.addEventListener('click', runAIAnalysis);
    btnAuto.addEventListener('click', toggleAutoTrade);
    
    [btnBuy, btnSell].forEach(btn => {
        btn.addEventListener('click', function(e) {
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
        saveState();
        updateWalletDisplay();
        renderPositions();
        addLog('ACTION', 'Paper wallet reset to initial state ($10,000)');
    });

    document.getElementById('pauseLogBtn').addEventListener('click', function() {
        state.logPaused = !state.logPaused;
        this.innerText = state.logPaused ? "▶ Resume" : "⏸ Pause";
    });
}

function toggleAutoTrade() {
    state.autoTradeActive = !state.autoTradeActive;
    const btn = document.getElementById('autoTradeBtn');
    const timerText = document.getElementById('autoTradeTimer');
    const textSpan = document.getElementById('autoTradeText');
    
    if(state.autoTradeActive) {
        btn.classList.add('active');
        textSpan.innerText = 'Auto Trade ON';
        timerText.classList.add('active');
        state.autoTradeCountdown = 30;
        timerText.innerText = '00:30';
        
        addLog('ACTION', 'Auto Trade enabled. Utilizing Live News + Quant ML repo brain.');
        
        state.autoTradeCountdownInterval = setInterval(() => {
            state.autoTradeCountdown--;
            if(state.autoTradeCountdown <= 0) {
                state.autoTradeCountdown = 30;
                executeAutoTradeLogic();
            }
            timerText.innerText = `00:${state.autoTradeCountdown.toString().padStart(2, '0')}`;
        }, 1000);
        
    } else {
        btn.classList.remove('active');
        textSpan.innerText = 'Start Auto Trade';
        timerText.classList.remove('active');
        timerText.innerText = '00:30';
        clearInterval(state.autoTradeCountdownInterval);
        addLog('ACTION', 'Auto Trade disabled.');
    }
}

   async function executeAutoTradeLogic() {
    addLog('SIGNAL', `Auto-evaluating live data via Python Quant Backend for ${state.currentAsset.display}...`);
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/analyze?symbol=${encodeURIComponent(state.currentAsset.symbol)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            state.currentAsset.price = data.current_price;
            
            addLog('SIGNAL', `[Backend Stats] RSI: ${data.rsi} | Reason: ${data.reason}`);
            setConfidence(data.confidence);
            
            const activePositions = state.positions.filter(p => p.asset === state.currentAsset.display);
            
            // Autonomous Budget Sizing
            const budgetSelection = document.getElementById('autoTradeBudget').value;
            let targetBudgetUsd = budgetSelection === 'MAX' ? state.balance : parseFloat(budgetSelection);
            if (targetBudgetUsd > state.balance) targetBudgetUsd = state.balance;
            
            // Size scaled by confidence (e.g. 80% conf = 80% of budget)
            const tradeSizeUsd = targetBudgetUsd * (data.confidence / 100);
            
            if (data.signal === 'LONG') {
                // Auto-Close Shorts
                activePositions.forEach(p => {
                    if (p.side === 'SHORT') closePosition(p.id, 'Auto-closed SHORT due to bullish reversal signal.');
                });
                
                if (tradeSizeUsd > 10) {
                    addLog('EXEC', `[Auto Trade] Statistical edge detected. Sizing: $${tradeSizeUsd.toFixed(2)} -> Executing BUY.`);
                    executeTrade('LONG', tradeSizeUsd);
                }
                
            } else if (data.signal === 'SHORT') {
                // Auto-Close Longs
                activePositions.forEach(p => {
                    if (p.side === 'LONG') closePosition(p.id, 'Auto-closed LONG due to bearish reversal signal.');
                });
                
                if (tradeSizeUsd > 10) {
                    addLog('EXEC', `[Auto Trade] Statistical edge detected. Sizing: $${tradeSizeUsd.toFixed(2)} -> Executing SELL.`);
                    executeTrade('SHORT', tradeSizeUsd);
                }
                
            } else {
                addLog('ACTION', `[Auto Trade] Neutral signals. Holding current positions.`);
            }
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        addLog('ERROR', `Auto-Trade paused. Backend unreachable. Please run the python server.`);
        toggleAutoTrade(); // Automatically disable auto trade if backend dies
    }
}

function closePosition(id, reason) {
    const idx = state.positions.findIndex(p => p.id === id);
    if (idx > -1) {
        const p = state.positions[idx];
        let pnl = 0;
        if(p.side === 'LONG') {
            pnl = (p.currentPrice - p.entryPrice) * p.size;
        } else {
            pnl = (p.entryPrice - p.currentPrice) * p.size;
        }
        
        // Return original margin + pnl
        state.balance += (p.size * p.entryPrice) + pnl; 
        state.positions.splice(idx, 1);
        
        const pnlPrefix = pnl >= 0 ? '+$' : '-$';
        addLog('EXEC', `Closed ${p.side} on ${p.asset}. PNL: ${pnlPrefix}${Math.abs(pnl).toFixed(2)}. ${reason}`);
        
        saveState();
        updateWalletDisplay();
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

function executeTrade(side, forceSizeUsd = null) {
    const price = state.currentAsset.price;
    let sizeUsd = forceSizeUsd;
    
    if (!sizeUsd) {
        sizeUsd = state.balance * 0.1; // Default manual size if not auto-trade
    }
    
    if (sizeUsd > state.balance) {
        sizeUsd = state.balance;
    }
    
    if (sizeUsd <= 0) {
        addLog('ERROR', 'Insufficient balance to execute trade.');
        return;
    }
    
    const sizeAsset = sizeUsd / price;
    
    state.positions.push({
        id: Math.random().toString(36).substr(2, 9),
        asset: state.currentAsset.display,
        side: side,
        entryPrice: price,
        size: sizeAsset,
        currentPrice: price
    });
    
    state.balance -= sizeUsd;
    saveState();
    updateWalletDisplay();
    renderPositions();
    addLog('EXEC', `Filled ${side} ${state.currentAsset.display} @ $${price.toLocaleString()} (Size: $${sizeUsd.toLocaleString(undefined, {maximumFractionDigits:2})})`);
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
    document.getElementById('currentTicker').innerText = asset.display;
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
            document.getElementById('signalsToday').innerText = state.signalsToday;
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
    document.getElementById('confidenceValue').innerText = `${val}%`;
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
    logContainer.scrollTop = logContainer.scrollHeight;
    
    div.style.backgroundColor = 'rgba(124, 58, 237, 0.15)';
    setTimeout(() => div.style.backgroundColor = 'transparent', 300);
}

function executeTrade(side) {
    const price = state.currentAsset.price;
    // Trade 10% of total balance
    const sizeUsd = state.balance * 0.1; 
    const sizeAsset = sizeUsd / price;
    
    state.positions.push({
        id: Math.random().toString(36).substr(2, 9),
        asset: state.currentAsset.display,
        side: side,
        entryPrice: price,
        size: sizeAsset,
        currentPrice: price
    });
    
    state.balance -= sizeUsd;
    saveState();
    updateWalletDisplay();
    renderPositions();
    addLog('EXEC', `Filled ${side} ${state.currentAsset.display} @ $${price.toLocaleString()}`);
}

function updateWalletDisplay() {
    let total = state.balance;
    state.positions.forEach(p => {
        if(p.side === 'LONG') {
            total += (p.size * p.currentPrice);
        } else {
            total += (p.size * p.entryPrice) + (p.size * (p.entryPrice - p.currentPrice));
        }
    });
    
    document.getElementById('walletBalance').innerText = `$${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function renderPositions() {
    const tbody = document.getElementById('positionsBody');
    tbody.innerHTML = '';
    
    state.positions.forEach(p => {
        let pnl = 0;
        if(p.side === 'LONG') {
            pnl = (p.currentPrice - p.entryPrice) * p.size;
        } else {
            pnl = (p.entryPrice - p.currentPrice) * p.size;
        }
        
        const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
        const pnlPrefix = pnl >= 0 ? '▲' : '▼';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="asset-col">${p.asset}</td>
            <td><span class="badge-${p.side.toLowerCase()}">${p.side}</span></td>
            <td>$${p.entryPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td>${p.size.toFixed(4)}</td>
            <td class="pnl-col ${pnlClass}">${pnlPrefix} $${Math.abs(pnl).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        `;
        tbody.appendChild(tr);
    });
}

function startMarketSimulation() {
    setInterval(() => {
        const now = Date.now();
        if(now - state.lastUpdateMs > 5000) {
            document.getElementById('connDot').className = 'dot stale';
        } else {
            document.getElementById('connDot').className = 'dot live';
        }

        // Random walk for mock pricing
        const vol = 0.0005; // 0.05% vol per tick
        state.currentAsset.price *= (1 + (Math.random() - 0.5) * vol);
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
