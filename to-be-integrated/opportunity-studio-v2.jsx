// PRISM Opportunity Studio v2 — full graph data model
// Node types: start | reviewer | join_all | join_any | conditional | end
// Edges: always | approve | reject | request_changes | condition_true | condition_false

const PRESET_FIELDS = [
  { key: 'full_name', label: 'Full Name', section: 'identity' },
  { key: 'student_id', label: 'Student ID', section: 'identity' },
  { key: 'program', label: 'Program', section: 'identity' },
  { key: 'cgpa', label: 'CGPA', section: 'academic' },
  { key: 'discipline_status', label: 'Disciplinary Status', section: 'academic' },
  { key: 'essay_sop', label: 'Statement of Purpose', section: 'documents' },
  { key: 'cv_upload', label: 'CV / Resume', section: 'documents' },
  { key: 'lor_upload', label: 'Letter of Recommendation', section: 'documents' },
  { key: 'transcript', label: 'Official Transcript', section: 'documents' },
  { key: 'language_cert', label: 'Language Proficiency Certificate', section: 'documents' },
  { key: 'financial_proof', label: 'Financial Support Proof', section: 'financial' },
  { key: 'emergency_contact', label: 'Emergency Contact', section: 'personal' },
];
const SECTION_LABELS = { identity: 'Identity', academic: 'Academic', documents: 'Documents', financial: 'Financial', personal: 'Personal' };

// ── ID helpers ──
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Graph node factories ──
function makeReviewer(x, y, idx) {
  return { id: uid(), node_type: 'reviewer', display_name: `Step ${idx}`, reviewer_email: '', reviewer_name: '', sla_hours: 72, visible_sections: ['all'], allowed_actions: ['approve','reject','request_changes','comment'], required_inputs: [], can_view_comments: false, x, y };
}
function makeJoin(type, x, y) {
  return { id: uid(), node_type: type, display_name: type === 'join_all' ? 'Join All' : 'Join Any', x, y };
}
function makeConditional(x, y) {
  return { id: uid(), node_type: 'conditional', display_name: 'Condition', condition_json: { field: '', operator: 'gte', value: '' }, x, y };
}

// ── Edge factory ──
function makeEdge(fromId, toId, action = 'always', label = '') {
  return { id: uid(), from: fromId, to: toId, action, label, condition_json: null };
}

// ── Topology helpers ──
function getAncestors(nodeId, nodes, edges) {
  const result = new Set();
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    const parents = edges.filter(e => e.to === cur).map(e => e.from);
    for (const p of parents) {
      if (!result.has(p)) { result.add(p); queue.push(p); }
    }
  }
  return result;
}

// Fields visible to a node = form fields + required_inputs from all ancestor reviewer nodes
function getUpstreamData(nodeId, nodes, edges, formFields) {
  const ancestors = getAncestors(nodeId, nodes, edges);
  const priorInputs = [];
  for (const nid of ancestors) {
    const n = nodes.find(x => x.id === nid);
    if (n?.node_type === 'reviewer' && n.required_inputs?.length) {
      for (const inp of n.required_inputs) {
        priorInputs.push({ key: `${n.id}::${inp.id}`, label: inp.label || 'Untitled', source: n.display_name || 'Prior step', sourceId: n.id });
      }
    }
  }
  return { formFields, priorInputs };
}

// ── Node type meta ──
const NODE_META = {
  start:       { color: '#11d432', bg: '#e8f9ec', label: 'Start',       icon: 'play_circle',     width: 120, height: 52 },
  reviewer:    { color: '#3b82f6', bg: '#eff6ff', label: 'Reviewer',    icon: 'person',          width: 210, height: 100 },
  join_all:    { color: '#f59e0b', bg: '#fffbeb', label: 'Join All',    icon: 'merge',           width: 140, height: 52 },
  join_any:    { color: '#f97316', bg: '#fff7ed', label: 'Join Any',    icon: 'call_merge',      width: 140, height: 52 },
  conditional: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Condition',  icon: 'device_hub',      width: 160, height: 72 },
  end:         { color: '#64748b', bg: '#f8fafc', label: 'End',         icon: 'stop_circle',     width: 120, height: 52 },
};

const ACTION_META = {
  always:          { color: '#94a3b8', label: 'always' },
  approve:         { color: '#11d432', label: 'approve ✓' },
  reject:          { color: '#ef4444', label: 'reject ✗' },
  request_changes: { color: '#f59e0b', label: 'request changes' },
  condition_true:  { color: '#8b5cf6', label: 'if true' },
  condition_false: { color: '#64748b', label: 'if false' },
};

