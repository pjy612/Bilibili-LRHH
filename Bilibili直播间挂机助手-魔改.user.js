// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.8
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼等，包含恶意代码
// @author       SeaLoong,lzghzr,pjy612
// @updateURL    https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @homepageURL  https://github.com/pjy612/Bilibili-LRHH
// @supportURL   https://github.com/pjy612/Bilibili-LRHH/issues
// @include      /https?:\/\/live\.bilibili\.com\/[blanc\/]?[^?]*?\d+\??.*/
// @include      /https?:\/\/api\.live\.bilibili\.com\/_.*/
// @require      https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/gh/pjy612/Bilibili-LRHH/BilibiliAPI_Plus.js
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
    const VERSION = '2.4.5.8';
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
            ruid: undefined,
            room_id: undefined,
            medal_list: undefined,
            bag_list: undefined,
            time: undefined,
            remain_feed: undefined,
            light_gift:30607,
            getMedalList: (page = 1) => {
                if (page === 1) Gift.medal_list = [];
                return API.i.medal(page, 25).then((response) => {
                    DEBUG('Gift.getMedalList: API.i.medal', response);
                    Gift.medal_list = Gift.medal_list.concat(response.data.fansMedalList);
                    if (response.data.pageinfo.curPage < response.data.pageinfo.totalpages) return Gift.getMedalList(page + 1);
                }, () => {
                    window.toast('[自动送礼]获取勋章列表失败，请检查网络', 'error');
                    return delayCall(() => Gift.getMedalList(page));
                });
            },
            getBagList: () => {
                return API.gift.bag_list().then((response) => {
                    DEBUG('Gift.getBagList: API.gift.bag_list', response);
                    Gift.bag_list = response.data.list;
                    Gift.time = response.data.time;
                }, () => {
                    window.toast('[自动送礼]获取包裹列表失败，请检查网络', 'error');
                    return delayCall(() => Gift.getBagList());
                });
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
            auto_light:async()=>{
                try{
                    const feed = Gift.getFeedByGiftID(Gift.light_gift);
                    let medal_list = Gift.medal_list;
                    let noLightMedals = medal_list.filter(it=>it.is_lighted==0 && it.day_limit-it.today_feed>=feed && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp=>exp==it.roomid)==-1);
                    if(noLightMedals && noLightMedals.length>0){
                        noLightMedals = Gift.sort_medals(noLightMedals);
                        await Gift.getBagList();
                        let heartBags = Gift.bag_list.filter(r=>r.gift_id==Gift.light_gift);
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
                    if (!CONFIG.AUTO_GIFT) return $.Deferred().resolve();
                    if (Gift.run_timer) clearTimeout(Gift.run_timer);
                    Gift.interval = CONFIG.AUTO_GIFT_CONFIG.GIFT_INTERVAL * 60e3;
                    if (CACHE.gift_ts) {
                        const diff = ts_ms() - CACHE.gift_ts;
                        if (diff < Gift.interval) {
                            Gift.run_timer = setTimeout(Gift.run, Gift.interval - diff);
                            return $.Deferred().resolve();
                        }
                    }
                    await Gift.getMedalList();
                    let medal_list = Gift.medal_list;
                    if(CONFIG.AUTO_GIFT_CONFIG.AUTO_LIGHT){
                        await Gift.auto_light();
                    }
                    DEBUG('Gift.run: Gift.getMedalList().then: Gift.medal_list', Gift.medal_list);
                    if(medal_list && medal_list.length>0){
                        medal_list = medal_list.filter(it=>it.day_limit-it.today_feed>0 && it.level < 20);
                        medal_list = Gift.sort_medals(medal_list);
                        if(CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID && CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.length>0){
                            medal_list = medal_list.filter(r=>CONFIG.AUTO_GIFT_CONFIG.EXCLUDE_ROOMID.findIndex(exp=>exp==r.roomid)==-1);
                        }
                        let limit = CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT;
                        for(let v of medal_list){
                            let response = await API.room.room_init(parseInt(v.roomid, 10));
                            Gift.room_id = parseInt(response.data.room_id, 10);
                            Gift.ruid = v.target_id;
                            Gift.remain_feed = v.day_limit - v.today_feed;
                            if(Gift.remain_feed > 0){
                                await Gift.getBagList();
                                let now = ts_s();
                                if(!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL){
                                    //送之前查一次有没有可送的
                                    let pass = Gift.bag_list.filter(r=>![4, 3, 9, 10].includes(r.gift_id) && r.gift_num > 0 && r.expire_at > now && (r.expire_at - now < limit));
                                    if(pass.length==0){
                                        break;
                                    }
                                }
                                CACHE.gift_ts = ts_ms();
                                Essential.Cache.save();
                                if (Gift.remain_feed > 0) {
                                    window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度未满[${v.today_feed}/${v.day_limit}]，预计需要[${Gift.remain_feed}]送礼开始`, 'info');
                                    await Gift.sendGift(v);
                                    if(!CONFIG.AUTO_GIFT_CONFIG.SEND_ALL){
                                        let pass = Gift.bag_list.filter(r=>![4, 3, 9, 10].includes(r.gift_id) && r.gift_num > 0 && r.expire_at > now && (r.expire_at - now < limit));
                                        if(pass.length==0){
                                            break;
                                        }
                                    }
                                } else {
                                    window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度已满`, 'info');
                                }
                            }
                        }
                    }
                    setTimeout(Gift.run, Gift.interval);
                } catch (err) {
                    func();
                    window.toast('[自动送礼]运行时出现异常，已停止', 'error');
                    console.error(`[${NAME}]`, err);
                    return $.Deferred().reject();
                }
            },
            sendGift: (medal,i = 0) => {
                if (i >= Gift.bag_list.length) {
                    return $.Deferred().resolve();
                }
                if (Gift.remain_feed <= 0) {
                    window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼结束，今日亲密度已满[${medal.today_feed}/${medal.day_limit}]`, 'info');
                    return $.Deferred().resolve();
                }
                if (Gift.time <= 0) Gift.time = ts_s();
                const v = Gift.bag_list[i];
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
                        let feed_num = Math.floor(Gift.remain_feed / feed);
                        if (feed_num > v.gift_num) feed_num = v.gift_num;
                        if (feed_num > 0) {
                            return API.gift.bag_send(Info.uid, v.gift_id, Gift.ruid, feed_num, v.bag_id, Gift.room_id, Info.rnd).then((response) => {
                                DEBUG('Gift.sendGift: API.gift.bag_send', response);
                                if (response.code === 0) {
                                    v.gift_num -= feed_num;
                                    medal.today_feed += feed_num * feed;
                                    Gift.remain_feed -= feed_num * feed;
                                    window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼成功，送出${feed_num}个${v.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${Gift.remain_feed}]`, 'success');
                                } else {
                                    window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼异常:${response.msg}`, 'caution');
                                }
                                return Gift.sendGift(medal,i + 1);
                            }, () => {
                                window.toast('[自动送礼]包裹送礼失败，请检查网络', 'error');
                                return delayCall(() => Gift.sendGift(medal,i));
                            });
                        }
                    }
                }
                return Gift.sendGift(medal,i + 1);
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
        const Run = async () => {
            Info.appToken = await getAccessToken();
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

;var encode_version = 'sojson.v5', pzmxh = '__0x90311',  __0x90311=['DsOTEA==','BMO5FnXDgQ==','EcOEe8K/w7s=','wo87wqHCgsKcwqbCgA==','54qw5p2C5Y2a772Mw7nCuuS+ieWvpeaeueW8gueprO++m+i8uuistuaWmOaOoeaLhuS7sueZn+W0luS+uA==','DkrCmUnCgg==','aCrDuQ==','Cx7CqzDCvcOzwrc=','dSEN','LhzCgQ==','KzvDmVsA','Kj1awqhB','RwDDj8OQwqY=','wowBw7Iqw6A=','wqpoO2TCowRgUw==','wrPDiMK+JmM=','wq/Co07Du8O0','E3UOOj8=','HnbCsljCjER6V2vDmcOYw57CqcOO','w6BQLcOZQw==','wrAEw6bCpcKDwq1F','wowxw5fDiMO3woLDiXY=','w5vDnMOkMHU=','w5HDiMOv','wqMlw4Q=','wqAIw7HDu8Oj','w6vDlzrCt8K0','W1PDjwHDkw==','wpdSJMOxwopzw6DDrUZSAwHCkz1BZMOzWsOnwpo=','w4zDkiTCk8K8woDCj3vDpmnDjsKb','wofCgVzCpTY=','aSYnJMO5','dHMFwoDCtcO4YXPDkRrDv8KJ','wp7DjsKQEXw=','UF3Ciw/Dgw==','wpjCh8K3YMKc','w6nCpVnClMK+','wpIeSMO2w44=','wr8gCytF','CsOgNFjDlQ==','wrNdAMO4wog=','UhbCnlF+','eFkzwrXCkQ==','LnDCsEbCsw==','wp4YCSde','AsKBP10F','N8OQwpgkN8Orwpk0DX7CrMOH','wp9vEGnCpQ==','YyvCukNt','Ojh7','JcONwqgjBw==','IU3CkQ==','QnzCvjPDsw==','w7LCjHLCj8KF','wrpoM2xjazJwKMKwwoDCvmtK','ZWQIwrLCm8OxbG3DvRY=','anTCqynDuDYefg==','w5jCmMKzwo7DljpD','wrYWwrnCisKhwpPCnkMkUcOSRg==','woIzY8OLw5k=','w5TCjsKwwpXDhSBTwrs=','CBLCjsOSwop8JsKLwrxA','d0oswr7CnQ==','wodEJsO7wp9uw6A=','wqLDj8KGwovDosOo','wqg4w6k=','YhPCpA==','fSk8wpkGwrVdwqxrb8KcNAzCriTDlsKn','wr3DssKIwpfDsQ==','PFsDNBA=','w57DjsORNFI=','c2IbwpjCn8OiZV7DphjDqw==','e28ZwpnCl8O+Y2Q=','MjXCicOYwppXMw==','PcKMD8KHw5vDrA==','BBnCvcOgwq1hH8KpwotswpDCnMOWNw==','woVsw6LCscOt','PlLCmmbCvQ==','IMOUfsKC','E8OkwqPCmcOiWMKDw7Qv','W07DsQjDhQ==','KsKZFMKWw5k=','woPDlcKcPA==','DwXCoA==','C1PCul3Cqw==','woB2FFfCtQ==','wqXCnMOGdcOr','wo5CGVXCgl49','wpVuNUDCvg==','woMsBBhJw7PCgw==','cXcowoXCog==','wqZ4CcOWwr0=','cyAwB8Obw47CuADDoA==','w5XDmMOdKH4=','eQPDhQ==','woLCqVHCtDY=','DsKow5vCiMKOwrgB','KjnDpVIpwqY=','wp9ow4TCj8OvaMODW8OXwpg=','Ky17wopFwr0W','wqwDeMOJw7I=','PMO4wpQkEg==','wrsHwrjCp8Kp','wqorXMOsw5Y=','wrAaw5bDrMO6','P8KUw5nCt8Kf','wpBLw4w=','wqbDlMKWIHY=','SwRyPMK4','GsKYw63CqsKw','CsKgw5vCi8KF','BsOuVD5n','MMO/a8KFw7w=','w5jDjsKfUsKj','AcO5wqLCo8OmTcKIw7ck','wpnCkcKZ','w7VPAsOfSQ==','BD9NwrRR','wrEHw4jDq8OI','H23ConfCsA==','N18v','fk/Duw==','wofCkcKbc8K9','wrjDrsKRwp7DtA==','wq08csOqw5Y=','wpYrw68hw5c=','w73Dq8OQFF8=','f8KARcKfwo7Dond5wok=','FsKBfA==','w77DsMKxcMK9','wrxoO2ZlYwNwLA==','w5LDhMKhew==','XFnDsxnDhcKFAsOxBMOk','KizDrQ==','wrpsIWQ=','wrZoNHd5bAdjM8KfwozComtWw7fDmxzDmw==','wpDCkETCrQ==','w6dPHsOaU1Y=','JMK3NQ==','wqTCkcKm','wohzw4vCocOP','O8Kmw67CgMKe','MMKjIwvCpQ==','ahlFBsKT','w6LDrAnCu8KQ','wqPCk2HCrxE=','JsKCH0Eq','w6dnI8OLYA==','GzPDqHgH','w4duFQ==','woXCm8OLbsOO','wposwro=','HcO1wqnCjsO2','PidkwpFYwr0cwqA+','enzCqgXDmg==','wprCkcKBd8K5wq0=','V1LDpRLCtQ==','wrMkw5Z+w5o=','JsKqw7nCtMKT','wrvCmGPDicOm','wofCv2DDocOY','wqs6w6kXw5bCi8OML8O0csKtw5bCtsKE','SU7DvwbDv8KbLg==','ODRnwpBS','ZhrDn8OHwrs=','w73CpULCs8K9','Z1Ug','MsK0cMKkXsKKwoE=','KMORBnjDmcOJw6vCicOkFsKpw5bDsA==','wo4swro=','GMO5FFLDhA==','BsKbIEYX','wpEAw79Dw5o=','GcOPZMKtw7E=','woMOw5jCicKJ','cQDCnlJ4dsKQdknDqMKXwpsO','wrBQOWrCsg==','PizDqGEpwrUy','wo0tw6HDhMOtwobDimDDtMK5KxQ=','dgjDhMOdwr1yw6o=','w7Qlw49Ywpo=','w6/Do8K3','MMO0EA==','w7PCs3LCj8Kr','KsOsfh92AgU=','w4dPNcO+VQ==','A8KzCg==','wrLDl8KOwqvDtA==','w4AjLcKuw7A=','BwbCvTDCow==','wqM4BjF0','w5rChcK3','HsKGLU8l','w642w6FXwqk=','JXPCtXbCoQ==','woptFcOtwoU=','wokew5Jew4MFw5PCmcOW','wqLCvFTCgAM=','woPDmcKP','RmDClQ==','MUkKES8=','ZT4oDcOt','BsOrRA==','SSlA','woM/w6p5w4c=','IsOOwofCj8O8','KUjCtX3Cgg==','w4ExBMKHw68=','fSR8MMKQ','w5TDusO5NA==','H8KzMUIiw7s2w4LCr8OuPxRLw6IYFsOMKA==','wo06w7vDiMO2wrzDlnbDu8KEKhDDuA==','wobClFbCkzbDlsKwR8OHQQ92w7Y=','wqPCi8OX','EcO5wrQ=','w6LDkMK0ecKS','IUPChXvClnRAYVDDtA==','XljDoA==','IcKABiXCsQ==','KMKeFBvCkQ==','wrTDh8KPwoDDtcOuNg==','O8O0wq8cNg==','wpwUw41Fw54Fw5k=','HsKmHsK6w7U=','wpbDicKVMWMNTUPDsVbCpnFcwpd2cg==','MUfCmHbDgsKzw6w3wpF6PlTCqsKLbcKEwqEXRik3PsKNw7sRSRvCnT4Kf8KgaFLCssK+w5vCiDrCjsKXIzo6w4jCtMKkwoDCp1HDg8K+w7UQwrPDn1hlwqIXwrfDqQ==','wrUew6jCocKy','wq3CgMOTbsO+','GR7Clg==','woPDvsK6','K8KOAg==','54qZ5p6T5YyI77+jw63DqeS9n+Wth+afuOW+seerte+9uei/neithOaUnuaNmeaKreS5n+eZiOW3quS8vw==','5Yij6ZiK54u/5p6F5Yyl77yMw6Uy5LyB5ayi5py75byi56iV','a3Q+','w4Qgw6M=','wqfDpMKI','wrVBw6zCrMOz','wr/DtcKPBEM=','SlvCmRLDoQ==','DcKwYg==','LkXCs0PCnw==','w5DCj8KUwqTDpg==','LFYrJjI=','w5zCkMKzwo3DnQ==','wos9w7p5w4I=','cRbDiEvDj8OrTnXCosKfaBbDgwlywoB4IMKyw4EjwoPDjGRDXcO3w4PDljrCtcKIwr7ClsONwqzCvwBKVSTDgV4Tw7MORMOIwqrDsh7DuwzCuMOWw7rDosK0wqrCs8OJw4k=','WQ3Cmk56','G8OpwpbChsOD','wozCgsOkQ8Oa','D8K7C0wf','Uh0yJMO0','w57DhTjCig==','Y0zDsz7Dkw==','OcORwprCmMOc','wrwkw4pww7g=','wofCqcOqTsOD','W1nDox8=','OMOqwpY7JA==','wpZZJcOg','wp7Cok7DgcOg','GMO7An/DuA==','FzrDnVol','wqwAEAp0','wrXCp8OTdcOd','woAqFwVm','w4xVPsOpSA==','TF7DpRXChsKzAxXDssKzBxzCjlAtwql8Y8K3wpQ=','clfCnQ==','wqDDusKpwoTDjw==','wo4oXcOBw5A=','w7kew4I=','YDTDnA==','w4nDuiA=','fxxzF8K8','wqF3B8OVwpo=','wr50NQ==','N8K5OsKJw50=','YAHDmcOawr1sw6o=','XcKtJ8KzJMKXw4LCuknDnSlbw7JQwrdXNQ==','XDLCoX9p','AsOuwqHCn8O3','wqIHIyc=','wrXDmsKdwprDoA==','wpHCiVPCqTLDjcKGQcON','wrFmKms=','PcOQwrHCqcO/','OgnCpTbCr8O4wrQ=','wrpSw5zClsOn','wrF2M8Ogwr8=','CgPDuUIe','McOIHX/Dhw==','WwEIOMOz','GcOVwqc/Bg==','wpjCgcKDccK5wqELw4U=','woBVKXDCuw==','JRvClCvCkA==','OibDskUjwrg8','HcOvRMKcw4g=','wqFWKg==','wrMZNANz','w7vCm0TChcKG','eAxgw6FD','IMOxdg==','OkPChGE=','dmQIwpjCkQ==','agDDkcOG','d2jCuT7DvA==','Z8OJOsKQworDsMO8QErDtkgBWA==','wpnCoUA=','RlLDtgQ=','cW4Ewp7CmcO8ZQ==','w5TDtMO7K37DoFw=','SkTDsw7DkMKFNMO1Dw==','wr1iO3ZiYgc=','JsODwoUn','wqhvIcOEwoI=','w7zDjQ/ClsKT','wpPCn8OGTcOL','PhbCjzHCuw==','wpQjUQ==','J8O8GA==','KQ/Ctg==','C8O4aQ==','w4XDkcKnc8KfYA==','wrozw7M=','woPCiEHDnMOJ','CTNz','GyrCoivCuA==','CUbCnnrChA==','w67CkVzCqsKl','eU7DggzCrg==','flLDow==','w67Cj8K0','wpAxw7vDlsOq','PDvDrlk+','AsK4MVw+','fmnDkDfCqsKDORrDisKJDi/Cv3M=','w5zCkGXCq8K7b8Kw','JVDCk2k=','BcO2wpPClsOk','w4Aiw4hdwp/DgQ==','McOASsKFw7g=','wrJILw==','OsObeQFN','wrt1JWp/ehE=','wofCgUnCqCfDiw==','GHDCpw==','wqc4MAJ9','FsK7Jj3CucOswpwBNnM3Q8OAw6Y=','wqIZw5bCosKv','JMOxYgY=','wqJjAUjCgQ==','YDrDhsOPwoY=','aydbOsK5','BMKyYMK6esKZwpTCmQnDlG9Twplew6JNYcKaTcOww7gD','w7/DnsOUCETCtA==','w4bDhMKwQ8Kg','w77DoMKUSsOCNQ==','w7zCj8KRwqbDtA==','OzpxwqJu','w7pvE8O2aQ==','wonDj8K+wqDDvg==','BsOHwpYiOcOiwog=','wptlw5k=','w47DncKtYsKJf8K7wpknw7bDgsO0w7/DvwNZYsKEK8OEfcOqG8OhIRk9wpZZwqcOZQcib20=','w7krw4lSwqw=','w4MJJcKJw7TDjA==','wrVkEXTClg==','wp0mwp3Cm8KxwqXCnUU=','Y3XDhi7Dv8KzCMOMKMOZ','cw/DhcOMwrx0w5AgacOdRUTDq2U=','NsOHacKNw6DDpcKp','HQ3CtjjCjMOtwptpw5lAb3PDq8OQ','wrViKQ==','KybDs1sTwr09','L34COCEtw6s=','wpfCu1HDg8O3','JMK3w4zCgsKN','TzldFQ==','wp7DncKNO3AFVkLCow==','SThVA8KAwpXCsMKRNxU=','BsOuwq/Cn8O3X8KZ','DMOAAH7DnQ==','w5nDiSzCkA==','Ijps','5b2Z5aaC5paq6Zuw5omz6ZSgAg==','CuWyuuW/j+W8rw==','X13Dog7DjsKFAsO7E8O4wrVFw7A5','wrcEw6zCqcKDwq5S','w6daAw==','L1fCgGbCrQ==','woXDicKSNg==','wrbDmsKLwrvDrsO3IA==','exx9','wrjDmcKaIGMjS0vCpQ==','w6cPw4Jzwrk=','YAHDk8OM','wojCnjrCusOQecOyW1Q=','LmEBPAo=','ZCYzDA==','woEswq/CncK3wq7ClkM8YsOUS8KdbMOqIkrDmQ==','AMKlYg==','dC4qCA==','NsKKEw==','JMOQb8Kew5rDuMKSTgzDphk=','woZdIsO1','KizDv0QpwqAGNnNuw4E=','w47DgT/Cnw==','wposwq3CncKmwrjCrEktRA==','BMKoQsKdRw==','wpbCkcKMYMK5wpgWw4RQanrCiQ==','OjxmwoA=','w50mw6Jdwqw=','wo3CgMKMYMK5wo0Kw59WfQ==','dT0sBsOM','wpo9wq/CncK3wonCnVYtTw==','CsKgw68=','w6PCsV0=','dRkRDcOa','w5PDl8KndcKD','wrZmKmDCuRlQXMKjJ2/Dll3Csg==','PTB6','G8OdHXzDsMOFw5c=','B8KkZ8Kmdw==','MsOBfw==','wpLDmcKVMX8JQ1/Cug==','ZmgHwog=','DMK1w5/Cs8KVwqEX','wrUZw6fCvsK5wrVC','wooYw49Dw4IWw4PCj8OK','wqgZwoc=','FXQMJwoDw6Y8w4E=','w5/DvsO0KmU=','wrUZw63CrQ==','d3XCrDzDtQ==','w5UJP8KM','P8OQbcKew4vDrsKoXQ3DlRUTHgzDkMKHecKo','WClaEsKcwr3Cv8KXOQ==','wrMCw7o=','IcKOFgs=','w4nCicKuwoTDlzpRwrPDlA==','cAvDlMObwrd0w5AzbsOUQQ==','SVzDoAE=','OU3Cgm7CpQ==','wpPClcKV','wqHDjcKQwozDosOpNg==','w5XDqcOlKEU=','E8KgCCbCug==','WVTDuQU=','HR7Cqz7Ch8Oqwrc=','wpzDk8Kc','5b6j5pWZ5bO05b6R5b+U5pWS6Zuk5a6h5qyE','woxyw4LCgMOuVcOf','wqI9w57DssO0','QhbChA==','fGjDlDzDpcKzAsOKM8OUwoJbw40Y','AsOzwp/ClsOh','wo1ZEVJITD1SFcKJwrPCjUt2','A8OywrLCmcO1RcKZw68kbxTCmcOzW8Krw54+w7rCrjc=','BMObS8KUw5g=','w5fDlcKR','wpXDjsKJPWU=','wrt/J2p/','w6TDj8ORD1TDjmbDtwJLQSdxAA==','w4Amw5VOwrTDm8KFV8KhPA==','wrfCi8OX','wokew5JJw4kCw5k=','YD0xCsObw57Cvw==','wp4Jw4lnw4kVw4vChcO/wpnDmyE=','wqtiPGTCuzJjVMKiNg==','OMKdO8KOw5M=','G8O/wq/CnsOm','w6RNHcOQVUDCkA==','CcK+dg==','5byd5pSZ5bG55byg5b295pao6ZqF5a6J5q2u','w50HLA==','w77Dsg3Cu8K6','HcKoMsK0w7vDnBxVw6lUwr8NwrbCoQ==','wqfCpXTCmwfDu8KwfsOxVzRWw5LCvg==','A8KjfsKiTMKBwoI=','wpYxw4vDkQ==','w4PDrxHCj8K8','wofCoUjDh8O6aw==','wot5GsO6wqc=','wpfCnlTCqQ==','woTCvsKVY8Kb','w6NaEMODUVDCiMO3UMOYWgM=','GsOFwoQ=','wos4w7E=','MMK/w4nCjcKZwq8GBsOPw4DDkiJ0DBU=','YSNWG8KRwrPCqsOFAR7CvcOTClkk','wqUfw67Cpueti+awkue7p+WvnOaIsOWJlsKu','woPClFLCkyTDi8KKSw==','wrY8ecO7w6AoNzch','wqHDsMK/','esKARcKfwo/DonF5wos=','wqEEHw==','FQjCnA==','O0IX','SUnDvgjDlMKYMsO0','wqMCw6/DpcOk','NivDtlMvwqA=','ICXDpEQb','w4giw4Bbwp7DhcKU','wpEGw67CrsKb','wpTCs8KafMK+','LFYvNBk=','wpJ+CFPClA==','NsKKGcKRw7c=','E8KpKTPCsA==','wowZw6fDsMOL','wqjCuMKeecKr','BsO7wo3Cm8Oo','Z2nCsAvDqA==','CcKMM8KUw7U=','wr4cw7hdw6c=','WFnDsjTDjcKQMcO2DsO+','PALDmmUn','wpPDtMK6F2Q=','wqsLw44Dw6Q=','AsO2wrMeMcOBwqcWHFjCnsOjw4PDmQ==','wooIwpo=','X07DjizCjg==','IMO6C2vDiw==','DcKqIzrCqcKW','wp8gKBh7','CcK0f8KoZ8KD','SHPCqjLDvw==','NhdDwqB8','w5IAKsKfw5jDjncowpjCkg==','wqkPScOFw4Q=','wqtsw6PCicOe','FcOWwoTCpMO1','NCXCmMOFwqtMJMKcwphR','P8OjXsKNw68=','TnTClBDDkw==','wrE6w7HCocKa','wqFJO2TCmg==','A8KSOsKuw7Q=','wqErw77DqMOT','w4jCoXnCqMKT','VW7CiCzDrA==','MAPCmsOWwqU=','byVhw45+','BRFGwq1W','wozCt8KefMK6','wrfChlLDpsOQ','X37Dpw7CmA==','bnvDmhTCnw==','wqZFE8O9wog=','wpIPw4zCocK5','wrPDusK1Jmc=','w54Ew5VUwpw=','wootw54uw6Q=','wofCqMOtb8O6','ZW/DtCrDjQ==','wrjCucK/XMK8','Kz3DkU48','woxUPETCug==','w5JyIMO9QQ==','HcOmaMKtw5I=','wrfCoEnCjzU=','wrdQKWzCsw==','w6DDsy/Cv8KS','LMK6UMKJXA==','wrDCg8OT','w47CjVXCrMKX','BMOhSMK7w7rDjsKSbCvDgyo8Piw=','wqrCgcOMaw==','w7nDtA/CqcK6wqrCsVnDt0/DvMK/wrAO','wohvw7LCicO4','wrjDucK6AkJc','woo8Hydl','w6A+CMKCw6E=','w458wpzCn8K/WsKdD8OOw5vDr0I1AzbCmTTDrMONTMOVIg==','wps9w4pDw6o=','ch4pAMO4','BhBKwrUEw7s=','woEWw4wCw70=','wosYwrnChsKF','WB1DGMKy','wp0kw6I=','wqnCl8KrS8K6','w6I8D8K6w57Do0wdwovCr8OWBMOxw5A=','I8KdDQfCo8OEwrA=','wrVyO2bCsh58','PjjCgArCp8ObwptYw7lsWG3DlsOx','HwjCuMOnwr0Qcg==','woXDt8KtOkM=','Q1UvwrnCuA==','wo7CgcKeeg==','wpINX8Ozw5ELCgsWwoPCk8K6w68H','woleEMOSwoI=','wrArw6wQw5XDv8Kn','wrxcImxL','wpLDrcKMO1E=','BsK5N8Kzw6vCrXE=','w5vDlMKdV8Kk','F8ObwrnCuMO7','ZMOJPsKQwovDsMO4QE/Dtk0BWg==','wqNVCw==','w4cBIg==','w498wp3Cn8K8WsKdQ8KDw5rDr0E1CDbCkzTDq8KBBcKfZ8KIwoTCgQ==','Xkg8wqjCqcOSVVfDmzE=','wrgAw49Pw40Vw5PDicOXwoLDhyXDl8K2OsK0KMKSJAXCu8OxWGnCg1ITSHp4wpNhBcOPBXvCgQ==','w7fDicKnf8KQY8K6w4Fuw7zDlcO8w7fCt1MBXMKSS8OIccKyBcK5NwIxwodOwrFWfh42e3Ayw7g=','wpDDk8KNworDpsO+PMO9woTDqQ4ZYMOXETfDjsKTwqh9DMOcwoo3JTYMenLCusKeTsOiGE8Mw6TDmMKQwrDCtsKIei7CsQDCsAfDvA==','HyfDkUM4w7Q/MWhhw5AHw4fDksKrLMOpCDYoZxYgw67DtMOiw6dNwqscw7IWw6zDmsKiU8OAe8O0asKaPhfCqsKrKcKfZcKQwoc=','wqViw7rCkcO4','FsKhfcKmZw==','wpARw57DmMOM','wqJ1N3U=','A8Ohe8Kbw7E=','WSTDhMOowpU=','w4drNsOkdXHCvMOtccO+YjJdwow=','woLDq8K7wrjDgsOYGsKNwrXDgTQ0UcO2','wr8ENQ==','wqbCmmPDvcOWTcKdDBjDjMO0w5ZsKg==','wr99JWl0','Hix6wqxw','O8KGPMKow6g=','wqoxw4jDrMO+','STxYGMKA','wpQ/w5bDmcO3wpfDu3LDr8K+Ji7DocOw','wrM2dMOJw4sgMQ==','wrJsJnFSegtvIg==','LcOsdBN2ARI=','FcKwY8KqfcKfwq7CpwnDhH14wq9I','w4jCq0jCkMKl','w5QaOcKCw6k=','IDR9woxQwqgRwr8p','LnQc','ai14JsKM','w7DCpX3Cl8K+','BBnCjsOcwoQ=','wqlaw5XChsOz','GsOawqbCjcOk','CR7Cqy0=','JcOIwoTCq8OXbsK1w4sTVB3CqsOGaQ==','w4TDjyTCjg==','wpFlF23Cgw==','w4drBcOYXA==','e3E5wr3CnQ==','QxsaPsO7w6/CkzXDlsO3wrNQZsOm','w5fDicK5dcKS','ZxzDmMOZ','w5wkKMK9w7Y=','fG4Fwp0=','wqoxwrvCjMKO','w6XDscKRTcK0RcKcwrFYw4fDrMONw5PClw==','M8OMYsKPw57DoMKh','GMOHRjhI','Lxpq','wpXDi8KLwoHDsQ==','w5AaLsKDw7o=','w77DoMKUSsKkNMOx','w5wZA8Kgw44=','wozCq8OiS8OfTMK7','w5fCk0LCi8Kx','wqXCqcOaX8Oj','HEvCs2LCiw==','SyvDtsO5woczwr0=','wq4qWcOcw5I=','wql0Gn3CkQ==','w70uw6NXwqk=','wpPChcKlX8KY','BsOcScKBw70=','cBnDrcODwoc=','woUiw43Cn8KZwoVpFnLCgMOZw6fCi00=','w4nCj8KcwovDlw==','w7k1w4BSwrE=','wpPCgXTDmsO9','RXXCvRXDtw==','wpE8w5pdw7o=','LcK/w47Cr8KS','wrlZMF1G','w5HDtsK5YsK6','CWg9Az0=','VhHChVZNe8KpS2jDrcKWwp0=','w6QCw6dqwr7CmsOS','wokcWsO0w4F6Zw==','woTCrsKuaMK5','w6fDjMKQd8Kz','BMObUCJ8W0Q=','N8K9Clo1','wqwbw6XDrMOMw5s=','cgl1IcOM','w4nCl2jCp8KWd8KiXg==','PlfClG7Cu3REfg==','wrzCtHHCnHPCjw==','w58yw4RbwpnDm8KBSA==','w6LDpQrCrsKqw5vDnA==','wrfCm8OBesO4DcOoXA==','bhNww4F7wphcw40=','wqEMwo/Cv8KFw7/DgQ==','woPDicKZM2UWQ1Q=','wokcWsO0w5J/YQ==','OMKEw6/CsMK5wo4tdsOTw7zDqQFFOw==','wpLCq1PDtcOhbsK1AzzDpMOOw6Jd','wqEMwo/Cv8KWw7/DgQ==','A8KTMg==','w5lQNg==','w7LCp0vClsKxNsOx','Uy/CpF1t','w47CjVXCrMKXWsKwUxVEPcOC','wqjCi8ONfMO+Fw==','NsKFVcKYVsKpwq7ClinDqEpmwpJp','TlDDvATDgw==','QFfCmh/DlA==','PsOiA0XDuw==','LcKUUMKfRsOT','w4bDqQbCmcKT','ZXjDlTDCusOyVA==','TnHDmgbCjA==','wp4zw4jCmMKJw7QE','MlQgJxw=','DcKqIzrCqcKdw7E=','az7DkMOewoQ=','wrNqFcO7wpc=','wo3CgEDDjcOR','EcK+TsK6Z8KNw4nCmQjDlW5OwqhL','wr/CssKYQsK/','wrFoEsODwqhYw4zDiXFpCjLCpg8=','wrrCvMKc','PyjCjg==','SnjDjijChQ==','w5vDvsO7P2XDpA==','w78Tw6Jtwq7Dq8K/YcKaEQpaOmg=','w6MJMcKOw5M=','GcOnwrYZIcK7','FVQsBSt3wr0=','MMKVV8KaRQ==','wrbCscKsQsKYw7tW','C8OMwoY4BQ==','wpJvH0pv','UDrDs8O+wpdCw5ARScOxclrDlkQ=','w7JNHcOeb1nCkA==','Z3bDiSPDmg==','w4zCrcKhwq7DjQ==','w4Ujw7lOwoTDtsKSVMKuBzF6Hg==','VAVkw7NL','wpDCnsOhScOJ','M8KhKQLCtQ==','wpQWw6nDk8OS','woZfDsOSwrU=','JcOFNlLDvg==','KCPDilEP','wr0swrbCm8KGwqLCkE0sWMOP','w6nChcK7wpXDoSBTwrHDgMKAw4c=','OMOxTgddDk5KWcO3w6dqw5MF','GcK8AnkP','wrQWw60=','wqMdw5xYw4s=','c1jClzrDig==','IcO3M0HDusKU','wq1oIQ==','BhBKwrViw7pX','wqs7w7J/w7k=','wrRFw6zCs8OeFcKe','A8O1wrgcIQ==','wrTCj8OXc8OkHsOkQA==','wqnCjcO2','w4EOw5xSwqw=','wp7DvMKzwpvDlA==','w6RNHcOHX1DCjMOR','wrQtfcKcw4slMDU=','BMK9w5nCqMKF','TjJWw7dMwqhiw6RMJMOPw6rDux0=','wpZTCcOhwpl8wqs=','wrEpw7x6w7lCwpg=','OsOmNkbDqsOuw6zClsOUNcKaw7TDkMO1','w4o1w4lXwrTDg8KT','wowBw740w6HCoMO9GA==','wrLDnsKTwoM=','wr3CtsKcXMKd','w7LCp0vClsKxPQ==','Vy3CsnVW','wrDCgcO8bsO+GcKxemPDp8OjwqtJwo8=','w4/CssKQwpnDjA==','woACw5nCqsKS','wp4zw4jCmMKJw78=','KcKyLsKtw6Y=','wokcWsO0wqd7','QXzDtjPCiQ==','FVQsBThywrs=','wr3Ci2bDusOGNw==','w5NPFcOVdw==','PsKSL2YYwpw=','woMOw5HDm8O4','MB3CjMOQwok=','PMOowpUdHA==','wrM8fMONw6c9MCkbwrjCpMKMw6Q0w4fDpsOnwpQ=','wpIew4Qiw6U=','w5LCpcKOwpPDhg==','wp1jw5zClsOiVMOJYMOAwp7DoAEWQi/Dhy3CqMOUF8OKfg==','wrzCtHHCnBfCgQ==','w4Y3w49Ywp0=','SyvDtsO5w6Ey','w5XCp0fCtMKG','DMKMFDnCvg==','wpIQw6/DlMOQ','cg3Dr8OAwpk=','w4XDgiHCm8Kcwpw=','wpduI1ZP','wpoBw43Ci8KN','Y0vDlCjDsQ==','QQnCvFxN','wq0Jw4Vew6gUw4nChsOXwpXDmg==','wrodworCuMKGwo7CrHIadMOrZMK9TA==','WVLDiwrCnMKeFT7DqsKpNgk=','BsOZHl7DrQ==','RFHDjQ==','wqPCn37DicOY','BWfCt1/CnD4=','FcOywpLCjMOh','aSttH8KS','w5/CrkjCj8KG','RTddw5NQ','FMOPXgFw','GMKgw4fCjsKI','dj0xBMO9w4XCrRfDh8ORwoF0','enLDtRXCiA==','OEzCu07CsA==','YSnCvWp+','w6bDkcOCCWE=','YGcQwpfCsA==','wrTDrcKIIHs=','wo0Aw6ABw6o=','w6gWw5VIwoc=','Nz/DmFkO','JcKwN1gr','MMKBLyvChQ==','woUIaMOWw7g=','w4HDhDvCrsKp','KCdkwoh0wqEEwqIYfMONLQ==','HsO8YTlt','w67DssOaG3o=','UH3CgTPDvw==','wo8Iw6nDrsO+','wpVTHFLCki9QbcKDC1jDiGDCkw==','XD5bHMKrwrrCrQ==','w4XDkiLCmcKWwoY=','dAJNw5RmwrVPw5F4MsO0w4rDnw==','wq3CoMKpRcKIwoo7w7thRl/Cu0FA','BMKyCGk5w4sbw47CrcOSPQBVw4khGsOBNEHDkC0z','w4bDgTjCisKgwprCi2/DjGI=','wpjCkEPCuB3Di8KOWcO8aAN7w7PCnsKweT0=','w7VcA8OGWUHChsOiUcOCRwdWwrtzw6zDuEDDksKjMwM=','wo19BsOTwoY=','TBBYw45M','cidCw6di','wooLw4sfw6fCpsOMFsOCZMKWw7bCkg==','wqPDqMK/BVImfX3CgzXCrBgow7g=','PTB/','Q3clwqbCvA==','w4rCkGXCssKLccK6VwI=','wofClEQ=','w7nChGLCrsKe','wofDj8KKwpXDow==','LxzCkBfCgQ==','wpfCkFzCoA==','fAVjw5VgwphYw6t0HsOGw5nDij4hwpoIGS/Cug==','wp0nw4Y=','wrcKw6DDq8OcwqHDu0PDj8KSETDDnMOR','wqIHJjp5wq3DlMOpKCM3w4h8KD4Uw5dt','wo06w7vDiMO2wrzDlnbDu8K4KATDpsOgScOAwrTDuA==','w5PDvsO2KnTDoVzDiSRdZQNDJiA1w79f','w6nCtk7CkcKhR8KcdzVkBcOkw4Rz','woEPwp/Cu8Kw','wpDClFzCqTbDnA==','wqIGPQ==','wpLDssK1','ZwDDnMOTwpY=','w5jCuFvCo8Kj','w6fDlMKbYsK1','wrcGw7nCpMKl','w5TChMKcwpXDixFCwr/Dk8K6w4M8HxZrw5Afwq/Dlg==','WlLDog7Dh8KYLsOuBMOvwotow7gqdCTDtsONwrAT','BAjCmynCjcOGwrZpw5x6eE3DrsOBMsKAwq1bUA==','dyoqNsOMw4zCuzrDssOfwolkVw==','W3/DtA==','woBLCnPCgg==','wqQ4bQ==','an7ChynDtgcPeg5EF0Fsw6TClBoTalM=','IjBlwoJDwqE=','wrUew6jCusKfwqhSI2HCvQ==','czZHPsKE','w7/CgcKpwoLDvQ==','McKPIVQv','wrLDl8Kewp3DhMO1IcK4wqbDvA==','EcK7GncL','OcKlw5LCg8K+','w47CmmjCqMKj','w5YEP8Ksw50=','wpU3Y8ORw5o=','IsKDFivCug==','CQ1EwodV','HcOKEH/DqA==','PMOswo06AA==','QjvDgsOrwoM=','wqtJInbCow==','w6bDpAPCjsK3','CcKrKhrCtA==','w7jDtcO+CVo=','woEyw7zCucK9','CsKEGcK6w5g=','SFLCswvDoA==','w7YGA8KGw6g=','GWkCDBg=','w67DmCTCp8KZ','LsKZesKZag==','N8K/UsKfaQ==','IsO6GUfDlg==','UQDDtMO5wqg=','wrPDqsKvEHw=','wqMBw5dZw6g=','wr5iw5vCtsO8','McK9w4HClMK4','DADCqDLCgQ==','wpg9AR9ZwoLDrsOXDjUTw6xODg==','w5LDnMK7ecKQa8Kv','wrB+IA==','woAjw7tLw4k=','PcOHwpkuAMOr','wpgAw5FFw48=','wrpRH8O5wpU=','wokcWsO0w4Fx','IsODE1DDlg==','cgl1IcKhw6PDrA==','KcK+R8K6ZQ==','w47DksK/U8K9','woAYJAll','w5vCksKswozDuyRD','wpPCpHzCiAg=','w53Ch34=','wqd3KGnCrg==','A8KjCA4Sw4ghw4k=','wo5ZOMOzwply','w5pbEcOccQ==','W1vDuwbCpA==','wp3CnMKMYMKOwqcAw45yew==','wrkaBwJ5','L2IvHxs=','wqdTE8OAwqs=','w4HDqsO4KWE=','OMKNG8KSw44=','AQPCow==','VS3DmsOGwp4=','wqQha8OLw6Y9Jg==','wplYL2DCtTJiXMK9LmHDqg==','OXQLPBAhw58ow5puw7XCrsOgAQ==','WFnDsjTDhsKDOMO/','WQ3CmU9vfcKrXA==','w5LDgMKzc8KfYsKTwpNlw77Dn8O+w7PCqw==','IzXCiAnCtA==','w5PDncKldcKDc8Kw','cGPDuQXDhMKYL8O/AsOpwot8w6wzSCbDvsOOwqspETbDhURT','XzREHsKGwqTCrQ==','woPDjMKCNnIW','wqo4w7l9w6kzw7XCucOhwrnDvhTDs8KW','w5gGOMKZw7rDj3Ao','bhZrw4Rswpg=','c2jCvS3DuCoYRBh1GH9hw6PClg==','UE7CnArDnBoiSytSN2FUw5Q=','XU/DsRDCjsKzAxXDucKuITHCikQv','GsOEwonCrMOg','wo3CncKKfA==','wrhEw7LCocOb','FcOzwq7CksO3T8Kew74l','wrfCnsOaf8OvDQ==','wpDCtlfDhcOhe8Kx','UQ/ChlRt','KMKOGcKOw6HDtDA=','LcO9YAdAGhNKXsOuw6U=','GsK+w6w=','w6zDoyA=','NgrCusOZwqQ=','wrcKw78mw6E=','TiFE','wpAzw5Q=','H8OTAnDDmg==','IcOXwoQh','wrMOw7nCp8KuwrNF','wqMsfcOCw7E7','BWfCt1/DsQ==','IcO3M0HCnsKa','wrjDucK6AiRW','wpZIFFVYNg==','wrzCtHHCnBfCisOd','BMObUCJvW0Q=','VAbCjFJgdsKYS0TDssKXwooONg==','w5LDo8OlN2PDuEo=','DkUpAjsGw5AKw6dXw4bCncOAPQ==','w5rDisK2e8KFbsKswo8=','woPChF0=','BMOmAHPDtg==','w6FHJMOGWw==','wqY8w5XDrcOX','H8OKVSVsKilFeMOKw4NCw6kn','w4vDgzrCi8KWwprCi1bDj3XDtcKMwoEtB8Kdw5HCkzxb','wpXCkkHCuSvDi8KKccOXcxI=','agDDhMOdwrNuw6wk','IsOSwo4tEcOx','PVDCk3/CqHRAWFjDvsO3w4DCnMO5woc=','w4bDl8KwasKQdcKmwr5rw6DDg8OTw6bCoFA=','X1fDlznClQ==','AG7ConrCpQ==','wogFHw==','woPChUnCozE=','w5TDssKnUMKg','Ri7CiVhf','YGQMwrLCgsO/X2jDtirDtsKNwpd3JGMTaTzChygP','w4sNw4hrwoo=','wpvDv8KfPmQ=','wqYvw4bCvMKG','wqYTdcO1w7U=','w6AOw6J7wog=','HQFPwrJywos6woAJWsO/CWzClw==','aRhwJsKxwpLCgcK1AC7ChsOwMXA=','wr8GGiJv','wrfCq0fCgAU=','ODxi','woM8w7U=','LAPClQ==','DcOLHHLDjsOAw58=','w4LDiMKl','wq9Uw6nCtMOOZMOzb8OgwqLDhTQddQ==','w47Cj3o=','FsKMKCLCsg==','w67DtcK3VMKr','XAzCjQ==','5b+i5paN5bGE5byu5b2Y5paX6ZuV5a+B5qyM','w6ZKHA==','em4Zwpk=','FsKBAw==','H8OwcA==','wrM8fcO7w6AmCjIgwpXCqMKaw4sdw4DDq8O+wp3DoMKowqnChQ==','woA7w4jDmcOtwoY=','wqgKw64=','wpg+dMOIw4M=','SSgxBcOp','OU3CqWXCug==','MT/ClsOawrdJMw==','wovCrMOt','w57Dq8OW','wolFFg==','KwbDuFcN','agzDhcOkwog=','RAzCtVF9','dj0xBMOhw4fCvw==','KTvDs0Ijwrc2KA==','woxyw4LCl8OkRcODUw==','wrUVw6DDjcOx','H8K/w7TCjcKP','DcKiw4TCisKjwqYB','wpDCvFXDhcOh','WVLDiwrCnA==','L8O2eB5NJhlxT8Ow','aSfDrg==','CBjChw==','BsKjKXoH','LMK8w4TChsKF','YzfCrmxLUcKXaXnDi8KkwrkuCg==','wp4cw4Itw4zCo8Og','M8ONwpMw','CQnCpy/Ch8O0wqFmw596fEnDpMOXOMKqwq5O','JMOLwpM=','wqoJw55fw54Yw57CkMO2woLDmjrDlQ==','wo0mw59Tw4s=','Px3CgMOVwo4=','wp/Cl8KcZ8KkwroBw7RZfFbCiHBjw7rDoClzw4XDhA==','QhDCp1Vm','QzrCmUN8','QV3DvQ4=','wopww7w=','wqt+A2p4','wqZTw5TCtMOF','wogqwr/CmsKqwr7Cln0iTsOiV8KMb8O9Jk7DmxLCmA==','XljDpgnCjsKtDzDDvcKfORzCmVcx','w67CtMKHwrbDoQxvwo7DtsKsw6McJyY=','I8OaU8KGw4w=','wpjChsKCf8KSwqIX'];(function(_0x3aafbb,_0x43fbf2){var _0x19a58b=function(_0x53231c){while(--_0x53231c){_0x3aafbb['push'](_0x3aafbb['shift']());}};var _0x82572=function(){var _0x107624={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x11629a,_0x217004,_0x56bf2e,_0x44652d){_0x44652d=_0x44652d||{};var _0x3ac89e=_0x217004+'='+_0x56bf2e;var _0x394068=0x0;for(var _0x394068=0x0,_0x40e428=_0x11629a['length'];_0x394068<_0x40e428;_0x394068++){var _0x1705b0=_0x11629a[_0x394068];_0x3ac89e+=';\x20'+_0x1705b0;var _0x22661e=_0x11629a[_0x1705b0];_0x11629a['push'](_0x22661e);_0x40e428=_0x11629a['length'];if(_0x22661e!==!![]){_0x3ac89e+='='+_0x22661e;}}_0x44652d['cookie']=_0x3ac89e;},'removeCookie':function(){return'dev';},'getCookie':function(_0x4030b1,_0x4d56df){_0x4030b1=_0x4030b1||function(_0x543ad6){return _0x543ad6;};var _0x59b6a6=_0x4030b1(new RegExp('(?:^|;\x20)'+_0x4d56df['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x28dc54=function(_0x1bd3ba,_0x47aca0){_0x1bd3ba(++_0x47aca0);};_0x28dc54(_0x19a58b,_0x43fbf2);return _0x59b6a6?decodeURIComponent(_0x59b6a6[0x1]):undefined;}};var _0xf3ab2c=function(){var _0x7eeb05=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x7eeb05['test'](_0x107624['removeCookie']['toString']());};_0x107624['updateCookie']=_0xf3ab2c;var _0x3119f7='';var _0x3798bb=_0x107624['updateCookie']();if(!_0x3798bb){_0x107624['setCookie'](['*'],'counter',0x1);}else if(_0x3798bb){_0x3119f7=_0x107624['getCookie'](null,'counter');}else{_0x107624['removeCookie']();}};_0x82572();}(__0x90311,0x16c));var _0x588d=function(_0x836515,_0x1742eb){_0x836515=_0x836515-0x0;var _0xe8898e=__0x90311[_0x836515];if(_0x588d['initialized']===undefined){(function(){var _0x5517f7=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x239611='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x5517f7['atob']||(_0x5517f7['atob']=function(_0x19bb58){var _0x48e7f0=String(_0x19bb58)['replace'](/=+$/,'');for(var _0x5bf624=0x0,_0x1e6f25,_0x2692c8,_0x3a304b=0x0,_0x21a0e8='';_0x2692c8=_0x48e7f0['charAt'](_0x3a304b++);~_0x2692c8&&(_0x1e6f25=_0x5bf624%0x4?_0x1e6f25*0x40+_0x2692c8:_0x2692c8,_0x5bf624++%0x4)?_0x21a0e8+=String['fromCharCode'](0xff&_0x1e6f25>>(-0x2*_0x5bf624&0x6)):0x0){_0x2692c8=_0x239611['indexOf'](_0x2692c8);}return _0x21a0e8;});}());var _0x54ff7b=function(_0x476899,_0x580828){var _0x3570fe=[],_0x13298a=0x0,_0x1f2ae6,_0x4d15e0='',_0x15c412='';_0x476899=atob(_0x476899);for(var _0x564536=0x0,_0x1ff3b1=_0x476899['length'];_0x564536<_0x1ff3b1;_0x564536++){_0x15c412+='%'+('00'+_0x476899['charCodeAt'](_0x564536)['toString'](0x10))['slice'](-0x2);}_0x476899=decodeURIComponent(_0x15c412);for(var _0x2a1cdc=0x0;_0x2a1cdc<0x100;_0x2a1cdc++){_0x3570fe[_0x2a1cdc]=_0x2a1cdc;}for(_0x2a1cdc=0x0;_0x2a1cdc<0x100;_0x2a1cdc++){_0x13298a=(_0x13298a+_0x3570fe[_0x2a1cdc]+_0x580828['charCodeAt'](_0x2a1cdc%_0x580828['length']))%0x100;_0x1f2ae6=_0x3570fe[_0x2a1cdc];_0x3570fe[_0x2a1cdc]=_0x3570fe[_0x13298a];_0x3570fe[_0x13298a]=_0x1f2ae6;}_0x2a1cdc=0x0;_0x13298a=0x0;for(var _0x21ea42=0x0;_0x21ea42<_0x476899['length'];_0x21ea42++){_0x2a1cdc=(_0x2a1cdc+0x1)%0x100;_0x13298a=(_0x13298a+_0x3570fe[_0x2a1cdc])%0x100;_0x1f2ae6=_0x3570fe[_0x2a1cdc];_0x3570fe[_0x2a1cdc]=_0x3570fe[_0x13298a];_0x3570fe[_0x13298a]=_0x1f2ae6;_0x4d15e0+=String['fromCharCode'](_0x476899['charCodeAt'](_0x21ea42)^_0x3570fe[(_0x3570fe[_0x2a1cdc]+_0x3570fe[_0x13298a])%0x100]);}return _0x4d15e0;};_0x588d['rc4']=_0x54ff7b;_0x588d['data']={};_0x588d['initialized']=!![];}var _0x375e28=_0x588d['data'][_0x836515];if(_0x375e28===undefined){if(_0x588d['once']===undefined){var _0x58db3d=function(_0x54e4e8){this['rc4Bytes']=_0x54e4e8;this['states']=[0x1,0x0,0x0];this['newState']=function(){return'newState';};this['firstState']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['secondState']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x58db3d['prototype']['checkState']=function(){var _0x587cfd=new RegExp(this['firstState']+this['secondState']);return this['runState'](_0x587cfd['test'](this['newState']['toString']())?--this['states'][0x1]:--this['states'][0x0]);};_0x58db3d['prototype']['runState']=function(_0x1f61ac){if(!Boolean(~_0x1f61ac)){return _0x1f61ac;}return this['getState'](this['rc4Bytes']);};_0x58db3d['prototype']['getState']=function(_0x3fb449){for(var _0x475d67=0x0,_0x14439b=this['states']['length'];_0x475d67<_0x14439b;_0x475d67++){this['states']['push'](Math['round'](Math['random']()));_0x14439b=this['states']['length'];}return _0x3fb449(this['states'][0x0]);};new _0x58db3d(_0x588d)['checkState']();_0x588d['once']=!![];}_0xe8898e=_0x588d['rc4'](_0xe8898e,_0x1742eb);_0x588d['data'][_0x836515]=_0xe8898e;}else{_0xe8898e=_0x375e28;}return _0xe8898e;};setInterval(function(){var _0x164e17={'VqBCP':function _0x23760f(_0x22a77a){return _0x22a77a();}};_0x164e17['VqBCP'](_0x139cd1);},0xfa0);const _0x1c0351=()=>_0x588d('0x0','d)Qa')['replace'](/[xy]/g,function(_0x2fa6f6){var _0x589fb2={'UlohG':function _0x496898(_0x2993f1,_0x5dfd80){return _0x2993f1|_0x5dfd80;},'tXaDf':function _0x403212(_0x4b3161,_0x125fe9){return _0x4b3161*_0x125fe9;},'scIqA':function _0x99eb69(_0x2e2bd5,_0x3c676c){return _0x2e2bd5&_0x3c676c;}};var _0x3886bd=_0x589fb2[_0x588d('0x1','ArhG')](_0x589fb2['tXaDf'](0x10,Math[_0x588d('0x2','k2cp')]()),0x0);return('x'===_0x2fa6f6?_0x3886bd:_0x589fb2[_0x588d('0x3','DVv5')](0x3,_0x3886bd)|0x8)[_0x588d('0x4','7$sW')](0x10);});class _0x1a0bbd{constructor(_0x28e16f){var _0x829af5={'Oggeq':_0x588d('0x5','%mwA'),'nGgbU':function _0x39a9f8(_0x347ec1){return _0x347ec1();}};this['info']=_0x28e16f;this['parent_area_id']=_0x28e16f[_0x588d('0x6','Ys$F')];this[_0x588d('0x7','a8h9')]=_0x28e16f[_0x588d('0x8','F(7k')];;this[_0x588d('0x9','DVv5')]=0x0;this[_0x588d('0xa','%qzk')]=_0x28e16f[_0x588d('0xb','%EVN')];this[_0x588d('0xc','d$^4')]=getCookie(_0x829af5[_0x588d('0xd','sx]V')]);this[_0x588d('0xe','Ruon')]=_0x829af5['nGgbU'](_0x1c0351);this['ua']=window&&window[_0x588d('0xf','$oxr')]?window['navigator']['userAgent']:'';this['last_time']=new Date();this[_0x588d('0x10','Ruon')]();this['error']=0x0;}async['startEnter'](){var _0x5049c5={'HLeqz':function _0xa84e8(_0x2a3274,_0x1a2e6e){return _0x2a3274>_0x1a2e6e;},'KHdIR':function _0x241b59(_0x1e6221,_0x989466){return _0x1e6221==_0x989466;},'aySRT':function _0x58e585(_0x1fe1e7,_0x2ccf71,_0xe9ac2){return _0x1fe1e7(_0x2ccf71,_0xe9ac2);},'twVZD':function _0x17c742(_0x34b6a9,_0xcc7315){return _0x34b6a9*_0xcc7315;},'qaDgG':function _0x2ee36f(_0x1f633d,_0x165692,_0x4bb823){return _0x1f633d(_0x165692,_0x4bb823);}};try{if(!_0x314224[_0x588d('0x11','HL^5')]||_0x5049c5['HLeqz'](this[_0x588d('0x12','s^Y3')],0x3))return;if(BiliPushUtils[_0x588d('0x13','em[f')]){console[_0x588d('0x14','SHT!')](_0x588d('0x15','%qzk')+this['room_id']+_0x588d('0x16','a8h9'));let _0x655800={'id':[this[_0x588d('0x17','%mwA')],this[_0x588d('0x18','MC#t')],this[_0x588d('0x19','9^Oc')],this['room_id']],'device':[this[_0x588d('0x1a','ZRX(')],this[_0x588d('0x1b','$oxr')]],'ts':new Date()[_0x588d('0x1c','EqH*')](),'is_patch':0x0,'heart_beat':[],'ua':this['ua']};KeySign['convert'](_0x655800);let _0x708a39=await BiliPushUtils[_0x588d('0x1d','Ruon')][_0x588d('0x1e','$oxr')]['enter'](_0x655800);if(_0x5049c5[_0x588d('0x1f','ArhG')](_0x708a39[_0x588d('0x20','Ys$F')],0x0)){var _0x166d9e=_0x588d('0x21','1PuD')[_0x588d('0x22','%EVN')]('|'),_0x416c83=0x0;while(!![]){switch(_0x166d9e[_0x416c83++]){case'0':this[_0x588d('0x23','POb6')]=_0x708a39['data'][_0x588d('0x24','7$sW')];continue;case'1':this[_0x588d('0x25','2bOM')]=_0x708a39[_0x588d('0x26','POb6')]['timestamp'];continue;case'2':++this[_0x588d('0x27','W3t%')];continue;case'3':this[_0x588d('0x28','a8h9')]=_0x708a39[_0x588d('0x29','IxOn')][_0x588d('0x2a','%qzk')];continue;case'4':this['benchmark']=_0x708a39[_0x588d('0x2b','em[f')][_0x588d('0x2c','7$sW')];continue;}break;}}await _0x5049c5[_0x588d('0x2d','2bOM')](delayCall,()=>this[_0x588d('0x2e','vn7w')](),_0x5049c5['twVZD'](this[_0x588d('0x2f','SHT!')],0x3e8));}else{await _0x5049c5[_0x588d('0x30','ArhG')](delayCall,()=>this[_0x588d('0x31','vn7w')](),0x3e8);}}catch(_0x234866){this['error']++;console[_0x588d('0x32','POb6')](_0x234866);await _0x5049c5['qaDgG'](delayCall,()=>this[_0x588d('0x33','7$sW')](),0x3e8);}}async['heartProcess'](){var _0x476213={'eVOdd':'YSW','zkknF':function _0x2426f8(_0x429b82,_0x503d2b){return _0x429b82>_0x503d2b;},'brppT':function _0x67d712(_0x8c54b6,_0x42a65e,_0x4a2c4e){return _0x8c54b6(_0x42a65e,_0x4a2c4e);},'VOjLF':function _0x22b6f5(_0x5f4659,_0x3da31e){return _0x5f4659*_0x3da31e;},'FczNm':function _0xccc678(_0x423d0d,_0x11fc90){return _0x423d0d(_0x11fc90);},'SnGxg':_0x588d('0x34','sx]V')};try{if(_0x588d('0x35','1PuD')===_0x476213[_0x588d('0x36','POb6')]){if(!_0x314224['process']||_0x476213['zkknF'](this[_0x588d('0x37','d)Qa')],0x3))return;let _0x42343f={'id':[this[_0x588d('0x38','DVv5')],this['area_id'],this[_0x588d('0x39','SHT!')],this[_0x588d('0x3a','s^Y3')]],'device':[this[_0x588d('0x3b','2bOM')],this['uuid']],'ets':this[_0x588d('0x3c','a8h9')],'benchmark':this[_0x588d('0x3d','$oxr')],'time':this[_0x588d('0x3e','knD6')],'ts':new Date()[_0x588d('0x3f','sx]V')](),'ua':this['ua']};KeySign[_0x588d('0x40','MC#t')](_0x42343f);let _0x4e69de=BiliPushUtils['sign'](JSON[_0x588d('0x41','pI*K')](_0x42343f),this['secret_rule']);if(_0x4e69de){_0x42343f['s']=_0x4e69de;let _0x2dfa06=await BiliPushUtils[_0x588d('0x42','7$sW')][_0x588d('0x43','%EVN')][_0x588d('0x44','eG4v')](_0x42343f);if(_0x2dfa06[_0x588d('0x45','MC#t')]==0x0){++_0x314224[_0x588d('0x46','RVm(')];++this['seq'];this['time']=_0x2dfa06[_0x588d('0x47','k2cp')][_0x588d('0x48','a8h9')];this[_0x588d('0x49','Ruon')]=_0x2dfa06['data']['secret_key'];this[_0x588d('0x4a','MC#t')]=_0x2dfa06[_0x588d('0x4b','W3t%')][_0x588d('0x4c','mMj&')];this[_0x588d('0x4d','Ys$F')]=_0x2dfa06[_0x588d('0x4e','&IEA')]['secret_rule'];if(_0x314224[_0x588d('0x4f','ZRX(')]<=_0x314224[_0x588d('0x50','vn7w')]&&_0x314224[_0x588d('0x51','EqH*')]){await _0x476213[_0x588d('0x52','eG4v')](delayCall,()=>this['heartProcess'](),_0x476213[_0x588d('0x53','W3t%')](this[_0x588d('0x54','&IEA')],0x3e8));}else{if(_0x314224[_0x588d('0x55','F(7k')]){console[_0x588d('0x56','$oxr')](_0x588d('0x57','$oxr'));_0x314224[_0x588d('0x58','KxWc')]=![];_0x476213[_0x588d('0x59','dumr')](runTomorrow,_0x314224[_0x588d('0x5a','PsIj')]);}}}}}else{r=e[_0x588d('0x5b','%mwA')][_0x588d('0x5c','HL^5')](r),e[_0x588d('0x5d','L)xe')][_0x588d('0x5e','HL^5')](r);}}catch(_0x30a6bb){if(_0x476213[_0x588d('0x5f','a8h9')]===_0x588d('0x60','d)Qa')){this[_0x588d('0x61','$oxr')]++;console[_0x588d('0x62','L)xe')](_0x30a6bb);await _0x476213['brppT'](delayCall,()=>this['heartProcess'](),0x3e8);}else{o=_0x30a6bb[_0x588d('0x63','eG4v')][_0x588d('0x64','ArhG')]++;try{_['set'](r,o);}catch(_0x3e60ec){a[_0x588d('0x65','QTob')](r,o);}}}}}const _0x314224={'total':0x0,'max':0x19,'process':!![],'run':async()=>{var _0x229715={'vaMmm':function _0x532f80(_0x4d2b48,_0x5db963){return _0x4d2b48!==_0x5db963;},'mcobt':'FeP','ZaovG':function _0x313c70(_0x5236ad,_0x489a6f){return _0x5236ad(_0x489a6f);},'KWrBO':'开始启动小心心心跳','TRFEE':'QXt','iOZqC':function _0x104658(_0x37d0f9,_0x9f2735,_0x34f0d0){return _0x37d0f9(_0x9f2735,_0x34f0d0);},'iELnJ':function _0x3ee208(_0x2930ae,_0x12e700){return _0x2930ae==_0x12e700;},'zJxqV':function _0x285456(_0xdfc0ef,_0x1415a8,_0x530e5c){return _0xdfc0ef(_0x1415a8,_0x530e5c);}};if(!_0x314224[_0x588d('0x66','pI*K')]){_0x314224[_0x588d('0x67','POb6')]=!![];}await Gift[_0x588d('0x68','pI*K')]();let _0x398e9b=Gift[_0x588d('0x69','DVv5')];if(_0x398e9b){if(_0x229715[_0x588d('0x6a','ZQ2(')](_0x229715[_0x588d('0x6b','HL^5')],'FeP')){if(_0x314224[_0x588d('0x6c','9^Oc')]){console[_0x588d('0x6d','2bOM')](_0x588d('0x6e','ZQ2('));_0x314224['process']=![];_0x229715['ZaovG'](runTomorrow,_0x314224['run']);}}else{console[_0x588d('0x6f','k2cp')](_0x229715['KWrBO']);for(let _0x43a98e of _0x398e9b){if('qfU'===_0x229715[_0x588d('0x70','em[f')]){t=e[_0x588d('0x71','ZQ2(')]['to_js'](t),e[_0x588d('0x72','zXEp')][_0x588d('0x73','2bOM')](r,t['body']);}else{let _0x5d03cd=await API[_0x588d('0x74','dumr')]['get_info'](_0x229715[_0x588d('0x75','em[f')](parseInt,_0x43a98e[_0x588d('0x76','d$^4')],0xa));if(_0x229715[_0x588d('0x77','IxOn')](_0x5d03cd[_0x588d('0x78','zXEp')],0x0)){new _0x1a0bbd(_0x5d03cd['data']);await _0x229715[_0x588d('0x79','vn7w')](delayCall,()=>{},0x3e8);}}}}}}};(window[_0x588d('0x7a','9^Oc')]=window['webpackJsonp']||[])['push']([[0x2e],{2205:function(_0x214ec6,_0x34fef9,_0x41188f){var _0x643fc5={'AUZoy':function _0x3bcfcd(_0x214dad,_0xea4309){return _0x214dad+_0xea4309;},'QVCoz':function _0x4fa46b(_0x21f3ee,_0x5892fa){return _0x21f3ee!==_0x5892fa;},'bQwiF':function _0x9d24db(_0x220b28,_0x69a21d){return _0x220b28===_0x69a21d;},'yxaBn':function _0x1f7869(_0x505d72,_0x559a5d){return _0x505d72/_0x559a5d;},'WcFYw':_0x588d('0x7b','O$bS'),'uKVhT':function _0x170c73(_0x2f8ca3,_0x40590c){return _0x2f8ca3/_0x40590c;},'QTETN':function _0x456f83(_0x46e82b,_0x156a6a){return _0x46e82b<_0x156a6a;},'kbFFo':function _0xac4d6a(_0x2949a1,_0x44c523){return _0x2949a1+_0x44c523;},'mqHMU':function _0x43d62a(_0x227f81,_0x34a23b){return _0x227f81/_0x34a23b;},'aGyDi':function _0xb7d21d(_0x24e87a,_0x183cde){return _0x24e87a+_0x183cde;},'Nsqha':function _0x2fcb80(_0x2fb392,_0x5945d6){return _0x2fb392===_0x5945d6;},'TYWJa':'SFU','QiEmB':function _0xb9b121(_0x4371dc,_0x5f35c4){return _0x4371dc+_0x5f35c4;},'RrOGc':function _0x32a644(_0x1fcf6e,_0x495b1f){return _0x1fcf6e===_0x495b1f;},'osBxF':'vIX','swZjU':function _0x31aa34(_0x2a935a,_0x3ab5b7){return _0x2a935a*_0x3ab5b7;},'CMBBM':function _0x2af0f7(_0x3b14af,_0x4179d6){return _0x3b14af*_0x4179d6;},'UrfhZ':function _0x124e83(_0x58f494,_0x588365){return _0x58f494<_0x588365;},'rZoMp':function _0x2c45d2(_0x3bf9ba,_0x4212a9){return _0x3bf9ba|_0x4212a9;},'fOSpn':function _0x34c654(_0x55988b,_0x5c2824){return _0x55988b<<_0x5c2824;},'gSlxK':function _0x241561(_0x343969,_0x49bcb3){return _0x343969&_0x49bcb3;},'FoeHn':function _0x185f09(_0x1c7498,_0x179240){return _0x1c7498|_0x179240;},'xvorI':function _0x607fab(_0x994b94,_0x606c8b){return _0x994b94>=_0x606c8b;},'hPgwV':function _0x4c433f(_0x33b2e5,_0x483a96){return _0x33b2e5<_0x483a96;},'gTeXK':function _0x53a2ed(_0x697f51,_0x3ac3a1){return _0x697f51<<_0x3ac3a1;},'TyPVC':function _0x317eae(_0x4ca561,_0x5e0e94){return _0x4ca561<<_0x5e0e94;},'fsVSk':function _0x4e2ecc(_0x1c5b5e,_0x4f1537){return _0x1c5b5e>>_0x4f1537;},'hGCLR':function _0x3ede1e(_0x354c13,_0x232088){return _0x354c13&_0x232088;},'QfDlm':function _0x466553(_0x45bb5b,_0x300178){return _0x45bb5b/_0x300178;},'zZCzt':function _0x3fbc12(_0x32099a,_0x10d17e){return _0x32099a/_0x10d17e;},'ZPmwV':function _0x554184(_0x1a10db,_0x394573){return _0x1a10db/_0x394573;},'hUypU':function _0xb35db3(_0x447390,_0x3d6542){return _0x447390+_0x3d6542;},'Ajdlx':function _0x486530(_0x2cbec2,_0x579edc){return _0x2cbec2+_0x579edc;},'pLIyh':function _0x27da0c(_0x3d3230,_0x482557){return _0x3d3230===_0x482557;},'MboZl':function _0x1be256(_0x1c4ed7,_0x4ff4d7){return _0x1c4ed7/_0x4ff4d7;},'cLNfc':function _0x274e12(_0x572945,_0x114989){return _0x572945/_0x114989;},'lIMgl':function _0x25cd6f(_0xa55fb5,_0x3f0ef1){return _0xa55fb5+_0x3f0ef1;},'WPqTT':function _0x442fde(_0x237dbf,_0x3a4fbe){return _0x237dbf*_0x3a4fbe;},'oEMrb':function _0x3a9ebf(_0x3cfdae,_0x285683){return _0x3cfdae/_0x285683;},'AFuPr':function _0x382398(_0xa5d8f5,_0x37bfb8){return _0xa5d8f5+_0x37bfb8;},'ARjcJ':'NBu','xNggB':_0x588d('0x7c','dumr'),'Tdyza':function _0x2d0e2c(_0x2a18f4,_0x33a130){return _0x2a18f4*_0x33a130;},'VtPbN':function _0x2867dc(_0xe61be0,_0x10c71a){return _0xe61be0===_0x10c71a;},'CBqNP':'[object\x20String]','gNXNX':function _0x46f1cb(_0x51bf36,_0x110fff){return _0x51bf36+_0x110fff;},'rRSxh':_0x588d('0x7d','sx]V'),'lAbSf':function _0x276d9d(_0x3493ce,_0x29d778){return _0x3493ce+_0x29d778;},'gfGco':function _0x10e42e(_0x37c59c,_0x3d5edf){return _0x37c59c===_0x3d5edf;},'gPuga':function _0x2c1a7a(_0x155e4b,_0x3dfe56){return _0x155e4b+_0x3dfe56;},'GpgfG':function _0x304349(_0x3225a6,_0x33bf13){return _0x3225a6===_0x33bf13;},'mJbTh':_0x588d('0x7e','Ruon'),'jpibv':function _0xdf97b3(_0xe889c6,_0x37a019){return _0xe889c6+_0x37a019;},'Affnj':_0x588d('0x7f','MC#t'),'HnxIa':'instance','CjxoM':_0x588d('0x80','zXEp'),'eKFSk':_0x588d('0x81','8wN^'),'oklOB':function _0x4da588(_0x113c1b,_0x1dff79){return _0x113c1b!=_0x1dff79;},'jGwns':function _0x20e6e0(_0x11278c,_0x2d7dfd){return _0x11278c|_0x2d7dfd;},'VBxLI':_0x588d('0x82','$oxr'),'EEMbb':_0x588d('0x83','ZQ2('),'qGBag':function _0x391ccb(_0x452870,_0x29c344){return _0x452870|_0x29c344;},'UNGgs':_0x588d('0x84','lZNf'),'VFKYL':function _0x1c77d9(_0x571379,_0x4c84f3){return _0x571379|_0x4c84f3;},'LYPDn':function _0x447308(_0x526da2,_0x2bee11){return _0x526da2>>_0x2bee11;},'VLskf':function _0x3d9142(_0x174ee9,_0x4d36d5){return _0x174ee9!==_0x4d36d5;},'pgMgz':_0x588d('0x85','F(7k'),'AUtET':function _0x15baae(_0x1d818a,_0x16901b){return _0x1d818a>=_0x16901b;},'dshVq':function _0x34b214(_0x539c22,_0x5b32f0){return _0x539c22<=_0x5b32f0;},'GpEwK':function _0x12b638(_0x1eeffc,_0x5b50ea){return _0x1eeffc<=_0x5b50ea;},'cHAEs':function _0x5ed8ec(_0x30fa60){return _0x30fa60();},'SecCw':_0x588d('0x86','%EVN'),'IcvSB':function _0x44fb65(_0x2cc490,_0x51060b){return _0x2cc490==_0x51060b;},'TpBRC':_0x588d('0x87','%mwA'),'vNKhI':_0x588d('0x88','MC#t'),'pHMoK':function _0x375685(_0x20ab91,_0x5dee87){return _0x20ab91===_0x5dee87;},'dcXFX':_0x588d('0x89','%qzk'),'LwDCQ':'undefined','qjVgC':function _0x46751d(_0x219299){return _0x219299();},'qcXiK':function _0x26a749(_0x48fd6d,_0x3067eb){return _0x48fd6d===_0x3067eb;},'ylxrW':function _0x4b7d88(_0x545658,_0x3bc73b){return _0x545658(_0x3bc73b);}};'use strict';_0x41188f['r'](_0x34fef9);var _0x2ffb2a=_0x41188f(0x1f7),_0x31b1ee=_0x41188f['n'](_0x2ffb2a),_0x320dbc=_0x643fc5[_0x588d('0x8a','%qzk')](_0x41188f,0x382),_0x50bbc6=_0x41188f['n'](_0x320dbc),_0x323604=_0x643fc5['ylxrW'](_0x41188f,0x79),_0xe478d3=_0x41188f['n'](_0x323604),_0x4fcb3f=_0x41188f(0x3f),_0x111393=_0x41188f['n'](_0x4fcb3f);_0x34fef9[_0x588d('0x8b','ArhG')]=function(){var _0x212c92={'mLcPm':function _0x211634(_0x35993b,_0x3b8dc5){return _0x643fc5[_0x588d('0x8c','MC#t')](_0x35993b,_0x3b8dc5);},'CxucM':function _0xe64438(_0x3087f1,_0x127ee6){return _0x643fc5['oklOB'](_0x3087f1,_0x127ee6);},'RbpKD':function _0x317f6e(_0x3dfa63,_0x2187b6){return _0x643fc5['jpibv'](_0x3dfa63,_0x2187b6);},'cnRps':function _0x1f9bac(_0x1276f6,_0x3c7f80){return _0x643fc5[_0x588d('0x8d','vn7w')](_0x1276f6,_0x3c7f80);},'SgYnf':function _0x445946(_0x50f516,_0x410de1){return _0x50f516<_0x410de1;},'eLBIb':function _0x4f5bf8(_0x53f5b0,_0x47560e){return _0x53f5b0===_0x47560e;},'XQOsY':_0x643fc5['VBxLI'],'tVBTI':_0x643fc5['EEMbb'],'oVtVj':function _0x4a334f(_0x4a61af,_0x35df21){return _0x643fc5[_0x588d('0x8e','%EVN')](_0x4a61af,_0x35df21);},'WOaug':function _0x34c48f(_0x1ef1ea,_0x275107){return _0x643fc5[_0x588d('0x8f','DVv5')](_0x1ef1ea,_0x275107);},'unMAy':function _0xcda95a(_0x390b8e,_0xbe01f0){return _0x390b8e&_0xbe01f0;},'nvDoB':function _0xd86171(_0x11dcd8,_0x1ef986){return _0x643fc5[_0x588d('0x90','ZQ2(')](_0x11dcd8,_0x1ef986);},'QJWQp':_0x643fc5['UNGgs'],'rfzzF':function _0x19b62c(_0x493dd1,_0x203fd5){return _0x493dd1|_0x203fd5;},'DQsrl':function _0xb9877f(_0x3446be,_0x53e6ca){return _0x3446be<<_0x53e6ca;},'exsVf':function _0x3389f3(_0x18a97d,_0x2f4b1c){return _0x643fc5[_0x588d('0x91','W3t%')](_0x18a97d,_0x2f4b1c);},'kdpPV':function _0x1f1d78(_0x4eee5b,_0x5927bf){return _0x643fc5['hGCLR'](_0x4eee5b,_0x5927bf);},'YiOCk':function _0x582ad5(_0x3b4e89,_0x5de757){return _0x643fc5['LYPDn'](_0x3b4e89,_0x5de757);},'kVMRg':function _0x32899e(_0x2cecdf,_0x11c348){return _0x643fc5[_0x588d('0x92','dumr')](_0x2cecdf,_0x11c348);},'hFQTs':function _0x23ffcb(_0x38db55,_0x25ad71){return _0x38db55==_0x25ad71;},'NdcoA':function _0xd5227f(_0x5c4e4d,_0x11b2ed){return _0x643fc5[_0x588d('0x93','vn7w')](_0x5c4e4d,_0x11b2ed);},'vfofK':'gPW','YZBzT':_0x643fc5[_0x588d('0x94','HL^5')],'ksbEr':function _0xe0e22a(_0x101d49,_0x465cba){return _0x643fc5['AUtET'](_0x101d49,_0x465cba);},'ksWzI':function _0x2e53be(_0x75daa8,_0x19799c){return _0x643fc5[_0x588d('0x95','RVm(')](_0x75daa8,_0x19799c);},'rsBJe':function _0x1e6d95(_0x36b76e,_0x11e5f4){return _0x36b76e&_0x11e5f4;},'EoETF':function _0x3d29e0(_0x5a8840,_0x2d9326){return _0x643fc5[_0x588d('0x96','ZQ2(')](_0x5a8840,_0x2d9326);},'vqmqp':function _0x1a1ff1(_0x77dae8,_0x5b1903){return _0x643fc5[_0x588d('0x97','pI*K')](_0x77dae8,_0x5b1903);},'zKMDS':_0x643fc5['Affnj'],'iLxVo':_0x643fc5['HnxIa'],'VCmoL':_0x588d('0x98','%mwA'),'NYLTV':_0x643fc5[_0x588d('0x99','%qzk')],'lXIPr':function _0x492379(_0x1457bc){return _0x643fc5[_0x588d('0x9a','$oxr')](_0x1457bc);},'aleHn':_0x643fc5[_0x588d('0x9b','FpG7')]};var _0x214ec6={'STDWEB_PRIVATE':{}};_0x214ec6[_0x588d('0x9c','O$bS')]['to_utf8']=function(_0x4f5b4c,_0x1192e4){var _0xd0529b={'rsZLa':'cDh','IHyzd':'OmN','TImPg':function _0x424618(_0xffa0d8,_0x188d62){return _0xffa0d8<_0x188d62;},'Kirof':function _0x5dc49e(_0x4c0578,_0x4240a8){return _0x4c0578===_0x4240a8;},'xBHEK':_0x588d('0x9d','7$sW'),'hVRaP':function _0x2cc2e6(_0x39126e,_0x3050db){return _0x39126e<=_0x3050db;},'WlNjU':function _0xeaf5df(_0x1398ed,_0x189280){return _0x1398ed|_0x189280;},'cJDXg':function _0x2b7053(_0x5b3669,_0x242d61){return _0x5b3669+_0x242d61;},'gNcaM':function _0x494ba5(_0x390f14,_0x13a45a){return _0x390f14|_0x13a45a;},'MnLMJ':function _0x20bbf3(_0x1d19d3,_0x5eccd6){return _0x1d19d3>>_0x5eccd6;},'gLxiF':function _0x4cf013(_0x17c501,_0x2a01f1){return _0x17c501&_0x2a01f1;},'VtPqu':function _0x4a9700(_0x2b584a,_0x5e0ac9){return _0x2b584a<=_0x5e0ac9;},'EuZTJ':function _0x2bc10f(_0x58754d,_0x14d12f){return _0x58754d>>_0x14d12f;},'rCsnw':function _0x196c02(_0x4b7b04,_0x4fc14f){return _0x4b7b04&_0x4fc14f;},'KDMHa':function _0xe62898(_0x368a08,_0x5d8979){return _0x368a08|_0x5d8979;},'BHuLC':function _0x2435bd(_0x4e2cc7,_0xc00f20){return _0x4e2cc7|_0xc00f20;},'yjOhx':function _0x424ea3(_0x2ad43d,_0x448861){return _0x2ad43d<=_0x448861;},'CFNtp':function _0x25dc07(_0x4684ba,_0x4b9322){return _0x4684ba|_0x4b9322;},'DyEie':function _0x11e336(_0x252a1e,_0x10edf0){return _0x252a1e>>_0x10edf0;},'JSdAm':function _0x3b35ea(_0x5b701b,_0x13befa){return _0x5b701b>>_0x13befa;},'FMRNq':function _0x5bbfa3(_0x134850,_0x522ea8){return _0x134850|_0x522ea8;},'rtMxp':function _0x21dcf3(_0x2c4942,_0x30234d){return _0x2c4942&_0x30234d;},'CQyCw':function _0x3d8241(_0x5db5ca,_0x4e2088){return _0x5db5ca&_0x4e2088;},'qWqid':function _0x39fb27(_0xef408a,_0x15d099){return _0xef408a&_0x15d099;},'IkAFO':function _0x4daf75(_0x27ab51,_0x258613){return _0x27ab51|_0x258613;},'qdDUo':function _0x4e1233(_0x30743d,_0x5beb14){return _0x30743d&_0x5beb14;}};if(_0xd0529b[_0x588d('0x9e','&IEA')]!==_0xd0529b[_0x588d('0x9f','s^Y3')]){for(var _0x3fb6d0=_0x214ec6[_0x588d('0xa0','W3t%')],_0x10707d=0x0;_0xd0529b[_0x588d('0xa1','lZNf')](_0x10707d,_0x4f5b4c[_0x588d('0xa2','2bOM')]);++_0x10707d){if(_0xd0529b[_0x588d('0xa3','RVm(')](_0xd0529b[_0x588d('0xa4','SHT!')],'cAT')){var _0x39934d=_0x4f5b4c[_0x588d('0xa5','k2cp')](_0x10707d);_0x39934d>=0xd800&&_0xd0529b[_0x588d('0xa6','8wN^')](_0x39934d,0xdfff)&&(_0x39934d=_0xd0529b[_0x588d('0xa7','KxWc')](_0xd0529b[_0x588d('0xa8','HL^5')](0x10000,(0x3ff&_0x39934d)<<0xa),0x3ff&_0x4f5b4c[_0x588d('0xa9','Kt7h')](++_0x10707d))),_0xd0529b[_0x588d('0xaa','a8h9')](_0x39934d,0x7f)?_0x3fb6d0[_0x1192e4++]=_0x39934d:_0x39934d<=0x7ff?(_0x3fb6d0[_0x1192e4++]=_0xd0529b['gNcaM'](0xc0,_0xd0529b[_0x588d('0xab','RVm(')](_0x39934d,0x6)),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xac','MC#t')](0x3f,_0x39934d)):_0xd0529b['VtPqu'](_0x39934d,0xffff)?(_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xad','DVv5')](0xe0,_0xd0529b[_0x588d('0xae','ZQ2(')](_0x39934d,0xc)),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xaf','dumr')](_0x39934d,0x6)&0x3f,_0x3fb6d0[_0x1192e4++]=_0xd0529b['gNcaM'](0x80,_0xd0529b[_0x588d('0xb0','1PuD')](0x3f,_0x39934d))):_0xd0529b[_0x588d('0xb1','RVm(')](_0x39934d,0x1fffff)?(_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xb2','Kt7h')](0xf0,_0x39934d>>0x12),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xb3',']olF')](_0x39934d>>0xc,0x3f),_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xb4','SHT!')](0x80,_0xd0529b[_0x588d('0xb5','vn7w')](_0x39934d>>0x6,0x3f)),_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xb6','d$^4')](0x80,_0xd0529b[_0x588d('0xb7','&IEA')](0x3f,_0x39934d))):_0xd0529b['yjOhx'](_0x39934d,0x3ffffff)?(_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xb8','&IEA')](0xf8,_0xd0529b['EuZTJ'](_0x39934d,0x18)),_0x3fb6d0[_0x1192e4++]=_0xd0529b['CFNtp'](0x80,_0xd0529b[_0x588d('0xb9','IxOn')](_0x39934d,0x12)&0x3f),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xba','MC#t')](_0x39934d,0xc)&0x3f,_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xbb','$oxr')](0x80,_0xd0529b[_0x588d('0xbc','ArhG')](_0x39934d>>0x6,0x3f)),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xbd','FpG7')](0x3f,_0x39934d)):(_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xbe','QTob')](0xfc,_0xd0529b[_0x588d('0xbf','%mwA')](_0x39934d,0x1e)),_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xc0','vn7w')](0x80,_0xd0529b[_0x588d('0xc1','%qzk')](_0xd0529b[_0x588d('0xc2','DVv5')](_0x39934d,0x18),0x3f)),_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xc3','9^Oc')](0x80,_0xd0529b['rtMxp'](_0xd0529b[_0x588d('0xc4','a8h9')](_0x39934d,0x12),0x3f)),_0x3fb6d0[_0x1192e4++]=0x80|_0xd0529b[_0x588d('0xc5','zXEp')](_0x39934d>>0xc,0x3f),_0x3fb6d0[_0x1192e4++]=_0xd0529b['FMRNq'](0x80,_0xd0529b[_0x588d('0xc6','DVv5')](_0xd0529b[_0x588d('0xc7','em[f')](_0x39934d,0x6),0x3f)),_0x3fb6d0[_0x1192e4++]=_0xd0529b[_0x588d('0xc8','2bOM')](0x80,_0xd0529b['qdDUo'](0x3f,_0x39934d)));}else{_0x214ec6['STDWEB_PRIVATE'][_0x588d('0xc9','QTob')]=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0xca','1PuD')](_0x4f5b4c);}}}else{debugger;}},_0x214ec6[_0x588d('0xcb','a8h9')][_0x588d('0xcc','QTob')]=function(){},_0x214ec6[_0x588d('0xcd','em[f')][_0x588d('0xce','KxWc')]=function(_0x2cb7a4){var _0x41188f=_0x214ec6[_0x588d('0xcf','$oxr')][_0x643fc5[_0x588d('0xd0','lZNf')](_0x2cb7a4,0xc)];if(_0x643fc5[_0x588d('0xd1','k2cp')](0x0,_0x41188f)){var _0x4ddf11=_0x588d('0xd2','KxWc')['split']('|'),_0x20695c=0x0;while(!![]){switch(_0x4ddf11[_0x20695c++]){case'0':if(_0x643fc5[_0x588d('0xd3','pI*K')](0x5,_0x41188f))return!0x1;continue;case'1':if(_0x643fc5[_0x588d('0xd4','POb6')](0x2,_0x41188f))return _0x214ec6[_0x588d('0xd5','SHT!')][_0x643fc5[_0x588d('0xd6','FpG7')](_0x2cb7a4,0x4)];continue;case'2':if(_0x643fc5[_0x588d('0xd7','7$sW')](0x1,_0x41188f))return null;continue;case'3':if(0x7===_0x41188f){if(_0x643fc5[_0x588d('0xd8','Ruon')](_0x588d('0xd9','FpG7'),_0x643fc5[_0x588d('0xda','vn7w')])){_0x41188f=_0x214ec6[_0x588d('0xdb','k2cp')]['to_js'](_0x41188f),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0xdc','W3t%')](_0x2cb7a4,_0x41188f[_0x588d('0xdd','DVv5')]);}else{_0x4edfcd=_0x214ec6[_0x588d('0xde','F(7k')]['arena']+_0x214ec6['HEAPU32'][_0x2cb7a4/0x4],_0x2e3a87=_0x214ec6[_0x588d('0xdf','Kt7h')][_0x643fc5[_0x588d('0xe0','$oxr')](_0x643fc5['AUZoy'](_0x2cb7a4,0x4),0x4)];for(var _0x5c011a=[],_0x1b1e93=0x0;_0x643fc5[_0x588d('0xe1','knD6')](_0x1b1e93,_0x2e3a87);++_0x1b1e93)_0x5c011a[_0x588d('0xe2','vn7w')](_0x214ec6[_0x588d('0xe3','8wN^')]['to_js'](_0x643fc5[_0x588d('0xe4','IxOn')](_0x4edfcd,0x10*_0x1b1e93)));return _0x5c011a;}}continue;case'4':if(0x3===_0x41188f)return _0x214ec6[_0x588d('0xe5','FpG7')][_0x2cb7a4/0x8];continue;case'5':if(_0x643fc5[_0x588d('0xe6','L)xe')](0xa,_0x41188f)||_0x643fc5['bQwiF'](0xc,_0x41188f)||_0x643fc5[_0x588d('0xe7','$oxr')](0xd,_0x41188f)){var _0x22c5c1=_0x214ec6['HEAPU32'][_0x2cb7a4/0x4],_0x2188e2=(_0x4edfcd=_0x214ec6[_0x588d('0xe8','ZQ2(')][_0x643fc5[_0x588d('0xe9','d)Qa')](_0x2cb7a4+0x4,0x4)],_0x214ec6['HEAPU32'][_0x643fc5[_0x588d('0xea','HL^5')](_0x2cb7a4,0x8)/0x4]),_0x3d92f3=0x0,_0x24a455=!0x1;return(_0x5c011a=function _0x2cb7a4(){var _0x36ce51={'YbWrs':_0x588d('0xeb','a8h9'),'tOzdU':function _0x12e301(_0x49b9e3,_0x3d5bd4){return _0x49b9e3===_0x3d5bd4;},'JSzfa':function _0x2627d8(_0x30d21a,_0x3e8891){return _0x30d21a!==_0x3e8891;},'TTwwN':'oyo','ZJsAG':_0x588d('0xec','DVv5'),'VLwKX':_0x588d('0xed','k2cp'),'PyqIG':'uYg','uzJKV':'buT','NolPg':_0x588d('0xee','KxWc'),'rIBVA':_0x588d('0xef','knD6'),'PaLWx':function _0xb5a0b0(_0x415ae6,_0x49498a){return _0x415ae6===_0x49498a;},'JGwQZ':function _0x44655e(_0x3cd203,_0x399edb){return _0x3cd203===_0x399edb;},'STwkl':function _0x319300(_0xaf3836,_0x1dd88e){return _0xaf3836===_0x1dd88e;},'vtzUV':_0x588d('0xf0','pI*K'),'UZxex':_0x588d('0xf1','d)Qa'),'lFfqv':_0x588d('0xf2','EqH*'),'WbOhT':function _0x34cbac(_0x522966,_0x27e4ee){return _0x522966!==_0x27e4ee;},'ipSPk':_0x588d('0xf3','%qzk')};var _0x23a9d1=_0x36ce51[_0x588d('0xf4','KxWc')][_0x588d('0xf5','2bOM')]('|'),_0x1f9f8d=0x0;while(!![]){switch(_0x23a9d1[_0x1f9f8d++]){case'0':return _0x36ce51[_0x588d('0xf6','dumr')](!0x0,_0x24a455)&&0x0===_0x3d92f3&&_0x2cb7a4[_0x588d('0xf7','DVv5')](),_0x215f01;case'1':try{if(_0x36ce51['JSzfa'](_0x36ce51[_0x588d('0xf8','a8h9')],_0x36ce51[_0x588d('0xf9','Ys$F')])){_0x3d92f3+=0x1,_0x214ec6[_0x588d('0xfa','9^Oc')]['dyncall'](_0x36ce51['VLwKX'],_0x22c5c1,[_0x5e29de,_0x4abc92]);var _0x215f01=_0x214ec6[_0x588d('0xfb','EqH*')][_0x588d('0xfc','lZNf')];_0x214ec6[_0x588d('0xfd','d$^4')]['tmp']=null;}else{if(fn){var _0x454d9b=fn[_0x588d('0xfe','L)xe')](context,arguments);fn=null;return _0x454d9b;}}}finally{if(_0x36ce51[_0x588d('0xff','SHT!')]===_0x36ce51[_0x588d('0x100','ZQ2(')]){var _0x2d83f6=_0x36ce51[_0x588d('0x101','dumr')][_0x588d('0x102','Ruon')]('|'),_0x5e80e5=0x0;while(!![]){switch(_0x2d83f6[_0x5e80e5++]){case'0':this[_0x588d('0x103','dumr')]=info['parent_area_id'];continue;case'1':;continue;case'2':this['uuid']=_0x1c0351();continue;case'3':this['info']=info;continue;case'4':this['room_id']=info[_0x588d('0x104','8wN^')];continue;case'5':this['startEnter']();continue;case'6':this[_0x588d('0x105','L)xe')]=new Date();continue;case'7':this[_0x588d('0x106','ogFX')]=info[_0x588d('0x107','2bOM')];continue;case'8':this['buvid']=getCookie(_0x36ce51[_0x588d('0x108','1PuD')]);continue;case'9':this[_0x588d('0x109','k2cp')]=0x0;continue;case'10':this['ua']=window&&window['navigator']?window[_0x588d('0x10a','SHT!')]['userAgent']:'';continue;case'11':this[_0x588d('0x10b','%EVN')]=0x0;continue;}break;}}else{_0x3d92f3-=0x1;}}continue;case'2':var _0x5e29de=_0x4edfcd;continue;case'3':if(_0x36ce51[_0x588d('0x10c','Ruon')](0x0,_0x4edfcd)||_0x36ce51[_0x588d('0x10d','1PuD')](!0x0,_0x24a455))throw _0x36ce51[_0x588d('0x10e','Kt7h')](0xa,_0x41188f)?new ReferenceError(_0x36ce51['vtzUV']):0xc===_0x41188f?new ReferenceError(_0x36ce51[_0x588d('0x10f','KxWc')]):new ReferenceError(_0x36ce51[_0x588d('0x110','HL^5')]);continue;case'4':if(0xd===_0x41188f&&(_0x2cb7a4[_0x588d('0x111','F(7k')]=_0x214ec6[_0x588d('0x112','HL^5')][_0x588d('0x113','em[f')],_0x4edfcd=0x0),_0x36ce51[_0x588d('0x114','DVv5')](0x0,_0x3d92f3)&&(_0x36ce51[_0x588d('0x115','9^Oc')](0xc,_0x41188f)||0xd===_0x41188f))throw new ReferenceError(_0x36ce51[_0x588d('0x116','knD6')]);continue;case'5':var _0x4abc92=_0x214ec6[_0x588d('0x117','POb6')][_0x588d('0x118','d)Qa')](0x10);continue;case'6':_0x214ec6['STDWEB_PRIVATE']['serialize_array'](_0x4abc92,arguments);continue;}break;}})[_0x588d('0x119','Ys$F')]=function(){if(_0x212c92[_0x588d('0x11a','k2cp')](0x0,_0x3d92f3)){_0x5c011a['drop']=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x11b','knD6')];var _0x2cb7a4=_0x4edfcd;_0x4edfcd=0x0,_0x212c92[_0x588d('0x11c','7$sW')](0x0,_0x2cb7a4)&&_0x214ec6[_0x588d('0x11d','d)Qa')][_0x588d('0x11e','a8h9')]('vi',_0x2188e2,[_0x2cb7a4]);}else _0x24a455=!0x0;},_0x5c011a;}continue;case'6':if(_0x643fc5['bQwiF'](0x9,_0x41188f))return _0x214ec6[_0x588d('0xfb','EqH*')]['acquire_js_reference'](_0x214ec6['HEAP32'][_0x2cb7a4/0x4]);continue;case'7':if(0x6===_0x41188f)return!0x0;continue;case'8':if(_0x643fc5['Nsqha'](0x8,_0x41188f)){if(_0x643fc5[_0x588d('0x11f','ogFX')]===_0x588d('0x120','SHT!')){return function(){var _0x297071={'Dttnv':function _0x36d933(_0x14f72a,_0x4b3a57,_0x592e8f){return _0x14f72a(_0x4b3a57,_0x592e8f);}};return _0x297071[_0x588d('0x121','EqH*')](_0x214ec6,this,arguments['length']>0x0?arguments[0x0]:void 0x0);};}else{var _0x930857=_0x214ec6[_0x588d('0x5d','L)xe')][_0x588d('0x122','k2cp')],_0x55d5c=_0x930857+_0x214ec6[_0x588d('0x123','d)Qa')][_0x643fc5[_0x588d('0x124','k2cp')](_0x2cb7a4,0x4)],_0x593283=(_0x2e3a87=_0x214ec6[_0x588d('0x125','QTob')][_0x643fc5[_0x588d('0x126','1PuD')](_0x643fc5[_0x588d('0x127','QTob')](_0x2cb7a4,0x4),0x4)],_0x643fc5[_0x588d('0x128','ZRX(')](_0x930857,_0x214ec6[_0x588d('0x129','Ys$F')][_0x643fc5['mqHMU'](_0x2cb7a4+0x8,0x4)]));for(_0x5c011a={},_0x1b1e93=0x0;_0x1b1e93<_0x2e3a87;++_0x1b1e93){if(_0x643fc5['RrOGc'](_0x643fc5[_0x588d('0x12a','8wN^')],_0x643fc5[_0x588d('0x12b','DVv5')])){var _0x10ea97=_0x214ec6['HEAPU32'][_0x643fc5[_0x588d('0x12c','ArhG')](_0x593283,0x8*_0x1b1e93)/0x4],_0xd37da6=_0x214ec6['HEAPU32'][_0x643fc5[_0x588d('0x12d','vn7w')](_0x643fc5[_0x588d('0x12e','a8h9')](_0x593283,0x4)+_0x643fc5[_0x588d('0x12f','Ys$F')](0x8,_0x1b1e93),0x4)],_0x3461d4=_0x214ec6[_0x588d('0x130','MC#t')]['to_js_string'](_0x10ea97,_0xd37da6),_0x2c3c69=_0x214ec6[_0x588d('0xe3','8wN^')][_0x588d('0x131','mMj&')](_0x55d5c+_0x643fc5['CMBBM'](0x10,_0x1b1e93));_0x5c011a[_0x3461d4]=_0x2c3c69;}else{var _0x927851=0x0;_0x643fc5[_0x588d('0x132','ArhG')](_0x2cb7a4,_0x2e3a87)&&(_0x927851=_0x4edfcd[_0x2cb7a4++]);var _0x1780cb=_0x643fc5['rZoMp'](_0x643fc5[_0x588d('0x133','d$^4')](0x3f&_0x55d5c,0x6),_0x643fc5['gSlxK'](0x3f,_0x927851));if(_0x593283=_0x643fc5[_0x588d('0x134','RVm(')](_0x643fc5['fOSpn'](_0x930857,0xc),_0x1780cb),_0x643fc5['xvorI'](_0x1b1e93,0xf0)){var _0x3ef5ec=0x0;_0x643fc5[_0x588d('0x135','pI*K')](_0x2cb7a4,_0x2e3a87)&&(_0x3ef5ec=_0x4edfcd[_0x2cb7a4++]),_0x593283=_0x643fc5[_0x588d('0x136','sx]V')](_0x643fc5[_0x588d('0x137','L)xe')](_0x643fc5[_0x588d('0x138','d)Qa')](0x7,_0x930857),0x12),_0x643fc5[_0x588d('0x139','%EVN')](_0x1780cb,0x6))|_0x643fc5['gSlxK'](0x3f,_0x3ef5ec),_0x5c011a+=String[_0x588d('0x13a','PsIj')](0xd7c0+_0x643fc5['fsVSk'](_0x593283,0xa)),_0x593283=_0x643fc5['QiEmB'](0xdc00,_0x643fc5['hGCLR'](0x3ff,_0x593283));}}}return _0x5c011a;}}continue;case'9':if(_0x643fc5['RrOGc'](0xe,_0x41188f)){_0x4edfcd=_0x214ec6[_0x588d('0x13b','ArhG')][_0x643fc5['QfDlm'](_0x2cb7a4,0x4)],_0x2e3a87=_0x214ec6[_0x588d('0x13c','8wN^')][_0x643fc5[_0x588d('0x13d','vn7w')](_0x643fc5[_0x588d('0x13e','d)Qa')](_0x2cb7a4,0x4),0x4)];var _0x200f14=_0x214ec6[_0x588d('0x13f','ogFX')][_0x643fc5['ZPmwV'](_0x643fc5['hUypU'](_0x2cb7a4,0x8),0x4)],_0xe90211=_0x643fc5[_0x588d('0x140','Q6Wb')](_0x4edfcd,_0x2e3a87);switch(_0x200f14){case 0x0:return _0x214ec6[_0x588d('0x141','dumr')]['subarray'](_0x4edfcd,_0xe90211);case 0x1:return _0x214ec6[_0x588d('0x142','Ruon')][_0x588d('0x143','1PuD')](_0x4edfcd,_0xe90211);case 0x2:return _0x214ec6['HEAPU16'][_0x588d('0x144','ZRX(')](_0x4edfcd,_0xe90211);case 0x3:return _0x214ec6[_0x588d('0x145','zXEp')][_0x588d('0x146','ArhG')](_0x4edfcd,_0xe90211);case 0x4:return _0x214ec6[_0x588d('0x147','em[f')][_0x588d('0x148','QTob')](_0x4edfcd,_0xe90211);case 0x5:return _0x214ec6['HEAP32'][_0x588d('0x149',']olF')](_0x4edfcd,_0xe90211);case 0x6:return _0x214ec6[_0x588d('0x14a','7$sW')][_0x588d('0x14b','$oxr')](_0x4edfcd,_0xe90211);case 0x7:return _0x214ec6[_0x588d('0x14c','8wN^')]['subarray'](_0x4edfcd,_0xe90211);}}else if(0xf===_0x41188f)return _0x214ec6[_0x588d('0x14d','sx]V')][_0x588d('0x14e','d$^4')](_0x214ec6[_0x588d('0x14f','7$sW')][_0x2cb7a4/0x4]);continue;case'10':if(_0x643fc5['pLIyh'](0x4,_0x41188f)){if(_0x588d('0x150','ZQ2(')!==_0x588d('0x151','9^Oc')){_0x3d92f3-=0x1;}else{var _0x4edfcd=_0x214ec6['HEAPU32'][_0x643fc5['MboZl'](_0x2cb7a4,0x4)],_0x2e3a87=_0x214ec6[_0x588d('0x152','1PuD')][_0x643fc5[_0x588d('0x153','PsIj')](_0x643fc5['lIMgl'](_0x2cb7a4,0x4),0x4)];return _0x214ec6[_0x588d('0x11d','d)Qa')][_0x588d('0x154','1PuD')](_0x4edfcd,_0x2e3a87);}}continue;}break;}}},_0x214ec6[_0x588d('0xe3','8wN^')]['serialize_object']=function(_0x5493b4,_0x5b0229){var _0x146ee5=_0x111393()(_0x5b0229),_0x5d825f=_0x146ee5[_0x588d('0x155','QTob')],_0x37a156=_0x214ec6[_0x588d('0x156','2bOM')][_0x588d('0x157','%mwA')](_0x643fc5[_0x588d('0x158','RVm(')](0x8,_0x5d825f)),_0x303f4c=_0x214ec6[_0x588d('0xe3','8wN^')]['alloc'](_0x643fc5[_0x588d('0x159','s^Y3')](0x10,_0x5d825f));_0x214ec6[_0x588d('0x15a','2bOM')][_0x643fc5[_0x588d('0x15b','em[f')](_0x5493b4,0xc)]=0x8,_0x214ec6[_0x588d('0x15c','&IEA')][_0x643fc5[_0x588d('0x15d','&IEA')](_0x5493b4,0x4)]=_0x303f4c,_0x214ec6[_0x588d('0x15e','MC#t')][_0x643fc5[_0x588d('0x15f','%EVN')](_0x5493b4+0x4,0x4)]=_0x5d825f,_0x214ec6[_0x588d('0x160','W3t%')][_0x643fc5['AFuPr'](_0x5493b4,0x8)/0x4]=_0x37a156;for(var _0x43831c=0x0;_0x643fc5[_0x588d('0x161','Ys$F')](_0x43831c,_0x5d825f);++_0x43831c){if(_0x643fc5[_0x588d('0x162','IxOn')](_0x643fc5['ARjcJ'],_0x643fc5[_0x588d('0x163','d$^4')])){var _0xa09e50=_0x146ee5[_0x43831c],_0xb72550=_0x37a156+_0x643fc5['WPqTT'](0x8,_0x43831c);_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x164','2bOM')](_0xb72550,_0xa09e50),_0x214ec6[_0x588d('0x71','ZQ2(')]['from_js'](_0x643fc5[_0x588d('0x165','vn7w')](_0x303f4c,_0x643fc5['Tdyza'](0x10,_0x43831c)),_0x5b0229[_0xa09e50]);}else{return _0x643fc5['VtPbN'](_0x5493b4[0x0],_0x214ec6);}}},_0x214ec6[_0x588d('0x166','IxOn')]['serialize_array']=function(_0x15d0fb,_0x3e3ce8){var _0x2f8e27={'YxXLe':function _0x1a6679(_0xaa762f,_0x139cd9){return _0xaa762f!==_0x139cd9;},'gEZHj':_0x588d('0x167','vn7w'),'RazcH':function _0x20e110(_0x3d5e24,_0x49b941){return _0x3d5e24*_0x49b941;},'UDFUV':function _0x7e8d4d(_0x45b920,_0x183eee){return _0x45b920/_0x183eee;},'Znqqq':function _0x5ef5bb(_0x2409ba,_0x5aeb30){return _0x2409ba+_0x5aeb30;},'LbJOb':function _0x111c70(_0x51c421,_0x5edaeb){return _0x51c421<_0x5edaeb;},'HJYHz':function _0x59ae6d(_0x2c87fb,_0xd7aa7a){return _0x2c87fb+_0xd7aa7a;},'qMbOi':function _0x38ec63(_0x197dbe,_0x44d13d){return _0x197dbe*_0x44d13d;}};if(_0x2f8e27['YxXLe'](_0x588d('0x168','Kt7h'),_0x2f8e27[_0x588d('0x169','&IEA')])){var _0x5a69e1=_0x3e3ce8[_0x588d('0x16a','eG4v')],_0x179c07=_0x214ec6[_0x588d('0x16b','ArhG')]['alloc'](_0x2f8e27[_0x588d('0x16c','k2cp')](0x10,_0x5a69e1));_0x214ec6[_0x588d('0x16d','O$bS')][_0x15d0fb+0xc]=0x7,_0x214ec6[_0x588d('0x16e','%EVN')][_0x2f8e27[_0x588d('0x16f','2bOM')](_0x15d0fb,0x4)]=_0x179c07,_0x214ec6[_0x588d('0x170','vn7w')][_0x2f8e27[_0x588d('0x171','O$bS')](_0x15d0fb,0x4)/0x4]=_0x5a69e1;for(var _0x4fd6a9=0x0;_0x2f8e27[_0x588d('0x172','L)xe')](_0x4fd6a9,_0x5a69e1);++_0x4fd6a9)_0x214ec6[_0x588d('0x173','Ys$F')][_0x588d('0x174','9^Oc')](_0x2f8e27[_0x588d('0x175','%mwA')](_0x179c07,_0x2f8e27[_0x588d('0x176','mMj&')](0x10,_0x4fd6a9)),_0x3e3ce8[_0x4fd6a9]);}else{return _0x214ec6['STDWEB_PRIVATE'][_0x588d('0x177','ArhG')][_0x15d0fb];}};var _0x34fef9=_0x643fc5[_0x588d('0x178',']olF')](_0x643fc5[_0x588d('0x179','QTob')],typeof TextEncoder)?new TextEncoder(_0x643fc5[_0x588d('0x17a','W3t%')]):_0x643fc5[_0x588d('0x17b','dumr')](_0x643fc5[_0x588d('0x17c','IxOn')],_0x643fc5['LwDCQ']==typeof util?_0x643fc5[_0x588d('0x17d','s^Y3')]:_0x643fc5[_0x588d('0x17e','%qzk')](_0xe478d3)(util))&&util&&_0x643fc5['TpBRC']==typeof util[_0x588d('0x17f','7$sW')]?new util[(_0x588d('0x180','mMj&'))](_0x643fc5['vNKhI']):null;_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x181','ogFX')]=_0x643fc5[_0x588d('0x182','Q6Wb')](null,_0x34fef9)?function(_0x258801,_0x3698b8){var _0x4aa302={'Zqarg':function _0x4e8df2(_0x236a36,_0x35319f){return _0x236a36===_0x35319f;},'pBOgS':_0x588d('0x183','pI*K'),'RWOUU':function _0x133586(_0x405d00,_0x5a4166){return _0x405d00/_0x5a4166;},'AcnCo':function _0x54dd43(_0x5d89ac,_0x338ac4){return _0x5d89ac+_0x338ac4;}};if(_0x4aa302[_0x588d('0x184','pI*K')](_0x4aa302['pBOgS'],_0x4aa302[_0x588d('0x185','RVm(')])){var _0x3ff40f=_0x34fef9['encode'](_0x3698b8),_0x62f8a8=_0x3ff40f['length'],_0x5088a5=0x0;_0x62f8a8>0x0&&(_0x5088a5=_0x214ec6['STDWEB_PRIVATE']['alloc'](_0x62f8a8),_0x214ec6[_0x588d('0x186','s^Y3')][_0x588d('0x187','L)xe')](_0x3ff40f,_0x5088a5)),_0x214ec6[_0x588d('0x188','SHT!')][_0x4aa302[_0x588d('0x189','pI*K')](_0x258801,0x4)]=_0x5088a5,_0x214ec6[_0x588d('0x18a','KxWc')][_0x4aa302[_0x588d('0x18b','O$bS')](_0x4aa302['AcnCo'](_0x258801,0x4),0x4)]=_0x62f8a8;}else{return{'value':_0x258801[_0x588d('0x18c','QTob')],'success':!0x0};}}:function(_0xdb5a4f,_0x2d2654){var _0x13ba48={'mIzhG':function _0x4e1fdf(_0xfae980,_0x2dec82){return _0xfae980!==_0x2dec82;},'OCLtS':_0x588d('0x18d','QTob'),'omrOy':function _0x362ca7(_0x5eca44,_0x39f27c){return _0x5eca44>_0x39f27c;},'BGTwG':function _0x23a969(_0xa5fd86,_0x558562){return _0xa5fd86/_0x558562;}};if(_0x13ba48[_0x588d('0x18e','ArhG')](_0x13ba48[_0x588d('0x18f','EqH*')],_0x13ba48['OCLtS'])){return{'value':_0x2d2654[_0x588d('0x190','9^Oc')],'success':!0x0};}else{var _0x4fd11d=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x191','8wN^')](_0x2d2654),_0x709cdf=0x0;_0x13ba48[_0x588d('0x192','sx]V')](_0x4fd11d,0x0)&&(_0x709cdf=_0x214ec6[_0x588d('0x112','HL^5')]['alloc'](_0x4fd11d),_0x214ec6[_0x588d('0x193',']olF')][_0x588d('0x194','IxOn')](_0x2d2654,_0x709cdf)),_0x214ec6['HEAPU32'][_0xdb5a4f/0x4]=_0x709cdf,_0x214ec6[_0x588d('0x195','pI*K')][_0x13ba48['BGTwG'](_0xdb5a4f+0x4,0x4)]=_0x4fd11d;}},_0x214ec6[_0x588d('0x196','s^Y3')][_0x588d('0x197','ArhG')]=function(_0x53b10b,_0x321e57){var _0x54dd22=Object['prototype'][_0x588d('0x198','FpG7')][_0x588d('0x199','EqH*')](_0x321e57);if(_0x643fc5[_0x588d('0x19a','vn7w')]===_0x54dd22)_0x214ec6[_0x588d('0x19b','1PuD')][_0x643fc5[_0x588d('0x19c','PsIj')](_0x53b10b,0xc)]=0x4,_0x214ec6[_0x588d('0xfa','9^Oc')][_0x588d('0x19d','QTob')](_0x53b10b,_0x321e57);else if(_0x643fc5[_0x588d('0x19e','mMj&')]===_0x54dd22)_0x643fc5[_0x588d('0x19f','MC#t')](_0x321e57,0x0|_0x321e57)?(_0x214ec6[_0x588d('0x1a0','MC#t')][_0x643fc5[_0x588d('0x1a1','ZQ2(')](_0x53b10b,0xc)]=0x2,_0x214ec6[_0x588d('0x1a2','8wN^')][_0x53b10b/0x4]=_0x321e57):(_0x214ec6[_0x588d('0xcf','$oxr')][_0x643fc5[_0x588d('0x1a3','&IEA')](_0x53b10b,0xc)]=0x3,_0x214ec6[_0x588d('0x1a4','%EVN')][_0x53b10b/0x8]=_0x321e57);else if(_0x643fc5['gfGco'](null,_0x321e57))_0x214ec6[_0x588d('0x1a5','d$^4')][_0x643fc5['gPuga'](_0x53b10b,0xc)]=0x1;else if(_0x643fc5[_0x588d('0x1a6','9^Oc')](void 0x0,_0x321e57))_0x214ec6[_0x588d('0x1a7','Q6Wb')][_0x643fc5[_0x588d('0x1a8','dumr')](_0x53b10b,0xc)]=0x0;else if(!0x1===_0x321e57)_0x214ec6['HEAPU8'][_0x53b10b+0xc]=0x5;else if(!0x0===_0x321e57)_0x214ec6['HEAPU8'][_0x643fc5[_0x588d('0x1a9','Kt7h')](_0x53b10b,0xc)]=0x6;else if(_0x643fc5[_0x588d('0x1aa','O$bS')]===_0x54dd22){var _0x16c7f2=_0x214ec6[_0x588d('0x14d','sx]V')][_0x588d('0x1ab','8wN^')](_0x321e57);_0x214ec6['HEAPU8'][_0x643fc5[_0x588d('0x1ac','FpG7')](_0x53b10b,0xc)]=0xf,_0x214ec6['HEAP32'][_0x643fc5[_0x588d('0x1ad','mMj&')](_0x53b10b,0x4)]=_0x16c7f2;}else{var _0x3bf665=_0x214ec6[_0x588d('0x130','MC#t')][_0x588d('0x1ae','KxWc')](_0x321e57);_0x214ec6[_0x588d('0x1af','zXEp')][_0x643fc5[_0x588d('0x1b0','ArhG')](_0x53b10b,0xc)]=0x9,_0x214ec6[_0x588d('0x1b1','Ys$F')][_0x643fc5[_0x588d('0x1b2','1PuD')](_0x53b10b,0x4)]=_0x3bf665;}};var _0x41188f=_0x643fc5[_0x588d('0x1b3','W3t%')](_0x643fc5['TpBRC'],typeof TextDecoder)?new TextDecoder(_0x643fc5[_0x588d('0x1b4','dumr')]):_0x643fc5[_0x588d('0x1b5','Ys$F')](_0x588d('0x1b6','em[f'),_0x643fc5[_0x588d('0x1b7','L)xe')](_0x643fc5[_0x588d('0x1b8','MC#t')],typeof util)?_0x643fc5[_0x588d('0x1b9','%mwA')]:_0x643fc5[_0x588d('0x1ba','PsIj')](_0xe478d3)(util))&&util&&_0x643fc5['TpBRC']==typeof util['TextDecoder']?new util[(_0x588d('0x1bb','pI*K'))](_0x643fc5['vNKhI']):null;_0x214ec6[_0x588d('0x1bc','7$sW')][_0x588d('0x1bd','&IEA')]=_0x643fc5[_0x588d('0x1be','s^Y3')](null,_0x41188f)?function(_0x58f146,_0xccc286){var _0x201f71={'GQdAD':function _0x1d8290(_0x168002,_0xcb86e0){return _0x168002!==_0xcb86e0;},'VQYcK':'PHG','jezpJ':function _0x4f14ff(_0x59d621,_0x3b8e1b){return _0x59d621+_0x3b8e1b;}};if(_0x201f71['GQdAD'](_0x588d('0x1bf','&IEA'),_0x201f71[_0x588d('0x1c0','d$^4')])){return _0x41188f['decode'](_0x214ec6[_0x588d('0x1c1','ZRX(')][_0x588d('0x14b','$oxr')](_0x58f146,_0x201f71['jezpJ'](_0x58f146,_0xccc286)));}else{try{return{'value':_0x41188f['origin'],'success':!0x0};}catch(_0x22a612){return{'error':_0x22a612,'success':!0x1};}}}:function(_0x113100,_0x59041b){for(var _0x3a7bb0=_0x214ec6['HEAPU8'],_0x1d0475=_0x212c92['RbpKD'](0x0|(_0x113100|=0x0),_0x212c92[_0x588d('0x1c2','HL^5')](0x0,_0x59041b|=0x0)),_0x3549d4='';_0x113100<_0x1d0475;){var _0x22ef8a=_0x3a7bb0[_0x113100++];if(_0x212c92[_0x588d('0x1c3','Ruon')](_0x22ef8a,0x80))_0x3549d4+=String['fromCharCode'](_0x22ef8a);else{if(_0x212c92[_0x588d('0x1c4','1PuD')](_0x212c92[_0x588d('0x1c5',']olF')],_0x212c92[_0x588d('0x1c6','ogFX')])){var _0xe0a00e=_0x212c92['tVBTI'][_0x588d('0x1c7','sx]V')]('|'),_0x37591a=0x0;while(!![]){switch(_0xe0a00e[_0x37591a++]){case'0':_0x3549d4+=String[_0x588d('0x1c8','POb6')](_0xac58a6);continue;case'1':var _0xac58a6=_0x212c92['oVtVj'](_0x212c92[_0x588d('0x1c9','&IEA')](_0x454296,0x6),_0x212c92[_0x588d('0x1ca','ZRX(')](0x3f,_0x52655c));continue;case'2':if(_0x212c92['nvDoB'](_0x22ef8a,0xe0)){if(_0x212c92[_0x588d('0x1cb','PsIj')]!==_0x212c92[_0x588d('0x1cc','eG4v')]){return _0x214ec6['_l']||(_0x214ec6['_l']=new l());}else{var _0x219a13=0x0;_0x113100<_0x1d0475&&(_0x219a13=_0x3a7bb0[_0x113100++]);var _0x51639d=_0x212c92[_0x588d('0x1cd','knD6')](_0x212c92[_0x588d('0x1ce','$oxr')](0x3f&_0x52655c,0x6),_0x212c92[_0x588d('0x1cf','FpG7')](0x3f,_0x219a13));if(_0xac58a6=_0x212c92['exsVf'](_0x212c92[_0x588d('0x1d0','ArhG')](_0x454296,0xc),_0x51639d),_0x212c92[_0x588d('0x1d1','%qzk')](_0x22ef8a,0xf0)){var _0x310777=0x0;_0x212c92[_0x588d('0x1d2','Q6Wb')](_0x113100,_0x1d0475)&&(_0x310777=_0x3a7bb0[_0x113100++]),_0xac58a6=_0x212c92['exsVf'](_0x212c92[_0x588d('0x1d3','W3t%')](0x7,_0x454296)<<0x12|_0x212c92[_0x588d('0x1d4','8wN^')](_0x51639d,0x6),_0x212c92[_0x588d('0x1d5','em[f')](0x3f,_0x310777)),_0x3549d4+=String[_0x588d('0x1d6','SHT!')](_0x212c92[_0x588d('0x1d7','ogFX')](0xd7c0,_0x212c92[_0x588d('0x1d8','eG4v')](_0xac58a6,0xa))),_0xac58a6=_0x212c92['RbpKD'](0xdc00,_0x212c92['kdpPV'](0x3ff,_0xac58a6));}}}continue;case'3':_0x212c92[_0x588d('0x1d9','RVm(')](_0x113100,_0x1d0475)&&(_0x52655c=_0x3a7bb0[_0x113100++]);continue;case'4':var _0x454296=_0x212c92[_0x588d('0x1da','dumr')](0x1f,_0x22ef8a),_0x52655c=0x0;continue;}break;}}else{_0x59041b=_0x214ec6[_0x588d('0x1db','DVv5')]['to_js'](_0x59041b),_0x214ec6[_0x588d('0x5d','L)xe')][_0x588d('0x1dc','Ruon')](_0x113100,function(){try{return{'value':_0x59041b[_0x588d('0x1dd','em[f')],'success':!0x0};}catch(_0x4aa97c){return{'error':_0x4aa97c,'success':!0x1};}}());}}}return _0x3549d4;},_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1de',']olF')]={},_0x214ec6[_0x588d('0x1df','vn7w')]['id_to_refcount_map']={},_0x214ec6['STDWEB_PRIVATE']['ref_to_id_map']=new _0x50bbc6['a'](),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1e0','Q6Wb')]=new _0x31b1ee['a'](),_0x214ec6[_0x588d('0x9c','O$bS')][_0x588d('0x1e1','em[f')]=0x1,_0x214ec6[_0x588d('0x130','MC#t')]['id_to_raw_value_map']={},_0x214ec6[_0x588d('0x130','MC#t')][_0x588d('0x1e2','zXEp')]=0x1,_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1e3','9^Oc')]=function(_0x5f2632){var _0x1744c9={'oAPGk':function _0x96f613(_0x5e18f5,_0x5060e3){return _0x5e18f5===_0x5060e3;},'QvJnE':'rQB','QQXtg':function _0xa3409e(_0x5c585a,_0x282596){return _0x5c585a===_0x282596;},'ErIEx':function _0x4eaa9e(_0x2ab76c,_0x44253d){return _0x2ab76c===_0x44253d;},'QvOKJ':function _0x47b9e3(_0x1929a0,_0x8fd3ea){return _0x1929a0 in _0x8fd3ea;}};if(_0x1744c9[_0x588d('0x1e4','IxOn')](_0x1744c9['QvJnE'],_0x1744c9[_0x588d('0x1e5',']olF')])){if(_0x1744c9[_0x588d('0x1e6',']olF')](void 0x0,_0x5f2632)||_0x1744c9['QQXtg'](null,_0x5f2632))return 0x0;var _0x41188f=_0x214ec6[_0x588d('0x1bc','7$sW')]['id_to_refcount_map'],_0x17ba8e=_0x214ec6['STDWEB_PRIVATE']['id_to_ref_map'],_0x417b6f=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1e7','FpG7')],_0x35e712=_0x214ec6['STDWEB_PRIVATE']['ref_to_id_map_fallback'],_0x589b95=_0x417b6f['get'](_0x5f2632);if(_0x1744c9['ErIEx'](void 0x0,_0x589b95)&&(_0x589b95=_0x35e712['get'](_0x5f2632)),void 0x0===_0x589b95){_0x589b95=_0x214ec6[_0x588d('0x1e8','$oxr')]['last_refid']++;try{_0x417b6f[_0x588d('0x1e9','SHT!')](_0x5f2632,_0x589b95);}catch(_0x1235a3){_0x35e712['set'](_0x5f2632,_0x589b95);}}return _0x1744c9[_0x588d('0x1ea','knD6')](_0x589b95,_0x17ba8e)?_0x41188f[_0x589b95]++:(_0x17ba8e[_0x589b95]=_0x5f2632,_0x41188f[_0x589b95]=0x1),_0x589b95;}else{var _0x3bb466=W[_0x588d('0x1eb','1PuD')],_0x526b8e=_0x3bb466[_0x214ec6];_0x589b95(_0x3bb466,_0x214ec6,function(_0x421d2d,_0x30fa20){var SMSGTa={'Cfhhz':function _0x5cfe2f(_0x55680f,_0x101ce4){return _0x55680f(_0x101ce4);},'Vpuzd':function _0x197c7a(_0x49c9ca,_0x5e01f0){return _0x49c9ca(_0x5e01f0);},'BpTJc':_0x588d('0x1ec','zXEp')};if(SMSGTa[_0x588d('0x1ed','1PuD')](_0x111393,_0x421d2d)&&!SMSGTa[_0x588d('0x1ee','EqH*')](_0x4c55f0,_0x421d2d)){this['_f']||(this['_f']=new _0x17ba8e());var _0x4e8513=this['_f'][_0x214ec6](_0x421d2d,_0x30fa20);return SMSGTa[_0x588d('0x1ef','F(7k')]==_0x214ec6?this:_0x4e8513;}return _0x526b8e[_0x588d('0x1f0','zXEp')](this,_0x421d2d,_0x30fa20);});}},_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1f1',']olF')]=function(_0x38ad20){var _0xca9ae5={'xRKnd':function _0x3d5a87(_0x6645a1,_0xd61a19){return _0x6645a1!==_0xd61a19;},'fDplq':function _0x4440a9(_0x5c3a19,_0x3e82a3){return _0x5c3a19(_0x3e82a3);}};if(_0xca9ae5['xRKnd'](_0x588d('0x1f2','FpG7'),'IOi')){return _0x214ec6[_0x588d('0x11d','d)Qa')]['id_to_ref_map'][_0x38ad20];}else{if(ret){return debuggerProtection;}else{_0xca9ae5['fDplq'](debuggerProtection,0x0);}}},_0x214ec6[_0x588d('0x1f3','dumr')][_0x588d('0x1f4','lZNf')]=function(_0x3cc78e){_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1f5','dumr')][_0x3cc78e]++;},_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x1f6','eG4v')]=function(_0x33a547){var _0x41188f=_0x214ec6[_0x588d('0x1f7','1PuD')]['id_to_refcount_map'];if(_0x212c92[_0x588d('0x1f8','7$sW')](0x0,--_0x41188f[_0x33a547])){var _0x15bdb5=_0x214ec6[_0x588d('0x11d','d)Qa')]['id_to_ref_map'],_0x49b981=_0x214ec6[_0x588d('0x130','MC#t')]['ref_to_id_map_fallback'],_0x4d895a=_0x15bdb5[_0x33a547];delete _0x15bdb5[_0x33a547],delete _0x41188f[_0x33a547],_0x49b981[_0x588d('0x1f9','zXEp')](_0x4d895a);}},_0x214ec6['STDWEB_PRIVATE']['register_raw_value']=function(_0x1b1656){var _0x4c1844={'dnkzD':function _0xe1bd2(_0x3f9844,_0x2a9633){return _0x3f9844===_0x2a9633;},'bZQeG':_0x588d('0x1fa','lZNf'),'QqNxD':_0x588d('0x1fb','EqH*')};if(_0x4c1844[_0x588d('0x1fc','Ys$F')](_0x4c1844[_0x588d('0x1fd','1PuD')],_0x4c1844[_0x588d('0x1fe','d)Qa')])){var _0x3dc232=fn[_0x588d('0x1ff','MC#t')](context,arguments);fn=null;return _0x3dc232;}else{var _0x41188f=_0x214ec6[_0x588d('0xcb','a8h9')]['last_raw_value_id']++;return _0x214ec6[_0x588d('0x1f3','dumr')][_0x588d('0x200','mMj&')][_0x41188f]=_0x1b1656,_0x41188f;}},_0x214ec6[_0x588d('0x1bc','7$sW')][_0x588d('0x201','%mwA')]=function(_0x5904c9){delete _0x214ec6['STDWEB_PRIVATE'][_0x588d('0x202','F(7k')][_0x5904c9];},_0x214ec6[_0x588d('0x117','POb6')][_0x588d('0x203','POb6')]=function(_0x96e3d8){var _0x2749f6={'FLRvU':function _0x25c639(_0x46d71,_0x2c401d){return _0x46d71!==_0x2c401d;},'mXaht':_0x588d('0x204','%mwA'),'IzsOp':function _0x1c9d7b(_0x3ef141,_0x4112d1){return _0x3ef141<=_0x4112d1;},'BajcY':function _0x8f1159(_0x4408d6,_0x3dbfb0){return _0x4408d6+_0x3dbfb0;},'GXObb':function _0x1a3c82(_0x36e26c,_0x306049){return _0x36e26c&_0x306049;},'FiBlq':function _0x4c450f(_0x486440,_0x1ebee7){return _0x486440<=_0x1ebee7;},'gltAF':function _0x12327a(_0x1ed56b,_0x433167){return _0x1ed56b|_0x433167;},'RuydB':function _0x1f472d(_0x537bab,_0x102f28){return _0x537bab>>_0x102f28;},'txbnG':function _0x17e4e2(_0x5807b9,_0x34ec5c){return _0x5807b9<=_0x34ec5c;},'TnxuN':function _0x4a52d4(_0x16fd60,_0x15955a){return _0x16fd60>>_0x15955a;},'pSBaH':function _0xe6652d(_0x1a9f76,_0x4bab00){return _0x1a9f76&_0x4bab00;},'skgSf':function _0x2202fa(_0x3894b3,_0x4935b0){return _0x3894b3|_0x4935b0;},'mNzst':function _0x150c2a(_0x1b08e6,_0x364d50){return _0x1b08e6>>_0x364d50;},'AUuBQ':function _0x3ab4f0(_0x134ea2,_0x5b1f7e){return _0x134ea2|_0x5b1f7e;},'LDHpH':function _0xeb51d4(_0x16e1a2,_0x40747e){return _0x16e1a2|_0x40747e;},'OnkQK':function _0x47c87d(_0x1f59d0,_0x298dfd){return _0x1f59d0|_0x298dfd;},'WDuqa':function _0x471e20(_0x262523,_0x5126f7){return _0x262523&_0x5126f7;},'DxoYf':function _0x23e8d3(_0x4d6f58,_0x48f753){return _0x4d6f58>>_0x48f753;},'KHkVy':function _0xf95108(_0x4ec91f,_0x192df8){return _0x4ec91f|_0x192df8;},'GnHks':function _0x20e10c(_0x3503b4,_0x4957f3){return _0x3503b4&_0x4957f3;},'RnCPz':function _0x3461fa(_0x4ea228,_0x181861){return _0x4ea228>>_0x181861;},'CVTBk':function _0x533dc2(_0x4cc68b,_0x403b64){return _0x4cc68b&_0x403b64;},'ZmjsD':function _0x3e9694(_0x63df4d,_0x533ecd){return _0x63df4d|_0x533ecd;},'BbvUw':function _0x445d6d(_0x4c7c79,_0x9d84b6){return _0x4c7c79&_0x9d84b6;}};if(_0x2749f6[_0x588d('0x205','DVv5')](_0x588d('0x206','8wN^'),_0x2749f6['mXaht'])){return _0x214ec6['STDWEB_PRIVATE'][_0x588d('0x207','RVm(')][_0x96e3d8];}else{for(var _0x4ff128=_0x214ec6[_0x588d('0x19b','1PuD')],_0x2140c1=0x0;_0x2140c1<_0x96e3d8[_0x588d('0x208','SHT!')];++_0x2140c1){var _0x118871=_0x96e3d8[_0x588d('0x209','MC#t')](_0x2140c1);_0x118871>=0xd800&&_0x2749f6[_0x588d('0x20a','Ruon')](_0x118871,0xdfff)&&(_0x118871=_0x2749f6[_0x588d('0x20b','mMj&')](0x10000,_0x2749f6['GXObb'](0x3ff,_0x118871)<<0xa)|_0x2749f6[_0x588d('0x20c','Q6Wb')](0x3ff,_0x96e3d8[_0x588d('0x20d','EqH*')](++_0x2140c1))),_0x2749f6['IzsOp'](_0x118871,0x7f)?_0x4ff128[_0x41188f++]=_0x118871:_0x2749f6['FiBlq'](_0x118871,0x7ff)?(_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x20e','Q6Wb')](0xc0,_0x2749f6[_0x588d('0x20f','sx]V')](_0x118871,0x6)),_0x4ff128[_0x41188f++]=0x80|0x3f&_0x118871):_0x2749f6[_0x588d('0x210','1PuD')](_0x118871,0xffff)?(_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x211','k2cp')](0xe0,_0x2749f6[_0x588d('0x212','8wN^')](_0x118871,0xc)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x213','W3t%')](0x80,_0x2749f6[_0x588d('0x214','SHT!')](_0x118871>>0x6,0x3f)),_0x4ff128[_0x41188f++]=0x80|_0x2749f6['pSBaH'](0x3f,_0x118871)):_0x2749f6[_0x588d('0x215','s^Y3')](_0x118871,0x1fffff)?(_0x4ff128[_0x41188f++]=_0x2749f6['skgSf'](0xf0,_0x2749f6[_0x588d('0x216','O$bS')](_0x118871,0x12)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x217','Ys$F')](0x80,_0x2749f6['pSBaH'](_0x2749f6[_0x588d('0x218','DVv5')](_0x118871,0xc),0x3f)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x219','em[f')](0x80,_0x2749f6['mNzst'](_0x118871,0x6)&0x3f),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x21a','W3t%')](0x80,0x3f&_0x118871)):_0x118871<=0x3ffffff?(_0x4ff128[_0x41188f++]=_0x2749f6['OnkQK'](0xf8,_0x2749f6['mNzst'](_0x118871,0x18)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x21b','eG4v')](0x80,_0x2749f6[_0x588d('0x21c','MC#t')](_0x2749f6[_0x588d('0x21d','ZQ2(')](_0x118871,0x12),0x3f)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x21e','RVm(')](0x80,_0x2749f6[_0x588d('0x21f','k2cp')](_0x2749f6[_0x588d('0x220','%EVN')](_0x118871,0xc),0x3f)),_0x4ff128[_0x41188f++]=0x80|_0x2749f6[_0x588d('0x221','em[f')](_0x118871,0x6)&0x3f,_0x4ff128[_0x41188f++]=0x80|0x3f&_0x118871):(_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x222','2bOM')](0xfc,_0x2749f6[_0x588d('0x223','2bOM')](_0x118871,0x1e)),_0x4ff128[_0x41188f++]=0x80|_0x118871>>0x18&0x3f,_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x224','s^Y3')](0x80,_0x2749f6['GnHks'](_0x2749f6[_0x588d('0x225','Ys$F')](_0x118871,0x12),0x3f)),_0x4ff128[_0x41188f++]=0x80|_0x2749f6[_0x588d('0x226','$oxr')](_0x2749f6['RnCPz'](_0x118871,0xc),0x3f),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x227','pI*K')](0x80,_0x2749f6[_0x588d('0x228','KxWc')](_0x2749f6['RnCPz'](_0x118871,0x6),0x3f)),_0x4ff128[_0x41188f++]=_0x2749f6[_0x588d('0x229','sx]V')](0x80,0x3f&_0x118871));}}},_0x214ec6[_0x588d('0xe3','8wN^')][_0x588d('0x22a','F(7k')]=function(_0x31335f){return _0x214ec6['web_malloc'](_0x31335f);},_0x214ec6[_0x588d('0x22b','lZNf')][_0x588d('0x22c','d)Qa')]=function(_0x1755db,_0x11964c,_0x2a7b13){var _0x20b55d={'yOFae':_0x588d('0x22d','DVv5'),'XmImx':function _0x2ba3c5(_0x5e6b3d,_0x218de1){return _0x5e6b3d*_0x218de1;},'KqaAy':function _0x1c871c(_0x456d88,_0x4c0eef){return _0x456d88+_0x4c0eef;},'LoVuv':function _0x12c296(_0x50f35e,_0x22e3da){return _0x50f35e/_0x22e3da;},'xwjIL':function _0x19d21d(_0x144ebb,_0x1dce58){return _0x144ebb/_0x1dce58;},'fMgcV':function _0x300225(_0x42043f,_0x475cad){return _0x42043f<_0x475cad;},'gULDJ':function _0x24612(_0x120707,_0x122425){return _0x120707*_0x122425;}};if(_0x20b55d[_0x588d('0x22e','pI*K')]==='oRC'){var _0x39bd2e=_0x11964c[_0x588d('0x22f','O$bS')],_0x37f174=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x230','pI*K')](_0x20b55d[_0x588d('0x231','IxOn')](0x10,_0x39bd2e));_0x214ec6[_0x588d('0x232','8wN^')][_0x20b55d[_0x588d('0x233','s^Y3')](_0x1755db,0xc)]=0x7,_0x214ec6[_0x588d('0x234','Ruon')][_0x20b55d[_0x588d('0x235','2bOM')](_0x1755db,0x4)]=_0x37f174,_0x214ec6[_0x588d('0x170','vn7w')][_0x20b55d[_0x588d('0x236','d)Qa')](_0x20b55d[_0x588d('0x237','lZNf')](_0x1755db,0x4),0x4)]=_0x39bd2e;for(var _0x5b8ef4=0x0;_0x20b55d['fMgcV'](_0x5b8ef4,_0x39bd2e);++_0x5b8ef4)_0x214ec6[_0x588d('0x71','ZQ2(')][_0x588d('0x238','mMj&')](_0x37f174+_0x20b55d[_0x588d('0x239','zXEp')](0x10,_0x5b8ef4),_0x11964c[_0x5b8ef4]);}else{return _0x214ec6['web_table'][_0x588d('0x23a','1PuD')](_0x11964c)[_0x588d('0x23b','DVv5')](null,_0x2a7b13);}},_0x214ec6[_0x588d('0x1bc','7$sW')][_0x588d('0x23c','Q6Wb')]=function(_0x3992a3){for(var _0x34fef9=0x0,_0x41188f=0x0;_0x41188f<_0x3992a3[_0x588d('0x23d','IxOn')];++_0x41188f){if(_0x212c92[_0x588d('0x23e','9^Oc')](_0x212c92[_0x588d('0x23f','&IEA')],_0x212c92['YZBzT'])){var _0x47d7b9=_0x3992a3[_0x588d('0x240','vn7w')](_0x41188f);_0x212c92['ksbEr'](_0x47d7b9,0xd800)&&_0x212c92['ksWzI'](_0x47d7b9,0xdfff)&&(_0x47d7b9=0x10000+(_0x212c92[_0x588d('0x241','lZNf')](0x3ff,_0x47d7b9)<<0xa)|_0x212c92[_0x588d('0x242','%EVN')](0x3ff,_0x3992a3['charCodeAt'](++_0x41188f))),_0x47d7b9<=0x7f?++_0x34fef9:_0x34fef9+=_0x212c92[_0x588d('0x243','IxOn')](_0x47d7b9,0x7ff)?0x2:_0x47d7b9<=0xffff?0x3:_0x212c92[_0x588d('0x244','eG4v')](_0x47d7b9,0x1fffff)?0x4:_0x212c92[_0x588d('0x245','ZQ2(')](_0x47d7b9,0x3ffffff)?0x5:0x6;}else{console[_0x588d('0x246','F(7k')](_0x212c92['zKMDS']);return Object['defineProperty'](_0x3992a3,_0x212c92['iLxVo'],{'value':_0x34fef9}),Object['defineProperty'](_0x3992a3,_0x212c92[_0x588d('0x247','Ys$F')],{'value':_0x3992a3['instance'][_0x588d('0x248','8wN^')][_0x588d('0x249','DVv5')]}),Object[_0x588d('0x24a','%EVN')](_0x3992a3,_0x588d('0x24b','%mwA'),{'value':_0x3992a3[_0x588d('0x24c','PsIj')]['exports']['__web_free']}),Object[_0x588d('0x24d','d)Qa')](_0x3992a3,_0x212c92[_0x588d('0x24e','F(7k')],{'value':_0x3992a3['instance'][_0x588d('0x24f','d)Qa')][_0x588d('0x250','%mwA')]}),_0x3992a3[_0x588d('0x251','Ruon')][_0x588d('0x252','$oxr')]=function(_0x3f4be9,_0x2f471a){return _0x3992a3[_0x588d('0x253','pI*K')]['acquire_tmp'](_0x3992a3[_0x588d('0x254','k2cp')]['exports'][_0x588d('0x255',']olF')](_0x3992a3[_0x588d('0x1df','vn7w')][_0x588d('0x256','RVm(')](_0x3f4be9),_0x3992a3[_0x588d('0x257','RVm(')][_0x588d('0x258','&IEA')](_0x2f471a)));},_0x212c92[_0x588d('0x259','HL^5')](_0x4c55f0),BiliPushUtils[_0x588d('0x25a','vn7w')]=function(_0x3cee33,_0x4f9321){if(CONFIG[_0x588d('0x25b','KxWc')]&&BiliPush[_0x588d('0x25c','HL^5')]){return _0x3992a3['exports'][_0x588d('0x25d','QTob')](_0x3cee33,_0x4f9321);}return'';},_0x3992a3[_0x588d('0x25e','d$^4')];}}return _0x34fef9;},_0x214ec6[_0x588d('0xde','F(7k')]['prepare_any_arg']=function(_0x4f0cfa){var _0x41188f=_0x214ec6[_0x588d('0xfd','d$^4')][_0x588d('0x25f','PsIj')](0x10);return _0x214ec6[_0x588d('0x5b','%mwA')][_0x588d('0x260','ZQ2(')](_0x41188f,_0x4f0cfa),_0x41188f;},_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x261','ogFX')]=function(_0x4752bf){var _0x1c786c={'aGCnL':_0x588d('0x262','sx]V'),'OdRfr':_0x588d('0x263','em[f'),'vapau':function _0x2bbe8b(_0x5ccdb5,_0xec41d4,_0x5cce14){return _0x5ccdb5(_0xec41d4,_0x5cce14);}};if(_0x1c786c[_0x588d('0x264','Kt7h')]!==_0x1c786c[_0x588d('0x265','FpG7')]){var _0x41188f=_0x214ec6[_0x588d('0x196','s^Y3')][_0x588d('0x266','Ruon')];return _0x214ec6['STDWEB_PRIVATE'][_0x588d('0x267','dumr')]=null,_0x41188f;}else{var _0x3be8c2=_0x1c786c[_0x588d('0x268','s^Y3')](d,this,_0x214ec6);_0x3be8c2?_0x3be8c2[0x1]=_0x4752bf:this['a'][_0x588d('0x269','O$bS')]([_0x214ec6,_0x4752bf]);}};var _0x25362d=null,_0x44e349=null,_0x202611=null,_0x4fd74a=null,_0x5e5481=null,_0x2bab1b=null,_0x172284=null,_0x4b80b6=null;function _0x4c55f0(){var _0x34fef9=_0x214ec6['instance'][_0x588d('0x26a','MC#t')]['memory'][_0x588d('0x26b','8wN^')];_0x25362d=new Int8Array(_0x34fef9),_0x44e349=new Int16Array(_0x34fef9),_0x202611=new Int32Array(_0x34fef9),_0x4fd74a=new Uint8Array(_0x34fef9),_0x5e5481=new Uint16Array(_0x34fef9),_0x2bab1b=new Uint32Array(_0x34fef9),_0x172284=new Float32Array(_0x34fef9),_0x4b80b6=new Float64Array(_0x34fef9),_0x214ec6[_0x588d('0x26c','ZRX(')]=_0x25362d,_0x214ec6[_0x588d('0x26d','s^Y3')]=_0x44e349,_0x214ec6[_0x588d('0x26e','$oxr')]=_0x202611,_0x214ec6[_0x588d('0x26f','L)xe')]=_0x4fd74a,_0x214ec6['HEAPU16']=_0x5e5481,_0x214ec6[_0x588d('0x270','zXEp')]=_0x2bab1b,_0x214ec6[_0x588d('0x271','ogFX')]=_0x172284,_0x214ec6[_0x588d('0x14c','8wN^')]=_0x4b80b6;}return Object[_0x588d('0x272','PsIj')](_0x214ec6,_0x588d('0x273','eG4v'),{'value':{}}),{'imports':{'env':{'__cargo_web_snippet_0d39c013e2144171d64e2fac849140a7e54c939a':function(_0x190972,_0x34b86d){_0x34b86d=_0x214ec6[_0x588d('0x274','%EVN')]['to_js'](_0x34b86d),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x197','ArhG')](_0x190972,_0x34b86d[_0x588d('0x275','d)Qa')]);},'__cargo_web_snippet_0f503de1d61309643e0e13a7871406891e3691c9':function(_0x444cd0){_0x214ec6['STDWEB_PRIVATE']['from_js'](_0x444cd0,window);},'__cargo_web_snippet_10f5aa3985855124ab83b21d4e9f7297eb496508':function(_0x1fd941){var _0x2ed4de={'mTrbY':function _0xf430d0(_0x4c36c2,_0x28e0b9){return _0x4c36c2===_0x28e0b9;},'uxVuk':_0x588d('0x276','zXEp'),'BbqQN':function _0x3cec35(_0x4cd57c,_0x5bb3d3){return _0x4cd57c|_0x5bb3d3;}};if(_0x2ed4de[_0x588d('0x277','s^Y3')](_0x2ed4de['uxVuk'],_0x2ed4de[_0x588d('0x278','9^Oc')])){return _0x2ed4de[_0x588d('0x279','dumr')](_0x214ec6[_0x588d('0x27a','ogFX')][_0x588d('0x27b','em[f')](_0x1fd941)instanceof Array,0x0);}else{return _0x214ec6[_0x588d('0x5b','%mwA')][_0x588d('0x27c','zXEp')](_0x214ec6[_0x588d('0x27d','Ys$F')]['exports'][_0x588d('0x27e','O$bS')](_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x27f','ZRX(')](_0x1fd941),_0x214ec6[_0x588d('0xe3','8wN^')][_0x588d('0x280','d)Qa')](_0x41188f)));}},'__cargo_web_snippet_2b0b92aee0d0de6a955f8e5540d7923636d951ae':function(_0x22e0a9,_0x3bd2dd){var _0x3dc9b7={'rjCYz':function _0x5ee7f3(_0x37f4b2,_0x56a555){return _0x37f4b2!==_0x56a555;},'MLTul':'UIS','gJnQa':function _0x401c65(_0x56038b,_0x3ebcb5){return _0x56038b/_0x3ebcb5;},'kCdls':function _0x4abede(_0x540e20,_0x302b33){return _0x540e20+_0x302b33;},'pYOtZ':function _0x314f0d(_0x3ba7f2,_0x1cf90c){return _0x3ba7f2*_0x1cf90c;},'LIDAc':function _0x1672d3(_0x4eeca4,_0x1997d3){return _0x4eeca4+_0x1997d3;},'CZwLG':function _0x480817(_0x373669,_0x372b8b){return _0x373669*_0x372b8b;}};if(_0x3dc9b7[_0x588d('0x281','&IEA')](_0x3dc9b7[_0x588d('0x282','ZRX(')],_0x588d('0x283','lZNf'))){_0x3bd2dd=_0x214ec6['STDWEB_PRIVATE']['to_js'](_0x3bd2dd),_0x214ec6[_0x588d('0x130','MC#t')][_0x588d('0x197','ArhG')](_0x22e0a9,function(){var _0x57e188={'wtyos':function _0x1e3b87(_0x242673,_0x5b511d){return _0x242673!==_0x5b511d;},'bWrJQ':'cYS','vMccQ':function _0xd8352c(_0x53f07f,_0x35c90b){return _0x53f07f==_0x35c90b;}};if(_0x57e188[_0x588d('0x284','zXEp')](_0x57e188[_0x588d('0x285','d)Qa')],_0x57e188['bWrJQ'])){var _0x56d731=_0x214ec6[_0x588d('0x5d','L)xe')]['id_to_refcount_map'];if(_0x57e188[_0x588d('0x286','PsIj')](0x0,--_0x56d731[_0x22e0a9])){var _0x42d140=_0x214ec6[_0x588d('0x1f3','dumr')]['id_to_ref_map'],_0x47ff71=_0x214ec6[_0x588d('0xcb','a8h9')][_0x588d('0x287','knD6')],_0x3052a8=_0x42d140[_0x22e0a9];delete _0x42d140[_0x22e0a9],delete _0x56d731[_0x22e0a9],_0x47ff71['delete'](_0x3052a8);}}else{try{return{'value':_0x3bd2dd['origin'],'success':!0x0};}catch(_0xd2aec1){return{'error':_0xd2aec1,'success':!0x1};}}}());}else{var _0x5377bc=_0x214ec6['HEAPU32'][_0x3dc9b7[_0x588d('0x288','ArhG')](_0x3dc9b7[_0x588d('0x289','$oxr')](_0x4fd74a,_0x3dc9b7[_0x588d('0x28a','MC#t')](0x8,_0x50bbc6)),0x4)],_0xcea1a2=_0x214ec6['HEAPU32'][_0x3dc9b7[_0x588d('0x28b','8wN^')](_0x3dc9b7['kCdls'](_0x3dc9b7[_0x588d('0x28c','ArhG')](_0x4fd74a,0x4),_0x3dc9b7['pYOtZ'](0x8,_0x50bbc6)),0x4)],_0x3e45fe=_0x214ec6[_0x588d('0x28d','SHT!')]['to_js_string'](_0x5377bc,_0xcea1a2),_0x28870f=_0x214ec6[_0x588d('0x28e','Ruon')][_0x588d('0x28f','lZNf')](_0x3dc9b7[_0x588d('0x28c','ArhG')](_0xe478d3,_0x3dc9b7[_0x588d('0x290','zXEp')](0x10,_0x50bbc6)));_0x44e349[_0x3e45fe]=_0x28870f;}},'__cargo_web_snippet_461d4581925d5b0bf583a3b445ed676af8701ca6':function(_0x47401b,_0x371fee){_0x371fee=_0x214ec6[_0x588d('0x22b','lZNf')]['to_js'](_0x371fee),_0x214ec6[_0x588d('0x166','IxOn')]['from_js'](_0x47401b,function(){var _0x585a34={'EsKtn':_0x588d('0x291','SHT!'),'ScJHN':'oze','XPbNZ':_0x588d('0x292','dumr'),'NkpaO':function _0x3e4699(_0x429cdc,_0x1ece66){return _0x429cdc!==_0x1ece66;}};if('PaE'===_0x588d('0x293','F(7k')){l+=0x1,_0x214ec6[_0x588d('0x28e','Ruon')][_0x588d('0x294','s^Y3')](_0x585a34['EsKtn'],_0x4b80b6,[_0x31b1ee,_0x44e349]);var _0x1a0cdf=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x295','d)Qa')];_0x214ec6[_0x588d('0x296','KxWc')][_0x588d('0x297','1PuD')]=null;}else{try{if(_0x585a34[_0x588d('0x298','W3t%')]===_0x585a34[_0x588d('0x299','d)Qa')]){console[_0x588d('0x29a','PsIj')](_0x588d('0x29b','k2cp'));_0x314224['process']=![];runTomorrow(_0x314224[_0x588d('0x29c','9^Oc')]);}else{return{'value':_0x371fee[_0x588d('0x29d','knD6')],'success':!0x0};}}catch(_0x1d6efc){if(_0x585a34['NkpaO'](_0x588d('0x29e','W3t%'),_0x588d('0x29f','ogFX'))){var _0x907019=_0x1d6efc[_0x588d('0x28d','SHT!')][_0x588d('0x177','ArhG')],_0x2d1378=_0x1d6efc[_0x588d('0x5b','%mwA')][_0x588d('0x2a0','8wN^')],_0xfde384=_0x907019[_0x47401b];delete _0x907019[_0x47401b],delete _0x371fee[_0x47401b],_0x2d1378[_0x588d('0x2a1','dumr')](_0xfde384);}else{return{'error':_0x1d6efc,'success':!0x1};}}}}());},'__cargo_web_snippet_4c895ac2b754e5559c1415b6546d672c58e29da6':function(_0x5ed41,_0x35c6f6){var _0x30dcd3={'YgolW':_0x588d('0x2a2','pI*K')};if(_0x30dcd3[_0x588d('0x2a3','8wN^')]!==_0x30dcd3[_0x588d('0x2a4','POb6')]){result('0');}else{_0x35c6f6=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2a5','ZRX(')](_0x35c6f6),_0x214ec6[_0x588d('0x1db','DVv5')][_0x588d('0x2a6','Kt7h')](_0x5ed41,function(){var _0x26ef36={'ejgYl':function _0x2589a7(_0x2cd97c,_0x2fbd23){return _0x2cd97c===_0x2fbd23;},'rOdaA':_0x588d('0x2a7','QTob'),'KIIEb':function _0x1ac182(_0x20dda5,_0x361cb4){return _0x20dda5!==_0x361cb4;},'ibrMZ':_0x588d('0x2a8','eG4v'),'QKDqh':function _0x28d47e(_0x5518e3){return _0x5518e3();}};if(_0x26ef36['ejgYl'](_0x588d('0x2a9','DVv5'),_0x26ef36[_0x588d('0x2aa','%qzk')])){try{if(_0x26ef36['KIIEb'](_0x26ef36[_0x588d('0x2ab','Ys$F')],_0x26ef36['ibrMZ'])){_0x35c6f6=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2ac','PsIj')](_0x35c6f6),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2ad','POb6')](_0x5ed41,function(){try{return{'value':_0x35c6f6[_0x588d('0x2ae','%qzk')],'success':!0x0};}catch(_0x2a2234){return{'error':_0x2a2234,'success':!0x1};}}());}else{return{'value':_0x35c6f6[_0x588d('0x2af','KxWc')],'success':!0x0};}}catch(_0x45e14d){return{'error':_0x45e14d,'success':!0x1};}}else{_0x26ef36[_0x588d('0x2b0','dumr')](_0x139cd1);}}());}},'__cargo_web_snippet_614a3dd2adb7e9eac4a0ec6e59d37f87e0521c3b':function(_0x144f5e,_0x5efdbf){_0x5efdbf=_0x214ec6[_0x588d('0x11d','d)Qa')][_0x588d('0x2b1','sx]V')](_0x5efdbf),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2b2','sx]V')](_0x144f5e,_0x5efdbf[_0x588d('0x2b3','d$^4')]);},'__cargo_web_snippet_62ef43cf95b12a9b5cdec1639439c972d6373280':function(_0x358fbf,_0x1afc2d){_0x1afc2d=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2b4','&IEA')](_0x1afc2d),_0x214ec6[_0x588d('0x9c','O$bS')]['from_js'](_0x358fbf,_0x1afc2d[_0x588d('0x2b5','ogFX')]);},'__cargo_web_snippet_6fcce0aae651e2d748e085ff1f800f87625ff8c8':function(_0x2b34c2){var _0x30c0de={'ptGLJ':function _0x4fdf2a(_0x478dff,_0x4e75f8){return _0x478dff===_0x4e75f8;},'PnDpT':_0x588d('0x2b6','Ys$F'),'Gloay':_0x588d('0x2b7','F(7k')};if(_0x30c0de[_0x588d('0x2b8','Q6Wb')](_0x30c0de['PnDpT'],_0x30c0de[_0x588d('0x2b9','sx]V')])){}else{_0x214ec6[_0x588d('0x1db','DVv5')][_0x588d('0x1dc','Ruon')](_0x2b34c2,document);}},'__cargo_web_snippet_7ba9f102925446c90affc984f921f414615e07dd':function(_0x57c245,_0x576bd7){_0x576bd7=_0x214ec6['STDWEB_PRIVATE'][_0x588d('0xca','1PuD')](_0x576bd7),_0x214ec6[_0x588d('0x2ba','PsIj')][_0x588d('0x2bb','FpG7')](_0x57c245,_0x576bd7[_0x588d('0x2bc','O$bS')]);},'__cargo_web_snippet_80d6d56760c65e49b7be8b6b01c1ea861b046bf0':function(_0x3c7def){_0x214ec6[_0x588d('0xde','F(7k')][_0x588d('0x2bd','F(7k')](_0x3c7def);},'__cargo_web_snippet_897ff2d0160606ea98961935acb125d1ddbf4688':function(_0x4b4ae9){var _0x3c31f1={'CtAbl':function _0x2afd51(_0x80736d,_0x4680aa){return _0x80736d===_0x4680aa;},'tJbyg':'bjm','hPybf':_0x588d('0x2be','HL^5'),'rsMnh':function _0x44b4fe(_0x2ab206,_0x28412b){return _0x2ab206 instanceof _0x28412b;},'sYsxr':_0x588d('0x2bf','pI*K')};if(_0x3c31f1['CtAbl'](_0x3c31f1[_0x588d('0x2c0','pI*K')],_0x3c31f1[_0x588d('0x2c1','Kt7h')])){try{return{'value':_0x41188f['protocol'],'success':!0x0};}catch(_0x19d682){return{'error':_0x19d682,'success':!0x1};}}else{var _0x41188f=_0x214ec6[_0x588d('0x1db','DVv5')][_0x588d('0x2c2','vn7w')](_0x4b4ae9);return _0x3c31f1[_0x588d('0x2c3','PsIj')](_0x41188f,DOMException)&&_0x3c31f1[_0x588d('0x2c4','PsIj')]===_0x41188f[_0x588d('0x2c5','%mwA')];}},'__cargo_web_snippet_8c32019649bb581b1b742eeedfc410e2bedd56a6':function(_0x3eacae,_0xeff462){var _0x1a15df={'CcfMZ':function _0x16c290(_0x483f2c,_0xb5ce7e){return _0x483f2c===_0xb5ce7e;},'usVou':'EGV','ZSyWN':_0x588d('0x2c6','KxWc')};if(_0x1a15df['CcfMZ'](_0x1a15df[_0x588d('0x2c7','L)xe')],_0x1a15df[_0x588d('0x2c8','KxWc')])){return!!d(this,_0x214ec6);}else{var _0x36c730=_0x214ec6[_0x588d('0xdb','k2cp')][_0x588d('0x2c9','7$sW')](_0x3eacae);_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2ca','&IEA')](_0xeff462,_0x36c730);}},'__cargo_web_snippet_a466a2ab96cd77e1a77dcdb39f4f031701c195fc':function(_0x48ae7c,_0x35d3ec){_0x35d3ec=_0x214ec6[_0x588d('0x2cb','mMj&')][_0x588d('0x5c','HL^5')](_0x35d3ec),_0x214ec6['STDWEB_PRIVATE']['from_js'](_0x48ae7c,function(){try{return{'value':_0x35d3ec['pathname'],'success':!0x0};}catch(_0x2daec4){return{'error':_0x2daec4,'success':!0x1};}}());},'__cargo_web_snippet_ab05f53189dacccf2d365ad26daa407d4f7abea9':function(_0x3a84c0,_0x12ddbb){_0x12ddbb=_0x214ec6[_0x588d('0x1db','DVv5')][_0x588d('0x2cc','a8h9')](_0x12ddbb),_0x214ec6[_0x588d('0x112','HL^5')][_0x588d('0x2cd','vn7w')](_0x3a84c0,_0x12ddbb['value']);},'__cargo_web_snippet_b06dde4acf09433b5190a4b001259fe5d4abcbc2':function(_0x39b81d,_0x48f817){var _0x436b74={'mKddn':function _0x4648b3(_0x2f0d40,_0x2c5d15){return _0x2f0d40===_0x2c5d15;},'FqwSD':_0x588d('0x2ce','s^Y3'),'kORkw':'BQP'};if(_0x436b74[_0x588d('0x2cf','s^Y3')](_0x436b74[_0x588d('0x2d0','a8h9')],_0x436b74['kORkw'])){var _0x25e6a3=firstCall?function(){if(fn){var _0x5b8d9c=fn['apply'](context,arguments);fn=null;return _0x5b8d9c;}}:function(){};firstCall=![];return _0x25e6a3;}else{_0x48f817=_0x214ec6[_0x588d('0x11d','d)Qa')]['to_js'](_0x48f817),_0x214ec6[_0x588d('0x173','Ys$F')]['from_js'](_0x39b81d,_0x48f817['success']);}},'__cargo_web_snippet_b33a39de4ca954888e26fe9caa277138e808eeba':function(_0x57fe95,_0xdee03d){_0xdee03d=_0x214ec6[_0x588d('0x27a','ogFX')]['to_js'](_0xdee03d),_0x214ec6[_0x588d('0x1f7','1PuD')][_0x588d('0x2d1','7$sW')](_0x57fe95,_0xdee03d['length']);},'__cargo_web_snippet_cdf2859151791ce4cad80688b200564fb08a8613':function(_0x2803e3,_0x1cba50){var _0x26be2b={'ChoFK':function _0x105ea3(_0x592768,_0x4bc0a8){return _0x592768!==_0x4bc0a8;},'CtEtt':function _0x41a462(_0x149430,_0x3fb097){return _0x149430+_0x3fb097;},'ZmiQg':_0x588d('0x2d2','FpG7')};if(_0x26be2b[_0x588d('0x2d3','ZRX(')](_0x588d('0x2d4','Ys$F'),'Ues')){_0x1cba50=_0x214ec6[_0x588d('0x27a','ogFX')][_0x588d('0x2ac','PsIj')](_0x1cba50),_0x214ec6[_0x588d('0x166','IxOn')][_0x588d('0x2d5','F(7k')](_0x2803e3,function(){var _0x53d57c={'rrEmL':function _0x3466d7(_0x3395f0,_0x1f5819){return _0x3395f0!==_0x1f5819;},'dhQMv':_0x588d('0x2d6','POb6'),'Dnxyt':_0x588d('0x2d7','Kt7h')};if(_0x53d57c[_0x588d('0x2d8','%qzk')](_0x53d57c[_0x588d('0x2d9','SHT!')],_0x53d57c[_0x588d('0x2da','Ys$F')])){try{return{'value':_0x1cba50['href'],'success':!0x0};}catch(_0x547a60){return{'error':_0x547a60,'success':!0x1};}}else{_0x1cba50=_0x214ec6[_0x588d('0x274','%EVN')][_0x588d('0x2db','FpG7')](_0x1cba50),_0x214ec6[_0x588d('0x1f7','1PuD')][_0x588d('0x1dc','Ruon')](_0x2803e3,_0x1cba50[_0x588d('0x2dc','DVv5')]);}}());}else{w[_0x202611](_0x26be2b[_0x588d('0x2dd','$oxr')]('删除',_0x26be2b[_0x588d('0x2de','d$^4')]));}},'__cargo_web_snippet_e8ef87c41ded1c10f8de3c70dea31a053e19747c':function(_0x463149,_0x2bce44){var _0x2ad153={'lGqhd':function _0x5ae107(_0x2f0f60,_0x5008f7){return _0x212c92[_0x588d('0x2df','%EVN')](_0x2f0f60,_0x5008f7);},'aUQrf':_0x212c92['aleHn']};_0x2bce44=_0x214ec6[_0x588d('0x2e0','ZRX(')][_0x588d('0x2e1','9^Oc')](_0x2bce44),_0x214ec6['STDWEB_PRIVATE'][_0x588d('0x2e2','MC#t')](_0x463149,function(){try{return{'value':_0x2bce44[_0x588d('0x2e3','dumr')],'success':!0x0};}catch(_0x4442db){if(_0x2ad153[_0x588d('0x2e4','eG4v')](_0x588d('0x2e5','eG4v'),_0x2ad153['aUQrf'])){w[_0x202611]('删除版本号，js会定期弹窗');}else{return{'error':_0x4442db,'success':!0x1};}}}());},'__cargo_web_snippet_e9638d6405ab65f78daf4a5af9c9de14ecf1e2ec':function(_0x54341b){var _0x1f4f57={'DVUGz':function _0x418ea0(_0x5b0312,_0x43eff9){return _0x5b0312===_0x43eff9;},'AwqIK':_0x588d('0x2e6','MC#t'),'QaVle':function _0x836f87(_0x111f48,_0x241cb6){return _0x111f48<_0x241cb6;},'yiyMG':function _0x319eab(_0x3aa66c,_0x1f3418){return _0x3aa66c&_0x1f3418;},'nrkCk':function _0x459589(_0x98b571,_0x7fc30f){return _0x98b571|_0x7fc30f;},'xkglK':function _0x1df175(_0x5d6998,_0x8e7b2a){return _0x5d6998<<_0x8e7b2a;},'SGSRZ':function _0x1e365d(_0xbb99fe,_0x30a7b8){return _0xbb99fe&_0x30a7b8;},'fsZrQ':function _0x4c2ba4(_0x2c37f3,_0x45f882){return _0x2c37f3<<_0x45f882;},'tINcY':function _0x159fa2(_0x3ec2d2,_0x19329b){return _0x3ec2d2|_0x19329b;},'cRFIz':function _0x982838(_0x561886,_0x4058c1){return _0x561886<<_0x4058c1;},'butjp':function _0x163d5a(_0x173421,_0x546a25){return _0x173421|_0x546a25;},'jXYXg':function _0xd0139c(_0x32ab72,_0x4525f5){return _0x32ab72|_0x4525f5;},'UqLoB':function _0x210c33(_0x25b337,_0x18dc6a){return _0x25b337&_0x18dc6a;},'tVQkH':function _0x283d39(_0x1d1265,_0x27abe3){return _0x1d1265<<_0x27abe3;},'HQGlm':function _0x24b85d(_0xd8fcb,_0x262ead){return _0xd8fcb+_0x262ead;},'HueHu':function _0x12e9b9(_0x15d700,_0x2a709d){return _0x15d700>>_0x2a709d;},'YhHlr':function _0x106bc9(_0x5bb938,_0x21d99e){return _0x5bb938+_0x21d99e;},'SHPxc':function _0x27f146(_0x432a6f,_0x4b3902){return _0x432a6f&_0x4b3902;}};if(_0x1f4f57[_0x588d('0x2e7','dumr')](_0x1f4f57['AwqIK'],_0x1f4f57[_0x588d('0x2e8','em[f')])){_0x54341b=_0x214ec6[_0x588d('0x1f7','1PuD')][_0x588d('0x2e9','%mwA')](_0x54341b),_0x214ec6[_0x588d('0x5d','L)xe')][_0x588d('0x2ea','IxOn')](_0x54341b);}else{var _0x537c01=_0x25362d[_0x54341b++];if(_0x1f4f57['QaVle'](_0x537c01,0x80))_0x44e349+=String[_0x588d('0x2eb','em[f')](_0x537c01);else{var _0xa1c13b='0|3|2|4|1'[_0x588d('0x2ec','zXEp')]('|'),_0x18c89c=0x0;while(!![]){switch(_0xa1c13b[_0x18c89c++]){case'0':var _0x170117=_0x1f4f57[_0x588d('0x2ed','POb6')](0x1f,_0x537c01),_0x111fc4=0x0;continue;case'1':_0x44e349+=String[_0x588d('0x2ee','knD6')](_0x5a36ba);continue;case'2':var _0x5a36ba=_0x1f4f57[_0x588d('0x2ef','$oxr')](_0x1f4f57['xkglK'](_0x170117,0x6),_0x1f4f57[_0x588d('0x2f0','RVm(')](0x3f,_0x111fc4));continue;case'3':_0x54341b<_0x31b1ee&&(_0x111fc4=_0x25362d[_0x54341b++]);continue;case'4':if(_0x537c01>=0xe0){var _0x11b5d7=0x0;_0x1f4f57['QaVle'](_0x54341b,_0x31b1ee)&&(_0x11b5d7=_0x25362d[_0x54341b++]);var _0x279365=_0x1f4f57[_0x588d('0x2f1','vn7w')](_0x1f4f57[_0x588d('0x2f2','1PuD')](0x3f,_0x111fc4),0x6)|_0x1f4f57[_0x588d('0x2f3','8wN^')](0x3f,_0x11b5d7);if(_0x5a36ba=_0x1f4f57[_0x588d('0x2f4','lZNf')](_0x1f4f57[_0x588d('0x2f5','s^Y3')](_0x170117,0xc),_0x279365),_0x537c01>=0xf0){var _0xc598d1=0x0;_0x1f4f57[_0x588d('0x2f6','IxOn')](_0x54341b,_0x31b1ee)&&(_0xc598d1=_0x25362d[_0x54341b++]),_0x5a36ba=_0x1f4f57[_0x588d('0x2f7','PsIj')](_0x1f4f57[_0x588d('0x2f8','knD6')](_0x1f4f57[_0x588d('0x2f9','ZRX(')](_0x1f4f57[_0x588d('0x2fa','lZNf')](0x7,_0x170117),0x12),_0x1f4f57[_0x588d('0x2fb','Q6Wb')](_0x279365,0x6)),0x3f&_0xc598d1),_0x44e349+=String[_0x588d('0x2fc','O$bS')](_0x1f4f57['HQGlm'](0xd7c0,_0x1f4f57['HueHu'](_0x5a36ba,0xa))),_0x5a36ba=_0x1f4f57[_0x588d('0x2fd','DVv5')](0xdc00,_0x1f4f57[_0x588d('0x2fe','PsIj')](0x3ff,_0x5a36ba));}}continue;}break;}}}},'__cargo_web_snippet_ff5103e6cc179d13b4c7a785bdce2708fd559fc0':function(_0x25fcc1){_0x214ec6[_0x588d('0x14d','sx]V')][_0x588d('0x2ff','SHT!')]=_0x214ec6[_0x588d('0x1f7','1PuD')][_0x588d('0x300','O$bS')](_0x25fcc1);},'__web_on_grow':_0x4c55f0}},'initialize':function(_0x15a71b){console[_0x588d('0x301','ZRX(')](_0x643fc5[_0x588d('0x302','RVm(')]);return Object['defineProperty'](_0x214ec6,_0x643fc5[_0x588d('0x303','1PuD')],{'value':_0x15a71b}),Object[_0x588d('0x304','L)xe')](_0x214ec6,_0x588d('0x305','knD6'),{'value':_0x214ec6[_0x588d('0x306','RVm(')][_0x588d('0x307','mMj&')][_0x588d('0x308','7$sW')]}),Object['defineProperty'](_0x214ec6,_0x643fc5[_0x588d('0x309','8wN^')],{'value':_0x214ec6[_0x588d('0x30a','mMj&')]['exports'][_0x588d('0x30b','Kt7h')]}),Object['defineProperty'](_0x214ec6,_0x643fc5[_0x588d('0x30c','knD6')],{'value':_0x214ec6['instance'][_0x588d('0x30d','IxOn')]['__indirect_function_table']}),_0x214ec6['exports'][_0x588d('0x30e','EqH*')]=function(_0x2c9c81,_0x5b6a95){var _0x1f19fa={'lMwxv':function _0x1e343d(_0x1efe83,_0x227203){return _0x1efe83!==_0x227203;},'aJnan':_0x588d('0x30f','dumr'),'iUDlC':_0x588d('0x310','PsIj'),'ylORf':_0x588d('0x311','SHT!')};if(_0x1f19fa[_0x588d('0x312','EqH*')](_0x1f19fa[_0x588d('0x313','%EVN')],_0x1f19fa[_0x588d('0x314','eG4v')])){return _0x214ec6[_0x588d('0x196','s^Y3')][_0x588d('0x315','knD6')](_0x214ec6[_0x588d('0x316','knD6')][_0x588d('0x317','Kt7h')][_0x588d('0x318','ZQ2(')](_0x214ec6[_0x588d('0x319','Kt7h')]['prepare_any_arg'](_0x2c9c81),_0x214ec6[_0x588d('0x72','zXEp')][_0x588d('0x256','RVm(')](_0x5b6a95)));}else{var _0x5a2388=_0x1f19fa[_0x588d('0x31a','KxWc')][_0x588d('0x31b','ZRX(')]('|'),_0x4f4ed3=0x0;while(!![]){switch(_0x5a2388[_0x4f4ed3++]){case'0':_0x510296['info']=func;continue;case'1':_0x510296[_0x588d('0x31c','a8h9')]=func;continue;case'2':return _0x510296;case'3':var _0x510296={};continue;case'4':_0x510296[_0x588d('0x31d','HL^5')]=func;continue;case'5':_0x510296['error']=func;continue;case'6':_0x510296[_0x588d('0x31e','%mwA')]=func;continue;case'7':_0x510296[_0x588d('0x246','F(7k')]=func;continue;case'8':_0x510296[_0x588d('0x31f','ZQ2(')]=func;continue;}break;}}},_0x4c55f0(),BiliPushUtils[_0x588d('0x320','$oxr')]=function(_0x613ebe,_0x37ac6d){var _0x631b98={'FqLRb':_0x588d('0x321','Kt7h'),'ELUTp':function _0x1d07f2(_0x35a0a9,_0x554d33){return _0x35a0a9+_0x554d33;},'SimEi':function _0x315cff(_0x351630,_0x1c4d3a){return _0x351630/_0x1c4d3a;},'cvBhT':function _0x564734(_0x59c8e0,_0x4622a6){return _0x59c8e0/_0x4622a6;},'WeOSB':function _0xb0ba85(_0x424265,_0x15cd53){return _0x424265<_0x15cd53;},'XWKgL':function _0x2b221e(_0x31e27e,_0x26e4d5){return _0x31e27e+_0x26e4d5;},'bCHpo':function _0x24d99f(_0x54275f,_0x3b285b){return _0x54275f!==_0x3b285b;},'vXaxt':'vfA'};if(_0x631b98[_0x588d('0x322','ZRX(')]!==_0x631b98[_0x588d('0x323','DVv5')]){_0x25362d=_0x631b98['ELUTp'](_0x214ec6[_0x588d('0x1f7','1PuD')][_0x588d('0x324','QTob')],_0x214ec6[_0x588d('0x325','DVv5')][_0x631b98[_0x588d('0x326','DVv5')](_0x613ebe,0x4)]),_0x31b1ee=_0x214ec6[_0x588d('0x327','lZNf')][_0x631b98[_0x588d('0x328','knD6')](_0x613ebe+0x4,0x4)];for(var _0x1d0f9c=[],_0x59e801=0x0;_0x631b98['WeOSB'](_0x59e801,_0x31b1ee);++_0x59e801)_0x1d0f9c['push'](_0x214ec6['STDWEB_PRIVATE']['to_js'](_0x631b98['XWKgL'](_0x25362d,0x10*_0x59e801)));return _0x1d0f9c;}else{if(CONFIG[_0x588d('0x329','IxOn')]&&BiliPush[_0x588d('0x32a','POb6')]){if(_0x631b98[_0x588d('0x32b','eG4v')](_0x588d('0x32c','Ys$F'),_0x631b98[_0x588d('0x32d','zXEp')])){return _0x214ec6[_0x588d('0x32e','sx]V')][_0x588d('0x32f','%qzk')](_0x613ebe,_0x37ac6d);}else{_0x37ac6d=_0x214ec6['STDWEB_PRIVATE']['to_js'](_0x37ac6d),_0x214ec6['STDWEB_PRIVATE']['from_js'](_0x613ebe,_0x37ac6d[_0x588d('0x330','KxWc')]);}}return'';}},_0x214ec6[_0x588d('0x331','SHT!')];}};};},893:function(_0x1d0a63,_0x5368af,_0x25cca){var _0x4332d9={'tXAbB':function _0x1726b4(_0x445cc7,_0x53cf14){return _0x445cc7(_0x53cf14);}};_0x4332d9['tXAbB'](_0x25cca,0x1f4)('WeakMap');},894:function(_0x4c79a7,_0x31cbdf,_0x45cd7e){_0x45cd7e(0x1f5)('WeakMap');},895:function(_0xb05f29,_0x40f16e,_0x5b1210){var _0x4f0a97={'JpELN':function _0x175054(_0x1e9e3f,_0x5c3d79,_0x249baf){return _0x1e9e3f(_0x5c3d79,_0x249baf);},'mZcmf':function _0x56406c(_0x392d46,_0x1139a2){return _0x392d46(_0x1139a2);},'XpCtA':function _0x462701(_0x56ef97,_0x2a6e5c){return _0x56ef97(_0x2a6e5c);},'RNvHj':function _0x15d254(_0x49122f,_0x4e24bb){return _0x49122f(_0x4e24bb);},'iBuBN':function _0x7973b8(_0x30fec2,_0x51d4ea){return _0x30fec2(_0x51d4ea);},'krGHB':function _0x408463(_0x5f34b1,_0x1794e5){return _0x5f34b1(_0x1794e5);},'vGveV':function _0x3dca72(_0x339510,_0x234cd0){return _0x339510(_0x234cd0);},'TDrPc':function _0x1e4602(_0x1d5c0a,_0x55a36a){return _0x1d5c0a(_0x55a36a);}};'use strict';var _0x53d39a=_0x4f0a97[_0x588d('0x332','8wN^')](_0x5b1210,0xb7),_0x4b9a82=_0x4f0a97[_0x588d('0x333','O$bS')](_0x5b1210,0xb4)['getWeak'],_0x5efcf5=_0x4f0a97['XpCtA'](_0x5b1210,0x14),_0x28ad51=_0x4f0a97[_0x588d('0x334','7$sW')](_0x5b1210,0x1f),_0x11a0c5=_0x4f0a97['iBuBN'](_0x5b1210,0xb8),_0x4626e3=_0x4f0a97[_0x588d('0x335','8wN^')](_0x5b1210,0xb5),_0x1d97bb=_0x4f0a97['vGveV'](_0x5b1210,0x1dd),_0x168410=_0x4f0a97[_0x588d('0x336','dumr')](_0x5b1210,0x20),_0x1d4059=_0x4f0a97['TDrPc'](_0x5b1210,0x19b),_0x18c2bd=_0x4f0a97['TDrPc'](_0x1d97bb,0x5),_0x3f6eab=_0x4f0a97[_0x588d('0x337','sx]V')](_0x1d97bb,0x6),_0x2a11d1=0x0,_0x234f5e=function(_0x4d8829){return _0x4d8829['_l']||(_0x4d8829['_l']=new _0x40affc());},_0x40affc=function(){var _0x34fea8={'Vhmra':function _0x215aac(_0x3d3a3d,_0x5bfffd){return _0x3d3a3d!==_0x5bfffd;},'qHFML':_0x588d('0x338','KxWc')};if(_0x34fea8[_0x588d('0x339','$oxr')](_0x34fea8[_0x588d('0x33a','Ruon')],_0x34fea8[_0x588d('0x33b','sx]V')])){var _0x5277e2=fn[_0x588d('0x33c','sx]V')](context,arguments);fn=null;return _0x5277e2;}else{this['a']=[];}},_0x2600a5=function(_0x36723d,_0x3a45b9){return _0x4f0a97[_0x588d('0x33d','ogFX')](_0x18c2bd,_0x36723d['a'],function(_0x23bfe4){var _0x361185={'gJgiC':function _0x278698(_0x3f96a4,_0x2b23dd){return _0x3f96a4!==_0x2b23dd;},'nkJHR':'XRU','JjFQf':function _0x198a26(_0x1f4f0d,_0x45470d){return _0x1f4f0d===_0x45470d;}};if(_0x361185[_0x588d('0x33e','a8h9')](_0x361185[_0x588d('0x33f','d)Qa')],_0x361185[_0x588d('0x33f','d)Qa')])){return _0x23bfe4[_0x588d('0x340','HL^5')][_0x588d('0x341','vn7w')](_0x5b1210)[_0x588d('0x342','9^Oc')](null,_0x53d39a);}else{return _0x361185[_0x588d('0x343','SHT!')](_0x23bfe4[0x0],_0x3a45b9);}});};_0x40affc['prototype']={'get':function(_0x53cd1a){var _0x3a28b5={'UYlWQ':'Fck','ROTxy':'AhI','Syaxg':function _0x1cd714(_0x136a14,_0x506887,_0x4ac37a){return _0x136a14(_0x506887,_0x4ac37a);}};if(_0x3a28b5[_0x588d('0x344','dumr')]!==_0x3a28b5[_0x588d('0x345','ZRX(')]){var _0x40f16e=_0x3a28b5['Syaxg'](_0x2600a5,this,_0x53cd1a);if(_0x40f16e)return _0x40f16e[0x1];}else{var _0x1ddbff=_0x2600a5(this,_0x53cd1a);if(_0x1ddbff)return _0x1ddbff[0x1];}},'has':function(_0x1187b6){var _0x4975f3={'yevap':function _0x11d2b5(_0xd149ef,_0x186953){return _0xd149ef!==_0x186953;},'iQnqs':_0x588d('0x346','%EVN'),'leiNB':_0x588d('0x347','&IEA'),'nEBaD':function _0xf3d12f(_0x445b31,_0x578831,_0x50dc7a){return _0x445b31(_0x578831,_0x50dc7a);}};if(_0x4975f3[_0x588d('0x348','vn7w')](_0x4975f3[_0x588d('0x349','EqH*')],_0x4975f3[_0x588d('0x34a','8wN^')])){return!!_0x4975f3[_0x588d('0x34b','FpG7')](_0x2600a5,this,_0x1187b6);}else{debugger;}},'set':function(_0x1a3737,_0x4f417c){var _0x5b1210=_0x4f0a97[_0x588d('0x34c','eG4v')](_0x2600a5,this,_0x1a3737);_0x5b1210?_0x5b1210[0x1]=_0x4f417c:this['a']['push']([_0x1a3737,_0x4f417c]);},'delete':function(_0x53bfd6){var _0x40f16e=_0x4f0a97['JpELN'](_0x3f6eab,this['a'],function(_0x4f9e52){var _0x198118={'fCvno':'sPm','HUdjL':_0x588d('0x34d','ZQ2('),'OYapF':function _0x30f6e7(_0x2fb1fc,_0x49e32c){return _0x2fb1fc===_0x49e32c;}};if(_0x588d('0x34e','2bOM')!==_0x198118['fCvno']){var _0x6083df=_0x198118[_0x588d('0x34f','d)Qa')]['split']('|'),_0x20ec60=0x0;while(!![]){switch(_0x6083df[_0x20ec60++]){case'0':this[_0x588d('0x350','L)xe')]=rsp[_0x588d('0x351','d)Qa')][_0x588d('0x352','%mwA')];continue;case'1':++this[_0x588d('0x353','%qzk')];continue;case'2':this['secret_rule']=rsp['data']['secret_rule'];continue;case'3':this['time']=rsp[_0x588d('0x354','L)xe')][_0x588d('0x355','L)xe')];continue;case'4':this['ets']=rsp[_0x588d('0x356','zXEp')]['timestamp'];continue;}break;}}else{return _0x198118['OYapF'](_0x4f9e52[0x0],_0x53bfd6);}});return~_0x40f16e&&this['a'][_0x588d('0x357','9^Oc')](_0x40f16e,0x1),!!~_0x40f16e;}},_0xb05f29['exports']={'getConstructor':function(_0x2ab1d2,_0x5d8c87,_0x4c6f3e,_0x283905){var _0x48e56e={'LDckA':function _0x283470(_0x491cc8,_0x4e35b6){return _0x491cc8===_0x4e35b6;},'tsfBD':function _0x3ce483(_0x47792f,_0x1a899a){return _0x47792f<_0x1a899a;},'PvEgb':function _0x4b4daf(_0x3fc308,_0x5abb97){return _0x3fc308|_0x5abb97;},'agVaL':function _0x5c80a2(_0x33eb7a,_0x1f796c){return _0x33eb7a|_0x1f796c;},'KTDuR':function _0x1ea47e(_0x237208,_0x6adeed){return _0x237208<<_0x6adeed;},'uLAaY':function _0x5f17db(_0x4a6782,_0x2f7a52){return _0x4a6782<<_0x2f7a52;},'PUqwg':function _0x4c1bcb(_0x423842,_0x317de3){return _0x423842&_0x317de3;},'HLBEo':function _0x15effe(_0x3775d9,_0x2eeacd){return _0x3775d9+_0x2eeacd;},'WbQcS':function _0x408418(_0x40625b,_0x253e06){return _0x40625b>>_0x253e06;},'sXQxP':function _0x598ba9(_0x31fb82,_0x33b85b){return _0x31fb82(_0x33b85b);}};if(_0x48e56e['LDckA'](_0x588d('0x358','W3t%'),_0x588d('0x359','vn7w'))){var _0x3df96f=0x0;_0x48e56e[_0x588d('0x35a','KxWc')](_0x5d8c87,_0x4b9a82)&&(_0x3df96f=_0x53d39a[_0x5d8c87++]),_0x1ac9fb=_0x48e56e[_0x588d('0x35b','sx]V')](_0x48e56e['agVaL'](_0x48e56e['KTDuR'](0x7&_0x11a0c5,0x12),_0x48e56e[_0x588d('0x35c','W3t%')](_0x1d4059,0x6)),_0x48e56e[_0x588d('0x35d','Ruon')](0x3f,_0x3df96f)),_0x283905+=String[_0x588d('0x13a','PsIj')](_0x48e56e[_0x588d('0x35e','em[f')](0xd7c0,_0x48e56e[_0x588d('0x35f','zXEp')](_0x1ac9fb,0xa))),_0x1ac9fb=0xdc00+_0x48e56e[_0x588d('0x360','Q6Wb')](0x3ff,_0x1ac9fb);}else{var _0x1ac9fb=_0x48e56e[_0x588d('0x361','9^Oc')](_0x2ab1d2,function(_0x599646,_0x47594b){var _0x327ab4={'BztNK':function _0x2a3b7f(_0x331d43,_0x309943){return _0x331d43===_0x309943;},'AuhuD':'IVM','kiird':function _0x1acbd6(_0x74b201,_0x1ff64a,_0x3a093a,_0x45be39,_0x2b5d5e){return _0x74b201(_0x1ff64a,_0x3a093a,_0x45be39,_0x2b5d5e);}};if(_0x327ab4[_0x588d('0x362','%qzk')](_0x588d('0x363','9^Oc'),_0x327ab4[_0x588d('0x364','QTob')])){_0x283905[_0x588d('0x365','7$sW')](_0x5d8c87,_0x28ad51);}else{_0x11a0c5(_0x599646,_0x1ac9fb,_0x5d8c87,'_i'),_0x599646['_t']=_0x5d8c87,_0x599646['_i']=_0x2a11d1++,_0x599646['_l']=void 0x0,void 0x0!=_0x47594b&&_0x327ab4[_0x588d('0x366','HL^5')](_0x4626e3,_0x47594b,_0x4c6f3e,_0x599646[_0x283905],_0x599646);}});return _0x53d39a(_0x1ac9fb[_0x588d('0x367','SHT!')],{'delete':function(_0x54c004){var _0x32990b={'jeDaY':function _0x225b7b(_0x148a9f,_0x27fc66){return _0x148a9f(_0x27fc66);},'yfrXC':function _0x3775db(_0xe22964,_0x587ec4){return _0xe22964(_0x587ec4);},'hdbjP':function _0x1714a0(_0x4f0a12,_0x46324c,_0x44db62){return _0x4f0a12(_0x46324c,_0x44db62);},'zoqrZ':function _0xfac1d7(_0x455fdc,_0x2a02b5,_0x37c2b3){return _0x455fdc(_0x2a02b5,_0x37c2b3);}};if(!_0x32990b['jeDaY'](_0x28ad51,_0x54c004))return!0x1;var _0x4c6f3e=_0x32990b[_0x588d('0x368','RVm(')](_0x4b9a82,_0x54c004);return!0x0===_0x4c6f3e?_0x234f5e(_0x32990b['hdbjP'](_0x1d4059,this,_0x5d8c87))[_0x588d('0x369','vn7w')](_0x54c004):_0x4c6f3e&&_0x32990b[_0x588d('0x36a','&IEA')](_0x168410,_0x4c6f3e,this['_i'])&&delete _0x4c6f3e[this['_i']];},'has':function(_0x2c354c){var _0x7e0bc0={'JHkTv':function _0x2d99d0(_0x496521,_0xcb3a22){return _0x496521(_0xcb3a22);},'MzRSo':function _0x242075(_0xd1680c,_0x81c7a2){return _0xd1680c(_0x81c7a2);},'AWUTW':function _0x4394ce(_0x133d33,_0x26090d){return _0x133d33===_0x26090d;},'NVDcu':function _0x2615f1(_0x6e89e3,_0x7ec9f3){return _0x6e89e3(_0x7ec9f3);}};if(!_0x7e0bc0[_0x588d('0x36b','pI*K')](_0x28ad51,_0x2c354c))return!0x1;var _0x4c6f3e=_0x7e0bc0[_0x588d('0x36c','sx]V')](_0x4b9a82,_0x2c354c);return _0x7e0bc0['AWUTW'](!0x0,_0x4c6f3e)?_0x7e0bc0[_0x588d('0x36d','d$^4')](_0x234f5e,_0x1d4059(this,_0x5d8c87))['has'](_0x2c354c):_0x4c6f3e&&_0x168410(_0x4c6f3e,this['_i']);}}),_0x1ac9fb;}},'def':function(_0x3f498f,_0x251c95,_0x4e343c){var _0x13221b={'rqGKK':function _0x2e1687(_0x14247c,_0x2b1a15){return _0x14247c===_0x2b1a15;},'ethni':function _0x80fbd7(_0x24b168,_0x14de5b,_0x4ed56d){return _0x24b168(_0x14de5b,_0x4ed56d);},'GGHuY':function _0x4077ec(_0x4062fb,_0x4f715d){return _0x4062fb(_0x4f715d);}};if(_0x13221b[_0x588d('0x36e','d$^4')]('hSl','znG')){_0x4e343c=_0x3f498f['STDWEB_PRIVATE']['to_js'](_0x4e343c),_0x3f498f[_0x588d('0x36f','FpG7')][_0x588d('0x370','%mwA')](_0x251c95,_0x4e343c[_0x588d('0x371','SHT!')]);}else{var _0x37d23f=_0x13221b[_0x588d('0x372','Ys$F')](_0x4b9a82,_0x5efcf5(_0x251c95),!0x0);return!0x0===_0x37d23f?_0x13221b[_0x588d('0x373','1PuD')](_0x234f5e,_0x3f498f)[_0x588d('0x187','L)xe')](_0x251c95,_0x4e343c):_0x37d23f[_0x3f498f['_i']]=_0x4e343c,_0x3f498f;}},'ufstore':_0x234f5e};},896:function(_0x4d310c,_0x187628,_0x461528){var _0x49c722={'SpGMe':function _0x80c5c9(_0x3be3a6,_0x577e81){return _0x3be3a6(_0x577e81);},'nPMtL':_0x588d('0x374','knD6'),'chqDs':function _0x5c6ce0(_0x92a5fa,_0x2336d6){return _0x92a5fa===_0x2336d6;},'qKfCk':function _0x5bb6ca(_0x4d7f72,_0x1209ed){return _0x4d7f72(_0x1209ed);},'jjymA':function _0x4242ed(_0x3e304d,_0x8fea2c,_0x22d7a7){return _0x3e304d(_0x8fea2c,_0x22d7a7);},'hQCyh':_0x588d('0x375','2bOM'),'pLNpZ':function _0x113d29(_0x4bb8db,_0x1eb507){return _0x4bb8db(_0x1eb507);},'hlBiv':function _0xefb591(_0x22415d,_0x23ea3a){return _0x22415d(_0x23ea3a);},'NzhAN':function _0x325fe5(_0x1bf647,_0x38337c){return _0x1bf647(_0x38337c);},'UxQAU':function _0x30f83e(_0x5bbbb5,_0x40a685){return _0x5bbbb5(_0x40a685);},'vWaoe':function _0x50b17d(_0x57990e,_0x4f9aaa){return _0x57990e in _0x4f9aaa;},'URXfv':_0x588d('0x376','s^Y3'),'BqGmB':function _0x5c7c66(_0x5f2022,_0x5a3dac){return _0x5f2022(_0x5a3dac);},'rCZuv':function _0x50e5c0(_0x12d6a9,_0x3f698a){return _0x12d6a9&&_0x3f698a;},'VMdLA':'delete','wccxB':_0x588d('0x377','7$sW')};'use strict';var _0x3ea158,_0x59372e=_0x49c722[_0x588d('0x378','s^Y3')](_0x461528,0xa),_0x3c96db=_0x49c722[_0x588d('0x379','Q6Wb')](_0x461528,0x1dd)(0x0),_0x10de12=_0x49c722['hlBiv'](_0x461528,0x82),_0xb1de1d=_0x49c722[_0x588d('0x37a','pI*K')](_0x461528,0xb4),_0x45250d=_0x49c722[_0x588d('0x37b','a8h9')](_0x461528,0xb9),_0x333eb8=_0x49c722['UxQAU'](_0x461528,0x37f),_0x2b12f9=_0x461528(0x1f),_0x19f9fd=_0x461528(0x19b),_0x323ad1=_0x49c722[_0x588d('0x37c','MC#t')](_0x461528,0x19b),_0x348102=!_0x59372e[_0x588d('0x37d','PsIj')]&&_0x49c722[_0x588d('0x37e','DVv5')](_0x49c722['URXfv'],_0x59372e),_0x342d66=_0xb1de1d[_0x588d('0x37f','%qzk')],_0x21772c=Object[_0x588d('0x380','dumr')],_0x11ebde=_0x333eb8[_0x588d('0x381','Ys$F')],_0x57060a=function(_0x2ef050){var _0x38d9c9={'Xbibq':function _0x173441(_0x471857,_0x24c236){return _0x471857===_0x24c236;}};if(_0x38d9c9[_0x588d('0x382','ArhG')](_0x588d('0x383','d)Qa'),_0x588d('0x384','s^Y3'))){return function(){var _0x236dc8={'IQxIO':function _0x448b2e(_0x51c934,_0x5549ab,_0x5c1741){return _0x51c934(_0x5549ab,_0x5c1741);},'oqmRE':function _0x5f39dc(_0x4358b1,_0x4c9d7d){return _0x4358b1>_0x4c9d7d;}};return _0x236dc8[_0x588d('0x385','1PuD')](_0x2ef050,this,_0x236dc8['oqmRE'](arguments[_0x588d('0x23d','IxOn')],0x0)?arguments[0x0]:void 0x0);};}else{_0x2ef050[_0x588d('0x196','s^Y3')][_0x588d('0x386','ogFX')](_0x187628,window);}},_0x2b5029={'get':function(_0x51dd81){if(_0x49c722[_0x588d('0x387','9^Oc')](_0x2b12f9,_0x51dd81)){if(_0x588d('0x388','Q6Wb')===_0x49c722['nPMtL']){}else{var _0x187628=_0x49c722['SpGMe'](_0x342d66,_0x51dd81);return _0x49c722[_0x588d('0x389','EqH*')](!0x0,_0x187628)?_0x49c722[_0x588d('0x38a','k2cp')](_0x11ebde,_0x49c722[_0x588d('0x38b','F(7k')](_0x19f9fd,this,_0x49c722[_0x588d('0x38c','lZNf')]))[_0x588d('0x38d','mMj&')](_0x51dd81):_0x187628?_0x187628[this['_i']]:void 0x0;}}},'set':function(_0x1aca3a,_0x408d69){return _0x333eb8['def'](_0x19f9fd(this,_0x49c722[_0x588d('0x38e','Q6Wb')]),_0x1aca3a,_0x408d69);}},_0x141487=_0x4d310c['exports']=_0x49c722[_0x588d('0x38f','ArhG')](_0x461528,0x1f6)(_0x49c722[_0x588d('0x390','ZRX(')],_0x57060a,_0x2b5029,_0x333eb8,!0x0,!0x0);_0x49c722['rCZuv'](_0x323ad1,_0x348102)&&(_0x45250d((_0x3ea158=_0x333eb8['getConstructor'](_0x57060a,_0x49c722[_0x588d('0x391','IxOn')]))[_0x588d('0x392','pI*K')],_0x2b5029),_0xb1de1d['NEED']=!0x0,_0x3c96db([_0x49c722[_0x588d('0x393','zXEp')],'has',_0x49c722['wccxB'],_0x588d('0x394','$oxr')],function(_0x3f289c){var _0xdc5c51={'lXgDQ':function _0x1e4203(_0x4e27b1,_0x266c22){return _0x4e27b1===_0x266c22;},'uqvdS':_0x588d('0x395','RVm('),'QZczE':function _0xfa5b73(_0x38a25c,_0x4e73e9,_0xd8f957,_0x4d334d){return _0x38a25c(_0x4e73e9,_0xd8f957,_0x4d334d);},'Tuacc':function _0x32d7cc(_0x33ba1e,_0x28d9eb){return _0x33ba1e===_0x28d9eb;},'dodOM':function _0x3b2d54(_0x409ab6,_0x1ff2e5){return _0x409ab6 in _0x1ff2e5;}};if(_0xdc5c51[_0x588d('0x396','%EVN')](_0xdc5c51[_0x588d('0x397','POb6')],_0xdc5c51['uqvdS'])){var _0x187628=_0x141487['prototype'],_0x461528=_0x187628[_0x3f289c];_0xdc5c51['QZczE'](_0x10de12,_0x187628,_0x3f289c,function(_0x19544e,_0x22e252){var _0x3cdf64={'zSWSk':function _0x3c81d2(_0x4f6be5,_0x4178bd){return _0x4f6be5===_0x4178bd;},'TRGsn':_0x588d('0x398','ogFX'),'djCrK':function _0xb6dfaf(_0x118368,_0xc8cb09){return _0x118368(_0xc8cb09);},'pYOjt':function _0x50d404(_0x30cfd9,_0x3288a5){return _0x30cfd9(_0x3288a5);},'GhHAd':_0x588d('0x399','Ruon')};if(_0x3cdf64[_0x588d('0x39a','pI*K')]('JuU',_0x3cdf64[_0x588d('0x39b','HL^5')])){if(_0x3cdf64[_0x588d('0x39c','ZRX(')](_0x2b12f9,_0x19544e)&&!_0x3cdf64[_0x588d('0x39d','k2cp')](_0x21772c,_0x19544e)){this['_f']||(this['_f']=new _0x3ea158());var _0x3a9085=this['_f'][_0x3f289c](_0x19544e,_0x22e252);return _0x3cdf64[_0x588d('0x39e','Ruon')]==_0x3f289c?this:_0x3a9085;}return _0x461528[_0x588d('0x39f','eG4v')](this,_0x19544e,_0x22e252);}else{}});}else{if(void 0x0===_0x187628||_0xdc5c51['Tuacc'](null,_0x187628))return 0x0;var _0x2a6a19=_0x3f289c[_0x588d('0x173','Ys$F')][_0x588d('0x3a0','Q6Wb')],_0x3412fa=_0x3f289c[_0x588d('0x9c','O$bS')][_0x588d('0x3a1','dumr')],_0x2fc781=_0x3f289c[_0x588d('0x2e0','ZRX(')][_0x588d('0x3a2','zXEp')],_0x2b5e41=_0x3f289c[_0x588d('0x16b','ArhG')]['ref_to_id_map_fallback'],_0x19bf89=_0x2fc781[_0x588d('0x3a3','QTob')](_0x187628);if(void 0x0===_0x19bf89&&(_0x19bf89=_0x2b5e41[_0x588d('0x3a4','HL^5')](_0x187628)),_0xdc5c51[_0x588d('0x3a5','d)Qa')](void 0x0,_0x19bf89)){_0x19bf89=_0x3f289c[_0x588d('0x1db','DVv5')][_0x588d('0x3a6','ZRX(')]++;try{_0x2fc781[_0x588d('0x3a7','&IEA')](_0x187628,_0x19bf89);}catch(_0x4b9b46){_0x2b5e41['set'](_0x187628,_0x19bf89);}}return _0xdc5c51[_0x588d('0x3a8','W3t%')](_0x19bf89,_0x3412fa)?_0x2a6a19[_0x19bf89]++:(_0x3412fa[_0x19bf89]=_0x187628,_0x2a6a19[_0x19bf89]=0x1),_0x19bf89;}}));},897:function(_0x4b338f,_0x271e2f,_0x428ccd){var _0x2f69af={'IRhoD':function _0x36aaee(_0x3451a0,_0x34c1ab){return _0x3451a0(_0x34c1ab);},'mqvqm':function _0x1c97a4(_0x296172,_0x164c87){return _0x296172(_0x164c87);},'jVXUB':function _0x19dbbb(_0x298fa0,_0x24ffaa){return _0x298fa0(_0x24ffaa);}};_0x2f69af['IRhoD'](_0x428ccd,0x80),_0x428ccd(0x57),_0x428ccd(0x380),_0x2f69af['mqvqm'](_0x428ccd,0x37e),_0x2f69af[_0x588d('0x3a9','W3t%')](_0x428ccd,0x37d),_0x4b338f[_0x588d('0x3aa','EqH*')]=_0x2f69af[_0x588d('0x3ab','O$bS')](_0x428ccd,0x7)['WeakMap'];},898:function(_0xfcc0,_0x3886f3,_0x58138d){var _0x188fb6={'PZhYK':function _0x415f78(_0xaca923,_0x2abcaa){return _0xaca923(_0x2abcaa);}};_0xfcc0[_0x588d('0x3ac','pI*K')]={'default':_0x188fb6[_0x588d('0x3ad','ZQ2(')](_0x58138d,0x381),'__esModule':!0x0};}}]);;(function(_0x5bb36a,_0x220f9d,_0x28f1e5){var _0x7fc0a7=function(){var _0x855b0=!![];return function(_0x2c8d0d,_0x24926f){var _0x416891=_0x855b0?function(){if(_0x24926f){var _0x2a8bb6=_0x24926f['apply'](_0x2c8d0d,arguments);_0x24926f=null;return _0x2a8bb6;}}:function(){};_0x855b0=![];return _0x416891;};}();var _0x5a6cb6=_0x7fc0a7(this,function(){var _0x584b5b=function(){return'\x64\x65\x76';},_0x5de24d=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x1302a5=function(){var _0x229ce7=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x229ce7['\x74\x65\x73\x74'](_0x584b5b['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x3de804=function(){var _0x57c593=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x57c593['\x74\x65\x73\x74'](_0x5de24d['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0xda532a=function(_0x5c53de){var _0x244939=~-0x1>>0x1+0xff%0x0;if(_0x5c53de['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x244939)){_0x5c4499(_0x5c53de);}};var _0x5c4499=function(_0x1daacc){var _0x30f795=~-0x4>>0x1+0xff%0x0;if(_0x1daacc['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x30f795){_0xda532a(_0x1daacc);}};if(!_0x1302a5()){if(!_0x3de804()){_0xda532a('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0xda532a('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0xda532a('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x5a6cb6();var _0x1fda6d={'QvcRd':_0x588d('0x3ae','$oxr'),'OMZdN':_0x588d('0x3af','F(7k'),'EHwZT':function _0x33d02f(_0x361f61,_0xefa1a0){return _0x361f61(_0xefa1a0);},'CGIUI':'init','iHarP':_0x588d('0x3b0','MC#t'),'HLodM':function _0x42b829(_0x3ce8e8,_0x4a3c7e){return _0x3ce8e8+_0x4a3c7e;},'kliks':_0x588d('0x3b1','QTob'),'qIpnW':function _0x6c4ccb(_0x88e655,_0x266ea6){return _0x88e655===_0x266ea6;},'NsAli':_0x588d('0x3b2','F(7k'),'giUBh':_0x588d('0x3b3','EqH*'),'MbjKc':function _0x92ff0c(_0x1d8dc6,_0x2f226c){return _0x1d8dc6!=_0x2f226c;},'KCRMz':'gEt','XjLZx':function _0x4a19c8(_0x1b3ded){return _0x1b3ded();},'bEnvN':function _0x3dbe04(_0x5026c7,_0x366b19){return _0x5026c7 instanceof _0x366b19;},'KLqUm':function _0x1fdf5a(_0x1d30c8,_0xa635f4,_0x36225a){return _0x1d30c8(_0xa635f4,_0x36225a);},'DIMoE':function _0x3cb3c6(_0x158550){return _0x158550();},'erJzj':_0x588d('0x3b4','ZQ2('),'JSwPo':function _0x508d66(_0x5106e4,_0x102c9e){return _0x5106e4!==_0x102c9e;},'VmDhl':'undefined','GYNJU':function _0x46f780(_0x1b4c53,_0x381b6e){return _0x1b4c53===_0x381b6e;},'zeyFR':'sojson.v5','XHntQ':function _0x2ba380(_0x514478,_0x2be30e){return _0x514478+_0x2be30e;},'WqeVA':_0x588d('0x3b5','EqH*'),'SzKlY':_0x588d('0x3b6','Ys$F')};var _0x4ede82=function(){var _0x4c58ad=!![];return function(_0x4efbf1,_0x20dfb0){var _0x1cc46c=_0x4c58ad?function(){var _0x2e6178={'IAAOx':function _0x2cae0a(_0x59aaa6,_0x4cf272){return _0x59aaa6(_0x4cf272);},'OItVT':function _0x43600f(_0x16def0,_0x42f617){return _0x16def0===_0x42f617;},'cgELV':function _0x1da46d(_0x23ffb4,_0x158088){return _0x23ffb4!==_0x158088;},'moWEB':'dOP','qGFsL':_0x588d('0x3b7','knD6'),'rQGSn':function _0x5e3d5c(_0x5f2f9f,_0x201cdd,_0x1d8739){return _0x5f2f9f(_0x201cdd,_0x1d8739);}};if(_0x588d('0x3b8','ArhG')===_0x588d('0x3b9','$oxr')){if(!_0x2e6178[_0x588d('0x3ba','KxWc')](o,e))return!0x1;var _0x5aa9fd=_(e);return _0x2e6178[_0x588d('0x3bb','$oxr')](!0x0,_0x5aa9fd)?_0x2e6178[_0x588d('0x3bc','RVm(')](P,f(this,r))[_0x588d('0x3bd','2bOM')](e):_0x5aa9fd&&u(_0x5aa9fd,this['_i']);}else{if(_0x20dfb0){if(_0x2e6178[_0x588d('0x3be','ZRX(')](_0x2e6178[_0x588d('0x3bf','mMj&')],_0x2e6178[_0x588d('0x3c0','%EVN')])){var _0x2e868c=_0x20dfb0[_0x588d('0x3c1','mMj&')](_0x4efbf1,arguments);_0x20dfb0=null;return _0x2e868c;}else{_0x2e6178[_0x588d('0x3c2','pI*K')](_0x4ede82,this,function(){var atazMx={'iNNPn':_0x588d('0x3ae','$oxr'),'muVzQ':_0x588d('0x3c3','&IEA'),'HlGXP':function _0x225f68(_0x2a31b2,_0x1cdeb9){return _0x2a31b2(_0x1cdeb9);},'ylezR':'init','BRlMJ':'chain','mJskh':_0x588d('0x3c4','PsIj'),'LpcUs':function _0x2bcdab(_0x41d715,_0xbfa007){return _0x41d715(_0xbfa007);},'Uhlia':function _0x264b3d(_0x2bd2a4){return _0x2bd2a4();}};var _0x1236aa=new RegExp(atazMx['iNNPn']);var _0x50da11=new RegExp(atazMx[_0x588d('0x3c5','HL^5')],'i');var _0x50b798=atazMx[_0x588d('0x3c6','QTob')](_0x139cd1,atazMx[_0x588d('0x3c7','Q6Wb')]);if(!_0x1236aa['test'](_0x50b798+atazMx[_0x588d('0x3c8','POb6')])||!_0x50da11[_0x588d('0x3c9','em[f')](_0x50b798+atazMx['mJskh'])){atazMx[_0x588d('0x3ca','%mwA')](_0x50b798,'0');}else{atazMx['Uhlia'](_0x139cd1);}})();}}}}:function(){};_0x4c58ad=![];return _0x1cc46c;};}();(function(){_0x4ede82(this,function(){var _0x4a625a=new RegExp(_0x1fda6d['QvcRd']);var _0x189b02=new RegExp(_0x1fda6d[_0x588d('0x3cb','HL^5')],'i');var _0x35f4d4=_0x1fda6d[_0x588d('0x3cc','pI*K')](_0x139cd1,_0x1fda6d[_0x588d('0x3cd','QTob')]);if(!_0x4a625a[_0x588d('0x3ce','%mwA')](_0x35f4d4+_0x1fda6d[_0x588d('0x3cf','O$bS')])||!_0x189b02[_0x588d('0x3d0','IxOn')](_0x1fda6d['HLodM'](_0x35f4d4,_0x1fda6d[_0x588d('0x3d1','d$^4')]))){if(_0x1fda6d[_0x588d('0x3d2','s^Y3')](_0x1fda6d[_0x588d('0x3d3','%qzk')],_0x1fda6d[_0x588d('0x3d4','lZNf')])){_0x28f1e5(e,i,r,'_i'),e['_t']=r,e['_i']=A++,e['_l']=void 0x0,_0x1fda6d['MbjKc'](void 0x0,n)&&E(n,t,e[a],e);}else{_0x35f4d4('0');}}else{if(_0x1fda6d[_0x588d('0x3d5','QTob')](_0x1fda6d[_0x588d('0x3d6','lZNf')],_0x1fda6d['KCRMz'])){_0x1fda6d[_0x588d('0x3d7','9^Oc')](_0x139cd1);}else{return _0x1fda6d['bEnvN'](e[_0x588d('0xe3','8wN^')][_0x588d('0x3d8','&IEA')](r),Array)|0x0;}}})();}());var _0x5b5fbb=function(){var _0x222ba5={'qEVkH':function _0x170add(_0x1873df,_0x3a8c50){return _0x1873df===_0x3a8c50;},'OqFeD':_0x588d('0x3d9','RVm(')};if(_0x222ba5[_0x588d('0x3da','EqH*')]('qME',_0x222ba5[_0x588d('0x3db','8wN^')])){var _0x4ed62d=!![];return function(_0x25915a,_0x48d599){var _0x5482b6={'QPdjZ':function _0x5b85ce(_0x7bfd2d,_0x2d791c){return _0x7bfd2d!==_0x2d791c;},'EPGfH':function _0xd0a601(_0x203524){return _0x203524();},'CKQAw':function _0x4cce4a(_0x39de62,_0x245a36){return _0x39de62===_0x245a36;},'yELjc':_0x588d('0x3dc','ArhG')};var _0x391542=_0x4ed62d?function(){if(_0x48d599){if(_0x5482b6['QPdjZ'](_0x588d('0x3dd','Ys$F'),_0x588d('0x3de','em[f'))){var _0x4125e2=function(){while(!![]){}};return _0x5482b6[_0x588d('0x3df','Ruon')](_0x4125e2);}else{var _0x59669c=_0x48d599[_0x588d('0x1ff','MC#t')](_0x25915a,arguments);_0x48d599=null;return _0x59669c;}}}:function(){if(_0x5482b6[_0x588d('0x3e0','IxOn')](_0x588d('0x3e1','DVv5'),_0x5482b6[_0x588d('0x3e2','ZQ2(')])){that[_0x588d('0x3e3','Ys$F')]=function(_0xbe9ee4){var _0x4431ba={'lQKDg':_0x588d('0x3e4','2bOM')};var _0xf29fc8=_0x4431ba[_0x588d('0x3e5','PsIj')]['split']('|'),_0x58c3f4=0x0;while(!![]){switch(_0xf29fc8[_0x58c3f4++]){case'0':_0x2ac650[_0x588d('0x3e6','HL^5')]=_0xbe9ee4;continue;case'1':return _0x2ac650;case'2':_0x2ac650[_0x588d('0x3e7','lZNf')]=_0xbe9ee4;continue;case'3':_0x2ac650[_0x588d('0x3e8','EqH*')]=_0xbe9ee4;continue;case'4':_0x2ac650[_0x588d('0x3e9','zXEp')]=_0xbe9ee4;continue;case'5':_0x2ac650['error']=_0xbe9ee4;continue;case'6':_0x2ac650['log']=_0xbe9ee4;continue;case'7':_0x2ac650[_0x588d('0x3ea','DVv5')]=_0xbe9ee4;continue;case'8':var _0x2ac650={};continue;}break;}}(func);}else{}};_0x4ed62d=![];return _0x391542;};}else{return{'error':e,'success':!0x1};}}();var _0x392ded=_0x1fda6d[_0x588d('0x3eb','HL^5')](_0x5b5fbb,this,function(){var _0x527386={'FRqul':function _0x5b938b(_0x5d141a,_0x3ebaa2){return _0x5d141a===_0x3ebaa2;},'SJetR':'Hdz','KNVQM':function _0x50ab4f(_0x157c15,_0xd393c7){return _0x157c15!==_0xd393c7;},'MxPeX':'undefined','HwPvr':'object','bAFiH':_0x588d('0x3ec','F(7k')};if(_0x527386[_0x588d('0x3ed','KxWc')](_0x527386[_0x588d('0x3ee','IxOn')],_0x527386[_0x588d('0x3ef','%qzk')])){var _0x4e40c7=function(){var _0x1114cc={'cMqNJ':function _0x53a80a(_0x4d3c23,_0x14a74c){return _0x4d3c23!==_0x14a74c;},'Xzonh':'oes'};if(_0x1114cc['cMqNJ'](_0x1114cc['Xzonh'],_0x1114cc[_0x588d('0x3f0','s^Y3')])){return{'error':e,'success':!0x1};}else{}};var _0x561513=_0x527386[_0x588d('0x3f1','POb6')](typeof window,_0x527386['MxPeX'])?window:_0x527386['FRqul'](typeof process,_0x527386[_0x588d('0x3f2','O$bS')])&&typeof require===_0x588d('0x3f3','vn7w')&&_0x527386[_0x588d('0x3f4','DVv5')](typeof global,_0x527386[_0x588d('0x3f5','F(7k')])?global:this;if(!_0x561513[_0x588d('0x3f6','%qzk')]){_0x561513['console']=function(_0x56e580){var _0x1e729a={'JZHpw':function _0x4ca346(_0x26fdb3,_0x5d7dd9){return _0x26fdb3!==_0x5d7dd9;},'xpqKo':function _0x4df022(_0x18ebbf,_0x70348a){return _0x18ebbf===_0x70348a;},'AyNCb':function _0x4bb6f6(_0x259814,_0xa0f24e){return _0x259814(_0xa0f24e);},'ejrAJ':function _0x13d715(_0x32e1a5,_0x4c00e4,_0x42be4f){return _0x32e1a5(_0x4c00e4,_0x42be4f);}};if(_0x1e729a[_0x588d('0x3f7','a8h9')](_0x588d('0x3f8','DVv5'),'gQr')){if(!o(e))return!0x1;var _0x27dd25=_(e);return _0x1e729a[_0x588d('0x3f9','lZNf')](!0x0,_0x27dd25)?_0x1e729a[_0x588d('0x3fa','1PuD')](P,_0x1e729a['ejrAJ'](f,this,r))['delete'](e):_0x27dd25&&_0x1e729a[_0x588d('0x3fb',']olF')](u,_0x27dd25,this['_i'])&&delete _0x27dd25[this['_i']];}else{var _0x28f1e5={};_0x28f1e5[_0x588d('0x3fc','ogFX')]=_0x56e580;_0x28f1e5[_0x588d('0x3fd','ZRX(')]=_0x56e580;_0x28f1e5[_0x588d('0x3fe','knD6')]=_0x56e580;_0x28f1e5[_0x588d('0x3ff','Ys$F')]=_0x56e580;_0x28f1e5['error']=_0x56e580;_0x28f1e5['exception']=_0x56e580;_0x28f1e5[_0x588d('0x400','RVm(')]=_0x56e580;return _0x28f1e5;}}(_0x4e40c7);}else{var _0x3e329a=_0x588d('0x401','a8h9')['split']('|'),_0x437deb=0x0;while(!![]){switch(_0x3e329a[_0x437deb++]){case'0':_0x561513['console'][_0x588d('0x402','d$^4')]=_0x4e40c7;continue;case'1':_0x561513['console'][_0x588d('0x403','%mwA')]=_0x4e40c7;continue;case'2':_0x561513[_0x588d('0x404','knD6')]['trace']=_0x4e40c7;continue;case'3':_0x561513['console']['error']=_0x4e40c7;continue;case'4':_0x561513[_0x588d('0x405','eG4v')][_0x588d('0x406','%mwA')]=_0x4e40c7;continue;case'5':_0x561513['console']['debug']=_0x4e40c7;continue;case'6':_0x561513[_0x588d('0x407','L)xe')][_0x588d('0x408','O$bS')]=_0x4e40c7;continue;}break;}}}else{t(0x1f4)(_0x527386['bAFiH']);}});_0x1fda6d['DIMoE'](_0x392ded);_0x28f1e5='al';try{_0x28f1e5+=_0x1fda6d['erJzj'];_0x220f9d=encode_version;if(!(_0x1fda6d[_0x588d('0x409','IxOn')](typeof _0x220f9d,_0x1fda6d[_0x588d('0x40a','em[f')])&&_0x1fda6d['GYNJU'](_0x220f9d,_0x1fda6d['zeyFR']))){_0x5bb36a[_0x28f1e5](_0x1fda6d['XHntQ']('删除',_0x1fda6d[_0x588d('0x40b','QTob')]));}}catch(_0x57192f){_0x5bb36a[_0x28f1e5](_0x1fda6d[_0x588d('0x40c','F(7k')]);}}(window));function _0x139cd1(_0x3c4163){var _0x313194={'ddYMV':function _0x2564a0(_0x2624b9,_0x49e83d){return _0x2624b9===_0x49e83d;},'lQuJa':_0x588d('0x40d','8wN^'),'cTqfT':_0x588d('0x40e','s^Y3'),'QkoKM':function _0x4563f4(_0x14836c,_0xcc1a6a){return _0x14836c(_0xcc1a6a);},'paeYQ':function _0x232d45(_0x33ee8b,_0x4cf274){return _0x33ee8b+_0x4cf274;},'IyOin':function _0x382489(_0x282893,_0x291848){return _0x282893/_0x291848;},'AoRGP':function _0x1bf11e(_0x17067a,_0x307b64){return _0x17067a!==_0x307b64;},'uozGY':_0x588d('0x40f','F(7k'),'nPaEY':function _0x3a58ff(_0x49bf5a,_0x20076a){return _0x49bf5a(_0x20076a);},'XpAOy':function _0x3a9c65(_0x206ee7,_0x3be808){return _0x206ee7===_0x3be808;}};function _0x164922(_0x5a8a05){var _0x31aeea={'vFfvZ':function _0x3de918(_0x13e7ac,_0x28686f){return _0x13e7ac===_0x28686f;},'SAGWz':_0x588d('0x410','ogFX'),'DdhuM':_0x588d('0x411','d)Qa'),'TsVlA':'ENw','sjSjv':function _0x12de4b(_0x16457f,_0x50469a){return _0x16457f/_0x50469a;},'fuFiG':function _0x52f07a(_0x1d809c,_0x4b46d4){return _0x1d809c===_0x4b46d4;},'OHsDZ':function _0x51108a(_0x228c2b,_0x2cb80a){return _0x228c2b%_0x2cb80a;},'yzTNH':function _0x219548(_0x294587,_0x466a8c){return _0x294587===_0x466a8c;},'XuWuf':_0x588d('0x412','MC#t'),'vEhsd':function _0x1b1465(_0x2db0df,_0x3adbfd){return _0x2db0df(_0x3adbfd);}};if(_0x31aeea[_0x588d('0x413','d$^4')](_0x588d('0x414','SHT!'),_0x31aeea['SAGWz'])){if(_0x31aeea[_0x588d('0x415','F(7k')](typeof _0x5a8a05,_0x31aeea[_0x588d('0x416','ZRX(')])){if(_0x31aeea[_0x588d('0x417','1PuD')]===_0x31aeea[_0x588d('0x418','&IEA')]){var _0xbf1fdc=function(){var _0x3e2d46={'PQcud':function _0x18f87b(_0x56ddc3,_0x381ffa){return _0x56ddc3===_0x381ffa;},'JPlts':_0x588d('0x419','&IEA')};while(!![]){if(_0x3e2d46['PQcud'](_0x588d('0x41a','mMj&'),_0x3e2d46['JPlts'])){}else{t=e[_0x588d('0xfa','9^Oc')][_0x588d('0x41b','dumr')](t),e[_0x588d('0x28d','SHT!')]['from_js'](r,t[_0x588d('0x41c','%qzk')]);}}};return _0xbf1fdc();}else{t=e[_0x588d('0x193',']olF')][_0x588d('0x41d','Q6Wb')](t),e[_0x588d('0x41e','&IEA')][_0x588d('0x41f','1PuD')](r,function(){try{return{'value':t[_0x588d('0x420','ZRX(')],'success':!0x0};}catch(_0x15f331){return{'error':_0x15f331,'success':!0x1};}}());}}else{if((''+_0x31aeea[_0x588d('0x421','HL^5')](_0x5a8a05,_0x5a8a05))[_0x588d('0x422','ArhG')]!==0x1||_0x31aeea[_0x588d('0x423','a8h9')](_0x31aeea['OHsDZ'](_0x5a8a05,0x14),0x0)){if(_0x31aeea['yzTNH'](_0x31aeea['XuWuf'],_0x588d('0x424','L)xe'))){debugger;}else{var _0x28143c=firstCall?function(){if(fn){var _0x5f0eb2=fn[_0x588d('0xfe','L)xe')](context,arguments);fn=null;return _0x5f0eb2;}}:function(){};firstCall=![];return _0x28143c;}}else{debugger;}}_0x31aeea[_0x588d('0x425','ogFX')](_0x164922,++_0x5a8a05);}else{return e[_0x588d('0x426','L)xe')][_0x588d('0x427','zXEp')](r,t);}}try{if(_0x313194['ddYMV'](_0x588d('0x428','ZRX('),_0x313194[_0x588d('0x429','lZNf')])){t=e[_0x588d('0x42a','W3t%')][_0x588d('0x42b','MC#t')](t),e['STDWEB_PRIVATE']['from_js'](r,function(){try{return{'value':t[_0x588d('0x42c','ogFX')],'success':!0x0};}catch(_0x569ffa){return{'error':_0x569ffa,'success':!0x1};}}());}else{if(_0x3c4163){return _0x164922;}else{if(_0x313194[_0x588d('0x42d','DVv5')](_0x313194[_0x588d('0x42e','Ys$F')],_0x313194['cTqfT'])){_0x313194[_0x588d('0x42f','Ruon')](_0x164922,0x0);}else{var _0x50745a=e['STDWEB_PRIVATE'][_0x588d('0x430','2bOM')](t);e[_0x588d('0x431','eG4v')][_0x313194[_0x588d('0x432','d)Qa')](r,0xc)]=0x9,e[_0x588d('0x433','d)Qa')][_0x313194['IyOin'](r,0x4)]=_0x50745a;}}}}catch(_0x2e3cc0){if(_0x313194[_0x588d('0x434','mMj&')]('Dcr',_0x313194[_0x588d('0x435','SHT!')])){if(_0x313194[_0x588d('0x436','9^Oc')](u,e)){var _0x4bbfd2=A(e);return _0x313194[_0x588d('0x437','EqH*')](!0x0,_0x4bbfd2)?_0x313194['nPaEY'](l,f(this,_0x588d('0x438','O$bS')))[_0x588d('0x439','KxWc')](e):_0x4bbfd2?_0x4bbfd2[this['_i']]:void 0x0;}}else{}}};encode_version = 'sojson.v5';
        $(document).ready(() => {
            Init().then(Run);
        });
    }
})();
