# AI antibody research: molecule throughput and experimental data density

Evidence checked on 13 October 2026. The two English figures describe a mechanism and an investment hypothesis. They do not estimate incremental TAM, realized AI revenue or stock returns. Comparison counts are illustrative.

## Conclusion and its limits

Experiments can support both today's candidate selection and a reusable training dataset for future projects. Stage 0 describes this continuing biological-data production function across training, design, validation and iteration; it is not necessarily a one-time step before design.

Data insufficiency can mean incomplete property coverage, incompatible assay conditions, limited sequence/target/format diversity, or data that cannot be accessed or licensed. Cleaning or licensing existing records can improve modeling without new experiments. Active learning can prioritize fewer informative measurements. Stage 0 is an evidenced demand channel, with uncertain net spending and supplier revenue.

## Primary evidence

1. **Jain et al., PNAS, 2017.** [Paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC5293111/), DOI 10.1073/pnas.1616408114. The authors expressed 137 advanced clinical-stage antibody sequences on a common IgG1 scaffold and assessed 12 biophysical assays. Multi-property characterization predates the current AI wave. Some approved antibodies still triggered developability warnings; a single risk metric is not a universal clinical veto. The experimental scaffold differs from exact drug formats.

2. **Arsiwala et al., mAbs, 2025.** [Paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12674332/), DOI 10.1080/19420862.2025.2593055. PROPHET-Ab was built for standardized model-training data. The paper reports 246 IgGs and ten developability assay types, with incomplete coverage for some assays; DLS-kD covered ten IgGs. Methods include titer, CE-SDS, SEC, nanoDSF/DSF, HIC, SMAC, AC-SINS, DLS-kD, heparin-affinity chromatography and polyreactivity. This differs from our nine labels and does not supply all target-specific binding kinetics, precise epitopes or cell potency. The PMC page triggered a verification challenge; full text was checked through [Europe PMC original-article XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12674332/fullTextXML).

