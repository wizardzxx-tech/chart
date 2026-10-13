#!/usr/bin/env python3
"""Render ten reproducible English AI–LST figures with Matplotlib (no seaborn).
python generate_charts.py --out . --data data.json
Set LST_CHART_FONT to a local CJK .ttf/.ttc file if automatic discovery fails.
"""
from pathlib import Path
import argparse, json, os, math, warnings
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Rectangle, FancyArrowPatch, Ellipse
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
ROOT = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('--out', type=Path, default=ROOT)
ap.add_argument('--data', type=Path, default=ROOT / 'data.json')
ap.add_argument('--figures', default='1,2,3,4,5,6,7,8,9,10')

args = ap.parse_args()
D = json.loads(args.data.read_text())
OUT = args.out
[(OUT / x).mkdir(parents=True, exist_ok=True) for x in ['png', 'svg']]
font_paths = [os.environ.get('LST_CHART_FONT', ''), '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', '/Library/Fonts/Arial Unicode.ttf', '/System/Library/Fonts/STHeiti Medium.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc']
font_path = next((p for p in font_paths if p and Path(p).exists()), None)
if not font_path:
    found = [f.fname for f in font_manager.fontManager.ttflist if any((x in f.name for x in ['Noto Sans CJK', 'Microsoft YaHei', 'SimHei', 'PingFang', 'Arial Unicode']))]
    font_path = found[0] if found else None
if not font_path:
    raise RuntimeError('No suitable font found. Set LST_CHART_FONT to a local TTF file.')
font_manager.fontManager.addfont(font_path)
FN = font_manager.FontProperties(fname=font_path).get_name()
plt.rcParams.update({'font.family': FN, 'axes.unicode_minus': False, 'svg.fonttype': 'none', 'pdf.fonttype': 42, 'ps.fonttype': 42, 'font.size': 12, 'text.color': '#00355F', 'axes.edgecolor': '#A5A5A5', 'axes.labelcolor': '#00355F', 'xtick.color': '#00355F', 'ytick.color': '#00355F', 'axes.linewidth': 0.7, 'figure.facecolor': 'white', 'savefig.facecolor': 'white', 'svg.hashsalt': 'ai-lst-ten-figures-v1'})
INK = '#00355F'
MUTE = '#00355F'
BLUE = '#00355F'
TEAL = '#ACD4F1'
GOLD = '#A5A5A5'
GRAY = '#A5A5A5'
LIGHT = '#F4F9FD'
GRID = '#ACD4F1'
COLORS = [BLUE, TEAL, GOLD, '#7399C6', '#078549']
TITLES = ['The life science tools framework', '2025 LST under one F&S definition', 'Customer workflows across life science tools', 'AI discovery and its LST touchpoints', 'Which tools have more demand elasticity?', 'Quantities and prices in miniaturization', 'Funding-to-LST purchase sensitivity', 'Potential supply constraints over 12–24 months', 'Mapping Chinese listed LST suppliers', 'From AI funding to LST shareholder returns']
SLUGS = ['01_lst_framework', '02_china_global_market', '03_downstream_structure', '04_ai_workflow', '05_demand_elasticity', '06_miniaturization', '07_investment_scenarios', '08_supply_bottlenecks', '09_ashare_mapping', '10_investment_logic']
QA = []
MANIFEST = []

def txt(fig, x, y, s, size=12, color=INK, ha='left', va='center', bold=False, **kw):
    return fig.text(x, y, s, fontsize=size, color=color, ha=ha, va=va, fontweight='bold' if bold else 'normal', **kw)

def box(fig, x, y, w, h, color=LIGHT, edge=None):
    p = Rectangle((x, y), w, h, transform=fig.transFigure, facecolor=color, edgecolor=edge or color, lw=0.7, zorder=0)
    fig.add_artist(p)
    return p

def arrow(fig, a, b, color='#7399C6', lw=1.3, style='-|>', rad=0):
    fig.add_artist(FancyArrowPatch(a, b, transform=fig.transFigure, arrowstyle=style, mutation_scale=14, lw=lw, color=color, connectionstyle=f'arc3,rad={rad}', zorder=1))

