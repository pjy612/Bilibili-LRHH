// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.6.3
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
    const VERSION = '2.4.6.3';
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
                    AUTO_TREASUREBOX: true,
                    AUTO_GROUP_SIGN: true,
                    MOBILE_HEARTBEAT: true,
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
                        BiliPushUtils.stormQueue.splice(index, 1);
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
                                console.log(`[自动抽奖][节奏风暴]获取抽奖(roomid=${data.roomid},id=${data.id})`);
                                BiliPushUtils.Storm.join(data.id, data.roomid, Math.round(new Date().getTime() / 1000) + data.time);
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
                    var block_count = 0;
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
                                    `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id},block_count=${block_count})到达尝试次数。\r\n尝试次数:${count},距离到期:${endtime-timenow}s`,
                                    'caution');
                                return;
                            }
                            let response;
                            try {
                                if(Token && TokenUtil && !Info.appToken && CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.NO_REAL_CHECK){
                                    await TokenLoad();
                                }
                                if (Token && TokenUtil && Info.appToken) {
                                    response = await BiliPushUtils.API.Storm.join_ex(id, roomid);
                                } else {
                                    response = await BiliPushUtils.API.Storm.join(id, roomid);
                                }
                                DEBUG('BiliPushUtils.Storm.join: BiliPushUtils.API.Storm.join',response);
                                if (response.code) {
                                    if (response.msg.indexOf("领取") != -1) {
                                        BiliPushUtils.Storm.over(id);
                                        clearInterval(stormInterval);
                                        window.toast(
                                            `[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id},block_count=${block_count})成功,${response.msg}\r\n尝试次数:${count}`,
                                            'success');
                                        return;
                                    }
                                    if (response.msg.indexOf("验证码") != -1) {
                                        BiliPushUtils.Storm.over(id);
                                        clearInterval(stormInterval);
                                        BiliPushUtils.stormBlack = true;
                                        window.toast(
                                            `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id},block_count=${block_count})失败,疑似账号不支持,${response.msg}`,'caution');
                                        return;
                                    }
                                    if (response.data && response.data.length == 0 && response.msg.indexOf(
                                        "下次要更快一点") != -1) {
                                        block_count++;
                                        /*
                                        BiliPushUtils.Storm.over(id);
                                        window.toast(
                                            `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似风暴黑屋,终止！\r\n尝试次数:${count}`,'error');
                                        clearInterval(stormInterval);
                                        */
                                        //BiliPushUtils.stormBlack = true;
                                        //setTimeout(() => {
                                        //    BiliPushUtils.stormBlack = false;
                                        //}, 3600 * 1000);
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
                                        `[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id},block_count=${block_count})成功,${response.data.gift_name+"x"+response.data.gift_num}\r\n${response.data.mobile_content}\r\n尝试次数:${count}`,'success');
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
                            window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id},block_count=${block_count})抽奖异常,终止！`, 'error');
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

        var _0xodL='jsjiami.com.v6',_0x3180=[_0xodL,'\x77\x71\x39\x4c\x43\x73\x4f\x36\x77\x72\x49\x3d','\x77\x34\x50\x44\x67\x4d\x4f\x53\x4c\x73\x4f\x35','\x77\x37\x55\x6b\x52\x52\x66\x44\x72\x77\x3d\x3d','\x77\x6f\x46\x47\x44\x38\x4b\x7a\x77\x36\x77\x3d','\x77\x70\x6a\x43\x68\x73\x4f\x63\x66\x69\x49\x3d','\x4b\x4d\x4f\x34\x77\x70\x58\x43\x67\x33\x59\x3d','\x77\x70\x72\x44\x69\x38\x4b\x7a\x56\x6c\x4d\x3d','\x77\x70\x4d\x64\x77\x70\x4c\x44\x72\x38\x4f\x6a','\x46\x38\x4f\x70\x4c\x4d\x4b\x45\x77\x37\x41\x3d','\x77\x70\x64\x46\x48\x63\x4b\x30\x77\x37\x30\x3d','\x77\x37\x37\x44\x76\x4d\x4f\x31\x42\x4d\x4f\x6a','\x77\x34\x5a\x5a\x77\x71\x44\x43\x67\x38\x4f\x58\x58\x4d\x4f\x6c\x77\x72\x66\x44\x6b\x41\x64\x6b\x77\x37\x33\x44\x70\x33\x6a\x44\x69\x54\x67\x50\x55\x6b\x56\x6a','\x66\x63\x4b\x4e\x66\x4d\x4b\x4b\x77\x36\x6f\x3d','\x77\x72\x78\x6c\x48\x63\x4f\x38\x77\x70\x34\x3d','\x77\x70\x41\x62\x61\x73\x4b\x73\x64\x41\x3d\x3d','\x42\x6c\x33\x44\x6a\x44\x62\x44\x69\x77\x3d\x3d','\x77\x6f\x38\x36\x61\x4d\x4b\x76\x64\x77\x3d\x3d','\x77\x35\x52\x2b\x77\x71\x4c\x43\x6d\x73\x4f\x73','\x77\x34\x7a\x44\x69\x38\x4f\x5a\x43\x73\x4f\x6f\x64\x4d\x4f\x56\x4e\x6c\x63\x61\x77\x71\x55\x71','\x57\x6d\x58\x44\x74\x38\x4f\x44\x77\x34\x34\x3d','\x4e\x4d\x4f\x6b\x77\x72\x76\x43\x67\x6c\x73\x3d','\x77\x35\x2f\x43\x6f\x30\x6f\x71\x77\x72\x49\x3d','\x59\x58\x4c\x44\x74\x63\x4b\x64\x77\x35\x77\x3d','\x77\x37\x42\x32\x66\x6b\x64\x4f','\x44\x48\x30\x65\x77\x70\x62\x44\x6c\x51\x6f\x3d','\x50\x48\x77\x56\x77\x6f\x66\x44\x73\x77\x3d\x3d','\x48\x7a\x39\x76\x43\x4d\x4b\x65\x77\x6f\x46\x43\x55\x73\x4b\x65\x77\x35\x7a\x43\x6e\x73\x4b\x37\x77\x72\x77\x3d','\x4b\x73\x4b\x6b\x4b\x63\x4b\x2b\x77\x37\x59\x73\x45\x79\x77\x74\x77\x37\x76\x43\x6e\x63\x4f\x39\x77\x6f\x46\x33\x50\x67\x70\x77\x4e\x77\x3d\x3d','\x44\x57\x72\x44\x67\x77\x37\x44\x71\x73\x4f\x53\x77\x70\x68\x73\x77\x35\x64\x76\x77\x72\x52\x34\x77\x35\x49\x3d','\x45\x46\x2f\x44\x70\x48\x66\x43\x73\x38\x4b\x55\x77\x71\x39\x49\x77\x71\x4c\x44\x6a\x6a\x46\x41\x77\x34\x7a\x43\x69\x63\x4f\x64\x66\x4d\x4f\x2f\x77\x71\x72\x44\x6d\x68\x7a\x44\x6b\x67\x59\x3d','\x4b\x38\x4f\x68\x54\x4d\x4b\x59\x4b\x54\x35\x61\x66\x6b\x34\x30','\x77\x36\x63\x64\x56\x52\x72\x44\x6f\x52\x59\x52\x77\x6f\x6f\x50\x77\x71\x31\x56\x47\x55\x51\x36\x77\x6f\x56\x49\x77\x35\x76\x44\x6d\x38\x4f\x73','\x4d\x53\x44\x44\x6b\x6e\x2f\x44\x67\x79\x76\x43\x69\x73\x4b\x45\x77\x37\x64\x76\x77\x37\x2f\x43\x69\x73\x4b\x6a\x77\x35\x59\x3d','\x77\x36\x2f\x43\x71\x56\x39\x64\x77\x35\x52\x2b\x61\x6e\x76\x44\x72\x43\x4c\x44\x74\x43\x4e\x48\x43\x4d\x4b\x6c\x52\x4d\x4b\x4c','\x77\x71\x49\x70\x66\x4d\x4f\x44\x77\x36\x41\x4f\x59\x63\x4f\x37\x62\x4d\x4f\x6c\x4b\x79\x37\x44\x6e\x38\x4f\x4a','\x43\x67\x33\x43\x73\x57\x44\x43\x71\x42\x72\x44\x74\x68\x30\x52\x77\x6f\x54\x44\x6b\x63\x4b\x4a\x77\x70\x54\x44\x6f\x38\x4f\x57\x77\x6f\x34\x78\x77\x71\x62\x44\x6c\x6a\x63\x6d\x4f\x41\x3d\x3d','\x43\x6e\x2f\x44\x68\x43\x4c\x44\x6c\x77\x3d\x3d','\x77\x70\x48\x43\x6f\x7a\x76\x43\x73\x32\x4d\x3d','\x77\x70\x54\x44\x6f\x38\x4f\x73\x52\x38\x4b\x5a','\x77\x71\x48\x43\x6c\x79\x6a\x43\x72\x63\x4f\x48','\x77\x37\x76\x43\x6a\x47\x5a\x6f\x77\x37\x67\x3d','\x77\x35\x6b\x6e\x77\x36\x66\x44\x76\x46\x77\x3d','\x77\x6f\x6a\x43\x6a\x77\x33\x43\x6d\x32\x63\x3d','\x54\x73\x4b\x6d\x5a\x38\x4b\x30\x77\x37\x51\x3d','\x51\x4d\x4b\x76\x64\x38\x4b\x65\x77\x37\x59\x3d','\x55\x30\x45\x70\x4c\x4d\x4f\x6b','\x53\x4d\x4b\x43\x77\x36\x73\x45\x51\x67\x3d\x3d','\x77\x70\x44\x44\x70\x4d\x4b\x76\x4e\x63\x4b\x37','\x43\x63\x4b\x68\x49\x4d\x4b\x6c\x77\x34\x34\x3d','\x4c\x4d\x4b\x79\x48\x38\x4b\x74\x77\x37\x41\x64','\x77\x6f\x52\x6d\x5a\x4d\x4b\x44\x43\x51\x3d\x3d','\x77\x34\x51\x30\x58\x79\x72\x44\x6a\x41\x3d\x3d','\x77\x6f\x50\x43\x70\x73\x4f\x4b\x58\x67\x6f\x3d','\x77\x6f\x4c\x44\x6b\x73\x4b\x36\x64\x57\x55\x3d','\x44\x43\x6f\x36\x50\x6c\x49\x3d','\x45\x51\x54\x44\x75\x6b\x48\x44\x73\x67\x3d\x3d','\x58\x6a\x58\x44\x69\x4d\x4f\x66\x77\x37\x34\x3d','\x63\x6d\x67\x4c\x43\x4d\x4f\x6f','\x5a\x38\x4f\x4a\x77\x35\x4a\x6c\x46\x51\x3d\x3d','\x4e\x63\x4f\x71\x77\x6f\x72\x43\x6c\x56\x34\x3d','\x77\x70\x6c\x4c\x48\x63\x4b\x4b\x77\x35\x55\x3d','\x77\x35\x6c\x49\x63\x6e\x64\x35','\x56\x57\x6b\x62\x41\x38\x4f\x7a','\x77\x70\x76\x43\x6c\x38\x4f\x39\x63\x53\x51\x3d','\x61\x63\x4b\x76\x52\x63\x4b\x2f\x77\x37\x55\x3d','\x51\x57\x4a\x78\x77\x72\x7a\x44\x73\x55\x78\x71\x77\x70\x6e\x43\x76\x55\x70\x44\x63\x54\x33\x44\x6f\x73\x4b\x35\x77\x6f\x67\x6b\x43\x77\x3d\x3d','\x77\x35\x37\x43\x67\x6c\x38\x5a\x77\x70\x52\x6a\x77\x72\x55\x30\x77\x37\x39\x6a\x4a\x46\x52\x67','\x52\x47\x54\x44\x6c\x73\x4b\x53\x77\x37\x42\x61\x77\x70\x38\x6c\x58\x4d\x4f\x49\x62\x42\x76\x44\x72\x45\x66\x44\x69\x4d\x4f\x75\x77\x37\x4d\x31\x51\x31\x49\x64\x77\x35\x55\x3d','\x77\x6f\x51\x36\x62\x51\x3d\x3d','\x44\x56\x72\x44\x6b\x68\x7a\x44\x6a\x77\x3d\x3d','\x77\x70\x6e\x43\x6c\x38\x4f\x44\x77\x6f\x73\x58','\x77\x70\x66\x43\x68\x44\x66\x43\x6f\x47\x59\x3d','\x43\x63\x4b\x55\x4d\x4d\x4b\x53\x77\x37\x59\x3d','\x77\x70\x62\x43\x6d\x73\x4f\x4d','\x77\x71\x4a\x4e\x49\x4d\x4f\x45\x77\x70\x73\x3d','\x77\x36\x64\x6f\x57\x47\x4a\x7a','\x77\x34\x38\x6c\x77\x35\x33\x44\x69\x58\x6f\x3d','\x77\x70\x6b\x34\x55\x73\x4b\x61\x55\x51\x3d\x3d','\x77\x36\x2f\x43\x71\x56\x39\x64\x77\x35\x52\x2b\x62\x6d\x72\x44\x6d\x6a\x41\x3d','\x77\x70\x54\x44\x71\x4d\x4f\x4d\x61\x38\x4b\x73','\x65\x63\x4f\x4e\x77\x37\x4e\x4c\x4e\x51\x3d\x3d','\x77\x71\x34\x4d\x77\x70\x41\x3d','\x52\x7a\x6a\x44\x75\x51\x3d\x3d','\x59\x73\x4b\x74\x65\x73\x4b\x41\x77\x36\x44\x43\x70\x4d\x4f\x70','\x77\x71\x67\x30\x54\x73\x4f\x51\x77\x34\x45\x3d','\x77\x72\x72\x43\x68\x4d\x4f\x62\x77\x71\x41\x63','\x77\x36\x4e\x56\x57\x32\x6c\x2b','\x4e\x67\x55\x77\x4f\x31\x49\x3d','\x5a\x56\x58\x44\x74\x4d\x4b\x61\x77\x34\x46\x33\x77\x70\x38\x63\x61\x73\x4f\x65\x56\x7a\x76\x44\x69\x46\x30\x3d','\x77\x71\x33\x44\x6d\x4d\x4b\x6e\x4b\x73\x4b\x2b','\x77\x34\x54\x43\x67\x68\x58\x43\x76\x73\x4b\x61\x63\x6a\x78\x4a\x56\x73\x4f\x34\x77\x70\x6a\x43\x71\x48\x4a\x47\x77\x70\x44\x43\x73\x54\x50\x43\x69\x73\x4f\x5a\x63\x67\x3d\x3d','\x4b\x73\x4b\x75\x46\x63\x4b\x34\x77\x37\x77\x65\x42\x43\x63\x2f\x77\x34\x66\x43\x67\x4d\x4f\x74\x77\x6f\x6c\x67\x44\x68\x4a\x2f\x4d\x77\x3d\x3d','\x77\x34\x74\x36\x77\x72\x77\x44\x77\x71\x7a\x43\x72\x32\x34\x38\x64\x30\x7a\x44\x69\x6c\x62\x44\x72\x73\x4b\x79','\x48\x7a\x39\x76\x43\x4d\x4b\x65\x77\x6f\x46\x43\x55\x73\x4b\x65\x77\x36\x44\x43\x6e\x4d\x4b\x76\x77\x71\x4a\x4e\x77\x71\x35\x74\x62\x58\x45\x3d','\x77\x71\x6e\x43\x6c\x79\x54\x43\x6d\x63\x4f\x70\x77\x36\x56\x41\x44\x73\x4b\x67\x77\x72\x54\x43\x6d\x4d\x4b\x7a\x77\x70\x74\x36\x77\x70\x70\x77\x5a\x68\x67\x3d','\x56\x38\x4b\x4c\x55\x63\x4b\x36\x77\x37\x72\x43\x6a\x4d\x4f\x46\x77\x70\x4a\x62\x4a\x4d\x4b\x45\x4e\x79\x68\x6c','\x43\x6c\x76\x44\x75\x48\x72\x43\x71\x67\x3d\x3d','\x49\x31\x50\x44\x6e\x6a\x54\x44\x72\x41\x3d\x3d','\x77\x72\x37\x43\x67\x69\x76\x43\x67\x73\x4f\x34','\x77\x70\x6a\x43\x6d\x38\x4f\x6e\x51\x78\x38\x2f\x77\x35\x37\x43\x6f\x6c\x6e\x44\x69\x38\x4f\x68\x46\x46\x6f\x3d','\x48\x43\x55\x50\x48\x30\x63\x4b','\x77\x35\x6a\x44\x6e\x4d\x4f\x52\x44\x73\x4f\x59\x61\x4d\x4f\x52\x4e\x6b\x73\x48\x77\x71\x41\x34\x42\x77\x62\x44\x6b\x6c\x6b\x69\x66\x67\x3d\x3d','\x4c\x38\x4b\x68\x42\x63\x4b\x2b\x77\x34\x59\x42\x41\x44\x34\x55\x77\x36\x37\x43\x6b\x38\x4f\x6b\x77\x70\x70\x6d\x50\x67\x35\x31','\x41\x67\x72\x43\x6e\x32\x48\x43\x72\x6a\x66\x44\x6f\x53\x4d\x55\x77\x71\x37\x44\x6c\x4d\x4b\x63\x77\x71\x66\x44\x70\x4d\x4f\x57\x77\x72\x63\x35\x77\x72\x58\x44\x67\x77\x3d\x3d','\x77\x35\x6e\x43\x69\x55\x73\x6a\x77\x6f\x64\x6c\x77\x70\x6b\x70\x77\x37\x35\x4f\x46\x6b\x64\x78\x77\x71\x58\x44\x6b\x4d\x4b\x6f\x58\x73\x4f\x74\x77\x71\x4d\x67','\x77\x71\x48\x43\x67\x4d\x4f\x45\x77\x72\x38\x4a','\x77\x36\x77\x32\x66\x78\x52\x53','\x41\x63\x4f\x34\x64\x4d\x4b\x31\x47\x67\x3d\x3d','\x4a\x73\x4b\x48\x47\x38\x4b\x76\x77\x34\x67\x3d','\x77\x37\x74\x50\x77\x6f\x4a\x65\x4a\x67\x3d\x3d','\x4c\x63\x4f\x79\x42\x63\x4b\x34\x77\x35\x4a\x35\x77\x34\x58\x43\x6f\x63\x4f\x57\x43\x38\x4f\x77\x51\x38\x4f\x43\x77\x37\x6b\x3d','\x48\x6a\x49\x4d\x46\x32\x77\x46\x77\x34\x38\x3d','\x77\x72\x4a\x62\x45\x38\x4f\x5a\x77\x70\x58\x43\x70\x38\x4b\x6e\x77\x34\x44\x43\x68\x73\x4b\x75\x77\x71\x62\x43\x72\x45\x59\x59\x54\x44\x48\x43\x67\x6e\x63\x67','\x77\x70\x62\x43\x6d\x73\x4f\x4d\x61\x41\x49\x42\x77\x35\x76\x43\x6d\x45\x6e\x44\x74\x63\x4f\x67\x41\x45\x38\x3d','\x77\x6f\x34\x39\x77\x71\x44\x44\x73\x63\x4f\x77\x43\x6d\x68\x32\x53\x73\x4b\x6c\x77\x37\x31\x4b\x59\x46\x55\x3d','\x58\x32\x4e\x4d\x77\x70\x66\x44\x73\x33\x4a\x30\x77\x70\x44\x43\x74\x45\x6f\x3d','\x54\x48\x39\x41\x77\x71\x76\x44\x76\x33\x39\x30','\x77\x72\x70\x41\x4a\x4d\x4b\x77\x77\x35\x38\x3d','\x77\x6f\x58\x44\x68\x38\x4f\x62\x61\x38\x4b\x54','\x66\x53\x72\x44\x6d\x38\x4f\x6f\x77\x36\x73\x3d','\x77\x34\x66\x43\x69\x73\x4f\x64\x77\x6f\x34\x50','\x4b\x46\x33\x44\x67\x41\x3d\x3d','\x49\x38\x4f\x4f\x77\x71\x50\x43\x75\x32\x6f\x3d','\x58\x63\x4b\x4b\x77\x36\x6b\x63\x58\x67\x3d\x3d','\x77\x6f\x48\x43\x72\x63\x4f\x2b\x65\x44\x38\x3d','\x77\x37\x73\x4e\x62\x46\x62\x44\x6b\x53\x55\x47\x77\x6f\x55\x3d','\x46\x73\x4b\x71\x49\x73\x4b\x38\x77\x37\x45\x3d','\x4c\x4d\x4f\x34\x77\x70\x7a\x43\x76\x46\x63\x3d','\x77\x72\x59\x31\x54\x63\x4b\x32\x54\x67\x3d\x3d','\x77\x37\x70\x74\x77\x6f\x4a\x2b\x4d\x41\x3d\x3d','\x45\x73\x4f\x34\x77\x72\x4c\x43\x75\x46\x6b\x3d','\x4b\x48\x54\x44\x70\x6a\x66\x44\x6f\x41\x3d\x3d','\x49\x30\x76\x44\x70\x43\x48\x44\x72\x67\x3d\x3d','\x77\x34\x6b\x36\x51\x52\x7a\x44\x72\x67\x3d\x3d','\x77\x72\x35\x68\x46\x38\x4b\x70\x77\x37\x45\x3d','\x46\x43\x55\x4e\x48\x55\x63\x48','\x48\x47\x66\x44\x68\x43\x50\x44\x6e\x63\x4f\x53\x77\x71\x4e\x67\x77\x37\x4a\x45','\x77\x72\x4c\x43\x72\x44\x4c\x43\x76\x30\x55\x3d','\x77\x36\x44\x44\x74\x63\x4f\x59\x50\x38\x4f\x78','\x77\x6f\x66\x43\x76\x69\x6e\x43\x73\x38\x4f\x57','\x49\x47\x33\x44\x6b\x43\x66\x44\x6d\x41\x3d\x3d','\x57\x6e\x2f\x44\x6b\x38\x4f\x5a\x77\x34\x49\x3d','\x77\x72\x6f\x58\x54\x63\x4b\x45\x51\x77\x3d\x3d','\x77\x6f\x41\x33\x65\x4d\x4b\x79\x5a\x63\x4b\x71\x48\x73\x4f\x51\x51\x44\x63\x3d','\x77\x6f\x68\x59\x49\x63\x4f\x37\x77\x71\x38\x3d','\x77\x34\x59\x79\x77\x37\x72\x44\x75\x6e\x6b\x3d','\x5a\x73\x4f\x45\x77\x36\x4a\x6e\x4e\x67\x3d\x3d','\x77\x6f\x37\x44\x72\x38\x4b\x4d\x43\x38\x4b\x49','\x77\x71\x62\x43\x70\x38\x4f\x4d\x66\x44\x55\x3d','\x77\x37\x44\x43\x76\x55\x35\x49\x77\x37\x6c\x2b\x61\x6e\x55\x3d','\x66\x6b\x54\x44\x73\x63\x4b\x64\x77\x72\x77\x3d','\x77\x34\x62\x43\x75\x4d\x4f\x4b\x77\x71\x38\x62\x50\x44\x30\x3d','\x45\x55\x2f\x44\x6f\x45\x6e\x43\x74\x63\x4b\x4a\x77\x70\x46\x59','\x59\x45\x4e\x76\x77\x70\x6a\x43\x72\x79\x55\x3d','\x77\x35\x2f\x43\x6b\x6c\x73\x6e\x77\x70\x4a\x2b\x77\x6f\x73\x6b','\x4d\x41\x55\x69\x4b\x6d\x5a\x63\x77\x6f\x34\x3d','\x52\x58\x54\x44\x6b\x73\x4b\x73\x77\x37\x5a\x48\x77\x71\x45\x31','\x77\x72\x6e\x43\x75\x73\x4f\x35\x5a\x30\x4e\x53','\x4b\x6a\x48\x44\x6c\x33\x6a\x44\x67\x46\x72\x44\x70\x77\x3d\x3d','\x44\x48\x72\x44\x68\x7a\x44\x44\x72\x4d\x4f\x50\x77\x71\x5a\x38','\x5a\x4d\x4f\x31\x77\x71\x2f\x43\x67\x79\x49\x5a\x62\x67\x3d\x3d','\x77\x6f\x6a\x43\x76\x68\x7a\x43\x6c\x6b\x64\x58\x77\x72\x6a\x43\x74\x41\x3d\x3d','\x77\x71\x6f\x34\x56\x63\x4b\x49\x56\x67\x3d\x3d','\x51\x4d\x4f\x57\x77\x70\x37\x43\x68\x67\x6f\x3d','\x77\x37\x45\x7a\x56\x53\x70\x72','\x58\x4d\x4b\x2b\x77\x36\x4d\x70\x58\x41\x3d\x3d','\x77\x36\x6b\x38\x63\x67\x33\x44\x71\x41\x3d\x3d','\x51\x47\x46\x70\x77\x71\x48\x44\x72\x51\x3d\x3d','\x41\x67\x44\x43\x73\x32\x48\x43\x6f\x41\x62\x44\x73\x43\x63\x3d','\x49\x55\x41\x76\x77\x71\x6e\x44\x73\x6b\x59\x46','\x47\x32\x63\x6f\x77\x71\x50\x44\x6f\x6d\x30\x51\x77\x70\x45\x54\x48\x41\x3d\x3d','\x55\x63\x4b\x32\x47\x63\x4f\x61\x77\x36\x6b\x4e\x45\x63\x4f\x50\x77\x71\x73\x71\x59\x45\x74\x33\x48\x67\x3d\x3d','\x56\x63\x4f\x4b\x77\x36\x39\x5a\x45\x67\x3d\x3d','\x77\x70\x74\x73\x44\x38\x4b\x72\x77\x35\x38\x38\x77\x36\x77\x52','\x54\x58\x35\x65\x77\x71\x66\x44\x72\x47\x64\x72','\x77\x35\x6c\x57\x54\x6e\x56\x2f\x77\x34\x77\x3d','\x56\x54\x37\x44\x76\x4d\x4f\x73\x77\x34\x50\x43\x72\x63\x4f\x4f\x41\x63\x4b\x7a\x77\x71\x39\x46','\x77\x70\x51\x46\x53\x4d\x4f\x37\x77\x35\x63\x34\x54\x51\x3d\x3d','\x77\x35\x72\x44\x69\x38\x4f\x54\x46\x38\x4f\x4b\x62\x73\x4f\x52\x47\x33\x55\x62\x77\x72\x67\x51\x4f\x51\x4c\x44\x6c\x41\x3d\x3d','\x66\x38\x4f\x78\x77\x34\x4e\x42\x50\x63\x4b\x2b\x4c\x53\x6b\x4e\x77\x71\x62\x44\x6d\x52\x78\x4e\x77\x37\x66\x44\x6b\x51\x3d\x3d','\x77\x71\x76\x43\x74\x4d\x4f\x72\x52\x41\x67\x3d','\x77\x70\x64\x36\x44\x4d\x4b\x77\x77\x34\x77\x6d\x77\x37\x77\x3d','\x77\x34\x6a\x43\x67\x6c\x38\x76\x77\x6f\x35\x70\x77\x72\x6f\x76\x77\x37\x52\x4d\x4c\x45\x64\x6b\x77\x71\x73\x3d','\x77\x72\x7a\x44\x6a\x38\x4b\x49\x4c\x38\x4b\x2f\x65\x38\x4f\x76','\x77\x70\x6c\x74\x65\x73\x4b\x33\x47\x73\x4f\x47\x77\x36\x45\x33\x48\x4d\x4b\x48\x4f\x48\x6b\x3d','\x77\x34\x6c\x7a\x77\x70\x62\x43\x74\x63\x4f\x6e','\x77\x6f\x38\x35\x61\x63\x4b\x56\x53\x41\x3d\x3d','\x77\x6f\x74\x4f\x45\x73\x4b\x6c\x77\x36\x34\x3d','\x77\x70\x35\x4d\x49\x63\x4f\x75\x77\x72\x73\x3d','\x77\x34\x4d\x54\x57\x7a\x6a\x44\x76\x41\x3d\x3d','\x77\x6f\x4c\x43\x6c\x73\x4f\x66\x57\x51\x3d\x3d','\x44\x48\x2f\x44\x6e\x44\x58\x44\x75\x38\x4f\x50','\x5a\x77\x6e\x44\x69\x63\x4f\x4f\x77\x36\x2f\x43\x6e\x63\x4f\x30\x44\x73\x4b\x56\x77\x6f\x74\x6a\x47\x6d\x63\x46','\x77\x37\x37\x43\x6a\x38\x4f\x75\x77\x6f\x38\x76\x66\x32\x34\x48\x45\x6d\x37\x43\x70\x73\x4b\x46\x47\x67\x48\x43\x74\x67\x3d\x3d','\x49\x6b\x6f\x77\x77\x71\x76\x44\x6e\x31\x67\x46','\x42\x55\x76\x44\x73\x48\x37\x43\x6c\x77\x3d\x3d','\x77\x6f\x2f\x43\x71\x38\x4f\x59','\x77\x6f\x62\x44\x76\x73\x4f\x37\x57\x73\x4b\x59\x77\x6f\x6e\x44\x6c\x46\x4d\x7a\x77\x72\x54\x43\x70\x55\x48\x44\x68\x4d\x4b\x6b','\x77\x36\x78\x44\x77\x6f\x67\x3d','\x77\x35\x45\x6e\x77\x37\x44\x44\x75\x6d\x50\x43\x6b\x63\x4f\x5a\x77\x35\x59\x2b\x59\x73\x4f\x2b\x4b\x47\x73\x55','\x77\x35\x6c\x2f\x77\x71\x38\x77\x77\x70\x38\x3d','\x77\x71\x2f\x44\x68\x4d\x4f\x7a\x56\x38\x4b\x4e','\x77\x71\x68\x50\x49\x4d\x4f\x45\x77\x6f\x34\x3d','\x77\x70\x4e\x36\x44\x63\x4f\x39\x77\x71\x2f\x44\x69\x63\x4f\x6a','\x5a\x4d\x4f\x31\x77\x71\x2f\x43\x67\x31\x77\x3d','\x77\x70\x33\x44\x72\x38\x4f\x2b\x58\x63\x4f\x75\x77\x37\x6b\x3d','\x77\x70\x33\x44\x72\x38\x4f\x2b\x58\x63\x4f\x73\x77\x37\x30\x3d','\x4b\x6e\x2f\x44\x67\x33\x6a\x43\x67\x63\x4f\x49\x77\x34\x49\x3d','\x77\x70\x67\x54\x53\x38\x4f\x67\x77\x34\x51\x69\x58\x63\x4f\x4f','\x48\x54\x67\x54\x46\x55\x45\x62\x77\x34\x38\x3d','\x45\x63\x4f\x59\x47\x38\x4b\x64\x77\x36\x41\x70\x77\x34\x6b\x3d','\x77\x37\x67\x77\x77\x34\x50\x44\x6b\x6c\x6b\x3d','\x77\x70\x54\x44\x68\x63\x4b\x74\x41\x63\x4b\x5a','\x77\x37\x35\x63\x77\x70\x63\x35\x77\x72\x62\x43\x68\x30\x49\x3d','\x77\x70\x33\x43\x6b\x4d\x4f\x62\x56\x67\x51\x4a\x77\x34\x50\x43\x71\x51\x3d\x3d','\x57\x4d\x4f\x64\x77\x70\x34\x3d','\x77\x72\x50\x44\x6d\x4d\x4f\x51\x59\x4d\x4b\x43\x77\x71\x48\x44\x75\x41\x3d\x3d','\x77\x72\x72\x44\x76\x38\x4f\x62\x62\x4d\x4b\x38','\x77\x35\x49\x6c\x64\x52\x6a\x44\x74\x51\x3d\x3d','\x77\x72\x77\x4b\x77\x70\x58\x44\x6b\x38\x4f\x63\x4f\x6c\x4a\x35\x63\x73\x4b\x66\x77\x37\x52\x35\x55\x58\x59\x6f\x4c\x79\x37\x43\x6d\x63\x4b\x46\x77\x37\x49\x3d','\x53\x48\x6a\x44\x6f\x4d\x4f\x65\x77\x34\x2f\x44\x72\x69\x66\x44\x6e\x58\x77\x2f\x58\x6c\x50\x43\x6d\x63\x4f\x44','\x66\x56\x37\x44\x69\x38\x4f\x6b\x77\x35\x58\x44\x68\x67\x73\x3d','\x77\x72\x52\x4e\x4a\x63\x4f\x4b\x77\x70\x50\x43\x6c\x67\x3d\x3d','\x63\x6b\x78\x2b\x77\x70\x2f\x44\x6a\x77\x3d\x3d','\x4d\x7a\x68\x47\x4b\x63\x4b\x6b','\x77\x34\x45\x74\x77\x34\x6e\x44\x75\x58\x34\x3d','\x58\x6d\x37\x44\x67\x38\x4b\x35','\x77\x72\x56\x58\x65\x51\x3d\x3d','\x77\x70\x66\x43\x69\x73\x4f\x67\x65\x43\x51\x3d','\x41\x63\x4f\x51\x77\x70\x62\x43\x6a\x58\x59\x3d','\x4d\x4d\x4f\x7a\x4b\x63\x4b\x35\x77\x34\x64\x78\x77\x70\x37\x43\x6d\x77\x3d\x3d','\x58\x47\x6c\x78\x77\x71\x4c\x44\x72\x51\x3d\x3d','\x77\x36\x58\x43\x75\x6b\x4e\x45\x77\x35\x52\x6d\x65\x41\x3d\x3d','\x63\x4d\x4b\x57\x77\x37\x30\x6e\x63\x77\x3d\x3d','\x5a\x4d\x4f\x58\x77\x71\x44\x43\x76\x6a\x34\x3d','\x77\x6f\x62\x44\x69\x63\x4b\x37\x5a\x47\x59\x3d','\x77\x35\x55\x79\x61\x78\x4a\x66','\x62\x73\x4b\x77\x77\x36\x55\x48\x66\x51\x3d\x3d','\x77\x6f\x4c\x44\x6c\x38\x4b\x38\x57\x33\x63\x3d','\x56\x6c\x76\x43\x6b\x38\x4f\x4a\x46\x73\x4b\x52\x64\x41\x3d\x3d','\x77\x70\x2f\x44\x70\x4d\x4b\x38\x41\x38\x4b\x45','\x77\x6f\x67\x76\x77\x71\x48\x44\x6f\x38\x4f\x50','\x65\x47\x7a\x43\x76\x63\x4f\x30\x48\x4d\x4f\x44','\x77\x35\x6c\x54\x56\x58\x42\x6f\x77\x34\x77\x54\x4f\x67\x3d\x3d','\x77\x36\x6a\x43\x70\x6e\x49\x49\x77\x71\x51\x3d','\x50\x30\x72\x44\x6d\x7a\x4c\x44\x6c\x73\x4f\x35\x5a\x73\x4b\x53','\x77\x71\x68\x64\x59\x38\x4b\x5a\x4d\x51\x3d\x3d','\x52\x6d\x6c\x41\x77\x6f\x50\x44\x6c\x77\x3d\x3d','\x77\x34\x6e\x43\x6a\x67\x4d\x3d','\x77\x34\x46\x6e\x59\x58\x70\x54','\x58\x57\x44\x44\x6c\x73\x4f\x6f\x77\x34\x67\x3d','\x77\x37\x49\x35\x63\x42\x35\x6f','\x55\x30\x6b\x56\x49\x4d\x4f\x78','\x77\x71\x42\x41\x59\x73\x4b\x2f\x4a\x38\x4f\x7a\x77\x37\x38\x3d','\x77\x6f\x59\x74\x61\x38\x4b\x76\x56\x41\x3d\x3d','\x43\x41\x62\x43\x71\x58\x6e\x43\x70\x53\x62\x44\x76\x43\x59\x47\x77\x6f\x49\x3d','\x77\x71\x67\x5a\x53\x73\x4b\x48\x66\x77\x3d\x3d','\x58\x55\x70\x6d\x77\x70\x72\x44\x71\x77\x3d\x3d','\x77\x72\x41\x4c\x58\x63\x4b\x58\x59\x38\x4b\x48\x4a\x63\x4f\x6c\x55\x77\x70\x49\x77\x37\x6b\x53\x46\x67\x3d\x3d','\x65\x38\x4f\x73\x77\x37\x6c\x62\x4c\x77\x3d\x3d','\x55\x69\x2f\x44\x6f\x73\x4f\x30\x77\x37\x58\x43\x74\x63\x4f\x59','\x4a\x6c\x63\x37\x77\x72\x38\x3d','\x4a\x73\x4f\x62\x77\x72\x44\x43\x70\x58\x62\x43\x6a\x68\x4c\x44\x69\x45\x42\x4f\x46\x63\x4f\x50\x5a\x73\x4f\x62\x77\x72\x54\x43\x6d\x73\x4b\x33\x41\x51\x3d\x3d','\x77\x72\x6b\x5a\x77\x6f\x58\x44\x74\x63\x4f\x36','\x77\x34\x4e\x4b\x77\x72\x44\x43\x70\x63\x4f\x78','\x4c\x63\x4f\x54\x66\x63\x4b\x68\x47\x67\x3d\x3d','\x77\x70\x31\x7a\x50\x73\x4f\x4d\x77\x72\x67\x3d','\x77\x34\x54\x44\x6d\x4d\x4f\x62\x41\x67\x3d\x3d','\x77\x35\x62\x43\x68\x42\x62\x43\x6f\x73\x4b\x53\x62\x44\x42\x73\x57\x63\x4f\x55\x77\x71\x62\x43\x71\x47\x56\x42\x77\x6f\x77\x3d','\x46\x68\x76\x44\x69\x55\x4c\x44\x74\x51\x3d\x3d','\x77\x70\x52\x77\x45\x38\x4b\x79\x77\x36\x45\x34\x77\x37\x77\x3d','\x51\x44\x4c\x44\x6b\x73\x4f\x7a\x77\x35\x6b\x3d','\x77\x37\x34\x59\x66\x67\x62\x44\x6f\x43\x67\x4f\x77\x6f\x34\x3d','\x77\x36\x56\x6a\x77\x70\x33\x43\x6b\x63\x4f\x64','\x77\x34\x44\x43\x68\x79\x62\x43\x75\x4d\x4b\x47','\x77\x71\x46\x57\x4f\x4d\x4b\x49\x77\x37\x73\x51\x77\x35\x41\x6b\x46\x4d\x4b\x37\x56\x63\x4f\x71\x4d\x51\x4d\x3d','\x45\x43\x6c\x66\x45\x63\x4b\x75\x77\x72\x52\x44','\x77\x37\x49\x50\x61\x52\x48\x44\x6a\x67\x3d\x3d','\x77\x36\x41\x53\x57\x52\x62\x44\x6f\x6c\x63\x6e','\x43\x32\x44\x44\x75\x6a\x76\x44\x72\x51\x3d\x3d','\x58\x63\x4b\x56\x42\x73\x4f\x31\x77\x37\x34\x3d','\x77\x36\x78\x42\x77\x71\x63\x2b\x77\x70\x6f\x3d','\x77\x71\x76\x43\x67\x43\x6a\x43\x68\x73\x4f\x54\x77\x36\x4a\x57','\x77\x71\x73\x49\x77\x6f\x6a\x44\x6b\x38\x4f\x51','\x54\x6c\x72\x44\x72\x73\x4f\x46\x77\x36\x49\x3d','\x77\x72\x45\x52\x77\x71\x50\x44\x6b\x73\x4f\x2f','\x77\x37\x6e\x44\x72\x63\x4f\x79\x4d\x4d\x4f\x75\x58\x73\x4f\x72\x46\x45\x59\x38\x77\x70\x63\x4f\x44\x44\x55\x3d','\x77\x71\x58\x44\x72\x4d\x4b\x6e\x5a\x6b\x46\x30\x77\x37\x4c\x43\x74\x38\x4b\x45\x77\x34\x56\x42\x66\x33\x4c\x43\x6e\x51\x3d\x3d','\x77\x37\x73\x6e\x53\x68\x4a\x61\x47\x33\x63\x3d','\x77\x71\x6b\x47\x77\x72\x76\x44\x6a\x4d\x4f\x47','\x77\x70\x50\x43\x75\x52\x76\x43\x6b\x51\x3d\x3d','\x77\x35\x37\x44\x6c\x73\x4f\x70\x44\x63\x4f\x59','\x48\x52\x64\x49\x4e\x73\x4b\x47','\x63\x33\x6e\x43\x6d\x38\x4f\x57\x4f\x77\x3d\x3d','\x77\x71\x50\x44\x6a\x73\x4b\x70\x66\x57\x77\x3d','\x77\x35\x6f\x6e\x55\x7a\x4a\x50','\x77\x70\x37\x44\x68\x63\x4b\x4f\x44\x63\x4b\x48','\x77\x71\x6c\x61\x4b\x38\x4f\x45\x77\x6f\x6e\x43\x6a\x4d\x4b\x77\x77\x35\x50\x43\x72\x73\x4b\x44\x77\x72\x48\x43\x75\x6e\x55\x62\x53\x41\x4c\x43\x6d\x6e\x4d\x3d','\x5a\x4d\x4f\x31\x77\x71\x2f\x43\x67\x7a\x45\x58','\x77\x6f\x51\x77\x77\x71\x44\x44\x6f\x38\x4f\x68','\x46\x73\x4b\x32\x50\x4d\x4b\x47\x77\x37\x45\x3d','\x4c\x63\x4f\x73\x5a\x38\x4b\x66\x41\x51\x3d\x3d','\x77\x6f\x73\x77\x61\x73\x4b\x30\x53\x4d\x4b\x6b\x46\x38\x4f\x51','\x77\x6f\x68\x63\x5a\x73\x4b\x69\x4f\x77\x3d\x3d','\x4e\x32\x72\x44\x72\x55\x58\x43\x71\x51\x3d\x3d','\x4d\x41\x51\x54\x45\x48\x38\x3d','\x77\x37\x66\x43\x70\x33\x4e\x44\x77\x37\x67\x3d','\x77\x34\x39\x49\x77\x72\x54\x43\x6b\x41\x3d\x3d','\x77\x6f\x34\x50\x62\x63\x4b\x4f\x51\x41\x3d\x3d','\x77\x34\x66\x44\x71\x63\x4f\x43\x4b\x63\x4f\x4e','\x77\x6f\x2f\x43\x71\x63\x4f\x33\x77\x71\x77\x65','\x77\x72\x41\x57\x58\x63\x4f\x6a\x77\x36\x4d\x3d','\x77\x6f\x73\x75\x55\x4d\x4b\x4f\x5a\x77\x3d\x3d','\x43\x42\x2f\x43\x6f\x58\x62\x43\x67\x41\x3d\x3d','\x53\x33\x64\x50\x77\x71\x76\x44\x6e\x77\x3d\x3d','\x4b\x55\x72\x44\x6d\x79\x76\x44\x70\x73\x4f\x77\x65\x67\x3d\x3d','\x77\x36\x30\x30\x55\x52\x64\x72\x45\x47\x6e\x43\x6e\x67\x3d\x3d','\x77\x36\x74\x36\x77\x70\x51\x3d','\x77\x36\x6b\x36\x65\x68\x56\x32','\x77\x36\x6f\x63\x62\x41\x66\x44\x6f\x43\x77\x7a\x77\x70\x6b\x58\x77\x6f\x4a\x47\x43\x6c\x77\x32','\x77\x34\x48\x43\x68\x41\x4c\x43\x6f\x73\x4b\x64\x5a\x51\x6c\x6b\x55\x38\x4f\x37\x77\x71\x4c\x43\x71\x47\x4e\x5a','\x46\x38\x4f\x33\x77\x70\x66\x43\x6a\x6d\x49\x3d','\x65\x48\x6b\x39\x4c\x38\x4f\x67\x77\x35\x39\x2f\x48\x52\x33\x43\x6f\x4d\x4b\x43\x77\x72\x73\x3d','\x77\x34\x37\x44\x6e\x4d\x4f\x51\x44\x73\x4f\x46\x65\x63\x4f\x6b\x4e\x6e\x73\x46\x77\x71\x51\x39\x4c\x41\x6b\x3d','\x77\x71\x4a\x45\x48\x63\x4b\x77\x77\x37\x51\x3d','\x61\x38\x4f\x6d\x77\x34\x42\x59\x4d\x73\x4b\x70\x47\x41\x51\x44\x77\x72\x6a\x44\x68\x54\x46\x59\x77\x37\x77\x3d','\x52\x63\x4f\x65\x77\x70\x33\x43\x70\x77\x56\x42\x4f\x58\x6b\x3d','\x57\x38\x4b\x41\x66\x4d\x4b\x44\x77\x35\x76\x43\x70\x38\x4f\x6f\x77\x71\x64\x71\x47\x63\x4b\x4e\x45\x41\x6c\x4f\x66\x52\x44\x43\x72\x45\x38\x69\x77\x70\x6e\x43\x72\x38\x4f\x65\x63\x57\x73\x55','\x45\x79\x4e\x41\x45\x38\x4b\x44\x77\x71\x70\x44','\x77\x70\x62\x44\x75\x4d\x4b\x51\x44\x4d\x4b\x39','\x77\x6f\x4c\x43\x76\x53\x2f\x43\x70\x38\x4f\x38','\x53\x38\x4b\x78\x77\x35\x59\x62\x57\x4d\x4f\x38\x77\x70\x42\x73\x77\x36\x66\x44\x6f\x53\x63\x3d','\x63\x6b\x4c\x44\x6c\x38\x4f\x39\x77\x36\x76\x44\x67\x68\x76\x44\x71\x41\x3d\x3d','\x55\x53\x58\x44\x76\x63\x4f\x32\x77\x35\x6a\x43\x71\x38\x4f\x59','\x77\x35\x2f\x43\x6c\x30\x41\x69\x77\x6f\x56\x2b','\x52\x43\x2f\x44\x71\x4d\x4f\x70\x77\x34\x76\x43\x72\x63\x4f\x4f\x41\x63\x4b\x6d\x77\x71\x78\x4d\x42\x46\x49\x79\x77\x34\x51\x3d','\x77\x71\x78\x79\x46\x4d\x4f\x63\x77\x70\x4d\x3d','\x77\x72\x78\x4b\x58\x38\x4b\x6a\x48\x77\x3d\x3d','\x77\x72\x67\x52\x77\x70\x54\x44\x69\x63\x4f\x48\x50\x45\x51\x3d','\x47\x67\x7a\x44\x72\x6c\x44\x44\x76\x68\x48\x43\x72\x63\x4b\x73\x77\x6f\x68\x65\x77\x35\x48\x43\x73\x38\x4b\x50\x77\x72\x34\x2b\x4d\x38\x4f\x6b\x43\x73\x4b\x4d\x4e\x58\x52\x75\x45\x33\x4e\x6d\x59\x78\x34\x7a\x4f\x73\x4f\x67\x51\x58\x33\x44\x6d\x32\x77\x79\x49\x41\x3d\x3d','\x77\x6f\x6e\x43\x72\x67\x37\x43\x6d\x31\x52\x47\x77\x72\x77\x3d','\x77\x37\x73\x49\x51\x53\x33\x44\x70\x41\x3d\x3d','\x52\x4d\x4f\x6d\x77\x35\x56\x36\x50\x77\x3d\x3d','\x77\x70\x58\x44\x73\x73\x4b\x73\x4a\x73\x4b\x4f','\x77\x37\x4a\x4f\x50\x4d\x4b\x75\x53\x38\x4f\x6c\x77\x72\x77\x71\x52\x63\x4b\x58\x59\x47\x62\x44\x6c\x53\x6e\x44\x6c\x38\x4b\x30\x52\x47\x4a\x6d\x41\x63\x4b\x38\x77\x36\x6a\x44\x6d\x33\x63\x4d\x77\x71\x41\x4b\x77\x6f\x63\x3d','\x77\x34\x4c\x43\x74\x4d\x4f\x64\x77\x72\x6f\x52\x54\x31\x34\x4f\x4f\x6b\x51\x3d','\x77\x71\x34\x5a\x77\x6f\x6a\x44\x6a\x38\x4f\x42','\x77\x70\x41\x50\x58\x63\x4f\x31\x77\x37\x6f\x6c\x57\x67\x3d\x3d','\x52\x6d\x44\x44\x67\x73\x4b\x6f\x77\x36\x70\x42\x77\x70\x38\x74\x53\x73\x4f\x79\x59\x43\x58\x44\x74\x58\x77\x3d','\x41\x67\x44\x43\x70\x6e\x6f\x3d','\x77\x34\x39\x55\x52\x58\x35\x6f','\x50\x31\x6e\x44\x68\x69\x50\x44\x6c\x38\x4f\x75\x56\x73\x4b\x66\x77\x36\x70\x59\x53\x38\x4f\x33\x65\x6e\x73\x3d','\x77\x34\x48\x43\x67\x6c\x30\x6e\x77\x6f\x77\x3d','\x43\x7a\x51\x43\x43\x45\x63\x71\x77\x35\x4c\x43\x68\x63\x4b\x6c\x77\x36\x51\x3d','\x77\x72\x76\x44\x67\x73\x4b\x4f\x4b\x63\x4b\x70','\x77\x6f\x6e\x43\x71\x63\x4f\x48\x77\x71\x73\x79\x4a\x6e\x6f\x3d','\x4c\x57\x33\x44\x72\x52\x76\x44\x72\x51\x3d\x3d','\x44\x46\x76\x44\x74\x45\x48\x43\x6f\x4d\x4b\x61\x77\x6f\x52\x4f\x77\x72\x51\x3d','\x77\x6f\x49\x4a\x57\x63\x4f\x6d\x77\x35\x45\x4a\x55\x4d\x4f\x66\x57\x38\x4f\x65','\x77\x6f\x66\x43\x68\x73\x4f\x2b\x52\x77\x45\x3d','\x77\x35\x64\x49\x77\x72\x37\x43\x6c\x63\x4f\x62\x58\x63\x4f\x7a','\x77\x35\x58\x43\x67\x42\x62\x43\x72\x73\x4b\x64\x64\x41\x5a\x33\x54\x73\x4f\x75\x77\x71\x62\x43\x68\x58\x35\x45','\x42\x54\x35\x42','\x46\x43\x35\x47\x46\x63\x4b\x56','\x77\x6f\x37\x43\x76\x68\x66\x43\x6b\x77\x3d\x3d','\x45\x54\x35\x45\x4b\x4d\x4b\x59\x77\x72\x4e\x56','\x52\x45\x6b\x6b\x50\x4d\x4f\x6e\x77\x37\x4a\x6d','\x77\x72\x6e\x43\x6d\x73\x4f\x5a\x52\x51\x51\x6e\x77\x34\x58\x43\x6f\x55\x73\x3d','\x77\x34\x6e\x43\x69\x55\x30\x6a\x77\x70\x49\x3d','\x62\x38\x4b\x76\x77\x34\x63\x54\x56\x6a\x42\x42','\x62\x4d\x4f\x73\x77\x34\x4a\x55','\x59\x55\x58\x44\x67\x4d\x4f\x42\x77\x35\x6f\x3d','\x50\x77\x62\x43\x69\x30\x50\x43\x6b\x77\x3d\x3d','\x4b\x73\x4f\x74\x4e\x73\x4b\x6b\x77\x35\x49\x3d','\x77\x36\x62\x43\x76\x46\x38\x3d','\x66\x30\x33\x44\x6b\x4d\x4f\x6f','\x51\x6d\x6a\x44\x6e\x63\x4b\x6f\x77\x37\x64\x42\x77\x71\x45\x68\x53\x41\x3d\x3d','\x77\x34\x68\x44\x57\x58\x4a\x79\x77\x35\x4d\x54\x4d\x55\x77\x3d','\x77\x72\x6b\x49\x77\x70\x44\x44\x68\x77\x3d\x3d','\x57\x45\x7a\x43\x6e\x63\x4f\x57\x50\x63\x4b\x5a\x59\x73\x4f\x6a\x4e\x63\x4f\x62\x48\x52\x76\x43\x6a\x47\x4c\x43\x71\x63\x4f\x71\x46\x63\x4f\x71','\x56\x45\x4d\x70\x4f\x4d\x4f\x6e\x77\x37\x52\x4e\x44\x67\x54\x43\x6f\x4d\x4b\x49','\x4a\x73\x4f\x66\x77\x71\x66\x43\x74\x67\x3d\x3d','\x4d\x63\x4f\x62\x77\x72\x44\x43\x70\x58\x62\x43\x6c\x79\x6a\x44\x6c\x45\x46\x39\x41\x67\x3d\x3d','\x48\x47\x7a\x44\x73\x42\x48\x44\x76\x4d\x4f\x59\x56\x73\x4b\x75\x77\x34\x70\x30\x66\x4d\x4f\x70\x52\x31\x6f\x3d','\x57\x4d\x4f\x66\x77\x72\x48\x43\x75\x52\x63\x3d','\x77\x6f\x72\x44\x6f\x38\x4b\x38\x46\x38\x4b\x49\x54\x63\x4f\x44\x4e\x55\x33\x44\x6f\x73\x4b\x79\x63\x7a\x78\x69','\x57\x48\x52\x42\x77\x72\x7a\x44\x73\x58\x42\x33\x77\x70\x41\x3d','\x77\x37\x38\x74\x5a\x53\x58\x44\x70\x77\x3d\x3d','\x77\x37\x72\x43\x6c\x4d\x4f\x6d\x77\x70\x6f\x3d','\x77\x72\x7a\x44\x68\x63\x4b\x4b\x4c\x38\x4b\x2f','\x77\x72\x72\x43\x76\x4d\x4f\x70\x63\x69\x67\x3d','\x77\x37\x62\x43\x69\x54\x48\x43\x71\x73\x4b\x45','\x77\x72\x5a\x41\x59\x73\x4b\x78\x48\x63\x4f\x71\x77\x37\x38\x3d','\x41\x55\x49\x2b\x77\x71\x54\x44\x6d\x51\x3d\x3d','\x77\x37\x37\x43\x6e\x4d\x4f\x35\x77\x70\x6f\x67\x65\x56\x51\x35\x41\x57\x58\x43\x76\x73\x4b\x46\x45\x68\x63\x3d','\x77\x70\x4e\x77\x47\x63\x4b\x2b\x77\x36\x45\x37\x77\x36\x73\x3d','\x62\x73\x4b\x6c\x77\x35\x6b\x3d','\x4b\x38\x4f\x79\x4e\x63\x4b\x67\x77\x37\x6c\x32\x77\x70\x6b\x3d','\x77\x35\x63\x6e\x77\x37\x6a\x44\x73\x47\x58\x43\x6d\x63\x4f\x6f\x77\x35\x59\x36','\x4d\x38\x4f\x70\x55\x73\x4b\x4a','\x56\x30\x7a\x43\x69\x4d\x4f\x77\x49\x4d\x4b\x57\x59\x67\x3d\x3d','\x55\x30\x62\x43\x6b\x73\x4f\x53\x4c\x4d\x4b\x4a\x63\x77\x3d\x3d','\x77\x37\x55\x4a\x55\x52\x55\x3d','\x45\x56\x2f\x44\x6f\x56\x72\x43\x6f\x73\x4b\x50\x77\x71\x39\x54\x77\x72\x50\x44\x76\x54\x6b\x3d','\x49\x77\x76\x43\x6f\x57\x66\x43\x74\x53\x2f\x44\x75\x69\x51\x58','\x77\x36\x62\x43\x6d\x4d\x4f\x71\x77\x6f\x30\x36','\x77\x70\x45\x77\x64\x73\x4b\x74\x65\x63\x4b\x73\x48\x67\x3d\x3d','\x77\x34\x49\x44\x77\x35\x72\x44\x6f\x6d\x55\x3d','\x66\x73\x4b\x76\x77\x34\x77\x62','\x77\x71\x48\x43\x6e\x53\x41\x3d','\x35\x6f\x6d\x53\x35\x59\x69\x68\x36\x4b\x53\x31\x35\x59\x79\x47\x53\x41\x3d\x3d','\x77\x70\x62\x43\x6f\x38\x4f\x4d\x77\x71\x63\x42','\x4b\x73\x4f\x6c\x57\x38\x4b\x4e\x47\x67\x4a\x65\x64\x55\x49\x3d','\x77\x37\x72\x6d\x69\x49\x58\x70\x6c\x4b\x58\x43\x72\x51\x3d\x3d','\x57\x4d\x4b\x39\x77\x34\x67\x44\x62\x73\x4f\x6e\x77\x70\x45\x3d','\x4b\x2b\x65\x62\x6e\x2b\x57\x77\x76\x2b\x57\x2b\x76\x2b\x57\x38\x73\x67\x3d\x3d','\x77\x36\x6b\x36\x55\x52\x35\x70','\x4e\x4d\x4f\x6c\x54\x67\x3d\x3d','\x65\x63\x4b\x68\x77\x35\x77\x66','\x77\x72\x48\x44\x6b\x73\x4b\x5a\x4d\x73\x4b\x35\x62\x63\x4f\x35\x42\x47\x76\x44\x74\x4d\x4b\x4e\x58\x42\x78\x43\x77\x35\x46\x78\x5a\x38\x4f\x67','\x77\x37\x38\x77\x53\x78\x78\x74\x48\x47\x58\x43\x69\x53\x49\x3d','\x77\x72\x37\x43\x6c\x79\x54\x43\x6d\x63\x4f\x70\x77\x37\x78\x36\x43\x38\x4b\x78\x77\x70\x49\x3d','\x77\x34\x6e\x43\x6b\x30\x6f\x3d','\x47\x32\x37\x44\x6b\x54\x41\x3d','\x77\x37\x66\x43\x6f\x55\x46\x4d\x77\x37\x68\x34\x61\x6d\x48\x44\x67\x77\x3d\x3d','\x77\x6f\x49\x59\x57\x38\x4f\x6d\x77\x34\x41\x34\x59\x63\x4f\x5a\x53\x38\x4f\x41\x47\x41\x3d\x3d','\x77\x72\x56\x58\x62\x73\x4b\x67\x48\x63\x4f\x74\x77\x35\x4d\x6b\x42\x63\x4b\x48\x4d\x67\x3d\x3d','\x55\x30\x6b\x2b\x4b\x38\x4f\x75','\x77\x35\x67\x6a\x77\x36\x34\x3d','\x43\x4d\x4f\x47\x53\x4d\x4b\x65\x4f\x67\x3d\x3d','\x77\x36\x76\x43\x72\x55\x31\x62\x77\x37\x39\x63\x65\x57\x50\x44\x6b\x44\x48\x44\x70\x6a\x77\x3d','\x4a\x6e\x50\x44\x70\x6c\x48\x43\x6c\x51\x3d\x3d','\x55\x54\x50\x44\x72\x4d\x4f\x67\x77\x36\x51\x3d','\x77\x70\x77\x75\x54\x38\x4f\x36\x77\x36\x6b\x3d','\x77\x35\x7a\x43\x6c\x56\x59\x6c\x77\x6f\x56\x2f\x77\x70\x6b\x3d','\x77\x34\x74\x56\x77\x72\x59\x3d','\x77\x6f\x62\x44\x69\x73\x4b\x4d\x55\x6d\x46\x46\x77\x35\x34\x3d','\x77\x35\x4a\x48\x77\x70\x51\x42\x77\x71\x73\x3d','\x44\x58\x72\x44\x69\x77\x3d\x3d','\x77\x34\x2f\x44\x69\x38\x4f\x45\x43\x4d\x4f\x5a','\x65\x56\x54\x44\x69\x63\x4f\x35\x77\x36\x77\x3d','\x77\x37\x42\x4c\x77\x70\x6b\x6d\x77\x70\x33\x43\x76\x55\x4d\x44\x52\x6d\x44\x44\x72\x32\x51\x3d','\x77\x72\x50\x43\x71\x51\x72\x43\x74\x47\x30\x3d','\x4f\x46\x6e\x44\x6c\x42\x72\x44\x68\x41\x3d\x3d','\x77\x72\x55\x64\x77\x70\x44\x44\x6c\x73\x4f\x47\x63\x68\x67\x4a\x63\x63\x4f\x63\x77\x6f\x56\x6a\x55\x47\x4d\x68\x50\x32\x58\x43\x6c\x4d\x4b\x4a\x77\x37\x72\x44\x75\x32\x67\x4f\x77\x37\x30\x31\x77\x34\x76\x43\x75\x31\x72\x43\x69\x45\x59\x73\x63\x44\x66\x43\x6b\x43\x4c\x44\x6f\x73\x4b\x47\x51\x33\x6e\x43\x6b\x38\x4f\x4a\x77\x72\x68\x54\x77\x72\x62\x44\x67\x38\x4f\x45\x59\x73\x4f\x44\x77\x35\x34\x6b\x77\x37\x48\x43\x6a\x55\x55\x51\x77\x36\x52\x38\x42\x55\x62\x44\x71\x73\x4b\x47\x46\x38\x4b\x55\x77\x6f\x64\x46\x77\x35\x37\x43\x6c\x4d\x4b\x63\x77\x70\x34\x5a\x77\x37\x70\x36\x47\x63\x4b\x4f\x55\x58\x73\x3d','\x4f\x46\x48\x44\x6a\x52\x58\x44\x67\x51\x3d\x3d','\x77\x34\x72\x43\x6b\x4d\x4f\x54\x77\x71\x30\x67','\x35\x62\x47\x49\x35\x62\x32\x44\x35\x62\x2b\x38\x35\x71\x75\x4e\x35\x5a\x79\x68\x35\x37\x71\x64\x35\x61\x36\x6c\x35\x61\x53\x70\x36\x4c\x53\x43\x37\x37\x32\x63\x35\x70\x61\x56\x35\x72\x4f\x50\x35\x4c\x79\x4a\x35\x35\x61\x72','\x77\x37\x73\x6a\x77\x37\x66\x44\x6e\x6b\x59\x3d','\x77\x35\x42\x55\x77\x6f\x74\x38\x47\x51\x3d\x3d','\x77\x35\x58\x43\x6b\x77\x76\x43\x71\x4d\x4b\x57\x63\x79\x6f\x3d','\x77\x36\x31\x69\x77\x72\x4d\x4f\x77\x71\x77\x3d','\x63\x4d\x4b\x77\x59\x63\x4b\x4d\x77\x35\x4d\x3d','\x44\x33\x33\x44\x69\x6a\x4c\x44\x75\x38\x4f\x4f\x77\x72\x51\x3d','\x4e\x45\x6e\x44\x70\x45\x6e\x43\x71\x51\x3d\x3d','\x53\x6d\x39\x41\x77\x71\x7a\x44\x69\x58\x4a\x72\x77\x70\x45\x3d','\x49\x73\x4f\x76\x65\x63\x4b\x66\x4e\x51\x3d\x3d','\x77\x6f\x7a\x43\x70\x38\x4f\x62\x77\x71\x73\x67\x49\x48\x6f\x36\x56\x67\x3d\x3d','\x52\x63\x4b\x48\x64\x4d\x4b\x31\x77\x35\x6b\x3d','\x77\x72\x66\x44\x6f\x4d\x4b\x43\x61\x57\x49\x3d','\x77\x71\x72\x44\x6e\x73\x4b\x66\x4c\x67\x3d\x3d','\x77\x36\x76\x44\x69\x4d\x4f\x6c\x43\x63\x4f\x4d','\x4d\x38\x4f\x79\x48\x38\x4b\x48\x77\x35\x51\x3d','\x4b\x48\x4d\x71\x77\x72\x48\x44\x68\x41\x3d\x3d','\x77\x71\x74\x65\x4f\x4d\x4f\x46\x77\x70\x54\x43\x6d\x63\x4b\x34\x77\x34\x51\x3d','\x57\x63\x4b\x69\x77\x35\x34\x4b\x56\x4d\x4f\x38','\x77\x70\x56\x6d\x53\x63\x4b\x46\x50\x63\x4f\x62\x77\x35\x4d\x47\x49\x73\x4b\x69\x41\x56\x76\x43\x75\x42\x41\x3d','\x57\x44\x7a\x44\x76\x73\x4f\x74\x77\x37\x58\x43\x72\x63\x4f\x4b\x4b\x63\x4b\x59\x77\x72\x52\x55\x4e\x30\x59\x6c\x77\x37\x78\x66\x53\x51\x3d\x3d','\x77\x35\x55\x30\x63\x69\x7a\x44\x75\x48\x38\x4c\x61\x73\x4f\x52\x77\x6f\x62\x43\x67\x38\x4f\x6c\x77\x71\x4c\x43\x6d\x77\x3d\x3d','\x58\x4d\x4b\x33\x49\x4d\x4f\x48\x77\x36\x67\x33\x4d\x38\x4f\x63\x77\x72\x4d\x46\x63\x31\x68\x76\x45\x73\x4f\x50\x77\x34\x70\x4e\x47\x6b\x67\x3d','\x77\x72\x4e\x7a\x4c\x38\x4b\x78\x77\x35\x6b\x3d','\x42\x41\x66\x44\x68\x6e\x4c\x44\x73\x51\x3d\x3d','\x59\x73\x4b\x73\x52\x63\x4b\x33\x77\x34\x67\x3d','\x55\x6b\x74\x48\x77\x71\x2f\x44\x6b\x67\x3d\x3d','\x77\x70\x33\x43\x74\x4d\x4f\x48\x77\x71\x73\x79\x4a\x57\x30\x3d','\x77\x70\x4c\x44\x68\x63\x4b\x49\x45\x38\x4b\x6c','\x77\x70\x72\x44\x6e\x63\x4b\x4e\x56\x6e\x42\x65','\x77\x70\x35\x74\x47\x77\x3d\x3d','\x77\x70\x4c\x43\x6c\x73\x4f\x34\x77\x71\x6f\x67','\x77\x37\x55\x4d\x58\x78\x6a\x44\x6d\x41\x3d\x3d','\x77\x36\x31\x34\x77\x6f\x74\x35\x43\x73\x4b\x46','\x77\x37\x31\x55\x77\x71\x4e\x2b\x4d\x51\x3d\x3d','\x65\x45\x50\x44\x67\x4d\x4f\x73','\x77\x34\x52\x6f\x77\x70\x62\x43\x6e\x73\x4f\x37','\x77\x72\x78\x57\x44\x38\x4f\x30\x77\x72\x67\x3d','\x4f\x44\x72\x43\x68\x45\x4c\x43\x68\x43\x72\x44\x6a\x42\x49\x78\x77\x72\x6a\x44\x74\x4d\x4b\x38\x77\x70\x2f\x44\x6c\x41\x3d\x3d','\x77\x37\x4e\x34\x77\x6f\x4d\x3d','\x35\x62\x36\x6e\x35\x61\x65\x78\x35\x70\x65\x6e\x36\x5a\x69\x77\x77\x36\x55\x3d','\x57\x32\x54\x44\x6c\x4d\x4b\x73\x77\x36\x68\x37\x77\x71\x45\x68\x58\x51\x3d\x3d','\x77\x34\x4e\x62\x77\x71\x58\x43\x6c\x77\x3d\x3d','\x55\x75\x65\x59\x68\x2b\x57\x79\x71\x65\x57\x2f\x73\x75\x57\x2b\x6e\x77\x3d\x3d','\x62\x47\x7a\x44\x68\x63\x4b\x66\x77\x36\x45\x3d','\x4f\x52\x35\x57\x4d\x38\x4b\x43','\x77\x36\x2f\x43\x72\x79\x66\x43\x69\x4d\x4b\x5a','\x77\x36\x77\x6c\x63\x7a\x72\x44\x74\x67\x3d\x3d','\x56\x31\x62\x44\x6b\x4d\x4f\x4b\x77\x36\x41\x3d','\x77\x36\x68\x73\x64\x45\x4a\x73','\x41\x55\x6f\x74\x77\x71\x6e\x44\x73\x68\x49\x61\x77\x6f\x77\x58\x48\x63\x4f\x49\x53\x47\x62\x43\x72\x44\x72\x44\x68\x42\x63\x42\x65\x43\x6e\x44\x6e\x4d\x4f\x4f\x77\x71\x68\x67\x43\x63\x4b\x6a\x66\x38\x4b\x54\x46\x4d\x4b\x32','\x77\x71\x72\x44\x6c\x73\x4b\x56\x4a\x63\x4f\x67\x59\x4d\x4f\x75\x44\x48\x6a\x44\x67\x73\x4b\x4b','\x77\x72\x50\x44\x6e\x38\x4f\x52\x62\x73\x4b\x70\x77\x71\x4c\x44\x70\x47\x30\x3d','\x65\x63\x4b\x7a\x77\x36\x51\x50\x59\x51\x3d\x3d','\x77\x6f\x33\x43\x73\x68\x54\x43\x70\x6c\x77\x3d','\x5a\x46\x50\x43\x74\x4d\x4f\x79\x41\x51\x3d\x3d','\x77\x37\x62\x43\x6e\x58\x4d\x78\x77\x72\x45\x3d','\x46\x63\x4f\x62\x77\x72\x48\x43\x6c\x6d\x44\x43\x6b\x42\x4c\x44\x69\x31\x5a\x39\x48\x67\x3d\x3d','\x77\x35\x45\x46\x56\x44\x72\x44\x6a\x6b\x34\x78\x56\x38\x4f\x68\x77\x71\x50\x43\x72\x41\x3d\x3d','\x51\x6d\x6e\x44\x6c\x63\x4b\x6a','\x4f\x44\x6e\x43\x71\x30\x7a\x43\x67\x77\x3d\x3d','\x77\x72\x6e\x43\x6d\x69\x4c\x43\x68\x51\x3d\x3d','\x77\x72\x6f\x37\x65\x38\x4b\x6f\x64\x51\x3d\x3d','\x55\x56\x76\x43\x6a\x73\x4f\x46\x4d\x4d\x4b\x35\x63\x73\x4f\x6b\x4a\x38\x4f\x68\x42\x67\x3d\x3d','\x4c\x46\x66\x44\x6d\x54\x62\x44\x6b\x4d\x4f\x32\x62\x41\x3d\x3d','\x55\x58\x78\x58\x77\x70\x33\x44\x6b\x51\x3d\x3d','\x77\x72\x37\x44\x76\x73\x4b\x67\x56\x6d\x4d\x3d','\x77\x35\x44\x43\x6e\x47\x68\x2b\x77\x34\x35\x4f\x56\x46\x7a\x44\x6f\x52\x33\x44\x67\x77\x35\x6d\x4b\x41\x3d\x3d','\x77\x35\x4e\x56\x77\x6f\x37\x43\x6e\x4d\x4f\x4e','\x65\x63\x4b\x47\x77\x36\x4d\x35\x64\x4d\x4f\x4d\x77\x71\x70\x6a\x77\x34\x48\x44\x68\x51\x46\x2b\x77\x36\x77\x76','\x77\x37\x33\x44\x6e\x4d\x4f\x55\x4a\x73\x4f\x59\x62\x38\x4f\x52\x4b\x58\x59\x5a\x77\x72\x67\x3d','\x46\x6d\x48\x44\x6c\x69\x58\x44\x76\x38\x4f\x54\x77\x72\x4e\x73\x77\x35\x4a\x45\x77\x72\x77\x3d','\x5a\x73\x4f\x75\x77\x35\x5a\x65\x4c\x73\x4b\x34\x4f\x77\x3d\x3d','\x52\x63\x4f\x65\x77\x6f\x66\x43\x70\x77\x31\x4f\x4e\x6e\x58\x44\x6f\x38\x4b\x72','\x77\x6f\x38\x77\x66\x67\x3d\x3d','\x46\x4d\x4b\x6b\x41\x38\x4b\x45\x77\x35\x59\x3d','\x77\x36\x6c\x44\x66\x63\x4f\x52\x77\x34\x6e\x43\x68\x4d\x4f\x6c\x77\x35\x33\x44\x68\x51\x3d\x3d','\x53\x63\x4b\x78\x55\x38\x4b\x61\x77\x37\x41\x3d','\x48\x4d\x4f\x61\x50\x63\x4b\x55\x77\x34\x41\x3d','\x77\x36\x45\x51\x51\x54\x58\x44\x6b\x41\x3d\x3d','\x54\x48\x50\x43\x6c\x43\x33\x43\x72\x73\x4f\x42\x77\x37\x4e\x35\x77\x6f\x45\x3d','\x77\x72\x38\x46\x4f\x52\x4c\x43\x76\x44\x56\x54\x77\x70\x64\x4e\x77\x6f\x34\x58','\x77\x72\x66\x44\x6c\x4d\x4b\x52\x56\x47\x56\x53\x77\x35\x54\x44\x68\x38\x4b\x79\x77\x37\x35\x34\x54\x6c\x62\x43\x76\x63\x4f\x56\x46\x6e\x68\x41\x58\x73\x4f\x36\x77\x70\x6c\x42\x50\x4d\x4f\x70\x50\x55\x76\x43\x74\x69\x6f\x65\x4d\x73\x4f\x68\x57\x51\x7a\x43\x70\x38\x4b\x6c\x5a\x63\x4b\x4c','\x77\x71\x49\x7a\x61\x38\x4b\x6c\x52\x38\x4b\x68\x41\x38\x4b\x56\x5a\x54\x46\x78\x77\x34\x67\x32\x4e\x73\x4b\x57\x77\x72\x77\x4f\x77\x72\x4a\x53\x44\x45\x45\x34\x55\x63\x4b\x67\x64\x43\x52\x64\x57\x30\x2f\x44\x6c\x32\x45\x46\x77\x72\x68\x53\x77\x72\x54\x43\x73\x73\x4f\x69\x49\x77\x3d\x3d','\x56\x48\x76\x44\x6f\x4d\x4f\x4d\x77\x36\x63\x3d','\x59\x55\x67\x48\x50\x38\x4f\x32\x77\x71\x42\x30\x43\x52\x2f\x43\x72\x38\x4b\x5a\x77\x72\x46\x4e\x66\x79\x72\x43\x75\x63\x4f\x74\x77\x36\x66\x44\x6f\x73\x4b\x6b\x77\x34\x76\x44\x6d\x57\x44\x43\x74\x38\x4f\x68\x41\x47\x70\x33\x77\x34\x6e\x43\x75\x51\x66\x44\x73\x4d\x4b\x6f\x77\x36\x37\x44\x70\x47\x51\x74\x77\x72\x7a\x43\x76\x63\x4b\x36\x63\x63\x4b\x32\x58\x57\x70\x61\x77\x34\x39\x63\x77\x36\x76\x43\x6b\x6a\x59\x3d','\x77\x35\x72\x43\x6a\x6c\x41\x3d','\x77\x6f\x4c\x43\x6e\x68\x4c\x43\x70\x56\x51\x3d','\x77\x6f\x33\x43\x71\x52\x44\x43\x6a\x30\x4d\x3d','\x77\x34\x35\x6e\x77\x72\x45\x36\x77\x6f\x41\x3d','\x77\x72\x2f\x43\x75\x38\x4f\x53\x64\x52\x45\x3d','\x4a\x41\x6a\x43\x74\x6d\x7a\x43\x70\x77\x3d\x3d','\x77\x6f\x2f\x43\x73\x38\x4f\x35\x77\x71\x34\x4a','\x45\x54\x45\x57\x44\x6d\x6b\x3d','\x77\x6f\x76\x44\x68\x73\x4b\x65\x4b\x4d\x4b\x76','\x58\x73\x4f\x59\x77\x72\x6e\x43\x67\x53\x6f\x3d','\x41\x63\x4b\x76\x54\x4d\x4f\x50\x77\x72\x55\x55\x63\x63\x4f\x42\x77\x37\x55\x3d','\x41\x31\x58\x44\x69\x4d\x4f\x59\x65\x4d\x4b\x48\x4e\x38\x4f\x2b\x63\x77\x3d\x3d','\x77\x37\x67\x4a\x77\x36\x7a\x44\x75\x48\x6f\x3d','\x77\x6f\x31\x54\x4e\x4d\x4f\x30\x77\x6f\x30\x3d','\x4e\x73\x4b\x6a\x4a\x4d\x4b\x52\x77\x6f\x7a\x43\x73\x73\x4b\x75\x77\x72\x34\x35','\x77\x72\x33\x43\x67\x63\x4b\x35\x77\x6f\x4e\x36\x63\x54\x30\x6b\x52\x48\x7a\x44\x72\x38\x4b\x6d\x53\x67\x2f\x44\x71\x63\x4b\x4b\x77\x6f\x63\x3d','\x4a\x45\x33\x44\x73\x6c\x48\x43\x6a\x51\x3d\x3d','\x43\x63\x4f\x62\x44\x38\x4b\x2f\x77\x36\x34\x3d','\x77\x36\x2f\x43\x6b\x43\x2f\x43\x6e\x4d\x4b\x70','\x77\x70\x2f\x44\x68\x63\x4b\x48\x47\x38\x4b\x5a\x59\x4d\x4b\x45\x4f\x43\x63\x4a\x77\x37\x55\x3d','\x77\x70\x5a\x47\x77\x36\x4c\x43\x69\x73\x4b\x4f\x55\x73\x4b\x30\x77\x70\x54\x43\x69\x41\x3d\x3d','\x77\x71\x78\x72\x77\x35\x52\x6f\x55\x73\x4b\x64\x77\x6f\x6a\x44\x69\x44\x30\x3d','\x4f\x73\x4b\x32\x4a\x73\x4b\x2b\x77\x34\x77\x3d','\x77\x70\x54\x43\x6e\x51\x4c\x43\x76\x38\x4f\x4f','\x51\x45\x50\x44\x68\x73\x4f\x6a\x77\x36\x2f\x44\x6a\x77\x7a\x43\x72\x57\x41\x44\x5a\x58\x44\x43\x71\x4d\x4f\x30\x4c\x77\x3d\x3d','\x64\x6e\x55\x44\x50\x4d\x4f\x6e','\x4b\x56\x7a\x44\x70\x44\x62\x44\x6d\x77\x3d\x3d','\x77\x36\x34\x74\x77\x37\x54\x44\x75\x57\x6a\x43\x6c\x38\x4f\x39\x77\x6f\x51\x43\x61\x38\x4f\x32\x4f\x48\x41\x42\x77\x6f\x30\x3d','\x77\x6f\x64\x71\x47\x38\x4b\x2b\x77\x37\x38\x3d','\x77\x70\x7a\x43\x6d\x77\x67\x36\x77\x35\x56\x77\x77\x35\x34\x68\x77\x71\x6c\x41\x65\x67\x3d\x3d','\x77\x34\x2f\x43\x75\x73\x4b\x59\x77\x72\x70\x62\x4d\x79\x30\x6a\x43\x4d\x4b\x69\x77\x70\x34\x78\x77\x71\x73\x3d','\x77\x70\x58\x44\x68\x73\x4b\x4d\x46\x73\x4b\x63','\x77\x70\x44\x44\x6a\x73\x4f\x64\x65\x4d\x4b\x79','\x59\x67\x37\x44\x68\x38\x4f\x4c\x77\x36\x63\x3d','\x77\x71\x72\x43\x72\x54\x33\x43\x67\x6e\x77\x3d','\x63\x56\x54\x44\x69\x73\x4b\x2f\x77\x37\x59\x3d','\x4d\x67\x31\x42\x43\x63\x4b\x5a','\x63\x31\x63\x39\x50\x4d\x4f\x4a','\x62\x55\x6f\x5a\x45\x38\x4f\x6b','\x77\x70\x37\x44\x67\x38\x4f\x49\x64\x4d\x4b\x48','\x44\x38\x4b\x47\x42\x73\x4b\x73\x77\x37\x73\x3d','\x77\x37\x64\x4f\x50\x63\x4b\x75\x53\x73\x4f\x6c\x77\x72\x67\x71\x51\x77\x3d\x3d','\x77\x36\x50\x44\x6c\x73\x4b\x4c\x63\x63\x4f\x74\x77\x72\x66\x43\x75\x6e\x39\x54\x77\x6f\x48\x44\x68\x6e\x7a\x43\x6f\x77\x3d\x3d','\x77\x6f\x56\x6e\x48\x73\x4b\x41\x77\x34\x6f\x7a\x77\x36\x30\x59\x49\x77\x3d\x3d','\x77\x71\x54\x43\x6e\x44\x54\x43\x6e\x38\x4f\x74\x77\x36\x5a\x47\x42\x51\x3d\x3d','\x77\x34\x54\x43\x6b\x6b\x34\x2b\x77\x72\x55\x3d','\x63\x32\x41\x2f\x50\x73\x4f\x54','\x62\x47\x56\x61\x77\x6f\x66\x44\x76\x77\x3d\x3d','\x47\x41\x33\x43\x6a\x58\x33\x43\x73\x41\x3d\x3d','\x77\x72\x76\x43\x74\x42\x70\x56\x77\x72\x6f\x36\x64\x7a\x33\x43\x67\x69\x6a\x43\x70\x48\x70\x4f\x58\x4d\x4f\x49\x55\x63\x4f\x57\x77\x70\x46\x77\x45\x63\x4f\x77\x42\x6e\x59\x64\x41\x69\x44\x43\x6a\x63\x4f\x6b\x77\x6f\x56\x34\x41\x38\x4b\x4a\x77\x35\x68\x59\x77\x35\x4e\x6e\x77\x36\x62\x43\x6a\x68\x48\x44\x6b\x67\x3d\x3d','\x5a\x30\x74\x67\x77\x72\x33\x44\x74\x51\x3d\x3d','\x77\x70\x62\x44\x68\x63\x4f\x2b\x65\x73\x4b\x61','\x77\x35\x4a\x2f\x77\x71\x6b\x43\x77\x71\x41\x3d','\x35\x62\x43\x36\x35\x62\x79\x51\x35\x62\x36\x38\x35\x71\x71\x53\x35\x5a\x2b\x51\x35\x37\x71\x35\x35\x61\x2b\x62\x35\x61\x61\x4d\x36\x4c\x65\x68\x37\x37\x32\x57\x35\x70\x65\x6c\x35\x72\x4f\x73\x35\x4c\x32\x38\x35\x35\x57\x50','\x63\x38\x4b\x6a\x4c\x73\x4f\x65\x77\x37\x30\x3d','\x51\x55\x54\x44\x74\x4d\x4b\x6d\x77\x36\x6b\x3d','\x77\x6f\x74\x70\x44\x73\x4b\x52\x77\x36\x6b\x3d','\x56\x4d\x4f\x57\x77\x72\x62\x43\x70\x69\x77\x3d','\x41\x48\x6a\x44\x6b\x56\x33\x43\x6b\x77\x3d\x3d','\x59\x63\x4b\x73\x58\x4d\x4b\x45\x77\x37\x34\x3d','\x77\x36\x7a\x43\x6c\x6a\x44\x43\x6e\x4d\x4b\x58','\x77\x71\x77\x41\x77\x71\x44\x44\x73\x63\x4f\x48','\x77\x72\x76\x43\x68\x52\x66\x43\x6d\x4d\x4f\x46','\x4e\x47\x48\x44\x72\x44\x6a\x44\x69\x67\x3d\x3d','\x4a\x48\x62\x44\x6f\x30\x4c\x43\x69\x67\x3d\x3d','\x42\x52\x72\x43\x68\x55\x7a\x43\x71\x51\x3d\x3d','\x54\x30\x6c\x2f\x77\x70\x44\x44\x73\x41\x3d\x3d','\x77\x72\x2f\x44\x67\x73\x4b\x57\x49\x38\x4b\x35\x5a\x73\x4f\x7a\x43\x77\x3d\x3d','\x57\x57\x50\x44\x6d\x73\x4b\x6f\x77\x36\x64\x42','\x77\x36\x58\x43\x75\x63\x4f\x61\x77\x71\x6b\x6a','\x77\x72\x56\x71\x56\x38\x4b\x52\x4d\x77\x3d\x3d','\x45\x4d\x4b\x55\x4d\x73\x4b\x64\x77\x35\x77\x78\x50\x68\x6b\x5a\x77\x35\x48\x43\x70\x4d\x4f\x4a\x77\x72\x74\x47','\x77\x36\x6b\x36\x65\x67\x70\x78\x46\x7a\x77\x3d','\x77\x6f\x4d\x71\x58\x38\x4f\x45\x77\x34\x49\x3d','\x77\x71\x35\x50\x4c\x63\x4f\x65\x77\x72\x4d\x3d','\x4e\x47\x44\x44\x68\x6c\x6e\x43\x76\x67\x3d\x3d','\x77\x35\x51\x47\x64\x42\x6c\x50','\x77\x6f\x4c\x44\x69\x73\x4b\x37\x56\x30\x55\x3d','\x77\x70\x39\x35\x4e\x73\x4f\x58\x77\x70\x67\x3d','\x41\x6a\x51\x46\x45\x58\x45\x3d','\x66\x73\x4b\x45\x77\x34\x34\x67\x63\x41\x3d\x3d','\x57\x4d\x4f\x43\x77\x72\x62\x43\x74\x53\x55\x3d','\x4f\x4d\x4f\x4b\x77\x72\x58\x43\x76\x46\x45\x3d','\x4e\x73\x4f\x4d\x77\x6f\x76\x43\x73\x56\x49\x3d','\x77\x6f\x35\x33\x54\x4d\x4b\x43\x4c\x63\x4b\x68','\x55\x4d\x4b\x63\x77\x37\x41\x37\x5a\x41\x3d\x3d','\x77\x72\x6e\x44\x6a\x38\x4f\x52\x61\x73\x4b\x70\x77\x71\x4d\x3d','\x77\x34\x52\x53\x77\x72\x44\x43\x68\x4d\x4f\x39\x51\x63\x4f\x6b\x77\x6f\x33\x44\x75\x77\x41\x3d','\x41\x53\x6a\x43\x68\x6b\x48\x43\x70\x41\x3d\x3d','\x77\x34\x67\x38\x59\x51\x44\x44\x6f\x77\x3d\x3d','\x63\x38\x4b\x69\x77\x37\x63\x44\x52\x67\x3d\x3d','\x77\x35\x55\x31\x5a\x78\x66\x44\x69\x41\x3d\x3d','\x77\x37\x77\x33\x56\x79\x48\x44\x6b\x67\x3d\x3d','\x77\x72\x4d\x5a\x77\x6f\x37\x44\x6f\x38\x4f\x6a','\x4d\x6d\x50\x44\x6f\x43\x6a\x44\x71\x77\x3d\x3d','\x77\x72\x58\x43\x75\x4d\x4f\x35\x66\x43\x4d\x3d','\x49\x56\x4c\x44\x71\x33\x72\x43\x67\x77\x3d\x3d','\x77\x72\x62\x43\x70\x4d\x4f\x68\x77\x71\x73\x2f','\x66\x63\x4b\x33\x77\x34\x55\x76\x51\x73\x4f\x39\x77\x70\x42\x65\x77\x37\x48\x44\x6f\x43\x34\x3d','\x77\x72\x4a\x53\x50\x4d\x4f\x43\x77\x6f\x6a\x43\x6a\x4d\x4b\x6d','\x53\x33\x2f\x44\x72\x73\x4f\x61\x77\x37\x34\x3d','\x46\x55\x37\x44\x74\x7a\x4c\x44\x71\x51\x3d\x3d','\x77\x6f\x41\x36\x57\x38\x4b\x78\x5a\x51\x3d\x3d','\x77\x6f\x58\x44\x69\x4d\x4f\x2b\x66\x4d\x4b\x46','\x77\x70\x6e\x43\x71\x7a\x62\x43\x67\x63\x4f\x6c','\x65\x30\x44\x44\x6e\x63\x4b\x2b\x77\x34\x30\x3d','\x77\x35\x62\x43\x6b\x51\x6a\x43\x6f\x73\x4b\x48','\x77\x6f\x49\x4e\x56\x4d\x4f\x39\x77\x35\x45\x3d','\x77\x37\x62\x43\x74\x53\x44\x43\x6e\x4d\x4b\x32\x51\x67\x5a\x47\x62\x73\x4f\x43\x77\x70\x48\x43\x6d\x30\x4e\x6c','\x48\x77\x48\x43\x6e\x33\x2f\x43\x73\x67\x3d\x3d','\x50\x63\x4f\x57\x47\x4d\x4b\x50\x77\x36\x77\x3d','\x64\x73\x4f\x6b\x77\x70\x33\x43\x74\x54\x51\x3d','\x77\x35\x42\x72\x77\x72\x6b\x45\x77\x72\x7a\x44\x6e\x67\x4d\x3d','\x77\x70\x4d\x37\x77\x70\x33\x44\x69\x73\x4f\x4d','\x66\x6b\x54\x44\x73\x63\x4b\x64\x77\x35\x45\x47\x77\x37\x49\x3d','\x77\x36\x49\x7a\x77\x37\x50\x44\x76\x33\x6f\x3d','\x77\x71\x4c\x43\x71\x38\x4f\x38\x59\x44\x55\x69\x77\x37\x50\x43\x6c\x32\x33\x44\x6e\x63\x4f\x61\x4e\x48\x37\x44\x73\x77\x3d\x3d','\x64\x48\x49\x4f\x48\x63\x4f\x48\x77\x34\x4a\x4e\x4c\x43\x50\x43\x68\x63\x4b\x37\x77\x70\x6c\x32\x56\x41\x3d\x3d','\x77\x70\x66\x44\x69\x73\x4b\x47\x58\x32\x55\x3d','\x51\x67\x2f\x44\x68\x63\x4f\x62\x77\x37\x41\x3d','\x44\x38\x4f\x46\x66\x73\x4b\x38\x49\x33\x38\x4e','\x48\x68\x37\x43\x6a\x32\x2f\x43\x70\x41\x3d\x3d','\x77\x6f\x66\x43\x72\x63\x4f\x77\x64\x53\x6f\x3d','\x51\x46\x50\x44\x75\x4d\x4b\x50\x77\x35\x34\x3d','\x77\x70\x48\x44\x73\x73\x4b\x35\x45\x4d\x4b\x59\x50\x4d\x4b\x75','\x77\x36\x31\x65\x77\x72\x63\x75\x77\x6f\x77\x3d','\x77\x72\x50\x43\x67\x38\x4f\x70\x77\x70\x59\x34\x66\x43\x77\x3d','\x77\x35\x50\x44\x76\x73\x4f\x77\x4b\x63\x4f\x76','\x77\x72\x70\x41\x50\x38\x4b\x37\x77\x36\x30\x3d','\x77\x35\x50\x43\x6d\x32\x5a\x36\x77\x37\x38\x3d','\x77\x71\x76\x44\x72\x73\x4b\x4c\x4c\x4d\x4b\x76','\x77\x71\x4c\x44\x6f\x63\x4b\x53\x57\x32\x30\x3d','\x4f\x48\x37\x44\x73\x6e\x72\x43\x71\x41\x3d\x3d','\x66\x31\x37\x43\x6d\x73\x4f\x54\x48\x51\x3d\x3d','\x64\x48\x41\x42\x47\x73\x4f\x56','\x46\x48\x30\x7a\x77\x71\x44\x44\x6b\x51\x3d\x3d','\x77\x72\x54\x43\x73\x63\x4f\x4f\x77\x72\x45\x35','\x52\x56\x6a\x43\x72\x63\x4f\x50\x50\x41\x3d\x3d','\x4c\x6a\x6f\x74\x46\x46\x34\x3d','\x77\x34\x63\x73\x59\x54\x4c\x44\x71\x67\x3d\x3d','\x4e\x73\x4b\x78\x4a\x38\x4b\x68\x77\x36\x77\x3d','\x77\x34\x73\x76\x61\x78\x46\x6f','\x46\x6e\x76\x44\x74\x68\x44\x44\x6c\x41\x3d\x3d','\x77\x34\x6c\x59\x77\x70\x44\x43\x70\x63\x4f\x6f','\x77\x72\x6b\x34\x65\x63\x4f\x45\x77\x37\x42\x30','\x77\x36\x4d\x59\x77\x35\x4c\x44\x6f\x6e\x51\x3d','\x55\x32\x6e\x44\x70\x63\x4f\x5a\x77\x34\x7a\x43\x6d\x6b\x77\x3d','\x63\x4d\x4b\x74\x54\x63\x4b\x4c\x77\x37\x34\x3d','\x62\x32\x45\x41\x41\x73\x4f\x41','\x43\x42\x6a\x43\x74\x30\x50\x43\x6b\x41\x3d\x3d','\x77\x37\x33\x43\x6a\x63\x4f\x6e\x77\x70\x59\x36','\x77\x34\x4c\x43\x72\x6e\x73\x72\x77\x72\x55\x3d','\x4c\x7a\x7a\x43\x6c\x31\x48\x43\x68\x77\x3d\x3d','\x63\x38\x4b\x4a\x77\x36\x6f\x54\x58\x41\x3d\x3d','\x77\x35\x42\x32\x77\x70\x42\x2b\x4f\x51\x3d\x3d','\x77\x35\x62\x43\x6f\x6d\x30\x54\x77\x71\x51\x3d','\x41\x46\x6e\x44\x67\x43\x7a\x44\x6f\x77\x3d\x3d','\x77\x37\x35\x66\x77\x71\x44\x43\x68\x73\x4f\x31','\x51\x31\x6e\x43\x6b\x4d\x4f\x4e\x50\x51\x3d\x3d','\x56\x63\x4f\x49\x77\x6f\x48\x43\x68\x69\x6b\x3d','\x4e\x73\x4b\x4f\x4c\x4d\x4b\x38\x77\x35\x30\x3d','\x54\x47\x56\x36\x77\x72\x7a\x44\x68\x67\x3d\x3d','\x4c\x4d\x4f\x74\x77\x72\x54\x43\x6b\x58\x6f\x3d','\x56\x6c\x50\x43\x71\x73\x4f\x31\x48\x41\x3d\x3d','\x63\x38\x4b\x54\x77\x34\x38\x34\x59\x41\x3d\x3d','\x77\x37\x6c\x74\x77\x72\x4a\x46\x4e\x67\x3d\x3d','\x77\x34\x76\x43\x73\x67\x50\x43\x6a\x63\x4b\x61','\x77\x6f\x52\x59\x53\x63\x4b\x7a\x41\x67\x3d\x3d','\x77\x34\x50\x43\x6d\x7a\x4c\x43\x6d\x73\x4b\x6d','\x77\x72\x4d\x47\x77\x6f\x76\x44\x6c\x67\x3d\x3d','\x77\x34\x34\x42\x59\x53\x68\x41\x4d\x31\x76\x43\x71\x78\x76\x44\x69\x63\x4f\x54\x63\x38\x4f\x59\x77\x36\x45\x3d','\x77\x35\x6a\x43\x69\x47\x59\x73\x77\x70\x4d\x3d','\x77\x6f\x37\x43\x6e\x67\x33\x43\x68\x63\x4f\x66','\x4f\x56\x2f\x44\x69\x78\x4c\x44\x6b\x51\x3d\x3d','\x77\x37\x4e\x57\x77\x70\x31\x48\x45\x41\x3d\x3d','\x4b\x54\x76\x44\x6a\x45\x44\x44\x6e\x67\x3d\x3d','\x54\x33\x39\x4d\x77\x72\x6a\x44\x71\x77\x3d\x3d','\x77\x34\x46\x2b\x77\x70\x2f\x43\x6a\x4d\x4f\x77','\x51\x38\x4f\x69\x77\x37\x56\x4c\x43\x77\x3d\x3d','\x77\x70\x62\x44\x6a\x4d\x4f\x58\x57\x63\x4b\x56','\x63\x55\x33\x44\x70\x4d\x4b\x42\x77\x37\x30\x3d','\x77\x6f\x64\x47\x57\x38\x4b\x69\x50\x77\x3d\x3d','\x77\x71\x70\x6d\x62\x73\x4b\x77\x49\x67\x3d\x3d','\x4b\x31\x44\x44\x68\x30\x58\x43\x6b\x77\x3d\x3d','\x77\x71\x7a\x44\x6c\x38\x4b\x35\x53\x32\x55\x3d','\x54\x4d\x4b\x61\x56\x4d\x4b\x39\x77\x36\x72\x44\x74\x67\x3d\x3d','\x77\x34\x6e\x44\x67\x63\x4f\x79\x4e\x63\x4f\x7a','\x4d\x51\x48\x43\x6d\x6d\x2f\x43\x6f\x41\x3d\x3d','\x61\x38\x4b\x6f\x77\x34\x4d\x58\x52\x67\x3d\x3d','\x77\x72\x48\x44\x72\x73\x4f\x39\x56\x63\x4b\x31','\x77\x70\x2f\x44\x70\x4d\x4f\x71\x59\x73\x4b\x77','\x43\x63\x4b\x4f\x49\x38\x4b\x6c\x77\x37\x51\x3d','\x77\x35\x52\x66\x77\x71\x55\x3d','\x77\x70\x44\x43\x69\x4d\x4f\x68\x57\x78\x6b\x3d','\x77\x34\x76\x43\x6a\x57\x31\x35\x77\x72\x67\x2b','\x51\x55\x72\x44\x6c\x38\x4f\x78\x77\x37\x6f\x3d','\x5a\x63\x4b\x6f\x54\x4d\x4b\x42\x77\x35\x59\x3d','\x77\x37\x78\x43\x77\x70\x51\x62\x77\x70\x38\x3d','\x77\x34\x44\x44\x75\x73\x4f\x41\x44\x38\x4f\x4f','\x77\x36\x49\x41\x77\x37\x37\x44\x6e\x6d\x41\x3d','\x62\x48\x58\x44\x73\x38\x4f\x54\x77\x35\x77\x3d','\x77\x70\x33\x43\x6c\x79\x6e\x43\x73\x73\x4f\x56','\x56\x4d\x4b\x36\x65\x38\x4b\x30\x77\x36\x59\x3d','\x77\x35\x46\x51\x77\x6f\x78\x6b\x43\x41\x3d\x3d','\x77\x36\x54\x44\x76\x73\x4f\x65\x46\x38\x4f\x41','\x77\x36\x33\x43\x70\x43\x58\x43\x6d\x38\x4b\x6d\x4d\x32\x73\x3d','\x4e\x4d\x4b\x5a\x49\x63\x4b\x51\x77\x34\x38\x3d','\x77\x6f\x58\x43\x74\x77\x62\x43\x75\x38\x4f\x5a\x77\x72\x73\x58','\x51\x77\x54\x44\x6d\x73\x4f\x44\x77\x37\x77\x3d','\x65\x46\x54\x44\x6f\x4d\x4f\x62\x77\x35\x49\x3d','\x58\x4d\x4f\x58\x77\x36\x4a\x6d\x47\x63\x4b\x4f\x46\x79\x59\x2b\x77\x6f\x48\x44\x74\x67\x4a\x34\x77\x34\x41\x3d','\x77\x35\x48\x43\x6a\x6a\x76\x43\x6f\x63\x4b\x41\x58\x79\x70\x69\x54\x73\x4f\x69\x77\x71\x6e\x43\x76\x51\x3d\x3d','\x43\x67\x4c\x43\x72\x48\x72\x43\x6f\x67\x3d\x3d','\x5a\x73\x4b\x48\x4f\x38\x4f\x6b\x77\x34\x49\x71\x48\x73\x4f\x74\x77\x70\x59\x54\x55\x33\x68\x58\x49\x67\x3d\x3d','\x59\x38\x4b\x6d\x77\x36\x67\x57\x58\x77\x3d\x3d','\x77\x71\x4a\x65\x59\x63\x4b\x64\x44\x67\x3d\x3d','\x77\x72\x54\x43\x6d\x53\x6a\x43\x6a\x73\x4f\x76','\x77\x35\x30\x49\x59\x69\x6e\x44\x68\x77\x3d\x3d','\x57\x30\x7a\x43\x74\x73\x4f\x4a\x48\x41\x3d\x3d','\x52\x38\x4f\x47\x77\x36\x64\x68\x43\x63\x4f\x2f\x65\x67\x3d\x3d','\x77\x34\x30\x51\x77\x36\x54\x44\x76\x55\x38\x3d','\x77\x35\x30\x74\x54\x6a\x6e\x44\x69\x77\x73\x38\x77\x72\x73\x71\x77\x72\x74\x31\x4f\x58\x77\x4b','\x51\x44\x4c\x44\x6b\x73\x4f\x7a\x77\x35\x6e\x43\x67\x4d\x4f\x59\x4b\x73\x4b\x31\x77\x71\x74\x62\x50\x41\x3d\x3d','\x42\x6b\x7a\x44\x75\x7a\x37\x44\x6c\x77\x3d\x3d','\x49\x6a\x33\x43\x6d\x46\x4c\x43\x6c\x51\x3d\x3d','\x54\x73\x4f\x49\x77\x36\x74\x53\x4d\x67\x3d\x3d','\x77\x36\x2f\x43\x75\x33\x78\x4f\x77\x35\x77\x3d','\x59\x73\x4b\x50\x54\x63\x4b\x65\x77\x37\x34\x3d','\x77\x6f\x55\x50\x51\x63\x4b\x7a\x5a\x77\x3d\x3d','\x63\x6b\x6a\x44\x75\x38\x4f\x39\x77\x36\x58\x44\x73\x77\x72\x44\x72\x46\x6b\x70\x66\x6e\x50\x43\x6f\x63\x4f\x7a\x46\x38\x4f\x4e\x77\x34\x74\x47\x77\x36\x45\x3d','\x77\x70\x37\x43\x6d\x43\x6a\x43\x69\x63\x4f\x42','\x61\x46\x7a\x44\x69\x4d\x4f\x67\x77\x37\x34\x3d','\x77\x71\x4e\x31\x4b\x73\x4b\x4e\x77\x37\x38\x3d','\x77\x36\x59\x57\x77\x35\x4c\x44\x68\x45\x6a\x43\x74\x73\x4f\x57\x77\x37\x51\x44\x57\x38\x4f\x4e\x47\x30\x73\x6f','\x51\x6d\x37\x44\x72\x38\x4b\x6e\x77\x37\x63\x3d','\x51\x56\x6a\x44\x69\x73\x4b\x62\x77\x36\x6f\x3d','\x77\x72\x6e\x43\x75\x73\x4f\x35\x5a\x79\x56\x54\x77\x70\x34\x3d','\x77\x6f\x59\x6b\x51\x73\x4f\x43\x77\x34\x73\x3d','\x77\x36\x68\x4f\x77\x70\x35\x43\x44\x51\x3d\x3d','\x77\x37\x2f\x43\x73\x33\x30\x52\x77\x71\x56\x4f\x77\x72\x55\x4e\x77\x34\x6c\x31\x48\x33\x52\x45\x77\x70\x63\x3d','\x59\x73\x4b\x58\x77\x36\x59\x2b\x5a\x4d\x4b\x39\x77\x34\x63\x3d','\x77\x70\x78\x67\x4f\x4d\x4b\x78\x77\x37\x41\x3d','\x4e\x56\x4c\x44\x74\x45\x2f\x43\x72\x41\x3d\x3d','\x52\x73\x4b\x6a\x45\x38\x4f\x61\x77\x37\x4d\x3d','\x61\x55\x54\x43\x74\x4d\x4f\x6f\x41\x77\x3d\x3d','\x77\x34\x59\x38\x53\x7a\x37\x44\x6d\x33\x70\x52','\x77\x6f\x77\x62\x77\x72\x44\x44\x73\x63\x4f\x65','\x77\x70\x54\x43\x6e\x77\x2f\x43\x70\x38\x4f\x47','\x44\x48\x30\x65\x77\x70\x62\x44\x6c\x51\x46\x45','\x77\x70\x7a\x43\x6c\x69\x6a\x43\x76\x63\x4f\x43','\x4a\x6d\x4c\x44\x72\x52\x33\x44\x6c\x41\x3d\x3d','\x43\x67\x58\x43\x71\x57\x33\x43\x71\x77\x3d\x3d','\x77\x72\x6f\x5a\x65\x73\x4b\x6c\x62\x51\x3d\x3d','\x77\x70\x41\x76\x64\x63\x4b\x70\x55\x67\x3d\x3d','\x45\x63\x4f\x71\x77\x70\x66\x43\x67\x46\x62\x43\x6f\x53\x6a\x44\x74\x6d\x5a\x59\x4d\x63\x4f\x72\x56\x4d\x4f\x39','\x4e\x73\x4f\x52\x77\x6f\x7a\x43\x76\x57\x41\x3d','\x77\x34\x52\x55\x52\x57\x4a\x38','\x77\x35\x45\x32\x51\x69\x33\x44\x72\x51\x3d\x3d','\x4d\x46\x63\x41\x77\x71\x7a\x44\x73\x32\x30\x46\x77\x70\x63\x45\x45\x4d\x4f\x50\x51\x51\x3d\x3d','\x77\x37\x42\x47\x77\x70\x41\x4f\x77\x70\x34\x3d','\x77\x71\x50\x43\x67\x44\x58\x43\x6d\x4d\x4f\x71','\x59\x56\x66\x44\x68\x4d\x4b\x62\x77\x35\x51\x3d','\x77\x35\x4d\x35\x54\x44\x62\x44\x71\x41\x3d\x3d','\x52\x4d\x4b\x67\x77\x35\x55\x64\x56\x77\x3d\x3d','\x77\x34\x4e\x73\x59\x57\x74\x4d','\x77\x71\x7a\x43\x6b\x4d\x4f\x63\x77\x70\x41\x39','\x77\x71\x6a\x43\x6b\x73\x4f\x73\x77\x70\x45\x6f\x44\x55\x45\x50\x61\x4d\x4b\x58\x77\x37\x6b\x4d\x77\x34\x70\x53','\x77\x34\x4c\x43\x68\x58\x30\x6f\x77\x71\x34\x3d','\x77\x70\x37\x43\x70\x67\x50\x43\x76\x4d\x4f\x4a\x77\x34\x70\x36\x4d\x4d\x4b\x47\x77\x71\x4c\x43\x76\x4d\x4b\x58\x77\x71\x6c\x63','\x5a\x63\x4b\x38\x5a\x4d\x4b\x59\x77\x35\x62\x43\x76\x4d\x4f\x2f\x77\x70\x31\x6a\x48\x73\x4b\x4e\x42\x42\x6c\x47\x65\x78\x62\x43\x6f\x45\x34\x76\x77\x71\x4d\x3d','\x52\x38\x4f\x47\x77\x36\x64\x68\x62\x38\x4f\x2b','\x77\x37\x6e\x43\x76\x6b\x4d\x4c\x77\x72\x55\x3d','\x77\x71\x30\x6e\x77\x6f\x58\x44\x76\x73\x4f\x6a','\x77\x35\x72\x44\x74\x38\x4f\x58\x50\x38\x4f\x39','\x57\x73\x4b\x63\x77\x34\x59\x32\x5a\x77\x3d\x3d','\x77\x70\x51\x2f\x53\x4d\x4f\x53\x77\x37\x4d\x3d','\x77\x71\x76\x43\x6e\x7a\x6e\x43\x75\x6c\x38\x3d','\x50\x68\x35\x78\x4c\x4d\x4b\x6b\x77\x36\x30\x43','\x65\x46\x4a\x70\x77\x6f\x58\x44\x74\x41\x3d\x3d','\x55\x32\x6e\x44\x70\x63\x4f\x5a\x77\x35\x2f\x43\x6e\x30\x6f\x3d','\x77\x72\x5a\x58\x4c\x73\x4b\x59\x77\x36\x34\x3d','\x77\x6f\x64\x35\x62\x73\x4b\x54\x41\x41\x3d\x3d','\x41\x73\x4b\x4c\x46\x63\x4b\x4c\x77\x36\x45\x3d','\x46\x6c\x58\x44\x6e\x55\x4c\x43\x74\x41\x3d\x3d','\x66\x38\x4f\x6b\x77\x71\x72\x43\x68\x43\x46\x74\x42\x55\x7a\x44\x69\x38\x4b\x48\x77\x6f\x51\x41\x63\x57\x49\x3d','\x51\x56\x51\x6c\x4a\x38\x4f\x64\x77\x36\x70\x68','\x51\x38\x4f\x43\x77\x6f\x66\x43\x74\x41\x31\x42','\x45\x54\x7a\x44\x76\x46\x7a\x44\x73\x67\x3d\x3d','\x77\x71\x4e\x49\x57\x63\x4b\x42\x45\x77\x3d\x3d','\x4e\x47\x72\x44\x69\x54\x7a\x44\x76\x77\x3d\x3d','\x77\x35\x45\x68\x77\x37\x76\x44\x73\x57\x51\x3d','\x5a\x63\x4b\x38\x5a\x4d\x4b\x59\x77\x35\x62\x43\x76\x4d\x4f\x2f\x77\x70\x31\x39\x41\x4d\x4b\x69','\x51\x57\x68\x64\x77\x72\x7a\x44\x76\x33\x31\x37\x77\x70\x6b\x3d','\x61\x46\x7a\x44\x6e\x63\x4f\x74\x77\x36\x2f\x44\x6e\x67\x3d\x3d','\x77\x6f\x4a\x77\x47\x63\x4b\x76\x77\x35\x38\x67\x77\x36\x6f\x72\x4a\x38\x4b\x63\x65\x73\x4f\x30\x42\x44\x54\x43\x68\x77\x3d\x3d','\x4d\x57\x37\x44\x68\x6e\x2f\x43\x67\x73\x4b\x35\x77\x71\x39\x78\x77\x70\x54\x44\x6d\x41\x70\x67\x77\x36\x6a\x43\x6b\x77\x3d\x3d','\x77\x37\x67\x76\x63\x53\x78\x75','\x4b\x78\x51\x6e\x4c\x58\x59\x74\x77\x36\x50\x43\x6f\x63\x4b\x53\x77\x35\x39\x65\x77\x70\x2f\x43\x76\x38\x4b\x4a','\x77\x34\x4c\x43\x69\x46\x59\x32','\x65\x33\x58\x44\x70\x38\x4b\x59\x77\x35\x49\x3d','\x41\x56\x44\x44\x75\x48\x4c\x43\x6c\x77\x3d\x3d','\x77\x6f\x68\x72\x43\x4d\x4f\x36\x77\x72\x2f\x43\x75\x73\x4b\x4b\x77\x37\x48\x43\x6f\x38\x4b\x34\x77\x6f\x62\x43\x6a\x48\x34\x6f','\x56\x32\x33\x44\x6e\x4d\x4b\x69\x77\x36\x63\x3d','\x57\x63\x4b\x33\x77\x35\x55\x48\x55\x4d\x4f\x69\x77\x70\x78\x4a\x77\x37\x62\x44\x6b\x7a\x5a\x4e\x77\x34\x6f\x4c\x44\x51\x3d\x3d','\x4b\x30\x48\x44\x6d\x69\x58\x44\x6d\x4d\x4f\x32\x5a\x51\x3d\x3d','\x77\x37\x35\x74\x65\x6e\x70\x76','\x77\x37\x66\x43\x70\x56\x77\x3d','\x62\x30\x48\x44\x6c\x41\x3d\x3d','\x77\x6f\x52\x58\x43\x4d\x4b\x39\x77\x35\x6f\x3d','\x77\x34\x6a\x43\x6c\x56\x59\x32','\x77\x36\x6f\x4c\x5a\x52\x34\x3d','\x4f\x7a\x31\x6e\x43\x4d\x4b\x63','\x77\x34\x73\x55\x59\x53\x37\x44\x71\x77\x3d\x3d','\x77\x34\x2f\x43\x6d\x54\x62\x43\x6b\x63\x4b\x61','\x77\x72\x4c\x43\x69\x63\x4f\x61\x58\x54\x6b\x3d','\x43\x73\x4f\x4a\x48\x73\x4b\x61\x77\x36\x4e\x64\x77\x71\x4c\x43\x72\x73\x4f\x33\x4e\x73\x4f\x55\x61\x38\x4f\x34\x77\x35\x73\x3d','\x77\x37\x77\x32\x56\x41\x70\x73\x41\x32\x48\x43\x70\x44\x76\x44\x74\x63\x4f\x32\x52\x73\x4f\x54\x77\x35\x62\x43\x6f\x57\x38\x42\x77\x72\x37\x44\x74\x73\x4b\x30\x62\x63\x4f\x53','\x77\x34\x59\x38\x53\x7a\x37\x44\x6d\x33\x45\x3d','\x54\x4d\x4b\x61\x56\x4d\x4b\x39\x77\x6f\x7a\x44\x76\x41\x3d\x3d','\x65\x63\x4b\x79\x77\x34\x63\x4f','\x77\x72\x30\x31\x58\x4d\x4f\x79\x77\x34\x6f\x3d','\x77\x34\x6a\x43\x6e\x6c\x63\x6c\x77\x6f\x46\x67\x77\x6f\x59\x3d','\x47\x73\x4b\x34\x4d\x38\x4b\x67\x77\x35\x6f\x3d','\x77\x70\x39\x43\x54\x4d\x4b\x52\x48\x41\x3d\x3d','\x58\x63\x4b\x76\x56\x4d\x4b\x75\x77\x35\x73\x3d','\x53\x63\x4b\x72\x77\x37\x41\x55\x52\x41\x3d\x3d','\x77\x6f\x58\x44\x69\x4d\x4b\x50\x57\x48\x41\x3d','\x77\x34\x34\x6c\x64\x79\x76\x44\x71\x41\x55\x3d','\x77\x34\x76\x43\x6a\x57\x31\x35\x77\x72\x4d\x3d','\x52\x73\x4b\x6d\x48\x63\x4f\x53\x77\x37\x55\x61\x49\x4d\x4f\x45','\x77\x71\x73\x61\x57\x4d\x4b\x51\x63\x38\x4f\x30\x54\x41\x3d\x3d','\x4d\x63\x4f\x4c\x77\x72\x48\x43\x74\x6d\x48\x43\x6b\x52\x62\x44\x6e\x77\x3d\x3d','\x50\x45\x33\x44\x6c\x69\x66\x44\x69\x38\x4f\x6f\x61\x4d\x4b\x48','\x45\x51\x48\x44\x74\x45\x6e\x44\x74\x42\x76\x43\x74\x4d\x4b\x74','\x77\x70\x55\x73\x77\x71\x58\x44\x74\x73\x4b\x47\x65\x67\x3d\x3d','\x77\x37\x55\x56\x56\x42\x72\x44\x6a\x30\x38\x31\x51\x77\x3d\x3d','\x51\x31\x7a\x43\x6e\x73\x4f\x46\x4f\x38\x4b\x4a\x5a\x73\x4f\x37','\x77\x35\x62\x43\x6c\x41\x62\x43\x71\x73\x4b\x42\x63\x6a\x68\x76','\x57\x33\x76\x44\x6e\x63\x4b\x67\x77\x34\x4d\x3d','\x77\x71\x44\x43\x70\x53\x2f\x43\x70\x4d\x4f\x41','\x77\x34\x78\x72\x62\x31\x78\x2b','\x5a\x4d\x4f\x31\x77\x71\x2f\x43\x67\x7a\x45\x63\x61\x41\x3d\x3d','\x77\x71\x45\x65\x64\x63\x4b\x74\x66\x41\x3d\x3d','\x77\x35\x31\x57\x77\x6f\x68\x35\x4f\x51\x3d\x3d','\x62\x38\x4b\x68\x77\x36\x55\x78\x61\x41\x3d\x3d','\x77\x35\x6f\x34\x53\x43\x64\x73','\x51\x63\x4b\x4e\x54\x38\x4b\x4a\x77\x34\x73\x3d','\x63\x73\x4b\x50\x65\x38\x4b\x4f\x77\x35\x45\x3d','\x77\x35\x31\x38\x77\x71\x49\x77\x77\x70\x30\x3d','\x77\x72\x56\x43\x59\x63\x4b\x37\x44\x41\x3d\x3d','\x77\x36\x4e\x51\x77\x70\x76\x43\x70\x73\x4f\x79','\x77\x37\x6c\x79\x63\x30\x5a\x66\x77\x37\x77\x74\x45\x33\x55\x43\x64\x38\x4f\x31\x54\x42\x38\x3d','\x77\x37\x6c\x43\x77\x70\x51\x37\x77\x6f\x6f\x3d','\x43\x73\x4f\x37\x77\x70\x4c\x43\x68\x30\x62\x44\x6d\x77\x3d\x3d','\x47\x41\x76\x43\x74\x41\x3d\x3d','\x77\x34\x76\x43\x6a\x57\x31\x35\x77\x35\x34\x2f\x4f\x51\x3d\x3d','\x59\x4d\x4b\x45\x77\x35\x34\x76\x64\x67\x3d\x3d','\x77\x70\x55\x73\x77\x71\x58\x44\x74\x73\x4f\x67\x65\x77\x55\x3d','\x77\x36\x66\x44\x74\x38\x4f\x48\x45\x63\x4f\x70','\x4c\x38\x4b\x6c\x47\x4d\x4b\x74\x77\x36\x30\x62','\x4a\x73\x4b\x75\x46\x63\x4b\x6c\x77\x37\x30\x57','\x77\x72\x50\x43\x69\x6a\x54\x43\x75\x33\x45\x3d','\x4c\x46\x76\x44\x6f\x51\x62\x44\x6d\x38\x4f\x2f\x77\x70\x68\x56\x77\x36\x46\x35\x77\x6f\x39\x59\x77\x37\x59\x67','\x44\x41\x76\x43\x74\x45\x72\x43\x73\x77\x6e\x44\x70\x42\x30\x56\x77\x70\x44\x44\x6a\x73\x4b\x49\x77\x71\x34\x3d','\x53\x73\x4f\x39\x77\x72\x62\x43\x6e\x67\x41\x3d','\x77\x34\x33\x43\x6b\x77\x48\x43\x72\x51\x3d\x3d','\x77\x37\x52\x75\x77\x70\x58\x43\x6f\x63\x4f\x37\x62\x4d\x4f\x66\x77\x72\x6a\x44\x71\x44\x31\x74\x77\x34\x37\x44\x6c\x6c\x73\x3d','\x42\x63\x4b\x54\x4a\x73\x4b\x41\x77\x36\x41\x3d','\x57\x63\x4b\x69\x77\x34\x73\x48\x52\x51\x3d\x3d','\x77\x71\x73\x61\x57\x4d\x4b\x51\x63\x38\x4f\x32\x53\x41\x3d\x3d','\x42\x33\x33\x44\x74\x52\x62\x44\x72\x4d\x4b\x70\x4f\x77\x3d\x3d','\x77\x36\x37\x43\x70\x6c\x55\x72\x77\x72\x6f\x3d','\x4e\x63\x4f\x34\x4e\x4d\x4b\x71\x77\x35\x4a\x33','\x77\x34\x46\x44\x54\x6d\x49\x3d','\x47\x53\x77\x50\x46\x56\x41\x3d','\x4a\x51\x39\x30\x4b\x38\x4b\x30\x77\x70\x78\x76\x5a\x38\x4b\x71\x77\x34\x72\x43\x70\x63\x4b\x62\x77\x70\x68\x38','\x4e\x4d\x4f\x53\x46\x63\x4b\x63\x77\x37\x45\x3d','\x4e\x67\x6b\x71\x47\x55\x51\x3d','\x59\x33\x33\x43\x75\x4d\x4f\x7a\x44\x4d\x4b\x35\x57\x4d\x4f\x53\x45\x38\x4f\x4e\x49\x6a\x54\x43\x72\x45\x49\x3d','\x77\x34\x76\x44\x6c\x63\x4f\x61\x43\x4d\x4f\x49','\x77\x70\x50\x43\x71\x4d\x4f\x4f\x52\x43\x6b\x3d','\x77\x70\x4e\x36\x44\x63\x4f\x39\x77\x71\x2f\x44\x69\x38\x4f\x6e','\x77\x70\x48\x44\x73\x38\x4f\x57\x52\x4d\x4b\x2b','\x77\x71\x6a\x43\x6e\x7a\x72\x43\x6f\x48\x42\x6e\x77\x6f\x62\x43\x6e\x55\x4d\x5a\x77\x70\x33\x44\x69\x4d\x4b\x56\x77\x72\x63\x3d','\x44\x47\x72\x44\x6c\x7a\x6a\x44\x76\x38\x4f\x52\x77\x71\x35\x2f\x77\x35\x5a\x76\x77\x72\x68\x72\x77\x35\x41\x45\x77\x71\x6b\x3d','\x77\x71\x70\x58\x59\x38\x4b\x31\x44\x4d\x4f\x78','\x77\x72\x50\x43\x67\x38\x4f\x70\x77\x70\x59\x34\x64\x77\x3d\x3d','\x4d\x78\x46\x39\x45\x73\x4b\x38','\x43\x73\x4f\x37\x77\x70\x4c\x43\x68\x30\x62\x44\x6b\x45\x55\x3d','\x4a\x67\x58\x44\x75\x33\x48\x44\x67\x67\x3d\x3d','\x77\x6f\x58\x43\x67\x42\x54\x43\x70\x73\x4f\x31','\x77\x70\x6e\x44\x6a\x63\x4f\x4a\x52\x4d\x4b\x58','\x77\x34\x7a\x43\x73\x41\x4c\x43\x69\x4d\x4b\x48','\x57\x45\x37\x43\x69\x63\x4f\x77\x49\x67\x3d\x3d','\x77\x72\x6e\x43\x6e\x52\x6a\x43\x67\x63\x4f\x2f','\x77\x6f\x55\x74\x64\x73\x4b\x74\x65\x63\x4b\x76\x43\x51\x3d\x3d','\x45\x63\x4f\x76\x43\x63\x4b\x41\x77\x35\x38\x3d','\x77\x37\x44\x44\x76\x38\x4f\x61\x48\x73\x4f\x50','\x43\x51\x6a\x43\x68\x6b\x2f\x43\x74\x51\x3d\x3d','\x58\x44\x72\x44\x72\x4d\x4f\x44\x77\x35\x41\x3d','\x56\x38\x4b\x70\x58\x4d\x4b\x69\x77\x34\x77\x3d','\x77\x34\x45\x6b\x52\x52\x7a\x44\x6c\x77\x3d\x3d','\x77\x35\x37\x43\x6b\x6b\x30\x6a\x77\x72\x49\x3d','\x45\x38\x4f\x6c\x52\x38\x4b\x59\x4d\x79\x4a\x63\x64\x30\x4d\x31\x42\x77\x3d\x3d','\x77\x34\x33\x43\x68\x67\x58\x43\x6b\x63\x4b\x4a','\x77\x34\x6b\x77\x58\x51\x74\x41\x48\x32\x66\x43\x6c\x43\x33\x44\x70\x63\x4f\x33','\x77\x37\x2f\x43\x6b\x58\x41\x4a\x77\x70\x4d\x3d','\x61\x58\x4a\x34\x77\x72\x6a\x44\x6d\x51\x3d\x3d','\x59\x63\x4b\x64\x77\x37\x30\x47\x61\x51\x3d\x3d','\x77\x70\x30\x4f\x61\x4d\x4f\x7a\x77\x37\x49\x3d','\x44\x67\x4d\x56\x47\x33\x30\x3d','\x46\x44\x66\x44\x6f\x45\x6e\x44\x69\x41\x3d\x3d','\x77\x70\x6f\x70\x55\x4d\x4f\x39\x77\x37\x41\x3d','\x65\x30\x66\x44\x76\x73\x4b\x46\x77\x35\x4d\x3d','\x77\x70\x51\x44\x77\x71\x48\x44\x69\x38\x4f\x68','\x77\x34\x78\x44\x77\x71\x42\x44\x4a\x73\x4b\x6a\x77\x36\x50\x44\x70\x46\x30\x44\x77\x6f\x55\x4a\x77\x37\x4c\x44\x69\x77\x3d\x3d','\x77\x37\x35\x37\x77\x6f\x68\x37\x41\x41\x3d\x3d','\x62\x4d\x4b\x41\x47\x73\x4f\x44\x77\x36\x77\x3d','\x77\x71\x6a\x43\x72\x4d\x4f\x64\x52\x78\x73\x3d','\x77\x35\x45\x67\x77\x37\x33\x44\x70\x6d\x67\x3d','\x54\x73\x4b\x55\x77\x36\x77\x70\x54\x42\x74\x36\x77\x35\x52\x79\x44\x73\x4f\x53\x65\x33\x31\x6f','\x65\x38\x4f\x73\x77\x37\x6c\x45\x4b\x4d\x4b\x71\x63\x43\x6b\x66\x77\x72\x7a\x44\x6b\x69\x70\x43\x77\x36\x49\x3d','\x65\x47\x6a\x43\x74\x73\x4f\x6f\x44\x51\x3d\x3d','\x66\x47\x52\x35\x77\x6f\x54\x44\x68\x41\x3d\x3d','\x57\x38\x4f\x68\x77\x37\x46\x39\x42\x67\x3d\x3d','\x4c\x6e\x4d\x57\x77\x70\x2f\x44\x6b\x67\x3d\x3d','\x77\x35\x41\x34\x77\x35\x76\x44\x68\x55\x41\x3d','\x56\x38\x4f\x32\x77\x36\x35\x7a\x43\x67\x3d\x3d','\x77\x35\x48\x43\x75\x46\x74\x4d\x77\x35\x30\x3d','\x4f\x31\x66\x44\x71\x7a\x50\x44\x6a\x63\x4f\x38\x4d\x51\x3d\x3d','\x59\x45\x4e\x76\x77\x70\x6a\x44\x69\x79\x41\x71','\x77\x72\x67\x54\x77\x71\x6e\x44\x73\x4d\x4f\x34','\x77\x34\x41\x32\x77\x37\x44\x43\x71\x31\x4c\x43\x6d\x4d\x4f\x73\x77\x34\x6f\x3d','\x77\x36\x44\x44\x6b\x63\x4f\x33\x44\x4d\x4f\x76','\x77\x35\x52\x4b\x77\x72\x33\x43\x6e\x38\x4f\x4b','\x58\x58\x45\x72\x45\x4d\x4f\x74','\x41\x4d\x4f\x55\x77\x70\x66\x43\x74\x6d\x6b\x3d','\x43\x38\x4f\x58\x53\x38\x4b\x57\x4d\x67\x3d\x3d','\x77\x34\x42\x67\x63\x55\x56\x2f','\x65\x46\x50\x43\x71\x63\x4f\x64\x4c\x41\x3d\x3d','\x52\x79\x33\x44\x6f\x63\x4f\x77\x77\x35\x34\x3d','\x51\x47\x51\x72\x4c\x38\x4f\x33','\x77\x70\x62\x44\x74\x4d\x4b\x55\x45\x4d\x4b\x38','\x77\x70\x62\x43\x6f\x63\x4f\x41\x77\x6f\x55\x6c','\x77\x35\x67\x42\x54\x53\x7a\x44\x76\x67\x3d\x3d','\x77\x70\x74\x50\x42\x63\x4b\x56\x77\x35\x73\x3d','\x77\x6f\x7a\x43\x69\x68\x62\x43\x68\x63\x4f\x6d','\x4b\x68\x62\x43\x6b\x58\x76\x43\x71\x77\x3d\x3d','\x77\x36\x6a\x43\x6a\x38\x4f\x6b\x77\x70\x49\x4e\x5a\x57\x6f\x71\x4d\x47\x2f\x43\x75\x38\x4b\x2f','\x77\x6f\x63\x39\x63\x73\x4b\x31\x51\x77\x3d\x3d','\x54\x4d\x4b\x6f\x77\x37\x45\x2f\x5a\x41\x3d\x3d','\x77\x71\x42\x71\x44\x38\x4b\x46\x77\x36\x30\x3d','\x77\x70\x33\x43\x75\x52\x48\x43\x6d\x6d\x70\x50\x77\x71\x6f\x3d','\x42\x69\x6c\x66\x43\x4d\x4b\x65\x77\x71\x70\x4a\x52\x38\x4b\x64','\x77\x37\x6f\x57\x57\x52\x72\x44\x76\x43\x41\x4e\x77\x6f\x77\x3d','\x62\x4d\x4f\x69\x77\x34\x70\x64','\x62\x73\x4f\x75\x77\x35\x78\x6f\x4c\x77\x3d\x3d','\x77\x34\x74\x4a\x77\x6f\x48\x43\x6b\x63\x4f\x70','\x4b\x48\x66\x44\x68\x6a\x66\x44\x69\x67\x3d\x3d','\x57\x79\x7a\x44\x6d\x63\x4f\x79\x77\x34\x34\x3d','\x46\x4d\x4f\x55\x65\x38\x4b\x37\x4d\x77\x35\x67\x53\x48\x55\x5a\x49\x31\x73\x69\x77\x34\x59\x3d','\x77\x36\x6b\x36\x65\x67\x70\x78\x46\x7a\x7a\x43\x70\x44\x72\x44\x74\x4d\x4f\x33\x57\x38\x4f\x69\x77\x34\x4d\x3d','\x77\x35\x51\x52\x52\x52\x66\x44\x72\x41\x3d\x3d','\x77\x35\x6b\x33\x51\x68\x4a\x55','\x77\x37\x35\x47\x77\x72\x46\x4f\x44\x41\x3d\x3d','\x42\x33\x33\x44\x74\x52\x62\x44\x72\x4d\x4b\x69','\x48\x38\x4f\x31\x64\x38\x4b\x75\x49\x41\x3d\x3d','\x64\x4d\x4f\x46\x77\x71\x62\x43\x6b\x54\x49\x3d','\x77\x72\x50\x43\x6d\x38\x4f\x55\x66\x52\x73\x3d','\x77\x34\x72\x43\x6d\x4d\x4f\x6c\x77\x72\x77\x34','\x77\x6f\x76\x43\x76\x63\x4f\x2f\x55\x6a\x45\x3d','\x53\x4d\x4f\x32\x77\x71\x58\x43\x6c\x78\x30\x3d','\x77\x6f\x54\x44\x6e\x4d\x4f\x33\x51\x63\x4b\x2f','\x77\x37\x48\x43\x6e\x57\x70\x4b\x77\x37\x34\x3d','\x5a\x33\x78\x69\x77\x70\x4c\x44\x70\x77\x3d\x3d','\x66\x63\x4b\x57\x50\x73\x4f\x6a\x77\x35\x4a\x51','\x77\x35\x33\x43\x71\x63\x4f\x50\x77\x71\x67\x4c\x54\x31\x51\x49\x49\x55\x6e\x43\x69\x63\x4b\x62\x4c\x7a\x59\x3d','\x4f\x4d\x4f\x78\x4e\x73\x4b\x69\x77\x34\x55\x3d','\x62\x32\x4d\x4c\x47\x73\x4f\x58\x77\x72\x67\x3d','\x52\x46\x54\x44\x74\x73\x4b\x75\x77\x37\x45\x3d','\x48\x6b\x37\x44\x76\x41\x72\x44\x6d\x77\x3d\x3d','\x77\x35\x34\x51\x77\x37\x54\x44\x67\x55\x55\x3d','\x53\x38\x4f\x63\x77\x6f\x66\x43\x67\x6a\x49\x3d','\x4e\x6c\x30\x34\x77\x71\x2f\x44\x73\x30\x59\x54\x77\x70\x45\x70\x43\x38\x4f\x41\x55\x56\x37\x44\x75\x67\x6e\x44\x6e\x52\x45\x51','\x77\x34\x7a\x43\x72\x53\x48\x43\x6e\x38\x4b\x42','\x65\x47\x7a\x43\x76\x63\x4f\x30\x65\x73\x4f\x4a','\x77\x34\x78\x6f\x77\x72\x50\x43\x70\x4d\x4f\x32','\x77\x34\x34\x39\x5a\x42\x64\x67','\x51\x31\x38\x6b\x4b\x63\x4f\x6a\x77\x36\x78\x2b','\x55\x58\x6a\x44\x6b\x73\x4b\x39\x77\x37\x45\x3d','\x51\x6d\x7a\x44\x67\x41\x3d\x3d','\x77\x71\x33\x44\x6d\x73\x4b\x49','\x46\x32\x77\x62\x77\x70\x48\x44\x68\x58\x41\x70\x77\x72\x4d\x6b\x4d\x4d\x4f\x33\x5a\x31\x58\x44\x69\x51\x3d\x3d','\x77\x34\x62\x43\x75\x4d\x4f\x4b\x77\x71\x38\x62\x4e\x51\x3d\x3d','\x58\x30\x33\x44\x74\x63\x4b\x5a\x77\x37\x59\x3d','\x77\x6f\x35\x33\x54\x4d\x4b\x43\x53\x38\x4b\x72','\x4d\x51\x48\x44\x6f\x6e\x37\x44\x6c\x41\x3d\x3d','\x77\x72\x4e\x59\x4c\x63\x4f\x33\x77\x6f\x41\x3d','\x77\x37\x6e\x44\x6a\x38\x4f\x2f\x4b\x4d\x4f\x59','\x45\x77\x33\x44\x6f\x33\x48\x44\x6e\x41\x3d\x3d','\x77\x70\x6e\x43\x6c\x7a\x2f\x43\x6e\x38\x4f\x49\x77\x36\x31\x47\x44\x38\x4b\x77\x77\x6f\x37\x43\x6d\x41\x3d\x3d','\x5a\x38\x4f\x6b\x77\x34\x64\x72\x4a\x67\x3d\x3d','\x77\x37\x62\x43\x6c\x79\x33\x43\x68\x4d\x4b\x41','\x64\x47\x7a\x43\x6d\x63\x4f\x54\x41\x41\x3d\x3d','\x51\x56\x56\x71\x77\x71\x48\x44\x6b\x67\x3d\x3d','\x77\x37\x66\x43\x70\x33\x4e\x44\x77\x37\x68\x54\x65\x48\x6a\x44\x67\x54\x33\x44\x75\x79\x67\x3d','\x65\x63\x4b\x6c\x77\x34\x73\x52\x62\x54\x77\x3d','\x77\x6f\x4c\x43\x69\x73\x4f\x61\x56\x67\x49\x53\x77\x34\x33\x43\x76\x67\x3d\x3d','\x41\x54\x37\x43\x75\x56\x2f\x43\x6b\x41\x3d\x3d','\x56\x46\x59\x6d\x49\x38\x4f\x32','\x49\x58\x38\x2b\x77\x71\x33\x44\x67\x77\x3d\x3d','\x77\x70\x33\x43\x74\x4d\x4f\x48\x77\x71\x73\x75\x4a\x33\x38\x74\x65\x63\x4b\x78\x77\x34\x73\x6f','\x77\x72\x66\x44\x73\x63\x4b\x77\x65\x30\x41\x3d','\x77\x37\x72\x44\x75\x38\x4f\x6b\x50\x63\x4f\x74','\x77\x70\x6c\x51\x48\x73\x4b\x4e\x77\x37\x59\x3d','\x77\x35\x4e\x5a\x77\x70\x7a\x43\x75\x73\x4f\x73','\x77\x71\x39\x63\x41\x63\x4f\x68\x77\x71\x67\x3d','\x62\x73\x4b\x77\x77\x34\x51\x58\x66\x51\x3d\x3d','\x77\x35\x37\x43\x69\x46\x59\x72\x77\x72\x39\x6c\x77\x6f\x34\x3d','\x52\x38\x4b\x38\x45\x4d\x4f\x65\x77\x35\x67\x42\x4a\x51\x3d\x3d','\x77\x36\x56\x76\x77\x72\x5a\x6c\x42\x41\x3d\x3d','\x77\x70\x66\x44\x69\x73\x4b\x47\x55\x46\x74\x66\x77\x34\x6b\x3d','\x77\x37\x59\x42\x52\x42\x37\x44\x6b\x30\x6b\x4c\x57\x38\x4f\x78\x77\x71\x72\x43\x74\x4d\x4f\x37\x77\x70\x2f\x43\x75\x67\x3d\x3d','\x57\x63\x4b\x6d\x77\x34\x59\x63\x52\x63\x4f\x4c\x77\x70\x74\x48\x77\x37\x62\x44\x76\x67\x3d\x3d','\x66\x38\x4f\x69\x77\x35\x52\x55\x4d\x73\x4b\x34\x46\x78\x63\x65\x77\x71\x33\x44\x67\x52\x78\x46\x77\x36\x45\x3d','\x4d\x73\x4f\x66\x77\x71\x48\x43\x73\x6e\x33\x43\x6c\x79\x6a\x44\x68\x30\x5a\x30\x42\x73\x4f\x31\x61\x63\x4f\x63','\x4e\x31\x30\x75','\x77\x36\x48\x43\x76\x56\x70\x41\x77\x36\x38\x3d','\x77\x37\x52\x6e\x77\x6f\x73\x77\x77\x70\x41\x3d','\x50\x4d\x4f\x76\x4b\x4d\x4b\x69\x77\x35\x51\x3d','\x77\x70\x78\x6a\x43\x73\x4b\x32\x77\x35\x6b\x7a\x77\x37\x73\x62\x4e\x41\x3d\x3d','\x44\x42\x58\x44\x6f\x45\x48\x44\x6f\x51\x6a\x43\x6f\x63\x4b\x37\x77\x35\x63\x3d','\x77\x34\x6a\x43\x68\x41\x44\x43\x71\x73\x4b\x66','\x77\x37\x66\x43\x76\x47\x70\x2b\x77\x34\x4d\x3d','\x77\x37\x46\x6a\x77\x6f\x45\x65\x77\x6f\x77\x3d','\x63\x57\x72\x44\x6f\x73\x4f\x64\x77\x36\x38\x3d','\x77\x37\x77\x52\x77\x34\x48\x44\x70\x6e\x73\x3d','\x77\x36\x6a\x43\x69\x6c\x59\x57\x77\x6f\x73\x3d','\x59\x78\x76\x44\x76\x73\x4f\x70\x77\x35\x49\x3d','\x77\x6f\x4c\x43\x6a\x38\x4f\x55\x58\x67\x51\x3d','\x5a\x73\x4f\x6e\x77\x37\x6c\x46\x4d\x38\x4b\x54\x4f\x68\x4d\x4b\x77\x70\x66\x44\x6a\x53\x4a\x63','\x77\x72\x2f\x43\x6c\x79\x48\x43\x74\x4d\x4f\x34\x77\x36\x64\x36\x43\x63\x4b\x77\x77\x72\x54\x43\x68\x38\x4b\x33\x77\x6f\x31\x47\x77\x70\x4e\x6b\x5a\x41\x44\x43\x6b\x67\x4a\x42\x77\x34\x34\x3d','\x4a\x38\x4b\x6c\x47\x73\x4b\x76\x77\x36\x30\x57','\x6a\x51\x73\x6a\x69\x61\x68\x79\x6d\x69\x2e\x79\x46\x63\x67\x49\x6f\x46\x6d\x2e\x76\x59\x53\x36\x44\x54\x3d\x3d'];(function(_0x7a1ec0,_0x5c6845,_0x5e3e17){var _0x8cec6e=function(_0xd9a70b,_0x5d393a,_0x1c7d08,_0x39239e,_0x505680){_0x5d393a=_0x5d393a>>0x8,_0x505680='po';var _0x48b018='shift',_0x98e75d='push';if(_0x5d393a<_0xd9a70b){while(--_0xd9a70b){_0x39239e=_0x7a1ec0[_0x48b018]();if(_0x5d393a===_0xd9a70b){_0x5d393a=_0x39239e;_0x1c7d08=_0x7a1ec0[_0x505680+'p']();}else if(_0x5d393a&&_0x1c7d08['replace'](/[QhyyFgIFYSDT=]/g,'')===_0x5d393a){_0x7a1ec0[_0x98e75d](_0x39239e);}}_0x7a1ec0[_0x98e75d](_0x7a1ec0[_0x48b018]());}return 0x51414;};var _0x4c7813=function(){var _0x5c33de={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x2e0ccd,_0x453dd3,_0x292589,_0x2ca825){_0x2ca825=_0x2ca825||{};var _0x4ce81a=_0x453dd3+'='+_0x292589;var _0x573305=0x0;for(var _0x573305=0x0,_0x5d028e=_0x2e0ccd['length'];_0x573305<_0x5d028e;_0x573305++){var _0x91cbfd=_0x2e0ccd[_0x573305];_0x4ce81a+=';\x20'+_0x91cbfd;var _0x5f1317=_0x2e0ccd[_0x91cbfd];_0x2e0ccd['push'](_0x5f1317);_0x5d028e=_0x2e0ccd['length'];if(_0x5f1317!==!![]){_0x4ce81a+='='+_0x5f1317;}}_0x2ca825['cookie']=_0x4ce81a;},'removeCookie':function(){return'dev';},'getCookie':function(_0x3fefc4,_0x17c43b){_0x3fefc4=_0x3fefc4||function(_0x16b861){return _0x16b861;};var _0x5a78b9=_0x3fefc4(new RegExp('(?:^|;\x20)'+_0x17c43b['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x2a2323=typeof _0xodL=='undefined'?'undefined':_0xodL,_0x271c45=_0x2a2323['split'](''),_0x25b4b1=_0x271c45['length'],_0x471838=_0x25b4b1-0xe,_0x5b81cb;while(_0x5b81cb=_0x271c45['pop']()){_0x25b4b1&&(_0x471838+=_0x5b81cb['charCodeAt']());}var _0x44ca26=function(_0x3d4fb2,_0x56d39f,_0x3e69c4){_0x3d4fb2(++_0x56d39f,_0x3e69c4);};_0x471838^-_0x25b4b1===-0x524&&(_0x5b81cb=_0x471838)&&_0x44ca26(_0x8cec6e,_0x5c6845,_0x5e3e17);return _0x5b81cb>>0x2===0x14b&&_0x5a78b9?decodeURIComponent(_0x5a78b9[0x1]):undefined;}};var _0x58d538=function(){var _0x51c134=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x51c134['test'](_0x5c33de['removeCookie']['toString']());};_0x5c33de['updateCookie']=_0x58d538;var _0x4283a2='';var _0x7e528f=_0x5c33de['updateCookie']();if(!_0x7e528f){_0x5c33de['setCookie'](['*'],'counter',0x1);}else if(_0x7e528f){_0x4283a2=_0x5c33de['getCookie'](null,'counter');}else{_0x5c33de['removeCookie']();}};_0x4c7813();}(_0x3180,0x153,0x15300));var _0x283c=function(_0x1cba18,_0x43979e){_0x1cba18=~~'0x'['concat'](_0x1cba18);var _0x87785b=_0x3180[_0x1cba18];if(_0x283c['QvlVbk']===undefined){(function(){var _0x2fb003=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x5842df='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x2fb003['atob']||(_0x2fb003['atob']=function(_0x42cef4){var _0x225253=String(_0x42cef4)['replace'](/=+$/,'');for(var _0x56f1b3=0x0,_0x264c30,_0x4774ce,_0x26502a=0x0,_0x5314c4='';_0x4774ce=_0x225253['charAt'](_0x26502a++);~_0x4774ce&&(_0x264c30=_0x56f1b3%0x4?_0x264c30*0x40+_0x4774ce:_0x4774ce,_0x56f1b3++%0x4)?_0x5314c4+=String['fromCharCode'](0xff&_0x264c30>>(-0x2*_0x56f1b3&0x6)):0x0){_0x4774ce=_0x5842df['indexOf'](_0x4774ce);}return _0x5314c4;});}());var _0xbe59a9=function(_0x5ded4f,_0x43979e){var _0x32264c=[],_0x22566e=0x0,_0x36ae19,_0x32cfdf='',_0x2b65f6='';_0x5ded4f=atob(_0x5ded4f);for(var _0x1be1d9=0x0,_0x37d7bb=_0x5ded4f['length'];_0x1be1d9<_0x37d7bb;_0x1be1d9++){_0x2b65f6+='%'+('00'+_0x5ded4f['charCodeAt'](_0x1be1d9)['toString'](0x10))['slice'](-0x2);}_0x5ded4f=decodeURIComponent(_0x2b65f6);for(var _0x5b35c8=0x0;_0x5b35c8<0x100;_0x5b35c8++){_0x32264c[_0x5b35c8]=_0x5b35c8;}for(_0x5b35c8=0x0;_0x5b35c8<0x100;_0x5b35c8++){_0x22566e=(_0x22566e+_0x32264c[_0x5b35c8]+_0x43979e['charCodeAt'](_0x5b35c8%_0x43979e['length']))%0x100;_0x36ae19=_0x32264c[_0x5b35c8];_0x32264c[_0x5b35c8]=_0x32264c[_0x22566e];_0x32264c[_0x22566e]=_0x36ae19;}_0x5b35c8=0x0;_0x22566e=0x0;for(var _0x34ac72=0x0;_0x34ac72<_0x5ded4f['length'];_0x34ac72++){_0x5b35c8=(_0x5b35c8+0x1)%0x100;_0x22566e=(_0x22566e+_0x32264c[_0x5b35c8])%0x100;_0x36ae19=_0x32264c[_0x5b35c8];_0x32264c[_0x5b35c8]=_0x32264c[_0x22566e];_0x32264c[_0x22566e]=_0x36ae19;_0x32cfdf+=String['fromCharCode'](_0x5ded4f['charCodeAt'](_0x34ac72)^_0x32264c[(_0x32264c[_0x5b35c8]+_0x32264c[_0x22566e])%0x100]);}return _0x32cfdf;};_0x283c['GisJLX']=_0xbe59a9;_0x283c['CYWhzQ']={};_0x283c['QvlVbk']=!![];}var _0x1b12b0=_0x283c['CYWhzQ'][_0x1cba18];if(_0x1b12b0===undefined){if(_0x283c['wZRsLD']===undefined){var _0x4e94c7=function(_0x3261d0){this['Kjdiij']=_0x3261d0;this['BKRtMP']=[0x1,0x0,0x0];this['Jpvind']=function(){return'newState';};this['ulujUW']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['FGemtT']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x4e94c7['prototype']['APMbVb']=function(){var _0x468c5e=new RegExp(this['ulujUW']+this['FGemtT']);var _0x182d48=_0x468c5e['test'](this['Jpvind']['toString']())?--this['BKRtMP'][0x1]:--this['BKRtMP'][0x0];return this['wdBgxI'](_0x182d48);};_0x4e94c7['prototype']['wdBgxI']=function(_0x58a1bc){if(!Boolean(~_0x58a1bc)){return _0x58a1bc;}return this['Pxczun'](this['Kjdiij']);};_0x4e94c7['prototype']['Pxczun']=function(_0x508217){for(var _0x5922a2=0x0,_0x27f265=this['BKRtMP']['length'];_0x5922a2<_0x27f265;_0x5922a2++){this['BKRtMP']['push'](Math['round'](Math['random']()));_0x27f265=this['BKRtMP']['length'];}return _0x508217(this['BKRtMP'][0x0]);};new _0x4e94c7(_0x283c)['APMbVb']();_0x283c['wZRsLD']=!![];}_0x87785b=_0x283c['GisJLX'](_0x87785b,_0x43979e);_0x283c['CYWhzQ'][_0x1cba18]=_0x87785b;}else{_0x87785b=_0x1b12b0;}return _0x87785b;};var _0x2a89f1=function(){var _0x1dbe25=!![];return function(_0x1857d2,_0x555313){var _0x560ace=_0x1dbe25?function(){if(_0x555313){var _0xfb0809=_0x555313['apply'](_0x1857d2,arguments);_0x555313=null;return _0xfb0809;}}:function(){};_0x1dbe25=![];return _0x560ace;};}();var _0x5b87e9=_0x2a89f1(this,function(){var _0x5970d7=function(){return'\x64\x65\x76';},_0x40d8db=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x1b15bd=function(){var _0x471b5b=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x471b5b['\x74\x65\x73\x74'](_0x5970d7['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x2503da=function(){var _0x33eabd=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x33eabd['\x74\x65\x73\x74'](_0x40d8db['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x407c68=function(_0x5f3311){var _0x1e51fa=~-0x1>>0x1+0xff%0x0;if(_0x5f3311['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x1e51fa)){_0x1dcbd6(_0x5f3311);}};var _0x1dcbd6=function(_0x3d2cb1){var _0xf26a8c=~-0x4>>0x1+0xff%0x0;if(_0x3d2cb1['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0xf26a8c){_0x407c68(_0x3d2cb1);}};if(!_0x1b15bd()){if(!_0x2503da()){_0x407c68('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x407c68('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x407c68('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x5b87e9();const UUID=()=>_0x283c('0','\x48\x5e\x38\x66')[_0x283c('1','\x25\x68\x77\x32')](/[xy]/g,function(_0x59453e){var _0x4f5f11={'\x4b\x65\x73\x4b\x63':function(_0x14b747,_0x55b377){return _0x14b747|_0x55b377;},'\x69\x51\x4a\x62\x56':function(_0xf6a83f,_0x24ae57){return _0xf6a83f*_0x24ae57;},'\x75\x71\x4b\x43\x6a':function(_0x39b364,_0x5112e0){return _0x39b364===_0x5112e0;},'\x4c\x45\x54\x66\x43':function(_0x2db7ee,_0x553c2e){return _0x2db7ee&_0x553c2e;}};var _0x51356e=_0x4f5f11['\x4b\x65\x73\x4b\x63'](_0x4f5f11['\x69\x51\x4a\x62\x56'](0x10,Math['\x72\x61\x6e\x64\x6f\x6d']()),0x0);return(_0x4f5f11[_0x283c('2','\x70\x41\x28\x67')]('\x78',_0x59453e)?_0x51356e:_0x4f5f11[_0x283c('3','\x63\x63\x58\x50')](_0x4f5f11[_0x283c('4','\x52\x39\x23\x38')](0x3,_0x51356e),0x8))['\x74\x6f\x53\x74\x72\x69\x6e\x67'](0x10);});class HeartGiftRoom{constructor(_0x30835f,_0x15a683){var _0xe085f9={'\x44\x67\x54\x61\x4d':_0x283c('5','\x7a\x68\x42\x62'),'\x72\x5a\x44\x6a\x52':function(_0x583a93,_0x12483c){return _0x583a93(_0x12483c);},'\x65\x57\x62\x47\x63':_0x283c('6','\x58\x4b\x4f\x4e'),'\x52\x62\x48\x4a\x73':function(_0x101c29){return _0x101c29();}};var _0x2dde62=_0xe085f9['\x44\x67\x54\x61\x4d'][_0x283c('7','\x58\x42\x5d\x47')]('\x7c'),_0x5ccdee=0x0;while(!![]){switch(_0x2dde62[_0x5ccdee++]){case'\x30':this[_0x283c('8','\x6b\x43\x6a\x37')]=_0x30835f[_0x283c('9','\x2a\x44\x29\x21')];continue;case'\x31':this[_0x283c('a','\x66\x78\x5e\x29')]=_0x30835f;continue;case'\x32':this[_0x283c('b','\x29\x67\x41\x78')]=0x0;continue;case'\x33':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=_0x30835f[_0x283c('c','\x6a\x52\x4f\x63')];continue;case'\x34':this[_0x283c('d','\x71\x4b\x28\x4e')]=_0x15a683;continue;case'\x35':;continue;case'\x36':this[_0x283c('e','\x4b\x38\x76\x6b')]();continue;case'\x37':this['\x73\x65\x71']=0x0;continue;case'\x38':this[_0x283c('f','\x52\x39\x23\x38')]=_0xe085f9['\x72\x5a\x44\x6a\x52'](getCookie,_0xe085f9['\x65\x57\x62\x47\x63']);continue;case'\x39':this[_0x283c('10','\x4f\x43\x40\x56')]=_0x30835f['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x31\x30':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x31\x31':this['\x75\x75\x69\x64']=_0xe085f9[_0x283c('11','\x76\x41\x30\x52')](UUID);continue;case'\x31\x32':this['\x75\x61']=window&&window[_0x283c('12','\x4a\x7a\x46\x70')]?window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72']['\x75\x73\x65\x72\x41\x67\x65\x6e\x74']:'';continue;}break;}}async[_0x283c('13','\x6b\x43\x6a\x37')](){var _0x51540c={'\x41\x43\x67\x6d\x56':function(_0x58d04a,_0x8c45a1){return _0x58d04a>_0x8c45a1;},'\x74\x49\x54\x48\x68':function(_0x46aecf,_0x3984fa){return _0x46aecf==_0x3984fa;},'\x7a\x69\x64\x48\x50':function(_0x45532a,_0x412df0){return _0x45532a===_0x412df0;},'\x54\x68\x4b\x56\x52':_0x283c('14','\x24\x72\x69\x70'),'\x75\x6f\x53\x72\x61':'\x30\x7c\x33\x7c\x32\x7c\x31\x7c\x34','\x71\x54\x6f\x4b\x69':function(_0x52bf0e,_0x15afab,_0x26faad){return _0x52bf0e(_0x15afab,_0x26faad);},'\x77\x52\x78\x46\x55':function(_0x7dbc96,_0x595b32){return _0x7dbc96*_0x595b32;}};try{if(!HeartGift[_0x283c('15','\x4c\x37\x43\x58')]||_0x51540c['\x41\x43\x67\x6d\x56'](this['\x65\x72\x72\x6f\x72'],0x3))return;let _0x56f3cc={'\x69\x64':[this[_0x283c('16','\x46\x72\x31\x55')],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x283c('17','\x6b\x61\x37\x4e')],this['\x72\x6f\x6f\x6d\x5f\x69\x64']],'\x64\x65\x76\x69\x63\x65':[this[_0x283c('18','\x6b\x61\x37\x4e')],this[_0x283c('19','\x25\x68\x77\x32')]],'\x74\x73':new Date()[_0x283c('1a','\x6b\x61\x37\x4e')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x283c('1b','\x56\x34\x37\x55')](_0x56f3cc);let _0x151e3b=await BiliPushUtils['\x41\x50\x49'][_0x283c('1c','\x24\x72\x69\x70')][_0x283c('1d','\x71\x4b\x28\x4e')](_0x56f3cc,this[_0x283c('1e','\x78\x57\x48\x52')]);if(_0x51540c['\x74\x49\x54\x48\x68'](_0x151e3b[_0x283c('1f','\x63\x63\x58\x50')],0x0)){if(_0x51540c[_0x283c('20','\x74\x79\x71\x67')](_0x51540c['\x54\x68\x4b\x56\x52'],_0x51540c[_0x283c('21','\x66\x78\x5e\x29')])){var _0x364eec=_0x51540c['\x75\x6f\x53\x72\x61'][_0x283c('22','\x29\x21\x72\x39')]('\x7c'),_0x512f3d=0x0;while(!![]){switch(_0x364eec[_0x512f3d++]){case'\x30':++this['\x73\x65\x71'];continue;case'\x31':this[_0x283c('23','\x4b\x7a\x7a\x71')]=_0x151e3b[_0x283c('24','\x74\x79\x71\x67')][_0x283c('25','\x2a\x44\x29\x21')];continue;case'\x32':this[_0x283c('26','\x29\x67\x41\x78')]=_0x151e3b[_0x283c('27','\x58\x42\x5d\x47')]['\x73\x65\x63\x72\x65\x74\x5f\x6b\x65\x79'];continue;case'\x33':this['\x74\x69\x6d\x65']=_0x151e3b['\x64\x61\x74\x61'][_0x283c('28','\x6b\x69\x6a\x58')];continue;case'\x34':this[_0x283c('29','\x56\x34\x37\x55')]=_0x151e3b[_0x283c('2a','\x75\x47\x53\x40')][_0x283c('2b','\x75\x47\x53\x40')];continue;}break;}}else{r=Module[_0x283c('2c','\x6a\x52\x4f\x63')][_0x283c('2d','\x46\x73\x2a\x21')](r),Module[_0x283c('2e','\x52\x39\x23\x38')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x283c('2f','\x39\x29\x5e\x59')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5322c8){return{'\x65\x72\x72\x6f\x72':_0x5322c8,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}await _0x51540c[_0x283c('30','\x70\x41\x28\x67')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),_0x51540c['\x77\x52\x78\x46\x55'](this[_0x283c('31','\x58\x4b\x4f\x4e')],0x3e8));}catch(_0x37facb){this['\x65\x72\x72\x6f\x72']++;console[_0x283c('32','\x52\x39\x23\x38')](_0x37facb);await _0x51540c['\x71\x54\x6f\x4b\x69'](delayCall,()=>this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72'](),0x3e8);}}async['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](){var _0x1825b1={'\x45\x7a\x61\x62\x59':function(_0x4b41e3,_0x1c17c6){return _0x4b41e3>_0x1c17c6;},'\x77\x41\x4c\x71\x68':function(_0xf5871f,_0x1b3682){return _0xf5871f==_0x1b3682;},'\x76\x49\x4e\x6c\x49':function(_0x51a014,_0xfe571f){return _0x51a014<=_0xfe571f;},'\x4f\x46\x77\x72\x4c':function(_0x473d25,_0x167dfb,_0x4c2e84){return _0x473d25(_0x167dfb,_0x4c2e84);},'\x44\x49\x64\x79\x52':function(_0x271974,_0x4d06e9){return _0x271974*_0x4d06e9;},'\x75\x53\x74\x63\x5a':function(_0x52127f,_0x309329){return _0x52127f!==_0x309329;},'\x65\x6e\x61\x79\x4e':_0x283c('33','\x24\x72\x69\x70'),'\x6d\x53\x77\x6e\x4c':_0x283c('34','\x46\x72\x31\x55'),'\x4a\x69\x6c\x55\x42':function(_0x28f5ac,_0x1588d9){return _0x28f5ac(_0x1588d9);},'\x62\x78\x6d\x70\x66':function(_0x422d04,_0x3519b0,_0x3d700c){return _0x422d04(_0x3519b0,_0x3d700c);}};try{if(!HeartGift[_0x283c('35','\x7a\x68\x42\x62')]||_0x1825b1[_0x283c('36','\x4b\x6b\x45\x69')](this['\x65\x72\x72\x6f\x72'],0x3))return;let _0x3a751={'\x69\x64':[this[_0x283c('37','\x58\x4b\x4f\x4e')],this[_0x283c('38','\x67\x57\x32\x5e')],this[_0x283c('39','\x78\x57\x48\x52')],this[_0x283c('3a','\x29\x21\x72\x39')]],'\x64\x65\x76\x69\x63\x65':[this['\x62\x75\x76\x69\x64'],this['\x75\x75\x69\x64']],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x283c('3b','\x4b\x45\x34\x57')],'\x74\x69\x6d\x65':this[_0x283c('3c','\x47\x6b\x41\x4c')],'\x74\x73':new Date()[_0x283c('3d','\x6b\x69\x6a\x58')](),'\x75\x61':this['\x75\x61']};KeySign[_0x283c('3e','\x6b\x69\x6a\x58')](_0x3a751);let _0x48799f=BiliPushUtils[_0x283c('3f','\x57\x49\x4e\x6b')](JSON['\x73\x74\x72\x69\x6e\x67\x69\x66\x79'](_0x3a751),this[_0x283c('40','\x4a\x7a\x46\x70')]);if(_0x48799f){_0x3a751['\x73']=_0x48799f;let _0x53824b=await BiliPushUtils['\x41\x50\x49'][_0x283c('41','\x66\x78\x5e\x29')][_0x283c('42','\x58\x4b\x4f\x4e')](_0x3a751,this[_0x283c('43','\x65\x21\x70\x49')]);if(_0x1825b1[_0x283c('44','\x4b\x45\x34\x57')](_0x53824b[_0x283c('45','\x78\x57\x48\x52')],0x0)){console[_0x283c('46','\x4c\x31\x4c\x5b')](_0x283c('47','\x75\x47\x53\x40')+this[_0x283c('48','\x4f\x43\x40\x56')][_0x283c('49','\x47\x6b\x41\x4c')]+_0x283c('4a','\x4c\x37\x43\x58')+this[_0x283c('4b','\x58\x46\x74\x75')]+_0x283c('4c','\x6b\x61\x37\x4e'));++HeartGift[_0x283c('4d','\x54\x57\x35\x75')];++this[_0x283c('4e','\x47\x6b\x41\x4c')];this[_0x283c('3c','\x47\x6b\x41\x4c')]=_0x53824b[_0x283c('4f','\x78\x57\x48\x52')][_0x283c('50','\x52\x39\x23\x38')];this[_0x283c('51','\x54\x57\x35\x75')]=_0x53824b['\x64\x61\x74\x61'][_0x283c('52','\x4c\x31\x4c\x5b')];this[_0x283c('53','\x71\x4b\x28\x4e')]=_0x53824b[_0x283c('54','\x76\x41\x30\x52')][_0x283c('55','\x4b\x7a\x7a\x71')];this[_0x283c('56','\x6b\x43\x6a\x37')]=_0x53824b[_0x283c('2a','\x75\x47\x53\x40')][_0x283c('57','\x7a\x68\x42\x62')];if(_0x1825b1['\x76\x49\x4e\x6c\x49'](HeartGift[_0x283c('58','\x56\x34\x37\x55')],HeartGift[_0x283c('59','\x4b\x45\x34\x57')])&&HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){await _0x1825b1[_0x283c('5a','\x47\x6b\x41\x4c')](delayCall,()=>this[_0x283c('5b','\x4b\x7a\x7a\x71')](),_0x1825b1[_0x283c('5c','\x4a\x7a\x46\x70')](this['\x74\x69\x6d\x65'],0x3e8));}else{if(_0x1825b1['\x75\x53\x74\x63\x5a'](_0x1825b1[_0x283c('5d','\x32\x35\x46\x26')],_0x1825b1[_0x283c('5e','\x6b\x43\x6a\x37')])){if(HeartGift[_0x283c('5f','\x71\x4b\x28\x4e')]){console[_0x283c('60','\x4c\x37\x43\x58')]('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift[_0x283c('61','\x4e\x4b\x29\x6d')]=![];_0x1825b1[_0x283c('62','\x23\x7a\x79\x71')](runTomorrow,HeartGift[_0x283c('63','\x76\x41\x30\x52')]);}}else{return undefined;}}}}}catch(_0xb5a5cc){this[_0x283c('64','\x58\x55\x53\x69')]++;console['\x65\x72\x72\x6f\x72'](_0xb5a5cc);await _0x1825b1[_0x283c('65','\x74\x79\x71\x67')](delayCall,()=>this[_0x283c('66','\x23\x7a\x79\x71')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x5bdecf={'\x41\x71\x53\x6e\x67':function(_0x3824fa,_0x22aae1){return _0x3824fa===_0x22aae1;},'\x6a\x6f\x45\x4a\x72':_0x283c('67','\x25\x68\x77\x32'),'\x6c\x4b\x75\x77\x44':'\x58\x42\x76\x69\x53','\x75\x4c\x4b\x5a\x45':function(_0x43b828,_0xfa6adc){return _0x43b828!==_0xfa6adc;},'\x55\x64\x57\x69\x78':_0x283c('68','\x76\x41\x30\x52'),'\x56\x73\x66\x61\x6e':function(_0x47b4f3,_0x4f94f0){return _0x47b4f3==_0x4f94f0;},'\x65\x6f\x46\x73\x43':_0x283c('69','\x58\x42\x5d\x47'),'\x41\x58\x61\x58\x66':_0x283c('6a','\x6a\x52\x4f\x63'),'\x66\x73\x50\x5a\x77':_0x283c('6b','\x58\x4b\x4f\x4e'),'\x7a\x4d\x69\x67\x4c':_0x283c('6c','\x47\x6b\x41\x4c'),'\x4b\x72\x70\x53\x68':function(_0x103c7f,_0xa2f68f){return _0x103c7f>_0xa2f68f;},'\x69\x50\x50\x6c\x4d':'\u5f00\u59cb\u542f\u52a8\u5c0f\u5fc3\u5fc3\u5fc3\u8df3','\x63\x54\x73\x55\x50':function(_0x5d1a83,_0x18af50,_0x5de6ba){return _0x5d1a83(_0x18af50,_0x5de6ba);},'\x62\x43\x47\x6a\x52':function(_0x3fcad3,_0x538f70){return _0x3fcad3==_0x538f70;},'\x4d\x61\x6c\x66\x59':function(_0x19ce80,_0x1d5185){return _0x19ce80===_0x1d5185;},'\x63\x52\x47\x68\x45':_0x283c('6d','\x4b\x45\x34\x57'),'\x67\x69\x43\x59\x42':_0x283c('6e','\x32\x35\x4a\x45'),'\x5a\x6d\x75\x52\x65':function(_0x2fc08a,_0x41c93f,_0x275df1){return _0x2fc08a(_0x41c93f,_0x275df1);}};if(!HeartGift[_0x283c('6f','\x46\x72\x31\x55')]){if(_0x5bdecf[_0x283c('70','\x23\x7a\x79\x71')](_0x5bdecf['\x55\x64\x57\x69\x78'],_0x5bdecf['\x55\x64\x57\x69\x78'])){y=HEAPU8[index++];}else{HeartGift[_0x283c('71','\x4f\x31\x4f\x42')]=0x0;HeartGift[_0x283c('72','\x76\x41\x30\x52')]=!![];}}if(_0x5bdecf[_0x283c('73','\x4a\x7a\x46\x70')](BiliPushUtils['\x73\x69\x67\x6e'],null)){let _0x33b859=await HeartGift[_0x283c('74','\x39\x29\x5e\x59')](_0x5bdecf[_0x283c('75','\x47\x6b\x41\x4c')],HeartGift[_0x283c('76','\x4f\x43\x40\x56')]);if(_0x33b859){if(_0x5bdecf['\x41\x71\x53\x6e\x67'](_0x5bdecf[_0x283c('77','\x4f\x31\x4f\x42')],_0x5bdecf[_0x283c('78','\x4e\x4b\x29\x6d')])){BiliPushUtils[_0x283c('79','\x52\x39\x23\x38')]=function(_0x3ef6ef,_0x25584d){if(_0x5bdecf[_0x283c('7a','\x58\x55\x53\x69')](_0x5bdecf[_0x283c('7b','\x29\x21\x72\x39')],_0x5bdecf[_0x283c('7c','\x4b\x6b\x45\x69')])){return{'\x76\x61\x6c\x75\x65':_0x3ef6ef[_0x283c('7d','\x46\x45\x70\x42')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{return _0x33b859[_0x283c('7e','\x58\x46\x74\x75')](_0x3ef6ef,_0x25584d);}};}else{var _0x583b28=Module[_0x283c('7f','\x7a\x68\x42\x62')][_0x283c('80','\x32\x35\x46\x26')]++;Module[_0x283c('81','\x57\x49\x4e\x6b')][_0x283c('82','\x42\x58\x76\x31')][_0x583b28]=value;return _0x583b28;}}else{if(_0x5bdecf[_0x283c('83','\x67\x57\x32\x5e')](_0x5bdecf[_0x283c('84','\x48\x5e\x38\x66')],_0x5bdecf[_0x283c('85','\x4f\x31\x4f\x42')])){console['\x6c\x6f\x67'](_0x5bdecf[_0x283c('86','\x39\x29\x5e\x59')]);return;}else{r=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](r),Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('87','\x4f\x43\x40\x56')](t,0x780);}}}let _0xaf0de4=await Gift['\x67\x65\x74\x4d\x65\x64\x61\x6c\x4c\x69\x73\x74']();if(_0xaf0de4&&_0x5bdecf[_0x283c('88','\x52\x39\x23\x38')](_0xaf0de4[_0x283c('89','\x4e\x4b\x29\x6d')],0x0)){console[_0x283c('8a','\x67\x57\x32\x5e')](_0x5bdecf[_0x283c('8b','\x4f\x43\x40\x56')]);for(let _0x42d64f of _0xaf0de4[_0x283c('8c','\x57\x49\x4e\x6b')](0x0,0x18)){let _0x616060=await API['\x72\x6f\x6f\x6d']['\x67\x65\x74\x5f\x69\x6e\x66\x6f'](_0x5bdecf['\x63\x54\x73\x55\x50'](parseInt,_0x42d64f[_0x283c('8d','\x32\x35\x4a\x45')],0xa));if(_0x5bdecf[_0x283c('8e','\x32\x35\x4a\x45')](_0x616060[_0x283c('8f','\x74\x79\x71\x67')],0x0)){if(_0x5bdecf['\x4d\x61\x6c\x66\x59'](_0x5bdecf[_0x283c('90','\x4c\x37\x43\x58')],_0x5bdecf[_0x283c('91','\x46\x45\x70\x42')])){Module[_0x283c('92','\x66\x78\x5e\x29')]['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74'](t);}else{console[_0x283c('93','\x32\x35\x4a\x45')](_0x283c('94','\x4c\x37\x43\x58')+_0x42d64f[_0x283c('95','\x2a\x44\x29\x21')]+_0x283c('4a','\x4c\x37\x43\x58')+_0x616060[_0x283c('96','\x4c\x37\x43\x58')]['\x72\x6f\x6f\x6d\x5f\x69\x64']+_0x283c('97','\x63\x63\x58\x50'));new HeartGiftRoom(_0x616060['\x64\x61\x74\x61'],_0x42d64f);await _0x5bdecf[_0x283c('98','\x2a\x44\x29\x21')](delayCall,()=>{},0x3e8);}}}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0x3c6671,_0xa9e035){var _0x43adfb={'\x42\x76\x47\x76\x44':function(_0x302a4a,_0x4b3972){return _0x302a4a===_0x4b3972;},'\x53\x57\x6b\x59\x42':_0x283c('99','\x6b\x61\x37\x4e'),'\x6b\x78\x70\x62\x7a':_0x283c('9a','\x46\x72\x31\x55'),'\x59\x64\x62\x68\x53':function(_0x2e089f,_0x5bb705){return _0x2e089f!==_0x5bb705;},'\x70\x7a\x71\x63\x64':_0x283c('9b','\x57\x49\x4e\x6b'),'\x55\x4d\x59\x4c\x69':_0x283c('9c','\x74\x79\x71\x67'),'\x79\x7a\x79\x55\x4f':function(_0x18169f,_0x3baf47){return _0x18169f!==_0x3baf47;},'\x48\x46\x43\x67\x67':_0x283c('9d','\x29\x67\x41\x78'),'\x57\x64\x75\x4e\x4f':_0x283c('9e','\x4b\x6b\x45\x69'),'\x6f\x6c\x42\x55\x44':function(_0xe2ad16){return _0xe2ad16();},'\x53\x61\x43\x61\x50':function(_0x4e1120,_0x25c4b2,_0x26676b){return _0x4e1120(_0x25c4b2,_0x26676b);},'\x76\x79\x6a\x51\x69':_0x283c('9f','\x52\x39\x23\x38'),'\x54\x7a\x48\x56\x48':function(_0xec053e,_0x64d844){return _0xec053e==_0x64d844;},'\x5a\x7a\x4a\x77\x51':_0x283c('a0','\x4f\x32\x78\x50')};var _0x215fb7=_0x43adfb['\x6f\x6c\x42\x55\x44'](_0xa9e035),_0x505ce7=_0x43adfb[_0x283c('a1','\x58\x46\x74\x75')](fetch,_0x3c6671,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x43adfb[_0x283c('a2','\x25\x68\x77\x32')]});return(_0x43adfb[_0x283c('a3','\x6b\x69\x6a\x58')](_0x43adfb[_0x283c('a4','\x71\x4b\x28\x4e')],typeof window[_0x283c('a5','\x75\x47\x53\x40')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'])?window[_0x283c('a6','\x57\x49\x4e\x6b')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'](_0x505ce7,_0x215fb7['\x69\x6d\x70\x6f\x72\x74\x73'])[_0x283c('a7','\x2a\x44\x29\x21')](function(_0x3c6671){if(_0x43adfb['\x42\x76\x47\x76\x44'](_0x43adfb[_0x283c('a8','\x66\x78\x5e\x29')],_0x43adfb['\x6b\x78\x70\x62\x7a'])){len+=0x3;}else{return _0x3c6671['\x69\x6e\x73\x74\x61\x6e\x63\x65'];}}):_0x505ce7[_0x283c('a9','\x4c\x31\x4c\x5b')](function(_0x3c6671){if(_0x43adfb[_0x283c('aa','\x65\x21\x70\x49')](_0x43adfb['\x70\x7a\x71\x63\x64'],_0x43adfb['\x55\x4d\x59\x4c\x69'])){return _0x3c6671[_0x283c('ab','\x6b\x69\x6a\x58')]();}else{id_to_ref_map[refid]=reference;id_to_refcount_map[refid]=0x1;}})['\x74\x68\x65\x6e'](function(_0x3c6671){return window[_0x283c('a6','\x57\x49\x4e\x6b')][_0x283c('ac','\x6a\x52\x4f\x63')](_0x3c6671);})['\x74\x68\x65\x6e'](function(_0x3c6671){if(_0x43adfb[_0x283c('ad','\x39\x29\x5e\x59')](_0x43adfb['\x48\x46\x43\x67\x67'],_0x43adfb[_0x283c('ae','\x4e\x4b\x29\x6d')])){_0x505ce7=Module[_0x283c('af','\x4b\x7a\x7a\x71')][_0x283c('b0','\x4c\x37\x43\x58')](_0x505ce7),Module[_0x283c('b1','\x58\x46\x74\x75')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x3c6671,function(){try{return{'\x76\x61\x6c\x75\x65':_0x505ce7['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x24ccb3){return{'\x65\x72\x72\x6f\x72':_0x24ccb3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return window[_0x283c('b2','\x58\x55\x53\x69')][_0x283c('b3','\x76\x41\x30\x52')](_0x3c6671,_0x215fb7[_0x283c('b4','\x63\x63\x58\x50')]);}}))['\x74\x68\x65\x6e'](function(_0x3c6671){return _0x215fb7[_0x283c('b5','\x46\x73\x2a\x21')](_0x3c6671);})['\x63\x61\x74\x63\x68'](function(_0x3c6671){throw console[_0x283c('b6','\x65\x21\x70\x49')](_0x43adfb[_0x283c('b7','\x38\x46\x43\x5d')],_0x3c6671),_0x3c6671;});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x339258={'\x56\x5a\x44\x71\x79':function(_0x5035c7,_0x2b84fd){return _0x5035c7+_0x2b84fd;},'\x74\x72\x58\x66\x41':function(_0x36a6dc,_0x57d045){return _0x36a6dc/_0x57d045;},'\x62\x4f\x45\x45\x6f':'\x31\x7c\x34\x7c\x36\x7c\x32\x7c\x35\x7c\x30\x7c\x33','\x72\x57\x67\x50\x67':function(_0x1c964d,_0x4cb24c){return _0x1c964d<_0x4cb24c;},'\x75\x70\x61\x73\x49':_0x283c('b8','\x46\x45\x70\x42'),'\x49\x53\x51\x66\x4a':function(_0x5c4cca,_0x44a664){return _0x5c4cca*_0x44a664;},'\x44\x46\x7a\x7a\x62':function(_0x45eb42,_0x4843b0){return _0x45eb42+_0x4843b0;},'\x7a\x74\x66\x6b\x42':function(_0x2ae64f,_0x10cad8){return _0x2ae64f+_0x10cad8;},'\x54\x56\x69\x4e\x41':function(_0x5175e7,_0x1035cf){return _0x5175e7*_0x1035cf;},'\x58\x4c\x50\x41\x59':function(_0x33d41c,_0x406fc3){return _0x33d41c+_0x406fc3;},'\x53\x55\x51\x6c\x75':function(_0x5c2935,_0x5666ba){return _0x5c2935+_0x5666ba;},'\x7a\x4e\x57\x55\x55':function(_0x1cea1a,_0x281ee4){return _0x1cea1a<_0x281ee4;},'\x6a\x46\x46\x54\x65':function(_0x3b49fe,_0x559b75){return _0x3b49fe>=_0x559b75;},'\x46\x45\x6b\x6e\x6d':function(_0x1d9fc4,_0x3e7e33){return _0x1d9fc4<=_0x3e7e33;},'\x59\x70\x50\x6d\x77':function(_0x35a2de,_0x5cafec){return _0x35a2de|_0x5cafec;},'\x7a\x57\x61\x5a\x6f':function(_0x498ba2,_0x399041){return _0x498ba2<<_0x399041;},'\x6e\x70\x6a\x45\x56':function(_0x248004,_0x3d3d61){return _0x248004&_0x3d3d61;},'\x4d\x6c\x45\x79\x75':function(_0x4590b1,_0x40459c){return _0x4590b1&_0x40459c;},'\x44\x47\x41\x4b\x53':function(_0x2ad121,_0xf7960c){return _0x2ad121<=_0xf7960c;},'\x43\x68\x69\x52\x44':function(_0x3226d0,_0x4fd420){return _0x3226d0===_0x4fd420;},'\x4d\x62\x49\x6d\x52':'\x72\x69\x57\x4a\x69','\x50\x53\x4a\x53\x74':function(_0x37b77f,_0x39f6a6){return _0x37b77f<=_0x39f6a6;},'\x64\x6c\x6c\x4f\x76':function(_0x416a20,_0x2790f7){return _0x416a20!==_0x2790f7;},'\x7a\x4f\x50\x76\x47':_0x283c('b9','\x4f\x31\x4f\x42'),'\x6a\x41\x52\x63\x77':_0x283c('ba','\x29\x21\x72\x39'),'\x4a\x58\x43\x43\x47':function(_0x2af5b8,_0x5653ee){return _0x2af5b8|_0x5653ee;},'\x63\x65\x42\x71\x43':function(_0x11c958,_0x5d7816){return _0x11c958>>_0x5d7816;},'\x50\x62\x41\x71\x58':function(_0x51036b,_0x5bbd02){return _0x51036b|_0x5bbd02;},'\x54\x59\x71\x6a\x69':function(_0x551787,_0x54c71a){return _0x551787&_0x54c71a;},'\x72\x59\x73\x6c\x62':function(_0x39a88d,_0x48b304){return _0x39a88d|_0x48b304;},'\x5a\x44\x70\x52\x6f':function(_0x21f063,_0x56febe){return _0x21f063>>_0x56febe;},'\x4f\x77\x66\x77\x54':function(_0x577c12,_0x3c3dfc){return _0x577c12|_0x3c3dfc;},'\x53\x56\x4b\x50\x57':function(_0x19f573,_0x414d29){return _0x19f573&_0x414d29;},'\x48\x47\x4a\x48\x42':function(_0x5a8c77,_0x2b3e4d){return _0x5a8c77<=_0x2b3e4d;},'\x50\x45\x6c\x66\x51':_0x283c('bb','\x57\x49\x4e\x6b'),'\x79\x71\x41\x6c\x67':'\x43\x4b\x70\x42\x6c','\x47\x69\x78\x69\x75':function(_0x423576,_0xc966ae){return _0x423576>>_0xc966ae;},'\x75\x71\x51\x6b\x75':function(_0x3792de,_0x4013b8){return _0x3792de|_0x4013b8;},'\x56\x7a\x4e\x6e\x6d':function(_0x37343e,_0x267d49){return _0x37343e&_0x267d49;},'\x41\x4c\x57\x49\x57':function(_0x114524,_0x1b0c09){return _0x114524>>_0x1b0c09;},'\x69\x74\x53\x41\x4a':function(_0x56e516,_0x5be8bc){return _0x56e516>>_0x5be8bc;},'\x6e\x62\x41\x53\x56':function(_0x504138,_0x3d1b57){return _0x504138|_0x3d1b57;},'\x63\x76\x77\x56\x51':_0x283c('bc','\x76\x41\x30\x52'),'\x58\x54\x72\x71\x4b':function(_0x408da9,_0x508fc5){return _0x408da9|_0x508fc5;},'\x6e\x49\x42\x6d\x55':function(_0x327000,_0x439dd7){return _0x327000&_0x439dd7;},'\x6d\x4f\x77\x77\x76':function(_0x1d2bd1,_0x54619f){return _0x1d2bd1>>_0x54619f;},'\x46\x6b\x6d\x49\x4c':function(_0x117dc8,_0x2138b5){return _0x117dc8|_0x2138b5;},'\x44\x52\x57\x44\x46':function(_0x350877,_0x564830){return _0x350877>>_0x564830;},'\x63\x66\x45\x78\x73':function(_0xdc5668,_0x57573d){return _0xdc5668|_0x57573d;},'\x4f\x61\x74\x6a\x5a':function(_0x4f0f1c,_0x19315b){return _0x4f0f1c|_0x19315b;},'\x7a\x45\x54\x55\x44':function(_0x39e93b,_0x2160b2){return _0x39e93b>>_0x2160b2;},'\x59\x65\x71\x70\x4b':function(_0x2c0cb7,_0x57e397){return _0x2c0cb7>>_0x57e397;},'\x4e\x4a\x76\x6a\x6b':_0x283c('bd','\x70\x41\x28\x67'),'\x58\x49\x75\x4a\x59':function(_0x20eec8,_0x432a47){return _0x20eec8|_0x432a47;},'\x6e\x53\x67\x46\x69':function(_0xc9642b,_0x54d7bc){return _0xc9642b&_0x54d7bc;},'\x51\x57\x6a\x45\x4a':function(_0x1a07a2,_0x561723){return _0x1a07a2>>_0x561723;},'\x79\x78\x6f\x55\x4d':function(_0x30a928,_0x38b168){return _0x30a928|_0x38b168;},'\x75\x4e\x5a\x76\x44':function(_0x445ece,_0xaa091e){return _0x445ece>>_0xaa091e;},'\x64\x63\x54\x74\x58':function(_0x7469a9,_0x279b2b){return _0x7469a9|_0x279b2b;},'\x66\x7a\x56\x51\x55':function(_0x741e2d,_0x352844){return _0x741e2d>>_0x352844;},'\x4a\x50\x69\x70\x6a':function(_0x3da2f6,_0x29d7ce){return _0x3da2f6|_0x29d7ce;},'\x4f\x43\x6c\x50\x71':function(_0x525a24,_0x17b9fe){return _0x525a24|_0x17b9fe;},'\x42\x6a\x44\x61\x7a':function(_0x49ff2f,_0x4a590e){return _0x49ff2f&_0x4a590e;},'\x6b\x65\x4a\x6d\x55':function(_0x3b1935,_0x10f04c){return _0x3b1935/_0x10f04c;},'\x78\x52\x72\x6e\x42':function(_0x497f70,_0x327ea2){return _0x497f70/_0x327ea2;},'\x78\x67\x63\x74\x63':function(_0x205366,_0x2a8cdc){return _0x205366===_0x2a8cdc;},'\x43\x6c\x4a\x6e\x53':'\x77\x70\x56\x58\x4a','\x67\x71\x72\x56\x50':_0x283c('be','\x4e\x4b\x29\x6d'),'\x67\x7a\x61\x42\x4e':function(_0xb3ccde,_0x284e73){return _0xb3ccde===_0x284e73;},'\x46\x50\x6e\x43\x4f':_0x283c('bf','\x65\x21\x70\x49'),'\x61\x73\x42\x6a\x53':'\x64\x67\x4c\x41\x4d','\x6c\x41\x79\x53\x73':_0x283c('c0','\x74\x79\x71\x67'),'\x4b\x4f\x5a\x68\x58':'\x41\x6c\x72\x65\x61\x64\x79\x20\x63\x61\x6c\x6c\x65\x64\x20\x6f\x72\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4f\x6e\x63\x65\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x66\x44\x4e\x7a\x4e':function(_0xfbd3a0,_0xe05ff6){return _0xfbd3a0===_0xe05ff6;},'\x50\x6d\x64\x66\x4e':_0x283c('c1','\x56\x34\x37\x55'),'\x67\x79\x62\x70\x75':_0x283c('c2','\x71\x4b\x28\x4e'),'\x4c\x61\x53\x7a\x57':function(_0x562453,_0x33b6be){return _0x562453===_0x33b6be;},'\x43\x66\x68\x54\x48':function(_0xd764d2,_0x151791){return _0xd764d2+_0x151791;},'\x56\x42\x55\x50\x48':'\x79\x56\x75\x65\x68','\x47\x4c\x54\x4c\x79':_0x283c('c3','\x25\x68\x77\x32'),'\x41\x74\x56\x70\x47':function(_0x544675,_0xf77aa9){return _0x544675!=_0xf77aa9;},'\x6c\x54\x63\x62\x5a':'\x35\x7c\x33\x7c\x34\x7c\x30\x7c\x32\x7c\x31','\x49\x6a\x45\x6d\x54':function(_0x3ecc27,_0x58d500){return _0x3ecc27>_0x58d500;},'\x46\x68\x63\x53\x70':function(_0x7f2b9c,_0x98d311){return _0x7f2b9c/_0x98d311;},'\x5a\x6f\x5a\x7a\x61':function(_0x14af80,_0x2f5978){return _0x14af80===_0x2f5978;},'\x5a\x64\x78\x72\x4f':_0x283c('c4','\x25\x68\x77\x32'),'\x63\x78\x44\x52\x58':function(_0x947939,_0x138c3f){return _0x947939+_0x138c3f;},'\x41\x7a\x64\x79\x77':function(_0x2970a2,_0x6952a2){return _0x2970a2===_0x6952a2;},'\x64\x44\x42\x58\x68':function(_0x1d2136,_0x143e65){return _0x1d2136===_0x143e65;},'\x4a\x4e\x55\x6f\x6d':_0x283c('c5','\x23\x7a\x79\x71'),'\x61\x77\x59\x6c\x69':function(_0xe0e080,_0x106dbe){return _0xe0e080===_0x106dbe;},'\x5a\x66\x73\x78\x70':function(_0x2021e0,_0x4909b9){return _0x2021e0/_0x4909b9;},'\x6a\x43\x76\x68\x65':_0x283c('c6','\x24\x72\x69\x70'),'\x57\x42\x68\x4d\x6d':_0x283c('c7','\x66\x78\x5e\x29'),'\x77\x59\x57\x5a\x56':function(_0xa0cd22,_0x4bc0b5){return _0xa0cd22/_0x4bc0b5;},'\x50\x65\x6e\x59\x59':function(_0x3c52ce,_0x443ee4){return _0x3c52ce===_0x443ee4;},'\x4e\x47\x68\x70\x6b':_0x283c('c8','\x4f\x43\x40\x56'),'\x49\x74\x4f\x78\x6e':function(_0x4a90f0,_0x15d22f){return _0x4a90f0===_0x15d22f;},'\x79\x6b\x6f\x65\x63':_0x283c('c9','\x4b\x38\x76\x6b'),'\x53\x71\x68\x47\x49':_0x283c('ca','\x52\x39\x23\x38'),'\x49\x53\x58\x47\x54':_0x283c('cb','\x46\x73\x2a\x21'),'\x41\x4b\x4d\x63\x6e':'\x73\x42\x63\x4c\x79','\x44\x72\x4e\x63\x4d':function(_0x49c197,_0x2997a9){return _0x49c197===_0x2997a9;},'\x6c\x73\x50\x67\x57':function(_0x21b808,_0x190e36){return _0x21b808!==_0x190e36;},'\x66\x50\x58\x73\x41':'\x6e\x53\x52\x48\x76','\x53\x6a\x6f\x62\x4d':_0x283c('cc','\x42\x58\x76\x31'),'\x51\x77\x56\x52\x41':function(_0x38ee80,_0x4bd864){return _0x38ee80<_0x4bd864;},'\x77\x59\x7a\x56\x6e':function(_0x4e687f,_0x4945ba){return _0x4e687f+_0x4945ba;},'\x79\x67\x46\x7a\x7a':function(_0x4192a7,_0x4c5bcc){return _0x4192a7*_0x4c5bcc;},'\x51\x72\x54\x57\x6b':function(_0x4b66c9,_0x218fa3){return _0x4b66c9/_0x218fa3;},'\x6e\x62\x44\x6e\x4e':function(_0x5ee13e,_0xde1be6){return _0x5ee13e===_0xde1be6;},'\x57\x68\x76\x67\x6b':'\x35\x7c\x34\x7c\x31\x7c\x30\x7c\x32\x7c\x33\x7c\x36','\x59\x6d\x48\x4c\x4a':function(_0x170da7,_0x377b87){return _0x170da7+_0x377b87;},'\x51\x64\x6f\x56\x4e':function(_0x6d2ea1,_0x17236d){return _0x6d2ea1/_0x17236d;},'\x61\x6b\x69\x78\x6a':function(_0x3380b7,_0x431f32){return _0x3380b7<_0x431f32;},'\x59\x46\x63\x65\x4b':_0x283c('cd','\x6b\x69\x6a\x58'),'\x6e\x72\x72\x73\x66':function(_0x246c1d,_0x4756e7){return _0x246c1d+_0x4756e7;},'\x57\x56\x74\x56\x50':function(_0xad9c00,_0x17bd0c){return _0xad9c00*_0x17bd0c;},'\x68\x68\x68\x5a\x77':function(_0x2d7774,_0x134daf){return _0x2d7774/_0x134daf;},'\x55\x59\x7a\x4d\x55':function(_0x5cb230,_0x44158a){return _0x5cb230/_0x44158a;},'\x69\x4a\x56\x7a\x56':function(_0x43a55f,_0x154ac2){return _0x43a55f+_0x154ac2;},'\x6d\x41\x46\x61\x42':function(_0x25d47b,_0x1d7b80){return _0x25d47b+_0x1d7b80;},'\x70\x4e\x61\x58\x56':function(_0xe061fd,_0x50b408){return _0xe061fd===_0x50b408;},'\x66\x59\x52\x63\x43':'\x56\x50\x52\x66\x52','\x65\x42\x70\x46\x56':_0x283c('ce','\x4b\x45\x34\x57'),'\x50\x54\x47\x4d\x6a':function(_0x4333a1,_0x119304){return _0x4333a1/_0x119304;},'\x41\x55\x58\x59\x44':function(_0x289228,_0x2ba6cf){return _0x289228+_0x2ba6cf;},'\x6d\x7a\x6d\x6d\x47':function(_0x3a16dc,_0x319a0a){return _0x3a16dc/_0x319a0a;},'\x69\x64\x4f\x61\x7a':function(_0x296771,_0x226199){return _0x296771+_0x226199;},'\x59\x78\x45\x6a\x43':function(_0x80992b,_0x16adf9){return _0x80992b===_0x16adf9;},'\x59\x70\x41\x43\x64':_0x283c('cf','\x46\x45\x70\x42'),'\x63\x79\x57\x7a\x75':_0x283c('d0','\x4f\x31\x4f\x42'),'\x6d\x57\x68\x4f\x4c':function(_0x46f3c5,_0x34a3dd){return _0x46f3c5+_0x34a3dd;},'\x66\x4d\x58\x4d\x64':function(_0x5d2c77,_0x1c83e2){return _0x5d2c77/_0x1c83e2;},'\x42\x41\x6c\x6d\x5a':function(_0x3457d9,_0x1191b0){return _0x3457d9+_0x1191b0;},'\x48\x41\x4a\x4c\x44':function(_0x59acac,_0x4ccfe5){return _0x59acac===_0x4ccfe5;},'\x46\x53\x50\x4a\x79':_0x283c('d1','\x58\x4b\x4f\x4e'),'\x68\x5a\x70\x65\x73':function(_0x41c12f,_0x25609c){return _0x41c12f/_0x25609c;},'\x4e\x49\x49\x63\x77':function(_0x15b489,_0x708c39){return _0x15b489*_0x708c39;},'\x47\x6a\x51\x6f\x4a':function(_0x31b69a,_0x575a25){return _0x31b69a<_0x575a25;},'\x6d\x4f\x4f\x51\x57':function(_0x1b10d4,_0xc8dda7){return _0x1b10d4+_0xc8dda7;},'\x62\x57\x76\x73\x59':function(_0x1d57a2,_0x1d4eda){return _0x1d57a2+_0x1d4eda;},'\x44\x59\x69\x49\x63':function(_0x2facf8,_0x27c5bd){return _0x2facf8/_0x27c5bd;},'\x50\x6d\x48\x5a\x4b':function(_0x3de7d7,_0x3dbae1){return _0x3de7d7+_0x3dbae1;},'\x48\x72\x53\x4d\x79':function(_0x4e5569,_0xf4cca7){return _0x4e5569+_0xf4cca7;},'\x45\x4a\x4d\x6e\x4d':function(_0x4fe989,_0x8873a2){return _0x4fe989/_0x8873a2;},'\x44\x71\x6d\x59\x44':function(_0x378130,_0x15322e){return _0x378130/_0x15322e;},'\x4c\x67\x76\x49\x4a':function(_0x41fb84,_0x354b67){return _0x41fb84<_0x354b67;},'\x69\x51\x66\x43\x74':_0x283c('d2','\x4a\x7a\x46\x70'),'\x68\x67\x75\x54\x6b':_0x283c('d3','\x29\x21\x72\x39'),'\x5a\x46\x6c\x79\x64':function(_0x288e2f,_0x14149a){return _0x288e2f*_0x14149a;},'\x76\x43\x76\x61\x4e':_0x283c('d4','\x46\x72\x31\x55'),'\x4d\x46\x4e\x48\x57':_0x283c('d5','\x58\x55\x53\x69'),'\x59\x53\x65\x70\x6b':function(_0x2f3b5f,_0x49b878){return _0x2f3b5f/_0x49b878;},'\x64\x62\x6b\x75\x65':function(_0x3883fd,_0x1778e9){return _0x3883fd+_0x1778e9;},'\x4a\x68\x41\x6b\x44':_0x283c('d6','\x4c\x37\x43\x58'),'\x4c\x57\x74\x7a\x44':function(_0x5583e4,_0xdab422){return _0x5583e4&_0xdab422;},'\x48\x7a\x55\x79\x65':_0x283c('d7','\x32\x35\x4a\x45'),'\x67\x42\x61\x65\x75':function(_0x474fec,_0x28f44d){return _0x474fec<_0x28f44d;},'\x6d\x67\x68\x43\x48':function(_0x41006c,_0x36443b){return _0x41006c<<_0x36443b;},'\x56\x78\x47\x42\x70':function(_0x31d124,_0x10f7af){return _0x31d124&_0x10f7af;},'\x69\x4d\x79\x4a\x65':function(_0x43d4ac,_0x3689ac){return _0x43d4ac<<_0x3689ac;},'\x41\x78\x51\x6e\x6a':function(_0x782fad,_0x8c3369){return _0x782fad&_0x8c3369;},'\x54\x50\x48\x62\x72':function(_0x4e362e,_0x2fe117){return _0x4e362e<_0x2fe117;},'\x52\x68\x73\x5a\x53':function(_0x26c987,_0x343238){return _0x26c987|_0x343238;},'\x54\x62\x57\x4c\x5a':_0x283c('d8','\x38\x46\x43\x5d'),'\x6a\x4b\x49\x59\x52':'\x34\x7c\x31\x7c\x32\x7c\x33\x7c\x30','\x65\x7a\x4d\x56\x4d':function(_0x1aafef,_0x3c74a9){return _0x1aafef/_0x3c74a9;},'\x58\x75\x48\x42\x56':function(_0x3b614c,_0x3fd9ee){return _0x3b614c+_0x3fd9ee;},'\x52\x70\x77\x65\x56':function(_0xb8a271,_0x54d8a8){return _0xb8a271>_0x54d8a8;},'\x6f\x67\x77\x4a\x79':function(_0x2f9402,_0x1b7993){return _0x2f9402===_0x1b7993;},'\x61\x6d\x7a\x59\x73':'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x53\x74\x72\x69\x6e\x67\x5d','\x57\x78\x63\x66\x54':_0x283c('d9','\x4c\x31\x4c\x5b'),'\x6f\x71\x54\x6b\x64':'\x4a\x69\x64\x50\x69','\x44\x62\x67\x6d\x51':function(_0x5c2a72,_0xd23429){return _0x5c2a72===_0xd23429;},'\x5a\x68\x4f\x79\x62':_0x283c('da','\x74\x79\x71\x67'),'\x61\x51\x55\x5a\x6f':function(_0x189bfb,_0x2e5fd3){return _0x189bfb|_0x2e5fd3;},'\x42\x64\x6c\x4a\x6b':function(_0x20bcc4,_0x3af307){return _0x20bcc4/_0x3af307;},'\x44\x65\x6e\x43\x76':function(_0x1d1193,_0x5e3a6f){return _0x1d1193===_0x5e3a6f;},'\x7a\x42\x47\x65\x41':function(_0x508631,_0x551bfa){return _0x508631===_0x551bfa;},'\x4e\x78\x59\x64\x5a':_0x283c('db','\x56\x34\x37\x55'),'\x64\x46\x4b\x44\x79':'\x4b\x69\x49\x4d\x77','\x51\x76\x48\x4c\x62':function(_0xa043b1,_0x4a1684){return _0xa043b1+_0x4a1684;},'\x72\x55\x46\x63\x75':function(_0x2dcc0b,_0x3748d7){return _0x2dcc0b===_0x3748d7;},'\x4f\x7a\x4c\x5a\x79':_0x283c('dc','\x6a\x52\x4f\x63'),'\x6b\x52\x62\x52\x48':function(_0x4c70f2,_0x4eba7a){return _0x4c70f2===_0x4eba7a;},'\x67\x6c\x69\x51\x56':_0x283c('dd','\x4b\x45\x34\x57'),'\x69\x4c\x45\x54\x72':function(_0x55396a,_0x11966b){return _0x55396a+_0x11966b;},'\x46\x6e\x46\x52\x74':function(_0x48353b,_0x55c2d3){return _0x48353b/_0x55c2d3;},'\x59\x54\x4f\x70\x71':_0x283c('de','\x67\x57\x32\x5e'),'\x53\x68\x41\x68\x65':'\x72\x7a\x50\x73\x59','\x55\x6a\x54\x76\x68':function(_0x58800b,_0x537c63){return _0x58800b/_0x537c63;},'\x6e\x7a\x4f\x53\x58':function(_0x357c13,_0x512df9){return _0x357c13+_0x512df9;},'\x49\x49\x4b\x77\x64':'\x31\x32\x7c\x31\x30\x7c\x35\x7c\x33\x7c\x36\x7c\x37\x7c\x30\x7c\x38\x7c\x32\x7c\x31\x31\x7c\x31\x7c\x34\x7c\x39','\x7a\x78\x52\x71\x67':function(_0x2a397c){return _0x2a397c();},'\x6c\x49\x73\x64\x79':function(_0x157279,_0x3d7090){return _0x157279(_0x3d7090);},'\x74\x43\x4a\x4f\x6d':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44','\x71\x63\x5a\x50\x58':_0x283c('df','\x71\x4b\x28\x4e'),'\x65\x47\x61\x6b\x43':function(_0x44f70b,_0xc435b3){return _0x44f70b|_0xc435b3;},'\x54\x45\x43\x63\x48':function(_0x1bbaa2,_0x10f3b6){return _0x1bbaa2 instanceof _0x10f3b6;},'\x6a\x50\x79\x4a\x51':_0x283c('e0','\x4f\x43\x40\x56'),'\x43\x48\x54\x75\x71':function(_0x56275b,_0x1a3c4c){return _0x56275b<_0x1a3c4c;},'\x6b\x67\x45\x58\x79':function(_0x252d24,_0x47fc67){return _0x252d24<_0x47fc67;},'\x45\x45\x4b\x4b\x54':function(_0x346ac0,_0x20cab0){return _0x346ac0&_0x20cab0;},'\x41\x49\x53\x4a\x44':function(_0x443034,_0x587629){return _0x443034>>_0x587629;},'\x50\x42\x52\x5a\x46':function(_0x110cd7,_0x59ac4f){return _0x110cd7<_0x59ac4f;},'\x74\x63\x4d\x4c\x52':_0x283c('e1','\x52\x39\x23\x38'),'\x74\x74\x46\x57\x48':function(_0x168fdc,_0x2e32ac){return _0x168fdc|_0x2e32ac;},'\x49\x53\x57\x75\x76':function(_0x26f824,_0x3d5bb3){return _0x26f824===_0x3d5bb3;},'\x44\x6d\x6f\x50\x6b':_0x283c('e2','\x4f\x32\x78\x50'),'\x57\x46\x73\x70\x78':'\x58\x6d\x56\x6d\x4b','\x49\x75\x44\x4c\x51':function(_0x49ea35,_0xef6d4){return _0x49ea35<_0xef6d4;},'\x69\x79\x64\x49\x52':function(_0xaa8a74,_0x26b502){return _0xaa8a74<<_0x26b502;},'\x73\x44\x73\x6c\x52':function(_0x444b09,_0x22cb0a){return _0x444b09&_0x22cb0a;},'\x6c\x65\x6f\x46\x4b':function(_0x5834b5,_0x2ea77e){return _0x5834b5<_0x2ea77e;},'\x4e\x74\x76\x49\x56':'\x4a\x51\x43\x58\x44','\x79\x52\x69\x67\x55':function(_0x4e15f0,_0x27ac53){return _0x4e15f0|_0x27ac53;},'\x67\x5a\x51\x51\x64':function(_0x2505f3,_0x4c7a66){return _0x2505f3<<_0x4c7a66;},'\x6c\x65\x71\x6f\x51':function(_0x5dca4d,_0x3983bd){return _0x5dca4d<<_0x3983bd;},'\x76\x5a\x68\x55\x48':function(_0x5f2553,_0x153370){return _0x5f2553+_0x153370;},'\x57\x73\x45\x50\x58':function(_0x16c4b1,_0x43ccd0){return _0x16c4b1+_0x43ccd0;},'\x49\x48\x50\x52\x71':function(_0x43f65b,_0x51eaa3){return _0x43f65b|_0x51eaa3;},'\x5a\x50\x49\x56\x54':function(_0x19e524,_0x333ea6){return _0x19e524|_0x333ea6;},'\x78\x44\x4a\x41\x73':function(_0x192003,_0xa9b6fd){return _0x192003|_0xa9b6fd;},'\x6a\x68\x45\x44\x56':function(_0x37156a,_0x18ae5c){return _0x37156a+_0x18ae5c;},'\x4a\x79\x72\x59\x4b':function(_0x1342f7,_0x195702){return _0x1342f7|_0x195702;},'\x44\x70\x62\x73\x49':function(_0x3c5b0b,_0x5a57fd){return _0x3c5b0b<<_0x5a57fd;},'\x74\x67\x63\x66\x66':function(_0x2739e6,_0x1a94aa){return _0x2739e6&_0x1a94aa;},'\x55\x42\x43\x7a\x4b':function(_0xa7210d,_0x4745e0){return _0xa7210d+_0x4745e0;},'\x68\x79\x4e\x42\x57':'\x69\x6b\x6d\x6d\x46','\x4a\x61\x56\x6f\x57':_0x283c('e3','\x32\x35\x46\x26'),'\x42\x54\x69\x51\x71':function(_0x346e10,_0x57d424){return _0x346e10===_0x57d424;},'\x72\x59\x72\x69\x7a':function(_0x539586,_0xd28440){return _0x539586===_0xd28440;},'\x74\x6a\x59\x44\x61':'\x67\x58\x76\x67\x58','\x72\x55\x77\x4d\x51':function(_0x4d5020,_0x332231){return _0x4d5020===_0x332231;},'\x62\x51\x6b\x4d\x7a':function(_0x47d295,_0x1fd994){return _0x47d295===_0x1fd994;},'\x6c\x4f\x49\x57\x53':'\x72\x50\x5a\x73\x4e','\x4a\x54\x46\x58\x6f':_0x283c('e4','\x25\x68\x77\x32'),'\x79\x72\x6c\x69\x61':function(_0x64cd2b,_0xac5a22){return _0x64cd2b===_0xac5a22;},'\x4d\x4e\x6f\x73\x69':function(_0x3ab5db,_0x27ebf1){return _0x3ab5db===_0x27ebf1;},'\x7a\x67\x4b\x5a\x77':_0x283c('e5','\x2a\x44\x29\x21'),'\x41\x42\x73\x66\x71':function(_0x445182,_0x3fdaa9){return _0x445182===_0x3fdaa9;},'\x76\x4e\x55\x7a\x69':_0x283c('e6','\x6b\x61\x37\x4e'),'\x49\x4a\x5a\x66\x47':function(_0x4e1c57,_0x7cdca6){return _0x4e1c57 in _0x7cdca6;},'\x49\x73\x6c\x78\x64':_0x283c('e7','\x56\x34\x37\x55'),'\x4e\x45\x53\x41\x61':_0x283c('e8','\x56\x34\x37\x55'),'\x68\x61\x7a\x52\x6d':function(_0x2e7df1,_0x357556){return _0x2e7df1==_0x357556;},'\x6c\x6b\x6a\x72\x55':'\x30\x7c\x35\x7c\x31\x7c\x32\x7c\x33\x7c\x34','\x52\x6f\x79\x7a\x58':function(_0x4ea4c4,_0x57354e){return _0x4ea4c4+_0x57354e;},'\x66\x65\x46\x75\x6e':function(_0x24aada,_0xf3cb43){return _0x24aada===_0xf3cb43;},'\x71\x63\x5a\x6b\x57':_0x283c('e9','\x4f\x32\x78\x50'),'\x46\x78\x4b\x59\x6c':_0x283c('ea','\x38\x46\x43\x5d'),'\x48\x42\x58\x6f\x61':function(_0x2c33f7,_0x5c8ab3){return _0x2c33f7===_0x5c8ab3;},'\x49\x77\x56\x71\x41':'\x66\x6e\x58\x6b\x56','\x4d\x46\x48\x62\x67':_0x283c('eb','\x7a\x68\x42\x62'),'\x6e\x46\x4f\x6b\x44':function(_0xfbad11,_0x690902){return _0xfbad11+_0x690902;},'\x65\x7a\x66\x6a\x53':function(_0x5a12b1,_0x5e2032){return _0x5a12b1+_0x5e2032;},'\x77\x4d\x58\x71\x69':'\x65\x72\x72\x6f\x72','\x4e\x45\x53\x4a\x62':_0x283c('ec','\x4f\x32\x78\x50'),'\x50\x46\x61\x6f\x4a':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x70\x44\x5a\x57\x52':_0x283c('ed','\x67\x57\x32\x5e'),'\x55\x49\x44\x59\x71':'\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63','\x67\x4c\x52\x71\x59':_0x283c('ee','\x4c\x31\x4c\x5b'),'\x4f\x5a\x77\x67\x53':'\x4d\x4d\x57\x44\x49','\x4c\x63\x6b\x76\x4f':_0x283c('ef','\x71\x4b\x28\x4e'),'\x74\x58\x66\x43\x47':function(_0x1a3f6e,_0x146e13){return _0x1a3f6e<_0x146e13;},'\x49\x67\x4c\x48\x70':function(_0x5a8639,_0x519349){return _0x5a8639<=_0x519349;},'\x79\x4c\x6e\x7a\x50':function(_0x23691b,_0x4b4171){return _0x23691b===_0x4b4171;},'\x4a\x4c\x6e\x58\x5a':_0x283c('f0','\x56\x34\x37\x55'),'\x6f\x55\x64\x61\x61':function(_0x514053,_0x4bcce3){return _0x514053|_0x4bcce3;},'\x63\x76\x6c\x45\x65':function(_0x411675,_0x43701b){return _0x411675+_0x43701b;},'\x41\x53\x77\x50\x48':function(_0x400308,_0x492e0b){return _0x400308<<_0x492e0b;},'\x59\x48\x54\x44\x65':function(_0x1abd08,_0x544008){return _0x1abd08&_0x544008;},'\x6c\x66\x70\x55\x6e':function(_0x42f1b5,_0x4c8248){return _0x42f1b5<=_0x4c8248;},'\x76\x6c\x44\x47\x6d':_0x283c('f1','\x39\x29\x5e\x59'),'\x67\x45\x78\x63\x66':'\x6b\x57\x57\x4b\x52','\x61\x57\x64\x4b\x42':function(_0x24906c,_0x60bb3){return _0x24906c<=_0x60bb3;},'\x45\x73\x6d\x43\x41':_0x283c('f2','\x66\x78\x5e\x29'),'\x4a\x51\x68\x46\x55':'\x4f\x6a\x48\x45\x51','\x7a\x6e\x4c\x5a\x50':_0x283c('f3','\x4b\x7a\x7a\x71'),'\x44\x45\x6a\x66\x6a':function(_0x2e9fce,_0x1663be){return _0x2e9fce===_0x1663be;},'\x4d\x72\x55\x41\x54':_0x283c('f4','\x39\x29\x5e\x59'),'\x5a\x4a\x50\x57\x51':_0x283c('f5','\x4f\x32\x78\x50'),'\x45\x63\x76\x55\x55':_0x283c('f6','\x23\x7a\x79\x71'),'\x66\x75\x58\x4f\x54':function(_0x455dee,_0x2fea21){return _0x455dee===_0x2fea21;},'\x69\x6f\x48\x4d\x43':'\x70\x4e\x73\x59\x43','\x43\x6e\x45\x5a\x65':'\x69\x4d\x6d\x78\x71','\x6d\x56\x55\x59\x7a':function(_0x4a0b79,_0x5ed641){return _0x4a0b79+_0x5ed641;},'\x70\x72\x72\x44\x6b':_0x283c('f7','\x42\x58\x76\x31'),'\x48\x67\x4e\x6d\x5a':function(_0x1049ae,_0x4741c7){return _0x1049ae===_0x4741c7;},'\x52\x52\x59\x6f\x6c':'\x46\x4b\x5a\x78\x4b','\x70\x71\x58\x55\x62':'\x58\x46\x66\x78\x4f','\x73\x70\x4d\x79\x74':_0x283c('f8','\x42\x58\x76\x31'),'\x4b\x4c\x51\x4d\x63':function(_0x4e4044,_0x152396){return _0x4e4044/_0x152396;},'\x46\x4c\x72\x61\x42':function(_0x39d948,_0x7b7377){return _0x39d948===_0x7b7377;},'\x6f\x6c\x55\x61\x6d':_0x283c('f9','\x2a\x44\x29\x21'),'\x4b\x46\x53\x47\x59':function(_0x4f1a60,_0x473af8){return _0x4f1a60!==_0x473af8;},'\x4e\x59\x5a\x6d\x46':_0x283c('fa','\x67\x57\x32\x5e'),'\x75\x4c\x48\x52\x75':_0x283c('fb','\x46\x73\x2a\x21'),'\x54\x4c\x51\x68\x79':function(_0x74a09f,_0x52ac92){return _0x74a09f!==_0x52ac92;},'\x64\x70\x61\x53\x4f':_0x283c('fc','\x4a\x7a\x46\x70'),'\x6a\x53\x42\x4d\x6c':function(_0x1adaef,_0x3778a2){return _0x1adaef instanceof _0x3778a2;},'\x43\x6e\x78\x6c\x4e':'\x53\x65\x63\x75\x72\x69\x74\x79\x45\x72\x72\x6f\x72','\x42\x59\x4c\x67\x63':function(_0x16f599,_0x15bb40){return _0x16f599===_0x15bb40;},'\x65\x66\x42\x73\x75':'\x74\x7a\x56\x74\x7a','\x56\x49\x46\x5a\x6f':function(_0x409de0,_0x3dbde1){return _0x409de0===_0x3dbde1;},'\x68\x46\x79\x46\x79':_0x283c('fd','\x4f\x31\x4f\x42'),'\x55\x76\x4a\x4c\x68':function(_0x5d9ecb,_0x1ea5f9){return _0x5d9ecb!==_0x1ea5f9;},'\x4b\x71\x70\x65\x71':'\x76\x77\x55\x78\x58','\x6c\x78\x47\x74\x4a':'\x78\x6a\x4f\x44\x6c','\x6b\x4c\x78\x4a\x77':function(_0x40ab1a,_0x35dba0){return _0x40ab1a+_0x35dba0;},'\x43\x50\x67\x72\x72':function(_0x24eab8,_0x1f21b4){return _0x24eab8/_0x1f21b4;},'\x47\x72\x76\x4d\x4a':_0x283c('fe','\x46\x72\x31\x55'),'\x6a\x6c\x58\x73\x77':_0x283c('ff','\x58\x42\x5d\x47'),'\x4e\x6e\x6b\x70\x43':function(_0x25edfd,_0xaba173){return _0x25edfd!==_0xaba173;},'\x55\x50\x6f\x6d\x6e':_0x283c('100','\x4c\x31\x4c\x5b'),'\x48\x44\x70\x6a\x4c':_0x283c('101','\x76\x41\x30\x52'),'\x41\x6b\x65\x77\x46':function(_0x11fa58,_0x5ef44c){return _0x11fa58+_0x5ef44c;},'\x6d\x50\x74\x4e\x66':_0x283c('102','\x4a\x7a\x46\x70'),'\x68\x71\x49\x4e\x41':function(_0x5dd7d9,_0x24767c){return _0x5dd7d9!==_0x24767c;},'\x63\x71\x61\x63\x41':_0x283c('103','\x66\x78\x5e\x29'),'\x6f\x46\x6f\x64\x42':function(_0x28ebaa,_0x1141b4){return _0x28ebaa===_0x1141b4;},'\x4f\x4f\x68\x4c\x70':_0x283c('104','\x39\x29\x5e\x59'),'\x62\x66\x46\x5a\x74':function(_0x10f7e3,_0x4b1118){return _0x10f7e3===_0x4b1118;},'\x68\x67\x61\x5a\x7a':_0x283c('105','\x52\x39\x23\x38'),'\x53\x76\x49\x4f\x73':'\x75\x74\x66\x2d\x38','\x53\x41\x5a\x7a\x57':function(_0x23c67e,_0x19fb22){return _0x23c67e===_0x19fb22;},'\x47\x44\x73\x67\x6a':_0x283c('106','\x2a\x44\x29\x21'),'\x72\x75\x74\x65\x52':function(_0x50a046,_0x277cb3){return _0x50a046===_0x277cb3;},'\x53\x75\x74\x56\x52':function(_0x264e08,_0x5d6496){return _0x264e08===_0x5d6496;},'\x6e\x47\x52\x70\x6c':function(_0x35e159,_0x3077fa){return _0x35e159===_0x3077fa;},'\x71\x79\x75\x59\x5a':function(_0x43ed27,_0x5402f7){return _0x43ed27===_0x5402f7;},'\x44\x45\x65\x77\x49':function(_0x108dd5,_0x3120f9){return _0x108dd5!==_0x3120f9;},'\x69\x53\x44\x69\x4c':_0x283c('107','\x58\x4b\x4f\x4e'),'\x7a\x52\x6b\x63\x67':_0x283c('108','\x7a\x68\x42\x62'),'\x41\x51\x57\x64\x76':'\x65\x78\x70\x6f\x72\x74\x73'};var _0x537cdb={};_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']={};_0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('10a','\x54\x57\x35\x75')]=function to_utf8(_0x35511a,_0x404564){var _0x2e7972={'\x4d\x41\x6d\x73\x49':_0x339258['\x62\x4f\x45\x45\x6f'],'\x50\x53\x53\x71\x6a':function(_0x3515f9,_0x1c324a){return _0x339258[_0x283c('10b','\x6b\x43\x6a\x37')](_0x3515f9,_0x1c324a);},'\x79\x76\x41\x47\x63':_0x339258[_0x283c('10c','\x46\x45\x70\x42')],'\x64\x4b\x42\x42\x4a':function(_0x508be5,_0x296b04){return _0x339258[_0x283c('10d','\x4a\x7a\x46\x70')](_0x508be5,_0x296b04);},'\x5a\x54\x73\x66\x50':function(_0x4545a5,_0x5342b4){return _0x339258[_0x283c('10e','\x54\x57\x35\x75')](_0x4545a5,_0x5342b4);},'\x57\x61\x53\x6a\x41':function(_0x49a0d3,_0x33593d){return _0x339258[_0x283c('10f','\x4e\x4b\x29\x6d')](_0x49a0d3,_0x33593d);},'\x70\x48\x6b\x70\x71':function(_0x5f8540,_0x1ed617){return _0x339258[_0x283c('110','\x46\x45\x70\x42')](_0x5f8540,_0x1ed617);},'\x4e\x52\x79\x6c\x79':function(_0x1d726d,_0xe3325f){return _0x339258[_0x283c('111','\x4b\x38\x76\x6b')](_0x1d726d,_0xe3325f);},'\x7a\x46\x77\x52\x4a':function(_0x437da0,_0x42a6ba){return _0x339258[_0x283c('112','\x58\x46\x74\x75')](_0x437da0,_0x42a6ba);},'\x43\x44\x74\x56\x4d':function(_0x552158,_0x3a13f1){return _0x339258[_0x283c('113','\x46\x73\x2a\x21')](_0x552158,_0x3a13f1);},'\x57\x71\x65\x6c\x77':function(_0x2245e8,_0x344dc3){return _0x339258[_0x283c('114','\x75\x47\x53\x40')](_0x2245e8,_0x344dc3);},'\x51\x64\x52\x6e\x59':function(_0x313b66,_0x46dcec){return _0x339258['\x54\x56\x69\x4e\x41'](_0x313b66,_0x46dcec);},'\x76\x52\x48\x42\x5a':function(_0xf54275,_0x1d7267){return _0x339258['\x58\x4c\x50\x41\x59'](_0xf54275,_0x1d7267);},'\x75\x70\x4f\x7a\x65':function(_0x4c4719,_0x2e22fc){return _0x339258[_0x283c('115','\x75\x47\x53\x40')](_0x4c4719,_0x2e22fc);},'\x79\x47\x46\x4e\x44':function(_0x1e9e5c,_0x1af28c){return _0x339258['\x74\x72\x58\x66\x41'](_0x1e9e5c,_0x1af28c);},'\x48\x42\x43\x64\x53':function(_0x3cd4f9,_0x1035e5){return _0x339258['\x53\x55\x51\x6c\x75'](_0x3cd4f9,_0x1035e5);}};var _0x5d3a52=_0x537cdb[_0x283c('116','\x7a\x68\x42\x62')];for(var _0x48cb98=0x0;_0x339258[_0x283c('117','\x58\x46\x74\x75')](_0x48cb98,_0x35511a[_0x283c('118','\x4f\x32\x78\x50')]);++_0x48cb98){var _0x15b97c=_0x35511a[_0x283c('119','\x4c\x37\x43\x58')](_0x48cb98);if(_0x339258[_0x283c('11a','\x66\x78\x5e\x29')](_0x15b97c,0xd800)&&_0x339258[_0x283c('11b','\x70\x41\x28\x67')](_0x15b97c,0xdfff)){_0x15b97c=_0x339258[_0x283c('11c','\x58\x46\x74\x75')](_0x339258[_0x283c('11d','\x57\x49\x4e\x6b')](0x10000,_0x339258[_0x283c('11e','\x57\x49\x4e\x6b')](_0x339258[_0x283c('11f','\x58\x42\x5d\x47')](_0x15b97c,0x3ff),0xa)),_0x339258[_0x283c('120','\x76\x41\x30\x52')](_0x35511a['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x48cb98),0x3ff));}if(_0x339258[_0x283c('121','\x24\x72\x69\x70')](_0x15b97c,0x7f)){if(_0x339258[_0x283c('122','\x4a\x7a\x46\x70')](_0x339258[_0x283c('123','\x4f\x43\x40\x56')],_0x339258['\x4d\x62\x49\x6d\x52'])){_0x5d3a52[_0x404564++]=_0x15b97c;}else{return window[_0x283c('124','\x58\x46\x74\x75')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65'](t,n[_0x283c('125','\x46\x45\x70\x42')]);}}else if(_0x339258[_0x283c('126','\x74\x79\x71\x67')](_0x15b97c,0x7ff)){if(_0x339258['\x64\x6c\x6c\x4f\x76'](_0x339258['\x7a\x4f\x50\x76\x47'],_0x339258[_0x283c('127','\x76\x41\x30\x52')])){_0x5d3a52[_0x404564++]=_0x339258['\x4a\x58\x43\x43\x47'](0xc0,_0x339258[_0x283c('128','\x65\x21\x70\x49')](_0x15b97c,0x6));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('129','\x4f\x32\x78\x50')](0x80,_0x339258[_0x283c('12a','\x4c\x31\x4c\x5b')](_0x15b97c,0x3f));}else{var _0x4606eb=_0x2e7972[_0x283c('12b','\x2a\x44\x29\x21')][_0x283c('12c','\x46\x72\x31\x55')]('\x7c'),_0x404b66=0x0;while(!![]){switch(_0x4606eb[_0x404b66++]){case'\x30':for(var _0x25dcab=0x0;_0x2e7972['\x50\x53\x53\x71\x6a'](_0x25dcab,_0x1fbad8);++_0x25dcab){var _0x574f1a=_0x2e7972['\x79\x76\x41\x47\x63'][_0x283c('12d','\x6b\x43\x6a\x37')]('\x7c'),_0x22b7de=0x0;while(!![]){switch(_0x574f1a[_0x22b7de++]){case'\x30':var _0x477ad9=_0x537cdb[_0x283c('12e','\x46\x72\x31\x55')][_0x283c('12f','\x66\x78\x5e\x29')](_0x2e7972[_0x283c('130','\x29\x21\x72\x39')](_0x48956d,_0x2e7972[_0x283c('131','\x46\x73\x2a\x21')](_0x25dcab,0x10)));continue;case'\x31':var _0x2339c9=_0x537cdb[_0x283c('132','\x23\x7a\x79\x71')][_0x2e7972['\x57\x61\x53\x6a\x41'](_0x2e7972['\x70\x48\x6b\x70\x71'](_0x2e7972[_0x283c('133','\x58\x42\x5d\x47')](_0x49615c,0x4),_0x2e7972['\x7a\x46\x77\x52\x4a'](_0x25dcab,0x8)),0x4)];continue;case'\x32':var _0x17b2b3=_0x537cdb[_0x283c('134','\x2a\x44\x29\x21')][_0x2e7972['\x43\x44\x74\x56\x4d'](_0x2e7972[_0x283c('135','\x4b\x45\x34\x57')](_0x49615c,_0x2e7972['\x51\x64\x52\x6e\x59'](_0x25dcab,0x8)),0x4)];continue;case'\x33':var _0x88cf1=_0x537cdb[_0x283c('136','\x24\x72\x69\x70')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x17b2b3,_0x2339c9);continue;case'\x34':_0x2ecf2d[_0x88cf1]=_0x477ad9;continue;}break;}}continue;case'\x31':var _0x4190e8=_0x537cdb[_0x283c('137','\x56\x34\x37\x55')][_0x283c('138','\x4e\x4b\x29\x6d')];continue;case'\x32':var _0x49615c=_0x2e7972[_0x283c('139','\x32\x35\x46\x26')](_0x4190e8,_0x537cdb[_0x283c('13a','\x47\x6b\x41\x4c')][_0x2e7972[_0x283c('13b','\x66\x78\x5e\x29')](_0x2e7972[_0x283c('13c','\x24\x72\x69\x70')](address,0x8),0x4)]);continue;case'\x33':return _0x2ecf2d;case'\x34':var _0x48956d=_0x2e7972[_0x283c('13d','\x2a\x44\x29\x21')](_0x4190e8,_0x537cdb[_0x283c('13e','\x52\x39\x23\x38')][_0x2e7972[_0x283c('13f','\x23\x7a\x79\x71')](address,0x4)]);continue;case'\x35':var _0x2ecf2d={};continue;case'\x36':var _0x1fbad8=_0x537cdb[_0x283c('140','\x4f\x43\x40\x56')][_0x2e7972[_0x283c('141','\x58\x55\x53\x69')](_0x2e7972[_0x283c('142','\x67\x57\x32\x5e')](address,0x4),0x4)];continue;}break;}}}else if(_0x339258[_0x283c('143','\x4b\x7a\x7a\x71')](_0x15b97c,0xffff)){_0x5d3a52[_0x404564++]=_0x339258['\x72\x59\x73\x6c\x62'](0xe0,_0x339258['\x63\x65\x42\x71\x43'](_0x15b97c,0xc));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('144','\x52\x39\x23\x38')](0x80,_0x339258[_0x283c('145','\x4e\x4b\x29\x6d')](_0x339258[_0x283c('146','\x4a\x7a\x46\x70')](_0x15b97c,0x6),0x3f));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('147','\x6b\x69\x6a\x58')](0x80,_0x339258[_0x283c('148','\x56\x34\x37\x55')](_0x15b97c,0x3f));}else if(_0x339258['\x48\x47\x4a\x48\x42'](_0x15b97c,0x1fffff)){if(_0x339258['\x64\x6c\x6c\x4f\x76'](_0x339258[_0x283c('149','\x4b\x6b\x45\x69')],_0x339258['\x79\x71\x41\x6c\x67'])){_0x5d3a52[_0x404564++]=_0x339258[_0x283c('14a','\x4f\x43\x40\x56')](0xf0,_0x339258['\x47\x69\x78\x69\x75'](_0x15b97c,0x12));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('14b','\x6b\x69\x6a\x58')](0x80,_0x339258[_0x283c('14c','\x4b\x38\x76\x6b')](_0x339258[_0x283c('14d','\x57\x49\x4e\x6b')](_0x15b97c,0xc),0x3f));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('14e','\x38\x46\x43\x5d')](0x80,_0x339258[_0x283c('14f','\x54\x57\x35\x75')](_0x339258[_0x283c('150','\x76\x41\x30\x52')](_0x15b97c,0x6),0x3f));_0x5d3a52[_0x404564++]=_0x339258[_0x283c('151','\x4c\x37\x43\x58')](0x80,_0x339258['\x56\x7a\x4e\x6e\x6d'](_0x15b97c,0x3f));}else{_0x537cdb[_0x283c('152','\x6b\x43\x6a\x37')][_0x339258[_0x283c('153','\x4b\x45\x34\x57')](address,0xc)]=0x3;_0x537cdb[_0x283c('154','\x74\x79\x71\x67')][_0x339258[_0x283c('155','\x4f\x31\x4f\x42')](address,0x8)]=value;}}else if(_0x339258[_0x283c('156','\x56\x34\x37\x55')](_0x15b97c,0x3ffffff)){var _0x19950d=_0x339258[_0x283c('157','\x66\x78\x5e\x29')][_0x283c('158','\x58\x4b\x4f\x4e')]('\x7c'),_0x2a9483=0x0;while(!![]){switch(_0x19950d[_0x2a9483++]){case'\x30':_0x5d3a52[_0x404564++]=_0x339258['\x58\x54\x72\x71\x4b'](0x80,_0x339258[_0x283c('159','\x71\x4b\x28\x4e')](_0x339258['\x6d\x4f\x77\x77\x76'](_0x15b97c,0xc),0x3f));continue;case'\x31':_0x5d3a52[_0x404564++]=_0x339258['\x46\x6b\x6d\x49\x4c'](0x80,_0x339258['\x6e\x49\x42\x6d\x55'](_0x339258[_0x283c('15a','\x66\x78\x5e\x29')](_0x15b97c,0x12),0x3f));continue;case'\x32':_0x5d3a52[_0x404564++]=_0x339258['\x63\x66\x45\x78\x73'](0x80,_0x339258[_0x283c('15b','\x78\x57\x48\x52')](_0x15b97c,0x3f));continue;case'\x33':_0x5d3a52[_0x404564++]=_0x339258[_0x283c('15c','\x32\x35\x4a\x45')](0xf8,_0x339258[_0x283c('15d','\x71\x4b\x28\x4e')](_0x15b97c,0x18));continue;case'\x34':_0x5d3a52[_0x404564++]=_0x339258[_0x283c('15e','\x6a\x52\x4f\x63')](0x80,_0x339258[_0x283c('15b','\x78\x57\x48\x52')](_0x339258[_0x283c('15f','\x4c\x37\x43\x58')](_0x15b97c,0x6),0x3f));continue;}break;}}else{var _0x944176=_0x339258['\x4e\x4a\x76\x6a\x6b'][_0x283c('160','\x6b\x69\x6a\x58')]('\x7c'),_0x5d1895=0x0;while(!![]){switch(_0x944176[_0x5d1895++]){case'\x30':_0x5d3a52[_0x404564++]=_0x339258['\x58\x49\x75\x4a\x59'](0x80,_0x339258['\x6e\x53\x67\x46\x69'](_0x339258['\x51\x57\x6a\x45\x4a'](_0x15b97c,0xc),0x3f));continue;case'\x31':_0x5d3a52[_0x404564++]=_0x339258[_0x283c('161','\x46\x73\x2a\x21')](0xfc,_0x339258[_0x283c('162','\x38\x46\x43\x5d')](_0x15b97c,0x1e));continue;case'\x32':_0x5d3a52[_0x404564++]=_0x339258[_0x283c('163','\x39\x29\x5e\x59')](0x80,_0x339258[_0x283c('164','\x75\x47\x53\x40')](_0x339258[_0x283c('165','\x6b\x69\x6a\x58')](_0x15b97c,0x12),0x3f));continue;case'\x33':_0x5d3a52[_0x404564++]=_0x339258['\x4a\x50\x69\x70\x6a'](0x80,_0x339258[_0x283c('166','\x78\x57\x48\x52')](_0x339258[_0x283c('167','\x32\x35\x4a\x45')](_0x15b97c,0x18),0x3f));continue;case'\x34':_0x5d3a52[_0x404564++]=_0x339258['\x4f\x43\x6c\x50\x71'](0x80,_0x339258[_0x283c('168','\x46\x72\x31\x55')](_0x15b97c,0x3f));continue;case'\x35':_0x5d3a52[_0x404564++]=_0x339258['\x4f\x43\x6c\x50\x71'](0x80,_0x339258[_0x283c('169','\x7a\x68\x42\x62')](_0x339258[_0x283c('16a','\x46\x72\x31\x55')](_0x15b97c,0x6),0x3f));continue;}break;}}}};_0x537cdb[_0x283c('af','\x4b\x7a\x7a\x71')][_0x283c('16b','\x58\x42\x5d\x47')]=function(){};_0x537cdb[_0x283c('16c','\x54\x57\x35\x75')][_0x283c('16d','\x71\x4b\x28\x4e')]=function to_js(_0x5ea70a){var _0x118348={'\x44\x55\x52\x47\x50':function(_0x2cd315,_0x3d7f54){return _0x339258['\x78\x67\x63\x74\x63'](_0x2cd315,_0x3d7f54);},'\x4d\x74\x57\x55\x56':function(_0x27fc8a,_0x340e94){return _0x339258['\x64\x6c\x6c\x4f\x76'](_0x27fc8a,_0x340e94);},'\x41\x4b\x63\x41\x78':_0x339258[_0x283c('16e','\x4c\x31\x4c\x5b')],'\x73\x48\x6a\x74\x74':_0x339258['\x67\x71\x72\x56\x50'],'\x65\x7a\x54\x53\x6b':function(_0x3ba7ea,_0xb19577){return _0x339258['\x67\x7a\x61\x42\x4e'](_0x3ba7ea,_0xb19577);},'\x6b\x69\x5a\x72\x50':_0x339258[_0x283c('16f','\x76\x41\x30\x52')],'\x4b\x65\x6c\x6d\x61':_0x339258['\x61\x73\x42\x6a\x53'],'\x64\x63\x6d\x62\x69':_0x339258[_0x283c('170','\x32\x35\x4a\x45')],'\x6c\x70\x42\x4a\x67':_0x339258[_0x283c('171','\x48\x5e\x38\x66')],'\x63\x6a\x7a\x5a\x50':function(_0x45e0ff,_0x48fcb5){return _0x339258['\x66\x44\x4e\x7a\x4e'](_0x45e0ff,_0x48fcb5);},'\x46\x5a\x4d\x50\x77':_0x339258['\x50\x6d\x64\x66\x4e'],'\x54\x4b\x4d\x6b\x75':_0x339258[_0x283c('172','\x39\x29\x5e\x59')],'\x55\x70\x64\x52\x51':function(_0x3ce974,_0x35af24){return _0x339258[_0x283c('173','\x4c\x37\x43\x58')](_0x3ce974,_0x35af24);},'\x76\x55\x74\x62\x64':function(_0x215f32,_0x2bebb6){return _0x339258[_0x283c('174','\x63\x63\x58\x50')](_0x215f32,_0x2bebb6);},'\x42\x67\x47\x74\x4e':function(_0x428375,_0x1eb67b){return _0x339258[_0x283c('175','\x4f\x32\x78\x50')](_0x428375,_0x1eb67b);},'\x4d\x66\x57\x74\x6d':function(_0x4a69b7,_0x2aa79b){return _0x339258['\x78\x52\x72\x6e\x42'](_0x4a69b7,_0x2aa79b);},'\x6a\x78\x52\x5a\x69':_0x339258['\x56\x42\x55\x50\x48'],'\x43\x76\x62\x6a\x49':_0x339258[_0x283c('176','\x2a\x44\x29\x21')],'\x4c\x48\x64\x66\x6f':function(_0x59b86a,_0x5487ec){return _0x339258[_0x283c('177','\x7a\x68\x42\x62')](_0x59b86a,_0x5487ec);},'\x72\x61\x4d\x4f\x61':_0x339258[_0x283c('178','\x7a\x68\x42\x62')],'\x47\x6d\x6d\x58\x69':function(_0x377d4f,_0x398ccd){return _0x339258[_0x283c('179','\x4a\x7a\x46\x70')](_0x377d4f,_0x398ccd);},'\x45\x52\x5a\x64\x74':function(_0x5ec267,_0x4860d7){return _0x339258['\x46\x68\x63\x53\x70'](_0x5ec267,_0x4860d7);},'\x76\x50\x6e\x63\x6e':function(_0x17813d,_0x3ec143){return _0x339258['\x43\x66\x68\x54\x48'](_0x17813d,_0x3ec143);}};if(_0x339258[_0x283c('17a','\x4e\x4b\x29\x6d')](_0x339258['\x5a\x64\x78\x72\x4f'],_0x339258['\x5a\x64\x78\x72\x4f'])){var _0x332a7e=_0x537cdb[_0x283c('17b','\x4f\x31\x4f\x42')][_0x339258[_0x283c('17c','\x58\x55\x53\x69')](_0x5ea70a,0xc)];if(_0x339258[_0x283c('17d','\x66\x78\x5e\x29')](_0x332a7e,0x0)){return undefined;}else if(_0x339258[_0x283c('17e','\x58\x46\x74\x75')](_0x332a7e,0x1)){if(_0x339258[_0x283c('17f','\x4f\x32\x78\x50')](_0x339258[_0x283c('180','\x4f\x32\x78\x50')],_0x339258[_0x283c('181','\x38\x46\x43\x5d')])){return null;}else{ref_to_id_map[_0x283c('182','\x4c\x37\x43\x58')](reference,refid);}}else if(_0x339258[_0x283c('183','\x24\x72\x69\x70')](_0x332a7e,0x2)){return _0x537cdb[_0x283c('184','\x4b\x7a\x7a\x71')][_0x339258[_0x283c('185','\x74\x79\x71\x67')](_0x5ea70a,0x4)];}else if(_0x339258[_0x283c('186','\x4f\x31\x4f\x42')](_0x332a7e,0x3)){if(_0x339258[_0x283c('187','\x23\x7a\x79\x71')](_0x339258[_0x283c('188','\x58\x55\x53\x69')],_0x339258[_0x283c('189','\x4b\x45\x34\x57')])){return _0x537cdb['\x48\x45\x41\x50\x46\x36\x34'][_0x339258[_0x283c('18a','\x74\x79\x71\x67')](_0x5ea70a,0x8)];}else{w=_0x370e53[index++];}}else if(_0x339258[_0x283c('18b','\x4c\x31\x4c\x5b')](_0x332a7e,0x4)){if(_0x339258[_0x283c('18c','\x4f\x31\x4f\x42')](_0x339258[_0x283c('18d','\x32\x35\x4a\x45')],_0x339258[_0x283c('18e','\x58\x55\x53\x69')])){var _0x4b9d0b=_0x537cdb[_0x283c('18f','\x46\x72\x31\x55')][_0x339258[_0x283c('190','\x38\x46\x43\x5d')](_0x5ea70a,0x4)];var _0x4f8dda=_0x537cdb[_0x283c('191','\x4c\x31\x4c\x5b')][_0x339258[_0x283c('192','\x32\x35\x46\x26')](_0x339258[_0x283c('193','\x74\x79\x71\x67')](_0x5ea70a,0x4),0x4)];return _0x537cdb[_0x283c('194','\x63\x63\x58\x50')][_0x283c('195','\x46\x72\x31\x55')](_0x4b9d0b,_0x4f8dda);}else{var _0x1a686e=_0x537cdb[_0x283c('12e','\x46\x72\x31\x55')][_0x283c('196','\x66\x78\x5e\x29')](0x10);_0x537cdb[_0x283c('197','\x42\x58\x76\x31')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1a686e,_0x4df1a1);return _0x1a686e;}}else if(_0x339258[_0x283c('198','\x58\x46\x74\x75')](_0x332a7e,0x5)){if(_0x339258[_0x283c('199','\x7a\x68\x42\x62')](_0x339258[_0x283c('19a','\x4c\x31\x4c\x5b')],_0x339258[_0x283c('19b','\x70\x41\x28\x67')])){return![];}else{var _0x144cfa=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('19c','\x6b\x69\x6a\x58')](_0x5ea70a,0x4)];var _0x1907db=_0x537cdb[_0x283c('19d','\x63\x63\x58\x50')][_0x339258[_0x283c('19e','\x4b\x45\x34\x57')](_0x339258['\x53\x55\x51\x6c\x75'](_0x5ea70a,0x4),0x4)];return _0x537cdb[_0x283c('19f','\x70\x41\x28\x67')][_0x283c('1a0','\x32\x35\x46\x26')](_0x144cfa,_0x1907db);}}else if(_0x339258[_0x283c('1a1','\x6a\x52\x4f\x63')](_0x332a7e,0x6)){if(_0x339258['\x64\x6c\x6c\x4f\x76'](_0x339258[_0x283c('1a2','\x66\x78\x5e\x29')],_0x339258[_0x283c('1a3','\x63\x63\x58\x50')])){return!![];}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else if(_0x339258['\x44\x72\x4e\x63\x4d'](_0x332a7e,0x7)){if(_0x339258[_0x283c('1a4','\x4b\x7a\x7a\x71')](_0x339258[_0x283c('1a5','\x4f\x31\x4f\x42')],_0x339258[_0x283c('1a6','\x65\x21\x70\x49')])){return _0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1a7','\x74\x79\x71\x67')][id];}else{var _0x467543=_0x339258[_0x283c('1a8','\x4c\x31\x4c\x5b')][_0x283c('1a9','\x74\x79\x71\x67')]('\x7c'),_0x49ebb1=0x0;while(!![]){switch(_0x467543[_0x49ebb1++]){case'\x30':for(var _0x177e51=0x0;_0x339258[_0x283c('1aa','\x67\x57\x32\x5e')](_0x177e51,_0x4f8dda);++_0x177e51){_0x35dbd5['\x70\x75\x73\x68'](_0x537cdb[_0x283c('1ab','\x4b\x45\x34\x57')][_0x283c('1ac','\x2a\x44\x29\x21')](_0x339258[_0x283c('1ad','\x2a\x44\x29\x21')](_0x4b9d0b,_0x339258['\x79\x67\x46\x7a\x7a'](_0x177e51,0x10))));}continue;case'\x31':return _0x35dbd5;case'\x32':var _0x35dbd5=[];continue;case'\x33':var _0x4f8dda=_0x537cdb[_0x283c('1ae','\x24\x72\x69\x70')][_0x339258['\x77\x59\x57\x5a\x56'](_0x339258[_0x283c('1af','\x6b\x43\x6a\x37')](_0x5ea70a,0x4),0x4)];continue;case'\x34':var _0x4b9d0b=_0x339258[_0x283c('1b0','\x32\x35\x4a\x45')](_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')]['\x61\x72\x65\x6e\x61'],_0x537cdb[_0x283c('1b2','\x58\x46\x74\x75')][_0x339258['\x51\x72\x54\x57\x6b'](_0x5ea70a,0x4)]);continue;}break;}}}else if(_0x339258[_0x283c('1b3','\x67\x57\x32\x5e')](_0x332a7e,0x8)){var _0x41cd2f=_0x339258[_0x283c('1b4','\x4a\x7a\x46\x70')][_0x283c('1b5','\x42\x58\x76\x31')]('\x7c'),_0x1b4865=0x0;while(!![]){switch(_0x41cd2f[_0x1b4865++]){case'\x30':var _0x39e3c0=_0x339258[_0x283c('1b6','\x6b\x69\x6a\x58')](_0x397028,_0x537cdb[_0x283c('1b7','\x70\x41\x28\x67')][_0x339258[_0x283c('1b8','\x58\x42\x5d\x47')](_0x339258[_0x283c('1b9','\x4c\x31\x4c\x5b')](_0x5ea70a,0x8),0x4)]);continue;case'\x31':var _0x4f8dda=_0x537cdb[_0x283c('1ba','\x4b\x6b\x45\x69')][_0x339258[_0x283c('1bb','\x4c\x31\x4c\x5b')](_0x339258[_0x283c('1bc','\x76\x41\x30\x52')](_0x5ea70a,0x4),0x4)];continue;case'\x32':var _0x35dbd5={};continue;case'\x33':for(var _0x177e51=0x0;_0x339258[_0x283c('1bd','\x66\x78\x5e\x29')](_0x177e51,_0x4f8dda);++_0x177e51){var _0x42a667=_0x339258[_0x283c('1be','\x65\x21\x70\x49')][_0x283c('1bf','\x65\x21\x70\x49')]('\x7c'),_0x2a9de4=0x0;while(!![]){switch(_0x42a667[_0x2a9de4++]){case'\x30':var _0x4df1a1=_0x537cdb[_0x283c('1c0','\x75\x47\x53\x40')][_0x283c('1c1','\x75\x47\x53\x40')](_0x339258[_0x283c('1c2','\x29\x67\x41\x78')](_0x1b5f64,_0x339258[_0x283c('1c3','\x57\x49\x4e\x6b')](_0x177e51,0x10)));continue;case'\x31':var _0x54ad2d=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1c4','\x4b\x6b\x45\x69')](_0x3c69b2,_0x14752f);continue;case'\x32':_0x35dbd5[_0x54ad2d]=_0x4df1a1;continue;case'\x33':var _0x3c69b2=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('1c5','\x23\x7a\x79\x71')](_0x339258[_0x283c('1c6','\x4c\x31\x4c\x5b')](_0x39e3c0,_0x339258[_0x283c('1c7','\x2a\x44\x29\x21')](_0x177e51,0x8)),0x4)];continue;case'\x34':var _0x14752f=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('1c8','\x57\x49\x4e\x6b')](_0x339258[_0x283c('1c9','\x58\x46\x74\x75')](_0x339258[_0x283c('1ca','\x29\x67\x41\x78')](_0x39e3c0,0x4),_0x339258[_0x283c('1cb','\x4f\x43\x40\x56')](_0x177e51,0x8)),0x4)];continue;}break;}}continue;case'\x34':var _0x1b5f64=_0x339258['\x6d\x41\x46\x61\x42'](_0x397028,_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258['\x55\x59\x7a\x4d\x55'](_0x5ea70a,0x4)]);continue;case'\x35':var _0x397028=_0x537cdb[_0x283c('1cc','\x4f\x43\x40\x56')]['\x61\x72\x65\x6e\x61'];continue;case'\x36':return _0x35dbd5;}break;}}else if(_0x339258[_0x283c('1cd','\x71\x4b\x28\x4e')](_0x332a7e,0x9)){return _0x537cdb[_0x283c('1ce','\x4c\x31\x4c\x5b')][_0x283c('1cf','\x4f\x31\x4f\x42')](_0x537cdb[_0x283c('1d0','\x63\x63\x58\x50')][_0x339258[_0x283c('1d1','\x71\x4b\x28\x4e')](_0x5ea70a,0x4)]);}else if(_0x339258[_0x283c('1d2','\x58\x42\x5d\x47')](_0x332a7e,0xa)||_0x339258[_0x283c('1d3','\x58\x55\x53\x69')](_0x332a7e,0xc)||_0x339258['\x70\x4e\x61\x58\x56'](_0x332a7e,0xd)){if(_0x339258[_0x283c('1d4','\x58\x46\x74\x75')](_0x339258['\x66\x59\x52\x63\x43'],_0x339258[_0x283c('1d5','\x6b\x43\x6a\x37')])){_0x1e39af-=0x1;}else{var _0x467323=_0x537cdb[_0x283c('1b2','\x58\x46\x74\x75')][_0x339258[_0x283c('1d6','\x25\x68\x77\x32')](_0x5ea70a,0x4)];var _0x4b9d0b=_0x537cdb[_0x283c('1d7','\x6b\x61\x37\x4e')][_0x339258[_0x283c('1d8','\x39\x29\x5e\x59')](_0x339258['\x41\x55\x58\x59\x44'](_0x5ea70a,0x4),0x4)];var _0x428758=_0x537cdb[_0x283c('1d9','\x74\x79\x71\x67')][_0x339258['\x6d\x7a\x6d\x6d\x47'](_0x339258['\x69\x64\x4f\x61\x7a'](_0x5ea70a,0x8),0x4)];var _0x1e39af=0x0;var _0x5edac0=![];var _0x35dbd5=function(){if(_0x118348['\x44\x55\x52\x47\x50'](_0x4b9d0b,0x0)||_0x118348['\x44\x55\x52\x47\x50'](_0x5edac0,!![])){if(_0x118348[_0x283c('1da','\x67\x57\x32\x5e')](_0x332a7e,0xa)){if(_0x118348['\x4d\x74\x57\x55\x56'](_0x118348[_0x283c('1db','\x7a\x68\x42\x62')],_0x118348[_0x283c('1dc','\x38\x46\x43\x5d')])){r=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1dd','\x4a\x7a\x46\x70')](r),_0x537cdb[_0x283c('1de','\x46\x73\x2a\x21')][_0x283c('1df','\x56\x34\x37\x55')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x283c('1e0','\x46\x73\x2a\x21')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x469c50){return{'\x65\x72\x72\x6f\x72':_0x469c50,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{throw new ReferenceError(_0x118348[_0x283c('1e1','\x48\x5e\x38\x66')]);}}else if(_0x118348[_0x283c('1e2','\x7a\x68\x42\x62')](_0x332a7e,0xc)){throw new ReferenceError(_0x118348['\x6b\x69\x5a\x72\x50']);}else{if(_0x118348['\x65\x7a\x54\x53\x6b'](_0x118348[_0x283c('1e3','\x76\x41\x30\x52')],_0x118348[_0x283c('1e4','\x4b\x45\x34\x57')])){var _0x152701=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1e5','\x4f\x31\x4f\x42')](_0x537cdb[_0x283c('1e6','\x39\x29\x5e\x59')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x283c('1e7','\x74\x79\x71\x67')](_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1e8','\x67\x57\x32\x5e')](t),_0x537cdb[_0x283c('1e9','\x4a\x7a\x46\x70')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](r)));return _0x152701;}else{throw new ReferenceError(_0x118348['\x6c\x70\x42\x4a\x67']);}}}var _0x287037=_0x4b9d0b;if(_0x118348[_0x283c('1ea','\x54\x57\x35\x75')](_0x332a7e,0xd)){_0x35dbd5['\x64\x72\x6f\x70']=_0x537cdb[_0x283c('1eb','\x4b\x38\x76\x6b')][_0x283c('1ec','\x71\x4b\x28\x4e')];_0x4b9d0b=0x0;}if(_0x118348[_0x283c('1ed','\x2a\x44\x29\x21')](_0x1e39af,0x0)){if(_0x118348[_0x283c('1ea','\x54\x57\x35\x75')](_0x332a7e,0xc)||_0x118348[_0x283c('1ee','\x4a\x7a\x46\x70')](_0x332a7e,0xd)){throw new ReferenceError(_0x118348['\x46\x5a\x4d\x50\x77']);}}var _0x2235bb=_0x537cdb[_0x283c('1ef','\x46\x45\x70\x42')][_0x283c('1f0','\x2a\x44\x29\x21')](0x10);_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1f1','\x58\x46\x74\x75')](_0x2235bb,arguments);try{_0x1e39af+=0x1;_0x537cdb[_0x283c('1cc','\x4f\x43\x40\x56')][_0x283c('1f2','\x6a\x52\x4f\x63')](_0x118348[_0x283c('1f3','\x29\x67\x41\x78')],_0x467323,[_0x287037,_0x2235bb]);_0x537cdb[_0x283c('1e9','\x4a\x7a\x46\x70')][_0x283c('1f4','\x4b\x7a\x7a\x71')]=null;var _0x1671c3=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('1f5','\x74\x79\x71\x67')];}finally{_0x1e39af-=0x1;}if(_0x118348['\x55\x70\x64\x52\x51'](_0x5edac0,!![])&&_0x118348[_0x283c('1f6','\x67\x57\x32\x5e')](_0x1e39af,0x0)){_0x35dbd5[_0x283c('1f7','\x71\x4b\x28\x4e')]();}return _0x1671c3;};_0x35dbd5[_0x283c('1f8','\x70\x41\x28\x67')]=function(){var _0x165f5c={'\x4e\x49\x61\x47\x73':function(_0x5676e6,_0x818f2c){return _0x118348['\x42\x67\x47\x74\x4e'](_0x5676e6,_0x818f2c);},'\x4e\x4a\x72\x56\x49':function(_0x2988ed,_0x587dd0){return _0x118348[_0x283c('1f9','\x6b\x61\x37\x4e')](_0x2988ed,_0x587dd0);}};if(_0x118348[_0x283c('1fa','\x57\x49\x4e\x6b')](_0x1e39af,0x0)){if(_0x118348['\x76\x55\x74\x62\x64'](_0x118348[_0x283c('1fb','\x46\x72\x31\x55')],_0x118348[_0x283c('1fc','\x24\x72\x69\x70')])){var _0x56e4f2=_0x537cdb[_0x283c('1fd','\x29\x21\x72\x39')][_0x283c('1fe','\x54\x57\x35\x75')](_0x4df1a1);_0x537cdb[_0x283c('1ff','\x70\x41\x28\x67')][_0x165f5c['\x4e\x49\x61\x47\x73'](_0x5ea70a,0xc)]=0x9;_0x537cdb[_0x283c('200','\x4f\x31\x4f\x42')][_0x165f5c['\x4e\x4a\x72\x56\x49'](_0x5ea70a,0x4)]=_0x56e4f2;}else{_0x5edac0=!![];return;}}_0x35dbd5[_0x283c('201','\x78\x57\x48\x52')]=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6e\x6f\x6f\x70'];var _0x55b724=_0x4b9d0b;_0x4b9d0b=0x0;if(_0x118348[_0x283c('202','\x6b\x43\x6a\x37')](_0x55b724,0x0)){_0x537cdb[_0x283c('2e','\x52\x39\x23\x38')][_0x283c('203','\x71\x4b\x28\x4e')]('\x76\x69',_0x428758,[_0x55b724]);}};return _0x35dbd5;}}else if(_0x339258['\x59\x78\x45\x6a\x43'](_0x332a7e,0xe)){if(_0x339258[_0x283c('204','\x38\x46\x43\x5d')](_0x339258[_0x283c('205','\x7a\x68\x42\x62')],_0x339258[_0x283c('206','\x4f\x31\x4f\x42')])){var _0x4a1596=_0x339258[_0x283c('207','\x58\x46\x74\x75')][_0x283c('208','\x4e\x4b\x29\x6d')]('\x7c'),_0x3a2a9d=0x0;while(!![]){switch(_0x4a1596[_0x3a2a9d++]){case'\x30':switch(_0x470a8d){case 0x0:return _0x537cdb[_0x283c('209','\x57\x49\x4e\x6b')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4b9d0b,_0x4dfda1);case 0x1:return _0x537cdb[_0x283c('20a','\x4b\x7a\x7a\x71')][_0x283c('20b','\x42\x58\x76\x31')](_0x4b9d0b,_0x4dfda1);case 0x2:return _0x537cdb[_0x283c('20c','\x65\x21\x70\x49')][_0x283c('20d','\x75\x47\x53\x40')](_0x4b9d0b,_0x4dfda1);case 0x3:return _0x537cdb['\x48\x45\x41\x50\x31\x36'][_0x283c('20e','\x6a\x52\x4f\x63')](_0x4b9d0b,_0x4dfda1);case 0x4:return _0x537cdb[_0x283c('1ae','\x24\x72\x69\x70')][_0x283c('20f','\x48\x5e\x38\x66')](_0x4b9d0b,_0x4dfda1);case 0x5:return _0x537cdb[_0x283c('210','\x58\x42\x5d\x47')][_0x283c('211','\x57\x49\x4e\x6b')](_0x4b9d0b,_0x4dfda1);case 0x6:return _0x537cdb['\x48\x45\x41\x50\x46\x33\x32'][_0x283c('212','\x6b\x69\x6a\x58')](_0x4b9d0b,_0x4dfda1);case 0x7:return _0x537cdb['\x48\x45\x41\x50\x46\x36\x34'][_0x283c('213','\x46\x72\x31\x55')](_0x4b9d0b,_0x4dfda1);}continue;case'\x31':var _0x4f8dda=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('214','\x2a\x44\x29\x21')](_0x339258[_0x283c('215','\x4c\x31\x4c\x5b')](_0x5ea70a,0x4),0x4)];continue;case'\x32':var _0x4b9d0b=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('216','\x29\x67\x41\x78')](_0x5ea70a,0x4)];continue;case'\x33':var _0x470a8d=_0x537cdb[_0x283c('217','\x46\x73\x2a\x21')][_0x339258['\x66\x4d\x58\x4d\x64'](_0x339258[_0x283c('218','\x65\x21\x70\x49')](_0x5ea70a,0x8),0x4)];continue;case'\x34':var _0x4dfda1=_0x339258[_0x283c('219','\x32\x35\x4a\x45')](_0x4b9d0b,_0x4f8dda);continue;}break;}}else{var _0x4a8538={'\x4d\x45\x43\x41\x53':_0x118348[_0x283c('21a','\x78\x57\x48\x52')],'\x44\x6a\x4a\x50\x4c':function(_0x3712dc,_0x5984fb){return _0x118348[_0x283c('21b','\x54\x57\x35\x75')](_0x3712dc,_0x5984fb);},'\x4a\x56\x79\x41\x47':function(_0x57af2c,_0x25d1f1){return _0x118348[_0x283c('21c','\x4f\x31\x4f\x42')](_0x57af2c,_0x25d1f1);},'\x79\x77\x43\x6f\x6f':function(_0x34d09a,_0x3b0e38){return _0x118348[_0x283c('21d','\x4f\x31\x4f\x42')](_0x34d09a,_0x3b0e38);},'\x4d\x4e\x71\x76\x42':function(_0x57ff13,_0x7beb31){return _0x118348[_0x283c('21e','\x23\x7a\x79\x71')](_0x57ff13,_0x7beb31);}};_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67']=function to_utf8_string(_0x32fc1b,_0x491f01){var HcgTrV=_0x4a8538['\x4d\x45\x43\x41\x53'][_0x283c('21f','\x7a\x68\x42\x62')]('\x7c'),CsdDSC=0x0;while(!![]){switch(HcgTrV[CsdDSC++]){case'\x30':if(_0x4a8538[_0x283c('220','\x4c\x37\x43\x58')](_0x577828,0x0)){_0x2ccefc=_0x537cdb[_0x283c('221','\x29\x67\x41\x78')][_0x283c('222','\x23\x7a\x79\x71')](_0x577828);_0x537cdb[_0x283c('223','\x75\x47\x53\x40')][_0x283c('224','\x66\x78\x5e\x29')](_0x3720b3,_0x2ccefc);}continue;case'\x31':_0x537cdb[_0x283c('225','\x4b\x7a\x7a\x71')][_0x4a8538[_0x283c('226','\x58\x46\x74\x75')](_0x4a8538['\x79\x77\x43\x6f\x6f'](_0x32fc1b,0x4),0x4)]=_0x577828;continue;case'\x32':_0x537cdb[_0x283c('227','\x58\x42\x5d\x47')][_0x4a8538[_0x283c('228','\x58\x55\x53\x69')](_0x32fc1b,0x4)]=_0x2ccefc;continue;case'\x33':var _0x577828=_0x3720b3[_0x283c('229','\x38\x46\x43\x5d')];continue;case'\x34':var _0x2ccefc=0x0;continue;case'\x35':var _0x3720b3=_0x3a1364[_0x283c('22a','\x38\x46\x43\x5d')](_0x491f01);continue;}break;}};}}else if(_0x339258[_0x283c('22b','\x25\x68\x77\x32')](_0x332a7e,0xf)){return _0x537cdb[_0x283c('22c','\x76\x41\x30\x52')][_0x283c('22d','\x66\x78\x5e\x29')](_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('22e','\x46\x73\x2a\x21')](_0x5ea70a,0x4)]);}}else{try{return{'\x76\x61\x6c\x75\x65':r[_0x283c('22f','\x46\x72\x31\x55')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x202e20){return{'\x65\x72\x72\x6f\x72':_0x202e20,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}};_0x537cdb[_0x283c('230','\x4c\x37\x43\x58')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x6f\x62\x6a\x65\x63\x74']=function serialize_object(_0x113d67,_0x199812){var _0x2e72f4=_0x339258[_0x283c('231','\x38\x46\x43\x5d')][_0x283c('232','\x58\x46\x74\x75')]('\x7c'),_0x56e817=0x0;while(!![]){switch(_0x2e72f4[_0x56e817++]){case'\x30':_0x537cdb[_0x283c('233','\x65\x21\x70\x49')][_0x339258[_0x283c('22e','\x46\x73\x2a\x21')](_0x113d67,0x4)]=_0x340579;continue;case'\x31':_0x537cdb[_0x283c('234','\x6a\x52\x4f\x63')][_0x339258['\x68\x5a\x70\x65\x73'](_0x339258[_0x283c('235','\x71\x4b\x28\x4e')](_0x113d67,0x4),0x4)]=_0x2d43a3;continue;case'\x32':var _0x2d43a3=_0x234dd6[_0x283c('236','\x29\x21\x72\x39')];continue;case'\x33':var _0x234dd6=Object[_0x283c('237','\x29\x67\x41\x78')](_0x199812);continue;case'\x34':var _0xa4eab6=_0x537cdb[_0x283c('1ef','\x46\x45\x70\x42')][_0x283c('238','\x4b\x38\x76\x6b')](_0x339258['\x4e\x49\x49\x63\x77'](_0x2d43a3,0x8));continue;case'\x35':for(var _0x1dc751=0x0;_0x339258['\x47\x6a\x51\x6f\x4a'](_0x1dc751,_0x2d43a3);++_0x1dc751){var _0x36b23b=_0x234dd6[_0x1dc751];var _0x4ca8e4=_0x339258['\x42\x41\x6c\x6d\x5a'](_0xa4eab6,_0x339258['\x4e\x49\x49\x63\x77'](_0x1dc751,0x8));_0x537cdb[_0x283c('19f','\x70\x41\x28\x67')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x4ca8e4,_0x36b23b);_0x537cdb[_0x283c('239','\x6b\x61\x37\x4e')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x339258[_0x283c('23a','\x29\x21\x72\x39')](_0x340579,_0x339258[_0x283c('23b','\x4b\x38\x76\x6b')](_0x1dc751,0x10)),_0x199812[_0x36b23b]);}continue;case'\x36':var _0x340579=_0x537cdb[_0x283c('23c','\x6b\x69\x6a\x58')][_0x283c('23d','\x58\x55\x53\x69')](_0x339258['\x4e\x49\x49\x63\x77'](_0x2d43a3,0x10));continue;case'\x37':_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258[_0x283c('23e','\x24\x72\x69\x70')](_0x113d67,0xc)]=0x8;continue;case'\x38':_0x537cdb[_0x283c('23f','\x46\x45\x70\x42')][_0x339258[_0x283c('240','\x4f\x32\x78\x50')](_0x339258['\x50\x6d\x48\x5a\x4b'](_0x113d67,0x8),0x4)]=_0xa4eab6;continue;}break;}};_0x537cdb[_0x283c('241','\x25\x68\x77\x32')][_0x283c('242','\x76\x41\x30\x52')]=function serialize_array(_0x400a99,_0x40fcb7){var _0x3eb245=_0x40fcb7[_0x283c('243','\x7a\x68\x42\x62')];var _0x34e123=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('196','\x66\x78\x5e\x29')](_0x339258['\x4e\x49\x49\x63\x77'](_0x3eb245,0x10));_0x537cdb[_0x283c('244','\x4f\x43\x40\x56')][_0x339258['\x48\x72\x53\x4d\x79'](_0x400a99,0xc)]=0x7;_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('245','\x6b\x61\x37\x4e')](_0x400a99,0x4)]=_0x34e123;_0x537cdb[_0x283c('246','\x75\x47\x53\x40')][_0x339258[_0x283c('247','\x48\x5e\x38\x66')](_0x339258[_0x283c('248','\x4c\x31\x4c\x5b')](_0x400a99,0x4),0x4)]=_0x3eb245;for(var _0x4ad79e=0x0;_0x339258[_0x283c('249','\x4f\x32\x78\x50')](_0x4ad79e,_0x3eb245);++_0x4ad79e){if(_0x339258['\x48\x41\x4a\x4c\x44'](_0x339258[_0x283c('24a','\x46\x72\x31\x55')],_0x339258[_0x283c('24b','\x6b\x69\x6a\x58')])){t=_0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('24c','\x4c\x31\x4c\x5b')](t),_0x537cdb[_0x283c('1c0','\x75\x47\x53\x40')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](t);}else{_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('24d','\x65\x21\x70\x49')](_0x339258[_0x283c('24e','\x29\x21\x72\x39')](_0x34e123,_0x339258[_0x283c('24f','\x58\x55\x53\x69')](_0x4ad79e,0x10)),_0x40fcb7[_0x4ad79e]);}}};var _0x3a1364=_0x339258[_0x283c('250','\x66\x78\x5e\x29')](typeof TextEncoder,_0x339258[_0x283c('251','\x32\x35\x46\x26')])?new TextEncoder(_0x339258[_0x283c('252','\x4f\x31\x4f\x42')]):_0x339258['\x53\x41\x5a\x7a\x57'](typeof util,_0x339258[_0x283c('253','\x57\x49\x4e\x6b')])&&util&&_0x339258[_0x283c('254','\x71\x4b\x28\x4e')](typeof util[_0x283c('255','\x47\x6b\x41\x4c')],_0x339258[_0x283c('256','\x46\x72\x31\x55')])?new util[(_0x283c('257','\x54\x57\x35\x75'))](_0x339258[_0x283c('258','\x71\x4b\x28\x4e')]):null;if(_0x339258[_0x283c('259','\x39\x29\x5e\x59')](_0x3a1364,null)){_0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67']=function to_utf8_string(_0x451066,_0x32bdc9){var _0xc681c5={'\x6b\x54\x68\x69\x55':_0x339258[_0x283c('25a','\x58\x46\x74\x75')]};if(_0x339258[_0x283c('25b','\x6b\x43\x6a\x37')](_0x339258[_0x283c('25c','\x4b\x38\x76\x6b')],_0x339258[_0x283c('25d','\x48\x5e\x38\x66')])){throw new ReferenceError(_0xc681c5[_0x283c('25e','\x6b\x43\x6a\x37')]);}else{var _0x22ecbf=_0x339258[_0x283c('25f','\x2a\x44\x29\x21')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x2d20ff=0x0;while(!![]){switch(_0x22ecbf[_0x2d20ff++]){case'\x30':if(_0x339258[_0x283c('260','\x58\x42\x5d\x47')](_0x4a8659,0x0)){_0x4b8502=_0x537cdb[_0x283c('261','\x32\x35\x4a\x45')][_0x283c('262','\x32\x35\x4a\x45')](_0x4a8659);_0x537cdb['\x48\x45\x41\x50\x55\x38']['\x73\x65\x74'](_0x11dc91,_0x4b8502);}continue;case'\x31':var _0x4a8659=_0x11dc91['\x6c\x65\x6e\x67\x74\x68'];continue;case'\x32':var _0x4b8502=0x0;continue;case'\x33':_0x537cdb[_0x283c('1b7','\x70\x41\x28\x67')][_0x339258[_0x283c('263','\x42\x58\x76\x31')](_0x451066,0x4)]=_0x4b8502;continue;case'\x34':_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('264','\x24\x72\x69\x70')](_0x339258[_0x283c('265','\x4b\x45\x34\x57')](_0x451066,0x4),0x4)]=_0x4a8659;continue;case'\x35':var _0x11dc91=_0x3a1364['\x65\x6e\x63\x6f\x64\x65'](_0x32bdc9);continue;}break;}}};}else{_0x537cdb[_0x283c('266','\x78\x57\x48\x52')][_0x283c('267','\x63\x63\x58\x50')]=function to_utf8_string(_0x2b1844,_0x54dbeb){if(_0x339258[_0x283c('268','\x6b\x69\x6a\x58')](_0x339258[_0x283c('269','\x39\x29\x5e\x59')],_0x339258[_0x283c('26a','\x63\x63\x58\x50')])){var _0x24265b=_0x339258[_0x283c('26b','\x4b\x6b\x45\x69')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x2e719e=0x0;while(!![]){switch(_0x24265b[_0x2e719e++]){case'\x30':_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x339258[_0x283c('26c','\x4b\x45\x34\x57')](_0x339258[_0x283c('26d','\x63\x63\x58\x50')](_0x2b1844,0x4),0x4)]=_0x18f1f3;continue;case'\x31':var _0x23bd11=0x0;continue;case'\x32':if(_0x339258[_0x283c('26e','\x4b\x7a\x7a\x71')](_0x18f1f3,0x0)){_0x23bd11=_0x537cdb[_0x283c('194','\x63\x63\x58\x50')][_0x283c('222','\x23\x7a\x79\x71')](_0x18f1f3);_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('26f','\x6a\x52\x4f\x63')](_0x54dbeb,_0x23bd11);}continue;case'\x33':_0x537cdb[_0x283c('270','\x39\x29\x5e\x59')][_0x339258[_0x283c('271','\x58\x42\x5d\x47')](_0x2b1844,0x4)]=_0x23bd11;continue;case'\x34':var _0x18f1f3=_0x537cdb[_0x283c('1e9','\x4a\x7a\x46\x70')][_0x283c('272','\x4b\x45\x34\x57')](_0x54dbeb);continue;}break;}}else{var _0x2a13d7=_0x339258[_0x283c('273','\x58\x55\x53\x69')][_0x283c('274','\x4c\x37\x43\x58')]('\x7c'),_0x190c33=0x0;while(!![]){switch(_0x2a13d7[_0x190c33++]){case'\x30':var _0x312904=_0x339258['\x4f\x43\x6c\x50\x71'](_0x339258[_0x283c('275','\x56\x34\x37\x55')](_0x339258[_0x283c('276','\x75\x47\x53\x40')](y,0x3f),0x6),_0x339258[_0x283c('277','\x47\x6b\x41\x4c')](_0x742848,0x3f));continue;case'\x31':var _0x742848=0x0;continue;case'\x32':if(_0x339258[_0x283c('278','\x29\x67\x41\x78')](x,0xf0)){var _0x4b6a53=_0x339258[_0x283c('279','\x6b\x69\x6a\x58')][_0x283c('27a','\x32\x35\x46\x26')]('\x7c'),_0x5749ea=0x0;while(!![]){switch(_0x4b6a53[_0x5749ea++]){case'\x30':if(_0x339258[_0x283c('27b','\x56\x34\x37\x55')](index,end)){_0x31a8c4=_0x370e53[index++];}continue;case'\x31':ch=_0x339258[_0x283c('27c','\x52\x39\x23\x38')](_0x339258[_0x283c('27d','\x4f\x43\x40\x56')](_0x339258[_0x283c('27e','\x70\x41\x28\x67')](init,0x7),0x12),_0x339258['\x4f\x43\x6c\x50\x71'](_0x339258[_0x283c('27f','\x67\x57\x32\x5e')](_0x312904,0x6),_0x339258[_0x283c('280','\x4c\x31\x4c\x5b')](_0x31a8c4,0x3f)));continue;case'\x32':ch=_0x339258['\x64\x62\x6b\x75\x65'](0xdc00,_0x339258[_0x283c('281','\x66\x78\x5e\x29')](ch,0x3ff));continue;case'\x33':var _0x31a8c4=0x0;continue;case'\x34':output+=String[_0x283c('282','\x58\x4b\x4f\x4e')](_0x339258[_0x283c('283','\x65\x21\x70\x49')](0xd7c0,_0x339258[_0x283c('284','\x58\x46\x74\x75')](ch,0xa)));continue;}break;}}continue;case'\x33':if(_0x339258['\x54\x50\x48\x62\x72'](index,end)){_0x742848=_0x370e53[index++];}continue;case'\x34':ch=_0x339258[_0x283c('285','\x67\x57\x32\x5e')](_0x339258['\x69\x4d\x79\x4a\x65'](init,0xc),_0x312904);continue;}break;}}};}_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('286','\x25\x68\x77\x32')]=function from_js(_0x1fde8d,_0x1e5b9c){var _0xd08d93=Object[_0x283c('287','\x6b\x61\x37\x4e')][_0x283c('288','\x70\x41\x28\x67')][_0x283c('289','\x63\x63\x58\x50')](_0x1e5b9c);if(_0x339258['\x6f\x67\x77\x4a\x79'](_0xd08d93,_0x339258[_0x283c('28a','\x63\x63\x58\x50')])){if(_0x339258[_0x283c('28b','\x4c\x37\x43\x58')](_0x339258[_0x283c('28c','\x76\x41\x30\x52')],_0x339258[_0x283c('28d','\x32\x35\x46\x26')])){_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258['\x58\x75\x48\x42\x56'](_0x1fde8d,0xc)]=0x4;_0x537cdb[_0x283c('28e','\x47\x6b\x41\x4c')][_0x283c('28f','\x54\x57\x35\x75')](_0x1fde8d,_0x1e5b9c);}else{len+=0x5;}}else if(_0x339258['\x44\x62\x67\x6d\x51'](_0xd08d93,_0x339258[_0x283c('290','\x70\x41\x28\x67')])){if(_0x339258[_0x283c('291','\x54\x57\x35\x75')](_0x1e5b9c,_0x339258[_0x283c('292','\x32\x35\x4a\x45')](_0x1e5b9c,0x0))){_0x537cdb[_0x283c('293','\x6a\x52\x4f\x63')][_0x339258[_0x283c('294','\x47\x6b\x41\x4c')](_0x1fde8d,0xc)]=0x2;_0x537cdb['\x48\x45\x41\x50\x33\x32'][_0x339258['\x42\x64\x6c\x4a\x6b'](_0x1fde8d,0x4)]=_0x1e5b9c;}else{_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258[_0x283c('295','\x46\x73\x2a\x21')](_0x1fde8d,0xc)]=0x3;_0x537cdb['\x48\x45\x41\x50\x46\x36\x34'][_0x339258[_0x283c('296','\x24\x72\x69\x70')](_0x1fde8d,0x8)]=_0x1e5b9c;}}else if(_0x339258[_0x283c('297','\x58\x4b\x4f\x4e')](_0x1e5b9c,null)){_0x537cdb[_0x283c('223','\x75\x47\x53\x40')][_0x339258[_0x283c('294','\x47\x6b\x41\x4c')](_0x1fde8d,0xc)]=0x1;}else if(_0x339258['\x7a\x42\x47\x65\x41'](_0x1e5b9c,undefined)){if(_0x339258[_0x283c('298','\x24\x72\x69\x70')](_0x339258['\x4e\x78\x59\x64\x5a'],_0x339258[_0x283c('299','\x46\x73\x2a\x21')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x537cdb[_0x283c('1ff','\x70\x41\x28\x67')][_0x339258[_0x283c('29a','\x4f\x32\x78\x50')](_0x1fde8d,0xc)]=0x0;}}else if(_0x339258['\x7a\x42\x47\x65\x41'](_0x1e5b9c,![])){if(_0x339258[_0x283c('29b','\x4b\x7a\x7a\x71')](_0x339258[_0x283c('29c','\x39\x29\x5e\x59')],_0x339258['\x4f\x7a\x4c\x5a\x79'])){_0x537cdb[_0x283c('29d','\x42\x58\x76\x31')][_0x339258['\x51\x76\x48\x4c\x62'](_0x1fde8d,0xc)]=0x5;}else{pointer=_0x537cdb[_0x283c('29e','\x58\x4b\x4f\x4e')][_0x283c('29f','\x29\x21\x72\x39')](length);_0x537cdb[_0x283c('2a0','\x56\x34\x37\x55')]['\x73\x65\x74'](buffer,pointer);}}else if(_0x339258[_0x283c('2a1','\x2a\x44\x29\x21')](_0x1e5b9c,!![])){_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258[_0x283c('2a2','\x6a\x52\x4f\x63')](_0x1fde8d,0xc)]=0x6;}else if(_0x339258[_0x283c('2a3','\x4b\x45\x34\x57')](_0xd08d93,_0x339258[_0x283c('2a4','\x46\x73\x2a\x21')])){var _0x119cf1=_0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('2a5','\x4b\x6b\x45\x69')](_0x1e5b9c);_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258[_0x283c('2a6','\x46\x72\x31\x55')](_0x1fde8d,0xc)]=0xf;_0x537cdb[_0x283c('2a7','\x6b\x69\x6a\x58')][_0x339258['\x46\x6e\x46\x52\x74'](_0x1fde8d,0x4)]=_0x119cf1;}else{if(_0x339258[_0x283c('2a8','\x4c\x37\x43\x58')](_0x339258['\x59\x54\x4f\x70\x71'],_0x339258[_0x283c('2a9','\x54\x57\x35\x75')])){num_ongoing_calls+=0x1;_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2aa','\x56\x34\x37\x55')](_0x339258[_0x283c('2ab','\x2a\x44\x29\x21')],adapter_pointer,[function_pointer,args]);_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2ac','\x2a\x44\x29\x21')]=null;var _0x45ba43=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2ad','\x52\x39\x23\x38')];}else{var _0x17feca=_0x537cdb[_0x283c('2ae','\x4b\x6b\x45\x69')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x72\x75\x73\x74\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x1e5b9c);_0x537cdb[_0x283c('2af','\x58\x4b\x4f\x4e')][_0x339258[_0x283c('2b0','\x2a\x44\x29\x21')](_0x1fde8d,0xc)]=0x9;_0x537cdb[_0x283c('2b1','\x7a\x68\x42\x62')][_0x339258['\x55\x6a\x54\x76\x68'](_0x1fde8d,0x4)]=_0x17feca;}}};var _0x46b65e=_0x339258[_0x283c('2b2','\x48\x5e\x38\x66')](typeof TextDecoder,_0x339258[_0x283c('2b3','\x46\x45\x70\x42')])?new TextDecoder(_0x339258[_0x283c('2b4','\x58\x55\x53\x69')]):_0x339258['\x6e\x47\x52\x70\x6c'](typeof util,_0x339258['\x47\x44\x73\x67\x6a'])&&util&&_0x339258[_0x283c('2b5','\x48\x5e\x38\x66')](typeof util[_0x283c('2b6','\x4c\x31\x4c\x5b')],_0x339258[_0x283c('2b7','\x63\x63\x58\x50')])?new util['\x54\x65\x78\x74\x44\x65\x63\x6f\x64\x65\x72'](_0x339258[_0x283c('2b8','\x46\x72\x31\x55')]):null;if(_0x339258['\x41\x74\x56\x70\x47'](_0x46b65e,null)){if(_0x339258[_0x283c('2b9','\x6b\x69\x6a\x58')](_0x339258[_0x283c('2ba','\x39\x29\x5e\x59')],_0x339258['\x7a\x52\x6b\x63\x67'])){_0x537cdb[_0x283c('af','\x4b\x7a\x7a\x71')][_0x283c('2bb','\x4b\x7a\x7a\x71')]=function to_js_string(_0x3594fa,_0x12393b){return _0x46b65e[_0x283c('2bc','\x78\x57\x48\x52')](_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x283c('2bd','\x24\x72\x69\x70')](_0x3594fa,_0x339258['\x6e\x7a\x4f\x53\x58'](_0x3594fa,_0x12393b)));};}else{z=_0x370e53[index++];}}else{_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0xa676ff,_0x3c9881){var _0x2c5bbd=_0x339258[_0x283c('2be','\x66\x78\x5e\x29')][_0x283c('2bf','\x56\x34\x37\x55')]('\x7c'),_0x13341a=0x0;while(!![]){switch(_0x2c5bbd[_0x13341a++]){case'\x30':_0xa676ff=_0x339258[_0x283c('2c0','\x4b\x6b\x45\x69')](_0xa676ff,0x0);continue;case'\x31':while(_0x339258['\x43\x48\x54\x75\x71'](_0xa676ff,_0x515e73)){var _0x13d4da=_0x1d3df1[_0xa676ff++];if(_0x339258['\x6b\x67\x45\x58\x79'](_0x13d4da,0x80)){_0x7fd203+=String[_0x283c('2c1','\x4f\x43\x40\x56')](_0x13d4da);continue;}var _0x46a371=_0x339258['\x45\x45\x4b\x4b\x54'](_0x13d4da,_0x339258[_0x283c('2c2','\x4e\x4b\x29\x6d')](0x7f,0x2));var _0x53fdda=0x0;if(_0x339258[_0x283c('2c3','\x58\x55\x53\x69')](_0xa676ff,_0x515e73)){if(_0x339258[_0x283c('2c4','\x67\x57\x32\x5e')](_0x339258[_0x283c('2c5','\x4c\x37\x43\x58')],_0x339258[_0x283c('2c6','\x46\x45\x70\x42')])){_0x53fdda=_0x1d3df1[_0xa676ff++];}else{var _0x58ce33=_0x339258['\x49\x49\x4b\x77\x64'][_0x283c('2c7','\x78\x57\x48\x52')]('\x7c'),_0x5e6870=0x0;while(!![]){switch(_0x58ce33[_0x5e6870++]){case'\x30':this[_0x283c('2c8','\x71\x4b\x28\x4e')]=info[_0x283c('2c9','\x42\x58\x76\x31')];continue;case'\x31':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x32':this['\x75\x75\x69\x64']=_0x339258[_0x283c('2ca','\x32\x35\x4a\x45')](UUID);continue;case'\x33':this[_0x283c('2cb','\x4e\x4b\x29\x6d')]=info[_0x283c('2cc','\x57\x49\x4e\x6b')];continue;case'\x34':this[_0x283c('2cd','\x58\x46\x74\x75')]();continue;case'\x35':this[_0x283c('2ce','\x63\x63\x58\x50')]=info[_0x283c('2cf','\x75\x47\x53\x40')];continue;case'\x36':;continue;case'\x37':this[_0x283c('2d0','\x4b\x6b\x45\x69')]=0x0;continue;case'\x38':this[_0x283c('2d1','\x4b\x7a\x7a\x71')]=_0x339258[_0x283c('2d2','\x23\x7a\x79\x71')](getCookie,_0x339258['\x74\x43\x4a\x4f\x6d']);continue;case'\x39':this[_0x283c('2d3','\x29\x21\x72\x39')]=0x0;continue;case'\x31\x30':this['\x69\x6e\x66\x6f']=info;continue;case'\x31\x31':this['\x75\x61']=window&&window[_0x283c('2d4','\x67\x57\x32\x5e')]?window[_0x283c('2d5','\x48\x5e\x38\x66')]['\x75\x73\x65\x72\x41\x67\x65\x6e\x74']:'';continue;case'\x31\x32':this[_0x283c('2d6','\x46\x72\x31\x55')]=medal;continue;}break;}}}var _0x1e1563=_0x339258[_0x283c('2d7','\x4b\x7a\x7a\x71')](_0x339258[_0x283c('2d8','\x23\x7a\x79\x71')](_0x46a371,0x6),_0x339258['\x45\x45\x4b\x4b\x54'](_0x53fdda,0x3f));if(_0x339258[_0x283c('2d9','\x74\x79\x71\x67')](_0x13d4da,0xe0)){if(_0x339258[_0x283c('2da','\x4b\x45\x34\x57')](_0x339258[_0x283c('2db','\x71\x4b\x28\x4e')],_0x339258[_0x283c('2dc','\x32\x35\x46\x26')])){var _0x134580=_0x339258['\x71\x63\x5a\x50\x58'][_0x283c('2dd','\x24\x72\x69\x70')]('\x7c'),_0x2c1715=0x0;while(!![]){switch(_0x134580[_0x2c1715++]){case'\x30':var _0xbc7f30=_0x537cdb[_0x283c('1c0','\x75\x47\x53\x40')][_0x283c('2de','\x63\x63\x58\x50')];continue;case'\x31':var _0xbfdb83=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2df','\x4c\x31\x4c\x5b')];continue;case'\x32':delete id_to_refcount_map[refid];continue;case'\x33':_0xbfdb83[_0x283c('2e0','\x38\x46\x43\x5d')](_0x5f1634);continue;case'\x34':delete _0xbc7f30[refid];continue;case'\x35':var _0x5f1634=_0xbc7f30[refid];continue;}break;}}else{var _0x40a078=0x0;if(_0x339258['\x49\x75\x44\x4c\x51'](_0xa676ff,_0x515e73)){_0x40a078=_0x1d3df1[_0xa676ff++];}var _0x3f40f9=_0x339258[_0x283c('2e1','\x46\x45\x70\x42')](_0x339258[_0x283c('2e2','\x58\x55\x53\x69')](_0x339258[_0x283c('2e3','\x57\x49\x4e\x6b')](_0x53fdda,0x3f),0x6),_0x339258[_0x283c('2e4','\x67\x57\x32\x5e')](_0x40a078,0x3f));_0x1e1563=_0x339258['\x74\x74\x46\x57\x48'](_0x339258[_0x283c('2e5','\x24\x72\x69\x70')](_0x46a371,0xc),_0x3f40f9);if(_0x339258[_0x283c('2e6','\x75\x47\x53\x40')](_0x13d4da,0xf0)){var _0x4d61f7=0x0;if(_0x339258['\x6c\x65\x6f\x46\x4b'](_0xa676ff,_0x515e73)){if(_0x339258[_0x283c('2e7','\x4e\x4b\x29\x6d')](_0x339258[_0x283c('2e8','\x58\x42\x5d\x47')],_0x339258[_0x283c('2e9','\x29\x21\x72\x39')])){return _0x339258[_0x283c('2ea','\x67\x57\x32\x5e')](_0x339258[_0x283c('2eb','\x58\x55\x53\x69')](_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2ec','\x4c\x37\x43\x58')](t),Array),0x0);}else{_0x4d61f7=_0x1d3df1[_0xa676ff++];}}_0x1e1563=_0x339258[_0x283c('2ed','\x4f\x31\x4f\x42')](_0x339258[_0x283c('2ee','\x46\x45\x70\x42')](_0x339258[_0x283c('2ef','\x65\x21\x70\x49')](_0x46a371,0x7),0x12),_0x339258[_0x283c('2f0','\x76\x41\x30\x52')](_0x339258[_0x283c('2f1','\x65\x21\x70\x49')](_0x3f40f9,0x6),_0x339258[_0x283c('2f2','\x4c\x37\x43\x58')](_0x4d61f7,0x3f)));_0x7fd203+=String[_0x283c('2f3','\x58\x55\x53\x69')](_0x339258['\x6e\x7a\x4f\x53\x58'](0xd7c0,_0x339258[_0x283c('2f4','\x74\x79\x71\x67')](_0x1e1563,0xa)));_0x1e1563=_0x339258[_0x283c('2f5','\x75\x47\x53\x40')](0xdc00,_0x339258[_0x283c('2f6','\x71\x4b\x28\x4e')](_0x1e1563,0x3ff));}}}_0x7fd203+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x1e1563);continue;}continue;case'\x32':var _0x7fd203='';continue;case'\x33':var _0x515e73=_0x339258[_0x283c('2f7','\x2a\x44\x29\x21')](_0x339258['\x49\x48\x50\x52\x71'](_0xa676ff,0x0),_0x339258[_0x283c('2f8','\x29\x67\x41\x78')](_0x3c9881,0x0));continue;case'\x34':var _0x1d3df1=_0x537cdb[_0x283c('2f9','\x4b\x6b\x45\x69')];continue;case'\x35':return _0x7fd203;case'\x36':_0x3c9881=_0x339258[_0x283c('2fa','\x4b\x6b\x45\x69')](_0x3c9881,0x0);continue;}break;}};}_0x537cdb[_0x283c('241','\x25\x68\x77\x32')][_0x283c('2fb','\x6b\x61\x37\x4e')]={};_0x537cdb[_0x283c('1e9','\x4a\x7a\x46\x70')][_0x283c('2fc','\x38\x46\x43\x5d')]={};_0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')][_0x283c('2fd','\x76\x41\x30\x52')]=new WeakMap();_0x537cdb[_0x283c('1de','\x46\x73\x2a\x21')][_0x283c('2fe','\x4a\x7a\x46\x70')]=new Map();_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2ff','\x47\x6b\x41\x4c')]=0x1;_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('300','\x70\x41\x28\x67')]={};_0x537cdb[_0x283c('301','\x48\x5e\x38\x66')][_0x283c('302','\x4b\x7a\x7a\x71')]=0x1;_0x537cdb[_0x283c('303','\x6b\x43\x6a\x37')][_0x283c('304','\x66\x78\x5e\x29')]=function(_0x19e3f0){var _0xe7698={'\x77\x4f\x43\x77\x69':_0x339258[_0x283c('305','\x76\x41\x30\x52')],'\x6a\x68\x45\x46\x54':function(_0x1328f4,_0x4e4369){return _0x339258[_0x283c('306','\x25\x68\x77\x32')](_0x1328f4,_0x4e4369);},'\x55\x4e\x41\x42\x6a':function(_0x51e4f0,_0x59b240){return _0x339258[_0x283c('307','\x4f\x32\x78\x50')](_0x51e4f0,_0x59b240);},'\x76\x4d\x73\x72\x56':function(_0x540fd2,_0x571a16){return _0x339258[_0x283c('308','\x4c\x31\x4c\x5b')](_0x540fd2,_0x571a16);},'\x68\x4a\x74\x54\x49':function(_0x583e72,_0x2e1e12){return _0x339258[_0x283c('309','\x4b\x7a\x7a\x71')](_0x583e72,_0x2e1e12);},'\x77\x54\x59\x42\x4d':function(_0x193f72,_0x1714ae){return _0x339258[_0x283c('30a','\x4b\x45\x34\x57')](_0x193f72,_0x1714ae);},'\x72\x4f\x51\x49\x71':function(_0x12808c,_0x131c37){return _0x339258[_0x283c('30b','\x25\x68\x77\x32')](_0x12808c,_0x131c37);},'\x6b\x49\x61\x55\x6b':function(_0x54b8b5,_0x43f1a4){return _0x339258[_0x283c('30c','\x4f\x31\x4f\x42')](_0x54b8b5,_0x43f1a4);},'\x73\x6e\x45\x66\x63':function(_0x4561b9,_0x58cdf5){return _0x339258[_0x283c('30d','\x4f\x31\x4f\x42')](_0x4561b9,_0x58cdf5);},'\x6d\x70\x50\x52\x4a':function(_0x9fda0d,_0x5505b0){return _0x339258[_0x283c('30e','\x56\x34\x37\x55')](_0x9fda0d,_0x5505b0);},'\x58\x4e\x43\x4c\x4b':function(_0x33121c,_0xc5c8c7){return _0x339258[_0x283c('30f','\x78\x57\x48\x52')](_0x33121c,_0xc5c8c7);},'\x59\x49\x76\x44\x64':function(_0x38c82f,_0xe467b4){return _0x339258['\x5a\x46\x6c\x79\x64'](_0x38c82f,_0xe467b4);}};if(_0x339258[_0x283c('310','\x52\x39\x23\x38')](_0x339258['\x68\x79\x4e\x42\x57'],_0x339258[_0x283c('311','\x38\x46\x43\x5d')])){try{return{'\x76\x61\x6c\x75\x65':r[_0x283c('312','\x38\x46\x43\x5d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x60aae3){return{'\x65\x72\x72\x6f\x72':_0x60aae3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{if(_0x339258[_0x283c('313','\x7a\x68\x42\x62')](_0x19e3f0,undefined)||_0x339258[_0x283c('314','\x57\x49\x4e\x6b')](_0x19e3f0,null)){if(_0x339258[_0x283c('315','\x24\x72\x69\x70')](_0x339258[_0x283c('316','\x4e\x4b\x29\x6d')],_0x339258[_0x283c('317','\x4b\x38\x76\x6b')])){return 0x0;}else{var _0x40808a=_0xe7698['\x77\x4f\x43\x77\x69'][_0x283c('318','\x48\x5e\x38\x66')]('\x7c'),_0x31b205=0x0;while(!![]){switch(_0x40808a[_0x31b205++]){case'\x30':output+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0xe7698[_0x283c('319','\x32\x35\x46\x26')](0xd7c0,_0xe7698[_0x283c('31a','\x56\x34\x37\x55')](ch,0xa)));continue;case'\x31':if(_0xe7698['\x76\x4d\x73\x72\x56'](index,end)){_0x574f02=_0x370e53[index++];}continue;case'\x32':var _0x574f02=0x0;continue;case'\x33':ch=_0xe7698[_0x283c('31b','\x63\x63\x58\x50')](_0xe7698[_0x283c('31c','\x75\x47\x53\x40')](_0xe7698['\x72\x4f\x51\x49\x71'](init,0x7),0x12),_0xe7698[_0x283c('31d','\x67\x57\x32\x5e')](_0xe7698[_0x283c('31e','\x29\x67\x41\x78')](y_z,0x6),_0xe7698[_0x283c('31f','\x56\x34\x37\x55')](_0x574f02,0x3f)));continue;case'\x34':ch=_0xe7698[_0x283c('320','\x24\x72\x69\x70')](0xdc00,_0xe7698[_0x283c('321','\x4f\x31\x4f\x42')](ch,0x3ff));continue;}break;}}}var _0x3da664=_0x537cdb[_0x283c('92','\x66\x78\x5e\x29')][_0x283c('322','\x39\x29\x5e\x59')];var _0x579df3=_0x537cdb[_0x283c('22c','\x76\x41\x30\x52')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'];var _0x385b6e=_0x537cdb[_0x283c('2e','\x52\x39\x23\x38')][_0x283c('323','\x71\x4b\x28\x4e')];var _0x4d29c0=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('324','\x2a\x44\x29\x21')];var _0x4540dc=_0x385b6e[_0x283c('325','\x65\x21\x70\x49')](_0x19e3f0);if(_0x339258[_0x283c('326','\x76\x41\x30\x52')](_0x4540dc,undefined)){if(_0x339258[_0x283c('327','\x4f\x43\x40\x56')](_0x339258[_0x283c('328','\x25\x68\x77\x32')],_0x339258[_0x283c('329','\x38\x46\x43\x5d')])){_0x537cdb[_0x283c('23c','\x6b\x69\x6a\x58')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,document);}else{_0x4540dc=_0x4d29c0[_0x283c('32a','\x24\x72\x69\x70')](_0x19e3f0);}}if(_0x339258[_0x283c('32b','\x46\x45\x70\x42')](_0x4540dc,undefined)){if(_0x339258[_0x283c('32c','\x29\x67\x41\x78')](_0x339258[_0x283c('32d','\x4b\x45\x34\x57')],_0x339258[_0x283c('32e','\x65\x21\x70\x49')])){_0x4540dc=_0x537cdb[_0x283c('28e','\x47\x6b\x41\x4c')][_0x283c('32f','\x4b\x7a\x7a\x71')]++;try{if(_0x339258[_0x283c('330','\x4f\x32\x78\x50')](_0x339258['\x76\x4e\x55\x7a\x69'],_0x339258[_0x283c('331','\x63\x63\x58\x50')])){_0x385b6e[_0x283c('332','\x58\x42\x5d\x47')](_0x19e3f0,_0x4540dc);}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}catch(_0x1395d2){_0x4d29c0[_0x283c('333','\x32\x35\x46\x26')](_0x19e3f0,_0x4540dc);}}else{_0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('334','\x4f\x31\x4f\x42')](_0xe7698['\x58\x4e\x43\x4c\x4b'](pointer,_0xe7698[_0x283c('335','\x6b\x43\x6a\x37')](i,0x10)),value[i]);}}if(_0x339258['\x49\x4a\x5a\x66\x47'](_0x4540dc,_0x579df3)){_0x3da664[_0x4540dc]++;}else{if(_0x339258[_0x283c('336','\x4f\x43\x40\x56')](_0x339258[_0x283c('337','\x29\x67\x41\x78')],_0x339258[_0x283c('338','\x4b\x38\x76\x6b')])){r=_0x537cdb[_0x283c('339','\x2a\x44\x29\x21')][_0x283c('33a','\x52\x39\x23\x38')](r),_0x537cdb[_0x283c('230','\x4c\x37\x43\x58')][_0x283c('286','\x25\x68\x77\x32')](t,r['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);}else{_0x579df3[_0x4540dc]=_0x19e3f0;_0x3da664[_0x4540dc]=0x1;}}return _0x4540dc;}};_0x537cdb[_0x283c('1fd','\x29\x21\x72\x39')][_0x283c('33b','\x46\x72\x31\x55')]=function(_0xfa741f){return _0x537cdb[_0x283c('af','\x4b\x7a\x7a\x71')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'][_0xfa741f];};_0x537cdb[_0x283c('261','\x32\x35\x4a\x45')][_0x283c('33c','\x38\x46\x43\x5d')]=function(_0x1f064b){_0x537cdb[_0x283c('33d','\x23\x7a\x79\x71')][_0x283c('33e','\x6b\x61\x37\x4e')][_0x1f064b]++;};_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('33f','\x4c\x31\x4c\x5b')]=function(_0x3da608){var _0x308427=_0x537cdb[_0x283c('340','\x4f\x31\x4f\x42')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'];if(_0x339258[_0x283c('341','\x4a\x7a\x46\x70')](0x0,--_0x308427[_0x3da608])){var _0x49efb5=_0x339258[_0x283c('342','\x6a\x52\x4f\x63')][_0x283c('343','\x4c\x31\x4c\x5b')]('\x7c'),_0x2a2e8d=0x0;while(!![]){switch(_0x49efb5[_0x2a2e8d++]){case'\x30':var _0x4e0c94=_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')][_0x283c('344','\x24\x72\x69\x70')];continue;case'\x31':var _0x123923=_0x4e0c94[_0x3da608];continue;case'\x32':delete _0x4e0c94[_0x3da608];continue;case'\x33':delete _0x308427[_0x3da608];continue;case'\x34':_0x586328[_0x283c('345','\x4b\x38\x76\x6b')](_0x123923);continue;case'\x35':var _0x586328=_0x537cdb[_0x283c('b1','\x58\x46\x74\x75')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'];continue;}break;}}};_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('346','\x58\x55\x53\x69')]=function(_0x1e8c6b){var _0x362063=_0x537cdb[_0x283c('33d','\x23\x7a\x79\x71')][_0x283c('347','\x38\x46\x43\x5d')]++;_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('348','\x66\x78\x5e\x29')][_0x362063]=_0x1e8c6b;return _0x362063;};_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('349','\x71\x4b\x28\x4e')]=function(_0x22dd51){var _0x3f2469={'\x65\x47\x6d\x65\x51':function(_0x2f82eb,_0x470297){return _0x339258['\x52\x6f\x79\x7a\x58'](_0x2f82eb,_0x470297);},'\x64\x58\x66\x4a\x45':function(_0x36fa5a,_0x35d3f1){return _0x339258[_0x283c('34a','\x4f\x43\x40\x56')](_0x36fa5a,_0x35d3f1);}};if(_0x339258['\x66\x65\x46\x75\x6e'](_0x339258[_0x283c('34b','\x54\x57\x35\x75')],_0x339258[_0x283c('34c','\x47\x6b\x41\x4c')])){var _0x38531a=keys[i];var _0x125f84=_0x3f2469[_0x283c('34d','\x38\x46\x43\x5d')](key_array_pointer,_0x3f2469[_0x283c('34e','\x32\x35\x4a\x45')](i,0x8));_0x537cdb[_0x283c('2ae','\x4b\x6b\x45\x69')][_0x283c('34f','\x29\x21\x72\x39')](_0x125f84,_0x38531a);_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('350','\x4b\x38\x76\x6b')](_0x3f2469['\x65\x47\x6d\x65\x51'](value_array_pointer,_0x3f2469['\x64\x58\x66\x4a\x45'](i,0x10)),value[_0x38531a]);}else{delete _0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('351','\x46\x45\x70\x42')][_0x22dd51];}};_0x537cdb[_0x283c('1ce','\x4c\x31\x4c\x5b')][_0x283c('352','\x24\x72\x69\x70')]=function(_0x287254){return _0x537cdb[_0x283c('7f','\x7a\x68\x42\x62')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x287254];};_0x537cdb[_0x283c('353','\x58\x42\x5d\x47')]['\x61\x6c\x6c\x6f\x63']=function alloc(_0x5551d7){return _0x537cdb[_0x283c('354','\x39\x29\x5e\x59')](_0x5551d7);};_0x537cdb[_0x283c('92','\x66\x78\x5e\x29')][_0x283c('355','\x39\x29\x5e\x59')]=function(_0x39053d,_0x37dfb2,_0x63cec0){var _0x3cb4d0={'\x77\x58\x4e\x72\x6f':function(_0x44b867,_0x5aee3a){return _0x339258['\x66\x65\x46\x75\x6e'](_0x44b867,_0x5aee3a);},'\x59\x64\x42\x6e\x62':function(_0x1b66d1,_0xb881c2){return _0x339258[_0x283c('356','\x67\x57\x32\x5e')](_0x1b66d1,_0xb881c2);},'\x70\x52\x46\x4f\x4f':_0x339258[_0x283c('357','\x4f\x32\x78\x50')]};if(_0x339258['\x48\x42\x58\x6f\x61'](_0x339258[_0x283c('358','\x32\x35\x46\x26')],_0x339258[_0x283c('359','\x58\x4b\x4f\x4e')])){return _0x537cdb['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x283c('35a','\x6a\x52\x4f\x63')](_0x37dfb2)[_0x283c('35b','\x75\x47\x53\x40')](null,_0x63cec0);}else{if(_0x3cb4d0[_0x283c('35c','\x58\x46\x74\x75')](kind,0xc)||_0x3cb4d0['\x59\x64\x42\x6e\x62'](kind,0xd)){throw new ReferenceError(_0x3cb4d0[_0x283c('35d','\x24\x72\x69\x70')]);}}};_0x537cdb[_0x283c('1ab','\x4b\x45\x34\x57')][_0x283c('35e','\x70\x41\x28\x67')]=function utf8_len(_0x17a0f0){var _0x2395cd={'\x53\x67\x6d\x56\x55':_0x339258['\x4d\x46\x48\x62\x67'],'\x69\x47\x44\x56\x6a':function(_0x359de5,_0x5211a5){return _0x339258[_0x283c('35f','\x38\x46\x43\x5d')](_0x359de5,_0x5211a5);},'\x57\x58\x74\x4b\x45':function(_0x27050b,_0x3266f0){return _0x339258[_0x283c('360','\x75\x47\x53\x40')](_0x27050b,_0x3266f0);},'\x59\x61\x55\x79\x45':function(_0x5a5b3a,_0x16fd46){return _0x339258[_0x283c('361','\x65\x21\x70\x49')](_0x5a5b3a,_0x16fd46);},'\x78\x54\x4b\x43\x6a':function(_0x106ac8,_0x4bfd3d){return _0x339258[_0x283c('362','\x32\x35\x4a\x45')](_0x106ac8,_0x4bfd3d);},'\x5a\x4b\x53\x73\x78':_0x339258['\x77\x4d\x58\x71\x69'],'\x68\x67\x47\x69\x73':_0x339258['\x4e\x45\x53\x4a\x62'],'\x59\x49\x6d\x45\x58':_0x339258[_0x283c('363','\x75\x47\x53\x40')],'\x5a\x49\x49\x68\x4e':_0x339258['\x70\x44\x5a\x57\x52'],'\x67\x46\x45\x58\x70':_0x339258['\x55\x49\x44\x59\x71'],'\x6e\x49\x47\x43\x59':function(_0x56eb44){return _0x339258['\x7a\x78\x52\x71\x67'](_0x56eb44);},'\x76\x76\x72\x6a\x6d':_0x339258[_0x283c('364','\x6a\x52\x4f\x63')]};if(_0x339258[_0x283c('365','\x6a\x52\x4f\x63')](_0x339258[_0x283c('366','\x57\x49\x4e\x6b')],_0x339258[_0x283c('367','\x67\x57\x32\x5e')])){var _0x592823=0x0;for(var _0x4ee510=0x0;_0x339258['\x74\x58\x66\x43\x47'](_0x4ee510,_0x17a0f0[_0x283c('368','\x4b\x38\x76\x6b')]);++_0x4ee510){var _0x431ee8=_0x17a0f0[_0x283c('369','\x76\x41\x30\x52')](_0x4ee510);if(_0x339258['\x6a\x46\x46\x54\x65'](_0x431ee8,0xd800)&&_0x339258[_0x283c('36a','\x25\x68\x77\x32')](_0x431ee8,0xdfff)){if(_0x339258['\x79\x4c\x6e\x7a\x50'](_0x339258[_0x283c('36b','\x58\x55\x53\x69')],_0x339258[_0x283c('36c','\x4c\x31\x4c\x5b')])){_0x431ee8=_0x339258[_0x283c('36d','\x6a\x52\x4f\x63')](_0x339258['\x63\x76\x6c\x45\x65'](0x10000,_0x339258[_0x283c('36e','\x74\x79\x71\x67')](_0x339258[_0x283c('36f','\x65\x21\x70\x49')](_0x431ee8,0x3ff),0xa)),_0x339258['\x59\x48\x54\x44\x65'](_0x17a0f0[_0x283c('370','\x65\x21\x70\x49')](++_0x4ee510),0x3ff));}else{var _0x4734eb=_0x2395cd[_0x283c('371','\x46\x45\x70\x42')][_0x283c('372','\x4b\x45\x34\x57')]('\x7c'),_0x2b3296=0x0;while(!![]){switch(_0x4734eb[_0x2b3296++]){case'\x30':var _0x549313=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x2395cd[_0x283c('373','\x63\x63\x58\x50')](_0x2395cd[_0x283c('374','\x52\x39\x23\x38')](address,0x4),0x4)];continue;case'\x31':var _0x18b29f=_0x537cdb[_0x283c('1b7','\x70\x41\x28\x67')][_0x2395cd['\x69\x47\x44\x56\x6a'](address,0x4)];continue;case'\x32':var _0x183eb6=_0x537cdb['\x48\x45\x41\x50\x55\x33\x32'][_0x2395cd['\x59\x61\x55\x79\x45'](_0x2395cd[_0x283c('375','\x24\x72\x69\x70')](address,0x8),0x4)];continue;case'\x33':switch(_0x183eb6){case 0x0:return _0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x283c('376','\x4b\x7a\x7a\x71')](_0x18b29f,_0x2a634f);case 0x1:return _0x537cdb[_0x283c('377','\x2a\x44\x29\x21')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x18b29f,_0x2a634f);case 0x2:return _0x537cdb[_0x283c('378','\x58\x4b\x4f\x4e')][_0x283c('379','\x4a\x7a\x46\x70')](_0x18b29f,_0x2a634f);case 0x3:return _0x537cdb[_0x283c('37a','\x39\x29\x5e\x59')][_0x283c('37b','\x71\x4b\x28\x4e')](_0x18b29f,_0x2a634f);case 0x4:return _0x537cdb[_0x283c('37c','\x4b\x38\x76\x6b')][_0x283c('37d','\x2a\x44\x29\x21')](_0x18b29f,_0x2a634f);case 0x5:return _0x537cdb[_0x283c('37e','\x24\x72\x69\x70')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x18b29f,_0x2a634f);case 0x6:return _0x537cdb[_0x283c('37f','\x48\x5e\x38\x66')][_0x283c('380','\x76\x41\x30\x52')](_0x18b29f,_0x2a634f);case 0x7:return _0x537cdb[_0x283c('381','\x46\x73\x2a\x21')][_0x283c('382','\x25\x68\x77\x32')](_0x18b29f,_0x2a634f);}continue;case'\x34':var _0x2a634f=_0x2395cd['\x78\x54\x4b\x43\x6a'](_0x18b29f,_0x549313);continue;}break;}}}if(_0x339258[_0x283c('383','\x65\x21\x70\x49')](_0x431ee8,0x7f)){++_0x592823;}else if(_0x339258[_0x283c('384','\x46\x73\x2a\x21')](_0x431ee8,0x7ff)){_0x592823+=0x2;}else if(_0x339258[_0x283c('385','\x54\x57\x35\x75')](_0x431ee8,0xffff)){if(_0x339258['\x6c\x73\x50\x67\x57'](_0x339258[_0x283c('386','\x58\x46\x74\x75')],_0x339258[_0x283c('387','\x70\x41\x28\x67')])){_0x592823+=0x3;}else{var _0x4c45ed=_0x2395cd[_0x283c('388','\x39\x29\x5e\x59')][_0x283c('12d','\x6b\x43\x6a\x37')]('\x7c'),_0x48d19d=0x0;while(!![]){switch(_0x4c45ed[_0x48d19d++]){case'\x30':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x537cdb,_0x2395cd['\x59\x49\x6d\x45\x58'],{'\x76\x61\x6c\x75\x65':_0x537cdb[_0x283c('389','\x66\x78\x5e\x29')][_0x283c('38a','\x4b\x6b\x45\x69')][_0x283c('38b','\x4b\x6b\x45\x69')]});continue;case'\x31':Object[_0x283c('38c','\x42\x58\x76\x31')](_0x537cdb,_0x2395cd[_0x283c('38d','\x63\x63\x58\x50')],{'\x76\x61\x6c\x75\x65':_0x537cdb[_0x283c('38e','\x67\x57\x32\x5e')]['\x65\x78\x70\x6f\x72\x74\x73']['\x5f\x5f\x69\x6e\x64\x69\x72\x65\x63\x74\x5f\x66\x75\x6e\x63\x74\x69\x6f\x6e\x5f\x74\x61\x62\x6c\x65']});continue;case'\x32':_0x537cdb[_0x283c('38f','\x39\x29\x5e\x59')][_0x283c('390','\x29\x67\x41\x78')]=function(_0x2bc4a3,_0x5c8693){try{var _0x48e4a5=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('391','\x32\x35\x46\x26')](_0x537cdb['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x283c('392','\x6b\x43\x6a\x37')]['\x73\x70\x79\x64\x65\x72'](_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('393','\x58\x55\x53\x69')](_0x2bc4a3),_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')][_0x283c('394','\x63\x63\x58\x50')](_0x5c8693)));return _0x48e4a5;}catch(_0x295046){console[_0x283c('8a','\x67\x57\x32\x5e')](_0x2395cd[_0x283c('395','\x24\x72\x69\x70')],_0x295046);}};continue;case'\x33':return _0x537cdb[_0x283c('396','\x67\x57\x32\x5e')];case'\x34':Object[_0x283c('397','\x71\x4b\x28\x4e')](_0x537cdb,_0x2395cd['\x67\x46\x45\x58\x70'],{'\x76\x61\x6c\x75\x65':_0x537cdb['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x283c('398','\x52\x39\x23\x38')][_0x283c('399','\x7a\x68\x42\x62')]});continue;case'\x35':_0x2395cd[_0x283c('39a','\x4c\x37\x43\x58')](_0x17c788);continue;case'\x36':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x537cdb,_0x2395cd['\x76\x76\x72\x6a\x6d'],{'\x76\x61\x6c\x75\x65':instance});continue;}break;}}}else if(_0x339258[_0x283c('39b','\x65\x21\x70\x49')](_0x431ee8,0x1fffff)){_0x592823+=0x4;}else if(_0x339258['\x61\x57\x64\x4b\x42'](_0x431ee8,0x3ffffff)){_0x592823+=0x5;}else{if(_0x339258[_0x283c('39c','\x67\x57\x32\x5e')](_0x339258[_0x283c('39d','\x46\x45\x70\x42')],_0x339258[_0x283c('39e','\x57\x49\x4e\x6b')])){_0x592823+=0x6;}else{BiliPushUtils[_0x283c('39f','\x24\x72\x69\x70')]=function(_0x5bf446,_0x4bb109){return f[_0x283c('3a0','\x76\x41\x30\x52')](_0x5bf446,_0x4bb109);};}}}return _0x592823;}else{_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('2fc','\x38\x46\x43\x5d')][refid]++;}};_0x537cdb[_0x283c('3a1','\x32\x35\x46\x26')][_0x283c('3a2','\x58\x4b\x4f\x4e')]=function(_0xbdc94a){var _0x25971c=_0x537cdb[_0x283c('221','\x29\x67\x41\x78')]['\x61\x6c\x6c\x6f\x63'](0x10);_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3a3','\x4b\x6b\x45\x69')](_0x25971c,_0xbdc94a);return _0x25971c;};_0x537cdb[_0x283c('340','\x4f\x31\x4f\x42')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70']=function(_0x13bc5c){if(_0x339258['\x6c\x73\x50\x67\x57'](_0x339258['\x4a\x51\x68\x46\x55'],_0x339258['\x4a\x51\x68\x46\x55'])){throw new ReferenceError(_0x339258[_0x283c('3a4','\x4a\x7a\x46\x70')]);}else{var _0x339663=_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')][_0x283c('3a5','\x4f\x43\x40\x56')];_0x537cdb[_0x283c('3a6','\x4f\x32\x78\x50')][_0x283c('3a7','\x23\x7a\x79\x71')]=null;return _0x339663;}};var _0x19f264=null;var _0x5cefeb=null;var _0x23c544=null;var _0x370e53=null;var _0x1da2aa=null;var _0x451be7=null;var _0x98de49=null;var _0x286ff4=null;Object[_0x283c('3a8','\x4b\x45\x34\x57')](_0x537cdb,_0x339258[_0x283c('3a9','\x23\x7a\x79\x71')],{'\x76\x61\x6c\x75\x65':{}});function _0x17c788(){var _0x39f0b9=_0x339258[_0x283c('3aa','\x4f\x32\x78\x50')][_0x283c('3ab','\x46\x45\x70\x42')]('\x7c'),_0xb07ec5=0x0;while(!![]){switch(_0x39f0b9[_0xb07ec5++]){case'\x30':_0x537cdb[_0x283c('3ac','\x46\x45\x70\x42')]=_0x1da2aa;continue;case'\x31':_0x537cdb[_0x283c('3ad','\x46\x73\x2a\x21')]=_0x19f264;continue;case'\x32':_0x537cdb[_0x283c('3ae','\x4f\x32\x78\x50')]=_0x23c544;continue;case'\x33':_0x537cdb[_0x283c('3af','\x4f\x32\x78\x50')]=_0x5cefeb;continue;case'\x34':_0x286ff4=new Float64Array(_0x107859);continue;case'\x35':_0x537cdb[_0x283c('3b0','\x4a\x7a\x46\x70')]=_0x98de49;continue;case'\x36':_0x19f264=new Int8Array(_0x107859);continue;case'\x37':_0x537cdb[_0x283c('2af','\x58\x4b\x4f\x4e')]=_0x370e53;continue;case'\x38':var _0x107859=_0x537cdb[_0x283c('3b1','\x6b\x43\x6a\x37')][_0x283c('3b2','\x4b\x38\x76\x6b')]['\x6d\x65\x6d\x6f\x72\x79']['\x62\x75\x66\x66\x65\x72'];continue;case'\x39':_0x451be7=new Uint32Array(_0x107859);continue;case'\x31\x30':_0x98de49=new Float32Array(_0x107859);continue;case'\x31\x31':_0x23c544=new Int32Array(_0x107859);continue;case'\x31\x32':_0x1da2aa=new Uint16Array(_0x107859);continue;case'\x31\x33':_0x537cdb[_0x283c('3b3','\x29\x21\x72\x39')]=_0x286ff4;continue;case'\x31\x34':_0x537cdb[_0x283c('1b2','\x58\x46\x74\x75')]=_0x451be7;continue;case'\x31\x35':_0x370e53=new Uint8Array(_0x107859);continue;case'\x31\x36':_0x5cefeb=new Int16Array(_0x107859);continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x111487,_0x28e01e){if(_0x339258['\x44\x45\x6a\x66\x6a'](_0x339258[_0x283c('3b4','\x4b\x45\x34\x57')],_0x339258[_0x283c('3b5','\x52\x39\x23\x38')])){_0x28e01e=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x28e01e),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3b6','\x23\x7a\x79\x71')](_0x111487,_0x28e01e[_0x283c('3b7','\x24\x72\x69\x70')]);}else{var _0x3945d0=_0x537cdb[_0x283c('340','\x4f\x31\x4f\x42')][_0x283c('3a7','\x23\x7a\x79\x71')];_0x537cdb[_0x283c('137','\x56\x34\x37\x55')][_0x283c('3b8','\x46\x73\x2a\x21')]=null;return _0x3945d0;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x4148ff){_0x537cdb[_0x283c('221','\x29\x67\x41\x78')][_0x283c('3b9','\x4f\x32\x78\x50')](_0x4148ff,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x2b6edd){return _0x339258[_0x283c('3ba','\x4f\x32\x78\x50')](_0x339258[_0x283c('3bb','\x57\x49\x4e\x6b')](_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3bc','\x58\x42\x5d\x47')](_0x2b6edd),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x5f063c,_0x40d500){_0x40d500=_0x537cdb[_0x283c('3bd','\x74\x79\x71\x67')]['\x74\x6f\x5f\x6a\x73'](_0x40d500),_0x537cdb[_0x283c('2ae','\x4b\x6b\x45\x69')][_0x283c('3be','\x74\x79\x71\x67')](_0x5f063c,function(){try{return{'\x76\x61\x6c\x75\x65':_0x40d500[_0x283c('3bf','\x46\x45\x70\x42')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2a92f6){return{'\x65\x72\x72\x6f\x72':_0x2a92f6,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x295fcf,_0x2bb62f){if(_0x339258[_0x283c('28b','\x4c\x37\x43\x58')](_0x339258[_0x283c('3c0','\x39\x29\x5e\x59')],_0x339258[_0x283c('3c1','\x6b\x61\x37\x4e')])){_0x2bb62f=_0x537cdb[_0x283c('7f','\x7a\x68\x42\x62')][_0x283c('3c2','\x4b\x45\x34\x57')](_0x2bb62f),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('334','\x4f\x31\x4f\x42')](_0x295fcf,function(){try{return{'\x76\x61\x6c\x75\x65':_0x2bb62f[_0x283c('3c3','\x2a\x44\x29\x21')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x53ed69){return{'\x65\x72\x72\x6f\x72':_0x53ed69,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{ref_to_id_map_fallback[_0x283c('3c4','\x7a\x68\x42\x62')](reference,refid);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x4106ea,_0x33f6d8){if(_0x339258[_0x283c('3c5','\x24\x72\x69\x70')](_0x339258['\x69\x6f\x48\x4d\x43'],_0x339258[_0x283c('3c6','\x75\x47\x53\x40')])){return _0x4106ea[_0x283c('3c7','\x29\x21\x72\x39')];}else{_0x33f6d8=_0x537cdb[_0x283c('1eb','\x4b\x38\x76\x6b')][_0x283c('3c8','\x39\x29\x5e\x59')](_0x33f6d8),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3c9','\x4b\x7a\x7a\x71')](_0x4106ea,0x780);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x40d331,_0x4206cc){var _0x3ed867={'\x78\x5a\x51\x68\x57':function(_0x1458de,_0x5c0cb7){return _0x339258[_0x283c('3ca','\x78\x57\x48\x52')](_0x1458de,_0x5c0cb7);},'\x58\x66\x4d\x4a\x77':_0x339258['\x70\x72\x72\x44\x6b'],'\x46\x53\x44\x43\x49':function(_0x4a0813,_0x528e68){return _0x339258[_0x283c('3cb','\x46\x73\x2a\x21')](_0x4a0813,_0x528e68);},'\x55\x46\x45\x45\x7a':_0x339258['\x52\x52\x59\x6f\x6c'],'\x50\x69\x53\x4c\x75':_0x339258[_0x283c('3cc','\x4e\x4b\x29\x6d')],'\x6f\x78\x78\x4d\x6c':function(_0x49c0d8,_0x9c5a88){return _0x339258[_0x283c('3cd','\x54\x57\x35\x75')](_0x49c0d8,_0x9c5a88);},'\x6e\x6f\x6e\x4b\x49':_0x339258[_0x283c('3ce','\x78\x57\x48\x52')]};_0x4206cc=_0x537cdb[_0x283c('109','\x38\x46\x43\x5d')][_0x283c('3cf','\x4e\x4b\x29\x6d')](_0x4206cc),_0x537cdb[_0x283c('1eb','\x4b\x38\x76\x6b')][_0x283c('3d0','\x6b\x69\x6a\x58')](_0x40d331,function(){var _0x188a76={'\x44\x41\x4b\x4e\x44':function(_0x557336,_0x586878){return _0x3ed867['\x78\x5a\x51\x68\x57'](_0x557336,_0x586878);},'\x6b\x41\x56\x6b\x49':_0x3ed867['\x58\x66\x4d\x4a\x77']};try{if(_0x3ed867[_0x283c('3d1','\x52\x39\x23\x38')](_0x3ed867[_0x283c('3d2','\x58\x42\x5d\x47')],_0x3ed867['\x50\x69\x53\x4c\x75'])){_0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x1fc17b,_0x458c36){return _0x46b65e['\x64\x65\x63\x6f\x64\x65'](_0x537cdb[_0x283c('3d3','\x6b\x69\x6a\x58')][_0x283c('3d4','\x29\x67\x41\x78')](_0x1fc17b,_0x188a76[_0x283c('3d5','\x71\x4b\x28\x4e')](_0x1fc17b,_0x458c36)));};}else{return{'\x76\x61\x6c\x75\x65':_0x4206cc[_0x283c('3d6','\x6a\x52\x4f\x63')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x2ce78){if(_0x3ed867['\x6f\x78\x78\x4d\x6c'](_0x3ed867[_0x283c('3d7','\x7a\x68\x42\x62')],_0x3ed867[_0x283c('3d8','\x39\x29\x5e\x59')])){return{'\x65\x72\x72\x6f\x72':_0x2ce78,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{console[_0x283c('3d9','\x46\x72\x31\x55')](_0x188a76[_0x283c('3da','\x29\x67\x41\x78')]);return;}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x56602f,_0xe120af){if(_0x339258[_0x283c('3db','\x74\x79\x71\x67')](_0x339258['\x6f\x6c\x55\x61\x6d'],_0x339258[_0x283c('3dc','\x54\x57\x35\x75')])){_0xe120af=_0x537cdb[_0x283c('230','\x4c\x37\x43\x58')][_0x283c('3dd','\x56\x34\x37\x55')](_0xe120af),_0x537cdb[_0x283c('1eb','\x4b\x38\x76\x6b')][_0x283c('3de','\x7a\x68\x42\x62')](_0x56602f,_0xe120af[_0x283c('3df','\x65\x21\x70\x49')]);}else{return _0x537cdb[_0x283c('2a7','\x6b\x69\x6a\x58')][_0x339258['\x4b\x4c\x51\x4d\x63'](address,0x4)];}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x8ce920,_0x577308){_0x577308=_0x537cdb[_0x283c('1fd','\x29\x21\x72\x39')]['\x74\x6f\x5f\x6a\x73'](_0x577308),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('24d','\x65\x21\x70\x49')](_0x8ce920,_0x577308[_0x283c('3e0','\x66\x78\x5e\x29')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x4a162b){_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4a162b,document);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x2c88f9,_0x31e74){if(_0x339258[_0x283c('3e1','\x65\x21\x70\x49')](_0x339258['\x4e\x59\x5a\x6d\x46'],_0x339258[_0x283c('3e2','\x39\x29\x5e\x59')])){_0x31e74=_0x537cdb[_0x283c('3e3','\x65\x21\x70\x49')][_0x283c('3e4','\x63\x63\x58\x50')](_0x31e74),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3e5','\x32\x35\x46\x26')](_0x2c88f9,_0x31e74[_0x283c('3e6','\x4b\x6b\x45\x69')]);}else{pointer=_0x537cdb[_0x283c('303','\x6b\x43\x6a\x37')][_0x283c('196','\x66\x78\x5e\x29')](length);_0x537cdb[_0x283c('137','\x56\x34\x37\x55')]['\x74\x6f\x5f\x75\x74\x66\x38'](value,pointer);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x1d9384){_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3e7','\x75\x47\x53\x40')](_0x1d9384);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x6b76d2){if(_0x339258['\x54\x4c\x51\x68\x79'](_0x339258[_0x283c('3e8','\x58\x42\x5d\x47')],_0x339258[_0x283c('3e9','\x4c\x37\x43\x58')])){return _0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'][refid];}else{var _0x439120=_0x537cdb[_0x283c('194','\x63\x63\x58\x50')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x6b76d2);return _0x339258[_0x283c('3ea','\x47\x6b\x41\x4c')](_0x439120,DOMException)&&_0x339258[_0x283c('3eb','\x46\x45\x70\x42')](_0x339258['\x43\x6e\x78\x6c\x4e'],_0x439120[_0x283c('3ec','\x58\x55\x53\x69')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x4be3b5,_0x41a29a){var _0x10a62f=_0x537cdb[_0x283c('1b1','\x71\x4b\x28\x4e')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x4be3b5);_0x537cdb[_0x283c('92','\x66\x78\x5e\x29')][_0x283c('3ed','\x46\x72\x31\x55')](_0x41a29a,_0x10a62f);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x3632f5,_0x22dd00){_0x22dd00=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3ee','\x48\x5e\x38\x66')](_0x22dd00),_0x537cdb[_0x283c('16c','\x54\x57\x35\x75')][_0x283c('3ef','\x67\x57\x32\x5e')](_0x3632f5,0x438);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x49f5ea,_0x59e191){_0x59e191=_0x537cdb[_0x283c('23c','\x6b\x69\x6a\x58')][_0x283c('3f0','\x32\x35\x46\x26')](_0x59e191),_0x537cdb[_0x283c('197','\x42\x58\x76\x31')][_0x283c('3b6','\x23\x7a\x79\x71')](_0x49f5ea,function(){try{return{'\x76\x61\x6c\x75\x65':_0x59e191[_0x283c('3f1','\x70\x41\x28\x67')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x157bbc){return{'\x65\x72\x72\x6f\x72':_0x157bbc,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x242b19,_0x40945b){if(_0x339258[_0x283c('3f2','\x4c\x37\x43\x58')](_0x339258[_0x283c('3f3','\x46\x72\x31\x55')],_0x339258['\x65\x66\x42\x73\x75'])){_0x40945b=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3c2','\x4b\x45\x34\x57')](_0x40945b),_0x537cdb[_0x283c('3f4','\x67\x57\x32\x5e')][_0x283c('3f5','\x6b\x61\x37\x4e')](_0x242b19,_0x40945b['\x76\x61\x6c\x75\x65']);}else{_0x40945b=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('3f6','\x57\x49\x4e\x6b')](_0x40945b),_0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')][_0x283c('3f7','\x57\x49\x4e\x6b')](_0x242b19,_0x40945b['\x6c\x6f\x63\x61\x74\x69\x6f\x6e']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x4729ad,_0x5a321e){_0x5a321e=_0x537cdb[_0x283c('1ab','\x4b\x45\x34\x57')][_0x283c('3f8','\x76\x41\x30\x52')](_0x5a321e),_0x537cdb[_0x283c('241','\x25\x68\x77\x32')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4729ad,_0x5a321e['\x73\x75\x63\x63\x65\x73\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x45ab5f,_0x18da93){if(_0x339258['\x56\x49\x46\x5a\x6f'](_0x339258[_0x283c('3f9','\x42\x58\x76\x31')],_0x339258['\x68\x46\x79\x46\x79'])){_0x18da93=_0x537cdb[_0x283c('33d','\x23\x7a\x79\x71')][_0x283c('3f0','\x32\x35\x46\x26')](_0x18da93),_0x537cdb[_0x283c('353','\x58\x42\x5d\x47')][_0x283c('3de','\x7a\x68\x42\x62')](_0x45ab5f,_0x18da93['\x6c\x65\x6e\x67\x74\x68']);}else{_0x18da93=_0x537cdb[_0x283c('b1','\x58\x46\x74\x75')][_0x283c('3fa','\x23\x7a\x79\x71')](_0x18da93),_0x537cdb[_0x283c('22c','\x76\x41\x30\x52')][_0x283c('3fb','\x4c\x31\x4c\x5b')](_0x45ab5f,_0x18da93[_0x283c('3fc','\x58\x42\x5d\x47')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x629dea,_0x47f90a){if(_0x339258[_0x283c('3fd','\x74\x79\x71\x67')](_0x339258['\x4b\x71\x70\x65\x71'],_0x339258[_0x283c('3fe','\x58\x42\x5d\x47')])){_0x47f90a=_0x537cdb[_0x283c('1ef','\x46\x45\x70\x42')]['\x74\x6f\x5f\x6a\x73'](_0x47f90a),_0x537cdb[_0x283c('3ff','\x58\x55\x53\x69')][_0x283c('3be','\x74\x79\x71\x67')](_0x629dea,0x3db);}else{_0x47f90a=_0x537cdb[_0x283c('400','\x4e\x4b\x29\x6d')]['\x74\x6f\x5f\x6a\x73'](_0x47f90a),_0x537cdb[_0x283c('33d','\x23\x7a\x79\x71')][_0x283c('401','\x54\x57\x35\x75')](_0x629dea,0x248);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x4ea336,_0x153c4a){_0x153c4a=_0x537cdb[_0x283c('16c','\x54\x57\x35\x75')][_0x283c('402','\x58\x42\x5d\x47')](_0x153c4a),_0x537cdb[_0x283c('23c','\x6b\x69\x6a\x58')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4ea336,function(){try{return{'\x76\x61\x6c\x75\x65':_0x153c4a[_0x283c('403','\x25\x68\x77\x32')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x40a1f6){return{'\x65\x72\x72\x6f\x72':_0x40a1f6,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x5f565d,_0x2736fc){_0x2736fc=_0x537cdb[_0x283c('400','\x4e\x4b\x29\x6d')][_0x283c('404','\x58\x55\x53\x69')](_0x2736fc),_0x537cdb[_0x283c('1ef','\x46\x45\x70\x42')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5f565d,function(){var _0x105560={'\x59\x59\x44\x45\x54':function(_0x969928,_0x163f3){return _0x339258[_0x283c('405','\x6b\x61\x37\x4e')](_0x969928,_0x163f3);},'\x72\x63\x4c\x64\x67':function(_0x276614,_0x90daf3){return _0x339258[_0x283c('406','\x6b\x69\x6a\x58')](_0x276614,_0x90daf3);}};try{if(_0x339258[_0x283c('407','\x4e\x4b\x29\x6d')](_0x339258[_0x283c('408','\x54\x57\x35\x75')],_0x339258[_0x283c('409','\x52\x39\x23\x38')])){var _0x2a0766=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('40a','\x46\x45\x70\x42')](value);_0x537cdb[_0x283c('40b','\x46\x73\x2a\x21')][_0x105560[_0x283c('40c','\x58\x42\x5d\x47')](address,0xc)]=0xf;_0x537cdb['\x48\x45\x41\x50\x33\x32'][_0x105560['\x72\x63\x4c\x64\x67'](address,0x4)]=_0x2a0766;}else{return{'\x76\x61\x6c\x75\x65':_0x2736fc['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0xb1cd09){if(_0x339258[_0x283c('40d','\x38\x46\x43\x5d')](_0x339258[_0x283c('40e','\x47\x6b\x41\x4c')],_0x339258['\x6a\x6c\x58\x73\x77'])){try{return{'\x76\x61\x6c\x75\x65':_0x2736fc[_0x283c('40f','\x65\x21\x70\x49')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5b816f){return{'\x65\x72\x72\x6f\x72':_0x5b816f,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{return{'\x65\x72\x72\x6f\x72':_0xb1cd09,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x19974f){if(_0x339258[_0x283c('410','\x7a\x68\x42\x62')](_0x339258[_0x283c('411','\x4a\x7a\x46\x70')],_0x339258[_0x283c('412','\x4b\x38\x76\x6b')])){_0x19974f=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('413','\x4b\x7a\x7a\x71')](_0x19974f),_0x537cdb[_0x283c('2ae','\x4b\x6b\x45\x69')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x19974f);}else{return{'\x76\x61\x6c\x75\x65':r[_0x283c('414','\x4c\x37\x43\x58')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0x501b1c,_0x1ccd3a){if(_0x339258['\x56\x49\x46\x5a\x6f'](_0x339258[_0x283c('415','\x65\x21\x70\x49')],_0x339258[_0x283c('416','\x58\x55\x53\x69')])){_0x1ccd3a=_0x537cdb[_0x283c('303','\x6b\x43\x6a\x37')][_0x283c('417','\x4f\x43\x40\x56')](_0x1ccd3a),_0x537cdb[_0x283c('81','\x57\x49\x4e\x6b')][_0x283c('3e5','\x32\x35\x46\x26')](_0x501b1c,0x248);}else{_0x537cdb['\x48\x45\x41\x50\x55\x38'][_0x339258[_0x283c('418','\x6b\x43\x6a\x37')](address,0xc)]=0x5;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x368b72){if(_0x339258[_0x283c('419','\x65\x21\x70\x49')](_0x339258[_0x283c('41a','\x66\x78\x5e\x29')],_0x339258[_0x283c('41b','\x39\x29\x5e\x59')])){r=_0x537cdb[_0x283c('301','\x48\x5e\x38\x66')]['\x74\x6f\x5f\x6a\x73'](r),_0x537cdb[_0x283c('19f','\x70\x41\x28\x67')][_0x283c('41c','\x6a\x52\x4f\x63')](_0x368b72,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x283c('41d','\x54\x57\x35\x75')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2026d3){return{'\x65\x72\x72\x6f\x72':_0x2026d3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x537cdb[_0x283c('3ff','\x58\x55\x53\x69')][_0x283c('41e','\x32\x35\x4a\x45')]=_0x537cdb[_0x283c('1eb','\x4b\x38\x76\x6b')][_0x283c('41f','\x54\x57\x35\x75')](_0x368b72);}},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x17c788}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x2b4d54){Object[_0x283c('420','\x70\x41\x28\x67')](_0x537cdb,_0x339258['\x67\x4c\x52\x71\x59'],{'\x76\x61\x6c\x75\x65':_0x2b4d54});Object[_0x283c('421','\x46\x72\x31\x55')](_0x537cdb,_0x339258[_0x283c('422','\x75\x47\x53\x40')],{'\x76\x61\x6c\x75\x65':_0x537cdb['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x283c('423','\x56\x34\x37\x55')]});Object[_0x283c('424','\x58\x55\x53\x69')](_0x537cdb,_0x339258[_0x283c('425','\x67\x57\x32\x5e')],{'\x76\x61\x6c\x75\x65':_0x537cdb['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73']['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']});Object[_0x283c('426','\x63\x63\x58\x50')](_0x537cdb,_0x339258['\x70\x44\x5a\x57\x52'],{'\x76\x61\x6c\x75\x65':_0x537cdb[_0x283c('427','\x46\x73\x2a\x21')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x283c('428','\x4f\x31\x4f\x42')]});_0x537cdb[_0x283c('429','\x6b\x61\x37\x4e')]['\x73\x70\x79\x64\x65\x72']=function(_0x15b6a2,_0x26878b){try{if(_0x339258['\x6f\x46\x6f\x64\x42'](_0x339258[_0x283c('42a','\x52\x39\x23\x38')],_0x339258[_0x283c('42b','\x4c\x31\x4c\x5b')])){var _0x2dc7e8=_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('42c','\x58\x46\x74\x75')](_0x537cdb[_0x283c('42d','\x74\x79\x71\x67')][_0x283c('42e','\x32\x35\x46\x26')][_0x283c('42f','\x71\x4b\x28\x4e')](_0x537cdb[_0x283c('301','\x48\x5e\x38\x66')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x15b6a2),_0x537cdb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x283c('430','\x32\x35\x46\x26')](_0x26878b)));return _0x2dc7e8;}else{++len;}}catch(_0x330dd8){console['\x6c\x6f\x67'](_0x339258[_0x283c('431','\x46\x45\x70\x42')],_0x330dd8);}};_0x339258[_0x283c('432','\x7a\x68\x42\x62')](_0x17c788);return _0x537cdb[_0x283c('433','\x58\x42\x5d\x47')];}};}};;_0xodL='jsjiami.com.v6';

        const Run = async () => {
            //await TokenLoad();
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