3. **van Niekerk et al., mAbs, 2026.** [Paper abstract](https://www.tandfonline.com/doi/abs/10.1080/19420862.2026.2634216), DOI 10.1080/19420862.2026.2634216. The 2025 competition used 246 clinical antibodies for public training and 80 for blinded testing, with 113 teams. Best test-set Spearman correlations were:

| Property | Best test-set Spearman rho |
|---|---:|
| Hydrophobicity | 0.708 |
| Thermostability | 0.392 |
| Polyreactivity | 0.356 |
| Self-association | 0.337 |
| Expression titer | 0.310 |

Winners differed by assay. These are rank correlations, not accuracies or the performance of one model across all tasks. They support a problem of small, heterogeneous datasets and limited generalization, not a claim that extra label columns alone solve it.

4. **Sartorius assay references.** [Kinetics and affinity white paper](https://www.sartorius.com/resource/blob/756208/2db1b53c5a53af4003bbd12ecfaaea24/streamlining-affinity-analysis-for-accelerated-lead-screening-white-paper-en-sartorius-data.pdf), [BLI platform](https://www.sartorius.com/en/products/biolayer-interferometry), [avoiding avidity](https://www.sartorius.com/en/products/biolayer-interferometry/bli-resources/optimizing-kinetics-assays-to-avoid-avidity-application-note), [epitope binning](https://www.sartorius.com/en/products/biolayer-interferometry/bli-resources/octet-cross-competition-epitope-binning-assays). Suitable association/dissociation curves can yield kon, koff and derived KD. Valency, orientation, surface density and non-specific binding affect interpretation. Competition binning is not atomic-resolution mapping.

5. **ACROBiosystems.** The [AIDD-Ready / CHO-Direct offering](https://www.acrobiosystems.com/aix/aidd-ready-solutions) describes expression quantification, BLI screening, optional ELISA, flow, epitope binning and early functional assays, linked to deeper characterization and model iteration. Its [service portfolio](https://www.acrobiosystems.com/services) also lists SPR/BLI, cell customization and functional testing. This establishes a product/service offering, not order volume, realized AI revenue, margin or a Ginkgo supplier relationship.

6. **NanoMicro and NanoChrom.** [NanoMicro's official annual-report discussion](https://www.nanomicro.com/news/company/76) describes chromatography media, NanoChrom columns, Fuli analytical instruments and Sepure purification systems. The [NanoChrom SEC catalogue](https://www.nanochrom.com.cn/products_1/?ext_fenlimoshi=SEC&show=selectproductlist) lists SEC and biological-separation products. Analytical exposure is assessed separately from industrial production resins. No Ginkgo supply relationship was verified.

## The nine labels

| Label | Useful measurement/context | Value | Interpretation limit |
|---|---|---|---|
| KD | Equilibrium dissociation constant, M/nM; model and temperature | Affinity under defined conditions | Lower KD does not automatically imply better cell or clinical activity; multivalent systems can yield apparent avidity |
| kon | Association rate constant, M^-1 s^-1 | Formation kinetics of a binding complex | Not directly the speed of clinical onset |
| koff | Dissociation rate constant, s^-1 | Dissociation kinetics; ideal 1:1 residence time is 1/koff | Residence time is not serum half-life; superiority to KD for efficacy prediction is context-dependent |
| Expression | Titer mg/L, host, culture/transfection conditions and recovery | Sample supply and production feasibility | Transient expression is not stable-cell-line commercial productivity |
| Tm | Thermal transition midpoint, degrees C; domain, buffer and ramp rate | Thermal stability risk | Not directly shelf life or in-vivo half-life; full IgGs can have multiple transitions |
| Aggregation | SEC monomer/high-molecular-weight fraction, DLS or other methods; concentration/stress | Formulation and potential immunogenicity risk | Not a clinical immunogenicity probability; self-association is not identical to aggregation |
| Polyreactivity | Binding to defined non-target materials, with assay/reagent context | Non-specific binding, clearance and developability risk | No universal level guarantees clinical failure |
| Epitope | Competition bin, residues or structure, with method | Binding location and potential mechanism | A competition bin is not a precise structural epitope; location alone does not establish function |
| Cell potency | EC50/IC50, Emax, cell model, target level and incubation | Functional performance in a relevant cellular system | Does not replace in-vivo efficacy, PK/PD, toxicology or clinical evidence |

For a simple reversible 1:1 model, KD = koff / kon. These quantities are not three independent degrees of freedom or necessarily three experiments. Nine labels are not a complete developability checklist: viscosity, solubility, chemical stability, glycosylation, FcRn-related behavior and immunogenicity can also matter.

## Data quality and incremental purchases

Link sequence and molecular format to target, assay, conditions, batch and replicate. Retain raw curves, concentration series, controls, detection limits, QC and failures. Missing measurements must not become negative labels.

Recurring LST purchases can be approximated by summing workflow executions × net purchased inputs per run × ASP. Executions include controls, repeats and multiple conditions. Net inputs reflect miniaturization, shared samples and reuse. Construction, expression and purification prepare shared samples and must not be counted afresh for every label. Instrument CAPEX, maintenance and service costs need separate models. A platform's service revenue and its own reagent purchases must not both enter the same terminal-procurement TAM.

With unchanged assay mix, net consumption and pricing, reducing measured molecules from 1,000 to 300 requires more than 3.33 times the cost-weighted characterization intensity per molecule for purchases to rise. Nine fields do not automatically meet that condition. The 1,000 and 300–1,000 counts are supplied illustrations, not history or forecasts.

Potential funding channels include pharma R&D budgets, financed AI-biotech programs, platform/data-generation contracts and public research budgets. This is a channel inference; no financing or purchasing amount is assumed. Watch paid assay orders, repeat purchases, actual procurement lists and equipment utilization.

## The two suppliers

ACROBiosystems has target proteins, functional cells, assay products and characterization services as direct entry points, with an official AI-workflow offering visible. Verify paid orders, repeat usage, external procurement versus self-production and gross profit per workflow. When customers express their own antibodies, their full production activity cannot be assigned to ACRO sales.

For NanoMicro, initially watch analytical characterization, lab purification and related instruments, with manufacturing resins as a later pathway. Columns can be reused: sample runs translate into column sales through column life, methods, installed base, ASP and supplier share. Industrial resins still depend on pipeline progression, manufacturing batches and commercial output. Neither company has evidence here of ninefold revenue from nine labels.

## Figure interpretation and assets

Figure 13 contains explicitly synthetic integer values from 1 to 10,000. A common linear color scale maps larger values to darker blue. These values have no assay units and do not describe biological quality. Epitope is generally a site/bin/category rather than a continuous score. The table demonstrates dense data records, not nine independent assays. Figure 14 maps properties to workflows and procurement. Original Lucide SVG icons use the [ISC license](https://github.com/lucide-icons/lucide). No company logos or paper figures are reproduced.