def canvas(i, badge, sub, note, source):
    f = plt.figure(figsize=(16, 9), dpi=100)
    txt(f, 0.055, 0.925, f'{i:02d}  {TITLES[i - 1]}', size=22, bold=True)
    box(f, 0.83, 0.899, 0.115, 0.043)
    txt(f, 0.8875, 0.921, badge, size=9.5, color=MUTE, ha='center')
    txt(f, 0.055, 0.86, sub, size=12, color=MUTE)
    f.add_artist(plt.Line2D([0.055, 0.945], [0.815, 0.815], transform=f.transFigure, color=GRID, lw=0.8))
    txt(f, 0.055, 0.084, note, size=10.5, color=MUTE)
    txt(f, 0.055, 0.046, source, size=8.7, color=MUTE)
    txt(f, 0.945, 0.046, D['date'], size=9.2, color=MUTE, ha='right')
    return f

def style(ax):
    ax.set_axisbelow(True)
    ax.spines[['top', 'right']].set_visible(False)
    ax.tick_params(length=0, pad=10)
    ax.yaxis.grid(True, color=GRID, lw=0.7)
    return ax

def quadrant(f, xlabel, ylabel, position=(0.08, 0.235, 0.76, 0.535)):
    ax = f.add_axes(position)
    style(ax)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_xticks([1, 5, 9], ['Low', 'Medium', 'High'])
    ax.set_yticks([1, 5, 9], ['Low', 'Medium', 'High'])
    ax.grid(False)
    ax.axvline(5, color=GRID, lw=0.8, ls=(0, (4, 4)))
    ax.axhline(5, color=GRID, lw=0.8, ls=(0, (4, 4)))
    ax.set_xlabel(xlabel, fontsize=12, labelpad=12)
    ax.set_ylabel(ylabel, fontsize=12, labelpad=10)
    return ax

def label_point(ax, p, color=BLUE, fontsize=10.5):
    ax.annotate(p['name'], xy=(p['x'], p['y']), xytext=p['label'], textcoords='data', fontsize=fontsize, color=INK, ha='right' if p['label'][0] >= 8.4 else 'left', va='center', bbox={'fc': 'white', 'ec': 'none', 'pad': 1.6, 'alpha': 0.95}, arrowprops={'arrowstyle': '-', 'color': color, 'lw': 0.7, 'shrinkA': 4, 'shrinkB': 6}, zorder=4)

def fig1():
    f = canvas(1, 'FRAMEWORK', 'A product framework spanning academic research, biotech, pharma, CRDMOs and manufacturing.', 'Classify products separately from their use cases. Chromatography resins can be reused.', 'Source: supplied framework and prior product research. Existing TAMs do not automatically reconcile.')
    for j, c in enumerate(D['framework']):
        x = 0.055 + j * 0.304
        w = 0.281
        box(f, x, 0.222, w, 0.548, '#F4F9FD')
        box(f, x, 0.683, w, 0.086, c['color'])
        txt(f, x + 0.022, 0.731, c['name'], size=22, color='white', bold=True)
        txt(f, x + w - 0.022, 0.727, '', size=12, color='white', ha='right')
        for k, it in enumerate(c['items']):
            y = 0.629 - k * 0.07
            txt(f, x + 0.022, y, f'{k + 1:02d}', size=10.5, color=c['color'])
            txt(f, x + 0.056, y, it, size=12)
        f.add_artist(plt.Line2D([x + 0.022, x + w - 0.022], [0.295, 0.295], transform=f.transFigure, color=GRID, lw=0.8))
        txt(f, x + 0.022, 0.26, c['driver'], size=10.8, color=MUTE)
    txt(f, 0.5, 0.159, 'Use one product taxonomy; retain the scope of each market estimate.', size=15, ha='center', bold=True)
    return f

