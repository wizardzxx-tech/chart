# AI wet-lab investment scenarios

Model version: 2026-10-14.1. Sources reviewed: 14 October 2026.

## Scope and units

The model explores **incremental global AI-enabled biomedical research program funding** and its transmission into physical Build activity, biological Test measurements and life science tools purchases. This is infrastructure plus enabling experiment-execution funding. It excludes general healthcare administration, clinical trials and non-biomedical AI-for-science from the modeled wet-lab allocation.

All money inputs are **US$bn**. Annual flows are US$bn/year. US$10–200bn corresponds to RMB-language notation of **100–2,000 hundred-million US dollars**; it is not US$100–2,000bn. The deployment window is 2–5 years. A zero-investment comparator is also available.

These are exploratory ranges, not a sourced aggregate global forecast. US$10–50bn is a working sensitivity range; US$100–200bn is a transformational stress scenario. Presets have no assigned probabilities. The default US$50bn / five-year case is an illustration, not a base-case forecast.

The reference cohort at 1× is hypothetical. Its equipment stock and fully loaded annual operating costs must be defined for the same cohort and activities. It is not the entire global installed LST base. Build units and Test measurements are different activities, not interchangeable molecule counts. The funnel widths are schematic.

## Primary-source context

The inspectable register is [evidence.json](evidence.json). Sources establish relevant mechanisms and deployment periods, not dollar-to-capacity calibration.

