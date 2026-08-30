function getAllRegions() {
  return (window.WSET_REGIONS && window.WSET_REGIONS.regions) || [];
}

function groupRegions(regions) {
  const byContinent = new Map();
  for (const r of regions) {
    if (!byContinent.has(r.continent)) byContinent.set(r.continent, new Map());
    const byCountry = byContinent.get(r.continent);
    if (!byCountry.has(r.country)) byCountry.set(r.country, []);
    byCountry.get(r.country).push(r);
  }
  return byContinent;
}

function matchesQuery(region, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (region.name.toLowerCase().includes(q)) return true;
  if (region.country.toLowerCase().includes(q)) return true;
  if ((region.keyGrapes || []).some((g) => g.toLowerCase().includes(q))) return true;
  if ((region.subRegions || []).some((s) => s.name.toLowerCase().includes(q))) return true;
  return false;
}

function renderRegionsList() {
  const container = document.getElementById('region-groups');
  const searchInput = document.getElementById('region-search');

  function render() {
    const query = searchInput.value.trim();
    const regions = getAllRegions().filter((r) => matchesQuery(r, query));
    container.innerHTML = '';

    if (regions.length === 0) {
      container.innerHTML = '<p class="region-empty">No regions match your search.</p>';
      return;
    }

    const grouped = groupRegions(regions);
    const continentOrder = ['Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Asia'];
    const continents = [...grouped.keys()].sort(
      (a, b) => continentOrder.indexOf(a) - continentOrder.indexOf(b)
    );

    for (const continent of continents) {
      const section = document.createElement('div');
      section.className = 'region-continent';

      const heading = document.createElement('h2');
      heading.textContent = continent;
      section.appendChild(heading);

      const countries = [...grouped.get(continent).keys()].sort();
      for (const country of countries) {
        const countryWrap = document.createElement('div');
        countryWrap.className = 'region-country';

        const countryHeading = document.createElement('h3');
        countryHeading.textContent = country;
        countryWrap.appendChild(countryHeading);

        const grid = document.createElement('div');
        grid.className = 'region-card-grid';

        grouped
          .get(continent)
          .get(country)
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((region) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'region-card';
            card.innerHTML = `
              <div class="region-card-title">${region.name}</div>
              <div class="region-card-tag">${categoryLabel(region.category)}</div>
              <div class="region-card-grapes">${(region.keyGrapes || []).slice(0, 3).join(', ')}</div>
            `;
            card.addEventListener('click', () => openRegion(region.id));
            grid.appendChild(card);
          });

        countryWrap.appendChild(grid);
        section.appendChild(countryWrap);
      }

      container.appendChild(section);
    }
  }

  searchInput.oninput = render;
  render();
}

function categoryLabel(category) {
  if (category === 'sparkling') return 'Sparkling';
  if (category === 'fortified') return 'Fortified';
  return 'Still wine';
}

function openRegion(id) {
  const region = getAllRegions().find((r) => r.id === id);
  if (!region) return;
  renderRegionDetail(region);
  showView('region-detail');
}

function renderRegionDetail(region) {
  const container = document.getElementById('region-detail-content');
  container.innerHTML = `
    <div class="region-detail-header">
      <div class="region-detail-tag">${categoryLabel(region.category)} · ${region.country}</div>
      <h1>${region.name}</h1>
      <p class="region-summary">${region.summary}</p>
    </div>

    <div class="region-detail-grid">
      <div class="region-detail-block">
        <h3>Climate</h3>
        <p>${region.climate}</p>
      </div>
      <div class="region-detail-block">
        <h3>Soils</h3>
        <p>${region.soils}</p>
      </div>
    </div>

    <div class="region-detail-block">
      <h3>Key grape varieties</h3>
      <div class="region-grape-tags">
        ${(region.keyGrapes || []).map((g) => `<span class="grape-tag">${g}</span>`).join('')}
      </div>
    </div>

    <div class="region-detail-block">
      <h3>Classification</h3>
      <p>${region.classification}</p>
    </div>

    ${
      region.subRegions && region.subRegions.length
        ? `<div class="region-detail-block">
             <h3>Notable sub-regions</h3>
             <div class="sub-region-list">
               ${region.subRegions
                 .map((s) => `<div class="sub-region"><strong>${s.name}</strong> — ${s.notes}</div>`)
                 .join('')}
             </div>
           </div>`
        : ''
    }

    <div class="region-detail-block">
      <h3>Styles produced</h3>
      <p>${region.styles}</p>
    </div>

    ${
      region.notes && region.notes.length
        ? `<div class="region-detail-block">
             <h3>Worth knowing</h3>
             <ul class="region-notes">${region.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
           </div>`
        : ''
    }
  `;
}

document.getElementById('region-back-btn').addEventListener('click', () => {
  showView('regions-list');
});
