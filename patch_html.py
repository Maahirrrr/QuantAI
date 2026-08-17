with open('index.html', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update AI Text
code = code.replace('Model: v2.4 | 5 Sources', 'GradientBoost ML + Weighted NLP')

# 2. Add Order Book next to Chart
target_chart = '            <div class="tv-embed-container" id="tv_chart_container"></div>'
new_chart = '''            <div style="display: flex; flex: 1; min-height: 0; overflow: hidden; gap: 1px;">
                <div class="tv-embed-container" id="tv_chart_container" style="flex: 1;"></div>
                <div class="order-book" style="width: 250px; background: var(--bg-surface); display: flex; flex-direction: column; border-left: 1px solid var(--border);">
                    <div class="section-header" style="padding: 8px 16px; border-bottom: 1px solid var(--border);">
                        <h3 style="font-size: 11px;">L2 Order Book</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; padding-bottom: 8px;">
                        <div id="ob-asks" style="display: flex; flex-direction: column-reverse; flex: 1; overflow: hidden; color: var(--accent-sell);"></div>
                        <div id="ob-spread" style="text-align: center; font-weight: bold; padding: 4px; font-size: 14px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">Spread</div>
                        <div id="ob-bids" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; color: var(--accent-buy);"></div>
                    </div>
                </div>
            </div>'''
code = code.replace(target_chart, new_chart)

# 3. Add Equity Curve below Positions
target_positions = '''                <div class="table-container">
                    <table class="pos-table">
                        <thead>
                            <tr>
                                <th>ASSET</th>
                                <th>SIDE</th>
                                <th>ENTRY</th>
                                <th>SIZE</th>
                                <th>PNL</th>
                            </tr>
                        </thead>
                        <tbody id="positionsBody">
                            <!-- Injected via JS -->
                        </tbody>
                    </table>
                </div>
            </section>'''
new_positions = target_positions + '''

            <!-- Equity Curve -->
            <section class="equity-curve" style="padding: 16px 0; border-bottom: 1px solid var(--border);">
                <div class="section-header">
                    <h3>Equity Curve</h3>
                </div>
                <div style="height: 150px; position: relative;">
                    <canvas id="equityChart"></canvas>
                </div>
            </section>'''
code = code.replace(target_positions, new_positions)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(code)