def fig2():
    m = D['market']
    f = canvas(2, 'HISTORICAL', '2025 F&S estimates commissioned for ACRO’s filing. A defined scope, not a broad-industry TAM.', 'Other tools are the residual. Comparable instrument and consumable splits were not separately available.', 'Source: ACROBiosystems HKEX application, 30 Sep 2026, printed pp. 65 and 67; links in SOURCES.md.')
    ax = style(f.add_axes([0.1, 0.235, 0.54, 0.525]))
    tot = np.array([m['total_global'], m['total_china']])
    ruo = np.array([m['ruo_global'], m['ruo_china']])
    other = tot - ruo
    xs = [0, 1]
    ax.bar(xs, ruo, width=0.42, color=BLUE, label='Research biological reagents')
    ax.bar(xs, other, bottom=ruo, width=0.42, color=GRAY, label='Other tools: instruments + consumables')
    ax.set_ylim(0, 46)
    ax.set_xlim(-0.6, 1.6)
    ax.set_xticks(xs, ['Global LST', 'China LST'], fontsize=14)
    ax.set_ylabel('US$bn', fontsize=12)
    for j in xs:
        ax.text(j, ruo[j] / 2, f'{ruo[j]:.1f}', ha='center', va='center', color='white', fontsize=17, fontweight='bold')
        ax.text(j, ruo[j] + other[j] / 2, f'{other[j]:.1f}', ha='center', va='center', color=INK, fontsize=15)
        ax.text(j, tot[j] + 1, f'{tot[j]:.1f}', ha='center', va='bottom', color=INK, fontsize=20, fontweight='bold')
    ax.legend(loc='upper left', frameon=False, fontsize=10.5, bbox_to_anchor=(0, 1.08), ncol=2)
    box(f, 0.697, 0.454, 0.235, 0.272)
    txt(f, 0.72, 0.671, 'China share within F&S scope', size=13, color=MUTE)
    txt(f, 0.72, 0.587, f"{m['total_china'] / m['total_global']:.1%}", size=37, color=BLUE, bold=True)
    txt(f, 0.72, 0.497, '7.7 / 41.5\nNot vendor revenue exposure', size=12, color=MUTE)
    txt(f, 0.705, 0.336, 'Issuer-commissioned estimate.\nBroader markets and vendor\nChina revenues use other scopes.', size=12, color=MUTE)
    return f

def fig3():
    f = canvas(3, 'USE MAP', 'A qualitative workflow map. Customer purchasing shares have not been established.', 'Food, environmental and chemical-analysis uses excluded. Research instruments exclude clinical IVD analyzers.', 'Source: representative supplier product uses; a role map, not an estimated customer revenue mix.')
    widths = [0.212, 0.218, 0.218, 0.244]
    xs = [0.055, 0.267, 0.485, 0.703]
    heads = ['CUSTOMER', 'REAGENTS', 'CONSUMABLES', 'INSTRUMENTS']
    for j in range(4):
        box(f, xs[j], 0.685, widths[j], 0.064, BLUE)
        txt(f, xs[j]+0.014, 0.716, heads[j], size=13, bold=True, color='white')
    for r, row in enumerate(D['downstream']['rows']):
        y = 0.585 - r*0.088
        for j, value in enumerate(row):
            box(f, xs[j], y, widths[j], 0.085, LIGHT if r%2==0 else 'white')
            txt(f, xs[j]+0.014, y+0.043, value, size=12 if j else 12.5, bold=j==0, linespacing=1.35)
    txt(f, 0.5, 0.166, 'An instrument supplier’s total China sales are not its China life-science sales.', size=16, ha='center', bold=True)
    return f

def fig4():
    f = canvas(4, 'MECHANISM', 'AI candidates need physical construction and experimental feedback. Orders depend on funded projects.', 'Stages 2–3 have more direct exposure. Clinical and manufacturing demand face attrition and time lags.', 'Source: supplied framework and product-use research. Arrows describe a mechanism, not realized orders.')
    for j, s in enumerate(D['workflow']):
        x = 0.045 + j * 0.154
        w = 0.141
        c = TEAL if j in [2, 3] else BLUE
        box(f, x, 0.59, w, 0.148, c if j in [2, 3] else LIGHT)
        txt(f, x + 0.013, 0.7, s['stage'], size=10.2, color='white' if j in [2, 3] else MUTE)
        txt(f, x + w / 2, 0.644, s['name'].replace('Manufacturing\n(if successful)', 'Manufacturing\n(if successful)'), size=14, color='white' if j in [2, 3] else INK, ha='center', bold=True)
        box(f, x, 0.337, w, 0.224, '#F4F9FD')
        txt(f, x + 0.01, 0.444, '\n'.join(s['items']), size=10.8, linespacing=2.1)
        txt(f, x + w / 2, 0.305, s['cue'], size=9.5, color=MUTE, ha='center')
        if j < 5:
            arrow(f, (x + w + 0.002, 0.65), (x + 0.154 - 0.003, 0.65))
    arrow(f, (0.575, 0.751), (0.269, 0.751), rad=0.1, color=TEAL, lw=1.1)
    txt(f, 0.41, 0.785, 'Experimental feedback → next design cycle', size=10.5, color=TEAL, ha='center')
    txt(f, 0.5, 0.177, 'The most direct potential uplift comes from building and testing candidates.', size=15, ha='center', bold=True)
    return f

