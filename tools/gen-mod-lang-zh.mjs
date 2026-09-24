// Generates zh_cn lang fallbacks for shipped mods whose bundled zh_cn.json is
// incomplete (framedblocks, mcwfurnitures) or absent entirely
// Output lands in pack/kubejs/assets/<mod>/lang/zh_cn.json;
// KubeJS assets merge over the jar's own lang file, so only MISSING keys are written.
// Re-run after bumping any covered mod jar:  node tools/gen-mod-lang-zh.mjs
// Reads jars via `unzip -p`, falling back to `tar -xOf` (bsdtar only; GNU tar can't read zips).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function jarPath(jarGlob) {
  const jar = readdirSync(path.join(root, 'mods')).find((f) => jarGlob.test(f));
  if (!jar) throw new Error(`gen-mod-lang-zh: no jar matching ${jarGlob} in mods/`);
  return path.join(root, 'mods', jar);
}

function jarText(jarGlob, entry) {
  const p = jarPath(jarGlob);
  try {
    return execFileSync('unzip', ['-p', p, entry], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch {
    return execFileSync('tar', ['-xOf', p, entry], { encoding: 'utf8', maxBuffer: 64 << 20 });
  }
}

function jarList(jarGlob) {
  const p = jarPath(jarGlob);
  let out;
  try {
    out = execFileSync('unzip', ['-Z1', p], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch {
    out = execFileSync('tar', ['-tf', p], { encoding: 'utf8', maxBuffer: 64 << 20 });
  }
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function jarEntry(jarGlob, entry) {
  return JSON.parse(jarText(jarGlob, entry));
}

// Gunpack index/data files are JSONC (// comments). Strip comments without
// touching "//" sequences inside string literals.
function parseJsonc(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM — e.g. fastpipes zh_cn
  let out = '', inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else out += c;
  }
  return JSON.parse(out);
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
// refurbished_furniture: jar ships en_us only — every key needs a zh value.
// Block names are compositional (wood/color prefix + piece suffix); the piece
// table below resolves all ~450 block keys, and RF_KEY_ZH covers the rest.
// The generator throws on anything unmapped.
// ---------------------------------------------------------------------------

const RF_WOOD = {
  oak: '橡木', spruce: '云杉木', birch: '白桦木', jungle: '丛林木',
  acacia: '金合欢木', dark_oak: '深色橡木', crimson: '绯红木',
  warped: '诡异木', mangrove: '红树木', cherry: '樱花木',
};

const RF_COLOR = {
  white: '白色', light_gray: '淡灰色', gray: '灰色', black: '黑色',
  brown: '棕色', red: '红色', orange: '橙色', yellow: '黄色',
  lime: '黄绿色', green: '绿色', cyan: '青色', light_blue: '淡蓝色',
  blue: '蓝色', purple: '紫色', magenta: '品红色', pink: '粉红色',
};

const RF_PIECE = {
  andesite_stepping_stones: '安山岩踏脚石', azalea_hedge: '杜鹃树篱',
  basin: '洗手盆', bath: '浴缸', chair: '椅子', computer: '电脑',
  cooler: '冷藏箱', crate: '板条箱', cutting_board: '切菜板',
  dark_ceiling_fan: '深色吊扇', dark_ceiling_light: '深色吊灯',
  dark_electricity_generator: '深色发电机', dark_fridge: '深色冰箱',
  dark_lightswitch: '深色灯开关', dark_microwave: '深色微波炉',
  dark_range_hood: '深色抽油烟机', dark_stove: '深色炉灶',
  dark_toaster: '深色烤面包机', deepslate_stepping_stones: '深板岩踏脚石',
  desk: '书桌', diorite_stepping_stones: '闪长岩踏脚石', door_mat: '门垫',
  doorbell: '门铃', drawer: '抽屉柜', frying_pan: '煎锅',
  granite_stepping_stones: '花岗岩踏脚石', grill: '烤架', hedge: '树篱',
  kitchen_cabinetry: '厨房橱柜', kitchen_drawer: '厨房抽屉',
  kitchen_sink: '厨房水槽', kitchen_storage_cabinet: '厨房储物柜',
  lamp: '灯', lattice_fence: '格栅栅栏', lattice_fence_gate: '格栅栅栏门',
  light_ceiling_fan: '浅色吊扇', light_ceiling_light: '浅色吊灯',
  light_electricity_generator: '浅色发电机', light_fridge: '浅色冰箱',
  light_lightswitch: '浅色灯开关', light_microwave: '浅色微波炉',
  light_range_hood: '浅色抽油烟机', light_stove: '浅色炉灶',
  light_toaster: '浅色烤面包机', mail_box: '信箱', milk: '牛奶',
  plate: '盘子', post_box: '邮筒', recycle_bin: '回收箱', sofa: '沙发',
  stone_stepping_stones: '石头踏脚石', stool: '凳子',
  storage_cabinet: '储物柜', storage_jar: '储物罐', table: '桌子',
  television: '电视机', toilet: '马桶', trampoline: '蹦床',
  workbench: '工作台',
};

const RF_KEY_ZH = {
  'itemGroup.refurbished_furniture': 'MrCrayfish 的家具：Refurbished',
  'filterCategory.refurbished_furniture.general': '通用',
  'filterCategory.refurbished_furniture.general.desc': '基础家具：椅子、桌子等',
  'filterCategory.refurbished_furniture.bedroom': '卧室',
  'filterCategory.refurbished_furniture.bedroom.desc': '床、书桌、梳妆台等',
  'filterCategory.refurbished_furniture.kitchen': '厨房',
  'filterCategory.refurbished_furniture.kitchen.desc': '橱柜、台面、电器等',
  'filterCategory.refurbished_furniture.bathroom': '浴室',
  'filterCategory.refurbished_furniture.bathroom.desc': '马桶、洗手盆等',
  'filterCategory.refurbished_furniture.electronics': '电子',
  'filterCategory.refurbished_furniture.electronics.desc': '灯具、电脑、发电机等',
  'filterCategory.refurbished_furniture.outdoors': '户外',
  'filterCategory.refurbished_furniture.outdoors.desc': '信箱、树篱、栅栏等',
  'filterCategory.refurbished_furniture.storage': '储物',
  'filterCategory.refurbished_furniture.storage.desc': '所有带储物功能的家具与装饰',
  'filterCategory.refurbished_furniture.food': '食物',
  'filterCategory.refurbished_furniture.food.desc': '食物与烹饪食材',
  'filterCategory.refurbished_furniture.items': '物品',
  'filterCategory.refurbished_furniture.items.desc': '锅铲、平底锅、吐司等所有物品',
  'death.attack.refurbished_furniture.ceiling_fan': '%1$s 被吊扇切成了碎片',
  'death.attack.refurbished_furniture.ceiling_fan.player': '%1$s 被吊扇切成了碎片',
  'container.refurbished_furniture.workbench': '工作台',
  'container.refurbished_furniture.drawer': '抽屉柜',
  'container.refurbished_furniture.crate': '板条箱',
  'container.refurbished_furniture.kitchen_drawer': '厨房抽屉',
  'container.refurbished_furniture.cooler': '冷藏箱',
  'container.refurbished_furniture.fridge': '冰箱',
  'container.refurbished_furniture.freezer': '冷冻柜',
  'container.refurbished_furniture.microwave': '微波炉',
  'container.refurbished_furniture.stove': '炉灶',
  'container.refurbished_furniture.mailbox': '信箱',
  'container.refurbished_furniture.post_box': '邮筒',
  'container.refurbished_furniture.electricity_generator': '发电机',
  'container.refurbished_furniture.recycle_bin': '回收箱',
  'container.refurbished_furniture.storage_cabinet': '储物柜',
  'container.refurbished_furniture.lightswitch': '灯开关',
  'gui.refurbished_furniture.set_mailbox_name': '设置信箱名称',
  'gui.refurbished_furniture.rename_mailbox_failed': '更新信箱名称失败',
  'gui.refurbished_furniture.mailboxes': '信箱',
  'gui.refurbished_furniture.search': '搜索……',
  'gui.refurbished_furniture.search_mailboxes': '搜索信箱',
  'gui.refurbished_furniture.enter_message': '输入留言……',
  'gui.refurbished_furniture.package_message': '包裹留言',
  'gui.refurbished_furniture.send': '发送',
  'gui.refurbished_furniture.how_to': '使用方法',
  'gui.refurbished_furniture.post_box_info': '从列表中选择一个信箱，可按名称搜索，或用 @ 前缀搜索玩家。把物品放入包裹槽位并可附上留言，点击发送按钮投递包裹。',
  'gui.refurbished_furniture.workbench_info': '从列表中选择配方并备好所需材料即可制作。工作台会搜索你的背包、自身储物以及相邻储物方块中的材料。',
  'gui.refurbished_furniture.package_sent_by': '寄件人：%s',
  'gui.refurbished_furniture.package_open': '右键点击打开',
  'gui.refurbished_furniture.set_doorbell_name': '设置门铃名称',
  'gui.refurbished_furniture.doorbell_rang': '门铃响了',
  'gui.refurbished_furniture.status.online': '在线',
  'gui.refurbished_furniture.status.offline': '离线',
  'gui.refurbished_furniture.status.overloaded': '过载',
  'gui.refurbished_furniture.status.no_fuel': '燃料耗尽',
  'gui.refurbished_furniture.node_count': '%s / %s',
  'gui.refurbished_furniture.recycle': '回收',
  'gui.refurbished_furniture.save': '保存',
  'gui.refurbished_furniture.next_preset': '下一预设',
  'gui.refurbished_furniture.previous_preset': '上一预设',
  'gui.refurbished_furniture.no_power': '缺少电力',
  'gui.refurbished_furniture.link_too_long': '距离过远',
  'gui.refurbished_furniture.link_too_many': '连接过多',
  'gui.refurbished_furniture.link_already_connected': '已连接',
  'gui.refurbished_furniture.link_invalid_node': '无效节点',
  'gui.refurbished_furniture.link_unpowerable': '该连接不会被供电',
  'gui.refurbished_furniture.link_outside_area': '连接跨出了供电区域',
  'gui.refurbished_furniture.connect_to_power': '请确保该方块正在接受 %s 供电，可用 %s 连接。',
  'gui.refurbished_furniture.electricity_generator': '发电机',
  'gui.refurbished_furniture.jei_campfire_info': '继承自营火烹饪',
  'gui.refurbished_furniture.progress': '%s %s %s',
  'gui.refurbished_furniture.hold_for_details': '按住 %s 查看详情',
  'gui.refurbished_furniture.shift': 'SHIFT',
  'gui.refurbished_furniture.show_all_categories': '显示全部',
  'gui.refurbished_furniture.mail_box_limit': '你的信箱数量已达上限',
  'gui.refurbished_furniture.invalid_dimension': '此维度无法放置信箱',
  'gui.refurbished_furniture.invalid_mailbox': '信箱已禁用：当前维度不允许',
  'gui.refurbished_furniture.default_mailbox_name': '信箱',
  'gui.refurbished_furniture.unknown_mailbox_owner': '未知玩家',
  'gui.refurbished_furniture.delivery_service.unknown_mailbox': '信箱未知或无效',
  'gui.refurbished_furniture.delivery_service.mailbox_queue_full': '所选信箱的邮件队列已满',
  'gui.refurbished_furniture.delivery_service.undeliverable_dimension': '所选信箱位于无法投递的维度',
  'gui.refurbished_furniture.delivery_service.package_sent': '包裹已发送！',
  'gui.refurbished_furniture.booting': '启动中……',
  'gui.refurbished_furniture.sliceable': '可切片',
  'gui.refurbished_furniture.placeable': '可放置',
  'gui.refurbished_furniture.workbench.search_neighbours.off': '忽略相邻容器',
  'gui.refurbished_furniture.workbench.search_neighbours.on': '包含相邻容器',
  'gui.refurbished_furniture.experience_level': '%s/%s 级',
  'gui.refurbished_furniture.experience_points': '%s 点',
  'gui.refurbished_furniture.withdraw_experience': '提取经验',
  'gui.refurbished_furniture.requires_power': '需要 %s 供电',
  'subtitle.refurbished_furniture.package_open': '撕纸板',
  'subtitle.refurbished_furniture.chair_slide': '木头滑动',
  'subtitle.refurbished_furniture.doorbell_chime': '门铃响',
  'subtitle.refurbished_furniture.electricity_generator_engine': '发电机运转',
  'subtitle.refurbished_furniture.storage_jar_insert_item': '物品放入',
  'subtitle.refurbished_furniture.recycle_bin_engine': '粉碎',
  'subtitle.refurbished_furniture.ceiling_fan_spin': '风扇转动',
  'subtitle.refurbished_furniture.lightswitch_flick': '开关拨动',
  'subtitle.refurbished_furniture.trampoline_bounce': '弹跳',
  'subtitle.refurbished_furniture.trampoline_super_bounce': '强力弹跳',
  'subtitle.refurbished_furniture.television_channel.colour_test': '高音调测试音',
  'subtitle.refurbished_furniture.television_channel.white_noise': '白噪声',
  'subtitle.refurbished_furniture.television_channel.dance_music': '舞曲节拍',
  'subtitle.refurbished_furniture.television_channel.villager_news': '新闻频道',
  'subtitle.refurbished_furniture.television_channel.chirp_song': '鸟鸣伴歌',
  'subtitle.refurbished_furniture.television_channel.ocean_sunset': 'LoFi 节拍',
  'subtitle.refurbished_furniture.television_channel.blocky_game': '钢琴曲',
  'subtitle.refurbished_furniture.television_channel.retro_song': '复古街机曲',
  'subtitle.refurbished_furniture.frying_pan.place_ingredient': '啪嗒',
  'subtitle.refurbished_furniture.frying_pan.break': '金属铿锵',
  'subtitle.refurbished_furniture.frying_pan.hit': '金属敲击',
  'subtitle.refurbished_furniture.frying_pan.place': '金属放置',
  'subtitle.refurbished_furniture.frying_pan.step': '金属脚步',
  'subtitle.refurbished_furniture.frying_pan.sizzling': '滋滋作响',
  'subtitle.refurbished_furniture.toaster.down': '烤面包机启动',
  'subtitle.refurbished_furniture.toaster.pop': '烤面包机弹出',
  'subtitle.refurbished_furniture.toaster.insert': '烤面包机咔哒',
  'subtitle.refurbished_furniture.cooler.open': '冷藏箱打开',
  'subtitle.refurbished_furniture.cooler.close': '冷藏箱关闭',
  'subtitle.refurbished_furniture.microwave.open': '微波炉打开',
  'subtitle.refurbished_furniture.microwave.close': '微波炉关闭',
  'subtitle.refurbished_furniture.kitchen_drawer.open': '抽屉拉开',
  'subtitle.refurbished_furniture.kitchen_drawer.close': '抽屉合上',
  'subtitle.refurbished_furniture.cutting_board.place_ingredient': '物品放上',
  'subtitle.refurbished_furniture.kitchen_sink.fill': '水流声',
  'subtitle.refurbished_furniture.fridge.open': '冰箱打开',
  'subtitle.refurbished_furniture.fridge.close': '冰箱关闭',
  'subtitle.refurbished_furniture.stove.open': '烤箱打开',
  'subtitle.refurbished_furniture.stove.close': '烤箱关闭',
  'subtitle.refurbished_furniture.freezer.open': '冷冻柜打开',
  'subtitle.refurbished_furniture.freezer.close': '冷冻柜关闭',
  'subtitle.refurbished_furniture.drawer.open': '木抽屉拉开',
  'subtitle.refurbished_furniture.drawer.close': '木抽屉合上',
  'subtitle.refurbished_furniture.workbench.craft': '物品制成',
  'subtitle.refurbished_furniture.wrench_selected_node': '节点高亮',
  'subtitle.refurbished_furniture.wrench_remove_link': '断开连接',
  'subtitle.refurbished_furniture.wrench_connected_link': '连接建立',
  'subtitle.refurbished_furniture.wrench_hover_link': '悬停连接',
  'subtitle.refurbished_furniture.knife_chop': '刀切',
  'subtitle.refurbished_furniture.spatula_scoop': '锅铲翻取',
  'subtitle.refurbished_furniture.cabinet.open': '柜门打开',
  'subtitle.refurbished_furniture.cabinet.close': '柜门关闭',
  'subtitle.refurbished_furniture.microwave.fan': '微波炉嗡鸣',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_click': '复古点击',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_hit': '复古击打',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_success': '复古得分',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_fail': '复古失误',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_win': '复古胜利',
  'subtitle.refurbished_furniture.ui.paddle_ball.retro_lose': '复古落败',
  'computer_program.refurbished_furniture.paddle_ball': '弹接球',
  'computer_program.refurbished_furniture.paddle_ball.play_ai': '对战 AI',
  'computer_program.refurbished_furniture.paddle_ball.play_vs': '玩家对战',
  'computer_program.refurbished_furniture.paddle_ball.main_menu': '主菜单',
  'computer_program.refurbished_furniture.paddle_ball.you': '你',
  'computer_program.refurbished_furniture.paddle_ball.win_game': '你赢了 :)',
  'computer_program.refurbished_furniture.paddle_ball.lose_game': '你输了 :(',
  'computer_program.refurbished_furniture.paddle_ball.searching_players': '正在寻找对手……',
  'computer_program.refurbished_furniture.paddle_ball.opponent_left': '对手离开了游戏',
  'computer_program.refurbished_furniture.paddle_ball.cancel': '取消',
  'computer_program.refurbished_furniture.paddle_ball.server_required': '需要在服务器中游玩',
  'computer_program.refurbished_furniture.home_control': '智能家居',
  'computer_program.refurbished_furniture.home_control.turn_on_all': '全部打开',
  'computer_program.refurbished_furniture.home_control.turn_off_all': '全部关闭',
  'computer_program.refurbished_furniture.home_control.info': '智能家居可控制同一电力网络上的设备供电。设备必须与电脑连接在同一网络中才能被发现。在铁砧中重命名设备后再放置，可在应用中更好地区分它们。',
  'computer_program.refurbished_furniture.marketplace': '市场',
  'computer_program.refurbished_furniture.coin_miner': '金币矿工',
  'jei_category.refurbished_furniture.freezer_solidifying': '凝固',
  'jei_category.refurbished_furniture.cutting_board_slicing': '切片',
  'jei_category.refurbished_furniture.frying_pan_cooking': '煎炒',
  'jei_category.refurbished_furniture.microwave_heating': '加热',
  'jei_category.refurbished_furniture.recycle_bin_recycling': '回收',
  'jei_category.refurbished_furniture.toaster_heating': '烘烤',
  'jei_category.refurbished_furniture.grill_cooking': '烧烤',
  'jei_category.refurbished_furniture.cutting_board_combining': '合成',
  'jei_category.refurbished_furniture.workbench_constructing': '组装',
  'jei_category.refurbished_furniture.oven_baking': '烘焙',
  'jei_category.refurbished_furniture.sink_fluid_transmuting': '流体转化',
  'backpack.refurbished_furniture.cabinet': '储物柜',
  'backpack.refurbished_furniture.cabinet.unlock': '打开任意储物柜即可解锁此背包',
  'item.refurbished_furniture.spatula': '锅铲',
  'item.refurbished_furniture.knife': '菜刀',
  'item.refurbished_furniture.package': '包裹',
  'item.refurbished_furniture.wrench': '扳手',
  'item.refurbished_furniture.television_remote': '电视遥控器',
  'item.refurbished_furniture.bread_slice': '面包片',
  'item.refurbished_furniture.toast': '吐司',
  'item.refurbished_furniture.sweet_berry_jam': '甜浆果酱',
  'item.refurbished_furniture.sweet_berry_jam_toast': '甜浆果酱吐司',
  'item.refurbished_furniture.glow_berry_jam': '发光浆果酱',
  'item.refurbished_furniture.glow_berry_jam_toast': '发光浆果酱吐司',
  'item.refurbished_furniture.sea_salt': '海盐',
  'item.refurbished_furniture.wheat_flour': '小麦粉',
  'item.refurbished_furniture.dough': '面团',
  'item.refurbished_furniture.cheese': '奶酪',
  'item.refurbished_furniture.cheese_sandwich': '奶酪三明治',
  'item.refurbished_furniture.cheese_toastie': '烤奶酪三明治',
  'item.refurbished_furniture.raw_vegetable_pizza': '生蔬菜披萨',
  'item.refurbished_furniture.cooked_vegetable_pizza': '熟蔬菜披萨',
  'item.refurbished_furniture.vegetable_pizza_slice': '蔬菜披萨片',
  'item.refurbished_furniture.raw_meatlovers_pizza': '生肉食披萨',
  'item.refurbished_furniture.cooked_meatlovers_pizza': '熟肉食披萨',
  'item.refurbished_furniture.meatlovers_pizza_slice': '肉食披萨片',
};

function rfPieceZh(rest) {
  for (const [w, zh] of Object.entries(RF_WOOD)) {
    if (rest.startsWith(w + '_')) {
      const piece = RF_PIECE[rest.slice(w.length + 1)];
      return piece ? zh + piece : null;
    }
  }
  for (const c of Object.keys(RF_COLOR).sort((a, b) => b.length - a.length)) {
    if (rest.startsWith(c + '_')) {
      const piece = RF_PIECE[rest.slice(c.length + 1)];
      return piece ? RF_COLOR[c] + piece : null;
    }
  }
  return RF_PIECE[rest] ?? null;
}

function genRefurbished() {
  const en = jarEntry(/^refurbished_furniture-.*\.jar$/i, 'assets/refurbished_furniture/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (RF_KEY_ZH[k]) { out[k] = RF_KEY_ZH[k]; continue; }
    const m = k.match(/^(?:block|item)\.refurbished_furniture\.(.+)$/);
    const zh = m ? rfPieceZh(m[1]) : null;
    if (zh) out[k] = zh;
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`refurbished_furniture: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// energizedfurniture / tmted (Engineers Delight) / immersivecooking: small
// en_us-only sets — fully explicit tables.
// ---------------------------------------------------------------------------

const EF_KEY_ZH = {
  'itemGroup.energizedfurniture': '电力家具',
  'block.energizedfurniture.energy_transformer': '能量变压器',
  'gui.energizedfurniture.status.online': '在线',
  'gui.energizedfurniture.status.offline': '离线',
  'gui.energizedfurniture.status.overloaded': '过载',
  'gui.energizedfurniture.status.no_fuel': '燃料耗尽',
  'gui.energizedfurniture.energy_type.none': '无',
  'gui.energizedfurniture.energy_type.fe': 'FE',
  'gui.energizedfurniture.energy_type.fuel': '燃料',
  'gui.energizedfurniture.node_count': '%s / %s',
  'gui.energizedfurniture.progress': '%s %s %s',
  'container.energizedfurniture.energy_transformer': '能量变压器',
};

function genEnergized() {
  const en = jarEntry(/^energizedfurniture-.*\.jar$/i, 'assets/energizedfurniture/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (EF_KEY_ZH[k]) out[k] = EF_KEY_ZH[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`energizedfurniture: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

const TMTED_KEY_ZH = {
  'itemGroup.tmted': '工程师乐事',
  'block.tmted.example_block': '示例方块',
  'item.tmted.example_item': '示例物品',
  'block.tmted.apple_cider': '苹果酒',
  'block.tmted.melon_juice': '西瓜汁',
  'block.tmted.tomato_sauce': '番茄酱',
  'fluid.tmted.apple_cider': '苹果酒',
  'fluid.tmted.melon_juice': '西瓜汁',
  'fluid.tmted.tomato_sauce': '番茄酱',
  'fluid_type.tmted.apple_cider': '苹果酒',
  'fluid_type.tmted.melon_juice': '西瓜汁',
  'fluid_type.tmted.tomato_sauce': '番茄酱',
  'item.tmted.bottle_of_wodka': '伏特加酒瓶',
  'item.tmted.wheat_flour': '小麦粉',
  'item.tmted.steel_knife': '钢刀',
};

function genTmted() {
  const en = jarEntry(/^engineers_delight-.*\.jar$/i, 'assets/tmted/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (TMTED_KEY_ZH[k]) out[k] = TMTED_KEY_ZH[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`tmted: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

const IC_KEY_ZH = {
  'itemGroup.immersivecooking': '沉浸烹饪与农业',
  'manual.immersivecooking.main': '沉浸烹饪与农业',
  'manual.immersivecooking.multiblocks': '多方块结构',
  'manual.immersivecooking.entry.cookpot': '工业煮锅',
  'manual.immersivecooking.entry.grill_oven': '烤炉',
  'subtitle.immersivecooking.cookpot.active': '煮锅沸腾',
  'subtitle.immersivecooking.food_fermenter.active': '食品发酵罐冷却中',
  'block.immersivecooking.cookpot': '工业煮锅',
  'block.immersivecooking.grill_oven': '烤炉',
  'block.immersivecooking.food_fermenter': '工业食品发酵罐',
  'config.jade.plugin_immersivecooking.food_fermenter_data': '食品发酵罐数据',
  'tooltip.immersivecooking.fermenting': '发酵中',
  'tooltip.immersivecooking.remaining_time': '剩余时间：%s 秒',
};

const IC_FLUID_ZH = {
  apple_juice: '苹果汁',
  red_grapejuice: '红葡萄汁', red_taiga_grapejuice: '针叶林红葡萄汁',
  red_jungle_grapejuice: '丛林红葡萄汁', red_savanna_grapejuice: '热带草原红葡萄汁',
  white_grapejuice: '白葡萄汁', white_taiga_grapejuice: '针叶林白葡萄汁',
  white_jungle_grapejuice: '丛林白葡萄汁', white_savanna_grapejuice: '热带草原白葡萄汁',
  honey: '蜂蜜',
};

function icZh(k) {
  if (IC_KEY_ZH[k]) return IC_KEY_ZH[k];
  let m = k.match(/^(?:fluid|fluid_type)\.immersivecooking\.(\w+)$/);
  if (m) return IC_FLUID_ZH[m[1]] ?? null;
  m = k.match(/^item\.immersivecooking\.(\w+)_bucket$/);
  if (m && IC_FLUID_ZH[m[1]]) return `${IC_FLUID_ZH[m[1]]}桶`;
  m = k.match(/^block\.immersivecooking\.(\w+)_fluid_block$/);
  if (m && IC_FLUID_ZH[m[1]]) return IC_FLUID_ZH[m[1]];
  return null;
}

function genImmersiveCooking() {
  const en = jarEntry(/^immersivecooking-.*\.jar$/i, 'assets/immersivecooking/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    const zh = icZh(k);
    if (zh) out[k] = zh;
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`immersivecooking: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
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

// ---------------------------------------------------------------------------
// taczturrets: jar ships en_us only — small explicit table.
// ---------------------------------------------------------------------------

const TT_KEY_ZH = {
  'command.taczturrets.trusted': '已信任 %s 名玩家。',
  'command.taczturrets.trusted_list': '%s 名受信任玩家：%s',
  'command.taczturrets.trusted_none': '你没有任何受信任玩家。',
  'command.taczturrets.untrusted': '已移除 %s 名玩家的信任。',
  'entity.taczturrets.turret': '炮塔',
  'gui.taczturrets.allies': '盟友',
  'gui.taczturrets.allies.ally': '盟友',
  'gui.taczturrets.allies.empty': '没有其他在线玩家。',
  'gui.taczturrets.enable_type.always_off': '始终关闭',
  'gui.taczturrets.enable_type.always_off.tooltip': '炮塔已关闭。',
  'gui.taczturrets.enable_type.always_on': '始终开启',
  'gui.taczturrets.enable_type.always_on.tooltip': '炮塔持续运转。',
  'gui.taczturrets.enable_type.redstone_off': '红石关闭',
  'gui.taczturrets.enable_type.redstone_off.tooltip': '炮塔在收到红石信号时停止。',
  'gui.taczturrets.enable_type.redstone_on': '红石开启',
  'gui.taczturrets.enable_type.redstone_on.tooltip': '炮塔仅在收到红石信号时运转。',
  'gui.taczturrets.energy': '能量：%s / %s FE',
  'gui.taczturrets.health': '生命值：%s / %s',
  'gui.taczturrets.mode.adaptive': '自适应',
  'gui.taczturrets.mode.adaptive.tooltip': '远距离节省弹药，目标接近时转为激进射击。',
  'gui.taczturrets.mode.aggressive': '激进',
  'gui.taczturrets.mode.aggressive.tooltip': '以枪械允许的极限射速开火并立即切换下一个目标。',
  'gui.taczturrets.mode.conservative': '保守',
  'gui.taczturrets.mode.conservative.tooltip': '拉开射击间隔以节省弹药。',
  'gui.taczturrets.owner': '主人：%s',
  'gui.taczturrets.player_targeting.all': '始终索敌',
  'gui.taczturrets.player_targeting.all.tooltip': '始终以非盟友玩家为目标。',
  'gui.taczturrets.player_targeting.never': '从不索敌',
  'gui.taczturrets.player_targeting.never.tooltip': '从不以玩家为目标。',
  'gui.taczturrets.player_targeting.retaliate': '反击',
  'gui.taczturrets.player_targeting.retaliate.tooltip': '被非盟友玩家伤害时反击。',
  'item.taczturrets.turret': '炮塔',
  'subtitles.taczturrets.turret_pickup': '炮塔：收回',
  'subtitles.taczturrets.turret_place': '炮塔：部署',
};

function genTaczTurrets() {
  const en = jarEntry(/^taczturrets-.*\.jar$/i, 'assets/taczturrets/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (TT_KEY_ZH[k]) out[k] = TT_KEY_ZH[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`taczturrets: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// creaturefeature: jar ships en_us only. Entity names are a table (they feed
// both the entity keys and the *_spawn_egg item names); everything else is
// explicit.
// ---------------------------------------------------------------------------

const CF_ENTITY_ZH = {
  beauty: '美人', blitz: '闪击', blossom: '绽放', bullet: '弹丸',
  canary: '金丝雀', canary_part: '金丝雀部件', cannonball_crab: '逃逸者',
  coat_of_arms: '纹章', detritus: '碎屑', dreamweaver: '织梦者',
  eep: '点燃的咿啪', eeper: '咿啪', feather: '羽毛', fend: '挡御',
  fiend: '邪魔', friend: '朋友.png', kicked_block: '被踢飞的方块',
  machination: '诡计', minds: '心智体', minedflayer: '矿魇',
  mockingbird: '嘲鸫', murky_pearl: '浑珠', nothing: '无物',
  pathogen: '核体', saint_solis: '圣索利斯', sinister: '险恶体',
  stained_glass: '染色玻璃', star: '星辰', toadstool: '毒菇', vertigo: '眩晕体',
};

const CF_KEY_ZH = {
  'advancement.creaturefeature.friendless': '没朋友',
  'advancement.creaturefeature.friendless.desc': '伤害你的「朋友」。',
  'advancement.creaturefeature.gas': '满屋子都是毒气',
  'advancement.creaturefeature.gas.desc': '在金丝雀释放的气体中开始窒息。',
  'advancement.creaturefeature.horse': '我恨马',
  'advancement.creaturefeature.horse.desc': '用重斧把马扔出去。',
  'advancement.creaturefeature.pill': '褪黑素',
  'advancement.creaturefeature.pill.desc': '吞下那颗药丸。',
  'advancement.creaturefeature.prion': '尝起来像朊病毒',
  'advancement.creaturefeature.prion.desc': '使用眩晕号角。',
  'advancement.creaturefeature.renovation': '翻新',
  'advancement.creaturefeature.renovation.desc': '用刷子更换编羽的花纹。',
  'advancement.creaturefeature.root': '生物特性',
  'advancement.creaturefeature.root.desc': '主打的就是生物。',
  'advancement.creaturefeature.roots': '找到了。',
  'advancement.creaturefeature.roots.desc': '在灼热平原上再次相会。',
  'advancement.creaturefeature.sinister': '背后捅刀',
  'advancement.creaturefeature.sinister.desc': '从背后攻击险恶体，它就不会反弹攻击。',
  'advancement.creaturefeature.sleepy': '睡吧，睡吧',
  'advancement.creaturefeature.sleepy.desc': '睡着了？',
  'block.creaturefeature.blind_fiendish_tiles': '盲眼邪纹砖',
  'block.creaturefeature.carapace_block': '甲壳块',
  'block.creaturefeature.carapace_brick_stairs': '甲壳砖楼梯',
  'block.creaturefeature.carapace_bricks': '甲壳砖',
  'block.creaturefeature.doohickey': '小玩意儿',
  'block.creaturefeature.down_feathers': '嘲鸫绒羽辫',
  'block.creaturefeature.down_feathers_carpet': '嘲鸫绒羽地毯',
  'block.creaturefeature.dream_silk_spool': '梦丝线轴',
  'block.creaturefeature.eep': '咿啪',
  'block.creaturefeature.fiendish_tiles': '邪纹砖',
  'block.creaturefeature.minedflayer_jelly': '矿魇冻',
  'block.creaturefeature.mosaic_down_feathers': '嘲鸫绒羽马赛克',
  'block.creaturefeature.mosaic_down_feathers_carpet': '嘲鸫绒羽马赛克地毯',
  'block.creaturefeature.murky_pearl_block': '浑珠块',
  'block.creaturefeature.murky_pearl_tile_stairs': '浑珠砖楼梯',
  'block.creaturefeature.murky_pearl_tiles': '浑珠砖',
  'block.creaturefeature.runic_stone_bricks': '符文石砖……？咦',
  'block.creaturefeature.solar_block': '烈阳块',
  'block.creaturefeature.solar_bricks': '烈阳砖',
  'block.creaturefeature.wallpaper': '墙纸',
  'container.creaturefeature.open_mind': '开放思维',
  'creaturefeature.configuration.depth': 'Depth Vista 兼容测试',
  'creaturefeature.configuration.endreamweaver': '末地织梦者',
  'creaturefeature.configuration.ff_reloaded': 'Fiend Folio: RELOADED',
  'creaturefeature.configuration.fixsas': '圣索利斯调整',
  'creaturefeature.configuration.pathogen': '病原体生成重做',
  'creaturefeature.configuration.remodelfriend': '重塑「朋友」模型',
  'creaturefeature.configuration.remodelmb': '重塑嘲鸫模型',
  'creaturefeature.configuration.saint_solis': '星辰减速',
  'creaturefeature.configuration.section.creaturefeature.client.toml': '客户端配置……',
  'creaturefeature.configuration.section.creaturefeature.client.toml.title': '客户端生物！',
  'creaturefeature.configuration.section.creaturefeature.server.toml': '服务端配置……',
  'creaturefeature.configuration.section.creaturefeature.server.toml.title': '服务端生物！',
  'creaturefeature.configuration.title': '配置特性！',
  'desc.creaturefeature.bouquet': '与其他花放在一起时会复制它们。',
  'desc.creaturefeature.doohickey': '放入相关物品时可能增殖某些视觉效果。',
  'desc.creaturefeature.dreamcatcher': '捕获方块，保存除存储外的一切。',
  'desc.creaturefeature.living_glass': '清除目标的 1 个效果，随后碎裂。',
  'desc.creaturefeature.murky': '好像……没什么用。',
  'desc.creaturefeature.open_mind': '打开你的网格。',
  'desc.creaturefeature.soda': '其实是一块苏打形状的果冻。',
  'desc.creaturefeature.solar': '由星辰碰撞获得。',
  'desc.creaturefeature.thepill': '重置幻翼生成计时器。',
  'effect.creaturefeature.fiendish': '邪祟',
  'effect.creaturefeature.sleepy': '困倦',
  'info.creaturefeature.dreamcatcher': '万千思绪待思量……',
  'item.creaturefeature.bacterium_ball': '细菌球',
  'item.creaturefeature.blighted_brain': '枯败之脑',
  'item.creaturefeature.blitz_rod': '闪击碎片',
  'item.creaturefeature.bouquet': '活花束',
  'item.creaturefeature.carapace': '甲壳',
  'item.creaturefeature.coat_scraps': '纹章碎布',
  'item.creaturefeature.down_feather': '绒羽',
  'item.creaturefeature.dream_silk': '梦丝',
  'item.creaturefeature.dreamcatcher': '捕梦网',
  'item.creaturefeature.ectoplasm': '灵质',
  'item.creaturefeature.fiendish_essence': '邪祟精华',
  'item.creaturefeature.fiendish_soda': '邪祟苏打',
  'item.creaturefeature.flintlock': '脆弱的燧发枪',
  'item.creaturefeature.heavy_axe': '重斧',
  'item.creaturefeature.living_glass_shards': '活体玻璃碎片',
  'item.creaturefeature.minedflayer_goop': '矿魇黏液',
  'item.creaturefeature.minedflayer_jelly': '矿魇冻',
  'item.creaturefeature.murky_pearl': '浑珠',
  'item.creaturefeature.music_disc_nan': '音乐唱片',
  'item.creaturefeature.music_disc_nothing': '音乐唱片',
  'item.creaturefeature.open_mind': '开放思维',
  'item.creaturefeature.runaway_spawn_egg': '逃逸者刷怪蛋',
  'item.creaturefeature.scroll_bi': '双性恋饰纹卷轴',
  'item.creaturefeature.scroll_eye': '眼饰纹卷轴',
  'item.creaturefeature.scroll_pan': '泛性恋饰纹卷轴',
  'item.creaturefeature.scroll_pride': '骄傲饰纹卷轴',
  'item.creaturefeature.scroll_trans': '跨性别饰纹卷轴',
  'item.creaturefeature.sleeping_powder': '安眠粉',
  'item.creaturefeature.solar_shard': '烈阳碎片',
  'item.creaturefeature.the_pill': '那颗药丸',
  'item.creaturefeature.thingamabob': '怪东西',
  'item.creaturefeature.vertigo_chunk': '神秘肉块',
  'item.creaturefeature.vertigo_horn': '眩晕号角',
  'item.creaturefeature.vitric_arrow': '玻璃质箭矢',
  'jukebox_song.creaturefeature.new_age_nevermore': 'RENREN - New Age Nevermore',
  'jukebox_song.creaturefeature.new_age_nevermore_2': '',
  'jukebox_song.creaturefeature.new_age_nevermore_unused': '下一条用于自定义署名特效',
  'jukebox_song.creaturefeature.nothing': 'Tory Fox - egg.ogg',
  'sound.creaturefeature.coa_hurt': '纹章撕裂。',
  'sound.creaturefeature.fiend_death': '邪魔死亡。',
  'sound.creaturefeature.fiend_hurt': '邪魔尖叫。',
  'sound.creaturefeature.laughter': '笑声轨',
  'sound.creaturefeature.new_age_nevermore': 'NAN，RENREN 作',
  'sound.creaturefeature.nothing': '嗯，这里一个人都没有。',
  'sound.creaturefeature.shot': '燧发枪响……',
  'sound.creaturefeature.sinister_death': '险恶体死亡。',
  'sound.creaturefeature.sinister_hurt': '险恶体冒泡。',
  'sound.creaturefeature.stained_glass_die': '染色玻璃碎裂',
  'sound.creaturefeature.stained_glass_retreat': '染色玻璃回弹',
  'trim_material.creaturefeature.ectoplasm': '灵质',
  'trim_material.creaturefeature.scroll_bi': '双性恋卷轴',
  'trim_material.creaturefeature.scroll_pan': '泛性恋卷轴',
  'trim_material.creaturefeature.scroll_pride': '骄傲卷轴',
  'trim_material.creaturefeature.scroll_trans': '跨性别卷轴',
};

function genCreatureFeature() {
  const en = jarEntry(/^creaturefeature-.*\.jar$/i, 'assets/creaturefeature/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (CF_KEY_ZH[k] !== undefined) { out[k] = CF_KEY_ZH[k]; continue; }
    let m = k.match(/^entity\.creaturefeature\.(\w+)$/);
    if (m && CF_ENTITY_ZH[m[1]]) { out[k] = CF_ENTITY_ZH[m[1]]; continue; }
    m = k.match(/^item\.creaturefeature\.(\w+)_spawn_egg$/);
    if (m && CF_ENTITY_ZH[m[1]]) { out[k] = `${CF_ENTITY_ZH[m[1]]}刷怪蛋`; continue; }
    unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`creaturefeature: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// vinery: bundled zh_cn is partial — fill only the missing keys. Wood-part
// suffixes follow the bundled cherry_* naming (dark_cherry → 樱桃木).
// ---------------------------------------------------------------------------

const VINERY_KEY_ZH = {
  'advancement.vinery.budding_grapes': '葡萄初绽',
  'advancement.vinery.budding_grapes.desc': '收获红葡萄与白葡萄的丛林变种。',
  'advancement.vinery.cherry_picker': '摘樱桃的人',
  'advancement.vinery.cherry_picker.desc': '收获你的第一颗樱桃。',
  'advancement.vinery.forbidden_fruit': '禁果',
  'advancement.vinery.forbidden_fruit.desc': '收获一颗苹果。',
  'advancement.vinery.fruits_of_the_field': '田野之果',
  'advancement.vinery.fruits_of_the_field.desc': '苹果树与樱桃树现在会在平原群系生长。',
  'advancement.vinery.grape_picker': '摘葡萄的人',
  'advancement.vinery.grape_picker.desc': '收获红、白、针叶林与热带草原葡萄变种。',
  'advancement.vinery.juice_it_up': '榨汁时间到！',
  'advancement.vinery.juice_it_up.desc': '放置一个葡萄藤盆。',
  'advancement.vinery.juicy_success': '多汁的胜利',
  'advancement.vinery.juicy_success.desc': '获得任意一种葡萄汁。',
  'advancement.vinery.mashy_success': '果泥的胜利',
  'advancement.vinery.mashy_success.desc': '用苹果压榨机处理苹果，产出苹果泥。',
  'advancement.vinery.nectar_of_life': '生命甘露',
  'advancement.vinery.nectar_of_life.desc': '收集所有葡萄汁变种。',
  'advancement.vinery.overgrown_lattices': '爬满藤的格架',
  'advancement.vinery.overgrown_lattices.desc': '在橡木格架上种植丛林种子。',
  'advancement.vinery.purely_apple': '纯苹果',
  'advancement.vinery.purely_apple.desc': '收集苹果汁。',
  'advancement.vinery.sowing_the_future': '播种未来',
  'advancement.vinery.sowing_the_future.desc': '在葡萄藤杆上播种以提高葡萄产量。',
  'advancement.vinery.the_first_press': '第一次压榨',
  'advancement.vinery.the_first_press.desc': '放置一台苹果压榨机。',
  'advancement.vinery.the_magic_of_the_barrel': '木桶的魔力',
  'advancement.vinery.the_magic_of_the_barrel.desc': '放置一个发酵桶。',
  'advancement.vinery.the_noble_drop': '高贵的一滴',
  'advancement.vinery.the_noble_drop.desc': '收获任意葡萄酒。',
  'advancement.vinery.vineyard_visionary': '葡萄园远见者',
  'advancement.vinery.vineyard_visionary.desc': '收集所有葡萄变种。',
  'advancement.vinery.vintage_perfection': '陈年佳酿',
  'advancement.vinery.vintage_perfection.desc': '获得一瓶陈年 15 年、至臻完美的 MissLilitu 葡萄酒。',
  'advancement.vinery.wild_harvest': '野生收获',
  'advancement.vinery.wild_harvest.desc': '找到并收集任意葡萄种子。',
  'advancement.vinery.wine_somelier': '葡萄酒侍酒师',
  'advancement.vinery.wine_somelier.desc': '收集所有葡萄酒变种。',
  'block.vinery.dark_cherry_barrel': '樱桃木桶',
  'block.vinery.dark_cherry_beam': '樱桃木梁',
  'block.vinery.dark_cherry_big_table': '大型樱桃木桌',
  'block.vinery.dark_cherry_button': '樱桃木按钮',
  'block.vinery.dark_cherry_cabinet': '樱桃木橱柜',
  'block.vinery.dark_cherry_chair': '樱桃木椅子',
  'block.vinery.dark_cherry_door': '樱桃木门',
  'block.vinery.dark_cherry_drawer': '樱桃木抽屉',
  'block.vinery.dark_cherry_fence': '樱桃木栅栏',
  'block.vinery.dark_cherry_fence_gate': '樱桃木栅栏门',
  'block.vinery.dark_cherry_floorboard': '樱桃木地板',
  'block.vinery.dark_cherry_hanging_sign': '悬挂式樱桃木告示牌',
  'block.vinery.dark_cherry_wall_hanging_sign': '悬挂式樱桃木告示牌',
  'block.vinery.dark_cherry_lattice': '樱桃木格架',
  'block.vinery.dark_cherry_leaves': '樱桃树叶',
  'block.vinery.dark_cherry_log': '樱桃原木',
  'block.vinery.dark_cherry_planks': '樱桃木板',
  'block.vinery.dark_cherry_pressure_plate': '樱桃木压力板',
  'block.vinery.dark_cherry_sapling': '樱桃树苗',
  'block.vinery.dark_cherry_shelf': '樱桃木架',
  'block.vinery.dark_cherry_sign': '樱桃木告示牌',
  'block.vinery.dark_cherry_slab': '樱桃木台阶',
  'block.vinery.dark_cherry_stairs': '樱桃木楼梯',
  'block.vinery.dark_cherry_table': '樱桃木桌',
  'block.vinery.dark_cherry_trapdoor': '樱桃木活板门',
  'block.vinery.dark_cherry_wall_sign': '樱桃木告示牌',
  'block.vinery.dark_cherry_wine_rack_big': '樱桃木大型储酒柜',
  'block.vinery.dark_cherry_wine_rack_mid': '樱桃木葡萄酒柜',
  'block.vinery.dark_cherry_wine_rack_small': '樱桃木小型葡萄酒柜',
  'block.vinery.dark_cherry_wood': '樱桃木',
  'block.vinery.dirt_path_slab': '土径台阶',
  'block.vinery.red_jungle_grape_bag': '袋装丛林红葡萄',
  'block.vinery.red_savanna_grape_bag': '袋装热带草原红葡萄',
  'block.vinery.red_taiga_grape_bag': '袋装针叶林红葡萄',
  'block.vinery.vinery_wall_standard': '收藏家旗帜：§5葡园酒香',
  'block.vinery.white_jungle_grape_bag': '袋装丛林白葡萄',
  'block.vinery.white_savanna_grape_bag': '袋装热带草原白葡萄',
  'block.vinery.white_taiga_grape_bag': '袋装针叶林白葡萄',
  'block.vinery.window_block': '窗户',
  'effect.vinery.armor_effect.description': '提升护甲值与护甲韧性。',
  'effect.vinery.climbing_effect.description': '允许攀附墙壁。',
  'effect.vinery.creeper_effect.description': '使玩家在数秒后爆炸。轰！',
  'effect.vinery.double_jump.description': '允许二段跳。',
  'effect.vinery.experience_effect.description': '提升经验获取量。',
  'effect.vinery.frosty_armor.description': '提升护甲值与攻击伤害，但降低移动速度。',
  'effect.vinery.jellie.description': '提供与金苹果相同但更强的增益。',
  'effect.vinery.lava_walker.description': '允许在熔岩上行走。',
  'effect.vinery.luck_effect.description': '提升运气。',
  'effect.vinery.magnet.description': '将小范围内的物品吸引到玩家身边。',
  'effect.vinery.party_effect.description': '触发命中实体时造成伤害的烟花。',
  'effect.vinery.resistance_effect.description': '提升护甲韧性与抗性。',
  'effect.vinery.teleport.description': '将玩家向前传送。',
  'effect.vinery.water_walker.description': '允许在水面行走。',
  'effect.vinery.health_effect.description': '在效果持续期间提升最大生命值。',
  'entity.minecraft.villager.winemaker': '酿酒师',
  'entity.vinery.dark_cherry_boat': '樱桃木船',
  'entity.vinery.dark_cherry_chest_boat': '樱桃木运输船',
  'item.vinery.dark_cherry_boat': '樱桃木船',
  'item.vinery.dark_cherry_chest_boat': '樱桃木运输船',
  'item.vinery.dark_cherry_sign': '樱桃木告示牌',
  'subtitles.vinery.drawer_open': '抽屉：打开',
  'subtitles.vinery.drawer_close': '抽屉：关闭',
  'subtitles.vinery.cabinet_open': '橱柜：打开',
  'subtitles.vinery.cabinet_close': '橱柜：关闭',
  'text.autoconfig.vinery.option.TradeEntry': '交易条目',
  'text.autoconfig.vinery.option.TradeEntry.count': '数量',
  'text.autoconfig.vinery.option.TradeEntry.experience': '经验',
  'text.autoconfig.vinery.option.TradeEntry.item': '物品 ID',
  'text.autoconfig.vinery.option.TradeEntry.maxUses': '最大使用次数',
  'text.autoconfig.vinery.option.TradeEntry.price': '价格',
  'text.autoconfig.vinery.option.TradeEntry.type': '类型',
  'text.autoconfig.vinery.option.blocks': '方块',
  'text.autoconfig.vinery.option.blocks.appleGrowthChance': '苹果生长概率',
  'text.autoconfig.vinery.option.blocks.applePressMashingTime': '苹果压榨机：捣碎时间',
  'text.autoconfig.vinery.option.blocks.applePressFermentationTime': '苹果压榨机：发酵时间',
  'text.autoconfig.vinery.option.blocks.cherryGrowthChance': '樱桃生长概率',
  'text.autoconfig.vinery.option.blocks.grapeGrowthChance': '葡萄生长概率',
  'text.autoconfig.vinery.option.blocks.maxFluidLevel': '发酵桶：最大液面',
  'text.autoconfig.vinery.option.blocks.grapevinePotMaxStorage': '葡萄藤盆：最大储量',
  'text.autoconfig.vinery.option.blocks.grapevinePotRequiredJumps': '葡萄藤盆：所需跳跃次数',
  'text.autoconfig.vinery.option.blocks.grapevinePotGrapeJuicePerAction': '葡萄藤盆：每次葡萄汁产量',
  'text.autoconfig.vinery.option.blocks.grapevinePotShowSplashParticles': '葡萄藤盆：显示飞溅粒子',
  'text.autoconfig.vinery.option.blocks.maxFluidIncrease': '发酵桶：每瓶液体增量',
  'text.autoconfig.vinery.option.blocks.totalFermentationTime': '发酵桶：发酵时间',
  'text.autoconfig.vinery.option.items': '物品',
  'text.autoconfig.vinery.option.items.banner': '收藏家旗帜',
  'text.autoconfig.vinery.option.items.banner.giveEffect': '启用旗帜效果',
  'text.autoconfig.vinery.option.items.banner.showTooltip': '禁用提示文本',
  'text.autoconfig.vinery.option.items.basket': '篮子',
  'text.autoconfig.vinery.option.items.basket.blacklist': '黑名单',
  'text.autoconfig.vinery.option.items.basket.blacklist.basketBlacklist': '条目',
  'text.autoconfig.vinery.option.items.wine': '葡萄酒设置',
  'text.autoconfig.vinery.option.items.wine.daysPerYear': '每年天数',
  'text.autoconfig.vinery.option.items.wine.durationPerYear': '每年时长',
  'text.autoconfig.vinery.option.items.wine.maxDuration': '最大时长',
  'text.autoconfig.vinery.option.items.wine.maxLevel': '最大等级',
  'text.autoconfig.vinery.option.items.wine.startDuration': '初始时长',
  'text.autoconfig.vinery.option.items.wine.yearsPerEffectLevel': '每等级所需年数',
  'text.autoconfig.vinery.option.trader': '流浪酿酒师',
  'text.autoconfig.vinery.option.trader.spawnChance': '生成权重',
  'text.autoconfig.vinery.option.trader.spawnDelay': '生成延迟',
  'text.autoconfig.vinery.option.trader.spawnWithMules': '与骡子一同生成',
  'text.autoconfig.vinery.option.villager': '村民',
  'text.autoconfig.vinery.option.villager.level1': '1 级交易',
  'text.autoconfig.vinery.option.villager.level1.level': '将此交易等级改为：',
  'text.autoconfig.vinery.option.villager.level1.trades': '交易内容',
  'text.autoconfig.vinery.option.villager.level2': '2 级交易',
  'text.autoconfig.vinery.option.villager.level2.level': '将此交易等级改为：',
  'text.autoconfig.vinery.option.villager.level2.trades': '交易内容',
  'text.autoconfig.vinery.option.villager.level3': '3 级交易',
  'text.autoconfig.vinery.option.villager.level3.level': '将此交易等级改为：',
  'text.autoconfig.vinery.option.villager.level3.trades': '交易内容',
  'text.autoconfig.vinery.option.villager.level4': '4 级交易',
  'text.autoconfig.vinery.option.villager.level4.level': '将此交易等级改为：',
  'text.autoconfig.vinery.option.villager.level4.trades': '交易内容',
  'text.autoconfig.vinery.option.villager.level5': '5 级交易',
  'text.autoconfig.vinery.option.villager.level5.level': '将此交易等级改为：',
  'text.autoconfig.vinery.option.villager.level5.trades': '交易内容',
  'text.autoconfig.vinery.option.villager.tradelevels': '村民交易等级',
  'text.autoconfig.vinery.title': '葡园酒香',
  'tooltip.vinery.age': '酒龄：%s',
  'tooltip.vinery.armor.winemaker_armor0': '酿酒师的热望：',
  'tooltip.vinery.armor.winemaker_armor1': '套装效果：',
  'tooltip.vinery.armor.winemaker_armor2': '骨粉不再被消耗',
  'tooltip.vinery.bottle_size.small': '小瓶',
  'tooltip.vinery.bottle_size.big': '大瓶',
  'tooltip.vinery.storage': '%s 的存储空间',
  'tooltip.vinery.small_bottle_first': '小瓶',
  'tooltip.vinery.small_bottle_rest': '葡萄酒',
  'tooltip.vinery.large_bottle_first': '所有',
  'tooltip.vinery.large_bottle_rest': '葡萄酒瓶规格',
  'tooltip.vinery.fermentation_barrel.apple_juice_with_percentage': '苹果汁：%s%%',
  'tooltip.vinery.fermentation_barrel.crafting_time': '酿造时间：%s',
  'tooltip.vinery.fermentation_barrel.empty': '发酵桶是空的。',
  'tooltip.vinery.fermentation_barrel.red_general_juice_with_percentage': '红葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.red_jungle_juice_with_percentage': '丛林红葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.red_savanna_juice_with_percentage': '热带草原红葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.red_taiga_juice_with_percentage': '针叶林红葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.red_crimson_juice_with_percentage': '绯红葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.white_general_juice_with_percentage': '白葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.white_jungle_juice_with_percentage': '丛林白葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.white_savanna_juice_with_percentage': '热带草原白葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.white_taiga_juice_with_percentage': '针叶林白葡萄汁：%s%%',
  'tooltip.vinery.fermentation_barrel.white_warped_juice_with_percentage': '诡异白葡萄汁：%s%%',
  'tooltip.vinery.banner.thankyou_1': '酿出全部葡萄酒变种的奖励',
  'tooltip.vinery.banner.thankyou_2': '放置后：',
  'tooltip.vinery.banner.thankyou_3': '感谢游玩葡园酒香！',
  'tooltip.vinery.banner.thankyou_4': '在 8 格半径内提供生命恢复 II',
  'tooltip.vinery.next_upgrade': '距品质提升剩余天数：%s',
};

function genVinery() {
  const en = jarEntry(/^letsdo-vinery-.*\.jar$/i, 'assets/vinery/lang/en_us.json');
  const zh = jarEntry(/^letsdo-vinery-.*\.jar$/i, 'assets/vinery/lang/zh_cn.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (zh[k] !== undefined) continue; // bundled translation is fine
    if (VINERY_KEY_ZH[k] !== undefined) out[k] = VINERY_KEY_ZH[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`vinery: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildcraft: the main jar ships en_us only — translations were split into the
// official "BuildCraft Community Edition: Localizations" companion mod
// (buildcraftlocalizations-1.0.2+1.21.1-neoforge.jar). Its zh_cn.json is
// vendored at localization/vendor/buildcraft-zh_cn.json and covers every en
// key in the shipped jar; we emit only keys still present in en_us so stale
// upstream keys (RF-era leftovers) are dropped automatically. If a BC update
// adds en keys before the localizations jar catches up, the coverage check
// throws listing them.
// ---------------------------------------------------------------------------

function genBuildCraft() {
  const en = jarEntry(/^BuildCraft-Community-Edition-.*\.jar$/i, 'assets/buildcraft/lang/en_us.json');
  const official = JSON.parse(
    readFileSync(path.join(root, 'localization/vendor/buildcraft-zh_cn.json'), 'utf8'),
  );
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (official[k] !== undefined) out[k] = official[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`buildcraft: ${unresolved.length} keys not covered by vendored zh_cn:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// tacz: workbench_a/b/c are generic shell blocks — their real names live in
// gunpack block indexes and only resolve when the stack carries a BlockId
// custom_data component. Bare stacks (JEI lock placeholders, quest icons,
// drops) fall back to block.tacz.workbench_*, keys that exist in NO lang file.
// Emit those fallback keys derived from the gunpack block indexes; index-less
// shells get a generic name. Both locales are generated — the keys are absent
// everywhere, unlike the zh-only gaps of the other mods in this script.
// ---------------------------------------------------------------------------

const TACZ_JAR = /^tacz-neoforge-.*\.jar$/i;
const TACZ_GENERIC_NAME = { zh_cn: 'TaCZ工作台', en_us: 'TaCZ Workbench' };

function genTacz(loc) {
  const jarLang = jarEntry(TACZ_JAR, `assets/tacz/lang/${loc}.json`);
  const indexRe = /^assets\/tacz\/custom\/([^/]+)\/data\/tacz\/index\/blocks\/[^/]+\.json$/;
  const packLangs = {};
  const out = {};
  for (const p of jarList(TACZ_JAR)) {
    const m = p.match(indexRe);
    if (!m) continue;
    const idx = parseJsonc(jarText(TACZ_JAR, p));
    if (typeof idx?.id !== 'string' || !idx.id.startsWith('tacz:') || typeof idx?.name !== 'string') continue;
    const key = `block.${idx.id.replace(':', '.')}`;
    if (key in jarLang) continue; // e.g. block.tacz.gun_smith_table already has a real name
    const packId = m[1];
    packLangs[packId] ??= jarEntry(TACZ_JAR, `assets/tacz/custom/${packId}/assets/tacz/lang/${loc}.json`);
    const name = packLangs[packId][idx.name];
    if (!name) throw new Error(`tacz: ${p}: name key ${idx.name} missing in ${packId} ${loc} lang`);
    out[key] = name;
  }
  const regBlocks = new Set(JSON.parse(readFileSync(path.join(root, 'registry-export/blocks.json'), 'utf8')));
  for (const id of regBlocks) {
    if (!/^tacz:workbench_/.test(id)) continue;
    const key = `block.${id.replace(':', '.')}`;
    if (key in jarLang || key in out) continue;
    out[key] = TACZ_GENERIC_NAME[loc];
  }
  return out;
}

// ---------------------------------------------------------------------------
// progressivestages: jar ships en_us only (assets/progressivestages/lang).
// Every real lang key is covered; messages.* player-facing strings are NOT
// lang keys — they are StageConfig TOML defaults and are localized via
// <ps:*> markers emitted by build-pack.mjs + the starforge_compat
// parseColorCodes mixin (modpack.ps.* keys in localization/*.json).
// ---------------------------------------------------------------------------

const PS_KEY_ZH = {
  'progressivestages.locked': '🔒 未解锁',
  'progressivestages.stage_required': '需要阶段：%s',
  'progressivestages.current_stage': '当前阶段：%s',
  'progressivestages.progress': '进度：%s',
  'progressivestages.message.locked_item': '§c🔒 你还没有解锁这个物品！',
  'progressivestages.message.locked_recipe': '§c🔒 该配方未解锁！',
  'progressivestages.message.locked_block': '§c🔒 该方块未解锁！',
  'progressivestages.message.locked_dimension': '§c🔒 该维度未解锁！',
  'progressivestages.command.grant_success': '已授予阶段 %s 给 %s',
  'progressivestages.command.revoke_success': '已从 %s 撤销阶段 %s',
  'progressivestages.command.stage_not_found': '未找到阶段：%s',
  'progressivestages.command.reload_success': '已重载阶段定义',
  'progressivestages.command.stage_required': '你需要阶段 %s 才能使用此命令。',
  'progressivestages.command.native_denied': '你没有权限使用此命令。',
  'key.categories.progressivestages': 'ProgressiveStages',
  'key.progressivestages.open_tree': '打开进度图谱',
  'gui.progressivestages.tree.title': '进度',
  'gui.progressivestages.tree.empty': '未定义阶段',
  'gui.progressivestages.tree.search.label': '搜索阶段',
  'gui.progressivestages.tree.search.hint': '搜索……',
  'gui.progressivestages.tree.home.tooltip': '居中并适配完整图谱',
  'gui.progressivestages.tree.zoom': '缩放：%s%%',
  'gui.progressivestages.tree.navigation_hint': '拖拽平移，滚轮缩放。',
  'gui.progressivestages.tree.owned.visible': '已拥有',
  'gui.progressivestages.tree.owned.hidden': '已隐藏',
  'gui.progressivestages.tree.owned.tooltip': '显示或隐藏已完成阶段',
  'gui.progressivestages.tree.category.all': '所有分类',
  'gui.progressivestages.tree.category.tooltip': '点击从完整列表中选择分类。',
  'gui.progressivestages.tree.slots.heading': '阶段组',
  'gui.progressivestages.tree.slots.unlimited': '阶段可共存。',
  'gui.progressivestages.tree.slots.limited': '已激活 %s/%s 个槽位。',
  'gui.progressivestages.tree.slots.policy': '槽满时：%s',
  'gui.progressivestages.tree.status.unlocked': '已解锁',
  'gui.progressivestages.tree.status.ready': '就绪',
  'gui.progressivestages.tree.status.locked': '未解锁',
  'gui.progressivestages.tree.progress.percent': '进度：%s%%',
  'gui.progressivestages.tree.details': '点击查看详情',
  'gui.progressivestages.tree.triggers': '触发条件',
  'gui.progressivestages.tree.trigger.all': '路线 %s。完成全部条件。',
  'gui.progressivestages.tree.trigger.any': '路线 %s。完成任一条件。',
  'gui.progressivestages.tree.prerequisites.all': '前置。全部必需。',
  'gui.progressivestages.tree.prerequisites.any': '前置。任一即可。',
  'gui.progressivestages.tree.prerequisites.count': '前置。需要 %s 项。',
  'gui.progressivestages.tree.unlocks': '解锁。共 %s 项。',
  'gui.progressivestages.tree.purchase': '解锁。%s',
  'gui.progressivestages.tree.purchase.ownership': '购买：%s',
  'gui.progressivestages.tree.purchase.need': '需要。%s',
  'gui.progressivestages.tree.inventory_button': '打开进度图谱',
  'gui.progressivestages.tree.inventory_button.tooltip': '打开进度图谱\n拖拽平移，滚轮缩放。',
  'gui.progressivestages.tree.challenges': '进行中的挑战',
  'gui.progressivestages.tree.modifiers': '加成与预览',
  'gui.progressivestages.tree.modifier.equipment': '装备加成',
  'gui.progressivestages.tree.modifier.block_drop': '方块掉落加成',
  'gui.progressivestages.tree.modifier.locked': '装备解锁',
  'gui.progressivestages.tree.modifier.active': '已激活装备加成',
  'gui.progressivestages.tree.modifier.affinity': '亲和预览',
  'gui.progressivestages.tree.why': '为何采用此规则',
  'gui.progressivestages.tree.history': '进度历史',
  'progressivestages.quest.required_stage': '所需阶段',
  'progressivestages.quest.required_stage.tooltip': '设置后，该任务在玩家获得此阶段前隐藏。留空表示无要求。示例：iron_age 或 progressivestages:diamond_age',
  'progressivestages.chapter.required_stage': '所需阶段',
  'progressivestages.chapter.required_stage.tooltip': '设置后，整章在玩家获得此阶段前隐藏。留空表示无要求。示例：iron_age 或 progressivestages:diamond_age',
};

function genProgressiveStages() {
  const en = jarEntry(/^progressivestages-.*\.jar$/i, 'assets/progressivestages/lang/en_us.json');
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (PS_KEY_ZH[k]) out[k] = PS_KEY_ZH[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`progressivestages: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generic overlay: emit zh for every en_us key the jar's bundled zh_cn lacks.
// TABLE must cover all such keys — the generator throws listing leftovers, so
// jar updates that add keys fail loudly instead of shipping English.
// Mods with no bundled zh at all are handled the same way (every en key is
// "missing"). en is parsed as JSONC because some packs ship // comments.
// ---------------------------------------------------------------------------

function jarEntryMaybe(jarGlob, entry) {
  try {
    return parseJsonc(jarText(jarGlob, entry));
  } catch {
    return {};
  }
}

// CFPA (I18nUpdateMod) zh_cn subsets vendored at localization/vendor/cfpa/ —
// only keys the jar's bundled zh_cn lacks are kept. The pack itself does not
// ship the CFPA zip, so these translations must ride the KubeJS overlay.
function cfpaVendor(ns) {
  const f = path.join(root, 'localization/vendor/cfpa', `${ns}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}

function genOverlay(jarGlob, ns, table, enPaths) {
  const paths = enPaths ?? [`assets/${ns}/lang/en_us.json`];
  const en = {};
  for (const p of paths) Object.assign(en, parseJsonc(jarText(jarGlob, p)));
  const zh = jarEntryMaybe(jarGlob, `assets/${ns}/lang/zh_cn.json`);
  const cfpa = cfpaVendor(ns);
  const out = {};
  const unresolved = [];
  for (const k of Object.keys(en)) {
    if (zh[k] !== undefined) continue;
    if (table[k] !== undefined) out[k] = table[k];
    else if (cfpa[k] !== undefined) out[k] = cfpa[k];
    else unresolved.push(`${k} = ${en[k]}`);
  }
  if (unresolved.length) {
    throw new Error(`${ns}: ${unresolved.length} unresolved keys:\n${unresolved.join('\n')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small/medium overlay sets — bundled zh missing a handful of keys, or absent.
// ---------------------------------------------------------------------------

const HORDES_KEY_ZH = {
  'message.hordes.DataErrorScripts': '已加载的脚本 %1$s 存在错误，请查看文件 %2$s 获取更多信息。',
  // config_defaults/assets copy carries a few extra player-visible keys
  'message.hordes.OtherPlayerTrySleep': '%1$s 躁动不安，看来今夜不会平静',
  'hordes.infection_resistance': '感染抗性',
  'attribute.hordes.infectivity': '感染力',
  'attribute.hordes.infection_resistance': '感染抗性',
  'message.hordes.EventStart': '你听到附近怪潮的嚎叫',
  'message.hordes.EventEnd': '空气安静了，怪潮已经停止',
  'message.hordes.TrySleep': '一种逼近的恐惧感让你无法入睡',
  'message.hordes.title': '怪潮',
  'hordes.subtitle.hordeHowls': '僵尸嚎叫',
  'hordes.subtitle.infected': '玩家被感染',
  'hordes.subtitle.immune': '玩家感染被阻挡',
  'entity.hordes.ZombiePlayer.chat': '%1$s 的僵尸',
  'entity.hordes.DrownedPlayer.chat': '%1$s 的溺尸',
  'entity.hordes.HuskPlayer.chat': '%1$s 的尸壳',
  'entity.hordes.ZombiePlayer.name': '僵尸化玩家',
  'entity.hordes.DrownedPlayer.name': '溺尸化玩家',
  'entity.hordes.HuskPlayer.name': '尸壳化玩家',
  'entity.hordes.ZombifiedPiglinBrute.name': '僵尸猪灵蛮兵',
  'entity.hordes.ZombieWanderingTrader.name': '僵尸流浪商人',
  'entity.hordes.ZombiePillager.name': '僵尸掠夺者',
  'entity.hordes.ZombieVindicator.name': '僵尸卫道士',
  'entity.hordes.ZombieEvoker.name': '僵尸唤魔者',
  'entity.hordes.ZombieIllusioner.name': '僵尸幻术师',
  'entity.hordes.ZombieWitch.name': '僵尸女巫',
  'effect.hordes.infected': '感染',
  'effect.hordes.immunity': '感染免疫',
  'tooltip.hordes.cure': '治愈感染',
  'death.attack.infection': '%1$s 死于感染。',
  'death.attack.infection.zombified': '%1$s 被僵尸化了。',
};

const GUIDEME_KEY_ZH = {
  'guideme.configuration.adaptiveScaling': '自适应 UI 缩放',
  'guideme.configuration.debug': '调试',
  'guideme.configuration.debug.tooltip': '面向 Guide 开发的高级调试设置',
  'guideme.configuration.fullWidthLayout': '全宽布局',
  'guideme.configuration.gui': '用户界面',
  'guideme.configuration.guide': '指南',
  'guideme.configuration.ignoreTranslatedGuides': '忽略已翻译的指南',
  'guideme.configuration.ignoreTranslatedGuides.tooltip': '无论当前选择的界面语言如何，总是加载 GuideME 指南的原始版本',
  'guideme.configuration.showDebugGuiOverlays': '调试 GUI 覆盖层',
  'guideme.configuration.title': 'GuideME 配置',
  'guideme.guidebook.Blasting': '烧炼',
  'guideme.guidebook.Close': '关闭',
  'guideme.guidebook.CloseFullWidthView': '关闭全宽视图',
  'guideme.guidebook.CommandOnlyWorksInSinglePlayer': '此命令仅在单人游戏中可用。',
  'guideme.guidebook.ContentFrom': '内容来自',
  'guideme.guidebook.Crafting': '合成',
  'guideme.guidebook.FullWidthView': '全宽视图',
  'guideme.guidebook.HideAnnotations': '隐藏注释',
  'guideme.guidebook.HistoryGoBack': '上一页',
  'guideme.guidebook.HistoryGoForward': '下一页',
  'guideme.guidebook.HoldToShow': '按住 [%s] 打开指南',
  'guideme.guidebook.ItemInvalidGuideId': '无效的指南 ID：%s',
  'guideme.guidebook.ItemNoGuideId': '未设置指南 ID',
  'guideme.guidebook.ResetView': '重置视图',
  'guideme.guidebook.RunsCommand': '运行命令：',
  'guideme.guidebook.Search': '搜索',
  'guideme.guidebook.SearchNoQuery': '输入搜索内容',
  'guideme.guidebook.SearchNoResults': '无结果',
  'guideme.guidebook.ShapelessCrafting': '无序合成',
  'guideme.guidebook.ShowAnnotations': '显示注释',
  'guideme.guidebook.Smelting': '熔炼',
  'guideme.guidebook.ZoomIn': '放大',
  'guideme.guidebook.ZoomOut': '缩小',
  'item.guideme.guide': '指南',
  'key.guideme.category': 'GuideME',
  'key.guideme.guide': '打开物品指南',
};

const BLUEPRINT_KEY_ZH = {
  'blueprint.config.screen_shake_scale': '屏幕震动幅度',
  'blueprint.config.max_screen_shakers': '屏幕震源上限',
  'blueprint.config.disable_experimental_settings_screen': '禁用实验性设置界面',
  'blueprint.config.slabfish_hat.enabled': 'Slabfish 帽子',
  'blueprint.config.slabfish_hat.enabled.tooltip': '开关 Slabfish 帽子。Tier 2+ 赞助者可用。',
  'blueprint.config.slabfish_hat.sweater': '毛衣',
  'blueprint.config.slabfish_hat.sweater.tooltip': '开关 Slabfish 帽子的毛衣。Tier 2+ 赞助者可用。',
  'blueprint.config.slabfish_hat.backpack': '背包',
  'blueprint.config.slabfish_hat.backpack.tooltip': '开关 Slabfish 帽子的背包。Tier 3+ 赞助者可用。',
  'blueprint.config.slabfish_hat.type': '类型',
  'blueprint.config.slabfish_hat.type.tooltip': '开关 Slabfish 帽子的类型。Tier 4+ 赞助者可用。',
  'blueprint.screen.slabfish_settings': 'Slabfish 帽子设置……',
  'blueprint.screen.slabfish_settings.title': 'Slabfish 帽子设置',
  'blueprint.screen.slabfish_settings.tooltip': 'Team Abnormals 赞助者 Slabfish 帽子的设置。在 %s 成为赞助者。',
  'blueprint.message.redirect': '正在重定向',
  'biome.blueprint.original_source_marker': '原始来源标记',
  'entity.blueprint.boat': '船',
  'entity.blueprint.chest_boat': '运输船',
  'entity.blueprint.falling_block': '下落的方块',
};

const CURIOS_KEY_ZH = {
  'curios.tooltip.inactive': '未激活槽位',
  'commands.curios.drop.success': '已为 %2$s 丢弃槽位 %1$s 中的物品',
  'commands.curios.dropAll.success': '已为 %s 丢弃所有槽位中的物品',
  'commands.curios.replace.success': '已将 %2$s 的槽位 %1$s 替换为 %3$s',
  'gui.curios.toggle.cosmetics': '切换装饰显示',
  'gui.curios.page': '第 %d / %d 页',
  'curios.networking.failed': 'Curios 网络通信失败',
};

const IE_KEY_ZH = {
  'advancement.immersiveengineering.secret_snake': '警报！',
  'advancement.immersiveengineering.secret_snake.desc': '揪出入侵者',
  'block.immersiveengineering.hatch': '物品舱口',
  'block.immersiveengineering.shelf': '板条箱储物架',
  'chat.immersiveengineering.info.conveyor.stacksize': '每秒将抽取 %1$s 个物品',
  'chat.immersiveengineering.info.light_level': '光照等级：%1$s',
  'desc.immersiveengineering.info.batched': '每次最多 %1$s 个',
  'desc.immersiveengineering.info.filter.tag.from_mod': '物品来自：%1$s',
  'effect.immersiveengineering.incognito': '匿名',
  'gui.immersiveengineering.config.shelf.swap': '切换到另一侧',
  'subtitle.immersiveengineering.alert': '警报！',
  'subtitle.immersiveengineering.buzzsaw_attack': '圆锯高速旋转',
  'subtitle.immersiveengineering.buzzsaw_harvest_grinding': '研磨',
  'subtitle.immersiveengineering.buzzsaw_harvest_sawing': '锯切',
  'subtitle.immersiveengineering.buzzsaw_motor': '圆锯马达运转',
  'subtitle.immersiveengineering.drill_attack': '钻头高速旋转',
  'subtitle.immersiveengineering.drill_harvest': '钻探',
  'subtitle.immersiveengineering.drill_motor': '钻头马达运转',
};

const CLOTH_KEY_ZH = {
  'text.cloth-config.disabled_tooltip': '已禁用（未满足条件）',
};

const ASTEROID_BELT_KEY_ZH = {
  'dimension.pv_asteroid_belt.asteroid_belt': '小行星带',
  'dimension.pv_asteroid_belt.asteroid_belt_orbit': '小行星带轨道',
  'biome.pv_asteroid_belt.asteroid_belt': '小行星带',
  'biome.pv_asteroid_belt.orbit': '小行星带轨道',
  'planet.pv_asteroid_belt.asteroid_belt': '小行星带',
  'planet.pv_asteroid_belt.asteroid_belt_orbit': '小行星带周边空域',
};

const CSL_KEY_ZH = {
  'misc.common_storage_lib.energy': '%s ⚡',
  'misc.common_storage_lib.fluid': '%s 🪣 %s',
  'misc.common_storage_lib.consume': '消耗 %s',
};

const CHAT_HEADS_KEY_ZH = {
  'text.autoconfig.chat_heads.option.threeDeeNess': '立体感',
  'text.autoconfig.chat_heads.option.threeDeeNess.@Tooltip': '略微放大帽层渲染，\n让聊天头像显得不那么扁平。\n可能导致一些渲染问题。',
  'text.autoconfig.chat_heads.option.drawShadow': '渲染阴影',
};

const SBT_KEY_ZH = {
  'shulkerboxtooltip.colors.shulkerboxtooltip.default.generic_container': '通用容器',
  'shulkerboxtooltip.config.option.preview.generic_container_preview': '通用容器预览',
  'shulkerboxtooltip.config.option.preview.generic_container_preview.tooltip': '开启后，带有容器数据组件\n但未受显式支持的物品\n也会像潜影盒一样显示预览。',
};

const MM_KEY_ZH = {
  'advancements.mutantmonsters.root.description': '面对变异的生物与巨兽。你会凯旋，还是陨落？',
  'advancements.mutantmonsters.root.title': '突变生物',
};

const FD_KEY_ZH = {
  'tag.block.farmersdelight.cabinets.wooden': '木质橱柜',
  'tag.block.farmersdelight.mineable.knife': '可用刀开采',
};

const SUPP_KEY_ZH = {
  'supplementaries.configuration.plunderer.galleon.description': '若"绳索"功能被禁用，帆船会自动禁用',
  'supplementaries.configuration.globe.sepia_globe.description': '若"复古墨水"功能被禁用，深色地球仪会自动禁用',
};

const AE2_KEY_ZH = {
  'dimension.ae2.spatial_storage': '空间存储',
  'gui.ae2.Resume': '继续',
  'gui.ae2.SearchTooltipToolTips': '使用 $ 搜索提示框内容（$looting）',
  'gui.ae2.Suspend': '挂起',
};

const EO_KEY_ZH = {
  'subtitles.endermanoverhaul.entity.flower_fields_enderman.ambient': '花田末影人：咕噜',
  'subtitles.endermanoverhaul.entity.flower_fields_enderman.death': '花田末影人：死亡',
  'subtitles.endermanoverhaul.entity.flower_fields_enderman.hurt': '花田末影人：受伤',
  'tooltip.endermanoverhaul.ancient_pearl_1': '召唤一只友好的末影人为你而战',
  'tooltip.endermanoverhaul.ancient_pearl_2': '潜行右键点击被召唤的末影人可回收珍珠',
};

const BAT_KEY_ZH = {
  'betteradvancedtooltips.configuration.remove_creative_tab_tooltip': '移除创造标签页提示',
  'betteradvancedtooltips.configuration.remove_component_count_tooltip': '移除组件数量提示',
  'betteradvancedtooltips.configuration.fuel_tooltip': '燃料提示',
  'betteradvancedtooltips.configuration.tag_tooltip': '标签提示',
  'betteradvancedtooltips.configuration.component_tooltip': '组件提示',
};

const DO_KEY_ZH = {
  'defaultoptions.configuration.defaultDifficulty': '默认难度',
  'defaultoptions.configuration.defaultDifficulty.tooltip': '新建世界时默认选择的难度。',
  'defaultoptions.configuration.lockDifficulty': '锁定难度',
  'defaultoptions.configuration.lockDifficulty.tooltip': '设为 true 可将新世界的难度锁定为指定默认值。玩家不借助外部工具将无法解锁！可能不是个好主意，不推荐启用。我为什么要加这个选项？',
  'defaultoptions.configuration.defaultResourcePacks': '默认资源包',
  'defaultoptions.configuration.defaultResourcePacks.tooltip': '首次运行时默认启用的资源包 ID。',
};

const IRIS_KEY_ZH = {
  'iris.shaders.debug.restartNoDebug': '已启用着色器调试；NeoForge 不支持 OpenGL 调试。',
  'iris.load.failure.shader': '光影包加载失败！请向光影开发者报告此错误。',
  'iris.load.failure.generic': 'Iris 加载光影时遇到问题，请向 Iris 开发者报告。',
  'iris.keybind.wireframe': '线框模式（仅限单人）',
  'options.iris.colorSpace': '色彩空间',
  'options.iris.colorSpace.sodium_tooltip': '屏幕输出转换的目标色彩空间，在光影包之上生效。不确定请选择 SRGB。',
};

const EMI_KEY_ZH = {
  'emi.cheat_mode.true': '总是',
  'emi.cheat_mode.false': '从不',
  'emi.cheat_mode.creative': '仅创造模式',
  'tooltip.emi.synfav.obtained': '已获得 %s/%s',
  'tooltip.emi.synfav.remaining': '剩余 %s',
  'tooltip.emi.synfav.batches_remaining': '还可合成 %s 次',
};

const SLO_KEY_ZH = {
  'config.structure_layout_optimizer.title': 'Structure Layout Optimizer',
  'config.structure_layout_optimizer.desc': '尝试优化拼图结构生成',
  'config.structure_layout_optimizer.link.bug_report': '报告 Bug',
  'config.structure_layout_optimizer.link.license': '许可证',
  'config.structure_layout_optimizer.deduplicate_shuffled_template_pool_element_list': '去重打乱的模板池元素列表',
  'config.structure_layout_optimizer.deduplicate_shuffled_template_pool_element_list.desc': '是否使用替代策略，让结构布局生成比本 Mod 默认的模板池权重优化再快一点。该策略通过让结构从模板池收集的部件列表不含重复条目来提速。\n不会破坏结构生成，但会使结构布局与关闭此选项时不同（破坏与原版种子的一致性）。在大型整合包中，许多结构 Mod 使用很高的模板池权重，牺牲一致性换取速度可能是值得的。\n\n优点：从高权重模板池结构中获得更多性能。\n缺点：结构布局与原版种子不再一致。（结构布局不会损坏，只是不同）',
};

const DFPS_KEY_ZH = {
  'config.dynamic_fps.feature.misc': '杂项',
  'config.dynamic_fps.feature.volume_transition': '音量过渡',
  'config.dynamic_fps.feature.idle': '闲置',
  'config.dynamic_fps.feature.battery': '电池集成',
  'config.dynamic_fps.ignore_initial_click': '忽略首次点击',
  'config.dynamic_fps.ignore_initial_click_tooltip': '点击未聚焦的游戏窗口时忽略意外输入。',
  'config.dynamic_fps.ignore_initial_click_disabled': '禁用',
  'config.dynamic_fps.ignore_initial_click_in_world': '在世界中',
  'config.dynamic_fps.ignore_initial_click_constant': '始终',
  'config.dynamic_fps.battery_critical_level': '临界电量阈值',
  'config.dynamic_fps.battery_critical_level_tooltip': '设置视为临界的电池电量。',
  'config.dynamic_fps.battery_indicator_debug': '随调试界面（F3）显示',
  'config.dynamic_fps.battery_indicator_debug_tooltip': '调试界面打开时是否显示电池指示。',
  'toast.dynamic_fps.http_error': '库文件下载失败',
};

const IP_KEY_ZH = {
  'chat.immersivepetroleum.command.reservoir.infinite': '§d无限§r %1$s',
  'chat.immersivepetroleum.command.reservoir.inf.toggle.set': '%1$s 的油藏：无限。',
  'chat.immersivepetroleum.command.reservoir.inf.toggle.unset': '%1$s 的油藏：有限。',
  'chat.immersivepetroleum.command.reservoir.inf.flow': '无限油藏产量已设为 %1$smB/t',
};

const AD_ASTRA_KEY_ZH = {
  'config.ad_astra.client.title': 'Ad Astra 客户端',
  'config.ad_astra.description': '生生不息，繁荣昌盛，愿原力与你同在。',
  'config.ad_astra.deshTier': '戴斯级',
  'config.ad_astra.ironTier': '铁级',
  'config.ad_astra.launchEfficientFuelCost': '高效发射燃料消耗',
  'config.ad_astra.launchFuelCost': '发射燃料消耗',
  'config.ad_astra.machine.energyCapacity': '能量容量',
  'config.ad_astra.machine.fluidCapacity': '流体容量',
  'config.ad_astra.machine.maxEnergyInOut': '最大能量输入/输出',
  'config.ad_astra.ostrumTier': '紫金级',
  'config.ad_astra.steelTier': '钢级',
  'config.ad_astra.title': 'Ad Astra',
  'fluid_type.ad_astra.flowing_cryo_fuel': '流动低温燃料',
  'fluid_type.ad_astra.flowing_fuel': '流动燃料',
  'fluid_type.ad_astra.flowing_hydrogen': '流动氢',
  'fluid_type.ad_astra.flowing_oil': '流动石油',
  'fluid_type.ad_astra.flowing_oxygen': '流动氧',
  'tag.item.ad_astra.oxygen_supplying_armor': '供氧护甲',
  'tag.item.ad_astra.space_resistant_armor': '耐太空护甲',
};

const GISELLE_KEY_ZH = {
  'block.ad_astra_giselle_addon.rocket_sensor': '火箭传感器',
  'item.ad_astra_giselle_addon.creative_oxygen_can': '创造模式氧气罐',
  'item.ad_astra_giselle_addon.rocket_sensor.tooltip': '通过比较器将附近火箭的状态输出为红石信号',
  'item.ad_astra_giselle_addon.lander_icon': '着陆器',
  'gui.ad_astra_giselle_addon.workingarea': '工作区域',
  'gui.ad_astra_giselle_addon.rocket_sensor.inverted': '反转输出',
  'gui.ad_astra_giselle_addon.rocket_sensor.current': '当前输出：%s',
  'description.ad_astra_giselle_addon.can_use.cold': '在寒冷维度中',
  'description.ad_astra_giselle_addon.can_use.hot': '在炎热维度中',
  'can_use.ad_astra_giselle_addon.available': '可用',
  'can_use.ad_astra_giselle_addon.unavailable': '不可用',
  'description.ad_astra_giselle_addon.creative_oxygen': '氧气',
  'creative_oxygen.ad_astra_giselle_addon.empty': '空',
  'creative_oxygen.ad_astra_giselle_addon.infinity': '无限',
  'rocket_sensing_type.ad_astra_giselle_addon.disabled': '禁用',
  'rocket_sensing_type.ad_astra_giselle_addon.disabled.desc': '始终输出 %1$s',
  'rocket_sensing_type.ad_astra_giselle_addon.found': '发现火箭',
  'rocket_sensing_type.ad_astra_giselle_addon.found.desc': '发现火箭时输出 %2$s',
  'rocket_sensing_type.ad_astra_giselle_addon.flying_up': '正在升空',
  'rocket_sensing_type.ad_astra_giselle_addon.flying_up.desc': '火箭升空时输出 %2$s',
  'rocket_sensing_type.ad_astra_giselle_addon.fuel_loaded': '燃料已装载',
  'rocket_sensing_type.ad_astra_giselle_addon.fuel_loaded.desc': '火箭燃料装载时输出 %2$s',
  'rocket_sensing_type.ad_astra_giselle_addon.launch_countdown': '发射倒计时',
  'rocket_sensing_type.ad_astra_giselle_addon.launch_countdown.desc1': '输出发射倒计时对应的模拟信号',
  'rocket_sensing_type.ad_astra_giselle_addon.launch_countdown.desc2': '初始输出 0，随倒计时递减而增大',
  'rocket_sensing_type.ad_astra_giselle_addon.lander_found': '发现着陆器',
  'rocket_sensing_type.ad_astra_giselle_addon.lander_found.desc': '发现着陆器时输出 %2$s',
  'jei.info.ad_astra_giselle_addon.rocket_sensor': '在 %1$s 格范围内寻找火箭，\n然后通过比较器将该火箭的状态输出为红石信号。\n信号类型可在界面中更改。',
  'modifier.ad_astra_giselle_addon.space_breathing': '太空呼吸',
  'modifier.ad_astra_giselle_addon.space_breathing.flavor': '太空呼吸',
  'modifier.ad_astra_giselle_addon.space_breathing.description': '可在 Ad Astra 维度中呼吸\n需要背包中有"氧气罐"',
  'modifier.ad_astra_giselle_addon.space_fire_proof': '太空防火',
  'modifier.ad_astra_giselle_addon.space_fire_proof.flavor': '太空防火',
  'modifier.ad_astra_giselle_addon.space_fire_proof.description': '在 Ad Astra 维度中不会被点燃',
  'modifier.ad_astra_giselle_addon.acid_rain_proof': '酸雨防护',
  'modifier.ad_astra_giselle_addon.acid_rain_proof.flavor': '酸雨防护',
  'modifier.ad_astra_giselle_addon.acid_rain_proof.description': '在 Ad Astra 维度中不受酸雨伤害',
  'modifier.ad_astra_giselle_addon.gravity_normalizing': '重力正常化',
  'modifier.ad_astra_giselle_addon.gravity_normalizing.flavor': '重力正常化',
  'modifier.ad_astra_giselle_addon.gravity_normalizing.description': '在 Ad Astra 维度中将重力调整为与主世界一致',
  'config.ad_astra_giselle_addon.items.oxygen_chargers': '氧气罐（通用）',
  'config.ad_astra_giselle_addon.items.oxygen_chargers_distribution_interval': '分配间隔 [tick]',
  'config.ad_astra_giselle_addon.machines.rocket_sensor': '火箭传感器',
  'config.ad_astra_giselle_addon.machines.rocket_sensor_working_range': '工作范围',
  'config.ad_astra_giselle_addon.machines.rocket_sensor_working_range.comment': '火箭传感器向各方向探测的格数',
  'config.ad_astra_giselle_addon.enchantments.proof_energy_using': '能量消耗',
  'config.ad_astra_giselle_addon.enchantments.proof_energy_using.comment': '防护附魔的能量消耗 [每 10 tick]',
  'config.ad_astra_giselle_addon.enchantments.proof_durability_using': '耐久消耗',
  'config.ad_astra_giselle_addon.enchantments.proof_durability_using.comment': '防护附魔的耐久消耗',
  'config.ad_astra_giselle_addon.enchantments.proof_durability_duration': '耐久防护持续时间',
  'config.ad_astra_giselle_addon.enchantments.proof_durability_duration.comment': '使用耐久时的防护持续时间 [tick，须为 10 的倍数]',
};

const ARACHNIDS_KEY_ZH = {
  'entity.arachnids.worker': '工虫',
  'entity.arachnids.warrior': '战士虫',
  'entity.arachnids.hopper': '跳跃虫',
  'entity.arachnids.brainbug': '脑虫',
  'entity.arachnids.chariot': '战车虫',
  'item.arachnids.worker_spawn_egg': '工虫刷怪蛋',
  'item.arachnids.warrior_spawn_egg': '战士虫刷怪蛋',
  'item.arachnids.hopper_spawn_egg': '跳跃虫刷怪蛋',
  'item.arachnids.brainbug_spawn_egg': '脑虫刷怪蛋',
  'item.arachnids.chariot_spawn_egg': '战车虫刷怪蛋',
  'config.screen.arachnids': 'Arachnids 配置',
  'config.arachnids.option.debugPathingParticlesEnabled': '启用寻路调试粒子',
  'config.arachnids.option.entityConfigs': '实体配置',
  'config.arachnids.option.brainBugHealth': '脑虫最大生命值',
  'config.arachnids.option.brainBugAttackDamage': '脑虫攻击伤害',
  'config.arachnids.option.chariotBugHealth': '战车虫最大生命值',
  'config.arachnids.option.chariotBugAttackDamage': '战车虫攻击伤害',
  'config.arachnids.option.hopperBugHealth': '跳跃虫最大生命值',
  'config.arachnids.option.hopperBugAttackDamage': '跳跃虫攻击伤害',
  'config.arachnids.option.hopperBugKnockbackRes': '跳跃虫击退抗性',
  'config.arachnids.option.warriorBugHealth': '战士虫最大生命值',
  'config.arachnids.option.warriorBugAttackDamage': '战士虫攻击伤害',
  'config.arachnids.option.warriorBugArmor': '战士虫护甲值',
  'config.arachnids.option.warriorBugArmorToughness': '战士虫护甲韧性',
  'config.arachnids.option.warriorBugKnockbackRes': '战士虫击退抗性',
  'config.arachnids.option.workerBugHealth': '工虫最大生命值',
  'config.arachnids.option.workerBugAttackDamage': '工虫攻击伤害',
};

const GV_KEY_ZH = {
  'guardvillagers.configuration.Structure pieces that spawn guards': '生成守卫的结构部件',
  'guardvillagers.configuration.How many guards should spawn in a village?': '每个村庄生成多少守卫？',
  'guardvillagers.configuration.Allow guards to convert to zombie villagers upon being killed by zombies?': '允许守卫被僵尸击杀后转化为僵尸村民？',
  'guardvillagers.configuration.Guard crossbow attack radius': '守卫弩攻击半径',
  'guardvillagers.configuration.How many times a villager can heal a guard\'s equipment in one day': '村民每天可修复守卫装备的次数',
  'guardvillagers.configuration.How many times a cleric can heal a guard in one day': '牧师每天可治疗守卫的次数',
  'guardvillagers.configuration.Profession Whitelist for guard weaponry repair ai': '守卫武器修复 AI 的职业白名单',
  'guardvillagers.configuration.How many times a smith villager can heal a golem in one day': '铁匠村民每天可修复傀儡的次数',
  'guardvillagers.configuration.Profession Whitelist for healing ai for clerics': '牧师治疗 AI 的职业白名单',
  'guardvillagers.configuration.Profession Whitelist for golem repair ai': '傀儡修复 AI 的职业白名单',
  'guardvillagers.configuration.Display guard health in icons': '以图标显示守卫生命值',
  'guardvillagers.configuration.Mobs that guards actively protect when they get hurt': '守卫在受伤时主动保护的生物',
  'guardvillagers.configuration.Angle of how ranged guards determine if a friendly mob is infront of them before firing': '远程守卫开火前判定友方生物是否位于前方的角度',
  'guardvillagers.configuration.Depth value for guards fighting underwater mobs': '守卫与水下生物战斗的深度阈值',
  'guardvillagers.configuration.Allow guards to sink temporarily to fight mobs that are under water?': '允许守卫短暂下潜以攻击水下生物？',
  'guardvillagers.configuration.Mobs that guards actively protect when they get targeted': '守卫在被锁定时主动保护的生物',
  'guardvillagers.configuration.Allow guards to patrol around villager workstations like golems?': '允许守卫像傀儡一样围绕村民工作站点巡逻？',
};

const GVTS_KEY_ZH = {
  'itemGroup.guardvillagerstaczsupport': '示例物品栏',
  'block.guardvillagerstaczsupport.example_block': '示例方块',
  'item.guardvillagerstaczsupport.example_item': '示例物品',
  'guardvillagerstaczsupport.configuration.title': '警卫村民 TACZ 支持配置',
  'guardvillagerstaczsupport.configuration.section.guardvillagerstaczsupport.common.toml': '警卫村民 TACZ 支持配置',
  'guardvillagerstaczsupport.configuration.section.guardvillagerstaczsupport.common.toml.title': '警卫村民 TACZ 支持配置',
  'guardvillagerstaczsupport.configuration.ammo_search_radius': '守卫弹药搜索半径',
  'guardvillagerstaczsupport.configuration.ammo_search_radius.tooltip': '警卫村民搜索兼容弹药的原版容器的方块半径。',
  'guardvillagerstaczsupport.configuration.food_search_radius': '守卫食物搜索半径',
  'guardvillagerstaczsupport.configuration.food_search_radius.tooltip': '警卫村民搜索食物的原版容器的方块半径。',
  'guardvillagerstaczsupport.configuration.ammo_search_cooldown_ticks': '守卫弹药搜索冷却',
  'guardvillagerstaczsupport.configuration.ammo_search_cooldown_ticks.tooltip': '警卫村民弹药容器搜索失败后的间隔 tick 数。',
  'guardvillagerstaczsupport.configuration.food_search_cooldown_ticks': '守卫食物搜索冷却',
  'guardvillagerstaczsupport.configuration.food_search_cooldown_ticks.tooltip': '警卫村民食物容器搜索失败后的间隔 tick 数。',
  'guardvillagerstaczsupport.configuration.container_reach_timeout_ticks': '守卫容器抵达超时',
  'guardvillagerstaczsupport.configuration.container_reach_timeout_ticks.tooltip': '警卫村民尝试抵达选中的食物或弹药容器的 tick 数，超时后暂时跳过该容器。',
  'guardvillagerstaczsupport.configuration.low_food_health_threshold': '守卫进食生命阈值',
  'guardvillagerstaczsupport.configuration.low_food_health_threshold.tooltip': '生命值低于此阈值时，警卫村民会在容器中搜索食物。',
  'guardvillagerstaczsupport.configuration.friendly_fire_width': '误伤射线宽度',
  'guardvillagerstaczsupport.configuration.friendly_fire_width.tooltip': '射击安全判定使用的射线宽度（格）。',
  'guardvillagerstaczsupport.configuration.default_attack_range': '默认攻击距离',
  'guardvillagerstaczsupport.configuration.default_attack_range.tooltip': '默认攻击距离（格）。',
  'guardvillagerstaczsupport.configuration.hostile_tacz_magazine_size': '敌对生物弹匣容量',
  'guardvillagerstaczsupport.configuration.hostile_tacz_magazine_size.tooltip': '敌对生物模拟换弹前成功射击的次数。',
  'guardvillagerstaczsupport.configuration.hostile_tacz_reload_ticks': '敌对生物换弹时间',
  'guardvillagerstaczsupport.configuration.hostile_tacz_reload_ticks.tooltip': '敌对生物模拟换弹等待的 tick 数。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_spawn_chance': '僵尸武器生成概率',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_spawn_chance.tooltip': '新生成的原版僵尸从 zombie_tacz_weapon_ids 中获得武器的概率。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_ids': '僵尸 TACZ 武器 ID',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_ids.tooltip': '原版僵尸生成时可能携带的 TACZ 枪械 ID，无效 ID 会被忽略。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_drop_chance': '僵尸武器掉落概率',
  'guardvillagerstaczsupport.configuration.zombie_tacz_weapon_drop_chance.tooltip': '持枪僵尸死亡时掉落武器的概率。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_ammo_drop_min': '僵尸弹药掉落下限',
  'guardvillagerstaczsupport.configuration.zombie_tacz_ammo_drop_min.tooltip': '持枪僵尸掉落弹药时兼容弹药物品的最小数量。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_ammo_drop_max': '僵尸弹药掉落上限',
  'guardvillagerstaczsupport.configuration.zombie_tacz_ammo_drop_max.tooltip': '持枪僵尸掉落弹药时兼容弹药物品的最大数量。',
  'guardvillagerstaczsupport.configuration.zombie_tacz_inaccuracy_degrees': '僵尸射击偏差角度',
  'guardvillagerstaczsupport.configuration.zombie_tacz_inaccuracy_degrees.tooltip': '持枪僵尸开火时施加的最大随机偏航/俯仰偏差（度）。',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_spawn_chance': '掠夺者武器生成概率',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_spawn_chance.tooltip': '新生成的原版掠夺者从 pillager_tacz_weapon_ids 中获得武器的概率。',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_ids': '掠夺者 TACZ 武器 ID',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_ids.tooltip': '原版掠夺者生成时可能携带的 TACZ 枪械 ID，无效 ID 会被忽略。',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_drop_chance': '掠夺者武器掉落概率',
  'guardvillagerstaczsupport.configuration.pillager_tacz_weapon_drop_chance.tooltip': '持枪掠夺者死亡时掉落武器的概率。',
  'guardvillagerstaczsupport.configuration.pillager_tacz_ammo_drop_min': '掠夺者弹药掉落下限',
  'guardvillagerstaczsupport.configuration.pillager_tacz_ammo_drop_min.tooltip': '持枪掠夺者掉落弹药时兼容弹药物品的最小数量。',
  'guardvillagerstaczsupport.configuration.pillager_tacz_ammo_drop_max': '掠夺者弹药掉落上限',
  'guardvillagerstaczsupport.configuration.pillager_tacz_ammo_drop_max.tooltip': '持枪掠夺者掉落弹药时兼容弹药物品的最大数量。',
};

const ARTIFACTS_KEY_ZH = {
  'artifacts.config.client.heliumFlamingoOverlayOffset.description': '控制氦气火烈鸟充气条的垂直位置',
  'artifacts.config.client.heliumFlamingoOverlayOffset.title': '氦气火烈鸟覆盖层偏移',
  'artifacts.config.client.showArtifactsOnPlayers.description.0': '是否在玩家身上显示佩戴的饰品',
  'artifacts.config.client.showArtifactsOnPlayers.description.1': '此选项仅作用于客户端，不会改变其他玩家看到的内容',
  'artifacts.config.client.showArtifactsOnPlayers.title': '在玩家身上显示饰品',
  'artifacts.config.general.campsite.minimalistCampsites.description': '将营地替换为单个箱子/拟形怪',
  'artifacts.config.general.campsite.minimalistCampsites.title': '极简营地',
  'artifacts.config.general.slots.addFaceSlot.description.0': '启用后为浮潜镜和夜视镜添加独立槽位',
  'artifacts.config.general.slots.addFaceSlot.description.1': '（仅限 Trinkets，目前不兼容 Curios 或 Accessories）',
  'artifacts.config.general.slots.addFaceSlot.title': '添加面部槽位',
  'artifacts.config.general.slots.enableAccessoriesCompat.description.0': 'Artifacts 是否向 Accessories 菜单添加槽位，',
  'artifacts.config.general.slots.enableAccessoriesCompat.description.1': '并允许饰品装备到其中',
  'artifacts.config.general.slots.enableAccessoriesCompat.title': '启用 Accessories 兼容',
  'artifacts.config.general.slots.enableCuriosCompat.description.0': 'Artifacts 是否向 Curios 菜单添加槽位，',
  'artifacts.config.general.slots.enableCuriosCompat.description.1': '并允许饰品装备到其中',
  'artifacts.config.general.slots.enableCuriosCompat.title': '启用 Curios 兼容',
  'artifacts.config.general.slots.enableTrinketsCompat.description.0': 'Artifacts 是否向 Trinket 菜单添加槽位，',
  'artifacts.config.general.slots.enableTrinketsCompat.description.1': '并允许饰品装备到其中',
  'artifacts.config.general.slots.enableTrinketsCompat.title': '启用 Trinkets 兼容',
  'artifacts.config.general.slots.removeSlotRestrictions.description.0': '启用后允许任意饰品装备到任意槽位',
  'artifacts.config.general.slots.removeSlotRestrictions.description.1': '（需要 Curios 或 Trinkets，目前不兼容 Accessories）',
  'artifacts.config.general.slots.removeSlotRestrictions.title': '移除槽位限制',
  'artifacts.config.general.slots.title': '槽位',
  'artifacts.config.items.scarf_of_invisibility.hidesEffectParticles.description': '隐身围巾是否阻止所有状态效果产生粒子',
  'artifacts.config.items.scarf_of_invisibility.hidesEffectParticles.title': '隐藏效果粒子',
  'tag.item.artifacts.slot.face': '可装备到面部槽位的饰品',
};

const MEZZ_KEY_ZH = {
  'mezz_config.config.name': '名称：%s',
  'mezz_config.config.description': '描述：%s',
  'mezz_config.config.valueValues': '有效值：%s',
  'mezz_config.config.defaultValue': '默认值：%s',
  'mezz_config.config.requiresWorldRestart': '需要重进世界才能生效。',
  'mezz_config.config.requiresGameRestart': '需要重启游戏才能生效。',
  'mezz_config.config.fileWatcher': '文件监视',
  'mezz_config.config.fileWatcher.description': '控制配置文件自动监视与重载时机。',
  'mezz_config.config.fileWatcher.enabled': '自动文件监视',
  'mezz_config.config.fileWatcher.enabled.description': '自动监视配置文件，并在游戏外部修改后重新加载。',
  'mezz_config.config.fileWatcher.changeSettlingDelayMilliseconds': '变更稳定延迟',
  'mezz_config.config.fileWatcher.changeSettlingDelayMilliseconds.description': '最后一次文件系统事件后等待多少毫秒再重载变更的配置文件。',
  'mezz_config.config.fileWatcher.missingDirectoryRetryIntervalMilliseconds': '缺失目录重试间隔',
  'mezz_config.config.fileWatcher.missingDirectoryRetryIntervalMilliseconds.description': '尝试开始监视尚不存在的配置目录的间隔毫秒数。',
  'mezz_config.config.logging': '日志',
  'mezz_config.config.logging.description': '控制可选的 MezzConfig 诊断日志。',
  'mezz_config.config.logging.logUntranslatedKeys': '记录未翻译的键',
  'mezz_config.config.logging.logUntranslatedKeys.description': '记录当前语言中缺失的分类与值本地化键。开发环境中默认启用。',
};

const CT_KEY_ZH = {
  'craftingtweaks.configuration.common': '通用',
  'craftingtweaks.configuration.common.compressRequiresCraftingGrid': '压缩需要合成网格',
  'craftingtweaks.configuration.common.compressRequiresCraftingGrid.tooltip': '若希望（解）压缩功能在合成界面之外也可用，请设为 false（仅在服务器安装时于玩家背包内生效）',
  'craftingtweaks.configuration.common.compressDenylist': '压缩黑名单',
  'craftingtweaks.configuration.common.compressDenylist.tooltip': '不会被压缩键合成的 modid:name 条目列表。',
  'craftingtweaks.configuration.client': '客户端',
  'craftingtweaks.configuration.client.rightClickCraftsStack': '右键合成整组',
  'craftingtweaks.configuration.client.rightClickCraftsStack.tooltip': '设为 true 时，右键点击合成台的结果槽会合成一整组。',
  'craftingtweaks.configuration.client.hideVanillaCraftingGuide': '隐藏原版合成指南',
  'craftingtweaks.configuration.client.hideVanillaCraftingGuide.tooltip': '我们都知道 JEI 更好用。此选项会直接隐藏原版配方书按钮而不是移动它。',
  'craftingtweaks.configuration.client.vanillaCraftingGuideOffsetX': '原版合成指南偏移 X',
  'craftingtweaks.configuration.client.vanillaCraftingGuideOffsetX.tooltip': '重新定位原版配方书按钮时距右侧的偏移量。',
  'craftingtweaks.configuration.client.vanillaCraftingGuideOffsetY': '原版合成指南偏移 Y',
  'craftingtweaks.configuration.client.vanillaCraftingGuideOffsetY.tooltip': '重新定位原版配方书按钮时距顶部的偏移量。',
  'craftingtweaks.configuration.client.mode': '模式',
  'craftingtweaks.configuration.client.mode.tooltip': '设为 \'DEFAULT\' 同时启用按钮和快捷键；\'BUTTONS\' 仅启用按钮；\'HOTKEYS\' 仅启用快捷键；\'DISABLED\' 完全禁用。',
  'craftingtweaks.configuration.client.disabledAddons': '禁用的附加组件',
  'craftingtweaks.configuration.client.disabledAddons.tooltip': '在此添加希望禁用 Crafting Tweaks 支持的 Mod ID。',
};

const JA_KEY_ZH = {
  'config.jade.plugin_jadeaddons.equipment_requirement': '装备需求标签',
  'config.jade.plugin_jadeaddons.create.blaze_burner': '烈焰人燃烧室',
  'config.jade.plugin_jadeaddons.create.crafting_blueprint': '合成蓝图',
  'config.jade.plugin_jadeaddons.create.placard': '告示牌',
  'config.jade.plugin_jadeaddons.create.exact_block': '动力装置精确方块',
  'config.jade.plugin_jadeaddons.create.filter': '过滤器',
  'config.jade.plugin_jadeaddons.create.backtank_capacity': '背罐容量',
  'config.jade.plugin_jadeaddons.create.goggles': '护目镜集成',
  'config.jade.plugin_jadeaddons.create.goggles.requires_goggles': '需要护目镜',
  'config.jade.plugin_jadeaddons.create.goggles.detailed': '仅详细模式',
  'config.jade.plugin_jadeaddons.tconstruct.casting_table': '铸造台',
  'config.jade.plugin_jadeaddons.tconstruct.drain': '排液口与导管',
  'config.jade.plugin_jadeaddons.mcjtylib.jadeaddons': '启用',
  'config.jade.plugin_jadeaddons.deepresonance.crystal': '水晶',
  'config.jade.plugin_jadeaddons.deepresonance.generator_part': '发电机部件',
  'config.jade.plugin_jadeaddons.lootr.info': '信息',
  'jadeaddons.create.backtank_air': '空气：%s/%s',
  'jadeaddons.mcjtylib.infused': '注能：%s%%',
  'jadeaddons.mcjtylib.ownedBy': '所有者：%s',
  'jadeaddons.mcjtylib.ownedBy.withChannel': '所有者：%s（频道 %s）',
  'jadeaddons.mcjtylib.ownedBy.warning': '警告！所有者未正确设置！请重新放置方块！',
  'jadeaddons.deepresonance.sep': '强度/效率/纯度 %s%% %s%% %s%%',
  'jadeaddons.deepresonance.crystalPower': '能量：%s%%（%s RF/t）',
  'jadeaddons.deepresonance.id': 'ID：%s',
  'jadeaddons.deepresonance.collectors': '收集器：%s',
  'jadeaddons.deepresonance.generators': '发电机：%s',
  'jadeaddons.lootr.decay': '消失于：%s',
  'jadeaddons.lootr.refresh': '刷新于：%s',
  'jadeaddons.lootr.refreshed': '已刷新！',
  'jade.modName.jadeaddons.create': '机械动力',
  'jade.modName.jadeaddons.tconstruct': '匠魂',
  'jade.modName.jadeaddons.mcjtylib': 'McJtyLib',
  'jade.modName.jadeaddons.deepresonance': '深度共振',
  'jade.modName.jadeaddons.lootr': 'Lootr',
  'entity.tconstruct.glow_ball': '荧光球',
  'entity.tconstruct.efln_ball': 'EFLN 球',
  'entity.tconstruct.flint_shuriken': '燧石飞镖',
  'entity.tconstruct.quartz_shuriken': '石英飞镖',
};

const IPN_KEY_ZH = {
  'inventoryprofiles.gui.config.Features': '功能',
  'inventoryprofiles.config.name.enable_sorting_and_moving': '启用物品排序与移动',
  'inventoryprofiles.config.description.enable_sorting_and_moving': '启用/禁用物品排序与移动增强功能。',
  'inventoryprofiles.config.name.item_scrolling': '启用物品滚动',
  'inventoryprofiles.config.description.item_scrolling': '启用/禁用物品滚动',
  'inventoryprofiles.config.category.features': '功能',
  'inventoryprofiles.gui.config.SortSettings': '排序设置',
  'inventoryprofiles.config.category.accumulated_count': '按数量排序选项',
  'inventoryprofiles.config.name.quick_slot_4_profile': '快捷配置 4 名称',
  'inventoryprofiles.config.name.quick_slot_5_profile': '快捷配置 5 名称',
  'inventoryprofiles.config.name.quick_slot_6_profile': '快捷配置 6 名称',
  'inventoryprofiles.config.name.quick_slot_7_profile': '快捷配置 7 名称',
  'inventoryprofiles.config.name.quick_slot_8_profile': '快捷配置 8 名称',
  'inventoryprofiles.config.name.quick_slot_9_profile': '快捷配置 9 名称',
  'inventoryprofiles.config.name.quick_slot_10_profile': '快捷配置 10 名称',
  'inventoryprofiles.config.description.quick_slot_4_profile': '可通过快捷配置 4 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_5_profile': '可通过快捷配置 5 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_6_profile': '可通过快捷配置 6 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_7_profile': '可通过快捷配置 7 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_8_profile': '可通过快捷配置 8 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_9_profile': '可通过快捷配置 9 热键访问的配置名称。',
  'inventoryprofiles.config.description.quick_slot_10_profile': '可通过快捷配置 10 热键访问的配置名称。',
  'inventoryprofiles.config.category.scroll.general': '滚动通用设置',
  'inventoryprofiles.config.name.direction_absolute': '绝对滚动方向',
  'inventoryprofiles.config.description.direction_absolute': '为 true 时，"向上滚轮"总是把物品从玩家背包移到箱子，\n"向下滚轮"总是把物品从箱子移到玩家背包。\n\n为 false 时，"向上滚轮"把物品从光标下的容器移到另一个容器，\n"向下滚轮"把物品从另一个容器移到光标下的容器。',
  'inventoryprofiles.config.name.disable_for_non_empty_bundles': '对非空收纳袋禁用',
  'inventoryprofiles.config.description.disable_for_non_empty_bundles': '为 true 时滚动不会移动非空收纳袋，交由原版处理。\n为 false 时滚动会移动非空收纳袋',
  'inventoryprofiles.config.name.profile_4': '选择并应用快捷配置 4',
  'inventoryprofiles.config.name.profile_5': '选择并应用快捷配置 5',
  'inventoryprofiles.config.name.profile_6': '选择并应用快捷配置 6',
  'inventoryprofiles.config.name.profile_7': '选择并应用快捷配置 7',
  'inventoryprofiles.config.name.profile_8': '选择并应用快捷配置 8',
  'inventoryprofiles.config.name.profile_9': '选择并应用快捷配置 9',
  'inventoryprofiles.config.name.profile_10': '选择并应用快捷配置 10',
  'inventoryprofiles.config.description.profile_4': '切换到快捷配置 4 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_5': '切换到快捷配置 5 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_6': '切换到快捷配置 6 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_7': '切换到快捷配置 7 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_8': '切换到快捷配置 8 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_9': '切换到快捷配置 9 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
  'inventoryprofiles.config.description.profile_10': '切换到快捷配置 10 的热键。\n可在"编辑配置"配置页中设置快捷配置。',
};

const MODERNFIX_KEY_ZH = {
  'modernfix.redirector_installed': 'ModernFix 检测到已安装 Redirector。Redirector 已知会导致许多难以排查的奇怪问题，强烈建议移除。',
  'modernfix.option.mixin.perf.dynamic_resources.ldlib': '针对动态资源的 LDLib 兼容补丁',
  'modernfix.option.mixin.perf.compress_unihex_font': '更高效地存储 Unicode 字体字形。感谢 @AnAwesomGuy 提供的技巧。',
  'modernfix.option.mixin.bugfix.restore_old_dragon_movement': '修复 MC-272431：末影龙无法像 1.13 及更早版本那样俯冲到传送门。这会使龙的飞行方式与现代玩家习惯的大不相同，并移除速通打法，因此默认不启用。感谢 Jukitsu 发现原版代码中的回退问题。',
  'modernfix.option.mixin.bugfix.missing_block_entities': 'Hypixel 发送的区块缺少部分方块实体数据，导致箱子等方块隐形。此"修复"在客户端创建所需数据。对行为正常的服务器或单人游戏无影响。',
  'modernfix.option.mixin.bugfix.buffer_builder_leak': '尝试规避 Mod 构造的 BufferBuilder 对象内存泄漏。在极少数情况下这会导致 JVM 崩溃并生成 hs_err_pid 文件。如遇到此类崩溃，请尝试禁用此选项。',
  'modernfix.option.mixin.bugfix.extra_experimental_screen': '修复重新打开以实验性功能创建的世界时，仍再次显示实验性功能警告的问题。',
  'modernfix.option.mixin.bugfix.forge_at_inject_error': '修复 Forge 早期错误处理代码中的重大疏漏：该问题导致部分 Mod 加载而另一些不加载，通常使游戏直接崩溃而非显示预期的错误界面。此问题已在 NeoForge 以及足够新版本的 Forge 中修复。',
  'modernfix.option.mixin.bugfix.world_screen_skipped': '修复 MC-251068：删除最后一个世界后返回到空的世界列表。',
  'modernfix.option.mixin.feature.blockentity_incorrect_thread': '**这是调试选项，正常游玩不应启用。** 尝试检测在错误线程上与方块实体交互的 Mod 并让游戏带着更多信息崩溃，而不是抛出含糊的 ConcurrentModificationException',
  'modernfix.option.mixin.feature.cause_lag_by_disabling_threads': '禁用游戏为服务器和区块渲染使用的工作线程。**这几乎在所有硬件上都会降低性能**，只应在客户端上、并且你完全清楚自己在做什么时启用，大概也只适用于物理核心很少（≤2 个）的硬件。在极少数情况下，由于有限核心的竞争减少，它可以降低卡顿尖峰。',
  'modernfix.option.mixin.feature.registry_event_progress': '在加载过程的部分阶段将 Forge 加载界面放到后台线程运行，以便在注册内容时显示进度。可能与某些 GPU 驱动（如 macOS）存在兼容性问题，整合包中请不要默认启用。',
  'modernfix.option.mixin.feature.remove_chat_signing': '阻止 Minecraft 客户端获取聊天签名密钥对。这会禁用客户端签署聊天消息的能力（类似 No Chat Reports，但方式更简单、 albeit 对用户不够友好）。',
  'modernfix.option.mixin.feature.remove_telemetry': '阻止 Minecraft 客户端向 Mojang 发送遥测数据。对 Mod 实例来说，这些遥测对 Mojang 通常也没什么意义。',
  'modernfix.option.mixin.perf.chunk_meshing': '对原版区块网格化逻辑进行小幅优化（若 Mod 完全替换区块渲染则无效）。',
  'modernfix.option.mixin.perf.faster_structure_location': '提高定位掩埋宝藏等结构的速度。',
  'modernfix.option.mixin.perf.forge_registry_alloc': '修复 Forge 更多导致热点注册方法过度分配内存的疏漏。',
  'modernfix.option.mixin.perf.memoize_creative_tab_build': '以兼容 JEI/EMI 等 Mod 时序要求的方式改进原版创造物品栏内容的缓存。可降低整合包中首次打开创造物品栏时的卡顿尖峰。',
  'modernfix.option.mixin.perf.potential_spawns_alloc': '优化 Forge 查找潜在生物生成的用途事件，减少在没有 Mod 修改潜在生成时重建权重列表的开销。',
  'modernfix.option.mixin.perf.ticking_chunk_alloc': '优化原版区块 ticking 逻辑以减少内存分配。',
  'modernfix.option.mixin.perf.worldgen_allocation': '优化原版世界生成逻辑以减少对象分配。',
  'modernfix.option.mixin.feature.suppress_narrator_stacktrace': '防止 Linux 上讲述人加载失败（通常是未安装 libflite）时游戏记录超长的堆栈跟踪。',
};

const FTBTEAMS_KEY_ZH = {
  'ftbteams.lost_a_life': '你的队伍失去了一条生命！剩余 %s / %s 条！',
  'ftbteams.kicked_no_lives': '玩家 %s 因死亡且队伍没有剩余生命而被移出队伍！',
  'ftbteams.disbanded_no_lives': '你的队伍因耗尽生命与成员而解散！',
  'ftbteams.party_full': '无法添加新成员，你的队伍已满！最大人数为 %s 人',
  'ftbteams.gui.toggle_chat': '点击切换',
  'ftbteams.message.limited_lives': '你的队伍剩余 %s / %s 条生命！',
  'ftbteams.message.limited_lives.warn': '如果你死亡，将被移出队伍！',
  'ftbteams.message.chat_redirected.on': '聊天消息已重定向到队伍聊天',
  'ftbteams.message.chat_redirected.off': '聊天消息已恢复到原版聊天',
  'ftbteams.message.added_stage': '已添加队伍阶段：%s',
  'ftbteams.message.no_team_stages': '该队伍没有队伍阶段',
  'ftbteams.message.removed_stage': '已移除队伍阶段：%s',
  'ftbteams.message.team_stages_header': '该队伍的 %s 个队伍阶段：',
  'ftbteams.message.set_property': '已将属性 %s 设为 %s',
  'ftbteams.message.parse_failed': '无法解析值：%s',
  'ftbteams.message.property_not_editable': '属性 %s 不可编辑！',
  'ftbteams.click_show_info': '点击查看队伍信息',
  'ftbteams.config.server.limited_lives': '队伍生命数限制',
  'ftbteams.config.server.limited_lives.tooltip': '大于 0 时启用队伍生命数限制：\n• 成员死亡时扣除一条队伍生命\n• 队伍生命耗尽时成员死亡会被移出队伍\n• 队长死亡时随机一名成员接任队长（官员优先）\n• 生命耗尽的队伍无法邀请新成员。',
  'ftbteams.config.server.max_party_size': '队伍最大人数',
  'ftbteams.config.server.max_party_size.tooltip': '大于 0 时，队伍最多可容纳该数量的玩家。\n为 0 时不限制队伍人数。\n注意：修改此设置时，人数已超过新上限的现有队伍可保持当前规模，但无法再邀请新成员。',
  'ftbteams.team_already_exists': '队伍 %s 已存在！',
  'ftbteams.out_of_lives': '你的队伍生命已耗尽！无法邀请新成员！',
};

const RCFG_KEY_ZH = {
  'rconfig.server.title': '专用服务器',
  'rconfig.server.desc': '可实时更新的属性。',
  'rconfig.server.wiki': 'Wiki',
  'rconfig.server.properties.white-list': '白名单',
  'rconfig.server.properties.white-list.desc': '启用后，仅白名单中的用户可以进入服务器。',
  'rconfig.server.properties.max-players': '最大玩家数',
  'rconfig.server.properties.max-players.desc': '服务器同时允许的最大玩家数。',
  'rconfig.server.properties.motd': '服务器描述（MOTD）',
  'rconfig.server.properties.motd.desc': '服务器列表中显示的消息。',
  'rconfig.server.properties.allow-flight': '允许飞行',
  'rconfig.server.properties.allow-flight.desc': '启用后允许玩家飞行，Mod 服务器通常需要。',
  'rconfig.server.properties.pvp': '玩家对战（PvP）',
  'rconfig.server.properties.pvp.desc': '启用后玩家可以互相攻击。',
  'rconfig.server.properties.enforce-whitelist': '强制白名单',
  'rconfig.server.properties.enforce-whitelist.desc': '启用后，服务器上不在白名单中的用户会被踢出。',
  'rconfig.ui.constant.close': '关闭',
  'rconfig.ui.constant.reset': '重置',
  'rconfig.ui.constant.edit': '编辑',
  'rconfig.ui.constant.edit.string': '编辑字符串',
  'rconfig.ui.constant.edit.list': '编辑列表',
  'rconfig.ui.constant.edit.object': '编辑对象',
  'rconfig.ui.constant.choose_item': '选择物品：',
  'rconfig.ui.constant.add_item': '添加物品：',
  'rconfig.ui.constant.mod_configs': 'Mod 配置',
  'rconfig.ui.constant.mod_configs.description': '选择要查看或编辑的配置。',
  'rconfig.color.preset.defaults': '默认',
  'rconfig.color.preset.recents': '最近使用',
  'rconfig.color.preset.mc_colors': '文本颜色',
};

const BALM_KEY_ZH = {
  'tag.item.c.dyes.black': '黑色染料',
  'tag.item.c.dyes.blue': '蓝色染料',
  'tag.item.c.dyes.brown': '棕色染料',
  'tag.item.c.dyes.cyan': '青色染料',
  'tag.item.c.dyes.gray': '灰色染料',
  'tag.item.c.dyes.green': '绿色染料',
  'tag.item.c.dyes.light_blue': '淡蓝色染料',
  'tag.item.c.dyes.light_gray': '淡灰色染料',
  'tag.item.c.dyes.lime': '黄绿色染料',
  'tag.item.c.dyes.magenta': '品红色染料',
  'tag.item.c.dyes.orange': '橙色染料',
  'tag.item.c.dyes.pink': '粉红色染料',
  'tag.item.c.dyes.purple': '紫色染料',
  'tag.item.c.dyes.red': '红色染料',
  'tag.item.c.dyes.white': '白色染料',
  'tag.item.c.dyes.yellow': '黄色染料',
  'tag.item.c.cooking_oil': '食用油',
  'tag.item.c.gems.diamond': '钻石',
  'tag.item.c.dyes': '染料',
  'tag.item.c.eggs': '鸡蛋',
  'tag.item.c.gems.emerald': '绿宝石',
  'tag.item.c.gems': '宝石',
  'tag.item.c.nuggets.gold': '金粒',
  'tag.item.c.ingots': '锭',
  'tag.item.c.ingots.iron': '铁锭',
  'tag.item.c.nuggets.iron': '铁粒',
  'tag.item.c.nuggets': '粒',
  'tag.item.c.ores': '矿石',
  'tag.item.c.stones': '石头',
  'tag.item.c.chests.chests': '木箱子',
  'tag.item.c.rods.wooden': '木棍',
  'balm.configuration.exampleCategory': '示例分类',
  'disconnect.balm.mod_missing_on_server': '服务器未安装 %s。请从你的游戏中移除该 Mod，或在服务器上也安装它。',
  'disconnect.balm.mod_missing_on_client': '你未安装 %s。请安装 %s 的 %s 版本才能在此服务器上游玩。',
  'disconnect.balm.mod_version_mismatch': '%s 版本不匹配。服务器需要 %s 版本，但你当前安装的是 %s。请安装正确的版本。',
  'config.jade.plugin_balm.jade': 'Balm',
};

const XAERO_MM_KEY_ZH = {
  'gui.xaero_old_minecraft': '此功能在这个旧版本 Minecraft 上不可用。',
  'gui.xaero_minimap_redirect_legacy': '已被服务器插件禁用！',
  'gui.xaero_minimap_redirect_item': '已禁用，因为你的快捷栏中缺少配置的必需物品：%1$s！',
  'gui.xaero_minimap_item': '小地图物品',
  'gui.xaero_box_minimap_item': '小地图与路径点功能需要在快捷栏中持有的物品 ID。设为 "-" 表示不需要物品。',
  'gui.xaero_category_editor_read_only': '只读',
  'gui.xaero_entity_category_editor_server_enforced': '（服务器强制）',
  'gui.xaero_info_display_editor_server_enforced': '（服务器强制）',
  'gui.xaero_config_redirect_fairplay': '已被服务器强制的公平模式禁用！',
  'gui.xaero_config_redirect_safe_mode': '小地图处于安全模式时无法修改此值。',
  'gui.xaero_teleport_default_command_rotation': '默认传送旋转命令',
  'gui.xaero_box_teleport_default_command_rotation': '当路径点界面的选项菜单中未设置世界或服务器专属命令时，用于带旋转角度路径点传送的命令。',
  'gui.xaero_unit_ms': '毫秒',
  'gui.xaero_unit_s': '秒',
  'gui.xaero_hide_invisible_entities': '隐藏隐形实体',
  'gui.xaero_minimap_server_profiles': '小地图服务器设置',
  'gui.xaero_cave_mode_allowed_dimensions': '洞穴模式维度',
  'gui.xaero_box_cave_mode_allowed_dimensions': '以逗号分隔的维度 ID 列表，洞穴模式在其中生效。若列表为空（仅 []），洞穴模式在所有维度生效。',
  'gui.xaero_mm_auto_cave_mode': '自动洞穴模式',
  'gui.xaero_mm_box_auto_cave_mode': '根据头顶情况自动启用洞穴模式。顶面尺寸指需要在你头顶探测到的实心方块方形顶面的边长，实心方块不必在同一 Y 高度。',
  'gui.xaero_box_cave_mode_allowed': '可深入地表方块以下的绘图模式，主要用于显示地下洞穴和建筑内部。洞穴模式通常自动启用（见"自动洞穴模式"），也可用快捷键手动切换（见"手动洞穴模式起始 Y"）。',
  'gui.xaero_reset_config_profile_default': '重置配置预设默认值',
  'gui.xaero_reset_config_profile_default_message': '确定要恢复此配置预设中的默认值吗？',
  'gui.xaero_reset_config_profile_default_message2': '此操作无法撤销！非预设选项不受影响。',
  'gui.xaero_config_redirect_effect': '已被状态效果禁用！',
  'gui.xaero_further_zoomout': '进一步缩小',
  'gui.xaero_box_further_zoomout': '实验性功能！\n因可能存在性能问题而默认未启用，优化后将在未来默认启用。',
  'gui.xaero_minimap_undiscovered_opacity': '未探索区域不透明度',
  'gui.xaero_box_minimap_undiscovered_opacity': '地图上黑色未探索区域的不透明度，相对于主不透明度设置。',
  'gui.xaero_waypoint_filter_box': '路径点筛选',
  'gui.xaero_waypoint_filter_box_suggestion': '筛选……',
  'gui.xaero_default_waystone_name': '传送石',
  'gui.xaero_magenta': '品红色',
  'gui.xaero_light_blue': '淡蓝色',
  'gui.xaero_lime': '黄绿色',
  'gui.xaero_pink': '粉红色',
  'gui.xaero_brown': '棕色',
  'gui.xaero_showing_third_party_deleted_waypoints': '显示已删除的第三方路径点',
  'gui.xaero_box_showing_third_party_deleted_waypoints': '显示你已"删除"的第三方路径点，例如传送石路径点。',
  'gui.xaero_deleted': '已删除',
  'gui.xaero_discovered_waystone_waypoints': '已发现传送石路径点',
  'gui.xaero_box_discovered_waystone_waypoints': '自动将已发现的传送石（来自 Waystones 和 Wraith Waystones）显示为路径点。在 Wraith Waystones 中，仅已激活的传送石算作已发现。',
  'gui.xaero_other_waystone_waypoints': '其他传送石路径点',
  'gui.xaero_box_other_waystone_waypoints': '自动将其他类型的传送石（来自 Waystones 和 Wraith Waystones）显示为路径点。若支持（1.20.4+），包括原版 Waystones 的共享传送石；在 Wraith Waystones 中包括未激活的全局传送石。',
  'gui.xaero_waypoint_distance_in_menu': '菜单中显示路径点距离',
};

const XAERO_BPVP_KEY_ZH = {
  'gui.xaero_better_pvp_server_profiles': 'Better PVP 服务器设置',
};

const FTBQ_KEY_ZH = {
  'ftbquests.keys': 'FTB 任务',
  'ftbquests.gui': 'FTB 任务（界面）',
  'ftbquests.gui_editor': 'FTB 任务（界面编辑模式）',
  'ftbquests.gui_quest_panel': 'FTB 任务（任务查看面板）',
  'key.ftbquests.cycle_pinned_tracker': '固定任务追踪器可见性',
  'key.ftbquests.gui.search': '搜索',
  'key.ftbquests.gui.recenter': '界面回中',
  'key.ftbquests.gui.zoom_in': '放大',
  'key.ftbquests.gui.zoom_out': '缩小',
  'key.ftbquests.gui.zoom_reset': '重置缩放',
  'key.ftbquests.gui.player_prefs': '玩家偏好设置',
  'key.ftbquests.gui.next_chapter': '下一章',
  'key.ftbquests.gui.prev_chapter': '上一章',
  'key.ftbquests.gui.extended_info': '查看任务详细信息',
  'key.ftbquests.gui_editor.toggle_crosshairs': '切换十字准线',
  'key.ftbquests.gui_editor.select_all': '全选',
  'key.ftbquests.gui_editor.select_none': '取消全选',
  'key.ftbquests.gui_editor.copy': '复制',
  'key.ftbquests.gui_editor.paste': '粘贴',
  'key.ftbquests.gui_editor.redo': '重做',
  'key.ftbquests.gui_editor.undo': '撤销',
  'key.ftbquests.gui_editor.reload_theme': '重载主题',
  'key.ftbquests.gui_editor.delete': '删除悬停/选中项',
  'key.ftbquests.gui_editor.force_delete': '强制删除悬停/选中项',
  'key.ftbquests.gui_editor.complete_object': '强制完成悬停项',
  'key.ftbquests.gui_editor.reset_object': '强制重置悬停项',
  'key.ftbquests.gui_editor.save': '立即保存任务',
  'key.ftbquests.gui_editor.reward_tables': '打开奖励表编辑器',
  'key.ftbquests.gui.move_up': '上移选中项/向上滚动',
  'key.ftbquests.gui.move_down': '下移选中项/向下滚动',
  'key.ftbquests.gui.move_left': '左移选中项/向左滚动',
  'key.ftbquests.gui.move_right': '右移选中项/向右滚动',
  'key.ftbquests.gui_quest_panel.edit_title': '编辑标题',
  'key.ftbquests.gui_quest_panel.edit_subtitle': '编辑副标题',
  'key.ftbquests.gui_quest_panel.edit_desc': '编辑描述',
  'key.ftbquests.gui_quest_panel.add_page_break': '插入分页符',
  'key.ftbquests.gui_quest_panel.add_line': '插入图片',
  'key.ftbquests.gui_quest_panel.add_image': '插入分隔线',
  'key.ftbquests.gui_quest_panel.edit_quest_props': '编辑任务属性',
  'ftbquests.file.defaults.default_preset': '默认外观预设',
  'ftbquests.file.defaults.default_preset.tooltip': '未单独覆盖预设的所有章节与任务使用的视觉预设',
  'ftbquests.file.suppress_all_autoclaiming': '禁止所有奖励自动领取',
  'ftbquests.file.suppress_all_autoclaiming.tooltip': '为 true 时，任何奖励都无法自动领取，包括奖励选择界面的"全部领取"按钮。\n整合包开发期间可能有用，可确保测试者阅读任务……',
  'ftbquests.file.presets': '视觉预设',
  'ftbquests.chapter.appearance.default_preset': '默认外观预设',
  'ftbquests.chapter.appearance.default_preset.tooltip': '本章中未单独覆盖预设的所有任务使用的视觉预设',
  'ftbquests.image.click_action_type': '点击动作',
  'ftbquests.image.click_action_data': '点击动作数据',
  'ftbquests.image.click_action_data.tooltip': '• 打开 URI：http://、https:// 或 file:/// 链接\n• 跳转到任务：任务 ID——使用右键菜单"复制任务 ID"\n• 运行命令：在服务器上执行的命令\n• 发送自定义事件：CustomClickEvent 监听器的 ID 参数（namespace:path）\n• 显示物品配方：物品 ID\n• 显示文档页面：<mod>,<book-id>[,<page-id>[,<anchor>]]',
  'ftbquests.image.position_locked': '锁定位置',
  'ftbquests.image.position_locked.tooltip': '为 true 时防止图片被移动\n当其他对象重叠时可用于防止误移',
  'ftbquests.image.text': '图片文本属性',
  'ftbquests.image.text.text_on_image': '在图片上绘制标题文本',
  'ftbquests.image.text.text_on_image.tooltip': '为 true 时，标题文本（如有）直接绘制在图片上\n为 false 时，标题文本作为提示框显示',
  'ftbquests.image.text.text_shadow': '文本阴影',
  'ftbquests.image.text.text_inset': '文本内边距',
  'ftbquests.image.text.text_inset.tooltip': '水平与垂直内边距，分别占图片宽与高的百分比',
  'ftbquests.image.text.text_h_align': '文本水平对齐',
  'ftbquests.image.text.text_v_align': '文本垂直对齐',
  'ftbquests.image.text_align.start': '起始',
  'ftbquests.image.text_align.middle': '居中',
  'ftbquests.image.text_align.end': '末尾',
  'ftbquests.click_action_type.none': '无动作',
  'ftbquests.click_action_type.open_uri': '打开 URI',
  'ftbquests.click_action_type.open_uri.tooltip': '可用于打开 http/https/file 链接',
  'ftbquests.click_action_type.open_quest': '跳转到任务',
  'ftbquests.click_action_type.open_quest.tooltip': '提供任务 ID，可通过右键菜单的"复制 ID"获取',
  'ftbquests.click_action_type.run_command': '运行命令',
  'ftbquests.click_action_type.custom_event': '发送自定义事件',
  'ftbquests.click_action_type.show_recipe': '显示物品配方',
  'ftbquests.click_action_type.show_docs': '显示文档页面',
  'ftbquests.quest.appearance.preset': '外观预设',
  'ftbquests.quest.appearance.preset.tooltip': '此任务使用的视觉预设\n留空时还会检查章节与全局默认预设\n非空时覆盖此任务的"形状"和"大小"设置',
  'ftbquests.gui.redo': '重做',
  'ftbquests.gui.edit_tooltip': '快捷键：Alt + 鼠标左键',
  'ftbquests.gui.insert_url_link': '插入 URL/文档链接',
  'ftbquests.gui.insert_quest_link': '插入任务链接',
  'ftbquests.gui.kr.general_controls': '通用操作',
  'ftbquests.gui.kr.view_quest_details': '鼠标左键;查看任务详情',
  'ftbquests.gui.kr.scroll_up_down': '鼠标滚轮;上/下滚动',
  'ftbquests.gui.kr.scroll_left_right': 'Shift + 鼠标滚轮;左/右滚动',
  'ftbquests.gui.kr.zoom_in_out': 'Ctrl + 鼠标滚轮;放大/缩小',
  'ftbquests.gui.kr.go_back': '退格键;查看任务时返回上一个查看的任务',
  'ftbquests.gui.kr.editor_mode': '编辑模式',
  'ftbquests.gui.kr.toggle_selection': 'Ctrl + 鼠标左键;切换选中',
  'ftbquests.gui.kr.properties_editor': '左 Alt + 鼠标左键;属性编辑器',
  'ftbquests.gui.kr.copy_quest': '右 Alt + 鼠标左键;复制任务',
  'ftbquests.gui.kr.move_selected_quests': '鼠标中键;移动选中任务',
  'ftbquests.gui.kr.context_menu': '鼠标右键;右键菜单',
  'ftbquests.gui.kr.drag_highlight': '鼠标中键：拖拽;框选任务',
  'ftbquests.gui.kr.drag_toggle_select': 'Ctrl + 鼠标中键：拖拽;在框选范围内切换选中',
  'ftbquests.gui.kr.paste_no_deps': '{key.ftbquests.gui_editor.paste} + Shift;粘贴任务（不含依赖）',
  'ftbquests.gui.kr.paste_as_link': '{key.ftbquests.gui_editor.paste} + Shift;粘贴为任务链接',
  'ftbquests.gui.kr.reload_no_toast': '{key.ftbquests.gui_editor.reload_theme} + Shift;重载主题（不显示提示）',
  'ftbquests.gui.kr.quest_view_panel': '任务查看面板',
  'ftbquests.gui.edit_bezier_points': '编辑贝塞尔控制点',
  'ftbquests.gui.clear_bezier_points': '清除贝塞尔控制点',
  'ftbquests.gui.editing_bezier': '贝塞尔编辑 | [回车] 确认 | [Esc] 取消',
  'ftbquests.gui.xp_rewards_claimed': '已领取经验奖励',
  'ftbquests.task.ftbquests.kill.nbt_filter': 'NBT 过滤器',
  'ftbquests.task.ftbquests.kill.nbt_filter.tooltip': '非空时，对实体的 NBT 进行模糊匹配\n使用标准 Minecraft SNBT 语法\n例如 {Color: 4b} 匹配黄色染料染过的羊',
  'ftbquests.task.ftbquests.observation.to_observe.tooltip': '要观察的方块、方块实体或实体的 ID，或方块/实体标签\n对方块实体和实体可选择附加 NBT 进行模糊匹配，例如\nminecraft:sheep{Color: 4b}——一只黄色的羊\n注意：要匹配的 NBT 必须由服务器端实体同步到客户端！',
  'ftbquests.reward.claim_xp': '领取经验',
  'ftbquests.bookmark_added': '已添加书签：%s',
  'ftbquests.bookmark_removed': '已移除书签：%s',
  'ftbquests.pinned.pinned_exclude_flexible': '排除灵活模式任务',
  'ftbquests.pinned.pinned_exclude_flexible.tooltip': '为 true 时，仅因灵活模式可开始（尚不可完成）的任务不显示在追踪器中\n为 false 时，显示所有可开始的任务',
  'ftbquests.pinned.pinned_visibility': '固定追踪器可见性',
  'ftbquests.pinned.visibility.all': '任务与目标',
  'ftbquests.pinned.visibility.quests_only': '仅任务',
  'ftbquests.pinned.visibility.hidden': '隐藏',
  'ftbquests.changelog': '变更历史显示',
  'ftbquests.changelog.always_show': '总是显示变更历史',
  'ftbquests.changelog.always_show.tooltip': '也可用反引号 [`] 键切换',
  'ftbquests.changelog.max_lines': '最大行数',
  'ftbquests.changelog.show_time': '变更历史显示时长（秒）',
  'ftbquests.changelog.show_time.tooltip': '未启用"总是显示变更历史"时，变更历史保持显示的时长',
  'ftbquests.changelog.font_scale': '变更历史字体缩放',
  'ftbquest.changelog.font_scale.tooltip': '建议使用 0.25 的倍数',
  'ftbquests.gui.url_or_docs': 'URL 或 \'docs:\' 链接',
  'ftbquests.event.create': '创建 %s：\'%s\'',
  'ftbquests.event.delete': '删除 %s：\'%s\'',
  'ftbquests.event.modify': '修改 %s：\'%s\'',
  'ftbquests.event.move_chapter_across': '移动 %s \'%s\' -> %s \'%s\'',
  'ftbquests.event.move_object': '移动 %s \'%s\' %s',
  'ftbquests.event.move_movable': '移动 %s \'%s\'',
  'ftbquests.event.update_translation': '更新翻译 %s %s \'%s\'',
};

const MOONLIGHT_KEY_ZH = {
  'gui.moonlight.config.mods_button': 'Mod 列表',
  'gui.moonlight.config.mods_title': '可配置的 Mod',
  'gui.moonlight.config.discover_mods': '发现 Mod',
  'gui.moonlight.config.open_folder': '打开配置文件夹',
  'gui.moonlight.config.sort_ascending': '按 A-Z 排序',
  'gui.moonlight.config.sort_descending': '按 Z-A 排序',
  'gui.moonlight.config.favourite': '收藏',
  'gui.moonlight.config.unfavourite': '取消收藏',
  'gui.moonlight.config.discover_title': '发现 Mod',
  'gui.moonlight.config.discover_title_by': '%s 的更多 Mod',
  'gui.moonlight.config.discover_by': '%s 出品的 Mod',
  'gui.moonlight.config.discover_loading': '正在获取 Mod 列表',
  'gui.moonlight.config.discover_offline': '无法连接 Mod 列表，请检查网络连接。',
  'gui.moonlight.config.discover_no_results': '没有匹配搜索的 Mod',
  'gui.moonlight.config.authors': '作者',
  'gui.moonlight.config.edit_manually': '编辑文件',
  'gui.moonlight.config.save': '保存',
  'gui.moonlight.config.save_count': '保存 %s',
  'gui.moonlight.config.reset': '重置为默认',
  'gui.moonlight.config.reset_all': '全部重置',
  'gui.moonlight.config.reset_all.title': '重置所有选项？',
  'gui.moonlight.config.reset_all.message': '这会将此配置中的每个选项重置为默认值并立即保存，无法撤销。',
  'gui.moonlight.config.discard.title': '放弃更改？',
  'gui.moonlight.config.discard.message': '你有 %s 项未保存的更改，确定不保存就离开吗？',
  'gui.moonlight.config.discard.confirm': '放弃',
  'gui.moonlight.config.reload_needed.title': '配置已保存',
  'gui.moonlight.config.reload_needed.world': '部分更改需要重进世界才能生效。',
  'gui.moonlight.config.reload_needed.game': '部分更改需要重启游戏才能生效。',
  'gui.moonlight.config.search': '搜索……',
  'gui.moonlight.config.color_picker': '取色器',
  'gui.moonlight.config.color_pick': '选取',
  'gui.moonlight.config.no_matches': '无匹配项',
  'gui.moonlight.config.list_entries': '编辑（%s）',
  'gui.moonlight.config.list_add': '添加条目',
  'gui.moonlight.config.list_remove': '移除条目',
  'gui.moonlight.config.list_entry': '条目 %s',
  'gui.moonlight.config.map_duplicate_key': '键重复，仅保留最后一个',
  'gui.moonlight.config.schema_type': '类型',
  'gui.moonlight.config.edit': '编辑',
  'gui.moonlight.config.unavailable.not_in_world': '此配置属于某个世界，请进入世界后编辑。',
  'gui.moonlight.config.unavailable.server_controlled': '此配置由你连接的服务器控制。',
  'gui.moonlight.config.reload.world': '需要重进世界',
  'gui.moonlight.config.reload.game': '需要重启游戏',
  'gui.moonlight.config.disabled_by': '被 %s 禁用',
  'gui.moonlight.config.json_hint': '输入 JSON……',
  'gui.moonlight.config.json_invalid': 'JSON 无效',
  'gui.moonlight.config.schema_invalid': '值无效：%s',
  'tooltip.moonlight.media.youtube': 'Youtube 频道',
  'tooltip.moonlight.media.twitter': 'Twitter 主页',
  'tooltip.moonlight.media.discord': 'Mod Discord',
  'tooltip.moonlight.media.patreon': '在 Patreon 上支持我 :D',
  'tooltip.moonlight.media.ko_fi': '请我喝杯咖啡',
  'tooltip.moonlight.media.curseforge': 'CurseForge 页面',
  'tooltip.moonlight.media.modrinth': 'Modrinth 页面',
  'tooltip.moonlight.media.marketplace': '来 Marketplace 看看我们！',
  'tooltip.moonlight.media.github': 'Mod Wiki',
  'tooltip.moonlight.media.link': 'Mod 页面',
  'tooltip.moonlight.media.partner_server': '需要服务器？试试 %s',
  'tooltip.moonlight.media.akliz': '需要服务器？试试 Akliz',
  'message.moonlight.cached': '缓存资源',
  'message.moonlight.cached_zipped': '压缩缓存资源',
  'message.moonlight.runtime': '运行时资源',
  'message.moonlight.merged_pack.description': '%s 个 Mod 的资源',
  'message.moonlight.merged_pack.title': 'Moonlight 动态资源',
  'message.moonlight.spawn_box_block.size': '生成箱尺寸',
  'tooltip.moonlight.block_tags': '方块标签：',
  'tooltip.moonlight.item_tags': '物品标签：',
  'block.moonlight.spawn_box': '生成箱方块',
  'commands.moonlight.blockstate_stats': '总方块数：%1$s，总 BlockState 数：%2$s。更多信息已保存至 %3$s',
  'commands.moonlight.dice': '掷出 D%1$d：%2$d',
  'commands.moonlight.config.no_config': 'Mod \'%s\' 没有配置界面',
  'commands.moonlight.navigation.add': '已为 %s 启用寻路调试渲染器',
  'commands.moonlight.navigation.remove': '已为 %s 禁用寻路调试渲染器',
  'commands.moonlight.navigation.on': '已启用寻路调试渲染器',
  'commands.moonlight.navigation.off': '已禁用寻路调试渲染器',
  'commands.moonlight.neighbor_updates.on': '已启用邻居更新渲染器',
  'commands.moonlight.neighbor_updates.off': '已禁用邻居更新渲染器',
  'commands.moonlight.goal_selector.add': '已为 %s 启用目标选择器调试渲染器',
  'commands.moonlight.goal_selector.remove': '已为 %s 禁用目标选择器调试渲染器',
  'commands.moonlight.goal_selector.on': '已启用目标选择器调试渲染器',
  'commands.moonlight.goal_selector.off': '已禁用目标选择器调试渲染器',
  'commands.moonlight.structures.add': '已为 %s 启用结构边界调试渲染器',
  'commands.moonlight.structures.remove': '已为 %s 禁用结构边界调试渲染器',
  'commands.moonlight.structures.on': '已启用结构边界调试渲染器',
  'commands.moonlight.structures.off': '已禁用结构边界调试渲染器',
  'commands.moonlight.back.invalid_dimension': '上一个位置所在的维度已不再加载',
  'commands.moonlight.back.empty': '没有记录的上一个位置',
  'commands.moonlight.back.only_players': '只有玩家可以使用 back 命令',
  'commands.moonlight.added_map_marker': '已为当前物品添加地图装饰 %s',
  'commands.moonlight.registry.copy_elements_names': '点击复制所有条目名称到剪贴板',
  'commands.moonlight.registry.element': '%s : %s',
  'commands.moonlight.registry.elements_count': '条目：%s',
  'commands.moonlight.registry.error.unknown_registry': '未知注册表 \'%s\'',
  'commands.moonlight.registry.page_info': '%s <第 %s / %s 页>',
  'commands.moonlight.registry.registry_key': '%s',
  'commands.moonlight.registry.dump.success': '已将注册表内容导出到 %s',
  'commands.moonlight.section_path.on': '已显示区块路径',
  'commands.moonlight.section_path.off': '已隐藏区块路径',
  'commands.moonlight.smart_cull.on': '已启用智能剔除',
  'commands.moonlight.smart_cull.off': '已禁用智能剔除',
  'commands.moonlight.frustum.captured': '已捕获视锥',
  'commands.moonlight.frustum.killed': '已清除视锥',
  'commands.moonlight.section_visibility.on': '已启用区块可见性',
  'commands.moonlight.section_visibility.off': '已禁用区块可见性',
  'commands.moonlight.wireframe.on': '已启用线框',
  'commands.moonlight.wireframe.off': '已禁用线框',
  'commands.moonlight.water.on': '已启用水调试渲染器',
  'commands.moonlight.water.off': '已禁用水调试渲染器',
  'commands.moonlight.heightmap.on': '已启用高度图渲染器',
  'commands.moonlight.heightmap.off': '已禁用高度图渲染器',
  'commands.moonlight.collision.on': '已启用碰撞渲染器',
  'commands.moonlight.collision.off': '已禁用碰撞渲染器',
  'commands.moonlight.support.on': '已启用支撑形状渲染器',
  'commands.moonlight.support.off': '已禁用支撑形状渲染器',
  'commands.moonlight.light.on': '已启用光照调试渲染器',
  'commands.moonlight.light.off': '已禁用光照调试渲染器',
  'commands.moonlight.world_gen_attempts.on': '已启用世界生成尝试渲染器',
  'commands.moonlight.world_gen_attempts.off': '已禁用世界生成尝试渲染器',
  'commands.moonlight.solid_faces.on': '已启用实心面渲染器',
  'commands.moonlight.solid_faces.off': '已禁用实心面渲染器',
  'commands.moonlight.game_events.on': '已启用游戏事件渲染器',
  'commands.moonlight.game_events.off': '已禁用游戏事件渲染器',
  'commands.moonlight.sky_light_sections.on': '已启用天空光照区块渲染器',
  'commands.moonlight.sky_light_sections.off': '已禁用天空光照区块渲染器',
  'commands.moonlight.breeze.on': '已启用微风调试渲染器',
  'commands.moonlight.breeze.off': '已禁用微风调试渲染器',
  'leaves_type.ulterlands.souldrained': '石化',
  'moonlight.nautilus_studio.map_marker': '地图标记',
  'moonlight.nautilus_studio.villager_trade': '村民交易',
  'moonlight.config.common.enabled': '启用',
  'moonlight.config.common.min': '最小值',
  'moonlight.config.common.max': '最大值',
  'moonlight.config.common.x': 'X',
  'moonlight.config.common.y': 'Y',
  'moonlight.config.common.z': 'Z',
  'moonlight.configuration.general.multi_threaded_generation': '多线程生成',
  'moonlight.configuration.general.multi_threaded_generation.description': '为动态资源启用多线程生成（若支持）。在核心数较多的系统上可提升性能。',
  'moonlight.configuration.general.extra_debug': '额外调试',
  'moonlight.configuration.general.extra_debug.description': '仅用于调试。启用部分调试功能，如更多日志或 blocktypes_debug.txt，文件位于 ~/.minecraft/debug/dynamic_registry_dump……',
  'moonlight.configuration.general.extra_children_debug': '额外子项调试',
  'moonlight.configuration.general.extra_children_debug.description': '启用后将列出每种 BlockType 的子项。BlockType 子项列表也会通过 EXTRA_DEBUG 写入同一文件。注意：必须先启用 EXTRA_DEBUG。',
  'moonlight.configuration.general.faster_cache_search': '更快的缓存搜索',
  'moonlight.configuration.general.faster_cache_search.description': '让动态资源缓存使用树结构索引，大幅加快查询速度，但会多占用一些内存。',
  'moonlight.configuration.general.global_datapacks_folder': '全局数据包文件夹',
  'moonlight.configuration.general.global_datapacks_folder.description': '全局数据包文件夹。可在其中存放自动为所有世界加载的数据包。留空则禁用',
  'moonlight.configuration.test_category': '测试分类',
  'moonlight.configuration.test_category.test_bool': '测试布尔值',
  'moonlight.configuration.test_category.test_bool.description': '布尔功能，绘制为带图标的勾/叉开关',
  'moonlight.configuration.test_category.test_plain_bool': '测试简单布尔值',
  'moonlight.configuration.test_category.test_plain_bool.description': '简单布尔值，绘制为开/关按钮',
  'moonlight.configuration.test_category.test_world_reload': '测试世界重载',
  'moonlight.configuration.test_category.test_world_reload.description': '需要重进世界的值（显示地球图标）',
  'moonlight.configuration.test_category.test_game_restart': '测试游戏重启',
  'moonlight.configuration.test_category.test_game_restart.description': '需要重启游戏的值（显示电源图标）',
  'moonlight.configuration.test_category.test_int': '测试整数',
  'moonlight.configuration.test_category.test_int.description': '整数，以文本框编辑',
  'moonlight.configuration.test_category.test_int_slider': '测试整数滑条',
  'moonlight.configuration.test_category.test_int_slider.description': '整数，以滑条编辑',
  'moonlight.configuration.test_category.test_double': '测试小数',
  'moonlight.configuration.test_category.test_double.description': '双精度数，以文本框编辑',
  'moonlight.configuration.test_category.test_double_slider': '测试小数滑条',
  'moonlight.configuration.test_category.test_double_slider.description': '双精度数，以滑条编辑',
  'moonlight.configuration.test_category.test_percent': '测试百分比',
  'moonlight.configuration.test_category.test_percent.description': '百分比，以显示 % 的滑条编辑',
  'moonlight.configuration.test_category.test_item': '测试物品',
  'moonlight.configuration.test_category.test_item.description': '从注册表选取的物品，带图标',
  'moonlight.configuration.test_category.test_block': '测试方块',
  'moonlight.configuration.test_category.test_block.description': '从注册表选取的方块，带图标',
  'moonlight.configuration.test_range': '测试范围',
  'moonlight.configuration.test_category.test_range': '测试范围',
  'moonlight.configuration.test_vec3': '测试 Vec3',
  'moonlight.configuration.test_category.test_vec3': '测试 Vec3',
  'moonlight.configuration.test_vec3i': '测试 Vec3i',
  'moonlight.configuration.test_category.test_vec3i': '测试 Vec3i',
  'moonlight.configuration.test_category.test_enum': '测试枚举',
  'moonlight.configuration.test_category.test_enum.description': '枚举，以循环按钮编辑',
  'moonlight.configuration.test_category.test_dropdown': '测试下拉框',
  'moonlight.configuration.test_category.test_dropdown.description': '从下拉列表选取的值',
  'moonlight.configuration.test_category.test_string': '测试字符串',
  'moonlight.configuration.test_category.test_string.description': '字符串输入框',
  'moonlight.configuration.test_category.test_regex': '测试正则',
  'moonlight.configuration.test_category.test_regex.description': '带实时语法高亮的正则表达式',
  'moonlight.configuration.test_category.test_color': '测试颜色',
  'moonlight.configuration.test_category.test_color.description': 'ARGB 颜色，以十六进制输入框编辑',
  'moonlight.configuration.test_category.test_color_no_alpha': '测试无透明度颜色',
  'moonlight.configuration.test_category.test_color_no_alpha.description': '不含透明通道的 RGB 颜色',
  'moonlight.configuration.test_category.test_after_comment': '测试注释后定义',
  'moonlight.configuration.test_category.test_after_comment.description': '此注释在其 define 调用之后声明',
  'moonlight.configuration.test_category.test_list': '测试列表',
  'moonlight.configuration.test_category.test_list.description': '自由文本字符串列表，在子页面中编辑',
  'moonlight.configuration.test_category.test_dropdown_list': '测试下拉列表',
  'moonlight.configuration.test_category.test_dropdown_list.description': '每个条目都从下拉列表选取的字符串列表',
  'moonlight.configuration.test_category.test_item_list': '测试物品列表',
  'moonlight.configuration.test_category.test_item_list.description': '物品列表，每个条目从带图标的物品下拉框选取',
  'moonlight.configuration.test_category.test_json': '测试 JSON',
  'moonlight.configuration.test_category.test_json.description': '原始 JSON 值，在带语法高亮的文本框中编辑',
  'moonlight.configuration.test_bean': '测试 Bean',
  'moonlight.configuration.test_bean.name': '名称',
  'moonlight.configuration.test_bean.count': '数量',
  'moonlight.configuration.test_bean.flag': '标志',
  'moonlight.configuration.test_record_bean': '测试记录 Bean',
  'moonlight.configuration.test_record_bean.label': '标签',
  'moonlight.configuration.test_record_bean.amount': '数量',
  'moonlight.configuration.test_category.test_schema': '测试 Schema',
  'moonlight.configuration.test_category.test_schema.description': '带声明式 CodecUI schema 的 codec 对象，通过生成的表单编辑：记录与列表变为可导航子页面，ID 和标签获得注册表下拉框，map 回退到 JSON 编辑器',
  'moonlight.configuration.test_category.test_schema_list': '测试 Schema 列表',
  'moonlight.configuration.test_category.test_schema_list.description': 'codec 对象列表：配置自身的页面就是列表，条目直接在其中添加和移除',
  'moonlight.configuration.nested': '嵌套',
  'moonlight.configuration.nested.nested_float': '嵌套浮点数',
  'moonlight.configuration.nested.nested_float.description': '位于嵌套子分类中的浮点值',
  'moonlight.configuration.test_feature': '测试功能',
  'moonlight.configuration.test_feature.feature_speed': '功能速度',
  'moonlight.configuration.test_feature.feature_speed.description': '仅在功能开启时有意义',
  'moonlight.configuration.test_sub_feature': '测试子功能',
  'moonlight.configuration.test_sub_feature.sub_power': '子功率',
  'moonlight.configuration.test_sub_feature.sub_power.description': '父功能关闭时此功能始终读取为 false',
  'moonlight.configuration.general.merge_dynamic_resource_packs': '合并动态资源包',
  'moonlight.configuration.general.merge_dynamic_resource_packs.description': '将所有使用此库的 Mod 的动态资源包合并为单个包',
  'moonlight.configuration.general.lazy_map_upload': '延迟地图上传',
  'moonlight.configuration.general.lazy_map_upload.description': '仅地图标记变化时阻止地图纹理上传到 GPU，可提升性能',
  'moonlight.configuration.general.maps_mipmap': '地图 Mipmap',
  'moonlight.configuration.general.maps_mipmap.description': '使用 mipmap 渲染地图纹理。大幅改善远处以及 Map Atlases 等地图册内的观感。设为 0 则像原版一样不使用 mipmap',
  'moonlight.configuration.general.consistent_entity_renderer_shading': '一致实体渲染着色',
  'moonlight.configuration.general.consistent_entity_renderer_shading.description': '将 Minecraft 实体着色修正为与方块一致（上 1、北 0.8、西 0.6、下 0.5）。这意味着用方块渲染器或实体渲染的模型与烘焙模型的外观一致。关闭 gui 可避免影响 GUI 中渲染的物品，如果你不喜欢那种效果的话。注意与 Figura Mod 存在已知兼容问题，搭配时请保持开启或关闭。',
  'moonlight.configuration.general.debug_renderers': '调试渲染器',
  'moonlight.configuration.general.debug_renderers.description': '启用部分调试渲染器。需要使用 /supp debug 命令使其数据被发送',
  'moonlight.configuration.general.tags_tooltips': '标签提示',
  'moonlight.configuration.general.tags_tooltips.description': '在物品提示框上显示物品与方块标签',
  'moonlight.configuration.config_screen': '配置界面',
  'moonlight.configuration.config_screen.custom_config_screen': '自定义配置界面',
  'moonlight.configuration.config_screen.custom_config_screen.description': '使用 Moonlight 的配置界面。关闭时，配置将打开加载器自带的界面：NeoForge 原生（或 Configured）、Fabric 上的 Cloth Config 或 YACL',
  'moonlight.configuration.config_screen.show_all_mod_configs': '显示所有 Mod 配置',
  'moonlight.configuration.config_screen.show_all_mod_configs.description': '为每个带配置界面的已安装 Mod 显示磁贴，而不只是使用 Moonlight 的 Mod。点击时打开它们自己的界面',
  'moonlight.configuration.config_screen.convert_foreign_configs': '转换外部配置',
  'moonlight.configuration.config_screen.convert_foreign_configs.description': '在 Moonlight 界面中绘制其他 Mod 的配置而非它们自己的（仅 NeoForge）。GENERIC_ONLY 仅覆盖从未编写界面的 Mod，ALWAYS 覆盖所有 Mod。每世界服务器配置仅在世界打开时显示。尽力而为：无法显示的选项保持原样',
  'moonlight.configuration.config_screen.config_item_carousel': '配置物品轮播',
  'moonlight.configuration.config_screen.config_item_carousel.description': '在 Mod 的配置界面上显示缓慢平移的物品横条',
  'moonlight.configuration.config_screen.favourite_mods': '收藏的 Mod',
  'moonlight.configuration.config_screen.favourite_mods.description': '置顶显示在 Mod 界面的 Mod。点击 Mod 磁贴上的星星可添加或移除',
  'moonlight.configuration.config_screen.mod_list_descending': 'Mod 列表降序',
  'moonlight.configuration.config_screen.mod_list_descending.description': '将 Mod 界面按 Z 到 A 排序',
  'moonlight.configuration.test_date': '测试日期',
  'moonlight.configuration.test_date.month': '月',
  'moonlight.configuration.test_date.day': '日',
  'moonlight.configuration.test_category.test_date': '测试日期',
  'moonlight.configuration.test_time': '测试时间',
  'moonlight.configuration.test_time.hour': '时',
  'moonlight.configuration.test_time.minute': '分',
  'moonlight.configuration.test_category.test_time': '测试时间',
  'moonlight.configuration.test_category.test_schema_advanced': '测试高级 Schema',
  'moonlight.configuration.test_category.test_schema_advanced.description': 'schema 表单：long、十六进制颜色、pattern、可选项、有界列表、pair、dispatch、either、分发 map、递归、raw',
  'moonlight.configuration.test_category.test_schema_map': '测试 Schema Map',
  'moonlight.configuration.test_category.test_schema_map.description': 'schema map',
};

const JEI_KEY_ZH = {
  'jei.config.client.ingredientList.toastReflowEnabled': '让物品列表避开通知弹窗',
  'jei.config.client.ingredientList.toastReflowEnabled.description': '通知弹窗出现时移动右上角物品列表，避免被遮挡。',
  'jei.config.client.ingredientList.toastReflowEnabled.value.true.description': '通知出现时移动物品列表。',
  'jei.config.client.ingredientList.toastReflowEnabled.value.false.description': '物品列表保持原位。',
  'key.jei.toggleOverlay.description': '显示或隐藏物品与书签覆盖层。',
  'key.jei.toggleOverlay.context': 'GUI 打开时',
  'key.jei.focusSearch.description': '将键盘焦点移到 JEI 搜索框。',
  'key.jei.focusSearch.context': 'GUI 打开时',
  'key.jei.previousPage.description': '翻到 JEI 覆盖层列表的上一页。',
  'key.jei.previousPage.context': 'GUI 打开时',
  'key.jei.nextPage.description': '翻到 JEI 覆盖层列表的下一页。',
  'key.jei.nextPage.context': 'GUI 打开时',
  'key.jei.toggleBookmarkOverlay.description': '显示或隐藏已书签物品覆盖层。',
  'key.jei.toggleBookmarkOverlay.context': 'GUI 打开时',
  'key.jei.recipeBack.description': '返回上一次配方查询。',
  'key.jei.recipeBack.context': 'GUI 打开时',
  'key.jei.recipeForward': '下一个配方',
  'key.jei.recipeForward.description': '前进到下一次配方查询。',
  'key.jei.recipeForward.context': 'GUI 打开时',
  'key.jei.previousCategory.description': '切换到上一个配方分类。',
  'key.jei.previousCategory.context': 'GUI 打开时',
  'key.jei.nextCategory.description': '切换到下一个配方分类。',
  'key.jei.nextCategory.context': 'GUI 打开时',
  'key.jei.previousRecipePage.description': '显示当前分类的上一页配方。',
  'key.jei.previousRecipePage.context': 'GUI 打开时',
  'key.jei.nextRecipePage.description': '显示当前分类的下一页配方。',
  'key.jei.nextRecipePage.context': 'GUI 打开时',
  'key.jei.closeRecipeGui.description': '关闭配方界面并返回上一个界面。',
  'key.jei.closeRecipeGui.context': 'GUI 打开时',
  'key.jei.toggleCheatMode.description': '开关作弊模式。',
  'key.jei.toggleCheatMode.context': 'GUI 打开时',
  'key.jei.cheatOneItem.description': '给予一个该物品。',
  'key.jei.cheatOneItem.context': '悬停在物品上且作弊模式可用时',
  'key.jei.cheatOneItem2.description': '给予一个该物品。',
  'key.jei.cheatOneItem2.context': '悬停在物品上且作弊模式可用时',
  'key.jei.cheatItemStack.description': '给予一整组该物品。',
  'key.jei.cheatItemStack.context': '悬停在物品上且作弊模式可用时',
  'key.jei.cheatItemStack2.description': '给予一整组该物品。',
  'key.jei.cheatItemStack2.context': '悬停在物品上且作弊模式可用时',
  'key.jei.toggleCheatModeConfigButton.description': '开关作弊模式。',
  'key.jei.toggleCheatModeConfigButton.context': '悬停在 JEI 配置按钮上时',
  'key.jei.toggleEditMode.description': '开关隐藏物品模式。',
  'key.jei.toggleEditMode.context': 'GUI 打开时',
  'key.jei.toggleHideIngredient.description': '隐藏或取消隐藏该物品。',
  'key.jei.toggleHideIngredient.context': '悬停在物品上时',
  'key.jei.toggleWildcardHideIngredient.description': '隐藏或取消隐藏该物品的匹配变体。',
  'key.jei.toggleWildcardHideIngredient.context': '悬停在物品上时',
  'key.jei.bookmark.description': '为悬停的物品添加或移除书签。',
  'key.jei.bookmark.context': '鼠标悬停在 JEI 上时',
  'key.jei.showRecipe.description': '显示可制作悬停物品的配方。',
  'key.jei.showRecipe.context': '鼠标悬停在 JEI 上时',
  'key.jei.showRecipe2.description': '显示可制作悬停物品的配方。',
  'key.jei.showRecipe2.context': '鼠标悬停在 JEI 上时',
  'key.jei.showUses.description': '显示使用该物品的配方。',
  'key.jei.showUses.context': '鼠标悬停在 JEI 上时',
  'key.jei.showUses2.description': '显示使用该物品的配方。',
  'key.jei.showUses2.context': '鼠标悬停在 JEI 上时',
  'key.jei.transferRecipeBookmark.description': '配方转移可用时，从该书签转移一份配方。',
  'key.jei.transferRecipeBookmark.context': '悬停在 JEI 书签上时',
  'key.jei.maxTransferRecipeBookmark.description': '尽可能多地从该书签转移配方。',
  'key.jei.maxTransferRecipeBookmark.context': '悬停在 JEI 书签上时',
  'key.jei.quickMove.description': '支持时将悬停的幽灵物品移入聚焦槽位。',
  'key.jei.quickMove.context': '鼠标悬停在 JEI 上时',
  'key.jei.clearSearchBar.description': '清空搜索文本。',
  'key.jei.clearSearchBar.context': '悬停在 JEI 搜索框上时',
  'key.jei.previousSearch.description': '恢复上一次搜索文本。',
  'key.jei.previousSearch.context': 'JEI 搜索框聚焦时',
  'key.jei.nextSearch.description': '在搜索历史回退后恢复下一次搜索文本。',
  'key.jei.nextSearch.context': 'JEI 搜索框聚焦时',
  'key.jei.copy.recipe.id.description': '复制当前配方 ID 到剪贴板。',
  'key.jei.copy.recipe.id.context': 'GUI 打开时',
  'jei.config.client.ingredientList.overlaysEnabled': '显示 JEI 覆盖层',
  'jei.config.client.ingredientList.overlaysEnabled.description': '为当前会话显示或隐藏物品与书签覆盖层。此值不会保存到配置文件。',
  'jei.config.client.ingredientList.overlaysEnabled.value.true.description': '显示 JEI 的物品与书签覆盖层。',
  'jei.config.client.ingredientList.overlaysEnabled.value.false.description': '隐藏 JEI 的物品与书签覆盖层。',
  'jei.config.client.lookups.lookupFluidContentsEnabled': '查询流体内容物',
  'jei.config.client.lookups.lookupFluidContentsEnabled.description': '查询配方时包含流体容器的内容物。',
  'jei.config.client.lookups.lookupFluidContentsEnabled.value.true.description': '查询配方时包含流体容器的内容物。',
  'jei.config.client.lookups.lookupFluidContentsEnabled.value.false.description': '查询配方时忽略流体容器的内容物。',
  'jei.config.client.lookups.lookupBlockTagsEnabled': '查询方块标签',
  'jei.config.client.lookups.lookupBlockTagsEnabled.description': '查询方块物品时包含使用匹配方块标签的配方。',
  'jei.config.client.lookups.lookupBlockTagsEnabled.value.true.description': '包含使用匹配方块标签的配方。',
  'jei.config.client.lookups.lookupBlockTagsEnabled.value.false.description': '查询方块物品时仅使用物品标签。',
  'jei.config.client.lookups.enabled': '显示查询历史',
  'jei.config.client.lookups.enabled.description': '显示最近用于配方与用途查询的物品列表。',
  'jei.config.client.lookups.enabled.value.true.description': '显示最近的配方与用途查询。',
  'jei.config.client.lookups.enabled.value.false.description': '隐藏最近的配方与用途查询。',
  'jei.config.client.lookups.maxRows': '查询历史最大行数',
  'jei.config.client.lookups.maxRows.description': '限制屏幕上显示的最近查询行数。',
  'jei.config.client.lookups.maxIngredients': '查询历史最大物品数',
  'jei.config.client.lookups.maxIngredients.description': '限制 JEI 记住的最近查询物品数量。',
  'jei.config.client.lookups.displaySide': '查询历史位置',
  'jei.config.client.lookups.displaySide.description': '选择显示最近查询的屏幕一侧。',
  'jei.config.client.lookups.displaySide.left.description': '在屏幕左侧显示查询历史。',
  'jei.config.client.lookups.displaySide.right.description': '在屏幕右侧显示查询历史。',
  'jei.config.client.advanced.lowMemorySlowSearchEnabled': '低内存搜索',
  'jei.config.client.advanced.lowMemorySlowSearchEnabled.description': '降低物品搜索的内存占用，但搜索会更慢。',
  'jei.config.client.advanced.lowMemorySlowSearchEnabled.value.true.description': '使用更少内存，搜索更慢。',
  'jei.config.client.advanced.lowMemorySlowSearchEnabled.value.false.description': '使用正常搜索速度与内存。',
  'jei.config.client.advanced.catchRenderErrorsEnabled.value.true.description': '显示错误占位符而不是崩溃。',
  'jei.config.client.advanced.catchRenderErrorsEnabled.value.false.description': '让物品绘制错误使游戏崩溃。',
  'jei.config.client.advanced.recipeSyncWarningEnabled': '配方同步警告',
  'jei.config.client.advanced.recipeSyncWarningEnabled.description': '当服务器不向 JEI 提供同步配方时（如原版服务器或未安装 JEI 的服务器）显示聊天警告。',
  'jei.config.client.ingredientSorting': '物品列表排序',
  'jei.config.client.ingredientSorting.description': 'JEI 物品列表中物品排序方式的选项。',
  'jei.config.client.ingredientList.ingredientSortStages': '物品列表排序顺序',
  'jei.config.client.ingredientList.ingredientSortStages.description': '选择 JEI 排序物品列表所用的规则顺序。将物品类型放在首位可全局分组物品、流体与自定义物品类型。',
  'jei.config.client.ingredientList.ingredientSortStages.mod_name.description': '同一 Mod 的物品排在一起。',
  'jei.config.client.ingredientList.ingredientSortStages.ingredient_type.description': '物品、流体和其他物品类型分开排列。',
  'jei.config.client.ingredientList.ingredientSortStages.alphabetical.description': '按名称字母排序。',
  'jei.config.client.ingredientList.ingredientSortStages.creative_menu': '创造物品栏',
  'jei.config.client.ingredientList.ingredientSortStages.creative_menu.description': '按创造物品栏中的顺序排序。',
  'jei.config.client.ingredientList.ingredientSortStages.tag.description': '具有相同标签的物品排在一起。',
  'jei.config.client.ingredientList.ingredientSortStages.armor.description': '按护甲槽位与保护力排序护甲。',
  'jei.config.client.ingredientList.ingredientSortStages.max_durability.description': '最大耐久更高的物品排在前面。',
  'jei.config.client.recipes.recipeSortingBookmarks': '书签配方优先',
  'jei.config.client.recipes.recipeSortingBookmarks.description': '已书签物品的配方显示在其他配方之前。',
  'jei.config.client.recipes.recipeSortingBookmarks.value.true.description': '书签配方排在前面。',
  'jei.config.client.recipes.recipeSortingBookmarks.value.false.description': '书签配方保持正常顺序。',
  'jei.config.client.recipes.recipeSortingCraftable': '可合成配方优先',
  'jei.config.client.recipes.recipeSortingCraftable.description': '材料齐备的配方显示在缺少材料的配方之前。',
  'jei.config.client.recipes.recipeSortingCraftable.value.true.description': '可合成配方排在前面。',
  'jei.config.client.recipes.recipeSortingCraftable.value.false.description': '可合成配方保持正常顺序。',
  'jei.config.client.recipeCategorySorting': '配方分类排序',
  'jei.config.client.recipeCategorySorting.description': 'JEI 配方分类标签页的排序方式。',
  'jei.config.client.sorting.recipeCategorySortOrder': '配方分类排序顺序',
  'jei.config.client.sorting.recipeCategorySortOrder.description': '选择 JEI 排列配方分类的顺序。',
  'jei.config.client.sorting.recipeCategorySortOrder.value': '%s：%s',
  'jei.config.client.sorting.recipeCategorySortOrder.value.description': '配方分类 ID：%s',
  'jei.config.client.sorting.ingredientModNameSortOrder': '物品 Mod 排序顺序',
  'jei.config.client.sorting.ingredientModNameSortOrder.description': '选择 JEI 排列物品 Mod 名称的顺序。',
  'jei.config.client.sorting.ingredientModNameSortOrder.value.description': '来自 %s 的物品。',
  'jei.config.client.sorting.ingredientTypeSortOrder': '物品类型排序顺序',
  'jei.config.client.sorting.ingredientTypeSortOrder.description': '选择 JEI 排列物品类型的顺序。',
  'jei.config.client.sorting.ingredientTypeSortOrder.value': '%s：%s',
  'jei.config.client.sorting.ingredientTypeSortOrder.value.description': '物品类型类：%s',
  'jei.config.client.search.modNameSearchMode.enabled.description': '从普通搜索文本匹配 Mod 名称。',
  'jei.config.client.search.modNameSearchMode.require_prefix.description': '仅在输入 @ 前缀时匹配 Mod 名称，如 @minecraft。',
  'jei.config.client.search.modNameSearchMode.disabled.description': '不搜索 Mod 名称。',
  'jei.config.client.search.tagSearchMode.enabled.description': '从普通搜索文本匹配物品标签。',
  'jei.config.client.search.tagSearchMode.require_prefix.description': '仅在输入 # 前缀时匹配物品标签，如 #forge。',
  'jei.config.client.search.tagSearchMode.disabled.description': '不搜索物品标签。',
  'jei.config.client.search.tooltipSearchMode.enabled.description': '从普通搜索文本匹配提示框文本。',
  'jei.config.client.search.tooltipSearchMode.require_prefix.description': '仅在输入 $ 前缀时匹配提示框文本，如 $damage。',
  'jei.config.client.search.tooltipSearchMode.disabled.description': '不搜索物品提示框。',
  'jei.config.client.search.colorSearchMode.enabled.description': '从普通搜索文本匹配颜色名称。',
  'jei.config.client.search.colorSearchMode.require_prefix.description': '仅在输入 ^ 前缀时匹配颜色名称，如 ^red。',
  'jei.config.client.search.colorSearchMode.disabled.description': '不按颜色名称搜索物品。',
  'jei.config.client.search.resourceLocationSearchMode.enabled.description': '从普通搜索文本匹配物品 ID。',
  'jei.config.client.search.resourceLocationSearchMode.require_prefix.description': '仅在输入 & 前缀时匹配物品 ID，如 &minecraft:stone。',
  'jei.config.client.search.resourceLocationSearchMode.disabled.description': '不搜索物品 ID。',
  'jei.config.client.search.creativeTabSearchMode.enabled.description': '从普通搜索文本匹配创造标签页名称。',
  'jei.config.client.search.creativeTabSearchMode.require_prefix.description': '仅在输入 % 前缀时匹配创造标签页名称，如 %building。',
  'jei.config.client.search.creativeTabSearchMode.disabled.description': '不搜索创造标签页名称。',
  'jei.config.client.search.searchAdvancedTooltips.value.true.description': '包含高级提示框文本。',
  'jei.config.client.search.searchAdvancedTooltips.value.false.description': '忽略高级提示框文本。',
  'jei.config.client.search.searchModIds.value.true.description': '包含 Mod ID。',
  'jei.config.client.search.searchModIds.value.false.description': '忽略 Mod ID。',
  'jei.config.client.search.searchModAliases.value.true.description': '包含额外 Mod 名称。',
  'jei.config.client.search.searchModAliases.value.false.description': '忽略额外 Mod 名称。',
  'jei.config.client.search.searchShortModNames.value.true.description': '包含 Mod 名称缩写。',
  'jei.config.client.search.searchShortModNames.value.false.description': '忽略 Mod 名称缩写。',
  'jei.config.client.search.searchIngredientAliases.value.true.description': '包含额外物品名称。',
  'jei.config.client.search.searchIngredientAliases.value.false.description': '忽略额外物品名称。',
  'jei.config.client.lists': '列表',
  'jei.config.client.lists.description': '物品列表与书签列表共享的选项。',
  'jei.config.client.lists.drawBackground': '显示背景',
  'jei.config.client.lists.drawBackground.description': '在物品与书签列表后显示背景。',
  'jei.config.client.lists.drawBackground.value.true.description': '在两个列表后绘制背景。',
  'jei.config.client.lists.drawBackground.value.false.description': '隐藏两个列表的背景。',
  'jei.config.client.lists.navigationMode': '导航模式',
  'jei.config.client.lists.navigationMode.description': '选择在物品与书签列表中移动的方式。',
  'jei.config.client.lists.navigationMode.paged.description': '使用翻页按钮在两个列表中移动。',
  'jei.config.client.lists.navigationMode.scrolling.description': '使用每次移动一行的滚动条。',
  'jei.config.client.lists.navigationMode.smooth_scrolling.description': '使用平滑移动的滚动条。',
  'jei.config.client.lists.navigationVisibility': '列表导航',
  'jei.config.client.lists.navigationVisibility.description': '选择何时为两个列表显示导航控件。',
  'jei.config.client.lists.navigationVisibility.enabled': '总是显示',
  'jei.config.client.lists.navigationVisibility.enabled.description': '总是显示导航控件。',
  'jei.config.client.lists.navigationVisibility.auto_hide': '自动隐藏',
  'jei.config.client.lists.navigationVisibility.auto_hide.description': '仅在列表溢出时显示导航控件。',
  'jei.config.client.lists.navigationVisibility.disabled': '隐藏',
  'jei.config.client.lists.navigationVisibility.disabled.description': '隐藏导航控件。',
  'jei.config.client.ingredientList.alignment': '物品列表对齐',
  'jei.config.client.ingredientList.alignment.description': '周围有多余空间时选择物品列表停靠的位置。',
  'jei.config.client.ingredientList.layoutMode.rectangular.description': '保持导航对齐到矩形网格，同时允许挖去排除的槽位。',
  'jei.config.client.ingredientList.layoutMode.maximize_available_space.description': '围绕排除区域调整导航的大小和位置以利用更多空间。',
  'jei.config.client.bookmarkList.alignment': '书签列表对齐',
  'jei.config.client.bookmarkList.alignment.description': '周围有多余空间时选择书签列表停靠的位置。',
  'jei.config.client.bookmarkList.layoutMode.rectangular.description': '保持导航对齐到矩形网格，同时允许挖去排除的槽位。',
  'jei.config.client.bookmarkList.layoutMode.maximize_available_space.description': '围绕排除区域调整导航的大小和位置以利用更多空间。',
  'jei.config.value.Alignment.TOP_LEFT.name': '左上',
  'jei.config.value.Alignment.TOP_CENTER.name': '顶部居中',
  'jei.config.value.Alignment.TOP_RIGHT.name': '右上',
  'jei.config.value.Alignment.CENTER_LEFT.name': '左中',
  'jei.config.value.Alignment.CENTER.name': '居中',
  'jei.config.value.Alignment.CENTER_RIGHT.name': '右中',
  'jei.config.value.Alignment.BOTTOM_LEFT.name': '左下',
  'jei.config.value.Alignment.BOTTOM_CENTER.name': '底部居中',
  'jei.config.value.Alignment.BOTTOM_RIGHT.name': '右下',
  'jei.config.debug.debug.debugIngredientsEnabled.value.true.description': '记录 JEI 物品更新。',
  'jei.config.debug.debug.debugIngredientsEnabled.value.false.description': '不记录 JEI 物品更新。',
  'jei.config.debug.debug.debugGuis.value.true.description': '显示额外的 GUI 调试工具。',
  'jei.config.debug.debug.debugGuis.value.false.description': '隐藏额外的 GUI 调试工具。',
  'jei.config.debug.debug.debugInputs.value.true.description': '显示额外的输入调试工具。',
  'jei.config.debug.debug.debugInputs.value.false.description': '隐藏额外的输入调试工具。',
  'jei.config.debug.debug.debugInfoTooltipsEnabled.value.true.description': '在高级物品提示框中添加调试信息。',
  'jei.config.debug.debug.debugInfoTooltipsEnabled.value.false.description': '不在高级物品提示框中添加调试信息。',
  'jei.config.debug.debug.logSuffixTreeStats.value.true.description': '将搜索性能信息写入日志。',
  'jei.config.debug.debug.logSuffixTreeStats.value.false.description': '不将搜索性能信息写入日志。',
  'jei.config.client.bookmarkList.bookmarkOverlayEnabled': '显示书签覆盖层',
  'jei.config.client.bookmarkList.bookmarkOverlayEnabled.description': '当 JEI 覆盖层启用时，为当前会话显示或隐藏书签覆盖层。此值不会保存到配置文件。',
  'jei.config.client.bookmarkList.bookmarkOverlayEnabled.value.true.description': 'JEI 覆盖层启用时显示已书签物品。',
  'jei.config.client.bookmarkList.bookmarkOverlayEnabled.value.false.description': '隐藏书签覆盖层。',
  'jei.config.client.cheating.cheatModeEnabled': '启用作弊模式',
  'jei.config.client.cheating.cheatModeEnabled.description': '为当前会话开关作弊模式。此值不会保存到配置文件。服务器必须允许 JEI 作弊。',
  'jei.config.client.cheating.cheatModeEnabled.value.true.description': '启用作弊模式，取决于服务器权限。',
  'jei.config.client.cheating.cheatModeEnabled.value.false.description': '禁用作弊模式。',
  'jei.config.client.advanced.editModeEnabled': '启用隐藏物品模式',
  'jei.config.client.advanced.editModeEnabled.description': '为当前会话开关物品隐藏模式。此值不会保存到配置文件。',
  'jei.config.client.advanced.editModeEnabled.value.true.description': '允许从 JEI 隐藏或取消隐藏物品。',
  'jei.config.client.advanced.editModeEnabled.value.false.description': '正常使用物品，不隐藏或取消隐藏。',
  'jei.configuration.server.enableCheatModeForOp': '允许管理员使用作弊模式',
  'jei.configuration.server.enableCheatModeForOp.tooltip': '允许拥有管理员权限（/op）的玩家使用 JEI 作弊模式。',
  'jei.configuration.server.enableCheatModeForCreative': '允许创造模式使用作弊模式',
  'jei.configuration.server.enableCheatModeForCreative.tooltip': '允许创造模式玩家使用 JEI 作弊模式。',
  'jei.configuration.server.enableCheatModeForGive': '允许有给予权限者使用作弊模式',
  'jei.configuration.server.enableCheatModeForGive.tooltip': '允许可使用 /give 命令的玩家使用 JEI 作弊模式。',
  'jei.config.client.search.centerSearch': 'JEI 搜索框位置',
  'jei.config.client.search.centerSearch.description': '选择 JEI 搜索框出现的位置。',
  'jei.config.client.search.centerSearch.standard': '右下',
  'jei.config.client.search.centerSearch.standard.description': '将搜索框放在右下角。',
  'jei.config.client.search.centerSearch.centered': '底部居中',
  'jei.config.client.search.centerSearch.centered.description': '将搜索框在屏幕底部居中。',
  'jei.config.client.recipes.recipeGuiHeight': '配方界面最大高度',
  'jei.config.client.recipes.recipeGuiHeight.description': '限制配方界面可扩展的高度。',
  'jei.config.client.cheating.giveMode.inventory.description': '将作弊物品直接放入你的背包。',
  'jei.config.client.cheating.giveMode.mouse_pickup.description': '将作弊物品放到光标上，如同从槽位中拿起。',
  'jei.config.client.cheating.cheatToHotbarUsingHotkeysEnabled.value.true.description': '允许将物品作弊到快捷栏槽位。',
  'jei.config.client.cheating.cheatToHotbarUsingHotkeysEnabled.value.false.description': '不将物品直接作弊到快捷栏槽位。',
  'jei.config.client.cheating.showHiddenIngredients.value.true.description': '显示已从创造物品栏隐藏的物品。',
  'jei.config.client.cheating.showHiddenIngredients.value.false.description': '隐藏不在创造物品栏中的物品。',
  'jei.config.client.recipes': '配方',
  'jei.config.client.recipes.description': '配方页面与配方查询行为的选项。',
  'jei.config.client.recipes.showTagRecipesEnabled': '显示标签配方',
  'jei.config.client.recipes.showTagRecipesEnabled.description': '为标签显示配方页面，使接受一组物品的配方可以显示每个匹配的物品。',
  'jei.config.client.recipes.showTagRecipesEnabled.value.true.description': '显示标签的配方页面。',
  'jei.config.client.recipes.showTagRecipesEnabled.value.false.description': '隐藏标签的配方页面。',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled': '新书签位置',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled.description': '选择新添加的书签出现在书签列表的位置。',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled.end': '列表末尾',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled.end.description': '将新书签添加到书签列表末尾。',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled.front': '列表开头',
  'jei.config.client.bookmarkList.addBookmarksToFrontEnabled.front.description': '将新书签添加到书签列表开头。',
  'jei.config.client.bookmarkList.bookmarkOutputAsRecipe': '将产物收藏为配方',
  'jei.config.client.bookmarkList.bookmarkOutputAsRecipe.description': '为 true 时，在配方产物上按书签键会收藏配方而非物品。',
  'jei.config.client.bookmarkList.dragToRearrangeBookmarksEnabled': '拖拽重排书签',
  'jei.config.client.bookmarkList.dragToRearrangeBookmarksEnabled.description': '允许在书签列表中拖拽书签以重新排序。',
  'jei.config.client.bookmarkList.dragToRearrangeBookmarksEnabled.value.true.description': '允许拖拽书签重新排序。',
  'jei.config.client.bookmarkList.dragToRearrangeBookmarksEnabled.value.false.description': '拖拽时保持书签位置不变。',
  'jei.config.client.bookmarkList.bookmarkTooltipPreview': '显示书签配方预览',
  'jei.config.client.bookmarkList.bookmarkTooltipPreview.description': '悬停在配方书签上时显示小型配方预览。',
  'jei.config.client.bookmarkList.bookmarkTooltipPreview.value.true.description': '在配方书签上显示配方预览。',
  'jei.config.client.bookmarkList.bookmarkTooltipPreview.value.false.description': '隐藏配方书签的配方预览。',
  'jei.config.client.bookmarkList.bookmarkTooltipIngredients': '显示书签配方材料',
  'jei.config.client.bookmarkList.bookmarkTooltipIngredients.description': '显示合成配方书签所需的材料。',
  'jei.config.client.bookmarkList.bookmarkTooltipIngredients.value.true.description': '显示配方书签所需材料。',
  'jei.config.client.bookmarkList.bookmarkTooltipIngredients.value.false.description': '隐藏配方书签所需材料。',
  'jei.config.client.bookmarkList.holdShiftToShowBookmarkTooltipFeatures': '书签详情需按键',
  'jei.config.client.bookmarkList.holdShiftToShowBookmarkTooltipFeatures.description': '需要先按住配置的书签详情键，才显示额外书签详情和转移快捷键。',
  'jei.config.client.bookmarkList.holdShiftToShowBookmarkTooltipFeatures.value.true.description': '仅在按住配置的键时显示额外书签详情。',
  'jei.config.client.bookmarkList.holdShiftToShowBookmarkTooltipFeatures.value.false.description': '总是显示额外书签详情。',
  'jei.config.client.tooltips.showCreativeTabNamesEnabled.value.true.description': '在物品提示框中显示创造标签页名称。',
  'jei.config.client.tooltips.showCreativeTabNamesEnabled.value.false.description': '在物品提示框中隐藏创造标签页名称。',
  'jei.config.client.tooltips.tagContentTooltipEnabled.value.true.description': '显示配方标签的匹配物品。',
  'jei.config.client.tooltips.tagContentTooltipEnabled.value.false.description': '隐藏配方标签的匹配物品。',
  'jei.config.client.tooltips.hideSingleTagContentTooltipEnabled.value.true.description': '仅一个匹配物品时隐藏标签内容。',
  'jei.config.client.tooltips.hideSingleTagContentTooltipEnabled.value.false.description': '即使只有一个匹配物品也显示标签内容。',
  'jei.config.client.recipes.enableRecipesGuiIngredientsSummary': '在提示框中显示配方材料摘要',
  'jei.config.client.recipes.enableRecipesGuiIngredientsSummary.description': '悬停在配方产物上时显示该配方所需材料的快速摘要。',
  'jei.config.client.recipes.enableRecipesGuiIngredientsSummary.value.true.description': '在配方产物上显示材料摘要。',
  'jei.config.client.recipes.enableRecipesGuiIngredientsSummary.value.false.description': '隐藏配方产物上的材料摘要。',
  'jei.message.mezzConfigGui': '安装 "MezzConfig GUI" Mod 以使用游戏内配置',
  'jei.key.modifier.shift': 'SHIFT',
  'jei.key.modifier.control': 'CTRL',
  'jei.key.modifier.command': 'CMD',
  'jei.key.modifier.alt': 'ALT',
};

const XAERO_WM_KEY_ZH = {
  'gui.xaero_pac_interrupt_claiming': '中断认领操作',
  'gui.xaero_pac_requested_large_claim': '已开始认领大片区域……使用右键选项 %1$s 取消。',
  'gui.xaero_pac_requested_large_unclaim': '已开始取消认领大片区域……使用右键选项 %1$s 取消。',
  'gui.xaero_pac_requested_large_forceload': '已开始为大片区域标记强制加载……使用右键选项 %1$s 取消。',
  'gui.xaero_pac_requested_large_unforceload': '已开始取消大片区域的强制加载标记……使用右键选项 %1$s 取消。',
  'gui.xaero_wm_max_loaded_regions': '最大已加载区域数',
  'gui.xaero_wm_box_max_loaded_regions': '保持加载的 512x512 地图区域的大致上限，包括以更低（更远）缩放级别渲染的"分支"区域。其他因素可能增减实际生效的上限。更高的数值提升性能但占用更多内存与显存，可能耗尽。',
  'gui.xaero_wm_unlimited_zoom_in': '无限制全屏放大',
  'gui.xaero_wm_box_unlimited_zoom_in': '并非真正无限制，但允许将全屏地图放大到远超通常上限的程度。',
  'gui.xaero_wm_unlimited_zoom_out': '无限制全屏缩小',
  'gui.xaero_wm_box_unlimited_zoom_out': '实验性功能！\n并非真正无限制，但允许将全屏地图缩小到远超通常上限的程度。未针对常规游玩优化，只应在你不在意时使用。',
  'gui.xaero_box_rendering_waypoints_server_enforced': '世界地图路径点渲染设置由服务器强制！',
  'gui.xaero_wm_skip_world_render': '跳过世界渲染',
  'gui.xaero_wm_box_skip_world_render': '世界地图界面打开时跳过背景中的世界渲染，可显著提高帧率。但启用后帧率也会被手动限制在 625 左右，以避免超高帧率带来的问题（如录像或直播时）。某些 Mod 可能与此功能不兼容，关闭它可修复问题，但代价是（通常）更低的帧率。',
  'gui.xaero_wm_ignore_map_file_locks': '忽略地图文件锁',
  'gui.xaero_wm_box_ignore_map_file_locks': '即使地图实例已被另一进程使用也继续使用。这会导致区域加载失败。除非你清楚自己在做什么，否则不要使用。启用后请重新登录。',
  'gui.xaero_hop_button': '跳转到指定坐标',
  'gui.xaero_hop_field': '以空格分隔的 X 和 Z 坐标',
  'gui.xaero_hop_field_tooltip': '输入以空格分隔的 X 和 Z 坐标后按回车',
  'gui.xaero_hop_error_not_numbers': '两个输入坐标都必须是数字！',
  'gui.xaero_hop_error_too_many': '参数过多！',
  'gui.xaero_hop_error_source': '跳转到坐标',
  'gui.xaero_attached_camera_button_enabled': '相机已跟随你的角色',
  'gui.xaero_attached_camera_button_disabled': '相机未跟随你的角色',
  'gui.xaero_wm_display_server_chunk_radius': '显示服务器区块半径',
  'gui.xaero_wm_box_display_server_chunk_radius': '在世界地图上以你的角色为中心显示与服务器区块半径（服务器渲染距离）对应的方形范围。',
  'gui.xaero_wm_force_fast_map_writing': '强制快速写入',
  'gui.xaero_wm_box_force_fast_map_writing': '不利于性能，但适合在服务器上高速移动时绘制地图。',
  'gui.xaero_map_distances': '显示地图距离',
  'gui.xaero_box_map_distances': '显示到你在地图上右键点击的位置或元素的距离。位置显示二维距离；路径点、被追踪玩家等元素在适用时显示三维距离。',
  'gui.xaero_auto_convert_wm_distances_km': '地图距离换算为千米的阈值',
  'gui.xaero_auto_convert_wm_distances_km_never': '从不',
  'gui.xaero_wm_distance_precision': '地图距离精度',
};

for (const [ns, gen] of [
  ['progressivestages', genProgressiveStages],
  ['framedblocks', genFramedblocks],
  ['mcwfurnitures', genMcwFurniture],
  ['refurbished_furniture', genRefurbished],
  ['energizedfurniture', genEnergized],
  ['tmted', genTmted],
  ['immersivecooking', genImmersiveCooking],
  ['taczturrets', genTaczTurrets],
  ['creaturefeature', genCreatureFeature],
  ['vinery', genVinery],
  ['buildcraft', genBuildCraft],
  // Bundled zh_cn missing keys / absent — see audit-lang.mjs report.
  // hordes ships a second lang pair under config_defaults/ (infection attributes etc.)
  ['hordes', () => genOverlay(/^The-Hordes-.*\.jar$/i, 'hordes', HORDES_KEY_ZH,
    ['assets/hordes/lang/en_us.json', 'config_defaults/assets/hordes/lang/en_us.json'])],
  ['guideme', () => genOverlay(/^guideme-.*\.jar$/i, 'guideme', GUIDEME_KEY_ZH)],
  ['blueprint', () => genOverlay(/^blueprint-.*\.jar$/i, 'blueprint', BLUEPRINT_KEY_ZH)],
  ['curios', () => genOverlay(/^curios-.*\.jar$/i, 'curios', CURIOS_KEY_ZH)],
  ['immersiveengineering', () => genOverlay(/^ImmersiveEngineering-.*\.jar$/i, 'immersiveengineering', IE_KEY_ZH)],
  ['cloth-config2', () => genOverlay(/^cloth-config-.*\.jar$/i, 'cloth-config2', CLOTH_KEY_ZH)],
  ['pv_asteroid_belt', () => genOverlay(/^Ad Astra Asteroid Belt.*\.jar$/i, 'pv_asteroid_belt', ASTEROID_BELT_KEY_ZH)],
  ['common_storage_lib', () => genOverlay(/^common-storage-lib-.*\.jar$/i, 'common_storage_lib', CSL_KEY_ZH)],
  ['chat_heads', () => genOverlay(/^chat_heads-.*\.jar$/i, 'chat_heads', CHAT_HEADS_KEY_ZH)],
  ['shulkerboxtooltip', () => genOverlay(/^shulkerboxtooltip-.*\.jar$/i, 'shulkerboxtooltip', SBT_KEY_ZH)],
  ['mutantmonsters', () => genOverlay(/^MutantMonsters-.*\.jar$/i, 'mutantmonsters', MM_KEY_ZH)],
  ['farmersdelight', () => genOverlay(/^FarmersDelight-.*\.jar$/i, 'farmersdelight', FD_KEY_ZH)],
  ['supplementaries', () => genOverlay(/^supplementaries-.*\.jar$/i, 'supplementaries', SUPP_KEY_ZH)],
  ['ae2', () => genOverlay(/^appliedenergistics2-.*\.jar$/i, 'ae2', AE2_KEY_ZH)],
  ['endermanoverhaul', () => genOverlay(/^endermanoverhaul-.*\.jar$/i, 'endermanoverhaul', EO_KEY_ZH)],
  ['betteradvancedtooltips', () => genOverlay(/^better-advanced-tooltips-.*\.jar$/i, 'betteradvancedtooltips', BAT_KEY_ZH)],
  ['defaultoptions', () => genOverlay(/^defaultoptions-.*\.jar$/i, 'defaultoptions', DO_KEY_ZH)],
  ['iris', () => genOverlay(/^iris-.*\.jar$/i, 'iris', IRIS_KEY_ZH)],
  ['emi', () => genOverlay(/^emi-.*\.jar$/i, 'emi', EMI_KEY_ZH)],
  ['structure_layout_optimizer', () => genOverlay(/^structure_layout_optimizer-.*\.jar$/i, 'structure_layout_optimizer', SLO_KEY_ZH)],
  ['dynamic_fps', () => genOverlay(/^dynamic-fps-.*\.jar$/i, 'dynamic_fps', DFPS_KEY_ZH)],
  ['immersivepetroleum', () => genOverlay(/^ImmersivePetroleum-.*\.jar$/i, 'immersivepetroleum', IP_KEY_ZH)],
  ['ad_astra', () => genOverlay(/^adastra-.*\.jar$/i, 'ad_astra', AD_ASTRA_KEY_ZH)],
  ['ad_astra_giselle_addon', () => genOverlay(/^Ad-Astra-Giselle-Addon-.*\.jar$/i, 'ad_astra_giselle_addon', GISELLE_KEY_ZH)],
  ['arachnids', () => genOverlay(/^arachnids-.*\.jar$/i, 'arachnids', ARACHNIDS_KEY_ZH)],
  ['guardvillagers', () => genOverlay(/^guardvillagers-.*\.jar$/i, 'guardvillagers', GV_KEY_ZH)],
  ['guardvillagerstaczsupport', () => genOverlay(/^guardvillagerstaczsupport-.*\.jar$/i, 'guardvillagerstaczsupport', GVTS_KEY_ZH)],
  ['artifacts', () => genOverlay(/^artifacts-.*\.jar$/i, 'artifacts', ARTIFACTS_KEY_ZH)],
  ['mezz_config', () => genOverlay(/^mezz_config-.*\.jar$/i, 'mezz_config', MEZZ_KEY_ZH)],
  ['craftingtweaks', () => genOverlay(/^craftingtweaks-.*\.jar$/i, 'craftingtweaks', CT_KEY_ZH)],
  ['jadeaddons', () => genOverlay(/^JadeAddons-.*\.jar$/i, 'jadeaddons', JA_KEY_ZH)],
  ['inventoryprofilesnext', () => genOverlay(/^InventoryProfilesNext-.*\.jar$/i, 'inventoryprofilesnext', IPN_KEY_ZH)],
  ['modernfix', () => genOverlay(/^modernfix-.*\.jar$/i, 'modernfix', MODERNFIX_KEY_ZH)],
  ['ftbteams', () => genOverlay(/^ftb-teams-.*\.jar$/i, 'ftbteams', FTBTEAMS_KEY_ZH)],
  ['resourcefulconfig', () => genOverlay(/^resourcefulconfig-.*\.jar$/i, 'resourcefulconfig', RCFG_KEY_ZH)],
  ['balm', () => genOverlay(/^balm-.*\.jar$/i, 'balm', BALM_KEY_ZH)],
  ['xaerominimap', () => genOverlay(/^xaerominimap-.*\.jar$/i, 'xaerominimap', XAERO_MM_KEY_ZH)],
  ['xaerobetterpvp', () => genOverlay(/^xaerominimap-.*\.jar$/i, 'xaerobetterpvp', XAERO_BPVP_KEY_ZH)],
  ['xaeroworldmap', () => genOverlay(/^xaeroworldmap-.*\.jar$/i, 'xaeroworldmap', XAERO_WM_KEY_ZH)],
  ['ftbquests', () => genOverlay(/^ftb-quests-.*\.jar$/i, 'ftbquests', FTBQ_KEY_ZH)],
  ['moonlight', () => genOverlay(/^moonlight-.*\.jar$/i, 'moonlight', MOONLIGHT_KEY_ZH)],
  // mods/ also carries a stray older jei jar — pin the locked one.
  ['jei', () => genOverlay(/^jei-1\.21\.1-neoforge-19\.57\.0\.447\.jar$/i, 'jei', JEI_KEY_ZH)],
]) {
  const dict = gen();
  const dir = path.join(root, 'pack/kubejs/assets', ns, 'lang');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'zh_cn.json');
  writeFileSync(file, JSON.stringify(dict, null, 1) + '\n');
  console.log(`gen-mod-lang-zh: wrote ${path.relative(root, file)} (${Object.keys(dict).length} keys)`);
}

for (const loc of ['zh_cn', 'en_us']) {
  const dict = genTacz(loc);
  const dir = path.join(root, 'pack/kubejs/assets/tacz/lang');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${loc}.json`);
  writeFileSync(file, JSON.stringify(dict, null, 1) + '\n');
  console.log(`gen-mod-lang-zh: wrote ${path.relative(root, file)} (${Object.keys(dict).length} keys)`);
}
