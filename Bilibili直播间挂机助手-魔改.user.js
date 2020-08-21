// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.6.1
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
    const VERSION = '2.4.6.1';
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
                    if (config.DD_BP_CONFIG.BP_KEY === undefined) config.DD_BP_CONFIG.BP_KEY = Essential.Config.DD_BP_CONFIG.BP_KEY;
                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL === undefined) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = Essential.Config.AUTO_GIFT_CONFIG.GIFT_INTERVAL;
                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL < 1) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = 1;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT === undefined) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = Essential.Config.AUTO_GIFT_CONFIG.GIFT_LIMIT;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT < 0) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = 86400;
                    if (config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE === undefined) config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE = Essential.Config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
                    if (config.DD_BP === undefined) config.DD_BP = Essential.Config.DD_BP;
                    if (config.DD_BP_CONFIG.DM_STORM === undefined) config.DD_BP_CONFIG.DM_STORM = Essential.Config.DD_BP_CONFIG.DM_STORM;
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
                                            `[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.msg}\r\n尝试次数:${count}`,
                                            'success');
                                        return;
                                    }
                                    if (response.msg.indexOf("验证码") != -1) {
                                        BiliPushUtils.Storm.over(id);
                                        clearInterval(stormInterval);
                                        BiliPushUtils.stormBlack = true;
                                        window.toast(
                                            `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})失败,疑似账号不支持,${response.msg}`,'caution');
                                        return;
                                    }
                                    if (response.data && response.data.length == 0 && response.msg.indexOf(
                                        "下次要更快一点") != -1) {
                                        BiliPushUtils.Storm.over(id);
                                        window.toast(
                                            `[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似风暴黑屋,终止！\r\n尝试次数:${count}`,'error');
                                        clearInterval(stormInterval);
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
                                        `[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.data.gift_name+"x"+response.data.gift_num}\r\n${response.data.mobile_content}\r\n尝试次数:${count}`,'success');
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

        var _0xodp='jsjiami.com.v6',_0x2930=[_0xodp,'\x77\x36\x2f\x44\x74\x69\x4e\x41\x5a\x51\x3d\x3d','\x77\x71\x30\x59\x46\x63\x4f\x6d\x4b\x51\x3d\x3d','\x66\x32\x76\x43\x6f\x41\x78\x56\x46\x6d\x73\x3d','\x77\x70\x67\x71\x77\x6f\x59\x59\x61\x77\x3d\x3d','\x46\x68\x76\x44\x6b\x4d\x4b\x56\x66\x67\x3d\x3d','\x42\x38\x4b\x2b\x48\x6d\x46\x34','\x48\x57\x72\x43\x6b\x58\x6f\x34\x77\x36\x67\x44\x77\x37\x44\x43\x6d\x4d\x4b\x6d\x77\x37\x6a\x43\x70\x31\x54\x43\x70\x51\x3d\x3d','\x77\x71\x55\x55\x47\x51\x4e\x6e\x77\x37\x7a\x43\x74\x47\x35\x30\x77\x35\x49\x30\x53\x4d\x4b\x4c\x77\x37\x55\x3d','\x4a\x54\x68\x31\x4d\x38\x4f\x6c\x50\x45\x66\x44\x74\x77\x3d\x3d','\x54\x57\x37\x43\x72\x42\x64\x48','\x77\x36\x50\x44\x73\x33\x30\x34\x55\x51\x3d\x3d','\x77\x37\x50\x44\x6a\x46\x45\x57\x66\x67\x3d\x3d','\x4d\x56\x41\x70\x48\x63\x4b\x6e\x77\x36\x44\x44\x70\x77\x3d\x3d','\x77\x72\x41\x49\x77\x70\x70\x50\x77\x37\x67\x43\x57\x63\x4b\x33','\x77\x36\x73\x79\x53\x38\x4f\x70\x44\x77\x3d\x3d','\x64\x38\x4f\x39\x77\x70\x37\x43\x76\x63\x4f\x30','\x4a\x46\x49\x71\x47\x63\x4b\x4d','\x4d\x30\x63\x67\x47\x63\x4b\x57\x77\x36\x2f\x44\x68\x4d\x4b\x32\x47\x6e\x48\x43\x70\x32\x76\x44\x71\x78\x51\x3d','\x61\x44\x49\x33\x50\x6a\x49\x3d','\x42\x38\x4f\x6f\x4f\x4d\x4b\x50\x77\x72\x5a\x41\x53\x58\x55\x3d','\x52\x55\x41\x69\x77\x6f\x70\x42\x77\x6f\x41\x64','\x77\x37\x4c\x44\x6e\x53\x4e\x54\x63\x77\x3d\x3d','\x43\x73\x4f\x6a\x4c\x63\x4b\x53\x77\x72\x6c\x4c\x65\x6d\x4c\x43\x69\x73\x4f\x44\x44\x38\x4f\x51\x4b\x6c\x73\x3d','\x77\x71\x6e\x44\x74\x38\x4f\x50\x57\x77\x30\x3d','\x4d\x6c\x6a\x44\x6e\x44\x4e\x56\x48\x4d\x4f\x2b\x77\x70\x38\x3d','\x42\x7a\x31\x41\x4b\x63\x4f\x6c\x4d\x63\x4b\x46','\x44\x63\x4b\x53\x43\x6c\x4a\x34\x44\x63\x4b\x36\x77\x6f\x72\x43\x72\x56\x45\x6b\x4d\x67\x3d\x3d','\x52\x4d\x4f\x35\x77\x71\x6e\x43\x6d\x73\x4f\x5a','\x46\x53\x6e\x44\x68\x63\x4b\x39\x53\x51\x3d\x3d','\x41\x52\x76\x44\x6e\x73\x4b\x65\x51\x38\x4f\x66','\x4d\x38\x4b\x75\x44\x45\x4a\x7a\x49\x4d\x4b\x79\x77\x72\x54\x43\x74\x56\x41\x37','\x77\x71\x50\x44\x76\x4d\x4b\x73\x77\x6f\x4a\x54\x4b\x33\x44\x43\x75\x41\x3d\x3d','\x55\x30\x67\x72\x77\x6f\x46\x57\x77\x6f\x59\x3d','\x55\x45\x6f\x33\x77\x70\x56\x53\x77\x6f\x59\x4c\x4b\x63\x4f\x6d\x64\x47\x4c\x44\x74\x53\x67\x4b\x77\x37\x59\x3d','\x77\x71\x62\x44\x76\x63\x4b\x34','\x77\x71\x59\x63\x49\x44\x64\x35','\x56\x73\x4b\x4b\x4f\x73\x4f\x5a\x44\x73\x4f\x61\x77\x71\x59\x3d','\x4b\x6c\x76\x43\x73\x30\x51\x54\x77\x34\x38\x4d\x77\x35\x4c\x43\x70\x63\x4b\x66\x77\x34\x76\x43\x6c\x48\x54\x43\x6d\x51\x3d\x3d','\x77\x35\x7a\x44\x73\x56\x49\x6f\x63\x51\x3d\x3d','\x77\x37\x78\x4c\x77\x70\x62\x43\x75\x55\x4d\x6c\x52\x77\x3d\x3d','\x77\x70\x38\x32\x77\x6f\x64\x4a\x77\x37\x49\x4b\x52\x73\x4b\x33\x77\x37\x72\x43\x68\x73\x4b\x34\x41\x63\x4f\x70\x53\x45\x4c\x44\x73\x51\x44\x43\x6c\x51\x33\x43\x6b\x58\x2f\x44\x6f\x63\x4f\x6f\x77\x36\x70\x6d','\x77\x71\x59\x62\x77\x6f\x46\x4b\x77\x34\x6b\x4a\x52\x77\x3d\x3d','\x77\x35\x4c\x43\x6b\x38\x4b\x49\x77\x36\x48\x43\x72\x67\x3d\x3d','\x4d\x38\x4b\x77\x77\x71\x30\x79\x77\x71\x49\x3d','\x4c\x44\x72\x43\x6e\x63\x4f\x69\x53\x51\x3d\x3d','\x77\x35\x68\x44\x77\x35\x54\x43\x6f\x54\x66\x43\x76\x77\x3d\x3d','\x77\x35\x50\x44\x75\x6a\x33\x43\x70\x43\x38\x3d','\x77\x6f\x33\x44\x71\x38\x4b\x4c\x77\x71\x78\x6d','\x77\x34\x76\x44\x67\x73\x4b\x37\x4c\x54\x45\x3d','\x4f\x69\x37\x44\x70\x73\x4b\x71\x63\x38\x4b\x56','\x47\x73\x4f\x65\x44\x38\x4b\x72\x77\x70\x55\x3d','\x52\x73\x4f\x39\x77\x71\x41\x67\x77\x72\x45\x3d','\x56\x46\x63\x4e\x77\x6f\x39\x41','\x77\x72\x63\x4a\x4b\x52\x74\x4d\x77\x37\x44\x44\x76\x77\x3d\x3d','\x57\x6c\x2f\x43\x74\x51\x52\x74','\x44\x45\x62\x44\x67\x52\x5a\x53','\x4e\x78\x46\x38\x49\x38\x4f\x50','\x77\x36\x52\x49\x77\x35\x66\x43\x69\x52\x51\x3d','\x4b\x4d\x4b\x65\x4b\x57\x35\x52','\x41\x63\x4f\x70\x50\x63\x4b\x53\x77\x72\x38\x3d','\x77\x36\x49\x45\x65\x4d\x4b\x4c\x77\x35\x49\x3d','\x77\x72\x59\x61\x46\x63\x4f\x5a\x4c\x77\x3d\x3d','\x64\x73\x4b\x6a\x4a\x63\x4f\x54\x47\x67\x3d\x3d','\x77\x35\x70\x34\x77\x71\x50\x43\x67\x6c\x63\x3d','\x77\x72\x45\x52\x77\x35\x76\x43\x67\x4d\x4f\x69','\x77\x36\x44\x43\x74\x63\x4b\x32\x77\x34\x54\x43\x6b\x67\x3d\x3d','\x77\x35\x55\x71\x64\x38\x4b\x38\x77\x36\x30\x3d','\x65\x63\x4f\x54\x77\x70\x50\x43\x76\x63\x4f\x55','\x46\x73\x4f\x53\x42\x63\x4b\x66\x77\x70\x4d\x3d','\x4c\x38\x4b\x74\x77\x70\x63\x2b','\x77\x70\x48\x43\x67\x57\x37\x44\x70\x73\x4f\x37','\x77\x71\x55\x55\x47\x52\x78\x67\x77\x34\x58\x44\x76\x30\x56\x31\x77\x34\x38\x6f\x52\x67\x3d\x3d','\x43\x73\x4f\x6a\x4b\x4d\x4b\x55\x77\x72\x4e\x4c','\x57\x4d\x4f\x78\x77\x34\x37\x44\x6c\x63\x4f\x73\x58\x58\x70\x77','\x65\x67\x34\x32\x4e\x6a\x49\x3d','\x77\x36\x54\x44\x72\x45\x49\x63\x62\x41\x3d\x3d','\x77\x71\x58\x44\x74\x6d\x62\x44\x72\x63\x4b\x6e','\x77\x70\x63\x55\x4c\x77\x78\x71','\x77\x71\x51\x72\x77\x6f\x42\x7a\x77\x35\x77\x3d','\x52\x68\x41\x54\x43\x41\x4d\x3d','\x50\x77\x42\x79\x4b\x4d\x4f\x41','\x61\x7a\x6f\x30\x48\x68\x41\x3d','\x65\x73\x4f\x42\x77\x6f\x76\x43\x76\x4d\x4f\x54','\x41\x42\x39\x30\x41\x38\x4f\x41','\x46\x69\x46\x71\x42\x4d\x4f\x6e','\x61\x52\x73\x4f\x44\x42\x34\x3d','\x4e\x4d\x4f\x42\x4f\x73\x4b\x63\x77\x72\x30\x3d','\x4c\x42\x56\x59\x4a\x4d\x4f\x47','\x61\x63\x4b\x31\x4f\x38\x4f\x52\x46\x67\x3d\x3d','\x61\x4d\x4f\x58\x77\x34\x6e\x44\x70\x73\x4f\x49','\x77\x71\x62\x43\x74\x4d\x4f\x68\x77\x36\x46\x2f','\x77\x6f\x34\x61\x77\x70\x68\x30\x77\x36\x34\x3d','\x77\x34\x76\x44\x6d\x38\x4b\x6a\x4e\x6a\x41\x3d','\x77\x36\x74\x57\x77\x6f\x48\x43\x76\x30\x49\x6c\x55\x63\x4b\x38\x50\x73\x4f\x7a\x49\x73\x4f\x37\x77\x72\x54\x44\x6d\x4d\x4b\x53\x65\x79\x6b\x4c','\x77\x72\x48\x43\x69\x32\x76\x44\x72\x73\x4f\x70\x77\x37\x51\x3d','\x77\x72\x52\x6c\x62\x63\x4b\x70\x77\x34\x67\x3d','\x4f\x4d\x4f\x49\x4c\x38\x4b\x33\x77\x70\x6b\x3d','\x77\x71\x54\x43\x6e\x38\x4f\x65\x77\x36\x39\x4d','\x63\x33\x58\x43\x70\x67\x31\x41','\x4e\x73\x4b\x62\x77\x6f\x37\x43\x6e\x42\x54\x43\x71\x47\x67\x3d','\x77\x34\x42\x2b\x77\x37\x37\x43\x6c\x67\x45\x3d','\x46\x68\x70\x6b\x47\x4d\x4f\x35','\x47\x53\x4e\x37\x47\x4d\x4f\x59','\x77\x72\x72\x43\x6e\x4d\x4f\x6f\x77\x36\x6c\x31','\x77\x71\x51\x56\x4e\x42\x4e\x30\x77\x37\x50\x44\x76\x30\x56\x69\x77\x35\x51\x5a\x55\x38\x4b\x45\x77\x36\x56\x77\x54\x38\x4b\x59\x51\x7a\x6a\x43\x68\x67\x3d\x3d','\x4a\x67\x4a\x69\x46\x73\x4f\x4f','\x77\x72\x44\x44\x6c\x30\x44\x44\x6d\x63\x4b\x50','\x64\x38\x4b\x31\x47\x4d\x4f\x6d\x4a\x51\x3d\x3d','\x77\x37\x48\x44\x69\x51\x52\x6d\x54\x41\x3d\x3d','\x56\x4d\x4b\x47\x4a\x73\x4f\x75\x48\x77\x3d\x3d','\x57\x53\x34\x77\x4d\x79\x34\x3d','\x46\x42\x6e\x44\x69\x4d\x4b\x58\x65\x63\x4f\x48\x49\x41\x3d\x3d','\x77\x36\x33\x44\x6c\x43\x63\x3d','\x77\x35\x44\x43\x6e\x63\x4b\x37\x77\x37\x37\x43\x75\x41\x3d\x3d','\x77\x71\x51\x4d\x77\x6f\x68\x4f\x77\x37\x67\x47\x5a\x4d\x4b\x67\x77\x37\x62\x43\x67\x73\x4b\x43\x46\x63\x4f\x6f\x58\x77\x3d\x3d','\x4c\x7a\x4a\x54\x4a\x4d\x4f\x4e','\x77\x35\x42\x44\x77\x35\x7a\x43\x72\x79\x33\x43\x73\x73\x4f\x53\x47\x52\x6e\x44\x67\x58\x6e\x43\x68\x38\x4b\x6c\x77\x72\x49\x3d','\x77\x36\x48\x43\x70\x63\x4b\x58\x77\x71\x49\x49\x4e\x4d\x4b\x67\x77\x70\x59\x3d','\x77\x34\x63\x63\x66\x38\x4f\x6c\x43\x4d\x4b\x62\x62\x51\x3d\x3d','\x77\x6f\x59\x71\x46\x4d\x4f\x56\x4a\x63\x4f\x54\x77\x36\x54\x43\x73\x38\x4b\x53\x43\x6d\x55\x49','\x4b\x31\x58\x43\x67\x6b\x73\x62','\x77\x70\x67\x6f\x77\x37\x48\x43\x67\x63\x4f\x47\x49\x38\x4b\x6c','\x77\x71\x49\x50\x77\x37\x62\x43\x69\x38\x4f\x57\x43\x4d\x4b\x77\x49\x63\x4f\x2b\x77\x36\x6b\x3d','\x77\x37\x2f\x44\x76\x6a\x4e\x2f\x5a\x53\x37\x44\x71\x79\x4e\x4f\x77\x72\x6a\x44\x6b\x56\x7a\x44\x6d\x38\x4f\x52','\x62\x6d\x66\x43\x76\x73\x4b\x72\x77\x6f\x38\x3d','\x77\x35\x31\x49\x77\x34\x6e\x43\x73\x69\x4c\x43\x75\x63\x4f\x68\x44\x67\x3d\x3d','\x77\x70\x73\x59\x77\x72\x73\x41\x53\x51\x4a\x6e','\x77\x6f\x72\x43\x74\x6a\x6f\x67\x77\x35\x76\x43\x6f\x54\x51\x3d','\x77\x36\x62\x43\x75\x55\x37\x43\x67\x54\x6e\x44\x69\x41\x3d\x3d','\x49\x4d\x4f\x31\x50\x63\x4b\x6f\x77\x71\x38\x3d','\x77\x34\x73\x69\x58\x4d\x4b\x54\x77\x34\x49\x3d','\x77\x70\x6a\x43\x72\x56\x76\x44\x69\x38\x4f\x56\x77\x72\x37\x44\x76\x44\x76\x44\x70\x63\x4f\x46\x77\x37\x51\x3d','\x77\x72\x67\x56\x4e\x51\x4a\x79\x77\x37\x54\x44\x72\x31\x51\x3d','\x77\x37\x44\x43\x73\x55\x66\x43\x69\x69\x37\x44\x6a\x73\x4f\x67','\x77\x34\x7a\x44\x6e\x63\x4b\x64\x49\x79\x66\x44\x6b\x77\x3d\x3d','\x77\x36\x2f\x44\x75\x54\x66\x43\x6e\x7a\x52\x62\x51\x73\x4b\x52\x77\x37\x6a\x44\x75\x6e\x34\x35\x77\x34\x63\x2b\x46\x67\x3d\x3d','\x43\x79\x46\x6e\x41\x63\x4f\x74\x58\x57\x62\x43\x6b\x68\x50\x44\x68\x4d\x4f\x43\x53\x4d\x4f\x6d\x57\x63\x4f\x2b','\x4e\x63\x4b\x50\x48\x33\x42\x31','\x77\x34\x51\x33\x54\x63\x4b\x77\x77\x34\x62\x43\x72\x4d\x4b\x52','\x77\x37\x48\x44\x6a\x43\x44\x43\x6a\x44\x73\x3d','\x4c\x38\x4f\x4c\x48\x4d\x4b\x4b\x77\x70\x73\x3d','\x4c\x56\x2f\x44\x6e\x54\x31\x63','\x77\x71\x51\x48\x77\x71\x50\x44\x70\x58\x6f\x3d','\x77\x35\x37\x44\x73\x68\x58\x43\x6a\x69\x51\x3d','\x4f\x53\x56\x52\x61\x69\x6a\x44\x74\x68\x50\x44\x74\x73\x4f\x38\x77\x6f\x48\x44\x72\x52\x6a\x44\x67\x4d\x4b\x59\x77\x70\x55\x47\x77\x34\x62\x43\x6b\x48\x58\x43\x69\x38\x4f\x54\x77\x34\x50\x43\x67\x38\x4b\x34\x4c\x4d\x4f\x4a\x5a\x4d\x4b\x51','\x77\x6f\x33\x43\x70\x38\x4f\x31\x77\x34\x39\x76','\x77\x72\x48\x44\x6c\x38\x4f\x4f\x65\x69\x4d\x3d','\x77\x34\x63\x57\x66\x63\x4f\x6c\x43\x41\x3d\x3d','\x54\x31\x58\x43\x74\x79\x35\x7a','\x77\x72\x63\x55\x46\x63\x4f\x5a\x49\x4d\x4f\x74\x77\x37\x33\x43\x76\x63\x4b\x4d','\x49\x46\x2f\x43\x6f\x30\x51\x61\x77\x34\x73\x6f\x77\x34\x2f\x43\x75\x41\x3d\x3d','\x77\x35\x63\x58\x61\x73\x4f\x34\x4f\x38\x4b\x49\x65\x38\x4f\x73\x77\x37\x6b\x3d','\x46\x6a\x5a\x6d\x45\x4d\x4f\x67','\x77\x71\x50\x44\x6c\x63\x4f\x48\x63\x67\x6a\x43\x67\x4d\x4f\x4c','\x41\x67\x72\x44\x6c\x63\x4b\x66\x53\x4d\x4f\x5a\x44\x42\x7a\x43\x6e\x73\x4f\x72\x77\x72\x4c\x43\x71\x6e\x77\x54','\x77\x36\x6e\x44\x74\x44\x70\x37\x56\x43\x4c\x44\x6e\x77\x3d\x3d','\x77\x70\x63\x4f\x77\x71\x30\x41','\x4a\x69\x31\x67\x4b\x63\x4f\x2f\x47\x45\x54\x44\x70\x6a\x4e\x66','\x77\x34\x6e\x43\x73\x68\x76\x44\x67\x73\x4b\x4f\x77\x72\x44\x43\x71\x68\x6a\x43\x70\x51\x3d\x3d','\x77\x34\x4e\x52\x77\x37\x44\x43\x6c\x54\x63\x3d','\x77\x6f\x6e\x43\x76\x45\x58\x44\x6e\x63\x4f\x5a\x77\x72\x2f\x44\x71\x67\x3d\x3d','\x55\x38\x4f\x77\x77\x72\x2f\x43\x68\x4d\x4f\x50','\x77\x37\x76\x43\x72\x73\x4b\x56','\x41\x41\x54\x44\x69\x4d\x4b\x58\x65\x63\x4f\x45\x4e\x77\x3d\x3d','\x56\x55\x30\x37\x77\x6f\x45\x3d','\x77\x71\x63\x4d\x77\x70\x70\x7a\x77\x37\x38\x4f\x55\x51\x3d\x3d','\x77\x34\x6e\x43\x6d\x38\x4b\x74','\x77\x37\x66\x44\x69\x4d\x4b\x46\x4e\x54\x62\x44\x70\x73\x4b\x37\x77\x34\x66\x44\x6d\x67\x3d\x3d','\x52\x56\x59\x6d\x77\x6f\x42\x42','\x62\x6a\x59\x45\x50\x51\x3d\x3d','\x4b\x69\x4a\x30\x43\x63\x4f\x4c','\x58\x43\x67\x57\x49\x42\x4d\x3d','\x77\x71\x7a\x43\x67\x38\x4f\x35\x77\x36\x68\x6b','\x59\x38\x4f\x6f\x77\x70\x54\x43\x70\x73\x4f\x73','\x77\x36\x50\x44\x6e\x31\x6f\x2f','\x77\x37\x50\x44\x76\x6a\x52\x6b\x66\x79\x6e\x44\x6e\x6a\x42\x56\x77\x70\x66\x44\x6e\x55\x44\x44\x6d\x38\x4f\x4e\x77\x36\x31\x32\x77\x6f\x45\x72','\x77\x70\x33\x44\x6c\x48\x6e\x44\x71\x63\x4b\x6c\x51\x79\x77\x6e\x4c\x77\x3d\x3d','\x77\x70\x74\x4e\x43\x56\x63\x3d','\x77\x72\x6b\x6c\x77\x72\x4c\x44\x74\x48\x48\x43\x6a\x6a\x78\x76\x77\x72\x33\x43\x75\x41\x3d\x3d','\x47\x73\x4f\x76\x4a\x73\x4b\x65\x77\x71\x52\x61\x53\x33\x33\x43\x6c\x51\x3d\x3d','\x77\x35\x49\x71\x58\x73\x4b\x74\x77\x35\x48\x43\x72\x4d\x4b\x39\x77\x70\x2f\x44\x69\x38\x4f\x44\x77\x35\x67\x3d','\x65\x46\x2f\x44\x6b\x38\x4b\x7a\x77\x35\x63\x3d','\x77\x70\x55\x31\x77\x36\x44\x43\x6e\x4d\x4f\x41\x42\x38\x4b\x6b\x50\x4d\x4f\x34\x77\x36\x6b\x54\x77\x70\x41\x3d','\x4c\x31\x2f\x44\x67\x69\x49\x3d','\x77\x35\x59\x53\x52\x38\x4f\x2b\x4d\x41\x3d\x3d','\x59\x6c\x6a\x44\x6f\x38\x4b\x58\x77\x35\x51\x3d','\x77\x35\x4a\x79\x77\x34\x4c\x43\x74\x7a\x45\x3d','\x51\x56\x50\x43\x72\x67\x64\x6d','\x48\x63\x4f\x79\x4b\x73\x4b\x4a\x77\x71\x4e\x72\x52\x47\x54\x43\x67\x4d\x4f\x42','\x49\x4d\x4b\x36\x77\x6f\x59\x3d','\x77\x34\x6f\x42\x62\x73\x4f\x34\x44\x73\x4b\x2f\x62\x4d\x4f\x74\x77\x36\x34\x61\x77\x72\x72\x44\x6c\x77\x3d\x3d','\x51\x42\x66\x43\x6b\x4d\x4b\x47\x45\x4d\x4f\x52\x59\x67\x48\x44\x6d\x63\x4f\x79\x77\x36\x66\x43\x69\x53\x59\x4c\x77\x71\x34\x3d','\x49\x4d\x4b\x62\x77\x6f\x37\x43\x6b\x69\x37\x43\x73\x57\x67\x3d','\x77\x36\x2f\x44\x71\x69\x44\x43\x69\x6a\x74\x64\x65\x4d\x4b\x76\x77\x36\x76\x44\x73\x57\x59\x35\x77\x34\x38\x6f','\x77\x6f\x37\x43\x76\x43\x38\x75\x77\x37\x62\x43\x76\x43\x4d\x3d','\x49\x63\x4b\x6f\x44\x41\x3d\x3d','\x77\x34\x4d\x36\x53\x38\x4b\x32\x77\x35\x41\x3d','\x4a\x38\x4b\x34\x46\x46\x4d\x3d','\x77\x72\x4d\x65\x4b\x42\x56\x37\x77\x37\x66\x44\x72\x55\x4e\x73','\x49\x30\x73\x72\x46\x51\x3d\x3d','\x77\x35\x7a\x44\x67\x73\x4b\x4b\x4d\x53\x66\x44\x6b\x38\x4b\x6d','\x77\x72\x6e\x44\x75\x38\x4b\x34\x77\x70\x67\x3d','\x77\x70\x7a\x43\x75\x6a\x67\x6d\x77\x34\x66\x43\x73\x69\x37\x44\x6a\x6a\x51\x3d','\x77\x72\x6a\x43\x6e\x6d\x4d\x3d','\x49\x38\x4b\x30\x4f\x38\x4b\x6d\x77\x35\x30\x3d','\x77\x35\x66\x43\x67\x73\x4b\x49\x77\x37\x33\x43\x76\x77\x3d\x3d','\x4d\x55\x2f\x44\x6e\x4d\x4b\x59\x77\x35\x41\x3d','\x4f\x6c\x48\x43\x6f\x55\x77\x52','\x50\x38\x4b\x73\x42\x51\x3d\x3d','\x65\x38\x4b\x2f\x44\x4d\x4f\x64\x45\x41\x3d\x3d','\x77\x71\x49\x6c\x77\x72\x44\x44\x74\x47\x44\x43\x71\x68\x46\x72\x77\x72\x76\x43\x70\x46\x62\x43\x72\x77\x3d\x3d','\x44\x79\x7a\x43\x74\x4d\x4f\x50\x51\x41\x3d\x3d','\x42\x67\x4c\x44\x69\x73\x4b\x66','\x77\x70\x49\x50\x77\x71\x77\x3d','\x58\x38\x4f\x47\x77\x6f\x4d\x72\x77\x70\x30\x58\x55\x41\x3d\x3d','\x77\x34\x59\x46\x65\x38\x4f\x72','\x77\x37\x56\x63\x77\x6f\x45\x3d','\x35\x6f\x6d\x58\x35\x59\x6d\x41\x36\x4b\x53\x55\x35\x59\x36\x4a\x77\x6f\x6f\x3d','\x44\x79\x42\x55\x4a\x38\x4f\x37','\x58\x73\x4b\x58\x4c\x73\x4f\x58\x45\x4d\x4f\x67\x77\x72\x51\x61\x77\x70\x49\x3d','\x66\x65\x61\x49\x68\x2b\x6d\x57\x70\x73\x4b\x2b','\x66\x65\x65\x61\x6b\x65\x57\x79\x76\x65\x57\x38\x6c\x75\x57\x39\x75\x41\x3d\x3d','\x55\x33\x44\x44\x6b\x63\x4b\x6e\x77\x35\x37\x43\x6c\x44\x48\x44\x6e\x63\x4f\x5a\x77\x37\x35\x2f','\x77\x70\x7a\x43\x71\x79\x6b\x39\x77\x34\x7a\x43\x6f\x52\x6a\x44\x6d\x6a\x6a\x44\x71\x4d\x4b\x37','\x77\x6f\x72\x43\x75\x6a\x6b\x3d','\x77\x35\x55\x6d\x55\x4d\x4b\x36\x77\x34\x66\x43\x72\x4d\x4b\x44\x77\x6f\x44\x44\x6a\x67\x3d\x3d','\x4b\x63\x4b\x30\x4e\x4d\x4b\x33\x77\x34\x48\x43\x6a\x7a\x5a\x52\x77\x71\x59\x3d','\x66\x58\x6a\x43\x75\x77\x41\x3d','\x51\x4d\x4b\x58\x4b\x63\x4f\x45\x47\x63\x4f\x61\x77\x6f\x6f\x63\x77\x70\x4a\x41','\x55\x31\x30\x6a','\x77\x6f\x6b\x2f\x77\x37\x58\x43\x6a\x38\x4f\x59','\x77\x37\x78\x42\x77\x70\x54\x43\x75\x55\x4d\x3d','\x4c\x47\x33\x44\x71\x4d\x4b\x56\x77\x34\x63\x3d','\x77\x36\x2f\x44\x6e\x54\x44\x43\x69\x54\x49\x3d','\x77\x71\x62\x43\x6c\x73\x4f\x57\x77\x37\x46\x79\x46\x4d\x4b\x31\x4f\x30\x67\x76\x77\x70\x56\x63','\x57\x38\x4f\x6a\x77\x34\x50\x44\x76\x38\x4f\x39','\x77\x72\x33\x43\x6e\x73\x4f\x57\x77\x36\x5a\x49','\x50\x53\x31\x31\x4b\x38\x4f\x34\x5a\x77\x58\x43\x76\x54\x38\x64\x56\x44\x48\x43\x6f\x44\x49\x31\x77\x6f\x6f\x63\x77\x34\x30\x7a\x48\x38\x4f\x78\x77\x37\x68\x73\x48\x48\x62\x44\x6c\x46\x72\x43\x6b\x68\x6f\x35\x77\x6f\x38\x30\x77\x34\x33\x44\x70\x4d\x4f\x4d\x77\x34\x44\x44\x75\x38\x4f\x53\x50\x73\x4b\x6b\x77\x72\x54\x43\x72\x68\x48\x44\x74\x73\x4f\x72\x61\x63\x4b\x4b\x4f\x48\x6e\x44\x76\x73\x4f\x65\x77\x36\x42\x6c\x77\x36\x70\x68\x77\x35\x44\x43\x68\x38\x4f\x66\x77\x70\x58\x43\x76\x63\x4f\x4f\x59\x6c\x34\x31\x77\x34\x67\x50\x51\x6d\x52\x33\x5a\x73\x4b\x33\x4a\x63\x4f\x68\x42\x38\x4b\x39','\x46\x45\x45\x75\x46\x63\x4b\x4e','\x41\x41\x68\x47\x49\x63\x4f\x64','\x35\x62\x4f\x77\x35\x62\x2b\x76\x35\x62\x36\x2b\x35\x71\x69\x58\x35\x5a\x2b\x70\x35\x37\x71\x51\x35\x61\x32\x38\x35\x61\x57\x36\x36\x4c\x65\x39\x37\x37\x2b\x4f\x35\x70\x57\x2f\x35\x72\x4f\x51\x35\x4c\x79\x43\x35\x35\x65\x61','\x49\x77\x46\x52\x4a\x38\x4f\x50','\x4e\x45\x2f\x44\x69\x67\x5a\x56','\x4d\x6a\x68\x69\x4c\x73\x4f\x54','\x77\x37\x66\x43\x69\x77\x67\x2f\x77\x71\x63\x3d','\x50\x55\x63\x78\x41\x73\x4b\x58','\x58\x4d\x4f\x64\x77\x6f\x73\x6d','\x77\x37\x33\x44\x6f\x6a\x7a\x43\x69\x77\x4a\x49\x56\x4d\x4b\x6a','\x57\x4d\x4f\x56\x77\x70\x38\x6c\x77\x72\x55\x4c\x52\x38\x4f\x36\x52\x41\x3d\x3d','\x46\x7a\x56\x5a\x43\x63\x4f\x54','\x4e\x42\x74\x76\x47\x73\x4f\x43','\x77\x70\x7a\x43\x70\x79\x30\x68','\x77\x6f\x30\x51\x77\x72\x49\x4c\x58\x67\x51\x3d','\x77\x71\x4e\x4f\x52\x38\x4b\x38\x77\x34\x50\x44\x71\x73\x4f\x65\x53\x67\x3d\x3d','\x66\x6b\x48\x43\x6a\x42\x42\x62','\x48\x31\x59\x4f\x4f\x4d\x4b\x4f','\x4f\x68\x2f\x44\x72\x38\x4b\x79\x55\x41\x3d\x3d','\x77\x71\x48\x43\x67\x63\x4f\x65\x77\x36\x52\x76\x4b\x67\x3d\x3d','\x77\x72\x30\x55\x49\x51\x3d\x3d','\x4c\x6e\x72\x44\x72\x73\x4b\x33\x77\x35\x41\x4c\x4c\x73\x4b\x68\x44\x4d\x4b\x64\x54\x45\x41\x3d','\x77\x70\x78\x7a\x59\x4d\x4b\x38\x77\x35\x67\x3d','\x77\x34\x6a\x43\x6c\x38\x4b\x4b\x77\x37\x50\x43\x76\x38\x4f\x34','\x77\x71\x58\x44\x76\x38\x4f\x68\x59\x67\x59\x3d','\x77\x6f\x63\x68\x77\x72\x6c\x7a\x77\x35\x38\x3d','\x77\x37\x6a\x44\x70\x63\x4b\x7a\x45\x77\x73\x3d','\x77\x34\x54\x44\x6f\x6e\x4d\x4e\x57\x6b\x2f\x44\x75\x54\x62\x43\x67\x4d\x4f\x52\x77\x35\x4d\x32\x77\x34\x67\x5a','\x77\x70\x4d\x39\x77\x71\x70\x77\x77\x35\x4d\x68\x61\x38\x4b\x43\x77\x34\x76\x43\x75\x38\x4b\x78\x4a\x73\x4f\x49\x59\x77\x3d\x3d','\x77\x35\x4a\x55\x77\x35\x58\x43\x71\x78\x7a\x43\x76\x63\x4f\x78','\x52\x38\x4f\x72\x77\x34\x73\x3d','\x49\x53\x74\x56\x42\x73\x4f\x6a','\x77\x72\x34\x74\x49\x4d\x4f\x42\x46\x67\x3d\x3d','\x77\x36\x58\x44\x6f\x56\x45\x30\x53\x51\x3d\x3d','\x77\x71\x6f\x51\x46\x77\x3d\x3d','\x49\x4d\x4b\x36\x77\x6f\x59\x48\x77\x72\x6a\x44\x6b\x53\x38\x52','\x77\x34\x77\x65\x55\x38\x4b\x2b\x77\x37\x6b\x3d','\x65\x6e\x62\x43\x71\x77\x51\x3d','\x4a\x58\x44\x44\x76\x51\x3d\x3d','\x35\x62\x2b\x76\x35\x61\x53\x46\x35\x70\x57\x38\x36\x5a\x71\x4a\x77\x37\x49\x3d','\x77\x35\x6c\x44\x77\x35\x37\x43\x70\x79\x2f\x43\x6d\x63\x4f\x6a\x42\x68\x4d\x3d','\x48\x7a\x4a\x32\x45\x41\x3d\x3d','\x77\x35\x62\x43\x6e\x63\x4b\x4c\x77\x37\x6e\x43\x6c\x4d\x4f\x35\x77\x6f\x59\x3d','\x44\x65\x65\x5a\x72\x65\x57\x7a\x72\x75\x57\x38\x73\x75\x57\x2b\x69\x41\x3d\x3d','\x77\x37\x76\x44\x71\x69\x62\x43\x6a\x67\x3d\x3d','\x77\x72\x76\x44\x72\x63\x4f\x4f\x57\x52\x6f\x3d','\x57\x51\x77\x53\x45\x43\x4d\x3d','\x77\x72\x73\x34\x77\x72\x77\x62\x59\x51\x3d\x3d','\x77\x37\x4d\x56\x77\x35\x64\x62\x77\x71\x59\x66\x42\x63\x4f\x6a\x77\x36\x58\x44\x67\x38\x4b\x62\x55\x4d\x4f\x67\x46\x78\x48\x44\x75\x56\x33\x43\x68\x6c\x58\x43\x73\x6a\x6e\x44\x76\x4d\x4b\x79\x77\x37\x6f\x32\x66\x63\x4f\x4e\x5a\x67\x3d\x3d','\x77\x70\x55\x38\x4e\x63\x4f\x31\x47\x4d\x4f\x4f\x77\x35\x7a\x43\x68\x4d\x4b\x33\x49\x67\x3d\x3d','\x77\x6f\x44\x44\x76\x63\x4b\x50\x77\x72\x64\x57','\x77\x72\x7a\x43\x76\x46\x6a\x44\x6b\x63\x4f\x4f\x77\x36\x7a\x44\x74\x51\x76\x44\x73\x4d\x4f\x4d\x77\x36\x31\x42\x43\x38\x4b\x65\x42\x4d\x4b\x35\x58\x38\x4b\x63\x77\x34\x7a\x44\x73\x4d\x4b\x35\x50\x73\x4b\x31\x46\x7a\x62\x43\x6d\x69\x6e\x44\x6c\x79\x34\x74','\x51\x4d\x4b\x54\x4a\x38\x4f\x54\x55\x63\x4f\x42\x77\x71\x63\x65\x77\x70\x42\x51\x51\x67\x3d\x3d','\x77\x35\x6e\x44\x6d\x4d\x4b\x4b\x4a\x44\x62\x44\x69\x4d\x4b\x39\x77\x34\x38\x3d','\x4e\x38\x4f\x7a\x48\x4d\x4b\x63\x77\x70\x59\x3d','\x77\x34\x4e\x72\x77\x6f\x66\x43\x6f\x6e\x63\x3d','\x77\x36\x6b\x4e\x66\x73\x4b\x64\x77\x35\x4d\x3d','\x77\x71\x6f\x31\x77\x36\x50\x43\x72\x38\x4f\x48\x4a\x4d\x4b\x7a\x50\x73\x4f\x35\x77\x36\x41\x5a','\x65\x63\x4f\x32\x77\x6f\x76\x43\x75\x38\x4f\x35\x77\x71\x6a\x44\x74\x79\x48\x43\x6e\x33\x49\x63\x77\x6f\x31\x6b\x54\x79\x70\x30\x64\x77\x58\x44\x73\x58\x6b\x3d','\x77\x34\x4c\x43\x72\x46\x58\x43\x70\x43\x2f\x44\x69\x63\x4f\x32\x65\x57\x58\x43\x70\x38\x4b\x44','\x77\x34\x73\x4b\x66\x4d\x4f\x2b\x47\x38\x4b\x42\x61\x73\x4f\x72\x77\x36\x77\x4c\x77\x71\x7a\x44\x74\x77\x33\x44\x73\x54\x30\x6e\x62\x6a\x77\x2f\x77\x37\x6f\x3d','\x55\x55\x6a\x43\x76\x73\x4b\x33','\x45\x7a\x72\x44\x72\x73\x4b\x32\x51\x41\x3d\x3d','\x77\x72\x4e\x34\x4b\x58\x44\x44\x69\x41\x3d\x3d','\x4c\x73\x4b\x78\x77\x6f\x45\x73\x77\x72\x44\x44\x6b\x53\x6f\x62','\x43\x67\x70\x61\x44\x38\x4f\x41','\x77\x37\x66\x44\x69\x4d\x4b\x76\x50\x69\x6b\x3d','\x63\x6b\x58\x43\x75\x63\x4b\x59\x77\x70\x4a\x42\x61\x4d\x4f\x32\x77\x34\x46\x39\x4b\x77\x3d\x3d','\x4d\x38\x4b\x47\x77\x6f\x7a\x43\x67\x53\x4c\x43\x72\x6e\x34\x3d','\x77\x35\x37\x44\x6e\x38\x4b\x57\x4a\x6a\x76\x44\x6f\x38\x4b\x6e\x77\x34\x66\x44\x69\x42\x49\x30','\x77\x37\x70\x63\x77\x6f\x76\x43\x70\x6c\x67\x39\x55\x51\x3d\x3d','\x77\x34\x58\x43\x6b\x69\x73\x6f','\x49\x63\x4b\x2b\x77\x70\x62\x43\x68\x43\x30\x3d','\x77\x34\x42\x47\x77\x72\x48\x43\x73\x58\x41\x3d','\x77\x34\x49\x58\x61\x73\x4b\x5a\x77\x37\x34\x3d','\x56\x38\x4f\x6a\x77\x72\x6f\x6e\x77\x70\x73\x3d','\x47\x56\x76\x43\x74\x32\x77\x4f\x77\x35\x6b\x35\x77\x34\x33\x43\x71\x4d\x4b\x44\x77\x35\x63\x3d','\x77\x70\x62\x44\x6e\x32\x54\x44\x76\x73\x4b\x73\x51\x44\x6b\x38\x4a\x54\x73\x42','\x77\x70\x5a\x42\x44\x56\x6e\x44\x6a\x44\x58\x43\x6c\x51\x3d\x3d','\x77\x71\x6b\x55\x45\x63\x4f\x56\x4b\x63\x4f\x34\x77\x35\x62\x43\x73\x38\x4b\x4d\x41\x32\x73\x30\x77\x35\x66\x44\x6c\x67\x3d\x3d','\x77\x6f\x2f\x44\x6b\x47\x58\x44\x72\x38\x4b\x6a\x57\x68\x49\x30\x4e\x69\x6f\x46\x77\x72\x76\x43\x70\x63\x4b\x72','\x4e\x56\x66\x44\x6d\x53\x35\x54\x45\x38\x4f\x70\x77\x70\x55\x37','\x77\x35\x48\x44\x6a\x4d\x4b\x53\x4c\x69\x58\x44\x67\x4d\x4b\x6d\x77\x34\x37\x44\x6e\x41\x3d\x3d','\x77\x6f\x72\x44\x67\x6e\x4c\x44\x75\x4d\x4b\x4d\x53\x53\x67\x37\x4d\x41\x3d\x3d','\x77\x34\x6e\x43\x6c\x38\x4b\x41\x77\x37\x58\x43\x70\x77\x3d\x3d','\x77\x36\x6a\x44\x6f\x7a\x64\x58\x5a\x77\x3d\x3d','\x77\x35\x67\x47\x53\x38\x4b\x63\x77\x35\x6f\x3d','\x77\x36\x7a\x44\x76\x7a\x50\x43\x6e\x53\x46\x73\x53\x63\x4b\x36\x77\x37\x7a\x44\x70\x67\x3d\x3d','\x77\x36\x4c\x44\x67\x31\x34\x2b','\x4d\x63\x4b\x6f\x77\x70\x50\x43\x69\x51\x59\x3d','\x4e\x4d\x4b\x36\x77\x6f\x4d\x3d','\x77\x70\x49\x42\x77\x72\x67\x62\x5a\x41\x4a\x39\x57\x46\x55\x3d','\x4a\x55\x30\x70\x48\x63\x4b\x6e\x77\x36\x50\x44\x73\x41\x3d\x3d','\x77\x35\x54\x43\x69\x44\x77\x70\x77\x72\x41\x3d','\x77\x37\x72\x44\x6d\x43\x50\x43\x70\x54\x30\x3d','\x46\x7a\x78\x6c','\x4c\x6d\x38\x46\x4a\x38\x4b\x55','\x77\x72\x7a\x43\x71\x79\x6b\x36\x77\x35\x76\x43\x76\x44\x50\x44\x6b\x51\x6a\x44\x74\x73\x4b\x73\x77\x70\x34\x46','\x62\x46\x72\x44\x76\x4d\x4b\x6b\x77\x35\x45\x3d','\x77\x35\x58\x44\x6b\x79\x58\x43\x6f\x67\x51\x3d','\x77\x34\x7a\x44\x6a\x53\x58\x44\x74\x73\x4f\x38\x55\x6e\x30\x70\x63\x41\x3d\x3d','\x77\x34\x38\x63\x77\x37\x34\x54\x43\x51\x6f\x6e\x53\x51\x44\x44\x74\x44\x30\x3d','\x77\x34\x72\x43\x73\x68\x2f\x44\x67\x73\x4b\x4f\x77\x72\x44\x43\x71\x42\x6a\x43\x6f\x63\x4f\x55\x77\x72\x41\x3d','\x43\x73\x4b\x39\x4b\x4d\x4b\x78\x77\x34\x6a\x43\x68\x69\x34\x44\x77\x71\x6e\x43\x70\x47\x44\x43\x74\x58\x41\x5a\x77\x72\x67\x66\x77\x70\x2f\x44\x6a\x54\x66\x43\x6e\x45\x76\x43\x6c\x4d\x4b\x38\x4b\x63\x4f\x61\x77\x71\x31\x2f\x77\x70\x6b\x6b\x55\x31\x59\x4b\x4c\x6d\x6f\x68\x5a\x63\x4f\x66','\x46\x44\x56\x7a\x50\x73\x4f\x71\x4f\x56\x50\x43\x73\x6a\x4a\x66\x46\x53\x6e\x43\x74\x43\x51\x39\x77\x34\x68\x30\x77\x34\x41\x52\x42\x38\x4b\x71\x77\x72\x70\x73\x47\x6a\x66\x44\x6d\x30\x66\x43\x6a\x52\x42\x34\x77\x34\x70\x67\x77\x70\x58\x43\x75\x63\x4b\x56\x77\x70\x44\x43\x71\x63\x4f\x45','\x77\x34\x6e\x43\x70\x38\x4b\x57\x77\x72\x4d\x49\x50\x73\x4b\x36\x77\x35\x50\x43\x71\x68\x4c\x44\x6f\x51\x30\x63\x77\x72\x46\x49\x77\x34\x44\x44\x6a\x63\x4b\x44\x42\x73\x4b\x7a\x56\x73\x4b\x51\x4f\x69\x72\x44\x75\x63\x4b\x47\x77\x37\x66\x43\x70\x63\x4b\x39\x77\x71\x42\x71\x64\x38\x4b\x51\x77\x71\x4c\x43\x71\x4d\x4b\x6c\x77\x36\x2f\x44\x70\x6c\x33\x43\x67\x46\x76\x44\x75\x7a\x6e\x44\x75\x68\x70\x2f\x77\x71\x54\x43\x6e\x32\x59\x3d','\x48\x6a\x76\x43\x6a\x38\x4f\x39\x54\x67\x4e\x69\x58\x45\x34\x31\x4e\x47\x64\x74\x77\x72\x48\x43\x71\x63\x4f\x4e\x77\x37\x73\x70\x4c\x38\x4b\x5a\x77\x34\x74\x73\x54\x47\x6b\x6f\x4c\x51\x48\x43\x6d\x38\x4f\x79\x77\x35\x50\x43\x69\x52\x58\x43\x70\x30\x62\x43\x70\x68\x48\x43\x74\x6d\x70\x49\x4b\x47\x59\x34\x5a\x63\x4b\x77\x77\x71\x54\x43\x6c\x44\x30\x62\x4c\x67\x55\x3d','\x77\x71\x66\x43\x74\x51\x62\x43\x6d\x57\x6e\x44\x68\x73\x4b\x6e\x61\x44\x54\x43\x74\x38\x4f\x4b','\x77\x6f\x76\x43\x6c\x6d\x2f\x44\x6a\x4d\x4f\x45','\x4b\x52\x6a\x43\x6a\x38\x4f\x72\x63\x41\x3d\x3d','\x47\x57\x76\x44\x6d\x63\x4b\x62\x77\x35\x63\x3d','\x58\x63\x4f\x63\x77\x35\x6a\x44\x6a\x4d\x4f\x32','\x5a\x63\x4f\x2f\x77\x71\x4d\x63\x77\x6f\x30\x3d','\x65\x73\x4f\x57\x77\x37\x72\x44\x6b\x63\x4f\x2f','\x77\x70\x59\x67\x4c\x38\x4f\x52\x45\x77\x3d\x3d','\x77\x72\x64\x6c\x62\x73\x4b\x67\x77\x35\x6b\x3d','\x56\x38\x4f\x68\x77\x6f\x51\x4d\x77\x6f\x30\x3d','\x4d\x73\x4b\x43\x77\x71\x6a\x43\x69\x41\x30\x3d','\x50\x63\x4b\x34\x4d\x77\x3d\x3d','\x55\x73\x4f\x4b\x77\x70\x37\x43\x75\x73\x4f\x71','\x77\x6f\x34\x61\x77\x6f\x66\x44\x73\x45\x77\x3d','\x77\x37\x2f\x44\x6e\x48\x6f\x38\x63\x51\x3d\x3d','\x56\x4d\x4b\x71\x42\x4d\x4f\x54\x4b\x51\x3d\x3d','\x77\x35\x58\x44\x6b\x54\x4e\x77\x61\x41\x3d\x3d','\x77\x35\x33\x43\x6b\x31\x48\x43\x70\x43\x34\x3d','\x77\x70\x63\x59\x50\x63\x4f\x32\x54\x73\x4b\x54\x4c\x38\x4f\x2b\x77\x72\x30\x44\x77\x37\x2f\x44\x6d\x45\x6f\x3d','\x5a\x73\x4b\x78\x54\x55\x73\x72\x4c\x73\x4f\x6b\x77\x70\x66\x44\x73\x77\x3d\x3d','\x46\x78\x39\x6e\x4a\x4d\x4f\x62','\x66\x77\x77\x69\x4d\x41\x49\x3d','\x4d\x78\x37\x43\x71\x4d\x4f\x45\x54\x67\x3d\x3d','\x77\x6f\x7a\x43\x6c\x4d\x4f\x4e\x77\x34\x64\x7a','\x4d\x63\x4b\x46\x77\x71\x6f\x31\x77\x71\x6b\x3d','\x63\x73\x4f\x62\x77\x70\x44\x43\x6e\x73\x4f\x4c','\x53\x63\x4f\x33\x77\x6f\x76\x43\x71\x38\x4f\x72','\x43\x73\x4b\x33\x4c\x33\x70\x63','\x77\x71\x68\x65\x45\x55\x4c\x44\x72\x67\x3d\x3d','\x77\x6f\x6f\x55\x4a\x42\x78\x32\x77\x37\x6e\x44\x75\x42\x46\x55\x77\x35\x49\x30\x53\x4d\x4b\x4c\x77\x37\x56\x79','\x4f\x53\x70\x53\x4c\x4d\x4f\x79\x4a\x73\x4b\x43\x4f\x73\x4f\x34\x44\x4d\x4f\x77\x77\x34\x6b\x45\x4b\x38\x4b\x5a','\x77\x36\x38\x6f\x55\x73\x4b\x4f\x77\x37\x49\x3d','\x4f\x73\x4b\x36\x4d\x56\x6c\x5a','\x4d\x46\x45\x43\x4f\x38\x4b\x35','\x77\x35\x44\x44\x76\x7a\x76\x43\x71\x51\x51\x3d','\x48\x4d\x4b\x77\x77\x70\x41\x79\x77\x72\x54\x44\x6e\x44\x31\x65\x53\x77\x7a\x44\x6e\x38\x4f\x41\x77\x70\x66\x43\x75\x63\x4b\x65','\x77\x37\x6a\x43\x6d\x73\x4b\x72\x77\x72\x63\x49','\x77\x37\x64\x33\x77\x70\x2f\x43\x72\x30\x55\x3d','\x77\x70\x67\x66\x4d\x63\x4f\x33\x4e\x67\x3d\x3d','\x77\x6f\x42\x61\x77\x6f\x6e\x43\x75\x6e\x54\x43\x71\x38\x4b\x79\x46\x30\x50\x44\x6a\x53\x72\x43\x69\x63\x4f\x67\x77\x72\x64\x42','\x77\x71\x7a\x44\x68\x63\x4f\x42\x63\x43\x38\x3d','\x46\x43\x4a\x47\x50\x73\x4f\x35','\x45\x47\x6e\x43\x68\x73\x4b\x70\x77\x6f\x6e\x43\x6e\x46\x2f\x44\x6b\x38\x4b\x66','\x77\x71\x51\x71\x77\x71\x63\x6b\x55\x67\x3d\x3d','\x61\x38\x4b\x2b\x45\x4d\x4f\x51\x50\x51\x3d\x3d','\x51\x30\x6f\x4b\x77\x6f\x39\x39','\x77\x34\x50\x44\x75\x41\x48\x43\x6e\x79\x45\x3d','\x77\x36\x2f\x43\x75\x46\x50\x43\x72\x44\x51\x3d','\x77\x34\x6a\x43\x73\x63\x4b\x4c\x77\x34\x4c\x43\x67\x51\x3d\x3d','\x77\x71\x6b\x34\x77\x35\x6a\x43\x75\x63\x4f\x4e','\x77\x34\x6e\x43\x76\x4d\x4b\x4a\x77\x37\x50\x43\x68\x51\x3d\x3d','\x77\x6f\x56\x30\x65\x4d\x4b\x6b\x77\x35\x77\x3d','\x56\x6d\x54\x44\x6d\x73\x4b\x6b\x77\x35\x67\x3d','\x77\x36\x72\x44\x72\x7a\x64\x67\x55\x77\x3d\x3d','\x77\x70\x7a\x44\x6f\x38\x4b\x52\x77\x72\x31\x47','\x42\x6c\x4d\x78\x42\x38\x4b\x74','\x4e\x38\x4b\x6d\x77\x72\x77\x75\x77\x6f\x59\x3d','\x4e\x58\x50\x44\x76\x77\x74\x77','\x4f\x31\x6f\x38\x42\x38\x4b\x79','\x77\x37\x44\x44\x6d\x38\x4b\x54\x62\x32\x54\x43\x6c\x63\x4b\x66\x77\x72\x59\x6f','\x77\x37\x76\x44\x73\x42\x7a\x43\x70\x52\x38\x3d','\x77\x36\x6a\x44\x71\x67\x2f\x43\x74\x67\x45\x3d','\x77\x37\x50\x44\x70\x77\x66\x43\x75\x7a\x67\x3d','\x4c\x57\x58\x44\x76\x42\x30\x34\x41\x43\x6a\x44\x72\x6e\x67\x56\x54\x38\x4f\x50\x77\x36\x38\x75\x52\x67\x3d\x3d','\x77\x6f\x37\x43\x71\x30\x6a\x44\x6f\x63\x4f\x61\x77\x72\x37\x44\x76\x41\x45\x3d','\x4a\x38\x4b\x4d\x77\x6f\x50\x43\x72\x69\x62\x43\x6f\x33\x66\x44\x6e\x77\x51\x31','\x58\x4d\x4f\x68\x77\x34\x37\x44\x71\x38\x4f\x71\x54\x6e\x6c\x6c\x77\x6f\x73\x3d','\x4d\x38\x4b\x54\x43\x38\x4b\x75\x77\x34\x4d\x3d','\x77\x70\x77\x54\x4f\x38\x4f\x70\x50\x77\x3d\x3d','\x49\x38\x4f\x6b\x77\x34\x6e\x43\x73\x38\x4b\x71\x77\x72\x72\x43\x74\x7a\x54\x44\x6a\x67\x3d\x3d','\x77\x71\x70\x50\x77\x35\x66\x43\x71\x67\x45\x74\x41\x4d\x4b\x79\x55\x77\x3d\x3d','\x49\x4d\x4b\x4b\x77\x70\x38\x61\x77\x72\x49\x3d','\x47\x6c\x33\x44\x6c\x63\x4b\x4a\x77\x37\x49\x3d','\x77\x37\x37\x44\x70\x43\x4c\x43\x6d\x54\x59\x3d','\x53\x63\x4f\x77\x77\x72\x66\x43\x69\x63\x4f\x71','\x54\x58\x62\x44\x69\x4d\x4b\x6e\x77\x37\x30\x3d','\x4c\x38\x4b\x62\x77\x72\x67\x42\x77\x6f\x63\x3d','\x77\x34\x4c\x43\x76\x38\x4b\x58\x77\x35\x33\x43\x71\x67\x3d\x3d','\x77\x36\x7a\x44\x6a\x54\x48\x44\x71\x32\x30\x3d','\x77\x71\x38\x4c\x77\x6f\x52\x43\x77\x37\x55\x58','\x4c\x73\x4b\x70\x4b\x73\x4b\x37\x77\x35\x76\x43\x6c\x69\x51\x3d','\x77\x71\x72\x43\x6d\x6d\x37\x44\x71\x63\x4f\x35\x77\x6f\x37\x44\x68\x6a\x54\x44\x67\x38\x4f\x68\x77\x35\x4a\x75\x4f\x4d\x4f\x37','\x5a\x4d\x4f\x33\x77\x71\x66\x43\x75\x73\x4f\x73\x77\x71\x44\x43\x75\x77\x3d\x3d','\x4a\x73\x4f\x44\x43\x73\x4b\x72\x77\x6f\x49\x57','\x4a\x4d\x4b\x59\x49\x4d\x4b\x61\x77\x36\x34\x3d','\x77\x37\x76\x44\x6b\x31\x6b\x39\x61\x32\x55\x3d','\x77\x37\x62\x43\x6f\x56\x62\x43\x6c\x78\x2f\x44\x6c\x63\x4f\x33\x63\x55\x62\x43\x76\x77\x3d\x3d','\x77\x71\x7a\x43\x6d\x6d\x62\x44\x6d\x38\x4f\x6b','\x77\x36\x58\x43\x67\x47\x54\x43\x6b\x6a\x59\x3d','\x77\x6f\x72\x44\x6f\x73\x4f\x6c\x56\x68\x45\x3d','\x42\x44\x52\x30\x46\x73\x4f\x6e','\x44\x38\x4b\x4f\x77\x6f\x41\x76\x77\x72\x59\x3d','\x59\x63\x4f\x6e\x77\x37\x72\x44\x76\x4d\x4f\x76','\x77\x72\x34\x44\x4c\x4d\x4f\x70\x48\x51\x3d\x3d','\x77\x6f\x77\x6e\x4d\x63\x4f\x44\x41\x77\x3d\x3d','\x51\x6e\x4c\x43\x76\x73\x4b\x4f\x77\x70\x67\x3d','\x77\x35\x2f\x43\x76\x38\x4b\x6a\x77\x70\x49\x54','\x77\x34\x48\x43\x72\x63\x4b\x74\x77\x72\x38\x6c','\x77\x34\x44\x43\x6d\x32\x58\x43\x6c\x68\x67\x3d','\x42\x63\x4b\x37\x77\x72\x50\x43\x67\x67\x38\x3d','\x77\x72\x2f\x43\x67\x43\x55\x72\x77\x34\x73\x3d','\x77\x72\x72\x43\x6e\x42\x67\x38\x77\x36\x30\x3d','\x77\x71\x73\x39\x77\x71\x78\x67\x77\x37\x55\x3d','\x62\x4d\x4f\x71\x77\x35\x6a\x44\x73\x63\x4f\x6b','\x77\x6f\x46\x32\x58\x73\x4b\x61\x77\x37\x59\x3d','\x77\x34\x7a\x44\x73\x68\x6e\x43\x6c\x78\x51\x3d','\x77\x71\x51\x68\x77\x72\x7a\x44\x6f\x77\x3d\x3d','\x77\x37\x37\x44\x71\x7a\x4c\x43\x6b\x53\x77\x3d','\x77\x35\x33\x43\x6d\x63\x4b\x32\x77\x71\x55\x74','\x77\x72\x4a\x71\x4b\x6c\x58\x44\x6a\x41\x3d\x3d','\x48\x68\x64\x76\x47\x38\x4f\x2f','\x4a\x4d\x4b\x2f\x4f\x38\x4b\x75\x77\x37\x6b\x3d','\x53\x32\x77\x51\x77\x71\x4a\x51','\x77\x72\x51\x2f\x4b\x78\x78\x67','\x41\x78\x52\x6a\x45\x73\x4f\x34','\x77\x6f\x6a\x43\x6e\x43\x38\x59\x77\x35\x41\x3d','\x42\x46\x58\x44\x6c\x73\x4b\x54\x77\x34\x41\x3d','\x77\x72\x6b\x77\x77\x72\x33\x44\x72\x32\x41\x3d','\x77\x70\x38\x78\x77\x70\x67\x37\x56\x41\x3d\x3d','\x43\x52\x46\x79\x41\x63\x4f\x30','\x77\x37\x62\x44\x70\x32\x51\x4f\x63\x41\x3d\x3d','\x77\x35\x39\x46\x77\x37\x44\x43\x6a\x69\x41\x3d','\x64\x6c\x72\x43\x71\x38\x4b\x56\x77\x72\x4d\x3d','\x77\x70\x52\x50\x4e\x33\x37\x44\x6e\x51\x3d\x3d','\x77\x36\x2f\x44\x70\x73\x4b\x75\x48\x53\x6b\x3d','\x65\x4d\x4f\x2b\x77\x35\x7a\x44\x75\x4d\x4f\x4d','\x77\x37\x58\x44\x67\x44\x7a\x43\x69\x68\x49\x3d','\x56\x6c\x44\x43\x74\x38\x4b\x77\x77\x70\x55\x3d','\x48\x32\x6f\x65\x47\x4d\x4b\x57','\x77\x70\x30\x30\x45\x38\x4f\x36\x41\x41\x3d\x3d','\x62\x57\x6a\x43\x67\x38\x4b\x78\x77\x6f\x38\x3d','\x5a\x46\x54\x44\x67\x73\x4b\x66\x77\x37\x77\x3d','\x77\x72\x33\x43\x71\x7a\x49\x46\x77\x37\x45\x3d','\x77\x35\x6b\x47\x5a\x4d\x4b\x72\x77\x36\x63\x3d','\x77\x34\x62\x43\x6e\x58\x50\x43\x73\x68\x6e\x44\x75\x4d\x4f\x4d\x52\x46\x58\x43\x67\x73\x4b\x73\x77\x6f\x41\x2f\x77\x6f\x6f\x3d','\x77\x71\x7a\x44\x69\x4d\x4f\x4e\x59\x77\x3d\x3d','\x77\x37\x66\x43\x70\x73\x4b\x67\x77\x34\x50\x43\x6a\x73\x4f\x53\x77\x72\x33\x43\x67\x63\x4f\x33\x77\x37\x54\x43\x6f\x48\x6e\x43\x74\x4d\x4b\x58','\x77\x34\x4c\x44\x73\x33\x4d\x66\x55\x67\x3d\x3d','\x41\x38\x4b\x42\x4d\x6e\x35\x6f','\x77\x72\x44\x44\x72\x63\x4f\x70\x59\x68\x41\x3d','\x56\x48\x44\x43\x76\x52\x6c\x39','\x4e\x46\x4c\x44\x6c\x54\x52\x2f','\x77\x71\x76\x43\x68\x46\x7a\x44\x72\x4d\x4f\x6d','\x4b\x4d\x4b\x67\x77\x72\x6a\x43\x68\x52\x67\x3d','\x77\x6f\x50\x43\x69\x63\x4f\x45\x77\x35\x4a\x42','\x63\x58\x76\x44\x71\x73\x4b\x43\x77\x36\x77\x3d','\x77\x36\x37\x44\x71\x43\x33\x43\x74\x67\x63\x3d','\x77\x6f\x4c\x43\x67\x77\x49\x6a\x77\x36\x59\x3d','\x77\x71\x49\x35\x49\x44\x4e\x6c','\x50\x33\x63\x33\x42\x73\x4b\x70','\x77\x35\x74\x6f\x77\x35\x44\x43\x76\x41\x38\x3d','\x55\x6e\x48\x43\x6f\x63\x4b\x70\x77\x72\x4d\x3d','\x77\x70\x51\x32\x77\x34\x76\x43\x69\x38\x4f\x74','\x42\x32\x6a\x43\x72\x33\x73\x70','\x77\x71\x50\x43\x71\x44\x77\x45\x77\x35\x4d\x3d','\x77\x6f\x4d\x39\x49\x63\x4f\x38\x46\x41\x3d\x3d','\x41\x48\x4c\x44\x6e\x38\x4b\x50\x77\x34\x55\x3d','\x77\x71\x64\x4a\x45\x47\x37\x44\x70\x41\x3d\x3d','\x56\x47\x50\x43\x69\x38\x4b\x55\x77\x6f\x4d\x3d','\x61\x6e\x58\x43\x71\x73\x4b\x66\x77\x6f\x34\x3d','\x77\x71\x50\x44\x67\x38\x4f\x4b\x64\x54\x73\x3d','\x45\x42\x78\x32\x46\x63\x4f\x36','\x46\x57\x58\x44\x69\x68\x5a\x6d','\x77\x34\x6f\x5a\x57\x73\x4b\x4c\x77\x35\x45\x3d','\x77\x34\x50\x43\x6d\x38\x4b\x39\x77\x6f\x77\x72','\x46\x78\x5a\x33\x4c\x73\x4f\x70','\x47\x63\x4b\x63\x42\x32\x42\x49','\x54\x6b\x48\x43\x68\x79\x39\x49','\x4b\x73\x4b\x47\x43\x63\x4b\x48\x77\x36\x63\x3d','\x77\x37\x58\x44\x74\x67\x37\x43\x6b\x68\x41\x3d','\x63\x47\x66\x44\x67\x73\x4b\x6d\x77\x36\x4d\x3d','\x59\x38\x4b\x41\x4f\x73\x4f\x46\x4a\x41\x3d\x3d','\x42\x6e\x76\x43\x6c\x48\x30\x6f\x77\x70\x49\x3d','\x77\x36\x41\x43\x53\x73\x4b\x7a\x77\x35\x30\x3d','\x50\x54\x7a\x43\x6a\x73\x4f\x4f\x54\x41\x3d\x3d','\x77\x36\x6c\x48\x77\x6f\x33\x43\x74\x46\x51\x3d','\x56\x56\x54\x43\x73\x4d\x4b\x37\x77\x6f\x51\x3d','\x77\x35\x46\x32\x77\x71\x66\x43\x68\x67\x4a\x6a','\x4b\x48\x44\x43\x6d\x6b\x67\x56','\x44\x31\x4d\x30\x4e\x63\x4b\x78','\x77\x6f\x41\x61\x43\x4d\x4f\x35\x41\x41\x3d\x3d','\x77\x34\x64\x57\x77\x34\x50\x43\x6f\x69\x62\x43\x70\x51\x3d\x3d','\x77\x6f\x49\x46\x77\x70\x44\x44\x6c\x6c\x4c\x44\x6a\x46\x63\x3d','\x42\x41\x74\x2f\x49\x38\x4f\x2f','\x77\x36\x58\x43\x76\x56\x7a\x43\x68\x7a\x6b\x3d','\x41\x43\x54\x43\x73\x4d\x4f\x4e\x63\x77\x3d\x3d','\x53\x48\x4c\x43\x6a\x68\x6c\x44','\x77\x34\x62\x44\x6e\x58\x59\x69\x56\x67\x3d\x3d','\x62\x58\x62\x43\x6b\x41\x74\x35','\x47\x4d\x4b\x46\x48\x73\x4b\x44\x77\x36\x7a\x43\x6f\x41\x68\x7a\x77\x70\x2f\x43\x6e\x31\x6e\x43\x68\x46\x51\x35','\x48\x32\x63\x48\x49\x4d\x4b\x74\x77\x72\x6e\x43\x70\x67\x3d\x3d','\x77\x71\x67\x36\x4c\x68\x31\x59','\x42\x6e\x76\x43\x6c\x48\x30\x6f\x77\x70\x6c\x75','\x77\x35\x33\x43\x73\x38\x4b\x4d\x77\x37\x2f\x43\x67\x41\x3d\x3d','\x55\x73\x4b\x5a\x49\x4d\x4f\x73\x4a\x41\x3d\x3d','\x4b\x41\x64\x47\x4a\x73\x4f\x4a\x62\x56\x7a\x43\x6e\x53\x44\x44\x6f\x38\x4f\x74\x56\x73\x4f\x54\x62\x67\x3d\x3d','\x55\x45\x77\x35\x77\x6f\x64\x57','\x41\x68\x2f\x44\x6a\x4d\x4b\x59\x51\x77\x3d\x3d','\x77\x71\x51\x6c\x77\x70\x38\x2f\x63\x67\x3d\x3d','\x77\x6f\x6b\x4d\x48\x77\x52\x47','\x44\x53\x35\x59\x4b\x63\x4f\x65','\x4b\x45\x62\x44\x67\x79\x35\x41','\x41\x56\x72\x44\x6d\x38\x4b\x71\x77\x36\x42\x63\x66\x51\x3d\x3d','\x4c\x43\x39\x61\x4c\x63\x4f\x68','\x48\x67\x6e\x44\x70\x63\x4b\x4e\x54\x77\x3d\x3d','\x77\x36\x76\x44\x67\x6a\x74\x78\x62\x77\x3d\x3d','\x77\x72\x7a\x43\x6d\x67\x34\x59\x77\x36\x7a\x43\x6c\x78\x6a\x44\x75\x42\x2f\x44\x6a\x63\x4b\x49\x77\x72\x41\x6a\x77\x72\x6f\x3d','\x77\x70\x58\x44\x68\x73\x4f\x71\x59\x52\x6f\x3d','\x77\x36\x77\x49\x62\x63\x4f\x39\x43\x77\x3d\x3d','\x77\x35\x48\x44\x6d\x63\x4b\x71\x45\x52\x49\x3d','\x77\x70\x48\x44\x68\x56\x6e\x44\x6e\x4d\x4b\x64','\x77\x70\x30\x73\x77\x72\x33\x44\x70\x56\x38\x3d','\x66\x4d\x4f\x67\x77\x71\x67\x66\x77\x72\x30\x6d\x66\x4d\x4f\x50\x65\x73\x4f\x79\x77\x34\x6f\x4d\x77\x6f\x56\x77','\x77\x71\x50\x44\x6c\x63\x4f\x48\x66\x54\x59\x3d','\x4b\x67\x42\x78\x46\x73\x4f\x43\x64\x73\x4f\x45','\x77\x36\x42\x79\x77\x6f\x37\x43\x76\x58\x6f\x3d','\x44\x46\x72\x44\x67\x79\x52\x2f','\x77\x6f\x54\x44\x68\x73\x4f\x75\x59\x79\x41\x3d','\x77\x36\x4d\x4d\x57\x4d\x4f\x41\x4b\x77\x3d\x3d','\x49\x79\x31\x6e\x44\x4d\x4f\x47','\x53\x33\x50\x44\x6d\x4d\x4b\x6b\x77\x34\x49\x3d','\x77\x35\x33\x43\x6a\x48\x62\x43\x74\x51\x6e\x43\x67\x67\x3d\x3d','\x77\x6f\x7a\x44\x69\x38\x4f\x41\x5a\x43\x59\x3d','\x77\x35\x66\x44\x6a\x68\x50\x43\x76\x32\x59\x62','\x42\x63\x4b\x39\x4f\x4d\x4b\x6a\x77\x35\x67\x3d','\x77\x36\x6a\x43\x75\x4d\x4b\x72\x77\x37\x50\x43\x68\x41\x3d\x3d','\x49\x73\x4b\x34\x44\x6c\x38\x3d','\x66\x73\x4f\x62\x77\x71\x33\x43\x68\x73\x4f\x4a','\x55\x46\x2f\x43\x71\x79\x4e\x73','\x77\x72\x38\x77\x47\x63\x4f\x70\x4e\x77\x3d\x3d','\x77\x70\x63\x6d\x77\x6f\x41\x34\x55\x77\x3d\x3d','\x50\x54\x48\x43\x69\x73\x4f\x51\x58\x67\x3d\x3d','\x62\x57\x58\x43\x6d\x73\x4b\x4a\x77\x72\x51\x42\x50\x77\x3d\x3d','\x55\x73\x4f\x46\x77\x34\x54\x44\x6e\x38\x4f\x56','\x77\x72\x30\x33\x4a\x7a\x31\x68','\x77\x35\x48\x44\x76\x42\x62\x43\x6c\x67\x44\x43\x76\x6b\x6f\x3d','\x63\x32\x77\x57\x77\x72\x4a\x32\x77\x72\x59\x78\x4a\x73\x4f\x56\x55\x30\x33\x44\x71\x78\x30\x39','\x63\x63\x4f\x71\x77\x70\x33\x43\x6f\x63\x4f\x35','\x52\x4d\x4f\x50\x77\x71\x33\x43\x71\x38\x4f\x55','\x4c\x73\x4b\x71\x77\x72\x38\x58\x77\x71\x59\x3d','\x58\x4d\x4f\x45\x77\x6f\x41\x68\x77\x6f\x77\x3d','\x77\x37\x73\x50\x51\x73\x4f\x2b\x4e\x41\x3d\x3d','\x49\x73\x4b\x64\x77\x72\x30\x72\x77\x70\x49\x3d','\x55\x63\x4b\x6e\x4b\x38\x4f\x33\x4e\x67\x3d\x3d','\x42\x48\x59\x43\x4a\x38\x4b\x39\x77\x34\x6a\x44\x69\x38\x4b\x55\x4a\x30\x6a\x43\x6c\x46\x6a\x44\x69\x79\x67\x3d','\x50\x58\x44\x44\x68\x63\x4b\x51\x77\x34\x59\x77\x50\x4d\x4b\x35\x4d\x73\x4b\x64\x55\x56\x4d\x3d','\x77\x70\x48\x44\x73\x38\x4f\x6d\x52\x42\x4c\x43\x71\x38\x4f\x77\x77\x70\x70\x4f\x77\x72\x44\x43\x72\x63\x4b\x36\x46\x6d\x6b\x3d','\x65\x54\x59\x2f\x4d\x69\x63\x3d','\x4b\x30\x72\x44\x75\x38\x4b\x37\x77\x37\x38\x3d','\x45\x33\x50\x44\x72\x68\x64\x68\x51\x63\x4b\x76','\x41\x56\x55\x31\x4e\x38\x4b\x78','\x77\x6f\x72\x43\x6a\x41\x55\x38\x77\x36\x6f\x3d','\x77\x72\x6e\x43\x74\x38\x4f\x54\x77\x35\x42\x78','\x77\x72\x4a\x66\x57\x63\x4b\x39\x77\x34\x58\x44\x75\x38\x4f\x55\x65\x51\x59\x6f\x77\x71\x77\x66\x47\x47\x64\x5a\x77\x34\x37\x43\x6e\x38\x4b\x77\x64\x45\x67\x3d','\x42\x6e\x76\x43\x6c\x48\x31\x4f\x77\x70\x67\x3d','\x52\x73\x4f\x76\x77\x6f\x76\x43\x69\x4d\x4f\x52','\x43\x42\x66\x43\x69\x4d\x4f\x71\x61\x41\x3d\x3d','\x53\x56\x76\x43\x68\x51\x4e\x59','\x46\x38\x4b\x64\x77\x72\x67\x36\x77\x6f\x4d\x3d','\x57\x48\x6b\x43\x77\x70\x56\x4a','\x77\x6f\x4c\x43\x6f\x73\x4f\x37\x77\x35\x64\x33','\x66\x73\x4f\x46\x77\x71\x30\x36\x77\x6f\x67\x3d','\x77\x72\x48\x43\x69\x32\x76\x44\x72\x73\x4f\x70\x77\x37\x2f\x43\x71\x77\x3d\x3d','\x4e\x44\x4a\x44\x41\x63\x4f\x65','\x77\x37\x66\x44\x71\x4d\x4b\x6c\x46\x78\x66\x43\x6b\x73\x4f\x67','\x77\x71\x2f\x43\x75\x56\x6e\x44\x75\x63\x4f\x31','\x77\x35\x2f\x44\x73\x33\x59\x4b\x53\x6a\x37\x43\x6c\x41\x3d\x3d','\x42\x4d\x4b\x36\x44\x6e\x42\x54','\x77\x34\x51\x66\x57\x4d\x4b\x38\x77\x36\x49\x3d','\x44\x44\x66\x43\x68\x4d\x4f\x70\x66\x51\x3d\x3d','\x77\x6f\x2f\x44\x73\x63\x4f\x46\x5a\x52\x41\x3d','\x77\x35\x72\x44\x76\x63\x4b\x42\x4a\x42\x51\x3d','\x41\x6e\x54\x43\x6d\x6b\x6f\x79','\x44\x41\x42\x64\x50\x73\x4f\x35','\x57\x73\x4b\x59\x4d\x73\x4f\x38\x4a\x41\x3d\x3d','\x47\x4d\x4b\x4c\x47\x38\x4b\x74\x77\x36\x51\x3d','\x77\x37\x50\x44\x6d\x42\x33\x43\x67\x6a\x67\x3d','\x77\x70\x4d\x6e\x77\x37\x4c\x43\x6a\x4d\x4f\x32','\x77\x34\x67\x6c\x52\x63\x4b\x56\x77\x36\x77\x3d','\x77\x72\x78\x65\x48\x6d\x7a\x44\x6e\x77\x3d\x3d','\x77\x6f\x54\x44\x74\x4d\x4b\x59\x77\x6f\x4e\x48','\x48\x48\x37\x44\x70\x51\x68\x65','\x4e\x53\x50\x44\x72\x63\x4b\x31\x54\x41\x3d\x3d','\x50\x33\x58\x44\x6d\x54\x4e\x38','\x77\x71\x51\x71\x77\x70\x68\x54\x77\x35\x34\x3d','\x77\x37\x2f\x44\x72\x46\x6f\x38\x54\x51\x3d\x3d','\x77\x71\x7a\x44\x70\x56\x50\x44\x6e\x63\x4b\x49\x62\x42\x49\x46\x46\x67\x59\x79\x77\x71\x58\x43\x6d\x4d\x4b\x4b','\x77\x34\x76\x44\x67\x4d\x4b\x55','\x55\x55\x33\x43\x71\x77\x3d\x3d','\x77\x35\x49\x67\x64\x63\x4f\x70\x46\x77\x3d\x3d','\x4a\x32\x59\x38\x45\x38\x4b\x56','\x77\x34\x33\x44\x6e\x79\x56\x30\x62\x41\x3d\x3d','\x77\x70\x59\x74\x77\x70\x35\x46\x77\x37\x45\x3d','\x77\x35\x48\x44\x6d\x38\x4b\x2b\x46\x7a\x45\x3d','\x52\x4d\x4f\x53\x77\x6f\x59\x35\x77\x6f\x45\x3d','\x77\x36\x44\x43\x6b\x63\x4b\x4a\x77\x72\x41\x37','\x77\x35\x44\x44\x6e\x33\x59\x71\x57\x67\x3d\x3d','\x65\x38\x4f\x4d\x77\x36\x66\x44\x6f\x63\x4f\x63','\x48\x6e\x62\x43\x6e\x6e\x67\x2f','\x77\x70\x33\x44\x76\x4d\x4b\x59\x77\x6f\x4a\x36','\x61\x55\x58\x44\x6c\x38\x4b\x76\x77\x37\x67\x3d','\x77\x37\x6e\x43\x71\x78\x38\x44\x77\x71\x67\x3d','\x51\x57\x2f\x43\x71\x43\x52\x6b','\x77\x37\x62\x44\x76\x63\x4b\x42\x50\x51\x45\x3d','\x77\x36\x54\x43\x6e\x53\x59\x76\x77\x72\x59\x3d','\x77\x72\x33\x44\x68\x38\x4b\x76\x77\x6f\x64\x6e','\x49\x67\x78\x78\x4b\x73\x4f\x65','\x77\x72\x64\x4f\x52\x38\x4b\x34','\x4f\x7a\x5a\x75\x4b\x77\x3d\x3d','\x53\x30\x54\x43\x67\x73\x4b\x34\x77\x71\x30\x3d','\x4c\x73\x4b\x6e\x77\x72\x30\x55\x77\x6f\x4d\x3d','\x61\x6b\x45\x32\x77\x72\x4a\x70','\x41\x32\x62\x44\x76\x73\x4b\x74\x77\x36\x38\x3d','\x49\x38\x4f\x76\x48\x63\x4b\x71\x77\x70\x6f\x3d','\x77\x37\x39\x58\x77\x37\x6a\x43\x70\x43\x73\x3d','\x44\x73\x4b\x48\x77\x72\x77\x58\x77\x6f\x63\x3d','\x51\x67\x4d\x72\x4b\x51\x30\x3d','\x48\x38\x4b\x7a\x77\x71\x72\x43\x67\x42\x49\x3d','\x77\x71\x78\x34\x4f\x57\x48\x44\x75\x77\x50\x43\x75\x52\x76\x43\x69\x73\x4b\x4c\x77\x34\x6c\x45\x4b\x63\x4b\x33','\x5a\x4d\x4f\x33\x77\x71\x66\x43\x70\x63\x4f\x72','\x77\x34\x72\x44\x72\x52\x50\x43\x6b\x52\x44\x44\x6a\x79\x63\x37\x77\x34\x52\x4f\x52\x67\x4a\x55\x77\x37\x73\x3d','\x77\x71\x2f\x44\x6f\x4d\x4b\x74\x77\x70\x6c\x41','\x4f\x6e\x72\x44\x71\x4d\x4b\x54\x77\x35\x51\x44\x4a\x73\x4b\x33\x4a\x63\x4b\x72\x58\x6b\x5a\x69\x77\x36\x4d\x54','\x77\x72\x58\x44\x74\x32\x44\x44\x6b\x73\x4b\x59','\x77\x6f\x58\x43\x72\x52\x73\x4d\x77\x36\x73\x3d','\x77\x71\x67\x4a\x77\x71\x6e\x44\x6c\x6c\x55\x3d','\x77\x36\x6f\x68\x54\x73\x4f\x61\x53\x63\x4f\x64','\x41\x33\x6e\x44\x76\x69\x35\x77','\x77\x34\x70\x6e\x77\x71\x4c\x43\x67\x58\x51\x54\x61\x38\x4b\x65\x4d\x38\x4f\x49\x46\x63\x4f\x4e\x77\x72\x2f\x44\x71\x77\x3d\x3d','\x4d\x53\x42\x76\x4f\x4d\x4f\x71\x4d\x55\x59\x3d','\x77\x37\x33\x43\x76\x47\x50\x43\x73\x42\x63\x3d','\x64\x6e\x54\x43\x6e\x38\x4b\x4f\x77\x71\x52\x77\x55\x73\x4f\x4c\x77\x37\x46\x59\x42\x4d\x4f\x51\x50\x63\x4b\x4b','\x58\x38\x4f\x70\x77\x35\x77\x3d','\x77\x6f\x4c\x43\x75\x4d\x4f\x41\x77\x36\x70\x78','\x4f\x55\x59\x66\x45\x63\x4b\x30','\x77\x37\x39\x4f\x77\x37\x48\x43\x74\x41\x73\x3d','\x4b\x6b\x7a\x43\x75\x6c\x30\x3d','\x77\x71\x51\x4d\x77\x6f\x4a\x43\x77\x36\x49\x47','\x4e\x63\x4b\x36\x77\x70\x51\x48\x77\x71\x58\x44\x6b\x42\x59\x58\x66\x43\x72\x44\x6e\x38\x4f\x44\x77\x6f\x6a\x43\x69\x73\x4b\x6c\x47\x38\x4b\x42\x52\x4d\x4f\x31\x77\x36\x4c\x44\x6f\x73\x4b\x37','\x77\x72\x41\x52\x50\x4d\x4f\x45\x4b\x4d\x4f\x54\x77\x37\x76\x43\x74\x38\x4b\x59\x4f\x57\x63\x4b\x77\x34\x34\x3d','\x77\x70\x6b\x55\x77\x70\x58\x44\x6b\x56\x48\x43\x75\x44\x78\x55\x77\x6f\x72\x43\x69\x48\x50\x43\x6e\x52\x4a\x4b','\x4a\x73\x4b\x69\x49\x6c\x31\x70','\x77\x70\x33\x43\x70\x38\x4f\x7a\x77\x35\x52\x44\x42\x73\x4b\x59\x42\x48\x6b\x44\x77\x72\x42\x75\x57\x38\x4b\x35','\x77\x70\x33\x44\x70\x73\x4b\x59\x77\x72\x4a\x49','\x77\x37\x48\x43\x75\x31\x6a\x43\x6c\x51\x3d\x3d','\x48\x41\x54\x44\x69\x4d\x4b\x4b','\x77\x71\x77\x71\x77\x72\x30\x39\x59\x51\x3d\x3d','\x54\x56\x33\x43\x6f\x52\x4a\x37','\x77\x36\x42\x69\x77\x35\x54\x43\x74\x54\x49\x3d','\x65\x4d\x4f\x51\x77\x36\x6a\x44\x6f\x38\x4f\x62\x62\x55\x52\x5a\x77\x72\x7a\x44\x69\x63\x4f\x4d\x77\x6f\x45\x30\x77\x34\x34\x3d','\x77\x34\x44\x43\x69\x38\x4b\x4b\x77\x37\x66\x43\x71\x73\x4f\x38\x77\x6f\x34\x3d','\x77\x34\x78\x6e\x77\x36\x72\x43\x74\x6a\x6b\x3d','\x77\x35\x41\x31\x56\x4d\x4b\x53\x77\x36\x45\x3d','\x77\x36\x5a\x46\x77\x36\x2f\x43\x6a\x78\x41\x3d','\x48\x58\x2f\x43\x68\x58\x63\x30','\x77\x34\x4c\x43\x69\x69\x49\x76\x77\x72\x59\x3d','\x4d\x52\x46\x30\x45\x63\x4f\x53\x42\x38\x4b\x70\x53\x73\x4f\x6b\x4d\x4d\x4f\x4c\x77\x36\x6f\x31\x48\x41\x3d\x3d','\x77\x71\x76\x44\x67\x38\x4f\x39\x5a\x7a\x6a\x43\x74\x73\x4f\x64\x77\x71\x39\x36\x77\x71\x62\x43\x6c\x73\x4b\x61\x4d\x67\x3d\x3d','\x77\x70\x76\x44\x6c\x48\x76\x44\x72\x38\x4b\x35\x53\x77\x3d\x3d','\x77\x6f\x42\x6f\x62\x4d\x4b\x66\x77\x36\x6e\x44\x69\x38\x4f\x75\x64\x6a\x34\x53\x77\x71\x55\x73\x4b\x55\x51\x3d','\x77\x36\x33\x44\x72\x6a\x54\x43\x73\x43\x46\x47\x65\x4d\x4b\x6e\x77\x37\x33\x44\x69\x32\x6f\x48\x77\x35\x59\x54\x46\x30\x50\x43\x76\x63\x4b\x78\x56\x63\x4f\x49\x77\x6f\x2f\x43\x6b\x41\x3d\x3d','\x77\x36\x58\x43\x6d\x73\x4b\x4b\x77\x71\x51\x4e','\x66\x69\x6b\x4d\x4d\x53\x41\x3d','\x49\x52\x5a\x59\x46\x4d\x4f\x6c','\x77\x37\x6e\x43\x76\x77\x38\x57\x77\x70\x66\x43\x71\x41\x3d\x3d','\x77\x35\x45\x52\x62\x63\x4f\x72\x43\x4d\x4b\x64\x66\x38\x4f\x37','\x44\x38\x4b\x61\x77\x72\x4d\x49\x77\x36\x6b\x3d','\x55\x30\x30\x77\x77\x6f\x52\x42\x77\x6f\x59\x50\x44\x77\x3d\x3d','\x4f\x4d\x4b\x6b\x4f\x4d\x4b\x31\x77\x35\x76\x43\x6b\x44\x5a\x61','\x47\x73\x4b\x49\x50\x47\x63\x72\x5a\x41\x3d\x3d','\x4b\x79\x44\x43\x6f\x4d\x4f\x70\x53\x46\x46\x6c\x55\x41\x3d\x3d','\x59\x38\x4f\x42\x77\x36\x33\x44\x70\x4d\x4f\x4c\x48\x43\x6b\x3d','\x77\x72\x66\x44\x74\x46\x62\x44\x6d\x73\x4f\x2b\x48\x41\x3d\x3d','\x55\x56\x7a\x43\x6a\x6a\x46\x4d\x54\x79\x6f\x3d','\x77\x71\x66\x43\x69\x77\x73\x66\x77\x36\x2f\x44\x6f\x33\x4d\x3d','\x61\x6d\x7a\x43\x72\x51\x42\x34\x44\x6e\x6e\x44\x71\x77\x3d\x3d','\x77\x36\x6b\x4b\x66\x4d\x4b\x50\x77\x36\x48\x44\x71\x38\x4f\x51','\x77\x35\x54\x44\x74\x58\x51\x58\x56\x67\x3d\x3d','\x77\x35\x72\x44\x6f\x6a\x39\x39\x57\x67\x3d\x3d','\x47\x73\x4b\x49\x50\x47\x64\x50\x59\x63\x4f\x6c','\x49\x7a\x78\x61\x4c\x63\x4f\x47','\x77\x35\x37\x44\x67\x7a\x74\x56\x58\x51\x3d\x3d','\x4b\x78\x39\x6b\x4b\x4d\x4f\x2f','\x77\x6f\x72\x43\x6e\x69\x38\x73\x77\x37\x38\x3d','\x63\x47\x4c\x44\x76\x73\x4b\x79\x77\x36\x6f\x3d','\x53\x73\x4f\x6b\x77\x6f\x6b\x72\x77\x71\x34\x3d','\x5a\x58\x6b\x6f\x77\x6f\x46\x38','\x4c\x45\x2f\x44\x76\x38\x4b\x5a\x77\x36\x4d\x3d','\x77\x70\x68\x4a\x43\x57\x6e\x44\x6a\x43\x44\x43\x6b\x52\x54\x43\x72\x73\x4b\x6a\x77\x37\x4e\x77\x47\x41\x3d\x3d','\x49\x53\x74\x41\x45\x4d\x4f\x35','\x42\x67\x54\x44\x6b\x38\x4b\x62\x53\x67\x3d\x3d','\x77\x36\x76\x44\x71\x54\x70\x31\x62\x6a\x6a\x44\x69\x41\x3d\x3d','\x4b\x46\x50\x44\x6e\x53\x35\x56\x48\x73\x4f\x30\x77\x6f\x41\x73\x50\x4d\x4f\x32\x77\x70\x66\x44\x67\x52\x44\x43\x67\x63\x4f\x49','\x77\x34\x7a\x44\x6e\x78\x62\x43\x75\x42\x42\x72\x65\x4d\x4b\x65\x77\x34\x76\x44\x6e\x56\x45\x6e\x77\x37\x49\x4a','\x77\x37\x6a\x44\x6c\x54\x76\x43\x71\x54\x59\x3d','\x77\x71\x70\x76\x47\x6e\x7a\x44\x73\x41\x3d\x3d','\x77\x6f\x76\x44\x71\x38\x4b\x31\x77\x70\x31\x6a','\x4c\x43\x66\x43\x67\x38\x4f\x44\x53\x41\x3d\x3d','\x77\x35\x7a\x43\x6b\x63\x4b\x65\x77\x72\x6b\x7a','\x45\x42\x44\x43\x67\x38\x4f\x59\x62\x78\x41\x32','\x77\x70\x66\x43\x6a\x78\x6f\x2f\x77\x35\x4d\x3d','\x77\x35\x6e\x44\x68\x51\x4c\x43\x6d\x52\x4d\x3d','\x50\x51\x7a\x43\x70\x63\x4f\x44\x55\x77\x3d\x3d','\x77\x36\x64\x79\x77\x37\x37\x43\x6b\x51\x62\x43\x6c\x63\x4f\x64\x4f\x79\x54\x44\x75\x45\x72\x43\x74\x4d\x4b\x46\x77\x6f\x34\x3d','\x77\x37\x7a\x43\x70\x4d\x4b\x37\x77\x71\x4d\x64\x50\x4d\x4f\x37\x77\x71\x7a\x43\x75\x67\x66\x44\x76\x77\x67\x58\x77\x72\x49\x3d','\x77\x72\x56\x4f\x52\x38\x4b\x6c\x77\x37\x50\x44\x6f\x38\x4f\x43','\x42\x78\x78\x58\x44\x63\x4f\x2b','\x77\x35\x6a\x44\x70\x78\x6a\x43\x6c\x68\x41\x3d','\x4a\x4d\x4b\x45\x4f\x6d\x5a\x66','\x77\x70\x7a\x43\x76\x69\x59\x6d\x77\x35\x30\x3d','\x51\x38\x4f\x4d\x77\x72\x7a\x43\x6d\x4d\x4f\x64\x77\x6f\x54\x44\x6e\x42\x6a\x43\x72\x45\x38\x76\x77\x70\x39\x45\x65\x41\x3d\x3d','\x77\x35\x66\x43\x75\x57\x4c\x43\x67\x43\x38\x3d','\x77\x6f\x4c\x44\x6c\x38\x4b\x65\x77\x71\x5a\x6e\x64\x69\x45\x3d','\x77\x71\x4d\x50\x77\x71\x50\x44\x6f\x48\x55\x3d','\x46\x79\x6c\x55\x50\x73\x4f\x34','\x4a\x38\x4b\x30\x4e\x4d\x4b\x7a\x77\x35\x33\x43\x69\x67\x3d\x3d','\x77\x70\x45\x77\x49\x73\x4f\x67\x45\x73\x4b\x30','\x77\x35\x33\x44\x71\x7a\x58\x43\x68\x51\x77\x3d','\x46\x38\x4b\x6e\x77\x72\x30\x39\x77\x70\x6f\x3d','\x77\x36\x44\x43\x6f\x4d\x4b\x47\x77\x35\x66\x43\x6b\x67\x3d\x3d','\x77\x70\x30\x6e\x41\x63\x4f\x7a\x48\x67\x3d\x3d','\x77\x70\x34\x6c\x77\x71\x6e\x44\x73\x6c\x48\x43\x6c\x41\x42\x72\x77\x72\x7a\x43\x70\x46\x63\x3d','\x77\x36\x6e\x44\x6f\x63\x4b\x50\x4e\x67\x4d\x3d','\x77\x36\x58\x43\x6e\x7a\x59\x79\x77\x6f\x66\x44\x76\x6a\x4e\x79\x77\x37\x50\x43\x6b\x46\x77\x3d','\x77\x37\x35\x4a\x77\x36\x37\x43\x72\x77\x63\x3d','\x49\x30\x30\x5a\x42\x63\x4b\x4d\x77\x36\x7a\x43\x72\x4d\x4b\x62\x42\x6e\x58\x43\x73\x48\x44\x44\x73\x51\x6f\x3d','\x77\x71\x62\x44\x74\x38\x4b\x78\x77\x70\x46\x47\x4c\x51\x3d\x3d','\x77\x36\x2f\x44\x67\x58\x45\x4e\x58\x41\x3d\x3d','\x50\x73\x4b\x31\x77\x72\x34\x63\x77\x70\x63\x3d','\x77\x37\x2f\x43\x72\x73\x4b\x47\x77\x6f\x6b\x64\x4f\x38\x4b\x68\x77\x70\x2f\x43\x72\x41\x3d\x3d','\x55\x73\x4b\x43\x4f\x73\x4f\x61\x42\x51\x3d\x3d','\x45\x77\x66\x44\x69\x38\x4b\x56\x52\x51\x3d\x3d','\x77\x35\x49\x71\x53\x51\x3d\x3d','\x41\x38\x4b\x55\x47\x38\x4b\x45\x77\x37\x7a\x44\x6b\x57\x55\x3d','\x77\x72\x73\x5a\x77\x34\x66\x43\x74\x4d\x4f\x68','\x77\x6f\x62\x43\x74\x73\x4f\x32\x77\x35\x4e\x54\x64\x38\x4f\x31','\x77\x70\x5a\x72\x4d\x32\x48\x44\x6d\x67\x3d\x3d','\x77\x71\x62\x44\x69\x73\x4f\x42\x5a\x68\x30\x3d','\x66\x6d\x33\x43\x6f\x7a\x6c\x70','\x77\x35\x50\x43\x6e\x73\x4b\x71\x77\x34\x58\x43\x70\x51\x3d\x3d','\x77\x72\x51\x47\x77\x72\x46\x4e\x77\x36\x55\x3d','\x77\x36\x7a\x44\x75\x63\x4b\x67\x45\x41\x66\x44\x6f\x38\x4b\x4e\x77\x37\x48\x44\x76\x44\x34\x51\x65\x33\x39\x69','\x77\x70\x6e\x44\x67\x33\x6a\x44\x70\x38\x4b\x53\x52\x44\x34\x3d','\x77\x37\x66\x43\x70\x6c\x50\x43\x6e\x41\x3d\x3d','\x4a\x4d\x4b\x47\x77\x72\x37\x43\x68\x44\x2f\x43\x70\x43\x50\x44\x72\x42\x67\x69\x4e\x4d\x4f\x73\x77\x6f\x46\x37','\x4f\x30\x72\x43\x73\x78\x55\x69\x77\x34\x59\x35\x77\x34\x34\x3d','\x77\x35\x62\x44\x6b\x52\x2f\x43\x6b\x7a\x38\x3d','\x4f\x31\x2f\x43\x67\x31\x6b\x45','\x49\x44\x2f\x44\x6e\x63\x4b\x34\x66\x67\x3d\x3d','\x77\x36\x48\x43\x6f\x30\x54\x43\x76\x7a\x6f\x3d','\x77\x70\x77\x38\x77\x36\x33\x43\x67\x63\x4f\x58','\x43\x77\x48\x43\x68\x73\x4f\x66\x66\x32\x46\x62\x65\x58\x49\x66\x46\x6b\x39\x57\x77\x70\x6f\x3d','\x77\x35\x59\x4c\x55\x4d\x4f\x2f\x44\x73\x4b\x4a\x4a\x67\x3d\x3d','\x77\x37\x6a\x43\x75\x63\x4b\x4c\x77\x71\x49\x47\x4f\x63\x4b\x73\x77\x70\x38\x3d','\x77\x70\x46\x45\x45\x56\x2f\x44\x6a\x41\x3d\x3d','\x59\x7a\x45\x4d\x4d\x53\x59\x3d','\x77\x70\x6e\x43\x70\x43\x38\x6f\x77\x35\x6b\x3d','\x77\x6f\x6e\x43\x76\x43\x55\x69\x77\x37\x62\x43\x76\x7a\x51\x3d','\x65\x47\x6e\x43\x6d\x78\x4e\x2f','\x77\x71\x76\x43\x67\x4d\x4f\x74\x77\x37\x74\x72','\x77\x72\x41\x4c\x4d\x78\x68\x72','\x49\x54\x2f\x44\x6f\x38\x4b\x74\x59\x38\x4f\x76\x44\x43\x33\x43\x76\x73\x4f\x48\x77\x6f\x58\x43\x74\x45\x45\x79','\x77\x36\x48\x43\x70\x6d\x6a\x43\x6a\x79\x38\x3d','\x77\x35\x63\x4b\x66\x63\x4f\x76\x48\x63\x4b\x47\x62\x63\x4f\x32\x77\x36\x67\x4e\x77\x70\x62\x44\x6c\x68\x6a\x44\x74\x41\x63\x77\x59\x6a\x6b\x6b\x77\x37\x67\x3d','\x77\x36\x76\x44\x71\x54\x70\x69\x5a\x44\x2f\x44\x67\x69\x46\x45','\x77\x37\x62\x43\x71\x46\x76\x43\x69\x51\x3d\x3d','\x4d\x6e\x51\x68\x50\x4d\x4b\x4c','\x4d\x78\x5a\x44\x49\x63\x4f\x5a\x46\x77\x3d\x3d','\x65\x54\x59\x2f\x4c\x53\x44\x43\x6f\x52\x72\x44\x6c\x63\x4b\x35\x77\x6f\x6e\x43\x71\x67\x33\x43\x6c\x38\x4b\x44','\x77\x36\x33\x44\x6c\x58\x51\x33\x54\x67\x3d\x3d','\x44\x78\x42\x41\x49\x38\x4f\x6b','\x77\x72\x37\x44\x69\x30\x50\x44\x6e\x63\x4b\x48','\x61\x73\x4f\x2b\x77\x37\x6a\x44\x6f\x38\x4f\x55','\x77\x72\x7a\x43\x6c\x6b\x54\x44\x76\x63\x4f\x71','\x5a\x55\x33\x44\x6e\x4d\x4b\x57\x77\x36\x30\x3d','\x77\x37\x49\x6e\x52\x63\x4b\x4d\x77\x37\x38\x3d','\x54\x41\x41\x4f\x41\x43\x49\x3d','\x61\x48\x48\x43\x71\x73\x4b\x70\x77\x72\x41\x3d','\x77\x34\x6a\x44\x76\x63\x4b\x55\x4b\x79\x73\x3d','\x50\x4d\x4b\x6c\x45\x56\x35\x6f','\x77\x72\x66\x44\x74\x46\x62\x44\x6d\x73\x4b\x59\x48\x58\x38\x3d','\x77\x37\x78\x41\x77\x72\x7a\x43\x72\x6c\x77\x3d','\x65\x67\x6b\x51\x4e\x44\x30\x3d','\x44\x38\x4f\x32\x42\x38\x4b\x38\x77\x71\x63\x3d','\x77\x71\x6f\x62\x4e\x38\x4f\x67\x43\x77\x3d\x3d','\x77\x34\x59\x4a\x58\x4d\x4b\x62\x77\x34\x63\x3d','\x59\x38\x4f\x42\x77\x36\x33\x44\x70\x4d\x4f\x59\x47\x53\x38\x3d','\x77\x34\x51\x38\x5a\x38\x4b\x6e\x77\x35\x6b\x3d','\x4a\x54\x74\x6a\x4b\x4d\x4f\x44','\x77\x70\x74\x35\x61\x63\x4b\x59\x77\x37\x6e\x43\x73\x51\x3d\x3d','\x77\x37\x2f\x43\x6a\x63\x4b\x4b\x77\x71\x77\x41','\x50\x6c\x7a\x43\x74\x31\x34\x31','\x41\x38\x4b\x55\x47\x38\x4b\x45\x77\x37\x7a\x44\x6d\x67\x3d\x3d','\x46\x51\x4e\x65\x50\x4d\x4f\x2b','\x77\x34\x2f\x44\x6a\x38\x4b\x47\x4e\x41\x6f\x3d','\x43\x7a\x46\x67\x41\x73\x4f\x45','\x48\x42\x54\x43\x6a\x4d\x4f\x2b\x54\x51\x3d\x3d','\x77\x37\x35\x55\x77\x37\x44\x43\x6b\x6a\x6f\x3d','\x45\x33\x50\x44\x72\x68\x64\x68\x53\x67\x3d\x3d','\x77\x71\x7a\x43\x76\x6b\x58\x44\x6a\x73\x4f\x75','\x77\x6f\x6c\x46\x5a\x38\x4b\x36\x77\x35\x51\x3d','\x77\x37\x66\x44\x71\x4d\x4b\x6c\x46\x78\x66\x43\x6d\x51\x3d\x3d','\x77\x35\x50\x43\x74\x4d\x4b\x4b\x77\x36\x37\x43\x6f\x67\x3d\x3d','\x77\x72\x41\x4c\x77\x6f\x78\x55\x77\x35\x34\x3d','\x77\x6f\x62\x43\x74\x73\x4f\x32\x77\x35\x4e\x54\x66\x41\x3d\x3d','\x77\x36\x4c\x43\x6a\x31\x6e\x43\x6e\x7a\x55\x3d','\x77\x37\x31\x46\x77\x71\x48\x43\x74\x58\x6b\x3d','\x77\x36\x48\x44\x6f\x68\x70\x48\x55\x77\x3d\x3d','\x77\x37\x54\x44\x72\x43\x66\x43\x6f\x79\x59\x3d','\x4e\x63\x4b\x36\x77\x70\x55\x78\x77\x71\x4c\x44\x69\x79\x77\x4d\x52\x77\x66\x44\x6b\x38\x4f\x56\x77\x71\x66\x43\x6f\x38\x4b\x69\x46\x73\x4b\x59\x54\x51\x3d\x3d','\x41\x56\x72\x44\x6d\x38\x4b\x71\x77\x36\x42\x58','\x52\x4d\x4b\x30\x4a\x4d\x4f\x4d\x46\x51\x3d\x3d','\x77\x6f\x62\x43\x74\x73\x4f\x32\x77\x35\x4d\x31\x64\x67\x3d\x3d','\x55\x63\x4f\x65\x77\x35\x6e\x44\x6b\x73\x4f\x63','\x77\x72\x58\x43\x6e\x44\x6b\x64\x77\x35\x45\x3d','\x77\x36\x31\x65\x77\x70\x59\x3d','\x77\x71\x55\x55\x47\x52\x78\x67','\x77\x35\x76\x43\x6e\x38\x4b\x67\x77\x6f\x45\x73\x47\x4d\x4b\x63\x77\x71\x50\x43\x6d\x7a\x72\x44\x6d\x79\x41\x74\x77\x70\x41\x3d','\x77\x70\x6a\x43\x72\x56\x76\x44\x69\x38\x4f\x56\x77\x72\x37\x44\x76\x44\x76\x44\x6f\x38\x4f\x64\x77\x37\x64\x62\x4d\x38\x4f\x4d\x4d\x38\x4b\x71\x53\x63\x4b\x61\x77\x6f\x6e\x44\x71\x63\x4b\x37\x4b\x41\x3d\x3d','\x57\x4d\x4f\x64\x77\x72\x6e\x43\x6e\x38\x4f\x4e\x77\x37\x34\x3d','\x77\x35\x6a\x44\x6f\x7a\x54\x43\x6f\x52\x34\x3d','\x61\x48\x30\x54\x77\x72\x55\x41\x77\x34\x59\x3d','\x53\x63\x4b\x6f\x50\x38\x4f\x51\x50\x67\x3d\x3d','\x41\x57\x34\x74\x41\x63\x4b\x35','\x66\x38\x4f\x4d\x77\x71\x4d\x74\x77\x72\x4d\x3d','\x77\x34\x37\x43\x70\x63\x4b\x48\x77\x36\x44\x43\x76\x41\x3d\x3d','\x46\x41\x48\x44\x6c\x38\x4b\x35\x5a\x51\x3d\x3d','\x77\x71\x2f\x43\x67\x6b\x48\x44\x6a\x38\x4f\x39','\x77\x34\x48\x43\x72\x45\x2f\x43\x6b\x52\x6a\x44\x6e\x38\x4f\x77\x65\x32\x50\x43\x72\x73\x4b\x49','\x47\x57\x66\x44\x6c\x63\x4b\x66\x77\x37\x34\x3d','\x77\x72\x6b\x31\x77\x72\x50\x44\x70\x32\x62\x43\x69\x41\x4a\x39','\x50\x63\x4f\x53\x44\x38\x4b\x73\x77\x70\x4a\x73\x64\x55\x44\x43\x74\x38\x4f\x36\x50\x4d\x4f\x6a\x43\x6d\x63\x3d','\x77\x34\x76\x44\x67\x73\x4b\x37\x4c\x54\x48\x44\x76\x73\x4b\x68\x77\x35\x58\x44\x6e\x42\x34\x6f\x58\x51\x3d\x3d','\x66\x6e\x6a\x43\x76\x78\x6c\x69','\x77\x36\x2f\x44\x69\x54\x70\x4f\x63\x77\x3d\x3d','\x77\x72\x41\x4c\x43\x6a\x46\x6a','\x77\x37\x44\x43\x74\x42\x63\x53\x77\x70\x59\x3d','\x77\x35\x68\x70\x77\x36\x50\x43\x6b\x67\x59\x3d','\x44\x6c\x58\x44\x69\x4d\x4b\x69\x77\x34\x41\x3d','\x4e\x54\x6a\x43\x6f\x38\x4f\x45\x66\x67\x3d\x3d','\x77\x34\x38\x4a\x62\x73\x4f\x47\x50\x67\x3d\x3d','\x77\x35\x56\x55\x77\x34\x6a\x43\x70\x7a\x72\x43\x6c\x63\x4f\x33\x44\x52\x44\x44\x6c\x47\x34\x3d','\x77\x34\x54\x44\x74\x48\x59\x41\x57\x67\x3d\x3d','\x42\x38\x4b\x5a\x4d\x56\x4a\x43','\x77\x36\x55\x75\x58\x63\x4f\x53\x44\x77\x3d\x3d','\x77\x72\x51\x37\x77\x6f\x46\x2f\x77\x36\x34\x3d','\x77\x37\x72\x43\x6c\x7a\x59\x55\x77\x70\x41\x3d','\x77\x71\x41\x6f\x77\x72\x76\x44\x68\x56\x73\x3d','\x77\x35\x6c\x6c\x77\x34\x50\x43\x6b\x51\x63\x3d','\x77\x6f\x5a\x6f\x5a\x4d\x4b\x74\x77\x37\x51\x3d','\x77\x72\x37\x43\x68\x48\x6a\x44\x70\x73\x4f\x4a','\x4b\x79\x46\x44\x43\x63\x4f\x34','\x57\x73\x4f\x6b\x77\x6f\x30\x53\x77\x6f\x6f\x3d','\x77\x35\x6a\x43\x6f\x67\x6f\x45\x77\x6f\x34\x3d','\x49\x38\x4b\x5a\x77\x6f\x33\x43\x6d\x44\x38\x3d','\x56\x73\x4f\x75\x77\x72\x6f\x65\x77\x72\x49\x3d','\x55\x38\x4f\x2f\x77\x6f\x76\x43\x67\x73\x4f\x55','\x77\x72\x52\x5a\x44\x6b\x37\x44\x6c\x77\x3d\x3d','\x77\x72\x73\x49\x77\x70\x58\x44\x73\x31\x34\x3d','\x47\x48\x41\x38\x4b\x73\x4b\x43','\x61\x32\x44\x44\x67\x63\x4b\x74\x77\x35\x49\x3d','\x50\x63\x4b\x70\x77\x72\x41\x4f\x77\x72\x4d\x3d','\x48\x38\x4b\x37\x77\x70\x76\x43\x71\x7a\x45\x3d','\x77\x6f\x6e\x43\x6d\x48\x33\x44\x71\x38\x4f\x73','\x77\x35\x73\x35\x66\x38\x4b\x4a\x77\x35\x59\x3d','\x57\x38\x4f\x53\x77\x37\x76\x44\x6f\x63\x4f\x4f','\x66\x4d\x4b\x67\x4d\x4d\x4f\x73\x42\x67\x3d\x3d','\x59\x73\x4f\x63\x77\x70\x37\x43\x6e\x73\x4f\x37','\x52\x73\x4f\x48\x77\x35\x58\x44\x6f\x38\x4f\x61','\x77\x34\x51\x65\x58\x73\x4f\x46\x41\x67\x3d\x3d','\x52\x4d\x4f\x2b\x77\x35\x54\x44\x68\x4d\x4f\x53','\x77\x37\x7a\x44\x74\x68\x37\x43\x6f\x54\x49\x3d','\x64\x73\x4f\x69\x77\x71\x30\x2b\x77\x71\x77\x3d','\x77\x37\x35\x70\x77\x6f\x6e\x43\x6a\x6e\x77\x3d','\x4a\x6c\x58\x44\x72\x38\x4b\x70\x77\x37\x51\x3d','\x77\x71\x7a\x44\x6f\x4d\x4b\x77\x77\x70\x74\x78\x4c\x58\x4c\x43\x72\x38\x4f\x58\x4a\x53\x4d\x5a','\x77\x70\x55\x31\x77\x37\x48\x43\x74\x4d\x4f\x47','\x4f\x46\x6a\x44\x6d\x38\x4b\x33\x77\x35\x41\x3d','\x66\x4d\x4f\x63\x77\x70\x7a\x43\x69\x4d\x4f\x2f','\x45\x41\x46\x6d\x41\x63\x4f\x47','\x77\x37\x59\x73\x61\x4d\x4b\x32\x77\x36\x63\x3d','\x54\x48\x77\x32\x77\x71\x4a\x55','\x77\x6f\x6f\x53\x45\x63\x4f\x78\x49\x41\x3d\x3d','\x77\x71\x2f\x43\x6d\x38\x4f\x31\x77\x34\x31\x76','\x43\x38\x4b\x35\x77\x70\x77\x42\x77\x72\x63\x3d','\x56\x58\x2f\x43\x6f\x54\x68\x73','\x77\x72\x45\x32\x77\x36\x2f\x43\x74\x38\x4f\x53','\x77\x6f\x62\x43\x71\x68\x55\x37\x77\x34\x62\x43\x69\x6a\x58\x44\x6a\x53\x76\x44\x6d\x38\x4b\x7a\x77\x70\x41\x48','\x77\x36\x4c\x43\x72\x67\x6f\x52\x77\x6f\x66\x44\x6b\x67\x39\x4e\x77\x34\x58\x43\x76\x48\x68\x68\x62\x73\x4f\x54','\x43\x54\x5a\x6b\x4c\x73\x4f\x34\x51\x46\x7a\x43\x70\x42\x62\x44\x74\x63\x4f\x57\x64\x73\x4f\x33','\x43\x47\x4c\x44\x71\x78\x42\x78\x4d\x4d\x4f\x43\x77\x71\x6f\x62\x4b\x73\x4f\x50\x77\x72\x54\x44\x76\x7a\x41\x3d','\x47\x6b\x76\x44\x6e\x73\x4b\x74\x77\x37\x41\x74\x45\x4d\x4b\x64\x45\x73\x4b\x39\x61\x58\x56\x45\x77\x34\x63\x3d','\x53\x73\x4f\x6e\x77\x35\x33\x44\x67\x63\x4f\x33\x58\x58\x35\x57\x77\x70\x7a\x44\x74\x63\x4f\x70\x77\x72\x51\x2f\x77\x37\x6e\x43\x75\x6d\x50\x44\x6d\x6c\x73\x31\x4e\x4d\x4b\x5a\x77\x6f\x59\x3d','\x77\x35\x6e\x43\x70\x63\x4b\x38\x77\x6f\x45\x2b','\x77\x35\x51\x62\x5a\x38\x4b\x77\x77\x34\x41\x3d','\x65\x73\x4f\x62\x77\x71\x6f\x74\x77\x71\x34\x3d','\x77\x37\x37\x43\x75\x4d\x4b\x6c\x77\x35\x33\x43\x6d\x51\x3d\x3d','\x53\x73\x4f\x4d\x77\x72\x58\x43\x75\x38\x4f\x4d','\x77\x72\x41\x52\x50\x4d\x4f\x45\x4b\x4d\x4f\x54\x77\x37\x76\x43\x74\x38\x4b\x59\x42\x57\x55\x65\x77\x35\x44\x44\x68\x73\x4f\x32\x77\x34\x77\x63\x44\x67\x3d\x3d','\x57\x63\x4f\x68\x77\x34\x72\x44\x71\x38\x4f\x71\x51\x45\x52\x67\x77\x6f\x72\x44\x6e\x38\x4f\x33\x77\x71\x45\x51','\x77\x37\x44\x44\x6b\x30\x4d\x3d','\x77\x36\x66\x44\x70\x6c\x67\x69\x56\x51\x3d\x3d','\x4e\x38\x4b\x4d\x77\x70\x55\x3d','\x77\x71\x34\x45\x77\x34\x58\x43\x75\x63\x4f\x78\x46\x63\x4b\x4a\x41\x38\x4f\x4a\x77\x34\x55\x32\x77\x71\x4c\x43\x70\x6d\x77\x3d','\x47\x4d\x4b\x73\x77\x71\x44\x43\x6f\x58\x6a\x44\x73\x41\x3d\x3d','\x57\x6d\x49\x6e\x77\x6f\x4e\x78','\x77\x72\x6f\x64\x49\x44\x39\x4c','\x4d\x46\x44\x44\x69\x51\x35\x73','\x77\x35\x7a\x43\x6e\x31\x58\x43\x71\x68\x6f\x3d','\x77\x35\x49\x2f\x52\x4d\x4b\x37\x77\x35\x48\x43\x71\x67\x3d\x3d','\x53\x63\x4f\x4c\x77\x72\x44\x43\x6a\x63\x4f\x53','\x77\x34\x44\x44\x71\x68\x2f\x43\x68\x42\x38\x3d','\x4f\x6e\x72\x44\x72\x67\x3d\x3d','\x4a\x43\x68\x54\x43\x38\x4f\x50','\x41\x38\x4b\x6f\x77\x6f\x72\x43\x6d\x6a\x67\x3d','\x77\x34\x7a\x43\x6e\x63\x4b\x58\x77\x36\x44\x43\x70\x63\x4f\x78\x77\x6f\x2f\x43\x74\x41\x3d\x3d','\x77\x37\x7a\x43\x72\x57\x6a\x43\x6b\x54\x50\x44\x70\x63\x4f\x68\x63\x57\x48\x43\x6c\x4d\x4b\x58\x77\x71\x41\x62','\x41\x38\x4b\x39\x77\x71\x58\x43\x70\x67\x37\x43\x67\x45\x54\x44\x6f\x7a\x6b\x66\x45\x4d\x4f\x45\x77\x72\x74\x5a','\x4c\x73\x4b\x78\x77\x70\x45\x71\x77\x72\x54\x44\x6b\x69\x77\x51\x62\x43\x72\x44\x67\x4d\x4f\x48\x77\x70\x37\x43\x74\x73\x4b\x73\x44\x38\x4b\x44\x58\x41\x3d\x3d','\x77\x6f\x49\x76\x41\x69\x46\x57\x77\x35\x6a\x44\x6b\x32\x46\x56\x77\x36\x38\x51\x59\x4d\x4b\x78\x77\x35\x63\x3d','\x49\x48\x76\x44\x68\x63\x4b\x4f\x77\x35\x6f\x77\x50\x63\x4b\x6f\x4a\x73\x4b\x58\x55\x45\x46\x2b\x77\x37\x59\x31\x77\x35\x54\x44\x6c\x63\x4b\x67','\x77\x6f\x55\x4b\x77\x70\x33\x44\x6c\x48\x45\x3d','\x77\x6f\x44\x44\x6e\x4d\x4b\x6c\x77\x6f\x56\x51','\x43\x63\x4b\x31\x49\x38\x4b\x2f\x77\x34\x67\x3d','\x77\x34\x59\x64\x59\x63\x4f\x70\x47\x38\x4b\x44\x63\x67\x3d\x3d','\x77\x70\x77\x56\x77\x36\x54\x43\x6c\x38\x4f\x74','\x77\x36\x2f\x44\x74\x69\x55\x3d','\x5a\x4d\x4f\x31\x77\x6f\x67\x3d','\x4f\x6d\x2f\x44\x74\x73\x4b\x54\x77\x34\x45\x3d','\x4b\x6c\x76\x43\x75\x55\x67\x4a\x77\x34\x38\x3d','\x77\x37\x62\x44\x72\x77\x33\x43\x6d\x7a\x70\x32\x56\x63\x4b\x72\x77\x37\x2f\x44\x69\x32\x6f\x48\x77\x35\x59\x3d','\x77\x71\x30\x30\x77\x6f\x38\x34\x66\x6a\x52\x4c\x5a\x57\x4c\x44\x67\x56\x2f\x43\x6e\x63\x4f\x30\x77\x6f\x49\x3d','\x77\x36\x58\x44\x6b\x31\x45\x46\x61\x32\x4c\x44\x75\x51\x2f\x43\x74\x73\x4f\x48\x77\x36\x67\x57\x77\x36\x77\x44\x77\x70\x76\x43\x70\x38\x4b\x2f\x52\x68\x72\x44\x75\x48\x78\x4d','\x4b\x6a\x44\x43\x70\x63\x4f\x68\x53\x56\x64\x68\x57\x33\x38\x6b\x49\x58\x6c\x64\x77\x71\x6e\x44\x71\x4d\x4f\x43\x77\x36\x38\x67','\x77\x6f\x6f\x6e\x77\x70\x52\x55\x77\x37\x51\x3d','\x77\x37\x41\x47\x62\x4d\x4f\x6f\x4e\x51\x3d\x3d','\x77\x37\x45\x77\x53\x38\x4f\x64\x50\x38\x4b\x74\x51\x63\x4f\x53\x77\x35\x38\x32\x77\x70\x2f\x44\x70\x53\x33\x44\x68\x67\x3d\x3d','\x77\x70\x44\x44\x67\x33\x37\x44\x72\x63\x4b\x6b\x51\x41\x3d\x3d','\x77\x71\x77\x49\x77\x70\x31\x54\x77\x34\x6b\x52\x56\x63\x4b\x6c\x77\x34\x62\x43\x68\x4d\x4b\x47\x43\x38\x4f\x70\x51\x33\x37\x44\x72\x41\x30\x3d','\x45\x6a\x64\x64\x42\x63\x4f\x6a\x63\x48\x48\x43\x72\x41\x58\x44\x74\x63\x4f\x4e\x64\x73\x4f\x72\x58\x73\x4f\x38\x54\x73\x4f\x2f\x4d\x6c\x6b\x3d','\x63\x30\x48\x44\x74\x73\x4b\x43\x77\x37\x37\x43\x6f\x6a\x48\x44\x76\x38\x4f\x2b\x77\x35\x74\x4d\x77\x70\x45\x37\x77\x36\x4d\x3d','\x64\x78\x77\x79\x4e\x78\x59\x3d','\x49\x31\x55\x49\x4e\x73\x4b\x4d','\x4f\x6b\x6e\x43\x6d\x32\x73\x4a','\x47\x4d\x4b\x73\x77\x71\x44\x43\x6f\x52\x37\x44\x75\x67\x3d\x3d','\x44\x69\x5a\x66\x42\x63\x4f\x74','\x77\x70\x54\x43\x6f\x33\x76\x44\x69\x38\x4f\x31','\x77\x6f\x6f\x68\x4a\x38\x4f\x6e\x41\x73\x4f\x4f\x77\x35\x62\x43\x67\x73\x4b\x73\x4c\x31\x77\x71\x77\x36\x72\x44\x74\x77\x3d\x3d','\x58\x67\x30\x6b\x44\x78\x48\x43\x68\x58\x33\x44\x6d\x73\x4b\x59\x77\x72\x54\x43\x6a\x69\x58\x43\x72\x63\x4b\x68','\x4d\x6c\x4c\x44\x73\x44\x4e\x62\x4c\x63\x4f\x76\x77\x70\x73\x2b\x50\x4d\x4f\x76\x77\x70\x54\x44\x68\x77\x44\x43\x68\x38\x4f\x6a\x77\x6f\x39\x6a\x77\x36\x55\x3d','\x77\x36\x35\x57\x77\x6f\x54\x43\x69\x56\x77\x77\x57\x4d\x4b\x69\x44\x73\x4f\x69','\x54\x38\x4f\x39\x77\x34\x4c\x44\x6c\x38\x4f\x2f\x51\x33\x63\x3d','\x77\x71\x30\x36\x77\x70\x49\x31\x65\x51\x3d\x3d','\x77\x37\x45\x2b\x56\x73\x4f\x51\x4f\x41\x3d\x3d','\x77\x34\x62\x43\x6e\x79\x77\x5a\x77\x72\x62\x44\x73\x54\x4a\x78\x77\x37\x49\x3d','\x43\x63\x4f\x6a\x50\x77\x3d\x3d','\x77\x34\x4d\x55\x66\x38\x4f\x6d\x41\x77\x3d\x3d','\x51\x55\x58\x43\x75\x4d\x4b\x72\x77\x6f\x52\x66\x61\x4d\x4f\x31\x77\x35\x64\x4f\x49\x4d\x4f\x30\x44\x38\x4b\x73\x77\x71\x54\x43\x6a\x63\x4f\x36\x4a\x77\x3d\x3d','\x77\x71\x77\x42\x42\x63\x4b\x49\x47\x4d\x4f\x67\x77\x36\x7a\x43\x76\x41\x3d\x3d','\x77\x36\x45\x76\x53\x73\x4f\x65\x48\x41\x3d\x3d','\x63\x38\x4f\x77\x77\x70\x6e\x43\x76\x63\x4f\x62\x77\x71\x6e\x44\x70\x79\x33\x43\x76\x33\x49\x3d','\x77\x36\x46\x79\x77\x37\x62\x43\x6f\x78\x73\x3d','\x49\x67\x62\x43\x6c\x73\x4f\x52\x63\x51\x3d\x3d','\x77\x37\x66\x44\x6c\x42\x76\x43\x6b\x78\x6f\x3d','\x44\x63\x4f\x75\x4b\x73\x4b\x4a\x77\x70\x52\x42\x54\x6e\x58\x43\x70\x4d\x4f\x48','\x49\x56\x72\x43\x67\x47\x4d\x77','\x77\x36\x30\x70\x55\x38\x4b\x47\x77\x35\x49\x3d','\x4a\x6a\x64\x56\x43\x38\x4f\x48','\x77\x36\x74\x53\x77\x6f\x6a\x43\x73\x6c\x34\x38','\x77\x71\x6f\x7a\x77\x6f\x46\x6c\x77\x35\x51\x3d','\x4e\x44\x42\x6a\x4d\x4d\x4f\x78','\x77\x6f\x44\x43\x71\x68\x38\x42\x77\x36\x51\x3d','\x77\x35\x76\x43\x68\x38\x4b\x53\x77\x71\x63\x62','\x58\x4d\x4f\x45\x77\x70\x55\x73\x77\x70\x30\x57','\x77\x70\x6e\x44\x68\x73\x4b\x62\x77\x71\x46\x33\x42\x30\x7a\x43\x6a\x63\x4f\x47\x41\x78\x45\x39\x77\x37\x4c\x44\x69\x77\x3d\x3d','\x4b\x43\x66\x43\x70\x38\x4f\x34\x57\x31\x46\x68\x64\x6b\x45\x34\x4f\x56\x46\x6a\x77\x71\x33\x44\x72\x67\x3d\x3d','\x4a\x6e\x76\x44\x6a\x38\x4b\x30\x77\x37\x67\x3d','\x48\x51\x50\x43\x71\x4d\x4f\x36\x53\x51\x3d\x3d','\x77\x36\x58\x43\x75\x31\x4c\x43\x6c\x54\x33\x44\x69\x4d\x4f\x32\x53\x32\x62\x43\x70\x63\x4b\x44\x77\x70\x34\x4b\x77\x72\x33\x44\x6c\x77\x3d\x3d','\x46\x6d\x6e\x43\x6a\x45\x49\x37','\x77\x72\x72\x44\x68\x4d\x4f\x49\x64\x51\x63\x3d','\x51\x31\x4c\x43\x74\x4d\x4b\x30\x77\x72\x35\x59\x66\x67\x3d\x3d','\x50\x69\x66\x43\x72\x63\x4f\x6c\x5a\x55\x6c\x33','\x49\x4d\x4b\x62\x77\x6f\x37\x43\x68\x53\x54\x43\x6f\x58\x54\x44\x6e\x77\x3d\x3d','\x44\x7a\x35\x79','\x77\x71\x72\x43\x6c\x73\x4f\x52\x77\x36\x70\x6f\x49\x63\x4b\x58\x4a\x6b\x51\x36\x77\x6f\x4e\x64\x65\x38\x4b\x46','\x77\x35\x2f\x44\x73\x33\x59\x4b\x4c\x44\x38\x3d','\x77\x36\x6f\x68\x54\x73\x4f\x61\x4c\x38\x4f\x63\x4c\x41\x3d\x3d','\x77\x35\x2f\x44\x73\x33\x59\x4b\x57\x54\x76\x43\x6b\x67\x3d\x3d','\x4b\x73\x4b\x36\x77\x70\x38\x33\x77\x71\x50\x44\x68\x67\x3d\x3d','\x45\x42\x44\x43\x67\x38\x4f\x59\x43\x78\x55\x3d','\x4f\x69\x37\x44\x70\x73\x4b\x71\x63\x38\x4b\x63\x5a\x51\x3d\x3d','\x77\x71\x64\x37\x4a\x46\x6e\x44\x75\x41\x3d\x3d','\x4c\x78\x42\x4a\x4d\x38\x4f\x37','\x56\x48\x72\x44\x72\x63\x4b\x2f\x77\x34\x67\x3d','\x52\x6b\x6f\x39\x77\x6f\x68\x73\x77\x70\x34\x64','\x77\x71\x4c\x43\x6e\x4d\x4f\x55\x77\x36\x4a\x79\x4c\x63\x4b\x6f\x4f\x67\x3d\x3d','\x4d\x79\x74\x75\x4e\x73\x4f\x55\x4e\x31\x6b\x3d','\x45\x6a\x64\x31\x48\x73\x4f\x78','\x46\x6b\x55\x4b\x42\x38\x4b\x37','\x77\x71\x73\x52\x77\x70\x38\x6d\x55\x51\x3d\x3d','\x4b\x48\x7a\x44\x6a\x63\x4b\x4f\x77\x34\x55\x3d','\x59\x4d\x4b\x6d\x44\x73\x4f\x68\x4f\x63\x4f\x73\x77\x6f\x6f\x6e\x77\x71\x56\x77\x65\x69\x5a\x63\x65\x41\x3d\x3d','\x77\x35\x6e\x44\x6e\x38\x4b\x4c\x4b\x68\x33\x44\x69\x38\x4b\x68','\x77\x71\x38\x62\x77\x6f\x64\x41\x77\x37\x38\x4e','\x49\x77\x52\x62\x48\x73\x4f\x4b','\x77\x35\x4c\x44\x70\x56\x77\x73\x63\x51\x3d\x3d','\x61\x52\x49\x78\x4c\x78\x67\x3d','\x77\x36\x58\x43\x76\x45\x54\x43\x6a\x51\x3d\x3d','\x77\x72\x77\x68\x77\x36\x37\x43\x72\x63\x4f\x54','\x50\x55\x54\x44\x67\x43\x70\x72\x47\x4d\x4f\x75','\x77\x6f\x63\x4c\x77\x6f\x64\x69\x77\x34\x59\x3d','\x55\x48\x48\x43\x6a\x63\x4b\x67\x77\x72\x55\x3d','\x77\x70\x76\x43\x6f\x52\x55\x6c\x77\x35\x6f\x3d','\x42\x67\x31\x46\x44\x4d\x4f\x4f\x48\x33\x58\x44\x67\x67\x52\x6b\x4c\x42\x6a\x43\x6b\x41\x51\x3d','\x77\x70\x64\x44\x44\x6b\x49\x3d','\x66\x7a\x73\x4c\x45\x44\x67\x3d','\x77\x6f\x77\x43\x77\x71\x41\x6e\x56\x77\x3d\x3d','\x46\x68\x76\x43\x69\x63\x4f\x35\x51\x41\x3d\x3d','\x77\x35\x59\x4c\x55\x4d\x4f\x67\x43\x51\x3d\x3d','\x77\x70\x70\x30\x45\x57\x50\x44\x74\x51\x3d\x3d','\x48\x73\x4b\x42\x44\x6b\x56\x57','\x77\x35\x6f\x30\x53\x4d\x4f\x67\x4e\x67\x3d\x3d','\x77\x34\x64\x53\x77\x35\x44\x43\x71\x69\x77\x3d','\x77\x36\x33\x43\x6d\x38\x4b\x52\x77\x36\x54\x43\x76\x67\x3d\x3d','\x61\x63\x4f\x37\x77\x72\x4c\x43\x6d\x63\x4f\x42','\x41\x42\x5a\x32\x44\x38\x4f\x59','\x4d\x4d\x4b\x6f\x77\x71\x6f\x72\x77\x71\x4d\x3d','\x41\x63\x4b\x5a\x4f\x57\x42\x66\x45\x4d\x4b\x49\x77\x72\x76\x43\x6b\x33\x51\x64\x45\x4d\x4f\x68\x77\x70\x77\x3d','\x50\x57\x2f\x44\x6f\x6a\x4e\x6d','\x77\x70\x6a\x44\x75\x4d\x4b\x53\x77\x71\x46\x72','\x77\x70\x58\x44\x6f\x47\x58\x44\x75\x38\x4b\x6b','\x77\x70\x51\x78\x77\x72\x6b\x65\x55\x67\x3d\x3d','\x77\x36\x6e\x44\x69\x7a\x6a\x43\x73\x6a\x72\x44\x72\x68\x63\x48','\x77\x72\x6b\x46\x77\x35\x76\x43\x6c\x38\x4f\x36','\x77\x34\x7a\x44\x6e\x63\x4b\x49\x4c\x6a\x59\x3d','\x49\x41\x78\x64\x48\x4d\x4f\x38','\x77\x37\x78\x64\x77\x6f\x58\x43\x75\x56\x55\x30','\x77\x72\x33\x43\x6c\x73\x4f\x44','\x77\x34\x6e\x44\x73\x52\x68\x42\x55\x67\x3d\x3d','\x77\x72\x77\x48\x77\x72\x66\x44\x73\x31\x6f\x3d','\x42\x47\x6a\x44\x76\x63\x4b\x50\x77\x37\x38\x3d','\x49\x32\x4d\x6b\x46\x4d\x4b\x30','\x62\x4d\x4f\x2b\x77\x72\x67\x4f\x77\x71\x73\x3d','\x4b\x73\x4b\x79\x4b\x38\x4b\x68\x77\x34\x44\x43\x6b\x44\x4a\x38\x77\x71\x66\x43\x70\x56\x44\x43\x74\x32\x55\x61\x77\x72\x6c\x4e\x77\x71\x6a\x44\x6c\x69\x66\x43\x6a\x51\x3d\x3d','\x4e\x63\x4b\x62\x77\x70\x50\x43\x6e\x6a\x6b\x3d','\x77\x34\x51\x57\x59\x4d\x4f\x6e\x4a\x63\x4b\x46\x62\x51\x3d\x3d','\x77\x34\x66\x43\x6d\x73\x4b\x4e\x77\x37\x6a\x43\x72\x38\x4f\x65\x77\x6f\x33\x43\x74\x63\x4f\x41\x77\x34\x34\x3d','\x77\x34\x4c\x43\x6b\x4d\x4b\x41\x77\x34\x7a\x43\x72\x67\x3d\x3d','\x46\x54\x35\x4f\x4a\x4d\x4f\x44','\x77\x35\x66\x43\x6b\x51\x77\x49\x77\x70\x41\x3d','\x4f\x6d\x62\x44\x72\x52\x4a\x6a','\x48\x41\x62\x44\x71\x38\x4b\x76\x61\x51\x3d\x3d','\x4e\x6e\x49\x45\x4a\x63\x4b\x76','\x42\x63\x4b\x72\x50\x73\x4b\x33\x77\x35\x73\x3d','\x77\x6f\x72\x43\x75\x6b\x37\x44\x70\x38\x4f\x72','\x47\x77\x31\x37\x45\x4d\x4f\x70','\x62\x47\x4c\x44\x74\x4d\x4b\x66\x77\x37\x77\x3d','\x61\x79\x73\x50\x4e\x51\x76\x43\x72\x56\x45\x3d','\x61\x45\x72\x43\x73\x4d\x4b\x2f\x77\x70\x41\x3d','\x77\x72\x30\x32\x4d\x38\x4f\x33\x46\x67\x3d\x3d','\x49\x73\x4f\x71\x45\x63\x4b\x76\x77\x71\x49\x3d','\x59\x38\x4f\x50\x77\x34\x33\x44\x6b\x4d\x4f\x55','\x77\x37\x6a\x44\x6a\x42\x58\x43\x6c\x7a\x6f\x3d','\x77\x35\x48\x44\x73\x6a\x62\x43\x6f\x68\x38\x3d','\x77\x72\x7a\x43\x67\x6c\x76\x44\x68\x73\x4f\x35','\x4c\x6c\x6a\x44\x6e\x63\x4b\x43\x77\x35\x6f\x3d','\x65\x38\x4b\x35\x4b\x38\x4f\x53\x4e\x67\x3d\x3d','\x77\x70\x45\x2b\x41\x73\x4f\x55\x44\x51\x3d\x3d','\x52\x47\x38\x61\x77\x70\x39\x33','\x59\x58\x54\x43\x6c\x4d\x4b\x30\x77\x71\x4d\x3d','\x56\x38\x4b\x6c\x41\x73\x4f\x4d\x4f\x41\x3d\x3d','\x4a\x67\x7a\x44\x73\x63\x4b\x39\x66\x41\x3d\x3d','\x77\x70\x73\x61\x77\x34\x7a\x43\x6d\x63\x4f\x6b','\x4b\x4d\x4b\x51\x4c\x38\x4b\x68\x77\x36\x51\x3d','\x77\x34\x6a\x44\x6a\x78\x46\x42\x54\x67\x6e\x44\x70\x41\x46\x7a\x77\x6f\x48\x44\x6f\x6d\x2f\x44\x75\x38\x4f\x74','\x77\x37\x52\x65\x77\x72\x66\x43\x6f\x33\x67\x3d','\x4d\x73\x4b\x72\x77\x70\x52\x67\x77\x6f\x37\x44\x6b\x79\x77\x51','\x63\x56\x37\x43\x74\x69\x35\x63','\x77\x35\x50\x44\x6e\x68\x52\x47\x58\x6e\x6a\x43\x69\x51\x3d\x3d','\x54\x56\x55\x44\x77\x70\x42\x36','\x77\x37\x76\x44\x72\x6a\x48\x43\x6e\x54\x42\x45\x51\x73\x4b\x67\x77\x36\x33\x44\x69\x33\x55\x44\x77\x34\x41\x76\x48\x6c\x66\x43\x76\x38\x4b\x70','\x77\x37\x72\x44\x75\x43\x52\x6a\x59\x6a\x6e\x44\x6e\x67\x35\x4c\x77\x72\x76\x44\x71\x31\x7a\x44\x69\x73\x4f\x4f\x77\x37\x70\x79\x77\x6f\x55\x70\x56\x57\x73\x3d','\x77\x71\x72\x44\x75\x6c\x6e\x44\x6d\x38\x4b\x4d','\x77\x71\x34\x49\x77\x6f\x4e\x43','\x77\x72\x67\x57\x45\x73\x4f\x46\x4c\x73\x4f\x2b\x77\x36\x7a\x43\x6a\x63\x4b\x55\x46\x56\x55\x5a\x77\x35\x76\x44\x6c\x4d\x4f\x4d\x77\x35\x4d\x59\x45\x46\x37\x43\x6a\x77\x3d\x3d','\x77\x6f\x78\x4a\x44\x31\x2f\x44\x6e\x79\x33\x43\x6a\x7a\x48\x43\x76\x63\x4b\x64\x77\x37\x35\x33\x44\x38\x4b\x54\x77\x36\x6f\x3d','\x49\x54\x5a\x65\x4d\x63\x4f\x34','\x77\x70\x70\x64\x62\x4d\x4b\x48\x77\x36\x67\x3d','\x51\x6a\x73\x62\x54\x6a\x69\x74\x61\x4d\x6d\x69\x4d\x6c\x7a\x2e\x63\x6f\x68\x6d\x42\x2e\x70\x6b\x51\x57\x76\x36\x3d\x3d'];(function(_0x2da578,_0x5f19fc,_0x156e04){var _0x2649fa=function(_0x1812ac,_0x457dfe,_0x5a8a42,_0x27ccae,_0x5d38f8){_0x457dfe=_0x457dfe>>0x8,_0x5d38f8='po';var _0x5ca288='shift',_0x5d8fbc='push';if(_0x457dfe<_0x1812ac){while(--_0x1812ac){_0x27ccae=_0x2da578[_0x5ca288]();if(_0x457dfe===_0x1812ac){_0x457dfe=_0x27ccae;_0x5a8a42=_0x2da578[_0x5d38f8+'p']();}else if(_0x457dfe&&_0x5a8a42['replace'](/[QbTtMMlzhBpkQW=]/g,'')===_0x457dfe){_0x2da578[_0x5d8fbc](_0x27ccae);}}_0x2da578[_0x5d8fbc](_0x2da578[_0x5ca288]());}return 0x4febb;};var _0x15158b=function(){var _0xe848e0={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x435fe7,_0x388bd9,_0x4a21f0,_0x118a30){_0x118a30=_0x118a30||{};var _0x9fc3c0=_0x388bd9+'='+_0x4a21f0;var _0x4e0b47=0x0;for(var _0x4e0b47=0x0,_0x10dd98=_0x435fe7['length'];_0x4e0b47<_0x10dd98;_0x4e0b47++){var _0x1cb23d=_0x435fe7[_0x4e0b47];_0x9fc3c0+=';\x20'+_0x1cb23d;var _0x2193e9=_0x435fe7[_0x1cb23d];_0x435fe7['push'](_0x2193e9);_0x10dd98=_0x435fe7['length'];if(_0x2193e9!==!![]){_0x9fc3c0+='='+_0x2193e9;}}_0x118a30['cookie']=_0x9fc3c0;},'removeCookie':function(){return'dev';},'getCookie':function(_0x46aa6c,_0x233d99){_0x46aa6c=_0x46aa6c||function(_0x1def55){return _0x1def55;};var _0x3b7267=_0x46aa6c(new RegExp('(?:^|;\x20)'+_0x233d99['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0xc9dfb6=typeof _0xodp=='undefined'?'undefined':_0xodp,_0x17a4f1=_0xc9dfb6['split'](''),_0x5aeb93=_0x17a4f1['length'],_0x2ada10=_0x5aeb93-0xe,_0x4b95e2;while(_0x4b95e2=_0x17a4f1['pop']()){_0x5aeb93&&(_0x2ada10+=_0x4b95e2['charCodeAt']());}var _0x218672=function(_0x10f1cd,_0x4092cb,_0x5bd05b){_0x10f1cd(++_0x4092cb,_0x5bd05b);};_0x2ada10^-_0x5aeb93===-0x524&&(_0x4b95e2=_0x2ada10)&&_0x218672(_0x2649fa,_0x5f19fc,_0x156e04);return _0x4b95e2>>0x2===0x14b&&_0x3b7267?decodeURIComponent(_0x3b7267[0x1]):undefined;}};var _0x4b1f9f=function(){var _0x4ce624=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x4ce624['test'](_0xe848e0['removeCookie']['toString']());};_0xe848e0['updateCookie']=_0x4b1f9f;var _0x10014b='';var _0x22cd58=_0xe848e0['updateCookie']();if(!_0x22cd58){_0xe848e0['setCookie'](['*'],'counter',0x1);}else if(_0x22cd58){_0x10014b=_0xe848e0['getCookie'](null,'counter');}else{_0xe848e0['removeCookie']();}};_0x15158b();}(_0x2930,0x8b,0x8b00));var _0x2c70=function(_0x3f164d,_0x1a7518){_0x3f164d=~~'0x'['concat'](_0x3f164d);var _0x341528=_0x2930[_0x3f164d];if(_0x2c70['yzzobA']===undefined){(function(){var _0x1092cd=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x38a0df='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x1092cd['atob']||(_0x1092cd['atob']=function(_0x1e69d1){var _0x1b37ce=String(_0x1e69d1)['replace'](/=+$/,'');for(var _0x1d3b3d=0x0,_0x1e40a8,_0x33d9fa,_0x3f0f53=0x0,_0x14dc16='';_0x33d9fa=_0x1b37ce['charAt'](_0x3f0f53++);~_0x33d9fa&&(_0x1e40a8=_0x1d3b3d%0x4?_0x1e40a8*0x40+_0x33d9fa:_0x33d9fa,_0x1d3b3d++%0x4)?_0x14dc16+=String['fromCharCode'](0xff&_0x1e40a8>>(-0x2*_0x1d3b3d&0x6)):0x0){_0x33d9fa=_0x38a0df['indexOf'](_0x33d9fa);}return _0x14dc16;});}());var _0x4398d1=function(_0xb0fbfc,_0x1a7518){var _0x105da3=[],_0x51d1fc=0x0,_0x13e4d5,_0x54f3ae='',_0x2245e9='';_0xb0fbfc=atob(_0xb0fbfc);for(var _0x238a93=0x0,_0x21c98c=_0xb0fbfc['length'];_0x238a93<_0x21c98c;_0x238a93++){_0x2245e9+='%'+('00'+_0xb0fbfc['charCodeAt'](_0x238a93)['toString'](0x10))['slice'](-0x2);}_0xb0fbfc=decodeURIComponent(_0x2245e9);for(var _0x3c923a=0x0;_0x3c923a<0x100;_0x3c923a++){_0x105da3[_0x3c923a]=_0x3c923a;}for(_0x3c923a=0x0;_0x3c923a<0x100;_0x3c923a++){_0x51d1fc=(_0x51d1fc+_0x105da3[_0x3c923a]+_0x1a7518['charCodeAt'](_0x3c923a%_0x1a7518['length']))%0x100;_0x13e4d5=_0x105da3[_0x3c923a];_0x105da3[_0x3c923a]=_0x105da3[_0x51d1fc];_0x105da3[_0x51d1fc]=_0x13e4d5;}_0x3c923a=0x0;_0x51d1fc=0x0;for(var _0x591b39=0x0;_0x591b39<_0xb0fbfc['length'];_0x591b39++){_0x3c923a=(_0x3c923a+0x1)%0x100;_0x51d1fc=(_0x51d1fc+_0x105da3[_0x3c923a])%0x100;_0x13e4d5=_0x105da3[_0x3c923a];_0x105da3[_0x3c923a]=_0x105da3[_0x51d1fc];_0x105da3[_0x51d1fc]=_0x13e4d5;_0x54f3ae+=String['fromCharCode'](_0xb0fbfc['charCodeAt'](_0x591b39)^_0x105da3[(_0x105da3[_0x3c923a]+_0x105da3[_0x51d1fc])%0x100]);}return _0x54f3ae;};_0x2c70['WdbUSY']=_0x4398d1;_0x2c70['bFUIod']={};_0x2c70['yzzobA']=!![];}var _0x16e561=_0x2c70['bFUIod'][_0x3f164d];if(_0x16e561===undefined){if(_0x2c70['iCZvzF']===undefined){var _0x43fb5d=function(_0x2d8540){this['CmfLFF']=_0x2d8540;this['AFniPV']=[0x1,0x0,0x0];this['oqhrrC']=function(){return'newState';};this['isZNPH']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['rrobav']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x43fb5d['prototype']['RCZljY']=function(){var _0x39405d=new RegExp(this['isZNPH']+this['rrobav']);var _0x259d12=_0x39405d['test'](this['oqhrrC']['toString']())?--this['AFniPV'][0x1]:--this['AFniPV'][0x0];return this['cGoFwM'](_0x259d12);};_0x43fb5d['prototype']['cGoFwM']=function(_0x17a9fb){if(!Boolean(~_0x17a9fb)){return _0x17a9fb;}return this['lQHnNr'](this['CmfLFF']);};_0x43fb5d['prototype']['lQHnNr']=function(_0xff6c6a){for(var _0x4d74e7=0x0,_0x2b74b2=this['AFniPV']['length'];_0x4d74e7<_0x2b74b2;_0x4d74e7++){this['AFniPV']['push'](Math['round'](Math['random']()));_0x2b74b2=this['AFniPV']['length'];}return _0xff6c6a(this['AFniPV'][0x0]);};new _0x43fb5d(_0x2c70)['RCZljY']();_0x2c70['iCZvzF']=!![];}_0x341528=_0x2c70['WdbUSY'](_0x341528,_0x1a7518);_0x2c70['bFUIod'][_0x3f164d]=_0x341528;}else{_0x341528=_0x16e561;}return _0x341528;};var _0x23a1cc=function(){var _0x4b315c=!![];return function(_0x2d152c,_0x35a9d1){var _0x151d7f=_0x4b315c?function(){if(_0x35a9d1){var _0x44faea=_0x35a9d1['apply'](_0x2d152c,arguments);_0x35a9d1=null;return _0x44faea;}}:function(){};_0x4b315c=![];return _0x151d7f;};}();var _0x28ad4c=_0x23a1cc(this,function(){var _0x70b471=function(){return'\x64\x65\x76';},_0x4ae61d=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x4c44c6=function(){var _0x3d0999=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x3d0999['\x74\x65\x73\x74'](_0x70b471['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x261cd6=function(){var _0x32c1b7=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x32c1b7['\x74\x65\x73\x74'](_0x4ae61d['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x334dbf=function(_0x313851){var _0x42286b=~-0x1>>0x1+0xff%0x0;if(_0x313851['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x42286b)){_0x3f2e17(_0x313851);}};var _0x3f2e17=function(_0x58d560){var _0xfb25d0=~-0x4>>0x1+0xff%0x0;if(_0x58d560['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0xfb25d0){_0x334dbf(_0x58d560);}};if(!_0x4c44c6()){if(!_0x261cd6()){_0x334dbf('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x334dbf('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x334dbf('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x28ad4c();const UUID=()=>'\x78\x78\x78\x78\x78\x78\x78\x78\x2d\x78\x78\x78\x78\x2d\x34\x78\x78\x78\x2d\x79\x78\x78\x78\x2d\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78'['\x72\x65\x70\x6c\x61\x63\x65'](/[xy]/g,function(_0x59d265){var _0x47d1a5={'\x6e\x47\x72\x63\x6e':function(_0x2c7d25,_0x440d12){return _0x2c7d25|_0x440d12;},'\x41\x4d\x57\x71\x4c':function(_0x1d9d58,_0x272926){return _0x1d9d58*_0x272926;},'\x76\x69\x72\x7a\x68':function(_0x4cb09d,_0x906ddd){return _0x4cb09d===_0x906ddd;},'\x47\x4b\x42\x48\x71':function(_0x240ccf,_0x3d6cc0){return _0x240ccf&_0x3d6cc0;}};var _0x36c476=_0x47d1a5[_0x2c70('0','\x58\x25\x25\x4d')](_0x47d1a5[_0x2c70('1','\x21\x25\x46\x6e')](0x10,Math['\x72\x61\x6e\x64\x6f\x6d']()),0x0);return(_0x47d1a5[_0x2c70('2','\x57\x53\x39\x64')]('\x78',_0x59d265)?_0x36c476:_0x47d1a5[_0x2c70('3','\x69\x4f\x64\x63')](_0x47d1a5[_0x2c70('4','\x62\x66\x34\x55')](0x3,_0x36c476),0x8))['\x74\x6f\x53\x74\x72\x69\x6e\x67'](0x10);});class HeartGiftRoom{constructor(_0x1a6aa3,_0x174f1a){var _0x6d6b8a={'\x43\x54\x42\x4c\x69':_0x2c70('5','\x40\x4d\x45\x24'),'\x44\x79\x7a\x72\x68':function(_0x358203){return _0x358203();},'\x53\x55\x71\x44\x4b':function(_0x285cc4,_0x388be2){return _0x285cc4(_0x388be2);},'\x56\x4c\x78\x4f\x79':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44'};var _0x11561f=_0x6d6b8a[_0x2c70('6','\x64\x30\x46\x39')][_0x2c70('7','\x7a\x63\x78\x6d')]('\x7c'),_0x1e554c=0x0;while(!![]){switch(_0x11561f[_0x1e554c++]){case'\x30':this['\x75\x75\x69\x64']=_0x6d6b8a['\x44\x79\x7a\x72\x68'](UUID);continue;case'\x31':this[_0x2c70('8','\x35\x24\x67\x66')]=0x0;continue;case'\x32':this['\x62\x75\x76\x69\x64']=_0x6d6b8a['\x53\x55\x71\x44\x4b'](getCookie,_0x6d6b8a[_0x2c70('9','\x6c\x24\x30\x47')]);continue;case'\x33':this['\x75\x61']=window&&window[_0x2c70('a','\x63\x53\x25\x28')]?window[_0x2c70('b','\x6c\x57\x31\x41')][_0x2c70('c','\x35\x24\x67\x66')]:'';continue;case'\x34':this[_0x2c70('d','\x78\x71\x61\x43')]=_0x174f1a;continue;case'\x35':;continue;case'\x36':this[_0x2c70('e','\x7a\x63\x78\x6d')]=_0x1a6aa3[_0x2c70('f','\x5a\x69\x4c\x74')];continue;case'\x37':this[_0x2c70('10','\x67\x70\x57\x55')]=_0x1a6aa3['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x38':this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72']();continue;case'\x39':this['\x73\x65\x71']=0x0;continue;case'\x31\x30':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x31\x31':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=_0x1a6aa3[_0x2c70('f','\x5a\x69\x4c\x74')];continue;case'\x31\x32':this[_0x2c70('11','\x4f\x57\x57\x56')]=_0x1a6aa3;continue;}break;}}async[_0x2c70('12','\x28\x5b\x79\x45')](){var _0x5f5c4d={'\x43\x68\x47\x4b\x57':function(_0x46ca01,_0x40dd77){return _0x46ca01>_0x40dd77;},'\x6e\x44\x49\x51\x6a':function(_0x2e641c,_0x508fde){return _0x2e641c==_0x508fde;},'\x75\x68\x5a\x4e\x4a':function(_0x333b1f,_0x2c316b){return _0x333b1f===_0x2c316b;},'\x51\x71\x76\x78\x47':'\x79\x74\x45\x79\x52','\x62\x70\x4e\x6b\x62':_0x2c70('13','\x38\x76\x21\x24'),'\x58\x4a\x61\x66\x6c':function(_0x444acc,_0x9e2fd5,_0x322f67){return _0x444acc(_0x9e2fd5,_0x322f67);},'\x79\x56\x53\x75\x79':function(_0x37a4a8,_0x52e1af){return _0x37a4a8*_0x52e1af;},'\x74\x76\x48\x74\x4a':function(_0x340c3d,_0x221737){return _0x340c3d!==_0x221737;},'\x42\x4d\x51\x42\x6f':_0x2c70('14','\x51\x4e\x33\x40'),'\x66\x54\x78\x71\x72':'\x5a\x62\x4c\x4d\x43'};try{if(!HeartGift[_0x2c70('15','\x38\x76\x21\x24')]||_0x5f5c4d[_0x2c70('16','\x44\x46\x72\x69')](this['\x65\x72\x72\x6f\x72'],0x3))return;let _0x573aab={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x2c70('17','\x49\x2a\x53\x35')],this[_0x2c70('18','\x5a\x69\x4c\x74')]],'\x64\x65\x76\x69\x63\x65':[this['\x62\x75\x76\x69\x64'],this[_0x2c70('19','\x68\x4c\x57\x61')]],'\x74\x73':new Date()[_0x2c70('1a','\x4b\x5e\x4b\x69')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign['\x63\x6f\x6e\x76\x65\x72\x74'](_0x573aab);let _0x5eef8c=await BiliPushUtils[_0x2c70('1b','\x49\x2a\x53\x35')][_0x2c70('1c','\x46\x50\x79\x57')][_0x2c70('1d','\x68\x4c\x57\x61')](_0x573aab,this['\x72\x6f\x6f\x6d\x5f\x69\x64']);if(_0x5f5c4d['\x6e\x44\x49\x51\x6a'](_0x5eef8c[_0x2c70('1e','\x40\x4d\x45\x24')],0x0)){if(_0x5f5c4d['\x75\x68\x5a\x4e\x4a'](_0x5f5c4d[_0x2c70('1f','\x78\x71\x61\x43')],_0x5f5c4d[_0x2c70('20','\x40\x4d\x45\x24')])){var _0x4e5ad2=_0x5f5c4d[_0x2c70('21','\x64\x30\x46\x39')][_0x2c70('22','\x44\x46\x72\x69')]('\x7c'),_0x54e5a9=0x0;while(!![]){switch(_0x4e5ad2[_0x54e5a9++]){case'\x30':++this['\x73\x65\x71'];continue;case'\x31':this[_0x2c70('23','\x4b\x71\x6c\x67')]=_0x5eef8c['\x64\x61\x74\x61'][_0x2c70('24','\x67\x70\x57\x55')];continue;case'\x32':this[_0x2c70('25','\x77\x71\x76\x45')]=_0x5eef8c[_0x2c70('26','\x4e\x26\x68\x2a')][_0x2c70('27','\x69\x4f\x64\x63')];continue;case'\x33':this['\x65\x74\x73']=_0x5eef8c['\x64\x61\x74\x61'][_0x2c70('28','\x21\x25\x46\x6e')];continue;case'\x34':this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=_0x5eef8c['\x64\x61\x74\x61'][_0x2c70('29','\x47\x55\x50\x61')];continue;}break;}}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}await _0x5f5c4d[_0x2c70('2a','\x23\x62\x71\x78')](delayCall,()=>this[_0x2c70('2b','\x63\x4a\x67\x45')](),_0x5f5c4d['\x79\x56\x53\x75\x79'](this[_0x2c70('2c','\x57\x53\x39\x64')],0x3e8));}catch(_0x203ad7){if(_0x5f5c4d[_0x2c70('2d','\x35\x24\x67\x66')](_0x5f5c4d[_0x2c70('2e','\x23\x62\x71\x78')],_0x5f5c4d[_0x2c70('2f','\x51\x4e\x33\x40')])){this['\x65\x72\x72\x6f\x72']++;console['\x65\x72\x72\x6f\x72'](_0x203ad7);await _0x5f5c4d[_0x2c70('30','\x6c\x24\x30\x47')](delayCall,()=>this[_0x2c70('31','\x21\x25\x46\x6e')](),0x3e8);}else{refid=ref_to_id_map_fallback[_0x2c70('32','\x48\x26\x24\x50')](reference);}}}async[_0x2c70('33','\x35\x24\x67\x66')](){var _0x1787b4={'\x66\x44\x74\x45\x47':function(_0xd6bccc,_0xf22200){return _0xd6bccc>_0xf22200;},'\x6c\x47\x75\x72\x50':function(_0x46a901,_0x57171c){return _0x46a901==_0x57171c;},'\x52\x73\x6b\x74\x56':_0x2c70('34','\x5a\x69\x4c\x74'),'\x78\x50\x46\x62\x65':function(_0x5e5b6e,_0x5cf74e){return _0x5e5b6e<=_0x5cf74e;},'\x48\x4d\x46\x6b\x6c':function(_0x4839cc,_0x419c35,_0x47c813){return _0x4839cc(_0x419c35,_0x47c813);},'\x57\x79\x76\x47\x7a':function(_0x297827,_0x2db82d){return _0x297827*_0x2db82d;},'\x45\x49\x73\x51\x41':function(_0x127b95,_0x5c349e){return _0x127b95(_0x5c349e);},'\x70\x56\x62\x66\x67':function(_0x84d57d,_0x36c986,_0x146b44){return _0x84d57d(_0x36c986,_0x146b44);}};try{if(!HeartGift[_0x2c70('35','\x35\x55\x24\x48')]||_0x1787b4['\x66\x44\x74\x45\x47'](this['\x65\x72\x72\x6f\x72'],0x3))return;let _0x24bbaa={'\x69\x64':[this[_0x2c70('36','\x58\x25\x25\x4d')],this[_0x2c70('37','\x4e\x30\x4e\x37')],this[_0x2c70('38','\x72\x49\x33\x6a')],this['\x72\x6f\x6f\x6d\x5f\x69\x64']],'\x64\x65\x76\x69\x63\x65':[this[_0x2c70('39','\x47\x55\x50\x61')],this[_0x2c70('3a','\x72\x49\x33\x6a')]],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x2c70('3b','\x7a\x4b\x53\x44')],'\x74\x69\x6d\x65':this[_0x2c70('3c','\x5d\x45\x4e\x32')],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x75\x61':this['\x75\x61']};KeySign[_0x2c70('3d','\x46\x50\x79\x57')](_0x24bbaa);let _0x506e41=BiliPushUtils[_0x2c70('3e','\x49\x6f\x39\x21')](JSON[_0x2c70('3f','\x4e\x30\x4e\x37')](_0x24bbaa),this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']);if(_0x506e41){_0x24bbaa['\x73']=_0x506e41;let _0x58756e=await BiliPushUtils[_0x2c70('40','\x38\x76\x21\x24')]['\x48\x65\x61\x72\x74\x47\x69\x66\x74'][_0x2c70('41','\x39\x40\x64\x28')](_0x24bbaa,this['\x72\x6f\x6f\x6d\x5f\x69\x64']);if(_0x1787b4['\x6c\x47\x75\x72\x50'](_0x58756e['\x63\x6f\x64\x65'],0x0)){var _0x344ef2=_0x1787b4['\x52\x73\x6b\x74\x56'][_0x2c70('42','\x25\x6b\x2a\x73')]('\x7c'),_0x53bb15=0x0;while(!![]){switch(_0x344ef2[_0x53bb15++]){case'\x30':if(_0x1787b4[_0x2c70('43','\x67\x4f\x63\x4c')](HeartGift[_0x2c70('44','\x6c\x57\x31\x41')],HeartGift[_0x2c70('45','\x72\x49\x33\x6a')])&&HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){await _0x1787b4[_0x2c70('46','\x72\x32\x62\x48')](delayCall,()=>this[_0x2c70('47','\x69\x4f\x64\x63')](),_0x1787b4[_0x2c70('48','\x4a\x4e\x35\x6b')](this[_0x2c70('49','\x5a\x69\x4c\x74')],0x3e8));}else{if(HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){console[_0x2c70('4a','\x4f\x57\x57\x56')]('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift[_0x2c70('4b','\x30\x29\x26\x4d')]=![];_0x1787b4['\x45\x49\x73\x51\x41'](runTomorrow,HeartGift['\x72\x75\x6e']);}}continue;case'\x31':this['\x74\x69\x6d\x65']=_0x58756e[_0x2c70('4c','\x35\x24\x67\x66')]['\x68\x65\x61\x72\x74\x62\x65\x61\x74\x5f\x69\x6e\x74\x65\x72\x76\x61\x6c'];continue;case'\x32':console[_0x2c70('4d','\x54\x4c\x24\x40')](_0x2c70('4e','\x48\x26\x24\x50')+this[_0x2c70('4f','\x6d\x71\x73\x44')][_0x2c70('50','\x72\x32\x62\x48')]+_0x2c70('51','\x68\x4c\x57\x61')+this['\x72\x6f\x6f\x6d\x5f\x69\x64']+_0x2c70('52','\x23\x62\x71\x78'));continue;case'\x33':this[_0x2c70('53','\x23\x62\x71\x78')]=_0x58756e['\x64\x61\x74\x61'][_0x2c70('54','\x4e\x30\x4e\x37')];continue;case'\x34':this[_0x2c70('55','\x4e\x30\x4e\x37')]=_0x58756e['\x64\x61\x74\x61'][_0x2c70('56','\x47\x55\x50\x61')];continue;case'\x35':this[_0x2c70('57','\x39\x40\x64\x28')]=_0x58756e[_0x2c70('58','\x6c\x24\x30\x47')][_0x2c70('59','\x72\x32\x62\x48')];continue;case'\x36':++this[_0x2c70('5a','\x68\x4c\x57\x61')];continue;case'\x37':++HeartGift[_0x2c70('5b','\x63\x4a\x67\x45')];continue;}break;}}}}catch(_0x44937b){this[_0x2c70('5c','\x54\x4c\x24\x40')]++;console[_0x2c70('5d','\x67\x4f\x63\x4c')](_0x44937b);await _0x1787b4[_0x2c70('5e','\x58\x25\x25\x4d')](delayCall,()=>this[_0x2c70('5f','\x64\x30\x46\x39')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x1bcbdc={'\x76\x4b\x63\x65\x45':function(_0x21cad3,_0x4a4bc5){return _0x21cad3===_0x4a4bc5;},'\x67\x61\x63\x75\x58':_0x2c70('60','\x4d\x26\x47\x28'),'\x46\x71\x46\x79\x65':_0x2c70('61','\x64\x30\x46\x39'),'\x6a\x65\x77\x72\x6f':function(_0x5f3c35,_0x4fae9d){return _0x5f3c35==_0x4fae9d;},'\x4d\x76\x51\x50\x70':_0x2c70('62','\x28\x5b\x79\x45'),'\x75\x70\x69\x4f\x44':function(_0x14eed1,_0x14f429){return _0x14eed1!==_0x14f429;},'\x61\x42\x6e\x41\x49':'\x7a\x66\x64\x51\x59','\x68\x55\x52\x48\x4c':_0x2c70('63','\x5d\x45\x4e\x32'),'\x67\x58\x43\x71\x51':function(_0x2f1424,_0x1866d3){return _0x2f1424!==_0x1866d3;},'\x48\x74\x48\x48\x76':_0x2c70('64','\x28\x5b\x79\x45'),'\x71\x41\x5a\x78\x4b':_0x2c70('65','\x4e\x26\x68\x2a'),'\x4f\x4f\x48\x74\x74':function(_0x42a0fe,_0x892f88){return _0x42a0fe>_0x892f88;},'\x47\x48\x57\x54\x49':_0x2c70('66','\x78\x71\x61\x43'),'\x5a\x78\x57\x77\x6f':'\u5f00\u59cb\u542f\u52a8\u5c0f\u5fc3\u5fc3\u5fc3\u8df3','\x72\x57\x66\x6e\x56':_0x2c70('67','\x57\x53\x39\x64'),'\x59\x57\x50\x59\x4c':function(_0xf51743,_0x4f0dd8,_0x46f34c){return _0xf51743(_0x4f0dd8,_0x46f34c);},'\x6d\x51\x6e\x61\x4d':function(_0x55b06e,_0xbbf5b2){return _0x55b06e==_0xbbf5b2;},'\x79\x4a\x6c\x4a\x4d':function(_0x27da61,_0x56e0bc,_0x499f52){return _0x27da61(_0x56e0bc,_0x499f52);}};if(!HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){if(_0x1bcbdc['\x76\x4b\x63\x65\x45'](_0x1bcbdc[_0x2c70('68','\x28\x5b\x79\x45')],_0x1bcbdc[_0x2c70('69','\x59\x69\x5b\x63')])){return null;}else{HeartGift['\x74\x6f\x74\x61\x6c']=0x0;HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=!![];}}if(_0x1bcbdc[_0x2c70('6a','\x5d\x45\x4e\x32')](BiliPushUtils[_0x2c70('6b','\x30\x29\x26\x4d')],null)){let _0xac5a8d=await HeartGift[_0x2c70('6c','\x58\x25\x25\x4d')](_0x1bcbdc['\x4d\x76\x51\x50\x70'],HeartGift[_0x2c70('6d','\x30\x29\x26\x4d')]);if(_0xac5a8d){if(_0x1bcbdc[_0x2c70('6e','\x6d\x71\x73\x44')](_0x1bcbdc[_0x2c70('6f','\x28\x5b\x79\x45')],_0x1bcbdc['\x68\x55\x52\x48\x4c'])){BiliPushUtils[_0x2c70('70','\x4e\x30\x4e\x37')]=function(_0x19b206,_0x3137d5){return _0xac5a8d[_0x2c70('71','\x4f\x57\x57\x56')](_0x19b206,_0x3137d5);};}else{try{return{'\x76\x61\x6c\x75\x65':r[_0x2c70('72','\x21\x4c\x76\x73')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x214f54){return{'\x65\x72\x72\x6f\x72':_0x214f54,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}else{if(_0x1bcbdc[_0x2c70('73','\x6c\x24\x30\x47')](_0x1bcbdc[_0x2c70('74','\x5d\x45\x4e\x32')],_0x1bcbdc[_0x2c70('75','\x5a\x69\x4c\x74')])){return{'\x76\x61\x6c\x75\x65':r[_0x2c70('76','\x64\x30\x46\x39')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{console[_0x2c70('77','\x7a\x4b\x53\x44')](_0x1bcbdc['\x71\x41\x5a\x78\x4b']);return;}}}let _0xc8f8af=await Gift[_0x2c70('78','\x67\x4f\x63\x4c')]();if(_0xc8f8af&&_0x1bcbdc[_0x2c70('79','\x21\x4c\x76\x73')](_0xc8f8af[_0x2c70('7a','\x25\x6b\x2a\x73')],0x0)){if(_0x1bcbdc[_0x2c70('7b','\x7a\x63\x78\x6d')](_0x1bcbdc[_0x2c70('7c','\x4b\x5e\x4b\x69')],_0x1bcbdc[_0x2c70('7d','\x46\x50\x79\x57')])){var _0x219ae7=Module[_0x2c70('7e','\x4b\x71\x6c\x67')]['\x61\x6c\x6c\x6f\x63'](0x10);Module[_0x2c70('7f','\x4b\x5e\x4b\x69')][_0x2c70('80','\x51\x4e\x33\x40')](_0x219ae7,value);return _0x219ae7;}else{console[_0x2c70('81','\x4d\x26\x47\x28')](_0x1bcbdc[_0x2c70('82','\x78\x71\x61\x43')]);for(let _0x226339 of _0xc8f8af){if(_0x1bcbdc[_0x2c70('83','\x63\x53\x25\x28')](_0x1bcbdc['\x72\x57\x66\x6e\x56'],_0x1bcbdc[_0x2c70('84','\x4b\x71\x6c\x67')])){ref_to_id_map[_0x2c70('85','\x63\x53\x25\x28')](reference,refid);}else{let _0xb0b6f7=await API['\x72\x6f\x6f\x6d'][_0x2c70('86','\x48\x26\x24\x50')](_0x1bcbdc['\x59\x57\x50\x59\x4c'](parseInt,_0x226339['\x72\x6f\x6f\x6d\x69\x64'],0xa));if(_0x1bcbdc[_0x2c70('87','\x47\x55\x50\x61')](_0xb0b6f7[_0x2c70('88','\x6c\x24\x30\x47')],0x0)){console[_0x2c70('89','\x67\x4f\x63\x4c')](_0x2c70('8a','\x4e\x30\x4e\x37')+_0x226339[_0x2c70('8b','\x51\x4e\x33\x40')]+'\x5d\u623f\u95f4\x5b'+_0xb0b6f7[_0x2c70('8c','\x78\x71\x61\x43')][_0x2c70('8d','\x25\x6b\x2a\x73')]+_0x2c70('8e','\x35\x55\x24\x48'));new HeartGiftRoom(_0xb0b6f7[_0x2c70('8f','\x58\x25\x25\x4d')],_0x226339);await _0x1bcbdc[_0x2c70('90','\x7a\x63\x78\x6d')](delayCall,()=>{},0x3e8);}}}}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0x1445d0,_0xd29245){var _0x886c29={'\x45\x56\x46\x51\x59':'\x65\x72\x72\x6f\x72','\x61\x51\x49\x4c\x66':function(_0x3cfcf3,_0xe2ccb0){return _0x3cfcf3!==_0xe2ccb0;},'\x4c\x54\x54\x46\x76':_0x2c70('91','\x40\x4d\x45\x24'),'\x68\x4f\x6a\x49\x57':function(_0x52f9dc,_0x5072e0){return _0x52f9dc!==_0x5072e0;},'\x48\x65\x4b\x79\x6b':_0x2c70('92','\x4f\x57\x57\x56'),'\x71\x57\x77\x75\x66':_0x2c70('93','\x4b\x5e\x4b\x69'),'\x46\x6a\x7a\x54\x59':function(_0x56ce23,_0x23ea98){return _0x56ce23(_0x23ea98);},'\x6b\x79\x64\x4a\x5a':_0x2c70('94','\x63\x53\x25\x28'),'\x59\x75\x57\x67\x41':function(_0x20cb17){return _0x20cb17();},'\x63\x58\x57\x46\x4a':_0x2c70('95','\x49\x6f\x39\x21'),'\x78\x57\x56\x6f\x63':'\x44\x64\x76\x66\x53','\x79\x4d\x43\x57\x6c':_0x2c70('96','\x38\x76\x21\x24'),'\x70\x74\x4c\x49\x4c':function(_0x12140e,_0x468b46,_0x3ef19f){return _0x12140e(_0x468b46,_0x3ef19f);},'\x72\x78\x67\x6f\x43':_0x2c70('97','\x72\x32\x62\x48'),'\x5a\x58\x61\x74\x46':function(_0x19e824,_0x326b2c){return _0x19e824==_0x326b2c;},'\x48\x42\x43\x42\x67':_0x2c70('98','\x46\x50\x79\x57')};var _0x46a0ca=_0x886c29[_0x2c70('99','\x21\x25\x46\x6e')](_0xd29245),_0x1c60b3=_0x886c29['\x70\x74\x4c\x49\x4c'](fetch,_0x1445d0,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x886c29['\x72\x78\x67\x6f\x43']});return(_0x886c29[_0x2c70('9a','\x54\x4c\x24\x40')](_0x886c29[_0x2c70('9b','\x47\x55\x50\x61')],typeof window[_0x2c70('9c','\x63\x4a\x67\x45')][_0x2c70('9d','\x44\x46\x72\x69')])?window[_0x2c70('9e','\x62\x32\x54\x2a')][_0x2c70('9f','\x35\x24\x67\x66')](_0x1c60b3,_0x46a0ca['\x69\x6d\x70\x6f\x72\x74\x73'])[_0x2c70('a0','\x56\x4b\x47\x68')](function(_0x1445d0){var _0x2b8265={'\x79\x5a\x47\x78\x62':_0x886c29['\x45\x56\x46\x51\x59']};if(_0x886c29[_0x2c70('a1','\x5a\x69\x4c\x74')](_0x886c29['\x4c\x54\x54\x46\x76'],_0x886c29[_0x2c70('a2','\x4e\x26\x68\x2a')])){console['\x6c\x6f\x67'](_0x2b8265['\x79\x5a\x47\x78\x62'],_0xd29245);}else{return _0x1445d0[_0x2c70('a3','\x48\x26\x24\x50')];}}):_0x1c60b3['\x74\x68\x65\x6e'](function(_0x1445d0){if(_0x886c29[_0x2c70('a4','\x6d\x71\x73\x44')](_0x886c29[_0x2c70('a5','\x46\x50\x79\x57')],_0x886c29['\x48\x65\x4b\x79\x6b'])){return window[_0x2c70('a6','\x56\x4b\x47\x68')][_0x2c70('a7','\x35\x55\x24\x48')](_0x1445d0);}else{return _0x1445d0[_0x2c70('a8','\x46\x50\x79\x57')]();}})['\x74\x68\x65\x6e'](function(_0x1445d0){return window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x2c70('a9','\x54\x4c\x24\x40')](_0x1445d0);})[_0x2c70('aa','\x59\x69\x5b\x63')](function(_0x1445d0){var _0x311cc5={'\x47\x57\x45\x75\x78':_0x886c29[_0x2c70('ab','\x35\x55\x24\x48')],'\x73\x78\x62\x41\x6c':function(_0x49bc89,_0x31f2c3){return _0x886c29['\x46\x6a\x7a\x54\x59'](_0x49bc89,_0x31f2c3);},'\x79\x49\x76\x43\x6e':_0x886c29['\x6b\x79\x64\x4a\x5a'],'\x61\x41\x72\x78\x4d':function(_0x2110f1){return _0x886c29[_0x2c70('ac','\x54\x4c\x24\x40')](_0x2110f1);}};if(_0x886c29['\x68\x4f\x6a\x49\x57'](_0x886c29[_0x2c70('ad','\x47\x55\x50\x61')],_0x886c29[_0x2c70('ae','\x30\x29\x26\x4d')])){return window[_0x2c70('af','\x6c\x57\x31\x41')][_0x2c70('b0','\x77\x71\x76\x45')](_0x1445d0,_0x46a0ca[_0x2c70('b1','\x4e\x26\x68\x2a')]);}else{var _0x24b636=_0x311cc5['\x47\x57\x45\x75\x78'][_0x2c70('42','\x25\x6b\x2a\x73')]('\x7c'),_0x3db71f=0x0;while(!![]){switch(_0x24b636[_0x3db71f++]){case'\x30':this[_0x2c70('b2','\x63\x53\x25\x28')]=info[_0x2c70('b3','\x77\x71\x76\x45')];continue;case'\x31':;continue;case'\x32':this['\x75\x61']=window&&window[_0x2c70('b4','\x57\x53\x39\x64')]?window[_0x2c70('b5','\x46\x50\x79\x57')][_0x2c70('b6','\x77\x71\x76\x45')]:'';continue;case'\x33':this[_0x2c70('b7','\x25\x6b\x2a\x73')]=medal;continue;case'\x34':this['\x62\x75\x76\x69\x64']=_0x311cc5[_0x2c70('b8','\x67\x70\x57\x55')](getCookie,_0x311cc5[_0x2c70('b9','\x47\x55\x50\x61')]);continue;case'\x35':this[_0x2c70('ba','\x58\x25\x25\x4d')]();continue;case'\x36':this[_0x2c70('bb','\x4b\x71\x6c\x67')]=_0x311cc5[_0x2c70('bc','\x35\x55\x24\x48')](UUID);continue;case'\x37':this[_0x2c70('bd','\x48\x26\x24\x50')]=0x0;continue;case'\x38':this[_0x2c70('be','\x4f\x57\x57\x56')]=new Date();continue;case'\x39':this['\x69\x6e\x66\x6f']=info;continue;case'\x31\x30':this[_0x2c70('bf','\x5d\x45\x4e\x32')]=info['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x31\x31':this['\x61\x72\x65\x61\x5f\x69\x64']=info['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'];continue;case'\x31\x32':this[_0x2c70('c0','\x59\x69\x5b\x63')]=0x0;continue;}break;}}}))['\x74\x68\x65\x6e'](function(_0x1445d0){return _0x46a0ca['\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65'](_0x1445d0);})[_0x2c70('c1','\x62\x66\x34\x55')](function(_0x1445d0){throw console[_0x2c70('c2','\x78\x71\x61\x43')](_0x886c29[_0x2c70('c3','\x5d\x45\x4e\x32')],_0x1445d0),_0x1445d0;});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x53f1b3={'\x47\x6e\x74\x45\x7a':function(_0x513797,_0x38e601){return _0x513797 instanceof _0x38e601;},'\x52\x4a\x76\x52\x5a':function(_0x480e8e,_0x4d1211){return _0x480e8e===_0x4d1211;},'\x55\x4b\x4e\x51\x41':_0x2c70('c4','\x4e\x30\x4e\x37'),'\x6f\x49\x7a\x4e\x47':function(_0x1bb006,_0x366d39){return _0x1bb006<_0x366d39;},'\x55\x54\x4c\x65\x58':function(_0x54483a,_0x5dc409){return _0x54483a>=_0x5dc409;},'\x70\x49\x53\x77\x6a':function(_0x422573,_0x25b30c){return _0x422573<=_0x25b30c;},'\x61\x7a\x44\x45\x43':function(_0x4108e9,_0x33049d){return _0x4108e9|_0x33049d;},'\x6b\x57\x50\x57\x6b':function(_0x1577e3,_0x18b59d){return _0x1577e3+_0x18b59d;},'\x6b\x6c\x55\x64\x64':function(_0x1a7843,_0xf4f8bc){return _0x1a7843<<_0xf4f8bc;},'\x48\x45\x47\x45\x46':function(_0x50f5ca,_0x4100d9){return _0x50f5ca&_0x4100d9;},'\x66\x71\x44\x50\x70':function(_0x54f7b1,_0x4c01ed){return _0x54f7b1&_0x4c01ed;},'\x48\x51\x72\x77\x67':function(_0x56d109,_0xb1e55e){return _0x56d109<=_0xb1e55e;},'\x55\x79\x6a\x58\x6f':function(_0x2d9edf,_0x5adcbe){return _0x2d9edf<=_0x5adcbe;},'\x4a\x63\x56\x48\x71':function(_0x12670a,_0x1b4569){return _0x12670a|_0x1b4569;},'\x67\x76\x4f\x59\x5a':function(_0x1a3327,_0xca144c){return _0x1a3327>>_0xca144c;},'\x55\x52\x52\x73\x44':function(_0x1882b6,_0x509bab){return _0x1882b6|_0x509bab;},'\x67\x52\x65\x57\x79':function(_0x3a2cad,_0x331b0d){return _0x3a2cad<=_0x331b0d;},'\x57\x74\x47\x44\x7a':function(_0x42b466,_0xe3e325){return _0x42b466!==_0xe3e325;},'\x68\x69\x66\x4c\x4e':_0x2c70('c5','\x23\x62\x71\x78'),'\x49\x66\x49\x69\x4c':_0x2c70('c6','\x58\x25\x25\x4d'),'\x6b\x54\x42\x47\x63':function(_0x428c56,_0x4fac4b){return _0x428c56&_0x4fac4b;},'\x50\x4e\x6f\x64\x62':function(_0x2e639b,_0x5908fb){return _0x2e639b>>_0x5908fb;},'\x55\x76\x72\x54\x45':function(_0x3b0dc7,_0x561238){return _0x3b0dc7>>_0x561238;},'\x4d\x46\x57\x63\x72':function(_0x27c8d3,_0x3738ef){return _0x27c8d3|_0x3738ef;},'\x65\x44\x6d\x6a\x73':function(_0x40ed62,_0x148036){return _0x40ed62>>_0x148036;},'\x6f\x6e\x61\x7a\x50':function(_0x380cc3,_0x27f635){return _0x380cc3|_0x27f635;},'\x61\x51\x53\x54\x6f':function(_0x278dea,_0x5bbd9d){return _0x278dea|_0x5bbd9d;},'\x4d\x4a\x4c\x69\x75':_0x2c70('c7','\x77\x71\x76\x45'),'\x46\x65\x75\x73\x47':function(_0x410ce0,_0x1123de){return _0x410ce0>>_0x1123de;},'\x6b\x63\x4a\x48\x63':function(_0x85b9d,_0x50e5e3){return _0x85b9d&_0x50e5e3;},'\x5a\x71\x6b\x47\x4b':function(_0x3333d9,_0x4d175d){return _0x3333d9>>_0x4d175d;},'\x53\x7a\x70\x4c\x52':function(_0x1434fe,_0x40f5f6){return _0x1434fe|_0x40f5f6;},'\x50\x4b\x4a\x5a\x6b':function(_0x5f01cf,_0x3f1c76){return _0x5f01cf>>_0x3f1c76;},'\x48\x48\x58\x68\x6e':function(_0x362d01,_0x31be4f){return _0x362d01>>_0x31be4f;},'\x6a\x4b\x6e\x65\x47':_0x2c70('c8','\x4f\x57\x57\x56'),'\x44\x41\x70\x4a\x47':function(_0x205e1a,_0x19fc60){return _0x205e1a|_0x19fc60;},'\x52\x65\x78\x4a\x58':function(_0x5f5460,_0x3e8756){return _0x5f5460&_0x3e8756;},'\x4c\x43\x79\x6e\x77':function(_0xd3d73,_0x21367c){return _0xd3d73|_0x21367c;},'\x49\x49\x62\x58\x67':function(_0x294817,_0x47b1a1){return _0x294817&_0x47b1a1;},'\x64\x4c\x4d\x6e\x63':function(_0x5f4bd1,_0x2292b8){return _0x5f4bd1>>_0x2292b8;},'\x41\x51\x57\x7a\x44':function(_0x2c7615,_0x31336f){return _0x2c7615&_0x31336f;},'\x78\x49\x59\x74\x53':function(_0x4d5e98,_0x2e0ee3){return _0x4d5e98|_0x2e0ee3;},'\x58\x71\x46\x72\x4f':function(_0x3286ad,_0x1bca68){return _0x3286ad&_0x1bca68;},'\x63\x47\x78\x44\x73':function(_0x2e35cb,_0x57e0b5){return _0x2e35cb>>_0x57e0b5;},'\x4a\x6f\x54\x69\x44':function(_0x477dca,_0x5d5686){return _0x477dca!=_0x5d5686;},'\x54\x44\x6e\x73\x71':'\x77\x4f\x4d\x50\x68','\x52\x63\x55\x49\x53':function(_0x1d3f40,_0xcff8e6){return _0x1d3f40==_0xcff8e6;},'\x53\x41\x50\x5a\x49':_0x2c70('c9','\x38\x76\x21\x24'),'\x55\x45\x44\x45\x4d':'\x30\x7c\x32\x7c\x31\x7c\x33\x7c\x34','\x51\x4c\x4f\x49\x72':function(_0x1ea6e2,_0x1c7cf6){return _0x1ea6e2/_0x1c7cf6;},'\x72\x4a\x4b\x71\x47':function(_0x418b5d,_0x4dc1b9){return _0x418b5d*_0x4dc1b9;},'\x4d\x69\x72\x78\x77':function(_0x3a21eb,_0x3c3cce){return _0x3a21eb/_0x3c3cce;},'\x6f\x64\x7a\x73\x4b':function(_0x97887d,_0x17e18e){return _0x97887d*_0x17e18e;},'\x4d\x7a\x73\x51\x47':function(_0x148c3f,_0x2c77fb){return _0x148c3f/_0x2c77fb;},'\x66\x4e\x4f\x65\x68':function(_0x599db1,_0x1ac142){return _0x599db1/_0x1ac142;},'\x51\x6e\x58\x57\x57':_0x2c70('ca','\x39\x40\x64\x28'),'\x77\x51\x7a\x70\x52':function(_0x546ff7,_0x211b64){return _0x546ff7===_0x211b64;},'\x42\x47\x48\x69\x6e':_0x2c70('cb','\x28\x5b\x79\x45'),'\x78\x6a\x51\x75\x72':_0x2c70('cc','\x49\x2a\x53\x35'),'\x6d\x4d\x48\x6c\x4f':_0x2c70('cd','\x4a\x4e\x35\x6b'),'\x73\x42\x66\x45\x76':function(_0x38ffff,_0x30ab85){return _0x38ffff>>_0x30ab85;},'\x68\x55\x71\x76\x51':_0x2c70('ce','\x62\x32\x54\x2a'),'\x6f\x4e\x6a\x7a\x4c':_0x2c70('cf','\x38\x76\x21\x24'),'\x62\x6c\x77\x4e\x50':'\x64\x70\x73\x73\x4a','\x69\x66\x4a\x65\x59':function(_0x27a539,_0x47b273){return _0x27a539===_0x47b273;},'\x49\x56\x7a\x56\x54':_0x2c70('d0','\x4a\x4e\x35\x6b'),'\x4c\x66\x76\x4b\x7a':_0x2c70('d1','\x67\x4f\x63\x4c'),'\x5a\x48\x42\x4c\x53':_0x2c70('d2','\x4d\x26\x47\x28'),'\x49\x6d\x45\x75\x70':_0x2c70('d3','\x30\x29\x26\x4d'),'\x58\x65\x6d\x58\x5a':function(_0x1b2b67,_0x25deef){return _0x1b2b67===_0x25deef;},'\x71\x43\x50\x4d\x62':_0x2c70('d4','\x4d\x26\x47\x28'),'\x4f\x55\x71\x46\x6f':_0x2c70('d5','\x63\x53\x25\x28'),'\x61\x64\x68\x66\x6c':function(_0x49c21f,_0x277516){return _0x49c21f===_0x277516;},'\x64\x4e\x76\x4b\x70':_0x2c70('d6','\x21\x4c\x76\x73'),'\x57\x48\x51\x6c\x51':function(_0x10ecd,_0x5c1206){return _0x10ecd===_0x5c1206;},'\x63\x4d\x7a\x64\x55':function(_0x44983a,_0x48d549){return _0x44983a===_0x48d549;},'\x72\x59\x46\x53\x6d':'\x48\x78\x71\x72\x4e','\x4e\x53\x65\x51\x52':function(_0x5ab42e,_0x58307a){return _0x5ab42e===_0x58307a;},'\x6b\x56\x67\x54\x65':_0x2c70('d7','\x30\x29\x26\x4d'),'\x4b\x50\x59\x5a\x42':_0x2c70('d8','\x35\x55\x24\x48'),'\x61\x45\x65\x79\x59':_0x2c70('d9','\x39\x40\x64\x28'),'\x42\x4f\x76\x75\x62':function(_0x1b3f18,_0x294c7a){return _0x1b3f18===_0x294c7a;},'\x4b\x51\x7a\x57\x52':_0x2c70('da','\x44\x46\x72\x69'),'\x57\x58\x48\x4e\x42':'\x66\x53\x69\x53\x78','\x61\x57\x53\x53\x4e':function(_0x5f2f8f,_0x418835){return _0x5f2f8f&_0x418835;},'\x6c\x4f\x59\x54\x45':function(_0x5aa40c,_0x5e7fb2){return _0x5aa40c>>_0x5e7fb2;},'\x50\x72\x70\x73\x58':_0x2c70('db','\x69\x4f\x64\x63'),'\x41\x4d\x77\x6c\x69':function(_0x7db456,_0x3f6aff){return _0x7db456+_0x3f6aff;},'\x65\x69\x4c\x46\x76':function(_0x3b9671,_0x1b6bfb){return _0x3b9671===_0x1b6bfb;},'\x70\x74\x6b\x62\x65':function(_0x541356,_0x659922){return _0x541356===_0x659922;},'\x58\x71\x72\x45\x49':function(_0x4782d5,_0x2774aa){return _0x4782d5!==_0x2774aa;},'\x59\x6f\x6b\x49\x47':_0x2c70('dc','\x4b\x71\x6c\x67'),'\x51\x6b\x41\x78\x49':'\x79\x54\x48\x68\x50','\x79\x41\x68\x6b\x4b':function(_0x3b3886,_0xe61951){return _0x3b3886/_0xe61951;},'\x61\x6b\x6a\x5a\x58':function(_0x4bc91a,_0x593393){return _0x4bc91a+_0x593393;},'\x5a\x45\x54\x50\x49':function(_0x4801de,_0x1c31a9){return _0x4801de!==_0x1c31a9;},'\x58\x77\x59\x72\x55':'\x4e\x73\x58\x51\x5a','\x57\x6c\x6c\x63\x4b':function(_0x4182e6,_0x5d4d3e){return _0x4182e6+_0x5d4d3e;},'\x46\x61\x4c\x70\x77':function(_0x553605,_0x495441){return _0x553605!==_0x495441;},'\x41\x68\x57\x4a\x51':_0x2c70('dd','\x72\x32\x62\x48'),'\x65\x64\x48\x58\x64':function(_0x8ee2a1,_0x1ac11b){return _0x8ee2a1+_0x1ac11b;},'\x79\x70\x6d\x72\x50':function(_0x58e3d6,_0x5d5d62){return _0x58e3d6*_0x5d5d62;},'\x6e\x43\x55\x49\x51':function(_0x5ab9e2,_0x3cc661){return _0x5ab9e2===_0x3cc661;},'\x4e\x46\x73\x5a\x50':function(_0x2e2d11,_0x320239){return _0x2e2d11===_0x320239;},'\x49\x46\x64\x42\x66':_0x2c70('de','\x67\x70\x57\x55'),'\x66\x45\x7a\x59\x70':_0x2c70('df','\x62\x32\x54\x2a'),'\x69\x46\x4b\x57\x68':_0x2c70('e0','\x35\x24\x67\x66'),'\x6c\x4c\x61\x4b\x72':function(_0x29994c,_0x2bde3d){return _0x29994c+_0x2bde3d;},'\x65\x42\x4f\x73\x43':function(_0x3ef65a,_0x85cbb0){return _0x3ef65a+_0x85cbb0;},'\x54\x63\x6d\x76\x53':function(_0x38de1a,_0x3a8fc5){return _0x38de1a/_0x3a8fc5;},'\x54\x57\x55\x64\x4c':function(_0x462edf,_0x4c9d85){return _0x462edf<_0x4c9d85;},'\x69\x75\x4d\x4f\x77':_0x2c70('e1','\x72\x49\x33\x6a'),'\x59\x6b\x4d\x74\x4e':function(_0x40433d,_0x43f573){return _0x40433d/_0x43f573;},'\x62\x55\x61\x41\x4a':function(_0x1858d6,_0x43718d){return _0x1858d6*_0x43718d;},'\x56\x77\x73\x47\x49':function(_0x121a6f,_0x47b605){return _0x121a6f/_0x47b605;},'\x77\x44\x64\x53\x77':function(_0x14d4bb,_0x7bfaf7){return _0x14d4bb===_0x7bfaf7;},'\x50\x42\x4a\x62\x52':function(_0xf5b84,_0x2ebfbf){return _0xf5b84===_0x2ebfbf;},'\x78\x41\x50\x70\x7a':function(_0xdace0b,_0xeb96d7){return _0xdace0b!==_0xeb96d7;},'\x4c\x51\x4c\x54\x71':_0x2c70('e2','\x6d\x71\x73\x44'),'\x51\x71\x41\x72\x70':_0x2c70('e3','\x40\x4d\x45\x24'),'\x67\x4d\x77\x75\x42':function(_0x5868f5,_0x1be2be){return _0x5868f5+_0x1be2be;},'\x71\x7a\x69\x4d\x55':_0x2c70('e4','\x4a\x4e\x35\x6b'),'\x6d\x51\x6e\x72\x64':'\x33\x7c\x32\x7c\x30\x7c\x34\x7c\x31','\x43\x43\x43\x4d\x49':function(_0x4d3538,_0x5a831d){return _0x4d3538/_0x5a831d;},'\x43\x53\x68\x52\x72':function(_0x15098e,_0x571770){return _0x15098e+_0x571770;},'\x41\x79\x6a\x6b\x51':function(_0x378a52,_0x1ef22e){return _0x378a52+_0x1ef22e;},'\x74\x72\x41\x4b\x72':function(_0x76a057,_0x56ef99){return _0x76a057/_0x56ef99;},'\x45\x58\x6e\x43\x56':function(_0x240bb6,_0x16cfdb){return _0x240bb6===_0x16cfdb;},'\x49\x5a\x54\x6e\x68':_0x2c70('e5','\x64\x30\x46\x39'),'\x55\x45\x69\x59\x78':_0x2c70('e6','\x48\x26\x24\x50'),'\x52\x52\x6e\x54\x54':function(_0x4061a7,_0xea5956){return _0x4061a7*_0xea5956;},'\x55\x43\x67\x4a\x4e':function(_0x4d50c1,_0x16cd4e){return _0x4d50c1*_0x16cd4e;},'\x54\x5a\x7a\x6f\x5a':function(_0x4df2dc,_0xeec3b2){return _0x4df2dc+_0xeec3b2;},'\x4f\x75\x48\x47\x58':function(_0x2c64c0,_0x173e8d){return _0x2c64c0+_0x173e8d;},'\x72\x4a\x74\x4d\x69':'\x4e\x4b\x68\x4c\x52','\x46\x4e\x50\x76\x46':_0x2c70('e7','\x44\x46\x72\x69'),'\x65\x59\x67\x4b\x69':function(_0x438c30,_0x50c451){return _0x438c30+_0x50c451;},'\x70\x4c\x61\x67\x68':function(_0x246253,_0x75623e){return _0x246253*_0x75623e;},'\x47\x6c\x4a\x79\x45':function(_0x2aa721,_0x3920da){return _0x2aa721*_0x3920da;},'\x76\x49\x47\x51\x45':'\x34\x7c\x30\x7c\x35\x7c\x31\x7c\x32\x7c\x33','\x42\x70\x55\x65\x73':function(_0x3ac742,_0x52dab1){return _0x3ac742*_0x52dab1;},'\x69\x4f\x72\x66\x61':function(_0x46aaca,_0x42a58b){return _0x46aaca/_0x42a58b;},'\x41\x78\x4c\x55\x68':function(_0x45c611,_0x19aec6){return _0x45c611+_0x19aec6;},'\x59\x7a\x77\x6b\x42':function(_0x2c04a0,_0x1129e2){return _0x2c04a0+_0x1129e2;},'\x78\x77\x46\x57\x43':function(_0x372e77,_0x1952d5){return _0x372e77>_0x1952d5;},'\x75\x61\x56\x74\x79':function(_0x3b43f3,_0x2cca86){return _0x3b43f3!==_0x2cca86;},'\x79\x6a\x4c\x44\x46':_0x2c70('e8','\x44\x46\x72\x69'),'\x46\x49\x46\x5a\x55':function(_0x2ba47a,_0x4ab6a7){return _0x2ba47a/_0x4ab6a7;},'\x69\x47\x4e\x57\x64':function(_0x3a147e,_0x132e3e){return _0x3a147e/_0x132e3e;},'\x64\x6d\x63\x75\x4a':function(_0x4ee480,_0x49290f){return _0x4ee480+_0x49290f;},'\x4f\x68\x48\x55\x6a':function(_0x325a28,_0x5e3860){return _0x325a28>_0x5e3860;},'\x52\x54\x7a\x42\x58':_0x2c70('e9','\x72\x49\x33\x6a'),'\x74\x6a\x73\x5a\x66':'\x74\x4b\x4e\x4f\x47','\x6e\x68\x6c\x69\x72':function(_0x43eb8a,_0x4c0d1c){return _0x43eb8a/_0x4c0d1c;},'\x76\x6a\x65\x67\x70':function(_0x50b934,_0x11ea87){return _0x50b934+_0x11ea87;},'\x4d\x51\x71\x70\x51':'\x31\x7c\x33\x7c\x30\x7c\x34\x7c\x32','\x77\x50\x70\x6c\x69':function(_0x8e4b64,_0x1f76a9){return _0x8e4b64+_0x1f76a9;},'\x65\x73\x5a\x78\x6d':function(_0x11c8e2,_0x489c43){return _0x11c8e2/_0x489c43;},'\x61\x70\x4c\x47\x70':function(_0x3b294e,_0x5b844e){return _0x3b294e<_0x5b844e;},'\x42\x4f\x53\x70\x71':function(_0x491c71,_0x255a1c){return _0x491c71+_0x255a1c;},'\x73\x6e\x54\x50\x4c':function(_0xb06fc3,_0x35b0c7){return _0xb06fc3*_0x35b0c7;},'\x61\x70\x54\x72\x75':function(_0x2bebb6,_0x57247f){return _0x2bebb6+_0x57247f;},'\x61\x70\x75\x6e\x78':function(_0x449cb6,_0x439852){return _0x449cb6!==_0x439852;},'\x79\x56\x55\x48\x50':_0x2c70('ea','\x4e\x26\x68\x2a'),'\x65\x56\x67\x4c\x73':_0x2c70('eb','\x7a\x4b\x53\x44'),'\x53\x68\x78\x53\x4b':function(_0x5b1331,_0x31ebb3){return _0x5b1331+_0x31ebb3;},'\x7a\x63\x43\x6d\x51':function(_0x310295,_0x471c3e){return _0x310295===_0x471c3e;},'\x70\x54\x53\x42\x43':_0x2c70('ec','\x6d\x71\x73\x44'),'\x6d\x55\x70\x65\x73':function(_0x1b34f6,_0x2e824b){return _0x1b34f6!==_0x2e824b;},'\x41\x7a\x54\x57\x4a':_0x2c70('ed','\x47\x55\x50\x61'),'\x70\x62\x62\x73\x48':function(_0x102e21,_0x374c5){return _0x102e21===_0x374c5;},'\x41\x59\x6e\x58\x76':_0x2c70('ee','\x72\x49\x33\x6a'),'\x69\x44\x48\x68\x4b':_0x2c70('ef','\x5d\x45\x4e\x32'),'\x67\x46\x61\x44\x73':function(_0xb66ad0,_0x43b1c9){return _0xb66ad0+_0x43b1c9;},'\x77\x46\x6e\x7a\x69':function(_0x1f671d,_0x39d183){return _0x1f671d+_0x39d183;},'\x44\x41\x4e\x76\x77':_0x2c70('f0','\x62\x66\x34\x55'),'\x4a\x72\x4a\x54\x79':'\x61\x67\x48\x48\x57','\x64\x76\x47\x63\x48':function(_0x40d231,_0x3f86a0){return _0x40d231===_0x3f86a0;},'\x7a\x79\x4f\x51\x58':_0x2c70('f1','\x48\x26\x24\x50'),'\x54\x41\x64\x72\x49':_0x2c70('f2','\x49\x2a\x53\x35'),'\x73\x6d\x74\x51\x51':_0x2c70('f3','\x54\x4c\x24\x40'),'\x7a\x5a\x75\x66\x42':function(_0xe7aa78,_0x45e778){return _0xe7aa78/_0x45e778;},'\x5a\x52\x73\x52\x78':function(_0x13861f,_0x5eb524){return _0x13861f!==_0x5eb524;},'\x55\x74\x4c\x67\x77':_0x2c70('f4','\x63\x53\x25\x28'),'\x41\x5a\x63\x67\x4b':function(_0x6f915f,_0x419260){return _0x6f915f+_0x419260;},'\x65\x4f\x49\x67\x67':function(_0x1a07df,_0x4034b1){return _0x1a07df+_0x4034b1;},'\x67\x61\x70\x78\x68':_0x2c70('f5','\x51\x4e\x33\x40'),'\x74\x52\x6f\x58\x78':function(_0x501358,_0x184ca8){return _0x501358|_0x184ca8;},'\x41\x4e\x59\x54\x54':function(_0x2af288,_0x340ca6){return _0x2af288&_0x340ca6;},'\x47\x4a\x52\x58\x75':function(_0x398a48,_0x276bf2){return _0x398a48<_0x276bf2;},'\x56\x49\x4f\x73\x68':function(_0x4730d0,_0xf6f5ef){return _0x4730d0!==_0xf6f5ef;},'\x6d\x6d\x61\x4c\x44':_0x2c70('f6','\x7a\x63\x78\x6d'),'\x53\x42\x41\x5a\x45':function(_0x17b78d,_0x433ea7){return _0x17b78d<<_0x433ea7;},'\x4b\x6d\x78\x52\x52':function(_0x32dc44,_0x2dd53f){return _0x32dc44<<_0x2dd53f;},'\x6a\x68\x6a\x43\x4f':function(_0x3a8d9c,_0x323cd9){return _0x3a8d9c&_0x323cd9;},'\x6d\x43\x79\x57\x44':function(_0x3a48a4,_0x12e124){return _0x3a48a4&_0x12e124;},'\x4e\x77\x66\x46\x70':function(_0x22e173,_0x4ebcda){return _0x22e173|_0x4ebcda;},'\x6c\x71\x72\x6b\x74':function(_0x146fdf,_0x2fa977){return _0x146fdf<<_0x2fa977;},'\x49\x64\x73\x4f\x6f':function(_0x4cc374,_0x11152c){return _0x4cc374!==_0x11152c;},'\x75\x50\x61\x5a\x72':'\x78\x4a\x69\x4c\x5a','\x69\x58\x44\x42\x4c':_0x2c70('f7','\x6d\x71\x73\x44'),'\x72\x44\x66\x51\x63':function(_0x17842b,_0x553587){return _0x17842b|_0x553587;},'\x46\x52\x78\x68\x51':function(_0x68a79c,_0x2d14c1){return _0x68a79c|_0x2d14c1;},'\x66\x7a\x51\x4f\x78':function(_0x399a4d,_0x18c289){return _0x399a4d<<_0x18c289;},'\x6f\x7a\x78\x70\x4c':function(_0x2671a1,_0x2a1b){return _0x2671a1&_0x2a1b;},'\x59\x56\x41\x76\x54':function(_0x2739a0,_0x43cc31){return _0x2739a0>>_0x43cc31;},'\x67\x5a\x6f\x58\x4d':function(_0x17620a,_0x518b17){return _0x17620a+_0x518b17;},'\x6f\x4a\x75\x53\x41':function(_0x4ef815,_0x584cbe){return _0x4ef815&_0x584cbe;},'\x68\x65\x70\x5a\x72':_0x2c70('f8','\x23\x62\x71\x78'),'\x71\x47\x41\x4d\x65':function(_0x460ca7,_0xf8a3b7){return _0x460ca7|_0xf8a3b7;},'\x6c\x44\x64\x47\x67':function(_0x398061,_0x40188e){return _0x398061>>_0x40188e;},'\x6b\x52\x64\x70\x4a':function(_0x537b5b,_0x33141){return _0x537b5b|_0x33141;},'\x57\x63\x55\x69\x53':function(_0x34d653,_0x1a2cea){return _0x34d653&_0x1a2cea;},'\x53\x67\x72\x41\x67':function(_0x28ce5d,_0x4b62c5){return _0x28ce5d&_0x4b62c5;},'\x4c\x66\x6e\x59\x66':function(_0x4d745a,_0x2e8d84){return _0x4d745a|_0x2e8d84;},'\x61\x68\x42\x4e\x69':function(_0x217c19,_0x49fbae){return _0x217c19+_0x49fbae;},'\x70\x50\x6f\x78\x4a':function(_0x32e507,_0x169226){return _0x32e507!==_0x169226;},'\x75\x54\x5a\x6f\x74':_0x2c70('f9','\x4f\x57\x57\x56'),'\x55\x6f\x46\x65\x56':_0x2c70('fa','\x72\x32\x62\x48'),'\x5a\x4a\x41\x49\x52':function(_0x3140b6,_0x9a5ac4){return _0x3140b6===_0x9a5ac4;},'\x5a\x54\x4d\x74\x54':function(_0x1a80d3,_0x3ca149){return _0x1a80d3===_0x3ca149;},'\x53\x4d\x47\x70\x45':function(_0x5d5fb3,_0x451fa2){return _0x5d5fb3===_0x451fa2;},'\x63\x75\x6a\x41\x79':_0x2c70('fb','\x68\x4c\x57\x61'),'\x45\x75\x79\x44\x52':'\x46\x6c\x47\x73\x73','\x6b\x66\x66\x49\x58':function(_0x5631b3,_0xcbdb93){return _0x5631b3===_0xcbdb93;},'\x59\x48\x42\x69\x47':_0x2c70('fc','\x62\x66\x34\x55'),'\x49\x56\x62\x4f\x46':_0x2c70('fd','\x62\x32\x54\x2a'),'\x58\x57\x59\x6f\x46':function(_0x117c76,_0x127da9){return _0x117c76===_0x127da9;},'\x59\x53\x48\x42\x4a':_0x2c70('fe','\x25\x6b\x2a\x73'),'\x53\x41\x6b\x6b\x73':function(_0x57b109,_0x133a1d){return _0x57b109 in _0x133a1d;},'\x4f\x4a\x4c\x52\x65':function(_0x2062b9,_0x565a47){return _0x2062b9==_0x565a47;},'\x4a\x4e\x7a\x73\x62':function(_0x3f5db4,_0x41826d){return _0x3f5db4!==_0x41826d;},'\x42\x64\x79\x6b\x61':'\x41\x74\x55\x70\x4a','\x65\x4d\x4c\x72\x47':'\x32\x7c\x34\x7c\x33\x7c\x31\x7c\x35\x7c\x30','\x52\x62\x63\x62\x4f':'\x74\x6c\x4b\x75\x4b','\x6c\x63\x6f\x43\x7a':function(_0x2bfe94,_0x133eb5){return _0x2bfe94+_0x133eb5;},'\x6d\x6d\x51\x75\x49':function(_0x357486,_0x281269){return _0x357486/_0x281269;},'\x7a\x45\x52\x6f\x42':function(_0x10e99a,_0x3ec980){return _0x10e99a!==_0x3ec980;},'\x74\x77\x4e\x46\x74':_0x2c70('ff','\x63\x4a\x67\x45'),'\x53\x5a\x59\x5a\x42':_0x2c70('100','\x25\x6b\x2a\x73'),'\x6a\x5a\x6f\x42\x42':function(_0x451ec4,_0x488a97){return _0x451ec4|_0x488a97;},'\x56\x75\x53\x76\x66':function(_0xc823bf,_0x215cf8){return _0xc823bf&_0x215cf8;},'\x43\x4b\x45\x54\x66':function(_0x40f183,_0xf9bed2){return _0x40f183<_0xf9bed2;},'\x73\x74\x6a\x6c\x6f':function(_0x2031fe,_0x28a33d){return _0x2031fe|_0x28a33d;},'\x7a\x53\x54\x59\x4b':function(_0x466d7e,_0x38ea79){return _0x466d7e<<_0x38ea79;},'\x6e\x6d\x4c\x55\x4f':function(_0x1a9b26,_0x27c9e6){return _0x1a9b26&_0x27c9e6;},'\x6f\x64\x55\x4e\x4d':function(_0x492d23,_0xb85b55){return _0x492d23<=_0xb85b55;},'\x53\x56\x65\x70\x41':'\x79\x77\x4a\x78\x50','\x75\x44\x63\x76\x41':function(_0x15bf8e,_0x2802c0){return _0x15bf8e!==_0x2802c0;},'\x53\x4c\x76\x71\x72':'\x69\x6e\x79\x64\x6e','\x45\x56\x6a\x72\x73':function(_0x3cbf21,_0x2eec47){return _0x3cbf21<=_0x2eec47;},'\x78\x63\x6a\x66\x50':_0x2c70('101','\x21\x4c\x76\x73'),'\x72\x67\x61\x61\x69':'\x39\x7c\x31\x32\x7c\x31\x35\x7c\x35\x7c\x37\x7c\x32\x7c\x31\x31\x7c\x36\x7c\x31\x7c\x31\x34\x7c\x31\x30\x7c\x30\x7c\x31\x36\x7c\x31\x33\x7c\x33\x7c\x38\x7c\x34','\x4d\x55\x79\x75\x6c':_0x2c70('102','\x23\x62\x71\x78'),'\x4e\x69\x62\x59\x49':_0x2c70('103','\x67\x70\x57\x55'),'\x45\x53\x6b\x76\x6e':'\x75\x61\x59\x46\x4f','\x64\x4b\x51\x77\x4c':_0x2c70('104','\x49\x6f\x39\x21'),'\x41\x67\x4c\x77\x43':function(_0xb6c86,_0x4fa79a){return _0xb6c86+_0x4fa79a;},'\x55\x71\x54\x49\x6a':function(_0x1d3cb8,_0x23300f){return _0x1d3cb8*_0x23300f;},'\x67\x4b\x54\x67\x77':function(_0x4ebb59,_0x2b6d55){return _0x4ebb59===_0x2b6d55;},'\x61\x63\x57\x74\x70':_0x2c70('105','\x5d\x45\x4e\x32'),'\x47\x62\x69\x45\x50':function(_0x5365e5,_0x2cd404){return _0x5365e5+_0x2cd404;},'\x53\x62\x44\x55\x4d':function(_0x1e292a,_0x972d2c){return _0x1e292a===_0x972d2c;},'\x75\x51\x56\x79\x54':'\x55\x4a\x76\x75\x69','\x65\x58\x6c\x55\x4b':'\x32\x7c\x35\x7c\x33\x7c\x34\x7c\x31\x7c\x30','\x4c\x4c\x73\x72\x4c':function(_0x3f3477,_0x2e4bba){return _0x3f3477+_0x2e4bba;},'\x78\x50\x47\x6a\x4c':function(_0x2848df,_0x4d4b04){return _0x2848df>_0x4d4b04;},'\x49\x69\x75\x70\x75':function(_0x25ba8c,_0x2e98c3){return _0x25ba8c instanceof _0x2e98c3;},'\x76\x4d\x4a\x44\x54':function(_0x3cb5ad,_0x98682b){return _0x3cb5ad===_0x98682b;},'\x79\x63\x4a\x56\x59':_0x2c70('106','\x48\x26\x24\x50'),'\x55\x4f\x77\x54\x53':'\x41\x62\x4e\x4e\x5a','\x77\x77\x58\x73\x72':_0x2c70('107','\x57\x53\x39\x64'),'\x66\x62\x64\x58\x65':'\x33\x7c\x32\x7c\x31\x7c\x35\x7c\x30\x7c\x34','\x61\x50\x42\x55\x57':function(_0x22ae3b,_0x294ae3){return _0x22ae3b|_0x294ae3;},'\x66\x6b\x42\x4e\x52':function(_0x3fd198,_0x1565d9){return _0x3fd198>>_0x1565d9;},'\x4e\x7a\x64\x63\x72':function(_0x41b3ee,_0x55beb0){return _0x41b3ee|_0x55beb0;},'\x73\x74\x64\x59\x57':function(_0x221b76,_0x404c9a){return _0x221b76&_0x404c9a;},'\x66\x78\x57\x54\x41':function(_0x4a93f1,_0x260d47){return _0x4a93f1|_0x260d47;},'\x45\x51\x6f\x65\x66':function(_0x147200,_0x489f3a){return _0x147200>>_0x489f3a;},'\x66\x4a\x4d\x77\x50':function(_0x273371,_0x19d237){return _0x273371!==_0x19d237;},'\x4e\x54\x7a\x4b\x62':_0x2c70('108','\x5d\x45\x4e\x32'),'\x4c\x77\x46\x4a\x47':'\x45\x66\x4c\x48\x62','\x71\x51\x41\x4e\x5a':_0x2c70('109','\x7a\x63\x78\x6d'),'\x68\x47\x79\x4f\x56':function(_0x4959c8,_0x259294){return _0x4959c8>_0x259294;},'\x70\x6a\x76\x71\x72':function(_0x3a4536,_0x32ec25){return _0x3a4536+_0x32ec25;},'\x63\x41\x75\x75\x4d':_0x2c70('10a','\x62\x66\x34\x55'),'\x6c\x76\x76\x76\x43':'\x4b\x43\x50\x43\x78','\x50\x68\x75\x67\x64':function(_0x11ced9,_0x644a24){return _0x11ced9===_0x644a24;},'\x64\x70\x77\x6f\x58':_0x2c70('10b','\x62\x66\x34\x55'),'\x54\x77\x63\x76\x4d':function(_0x14adc4,_0x5233bc){return _0x14adc4===_0x5233bc;},'\x74\x45\x4a\x62\x4e':'\x63\x66\x79\x56\x6d','\x64\x7a\x66\x4c\x61':_0x2c70('10c','\x58\x25\x25\x4d'),'\x49\x61\x44\x4f\x44':function(_0x2e95bf,_0x502fc5){return _0x2e95bf+_0x502fc5;},'\x49\x56\x44\x63\x75':function(_0xdb2c37,_0x7028c1){return _0xdb2c37===_0x7028c1;},'\x74\x6d\x76\x56\x6e':'\x52\x45\x70\x59\x79','\x72\x4d\x44\x44\x76':_0x2c70('10d','\x6c\x24\x30\x47'),'\x65\x6b\x57\x66\x66':_0x2c70('10e','\x38\x76\x21\x24'),'\x69\x46\x76\x45\x78':function(_0x240031){return _0x240031();},'\x6b\x50\x6d\x48\x5a':_0x2c70('10f','\x35\x55\x24\x48'),'\x54\x61\x51\x55\x41':'\x69\x6e\x73\x74\x61\x6e\x63\x65','\x67\x42\x62\x47\x6f':'\x65\x72\x72\x6f\x72','\x4b\x47\x65\x72\x6e':_0x2c70('110','\x4d\x26\x47\x28'),'\x67\x65\x66\x72\x6c':_0x2c70('111','\x39\x40\x64\x28'),'\x63\x56\x71\x62\x53':_0x2c70('112','\x63\x53\x25\x28'),'\x43\x46\x7a\x65\x67':function(_0x551a46,_0x5c0a3a){return _0x551a46+_0x5c0a3a;},'\x4a\x43\x6a\x62\x7a':function(_0x585d6e,_0x2d759f){return _0x585d6e!==_0x2d759f;},'\x43\x77\x72\x6c\x50':'\x45\x43\x4d\x71\x76','\x47\x79\x54\x5a\x54':'\x70\x56\x70\x45\x59','\x57\x70\x6e\x51\x66':_0x2c70('113','\x44\x46\x72\x69'),'\x4a\x76\x4e\x5a\x59':_0x2c70('114','\x54\x4c\x24\x40'),'\x50\x6e\x6d\x4f\x57':function(_0x1a44f5,_0x3c4caa){return _0x1a44f5|_0x3c4caa;},'\x6f\x6f\x76\x69\x68':function(_0x18f0db,_0x3145b1){return _0x18f0db&_0x3145b1;},'\x4c\x41\x5a\x6e\x56':function(_0xa7f99d,_0x4aa243){return _0xa7f99d&_0x4aa243;},'\x6f\x62\x6f\x68\x67':function(_0x54c201,_0x291554){return _0x54c201&_0x291554;},'\x44\x47\x52\x50\x59':function(_0x60d7e6,_0x50b384){return _0x60d7e6|_0x50b384;},'\x74\x65\x4a\x63\x59':function(_0x5dcf01,_0x5a8859){return _0x5dcf01!==_0x5a8859;},'\x69\x4b\x6b\x72\x4c':_0x2c70('115','\x48\x26\x24\x50'),'\x78\x54\x4e\x64\x44':'\x71\x43\x56\x76\x4f','\x72\x6d\x45\x50\x6e':function(_0x5da88a,_0x9dc723){return _0x5da88a===_0x9dc723;},'\x68\x4f\x44\x58\x47':_0x2c70('116','\x67\x4f\x63\x4c'),'\x74\x58\x44\x50\x42':function(_0x4c4dab,_0x213d31){return _0x4c4dab!==_0x213d31;},'\x69\x49\x4c\x68\x49':'\x67\x52\x73\x47\x51','\x61\x44\x4c\x58\x64':'\x50\x4f\x7a\x50\x6d','\x67\x59\x45\x61\x64':function(_0x494bc2,_0x1e2f2d){return _0x494bc2/_0x1e2f2d;},'\x43\x53\x65\x52\x56':function(_0x4f8a77,_0xa57080){return _0x4f8a77===_0xa57080;},'\x68\x47\x56\x62\x79':_0x2c70('117','\x58\x25\x25\x4d'),'\x4e\x73\x76\x53\x78':function(_0x34a1ff,_0x1feb39){return _0x34a1ff===_0x1feb39;},'\x74\x76\x47\x71\x72':'\x4a\x6a\x48\x75\x4f','\x45\x75\x77\x49\x55':'\x6f\x6f\x62\x61\x67','\x4f\x66\x57\x53\x42':function(_0x4664a0,_0x3dc885){return _0x4664a0>>_0x3dc885;},'\x6a\x52\x51\x70\x47':function(_0x38913b,_0x4e0242){return _0x38913b&_0x4e0242;},'\x6d\x49\x66\x69\x75':'\x76\x49\x70\x7a\x52','\x62\x70\x79\x69\x54':_0x2c70('118','\x44\x46\x72\x69'),'\x67\x74\x6c\x58\x63':function(_0x3df4d8,_0x2209b7){return _0x3df4d8!==_0x2209b7;},'\x54\x77\x50\x6b\x7a':_0x2c70('119','\x23\x62\x71\x78'),'\x50\x63\x66\x54\x54':_0x2c70('11a','\x48\x26\x24\x50'),'\x6a\x6d\x61\x4c\x76':_0x2c70('11b','\x25\x6b\x2a\x73'),'\x44\x52\x62\x43\x59':function(_0x36fbc4,_0x52aef7){return _0x36fbc4===_0x52aef7;},'\x56\x4c\x6b\x71\x41':'\x66\x75\x6e\x63\x74\x69\x6f\x6e','\x50\x78\x4f\x65\x4b':_0x2c70('11c','\x62\x66\x34\x55'),'\x6a\x57\x63\x74\x77':_0x2c70('11d','\x4b\x5e\x4b\x69'),'\x77\x6c\x4e\x51\x6e':'\x70\x70\x56\x48\x48','\x66\x6a\x70\x43\x43':function(_0x18bd41,_0x5c6903){return _0x18bd41===_0x5c6903;},'\x42\x53\x45\x4d\x79':_0x2c70('11e','\x39\x40\x64\x28')};var _0xe9671={};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']={};_0xe9671[_0x2c70('11f','\x38\x76\x21\x24')][_0x2c70('120','\x44\x46\x72\x69')]=function to_utf8(_0x50708b,_0x3b97f9){var _0x12b1ca=_0xe9671[_0x2c70('121','\x21\x25\x46\x6e')];for(var _0x36329e=0x0;_0x53f1b3[_0x2c70('122','\x39\x40\x64\x28')](_0x36329e,_0x50708b[_0x2c70('123','\x4b\x71\x6c\x67')]);++_0x36329e){var _0x5e5c7f=_0x50708b[_0x2c70('124','\x62\x32\x54\x2a')](_0x36329e);if(_0x53f1b3[_0x2c70('125','\x38\x76\x21\x24')](_0x5e5c7f,0xd800)&&_0x53f1b3[_0x2c70('126','\x62\x32\x54\x2a')](_0x5e5c7f,0xdfff)){_0x5e5c7f=_0x53f1b3['\x61\x7a\x44\x45\x43'](_0x53f1b3['\x6b\x57\x50\x57\x6b'](0x10000,_0x53f1b3['\x6b\x6c\x55\x64\x64'](_0x53f1b3[_0x2c70('127','\x7a\x63\x78\x6d')](_0x5e5c7f,0x3ff),0xa)),_0x53f1b3[_0x2c70('128','\x6d\x71\x73\x44')](_0x50708b['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x36329e),0x3ff));}if(_0x53f1b3[_0x2c70('129','\x48\x26\x24\x50')](_0x5e5c7f,0x7f)){_0x12b1ca[_0x3b97f9++]=_0x5e5c7f;}else if(_0x53f1b3['\x55\x79\x6a\x58\x6f'](_0x5e5c7f,0x7ff)){_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('12a','\x4d\x26\x47\x28')](0xc0,_0x53f1b3[_0x2c70('12b','\x63\x53\x25\x28')](_0x5e5c7f,0x6));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('12c','\x63\x53\x25\x28')](0x80,_0x53f1b3['\x66\x71\x44\x50\x70'](_0x5e5c7f,0x3f));}else if(_0x53f1b3[_0x2c70('12d','\x56\x4b\x47\x68')](_0x5e5c7f,0xffff)){if(_0x53f1b3[_0x2c70('12e','\x49\x2a\x53\x35')](_0x53f1b3['\x68\x69\x66\x4c\x4e'],_0x53f1b3[_0x2c70('12f','\x49\x2a\x53\x35')])){_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('130','\x62\x32\x54\x2a')](0xe0,_0x53f1b3['\x67\x76\x4f\x59\x5a'](_0x5e5c7f,0xc));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('131','\x35\x55\x24\x48')](0x80,_0x53f1b3['\x6b\x54\x42\x47\x63'](_0x53f1b3[_0x2c70('132','\x4e\x30\x4e\x37')](_0x5e5c7f,0x6),0x3f));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('133','\x4e\x30\x4e\x37')](0x80,_0x53f1b3[_0x2c70('134','\x4b\x5e\x4b\x69')](_0x5e5c7f,0x3f));}else{var _0x1de7a5=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](t);return _0x53f1b3[_0x2c70('135','\x4d\x26\x47\x28')](_0x1de7a5,DOMException)&&_0x53f1b3[_0x2c70('136','\x21\x4c\x76\x73')](_0x53f1b3[_0x2c70('137','\x62\x66\x34\x55')],_0x1de7a5[_0x2c70('138','\x69\x4f\x64\x63')]);}}else if(_0x53f1b3[_0x2c70('139','\x62\x66\x34\x55')](_0x5e5c7f,0x1fffff)){_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('13a','\x49\x2a\x53\x35')](0xf0,_0x53f1b3['\x55\x76\x72\x54\x45'](_0x5e5c7f,0x12));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('13b','\x4e\x26\x68\x2a')](0x80,_0x53f1b3['\x6b\x54\x42\x47\x63'](_0x53f1b3[_0x2c70('13c','\x78\x71\x61\x43')](_0x5e5c7f,0xc),0x3f));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('13d','\x39\x40\x64\x28')](0x80,_0x53f1b3[_0x2c70('13e','\x68\x4c\x57\x61')](_0x53f1b3[_0x2c70('13f','\x7a\x4b\x53\x44')](_0x5e5c7f,0x6),0x3f));_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('140','\x6d\x71\x73\x44')](0x80,_0x53f1b3['\x6b\x54\x42\x47\x63'](_0x5e5c7f,0x3f));}else if(_0x53f1b3[_0x2c70('141','\x4e\x30\x4e\x37')](_0x5e5c7f,0x3ffffff)){var _0x51d63d=_0x53f1b3[_0x2c70('142','\x67\x4f\x63\x4c')][_0x2c70('143','\x69\x4f\x64\x63')]('\x7c'),_0x150162=0x0;while(!![]){switch(_0x51d63d[_0x150162++]){case'\x30':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('144','\x4f\x57\x57\x56')](0x80,_0x53f1b3[_0x2c70('145','\x6d\x71\x73\x44')](_0x53f1b3['\x46\x65\x75\x73\x47'](_0x5e5c7f,0x6),0x3f));continue;case'\x31':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('146','\x4b\x71\x6c\x67')](0x80,_0x53f1b3[_0x2c70('147','\x51\x4e\x33\x40')](_0x53f1b3['\x5a\x71\x6b\x47\x4b'](_0x5e5c7f,0xc),0x3f));continue;case'\x32':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('148','\x56\x4b\x47\x68')](0x80,_0x53f1b3[_0x2c70('149','\x4e\x26\x68\x2a')](_0x53f1b3[_0x2c70('14a','\x46\x50\x79\x57')](_0x5e5c7f,0x12),0x3f));continue;case'\x33':_0x12b1ca[_0x3b97f9++]=_0x53f1b3['\x53\x7a\x70\x4c\x52'](0xf8,_0x53f1b3['\x48\x48\x58\x68\x6e'](_0x5e5c7f,0x18));continue;case'\x34':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('14b','\x4d\x26\x47\x28')](0x80,_0x53f1b3['\x6b\x63\x4a\x48\x63'](_0x5e5c7f,0x3f));continue;}break;}}else{var _0x57c248=_0x53f1b3[_0x2c70('14c','\x58\x25\x25\x4d')][_0x2c70('14d','\x56\x4b\x47\x68')]('\x7c'),_0x13735f=0x0;while(!![]){switch(_0x57c248[_0x13735f++]){case'\x30':_0x12b1ca[_0x3b97f9++]=_0x53f1b3['\x44\x41\x70\x4a\x47'](0x80,_0x53f1b3['\x6b\x63\x4a\x48\x63'](_0x53f1b3[_0x2c70('14e','\x5d\x45\x4e\x32')](_0x5e5c7f,0x6),0x3f));continue;case'\x31':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('14f','\x63\x53\x25\x28')](0xfc,_0x53f1b3[_0x2c70('150','\x56\x4b\x47\x68')](_0x5e5c7f,0x1e));continue;case'\x32':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('151','\x23\x62\x71\x78')](0x80,_0x53f1b3[_0x2c70('152','\x4e\x30\x4e\x37')](_0x53f1b3['\x48\x48\x58\x68\x6e'](_0x5e5c7f,0x12),0x3f));continue;case'\x33':_0x12b1ca[_0x3b97f9++]=_0x53f1b3['\x4c\x43\x79\x6e\x77'](0x80,_0x53f1b3['\x49\x49\x62\x58\x67'](_0x53f1b3['\x64\x4c\x4d\x6e\x63'](_0x5e5c7f,0xc),0x3f));continue;case'\x34':_0x12b1ca[_0x3b97f9++]=_0x53f1b3['\x4c\x43\x79\x6e\x77'](0x80,_0x53f1b3['\x41\x51\x57\x7a\x44'](_0x5e5c7f,0x3f));continue;case'\x35':_0x12b1ca[_0x3b97f9++]=_0x53f1b3[_0x2c70('153','\x47\x55\x50\x61')](0x80,_0x53f1b3['\x58\x71\x46\x72\x4f'](_0x53f1b3['\x63\x47\x78\x44\x73'](_0x5e5c7f,0x18),0x3f));continue;}break;}}}};_0xe9671[_0x2c70('154','\x62\x32\x54\x2a')][_0x2c70('155','\x7a\x63\x78\x6d')]=function(){};_0xe9671[_0x2c70('156','\x25\x6b\x2a\x73')]['\x74\x6f\x5f\x6a\x73']=function to_js(_0x428036){var _0x2aec55={'\x73\x65\x57\x5a\x73':_0x53f1b3[_0x2c70('157','\x4b\x71\x6c\x67')],'\x4e\x6a\x6a\x6b\x76':function(_0x53f490,_0x2e0b09){return _0x53f1b3[_0x2c70('158','\x72\x49\x33\x6a')](_0x53f490,_0x2e0b09);},'\x6c\x62\x42\x77\x69':function(_0x2ce3cc,_0x2606dd){return _0x53f1b3['\x6b\x57\x50\x57\x6b'](_0x2ce3cc,_0x2606dd);},'\x70\x59\x6e\x67\x64':function(_0x2d3787,_0xc817cc){return _0x53f1b3[_0x2c70('159','\x7a\x63\x78\x6d')](_0x2d3787,_0xc817cc);},'\x57\x61\x48\x72\x4d':function(_0x409ec1,_0xf3ca4c){return _0x53f1b3[_0x2c70('15a','\x6c\x24\x30\x47')](_0x409ec1,_0xf3ca4c);},'\x4e\x6c\x62\x77\x71':function(_0x3708b5,_0x4268d9){return _0x53f1b3['\x6b\x57\x50\x57\x6b'](_0x3708b5,_0x4268d9);},'\x6e\x74\x4e\x56\x50':function(_0x23c135,_0xa776ee){return _0x53f1b3[_0x2c70('15b','\x57\x53\x39\x64')](_0x23c135,_0xa776ee);},'\x6b\x66\x6a\x71\x79':function(_0xce7b82,_0x1196ad){return _0x53f1b3[_0x2c70('15c','\x38\x76\x21\x24')](_0xce7b82,_0x1196ad);},'\x65\x50\x65\x63\x56':function(_0x313e16,_0x57c237){return _0x53f1b3[_0x2c70('15d','\x35\x55\x24\x48')](_0x313e16,_0x57c237);},'\x50\x69\x59\x62\x49':function(_0x3ec901,_0x8c821d){return _0x53f1b3[_0x2c70('15e','\x64\x30\x46\x39')](_0x3ec901,_0x8c821d);},'\x4c\x4a\x4f\x67\x4f':function(_0x381023,_0x36a66b){return _0x53f1b3['\x66\x4e\x4f\x65\x68'](_0x381023,_0x36a66b);},'\x68\x5a\x6d\x66\x52':_0x53f1b3[_0x2c70('15f','\x23\x62\x71\x78')],'\x47\x69\x41\x70\x45':function(_0x439a81,_0x1569a8){return _0x53f1b3[_0x2c70('160','\x62\x66\x34\x55')](_0x439a81,_0x1569a8);},'\x6e\x76\x5a\x50\x73':_0x53f1b3['\x42\x47\x48\x69\x6e'],'\x4d\x72\x52\x4d\x75':_0x53f1b3['\x78\x6a\x51\x75\x72'],'\x4f\x5a\x4b\x71\x59':_0x53f1b3[_0x2c70('161','\x4e\x30\x4e\x37')],'\x54\x62\x46\x61\x47':function(_0x46df7d,_0x3e3162){return _0x53f1b3[_0x2c70('162','\x7a\x4b\x53\x44')](_0x46df7d,_0x3e3162);},'\x4d\x56\x67\x76\x47':function(_0x1bb9c1,_0x1b895d){return _0x53f1b3['\x58\x71\x46\x72\x4f'](_0x1bb9c1,_0x1b895d);},'\x49\x4b\x57\x51\x4a':function(_0x5cd3f4,_0x47acd8){return _0x53f1b3['\x58\x71\x46\x72\x4f'](_0x5cd3f4,_0x47acd8);},'\x6e\x45\x6d\x78\x6e':_0x53f1b3[_0x2c70('163','\x5d\x45\x4e\x32')],'\x69\x6a\x78\x4a\x58':function(_0x151e13,_0x571fdc){return _0x53f1b3['\x57\x74\x47\x44\x7a'](_0x151e13,_0x571fdc);},'\x53\x5a\x41\x79\x4d':_0x53f1b3[_0x2c70('164','\x51\x4e\x33\x40')],'\x6a\x61\x4a\x44\x6d':_0x53f1b3['\x62\x6c\x77\x4e\x50'],'\x6e\x77\x73\x62\x42':function(_0x1d8d8b,_0x58dcc1){return _0x53f1b3[_0x2c70('165','\x56\x4b\x47\x68')](_0x1d8d8b,_0x58dcc1);},'\x47\x48\x4a\x4f\x6a':function(_0x51bb8d,_0x2e047b){return _0x53f1b3[_0x2c70('166','\x63\x4a\x67\x45')](_0x51bb8d,_0x2e047b);},'\x43\x72\x63\x5a\x61':_0x53f1b3[_0x2c70('167','\x6c\x57\x31\x41')],'\x4e\x66\x47\x75\x75':_0x53f1b3[_0x2c70('168','\x4e\x30\x4e\x37')],'\x64\x43\x76\x74\x48':_0x53f1b3[_0x2c70('169','\x63\x53\x25\x28')],'\x70\x44\x7a\x63\x6d':function(_0x3604b1,_0x3da5e8){return _0x53f1b3['\x69\x66\x4a\x65\x59'](_0x3604b1,_0x3da5e8);},'\x56\x44\x70\x62\x67':_0x53f1b3[_0x2c70('16a','\x67\x4f\x63\x4c')],'\x50\x48\x4b\x55\x42':function(_0x4dcba8,_0xd85d51){return _0x53f1b3[_0x2c70('16b','\x4e\x26\x68\x2a')](_0x4dcba8,_0xd85d51);},'\x57\x6e\x47\x74\x48':_0x53f1b3[_0x2c70('16c','\x56\x4b\x47\x68')],'\x57\x75\x56\x51\x56':_0x53f1b3[_0x2c70('16d','\x56\x4b\x47\x68')],'\x6e\x64\x59\x61\x4c':function(_0x5d1772,_0x53a1b5){return _0x53f1b3['\x57\x74\x47\x44\x7a'](_0x5d1772,_0x53a1b5);},'\x69\x78\x4f\x4c\x52':function(_0x1d74ea,_0x90bdab){return _0x53f1b3[_0x2c70('16e','\x7a\x63\x78\x6d')](_0x1d74ea,_0x90bdab);},'\x4a\x79\x64\x57\x5a':_0x53f1b3['\x64\x4e\x76\x4b\x70'],'\x4d\x69\x56\x51\x4d':function(_0x23b2a0,_0x2fc5de){return _0x53f1b3['\x57\x48\x51\x6c\x51'](_0x23b2a0,_0x2fc5de);},'\x4b\x71\x42\x62\x68':function(_0x4b2f09,_0x5889d4){return _0x53f1b3['\x63\x4d\x7a\x64\x55'](_0x4b2f09,_0x5889d4);},'\x49\x58\x4e\x4f\x56':_0x53f1b3[_0x2c70('16f','\x6d\x71\x73\x44')],'\x4a\x46\x77\x58\x55':function(_0x3cb3e5,_0x251508){return _0x53f1b3[_0x2c70('170','\x57\x53\x39\x64')](_0x3cb3e5,_0x251508);},'\x6a\x63\x51\x43\x42':_0x53f1b3[_0x2c70('171','\x47\x55\x50\x61')],'\x62\x49\x78\x50\x41':_0x53f1b3[_0x2c70('172','\x49\x2a\x53\x35')],'\x68\x75\x54\x55\x4b':_0x53f1b3['\x61\x45\x65\x79\x59'],'\x4c\x4b\x77\x69\x77':function(_0x1523e6,_0x1a5aa6){return _0x53f1b3[_0x2c70('173','\x28\x5b\x79\x45')](_0x1523e6,_0x1a5aa6);},'\x4b\x68\x4b\x72\x48':_0x53f1b3[_0x2c70('174','\x72\x49\x33\x6a')],'\x47\x41\x47\x69\x43':_0x53f1b3[_0x2c70('175','\x6c\x24\x30\x47')],'\x50\x77\x4c\x67\x51':function(_0x3e26b1,_0x3a6064){return _0x53f1b3['\x73\x42\x66\x45\x76'](_0x3e26b1,_0x3a6064);},'\x45\x41\x7a\x64\x4f':function(_0x2f2ca3,_0x28bdb6){return _0x53f1b3[_0x2c70('176','\x39\x40\x64\x28')](_0x2f2ca3,_0x28bdb6);},'\x76\x70\x6b\x52\x6e':function(_0x1af335,_0x2c6d60){return _0x53f1b3[_0x2c70('177','\x62\x66\x34\x55')](_0x1af335,_0x2c6d60);}};if(_0x53f1b3['\x42\x4f\x76\x75\x62'](_0x53f1b3[_0x2c70('178','\x23\x62\x71\x78')],_0x53f1b3[_0x2c70('179','\x72\x32\x62\x48')])){var _0x10f5b3=_0xe9671[_0x2c70('17a','\x6c\x57\x31\x41')][_0x53f1b3[_0x2c70('17b','\x47\x55\x50\x61')](_0x428036,0xc)];if(_0x53f1b3[_0x2c70('17c','\x4a\x4e\x35\x6b')](_0x10f5b3,0x0)){return undefined;}else if(_0x53f1b3[_0x2c70('17d','\x54\x4c\x24\x40')](_0x10f5b3,0x1)){return null;}else if(_0x53f1b3[_0x2c70('17e','\x56\x4b\x47\x68')](_0x10f5b3,0x2)){return _0xe9671[_0x2c70('17f','\x54\x4c\x24\x40')][_0x53f1b3[_0x2c70('180','\x6c\x57\x31\x41')](_0x428036,0x4)];}else if(_0x53f1b3[_0x2c70('17e','\x56\x4b\x47\x68')](_0x10f5b3,0x3)){if(_0x53f1b3[_0x2c70('181','\x5d\x45\x4e\x32')](_0x53f1b3['\x59\x6f\x6b\x49\x47'],_0x53f1b3[_0x2c70('182','\x63\x53\x25\x28')])){BiliPushUtils['\x73\x69\x67\x6e']=function(_0x5eafab,_0x2aa3c1){return f[_0x2c70('183','\x51\x4e\x33\x40')](_0x5eafab,_0x2aa3c1);};}else{return _0xe9671[_0x2c70('184','\x69\x4f\x64\x63')][_0x53f1b3[_0x2c70('185','\x6d\x71\x73\x44')](_0x428036,0x8)];}}else if(_0x53f1b3[_0x2c70('186','\x62\x32\x54\x2a')](_0x10f5b3,0x4)){if(_0x53f1b3[_0x2c70('187','\x4a\x4e\x35\x6b')](_0x53f1b3[_0x2c70('188','\x6c\x24\x30\x47')],_0x53f1b3[_0x2c70('189','\x4b\x71\x6c\x67')])){r=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('18a','\x6c\x24\x30\x47')](r),_0xe9671[_0x2c70('18b','\x39\x40\x64\x28')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,r['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);}else{var _0x571bbd=_0xe9671[_0x2c70('18c','\x5d\x45\x4e\x32')][_0x53f1b3[_0x2c70('18d','\x7a\x4b\x53\x44')](_0x428036,0x4)];var _0x1cd043=_0xe9671[_0x2c70('18e','\x6c\x57\x31\x41')][_0x53f1b3[_0x2c70('18f','\x25\x6b\x2a\x73')](_0x53f1b3[_0x2c70('190','\x72\x32\x62\x48')](_0x428036,0x4),0x4)];return _0xe9671[_0x2c70('191','\x78\x71\x61\x43')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x571bbd,_0x1cd043);}}else if(_0x53f1b3[_0x2c70('192','\x68\x4c\x57\x61')](_0x10f5b3,0x5)){return![];}else if(_0x53f1b3['\x70\x74\x6b\x62\x65'](_0x10f5b3,0x6)){return!![];}else if(_0x53f1b3[_0x2c70('193','\x5a\x69\x4c\x74')](_0x10f5b3,0x7)){if(_0x53f1b3[_0x2c70('194','\x4f\x57\x57\x56')](_0x53f1b3[_0x2c70('195','\x7a\x4b\x53\x44')],_0x53f1b3[_0x2c70('196','\x28\x5b\x79\x45')])){var _0x12684c=_0x2aec55['\x73\x65\x57\x5a\x73'][_0x2c70('197','\x57\x53\x39\x64')]('\x7c'),_0x10a170=0x0;while(!![]){switch(_0x12684c[_0x10a170++]){case'\x30':var _0x1b48d5=_0xe9671[_0x2c70('198','\x67\x4f\x63\x4c')][_0x2aec55[_0x2c70('199','\x6d\x71\x73\x44')](_0x2aec55[_0x2c70('19a','\x5a\x69\x4c\x74')](_0xb89e52,_0x2aec55[_0x2c70('19b','\x67\x70\x57\x55')](_0x109f67,0x8)),0x4)];continue;case'\x31':var _0x1e862b=_0xe9671[_0x2c70('19c','\x4e\x30\x4e\x37')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x1b48d5,_0x42daac);continue;case'\x32':var _0x42daac=_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x2aec55[_0x2c70('19d','\x7a\x63\x78\x6d')](_0x2aec55[_0x2c70('19e','\x35\x24\x67\x66')](_0x2aec55['\x4e\x6c\x62\x77\x71'](_0xb89e52,0x4),_0x2aec55[_0x2c70('19f','\x46\x50\x79\x57')](_0x109f67,0x8)),0x4)];continue;case'\x33':var _0xec97c6=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x2aec55['\x4e\x6c\x62\x77\x71'](_0x450bcf,_0x2aec55[_0x2c70('1a0','\x77\x71\x76\x45')](_0x109f67,0x10)));continue;case'\x34':_0x1a258c[_0x1e862b]=_0xec97c6;continue;}break;}}else{var _0x571bbd=_0x53f1b3[_0x2c70('1a1','\x69\x4f\x64\x63')](_0xe9671[_0x2c70('1a2','\x30\x29\x26\x4d')][_0x2c70('1a3','\x7a\x63\x78\x6d')],_0xe9671[_0x2c70('1a4','\x6d\x71\x73\x44')][_0x53f1b3[_0x2c70('1a5','\x54\x4c\x24\x40')](_0x428036,0x4)]);var _0x1cd043=_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3['\x79\x41\x68\x6b\x4b'](_0x53f1b3[_0x2c70('1a6','\x57\x53\x39\x64')](_0x428036,0x4),0x4)];var _0x1a258c=[];for(var _0x109f67=0x0;_0x53f1b3['\x6f\x49\x7a\x4e\x47'](_0x109f67,_0x1cd043);++_0x109f67){if(_0x53f1b3[_0x2c70('1a7','\x7a\x63\x78\x6d')](_0x53f1b3[_0x2c70('1a8','\x35\x24\x67\x66')],_0x53f1b3[_0x2c70('1a9','\x6d\x71\x73\x44')])){if(_0x2aec55[_0x2c70('1aa','\x23\x62\x71\x78')](_0x96c85e,_0x2aec55['\x65\x50\x65\x63\x56'](_0x96c85e,0x0))){_0xe9671[_0x2c70('1ab','\x62\x32\x54\x2a')][_0x2aec55[_0x2c70('1ac','\x7a\x63\x78\x6d')](_0x428036,0xc)]=0x2;_0xe9671[_0x2c70('1ad','\x58\x25\x25\x4d')][_0x2aec55['\x50\x69\x59\x62\x49'](_0x428036,0x4)]=_0x96c85e;}else{_0xe9671[_0x2c70('17a','\x6c\x57\x31\x41')][_0x2aec55[_0x2c70('1ae','\x39\x40\x64\x28')](_0x428036,0xc)]=0x3;_0xe9671['\x48\x45\x41\x50\x46\x36\x34'][_0x2aec55[_0x2c70('1af','\x25\x6b\x2a\x73')](_0x428036,0x8)]=_0x96c85e;}}else{_0x1a258c[_0x2c70('1b0','\x72\x49\x33\x6a')](_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x53f1b3['\x65\x64\x48\x58\x64'](_0x571bbd,_0x53f1b3['\x79\x70\x6d\x72\x50'](_0x109f67,0x10))));}}return _0x1a258c;}}else if(_0x53f1b3[_0x2c70('1b1','\x44\x46\x72\x69')](_0x10f5b3,0x8)){if(_0x53f1b3['\x4e\x46\x73\x5a\x50'](_0x53f1b3[_0x2c70('1b2','\x6c\x24\x30\x47')],_0x53f1b3[_0x2c70('1b3','\x63\x53\x25\x28')])){_0x42e6b3[addr++]=u;}else{var _0x1c48ac=_0x53f1b3[_0x2c70('1b4','\x4f\x57\x57\x56')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x14c61a=0x0;while(!![]){switch(_0x1c48ac[_0x14c61a++]){case'\x30':var _0x1a258c={};continue;case'\x31':var _0xb89e52=_0x53f1b3[_0x2c70('1b5','\x4a\x4e\x35\x6b')](_0x2aef8b,_0xe9671[_0x2c70('1b6','\x56\x4b\x47\x68')][_0x53f1b3[_0x2c70('1b7','\x4d\x26\x47\x28')](_0x53f1b3[_0x2c70('1b8','\x7a\x4b\x53\x44')](_0x428036,0x8),0x4)]);continue;case'\x32':var _0x450bcf=_0x53f1b3['\x65\x42\x4f\x73\x43'](_0x2aef8b,_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3['\x79\x41\x68\x6b\x4b'](_0x428036,0x4)]);continue;case'\x33':return _0x1a258c;case'\x34':var _0x1cd043=_0xe9671[_0x2c70('1b9','\x62\x66\x34\x55')][_0x53f1b3['\x54\x63\x6d\x76\x53'](_0x53f1b3['\x65\x42\x4f\x73\x43'](_0x428036,0x4),0x4)];continue;case'\x35':var _0x2aef8b=_0xe9671[_0x2c70('1ba','\x68\x4c\x57\x61')][_0x2c70('1bb','\x44\x46\x72\x69')];continue;case'\x36':for(var _0x109f67=0x0;_0x53f1b3[_0x2c70('1bc','\x44\x46\x72\x69')](_0x109f67,_0x1cd043);++_0x109f67){var _0x3c8a0c=_0x53f1b3[_0x2c70('1bd','\x48\x26\x24\x50')][_0x2c70('1be','\x30\x29\x26\x4d')]('\x7c'),_0x187f71=0x0;while(!![]){switch(_0x3c8a0c[_0x187f71++]){case'\x30':var _0x422553=_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('1bf','\x35\x24\x67\x66')](_0x53f1b3[_0x2c70('1c0','\x48\x26\x24\x50')](_0x53f1b3['\x65\x42\x4f\x73\x43'](_0xb89e52,0x4),_0x53f1b3[_0x2c70('1c1','\x72\x32\x62\x48')](_0x109f67,0x8)),0x4)];continue;case'\x31':var _0x374908=_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')][_0x2c70('1c3','\x67\x4f\x63\x4c')](_0x5e9ee0,_0x422553);continue;case'\x32':_0x1a258c[_0x374908]=_0x96c85e;continue;case'\x33':var _0x96c85e=_0xe9671[_0x2c70('1c4','\x7a\x63\x78\x6d')][_0x2c70('1c5','\x40\x4d\x45\x24')](_0x53f1b3['\x65\x42\x4f\x73\x43'](_0x450bcf,_0x53f1b3[_0x2c70('1c6','\x67\x4f\x63\x4c')](_0x109f67,0x10)));continue;case'\x34':var _0x5e9ee0=_0xe9671[_0x2c70('1c7','\x57\x53\x39\x64')][_0x53f1b3[_0x2c70('1c8','\x5d\x45\x4e\x32')](_0x53f1b3[_0x2c70('1c9','\x4e\x30\x4e\x37')](_0xb89e52,_0x53f1b3['\x62\x55\x61\x41\x4a'](_0x109f67,0x8)),0x4)];continue;}break;}}continue;}break;}}}else if(_0x53f1b3[_0x2c70('1ca','\x64\x30\x46\x39')](_0x10f5b3,0x9)){return _0xe9671[_0x2c70('191','\x78\x71\x61\x43')][_0x2c70('1cb','\x21\x4c\x76\x73')](_0xe9671[_0x2c70('1cc','\x6c\x57\x31\x41')][_0x53f1b3[_0x2c70('1cd','\x44\x46\x72\x69')](_0x428036,0x4)]);}else if(_0x53f1b3[_0x2c70('1ce','\x4a\x4e\x35\x6b')](_0x10f5b3,0xa)||_0x53f1b3[_0x2c70('1cf','\x6c\x24\x30\x47')](_0x10f5b3,0xc)||_0x53f1b3[_0x2c70('1d0','\x48\x26\x24\x50')](_0x10f5b3,0xd)){if(_0x53f1b3[_0x2c70('1d1','\x68\x4c\x57\x61')](_0x53f1b3[_0x2c70('1d2','\x64\x30\x46\x39')],_0x53f1b3[_0x2c70('1d3','\x30\x29\x26\x4d')])){var _0x181a51=_0xe9671[_0x2c70('1d4','\x38\x76\x21\x24')][_0x53f1b3[_0x2c70('1d5','\x6d\x71\x73\x44')](_0x428036,0x4)];var _0x571bbd=_0xe9671[_0x2c70('1d6','\x46\x50\x79\x57')][_0x53f1b3[_0x2c70('1d7','\x38\x76\x21\x24')](_0x53f1b3['\x67\x4d\x77\x75\x42'](_0x428036,0x4),0x4)];var _0x15b567=_0xe9671[_0x2c70('1d8','\x4b\x71\x6c\x67')][_0x53f1b3[_0x2c70('1d9','\x72\x49\x33\x6a')](_0x53f1b3['\x67\x4d\x77\x75\x42'](_0x428036,0x8),0x4)];var _0x5eb3f5=0x0;var _0x3ddd8b=![];var _0x1a258c=function(){var _0x1f8d3c={'\x48\x51\x51\x45\x6a':function(_0x43681c,_0x7b6f67){return _0x2aec55[_0x2c70('1da','\x47\x55\x50\x61')](_0x43681c,_0x7b6f67);},'\x49\x50\x65\x7a\x43':function(_0x3b03fa,_0x458cc5){return _0x2aec55[_0x2c70('1db','\x4a\x4e\x35\x6b')](_0x3b03fa,_0x458cc5);},'\x58\x76\x67\x45\x6e':function(_0x503a00,_0x556fbf){return _0x2aec55[_0x2c70('1dc','\x7a\x63\x78\x6d')](_0x503a00,_0x556fbf);},'\x55\x67\x68\x69\x74':function(_0xc0778d,_0x1cd9d6){return _0x2aec55[_0x2c70('1dd','\x46\x50\x79\x57')](_0xc0778d,_0x1cd9d6);},'\x77\x55\x70\x71\x55':function(_0x517c07,_0x25e89){return _0x2aec55['\x49\x4b\x57\x51\x4a'](_0x517c07,_0x25e89);},'\x58\x4f\x51\x69\x44':function(_0x356443,_0x369adb){return _0x2aec55[_0x2c70('1de','\x6c\x57\x31\x41')](_0x356443,_0x369adb);},'\x79\x6e\x67\x71\x49':_0x2aec55[_0x2c70('1df','\x6d\x71\x73\x44')]};if(_0x2aec55[_0x2c70('1e0','\x72\x32\x62\x48')](_0x2aec55[_0x2c70('1e1','\x39\x40\x64\x28')],_0x2aec55[_0x2c70('1e2','\x62\x66\x34\x55')])){if(_0x2aec55[_0x2c70('1e3','\x63\x4a\x67\x45')](_0x571bbd,0x0)||_0x2aec55['\x47\x48\x4a\x4f\x6a'](_0x3ddd8b,!![])){if(_0x2aec55[_0x2c70('1e4','\x47\x55\x50\x61')](_0x2aec55[_0x2c70('1e5','\x4e\x26\x68\x2a')],_0x2aec55[_0x2c70('1e6','\x49\x6f\x39\x21')])){if(_0x2aec55[_0x2c70('1e7','\x57\x53\x39\x64')](_0x10f5b3,0xa)){if(_0x2aec55[_0x2c70('1e8','\x5a\x69\x4c\x74')](_0x2aec55[_0x2c70('1e9','\x57\x53\x39\x64')],_0x2aec55[_0x2c70('1ea','\x4b\x5e\x4b\x69')])){throw new ReferenceError(_0x2aec55[_0x2c70('1eb','\x4b\x71\x6c\x67')]);}else{var _0x34970c=_0xe9671[_0x2c70('1ec','\x77\x71\x76\x45')][_0x2c70('1ed','\x46\x50\x79\x57')];_0xe9671[_0x2c70('1ba','\x68\x4c\x57\x61')][_0x2c70('1ee','\x56\x4b\x47\x68')]=null;return _0x34970c;}}else if(_0x2aec55[_0x2c70('1ef','\x35\x24\x67\x66')](_0x10f5b3,0xc)){if(_0x2aec55[_0x2c70('1f0','\x5d\x45\x4e\x32')](_0x2aec55[_0x2c70('1f1','\x67\x70\x57\x55')],_0x2aec55[_0x2c70('1f2','\x4b\x5e\x4b\x69')])){throw new ReferenceError(_0x2aec55[_0x2c70('1f3','\x46\x50\x79\x57')]);}else{id_to_refcount_map[refid]++;}}else{throw new ReferenceError(_0x2aec55['\x4d\x72\x52\x4d\x75']);}}else{if(_0x2aec55[_0x2c70('1f4','\x30\x29\x26\x4d')](_0x10f5b3,0xa)){throw new ReferenceError(_0x2aec55[_0x2c70('1f5','\x49\x2a\x53\x35')]);}else if(_0x2aec55[_0x2c70('1f6','\x4b\x71\x6c\x67')](_0x10f5b3,0xc)){throw new ReferenceError(_0x2aec55['\x6e\x76\x5a\x50\x73']);}else{throw new ReferenceError(_0x2aec55['\x4d\x72\x52\x4d\x75']);}}}var _0x3dd3ec=_0x571bbd;if(_0x2aec55[_0x2c70('1f7','\x4d\x26\x47\x28')](_0x10f5b3,0xd)){if(_0x2aec55[_0x2c70('1f8','\x6c\x57\x31\x41')](_0x2aec55[_0x2c70('1f9','\x49\x6f\x39\x21')],_0x2aec55['\x57\x75\x56\x51\x56'])){_0x42e6b3[addr++]=_0x1f8d3c['\x48\x51\x51\x45\x6a'](0xf0,_0x1f8d3c[_0x2c70('1fa','\x23\x62\x71\x78')](u,0x12));_0x42e6b3[addr++]=_0x1f8d3c[_0x2c70('1fb','\x59\x69\x5b\x63')](0x80,_0x1f8d3c[_0x2c70('1fc','\x6c\x24\x30\x47')](_0x1f8d3c[_0x2c70('1fd','\x46\x50\x79\x57')](u,0xc),0x3f));_0x42e6b3[addr++]=_0x1f8d3c[_0x2c70('1fe','\x59\x69\x5b\x63')](0x80,_0x1f8d3c[_0x2c70('1ff','\x49\x6f\x39\x21')](_0x1f8d3c['\x49\x50\x65\x7a\x43'](u,0x6),0x3f));_0x42e6b3[addr++]=_0x1f8d3c[_0x2c70('1fe','\x59\x69\x5b\x63')](0x80,_0x1f8d3c[_0x2c70('200','\x28\x5b\x79\x45')](u,0x3f));}else{_0x1a258c[_0x2c70('201','\x21\x4c\x76\x73')]=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('202','\x28\x5b\x79\x45')];_0x571bbd=0x0;}}if(_0x2aec55[_0x2c70('203','\x56\x4b\x47\x68')](_0x5eb3f5,0x0)){if(_0x2aec55[_0x2c70('204','\x48\x26\x24\x50')](_0x2aec55[_0x2c70('205','\x68\x4c\x57\x61')],_0x2aec55[_0x2c70('206','\x67\x4f\x63\x4c')])){if(_0x2aec55[_0x2c70('207','\x21\x25\x46\x6e')](_0x10f5b3,0xc)||_0x2aec55[_0x2c70('208','\x51\x4e\x33\x40')](_0x10f5b3,0xd)){if(_0x2aec55['\x6e\x64\x59\x61\x4c'](_0x2aec55['\x49\x58\x4e\x4f\x56'],_0x2aec55[_0x2c70('209','\x48\x26\x24\x50')])){throw new ReferenceError(_0x2aec55[_0x2c70('20a','\x40\x4d\x45\x24')]);}else{throw new ReferenceError(_0x2aec55[_0x2c70('20b','\x35\x55\x24\x48')]);}}}else{r=_0xe9671[_0x2c70('20c','\x4e\x26\x68\x2a')][_0x2c70('20d','\x44\x46\x72\x69')](r),_0xe9671[_0x2c70('20e','\x62\x66\x34\x55')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,r[_0x2c70('20f','\x49\x6f\x39\x21')]);}}var _0x9ffd83=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](0x10);_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('210','\x67\x4f\x63\x4c')](_0x9ffd83,arguments);try{if(_0x2aec55[_0x2c70('211','\x77\x71\x76\x45')](_0x2aec55[_0x2c70('212','\x4e\x30\x4e\x37')],_0x2aec55[_0x2c70('213','\x69\x4f\x64\x63')])){return _0xe9671[_0x2c70('214','\x35\x24\x67\x66')][_0x1f8d3c[_0x2c70('215','\x57\x53\x39\x64')](_0x428036,0x4)];}else{_0x5eb3f5+=0x1;_0xe9671[_0x2c70('216','\x54\x4c\x24\x40')][_0x2c70('217','\x28\x5b\x79\x45')](_0x2aec55[_0x2c70('218','\x62\x32\x54\x2a')],_0x181a51,[_0x3dd3ec,_0x9ffd83]);_0xe9671[_0x2c70('219','\x56\x4b\x47\x68')][_0x2c70('21a','\x4d\x26\x47\x28')]=null;var _0x5567d8=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6d\x70'];}}finally{_0x5eb3f5-=0x1;}if(_0x2aec55['\x4c\x4b\x77\x69\x77'](_0x3ddd8b,!![])&&_0x2aec55[_0x2c70('21b','\x64\x30\x46\x39')](_0x5eb3f5,0x0)){if(_0x2aec55[_0x2c70('21c','\x5d\x45\x4e\x32')](_0x2aec55[_0x2c70('21d','\x51\x4e\x33\x40')],_0x2aec55['\x47\x41\x47\x69\x43'])){_0x1a258c[_0x2c70('21e','\x6c\x57\x31\x41')]();}else{var _0x1f9672=_0x1f8d3c['\x79\x6e\x67\x71\x49']['\x73\x70\x6c\x69\x74']('\x7c'),_0x233c34=0x0;while(!![]){switch(_0x1f9672[_0x233c34++]){case'\x30':_0x48ad52[_0x2c70('21f','\x4b\x5e\x4b\x69')](_0x2b3eb2);continue;case'\x31':var _0x48ad52=_0xe9671[_0x2c70('1ba','\x68\x4c\x57\x61')][_0x2c70('220','\x48\x26\x24\x50')];continue;case'\x32':var _0x1f8979=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('221','\x63\x53\x25\x28')];continue;case'\x33':delete id_to_refcount_map[refid];continue;case'\x34':delete _0x1f8979[refid];continue;case'\x35':var _0x2b3eb2=_0x1f8979[refid];continue;}break;}}}return _0x5567d8;}else{r=_0xe9671[_0x2c70('222','\x69\x4f\x64\x63')][_0x2c70('223','\x72\x49\x33\x6a')](r),_0xe9671[_0x2c70('224','\x64\x30\x46\x39')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,function(){try{return{'\x76\x61\x6c\x75\x65':r['\x68\x6f\x73\x74'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4062a7){return{'\x65\x72\x72\x6f\x72':_0x4062a7,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}};_0x1a258c['\x64\x72\x6f\x70']=function(){if(_0x53f1b3[_0x2c70('225','\x49\x6f\x39\x21')](_0x5eb3f5,0x0)){_0x3ddd8b=!![];return;}_0x1a258c[_0x2c70('226','\x62\x32\x54\x2a')]=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('227','\x5a\x69\x4c\x74')];var _0x3f503d=_0x571bbd;_0x571bbd=0x0;if(_0x53f1b3['\x4a\x6f\x54\x69\x44'](_0x3f503d,0x0)){if(_0x53f1b3[_0x2c70('228','\x4f\x57\x57\x56')](_0x53f1b3[_0x2c70('229','\x6c\x24\x30\x47')],_0x53f1b3[_0x2c70('22a','\x51\x4e\x33\x40')])){_0xe9671[_0x2c70('22b','\x4d\x26\x47\x28')][_0x2c70('22c','\x25\x6b\x2a\x73')]('\x76\x69',_0x15b567,[_0x3f503d]);}else{return 0x0;}}};return _0x1a258c;}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else if(_0x53f1b3['\x50\x42\x4a\x62\x52'](_0x10f5b3,0xe)){if(_0x53f1b3[_0x2c70('22d','\x51\x4e\x33\x40')](_0x53f1b3['\x71\x7a\x69\x4d\x55'],_0x53f1b3[_0x2c70('22e','\x47\x55\x50\x61')])){var _0x9acccd=_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'];if(_0x53f1b3[_0x2c70('22f','\x51\x4e\x33\x40')](0x0,--_0x9acccd[refid])){var _0x6545aa=_0x53f1b3[_0x2c70('230','\x6c\x57\x31\x41')][_0x2c70('231','\x59\x69\x5b\x63')]('\x7c'),_0x48c9b3=0x0;while(!![]){switch(_0x6545aa[_0x48c9b3++]){case'\x30':delete _0x9acccd[refid];continue;case'\x31':delete _0x586dd5[refid];continue;case'\x32':var _0x5ecdfd=_0x586dd5[refid];continue;case'\x33':var _0x586dd5=_0xe9671[_0x2c70('232','\x6d\x71\x73\x44')][_0x2c70('233','\x7a\x63\x78\x6d')];continue;case'\x34':_0x77b676[_0x2c70('234','\x77\x71\x76\x45')](_0x5ecdfd);continue;case'\x35':var _0x77b676=_0xe9671[_0x2c70('235','\x21\x4c\x76\x73')][_0x2c70('236','\x58\x25\x25\x4d')];continue;}break;}}}else{var _0x382cf1=_0x53f1b3[_0x2c70('237','\x49\x2a\x53\x35')][_0x2c70('238','\x40\x4d\x45\x24')]('\x7c'),_0x20084a=0x0;while(!![]){switch(_0x382cf1[_0x20084a++]){case'\x30':var _0x3e1bcc=_0xe9671[_0x2c70('18e','\x6c\x57\x31\x41')][_0x53f1b3['\x43\x43\x43\x4d\x49'](_0x53f1b3[_0x2c70('239','\x6d\x71\x73\x44')](_0x428036,0x8),0x4)];continue;case'\x31':switch(_0x3e1bcc){case 0x0:return _0xe9671[_0x2c70('23a','\x59\x69\x5b\x63')][_0x2c70('23b','\x35\x24\x67\x66')](_0x571bbd,_0x4c5b95);case 0x1:return _0xe9671[_0x2c70('23c','\x48\x26\x24\x50')][_0x2c70('23d','\x68\x4c\x57\x61')](_0x571bbd,_0x4c5b95);case 0x2:return _0xe9671['\x48\x45\x41\x50\x55\x31\x36'][_0x2c70('23e','\x39\x40\x64\x28')](_0x571bbd,_0x4c5b95);case 0x3:return _0xe9671[_0x2c70('23f','\x72\x49\x33\x6a')][_0x2c70('240','\x4a\x4e\x35\x6b')](_0x571bbd,_0x4c5b95);case 0x4:return _0xe9671[_0x2c70('241','\x4d\x26\x47\x28')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x571bbd,_0x4c5b95);case 0x5:return _0xe9671[_0x2c70('242','\x77\x71\x76\x45')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x571bbd,_0x4c5b95);case 0x6:return _0xe9671[_0x2c70('243','\x6c\x24\x30\x47')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x571bbd,_0x4c5b95);case 0x7:return _0xe9671[_0x2c70('244','\x4e\x30\x4e\x37')][_0x2c70('245','\x6c\x24\x30\x47')](_0x571bbd,_0x4c5b95);}continue;case'\x32':var _0x1cd043=_0xe9671[_0x2c70('246','\x47\x55\x50\x61')][_0x53f1b3[_0x2c70('247','\x4b\x71\x6c\x67')](_0x53f1b3[_0x2c70('248','\x67\x70\x57\x55')](_0x428036,0x4),0x4)];continue;case'\x33':var _0x571bbd=_0xe9671[_0x2c70('249','\x72\x49\x33\x6a')][_0x53f1b3['\x74\x72\x41\x4b\x72'](_0x428036,0x4)];continue;case'\x34':var _0x4c5b95=_0x53f1b3[_0x2c70('24a','\x6d\x71\x73\x44')](_0x571bbd,_0x1cd043);continue;}break;}}}else if(_0x53f1b3['\x50\x42\x4a\x62\x52'](_0x10f5b3,0xf)){if(_0x53f1b3[_0x2c70('24b','\x67\x70\x57\x55')](_0x53f1b3[_0x2c70('24c','\x6d\x71\x73\x44')],_0x53f1b3['\x55\x45\x69\x59\x78'])){_0x42e6b3[addr++]=_0x2aec55[_0x2c70('24d','\x4e\x30\x4e\x37')](0xe0,_0x2aec55[_0x2c70('24e','\x23\x62\x71\x78')](u,0xc));_0x42e6b3[addr++]=_0x2aec55[_0x2c70('24f','\x30\x29\x26\x4d')](0x80,_0x2aec55[_0x2c70('250','\x68\x4c\x57\x61')](_0x2aec55['\x76\x70\x6b\x52\x6e'](u,0x6),0x3f));_0x42e6b3[addr++]=_0x2aec55[_0x2c70('251','\x67\x4f\x63\x4c')](0x80,_0x2aec55['\x45\x41\x7a\x64\x4f'](u,0x3f));}else{return _0xe9671[_0x2c70('20c','\x4e\x26\x68\x2a')][_0x2c70('252','\x4e\x26\x68\x2a')](_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('253','\x28\x5b\x79\x45')](_0x428036,0x4)]);}}}else{HeartGift[_0x2c70('254','\x5a\x69\x4c\x74')]=0x0;HeartGift[_0x2c70('255','\x67\x70\x57\x55')]=!![];}};_0xe9671[_0x2c70('19c','\x4e\x30\x4e\x37')][_0x2c70('256','\x57\x53\x39\x64')]=function serialize_object(_0x3dc98f,_0x592873){var _0x5edc22=Object['\x6b\x65\x79\x73'](_0x592873);var _0x523047=_0x5edc22['\x6c\x65\x6e\x67\x74\x68'];var _0x44724d=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x53f1b3['\x52\x52\x6e\x54\x54'](_0x523047,0x8));var _0x55b674=_0xe9671[_0x2c70('257','\x58\x25\x25\x4d')][_0x2c70('258','\x62\x66\x34\x55')](_0x53f1b3[_0x2c70('259','\x4e\x26\x68\x2a')](_0x523047,0x10));_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x53f1b3[_0x2c70('25a','\x49\x6f\x39\x21')](_0x3dc98f,0xc)]=0x8;_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3['\x74\x72\x41\x4b\x72'](_0x3dc98f,0x4)]=_0x55b674;_0xe9671[_0x2c70('198','\x67\x4f\x63\x4c')][_0x53f1b3[_0x2c70('25b','\x4a\x4e\x35\x6b')](_0x53f1b3[_0x2c70('25c','\x49\x2a\x53\x35')](_0x3dc98f,0x4),0x4)]=_0x523047;_0xe9671[_0x2c70('25d','\x4a\x4e\x35\x6b')][_0x53f1b3['\x74\x72\x41\x4b\x72'](_0x53f1b3['\x4f\x75\x48\x47\x58'](_0x3dc98f,0x8),0x4)]=_0x44724d;for(var _0x1adcf3=0x0;_0x53f1b3['\x54\x57\x55\x64\x4c'](_0x1adcf3,_0x523047);++_0x1adcf3){if(_0x53f1b3[_0x2c70('25e','\x4e\x30\x4e\x37')](_0x53f1b3['\x72\x4a\x74\x4d\x69'],_0x53f1b3[_0x2c70('25f','\x58\x25\x25\x4d')])){var _0x1216a3=_0x5edc22[_0x1adcf3];var _0x1be0bf=_0x53f1b3[_0x2c70('260','\x4a\x4e\x35\x6b')](_0x44724d,_0x53f1b3['\x70\x4c\x61\x67\x68'](_0x1adcf3,0x8));_0xe9671[_0x2c70('261','\x51\x4e\x33\x40')][_0x2c70('262','\x49\x2a\x53\x35')](_0x1be0bf,_0x1216a3);_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('263','\x21\x4c\x76\x73')](_0x53f1b3[_0x2c70('264','\x6d\x71\x73\x44')](_0x55b674,_0x53f1b3[_0x2c70('265','\x58\x25\x25\x4d')](_0x1adcf3,0x10)),_0x592873[_0x1216a3]);}else{len+=0x2;}}};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79']=function serialize_array(_0x3e1a36,_0xd27ed){var _0xa3cb15=_0x53f1b3[_0x2c70('266','\x72\x49\x33\x6a')][_0x2c70('267','\x4e\x30\x4e\x37')]('\x7c'),_0xa3a9ea=0x0;while(!![]){switch(_0xa3cb15[_0xa3a9ea++]){case'\x30':var _0x32e83b=_0xe9671[_0x2c70('268','\x44\x46\x72\x69')]['\x61\x6c\x6c\x6f\x63'](_0x53f1b3[_0x2c70('269','\x62\x32\x54\x2a')](_0x1dd174,0x10));continue;case'\x31':_0xe9671[_0x2c70('26a','\x49\x6f\x39\x21')][_0x53f1b3['\x69\x4f\x72\x66\x61'](_0x3e1a36,0x4)]=_0x32e83b;continue;case'\x32':_0xe9671[_0x2c70('1c7','\x57\x53\x39\x64')][_0x53f1b3[_0x2c70('26b','\x69\x4f\x64\x63')](_0x53f1b3['\x41\x78\x4c\x55\x68'](_0x3e1a36,0x4),0x4)]=_0x1dd174;continue;case'\x33':for(var _0x52d34f=0x0;_0x53f1b3['\x54\x57\x55\x64\x4c'](_0x52d34f,_0x1dd174);++_0x52d34f){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x53f1b3['\x41\x78\x4c\x55\x68'](_0x32e83b,_0x53f1b3[_0x2c70('26c','\x28\x5b\x79\x45')](_0x52d34f,0x10)),_0xd27ed[_0x52d34f]);}continue;case'\x34':var _0x1dd174=_0xd27ed[_0x2c70('26d','\x39\x40\x64\x28')];continue;case'\x35':_0xe9671[_0x2c70('26e','\x63\x53\x25\x28')][_0x53f1b3['\x59\x7a\x77\x6b\x42'](_0x3e1a36,0xc)]=0x7;continue;}break;}};var _0x1b6ec6=_0x53f1b3[_0x2c70('26f','\x62\x66\x34\x55')](typeof TextEncoder,_0x53f1b3['\x56\x4c\x6b\x71\x41'])?new TextEncoder(_0x53f1b3[_0x2c70('270','\x48\x26\x24\x50')]):_0x53f1b3[_0x2c70('271','\x25\x6b\x2a\x73')](typeof util,_0x53f1b3['\x6a\x57\x63\x74\x77'])&&util&&_0x53f1b3[_0x2c70('272','\x63\x53\x25\x28')](typeof util[_0x2c70('273','\x69\x4f\x64\x63')],_0x53f1b3[_0x2c70('274','\x46\x50\x79\x57')])?new util[(_0x2c70('275','\x59\x69\x5b\x63'))](_0x53f1b3['\x50\x78\x4f\x65\x4b']):null;if(_0x53f1b3[_0x2c70('276','\x51\x4e\x33\x40')](_0x1b6ec6,null)){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('277','\x5d\x45\x4e\x32')]=function to_utf8_string(_0x2e8c89,_0xafbabb){var _0x2ca007=_0x1b6ec6['\x65\x6e\x63\x6f\x64\x65'](_0xafbabb);var _0x30c477=_0x2ca007[_0x2c70('278','\x49\x6f\x39\x21')];var _0x18b41e=0x0;if(_0x53f1b3[_0x2c70('279','\x4b\x71\x6c\x67')](_0x30c477,0x0)){if(_0x53f1b3['\x75\x61\x56\x74\x79'](_0x53f1b3[_0x2c70('27a','\x48\x26\x24\x50')],_0x53f1b3['\x79\x6a\x4c\x44\x46'])){return _0xe9671[_0x2c70('27b','\x49\x2a\x53\x35')]['\x67\x65\x74'](ptr)[_0x2c70('27c','\x72\x32\x62\x48')](null,args);}else{_0x18b41e=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('27d','\x5a\x69\x4c\x74')](_0x30c477);_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x2c70('27e','\x47\x55\x50\x61')](_0x2ca007,_0x18b41e);}}_0xe9671[_0x2c70('27f','\x39\x40\x64\x28')][_0x53f1b3[_0x2c70('280','\x63\x4a\x67\x45')](_0x2e8c89,0x4)]=_0x18b41e;_0xe9671[_0x2c70('281','\x64\x30\x46\x39')][_0x53f1b3[_0x2c70('282','\x4e\x26\x68\x2a')](_0x53f1b3[_0x2c70('283','\x7a\x63\x78\x6d')](_0x2e8c89,0x4),0x4)]=_0x30c477;};}else{if(_0x53f1b3[_0x2c70('284','\x6c\x24\x30\x47')](_0x53f1b3['\x77\x6c\x4e\x51\x6e'],_0x53f1b3[_0x2c70('285','\x25\x6b\x2a\x73')])){r=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('286','\x4b\x5e\x4b\x69')](r),_0xe9671[_0x2c70('287','\x46\x50\x79\x57')][_0x2c70('288','\x77\x71\x76\x45')](t,r[_0x2c70('289','\x62\x32\x54\x2a')]);}else{_0xe9671[_0x2c70('224','\x64\x30\x46\x39')][_0x2c70('28a','\x35\x55\x24\x48')]=function to_utf8_string(_0x29e184,_0x227faf){var _0x4f8ad4=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('28b','\x6c\x57\x31\x41')](_0x227faf);var _0x19332c=0x0;if(_0x53f1b3[_0x2c70('28c','\x62\x66\x34\x55')](_0x4f8ad4,0x0)){if(_0x53f1b3[_0x2c70('28d','\x6c\x57\x31\x41')](_0x53f1b3[_0x2c70('28e','\x5a\x69\x4c\x74')],_0x53f1b3[_0x2c70('28f','\x62\x32\x54\x2a')])){_0x19332c=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('290','\x63\x4a\x67\x45')](_0x4f8ad4);_0xe9671[_0x2c70('291','\x4a\x4e\x35\x6b')][_0x2c70('292','\x35\x24\x67\x66')](_0x227faf,_0x19332c);}else{return{'\x76\x61\x6c\x75\x65':r[_0x2c70('293','\x49\x2a\x53\x35')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('294','\x4e\x26\x68\x2a')](_0x29e184,0x4)]=_0x19332c;_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('295','\x40\x4d\x45\x24')](_0x53f1b3[_0x2c70('296','\x4e\x30\x4e\x37')](_0x29e184,0x4),0x4)]=_0x4f8ad4;};}}_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('297','\x4e\x30\x4e\x37')]=function from_js(_0x33cf78,_0x4290e5){var _0x149bc2={'\x55\x70\x6f\x70\x52':function(_0xc81e9f,_0x30d244){return _0x53f1b3[_0x2c70('298','\x6c\x24\x30\x47')](_0xc81e9f,_0x30d244);},'\x5a\x79\x4f\x72\x78':function(_0x1ca60f,_0x1fa4d1){return _0x53f1b3[_0x2c70('299','\x64\x30\x46\x39')](_0x1ca60f,_0x1fa4d1);}};if(_0x53f1b3[_0x2c70('29a','\x7a\x4b\x53\x44')](_0x53f1b3['\x79\x56\x55\x48\x50'],_0x53f1b3['\x79\x56\x55\x48\x50'])){t=_0xe9671[_0x2c70('29b','\x5a\x69\x4c\x74')][_0x2c70('29c','\x62\x32\x54\x2a')](t),_0xe9671[_0x2c70('1a2','\x30\x29\x26\x4d')][_0x2c70('29d','\x35\x24\x67\x66')](t);}else{var _0x2a9773=Object[_0x2c70('29e','\x67\x70\x57\x55')]['\x74\x6f\x53\x74\x72\x69\x6e\x67'][_0x2c70('29f','\x62\x32\x54\x2a')](_0x4290e5);if(_0x53f1b3['\x45\x58\x6e\x43\x56'](_0x2a9773,_0x53f1b3[_0x2c70('2a0','\x5d\x45\x4e\x32')])){_0xe9671[_0x2c70('2a1','\x78\x71\x61\x43')][_0x53f1b3['\x53\x68\x78\x53\x4b'](_0x33cf78,0xc)]=0x4;_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('2a2','\x40\x4d\x45\x24')](_0x33cf78,_0x4290e5);}else if(_0x53f1b3['\x7a\x63\x43\x6d\x51'](_0x2a9773,_0x53f1b3['\x70\x54\x53\x42\x43'])){if(_0x53f1b3[_0x2c70('2a3','\x4b\x71\x6c\x67')](_0x4290e5,_0x53f1b3['\x78\x49\x59\x74\x53'](_0x4290e5,0x0))){if(_0x53f1b3[_0x2c70('2a4','\x6d\x71\x73\x44')](_0x53f1b3[_0x2c70('2a5','\x77\x71\x76\x45')],_0x53f1b3[_0x2c70('2a6','\x4d\x26\x47\x28')])){if(_0x53f1b3[_0x2c70('2a7','\x38\x76\x21\x24')](_0x2a9773,0xc)||_0x53f1b3[_0x2c70('2a8','\x23\x62\x71\x78')](_0x2a9773,0xd)){throw new ReferenceError(_0x53f1b3['\x6d\x4d\x48\x6c\x4f']);}}else{_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x53f1b3[_0x2c70('2a9','\x47\x55\x50\x61')](_0x33cf78,0xc)]=0x2;_0xe9671[_0x2c70('1ad','\x58\x25\x25\x4d')][_0x53f1b3['\x65\x73\x5a\x78\x6d'](_0x33cf78,0x4)]=_0x4290e5;}}else{if(_0x53f1b3['\x70\x62\x62\x73\x48'](_0x53f1b3[_0x2c70('2aa','\x40\x4d\x45\x24')],_0x53f1b3['\x69\x44\x48\x68\x4b'])){var _0xcdcd2d=_0x53f1b3[_0x2c70('2ab','\x56\x4b\x47\x68')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x3d9143=0x0;while(!![]){switch(_0xcdcd2d[_0x3d9143++]){case'\x30':var _0x1034e2=[];continue;case'\x31':var _0x4e9e5c=_0x53f1b3[_0x2c70('2ac','\x46\x50\x79\x57')](_0xe9671[_0x2c70('232','\x6d\x71\x73\x44')][_0x2c70('1a3','\x7a\x63\x78\x6d')],_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('2ad','\x72\x49\x33\x6a')](_0x33cf78,0x4)]);continue;case'\x32':return _0x1034e2;case'\x33':var _0x22f639=_0xe9671[_0x2c70('2ae','\x77\x71\x76\x45')][_0x53f1b3[_0x2c70('2af','\x54\x4c\x24\x40')](_0x53f1b3[_0x2c70('2b0','\x40\x4d\x45\x24')](_0x33cf78,0x4),0x4)];continue;case'\x34':for(var _0xef6a73=0x0;_0x53f1b3[_0x2c70('2b1','\x21\x25\x46\x6e')](_0xef6a73,_0x22f639);++_0xef6a73){_0x1034e2['\x70\x75\x73\x68'](_0xe9671[_0x2c70('154','\x62\x32\x54\x2a')]['\x74\x6f\x5f\x6a\x73'](_0x53f1b3['\x42\x4f\x53\x70\x71'](_0x4e9e5c,_0x53f1b3[_0x2c70('2b2','\x63\x53\x25\x28')](_0xef6a73,0x10))));}continue;}break;}}else{_0xe9671[_0x2c70('17a','\x6c\x57\x31\x41')][_0x53f1b3[_0x2c70('2b3','\x47\x55\x50\x61')](_0x33cf78,0xc)]=0x3;_0xe9671[_0x2c70('2b4','\x4d\x26\x47\x28')][_0x53f1b3[_0x2c70('2b5','\x47\x55\x50\x61')](_0x33cf78,0x8)]=_0x4290e5;}}}else if(_0x53f1b3[_0x2c70('2b6','\x28\x5b\x79\x45')](_0x4290e5,null)){_0xe9671[_0x2c70('2b7','\x21\x4c\x76\x73')][_0x53f1b3[_0x2c70('2b8','\x49\x2a\x53\x35')](_0x33cf78,0xc)]=0x1;}else if(_0x53f1b3[_0x2c70('2b9','\x6c\x57\x31\x41')](_0x4290e5,undefined)){_0xe9671[_0x2c70('2ba','\x39\x40\x64\x28')][_0x53f1b3[_0x2c70('2bb','\x6d\x71\x73\x44')](_0x33cf78,0xc)]=0x0;}else if(_0x53f1b3[_0x2c70('2bc','\x46\x50\x79\x57')](_0x4290e5,![])){if(_0x53f1b3[_0x2c70('2bd','\x78\x71\x61\x43')](_0x53f1b3[_0x2c70('2be','\x4a\x4e\x35\x6b')],_0x53f1b3[_0x2c70('2bf','\x51\x4e\x33\x40')])){_0xe9671[_0x2c70('2c0','\x57\x53\x39\x64')][_0x149bc2[_0x2c70('2c1','\x38\x76\x21\x24')](_0x33cf78,0xc)]=0x2;_0xe9671['\x48\x45\x41\x50\x33\x32'][_0x149bc2[_0x2c70('2c2','\x21\x4c\x76\x73')](_0x33cf78,0x4)]=_0x4290e5;}else{_0xe9671[_0x2c70('2c3','\x46\x50\x79\x57')][_0x53f1b3[_0x2c70('2c4','\x25\x6b\x2a\x73')](_0x33cf78,0xc)]=0x5;}}else if(_0x53f1b3[_0x2c70('2c5','\x4b\x5e\x4b\x69')](_0x4290e5,!![])){_0xe9671[_0x2c70('2c6','\x64\x30\x46\x39')][_0x53f1b3[_0x2c70('2c7','\x62\x32\x54\x2a')](_0x33cf78,0xc)]=0x6;}else if(_0x53f1b3[_0x2c70('2c8','\x54\x4c\x24\x40')](_0x2a9773,_0x53f1b3[_0x2c70('2c9','\x67\x70\x57\x55')])){if(_0x53f1b3[_0x2c70('2ca','\x62\x66\x34\x55')](_0x53f1b3['\x54\x41\x64\x72\x49'],_0x53f1b3['\x73\x6d\x74\x51\x51'])){var _0x4e3b34=_0xe9671[_0x2c70('257','\x58\x25\x25\x4d')][_0x2c70('2cb','\x48\x26\x24\x50')](_0x4290e5);_0xe9671[_0x2c70('2cc','\x67\x4f\x63\x4c')][_0x53f1b3[_0x2c70('2cd','\x72\x32\x62\x48')](_0x33cf78,0xc)]=0xf;_0xe9671[_0x2c70('2ce','\x64\x30\x46\x39')][_0x53f1b3[_0x2c70('2cf','\x4d\x26\x47\x28')](_0x33cf78,0x4)]=_0x4e3b34;}else{try{return{'\x76\x61\x6c\x75\x65':r['\x68\x72\x65\x66'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x479a45){return{'\x65\x72\x72\x6f\x72':_0x479a45,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}else{if(_0x53f1b3[_0x2c70('2d0','\x4e\x30\x4e\x37')](_0x53f1b3['\x55\x74\x4c\x67\x77'],_0x53f1b3['\x55\x74\x4c\x67\x77'])){_0xe9671[_0x2c70('268','\x44\x46\x72\x69')][_0x2c70('2d1','\x54\x4c\x24\x40')]=_0xe9671[_0x2c70('22b','\x4d\x26\x47\x28')][_0x2c70('2d2','\x7a\x4b\x53\x44')](t);}else{var _0x42c69c=_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')][_0x2c70('2d4','\x38\x76\x21\x24')](_0x4290e5);_0xe9671[_0x2c70('2d5','\x44\x46\x72\x69')][_0x53f1b3[_0x2c70('2d6','\x62\x66\x34\x55')](_0x33cf78,0xc)]=0x9;_0xe9671[_0x2c70('2d7','\x68\x4c\x57\x61')][_0x53f1b3[_0x2c70('2d8','\x72\x32\x62\x48')](_0x33cf78,0x4)]=_0x42c69c;}}}};var _0x29dfb6=_0x53f1b3['\x44\x52\x62\x43\x59'](typeof TextDecoder,_0x53f1b3[_0x2c70('2d9','\x5d\x45\x4e\x32')])?new TextDecoder(_0x53f1b3[_0x2c70('2da','\x30\x29\x26\x4d')]):_0x53f1b3['\x66\x6a\x70\x43\x43'](typeof util,_0x53f1b3[_0x2c70('2db','\x25\x6b\x2a\x73')])&&util&&_0x53f1b3[_0x2c70('2dc','\x5a\x69\x4c\x74')](typeof util['\x54\x65\x78\x74\x44\x65\x63\x6f\x64\x65\x72'],_0x53f1b3[_0x2c70('2dd','\x38\x76\x21\x24')])?new util[(_0x2c70('2de','\x62\x32\x54\x2a'))](_0x53f1b3[_0x2c70('2df','\x67\x4f\x63\x4c')]):null;if(_0x53f1b3['\x4a\x6f\x54\x69\x44'](_0x29dfb6,null)){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x22b0d5,_0x503a5b){return _0x29dfb6['\x64\x65\x63\x6f\x64\x65'](_0xe9671[_0x2c70('2d5','\x44\x46\x72\x69')][_0x2c70('2e0','\x69\x4f\x64\x63')](_0x22b0d5,_0x53f1b3['\x65\x4f\x49\x67\x67'](_0x22b0d5,_0x503a5b)));};}else{_0xe9671[_0x2c70('2e1','\x21\x25\x46\x6e')][_0x2c70('2e2','\x46\x50\x79\x57')]=function to_js_string(_0x587a34,_0x2a55a2){var _0x3e5e94=_0x53f1b3[_0x2c70('2e3','\x6c\x24\x30\x47')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x2d2cf8=0x0;while(!![]){switch(_0x3e5e94[_0x2d2cf8++]){case'\x30':_0x2a55a2=_0x53f1b3[_0x2c70('2e4','\x67\x70\x57\x55')](_0x2a55a2,0x0);continue;case'\x31':while(_0x53f1b3['\x61\x70\x4c\x47\x70'](_0x587a34,_0x36d873)){var _0x447e4d=_0x4dbf64[_0x587a34++];if(_0x53f1b3[_0x2c70('2e5','\x7a\x4b\x53\x44')](_0x447e4d,0x80)){_0x3c34a3+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x447e4d);continue;}var _0x5ad39c=_0x53f1b3[_0x2c70('2e6','\x59\x69\x5b\x63')](_0x447e4d,_0x53f1b3[_0x2c70('2e7','\x51\x4e\x33\x40')](0x7f,0x2));var _0xe6c699=0x0;if(_0x53f1b3[_0x2c70('2e8','\x67\x4f\x63\x4c')](_0x587a34,_0x36d873)){if(_0x53f1b3['\x56\x49\x4f\x73\x68'](_0x53f1b3[_0x2c70('2e9','\x4a\x4e\x35\x6b')],_0x53f1b3[_0x2c70('2ea','\x35\x24\x67\x66')])){return t[_0x2c70('2eb','\x51\x4e\x33\x40')]();}else{_0xe6c699=_0x4dbf64[_0x587a34++];}}var _0x551fbb=_0x53f1b3['\x74\x52\x6f\x58\x78'](_0x53f1b3[_0x2c70('2ec','\x4b\x71\x6c\x67')](_0x5ad39c,0x6),_0x53f1b3['\x41\x4e\x59\x54\x54'](_0xe6c699,0x3f));if(_0x53f1b3[_0x2c70('2ed','\x72\x49\x33\x6a')](_0x447e4d,0xe0)){var _0x2a6f77=0x0;if(_0x53f1b3[_0x2c70('2ee','\x35\x24\x67\x66')](_0x587a34,_0x36d873)){_0x2a6f77=_0x4dbf64[_0x587a34++];}var _0x3abbe6=_0x53f1b3[_0x2c70('2ef','\x4b\x5e\x4b\x69')](_0x53f1b3[_0x2c70('2f0','\x59\x69\x5b\x63')](_0x53f1b3[_0x2c70('2f1','\x69\x4f\x64\x63')](_0xe6c699,0x3f),0x6),_0x53f1b3[_0x2c70('2f2','\x51\x4e\x33\x40')](_0x2a6f77,0x3f));_0x551fbb=_0x53f1b3['\x4e\x77\x66\x46\x70'](_0x53f1b3['\x6c\x71\x72\x6b\x74'](_0x5ad39c,0xc),_0x3abbe6);if(_0x53f1b3[_0x2c70('2f3','\x21\x4c\x76\x73')](_0x447e4d,0xf0)){var _0x36e8b1=0x0;if(_0x53f1b3[_0x2c70('2f4','\x38\x76\x21\x24')](_0x587a34,_0x36d873)){if(_0x53f1b3[_0x2c70('2f5','\x6d\x71\x73\x44')](_0x53f1b3[_0x2c70('2f6','\x30\x29\x26\x4d')],_0x53f1b3[_0x2c70('2f7','\x59\x69\x5b\x63')])){_0x36e8b1=_0x4dbf64[_0x587a34++];}else{var _0x5b3471=_0xf680d['\x56\x45\x70\x4f\x57'][_0x2c70('2f8','\x35\x55\x24\x48')]('\x7c'),_0x4f448e=0x0;while(!![]){switch(_0x5b3471[_0x4f448e++]){case'\x30':_0x4dbf64[addr++]=_0xf680d[_0x2c70('2f9','\x30\x29\x26\x4d')](0xf8,_0xf680d[_0x2c70('2fa','\x44\x46\x72\x69')](u,0x18));continue;case'\x31':_0x4dbf64[addr++]=_0xf680d[_0x2c70('2fb','\x4e\x26\x68\x2a')](0x80,_0xf680d[_0x2c70('2fc','\x69\x4f\x64\x63')](_0xf680d[_0x2c70('2fd','\x5d\x45\x4e\x32')](u,0x6),0x3f));continue;case'\x32':_0x4dbf64[addr++]=_0xf680d[_0x2c70('2fe','\x23\x62\x71\x78')](0x80,_0xf680d[_0x2c70('2ff','\x48\x26\x24\x50')](_0xf680d[_0x2c70('300','\x35\x55\x24\x48')](u,0xc),0x3f));continue;case'\x33':_0x4dbf64[addr++]=_0xf680d[_0x2c70('301','\x38\x76\x21\x24')](0x80,_0xf680d[_0x2c70('302','\x47\x55\x50\x61')](u,0x3f));continue;case'\x34':_0x4dbf64[addr++]=_0xf680d[_0x2c70('303','\x4d\x26\x47\x28')](0x80,_0xf680d['\x7a\x76\x42\x56\x62'](_0xf680d[_0x2c70('304','\x72\x32\x62\x48')](u,0x12),0x3f));continue;}break;}}}_0x551fbb=_0x53f1b3[_0x2c70('305','\x44\x46\x72\x69')](_0x53f1b3['\x6c\x71\x72\x6b\x74'](_0x53f1b3[_0x2c70('306','\x4d\x26\x47\x28')](_0x5ad39c,0x7),0x12),_0x53f1b3['\x46\x52\x78\x68\x51'](_0x53f1b3[_0x2c70('307','\x35\x24\x67\x66')](_0x3abbe6,0x6),_0x53f1b3[_0x2c70('308','\x4d\x26\x47\x28')](_0x36e8b1,0x3f)));_0x3c34a3+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x53f1b3[_0x2c70('309','\x62\x66\x34\x55')](0xd7c0,_0x53f1b3[_0x2c70('30a','\x30\x29\x26\x4d')](_0x551fbb,0xa)));_0x551fbb=_0x53f1b3[_0x2c70('30b','\x54\x4c\x24\x40')](0xdc00,_0x53f1b3[_0x2c70('30c','\x67\x4f\x63\x4c')](_0x551fbb,0x3ff));}}_0x3c34a3+=String[_0x2c70('30d','\x49\x6f\x39\x21')](_0x551fbb);continue;}continue;case'\x32':return _0x3c34a3;case'\x33':var _0x4dbf64=_0xe9671['\x48\x45\x41\x50\x55\x38'];continue;case'\x34':var _0xf680d={'\x56\x45\x70\x4f\x57':_0x53f1b3[_0x2c70('30e','\x63\x4a\x67\x45')],'\x79\x5a\x56\x56\x4a':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('30f','\x67\x4f\x63\x4c')](_0x447e4d,_0xe6c699);},'\x43\x67\x73\x4d\x4c':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('310','\x44\x46\x72\x69')](_0x447e4d,_0xe6c699);},'\x4b\x75\x73\x78\x69':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('311','\x78\x71\x61\x43')](_0x447e4d,_0xe6c699);},'\x71\x48\x44\x75\x4a':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('312','\x47\x55\x50\x61')](_0x447e4d,_0xe6c699);},'\x4f\x52\x7a\x5a\x7a':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('313','\x68\x4c\x57\x61')](_0x447e4d,_0xe6c699);},'\x7a\x76\x42\x56\x62':function(_0x447e4d,_0xe6c699){return _0x53f1b3[_0x2c70('314','\x63\x53\x25\x28')](_0x447e4d,_0xe6c699);},'\x70\x56\x57\x55\x50':function(_0x447e4d,_0xe6c699){return _0x53f1b3['\x4c\x66\x6e\x59\x66'](_0x447e4d,_0xe6c699);}};continue;case'\x35':var _0x36d873=_0x53f1b3[_0x2c70('315','\x64\x30\x46\x39')](_0x53f1b3[_0x2c70('316','\x48\x26\x24\x50')](_0x587a34,0x0),_0x53f1b3[_0x2c70('317','\x6c\x24\x30\x47')](_0x2a55a2,0x0));continue;case'\x36':var _0x3c34a3='';continue;case'\x37':_0x587a34=_0x53f1b3[_0x2c70('318','\x63\x4a\x67\x45')](_0x587a34,0x0);continue;}break;}};}_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('319','\x4e\x30\x4e\x37')]={};_0xe9671[_0x2c70('1c4','\x7a\x63\x78\x6d')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70']={};_0xe9671[_0x2c70('31a','\x59\x69\x5b\x63')][_0x2c70('31b','\x78\x71\x61\x43')]=new WeakMap();_0xe9671[_0x2c70('191','\x78\x71\x61\x43')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b']=new Map();_0xe9671[_0x2c70('31c','\x57\x53\x39\x64')]['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']=0x1;_0xe9671[_0x2c70('261','\x51\x4e\x33\x40')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70']={};_0xe9671[_0x2c70('31d','\x67\x4f\x63\x4c')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']=0x1;_0xe9671[_0x2c70('29b','\x5a\x69\x4c\x74')][_0x2c70('31e','\x4d\x26\x47\x28')]=function(_0xab2b32){var _0x1547fe={'\x71\x71\x52\x50\x44':_0x53f1b3[_0x2c70('31f','\x49\x2a\x53\x35')]};if(_0x53f1b3['\x70\x50\x6f\x78\x4a'](_0x53f1b3[_0x2c70('320','\x47\x55\x50\x61')],_0x53f1b3[_0x2c70('321','\x30\x29\x26\x4d')])){if(_0x53f1b3[_0x2c70('322','\x25\x6b\x2a\x73')](_0xab2b32,undefined)||_0x53f1b3[_0x2c70('323','\x44\x46\x72\x69')](_0xab2b32,null)){return 0x0;}var _0x30c717=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('324','\x63\x53\x25\x28')];var _0x56a569=_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'];var _0x17908e=_0xe9671[_0x2c70('291','\x4a\x4e\x35\x6b')][_0x2c70('325','\x4d\x26\x47\x28')];var _0x2081bf=_0xe9671[_0x2c70('1ec','\x77\x71\x76\x45')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'];var _0x298b71=_0x17908e[_0x2c70('326','\x4b\x71\x6c\x67')](_0xab2b32);if(_0x53f1b3['\x53\x4d\x47\x70\x45'](_0x298b71,undefined)){if(_0x53f1b3[_0x2c70('327','\x4b\x71\x6c\x67')](_0x53f1b3['\x63\x75\x6a\x41\x79'],_0x53f1b3['\x45\x75\x79\x44\x52'])){_0x298b71=_0x2081bf[_0x2c70('328','\x35\x55\x24\x48')](_0xab2b32);}else{return _0xe9671[_0x2c70('329','\x63\x4a\x67\x45')][_0x2c70('1cb','\x21\x4c\x76\x73')](_0xe9671[_0x2c70('32a','\x35\x55\x24\x48')][_0x53f1b3[_0x2c70('32b','\x68\x4c\x57\x61')](address,0x4)]);}}if(_0x53f1b3[_0x2c70('32c','\x7a\x4b\x53\x44')](_0x298b71,undefined)){if(_0x53f1b3[_0x2c70('32d','\x57\x53\x39\x64')](_0x53f1b3['\x59\x48\x42\x69\x47'],_0x53f1b3[_0x2c70('32e','\x62\x32\x54\x2a')])){return f[_0x2c70('32f','\x47\x55\x50\x61')](r,t);}else{_0x298b71=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{_0x17908e['\x73\x65\x74'](_0xab2b32,_0x298b71);}catch(_0x51060d){if(_0x53f1b3['\x58\x57\x59\x6f\x46'](_0x53f1b3[_0x2c70('330','\x44\x46\x72\x69')],_0x53f1b3[_0x2c70('331','\x62\x66\x34\x55')])){_0x2081bf[_0x2c70('332','\x67\x4f\x63\x4c')](_0xab2b32,_0x298b71);}else{throw new ReferenceError(_0x1547fe[_0x2c70('333','\x28\x5b\x79\x45')]);}}}}if(_0x53f1b3[_0x2c70('334','\x35\x55\x24\x48')](_0x298b71,_0x56a569)){_0x30c717[_0x298b71]++;}else{_0x56a569[_0x298b71]=_0xab2b32;_0x30c717[_0x298b71]=0x1;}return _0x298b71;}else{return{'\x76\x61\x6c\x75\x65':r[_0x2c70('335','\x25\x6b\x2a\x73')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65']=function(_0xc941cf){return _0xe9671[_0x2c70('7f','\x4b\x5e\x4b\x69')][_0x2c70('336','\x62\x32\x54\x2a')][_0xc941cf];};_0xe9671[_0x2c70('337','\x35\x55\x24\x48')][_0x2c70('338','\x48\x26\x24\x50')]=function(_0xa862fb){_0xe9671[_0x2c70('339','\x7a\x4b\x53\x44')][_0x2c70('33a','\x67\x4f\x63\x4c')][_0xa862fb]++;};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x5941b2){var _0xb3bc82=_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'];if(_0x53f1b3[_0x2c70('33b','\x69\x4f\x64\x63')](0x0,--_0xb3bc82[_0x5941b2])){if(_0x53f1b3[_0x2c70('33c','\x49\x6f\x39\x21')](_0x53f1b3['\x42\x64\x79\x6b\x61'],_0x53f1b3[_0x2c70('33d','\x39\x40\x64\x28')])){num_ongoing_calls+=0x1;_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')][_0x2c70('33e','\x35\x24\x67\x66')](_0x53f1b3[_0x2c70('33f','\x63\x4a\x67\x45')],adapter_pointer,[function_pointer,args]);_0xe9671[_0x2c70('224','\x64\x30\x46\x39')][_0x2c70('340','\x67\x70\x57\x55')]=null;var _0x29e21a=_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')][_0x2c70('341','\x44\x46\x72\x69')];}else{var _0x5cf4a8=_0x53f1b3['\x65\x4d\x4c\x72\x47'][_0x2c70('342','\x67\x4f\x63\x4c')]('\x7c'),_0x72094d=0x0;while(!![]){switch(_0x5cf4a8[_0x72094d++]){case'\x30':_0x52992b[_0x2c70('343','\x6c\x57\x31\x41')](_0xb03698);continue;case'\x31':delete _0x5d2f97[_0x5941b2];continue;case'\x32':var _0x5d2f97=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('344','\x58\x25\x25\x4d')];continue;case'\x33':var _0xb03698=_0x5d2f97[_0x5941b2];continue;case'\x34':var _0x52992b=_0xe9671[_0x2c70('345','\x4f\x57\x57\x56')][_0x2c70('346','\x4b\x71\x6c\x67')];continue;case'\x35':delete _0xb3bc82[_0x5941b2];continue;}break;}}}};_0xe9671[_0x2c70('1c4','\x7a\x63\x78\x6d')][_0x2c70('347','\x4a\x4e\x35\x6b')]=function(_0x3b24dc){if(_0x53f1b3[_0x2c70('348','\x4b\x5e\x4b\x69')](_0x53f1b3['\x52\x62\x63\x62\x4f'],_0x53f1b3[_0x2c70('349','\x35\x24\x67\x66')])){r=_0xe9671[_0x2c70('34a','\x35\x24\x67\x66')]['\x74\x6f\x5f\x6a\x73'](r),_0xe9671[_0x2c70('7f','\x4b\x5e\x4b\x69')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x2c70('34b','\x77\x71\x76\x45')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x25f564){return{'\x65\x72\x72\x6f\x72':_0x25f564,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{var _0x3d1697=_0xe9671[_0x2c70('1ec','\x77\x71\x76\x45')][_0x2c70('34c','\x4b\x5e\x4b\x69')]++;_0xe9671[_0x2c70('261','\x51\x4e\x33\x40')][_0x2c70('34d','\x78\x71\x61\x43')][_0x3d1697]=_0x3b24dc;return _0x3d1697;}};_0xe9671[_0x2c70('34e','\x23\x62\x71\x78')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x1c15b3){if(_0x53f1b3[_0x2c70('34f','\x40\x4d\x45\x24')](_0x53f1b3[_0x2c70('350','\x5d\x45\x4e\x32')],_0x53f1b3[_0x2c70('351','\x6c\x57\x31\x41')])){_0xe9671[_0x2c70('352','\x35\x55\x24\x48')][_0x53f1b3[_0x2c70('353','\x6d\x71\x73\x44')](address,0xc)]=0x3;_0xe9671['\x48\x45\x41\x50\x46\x36\x34'][_0x53f1b3[_0x2c70('354','\x38\x76\x21\x24')](address,0x8)]=value;}else{delete _0xe9671[_0x2c70('355','\x63\x53\x25\x28')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x1c15b3];}};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x67\x65\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0xc9d371){return _0xe9671[_0x2c70('356','\x40\x4d\x45\x24')][_0x2c70('357','\x57\x53\x39\x64')][_0xc9d371];};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63']=function alloc(_0x3b5f0d){return _0xe9671[_0x2c70('358','\x54\x4c\x24\x40')](_0x3b5f0d);};_0xe9671[_0x2c70('355','\x63\x53\x25\x28')][_0x2c70('359','\x4d\x26\x47\x28')]=function(_0x41a442,_0x393e13,_0x46d1f8){if(_0x53f1b3['\x58\x57\x59\x6f\x46'](_0x53f1b3[_0x2c70('35a','\x4f\x57\x57\x56')],_0x53f1b3[_0x2c70('35b','\x35\x24\x67\x66')])){return _0xe9671[_0x2c70('35c','\x59\x69\x5b\x63')][_0x2c70('35d','\x21\x25\x46\x6e')](_0x393e13)[_0x2c70('35e','\x35\x24\x67\x66')](null,_0x46d1f8);}else{_0xe9671[_0x2c70('345','\x4f\x57\x57\x56')][_0x2c70('35f','\x56\x4b\x47\x68')](t);}};_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('360','\x63\x53\x25\x28')]=function utf8_len(_0x27e331){var _0x111878=0x0;for(var _0x53d7b3=0x0;_0x53f1b3[_0x2c70('361','\x35\x24\x67\x66')](_0x53d7b3,_0x27e331['\x6c\x65\x6e\x67\x74\x68']);++_0x53d7b3){var _0x491a97=_0x27e331[_0x2c70('362','\x44\x46\x72\x69')](_0x53d7b3);if(_0x53f1b3[_0x2c70('363','\x51\x4e\x33\x40')](_0x491a97,0xd800)&&_0x53f1b3['\x67\x52\x65\x57\x79'](_0x491a97,0xdfff)){_0x491a97=_0x53f1b3['\x73\x74\x6a\x6c\x6f'](_0x53f1b3['\x6c\x63\x6f\x43\x7a'](0x10000,_0x53f1b3[_0x2c70('364','\x4a\x4e\x35\x6b')](_0x53f1b3['\x56\x75\x53\x76\x66'](_0x491a97,0x3ff),0xa)),_0x53f1b3[_0x2c70('365','\x62\x66\x34\x55')](_0x27e331[_0x2c70('366','\x21\x25\x46\x6e')](++_0x53d7b3),0x3ff));}if(_0x53f1b3[_0x2c70('367','\x6c\x57\x31\x41')](_0x491a97,0x7f)){if(_0x53f1b3['\x7a\x45\x52\x6f\x42'](_0x53f1b3['\x53\x56\x65\x70\x41'],_0x53f1b3['\x53\x56\x65\x70\x41'])){var _0x5f492c=_0x53f1b3[_0x2c70('368','\x47\x55\x50\x61')](_0x53f1b3[_0x2c70('369','\x28\x5b\x79\x45')](0x10,Math[_0x2c70('36a','\x54\x4c\x24\x40')]()),0x0);return(_0x53f1b3['\x58\x57\x59\x6f\x46']('\x78',t)?_0x5f492c:_0x53f1b3[_0x2c70('36b','\x4b\x5e\x4b\x69')](_0x53f1b3[_0x2c70('36c','\x6d\x71\x73\x44')](0x3,_0x5f492c),0x8))['\x74\x6f\x53\x74\x72\x69\x6e\x67'](0x10);}else{++_0x111878;}}else if(_0x53f1b3['\x6f\x64\x55\x4e\x4d'](_0x491a97,0x7ff)){_0x111878+=0x2;}else if(_0x53f1b3[_0x2c70('36d','\x4e\x30\x4e\x37')](_0x491a97,0xffff)){if(_0x53f1b3['\x75\x44\x63\x76\x41'](_0x53f1b3[_0x2c70('36e','\x49\x2a\x53\x35')],_0x53f1b3['\x53\x4c\x76\x71\x72'])){var _0x2898d7=_0xe9671[_0x2c70('7f','\x4b\x5e\x4b\x69')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70'](_0xe9671['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x2c70('36f','\x30\x29\x26\x4d')](_0xe9671[_0x2c70('370','\x49\x6f\x39\x21')][_0x2c70('371','\x4a\x4e\x35\x6b')](t),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](r)));return _0x2898d7;}else{_0x111878+=0x3;}}else if(_0x53f1b3[_0x2c70('372','\x67\x4f\x63\x4c')](_0x491a97,0x1fffff)){_0x111878+=0x4;}else if(_0x53f1b3[_0x2c70('373','\x4a\x4e\x35\x6b')](_0x491a97,0x3ffffff)){_0x111878+=0x5;}else{_0x111878+=0x6;}}return _0x111878;};_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')][_0x2c70('374','\x62\x32\x54\x2a')]=function(_0x24e170){if(_0x53f1b3[_0x2c70('375','\x6c\x57\x31\x41')](_0x53f1b3['\x78\x63\x6a\x66\x50'],_0x53f1b3[_0x2c70('376','\x7a\x63\x78\x6d')])){var _0x458f41=_0xe9671[_0x2c70('356','\x40\x4d\x45\x24')]['\x61\x6c\x6c\x6f\x63'](0x10);_0xe9671[_0x2c70('235','\x21\x4c\x76\x73')][_0x2c70('377','\x56\x4b\x47\x68')](_0x458f41,_0x24e170);return _0x458f41;}else{r=_0xe9671[_0x2c70('11f','\x38\x76\x21\x24')]['\x74\x6f\x5f\x6a\x73'](r),_0xe9671[_0x2c70('291','\x4a\x4e\x35\x6b')][_0x2c70('378','\x4a\x4e\x35\x6b')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x2c70('379','\x35\x55\x24\x48')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x59debd){return{'\x65\x72\x72\x6f\x72':_0x59debd,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}};_0xe9671[_0x2c70('268','\x44\x46\x72\x69')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70']=function(_0x439a85){var _0x6c36ae=_0xe9671[_0x2c70('345','\x4f\x57\x57\x56')][_0x2c70('37a','\x78\x71\x61\x43')];_0xe9671[_0x2c70('156','\x25\x6b\x2a\x73')]['\x74\x6d\x70']=null;return _0x6c36ae;};var _0x3fb0db=null;var _0x26705a=null;var _0x61c527=null;var _0x42e6b3=null;var _0x42551a=null;var _0x57feec=null;var _0x5b6cb7=null;var _0x3621f4=null;Object[_0x2c70('37b','\x64\x30\x46\x39')](_0xe9671,_0x53f1b3['\x42\x53\x45\x4d\x79'],{'\x76\x61\x6c\x75\x65':{}});function _0x37a2e3(){var _0x2d9f6f=_0x53f1b3['\x72\x67\x61\x61\x69']['\x73\x70\x6c\x69\x74']('\x7c'),_0x4594f6=0x0;while(!![]){switch(_0x2d9f6f[_0x4594f6++]){case'\x30':_0xe9671[_0x2c70('37c','\x4b\x71\x6c\x67')]=_0x61c527;continue;case'\x31':_0x3621f4=new Float64Array(_0x33a4f);continue;case'\x32':_0x42551a=new Uint16Array(_0x33a4f);continue;case'\x33':_0xe9671[_0x2c70('37d','\x35\x24\x67\x66')]=_0x57feec;continue;case'\x34':_0xe9671[_0x2c70('37e','\x4b\x71\x6c\x67')]=_0x3621f4;continue;case'\x35':_0x61c527=new Int32Array(_0x33a4f);continue;case'\x36':_0x5b6cb7=new Float32Array(_0x33a4f);continue;case'\x37':_0x42e6b3=new Uint8Array(_0x33a4f);continue;case'\x38':_0xe9671['\x48\x45\x41\x50\x46\x33\x32']=_0x5b6cb7;continue;case'\x39':var _0x33a4f=_0xe9671['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x2c70('37f','\x48\x26\x24\x50')]['\x62\x75\x66\x66\x65\x72'];continue;case'\x31\x30':_0xe9671[_0x2c70('380','\x4a\x4e\x35\x6b')]=_0x26705a;continue;case'\x31\x31':_0x57feec=new Uint32Array(_0x33a4f);continue;case'\x31\x32':_0x3fb0db=new Int8Array(_0x33a4f);continue;case'\x31\x33':_0xe9671[_0x2c70('381','\x5a\x69\x4c\x74')]=_0x42551a;continue;case'\x31\x34':_0xe9671['\x48\x45\x41\x50\x38']=_0x3fb0db;continue;case'\x31\x35':_0x26705a=new Int16Array(_0x33a4f);continue;case'\x31\x36':_0xe9671['\x48\x45\x41\x50\x55\x38']=_0x42e6b3;continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x34306a,_0x4d1b19){if(_0x53f1b3[_0x2c70('382','\x4e\x26\x68\x2a')](_0x53f1b3[_0x2c70('383','\x6d\x71\x73\x44')],_0x53f1b3['\x4e\x69\x62\x59\x49'])){return{'\x76\x61\x6c\x75\x65':_0x4d1b19['\x70\x61\x74\x68\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x4d1b19=_0xe9671[_0x2c70('337','\x35\x55\x24\x48')][_0x2c70('384','\x23\x62\x71\x78')](_0x4d1b19),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('385','\x68\x4c\x57\x61')](_0x34306a,_0x4d1b19[_0x2c70('386','\x64\x30\x46\x39')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x1ecd34){_0xe9671[_0x2c70('219','\x56\x4b\x47\x68')][_0x2c70('387','\x28\x5b\x79\x45')](_0x1ecd34,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x2355fc){return _0x53f1b3['\x73\x74\x6a\x6c\x6f'](_0x53f1b3[_0x2c70('388','\x28\x5b\x79\x45')](_0xe9671[_0x2c70('22b','\x4d\x26\x47\x28')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x2355fc),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x2f4925,_0x54b027){var _0x2d8a74={'\x41\x71\x6f\x43\x67':function(_0x1416fb,_0x4fbadb){return _0x53f1b3[_0x2c70('389','\x5d\x45\x4e\x32')](_0x1416fb,_0x4fbadb);},'\x74\x53\x64\x6e\x50':function(_0x1b27a0,_0x256e15){return _0x53f1b3[_0x2c70('38a','\x4f\x57\x57\x56')](_0x1b27a0,_0x256e15);}};if(_0x53f1b3['\x67\x4b\x54\x67\x77'](_0x53f1b3[_0x2c70('38b','\x67\x4f\x63\x4c')],_0x53f1b3['\x61\x63\x57\x74\x70'])){_0x54b027=_0xe9671[_0x2c70('38c','\x72\x32\x62\x48')]['\x74\x6f\x5f\x6a\x73'](_0x54b027),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('38d','\x46\x50\x79\x57')](_0x2f4925,function(){try{return{'\x76\x61\x6c\x75\x65':_0x54b027[_0x2c70('38e','\x4b\x5e\x4b\x69')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x46c2c2){if(_0x53f1b3[_0x2c70('38f','\x78\x71\x61\x43')](_0x53f1b3[_0x2c70('390','\x4b\x71\x6c\x67')],_0x53f1b3[_0x2c70('391','\x40\x4d\x45\x24')])){output[_0x2c70('392','\x62\x32\x54\x2a')](_0xe9671[_0x2c70('31a','\x59\x69\x5b\x63')]['\x74\x6f\x5f\x6a\x73'](_0x2d8a74[_0x2c70('393','\x63\x4a\x67\x45')](pointer,_0x2d8a74['\x74\x53\x64\x6e\x50'](i,0x10))));}else{return{'\x65\x72\x72\x6f\x72':_0x46c2c2,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}else{_0x54b027=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x54b027),_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')][_0x2c70('394','\x57\x53\x39\x64')](_0x2f4925,0x3db);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x2e5cf6,_0x11f4d2){var _0x4ca640={'\x4e\x4e\x4b\x71\x7a':function(_0x59161e,_0x5270b9){return _0x53f1b3[_0x2c70('395','\x4b\x5e\x4b\x69')](_0x59161e,_0x5270b9);},'\x63\x7a\x48\x7a\x6d':function(_0x59c9ca,_0x1c0009){return _0x53f1b3['\x53\x62\x44\x55\x4d'](_0x59c9ca,_0x1c0009);},'\x72\x62\x6b\x48\x6c':_0x53f1b3[_0x2c70('396','\x56\x4b\x47\x68')]};_0x11f4d2=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('397','\x4e\x30\x4e\x37')](_0x11f4d2),_0xe9671[_0x2c70('398','\x28\x5b\x79\x45')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2e5cf6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x11f4d2[_0x2c70('399','\x4e\x26\x68\x2a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x59787d){if(_0x4ca640['\x63\x7a\x48\x7a\x6d'](_0x4ca640[_0x2c70('39a','\x40\x4d\x45\x24')],_0x4ca640[_0x2c70('39b','\x4f\x57\x57\x56')])){return{'\x65\x72\x72\x6f\x72':_0x59787d,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x4ca640[_0x2c70('39c','\x4a\x4e\x35\x6b')](address,0xc)]=0x6;}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x133dd7,_0x5c7bea){_0x5c7bea=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('39d','\x35\x24\x67\x66')](_0x5c7bea),_0xe9671[_0x2c70('222','\x69\x4f\x64\x63')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x133dd7,0x780);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x5788f2,_0x483f95){var _0x223340={'\x44\x55\x5a\x79\x4e':_0x53f1b3[_0x2c70('39e','\x4e\x26\x68\x2a')],'\x6e\x61\x64\x47\x6e':function(_0x22de4f,_0x51f32d){return _0x53f1b3['\x6d\x6d\x51\x75\x49'](_0x22de4f,_0x51f32d);},'\x42\x6b\x69\x74\x68':function(_0x50c4ce,_0x4ed9eb){return _0x53f1b3[_0x2c70('39f','\x72\x49\x33\x6a')](_0x50c4ce,_0x4ed9eb);},'\x42\x49\x6d\x5a\x6b':function(_0x30d507,_0x4e82b6){return _0x53f1b3['\x6d\x6d\x51\x75\x49'](_0x30d507,_0x4e82b6);},'\x66\x66\x65\x75\x66':function(_0x1d29ec,_0x541bc2){return _0x53f1b3[_0x2c70('3a0','\x35\x24\x67\x66')](_0x1d29ec,_0x541bc2);},'\x4a\x71\x74\x65\x71':function(_0x4c6316,_0x41c936){return _0x53f1b3[_0x2c70('3a1','\x51\x4e\x33\x40')](_0x4c6316,_0x41c936);},'\x66\x59\x4d\x74\x52':function(_0x477fd3,_0x48e92d){return _0x53f1b3[_0x2c70('3a2','\x25\x6b\x2a\x73')](_0x477fd3,_0x48e92d);},'\x52\x6a\x4d\x57\x59':function(_0x1953e0,_0x3590d6){return _0x53f1b3['\x76\x4d\x4a\x44\x54'](_0x1953e0,_0x3590d6);},'\x6a\x51\x72\x71\x69':_0x53f1b3[_0x2c70('3a3','\x44\x46\x72\x69')],'\x76\x47\x66\x75\x4e':_0x53f1b3[_0x2c70('3a4','\x28\x5b\x79\x45')],'\x4d\x77\x67\x75\x4a':_0x53f1b3[_0x2c70('3a5','\x48\x26\x24\x50')]};_0x483f95=_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')]['\x74\x6f\x5f\x6a\x73'](_0x483f95),_0xe9671[_0x2c70('3a6','\x72\x49\x33\x6a')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5788f2,function(){var _0x46d080={'\x74\x41\x62\x64\x4c':function(_0x5cfe26,_0x1b189b){return _0x223340['\x4a\x71\x74\x65\x71'](_0x5cfe26,_0x1b189b);},'\x43\x4a\x54\x46\x53':function(_0x59b1ef,_0x1584b9){return _0x223340[_0x2c70('3a7','\x57\x53\x39\x64')](_0x59b1ef,_0x1584b9);}};try{if(_0x223340[_0x2c70('3a8','\x49\x6f\x39\x21')](_0x223340[_0x2c70('3a9','\x77\x71\x76\x45')],_0x223340[_0x2c70('3aa','\x4f\x57\x57\x56')])){return{'\x76\x61\x6c\x75\x65':_0x483f95[_0x2c70('3ab','\x62\x66\x34\x55')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x5e792a=_0x223340[_0x2c70('3ac','\x63\x4a\x67\x45')][_0x2c70('3ad','\x46\x50\x79\x57')]('\x7c'),_0xbb2535=0x0;while(!![]){switch(_0x5e792a[_0xbb2535++]){case'\x30':_0xe9671[_0x2c70('18e','\x6c\x57\x31\x41')][_0x223340['\x6e\x61\x64\x47\x6e'](_0x223340['\x42\x6b\x69\x74\x68'](address,0x4),0x4)]=_0x2beed1;continue;case'\x31':_0xe9671[_0x2c70('1c7','\x57\x53\x39\x64')][_0x223340[_0x2c70('3ae','\x6d\x71\x73\x44')](address,0x4)]=_0x404f86;continue;case'\x32':var _0x49608d=_0x1b6ec6[_0x2c70('3af','\x54\x4c\x24\x40')](value);continue;case'\x33':var _0x404f86=0x0;continue;case'\x34':if(_0x223340['\x66\x66\x65\x75\x66'](_0x2beed1,0x0)){_0x404f86=_0xe9671[_0x2c70('154','\x62\x32\x54\x2a')]['\x61\x6c\x6c\x6f\x63'](_0x2beed1);_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x2c70('3b0','\x64\x30\x46\x39')](_0x49608d,_0x404f86);}continue;case'\x35':var _0x2beed1=_0x49608d['\x6c\x65\x6e\x67\x74\x68'];continue;}break;}}}catch(_0xcb73e2){if(_0x223340[_0x2c70('3b1','\x67\x70\x57\x55')](_0x223340[_0x2c70('3b2','\x69\x4f\x64\x63')],_0x223340[_0x2c70('3b3','\x67\x4f\x63\x4c')])){return _0x46d080[_0x2c70('3b4','\x5d\x45\x4e\x32')](_0x46d080[_0x2c70('3b5','\x30\x29\x26\x4d')](_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('3b6','\x39\x40\x64\x28')](_0x5788f2),Array),0x0);}else{return{'\x65\x72\x72\x6f\x72':_0xcb73e2,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x3d09b8,_0x4e4c07){_0x4e4c07=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x4e4c07),_0xe9671[_0x2c70('7f','\x4b\x5e\x4b\x69')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x3d09b8,_0x4e4c07[_0x2c70('3b7','\x35\x55\x24\x48')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x5ced9f,_0x493250){_0x493250=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x493250),_0xe9671[_0x2c70('345','\x4f\x57\x57\x56')][_0x2c70('3b8','\x35\x24\x67\x66')](_0x5ced9f,_0x493250[_0x2c70('3b9','\x25\x6b\x2a\x73')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x50fef6){var _0x4ba893={'\x4d\x6a\x6b\x66\x71':_0x53f1b3[_0x2c70('3ba','\x25\x6b\x2a\x73')],'\x64\x43\x50\x47\x51':function(_0x3f3611,_0x4f4326){return _0x53f1b3['\x61\x50\x42\x55\x57'](_0x3f3611,_0x4f4326);},'\x4c\x6c\x5a\x54\x75':function(_0x5180f8,_0x4371d9){return _0x53f1b3[_0x2c70('3bb','\x78\x71\x61\x43')](_0x5180f8,_0x4371d9);},'\x48\x4b\x61\x64\x4a':function(_0x456416,_0x1b63da){return _0x53f1b3[_0x2c70('3bc','\x59\x69\x5b\x63')](_0x456416,_0x1b63da);},'\x45\x4c\x71\x78\x45':function(_0x53d20d,_0x70dd9d){return _0x53f1b3[_0x2c70('3bd','\x57\x53\x39\x64')](_0x53d20d,_0x70dd9d);},'\x67\x47\x47\x78\x6f':function(_0x26a78c,_0x34ea5e){return _0x53f1b3[_0x2c70('3be','\x5a\x69\x4c\x74')](_0x26a78c,_0x34ea5e);},'\x6a\x77\x58\x56\x77':function(_0x5b52a5,_0x32d15f){return _0x53f1b3[_0x2c70('3bf','\x5d\x45\x4e\x32')](_0x5b52a5,_0x32d15f);},'\x79\x4a\x65\x46\x4c':function(_0x2e2302,_0x21acec){return _0x53f1b3[_0x2c70('3c0','\x39\x40\x64\x28')](_0x2e2302,_0x21acec);},'\x64\x57\x48\x7a\x44':function(_0x26bb5d,_0x485db1){return _0x53f1b3[_0x2c70('3c1','\x38\x76\x21\x24')](_0x26bb5d,_0x485db1);},'\x44\x54\x4f\x6d\x42':function(_0x32edaf,_0x493cba){return _0x53f1b3['\x66\x78\x57\x54\x41'](_0x32edaf,_0x493cba);},'\x54\x67\x56\x47\x5a':function(_0x24bab3,_0xb7d584){return _0x53f1b3['\x45\x51\x6f\x65\x66'](_0x24bab3,_0xb7d584);}};if(_0x53f1b3['\x66\x4a\x4d\x77\x50'](_0x53f1b3[_0x2c70('3c2','\x28\x5b\x79\x45')],_0x53f1b3[_0x2c70('3c3','\x23\x62\x71\x78')])){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('3c4','\x40\x4d\x45\x24')](_0x50fef6,document);}else{var _0x2166bf=_0x4ba893[_0x2c70('3c5','\x56\x4b\x47\x68')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x35e4bb=0x0;while(!![]){switch(_0x2166bf[_0x35e4bb++]){case'\x30':_0x42e6b3[addr++]=_0x4ba893[_0x2c70('3c6','\x63\x53\x25\x28')](0x80,_0x4ba893[_0x2c70('3c7','\x21\x25\x46\x6e')](_0x4ba893[_0x2c70('3c8','\x4d\x26\x47\x28')](u,0x6),0x3f));continue;case'\x31':_0x42e6b3[addr++]=_0x4ba893['\x45\x4c\x71\x78\x45'](0x80,_0x4ba893[_0x2c70('3c9','\x58\x25\x25\x4d')](_0x4ba893[_0x2c70('3ca','\x62\x66\x34\x55')](u,0x12),0x3f));continue;case'\x32':_0x42e6b3[addr++]=_0x4ba893[_0x2c70('3cb','\x38\x76\x21\x24')](0x80,_0x4ba893[_0x2c70('3cc','\x67\x4f\x63\x4c')](_0x4ba893[_0x2c70('3cd','\x72\x32\x62\x48')](u,0x18),0x3f));continue;case'\x33':_0x42e6b3[addr++]=_0x4ba893['\x6a\x77\x58\x56\x77'](0xfc,_0x4ba893[_0x2c70('3ce','\x63\x53\x25\x28')](u,0x1e));continue;case'\x34':_0x42e6b3[addr++]=_0x4ba893['\x79\x4a\x65\x46\x4c'](0x80,_0x4ba893[_0x2c70('3cf','\x68\x4c\x57\x61')](u,0x3f));continue;case'\x35':_0x42e6b3[addr++]=_0x4ba893[_0x2c70('3d0','\x56\x4b\x47\x68')](0x80,_0x4ba893[_0x2c70('3d1','\x72\x32\x62\x48')](_0x4ba893[_0x2c70('3d2','\x5a\x69\x4c\x74')](u,0xc),0x3f));continue;}break;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x3aebd5,_0x59dd07){if(_0x53f1b3[_0x2c70('3d3','\x63\x4a\x67\x45')](_0x53f1b3[_0x2c70('3d4','\x39\x40\x64\x28')],_0x53f1b3['\x6c\x76\x76\x76\x43'])){_0x59dd07=_0xe9671[_0x2c70('3d5','\x67\x70\x57\x55')]['\x74\x6f\x5f\x6a\x73'](_0x59dd07),_0xe9671[_0x2c70('29b','\x5a\x69\x4c\x74')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x3aebd5,_0x59dd07['\x62\x6f\x64\x79']);}else{var _0x340e62=_0x53f1b3['\x71\x51\x41\x4e\x5a']['\x73\x70\x6c\x69\x74']('\x7c'),_0x582ce5=0x0;while(!![]){switch(_0x340e62[_0x582ce5++]){case'\x30':_0xe9671['\x48\x45\x41\x50\x55\x33\x32'][_0x53f1b3[_0x2c70('3d6','\x54\x4c\x24\x40')](address,0x4)]=_0x523bcf;continue;case'\x31':var _0x523bcf=0x0;continue;case'\x32':var _0x542da8=_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')][_0x2c70('3d7','\x48\x26\x24\x50')](value);continue;case'\x33':if(_0x53f1b3[_0x2c70('3d8','\x6c\x24\x30\x47')](_0x542da8,0x0)){_0x523bcf=_0xe9671[_0x2c70('2e1','\x21\x25\x46\x6e')]['\x61\x6c\x6c\x6f\x63'](_0x542da8);_0xe9671[_0x2c70('329','\x63\x4a\x67\x45')]['\x74\x6f\x5f\x75\x74\x66\x38'](value,_0x523bcf);}continue;case'\x34':_0xe9671[_0x2c70('3d9','\x67\x70\x57\x55')][_0x53f1b3[_0x2c70('3da','\x68\x4c\x57\x61')](_0x53f1b3['\x70\x6a\x76\x71\x72'](address,0x4),0x4)]=_0x542da8;continue;}break;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x4c1b71){_0xe9671[_0x2c70('34e','\x23\x62\x71\x78')][_0x2c70('3db','\x58\x25\x25\x4d')](_0x4c1b71);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x595f8d){var _0x42be86=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('3dc','\x67\x70\x57\x55')](_0x595f8d);return _0x53f1b3[_0x2c70('3a2','\x25\x6b\x2a\x73')](_0x42be86,DOMException)&&_0x53f1b3['\x50\x68\x75\x67\x64'](_0x53f1b3[_0x2c70('3dd','\x77\x71\x76\x45')],_0x42be86[_0x2c70('3de','\x4b\x5e\x4b\x69')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x342577,_0x2bc027){var _0x35df73=_0xe9671[_0x2c70('398','\x28\x5b\x79\x45')][_0x2c70('3df','\x63\x53\x25\x28')](_0x342577);_0xe9671[_0x2c70('329','\x63\x4a\x67\x45')][_0x2c70('3e0','\x4e\x26\x68\x2a')](_0x2bc027,_0x35df73);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x1ae149,_0x2b1544){_0x2b1544=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('3e1','\x28\x5b\x79\x45')](_0x2b1544),_0xe9671[_0x2c70('34a','\x35\x24\x67\x66')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1ae149,0x438);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x2b9414,_0xcfac50){var _0x27129b={'\x55\x73\x63\x56\x62':function(_0x26be91,_0x499b40){return _0x53f1b3[_0x2c70('3e2','\x21\x4c\x76\x73')](_0x26be91,_0x499b40);}};if(_0x53f1b3['\x49\x56\x44\x63\x75'](_0x53f1b3[_0x2c70('3e3','\x67\x70\x57\x55')],_0x53f1b3[_0x2c70('3e4','\x63\x53\x25\x28')])){_0xcfac50=_0xe9671[_0x2c70('339','\x7a\x4b\x53\x44')][_0x2c70('29c','\x62\x32\x54\x2a')](_0xcfac50),_0xe9671[_0x2c70('31c','\x57\x53\x39\x64')][_0x2c70('3e5','\x6c\x24\x30\x47')](_0x2b9414,function(){try{if(_0x53f1b3[_0x2c70('3e6','\x4f\x57\x57\x56')](_0x53f1b3[_0x2c70('3e7','\x5a\x69\x4c\x74')],_0x53f1b3['\x64\x70\x77\x6f\x58'])){_0xe9671[_0x2c70('1ab','\x62\x32\x54\x2a')][_0x27129b[_0x2c70('3e8','\x72\x49\x33\x6a')](address,0xc)]=0x4;_0xe9671[_0x2c70('3e9','\x6c\x57\x31\x41')][_0x2c70('3ea','\x7a\x4b\x53\x44')](address,value);}else{return{'\x76\x61\x6c\x75\x65':_0xcfac50[_0x2c70('3eb','\x28\x5b\x79\x45')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x3a770e){if(_0x53f1b3[_0x2c70('3ec','\x6c\x24\x30\x47')](_0x53f1b3[_0x2c70('3ed','\x4b\x71\x6c\x67')],_0x53f1b3[_0x2c70('3ee','\x4b\x71\x6c\x67')])){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('3ef','\x5d\x45\x4e\x32')](_0x2b9414,document);}else{return{'\x65\x72\x72\x6f\x72':_0x3a770e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}else{try{return{'\x76\x61\x6c\x75\x65':_0xcfac50[_0x2c70('3f0','\x4b\x5e\x4b\x69')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x454e97){return{'\x65\x72\x72\x6f\x72':_0x454e97,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x39532c,_0x323cbc){if(_0x53f1b3[_0x2c70('3f1','\x35\x24\x67\x66')](_0x53f1b3[_0x2c70('3f2','\x44\x46\x72\x69')],_0x53f1b3['\x63\x56\x71\x62\x53'])){var _0x323a51=_0x53f1b3['\x72\x4d\x44\x44\x76'][_0x2c70('3f3','\x5d\x45\x4e\x32')]('\x7c'),_0x185656=0x0;while(!![]){switch(_0x323a51[_0x185656++]){case'\x30':Object[_0x2c70('3f4','\x5d\x45\x4e\x32')](_0xe9671,_0x53f1b3[_0x2c70('3f5','\x40\x4d\x45\x24')],{'\x76\x61\x6c\x75\x65':_0xe9671[_0x2c70('3f6','\x21\x25\x46\x6e')][_0x2c70('3f7','\x68\x4c\x57\x61')]['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']});continue;case'\x31':_0x53f1b3[_0x2c70('3f8','\x67\x70\x57\x55')](_0x37a2e3);continue;case'\x32':Object[_0x2c70('3f9','\x21\x25\x46\x6e')](_0xe9671,_0x53f1b3[_0x2c70('3fa','\x7a\x63\x78\x6d')],{'\x76\x61\x6c\x75\x65':_0xe9671[_0x2c70('3fb','\x57\x53\x39\x64')][_0x2c70('3fc','\x6d\x71\x73\x44')][_0x2c70('3fd','\x72\x49\x33\x6a')]});continue;case'\x33':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0xe9671,_0x53f1b3[_0x2c70('3fe','\x44\x46\x72\x69')],{'\x76\x61\x6c\x75\x65':instance});continue;case'\x34':var _0x233ec5={'\x77\x67\x66\x41\x6a':_0x53f1b3[_0x2c70('3ff','\x5a\x69\x4c\x74')]};continue;case'\x35':_0xe9671['\x65\x78\x70\x6f\x72\x74\x73'][_0x2c70('400','\x5a\x69\x4c\x74')]=function(_0x1f0166,_0x393a86){try{var _0x296ad6=_0xe9671[_0x2c70('31a','\x59\x69\x5b\x63')][_0x2c70('401','\x72\x49\x33\x6a')](_0xe9671[_0x2c70('402','\x49\x6f\x39\x21')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x2c70('403','\x68\x4c\x57\x61')](_0xe9671[_0x2c70('20c','\x4e\x26\x68\x2a')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x1f0166),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('404','\x68\x4c\x57\x61')](_0x393a86)));return _0x296ad6;}catch(_0x490cd0){console[_0x2c70('405','\x49\x6f\x39\x21')](_0x233ec5[_0x2c70('406','\x7a\x4b\x53\x44')],_0x490cd0);}};continue;case'\x36':return _0xe9671[_0x2c70('407','\x72\x32\x62\x48')];case'\x37':Object[_0x2c70('408','\x6c\x57\x31\x41')](_0xe9671,_0x53f1b3[_0x2c70('409','\x4b\x71\x6c\x67')],{'\x76\x61\x6c\x75\x65':_0xe9671['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x2c70('40a','\x54\x4c\x24\x40')][_0x2c70('40b','\x4b\x5e\x4b\x69')]});continue;}break;}}else{_0x323cbc=_0xe9671[_0x2c70('261','\x51\x4e\x33\x40')][_0x2c70('1c5','\x40\x4d\x45\x24')](_0x323cbc),_0xe9671[_0x2c70('1c2','\x5d\x45\x4e\x32')][_0x2c70('40c','\x4b\x5e\x4b\x69')](_0x39532c,_0x323cbc[_0x2c70('40d','\x25\x6b\x2a\x73')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x1672a7,_0x43c706){_0x43c706=_0xe9671[_0x2c70('339','\x7a\x4b\x53\x44')][_0x2c70('40e','\x48\x26\x24\x50')](_0x43c706),_0xe9671[_0x2c70('2d3','\x49\x2a\x53\x35')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1672a7,_0x43c706['\x73\x75\x63\x63\x65\x73\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x2cce30,_0x19a079){_0x19a079=_0xe9671[_0x2c70('1c4','\x7a\x63\x78\x6d')][_0x2c70('40f','\x4a\x4e\x35\x6b')](_0x19a079),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('38d','\x46\x50\x79\x57')](_0x2cce30,_0x19a079[_0x2c70('410','\x51\x4e\x33\x40')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x5aabbd,_0x57195c){if(_0x53f1b3[_0x2c70('411','\x62\x66\x34\x55')](_0x53f1b3['\x43\x77\x72\x6c\x50'],_0x53f1b3[_0x2c70('412','\x49\x6f\x39\x21')])){_0x57195c=_0xe9671[_0x2c70('191','\x78\x71\x61\x43')][_0x2c70('413','\x46\x50\x79\x57')](_0x57195c),_0xe9671[_0x2c70('20e','\x62\x66\x34\x55')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5aabbd,0x3db);}else{_0xe9671[_0x2c70('414','\x5a\x69\x4c\x74')][_0x53f1b3['\x43\x46\x7a\x65\x67'](address,0xc)]=0x1;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0xcd80cb,_0x260252){var _0x27198f={'\x75\x68\x59\x57\x42':function(_0x45d35e,_0x548344){return _0x53f1b3['\x43\x46\x7a\x65\x67'](_0x45d35e,_0x548344);}};if(_0x53f1b3[_0x2c70('415','\x21\x25\x46\x6e')](_0x53f1b3[_0x2c70('416','\x30\x29\x26\x4d')],_0x53f1b3['\x61\x44\x4c\x58\x64'])){_0x260252=_0xe9671[_0x2c70('1a2','\x30\x29\x26\x4d')][_0x2c70('417','\x68\x4c\x57\x61')](_0x260252),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('418','\x7a\x4b\x53\x44')](_0xcd80cb,function(){var _0x378c25={'\x6a\x59\x73\x73\x4b':function(_0x11c1af,_0x1e5a9c){return _0x53f1b3[_0x2c70('419','\x6c\x24\x30\x47')](_0x11c1af,_0x1e5a9c);},'\x6a\x70\x4f\x71\x56':_0x53f1b3[_0x2c70('41a','\x57\x53\x39\x64')],'\x77\x57\x56\x6e\x66':function(_0x4c581a,_0x23067f){return _0x53f1b3[_0x2c70('41b','\x6d\x71\x73\x44')](_0x4c581a,_0x23067f);},'\x73\x5a\x75\x46\x73':_0x53f1b3['\x4a\x76\x4e\x5a\x59'],'\x64\x42\x6e\x54\x4a':function(_0x52c9f2,_0x548d94){return _0x53f1b3[_0x2c70('41c','\x51\x4e\x33\x40')](_0x52c9f2,_0x548d94);},'\x5a\x47\x71\x67\x6a':function(_0x206d93,_0x25b83f){return _0x53f1b3[_0x2c70('41d','\x72\x49\x33\x6a')](_0x206d93,_0x25b83f);},'\x46\x6f\x69\x7a\x79':function(_0x3f7458,_0x33deb6){return _0x53f1b3['\x6f\x6f\x76\x69\x68'](_0x3f7458,_0x33deb6);},'\x4b\x49\x73\x50\x57':function(_0x24ce6b,_0x3365c7){return _0x53f1b3[_0x2c70('41e','\x21\x25\x46\x6e')](_0x24ce6b,_0x3365c7);},'\x70\x4c\x47\x4e\x76':function(_0x4213f0,_0x12e8d9){return _0x53f1b3[_0x2c70('41f','\x47\x55\x50\x61')](_0x4213f0,_0x12e8d9);},'\x66\x63\x54\x46\x44':function(_0x22035e,_0xd61566){return _0x53f1b3[_0x2c70('420','\x63\x53\x25\x28')](_0x22035e,_0xd61566);},'\x62\x5a\x44\x45\x57':function(_0x5c953b,_0x313725){return _0x53f1b3[_0x2c70('421','\x72\x32\x62\x48')](_0x5c953b,_0x313725);},'\x74\x64\x5a\x42\x70':function(_0x32cd04,_0x80d144){return _0x53f1b3[_0x2c70('422','\x54\x4c\x24\x40')](_0x32cd04,_0x80d144);},'\x4e\x50\x68\x62\x51':function(_0x2db8f1,_0x3dd714){return _0x53f1b3[_0x2c70('423','\x63\x4a\x67\x45')](_0x2db8f1,_0x3dd714);},'\x52\x6d\x6c\x4f\x42':function(_0x4a0652,_0x5a7adc){return _0x53f1b3['\x6f\x62\x6f\x68\x67'](_0x4a0652,_0x5a7adc);},'\x47\x56\x6b\x49\x56':function(_0x57d6cf,_0x2230d3){return _0x53f1b3[_0x2c70('424','\x25\x6b\x2a\x73')](_0x57d6cf,_0x2230d3);}};if(_0x53f1b3[_0x2c70('425','\x47\x55\x50\x61')](_0x53f1b3[_0x2c70('426','\x44\x46\x72\x69')],_0x53f1b3[_0x2c70('427','\x21\x25\x46\x6e')])){try{return{'\x76\x61\x6c\x75\x65':_0x260252[_0x2c70('428','\x48\x26\x24\x50')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5f0ea2){if(_0x53f1b3['\x72\x6d\x45\x50\x6e'](_0x53f1b3[_0x2c70('429','\x38\x76\x21\x24')],_0x53f1b3['\x68\x4f\x44\x58\x47'])){return{'\x65\x72\x72\x6f\x72':_0x5f0ea2,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0xe9671[_0x2c70('29b','\x5a\x69\x4c\x74')][_0x2c70('42a','\x7a\x4b\x53\x44')]=function to_js_string(_0x1e4170,_0x584845){return _0x29dfb6[_0x2c70('42b','\x21\x25\x46\x6e')](_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x2c70('42c','\x4d\x26\x47\x28')](_0x1e4170,_0x378c25['\x6a\x59\x73\x73\x4b'](_0x1e4170,_0x584845)));};}}}else{var _0x156124=_0x378c25['\x6a\x70\x4f\x71\x56'][_0x2c70('238','\x40\x4d\x45\x24')]('\x7c'),_0x11f028=0x0;while(!![]){switch(_0x156124[_0x11f028++]){case'\x30':if(_0x378c25[_0x2c70('42d','\x40\x4d\x45\x24')](x,0xf0)){var _0x44369a=_0x378c25[_0x2c70('42e','\x4b\x71\x6c\x67')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x24a92d=0x0;while(!![]){switch(_0x44369a[_0x24a92d++]){case'\x30':ch=_0x378c25['\x64\x42\x6e\x54\x4a'](_0x378c25[_0x2c70('42f','\x77\x71\x76\x45')](_0x378c25[_0x2c70('430','\x7a\x4b\x53\x44')](init,0x7),0x12),_0x378c25[_0x2c70('431','\x4b\x5e\x4b\x69')](_0x378c25['\x5a\x47\x71\x67\x6a'](_0x5954bc,0x6),_0x378c25[_0x2c70('432','\x40\x4d\x45\x24')](_0x305906,0x3f)));continue;case'\x31':if(_0x378c25['\x70\x4c\x47\x4e\x76'](index,end)){_0x305906=_0x42e6b3[index++];}continue;case'\x32':ch=_0x378c25[_0x2c70('433','\x28\x5b\x79\x45')](0xdc00,_0x378c25[_0x2c70('434','\x40\x4d\x45\x24')](ch,0x3ff));continue;case'\x33':var _0x305906=0x0;continue;case'\x34':output+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x378c25[_0x2c70('435','\x44\x46\x72\x69')](0xd7c0,_0x378c25[_0x2c70('436','\x6d\x71\x73\x44')](ch,0xa)));continue;}break;}}continue;case'\x31':if(_0x378c25[_0x2c70('437','\x6d\x71\x73\x44')](index,end)){_0x1e76ac=_0x42e6b3[index++];}continue;case'\x32':var _0x5954bc=_0x378c25[_0x2c70('438','\x40\x4d\x45\x24')](_0x378c25[_0x2c70('439','\x21\x25\x46\x6e')](_0x378c25[_0x2c70('43a','\x6d\x71\x73\x44')](y,0x3f),0x6),_0x378c25['\x52\x6d\x6c\x4f\x42'](_0x1e76ac,0x3f));continue;case'\x33':var _0x1e76ac=0x0;continue;case'\x34':ch=_0x378c25['\x47\x56\x6b\x49\x56'](_0x378c25[_0x2c70('43b','\x72\x32\x62\x48')](init,0xc),_0x5954bc);continue;}break;}}}());}else{_0xe9671['\x48\x45\x41\x50\x55\x38'][_0x27198f['\x75\x68\x59\x57\x42'](address,0xc)]=0x5;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x47e199,_0x1b0b5b){var _0x3dafe1={'\x56\x4e\x64\x4c\x4e':function(_0x5c4793,_0x40021b){return _0x53f1b3[_0x2c70('43c','\x4d\x26\x47\x28')](_0x5c4793,_0x40021b);},'\x6a\x6c\x69\x6c\x4a':_0x53f1b3[_0x2c70('43d','\x64\x30\x46\x39')]};if(_0x53f1b3[_0x2c70('43e','\x4b\x5e\x4b\x69')](_0x53f1b3[_0x2c70('43f','\x46\x50\x79\x57')],_0x53f1b3['\x45\x75\x77\x49\x55'])){var _0x55dd76=_0xe9671[_0x2c70('291','\x4a\x4e\x35\x6b')][_0x2c70('440','\x54\x4c\x24\x40')](value);_0xe9671[_0x2c70('441','\x38\x76\x21\x24')][_0x53f1b3['\x43\x46\x7a\x65\x67'](address,0xc)]=0xf;_0xe9671[_0x2c70('1ad','\x58\x25\x25\x4d')][_0x53f1b3[_0x2c70('442','\x21\x4c\x76\x73')](address,0x4)]=_0x55dd76;}else{_0x1b0b5b=_0xe9671[_0x2c70('1c4','\x7a\x63\x78\x6d')]['\x74\x6f\x5f\x6a\x73'](_0x1b0b5b),_0xe9671[_0x2c70('38c','\x72\x32\x62\x48')][_0x2c70('3c4','\x40\x4d\x45\x24')](_0x47e199,function(){try{if(_0x3dafe1[_0x2c70('443','\x21\x25\x46\x6e')](_0x3dafe1[_0x2c70('444','\x64\x30\x46\x39')],_0x3dafe1[_0x2c70('445','\x6c\x24\x30\x47')])){return{'\x76\x61\x6c\x75\x65':_0x1b0b5b[_0x2c70('335','\x25\x6b\x2a\x73')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x1b0b5b=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x1b0b5b),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('446','\x35\x55\x24\x48')](_0x47e199,_0x1b0b5b['\x6c\x65\x6e\x67\x74\x68']);}}catch(_0x40e905){return{'\x65\x72\x72\x6f\x72':_0x40e905,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x222a25){if(_0x53f1b3[_0x2c70('447','\x51\x4e\x33\x40')](_0x53f1b3[_0x2c70('448','\x78\x71\x61\x43')],_0x53f1b3[_0x2c70('449','\x78\x71\x61\x43')])){_0x222a25=_0xe9671[_0x2c70('7e','\x4b\x71\x6c\x67')][_0x2c70('44a','\x64\x30\x46\x39')](_0x222a25),_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('44b','\x7a\x4b\x53\x44')](_0x222a25);}else{_0x42e6b3[addr++]=_0x53f1b3[_0x2c70('44c','\x6d\x71\x73\x44')](0xc0,_0x53f1b3[_0x2c70('44d','\x77\x71\x76\x45')](u,0x6));_0x42e6b3[addr++]=_0x53f1b3[_0x2c70('44e','\x72\x32\x62\x48')](0x80,_0x53f1b3[_0x2c70('44f','\x67\x70\x57\x55')](u,0x3f));}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0x530109,_0x1c211e){if(_0x53f1b3[_0x2c70('450','\x72\x32\x62\x48')](_0x53f1b3[_0x2c70('451','\x40\x4d\x45\x24')],_0x53f1b3['\x50\x63\x66\x54\x54'])){_0x1c211e=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x1c211e),_0xe9671[_0x2c70('355','\x63\x53\x25\x28')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x530109,0x248);}else{_0x1c211e=_0xe9671[_0x2c70('356','\x40\x4d\x45\x24')][_0x2c70('39d','\x35\x24\x67\x66')](_0x1c211e),_0xe9671[_0x2c70('235','\x21\x4c\x76\x73')][_0x2c70('452','\x5a\x69\x4c\x74')](_0x530109,0x780);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x2804e8){_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('453','\x62\x66\x34\x55')]=_0xe9671[_0x2c70('329','\x63\x4a\x67\x45')][_0x2c70('454','\x25\x6b\x2a\x73')](_0x2804e8);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x37a2e3}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x43673b){Object[_0x2c70('455','\x4b\x5e\x4b\x69')](_0xe9671,_0x53f1b3[_0x2c70('456','\x78\x71\x61\x43')],{'\x76\x61\x6c\x75\x65':_0x43673b});Object[_0x2c70('457','\x51\x4e\x33\x40')](_0xe9671,_0x53f1b3['\x6b\x50\x6d\x48\x5a'],{'\x76\x61\x6c\x75\x65':_0xe9671[_0x2c70('458','\x49\x2a\x53\x35')][_0x2c70('459','\x35\x24\x67\x66')][_0x2c70('45a','\x63\x53\x25\x28')]});Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0xe9671,_0x53f1b3[_0x2c70('45b','\x6c\x57\x31\x41')],{'\x76\x61\x6c\x75\x65':_0xe9671['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x2c70('45c','\x63\x4a\x67\x45')][_0x2c70('45d','\x63\x4a\x67\x45')]});Object[_0x2c70('45e','\x67\x70\x57\x55')](_0xe9671,_0x53f1b3[_0x2c70('45f','\x56\x4b\x47\x68')],{'\x76\x61\x6c\x75\x65':_0xe9671[_0x2c70('460','\x51\x4e\x33\x40')][_0x2c70('461','\x4f\x57\x57\x56')]['\x5f\x5f\x69\x6e\x64\x69\x72\x65\x63\x74\x5f\x66\x75\x6e\x63\x74\x69\x6f\x6e\x5f\x74\x61\x62\x6c\x65']});_0xe9671[_0x2c70('462','\x4e\x30\x4e\x37')][_0x2c70('463','\x62\x32\x54\x2a')]=function(_0x4c59ae,_0x38acb9){if(_0x53f1b3[_0x2c70('464','\x21\x25\x46\x6e')](_0x53f1b3['\x6a\x6d\x61\x4c\x76'],_0x53f1b3[_0x2c70('465','\x47\x55\x50\x61')])){try{var _0x2e655e=_0xe9671[_0x2c70('29b','\x5a\x69\x4c\x74')][_0x2c70('466','\x38\x76\x21\x24')](_0xe9671[_0x2c70('467','\x7a\x4b\x53\x44')][_0x2c70('468','\x62\x32\x54\x2a')][_0x2c70('469','\x46\x50\x79\x57')](_0xe9671[_0x2c70('3a6','\x72\x49\x33\x6a')][_0x2c70('46a','\x58\x25\x25\x4d')](_0x4c59ae),_0xe9671[_0x2c70('3a6','\x72\x49\x33\x6a')][_0x2c70('46b','\x78\x71\x61\x43')](_0x38acb9)));return _0x2e655e;}catch(_0x114e84){console['\x6c\x6f\x67'](_0x53f1b3[_0x2c70('46c','\x72\x49\x33\x6a')],_0x114e84);}}else{var _0x255d27=_0xe9671['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x2c70('34c','\x4b\x5e\x4b\x69')]++;_0xe9671[_0x2c70('232','\x6d\x71\x73\x44')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x255d27]=value;return _0x255d27;}};_0x53f1b3['\x69\x46\x76\x45\x78'](_0x37a2e3);return _0xe9671[_0x2c70('46d','\x47\x55\x50\x61')];}};}};;_0xodp='jsjiami.com.v6';
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