def fig5():
    f = canvas(5, 'HYPOTHESIS', 'Positions and bubble areas are qualitative research judgments, not measured scores or additive TAMs.', 'Small-molecule synthesis can fall per project. Modality, assay depth, unit use and funded projects determine orders.', 'Source: supplied framework and analyst assumptions. Edit positions and relative areas in data.json.')
    ax = quadrant(f, 'Experimental necessity →', 'Revenue elasticity to experiment volume →')
    ax.add_patch(Rectangle((5, 5), 5, 5, fc='#F4F9FD', ec='none', zorder=0))
    ax.text(0.4, 9.55, 'Project expansion and substitution both matter', fontsize=10.3, color=MUTE)
    for p in D['elasticity']:
        color = TEAL if p['y'] >= 7.8 else BLUE
        ax.scatter(p['x'], p['y'], s=p['area'] * 2.5, color=color, alpha=0.24, edgecolors=color, lw=1.2, zorder=3)
        label_point(ax, p, color)
    txt(f, 0.865, 0.665, 'Bubble area', size=11, color=MUTE)
    txt(f, 0.865, 0.594, 'Relative opportunity\nillustration; not\nmeasured TAM', size=10.7, color=MUTE, linespacing=1.7)
    txt(f, 0.865, 0.352, 'Potential elasticity\nneeds paid demand\nand repeat orders', size=10.7, color=TEAL, linespacing=1.7)
    return f

def fig6():
    s = D['miniaturization']; t=s['traditional']; a=s['automated']
    pt=math.ceil(t['experiments']/t['wells']); pa=math.ceil(a['experiments']/a['wells'])
    vr=(a['experiments']*a['volume_ul'])/(t['experiments']*t['volume_ul']); pr=pa/pt
    tr=(a['experiments']*a['tips_per_experiment'])/(t['experiments']*t['tips_per_experiment'])
    f=canvas(6, 'SENSITIVITY', '10× tests: 10 L → 5 L reagent; 1,042 → 652 plates; 100k → 100k tips. Full usable plates.', 'Price ratios are analyst inputs, not quoted ASPs. Dead volume, controls, usable wells and retesting can change quantities.', 'Source: transparent arithmetic from supplied test volumes and well counts. Units and sensitivities in SOURCES.md.')
    ax=style(f.add_axes([0.09,0.27,0.37,0.39])); bx=style(f.add_axes([0.57,0.27,0.34,0.39])); x=np.arange(3)
    ax.bar(x-.17,[100]*3,width=.32,color=GRAY,label='Baseline = 100')
    ax.bar(x+.17,[100*vr,100*pr,100*tr],width=.32,color=TEAL,label='10× tests')
    ax.set_xticks(x,['Reagent volume','Plate count','Tip count']);ax.set_ylim(0,150);ax.set_ylabel('Quantity index');ax.set_title('Physical inputs',fontsize=17,pad=14);ax.legend(frameon=False,fontsize=10,loc='upper right')
    for j,v in enumerate([vr,pr,tr]):ax.text(j+.17,100*v+4,f'{100*v:.1f}',ha='center',fontsize=15,color=INK)
    prices=s['plate_price_ratios'];spend=[100*pr*q for q in prices]
    bx.bar(x,spend,width=.5,color=[TEAL,BLUE,'#7399C6']);bx.axhline(100,color=GRAY,lw=1,ls='--');bx.set_xticks(x,[f'{q}× plate ASP' for q in prices]);bx.set_ylim(0,290);bx.set_ylabel('Plate spend index');bx.set_title('Fewer plates can cost more',fontsize=17,pad=14)
    for j,v in enumerate(spend):bx.text(j,v+6,f'{v:.1f}',ha='center',fontsize=17,color=INK,fontweight='bold')
    txt(f,.5,.743,'Quantities × net unit prices determine spending',size=18,ha='center',bold=True)
    txt(f,.5,.164,f'Plate spending exceeds baseline if the plate ASP ratio is above {pt/pa:.2f}×.',size=17,ha='center',bold=True)
    QA.append({'figure':6,'tests':a['experiments']/t['experiments'],'plates_before':pt,'plates_after':pa,'volume_ratio':vr,'plate_ratio':pr,'tip_ratio':tr,'plate_price_breakeven':pt/pa,'spend_at_ASP_ratios':dict(zip(prices,spend))})
    return f

