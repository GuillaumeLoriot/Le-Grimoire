const $ = selector => document.querySelector(selector);
const categories = {
  "front-end": "Front-end",
  "back-end": "Back-end",
  bdd: "Conception & BDD",
  algorithmique: "Fondamentaux & Algorithmique",
  outils: "Outils & méthodes"
};
const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const previous = $(".previous"), next = $(".next"), search = $("input");
const left = $("#left"), right = $("#right"), turn = $("#turn");
let resourcesByCategory = {};
let catalog = [], visible = [], index = 0, category = "front-end", frame = 0;
const reader = $(".reader");
const cover = $(".book-cover");
const brand = $(".brand");
const bookPages = $("#book-pages");
// Projection du plat fermé, mesurée aux quatre coins de la couverture.
const closedProjection = [0.848857518,0.19969198,-0.344707323,0.288712675,1.232183569,-0.17639066,0.28760014,0.1862649,1];
const pose = $(".book-pose");
const closedEdges = $(".closed-edges");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let opening = 0, openingFrame = 0;
function smooth(value) {
  const t = Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}
function pageReveal(progress) {
  if (progress >= .5) return "none";
  const angle = Math.PI * progress;
  const width = pose.clientWidth / pose.clientHeight;
  const perspective = width * 1.9;
  // Extrémités de l'arête extérieure dans le repère de la reliure,
  // exprimées en fractions de la hauteur du livre.
  function project(x, y) {
    const scale = perspective / (perspective - x * Math.sin(angle));
    return { x: .5 + x * Math.cos(angle) * scale / width, y: .33 + (y - .33) * scale };
  }
  const top = project(.79, -.037);
  const bottom = project(.98, .72);
  const slope = (bottom.x - top.x) / (bottom.y - top.y);
  const xAt = y => (top.x + (y - top.y) * slope) * 100;
  return `polygon(${xAt(-.2)}% -20%, 120% -20%, 120% 120%, ${xAt(1.2)}% 120%)`;
}
function poseBook() {
  const progress = smooth(opening);
  const closed = 1-progress;
  const height = pose.offsetHeight || 1;
  const [a,b,c,d,e,f,g,h] = closedProjection;
  pose.style.transform = closed === 0 ? "none" : "matrix3d("+[
    progress+a*closed,d*closed,0,g*closed/height,
    b*closed,progress+e*closed,0,h*closed/height,
    0,0,1,0,c*closed*height,f*closed*height,0,1
  ].join(",")+")";
  pose.style.setProperty("--board-angle",180*closed+"deg");
  pose.style.setProperty("--controls-alpha",smooth((opening-.84)/.16));
  pose.style.setProperty("--gutter-shadow",closed*.8);
  // Seul le papier situé au-delà de l'arête projetée est découvert.
  bookPages.style.clipPath = pageReveal(progress);
  bookPages.style.visibility = opening === 0 ? "hidden" : "visible";
  closedEdges.style.opacity = 1-smooth((opening-.05)/.40);
}
function moveCover(open) {
  cancelAnimationFrame(openingFrame);
  const start = performance.now(), from = opening, goal = Number(open);
  const duration = reducedMotion.matches ? 0 : 1350*Math.abs(goal-from);
  reader.toggleAttribute("data-moving",true);
  function tick(now) {
    const fraction = duration ? Math.min(1,(now-start)/duration) : 1;
    opening = from + (goal-from)*fraction;
    poseBook();
    if (fraction < 1) openingFrame=requestAnimationFrame(tick);
    else reader.removeAttribute("data-moving");
  }
  tick(start);
}
new ResizeObserver(poseBook).observe(pose);
poseBook();
function setBookOpen(open) {
  if ((reader.dataset.open === "true") === open) return;
  reader.dataset.open = String(open);
  moveCover(open);
  bookPages.inert = !open;
  $(".book-controls").inert = !open;
  cover.inert = open;
  brand.setAttribute("aria-expanded", String(open));
  brand.setAttribute("aria-label", open ? "Refermer le grimoire" : "Ouvrir le grimoire");
}
cover.onclick = () => {
  setBookOpen(true);
  $("nav button[aria-pressed=true]")?.focus({ preventScroll: true });
};
brand.onclick = () => setBookOpen(reader.dataset.open !== "true");
function make(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
for (const [key, label] of Object.entries(categories)) {
  const button = make("button", "", label);
  button.dataset.category = key;
  button.onclick = () => { setBookOpen(true); category = key; search.value = ""; filter(); };
  $("nav").append(button);
}
function draw(page, side, item) {
  page.replaceChildren();
  if (side === "left") {
    const image = make("img", "art");
    image.alt = "";
    image.src = item?.image || "assets/cristal.webp";
    if (item) {
      const plate = make("div","illustrated-page");
      plate.append(make("h2","chapter-title",categories[item.categorie]),image);
      page.append(plate);
    } else {
      page.append(image);
    }
    return;
  }
  const copy = make("div", "copy");
  page.append(copy);
  if (!item) {
    copy.append(make("h2","","Aucun cours trouvé"),make("p","description","Essayez un autre mot ou choisissez une catégorie."));
    return;
  }
  copy.append(make("h3","",item.titre));
  if (item.entries) {
    copy.classList.add("chapter");
    const list = make("ol","contents");
    list.start = item.start;
    for (const entryData of item.entries) {
      const entry = make("li","");
      if (item.kind === "resources") {
        const link = make("a", "", entryData.titre);
        link.href = entryData.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        entry.append(link);
      } else {
        const button = make("button", "", entryData.titre);
        button.onclick = () => navigate(visible.indexOf(entryData), 1);
        entry.append(button);
      }
      list.append(entry);
    }
    if (item.entries.length) copy.append(list);
    else copy.append(make("p", "description", item.kind === "resources" ? "Aucune ressource pour le moment." : "Aucun cours pour le moment."));
    return;
  }
  const rule = make("div","rule");
  rule.innerHTML = "<i></i>✦<i></i>";
  rule.setAttribute("aria-hidden","true");
  copy.append(rule,make("p","description",item.description));
  const links = make("div","course-links");
  for (const [address, label] of [
  [item.url, "Cours 1"],
  [item.url2, "Cours 2"],
  [item.url3, "Cours 3"]
])  {
    if (!address?.trim()) continue;
    const link = make("a","course",label);
    link.href = address.trim();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    links.append(link);
  }
  if (links.childElementCount) copy.append(links);
}
function refresh() {
  draw(left,"left",visible[index]);
  draw(right,"right",visible[index]);
  previous.disabled = next.disabled = visible.length < 2;
  $(".dots").replaceChildren(...visible.map((item,i) => {
    const dot = make("button","");
    dot.setAttribute("aria-label","Afficher "+item.titre+", double page "+(i+1));
    dot.setAttribute("aria-current",String(i===index));
    dot.onclick = () => navigate(i,i>index?1:-1);
    return dot;
  }));
  $("#status").textContent = visible.length ? visible[index].titre+", double page "+(index+1)+" sur "+visible.length : "Aucun cours trouvé.";
}
function listPages(kind, title, entries) {
  const limit = 5;
  const pages = [];
  const count = Math.max(1, Math.ceil(entries.length / limit));
  for (let i = 0; i < count; i++) {
    const offset = i * limit;
    pages.push({
      kind,
      titre: title,
      categorie: category,
      image: `assets/chapitres/${category}.png`,
      start: offset + 1,
      entries: entries.slice(offset, offset + limit)
    });
  }
  return pages;
}
function filter() {
  cancelAnimationFrame(frame);
  frame = 0;
  turn.replaceChildren();
  clearShadow();
  const query = normalize(search.value.trim());
  const courses = catalog.filter(item => query ? normalize(item.titre+" "+item.description).includes(query) : item.categorie===category);
if (query) {
  visible = courses;
} else {
  const resources = listPages(
    "resources",
    "Ressources complémentaires",
    resourcesByCategory[category] || []
  );

  const contents = listPages(
    "courses",
    "Cours du chapitre",
    [...courses, resources[0]]
  );

  visible = [...contents, ...courses, ...resources];
}
  document.querySelectorAll("nav button").forEach(button => button.setAttribute("aria-pressed",String(!query && button.dataset.category===category)));
  index=0;
  refresh();
}
function clearShadow() {
  for (const page of [left,right]) page.style.removeProperty("--cast");
}
function navigate(target,direction) {
  if (reader.hasAttribute("data-moving") || frame || !visible.length || index===target) return;
  const old = visible[index], incoming = visible[target];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    index=target; refresh(); return;
  }
  // La feuille est découpée en bandes jointives. Chaque bande porte une
  // fenêtre sur la même double face, pour courber aussi le texte et l’image.
  const width = left.offsetWidth, count=26, step=width/count;
  const front = make("div","page right"), back = make("div","page left");
  draw(front,"right",direction>0 ? old : incoming);
  draw(back,"left",direction>0 ? incoming : old);
  // À chaque extrémité du mouvement, la pente rejoint celle du plat sous la feuille.
  const tiltDegrees = parseFloat(getComputedStyle(turn).getPropertyValue("--opening-tilt"));
  const restingSlope = Math.tan(tiltDegrees * Math.PI / 180);
  const strips = [];
  for (let i=0; i<count; i++) {
    const strip = make("div","strip");
    strip.style.width=(step+.65)+"px";
    for (const [source,reverse] of [[front,false],[back,true]]) {
      const face = make("div",reverse?"face back":"face");
      const content = source.cloneNode(true);
      content.style.width=width+"px";
      content.style.left= -(reverse ? width-(i+1)*step : i*step)+"px";
      face.append(content); strip.append(face);
    }
    turn.append(strip); strips.push(strip);
  }
  if (direction>0) draw(right,"right",incoming); else draw(left,"left",incoming);
  const start=performance.now();
  function animate(now) {
    const elapsed=Math.min(1,(now-start)/1180);
    const eased=(1-Math.cos(Math.PI*elapsed))/2;
    const progress=direction>0 ? eased : 1-eased;
    const lift=Math.sin(Math.PI*progress);
    let x=0, z=0, y=0;
    // Le bord libre se lève en premier. La courbure traverse la feuille,
    // puis se détend progressivement quand celle-ci se pose à gauche.
    strips.forEach((strip,i) => {
      const radius=(i+.5)/count;
      const bend=1.85*lift*(radius-.42);
      const angle=Math.max(0,Math.min(Math.PI,Math.PI*progress+bend));
      const dx=Math.cos(angle), dz=Math.sin(angle);
      const dy=-restingSlope*dx*dx-.35*dz-.14*lift*radius*radius;
      // Les colonnes de la matrice décrivent la tangente à la feuille
      // et son axe vertical. Le décalage vertical incline le coin libre.
      strip.style.transform='matrix3d('+[dx,dy,dz,0,0,1,0,0,-dz,0,dx,0,x,y,z+1,1].join(',')+')';
      strip.style.setProperty("--light",(1-.24*dz+.045*lift*radius).toFixed(3));
      x+=step*dx; y+=step*dy; z+=step*dz;
    });
    for (const [page,side] of [[left,-1],[right,1]]) {
      const nearSide=(side*x>=0);
      page.style.setProperty("--cast",(lift*(nearSide ? 0.48 : 0.16)).toFixed(3));
      const location=Math.max(0,Math.min(1,side>0 ? x/width : 1+x/width));
      page.style.setProperty("--cast-x",(location*100)+"%");
    }
    if (elapsed<1) frame=requestAnimationFrame(animate);
    else {frame=0; index=target; turn.replaceChildren(); clearShadow(); refresh();}
  }
  animate(start);
}
function stepBy(direction) {
  if (visible.length>1) navigate((index+direction+visible.length)%visible.length,direction);
}
previous.onclick=()=>stepBy(-1);
next.onclick=()=>stepBy(1);
search.addEventListener("input", () => { setBookOpen(true); filter(); });
document.addEventListener("keydown",event=>{
  if (reader.dataset.open !== "true" || event.target===search || event.altKey || event.ctrlKey || event.metaKey) return;
  if (["ArrowLeft","ArrowRight"].includes(event.key)) {
    event.preventDefault(); stepBy(event.key==="ArrowLeft"?-1:1);
  }
});
function loadJson(file) {
  if (location.protocol === "file:") {
    const snapshot = JSON.parse(document.getElementById("catalogue-local").textContent);
    return Promise.resolve(snapshot[file.slice(2)]);
  }
  return fetch(file).then(response=>{
  if (!response.ok) throw Error("Catalogue indisponible");
  return response.json();
  });
}
Promise.all([loadJson("./cours.json"), loadJson("./ressources.json")]).then(([courses, resources]) => {
  catalog = courses;
  resourcesByCategory = resources;
  filter();
}).catch(()=>{
  right.append(make("div","copy","Le catalogue ne peut pas être chargé. Ouvrez le site depuis un serveur HTTP puis actualisez la page."));
  $("#status").textContent="Échec du chargement du catalogue.";
});
