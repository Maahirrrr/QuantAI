import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

new_chart = '''function initEquityChart() {
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
'''

code = re.sub(r'function initEquityChart\(\) \{.*?(?=\nasync function fetchFearAndGreed|\n\})', new_chart, code, flags=re.DOTALL)
# clean up any trailing brace if the regex missed it
code = re.sub(r'layout: \{ padding: 0 \}\n        \}\n    \}\);\n\}\n\}', r'layout: { padding: 0 }\n        }\n    });\n}\n', code)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
