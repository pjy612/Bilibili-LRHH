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

;var encode_version = 'sojson.v5', onkin = '__0x90347',  __0x90347=['wo8nEgTCjQ==','FkHCmBVFw6vCsg==','HghqOQ==','wrlKdsK2w4t+woA=','w7cZFx7CmsOcwpDDjX/Cr2rDpVhb','HMO/wqzDrRQ=','L8OxJsKiXj0Ow5Y4w4IsSsKCGsOUQzjCqwfDlg==','LsOyJA==','woTDvcKNwo7CsEPDlRUmw5fCrcOYwqjDmw==','L8OrdMOFw4Y=','wrbCu2gZwrLCpVdZwoDCh8KWaMKXw4g=','ecO0woXDm8KfbDYY','DQzDlMONw7I8Rw==','wpfDsk4fP8OmL8KQFcOtw5fCpQ==','MUBRwqZWwoXDnBgtTQMfw6PCqg==','wqs7w5wENcKoRsKow4LDig==','w7YzwosPw6Zud2bDiw==','wrPDoSNaw4vCiMOg','wrvDnUAeOMOL','w6A1wpglw7t9cFXDmg7Dtw==','wp4wPQHCjMKgXw==','Y3nCm8ODw6pUw4TCmzo6wp7CrxEnIg==','wrjDn1wKPMOLJ8KuGMOvw4HCmcOuw7XCnQ==','AcOtT8Oew5Y=','YsOMSGg=','R8OidGPDoA==','QhPCixUTwo9hS8Ol','VS8cIw9+BQ==','w5Z5DMK3w6ZD','R8O/wpfDhMKzYyU=','CcO0GsKoeg==','IMO9PV4dw7PCgA==','wrTCvV4pwrg=','wqPCm3Yiwr0=','wpnDvnbCs8KH','Q8OLD2/DoMO1w5s=','MMK5wobDgAQ=','w7DDkcKxF3s=','w55kJcKPfA==','wroPw68THw==','d8OlHGLDrg==','wpEzKwHCrQ==','BwfDsVbCuQ==','e8ORwofDoMKc','RQLDnxxT','BlMww7zDk8KO','woLDtMKMwp7CtA==','K0Zuw5ZD','w5slwpvDv1Q=','aMOwdWB1','wps0w5wPDQ==','HB88OMKt','wq3DtW82Mw==','RMOodk95','w5lUJ8KzdA==','IMOpw51vwrM=','RRnCiR4Cwok=','wrJSbMKIw5o=','HVnCgitU','GsOyKWYe','JsO7MFkY','RijDnQ==','CRTDllXCtQ==','ABkeJsKx','wrbCmnkSwoo=','MAHDhsONw60=','w6PCng0=','YB/CkRIAwolNYcOjw5BoVAo=','OynDoXLClkzCuw==','MsO+Jw==','bcOfHFLDgw==','ZzjDiTl3','Q1HCmsOcw50=','wpItNxTCgw==','Okobw6fDmA==','FsOXUMO4w4g=','LS/DtHDCrUjCk3DCgsK+HcKmKQ==','esOHW014','M0PCmzZ1','DEd6w557bFTCjGY+w7nCuQ==','UcOICEzDqsOmw5U=','OsKewqICwoE=','ZzINJzBrBg==','WxLChhYf','w5hlJcKQYBNp','EFssw7rDgsKfUw==','DsOSDsKOag==','F8OuUsOgw6w=','JVdYwrtXwpTDtRon','KEZYCBE=','wrXCu3o=','BMKEwpLDhQI=','XjvDgSdeajpEw5c=','dA7Ciw8i','GBDDosOQw4c=','XcOubsO7wpM=','csOEQ2o=','K8Kkwq/DiAA=','wpRzw4vDpXk=','KnF4w5ZC','RG7Cn8OYw4ZHw5E=','HD4w','AsKywoszwoAcwqsxMg==','CiMuM8KmLsOJw5QH','54ix5p2g5Y6z772MwqMz5L+95ay45pyt5b+T56uJ776q6L6M6K+o5paY5o2S5oiD5Lqb55mP5beZ5L6M','wqLDrj1Hw4A=','JHFxw4FW','K8OQcMKYVA==','wpVew7LDr34=','w5M/wp/Du10=','Y8OTQcOmwqE=','5YiO6Zit54um5p2/5Y+G77ySKUfkvqjlr7fmnI3lvIDnqKw=','SV7ClcObw44=','wpV8L3HCo8Kvw7/DoRzCmgvDmD9iw4zDrMKHwrpYw4ZVUFgxwoU=','CcO2bcKlTw==','Q8OuwoDDhsKU','Tx3CkxIRwo1hQcOz','BsKtwpLDhg4bw5PCl8OF','XCbDgT5udyc=','dMKowpPChMOqwp0w','wqxMeMKpw6BRwp1Rw7tP','wok1DD/CpQ==','w4RQI8Kew44=','w6PCngg=','wpDDucKZwoLCsFLDmgY7w4LCqcO1wrXDhg==','w6DCmgsVdMO/w4JEwoJcwrU9w6XDjA==','TR3Clg8pwph8Q8Ok','CsOnc8KpVcKgw5zCt8OYwrc5OUEJ','asOITU4=','WcOsw4PDu1UebcOYw4U=','BghgPHDDmcO4','P3DDglRq','wo4yCDnCsw==','wozDt8KM','5b+B5aWA5pSi6Zia5ouV6Zeowq8=','e+WxteW+geW9hQ==','w6oZCDwAwqd7w6vCoMOuEcO0fhw=','MsOowp1OH8KLSA==','wq1XdsK2w4t9wpc=','w5EQdsO/w4M=','Zn7Cl8OX','wqMlGyTCtTAQw6tB','wrfCsHoVwq4=','fBIvGjo=','w6thMMKa','w6kzwogiw6ZtcGvDmjzDrgBMwpdMw4jDgsOj','wrDCu2ATwrTCrWZZwoQ=','w4AsJyg=','UhnChgkTwphKRcOkw4M=','w5AkPizCrMOqwq7DsF0=','BR9sLXDDnsOUH31GVw==','wo8hDjc=','ABHDhcOQw7QYRhwkw5nCvcKy','w4oUwqDDlg==','DcK+wpbDgBs=','TsKMwqbCu8Of','wrLDv3XCrsKeWcKaPcK9w4I=','w41sFMKhw7dhwp3CgsOTWBoQ','GMK+wovDjAwJw5Q=','QcOuRUle','QcOcCVfDtw==','BFjDklRtNHzDnMKiw5XCk8ONEDM=','BR9+','wqTDtjxYw6bClcO3','RsObDVHDoQ==','wr1dd8K4w7x5wpJXw7U=','RD4BKQ==','w40Ywq7DgV8pwoBNbcKTUw==','w78twoQ=','wojDvcKKwpXCqg==','NkpTwqo=','wocvEQzCmw==','LXN/LTI=','A8K1woIz','dMO7woLDjg==','EsOjYMK+T8K2w6bCt8Oewo0xCFwIUxxGQQ==','wrTDvD1Ww5HCkcOyw4LDhg==','OmJnJQ==','A1bClAp/w7XCniLDgDY=','ZMO1woLDjsKS','wqzDn8Kiw7HDjsOUKQ==','wr7DvDJHw43CrMOhw5/DjsOUwpsJ','wqt8w5TDug==','5b+g5paA5bCP5b2V5b2k5pWc6Ziv5a6T5q2P','ccOTRQ==','wo40CQ==','LcORY8Orw4w=','w7XCiQsfaA==','w78KCDYc','YcOTwrXDhcKK','w5sAYcOkw5M6wptww7l3wrHCpg==','HD7Dr3rCvl7CuA==','w5jDlsK8G3PDu2g=','dsOAW0toaMOzwoXDvcOswrYq','fMOAS2dhU8O+woDDgsOx','NsOwMw==','5byk5aWl5ZGU5YqQ5bKK5b2X5b2z5b+B6LWu','woknIgPCl8Kw','DyPDpHw=','DMOxwofDpg==','wpwlGCbCoBQSw4dGw7vCosOZ','ZsOATXZsb8O5wqPDgsOqwqsu','LnZgLA==','VcKiwp/CnMOHwp0gAMKzwqN/w7zDpA==','Lkw+w7/DlcKIVEsVV8Kzwq/DvRok','dSbDjDlUfTcUw6EUf1vDlMO0Rg==','wr/DiFslMMOYLsKdFsOi','AMK5wo0JwoAHwqAx','w4sJwqvCngI=','UcOAH13Do8O9w55nw7k=','dcOiwobDgMKMdiY=','wr4Lw4wGJg==','RRnCgxoDwoBh','AMOxRcKgUA==','HWJbAAE=','w43DncKgAVA=','dg8VIwc=','NsOjwotWBg==','wpLDpHMNDg==','w4PCnwMDTg==','dcOjwoXDlsK4','RcOjZMOCwq4=','NBbDjkjCgw==','wrfDnyFgw7E=','eMOvwr/DmsKN','wpoyAQLCig==','QAbCqRcC','HWUTw4/DoQ==','w5jDvsKBIFo=','wrgqHBvChg==','wrgOw5MKMQ==','Kz8qLMKG','wpdGw6DDr2Q=','KnBaHjQ=','F21bwpVy','wqLDqhpvw4s=','w6ANSMO/w4U=','wrPDsMKjwo7CvA==','HE0vw6HDkcKFQw4=','IcKdwqcwwrc=','bzk6w6LCjQ==','w4ksPg4rwpF7w5rCgMOCJsOqQz0=','HMO/wqzDshMEZg==','wpdQw7jDj3rCkA==','wo04CSjCmw==','BMO1wp3DoBMK','LsOhGUwW','ehwbLgw=','w54wLwA7','C8O4wpLDtSQNOsOBwrAM','w5QGGAXCug==','w6gbDBoZ','YsO5woDDrMKJ','wqXDnSRTw5c=','wrrCkFc7wpU=','w6ozMRUL','w6kYwrAbw5s=','OAo2DsKO','w6c4MRPCmg==','wqs6OQzCtQ==','ZcOoCXbDgg==','wqLClUU8wrk=','JkFdw7xK','GQLDh17Cqw==','W8O/Q2PDlQ==','woPDg0XChMKp','w4BwAsKKeQ==','w6NXFsKTeQ==','wocXKD7ClQ==','wrDDgsKBw73DvA==','w58yUsO+w7M=','XDggIyo=','Am8Xw6DDpw==','dMOqYFTDpw==','dDnCjCsP','OVrDpHRH','woPDrmEMCQ==','w5ZGDMKVw5M=','VcKTwrjCvsOwwrYLKcKkwphbw5LDghY=','woUvFSY=','J23DpGZGAnzDrcKCw7nCpMOTLRI=','GCPDn3PCqA==','FCEWA8Ka','wonDjlXCjMK/JA==','w6XDpWIFw4XDiMOvwonDkcKJwpRMw7rDksKxwrzDugESDcO3Bg==','w7ImwoU5w6Y=','PsO3wqpsEw==','ASHDklrCiA==','McOKRsKbdg==','W07Cv8Ojw54VwpM=','w7sgQcOGw7JZw5s=','cyIDGRY=','S8OjanHDpcO2w7s=','w63DncK6PVE=','O1bDslVb','O8Oqc8KpWsKww7rDtsOOwqA3FlgIRUphQ31teMKtW8Oew4/CpsOWAsKBw7tZdMOGw7tVwr3DiMO2','w6UhISzCvsO6wrbCvU7Ch1DDiGl6w5nDv8OFw6YOw4gDXBwow5fCmsOUw7HDp1AeF0jDlMOtLMK1fsKywrXCpcK4wqgKw5cDwpTDlcO8','EghgLw==','wppHw6rDikg=','WMOXR8O6woY=','w4MJSsO/w4Y=','w5wWNywaw7NCw7/CvMOoBMOCeBbCicKlwqgCw44aPx1kwqzCrl7Co8Oww4rCmjRSA1DCrsOeUUfCg8OQJTDCn8KVVsK4woPCv8OUOA==','O8OEwrfDkCIgAcO0wqMxCTY9wrU=','w5IJbMO5w4Q=','w5ICwq0Hw5dNSlrDvCrDkS9swrc=','wogtPwfCn8K4RULCplYawoPCg8O6CQ==','CsOqU8Odw6XCihTCmAvDksOJRMOLPg==','E8OhMlYxw77CnA==','JcOzwpE=','w5xUAMKsaDBGwonDkMOqw6zChzXDtw==','Z2bCjg==','w7vDsMKXL1PDikTDoyvClwURwqrChg==','ZMO3woY=','XsO0OnbDjg==','HsO0bsK8','Z8OURFE=','w6AxRMOBw6IowrZPw4hbwpTClMOnNg==','wrtBd8K4w7V4wp8=','JncYw4LDtcKpfzsUasKXwofDhzg=','IMOVwrLDlzJRbA==','JAnDgUnCjh7DuQ==','CQPDosOUw6c=','ccKXwqXCr8Ok','Y0XCrsOVw6Y=','YMO+TMODwrI7w4w=','Tz7DqCVW','AH3Cpx53','IMKJwqXDvzxJwpU=','LmZKCAQ=','wrHDhUTCusKH','wosGHQjCkw==','wrd+VsKBw4U=','A8KzwrA8wpUqwrYgJA7Cm0I=','QF/CusOkw45kw77ClAkdwrHCsSQQ','GMOWwr94DQ==','EVDChg1zw7PCpBbDjzzCoytwWGTCnsKnO8OsXw==','aTnCpCtFw54=','w7c7NQs6','wrrCt1cUwo0=','WMOfwrfDv8KrMWc=','fcO9QG1H','wrwKw4k2DQ==','wrgmw5MAFg==','w5gJWMOew6A=','w6wIEhnCisKm','w4AQYsO3w5UYwohm','wrMNDD7Dhg==','w5vDkcKxGWTDunrDig==','ZgzDrwNkL3U=','BQ9tPmfDmMOqFA==','IMKJwqXDv1hM','wog9Lw/CjMKmTUE=','HWB2wp8Lw5I=','YH7CnMOSw7lUw4DCvQ==','G8Ofwrl/BsOUGA==','V8ObGVnDt8Omw5F7','wrTDhMKUw7bDug==','w60pwonDpH8fwoBvSsK2YETDjzs=','wrXCu3ovwq7CoXB0wpnClsKfb8KG','wp7DtzFiw6M=','wojDrcKiwpLCrQ==','wpvDuX0tGMO7HcKhK8OIw67Ch8Obw4I=','MsODQMKcbsOnwrE=','wqPDgWEyGg==','NMOWVsOHw6M=','B8OtL10=','I2fCsy9fw4PCnhnDtwbCqhhBew==','Mm1XMAQ=','w5YIwoTDhkk=','w6wIEhnCisKtw70=','HWB2wp9tw5PCvg==','wplGw73Dtk0=','wr/Cl2gBwo4=','ZcOKcGx+U8Ohwp3Dg8Oswqs5','w4w4GjzCrA==','QA0+FDE=','DSDDrHbCuA==','wpDDoEXCv8Kp','O8OzOMKoWg==','V8Kswq3CisO2','wpd9WMKLw4Es','PHzDoWFWcxE=','GHVmAzc=','wonDmlLCncKs','w4dFBcKreEEr','Mk/DlXZy','MFN9wpdr','NmB7w7FKS2XCr10Vw4PCncOtwqM=','AUwDw6DDhMKNGDQ1V8Kzwq/DvRo=','e8OvScOEwqJKwqHDhMOBNHYjKV0=','w4I/PCTCgMO0wrw=','wpAxIQfCig==','OyDDoMO1w4UKayMVw7XCmMKANQk=','w60zwoc3w6Zn','CcKgwojDgAo=','PcOhw4V2wpIJ','acO3FnPDvA==','woPDqilhw64=','ZgzDrwNkLXE=','wpJMw5TDlFY=','QsOcFFXDmsO+w4M=','wpJhdMKQw60=','P8OGNsKTbg==','w7RhHsK3w5M=','w64XGzzCnQ==','I1Ifw6XDuw==','w7YCHQDCqQ==','dcOGEFzDlQ==','woLDvCtBw7zCksOww5/DicOUwpo=','DVdXEwN4bSrDpMO0w6TChgfDrw==','w4l5AsKEw6I=','HGJPwp1p','w4PCrz0nX8OJw4J1wqJwwoIjw5jDrQ==','HWB2wp9tw5g=','wqxww40=','w5I9Owk7w6AW','YMOAwqTDt8Ky','wpd9WMKLw4Enw4E=','c8KzwprDkcOqwpgxFw==','wo8nEhvCisKyFA==','w7EMwrsIw54=','w6wfwo8hw4A=','woQWw4QVOMKDWcKqw4I=','wrHCv2Ic','PWYdw4XDpcOT','woHCikonwpnCglh7wr3CvsKlW8K3w7Q=','G8OOP8KxSQ==','w5LDvsKSNl0=','Yz0kw47CpA==','MsODQMKcbsOs','wrI8w4Q3Gw==','wpTDqMKMw4LCmMKV','wohLWMKvw4I=','IDHDpcOyw5Vw','Fyx7MmI=','bMOrOmjDg8KiwoQ=','w6AiOxcl','w5jCvjggT8Kz','wrwhw6oxAsOP','wp/Dj8KZw5DDrw==','MQkFEMKceA==','Yh7CsTky','wonDvm0AFg==','w5I9Owk7w6s=','KxbDsMOgw4Q=','wrgUPgHChDUmw51nw53CmsOow4hW','wq7DiMKqw7vDmMOTP8KTwrfCqH7DrsK2FsKzKGfCmQ==','w5hzBcKPew==','woXDjRdiw7zCvsOMw6DDv8O4wr47w5LCoA==','TyrDnyZYbCZrw4AYYU3DpMOqfsK5e8KPwqvCqFpQ','S8OjanHDpcO9','wr7Ch0AnwoY=','wqjDncKqwrfDrRQ=','Fw4OLsKD','wprDonczKw==','PCBHKlc=','KcOuScKlWQ==','csOfOEjDjg==','VsOQwrHDl8Ka','HVbDkElP','RybDnit9','YT8HKC0=','PMO1wovDsyMHPcOLwpUdLQ==','w5rCoTEFWA==','wrPDjMKvwrDCm2TDmjcbw67CnsOrwojDpw==','wrtdesK0w7Bx','w61MNMKDw5YJ','wpXDsDJfw4M=','wqElMDfCqw==','w6w+wqgdw5E=','wp06IgPCvcK8TUrCgGYfwpQ=','w6JoM8K8w5Y=','CcO6wqTDlAM=','BsK1wo3Dvjg=','dDjCtDIg','wrTDqQFiw74=','ADnDgsO4w7M=','ZsO5woDDlsKK','w5gTKAEv','w4twHMKCw5I=','XsOYe8OqwpM=','HMO0bsKheMK8w6LCpMOpwr08Aw==','wrcNw4oLLQ==','wpHCv0Y0wps=','d8OXQGtOZMOzwpvDssOqwqE7','wqHDiWYOMsOmMMKUH8Oiw5fCs8Ohw7PCpcObPcOg','B0Y6w4rDhMKEfwIifMKswqfDow==','wpLDvcKNwrjCqknDmg4tw7jCpcOLwqzDvUbCtcOpw5fDnADDnFE=','w6NhN8KPcgB8wr/Dq8OH','JsOww4BxwoJzUwbCimAtw5vDqsK+','NcOfZMO+w7/CuirCvwbDrcO+acOqHsOIGMOn','w4RqBMKmw6pDworCssOCSBoXe8KCAsKdwpdDwrDCoQTCvw==','wqjDlMKnwqTCuA==','In1Sw6pH','PxjDhE7Cnm/ClG/CssKdLsKECcKj','Hx5QK3rDtcO5CG5JXXwSw7guw6/Cklk=','cijCoSwzwq5KfsOTw7Nbdiop','HEcDw6HDn8K0Ug4gfMKswqfDow==','VsOLHWfDscO7w69rw7l7XWsx','LGZ1GzJVbRPDksOiw5/CpiPDtcOVw4jCisOwBRXChBY=','w6kdDg==','w58ewrzDhlMvwrpgcsKMaXfDvhgkw4XClAbDlWA=','Q8OOwrLDuMK7QAotwo3Dq8KGworDnMKY','Tx4dw7LCjcOXw58pHShMw68Y','O8KYwqDDuCw4w7jCqMOlXzVIaU0=','wonDvMK0wpPCsXnDtwIvw4TCp8OfwrLDln/CucOkw4s=','PsO6N8K1XDkYw4wpw68BXcKFDsOkQDfCsw==','d8O6P2/DgMOWw69Sw49tZksVKg==','wo/DucKJw4XDrsOlBcKxwrrCk0nDmMK9JQ==','AcO0wqzDswg9LMOFwoYnKRYFwoVAwqsYB0o=','wpLDn1DCi8KvXsKrGcKKw7kHb8KnwoE=','JsO0wopKJ8KLX8KhKsK8wrzCqRpBwqxOw53DqiN3','wrZcRsKvw7tLwoFEw6liw6/CpMKUw7xnVhApRQ==','wrXDicKSw6bDhMO4KMKAwp/ChWnDuMKFFcK3G3/CncK/','Z8O/wpTDsMKTYzkRwrDDgQ==','EEDDjlJiLE8=','A1zDgm53IUHDkcK1','SSzDmg==','wqPDrTUNw6bCkMO2w54=','w7EOUsOOw6Y=','eTDDpz9r','NkIUw5HDtw==','S8OTbMOhwqRnwprDscOSCQ==','wrXCt2QVwrU=','w4QKwonDn1E=','wrfDtT9aw5o=','OHF8KRlQQQ==','HMO9woM=','wqLDtCM=','wp0Kw5gVNsKZQ8K/','TcODfcO8wpV8wo0=','fm7Ck8Ocw7lf','w61MNMKDwrs=','wp7DnBJlwojDig==','wpd9WMKLwqcm','wrMNDD7Cq8Os','w4kTwqgAw4c+Iw==','w61MNMKDw5YCw50=','wonDjlXCjMKsL8OG','P8OdHWUWwqTDhA==','OmZ1LShfYgjDmcONw5fCtSfDkw==','XMOOXG9h','Hz4rLcKWKsKU','SMOBGFnDscO9w59s','woxBw73DiGrDqsOPw45qw4lmw4rDuxI=','IMKSwqkiwok=','w4nDh8KiDX/Dun7DrBPCrQwiwpvCpUthbTHDvzc=','RDgzJg4=','w64kwoA3w7th','DgbDi8OPw58iRw==','WDgfOA==','w5zDi8KMEmU=','w5UXb8O7w7gAwpo=','YMOowpnDm8KRYToR','wqgcCTnCu8KWc2jCkUAtwrDCpcOe','wqTDuWbCs8KY','w5FmKsK5w7A=','wpIWw4QMCMKdUw==','Fks1w7nDlMKlTw8jUA==','JS5LCFDDqMOUPVpjZEgow4k=','ZcOUREzDr8Kvwro=','wqfDuXvCscK1dsKH','w5wSwqnDig==','woxsXcKMw5FWwqx1w4x0w4/ChMKsw4w=','w5QawqbDsmI=','w7ZdMcKEw4ZzwrDCvcOidD8icMK1','ccO5wofDmsKXcDAiwrXDkcKPwrnDrcK7Hm3DgsOmwo0Q','BMO9Llwxw77CmcO8fcOLGMOWwoTDnwE=','LcORSMOgw5M=','wrjDjE0SM8OYL8KU','BnFzwph9wqLDkzoQdDAsw4PClg==','wp06IgPCocK+Xw==','ZWrCksOGw64=','w7tvG8KRXg==','w47DlsK8FUnDomg=','YwMoGzhIKcKLwr8Bw4g8wqg/','LsOwC8KtSg==','fR3DqgR0XBxkw6AkRHjDr8Od','wobDqsKEworCgUzDtg==','SMOLFV/DscO8'];(function(_0xfaddd4,_0x561207){var _0x18f1b7=function(_0x5090ac){while(--_0x5090ac){_0xfaddd4['push'](_0xfaddd4['shift']());}};_0x18f1b7(++_0x561207);}(__0x90347,0x70));var _0x577e=function(_0x207fb8,_0x4abc99){_0x207fb8=_0x207fb8-0x0;var _0x53e476=__0x90347[_0x207fb8];if(_0x577e['initialized']===undefined){(function(){var _0x4bbe54=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x1204a9='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x4bbe54['atob']||(_0x4bbe54['atob']=function(_0x4af5d6){var _0xdc3640=String(_0x4af5d6)['replace'](/=+$/,'');for(var _0x120162=0x0,_0x2b51b3,_0x17ea70,_0x472040=0x0,_0x1dfa7a='';_0x17ea70=_0xdc3640['charAt'](_0x472040++);~_0x17ea70&&(_0x2b51b3=_0x120162%0x4?_0x2b51b3*0x40+_0x17ea70:_0x17ea70,_0x120162++%0x4)?_0x1dfa7a+=String['fromCharCode'](0xff&_0x2b51b3>>(-0x2*_0x120162&0x6)):0x0){_0x17ea70=_0x1204a9['indexOf'](_0x17ea70);}return _0x1dfa7a;});}());var _0x558bc2=function(_0x14bd5d,_0x37c01d){var _0x4f68bc=[],_0x57197a=0x0,_0x5439b8,_0x120810='',_0x5e10ef='';_0x14bd5d=atob(_0x14bd5d);for(var _0x38be0b=0x0,_0x2f09ba=_0x14bd5d['length'];_0x38be0b<_0x2f09ba;_0x38be0b++){_0x5e10ef+='%'+('00'+_0x14bd5d['charCodeAt'](_0x38be0b)['toString'](0x10))['slice'](-0x2);}_0x14bd5d=decodeURIComponent(_0x5e10ef);for(var _0x332490=0x0;_0x332490<0x100;_0x332490++){_0x4f68bc[_0x332490]=_0x332490;}for(_0x332490=0x0;_0x332490<0x100;_0x332490++){_0x57197a=(_0x57197a+_0x4f68bc[_0x332490]+_0x37c01d['charCodeAt'](_0x332490%_0x37c01d['length']))%0x100;_0x5439b8=_0x4f68bc[_0x332490];_0x4f68bc[_0x332490]=_0x4f68bc[_0x57197a];_0x4f68bc[_0x57197a]=_0x5439b8;}_0x332490=0x0;_0x57197a=0x0;for(var _0x1574c5=0x0;_0x1574c5<_0x14bd5d['length'];_0x1574c5++){_0x332490=(_0x332490+0x1)%0x100;_0x57197a=(_0x57197a+_0x4f68bc[_0x332490])%0x100;_0x5439b8=_0x4f68bc[_0x332490];_0x4f68bc[_0x332490]=_0x4f68bc[_0x57197a];_0x4f68bc[_0x57197a]=_0x5439b8;_0x120810+=String['fromCharCode'](_0x14bd5d['charCodeAt'](_0x1574c5)^_0x4f68bc[(_0x4f68bc[_0x332490]+_0x4f68bc[_0x57197a])%0x100]);}return _0x120810;};_0x577e['rc4']=_0x558bc2;_0x577e['data']={};_0x577e['initialized']=!![];}var _0x34211b=_0x577e['data'][_0x207fb8];if(_0x34211b===undefined){if(_0x577e['once']===undefined){_0x577e['once']=!![];}_0x53e476=_0x577e['rc4'](_0x53e476,_0x4abc99);_0x577e['data'][_0x207fb8]=_0x53e476;}else{_0x53e476=_0x34211b;}return _0x53e476;};const UUID=()=>'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'['replace'](/[xy]/g,function(_0x3b53ce){var _0x28dc10={'bBSNH':function _0xa93481(_0x208734,_0xef0a3c){return _0x208734|_0xef0a3c;},'LniXl':function _0xbb7ef2(_0x334872,_0x311346){return _0x334872*_0x311346;},'ZUkhE':function _0x27fa89(_0x199bce,_0x5dc418){return _0x199bce===_0x5dc418;}};var _0x24f0b8=_0x28dc10['bBSNH'](_0x28dc10['LniXl'](0x10,Math['random']()),0x0);return(_0x28dc10[_0x577e('0x0','&UNs')]('x',_0x3b53ce)?_0x24f0b8:_0x28dc10['bBSNH'](0x3&_0x24f0b8,0x8))['toString'](0x10);});class HeartGiftRoom{constructor(_0x1b451c){var _0x5db758={'Stvij':function _0x12f0dc(_0x34f2da){return _0x34f2da();},'aYVMM':function _0x27bf01(_0x444523,_0x4df63c){return _0x444523(_0x4df63c);},'edCcq':'LIVE_BUVID'};var _0x4e29f2=_0x577e('0x1','D*h1')[_0x577e('0x2','Owm^')]('|'),_0x584f7e=0x0;while(!![]){switch(_0x4e29f2[_0x584f7e++]){case'0':this['uuid']=_0x5db758[_0x577e('0x3','^I8]')](UUID);continue;case'1':;continue;case'2':this['ua']=window&&window[_0x577e('0x4','NU&@')]?window[_0x577e('0x5','&XW^')]['userAgent']:'';continue;case'3':this[_0x577e('0x6','sCFV')]=_0x1b451c[_0x577e('0x7','jHjV')];continue;case'4':this[_0x577e('0x8','zXvY')]();continue;case'5':this[_0x577e('0x9','TvR&')]=_0x5db758[_0x577e('0xa','Dj]B')](getCookie,_0x5db758['edCcq']);continue;case'6':this['error']=0x0;continue;case'7':this[_0x577e('0xb','zxP3')]=0x0;continue;case'8':this[_0x577e('0xc','4r89')]=_0x1b451c[_0x577e('0xd','zxP3')];continue;case'9':this[_0x577e('0xe','NU&@')]=new Date();continue;case'10':this['area_id']=_0x1b451c[_0x577e('0xf','Owm^')];continue;case'11':this[_0x577e('0x10','dY4$')]=_0x1b451c;continue;}break;}}async['startEnter'](){var _0x280ccb={'KIbei':function _0x16cb29(_0x54edc9,_0x20ab9b){return _0x54edc9>_0x20ab9b;},'WRmvg':function _0x1fbc56(_0xe2aefe,_0xa65a76){return _0xe2aefe==_0xa65a76;},'LECVG':_0x577e('0x11','VEMc'),'iQptP':function _0x5b3b29(_0x81115e,_0x4d47a9){return _0x81115e*_0x4d47a9;},'HKZRj':function _0x3e7dd6(_0x2a5e0b,_0x5bb766,_0x451f6d){return _0x2a5e0b(_0x5bb766,_0x451f6d);}};try{if(!HeartGift[_0x577e('0x12','eFdV')]||_0x280ccb[_0x577e('0x13','*%Q&')](this[_0x577e('0x14','TvR&')],0x3))return;if(BiliPushUtils['sign']){console[_0x577e('0x15','4r89')](_0x577e('0x16','qs!D')+this['room_id']+_0x577e('0x17','A6wZ'));let _0x20d18f={'id':[this[_0x577e('0x18','9!x6')],this[_0x577e('0x19','3][z')],this['seq'],this[_0x577e('0x1a','zXvY')]],'device':[this[_0x577e('0x1b','Pro%')],this[_0x577e('0x1c','&UNs')]],'ts':new Date()['getTime'](),'is_patch':0x0,'heart_beat':[],'ua':this['ua']};KeySign['convert'](_0x20d18f);let _0x32b329=await BiliPushUtils['API'][_0x577e('0x1d','TvR&')][_0x577e('0x1e','@)9V')](_0x20d18f);if(_0x280ccb['WRmvg'](_0x32b329['code'],0x0)){var _0xc66108=_0x280ccb[_0x577e('0x1f','vZe4')]['split']('|'),_0x39939c=0x0;while(!![]){switch(_0xc66108[_0x39939c++]){case'0':this['time']=_0x32b329[_0x577e('0x20','*5Rb')][_0x577e('0x21','g10M')];continue;case'1':++this['seq'];continue;case'2':this[_0x577e('0x22','@)9V')]=_0x32b329[_0x577e('0x23','D*h1')][_0x577e('0x24','NU&@')];continue;case'3':this['ets']=_0x32b329['data'][_0x577e('0x25','D*h1')];continue;case'4':this[_0x577e('0x26','eFdV')]=_0x32b329[_0x577e('0x27','TvR&')]['secret_rule'];continue;}break;}}await delayCall(()=>this[_0x577e('0x28','zsOc')](),_0x280ccb['iQptP'](this[_0x577e('0x29','mnGG')],0x3e8));}else{await delayCall(()=>this['startEnter'](),0x3e8);}}catch(_0x22a9f1){this[_0x577e('0x2a','&XW^')]++;console['error'](_0x22a9f1);await _0x280ccb[_0x577e('0x2b','jHjV')](delayCall,()=>this[_0x577e('0x2c','qs!D')](),0x3e8);}}async[_0x577e('0x2d','Dj]B')](){var _0x595c21={'PKjOS':function _0x24504c(_0x133857,_0x1c8440){return _0x133857>_0x1c8440;},'vQTrH':function _0x7df8e8(_0x4798be,_0x4a35a7){return _0x4798be==_0x4a35a7;},'lokZZ':'5|4|0|1|3|6|2','qICjt':function _0x500078(_0x5892a3,_0x8b4466,_0x53babb){return _0x5892a3(_0x8b4466,_0x53babb);}};try{if(!HeartGift[_0x577e('0x2e','&XW^')]||_0x595c21[_0x577e('0x2f','[a*F')](this[_0x577e('0x30','l(zF')],0x3))return;let _0x348b29={'id':[this[_0x577e('0x31','*%Q&')],this['area_id'],this[_0x577e('0x32','eFdV')],this[_0x577e('0x33','lPeP')]],'device':[this[_0x577e('0x34','l(zF')],this['uuid']],'ets':this['ets'],'benchmark':this[_0x577e('0x35','zXvY')],'time':this[_0x577e('0x36','vZe4')],'ts':new Date()['getTime'](),'ua':this['ua']};KeySign['convert'](_0x348b29);let _0x171cef=BiliPushUtils['sign'](JSON['stringify'](_0x348b29),this[_0x577e('0x37','mnGG')]);if(_0x171cef){_0x348b29['s']=_0x171cef;let _0x2c88e9=await BiliPushUtils[_0x577e('0x38','mnGG')]['HeartGift'][_0x577e('0x39','4r89')](_0x348b29);if(_0x595c21['vQTrH'](_0x2c88e9[_0x577e('0x3a','i6$Z')],0x0)){var _0x287a4f=_0x595c21[_0x577e('0x3b','TvR&')][_0x577e('0x3c',')ffk')]('|'),_0x6cd136=0x0;while(!![]){switch(_0x287a4f[_0x6cd136++]){case'0':this[_0x577e('0x3d','McH&')]=_0x2c88e9[_0x577e('0x3e','^I8]')][_0x577e('0x3f','Owm^')];continue;case'1':this[_0x577e('0x40','lPeP')]=_0x2c88e9[_0x577e('0x41',')ffk')][_0x577e('0x42','XBon')];continue;case'2':if(HeartGift[_0x577e('0x43','^I8]')]<=HeartGift['max']&&HeartGift[_0x577e('0x44','WFzE')]){await delayCall(()=>this[_0x577e('0x45','lPeP')](),this[_0x577e('0x46','By7P')]*0x3e8);}else{if(HeartGift['process']){console['log'](_0x577e('0x47','Pro%'));HeartGift[_0x577e('0x2e','&XW^')]=![];runTomorrow(HeartGift[_0x577e('0x48','dY4$')]);}}continue;case'3':this[_0x577e('0x49','TvR&')]=_0x2c88e9['data']['timestamp'];continue;case'4':++this['seq'];continue;case'5':++HeartGift[_0x577e('0x4a','CqZo')];continue;case'6':this['secret_rule']=_0x2c88e9['data']['secret_rule'];continue;}break;}}}}catch(_0x7ae686){this[_0x577e('0x4b','zxP3')]++;console[_0x577e('0x4c','9!x6')](_0x7ae686);await _0x595c21[_0x577e('0x4d','^I8]')](delayCall,()=>this[_0x577e('0x4e','Pro%')](),0x3e8);}}}const HeartGift={'total':0x0,'max':0x19,'process':!![],'run':async()=>{var _0x5c5c06={'iFmRQ':function _0x50e480(_0x272b3,_0x21a0db){return _0x272b3==_0x21a0db;},'JDjFB':function _0xd4df86(_0x30d67c,_0x20d54c,_0x4ba1d1){return _0x30d67c(_0x20d54c,_0x4ba1d1);}};if(!HeartGift[_0x577e('0x4f','b9Rz')]){HeartGift[_0x577e('0x50','%W9^')]=!![];}await Gift[_0x577e('0x51','[a*F')]();let _0x3110d9=Gift[_0x577e('0x52','[a*F')];if(_0x3110d9){console[_0x577e('0x53','u1J8')](_0x577e('0x54','l(zF'));for(let _0x1c488d of _0x3110d9){let _0x229ff4=await API['room']['get_info'](parseInt(_0x1c488d[_0x577e('0x55','Jdte')],0xa));if(_0x5c5c06['iFmRQ'](_0x229ff4[_0x577e('0x56','b9Rz')],0x0)){new HeartGiftRoom(_0x229ff4[_0x577e('0x57','VEMc')]);await _0x5c5c06['JDjFB'](delayCall,()=>{},0x3e8);}}}}};(window[_0x577e('0x58','TvR&')]=window[_0x577e('0x59','[a*F')]||[])[_0x577e('0x5a',')ffk')]([[0x2e],{2205:function(_0x2e9ac3,_0x2a2ff7,_0x34bc78){var _0x16fd1a={'mmRCS':function _0x314dfa(_0x25dfcc,_0xcd3887){return _0x25dfcc===_0xcd3887;},'UgpRz':function _0x31761d(_0x38e572,_0x59a525){return _0x38e572!=_0x59a525;},'CuoUk':function _0x4aa862(_0x5080de,_0x33ba89){return _0x5080de+_0x33ba89;},'KLGWM':function _0x2d882a(_0xc21f8b,_0x489a71){return _0xc21f8b===_0x489a71;},'iatQb':function _0x50d6d3(_0x2cc66c,_0x30d8dc){return _0x2cc66c/_0x30d8dc;},'RXkTz':function _0x1650cc(_0x1e9941,_0x8ca35f){return _0x1e9941/_0x8ca35f;},'EyiEG':function _0x7c0026(_0x271187,_0x34cc3a){return _0x271187/_0x34cc3a;},'awFvg':function _0x57270f(_0x2c7890,_0x955a8e){return _0x2c7890/_0x955a8e;},'wPYFQ':function _0x445e6a(_0x4be5df,_0x2b908e){return _0x4be5df+_0x2b908e;},'pNPfm':function _0x55a572(_0x5ea024,_0x4e9eff){return _0x5ea024+_0x4e9eff;},'mhAMC':function _0x5f3205(_0x350998,_0x3e29f6){return _0x350998<_0x3e29f6;},'peYLB':function _0x5638bc(_0x307fdf,_0x3508c6){return _0x307fdf/_0x3508c6;},'DXdCy':function _0x6323a5(_0x44b3c4,_0x579548){return _0x44b3c4+_0x579548;},'hFOZQ':function _0x4ca05e(_0x1d2fb6,_0x3dbc24){return _0x1d2fb6*_0x3dbc24;},'vRAgF':function _0x246864(_0xb17ab9,_0x407066){return _0xb17ab9+_0x407066;},'mCORT':function _0x540afc(_0x2760b6,_0xa91c){return _0x2760b6===_0xa91c;},'hiYdQ':function _0x9ee9f7(_0x29e036,_0x235fa6){return _0x29e036===_0x235fa6;},'gdLuf':function _0x59be0f(_0x4a0ab5,_0x459c7d){return _0x4a0ab5/_0x459c7d;},'lXokJ':function _0x227fce(_0x559d4f,_0x27e9b2){return _0x559d4f/_0x27e9b2;},'LBxaA':function _0x18f65e(_0x425ad0,_0x3de7c1){return _0x425ad0+_0x3de7c1;},'HnbWZ':function _0x6cd186(_0x2716bf,_0x1dc5e3){return _0x2716bf/_0x1dc5e3;},'klXHG':function _0x224b2a(_0x56821f,_0x46755e){return _0x56821f+_0x46755e;},'huIus':function _0x5d3165(_0x1f1036,_0x47a59b){return _0x1f1036===_0x47a59b;},'lnDtB':function _0x198dc0(_0xe1f9f1,_0xa3fec5){return _0xe1f9f1+_0xa3fec5;},'FSDib':function _0x5ea3c3(_0x18596b,_0x3ed7fc){return _0x18596b/_0x3ed7fc;},'mIfqR':function _0x55f078(_0x2b6ff7,_0x181c19){return _0x2b6ff7+_0x181c19;},'pZRXL':function _0x4bf7a8(_0x2c46e1,_0x51ff45){return _0x2c46e1/_0x51ff45;},'IGxRQ':function _0x1d040d(_0x203f5e,_0x4a5166){return _0x203f5e>_0x4a5166;},'Ciajz':function _0x176a94(_0x2bdfed,_0xc3964b){return _0x2bdfed+_0xc3964b;},'JeJaj':function _0x3a5d1d(_0x870680,_0x459927){return _0x870680|_0x459927;},'GaFoU':function _0x4c7802(_0x4e7d74,_0x1951aa){return _0x4e7d74&_0x1951aa;},'ajWSd':function _0x566fc7(_0x5d2baf,_0x588bce){return _0x5d2baf<_0x588bce;},'nyiQQ':function _0x4876f2(_0x2e7343,_0x4650e8){return _0x2e7343|_0x4650e8;},'UDQIV':function _0x194817(_0x4ebfca,_0x1016ab){return _0x4ebfca<<_0x1016ab;},'bpRWG':function _0x3ca778(_0x173002,_0x522a57){return _0x173002&_0x522a57;},'tKWsY':function _0x4635e0(_0x3e4c5f,_0x5a765d){return _0x3e4c5f<<_0x5a765d;},'hMfZs':function _0x278299(_0x270344,_0x1bc10c){return _0x270344&_0x1bc10c;},'vcvyt':function _0x50930f(_0x3b416d,_0x9b0d81){return _0x3b416d&_0x9b0d81;},'BkRXA':function _0xa8acbb(_0x2aaf15,_0x1d99d3){return _0x2aaf15>=_0x1d99d3;},'CaHDG':function _0x1b6651(_0x5cae2e,_0x3d6bac){return _0x5cae2e+_0x3d6bac;},'eysyF':function _0x5c8ce9(_0x5edfb2,_0x309f60){return _0x5edfb2&_0x309f60;},'TaPVE':function _0x367fe8(_0x1ee807,_0x400060){return _0x1ee807==_0x400060;},'WyIlZ':function _0x3bad41(_0x4f0977,_0xa3f5fa){return _0x4f0977<=_0xa3f5fa;},'WGAXW':function _0x69761e(_0x2cef3b,_0xf4d715){return _0x2cef3b|_0xf4d715;},'gijei':function _0x48e5ae(_0x20b75a,_0x486845){return _0x20b75a<=_0x486845;},'zwDlk':function _0x1dfde4(_0x5897ec,_0x3156ed){return _0x5897ec<=_0x3156ed;},'jgkAX':_0x577e('0x5b','jHjV'),'hlyRJ':function _0x2dc3fe(_0x3507c4,_0x1686b5){return _0x3507c4<_0x1686b5;},'ZIJwS':function _0xdeac5b(_0x2d733e,_0x1d053e){return _0x2d733e|_0x1d053e;},'FXyoz':function _0xbb8db(_0x30bbf0,_0x3344e0){return _0x30bbf0<=_0x3344e0;},'SdzsT':function _0x123cbe(_0x27d721,_0x36d584){return _0x27d721>>_0x36d584;},'MRhpu':function _0xb6c681(_0x22d27c,_0x3ac587){return _0x22d27c|_0x3ac587;},'mXiQI':function _0x50466e(_0x1dadb3,_0x16b4eb){return _0x1dadb3>>_0x16b4eb;},'XZNQX':function _0x3ff336(_0x2b4a97,_0x44fa55){return _0x2b4a97&_0x44fa55;},'aFrUH':function _0x5f4fe5(_0x467c01,_0x588f92){return _0x467c01|_0x588f92;},'azLlt':function _0x15f255(_0x4b529f,_0x3d7c60){return _0x4b529f===_0x3d7c60;},'CbQux':function _0x23cf62(_0x394f40,_0x589e5e){return _0x394f40*_0x589e5e;},'Ljxkf':function _0x14d9c4(_0x92bb90,_0x2fc75d){return _0x92bb90+_0x2fc75d;},'RsnlO':_0x577e('0x5c','*j4Z'),'HSYpK':function _0x2c800c(_0x53b17a,_0x46a4f5){return _0x53b17a+_0x46a4f5;},'tsIZr':function _0x55aebd(_0x311b77,_0x5f712d){return _0x311b77/_0x5f712d;},'kOQhO':function _0x3501c0(_0x18b16a,_0x292c4c){return _0x18b16a+_0x292c4c;},'BHlZJ':function _0x5eb959(_0x27f326,_0x35d950){return _0x27f326+_0x35d950;},'bOSyY':_0x577e('0x5d','sCFV'),'eGcGe':function _0x4c6f1a(_0x121b0c,_0x5c6d6e){return _0x121b0c+_0x5c6d6e;},'ShHib':function _0x469b2a(_0x1965ba,_0x13e2a5){return _0x1965ba===_0x13e2a5;},'VAHfQ':_0x577e('0x5e','3mY$'),'ICxdo':_0x577e('0x5f','McH&'),'QhkdP':'function','JZHuB':_0x577e('0x60','mnGG'),'VqCpK':'object','uFQzO':function _0x367f2b(_0x4aa878,_0x4febe6){return _0x4aa878==_0x4febe6;},'iopxL':_0x577e('0x61','l(zF'),'RONIv':function _0x350632(_0x265d34,_0x5c8ffe){return _0x265d34==_0x5c8ffe;},'lpwWa':function _0x15856f(_0x21894b,_0x4c3a64){return _0x21894b!=_0x4c3a64;},'FJGxd':function _0x1e2dda(_0x25f393,_0x24808f){return _0x25f393==_0x24808f;},'vCJcy':function _0x3c3195(_0x5a5c85,_0x5e30a8){return _0x5a5c85!=_0x5e30a8;},'Mksil':_0x577e('0x62','^I8]'),'Joggq':function _0x1f7dfb(_0x3744ac,_0x23965f){return _0x3744ac(_0x23965f);}};'use strict';_0x34bc78['r'](_0x2a2ff7);var _0x2c14f5=_0x34bc78(0x1f7),_0x289f5d=_0x34bc78['n'](_0x2c14f5),_0x502550=_0x34bc78(0x382),_0x2f6b98=_0x34bc78['n'](_0x502550),_0x1a732a=_0x16fd1a[_0x577e('0x63','Y0)h')](_0x34bc78,0x79),_0x18cb59=_0x34bc78['n'](_0x1a732a),_0x539139=_0x34bc78(0x3f),_0x1efd1f=_0x34bc78['n'](_0x539139);_0x2a2ff7[_0x577e('0x64','NU&@')]=function(){var _0x2b07ce={'vpDFe':function _0x4f5d70(_0x21ea11,_0xee7647){return _0x16fd1a['hlyRJ'](_0x21ea11,_0xee7647);},'YyEyF':function _0x38cc95(_0x393fdb,_0x5aefa2){return _0x393fdb>=_0x5aefa2;},'JKwbq':function _0x15c9cd(_0x5dc15e,_0x319408){return _0x16fd1a[_0x577e('0x65','Owm^')](_0x5dc15e,_0x319408);},'rcvCw':function _0x2fc31c(_0xfc0911,_0x35e75b){return _0x16fd1a['ZIJwS'](_0xfc0911,_0x35e75b);},'muMeM':function _0x22c9b8(_0xf5fbd7,_0x3256c0){return _0x16fd1a[_0x577e('0x66',')ffk')](_0xf5fbd7,_0x3256c0);},'DHUYU':function _0x40b001(_0x29b50f,_0x44b05c){return _0x16fd1a[_0x577e('0x67','%W9^')](_0x29b50f,_0x44b05c);},'pKKLe':function _0x164122(_0x41a6c4,_0x1f3718){return _0x16fd1a[_0x577e('0x68','vZe4')](_0x41a6c4,_0x1f3718);},'sDwfn':function _0x28bdb0(_0x451641,_0x1c6c02){return _0x451641>>_0x1c6c02;},'hNYKI':function _0x26ce33(_0x2b4373,_0x212b31){return _0x16fd1a[_0x577e('0x69','3][z')](_0x2b4373,_0x212b31);},'AFrNG':function _0x4cc179(_0x4ff3ab,_0x5d2cbb){return _0x4ff3ab&_0x5d2cbb;},'CubZE':function _0x38a1a9(_0x459771,_0x2afb4f){return _0x16fd1a['SdzsT'](_0x459771,_0x2afb4f);},'PrtbK':function _0x41a3b2(_0x3b508a,_0x346c09){return _0x3b508a|_0x346c09;},'uNGGp':function _0x49d3c1(_0x2ce179,_0x2171b1){return _0x2ce179&_0x2171b1;},'XYhBe':function _0x560d5d(_0x16f89d,_0x3d7ae6){return _0x16f89d>>_0x3d7ae6;},'BHQXC':function _0x419e89(_0x6b5f7,_0x50df56){return _0x16fd1a[_0x577e('0x6a','3mY$')](_0x6b5f7,_0x50df56);},'OpFqT':function _0x29f5b3(_0x12ceb9,_0x4f184e){return _0x16fd1a[_0x577e('0x6b','zxP3')](_0x12ceb9,_0x4f184e);},'lWRhT':function _0x3fe080(_0x324c3c,_0x1ec718){return _0x16fd1a['MRhpu'](_0x324c3c,_0x1ec718);},'loLoW':function _0x50a0e2(_0x52f9f,_0x4629af){return _0x16fd1a[_0x577e('0x6c','^I8]')](_0x52f9f,_0x4629af);},'wLKuW':function _0x438314(_0x408730,_0x4a3a08){return _0x408730|_0x4a3a08;},'UEiPy':function _0xe64a11(_0x248fe9,_0x570452){return _0x248fe9&_0x570452;},'OhfYp':function _0x3eedc1(_0x33993e,_0x40768d){return _0x16fd1a[_0x577e('0x6d','%C%y')](_0x33993e,_0x40768d);},'McDED':function _0x181e91(_0xe478ff,_0x1423ff){return _0x16fd1a[_0x577e('0x6e','b9Rz')](_0xe478ff,_0x1423ff);},'KCXvT':function _0x1ceb4e(_0x7764fd,_0x3f85b5){return _0x16fd1a['mXiQI'](_0x7764fd,_0x3f85b5);},'EGfHF':function _0x137e66(_0x4e4ba4,_0x3655e9){return _0x16fd1a[_0x577e('0x6f','lPeP')](_0x4e4ba4,_0x3655e9);},'sOyFP':function _0x8223e4(_0x3e44e5,_0xd8fe16){return _0x16fd1a['XZNQX'](_0x3e44e5,_0xd8fe16);},'OoRdX':function _0x5ccddc(_0x12d1d6,_0x5cd53c){return _0x16fd1a[_0x577e('0x70','^I8]')](_0x12d1d6,_0x5cd53c);},'ERSUg':function _0x247317(_0x56174a,_0xac9299){return _0x56174a!==_0xac9299;},'plJia':function _0x1294a0(_0x256266,_0x2f4cc0){return _0x16fd1a[_0x577e('0x71','Jdte')](_0x256266,_0x2f4cc0);},'zZANK':function _0x32c932(_0x4aef33,_0x576e5f){return _0x16fd1a[_0x577e('0x72','NU&@')](_0x4aef33,_0x576e5f);},'QkQcC':function _0x3e6042(_0x5bd862,_0x51c599){return _0x16fd1a[_0x577e('0x73','*j4Z')](_0x5bd862,_0x51c599);},'HQFAF':function _0xbba6b6(_0x38a69f,_0x5d0f60){return _0x38a69f+_0x5d0f60;},'FvuGq':function _0x1d2178(_0x16100d,_0x99e1e){return _0x16fd1a[_0x577e('0x74','%W9^')](_0x16100d,_0x99e1e);},'evJXS':function _0x3be9ec(_0x12fba5,_0x4f3051){return _0x12fba5<_0x4f3051;},'kylit':function _0x4bb94c(_0x2f41bc,_0x4842ec){return _0x16fd1a[_0x577e('0x75','Jdte')](_0x2f41bc,_0x4842ec);},'eYbTW':function _0x3e6f6a(_0x201ff5,_0x5a766f){return _0x201ff5*_0x5a766f;},'MYmKy':function _0x261b5c(_0x58ba2b,_0x3f69de){return _0x16fd1a[_0x577e('0x76','Y0)h')](_0x58ba2b,_0x3f69de);},'UszTW':function _0x8267db(_0xeb2424,_0x37ea32){return _0xeb2424/_0x37ea32;},'sECCt':function _0x4a9366(_0x11fb99,_0xdfa0ed){return _0x11fb99/_0xdfa0ed;},'NUqFX':_0x16fd1a[_0x577e('0x77','pZoy')],'AQkvp':'[object\x20Number]','FXoVL':function _0x478903(_0x4cb034,_0xd1340f){return _0x16fd1a[_0x577e('0x78','By7P')](_0x4cb034,_0xd1340f);},'WsAtV':function _0xf60296(_0x1f30bd,_0x4af8f7){return _0x16fd1a[_0x577e('0x79',')ffk')](_0x1f30bd,_0x4af8f7);},'aVtmw':function _0x1618b8(_0x1352fa,_0x27a2bb){return _0x16fd1a['kOQhO'](_0x1352fa,_0x27a2bb);},'CbTBD':function _0x3d790b(_0x1a564d,_0x3e6705){return _0x16fd1a[_0x577e('0x7a','i6$Z')](_0x1a564d,_0x3e6705);},'ASTzK':function _0x58598e(_0x5abf84,_0x57a2fd){return _0x5abf84===_0x57a2fd;},'oYxTC':_0x16fd1a['bOSyY'],'blGRv':function _0x3e0053(_0x48fe84,_0x5e3161){return _0x48fe84+_0x5e3161;},'lYNWZ':function _0x504ed9(_0x34da94,_0xca789e){return _0x16fd1a['eGcGe'](_0x34da94,_0xca789e);},'nBJnJ':function _0x3980af(_0x56881f,_0x57a9bb){return _0x16fd1a[_0x577e('0x7b','lPeP')](_0x56881f,_0x57a9bb);},'HLLCf':function _0x54e37d(_0x5e6a7c,_0x2fc2cd){return _0x16fd1a[_0x577e('0x7c','Pro%')](_0x5e6a7c,_0x2fc2cd);},'GImLH':function _0x1d8ce3(_0x33e7cd,_0x4d1437){return _0x33e7cd===_0x4d1437;},'Ewxyv':function _0x59ef1a(_0xd9b6ca,_0xb98b67){return _0x16fd1a[_0x577e('0x7d','4r89')](_0xd9b6ca,_0xb98b67);},'qYIqL':function _0x586070(_0x4c2cad,_0x5dfcff){return _0x4c2cad in _0x5dfcff;},'WNFto':function _0x3e4d27(_0x46645f,_0x42402a){return _0x46645f|_0x42402a;},'vUcOf':_0x577e('0x7e','*j4Z'),'pWFNU':_0x16fd1a[_0x577e('0x7f','McH&')],'kzhnL':_0x16fd1a[_0x577e('0x80','A6wZ')],'XSXTv':function _0x36ef50(_0x387611){return _0x387611();}};var _0x2e9ac3={'STDWEB_PRIVATE':{}};_0x2e9ac3[_0x577e('0x81','9!x6')][_0x577e('0x82','VEMc')]=function(_0xf7b595,_0x20f01f){for(var _0x262893=_0x2e9ac3[_0x577e('0x83','By7P')],_0x2f49ff=0x0;_0x2b07ce[_0x577e('0x84','Jdte')](_0x2f49ff,_0xf7b595[_0x577e('0x85','VEMc')]);++_0x2f49ff){var _0x5515aa=_0xf7b595['charCodeAt'](_0x2f49ff);_0x2b07ce[_0x577e('0x86','9N[*')](_0x5515aa,0xd800)&&_0x2b07ce[_0x577e('0x87','vZe4')](_0x5515aa,0xdfff)&&(_0x5515aa=_0x2b07ce['rcvCw'](_0x2b07ce['muMeM'](0x10000,_0x2b07ce[_0x577e('0x88','9!x6')](0x3ff,_0x5515aa)<<0xa),0x3ff&_0xf7b595[_0x577e('0x89','VEMc')](++_0x2f49ff))),_0x5515aa<=0x7f?_0x262893[_0x20f01f++]=_0x5515aa:_0x2b07ce[_0x577e('0x8a','D*h1')](_0x5515aa,0x7ff)?(_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x8b','9!x6')](0xc0,_0x5515aa>>0x6),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x8c','^I8]')](0x80,0x3f&_0x5515aa)):_0x5515aa<=0xffff?(_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x8c','^I8]')](0xe0,_0x5515aa>>0xc),_0x262893[_0x20f01f++]=0x80|_0x2b07ce[_0x577e('0x8d','lPeP')](_0x5515aa,0x6)&0x3f,_0x262893[_0x20f01f++]=_0x2b07ce['rcvCw'](0x80,_0x2b07ce[_0x577e('0x8e','@)9V')](0x3f,_0x5515aa))):_0x2b07ce[_0x577e('0x8f','9!x6')](_0x5515aa,0x1fffff)?(_0x262893[_0x20f01f++]=_0x2b07ce['rcvCw'](0xf0,_0x5515aa>>0x12),_0x262893[_0x20f01f++]=_0x2b07ce['rcvCw'](0x80,_0x2b07ce[_0x577e('0x90','g10M')](_0x5515aa>>0xc,0x3f)),_0x262893[_0x20f01f++]=0x80|_0x2b07ce[_0x577e('0x91','pZoy')](_0x2b07ce[_0x577e('0x92','D*h1')](_0x5515aa,0x6),0x3f),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x93','Jdte')](0x80,_0x2b07ce[_0x577e('0x94','l(zF')](0x3f,_0x5515aa))):_0x2b07ce[_0x577e('0x95','@)9V')](_0x5515aa,0x3ffffff)?(_0x262893[_0x20f01f++]=0xf8|_0x2b07ce[_0x577e('0x96','eGx4')](_0x5515aa,0x18),_0x262893[_0x20f01f++]=0x80|_0x2b07ce[_0x577e('0x97','b9Rz')](_0x2b07ce[_0x577e('0x98','dY4$')](_0x5515aa,0x12),0x3f),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x99','qs!D')](0x80,_0x2b07ce[_0x577e('0x9a','*5Rb')](_0x5515aa,0xc)&0x3f),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x9b','*5Rb')](0x80,_0x2b07ce['uNGGp'](_0x5515aa>>0x6,0x3f)),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x9c','TvR&')](0x80,_0x2b07ce[_0x577e('0x9d','WFzE')](0x3f,_0x5515aa))):(_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0x9e','Pro%')](0xfc,_0x5515aa>>0x1e),_0x262893[_0x20f01f++]=0x80|_0x2b07ce[_0x577e('0x9f','vZe4')](_0x5515aa>>0x18,0x3f),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0xa0','*j4Z')](0x80,_0x2b07ce['loLoW'](_0x2b07ce['OpFqT'](_0x5515aa,0x12),0x3f)),_0x262893[_0x20f01f++]=_0x2b07ce[_0x577e('0xa1','dY4$')](0x80,_0x2b07ce[_0x577e('0xa2','NU&@')](_0x2b07ce['OhfYp'](_0x5515aa,0xc),0x3f)),_0x262893[_0x20f01f++]=_0x2b07ce['wLKuW'](0x80,_0x2b07ce[_0x577e('0xa3','*%Q&')](_0x2b07ce[_0x577e('0xa4','3mY$')](_0x5515aa,0x6),0x3f)),_0x262893[_0x20f01f++]=_0x2b07ce['EGfHF'](0x80,_0x2b07ce[_0x577e('0xa5','Dj]B')](0x3f,_0x5515aa)));}},_0x2e9ac3[_0x577e('0xa6','jHjV')][_0x577e('0xa7','TvR&')]=function(){},_0x2e9ac3[_0x577e('0xa8','*%Q&')][_0x577e('0xa9','b9Rz')]=function(_0x56dcbb){var _0xb40925={'atXUT':function _0x295499(_0x401f34,_0x5801a0){return _0x16fd1a[_0x577e('0xaa','pZoy')](_0x401f34,_0x5801a0);},'rIxdO':function _0x1660df(_0x5cbd3a,_0x1f3682){return _0x16fd1a['UgpRz'](_0x5cbd3a,_0x1f3682);}};var _0x34bc78=_0x2e9ac3[_0x577e('0xab','qs!D')][_0x16fd1a['CuoUk'](_0x56dcbb,0xc)];if(0x0!==_0x34bc78){var _0x2ecf77=_0x577e('0xac','lPeP')[_0x577e('0xad','g10M')]('|'),_0x43c475=0x0;while(!![]){switch(_0x2ecf77[_0x43c475++]){case'0':if(_0x16fd1a[_0x577e('0xae','3][z')](0xa,_0x34bc78)||_0x16fd1a[_0x577e('0xaf','b9Rz')](0xc,_0x34bc78)||_0x16fd1a[_0x577e('0xb0','Owm^')](0xd,_0x34bc78)){var _0x2ecb03=_0x2e9ac3[_0x577e('0xb1','&UNs')][_0x16fd1a['iatQb'](_0x56dcbb,0x4)],_0x4e1912=(_0x56dc36=_0x2e9ac3[_0x577e('0xb2','Pro%')][_0x16fd1a['RXkTz'](_0x16fd1a[_0x577e('0xb3','vZe4')](_0x56dcbb,0x4),0x4)],_0x2e9ac3[_0x577e('0xb4','dY4$')][_0x16fd1a[_0x577e('0xb5','%W9^')](_0x56dcbb+0x8,0x4)]),_0x13aa56=0x0,_0x15dc93=!0x1;return(_0x13ecbe=function _0x56dcbb(){if(_0x2b07ce[_0x577e('0xb6','*%Q&')](0x0,_0x56dc36)||!0x0===_0x15dc93)throw 0xa===_0x34bc78?new ReferenceError('Already\x20dropped\x20Rust\x20function\x20called!'):0xc===_0x34bc78?new ReferenceError(_0x577e('0xb7','Owm^')):new ReferenceError(_0x577e('0xb8','D*h1'));var _0x1a3290=_0x56dc36;if(_0x2b07ce['OoRdX'](0xd,_0x34bc78)&&(_0x56dcbb[_0x577e('0xb9','eFdV')]=_0x2e9ac3['STDWEB_PRIVATE']['noop'],_0x56dc36=0x0),_0x2b07ce[_0x577e('0xba','By7P')](0x0,_0x13aa56)&&(_0x2b07ce[_0x577e('0xbb','%C%y')](0xc,_0x34bc78)||_0x2b07ce[_0x577e('0xbc','Pro%')](0xd,_0x34bc78)))throw new ReferenceError(_0x577e('0xbd','9!x6'));var _0x438636=_0x2e9ac3[_0x577e('0xbe','VEMc')][_0x577e('0xbf','Pro%')](0x10);_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0xc1','Jdte')](_0x438636,arguments);try{_0x13aa56+=0x1,_0x2e9ac3[_0x577e('0xc2','CqZo')][_0x577e('0xc3','9N[*')](_0x577e('0xc4','3][z'),_0x2ecb03,[_0x1a3290,_0x438636]);var _0x4343db=_0x2e9ac3[_0x577e('0xc5','*5Rb')][_0x577e('0xc6','&UNs')];_0x2e9ac3[_0x577e('0xc7','%W9^')][_0x577e('0xc8','^I8]')]=null;}finally{_0x13aa56-=0x1;}return _0x2b07ce[_0x577e('0xc9','l(zF')](!0x0,_0x15dc93)&&0x0===_0x13aa56&&_0x56dcbb[_0x577e('0xca','Owm^')](),_0x4343db;})['drop']=function(){if(_0xb40925['atXUT'](0x0,_0x13aa56)){_0x13ecbe[_0x577e('0xcb','dY4$')]=_0x2e9ac3['STDWEB_PRIVATE']['noop'];var _0x56dcbb=_0x56dc36;_0x56dc36=0x0,_0xb40925['rIxdO'](0x0,_0x56dcbb)&&_0x2e9ac3[_0x577e('0xcc','Pro%')][_0x577e('0xcd','zXvY')]('vi',_0x4e1912,[_0x56dcbb]);}else _0x15dc93=!0x0;},_0x13ecbe;}continue;case'1':if(0x8===_0x34bc78){var _0x452b5c=_0x2e9ac3[_0x577e('0xce','*j4Z')]['arena'],_0x3af5aa=_0x452b5c+_0x2e9ac3[_0x577e('0xcf','VEMc')][_0x16fd1a['awFvg'](_0x56dcbb,0x4)],_0x2a1c0b=(_0x6cf28d=_0x2e9ac3[_0x577e('0xd0','b9Rz')][_0x16fd1a[_0x577e('0xd1','zsOc')](_0x16fd1a[_0x577e('0xd2','jHjV')](_0x56dcbb,0x4),0x4)],_0x16fd1a[_0x577e('0xd3','&UNs')](_0x452b5c,_0x2e9ac3[_0x577e('0xd4','%C%y')][_0x16fd1a[_0x577e('0xd5','sCFV')](_0x16fd1a[_0x577e('0xd6','XBon')](_0x56dcbb,0x8),0x4)]));for(_0x13ecbe={},_0x423a4f=0x0;_0x16fd1a['mhAMC'](_0x423a4f,_0x6cf28d);++_0x423a4f){var _0xe10db9=_0x2e9ac3[_0x577e('0xd7','&XW^')][_0x16fd1a[_0x577e('0xd8',')ffk')](_0x16fd1a[_0x577e('0xd9','qs!D')](_0x2a1c0b,0x8*_0x423a4f),0x4)],_0x1ac461=_0x2e9ac3['HEAPU32'][_0x16fd1a[_0x577e('0xda','Jdte')](_0x16fd1a['DXdCy'](_0x2a1c0b,0x4),_0x16fd1a[_0x577e('0xdb','zXvY')](0x8,_0x423a4f))/0x4],_0xf2d2c=_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0xdc','McH&')](_0xe10db9,_0x1ac461),_0x5028fe=_0x2e9ac3[_0x577e('0xdd','&UNs')][_0x577e('0xa9','b9Rz')](_0x16fd1a['vRAgF'](_0x3af5aa,0x10*_0x423a4f));_0x13ecbe[_0xf2d2c]=_0x5028fe;}return _0x13ecbe;}continue;case'2':if(_0x16fd1a[_0x577e('0xde','3][z')](0x9,_0x34bc78))return _0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0xdf','XBon')](_0x2e9ac3[_0x577e('0xe0','NU&@')][_0x56dcbb/0x4]);continue;case'3':if(_0x16fd1a['mCORT'](0x1,_0x34bc78))return null;continue;case'4':if(_0x16fd1a[_0x577e('0xe1','9!x6')](0x3,_0x34bc78))return _0x2e9ac3['HEAPF64'][_0x56dcbb/0x8];continue;case'5':if(_0x16fd1a[_0x577e('0xe2','@)9V')](0xe,_0x34bc78)){_0x56dc36=_0x2e9ac3[_0x577e('0xb4','dY4$')][_0x16fd1a['gdLuf'](_0x56dcbb,0x4)],_0x6cf28d=_0x2e9ac3[_0x577e('0xe3','^I8]')][_0x16fd1a[_0x577e('0xe4','[a*F')](_0x16fd1a['LBxaA'](_0x56dcbb,0x4),0x4)];var _0x3aa2a6=_0x2e9ac3['HEAPU32'][_0x16fd1a[_0x577e('0xe5','Y0)h')](_0x16fd1a[_0x577e('0xe6','Y0)h')](_0x56dcbb,0x8),0x4)],_0x3db12e=_0x16fd1a[_0x577e('0xe7','Pro%')](_0x56dc36,_0x6cf28d);switch(_0x3aa2a6){case 0x0:return _0x2e9ac3[_0x577e('0xe8','D*h1')][_0x577e('0xe9','Pro%')](_0x56dc36,_0x3db12e);case 0x1:return _0x2e9ac3[_0x577e('0xea','Jdte')][_0x577e('0xeb','%W9^')](_0x56dc36,_0x3db12e);case 0x2:return _0x2e9ac3[_0x577e('0xec','sCFV')][_0x577e('0xed','eFdV')](_0x56dc36,_0x3db12e);case 0x3:return _0x2e9ac3[_0x577e('0xee','&XW^')]['subarray'](_0x56dc36,_0x3db12e);case 0x4:return _0x2e9ac3['HEAPU32'][_0x577e('0xef','Jdte')](_0x56dc36,_0x3db12e);case 0x5:return _0x2e9ac3[_0x577e('0xf0','i6$Z')][_0x577e('0xf1','&UNs')](_0x56dc36,_0x3db12e);case 0x6:return _0x2e9ac3['HEAPF32']['subarray'](_0x56dc36,_0x3db12e);case 0x7:return _0x2e9ac3[_0x577e('0xf2','3][z')][_0x577e('0xf3','l(zF')](_0x56dc36,_0x3db12e);}}else if(_0x16fd1a[_0x577e('0xf4','WFzE')](0xf,_0x34bc78))return _0x2e9ac3[_0x577e('0xf5','mnGG')][_0x577e('0xf6','@)9V')](_0x2e9ac3[_0x577e('0xd4','%C%y')][_0x16fd1a[_0x577e('0xf7','lPeP')](_0x56dcbb,0x4)]);continue;case'6':if(_0x16fd1a[_0x577e('0xf8','4r89')](0x6,_0x34bc78))return!0x0;continue;case'7':if(_0x16fd1a['huIus'](0x7,_0x34bc78)){_0x56dc36=_0x2e9ac3[_0x577e('0xf9','3mY$')]['arena']+_0x2e9ac3['HEAPU32'][_0x56dcbb/0x4],_0x6cf28d=_0x2e9ac3[_0x577e('0xfa','Owm^')][_0x16fd1a['HnbWZ'](_0x16fd1a[_0x577e('0xfb','3mY$')](_0x56dcbb,0x4),0x4)];for(var _0x13ecbe=[],_0x423a4f=0x0;_0x16fd1a[_0x577e('0xfc','CqZo')](_0x423a4f,_0x6cf28d);++_0x423a4f)_0x13ecbe[_0x577e('0xfd','9N[*')](_0x2e9ac3[_0x577e('0xfe','XBon')]['to_js'](_0x16fd1a[_0x577e('0xff',')ffk')](_0x56dc36,0x10*_0x423a4f)));return _0x13ecbe;}continue;case'8':if(_0x16fd1a['huIus'](0x5,_0x34bc78))return!0x1;continue;case'9':if(_0x16fd1a[_0x577e('0x100','mnGG')](0x4,_0x34bc78)){var _0x56dc36=_0x2e9ac3[_0x577e('0x101','D*h1')][_0x56dcbb/0x4],_0x6cf28d=_0x2e9ac3[_0x577e('0x102','i6$Z')][_0x16fd1a[_0x577e('0x103','By7P')](_0x16fd1a[_0x577e('0x104','@)9V')](_0x56dcbb,0x4),0x4)];return _0x2e9ac3[_0x577e('0xce','*j4Z')][_0x577e('0x105','[a*F')](_0x56dc36,_0x6cf28d);}continue;case'10':if(_0x16fd1a[_0x577e('0x106','D*h1')](0x2,_0x34bc78))return _0x2e9ac3['HEAP32'][_0x16fd1a[_0x577e('0x107','vZe4')](_0x56dcbb,0x4)];continue;}break;}}},_0x2e9ac3[_0x577e('0xa8','*%Q&')]['serialize_object']=function(_0x12225d,_0x5b77c4){var _0x4d5832=_0x1efd1f()(_0x5b77c4),_0x348f5f=_0x4d5832['length'],_0x5dc76f=_0x2e9ac3[_0x577e('0xce','*j4Z')][_0x577e('0x108','b9Rz')](_0x2b07ce[_0x577e('0x109','qs!D')](0x8,_0x348f5f)),_0x5cfd7c=_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0x10a','u1J8')](_0x2b07ce[_0x577e('0x10b','jHjV')](0x10,_0x348f5f));_0x2e9ac3[_0x577e('0x10c','zXvY')][_0x2b07ce['HQFAF'](_0x12225d,0xc)]=0x8,_0x2e9ac3[_0x577e('0x10d','*%Q&')][_0x12225d/0x4]=_0x5cfd7c,_0x2e9ac3[_0x577e('0xe3','^I8]')][_0x2b07ce[_0x577e('0x10e',')ffk')](_0x2b07ce[_0x577e('0x10f','qs!D')](_0x12225d,0x4),0x4)]=_0x348f5f,_0x2e9ac3[_0x577e('0x110','*5Rb')][_0x2b07ce[_0x577e('0x111','*%Q&')](_0x12225d+0x8,0x4)]=_0x5dc76f;for(var _0x3212c5=0x0;_0x2b07ce[_0x577e('0x112','i6$Z')](_0x3212c5,_0x348f5f);++_0x3212c5){var _0x1aa2c3=_0x4d5832[_0x3212c5],_0x214b7f=_0x2b07ce['HQFAF'](_0x5dc76f,0x8*_0x3212c5);_0x2e9ac3[_0x577e('0x113','eGx4')][_0x577e('0x114','*j4Z')](_0x214b7f,_0x1aa2c3),_0x2e9ac3[_0x577e('0x115','%C%y')][_0x577e('0x116','D*h1')](_0x2b07ce['HQFAF'](_0x5cfd7c,_0x2b07ce[_0x577e('0x117','Jdte')](0x10,_0x3212c5)),_0x5b77c4[_0x1aa2c3]);}},_0x2e9ac3[_0x577e('0x118','zsOc')]['serialize_array']=function(_0x1c7bdd,_0x38c983){var _0x448725=_0x38c983[_0x577e('0x119','g10M')],_0x540d7d=_0x2e9ac3[_0x577e('0xdd','&UNs')][_0x577e('0x11a','&XW^')](_0x2b07ce['eYbTW'](0x10,_0x448725));_0x2e9ac3[_0x577e('0x11b','gYHe')][_0x2b07ce[_0x577e('0x11c','l(zF')](_0x1c7bdd,0xc)]=0x7,_0x2e9ac3['HEAPU32'][_0x2b07ce[_0x577e('0x11d','lPeP')](_0x1c7bdd,0x4)]=_0x540d7d,_0x2e9ac3[_0x577e('0x11e','sCFV')][_0x2b07ce['sECCt'](_0x2b07ce[_0x577e('0x11f','By7P')](_0x1c7bdd,0x4),0x4)]=_0x448725;for(var _0x349ce2=0x0;_0x2b07ce['evJXS'](_0x349ce2,_0x448725);++_0x349ce2)_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x120','l(zF')](_0x2b07ce[_0x577e('0x121','zXvY')](_0x540d7d,_0x2b07ce[_0x577e('0x122','u1J8')](0x10,_0x349ce2)),_0x38c983[_0x349ce2]);};var _0x2a2ff7=_0x16fd1a[_0x577e('0x123','Dj]B')]==typeof TextEncoder?new TextEncoder(_0x16fd1a[_0x577e('0x124','D*h1')]):_0x16fd1a['ShHib'](_0x16fd1a[_0x577e('0x125','*j4Z')],_0x16fd1a['uFQzO']('undefined',typeof util)?_0x16fd1a['iopxL']:_0x18cb59()(util))&&util&&_0x16fd1a[_0x577e('0x126','D*h1')](_0x16fd1a[_0x577e('0x127','l(zF')],typeof util['TextEncoder'])?new util[(_0x577e('0x128','lPeP'))](_0x16fd1a['JZHuB']):null;_0x2e9ac3[_0x577e('0x129',')ffk')]['to_utf8_string']=_0x16fd1a[_0x577e('0x12a','Dj]B')](null,_0x2a2ff7)?function(_0x129266,_0x2ba86d){var _0x3787ab=_0x2a2ff7['encode'](_0x2ba86d),_0x587015=_0x3787ab['length'],_0x8246be=0x0;_0x16fd1a[_0x577e('0x12b','i6$Z')](_0x587015,0x0)&&(_0x8246be=_0x2e9ac3[_0x577e('0x12c','zxP3')]['alloc'](_0x587015),_0x2e9ac3[_0x577e('0x12d','i6$Z')][_0x577e('0x12e','By7P')](_0x3787ab,_0x8246be)),_0x2e9ac3[_0x577e('0x12f','9!x6')][_0x16fd1a[_0x577e('0x130','^I8]')](_0x129266,0x4)]=_0x8246be,_0x2e9ac3[_0x577e('0x131','zXvY')][(_0x129266+0x4)/0x4]=_0x587015;}:function(_0x1f78c9,_0x7bc7c){var _0xd49508=_0x2e9ac3[_0x577e('0x12c','zxP3')][_0x577e('0x132','jHjV')](_0x7bc7c),_0x12fc2b=0x0;_0xd49508>0x0&&(_0x12fc2b=_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x108','b9Rz')](_0xd49508),_0x2e9ac3[_0x577e('0xbe','VEMc')][_0x577e('0x133','Jdte')](_0x7bc7c,_0x12fc2b)),_0x2e9ac3[_0x577e('0xd4','%C%y')][_0x1f78c9/0x4]=_0x12fc2b,_0x2e9ac3['HEAPU32'][_0x16fd1a[_0x577e('0x134','g10M')](_0x16fd1a[_0x577e('0x135','g10M')](_0x1f78c9,0x4),0x4)]=_0xd49508;},_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x120','l(zF')]=function(_0x8e576e,_0x194067){var _0x1d3357=Object[_0x577e('0x136','Y0)h')]['toString'][_0x577e('0x137','@)9V')](_0x194067);if(_0x2b07ce[_0x577e('0xc9','l(zF')](_0x2b07ce['NUqFX'],_0x1d3357))_0x2e9ac3[_0x577e('0x138','*j4Z')][_0x8e576e+0xc]=0x4,_0x2e9ac3[_0x577e('0x139','@)9V')]['to_utf8_string'](_0x8e576e,_0x194067);else if(_0x2b07ce[_0x577e('0x13a','u1J8')]===_0x1d3357)_0x2b07ce[_0x577e('0x13b','%W9^')](_0x194067,_0x2b07ce[_0x577e('0x13c','A6wZ')](0x0,_0x194067))?(_0x2e9ac3[_0x577e('0x13d','Owm^')][_0x2b07ce[_0x577e('0x13e','Y0)h')](_0x8e576e,0xc)]=0x2,_0x2e9ac3[_0x577e('0x13f','WFzE')][_0x2b07ce[_0x577e('0x140','zXvY')](_0x8e576e,0x4)]=_0x194067):(_0x2e9ac3[_0x577e('0x141','zsOc')][_0x2b07ce[_0x577e('0x142','eFdV')](_0x8e576e,0xc)]=0x3,_0x2e9ac3[_0x577e('0x143','l(zF')][_0x8e576e/0x8]=_0x194067);else if(_0x2b07ce[_0x577e('0x144','9!x6')](null,_0x194067))_0x2e9ac3[_0x577e('0x145','zxP3')][_0x8e576e+0xc]=0x1;else if(void 0x0===_0x194067)_0x2e9ac3[_0x577e('0x146','Y0)h')][_0x2b07ce[_0x577e('0x147','WFzE')](_0x8e576e,0xc)]=0x0;else if(!0x1===_0x194067)_0x2e9ac3[_0x577e('0x148','pZoy')][_0x2b07ce[_0x577e('0x149','NU&@')](_0x8e576e,0xc)]=0x5;else if(_0x2b07ce[_0x577e('0x14a','3mY$')](!0x0,_0x194067))_0x2e9ac3[_0x577e('0x14b','9!x6')][_0x2b07ce[_0x577e('0x14c','zsOc')](_0x8e576e,0xc)]=0x6;else if(_0x2b07ce['oYxTC']===_0x1d3357){var _0x3fa444=_0x2e9ac3[_0x577e('0x14d','TvR&')][_0x577e('0x14e','WFzE')](_0x194067);_0x2e9ac3['HEAPU8'][_0x2b07ce['blGRv'](_0x8e576e,0xc)]=0xf,_0x2e9ac3['HEAP32'][_0x2b07ce[_0x577e('0x14f','*5Rb')](_0x8e576e,0x4)]=_0x3fa444;}else{var _0x48bfdc=_0x2e9ac3[_0x577e('0x150','lPeP')][_0x577e('0x151','sCFV')](_0x194067);_0x2e9ac3[_0x577e('0x152','dY4$')][_0x2b07ce[_0x577e('0x153','@)9V')](_0x8e576e,0xc)]=0x9,_0x2e9ac3[_0x577e('0x154','4r89')][_0x2b07ce[_0x577e('0x155','pZoy')](_0x8e576e,0x4)]=_0x48bfdc;}};var _0x34bc78=_0x16fd1a[_0x577e('0x156','3mY$')](_0x16fd1a['QhkdP'],typeof TextDecoder)?new TextDecoder(_0x16fd1a[_0x577e('0x157','eFdV')]):_0x16fd1a[_0x577e('0x158','Owm^')](_0x16fd1a[_0x577e('0x159','l(zF')],_0x16fd1a[_0x577e('0x15a','^I8]')](_0x16fd1a[_0x577e('0x15b','*%Q&')],typeof util)?_0x16fd1a[_0x577e('0x15c','sCFV')]:_0x18cb59()(util))&&util&&_0x16fd1a['FJGxd'](_0x16fd1a[_0x577e('0x15d','vZe4')],typeof util[_0x577e('0x15e','VEMc')])?new util['TextDecoder'](_0x16fd1a[_0x577e('0x15f','zxP3')]):null;_0x2e9ac3[_0x577e('0x160','4r89')]['to_js_string']=_0x16fd1a['vCJcy'](null,_0x34bc78)?function(_0x3cc7b6,_0x57c629){return _0x34bc78[_0x577e('0x161','zXvY')](_0x2e9ac3[_0x577e('0x145','zxP3')]['subarray'](_0x3cc7b6,_0x3cc7b6+_0x57c629));}:function(_0x29a7e3,_0x262058){for(var _0x8b32b7=_0x2e9ac3[_0x577e('0x162','Dj]B')],_0x3313c6=_0x16fd1a[_0x577e('0x163','lPeP')](0x0|(_0x29a7e3|=0x0),_0x16fd1a[_0x577e('0x164','TvR&')](0x0,_0x262058|=0x0)),_0x2fd5dd='';_0x16fd1a['mhAMC'](_0x29a7e3,_0x3313c6);){var _0x3cceb5=_0x8b32b7[_0x29a7e3++];if(_0x16fd1a[_0x577e('0x165','g10M')](_0x3cceb5,0x80))_0x2fd5dd+=String[_0x577e('0x166','Jdte')](_0x3cceb5);else{var _0x4c000e=_0x16fd1a[_0x577e('0x167','Dj]B')](0x1f,_0x3cceb5),_0x398ee0=0x0;_0x16fd1a[_0x577e('0x168','VEMc')](_0x29a7e3,_0x3313c6)&&(_0x398ee0=_0x8b32b7[_0x29a7e3++]);var _0x9b8be6=_0x16fd1a[_0x577e('0x169','&XW^')](_0x16fd1a[_0x577e('0x16a','NU&@')](_0x4c000e,0x6),_0x16fd1a[_0x577e('0x16b','lPeP')](0x3f,_0x398ee0));if(_0x3cceb5>=0xe0){var _0x12ff47=0x0;_0x29a7e3<_0x3313c6&&(_0x12ff47=_0x8b32b7[_0x29a7e3++]);var _0x477887=_0x16fd1a['tKWsY'](_0x16fd1a[_0x577e('0x16c','zsOc')](0x3f,_0x398ee0),0x6)|_0x16fd1a[_0x577e('0x16d','^I8]')](0x3f,_0x12ff47);if(_0x9b8be6=_0x16fd1a['tKWsY'](_0x4c000e,0xc)|_0x477887,_0x16fd1a[_0x577e('0x16e','9!x6')](_0x3cceb5,0xf0)){var _0x21b400=0x0;_0x29a7e3<_0x3313c6&&(_0x21b400=_0x8b32b7[_0x29a7e3++]),_0x9b8be6=_0x16fd1a[_0x577e('0x16f','Dj]B')](_0x16fd1a[_0x577e('0x170','%C%y')](0x7,_0x4c000e)<<0x12|_0x477887<<0x6,0x3f&_0x21b400),_0x2fd5dd+=String[_0x577e('0x171','Owm^')](_0x16fd1a[_0x577e('0x172','Y0)h')](0xd7c0,_0x9b8be6>>0xa)),_0x9b8be6=_0x16fd1a[_0x577e('0x173','@)9V')](0xdc00,_0x16fd1a['eysyF'](0x3ff,_0x9b8be6));}}_0x2fd5dd+=String[_0x577e('0x174','[a*F')](_0x9b8be6);}}return _0x2fd5dd;},_0x2e9ac3[_0x577e('0x12c','zxP3')]['id_to_ref_map']={},_0x2e9ac3[_0x577e('0x150','lPeP')][_0x577e('0x175','3mY$')]={},_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x176','*j4Z')]=new _0x2f6b98['a'](),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x177','4r89')]=new _0x289f5d['a'](),_0x2e9ac3[_0x577e('0xdd','&UNs')][_0x577e('0x178','*5Rb')]=0x1,_0x2e9ac3[_0x577e('0x179','gYHe')]['id_to_raw_value_map']={},_0x2e9ac3[_0x577e('0xa6','jHjV')][_0x577e('0x17a','CqZo')]=0x1,_0x2e9ac3[_0x577e('0xc7','%W9^')][_0x577e('0x17b','Dj]B')]=function(_0x300d22){if(_0x2b07ce[_0x577e('0x17c','4r89')](void 0x0,_0x300d22)||_0x2b07ce[_0x577e('0x17d','eGx4')](null,_0x300d22))return 0x0;var _0x34bc78=_0x2e9ac3[_0x577e('0x17e','b9Rz')][_0x577e('0x17f','eFdV')],_0x463347=_0x2e9ac3[_0x577e('0x180','NU&@')][_0x577e('0x181','*j4Z')],_0x48428=_0x2e9ac3[_0x577e('0xc5','*5Rb')][_0x577e('0x182','l(zF')],_0x21300e=_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x183',')ffk')],_0x1de44a=_0x48428['get'](_0x300d22);if(_0x2b07ce['Ewxyv'](void 0x0,_0x1de44a)&&(_0x1de44a=_0x21300e['get'](_0x300d22)),_0x2b07ce['Ewxyv'](void 0x0,_0x1de44a)){_0x1de44a=_0x2e9ac3[_0x577e('0xa6','jHjV')]['last_refid']++;try{_0x48428['set'](_0x300d22,_0x1de44a);}catch(_0xe66f1c){_0x21300e[_0x577e('0x184','9!x6')](_0x300d22,_0x1de44a);}}return _0x2b07ce['qYIqL'](_0x1de44a,_0x463347)?_0x34bc78[_0x1de44a]++:(_0x463347[_0x1de44a]=_0x300d22,_0x34bc78[_0x1de44a]=0x1),_0x1de44a;},_0x2e9ac3[_0x577e('0x81','9!x6')][_0x577e('0x185','mnGG')]=function(_0x1b4eb2){return _0x2e9ac3[_0x577e('0x186','^I8]')][_0x577e('0x187','A6wZ')][_0x1b4eb2];},_0x2e9ac3[_0x577e('0x188','&XW^')]['increment_refcount']=function(_0x962a3d){_0x2e9ac3[_0x577e('0x188','&XW^')][_0x577e('0x189','4r89')][_0x962a3d]++;},_0x2e9ac3[_0x577e('0x81','9!x6')][_0x577e('0x18a','u1J8')]=function(_0x2cc52e){var _0x34bc78=_0x2e9ac3[_0x577e('0x18b','l(zF')]['id_to_refcount_map'];if(_0x16fd1a['TaPVE'](0x0,--_0x34bc78[_0x2cc52e])){var _0x839ff8=_0x2e9ac3[_0x577e('0x188','&XW^')]['id_to_ref_map'],_0x3dffd7=_0x2e9ac3['STDWEB_PRIVATE']['ref_to_id_map_fallback'],_0xd950e=_0x839ff8[_0x2cc52e];delete _0x839ff8[_0x2cc52e],delete _0x34bc78[_0x2cc52e],_0x3dffd7['delete'](_0xd950e);}},_0x2e9ac3[_0x577e('0x18c','WFzE')]['register_raw_value']=function(_0x3e1eab){var _0x34bc78=_0x2e9ac3[_0x577e('0x150','lPeP')]['last_raw_value_id']++;return _0x2e9ac3[_0x577e('0x188','&XW^')][_0x577e('0x18d','VEMc')][_0x34bc78]=_0x3e1eab,_0x34bc78;},_0x2e9ac3[_0x577e('0x18e','qs!D')][_0x577e('0x18f','3][z')]=function(_0x4c1ef1){delete _0x2e9ac3[_0x577e('0x18c','WFzE')][_0x577e('0x190','zXvY')][_0x4c1ef1];},_0x2e9ac3[_0x577e('0xa6','jHjV')]['get_raw_value']=function(_0x4827d2){return _0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x191','WFzE')][_0x4827d2];},_0x2e9ac3[_0x577e('0x139','@)9V')]['alloc']=function(_0x2da90e){return _0x2e9ac3[_0x577e('0x192','^I8]')](_0x2da90e);},_0x2e9ac3[_0x577e('0xc7','%W9^')][_0x577e('0x193','*%Q&')]=function(_0x466450,_0x454683,_0x3a4bba){return _0x2e9ac3[_0x577e('0x194','*%Q&')][_0x577e('0x195','sCFV')](_0x454683)['apply'](null,_0x3a4bba);},_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x196','lPeP')]=function(_0x3f4e15){for(var _0x2a2ff7=0x0,_0x34bc78=0x0;_0x34bc78<_0x3f4e15['length'];++_0x34bc78){var _0x5c439d=_0x3f4e15['charCodeAt'](_0x34bc78);_0x16fd1a[_0x577e('0x197','Pro%')](_0x5c439d,0xd800)&&_0x16fd1a[_0x577e('0x198','sCFV')](_0x5c439d,0xdfff)&&(_0x5c439d=_0x16fd1a['WGAXW'](_0x16fd1a[_0x577e('0x199','*j4Z')](0x10000,(0x3ff&_0x5c439d)<<0xa),0x3ff&_0x3f4e15[_0x577e('0x19a','%C%y')](++_0x34bc78))),_0x5c439d<=0x7f?++_0x2a2ff7:_0x2a2ff7+=_0x5c439d<=0x7ff?0x2:_0x16fd1a['gijei'](_0x5c439d,0xffff)?0x3:_0x16fd1a[_0x577e('0x19b','@)9V')](_0x5c439d,0x1fffff)?0x4:_0x16fd1a[_0x577e('0x19c','mnGG')](_0x5c439d,0x3ffffff)?0x5:0x6;}return _0x2a2ff7;},_0x2e9ac3[_0x577e('0xc7','%W9^')]['prepare_any_arg']=function(_0xca1a78){var _0x34bc78=_0x2e9ac3[_0x577e('0xa8','*%Q&')][_0x577e('0x19d','lPeP')](0x10);return _0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x19e',')ffk')](_0x34bc78,_0xca1a78),_0x34bc78;},_0x2e9ac3[_0x577e('0xf9','3mY$')]['acquire_tmp']=function(_0x42a6c0){var _0x34bc78=_0x2e9ac3[_0x577e('0x160','4r89')][_0x577e('0x19f','VEMc')];return _0x2e9ac3[_0x577e('0xf5','mnGG')][_0x577e('0x1a0','lPeP')]=null,_0x34bc78;};var _0x503157=null,_0x44ce4b=null,_0x49198b=null,_0x4053fb=null,_0x4e4101=null,_0x10b9df=null,_0x3722f8=null,_0x13a4a9=null;function _0xb862bb(){var _0x2a2ff7=_0x2e9ac3[_0x577e('0x1a1','Y0)h')][_0x577e('0x1a2','%C%y')][_0x577e('0x1a3','&UNs')]['buffer'];_0x503157=new Int8Array(_0x2a2ff7),_0x44ce4b=new Int16Array(_0x2a2ff7),_0x49198b=new Int32Array(_0x2a2ff7),_0x4053fb=new Uint8Array(_0x2a2ff7),_0x4e4101=new Uint16Array(_0x2a2ff7),_0x10b9df=new Uint32Array(_0x2a2ff7),_0x3722f8=new Float32Array(_0x2a2ff7),_0x13a4a9=new Float64Array(_0x2a2ff7),_0x2e9ac3[_0x577e('0x1a4','Dj]B')]=_0x503157,_0x2e9ac3[_0x577e('0x1a5','lPeP')]=_0x44ce4b,_0x2e9ac3[_0x577e('0x1a6','zXvY')]=_0x49198b,_0x2e9ac3[_0x577e('0x1a7','Jdte')]=_0x4053fb,_0x2e9ac3[_0x577e('0x1a8','g10M')]=_0x4e4101,_0x2e9ac3[_0x577e('0x1a9','Dj]B')]=_0x10b9df,_0x2e9ac3[_0x577e('0x1aa','qs!D')]=_0x3722f8,_0x2e9ac3[_0x577e('0x1ab','9N[*')]=_0x13a4a9;}return Object[_0x577e('0x1ac',')ffk')](_0x2e9ac3,_0x16fd1a[_0x577e('0x1ad','[a*F')],{'value':{}}),{'imports':{'env':{'__cargo_web_snippet_0d39c013e2144171d64e2fac849140a7e54c939a':function(_0x54603c,_0x3a5d8c){_0x3a5d8c=_0x2e9ac3['STDWEB_PRIVATE']['to_js'](_0x3a5d8c),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1ae','pZoy')](_0x54603c,_0x3a5d8c[_0x577e('0x1af','l(zF')]);},'__cargo_web_snippet_0f503de1d61309643e0e13a7871406891e3691c9':function(_0x4ab380){_0x2e9ac3[_0x577e('0x1b0','By7P')]['from_js'](_0x4ab380,window);},'__cargo_web_snippet_10f5aa3985855124ab83b21d4e9f7297eb496508':function(_0x3f92d2){return _0x2b07ce[_0x577e('0x1b1','McH&')](_0x2e9ac3[_0x577e('0x118','zsOc')][_0x577e('0x1b2','%W9^')](_0x3f92d2)instanceof Array,0x0);},'__cargo_web_snippet_2b0b92aee0d0de6a955f8e5540d7923636d951ae':function(_0xe6897e,_0x4040c4){_0x4040c4=_0x2e9ac3[_0x577e('0xce','*j4Z')][_0x577e('0x1b3','vZe4')](_0x4040c4),_0x2e9ac3[_0x577e('0x12c','zxP3')]['from_js'](_0xe6897e,function(){try{return{'value':_0x4040c4[_0x577e('0x1b4','g10M')],'success':!0x0};}catch(_0x362a6e){return{'error':_0x362a6e,'success':!0x1};}}());},'__cargo_web_snippet_461d4581925d5b0bf583a3b445ed676af8701ca6':function(_0x2dbaf6,_0x3c649e){_0x3c649e=_0x2e9ac3[_0x577e('0x179','gYHe')]['to_js'](_0x3c649e),_0x2e9ac3[_0x577e('0x14d','TvR&')][_0x577e('0x1b5','zsOc')](_0x2dbaf6,function(){try{return{'value':_0x3c649e[_0x577e('0x1b6','vZe4')],'success':!0x0};}catch(_0xc72f5a){return{'error':_0xc72f5a,'success':!0x1};}}());},'__cargo_web_snippet_4c895ac2b754e5559c1415b6546d672c58e29da6':function(_0x3a656b,_0x395ed2){_0x395ed2=_0x2e9ac3[_0x577e('0x12c','zxP3')][_0x577e('0x1b7','%W9^')](_0x395ed2),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1b8','Pro%')](_0x3a656b,function(){try{return{'value':_0x395ed2[_0x577e('0x1b9','^I8]')],'success':!0x0};}catch(_0x2eb7ea){return{'error':_0x2eb7ea,'success':!0x1};}}());},'__cargo_web_snippet_614a3dd2adb7e9eac4a0ec6e59d37f87e0521c3b':function(_0x262a16,_0x57cea2){_0x57cea2=_0x2e9ac3[_0x577e('0x1ba','Jdte')]['to_js'](_0x57cea2),_0x2e9ac3[_0x577e('0xc5','*5Rb')][_0x577e('0x1ae','pZoy')](_0x262a16,_0x57cea2[_0x577e('0x1bb','qs!D')]);},'__cargo_web_snippet_62ef43cf95b12a9b5cdec1639439c972d6373280':function(_0x5d78b9,_0x940eb3){_0x940eb3=_0x2e9ac3[_0x577e('0xce','*j4Z')][_0x577e('0x1bc','Dj]B')](_0x940eb3),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1bd','Y0)h')](_0x5d78b9,_0x940eb3[_0x577e('0x1be','*j4Z')]);},'__cargo_web_snippet_6fcce0aae651e2d748e085ff1f800f87625ff8c8':function(_0x1c0453){_0x2e9ac3[_0x577e('0x1bf','eFdV')][_0x577e('0x1c0','dY4$')](_0x1c0453,document);},'__cargo_web_snippet_7ba9f102925446c90affc984f921f414615e07dd':function(_0x2bcd8d,_0xf62fdd){_0xf62fdd=_0x2e9ac3[_0x577e('0x1ba','Jdte')]['to_js'](_0xf62fdd),_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0x1c1','qs!D')](_0x2bcd8d,_0xf62fdd[_0x577e('0x1c2','mnGG')]);},'__cargo_web_snippet_80d6d56760c65e49b7be8b6b01c1ea861b046bf0':function(_0x44ff64){_0x2e9ac3[_0x577e('0x1c3','zXvY')]['decrement_refcount'](_0x44ff64);},'__cargo_web_snippet_897ff2d0160606ea98961935acb125d1ddbf4688':function(_0x2786ad){var _0x34bc78=_0x2e9ac3[_0x577e('0x118','zsOc')]['acquire_js_reference'](_0x2786ad);return _0x34bc78 instanceof DOMException&&_0x16fd1a['huIus'](_0x16fd1a[_0x577e('0x1c4','mnGG')],_0x34bc78['name']);},'__cargo_web_snippet_8c32019649bb581b1b742eeedfc410e2bedd56a6':function(_0x177e12,_0x446d14){var _0x3bb3f7=_0x2e9ac3[_0x577e('0x1c5','Dj]B')][_0x577e('0x1c6','^I8]')](_0x177e12);_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1c7','9N[*')](_0x446d14,_0x3bb3f7);},'__cargo_web_snippet_a466a2ab96cd77e1a77dcdb39f4f031701c195fc':function(_0x2b6f7a,_0x1ed59b){_0x1ed59b=_0x2e9ac3[_0x577e('0xfe','XBon')][_0x577e('0x1c8','CqZo')](_0x1ed59b),_0x2e9ac3['STDWEB_PRIVATE']['from_js'](_0x2b6f7a,function(){try{return{'value':_0x1ed59b[_0x577e('0x1c9','3mY$')],'success':!0x0};}catch(_0x185af1){return{'error':_0x185af1,'success':!0x1};}}());},'__cargo_web_snippet_ab05f53189dacccf2d365ad26daa407d4f7abea9':function(_0x300980,_0x4118eb){_0x4118eb=_0x2e9ac3[_0x577e('0x1ca','i6$Z')][_0x577e('0x1b3','vZe4')](_0x4118eb),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1cb','Jdte')](_0x300980,_0x4118eb[_0x577e('0x1cc','&UNs')]);},'__cargo_web_snippet_b06dde4acf09433b5190a4b001259fe5d4abcbc2':function(_0x3343fd,_0x96bddf){_0x96bddf=_0x2e9ac3[_0x577e('0xa8','*%Q&')][_0x577e('0x1cd','*5Rb')](_0x96bddf),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1ce','%W9^')](_0x3343fd,_0x96bddf['success']);},'__cargo_web_snippet_b33a39de4ca954888e26fe9caa277138e808eeba':function(_0x53e9ec,_0x491cd5){_0x491cd5=_0x2e9ac3[_0x577e('0x1cf','vZe4')][_0x577e('0x1d0','u1J8')](_0x491cd5),_0x2e9ac3[_0x577e('0x1d1','sCFV')][_0x577e('0x1d2','4r89')](_0x53e9ec,_0x491cd5[_0x577e('0x1d3','l(zF')]);},'__cargo_web_snippet_cdf2859151791ce4cad80688b200564fb08a8613':function(_0x167c62,_0x5eaccf){_0x5eaccf=_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1d4','Jdte')](_0x5eaccf),_0x2e9ac3[_0x577e('0x186','^I8]')][_0x577e('0x1d5','XBon')](_0x167c62,function(){try{return{'value':_0x5eaccf[_0x577e('0x1d6','eFdV')],'success':!0x0};}catch(_0x3f40a2){return{'error':_0x3f40a2,'success':!0x1};}}());},'__cargo_web_snippet_e8ef87c41ded1c10f8de3c70dea31a053e19747c':function(_0x18b91f,_0xc571f5){_0xc571f5=_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1c8','CqZo')](_0xc571f5),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1d7','zXvY')](_0x18b91f,function(){try{return{'value':_0xc571f5['hostname'],'success':!0x0};}catch(_0x59a30f){return{'error':_0x59a30f,'success':!0x1};}}());},'__cargo_web_snippet_e9638d6405ab65f78daf4a5af9c9de14ecf1e2ec':function(_0x119a0c){_0x119a0c=_0x2e9ac3[_0x577e('0x1d8','D*h1')][_0x577e('0x1d9','VEMc')](_0x119a0c),_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1da','u1J8')](_0x119a0c);},'__cargo_web_snippet_ff5103e6cc179d13b4c7a785bdce2708fd559fc0':function(_0xcdb4fd){_0x2e9ac3['STDWEB_PRIVATE'][_0x577e('0x1db','u1J8')]=_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0xa9','b9Rz')](_0xcdb4fd);},'__web_on_grow':_0xb862bb}},'initialize':function(_0x54977a){return Object[_0x577e('0x1dc','4r89')](_0x2e9ac3,_0x2b07ce[_0x577e('0x1dd','CqZo')],{'value':_0x54977a}),Object[_0x577e('0x1de','@)9V')](_0x2e9ac3,_0x2b07ce['pWFNU'],{'value':_0x2e9ac3[_0x577e('0x1df','^I8]')][_0x577e('0x1e0','zsOc')][_0x577e('0x1e1','3mY$')]}),Object[_0x577e('0x1e2','i6$Z')](_0x2e9ac3,_0x2b07ce['kzhnL'],{'value':_0x2e9ac3['instance']['exports'][_0x577e('0x1e3','Y0)h')]}),Object['defineProperty'](_0x2e9ac3,_0x577e('0x1e4','g10M'),{'value':_0x2e9ac3['instance'][_0x577e('0x1e5','lPeP')]['__indirect_function_table']}),_0x2e9ac3['exports'][_0x577e('0x1e6','3mY$')]=function(_0xb4fa59,_0x361ecf){return _0x2e9ac3[_0x577e('0x1d1','sCFV')][_0x577e('0x1e7','g10M')](_0x2e9ac3[_0x577e('0x1df','^I8]')][_0x577e('0x1e8','Jdte')]['spyder'](_0x2e9ac3[_0x577e('0xa8','*%Q&')][_0x577e('0x1e9','&UNs')](_0xb4fa59),_0x2e9ac3[_0x577e('0xc0','g10M')][_0x577e('0x1ea','3mY$')](_0x361ecf)));},_0x2b07ce[_0x577e('0x1eb','CqZo')](_0xb862bb),BiliPushUtils[_0x577e('0x1ec','[a*F')]=function(_0x413596,_0x195c83){if(CONFIG[_0x577e('0x1ed','dY4$')]&&BiliPush[_0x577e('0x1ee','NU&@')]){return _0x2e9ac3[_0x577e('0x1ef','vZe4')][_0x577e('0x1f0','Dj]B')](_0x413596,_0x195c83);}return'';},_0x2e9ac3['exports'];}};};},893:function(_0x5922a6,_0x2d8f74,_0x48864f){var _0x2633fe={'SkNoC':_0x577e('0x1f1','^I8]')};_0x48864f(0x1f4)(_0x2633fe[_0x577e('0x1f2','u1J8')]);},894:function(_0x20dfc0,_0x3cac43,_0x3a61a4){var _0x568c3f={'fcPYd':function _0x196a8f(_0x2016f5,_0x5d0233){return _0x2016f5(_0x5d0233);},'qExRa':_0x577e('0x1f3','9N[*')};_0x568c3f[_0x577e('0x1f4','@)9V')](_0x3a61a4,0x1f5)(_0x568c3f[_0x577e('0x1f5','@)9V')]);},895:function(_0x1da93c,_0x865c50,_0x1efb6f){var _0x2929cb={'kKqOb':function _0x362864(_0x125b0e,_0x4350f9,_0xc5aa95){return _0x125b0e(_0x4350f9,_0xc5aa95);},'blgyj':function _0x592e9e(_0x1e0e04,_0x2d86fe,_0x64879c,_0x4a56bd,_0x5725a7){return _0x1e0e04(_0x2d86fe,_0x64879c,_0x4a56bd,_0x5725a7);},'NrQpL':function _0x313701(_0x11368e,_0x200555){return _0x11368e(_0x200555);},'eXVLn':function _0x1e51f3(_0x23b8bb,_0x39c40c,_0x170ba){return _0x23b8bb(_0x39c40c,_0x170ba);},'yUZfx':function _0xa5eafa(_0x3dd924,_0xe46db1){return _0x3dd924(_0xe46db1);},'dDwbV':function _0x45a45f(_0x39e842,_0x417876){return _0x39e842===_0x417876;},'Xubom':function _0x1bffb2(_0x318aed,_0xa51031){return _0x318aed(_0xa51031);},'QdatQ':function _0x3fca79(_0xab5e7d,_0x49ba1f){return _0xab5e7d(_0x49ba1f);},'NkDrH':function _0x38892e(_0x5dbe1a,_0x3fa847){return _0x5dbe1a(_0x3fa847);},'SKgZk':function _0x5bc555(_0x4e363b,_0x4f9dbd){return _0x4e363b(_0x4f9dbd);},'zsQWl':function _0x163337(_0x2f08f0,_0x35d99a){return _0x2f08f0(_0x35d99a);}};'use strict';var _0x187c51=_0x2929cb[_0x577e('0x1f6','qs!D')](_0x1efb6f,0xb7),_0x5936ea=_0x1efb6f(0xb4)[_0x577e('0x1f7','l(zF')],_0x178660=_0x2929cb[_0x577e('0x1f8','&XW^')](_0x1efb6f,0x14),_0x10b6e0=_0x1efb6f(0x1f),_0x1d5ea7=_0x2929cb[_0x577e('0x1f9','%W9^')](_0x1efb6f,0xb8),_0x2d77d8=_0x2929cb[_0x577e('0x1fa','*5Rb')](_0x1efb6f,0xb5),_0x5984a4=_0x2929cb[_0x577e('0x1fb','Y0)h')](_0x1efb6f,0x1dd),_0x2f16b2=_0x2929cb['SKgZk'](_0x1efb6f,0x20),_0x3ec852=_0x1efb6f(0x19b),_0x5ac36d=_0x2929cb[_0x577e('0x1fc','l(zF')](_0x5984a4,0x5),_0x11d637=_0x2929cb[_0x577e('0x1fd','TvR&')](_0x5984a4,0x6),_0x299415=0x0,_0x5cd04f=function(_0x2877b5){return _0x2877b5['_l']||(_0x2877b5['_l']=new _0x58867f());},_0x58867f=function(){this['a']=[];},_0x31d1a1=function(_0x3c1998,_0x3d08b9){return _0x5ac36d(_0x3c1998['a'],function(_0x4e0777){return _0x4e0777[0x0]===_0x3d08b9;});};_0x58867f['prototype']={'get':function(_0x3f4d8d){var _0x865c50=_0x31d1a1(this,_0x3f4d8d);if(_0x865c50)return _0x865c50[0x1];},'has':function(_0x329dd0){return!!_0x2929cb[_0x577e('0x1fe','b9Rz')](_0x31d1a1,this,_0x329dd0);},'set':function(_0x367fff,_0x12471e){var _0x1efb6f=_0x2929cb[_0x577e('0x1ff','^I8]')](_0x31d1a1,this,_0x367fff);_0x1efb6f?_0x1efb6f[0x1]=_0x12471e:this['a']['push']([_0x367fff,_0x12471e]);},'delete':function(_0x408b33){var _0x865c50=_0x2929cb[_0x577e('0x200','sCFV')](_0x11d637,this['a'],function(_0x2084fd){return _0x2084fd[0x0]===_0x408b33;});return~_0x865c50&&this['a'][_0x577e('0x201','*j4Z')](_0x865c50,0x1),!!~_0x865c50;}},_0x1da93c['exports']={'getConstructor':function(_0x20a478,_0x4ee709,_0x563da5,_0x17b221){var _0x18cc65={'eSxxd':function _0x5a5cb3(_0x40e351,_0x32084a,_0x21230b,_0x13dd92,_0x187de1){return _0x2929cb[_0x577e('0x202','4r89')](_0x40e351,_0x32084a,_0x21230b,_0x13dd92,_0x187de1);},'oPwnZ':function _0x3cf2ba(_0x5143a4,_0x169d31){return _0x5143a4!=_0x169d31;},'UMYIt':function _0x22ec9e(_0x1d8462,_0x229d42){return _0x2929cb[_0x577e('0x203','eGx4')](_0x1d8462,_0x229d42);},'VTcHY':function _0xb7b2f3(_0x182768,_0x338457){return _0x182768===_0x338457;},'QcllH':function _0xbf9da1(_0x5df9eb,_0x2b848f,_0x36257b){return _0x2929cb[_0x577e('0x204','mnGG')](_0x5df9eb,_0x2b848f,_0x36257b);},'mjuSN':function _0x5c20d5(_0x106b95,_0x48b23a){return _0x106b95(_0x48b23a);}};var _0x2a46fb=_0x2929cb[_0x577e('0x205','[a*F')](_0x20a478,function(_0x23f2b6,_0x4b90bd){_0x18cc65['eSxxd'](_0x1d5ea7,_0x23f2b6,_0x2a46fb,_0x4ee709,'_i'),_0x23f2b6['_t']=_0x4ee709,_0x23f2b6['_i']=_0x299415++,_0x23f2b6['_l']=void 0x0,_0x18cc65[_0x577e('0x206','Y0)h')](void 0x0,_0x4b90bd)&&_0x18cc65[_0x577e('0x207','pZoy')](_0x2d77d8,_0x4b90bd,_0x563da5,_0x23f2b6[_0x17b221],_0x23f2b6);});return _0x2929cb[_0x577e('0x208','3mY$')](_0x187c51,_0x2a46fb['prototype'],{'delete':function(_0x236194){if(!_0x18cc65[_0x577e('0x209','[a*F')](_0x10b6e0,_0x236194))return!0x1;var _0x563da5=_0x5936ea(_0x236194);return _0x18cc65[_0x577e('0x20a','*5Rb')](!0x0,_0x563da5)?_0x18cc65[_0x577e('0x20b','gYHe')](_0x5cd04f,_0x18cc65['QcllH'](_0x3ec852,this,_0x4ee709))[_0x577e('0x20c','NU&@')](_0x236194):_0x563da5&&_0x2f16b2(_0x563da5,this['_i'])&&delete _0x563da5[this['_i']];},'has':function(_0x542682){if(!_0x18cc65[_0x577e('0x20d','zXvY')](_0x10b6e0,_0x542682))return!0x1;var _0x563da5=_0x18cc65[_0x577e('0x20e','XBon')](_0x5936ea,_0x542682);return!0x0===_0x563da5?_0x18cc65[_0x577e('0x20f','9N[*')](_0x5cd04f,_0x18cc65[_0x577e('0x210','9N[*')](_0x3ec852,this,_0x4ee709))[_0x577e('0x211','sCFV')](_0x542682):_0x563da5&&_0x18cc65['QcllH'](_0x2f16b2,_0x563da5,this['_i']);}}),_0x2a46fb;},'def':function(_0x372259,_0x406a92,_0x27bbc0){var _0x37f3d7=_0x2929cb[_0x577e('0x212','b9Rz')](_0x5936ea,_0x2929cb[_0x577e('0x213','pZoy')](_0x178660,_0x406a92),!0x0);return _0x2929cb[_0x577e('0x214','@)9V')](!0x0,_0x37f3d7)?_0x2929cb[_0x577e('0x215','zsOc')](_0x5cd04f,_0x372259)[_0x577e('0x216','zxP3')](_0x406a92,_0x27bbc0):_0x37f3d7[_0x372259['_i']]=_0x27bbc0,_0x372259;},'ufstore':_0x5cd04f};},896:function(_0x8ec674,_0x520df7,_0x406d8d){var _0x57c18f={'dRCdz':function _0x292afc(_0x24da81,_0x8627f0){return _0x24da81(_0x8627f0);},'MBMTg':function _0x780210(_0x463c88,_0x5a089f){return _0x463c88===_0x5a089f;},'IqgjF':function _0x4c589f(_0x3c46fb,_0x3602f8){return _0x3c46fb(_0x3602f8);},'zncmi':function _0x21d116(_0x2ad711,_0x440db9,_0x5e27cc){return _0x2ad711(_0x440db9,_0x5e27cc);},'IwJNh':function _0x334b5a(_0x203890,_0x1abed7){return _0x203890==_0x1abed7;},'lHvjk':'set','UrntT':function _0x156950(_0x17a09c,_0x5d2150,_0x26dcaa,_0x19597d){return _0x17a09c(_0x5d2150,_0x26dcaa,_0x19597d);},'PZdoV':function _0x4d068d(_0xd04555,_0x2774af){return _0xd04555(_0x2774af);},'ymMBB':function _0x47f33a(_0x34bce1,_0x3ec9e9){return _0x34bce1(_0x3ec9e9);},'byRDi':function _0x397f4c(_0x2cba0b,_0x4e6a7c){return _0x2cba0b(_0x4e6a7c);},'OiGrh':function _0x1a432e(_0x39aa05,_0x22eb46){return _0x39aa05(_0x22eb46);},'kbtKu':function _0x5603d0(_0x59ea31,_0x38554f){return _0x59ea31 in _0x38554f;},'CplNo':_0x577e('0x217','NU&@'),'TMZIS':function _0x4ac744(_0x59fc0d,_0x164547){return _0x59fc0d(_0x164547);},'NPEjL':function _0x1c85d8(_0x2cfeb3,_0x306350){return _0x2cfeb3&&_0x306350;},'EwYsi':_0x577e('0x218','b9Rz'),'vEKLW':'delete','tBcxj':_0x577e('0x219','u1J8')};'use strict';var _0x52581d,_0x308c76=_0x406d8d(0xa),_0x43d759=_0x406d8d(0x1dd)(0x0),_0x164869=_0x57c18f[_0x577e('0x21a','l(zF')](_0x406d8d,0x82),_0x564d2e=_0x57c18f[_0x577e('0x21b','sCFV')](_0x406d8d,0xb4),_0x59056a=_0x57c18f[_0x577e('0x21c','&UNs')](_0x406d8d,0xb9),_0x3568b0=_0x57c18f[_0x577e('0x21d','TvR&')](_0x406d8d,0x37f),_0x4a72a8=_0x57c18f['byRDi'](_0x406d8d,0x1f),_0x40b9b4=_0x57c18f[_0x577e('0x21e','*j4Z')](_0x406d8d,0x19b),_0x6a301e=_0x57c18f[_0x577e('0x21f','CqZo')](_0x406d8d,0x19b),_0x5f352d=!_0x308c76[_0x577e('0x220','b9Rz')]&&_0x57c18f[_0x577e('0x221','[a*F')](_0x57c18f[_0x577e('0x222','XBon')],_0x308c76),_0x5a9b88=_0x564d2e['getWeak'],_0x2d7df5=Object[_0x577e('0x223','eGx4')],_0x3d9eb4=_0x3568b0[_0x577e('0x224','l(zF')],_0x282cf4=function(_0x3401ae){return function(){return _0x3401ae(this,arguments['length']>0x0?arguments[0x0]:void 0x0);};},_0xf22dab={'get':function(_0x31fd05){if(_0x57c18f['dRCdz'](_0x4a72a8,_0x31fd05)){var _0x520df7=_0x5a9b88(_0x31fd05);return _0x57c18f[_0x577e('0x225','McH&')](!0x0,_0x520df7)?_0x57c18f['IqgjF'](_0x3d9eb4,_0x57c18f['zncmi'](_0x40b9b4,this,_0x577e('0x226','vZe4')))['get'](_0x31fd05):_0x520df7?_0x520df7[this['_i']]:void 0x0;}},'set':function(_0x41b355,_0x1272dd){return _0x3568b0['def'](_0x57c18f[_0x577e('0x227','NU&@')](_0x40b9b4,this,_0x577e('0x228','*5Rb')),_0x41b355,_0x1272dd);}},_0x289e03=_0x8ec674[_0x577e('0x229','*j4Z')]=_0x57c18f[_0x577e('0x22a','u1J8')](_0x406d8d,0x1f6)('WeakMap',_0x282cf4,_0xf22dab,_0x3568b0,!0x0,!0x0);_0x57c18f[_0x577e('0x22b','CqZo')](_0x6a301e,_0x5f352d)&&(_0x59056a((_0x52581d=_0x3568b0['getConstructor'](_0x282cf4,_0x57c18f['EwYsi']))[_0x577e('0x22c','i6$Z')],_0xf22dab),_0x564d2e['NEED']=!0x0,_0x43d759([_0x57c18f[_0x577e('0x22d',')ffk')],_0x57c18f['tBcxj'],_0x577e('0x22e','@)9V'),'set'],function(_0x21fbd4){var _0x233d73={'LaDjx':function _0x2e5c24(_0x4d6933,_0x153bd2){return _0x4d6933(_0x153bd2);},'pdFrG':function _0x127282(_0x1460fd,_0x51ed18){return _0x57c18f['IwJNh'](_0x1460fd,_0x51ed18);},'uUcht':_0x57c18f[_0x577e('0x22f','&XW^')]};var _0x520df7=_0x289e03[_0x577e('0x230','sCFV')],_0x406d8d=_0x520df7[_0x21fbd4];_0x57c18f[_0x577e('0x231','NU&@')](_0x164869,_0x520df7,_0x21fbd4,function(_0x521505,_0x35ac5b){if(_0x4a72a8(_0x521505)&&!_0x233d73['LaDjx'](_0x2d7df5,_0x521505)){this['_f']||(this['_f']=new _0x52581d());var _0x5bb1f8=this['_f'][_0x21fbd4](_0x521505,_0x35ac5b);return _0x233d73[_0x577e('0x232','zsOc')](_0x233d73[_0x577e('0x233','%C%y')],_0x21fbd4)?this:_0x5bb1f8;}return _0x406d8d[_0x577e('0x234','[a*F')](this,_0x521505,_0x35ac5b);});}));},897:function(_0x358281,_0x3f0b88,_0x3b4d80){var _0xbe7cad={'ChKgi':function _0x2530b7(_0x1c4359,_0x3e0d6b){return _0x1c4359(_0x3e0d6b);},'KfrzV':function _0x57a982(_0xdec579,_0x15efef){return _0xdec579(_0x15efef);},'OEGpM':function _0x6810c9(_0x466e25,_0x52d047){return _0x466e25(_0x52d047);}};_0xbe7cad[_0x577e('0x235','&XW^')](_0x3b4d80,0x80),_0xbe7cad['KfrzV'](_0x3b4d80,0x57),_0x3b4d80(0x380),_0xbe7cad[_0x577e('0x236','By7P')](_0x3b4d80,0x37e),_0x3b4d80(0x37d),_0x358281['exports']=_0xbe7cad[_0x577e('0x237','eGx4')](_0x3b4d80,0x7)[_0x577e('0x238','&UNs')];},898:function(_0x322aea,_0x592017,_0x33edbd){_0x322aea['exports']={'default':_0x33edbd(0x381),'__esModule':!0x0};}}]);;(function(_0x34024c,_0x3df5db,_0x43d5ab){var _0x4cc542={'twnry':_0x577e('0x239','pZoy'),'AENgY':function _0x488756(_0x45e28e,_0x179838){return _0x45e28e!==_0x179838;},'QVqTo':_0x577e('0x23a','McH&'),'JKKpQ':function _0x1f7480(_0x24cb50,_0x3f1ca4){return _0x24cb50===_0x3f1ca4;},'mBRHg':_0x577e('0x23b','pZoy'),'dGhhj':function _0x157855(_0x1fceb0,_0x3ba6ce){return _0x1fceb0+_0x3ba6ce;},'KhLuF':_0x577e('0x23c','pZoy')};_0x43d5ab='al';try{_0x43d5ab+=_0x4cc542[_0x577e('0x23d','lPeP')];_0x3df5db=encode_version;if(!(_0x4cc542[_0x577e('0x23e','eGx4')](typeof _0x3df5db,_0x4cc542[_0x577e('0x23f','Owm^')])&&_0x4cc542[_0x577e('0x240','By7P')](_0x3df5db,_0x4cc542[_0x577e('0x241','mnGG')]))){_0x34024c[_0x43d5ab](_0x4cc542['dGhhj']('删除',_0x4cc542[_0x577e('0x242','%C%y')]));}}catch(_0x305387){_0x34024c[_0x43d5ab](_0x577e('0x243','sCFV'));}}(window));;encode_version = 'sojson.v5';

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

        $(document).ready(() => {
            Init().then(Run);
        });
    }
})();
