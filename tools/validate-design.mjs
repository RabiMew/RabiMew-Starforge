import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hexId } from './lib/hexid.mjs';

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
  const content = parse('design/content.json');
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
  function collect(value, location = 'content') {
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
  collect(content);
  assert.deepEqual([...referenced].sort(), keys, 'Unused or unreferenced translation keys');

  const stageIds = uniqueIds(content.stages, 'stages');
  const routeIds = uniqueIds(content.routes, 'routes');
  const chapterIds = uniqueIds(content.chapters, 'chapters');
  const questIds = uniqueIds(content.quests, 'quests');
  const tutorialIds = uniqueIds(content.tutorials, 'tutorials');
  const groupIds = uniqueIds(content.tutorial_groups, 'tutorial_groups');
  const advancementIds = uniqueIds(content.advancements, 'advancements');
  for (const category of ['items', 'jobs', 'planets', 'messages', 'gui', 'bosses']) {
    uniqueIds(content[category], category);
  }
  assert.equal(stageIds.size, 8, 'Expected T0 through T7');
  assert.deepEqual(content.stages.map((stage) => stage.tier).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(routeIds.size, 7);
  assert.equal(chapterIds.size, 9, 'Expected onboarding + 7 routes + manual');
  assert.equal(questIds.size, 72);
  assert.equal(content.planets.length, 8);
  const stages = new Map(content.stages.map((stage) => [stage.id, stage]));
  const tierOf = (id) => stages.get(id).tier;

  // ---------- chapters ----------
  const sm = parse('design/semantic-map.json');
  const locks = parse('design/stage-locks.json');
  const regItems = new Set(parse('registry-export/items.json'));
  const regDims = new Set(parse('registry-export/dimensions.json'));
  const regEnts = new Set(parse('registry-export/entity_types.json'));
  const regEntTags = new Set(Object.keys(parse('registry-export/tags_entity.json')));
  const ownItems = new Set(content.items.map((i) => `${content.namespace}:${i.id}`));
  const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
  // Semantic key or literal ns:path -> resolved id, verified against the
  // registry export; own kubejs items are validated against content.items.
  const itemRef = (ref) => {
    const id = sm.items[ref] ?? (ID_RE.test(ref) ? ref : null);
    return id && (regItems.has(id) || ownItems.has(id)) ? id : null;
  };
  const dimRef = (ref) => {
    const id = sm.dimensions[ref] ?? (ID_RE.test(ref) ? ref : null);
    return id && regDims.has(id) ? id : null;
  };
  // item semantic key -> stage id that unlocks it (absent = ungated)
  const lockedAt = {};
  for (const [stage, lock] of Object.entries(locks)) {
    for (const key of lock.items ?? []) assert(!lockedAt[key], `${key}: locked by two stages`);
    for (const key of lock.items ?? []) lockedAt[key] = stage;
  }
  const availableBy = (ref, stageId, ctx) => {
    if (!lockedAt[ref]) return; // literal or ungated refs cannot be checked offline
    assert(tierOf(lockedAt[ref]) <= tierOf(stageId),
      `${ctx}: ${ref} unlocks at ${lockedAt[ref]}, later than suggested stage ${stageId}`);
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
  for (const stage of content.stages) {
    const prior = ancestors(stage.id);
    assert.equal(stage.requires_space, false, `${stage.id}: space gate is not permitted`);
    assert.equal(stage.requires_boss, false, `${stage.id}: boss gate is not permitted`);
    assert.equal(new Set(stage.depends_on).size, stage.depends_on.length);
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

  for (const route of content.routes) {
    assert.equal(route.always_visible, true);
    assert(content.quests.filter((quest) => quest.route === route.id).length >= 4,
      `${route.id}: routes need at least 4 quests`);
  }

  // ---------- questbook: tasks, rewards, layout, manual refs ----------
  const TASK_TYPES = new Set(['item', 'checkmark', 'advancement', 'dimension', 'kill', 'biome', 'structure']);
  const advTargets = new Set(content.advancements.map((a) => `starforge:${a.id}`));
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
      switch (t.type) {
        case 'item':
          assert(itemRef(t.target), `${quest.id}: unresolvable item target ${t.target}`);
          availableBy(t.target, quest.suggested_stage, `${quest.id} task`);
          break;
        case 'checkmark':
          assert(t.target === undefined, `${quest.id}: checkmark must not have a target`);
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
    for (const ref of quest.deps ?? []) {
      assert(questIds.has(ref), `${quest.id}: unknown dep ${ref}`);
      assert.notEqual(ref, quest.id, `${quest.id}: dep self-reference`);
      const other = content.quests.find((q) => q.id === ref);
      assert.equal(chapterOf(other), chId, `${quest.id}: dep ${ref} crosses chapters`);
    }
    (quest.rewards ?? []).forEach((r, i) => {
      claim(hexId('reward', `${chId}/${quest.id}/${i}`), `reward ${quest.id}[${i}]`);
      assert(itemRef(r.item), `${quest.id}: unresolvable reward item ${r.item}`);
      assert(Number.isInteger(r.count) && r.count >= 1, `${quest.id}: bad reward count`);
      assert(['player', 'team'].includes(r.scope), `${quest.id}: reward scope must be player|team`);
      availableBy(r.item, quest.suggested_stage, `${quest.id} reward`);
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

  // ---------- custom advancements ----------
  for (const a of content.advancements) {
    assert(itemRef(a.icon), `advancement ${a.id}: unresolvable icon ${a.icon}`);
    assert.equal(a.trigger, 'changed_dimension', `advancement ${a.id}: unsupported trigger ${a.trigger}`);
    assert(a.dimensions.length >= 1, `advancement ${a.id}: no dimensions`);
    for (const d of a.dimensions) assert(dimRef(d), `advancement ${a.id}: unresolvable dimension ${d}`);
  }

  console.log(`PASS: ${stageIds.size} stages, ${routeIds.size} routes, ${chapterIds.size} chapters, ${questIds.size} quests, ${tutorialIds.size} manual pages, ${keys.length} bilingual keys.`);
  console.log('PASS: stage graph, unlock availability, task/reward/icon refs, layout cycles, generated-id uniqueness.');
  console.log('Scope: static design validation only; no Minecraft runtime or real recipe graph was tested.');
}

try {
  validate();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
