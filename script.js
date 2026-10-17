const scanBtn = document.getElementById('scanBtn');
const tableBody = document.getElementById('tableBody');
const updateTimeSpan = document.getElementById('updateTime');

// List of top coins to scan
const coins = ['bitcoin', 'ethereum', 'binancecoin', 'ripple', 'solana', 'cardano', 'dogecoin', 'polkadot', 'matic-network', 'litecoin'];

async function fetchMarketData() {
    tableBody.innerHTML = `<tr><td colspan="5" class="loading">Fetching network data... Please wait.</td></tr>`;
    
    try {
        // Fetching prices and price change percentages across multiple timeframes from CoinGecko public API
        const url = `https://coingecko.com{coins.join(',')}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=1h,24h,7d`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Rate Limit or Network Error');
        
        const data = await response.json();
        renderTable(data);
        
        // Update Timestamp
        const now = new Date();
        updateTimeSpan.textContent = now.toLocaleTimeString() + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" class="error">⚠️ Failed to load data. The API might be busy. Please try again in a few seconds.</td></tr>`;
    }
}

function renderTable(cryptoData) {
    tableBody.innerHTML = '';
    
    if (cryptoData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="loading">No data found.</td></tr>`;
        return;
    }

    cryptoData.forEach(coin => {
        const price = coin.current_price ? `$${coin.current_price.toLocaleString()}` : 'N/A';
        
        // Extracting historical changes safely
        const p1h = coin.price_change_percentage_1h_in_currency;
        const p24h = coin.price_change_percentage_24h_in_currency;
        const p7d = coin.price_change_percentage_7d_in_currency;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="coin-cell">
                <img src="${coin.image}" alt="${coin.name}" class="coin-icon">
                <div>
                    <span class="coin-name">${coin.name}</span>
                    <span class="coin-symbol">${coin.symbol.toUpperCase()}</span>
                </div>
            </td>
            <td><strong>${price}</strong></td>
            <td class="${p1h >= 0 ? 'up' : 'down'}">${formatPercent(p1h)}</td>
            <td class="${p24h >= 0 ? 'up' : 'down'}">${formatPercent(p24h)}</td>
            <td class="${p7d >= 0 ? 'up' : 'down'}">${formatPercent(p7d)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function formatPercent(value) {
    if (value === undefined || value === null) return 'N/A';
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

// Event Listener for the action button
scanBtn.addEventListener('click', fetchMarketData);

// Initial execution on load
window.addEventListener('DOMContentLoaded', fetchMarketData);
