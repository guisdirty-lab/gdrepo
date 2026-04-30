(async function () {
  const data = await d3.json('lowtowns_political_map_MASTER_v046.json');

  const width = document.getElementById('graphWrap').clientWidth;
  const height = document.getElementById('graphWrap').clientHeight;

  const svg = d3.select('#graph')
    .attr('viewBox', `0 0 ${width} ${height}`);

  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 14)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#7f93bf');

  const typeSet = new Set(data.nodes.map(n => n.type || 'unknown'));
  const typeFilter = document.getElementById('typeFilter');
  [...typeSet].sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });

  const color = d3.scaleOrdinal(d3.schemeTableau10)
    .domain([...typeSet]);

  const normalizeStrength = s => {
    const n = Number(s);
    if (Number.isFinite(n)) return Math.max(1, Math.min(5, n));
    const map = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    return map[String(s).toLowerCase()] || 2;
  };

  const nodes = data.nodes.map(d => ({ ...d }));
  const links = data.links.map(d => ({ ...d, strengthNum: normalizeStrength(d.strength) }));

  const g = svg.append('g');
  const linkLayer = g.append('g');
  const nodeLayer = g.append('g');
  const labelLayer = g.append('g');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => 120 - d.strengthNum * 15).strength(0.2))
    .force('charge', d3.forceManyBody().strength(-230))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => 6 + (Number(d.power) || 2) * 2));

  const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', (ev) => g.attr('transform', ev.transform));
  svg.call(zoom);

  let searchText = '';
  let selectedType = 'all';
  let minStrength = 1;

  const details = document.getElementById('detailsContent');
  const minStrengthValue = document.getElementById('minStrengthValue');

  function filtered() {
    const activeNodes = nodes.filter(n => {
      const matchType = selectedType === 'all' || (n.type || 'unknown') === selectedType;
      const matchSearch = !searchText || (n.name || '').toLowerCase().includes(searchText);
      return matchType && matchSearch;
    });
    const ids = new Set(activeNodes.map(n => n.id));
    const activeLinks = links.filter(l => l.strengthNum >= minStrength && ids.has(l.source.id || l.source) && ids.has(l.target.id || l.target));
    return { activeNodes, activeLinks };
  }

  function render() {
    const { activeNodes, activeLinks } = filtered();

    const linkSel = linkLayer.selectAll('line').data(activeLinks, d => d.id);
    linkSel.exit().remove();
    linkSel.enter().append('line').attr('class', 'link')
      .merge(linkSel)
      .attr('stroke-width', d => 0.6 + d.strengthNum * 0.6)
      .attr('marker-end', d => (d.direction && d.direction !== 'mutual' ? 'url(#arrow)' : null));

    const nodeSel = nodeLayer.selectAll('circle').data(activeNodes, d => d.id);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append('circle').attr('class', 'node')
      .attr('r', d => 5 + (Number(d.power) || 2) * 1.5)
      .attr('fill', d => color(d.type || 'unknown'))
      .call(d3.drag()
        .on('start', (ev, d) => {
          if (!ev.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => {
          if (!ev.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }))
      .on('click', (_, d) => {
        details.innerHTML = `
          <strong>${d.name || d.id}</strong><br>
          <small>Type: ${d.type || 'unknown'}</small><br><br>
          <div><strong>Goal:</strong> ${d.primary_goal || '—'}</div>
          <div><strong>Fear:</strong> ${d.primary_fear || '—'}</div>
          <div><strong>Public Face:</strong> ${d.public_face || '—'}</div>
          <div><strong>Actual Function:</strong> ${d.actual_function || '—'}</div>
          <div><strong>Notes:</strong> ${d.notes || '—'}</div>
        `;
      });
    nodeEnter.merge(nodeSel);

    const labelSel = labelLayer.selectAll('text').data(activeNodes, d => d.id);
    labelSel.exit().remove();
    labelSel.enter().append('text').attr('class', 'node-label')
      .text(d => d.name || d.id)
      .merge(labelSel);

    simulation.nodes(activeNodes);
    simulation.force('link').links(activeLinks);
    simulation.alpha(0.6).restart();

    simulation.on('tick', () => {
      linkLayer.selectAll('line')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeLayer.selectAll('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labelLayer.selectAll('text')
        .attr('x', d => d.x + 8)
        .attr('y', d => d.y + 3);
    });
  }

  document.getElementById('search').addEventListener('input', (e) => {
    searchText = e.target.value.trim().toLowerCase();
    render();
  });

  typeFilter.addEventListener('change', (e) => {
    selectedType = e.target.value;
    render();
  });

  document.getElementById('minStrength').addEventListener('input', (e) => {
    minStrength = Number(e.target.value);
    minStrengthValue.textContent = String(minStrength);
    render();
  });

  render();
})();
