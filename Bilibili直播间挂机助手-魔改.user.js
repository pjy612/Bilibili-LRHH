// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.17
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
/*
不想或不会改Hosts，可以尝试用下面的源 替换上方对应的
// @require      https://cdn.jsdelivr.net/gh/pjy612/Bilibili-LRHH/BilibiliAPI_Plus.js
// @require      https://cdn.jsdelivr.net/gh/pjy612/Bilibili-LRHH/Bilibili-LRHH/master/OCRAD.min.js
// @require      https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS/libBilibiliToken/libBilibiliToken.user.js
*/
(function BLRHH_Plus() {
    'use strict';
    const NAME = 'BLRHH-Plus';
    const VERSION = '2.4.5.17';
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
                    DD_DM_STORM: 'DD弹幕风暴',
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
                                if(Token && TokenUtil && !Info.appToken && CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.NO_REAL_CHECK){
                                   await TokenLoad();
                                }
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

        var _0xod0='jsjiami.com.v6',_0x3bb0=[_0xod0,'\x62\x7a\x6e\x44\x6a\x68\x4a\x41\x77\x71\x67\x4b\x64\x58\x6e\x44\x71\x4d\x4f\x43','\x59\x63\x4f\x41\x4c\x63\x4b\x45\x77\x71\x49\x3d','\x59\x54\x7a\x43\x67\x4d\x4b\x43\x48\x32\x5a\x64\x77\x72\x7a\x43\x76\x38\x4f\x6f\x77\x34\x30\x57\x58\x55\x34\x3d','\x77\x34\x66\x43\x67\x54\x67\x56\x77\x72\x74\x67\x77\x34\x50\x44\x6d\x38\x4f\x71\x65\x4d\x4b\x6b\x4e\x63\x4b\x68\x77\x36\x67\x3d','\x52\x6a\x4c\x43\x73\x63\x4b\x63\x45\x41\x3d\x3d','\x66\x38\x4f\x67\x41\x31\x37\x43\x71\x73\x4f\x5a\x77\x70\x66\x44\x68\x63\x4b\x4d\x77\x34\x6a\x44\x69\x38\x4f\x67\x77\x35\x7a\x43\x6b\x73\x4b\x78\x56\x78\x63\x49\x77\x72\x73\x3d','\x57\x4d\x4f\x2f\x77\x36\x72\x43\x76\x48\x63\x3d','\x4a\x77\x38\x54\x45\x32\x54\x44\x6f\x67\x3d\x3d','\x57\x63\x4f\x44\x4a\x4d\x4b\x61\x77\x6f\x33\x44\x6f\x6e\x77\x3d','\x56\x53\x4d\x4a\x77\x36\x56\x58','\x63\x63\x4f\x35\x77\x35\x2f\x43\x76\x58\x45\x3d','\x5a\x63\x4f\x57\x4c\x6d\x76\x43\x6a\x41\x3d\x3d','\x77\x36\x44\x43\x75\x69\x4d\x33\x77\x6f\x70\x45\x77\x71\x54\x44\x6c\x4d\x4f\x4c\x52\x63\x4b\x41\x48\x63\x4b\x62\x77\x34\x6f\x3d','\x77\x34\x6e\x43\x76\x45\x6f\x45\x77\x71\x4d\x3d','\x66\x4d\x4b\x6a\x77\x71\x31\x66\x77\x70\x76\x43\x68\x51\x3d\x3d','\x48\x4d\x4f\x6b\x55\x63\x4b\x67\x42\x54\x73\x3d','\x77\x36\x5a\x67\x77\x6f\x59\x74\x77\x6f\x33\x44\x72\x63\x4f\x62','\x77\x35\x62\x44\x70\x63\x4f\x77\x77\x37\x37\x43\x76\x77\x3d\x3d','\x42\x68\x48\x43\x70\x38\x4b\x4f\x77\x70\x55\x3d','\x77\x36\x76\x44\x6d\x63\x4b\x51\x41\x73\x4b\x45\x77\x37\x33\x44\x70\x43\x70\x41\x63\x63\x4f\x5a\x5a\x38\x4b\x61\x65\x77\x3d\x3d','\x65\x38\x4f\x7a\x4a\x56\x6a\x43\x6a\x67\x3d\x3d','\x66\x4d\x4b\x6a\x77\x71\x31\x66\x77\x70\x76\x43\x6a\x6b\x30\x3d','\x64\x38\x4f\x47\x52\x6e\x7a\x44\x73\x67\x3d\x3d','\x77\x72\x63\x38\x77\x36\x4e\x30\x77\x6f\x77\x73\x77\x36\x30\x3d','\x41\x6e\x31\x4c\x77\x6f\x62\x43\x6e\x41\x3d\x3d','\x77\x35\x31\x33\x77\x72\x55\x38\x77\x70\x45\x3d','\x77\x36\x33\x44\x72\x73\x4f\x35\x77\x36\x50\x43\x75\x41\x3d\x3d','\x56\x63\x4f\x6a\x58\x57\x66\x44\x6c\x63\x4f\x45\x77\x6f\x59\x3d','\x63\x73\x4b\x38\x77\x36\x34\x70\x77\x37\x62\x44\x75\x51\x6b\x3d','\x77\x34\x72\x44\x75\x38\x4f\x61\x45\x63\x4f\x32','\x55\x69\x48\x43\x75\x67\x62\x43\x6d\x51\x3d\x3d','\x58\x69\x56\x74\x77\x37\x6b\x6d\x4f\x41\x44\x44\x6c\x63\x4f\x64\x77\x71\x63\x4c\x77\x70\x6b\x3d','\x64\x38\x4f\x30\x43\x73\x4b\x6e\x77\x6f\x66\x43\x75\x7a\x30\x3d','\x77\x35\x6c\x46\x77\x34\x6a\x44\x73\x77\x3d\x3d','\x57\x63\x4b\x78\x77\x36\x4d\x36\x77\x37\x63\x3d','\x64\x68\x72\x43\x6b\x43\x6a\x43\x71\x41\x3d\x3d','\x77\x35\x70\x42\x77\x70\x51\x70\x77\x72\x6b\x3d','\x51\x4d\x4b\x43\x77\x72\x39\x62\x77\x71\x38\x3d','\x4b\x38\x4b\x76\x77\x35\x56\x66\x77\x70\x41\x3d','\x77\x6f\x35\x76\x77\x6f\x48\x44\x6f\x69\x68\x30\x43\x53\x2f\x44\x68\x73\x4f\x6c\x4e\x63\x4b\x50\x77\x34\x6f\x48','\x77\x34\x5a\x6c\x65\x63\x4f\x35\x50\x52\x72\x44\x67\x51\x30\x32\x77\x72\x66\x43\x72\x6e\x62\x43\x6c\x6a\x67\x3d','\x77\x6f\x51\x56\x48\x44\x54\x44\x70\x77\x3d\x3d','\x77\x6f\x38\x2f\x77\x36\x70\x71\x77\x71\x4d\x3d','\x77\x72\x62\x43\x6e\x31\x74\x58\x65\x4d\x4f\x43\x77\x36\x62\x44\x70\x4d\x4f\x67\x41\x52\x49\x7a\x63\x53\x67\x3d','\x54\x38\x4f\x39\x77\x36\x6e\x43\x70\x51\x3d\x3d','\x77\x35\x7a\x43\x72\x63\x4b\x46\x77\x70\x76\x44\x76\x77\x3d\x3d','\x64\x38\x4b\x75\x4f\x38\x4f\x74\x77\x6f\x51\x3d','\x52\x78\x48\x43\x71\x4d\x4b\x34\x43\x51\x3d\x3d','\x62\x79\x77\x33\x77\x36\x4e\x32','\x5a\x4d\x4f\x4e\x5a\x78\x6e\x44\x71\x41\x3d\x3d','\x52\x30\x54\x43\x67\x46\x7a\x44\x68\x46\x38\x3d','\x57\x43\x4c\x44\x68\x73\x4f\x6b\x77\x36\x41\x3d','\x77\x36\x44\x44\x70\x63\x4f\x53\x77\x36\x54\x43\x6a\x51\x3d\x3d','\x53\x63\x4b\x4a\x77\x34\x4d\x51\x77\x35\x63\x3d','\x54\x54\x77\x72\x77\x34\x35\x7a','\x77\x6f\x76\x43\x6a\x52\x58\x43\x74\x67\x77\x3d','\x4c\x58\x4c\x44\x6a\x48\x49\x56','\x52\x63\x4f\x51\x47\x48\x33\x43\x67\x4d\x4f\x45\x77\x72\x72\x44\x74\x4d\x4b\x70\x77\x35\x37\x44\x71\x38\x4f\x41\x77\x36\x54\x43\x6f\x67\x3d\x3d','\x77\x35\x70\x4b\x77\x70\x67\x49\x77\x71\x7a\x43\x75\x4d\x4f\x52\x77\x37\x6b\x62\x49\x73\x4b\x63\x46\x4d\x4f\x69\x48\x51\x3d\x3d','\x77\x36\x46\x65\x59\x73\x4f\x62\x44\x44\x37\x43\x70\x67\x49\x58\x77\x6f\x72\x43\x69\x6c\x37\x43\x72\x42\x6f\x3d','\x58\x4d\x4b\x4c\x77\x34\x41\x55\x77\x37\x7a\x43\x6f\x45\x67\x3d','\x77\x34\x44\x44\x75\x48\x7a\x43\x69\x68\x59\x3d','\x4c\x6d\x39\x67\x77\x70\x66\x43\x72\x6b\x6b\x3d','\x57\x77\x6f\x46\x77\x34\x4e\x30','\x53\x73\x4f\x48\x77\x72\x6c\x63\x77\x71\x70\x45\x56\x68\x70\x34\x77\x37\x78\x42\x77\x72\x63\x4e\x77\x70\x63\x3d','\x77\x37\x37\x44\x6d\x73\x4b\x6a\x47\x4d\x4b\x54','\x53\x6a\x48\x43\x74\x7a\x2f\x43\x70\x41\x3d\x3d','\x77\x72\x33\x44\x74\x67\x54\x43\x67\x38\x4b\x2f\x58\x77\x3d\x3d','\x77\x70\x66\x44\x67\x77\x50\x43\x67\x73\x4b\x64','\x51\x63\x4b\x31\x77\x6f\x64\x69\x77\x72\x73\x3d','\x77\x34\x7a\x44\x71\x38\x4f\x39\x42\x4d\x4f\x55\x77\x35\x4e\x4a','\x59\x67\x39\x7a\x77\x34\x4d\x41\x58\x77\x3d\x3d','\x77\x36\x4c\x43\x76\x63\x4f\x42\x4f\x6e\x6e\x44\x71\x52\x34\x3d','\x77\x72\x7a\x43\x73\x55\x70\x68\x64\x77\x3d\x3d','\x42\x44\x4d\x6c\x49\x57\x6b\x3d','\x64\x63\x4b\x67\x77\x37\x63\x73\x77\x35\x6f\x3d','\x57\x77\x7a\x43\x6d\x38\x4b\x68\x4e\x58\x74\x77\x77\x6f\x33\x43\x6d\x73\x4f\x2b\x77\x36\x30\x32\x5a\x58\x35\x56\x77\x72\x62\x43\x6e\x78\x73\x47','\x77\x34\x72\x44\x68\x38\x4f\x62\x77\x36\x48\x43\x6b\x51\x3d\x3d','\x5a\x4d\x4f\x58\x77\x36\x72\x43\x6c\x30\x38\x3d','\x44\x55\x56\x54\x77\x71\x37\x43\x71\x41\x3d\x3d','\x77\x34\x4c\x43\x76\x77\x37\x43\x76\x54\x38\x3d','\x61\x78\x44\x43\x67\x51\x7a\x43\x68\x63\x4f\x68','\x77\x35\x4c\x44\x6c\x38\x4f\x47\x4d\x4d\x4f\x6d','\x5a\x73\x4f\x6c\x49\x6d\x55\x71','\x77\x71\x39\x65\x77\x71\x4c\x44\x6e\x42\x35\x43\x4d\x77\x33\x44\x69\x38\x4f\x65\x41\x73\x4b\x35\x77\x34\x45\x30\x65\x77\x7a\x44\x6c\x73\x4f\x32','\x64\x78\x70\x49\x77\x37\x39\x74','\x64\x43\x70\x4c\x77\x34\x6c\x63','\x59\x67\x6f\x38\x77\x37\x35\x74\x4f\x52\x52\x6f\x4b\x43\x6c\x76\x57\x73\x4b\x74\x4a\x38\x4f\x63\x48\x38\x4b\x78\x77\x36\x4a\x6a\x54\x4d\x4b\x61\x77\x6f\x6f\x3d','\x77\x34\x7a\x44\x71\x38\x4f\x39\x42\x4d\x4f\x55\x77\x35\x67\x3d','\x57\x51\x77\x5a\x77\x36\x39\x32','\x61\x78\x44\x43\x67\x51\x7a\x44\x6f\x38\x4f\x72','\x77\x71\x52\x35\x77\x70\x34\x34\x63\x51\x3d\x3d','\x66\x63\x4b\x57\x77\x72\x68\x39\x77\x70\x6b\x3d','\x56\x4d\x4b\x71\x77\x34\x45\x31\x77\x35\x45\x3d','\x77\x35\x62\x44\x68\x73\x4b\x62\x42\x63\x4b\x6e','\x77\x37\x59\x75\x4b\x38\x4f\x68\x77\x37\x45\x3d','\x77\x34\x62\x43\x6b\x73\x4f\x75\x44\x30\x63\x3d','\x4d\x6b\x39\x5a\x77\x72\x50\x43\x76\x78\x52\x4e\x77\x71\x4c\x43\x6e\x58\x37\x43\x72\x41\x3d\x3d','\x53\x78\x72\x44\x76\x69\x68\x2f','\x77\x35\x35\x42\x77\x34\x66\x44\x73\x46\x6f\x49','\x77\x35\x6e\x43\x6a\x63\x4f\x69\x43\x30\x33\x43\x72\x55\x74\x52','\x77\x37\x58\x44\x6f\x38\x4f\x66\x4d\x63\x4f\x6d','\x50\x45\x31\x45\x77\x72\x58\x43\x6e\x77\x3d\x3d','\x77\x72\x7a\x43\x72\x45\x35\x36\x55\x51\x3d\x3d','\x77\x35\x58\x43\x70\x63\x4b\x49\x77\x6f\x54\x44\x6a\x41\x3d\x3d','\x55\x43\x58\x43\x72\x44\x58\x43\x70\x41\x3d\x3d','\x53\x73\x4f\x30\x4b\x58\x59\x70','\x77\x70\x48\x43\x74\x67\x66\x43\x71\x77\x6f\x3d','\x4c\x6e\x2f\x44\x69\x56\x77\x4b','\x66\x32\x50\x43\x69\x45\x44\x43\x76\x41\x3d\x3d','\x77\x34\x50\x43\x6a\x43\x34\x73\x77\x6f\x51\x3d','\x58\x63\x4b\x75\x44\x38\x4f\x6f\x77\x72\x77\x3d','\x77\x36\x4c\x43\x6c\x51\x76\x43\x6d\x42\x70\x54','\x44\x47\x50\x44\x6c\x30\x63\x6a','\x77\x36\x70\x54\x77\x70\x38\x65\x77\x72\x30\x3d','\x77\x34\x2f\x43\x67\x4d\x4b\x68\x77\x70\x37\x44\x70\x51\x3d\x3d','\x51\x4d\x4f\x4f\x77\x36\x66\x43\x73\x30\x55\x3d','\x53\x41\x5a\x6d\x77\x35\x51\x47','\x44\x78\x77\x6c\x46\x33\x55\x3d','\x77\x35\x6a\x43\x72\x77\x59\x47\x77\x6f\x6b\x3d','\x57\x78\x33\x43\x6a\x68\x76\x43\x70\x51\x3d\x3d','\x77\x72\x4d\x41\x4a\x42\x46\x49','\x4d\x51\x35\x5a\x77\x71\x6c\x42','\x4d\x78\x78\x6d\x77\x72\x74\x4b','\x59\x4d\x4b\x76\x77\x71\x5a\x62\x77\x71\x6b\x3d','\x4a\x51\x7a\x43\x6f\x38\x4b\x51\x77\x71\x4d\x3d','\x65\x51\x44\x43\x71\x63\x4b\x73\x46\x41\x3d\x3d','\x77\x35\x78\x57\x77\x34\x76\x44\x73\x6e\x30\x46\x77\x36\x48\x44\x68\x38\x4f\x5a\x77\x36\x5a\x71\x77\x6f\x6b\x3d','\x59\x4d\x4f\x4c\x42\x73\x4b\x76\x77\x72\x38\x3d','\x5a\x4d\x4f\x44\x77\x37\x62\x43\x68\x33\x45\x3d','\x59\x53\x4a\x66\x77\x36\x6f\x62','\x77\x37\x7a\x43\x6b\x63\x4b\x67\x77\x70\x6e\x44\x6a\x53\x46\x6b\x62\x63\x4b\x4c\x48\x38\x4b\x56\x61\x51\x3d\x3d','\x46\x6b\x54\x44\x76\x32\x49\x63\x65\x63\x4b\x6a\x77\x71\x2f\x44\x73\x4d\x4b\x32\x77\x70\x2f\x43\x72\x38\x4b\x56\x77\x71\x59\x3d','\x59\x73\x4f\x6a\x45\x51\x3d\x3d','\x62\x38\x4f\x42\x49\x46\x4d\x74','\x77\x6f\x41\x55\x49\x43\x46\x47','\x43\x6b\x56\x47','\x4b\x73\x4f\x65\x64\x73\x4b\x59\x4a\x42\x77\x43\x49\x38\x4b\x72\x50\x47\x78\x71\x4d\x6e\x59\x3d','\x57\x4d\x4b\x50\x4b\x73\x4f\x30\x77\x71\x48\x43\x72\x4d\x4b\x31\x77\x72\x49\x54\x77\x72\x72\x44\x6e\x48\x42\x38\x77\x71\x35\x56\x4a\x38\x4f\x46\x65\x67\x3d\x3d','\x55\x38\x4f\x70\x5a\x45\x33\x44\x6c\x63\x4f\x4e\x77\x36\x48\x43\x72\x38\x4b\x36\x54\x38\x4b\x64\x77\x70\x66\x44\x6e\x41\x3d\x3d','\x66\x57\x54\x43\x70\x31\x50\x43\x67\x77\x4a\x52\x65\x46\x34\x4c\x77\x70\x58\x43\x6b\x4d\x4f\x74\x77\x71\x51\x72\x77\x37\x74\x2f\x4d\x48\x50\x43\x6d\x6d\x33\x43\x6d\x67\x3d\x3d','\x77\x6f\x6e\x43\x71\x6d\x78\x30\x59\x73\x4f\x79\x77\x35\x7a\x44\x6b\x73\x4f\x62\x4c\x41\x3d\x3d','\x4e\x38\x4b\x59\x77\x36\x46\x47\x77\x6f\x72\x43\x73\x54\x42\x49\x4a\x73\x4f\x44\x77\x72\x50\x44\x6a\x4d\x4f\x44\x77\x34\x73\x6d\x4b\x53\x50\x43\x71\x45\x38\x3d','\x77\x34\x7a\x44\x6f\x73\x4b\x4c\x49\x4d\x4b\x31\x77\x35\x6e\x43\x67\x79\x56\x68\x54\x4d\x4f\x39\x54\x38\x4b\x67\x57\x51\x3d\x3d','\x51\x6a\x62\x43\x73\x53\x6e\x43\x75\x63\x4b\x72\x77\x70\x41\x46\x77\x6f\x51\x6d\x54\x54\x51\x67\x77\x36\x44\x44\x75\x51\x46\x4c\x46\x6d\x37\x43\x6c\x63\x4b\x73\x77\x70\x34\x3d','\x77\x34\x66\x43\x69\x53\x73\x75\x77\x6f\x67\x3d','\x44\x44\x34\x31\x4d\x48\x30\x3d','\x56\x63\x4f\x68\x66\x73\x4b\x6d\x63\x67\x3d\x3d','\x77\x37\x2f\x43\x73\x55\x30\x4d\x77\x6f\x73\x3d','\x44\x67\x6c\x6a\x77\x71\x5a\x51','\x58\x6a\x70\x61\x77\x36\x51\x39','\x41\x51\x51\x61\x4e\x31\x77\x3d','\x77\x34\x62\x44\x72\x4d\x4f\x79\x77\x34\x2f\x43\x6c\x77\x3d\x3d','\x5a\x38\x4f\x6d\x4c\x6d\x45\x6a\x64\x44\x55\x37\x4d\x38\x4b\x6f\x5a\x4d\x4b\x55\x77\x36\x37\x43\x72\x38\x4b\x4c\x4c\x7a\x4c\x43\x75\x51\x3d\x3d','\x65\x73\x4f\x78\x61\x73\x4b\x7a\x58\x38\x4b\x65\x77\x70\x7a\x43\x68\x38\x4b\x44\x52\x54\x63\x6b\x44\x51\x3d\x3d','\x66\x57\x54\x43\x70\x31\x50\x43\x67\x77\x4a\x52\x65\x46\x34\x4c\x77\x70\x58\x43\x6b\x4d\x4f\x74','\x4b\x53\x31\x50\x77\x6f\x5a\x39\x77\x6f\x76\x43\x74\x4d\x4b\x43\x77\x6f\x35\x70\x77\x37\x4c\x43\x76\x38\x4f\x43\x65\x77\x3d\x3d','\x53\x54\x6e\x44\x6b\x44\x6c\x78\x77\x71\x6b\x32\x63\x33\x6e\x44\x6b\x73\x4f\x64\x77\x72\x56\x4f\x41\x6c\x63\x4a\x61\x4d\x4f\x51\x47\x63\x4b\x39\x77\x37\x62\x44\x6a\x77\x3d\x3d','\x77\x6f\x4d\x45\x4f\x77\x3d\x3d','\x64\x38\x4f\x37\x59\x38\x4b\x6f\x64\x77\x3d\x3d','\x66\x38\x4b\x74\x77\x35\x30\x72\x77\x34\x45\x3d','\x77\x37\x39\x77\x77\x35\x62\x44\x6a\x56\x77\x3d','\x77\x35\x4e\x41\x77\x37\x76\x44\x71\x31\x45\x79\x77\x37\x4c\x44\x6b\x4d\x4f\x38\x77\x36\x70\x68\x77\x70\x6e\x43\x70\x73\x4f\x51\x77\x72\x62\x43\x73\x52\x62\x43\x6e\x67\x3d\x3d','\x77\x72\x38\x75\x4d\x53\x4c\x44\x6c\x51\x3d\x3d','\x77\x72\x59\x42\x77\x36\x64\x6d\x77\x6f\x4d\x3d','\x5a\x63\x4f\x30\x4d\x45\x50\x43\x73\x51\x3d\x3d','\x77\x71\x6e\x43\x72\x53\x76\x43\x75\x77\x44\x44\x6f\x68\x77\x70\x77\x37\x48\x43\x75\x79\x7a\x44\x72\x63\x4b\x70\x77\x36\x49\x3d','\x51\x38\x4b\x4f\x45\x38\x4f\x66\x77\x72\x72\x43\x6e\x4d\x4b\x59\x77\x72\x34\x52\x77\x6f\x62\x44\x6e\x6d\x52\x69\x77\x6f\x56\x73\x4b\x38\x4f\x49\x5a\x6a\x76\x43\x72\x31\x45\x49','\x43\x73\x4b\x2b\x47\x4d\x4b\x77\x52\x51\x4c\x44\x6d\x4d\x4f\x6d\x77\x34\x7a\x44\x67\x48\x49\x31\x77\x34\x41\x3d','\x54\x78\x66\x43\x67\x52\x76\x43\x75\x67\x3d\x3d','\x64\x57\x33\x43\x74\x55\x48\x43\x76\x51\x3d\x3d','\x46\x68\x68\x34\x77\x71\x56\x6e\x77\x72\x76\x43\x6a\x73\x4b\x30\x77\x72\x56\x45','\x77\x71\x4c\x44\x74\x68\x34\x3d','\x77\x36\x68\x65\x53\x73\x4f\x31\x4f\x41\x3d\x3d','\x54\x68\x66\x44\x6f\x73\x4f\x70\x77\x35\x6b\x3d','\x77\x6f\x6b\x71\x4b\x79\x33\x44\x68\x41\x3d\x3d','\x65\x4d\x4f\x41\x77\x36\x6a\x43\x68\x48\x63\x3d','\x4c\x4d\x4b\x64\x77\x35\x42\x57\x77\x6f\x72\x43\x67\x77\x3d\x3d','\x53\x73\x4f\x68\x58\x67\x2f\x44\x71\x41\x3d\x3d','\x77\x71\x6f\x56\x77\x34\x31\x57\x77\x70\x41\x3d','\x65\x32\x37\x43\x6b\x6e\x6a\x43\x68\x51\x52\x67\x64\x67\x3d\x3d','\x53\x55\x6a\x44\x75\x63\x4f\x54\x77\x35\x41\x36\x77\x37\x5a\x41\x77\x34\x62\x43\x6f\x6e\x78\x58\x53\x63\x4f\x73','\x49\x46\x33\x44\x73\x57\x45\x4c','\x59\x51\x6a\x44\x6d\x68\x39\x30','\x77\x36\x39\x4d\x77\x34\x6a\x44\x6a\x57\x73\x3d','\x77\x37\x66\x43\x6a\x41\x6e\x43\x6d\x67\x6b\x3d','\x77\x36\x33\x44\x6f\x63\x4f\x6b\x77\x37\x6e\x43\x73\x6b\x66\x43\x71\x63\x4f\x72\x57\x63\x4f\x75\x56\x55\x35\x77\x77\x36\x66\x43\x72\x63\x4b\x48\x5a\x63\x4f\x39\x44\x63\x4b\x75','\x45\x4d\x4f\x75\x62\x63\x4b\x37\x44\x67\x45\x76\x46\x73\x4b\x66\x4b\x6c\x64\x4b\x46\x67\x3d\x3d','\x57\x77\x62\x43\x70\x38\x4b\x6e\x50\x30\x6c\x6e\x77\x6f\x4c\x43\x6d\x63\x4f\x2b\x77\x36\x6b\x79\x62\x32\x68\x66\x77\x70\x7a\x43\x6e\x41\x34\x3d','\x54\x73\x4f\x4f\x59\x7a\x44\x44\x71\x77\x3d\x3d','\x77\x37\x50\x43\x74\x73\x4b\x69\x77\x71\x48\x44\x6d\x41\x3d\x3d','\x77\x36\x4d\x5a\x4d\x63\x4f\x79\x77\x36\x7a\x44\x75\x77\x58\x43\x69\x68\x59\x41\x77\x37\x6f\x3d','\x45\x4d\x4f\x6b\x51\x63\x4b\x37\x41\x44\x41\x2b\x46\x67\x3d\x3d','\x52\x69\x33\x43\x73\x44\x50\x43\x6f\x73\x4b\x74\x77\x6f\x59\x3d','\x63\x42\x6b\x30\x77\x36\x39\x68\x4f\x51\x3d\x3d','\x66\x33\x50\x43\x70\x48\x7a\x43\x6c\x68\x39\x72\x54\x6c\x73\x36\x77\x6f\x48\x43\x72\x73\x4f\x38\x77\x6f\x6b\x71','\x55\x38\x4b\x64\x77\x37\x41\x4e\x77\x34\x7a\x43\x6c\x55\x6c\x64\x77\x72\x38\x62\x77\x71\x35\x6d\x77\x70\x52\x6a\x77\x37\x7a\x44\x6b\x4d\x4b\x74\x48\x41\x3d\x3d','\x58\x4d\x4b\x38\x4a\x73\x4f\x4e\x77\x71\x45\x3d','\x63\x41\x68\x49\x77\x34\x4e\x63','\x55\x38\x4f\x41\x64\x55\x44\x44\x73\x67\x3d\x3d','\x53\x52\x44\x44\x67\x54\x52\x57','\x56\x38\x4b\x48\x77\x6f\x64\x61\x77\x70\x73\x3d','\x62\x51\x4c\x44\x67\x38\x4f\x72\x77\x34\x49\x3d','\x77\x35\x72\x43\x74\x55\x41\x30\x77\x72\x54\x43\x6c\x69\x5a\x59\x77\x35\x48\x43\x73\x6c\x41\x33\x77\x71\x73\x4f\x77\x72\x76\x43\x69\x63\x4b\x37\x63\x38\x4b\x41\x77\x72\x62\x43\x68\x30\x6f\x3d','\x4e\x67\x48\x43\x6f\x38\x4b\x48\x77\x72\x50\x43\x6d\x51\x3d\x3d','\x57\x63\x4f\x71\x77\x36\x48\x43\x76\x48\x44\x43\x74\x73\x4f\x75\x58\x63\x4f\x4b\x58\x4d\x4b\x48\x77\x35\x48\x44\x68\x48\x6a\x43\x6a\x44\x50\x44\x72\x63\x4b\x4d','\x46\x68\x68\x34\x77\x71\x56\x6e\x77\x72\x76\x43\x69\x73\x4b\x6c\x77\x6f\x4e\x57\x77\x34\x58\x43\x6b\x73\x4f\x6a\x57\x38\x4f\x7a\x51\x47\x49\x3d','\x77\x34\x39\x4b\x77\x35\x62\x44\x75\x6c\x6b\x45\x77\x37\x50\x44\x67\x63\x4f\x2f\x77\x37\x74\x52\x77\x70\x37\x43\x71\x63\x4f\x54\x77\x72\x62\x43\x71\x68\x62\x43\x67\x6d\x4c\x44\x71\x51\x3d\x3d','\x53\x4d\x4f\x6f\x58\x57\x62\x44\x6a\x73\x4f\x39\x77\x34\x7a\x43\x70\x38\x4b\x70\x54\x38\x4b\x47\x77\x70\x66\x44\x67\x4d\x4b\x4f\x45\x73\x4b\x51\x4d\x68\x5a\x66','\x77\x72\x62\x44\x74\x68\x37\x43\x75\x38\x4b\x35\x56\x6d\x4c\x43\x6f\x48\x5a\x2b\x4f\x6d\x4c\x44\x6a\x51\x3d\x3d','\x53\x6a\x48\x43\x6e\x79\x6a\x43\x76\x38\x4b\x47\x77\x6f\x63\x37\x77\x6f\x45\x4d\x53\x43\x45\x54\x77\x36\x66\x44\x75\x54\x68\x44\x42\x58\x73\x3d','\x77\x6f\x78\x78\x77\x72\x63\x2b\x51\x77\x3d\x3d','\x77\x35\x33\x43\x6e\x63\x4f\x69\x4e\x56\x4c\x43\x76\x6b\x5a\x45\x77\x6f\x63\x44','\x77\x34\x41\x4c\x42\x73\x4f\x50\x77\x36\x51\x3d','\x53\x73\x4b\x59\x77\x35\x73\x52\x77\x34\x33\x43\x71\x31\x5a\x64','\x61\x73\x4f\x6c\x56\x7a\x66\x44\x6c\x32\x44\x44\x76\x31\x30\x45','\x77\x34\x6c\x41\x77\x72\x4d\x3d','\x77\x6f\x55\x52\x50\x78\x70\x36','\x77\x37\x6e\x44\x74\x73\x4f\x7a\x77\x72\x54\x43\x68\x46\x6e\x43\x71\x63\x4f\x61','\x4a\x51\x7a\x43\x6d\x4d\x4b\x37\x77\x70\x4d\x3d','\x48\x41\x38\x66\x4e\x57\x50\x44\x75\x63\x4f\x74\x61\x73\x4f\x48\x5a\x46\x6b\x3d','\x45\x4d\x4f\x6e\x51\x73\x4b\x67\x45\x79\x6f\x75','\x77\x37\x7a\x44\x70\x73\x4f\x79\x45\x38\x4f\x30','\x46\x68\x78\x6c\x77\x72\x5a\x4d\x77\x71\x45\x3d','\x77\x70\x4d\x4a\x47\x43\x39\x58','\x77\x34\x6e\x43\x75\x73\x4b\x73\x77\x35\x48\x44\x6e\x77\x3d\x3d','\x77\x72\x35\x52\x77\x71\x45\x49\x53\x41\x3d\x3d','\x4b\x41\x49\x63\x42\x6c\x50\x44\x70\x63\x4f\x73\x59\x73\x4f\x6b\x66\x41\x3d\x3d','\x53\x73\x4f\x4e\x59\x33\x54\x44\x70\x77\x3d\x3d','\x77\x70\x54\x43\x6a\x42\x37\x43\x74\x54\x41\x3d','\x66\x79\x5a\x64\x77\x36\x45\x63','\x64\x44\x2f\x44\x68\x4d\x4f\x78\x77\x35\x6b\x3d','\x77\x72\x72\x44\x6f\x79\x4c\x43\x6c\x4d\x4b\x41','\x77\x34\x76\x44\x70\x32\x37\x43\x69\x68\x6f\x3d','\x77\x36\x58\x43\x74\x63\x4f\x6f\x45\x46\x51\x3d','\x77\x34\x56\x69\x63\x63\x4f\x56\x48\x51\x3d\x3d','\x77\x34\x56\x58\x77\x70\x49\x49\x77\x6f\x77\x3d','\x77\x34\x50\x44\x6e\x6e\x4c\x43\x74\x67\x45\x3d','\x64\x42\x48\x44\x6e\x68\x78\x75','\x77\x70\x72\x44\x75\x53\x6a\x43\x70\x63\x4b\x4f','\x53\x51\x78\x6d\x77\x35\x63\x2b','\x54\x53\x62\x44\x71\x38\x4f\x56\x77\x37\x4e\x62\x77\x35\x39\x6d\x41\x4d\x4f\x4d\x64\x51\x78\x49\x77\x6f\x59\x3d','\x77\x37\x58\x43\x6b\x63\x4b\x6d\x77\x70\x50\x44\x70\x79\x63\x3d','\x61\x53\x5a\x7a\x77\x34\x73\x35\x42\x51\x3d\x3d','\x77\x72\x59\x64\x77\x36\x64\x4e\x77\x6f\x67\x3d','\x59\x63\x4f\x30\x41\x4d\x4b\x36\x77\x72\x6e\x43\x6f\x79\x76\x43\x73\x4d\x4b\x4c\x47\x44\x4e\x53\x77\x70\x51\x6c\x77\x37\x55\x3d','\x77\x72\x63\x76\x47\x53\x35\x4c','\x77\x35\x7a\x43\x76\x56\x59\x3d','\x77\x72\x78\x59\x77\x72\x54\x44\x67\x41\x52\x45\x4d\x79\x44\x44\x6f\x4d\x4f\x42\x45\x77\x3d\x3d','\x77\x37\x76\x43\x68\x47\x49\x38\x77\x6f\x58\x43\x75\x79\x5a\x68\x77\x36\x66\x43\x70\x47\x73\x58\x77\x6f\x38\x55','\x77\x35\x48\x44\x76\x32\x38\x3d','\x53\x4d\x4f\x72\x55\x69\x7a\x44\x73\x41\x3d\x3d','\x77\x37\x37\x43\x6c\x77\x37\x43\x6c\x67\x63\x3d','\x77\x35\x4c\x43\x70\x73\x4b\x4f\x77\x71\x54\x43\x74\x67\x3d\x3d','\x58\x73\x4f\x42\x48\x58\x72\x43\x6b\x4d\x4b\x31\x77\x35\x63\x3d','\x5a\x6d\x2f\x43\x73\x6e\x6a\x43\x6c\x67\x4e\x74\x64\x41\x3d\x3d','\x77\x34\x33\x43\x71\x46\x59\x45\x77\x72\x4c\x43\x6a\x51\x6f\x3d','\x77\x36\x37\x44\x74\x38\x4f\x7a\x77\x36\x72\x43\x76\x6b\x63\x3d','\x47\x69\x48\x43\x6a\x73\x4b\x79\x77\x6f\x48\x44\x6a\x79\x51\x3d','\x77\x70\x6e\x44\x6c\x69\x76\x43\x74\x4d\x4f\x34\x42\x51\x3d\x3d','\x57\x38\x4f\x51\x64\x4d\x4b\x58\x5a\x63\x4f\x77\x77\x35\x67\x3d','\x58\x53\x37\x44\x6d\x51\x74\x61\x77\x71\x77\x61','\x77\x72\x33\x44\x76\x41\x6e\x43\x68\x63\x4b\x2f\x58\x6e\x72\x43\x6b\x51\x3d\x3d','\x77\x72\x35\x4a\x77\x70\x38\x47\x5a\x51\x63\x52\x77\x70\x56\x68\x4a\x63\x4b\x49\x77\x35\x46\x72\x77\x71\x34\x3d','\x77\x70\x56\x35\x77\x72\x54\x44\x68\x41\x45\x3d','\x77\x35\x7a\x43\x74\x54\x4c\x43\x74\x77\x6b\x3d','\x51\x4d\x4f\x76\x63\x32\x66\x44\x69\x4d\x4f\x51\x77\x35\x76\x43\x6d\x63\x4b\x30\x59\x38\x4b\x76\x77\x6f\x54\x44\x69\x63\x4b\x64\x45\x73\x4b\x39\x4f\x68\x6c\x4d\x4c\x51\x3d\x3d','\x57\x53\x31\x51\x77\x35\x67\x7a','\x59\x53\x34\x41\x77\x35\x4a\x63','\x4b\x54\x64\x64\x77\x6f\x6c\x77','\x77\x72\x4d\x76\x77\x37\x70\x68\x77\x70\x77\x3d','\x61\x38\x4b\x2f\x77\x37\x34\x77\x77\x36\x6b\x3d','\x77\x35\x2f\x44\x76\x56\x7a\x43\x75\x77\x6f\x3d','\x77\x35\x37\x43\x6c\x38\x4f\x66\x41\x45\x77\x3d','\x4f\x4d\x4b\x4f\x77\x35\x46\x66\x77\x72\x72\x43\x68\x44\x45\x3d','\x77\x70\x34\x52\x4c\x51\x46\x58','\x77\x35\x4a\x57\x77\x34\x48\x44\x75\x51\x3d\x3d','\x62\x6e\x50\x44\x6f\x73\x4f\x75\x77\x36\x59\x3d','\x56\x38\x4b\x4d\x77\x72\x5a\x36\x77\x70\x38\x3d','\x77\x6f\x33\x43\x70\x47\x78\x30','\x48\x79\x31\x59\x77\x72\x6c\x79','\x77\x36\x58\x43\x76\x6d\x38\x76\x77\x70\x63\x3d','\x63\x42\x44\x43\x76\x4d\x4b\x73\x4f\x51\x3d\x3d','\x77\x37\x58\x43\x76\x38\x4b\x32\x77\x34\x2f\x44\x76\x41\x3d\x3d','\x63\x63\x4f\x74\x77\x37\x2f\x43\x6a\x58\x41\x3d','\x77\x36\x68\x72\x77\x70\x4d\x32\x77\x70\x63\x3d','\x77\x34\x62\x43\x73\x6d\x6f\x35\x77\x70\x55\x3d','\x4d\x58\x2f\x44\x70\x46\x38\x71','\x77\x36\x54\x43\x68\x6e\x34\x75\x77\x6f\x55\x3d','\x66\x63\x4f\x70\x4e\x33\x7a\x43\x6a\x77\x3d\x3d','\x5a\x4d\x4f\x4a\x57\x48\x54\x44\x68\x77\x3d\x3d','\x58\x63\x4f\x57\x4e\x55\x49\x4a\x61\x52\x67\x4f\x42\x38\x4b\x43\x58\x63\x4b\x67\x77\x35\x54\x43\x6e\x67\x3d\x3d','\x56\x51\x78\x74\x77\x37\x46\x35','\x61\x77\x59\x2b\x77\x37\x38\x3d','\x51\x63\x4b\x5a\x47\x73\x4f\x30\x77\x71\x48\x43\x6b\x4d\x4b\x6f\x77\x72\x73\x3d','\x58\x69\x56\x74\x77\x37\x6b\x6d','\x77\x72\x66\x44\x6f\x51\x58\x43\x69\x63\x4b\x55\x58\x57\x59\x3d','\x77\x70\x6f\x4c\x77\x35\x42\x4c\x77\x71\x73\x3d','\x5a\x38\x4b\x79\x77\x71\x68\x59\x77\x6f\x76\x44\x76\x79\x44\x43\x6f\x6e\x54\x43\x74\x58\x39\x73\x47\x63\x4b\x4c','\x56\x63\x4f\x6a\x58\x58\x6a\x44\x6b\x67\x3d\x3d','\x49\x32\x4c\x44\x6c\x46\x67\x47\x55\x63\x4b\x50','\x77\x6f\x49\x54\x49\x42\x74\x63\x77\x71\x41\x31','\x53\x4d\x4f\x72\x52\x57\x76\x44\x68\x67\x3d\x3d','\x57\x4d\x4f\x32\x50\x46\x77\x45','\x77\x71\x48\x44\x6f\x51\x58\x43\x6b\x4d\x4b\x6b\x56\x48\x72\x43\x6b\x77\x3d\x3d','\x77\x35\x42\x6c\x51\x73\x4f\x31','\x77\x71\x77\x74\x77\x36\x5a\x7a\x77\x70\x78\x64\x77\x6f\x41\x43\x77\x72\x64\x56\x77\x34\x5a\x32\x77\x70\x45\x37','\x77\x34\x54\x44\x73\x57\x37\x43\x70\x67\x62\x43\x69\x6b\x6e\x44\x75\x73\x4f\x73\x47\x38\x4f\x68\x77\x34\x74\x42\x77\x72\x37\x44\x70\x73\x4f\x6f\x77\x72\x52\x4f\x77\x6f\x7a\x43\x74\x67\x3d\x3d','\x58\x54\x37\x44\x72\x44\x4e\x56','\x57\x56\x54\x44\x74\x63\x4f\x65\x77\x37\x34\x3d','\x77\x37\x48\x44\x6c\x38\x4b\x69\x45\x67\x3d\x3d','\x77\x37\x76\x43\x67\x4d\x4b\x2b\x77\x6f\x48\x44\x70\x7a\x74\x67\x51\x4d\x4b\x69\x41\x38\x4b\x75\x66\x73\x4b\x58\x77\x72\x6e\x43\x76\x73\x4b\x4c\x49\x42\x52\x37\x54\x77\x3d\x3d','\x51\x4d\x4f\x42\x63\x63\x4b\x51\x64\x63\x4b\x44\x77\x72\x48\x43\x73\x73\x4b\x33\x55\x77\x77\x45\x4b\x57\x67\x3d','\x61\x73\x4f\x32\x77\x6f\x39\x69\x77\x6f\x35\x71\x59\x44\x42\x50\x77\x36\x70\x32\x77\x6f\x51\x72\x77\x72\x4e\x6c','\x77\x37\x6a\x44\x72\x63\x4f\x4b\x77\x36\x62\x43\x71\x41\x3d\x3d','\x77\x34\x68\x58\x77\x71\x67\x51\x77\x6f\x66\x43\x74\x4d\x4b\x61','\x45\x6b\x56\x2b\x77\x71\x33\x43\x69\x41\x3d\x3d','\x65\x38\x4f\x79\x57\x67\x58\x44\x76\x47\x76\x44\x72\x67\x3d\x3d','\x4c\x38\x4b\x4d\x48\x38\x4b\x42\x62\x77\x3d\x3d','\x77\x35\x58\x43\x6e\x41\x67\x4e\x77\x70\x42\x73\x77\x6f\x67\x3d','\x77\x36\x54\x43\x6f\x63\x4b\x62\x77\x36\x72\x44\x76\x77\x3d\x3d','\x77\x70\x78\x31\x77\x71\x67\x34\x64\x77\x3d\x3d','\x4c\x38\x4b\x55\x77\x34\x31\x62\x77\x72\x49\x3d','\x77\x37\x7a\x43\x6b\x63\x4b\x67\x77\x70\x6e\x44\x6b\x53\x4e\x32','\x44\x42\x68\x6e\x77\x71\x52\x64','\x77\x6f\x37\x43\x6c\x6a\x44\x43\x68\x6a\x59\x3d','\x4e\x42\x62\x43\x6f\x4d\x4b\x50\x77\x70\x6a\x43\x6c\x6d\x55\x3d','\x77\x37\x2f\x44\x74\x38\x4f\x32\x77\x36\x2f\x43\x76\x6b\x62\x43\x76\x77\x3d\x3d','\x51\x38\x4f\x61\x77\x72\x4e\x78\x77\x72\x6b\x3d','\x77\x34\x58\x44\x76\x38\x4b\x42\x44\x63\x4b\x6d','\x61\x63\x4f\x76\x61\x67\x4c\x44\x6b\x41\x3d\x3d','\x66\x38\x4f\x68\x77\x70\x4a\x6d\x77\x72\x42\x73\x65\x67\x3d\x3d','\x77\x36\x55\x66\x4e\x41\x3d\x3d','\x63\x73\x4f\x78\x65\x73\x4b\x6b\x59\x77\x3d\x3d','\x77\x35\x59\x74\x4b\x38\x4f\x58\x77\x34\x6b\x3d','\x77\x37\x50\x43\x74\x73\x4f\x56\x49\x6d\x55\x3d','\x59\x73\x4b\x2f\x4d\x63\x4f\x58\x77\x6f\x76\x43\x73\x63\x4b\x59\x77\x6f\x63\x6e\x77\x70\x44\x44\x70\x55\x52\x47\x77\x70\x38\x3d','\x77\x36\x50\x43\x69\x73\x4b\x52\x77\x37\x7a\x44\x71\x41\x3d\x3d','\x54\x68\x6e\x43\x67\x52\x58\x43\x74\x41\x3d\x3d','\x64\x51\x76\x44\x71\x63\x4f\x49\x77\x34\x59\x3d','\x61\x78\x73\x6f\x77\x36\x30\x3d','\x77\x36\x37\x43\x6a\x4d\x4b\x51\x77\x70\x37\x44\x76\x51\x3d\x3d','\x77\x70\x7a\x43\x69\x77\x44\x43\x67\x52\x72\x44\x69\x6a\x41\x3d','\x77\x34\x78\x46\x77\x34\x6a\x44\x71\x6c\x73\x3d','\x56\x7a\x72\x43\x6e\x7a\x62\x43\x6f\x77\x3d\x3d','\x61\x58\x50\x43\x72\x6d\x48\x43\x71\x41\x64\x39','\x49\x77\x55\x4f\x41\x48\x37\x44\x71\x38\x4f\x6c\x59\x67\x3d\x3d','\x62\x4d\x4f\x4a\x4d\x6d\x54\x43\x71\x77\x3d\x3d','\x44\x38\x4b\x64\x77\x34\x68\x6a\x77\x6f\x67\x3d','\x51\x6a\x6e\x44\x6a\x67\x4a\x77','\x43\x4d\x4b\x47\x77\x36\x31\x36\x77\x70\x41\x3d','\x77\x6f\x59\x63\x77\x35\x70\x41\x77\x71\x77\x3d','\x77\x36\x72\x43\x71\x79\x33\x43\x76\x44\x55\x3d','\x56\x69\x37\x43\x68\x73\x4b\x6e\x4b\x67\x3d\x3d','\x55\x4d\x4b\x48\x47\x63\x4f\x76\x77\x71\x30\x3d','\x77\x71\x63\x7a\x49\x77\x4c\x44\x71\x67\x3d\x3d','\x42\x6c\x66\x44\x6c\x6b\x49\x64','\x62\x73\x4b\x72\x77\x34\x41\x4d\x77\x34\x59\x3d','\x51\x52\x44\x43\x73\x77\x72\x43\x76\x51\x3d\x3d','\x77\x71\x50\x43\x6f\x56\x4e\x6f\x65\x41\x3d\x3d','\x77\x71\x54\x44\x76\x52\x6a\x43\x67\x63\x4b\x73\x58\x6d\x62\x43\x69\x32\x56\x74\x43\x57\x58\x44\x69\x63\x4b\x71\x77\x36\x63\x73\x63\x63\x4b\x4a\x4c\x79\x30\x3d','\x53\x43\x59\x63\x77\x34\x5a\x53','\x57\x6a\x44\x43\x75\x44\x6a\x43\x70\x51\x3d\x3d','\x56\x53\x30\x45\x77\x35\x6c\x51','\x77\x36\x2f\x43\x6f\x6a\x50\x43\x6c\x79\x49\x3d','\x77\x34\x6e\x43\x6c\x63\x4b\x6f\x77\x37\x58\x44\x6d\x6b\x73\x3d','\x77\x72\x34\x66\x77\x35\x74\x78\x77\x72\x49\x3d','\x63\x78\x6e\x44\x74\x7a\x5a\x44\x77\x37\x42\x64','\x41\x46\x68\x4f\x77\x71\x72\x43\x70\x42\x74\x64','\x65\x73\x4f\x76\x41\x51\x3d\x3d','\x44\x68\x5a\x55\x77\x72\x74\x4c','\x49\x77\x73\x33\x4f\x48\x55\x3d','\x77\x70\x35\x74\x77\x72\x63\x34\x56\x41\x3d\x3d','\x77\x70\x37\x43\x6e\x41\x6e\x43\x68\x53\x76\x44\x68\x52\x4d\x4c\x77\x34\x7a\x43\x67\x68\x2f\x44\x6e\x73\x4b\x4a\x77\x35\x34\x3d','\x77\x36\x37\x43\x68\x63\x4b\x6a\x77\x36\x6a\x44\x72\x67\x3d\x3d','\x43\x73\x4b\x30\x4e\x4d\x4b\x77\x53\x7a\x50\x44\x69\x63\x4f\x6d','\x48\x4d\x4f\x79\x51\x73\x4b\x67\x45\x79\x6f\x75','\x77\x35\x39\x63\x77\x35\x54\x44\x73\x45\x77\x5a\x77\x37\x4d\x3d','\x53\x43\x7a\x44\x6a\x77\x4a\x67\x77\x72\x51\x3d','\x77\x72\x34\x4c\x41\x43\x33\x44\x68\x4d\x4f\x66\x77\x34\x33\x43\x69\x63\x4b\x73\x77\x6f\x58\x43\x68\x73\x4b\x36\x50\x73\x4b\x4f','\x77\x36\x2f\x44\x68\x4d\x4b\x71\x42\x38\x4b\x52\x77\x36\x6e\x43\x75\x53\x70\x53\x61\x38\x4f\x53\x55\x63\x4b\x56\x62\x73\x4f\x6a','\x54\x51\x78\x56','\x4d\x79\x2f\x43\x71\x4d\x4b\x51\x77\x6f\x34\x3d','\x4e\x33\x50\x44\x75\x6e\x38\x42','\x77\x35\x70\x55\x77\x6f\x6b\x4d\x77\x6f\x41\x3d','\x77\x34\x64\x4c\x77\x72\x51\x4a\x77\x72\x6e\x43\x73\x4d\x4b\x4b\x77\x34\x4d\x3d','\x77\x34\x2f\x43\x67\x4d\x4f\x77\x42\x55\x33\x43\x71\x31\x6b\x3d','\x77\x36\x7a\x43\x73\x52\x41\x46\x77\x71\x31\x5a\x77\x70\x62\x44\x70\x63\x4f\x31\x59\x4d\x4b\x35\x50\x77\x3d\x3d','\x77\x36\x59\x66\x4a\x73\x4f\x75\x77\x36\x76\x44\x72\x44\x44\x43\x70\x77\x30\x64\x77\x36\x2f\x43\x6f\x63\x4f\x64\x77\x70\x41\x3d','\x77\x6f\x74\x43\x77\x71\x48\x44\x6c\x42\x38\x3d','\x59\x38\x4f\x5a\x77\x36\x37\x43\x6b\x33\x45\x3d','\x4f\x73\x4b\x5a\x77\x35\x68\x62\x77\x6f\x76\x43\x69\x78\x4a\x62\x50\x73\x4f\x73\x77\x71\x44\x44\x6e\x38\x4f\x62\x77\x34\x63\x3d','\x66\x69\x7a\x43\x74\x73\x4b\x47\x50\x77\x3d\x3d','\x4e\x38\x4b\x53\x77\x34\x31\x47\x77\x6f\x54\x43\x67\x43\x46\x4d','\x58\x38\x4b\x42\x77\x35\x38\x57\x77\x35\x48\x43\x76\x6b\x67\x3d','\x77\x6f\x4a\x6b\x77\x71\x7a\x44\x6d\x77\x6c\x66\x4a\x42\x72\x44\x74\x38\x4f\x59\x50\x4d\x4b\x6f\x77\x36\x73\x73\x65\x52\x54\x44\x69\x73\x4f\x38\x51\x79\x6e\x43\x6b\x73\x4f\x58\x77\x35\x4c\x44\x6d\x63\x4f\x65','\x56\x78\x44\x43\x74\x4d\x4b\x36\x4b\x46\x42\x78','\x77\x36\x4c\x43\x6d\x38\x4b\x33\x77\x6f\x7a\x44\x74\x6a\x46\x39\x5a\x38\x4f\x6c\x43\x4d\x4b\x4a\x64\x4d\x4b\x4b\x77\x37\x4c\x44\x72\x38\x4b\x42\x50\x51\x49\x31\x55\x77\x41\x59\x59\x77\x34\x79\x77\x72\x66\x43\x6a\x63\x4f\x50\x66\x4d\x4b\x6d\x63\x63\x4b\x58\x50\x68\x62\x44\x6a\x38\x4b\x6c','\x57\x43\x39\x43\x77\x37\x38\x30\x42\x42\x59\x3d','\x54\x42\x6c\x31\x77\x36\x68\x53','\x58\x53\x37\x43\x6e\x4d\x4b\x61\x4f\x51\x3d\x3d','\x77\x70\x39\x38\x77\x72\x55\x31\x54\x79\x67\x3d','\x77\x34\x66\x43\x71\x63\x4f\x75\x44\x6b\x55\x3d','\x77\x35\x37\x43\x6c\x43\x41\x54\x77\x70\x63\x3d','\x77\x37\x72\x43\x73\x63\x4f\x50\x42\x58\x49\x3d','\x77\x70\x6b\x77\x46\x77\x37\x44\x73\x38\x4f\x30\x77\x37\x7a\x43\x76\x67\x3d\x3d','\x51\x4d\x4f\x32\x41\x4d\x4b\x7a\x55\x47\x77\x68\x52\x38\x4b\x46\x51\x45\x59\x63\x47\x67\x42\x6e\x53\x4d\x4b\x32\x4e\x56\x49\x74\x77\x72\x6e\x43\x71\x38\x4b\x6b\x4b\x73\x4f\x47\x77\x72\x50\x43\x68\x38\x4b\x79','\x66\x69\x48\x43\x6b\x73\x4b\x51\x42\x57\x5a\x58\x77\x72\x72\x43\x70\x4d\x4f\x6c','\x57\x4d\x4b\x4d\x77\x35\x6b\x51\x77\x34\x63\x3d','\x77\x34\x2f\x43\x73\x41\x66\x43\x74\x6a\x55\x3d','\x77\x37\x72\x43\x72\x38\x4f\x54\x49\x33\x59\x3d','\x63\x38\x4f\x68\x51\x77\x48\x44\x68\x47\x44\x44\x71\x56\x34\x54','\x4a\x51\x73\x4c\x48\x58\x66\x44\x71\x38\x4f\x38\x61\x4d\x4f\x58','\x52\x78\x76\x43\x6f\x63\x4b\x6e\x47\x30\x4e\x6e\x77\x6f\x4c\x43\x6d\x51\x3d\x3d','\x65\x73\x4f\x37\x55\x38\x4b\x6f','\x77\x37\x41\x56\x4c\x38\x4f\x71\x77\x35\x72\x44\x6f\x41\x51\x3d','\x77\x35\x66\x44\x76\x58\x44\x43\x76\x6a\x44\x43\x6b\x55\x67\x3d','\x77\x37\x76\x43\x6b\x63\x4b\x71\x77\x70\x58\x44\x6b\x53\x42\x68','\x63\x77\x67\x2f\x77\x36\x35\x71\x50\x79\x35\x57\x4b\x44\x6c\x39\x63\x63\x4b\x62\x4d\x51\x3d\x3d','\x48\x38\x4f\x43\x58\x63\x4b\x38\x4a\x41\x3d\x3d','\x55\x43\x48\x43\x6f\x53\x37\x43\x70\x4d\x4b\x63\x77\x70\x73\x75\x77\x70\x4d\x68','\x77\x70\x66\x43\x6e\x41\x76\x43\x6a\x53\x6b\x3d','\x77\x35\x62\x43\x6e\x42\x55\x50\x77\x72\x30\x3d','\x54\x7a\x54\x43\x73\x79\x6a\x43\x6a\x38\x4b\x74\x77\x70\x77\x33\x77\x70\x4d\x3d','\x77\x34\x50\x43\x6a\x78\x55\x46\x77\x71\x46\x79\x77\x71\x54\x44\x70\x63\x4f\x72\x61\x63\x4b\x33\x41\x38\x4b\x6d\x77\x36\x73\x3d','\x61\x73\x4f\x6e\x77\x70\x78\x35\x77\x70\x74\x44\x5a\x7a\x35\x50\x77\x34\x63\x3d','\x47\x38\x4f\x7a\x77\x72\x66\x43\x71\x54\x44\x43\x76\x73\x4b\x2f\x55\x38\x4b\x6e','\x59\x63\x4f\x30\x43\x73\x4b\x70\x77\x72\x33\x43\x6f\x6a\x30\x3d','\x52\x42\x46\x41\x77\x37\x52\x34','\x77\x70\x51\x41\x50\x52\x4e\x74\x77\x72\x34\x5a\x77\x35\x7a\x43\x71\x77\x6c\x5a\x53\x67\x2f\x43\x69\x41\x3d\x3d','\x61\x58\x6e\x44\x6a\x41\x3d\x3d','\x51\x38\x4b\x45\x47\x73\x4f\x74\x77\x70\x48\x43\x6d\x73\x4b\x6a','\x61\x4d\x4f\x31\x58\x41\x77\x3d','\x57\x44\x50\x44\x6d\x42\x42\x67\x77\x72\x51\x64','\x59\x44\x4e\x37','\x44\x58\x58\x44\x6d\x6b\x63\x74\x66\x4d\x4b\x56\x77\x70\x6e\x44\x6c\x67\x3d\x3d','\x77\x6f\x45\x50\x4f\x78\x4e\x78','\x59\x6c\x58\x44\x76\x73\x4f\x49\x77\x34\x4d\x3d','\x51\x73\x4f\x6a\x5a\x6e\x63\x3d','\x77\x72\x39\x78\x77\x72\x58\x44\x6b\x68\x51\x3d','\x43\x73\x4f\x76\x51\x77\x3d\x3d','\x77\x37\x6e\x43\x6a\x67\x2f\x43\x6d\x67\x3d\x3d','\x5a\x77\x67\x35\x77\x36\x6f\x3d','\x55\x7a\x6e\x44\x6c\x78\x52\x78\x77\x71\x51\x4d\x65\x32\x6e\x44\x6b\x73\x4f\x5a\x77\x72\x70\x4b\x4f\x45\x4d\x65\x5a\x63\x4f\x51','\x43\x73\x4f\x76\x55\x63\x4b\x39\x42\x43\x6f\x43\x41\x63\x4b\x4d\x47\x56\x38\x3d','\x52\x51\x4a\x47\x77\x37\x6f\x3d','\x77\x36\x7a\x44\x6b\x38\x4b\x73\x42\x63\x4b\x56\x77\x36\x2f\x43\x67\x77\x64\x47\x61\x63\x4f\x4f','\x77\x35\x6e\x43\x6e\x63\x4f\x6a\x47\x46\x72\x43\x71\x33\x56\x44\x77\x6f\x30\x5a','\x48\x77\x31\x34','\x77\x6f\x37\x43\x6b\x41\x4c\x43\x69\x54\x62\x44\x6c\x43\x49\x55\x77\x35\x4d\x3d','\x55\x73\x4f\x73\x4b\x32\x37\x43\x6f\x51\x3d\x3d','\x77\x37\x4c\x43\x68\x73\x4b\x75\x77\x6f\x62\x44\x75\x68\x6c\x33\x63\x4d\x4b\x72\x46\x63\x4b\x43\x66\x77\x3d\x3d','\x77\x36\x76\x44\x70\x38\x4f\x52\x4d\x4d\x4f\x6e','\x65\x77\x44\x44\x6e\x63\x4f\x74\x77\x34\x51\x3d','\x57\x67\x33\x43\x70\x63\x4b\x6e\x4c\x6e\x52\x77\x77\x6f\x50\x43\x6a\x73\x4f\x45\x77\x36\x67\x6b','\x77\x35\x6e\x43\x76\x4d\x4f\x6b\x45\x46\x4d\x3d','\x77\x34\x6e\x43\x6b\x41\x6a\x43\x74\x52\x55\x3d','\x53\x73\x4f\x6a\x77\x34\x58\x43\x76\x31\x59\x3d','\x77\x6f\x64\x4d\x77\x70\x59\x77\x5a\x67\x3d\x3d','\x77\x37\x33\x43\x71\x69\x44\x43\x6e\x43\x45\x3d','\x63\x63\x4f\x44\x77\x36\x44\x43\x6d\x6b\x38\x3d','\x63\x38\x4f\x53\x77\x70\x6c\x39\x77\x72\x67\x3d','\x77\x35\x33\x44\x6d\x30\x76\x43\x71\x52\x6b\x3d','\x64\x38\x4f\x6a\x63\x53\x6e\x44\x73\x51\x3d\x3d','\x77\x34\x2f\x44\x67\x4d\x4f\x50\x45\x38\x4f\x6f','\x77\x36\x72\x43\x6b\x63\x4b\x67\x77\x70\x66\x44\x71\x7a\x70\x32','\x77\x72\x54\x44\x6f\x52\x6a\x43\x69\x38\x4b\x35','\x49\x67\x58\x43\x76\x63\x4b\x48\x77\x71\x6e\x43\x69\x45\x6e\x44\x71\x6b\x52\x4f\x53\x73\x4f\x38\x77\x6f\x63\x65','\x51\x4d\x4f\x2b\x5a\x33\x50\x44\x76\x73\x4f\x4c\x77\x35\x6f\x3d','\x77\x70\x34\x36\x4e\x51\x3d\x3d','\x77\x35\x42\x2f\x55\x4d\x4f\x6c\x4c\x51\x3d\x3d','\x5a\x73\x4f\x67\x58\x4d\x4b\x6a','\x63\x38\x4f\x6a\x43\x38\x4b\x70\x77\x72\x44\x43\x76\x43\x2f\x43\x6e\x63\x4b\x42','\x62\x63\x4f\x36\x77\x70\x42\x75','\x52\x73\x4f\x70\x64\x6b\x62\x44\x69\x4d\x4f\x50\x77\x35\x73\x3d','\x49\x51\x33\x43\x71\x4d\x4b\x4d','\x77\x37\x4c\x43\x70\x4d\x4b\x62\x77\x34\x7a\x44\x6f\x52\x54\x43\x6e\x33\x42\x69','\x59\x4d\x4f\x77\x56\x73\x4b\x31\x56\x63\x4b\x31\x77\x72\x48\x43\x6b\x4d\x4b\x51\x64\x6a\x38\x3d','\x4a\x33\x70\x6f','\x77\x37\x76\x43\x69\x77\x59\x53\x77\x72\x74\x42\x77\x70\x4c\x44\x6f\x73\x4f\x74','\x53\x7a\x44\x43\x6f\x53\x37\x43\x70\x41\x3d\x3d','\x77\x36\x37\x43\x69\x41\x62\x43\x6d\x67\x3d\x3d','\x52\x73\x4f\x71\x77\x36\x4c\x43\x74\x47\x38\x3d','\x43\x30\x39\x46\x77\x71\x62\x43\x6c\x7a\x39\x50\x77\x71\x44\x43\x6e\x41\x3d\x3d','\x64\x2b\x61\x4a\x74\x65\x6d\x58\x68\x73\x4f\x49','\x66\x4f\x65\x59\x69\x4f\x57\x77\x6a\x65\x57\x2f\x6b\x65\x57\x39\x6f\x67\x3d\x3d','\x57\x4d\x4f\x71\x77\x37\x63\x3d','\x77\x37\x59\x54\x4c\x63\x4f\x69','\x77\x6f\x48\x43\x71\x6d\x74\x68','\x77\x36\x6f\x66\x49\x63\x4f\x31\x77\x37\x48\x44\x71\x77\x58\x43\x74\x42\x59\x79\x77\x36\x50\x43\x76\x63\x4f\x64\x77\x6f\x77\x7a\x47\x69\x50\x44\x6f\x67\x3d\x3d','\x51\x54\x44\x43\x72\x6a\x2f\x43\x75\x4d\x4b\x30\x77\x70\x51\x6f\x77\x70\x30\x3d','\x48\x63\x4f\x72\x52\x73\x4b\x75','\x4f\x41\x38\x65\x42\x6e\x58\x44\x76\x73\x4f\x58\x62\x4d\x4f\x41\x63\x51\x3d\x3d','\x58\x7a\x33\x44\x67\x67\x63\x3d','\x52\x63\x4b\x43\x47\x4d\x4f\x6c\x77\x72\x33\x43\x68\x38\x4b\x6d\x77\x72\x6f\x46','\x77\x37\x37\x43\x67\x73\x4b\x37\x77\x70\x55\x3d','\x77\x70\x4d\x57\x77\x36\x31\x53\x77\x71\x38\x3d','\x46\x4d\x4f\x72\x53\x67\x3d\x3d','\x66\x4d\x4b\x6c\x77\x71\x4e\x4a\x77\x70\x59\x3d','\x77\x72\x37\x43\x69\x53\x7a\x43\x68\x44\x51\x3d','\x77\x37\x62\x44\x68\x6c\x76\x43\x68\x43\x72\x43\x75\x6e\x50\x44\x74\x63\x4f\x55\x49\x63\x4f\x6f\x77\x37\x68\x77\x77\x70\x30\x3d','\x52\x67\x66\x43\x6d\x38\x4b\x2f\x4b\x51\x3d\x3d','\x77\x35\x66\x44\x75\x73\x4f\x34\x41\x38\x4f\x45\x77\x71\x49\x6b\x77\x34\x6e\x43\x72\x63\x4f\x45\x77\x71\x30\x4b\x63\x73\x4f\x43','\x77\x36\x66\x43\x6f\x73\x4b\x47\x77\x34\x6a\x44\x6b\x42\x6e\x43\x68\x51\x3d\x3d','\x77\x37\x62\x43\x6e\x78\x49\x49\x77\x6f\x30\x3d','\x53\x7a\x44\x43\x6f\x53\x37\x43\x70\x4d\x4b\x4a\x77\x6f\x63\x31\x77\x70\x55\x32\x54\x54\x4d\x3d','\x56\x51\x70\x66\x77\x37\x34\x3d','\x77\x72\x41\x78\x50\x79\x5a\x52','\x77\x34\x37\x43\x75\x63\x4f\x73\x4f\x45\x63\x3d','\x63\x73\x4b\x38\x77\x36\x34\x70\x77\x37\x62\x44\x73\x67\x3d\x3d','\x56\x41\x59\x2f\x77\x35\x78\x46','\x77\x34\x37\x43\x6a\x42\x58\x43\x71\x77\x41\x3d','\x64\x4d\x4f\x43\x77\x70\x6c\x67\x77\x72\x63\x3d','\x61\x63\x4b\x74\x77\x36\x73\x75\x77\x36\x62\x43\x69\x47\x52\x6f\x77\x6f\x73\x78\x77\x70\x64\x53\x77\x71\x35\x53','\x77\x35\x5a\x46\x77\x35\x66\x44\x71\x32\x45\x66\x77\x36\x48\x44\x67\x73\x4f\x46\x77\x37\x39\x76\x77\x6f\x44\x43\x76\x63\x4f\x42\x77\x72\x62\x43\x74\x52\x4d\x3d','\x65\x4d\x4f\x62\x77\x34\x4c\x43\x67\x6b\x62\x43\x67\x4d\x4f\x55\x66\x38\x4f\x48\x5a\x38\x4b\x77\x77\x36\x66\x44\x6a\x30\x73\x3d','\x53\x73\x4b\x4c\x77\x34\x41\x61\x77\x34\x62\x43\x75\x55\x67\x3d','\x45\x63\x4b\x76\x4b\x51\x3d\x3d','\x52\x79\x64\x6f\x77\x35\x78\x47','\x77\x36\x64\x74\x77\x6f\x30\x74\x77\x6f\x41\x3d','\x77\x35\x37\x43\x6c\x38\x4f\x66\x48\x30\x76\x43\x75\x52\x4a\x33\x77\x70\x73\x55\x77\x71\x4e\x79\x46\x32\x49\x3d','\x77\x35\x37\x43\x73\x79\x62\x43\x71\x44\x5a\x2f\x59\x4d\x4f\x66\x53\x56\x6a\x43\x73\x38\x4b\x37\x77\x71\x56\x76','\x4c\x53\x34\x6e\x4d\x31\x77\x3d','\x57\x73\x4f\x64\x66\x38\x4b\x58\x61\x41\x3d\x3d','\x77\x71\x77\x6b\x44\x69\x5a\x57\x77\x37\x49\x3d','\x53\x44\x6e\x44\x67\x67\x3d\x3d','\x77\x34\x6a\x44\x67\x33\x76\x43\x75\x44\x63\x3d','\x54\x63\x4f\x6d\x77\x37\x48\x43\x68\x33\x59\x3d','\x77\x35\x2f\x43\x67\x51\x41\x3d','\x77\x35\x58\x44\x74\x73\x4f\x4a\x50\x38\x4f\x30','\x55\x38\x4f\x35\x62\x41\x3d\x3d','\x54\x73\x4f\x39\x77\x37\x54\x43\x75\x6e\x45\x3d','\x48\x4d\x4f\x34\x51\x4d\x4b\x67\x45\x77\x3d\x3d','\x77\x34\x63\x34\x41\x38\x4f\x56\x77\x35\x51\x3d','\x77\x34\x44\x43\x74\x55\x63\x5a\x77\x72\x54\x43\x71\x51\x74\x65\x77\x35\x62\x43\x69\x45\x34\x6c','\x77\x37\x4c\x44\x6a\x38\x4b\x42\x4d\x38\x4b\x34','\x35\x62\x43\x5a\x35\x62\x32\x48\x35\x62\x36\x66\x35\x71\x69\x4c\x35\x5a\x36\x53\x35\x37\x6d\x58\x35\x61\x32\x2f\x35\x61\x61\x56\x36\x4c\x65\x65\x37\x37\x36\x62\x35\x70\x57\x64\x35\x72\x47\x55\x35\x4c\x2b\x50\x35\x35\x65\x50','\x54\x58\x58\x44\x6a\x63\x4f\x41\x77\x34\x30\x3d','\x77\x36\x33\x43\x6a\x4d\x4b\x6b\x77\x6f\x50\x44\x6e\x51\x3d\x3d','\x35\x62\x79\x50\x35\x61\x65\x4b\x35\x5a\x4f\x75\x35\x59\x71\x6b\x35\x62\x4f\x34\x35\x62\x36\x75\x35\x62\x2b\x4e\x35\x62\x2b\x53\x36\x4c\x65\x4a','\x77\x35\x48\x44\x76\x57\x76\x43\x73\x67\x4d\x3d','\x61\x63\x4f\x68\x77\x70\x4a\x6f\x77\x6f\x70\x31\x65\x67\x3d\x3d','\x66\x73\x4f\x6f\x41\x63\x4b\x42\x77\x71\x41\x3d','\x57\x53\x4e\x56\x77\x37\x30\x3d','\x66\x38\x4f\x70\x57\x77\x7a\x44\x74\x47\x44\x44\x72\x6c\x77\x3d','\x50\x47\x56\x41\x77\x6f\x37\x43\x73\x67\x3d\x3d','\x66\x63\x4f\x72\x46\x6e\x73\x3d','\x62\x73\x4f\x77\x54\x41\x7a\x44\x68\x6e\x4d\x3d','\x55\x46\x44\x44\x6b\x73\x4f\x46\x77\x35\x63\x3d','\x77\x36\x2f\x43\x6d\x63\x4b\x68\x77\x37\x2f\x44\x6e\x41\x3d\x3d','\x77\x36\x34\x56\x4a\x77\x3d\x3d','\x65\x44\x4e\x57\x77\x37\x42\x47','\x4d\x63\x4f\x50\x63\x38\x4b\x66\x4e\x47\x59\x3d','\x77\x37\x66\x43\x71\x63\x4b\x73\x77\x72\x58\x44\x71\x77\x3d\x3d','\x42\x4d\x4b\x2f\x4d\x38\x4b\x4a\x54\x7a\x6e\x44\x69\x38\x4f\x76\x77\x36\x62\x44\x74\x6d\x77\x67','\x5a\x4d\x4f\x4e\x4a\x48\x6e\x43\x6f\x41\x3d\x3d','\x77\x35\x2f\x43\x69\x77\x6b\x48\x77\x72\x74\x75','\x77\x34\x62\x44\x6a\x73\x4f\x36\x77\x34\x33\x43\x6d\x51\x3d\x3d','\x77\x37\x72\x43\x6e\x63\x4f\x6a\x49\x6d\x63\x3d','\x56\x51\x33\x43\x73\x4d\x4b\x4b\x4d\x30\x70\x6b\x77\x6f\x4d\x3d','\x49\x53\x48\x43\x75\x63\x4b\x6a\x77\x70\x59\x3d','\x62\x42\x33\x44\x67\x4d\x4f\x76\x77\x35\x39\x39','\x77\x35\x31\x6b\x51\x73\x4f\x48\x4d\x51\x3d\x3d','\x47\x73\x4f\x6c\x56\x73\x4b\x71','\x56\x7a\x50\x44\x6b\x51\x3d\x3d','\x77\x6f\x42\x34\x77\x72\x38\x77\x54\x41\x73\x76\x77\x71\x68\x57','\x66\x75\x61\x4a\x71\x75\x6d\x55\x74\x41\x63\x3d','\x77\x36\x58\x43\x73\x63\x4b\x64\x77\x34\x51\x3d','\x62\x4f\x65\x5a\x72\x2b\x57\x78\x75\x75\x57\x39\x67\x2b\x57\x38\x6a\x51\x3d\x3d','\x61\x32\x44\x43\x74\x57\x30\x3d','\x77\x36\x37\x44\x6e\x63\x4f\x59\x4f\x4d\x4f\x58','\x63\x4d\x4f\x4b\x56\x69\x6e\x44\x68\x67\x3d\x3d','\x77\x37\x50\x44\x6e\x31\x7a\x43\x76\x77\x49\x3d','\x4a\x73\x4f\x36\x56\x63\x4b\x32\x77\x36\x6e\x44\x6f\x44\x4c\x44\x6d\x38\x4b\x57\x52\x54\x59\x34\x77\x6f\x6c\x68\x77\x36\x37\x43\x6c\x44\x66\x44\x76\x63\x4f\x59\x55\x55\x56\x58\x77\x35\x4c\x44\x71\x38\x4b\x78\x77\x70\x62\x44\x68\x73\x4b\x71','\x55\x43\x39\x33\x77\x34\x41\x69','\x63\x7a\x64\x69\x77\x35\x46\x37','\x77\x36\x72\x43\x6b\x4d\x4b\x6e\x77\x72\x58\x44\x76\x41\x3d\x3d','\x77\x6f\x33\x43\x76\x6b\x35\x30\x54\x77\x3d\x3d','\x77\x37\x64\x34\x56\x4d\x4f\x6a\x4f\x31\x7a\x43\x6c\x54\x30\x6b\x77\x71\x66\x43\x74\x58\x48\x43\x6e\x33\x2f\x44\x71\x4d\x4f\x53\x57\x67\x2f\x43\x68\x73\x4f\x6d\x77\x71\x46\x43\x55\x31\x67\x6d\x65\x52\x37\x43\x6f\x46\x41\x58','\x77\x70\x63\x41\x49\x68\x4d\x75\x77\x71\x55\x30\x77\x35\x54\x43\x76\x67\x56\x57','\x77\x35\x52\x2f\x53\x4d\x4f\x76\x50\x52\x58\x43\x6c\x6a\x77\x3d','\x66\x4d\x4b\x53\x77\x36\x30\x59\x77\x36\x38\x3d','\x64\x44\x6a\x44\x76\x38\x4f\x31\x77\x37\x6b\x3d','\x44\x47\x35\x48\x77\x71\x6e\x43\x6b\x51\x3d\x3d','\x55\x6a\x4c\x44\x68\x52\x4a\x6b\x77\x71\x67\x64\x63\x33\x7a\x44\x75\x63\x4f\x56\x77\x6f\x64\x4b\x4c\x31\x51\x4a\x61\x63\x4f\x56\x46\x63\x4b\x37','\x77\x72\x70\x34\x77\x72\x6b\x51\x55\x7a\x59\x72\x77\x71\x68\x52\x41\x4d\x4b\x6e','\x77\x36\x54\x43\x69\x52\x48\x43\x69\x78\x4a\x54\x53\x38\x4f\x6d\x65\x6d\x58\x43\x67\x4d\x4b\x70\x77\x6f\x56\x59\x77\x6f\x59\x54\x58\x6e\x68\x67\x77\x70\x77\x3d','\x43\x73\x4b\x33\x4e\x38\x4b\x72\x57\x43\x6e\x44\x6d\x51\x3d\x3d','\x4b\x73\x4b\x55\x77\x35\x74\x63','\x45\x78\x64\x34\x77\x71\x56\x5a\x77\x71\x66\x43\x69\x4d\x4b\x33','\x77\x35\x48\x44\x75\x6e\x72\x43\x76\x51\x3d\x3d','\x57\x73\x4f\x38\x42\x46\x76\x43\x6a\x67\x3d\x3d','\x77\x72\x63\x38\x77\x36\x4e\x30\x77\x6f\x77\x6e','\x42\x47\x6c\x34\x77\x71\x58\x43\x6b\x67\x3d\x3d','\x77\x70\x56\x2b\x77\x6f\x54\x44\x70\x56\x34\x45','\x77\x35\x48\x44\x71\x45\x37\x43\x6f\x54\x59\x3d','\x77\x6f\x73\x52\x77\x34\x64\x4b','\x4d\x32\x4a\x6a\x77\x71\x76\x43\x67\x77\x3d\x3d','\x77\x70\x66\x44\x75\x43\x6a\x43\x68\x63\x4b\x48','\x77\x36\x7a\x43\x73\x4d\x4b\x38\x77\x70\x72\x44\x72\x41\x3d\x3d','\x77\x71\x2f\x43\x71\x77\x7a\x43\x69\x77\x73\x3d','\x62\x47\x37\x43\x72\x48\x7a\x43\x6e\x67\x46\x72','\x59\x38\x4f\x32\x48\x6b\x41\x6b','\x77\x36\x2f\x43\x6b\x68\x54\x43\x6c\x68\x63\x3d','\x56\x63\x4b\x65\x77\x6f\x6c\x74\x77\x70\x63\x3d','\x77\x6f\x5a\x2b\x77\x6f\x45\x68\x53\x51\x3d\x3d','\x77\x35\x4c\x43\x6e\x41\x49\x42\x77\x70\x42\x76\x77\x70\x38\x3d','\x77\x36\x2f\x44\x6c\x38\x4b\x39\x45\x73\x4b\x65\x77\x36\x2f\x43\x67\x78\x52\x42\x59\x4d\x4f\x4b\x55\x63\x4b\x64\x65\x41\x3d\x3d','\x77\x36\x33\x44\x6d\x63\x4b\x67\x47\x73\x4b\x76\x77\x37\x4c\x43\x75\x41\x3d\x3d','\x43\x42\x5a\x6b\x77\x72\x78\x6e\x77\x71\x44\x43\x6a\x77\x3d\x3d','\x77\x71\x68\x4f\x77\x71\x7a\x44\x6b\x51\x3d\x3d','\x77\x35\x42\x78\x77\x35\x4c\x44\x69\x6b\x77\x3d','\x77\x34\x46\x2b\x52\x38\x4f\x2b\x50\x54\x6e\x43\x6c\x79\x59\x67\x77\x72\x45\x3d','\x52\x63\x4f\x75\x77\x37\x44\x43\x76\x47\x54\x43\x6f\x38\x4f\x2f\x51\x4d\x4f\x6e','\x61\x4d\x4f\x7a\x55\x42\x72\x44\x6f\x6d\x62\x44\x75\x46\x38\x56','\x61\x63\x4f\x6f\x55\x41\x59\x3d','\x77\x6f\x73\x34\x4f\x41\x56\x53','\x45\x6e\x58\x44\x6d\x58\x51\x71\x53\x4d\x4b\x5a\x77\x70\x4c\x44\x67\x4d\x4b\x54\x77\x72\x41\x3d','\x77\x72\x52\x56\x77\x72\x62\x44\x67\x51\x78\x59\x49\x68\x62\x44\x74\x63\x4f\x59\x42\x67\x3d\x3d','\x5a\x38\x4f\x76\x41\x58\x6f\x2b\x58\x7a\x51\x3d','\x77\x71\x66\x44\x67\x42\x6e\x43\x69\x73\x4b\x70','\x77\x35\x6c\x79\x77\x71\x41\x6f\x77\x71\x38\x3d','\x77\x6f\x6b\x6d\x4b\x68\x6e\x44\x6f\x4d\x4f\x78\x77\x37\x34\x3d','\x45\x78\x64\x69\x77\x71\x56\x52\x77\x71\x6a\x43\x68\x38\x4b\x37\x77\x71\x5a\x46','\x77\x36\x66\x44\x6a\x38\x4f\x49\x4e\x38\x4f\x70','\x57\x38\x4b\x2f\x77\x70\x74\x38\x77\x70\x38\x3d','\x77\x35\x37\x44\x6a\x73\x4f\x48\x77\x36\x58\x43\x74\x41\x3d\x3d','\x54\x54\x37\x44\x6b\x7a\x4e\x79','\x77\x34\x62\x44\x69\x73\x4f\x6b\x77\x36\x33\x43\x75\x41\x3d\x3d','\x77\x70\x6b\x72\x77\x37\x4a\x42\x77\x6f\x38\x3d','\x52\x38\x4b\x6e\x77\x72\x74\x5a\x77\x6f\x63\x3d','\x5a\x4d\x4b\x4a\x77\x6f\x46\x6a\x77\x70\x6f\x3d','\x77\x72\x6f\x6a\x77\x34\x68\x54\x77\x70\x45\x3d','\x63\x4d\x4f\x39\x56\x4d\x4b\x31\x63\x38\x4b\x75\x77\x6f\x72\x43\x68\x38\x4b\x6b\x62\x67\x3d\x3d','\x64\x47\x7a\x43\x69\x55\x6c\x74\x52\x38\x4f\x4d\x77\x6f\x50\x43\x6b\x51\x3d\x3d','\x77\x6f\x6f\x74\x44\x53\x72\x44\x6a\x41\x3d\x3d','\x42\x4d\x4b\x61\x77\x35\x31\x7a\x77\x37\x72\x44\x67\x55\x33\x43\x6a\x68\x55\x3d','\x4b\x41\x63\x6b\x48\x58\x45\x3d','\x42\x48\x7a\x44\x69\x56\x41\x34\x58\x38\x4b\x46\x77\x35\x2f\x44\x67\x63\x4b\x65\x77\x71\x58\x43\x67\x73\x4b\x6b\x77\x6f\x64\x6b\x77\x35\x6b\x42\x77\x36\x37\x43\x6d\x38\x4b\x58\x77\x37\x76\x43\x70\x43\x37\x44\x74\x4d\x4b\x79\x49\x38\x4b\x71\x77\x71\x72\x43\x70\x38\x4f\x49\x44\x45\x39\x69\x77\x70\x51\x41\x66\x45\x46\x7a\x77\x37\x55\x73\x4f\x38\x4b\x6d\x4c\x63\x4b\x68\x4f\x79\x6e\x44\x72\x77\x78\x6b','\x42\x47\x6e\x44\x6f\x6d\x30\x63','\x77\x35\x76\x43\x6a\x38\x4b\x39\x77\x70\x48\x44\x72\x79\x31\x38\x50\x38\x4b\x73\x41\x73\x4b\x65\x66\x4d\x4b\x43\x77\x72\x72\x43\x76\x38\x4f\x5a\x46\x77\x39\x72\x58\x6c\x67\x47\x62\x6b\x30\x70\x77\x72\x76\x43\x6e\x4d\x4f\x59\x61\x73\x4f\x2b\x61\x73\x4b\x4f\x4b\x67\x4c\x44\x6b\x73\x4b\x35\x77\x35\x55\x3d','\x45\x77\x6a\x43\x76\x63\x4b\x48\x77\x71\x62\x43\x6d\x47\x2f\x43\x71\x31\x4a\x5a\x52\x4d\x4f\x54\x77\x70\x34\x66\x44\x51\x74\x4e\x77\x72\x70\x36\x57\x68\x42\x67\x77\x36\x6b\x4b\x65\x77\x64\x4f\x66\x63\x4f\x76\x45\x7a\x76\x43\x75\x4d\x4f\x46\x43\x4d\x4f\x37\x77\x36\x54\x44\x72\x63\x4f\x67','\x47\x7a\x48\x43\x71\x38\x4b\x44\x77\x71\x38\x3d','\x77\x34\x76\x43\x69\x53\x2f\x43\x69\x67\x63\x64\x57\x63\x4f\x36\x64\x58\x4c\x43\x6b\x63\x4b\x54\x77\x70\x35\x45\x77\x34\x4d\x52\x55\x6e\x31\x69\x77\x70\x35\x38\x56\x38\x4b\x50\x45\x38\x4f\x58\x77\x36\x41\x39\x49\x45\x62\x43\x69\x4d\x4b\x79\x77\x34\x72\x43\x74\x51\x37\x43\x6f\x63\x4b\x53\x77\x35\x66\x44\x73\x4d\x4f\x75\x4b\x63\x4b\x36\x64\x73\x4f\x38\x63\x6a\x74\x50\x44\x77\x45\x6c\x77\x72\x34\x3d','\x61\x38\x4f\x70\x58\x41\x3d\x3d','\x77\x35\x50\x43\x6e\x73\x4b\x62\x77\x34\x37\x44\x68\x77\x3d\x3d','\x41\x53\x49\x4c\x41\x55\x67\x3d','\x77\x37\x7a\x44\x70\x57\x37\x43\x76\x69\x51\x3d','\x4e\x4d\x4b\x33\x44\x4d\x4b\x42\x65\x77\x3d\x3d','\x45\x77\x41\x37\x48\x47\x59\x3d','\x77\x70\x62\x44\x72\x69\x37\x43\x72\x31\x76\x43\x68\x42\x37\x44\x6d\x63\x4b\x32','\x77\x72\x33\x44\x76\x73\x4b\x67\x77\x37\x44\x44\x71\x55\x6e\x44\x75\x4d\x4f\x49\x42\x63\x4f\x68\x4f\x55\x41\x6c','\x55\x38\x4b\x6d\x64\x4d\x4b\x34\x47\x43\x48\x43\x6e\x73\x4f\x2f\x77\x70\x73\x3d','\x77\x36\x58\x44\x72\x31\x6a\x43\x6d\x4d\x4f\x34\x53\x79\x58\x43\x67\x7a\x45\x3d','\x66\x73\x4f\x70\x77\x35\x66\x43\x6b\x55\x30\x3d','\x52\x38\x4f\x4b\x59\x58\x7a\x44\x6f\x67\x3d\x3d','\x57\x38\x4b\x6d\x63\x63\x4b\x34\x47\x69\x48\x43\x6d\x38\x4f\x2f\x77\x70\x6a\x44\x6f\x79\x6f\x6f\x77\x6f\x4e\x55\x41\x63\x4f\x30\x45\x67\x3d\x3d','\x77\x35\x76\x43\x70\x55\x41\x65\x77\x72\x63\x3d','\x41\x4d\x4b\x74\x4d\x63\x4b\x39\x59\x77\x3d\x3d','\x77\x34\x59\x31\x42\x38\x4f\x2b\x77\x34\x51\x3d','\x77\x72\x6a\x44\x76\x73\x4b\x6d\x77\x37\x44\x44\x71\x55\x6e\x44\x76\x63\x4f\x49\x41\x77\x3d\x3d','\x43\x79\x44\x43\x68\x52\x6f\x78\x77\x72\x70\x62\x5a\x69\x77\x3d','\x46\x68\x38\x48\x77\x36\x63\x2b\x53\x38\x4f\x31\x77\x71\x41\x54\x77\x6f\x49\x70\x52\x4d\x4b\x69\x77\x6f\x4e\x35\x51\x53\x41\x3d','\x48\x6e\x2f\x44\x6d\x56\x38\x38\x57\x4d\x4b\x49\x77\x35\x2f\x44\x73\x63\x4b\x4c\x77\x72\x76\x43\x68\x38\x4b\x76\x77\x6f\x51\x5a','\x56\x38\x4f\x6c\x63\x57\x62\x44\x68\x67\x3d\x3d','\x77\x72\x30\x64\x42\x54\x44\x44\x6a\x51\x3d\x3d','\x56\x51\x34\x43\x77\x35\x35\x6a','\x77\x34\x42\x65\x77\x36\x66\x44\x6d\x6b\x6b\x3d','\x63\x53\x56\x51\x77\x37\x6b\x77\x42\x41\x66\x43\x67\x63\x4f\x38\x77\x72\x63\x49\x77\x70\x78\x50\x77\x36\x52\x30','\x54\x63\x4f\x32\x41\x73\x4b\x7a\x56\x79\x4a\x75\x44\x38\x4f\x4d\x43\x51\x74\x58\x56\x41\x3d\x3d','\x77\x71\x73\x30\x43\x44\x35\x46','\x41\x38\x4f\x5a\x66\x73\x4b\x63\x42\x67\x3d\x3d','\x77\x70\x44\x43\x6e\x43\x44\x43\x68\x43\x59\x3d','\x77\x34\x54\x43\x6f\x73\x4b\x62\x77\x34\x72\x44\x76\x56\x50\x43\x6d\x6e\x6c\x36\x42\x4d\x4f\x41\x56\x6c\x73\x77\x66\x6d\x39\x49\x61\x6a\x52\x52\x63\x38\x4f\x52\x77\x6f\x49\x77\x4e\x6d\x46\x54\x46\x77\x58\x44\x69\x51\x3d\x3d','\x77\x35\x67\x6a\x63\x41\x62\x43\x73\x38\x4f\x68\x77\x71\x48\x43\x70\x63\x4f\x4f\x77\x72\x44\x44\x6f\x51\x3d\x3d','\x77\x35\x63\x55\x47\x73\x4f\x65\x77\x34\x38\x3d','\x66\x42\x4c\x43\x73\x73\x4b\x64\x4b\x51\x3d\x3d','\x45\x56\x72\x44\x6c\x6d\x41\x57','\x63\x38\x4b\x31\x77\x34\x45\x4f\x77\x36\x34\x3d','\x43\x56\x72\x44\x6a\x32\x45\x42','\x77\x71\x73\x57\x4c\x69\x44\x44\x74\x51\x3d\x3d','\x5a\x38\x4f\x41\x50\x4d\x4b\x5a\x77\x70\x51\x3d','\x77\x72\x34\x64\x77\x34\x6c\x68\x77\x72\x59\x3d','\x58\x63\x4f\x77\x4c\x6e\x6e\x43\x6a\x51\x3d\x3d','\x77\x71\x72\x44\x69\x73\x4f\x2f\x43\x38\x4f\x44\x77\x36\x66\x44\x71\x41\x6b\x42\x65\x63\x4b\x61','\x4e\x67\x2f\x43\x69\x63\x4b\x49\x77\x72\x51\x3d','\x77\x71\x62\x44\x67\x52\x37\x43\x73\x63\x4b\x36','\x62\x42\x62\x44\x6e\x73\x4f\x41\x77\x35\x73\x3d','\x44\x38\x4f\x4e\x65\x63\x4b\x6c\x4e\x41\x3d\x3d','\x4e\x7a\x46\x48\x77\x72\x35\x65','\x77\x37\x7a\x44\x73\x4d\x4b\x32\x47\x4d\x4b\x56','\x77\x35\x35\x6f\x77\x35\x58\x44\x71\x6b\x34\x3d','\x46\x38\x4f\x77\x4d\x79\x50\x44\x6e\x63\x4b\x54\x77\x6f\x37\x43\x75\x73\x4f\x75\x62\x4d\x4f\x42\x77\x34\x44\x44\x6b\x4d\x4f\x49\x43\x38\x4f\x2b\x62\x51\x73\x65\x4e\x4d\x4b\x5a\x57\x73\x4f\x56\x77\x36\x76\x43\x6e\x6b\x66\x43\x6a\x63\x4b\x67\x4d\x43\x55\x42\x5a\x63\x4b\x33\x77\x35\x2f\x44\x71\x38\x4b\x32\x65\x43\x6f\x55\x4a\x41\x3d\x3d','\x77\x35\x35\x44\x77\x34\x37\x44\x6e\x48\x59\x3d','\x57\x7a\x6a\x43\x6f\x63\x4b\x73\x4e\x67\x3d\x3d','\x77\x6f\x49\x33\x4b\x7a\x2f\x44\x75\x41\x3d\x3d','\x77\x6f\x55\x33\x44\x68\x4c\x44\x74\x67\x3d\x3d','\x77\x6f\x7a\x43\x6e\x43\x58\x43\x71\x67\x67\x3d','\x65\x4d\x4b\x68\x77\x72\x56\x59\x77\x72\x77\x3d','\x77\x6f\x44\x44\x6c\x51\x54\x43\x72\x4d\x4b\x4d','\x77\x35\x48\x44\x6f\x6e\x72\x43\x69\x68\x77\x3d','\x77\x36\x72\x44\x70\x4d\x4b\x34\x50\x63\x4b\x42','\x44\x63\x4b\x5a\x77\x35\x31\x48\x77\x70\x66\x43\x68\x7a\x5a\x51\x46\x4d\x4f\x75\x77\x72\x66\x44\x67\x73\x4f\x64','\x61\x58\x54\x44\x76\x73\x4f\x6d\x77\x37\x34\x3d','\x77\x72\x76\x44\x6b\x68\x33\x43\x6f\x73\x4b\x68','\x66\x79\x6a\x44\x70\x73\x4f\x4e\x77\x35\x55\x3d','\x77\x71\x50\x44\x75\x43\x48\x43\x6b\x73\x4b\x66','\x51\x73\x4f\x47\x50\x31\x37\x43\x6c\x77\x3d\x3d','\x51\x48\x44\x43\x69\x30\x44\x43\x67\x51\x3d\x3d','\x77\x36\x50\x44\x72\x31\x72\x43\x6d\x4d\x4f\x2b\x53\x79\x54\x43\x67\x7a\x52\x6a\x5a\x51\x3d\x3d','\x46\x63\x4f\x6e\x51\x38\x4b\x70\x4d\x41\x3d\x3d','\x66\x4d\x4f\x43\x77\x36\x44\x43\x6d\x48\x63\x3d','\x49\x38\x4f\x36\x55\x63\x4b\x32\x77\x36\x76\x43\x72\x58\x37\x43\x6b\x38\x4f\x63\x43\x6e\x74\x78\x77\x34\x41\x72\x77\x71\x55\x3d','\x44\x52\x78\x70\x77\x6f\x35\x65\x77\x72\x76\x43\x6a\x73\x4b\x33','\x52\x4d\x4f\x2b\x63\x48\x33\x44\x6b\x77\x3d\x3d','\x5a\x4d\x4f\x77\x56\x38\x4b\x59\x58\x63\x4b\x67\x77\x6f\x4c\x43\x6a\x73\x4b\x4b\x65\x51\x3d\x3d','\x66\x38\x4f\x71\x4c\x31\x37\x43\x70\x4d\x4f\x6f\x77\x6f\x62\x44\x67\x51\x3d\x3d','\x56\x73\x4f\x70\x59\x45\x33\x44\x6c\x63\x4f\x44\x77\x35\x7a\x43\x71\x73\x4b\x37','\x61\x4d\x4f\x33\x48\x33\x59\x34\x51\x69\x67\x77','\x44\x4d\x4f\x2b\x56\x4d\x4f\x69\x57\x51\x3d\x3d','\x77\x34\x58\x43\x6d\x73\x4f\x71\x44\x31\x7a\x43\x71\x77\x3d\x3d','\x61\x63\x4f\x58\x50\x4d\x4b\x2b\x77\x72\x49\x3d','\x77\x72\x68\x44\x77\x72\x58\x44\x6d\x68\x39\x43\x4a\x51\x3d\x3d','\x77\x37\x6e\x43\x72\x4d\x4f\x45\x50\x58\x72\x43\x6e\x58\x56\x34\x77\x72\x6f\x70\x77\x6f\x64\x61\x4c\x55\x41\x3d','\x77\x35\x2f\x44\x6c\x73\x4f\x52\x77\x35\x76\x43\x6e\x6e\x66\x43\x6b\x38\x4f\x6b\x59\x63\x4f\x55\x58\x48\x31\x42\x77\x34\x51\x3d','\x77\x36\x48\x44\x69\x63\x4f\x43\x77\x34\x37\x43\x6d\x51\x3d\x3d','\x5a\x4d\x4f\x46\x62\x44\x2f\x44\x6c\x51\x3d\x3d','\x45\x4d\x4b\x57\x42\x4d\x4b\x7a\x59\x51\x3d\x3d','\x41\x7a\x78\x53\x77\x6f\x5a\x4f','\x77\x34\x33\x43\x73\x73\x4b\x33\x77\x70\x48\x44\x6c\x77\x3d\x3d','\x77\x34\x62\x43\x6d\x47\x45\x52\x77\x6f\x30\x3d','\x77\x72\x4c\x43\x76\x43\x37\x43\x76\x42\x44\x43\x6d\x41\x3d\x3d','\x66\x4d\x4f\x74\x4a\x6c\x59\x65','\x66\x4d\x4f\x51\x49\x38\x4b\x61\x77\x70\x41\x3d','\x54\x42\x72\x43\x6c\x42\x66\x43\x69\x51\x3d\x3d','\x77\x71\x2f\x43\x6d\x67\x48\x43\x68\x69\x34\x3d','\x77\x34\x6e\x43\x6d\x73\x4b\x34\x77\x71\x50\x44\x74\x77\x3d\x3d','\x77\x34\x58\x44\x70\x73\x4f\x36\x4a\x38\x4f\x48','\x77\x71\x50\x43\x74\x43\x50\x43\x75\x77\x67\x3d','\x77\x34\x37\x44\x70\x46\x44\x43\x67\x41\x34\x3d','\x50\x77\x55\x69\x48\x6d\x4d\x3d','\x77\x34\x66\x43\x69\x67\x55\x43\x77\x70\x73\x3d','\x61\x63\x4f\x4a\x51\x30\x4c\x44\x74\x4d\x4b\x52\x77\x6f\x77\x3d','\x5a\x73\x4f\x4b\x48\x33\x49\x69','\x77\x36\x58\x43\x72\x51\x6e\x43\x6e\x69\x41\x3d','\x65\x63\x4b\x75\x4e\x4d\x4f\x51\x77\x70\x76\x44\x67\x4d\x4f\x31','\x4e\x73\x4b\x30\x77\x35\x42\x56\x77\x6f\x73\x3d','\x52\x38\x4f\x6e\x48\x31\x76\x43\x71\x41\x3d\x3d','\x77\x6f\x33\x43\x67\x58\x52\x68\x62\x67\x3d\x3d','\x77\x71\x58\x44\x76\x44\x58\x43\x6a\x73\x4b\x34\x61\x47\x62\x43\x69\x33\x4a\x32\x4f\x48\x41\x3d','\x77\x35\x50\x43\x6a\x73\x4f\x57\x44\x6b\x63\x3d','\x77\x72\x42\x74\x77\x6f\x50\x44\x70\x53\x55\x3d','\x77\x36\x6a\x43\x72\x4d\x4b\x58\x77\x71\x50\x44\x70\x51\x3d\x3d','\x63\x73\x4b\x41\x77\x6f\x31\x73\x77\x6f\x63\x3d','\x77\x6f\x6a\x44\x74\x77\x48\x43\x73\x63\x4b\x74','\x4a\x73\x4b\x7a\x77\x35\x4e\x57\x77\x72\x30\x3d','\x41\x30\x35\x5a\x77\x6f\x4c\x43\x72\x67\x3d\x3d','\x50\x42\x37\x43\x69\x38\x4b\x45\x77\x70\x49\x3d','\x65\x4d\x4f\x62\x63\x73\x4b\x6b\x59\x41\x3d\x3d','\x77\x70\x38\x51\x48\x43\x33\x44\x71\x67\x3d\x3d','\x4f\x73\x4b\x4d\x42\x73\x4b\x2b\x62\x67\x3d\x3d','\x63\x78\x78\x7a\x77\x36\x6b\x52','\x61\x77\x7a\x43\x72\x38\x4b\x41\x50\x41\x3d\x3d','\x77\x35\x6e\x43\x69\x4d\x4f\x73\x41\x30\x73\x3d','\x57\x38\x4f\x51\x64\x4d\x4b\x58\x5a\x63\x4f\x79\x77\x35\x77\x3d','\x49\x67\x51\x4f\x41\x48\x48\x44\x70\x4d\x4f\x72\x59\x67\x3d\x3d','\x64\x4d\x4f\x78\x4f\x6b\x7a\x43\x6f\x4d\x4f\x30','\x77\x34\x54\x44\x68\x38\x4f\x55\x77\x35\x7a\x43\x6e\x51\x50\x44\x75\x41\x3d\x3d','\x77\x36\x44\x43\x6c\x57\x63\x37\x77\x37\x67\x3d','\x46\x73\x4b\x35\x77\x37\x39\x69\x77\x72\x44\x44\x6e\x33\x51\x3d','\x59\x38\x4f\x4b\x77\x34\x66\x43\x68\x54\x4c\x44\x74\x41\x3d\x3d','\x77\x35\x66\x44\x73\x38\x4b\x4f\x4a\x38\x4f\x44\x77\x71\x6b\x3d','\x77\x35\x68\x77\x77\x72\x45\x31\x77\x70\x34\x3d','\x77\x72\x74\x43\x77\x70\x44\x44\x70\x52\x77\x3d','\x59\x38\x4f\x4a\x50\x63\x4b\x64\x77\x72\x4d\x3d','\x77\x37\x58\x43\x6b\x52\x4c\x43\x74\x51\x63\x3d','\x77\x71\x49\x67\x48\x42\x68\x62','\x77\x34\x7a\x43\x73\x33\x63\x71\x77\x71\x38\x3d','\x62\x41\x74\x68\x77\x37\x30\x4e','\x59\x43\x6f\x42\x77\x37\x6c\x63','\x77\x34\x58\x43\x75\x78\x45\x6f\x77\x6f\x6b\x3d','\x62\x73\x4f\x77\x57\x51\x48\x44\x6c\x77\x3d\x3d','\x77\x37\x54\x43\x6d\x67\x49\x4f\x77\x6f\x45\x3d','\x4b\x73\x4b\x57\x77\x35\x4e\x31\x77\x6f\x45\x3d','\x77\x36\x68\x6b\x77\x70\x51\x54\x77\x6f\x41\x3d','\x77\x70\x48\x43\x6a\x69\x50\x43\x67\x54\x59\x3d','\x59\x73\x4f\x75\x4d\x57\x33\x43\x6f\x51\x3d\x3d','\x41\x31\x48\x44\x71\x46\x73\x42','\x47\x51\x44\x43\x76\x38\x4b\x31\x77\x71\x77\x3d','\x5a\x4d\x4b\x4f\x4c\x4d\x4f\x4b\x77\x71\x77\x3d','\x62\x38\x4f\x6b\x55\x57\x4c\x44\x74\x77\x3d\x3d','\x77\x36\x34\x31\x44\x63\x4f\x31\x77\x36\x30\x3d','\x77\x35\x4c\x43\x74\x38\x4f\x74\x44\x6d\x63\x3d','\x77\x71\x7a\x43\x6e\x56\x46\x46\x54\x41\x3d\x3d','\x43\x53\x49\x61\x50\x48\x49\x3d','\x45\x73\x4f\x63\x51\x38\x4b\x32\x46\x67\x3d\x3d','\x77\x36\x6e\x43\x6b\x38\x4b\x6a\x77\x70\x33\x44\x75\x67\x3d\x3d','\x48\x67\x38\x6b\x50\x6e\x49\x3d','\x53\x38\x4f\x4c\x46\x73\x4b\x37\x77\x71\x6f\x3d','\x4e\x73\x4b\x2f\x48\x73\x4b\x4f\x53\x41\x3d\x3d','\x4d\x4d\x4f\x6b\x55\x38\x4b\x39\x44\x41\x3d\x3d','\x45\x48\x58\x44\x6f\x6e\x38\x37','\x61\x6a\x76\x43\x6f\x53\x37\x43\x76\x51\x3d\x3d','\x5a\x77\x33\x43\x6e\x63\x4b\x66\x4f\x41\x3d\x3d','\x59\x7a\x6c\x65\x77\x36\x45\x76','\x77\x35\x48\x44\x69\x38\x4f\x6c\x48\x73\x4f\x6a','\x77\x36\x44\x44\x6d\x4d\x4f\x51\x4c\x73\x4f\x44','\x77\x36\x48\x43\x6f\x30\x6f\x5a\x77\x72\x6f\x3d','\x55\x63\x4f\x57\x77\x72\x78\x62\x77\x72\x6f\x2b','\x55\x44\x30\x4a\x77\x35\x78\x42\x43\x53\x35\x6e\x43\x42\x56\x4b\x62\x38\x4b\x6d\x45\x41\x3d\x3d','\x77\x34\x35\x4c\x77\x37\x76\x44\x74\x55\x30\x3d','\x56\x41\x4c\x43\x70\x6a\x6a\x43\x70\x41\x3d\x3d','\x77\x36\x46\x63\x77\x72\x49\x48\x77\x6f\x73\x3d','\x66\x4d\x4f\x6d\x58\x67\x2f\x44\x73\x41\x3d\x3d','\x77\x35\x51\x41\x45\x73\x4f\x6d\x77\x36\x63\x3d','\x77\x36\x39\x51\x77\x36\x2f\x44\x6d\x31\x45\x3d','\x77\x37\x58\x43\x6d\x69\x77\x42\x77\x6f\x30\x3d','\x51\x6a\x72\x44\x6f\x67\x31\x4b','\x61\x58\x76\x44\x6a\x38\x4f\x49\x77\x37\x41\x3d','\x77\x72\x67\x4a\x42\x78\x6a\x44\x6b\x51\x3d\x3d','\x77\x36\x74\x6f\x77\x35\x4c\x44\x68\x55\x30\x3d','\x77\x35\x62\x44\x75\x63\x4f\x64\x50\x63\x4f\x45','\x64\x67\x39\x62\x77\x34\x31\x51','\x47\x4d\x4b\x4c\x77\x37\x68\x44\x77\x6f\x38\x3d','\x77\x34\x76\x43\x6f\x44\x44\x43\x76\x54\x6f\x3d','\x77\x72\x72\x44\x68\x79\x62\x43\x70\x38\x4b\x7a','\x41\x68\x33\x43\x70\x4d\x4b\x71\x77\x71\x59\x3d','\x77\x36\x33\x44\x70\x4d\x4f\x6b\x47\x73\x4f\x6e','\x63\x4d\x4f\x4a\x77\x72\x42\x64\x77\x71\x6b\x3d','\x77\x70\x74\x57\x77\x72\x41\x61\x53\x77\x3d\x3d','\x56\x63\x4f\x46\x64\x44\x6a\x44\x74\x6a\x6b\x3d','\x77\x71\x6c\x30\x77\x72\x2f\x44\x6e\x68\x77\x3d','\x57\x4d\x4f\x61\x51\x4d\x4b\x43\x58\x67\x3d\x3d','\x77\x34\x64\x76\x77\x70\x38\x7a\x77\x72\x34\x3d','\x4c\x38\x4b\x4a\x43\x38\x4b\x74\x63\x41\x3d\x3d','\x52\x38\x4f\x73\x51\x67\x50\x44\x67\x67\x3d\x3d','\x77\x36\x48\x43\x74\x38\x4f\x31\x4c\x31\x45\x3d','\x77\x35\x6a\x43\x67\x73\x4b\x77\x77\x34\x4c\x44\x75\x67\x3d\x3d','\x4f\x7a\x6b\x76\x42\x48\x67\x3d','\x53\x53\x68\x77\x77\x37\x6c\x47','\x65\x52\x35\x32\x77\x34\x51\x51\x4a\x53\x7a\x44\x73\x63\x4f\x39\x77\x6f\x63\x7a\x77\x72\x39\x30\x77\x34\x30\x3d','\x77\x70\x6b\x77\x47\x78\x44\x44\x73\x67\x3d\x3d','\x47\x44\x34\x35\x49\x31\x58\x44\x69\x4d\x4f\x58\x56\x38\x4f\x33\x51\x58\x5a\x31\x77\x37\x4c\x43\x6a\x67\x3d\x3d','\x54\x44\x68\x64\x77\x37\x34\x4b\x44\x51\x41\x3d','\x77\x34\x6f\x2f\x41\x63\x4f\x58\x77\x34\x50\x43\x76\x31\x51\x3d','\x4e\x42\x37\x43\x76\x4d\x4b\x46\x77\x71\x45\x3d','\x77\x34\x50\x44\x71\x47\x7a\x43\x74\x41\x6b\x3d','\x55\x79\x37\x44\x6d\x52\x4a\x48','\x45\x45\x62\x44\x75\x46\x63\x4a','\x54\x63\x4f\x57\x66\x79\x2f\x44\x6d\x67\x3d\x3d','\x4d\x6a\x78\x4b\x77\x6f\x46\x74\x77\x37\x72\x44\x6d\x51\x3d\x3d','\x5a\x38\x4f\x36\x61\x73\x4b\x74\x51\x38\x4b\x65\x77\x70\x33\x43\x6c\x73\x4b\x58\x63\x7a\x51\x69','\x52\x4d\x4f\x6c\x46\x33\x6f\x75','\x53\x38\x4b\x56\x77\x34\x41\x37\x77\x35\x6f\x3d','\x66\x38\x4f\x76\x43\x58\x38\x5a','\x77\x35\x56\x5a\x54\x4d\x4f\x6e\x4a\x67\x3d\x3d','\x48\x4d\x4f\x64\x52\x63\x4b\x69\x42\x51\x3d\x3d','\x65\x4d\x4f\x68\x77\x70\x68\x6c\x77\x6f\x34\x3d','\x59\x67\x39\x7a\x77\x34\x4d\x41\x56\x45\x45\x3d','\x54\x4d\x4b\x58\x77\x36\x59\x65\x77\x34\x51\x3d','\x77\x34\x58\x43\x67\x43\x34\x48\x77\x71\x67\x3d','\x77\x37\x72\x44\x6f\x63\x4b\x34\x47\x73\x4b\x55','\x53\x4d\x4f\x78\x54\x54\x6a\x44\x74\x77\x3d\x3d','\x52\x4d\x4b\x54\x77\x70\x39\x6e','\x63\x6a\x64\x32\x77\x34\x78\x50\x64\x63\x4b\x62\x77\x6f\x78\x79\x77\x72\x64\x48\x65\x63\x4f\x41\x77\x72\x6f\x3d','\x64\x77\x59\x53\x77\x36\x46\x33','\x46\x54\x74\x70\x77\x70\x39\x56','\x52\x63\x4b\x74\x42\x73\x4f\x79\x77\x71\x38\x3d','\x5a\x4d\x4b\x77\x77\x71\x5a\x49\x77\x72\x63\x3d','\x61\x6a\x33\x44\x6c\x63\x4f\x70\x77\x34\x63\x3d','\x42\x78\x58\x43\x74\x38\x4b\x79\x77\x70\x4d\x3d','\x77\x70\x41\x4f\x45\x42\x78\x77','\x77\x34\x66\x43\x6f\x52\x30\x4c\x77\x72\x34\x3d','\x77\x35\x7a\x43\x72\x41\x55\x75\x77\x71\x49\x3d','\x77\x37\x44\x44\x6f\x63\x4f\x47\x50\x38\x4f\x77','\x77\x35\x74\x57\x77\x34\x48\x44\x73\x56\x38\x3d','\x59\x38\x4f\x4b\x77\x34\x66\x43\x68\x56\x62\x44\x73\x63\x4b\x35','\x77\x34\x72\x44\x6e\x38\x4b\x58\x4f\x38\x4b\x6f','\x57\x63\x4f\x79\x55\x38\x4b\x6f\x55\x67\x3d\x3d','\x41\x47\x4c\x44\x6e\x6b\x49\x2f','\x46\x56\x70\x4e\x77\x71\x37\x43\x6a\x77\x3d\x3d','\x41\x54\x44\x43\x69\x38\x4b\x31\x77\x6f\x4c\x43\x76\x6b\x6e\x44\x6d\x32\x52\x69\x66\x63\x4f\x69\x77\x72\x6f\x2f','\x65\x4d\x4f\x52\x77\x72\x5a\x68\x77\x70\x30\x3d','\x77\x37\x4c\x43\x6f\x4d\x4b\x46\x77\x34\x7a\x44\x75\x77\x3d\x3d','\x53\x79\x77\x4d\x77\x35\x74\x52\x65\x45\x4d\x3d','\x54\x33\x58\x44\x70\x63\x4f\x49\x77\x34\x30\x3d','\x77\x36\x37\x43\x72\x4d\x4b\x31\x77\x70\x2f\x44\x76\x77\x3d\x3d','\x54\x73\x4f\x55\x63\x54\x2f\x44\x70\x6b\x50\x44\x67\x6d\x45\x7a\x42\x4d\x4b\x32\x4e\x54\x58\x44\x76\x67\x3d\x3d','\x77\x70\x48\x43\x70\x45\x42\x71\x54\x73\x4f\x66\x77\x34\x72\x44\x67\x4d\x4f\x41\x49\x53\x6f\x56','\x77\x71\x55\x61\x42\x53\x72\x44\x6c\x4d\x4b\x75\x77\x71\x41\x3d','\x77\x37\x4a\x55\x77\x34\x72\x44\x76\x46\x55\x3d','\x77\x70\x48\x43\x68\x47\x56\x72\x54\x41\x3d\x3d','\x77\x34\x5a\x46\x58\x4d\x4f\x6e\x4f\x41\x3d\x3d','\x65\x63\x4f\x47\x50\x6d\x54\x43\x71\x41\x3d\x3d','\x51\x73\x4f\x53\x49\x63\x4b\x64\x77\x70\x33\x43\x6b\x78\x48\x43\x76\x38\x4b\x34\x50\x78\x78\x4d\x77\x71\x45\x53','\x54\x78\x50\x44\x6a\x41\x31\x30','\x77\x6f\x73\x6a\x4c\x54\x68\x75','\x4b\x38\x4b\x66\x42\x73\x4b\x55\x66\x32\x37\x43\x6d\x41\x3d\x3d','\x52\x73\x4b\x6b\x46\x38\x4f\x72\x77\x72\x6f\x3d','\x51\x41\x42\x6d\x77\x35\x63\x38','\x59\x63\x4f\x6f\x77\x36\x44\x43\x75\x6d\x45\x3d','\x65\x4d\x4f\x77\x77\x6f\x78\x2b\x77\x6f\x5a\x30\x62\x42\x56\x41\x77\x34\x5a\x49\x77\x6f\x51\x38\x77\x72\x52\x35\x57\x32\x48\x43\x70\x55\x62\x43\x6d\x41\x3d\x3d','\x77\x34\x6f\x2f\x41\x63\x4f\x58\x77\x72\x62\x43\x75\x77\x3d\x3d','\x55\x63\x4f\x65\x42\x46\x7a\x43\x68\x41\x3d\x3d','\x52\x57\x62\x43\x70\x32\x50\x43\x6c\x51\x3d\x3d','\x77\x70\x6e\x44\x6b\x69\x66\x43\x71\x38\x4b\x43','\x65\x54\x77\x4c\x77\x34\x52\x7a','\x57\x73\x4f\x42\x77\x37\x7a\x43\x6f\x57\x38\x3d','\x56\x63\x4f\x69\x65\x33\x54\x44\x69\x77\x3d\x3d','\x53\x4d\x4f\x45\x51\x45\x72\x44\x73\x41\x3d\x3d','\x57\x73\x4f\x45\x49\x6b\x45\x39','\x77\x36\x58\x43\x67\x68\x34\x4b\x77\x70\x63\x3d','\x52\x63\x4f\x47\x54\x4d\x4b\x44\x56\x77\x3d\x3d','\x66\x48\x48\x43\x72\x57\x58\x43\x67\x77\x3d\x3d','\x51\x38\x4f\x70\x62\x48\x48\x44\x69\x63\x4f\x50\x77\x35\x2f\x43\x74\x4d\x4b\x31','\x77\x34\x48\x44\x73\x32\x76\x43\x73\x67\x3d\x3d','\x51\x51\x33\x43\x70\x38\x4b\x6e\x50\x31\x42\x64\x77\x6f\x66\x43\x69\x4d\x4f\x59','\x4e\x78\x44\x43\x76\x41\x3d\x3d','\x49\x58\x48\x44\x6a\x31\x51\x3d','\x77\x35\x76\x43\x74\x56\x63\x3d','\x5a\x63\x4f\x68\x50\x31\x6a\x43\x6f\x4d\x4f\x79\x77\x72\x72\x44\x6c\x73\x4b\x4f\x77\x37\x76\x44\x6d\x41\x3d\x3d','\x77\x36\x6e\x43\x68\x68\x62\x43\x6e\x67\x3d\x3d','\x53\x44\x6e\x44\x6c\x52\x52\x67\x77\x72\x49\x32\x61\x47\x6a\x44\x6f\x63\x4f\x56','\x52\x63\x4b\x43\x47\x4d\x4f\x6c','\x53\x7a\x44\x43\x6f\x53\x37\x43\x70\x4d\x4b\x37\x77\x70\x41\x37\x77\x6f\x49\x4d\x56\x79\x34\x4c\x77\x37\x66\x44\x72\x68\x46\x50\x43\x41\x3d\x3d','\x52\x32\x66\x43\x74\x6e\x72\x43\x73\x51\x3d\x3d','\x77\x34\x66\x44\x6e\x63\x4b\x70\x47\x73\x4b\x6d','\x46\x73\x4b\x34\x77\x37\x56\x64\x77\x72\x38\x3d','\x63\x79\x42\x42\x77\x34\x73\x39','\x45\x4d\x4b\x7a\x77\x35\x39\x36\x77\x71\x77\x3d','\x77\x34\x31\x4e\x77\x34\x4c\x44\x75\x31\x4d\x3d','\x77\x36\x5a\x67\x77\x6f\x59\x74\x77\x6f\x33\x44\x70\x67\x3d\x3d','\x77\x35\x2f\x43\x73\x79\x58\x43\x6b\x53\x6f\x3d','\x5a\x54\x76\x43\x68\x63\x4b\x42\x50\x77\x3d\x3d','\x61\x78\x44\x43\x67\x51\x7a\x43\x6c\x73\x4f\x76\x77\x34\x45\x3d','\x77\x34\x44\x43\x6d\x4d\x4b\x50\x77\x37\x50\x44\x6f\x51\x3d\x3d','\x77\x35\x66\x43\x6f\x63\x4b\x69\x77\x35\x44\x44\x6d\x51\x3d\x3d','\x61\x41\x6a\x44\x73\x6a\x46\x41\x77\x6f\x51\x32\x53\x6b\x2f\x44\x68\x4d\x4f\x6d\x77\x70\x56\x71\x47\x41\x3d\x3d','\x52\x43\x56\x64\x77\x36\x4d\x3d','\x58\x41\x64\x46\x77\x35\x38\x53','\x51\x38\x4f\x33\x77\x6f\x78\x46\x77\x71\x6f\x3d','\x77\x6f\x64\x66\x77\x72\x54\x44\x75\x79\x67\x3d','\x52\x38\x4f\x33\x4c\x73\x4b\x2f\x77\x6f\x34\x3d','\x77\x36\x58\x43\x6e\x79\x77\x56\x77\x70\x6b\x3d','\x59\x73\x4b\x6f\x77\x35\x63\x70\x77\x34\x55\x3d','\x51\x41\x39\x65\x77\x37\x52\x70','\x43\x73\x4f\x76\x51\x4d\x4b\x6d\x41\x44\x49\x30\x43\x63\x4b\x63\x4b\x6c\x74\x5a\x46\x46\x4a\x69','\x58\x46\x58\x43\x68\x56\x76\x43\x73\x69\x39\x52\x51\x57\x67\x64\x77\x71\x37\x43\x73\x4d\x4f\x4a\x77\x72\x34\x3d','\x77\x35\x4c\x43\x68\x4d\x4b\x74\x77\x37\x4c\x44\x69\x6a\x48\x43\x71\x55\x5a\x4a\x4b\x63\x4f\x2f\x65\x57\x68\x56','\x46\x38\x4b\x33\x4e\x77\x3d\x3d','\x5a\x38\x4b\x61\x50\x73\x4f\x31\x77\x70\x67\x3d','\x77\x37\x76\x44\x68\x4d\x4b\x67\x42\x77\x3d\x3d','\x77\x70\x50\x43\x68\x6d\x68\x4d\x65\x67\x3d\x3d','\x77\x37\x33\x44\x67\x38\x4f\x5a\x77\x36\x62\x43\x6a\x67\x3d\x3d','\x4d\x48\x37\x44\x76\x6c\x41\x76','\x77\x6f\x41\x50\x48\x42\x31\x50','\x77\x35\x7a\x43\x67\x77\x6b\x47\x77\x70\x59\x3d','\x77\x6f\x4c\x44\x68\x79\x37\x43\x73\x38\x4b\x4f\x64\x55\x72\x43\x72\x31\x4a\x57\x41\x46\x62\x44\x76\x4d\x4b\x59','\x77\x36\x6e\x43\x6e\x67\x7a\x43\x6e\x42\x4a\x52\x55\x77\x3d\x3d','\x51\x7a\x74\x78\x77\x35\x77\x54','\x50\x44\x39\x46\x77\x71\x52\x61','\x4f\x42\x6f\x52\x48\x57\x51\x3d','\x64\x77\x63\x30\x77\x36\x31\x75','\x57\x63\x4f\x44\x4a\x4d\x4b\x61\x77\x6f\x33\x44\x71\x51\x3d\x3d','\x77\x34\x44\x43\x6d\x77\x55\x42\x77\x72\x31\x30\x77\x70\x72\x44\x76\x51\x3d\x3d','\x4d\x6a\x78\x4b\x77\x6f\x45\x41','\x62\x51\x66\x44\x6a\x63\x4f\x6a\x77\x34\x52\x72\x77\x36\x46\x50','\x77\x71\x55\x61\x42\x53\x72\x44\x6c\x4d\x4b\x73\x77\x71\x51\x3d','\x77\x35\x31\x51\x77\x71\x55\x63\x77\x71\x72\x43\x72\x4d\x4b\x49\x77\x35\x38\x3d','\x77\x35\x62\x44\x70\x33\x33\x43\x73\x68\x33\x43\x69\x6b\x33\x44\x6e\x41\x3d\x3d','\x63\x78\x6e\x44\x74\x7a\x5a\x51\x77\x37\x56\x62','\x61\x63\x4f\x4a\x51\x30\x4c\x43\x6b\x73\x4b\x51','\x77\x37\x4c\x43\x70\x63\x4b\x4c\x77\x34\x54\x44\x76\x51\x48\x43\x6c\x32\x38\x3d','\x77\x70\x56\x2b\x77\x6f\x54\x44\x70\x53\x73\x46\x5a\x41\x3d\x3d','\x77\x71\x56\x59\x77\x70\x6f\x42\x5a\x6e\x4e\x36','\x4d\x63\x4f\x50\x63\x38\x4b\x66\x4e\x47\x31\x76','\x65\x48\x4c\x44\x68\x63\x4f\x42\x77\x36\x51\x3d','\x55\x69\x33\x44\x74\x53\x6c\x44','\x77\x37\x4e\x66\x51\x4d\x4f\x4a\x44\x41\x3d\x3d','\x4d\x4d\x4b\x57\x77\x36\x35\x2b\x77\x72\x41\x3d','\x77\x35\x78\x67\x64\x73\x4f\x41\x48\x41\x3d\x3d','\x77\x72\x63\x31\x43\x79\x46\x47\x77\x6f\x67\x5a\x77\x36\x33\x43\x69\x79\x56\x75\x56\x44\x4c\x43\x71\x51\x3d\x3d','\x77\x36\x72\x43\x67\x68\x62\x43\x6f\x41\x46\x63\x53\x4d\x4f\x51\x62\x58\x44\x43\x69\x63\x4b\x50\x77\x70\x51\x3d','\x77\x35\x48\x44\x76\x55\x44\x43\x75\x52\x77\x3d','\x77\x35\x45\x75\x42\x4d\x4f\x51\x77\x34\x44\x44\x69\x7a\x2f\x43\x68\x54\x41\x6b\x77\x35\x7a\x43\x6b\x73\x4f\x39\x77\x71\x77\x3d','\x77\x35\x52\x34\x53\x63\x4f\x68\x46\x68\x62\x43\x69\x67\x3d\x3d','\x77\x35\x70\x34\x51\x38\x4f\x71','\x63\x73\x4f\x59\x52\x6b\x58\x44\x70\x4d\x4f\x67\x77\x36\x48\x43\x6c\x73\x4b\x4d\x57\x63\x4b\x6d\x77\x72\x66\x44\x75\x4d\x4b\x2b','\x77\x36\x72\x44\x73\x4d\x4f\x36\x77\x36\x48\x43\x68\x46\x2f\x43\x76\x77\x3d\x3d','\x77\x71\x4c\x44\x74\x68\x6a\x43\x6a\x63\x4b\x71\x57\x33\x7a\x43\x68\x57\x56\x41\x4f\x58\x58\x44\x67\x73\x4b\x34\x77\x35\x73\x75','\x62\x78\x33\x44\x6d\x43\x31\x4d','\x77\x36\x7a\x44\x68\x73\x4b\x6a\x48\x73\x4b\x45','\x46\x52\x37\x43\x69\x38\x4b\x59\x77\x71\x30\x3d','\x77\x72\x73\x62\x46\x77\x44\x44\x6a\x67\x3d\x3d','\x77\x70\x6e\x44\x6c\x69\x76\x43\x74\x4d\x4b\x65\x42\x43\x63\x3d','\x57\x73\x4f\x36\x63\x52\x4c\x44\x69\x51\x3d\x3d','\x57\x4d\x4f\x4b\x77\x36\x54\x43\x6d\x58\x59\x3d','\x77\x34\x76\x43\x6c\x4d\x4f\x73\x42\x56\x77\x3d','\x77\x34\x66\x43\x67\x54\x67\x56\x77\x72\x74\x67\x77\x34\x4d\x3d','\x66\x63\x4f\x79\x48\x58\x77\x34','\x77\x6f\x54\x43\x70\x33\x4e\x76\x58\x67\x3d\x3d','\x77\x34\x39\x4a\x77\x71\x73\x53\x77\x72\x73\x3d','\x77\x35\x66\x44\x73\x38\x4b\x4f\x4a\x38\x4b\x6c\x77\x71\x4d\x3d','\x77\x36\x33\x43\x67\x73\x4f\x45\x45\x46\x55\x3d','\x52\x73\x4f\x48\x4d\x45\x55\x5a\x47\x48\x55\x3d','\x77\x37\x31\x65\x77\x36\x44\x44\x70\x56\x51\x3d','\x56\x38\x4f\x63\x48\x55\x33\x43\x69\x67\x3d\x3d','\x77\x35\x6a\x44\x6a\x4d\x4b\x4c\x44\x63\x4b\x61','\x77\x34\x7a\x43\x68\x47\x38\x37\x77\x70\x67\x3d','\x77\x6f\x73\x57\x77\x37\x31\x52\x77\x71\x31\x35\x77\x36\x63\x4e\x77\x70\x5a\x6f\x77\x36\x4a\x65\x77\x71\x73\x5a','\x4e\x58\x35\x6c\x77\x70\x44\x43\x76\x6a\x4e\x78\x77\x70\x33\x43\x71\x31\x4c\x43\x69\x44\x4d\x47\x57\x51\x3d\x3d','\x48\x41\x74\x6b\x77\x72\x78\x6e\x77\x71\x50\x43\x6d\x41\x3d\x3d','\x77\x34\x48\x44\x71\x4d\x4f\x39\x77\x36\x4c\x43\x71\x67\x3d\x3d','\x55\x38\x4b\x4b\x77\x70\x5a\x42\x77\x71\x49\x3d','\x77\x36\x7a\x43\x74\x38\x4b\x64\x77\x36\x6a\x44\x75\x41\x3d\x3d','\x62\x78\x66\x44\x76\x7a\x5a\x50','\x77\x70\x30\x74\x4b\x78\x6e\x44\x70\x4d\x4f\x75\x77\x36\x45\x3d','\x35\x62\x36\x32\x35\x70\x53\x75\x35\x62\x43\x51\x35\x62\x2b\x44\x35\x62\x2b\x2b\x35\x70\x61\x32\x36\x5a\x6d\x2f\x35\x61\x79\x34\x35\x71\x32\x6e','\x43\x63\x4f\x34\x58\x63\x4b\x73\x42\x43\x30\x75','\x56\x79\x7a\x43\x67\x78\x50\x43\x6e\x51\x3d\x3d','\x77\x37\x55\x33\x4e\x4d\x4f\x45\x77\x36\x34\x3d','\x4e\x6d\x44\x44\x6c\x31\x77\x74','\x77\x34\x54\x44\x68\x38\x4f\x55\x77\x35\x7a\x43\x6a\x67\x62\x44\x76\x67\x3d\x3d','\x44\x42\x41\x35\x44\x6e\x6f\x3d','\x57\x38\x4f\x51\x64\x4d\x4b\x58\x5a\x63\x4f\x35','\x57\x4d\x4b\x6f\x49\x38\x4f\x30\x77\x72\x38\x3d','\x77\x70\x4c\x43\x6d\x78\x6a\x43\x71\x77\x6b\x3d','\x44\x56\x58\x44\x75\x6d\x55\x4d\x43\x4d\x4f\x4f','\x62\x52\x62\x44\x73\x67\x68\x57','\x58\x63\x4b\x6c\x77\x72\x70\x37\x77\x72\x38\x3d','\x77\x37\x76\x43\x6a\x38\x4b\x6a\x77\x70\x76\x44\x72\x51\x3d\x3d','\x51\x69\x68\x46\x77\x35\x51\x5a','\x50\x51\x48\x43\x69\x4d\x4b\x46\x77\x6f\x34\x3d','\x77\x36\x2f\x43\x67\x38\x4b\x48\x77\x36\x6e\x44\x76\x51\x3d\x3d','\x77\x37\x45\x51\x4d\x63\x4f\x66\x77\x36\x30\x3d','\x77\x72\x33\x44\x68\x52\x44\x43\x74\x4d\x4b\x34','\x4b\x55\x62\x44\x67\x57\x55\x71','\x77\x36\x66\x43\x69\x78\x38\x55\x77\x6f\x70\x6f\x77\x70\x6a\x44\x71\x38\x4f\x39\x61\x63\x4b\x6b','\x77\x34\x76\x44\x67\x58\x48\x43\x6e\x78\x30\x3d','\x6a\x73\x66\x45\x51\x6a\x69\x61\x50\x65\x6d\x69\x70\x2e\x4c\x68\x77\x46\x63\x6f\x49\x4d\x64\x46\x6d\x2e\x54\x76\x36\x3d\x3d'];(function(_0x1c9a48,_0x565122,_0x1fe305){var _0x2aadf6=function(_0x23be68,_0x2c4074,_0xe843be,_0x1c14b2,_0x59105a){_0x2c4074=_0x2c4074>>0x8,_0x59105a='po';var _0x43205b='shift',_0x3e4374='push';if(_0x2c4074<_0x23be68){while(--_0x23be68){_0x1c14b2=_0x1c9a48[_0x43205b]();if(_0x2c4074===_0x23be68){_0x2c4074=_0x1c14b2;_0xe843be=_0x1c9a48[_0x59105a+'p']();}else if(_0x2c4074&&_0xe843be['replace'](/[fEQPepLhwFIMdFT=]/g,'')===_0x2c4074){_0x1c9a48[_0x3e4374](_0x1c14b2);}}_0x1c9a48[_0x3e4374](_0x1c9a48[_0x43205b]());}return 0x43c6e;};var _0x2614ea=function(){var _0x220406={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x3403f0,_0x2fcadd,_0x20c021,_0x2e98e7){_0x2e98e7=_0x2e98e7||{};var _0x1d4ae2=_0x2fcadd+'='+_0x20c021;var _0x303d1c=0x0;for(var _0x303d1c=0x0,_0x2d8610=_0x3403f0['length'];_0x303d1c<_0x2d8610;_0x303d1c++){var _0x377f44=_0x3403f0[_0x303d1c];_0x1d4ae2+=';\x20'+_0x377f44;var _0x1e0803=_0x3403f0[_0x377f44];_0x3403f0['push'](_0x1e0803);_0x2d8610=_0x3403f0['length'];if(_0x1e0803!==!![]){_0x1d4ae2+='='+_0x1e0803;}}_0x2e98e7['cookie']=_0x1d4ae2;},'removeCookie':function(){return'dev';},'getCookie':function(_0xdeade0,_0x34e2a3){_0xdeade0=_0xdeade0||function(_0x1da141){return _0x1da141;};var _0x453963=_0xdeade0(new RegExp('(?:^|;\x20)'+_0x34e2a3['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x142caa=typeof _0xod0=='undefined'?'undefined':_0xod0,_0x9e19d9=_0x142caa['split'](''),_0x1410cc=_0x9e19d9['length'],_0x41798d=_0x1410cc-0xe,_0x7b4174;while(_0x7b4174=_0x9e19d9['pop']()){_0x1410cc&&(_0x41798d+=_0x7b4174['charCodeAt']());}var _0x56d839=function(_0x49d379,_0x3001c0,_0xc95ed4){_0x49d379(++_0x3001c0,_0xc95ed4);};_0x41798d^-_0x1410cc===-0x524&&(_0x7b4174=_0x41798d)&&_0x56d839(_0x2aadf6,_0x565122,_0x1fe305);return _0x7b4174>>0x2===0x14b&&_0x453963?decodeURIComponent(_0x453963[0x1]):undefined;}};var _0x5ab870=function(){var _0x2b1d1f=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x2b1d1f['test'](_0x220406['removeCookie']['toString']());};_0x220406['updateCookie']=_0x5ab870;var _0x4e7647='';var _0x439f7d=_0x220406['updateCookie']();if(!_0x439f7d){_0x220406['setCookie'](['*'],'counter',0x1);}else if(_0x439f7d){_0x4e7647=_0x220406['getCookie'](null,'counter');}else{_0x220406['removeCookie']();}};_0x2614ea();}(_0x3bb0,0x18d,0x18d00));var _0x46e4=function(_0x3280bb,_0x499775){_0x3280bb=~~'0x'['concat'](_0x3280bb);var _0x51e437=_0x3bb0[_0x3280bb];if(_0x46e4['zkRUqQ']===undefined){(function(){var _0x12bca7=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x343fbd='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x12bca7['atob']||(_0x12bca7['atob']=function(_0x45e163){var _0x31d446=String(_0x45e163)['replace'](/=+$/,'');for(var _0x17f8a9=0x0,_0x17f83e,_0x35b6d5,_0x2e1695=0x0,_0x54fda1='';_0x35b6d5=_0x31d446['charAt'](_0x2e1695++);~_0x35b6d5&&(_0x17f83e=_0x17f8a9%0x4?_0x17f83e*0x40+_0x35b6d5:_0x35b6d5,_0x17f8a9++%0x4)?_0x54fda1+=String['fromCharCode'](0xff&_0x17f83e>>(-0x2*_0x17f8a9&0x6)):0x0){_0x35b6d5=_0x343fbd['indexOf'](_0x35b6d5);}return _0x54fda1;});}());var _0x29be0d=function(_0xadde9f,_0x499775){var _0x31e8f6=[],_0x8dab71=0x0,_0x386c47,_0x2a1f2e='',_0x15355b='';_0xadde9f=atob(_0xadde9f);for(var _0x274e93=0x0,_0x41d09f=_0xadde9f['length'];_0x274e93<_0x41d09f;_0x274e93++){_0x15355b+='%'+('00'+_0xadde9f['charCodeAt'](_0x274e93)['toString'](0x10))['slice'](-0x2);}_0xadde9f=decodeURIComponent(_0x15355b);for(var _0x4d0d1b=0x0;_0x4d0d1b<0x100;_0x4d0d1b++){_0x31e8f6[_0x4d0d1b]=_0x4d0d1b;}for(_0x4d0d1b=0x0;_0x4d0d1b<0x100;_0x4d0d1b++){_0x8dab71=(_0x8dab71+_0x31e8f6[_0x4d0d1b]+_0x499775['charCodeAt'](_0x4d0d1b%_0x499775['length']))%0x100;_0x386c47=_0x31e8f6[_0x4d0d1b];_0x31e8f6[_0x4d0d1b]=_0x31e8f6[_0x8dab71];_0x31e8f6[_0x8dab71]=_0x386c47;}_0x4d0d1b=0x0;_0x8dab71=0x0;for(var _0x647eea=0x0;_0x647eea<_0xadde9f['length'];_0x647eea++){_0x4d0d1b=(_0x4d0d1b+0x1)%0x100;_0x8dab71=(_0x8dab71+_0x31e8f6[_0x4d0d1b])%0x100;_0x386c47=_0x31e8f6[_0x4d0d1b];_0x31e8f6[_0x4d0d1b]=_0x31e8f6[_0x8dab71];_0x31e8f6[_0x8dab71]=_0x386c47;_0x2a1f2e+=String['fromCharCode'](_0xadde9f['charCodeAt'](_0x647eea)^_0x31e8f6[(_0x31e8f6[_0x4d0d1b]+_0x31e8f6[_0x8dab71])%0x100]);}return _0x2a1f2e;};_0x46e4['YeAPqg']=_0x29be0d;_0x46e4['Ylohxq']={};_0x46e4['zkRUqQ']=!![];}var _0x1eed29=_0x46e4['Ylohxq'][_0x3280bb];if(_0x1eed29===undefined){if(_0x46e4['XBFDYF']===undefined){var _0x13d41a=function(_0x517d9c){this['uEJTEF']=_0x517d9c;this['WRhFBn']=[0x1,0x0,0x0];this['LoQHeg']=function(){return'newState';};this['PzkVms']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['sBUEwe']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x13d41a['prototype']['aAGClP']=function(){var _0x91d4d9=new RegExp(this['PzkVms']+this['sBUEwe']);var _0x24805d=_0x91d4d9['test'](this['LoQHeg']['toString']())?--this['WRhFBn'][0x1]:--this['WRhFBn'][0x0];return this['GkemGZ'](_0x24805d);};_0x13d41a['prototype']['GkemGZ']=function(_0x20ac72){if(!Boolean(~_0x20ac72)){return _0x20ac72;}return this['GDDwrG'](this['uEJTEF']);};_0x13d41a['prototype']['GDDwrG']=function(_0x3b0f2d){for(var _0x2af078=0x0,_0xf72053=this['WRhFBn']['length'];_0x2af078<_0xf72053;_0x2af078++){this['WRhFBn']['push'](Math['round'](Math['random']()));_0xf72053=this['WRhFBn']['length'];}return _0x3b0f2d(this['WRhFBn'][0x0]);};new _0x13d41a(_0x46e4)['aAGClP']();_0x46e4['XBFDYF']=!![];}_0x51e437=_0x46e4['YeAPqg'](_0x51e437,_0x499775);_0x46e4['Ylohxq'][_0x3280bb]=_0x51e437;}else{_0x51e437=_0x1eed29;}return _0x51e437;};var _0x37e568=function(){var _0x409ec1=!![];return function(_0x3dee3f,_0x50e382){var _0x491b8e=_0x409ec1?function(){if(_0x50e382){var _0x4bb6f7=_0x50e382['apply'](_0x3dee3f,arguments);_0x50e382=null;return _0x4bb6f7;}}:function(){};_0x409ec1=![];return _0x491b8e;};}();var _0x34575a=_0x37e568(this,function(){var _0x414d6d=function(){return'\x64\x65\x76';},_0x2ed2e9=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x4813b0=function(){var _0x1b92aa=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x1b92aa['\x74\x65\x73\x74'](_0x414d6d['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x131a96=function(){var _0x37a435=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x37a435['\x74\x65\x73\x74'](_0x2ed2e9['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x1c4f43=function(_0x3626b6){var _0x30e454=~-0x1>>0x1+0xff%0x0;if(_0x3626b6['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x30e454)){_0x468de4(_0x3626b6);}};var _0x468de4=function(_0x4fccf5){var _0x57ef30=~-0x4>>0x1+0xff%0x0;if(_0x4fccf5['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x57ef30){_0x1c4f43(_0x4fccf5);}};if(!_0x4813b0()){if(!_0x131a96()){_0x1c4f43('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x1c4f43('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x1c4f43('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x34575a();const UUID=()=>_0x46e4('0','\x53\x75\x72\x49')[_0x46e4('1','\x24\x29\x6c\x43')](/[xy]/g,function(_0x1c8b8b){var _0x4eaec8={'\x6d\x7a\x47\x73\x58':function(_0x16a43b,_0x2757a2){return _0x16a43b|_0x2757a2;},'\x6f\x46\x58\x4f\x63':function(_0x2709e8,_0x218d94){return _0x2709e8*_0x218d94;},'\x6d\x51\x6e\x64\x7a':function(_0x6535ab,_0x140a01){return _0x6535ab===_0x140a01;},'\x50\x49\x4f\x6f\x4d':function(_0x408412,_0x58a52c){return _0x408412&_0x58a52c;}};var _0xf89bdf=_0x4eaec8[_0x46e4('2','\x70\x6d\x21\x25')](_0x4eaec8[_0x46e4('3','\x25\x5b\x4b\x46')](0x10,Math[_0x46e4('4','\x37\x49\x6b\x64')]()),0x0);return(_0x4eaec8[_0x46e4('5','\x33\x57\x6a\x6e')]('\x78',_0x1c8b8b)?_0xf89bdf:_0x4eaec8[_0x46e4('6','\x69\x70\x48\x5b')](_0x4eaec8[_0x46e4('7','\x33\x57\x6a\x6e')](0x3,_0xf89bdf),0x8))[_0x46e4('8','\x76\x4c\x4a\x65')](0x10);});class HeartGiftRoom{constructor(_0x31aab2,_0x2d2201){var _0x58a18a={'\x67\x62\x74\x52\x53':_0x46e4('9','\x41\x39\x75\x5d'),'\x42\x57\x65\x49\x46':function(_0x161145,_0x85500f){return _0x161145(_0x85500f);},'\x50\x57\x53\x49\x49':_0x46e4('a','\x25\x5b\x4b\x46'),'\x66\x48\x6f\x73\x45':function(_0x38481d){return _0x38481d();}};var _0x100eae=_0x58a18a['\x67\x62\x74\x52\x53']['\x73\x70\x6c\x69\x74']('\x7c'),_0x980016=0x0;while(!![]){switch(_0x100eae[_0x980016++]){case'\x30':this[_0x46e4('b','\x61\x77\x34\x4d')]=_0x58a18a[_0x46e4('c','\x58\x75\x24\x6b')](getCookie,_0x58a18a[_0x46e4('d','\x33\x57\x6a\x6e')]);continue;case'\x31':this['\x75\x61']=window&&window[_0x46e4('e','\x68\x6a\x6e\x48')]?window[_0x46e4('f','\x5b\x5a\x5d\x62')][_0x46e4('10','\x25\x5b\x4b\x46')]:'';continue;case'\x32':this[_0x46e4('11','\x61\x4a\x54\x6a')]=_0x31aab2;continue;case'\x33':this[_0x46e4('12','\x53\x37\x4f\x54')]=_0x31aab2[_0x46e4('13','\x4c\x58\x44\x78')];continue;case'\x34':this[_0x46e4('14','\x53\x75\x72\x49')]=_0x31aab2[_0x46e4('15','\x51\x4a\x38\x73')];continue;case'\x35':;continue;case'\x36':this['\x75\x75\x69\x64']=_0x58a18a[_0x46e4('16','\x41\x39\x75\x5d')](UUID);continue;case'\x37':this['\x73\x65\x71']=0x0;continue;case'\x38':this[_0x46e4('17','\x44\x34\x74\x5a')]();continue;case'\x39':this[_0x46e4('18','\x6f\x64\x4f\x4b')]=_0x2d2201;continue;case'\x31\x30':this[_0x46e4('19','\x69\x70\x48\x5b')]=0x0;continue;case'\x31\x31':this[_0x46e4('1a','\x44\x34\x74\x5a')]=new Date();continue;case'\x31\x32':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=_0x31aab2[_0x46e4('1b','\x69\x70\x48\x5b')];continue;}break;}}async[_0x46e4('1c','\x33\x68\x52\x2a')](){var _0x487a4b={'\x55\x55\x54\x51\x79':function(_0x1eac97,_0x38bace){return _0x1eac97>_0x38bace;},'\x78\x49\x43\x4c\x56':function(_0x2e9e60,_0x488628){return _0x2e9e60==_0x488628;},'\x62\x4a\x70\x67\x79':_0x46e4('1d','\x40\x71\x69\x37'),'\x44\x68\x77\x44\x64':function(_0x5d881d,_0x19c0f1,_0x98fd81){return _0x5d881d(_0x19c0f1,_0x98fd81);},'\x6f\x49\x6d\x64\x66':function(_0xf3b2cd,_0x238ba4){return _0xf3b2cd*_0x238ba4;}};try{if(!HeartGift[_0x46e4('1e','\x66\x30\x6e\x36')]||_0x487a4b['\x55\x55\x54\x51\x79'](this[_0x46e4('1f','\x70\x6d\x21\x25')],0x3))return;let _0x9fe73={'\x69\x64':[this[_0x46e4('20','\x31\x53\x30\x76')],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x46e4('21','\x40\x64\x70\x29')],this[_0x46e4('22','\x4d\x4d\x4e\x2a')]],'\x64\x65\x76\x69\x63\x65':[this['\x62\x75\x76\x69\x64'],this[_0x46e4('23','\x68\x6a\x6e\x48')]],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x46e4('24','\x38\x72\x36\x78')](_0x9fe73);let _0x2ab107=await BiliPushUtils[_0x46e4('25','\x70\x6d\x21\x25')][_0x46e4('26','\x73\x29\x55\x76')][_0x46e4('27','\x31\x53\x30\x76')](_0x9fe73);if(_0x487a4b[_0x46e4('28','\x40\x64\x70\x29')](_0x2ab107[_0x46e4('29','\x72\x78\x79\x38')],0x0)){var _0x47b99c=_0x487a4b[_0x46e4('2a','\x29\x62\x4f\x46')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x294bf7=0x0;while(!![]){switch(_0x47b99c[_0x294bf7++]){case'\x30':++this[_0x46e4('2b','\x41\x39\x75\x5d')];continue;case'\x31':this[_0x46e4('2c','\x58\x75\x24\x6b')]=_0x2ab107[_0x46e4('2d','\x51\x4a\x38\x73')][_0x46e4('2e','\x38\x72\x36\x78')];continue;case'\x32':this[_0x46e4('2f','\x41\x39\x75\x5d')]=_0x2ab107[_0x46e4('30','\x70\x6d\x21\x25')][_0x46e4('31','\x79\x40\x49\x5e')];continue;case'\x33':this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b']=_0x2ab107['\x64\x61\x74\x61'][_0x46e4('32','\x33\x57\x6a\x6e')];continue;case'\x34':this[_0x46e4('33','\x72\x4c\x50\x55')]=_0x2ab107['\x64\x61\x74\x61'][_0x46e4('34','\x6f\x64\x4f\x4b')];continue;}break;}}await _0x487a4b[_0x46e4('35','\x63\x33\x5a\x28')](delayCall,()=>this[_0x46e4('36','\x53\x75\x72\x49')](),_0x487a4b[_0x46e4('37','\x28\x40\x4b\x38')](this['\x74\x69\x6d\x65'],0x3e8));}catch(_0x44310e){this[_0x46e4('38','\x26\x2a\x42\x28')]++;console['\x65\x72\x72\x6f\x72'](_0x44310e);await _0x487a4b['\x44\x68\x77\x44\x64'](delayCall,()=>this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72'](),0x3e8);}}async[_0x46e4('39','\x25\x5b\x4b\x46')](){var _0x1fe907={'\x57\x6f\x72\x57\x41':function(_0x3ebff7,_0x425567){return _0x3ebff7+_0x425567;},'\x43\x6b\x77\x54\x73':function(_0x3f47ef,_0x2e3e77){return _0x3f47ef/_0x2e3e77;},'\x66\x44\x5a\x47\x4c':function(_0x48a8d1,_0x2a6b90){return _0x48a8d1+_0x2a6b90;},'\x49\x48\x4a\x50\x58':function(_0x589bb4,_0x280693){return _0x589bb4*_0x280693;},'\x51\x58\x75\x6b\x75':function(_0xc372d4,_0xb6e933){return _0xc372d4(_0xb6e933);},'\x78\x49\x54\x7a\x76':function(_0xcc3040,_0x3fb54b){return _0xcc3040!==_0x3fb54b;},'\x6a\x63\x44\x41\x52':_0x46e4('3a','\x33\x57\x6a\x6e'),'\x4b\x6e\x73\x47\x69':_0x46e4('3b','\x58\x75\x24\x6b'),'\x56\x58\x66\x57\x62':function(_0x86e50e,_0xf313cd){return _0x86e50e>_0xf313cd;},'\x67\x55\x68\x42\x6c':function(_0x1821a4,_0x490577){return _0x1821a4!==_0x490577;},'\x78\x59\x79\x58\x73':_0x46e4('3c','\x40\x71\x69\x37'),'\x71\x64\x45\x48\x70':'\x74\x56\x62\x7a\x47','\x55\x6e\x62\x72\x55':function(_0x24ef39,_0x409610){return _0x24ef39==_0x409610;},'\x6c\x6f\x4f\x76\x76':function(_0x299df3,_0x15afe8){return _0x299df3<=_0x15afe8;},'\x48\x43\x4f\x46\x58':function(_0x2f7f56,_0x4a01a4){return _0x2f7f56!==_0x4a01a4;},'\x44\x70\x43\x68\x71':'\x78\x70\x4c\x6e\x46','\x45\x71\x75\x68\x42':function(_0x3f79d8,_0x4b8c6e,_0x2f81ed){return _0x3f79d8(_0x4b8c6e,_0x2f81ed);},'\x6f\x48\x62\x76\x4e':function(_0x1d2c77,_0x203ec8){return _0x1d2c77*_0x203ec8;},'\x54\x50\x70\x50\x52':function(_0x298e19,_0x1a3b4e){return _0x298e19===_0x1a3b4e;},'\x64\x41\x6c\x52\x78':_0x46e4('3d','\x37\x49\x6b\x64'),'\x4f\x66\x6e\x78\x52':_0x46e4('3e','\x58\x75\x24\x6b'),'\x6d\x51\x64\x6b\x58':function(_0x2a972c,_0x47b9da){return _0x2a972c!==_0x47b9da;},'\x56\x71\x50\x7a\x73':_0x46e4('3f','\x40\x71\x69\x37'),'\x66\x69\x77\x52\x75':_0x46e4('40','\x33\x68\x52\x2a'),'\x45\x42\x43\x52\x51':function(_0x41414f,_0x54d964,_0x2df2fd){return _0x41414f(_0x54d964,_0x2df2fd);}};try{if(_0x1fe907[_0x46e4('41','\x4c\x58\x44\x78')](_0x1fe907[_0x46e4('42','\x68\x6a\x6e\x48')],_0x1fe907[_0x46e4('43','\x28\x40\x4b\x38')])){if(!HeartGift[_0x46e4('44','\x53\x75\x72\x49')]||_0x1fe907['\x56\x58\x66\x57\x62'](this[_0x46e4('45','\x52\x58\x72\x37')],0x3))return;let _0x285c16={'\x69\x64':[this[_0x46e4('46','\x4a\x35\x76\x75')],this[_0x46e4('47','\x72\x78\x79\x38')],this[_0x46e4('48','\x76\x4c\x4a\x65')],this[_0x46e4('22','\x4d\x4d\x4e\x2a')]],'\x64\x65\x76\x69\x63\x65':[this[_0x46e4('49','\x6b\x6b\x51\x50')],this[_0x46e4('4a','\x61\x4a\x54\x6a')]],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x46e4('4b','\x66\x30\x6e\x36')],'\x74\x69\x6d\x65':this[_0x46e4('4c','\x33\x68\x52\x2a')],'\x74\x73':new Date()[_0x46e4('4d','\x72\x78\x79\x38')](),'\x75\x61':this['\x75\x61']};KeySign['\x63\x6f\x6e\x76\x65\x72\x74'](_0x285c16);let _0x58e15e=BiliPushUtils[_0x46e4('4e','\x4a\x35\x76\x75')](JSON[_0x46e4('4f','\x5a\x25\x21\x2a')](_0x285c16),this[_0x46e4('50','\x61\x4a\x54\x6a')]);if(_0x58e15e){if(_0x1fe907['\x67\x55\x68\x42\x6c'](_0x1fe907['\x78\x59\x79\x58\x73'],_0x1fe907['\x71\x64\x45\x48\x70'])){_0x285c16['\x73']=_0x58e15e;let _0xa7c14e=await BiliPushUtils[_0x46e4('51','\x41\x36\x54\x33')][_0x46e4('52','\x69\x70\x48\x5b')][_0x46e4('53','\x44\x34\x74\x5a')](_0x285c16);if(_0x1fe907['\x55\x6e\x62\x72\x55'](_0xa7c14e[_0x46e4('54','\x58\x75\x24\x6b')],0x0)){console['\x6c\x6f\x67']('\u6210\u529f\u89e6\u53d1\x5b'+this[_0x46e4('55','\x40\x71\x69\x37')][_0x46e4('56','\x41\x36\x54\x33')]+_0x46e4('57','\x24\x29\x6c\x43')+this['\x72\x6f\x6f\x6d\x5f\x69\x64']+_0x46e4('58','\x72\x78\x79\x38'));++HeartGift['\x74\x6f\x74\x61\x6c'];++this[_0x46e4('59','\x40\x71\x69\x37')];this[_0x46e4('5a','\x53\x37\x4f\x54')]=_0xa7c14e[_0x46e4('5b','\x34\x76\x6f\x4b')][_0x46e4('5c','\x53\x37\x4f\x54')];this[_0x46e4('5d','\x44\x34\x74\x5a')]=_0xa7c14e[_0x46e4('5e','\x41\x39\x75\x5d')][_0x46e4('5f','\x5b\x5a\x5d\x62')];this['\x65\x74\x73']=_0xa7c14e[_0x46e4('60','\x38\x72\x36\x78')][_0x46e4('61','\x4d\x4d\x4e\x2a')];this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=_0xa7c14e[_0x46e4('62','\x53\x75\x72\x49')]['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65'];if(_0x1fe907[_0x46e4('63','\x43\x75\x73\x50')](HeartGift['\x74\x6f\x74\x61\x6c'],HeartGift[_0x46e4('64','\x41\x39\x75\x5d')])&&HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){if(_0x1fe907[_0x46e4('65','\x77\x44\x30\x6d')](_0x1fe907['\x44\x70\x43\x68\x71'],_0x1fe907[_0x46e4('66','\x6f\x64\x4f\x4b')])){r=Module[_0x46e4('67','\x4c\x58\x44\x78')][_0x46e4('68','\x25\x5b\x4b\x46')](r),Module[_0x46e4('69','\x28\x40\x4b\x38')][_0x46e4('6a','\x5a\x25\x21\x2a')](t,0x3db);}else{await _0x1fe907[_0x46e4('6b','\x69\x70\x48\x5b')](delayCall,()=>this[_0x46e4('6c','\x44\x34\x74\x5a')](),_0x1fe907['\x6f\x48\x62\x76\x4e'](this[_0x46e4('6d','\x70\x6d\x21\x25')],0x3e8));}}else{if(_0x1fe907[_0x46e4('6e','\x31\x53\x30\x76')](_0x1fe907[_0x46e4('6f','\x33\x57\x6a\x6e')],_0x1fe907['\x4f\x66\x6e\x78\x52'])){Module[_0x46e4('70','\x61\x77\x34\x4d')][_0x1fe907[_0x46e4('71','\x51\x4a\x38\x73')](address,0xc)]=0x2;Module['\x48\x45\x41\x50\x33\x32'][_0x1fe907[_0x46e4('72','\x58\x75\x24\x6b')](address,0x4)]=value;}else{if(HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){if(_0x1fe907[_0x46e4('73','\x33\x68\x52\x2a')](_0x1fe907['\x56\x71\x50\x7a\x73'],_0x1fe907['\x56\x71\x50\x7a\x73'])){var _0x5a28d6=Module[_0x46e4('74','\x61\x77\x34\x4d')][_0x46e4('75','\x31\x79\x34\x67')]++;Module[_0x46e4('76','\x40\x71\x69\x37')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x5a28d6]=value;return _0x5a28d6;}else{console['\x6c\x6f\x67']('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift[_0x46e4('77','\x61\x77\x34\x4d')]=![];_0x1fe907['\x51\x58\x75\x6b\x75'](runTomorrow,HeartGift[_0x46e4('78','\x62\x30\x58\x7a')]);}}}}}}else{var _0xf3e82d=keys[i];var _0x529d31=_0x1fe907[_0x46e4('79','\x70\x6d\x21\x25')](key_array_pointer,_0x1fe907[_0x46e4('7a','\x59\x71\x40\x6f')](i,0x8));Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('7b','\x33\x57\x6a\x6e')](_0x529d31,_0xf3e82d);Module[_0x46e4('7c','\x58\x75\x24\x6b')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1fe907[_0x46e4('7d','\x5b\x5a\x5d\x62')](value_array_pointer,_0x1fe907[_0x46e4('7e','\x61\x4a\x54\x6a')](i,0x10)),value[_0xf3e82d]);}}}else{pointer=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](length);Module[_0x46e4('7f','\x31\x53\x30\x76')][_0x46e4('80','\x38\x72\x36\x78')](buffer,pointer);}}catch(_0x3b5c44){if(_0x1fe907[_0x46e4('81','\x4c\x58\x44\x78')](_0x1fe907['\x66\x69\x77\x52\x75'],_0x1fe907[_0x46e4('82','\x40\x71\x69\x37')])){console[_0x46e4('83','\x69\x70\x48\x5b')]('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=![];_0x1fe907[_0x46e4('84','\x28\x40\x4b\x38')](runTomorrow,HeartGift[_0x46e4('85','\x72\x78\x79\x38')]);}else{this[_0x46e4('86','\x40\x71\x69\x37')]++;console[_0x46e4('87','\x41\x39\x75\x5d')](_0x3b5c44);await _0x1fe907[_0x46e4('88','\x53\x37\x4f\x54')](delayCall,()=>this[_0x46e4('89','\x7a\x49\x4c\x57')](),0x3e8);}}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x166a8a={'\x6d\x4a\x63\x41\x65':function(_0x1bcf2d,_0x557a86){return _0x1bcf2d+_0x557a86;},'\x6f\x6e\x64\x4b\x78':function(_0x576650,_0x13f26d){return _0x576650==_0x13f26d;},'\x5a\x4f\x61\x49\x49':'\x68\x74\x74\x70\x73\x3a\x2f\x2f\x69\x30\x2e\x68\x64\x73\x6c\x62\x2e\x63\x6f\x6d\x2f\x62\x66\x73\x2f\x6c\x69\x76\x65\x2f\x65\x37\x39\x31\x35\x35\x36\x37\x30\x36\x66\x38\x38\x64\x38\x38\x62\x34\x38\x34\x36\x61\x36\x31\x61\x35\x38\x33\x62\x33\x31\x64\x62\x30\x30\x37\x66\x38\x33\x64\x2e\x77\x61\x73\x6d','\x4a\x4c\x6f\x41\x42':function(_0x3ce4f3,_0x2cec5b){return _0x3ce4f3!==_0x2cec5b;},'\x63\x79\x5a\x4b\x68':_0x46e4('8a','\x79\x40\x49\x5e'),'\x6e\x49\x48\x5a\x53':'\x77\x61\x50\x4d\x46','\x59\x50\x64\x6b\x4c':_0x46e4('8b','\x63\x33\x5a\x28'),'\x72\x49\x78\x53\x65':function(_0x4e410e,_0x343d77){return _0x4e410e>_0x343d77;},'\x50\x65\x63\x48\x58':_0x46e4('8c','\x40\x64\x70\x29'),'\x75\x70\x48\x63\x4b':_0x46e4('8d','\x53\x75\x72\x49'),'\x4c\x72\x44\x48\x64':_0x46e4('8e','\x44\x71\x42\x6e'),'\x73\x45\x76\x41\x51':function(_0x5720a,_0x1ea105,_0x50c5e8){return _0x5720a(_0x1ea105,_0x50c5e8);},'\x6a\x73\x64\x6c\x56':function(_0x500e1f,_0x5c9bda,_0x4b5bab){return _0x500e1f(_0x5c9bda,_0x4b5bab);}};if(!HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){HeartGift[_0x46e4('8f','\x4c\x58\x44\x78')]=0x0;HeartGift[_0x46e4('90','\x33\x68\x52\x2a')]=!![];}if(_0x166a8a[_0x46e4('91','\x66\x30\x6e\x36')](BiliPushUtils[_0x46e4('92','\x24\x29\x6c\x43')],null)){let _0x2b666a=await HeartGift[_0x46e4('93','\x68\x6a\x6e\x48')](_0x166a8a[_0x46e4('94','\x41\x36\x54\x33')],HeartGift['\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c']);if(_0x2b666a){BiliPushUtils[_0x46e4('95','\x70\x38\x26\x32')]=function(_0x45ec93,_0x2e84bc){return _0x2b666a[_0x46e4('96','\x68\x6a\x6e\x48')](_0x45ec93,_0x2e84bc);};}else{if(_0x166a8a[_0x46e4('97','\x40\x64\x70\x29')](_0x166a8a['\x63\x79\x5a\x4b\x68'],_0x166a8a[_0x46e4('98','\x5a\x25\x21\x2a')])){console[_0x46e4('99','\x53\x37\x4f\x54')](_0x166a8a[_0x46e4('9a','\x70\x6d\x21\x25')]);return;}else{return cachedDecoder['\x64\x65\x63\x6f\x64\x65'](Module[_0x46e4('9b','\x41\x39\x75\x5d')]['\x73\x75\x62\x61\x72\x72\x61\x79'](index,_0x166a8a[_0x46e4('9c','\x53\x75\x72\x49')](index,length)));}}}let _0x3eb6b1=await Gift[_0x46e4('9d','\x62\x30\x58\x7a')]();if(_0x3eb6b1&&_0x166a8a[_0x46e4('9e','\x63\x33\x5a\x28')](_0x3eb6b1[_0x46e4('9f','\x69\x70\x48\x5b')],0x0)){if(_0x166a8a[_0x46e4('a0','\x56\x46\x6f\x53')](_0x166a8a[_0x46e4('a1','\x33\x57\x6a\x6e')],_0x166a8a['\x75\x70\x48\x63\x4b'])){console['\x6c\x6f\x67'](_0x166a8a['\x4c\x72\x44\x48\x64']);for(let _0x19267a of _0x3eb6b1){let _0x5dd7e4=await API['\x72\x6f\x6f\x6d'][_0x46e4('a2','\x25\x5b\x4b\x46')](_0x166a8a[_0x46e4('a3','\x4a\x35\x76\x75')](parseInt,_0x19267a[_0x46e4('a4','\x26\x2a\x42\x28')],0xa));if(_0x166a8a[_0x46e4('a5','\x6b\x6b\x51\x50')](_0x5dd7e4[_0x46e4('a6','\x41\x39\x75\x5d')],0x0)){console[_0x46e4('a7','\x38\x72\x36\x78')]('\u5f00\u59cb\u6536\u96c6\x5b'+_0x19267a[_0x46e4('a8','\x37\x49\x6b\x64')]+_0x46e4('a9','\x44\x34\x74\x5a')+_0x5dd7e4[_0x46e4('aa','\x5a\x25\x21\x2a')][_0x46e4('12','\x53\x37\x4f\x54')]+_0x46e4('ab','\x4d\x4d\x4e\x2a'));new HeartGiftRoom(_0x5dd7e4[_0x46e4('ac','\x44\x71\x42\x6e')],_0x19267a);await _0x166a8a[_0x46e4('ad','\x28\x40\x4b\x38')](delayCall,()=>{},0x3e8);}}}else{Module['\x48\x45\x41\x50\x55\x38'][_0x166a8a[_0x46e4('ae','\x68\x6a\x6e\x48')](address,0xc)]=0x0;}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0x53f2d4,_0x2a66d8){var _0x554f31={'\x62\x43\x59\x62\x69':function(_0x29885a,_0x17235e){return _0x29885a+_0x17235e;},'\x74\x7a\x51\x72\x59':function(_0x38e7f6,_0x4f0a6e){return _0x38e7f6/_0x4f0a6e;},'\x55\x67\x4d\x52\x72':function(_0x3500a0,_0x4cb1ba){return _0x3500a0!==_0x4cb1ba;},'\x6b\x6c\x58\x71\x57':'\x55\x7a\x70\x4a\x4e','\x4c\x78\x58\x71\x4b':_0x46e4('af','\x4c\x58\x44\x78'),'\x5a\x62\x79\x48\x78':_0x46e4('b0','\x66\x30\x6e\x36'),'\x56\x41\x5a\x4b\x61':function(_0x3876e8,_0x1cc534){return _0x3876e8(_0x1cc534);},'\x55\x48\x42\x6c\x78':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44','\x46\x6b\x42\x61\x4c':function(_0x35ff0e){return _0x35ff0e();},'\x76\x53\x73\x6e\x62':function(_0x16bc88,_0x536d4a){return _0x16bc88===_0x536d4a;},'\x55\x52\x63\x67\x4e':_0x46e4('b1','\x24\x29\x6c\x43'),'\x6f\x59\x77\x73\x51':function(_0x9cc9d1,_0x1deb39){return _0x9cc9d1!==_0x1deb39;},'\x41\x55\x50\x43\x47':'\x65\x6c\x52\x46\x4e','\x71\x79\x6e\x75\x64':_0x46e4('b2','\x70\x6d\x21\x25'),'\x6b\x42\x78\x70\x63':'\x69\x7a\x4f\x72\x62','\x77\x57\x67\x55\x77':_0x46e4('b3','\x53\x75\x72\x49'),'\x66\x52\x50\x65\x56':function(_0x4cf8bb,_0x2a7b0c){return _0x4cf8bb|_0x2a7b0c;},'\x73\x41\x57\x56\x49':function(_0x393f1d,_0x54630c){return _0x393f1d+_0x54630c;},'\x50\x6f\x6d\x6c\x54':function(_0x3ffac0,_0x2ff7cf){return _0x3ffac0<<_0x2ff7cf;},'\x45\x5a\x6a\x77\x48':function(_0x385818,_0x1de33e){return _0x385818&_0x1de33e;},'\x59\x4f\x5a\x51\x46':function(_0x294b28,_0x4c48c4){return _0x294b28&_0x4c48c4;},'\x52\x4c\x52\x69\x6f':_0x46e4('b4','\x34\x76\x6f\x4b'),'\x76\x62\x65\x55\x77':'\x4e\x59\x57\x5a\x41','\x4a\x48\x71\x61\x63':_0x46e4('b5','\x6b\x6b\x51\x50'),'\x64\x54\x77\x44\x6c':function(_0x1e45a2,_0x2d2db5,_0x389440){return _0x1e45a2(_0x2d2db5,_0x389440);},'\x6a\x4a\x50\x77\x4f':_0x46e4('b6','\x31\x53\x30\x76'),'\x6a\x55\x6f\x61\x73':function(_0x4a3b64,_0x588513){return _0x4a3b64==_0x588513;},'\x6a\x44\x66\x6e\x6a':_0x46e4('b7','\x6b\x6b\x51\x50')};var _0x2b1dda=_0x554f31[_0x46e4('b8','\x61\x77\x34\x4d')](_0x2a66d8),_0x22e33f=_0x554f31['\x64\x54\x77\x44\x6c'](fetch,_0x53f2d4,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x554f31[_0x46e4('b9','\x26\x2a\x42\x28')]});return(_0x554f31['\x6a\x55\x6f\x61\x73'](_0x554f31[_0x46e4('ba','\x41\x36\x54\x33')],typeof window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x46e4('bb','\x38\x72\x36\x78')])?window[_0x46e4('bc','\x37\x49\x6b\x64')][_0x46e4('bd','\x58\x75\x24\x6b')](_0x22e33f,_0x2b1dda[_0x46e4('be','\x62\x30\x58\x7a')])[_0x46e4('bf','\x32\x6e\x21\x53')](function(_0x53f2d4){return _0x53f2d4[_0x46e4('c0','\x72\x4c\x50\x55')];}):_0x22e33f[_0x46e4('c1','\x4c\x58\x44\x78')](function(_0x53f2d4){if(_0x554f31['\x55\x67\x4d\x52\x72'](_0x554f31['\x6b\x6c\x58\x71\x57'],_0x554f31[_0x46e4('c2','\x63\x33\x5a\x28')])){return _0x53f2d4['\x61\x72\x72\x61\x79\x42\x75\x66\x66\x65\x72']();}else{var _0x28cef1=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](value);Module[_0x46e4('c3','\x43\x75\x73\x50')][_0x554f31[_0x46e4('c4','\x41\x36\x54\x33')](address,0xc)]=0xf;Module[_0x46e4('c5','\x29\x62\x4f\x46')][_0x554f31[_0x46e4('c6','\x4c\x58\x44\x78')](address,0x4)]=_0x28cef1;}})[_0x46e4('c7','\x43\x75\x73\x50')](function(_0x53f2d4){var _0x38af7d={'\x6d\x74\x6f\x55\x68':_0x554f31['\x5a\x62\x79\x48\x78'],'\x61\x78\x65\x62\x59':function(_0x45ea11,_0x1903d6){return _0x554f31['\x56\x41\x5a\x4b\x61'](_0x45ea11,_0x1903d6);},'\x6b\x63\x5a\x70\x69':_0x554f31[_0x46e4('c8','\x41\x36\x54\x33')],'\x6a\x55\x76\x55\x72':function(_0x10f959){return _0x554f31[_0x46e4('c9','\x52\x58\x72\x37')](_0x10f959);}};if(_0x554f31[_0x46e4('ca','\x53\x75\x72\x49')](_0x554f31['\x55\x52\x63\x67\x4e'],_0x554f31[_0x46e4('cb','\x6f\x64\x4f\x4b')])){return window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x46e4('cc','\x44\x71\x42\x6e')](_0x53f2d4);}else{var _0x1ee3c0=_0x38af7d[_0x46e4('cd','\x70\x38\x26\x32')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x20e727=0x0;while(!![]){switch(_0x1ee3c0[_0x20e727++]){case'\x30':this['\x69\x6e\x66\x6f']=info;continue;case'\x31':this[_0x46e4('ce','\x58\x75\x24\x6b')]=_0x38af7d[_0x46e4('cf','\x77\x44\x30\x6d')](getCookie,_0x38af7d[_0x46e4('d0','\x37\x49\x6b\x64')]);continue;case'\x32':this['\x65\x72\x72\x6f\x72']=0x0;continue;case'\x33':;continue;case'\x34':this[_0x46e4('d1','\x69\x70\x48\x5b')]=info[_0x46e4('d2','\x79\x40\x49\x5e')];continue;case'\x35':this['\x73\x65\x71']=0x0;continue;case'\x36':this[_0x46e4('d3','\x79\x40\x49\x5e')]=info[_0x46e4('d4','\x72\x4c\x50\x55')];continue;case'\x37':this['\x6d\x65\x64\x61\x6c']=medal;continue;case'\x38':this[_0x46e4('d5','\x29\x62\x4f\x46')]=_0x38af7d[_0x46e4('d6','\x31\x79\x34\x67')](UUID);continue;case'\x39':this[_0x46e4('d7','\x6b\x6b\x51\x50')]();continue;case'\x31\x30':this['\x75\x61']=window&&window[_0x46e4('d8','\x40\x71\x69\x37')]?window[_0x46e4('e','\x68\x6a\x6e\x48')][_0x46e4('d9','\x68\x6a\x6e\x48')]:'';continue;case'\x31\x31':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=info['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'];continue;case'\x31\x32':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;}break;}}})[_0x46e4('da','\x68\x6a\x6e\x48')](function(_0x53f2d4){if(_0x554f31[_0x46e4('db','\x31\x53\x30\x76')](_0x554f31['\x41\x55\x50\x43\x47'],_0x554f31['\x71\x79\x6e\x75\x64'])){return window[_0x46e4('dc','\x73\x29\x55\x76')][_0x46e4('dd','\x29\x62\x4f\x46')](_0x53f2d4,_0x2b1dda[_0x46e4('de','\x70\x38\x26\x32')]);}else{return undefined;}}))['\x74\x68\x65\x6e'](function(_0x53f2d4){if(_0x554f31[_0x46e4('df','\x52\x58\x72\x37')](_0x554f31['\x6b\x42\x78\x70\x63'],_0x554f31[_0x46e4('e0','\x59\x71\x40\x6f')])){Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('e1','\x76\x4c\x4a\x65')]('\x76\x69',deallocator_pointer,[function_pointer]);}else{return _0x2b1dda[_0x46e4('e2','\x72\x4c\x50\x55')](_0x53f2d4);}})[_0x46e4('e3','\x28\x40\x4b\x38')](function(_0x53f2d4){if(_0x554f31[_0x46e4('e4','\x77\x44\x30\x6d')](_0x554f31[_0x46e4('e5','\x56\x46\x6f\x53')],_0x554f31[_0x46e4('e6','\x38\x72\x36\x78')])){throw console['\x6c\x6f\x67'](_0x554f31[_0x46e4('e7','\x56\x46\x6f\x53')],_0x53f2d4),_0x53f2d4;}else{u=_0x554f31[_0x46e4('e8','\x43\x75\x73\x50')](_0x554f31[_0x46e4('e9','\x77\x44\x30\x6d')](0x10000,_0x554f31[_0x46e4('ea','\x77\x44\x30\x6d')](_0x554f31[_0x46e4('eb','\x43\x75\x73\x50')](u,0x3ff),0xa)),_0x554f31['\x59\x4f\x5a\x51\x46'](str[_0x46e4('ec','\x61\x4a\x54\x6a')](++i),0x3ff));}});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x16b80a={'\x6d\x4b\x57\x42\x42':_0x46e4('ed','\x73\x29\x55\x76'),'\x79\x45\x59\x57\x76':function(_0xa699e2,_0x40eba5){return _0xa699e2+_0x40eba5;},'\x57\x51\x78\x65\x59':function(_0x163a0f,_0x492773){return _0x163a0f*_0x492773;},'\x73\x4c\x43\x77\x4b':function(_0x2e5856,_0x33f7c4){return _0x2e5856/_0x33f7c4;},'\x6e\x48\x47\x7a\x4d':function(_0x155473,_0x2cf4f4){return _0x155473+_0x2cf4f4;},'\x44\x44\x6b\x70\x48':'\x35\x7c\x30\x7c\x31\x7c\x31\x30\x7c\x32\x7c\x37\x7c\x31\x35\x7c\x33\x7c\x31\x33\x7c\x38\x7c\x31\x31\x7c\x31\x32\x7c\x31\x36\x7c\x39\x7c\x34\x7c\x31\x34\x7c\x36','\x67\x46\x70\x54\x73':function(_0x593cb9,_0x281c89){return _0x593cb9<_0x281c89;},'\x72\x6f\x57\x43\x52':function(_0x1315f3,_0x3b2f3d){return _0x1315f3>=_0x3b2f3d;},'\x41\x48\x46\x73\x46':function(_0x3258e1,_0x332f34){return _0x3258e1<=_0x332f34;},'\x6d\x56\x46\x50\x48':function(_0xfc3fa4,_0x16aa36){return _0xfc3fa4|_0x16aa36;},'\x6f\x4f\x54\x4b\x59':function(_0x527752,_0x439288){return _0x527752+_0x439288;},'\x55\x63\x6e\x6a\x6b':function(_0x41c0cd,_0x248027){return _0x41c0cd<<_0x248027;},'\x53\x79\x77\x57\x79':function(_0x59afbb,_0x280b03){return _0x59afbb&_0x280b03;},'\x76\x78\x78\x49\x42':function(_0x3e9434,_0x3c795b){return _0x3e9434&_0x3c795b;},'\x59\x4d\x4c\x57\x4d':function(_0x1136c2,_0x948b6a){return _0x1136c2===_0x948b6a;},'\x6b\x76\x4f\x53\x61':'\x7a\x4f\x50\x74\x65','\x5a\x41\x42\x64\x54':'\x6e\x54\x77\x7a\x58','\x79\x76\x56\x64\x78':function(_0x55c9fc,_0x1da61e){return _0x55c9fc<=_0x1da61e;},'\x72\x4f\x58\x57\x6b':function(_0x1766d9,_0x238b86){return _0x1766d9>>_0x238b86;},'\x46\x66\x61\x63\x49':function(_0x25d959,_0x1e456e){return _0x25d959|_0x1e456e;},'\x59\x64\x6b\x55\x66':function(_0x4c8953,_0x4e8cde){return _0x4c8953&_0x4e8cde;},'\x50\x6e\x4d\x79\x52':function(_0x2d3dba,_0x59f246){return _0x2d3dba<=_0x59f246;},'\x78\x4f\x6d\x64\x58':function(_0xb62778,_0x25ac5c){return _0xb62778!==_0x25ac5c;},'\x65\x64\x78\x45\x55':_0x46e4('ee','\x76\x4c\x4a\x65'),'\x6e\x7a\x44\x66\x55':'\x4b\x7a\x6e\x49\x57','\x6b\x4e\x47\x63\x50':function(_0xd2f45f,_0x150af9){return _0xd2f45f|_0x150af9;},'\x59\x56\x41\x7a\x44':function(_0x529694,_0x4e2fcf){return _0x529694|_0x4e2fcf;},'\x76\x55\x76\x48\x46':function(_0x2751db,_0x189fed){return _0x2751db<=_0x189fed;},'\x66\x79\x55\x50\x71':function(_0x5e3890,_0x502395){return _0x5e3890|_0x502395;},'\x78\x76\x70\x4a\x74':function(_0x1f4474,_0x3fb586){return _0x1f4474|_0x3fb586;},'\x46\x41\x53\x6e\x58':function(_0x601a7b,_0x13c403){return _0x601a7b&_0x13c403;},'\x64\x63\x51\x41\x6f':function(_0x330d78,_0x4fd2ed){return _0x330d78>>_0x4fd2ed;},'\x47\x74\x65\x6e\x4e':function(_0x42f377,_0x59b906){return _0x42f377>>_0x59b906;},'\x63\x43\x4c\x72\x58':function(_0x44571e,_0x90516a){return _0x44571e|_0x90516a;},'\x44\x78\x42\x6a\x63':_0x46e4('ef','\x77\x44\x30\x6d'),'\x6a\x76\x75\x63\x53':function(_0x10d257,_0x3f72d0){return _0x10d257|_0x3f72d0;},'\x74\x6a\x6d\x47\x64':function(_0x21e158,_0x16fa01){return _0x21e158|_0x16fa01;},'\x6b\x77\x4c\x6d\x73':function(_0xc5f0df,_0x2c2d7e){return _0xc5f0df>>_0x2c2d7e;},'\x4b\x64\x70\x57\x6b':function(_0x56b525,_0x3f32b5){return _0x56b525>>_0x3f32b5;},'\x55\x65\x59\x4a\x62':function(_0x29513d,_0x431e50){return _0x29513d|_0x431e50;},'\x4e\x68\x53\x70\x56':function(_0x309697,_0x502237){return _0x309697&_0x502237;},'\x6c\x4f\x4d\x72\x68':function(_0x463cd6,_0xea89cd){return _0x463cd6>>_0xea89cd;},'\x49\x56\x4e\x45\x71':'\x6b\x6d\x64\x5a\x6b','\x42\x48\x67\x48\x62':_0x46e4('f0','\x5b\x5a\x5d\x62'),'\x6b\x56\x71\x79\x77':'\x35\x7c\x30\x7c\x32\x7c\x31\x7c\x33\x7c\x34','\x5a\x4d\x73\x71\x72':function(_0x2755fa,_0x322cca){return _0x2755fa&_0x322cca;},'\x49\x6e\x61\x72\x6d':function(_0x3e6797,_0x43018d){return _0x3e6797>>_0x43018d;},'\x6b\x70\x4b\x55\x64':function(_0x4e9537,_0x5de06e){return _0x4e9537&_0x5de06e;},'\x41\x70\x51\x71\x68':function(_0x1e2fa8,_0x10e428){return _0x1e2fa8&_0x10e428;},'\x49\x73\x6c\x72\x7a':function(_0x18a3a6,_0x2e428a){return _0x18a3a6>>_0x2e428a;},'\x5a\x6b\x52\x66\x51':function(_0x54681a,_0x466778){return _0x54681a&_0x466778;},'\x64\x76\x6c\x7a\x42':function(_0x461bb6,_0x52dccf){return _0x461bb6|_0x52dccf;},'\x55\x56\x43\x62\x50':_0x46e4('f1','\x73\x29\x55\x76'),'\x67\x53\x6a\x6b\x6f':'\x32\x7c\x33\x7c\x30\x7c\x34\x7c\x31','\x65\x57\x77\x6d\x64':function(_0x40b878,_0x5d08f1){return _0x40b878+_0x5d08f1;},'\x76\x6e\x49\x67\x67':function(_0x22b933,_0x2cf29e){return _0x22b933/_0x2cf29e;},'\x55\x71\x78\x50\x54':function(_0x46c368,_0x4d7d80){return _0x46c368<_0x4d7d80;},'\x6a\x52\x4c\x5a\x4d':function(_0x60203c,_0x135c5d){return _0x60203c+_0x135c5d;},'\x6f\x42\x62\x4e\x6d':function(_0x1027e6,_0x39754d){return _0x1027e6*_0x39754d;},'\x77\x57\x66\x64\x74':function(_0x132665,_0x1b11eb){return _0x132665+_0x1b11eb;},'\x4f\x79\x75\x7a\x53':function(_0x227808,_0x47869c){return _0x227808/_0x47869c;},'\x61\x66\x6b\x67\x53':'\x32\x7c\x34\x7c\x30\x7c\x31\x7c\x33','\x56\x7a\x52\x61\x62':function(_0x253579,_0x5c3cb2){return _0x253579===_0x5c3cb2;},'\x70\x6a\x55\x42\x4b':function(_0xbd3a82,_0x5755c9){return _0xbd3a82!==_0x5755c9;},'\x55\x74\x4b\x44\x6f':_0x46e4('f2','\x73\x29\x55\x76'),'\x46\x74\x4b\x61\x42':_0x46e4('f3','\x53\x75\x72\x49'),'\x79\x66\x54\x6b\x4f':_0x46e4('f4','\x4a\x35\x76\x75'),'\x73\x67\x72\x4c\x65':_0x46e4('f5','\x4a\x35\x76\x75'),'\x48\x57\x77\x51\x62':'\x6d\x56\x47\x54\x61','\x51\x4c\x76\x5a\x73':function(_0xa90506,_0x2b3c3d){return _0xa90506===_0x2b3c3d;},'\x52\x57\x61\x69\x45':function(_0xa9924e,_0x6d8d7c){return _0xa9924e!==_0x6d8d7c;},'\x68\x78\x5a\x67\x47':'\x67\x50\x54\x68\x4d','\x57\x6c\x69\x56\x5a':_0x46e4('f6','\x58\x75\x24\x6b'),'\x46\x77\x46\x71\x6a':_0x46e4('f7','\x68\x6a\x6e\x48'),'\x4b\x4f\x75\x45\x6e':function(_0x47b93c,_0x33bcd0){return _0x47b93c===_0x33bcd0;},'\x46\x47\x52\x42\x49':function(_0x1d420d,_0x513a0b){return _0x1d420d!=_0x513a0b;},'\x69\x4a\x58\x4e\x66':function(_0x243939,_0x5bb60a){return _0x243939!==_0x5bb60a;},'\x6b\x54\x4c\x43\x78':_0x46e4('f8','\x5a\x25\x21\x2a'),'\x50\x79\x6b\x48\x61':'\x4d\x4c\x50\x4c\x47','\x69\x5a\x4d\x56\x46':_0x46e4('f9','\x5b\x5a\x5d\x62'),'\x76\x4b\x6b\x4b\x6b':'\x59\x71\x48\x6b\x4c','\x74\x4f\x7a\x6b\x71':function(_0xd139f4,_0x3a35ca){return _0xd139f4+_0x3a35ca;},'\x4c\x53\x4c\x69\x5a':'\x52\x53\x55\x68\x4e','\x5a\x6c\x77\x6b\x61':'\x4a\x48\x4b\x4c\x56','\x59\x52\x59\x67\x75':function(_0x208939,_0x288cd7){return _0x208939/_0x288cd7;},'\x66\x7a\x73\x67\x66':function(_0x59d9b3,_0x2ab56d){return _0x59d9b3===_0x2ab56d;},'\x70\x53\x52\x70\x68':_0x46e4('fa','\x4c\x58\x44\x78'),'\x68\x4b\x42\x62\x4c':'\x68\x73\x49\x4f\x72','\x50\x56\x4a\x47\x79':function(_0x2b89d0,_0x4b1973){return _0x2b89d0/_0x4b1973;},'\x47\x48\x50\x76\x58':'\x41\x77\x67\x49\x72','\x68\x72\x6f\x74\x42':'\x68\x71\x61\x53\x62','\x6b\x4f\x5a\x69\x4a':function(_0x240ec2,_0x1f970d){return _0x240ec2===_0x1f970d;},'\x42\x56\x4d\x55\x6b':function(_0x382f6f,_0x8e6bad){return _0x382f6f===_0x8e6bad;},'\x4a\x67\x66\x6f\x62':function(_0x18d7ca,_0x4d5d93){return _0x18d7ca===_0x4d5d93;},'\x71\x6c\x6f\x42\x79':_0x46e4('fb','\x62\x30\x58\x7a'),'\x71\x6d\x78\x6a\x55':_0x46e4('fc','\x5b\x5a\x5d\x62'),'\x74\x46\x73\x72\x61':_0x46e4('fd','\x4c\x58\x44\x78'),'\x55\x69\x58\x4c\x58':function(_0x7560c2,_0x18c686){return _0x7560c2/_0x18c686;},'\x45\x72\x65\x77\x66':_0x46e4('fe','\x56\x46\x6f\x53'),'\x61\x42\x4b\x6a\x72':function(_0x4f6fe9,_0x59fbfa){return _0x4f6fe9<_0x59fbfa;},'\x6b\x67\x75\x4e\x41':_0x46e4('ff','\x62\x30\x58\x7a'),'\x48\x70\x6e\x63\x6b':function(_0x1583f7,_0x105af7){return _0x1583f7/_0x105af7;},'\x77\x4f\x62\x6b\x74':function(_0x21bdf4,_0xc49a35){return _0x21bdf4+_0xc49a35;},'\x6a\x4a\x54\x44\x69':function(_0x185a74,_0x3d0308){return _0x185a74+_0x3d0308;},'\x47\x5a\x58\x76\x41':function(_0x4819ac,_0x49c8b3){return _0x4819ac/_0x49c8b3;},'\x48\x41\x4d\x4f\x49':function(_0x18f032,_0x49506d){return _0x18f032===_0x49506d;},'\x7a\x55\x46\x4f\x77':function(_0x49757e,_0xa79df5){return _0x49757e/_0xa79df5;},'\x54\x78\x65\x71\x51':function(_0x2ca416,_0x2cb6d9){return _0x2ca416+_0x2cb6d9;},'\x71\x4e\x7a\x74\x6c':function(_0x40304a,_0xe8909a){return _0x40304a/_0xe8909a;},'\x74\x6e\x79\x66\x6a':function(_0x1a6468,_0x5c32bd){return _0x1a6468+_0x5c32bd;},'\x69\x71\x43\x4f\x46':function(_0x49dc22,_0x2c2423){return _0x49dc22===_0x2c2423;},'\x46\x46\x4e\x75\x62':_0x46e4('100','\x52\x58\x72\x37'),'\x50\x51\x64\x63\x4f':function(_0x42e96a,_0xc790a8){return _0x42e96a+_0xc790a8;},'\x62\x6e\x78\x45\x71':function(_0x40b671,_0x50213a){return _0x40b671/_0x50213a;},'\x47\x7a\x44\x7a\x6a':function(_0x574a4c,_0x1d0701){return _0x574a4c/_0x1d0701;},'\x41\x55\x66\x45\x45':function(_0x345d25,_0x330c09){return _0x345d25===_0x330c09;},'\x6e\x6a\x50\x4c\x55':_0x46e4('101','\x40\x71\x69\x37'),'\x6b\x4f\x49\x48\x7a':'\x31\x7c\x34\x7c\x33\x7c\x32\x7c\x30','\x56\x44\x53\x7a\x4f':function(_0x79b9c2,_0x69b9f9){return _0x79b9c2+_0x69b9f9;},'\x73\x45\x62\x4c\x75':function(_0x101f39,_0x8dacb3){return _0x101f39>_0x8dacb3;},'\x6d\x67\x74\x4d\x77':function(_0x4cab23,_0x2b193f){return _0x4cab23===_0x2b193f;},'\x4c\x44\x6f\x6c\x6b':'\x66\x59\x4f\x62\x74','\x54\x41\x6e\x4b\x49':_0x46e4('102','\x72\x78\x79\x38'),'\x4a\x43\x45\x78\x6d':_0x46e4('103','\x62\x30\x58\x7a'),'\x6f\x43\x66\x58\x71':function(_0x2e8e28,_0x2d5467){return _0x2e8e28*_0x2d5467;},'\x4a\x6d\x47\x51\x50':function(_0x58b33d,_0x36071a){return _0x58b33d+_0x36071a;},'\x71\x4c\x55\x44\x4f':function(_0x29cbb1,_0x5211b2){return _0x29cbb1+_0x5211b2;},'\x41\x58\x41\x67\x4f':function(_0x24fecb,_0x2e8bac){return _0x24fecb+_0x2e8bac;},'\x6a\x61\x62\x64\x6a':function(_0x4c1f75,_0x341215){return _0x4c1f75+_0x341215;},'\x64\x54\x49\x50\x58':function(_0x4914e7,_0x17e0fb){return _0x4914e7*_0x17e0fb;},'\x4d\x6a\x68\x6e\x71':function(_0x22d232,_0x32f988){return _0x22d232+_0x32f988;},'\x67\x6c\x7a\x4e\x6c':function(_0x144c6a,_0x4541e9){return _0x144c6a*_0x4541e9;},'\x74\x79\x43\x4f\x4d':function(_0x12d5fb,_0x23e912){return _0x12d5fb(_0x23e912);},'\x54\x4b\x49\x50\x4a':_0x46e4('104','\x7a\x49\x4c\x57'),'\x67\x68\x62\x59\x56':_0x46e4('105','\x62\x30\x58\x7a'),'\x77\x4d\x74\x43\x6b':'\x35\x7c\x34\x7c\x31\x7c\x30\x7c\x33\x7c\x32','\x53\x61\x79\x63\x70':function(_0x2e3e89,_0x3a8b59){return _0x2e3e89+_0x3a8b59;},'\x51\x4a\x42\x53\x59':function(_0x51eb3b,_0x42d724){return _0x51eb3b<_0x42d724;},'\x69\x43\x56\x74\x71':function(_0x3e968b,_0xb19ada){return _0x3e968b+_0xb19ada;},'\x68\x62\x77\x47\x4c':function(_0x1726be,_0x288098){return _0x1726be*_0x288098;},'\x56\x4a\x44\x6e\x53':function(_0x119b2a,_0x4dc8b2){return _0x119b2a/_0x4dc8b2;},'\x74\x5a\x75\x49\x4a':_0x46e4('106','\x53\x37\x4f\x54'),'\x57\x6d\x63\x71\x57':'\x33\x7c\x30\x7c\x34\x7c\x32\x7c\x35\x7c\x31','\x5a\x76\x59\x68\x72':function(_0x12504f,_0x2d12a3){return _0x12504f+_0x2d12a3;},'\x73\x52\x72\x41\x49':function(_0x3910e4,_0x14aff7){return _0x3910e4>_0x14aff7;},'\x6d\x77\x79\x72\x4b':_0x46e4('107','\x56\x46\x6f\x53'),'\x71\x74\x7a\x5a\x49':function(_0x2fc955,_0x4de537){return _0x2fc955+_0x4de537;},'\x64\x57\x6a\x41\x67':function(_0x1e7e71,_0x5bfb73){return _0x1e7e71/_0x5bfb73;},'\x72\x4c\x43\x70\x4a':function(_0x124cd5,_0x21748e){return _0x124cd5/_0x21748e;},'\x4e\x55\x66\x45\x77':function(_0x47eb33,_0x10027a){return _0x47eb33/_0x10027a;},'\x68\x46\x50\x4a\x50':_0x46e4('108','\x38\x72\x36\x78'),'\x70\x46\x48\x4e\x7a':function(_0x57c62e,_0x4e7df6){return _0x57c62e!=_0x4e7df6;},'\x6c\x67\x47\x68\x56':_0x46e4('109','\x70\x6d\x21\x25'),'\x6b\x4f\x68\x47\x4f':function(_0x1c22f5,_0x3b6614){return _0x1c22f5<_0x3b6614;},'\x65\x6a\x63\x59\x79':function(_0xb0d861,_0x33da87){return _0xb0d861+_0x33da87;},'\x52\x6b\x43\x57\x6b':function(_0x4ab27e,_0x240736){return _0x4ab27e*_0x240736;},'\x69\x64\x77\x63\x74':function(_0x2d600c,_0x3ea316){return _0x2d600c*_0x3ea316;},'\x58\x63\x48\x48\x70':function(_0x7f715f,_0x2e5e6e){return _0x7f715f+_0x2e5e6e;},'\x46\x50\x69\x66\x56':function(_0x52b540,_0x434228){return _0x52b540/_0x434228;},'\x75\x53\x6b\x6d\x75':function(_0x3963c0,_0x3e3fdd){return _0x3963c0+_0x3e3fdd;},'\x63\x48\x4c\x43\x54':_0x46e4('10a','\x73\x29\x55\x76'),'\x55\x4f\x50\x74\x78':function(_0x52a373,_0x7e47d4){return _0x52a373===_0x7e47d4;},'\x74\x64\x53\x54\x61':_0x46e4('10b','\x72\x78\x79\x38'),'\x46\x45\x4e\x6d\x4a':function(_0x3bf295,_0x5ba956){return _0x3bf295===_0x5ba956;},'\x46\x4e\x4a\x6f\x71':'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x4e\x75\x6d\x62\x65\x72\x5d','\x75\x79\x6c\x6d\x53':function(_0x5f5759,_0x2628da){return _0x5f5759|_0x2628da;},'\x6c\x45\x7a\x68\x72':function(_0x584550,_0x48f54c){return _0x584550!==_0x48f54c;},'\x64\x4b\x6e\x6e\x7a':_0x46e4('10c','\x76\x4c\x4a\x65'),'\x79\x4d\x52\x71\x4b':_0x46e4('10d','\x51\x4a\x38\x73'),'\x4f\x58\x6c\x42\x4c':function(_0x3acc06,_0x220ad7){return _0x3acc06+_0x220ad7;},'\x59\x7a\x55\x61\x4a':function(_0x8502a7,_0x18edb0){return _0x8502a7/_0x18edb0;},'\x4f\x59\x58\x55\x79':_0x46e4('10e','\x31\x79\x34\x67'),'\x6b\x6f\x72\x69\x53':function(_0x1538d5,_0xb63f77){return _0x1538d5===_0xb63f77;},'\x56\x79\x7a\x64\x67':function(_0x49bbd8,_0x1ae53c){return _0x49bbd8+_0x1ae53c;},'\x68\x67\x53\x70\x66':_0x46e4('10f','\x24\x29\x6c\x43'),'\x55\x49\x79\x52\x56':function(_0x180e58,_0x59c1c4){return _0x180e58/_0x59c1c4;},'\x5a\x65\x54\x64\x72':function(_0xb8c43b,_0x40cdb0){return _0xb8c43b+_0x40cdb0;},'\x49\x64\x45\x69\x51':function(_0x239671,_0x23d611){return _0x239671/_0x23d611;},'\x71\x4d\x63\x65\x67':function(_0x450d8d,_0x542295){return _0x450d8d+_0x542295;},'\x4f\x46\x47\x70\x42':_0x46e4('110','\x41\x39\x75\x5d'),'\x44\x76\x58\x63\x65':function(_0x483fbd,_0x30ce7b){return _0x483fbd|_0x30ce7b;},'\x70\x62\x49\x4c\x4b':'\x78\x56\x52\x48\x55','\x50\x75\x50\x73\x75':function(_0x56c10f,_0x19d592){return _0x56c10f<_0x19d592;},'\x68\x4d\x48\x6b\x6e':_0x46e4('111','\x31\x53\x30\x76'),'\x62\x68\x67\x48\x62':'\x5a\x62\x56\x63\x58','\x54\x79\x73\x70\x50':function(_0x46e1f7,_0x1c9715){return _0x46e1f7&_0x1c9715;},'\x6b\x41\x61\x66\x46':function(_0x29e84e,_0x251bdb){return _0x29e84e>=_0x251bdb;},'\x62\x4c\x54\x47\x53':function(_0x86bd74,_0x266ea2){return _0x86bd74<_0x266ea2;},'\x47\x62\x41\x4e\x73':function(_0x5ab4f9,_0x44aed7){return _0x5ab4f9<<_0x44aed7;},'\x75\x42\x6f\x6d\x78':function(_0x238910,_0x1f9566){return _0x238910&_0x1f9566;},'\x77\x68\x6c\x72\x64':function(_0x11546d,_0xf2f60){return _0x11546d&_0xf2f60;},'\x54\x49\x4a\x54\x67':function(_0x3f1ddb,_0x3e736f){return _0x3f1ddb|_0x3e736f;},'\x78\x48\x4e\x47\x75':function(_0x4c67c7,_0x37bdc0){return _0x4c67c7<_0x37bdc0;},'\x57\x61\x6b\x67\x4b':function(_0x2b62c2,_0x128f9a){return _0x2b62c2===_0x128f9a;},'\x4b\x77\x52\x78\x79':_0x46e4('112','\x41\x39\x75\x5d'),'\x49\x65\x6d\x6a\x72':_0x46e4('113','\x6f\x64\x4f\x4b'),'\x6e\x6f\x70\x6e\x52':function(_0x2e01fc,_0x3299b0){return _0x2e01fc<<_0x3299b0;},'\x4b\x68\x6d\x79\x4e':function(_0x102bc7,_0x408da1){return _0x102bc7&_0x408da1;},'\x4f\x4c\x70\x52\x72':function(_0x3e41d0,_0xeb0821){return _0x3e41d0+_0xeb0821;},'\x61\x43\x51\x46\x61':function(_0x456e0e,_0x19bec5){return _0x456e0e+_0x19bec5;},'\x43\x6a\x73\x6c\x68':function(_0x1c7c68,_0x21c1fe){return _0x1c7c68|_0x21c1fe;},'\x64\x75\x6f\x57\x45':function(_0x476c74,_0x4c88af){return _0x476c74|_0x4c88af;},'\x56\x55\x62\x50\x45':_0x46e4('114','\x5a\x25\x21\x2a'),'\x53\x4f\x6e\x51\x74':function(_0x11e33f,_0x5ec386){return _0x11e33f*_0x5ec386;},'\x55\x6c\x6f\x72\x49':function(_0x4bbcd8,_0x2b340b){return _0x4bbcd8|_0x2b340b;},'\x51\x41\x4c\x68\x46':function(_0x3da26e,_0x334e30){return _0x3da26e&_0x334e30;},'\x74\x67\x4c\x4e\x47':function(_0x5bd0b8,_0x509ee6){return _0x5bd0b8==_0x509ee6;},'\x47\x54\x48\x44\x6d':_0x46e4('115','\x76\x4c\x4a\x65'),'\x74\x70\x68\x77\x68':_0x46e4('116','\x53\x37\x4f\x54'),'\x4a\x6e\x67\x43\x4c':function(_0x282989,_0x35e207){return _0x282989===_0x35e207;},'\x74\x63\x42\x4f\x74':function(_0x42f61c,_0x47f8b1){return _0x42f61c===_0x47f8b1;},'\x64\x6e\x56\x6f\x47':function(_0x323e8e,_0x1007af){return _0x323e8e===_0x1007af;},'\x45\x54\x72\x52\x62':_0x46e4('117','\x25\x5b\x4b\x46'),'\x5a\x54\x6c\x79\x71':function(_0x30d7d9,_0x5c8583){return _0x30d7d9===_0x5c8583;},'\x6c\x42\x41\x47\x6a':_0x46e4('118','\x73\x29\x55\x76'),'\x7a\x6c\x74\x4d\x4a':_0x46e4('119','\x61\x77\x34\x4d'),'\x50\x65\x4d\x6b\x6f':_0x46e4('11a','\x73\x29\x55\x76'),'\x65\x4d\x4a\x54\x52':function(_0x423e44,_0xa2c8fd){return _0x423e44 in _0xa2c8fd;},'\x55\x68\x6c\x52\x55':_0x46e4('11b','\x76\x4c\x4a\x65'),'\x53\x4e\x56\x58\x48':function(_0x35b8d9,_0x160800){return _0x35b8d9===_0x160800;},'\x69\x55\x6d\x55\x56':_0x46e4('11c','\x66\x30\x6e\x36'),'\x4b\x62\x70\x6b\x6a':_0x46e4('11d','\x43\x75\x73\x50'),'\x6d\x57\x53\x4d\x6f':function(_0x1254f7,_0x35b54d){return _0x1254f7==_0x35b54d;},'\x51\x6b\x7a\x58\x56':function(_0x254786,_0x4c37ff){return _0x254786!==_0x4c37ff;},'\x72\x4c\x77\x52\x53':_0x46e4('11e','\x63\x33\x5a\x28'),'\x63\x61\x6b\x55\x55':_0x46e4('11f','\x79\x40\x49\x5e'),'\x42\x71\x46\x48\x61':'\x66\x6a\x50\x7a\x70','\x77\x68\x57\x59\x54':function(_0x4b4633,_0x128332){return _0x4b4633!==_0x128332;},'\x59\x4c\x49\x6a\x4a':_0x46e4('120','\x4a\x35\x76\x75'),'\x48\x6a\x45\x74\x50':_0x46e4('121','\x52\x58\x72\x37'),'\x53\x4c\x7a\x59\x68':_0x46e4('122','\x26\x2a\x42\x28'),'\x6e\x75\x71\x59\x75':function(_0x79749a,_0x4a086c){return _0x79749a<=_0x4a086c;},'\x6a\x4d\x6b\x73\x6f':function(_0x3025da,_0x2b1b53){return _0x3025da<<_0x2b1b53;},'\x74\x70\x44\x74\x49':function(_0x3e2208,_0x57dcad){return _0x3e2208&_0x57dcad;},'\x6b\x70\x48\x70\x4b':function(_0x54023c,_0x1d9e00){return _0x54023c&_0x1d9e00;},'\x4f\x4d\x68\x7a\x6b':function(_0x379e4f,_0x366792){return _0x379e4f<=_0x366792;},'\x6b\x72\x55\x75\x54':_0x46e4('123','\x41\x39\x75\x5d'),'\x66\x4c\x6d\x65\x6e':'\x79\x53\x78\x51\x67','\x4b\x6a\x42\x41\x45':_0x46e4('124','\x72\x4c\x50\x55'),'\x63\x46\x54\x44\x6b':'\x76\x50\x4b\x75\x6c','\x55\x57\x50\x5a\x72':_0x46e4('125','\x79\x40\x49\x5e'),'\x4e\x61\x59\x75\x65':_0x46e4('126','\x31\x79\x34\x67'),'\x79\x75\x6c\x77\x68':_0x46e4('127','\x72\x78\x79\x38'),'\x48\x42\x71\x71\x6c':function(_0x596177,_0x2d29af){return _0x596177|_0x2d29af;},'\x51\x52\x50\x48\x7a':function(_0x42c85c,_0x9273d0){return _0x42c85c instanceof _0x9273d0;},'\x73\x67\x62\x4b\x66':function(_0x14b154,_0x4bfc71){return _0x14b154+_0x4bfc71;},'\x62\x47\x4d\x59\x58':function(_0x36b202,_0x57f6a5){return _0x36b202*_0x57f6a5;},'\x75\x5a\x6a\x51\x51':_0x46e4('128','\x31\x79\x34\x67'),'\x4c\x56\x58\x45\x45':function(_0x38b0dc,_0x2a328a){return _0x38b0dc===_0x2a328a;},'\x51\x46\x51\x49\x4a':_0x46e4('129','\x25\x5b\x4b\x46'),'\x70\x64\x78\x50\x6a':_0x46e4('12a','\x76\x4c\x4a\x65'),'\x65\x54\x53\x68\x4a':function(_0x52d7c5,_0x126355){return _0x52d7c5!==_0x126355;},'\x63\x6a\x5a\x75\x51':_0x46e4('12b','\x76\x4c\x4a\x65'),'\x4d\x6e\x49\x44\x57':_0x46e4('12c','\x6f\x64\x4f\x4b'),'\x42\x78\x78\x79\x63':_0x46e4('12d','\x77\x44\x30\x6d'),'\x6b\x6d\x6b\x56\x4a':_0x46e4('12e','\x52\x58\x72\x37'),'\x45\x45\x5a\x66\x66':_0x46e4('12f','\x4c\x58\x44\x78'),'\x5a\x62\x79\x58\x73':function(_0xe54d2e,_0x34650e){return _0xe54d2e!==_0x34650e;},'\x46\x4e\x54\x4b\x4f':'\x72\x49\x54\x6a\x62','\x6e\x62\x4c\x52\x55':'\x57\x78\x58\x50\x74','\x69\x67\x47\x79\x67':_0x46e4('130','\x79\x40\x49\x5e'),'\x56\x74\x4d\x49\x48':'\x55\x53\x50\x49\x6d','\x66\x62\x5a\x55\x50':function(_0x1b076b,_0x52cd72){return _0x1b076b instanceof _0x52cd72;},'\x43\x48\x48\x5a\x6b':_0x46e4('131','\x32\x6e\x21\x53'),'\x4c\x72\x48\x65\x6a':_0x46e4('132','\x40\x64\x70\x29'),'\x65\x71\x72\x4f\x70':function(_0x2fc1c6,_0x4df0fb){return _0x2fc1c6!==_0x4df0fb;},'\x71\x68\x73\x69\x57':_0x46e4('133','\x52\x58\x72\x37'),'\x71\x65\x42\x45\x63':function(_0xc9a093,_0x3dac68){return _0xc9a093===_0x3dac68;},'\x5a\x49\x4e\x7a\x56':_0x46e4('134','\x26\x2a\x42\x28'),'\x61\x64\x4f\x63\x53':function(_0x3a7934,_0x2fb3ed){return _0x3a7934!==_0x2fb3ed;},'\x54\x57\x6b\x50\x4c':_0x46e4('135','\x52\x58\x72\x37'),'\x59\x4e\x55\x48\x5a':_0x46e4('136','\x63\x33\x5a\x28'),'\x44\x6d\x4e\x6e\x72':_0x46e4('137','\x44\x71\x42\x6e'),'\x7a\x4d\x6e\x4e\x6e':_0x46e4('138','\x52\x58\x72\x37'),'\x51\x61\x76\x51\x6d':function(_0x385c8f,_0x2ea7e0){return _0x385c8f*_0x2ea7e0;},'\x79\x65\x78\x64\x75':function(_0x4fe421,_0x4cf27e){return _0x4fe421/_0x4cf27e;},'\x69\x6e\x53\x4e\x62':function(_0x2f0915,_0x21fbb1){return _0x2f0915<_0x21fbb1;},'\x56\x7a\x53\x48\x75':function(_0x2bfdac,_0x590afd){return _0x2bfdac+_0x590afd;},'\x53\x55\x57\x70\x43':function(_0x40b9ea,_0x4d86b1){return _0x40b9ea+_0x4d86b1;},'\x5a\x67\x65\x72\x64':function(_0x2e170c,_0x58d7a4){return _0x2e170c!==_0x58d7a4;},'\x67\x4c\x4f\x43\x46':'\x65\x57\x4e\x42\x45','\x4b\x4f\x51\x4d\x56':function(_0x39478e,_0x4d582d){return _0x39478e+_0x4d582d;},'\x56\x44\x49\x52\x54':function(_0x4d5ca2,_0x4368cb){return _0x4d5ca2===_0x4368cb;},'\x62\x45\x51\x68\x51':_0x46e4('139','\x41\x39\x75\x5d'),'\x68\x69\x71\x4b\x66':_0x46e4('13a','\x40\x71\x69\x37'),'\x68\x61\x4a\x4c\x65':_0x46e4('13b','\x66\x30\x6e\x36'),'\x6f\x55\x4a\x4d\x61':_0x46e4('13c','\x72\x4c\x50\x55'),'\x72\x63\x41\x4a\x58':_0x46e4('13d','\x72\x78\x79\x38'),'\x74\x71\x4e\x71\x58':_0x46e4('13e','\x61\x4a\x54\x6a'),'\x56\x79\x64\x61\x72':_0x46e4('13f','\x63\x33\x5a\x28'),'\x48\x56\x68\x46\x72':function(_0xdd6a77){return _0xdd6a77();},'\x4c\x44\x72\x53\x65':_0x46e4('140','\x72\x78\x79\x38'),'\x6f\x65\x47\x67\x49':function(_0xc2b80a,_0x26bb6c){return _0xc2b80a===_0x26bb6c;},'\x6e\x53\x6e\x4c\x72':_0x46e4('141','\x70\x38\x26\x32'),'\x73\x6a\x71\x58\x68':_0x46e4('142','\x41\x39\x75\x5d'),'\x6c\x56\x7a\x50\x73':function(_0x558d76,_0x469347){return _0x558d76===_0x469347;},'\x74\x54\x6b\x66\x74':_0x46e4('143','\x33\x57\x6a\x6e'),'\x49\x78\x79\x61\x6a':_0x46e4('144','\x66\x30\x6e\x36'),'\x54\x75\x68\x6c\x52':'\x47\x56\x56\x7a\x65','\x49\x70\x54\x72\x57':function(_0x51a8cb,_0x414215){return _0x51a8cb===_0x414215;},'\x6c\x6a\x6e\x65\x78':function(_0x27d456,_0x4ea28f){return _0x27d456===_0x4ea28f;},'\x62\x56\x76\x4d\x4d':'\x43\x4d\x75\x45\x57','\x59\x67\x51\x7a\x6c':'\x46\x79\x54\x46\x56','\x55\x6b\x67\x44\x53':_0x46e4('145','\x29\x62\x4f\x46')};var _0x10be40={};_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')]={};_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')]['\x74\x6f\x5f\x75\x74\x66\x38']=function to_utf8(_0x588a1a,_0x4e99ab){var _0x48c397={'\x53\x72\x63\x6e\x4b':_0x16b80a[_0x46e4('148','\x56\x46\x6f\x53')],'\x74\x64\x62\x62\x54':function(_0x4ea81c,_0x417743){return _0x16b80a[_0x46e4('149','\x68\x6a\x6e\x48')](_0x4ea81c,_0x417743);},'\x76\x76\x72\x58\x71':function(_0x1836c0,_0x4fbdf0){return _0x16b80a['\x57\x51\x78\x65\x59'](_0x1836c0,_0x4fbdf0);},'\x68\x48\x6e\x67\x6e':function(_0x578b10,_0x37db17){return _0x16b80a[_0x46e4('14a','\x62\x30\x58\x7a')](_0x578b10,_0x37db17);},'\x78\x44\x4c\x6a\x49':function(_0x52595f,_0x53de75){return _0x16b80a[_0x46e4('14b','\x72\x4c\x50\x55')](_0x52595f,_0x53de75);},'\x68\x4a\x6b\x61\x53':function(_0xf9f902,_0x57dd27){return _0x16b80a[_0x46e4('14c','\x53\x75\x72\x49')](_0xf9f902,_0x57dd27);},'\x51\x63\x43\x71\x6d':function(_0x4134c8,_0x57b2ae){return _0x16b80a[_0x46e4('14d','\x7a\x49\x4c\x57')](_0x4134c8,_0x57b2ae);},'\x73\x7a\x50\x6f\x61':_0x16b80a['\x44\x44\x6b\x70\x48']};var _0x5b2302=_0x10be40[_0x46e4('14e','\x6f\x64\x4f\x4b')];for(var _0x344e8e=0x0;_0x16b80a['\x67\x46\x70\x54\x73'](_0x344e8e,_0x588a1a['\x6c\x65\x6e\x67\x74\x68']);++_0x344e8e){var _0x4b1354=_0x588a1a['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x344e8e);if(_0x16b80a[_0x46e4('14f','\x70\x38\x26\x32')](_0x4b1354,0xd800)&&_0x16b80a['\x41\x48\x46\x73\x46'](_0x4b1354,0xdfff)){_0x4b1354=_0x16b80a[_0x46e4('150','\x66\x30\x6e\x36')](_0x16b80a[_0x46e4('151','\x44\x34\x74\x5a')](0x10000,_0x16b80a[_0x46e4('152','\x6f\x64\x4f\x4b')](_0x16b80a[_0x46e4('153','\x53\x75\x72\x49')](_0x4b1354,0x3ff),0xa)),_0x16b80a['\x76\x78\x78\x49\x42'](_0x588a1a['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x344e8e),0x3ff));}if(_0x16b80a[_0x46e4('154','\x28\x40\x4b\x38')](_0x4b1354,0x7f)){if(_0x16b80a[_0x46e4('155','\x6f\x64\x4f\x4b')](_0x16b80a[_0x46e4('156','\x4c\x58\x44\x78')],_0x16b80a['\x5a\x41\x42\x64\x54'])){var _0x3ba14c=_0x48c397['\x53\x72\x63\x6e\x4b']['\x73\x70\x6c\x69\x74']('\x7c'),_0x1aa646=0x0;while(!![]){switch(_0x3ba14c[_0x1aa646++]){case'\x30':var _0x168b04=_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')][_0x46e4('157','\x5b\x5a\x5d\x62')](_0x48c397[_0x46e4('158','\x69\x70\x48\x5b')](value_array_pointer,_0x48c397['\x76\x76\x72\x58\x71'](_0x344e8e,0x10)));continue;case'\x31':var _0x43733f=_0x10be40[_0x46e4('159','\x72\x78\x79\x38')][_0x48c397[_0x46e4('15a','\x70\x38\x26\x32')](_0x48c397['\x78\x44\x4c\x6a\x49'](key_array_pointer,_0x48c397[_0x46e4('15b','\x58\x75\x24\x6b')](_0x344e8e,0x8)),0x4)];continue;case'\x32':var _0x38e876=_0x10be40[_0x46e4('15c','\x4d\x4d\x4e\x2a')][_0x48c397[_0x46e4('15d','\x32\x6e\x21\x53')](_0x48c397['\x51\x63\x43\x71\x6d'](_0x48c397[_0x46e4('15e','\x63\x33\x5a\x28')](key_array_pointer,0x4),_0x48c397[_0x46e4('15f','\x34\x76\x6f\x4b')](_0x344e8e,0x8)),0x4)];continue;case'\x33':output[_0x53bec7]=_0x168b04;continue;case'\x34':var _0x53bec7=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('160','\x52\x58\x72\x37')](_0x43733f,_0x38e876);continue;}break;}}else{_0x5b2302[_0x4e99ab++]=_0x4b1354;}}else if(_0x16b80a[_0x46e4('161','\x33\x57\x6a\x6e')](_0x4b1354,0x7ff)){_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('162','\x29\x62\x4f\x46')](0xc0,_0x16b80a[_0x46e4('163','\x53\x75\x72\x49')](_0x4b1354,0x6));_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('164','\x77\x44\x30\x6d')](0x80,_0x16b80a[_0x46e4('165','\x52\x58\x72\x37')](_0x4b1354,0x3f));}else if(_0x16b80a['\x50\x6e\x4d\x79\x52'](_0x4b1354,0xffff)){if(_0x16b80a[_0x46e4('166','\x32\x6e\x21\x53')](_0x16b80a[_0x46e4('167','\x41\x36\x54\x33')],_0x16b80a[_0x46e4('168','\x4a\x35\x76\x75')])){_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('169','\x61\x4a\x54\x6a')](0xe0,_0x16b80a[_0x46e4('16a','\x76\x4c\x4a\x65')](_0x4b1354,0xc));_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('16b','\x62\x30\x58\x7a')](0x80,_0x16b80a['\x59\x64\x6b\x55\x66'](_0x16b80a['\x72\x4f\x58\x57\x6b'](_0x4b1354,0x6),0x3f));_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('16c','\x24\x29\x6c\x43')](0x80,_0x16b80a[_0x46e4('16d','\x25\x5b\x4b\x46')](_0x4b1354,0x3f));}else{var _0x570db8=_0x48c397['\x73\x7a\x50\x6f\x61'][_0x46e4('16e','\x33\x57\x6a\x6e')]('\x7c'),_0x18bf0d=0x0;while(!![]){switch(_0x570db8[_0x18bf0d++]){case'\x30':_0x15141f=new Int8Array(_0x3f1c29);continue;case'\x31':_0x3d0060=new Int16Array(_0x3f1c29);continue;case'\x32':_0x5b2302=new Uint8Array(_0x3f1c29);continue;case'\x33':_0x4be027=new Float32Array(_0x3f1c29);continue;case'\x34':_0x10be40[_0x46e4('16f','\x61\x4a\x54\x6a')]=_0x4972aa;continue;case'\x35':var _0x3f1c29=_0x10be40[_0x46e4('170','\x5b\x5a\x5d\x62')]['\x65\x78\x70\x6f\x72\x74\x73']['\x6d\x65\x6d\x6f\x72\x79'][_0x46e4('171','\x63\x33\x5a\x28')];continue;case'\x36':_0x10be40[_0x46e4('172','\x56\x46\x6f\x53')]=_0x1a2730;continue;case'\x37':_0x2cbd1a=new Uint16Array(_0x3f1c29);continue;case'\x38':_0x10be40[_0x46e4('173','\x7a\x49\x4c\x57')]=_0x15141f;continue;case'\x39':_0x10be40[_0x46e4('174','\x32\x6e\x21\x53')]=_0x2cbd1a;continue;case'\x31\x30':_0x4726dc=new Int32Array(_0x3f1c29);continue;case'\x31\x31':_0x10be40[_0x46e4('175','\x40\x71\x69\x37')]=_0x3d0060;continue;case'\x31\x32':_0x10be40[_0x46e4('176','\x79\x40\x49\x5e')]=_0x4726dc;continue;case'\x31\x33':_0x1a2730=new Float64Array(_0x3f1c29);continue;case'\x31\x34':_0x10be40['\x48\x45\x41\x50\x46\x33\x32']=_0x4be027;continue;case'\x31\x35':_0x4972aa=new Uint32Array(_0x3f1c29);continue;case'\x31\x36':_0x10be40['\x48\x45\x41\x50\x55\x38']=_0x5b2302;continue;}break;}}}else if(_0x16b80a[_0x46e4('177','\x59\x71\x40\x6f')](_0x4b1354,0x1fffff)){_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('178','\x29\x62\x4f\x46')](0xf0,_0x16b80a[_0x46e4('179','\x66\x30\x6e\x36')](_0x4b1354,0x12));_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('17a','\x58\x75\x24\x6b')](0x80,_0x16b80a[_0x46e4('17b','\x31\x53\x30\x76')](_0x16b80a[_0x46e4('17c','\x7a\x49\x4c\x57')](_0x4b1354,0xc),0x3f));_0x5b2302[_0x4e99ab++]=_0x16b80a['\x78\x76\x70\x4a\x74'](0x80,_0x16b80a[_0x46e4('17d','\x24\x29\x6c\x43')](_0x16b80a['\x47\x74\x65\x6e\x4e'](_0x4b1354,0x6),0x3f));_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('17e','\x51\x4a\x38\x73')](0x80,_0x16b80a['\x46\x41\x53\x6e\x58'](_0x4b1354,0x3f));}else if(_0x16b80a[_0x46e4('17f','\x69\x70\x48\x5b')](_0x4b1354,0x3ffffff)){var _0x2cc7af=_0x16b80a['\x44\x78\x42\x6a\x63'][_0x46e4('180','\x68\x6a\x6e\x48')]('\x7c'),_0x557727=0x0;while(!![]){switch(_0x2cc7af[_0x557727++]){case'\x30':_0x5b2302[_0x4e99ab++]=_0x16b80a['\x6a\x76\x75\x63\x53'](0xf8,_0x16b80a[_0x46e4('181','\x69\x70\x48\x5b')](_0x4b1354,0x18));continue;case'\x31':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('182','\x32\x6e\x21\x53')](0x80,_0x16b80a[_0x46e4('183','\x59\x71\x40\x6f')](_0x16b80a[_0x46e4('184','\x6f\x64\x4f\x4b')](_0x4b1354,0x12),0x3f));continue;case'\x32':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('185','\x63\x33\x5a\x28')](0x80,_0x16b80a[_0x46e4('186','\x73\x29\x55\x76')](_0x16b80a[_0x46e4('187','\x4a\x35\x76\x75')](_0x4b1354,0x6),0x3f));continue;case'\x33':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('188','\x4d\x4d\x4e\x2a')](0x80,_0x16b80a['\x4e\x68\x53\x70\x56'](_0x4b1354,0x3f));continue;case'\x34':_0x5b2302[_0x4e99ab++]=_0x16b80a['\x55\x65\x59\x4a\x62'](0x80,_0x16b80a[_0x46e4('189','\x72\x78\x79\x38')](_0x16b80a[_0x46e4('18a','\x53\x37\x4f\x54')](_0x4b1354,0xc),0x3f));continue;}break;}}else{if(_0x16b80a[_0x46e4('18b','\x33\x57\x6a\x6e')](_0x16b80a[_0x46e4('18c','\x34\x76\x6f\x4b')],_0x16b80a[_0x46e4('18d','\x5b\x5a\x5d\x62')])){var _0x18314d=_0x16b80a[_0x46e4('18e','\x41\x39\x75\x5d')][_0x46e4('18f','\x53\x75\x72\x49')]('\x7c'),_0x37a589=0x0;while(!![]){switch(_0x18314d[_0x37a589++]){case'\x30':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('190','\x5b\x5a\x5d\x62')](0x80,_0x16b80a[_0x46e4('191','\x66\x30\x6e\x36')](_0x16b80a['\x49\x6e\x61\x72\x6d'](_0x4b1354,0x18),0x3f));continue;case'\x31':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('192','\x62\x30\x58\x7a')](0x80,_0x16b80a['\x6b\x70\x4b\x55\x64'](_0x16b80a[_0x46e4('193','\x41\x39\x75\x5d')](_0x4b1354,0xc),0x3f));continue;case'\x32':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('194','\x73\x29\x55\x76')](0x80,_0x16b80a['\x6b\x70\x4b\x55\x64'](_0x16b80a[_0x46e4('195','\x44\x34\x74\x5a')](_0x4b1354,0x12),0x3f));continue;case'\x33':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('196','\x25\x5b\x4b\x46')](0x80,_0x16b80a['\x41\x70\x51\x71\x68'](_0x16b80a[_0x46e4('197','\x24\x29\x6c\x43')](_0x4b1354,0x6),0x3f));continue;case'\x34':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('198','\x28\x40\x4b\x38')](0x80,_0x16b80a['\x5a\x6b\x52\x66\x51'](_0x4b1354,0x3f));continue;case'\x35':_0x5b2302[_0x4e99ab++]=_0x16b80a[_0x46e4('199','\x28\x40\x4b\x38')](0xfc,_0x16b80a[_0x46e4('19a','\x7a\x49\x4c\x57')](_0x4b1354,0x1e));continue;}break;}}else{_0x10be40[_0x46e4('19b','\x33\x68\x52\x2a')][_0x48c397[_0x46e4('15e','\x63\x33\x5a\x28')](address,0xc)]=0x5;}}}};_0x10be40[_0x46e4('19c','\x51\x4a\x38\x73')]['\x6e\x6f\x6f\x70']=function(){};_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')][_0x46e4('19d','\x31\x79\x34\x67')]=function to_js(_0x1cdbd8){var _0x4aa525={'\x54\x46\x53\x54\x71':function(_0x40067f,_0x296526){return _0x16b80a['\x59\x4d\x4c\x57\x4d'](_0x40067f,_0x296526);},'\x77\x69\x66\x64\x6d':function(_0x581ca2,_0x3e805c){return _0x16b80a['\x64\x76\x6c\x7a\x42'](_0x581ca2,_0x3e805c);},'\x57\x53\x41\x54\x65':function(_0x2c1828,_0x28ac28){return _0x16b80a[_0x46e4('19e','\x44\x34\x74\x5a')](_0x2c1828,_0x28ac28);},'\x52\x54\x47\x6e\x59':function(_0x4a5d3e,_0x4cb377){return _0x16b80a['\x76\x6e\x49\x67\x67'](_0x4a5d3e,_0x4cb377);},'\x41\x48\x66\x56\x6e':function(_0x449133,_0x24447d){return _0x16b80a[_0x46e4('19f','\x59\x71\x40\x6f')](_0x449133,_0x24447d);},'\x69\x48\x42\x58\x51':_0x16b80a[_0x46e4('1a0','\x68\x6a\x6e\x48')],'\x58\x6b\x66\x6d\x56':function(_0x41f75b,_0x127e40){return _0x16b80a[_0x46e4('1a1','\x53\x37\x4f\x54')](_0x41f75b,_0x127e40);},'\x75\x41\x56\x77\x76':function(_0x326a22,_0x1198a6){return _0x16b80a['\x70\x6a\x55\x42\x4b'](_0x326a22,_0x1198a6);},'\x56\x6c\x79\x6a\x58':_0x16b80a[_0x46e4('1a2','\x31\x79\x34\x67')],'\x48\x66\x77\x76\x46':_0x16b80a[_0x46e4('1a3','\x69\x70\x48\x5b')],'\x48\x44\x4b\x6f\x5a':_0x16b80a[_0x46e4('1a4','\x38\x72\x36\x78')],'\x59\x6a\x73\x58\x68':_0x16b80a[_0x46e4('1a5','\x40\x64\x70\x29')],'\x4e\x4f\x61\x48\x49':_0x16b80a['\x48\x57\x77\x51\x62'],'\x73\x5a\x58\x48\x54':_0x16b80a[_0x46e4('1a6','\x76\x4c\x4a\x65')],'\x56\x71\x4b\x75\x56':function(_0x44a392,_0x4f434a){return _0x16b80a[_0x46e4('1a7','\x31\x79\x34\x67')](_0x44a392,_0x4f434a);},'\x76\x4d\x77\x4c\x47':function(_0x1f34b7,_0x3b7a17){return _0x16b80a[_0x46e4('1a8','\x28\x40\x4b\x38')](_0x1f34b7,_0x3b7a17);},'\x5a\x64\x71\x4e\x45':_0x16b80a['\x68\x78\x5a\x67\x47'],'\x58\x51\x78\x50\x66':_0x16b80a[_0x46e4('1a9','\x70\x6d\x21\x25')],'\x41\x45\x6f\x64\x57':_0x16b80a[_0x46e4('1aa','\x32\x6e\x21\x53')],'\x45\x76\x71\x71\x66':function(_0x132ecc,_0x1e4b0d){return _0x16b80a['\x4b\x4f\x75\x45\x6e'](_0x132ecc,_0x1e4b0d);},'\x71\x41\x4c\x6a\x55':function(_0x5a59d7,_0x56fbef){return _0x16b80a[_0x46e4('1ab','\x58\x75\x24\x6b')](_0x5a59d7,_0x56fbef);},'\x75\x6e\x45\x65\x76':function(_0x41bbcb,_0x1c6e1b){return _0x16b80a['\x69\x4a\x58\x4e\x66'](_0x41bbcb,_0x1c6e1b);},'\x64\x6e\x53\x6b\x4c':_0x16b80a[_0x46e4('1ac','\x52\x58\x72\x37')],'\x6f\x6d\x6e\x66\x59':_0x16b80a[_0x46e4('1ad','\x4a\x35\x76\x75')]};if(_0x16b80a[_0x46e4('1ae','\x28\x40\x4b\x38')](_0x16b80a[_0x46e4('1af','\x33\x68\x52\x2a')],_0x16b80a[_0x46e4('1b0','\x37\x49\x6b\x64')])){var _0x4ab1e2=_0x10be40[_0x46e4('1b1','\x68\x6a\x6e\x48')][_0x16b80a[_0x46e4('1b2','\x29\x62\x4f\x46')](_0x1cdbd8,0xc)];if(_0x16b80a[_0x46e4('1b3','\x61\x4a\x54\x6a')](_0x4ab1e2,0x0)){if(_0x16b80a[_0x46e4('1b4','\x59\x71\x40\x6f')](_0x16b80a[_0x46e4('1b5','\x62\x30\x58\x7a')],_0x16b80a[_0x46e4('1b6','\x68\x6a\x6e\x48')])){return undefined;}else{w=_0x5cc55d[index++];}}else if(_0x16b80a[_0x46e4('1b7','\x33\x57\x6a\x6e')](_0x4ab1e2,0x1)){return null;}else if(_0x16b80a['\x4b\x4f\x75\x45\x6e'](_0x4ab1e2,0x2)){return _0x10be40['\x48\x45\x41\x50\x33\x32'][_0x16b80a[_0x46e4('1b8','\x5a\x25\x21\x2a')](_0x1cdbd8,0x4)];}else if(_0x16b80a['\x4b\x4f\x75\x45\x6e'](_0x4ab1e2,0x3)){if(_0x16b80a['\x66\x7a\x73\x67\x66'](_0x16b80a[_0x46e4('1b9','\x5b\x5a\x5d\x62')],_0x16b80a[_0x46e4('1ba','\x70\x6d\x21\x25')])){r=_0x10be40[_0x46e4('1bb','\x24\x29\x6c\x43')][_0x46e4('1bc','\x76\x4c\x4a\x65')](r),_0x10be40[_0x46e4('1bd','\x5b\x5a\x5d\x62')][_0x46e4('1be','\x24\x29\x6c\x43')](t,0x248);}else{return _0x10be40[_0x46e4('1bf','\x53\x37\x4f\x54')][_0x16b80a['\x50\x56\x4a\x47\x79'](_0x1cdbd8,0x8)];}}else if(_0x16b80a[_0x46e4('1c0','\x4a\x35\x76\x75')](_0x4ab1e2,0x4)){if(_0x16b80a[_0x46e4('1c1','\x4c\x58\x44\x78')](_0x16b80a['\x47\x48\x50\x76\x58'],_0x16b80a[_0x46e4('1c2','\x38\x72\x36\x78')])){throw new ReferenceError(_0x16b80a[_0x46e4('1c3','\x73\x29\x55\x76')]);}else{var _0x54682e=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('1c4','\x68\x6a\x6e\x48')](_0x1cdbd8,0x4)];var _0x30317a=_0x10be40[_0x46e4('1c5','\x72\x4c\x50\x55')][_0x16b80a['\x50\x56\x4a\x47\x79'](_0x16b80a['\x74\x4f\x7a\x6b\x71'](_0x1cdbd8,0x4),0x4)];return _0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('1c6','\x61\x4a\x54\x6a')](_0x54682e,_0x30317a);}}else if(_0x16b80a['\x6b\x4f\x5a\x69\x4a'](_0x4ab1e2,0x5)){return![];}else if(_0x16b80a['\x42\x56\x4d\x55\x6b'](_0x4ab1e2,0x6)){if(_0x16b80a[_0x46e4('1c7','\x70\x38\x26\x32')](_0x16b80a[_0x46e4('1c8','\x61\x77\x34\x4d')],_0x16b80a[_0x46e4('1c9','\x70\x38\x26\x32')])){var _0x25b175=_0x16b80a[_0x46e4('1ca','\x6b\x6b\x51\x50')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x4e6f57=0x0;while(!![]){switch(_0x25b175[_0x4e6f57++]){case'\x30':var _0x4c68fb=[];continue;case'\x31':return _0x4c68fb;case'\x32':var _0x24bc06=_0x16b80a[_0x46e4('1cb','\x41\x39\x75\x5d')](_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('1cc','\x33\x68\x52\x2a')],_0x10be40[_0x46e4('1cd','\x24\x29\x6c\x43')][_0x16b80a[_0x46e4('1ce','\x61\x77\x34\x4d')](_0x1cdbd8,0x4)]);continue;case'\x33':var _0x3b7a7b=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('1cf','\x69\x70\x48\x5b')](_0x16b80a[_0x46e4('1d0','\x79\x40\x49\x5e')](_0x1cdbd8,0x4),0x4)];continue;case'\x34':for(var _0x3ba9de=0x0;_0x16b80a[_0x46e4('1d1','\x68\x6a\x6e\x48')](_0x3ba9de,_0x3b7a7b);++_0x3ba9de){_0x4c68fb[_0x46e4('1d2','\x77\x44\x30\x6d')](_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('1d4','\x51\x4a\x38\x73')](_0x16b80a['\x6a\x52\x4c\x5a\x4d'](_0x24bc06,_0x16b80a[_0x46e4('1d5','\x72\x4c\x50\x55')](_0x3ba9de,0x10))));}continue;}break;}}else{return!![];}}else if(_0x16b80a['\x4a\x67\x66\x6f\x62'](_0x4ab1e2,0x7)){var _0x26167f=_0x16b80a[_0x46e4('1d6','\x4d\x4d\x4e\x2a')][_0x46e4('18f','\x53\x75\x72\x49')]('\x7c'),_0x4820df=0x0;while(!![]){switch(_0x26167f[_0x4820df++]){case'\x30':return _0x5bc797;case'\x31':var _0x30317a=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('1d7','\x77\x44\x30\x6d')](_0x16b80a[_0x46e4('1d8','\x26\x2a\x42\x28')](_0x1cdbd8,0x4),0x4)];continue;case'\x32':for(var _0x17cced=0x0;_0x16b80a[_0x46e4('1d9','\x4a\x35\x76\x75')](_0x17cced,_0x30317a);++_0x17cced){_0x5bc797['\x70\x75\x73\x68'](_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('1da','\x31\x53\x30\x76')](_0x16b80a[_0x46e4('1db','\x69\x70\x48\x5b')](_0x54682e,_0x16b80a[_0x46e4('1dc','\x69\x70\x48\x5b')](_0x17cced,0x10))));}continue;case'\x33':var _0x54682e=_0x16b80a[_0x46e4('1dd','\x28\x40\x4b\x38')](_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('1de','\x31\x79\x34\x67')],_0x10be40[_0x46e4('1df','\x40\x71\x69\x37')][_0x16b80a[_0x46e4('1e0','\x79\x40\x49\x5e')](_0x1cdbd8,0x4)]);continue;case'\x34':var _0x5bc797=[];continue;}break;}}else if(_0x16b80a[_0x46e4('1e1','\x61\x4a\x54\x6a')](_0x4ab1e2,0x8)){var _0x88ec9e=_0x16b80a[_0x46e4('1e2','\x73\x29\x55\x76')][_0x46e4('1e3','\x41\x36\x54\x33')]('\x7c'),_0x1b4937=0x0;while(!![]){switch(_0x88ec9e[_0x1b4937++]){case'\x30':return _0x5bc797;case'\x31':var _0x496537=_0x10be40[_0x46e4('1e4','\x4a\x35\x76\x75')][_0x46e4('1cc','\x33\x68\x52\x2a')];continue;case'\x32':var _0x30317a=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a['\x55\x69\x58\x4c\x58'](_0x16b80a[_0x46e4('1b2','\x29\x62\x4f\x46')](_0x1cdbd8,0x4),0x4)];continue;case'\x33':for(var _0x17cced=0x0;_0x16b80a[_0x46e4('1e5','\x33\x68\x52\x2a')](_0x17cced,_0x30317a);++_0x17cced){var _0x245101=_0x16b80a['\x6b\x67\x75\x4e\x41'][_0x46e4('1e6','\x5a\x25\x21\x2a')]('\x7c'),_0x4af97d=0x0;while(!![]){switch(_0x245101[_0x4af97d++]){case'\x30':var _0x3e1663=_0x10be40[_0x46e4('1e7','\x51\x4a\x38\x73')][_0x16b80a[_0x46e4('1e8','\x40\x64\x70\x29')](_0x16b80a[_0x46e4('1e9','\x53\x75\x72\x49')](_0xd15c32,_0x16b80a['\x6f\x42\x62\x4e\x6d'](_0x17cced,0x8)),0x4)];continue;case'\x31':_0x5bc797[_0x498f93]=_0x486cbf;continue;case'\x32':var _0x498f93=_0x10be40[_0x46e4('1ea','\x68\x6a\x6e\x48')][_0x46e4('1eb','\x34\x76\x6f\x4b')](_0x3e1663,_0x481da8);continue;case'\x33':var _0x481da8=_0x10be40[_0x46e4('1ec','\x76\x4c\x4a\x65')][_0x16b80a[_0x46e4('1ed','\x31\x79\x34\x67')](_0x16b80a[_0x46e4('1ee','\x34\x76\x6f\x4b')](_0x16b80a[_0x46e4('1ef','\x6b\x6b\x51\x50')](_0xd15c32,0x4),_0x16b80a[_0x46e4('1f0','\x63\x33\x5a\x28')](_0x17cced,0x8)),0x4)];continue;case'\x34':var _0x486cbf=_0x10be40[_0x46e4('1f1','\x66\x30\x6e\x36')]['\x74\x6f\x5f\x6a\x73'](_0x16b80a[_0x46e4('1f2','\x38\x72\x36\x78')](_0x3c0963,_0x16b80a[_0x46e4('1f3','\x31\x53\x30\x76')](_0x17cced,0x10)));continue;}break;}}continue;case'\x34':var _0xd15c32=_0x16b80a['\x74\x4f\x7a\x6b\x71'](_0x496537,_0x10be40[_0x46e4('1f4','\x62\x30\x58\x7a')][_0x16b80a['\x48\x70\x6e\x63\x6b'](_0x16b80a[_0x46e4('1f5','\x4d\x4d\x4e\x2a')](_0x1cdbd8,0x8),0x4)]);continue;case'\x35':var _0x3c0963=_0x16b80a[_0x46e4('1f6','\x24\x29\x6c\x43')](_0x496537,_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a['\x48\x70\x6e\x63\x6b'](_0x1cdbd8,0x4)]);continue;case'\x36':var _0x5bc797={};continue;}break;}}else if(_0x16b80a[_0x46e4('1f7','\x40\x71\x69\x37')](_0x4ab1e2,0x9)){return _0x10be40[_0x46e4('19c','\x51\x4a\x38\x73')][_0x46e4('1f8','\x33\x68\x52\x2a')](_0x10be40[_0x46e4('1f9','\x53\x37\x4f\x54')][_0x16b80a[_0x46e4('1fa','\x63\x33\x5a\x28')](_0x1cdbd8,0x4)]);}else if(_0x16b80a['\x4a\x67\x66\x6f\x62'](_0x4ab1e2,0xa)||_0x16b80a[_0x46e4('1fb','\x44\x71\x42\x6e')](_0x4ab1e2,0xc)||_0x16b80a[_0x46e4('1fc','\x52\x58\x72\x37')](_0x4ab1e2,0xd)){var _0x4acce3=_0x10be40[_0x46e4('1df','\x40\x71\x69\x37')][_0x16b80a['\x47\x5a\x58\x76\x41'](_0x1cdbd8,0x4)];var _0x54682e=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('1fd','\x51\x4a\x38\x73')](_0x16b80a['\x54\x78\x65\x71\x51'](_0x1cdbd8,0x4),0x4)];var _0x1816e0=_0x10be40[_0x46e4('1c5','\x72\x4c\x50\x55')][_0x16b80a[_0x46e4('1fe','\x40\x71\x69\x37')](_0x16b80a[_0x46e4('1ff','\x72\x78\x79\x38')](_0x1cdbd8,0x8),0x4)];var _0x1b31d3=0x0;var _0x2166d8=![];var _0x5bc797=function(){var _0x3bae04={'\x56\x53\x79\x44\x67':_0x4aa525[_0x46e4('200','\x72\x78\x79\x38')]};if(_0x4aa525[_0x46e4('201','\x70\x38\x26\x32')](_0x54682e,0x0)||_0x4aa525['\x58\x6b\x66\x6d\x56'](_0x2166d8,!![])){if(_0x4aa525['\x75\x41\x56\x77\x76'](_0x4aa525['\x56\x6c\x79\x6a\x58'],_0x4aa525[_0x46e4('202','\x69\x70\x48\x5b')])){var _0x4a8974=_0x3bae04[_0x46e4('203','\x61\x4a\x54\x6a')][_0x46e4('204','\x44\x71\x42\x6e')]('\x7c'),_0x1bc8ee=0x0;while(!![]){switch(_0x4a8974[_0x1bc8ee++]){case'\x30':this[_0x46e4('205','\x72\x78\x79\x38')]=rsp[_0x46e4('206','\x4c\x58\x44\x78')][_0x46e4('207','\x25\x5b\x4b\x46')];continue;case'\x31':this[_0x46e4('208','\x4a\x35\x76\x75')]=rsp[_0x46e4('209','\x73\x29\x55\x76')]['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];continue;case'\x32':++this[_0x46e4('20a','\x7a\x49\x4c\x57')];continue;case'\x33':this[_0x46e4('20b','\x63\x33\x5a\x28')]=rsp[_0x46e4('20c','\x58\x75\x24\x6b')][_0x46e4('20d','\x38\x72\x36\x78')];continue;case'\x34':this[_0x46e4('20e','\x4d\x4d\x4e\x2a')]=rsp['\x64\x61\x74\x61'][_0x46e4('20f','\x44\x34\x74\x5a')];continue;}break;}}else{if(_0x4aa525['\x58\x6b\x66\x6d\x56'](_0x4ab1e2,0xa)){throw new ReferenceError(_0x4aa525[_0x46e4('210','\x44\x71\x42\x6e')]);}else if(_0x4aa525[_0x46e4('211','\x79\x40\x49\x5e')](_0x4ab1e2,0xc)){throw new ReferenceError(_0x4aa525[_0x46e4('212','\x32\x6e\x21\x53')]);}else{if(_0x4aa525['\x58\x6b\x66\x6d\x56'](_0x4aa525[_0x46e4('213','\x24\x29\x6c\x43')],_0x4aa525[_0x46e4('214','\x32\x6e\x21\x53')])){if(_0x4aa525['\x54\x46\x53\x54\x71'](_0x486cbf,_0x4aa525[_0x46e4('215','\x31\x79\x34\x67')](_0x486cbf,0x0))){_0x10be40[_0x46e4('216','\x59\x71\x40\x6f')][_0x4aa525['\x57\x53\x41\x54\x65'](_0x1cdbd8,0xc)]=0x2;_0x10be40['\x48\x45\x41\x50\x33\x32'][_0x4aa525[_0x46e4('217','\x58\x75\x24\x6b')](_0x1cdbd8,0x4)]=_0x486cbf;}else{_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x4aa525[_0x46e4('218','\x25\x5b\x4b\x46')](_0x1cdbd8,0xc)]=0x3;_0x10be40[_0x46e4('219','\x44\x34\x74\x5a')][_0x4aa525[_0x46e4('21a','\x5a\x25\x21\x2a')](_0x1cdbd8,0x8)]=_0x486cbf;}}else{throw new ReferenceError(_0x4aa525['\x73\x5a\x58\x48\x54']);}}}}var _0x3d4a5f=_0x54682e;if(_0x4aa525[_0x46e4('21b','\x5a\x25\x21\x2a')](_0x4ab1e2,0xd)){_0x5bc797['\x64\x72\x6f\x70']=_0x10be40[_0x46e4('21c','\x38\x72\x36\x78')][_0x46e4('21d','\x24\x29\x6c\x43')];_0x54682e=0x0;}if(_0x4aa525['\x76\x4d\x77\x4c\x47'](_0x1b31d3,0x0)){if(_0x4aa525[_0x46e4('21e','\x24\x29\x6c\x43')](_0x4aa525[_0x46e4('21f','\x33\x68\x52\x2a')],_0x4aa525[_0x46e4('220','\x29\x62\x4f\x46')])){id_to_ref_map[refid]=reference;id_to_refcount_map[refid]=0x1;}else{if(_0x4aa525[_0x46e4('221','\x66\x30\x6e\x36')](_0x4ab1e2,0xc)||_0x4aa525[_0x46e4('222','\x69\x70\x48\x5b')](_0x4ab1e2,0xd)){throw new ReferenceError(_0x4aa525[_0x46e4('223','\x61\x77\x34\x4d')]);}}}var _0x282c9d=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('224','\x70\x6d\x21\x25')](0x10);_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('225','\x41\x39\x75\x5d')](_0x282c9d,arguments);try{_0x1b31d3+=0x1;_0x10be40[_0x46e4('226','\x44\x71\x42\x6e')][_0x46e4('e1','\x76\x4c\x4a\x65')](_0x4aa525['\x41\x45\x6f\x64\x57'],_0x4acce3,[_0x3d4a5f,_0x282c9d]);_0x10be40[_0x46e4('1ea','\x68\x6a\x6e\x48')]['\x74\x6d\x70']=null;var _0x133f30=_0x10be40[_0x46e4('227','\x5a\x25\x21\x2a')][_0x46e4('228','\x62\x30\x58\x7a')];}finally{_0x1b31d3-=0x1;}if(_0x4aa525[_0x46e4('229','\x4d\x4d\x4e\x2a')](_0x2166d8,!![])&&_0x4aa525['\x45\x76\x71\x71\x66'](_0x1b31d3,0x0)){_0x5bc797[_0x46e4('22a','\x79\x40\x49\x5e')]();}return _0x133f30;};_0x5bc797['\x64\x72\x6f\x70']=function(){if(_0x4aa525[_0x46e4('22b','\x34\x76\x6f\x4b')](_0x1b31d3,0x0)){_0x2166d8=!![];return;}_0x5bc797['\x64\x72\x6f\x70']=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6e\x6f\x6f\x70'];var _0x408e13=_0x54682e;_0x54682e=0x0;if(_0x4aa525[_0x46e4('22c','\x56\x46\x6f\x53')](_0x408e13,0x0)){if(_0x4aa525[_0x46e4('22d','\x73\x29\x55\x76')](_0x4aa525[_0x46e4('22e','\x31\x53\x30\x76')],_0x4aa525[_0x46e4('22f','\x69\x70\x48\x5b')])){_0x10be40[_0x46e4('230','\x52\x58\x72\x37')][_0x46e4('231','\x58\x75\x24\x6b')]('\x76\x69',_0x1816e0,[_0x408e13]);}else{len+=0x3;}}};return _0x5bc797;}else if(_0x16b80a[_0x46e4('232','\x24\x29\x6c\x43')](_0x4ab1e2,0xe)){var _0xe7f410=_0x16b80a[_0x46e4('233','\x72\x4c\x50\x55')][_0x46e4('234','\x5b\x5a\x5d\x62')]('\x7c'),_0x40c16b=0x0;while(!![]){switch(_0xe7f410[_0x40c16b++]){case'\x30':var _0x26b1bd=_0x16b80a[_0x46e4('235','\x51\x4a\x38\x73')](_0x54682e,_0x30317a);continue;case'\x31':switch(_0x5a3f72){case 0x0:return _0x10be40[_0x46e4('236','\x66\x30\x6e\x36')][_0x46e4('237','\x69\x70\x48\x5b')](_0x54682e,_0x26b1bd);case 0x1:return _0x10be40[_0x46e4('238','\x72\x4c\x50\x55')][_0x46e4('239','\x26\x2a\x42\x28')](_0x54682e,_0x26b1bd);case 0x2:return _0x10be40[_0x46e4('23a','\x76\x4c\x4a\x65')][_0x46e4('23b','\x59\x71\x40\x6f')](_0x54682e,_0x26b1bd);case 0x3:return _0x10be40['\x48\x45\x41\x50\x31\x36'][_0x46e4('23c','\x4c\x58\x44\x78')](_0x54682e,_0x26b1bd);case 0x4:return _0x10be40[_0x46e4('23d','\x38\x72\x36\x78')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x54682e,_0x26b1bd);case 0x5:return _0x10be40[_0x46e4('23e','\x72\x78\x79\x38')][_0x46e4('23f','\x5a\x25\x21\x2a')](_0x54682e,_0x26b1bd);case 0x6:return _0x10be40[_0x46e4('240','\x29\x62\x4f\x46')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x54682e,_0x26b1bd);case 0x7:return _0x10be40[_0x46e4('241','\x37\x49\x6b\x64')][_0x46e4('23b','\x59\x71\x40\x6f')](_0x54682e,_0x26b1bd);}continue;case'\x32':var _0x30317a=_0x10be40[_0x46e4('159','\x72\x78\x79\x38')][_0x16b80a['\x71\x4e\x7a\x74\x6c'](_0x16b80a['\x50\x51\x64\x63\x4f'](_0x1cdbd8,0x4),0x4)];continue;case'\x33':var _0x5a3f72=_0x10be40[_0x46e4('242','\x41\x39\x75\x5d')][_0x16b80a[_0x46e4('243','\x40\x64\x70\x29')](_0x16b80a['\x50\x51\x64\x63\x4f'](_0x1cdbd8,0x8),0x4)];continue;case'\x34':var _0x54682e=_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a['\x47\x7a\x44\x7a\x6a'](_0x1cdbd8,0x4)];continue;}break;}}else if(_0x16b80a[_0x46e4('244','\x38\x72\x36\x78')](_0x4ab1e2,0xf)){if(_0x16b80a[_0x46e4('245','\x6b\x6b\x51\x50')](_0x16b80a[_0x46e4('246','\x32\x6e\x21\x53')],_0x16b80a[_0x46e4('247','\x6b\x6b\x51\x50')])){return _0x10be40[_0x46e4('248','\x31\x53\x30\x76')][_0x46e4('249','\x58\x75\x24\x6b')](_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a['\x47\x7a\x44\x7a\x6a'](_0x1cdbd8,0x4)]);}else{r=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('24a','\x4c\x58\x44\x78')](r),_0x10be40[_0x46e4('24b','\x53\x37\x4f\x54')][_0x46e4('24c','\x6b\x6b\x51\x50')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x46e4('24d','\x6b\x6b\x51\x50')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x556b46){return{'\x65\x72\x72\x6f\x72':_0x556b46,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}}else{var _0x1abb80=_0x10be40[_0x46e4('24e','\x72\x78\x79\x38')]['\x61\x6c\x6c\x6f\x63'](0x10);_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('24f','\x56\x46\x6f\x53')](_0x1abb80,_0x486cbf);return _0x1abb80;}};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('250','\x52\x58\x72\x37')]=function serialize_object(_0x49331c,_0x823172){if(_0x16b80a['\x6d\x67\x74\x4d\x77'](_0x16b80a['\x4c\x44\x6f\x6c\x6b'],_0x16b80a[_0x46e4('251','\x38\x72\x36\x78')])){var _0x3e9b40=_0x16b80a['\x6b\x4f\x49\x48\x7a'][_0x46e4('252','\x79\x40\x49\x5e')]('\x7c'),_0x12927e=0x0;while(!![]){switch(_0x3e9b40[_0x12927e++]){case'\x30':_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('253','\x4a\x35\x76\x75')](_0x16b80a[_0x46e4('254','\x76\x4c\x4a\x65')](_0x49331c,0x4),0x4)]=_0x1ad335;continue;case'\x31':var _0x1ad335=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x75\x74\x66\x38\x5f\x6c\x65\x6e'](_0x823172);continue;case'\x32':_0x10be40[_0x46e4('255','\x52\x58\x72\x37')][_0x16b80a[_0x46e4('256','\x68\x6a\x6e\x48')](_0x49331c,0x4)]=_0xd7fbde;continue;case'\x33':if(_0x16b80a[_0x46e4('257','\x40\x71\x69\x37')](_0x1ad335,0x0)){_0xd7fbde=_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('258','\x33\x57\x6a\x6e')](_0x1ad335);_0x10be40[_0x46e4('1bd','\x5b\x5a\x5d\x62')][_0x46e4('259','\x69\x70\x48\x5b')](_0x823172,_0xd7fbde);}continue;case'\x34':var _0xd7fbde=0x0;continue;}break;}}else{var _0x1c15f2=_0x16b80a['\x4a\x43\x45\x78\x6d'][_0x46e4('25a','\x70\x38\x26\x32')]('\x7c'),_0x31de0d=0x0;while(!![]){switch(_0x1c15f2[_0x31de0d++]){case'\x30':var _0x15be0d=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('25b','\x34\x76\x6f\x4b')](_0x16b80a['\x6f\x43\x66\x58\x71'](_0x11bd83,0x8));continue;case'\x31':var _0x4c074b=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('25c','\x59\x71\x40\x6f')](_0x16b80a['\x6f\x43\x66\x58\x71'](_0x11bd83,0x10));continue;case'\x32':_0x10be40[_0x46e4('25d','\x79\x40\x49\x5e')][_0x16b80a['\x4a\x6d\x47\x51\x50'](_0x49331c,0xc)]=0x8;continue;case'\x33':_0x10be40[_0x46e4('1f4','\x62\x30\x58\x7a')][_0x16b80a[_0x46e4('25e','\x33\x57\x6a\x6e')](_0x16b80a['\x71\x4c\x55\x44\x4f'](_0x49331c,0x4),0x4)]=_0x11bd83;continue;case'\x34':_0x10be40[_0x46e4('25f','\x70\x38\x26\x32')][_0x16b80a[_0x46e4('260','\x31\x79\x34\x67')](_0x16b80a[_0x46e4('261','\x63\x33\x5a\x28')](_0x49331c,0x8),0x4)]=_0x15be0d;continue;case'\x35':_0x10be40[_0x46e4('1f4','\x62\x30\x58\x7a')][_0x16b80a[_0x46e4('262','\x79\x40\x49\x5e')](_0x49331c,0x4)]=_0x4c074b;continue;case'\x36':var _0x11bd83=_0x2074c2['\x6c\x65\x6e\x67\x74\x68'];continue;case'\x37':for(var _0x20e608=0x0;_0x16b80a['\x61\x42\x4b\x6a\x72'](_0x20e608,_0x11bd83);++_0x20e608){var _0x23260c=_0x2074c2[_0x20e608];var _0x24161e=_0x16b80a['\x6a\x61\x62\x64\x6a'](_0x15be0d,_0x16b80a[_0x46e4('263','\x7a\x49\x4c\x57')](_0x20e608,0x8));_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('264','\x43\x75\x73\x50')](_0x24161e,_0x23260c);_0x10be40[_0x46e4('265','\x41\x36\x54\x33')][_0x46e4('266','\x72\x4c\x50\x55')](_0x16b80a[_0x46e4('267','\x56\x46\x6f\x53')](_0x4c074b,_0x16b80a[_0x46e4('268','\x77\x44\x30\x6d')](_0x20e608,0x10)),_0x823172[_0x23260c]);}continue;case'\x38':var _0x2074c2=Object['\x6b\x65\x79\x73'](_0x823172);continue;}break;}}};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79']=function serialize_array(_0x23878e,_0x4755f7){if(_0x16b80a[_0x46e4('269','\x5a\x25\x21\x2a')](_0x16b80a[_0x46e4('26a','\x38\x72\x36\x78')],_0x16b80a['\x67\x68\x62\x59\x56'])){if(HeartGift[_0x46e4('26b','\x76\x4c\x4a\x65')]){console[_0x46e4('99','\x53\x37\x4f\x54')](_0x46e4('26c','\x34\x76\x6f\x4b'));HeartGift[_0x46e4('26d','\x41\x39\x75\x5d')]=![];_0x16b80a[_0x46e4('26e','\x44\x34\x74\x5a')](runTomorrow,HeartGift['\x72\x75\x6e']);}}else{var _0x2e4688=_0x16b80a[_0x46e4('26f','\x53\x37\x4f\x54')][_0x46e4('270','\x73\x29\x55\x76')]('\x7c'),_0x3205b3=0x0;while(!![]){switch(_0x2e4688[_0x3205b3++]){case'\x30':_0x10be40[_0x46e4('271','\x56\x46\x6f\x53')][_0x16b80a[_0x46e4('272','\x5b\x5a\x5d\x62')](_0x23878e,0x4)]=_0x6e7197;continue;case'\x31':_0x10be40[_0x46e4('273','\x61\x4a\x54\x6a')][_0x16b80a['\x53\x61\x79\x63\x70'](_0x23878e,0xc)]=0x7;continue;case'\x32':for(var _0x1316b9=0x0;_0x16b80a['\x51\x4a\x42\x53\x59'](_0x1316b9,_0x3744fc);++_0x1316b9){_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x16b80a[_0x46e4('274','\x4d\x4d\x4e\x2a')](_0x6e7197,_0x16b80a[_0x46e4('275','\x6f\x64\x4f\x4b')](_0x1316b9,0x10)),_0x4755f7[_0x1316b9]);}continue;case'\x33':_0x10be40[_0x46e4('276','\x73\x29\x55\x76')][_0x16b80a[_0x46e4('277','\x38\x72\x36\x78')](_0x16b80a[_0x46e4('278','\x77\x44\x30\x6d')](_0x23878e,0x4),0x4)]=_0x3744fc;continue;case'\x34':var _0x6e7197=_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('279','\x53\x75\x72\x49')](_0x16b80a[_0x46e4('27a','\x24\x29\x6c\x43')](_0x3744fc,0x10));continue;case'\x35':var _0x3744fc=_0x4755f7['\x6c\x65\x6e\x67\x74\x68'];continue;}break;}}};var _0x110faa=_0x16b80a[_0x46e4('27b','\x4a\x35\x76\x75')](typeof TextEncoder,_0x16b80a[_0x46e4('27c','\x5a\x25\x21\x2a')])?new TextEncoder(_0x16b80a[_0x46e4('27d','\x53\x37\x4f\x54')]):_0x16b80a[_0x46e4('27e','\x52\x58\x72\x37')](typeof util,_0x16b80a['\x74\x54\x6b\x66\x74'])&&util&&_0x16b80a[_0x46e4('27f','\x73\x29\x55\x76')](typeof util[_0x46e4('280','\x69\x70\x48\x5b')],_0x16b80a[_0x46e4('281','\x4c\x58\x44\x78')])?new util[(_0x46e4('282','\x38\x72\x36\x78'))](_0x16b80a['\x73\x6a\x71\x58\x68']):null;if(_0x16b80a[_0x46e4('283','\x66\x30\x6e\x36')](_0x110faa,null)){_0x10be40[_0x46e4('284','\x25\x5b\x4b\x46')][_0x46e4('285','\x69\x70\x48\x5b')]=function to_utf8_string(_0x45c308,_0x8968d2){if(_0x16b80a['\x69\x4a\x58\x4e\x66'](_0x16b80a[_0x46e4('286','\x25\x5b\x4b\x46')],_0x16b80a['\x74\x5a\x75\x49\x4a'])){return _0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('287','\x63\x33\x5a\x28')][id];}else{var _0x21e033=_0x16b80a['\x57\x6d\x63\x71\x57'][_0x46e4('288','\x40\x71\x69\x37')]('\x7c'),_0x9b4a5a=0x0;while(!![]){switch(_0x21e033[_0x9b4a5a++]){case'\x30':var _0x2816f9=_0x159eaf[_0x46e4('289','\x5b\x5a\x5d\x62')];continue;case'\x31':_0x10be40[_0x46e4('28a','\x66\x30\x6e\x36')][_0x16b80a[_0x46e4('28b','\x51\x4a\x38\x73')](_0x16b80a[_0x46e4('28c','\x40\x71\x69\x37')](_0x45c308,0x4),0x4)]=_0x2816f9;continue;case'\x32':if(_0x16b80a[_0x46e4('28d','\x63\x33\x5a\x28')](_0x2816f9,0x0)){_0x320fde=_0x10be40[_0x46e4('28e','\x69\x70\x48\x5b')][_0x46e4('28f','\x7a\x49\x4c\x57')](_0x2816f9);_0x10be40[_0x46e4('290','\x77\x44\x30\x6d')]['\x73\x65\x74'](_0x159eaf,_0x320fde);}continue;case'\x33':var _0x159eaf=_0x110faa[_0x46e4('291','\x41\x39\x75\x5d')](_0x8968d2);continue;case'\x34':var _0x320fde=0x0;continue;case'\x35':_0x10be40[_0x46e4('292','\x59\x71\x40\x6f')][_0x16b80a['\x56\x4a\x44\x6e\x53'](_0x45c308,0x4)]=_0x320fde;continue;}break;}}};}else{if(_0x16b80a[_0x46e4('293','\x56\x46\x6f\x53')](_0x16b80a['\x49\x78\x79\x61\x6a'],_0x16b80a[_0x46e4('294','\x4a\x35\x76\x75')])){_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('295','\x79\x40\x49\x5e')]=function to_utf8_string(_0x354868,_0x4c4e94){var _0x3a27eb=_0x16b80a[_0x46e4('296','\x63\x33\x5a\x28')][_0x46e4('16e','\x33\x57\x6a\x6e')]('\x7c'),_0x4b6d60=0x0;while(!![]){switch(_0x3a27eb[_0x4b6d60++]){case'\x30':_0x10be40[_0x46e4('297','\x77\x44\x30\x6d')][_0x16b80a[_0x46e4('298','\x72\x78\x79\x38')](_0x16b80a['\x71\x74\x7a\x5a\x49'](_0x354868,0x4),0x4)]=_0x5e8734;continue;case'\x31':_0x10be40[_0x46e4('299','\x43\x75\x73\x50')][_0x16b80a[_0x46e4('29a','\x41\x36\x54\x33')](_0x354868,0x4)]=_0x5a9c4f;continue;case'\x32':if(_0x16b80a[_0x46e4('29b','\x59\x71\x40\x6f')](_0x5e8734,0x0)){_0x5a9c4f=_0x10be40[_0x46e4('19c','\x51\x4a\x38\x73')][_0x46e4('29c','\x56\x46\x6f\x53')](_0x5e8734);_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('29d','\x72\x78\x79\x38')](_0x4c4e94,_0x5a9c4f);}continue;case'\x33':var _0x5a9c4f=0x0;continue;case'\x34':var _0x5e8734=_0x10be40[_0x46e4('19c','\x51\x4a\x38\x73')]['\x75\x74\x66\x38\x5f\x6c\x65\x6e'](_0x4c4e94);continue;}break;}};}else{var _0x1d0ffd=_0x10be40[_0x46e4('1c5','\x72\x4c\x50\x55')][_0x16b80a['\x72\x4c\x43\x70\x4a'](address,0x4)];var _0x2b1a24=_0x10be40[_0x46e4('29e','\x61\x77\x34\x4d')][_0x16b80a[_0x46e4('29f','\x28\x40\x4b\x38')](_0x16b80a[_0x46e4('2a0','\x44\x34\x74\x5a')](address,0x4),0x4)];return _0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('2a1','\x24\x29\x6c\x43')](_0x1d0ffd,_0x2b1a24);}}_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')][_0x46e4('2a2','\x66\x30\x6e\x36')]=function from_js(_0xa318a1,_0x481c9e){var _0x1a9dc8=Object['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65']['\x74\x6f\x53\x74\x72\x69\x6e\x67'][_0x46e4('2a3','\x31\x79\x34\x67')](_0x481c9e);if(_0x16b80a['\x6d\x67\x74\x4d\x77'](_0x1a9dc8,_0x16b80a[_0x46e4('2a4','\x61\x77\x34\x4d')])){if(_0x16b80a[_0x46e4('2a5','\x44\x34\x74\x5a')](_0x16b80a[_0x46e4('2a6','\x59\x71\x40\x6f')],_0x16b80a[_0x46e4('2a7','\x77\x44\x30\x6d')])){_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x16b80a[_0x46e4('2a8','\x32\x6e\x21\x53')](_0xa318a1,0xc)]=0x4;_0x10be40[_0x46e4('2a9','\x29\x62\x4f\x46')][_0x46e4('2aa','\x6b\x6b\x51\x50')](_0xa318a1,_0x481c9e);}else{var _0x2be222=_0x16b80a['\x68\x46\x50\x4a\x50']['\x73\x70\x6c\x69\x74']('\x7c'),_0xf5fb24=0x0;while(!![]){switch(_0x2be222[_0xf5fb24++]){case'\x30':if(_0x16b80a[_0x46e4('2ab','\x76\x4c\x4a\x65')](num_ongoing_calls,0x0)){drop_queued=!![];return;}continue;case'\x31':if(_0x16b80a[_0x46e4('2ac','\x43\x75\x73\x50')](_0x5f59c1,0x0)){_0x10be40[_0x46e4('2ad','\x34\x76\x6f\x4b')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',deallocator_pointer,[_0x5f59c1]);}continue;case'\x32':pointer=0x0;continue;case'\x33':output[_0x46e4('2ae','\x40\x71\x69\x37')]=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6e\x6f\x6f\x70'];continue;case'\x34':var _0x5f59c1=pointer;continue;}break;}}}else if(_0x16b80a['\x46\x45\x4e\x6d\x4a'](_0x1a9dc8,_0x16b80a[_0x46e4('2af','\x53\x75\x72\x49')])){if(_0x16b80a[_0x46e4('2b0','\x4d\x4d\x4e\x2a')](_0x481c9e,_0x16b80a[_0x46e4('2b1','\x25\x5b\x4b\x46')](_0x481c9e,0x0))){if(_0x16b80a[_0x46e4('2b2','\x51\x4a\x38\x73')](_0x16b80a['\x64\x4b\x6e\x6e\x7a'],_0x16b80a[_0x46e4('2b3','\x68\x6a\x6e\x48')])){_0x10be40[_0x46e4('14e','\x6f\x64\x4f\x4b')][_0x16b80a['\x4f\x58\x6c\x42\x4c'](_0xa318a1,0xc)]=0x2;_0x10be40[_0x46e4('2b4','\x44\x71\x42\x6e')][_0x16b80a[_0x46e4('2b5','\x26\x2a\x42\x28')](_0xa318a1,0x4)]=_0x481c9e;}else{var _0x510de3=_0x16b80a[_0x46e4('2b6','\x56\x46\x6f\x53')][_0x46e4('2b7','\x61\x77\x34\x4d')]('\x7c'),_0x24e3eb=0x0;while(!![]){switch(_0x510de3[_0x24e3eb++]){case'\x30':_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x16b80a[_0x46e4('2b8','\x51\x4a\x38\x73')](_0x16b80a[_0x46e4('2b9','\x6f\x64\x4f\x4b')](_0xa318a1,0x8),0x4)]=_0xfe751e;continue;case'\x31':var _0x38838e=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('29c','\x56\x46\x6f\x53')](_0x16b80a[_0x46e4('2ba','\x73\x29\x55\x76')](_0x330f7e,0x10));continue;case'\x32':for(var _0x3edb9d=0x0;_0x16b80a['\x6b\x4f\x68\x47\x4f'](_0x3edb9d,_0x330f7e);++_0x3edb9d){var _0x409e2a=_0x3f48cc[_0x3edb9d];var _0x52e379=_0x16b80a['\x65\x6a\x63\x59\x79'](_0xfe751e,_0x16b80a['\x52\x6b\x43\x57\x6b'](_0x3edb9d,0x8));_0x10be40[_0x46e4('2bb','\x63\x33\x5a\x28')][_0x46e4('2bc','\x59\x71\x40\x6f')](_0x52e379,_0x409e2a);_0x10be40[_0x46e4('2bd','\x6b\x6b\x51\x50')][_0x46e4('2be','\x61\x77\x34\x4d')](_0x16b80a[_0x46e4('2bf','\x4c\x58\x44\x78')](_0x38838e,_0x16b80a['\x69\x64\x77\x63\x74'](_0x3edb9d,0x10)),_0x481c9e[_0x409e2a]);}continue;case'\x33':_0x10be40[_0x46e4('2c0','\x41\x36\x54\x33')][_0x16b80a[_0x46e4('2c1','\x51\x4a\x38\x73')](_0xa318a1,0xc)]=0x8;continue;case'\x34':var _0xfe751e=_0x10be40[_0x46e4('2c2','\x33\x68\x52\x2a')][_0x46e4('2c3','\x79\x40\x49\x5e')](_0x16b80a[_0x46e4('2c4','\x44\x34\x74\x5a')](_0x330f7e,0x8));continue;case'\x35':var _0x330f7e=_0x3f48cc[_0x46e4('2c5','\x52\x58\x72\x37')];continue;case'\x36':_0x10be40[_0x46e4('255','\x52\x58\x72\x37')][_0x16b80a[_0x46e4('2c6','\x52\x58\x72\x37')](_0x16b80a[_0x46e4('2c7','\x77\x44\x30\x6d')](_0xa318a1,0x4),0x4)]=_0x330f7e;continue;case'\x37':var _0x3f48cc=Object['\x6b\x65\x79\x73'](_0x481c9e);continue;case'\x38':_0x10be40[_0x46e4('2c8','\x28\x40\x4b\x38')][_0x16b80a['\x46\x50\x69\x66\x56'](_0xa318a1,0x4)]=_0x38838e;continue;}break;}}}else{_0x10be40[_0x46e4('2c9','\x24\x29\x6c\x43')][_0x16b80a['\x4f\x58\x6c\x42\x4c'](_0xa318a1,0xc)]=0x3;_0x10be40[_0x46e4('2ca','\x33\x57\x6a\x6e')][_0x16b80a[_0x46e4('2cb','\x34\x76\x6f\x4b')](_0xa318a1,0x8)]=_0x481c9e;}}else if(_0x16b80a[_0x46e4('2b0','\x4d\x4d\x4e\x2a')](_0x481c9e,null)){if(_0x16b80a['\x46\x45\x4e\x6d\x4a'](_0x16b80a[_0x46e4('2cc','\x5b\x5a\x5d\x62')],_0x16b80a[_0x46e4('2cd','\x61\x77\x34\x4d')])){_0x10be40[_0x46e4('216','\x59\x71\x40\x6f')][_0x16b80a['\x4f\x58\x6c\x42\x4c'](_0xa318a1,0xc)]=0x1;}else{delete _0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('2ce','\x25\x5b\x4b\x46')][_0x9c49a6];}}else if(_0x16b80a[_0x46e4('2cf','\x56\x46\x6f\x53')](_0x481c9e,undefined)){_0x10be40[_0x46e4('2c9','\x24\x29\x6c\x43')][_0x16b80a[_0x46e4('2d0','\x40\x71\x69\x37')](_0xa318a1,0xc)]=0x0;}else if(_0x16b80a[_0x46e4('2d1','\x41\x36\x54\x33')](_0x481c9e,![])){_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x16b80a[_0x46e4('2d2','\x58\x75\x24\x6b')](_0xa318a1,0xc)]=0x5;}else if(_0x16b80a['\x6b\x6f\x72\x69\x53'](_0x481c9e,!![])){_0x10be40[_0x46e4('2d3','\x44\x34\x74\x5a')][_0x16b80a[_0x46e4('2d4','\x28\x40\x4b\x38')](_0xa318a1,0xc)]=0x6;}else if(_0x16b80a['\x6b\x6f\x72\x69\x53'](_0x1a9dc8,_0x16b80a[_0x46e4('2d5','\x70\x38\x26\x32')])){var _0x9c49a6=_0x10be40[_0x46e4('227','\x5a\x25\x21\x2a')][_0x46e4('2d6','\x29\x62\x4f\x46')](_0x481c9e);_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x16b80a[_0x46e4('2d7','\x70\x6d\x21\x25')](_0xa318a1,0xc)]=0xf;_0x10be40['\x48\x45\x41\x50\x33\x32'][_0x16b80a[_0x46e4('2d8','\x70\x6d\x21\x25')](_0xa318a1,0x4)]=_0x9c49a6;}else{var _0xeb650b=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('2d9','\x51\x4a\x38\x73')](_0x481c9e);_0x10be40[_0x46e4('2da','\x28\x40\x4b\x38')][_0x16b80a[_0x46e4('2db','\x51\x4a\x38\x73')](_0xa318a1,0xc)]=0x9;_0x10be40[_0x46e4('2dc','\x44\x34\x74\x5a')][_0x16b80a[_0x46e4('2dd','\x37\x49\x6b\x64')](_0xa318a1,0x4)]=_0xeb650b;}};var _0x491d28=_0x16b80a[_0x46e4('2de','\x77\x44\x30\x6d')](typeof TextDecoder,_0x16b80a[_0x46e4('2df','\x61\x77\x34\x4d')])?new TextDecoder(_0x16b80a['\x73\x6a\x71\x58\x68']):_0x16b80a[_0x46e4('2e0','\x79\x40\x49\x5e')](typeof util,_0x16b80a[_0x46e4('2e1','\x53\x37\x4f\x54')])&&util&&_0x16b80a[_0x46e4('2e2','\x33\x57\x6a\x6e')](typeof util[_0x46e4('2e3','\x41\x36\x54\x33')],_0x16b80a[_0x46e4('2df','\x61\x77\x34\x4d')])?new util['\x54\x65\x78\x74\x44\x65\x63\x6f\x64\x65\x72'](_0x16b80a['\x73\x6a\x71\x58\x68']):null;if(_0x16b80a[_0x46e4('2e4','\x38\x72\x36\x78')](_0x491d28,null)){_0x10be40[_0x46e4('248','\x31\x53\x30\x76')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x370d70,_0x155eb3){return _0x491d28[_0x46e4('2e5','\x31\x79\x34\x67')](_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x46e4('2e6','\x33\x57\x6a\x6e')](_0x370d70,_0x16b80a[_0x46e4('2e7','\x28\x40\x4b\x38')](_0x370d70,_0x155eb3)));};}else{if(_0x16b80a[_0x46e4('2e8','\x41\x36\x54\x33')](_0x16b80a['\x62\x56\x76\x4d\x4d'],_0x16b80a[_0x46e4('2e9','\x34\x76\x6f\x4b')])){_0x10be40[_0x46e4('230','\x52\x58\x72\x37')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x3a2f1c,_0x51423a){var _0x1deacc=_0x16b80a[_0x46e4('2ea','\x53\x75\x72\x49')][_0x46e4('2eb','\x44\x34\x74\x5a')]('\x7c'),_0xcf5cf9=0x0;while(!![]){switch(_0x1deacc[_0xcf5cf9++]){case'\x30':_0x3a2f1c=_0x16b80a[_0x46e4('2ec','\x70\x38\x26\x32')](_0x3a2f1c,0x0);continue;case'\x31':while(_0x16b80a[_0x46e4('2ed','\x6f\x64\x4f\x4b')](_0x3a2f1c,_0x1c7f8f)){if(_0x16b80a[_0x46e4('2ee','\x73\x29\x55\x76')](_0x16b80a[_0x46e4('2ef','\x44\x71\x42\x6e')],_0x16b80a[_0x46e4('2f0','\x69\x70\x48\x5b')])){var _0x4bfb89=_0x29e6d8[_0x3a2f1c++];if(_0x16b80a['\x50\x75\x50\x73\x75'](_0x4bfb89,0x80)){if(_0x16b80a[_0x46e4('2f1','\x4d\x4d\x4e\x2a')](_0x16b80a['\x68\x4d\x48\x6b\x6e'],_0x16b80a['\x62\x68\x67\x48\x62'])){_0x56eff9+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x4bfb89);continue;}else{try{return{'\x76\x61\x6c\x75\x65':r[_0x46e4('2f2','\x58\x75\x24\x6b')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x17e867){return{'\x65\x72\x72\x6f\x72':_0x17e867,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}var _0x3ddb58=_0x16b80a['\x54\x79\x73\x70\x50'](_0x4bfb89,_0x16b80a[_0x46e4('2f3','\x73\x29\x55\x76')](0x7f,0x2));var _0x590bc2=0x0;if(_0x16b80a['\x50\x75\x50\x73\x75'](_0x3a2f1c,_0x1c7f8f)){_0x590bc2=_0x29e6d8[_0x3a2f1c++];}var _0xb156c2=_0x16b80a[_0x46e4('2f4','\x59\x71\x40\x6f')](_0x16b80a[_0x46e4('2f5','\x53\x75\x72\x49')](_0x3ddb58,0x6),_0x16b80a['\x54\x79\x73\x70\x50'](_0x590bc2,0x3f));if(_0x16b80a[_0x46e4('2f6','\x40\x71\x69\x37')](_0x4bfb89,0xe0)){var _0x333a7b=0x0;if(_0x16b80a[_0x46e4('2f7','\x24\x29\x6c\x43')](_0x3a2f1c,_0x1c7f8f)){_0x333a7b=_0x29e6d8[_0x3a2f1c++];}var _0x525203=_0x16b80a[_0x46e4('2f8','\x5b\x5a\x5d\x62')](_0x16b80a['\x47\x62\x41\x4e\x73'](_0x16b80a['\x75\x42\x6f\x6d\x78'](_0x590bc2,0x3f),0x6),_0x16b80a['\x77\x68\x6c\x72\x64'](_0x333a7b,0x3f));_0xb156c2=_0x16b80a['\x54\x49\x4a\x54\x67'](_0x16b80a['\x47\x62\x41\x4e\x73'](_0x3ddb58,0xc),_0x525203);if(_0x16b80a[_0x46e4('2f9','\x69\x70\x48\x5b')](_0x4bfb89,0xf0)){var _0xa4882c=0x0;if(_0x16b80a[_0x46e4('2fa','\x44\x34\x74\x5a')](_0x3a2f1c,_0x1c7f8f)){if(_0x16b80a[_0x46e4('2fb','\x31\x53\x30\x76')](_0x16b80a[_0x46e4('2fc','\x72\x4c\x50\x55')],_0x16b80a[_0x46e4('2fd','\x72\x4c\x50\x55')])){return{'\x76\x61\x6c\x75\x65':r['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0xa4882c=_0x29e6d8[_0x3a2f1c++];}}_0xb156c2=_0x16b80a[_0x46e4('2fe','\x77\x44\x30\x6d')](_0x16b80a['\x47\x62\x41\x4e\x73'](_0x16b80a[_0x46e4('2ff','\x4a\x35\x76\x75')](_0x3ddb58,0x7),0x12),_0x16b80a['\x54\x49\x4a\x54\x67'](_0x16b80a['\x6e\x6f\x70\x6e\x52'](_0x525203,0x6),_0x16b80a[_0x46e4('300','\x25\x5b\x4b\x46')](_0xa4882c,0x3f)));_0x56eff9+=String[_0x46e4('301','\x31\x79\x34\x67')](_0x16b80a[_0x46e4('302','\x66\x30\x6e\x36')](0xd7c0,_0x16b80a['\x49\x73\x6c\x72\x7a'](_0xb156c2,0xa)));_0xb156c2=_0x16b80a[_0x46e4('303','\x40\x71\x69\x37')](0xdc00,_0x16b80a[_0x46e4('304','\x24\x29\x6c\x43')](_0xb156c2,0x3ff));}}_0x56eff9+=String[_0x46e4('305','\x53\x75\x72\x49')](_0xb156c2);continue;}else{refid=_0x10be40[_0x46e4('306','\x73\x29\x55\x76')]['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{ref_to_id_map['\x73\x65\x74'](reference,refid);}catch(_0x337211){ref_to_id_map_fallback[_0x46e4('307','\x66\x30\x6e\x36')](reference,refid);}}}continue;case'\x32':return _0x56eff9;case'\x33':var _0x1c7f8f=_0x16b80a[_0x46e4('308','\x70\x38\x26\x32')](_0x16b80a['\x54\x49\x4a\x54\x67'](_0x3a2f1c,0x0),_0x16b80a['\x43\x6a\x73\x6c\x68'](_0x51423a,0x0));continue;case'\x34':var _0x29e6d8=_0x10be40[_0x46e4('2da','\x28\x40\x4b\x38')];continue;case'\x35':var _0x56eff9='';continue;case'\x36':_0x51423a=_0x16b80a[_0x46e4('309','\x31\x53\x30\x76')](_0x51423a,0x0);continue;}break;}};}else{throw console[_0x46e4('30a','\x41\x36\x54\x33')](_0x16b80a['\x56\x55\x62\x50\x45'],t),t;}}_0x10be40[_0x46e4('30b','\x41\x39\x75\x5d')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70']={};_0x10be40[_0x46e4('21c','\x38\x72\x36\x78')][_0x46e4('30c','\x4d\x4d\x4e\x2a')]={};_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('30d','\x72\x78\x79\x38')]=new WeakMap();_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('30e','\x44\x71\x42\x6e')]=new Map();_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('30f','\x34\x76\x6f\x4b')]=0x1;_0x10be40[_0x46e4('24b','\x53\x37\x4f\x54')][_0x46e4('310','\x32\x6e\x21\x53')]={};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']=0x1;_0x10be40[_0x46e4('311','\x79\x40\x49\x5e')][_0x46e4('312','\x44\x34\x74\x5a')]=function(_0x11f556){var _0x5f5487={'\x52\x71\x75\x58\x54':function(_0x40c6c3,_0x5470b9){return _0x16b80a[_0x46e4('313','\x69\x70\x48\x5b')](_0x40c6c3,_0x5470b9);},'\x49\x78\x45\x42\x5a':_0x16b80a[_0x46e4('314','\x5b\x5a\x5d\x62')],'\x7a\x6b\x6b\x65\x7a':_0x16b80a[_0x46e4('315','\x61\x4a\x54\x6a')]};if(_0x16b80a[_0x46e4('316','\x7a\x49\x4c\x57')](_0x16b80a[_0x46e4('317','\x72\x4c\x50\x55')],_0x16b80a[_0x46e4('318','\x24\x29\x6c\x43')])){if(_0x16b80a[_0x46e4('319','\x5b\x5a\x5d\x62')](_0x11f556,undefined)||_0x16b80a[_0x46e4('31a','\x56\x46\x6f\x53')](_0x11f556,null)){return 0x0;}var _0x2f25ec=_0x10be40[_0x46e4('28e','\x69\x70\x48\x5b')][_0x46e4('31b','\x70\x38\x26\x32')];var _0x3e4091=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('31c','\x61\x4a\x54\x6a')];var _0x378c76=_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')][_0x46e4('31d','\x44\x71\x42\x6e')];var _0x7640f8=_0x10be40[_0x46e4('31e','\x72\x4c\x50\x55')][_0x46e4('31f','\x38\x72\x36\x78')];var _0xb64f75=_0x378c76[_0x46e4('320','\x31\x53\x30\x76')](_0x11f556);if(_0x16b80a['\x74\x63\x42\x4f\x74'](_0xb64f75,undefined)){if(_0x16b80a[_0x46e4('321','\x61\x4a\x54\x6a')](_0x16b80a[_0x46e4('322','\x61\x77\x34\x4d')],_0x16b80a[_0x46e4('323','\x31\x79\x34\x67')])){_0xb64f75=_0x7640f8['\x67\x65\x74'](_0x11f556);}else{var _0x2caf39=_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')][_0x46e4('324','\x31\x79\x34\x67')];if(_0x5f5487[_0x46e4('325','\x76\x4c\x4a\x65')](0x0,--_0x2caf39[_0xb64f75])){var _0x1ab229=_0x5f5487[_0x46e4('326','\x43\x75\x73\x50')][_0x46e4('327','\x63\x33\x5a\x28')]('\x7c'),_0xa4a1f=0x0;while(!![]){switch(_0x1ab229[_0xa4a1f++]){case'\x30':delete _0x2caf39[_0xb64f75];continue;case'\x31':_0xfb787f['\x64\x65\x6c\x65\x74\x65'](_0x20d621);continue;case'\x32':var _0x20d621=_0x49f0c0[_0xb64f75];continue;case'\x33':delete _0x49f0c0[_0xb64f75];continue;case'\x34':var _0xfb787f=_0x10be40[_0x46e4('328','\x6f\x64\x4f\x4b')][_0x46e4('329','\x4d\x4d\x4e\x2a')];continue;case'\x35':var _0x49f0c0=_0x10be40[_0x46e4('24e','\x72\x78\x79\x38')][_0x46e4('32a','\x62\x30\x58\x7a')];continue;}break;}}}}if(_0x16b80a['\x5a\x54\x6c\x79\x71'](_0xb64f75,undefined)){if(_0x16b80a['\x6c\x45\x7a\x68\x72'](_0x16b80a[_0x46e4('32b','\x44\x34\x74\x5a')],_0x16b80a[_0x46e4('32c','\x44\x71\x42\x6e')])){_0xb64f75=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('32d','\x72\x4c\x50\x55')]++;try{_0x378c76[_0x46e4('32e','\x52\x58\x72\x37')](_0x11f556,_0xb64f75);}catch(_0x5d10c4){if(_0x16b80a[_0x46e4('32f','\x6b\x6b\x51\x50')](_0x16b80a['\x50\x65\x4d\x6b\x6f'],_0x16b80a[_0x46e4('330','\x26\x2a\x42\x28')])){_0x7640f8[_0x46e4('80','\x38\x72\x36\x78')](_0x11f556,_0xb64f75);}else{var _0x2fba97=_0x16b80a[_0x46e4('331','\x76\x4c\x4a\x65')](_0x16b80a[_0x46e4('332','\x40\x71\x69\x37')](0x10,Math[_0x46e4('333','\x32\x6e\x21\x53')]()),0x0);return(_0x16b80a[_0x46e4('334','\x68\x6a\x6e\x48')]('\x78',t)?_0x2fba97:_0x16b80a[_0x46e4('335','\x43\x75\x73\x50')](_0x16b80a['\x51\x41\x4c\x68\x46'](0x3,_0x2fba97),0x8))[_0x46e4('336','\x44\x71\x42\x6e')](0x10);}}}else{return _0x10be40[_0x46e4('337','\x40\x64\x70\x29')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'][_0xb64f75];}}if(_0x16b80a[_0x46e4('338','\x73\x29\x55\x76')](_0xb64f75,_0x3e4091)){if(_0x16b80a[_0x46e4('339','\x38\x72\x36\x78')](_0x16b80a['\x55\x68\x6c\x52\x55'],_0x16b80a[_0x46e4('33a','\x31\x79\x34\x67')])){_0x2f25ec[_0xb64f75]++;}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x3e4091[_0xb64f75]=_0x11f556;_0x2f25ec[_0xb64f75]=0x1;}return _0xb64f75;}else{throw new ReferenceError(_0x5f5487[_0x46e4('33b','\x58\x75\x24\x6b')]);}};_0x10be40[_0x46e4('248','\x31\x53\x30\x76')][_0x46e4('33c','\x56\x46\x6f\x53')]=function(_0x206313){return _0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('33d','\x41\x39\x75\x5d')][_0x206313];};_0x10be40[_0x46e4('69','\x28\x40\x4b\x38')][_0x46e4('33e','\x25\x5b\x4b\x46')]=function(_0x6d3a4e){_0x10be40[_0x46e4('227','\x5a\x25\x21\x2a')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'][_0x6d3a4e]++;};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x937cbb){if(_0x16b80a[_0x46e4('33f','\x68\x6a\x6e\x48')](_0x16b80a[_0x46e4('340','\x53\x75\x72\x49')],_0x16b80a['\x4b\x62\x70\x6b\x6a'])){var _0x31b7af=_0x10be40[_0x46e4('147','\x56\x46\x6f\x53')][_0x46e4('341','\x53\x37\x4f\x54')](_0x10be40[_0x46e4('342','\x41\x39\x75\x5d')][_0x46e4('343','\x44\x34\x74\x5a')][_0x46e4('344','\x51\x4a\x38\x73')](_0x10be40[_0x46e4('1bb','\x24\x29\x6c\x43')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](t),_0x10be40[_0x46e4('306','\x73\x29\x55\x76')][_0x46e4('345','\x44\x71\x42\x6e')](r)));return _0x31b7af;}else{var _0x3b86b6=_0x10be40[_0x46e4('24e','\x72\x78\x79\x38')][_0x46e4('346','\x61\x77\x34\x4d')];if(_0x16b80a[_0x46e4('347','\x4d\x4d\x4e\x2a')](0x0,--_0x3b86b6[_0x937cbb])){if(_0x16b80a[_0x46e4('348','\x70\x6d\x21\x25')](_0x16b80a[_0x46e4('349','\x72\x78\x79\x38')],_0x16b80a[_0x46e4('34a','\x38\x72\x36\x78')])){ref_to_id_map['\x73\x65\x74'](_0x56729a,_0x937cbb);}else{var _0x4edc28=_0x16b80a[_0x46e4('34b','\x77\x44\x30\x6d')][_0x46e4('34c','\x26\x2a\x42\x28')]('\x7c'),_0x561c89=0x0;while(!![]){switch(_0x4edc28[_0x561c89++]){case'\x30':var _0x409288=_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('34d','\x7a\x49\x4c\x57')];continue;case'\x31':_0x409288[_0x46e4('34e','\x4a\x35\x76\x75')](_0x56729a);continue;case'\x32':delete _0x3b86b6[_0x937cbb];continue;case'\x33':var _0x56729a=_0x964e55[_0x937cbb];continue;case'\x34':delete _0x964e55[_0x937cbb];continue;case'\x35':var _0x964e55=_0x10be40[_0x46e4('2a9','\x29\x62\x4f\x46')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'];continue;}break;}}}}};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('34f','\x40\x71\x69\x37')]=function(_0x28bcf1){var _0x54a8f1=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('350','\x72\x4c\x50\x55')]++;_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x54a8f1]=_0x28bcf1;return _0x54a8f1;};_0x10be40[_0x46e4('76','\x40\x71\x69\x37')][_0x46e4('351','\x31\x79\x34\x67')]=function(_0x4280b9){delete _0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('352','\x72\x78\x79\x38')][_0x4280b9];};_0x10be40[_0x46e4('31e','\x72\x4c\x50\x55')][_0x46e4('353','\x52\x58\x72\x37')]=function(_0x252cf9){return _0x10be40[_0x46e4('2bd','\x6b\x6b\x51\x50')][_0x46e4('354','\x44\x34\x74\x5a')][_0x252cf9];};_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('355','\x37\x49\x6b\x64')]=function alloc(_0x3a33f9){return _0x10be40[_0x46e4('356','\x33\x57\x6a\x6e')](_0x3a33f9);};_0x10be40[_0x46e4('1bb','\x24\x29\x6c\x43')]['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x5aaf88,_0x2a128e,_0x4410ee){if(_0x16b80a['\x51\x6b\x7a\x58\x56'](_0x16b80a['\x42\x71\x46\x48\x61'],_0x16b80a[_0x46e4('357','\x53\x37\x4f\x54')])){try{return{'\x76\x61\x6c\x75\x65':r[_0x46e4('358','\x61\x77\x34\x4d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x24d70c){return{'\x65\x72\x72\x6f\x72':_0x24d70c,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{return _0x10be40[_0x46e4('359','\x68\x6a\x6e\x48')][_0x46e4('35a','\x59\x71\x40\x6f')](_0x2a128e)[_0x46e4('35b','\x31\x53\x30\x76')](null,_0x4410ee);}};_0x10be40[_0x46e4('248','\x31\x53\x30\x76')][_0x46e4('35c','\x56\x46\x6f\x53')]=function utf8_len(_0x193707){if(_0x16b80a[_0x46e4('35d','\x4a\x35\x76\x75')](_0x16b80a['\x59\x4c\x49\x6a\x4a'],_0x16b80a['\x59\x4c\x49\x6a\x4a'])){return window[_0x46e4('35e','\x5b\x5a\x5d\x62')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65'](t,n[_0x46e4('35f','\x41\x39\x75\x5d')]);}else{var _0x503bb0=0x0;for(var _0x34d06a=0x0;_0x16b80a[_0x46e4('360','\x28\x40\x4b\x38')](_0x34d06a,_0x193707[_0x46e4('361','\x72\x4c\x50\x55')]);++_0x34d06a){if(_0x16b80a[_0x46e4('362','\x31\x53\x30\x76')](_0x16b80a[_0x46e4('363','\x5a\x25\x21\x2a')],_0x16b80a[_0x46e4('364','\x37\x49\x6b\x64')])){var _0xa425ce=_0x193707[_0x46e4('365','\x5b\x5a\x5d\x62')](_0x34d06a);if(_0x16b80a[_0x46e4('366','\x72\x78\x79\x38')](_0xa425ce,0xd800)&&_0x16b80a[_0x46e4('367','\x6f\x64\x4f\x4b')](_0xa425ce,0xdfff)){_0xa425ce=_0x16b80a[_0x46e4('368','\x24\x29\x6c\x43')](_0x16b80a['\x61\x43\x51\x46\x61'](0x10000,_0x16b80a[_0x46e4('369','\x26\x2a\x42\x28')](_0x16b80a['\x74\x70\x44\x74\x49'](_0xa425ce,0x3ff),0xa)),_0x16b80a[_0x46e4('36a','\x52\x58\x72\x37')](_0x193707['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x34d06a),0x3ff));}if(_0x16b80a[_0x46e4('36b','\x4c\x58\x44\x78')](_0xa425ce,0x7f)){++_0x503bb0;}else if(_0x16b80a['\x4f\x4d\x68\x7a\x6b'](_0xa425ce,0x7ff)){_0x503bb0+=0x2;}else if(_0x16b80a[_0x46e4('36c','\x33\x57\x6a\x6e')](_0xa425ce,0xffff)){if(_0x16b80a[_0x46e4('36d','\x6b\x6b\x51\x50')](_0x16b80a[_0x46e4('36e','\x59\x71\x40\x6f')],_0x16b80a[_0x46e4('36f','\x4c\x58\x44\x78')])){_0x503bb0+=0x3;}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else if(_0x16b80a[_0x46e4('370','\x38\x72\x36\x78')](_0xa425ce,0x1fffff)){_0x503bb0+=0x4;}else if(_0x16b80a['\x4f\x4d\x68\x7a\x6b'](_0xa425ce,0x3ffffff)){if(_0x16b80a['\x53\x4e\x56\x58\x48'](_0x16b80a[_0x46e4('371','\x52\x58\x72\x37')],_0x16b80a[_0x46e4('372','\x24\x29\x6c\x43')])){r=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](r),_0x10be40[_0x46e4('373','\x26\x2a\x42\x28')][_0x46e4('2a2','\x66\x30\x6e\x36')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x46e4('374','\x53\x75\x72\x49')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4dc9ec){return{'\x65\x72\x72\x6f\x72':_0x4dc9ec,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x503bb0+=0x5;}}else{_0x503bb0+=0x6;}}else{return _0x10be40[_0x46e4('375','\x70\x6d\x21\x25')][_0x16b80a[_0x46e4('376','\x43\x75\x73\x50')](address,0x4)];}}return _0x503bb0;}};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('377','\x66\x30\x6e\x36')]=function(_0x4e1a5c){if(_0x16b80a[_0x46e4('378','\x31\x53\x30\x76')](_0x16b80a['\x55\x57\x50\x5a\x72'],_0x16b80a['\x4e\x61\x59\x75\x65'])){var _0x1d1959=_0x10be40[_0x46e4('373','\x26\x2a\x42\x28')][_0x46e4('379','\x7a\x49\x4c\x57')];_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')]['\x74\x6d\x70']=null;return _0x1d1959;}else{var _0x31fb69=_0x10be40[_0x46e4('19c','\x51\x4a\x38\x73')]['\x61\x6c\x6c\x6f\x63'](0x10);_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x31fb69,_0x4e1a5c);return _0x31fb69;}};_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('37a','\x29\x62\x4f\x46')]=function(_0x1fcfe2){var _0x1cb03f=_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')]['\x74\x6d\x70'];_0x10be40[_0x46e4('37b','\x7a\x49\x4c\x57')][_0x46e4('37c','\x4c\x58\x44\x78')]=null;return _0x1cb03f;};var _0x15141f=null;var _0x3d0060=null;var _0x4726dc=null;var _0x5cc55d=null;var _0x2cbd1a=null;var _0x4972aa=null;var _0x4be027=null;var _0x1a2730=null;Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x10be40,_0x16b80a[_0x46e4('37d','\x68\x6a\x6e\x48')],{'\x76\x61\x6c\x75\x65':{}});function _0x49073f(){var _0x219f79=_0x16b80a['\x79\x75\x6c\x77\x68'][_0x46e4('37e','\x58\x75\x24\x6b')]('\x7c'),_0xa00526=0x0;while(!![]){switch(_0x219f79[_0xa00526++]){case'\x30':_0x4726dc=new Int32Array(_0x9ae2d6);continue;case'\x31':_0x4be027=new Float32Array(_0x9ae2d6);continue;case'\x32':_0x10be40[_0x46e4('37f','\x53\x75\x72\x49')]=_0x15141f;continue;case'\x33':_0x2cbd1a=new Uint16Array(_0x9ae2d6);continue;case'\x34':_0x10be40[_0x46e4('380','\x63\x33\x5a\x28')]=_0x4972aa;continue;case'\x35':_0x10be40['\x48\x45\x41\x50\x31\x36']=_0x3d0060;continue;case'\x36':var _0x9ae2d6=_0x10be40[_0x46e4('381','\x44\x71\x42\x6e')][_0x46e4('382','\x7a\x49\x4c\x57')]['\x6d\x65\x6d\x6f\x72\x79'][_0x46e4('383','\x56\x46\x6f\x53')];continue;case'\x37':_0x10be40[_0x46e4('9b','\x41\x39\x75\x5d')]=_0x5cc55d;continue;case'\x38':_0x1a2730=new Float64Array(_0x9ae2d6);continue;case'\x39':_0x10be40[_0x46e4('384','\x4a\x35\x76\x75')]=_0x4be027;continue;case'\x31\x30':_0x3d0060=new Int16Array(_0x9ae2d6);continue;case'\x31\x31':_0x15141f=new Int8Array(_0x9ae2d6);continue;case'\x31\x32':_0x4972aa=new Uint32Array(_0x9ae2d6);continue;case'\x31\x33':_0x10be40[_0x46e4('385','\x52\x58\x72\x37')]=_0x4726dc;continue;case'\x31\x34':_0x10be40[_0x46e4('386','\x61\x4a\x54\x6a')]=_0x2cbd1a;continue;case'\x31\x35':_0x10be40['\x48\x45\x41\x50\x46\x36\x34']=_0x1a2730;continue;case'\x31\x36':_0x5cc55d=new Uint8Array(_0x9ae2d6);continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x497dbe,_0x592060){_0x592060=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('1da','\x31\x53\x30\x76')](_0x592060),_0x10be40[_0x46e4('76','\x40\x71\x69\x37')][_0x46e4('387','\x38\x72\x36\x78')](_0x497dbe,_0x592060[_0x46e4('388','\x52\x58\x72\x37')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x1c351c){_0x10be40[_0x46e4('389','\x37\x49\x6b\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1c351c,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x14ced1){return _0x16b80a[_0x46e4('38a','\x29\x62\x4f\x46')](_0x16b80a[_0x46e4('38b','\x58\x75\x24\x6b')](_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('38c','\x72\x78\x79\x38')](_0x14ced1),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x33ba99,_0x18bb50){var _0x167d31={'\x74\x6b\x73\x66\x63':function(_0x3a5571,_0x4bcbef){return _0x16b80a[_0x46e4('38d','\x24\x29\x6c\x43')](_0x3a5571,_0x4bcbef);},'\x7a\x6f\x43\x68\x65':function(_0x198cfb,_0x1bd1a7){return _0x16b80a[_0x46e4('38e','\x51\x4a\x38\x73')](_0x198cfb,_0x1bd1a7);},'\x7a\x70\x62\x77\x54':function(_0x5a129a,_0x2a7bb8){return _0x16b80a[_0x46e4('38f','\x72\x4c\x50\x55')](_0x5a129a,_0x2a7bb8);},'\x7a\x6f\x6e\x63\x46':_0x16b80a['\x75\x5a\x6a\x51\x51']};if(_0x16b80a[_0x46e4('390','\x43\x75\x73\x50')](_0x16b80a[_0x46e4('391','\x61\x77\x34\x4d')],_0x16b80a['\x70\x64\x78\x50\x6a'])){output['\x70\x75\x73\x68'](_0x10be40[_0x46e4('67','\x4c\x58\x44\x78')]['\x74\x6f\x5f\x6a\x73'](_0x167d31['\x74\x6b\x73\x66\x63'](pointer,_0x167d31[_0x46e4('392','\x4c\x58\x44\x78')](i,0x10))));}else{_0x18bb50=_0x10be40[_0x46e4('2ad','\x34\x76\x6f\x4b')][_0x46e4('393','\x33\x57\x6a\x6e')](_0x18bb50),_0x10be40[_0x46e4('21c','\x38\x72\x36\x78')][_0x46e4('394','\x32\x6e\x21\x53')](_0x33ba99,function(){if(_0x167d31[_0x46e4('395','\x31\x53\x30\x76')](_0x167d31['\x7a\x6f\x6e\x63\x46'],_0x167d31['\x7a\x6f\x6e\x63\x46'])){try{return{'\x76\x61\x6c\x75\x65':_0x18bb50['\x6f\x72\x69\x67\x69\x6e'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x3233d6){return{'\x65\x72\x72\x6f\x72':_0x3233d6,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{try{return{'\x76\x61\x6c\x75\x65':_0x18bb50[_0x46e4('396','\x31\x79\x34\x67')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0xf7f062){return{'\x65\x72\x72\x6f\x72':_0xf7f062,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x5d3cc0,_0x2aea1d){_0x2aea1d=_0x10be40[_0x46e4('227','\x5a\x25\x21\x2a')][_0x46e4('397','\x40\x64\x70\x29')](_0x2aea1d),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5d3cc0,function(){if(_0x16b80a['\x65\x54\x53\x68\x4a'](_0x16b80a[_0x46e4('398','\x77\x44\x30\x6d')],_0x16b80a['\x63\x6a\x5a\x75\x51'])){++len;}else{try{return{'\x76\x61\x6c\x75\x65':_0x2aea1d[_0x46e4('399','\x34\x76\x6f\x4b')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x16c384){if(_0x16b80a[_0x46e4('39a','\x72\x4c\x50\x55')](_0x16b80a[_0x46e4('39b','\x7a\x49\x4c\x57')],_0x16b80a[_0x46e4('39c','\x25\x5b\x4b\x46')])){return{'\x65\x72\x72\x6f\x72':_0x16c384,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{y=_0x5cc55d[index++];}}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x13d8d6,_0x73b4f9){_0x73b4f9=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('39d','\x5a\x25\x21\x2a')](_0x73b4f9),_0x10be40[_0x46e4('284','\x25\x5b\x4b\x46')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x13d8d6,0x780);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x48481c,_0x9ba670){if(_0x16b80a[_0x46e4('39e','\x40\x71\x69\x37')](_0x16b80a[_0x46e4('39f','\x59\x71\x40\x6f')],_0x16b80a[_0x46e4('3a0','\x7a\x49\x4c\x57')])){_0x9ba670=_0x10be40[_0x46e4('337','\x40\x64\x70\x29')][_0x46e4('3a1','\x73\x29\x55\x76')](_0x9ba670),_0x10be40[_0x46e4('76','\x40\x71\x69\x37')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x48481c,function(){try{if(_0x16b80a[_0x46e4('3a2','\x7a\x49\x4c\x57')](_0x16b80a[_0x46e4('3a3','\x63\x33\x5a\x28')],_0x16b80a[_0x46e4('3a4','\x72\x78\x79\x38')])){_0x9ba670=_0x10be40[_0x46e4('3a5','\x70\x38\x26\x32')][_0x46e4('3a6','\x70\x6d\x21\x25')](_0x9ba670),_0x10be40[_0x46e4('1d3','\x70\x6d\x21\x25')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x48481c,function(){try{return{'\x76\x61\x6c\x75\x65':_0x9ba670[_0x46e4('3a7','\x51\x4a\x38\x73')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1b18af){return{'\x65\x72\x72\x6f\x72':_0x1b18af,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return{'\x76\x61\x6c\x75\x65':_0x9ba670[_0x46e4('3a8','\x4d\x4d\x4e\x2a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x658e53){return{'\x65\x72\x72\x6f\x72':_0x658e53,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x4583ac,_0x2c2d9e){_0x2c2d9e=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3a9','\x24\x29\x6c\x43')](_0x2c2d9e),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3aa','\x52\x58\x72\x37')](_0x4583ac,_0x2c2d9e[_0x46e4('3ab','\x43\x75\x73\x50')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x2fe496,_0x17ff29){_0x17ff29=_0x10be40[_0x46e4('3ac','\x77\x44\x30\x6d')][_0x46e4('3ad','\x72\x78\x79\x38')](_0x17ff29),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3ae','\x73\x29\x55\x76')](_0x2fe496,_0x17ff29['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0xdc3d55){_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3af','\x31\x53\x30\x76')](_0xdc3d55,document);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x45d56c,_0x5c1ee7){if(_0x16b80a['\x4c\x56\x58\x45\x45'](_0x16b80a[_0x46e4('3b0','\x72\x78\x79\x38')],_0x16b80a[_0x46e4('3b1','\x70\x38\x26\x32')])){try{return{'\x76\x61\x6c\x75\x65':_0x5c1ee7[_0x46e4('3b2','\x52\x58\x72\x37')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x10a179){return{'\x65\x72\x72\x6f\x72':_0x10a179,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x5c1ee7=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3a9','\x24\x29\x6c\x43')](_0x5c1ee7),_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('266','\x72\x4c\x50\x55')](_0x45d56c,_0x5c1ee7[_0x46e4('3b3','\x6b\x6b\x51\x50')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x2e2f93){_0x10be40[_0x46e4('3b4','\x43\x75\x73\x50')]['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74'](_0x2e2f93);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x1fdacf){var _0x937f32=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3b5','\x4c\x58\x44\x78')](_0x1fdacf);return _0x16b80a[_0x46e4('3b6','\x38\x72\x36\x78')](_0x937f32,DOMException)&&_0x16b80a['\x4c\x56\x58\x45\x45'](_0x16b80a[_0x46e4('3b7','\x40\x64\x70\x29')],_0x937f32[_0x46e4('3b8','\x79\x40\x49\x5e')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x2300b4,_0x555c8c){var _0x11596a=_0x10be40[_0x46e4('7c','\x58\x75\x24\x6b')][_0x46e4('3b9','\x53\x75\x72\x49')](_0x2300b4);_0x10be40[_0x46e4('3ba','\x61\x4a\x54\x6a')][_0x46e4('3bb','\x33\x68\x52\x2a')](_0x555c8c,_0x11596a);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x47829a,_0x246462){_0x246462=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3bc','\x56\x46\x6f\x53')](_0x246462),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3bd','\x59\x71\x40\x6f')](_0x47829a,0x438);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x2f54b6,_0x5c1833){_0x5c1833=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3be','\x41\x36\x54\x33')](_0x5c1833),_0x10be40[_0x46e4('1f1','\x66\x30\x6e\x36')][_0x46e4('3bf','\x68\x6a\x6e\x48')](_0x2f54b6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x5c1833['\x70\x61\x74\x68\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x292fc4){if(_0x16b80a[_0x46e4('3c0','\x62\x30\x58\x7a')](_0x16b80a['\x4c\x72\x48\x65\x6a'],_0x16b80a['\x4c\x72\x48\x65\x6a'])){return{'\x65\x72\x72\x6f\x72':_0x292fc4,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x5c1833=_0x10be40[_0x46e4('3ba','\x61\x4a\x54\x6a')][_0x46e4('3bc','\x56\x46\x6f\x53')](_0x5c1833),_0x10be40[_0x46e4('3a5','\x70\x38\x26\x32')][_0x46e4('3c1','\x69\x70\x48\x5b')](_0x2f54b6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x5c1833['\x70\x61\x74\x68\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x428138){return{'\x65\x72\x72\x6f\x72':_0x428138,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0xabc9a4,_0x56502b){if(_0x16b80a[_0x46e4('3c2','\x5a\x25\x21\x2a')](_0x16b80a[_0x46e4('3c3','\x37\x49\x6b\x64')],_0x16b80a[_0x46e4('3c4','\x32\x6e\x21\x53')])){_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3c5','\x53\x75\x72\x49')](_0xabc9a4,document);}else{_0x56502b=_0x10be40[_0x46e4('1e4','\x4a\x35\x76\x75')][_0x46e4('3a1','\x73\x29\x55\x76')](_0x56502b),_0x10be40[_0x46e4('3ba','\x61\x4a\x54\x6a')][_0x46e4('24f','\x56\x46\x6f\x53')](_0xabc9a4,_0x56502b[_0x46e4('3c6','\x72\x4c\x50\x55')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x52023e,_0x481820){_0x481820=_0x10be40[_0x46e4('373','\x26\x2a\x42\x28')][_0x46e4('3c7','\x6f\x64\x4f\x4b')](_0x481820),_0x10be40[_0x46e4('226','\x44\x71\x42\x6e')][_0x46e4('3c8','\x4a\x35\x76\x75')](_0x52023e,_0x481820[_0x46e4('3c9','\x56\x46\x6f\x53')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x564253,_0x82c5a6){_0x82c5a6=_0x10be40[_0x46e4('37b','\x7a\x49\x4c\x57')][_0x46e4('397','\x40\x64\x70\x29')](_0x82c5a6),_0x10be40[_0x46e4('389','\x37\x49\x6b\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x564253,_0x82c5a6['\x6c\x65\x6e\x67\x74\x68']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x2c7d35,_0x2193f4){if(_0x16b80a['\x71\x65\x42\x45\x63'](_0x16b80a[_0x46e4('3ca','\x33\x68\x52\x2a')],_0x16b80a[_0x46e4('3cb','\x79\x40\x49\x5e')])){_0x2193f4=_0x10be40[_0x46e4('373','\x26\x2a\x42\x28')][_0x46e4('3cc','\x68\x6a\x6e\x48')](_0x2193f4),_0x10be40[_0x46e4('3ac','\x77\x44\x30\x6d')][_0x46e4('3cd','\x33\x68\x52\x2a')](_0x2c7d35,0x3db);}else{refid=ref_to_id_map_fallback[_0x46e4('3ce','\x53\x37\x4f\x54')](reference);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x3a4f79,_0xd63573){var _0xda619b={'\x62\x5a\x78\x59\x67':function(_0x35efaf,_0x5ccd29){return _0x16b80a[_0x46e4('3cf','\x61\x4a\x54\x6a')](_0x35efaf,_0x5ccd29);},'\x6d\x4c\x41\x49\x64':_0x16b80a[_0x46e4('3d0','\x53\x37\x4f\x54')],'\x6b\x79\x46\x4a\x70':_0x16b80a[_0x46e4('3d1','\x33\x57\x6a\x6e')]};_0xd63573=_0x10be40[_0x46e4('3d2','\x4d\x4d\x4e\x2a')][_0x46e4('3cc','\x68\x6a\x6e\x48')](_0xd63573),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x3a4f79,function(){try{if(_0xda619b[_0x46e4('3d3','\x5a\x25\x21\x2a')](_0xda619b[_0x46e4('3d4','\x44\x34\x74\x5a')],_0xda619b[_0x46e4('3d5','\x26\x2a\x42\x28')])){return{'\x76\x61\x6c\x75\x65':_0xd63573[_0x46e4('3d6','\x51\x4a\x38\x73')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0xd63573=_0x10be40[_0x46e4('2bd','\x6b\x6b\x51\x50')][_0x46e4('3d7','\x53\x75\x72\x49')](_0xd63573),_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')][_0x46e4('3d8','\x6f\x64\x4f\x4b')](_0x3a4f79,_0xd63573[_0x46e4('3d9','\x31\x79\x34\x67')]);}}catch(_0x4daed8){return{'\x65\x72\x72\x6f\x72':_0x4daed8,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x2fdd82,_0x5a56a4){var _0x1aef55={'\x6c\x74\x77\x43\x79':function(_0x4a7bc6,_0x1725ab){return _0x16b80a['\x73\x67\x62\x4b\x66'](_0x4a7bc6,_0x1725ab);}};if(_0x16b80a['\x71\x65\x42\x45\x63'](_0x16b80a['\x44\x6d\x4e\x6e\x72'],_0x16b80a['\x44\x6d\x4e\x6e\x72'])){_0x5a56a4=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3da','\x44\x34\x74\x5a')](_0x5a56a4),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3db','\x44\x71\x42\x6e')](_0x2fdd82,function(){try{return{'\x76\x61\x6c\x75\x65':_0x5a56a4[_0x46e4('3dc','\x5b\x5a\x5d\x62')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4bc411){return{'\x65\x72\x72\x6f\x72':_0x4bc411,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x1aef55['\x6c\x74\x77\x43\x79'](address,0xc)]=0x1;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x46243a){var _0x4b29c4={'\x64\x46\x42\x72\x70':_0x16b80a[_0x46e4('3dd','\x63\x33\x5a\x28')],'\x4a\x6c\x67\x78\x6b':function(_0x4ab629,_0x24c854){return _0x16b80a[_0x46e4('3de','\x32\x6e\x21\x53')](_0x4ab629,_0x24c854);},'\x75\x75\x48\x6c\x62':function(_0x561f25,_0x3fdcd7){return _0x16b80a[_0x46e4('3df','\x38\x72\x36\x78')](_0x561f25,_0x3fdcd7);},'\x6c\x45\x45\x79\x61':function(_0x164574,_0x3b4678){return _0x16b80a['\x69\x6e\x53\x4e\x62'](_0x164574,_0x3b4678);},'\x43\x47\x6d\x77\x44':function(_0x295a9b,_0x520da6){return _0x16b80a[_0x46e4('3e0','\x32\x6e\x21\x53')](_0x295a9b,_0x520da6);},'\x54\x52\x6f\x75\x65':function(_0x2d5825,_0x4fa5e1){return _0x16b80a['\x51\x61\x76\x51\x6d'](_0x2d5825,_0x4fa5e1);},'\x62\x45\x73\x56\x6d':function(_0x43c8d8,_0x5d2cb3){return _0x16b80a[_0x46e4('3e1','\x43\x75\x73\x50')](_0x43c8d8,_0x5d2cb3);},'\x46\x6a\x4c\x68\x45':function(_0xb316c4,_0x148d06){return _0x16b80a['\x53\x55\x57\x70\x43'](_0xb316c4,_0x148d06);}};if(_0x16b80a['\x5a\x67\x65\x72\x64'](_0x16b80a[_0x46e4('3e2','\x58\x75\x24\x6b')],_0x16b80a['\x67\x4c\x4f\x43\x46'])){var _0x53c565=_0x4b29c4[_0x46e4('3e3','\x25\x5b\x4b\x46')][_0x46e4('16e','\x33\x57\x6a\x6e')]('\x7c'),_0x5d1dad=0x0;while(!![]){switch(_0x53c565[_0x5d1dad++]){case'\x30':var _0x19c740=_0x10be40[_0x46e4('28e','\x69\x70\x48\x5b')][_0x46e4('3e4','\x4d\x4d\x4e\x2a')](_0x4b29c4[_0x46e4('3e5','\x76\x4c\x4a\x65')](_0x2eabfc,0x10));continue;case'\x31':_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x4b29c4['\x75\x75\x48\x6c\x62'](address,0x4)]=_0x19c740;continue;case'\x32':var _0x2eabfc=value['\x6c\x65\x6e\x67\x74\x68'];continue;case'\x33':for(var _0x516b87=0x0;_0x4b29c4['\x6c\x45\x45\x79\x61'](_0x516b87,_0x2eabfc);++_0x516b87){_0x10be40[_0x46e4('1f1','\x66\x30\x6e\x36')][_0x46e4('3ae','\x73\x29\x55\x76')](_0x4b29c4[_0x46e4('3e6','\x73\x29\x55\x76')](_0x19c740,_0x4b29c4[_0x46e4('3e7','\x61\x77\x34\x4d')](_0x516b87,0x10)),value[_0x516b87]);}continue;case'\x34':_0x10be40['\x48\x45\x41\x50\x55\x33\x32'][_0x4b29c4[_0x46e4('3e8','\x44\x34\x74\x5a')](_0x4b29c4['\x46\x6a\x4c\x68\x45'](address,0x4),0x4)]=_0x2eabfc;continue;case'\x35':_0x10be40['\x48\x45\x41\x50\x55\x38'][_0x4b29c4[_0x46e4('3e9','\x34\x76\x6f\x4b')](address,0xc)]=0x7;continue;}break;}}else{_0x46243a=_0x10be40[_0x46e4('2ad','\x34\x76\x6f\x4b')]['\x74\x6f\x5f\x6a\x73'](_0x46243a),_0x10be40[_0x46e4('2ad','\x34\x76\x6f\x4b')][_0x46e4('3ea','\x52\x58\x72\x37')](_0x46243a);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0x38ab3e,_0x4678b5){var _0x3f774a={'\x41\x66\x79\x55\x6b':function(_0x4dd660,_0x3d1666){return _0x16b80a[_0x46e4('3eb','\x51\x4a\x38\x73')](_0x4dd660,_0x3d1666);},'\x64\x49\x74\x66\x79':function(_0x244389,_0x34b5c0){return _0x16b80a[_0x46e4('3ec','\x44\x34\x74\x5a')](_0x244389,_0x34b5c0);}};if(_0x16b80a[_0x46e4('3ed','\x51\x4a\x38\x73')](_0x16b80a[_0x46e4('3ee','\x58\x75\x24\x6b')],_0x16b80a['\x68\x69\x71\x4b\x66'])){_0x10be40[_0x46e4('3ef','\x5a\x25\x21\x2a')][_0x3f774a[_0x46e4('3f0','\x43\x75\x73\x50')](address,0xc)]=0x3;_0x10be40[_0x46e4('3f1','\x38\x72\x36\x78')][_0x3f774a['\x64\x49\x74\x66\x79'](address,0x8)]=value;}else{_0x4678b5=_0x10be40[_0x46e4('146','\x33\x57\x6a\x6e')]['\x74\x6f\x5f\x6a\x73'](_0x4678b5),_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3f2','\x41\x36\x54\x33')](_0x38ab3e,0x248);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x18f49e){_0x10be40[_0x46e4('389','\x37\x49\x6b\x64')][_0x46e4('3f3','\x70\x38\x26\x32')]=_0x10be40['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x46e4('3f4','\x72\x4c\x50\x55')](_0x18f49e);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x49073f}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x4825bb){var _0x5960be=_0x16b80a[_0x46e4('3f5','\x5b\x5a\x5d\x62')][_0x46e4('3f6','\x37\x49\x6b\x64')]('\x7c'),_0x1cb856=0x0;while(!![]){switch(_0x5960be[_0x1cb856++]){case'\x30':Object[_0x46e4('3f7','\x6f\x64\x4f\x4b')](_0x10be40,_0x16b80a[_0x46e4('3f8','\x5a\x25\x21\x2a')],{'\x76\x61\x6c\x75\x65':_0x10be40[_0x46e4('3f9','\x62\x30\x58\x7a')][_0x46e4('3fa','\x41\x39\x75\x5d')]['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']});continue;case'\x31':_0x10be40[_0x46e4('3fb','\x31\x79\x34\x67')]['\x73\x70\x79\x64\x65\x72']=function(_0x44e2da,_0xe5991c){try{var _0x81d7fc=_0x10be40[_0x46e4('2a9','\x29\x62\x4f\x46')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x74\x6d\x70'](_0x10be40['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x46e4('3fc','\x38\x72\x36\x78')](_0x10be40[_0x46e4('1bb','\x24\x29\x6c\x43')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x44e2da),_0x10be40[_0x46e4('3fd','\x76\x4c\x4a\x65')][_0x46e4('3fe','\x79\x40\x49\x5e')](_0xe5991c)));return _0x81d7fc;}catch(_0x28ef43){console[_0x46e4('3ff','\x70\x6d\x21\x25')](_0x39b175[_0x46e4('400','\x4a\x35\x76\x75')],_0x28ef43);}};continue;case'\x32':var _0x39b175={'\x61\x4b\x67\x72\x49':_0x16b80a[_0x46e4('401','\x73\x29\x55\x76')]};continue;case'\x33':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x10be40,_0x16b80a[_0x46e4('402','\x59\x71\x40\x6f')],{'\x76\x61\x6c\x75\x65':_0x10be40[_0x46e4('403','\x59\x71\x40\x6f')][_0x46e4('404','\x33\x57\x6a\x6e')][_0x46e4('405','\x69\x70\x48\x5b')]});continue;case'\x34':Object[_0x46e4('406','\x53\x37\x4f\x54')](_0x10be40,_0x16b80a[_0x46e4('407','\x29\x62\x4f\x46')],{'\x76\x61\x6c\x75\x65':_0x4825bb});continue;case'\x35':_0x16b80a[_0x46e4('408','\x40\x71\x69\x37')](_0x49073f);continue;case'\x36':Object[_0x46e4('409','\x32\x6e\x21\x53')](_0x10be40,_0x16b80a[_0x46e4('40a','\x25\x5b\x4b\x46')],{'\x76\x61\x6c\x75\x65':_0x10be40[_0x46e4('40b','\x32\x6e\x21\x53')][_0x46e4('40c','\x61\x77\x34\x4d')][_0x46e4('40d','\x29\x62\x4f\x46')]});continue;case'\x37':return _0x10be40[_0x46e4('40e','\x25\x5b\x4b\x46')];}break;}}};}};;_0xod0='jsjiami.com.v6';
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
