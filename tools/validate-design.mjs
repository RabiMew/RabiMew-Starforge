import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  const questIds = uniqueIds(content.quests, 'quests');
  for (const category of ['items', 'jobs', 'planets', 'messages', 'gui', 'tutorials', 'bosses']) {
    uniqueIds(content[category], category);
  }
  assert.equal(stageIds.size, 8, 'Expected T0 through T7');
  assert.deepEqual(content.stages.map((stage) => stage.tier).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(routeIds.size, 7);
  assert.equal(questIds.size, 35);
  assert.equal(content.planets.length, 8);
  const stages = new Map(content.stages.map((stage) => [stage.id, stage]));

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
  for (const quest of content.quests) {
    assert(routeIds.has(quest.route), `${quest.id}: unknown route`);
    assert(stageIds.has(quest.suggested_stage), `${quest.id}: unknown suggested stage`);
    assert.deepEqual(quest.depends_on, [], `${quest.id}: baseline quests must remain parallel`);
    assert.equal(quest.grants_stage, false, `${quest.id}: quests must not grant technology`);
    assert.equal(quest.consumes_items, false, `${quest.id}: tutorial must not consume equipment`);
    assert.equal(quest.reward_policy, 'optional_non_progression');
  }
  console.log(`PASS: ${stageIds.size} stages, ${routeIds.size} routes, ${questIds.size} quests, ${keys.length} bilingual keys.`);
  console.log('PASS: stage graph, unlock availability declarations, optional space route, references, and placeholders.');
  console.log('Scope: static design validation only; no Minecraft runtime or real recipe graph was tested.');
}

try {
  validate();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
