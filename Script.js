const COINS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

let audioCtx = null;
function playSignalSound(frequency, type, duration) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let oscillator = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log("Audio play blocked by browser window interaction policies.");
    }
}

function calculateRSI(closes, period = 14) {
    let changes = [];
    for(let i=1; i<closes.length; i++) changes.push(closes[i] - closes[i-1]);
    let gains = changes.map(c => c > 0 ? c : 0);
    let losses = changes.map(c => c < 0 ? -c : 0);
    let avgGain = gains.slice(0, period).reduce((a,b)=>a+b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a,b)=>a+b, 0) / period;
    
    for(let i=period; i<changes.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateBollingerBands(closes, period = 20, stdDevs = 2) {
    let slice = closes.slice(-period);
    let sum = slice.reduce((a, b) => a + b, 0);
    let mean = sum / period;
    let variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    let std = Math.sqrt(variance);
    return { upper: mean + (stdDevs * std), middle: mean, lower: mean - (stdDevs * std) };
}

function calculateEMA(closes, period = 200) {
    if (closes.length < period) return closes[closes.length - 1];
    let k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] * k) + (ema * (1 - k));
    }
    return ema;
}

async function fetchKlines(symbol, interval, limit = 250) {
    try {
        const response = await fetch(`https://binance.com{symbol}&interval=${interval}&limit=${limit}`);
        const data = await response.json();
        return data.map(candle => parseFloat(candle[4])); // Extract index 4 (Close price)
    } catch (error) {
        console.error(`Error fetching data for ${symbol} (${interval}):`, error);
        return null;
    }
}

function getPakistanTime() {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Karachi",
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }) + " PKT";
}

async function scanMarket() {
    const grid = document.getElementById('dashboard-grid');
    const statusText = document.getElementById('last-updated');
    if (!grid || !statusText) return;
    
    statusText.innerText = "Scanning active market pairs with filters...";
    grid.innerHTML = ''; 

    for (let coin of COINS) {
        const closes15m = await fetchKlines(coin, '15m', 250);
        const closes1h = await fetchKlines(coin, '1h', 250);
        const closes4h = await fetchKlines(coin, '4h', 50);

        if (!closes15m || !closes1h || !closes4h) continue;

        const currentPrice = closes15m[closes15m.length - 1];
        const rsi15m = calculateRSI(closes15m);
        const rsi1h = calculateRSI(closes1h);
        const rsi4h = calculateRSI(closes4h);
        const bb15m = calculateBollingerBands(closes15m);
        const ema200_1h = calculateEMA(closes1h, 200);

        let signal = 'Hold';
        let badgeClass = 'signal-hold';
        let macroTrendStatus = currentPrice > ema200_1h ? "Bullish (Above EMA 200)" : "Bearish (Below EMA 200)";

        let stopLoss = currentPrice * 0.98;
        let takeProfit = currentPrice * 1.04;

        if (rsi15m < 30 && rsi1h < 40 && currentPrice > ema200_1h) {
            signal = 'Buy';
            badgeClass = 'signal-buy';
            playSignalSound(880, 'sine', 0.4);
        } else if (rsi15m > 75 && currentPrice >= bb15m.upper && rsi1h > 70) {
            signal = 'Sell';
            badgeClass = 'signal-sell';
            playSignalSound(440, 'sawtooth', 0.6);
        }

        const card = document.createElement('div');
        card.className = 'coin-card';
        card.innerHTML = `
            <div class="coin-header">
                <div class="coin-name">${coin}</div>
                <div class="signal-badge ${badgeClass}">${signal}</div>
            </div>
            <div class="metric-row">
                <span class="metric-label">Live Price</span>
                <span class="metric-value" style="color: #f0f6fc;">$${currentPrice.toFixed(2)}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">1H Trend Filter</span>
                <span class="metric-value" style="color: ${currentPrice > ema200_1h ? '#238636' : '#da3633'}">${macroTrendStatus}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">RSI (15m / 1h / 4h)</span>
                <span class="metric-value">${rsi15m.toFixed(0)} / ${rsi1h.toFixed(0)} / ${rsi4h.toFixed(0)}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Upper BB (15m)</span>
                <span class="metric-value">$${bb15m.upper.toFixed(2)}</span>
            </div>
            <div class="metric-row" style="margin-top: 10px; border-top: 1px dashed #30363d; padding-top: 5px;">
                <span class="metric-label" style="color:#238636;">Target TP (+4%)</span>
                <span class="metric-value" style="color:#238636;">$${takeProfit.toFixed(2)}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label" style="color:#da3633;">Risk SL (-2%)</span>
                <span class="metric-value" style="color:#da3633;">$${stopLoss.toFixed(2)}</span>
            </div>
            <div class="timestamp-box">
                Checked at: ${getPakistanTime()}
            </div>
        `;
        grid.appendChild(card);
    }
    statusText.innerText = `Last complete network update: ${getPakistanTime()}`;
}

window.onclick = function() {
    if(!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio Engine Activated.");
    }
};

window.onload = scanMarket;
setInterval(scanMarket, 60000);
