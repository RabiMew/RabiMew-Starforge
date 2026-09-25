import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hexId } from './lib/hexid.mjs';
import { loadDesign, allNodes } from './lib/design.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const parse = (name) => JSON.parse(read(name));
const keyPattern = /^modpack\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;
const has = (obj, key) => Object.hasOwn(obj, key);

function uniqueIds(rows, category) {
  assert(Array.isArray(rows), `${category}: expected an array`);
  const ids = new Set();
  for (const row of rows) {
    assert(/^[a-z][a-z0-9_]*$/.test(row.id), `${category}: invalid id`);
    assert(!ids.has(row.id), `${category}: duplicate id ${row.id}`);
    ids.add(row.id);
  }
  return ids;
}

function placeholders(text) {
  const tokens = text.match(/%(?:\d+\$s|%)/g) ?? [];
  assert(!text.replace(/%(?:\d+\$s|%)/g, '').includes('%'),
    `Unsupported placeholder in: ${text}`);
  return tokens.sort();
}

function validate() {
  const design = loadDesign(root);
  const content = design;
  assert.equal(content.schema_version, 1);
  assert.equal(content.status, 'design_only');
  assert.equal(content.game_version, '1.21.1');
  assert.equal(content.loader, 'neoforge');
  assert.equal(content.namespace, 'modpack');

  const locales = {};
  for (const locale of ['zh_cn', 'en_us']) {
    const name = `localization/${locale}.json`;
    const raw = read(name);
    const data = parse(name);
    // Locale files are intentionally flat; catch duplicate keys before JSON.parse hides them.
    const rawKeys = [...raw.matchAll(/^\s*"((?:\\.|[^"\\])+)"\s*:/gm)]
      .map((match) => JSON.parse(`"${match[1]}"`));
    assert.equal(new Set(rawKeys).size, rawKeys.length, `${name}: duplicate keys`);
    assert.equal(rawKeys.length, Object.keys(data).length, `${name}: expected a flat object`);
    for (const [key, value] of Object.entries(data)) {
      assert(keyPattern.test(key), `${name}: invalid key ${key}`);
      assert(typeof value === 'string' && value.trim(), `${name}: empty value ${key}`);
      assert(!value.includes('\uFFFD'), `${name}: invalid text encoding ${key}`);
      placeholders(value);
    }
    locales[locale] = data;
  }
  const keys = Object.keys(locales.zh_cn).sort();
  assert.deepEqual(keys, Object.keys(locales.en_us).sort(), 'Locale key sets differ');
  for (const key of keys) {
    assert.deepEqual(placeholders(locales.zh_cn[key]), placeholders(locales.en_us[key]),
      `Placeholder mismatch: ${key}`);
  }

  const referenced = new Set();
  const psMarker = /<ps:([a-z0-9_]+)>/g;
  function collect(value, location = 'content') {
    if (typeof value === 'string') {
      // <ps:name> markers resolve to modpack.ps.<name> at render time
      // (progressivestages.messages -> [messages] config -> compat mixin).
      for (const m of value.matchAll(psMarker)) {
        const key = `modpack.ps.${m[1]}`;
        assert(has(locales.zh_cn, key), `Missing translation: ${key}`);
        referenced.add(key);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((item, i) => collect(item, `${location}[${i}]`));
    if (!value || typeof value !== 'object') return;
    for (const [field, item] of Object.entries(value)) {
      assert(!['title', 'name', 'description', 'text', 'tooltip', 'warning'].includes(field),
        `${location}.${field}: display text must use a language key`);
      if (field.endsWith('_key')) {
        assert(typeof item === 'string' && keyPattern.test(item), `${location}.${field}: invalid key`);
        assert(has(locales.zh_cn, item), `Missing translation: ${item}`);
        referenced.add(item);
      } else collect(item, `${location}.${field}`);
    }
  }
  collect(design);
  assert.deepEqual([...referenced].sort(), keys, 'Unused or unreferenced translation keys');

  const stageIds = uniqueIds(design.stages, 'stages');
  const abilityIds = uniqueIds(design.abilities, 'abilities');
  const categoryIds = uniqueIds(design.categories, 'categories');
  const routeIds = uniqueIds(content.routes, 'routes');
  const chapterIds = uniqueIds(content.chapters, 'chapters');
  const questIds = uniqueIds(content.quests, 'quests');
  const tutorialIds = uniqueIds(content.tutorials, 'tutorials');
  const groupIds = uniqueIds(content.tutorial_groups, 'tutorial_groups');
  const advancementIds = uniqueIds(design.advancements, 'advancements');
  for (const category of ['items', 'jobs', 'planets', 'messages', 'gui', 'bosses']) {
    uniqueIds(content[category], category);
  }
  assert.equal(stageIds.size, 8, 'Expected T0 through T7');
  assert.deepEqual(design.stages.map((stage) => stage.tier).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(routeIds.size, 7);
  assert.equal(chapterIds.size, 10, 'Expected milestones + onboarding + 7 routes + manual');
  assert.equal(questIds.size, 123);
  assert.equal(content.planets.length, 8);
  const stages = new Map(design.stages.map((stage) => [stage.id, stage]));
  const tierOf = (id) => stages.get(id).tier;
  // Every node on the progression map (eras + abilities). Stages are
  // milestones only — nothing gates gameplay; abilities may depend on
  // anything, eras on eras only.
  const nodeIds = new Set([...stageIds, ...abilityIds]);
  const nodes = new Map(allNodes(design).map((n) => [n.id, n]));
  for (const ab of design.abilities) assert(!stageIds.has(ab.id), `${ab.id}: ability id collides with an era stage`);
  assert.equal(nodeIds.size, 30, 'Expected 8 era + 22 ability nodes');

  // ---------- chapters ----------
  const sm = parse('design/semantic-map.json');
  const tiers = parse('design/tech-tiers.json');
  const regItems = new Set(parse('registry-export/items.json'));
  const regDims = new Set(parse('registry-export/dimensions.json'));
  const regEnts = new Set(parse('registry-export/entity_types.json'));
  const regEntTags = new Set(Object.keys(parse('registry-export/tags_entity.json')));
  const ownItems = new Set(content.items.map((i) => `${content.namespace}:${i.id}`));
  const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
  // Semantic key or literal ns:path -> resolved id, verified against the
  // registry export; own kubejs items are validated against content.items.
  const itemRef = (ref) => {
    const key = ref && typeof ref === 'object' ? ref.id : ref; // icons may be { id, components }
    const id = sm.items[key] ?? (ID_RE.test(key) ? key : null);
    return id && (regItems.has(id) || ownItems.has(id)) ? id : null;
  };
  const dimRef = (ref) => {
    const id = sm.dimensions[ref] ?? (ID_RE.test(ref) ? ref : null);
    return id && regDims.has(id) ? id : null;
  };
  // item semantic key -> era id where it is expected to become affordable
  // (tech-tiers.json is design metadata only — nothing is hard-locked at runtime)
  const tierAt = {};
  for (const [stage, tier] of Object.entries(tiers)) {
    for (const key of tier.items ?? []) assert(!tierAt[key], `${key}: listed in two tiers`);
    for (const key of tier.items ?? []) tierAt[key] = stage;
  }
  const availableBy = (ref, stageId, ctx) => {
    if (!tierAt[ref]) return; // literal or unlisted refs cannot be checked offline
    assert(tierOf(tierAt[ref]) <= tierOf(stageId),
      `${ctx}: ${ref} sits at tier ${tierAt[ref]}, later than suggested stage ${stageId}`);
  };

  const orders = new Set();
  for (const ch of content.chapters) {
    assert(!orders.has(ch.order), `chapter ${ch.id}: duplicate order ${ch.order}`);
    orders.add(ch.order);
    assert(itemRef(ch.icon), `chapter ${ch.id}: unresolvable icon ${ch.icon}`);
  }
  for (const route of content.routes) {
    assert(chapterIds.has(route.id), `route ${route.id}: no matching chapter`);
  }
  assert(content.questbook && keyPattern.test(content.questbook.title_key), 'questbook meta missing');

  function ancestors(id, visiting = new Set()) {
    assert(stageIds.has(id), `Unknown stage ${id}`);
    assert(!visiting.has(id), `Stage dependency cycle at ${id}`);
    const next = new Set([...visiting, id]);
    const result = new Set();
    for (const dependency of stages.get(id).depends_on) {
      result.add(dependency);
      for (const ancestor of ancestors(dependency, next)) result.add(ancestor);
    }
    return result;
  }
  for (const stage of design.stages) {
    const prior = ancestors(stage.id);
    assert.equal(stage.requires_space, false, `${stage.id}: space gate is not permitted`);
    assert.equal(stage.requires_boss, false, `${stage.id}: boss gate is not permitted`);
    assert.equal(new Set(stage.depends_on).size, stage.depends_on.length);
    for (const d of stage.depends_on) {
      assert(stageIds.has(d), `${stage.id}: era dep ${d} must be an era stage, not an ability`);
    }
    assert(categoryIds.has(stage.category), `${stage.id}: unknown map category ${stage.category}`);
    for (const r of stage.recommended_routes ?? []) {
      assert(routeIds.has(r), `${stage.id}: unknown recommended route ${r}`);
    }
    for (const p of stage.unlock_preview ?? []) {
      for (const v of p.verify ?? []) {
        assert(itemRef(v) || dimRef(v), `${stage.id}: unverifiable unlock-preview ref ${v}`);
      }
    }
    if (stage.tier === 0) {
      assert.equal(stage.depends_on.length, 0);
      assert.equal(stage.unlock_evidence.type, 'automatic');
    } else {
      assert(prior.has('survival_age'), `${stage.id}: no survival bootstrap`);
      assert.equal(stage.unlock_evidence.type, 'server_verified_production');
      assert(stage.unlock_evidence.component, `${stage.id}: no unlock component`);
      assert(prior.has(stage.unlock_evidence.available_in),
        `${stage.id}: unlock component is not available before unlock`);
    }
  }
  assert(!ancestors('quantum_age').has('space_age'), 'Earth quantum route depends on space');
  assert(!ancestors('space_age').has('quantum_age'), 'Space bootstrap depends on quantum technology');
  // Tier tables only ever attach to era stages — abilities carry no tiering.
  for (const k of Object.keys(tiers)) {
    if (k === 'schema_version' || k === 'comment') continue;
    assert(stageIds.has(k), `tech-tiers: ${k} is not an era stage`);
  }

  // ---------- ability nodes (capability branches of the same map) ----------
  // Full-graph acyclic check (abilities may depend on eras and abilities).
  const nodeAncestors = (id, visiting = new Set()) => {
    assert(nodeIds.has(id), `Unknown progression node ${id}`);
    assert(!visiting.has(id), `Progression dependency cycle at ${id}`);
    const next = new Set([...visiting, id]);
    const out = new Set();
    for (const d of nodes.get(id).depends_on ?? []) {
      out.add(d);
      for (const a of nodeAncestors(d, next)) out.add(a);
    }
    return out;
  };
  const COND_TYPES = new Set(['craft', 'pickup', 'dimension', 'custom_counter', 'has_item']);
  const FRAMES = new Set(['task', 'goal', 'challenge']);
  const REVEALS = new Set(['always', 'dependencies', 'unlocked']);
  const regItemTags = new Set(Object.keys(parse('registry-export/tags_item.json')));
  const regBlockTags = new Set(Object.keys(parse('registry-export/tags_block.json')));
  for (const ab of design.abilities) {
    assert(categoryIds.has(ab.category), `${ab.id}: unknown map category ${ab.category}`);
    nodeAncestors(ab.id);
    for (const d of ab.depends_on) assert(nodeIds.has(d), `${ab.id}: unknown dep ${d}`);
    assert(FRAMES.has(ab.frame ?? 'task'), `${ab.id}: bad frame`);
    assert(REVEALS.has(ab.reveal ?? 'dependencies'), `${ab.id}: bad reveal`);
    const t = ab.trigger;
    assert(t?.conditions?.length >= 1, `${ab.id}: ability needs >=1 trigger condition`);
    if (t.mode) assert(['any_of', 'all_of'].includes(t.mode), `${ab.id}: bad trigger mode ${t.mode}`);
    for (const c of t.conditions) {
      assert(COND_TYPES.has(c.type), `${ab.id}: unsupported trigger condition ${c.type}`);
      if (c.count !== undefined) assert(Number.isInteger(c.count) && c.count >= 1, `${ab.id}: bad count`);
      if (c.type === 'craft' || c.type === 'pickup' || c.type === 'has_item') {
        if (c.item.startsWith('#')) assert(regItemTags.has(c.item.slice(1)), `${ab.id}: unknown item tag ${c.item}`);
        else assert(itemRef(c.item), `${ab.id}: unresolvable trigger item ${c.item}`);
      } else if (c.type === 'dimension') {
        assert(dimRef(c.dimension), `${ab.id}: unresolvable trigger dimension ${c.dimension}`);
      } else if (c.type === 'custom_counter') {
        assert(/^modpack:[a-z0-9_]+$/.test(c.counter), `${ab.id}: counter must be modpack:*`);
      }
    }
  }

  for (const route of content.routes) {
    assert.equal(route.always_visible, true);
    assert(content.quests.filter((quest) => quest.route === route.id).length >= 4,
      `${route.id}: routes need at least 4 quests`);
  }

  // ---------- questbook: tasks, rewards, layout, manual refs ----------
  const TASK_TYPES = new Set(['item', 'checkmark', 'advancement', 'dimension', 'kill', 'biome', 'structure', 'stage']);
  const keybindIds = new Set(parse('design/keybinds.json').ids);
  const advTargets = new Set(design.advancements.map((a) => `starforge:${a.id}`));
  const chapterOf = (q) => q.chapter ?? q.route;
  const generatedIds = new Set([hexId('file', 'starforge')]);
  const claim = (id, ctx) => { assert(!generatedIds.has(id), `${ctx}: generated id collision ${id}`); generatedIds.add(id); };
  for (const ch of content.chapters) claim(hexId('chapter', ch.id), `chapter ${ch.id}`);

  for (const quest of content.quests) {
    const chId = chapterOf(quest);
    assert(chapterIds.has(chId), `${quest.id}: unknown chapter/route ${chId}`);
    if (quest.route) assert(routeIds.has(quest.route), `${quest.id}: unknown route`);
    if (quest.chapter && quest.route) assert.equal(quest.chapter, quest.route,
      `${quest.id}: chapter and route disagree`);
    assert(stageIds.has(quest.suggested_stage), `${quest.id}: unknown suggested stage`);
    assert.deepEqual(quest.depends_on, [], `${quest.id}: baseline quests must remain parallel`);
    assert.equal(quest.grants_stage, false, `${quest.id}: quests must not grant technology`);
    assert.equal(quest.consumes_items, false, `${quest.id}: tutorial must not consume equipment`);
    assert.equal(quest.reward_policy, 'optional_non_progression');
    assert(itemRef(quest.icon), `${quest.id}: unresolvable icon ${quest.icon}`);
    claim(hexId('quest', `${chId}/${quest.id}`), `quest ${quest.id}`);

    const tasks = quest.tasks ?? (quest.task ? [quest.task] : []);
    assert(tasks.length >= 1, `${quest.id}: no task`);
    tasks.forEach((t, i) => {
      claim(hexId('task', `${chId}/${quest.id}/${i}`), `task ${quest.id}[${i}]`);
      assert(TASK_TYPES.has(t.type), `${quest.id}: unsupported task type ${t.type}`);
      if (t.count !== undefined) assert(Number.isInteger(t.count) && t.count >= 1, `${quest.id}: bad count`);
      if (t.components !== undefined) assert(t.components && typeof t.components === 'object' && !Array.isArray(t.components), `${quest.id}: task ${i} components must be an object`);
      switch (t.type) {
        case 'item':
          assert(itemRef(t.target), `${quest.id}: unresolvable item target ${t.target}`);
          availableBy(t.target, quest.suggested_stage, `${quest.id} task`);
          break;
        case 'checkmark':
          assert(t.target === undefined, `${quest.id}: checkmark must not have a target`);
          break;
        case 'stage':
          assert(nodeIds.has(t.stage), `${quest.id}: unknown progression node ${t.stage}`);
          break;
        case 'dimension':
          assert(dimRef(t.target), `${quest.id}: unresolvable dimension ${t.target}`);
          break;
        case 'advancement':
          assert(advTargets.has(t.target), `${quest.id}: unknown advancement ${t.target}`);
          break;
        case 'kill':
          if (t.target.startsWith('#')) {
            assert(regEntTags.has(t.target.slice(1)), `${quest.id}: unknown entity tag ${t.target}`);
          } else {
            assert(regEnts.has(t.target), `${quest.id}: unknown entity ${t.target}`);
          }
          break;
        case 'biome':
        case 'structure':
          assert(ID_RE.test(t.target), `${quest.id}: bad ${t.type} target ${t.target}`);
          break;
      }
    });

    for (const ref of quest.manual_refs ?? []) {
      assert(tutorialIds.has(ref), `${quest.id}: unknown manual ref ${ref}`);
      assert(has(locales.zh_cn, `modpack.tutorial.${ref}.title`), `${quest.id}: manual ref ${ref} has no title`);
    }
    // tutorial_hints: short in-quest operation notes. keys[] must be real
    // KeyMapping ids from design/keybinds.json, and every declared key must be
    // consumed by exactly one %N$s placeholder in the localized text.
    if (quest.tutorial_hints !== undefined) {
      assert(Array.isArray(quest.tutorial_hints), `${quest.id}: tutorial_hints must be an array`);
      assert(quest.tutorial_hints.length >= 1 && quest.tutorial_hints.length <= 5,
        `${quest.id}: tutorial_hints must hold 1-5 entries`);
      for (const h of quest.tutorial_hints) {
        assert(h && typeof h === 'object' && !Array.isArray(h), `${quest.id}: bad hint entry`);
        assert(typeof h.text_key === 'string' && keyPattern.test(h.text_key),
          `${quest.id}: bad hint text_key`);
        assert(has(locales.zh_cn, h.text_key), `${quest.id}: hint ${h.text_key} missing zh_cn`);
        assert(Array.isArray(h.keys), `${quest.id}: hint ${h.text_key} keys must be an array`);
        for (const k of h.keys) {
          assert(typeof k === 'string' && keybindIds.has(k),
            `${quest.id}: hint ${h.text_key} unregistered keybind ${k}`);
        }
        const used = new Set([...(locales.zh_cn[h.text_key].matchAll(/%(\d+)\$s/g))]
          .map((m) => Number(m[1])));
        for (let i = 1; i <= h.keys.length; i++) {
          assert(used.has(i), `${quest.id}: hint ${h.text_key} declares unused key ${h.keys[i - 1]}`);
        }
        for (const n of used) {
          assert(n >= 1 && n <= h.keys.length,
            `${quest.id}: hint ${h.text_key} placeholder %${n}$s exceeds ${h.keys.length} key(s)`);
        }
      }
    }
    for (const ref of quest.deps ?? []) {
      assert(questIds.has(ref), `${quest.id}: unknown dep ${ref}`);
      assert.notEqual(ref, quest.id, `${quest.id}: dep self-reference`);
      const other = content.quests.find((q) => q.id === ref);
      assert.equal(chapterOf(other), chId, `${quest.id}: dep ${ref} crosses chapters`);
      // Pacing rules: a required quest must never wait on optional content, and
      // a dependency must not sit at a later suggested stage than the quest itself.
      if (!quest.optional) assert(!other.optional, `${quest.id}: required quest depends on optional ${ref}`);
      assert(tierOf(other.suggested_stage) <= tierOf(quest.suggested_stage),
        `${quest.id}: dep ${ref} (${other.suggested_stage}) sits later than the quest's own stage`);
    }
    if (quest.required_stage) assert(nodeIds.has(quest.required_stage), `${quest.id}: unknown required_stage`);
    (quest.rewards ?? []).forEach((r, i) => {
      claim(hexId('reward', `${chId}/${quest.id}/${i}`), `reward ${quest.id}[${i}]`);
      assert(itemRef(r.item), `${quest.id}: unresolvable reward item ${r.item}`);
      assert(Number.isInteger(r.count) && r.count >= 1, `${quest.id}: bad reward count`);
      assert(['player', 'team'].includes(r.scope), `${quest.id}: reward scope must be player|team`);
      availableBy(r.item, quest.suggested_stage, `${quest.id} reward`);
      if (r.pool !== undefined) {
        assert.equal(itemRef(r.item), `${content.namespace}:milestone_reward_pack`,
          `${quest.id}: reward pool stamp is only meaningful on milestone_reward_pack`);
        assert(design.rewardPools[r.pool], `${quest.id}: unknown reward pool ${r.pool}`);
      }
    });
  }

  // deps must form a forest (acyclic) inside each chapter
  for (const chId of chapterIds) {
    const members = content.quests.filter((q) => chapterOf(q) === chId);
    const done = new Set();
    let pending = [...members];
    while (pending.length) {
      const ready = pending.filter((q) => (q.deps ?? []).every((d) => done.has(d)));
      assert(ready.length, `chapter ${chId}: deps cycle`);
      for (const q of ready) done.add(q.id);
      pending = pending.filter((q) => !done.has(q.id));
    }
    assert(members.some((q) => !(q.deps ?? []).length) || !members.length,
      `chapter ${chId}: no root quest`);
  }

  // ---------- manual pages (tutorials) ----------
  for (const t of content.tutorials) {
    assert(groupIds.has(t.group), `tutorial ${t.id}: unknown group ${t.group}`);
    assert(keyPattern.test(t.title_key), `tutorial ${t.id}: missing title_key`);
    assert(!questIds.has(`manual_${t.id}`), `tutorial ${t.id}: manual page id collides with a quest`);
    claim(hexId('quest', `manual/${t.id}`), `manual page ${t.id}`);
  }

  // ---------- custom advancements (record only; never grant stages) ----------
  // parent builds one Starforge tab tree. Exactly one root (the tab itself);
  // every other entry must name an existing, non-hidden parent and the graph
  // must stay acyclic — a hidden node's whole subtree is invisible, so hiding
  // an intermediate would silently bury its children.
  const advById = new Map(design.advancements.map((a) => [a.id, a]));
  const advChildren = new Map(design.advancements.map((a) => [a.id, []]));
  for (const a of design.advancements) {
    if (a.parent !== undefined) {
      assert(/^[a-z][a-z0-9_]*$/.test(a.parent), `advancement ${a.id}: invalid parent id ${a.parent}`);
      assert.notEqual(a.parent, a.id, `advancement ${a.id}: parent self-reference`);
      assert(advancementIds.has(a.parent), `advancement ${a.id}: unknown parent ${a.parent}`);
      advChildren.get(a.parent).push(a.id);
    }
    if (a.background !== undefined) {
      assert.equal(a.parent, undefined, `advancement ${a.id}: background only applies to the root`);
    }
  }
  const advRoots = design.advancements.filter((a) => a.parent === undefined);
  assert.equal(advRoots.length, 1,
    `advancements: expected exactly 1 root (the Starforge tab), got ${advRoots.map((a) => a.id).join(', ') || 'none'}`);
  assert.equal(advRoots[0].id, 'starforge', 'advancements: the tab root must be the starforge advancement');
  for (const a of design.advancements) {
    if (a.hidden) assert.equal(advChildren.get(a.id).length, 0,
      `advancement ${a.id}: a hidden advancement must not have children (they would be invisible)`);
  }
  {
    // cycle check + reachability from the root (every node must hang on the tree)
    const seen = new Set();
    const stack = (id, path) => {
      assert(!path.has(id), `advancement parent cycle at ${id}: ${[...path, id].join(' -> ')}`);
      if (seen.has(id)) return;
      seen.add(id);
      const next = new Set([...path, id]);
      for (const c of advChildren.get(id)) stack(c, next);
    };
    stack('starforge', new Set());
    assert.equal(seen.size, design.advancements.length, 'advancements: unreachable nodes outside the Starforge tree');
  }
  for (const a of design.advancements) {
    assert(itemRef(a.icon), `advancement ${a.id}: unresolvable icon ${a.icon}`);
    if (a.reveal_at) assert(nodeIds.has(a.reveal_at), `advancement ${a.id}: unknown reveal_at node`);
    switch (a.trigger) {
      case 'changed_dimension':
        assert(a.dimensions.length >= 1, `advancement ${a.id}: no dimensions`);
        for (const d of a.dimensions) assert(dimRef(d), `advancement ${a.id}: unresolvable dimension ${d}`);
        break;
      case 'custom_event':
        // Granted explicitly by the generated guidance script or starforge_compat.
        assert(ID_RE.test(a.event ?? ''), `advancement ${a.id}: custom_event needs a namespaced event id`);
        break;
      case 'stage_granted':
        // Mirrored award fired by the guidance script when PS grants the stage.
        assert(nodeIds.has(a.stage), `advancement ${a.id}: unknown stage ${a.stage}`);
        break;
      case 'inventory_item':
        assert(a.items?.length >= 1, `advancement ${a.id}: no items`);
        for (const r of a.items) {
          if (r.startsWith('#')) assert(regItemTags.has(r.slice(1)), `advancement ${a.id}: unknown item tag ${r}`);
          else assert(itemRef(r), `advancement ${a.id}: unresolvable item ${r}`);
        }
        break;
      case 'kill_entity':
        assert(a.entities?.length >= 1, `advancement ${a.id}: no entities`);
        for (const e of a.entities) {
          if (e.startsWith('#')) assert(regEntTags.has(e.slice(1)), `advancement ${a.id}: unknown entity tag ${e}`);
          else assert(regEnts.has(sm.entities?.[e] ?? e), `advancement ${a.id}: unknown entity ${e}`);
        }
        break;
      default:
        assert.fail(`advancement ${a.id}: unsupported trigger ${a.trigger}`);
    }
  }

  // ---------- guidance events (one detection route per real signal) ----------
  // Every event degrades to a no-op when its signal is unavailable — so no
  // guidance path may feed the era evidence counters (that would make FTB
  // Quests a progression gate).
  const guidIds = uniqueIds(design.guidance.events, 'guidance events');
  const seenCounters = new Set();
  for (const ev of design.guidance.events) {
    const v = ev.via ?? {};
    const routes = ['inventory_tag', 'inventory_item', 'inventory_items', 'inventory_tag_multi',
      'block_use', 'block_tag', 'entity_spawned', 'quest', 'dimension',
      'advancement_earned', 'horde_start', 'horde_end', 'gun_ns', 'craft_item']
      .filter((k) => v[k] !== undefined && v[k] !== false);
    assert(routes.length >= 1, `guidance ${ev.id}: no detection route`);
    if (ev.counter) {
      assert(/^modpack:[a-z0-9_]+$/.test(ev.counter), `guidance ${ev.id}: counter must be modpack:*`);
      assert(!seenCounters.has(ev.counter), `guidance ${ev.id}: duplicate counter ${ev.counter}`);
      seenCounters.add(ev.counter);
      assert(!ev.counter.startsWith('modpack:craft_'), `guidance ${ev.id}: events must not feed era evidence counters`);
    }
    if (ev.advancement) assert(advancementIds.has(ev.advancement), `guidance ${ev.id}: unknown advancement ${ev.advancement}`);
    if (v.quest) {
      assert(questIds.has(v.quest), `guidance ${ev.id}: unknown quest ${v.quest}`);
      assert(!ev.counter?.startsWith('modpack:craft_'), `guidance ${ev.id}: quest path must not gate progression`);
    }
    if (v.entity_spawned) assert(regEnts.has(sm.entities?.[v.entity_spawned] ?? v.entity_spawned), `guidance ${ev.id}: unknown entity`);
    if (v.inventory_item) assert(itemRef(v.inventory_item), `guidance ${ev.id}: unresolvable item ${v.inventory_item}`);
    for (const r of v.inventory_items ?? []) assert(itemRef(r), `guidance ${ev.id}: unresolvable item ${r}`);
    if (v.inventory_tag) assert(regItemTags.has(v.inventory_tag), `guidance ${ev.id}: unknown item tag ${v.inventory_tag}`);
    for (const t of v.inventory_tag_multi ?? []) assert(regItemTags.has(t), `guidance ${ev.id}: unknown item tag ${t}`);
    for (const r of v.block_use ?? []) assert(itemRef(r), `guidance ${ev.id}: unresolvable block ${r}`);
    if (v.block_tag) assert(regBlockTags.has(v.block_tag), `guidance ${ev.id}: unknown block tag ${v.block_tag}`);
    if (v.dimension) assert(dimRef(v.dimension), `guidance ${ev.id}: unresolvable dimension ${v.dimension}`);
    if (v.craft_item) assert(itemRef(v.craft_item), `guidance ${ev.id}: unresolvable item ${v.craft_item}`);
    if (v.advancement_earned) {
      assert(v.advancement_earned.startsWith('starforge:'), `guidance ${ev.id}: advancement_earned must be starforge:*`);
      assert(advancementIds.has(v.advancement_earned.slice(10)), `guidance ${ev.id}: unknown advancement ${v.advancement_earned}`);
    }
    if (v.requires_alien_dim) assert(v.inventory_tag, `guidance ${ev.id}: requires_alien_dim needs an inventory_tag`);
  }
  for (const d of design.guidance.alien_dimensions ?? []) assert(dimRef(d), `guidance: unknown alien dimension ${d}`);

  console.log(`PASS: ${nodeIds.size} progression nodes (${stageIds.size} era + ${abilityIds.size} ability), ${routeIds.size} routes, ${chapterIds.size} chapters, ${questIds.size} quests, ${tutorialIds.size} manual pages, ${guidIds.size} guidance events, ${keys.length} bilingual keys.`);
  console.log('PASS: stage/ability graphs, dep-stage inversion, optional rules, unlock availability, task/reward/icon refs, advancement/guidance refs, layout cycles, generated-id uniqueness.');
  console.log('Scope: static design validation only; no Minecraft runtime or real recipe graph was tested.');
}

try {
  validate();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