def fig7():
    s=D['investment']; pools=np.array(s['scenarios']); rates=s['capture_rates']; x=np.arange(3)
    f=canvas(7,'SENSITIVITY','Hypothetical total funding pools. Only a fraction becomes purchases from LST suppliers.', '5% / 10% / 20% capture rates are model inputs. Cumulative scenarios, no fixed horizon; not observed funding or annual TAM.', 'Source: analyst funding-to-purchase sensitivity. No empirical budget shares or equipment/reagent split is asserted.')
    ax=style(f.add_axes([.09,.25,.57,.49]))
    for j,(rate,col) in enumerate(zip(rates,[TEAL,BLUE,'#7399C6'])):
        vals=pools*rate;xx=x+(j-1)*.23;ax.bar(xx,vals,width=.21,color=col,label=f'{rate:.0%} LST purchase capture')
        for xi,v in zip(xx,vals):ax.text(xi,v+.6,f'{v:g}',ha='center',fontsize=13,color=INK)
    ax.set_xticks(x,[f'US${p:g}bn total funding' for p in pools],fontsize=11);ax.set_ylim(0,46);ax.set_ylabel('Cumulative LST purchases (US$bn)');ax.legend(frameon=False,fontsize=10.3,loc='upper left')
    box(f,.705,.30,.24,.435)
    txt(f,.722,.679,'Funding → tool purchases',size=15,bold=True)
    txt(f,.722,.598,'R&D and production budgets\nexclude people, trials,\nsoftware and unspent cash.',size=12,linespacing=1.8)
    txt(f,.722,.459,'Capture includes tool purchases\nonly. Count CRO/CDMO inputs\nonce, separate from service fees.',size=11.5,linespacing=1.8)
    txt(f,.5,.167,'Total capital raised is not an addressable tool market.',size=18,ha='center',bold=True)
    QA.append({'figure':7,'funding_pools':pools.tolist(),'capture_rates':rates,'tool_purchases':[[float(p*r) for r in rates] for p in pools]})
    return f

def fig8():
    f = canvas(8, 'HYPOTHESIS', 'Relative expansion and qualification constraints over 12–24 months; current shortages are not established.', 'Track lead times, stockouts, qualification, yields and prices. Manufacturing resins have a longer demand lag.', 'Source: supplied framework and analyst hypotheses. Technical barriers do not prove a capacity bottleneck.')
    ax = quadrant(f, 'Expansion difficulty / qualification time →', 'Potential benefit from demand expansion →')
    ax.add_patch(Rectangle((5, 5), 5, 5, fc='#F4F9FD', ec='none', zorder=0))
    ax.text(0.4, 9.55, 'Verify demand and supply constraints together', fontsize=10.3, color=MUTE)
    for p in D['bottlenecks']:
        color = TEAL if p['y'] >= 7 else BLUE
        ax.scatter(p['x'], p['y'], s=155, color=color, alpha=0.75, marker='D', edgecolors='white', lw=0.7, zorder=3)
        label_point(ax, p, color, fontsize=10.2)
    txt(f, 0.865, 0.663, 'Potential opportunity', size=12, color=TEAL, bold=True)
    txt(f, 0.865, 0.52, 'Strong demand\nSlow expansion\nSlow qualification\nAll need evidence', size=11, color=MUTE, linespacing=1.7)
    txt(f, 0.865, 0.313, 'Check inventories,\norders and\nlead times', size=10.8, color=MUTE, linespacing=1.7)
    return f

