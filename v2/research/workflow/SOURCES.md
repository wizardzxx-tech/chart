# Protein / antibody screening workflow

Figure 15. English infographic. Flat experimental schematic revision, 15 October 2026.

## Scope and interpretation

The example follows sequence-defined antibody candidates against a protein target, from DNA constructs to physical samples, binding screens, characterization and cell function. It is a simplified logical workflow, not a mandatory six-step protocol. Target preparation and candidate expression can run in parallel; primary screens can use culture supernatant before full purification. Assays are chosen for the molecule, mechanism and program.

Stages 4–5 are highlighted as potential constraints on generating comparable, reproducible multi-property data for AI. This is an analytical hypothesis, not evidence that every program has these bottlenecks or that AI raises realized supplier revenue.

KD, kon and koff can come from the same binding experiment and appropriate kinetic model. Expression data originate during production. Epitope competition binning is not atomic-resolution epitope mapping. Stability, aggregation and polyreactivity require different assays; none is implied to be measured by SEC or LC-MS alone. Cell potency is assay-specific and does not establish clinical efficacy. The label panel is a linked record assembled across stages, not nine independent tests.

Instrumentation is shown separately from recurring inputs. Chromatography columns may be reused. Culture bags and bioreactors are scale-dependent. Shared sample preparation and shared assay readouts should be counted once in a procurement model. LIMS/ELN and orchestration are software systems. Data infrastructure supports the whole workflow, even though integration is shown as the sixth stage.

Supplier lists are selected examples spanning reagents, instruments, consumables or services. A supplier listed beneath a stage is not asserted to supply every item in that stage. This is not a market-share ranking, endorsement or statement about installed systems in one laboratory.

## Primary sources supporting the mappings