// ── Main Studio ──
function OpportunityStudio({ onBack }) {
  const [page, setPage] = React.useState(1);
  const [animDir, setAnimDir] = React.useState('forward');
  const [visible, setVisible] = React.useState(true);

  const [oppData, setOppData] = React.useState({ code: '', title: '', description: '', destination: '', term: '', deadline: '', seats: '', status: 'published' });
  const [visibilityRules, setVisibilityRules] = React.useState([{ type: 'GROUP_EMAIL', value: '' }]);
  const [p1Errors, setP1Errors] = React.useState({});

  const [selectedFields, setSelectedFields] = React.useState(new Set(['full_name', 'student_id', 'cgpa']));
  const [customFields, setCustomFields] = React.useState([]);

  // Graph state
  const startId = React.useRef(uid()).current;
  const endId   = React.useRef(uid()).current;
  const r1Id    = React.useRef(uid()).current;
  const r2Id    = React.useRef(uid()).current;

  const [gNodes, setGNodes] = React.useState([
    { id: startId, node_type: 'start',    display_name: 'Start', x: 60,  y: 220 },
    { ...makeReviewer(240, 160, 1), id: r1Id },
    { ...makeReviewer(500, 160, 2), id: r2Id },
    { id: endId,   node_type: 'end',      display_name: 'End',   x: 760, y: 220 },
  ]);
  const [gEdges, setGEdges] = React.useState([
    makeEdge(startId, r1Id, 'always'),
    makeEdge(r1Id, r2Id, 'approve'),
    makeEdge(r2Id, endId, 'approve'),
  ]);

  const [selectedId, setSelectedId] = React.useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  function snapshot() { return { nodes: JSON.parse(JSON.stringify(gNodes)), edges: JSON.parse(JSON.stringify(gEdges)) }; }

  function pushHistory() { setHistory(h => [...h.slice(-19), snapshot()]); }

  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setGNodes(prev.nodes); setGEdges(prev.edges);
  }

  function addReviewer() {
    pushHistory();
    const maxX = gNodes.reduce((m, n) => Math.max(m, n.x), 0);
    const endNode = gNodes.find(n => n.node_type === 'end');
    const n = makeReviewer(maxX + 260, 160, gNodes.filter(n => n.node_type === 'reviewer').length + 1);
    // insert before end: rewire last edge going to end
    const lastToEnd = gEdges.filter(e => e.to === endId).slice(-1)[0];
    setGNodes(prev => {
      const others = prev.filter(nd => nd.id !== endId);
      return [...others, n, { ...endNode, x: n.x + 260 }];
    });
    setGEdges(prev => {
      const filtered = prev.filter(e => e.id !== lastToEnd?.id);
      const newEdges = [
        ...(lastToEnd ? [makeEdge(lastToEnd.from, n.id, lastToEnd.action)] : []),
        makeEdge(n.id, endId, 'approve'),
      ];
      return [...filtered, ...newEdges];
    });
    setSelectedId(n.id);
  }

  function addJoin(type) {
    pushHistory();
    const maxX = gNodes.reduce((m, n) => Math.max(m, n.x), 0);
    const endNode = gNodes.find(n => n.node_type === 'end');
    const n = makeJoin(type, maxX + 180, 220);
    const lastToEnd = gEdges.filter(e => e.to === endId).slice(-1)[0];
    setGNodes(prev => {
      const others = prev.filter(nd => nd.id !== endId);
      return [...others, n, { ...endNode, x: n.x + 200 }];
    });
    setGEdges(prev => {
      const filtered = prev.filter(e => e.id !== lastToEnd?.id);
      return [...filtered, ...(lastToEnd ? [makeEdge(lastToEnd.from, n.id, lastToEnd.action)] : []), makeEdge(n.id, endId, 'always')];
    });
    setSelectedId(n.id);
  }

  function addConditional() {
    pushHistory();
    const maxX = gNodes.reduce((m, n) => Math.max(m, n.x), 0);
    const endNode = gNodes.find(n => n.node_type === 'end');
    const cond = makeConditional(maxX + 180, 220);
    const branchA = makeReviewer(cond.x + 220, 120, gNodes.filter(n => n.node_type === 'reviewer').length + 1);
    const branchB = makeReviewer(cond.x + 220, 320, gNodes.filter(n => n.node_type === 'reviewer').length + 2);
    const lastToEnd = gEdges.filter(e => e.to === endId).slice(-1)[0];
    setGNodes(prev => {
      const others = prev.filter(nd => nd.id !== endId);
      return [...others, cond, branchA, branchB, { ...endNode, x: branchA.x + 260 }];
    });
    setGEdges(prev => {
      const filtered = prev.filter(e => e.id !== lastToEnd?.id);
      return [...filtered,
        ...(lastToEnd ? [makeEdge(lastToEnd.from, cond.id, lastToEnd.action)] : []),
        makeEdge(cond.id, branchA.id, 'condition_true'),
        makeEdge(cond.id, branchB.id, 'condition_false'),
        makeEdge(branchA.id, endId, 'approve'),
        makeEdge(branchB.id, endId, 'approve'),
      ];
    });
    setSelectedId(cond.id);
  }

  function deleteNode(id) {
    if (id === startId || id === endId) return;
    pushHistory();
    setGNodes(prev => prev.filter(n => n.id !== id));
    setGEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    setSelectedId(null);
  }

  function updateNode(id, patch) {
    setGNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }

  function updateEdge(id, patch) {
    setGEdges(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function deleteEdge(id) {
    pushHistory();
    setGEdges(prev => prev.filter(e => e.id !== id));
    setSelectedEdgeId(null);
  }

  // Add a parallel branch from a reviewer node
  function addParallelBranch(fromId) {
    pushHistory();
    const fromNode = gNodes.find(n => n.id === fromId);
    const siblings = gEdges.filter(e => e.from === fromId);
    const n = makeReviewer(fromNode.x + 220, fromNode.y + 140 * (siblings.length), gNodes.filter(n => n.node_type === 'reviewer').length + 1);
    setGNodes(prev => [...prev, n]);
    setGEdges(prev => [...prev, makeEdge(fromId, n.id, 'always')]);
    setSelectedId(n.id);
  }

  function addEdge(fromId, toId, action = 'always') {
    pushHistory();
    setGEdges(prev => [...prev, makeEdge(fromId, toId, action)]);
  }

  function handleSimSave() {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 1200);
  }

  function goTo(next) {
    if (next > page && page === 1) {
      const e = {};
      if (!oppData.code.trim()) e.code = 'Required';
      if (!oppData.title.trim()) e.title = 'Required';
      if (visibilityRules.every(r => !r.value.trim())) e.visibility = 'At least one eligible email required';
      setP1Errors(e);
      if (Object.keys(e).length) return;
    }
    setAnimDir(next > page ? 'forward' : 'back');
    setVisible(false);
    setTimeout(() => { setPage(next); setVisible(true); }, 180);
  }

  const selectedNode = gNodes.find(n => n.id === selectedId) || null;
  const selectedEdge = gEdges.find(e => e.id === selectedEdgeId) || null;

  const formFieldsList = React.useMemo(() => [
    ...Array.from(selectedFields).map(key => { const f = PRESET_FIELDS.find(p => p.key === key); return { key, label: f ? f.label : key, source: 'form' }; }),
    ...customFields.map(f => ({ key: f.id, label: f.label || 'Custom field', source: 'form' })),
  ], [selectedFields, customFields]);

  const pageLabels = ['Opportunity Details', 'Application Form', 'Approval Pipeline'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-light)', fontFamily: "'Public Sans', sans-serif" }}>
      {/* Top bar */}
      <div style={{ height: 58, background: 'white', borderBottom: '1.5px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100, flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 8 }}>
          <span className="ms" style={{ fontSize: 18 }}>arrow_back</span> Opportunities
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--slate-200)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, background: 'var(--primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 48 48" width="14" height="14" fill="white"><path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="white" fillRule="evenodd" /></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--slate-800)', letterSpacing: '-0.2px' }}>Opportunity Studio</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0 }}>
          {pageLabels.map((label, i) => {
            const num = i + 1; const active = num === page; const done = num < page;
            return (
              <React.Fragment key={i}>
                <button onClick={() => { if (done || active) goTo(num); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: active ? 'var(--primary-dim)' : 'none', border: `1.5px solid ${active ? 'var(--primary)' : 'transparent'}`, borderRadius: 999, cursor: (done || active) ? 'pointer' : 'default', outline: 'none', transition: 'all 0.15s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: active ? 'var(--primary)' : done ? 'var(--primary)' : 'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done ? <span className="ms" style={{ fontSize: 13, color: 'white' }}>check</span> : <span style={{ fontSize: 11, fontWeight: 800, color: active ? 'white' : 'var(--slate-500)' }}>{num}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--primary-dark)' : done ? 'var(--slate-600)' : 'var(--slate-400)', whiteSpace: 'nowrap' }}>{label}</span>
                </button>
                {i < 2 && <div style={{ width: 32, height: 1.5, background: done ? 'var(--primary)' : 'var(--slate-200)', margin: '0 2px', flexShrink: 0 }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: 'var(--primary-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><span className="ms" style={{ fontSize: 16 }}>check_circle</span> Saved</span>}
          {page < 3
            ? <PrismButton onClick={() => goTo(page + 1)} icon="arrow_forward" iconRight>Continue</PrismButton>
            : <PrismButton onClick={handleSimSave} icon={saving ? 'progress_activity' : 'rocket_launch'} disabled={saving}>{saving ? 'Saving…' : 'Publish'}</PrismButton>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: page === 3 ? 'hidden' : 'auto', opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : (animDir === 'forward' ? 'translateX(16px)' : 'translateX(-16px)'), transition: 'opacity 0.18s ease, transform 0.18s ease' }}>
        {page === 1 && <Page1Details oppData={oppData} setOppData={setOppData} visibilityRules={visibilityRules} setVisibilityRules={setVisibilityRules} errors={p1Errors} setErrors={setP1Errors} />}
        {page === 2 && <Page2FormBuilder selectedFields={selectedFields} setSelectedFields={setSelectedFields} customFields={customFields} setCustomFields={setCustomFields} />}
        {page === 3 && (
          <Page3Graph
            nodes={gNodes} edges={gEdges}
            selectedId={selectedId} setSelectedId={setSelectedId}
            selectedEdgeId={selectedEdgeId} setSelectedEdgeId={setSelectedEdgeId}
            selectedNode={selectedNode} selectedEdge={selectedEdge}
            updateNode={updateNode} updateEdge={updateEdge}
            deleteNode={deleteNode} deleteEdge={deleteEdge}
            addReviewer={addReviewer} addJoin={addJoin} addConditional={addConditional}
            addParallelBranch={addParallelBranch} addEdge={addEdge}
            undo={undo} history={history}
            startId={startId} endId={endId}
            formFields={formFieldsList}
          />
        )}
      </div>
    </div>
  );
}

// ── PAGE 1 ──
function Page1Details({ oppData, setOppData, visibilityRules, setVisibilityRules, errors, setErrors }) {
  function set(key, val) { setOppData(p => ({ ...p, [key]: val })); setErrors(e => ({ ...e, [key]: undefined })); }
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 60px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.5px' }}>Opportunity Details</h1>
        <p style={{ fontSize: 14, color: 'var(--slate-500)', marginTop: 6 }}>Define the opportunity's identity, metadata, and who is eligible to apply.</p>
      </div>
      <StudioSection title="Identity" icon="badge">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FieldGroup label="Opportunity Code" required error={errors.code} hint="e.g. NUS_FALL_2026">
            <PrismInput value={oppData.code} onChange={v => set('code', v.toUpperCase().replace(/\s+/g,'_'))} placeholder="NUS_FALL_2026" error={!!errors.code} />
          </FieldGroup>
          <FieldGroup label="Title" required error={errors.title}>
            <PrismInput value={oppData.title} onChange={v => set('title', v)} placeholder="NUS Summer Exchange" error={!!errors.title} />
          </FieldGroup>
          <div style={{ gridColumn: '1/-1' }}>
            <FieldGroup label="Description">
              <textarea value={oppData.description} onChange={e => set('description', e.target.value)} placeholder="Brief summary…" rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)', padding: '10px 14px', fontSize: 14, color: 'var(--slate-800)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = 'var(--slate-200)'} />
            </FieldGroup>
          </div>
        </div>
      </StudioSection>
      <StudioSection title="Logistics" icon="travel_explore">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FieldGroup label="Destination"><PrismInput value={oppData.destination} onChange={v => set('destination', v)} placeholder="Singapore" /></FieldGroup>
          <FieldGroup label="Term"><PrismInput value={oppData.term} onChange={v => set('term', v)} placeholder="Summer 2026" /></FieldGroup>
          <FieldGroup label="Application Deadline">
            <input type="date" value={oppData.deadline} onChange={e => set('deadline', e.target.value)}
              style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)', padding: '0 14px', fontSize: 14, color: 'var(--slate-800)', fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = 'var(--slate-200)'} />
          </FieldGroup>
          <FieldGroup label="Available Seats"><PrismInput value={oppData.seats} onChange={v => set('seats', v)} placeholder="10" type="number" /></FieldGroup>
        </div>
      </StudioSection>
      <StudioSection title="Eligible Applicants" icon="group" error={errors.visibility}>
        <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 16, lineHeight: 1.6 }}>Only listed emails/groups can apply. Use <code style={{ fontSize: 12, background: 'var(--slate-100)', padding: '2px 6px', borderRadius: 4 }}>ug2024@plaksha.edu.in</code> for cohort access.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibilityRules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <select value={rule.type} onChange={e => setVisibilityRules(prev => prev.map((r,j) => j===i ? {...r,type:e.target.value} : r))}
                style={{ height: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flexShrink: 0, width: 140 }}>
                <option value="GROUP_EMAIL">Group Email</option>
                <option value="EMAIL">Exact Email</option>
              </select>
              <PrismInput value={rule.value} onChange={v => setVisibilityRules(prev => prev.map((r,j) => j===i ? {...r,value:v} : r))} placeholder={rule.type === 'GROUP_EMAIL' ? 'ug2024@plaksha.edu.in' : 'student@plaksha.edu.in'} />
              <button onClick={() => setVisibilityRules(prev => prev.filter((_,j) => j!==i))} disabled={visibilityRules.length === 1}
                style={{ height: 44, width: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'white', cursor: visibilityRules.length===1 ? 'not-allowed' : 'pointer', color: 'var(--slate-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: visibilityRules.length===1 ? 0.4 : 1 }}>
                <span className="ms" style={{ fontSize: 18 }}>remove</span>
              </button>
            </div>
          ))}
          <button onClick={() => setVisibilityRules(prev => [...prev, { type: 'EMAIL', value: '' }])}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 10, border: '1.5px dashed var(--slate-300)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--slate-500)', fontFamily: 'inherit' }}>
            <span className="ms" style={{ fontSize: 16 }}>add</span> Add rule
          </button>
        </div>
      </StudioSection>
    </div>
  );
}

