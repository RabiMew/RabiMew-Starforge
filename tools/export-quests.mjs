// Generates pack/config/ftbquests/quests/** from design + localization sources.
// Sources: design/content.json (+ progression via tools/lib/design.mjs),
//          design/semantic-map.json, localization/*.json
// Format contract: docs/questbook.md (FTB Quests 2101.1.36 SNBT + lang/<locale>.snbt).
// Usage: node tools/export-quests.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hexId } from './lib/hexid.mjs';
import { loadDesign } from './lib/design.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const j = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const design = loadDesign(root);
const content = design;
const sm = design.sm;
const locales = { zh_cn: j('localization/zh_cn.json'), en_us: j('localization/en_us.json') };
const stages = new Map(design.stages.map((s) => [s.id, s]));

const outDir = path.join(root, 'pack', 'config', 'ftbquests', 'quests');
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

const out = (rel, data) => {
  const f = path.join(outDir, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, data);
};

// ---------- semantic / literal id resolution ----------
const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
function itemId(ref, ctx) {
  const v = sm.items[ref] ?? (ID_RE.test(ref) ? ref : null);
  if (!v) throw new Error(`${ctx}: unresolvable item ref ${ref}`);
  return v;
}
function dimId(ref, ctx) {
  const v = sm.dimensions[ref] ?? (ID_RE.test(ref) ? ref : null);
  if (!v) throw new Error(`${ctx}: unresolvable dimension ref ${ref}`);
  return v;
}
// Icons accept either a plain ref or { id, components } — the component map is
// written verbatim into the FTB item SNBT (e.g. TACZ gunpack blocks need a
// BlockId custom_data tag to resolve their display name).
function iconObj(ref, ctx) {
  if (typeof ref === 'string') return { id: itemId(ref, ctx) };
  const o = { id: itemId(ref.id, ctx) };
  if (ref.components) o.components = ref.components;
  return o;
}