| Announcement | Amount | Interpretation |
| --- | --- | --- |
| [Biohub, 29 Apr 2026](https://biohub.org/news/virtual-biology-initiative/) | US$0.5bn over five years | US$0.4bn in-house data / technologies and US$0.1bn external research; included in October expansion. |
| [Biohub / DOE / NIH / partners, 7 Oct 2026](https://biohub.org/news/virtual-biology-initiative-expansion/) | US$1.8bn mixed commitment | Includes prior NIH data investment, compute and measurement. Five years explicit for Biohub / DOE components; not all new cash. |
| [Lilly / NVIDIA, 12 Jan 2026](https://lilly.gcs-web.com/news-releases/news-release-details/nvidia-and-lilly-announce-co-innovation-ai-lab-reinvent-drug) | Up to US$1bn over five years | Talent, infrastructure, compute and research; no disclosed wet-lab equipment / running-cost split. |
| [Isomorphic, 12 May 2026](https://www.isomorphiclabs.com/press/isomorphic-labs-funding) | US$2.1bn Series B | Corporate financing for engine, pipeline and expansion; no deployment horizon. Not infrastructure procurement. |

The announcements must not be added into a global infrastructure total. Potential overlap, prior investment, corporate financing and in-kind resources have different meanings. The scenario funding input represents assumed **new funding actually deployed within the model scope**, rather than the sum of announcement headlines.

Historic CMU cloud-lab project cost and Recursion's reported experiment scale are contextual examples in the register, not unit-cost calibration. Peak assay capacity is not utilized capacity or fully characterized molecules.

## Funding to Build / Test

Let I be total program funding, N years, s wet-lab funding share, c equipment share of wet-lab funding, t Test share, u incremental rollout realization, p incremental productivity and L commissioning lag.

```
Annual funding             = I / N
Annual wet-lab funding     = I × s / N
Annual equipment funding   = I × s × c / N
Annual lab execution       = I × s × (1 − c) / N
Other annual program uses  = I × (1 − s) / N
Total equipment stock      = I × s × c
Commissioned fraction      = max(0, 1 − L / N)
```

Productive equipment excludes general facilities and compute; these belong to the other-uses bucket. Annual lab execution includes personnel, consumables, shared operating costs and enabling services. Neither bucket is equivalent to supplier revenue. Uniform annual deployment is assumed. Build and Test use the same allocation for equipment and lab execution: Build share = 1−t; Test share = t.

For stage j, reference equipment stock is Kj and fully loaded annual costs are Oj. Define:

```
Installed increment j = I × s × c × stage share j × commissioned fraction / Kj
Running increment j   = I × s × (1−c) × stage share j / (N × Oj)
Raw funded support j  = 1 + u × p × min(installed increment j, running increment j)
Modeled throughput j  = min(10, raw funded support j)
Desired target j      = min(10, max(2, raw funded support j))
```

The desired 2× lower bound is not guaranteed. Below 2×, the actual support and shortfall are shown. Above 10×, the diagram and family drivers use a **10× reference-cohort ceiling**, while raw uncapped support remains disclosed/exported. This ceiling does not prove excess dollars are unspent; larger cohorts are outside the defined envelope.

Rollout realization applies once to incremental support, leaving the existing 1× activity intact. It represents commissioning/execution realization, not measured instrument utilization. A common p improves both incremental equipment and execution efficiency. Family response exponents subsequently affect tool inputs per realized activity; avoid using both parameters for the same efficiency gain.

At year y, deployed equipment is total equipment × max(0, y−L) / N. The annual operating support is constant during deployment. The capital stock accumulates, while operating funding is a flow. End-of-program capacity can be unchanged when shortening N if equipment is the binding constraint. No artificial horizon sensitivity is imposed. Continued execution after the program requires recurring funding at the assumed run rate.

## Default inputs: all analyst assumptions

| Input | Default |
| --- | --- |
| Program funding / deployment | US$50bn / five years |
| Wet-lab share / equipment share within wet lab | 35% / 45% |
| Test share; Build is remainder | 65% |
| Build / Test reference equipment stock | US$1.5bn / US$2.5bn |
| Build / Test reference annual lab costs | US$0.35bn / US$0.55bn per year |
| Incremental rollout realization / productivity | 85% / 1× |
| Commissioning lag | Zero years |
| Lab / analytical share of purification | 35% |
| Manufacturing growth pass-through | Zero |

No announcement independently validates these cost baselines, allocation shares or response coefficients. The defaults yield Build **2.561875×** and Test **2.740375×**, both equipment-bound. US$10bn over five years yields **1.312375× / 1.348075×**, below the desired 2× target. Zero funding yields 1× for all outputs.

## Six-family purchasing responses

Each family has Build driver share w, response exponent e, incremental purchase-price factor q and hypothetical AI exposure a.

```
Activity driver         = w × Build throughput + (1−w) × Test throughput
Incremental input index = driver ^ e − 1
AI-cohort purchases     = 1 + incremental input index × q
Whole-family dilution   = 1 + a × (AI-cohort purchases − 1)
```

e = 1 means proportional net inputs; e < 1 can represent miniaturization, shared samples, reuse and existing instrument headroom; e > 1 represents increased readouts per unit of activity. q affects **incremental** purchases, holding existing baseline purchases unchanged. The whole-family view assumes unchanged non-AI purchases and an analyst-defined AI exposure share; it is not a verified industry growth forecast or measured market share.

Purification uses a separate mixture. If h is its lab/analytical share and m the manufacturing pass-through:

```
Purification input increment = h × (driver ^ e − 1)
                             + (1−h) × m × (driver ^ 0.2 − 1)
```

The commercial-manufacturing response exponent of 0.2 is a fixed analyst sensitivity, not an observed elasticity. Manufacturing pass-through defaults to zero. Early analytical and laboratory purification can rise without commercial process-resin demand rising immediately. The 35% mix is not a verified revenue split.

### Workflow presets

Family order: molecular construction; protein & functional assays; cells & culture; labware; measurement; purification. All coefficients are editable and hypothetical.

| Workflow | Response exponents | Build driver weights | Whole-family AI exposure (%) |
| --- | --- | --- | --- |
| Protein / antibody | .90, .95, .75, .40, .70, .50 | 1, .15, .10, .35, .05, .60 | 12, 20, 10, 8, 12, 6 |
| Cell-data / perturbation | .80, .65, 1.05, .45, 1, .30 | .75, .05, .05, .20, .02, .45 | 12, 12, 25, 12, 20, 4 |
| Small-molecule | .60, .45, .80, .30, .80, .40 | 1, .10, .05, .30, .10, .65 | 12, 8, 12, 8, 12, 6 |

Price factors default to 1. Switching workflow resets family coefficients. Funding presets alter only total funding and years; reset restores all default assumptions. Ranking is conditional on these inputs and can reverse between cohort and diluted views. Equal outputs do not establish a winner.

The six indices are **non-additive**. They overlap workflows and do not allocate the funding pool into six disjoint revenues. Do not multiply them by the unrelated market anchors in Figure 12. A company may serve multiple families, geographies and customer types; the page does not model revenue capture, margins, valuation or investment returns.

## Target funding backsolve

For a target M, required increment is (M−1)/(u×p). Required total funding for each stage is the larger of capital and annual operating requirements. Funding for both stages is the maximum of the two stage totals, under the fixed stage allocation.

```
Capital requirement j = (M−1) × Kj / (u × p × s × c × share j × commissioned fraction)
Operating requirement j = (M−1) × N × Oj / (u × p × s × (1−c) × share j)
Total needed for both = max(capital Build, operating Build, capital Test, operating Test)
```

Zero necessary shares, zero realization or a lag covering the deployment period make the target infeasible. The model does not return a misleading zero-cost target.

## Limits and exports

No idle baseline headroom, equipment depreciation, retirement, maintenance CAPEX, staged operating allocation, debt financing costs, industry baseline growth or clinical success change is modeled. Pure equipment funding with no operating support, or pure running funding with no equipment expansion, does not create sustained incremental output here. Build/Test coefficients are aggregate sensitivities rather than a detailed facility engineering model.

Chinese and overseas supplier names/tickers are product-exposure examples; provenance is in the existing [supplier register](../research/data/supplier_tickers.csv) and [research sources](../research/SOURCES.md). BD appears for specimen collection. Its divested biosciences / flow businesses are represented through Waters; do not interpret BDX as current ownership of those flow products.

Scenario JSON includes inputs, raw and capped capacity, annual/cumulative funding, family indices and model version. CSV includes raw/capped outputs and coefficients with units. Editable SVG exports the current diagram as native text and shapes. Scenario links preserve all assumptions in the URL; no server-side storage is used.


## Formula-linked Excel workbook

[Download the English Excel model](AI_LST_formula_linked_scenario.xlsx). It opens the default US$50bn / five-year scenario. Change blue numeric inputs and choose workflow 1, 2 or 3 on Inputs. The chosen workflow coefficient table is editable. Formula-linked results and native charts recalculate from those inputs. Browser slider changes are not automatically embedded in this static workbook.

Scenario presents the results. Calculations shows stock/flow funding, Build/Test constraints, family purchasing responses, the throughput ramp and target backsolves. Inputs owns assumptions, workflow presets and source context. Checks contains one-way reconciliations and never feeds the model. All amount inputs are US$bn and percentages are stored as Excel fractions.

The workbook preserves the web model’s fixed 2x desired floor, 10x cohort ceiling and 0.2 manufacturing response exponent. Target funding is not capped at US$200bn. Arithmetic validation does not calibrate the economic assumptions.