// ── PAGE 2 ──
function Page2FormBuilder({ selectedFields, setSelectedFields, customFields, setCustomFields }) {
  const bySection = React.useMemo(() => { const map = {}; for (const f of PRESET_FIELDS) { if (!map[f.section]) map[f.section] = []; map[f.section].push(f); } return map; }, []);
  function toggle(key) { setSelectedFields(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; }); }
  function addCustom() { setCustomFields(prev => [...prev, { id: uid(), label: '', inputType: 'text', description: '', options: '' }]); }
  function updateCustom(id, patch) { setCustomFields(prev => prev.map(f => f.id===id ? {...f,...patch} : f)); }
  function removeCustom(id) { setCustomFields(prev => prev.filter(f => f.id!==id)); }
  const total = selectedFields.size + customFields.length;
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 24px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.5px' }}>Application Form</h1>
          <p style={{ fontSize: 14, color: 'var(--slate-500)', marginTop: 6 }}>Choose which fields applicants fill in. These are visible to reviewers you grant access.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-500)', background: 'var(--slate-100)', padding: '4px 12px', borderRadius: 999 }}>{total} field{total!==1?'s':''} selected</span>
          <PrismButton variant="outline" icon="add" onClick={addCustom}>Custom Field</PrismButton>
        </div>
      </div>
      {Object.entries(bySection).map(([section, fields]) => (
        <div key={section} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{SECTION_LABELS[section]}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {fields.map(f => { const on = selectedFields.has(f.key); return (
              <button key={f.key} onClick={() => toggle(f.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${on?'var(--primary)':'var(--slate-200)'}`, background: on?'var(--primary-dim)':'white', cursor: 'pointer', outline: 'none', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: on?'var(--primary)':'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s' }}>
                  {on && <span className="ms" style={{ fontSize: 13, color: 'white' }}>check</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: on?'var(--primary-dark)':'var(--slate-700)' }}>{f.label}</span>
              </button>
            ); })}
          </div>
        </div>
      ))}
      {customFields.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Custom Fields</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {customFields.map(f => (
              <div key={f.id} style={{ background: 'white', border: '1.5px solid var(--slate-200)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr auto', gap: 10, alignItems: 'end' }}>
                  <FieldGroup label="Field Label" required><PrismInput value={f.label} onChange={v => updateCustom(f.id,{label:v})} placeholder="Field name" /></FieldGroup>
                  <FieldGroup label="Input Type">
                    <select value={f.inputType} onChange={e => updateCustom(f.id,{inputType:e.target.value})} style={{ height: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }}>
                      <option value="text">Text</option><option value="textarea">Long text</option><option value="single_select">Single select</option><option value="multiselect">Multi select</option><option value="number">Number</option>
                    </select>
                  </FieldGroup>
                  <FieldGroup label={f.inputType.includes('select') ? 'Options (comma-sep)' : 'Hint text'}><PrismInput value={f.inputType.includes('select')?f.options:f.description} onChange={v => updateCustom(f.id, f.inputType.includes('select')?{options:v}:{description:v})} placeholder={f.inputType.includes('select')?'Option A, Option B':'Guidance for applicant'} /></FieldGroup>
                  <button onClick={() => removeCustom(f.id)} style={{ height: 44, width: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'white', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="ms" style={{ fontSize: 18 }}>delete</span></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PAGE 3: Graph ──
function Page3Graph({ nodes, edges, selectedId, setSelectedId, selectedEdgeId, setSelectedEdgeId, selectedNode, selectedEdge, updateNode, updateEdge, deleteNode, deleteEdge, addReviewer, addJoin, addConditional, addParallelBranch, addEdge, undo, history, startId, endId, formFields }) {
  const canvasRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null);
  const [panOffset, setPanOffset] = React.useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState(null);
  const [zoom, setZoom] = React.useState(0.9);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const [connectFrom, setConnectFrom] = React.useState(null); // dragging edge from port
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.key === 'Tab') { e.preventDefault(); addReviewer(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteNode(selectedId); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId) { e.preventDefault(); deleteEdge(selectedEdgeId); return; }
      if (e.key === 'Escape') { setSelectedId(null); setSelectedEdgeId(null); setConnectFrom(null); return; }
      if (e.key === 'ArrowLeft' && selectedId) { e.preventDefault(); updateNode(selectedId, { x: Math.max(0, (nodes.find(n=>n.id===selectedId)?.x||0) - 20) }); return; }
      if (e.key === 'ArrowRight' && selectedId) { e.preventDefault(); updateNode(selectedId, { x: (nodes.find(n=>n.id===selectedId)?.x||0) + 20 }); return; }
      if (e.key === 'ArrowUp' && selectedId) { e.preventDefault(); updateNode(selectedId, { y: Math.max(0, (nodes.find(n=>n.id===selectedId)?.y||0) - 20) }); return; }
      if (e.key === 'ArrowDown' && selectedId) { e.preventDefault(); updateNode(selectedId, { y: (nodes.find(n=>n.id===selectedId)?.y||0) + 20 }); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedEdgeId, nodes]);

  // Node drag
  function onNodeMouseDown(e, nodeId) {
    e.stopPropagation();
    setSelectedId(nodeId); setSelectedEdgeId(null);
    const node = nodes.find(n => n.id === nodeId);
    setDrag({ nodeId, sx: e.clientX, sy: e.clientY, nx: node.x, ny: node.y });
  }
  React.useEffect(() => {
    if (!drag) return;
    function onMove(e) {
      const dx = (e.clientX - drag.sx) / zoom, dy = (e.clientY - drag.sy) / zoom;
      updateNode(drag.nodeId, { x: Math.max(0, drag.nx + dx), y: Math.max(0, drag.ny + dy) });
    }
    function onUp() { setDrag(null); }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, zoom]);

  // Canvas pan
  function onCanvasMD(e) {
    if (e.target === canvasRef.current || e.target.dataset.canvasBg) {
      setSelectedId(null); setSelectedEdgeId(null); setConnectFrom(null);
      setIsPanning(true); setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }
  React.useEffect(() => {
    if (!isPanning) return;
    function onMove(e) { setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); }
    function onUp() { setIsPanning(false); }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isPanning, panStart]);

  function onWheel(e) { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(2, z - e.deltaY * 0.001))); }

  // Track mouse for connecting edge ghost
  function onCanvasMouseMove(e) {
    if (!connectFrom) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left - panOffset.x) / zoom, y: (e.clientY - rect.top - panOffset.y) / zoom });
  }

  // Connect port click
  function onPortClick(e, nodeId, portType) {
    e.stopPropagation();
    if (!connectFrom) {
      setConnectFrom({ nodeId, portType });
    } else {
      if (connectFrom.nodeId !== nodeId) {
        // determine action
        const fromNode = nodes.find(n => n.id === connectFrom.nodeId);
        let action = 'always';
        if (fromNode?.node_type === 'reviewer') action = 'approve';
        if (fromNode?.node_type === 'conditional') action = 'condition_true';
        addEdge(connectFrom.nodeId, nodeId, action);
      }
      setConnectFrom(null);
    }
  }

  // Node center port
  function nodeCenter(n) {
    const meta = NODE_META[n.node_type] || NODE_META.reviewer;
    return { cx: n.x + meta.width / 2, cy: n.y + meta.height / 2 };
  }
  function nodeRight(n) {
    const meta = NODE_META[n.node_type] || NODE_META.reviewer;
    return { x: n.x + meta.width, y: n.y + meta.height / 2 };
  }
  function nodeLeft(n) {
    const meta = NODE_META[n.node_type] || NODE_META.reviewer;
    return { x: n.x, y: n.y + meta.height / 2 };
  }

  // Edge path
  function edgePath(e) {
    const from = nodes.find(n => n.id === e.from);
    const to   = nodes.find(n => n.id === e.to);
    if (!from || !to) return '';
    const p1 = nodeRight(from), p2 = nodeLeft(to);
    const mx = (p1.x + p2.x) / 2;
    return `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
  }

  // Ghost edge path while connecting
  function ghostPath() {
    const from = nodes.find(n => n.id === connectFrom?.nodeId);
    if (!from) return '';
    const p1 = nodeRight(from);
    return `M${p1.x},${p1.y} C${(p1.x + mousePos.x)/2},${p1.y} ${(p1.x + mousePos.x)/2},${mousePos.y} ${mousePos.x},${mousePos.y}`;
  }

  // Edge midpoint for label
  function edgeMid(e) {
    const from = nodes.find(n => n.id === e.from);
    const to   = nodes.find(n => n.id === e.to);
    if (!from || !to) return { x: 0, y: 0 };
    const p1 = nodeRight(from), p2 = nodeLeft(to);
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 - 12 };
  }

  const reviewerCount = nodes.filter(n => n.node_type === 'reviewer').length;
  const nodeCount     = nodes.filter(n => n.node_type !== 'start' && n.node_type !== 'end').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : connectFrom ? 'crosshair' : 'default', background: '#f8fafc' }}
        ref={canvasRef} onMouseDown={onCanvasMD} onWheel={onWheel} onMouseMove={onCanvasMouseMove}>
        {/* Dot grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="dotgrid" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform={`translate(${panOffset.x%28},${panOffset.y%28}) scale(${zoom})`}>
              <circle cx="14" cy="14" r="1" fill="#dde3ec" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotgrid)" data-canvas-bg="1" />
        </svg>

        {/* Toolbar */}
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 480 }}>
          <ToolGroup label="Add">
            <CanvasToolBtn icon="person_add" label="Add Reviewer (Tab)" onClick={addReviewer} />
            <CanvasToolBtn icon="merge" label="Add Join All" onClick={() => addJoin('join_all')} />
            <CanvasToolBtn icon="call_merge" label="Add Join Any" onClick={() => addJoin('join_any')} />
            <CanvasToolBtn icon="device_hub" label="Add Condition" onClick={addConditional} />
          </ToolGroup>
          <ToolGroup label="View">
            <CanvasToolBtn icon="undo" label={`Undo (⌘Z) ×${history.length}`} onClick={undo} disabled={!history.length} />
            <CanvasToolBtn icon="zoom_in" label="Zoom in" onClick={() => setZoom(z => Math.min(2, z+0.12))} />
            <CanvasToolBtn icon="zoom_out" label="Zoom out" onClick={() => setZoom(z => Math.max(0.3, z-0.12))} />
            <CanvasToolBtn icon="fit_screen" label="Reset view" onClick={() => { setZoom(0.9); setPanOffset({x:40,y:40}); }} />
            <CanvasToolBtn icon="keyboard" label="Shortcuts" onClick={() => setShowShortcuts(s=>!s)} active={showShortcuts} />
          </ToolGroup>
        </div>

        {/* Stats */}
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, display: 'flex', gap: 8 }}>
          <StatPill label="Steps" value={nodeCount} />
          <StatPill label="Reviewers" value={reviewerCount} />
          <StatPill label="Edges" value={edges.length} />
          {connectFrom && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#8b5cf6', color: 'white', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              <span className="ms" style={{ fontSize: 14 }}>cable</span> Click a node to connect
            </div>
          )}
        </div>

        {/* Shortcuts panel */}
        {showShortcuts && (
          <div style={{ position: 'absolute', top: 64, left: 14, zIndex: 30, background: 'white', border: '1.5px solid var(--slate-200)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: 280 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Keyboard Shortcuts</div>
            {[['Tab','Add reviewer'],['Delete / ⌫','Remove selected'],['⌘Z / Ctrl+Z','Undo'],['← → ↑ ↓','Move node'],['Escape','Deselect / cancel'],['Scroll','Zoom'],['Drag canvas','Pan']].map(([k,d]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--slate-100)' }}>
                <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{d}</span>
                <kbd style={{ fontSize: 11, background: 'var(--slate-100)', border: '1px solid var(--slate-300)', borderRadius: 6, padding: '2px 7px', fontFamily: 'monospace', color: 'var(--slate-700)', whiteSpace: 'nowrap' }}>{k}</kbd>
              </div>
            ))}
          </div>
        )}

        {/* Transform layer */}
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${panOffset.x}px,${panOffset.y}px) scale(${zoom})` }}>
          {/* SVG edges */}
          <svg style={{ position: 'absolute', inset: 0, width: 4000, height: 2000, overflow: 'visible', pointerEvents: 'none' }}>
            <defs>
              {Object.entries(ACTION_META).map(([action, meta]) => (
                <marker key={action} id={`arrow-${action}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={meta.color} />
                </marker>
              ))}
            </defs>
            {edges.map(e => {
              const path = edgePath(e);
              if (!path) return null;
              const mid = edgeMid(e);
              const meta = ACTION_META[e.action] || ACTION_META.always;
              const sel = e.id === selectedEdgeId;
              return (
                <g key={e.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSelectedId(null); }}>
                  {/* Hit area */}
                  <path d={path} stroke="transparent" strokeWidth="12" fill="none" />
                  {/* Visible path */}
                  <path d={path} stroke={sel ? '#8b5cf6' : meta.color} strokeWidth={sel ? 2.5 : 2} fill="none"
                    strokeDasharray={e.action === 'always' ? 'none' : '6 3'}
                    markerEnd={`url(#arrow-${e.action})`}
                    style={{ transition: 'stroke 0.12s' }} />
                  {/* Edge label */}
                  {e.action !== 'always' && (
                    <foreignObject x={mid.x - 50} y={mid.y - 11} width="100" height="22" style={{ pointerEvents: 'none' }}>
                      <div style={{ background: sel ? '#8b5cf620' : meta.color + '18', border: `1px solid ${meta.color}40`, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: meta.color, textAlign: 'center', fontFamily: 'Public Sans', whiteSpace: 'nowrap' }}>
                        {e.label || meta.label}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {/* Ghost edge */}
            {connectFrom && (
              <path d={ghostPath()} stroke="#8b5cf6" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.7" />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map(node => (
            <GraphNode
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onMouseDown={e => onNodeMouseDown(e, node.id)}
              onPortClick={onPortClick}
              connectFrom={connectFrom}
              isFixed={node.id === startId || node.id === endId}
              onAddParallel={addParallelBranch}
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: (selectedNode || selectedEdge) ? 340 : 0, flexShrink: 0, background: 'white', borderLeft: '1.5px solid var(--slate-200)', overflow: 'hidden', transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
        {selectedNode && selectedNode.node_type === 'reviewer' && (
          <ReviewerPanel node={selectedNode} updateNode={updateNode} deleteNode={deleteNode} formFields={formFields} nodes={nodes} edges={edges} onClose={() => setSelectedId(null)} />
        )}
        {selectedNode && selectedNode.node_type === 'conditional' && (
          <ConditionalPanel node={selectedNode} updateNode={updateNode} deleteNode={deleteNode} formFields={formFields} nodes={nodes} edges={edges} onClose={() => setSelectedId(null)} />
        )}
        {selectedNode && (selectedNode.node_type === 'join_all' || selectedNode.node_type === 'join_any') && (
          <JoinPanel node={selectedNode} updateNode={updateNode} deleteNode={deleteNode} onClose={() => setSelectedId(null)} />
        )}
        {selectedNode && (selectedNode.node_type === 'start' || selectedNode.node_type === 'end') && (
          <FixedNodePanel node={selectedNode} onClose={() => setSelectedId(null)} />
        )}
        {selectedEdge && !selectedNode && (
          <EdgePanel edge={selectedEdge} updateEdge={updateEdge} deleteEdge={deleteEdge} nodes={nodes} onClose={() => setSelectedEdgeId(null)} />
        )}
      </div>
    </div>
  );
}

// ── Graph Node ──
function GraphNode({ node, selected, onMouseDown, onPortClick, connectFrom, isFixed, onAddParallel }) {
  const meta = NODE_META[node.node_type] || NODE_META.reviewer;
  const isConnecting = !!connectFrom;
  const isConnectTarget = isConnecting && connectFrom?.nodeId !== node.id;

  return (
    <div onMouseDown={onMouseDown} style={{ position: 'absolute', left: node.x, top: node.y, width: meta.width, userSelect: 'none', cursor: isFixed ? 'default' : 'grab' }}>
      {/* Input port (left) */}
      {node.node_type !== 'start' && (
        <div onClick={e => onPortClick(e, node.id, 'in')}
          style={{ position: 'absolute', left: -8, top: meta.height/2 - 8, width: 16, height: 16, borderRadius: '50%', background: isConnectTarget ? meta.color : 'white', border: `2px solid ${meta.color}`, cursor: 'pointer', zIndex: 5, transition: 'background 0.12s', boxShadow: isConnectTarget ? `0 0 0 3px ${meta.color}30` : 'none' }} />
      )}
      {/* Node card */}
      <div style={{ background: 'white', border: `2px solid ${selected ? meta.color : isConnectTarget ? meta.color + '80' : 'var(--slate-200)'}`, borderRadius: 14, boxShadow: selected ? `0 0 0 4px ${meta.color}20, 0 6px 24px rgba(0,0,0,0.1)` : '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.12s', overflow: 'hidden', height: meta.height }}>
        {/* Header */}
        <div style={{ padding: '8px 12px', background: selected ? meta.bg : 'var(--slate-50)', borderBottom: node.node_type === 'reviewer' ? '1.5px solid var(--slate-100)' : 'none', display: 'flex', alignItems: 'center', gap: 7, height: node.node_type === 'reviewer' ? 42 : meta.height }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: selected ? meta.color : meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="ms" style={{ fontSize: 15, color: selected ? 'white' : meta.color }}>{meta.icon}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: selected ? meta.color : 'var(--slate-700)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.display_name || meta.label}</span>
          {selected && !isFixed && (
            <div style={{ display: 'flex', gap: 2 }}>
              {node.node_type === 'reviewer' && (
                <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onAddParallel(node.id);}} title="Add parallel branch"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: meta.color, padding: 2, display: 'flex', alignItems: 'center' }}>
                  <span className="ms" style={{ fontSize: 14 }}>fork_right</span>
                </button>
              )}
            </div>
          )}
        </div>
        {/* Body (reviewer only) */}
        {node.node_type === 'reviewer' && (
          <div style={{ padding: '6px 12px 8px' }}>
            {node.reviewer_email
              ? <div style={{ fontSize: 11, color: 'var(--slate-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.reviewer_email}</div>
              : <div style={{ fontSize: 11, color: 'var(--slate-400)', fontStyle: 'italic' }}>No reviewer set</div>}
            <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
              <ChipBadge color="#3b82f6">{node.sla_hours||72}h</ChipBadge>
              {node.visible_sections?.length > 0 && node.visible_sections[0] !== 'all' && <ChipBadge color="#11d432">{node.visible_sections.length} section{node.visible_sections.length!==1?'s':''}</ChipBadge>}
              {node.required_inputs?.length > 0 && <ChipBadge color="#8b5cf6">{node.required_inputs.length} input{node.required_inputs.length!==1?'s':''}</ChipBadge>}
            </div>
          </div>
        )}
        {/* Conditional body */}
        {node.node_type === 'conditional' && (
          <div style={{ padding: '4px 12px 8px' }}>
            <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.condition_json?.field ? `if ${node.condition_json.field} ${node.condition_json.operator} ${node.condition_json.value}` : 'Set condition →'}
            </div>
          </div>
        )}
      </div>
      {/* Output port (right) */}
      {node.node_type !== 'end' && (
        <div onClick={e => onPortClick(e, node.id, 'out')}
          style={{ position: 'absolute', right: -8, top: meta.height/2 - 8, width: 16, height: 16, borderRadius: '50%', background: connectFrom?.nodeId === node.id ? meta.color : 'white', border: `2px solid ${meta.color}`, cursor: 'pointer', zIndex: 5, transition: 'background 0.12s', boxShadow: connectFrom?.nodeId === node.id ? `0 0 0 3px ${meta.color}30` : 'none' }} />
      )}
    </div>
  );
}

// ── Reviewer Config Panel ──
function ReviewerPanel({ node, updateNode, deleteNode, formFields, nodes, edges, onClose }) {
  function set(k, v) { updateNode(node.id, { [k]: v }); }
  function addInput() { set('required_inputs', [...(node.required_inputs||[]), { id: uid(), label: '', input_type: 'text', required: true, options: '' }]); }
  function updateInput(id, patch) { set('required_inputs', (node.required_inputs||[]).map(i => i.id===id ? {...i,...patch} : i)); }
  function removeInput(id) { set('required_inputs', (node.required_inputs||[]).filter(i => i.id!==id)); }

  // Fields this reviewer can see: applicant form fields + required_inputs from upstream reviewers
  const { formFields: ff, priorInputs } = React.useMemo(() => getUpstreamData(node.id, nodes, edges, formFields), [node.id, nodes, edges, formFields]);

  function toggleSection(key) {
    const cur = node.visible_sections || ['all'];
    if (cur.includes('all')) { set('visible_sections', [key]); return; }
    const next = cur.includes(key) ? cur.filter(k=>k!==key) : [...cur, key];
    set('visible_sections', next.length === 0 ? ['all'] : next);
  }
  function toggleAction(a) {
    const cur = node.allowed_actions || ['approve','reject','request_changes','comment'];
    const next = cur.includes(a) ? cur.filter(k=>k!==a) : [...cur, a];
    set('allowed_actions', next);
  }

  const allSections = ['all', ...Object.keys(SECTION_LABELS)];
  const allActions  = ['approve', 'reject', 'request_changes', 'comment'];

  return (
    <PanelShell title="Reviewer Step" subtitle={node.display_name} onClose={onClose} onDelete={() => deleteNode(node.id)}>
      <PanelField label="Step Name"><PrismInput value={node.display_name||''} onChange={v=>set('display_name',v)} placeholder="e.g. HOD Approval" /></PanelField>
      <PanelField label="Reviewer Email"><PrismInput value={node.reviewer_email||''} onChange={v=>set('reviewer_email',v)} placeholder="reviewer@plaksha.edu.in" /></PanelField>
      <PanelField label="Reviewer Name / Role"><PrismInput value={node.reviewer_name||''} onChange={v=>set('reviewer_name',v)} placeholder="e.g. Dr. Sharma, HOD" /></PanelField>
      <PanelField label="SLA (hours)">
        <input type="number" min={1} value={node.sla_hours||72} onChange={e=>set('sla_hours',Number(e.target.value)||1)}
          style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)', padding: '0 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--slate-200)'} />
      </PanelField>

      {/* Visible sections */}
      <PanelField label="Visible Form Sections">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {allSections.map(s => {
            const on = (node.visible_sections||['all']).includes(s);
            return <ChipToggle key={s} label={s === 'all' ? 'All sections' : SECTION_LABELS[s]} on={on} onClick={() => toggleSection(s)} />;
          })}
        </div>
      </PanelField>

      {/* Prior step data visible to this reviewer */}
      {priorInputs.length > 0 && (
        <PanelField label="Data from Prior Steps" hint="Automatically visible">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {priorInputs.map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'var(--slate-50)', borderRadius: 8, border: '1px solid var(--slate-200)' }}>
                <span className="ms" style={{ fontSize: 13, color: '#8b5cf6' }}>data_object</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--slate-400)' }}>from {p.source}</div>
                </div>
              </div>
            ))}
          </div>
        </PanelField>
      )}

      {/* Allowed actions */}
      <PanelField label="Allowed Actions">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {allActions.map(a => {
            const on = (node.allowed_actions||['approve','reject','request_changes','comment']).includes(a);
            const color = a==='approve'?'#11d432':a==='reject'?'#ef4444':a==='request_changes'?'#f59e0b':'#64748b';
            return <ChipToggle key={a} label={a.replace('_',' ')} on={on} color={color} onClick={() => toggleAction(a)} />;
          })}
        </div>
      </PanelField>

      {/* Can view comments */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--slate-50)', borderRadius: 10, border: '1.5px solid var(--slate-200)', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>Can view all comments</span>
        <ToggleRow label="" checked={node.can_view_comments||false} onChange={v=>set('can_view_comments',v)} />
      </div>

      {/* Required inputs */}
      <PanelField label="Required Inputs" action={<button onClick={addInput} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:'var(--primary-dark)',fontFamily:'inherit',display:'flex',alignItems:'center',gap:3 }}><span className="ms" style={{fontSize:14}}>add</span>Add</button>}>
        {(node.required_inputs||[]).length === 0
          ? <p style={{ fontSize:12,color:'var(--slate-400)',fontStyle:'italic',marginBottom:8 }}>No inputs required from this reviewer.</p>
          : (node.required_inputs||[]).map(inp => (
            <div key={inp.id} style={{ background:'var(--slate-50)',border:'1.5px solid var(--slate-200)',borderRadius:10,padding:10,marginBottom:8 }}>
              <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:6 }}>
                <PrismInput value={inp.label} onChange={v=>updateInput(inp.id,{label:v})} placeholder="Input label" />
                <button onClick={()=>removeInput(inp.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',display:'flex',alignItems:'center',flexShrink:0}}><span className="ms" style={{fontSize:16}}>close</span></button>
              </div>
              <div style={{ display:'flex',gap:6 }}>
                <select value={inp.input_type} onChange={e=>updateInput(inp.id,{input_type:e.target.value})} style={{flex:1,height:36,borderRadius:8,border:'1.5px solid var(--slate-200)',background:'white',padding:'0 8px',fontSize:12,fontFamily:'inherit',outline:'none'}}>
                  <option value="text">Text</option><option value="number">Number</option><option value="select">Select</option><option value="checkbox">Checkbox</option>
                </select>
                <label style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'var(--slate-600)',cursor:'pointer'}}>
                  <input type="checkbox" checked={inp.required} onChange={e=>updateInput(inp.id,{required:e.target.checked})} />Required
                </label>
              </div>
              {inp.input_type === 'select' && (
                <input style={{marginTop:6,width:'100%',height:36,borderRadius:8,border:'1.5px solid var(--slate-200)',background:'white',padding:'0 8px',fontSize:12,fontFamily:'inherit',outline:'none'}}
                  value={inp.options||''} onChange={e=>updateInput(inp.id,{options:e.target.value})} placeholder="Option A, Option B" />
              )}
            </div>
          ))
        }
      </PanelField>
    </PanelShell>
  );
}