// ---------- SNBT writer (FTB dialect: no commas, tab indent) ----------
const D = (v) => ({ __d: v });
function esc(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function key(k) { return /^[A-Za-z0-9_.-]+$/.test(k) ? k : `"${esc(k)}"`; }
function snbt(v, ind = '') {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : `${v}d`;
  if (v && typeof v === 'object' && '__d' in v) return `${v.__d}d`;
  if (typeof v === 'string') return `"${esc(v)}"`;
  if (Array.isArray(v)) {
    if (!v.length) return '[ ]';
    return `[\n${v.map((e) => ind + '\t' + snbt(e, ind + '\t')).join('\n')}\n${ind}]`;
  }
  const entries = Object.entries(v).filter(([, x]) => x !== undefined && x !== null);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${ind}\t${key(k)}: ${snbt(x, ind + '\t')}`).join('\n')}\n${ind}}`;
}
const file = (obj) => snbt(obj) + '\n';

// ---------- quest text ----------
const fmt = (loc, keyVal, arg) => keyVal.replace('%1$s', arg);
function descLines(loc, q) {
  const dict = locales[loc];
  const lines = [dict[q.description_key] ?? q.id];
  if (q.manual_refs?.length) lines.push('');
  for (const ref of q.manual_refs ?? []) {
    const title = dict[`modpack.tutorial.${ref}.title`];
    if (!title) throw new Error(`${q.id}: manual ref ${ref} has no title in ${loc}`);
    const text = fmt(loc, dict[content.questbook.manual_link_key] ?? '» %1$s', title);
    const pageId = hexId('quest', `manual/${ref}`);
    lines.push(JSON.stringify({
      text, color: 'aqua', italic: false,
      clickEvent: { action: 'change_page', value: pageId },
      hoverEvent: { action: 'show_text', value: title },
    }));
  }
  return lines;
}

// ---------- tasks ----------
function taskObj(q, t, idx, pathBase) {
  const id = hexId('task', `${pathBase}/${idx}`);
  switch (t.type) {
    case 'item': {
      const item = { count: 1, id: itemId(t.target, q.id) };
      if (t.components) item.components = t.components;
      return { id, type: 'item', item, count: t.count ?? 1, consume_items: false };
    }
    case 'checkmark':
      return { id, type: 'checkmark' };
    case 'stage':
      // ProgressiveStages supplies the stage provider; the task auto-completes
      // when the team owns the stage. The questbook records the milestone —
      // it never grants it (team_stage = the FTB-team scope PS uses).
      return { id, type: 'gamestage', stage: `${content.namespace}:${t.stage}`, team_stage: true };
    case 'dimension':
      return { id, type: 'dimension', dimension: dimId(t.target, q.id) };
    case 'advancement':
      return { id, type: 'advancement', advancement: t.target, criterion: '' };
    case 'kill':
      return t.target.startsWith('#')
        ? { id, type: 'kill', entityTypeTag: t.target.slice(1), value: t.count ?? 1 }
        : { id, type: 'kill', entity: t.target, value: t.count ?? 1 };
    case 'biome':
      return { id, type: 'biome', biome: t.target };
    case 'structure':
      return { id, type: 'structure', structure: t.target };
    default:
      throw new Error(`${q.id}: unknown task type ${t.type}`);
  }
}

// ---------- rewards ----------
function rewardObj(q, r, idx, pathBase) {
  // ItemReward stores the amount inside the item stack (unlike ItemTask's
  // separate top-level count field).
  const item = { count: r.count, id: itemId(r.item, q.id) };
  if (r.components) item.components = r.components;
  // reward pool stamp: the milestone_reward_pack open handler reads
  // custom_data.reward_pool to pick its loot table (see starforge_rewards.js).
  if (r.pool) {
    const components = item.components ?? (item.components = {});
    components['minecraft:custom_data'] = { ...(components['minecraft:custom_data'] ?? {}), reward_pool: r.pool };
  }
  return {
    id: hexId('reward', `${pathBase}/${idx}`),
    type: 'item',
    item,
    team_reward: r.scope === 'team',
  };
}

// ---------- layout ----------
const DEPTH_X = 3.2, ROW_Y = 1.5, GROUP_X = 4.0;
// Tidy tree: depth -> x, DFS leaf order -> y, parents centered on children.
// deps edges become FTB dependencies (flexible mode: progress freely, complete in order).
function layoutTree(quests) {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const children = new Map(quests.map((q) => [q.id, []]));
  const depth = new Map();
  const getDepth = (q, seen = new Set()) => {
    if (depth.has(q.id)) return depth.get(q.id);
    if (seen.has(q.id)) throw new Error(`deps cycle at ${q.id}`);
    seen.add(q.id);
    const d = Math.max(0, ...(q.deps ?? []).map((p) => 1 + getDepth(byId.get(p), seen)));
    depth.set(q.id, d);
    return d;
  };
  for (const q of quests) {
    getDepth(q);
    for (const p of q.deps ?? []) {
      if (!byId.has(p)) throw new Error(`${q.id}: dep ${p} not in chapter`);
      children.get(p).push(q);
    }
  }
  // Pre-order DFS assigns each node a unique row: parents sit above their
  // children, merge nodes are placed once. Collision-free by construction.
  // Children are visited biggest-reachable-subtree first so the spine reads on top.
  const reach = new Map();
  const getReach = (q, seen = new Set()) => {
    if (reach.has(q.id)) return reach.get(q.id);
    const s = new Set();
    for (const k of children.get(q.id)) {
      s.add(k.id);
      for (const d of getReach(k)) s.add(d);
    }
    reach.set(q.id, s);
    return s;
  };
  for (const q of quests) getReach(q);
  for (const kids of children.values()) {
    kids.sort((a, b) => reach.get(b.id).size - reach.get(a.id).size);
  }
  const pos = new Map();
  let slot = 0;
  const visit = (q) => {
    if (pos.has(q.id)) return;
    pos.set(q.id, { x: depth.get(q.id) * DEPTH_X, y: slot++ * ROW_Y });
    for (const k of children.get(q.id)) visit(k);
  };
  for (const q of quests) if (!(q.deps ?? []).length) visit(q);
  for (const q of quests) visit(q); // stragglers (every dep target exists, so none expected)
  const r1 = (v) => Math.round(v * 10) / 10;
  return quests.map((q) => ({ q, x: D(r1(pos.get(q.id).x)), y: D(r1(pos.get(q.id).y)) }));
}

function layoutGroups(pages) {
  const groupOrder = [...new Set(pages.map((p) => p.group))];
  const rows = new Map();
  return pages.map((p) => {
    const g = groupOrder.indexOf(p.group);
    const y = (rows.get(p.group) ?? 0) * ROW_Y;
    rows.set(p.group, (rows.get(p.group) ?? 0) + 1);
    return { q: p, x: D(g * GROUP_X), y: D(y) };
  });
}

// ---------- quest objects ----------
function questObj(q, chapterId, pos) {
  const pathBase = `${chapterId}/${q.path_id ?? q.id}`;
  const tasks = (q.tasks ?? (q.task ? [q.task] : [])).map((t, i) => taskObj(q, t, i, pathBase));
  if (!tasks.length) throw new Error(`${q.id}: no task`);
  const rewards = (q.rewards ?? []).map((r, i) => rewardObj(q, r, i, pathBase));
  const obj = {
    icon: iconObj(q.icon, q.id),
    id: hexId('quest', pathBase),
    x: pos.x, y: pos.y,
  };
  if (q.deps?.length) {
    obj.dependencies = q.deps.map((p) => hexId('quest', `${chapterId}/${p}`));
  }
  if (q.shape) obj.shape = q.shape;
  if (q.size !== undefined) obj.size = D(q.size);
  if (q.optional) obj.optional = true;
  if (q.min_width) obj.min_width = q.min_width;
  if (q.tags) obj.tags = q.tags;
  if (q.required_stage) obj.required_stage = `${content.namespace}:${q.required_stage}`;
  if (rewards.length) obj.rewards = rewards;
  obj.tasks = tasks;
  return obj;
}

// Manual pages are quests synthesized from tutorials (checkmark, optional).
const manualPages = content.tutorials.map((t) => ({
  id: `manual_${t.id}`,
  path_id: t.id,
  tutorial: t.id,
  title_key: t.title_key,
  description_key: t.text_key,
  subtitle_key: `modpack.tutorial.group.${t.group}`,
  task: { type: 'checkmark' },
  icon: 'ftbquests:book',
  group: t.group,
  optional: true,
  min_width: 360,
  shape: 'rsquare',
  rewards: [],
}));

// ---------- emit chapters ----------
const lang = { zh_cn: {}, en_us: {} };
const fileId = hexId('file', 'starforge');
for (const loc of Object.keys(locales)) {
  lang[loc][`file.${fileId}.title`] = locales[loc][content.questbook.title_key];
}

const chapters = [...content.chapters].sort((a, b) => a.order - b.order);
for (const ch of chapters) {
  const chapterQuests = content.quests.filter((q) => (q.chapter ?? q.route) === ch.id);
  let positioned;
  if (ch.id === 'manual') positioned = layoutGroups(manualPages);
  else positioned = layoutTree(chapterQuests);

  const quests = positioned.map(({ q, x, y }) => {
    const obj = questObj(q, ch.id, { x, y });
    const qid = obj.id;
    for (const loc of Object.keys(locales)) {
      const dict = locales[loc];
      lang[loc][`quest.${qid}.title`] = dict[q.title_key] ?? q.id;
      lang[loc][`quest.${qid}.quest_desc`] = descLines(loc, q);
      if (q.subtitle_key) {
        lang[loc][`quest.${qid}.quest_subtitle`] = dict[q.subtitle_key] ?? q.subtitle_key;
      } else if (q.suggested_stage) {
        const stageName = dict[stages.get(q.suggested_stage).name_key] ?? q.suggested_stage;
        lang[loc][`quest.${qid}.quest_subtitle`] = fmt(loc, dict[content.questbook.stage_hint_key] ?? '%1$s', stageName);
      }
    }
    return obj;
  });

  out(`chapters/${ch.id}.snbt`, file({
    default_hide_dependency_lines: false,
    default_quest_shape: '',
    filename: ch.id,
    group: '',
    icon: iconObj(ch.icon, `chapter ${ch.id}`),
    id: hexId('chapter', ch.id),
    images: [],
    order_index: ch.order,
    progression_mode: 'flexible',
    quest_links: [],
    quests,
  }));

  for (const loc of Object.keys(locales)) {
    const dict = locales[loc];
    const cid = hexId('chapter', ch.id);
    lang[loc][`chapter.${cid}.title`] = dict[ch.title_key] ?? ch.id;
    lang[loc][`chapter.${cid}.chapter_subtitle`] = [dict[ch.description_key] ?? ''];
  }
}

// ---------- root files ----------
out('data.snbt', file({ id: fileId }));
out('chapter_groups.snbt', file({ chapter_groups: [] }));
for (const loc of Object.keys(locales)) {
  out(`lang/${loc}.snbt`, file(lang[loc]));
}

const nQuests = content.quests.length + manualPages.length;
const nRewards = content.quests.reduce((s, q) => s + (q.rewards?.length ?? 0), 0);
console.log(`export-quests: ${chapters.length} chapters, ${nQuests} quest nodes (${manualPages.length} manual pages), ${nRewards} rewards`);
console.log(`  -> ${path.relative(root, outDir)}`);
