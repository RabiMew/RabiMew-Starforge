// Generates zh_cn lang fallbacks for shipped mods whose bundled zh_cn.json is
// incomplete (framedblocks, mcwfurnitures) or absent entirely (mdm).
// Output lands in pack/kubejs/assets/<mod>/lang/zh_cn.json;
// KubeJS assets merge over the jar's own lang file, so only MISSING keys are written.
// Re-run after bumping any covered mod jar:  node tools/gen-mod-lang-zh.mjs
// Reads jars via `unzip -p`, falling back to `tar -xOf` (bsdtar only; GNU tar can't read zips).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function jarEntry(jarGlob, entry) {
  const jar = readdirSync(path.join(root, 'mods')).find((f) => jarGlob.test(f));
  if (!jar) throw new Error(`gen-mod-lang-zh: no jar matching ${jarGlob} in mods/`);
  const p = path.join(root, 'mods', jar);
  try {
    return JSON.parse(execFileSync('unzip', ['-p', p, entry], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  } catch {
    return JSON.parse(execFileSync('tar', ['-xOf', p, entry], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  }
}

// ---------------------------------------------------------------------------
// mcwfurnitures: bundled zh_cn predates the 3.4.x kitchen-sink/couch lines.
// Missing names are derived: wood prefix zh is read back from the bundled
// translation of the same wood's wardrobe; colors use vanilla dye terms.
// ---------------------------------------------------------------------------

const MCW_WOOD_FALLBACK = {
  oak: '橡木', birch: '白桦', spruce: '云杉', jungle: '丛林', acacia: '金合欢',
  dark_oak: '深色橡木', crimson: '绯红', warped: '诡异', mangrove: '红树',
  cherry: '樱花', bamboo: '竹',
};
const MCW_COLOR = {
  white: '白色', light_gray: '淡灰色', gray: '灰色', black: '黑色', brown: '棕色',
  red: '红色', orange: '橙色', yellow: '黄色', lime: '黄绿色', green: '绿色',
  cyan: '青色', light_blue: '淡蓝色', blue: '蓝色', purple: '紫色',
  magenta: '品红色', pink: '粉红色',
};
const MCW_KEY_ZH = {
  'subtitle.mcwfurnitures.drawer_open': '抽屉：打开',
  'subtitle.mcwfurnitures.drawer_close': '抽屉：关闭',
  'subtitle.mcwfurnitures.cabinet_open': '橱柜：打开',
  'subtitle.mcwfurnitures.cabinet_close': '橱柜：关闭',
};

function genMcwFurniture() {
  const en = jarEntry(/^mcw-furniture-.*\.jar$/i, 'assets/mcwfurnitures/lang/en_us.json');
  const zh = jarEntry(/^mcw-furniture-.*\.jar$/i, 'assets/mcwfurnitures/lang/zh_cn.json');

  // Recover each wood's bundled zh prefix from another furniture piece of the
  // same wood (wardrobes exist for every wood in the bundled zh_cn).
  const woodZh = {};
  for (const wood of Object.keys(MCW_WOOD_FALLBACK)) {
    const w = zh[`block.mcwfurnitures.${wood}_wardrobe`];
    woodZh[wood] = w ? w.replace(/衣柜$/, '') : MCW_WOOD_FALLBACK[wood];
  }

  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (k in zh) continue;
    if (MCW_KEY_ZH[k]) { out[k] = MCW_KEY_ZH[k]; continue; }
    let m = k.match(/^block\.mcwfurnitures\.(stripped_)?(\w+?)_kitchen_sink$/);
    if (m) { out[k] = `${m[1] ? '去皮' : ''}${woodZh[m[2]]}厨房水槽`; continue; }
    m = k.match(/^block\.mcwfurnitures\.(\w+?)_(couch|chaise)$/);
    if (m && MCW_COLOR[m[1]]) { out[k] = `${MCW_COLOR[m[1]]}${m[2] === 'couch' ? '沙发' : '贵妃椅'}`; continue; }
    unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`mcwfurnitures: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// mdm: jar ships en_us only — every key needs a zh value. Display names are
// compositional (room set + color + piece + variant); the rules below resolve
// the full en_us set and the generator throws on anything unmapped.
// ---------------------------------------------------------------------------

const MDM_COLOR = {
  Black: '黑色', Grey: '灰色', Gray: '灰色', 'Light Grey': '淡灰色',
  'Light Gray': '淡灰色', White: '白色', Blue: '蓝色', Green: '绿色',
  Red: '红色', Wenge: '温格木色', 'White Wood': '白木',
};

// piece name (after set/color prefix and numeric/variant suffixes are
// stripped) -> zh
const MDM_PIECE = {
  // bedroom set pieces
  'Bunk Bed': '双层床', 'Bunkbed': '双层床', 'Double Bed': '双人床',
  'Single Bed': '单人床', 'Nightstand': '床头柜', 'Nighstand': '床头柜',
  'Dresser': '梳妆台', 'Loveseat': '双人沙发', 'Wardrobe': '衣柜',
  // office set pieces
  'Chair': '椅子', 'Desk Lamp': '台灯', 'Bookshelf': '书架',
  'Desk 1 Cabinet': '书桌1·柜', 'Desk 1': '书桌1', 'Desk 2': '书桌2',
  // kitchen set pieces
  'Bar Chair': '吧台椅', 'Corner Counter': '转角台面',
  'Corner Counter With Sink': '带水槽转角台面', 'Counter': '台面',
  'Dishwasher': '洗碗机', 'Hanging Cabinet': '吊柜',
  'Hanging Corner Cabinet': '转角吊柜', 'Oven Microwave': '烤箱微波炉',
  'Small Corner Hanging Cabinet': '小型转角吊柜',
  'Small Hanging Cabinet': '小型吊柜',
  // generic set pieces
  'Bed': '床', 'Cabinet': '柜', 'Cabinet With Drawers': '带抽屉柜',
  'Corner Cabinet': '转角柜', 'Corner Hanging Cabinet': '转角吊柜',
  'Footrest': '脚凳', 'Fridge': '冰箱', 'Hanging Shelf': '壁挂置物架',
  'Island': '中岛', 'Livingroom Cabinet': '客厅柜',
  'Livingroom Hanging Cabinet': '客厅吊柜', 'Night Table': '床头柜',
  'TV Stand': '电视柜', 'Tv Stand': '电视柜', 'Coffe Table': '咖啡桌',
  'Coffee Table': '咖啡桌', 'Oven': '烤箱',
  'Coffe Table 1 Short': '咖啡桌1（矮）', 'Coffe Table 1 Tall': '咖啡桌1（高）',
  'Coffe Table Decorated': '咖啡桌（装饰款）',
  'TV Stand Mid Decorated': '电视柜（中·装饰款）',
  // colored standalone pieces
  'Armchair': '扶手椅', 'Bench': '长凳', 'Curtain': '窗帘',
  'Desk Extension': '书桌扩展件', 'Lamp': '灯', 'Modern Stairs': '现代楼梯',
  'Moder Stairs': '现代楼梯', 'Modern Fridge': '现代冰箱',
  'Office Desk': '办公桌', 'Wall Clock': '挂钟',
  'Washbasin Tap': '洗手盆水龙头', 'Bathtub': '浴缸',
  'Bathroom Shelf': '浴室置物架', 'Board': '白板',
  'Couch Corner': '转角沙发', 'Sofa': '沙发', 'Couch': '沙发',
  'Desk': '书桌', 'Shelf': '置物架', 'Painting': '挂画',
  'Chandelier': '吊灯', 'Ceiling Lamp': '吊灯',
};

// whole display names -> zh (irregular ids / non-compositional names)
const MDM_NAME_ZH = {
  'Baskets': '篮筐', 'Bathroom Mirror': '浴室镜', 'Bathroom Radiator': '浴室暖气片',
  'Bathroom Shelf 0 2': '浴室置物架 2', 'Bathroom Sink': '浴室洗手池',
  'Bathroom Sink With Shelf': '带置物架浴室洗手池', 'Bathroom Stand': '浴室架',
  'Big Ceiling Lamp': '大型吊灯', 'Bowl': '碗', 'Boxes': '收纳箱',
  'Carpet 1': '地毯 1', 'Carpet 2': '地毯 2', 'Carpet 3': '地毯 3', 'Carpet 4': '地毯 4',
  'Ceiling Fan': '吊扇', 'Clothes Basket': '衣物篮', 'Chopping Board': '砧板',
  'Coat Hanger': '衣架', 'Coffee Table 0 4': '咖啡桌 04', 'Cork Board': '软木板',
  'Couch Corner': '转角沙发', 'Couch Right': '沙发（右）', 'Couchleft': '沙发（左）',
  'Couchmiddle': '沙发（中）', 'Crib': '婴儿床', 'Curtain Rack': '窗帘杆',
  'Document Folders': '文件夹', 'Door Mat': '门垫',
  'Electric Guitar Black': '黑色电吉他', 'Electric Guitar With Stand': '带支架电吉他',
  'Entryway Carpet': '门厅地毯', 'Fork': '叉子',
  'Foyer Wall Unit Bottom': '玄关墙柜（下）', 'Foyer Wall Unit Top': '玄关墙柜（上）',
  'Gas Stove': '燃气灶', 'Hand Soap And Cream Set': '洗手液与护手霜套装',
  'Hanging Shelf': '壁挂置物架', 'Induction Cooker': '电磁炉',
  'Knife': '菜刀', 'Knife Stand': '刀架', 'Lamp 03': '灯 03', 'Lantern': '灯笼',
  'Leafless Bamboo Decoration 1': '无叶竹装饰 1',
  'Leafless Bamboo Decoration 2': '无叶竹装饰 2',
  'Leafless Bamboo Decoration 3': '无叶竹装饰 3',
  'Modern Chandelier 1': '现代吊灯 1', 'Modern Desk 1': '现代书桌 1',
  'Modern Desk 2': '现代书桌 2', 'Modern Desk Lamp 1': '现代台灯 1',
  'Modern Lamp 1': '现代落地灯 1', 'Modern Painting': '现代挂画',
  'Modern Painting 2': '现代挂画 2', 'Mug': '马克杯',
  'Office Cabinet 1': '办公柜 1', 'Office Cabinet 2': '办公柜 2', 'Office Cabinet 3': '办公柜 3',
  'Office Shelf': '办公置物架', 'Outdoor Couch': '户外沙发', 'Outdoor Table': '户外桌',
  'Oven': '烤箱', 'Painting 03': '挂画 03', 'Painting 04': '挂画 04', 'Painting 05': '挂画 05',
  'Pair Of Boots': '一双靴子', 'Pile Of Towels': '一叠毛巾', 'Plate': '餐盘',
  'Pool Table': '台球桌', 'Potted Cactus': '仙人掌盆栽', 'Potted Tree': '盆栽树',
  'Pouf': '软包坐墩', 'Rain Shower': '顶喷淋浴', 'Ring Lamp': '环形灯',
  'Seasoning Rack': '调料架', 'Shelf': '置物架', 'Shoe Rack': '鞋架',
  'Shoji Screen': '障子屏风', 'Small Ceiling Lamp': '小型吊灯',
  'Small Chandelier': '小型枝形吊灯', 'Small Table': '小桌', 'Soap Bar': '肥皂',
  'Sofa': '沙发', 'Spoon': '勺子', 'Standing White Board': '立式白板',
  'Steel Shelf': '钢置物架', 'Street Lantern Bottom': '街灯（下段）',
  'Street Lantern Mid': '街灯（中段）', 'Street Latern Top': '街灯（上段）',
  'Tall Mirror': '落地镜', 'Toilet': '马桶', 'Toilet Paper Roll': '卫生纸卷',
  'Toothbrushes': '牙刷', 'Towel Set 1': '毛巾套装 1',
  'Walkin Shower': '步入式淋浴间', 'Wall Lamp': '壁灯', 'Wall Lamp 2': '壁灯 2',
  'White Board': '白板', 'Window Blinds': '百叶窗', 'Wooden Wall Clock': '木质挂钟',
  'Set 3tv Stand': '套组3·电视柜',
};

// lang key -> zh where several ids intentionally share one en name
const MDM_KEY_ZH = {
  'block.mdm.foyer_bench': '玄关长凳', 'block.mdm.foyer_bench_dark': '深色玄关长凳',
  'block.mdm.foyer_bench_wenge': '温格木玄关长凳', 'block.mdm.foyer_bench_white': '白色玄关长凳',
  'block.mdm.black_foyer_wall_unit': '黑色玄关墙柜（下）',
  'block.mdm.black_foyer_wall_unit_top': '黑色玄关墙柜（上）',
  'block.mdm.foyer_wall_unit_bottom': '玄关墙柜（下）',
  'block.mdm.foyer_wall_unit_top': '玄关墙柜（上）',
  'block.mdm.white_wood_foyer_wall_unit': '白木玄关墙柜（下）',
  'block.mdm.white_wood_foyer_wall_unit_top': '白木玄关墙柜（上）',
  'block.mdm.shoe_rack_2': '鞋架 2', 'block.mdm.shoe_rack_3': '鞋架 3',
  'block.mdm.pair_of_boots_2': '一双靴子 2', 'block.mdm.pair_of_boots_3': '一双靴子 3',
  'block.mdm.pair_of_boots_4': '一双靴子 4', 'block.mdm.pair_of_boots_5': '一双靴子 5',
  'block.mdm.pair_of_boots_6': '一双靴子 6',
  'gui.mdm.freezergui.label_freezer': '冷冻柜', 'gui.mdm.fridge_gui.label_freezer': '冰箱',
  'gui.mdm.oven_gui.label_oven': '烤箱', 'gui.mdm.storage.label_storage': '储物',
  'item.mdm.furniture_parts': '家具部件',
  'itemGroup.mdm.office': '现代装饰（MDM）', 'item_group.mdm.office': '现代装饰（MDM）',
  'itemGroup.tabkitchen': '现代装饰·厨房', 'itemGroup.tabplants': '现代装饰·绿植',
  'itemGroup.tabwood_work': '现代装饰·木工',
};

const MDM_SET_ZH = {
  'Bedroom Set 1': '卧室套组1·', 'Bedroom set 1': '卧室套组1·',
  'Office Set 1': '办公套组1·', 'Kitchen Set 3': '厨房套组3·',
  'Set 1': '套组1·', 'Set 2': '套组2·', 'Set 3': '套组3·',
};

function mdmPieceZh(piece) {
  // peel known suffixes, then look up the base in MDM_PIECE
  let rest = piece;
  const grab = (re) => {
    const m = rest.match(re);
    if (m) rest = rest.slice(0, rest.length - m[0].length);
    return m;
  };
  const bot = grab(/ (Bottom|Top)$/);          // "Shelf Var 1 Bottom"
  const va = grab(/ Var (\d+)$/);              // "Desk 1 Cabinet Var 4"
  const pos = grab(/ (Left|Middle|Mid|Right|Side)$/); // "TV Stand Left"
  const num = grab(/ (\d+)$/);                 // "Cabinet 2"
  const zh = MDM_PIECE[rest];
  if (!zh) return null;
  return zh
    + (num ? num[1] : '')
    + (va ? `款式${va[1]}` : '')
    + (pos ? `（${{ Left: '左', Middle: '中', Mid: '中', Right: '右', Side: '侧' }[pos[1]]}）` : '')
    + (bot ? `（${bot[1] === 'Bottom' ? '下' : '上'}）` : '');
}

function mdmNameZh(enName) {
  if (MDM_NAME_ZH[enName]) return MDM_NAME_ZH[enName];
  const stripColor = (s) => {
    for (const c of Object.keys(MDM_COLOR).sort((a, b) => b.length - a.length)) {
      if (s.startsWith(c + ' ')) return [MDM_COLOR[c], s.slice(c.length + 1)];
    }
    return ['', s];
  };
  // "Bedroom Set 1 Grey Nightstand 1" / "Office Set 1 Desk 1 Cabinet Var 4" / ...
  for (const [setEn, setZh] of Object.entries(MDM_SET_ZH)) {
    if (!enName.startsWith(setEn + ' ')) continue;
    const [colorZh, rest] = stripColor(enName.slice(setEn.length + 1));
    const pieceZh = mdmPieceZh(rest);
    return pieceZh ? `${setZh}${colorZh}${pieceZh}` : null;
  }
  // "<Color> <piece>" standalones, e.g. "Black Curtain Left"
  const [colorZh, rest] = stripColor(enName);
  if (colorZh) {
    const pieceZh = mdmPieceZh(rest);
    return pieceZh ? `${colorZh}${pieceZh}` : null;
  }
  return MDM_PIECE[enName] ?? mdmPieceZh(enName) ?? null;
}

function genMdm() {
  const en = jarEntry(/^mdm-.*\.jar$/i, 'assets/mdm/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const [k, v] of Object.entries(en)) {
    const zh = MDM_KEY_ZH[k] ?? mdmNameZh(v);
    if (zh) out[k] = zh;
    else unresolved.push(`${k} = ${v}`);
  }
  if (unresolved.length) {
    throw new Error(`mdm: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// framedblocks: bundled zh_cn predates most 1.21 block shapes. Every missing
// key is translated here, following the shipped "…框架" naming style.
// ---------------------------------------------------------------------------
const FB_ZH = {
  // blocks
  'block.framedblocks.framed_activator_rail_slope': '激活铁轨坡框架',
  'block.framedblocks.framed_adj_double_copycat_panel': '可调复合仿形竖板框架',
  'block.framedblocks.framed_adj_double_copycat_slab': '可调复合仿形台阶框架',
  'block.framedblocks.framed_adj_double_panel': '可调复合竖板框架',
  'block.framedblocks.framed_adj_double_slab': '可调复合台阶框架',
  'block.framedblocks.framed_bookshelf': '书架框架',
  'block.framedblocks.framed_centered_panel': '居中竖板框架',
  'block.framedblocks.framed_centered_slab': '居中台阶框架',
  'block.framedblocks.framed_chain': '锁链框架',
  'block.framedblocks.framed_checkered_cube': '棋盘格方块框架',
  'block.framedblocks.framed_checkered_cube_segment': '棋盘格方块段框架',
  'block.framedblocks.framed_checkered_panel': '棋盘格竖板框架',
  'block.framedblocks.framed_checkered_panel_segment': '棋盘格竖板段框架',
  'block.framedblocks.framed_checkered_slab': '棋盘格台阶框架',
  'block.framedblocks.framed_checkered_slab_segment': '棋盘格台阶段框架',
  'block.framedblocks.framed_chiseled_bookshelf': '雕纹书架框架',
  'block.framedblocks.framed_collapsible_copycat_block': '可折叠仿形方块框架',
  'block.framedblocks.framed_compound_slope_panel': '组合竖向坡框架',
  'block.framedblocks.framed_compound_slope_slab': '组合台阶坡框架',
  'block.framedblocks.framed_corner_slope_edge': '角坡边缘框架',
  'block.framedblocks.framed_corner_strip': '角条框架',
  'block.framedblocks.framed_corner_tube': '角管框架',
  'block.framedblocks.framed_detector_rail_slope': '探测铁轨坡框架',
  'block.framedblocks.framed_divided_panel_horizontal': '分割竖板框架（水平）',
  'block.framedblocks.framed_divided_panel_vertical': '分割竖板框架（竖向）',
  'block.framedblocks.framed_divided_slab': '分割台阶框架',
  'block.framedblocks.framed_divided_slope': '分割坡框架',
  'block.framedblocks.framed_divided_stairs': '分割楼梯框架',
  'block.framedblocks.framed_double_half_slope': '复合半坡框架',
  'block.framedblocks.framed_double_half_stairs': '复合半楼梯框架',
  'block.framedblocks.framed_double_threeway_corner_pillar': '复合三角柱框架',
  'block.framedblocks.framed_elev_double_corner_slope_edge': '高复合角坡边缘框架',
  'block.framedblocks.framed_elev_double_inner_corner_slope_edge': '高复合内角坡边缘框架',
  'block.framedblocks.framed_elevated_corner_slope_edge': '高角坡边缘框架',
  'block.framedblocks.framed_elevated_double_slope_edge': '高复合坡边缘框架',
  'block.framedblocks.framed_elevated_inner_corner_slope_edge': '高内角坡边缘框架',
  'block.framedblocks.framed_elevated_inner_double_prism': '复合三棱柱框架',
  'block.framedblocks.framed_elevated_inner_double_sloped_prism': '复合三棱柱坡框架',
  'block.framedblocks.framed_elevated_inner_prism': '内三棱柱框架',
  'block.framedblocks.framed_elevated_inner_sloped_prism': '内三棱柱坡框架',
  'block.framedblocks.framed_elevated_pyramid_slab': '高角锥台阶框架',
  'block.framedblocks.framed_elevated_slope_edge': '高坡边缘框架',
  'block.framedblocks.framed_ext_corner_slope_panel': '延长角竖向坡框架',
  'block.framedblocks.framed_ext_corner_slope_panel_w': '延长角竖向坡框架',
  'block.framedblocks.framed_ext_double_corner_slope_panel': '延长复合角竖向坡框架',
  'block.framedblocks.framed_ext_double_corner_slope_panel_w': '延长复合角竖向坡框架',
  'block.framedblocks.framed_ext_inner_corner_slope_panel': '延长内角竖向坡框架',
  'block.framedblocks.framed_ext_inner_corner_slope_panel_w': '延长内角竖向坡框架',
  'block.framedblocks.framed_ext_inner_double_corner_slope_panel': '延长复合内角竖向坡框架',
  'block.framedblocks.framed_ext_inner_double_corner_slope_panel_w': '延长复合内角竖向坡框架',
  'block.framedblocks.framed_fancy_activator_rail': '精致激活铁轨框架',
  'block.framedblocks.framed_fancy_activator_rail_slope': '精致激活铁轨坡框架',
  'block.framedblocks.framed_fancy_detector_rail': '精致探测铁轨框架',
  'block.framedblocks.framed_fancy_detector_rail_slope': '精致探测铁轨坡框架',
  'block.framedblocks.framed_fancy_powered_rail': '精致动力铁轨框架',
  'block.framedblocks.framed_fancy_powered_rail_slope': '精致动力铁轨坡框架',
  'block.framedblocks.framed_fancy_rail': '精致铁轨框架',
  'block.framedblocks.framed_fancy_rail_slope': '精致铁轨坡框架',
  'block.framedblocks.framed_flat_double_slope_panel_corner': '平复合竖向坡角框架',
  'block.framedblocks.framed_flat_double_slope_slab_corner': '平复合台阶坡角框架',
  'block.framedblocks.framed_flat_elev_double_slope_slab_corner': '平高复合台阶坡角框架',
  'block.framedblocks.framed_flat_elev_inner_double_slope_slab_corner': '平高复合内台阶坡角框架',
  'block.framedblocks.framed_flat_elev_inner_slope_slab_corner': '平高内台阶坡角框架',
  'block.framedblocks.framed_flat_elev_slope_slab_corner': '平高台阶坡角框架',
  'block.framedblocks.framed_flat_ext_double_slope_panel_corner': '平延长复合竖向坡角框架',
  'block.framedblocks.framed_flat_ext_inner_double_slope_panel_corner': '平延长复合内竖向坡角框架',
  'block.framedblocks.framed_flat_ext_inner_slope_panel_corner': '平延长内竖向坡角框架',
  'block.framedblocks.framed_flat_ext_slope_panel_corner': '平延长竖向坡角框架',
  'block.framedblocks.framed_flat_inner_slope_panel_corner': '平内竖向坡角框架',
  'block.framedblocks.framed_flat_inner_slope_slab_corner': '平内台阶坡角框架',
  'block.framedblocks.framed_flat_inv_double_slope_panel_corner': '平反向复合竖向坡角框架',
  'block.framedblocks.framed_flat_inv_double_slope_slab_corner': '平反向复合台阶坡角框架',
  'block.framedblocks.framed_flat_slope_panel_corner': '平竖向坡角框架',
  'block.framedblocks.framed_flat_slope_slab_corner': '平台阶坡角框架',
  'block.framedblocks.framed_flat_stacked_inner_slope_panel_corner': '平叠内竖向坡角框架',
  'block.framedblocks.framed_flat_stacked_inner_slope_slab_corner': '平叠内台阶坡角框架',
  'block.framedblocks.framed_flat_stacked_slope_panel_corner': '平叠竖向坡角框架',
  'block.framedblocks.framed_flat_stacked_slope_slab_corner': '平叠台阶坡角框架',
  'block.framedblocks.framed_glowing_item_frame': '荧光物品展示框框架',
  'block.framedblocks.framed_half_slope': '半坡框架',
  'block.framedblocks.framed_hanging_sign': '悬挂式告示牌框架',
  'block.framedblocks.framed_hopper': '漏斗框架',
  'block.framedblocks.framed_inner_corner_slope_edge': '内角坡边缘框架',
  'block.framedblocks.framed_inner_threeway_corner_slope_edge': '内三角坡边缘框架',
  'block.framedblocks.framed_inv_double_corner_slope_panel': '反向复合角竖向坡框架',
  'block.framedblocks.framed_inv_double_corner_slope_panel_w': '反向复合角竖向坡框架',
  'block.framedblocks.framed_item_frame': '物品展示框框架',
  'block.framedblocks.framed_lantern': '灯笼框架',
  'block.framedblocks.framed_large_corner_slope_panel': '大型角竖向坡框架',
  'block.framedblocks.framed_large_corner_slope_panel_w': '大型角竖向坡框架',
  'block.framedblocks.framed_large_double_corner_slope_panel': '大型复合角竖向坡框架',
  'block.framedblocks.framed_large_double_corner_slope_panel_w': '大型复合角竖向坡框架',
  'block.framedblocks.framed_large_inner_corner_slope_panel': '大型内角竖向坡框架',
  'block.framedblocks.framed_large_inner_corner_slope_panel_w': '大型内角竖向坡框架',
  'block.framedblocks.framed_layered_cube': '层叠方块框架',
  'block.framedblocks.framed_lightning_rod': '避雷针框架',
  'block.framedblocks.framed_masonry_corner': '砖石角框架',
  'block.framedblocks.framed_masonry_corner_segment': '砖石角段框架',
  'block.framedblocks.framed_mini_cube': '迷你方块框架',
  'block.framedblocks.framed_one_way_window': '单向窗框架',
  'block.framedblocks.framed_path': '土径框架',
  'block.framedblocks.framed_pillar_socket': '柱座框架',
  'block.framedblocks.framed_powered_rail_slope': '动力铁轨坡框架',
  'block.framedblocks.framed_redstone_torch': '红石火把框架',
  'block.framedblocks.framed_sliced_sloped_stairs_slab': '切分坡楼梯框架（台阶）',
  'block.framedblocks.framed_sliced_sloped_stairs_slope': '切分坡楼梯框架（坡）',
  'block.framedblocks.framed_sliced_stairs_panel': '切分楼梯框架（竖板）',
  'block.framedblocks.framed_sliced_stairs_slab': '切分楼梯框架（台阶）',
  'block.framedblocks.framed_slope_edge': '坡边缘框架',
  'block.framedblocks.framed_sloped_double_stairs': '复合坡楼梯框架',
  'block.framedblocks.framed_sloped_stairs': '坡楼梯框架',
  'block.framedblocks.framed_small_corner_slope_panel': '小型角竖向坡框架',
  'block.framedblocks.framed_small_corner_slope_panel_w': '小型角竖向坡框架',
  'block.framedblocks.framed_small_double_corner_slope_panel': '小型复合角竖向坡框架',
  'block.framedblocks.framed_small_double_corner_slope_panel_w': '小型复合角竖向坡框架',
  'block.framedblocks.framed_small_inner_corner_slope_panel': '小型内角竖向坡框架',
  'block.framedblocks.framed_small_inner_corner_slope_panel_w': '小型内角竖向坡框架',
  'block.framedblocks.framed_soul_lantern': '灵魂灯笼框架',
  'block.framedblocks.framed_split_pillar_socket': '对开柱座框架',
  'block.framedblocks.framed_stacked_corner_slope_edge': '叠角坡边缘框架',
  'block.framedblocks.framed_stacked_corner_slope_panel': '叠角竖向坡框架',
  'block.framedblocks.framed_stacked_corner_slope_panel_w': '叠角竖向坡框架',
  'block.framedblocks.framed_stacked_inner_corner_slope_edge': '叠内角坡边缘框架',
  'block.framedblocks.framed_stacked_inner_corner_slope_panel': '叠内角竖向坡框架',
  'block.framedblocks.framed_stacked_inner_corner_slope_panel_w': '叠内角竖向坡框架',
  'block.framedblocks.framed_stacked_pyramid_slab': '叠角锥台阶框架',
  'block.framedblocks.framed_stacked_slope_edge': '叠坡边缘框架',
  'block.framedblocks.framed_stacked_slope_panel': '叠竖向坡框架',
  'block.framedblocks.framed_stacked_slope_slab': '叠台阶坡框架',
  'block.framedblocks.framed_tank': '储罐框架',
  'block.framedblocks.framed_thick_lattice': '粗格架方块',
  'block.framedblocks.framed_threeway_corner_pillar': '三角柱框架',
  'block.framedblocks.framed_threeway_corner_slope_edge': '三角坡边缘框架',
  'block.framedblocks.framed_tube': '管形框架',
  'block.framedblocks.framed_upper_pyramid_slab': '上角锥台阶框架',
  'block.framedblocks.framed_vertical_divided_stairs': '竖向分割楼梯框架',
  'block.framedblocks.framed_vertical_double_half_slope': '复合半坡框架',
  'block.framedblocks.framed_vertical_double_half_stairs': '竖向复合半楼梯框架',
  'block.framedblocks.framed_vertical_half_slope': '半坡框架',
  'block.framedblocks.framed_vertical_sliced_sloped_stairs_panel': '竖向切分坡楼梯框架（竖板）',
  'block.framedblocks.framed_vertical_sliced_sloped_stairs_slope': '竖向切分坡楼梯框架（坡）',
  'block.framedblocks.framed_vertical_sliced_stairs': '竖向切分楼梯框架',
  'block.framedblocks.framed_vertical_sloped_double_stairs': '竖向复合坡楼梯框架',
  'block.framedblocks.framed_vertical_sloped_stairs': '竖向坡楼梯框架',
  'block.framedblocks.framed_wall_hanging_sign': '悬挂式告示牌框架',
  'block.framedblocks.framed_waterloggable_gold_pressure_plate': '轻质测重压力板框架',
  'block.framedblocks.framed_waterloggable_iron_pressure_plate': '重质测重压力板框架',
  'block.framedblocks.framed_waterloggable_obsidian_pressure_plate': '黑曜石压力板框架',
  'block.framedblocks.framed_waterloggable_pressure_plate': '压力板框架',
  'block.framedblocks.framed_waterloggable_stone_pressure_plate': '石头压力板框架',
  'block.framedblocks.framing_saw': '框架锯',
  'block.framedblocks.powered_framing_saw': '电动框架锯',
  // items
  'item.framedblocks.framed_axe': '框架斧',
  'item.framedblocks.framed_reinforcement': '框架加固件',
  'item.framedblocks.framing_saw_pattern': '框架锯模板',
  'item.framedblocks.phantom_paste': '幻影膏',
  // GUI titles
  'title.framedblocks.framed_hopper': '漏斗框架',
  'title.framedblocks.framing_saw': '框架锯',
  'title.framedblocks.powered_framing_saw': '电动框架锯',
  'title.framedblocks.powered_saw.target_block': '目标：',
  // config screen labels
  'config.framedblocks.client.altGhostRenderer': '使用替代的放置预览渲染器',
  'config.framedblocks.client.camoMessageVerbosity': '伪装禁用提示详细程度',
  'config.framedblocks.client.camoRotationMode': '伪装旋转指示：显示模式',
  'config.framedblocks.client.conTexDisabled': '禁用连接纹理支持',
  'config.framedblocks.client.conTexMode': '连接纹理模式',
  'config.framedblocks.client.copycatStyleMode': '仿形样式指示：显示模式',
  'config.framedblocks.client.detailedCulling': '精细面剔除',
  'config.framedblocks.client.discreteUVSteps': '使用离散 UV 步进',
  'config.framedblocks.client.fancyHitboxes': '精细碰撞箱',
  'config.framedblocks.client.forceAoOnGlowingBlocks': '对发光框架方块强制环境光遮蔽',
  'config.framedblocks.client.ghostRenderOpacity': '放置预览不透明度',
  'config.framedblocks.client.itemFrameBackgroundMode': '物品展示框背景指示：显示模式',
  'config.framedblocks.client.maxOverlayMode': '指示图标最大显示模式',
  'config.framedblocks.client.oneWayWindowMode': '单向窗指示：显示模式',
  'config.framedblocks.client.prismOffsetMode': '三棱柱偏移指示：显示模式',
  'config.framedblocks.client.reinforcedMode': '加固状态指示：显示模式',
  'config.framedblocks.client.renderCamoInJade': '在 Jade 界面中渲染伪装',
  'config.framedblocks.client.renderItemModelsWithCamo': '物品模型渲染伪装',
  'config.framedblocks.client.showAllRecipePermutationsInEmi': '在 EMI 中显示框架锯的全部配方排列',
  'config.framedblocks.client.showButtonPlateTypeOverlay': '显示按钮与压力板类型指示',
  'config.framedblocks.client.showCamoCraftingInJei': '在 JEI 中显示伪装合成配方',
  'config.framedblocks.client.showGhostBlocks': '显示放置预览幻影方块',
  'config.framedblocks.client.showSpecialCubeTypeOverlay': '显示特殊方块类型指示',
  'config.framedblocks.client.solidFrameMode': '实心框架模式',
  'config.framedblocks.client.splitLineMode': '可折叠方块分割线指示：显示模式',
  'config.framedblocks.client.stateLockMode': '状态锁定指示：显示模式',
  'config.framedblocks.client.toggleWaterlogMode': '含水切换指示：显示模式',
  'config.framedblocks.client.toggleYSlopeMode': 'Y 轴坡面切换指示：显示模式',
  'config.framedblocks.client.trapdoorTextureRotationMode': '活板门纹理旋转指示：显示模式',
  'config.framedblocks.devtools.connectionDebug': '连接判定调试',
  'config.framedblocks.devtools.doubleBlockPartDebug': '双部件方块调试',
  'config.framedblocks.devtools.occlusionShapeDebug': '遮挡形状调试',
  'config.framedblocks.devtools.quadWindingDebug': '四边形绕向调试',
  'config.framedblocks.devtools.stateMergerDebug': 'StateMerger 调试',
  'config.framedblocks.devtools.stateMergerDebugFilter': 'StateMerger 调试过滤',
  'config.framedblocks.server.allowBlockEntities': '允许方块实体',
  'config.framedblocks.server.consumeCamoItem': '消耗伪装物品',
  'config.framedblocks.server.consumption': '能耗',
  'config.framedblocks.server.craftingDuration': '加工耗时',
  'config.framedblocks.server.enableIntangibleFeature': '启用无形化特性',
  'config.framedblocks.server.energyCapacity': '能量容量',
  'config.framedblocks.server.fireproofBlocks': '防火方块',
  'config.framedblocks.server.glowstoneLightLevel': '荧石亮度等级',
  'config.framedblocks.server.maxReceive': '最大输入功率',
  'config.framedblocks.server.oneWayWindowOwnable': '单向窗归属限制',
  'config.jade.plugin_framedblocks.framed_block_generic': '框架方块伪装',
  'config.jade.plugin_framedblocks.framed_item_frame': '物品展示框框架',
  // blueprint / tooltip descriptions
  'desc.framedblocks.block.fluid_tank.contents': '储存流体：%s',
  'desc.framedblocks.block.fluid_tank.contents.empty': '空',
  'desc.framedblocks.block.stored_camo': '伪装：%s',
  'desc.framedblocks.blueprint_intangible': '无形：%s',
  'desc.framedblocks.blueprint_missing_materials': '[框架蓝图] 缺少所需材料：',
  'desc.framedblocks.blueprint_reinforced': '加固：%s',
  'desc.framedblocks.camo.empty': '空',
  'desc.framedblocks.framed_axe.retain_camo': '用此斧破坏框架方块时保留其伪装，不再单独掉落',
  'desc.framedblocks.slope_slab.place_upside_down': '按住潜行键倒置放置',
  'framedblocks.configuration.general': '常规',
  'framedblocks.configuration.overlay': '指示覆盖层',
  'framedblocks.configuration.powered_framing_saw': '电动框架锯',
  'framedblocks.configuration.section.framedblocks.devtools.toml': '开发工具设置',
  'framedblocks.configuration.section.framedblocks.devtools.toml.title': 'FramedBlocks 开发工具配置',
  'framedblocks.key.wipe_cache': '清除模型缓存',
  // Jade / source tooltip labels
  'label.framedblocks.jade.camo.details_prefix': '    %s',
  'label.framedblocks.jade.camo.double.one': '伪装一：%s',
  'label.framedblocks.jade.camo.double.two': '伪装二：%s',
  'label.framedblocks.jade.camo.single': '伪装：%s',
  'label.framedblocks.source_tooltip.anim_splitter.frames': '帧',
  'label.framedblocks.source_tooltip.anim_splitter.texture': '纹理',
  // messages
  'msg.framedblocks.camo.non_solid': '无标签的非实心方块不能放入框架方块！',
  'msg.framedblocks.camo_application.camo.most_supported': '支持大多数可通过对方块使用来应用伪装的物品',
  'msg.framedblocks.feature.intangibility.disabled': '无形化特性已禁用，此物品因此没有功能！',
  'msg.framedblocks.frame_crafter.fail.camo_present': '输入物品不能带有伪装',
  'msg.framedblocks.frame_crafter.fail.incorrect_additive_0': '第一个槽位中的附加材料不正确',
  'msg.framedblocks.frame_crafter.fail.incorrect_additive_1': '第二个槽位中的附加材料不正确',
  'msg.framedblocks.frame_crafter.fail.incorrect_additive_2': '第三个槽位中的附加材料不正确',
  'msg.framedblocks.frame_crafter.fail.insufficient_additive_0': '第一个槽位中的附加材料数量不足',
  'msg.framedblocks.frame_crafter.fail.insufficient_additive_1': '第二个槽位中的附加材料数量不足',
  'msg.framedblocks.frame_crafter.fail.insufficient_additive_2': '第三个槽位中的附加材料数量不足',
  'msg.framedblocks.frame_crafter.fail.material_lcm': '输入物品过少，无法均分转换为该产物',
  'msg.framedblocks.frame_crafter.fail.material_value': '可用输入材料不足',
  'msg.framedblocks.frame_crafter.fail.missing_additive_0': '第一个槽位缺少附加材料',
  'msg.framedblocks.frame_crafter.fail.missing_additive_1': '第二个槽位缺少附加材料',
  'msg.framedblocks.frame_crafter.fail.missing_additive_2': '第三个槽位缺少附加材料',
  'msg.framedblocks.frame_crafter.fail.output_size': '产物数量超过最大堆叠数',
  'msg.framedblocks.frame_crafter.fail.success': '可制作',
  'msg.framedblocks.frame_crafter.fail.unexpected_additive_0': '第一个槽位存在意外的附加材料',
  'msg.framedblocks.frame_crafter.fail.unexpected_additive_1': '第二个槽位存在意外的附加材料',
  'msg.framedblocks.frame_crafter.fail.unexpected_additive_2': '第三个槽位存在意外的附加材料',
  'msg.framedblocks.framing_saw.search': '搜索…',
  'msg.framedblocks.framing_saw.transfer.invalid_recipe': '无效配方',
  'msg.framedblocks.framing_saw.transfer.not_implemented': '未实现自动填入，不会转移任何物品',
  'msg.framedblocks.powered_saw.status': '状态：',
  'msg.framedblocks.powered_saw.status.no_match': '配方不匹配',
  'msg.framedblocks.powered_saw.status.no_recipe': '无配方',
  'msg.framedblocks.powered_saw.status.ready': '就绪',
  'msg.framedblocks.prism_offset.switch': '用框架锤敲击以切换偏移',
  'msg.framedblocks.split_line.switch': '用框架扳手敲击以切换分割线方向',
  // tags
  'tag.block.framedblocks.group.full': '完整框架方块',
  'tag.item.c.tools.wrench': '扳手',
  'tag.item.framedblocks.disable_intangible': '禁用无形化',
  // tooltips
  'tooltip.framedblocks.camo_rotation.false': '目标伪装不可旋转',
  'tooltip.framedblocks.camo_rotation.true': '目标伪装可旋转',
  'tooltip.framedblocks.copycat_style.set_copycat': '用框架锤敲击以使用仿形外观',
  'tooltip.framedblocks.copycat_style.set_standard': '用框架锤敲击以使用标准外观',
  'tooltip.framedblocks.copycat_style.use_copycat': '目标方块使用仿形外观',
  'tooltip.framedblocks.copycat_style.use_standard': '目标方块使用标准外观',
  'tooltip.framedblocks.frame_bg.set_camo': '用框架锤敲击以伪装作为背景',
  'tooltip.framedblocks.frame_bg.set_leather': '用框架锤敲击以皮革作为背景',
  'tooltip.framedblocks.frame_bg.use_camo': '物品展示框使用伪装作为背景',
  'tooltip.framedblocks.frame_bg.use_leather': '物品展示框使用皮革作为背景',
  'tooltip.framedblocks.framing_saw.have_item_none': '无',
  'tooltip.framedblocks.framing_saw.have_x_but_need_y_item': '已有 %s，但需要 %s',
  'tooltip.framedblocks.framing_saw.have_x_but_need_y_item_count': '已有 %s 个物品，但至少需要 %s 个物品',
  'tooltip.framedblocks.framing_saw.have_x_but_need_y_item_multi': '已有 %s，但需要 %s 或所列替代品',
  'tooltip.framedblocks.framing_saw.have_x_but_need_y_material_count': '已有 %s 材料，但至少需要 %s 材料',
  'tooltip.framedblocks.framing_saw.have_x_but_need_y_tag': '已有 %s，但需要任意 %s',
  'tooltip.framedblocks.framing_saw.loose_additive': '该物品由附加材料合成，这些材料将会丢失',
  'tooltip.framedblocks.framing_saw.material': '材料值：%s',
  'tooltip.framedblocks.framing_saw.mode.crafting': '合成',
  'tooltip.framedblocks.framing_saw.mode.pattern_encode': 'AE2 样板编码',
  'tooltip.framedblocks.framing_saw.output_count': '产物数量：%s，最大数量：%s',
  'tooltip.framedblocks.framing_saw.press_to_show': '按 [%s] 显示全部可用物品',
  'tooltip.framedblocks.framing_saw.use_intermediate': '使用更小的方块作为中间步骤',
  'tooltip.framedblocks.is_waterloggable.false': '该方块不可含水。',
  'tooltip.framedblocks.is_waterloggable.true': '该方块可含水。',
  'tooltip.framedblocks.make_waterloggable.false': '用框架锤敲击以取消含水',
  'tooltip.framedblocks.make_waterloggable.true': '用框架锤敲击以允许含水',
  'tooltip.framedblocks.one_way_window.clear_face': '潜行时用框架扳手敲击以清除透视面',
  'tooltip.framedblocks.one_way_window.curr_face': '当前透视面：%s',
  'tooltip.framedblocks.one_way_window.dir.down': '下',
  'tooltip.framedblocks.one_way_window.dir.east': '东',
  'tooltip.framedblocks.one_way_window.dir.north': '北',
  'tooltip.framedblocks.one_way_window.dir.south': '南',
  'tooltip.framedblocks.one_way_window.dir.up': '上',
  'tooltip.framedblocks.one_way_window.dir.west': '西',
  'tooltip.framedblocks.one_way_window.face.down': '下',
  'tooltip.framedblocks.one_way_window.face.east': '东',
  'tooltip.framedblocks.one_way_window.face.none': '无',
  'tooltip.framedblocks.one_way_window.face.north': '北',
  'tooltip.framedblocks.one_way_window.face.south': '南',
  'tooltip.framedblocks.one_way_window.face.up': '上',
  'tooltip.framedblocks.one_way_window.face.west': '西',
  'tooltip.framedblocks.one_way_window.face_abbr.down': '下',
  'tooltip.framedblocks.one_way_window.face_abbr.east': '东',
  'tooltip.framedblocks.one_way_window.face_abbr.none': '-',
  'tooltip.framedblocks.one_way_window.face_abbr.north': '北',
  'tooltip.framedblocks.one_way_window.face_abbr.south': '南',
  'tooltip.framedblocks.one_way_window.face_abbr.up': '上',
  'tooltip.framedblocks.one_way_window.face_abbr.west': '西',
  'tooltip.framedblocks.one_way_window.set_face': '用框架扳手敲击以将透视面设为%s',
  'tooltip.framedblocks.powered_saw.energy': '%s / %s FE',
  'tooltip.framedblocks.powered_saw.status.no_recipe': '未选择配方，用任意框架方块点击目标槽位以选择配方',
  'tooltip.framedblocks.prism_offset.false': '三角形纹理未偏移。',
  'tooltip.framedblocks.prism_offset.true': '三角形纹理偏移半格。',
  'tooltip.framedblocks.reinforce_state': '该方块%s。',
  'tooltip.framedblocks.reinforce_state.false': '未加固',
  'tooltip.framedblocks.reinforce_state.true': '已加固',
  'tooltip.framedblocks.split_line.false': '变形面的分割线沿陡峭对角线走向。',
  'tooltip.framedblocks.split_line.true': '变形面的分割线沿平缓对角线走向。',
  'tooltip.framedblocks.trapdoor_texture_rotation.false': '打开活板门时伪装纹理不旋转',
  'tooltip.framedblocks.trapdoor_texture_rotation.toggle': '用框架锤敲击以切换纹理旋转',
  'tooltip.framedblocks.trapdoor_texture_rotation.true': '打开活板门时伪装纹理会旋转',
  'tooltip.framedblocks.y_slope': '该方块使用%s面作为竖直坡面。',
  'tooltip.framedblocks.y_slope.alt': '该方块使用%s面作为水平坡面。',
  'tooltip.framedblocks.y_slope.alt.toggle': '用框架扳手敲击以切换到%s面',
  'tooltip.framedblocks.y_slope.front': '正面',
  'tooltip.framedblocks.y_slope.horizontal': '水平',
  'tooltip.framedblocks.y_slope.side': '右面',
  'tooltip.framedblocks.y_slope.toggle': '用框架扳手敲击以切换到%s面',
  'tooltip.framedblocks.y_slope.vertical': '竖直',
};

function genFramedblocks() {
  const en = jarEntry(/^FramedBlocks-.*\.jar$/i, 'assets/framedblocks/lang/en_us.json');
  const zh = jarEntry(/^FramedBlocks-.*\.jar$/i, 'assets/framedblocks/lang/zh_cn.json');
  const out = {};
  const missing = [];
  for (const k of Object.keys(en)) {
    if (k in zh) continue;
    if (FB_ZH[k]) out[k] = FB_ZH[k];
    else missing.push(`${k} = ${en[k]}`);
  }
  if (missing.length) {
    throw new Error(`framedblocks: ${missing.length} keys lack translations in FB_ZH:\n${missing.join('\n')}`);
  }
  return out;
}

for (const [ns, gen] of [
  ['framedblocks', genFramedblocks],
  ['mcwfurnitures', genMcwFurniture],
  ['mdm', genMdm],
]) {
  const dict = gen();
  const dir = path.join(root, 'pack/kubejs/assets', ns, 'lang');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'zh_cn.json');
  writeFileSync(file, JSON.stringify(dict, null, 1) + '\n');
  console.log(`gen-mod-lang-zh: wrote ${path.relative(root, file)} (${Object.keys(dict).length} keys)`);
}