// ── Conditional Config Panel ──
function ConditionalPanel({ node, updateNode, deleteNode, formFields, nodes, edges, onClose }) {
  function set(k, v) { updateNode(node.id, { [k]: v }); }
  function setCond(k, v) { updateNode(node.id, { condition_json: { ...(node.condition_json||{}), [k]: v } }); }

  const { formFields: ff, priorInputs } = React.useMemo(() => getUpstreamData(node.id, nodes, edges, formFields), [node.id, nodes, edges, formFields]);
  const allFields = [...ff.map(f=>({key:f.key,label:f.label})), ...priorInputs.map(p=>({key:p.key,label:`${p.label} (${p.source})`}))];
  const cond = node.condition_json || { field: '', operator: 'gte', value: '' };

  return (
    <PanelShell title="Condition" subtitle={node.display_name} onClose={onClose} onDelete={() => deleteNode(node.id)}>
      <PanelField label="Node Name"><PrismInput value={node.display_name||''} onChange={v=>set('display_name',v)} placeholder="e.g. CGPA Check" /></PanelField>
      <PanelField label="Evaluate Field">
        <select value={cond.field} onChange={e=>setCond('field',e.target.value)} style={{width:'100%',height:44,borderRadius:10,border:'1.5px solid var(--slate-200)',background:'var(--slate-50)',padding:'0 12px',fontSize:13,fontFamily:'inherit',outline:'none'}}>
          <option value="">Select a field…</option>
          {allFields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </PanelField>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
        <PanelField label="Operator">
          <select value={cond.operator} onChange={e=>setCond('operator',e.target.value)} style={{width:'100%',height:44,borderRadius:10,border:'1.5px solid var(--slate-200)',background:'var(--slate-50)',padding:'0 10px',fontSize:13,fontFamily:'inherit',outline:'none'}}>
            <option value="gte">≥ (gte)</option><option value="lte">≤ (lte)</option><option value="eq">= (equals)</option><option value="neq">≠ (not equals)</option><option value="contains">contains</option>
          </select>
        </PanelField>
        <PanelField label="Value"><PrismInput value={cond.value} onChange={v=>setCond('value',v)} placeholder="e.g. 7.5" /></PanelField>
      </div>
      <div style={{ padding:'10px 12px',background:'#f5f3ff',borderRadius:10,border:'1px solid #8b5cf620',marginBottom:14 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'#8b5cf6',marginBottom:4 }}>Preview</div>
        <div style={{ fontSize:13,color:'var(--slate-700)',fontFamily:'monospace' }}>
          if <strong>{cond.field||'field'}</strong> {cond.operator||'gte'} <strong>{cond.value||'value'}</strong>
        </div>
        <div style={{ display:'flex',gap:8,marginTop:8 }}>
          <span style={{fontSize:11,background:'#8b5cf620',color:'#8b5cf6',border:'1px solid #8b5cf640',borderRadius:6,padding:'2px 8px',fontWeight:700}}>→ true branch</span>
          <span style={{fontSize:11,background:'#64748b20',color:'#64748b',border:'1px solid #64748b40',borderRadius:6,padding:'2px 8px',fontWeight:700}}>→ false branch</span>
        </div>
      </div>
    </PanelShell>
  );
}

// ── Join Panel ──
function JoinPanel({ node, updateNode, deleteNode, onClose }) {
  const meta = NODE_META[node.node_type];
  return (
    <PanelShell title={node.node_type === 'join_all' ? 'Join All' : 'Join Any'} subtitle={node.display_name} onClose={onClose} onDelete={() => deleteNode(node.id)}>
      <div style={{ padding:'12px 14px',background:meta.bg,borderRadius:12,border:`1px solid ${meta.color}30`,marginBottom:16 }}>
        <span className="ms" style={{fontSize:18,color:meta.color,display:'block',marginBottom:6}}>{meta.icon}</span>
        <div style={{ fontSize:13,color:'var(--slate-700)',lineHeight:1.6 }}>
          {node.node_type === 'join_all'
            ? 'Waits for ALL incoming branches to complete before advancing to the next step.'
            : 'Advances as soon as ANY ONE incoming branch completes. Remaining branches are cancelled.'}
        </div>
      </div>
      <PanelField label="Display Name"><PrismInput value={node.display_name||''} onChange={v=>updateNode(node.id,{display_name:v})} placeholder={node.node_type==='join_all'?'Join All':'Join Any'} /></PanelField>
    </PanelShell>
  );
}

// ── Fixed Node Panel ──
function FixedNodePanel({ node, onClose }) {
  const meta = NODE_META[node.node_type];
  return (
    <PanelShell title={node.node_type === 'start' ? 'Start' : 'End'} subtitle={node.node_type === 'start' ? 'Entry point' : 'Terminal'} onClose={onClose}>
      <div style={{ padding:'12px 14px',background:meta.bg,borderRadius:12,border:`1px solid ${meta.color}30` }}>
        <span className="ms" style={{fontSize:18,color:meta.color,display:'block',marginBottom:6}}>{meta.icon}</span>
        <div style={{ fontSize:13,color:'var(--slate-700)',lineHeight:1.6 }}>
          {node.node_type === 'start' ? 'The entry point of this workflow. Triggered when a student submits their application. Cannot be deleted.' : 'The terminal node. Reached when the application is fully approved. Cannot be deleted.'}
        </div>
      </div>
    </PanelShell>
  );
}

// ── Edge Config Panel ──
function EdgePanel({ edge, updateEdge, deleteEdge, nodes, onClose }) {
  const fromNode = nodes.find(n => n.id === edge.from);
  const toNode   = nodes.find(n => n.id === edge.to);
  const meta = ACTION_META[edge.action] || ACTION_META.always;

  const actionsForFromType = () => {
    if (!fromNode) return ['always'];
    if (fromNode.node_type === 'reviewer') return ['approve','reject','request_changes','always'];
    if (fromNode.node_type === 'conditional') return ['condition_true','condition_false'];
    return ['always'];
  };

  return (
    <PanelShell title="Edge" subtitle={`${fromNode?.display_name||'?'} → ${toNode?.display_name||'?'}`} onClose={onClose} onDelete={() => deleteEdge(edge.id)}>
      <div style={{ padding:'10px 12px',background:meta.color+'15',borderRadius:10,border:`1px solid ${meta.color}30`,marginBottom:14,display:'flex',alignItems:'center',gap:10 }}>
        <div style={{ width:10,height:10,borderRadius:'50%',background:meta.color,flexShrink:0 }} />
        <span style={{ fontSize:13,fontWeight:700,color:meta.color }}>{meta.label}</span>
      </div>
      <PanelField label="Action / Condition">
        <select value={edge.action} onChange={e=>updateEdge(edge.id,{action:e.target.value})} style={{width:'100%',height:44,borderRadius:10,border:'1.5px solid var(--slate-200)',background:'var(--slate-50)',padding:'0 12px',fontSize:13,fontFamily:'inherit',outline:'none'}}>
          {actionsForFromType().map(a => <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>)}
        </select>
      </PanelField>
      <PanelField label="Custom Label (optional)">
        <PrismInput value={edge.label||''} onChange={v=>updateEdge(edge.id,{label:v})} placeholder="e.g. CGPA ≥ 7.5" />
      </PanelField>
      <div style={{ fontSize:12,color:'var(--slate-400)',lineHeight:1.5,marginTop:4 }}>
        Tip: Use custom labels to annotate conditional edges with readable predicates.
      </div>
    </PanelShell>
  );
}

// ── Panel Shell ──
function PanelShell({ title, subtitle, onClose, onDelete, children }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%' }}>
      <div style={{ padding:'14px 16px',borderBottom:'1.5px solid var(--slate-100)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
        <div>
          <div style={{ fontSize:11,fontWeight:700,color:'var(--slate-400)',textTransform:'uppercase',letterSpacing:'0.07em' }}>{title}</div>
          {subtitle && <div style={{ fontSize:15,fontWeight:800,color:'var(--slate-900)',letterSpacing:'-0.2px' }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background:'var(--slate-100)',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <span className="ms" style={{fontSize:16,color:'var(--slate-500)'}}>close</span>
        </button>
      </div>
      <div style={{ flex:1,overflow:'auto',padding:'16px' }}>{children}</div>
      {onDelete && (
        <div style={{ padding:'10px 16px',borderTop:'1.5px solid var(--slate-100)',flexShrink:0 }}>
          <button onClick={onDelete} style={{ width:'100%',height:36,borderRadius:10,border:'1.5px solid #fca5a5',background:'#fff5f5',cursor:'pointer',fontSize:13,fontWeight:700,color:'#ef4444',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
            <span className="ms" style={{fontSize:15}}>delete</span> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Panel Field ──
function PanelField({ label, hint, action, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5 }}>
        <label style={{ fontSize:11,fontWeight:700,color:'var(--slate-500)',textTransform:'uppercase',letterSpacing:'0.07em' }}>
          {label}{hint && <span style={{fontWeight:400,color:'var(--slate-400)',textTransform:'none',letterSpacing:'normal'}}> — {hint}</span>}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Chip Toggle ──
function ChipToggle({ label, on, onClick, color }) {
  const c = color || 'var(--primary-dark)';
  return (
    <button onClick={onClick} style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,border:`1.5px solid ${on?c:'var(--slate-200)'}`,background:on?c+'18':'white',color:on?c:'var(--slate-500)',cursor:'pointer',transition:'all 0.12s',fontFamily:'inherit' }}>
      {label}
    </button>
  );
}

// ── Tool Group ──
function ToolGroup({ label, children }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:4,background:'white',border:'1.5px solid var(--slate-200)',borderRadius:12,padding:'4px 8px',boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize:9,fontWeight:800,color:'var(--slate-400)',textTransform:'uppercase',letterSpacing:'0.07em',marginRight:2 }}>{label}</span>
      {children}
    </div>
  );
}

// ── Stat Pill ──
function StatPill({ label, value }) {
  return (
    <div style={{ background:'white',border:'1.5px solid var(--slate-200)',borderRadius:999,padding:'4px 12px',fontSize:12,fontWeight:700,color:'var(--slate-600)',boxShadow:'0 1px 4px rgba(0,0,0,0.05)',display:'flex',gap:5,alignItems:'center' }}>
      <span style={{ color:'var(--slate-400)',fontWeight:500 }}>{label}</span>
      <span style={{ color:'var(--slate-900)' }}>{value}</span>
    </div>
  );
}

// ── Shared helpers ──
function StudioSection({ title, icon, children, error }) {
  return (
    <div style={{ background:'white',borderRadius:18,border:`1.5px solid ${error?'#fca5a5':'var(--slate-200)'}`,padding:'22px 24px',marginBottom:20,boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:18 }}>
        <span className="ms" style={{ color:'var(--primary-dark)',fontSize:18 }}>{icon}</span>
        <h3 style={{ fontSize:15,fontWeight:800,color:'var(--slate-800)',letterSpacing:'-0.2px' }}>{title}</h3>
      </div>
      {error && <p style={{ fontSize:13,color:'#ef4444',marginBottom:12,fontWeight:500 }}>{error}</p>}
      {children}
    </div>
  );
}

function CanvasToolBtn({ icon, label, onClick, disabled, active }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={label} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ width:32,height:32,borderRadius:8,cursor:disabled?'not-allowed':'pointer',border:'none',background:active?'var(--primary-dim)':hover?'var(--slate-100)':'none',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.1s',opacity:disabled?0.4:1,outline:'none' }}>
      <span className="ms" style={{fontSize:17,color:active?'var(--primary)':'var(--slate-600)'}}>{icon}</span>
    </button>
  );
}

function ChipBadge({ children, color }) {
  return <span style={{ fontSize:10,fontWeight:700,color:color,background:color+'18',border:`1px solid ${color}30`,borderRadius:6,padding:'1px 5px',whiteSpace:'nowrap' }}>{children}</span>;
}

Object.assign(window, { OpportunityStudio });
