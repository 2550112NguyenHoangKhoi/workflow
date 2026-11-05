import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
st = getSampleStyleSheet()
pages = [
 ("Photosynthesis", [
  "Photosynthesis is the process by which green plants, algae and some bacteria convert light energy into chemical energy stored in glucose.",
  "The process takes place mainly in the chloroplasts of leaf cells. Chlorophyll is the green pigment that absorbs red and blue light and reflects green light.",
  "The overall equation is 6CO2 + 6H2O + light energy produces C6H12O6 + 6O2. Oxygen is released as a by-product of splitting water molecules.",
  "Photosynthesis has two stages: the light-dependent reactions and the Calvin cycle. The light-dependent reactions occur in the thylakoid membranes."]),
 ("The Calvin cycle", [
  "The Calvin cycle takes place in the stroma of the chloroplast and does not require light directly.",
  "During carbon fixation, the enzyme RuBisCO attaches carbon dioxide to ribulose bisphosphate. RuBisCO is considered the most abundant protein on Earth.",
  "ATP and NADPH produced by the light-dependent reactions provide the energy and reducing power needed to build glucose.",
  "Factors that limit the rate of photosynthesis include light intensity, carbon dioxide concentration and temperature."]),
 ("Cellular respiration", [
  "Cellular respiration releases the energy stored in glucose so that cells can make ATP.",
  "Aerobic respiration requires oxygen and occurs in the mitochondria. It produces carbon dioxide, water and about 36 to 38 ATP molecules per glucose.",
  "Glycolysis is the first stage of respiration and happens in the cytoplasm. It splits glucose into two molecules of pyruvate.",
  "Anaerobic respiration does not use oxygen. In muscle cells it produces lactic acid, while yeast produces ethanol and carbon dioxide through fermentation."]),
]
doc = SimpleDocTemplate(sys.argv[1], pagesize=A4)
flow = []
for i, (h, paras) in enumerate(pages):
    flow.append(Paragraph(h, st["Heading1"]))
    flow += [Paragraph(p, st["BodyText"]) for p in paras]
    if i < len(pages) - 1: flow.append(PageBreak())
doc.build(flow)