1. [GenScript — antibody production](https://www.genscript.com/custom-antibody-production-services.html?src=home): antibody production and purification services. [Gene-to-antibody workflow](https://www.genscript.com/high-throughput-antibody-purification.html): constructs, expression and purification.
2. [Twist — gene fragments](https://www.twistbioscience.com/products/genes/fragments): DNA fragments for construct generation. [Multiplexed gene fragments](https://investors.twistbioscience.com/news-releases/news-release-details/twist-bioscience-launches-multiplexed-gene-fragments-enable-high): applications include antibody discovery and protein engineering.
3. [ACROBiosystems — AIDD-Ready](https://www.acrobiosystems.com/aix/aidd-ready-solutions): target proteins; gene synthesis, CHO expression, expression quantification, binding screening, optional epitope and cell assays. [Services](https://www.acrobiosystems.com/services): protein and cellular services and characterization.
4. [Cytiva — antibody purification handbook](https://cdn.cytivalifesciences.com/api/public/content/digi-26798-pdf): antibody affinity purification and chromatography choices. [Handbooks](https://www.cytivalifesciences.com/en/us/support/handbooks): laboratory protein purification. ÄKTA is a Cytiva instrument family; FPLC denotes a chromatography technique.
5. [Sartorius — BLI](https://www.sartorius.com/en/products/biolayer-interferometry): binding kinetics, affinity, concentration, biosensors and epitope binning. [Epitope binning](https://www.sartorius.com/en/products/biolayer-interferometry/bli-resources/octet-cross-competition-epitope-binning-assays): cross-competition assays.
6. [NanoTemper — Prometheus Panta](https://nanotempertech.com/prometheus-panta/): nanoDSF and scattering measurements for stability and aggregation-related properties. [nanoDSF](https://nanotempertech.com/nanodsf/): thermal unfolding and the distinction between conformational and colloidal stability.
7. [NanoMicro — company business description](https://www.nanomicro.com/news/company/76): chromatography materials and analytical separation portfolio. [NanoChrom SEC catalog](https://www.nanochrom.com.cn/products_1/?ext_fenlimoshi=SEC&show=selectproductlist): SEC products, previously inspected in the preceding research; not freshly accessible through the web reader on 13 October. NanoMicro exposure here is analytical separation and purification, not an assertion that research-scale assay growth immediately translates into manufacturing resin demand.
8. [Molecular Devices — cellular imaging](https://www.moleculardevices.com/products/cellular-imaging-systems): cell imaging platforms. [Antibody binding with high-content imaging](https://www.moleculardevices.com/en/assets/app-note/dd/img/homogeneous-antibody-binding-assays-with-high-content-imaging): cell-surface binding as an example distinct from a complete potency assay.
9. [Corning — life sciences](https://www.corning.com/worldwide/en/products/life-sciences.html): culture vessels and microplates.
10. [Waters Biosciences — flow cytometers](https://www.bdbiosciences.com/en-br/products/instruments/flow-cytometers): current portfolio naming. [Waters transaction disclosure](https://www.waters.com/nextgen/us/en/about-waters/corporate-governance/legal-and-privacy-notices/bdtransaction.html): combination with BD's Biosciences & Diagnostic Solutions closed 9 February 2026. The slide therefore labels the former BD Biosciences portfolio as Waters Biosciences (ex-BD).
11. [Hamilton — applications](https://www.hamiltoncompany.com/applications): liquid handling and protein/cell workflow automation. [Tecan](https://www.tecan.com): liquid handling and laboratory automation.
12. [Benchling — biopharmaceutical R&D](https://www.benchling.com/solutions/biopharmaceutical): ELN, LIMS and linked data. [Genedata Biologics](https://www.genedata.com/platform/biologics): molecule/sample tracking, screening records and characterization data.

Additional suppliers from the user's requested representative set are included as company-name examples consistent with their established product families: Tsingke and Vazyme (construction reagents/services); Thermo Fisher and Gibco (instruments, reagents and media); Sino Biological and Bioss (proteins/antibodies); OPM and Duoning (culture/bioprocess inputs); Waters, Agilent and Sepax (analytical separation); Bio-Techne (proteins and cellular assay reagents); JET Biofil (labware). Individual stock-keeping units are not specified.

## Original visual assets

Original artwork is embedded without redrawing, with aspect ratios preserved. Whitespace-trimmed versions already exist in this project's asset library. Company-name text labels are editable native text; original logo artwork remains an image. Logos remain images in the PowerPoint; all diagram text, frames and arrows are native editable objects.

- Twist: https://www.twistbioscience.com/content/dam/twist-aem-migration/twist-home-logo.svg
- GenScript: https://www.genscript.com/gsimages/logo.jpg
- ACROBiosystems: https://console.acrobiosystems.com/public/images/LOGO-download.png
- Cytiva: https://massbioportalimages.blob.core.windows.net/massbioportalimages/a28b10cf8e90ea11a811000d3a33b4ee/Cytiva%20-%20Copy.png (previously archived logo from MassBio).
- NanoMicro emblem: https://www.nanomicro.com/Public/Cn/images/com_logo.svg (original emblem with a separate editable English company name).
- Tecan: https://www.tecan.com/hubfs/page_images/logo.png
- JET Biofil: https://image.makewebeasy.net/makeweb/m_1920x0/EtyBgz2ZO/Product_Brand/Jet_01.png?v=202012190947 (English original from distributor; previously archived).
- Lucide icons: https://github.com/lucide-icons/lucide — ISC license. DNA, flask, test tubes, microscope, pipette, database and bot. Icons retain original paths; stroke color is teal for the slide.

No market sizes, unit prices, empirical throughput values or company revenue forecasts are introduced in this figure.


Palette updated to the user's eight RGB colors on 13 October 2026. Original company marks retain their brand colors.

## Flat experimental scenes (15 October 2026 revision)

The six-card workflow is retained. Each card contains a small composition of editable flat vector shapes: a dispensing arm, multiwell plate and thermocycler; culture flask, medium, chromatography column and analytical MS; antibody, target, assay plate and binding platform; separation, thermal and kinetic readouts; cell dosing, flow and imaging; and linked records feeding the next design. These are generic scientific diagrams, not literal vendor models. No photorealistic or isometric artwork is used in the current Figure 15.

PCR supports construct amplification/assembly after DNA purchase; it is not labeled as de novo gene synthesis. LC-MS is labeled analytical QC after chromatographic purification, not the preparative purification device. Binding curves, peaks, cell dots and model nodes are illustrative; they are not measured datasets. The flow supplier is Waters Biosciences (ex-BD). Supplier groupings identify selected relevant product families, not complete stage coverage. Full item explanations are in `workflow-data.json` and the public `wetlab/` page.

All current diagram components, company labels, frames, arrows and text are native editable PowerPoint shapes/text. No company logos are redrawn. The current figure uses text supplier names to keep the six scenes legible. The generation recipe is `generate_workflow.mjs`.