def fig9():
    f = canvas(9, 'HYPOTHESIS', 'Product exposure to AI build-and-test stages; positions do not measure AI revenue share or investment rank.', 'Axes are qualitative judgments. Qualification, global customer access and paid orders still require evidence.', 'Sources: company filings and official product catalogs. Product rationale and assumptions are in data.json.')
    ax = quadrant(f, 'Direct exposure to AI build-and-test demand →', 'Supply barriers / global customer access →', (0.085, 0.235, 0.585, 0.535))
    ax.add_patch(Rectangle((5, 5), 5, 5, fc='#F4F9FD', ec='none', zorder=0))
    markers = {'Reagents': 'o', 'Consumables': 's', 'Instruments / platforms': '^'}
    colors = {'Reagents': BLUE, 'Consumables': TEAL, 'Instruments / platforms': GOLD}
    for p in D['companies']:
        c = colors[p['group']]
        ax.scatter(p['x'], p['y'], s=160 if p['name'] in ['ACROBiosystems', 'NanoMicro'] else 110, c=c, marker=markers[p['group']], edgecolors='white', lw=0.7, zorder=3)
        label_point(ax, p, c, fontsize=10.5)
        if p['name'] in ['ACROBiosystems', 'NanoMicro']:
            ax.scatter(p['x'], p['y'], s=350, facecolors='none', edgecolors=GOLD, lw=1.2, zorder=2)
    for i, (group, c) in enumerate(colors.items()):
        y = 0.733 - i * 0.105
        txt(f, 0.725, y, group, size=13, color=c, bold=True)
        content = {'Reagents': 'Proteins, enzymes, blocks, media', 'Consumables': 'Labware, columns, resins', 'Instruments / platforms': 'Sequencing and automation'}[group]
        txt(f, 0.725, y - 0.042, content, size=10.5, color=MUTE)
    box(f, 0.712, 0.272, 0.232, 0.142)
    txt(f, 0.73, 0.375, 'Two different demand pathways', size=12, bold=True)
    txt(f, 0.73, 0.325, 'ACRO: expression / functional assays\nNanoMicro: purification + scale-up', size=10.7, color=MUTE, linespacing=1.8)
    return f

def fig10():
    f = canvas(10, 'THESIS', 'Funding starts the chain. Projects, consumption, supply, market share and cash returns determine the outcome.', 'Seek experimental relevance, evidenced supply constraints and global access; test the valuation hurdle.', 'Source: supplied framework and prior company research. Capital announcements are not LST orders.')
    nodes = [('AI funding grows', 'Cash reaches customers'), ('Lab automation', 'Equipment installed'), ('Build-and-test volume', 'More funded projects'), ('Net LST demand', 'Intensity + ASP adjusted')]
    for j, (name, cue) in enumerate(nodes):
        x = 0.05 + j * 0.167
        w = 0.145
        box(f, x, 0.57, w, 0.177, BLUE if j == 3 else LIGHT)
        txt(f, x + w / 2, 0.691, name, size=13.5, color='white' if j == 3 else INK, ha='center', bold=True)
        txt(f, x + w / 2, 0.619, cue, size=10.6, color='white' if j == 3 else MUTE, ha='center')
        if j < 3:
            arrow(f, (x + w + 0.004, 0.663), (x + 0.167 - 0.005, 0.663))
    branches = [('Direct demand', 'Assays, automation labware\nand chemical building blocks', TEAL, 0.64), ('Supply constraints', 'Specialty plates / components\nExpansion limits need evidence', BLUE, 0.44), ('Listed candidates', 'ACRO, Vazyme, Sino, NanoMicro\nJET, Changhong and others', GOLD, 0.24)]
    for title, desc, c, y in branches:
        box(f, 0.747, y, 0.198, 0.151, '#F4F9FD')
        txt(f, 0.762, y + 0.109, title, size=14, color=c, bold=True)
        txt(f, 0.762, y + 0.053, desc, size=10.8, color=MUTE, linespacing=1.7)
        arrow(f, (0.7, 0.658), (0.741, y + 0.075), color=c, lw=1.05)
    box(f, 0.051, 0.289, 0.644, 0.194, '#F4F9FD')
    txt(f, 0.073, 0.426, 'Evidence is needed at each step', size=14, color=TEAL, bold=True)
    txt(f, 0.073, 0.368, 'Customer budgets → orders / repeat purchases → net consumption → utilization\n→ company share → recurring profit / free cash flow → growth priced into the stock', size=12, color=MUTE, linespacing=1.9)
    txt(f, 0.5, 0.163, 'Experimental relevance  ∩  Evidenced supply constraints  ∩  Global customer access', size=15, ha='center', bold=True)
    return f
