// Generic renderer for single-page reference sections (Vine Cycle & Vinification, Soils).
// Data shape: { title, intro, sections: [{ id, heading, body?, subsections?: [{ heading, body, notes? }] }] }
// Renders a sticky sidebar outline (every subsection, not just top-level sections) alongside
// one continuous scrolling page, with scrollspy highlighting the section currently in view.

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function renderReferencePage(containerId, data) {
  const container = document.getElementById(containerId);
  if (!data) {
    container.innerHTML = '<p class="region-empty">Content unavailable.</p>';
    return;
  }

  const sidebarGroups = data.sections
    .map((s) => {
      const subLinks = (s.subsections || [])
        .map((sub) => {
          const id = `${s.id}--${slugifyHeading(sub.heading)}`;
          return `<a href="#${id}" class="ref-sidebar-sub" data-target="${id}">${sub.heading}</a>`;
        })
        .join('');
      return `
        <div class="ref-sidebar-group">
          <a href="#${s.id}" class="ref-sidebar-heading" data-target="${s.id}">${s.heading}</a>
          ${subLinks}
        </div>`;
    })
    .join('');

  const sections = data.sections
    .map((s) => {
      const intro = (s.body || []).map((p) => `<p>${p}</p>`).join('');
      const subsections = (s.subsections || [])
        .map((sub) => {
          const id = `${s.id}--${slugifyHeading(sub.heading)}`;
          return `
            <div id="${id}" class="ref-subsection">
              <h3>${sub.heading}</h3>
              ${(sub.body || []).map((p) => `<p>${p}</p>`).join('')}
              ${
                sub.notes && sub.notes.length
                  ? `<ul class="region-notes">${sub.notes.map((n) => `<li>${n}</li>`).join('')}</ul>`
                  : ''
              }
            </div>`;
        })
        .join('');
      return `
        <section id="${s.id}" class="ref-section">
          <h2>${s.heading}</h2>
          ${intro}
          ${subsections}
        </section>`;
    })
    .join('');

  container.innerHTML = `
    <div class="ref-page">
      <h1>${data.title}</h1>
      <p class="subtitle">${data.intro}</p>
      <div class="ref-layout">
        <nav class="ref-sidebar collapsed">
          <button type="button" class="ref-sidebar-toggle">Contents <span class="ref-sidebar-caret">&#9662;</span></button>
          <div class="ref-sidebar-list">${sidebarGroups}</div>
        </nav>
        <div class="ref-sections">${sections}</div>
      </div>
    </div>
  `;

  setupReferenceSidebar(container);
  setupScrollReveal(container);
}

function setupScrollReveal(container) {
  const items = [...container.querySelectorAll('.ref-subsection')];
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('revealed'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );
  items.forEach((el) => observer.observe(el));
}

function setupReferenceSidebar(container) {
  const sidebar = container.querySelector('.ref-sidebar');
  const toggle = container.querySelector('.ref-sidebar-toggle');
  toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  const links = [...container.querySelectorAll('.ref-sidebar-heading, .ref-sidebar-sub')];
  const targets = links
    .map((link) => ({ link, el: document.getElementById(link.dataset.target) }))
    .filter((t) => t.el);

  function update() {
    const offset = 32;
    let activeIndex = 0;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].el.getBoundingClientRect().top - offset <= 0) activeIndex = i;
      else break;
    }
    targets.forEach((t, i) => t.link.classList.toggle('active', i === activeIndex));
  }

  let ticking = false;
  window.onscroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };
  update();

  // Collapse the mobile sidebar automatically once a topic is picked.
  links.forEach((link) => {
    link.addEventListener('click', () => sidebar.classList.remove('collapsed'));
  });
}

function renderVinificationPage() {
  renderReferencePage('vinification-content', window.WSET_VINIFICATION);
}

function renderSoilsPage() {
  renderReferencePage('soils-content', window.WSET_SOILS);
}
