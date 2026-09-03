/** App 目前實際有翻譯檔的語系（跟 preference.service.ts 的 AVAILABLE_LANGS 保持一致）。
 *  機場全名／航空公司名稱依這個語系顯示，其餘國家/地區一律 fallback 到 en-US，
 *  跟 App 其他文案的語系邏輯完全一致，不額外做「每個機場當地語言」那種大工程。 */
export type FlightDisplayLang = 'zh-TW' | 'zh-CN' | 'ja-JP' | 'en-US';

/** 機場代碼 → 各語系機場全名。涵蓋範圍等同「自動盯價」出發地/目的地自動完成清單
 *  （flight-watch.component.ts 的 AIRPORTS），因為追蹤路線只能從那份清單選取。 */
export const AIRPORT_NAMES: Record<string, Record<FlightDisplayLang, string>> = {
  TPE: {
    'zh-TW': '臺灣桃園國際機場',
    'zh-CN': '台湾桃园国际机场',
    'ja-JP': '台湾桃園国際空港',
    'en-US': 'Taiwan Taoyuan International Airport',
  },
  TSA: {
    'zh-TW': '台北松山機場',
    'zh-CN': '台北松山机场',
    'ja-JP': '台北松山空港',
    'en-US': 'Taipei Songshan Airport',
  },
  KHH: {
    'zh-TW': '高雄國際機場',
    'zh-CN': '高雄国际机场',
    'ja-JP': '高雄国際空港',
    'en-US': 'Kaohsiung International Airport',
  },
  RMQ: {
    'zh-TW': '台中國際機場',
    'zh-CN': '台中国际机场',
    'ja-JP': '台中国際空港',
    'en-US': 'Taichung International Airport',
  },
  NRT: {
    'zh-TW': '東京成田國際機場',
    'zh-CN': '东京成田国际机场',
    'ja-JP': '成田国際空港',
    'en-US': 'Narita International Airport',
  },
  HND: {
    'zh-TW': '東京羽田機場',
    'zh-CN': '东京羽田机场',
    'ja-JP': '東京国際空港（羽田空港）',
    'en-US': 'Tokyo Haneda Airport',
  },
  KIX: {
    'zh-TW': '大阪關西國際機場',
    'zh-CN': '大阪关西国际机场',
    'ja-JP': '関西国際空港',
    'en-US': 'Kansai International Airport',
  },
  NGO: {
    'zh-TW': '中部國際機場',
    'zh-CN': '中部国际机场',
    'ja-JP': '中部国際空港',
    'en-US': 'Chubu Centrair International Airport',
  },
  FUK: {
    'zh-TW': '福岡機場',
    'zh-CN': '福冈机场',
    'ja-JP': '福岡空港',
    'en-US': 'Fukuoka Airport',
  },
  CTS: {
    'zh-TW': '新千歲機場',
    'zh-CN': '新千岁机场',
    'ja-JP': '新千歳空港',
    'en-US': 'New Chitose Airport',
  },
  OKA: {
    'zh-TW': '那霸機場',
    'zh-CN': '那霸机场',
    'ja-JP': '那覇空港',
    'en-US': 'Naha Airport',
  },
  ICN: {
    'zh-TW': '首爾仁川國際機場',
    'zh-CN': '首尔仁川国际机场',
    'ja-JP': '仁川国際空港',
    'en-US': 'Incheon International Airport',
  },
  GMP: {
    'zh-TW': '首爾金浦機場',
    'zh-CN': '首尔金浦机场',
    'ja-JP': '金浦国際空港',
    'en-US': 'Gimpo International Airport',
  },
  PUS: {
    'zh-TW': '釜山金海國際機場',
    'zh-CN': '釜山金海国际机场',
    'ja-JP': '金海国際空港',
    'en-US': 'Gimhae International Airport',
  },
  HKG: {
    'zh-TW': '香港國際機場',
    'zh-CN': '香港国际机场',
    'ja-JP': '香港国際空港',
    'en-US': 'Hong Kong International Airport',
  },
  MFM: {
    'zh-TW': '澳門國際機場',
    'zh-CN': '澳门国际机场',
    'ja-JP': 'マカオ国際空港',
    'en-US': 'Macau International Airport',
  },
  PVG: {
    'zh-TW': '上海浦東國際機場',
    'zh-CN': '上海浦东国际机场',
    'ja-JP': '上海浦東国際空港',
    'en-US': 'Shanghai Pudong International Airport',
  },
  SHA: {
    'zh-TW': '上海虹橋國際機場',
    'zh-CN': '上海虹桥国际机场',
    'ja-JP': '上海虹橋国際空港',
    'en-US': 'Shanghai Hongqiao International Airport',
  },
  PEK: {
    'zh-TW': '北京首都國際機場',
    'zh-CN': '北京首都国际机场',
    'ja-JP': '北京首都国際空港',
    'en-US': 'Beijing Capital International Airport',
  },
  PKX: {
    'zh-TW': '北京大興國際機場',
    'zh-CN': '北京大兴国际机场',
    'ja-JP': '北京大興国際空港',
    'en-US': 'Beijing Daxing International Airport',
  },
  CAN: {
    'zh-TW': '廣州白雲國際機場',
    'zh-CN': '广州白云国际机场',
    'ja-JP': '広州白雲国際空港',
    'en-US': 'Guangzhou Baiyun International Airport',
  },
  SZX: {
    'zh-TW': '深圳寶安國際機場',
    'zh-CN': '深圳宝安国际机场',
    'ja-JP': '深圳宝安国際空港',
    'en-US': "Shenzhen Bao'an International Airport",
  },
  BKK: {
    'zh-TW': '曼谷素萬那普國際機場',
    'zh-CN': '曼谷素万那普国际机场',
    'ja-JP': 'スワンナプーム国際空港',
    'en-US': 'Suvarnabhumi Airport',
  },
  DMK: {
    'zh-TW': '曼谷廊曼國際機場',
    'zh-CN': '曼谷廊曼国际机场',
    'ja-JP': 'ドンムアン国際空港',
    'en-US': 'Don Mueang International Airport',
  },
  HKT: {
    'zh-TW': '普吉國際機場',
    'zh-CN': '普吉国际机场',
    'ja-JP': 'プーケット国際空港',
    'en-US': 'Phuket International Airport',
  },
  CNX: {
    'zh-TW': '清邁國際機場',
    'zh-CN': '清迈国际机场',
    'ja-JP': 'チェンマイ国際空港',
    'en-US': 'Chiang Mai International Airport',
  },
  SGN: {
    'zh-TW': '胡志明市新山一國際機場',
    'zh-CN': '胡志明市新山一国际机场',
    'ja-JP': 'タンソンニャット国際空港',
    'en-US': 'Tan Son Nhat International Airport',
  },
  HAN: {
    'zh-TW': '河內內排國際機場',
    'zh-CN': '河内内排国际机场',
    'ja-JP': 'ノイバイ国際空港',
    'en-US': 'Noi Bai International Airport',
  },
  DAD: {
    'zh-TW': '峴港國際機場',
    'zh-CN': '岘港国际机场',
    'ja-JP': 'ダナン国際空港',
    'en-US': 'Da Nang International Airport',
  },
  SIN: {
    'zh-TW': '新加坡樟宜機場',
    'zh-CN': '新加坡樟宜机场',
    'ja-JP': 'シンガポール・チャンギ国際空港',
    'en-US': 'Singapore Changi Airport',
  },
  KUL: {
    'zh-TW': '吉隆坡國際機場',
    'zh-CN': '吉隆坡国际机场',
    'ja-JP': 'クアラルンプール国際空港',
    'en-US': 'Kuala Lumpur International Airport',
  },
  CGK: {
    'zh-TW': '雅加達蘇加諾-哈達國際機場',
    'zh-CN': '雅加达苏加诺-哈达国际机场',
    'ja-JP': 'スカルノ・ハッタ国際空港',
    'en-US': 'Soekarno–Hatta International Airport',
  },
  DPS: {
    'zh-TW': '峇里島伍拉·賴國際機場',
    'zh-CN': '巴厘岛伍拉·赖国际机场',
    'ja-JP': 'ングラ・ライ国際空港',
    'en-US': 'Ngurah Rai International Airport',
  },
  MNL: {
    'zh-TW': '馬尼拉尼諾伊·艾奎諾國際機場',
    'zh-CN': '马尼拉尼诺伊·艾奎诺国际机场',
    'ja-JP': 'ニノイ・アキノ国際空港',
    'en-US': 'Ninoy Aquino International Airport',
  },
  CEB: {
    'zh-TW': '宿霧麥克坦國際機場',
    'zh-CN': '宿务麦克坦国际机场',
    'ja-JP': 'マクタン・セブ国際空港',
    'en-US': 'Mactan–Cebu International Airport',
  },
  DEL: {
    'zh-TW': '新德里英迪拉·甘地國際機場',
    'zh-CN': '新德里英迪拉·甘地国际机场',
    'ja-JP': 'インディラ・ガンディー国際空港',
    'en-US': 'Indira Gandhi International Airport',
  },
  BOM: {
    'zh-TW': '孟買賈特拉帕蒂·希瓦吉國際機場',
    'zh-CN': '孟买贾特拉帕蒂·希瓦吉国际机场',
    'ja-JP': 'チャトラパティ・シヴァージー国際空港',
    'en-US': 'Chhatrapati Shivaji Maharaj International Airport',
  },
  DXB: {
    'zh-TW': '杜拜國際機場',
    'zh-CN': '迪拜国际机场',
    'ja-JP': 'ドバイ国際空港',
    'en-US': 'Dubai International Airport',
  },
  DOH: {
    'zh-TW': '哈馬德國際機場',
    'zh-CN': '哈马德国际机场',
    'ja-JP': 'ハマド国際空港',
    'en-US': 'Hamad International Airport',
  },
  IST: {
    'zh-TW': '伊斯坦堡機場',
    'zh-CN': '伊斯坦布尔机场',
    'ja-JP': 'イスタンブール空港',
    'en-US': 'Istanbul Airport',
  },
  LHR: {
    'zh-TW': '倫敦希斯洛機場',
    'zh-CN': '伦敦希思罗机场',
    'ja-JP': 'ロンドン・ヒースロー空港',
    'en-US': 'London Heathrow Airport',
  },
  CDG: {
    'zh-TW': '巴黎戴高樂機場',
    'zh-CN': '巴黎戴高乐机场',
    'ja-JP': 'パリ・シャルル・ド・ゴール空港',
    'en-US': 'Paris Charles de Gaulle Airport',
  },
  FRA: {
    'zh-TW': '法蘭克福機場',
    'zh-CN': '法兰克福机场',
    'ja-JP': 'フランクフルト空港',
    'en-US': 'Frankfurt Airport',
  },
  FCO: {
    'zh-TW': '羅馬菲烏米奇諾機場',
    'zh-CN': '罗马菲乌米奇诺机场',
    'ja-JP': 'レオナルド・ダ・ヴィンチ＝フィウミチーノ空港',
    'en-US': 'Rome Fiumicino Airport',
  },
  AMS: {
    'zh-TW': '阿姆斯特丹史基浦機場',
    'zh-CN': '阿姆斯特丹史基浦机场',
    'ja-JP': 'アムステルダム・スキポール空港',
    'en-US': 'Amsterdam Airport Schiphol',
  },
  ZRH: {
    'zh-TW': '蘇黎世機場',
    'zh-CN': '苏黎世机场',
    'ja-JP': 'チューリッヒ空港',
    'en-US': 'Zurich Airport',
  },
  JFK: {
    'zh-TW': '紐約甘迺迪國際機場',
    'zh-CN': '纽约肯尼迪国际机场',
    'ja-JP': 'ニューヨーク・ジョン・F・ケネディ国際空港',
    'en-US': 'John F. Kennedy International Airport',
  },
  LAX: {
    'zh-TW': '洛杉磯國際機場',
    'zh-CN': '洛杉矶国际机场',
    'ja-JP': 'ロサンゼルス国際空港',
    'en-US': 'Los Angeles International Airport',
  },
  SFO: {
    'zh-TW': '舊金山國際機場',
    'zh-CN': '旧金山国际机场',
    'ja-JP': 'サンフランシスコ国際空港',
    'en-US': 'San Francisco International Airport',
  },
  SEA: {
    'zh-TW': '西雅圖塔科馬國際機場',
    'zh-CN': '西雅图塔科马国际机场',
    'ja-JP': 'シアトル・タコマ国際空港',
    'en-US': 'Seattle–Tacoma International Airport',
  },
  YVR: {
    'zh-TW': '溫哥華國際機場',
    'zh-CN': '温哥华国际机场',
    'ja-JP': 'バンクーバー国際空港',
    'en-US': 'Vancouver International Airport',
  },
  YYZ: {
    'zh-TW': '多倫多皮爾遜國際機場',
    'zh-CN': '多伦多皮尔逊国际机场',
    'ja-JP': 'トロント・ピアソン国際空港',
    'en-US': 'Toronto Pearson International Airport',
  },
  SYD: {
    'zh-TW': '雪梨金斯福史密斯機場',
    'zh-CN': '悉尼金斯福德·史密斯机场',
    'ja-JP': 'シドニー国際空港',
    'en-US': 'Sydney Kingsford Smith Airport',
  },
  MEL: {
    'zh-TW': '墨爾本機場',
    'zh-CN': '墨尔本机场',
    'ja-JP': 'メルボルン空港',
    'en-US': 'Melbourne Airport',
  },
  AKL: {
    'zh-TW': '奧克蘭機場',
    'zh-CN': '奥克兰机场',
    'ja-JP': 'オークランド空港',
    'en-US': 'Auckland Airport',
  },
};

