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

for (const [ns, gen] of [
  ['framedblocks', genFramedblocks],
  ['mcwfurnitures', genMcwFurniture],
  ['refurbished_furniture', genRefurbished],
  ['energizedfurniture', genEnergized],
  ['tmted', genTmted],
  ['immersivecooking', genImmersiveCooking],
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