FUNCTIONS = [fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8, fig9, fig10]

def check_figure_bounds(fig, i):
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    W, H = fig.canvas.get_width_height()
    out = []
    for obj in fig.findobj(matplotlib.text.Text):
        if not obj.get_visible() or not obj.get_text():
            continue
        bb = obj.get_window_extent(renderer)
        if bb.x0 < -3 or bb.y0 < -3 or bb.x1 > W + 3 or (bb.y1 > H + 3):
            out.append({'text': obj.get_text(), 'bounds': [round(v, 1) for v in [bb.x0, bb.y0, bb.x1, bb.y1]]})
    QA.append({'figure': i, 'canvas': [W, H], 'text_outside_canvas': out})
    if out:
        raise RuntimeError(f'Figure {i} text outside canvas: {out}')
    anns = []
    for ax in fig.axes:
        anns.extend([a for a in ax.texts if isinstance(a, matplotlib.text.Annotation)])
    pairs = []
    for j, a in enumerate(anns):
        b1 = a.get_bbox_patch().get_window_extent(renderer) if a.get_bbox_patch() else a.get_window_extent(renderer)
        for b in anns[j + 1:]:
            b2 = b.get_bbox_patch().get_window_extent(renderer) if b.get_bbox_patch() else b.get_window_extent(renderer)
            if b1.overlaps(b2):
                pairs.append([a.get_text(), b.get_text()])
    covered = []
    for ax in fig.axes:
        for ann in [a for a in ax.texts if isinstance(a, matplotlib.text.Annotation) and a.get_bbox_patch()]:
            bb = ann.get_bbox_patch().get_window_extent(renderer)
            for coll in ax.collections:
                for xy in coll.get_offsets():
                    xx, yy = ax.transData.transform(xy)
                    if bb.contains(xx, yy):
                        covered.append(ann.get_text())
    QA[-1]['marks_covered_by_labels'] = covered
    if covered:
        raise RuntimeError(f'Figure {i} labels cover markers: {covered}')
    QA[-1]['direct_label_overlap'] = pairs
    if pairs:
        raise RuntimeError(f'Figure {i} direct labels overlap: {pairs}')
assert all(len(r)==4 for r in D['downstream']['rows'])
assert all(0 <= r <= 1 for r in D['investment']['capture_rates'])
assert D['market']['ruo_global'] <= D['market']['total_global'] and D['market']['ruo_china'] <= D['market']['total_china']
selection = [int(v) for v in args.figures.split(',')]
with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter('always')
    with PdfPages(OUT / 'AI_LST_10_charts.pdf', metadata={'Title': 'AI and Life Science Tools: Ten Research Figures', 'Subject': 'Historical estimates, illustrative scenarios and research judgments', 'CreationDate': None, 'ModDate': None}) as pdf:
        for i in selection:
            fig = FUNCTIONS[i - 1]()
            check_figure_bounds(fig, i)
            stem = SLUGS[i - 1]
            fig.savefig(OUT / 'png' / f'{stem}.png', dpi=300)
            fig.savefig(OUT / 'svg' / f'{stem}.svg', metadata={'Date': None, 'Description': TITLES[i - 1]})
            pdf.savefig(fig)
            MANIFEST.append({'figure': i, 'title': TITLES[i - 1], 'png': f'png/{stem}.png', 'svg': f'svg/{stem}.svg'})
            plt.close(fig)
    missing = [str(x.message) for x in caught if 'Glyph' in str(x.message)]
    if missing:
        raise RuntimeError('Missing font glyphs: ' + str(sorted(set(missing))[:10]))
(OUT / 'manifest.json').write_text(json.dumps({'date': D['date'], 'figures': MANIFEST}, ensure_ascii=False, indent=2))
(OUT / 'qa_report.json').write_text(json.dumps(QA, ensure_ascii=False, indent=2))
print(json.dumps({'count': len(MANIFEST), 'canvas': '4800×2700 PNG / 16:9 SVG-PDF', 'glyph_warnings': 0, 'data_checks': 'Source-specific estimates; sensitivities; complete labels; bounds checked'}, ensure_ascii=False))
