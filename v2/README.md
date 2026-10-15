# AI and Life Science Tools research website

Public website: https://wizardzxx-tech.github.io/chart/v2/

The atlas has 16 English figures. Figures 13–14 cover Stage 0 biological-data production, deeper characterization, and the related tool workflow. Their counts are illustrative; no incremental TAM or realized AI revenue is claimed.

Figure 15 shows six representative experiments using flat 2D icons. Equipment, reagents, consumables, labels and supplier names are native editable PowerPoint objects. The workflow guide explains the icons and maps them to supplier examples.

Figure 16 presents a conceptual RSI loop: AI designs experiments, biology generates evidence, and the AI model/policy is updated and benchmarked before the next cycle. Closed-loop learning is distinguished from sustained autonomous RSI.

Edit figure 16: https://wizardzxx-tech.github.io/chart/v2/editor.html?figure=16

Edit figure 15: https://wizardzxx-tech.github.io/chart/v2/editor.html?figure=15

Edit figure 13: https://wizardzxx-tech.github.io/chart/v2/editor.html?figure=13

Every figure supports text editing and SVG/PNG export. Drafts save in the current browser. Editing a numeric label does not recalculate geometry or update published research values.

The 16-slide combined PowerPoint has native editable text boxes over original artwork. The Stage 0 two-slide PowerPoint additionally has native editable tables, shapes and connectors. PDF, 4800×2700 PNG, editable SVG, definitions, sources and corrected drawing prompts are available from each new figure.

This is a static website without login or external script dependencies. Serve this directory over HTTP for local preview. Authoring source requires the bundled Artifact Tool runtime and an installed Presentations skill; set PRESENTATIONS_SKILL_DIR, RUNTIME_PYTHON and runtime module paths for rebuilding.


## Palette and supplier update — 13 October 2026

All 16 English figures and the website use the supplied palette: navy #00355F, light blue #ACD4F1, gray #A5A5A5, mid blue #7399C6, green #078549, lime #8BC346, orange #F67F26 and red #BE3232, in that priority order. Original company logos retain their brand colors.

Figure 12 includes 22 distinct listed suppliers or parents, with Chinese/HK and US listing groups and Tecan on SIX. Brand tickers indicate parent companies; listing groups do not indicate corporate domicile. ACROBiosystems is 301080.SZ. BD (BDX) supplies specimen-collection products. Its former Biosciences / flow business is assigned to Waters (WAT), following the transaction completed on 9 February 2026. See [ticker sources](research/palette/TICKER_SOURCES.md) and [supplier CSV](research/data/supplier_tickers.csv).

[All 16 text-editable slides](research/editable/AI_LST_all_16_text_editable.pptx) · [All 16 figures as PDF](research/AI_LST_all_16_research_graphics.pdf) · [Edit the updated funnel](editor.html?figure=12).

The combined deck uses native editable text lines over original chart artwork. The separate decks for Figures 11–16 also contain native tables, shapes and connectors; logos and icons remain images. Figures, market data, and scenario labels outside Figure 12 retain their previous text.


Each of the 16 figure cards has a Download PPT button. It downloads a separate one-slide editable PowerPoint. Figure dialogs and the text-editor header link to the same per-figure file. Full-deck downloads remain available.


## Evidence review, 13 October 2026

The current site and affected exports use modality-specific workflow mechanisms, 1x/2x/5x/10x workload sensitivities, a qualitative customer map, price-aware consumption math and funding-to-tool-purchase capture sensitivities. The recombinant-protein estimate is labelled issuer-commissioned/disputed; media and resin headline TAMs are withheld pending original-source recovery. Detailed decisions and source boundaries are in [REVIEW_NOTES.md](research/REVIEW_NOTES.md).


## Global AI-biology investment scenarios, 14 October 2026

[Open the English scenario explorer](https://wizardzxx-tech.github.io/chart/v2/scenarios/). The page links total program funding and deployment years to annual flows, funding-supported Build/Test throughput and six differentiated tool-family purchasing indices. Chinese and overseas supplier examples retain tickers and original logos.

The US$10–200bn, 2–5-year range is exploratory. Capital stocks and fully loaded annual operating costs are distinct editable baselines. The 2–10x capacity range is a target envelope: underfunded targets show shortfalls. Workflow coefficients, manufacturing pass-through and hypothetical whole-family AI exposure are assumptions rather than sourced market growth. Sources establish announced examples and time horizons, not a global aggregate forecast.

Current assumptions/results export as JSON, CSV and editable SVG; share links preserve inputs. See [methodology](scenarios/methodology.md), [primary-source register](scenarios/evidence.json) and the pure [calculation module](scenarios/model.js). This page is separate from the 16-figure atlas; existing single-slide PPT downloads remain available.


[Formula-linked scenario Excel](scenarios/AI_LST_formula_linked_scenario.xlsx) includes both live visual panels: funding / annual flows and the discovery funnel / six supplier-family cards. Three native Form Control scrollbars target desktop Excel without macros; visible numeric inputs provide a fallback in browser editions. Two supporting charts, intermediate formulas and reconciliations remain available. The default Total assigns one third to each workflow, with editable weights. The same funding pool and reference cohort are allocated once; component responses are evaluated before aggregation. Each card combines AI-lab purchases and estimated whole-family uplift, without a scope toggle. The default download recalculates independently of browser sliders.


## Figure 15: flat experimental schematics

Figure 15 uses six cards composed from editable 2D equipment, sample and reagent shapes. Scenes cover DNA construction, protein expression/purification, binding, characterization, cell function and model feedback. The detailed page at `wetlab/` explains each icon group and maps it to representative suppliers. The single-slide and complete PPT/PDF downloads include this revision. Generation recipe: `research/workflow/generate_workflow.mjs`.
