function getAllGrapes() {
  return (window.WSET_GRAPES && window.WSET_GRAPES.grapes) || [];
}

function groupGrapesByColor(grapes) {
  const byColor = new Map();
  for (const g of grapes) {
    if (!byColor.has(g.color)) byColor.set(g.color, []);
    byColor.get(g.color).push(g);
  }
  return byColor;
}

function matchesGrapeQuery(grape, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (grape.name.toLowerCase().includes(q)) return true;
  if ((grape.synonyms || []).some((s) => s.toLowerCase().includes(q))) return true;
  if ((grape.keyRegions || []).some((r) => r.toLowerCase().includes(q))) return true;
  if (grape.origin.toLowerCase().includes(q)) return true;
  return false;
}

function grapeColorLabel(color) {
  return color === 'red' ? 'Red' : 'White';
}

function renderGrapesList() {
  const container = document.getElementById('grape-groups');
  const searchInput = document.getElementById('grape-search');

  function render() {
    const query = searchInput.value.trim();
    const grapes = getAllGrapes().filter((g) => matchesGrapeQuery(g, query));
    container.innerHTML = '';

    if (grapes.length === 0) {
      container.innerHTML = '<p class="region-empty">No grape varieties match your search.</p>';
      return;
    }

    const grouped = groupGrapesByColor(grapes);
    const colorOrder = ['white', 'red'];
    const colors = [...grouped.keys()].sort(
      (a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b)
    );

    for (const color of colors) {
      const section = document.createElement('div');
      section.className = 'region-continent';

      const heading = document.createElement('h2');
      heading.textContent = `${grapeColorLabel(color)} grapes`;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'region-card-grid';

      grouped
        .get(color)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((grape) => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'region-card';
          card.innerHTML = `
            <div class="region-card-title">${grape.name}</div>
            <div class="region-card-tag">${grapeColorLabel(grape.color)}</div>
            <div class="region-card-grapes">${(grape.keyRegions || []).slice(0, 2).join(', ')}</div>
          `;
          card.addEventListener('click', () => openGrape(grape.id));
          grid.appendChild(card);
        });

      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  searchInput.oninput = render;
  render();
}

function openGrape(id) {
  const grape = getAllGrapes().find((g) => g.id === id);
  if (!grape) return;
  renderGrapeDetail(grape);
  showView('grape-detail');
}

function renderGrapeDetail(grape) {
  const container = document.getElementById('grape-detail-content');
  container.innerHTML = `
    <div class="region-detail-header">
      <div class="region-detail-tag">${grapeColorLabel(grape.color)} grape · ${grape.origin}</div>
      <h1>${grape.name}</h1>
      ${
        grape.synonyms && grape.synonyms.length
          ? `<div class="region-grape-tags">${grape.synonyms.map((s) => `<span class="grape-tag">${s}</span>`).join('')}</div>`
          : ''
      }
      <p class="region-summary">${grape.summary}</p>
    </div>

    <div class="region-detail-block">
      <h3>Viticulture</h3>
      <p>${grape.viticulture}</p>
    </div>

    <div class="region-detail-block">
      <h3>Characteristics in the glass</h3>
      <p>${grape.characteristics}</p>
    </div>

    <div class="region-detail-block">
      <h3>Winemaking</h3>
      <p>${grape.winemaking}</p>
    </div>

    <div class="region-detail-block">
      <h3>Key regions</h3>
      <div class="region-grape-tags">
        ${(grape.keyRegions || []).map((r) => `<span class="grape-tag">${r}</span>`).join('')}
      </div>
    </div>

    ${
      grape.notableStyles && grape.notableStyles.length
        ? `<div class="region-detail-block">
             <h3>Notable styles</h3>
             <div class="sub-region-list">
               ${grape.notableStyles
                 .map((s) => `<div class="sub-region"><strong>${s.name}</strong> — ${s.notes}</div>`)
                 .join('')}
             </div>
           </div>`
        : ''
    }

    ${
      grape.notes && grape.notes.length
        ? `<div class="region-detail-block">
             <h3>Worth knowing</h3>
             <ul class="region-notes">${grape.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
           </div>`
        : ''
    }
  `;
}

document.getElementById('grape-back-btn').addEventListener('click', () => {
  showView('grapes-list');
});
