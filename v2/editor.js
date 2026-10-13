const $ = selector => document.querySelector(selector);
const ns = 'http://www.w3.org/2000/svg';
const status = message => { $('#editor-status').textContent = message; };
const legacyColors={"#263b49":"#00355F","#152c3a":"#00355F","#647887":"#00355F","#657b88":"#00355F","#526977":"#00355F","#6a7f8b":"#00355F","#285e7d":"#00355F","#49837f":"#ACD4F1","#a18150":"#A5A5A5","#778ea7":"#7399C6","#b9c6cb":"#078549","#a4b5bf":"#A5A5A5","#bcc9d0":"#A5A5A5","#95a9b4":"#7399C6","#e3ebee":"#ACD4F1","#007d80":"#00355F","#2b62b1":"#00355F","#0078a0":"#00355F","#bb8d37":"#F67F26","#bb5360":"#BE3232","#4d8574":"#00355F","#eaf6f4":"#EEF6FC","#eaf0fa":"#EEF6FC","#c7e7e0":"#ACD4F1","#bfe8e1":"#ACD4F1","#faf5eb":"#FFFFFF","#f8ebee":"#FFFFFF","#f5f8f9":"#F4F9FD","#eef3f5":"#F4F9FD","#f3f7f8":"#F4F9FD","#f1f7f6":"#F4F9FD","#f4f7f8":"#F4F9FD","#f3f7f6":"#F4F9FD","#f4faf9":"#F4F9FD","#f8fbfc":"#F4F9FD","#f0f8f6":"#EEF6FC","#eef3f4":"#EEF6FC","#e7eef1":"#EEF6FC","#d7e3e8":"#A5A5A5","#8ebdb7":"#7399C6","#a5cfc7":"#7399C6","#a4cec7":"#7399C6","#74b6ac":"#7399C6","#a7c2e2":"#7399C6","#75b4a9":"#7399C6","#bcd0e9":"#7399C6","#000000":"#00355F"};
function migratePalette(labels){return labels.map(label=>({...label,color:legacyColors[String(label.color).toLowerCase()]||label.color}));}
let figures, figure, svg, nodes = [], originals = [], selected = -1, signature, history = [], future = [], loading = false;
const key = () => `lst-text-editor-v1-${figure.figure}`;
const textLines = node => node.children.length ? [...node.children].map(child => child.textContent).join('\n') : node.textContent;
const snapshot = () => nodes.map(node => ({text:textLines(node),size:node.style.fontSize,color:node.style.fill}));
function remember() { history.push(snapshot()); if (history.length > 40) history.shift(); future = []; updateButtons(); }
function updateButtons() { $('#undo').disabled = !history.length; $('#redo').disabled = !future.length; }
function saveDraft() { try { localStorage.setItem(key(),JSON.stringify({signature,labels:snapshot()})); status('Saved in this browser.'); } catch { status('Browser storage unavailable. Download the SVG to keep your edits.'); } }
function applyText(node, text, original) {
  const lines = String(text).split('\n');
  const spans = [...original.children];
  if (!spans.length && lines.length === 1) { node.textContent = lines[0]; return; }
  const size = parseFloat(getComputedStyle(node).fontSize) || 18;
  const x = original.getAttribute('x') || spans[0]?.getAttribute('x') || '0';
  node.replaceChildren();
  lines.forEach((line,index) => {
    const span = spans[index]?.cloneNode(false) || document.createElementNS(ns,'tspan');
    if (!spans[index]) { span.setAttribute('x',x); span.setAttribute('dy',index ? size * 1.25 : 0); }
    if (index && span.hasAttribute('dy')) span.setAttribute('dy',size*1.25);
    span.textContent = line;
    node.append(span);
  });
}
function restore(labels) {
  labels.forEach((item,index) => {
    const node = nodes[index];
    if (!node || typeof item.text !== 'string') return;
    node.style.fontSize = /^(?:\d+(?:\.\d+)?px)?$/.test(item.size || '') ? item.size || '' : '';
    node.style.fill = /^(?:#[\da-f]{6}|rgb\([\d\s,]+\))?$/i.test(item.color || '') ? item.color || '' : '';
    applyText(node,item.text,originals[index]);
  });
  updateTextList();
  if (selected >= 0) selectText(selected);
}
function updateTextList() {
  $('#text-picker').replaceChildren(...nodes.map((node,index) => {
    const option = document.createElement('option'); option.value = index;
    option.textContent = `${String(index+1).padStart(2,'0')} · ${textLines(node).replaceAll('\n',' / ').slice(0,90) || '(empty label)'}`;
    return option;
  }));
  $('#text-picker').value = selected;
}
function outline() {
  const box = $('#selection-outline');
  if (selected < 0 || !nodes[selected]) { box.hidden = true; return; }
  const rect = nodes[selected].getBoundingClientRect(), canvas = $('#figure-canvas').getBoundingClientRect();
  box.hidden = false;
  Object.assign(box.style,{left:`${rect.left-canvas.left-3}px`,top:`${rect.top-canvas.top-3}px`,width:`${Math.max(rect.width,6)+6}px`,height:`${rect.height+6}px`});
}
function selectText(index) {
  selected = Number(index); const node = nodes[selected]; if (!node) return;
  $('#text-picker').value = selected;
  $('#label-text').disabled = $('#font-size').disabled = $('#text-color').disabled = false;
  $('#label-text').value = textLines(node);
  const style = getComputedStyle(node);
  $('#font-size').value = Math.round(parseFloat(style.fontSize)*100)/100;
  const rgb = style.fill.match(/\d+/g);
  $('#text-color').value = rgb?.length >= 3 ? '#'+rgb.slice(0,3).map(c=>Number(c).toString(16).padStart(2,'0')).join('') : '#00355f';
  outline();
}
async function loadFigure(number) {
  if (loading) return;
  loading = true;
  $('#figure-picker').disabled = true;
  try {
    figure = figures.find(item=>item.figure===Number(number)) || figures[11];
    $('#figure-picker').value = figure.figure;
    const deck=$('#deck-download'); deck.href='research/'+(figure.pptx||'editable/AI_LST_all_16_text_editable.pptx'); deck.textContent='Download PPT (1 slide) ↓';
    const response = await fetch('research/'+figure.svg+'?v=audit-v1-20261013'); if (!response.ok) throw Error('Figure could not be loaded');
    const source = await response.text();
    const documentSvg = new DOMParser().parseFromString(source,'image/svg+xml');
    if (documentSvg.querySelector('parsererror')) throw Error('Invalid SVG');
    svg = document.importNode(documentSvg.documentElement,true);
    svg.setAttribute('aria-label',figure.title);
    nodes = [...svg.querySelectorAll('text')]; originals = nodes.map(node=>node.cloneNode(true));
    signature = 'labels-v2:'+originals.map(node=>node.textContent).join('|');
    selected = -1; history = []; future = [];
    $('#figure-canvas').replaceChildren(svg,$('#selection-outline'));
    nodes.forEach((node,index)=>node.addEventListener('click',()=>{ selectText(index); $('#label-text').focus(); }));
    let restored = false;
    try { const draft = JSON.parse(localStorage.getItem(key())); if ((draft?.signature===signature || draft?.signature?.slice(draft.signature.indexOf(':')+1)===signature.slice(10)) && draft.labels?.length===nodes.length) { restore(draft.signature===signature?draft.labels:migratePalette(draft.labels)); restored = true; } } catch {}
    updateTextList(); updateButtons(); selectText(0);
    const url = new URL(location.href); url.searchParams.set('figure',figure.figure); window.history.replaceState(null,'',url);
    status(`${nodes.length} editable text labels. ${restored?'Browser draft restored.':'Choose a label to begin.'}`);
  } catch (error) { status(error.message); } finally { loading = false; $('#figure-picker').disabled = false; }
}
$('#figure-picker').addEventListener('change',event=>loadFigure(event.target.value));
$('#text-picker').addEventListener('change',event=>selectText(event.target.value));
let textSession = false;
$('#label-text').addEventListener('focus',()=>{ textSession = false; });
$('#label-text').addEventListener('input',()=>{
  if (selected < 0) return;
  if (!textSession) { remember(); textSession = true; }
  applyText(nodes[selected],$('#label-text').value,originals[selected]); updateTextList(); outline(); saveDraft();
});
$('#font-size').addEventListener('change',()=>{
  const size = Number($('#font-size').value);
  if (selected < 0 || !Number.isFinite(size) || size < 4 || size > 150) return;
  remember(); nodes[selected].style.fontSize = size+'px'; applyText(nodes[selected],textLines(nodes[selected]),originals[selected]); outline(); saveDraft();
});
$('#text-color').addEventListener('change',()=>{ if (selected < 0) return; remember(); nodes[selected].style.fill = $('#text-color').value; saveDraft(); });
$('#undo').addEventListener('click',()=>{ if (!history.length) return; future.push(snapshot()); restore(history.pop()); textSession=false; updateButtons(); saveDraft(); });
$('#redo').addEventListener('click',()=>{ if (!future.length) return; history.push(snapshot()); restore(future.pop()); textSession=false; updateButtons(); saveDraft(); });
$('#reset').addEventListener('click',()=>{
  if (!svg) return;
  remember(); restore(originals.map(node=>({text:textLines(node),size:node.style.fontSize,color:node.style.fill}))); textSession=false; saveDraft(); status('Original labels restored. Undo is available.');
});
function svgSource() {
  const copy = svg.cloneNode(true); copy.setAttribute('xmlns',ns);
  const [,,width,height] = copy.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  copy.setAttribute('width',width); copy.setAttribute('height',height);
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(copy);
}
function download(blob,filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
const stem = () => figure.svg.split('/').pop().replace('.svg','_edited');
$('#export-svg').addEventListener('click',()=>{ if (!svg) return; download(new Blob([svgSource()],{type:'image/svg+xml;charset=utf-8'}),stem()+'.svg'); status('Editable SVG downloaded.'); });
$('#export-png').addEventListener('click',async()=>{
  if (!svg) return;
  const button = $('#export-png'); button.disabled = true;
  const url = URL.createObjectURL(new Blob([svgSource()],{type:'image/svg+xml'}));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width=3200; canvas.height=1800;
    const context = canvas.getContext('2d'); context.fillStyle='white'; context.fillRect(0,0,3200,1800); context.drawImage(image,0,0,3200,1800);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png')); if (!blob) throw Error('PNG export unavailable');
    download(blob,stem()+'.png'); status('PNG downloaded. Use SVG or PowerPoint for editable text.');
  } catch (error) { status('PNG export failed. The editable SVG is available.'); } finally { URL.revokeObjectURL(url); button.disabled=false; }
});
new ResizeObserver(outline).observe($('#figure-canvas'));
try {
  const response = await fetch('assets/figures.json?v=audit-v1-20261013'); if (!response.ok) throw Error('Figure list unavailable'); figures = await response.json();
  $('#figure-picker').replaceChildren(...figures.map(item=>{const option=document.createElement('option');option.value=item.figure;option.textContent=`${String(item.figure).padStart(2,'0')} · ${item.title}`;return option;}));
  await loadFigure(new URL(location.href).searchParams.get('figure') || 12);
} catch (error) { status(error.message); }