/** 依機場代碼取得該語系的機場全名；查無資料時 fallback 顯示代碼本身。 */
export function airportDisplayName(code: string, lang: FlightDisplayLang): string {
  return AIRPORT_NAMES[code]?.[lang] ?? code;
}

/** 航空公司英文顯示名稱（小寫，供比對用）→ 各語系名稱。
 *  涵蓋常見飛航「自動盯價」機場清單航線的主要航空公司；查無資料的公司名稱
 *  一律照原文（英文）顯示，不強求全覆蓋。 */
const AIRLINE_NAMES: Record<string, Record<FlightDisplayLang, string>> = {
  'china airlines': {
    'zh-TW': '中華航空',
    'zh-CN': '中华航空',
    'ja-JP': 'チャイナエアライン',
    'en-US': 'China Airlines',
  },
  'eva air': {
    'zh-TW': '長榮航空',
    'zh-CN': '长荣航空',
    'ja-JP': 'エバー航空',
    'en-US': 'EVA Air',
  },
  'cathay pacific': {
    'zh-TW': '國泰航空',
    'zh-CN': '国泰航空',
    'ja-JP': 'キャセイパシフィック航空',
    'en-US': 'Cathay Pacific',
  },
  'hong kong express': {
    'zh-TW': '香港快運航空',
    'zh-CN': '香港快运航空',
    'ja-JP': '香港エクスプレス航空',
    'en-US': 'Hong Kong Express',
  },
  'hk express': {
    'zh-TW': '香港快運航空',
    'zh-CN': '香港快运航空',
    'ja-JP': '香港エクスプレス航空',
    'en-US': 'HK Express',
  },
  'starlux airlines': {
    'zh-TW': '星宇航空',
    'zh-CN': '星宇航空',
    'ja-JP': 'スターラックス航空',
    'en-US': 'Starlux Airlines',
  },
  'tigerair taiwan': {
    'zh-TW': '台灣虎航',
    'zh-CN': '台湾虎航',
    'ja-JP': 'タイガーエア台湾',
    'en-US': 'Tigerair Taiwan',
  },
  'japan airlines': {
    'zh-TW': '日本航空',
    'zh-CN': '日本航空',
    'ja-JP': '日本航空',
    'en-US': 'Japan Airlines',
  },
  'all nippon airways': {
    'zh-TW': '全日空航空',
    'zh-CN': '全日空航空',
    'ja-JP': '全日本空輸（ANA）',
    'en-US': 'All Nippon Airways',
  },
  'peach aviation': {
    'zh-TW': '樂桃航空',
    'zh-CN': '乐桃航空',
    'ja-JP': 'ピーチ・アビエーション',
    'en-US': 'Peach Aviation',
  },
  'jetstar japan': {
    'zh-TW': '日本捷星航空',
    'zh-CN': '日本捷星航空',
    'ja-JP': 'ジェットスター・ジャパン',
    'en-US': 'Jetstar Japan',
  },
  'korean air': {
    'zh-TW': '大韓航空',
    'zh-CN': '大韩航空',
    'ja-JP': '大韓航空',
    'en-US': 'Korean Air',
  },
  'asiana airlines': {
    'zh-TW': '韓亞航空',
    'zh-CN': '韩亚航空',
    'ja-JP': 'アシアナ航空',
    'en-US': 'Asiana Airlines',
  },
  'jeju air': {
    'zh-TW': '濟州航空',
    'zh-CN': '济州航空',
    'ja-JP': 'チェジュ航空',
    'en-US': 'Jeju Air',
  },
  "t'way air": {
    'zh-TW': '德威航空',
    'zh-CN': '德威航空',
    'ja-JP': 'ティーウェイ航空',
    'en-US': "T'way Air",
  },
  'air busan': {
    'zh-TW': '釜山航空',
    'zh-CN': '釜山航空',
    'ja-JP': '釜山航空',
    'en-US': 'Air Busan',
  },
  'singapore airlines': {
    'zh-TW': '新加坡航空',
    'zh-CN': '新加坡航空',
    'ja-JP': 'シンガポール航空',
    'en-US': 'Singapore Airlines',
  },
  scoot: {
    'zh-TW': '酷航',
    'zh-CN': '酷航',
    'ja-JP': 'スクート',
    'en-US': 'Scoot',
  },
  'thai airways': {
    'zh-TW': '泰國航空',
    'zh-CN': '泰国航空',
    'ja-JP': 'タイ国際航空',
    'en-US': 'Thai Airways',
  },
  'thai airasia': {
    'zh-TW': '泰國亞洲航空',
    'zh-CN': '泰国亚洲航空',
    'ja-JP': 'タイ・エアアジア',
    'en-US': 'Thai AirAsia',
  },
  airasia: {
    'zh-TW': '亞洲航空',
    'zh-CN': '亚洲航空',
    'ja-JP': 'エアアジア',
    'en-US': 'AirAsia',
  },
  'vietnam airlines': {
    'zh-TW': '越南航空',
    'zh-CN': '越南航空',
    'ja-JP': 'ベトナム航空',
    'en-US': 'Vietnam Airlines',
  },
  'vietjet air': {
    'zh-TW': '越捷航空',
    'zh-CN': '越捷航空',
    'ja-JP': 'ベトジェットエア',
    'en-US': 'VietJet Air',
  },
  'philippine airlines': {
    'zh-TW': '菲律賓航空',
    'zh-CN': '菲律宾航空',
    'ja-JP': 'フィリピン航空',
    'en-US': 'Philippine Airlines',
  },
  'cebu pacific': {
    'zh-TW': '宿霧太平洋航空',
    'zh-CN': '宿务太平洋航空',
    'ja-JP': 'セブパシフィック航空',
    'en-US': 'Cebu Pacific',
  },
  'malaysia airlines': {
    'zh-TW': '馬來西亞航空',
    'zh-CN': '马来西亚航空',
    'ja-JP': 'マレーシア航空',
    'en-US': 'Malaysia Airlines',
  },
  'garuda indonesia': {
    'zh-TW': '印尼鷹航',
    'zh-CN': '印尼鹰航',
    'ja-JP': 'ガルーダ・インドネシア航空',
    'en-US': 'Garuda Indonesia',
  },
  'lion air': {
    'zh-TW': '獅航',
    'zh-CN': '狮航',
    'ja-JP': 'ライオン・エア',
    'en-US': 'Lion Air',
  },
  'batik air': {
    'zh-TW': '巴迪克航空',
    'zh-CN': '巴迪克航空',
    'ja-JP': 'バティックエア',
    'en-US': 'Batik Air',
  },
  indigo: {
    'zh-TW': '靛藍航空',
    'zh-CN': '靛蓝航空',
    'ja-JP': 'インディゴ航空',
    'en-US': 'IndiGo',
  },
  'air india': {
    'zh-TW': '印度航空',
    'zh-CN': '印度航空',
    'ja-JP': 'インド航空',
    'en-US': 'Air India',
  },
  emirates: {
    'zh-TW': '阿聯酋航空',
    'zh-CN': '阿联酋航空',
    'ja-JP': 'エミレーツ航空',
    'en-US': 'Emirates',
  },
  'qatar airways': {
    'zh-TW': '卡達航空',
    'zh-CN': '卡塔尔航空',
    'ja-JP': 'カタール航空',
    'en-US': 'Qatar Airways',
  },
  'etihad airways': {
    'zh-TW': '阿提哈德航空',
    'zh-CN': '阿提哈德航空',
    'ja-JP': 'エティハド航空',
    'en-US': 'Etihad Airways',
  },
  'turkish airlines': {
    'zh-TW': '土耳其航空',
    'zh-CN': '土耳其航空',
    'ja-JP': 'ターキッシュ エアラインズ',
    'en-US': 'Turkish Airlines',
  },
  'british airways': {
    'zh-TW': '英國航空',
    'zh-CN': '英国航空',
    'ja-JP': 'ブリティッシュ・エアウェイズ',
    'en-US': 'British Airways',
  },
  'air france': {
    'zh-TW': '法國航空',
    'zh-CN': '法国航空',
    'ja-JP': 'エールフランス航空',
    'en-US': 'Air France',
  },
  lufthansa: {
    'zh-TW': '漢莎航空',
    'zh-CN': '汉莎航空',
    'ja-JP': 'ルフトハンザドイツ航空',
    'en-US': 'Lufthansa',
  },
  klm: {
    'zh-TW': '荷蘭皇家航空',
    'zh-CN': '荷兰皇家航空',
    'ja-JP': 'KLMオランダ航空',
    'en-US': 'KLM',
  },
  'klm royal dutch airlines': {
    'zh-TW': '荷蘭皇家航空',
    'zh-CN': '荷兰皇家航空',
    'ja-JP': 'KLMオランダ航空',
    'en-US': 'KLM Royal Dutch Airlines',
  },
  'swiss international air lines': {
    'zh-TW': '瑞士國際航空',
    'zh-CN': '瑞士国际航空',
    'ja-JP': 'スイスインターナショナルエアラインズ',
    'en-US': 'Swiss International Air Lines',
  },
  'ita airways': {
    'zh-TW': '義大利航空',
    'zh-CN': '意大利航空',
    'ja-JP': 'ITAエアウェイズ',
    'en-US': 'ITA Airways',
  },
  'united airlines': {
    'zh-TW': '聯合航空',
    'zh-CN': '美联航',
    'ja-JP': 'ユナイテッド航空',
    'en-US': 'United Airlines',
  },
  'american airlines': {
    'zh-TW': '美國航空',
    'zh-CN': '美国航空',
    'ja-JP': 'アメリカン航空',
    'en-US': 'American Airlines',
  },
  'delta air lines': {
    'zh-TW': '達美航空',
    'zh-CN': '达美航空',
    'ja-JP': 'デルタ航空',
    'en-US': 'Delta Air Lines',
  },
  'air canada': {
    'zh-TW': '加拿大航空',
    'zh-CN': '加拿大航空',
    'ja-JP': 'エア・カナダ',
    'en-US': 'Air Canada',
  },
  qantas: {
    'zh-TW': '澳洲航空',
    'zh-CN': '澳洲航空',
    'ja-JP': 'カンタス航空',
    'en-US': 'Qantas',
  },
  'air new zealand': {
    'zh-TW': '紐西蘭航空',
    'zh-CN': '新西兰航空',
    'ja-JP': 'ニュージーランド航空',
    'en-US': 'Air New Zealand',
  },
  'virgin australia': {
    'zh-TW': '維珍澳洲航空',
    'zh-CN': '维珍澳洲航空',
    'ja-JP': 'ヴァージン・オーストラリア',
    'en-US': 'Virgin Australia',
  },
  jetstar: {
    'zh-TW': '捷星航空',
    'zh-CN': '捷星航空',
    'ja-JP': 'ジェットスター航空',
    'en-US': 'Jetstar',
  },
  'jetstar airways': {
    'zh-TW': '捷星航空',
    'zh-CN': '捷星航空',
    'ja-JP': 'ジェットスター航空',
    'en-US': 'Jetstar Airways',
  },
  'china southern airlines': {
    'zh-TW': '中國南方航空',
    'zh-CN': '中国南方航空',
    'ja-JP': '中国南方航空',
    'en-US': 'China Southern Airlines',
  },
  'china eastern airlines': {
    'zh-TW': '中國東方航空',
    'zh-CN': '中国东方航空',
    'ja-JP': '中国東方航空',
    'en-US': 'China Eastern Airlines',
  },
  'xiamen airlines': {
    'zh-TW': '廈門航空',
    'zh-CN': '厦门航空',
    'ja-JP': '厦門航空',
    'en-US': 'Xiamen Airlines',
  },
  'hainan airlines': {
    'zh-TW': '海南航空',
    'zh-CN': '海南航空',
    'ja-JP': '海南航空',
    'en-US': 'Hainan Airlines',
  },
  'spring airlines': {
    'zh-TW': '春秋航空',
    'zh-CN': '春秋航空',
    'ja-JP': '春秋航空',
    'en-US': 'Spring Airlines',
  },
};

/** 航空公司名稱依語系顯示：英文語系直接顯示原文；其餘語系有對照表時顯示
 *  「翻譯名稱（原文）」，查無對照表時原樣顯示（不強求全覆蓋）。 */
export function airlineDisplayLabel(original: string, lang: FlightDisplayLang): string {
  const trimmed = original.trim();
  if (!trimmed) return trimmed;
  if (lang === 'en-US') return trimmed;
  const translated = AIRLINE_NAMES[trimmed.toLowerCase()]?.[lang];
  if (!translated || translated === trimmed) return trimmed;
  return `${translated}（${trimmed}）`;
}
